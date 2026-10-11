#!/usr/bin/env node
/**
 * StarRail-plugin 静态数据生成脚本
 *
 * 将插件内停滞的静态数据（模拟抽卡映射表 / 卡池时间线 / 面板与抽卡分析基础数据 / 图片资源）
 * 从数据源重新生成到最新版本。
 *
 * 数据源：
 *   1. miao-plugin 本地 meta-sr 数据（只读，本脚本不修改 miao-plugin 任何文件）
 *      - resources/meta-sr/character/data.json   角色基础数据（name/star/elem中文/weapon中文命途）
 *      - resources/meta-sr/weapon/data.json      光锥基础数据（name/type中文命途/star）
 *      - resources/meta-sr/info/index.js         poolNameSr（跃迁名）/ poolDetailSr（1.0→当前 全量卡池时间线）
 *   2. StarRailRes 在线仓库（https://github.com/Mar-7th/StarRailRes）
 *      - index_new/cn/characters.json / light_cones.json  索引（英文命途/元素枚举、星级、图标路径）
 *      - index_new/cn/relics.json                        遗器索引（id/set_id/name/rarity/type/icon）
 *      - icon/character/{id}.png                  角色头像（256x256，方形，抽卡分析头像用）
 *      - image/character_preview/{id}.png         角色半身像（376x512，模拟抽卡立绘用）
 *      - image/character_portrait/{id}.png        角色立绘（2048x2048，面板立绘用）
 *      - image/light_cone_preview/{id}.png        光锥竖版卡面（348x408，模拟抽卡卡面用）
 *      - icon/light_cone/{id}.png                光锥图标（128x128，面板图标用，实际路径以索引 icon 字段为准）
 *      - icon/relic/{set}_{n}.png                遗器图标（128x128，面板遗器列表用）
 *      - icon/skill/{id}_{slot}.png              技能/行迹图标（128x128，面板技能区与行迹画布用）
 *   3. tools/collab-pools.json                   联动卡池补充条目（miao 不收录联动池）
 *   4. （可选校验源）BWiki SMW API api.php?action=ask —— 仅人工抽查时使用，
 *      注意 EdgeOne 安全防护会拦截高频抓取，需串行且加间隔。
 *
 * 用法：
 *   node tools/gen-data.js                     # 全部生成（默认 all）
 *   node tools/gen-data.js --only=appdata      # 模拟抽卡 appdata 四个映射表
 *   node tools/gen-data.js --only=images       # 补缺各类图片资源（幂等，已存在且合法跳过）
 *   node tools/gen-data.js --only=pooldata     # utils/gatcha/poolData.js 卡池时间线
 *   node tools/gen-data.js --only=paneldata    # 面板 character.json + baseData 两表
 *   node tools/gen-data.js --only=relicdata    # 面板 relics.json 全量重建（StarRailRes 遗器索引）
 *
 * 注意：
 *   - 生成的数据文件 / 图片不随 tools/ 一起提交，由维护者审查后另行提交。
 *   - 图片下载串行 + 每次间隔约 300ms，失败自动重试 3 次（指数退避），404 视为永久失败不重试。
 *   - images 阶段对已存在文件做 PNG 魔数校验（+ 光锥卡面另加竖版规格校验），
 *     损坏 / 规格不符的存量文件会被重新下载覆盖（存量历史脏数据自愈）。
 *   - miao-plugin 路径默认为 <本插件>/../miao-plugin，可用环境变量 MIAO_ROOT 覆盖。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const TOOLS_DIR = path.dirname(__filename)
const ROOT = path.resolve(TOOLS_DIR, '..')

const MIAO_ROOT = process.env.MIAO_ROOT
  ? path.resolve(process.env.MIAO_ROOT)
  : path.resolve(ROOT, '..', 'miao-plugin')

const SRR_BASE = 'https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/'
const SRR_CHARS_INDEX = `${SRR_BASE}index_new/cn/characters.json`
const SRR_LCS_INDEX = `${SRR_BASE}index_new/cn/light_cones.json`
const SRR_RELICS_INDEX = `${SRR_BASE}index_new/cn/relics.json`

/** 中文元素 → 英文元素（chardamagetype.json 值域） */
const ELEMENT_MAP = {
  雷: 'Thunder',
  冰: 'Ice',
  火: 'Fire',
  风: 'Wind',
  物理: 'Physical',
  虚数: 'Imaginary',
  量子: 'Quantum'
}

/** miao poolNameSr 缺失跃迁名时的人工补录（查证自官方卡池公告；键名含「•」须加引号） */
const POOL_NAME_OVERRIDES = {
  '丹恒•腾荒': '纵然山河万程'
}

/**
 * miao poolDetailSr 与其自身 weapon/character data.json 的名称不一致修正
 * （已知：4.3下半 weapon4 写作「点个关注吧」，光锥表实为「点个关注吧！」21017）
 */
const POOL_ITEM_NAME_FIXES = {
  点个关注吧: '点个关注吧！'
}

