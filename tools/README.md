# tools —— StarRail-plugin 数据生成脚本

本目录存放静态数据维护工具，**不注册任何 bot 命令、不被 apps 加载器扫描**，仅由维护者在命令行手动运行。

## 文件说明

| 文件 | 说明 |
|------|------|
| `gen-data.js` | 数据生成脚本（零外部依赖，纯 Node ≥ 18，需可访问 GitHub） |
| `collab-pools.json` | 联动卡池（Fate/stay night 两期）补充条目，`gen-data.js --only=pooldata` 时并入 `utils/gatcha/poolData.js` |
| `test-damage.js` | 原有的伤害计算测试脚本（与本次更新无关） |

## 用法

```bash
cd Yunzai/plugins/StarRail-plugin

node tools/gen-data.js                    # 全量生成（默认 all）
node tools/gen-data.js --only=appdata     # 模拟抽卡 appdata 四个映射表
node tools/gen-data.js --only=pooldata    # 抽卡记录卡池时间线 poolData.js
node tools/gen-data.js --only=paneldata   # 面板 character.json + baseData 两表
node tools/gen-data.js --only=images      # 各类图片补缺（幂等，可反复运行）
```

- 生成脚本为幂等设计：JSON/JS 数据整体重写；图片只补缺、已存在即跳过。
- 图片下载串行执行，每次间隔约 300ms；网络错误/5xx 自动重试 3 次（1s/2s/4s 指数退避），404 视为永久失败不重试，结束后打印失败清单（存在失败时退出码为 1）。
- miao-plugin 默认按 `<本插件>/../miao-plugin` 查找，可用环境变量覆盖：`MIAO_ROOT=/path/to/miao-plugin node tools/gen-data.js`。
- 生成的数据文件与图片**不随 tools/ 一起提交**，运行后请 `git diff` 逐类审查，再按数据 commit 切分计划分别提交。

## 生成物对照

| 子命令 | 生成物 | 说明 |
|--------|--------|------|
| appdata | `resources/gachasimulation/resources/appdata/char2charid.json`<br>`chardamagetype.json`<br>`equipment.json`<br>`equipment2life.json` | 角色名→ID、ID→英文元素、光锥名→ID、光锥名→中文命途（值域随 miao 扩至 9 命途，含记忆/欢愉）。保留 `dev_测试用白板:9100`（chardamagetype 同步保留 `9100:Physical`）；旧文件中的 `dev_测试白板:29000` 不再生成（miao 无此条目，模拟池也不引用） |
| pooldata | `utils/gatcha/poolData.js` | miao `poolDetailSr` 全量常规池（按开池时间排序）+ `collab-pools.json` 联动池（固定置数组末尾：`getPool()` 取首个日期命中条目，联动池 to 为远期哨兵，若按时间插入会拦截其后所有常规记录的归组；消费联动记录需结合条目 `gachaType` 字段）。旧条目的 `ids` 字段（米游社 gacha_id）不再生成——消费端 `getPool()`/`stat()` 只按 `from/to` 日期区间匹配，从未读取该字段 |
| paneldata | `resources/panel/data/character.json`（合并）<br>`resources/baseData/characters.json`<br>`resources/baseData/light_cones.json` | panel 表旧条目原样保留、新条目按现有最新形状（`id/name/rarity/element/path` 最小字段）追加；baseData 两表直接采用 StarRailRes 索引（英文命途/元素枚举、数字星级） |
| images | `resources/gachasimulation/resources/images/char_image/{id}.png` ← `image/character_preview/{id}.png`（376x512 半身像）<br>`.../images/weapon/{id}.png` ← 索引 icon 字段（`icon/light_cone/{id}.png`）<br>`.../images/weaponlife/记忆.png`、`欢愉.png` ← 复制仓内 `BgPathsMemory.png`、`BgPathsJoy.png`<br>`resources/gatcha/images/char/{id}.png` ← `icon/character/{id}.png`（256x256，含开拓者 8001-8010）<br>`resources/panel/resources/char_image/{id}.png` ← `image/character_portrait/{id}.png`<br>`resources/panel/resources/weapon/{id}.png` ← 索引 icon 字段 | 各目录按现有素材规格选源：panel 立绘为 2048x2048（character_portrait 同规格）、panel 光锥 128x128（索引图标同规格）、gatcha 头像 256x256 方形（icon/character 同规格）、模拟抽卡立绘为半身像（character_preview 376x512，与既有素材同族） |
| —（不生成） | `resources/panel/data/skillTree.json` | 记忆/欢愉行迹坐标无数据来源，保持 7 命途不动 |

## 数据源

1. **miao-plugin 本地 meta-sr（只读，最全本地源）**
   - `resources/meta-sr/character/data.json`：108 角色（含 2xxx 强化形态，脚本会排除）；
   - `resources/meta-sr/weapon/data.json`：170 光锥；
   - `resources/meta-sr/info/index.js`：`poolNameSr`（跃迁名）+ `poolDetailSr`（1.0 起全量卡池时间线，含半日切点 06:00/11:59:59）。脚本按括号配对提取片段后求值，兼容 CRLF。
   - **本脚本只读 miao-plugin，绝不写入。**
