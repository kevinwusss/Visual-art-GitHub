# Visual arts — AI 个人造型系统

一个编辑风格的私人造型工作台：把你的真实衣橱、风格偏好、天气与场合，变成可执行的穿搭建议。
**界面以中文为主**（导航、文案、评分、筛选、示例数据均为中文），右上角「中 / EN」可一键切换英文，
切换结果会保存到本机；页面 `lang` 属性也会同步更新。

## 快速开始

### 方式一：一键脚本（Windows 双击即用）

| 文件 | 作用 |
| --- | --- |
| `启动.cmd` | 启动服务：自动检查 Node/依赖、清理旧进程、后台运行、打开浏览器 |
| `重启.cmd` | 先停止再启动（改完代码、端口卡住时用这个） |
| `停止.cmd` | 停止服务并释放端口 |

脚本不会弹出常驻窗口：服务在后台运行，启动完成后提示 `http://localhost:3000`，
需要看日志时打开 `.logs\dev.log`，或执行 `powershell -File scripts\dev.ps1 logs`。

可选参数（终端里用，例如 `重启.cmd -Prod`）：

| 参数 | 说明 |
| --- | --- |
| `-Port 3001` | 换端口（默认 3000） |
| `-Prod` | 生产模式：先 `npm run build` 再 `npm run start` |
| `-Force` | 端口被其它程序占用时强制结束它再启动 |
| `-NoBrowser` | 启动后不自动打开浏览器 |

终端等价命令：

```powershell
npm run app:start      # 启动
npm run app:restart    # 重启
npm run app:stop       # 停止
npm run app:status     # 查看状态（端口、PID、HTTP）
```

### 方式二：npm 命令

```powershell
npm install        # 首次运行
npm run dev        # 启动开发服务器
```

打开 http://localhost:3000 。进程需要保持运行；关闭终端即停止服务。

生产构建：

```powershell
npm run build
npm run start
```

## 功能地图

| 页面 | 路径 | 数据来源 |
| --- | --- | --- |
| 首页 | `/` | 报头 + 黑白秀场主图、巴黎时装周（25%+ 篇幅）、时尚新闻（34%+ 篇幅）、品牌墙、天气与衣橱概览 |
| 造型顾问 | `/stylist` | 有 `DEEPSEEK_API_KEY` → 实时 AI；没有 → 基于你衣橱的本地搭配引擎 |
| 数字衣橱 | `/wardrobe` | 本机浏览器存储；可添加/删除单品、查看衣橱洞察 |
| 发现 | `/discover` | 顶部「按你的衣橱推荐」（本地计算 + 真实在售商品库）；有 `BOCHA_API_KEY` → 实时搜索；没有 → 精选示例商品 |
| 风格 DNA | `/style-dna` | 由衣橱实际数据计算，并调用 `/api/wardrobe/analyze` |
| 穿搭记录 | `/looks` | 生成的穿搭、收藏、穿着记录 |
| 风格测试 | `/onboarding/style-quiz` | 5 题问答 → `/api/style-profile` 生成风格档案 |
| 个人资料 | `/profile` | 身高/体重/预算/城市/风格与颜色偏好 + 服务状态 |

系统对每条 AI、搜索与天气结果都会标注来源模式：`live`（实时）、`local`（本地计算）、
`curated`（精选示例）、`fallback`（实时不可用，已降级）。不会把示例数据伪装成实时结果。

## 本次完善（相对上一版）

- **天气**：由写死的 Tokyo 快照改为 Open-Meteo 实时天气（免密钥），支持按城市查询、进程内缓存、
  失败自动降级并在首页/造型页标注来源；未知城市会明确显示为「天气快照」而不是伪装成实时。
- **造型顾问**：新增本地搭配引擎（`lib/stylist-local.ts`）。没有 `DEEPSEEK_API_KEY` 时，系统会基于
  你的真实衣橱 + 天气 + 场合关键词生成搭配（含评分、缺口、替代方案），不再返回固定的示例穿搭；
  支持 `/stylist?item=<id>` 从某件单品开始搭配，结果会展示所用单品与可替换方案。
