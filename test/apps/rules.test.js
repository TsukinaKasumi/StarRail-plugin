/**
 * 命令分派（全部 apps 的命令正则，经 helpers/rule-extractor.mjs 静态提取，免加载 Yunzai 框架）
 *
 * 覆盖场景（场景表参考 temp/test-regex.js 的思路，仅取场景、用例数据独立编写）：
 *  - 联动新命令路由：*十连联动 等归 gachasimulation；*联动分析/*角色联动记录 等归 gatcha
 *  - 同步/导出命令归 gatchasync 独占，不被 gatcha/gachasimulation 吞
 *  - 不抢 miao-plugin：#星铁米游社更新面板 不命中本插件；#星铁更新面板 归 MiaoOrStarrail
 *  - 既有命令回归（模拟抽卡/抽卡分析/深渊/宇宙/面板等）
 *  - 拒绝无前缀、不支持词（*十连武器）、不支持词序（*十连光锥联动）
 *  - 一致性：同一消息不得被本插件两个 app 同时命中，白名单豁免已知分工
 *
 * 注意：本文件为静态正则断言；TRSS 运行时 loader 会把 * 星铁词 前缀标准化为 #星铁
 * （lib/plugins/loader.js srReg），本插件 rulePrefix 两种形态均覆盖，不影响结论。
 * 提取器已还原字符串转义语义（042b42a）：源码 '\\d'/'\\*' 形态按运行时值提取，
 * 此类命令（*常规演算1、*绑定uid 123456789 等）可入用例表。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractRules, matchRules } from '../helpers/rule-extractor.mjs'

const rules = extractRules()
const hits = (msg) => matchRules(rules, msg)
const apps = (msg) => [...new Set(hits(msg).map((r) => r.app))]
const describe = (msg) => hits(msg).map((r) => `${r.app}.${r.fnc}`).join(', ') || '（无命中）'

/**
 * 已知跨 app 多命中登记（除此之外的多命中一律视为冲突）：
 *  - MiaoOrStarrail|panel：#星铁XX面板 / #星铁更新面板 的既定分工
 *    （MiaoOrStarrail priority -1000 先派发，panel 负责其余前缀与 * 更新面板 形态）
 *  - gatcha|hkrpg：hkrpg.card 的 `^rulePrefix(卡片|探索|角色)` 未加 $ 锚定、
 *    getPayLog 含 (光锥|武器)记录，与 gatcha 的分析/记录命令前缀重叠。
 *    两者同为 -114514 优先级，运行时靠 apps 文件枚举顺序（gatcha 先于 hkrpg）
 *    先派发即 return 兜底——属隐式依赖，登记在此防新增重叠被掩盖
 */
const KNOWN_MULTI = new Set(['MiaoOrStarrail|panel', 'gatcha|hkrpg'])

