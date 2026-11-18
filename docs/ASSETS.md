# 资产说明

## 资产从哪来

GLB文件不在仓库里（GitHub连接器推不了二进制文件），存在Cloudflare Pages直链站上：

- CDN：`https://qingming-assets.pages.dev/`
- 带`Access-Control-Allow-Origin: *`，游戏可跨域直接加载
- 备用：GitHub Release https://github.com/nequex-eng/qingming/releases/tag/batch1（zip包，下载后解压）

## 已有资产（第一批，6个）

| id | 名称 | 大小 | 备注 |
| --- | --- | --- | --- |
| timber-arch-bridge | 虹桥 | 17.3MB | |
| stone-arch-bridge | 石拱桥 | 20.3MB | |
| riverside-commercial-building | 江边大商楼 | 24.8MB | |
| restaurant-wine-house | 酒楼 | 26.5MB | gzip后20.9MB，`encoding:"gzip"` |
| teahouse | 茶馆 | 26.0MB | |
| wharf-dock | 码头 | 20.3MB | |

## 加新资产的步骤

1. 新GLB传到CDN（工程`~/workspace/qingming-cdn/`，`wrangler pages deploy`，项目名`qingming-assets`）
2. 单文件超过25MB的先gzip（酒楼就是这么处理的），`encoding`标`gzip`
3. 在`assets/manifest.json`里加一条记录：id、名称、分类、url、大小、场景、位置、旋转、缩放
4. 场景代码不用改，启动时自动读表

## 资产规范（生成时已定）

- GLB独立文件，Y上，地面Y=0，PBR
- 写实风格，南宋临安木构加曲面瓦顶加斗拱加铺面加木格窗
- 旧木灰瓦风化石竹麻陶铁绳，忌现代物、塑料感、幻想装饰、日韩元素