/** 模拟抽卡 appdata 的 dev 白板角色（保留在 char2charid / chardamagetype，StarRailRes 无此图片） */
const DEV_CHAR_ID = '9100'

/** 各文件路径 */
const P = {
  appdata: path.join(ROOT, 'resources/gachasimulation/resources/appdata'),
  gachaSimImages: path.join(ROOT, 'resources/gachasimulation/resources/images'),
  gatchaChar: path.join(ROOT, 'resources/gatcha/images/char'),
  panelChar: path.join(ROOT, 'resources/panel/resources/char_image'),
  panelWeapon: path.join(ROOT, 'resources/panel/resources/weapon'),
  panelRelic: path.join(ROOT, 'resources/panel/resources/relic'),
  panelRelicsData: path.join(ROOT, 'resources/panel/data/relics.json'),
  poolData: path.join(ROOT, 'utils/gatcha/poolData.js'),
  panelCharacter: path.join(ROOT, 'resources/panel/data/character.json'),
  baseCharacters: path.join(ROOT, 'resources/baseData/characters.json'),
  baseLightCones: path.join(ROOT, 'resources/baseData/light_cones.json'),
  collabPools: path.join(TOOLS_DIR, 'collab-pools.json')
}

const summary = { categories: [], failures: [], skips: [] }
const log = (...args) => console.log('[gen-data]', ...args)

/* ============================== miao 数据加载 ============================== */

function readJSON (file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

/** 从文本中按括号配对提取代码块（兼容字符串/转义/模板字面量，忽略注释中的括号风险） */
function extractBlock (text, marker, open, close) {
  const idx = text.indexOf(marker)
  if (idx < 0) throw new Error(`miao info/index.js 中未找到 ${marker}`)
  const start = text.indexOf(open, idx)
  let depth = 0
  let end = -1
  let inStr = null
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (inStr) {
      if (c === '\\') { i++; continue }
      if (c === inStr) inStr = null
      continue
    }
    if (c === "'" || c === '"' || c === '`') { inStr = c; continue }
    if (c === open) depth++
    if (c === close) {
      depth--
      if (depth === 0) { end = i; break }
    }
  }
  if (end < 0) throw new Error(`括号配对失败：${marker}`)
  return text.slice(start, end + 1)
}

function loadMiao () {
  const charFile = path.join(MIAO_ROOT, 'resources/meta-sr/character/data.json')
  const weaponFile = path.join(MIAO_ROOT, 'resources/meta-sr/weapon/data.json')
  const infoFile = path.join(MIAO_ROOT, 'resources/meta-sr/info/index.js')
  for (const f of [charFile, weaponFile, infoFile]) {
    if (!fs.existsSync(f)) {
      throw new Error(`找不到 miao-plugin 数据文件：${f}\n请确认 miao-plugin 安装位置，或用环境变量 MIAO_ROOT 指定`)
    }
  }
  const charAll = readJSON(charFile)
  const weapons = readJSON(weaponFile)
  // 排除 2xxx 前缀（强化形态角色，本插件无处理逻辑）
  const chars = {}
  let excluded = 0
  for (const [id, c] of Object.entries(charAll)) {
    if (id.startsWith('2')) { excluded++; continue }
    chars[id] = c
  }
  // info/index.js 为 ESM 源文件（CRLF），归一化后按括号配对提取再求值
  const infoText = fs.readFileSync(infoFile, 'utf8').replace(/\r\n/g, '\n')
  const poolDetailSr = new Function(`return ${extractBlock(infoText, 'poolDetailSr', '[', ']')}`)()
  const poolNameSr = new Function(`return ${extractBlock(infoText, 'poolNameSr', '{', '}')}`)()
  return { chars, weapons, poolDetailSr, poolNameSr, excluded }
}

/* ============================== StarRailRes 索引 ============================== */

async function fetchWithRetry (url, { retries = 3, timeout = 30000 } = {}) {
  let lastErr
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeout) })
      if (res.ok) return res
      // 404/410 视为永久失败，不重试
      if (res.status === 404 || res.status === 410) {
        const err = new Error(`HTTP ${res.status}`)
        err.permanent = true
        throw err
      }
      lastErr = new Error(`HTTP ${res.status}`)
    } catch (err) {
      if (err.permanent) throw err
      lastErr = err
    }
    if (attempt < retries) {
      const backoff = 1000 * Math.pow(2, attempt)
      log(`下载失败（${url}）：${lastErr.message}，${backoff}ms 后第 ${attempt + 1}/${retries} 次重试`)
      await sleep(backoff)
    }
  }
  throw lastErr
}

async function loadSrrIndex () {
  log('拉取 StarRailRes 索引 ...')
  const [charsRes, lcsRes, relicsRes] = await Promise.all([
    fetchWithRetry(SRR_CHARS_INDEX),
    fetchWithRetry(SRR_LCS_INDEX),
    fetchWithRetry(SRR_RELICS_INDEX)
  ])
  return {
    chars: await charsRes.json(),
    lightCones: await lcsRes.json(),
    relics: await relicsRes.json()
  }
}