/** 用例表：msg 为命令原文，apps 为断言的精确命中 app 集合（含已知多命中），[] 表示不得命中 */
const CORPUS = [
  // ---- 新命令：联动十连 → gachasimulation ----
  { group: 'collab-sim', msg: '*十连联动', apps: ['gachasimulation'] },
  { group: 'collab-sim', msg: '＊十连联动光锥', apps: ['gachasimulation'] },
  { group: 'collab-sim', msg: '#星铁抽卡联动', apps: ['gachasimulation'] },
  { group: 'collab-sim', msg: '*十连联动角色', apps: ['gachasimulation'] },
  { group: 'collab-sim', msg: '*抽卡联动', apps: ['gachasimulation'] },
  // ---- 新命令：联动分析/记录 → gatcha ----
  { group: 'collab-stat', msg: '*联动分析', apps: ['gatcha'] },
  { group: 'collab-stat', msg: '*联动记录', apps: ['gatcha'] },
  { group: 'collab-stat', msg: '*联动统计', apps: ['gatcha'] },
  { group: 'collab-stat', msg: '*角色联动记录', apps: ['gatcha', 'hkrpg'] }, // hkrpg.card 未锚定，已知重叠
  { group: 'collab-stat', msg: '*光锥联动记录', apps: ['gatcha'] },
  { group: 'collab-stat', msg: '*武器联动记录', apps: ['gatcha'] },
  { group: 'collab-stat', msg: '*光锥联动分析', apps: ['gatcha'] },
  // ---- 面板同步命令 → panel 独占（miao 自动同步的显式入口） ----
  { group: 'panel-sync', msg: '*同步面板', apps: ['panel'] },
  { group: 'panel-sync', msg: '*同步面板更新', apps: ['panel'] },
  { group: 'panel-sync', msg: '#星铁同步面板', apps: ['panel'] },
  // ---- 新命令：同步/导出 → gatchasync 独占 ----
  { group: 'sync', msg: '*同步抽卡记录', apps: ['gatchasync'] },
  { group: 'sync', msg: '＊同步抽卡记录', apps: ['gatchasync'] },
  { group: 'sync', msg: '#星铁同步抽卡记录', apps: ['gatchasync'] },
  { group: 'sync', msg: '#sr同步抽卡记录', apps: ['gatchasync'] },
  { group: 'sync', msg: '*星铁同步抽卡记录', apps: ['gatchasync'] },
  { group: 'sync', msg: '*导出抽卡记录', apps: ['gatchasync'] },
  { group: 'sync', msg: '*导出跃迁记录', apps: ['gatchasync'] },
  { group: 'sync', msg: '*导出记录', apps: ['gatchasync'] },
  { group: 'sync', msg: '*导出记录json', apps: ['gatchasync'] },
  { group: 'sync', msg: '＊导出记录json', apps: ['gatchasync'] },
  { group: 'sync', msg: '*导出抽卡记录json', apps: ['gatchasync'] },
  // ---- 不抢 miao-plugin ----
  { group: 'miao-guard', msg: '#星铁米游社更新面板', apps: [] }, // 归 miao-plugin
  { group: 'miao-guard', msg: '#星铁更新面板', apps: ['MiaoOrStarrail', 'panel'] }, // MiaoOrStarrail 先派发
  { group: 'miao-guard', msg: '＊米游社更新面板', apps: ['panel'] }, // 本插件米游社直连命令（全角＊形态）
  // ---- 回归：模拟抽卡 ----
  { group: 'regress', msg: '*十连', apps: ['gachasimulation'] },
  { group: 'regress', msg: '*抽卡', apps: ['gachasimulation'] },
  { group: 'regress', msg: '＊十连', apps: ['gachasimulation'] },
  { group: 'regress', msg: '#星铁十连', apps: ['gachasimulation'] },
  { group: 'regress', msg: '*十连角色', apps: ['gachasimulation'] },
  { group: 'regress', msg: '*十连光锥', apps: ['gachasimulation'] },
  { group: 'regress', msg: '*十连常驻', apps: ['gachasimulation'] },
  // ---- 回归：抽卡记录/分析 ----
  { group: 'regress', msg: '*更新抽卡记录', apps: ['gatcha'] },
  { group: 'regress', msg: '*更新跃迁记录', apps: ['gatcha'] },
  { group: 'regress', msg: '*抽卡链接', apps: ['gatcha'] },
  { group: 'regress', msg: '*抽卡链接绑定', apps: ['gatcha'] },
  { group: 'regress', msg: '*抽卡帮助', apps: ['gatcha'] },
  { group: 'regress', msg: '*跃迁分析', apps: ['gatcha'] },
  { group: 'regress', msg: '*跃迁记录', apps: ['gatcha'] },
  { group: 'regress', msg: '*角色分析', apps: ['gatcha', 'hkrpg'] }, // 插件对外宣传命令，hkrpg.card 已知重叠
  { group: 'regress', msg: '*光锥分析', apps: ['gatcha'] },
  { group: 'regress', msg: '*常驻分析', apps: ['gatcha'] },
  { group: 'regress', msg: '*新手记录', apps: ['gatcha'] },
  { group: 'regress', msg: '*抽卡统计', apps: ['gatcha'] },
  // ---- 回归：深渊/宇宙/面板/其它 ----
  { group: 'regress', msg: '*深渊', apps: ['challenge'] },
  { group: 'regress', msg: '*最新深渊', apps: ['challenge'] },
  { group: 'regress', msg: '*上期深渊', apps: ['challenge'] },
  { group: 'regress', msg: '*忘却之庭', apps: ['challenge'] },
  { group: 'regress', msg: '*虚构叙事', apps: ['challenge'] },
  { group: 'regress', msg: '*末日幻影', apps: ['challenge'] },
  { group: 'regress', msg: '*异相仲裁', apps: ['challenge'] },
  { group: 'regress', msg: '*宇宙', apps: ['rogue'] },
  { group: 'regress', msg: '*差分宇宙', apps: ['rogue'] },
  { group: 'regress', msg: '*寰宇蝗灾', apps: ['rogue'] },
  { group: 'regress', msg: '*黄金与机械', apps: ['rogue'] },
  { group: 'regress', msg: '*不可知域', apps: ['rogue'] },
  // ---- 常规演算：数字下标/uid 形态 → rogue.rogue_tourn_normal ----
  { group: 'tourn-normal', msg: '*常规演算', apps: ['rogue'] },
  { group: 'tourn-normal', msg: '*常规演算1', apps: ['rogue'] },
  { group: 'tourn-normal', msg: '*常规演算123456789', apps: ['rogue'] }, // ≥3位数字=uid
  { group: 'tourn-normal', msg: '*常规演算1 123456789', apps: ['rogue'] }, // 下标 + uid
  { group: 'tourn-normal', msg: '*常规演算战绩1 123456789', apps: ['rogue'] },
  { group: 'tourn-normal', msg: '#星铁常规演算1', apps: ['rogue'] },
  { group: 'tourn-normal', msg: '*常规差分宇宙1 123456789', apps: ['rogue'] },
  // ---- 周期演算：数字下标/uid 形态 → rogue.rogue_tourn_week ----
  { group: 'tourn-week', msg: '*本期演算', apps: ['rogue'] },
  { group: 'tourn-week', msg: '*本期演算2', apps: ['rogue'] },
  { group: 'tourn-week', msg: '*上期演算2 123456789', apps: ['rogue'] },
  { group: 'tourn-week', msg: '*本周演算战绩3 123456789', apps: ['rogue'] },
  { group: 'tourn-week', msg: '#星铁上期演算1', apps: ['rogue'] },
  { group: 'tourn-week', msg: '*周期演算', apps: ['rogue'] }, // 引导命令
  // ---- 货币战争战绩：数字下标/uid 形态 → gridFight.grid_fight_archive ----
  { group: 'grid-fight', msg: '*货币战绩', apps: ['gridFight'] },
  { group: 'grid-fight', msg: '*货币战绩1', apps: ['gridFight'] },
  { group: 'grid-fight', msg: '*货币战绩10 123456789', apps: ['gridFight'] }, // 两位下标（共10条）
  { group: 'grid-fight', msg: '*币战回顾2', apps: ['gridFight'] },
  { group: 'regress', msg: '#星铁希儿面板', apps: ['MiaoOrStarrail', 'panel'] }, // 已知面板分工
  { group: 'regress', msg: '*面板', apps: ['panel'] },
  { group: 'regress', msg: '*面板列表', apps: ['panel'] },
  { group: 'regress', msg: '*更新面板', apps: ['panel'] },
  { group: 'regress', msg: '*体力', apps: ['note'] },
  { group: 'regress', msg: '*月历', apps: ['month'] },
  { group: 'regress', msg: '*星琼获取', apps: ['month'] },
  // ---- 拒绝 ----
  { group: 'reject', msg: '十连', apps: [] }, // 无前缀
  { group: 'reject', msg: '十连联动', apps: [] }, // 无前缀
  { group: 'reject', msg: '#十连', apps: [] }, // # 后必须跟星铁词
  { group: 'reject', msg: '同步抽卡记录', apps: [] }, // 无前缀
  { group: 'reject', msg: '导出记录', apps: [] }, // 无前缀
  { group: 'reject', msg: '*同步抽卡', apps: [] }, // 不完整命令
  { group: 'reject', msg: '*十连武器', apps: [] }, // 不支持词（武器池应说 光锥）
  { group: 'reject', msg: '*十连光锥联动', apps: [] }, // 不支持词序（应为 联动光锥）
  { group: 'reject', msg: '*十连角色联动', apps: [] }, // 不支持词序（应为 联动角色）
  { group: 'reject', msg: '*常规演算1 123456 789', apps: [] }, // 三段数字（仅支持下标+uid两段）
  { group: 'reject', msg: '*常规演算abc', apps: [] }, // 尾随垃圾（原规则缺 $ 锚定，本次收紧）
  { group: 'reject', msg: '*常规演算二', apps: [] }, // 汉字下标已移除
  { group: 'reject', msg: '*本期演算三', apps: [] }, // 汉字下标已移除
  { group: 'reject', msg: '*货币战绩十', apps: [] } // 汉字下标已移除
]