2. **StarRailRes（在线，`Mar-7th/StarRailRes` master 分支）**
   - 索引：`index_new/cn/characters.json`、`index_new/cn/light_cones.json`（英文命途/元素枚举、数字星级、图标路径）；
   - 图片：`icon/character/{id}.png`（256x256 头像）、`image/character_preview/{id}.png`（376x512 半身像）、`image/character_portrait/{id}.png`（2048x2048 立绘）、光锥以索引 `icon` 字段为准（`icon/light_cone/{id}.png`，注意**没有** `light_cones` 复数目录）。
3. **BWiki SMW（可选人工校验源，不在脚本内调用）**
   - `https://wiki.biligame.com/sr/api.php?action=ask&...` 可结构化查询卡池/角色数据，用于人工抽查生成结果；
   - 注意 EdgeOne 安全防护会拦截高频抓取：如需批量校验务必串行并加间隔，HTML 页面路由已被拦截，仅 API 可用。

## 新版本发布后的更新流程

1. 等 miao-plugin 更新到新版本（meta-sr 数据先行）；若新版本有**新联动池**，先在 `tools/collab-pools.json` 补条目（`gachaType` 21=角色联动 / 22=光锥联动，长期池 `to` 用哨兵 `2036-01-01 00:00:00`）。
2. 运行 `node tools/gen-data.js`，检查摘要与失败清单。
3. 若脚本报「无法确定跃迁名」，说明 miao `poolNameSr` 缺新角色条目：在 `gen-data.js` 的 `POOL_NAME_OVERRIDES` 补录（查官方卡池公告/BWiki）。若报「无法在 miao 基础表匹配」，说明 miao `poolDetailSr` 与其角色/光锥表名称不一致：在 `POOL_ITEM_NAME_FIXES` 补修正（已知一例：4.3下半 weapon4「点个关注吧」实为「点个关注吧！」）。
4. `git diff` 逐类审查生成物（appdata / poolData / panel + baseData / 图片），按 commit 切分计划分别提交数据。
5. 检查 `utils/gachasimulation.js` 的 `gachaPool`（当期 UP、四星/三星池清单）与 `apps/gachasimulation.js` 的池类型逻辑是否需要配套更新——这些是代码改动，不在本脚本范围内。
6. 抽查渲染：`*十连`/`*十连光锥` 出图、`*抽卡记录统计` 分组、`#角色面板` 显示是否正常。

## 占位与已知取舍（审查时请留意）

- **poolData `poolName`**：取当期**首位**五星角色的跃迁名（与文件旧有条目口径一致）；集合池（铭心之萃/真意之汇）会显示首位角色的跃迁名而非集合池名。`丹恒•腾荒`（3.6 下半）miao `poolNameSr` 缺录，人工补录为「纵然山河万程」。
- **poolData 未收录时段**：联动池 `to` 为远期哨兵，新版本上线后、poolData 更新前，落在这段空档的常规记录会被 `getPool()` 归到「ver3.4collab」分组（旧数据下为 `false`/undefined 分组，同样不正确）。属暂时性表现，更新 poolData 后即消失。
- **联动光锥池 `poolName`**：官方未公布/未核实到光锥联动跃迁的诗意名，`collab-pools.json` 使用描述性名称（「光锥联动跃迁·Fate/stay night（一/二期）」），核实后直接改该文件再跑 `--only=pooldata` 即可。
- **联动池四星 UP**：官方未公布，`char4`/`weapon4` 留空数组；模拟抽卡侧如需四星请用全量四星池兜底。
- **panel character.json 新条目**：`apps/panel.js` 仅消费 `.path` 字段（第 134 行 `charData[data.avatarId].path`），故新条目采用最小字段形状（`id/name/rarity/element/path`），与文件中较新的既有条目一致，**不含 eidolons/skills 占位结构**。若后续面板功能需要星魂/技能数据，应另行接 miao `meta-sr/character/{name}/data.json`。
- **baseData 两表**：直接采用 StarRailRes 索引，条目不含旧文件中的 `guide_*` 字段（上游索引已移除该系列字段，代码未消费）。注意 `utils/gatcha/index.js` 的 `getItemTotalNum` 目前只剔除开拓者 8001-8004，而新数据含 8005-8010，持有率分母需在代码侧同步修正（属后续代码 commit 范围）。
- **模拟抽卡角色立绘源**：已采用 `image/character_preview`（376x512 半身像，与目录既有半身像素材同族）；模板 `.char-img` 为 `object-fit: cover` 裁切显示。
- **weaponlife 记忆/欢愉**：复用仓库内已有 `BgPathsMemory.png`/`BgPathsJoy.png` 改名。经核对与现有 7 张中文命途图同为 612x612 RGBA 白色剪影素材（透明度轮廓一致），风格一致；`BgPathsExplore.png` 未接线，保持不动。
- **skillTree.json 不动**：记忆/欢愉行迹坐标无可靠数据来源，面板对这两命途角色的行迹渲染需另行处理（见调研文档 §9.3.3）。