- **数字衣橱**：「添加单品」由假按钮改为真实表单（名称/品牌/类别/颜色/价格/图片/标签，含校验）；
  新增衣橱洞察面板（颜色占比、类别构成、缺口、建议）与单品换图功能。
- **穿搭记录**：`/looks` 由占位页改为真实页面——全部/已收藏筛选、单品缩略、评分、移除、
  「再搭一次」、穿着记录（今天穿了 / 很喜欢 / 不太合适 / 清空）。
- **风格测试**：`/onboarding/style-quiz` 由占位页改为 5 题真实测评，规则推导 + 可选 AI 增强，
  结果写入风格档案并同步到 DNA 与造型顾问。
- **风格 DNA**：百分比不再写死，改为由衣橱标签/颜色/类别实时计算，并接入衣橱洞察与标志单品。
- **个人资料**：新增城市（用于天气）、偏好风格与颜色多选、品牌编辑、最近更新时间、
  服务状态面板（是否已配置密钥）与「恢复示例数据」。
- **导航**：移动端菜单按钮从装饰变为可用面板（含 Escape 关闭、滚动锁定）；首次访问按浏览器语言
  自动选择中/英；标题栏加入服务模式指示点。
- **工程**：页面由单文件拆分为 `components/views/*`；新增 `/api/capabilities`；补充 README、
  `.env.example`（含天气变量）与应用图标；远程图片加载失败时自动回退到占位图。

### 图片相关（本轮新增）

- **买手店优先的搜索出图**：每张卡片与图集都来自买手店／高端零售（发发奇 Farfetch、Revolve、
  FWRD、寺库等）与时尚媒体；批发站（1688/17网）、素材站（千库/花瓣）与导购聚合站
  （什么值得买/海淘返利站）在来源分级里被直接过滤，不会出现在图片中。
- **购买渠道一键直达**：搜索后可一键在得物、发发奇 Farfetch、SSENSE、连卡佛、Mytheresa、
  NET-A-PORTER 打开同款搜索（得物为前端渲染站点，图片索引取不到商品图，因此做成渠道入口）。
- **编辑精选兜底**：当某个词在买手店图库里出图不足时，用项目自带的时装图补齐，并明确标注
  「编辑精选」，不冒充搜索结果。
- **图片代理**：第三方图床常有防盗链、http 混合内容与 ORB 拦截，统一经 `/api/image` 服务端取回
  （校验协议/端口/公网地址、限制 8MB、缓存一天）；服务端还会并发探测图片可达性，只展示真的能打开的图。
- **更多图片**：首页新增「衣橱一览」、造型顾问新增「可用的单品」图片带（生成后展示整套所用单品）、
  风格 DNA 单品墙扩到 6 件、风格测试与个人资料页新增衣橱预览、穿搭记录展示每套所用单品缩略图。

## 环境变量（全部可选）

复制 `.env.example` 为 `.env.local` 后按需填写。没有 key 时系统依然完整可用：

| 变量 | 作用 | 未配置时的行为 |
| --- | --- | --- |
| `DEEPSEEK_API_KEY` | 实时 AI 搭配、衣橱分析、风格档案 | 使用本地搭配引擎（`mode: local`） |
| `BOCHA_API_KEY` | 发现页实时商品搜索 | 返回精选示例商品 |
| `DEEPSEEK_MODEL` | 模型名，默认 `deepseek-chat` | 默认值 |
| `DEEPSEEK_FALLBACK_MODEL` | 备用模型：主模型超时/报错/正文为空时自动顶上，留空表示不启用 | `deepseek-chat` |
| `DEEPSEEK_MAX_TOKENS` | 单次输出上限，默认 6000（上限 8192） | 默认值 |
| `DEEPSEEK_TIMEOUT_MS` | 单次请求超时，默认 45000 | 默认值 |
| `WEATHER_CITY` | 默认城市 | `Shanghai` |
| `WEATHER_DISABLED` | 设为 `true` 强制使用天气快照 | 正常调用 Open-Meteo |

天气使用 Open-Meteo，无需申请密钥；接口失败时自动回落到快照并标注。