const byGroup = (group) => CORPUS.filter((c) => c.group === group)

const assertDispatch = ({ msg, apps: expected }) => {
  assert.deepEqual(
    apps(msg).sort(),
    [...expected].sort(),
    `「${msg}」期望命中 [${expected.join(',')}]，实际 ${describe(msg)}`
  )
}

test('新命令：联动十连归 gachasimulation（main）', () => {
  for (const c of byGroup('collab-sim')) {
    assertDispatch(c)
    assert.ok(
      hits(c.msg).some((r) => r.app === 'gachasimulation' && r.fnc === 'main'),
      `「${c.msg}」应命中 gachasimulation.main`
    )
  }
})

test('新命令：联动分析/记录归 gatcha（gatcha）', () => {
  for (const c of byGroup('collab-stat')) {
    assertDispatch(c)
    assert.ok(
      hits(c.msg).some((r) => r.app === 'gatcha' && r.fnc === 'gatcha'),
      `「${c.msg}」应命中 gatcha.gatcha`
    )
  }
})

test('新命令：同步/导出归 gatchasync 且不被 gatcha/gachasimulation 吞', () => {
  for (const c of byGroup('sync')) {
    assertDispatch(c)
    const swallowed = hits(c.msg).filter((r) => ['gatcha', 'gachasimulation'].includes(r.app))
    assert.deepEqual(swallowed, [], `「${c.msg}」不应被 gatcha/gachasimulation 命中`)
    assert.ok(
      hits(c.msg).some((r) => r.app === 'gatchasync'),
      `「${c.msg}」应命中 gatchasync`
    )
  }
})