/* ============================== 通用小工具 ============================== */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const numId = (id) => Number(id)

/** 按数字 ID 升序返回键（用于保持生成文件键序稳定） */
function sortedKeys (obj) {
  return Object.keys(obj).sort((a, b) => numId(a) - numId(b))
}

function writeJSON (file, data, { trailingNewline = true } = {}) {
  let text = JSON.stringify(data, null, 2)
  if (trailingNewline) text += '\n'
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, text, 'utf8')
  return Object.keys(data).length
}

const jsStr = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
const jsArr = (arr) => `[${(arr || []).map(jsStr).join(', ')}]`

/* ============================== appdata（模拟抽卡四表） ============================== */

function genAppdata (miao) {
  const { chars, weapons } = miao

  // char2charid.json：{角色名: ID}，数字升序 + dev 白板置尾（沿用现有文件风格）
  const char2charid = {}
  for (const id of sortedKeys(chars)) {
    char2charid[chars[id].name] = id
  }
  char2charid['dev_测试用白板'] = DEV_CHAR_ID

  // chardamagetype.json：{ID: 英文元素}
  const chardamagetype = {}
  for (const id of sortedKeys(chars)) {
    const elem = ELEMENT_MAP[chars[id].elem]
    if (!elem) throw new Error(`未知元素：${chars[id].name}(${id}) elem=${chars[id].elem}`)
    chardamagetype[id] = elem
  }
  chardamagetype[DEV_CHAR_ID] = 'Physical'

  // equipment.json：{光锥名: ID}
  const equipment = {}
  for (const id of sortedKeys(weapons)) {
    equipment[weapons[id].name] = id
  }

  // equipment2life.json：{光锥名: 中文命途}（type 直用，含「记忆」「欢愉」）
  const equipment2life = {}
  for (const id of sortedKeys(weapons)) {
    equipment2life[weapons[id].name] = weapons[id].type
  }

  const n1 = writeJSON(path.join(P.appdata, 'char2charid.json'), char2charid)
  const n2 = writeJSON(path.join(P.appdata, 'chardamagetype.json'), chardamagetype)
  const n3 = writeJSON(path.join(P.appdata, 'equipment.json'), equipment)
  const n4 = writeJSON(path.join(P.appdata, 'equipment2life.json'), equipment2life)

  // 自检
  const mustHave = { 1503: '真珠', 1014: 'Saber', 1508: '远坂凛', 8009: '穹·欢愉', 8010: '星·欢愉' }
  for (const [id, name] of Object.entries(mustHave)) {
    if (char2charid[name] !== id) throw new Error(`char2charid 自检失败：${name} 应为 ${id}`)
  }
  for (const id of ['23045', '23046', '23061', '23062']) {
    if (!Object.values(equipment).includes(id)) throw new Error(`equipment 自检失败：缺联动光锥 ${id}`)
  }
  const paths = new Set(Object.values(equipment2life))
  for (const p of ['记忆', '欢愉']) {
    if (!paths.has(p)) throw new Error(`equipment2life 自检失败：缺命途「${p}」`)
  }

  summary.categories.push(`appdata: char2charid ${n1} 条 / chardamagetype ${n2} 条 / equipment ${n3} 条 / equipment2life ${n4} 条`)
  log(`appdata 完成：${n1}/${n2}/${n3}/${n4} 条`)
}

/* ============================== poolData（卡池时间线） ============================== */

function poolEntryId (entry, seen) {
  const halfCode = { 上半: 'up', 下半: 'down', 中场: 'mid' }[entry.half] || 'x'
  const base = `ver${entry.version}${halfCode}`
  if (!seen.has(base)) {
    seen.set(base, 1)
    return base
  }
  // 同版本同半场的并行池（如 3.7 上半的昔涟池与铭心之萃集合池）：追加序号
  const n = seen.get(base) + 1
  seen.set(base, n)
  return `${base}-${n}`
}

