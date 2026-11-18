# 北宋汴京市井

北宋汴京市井经营游戏：500文起步当货郎，7天赚到5000文当大掌柜。Three.js单页WebGL游戏，部署在Cloudflare Pages。

## 玩法

- 每天6行动点：走动、进货、卖货、砍价都耗点
- 砍价3轮带耐心条，声望越高价格越好
- 夜里结算房租和盈利税，第二天行市刷新
- 三幕：虹桥汴河（可玩）、御街商铺（待拓展）、瓦舍市集（待拓展）

## 目录

- `index.html`：入口
- `src/`：游戏代码（模块化，见`docs/DESIGN.md`）
- `vendor/`：本地Three.js（不走CDN，保证离线可用）
- `assets/manifest.json`：资产登记表，游戏启动时读它
- `docs/`：设计文档、资产说明

## 拓展方式（留给后续批次）

1. 新GLB先传到CDN（`https://qingming-assets.pages.dev/`，见`docs/ASSETS.md`）
2. 在`assets/manifest.json`里加一条记录（id、url、场景、位置）
3. 场景和玩法不用改代码，启动时自动读表拼场景

新场景：往`manifest.json`的`scenes`里加一个，状态先标`planned`，场景代码按`src/scene-river.js`的模式复制一份。

## 本地运行

```bash
python3 -m http.server 8000
# 打开 http://localhost:8000/
```

## 线上地址

https://beisong-8hk.pages.dev/（beisong.pages.dev已被别的账号占了，建出来带了随机后缀）
