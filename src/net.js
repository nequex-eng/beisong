// 联网接口：第一版只用本地种子行市；以后接Cloudflare KV时在这里换实现，
// 玩法代码只调getDailyPrices，不用管行市从哪来。
import { CONFIG } from './config.js';

// 确定性随机：同一天、同一货，行市固定（以后全服行市也是这个思路：一天一个种子）
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// 本地种子行市：每种货在基准价0.7到1.3倍之间浮动
export function localDailyPrices(day) {
  const prices = {};
  for (const g of CONFIG.economy.goods) {
    const rand = mulberry32((day * 2654435761) ^ hashStr(g.id) ^ 0x9e3779b9);
    const factor = 0.7 + rand() * 0.6;
    prices[g.id] = Math.max(1, Math.round(g.base * factor));
  }
  return prices;
}

// 取当天行市：先试在线（KV），失败回落本地种子
export async function getDailyPrices(day) {
  try {
    const online = await fetchOnlinePrices(day);
    if (online) return online;
  } catch (err) {
    // 在线行市拿不到就用本地的，单机照玩
  }
  return localDailyPrices(day);
}

// TODO：接KV后在这里实现（GET当天行市，拿不到返回null）
async function fetchOnlinePrices(_day) {
  return null;
}

// TODO：接KV后实现（提交成绩到排行榜）
export async function submitScore(_score) {
  return false;
}

// TODO：接KV后实现（取排行榜）
export async function getLeaderboard() {
  return [];
}