function genPoolData (miao) {
  const { poolDetailSr, poolNameSr, chars, weapons } = miao
  const collab = readJSON(P.collabPools)

  // 卡池条目中的角色/光锥名必须能对上 miao 基础表（提前暴露上游名称不一致）
  const charNames = new Set(Object.values(chars).map((c) => c.name))
  const weaponNames = new Set(Object.values(weapons).map((w) => w.name))
  const fixName = (name) => POOL_ITEM_NAME_FIXES[name] || name
  const validateNames = (entry, names, table, label) => {
    for (const name of names) {
      if (!table.has(name)) {
        throw new Error(`卡池条目 ${entry.version}${entry.half} 的 ${label}「${name}」无法在 miao 基础表中匹配（请在 POOL_ITEM_NAME_FIXES 修正或更新 miao-plugin）`)
      }
    }
  }

  const entries = []
  const seen = new Map()
  for (const p of poolDetailSr) {
    if (!p.char5?.length) throw new Error(`miao 卡池条目缺 char5：${p.version} ${p.half}`)
    for (const key of ['char5', 'char4', 'weapon5', 'weapon4']) {
      p[key] = (p[key] || []).map(fixName)
    }
    validateNames(p, p.char5, charNames, 'UP五星角色')
    validateNames(p, p.char4, charNames, 'UP四星角色')
    validateNames(p, p.weapon5, weaponNames, 'UP五星光锥')
    validateNames(p, p.weapon4, weaponNames, 'UP四星光锥')
    const first = p.char5[0]
    const poolName = poolNameSr[first] || POOL_NAME_OVERRIDES[first]
    if (!poolName) throw new Error(`无法确定跃迁名：${p.version} ${p.half} ${first}（请在 POOL_NAME_OVERRIDES 补录）`)
    entries.push({
      id: poolEntryId(p, seen),
      version: p.version,
      half: p.half,
      from: p.from,
      to: p.to,
      poolName,
      char5: p.char5,
      char4: p.char4 || [],
      weapon5: p.weapon5 || [],
      weapon4: p.weapon4 || []
    })
  }
  for (const p of collab.pools) {
    for (const key of ['id', 'version', 'half', 'from', 'to', 'poolName', 'gachaType']) {
      if (!p[key]) throw new Error(`collab-pools.json 条目缺字段 ${key}`)
    }
    validateNames(p, p.char5 || [], charNames, '联动UP五星角色')
    validateNames(p, p.char4 || [], charNames, '联动UP四星角色')
    validateNames(p, p.weapon5 || [], weaponNames, '联动UP五星光锥')
    validateNames(p, p.weapon4 || [], weaponNames, '联动UP四星光锥')
    entries.push({
      id: p.id,
      gachaType: p.gachaType,
      version: p.version,
      half: p.half,
      from: p.from,
      to: p.to,
      poolName: p.poolName,
      char5: p.char5 || [],
      char4: p.char4 || [],
      weapon5: p.weapon5 || [],
      weapon4: p.weapon4 || []
    })
  }

  // 常规条目按开池时间稳定排序；联动条目固定置于数组末尾。
  // 原因：消费端 getPool()/stat() 的 currPool 均取「数组中首个日期命中」的条目，
  // 联动池 to 为远期哨兵（2036），若按时间插入会拦截其后所有常规记录的归组；
  // 置于末尾可保证常规记录（gacha_type 11/12）始终优先命中正确的常规池。
  // 联动记录（gacha_type 21/22）的消费端需结合条目的 gachaType 字段自行匹配
  // （两期联动池 to 均为哨兵值，时间上互相重叠，纯日期无法区分期次）。
  const regular = entries.filter((e) => !e.gachaType).sort((a, b) => new Date(a.from) - new Date(b.from))
  const collabEntries = entries.filter((e) => e.gachaType).sort((a, b) => new Date(a.from) - new Date(b.from))
  entries.length = 0
  entries.push(...regular, ...collabEntries)

  // 渲染为与现有 poolData.js 同构的模块
  const now = new Date()
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  let out = `/**
 * 卡池时间线数据 —— 本文件由 tools/gen-data.js 生成，请勿手工编辑
 *
 * 数据来源：miao-plugin resources/meta-sr/info/index.js 的 poolDetailSr（1.0 起全量常规池）
 *          + tools/collab-pools.json（Fate/stay night 两期联动池，gachaType 21/22）
 * 生成时间：${date}
 *
 * 字段说明：
 *  - id                 卡池分组标识（抽卡记录统计的分组 key）
 *  - gachaType          仅联动条目携带：21=角色联动跃迁、22=光锥联动跃迁（对应记录 gacha_type）
 *  - version / half     版本号 / 半场（上半｜下半｜中场｜联动）
 *  - from / to          起止时间（含半日切点，照抄 miao 数据）
 *  - poolName           跃迁名，取当期首位五星角色的跃迁名（miao poolNameSr；
 *                       丹恒•腾荒一条 miao 缺录，人工补录为「纵然山河万程」）
 *  - char5 / char4      当期 UP 五星 / 四星角色（3.2 起复刻位为集合池，一池多 UP 属正常）
 *  - weapon5 / weapon4  当期 UP 五星 / 四星光锥
 *
 * 旧版条目的 ids 字段（米游社卡池 gacha_id 对）已移除：消费端 getPool()/stat()
 * 仅按 from/to 日期区间匹配（见 utils/gatcha/index.js），从未读取过 ids。
 * 联动池长期开放，to 使用远期哨兵 2036-01-01 00:00:00，与官方抽卡 API
 * 返回的联动池结束时间哨兵一致。联动条目固定排在数组末尾：getPool() 取
 * 首个日期命中条目，若按时间插入会拦截其后所有常规记录的归组；消费联动
 * 记录（gacha_type 21/22）时需结合 gachaType 字段匹配（两期联动池时间上
 * 互相重叠，纯日期无法区分期次）。
 */
export const poolData = [
`
  entries.forEach((e, i) => {
    out += i === 0 ? '  {\n' : ', {\n'
    const fields = [
      `id: ${jsStr(e.id)}`,
      ...(e.gachaType ? [`gachaType: ${e.gachaType}`] : []),
      `version: ${jsStr(e.version)}`,
      `half: ${jsStr(e.half)}`,
      `from: ${jsStr(e.from)}`,
      `to: ${jsStr(e.to)}`,
      `poolName: ${jsStr(e.poolName)}`,
      `char5: ${jsArr(e.char5)}`,
      `char4: ${jsArr(e.char4)}`,
      `weapon5: ${jsArr(e.weapon5)}`,
      `weapon4: ${jsArr(e.weapon4)}`
    ]
    out += fields.map((f) => `    ${f}`).join(',\n')
    out += '\n  }'
  })
  out += '\n]\n'
  fs.writeFileSync(P.poolData, out, 'utf8')

  // 自检：动态导入验证语法 + 内容
  return import(`${pathToFileURL(P.poolData).href}?t=${Date.now()}`).then((mod) => {
    const data = mod.poolData
    if (data.length !== entries.length) throw new Error('poolData 自检失败：条目数不符')
    const regular = data.filter((e) => !e.gachaType)
    const last = regular[regular.length - 1]
    if (last.version !== '4.6') throw new Error(`poolData 自检失败：末条常规池应为 4.6，实际 ${last.version}`)
    const collabCount = data.length - regular.length
    if (collabCount !== 4) throw new Error(`poolData 自检失败：联动条目应为 4，实际 ${collabCount}`)
    summary.categories.push(`poolData: ${data.length} 条（常规 ${regular.length} 条至 ${last.version}${last.half}，联动 ${collabCount} 条置尾）`)
    log(`poolData 完成：${data.length} 条（常规 ${regular.length} + 联动 ${collabCount}）`)
  })
}