> **修改 `.env.local` 后必须重启服务**（双击「重启.cmd」或 `npm run app:restart`），
> 否则运行中的进程仍在使用旧配置。
>
> 如果用的是推理模型（如 `deepseek-flash`），它会先把 token 花在思考过程上：
> 预算太小会返回空正文。服务会先在同一模型上把预算加倍重试一次，仍失败则自动换
> `DEEPSEEK_FALLBACK_MODEL`（默认 `deepseek-chat`）再来一次，两者都不行才降级为本地计算并写明原因。
> 可自行调大 `DEEPSEEK_MAX_TOKENS`。个人资料页的「测试连接」按钮可以直接看到每个服务的真实状态和失败原因。

## 数据存储

衣橱、穿搭、收藏、风格档案与穿着记录保存在浏览器 `localStorage`
（键名 `visual-arts-state`，带版本迁移）。换浏览器或清空站点数据会重置；
个人资料页提供「恢复示例数据」按钮。

## 目录结构

```
app/                     页面路由与 API Route Handlers
  page.tsx               首页
  [...slug]/page.tsx     其余页面路由分发
  api/stylist            搭配生成
  api/wardrobe/analyze   衣橱分析
  api/style-profile      风格档案
  api/discover/search    商品搜索
  api/weather            天气
  api/capabilities       服务状态（是否已配置密钥）
components/
  layout.tsx             导航与页面骨架
  ui.tsx                 Img / ModeNote 等共享组件
  views/*.tsx            各页面实现
lib/
  store.ts               zustand 持久化状态
  stylist-local.ts       本地搭配引擎
  insights.ts            衣橱统计与风格 DNA 计算
  style-quiz.ts          测试题目与档案推导
  i18n.ts                中英文案
services/                AI / 搜索 / 天气 provider
types/index.ts           共享类型
```

## 自检命令

### 买手店商品库（Scrapling 抓取）

发现页与品牌墙的"在售单品"来自本地商品库 `data/catalog.json`（当前约 1.6 万件连卡佛 / 买手店在售商品，
含品牌 / 商品名 / 真实标价 / 商品图 / 商品链接）。数据由 Scrapling 抓取生成：

```powershell
# 首次：创建独立 venv 并安装
py -m venv .scrape-venv
.\.scrape-venv\Scripts\python.exe -m pip install "scrapling[fetchers]>=0.4.15"

# 刷新商品库（约 5 分钟，自动发现子分类 + 分页，默认每请求间隔 1.2 秒）
.\.scrape-venv\Scripts\python.exe scripts\scrape_catalog.py --pages 2
```

抓取遵守站点 robots/ToS：只访问公开商品列表页、控制频率、不使用代理或绕过登录。
`.scrape-venv/` 已加入 `.gitignore` 与 eslint/tsconfig 忽略列表。

### 抓取脚本一览

| 脚本 | 抓什么 | 产出 |
| --- | --- | --- |
| `scripts/scrape_catalog.py` | 连卡佛分类页（自动发现子分类 + 分页） | `data/catalog.json`（品牌/名称/价格/图/商品链接） |
| `scripts/scrape_brands.py` | 连卡佛品牌页（按品牌清单逐个抓） | 追加进 `data/catalog.json` |
| `scripts/scrape_editorial.py` | HYPEBEAST 中文 / NOWRE / VOGUE FR / ELLE Runway 文章列表 | `data/editorial.json`（标题+主图+文章链接，图片已校验可达） |
| `scripts/scrape_shopify_brands.py` | Shopify 品牌官网 `/products.json` | 追加进 `data/catalog.json`（目前仅 Fear of God 可用） |
| `scripts/scrape_shopify_stores.py` | Shopify 买手店公开商品接口（Antonioli / Kith / The Webster / Notre / Bodega / Feature / Xhibition / Kirna Zabete / Biffi / Voo Berlin / Peggs & Son 等） | 追加进 `data/catalog.json` |
| `scripts/normalize_catalog.py` | 多币种价格归一化（€/£/$ → 人民币参考价 `priceCny`，固定近似汇率） | 更新 `data/catalog.json` |

