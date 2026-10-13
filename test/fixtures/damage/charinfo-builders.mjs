/**
 * 伤害引擎测试的合成面板（charinfo）构造器 —— 全部为虚构数据，禁止混入真实用户数据
 *
 * charinfo 形状同 apps/panel.js 缓存的第三方 API 面板数据（avatarId/properties/relics/
 * equipment/relic_sets/skillTree/behaviorList）。用确定性 LCG 生成，跨运行完全一致
 * （回归基线前后比对的前提）。
 * tools/test-damage.js（基线再生成）与 test/utils/damage/*.test.js 共用本文件，
 * 保证开发流程与提交基线的输入为同一来源。
 *
 * 行迹节点属性读取自仓库 utils/damage/json/character.json（游戏静态数据，非用户数据）。
 */
import fs from 'node:fs'

/* ========== 一、回归基线组：SkillData 现有 14 名 1.3 角色 × 3 变体 ========== */

// 各角色属性（与 resources/panel/data/character.json 一致）
export const CHAR_ELEMENT = {
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

// 仓库静态行迹表（引擎 data.js 加载同一份，这里独立读取避免污染引擎模块）
const characterJson = JSON.parse(fs.readFileSync(
  new URL('../../../utils/damage/json/character.json', import.meta.url), 'utf8'))

/**
 * 回归用合成面板：14 名 1.3 角色 × 3 变体（与 test/fixtures/damage/baseline.json 的
 * 键 `${avatarId}-v${variant}` 一一对应）
 */
export function makeRegressionCase (avatarId, variant) {
  const element = CHAR_ELEMENT[avatarId]
  const rand = lcg(avatarId * 77 + variant * 31)
  const ranks = RANK_CYCLE[variant % RANK_CYCLE.length]
  // 技能等级：普攻数组最短 8 级，其余最短 15 级
  const basic = 1 + Math.floor(rand() * 8)
  const skill = 1 + Math.floor(rand() * 12)
  const ultimate = 1 + Math.floor(rand() * 12)
  const talent = 1 + Math.floor(rand() * 12)
  const charinfo = {
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
    skillTree: [],
    behaviorList: [basic, skill, ultimate, talent, 1].map((lv, i) => ({
      id: avatarId * 1000 + i + 1,
      level: lv
    }))
  }
  // 行迹加成节点：从 character.json 找有属性的前若干个节点，置于 level 1
  // （get_attribute_bonus 按 behavior.level == 1 且节点有 properties 采集）
  const nodes = Object.keys(characterJson[String(avatarId)])
  charinfo.skillTree = nodes
    .map(nid => {
      const props = characterJson[String(avatarId)][nid].levels[0].properties
      return props && props[0] ? { id: nid, level: 1 } : null
    })
    .filter(Boolean)
    .slice(0, 4 + (avatarId % 5))
  return charinfo
}

/* ========== 二、冒烟组：1102（希儿）合成面板（欢愉/忆灵/光锥遗器用例输入） ========== */

// 基础技能条目（普攻6/战技10/终结技10/天赋9/秘技1），后续用例在其上追加槽位条目
const baseBehavior = () => [6, 10, 10, 9, 1].map((lv, i) => ({
  id: 1102 * 1000 + i + 1,
  level: lv
}))
const SHELL_1102 = {
  avatarId: 1102,
  level: 80,
  rank: 0,
  damage_type: 'Quantum',
  properties: { hpBase: 1280.7, attackBase: 640.3, defenseBase: 485.1, speedBase: 102.5 },
  equipment: { id: 0, rank: 1 },
  relic_sets: [],
  skillTree: []
}

// 欢愉冒烟面板：behaviorList 第 6 项为欢愉技条目（ID 规律：角色ID x 1000 + 420，强化欢愉技 +421）
export function elationChar (relics, xeLevel, xe2Level) {
  const behaviorList = baseBehavior()
  behaviorList.push({ id: 1102 * 1000 + 420, level: xeLevel })
  if (xe2Level) {
    behaviorList.push({ id: 1102 * 1000 + 421, level: xe2Level })
  }
  return { ...SHELL_1102, name: '希儿(欢愉冒烟)', relics, behaviorList }
}

// 忆灵冒烟面板：behaviorList 追加忆灵技/忆灵天赋条目（ID 规律：角色ID x 1000 + 301 / +302）
export function memoChar (meLevel, mtLevel) {
  const behaviorList = baseBehavior()
  if (meLevel) {
    behaviorList.push({ id: 1102 * 1000 + 301, level: meLevel })
  }
  if (mtLevel) {
    behaviorList.push({ id: 1102 * 1000 + 302, level: mtLevel })
  }
  return { ...SHELL_1102, name: '希儿(忆灵冒烟)', relics: [], behaviorList }
}

// 光锥/套装增益冒烟面板：Xe 固定 3 级（倍率 1.68，1 段），rank 0、无行迹
export function gearChar ({ relics = [], equipment = { id: 0, rank: 1 }, relic_sets = [] } = {}) {
  const behaviorList = baseBehavior()
  behaviorList.push({ id: 1102 * 1000 + 420, level: 3 })
  return { ...SHELL_1102, name: '希儿(增益冒烟)', relics, equipment, relic_sets, behaviorList }
}