/* ============================== paneldata（面板 + baseData） ============================== */

function genPanelData (miao, srr) {
  const { chars, weapons } = miao

  // 交叉校验：miao（排除 2xxx）与 StarRailRes 索引的 ID 集合应一致
  const miaoIds = new Set(Object.keys(chars))
  const srrIds = new Set(Object.keys(srr.chars))
  const onlyMiao = [...miaoIds].filter((id) => !srrIds.has(id))
  const onlySrr = [...srrIds].filter((id) => !miaoIds.has(id))
  if (onlyMiao.length || onlySrr.length) {
    throw new Error(`miao 与 StarRailRes 角色 ID 不一致（仅 miao: ${onlyMiao.join(',')}；仅索引: ${onlySrr.join(',')}）`)
  }
  const lcMismatch = Object.keys(weapons).filter((id) => weapons[id].name !== srr.lightCones[id]?.name)
  if (lcMismatch.length) {
    throw new Error(`miao 与 StarRailRes 光锥名不一致：${lcMismatch.map((id) => `${id}:${weapons[id].name} vs ${srr.lightCones[id].name}`).join('; ')}`)
  }

  // panel/data/character.json：合并更新（旧条目原样保留，新条目用最小字段形状）
  // 消费点 apps/panel.js:134 仅读取 .path（charpath）；rarity/element/name 供数据完整性保留
  const panel = readJSON(P.panelCharacter)
  const before = Object.keys(panel).length
  let added = 0
  for (const id of sortedKeys(chars)) {
    if (panel[id]) continue
    const c = chars[id]
    panel[id] = {
      id,
      name: c.name,
      rarity: String(c.star),
      element: c.elem,
      path: c.weapon
    }
    added++
  }
  // 键序按数字升序重排（现有键本已升序，仅将新键插入正确位置）
  const sortedPanel = {}
  for (const id of Object.keys(panel).sort((a, b) => numId(a) - numId(b))) {
    sortedPanel[id] = panel[id]
  }
  const nPanel = writeJSON(P.panelCharacter, sortedPanel)
  if (!sortedPanel['1503'] || sortedPanel['1503'].name !== '真珠') throw new Error('panel character.json 自检失败：缺 真珠(1503)')

  // baseData/characters.json / light_cones.json：直接采用 StarRailRes 索引
  // （英文命途/元素枚举、数字星级；索引条目字段比旧文件少 guide_* 系列，上游已移除）
  const baseChars = {}
  for (const id of Object.keys(srr.chars).sort((a, b) => numId(a) - numId(b))) {
    baseChars[id] = srr.chars[id]
  }
  const baseLcs = {}
  for (const id of Object.keys(srr.lightCones).sort((a, b) => numId(a) - numId(b))) {
    baseLcs[id] = srr.lightCones[id]
  }
  const nBase = writeJSON(P.baseCharacters, baseChars, { trailingNewline: false })
  const nBaseLc = writeJSON(P.baseLightCones, baseLcs, { trailingNewline: false })

  summary.categories.push(`paneldata: panel character.json ${before}→${nPanel} 条（新增 ${added}）；baseData characters ${nBase} / light_cones ${nBaseLc} 条`)
  log(`paneldata 完成：panel ${before}→${nPanel}，baseData ${nBase}/${nBaseLc}`)
}