实测能抓到：连卡佛（服务端渲染，1,700+ 商品）、NOWRE / ELLE / VOGUE FR（媒体文章）。
实测抓不到（已确认，不做无用功）：SSENSE（返回 0 字节）、Mytheresa（机器人墙）、LV / Hermès /
Zegna / Arc'teryx / The North Face（403）、Farfetch / 得物（前端渲染，需 `extract fetch` 浏览器模式）。

**内容一致性原则**：首页"秀场/杂志"只展示媒体文章三元组（标题-主图-链接同源）；
品牌墙只用商品库中该品牌的真实商品图，没有商品就不放图（改字标磁贴 + 渠道入口），
避免再出现"图与品牌不沾边"的情况。

### 首页排版（报头 + 秀场 + 新闻为主体）

主页的篇幅分配是有意设计的，改版后用几何测量核对过（1512×900，见下表）：

| 区块 | 高度 | 占页比 | 说明 |
|---|---|---|---|
| 报头（站名 + 黑白秀场主图） | 768px | 14.6% | 页面第一张图就是**黑白秀场照**，H1 是站名 `Visual art` |
| 巴黎时装周 RUNWAY | 1345px | 25.5% | 一张大图 + 4 张竖构图 + 8 张横滑导轨 |
| 时尚新闻 THE EDIT | 1822px | 34.6% | 封面故事 + 4 张看点 + 8 条带缩略图的新闻清单 |
| 品牌墙 | 796px | 15.1% | 默认两行 16 个磁贴，其余点「展开全部品牌」 |
| 天气 / 今日造型 / 衣橱 | 171px + 483px | — | 工具带，排在编辑内容之后 |

秀场 + 新闻合计约 **60%** 的页高（改版前这两块只有 36%，而品牌墙独占 37.5%）。

**秀场图为什么能放大**：ELLE（Hearst）图库的缩略图只有 360–480px 宽，直接拉大会糊。
实测同源 CDN 支持 `resize=<宽>:*` 参数——同一张图 `resize=480` 是 22KB，
`resize=1920` 是 195KB 且返回真实 1920×2880。于是 `lib/editorial.ts` 为每张编辑图
额外给一个 `large`（1080px，走本站 `/api/image` 代理），首屏主图在 `lib/runway-hero.ts`
里用 1920px 版本。每一张都实测过 HTTP 200 + 真实像素尺寸，没有实测到的不写进代码。
首页主图三张候选中当前使用 KHAITE 2027 春季秀场照，可随时换 `RUNWAY_HEROES[0]`。

**排版修复记录**：秀场横滑导轨原先用 `-mx-10` 负边距做通栏，把区块撑出 40px 横向溢出；
现在改为容器内滚动 + `html{overflow-x:clip}` 兜底。品牌墙从 37 个磁贴（4–5 行、2533px）
改为默认 16 个（两行、796px）。新闻清单从 2 条无图纯文字改为 8 条带缩略图。

### 发现页「按你的衣橱推荐 / FROM YOUR WARDROBE」

发现页顶部的推荐板块把**衣橱缺口**和**真实在售商品库**接在一起，全部本地计算，不调用外部 AI：

- 接口：`POST /api/catalog/recommend`，请求体 `{language, wardrobe, profile?, limit?, seed?, excludeIds?}`；
  引擎在 `lib/wardrobe-fill.ts`（纯函数，`recommendForWardrobe`），UI 在 `components/wardrobe-picks.tsx`。
- 先找缺口：完全缺失的类别（0 件）> 比例失衡（某类只有 1 件，而其它类别 ≥3 件）> 色板缺一档
  （只有深色、缺浅中性色）> 天气（≤12°C 无保暖外套 / ≥26°C 无透气上装）> 风格没走完
  （偏机能却无壳衣、有通勤需求却无正装鞋）；同一类别只保留权重最高的一条，最多 3 组。
- 再挑商品：只用商品库里同类别的真实商品，按「颜色族匹配 + 关键词命中 + 品牌 + 预算」打分，
  色值/品类/价位都能在界面上核对；每个类别有价位下限（外套 ≥¥400、下装 ≥¥300、上装 ≥¥150、鞋 ≥¥500），
  低于下限的不推荐。墨镜等非服装商品会被直接排除，不会混进"补一件上装"里。
