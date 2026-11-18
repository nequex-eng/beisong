// 界面：HUD、买卖面板、砍价面板、库存、结算、胜负屏、提示。
// 界面文字遵守中文与英文字母、数字、符号之间不加空格。
import { CONFIG } from './config.js';

function el(tag, cls, text) {
  const d = document.createElement(tag);
  if (cls) d.className = cls;
  if (text != null) d.textContent = text;
  return d;
}

export function createUI(hooks) {
  const eco = hooks.economy;
  const hud = document.getElementById('hud');
  const panels = document.getElementById('panels');
  const toastBox = document.getElementById('toast');
  const promptBox = document.getElementById('prompt');
  const errLine = document.getElementById('errline');
  let toastTimer = 0;

  // ---- HUD ----
  const hudLeft = el('div', 'hud-left');
  const moneyEl = el('span', 'hud-money');
  const worthEl = el('span', 'hud-worth');
  const dayEl = el('span', 'hud-day');
  const apEl = el('span', 'hud-ap');
  const repEl = el('span', 'hud-rep');
  hudLeft.append(moneyEl, worthEl, dayEl, apEl, repEl);
  const hudRight = el('div', 'hud-right');
  const invBtn = el('button', 'hud-btn', '库存');
  const sleepBtn = el('button', 'hud-btn', '打烊睡觉');
  const hdBtn = el('button', 'hud-btn', '高清：关');
  hudRight.append(invBtn, sleepBtn, hdBtn);
  hud.append(hudLeft, hudRight);

  invBtn.onclick = () => showInventory();
  sleepBtn.onclick = () => hooks.onSleep();
  hdBtn.onclick = () => {
    const on = hooks.onToggleHD();
    hdBtn.textContent = on ? '高清：开' : '高清：关';
  };

  // ---- 提示条（靠近摊主时出现） ----
  const promptText = el('span', 'prompt-text');
  const talkBtn = el('button', 'prompt-btn', '谈话');
  promptBox.append(promptText, talkBtn);
  talkBtn.onclick = () => hooks.onTalk();
  promptBox.style.display = 'none';

  // ---- 面板 ----
  const tradePanel = el('div', 'panel');
  const hagglePanel = el('div', 'panel');
  const invPanel = el('div', 'panel');
  const settlePanel = el('div', 'panel');
  const endPanel = el('div', 'panel');
  panels.append(tradePanel, hagglePanel, invPanel, settlePanel, endPanel);
  const allPanels = [tradePanel, hagglePanel, invPanel, settlePanel, endPanel];
  allPanels.forEach((p) => { p.style.display = 'none'; });

  function hidePanels() {
    allPanels.forEach((p) => { p.style.display = 'none'; });
  }

  function showPanel(p) {
    hidePanels();
    p.style.display = 'block';
  }

  function toast(msg) {
    toastBox.textContent = msg;
    toastBox.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastBox.style.display = 'none'; }, 2600);
  }

  function updateHUD() {
    moneyEl.textContent = '钱' + eco.money + '文';
    worthEl.textContent = '身家' + eco.netWorth() + '文';
    dayEl.textContent = '第' + Math.min(eco.day, eco.days) + '天/共' + eco.days + '天';
    apEl.textContent = '行动点' + eco.ap + '/' + eco.apPerDay;
    repEl.textContent = '声望' + eco.rep;
  }

  function closeBtn(onClick) {
    const b = el('button', 'close-btn', '×');
    b.onclick = onClick;
    return b;
  }

  // ---- 买卖面板 ----
  function showTrade(npcLine) {
    tradePanel.innerHTML = '';
    tradePanel.append(el('h2', '', '茶馆摊主的摊子'), closeBtn(hidePanels));
    if (npcLine) tradePanel.append(el('p', 'npc-line', '摊主：' + npcLine));
    tradePanel.append(el('p', 'hint', '今日行市（每种货买卖同价，低买高卖靠隔天价差和砍价）；进货、卖货、砍价各耗1行动点'));
    const table = el('div', 'goods-table');
    const head = el('div', 'goods-row goods-head');
    head.append(el('span', '', '货'), el('span', '', '今日价'), el('span', '', '持有'), el('span', '', '数量'), el('span', '', ''));
    table.append(head);
    for (const g of CONFIG.economy.goods) {
      const row = el('div', 'goods-row');
      row.append(el('span', '', g.name));
      row.append(el('span', '', eco.priceOf(g.id) + '文'));
      row.append(el('span', '', String(eco.invQty(g.id))));
      const qty = document.createElement('input');
      qty.type = 'number';
      qty.min = '1';
      qty.max = '99';
      qty.value = '1';
      qty.className = 'qty-input';
      row.append(qty);
      const btns = el('span', 'row-btns');
      const bBuy = el('button', 'mini-btn', '买');
      const bSell = el('button', 'mini-btn', '卖');
      const bHaggleBuy = el('button', 'mini-btn', '砍价买');
      const bHaggleSell = el('button', 'mini-btn', '砍价卖');
      const n = () => Math.max(1, Math.min(99, parseInt(qty.value, 10) || 1));
      bBuy.onclick = () => hooks.onBuy(g.id, n());
      bSell.onclick = () => hooks.onSell(g.id, n());
      bHaggleBuy.onclick = () => hooks.onHaggle('buy', g.id, n());
      bHaggleSell.onclick = () => hooks.onHaggle('sell', g.id, n());
      btns.append(bBuy, bSell, bHaggleBuy, bHaggleSell);
      row.append(btns);
      table.append(row);
    }
    tradePanel.append(table);
    showPanel(tradePanel);
    updateHUD();
  }

  // ---- 砍价面板 ----
  function showHaggle(h) {
    hagglePanel.innerHTML = '';
    const good = CONFIG.economy.goods.find((g) => g.id === h.id);
    const title = (h.kind === 'buy' ? '砍价买' : '砍价卖') + (good ? good.name : '') + '×' + h.qty;
    hagglePanel.append(el('h2', '', title), closeBtn(() => { hooks.onCancelHaggle(); hidePanels(); }));
    hagglePanel.append(el('p', 'hint', '行市价' + h.market + '文；摊主底线不会告诉你，出价越狠耐心掉得越快'));
    const barWrap = el('div', 'patience-wrap');
    const bar = el('div', 'patience-bar');
    bar.style.width = h.patience + '%';
    barWrap.append(bar);
    hagglePanel.append(el('p', '', '摊主耐心'), barWrap);
    const roundsEl = el('p', '', '剩余轮数' + h.rounds + '轮');
    hagglePanel.append(roundsEl);
    const btns = el('div', 'haggle-btns');
    for (const f of h.options) {
      const price = Math.max(1, Math.round(h.market * f));
      const label = h.kind === 'buy' ? '出' + price + '文' : '要' + price + '文';
      const b = el('button', 'haggle-btn', label);
      b.onclick = () => hooks.onHaggleOffer(f);
      btns.append(b);
    }
    hagglePanel.append(btns);
    const cancel = el('button', 'mini-btn', '不谈了');
    cancel.onclick = () => { hooks.onCancelHaggle(); hidePanels(); };
    hagglePanel.append(cancel);
    showPanel(hagglePanel);
  }

  function updateHaggle(h) {
    const bar = hagglePanel.querySelector('.patience-bar');
    if (bar) bar.style.width = Math.max(0, h.patience) + '%';
    const ps = hagglePanel.querySelectorAll('p');
    for (const p of ps) {
      if (p.textContent.indexOf('剩余轮数') === 0) p.textContent = '剩余轮数' + h.rounds + '轮';
    }
  }

  // ---- 库存面板 ----
  function showInventory() {
    invPanel.innerHTML = '';
    invPanel.append(el('h2', '', '我的库存'), closeBtn(hidePanels));
    if (eco.inventory.size === 0) {
      invPanel.append(el('p', '', '手里没货，去摊主那儿进点货吧'));
    } else {
      const table = el('div', 'goods-table');
      for (const g of CONFIG.economy.goods) {
        const inv = eco.inventory.get(g.id);
        if (!inv) continue;
        const row = el('div', 'goods-row');
        const avg = Math.round(inv.cost / inv.qty);
        row.append(el('span', '', g.name));
        row.append(el('span', '', inv.qty + '份'));
        row.append(el('span', '', '均价' + avg + '文'));
        row.append(el('span', '', '现价' + eco.priceOf(g.id) + '文'));
        table.append(row);
      }
      invPanel.append(table);
      invPanel.append(el('p', '', '库存现值' + eco.invValue() + '文，身家' + eco.netWorth() + '文'));
    }
    showPanel(invPanel);
  }

  // ---- 结算面板 ----
  function showSettlement(summary, isLast) {
    settlePanel.innerHTML = '';
    settlePanel.append(el('h2', '', '第' + summary.day + '天打烊'));
    settlePanel.append(el('p', '', '今日盈利' + summary.profit + '文'));
    settlePanel.append(el('p', '', '房租' + summary.rent + '文'));
    settlePanel.append(el('p', '', '盈利税' + summary.tax + '文'));
    settlePanel.append(el('p', '', '剩下' + summary.money + '文'));
    const b = el('button', 'big-btn', isLast ? '查看结果' : '进入第' + (summary.day + 1) + '天');
    b.onclick = () => hooks.onNextDay();
    settlePanel.append(b);
    showPanel(settlePanel);
    updateHUD();
  }

  // ---- 胜负屏 ----
  function showEnd(win) {
    endPanel.innerHTML = '';
    if (win) {
      endPanel.append(el('h2', '', '恭喜，你当上大掌柜了！'));
      endPanel.append(el('p', '', '7天内赚到' + eco.money + '文，汴京市井有你一席之地'));
    } else {
      endPanel.append(el('h2', '', '7天到了，没当上大掌柜'));
      endPanel.append(el('p', '', '手里只有' + eco.money + '文，离' + eco.goal + '文还差' + (eco.goal - eco.money) + '文'));
    }
    const b = el('button', 'big-btn', '再来一局');
    b.onclick = () => hooks.onRestart();
    endPanel.append(b);
    showPanel(endPanel);
  }

  // ---- 提示与报错 ----
  function setPrompt(text) {
    if (!text) {
      promptBox.style.display = 'none';
      return;
    }
    promptText.textContent = text;
    promptBox.style.display = 'flex';
  }

  function showLoadErrors(failed) {
    if (!failed.length) return;
    const names = failed.map((f) => f.name).join('、');
    errLine.textContent = '没加载出来的模型：' + names + '（不影响玩）';
    errLine.style.display = 'block';
  }

  return {
    updateHUD,
    showTrade,
    hidePanels,
    isAnyPanelOpen() {
      return allPanels.some((p) => p.style.display !== 'none');
    },
    showHaggle,
    updateHaggle,
    showSettlement,
    showEnd,
    toast,
    setPrompt,
    showLoadErrors,
  };
}
