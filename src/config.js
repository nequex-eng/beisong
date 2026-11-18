// 常量：默认值来自docs/DESIGN.md，启动时用assets/manifest.json的economy覆盖
export const CONFIG = {
  threeRevision: '160',
  // 低端模式默认开：像素比锁1，无实时阴影，30帧封顶
  lowEnd: true,
  pixelRatioLow: 1,
  pixelRatioHighCap: 2,
  frameIntervalMs: 1000 / 30,
  playerSpeed: 9,
  playerBounds: { minX: -58, maxX: 58, minZ: -34, maxZ: 34 },
  cameraOffset: { x: 0, y: 17, z: 15 },
  interactDistance: 4.5,
  cdnBase: 'https://qingming-assets.pages.dev',
  economy: {
    startMoney: 500,
    goalMoney: 5000,
    days: 7,
    actionPointsPerDay: 6,
    haggleRounds: 3,
    rentPerNight: 40,
    taxRate: 0.05,
    goods: [],
  },
};

// 用manifest的economy覆盖默认值（启动时调一次）
export function initFromManifest(manifest) {
  if (!manifest) return;
  if (manifest.cdn) CONFIG.cdnBase = manifest.cdn;
  const e = manifest.economy || {};
  const eco = CONFIG.economy;
  if (e.startMoney != null) eco.startMoney = e.startMoney;
  if (e.goalMoney != null) eco.goalMoney = e.goalMoney;
  if (e.days != null) eco.days = e.days;
  if (e.actionPointsPerDay != null) eco.actionPointsPerDay = e.actionPointsPerDay;
  if (e.haggleRounds != null) eco.haggleRounds = e.haggleRounds;
  if (e.rentPerNight != null) eco.rentPerNight = e.rentPerNight;
  if (e.taxRate != null) eco.taxRate = e.taxRate;
  if (Array.isArray(e.goods) && e.goods.length) eco.goods = e.goods;
}
