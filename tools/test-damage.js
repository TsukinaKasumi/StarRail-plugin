/**
 * StarRail-plugin 伤害引擎回归 + 欢愉（elation）/ 忆灵（me/mt）冒烟测试
 *
 * 独立 dev 脚本：零 bot 依赖、不注册任何命令、不被 apps 加载器扫描。
 * 直接构造合成面板数据（charinfo，形状同 apps/panel.js 缓存的第三方 API 数据），
 * 调用 utils/damage/main.js 导出的 damage()。
 *
 * 用法：
 *   node tools/test-damage.js --save   仅生成 1.3 现有角色回归基线（写入系统临时目录；引擎改动前跑一次）
 *   node tools/test-damage.js         回归（有基线则逐字段比对）+ 欢愉/忆灵公式冒烟（手算对照）
 *
 * 说明：
 * - 引擎的 json 数据以 process.cwd()/plugins/<插件名> 定位（utils/path.js），
 *   因此本脚本先 chdir 到 Yunzai 根目录（本文件位于 plugins/StarRail-plugin/tools/）。
 * - 基线文件与沙盒均放在系统临时目录，不进入仓库。
 */
import path from 'path'
import fs from 'fs'
import os from 'os'
import { fileURLToPath, pathToFileURL } from 'url'
import { createRequire } from 'module'