/* ============================== relicdata（面板遗器索引） ============================== */

/**
 * 面板 relics.json 全量重建：StarRailRes 遗器索引 → 本插件条目形状。
 *
 * 字段形状与存量 454 条完全一致（id/set_id/name/rarity/type/max_level/main_affix_id/
 * sub_affix_id/icon），仅 icon 归一化为 basename（索引为 "icon/relic/101_0.png" → "101_0.png"，
 * 与本地 resources/panel/resources/relic/ 命名一致）。
 * 消费点：apps/panel.js relicsPathData[id].icon（渲染路径）、utils/panel/{miaoSync,mysConverter}
 * 的遗器 meta 查表（名称/稀有度/max_level）。未收录 ID 曾导致新套装降级显示「遗器{id}」。
 */
function genRelicData (srr) {
  const index = srr.relics
  const out = {}
  for (const id of Object.keys(index).sort((a, b) => numId(a) - numId(b))) {
    const r = index[id]
    out[id] = {
      id: String(r.id),
      set_id: String(r.set_id),
      name: r.name,
      rarity: r.rarity,
      type: r.type,
      max_level: r.max_level,
      main_affix_id: String(r.main_affix_id),
      sub_affix_id: String(r.sub_affix_id),
      icon: r.icon.split('/').pop()
    }
  }

  // 自检：条目数与索引一致；新 4.x 套装锚点；存量字段形状锚点
  const count = Object.keys(out).length
  if (count !== Object.keys(index).length) throw new Error('relics 自检失败：条目数与索引不符')
  if (!out['63265'] || out['63265'].name !== '千星城的传媒总部') {
    throw new Error('relics 自检失败：缺 4.x 遗器 63265（千星城的传媒总部）')
  }
  if (out['61011']?.name !== '过客的逢春木簪' || out['61011']?.icon !== '101_0.png') {
    throw new Error('relics 自检失败：存量条目 61011 字段形状漂移')
  }
  for (const set of ['115', '134', '325', '326', '327', '328']) {
    if (!Object.values(out).some(r => r.set_id === set)) {
      throw new Error(`relics 自检失败：缺套装 ${set}`)
    }
  }
  const badIcon = Object.values(out).filter(r => !/^\d+_\d\.png$/.test(r.icon))
  if (badIcon.length) throw new Error(`relics 自检失败：icon 非 basename 形式（${badIcon[0].id}: ${badIcon[0].icon}）`)

  writeJSON(P.panelRelicsData, out)
  summary.categories.push(`relicdata: relics.json ${count} 条（StarRailRes 索引全量重建）`)
  log(`relicdata 完成：relics.json ${count} 条`)
}

/* ============================== images（图片补缺） ============================== */

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

async function downloadImage (url, dest) {
  const res = await fetchWithRetry(url)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 100 || (!buf.subarray(0, 8).equals(PNG_MAGIC))) {
    throw new Error(`非 PNG 内容（${buf.length} 字节）`)
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.writeFileSync(dest, buf)
}

/** 存量文件是否为合法 PNG（本目录树全部为 PNG 资产；JPEG 冒名等历史脏数据返回 false） */
function isPngFile (file) {
  try {
    const fd = fs.openSync(file, 'r')
    try {
      const buf = Buffer.alloc(8)
      return fs.readSync(fd, buf, 0, 8, 0) === 8 && buf.equals(PNG_MAGIC)
    } finally {
      fs.closeSync(fd)
    }
  } catch {
    return false
  }
}

/**
 * 串行补缺一组图片。已存在文件先做合法性校验（PNG 魔数 + 可选 item.validate），
 * 不合法则重新下载覆盖（历史脏数据 / 规格不符自愈），合法才跳过。
 * @param {Array<{id:string,url:string,dest:string,permanentSkip?:string,validate?:(buf:Buffer)=>boolean}>} items
 */
async function fillImages (label, items) {
  let ok = 0
  let skip = 0
  let heal = 0
  let fail = 0
  for (const item of items) {
    if (fs.existsSync(item.dest)) {
      let valid = isPngFile(item.dest)
      if (valid && item.validate) {
        valid = item.validate(fs.readFileSync(item.dest))
      }
      if (valid) { skip++; continue }
      heal++
      summary.skips.push(`[${label}] ${item.id}：存量文件校验不通过，重新下载覆盖`)
    }
    if (item.permanentSkip) {
      summary.skips.push(`[${label}] ${item.id}：${item.permanentSkip}`)
      skip++
      continue
    }
    try {
      await downloadImage(item.url, item.dest)
      ok++
    } catch (err) {
      fail++
      summary.failures.push(`[${label}] ${item.id} 下载失败：${err.message}（${item.url}）`)
    }
    await sleep(300)
  }
  summary.categories.push(`images/${label}: 新下载 ${ok}，已存在跳过 ${skip}，校验自愈重下 ${heal}，失败 ${fail}`)
  log(`images/${label} 完成：下载 ${ok} / 跳过 ${skip} / 自愈重下 ${heal} / 失败 ${fail}`)
}