- 每条推荐都带理由：要么写清「与你衣橱的《某件单品》同属某色系」，要么写清"补的是确实没有的类别"；
  衣橱为空时给基础层建议（第一件外套 / 打底上装 / 一双鞋），不假装懂风格。
- 价位再按**同品类的价位分布**打分（不是只看用户预算）：优先该品类的入门档，高于中位数 4 倍以上的
  直接不推，避免出现"给预算 ¥8,000 的人推 ¥14,400 运动裤"这类结果。
- 商品名认不出服装品类的一律不推（例如只有型号名的 "Szade HART" 其实是太阳镜）；童装线（Kith Baby 等）
  与已知眼镜品牌同样排除；衣服自带分类不可靠时以名称里的强词为准（"Suede Clogs" 归鞋履而不是下装）。
- 卡片上的「加入衣橱」会把真实商品信息（品牌/名称/分类/商品图/人民币参考价/原页链接）写进衣橱，
  写完后推荐立刻按新衣橱重算，并给出「已加入衣橱：…」的回执，不会让人以为点了没反应。
- 新用户的内置示例衣橱会被明确标注（"当前衣橱还是内置示例单品…"），换成自己的单品后提示自动消失。
- 「换一批」用 `seed` + `excludeIds` 滚动换新商品（同一批结果可复现，不用随机数）；
  推荐过的商品会写进 `recommendationLog`（`发现页推荐 · <组标题>`），便于后续做"别再推同一件"。

实测（示例衣橱 5 件：西装外套 / 针织衫 / 阔腿裤 / 跑鞋 / 腕表）：
3 组推荐、12 件商品、接口耗时约 0.1–0.3s、跨组无重复商品，13 张商品图中 12 张可加载（1 张 CDN 超时走占位图）。

### 平价替版（按衣橱反推）

发现页底部「平价替版 / AFFORDABLE」不再用通用版型清单，而是**从你衣橱里的真实单品反推**：

- 关键词：从单品名称、标签与版型偏好里提取「版型 + 材质 + 颜色 + 品类」（如"宽松 羊毛 炭灰色 外套"）；
  鞋履与配饰不带服装版型词，改用"百搭"；
- 价位：按该单品原价折算三档（约 10–25% / 25–45% / 45–70%），未填价格时按品类给默认档；
- 出口：每档提供淘宝/京东站内搜索直达（含价格区间）。

为什么是"搜索直达"而不是商品列表：淘宝、天猫、京东的搜索页对爬虫只返回 7–22KB 空壳
（无价格、无商品链接），因此这里不伪造商品数据，只做一步跳转。

### 得物数据：实测结论与合规做法

三种方式都试过（Scrapling 纯 HTTP / 动态浏览器捕获 XHR / 反检测浏览器）：

| 探测项 | 结果 |
| --- | --- |
| 商品接口 `app.dewu.com/api/v1/h5/commodity-pick-interfaces/.../feeds/info` | **485「请校验验证码」** |
| 风控链路 | `dav.dewu.com/interceptor` + `risk-stone-captcha` + 阿里云设备指纹 |
| 商品详情页 | 200 但 45KB 空壳，无 og:image / og:title / 结构化数据 |
| 官方开放平台 | `open.dewu.com`（得物开放平台）、`open.poizon.com` 存在，需注册开发者/企业资质申请应用 |

结论：**得物数据只能走官方开放平台 API 对接**；绕过验证码属于破解访问控制，本项目不做。
在没有官方凭证前，发现页提供「我录入的单品」面板：手动粘贴得物商品链接 / 图片 / 价格 / 分类，
存进本机商品库（`manualProducts`，随 store 持久化），与买手店商品一起展示。

拿到 `appKey` / `appSecret` + 接口文档后，可按 `services/` 现有 provider 模式接入：
签名、超时、缓存、降级、`/api/capabilities` 与「测试连接」面板、发现页多源合并。

### 品牌墙的图片来源（三级回退）

`/api/brand-logos?ids=...` 为"商品库里没有该品牌商品"的品牌解析一张可用图片：