// 引擎代码使用 Yunzai 运行时的全局 logger，独立运行时打桩
if (!globalThis.logger) {
  globalThis.logger = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: console.error,
    mark: () => {}
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pluginDir = path.resolve(__dirname, '..') // <yunzai>/plugins/StarRail-plugin
const yunzaiRoot = path.resolve(pluginDir, '..', '..')
// utils/path.js 以 process.cwd()/plugins/<插件名> 定位插件根，先切到 Yunzai 根目录
process.chdir(yunzaiRoot)

const { damage } = await import(
  pathToFileURL(path.join(pluginDir, 'utils/damage/main.js')).href
)
const { skilldict } = await import(
  pathToFileURL(path.join(pluginDir, 'utils/damage/data/data.js')).href
)

const BASELINE_FILE = path.join(os.tmpdir(), 'starrail-plugin-damage-baseline.json')
const REL_TOL = 1e-4 // 0.01% 相对误差

let failed = 0
function fail (msg) {
  failed++
  console.log('  [FAIL] ' + msg)
}
function pass (msg) {
  console.log('  [PASS] ' + msg)
}

/* ========== 一、回归用合成输入（SkillData 现有 14 名 1.3 角色） ========== */

// 各角色属性（与 resources/panel/data/character.json 一致）
const CHAR_ELEMENT = {
  1003: 'Fire', 1004: 'Imaginary', 1005: 'Thunder', 1006: 'Quantum',
  1102: 'Quantum', 1107: 'Physical', 1112: 'Fire',
  1201: 'Quantum', 1204: 'Thunder', 1205: 'Wind', 1208: 'Quantum',
  1209: 'Ice', 1212: 'Ice', 1213: 'Imaginary'
}
// 属性对应的元素伤害遗器套装 id（RelicSetSkill.json）
const ELEMENT_SET = {
  Fire: '107', Physical: '105', Ice: '104', Quantum: '108',
  Thunder: '109', Wind: '110', Imaginary: '112'
}
// 副词条池：{ELE} 占位替换为角色属性前缀（含技能位加成键，覆盖引擎各后缀匹配循环）
const SUBSTAT_POOL = [
  ['CriticalChanceBase', 0.033, 0.062],
  ['CriticalDamageBase', 0.064, 0.128],
  ['AttackAddedRatio', 0.058, 0.116],
  ['SpeedDelta', 2, 5],
  ['AttackDelta', 14, 33],
  ['{ELE}AddedRatio', 0.032, 0.064],
  ['StatusProbabilityBase', 0.034, 0.068],
  ['StatusResistanceBase', 0.034, 0.068],
  ['SPRatioBase', 0.026, 0.052],
  ['{ELE}ResistancePenetration', 0.04, 0.1],
  ['DmgRatio', 0.1, 0.24],
  ['Normal_DmgRatio', 0.08, 0.2],
  ['Ultra_CriticalDamageBase', 0.1, 0.24],
  ['BPSkill_CriticalChance', 0.06, 0.12],
  ['HPAddedRatio', 0.058, 0.116],
  ['DefenceAddedRatio', 0.058, 0.116]
]
// 六件遗器主词条（引擎只按 tag 累加，值取常见满级量级）
const MAIN_AFFIXES = [
  ['AttackDelta', 352.8],
  ['CriticalDamageBase', 0.648],
  ['CriticalChanceBase', 0.324],
  ['{ELE}AddedRatio', 0.389],
  ['SpeedDelta', 25.0],
  ['HPAddedRatio', 0.432]
]
// 光锥轮换（Equipment.json + effect/weapon.js 钩子覆盖），0 = 不带光锥
const WEAPON_CYCLE = [
  { id: 23001, rank: 5 }, { id: 21010, rank: 1 }, { id: 20007, rank: 3 },
  { id: 20014, rank: 2 }, { id: 21024, rank: 4 }, { id: 0, rank: 1 }
]
const RANK_CYCLE = [0, 6, 1, 2, 4]
const SECOND_SET_CYCLE = ['114', '301', '305', '306']

// 简单确定性 LCG，保证每次运行输入完全一致（跨引擎改动前后比对的前提）
function lcg (seed) {
  let s = (seed * 2654435761) >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}
const round4 = v => Math.round(v * 10000) / 10000

function makeRelics (avatarId, element, variant) {
  const rand = lcg(avatarId * 1000 + variant * 17)
  const relics = []
  for (let i = 0; i < 6; i++) {
    const main = MAIN_AFFIXES[(avatarId + variant + i) % MAIN_AFFIXES.length]
    const mainTag = main[0].replace('{ELE}', element)
    const subCount = 2 + Math.floor(rand() * 3)
    const subAffix = []
    for (let j = 0; j < subCount; j++) {
      const [tag, lo, hi] = SUBSTAT_POOL[Math.floor(rand() * SUBSTAT_POOL.length)]
      subAffix.push({
        tag: tag.replace('{ELE}', element),
        value: round4(lo + rand() * (hi - lo))
      })
    }
    relics.push({
      id: 61000 + ((avatarId + variant * 7 + i) % 20),
      main_affix_tag: mainTag,
      main_affix_value: round4(main[1]),
      sub_affix_id: subAffix
    })
  }
  return relics
}

function makeRegressionCase (avatarId, variant) {
  const element = CHAR_ELEMENT[avatarId]
  const rand = lcg(avatarId * 77 + variant * 31)
  const ranks = RANK_CYCLE[variant % RANK_CYCLE.length]
  // 技能等级：普攻数组最短 8 级，其余最短 15 级
  const basic = 1 + Math.floor(rand() * 8)
  const skill = 1 + Math.floor(rand() * 12)
  const ultimate = 1 + Math.floor(rand() * 12)
  const talent = 1 + Math.floor(rand() * 12)
  return {
    avatarId,
    name: '回归' + avatarId,
    level: 80,
    rank: ranks,
    damage_type: element,
    properties: {
      hpBase: 1000 + (avatarId % 97),
      attackBase: 600 + (avatarId % 53),
      defenseBase: 400 + (avatarId % 41),
      speedBase: 95 + (avatarId % 21)
    },
    relics: makeRelics(avatarId, element, variant),
    equipment: WEAPON_CYCLE[(avatarId + variant) % WEAPON_CYCLE.length],
    relic_sets: [
      { set_id: ELEMENT_SET[element], set_name: '4件套' },
      { set_id: SECOND_SET_CYCLE[variant % SECOND_SET_CYCLE.length], set_name: '2件套' }
    ],
    skillTree: [], // 由 runRegression 按角色行迹节点填充
    behaviorList: [basic, skill, ultimate, talent, 1].map((lv, i) => ({
      id: avatarId * 1000 + i + 1,
      level: lv
    }))
  }
}

function runRegression () {
  const results = {}
  for (const id of Object.keys(CHAR_ELEMENT)) {
    for (let variant = 0; variant < 3; variant++) {
      const charinfo = makeRegressionCase(Number(id), variant)
      // 行迹加成节点：从 character.json 找有属性的前若干个节点，置于 level 1
      // （get_attribute_bonus 按 behavior.level == 1 且节点有 properties 采集）
      const nodes = Object.keys(charDict(id))
      charinfo.skillTree = nodes
        .map(nid => {
          const props = charDict(id)[nid].levels[0].properties
          return props && props[0] ? { id: nid, level: 1 } : null
        })
        .filter(Boolean)
        .slice(0, 4 + (Number(id) % 5))
      // 注：1112（托帕）的 SkillData 存在既有数据缺陷——skillList.Normal/Talent 的
      // 倍率数组指向不存在的 "Talent"（1112 只有 Talent1），damage() 会抛错。
      // 这里记录 thrown 状态，保证改动前后该行为也一致（缺陷本身另行修复，不属本脚本职责）。
      let ret
      try {
        ret = damage(charinfo)
      } catch (e) {
        ret = { thrown: String(e && e.message) }
      }
      if (!ret) {
        fail(`回归 ${id}-v${variant}：damage() 返回 null`)
        continue
      }
      results[`${id}-v${variant}`] = ret
    }
  }
  return results
}

// 惰性读取 character.json（引擎 data.js 已加载同一份，这里独立读取避免污染引擎模块）
const require = createRequire(import.meta.url)
const characterJson = require(path.join(pluginDir, 'utils/damage/json/character.json'))
const charDict = id => characterJson[String(id)]

/* ========== 二、回归基线保存 / 比对 ========== */

function saveBaseline (results) {
  fs.writeFileSync(
    BASELINE_FILE,
    JSON.stringify({ savedAt: new Date().toISOString(), node: process.version, results }, null, 2),
    'utf8'
  )
  console.log(`回归基线已保存：${BASELINE_FILE}（${Object.keys(results).length} 个用例）`)
}

function compareBaseline (results) {
  if (!fs.existsSync(BASELINE_FILE)) {
    console.log('未找到回归基线（可先运行 node tools/test-damage.js --save 生成），跳过回归比对')
    return
  }
  const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')).results
  const baseKeys = Object.keys(baseline)
  const newKeys = Object.keys(results)
  let diffCount = 0
  for (const key of baseKeys) {
    if (!(key in results)) {
      fail(`回归 ${key}：改动后缺失该用例`)
      diffCount++
      continue
    }
    const b = JSON.stringify(baseline[key])
    const n = JSON.stringify(results[key])
    if (b !== n) {
      diffCount++
      if (baseline[key].thrown || results[key].thrown) {
        fail(`回归 ${key}：抛错行为变化\n         基线: ${b}\n         现在: ${n}`)
        continue
      }
      const bd = baseline[key].damage
      const nd = results[key].damage
      for (let i = 0; i < Math.max(bd.length, nd.length); i++) {
        const bs = bd[i] && JSON.stringify(bd[i])
        const ns = nd[i] && JSON.stringify(nd[i])
        if (bs !== ns) {
          fail(`回归 ${key} 第 ${i} 项不一致\n         基线: ${bs}\n         现在: ${ns}`)
        }
      }
    }
  }
  for (const key of newKeys) {
    if (!(key in baseline)) {
      fail(`回归 ${key}：改动后多出该用例`)
      diffCount++
    }
  }
  if (diffCount === 0) {
    pass(`回归：${baseKeys.length} 个用例（14 名 1.3 角色 x 3 变体）输出与基线逐字段一致`)
  } else {
    fail(`回归：${diffCount} 个用例与基线不一致`)
  }
}

/* ========== 三、欢愉（elation）冒烟 ========== */

// 欢愉倍率数组与技能位注入：C16 落地欢愉角色时等价于在 SkillData.json 写入以下条目
//   "Xe":  [1.2, 1.44, 1.68],
//   "Xe2": [3.0, 3.15, 3.3],
//   "skillList": {
//     ..., "Xe": ["elation", "欢愉技", 1, "Xe"], "Xe2": ["elation", "强化欢愉技", 3, "Xe2"]
//   }
// 此处向内存中的 skilldict 注入，用于验证引擎通路（不改动 json 文件）。
function injectXe () {
  skilldict['1102'].Xe = [1.2, 1.44, 1.68]
  skilldict['1102'].Xe2 = [3.0, 3.15, 3.3]
  skilldict['1102'].skillList.Xe = ['elation', '欢愉技', 1, 'Xe']
  skilldict['1102'].skillList.Xe2 = ['elation', '强化欢愉技', 3, 'Xe2']
}

// 冒烟用 1102（希儿）合成输入：rank 0、无光锥、无套装、无行迹
// behaviorList 第 6 项为欢愉技条目（ID 规律：角色ID x 1000 + 420，强化欢愉技 +421）
function elationChar (relics, xeLevel, xe2Level) {
  const behaviorList = [6, 10, 10, 9, 1].map((lv, i) => ({
    id: 1102 * 1000 + i + 1,
    level: lv
  }))
  behaviorList.push({ id: 1102 * 1000 + 420, level: xeLevel })
  if (xe2Level) {
    behaviorList.push({ id: 1102 * 1000 + 421, level: xe2Level })
  }
  return {
    avatarId: 1102,
    name: '希儿(欢愉冒烟)',
    level: 80,
    rank: 0,
    damage_type: 'Quantum',
    properties: { hpBase: 1280.7, attackBase: 640.3, defenseBase: 485.1, speedBase: 102.5 },
    relics,
    equipment: { id: 0, rank: 1 },
    relic_sets: [],
    skillTree: [],
    behaviorList
  }
}

function findSkill (result, title) {
  return result.damage.find(d => d.title === title)
}

function closeTo (actual, expected, label) {
  const rel = Math.abs(actual - expected) / Math.abs(expected)
  if (rel < REL_TOL) {
    pass(`${label}：引擎 ${actual.toFixed(4)} vs 手算 ${expected.toFixed(4)}（相对误差 ${(rel * 100).toPrecision(3)}%）`)
  } else {
    fail(`${label}：引擎 ${actual} vs 手算 ${expected}（相对误差 ${(rel * 100).toPrecision(3)}%，超过 0.01%）`)
  }
}

function runElationSmoke () {
  injectXe()

  // ---- 用例 A：裸欢愉技（无任何欢愉词条）----
  // 输入：Lv80 1102 rank0，Xe 等级 3（倍率 1.68，1 段），无遗器/光锥/套装/行迹
  // 手算（引擎各乘区）：
  //   欢愉基础伤害(Lv80) = 7535.11（= 击破基础伤害 3767.55 x 2，miao DmgCalcMeta 表）
  //   欢愉度区 joy_num   = 1 + 0/100 = 1        （无 joy 词条）
  //   增笑区 merrymakes  = 1 + 0/100 = 1        （无 merrymakes 词条）
  //   笑点系数 punchline = 1 + 5x0/(0+240) = 1  （P = 0）
  //   抗性区             = 1 + 0.2 = 1.2        （avatar 1102 钩子：量子无视抗性 +0.2）
  //   防御区             = 1000/(1000+1000) = 0.5  （等级 80：80x10+200=1000，无无视防御）
  //   易伤区             = 1                     （无 DmgRatio/xeEnemydmg 词条）
  //   暴击区             = 暴击 1+0.5=1.5；期望 1+0.05x0.5=1.025（基础 5%/50%）
  //   减伤区             = 0.9                   （韧性未击破通用减伤）
  //   注意：avatar 1102 钩子提供的 AllDamageAddedRatio（天赋倍率 0.75）与攻击力均【不参与】欢愉公式
  // 暴击伤害 = 7535.11 x 1.68 x 1 x 1 x 1 x 1 x 0.5 x 1.2 x 0.9 x 1.5
  //          = 12658.9848 x 0.5 = 6329.4924 -> x1.2 = 7595.39088 -> x0.9 = 6835.851792 -> x1.5 = 10253.777688
  // 期望伤害 = 7535.11 x 1.68 x 1.025 x 0.5 x 1.2 x 0.9
  //          = 12658.9848 x 1.025 = 12975.45942 -> x0.5 = 6487.72971 -> x1.2 = 7785.275652 -> x0.9 = 7006.7480868
  const caseA = damage(elationChar([], 3))
  const xeA = findSkill(caseA, '欢愉技')
  if (!xeA) {
    fail('用例 A：未找到欢愉技条目（elation 分支未生效）')
  } else {
    closeTo(xeA.value.critical, 10253.777688, '用例 A 暴击伤害')
    closeTo(xeA.value.expect, 7006.7480868, '用例 A 期望伤害')
  }

  // ---- 用例 B：全词条欢愉技（欢愉度/增笑/笑点/无视防御/欢愉易伤，经遗器副词条注入）----
  // 输入：同上，遗器 1 件，副词条：
  //   joy=36, joyPlus=10, joyPct=4（合计欢愉度 50%），merrymakes=20（增笑 20%），
  //   punchline=50（笑点 50），xeIgnore=10（欢愉无视防御 10%），xeEnemydmg=12（欢愉易伤 12%），
  //   CriticalChanceBase=0.25, CriticalDamageBase=0.30, QuantumResistancePenetration=0.10
  // 手算（引擎各乘区）：
  //   欢愉度区 = 1 + (36+10+4)/100 = 1.5
  //   增笑区   = 1 + 20/100 = 1.2
  //   笑点系数 = 1 + 5x50/(50+240) = 1 + 250/290 = 1.8620689655172413
  //   抗性区   = 1 + 0.2(角色钩子) + 0.10(副词条) = 1.3
  //   防御区   = 无视 10% -> 敌方防御 1000x0.9=900，1000/(1000+900) = 0.5263157894736842
  //   易伤区   = 1 + 12/100 = 1.12
  //   暴击区   = 暴击率 0.05+0.25=0.30，爆伤 0.5+0.30=0.80 -> 暴击 1.8；期望 1+0.30x0.80=1.24
  // 暴击伤害 = 7535.11 x 1.68 x 1.5 x 1.2 x 1.8620689655172413 x 1.12 x 0.5263157894736842 x 1.3 x 0.9 x 1.8
  //   分步：  12658.9848 x 1.5 = 18988.4772
  //         x 1.2             = 22786.17264
  //         x 1.8620689655... = 42429.424913
  //         x 1.12            = 47520.955902
  //         x 0.5263157894... = 25011.029422   (即 x 10/19)
  //         x 1.3             = 32514.338249
  //         x 0.9             = 29262.904424
  //         x 1.8             = 52673.227963
  // 期望伤害 = 29262.904424 x 1.24 = 36286.001486
  const joyRelic = {
    id: 61011,
    main_affix_tag: 'HPDelta',
    main_affix_value: 705.6,
    sub_affix_id: [
      { tag: 'joy', value: 36 },
      { tag: 'joyPlus', value: 10 },
      { tag: 'joyPct', value: 4 },
      { tag: 'merrymakes', value: 20 },
      { tag: 'punchline', value: 50 },
      { tag: 'xeIgnore', value: 10 },
      { tag: 'xeEnemydmg', value: 12 },
      { tag: 'CriticalChanceBase', value: 0.25 },
      { tag: 'CriticalDamageBase', value: 0.3 },
      { tag: 'QuantumResistancePenetration', value: 0.1 }
    ]
  }
  const caseB = damage(elationChar([joyRelic], 3))
  const xeB = findSkill(caseB, '欢愉技')
  if (!xeB) {
    fail('用例 B：未找到欢愉技条目')
  } else {
    closeTo(xeB.value.critical, 52673.227963, '用例 B 暴击伤害')
    closeTo(xeB.value.expect, 36286.001486, '用例 B 期望伤害')
  }

  // ---- 用例 C：强化欢愉技（Xe2，3 段）+ 笑点 80 ----
  // 输入：Xe2 等级 2（倍率数组 [3.0,3.15,3.3] 取 3.15，3 段 -> 每段 1.05），
  //       遗器 1 件：punchline=80
  // 手算：
  //   笑点系数 = 1 + 5x80/(80+240) = 1 + 400/320 = 2.25
  //   其余同用例 A（欢愉度/增笑/易伤/无视防御均无）
  // 每段暴击 = 7535.11 x 1.05 x 2.25 x 0.5 x 1.2 x 0.9 x 1.5
  //          = 7911.8655 x 2.25 = 17801.697375 -> x0.5 = 8900.8486875
  //          -> x1.2 = 10681.018425 -> x0.9 = 9612.9165825 -> x1.5 = 14419.37487375
  // 总暴击（3 段） = 43258.12462125
  // 每段期望 = 9612.9165825 x 1.025 = 9853.2394970625，总期望 = 29559.7184911875
  const punchlineRelic = {
    id: 61012,
    main_affix_tag: 'HPDelta',
    main_affix_value: 705.6,
    sub_affix_id: [{ tag: 'punchline', value: 80 }]
  }
  const caseC = damage(elationChar([punchlineRelic], 3, 2))
  const xe2C = findSkill(caseC, '强化欢愉技')
  if (!xe2C) {
    fail('用例 C：未找到强化欢愉技条目')
  } else {
    closeTo(xe2C.value.critical, 43258.12462125, '用例 C 暴击伤害（3 段合计）')
    closeTo(xe2C.value.expect, 29559.7184911875, '用例 C 期望伤害（3 段合计）')
  }

  // ---- 旧路径零影响验证：欢愉词条不改变普攻/战技/终结技输出 ----
  // 同一面板，去掉 joy/joyPlus/joyPct/merrymakes/punchline/xeIgnore/xeEnemydmg 副词条后，
  // Normal/BPSkill/Ultra 三个旧技能的输出必须与带欢愉词条时完全一致。
  const plainRelic = {
    id: 61011,
    main_affix_tag: 'HPDelta',
    main_affix_value: 705.6,
    sub_affix_id: [
      { tag: 'CriticalChanceBase', value: 0.25 },
      { tag: 'CriticalDamageBase', value: 0.3 },
      { tag: 'QuantumResistancePenetration', value: 0.1 }
    ]
  }
  const withJoy = damage(elationChar([joyRelic], 3))
  const withoutJoy = damage(elationChar([plainRelic], 3))
  let invariant = true
  for (const title of ['普攻', '战技', '终结技']) {
    const a = findSkill(withJoy, title)
    const b = findSkill(withoutJoy, title)
    if (!a || !b) {
      fail(`旧路径零影响：缺少 ${title} 条目`)
      invariant = false
    } else if (JSON.stringify(a) !== JSON.stringify(b)) {
      fail(`旧路径零影响：${title} 输出被欢愉词条改变\n         带: ${JSON.stringify(a)}\n         去: ${JSON.stringify(b)}`)
      invariant = false
    }
  }
  if (invariant) {
    pass('旧路径零影响：普攻/战技/终结技输出在有无欢愉词条时逐字段一致')
  }
}

/* ========== 四、忆灵技/忆灵天赋（me/mt）冒烟 ========== */

// 忆灵倍率数组与技能位注入：W3-E 落地记忆命途角色时等价于在 SkillData.json 写入以下条目
//   "Me":  [0.55, 0.66, 0.77, 0.88, 0.99, 1.1, 1.21],  // 取自阿格莱雅「刺纹之陷」表 1（7 级）
//   "Mt":  [0.5, 0.6, 0.7],                            // 合成短数组（3 级），用于验证越界收敛
//   "skillList": {
//     ..., "Me": ["attack", "忆灵技", 1, "Me"], "Mt": ["attack", "忆灵天赋", 2, "Mt"]
//   }
// 忆灵技/忆灵天赋走常规攻击力伤害分支（skillList 第 0 位 'attack'），仅倍率数组与等级来源不同；
// 等级从 behaviorList 中按技能 ID 匹配（忆灵技 ID 规律：角色ID x 1000 + 301，忆灵天赋 +302）。
// 此处向内存中的 skilldict 注入，用于验证引擎通路（不改动 json 文件）。
function injectMe () {
  skilldict['1102'].Me = [0.55, 0.66, 0.77, 0.88, 0.99, 1.1, 1.21]
  skilldict['1102'].Mt = [0.5, 0.6, 0.7]
  skilldict['1102'].skillList.Me = ['attack', '忆灵技', 1, 'Me']
  skilldict['1102'].skillList.Mt = ['attack', '忆灵天赋', 2, 'Mt']
}

// 冒烟用 1102（希儿）合成输入：rank 0、无光锥、无套装、无行迹
// behaviorList 追加忆灵技/忆灵天赋条目（ID 规律：角色ID x 1000 + 301 / +302）
function memoChar (meLevel, mtLevel) {
  const behaviorList = [6, 10, 10, 9, 1].map((lv, i) => ({
    id: 1102 * 1000 + i + 1,
    level: lv
  }))
  if (meLevel) {
    behaviorList.push({ id: 1102 * 1000 + 301, level: meLevel })
  }
  if (mtLevel) {
    behaviorList.push({ id: 1102 * 1000 + 302, level: mtLevel })
  }
  return {
    avatarId: 1102,
    name: '希儿(忆灵冒烟)',
    level: 80,
    rank: 0,
    damage_type: 'Quantum',
    properties: { hpBase: 1280.7, attackBase: 640.3, defenseBase: 485.1, speedBase: 102.5 },
    relics: [],
    equipment: { id: 0, rank: 1 },
    relic_sets: [],
    skillTree: [],
    behaviorList
  }
}

// 1102 裸面板各乘区（me/mt 与普攻共用）：
//   攻击力   = 640.3（无遗器/光锥加成）
//   增伤区   = 1 + 0.75（avatar 1102 钩子：AllDamageAddedRatio = 天赋 9 级倍率 0.75）= 1.75
//   易伤区   = 1
//   防御区   = 1000/(1000+1000) = 0.5（Lv80，无无视防御）
//   抗性区   = 1 + 0.2（avatar 1102 钩子：量子无视抗性 0.2）= 1.2
//   减伤区   = 0.9
//   暴击区   = 暴击 1+0.5=1.5；期望 1+0.05x0.5=1.025（基础 5%/50%）
//   速度区   = avatar 1102 钩子 SpeedAddedRatio +0.25（rank<2），不影响伤害
function runMemoSmoke () {
  injectMe()

  // ---- 用例 D：忆灵技（Me，等级 5 -> 倍率 0.99，1 段）----
  // 暴击伤害 = 640.3 x 0.99 x 1.75 x 0.5 x 1.2 x 0.9 x 1.5
  //          = 633.897 -> 1109.31975 -> 554.659875 -> 665.59185 -> 599.032665 -> 898.5489975
  // 期望伤害 = 599.032665 x 1.025 = 614.008481625
  const caseD = damage(memoChar(5))
  const meD = findSkill(caseD, '忆灵技')
  if (!meD) {
    fail('用例 D：未找到忆灵技条目（me 技能位未生效）')
  } else {
    closeTo(meD.value.critical, 898.5489975, '用例 D 忆灵技暴击伤害')
    closeTo(meD.value.expect, 614.008481625, '用例 D 忆灵技期望伤害')
  }

  // ---- 用例 D2：behaviorList 无忆灵技条目时回落默认 1 级（倍率 0.55）----
  // 暴击伤害 = 640.3 x 0.55 x 1.75 x 0.5 x 1.2 x 0.9 x 1.5 = 499.1938875
  // 期望伤害 = 332.795925 x 1.025 = 341.115823125
  const caseD2 = damage(memoChar(0, 0))
  const meD2 = findSkill(caseD2, '忆灵技')
  if (!meD2) {
    fail('用例 D2：未找到忆灵技条目')
  } else {
    closeTo(meD2.value.critical, 499.1938875, '用例 D2 忆灵技默认 1 级暴击伤害')
    closeTo(meD2.value.expect, 341.115823125, '用例 D2 忆灵技默认 1 级期望伤害')
  }

  // ---- 用例 E：忆灵天赋（Mt，等级 6 超出 3 级数组 -> 收敛末位 0.7，2 段）----
  // 每段倍率 = 0.7/2 = 0.35
  // 每段暴击 = 640.3 x 0.35 x 1.75 x 0.5 x 1.2 x 0.9 x 1.5
  //          = 224.105 -> 392.18375 -> 196.091875 -> 235.31025 -> 211.779225 -> 317.6688375
  // 总暴击（2 段） = 635.337675；总期望 = 211.779225 x 1.025 x 2 = 434.14741125
  const caseE = damage(memoChar(5, 6))
  const mtE = findSkill(caseE, '忆灵天赋')
  if (!mtE) {
    fail('用例 E：未找到忆灵天赋条目（mt 技能位未生效）')
  } else {
    closeTo(mtE.value.critical, 635.337675, '用例 E 忆灵天赋暴击伤害（2 段合计，等级越界收敛）')
    closeTo(mtE.value.expect, 434.14741125, '用例 E 忆灵天赋期望伤害（2 段合计，等级越界收敛）')
  }

  // ---- 用例 F：忆灵技等级 8（模拟星魂加等级后超出 7 级数组 -> 收敛末位 1.21）----
  // 暴击伤害 = 640.3 x 1.21 x 1.75 x 0.5 x 1.2 x 0.9 x 1.5
  //          = 774.763 -> 1355.83525 -> 677.917625 -> 813.50115 -> 732.151035 -> 1098.2265525
  // 期望伤害 = 732.151035 x 1.025 = 750.454810875
  const caseF = damage(memoChar(8))
  const meF = findSkill(caseF, '忆灵技')
  if (!meF) {
    fail('用例 F：未找到忆灵技条目')
  } else {
    closeTo(meF.value.critical, 1098.2265525, '用例 F 忆灵技等级越界收敛暴击伤害')
    closeTo(meF.value.expect, 750.454810875, '用例 F 忆灵技等级越界收敛期望伤害')
  }

  // ---- 旧路径零影响验证：追加忆灵条目不改变普攻/战技/终结技输出 ----
  // 忆灵技/忆灵天赋条目（301/302）追加在 behaviorList 末尾，旧技能按前 4 项索引取等级，不受影响。
  const withMemo = damage(memoChar(5, 6))
  const withoutMemo = damage(memoChar(0, 0))
  let invariant = true
  for (const title of ['普攻', '战技', '终结技']) {
    const a = findSkill(withMemo, title)
    const b = findSkill(withoutMemo, title)
    if (!a || !b) {
      fail(`忆灵旧路径零影响：缺少 ${title} 条目`)
      invariant = false
    } else if (JSON.stringify(a) !== JSON.stringify(b)) {
      fail(`忆灵旧路径零影响：${title} 输出被忆灵条目改变\n         带: ${JSON.stringify(a)}\n         去: ${JSON.stringify(b)}`)
      invariant = false
    }
  }
  if (invariant) {
    pass('忆灵旧路径零影响：普攻/战技/终结技输出在有无忆灵条目时逐字段一致')
  }
}

/* ========== 入口 ========== */

const saveMode = process.argv.includes('--save')
console.log(`StarRail-plugin 伤害引擎测试（cwd: ${process.cwd()}）`)
if (saveMode) {
  console.log('\n[1/1] 生成回归基线（仅现有 1.3 角色，不含欢愉/忆灵冒烟）')
  saveBaseline(runRegression())
} else {
  console.log('\n[1/3] 回归：现有 1.3 角色')
  const results = runRegression()
  compareBaseline(results)
  console.log('\n[2/3] 欢愉（elation）冒烟：手算对照')
  runElationSmoke()
  console.log('\n[3/3] 忆灵技/忆灵天赋（me/mt）冒烟：手算对照')
  runMemoSmoke()
}

console.log('')
if (failed > 0) {
  console.log(`结果：${failed} 项失败`)
  process.exit(1)
}
console.log('结果：全部通过')