async function genImages (miao, srr) {
  const charIds = sortedKeys(miao.chars)
  const weaponIds = sortedKeys(miao.weapons)

  // 光锥图标路径以索引 icon 字段为准（icon/light_cone/{id}.png）
  const lcIcon = (id) => srr.lightCones[id]?.icon || `icon/light_cone/${id}.png`

  // 1. 模拟抽卡：角色立绘（char_image，char2charid 全部 ID，dev 白板除外）
  //    StarRailRes image/character_preview 为 376x512 半身像，与仓库现有素材（~380x460 半身像）同族。
  await fillImages('gachasimulation/char_image', [...charIds, DEV_CHAR_ID].map((id) => ({
    id,
    url: `${SRR_BASE}image/character_preview/${id}.png`,
    dest: path.join(P.gachaSimImages, 'char_image', `${id}.png`),
    permanentSkip: id === DEV_CHAR_ID ? 'dev 白板角色，StarRailRes 无此图片（模拟池也不会抽出）' : undefined
  })))

  // 2. 模拟抽卡：光锥卡面（weapon）
  //    存量为 256x300~348x408 竖版卡面 → StarRailRes image/light_cone_preview 同规格；
  //    校验规则：竖版（高>宽），历史上误用 128x128 图标源的存量文件会被自动重下覆盖。
  await fillImages('gachasimulation/weapon', weaponIds.map((id) => ({
    id,
    url: `${SRR_BASE}image/light_cone_preview/${id}.png`,
    dest: path.join(P.gachaSimImages, 'weapon', `${id}.png`),
    validate: (buf) => buf.readUInt32BE(20) > buf.readUInt32BE(16)
  })))

  // 3. 抽卡分析：角色头像（gatcha/images/char，含开拓者 8001-8010）
  //    现有素材为 256x256 方形头像，icon/character 同规格。
  await fillImages('gatcha/images/char', charIds.map((id) => ({
    id,
    url: `${SRR_BASE}icon/character/${id}.png`,
    dest: path.join(P.gatchaChar, `${id}.png`)
  })))

  // 4. 面板：角色立绘（panel/resources/char_image，现有素材为 2048x2048 立绘 → character_portrait 同规格）
  await fillImages('panel/char_image', charIds.map((id) => ({
    id,
    url: `${SRR_BASE}image/character_portrait/${id}.png`,
    dest: path.join(P.panelChar, `${id}.png`)
  })))

  // 5. 面板：光锥图标（panel/resources/weapon，现有素材 128x128 → 索引图标同规格）
  await fillImages('panel/weapon', weaponIds.map((id) => ({
    id,
    url: `${SRR_BASE}${lcIcon(id)}`,
    dest: path.join(P.panelWeapon, `${id}.png`)
  })))

  // 5.2 面板：遗器图标（panel/resources/relic，128x128，命名 {set}_{pos}.png 与 relics.json
  //     icon 字段一致；另补套装级 {set}.png 保持与存量命名族一致）
  //     图标清单以 StarRailRes 遗器索引（srr.relics）为准 —— 本地 relics.json 未重建时也能补全。
  const relicIcons = new Map()
  for (const r of Object.values(srr.relics)) {
    const base = r.icon.split('/').pop()
    const set = String(r.set_id)
    relicIcons.set(base, `${SRR_BASE}icon/relic/${base}`)
    relicIcons.set(`${set}.png`, `${SRR_BASE}icon/relic/${set}.png`)
  }
  await fillImages('panel/relic', [...relicIcons.entries()].map(([name, url]) => ({
    id: name,
    url,
    dest: path.join(P.panelRelic, name)
  })))

  // 5.5 面板：技能图标（panel/resources/skill，命名 {avatarId}_{后缀}.png 与 panel.js handleBehaviorList 一致）
  //     StarRailRes icon/skill/ 与面板命名完全一致；后缀集合与既有素材相同（12 个/角色）：
  //     5 主技能 + 3 星魂 + basic 系之外新增 skilltree1-3（行迹画布能力节点图标，
  //     原先从 avocado CDN 加载，已死站 —— 见 new_panel.html 行迹画布本地化）。
  //     强化角色(2xxx) StarRailRes 无 → 复制原角色同名图标占位（有更好图源后可替换）。
  //     忆灵技/忆灵天赋/欢愉技图标（_me/_mt/_xe/_xe2）StarRailRes 暂无收录，本阶段不涉及
  //     （面板模板对缺失图标有 onerror 兜底）。
  const skillSuffixes = [
    'basic_atk', 'skill', 'ultimate', 'talent', 'technique',
    'rank1', 'rank2', 'rank4', 'rank6',
    'skilltree1', 'skilltree2', 'skilltree3'
  ]
  const skillDir = path.join(ROOT, 'resources/panel/resources/skill')
  let skillDl = 0, skillSkip = 0, skillCp = 0, skillFail = 0, skillHeal = 0
  const proCharMap = { 2004: '1004', 2005: '1005', 2006: '1006', 2102: '1102', 2205: '1205', 2212: '1212', 2217: '1217', 2306: '1306', 2307: '1307', 2310: '1310' }
  for (const id of [...charIds, ...Object.keys(proCharMap)]) {
    for (const suf of skillSuffixes) {
      const dest = path.join(skillDir, `${id}_${suf}.png`)
      if (fs.existsSync(dest) && isPngFile(dest)) { skillSkip++; continue }
      if (fs.existsSync(dest)) skillHeal++
      const origId = proCharMap[id]
      if (origId) {
        // 强化角色：复制原角色图标占位
        const src = path.join(skillDir, `${origId}_${suf}.png`)
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest)
          skillCp++
        } else {
          skillFail++
          summary.failures.push(`[images/skill] ${id}_${suf}.png 占位复制失败：源 ${origId}_${suf}.png 不存在`)
        }
      } else {
        try {
          await downloadImage(`${SRR_BASE}icon/skill/${id}_${suf}.png`, dest)
          skillDl++
        } catch (err) {
          skillFail++
          summary.failures.push(`[images/skill] ${id}_${suf}.png 下载失败：${err.message}`)
        }
      }
    }
  }
  summary.categories.push(`images/skill: 下载 ${skillDl} / 跳过 ${skillSkip} / PNG校验自愈重下 ${skillHeal} / Pro占位复制 ${skillCp} / 失败 ${skillFail}`)
  log(`images/skill 完成：下载 ${skillDl}，跳过 ${skillSkip}，自愈重下 ${skillHeal}，Pro 占位复制 ${skillCp}，失败 ${skillFail}`)

  // 6. 模拟抽卡：命途图（weaponlife）—— 记忆/欢愉 由仓库内现成 BgPaths* 素材复制改名
  //    （BgPaths* 与现有 7 张中文命途图同为 612x612 RGBA 白色剪影素材，风格一致）
  const wl = path.join(P.gachaSimImages, 'weaponlife')
  const pathCopies = [
    ['BgPathsMemory.png', '记忆.png'],
    ['BgPathsJoy.png', '欢愉.png']
  ]
  let copied = 0
  for (const [src, dst] of pathCopies) {
    const srcPath = path.join(wl, src)
    const dstPath = path.join(wl, dst)
    if (fs.existsSync(dstPath)) continue
    if (!fs.existsSync(srcPath)) {
      summary.failures.push(`[images/weaponlife] ${dst} 复制失败：源文件 ${src} 不存在`)
      continue
    }
    fs.copyFileSync(srcPath, dstPath)
    copied++
  }
  summary.categories.push(`images/weaponlife: 新复制 ${copied}（记忆/欢愉）`)
  log(`images/weaponlife 完成：复制 ${copied}`)
}

