// 经济：钱包、库存、行市、买卖、砍价、声望、夜里结算、胜负判定。
// 行动点规则（docs/DESIGN.md）：走动不耗点，进货、卖货、砍价各耗1点。
// 砍价本身就是一次交易：谈成就按谈好的价成交，不再另扣点；谈崩也照扣。
import { CONFIG } from './config.js';

export class Economy {
  constructor() {
    const e = CONFIG.economy;
    this.money = e.startMoney;
    this.goal = e.goalMoney;
    this.day = 1;
    this.days = e.days;
    this.ap = e.actionPointsPerDay;
    this.apPerDay = e.actionPointsPerDay;
    this.rep = 0;
    this.inventory = new Map(); // id -> {qty, cost}（cost为总进价，用于算盈利）
    this.dayProfit = 0;
    this.prices = {};
    this.haggle = null;
  }

  setPrices(prices) {
    this.prices = prices || {};
  }

  priceOf(id) {
    return this.prices[id] || 0;
  }

  // 声望效果：最高50声望对应买卖各优惠10%
  repBuyFactor() {
    return 1 - Math.min(this.rep, 50) * 0.002;
  }

  repSellFactor() {
    return 1 + Math.min(this.rep, 50) * 0.002;
  }

  buyPrice(id) {
    return Math.max(1, Math.round(this.priceOf(id) * this.repBuyFactor()));
  }

  sellPrice(id) {
    return Math.max(1, Math.round(this.priceOf(id) * this.repSellFactor()));
  }

  hasAP() {
    return this.ap > 0;
  }

  useAP() {
    if (this.ap <= 0) return false;
    this.ap--;
    return true;
  }

  invQty(id) {
    const inv = this.inventory.get(id);
    return inv ? inv.qty : 0;
  }

  invValue() {
    let v = 0;
    for (const [id, inv] of this.inventory) v += inv.qty * this.priceOf(id);
    return v;
  }

  netWorth() {
    return this.money + this.invValue();
  }

  buy(id, qty, unitPrice) {
    const total = unitPrice * qty;
    if (this.money < total) return { ok: false, message: '钱不够，买不起这么多' };
    const inv = this.inventory.get(id) || { qty: 0, cost: 0 };
    inv.qty += qty;
    inv.cost += total;
    this.inventory.set(id, inv);
    this.money -= total;
    return { ok: true, message: '买下' + qty + '份，花了' + total + '文' };
  }

  sell(id, qty, unitPrice) {
    const inv = this.inventory.get(id);
    if (!inv || inv.qty < qty) return { ok: false, message: '手里没这么多货' };
    const avg = inv.cost / inv.qty;
    this.dayProfit += qty * (unitPrice - avg);
    inv.qty -= qty;
    inv.cost -= avg * qty;
    if (inv.qty <= 0) this.inventory.delete(id);
    else this.inventory.set(id, inv);
    this.money += unitPrice * qty;
    return { ok: true, message: '卖出' + qty + '份，进账' + unitPrice * qty + '文' };
  }

  // 开始砍价：耗1行动点。kind为buy或sell，qty为这笔交易的数量
  startHaggle(kind, id, qty) {
    if (!this.useAP()) return { ok: false, message: '行动点用完了，打烊睡觉恢复' };
    const market = this.priceOf(id);
    const e = CONFIG.economy;
    if (kind === 'buy') {
      if (this.money < Math.round(market * 0.7) * qty) {
        this.ap++;
        return { ok: false, message: '钱不够，连最低价都出不起' };
      }
      const floor = Math.max(
        Math.round(market * 0.62),
        Math.round(market * (0.78 - this.rep * 0.002)),
      );
      this.haggle = { kind, id, qty, market, limit: floor, patience: 100, rounds: e.haggleRounds, options: [0.7, 0.8, 0.9] };
    } else {
      if (this.invQty(id) < qty) {
        this.ap++;
        return { ok: false, message: '手里没这么多货' };
      }
      const ceil = Math.min(
        Math.round(market * 1.38),
        Math.round(market * (1.22 + this.rep * 0.002)),
      );
      this.haggle = { kind, id, qty, market, limit: ceil, patience: 100, rounds: e.haggleRounds, options: [1.3, 1.2, 1.1] };
    }
    return { ok: true, haggle: this.haggle };
  }

  // 出一轮价：factor为出价倍数（相对行市价）
  haggleOffer(factor) {
    const h = this.haggle;
    if (!h) return { ok: false, message: '没有在谈的买卖' };
    const offered = Math.max(1, Math.round(h.market * factor));
    const accepted = h.kind === 'buy' ? offered >= h.limit : offered <= h.limit;
    if (accepted) {
      const result = h.kind === 'buy' ? this.buy(h.id, h.qty, offered) : this.sell(h.id, h.qty, offered);
      this.haggle = null;
      if (!result.ok) return { ok: false, message: result.message };
      this.rep = Math.min(100, this.rep + 2);
      return { ok: true, accepted: true, price: offered, message: '成交！' + offered + '文' };
    }
    const cost = factor === h.options[0] ? 35 : factor === h.options[1] ? 22 : 12;
    h.patience -= cost;
    h.rounds--;
    if (h.patience <= 0 || h.rounds <= 0) {
      this.haggle = null;
      this.rep = Math.max(0, this.rep - 1);
      return { ok: true, accepted: false, collapsed: true, message: '谈崩了，摊主扭头不理你了' };
    }
    return {
      ok: true,
      accepted: false,
      patience: h.patience,
      rounds: h.rounds,
      message: '摊主摇头：这个价不成，再让让？',
    };
  }

  cancelHaggle() {
    this.haggle = null;
  }

  // 夜里结算：房租40文，盈利税5%（只对当日盈利收），然后进下一天
  endDay() {
    const e = CONFIG.economy;
    const rent = e.rentPerNight;
    const tax = Math.round(Math.max(0, this.dayProfit) * e.taxRate);
    this.money = Math.max(0, this.money - rent - tax);
    const summary = { day: this.day, rent, tax, profit: this.dayProfit, money: this.money };
    this.dayProfit = 0;
    this.day++;
    this.ap = this.apPerDay;
    return summary;
  }

  isWin() {
    return this.money >= this.goal;
  }

  isGameOver() {
    return this.day > this.days;
  }
}