test('不抢 miao：#星铁米游社更新面板 不命中本插件任何规则', () => {
  const c = byGroup('miao-guard').find((x) => x.msg === '#星铁米游社更新面板')
  assertDispatch(c)
})

test('面板分工：#星铁更新面板 归 MiaoOrStarrail（panel 同命中为已知分工）', () => {
  const hitsOf = hits('#星铁更新面板')
  assert.ok(
    hitsOf.some((r) => r.app === 'MiaoOrStarrail' && r.fnc === 'update'),
    '#星铁更新面板 应命中 MiaoOrStarrail.update'
  )
  assertDispatch(byGroup('miao-guard').find((x) => x.msg === '#星铁更新面板'))
})

test('回归：既有命令分派保持', () => {
  for (const c of byGroup('regress')) {
    assertDispatch(c)
  }
})

test('常规演算：数字下标/uid 形态归 rogue（rogue_tourn_normal）', () => {
  for (const c of byGroup('tourn-normal')) {
    assertDispatch(c)
    assert.ok(
      hits(c.msg).some((r) => r.app === 'rogue' && r.fnc === 'rogue_tourn_normal'),
      `「${c.msg}」应命中 rogue.rogue_tourn_normal`
    )
  }
})

test('周期演算：数字下标/uid 形态归 rogue（rogue_tourn_week / 引导命令）', () => {
  for (const c of byGroup('tourn-week')) {
    assertDispatch(c)
    const fnc = c.msg === '*周期演算' ? 'rogue_tourn_week_help' : 'rogue_tourn_week'
    assert.ok(
      hits(c.msg).some((r) => r.app === 'rogue' && r.fnc === fnc),
      `「${c.msg}」应命中 rogue.${fnc}`
    )
  }
})

test('货币战争战绩：数字下标/uid 形态归 gridFight（grid_fight_archive）', () => {
  for (const c of byGroup('grid-fight')) {
    assertDispatch(c)
    assert.ok(
      hits(c.msg).some((r) => r.app === 'gridFight' && r.fnc === 'grid_fight_archive'),
      `「${c.msg}」应命中 gridFight.grid_fight_archive`
    )
  }
})

test('拒绝：无前缀 / 不支持词 / 不支持词序不命中', () => {
  for (const c of byGroup('reject')) {
    assertDispatch(c)
  }
})

test('一致性：同一消息不被本插件两个未知分工的 app 同时命中', () => {
  const offenders = []
  for (const c of CORPUS) {
    const hit = apps(c.msg)
    if (hit.length > 1 && !KNOWN_MULTI.has(hit.sort().join('|'))) {
      offenders.push(`「${c.msg}」→ ${describe(c.msg)}`)
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `出现未登记的跨 app 多命中（新命令被抢或正则冲突）：\n  ${offenders.join('\n  ')}`
  )
})

test('一致性：已知多命中登记无过期条目（分工解除后应移除登记）', () => {
  for (const pair of KNOWN_MULTI) {
    const [a, b] = pair.split('|')
    const alive = CORPUS.some((c) => {
      const hit = apps(c.msg)
      return hit.length === 2 && hit.includes(a) && hit.includes(b)
    })
    assert.ok(alive, `登记 ${pair} 已不再复现，请从 KNOWN_MULTI 移除`)
  }
})