1. **品牌官网图标**：依次尝试 `apple-touch-icon(.png)`、`apple-touch-icon-precomposed`、
   `apple-touch-icon-180x180`、`favicon.png`、`favicon.ico`（跟随跳转；校验 `content-type` 为图片
   且体积 ≥ 300B，过滤空白占位图），命中后经 `/api/image` 代理返回；
2. **相关媒体文章图**：在我们抓取的媒体文章里找"标题明确包含该品牌"的一篇，用它的主图（词边界匹配，避免误配）；
3. **字标磁贴**：以上都没有时，才显示品牌首字母 + 品牌名 + 渠道入口（不配无关图片）。

品牌清单见 `lib/brands.ts`（当前 83 个品牌，分设计师／静奢／街头／机能四组），可随时增删。

### 衣橱编辑与推荐去重

**衣橱单品可完整编辑**：单品卡片左上角铅笔按钮打开编辑面板，可改名称／品牌／类别／颜色／价格／标签，
照片支持**本机上传（自动压缩到 1600px、存 `data/uploads/`）**、粘贴链接、删除、点星设为封面；
保存后同步 `images` 与封面 `image`。

**推荐会记时间**（`lib/recommendation.ts` + `recommendationLog`）：

- 每次生成搭配都会记录 `prompt / 关键词 / 用到的单品 / 时间`；
- 生成前用关键词求交集判断"是不是同一个词"（中文 2 字滑窗 + 英文单词，去停用词），
  命中则把近 **2 天**用过的单品作为 `avoidItemIds` 交给引擎与 AI；
- 同时按"最近使用时间"做**软性轮换**：越久没穿过的单品得分越高（1 天内 −18、2 天内 −10、
  4 天内 −3、7 天内 +4、14 天内 +8、更久 +12），衣橱越大变化越自然；
- 若衣橱太小导致回避后搭配残缺（不足 3 件），接口层会**放弃回避重试一次**，并在界面上如实说明
  "衣橱可选单品不足，本次有 N 件重复"，提示补充单品；
- 造型页底部展示「最近 7 天推荐」记录（搭配名 / 关键词 / 时间 / 件数）。

```powershell
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run build       # 生产构建
```

接口冒烟测试（需要服务在运行）：

```powershell
Invoke-RestMethod "http://localhost:3000/api/weather?city=Shanghai&lang=zh"
Invoke-RestMethod "http://localhost:3000/api/capabilities"
Invoke-RestMethod "http://localhost:3000/api/wardrobe/analyze" -Method Post -ContentType "application/json" -Body '{"wardrobe":[],"language":"zh"}'
Invoke-RestMethod "http://localhost:3000/api/stylist" -Method Post -ContentType "application/json" -Body '{"prompt":"周末看展","wardrobe":[],"language":"zh"}'
```

## 已知边界

- 实时调用失败时界面会明确标注「本地计算 / 精选示例 / 已降级」，并在造型页、发现页直接给出失败原因；
  个人资料页的「测试连接」会返回每个服务的实时结果与耗时。
- 商品图为示例或来源图，缺少图片时会显示占位图与来源提示，购买前请以原页面为准。
- 天气数据来自 Open-Meteo，同名城市以该服务的首个匹配结果为准。

## 2026-09-15 界面与稳定性优化

- 首页：本地 WebP 双幅秀场封面、响应式图源、Cormorant 字体、精简的栏目标题与全站页脚。
- 动画：移除大面积模糊、缩短错峰等待、普通揭示元素不再创建 Framer Motion 实例、提前触发滚动入场。
- 可访问性：导航当前页语义、移动菜单焦点约束与返回、加大触摸区域、重要操作状态播报。
- 稳定性：图集请求取消与超时、品牌切换防止旧响应覆盖、修复无效的品牌刷新按钮。
- 工程：裁剪/编辑弹层按需加载、修正子页面 canonical、图片代理逐跳重定向检查、流式大小限制与私网地址测试。
- `npm test` 运行图片地址边界测试（Node 22.18+ / 24）。其余验证：`npm run lint`、`npm run typecheck`、`npm run build`。

视觉规范见 `DESIGN.md`，图片来源见 `public/images/editorial/SOURCES.md`，字体授权见 `public/fonts/OFL.txt`。