/* ============================== 主流程 ============================== */

function parseOnly () {
  const match = process.argv.slice(2).join(' ').match(/--only[=\s]+(\w+)/)
  const val = match ? match[1] : 'all'
  const valid = ['appdata', 'images', 'pooldata', 'paneldata', 'relicdata', 'all']
  if (!valid.includes(val)) {
    console.error(`[gen-data] 未知 --only 值：${val}（可选：${valid.join(' | ')}）`)
    process.exit(1)
  }
  return val
}

async function main () {
  const only = parseOnly()
  log(`开始（--only=${only}），插件根目录：${ROOT}`)
  log(`miao-plugin 数据目录：${MIAO_ROOT}`)

  const miao = loadMiao()
  log(`miao 数据：角色 ${Object.keys(miao.chars).length}（排除 2xxx 强化形态 ${miao.excluded} 个）、光锥 ${Object.keys(miao.weapons).length}、卡池 ${miao.poolDetailSr.length} 条`)

  if (only === 'appdata') {
    genAppdata(miao)
  } else if (only === 'pooldata') {
    await genPoolData(miao)
  } else if (only === 'paneldata') {
    genPanelData(miao, await loadSrrIndex())
  } else if (only === 'relicdata') {
    genRelicData(await loadSrrIndex())
  } else if (only === 'images') {
    await genImages(miao, await loadSrrIndex())
  } else {
    genAppdata(miao)
    await genPoolData(miao)
    genPanelData(miao, await loadSrrIndex())
    genRelicData(await loadSrrIndex())
    await genImages(miao, await loadSrrIndex())
  }

  console.log('\n[gen-data] ===== 生成摘要 =====')
  for (const line of summary.categories) console.log('  ' + line)
  if (summary.skips.length) {
    console.log('\n[gen-data] ===== 预期内跳过 =====')
    for (const line of summary.skips) console.log('  ' + line)
  }
  if (summary.failures.length) {
    console.log('\n[gen-data] ===== 失败清单 =====')
    for (const line of summary.failures) console.log('  ' + line)
    process.exitCode = 1
  } else {
    console.log('\n[gen-data] 全部成功，无失败项')
  }
}

main().catch((err) => {
  console.error('[gen-data] 执行失败：', err)
  process.exit(1)
})
