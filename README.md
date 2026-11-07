# CS 饰品馆

Counter-Strike 2 皮肤图鉴：按武器、武器箱、稀有度和颜色查找全部武器、刀具与手套皮肤。

## 功能

- **按武器进入**：首页按匕首、手套、步枪、手枪等分类，每种武器配一张代表皮肤图
- **整站是一本书**：封面 → 目录 → 章节扉页 → 图版索引 → 单品档案，前进向前翻页、返回向后翻页
- **武器箱视图**：按稀有度分层展示箱子内容和稀有特殊物品
- **详情页**：大图、多普勒等同款不同版本、可出外观与磨损区间、所属收藏品与武器箱、Steam 市场与 BUFF 链接
- 搜索支持中文和英文名

## 部署

推送到 `main` 后，GitHub Actions 会拉取最新数据、计算皮肤主色并发布到 GitHub Pages，每周一自动刷新一次。

首次使用需在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。

## 本地预览

```bash
python scripts/build_data.py          # 加 --colors 会下载缩略图计算颜色（需 pip install pillow）
python -m http.server 8000
```

## 数据与版权

数据来自 [ByMykel/CSGO-API](https://github.com/ByMykel/CSGO-API)（MIT），图片由 Steam CDN 提供。本项目与 Valve 无关，Counter-Strike 及相关素材版权归 Valve Corporation 所有。
