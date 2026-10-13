/**
 * 批次1 · 4.x 常规限定角色（8 个）伤害数据抽查
 *
 * 手算对照数值锚点为 miao-plugin resources/meta-sr/character/{角色}/data.json
 * talent 表的独立快照（本文件硬编码，测试不依赖 miao-plugin 在场）；
 * 推导过程见各 test 内注释；面板输入全部合成自建（遗器/行迹等级为虚构组合）。
 *
 * 覆盖：
 *   - 8 角色 rank0/rank6 手算对照（暴击与期望双口径，核心输出行）
 *   - 全伤害行完备性（有限正数、期望 ≤ 暴击、行数 = skillList 条目数）
 *   - SkillData 覆盖检查（数组长度覆盖星魂+2 后等级）
 *   - 钩子状态：倍率数组改写幂等（多次计算不累积）、命途切换正确回退
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { damage, skilldict } from './engine.mjs'

const REL_TOL = 1e-7 // 手算与引擎均为十进制精确口径（组装数组经 round10 消浮点噪声）
function closeTo (actual, expected, label) {
  const rel = Math.abs(actual - expected) / Math.abs(expected)
  assert.ok(rel < REL_TOL,
    `${label}：引擎 ${actual} vs 手算 ${expected}（相对误差 ${(rel * 100).toExponential(3)}%，超过 1e-7）`)
}
const rowsOf = ret => Object.fromEntries(ret.damage.map(r => [r.title, r.value]))
const at = (arr, lv) => arr[Math.min(lv, arr.length) - 1] // 与引擎 getskilllevelnum 越界收敛一致

/* ============================================================
 * 数值锚点：miao-plugin talent 表快照（2026-10 提取，独立于 SkillData.json）
 * ============================================================ */
// 不死途（a 普攻 / e 战技+额外 / q 终结技+额外 / t 追加攻击）
const BUSITU = {
  aDmg: [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4],
  eDmg: [1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.625, 1.75, 1.875, 2, 2.1, 2.2, 2.3, 2.4, 2.5],
  eExtra: [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8125, 0.875, 0.9375, 1, 1.05, 1.1, 1.15, 1.2, 1.25],
  qDmg: [2, 2.2, 2.4, 2.6, 2.8, 3, 3.25, 3.5, 3.75, 4, 4.2, 4.4, 4.6, 4.8, 5],
  qExtra: [1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.625, 1.75, 1.875, 2, 2.1, 2.2, 2.3, 2.4, 2.5],
  tAppend: [1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.625, 1.75, 1.875, 2, 2.1, 2.2, 2.3, 2.4, 2.5]
}
// 千冶•刃（a / e 技能+弹射 / q2 终结技 / q 防御降低·易伤·暴伤表）
const QIANYE = {
  aDmg: [0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7],
  eDmg: [0.36, 0.396, 0.432, 0.468, 0.504, 0.54, 0.585, 0.63, 0.675, 0.72, 0.756, 0.792, 0.828, 0.864, 0.9],
  eBounce: [0.12, 0.132, 0.144, 0.156, 0.168, 0.18, 0.195, 0.21, 0.225, 0.24, 0.252, 0.264, 0.276, 0.288, 0.3],
  q2Dmg: [2.1, 2.24, 2.38, 2.52, 2.66, 2.8, 2.975, 3.15, 3.325, 3.5, 3.64, 3.78, 3.92, 4.06, 4.2],
  qDefDown: [0.2, 0.21, 0.22, 0.23, 0.24, 0.25, 0.2625, 0.275, 0.2875, 0.3, 0.31, 0.32, 0.33, 0.34, 0.35],
  qEnemyDmg: [0.3, 0.32, 0.34, 0.36, 0.38, 0.4, 0.425, 0.45, 0.475, 0.5, 0.52, 0.54, 0.56, 0.58, 0.6],
  qCdmg: [0.3, 0.33, 0.36, 0.39, 0.42, 0.45, 0.4875, 0.525, 0.5625, 0.6, 0.63, 0.66, 0.69, 0.72, 0.75]
}
// 姬子•启行（a / q 弹射 / q2 技能 / q3 群体+弹射 / t2 群体+弹射）
const JIZI = {
  aDmg: [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4],
  qBounce: [0.4, 0.44, 0.48, 0.52, 0.56, 0.6, 0.65, 0.7, 0.75, 0.8, 0.84, 0.88, 0.92, 0.96, 1],
  q2Dmg: [0.16, 0.176, 0.192, 0.208, 0.224, 0.24, 0.26, 0.28, 0.3, 0.32, 0.336, 0.352, 0.368, 0.384, 0.4],
  q3Aoe: [0.1, 0.11, 0.12, 0.13, 0.14, 0.15, 0.1625, 0.175, 0.1875, 0.2, 0.21, 0.22, 0.23, 0.24, 0.25],
  q3Bounce: [0.15, 0.165, 0.18, 0.195, 0.21, 0.225, 0.24375, 0.2625, 0.28125, 0.3, 0.315, 0.33, 0.345, 0.36, 0.375],
  t2Aoe: [1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.625, 1.75, 1.875, 2, 2.1, 2.2, 2.3, 2.4, 2.5],
  t2Bounce: [0.18, 0.194, 0.208, 0.222, 0.236, 0.25, 0.2675, 0.285, 0.3025, 0.32, 0.334, 0.348, 0.362, 0.376, 0.39]
}
// 大丽花（e / q 技能+防御降低 / t 追加）
const DALIHUA = {
  eDmg: [0.8, 0.88, 0.96, 1.04, 1.12, 1.2, 1.3, 1.4, 1.5, 1.6, 1.68, 1.76, 1.84, 1.92, 2],
  qDmg: [1.8, 1.92, 2.04, 2.16, 2.28, 2.4, 2.55, 2.7, 2.85, 3, 3.12, 3.24, 3.36, 3.48, 3.6],
  qDefDown: [0.08, 0.09, 0.1, 0.11, 0.12, 0.13, 0.1425, 0.155, 0.1675, 0.18, 0.19, 0.2, 0.21, 0.22, 0.23],
  tAppend: [0.15, 0.165, 0.18, 0.195, 0.21, 0.225, 0.24375, 0.2625, 0.28125, 0.3, 0.315, 0.33, 0.345, 0.36, 0.375]
}
// 吉尔伽美什（a / e 单体 / q 群攻+弹射 / t2 合击）
const GILGAMESH = {
  aDmg: [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4],
  eSingle: [1.4, 1.54, 1.68, 1.82, 1.96, 2.1, 2.275, 2.45, 2.625, 2.8, 2.94, 3.08, 3.22, 3.36, 3.5],
  qAoe: [2, 2.2, 2.4, 2.6, 2.8, 3, 3.25, 3.5, 3.75, 4, 4.2, 4.4, 4.6, 4.8, 5],
  qBounce: [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8125, 0.875, 0.9375, 1, 1.05, 1.1, 1.15, 1.2, 1.25],
  t2Dmg: [2, 2.2, 2.4, 2.6, 2.8, 3, 3.25, 3.5, 3.75, 4, 4.2, 4.4, 4.6, 4.8, 5]
}
// 远坂凛（a / e2 强化战技群攻+弹射 / q 目标+群攻 / t2 合击）
const RIN = {
  aDmg: [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4],
  e2Aoe: [0.45, 0.495, 0.54, 0.585, 0.63, 0.675, 0.73125, 0.7875, 0.84375, 0.9, 0.945, 0.99, 1.035, 1.08, 1.125],
  e2Bounce: [0.45, 0.495, 0.54, 0.585, 0.63, 0.675, 0.73125, 0.7875, 0.84375, 0.9, 0.945, 0.99, 1.035, 1.08, 1.125],
  qTarget: [3, 3.3, 3.6, 3.9, 4.2, 4.5, 4.875, 5.25, 5.625, 6, 6.3, 6.6, 6.9, 7.2, 7.5],
  qAoe: [1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.625, 1.75, 1.875, 2, 2.1, 2.2, 2.3, 2.4, 2.5],
  t2Dmg: [1.5, 1.65, 1.8, 1.95, 2.1, 2.25, 2.4375, 2.625, 2.8125, 3, 3.15, 3.3, 3.45, 3.6, 3.75]
}
// Saber（a2 强化普攻技能+1目标 / e 技能 / q 技能+随机 / t 伤害提高）
const SABER = {
  a2Dmg: [0.75, 0.9, 1.05, 1.2, 1.35, 1.5, 1.65, 1.8, 1.95, 2.1],
  a2Single: [1.1, 1.32, 1.54, 1.76, 1.98, 2.2, 2.42, 2.64, 2.86, 3.08],
  eDmg: [0.75, 0.825, 0.9, 0.975, 1.05, 1.125, 1.21875, 1.3125, 1.40625, 1.5, 1.575, 1.65, 1.725, 1.8, 1.875],
  qDmg: [1.4, 1.54, 1.68, 1.82, 1.96, 2.1, 2.275, 2.45, 2.625, 2.8, 2.94, 3.08, 3.22, 3.36, 3.5],
  qRandom: [0.55, 0.605, 0.66, 0.715, 0.77, 0.825, 0.89375, 0.9625, 1.03125, 1.1, 1.155, 1.21, 1.265, 1.32, 1.375],
  tDmgUp: [0.3, 0.33, 0.36, 0.39, 0.42, 0.45, 0.4875, 0.525, 0.5625, 0.6, 0.63, 0.66, 0.69, 0.72, 0.75]
}
// Archer（a / e 技能+战技伤害提高 / q / t）
const ARCHER = {
  aDmg: [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3],
  eDmg: [1.8, 1.98, 2.16, 2.34, 2.52, 2.7, 2.925, 3.15, 3.375, 3.6, 3.78, 3.96, 4.14, 4.32, 4.5],
  eDmgUp: [0.6, 0.64, 0.68, 0.72, 0.76, 0.8, 0.85, 0.9, 0.95, 1, 1.04, 1.08, 1.12, 1.16, 1.2],
  qDmg: [6, 6.4, 6.8, 7.2, 7.6, 8, 8.5, 9, 9.5, 10, 10.4, 10.8, 11.2, 11.6, 12],
  tDmg: [1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.625, 1.75, 1.875, 2, 2.1, 2.2, 2.3, 2.4, 2.5]
}

/* ============================================================
 * 合成手算面板（无光锥/无套装；skillTree 为仓库 character.json 的行迹小节点，
 * 引擎按 levels[0].properties 采集，节点属性合计见各面板注释）
 * ============================================================ */
const minorNodes = (id) =>
  Array.from({ length: 10 }, (_, i) => ({ id: id * 1000 + 201 + i, level: 1 }))
const behavior = (id, [basicLv, skillLv, ultLv, talentLv]) =>
  [[1, basicLv], [2, skillLv], [3, ultLv], [4, talentLv], [7, 1]]
    .map(([n, level]) => ({ id: id * 1000 + n, level }))
// 共用遗器：攻击% 35.2 / 爆伤 64.8+14.8 / 暴击 32.4+10.1 / 生命% 43.2+7.7 /
// 速度 25+5 / 固定生命 224.8+1146.6 / 固定攻击 38.2（无属性伤害加成词条）
const RELICS = [
  { id: 61011, main_affix_tag: 'AttackAddedRatio', main_affix_value: 0.352, sub_affix_id: [{ tag: 'CriticalDamageBase', value: 0.148 }] },
  { id: 61012, main_affix_tag: 'CriticalDamageBase', main_affix_value: 0.648, sub_affix_id: [{ tag: 'CriticalChanceBase', value: 0.101 }] },
  { id: 61013, main_affix_tag: 'CriticalChanceBase', main_affix_value: 0.324, sub_affix_id: [{ tag: 'HPAddedRatio', value: 0.077 }] },
  { id: 61014, main_affix_tag: 'HPAddedRatio', main_affix_value: 0.432, sub_affix_id: [{ tag: 'SpeedDelta', value: 5 }] },
  { id: 61015, main_affix_tag: 'SpeedDelta', main_affix_value: 25, sub_affix_id: [{ tag: 'HPDelta', value: 224.8 }] },
  { id: 61016, main_affix_tag: 'HPDelta', main_affix_value: 1146.6, sub_affix_id: [{ tag: 'AttackDelta', value: 38.2 }] }
]
function panel (id, elem, props, rank, levels) {
  return {
    avatarId: id, name: '手算', level: 80, rank, damage_type: elem,
    properties: props, relics: RELICS,
    equipment: { id: 0, rank: 1 }, relic_sets: [],
    skillTree: minorNodes(id), behaviorList: behavior(id, levels)
  }
}
// miao data.json baseAttr（等级 80 突破 6 基础属性，round10）
const PROPS = {
  1014: { hpBase: 1241.856, attackBase: 601.524, defenseBase: 654.885, speedBase: 101 },
  1015: { hpBase: 1164.24, attackBase: 620.928, defenseBase: 485.1, speedBase: 105 },
  1321: { hpBase: 1086.624, attackBase: 679.14, defenseBase: 606.375, speedBase: 96 },
  1504: { hpBase: 853.776, attackBase: 776.16, defenseBase: 388.08, speedBase: 106 },
  1507: { hpBase: 1358.28, attackBase: 543.31, defenseBase: 485.1, speedBase: 107 },
  1508: { hpBase: 1047.82, attackBase: 698.54, defenseBase: 460.85, speedBase: 102 },
  1509: { hpBase: 1125.43, attackBase: 717.95, defenseBase: 509.35, speedBase: 97 },
  1510: { hpBase: 1125.43, attackBase: 756.76, defenseBase: 485.1, speedBase: 98 }
}
const R0 = [6, 8, 10, 10]
const R6 = [10, 14, 14, 14] // 星魂满后：普攻 +1、战技/终结技/天赋 +2（4.x 基础表 10 级内）

/* ============================================================
 * 一、手算对照
 * ============================================================ */

test('不死途（1504）手算对照：rank0/rank6 强化天赋追击 + 终结技', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1504, 'Thunder', PROPS[1504], rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    // 攻击：776.16 ×(1 + 行迹攻击 10% + 遗器 35.2% + 4魂 40%) + 38.2
    const attack = 776.16 * (1 + 0.10 + 0.352 + (rank >= 4 ? 0.4 : 0)) + 38.2
    // 暴击率 5% + 遗器 42.5%（行迹无暴击节点）；爆伤 50% + 遗器 79.6% + 行迹 37.3% + 头狼 48%
    const cpct = 0.05 + 0.425
    const cdmg = 0.5 + 0.796 + 0.373 + 0.48
    // 影肢：追加攻击伤害 +80% + 10%×婪酣层数（12/18 层）→ 天赋行增伤
    const tDmgAdd = 0.8 + 0.1 * (rank >= 2 ? 18 : 12)
    // 增伤区：行迹雷伤 14.4% + 天赋行影肢增伤 + 6魂 30 层婪酣 +120%（全体行）
    const injuryTalent = 1 + 0.144 + tDmgAdd + (rank >= 6 ? 1.2 : 0)
    const injuryCommon = 1 + 0.144 + (rank >= 6 ? 1.2 : 0)
    // 1魂 易伤 36% / 6魂 全抗穿透 20%
    const dmgRatio = 1 + (rank >= 1 ? 0.36 : 0)
    const res = 1 + (rank >= 6 ? 0.2 : 0)
    // 强化天赋追击倍率 = 天赋追击[t] + 终结技额外伤害[q]×floor(婪酣/4)（3/4 次）
    const times = rank >= 2 ? 4 : 3
    const talentMult = at(BUSITU.tAppend, t) + at(BUSITU.qExtra, q) * times
    const common = attack * 1 / (2 - 0) * 0.9 // 防御区 0.5（无无视防御）× 减伤 0.9
    {
      const row = rows['强化天赋追加攻击(满【婪酣】)']
      const base = common * talentMult * dmgRatio * injuryTalent * res
      closeTo(row.critical, base * (1 + cdmg + 0.8), `不死途 rank${rank} 强化追击 暴击`)
      closeTo(row.expect, base * (1 + cpct * (cdmg + 0.8)), `不死途 rank${rank} 强化追击 期望`)
      //（头狼：追加攻击行暴伤额外 +80%）
    }
    {
      const row = rows['终结技伤害']
      const base = common * at(BUSITU.qDmg, q) * dmgRatio * injuryCommon * res
      closeTo(row.critical, base * (1 + cdmg), `不死途 rank${rank} 终结技 暴击`)
      closeTo(row.expect, base * (1 + cpct * cdmg), `不死途 rank${rank} 终结技 期望`)
    }
  }
})

test('千冶•刃（1507）手算对照：rank0 战技（生命注入）/ rank6 终结技（6魂×1.5）', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1507, 'Fire', PROPS[1507], rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    // 生命合计：1358.28 ×(1 + 行迹生命 10% + 遗器生命% 50.9%) + 固定 1371.4 → 注入为攻击基数
    const hp = 1358.28 * (1 + 0.10 + 0.509) + 224.8 + 1146.6
    // 暴击率 5% + 遗器 42.5% + 行迹 12% + 煞火 20%；爆伤 50% + 遗器 79.6% + 煞火[q]
    const cpct = 0.05 + 0.425 + 0.12 + 0.2
    const cdmg = 0.5 + 0.796 + at(QIANYE.qCdmg, q)
    // 煞火缠身：防御降低[q]（按无视防御）、易伤[q]
    const defArea = 1 / (2 - at(QIANYE.qDefDown, q))
    const dmgRatio = 1 + at(QIANYE.qEnemyDmg, q)
    // 万淬心：全体增伤 50%（4魂 100%）；虚无队友档终结技增伤 75%（4魂 125%）
    // 2魂：追加攻击 +75% 且终结技视作追加攻击 +75%
    const allDmg = rank >= 4 ? 1 : 0.5
    const ultraDmgAdd = (rank >= 4 ? 1.25 : 0.75) + (rank >= 2 ? 0.75 : 0)
    // 抗性：1魂 全抗穿透 20%
    const res = 1 + (rank >= 1 ? 0.2 : 0)
    {
      // 战技行（rank0 核对）：e技能[e] + 4×弹射[e]
      const row = rows['战技伤害']
      const mult = at(QIANYE.eDmg, e) + at(QIANYE.eBounce, e) * 4
      const base = hp * mult * dmgRatio * (1 + 0.224 + allDmg) * defArea * res * 0.9
      closeTo(row.critical, base * (1 + cdmg), `千冶•刃 rank${rank} 战技 暴击`)
      closeTo(row.expect, base * (1 + cpct * cdmg), `千冶•刃 rank${rank} 战技 期望`)
    }
    {
      // 终结技行（rank6 核对）：q2 技能[q] ×(6魂 1.5)
      const row = rows['终结技伤害']
      const mult = at(QIANYE.q2Dmg, q) * (rank >= 6 ? 1.5 : 1)
      const base = hp * mult * dmgRatio * (1 + 0.224 + allDmg + ultraDmgAdd) * defArea * res * 0.9
      closeTo(row.critical, base * (1 + cdmg), `千冶•刃 rank${rank} 终结技 暴击`)
      closeTo(row.expect, base * (1 + cpct * cdmg), `千冶•刃 rank${rank} 终结技 期望`)
    }
    {
      // 追击行（rank6 核对）＝战技组合按战技等级，2魂追加攻击 +75%
      const row = rows['追击伤害']
      const mult = at(QIANYE.eDmg, e) + at(QIANYE.eBounce, e) * 4
      const tAdd = rank >= 2 ? 0.75 : 0
      const base = hp * mult * dmgRatio * (1 + 0.224 + allDmg + tAdd) * defArea * res * 0.9
      closeTo(row.critical, base * (1 + cdmg), `千冶•刃 rank${rank} 追击 暴击`)
      closeTo(row.expect, base * (1 + cpct * cdmg), `千冶•刃 rank${rank} 追击 期望`)
    }
  }
})

test('姬子•启行（1510）手算对照：rank0 大招组合 / rank6 助战技（1/2/6魂路径）', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1510, 'Fire', PROPS[1510], rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    const attack = 756.76 * (1 + 0.28 + 0.352) + 38.2 // 行迹攻击 28% + 遗器 35.2%
    const cpct = 0.05 + 0.12 + 0.425 // 行迹暴击 12%
    // 爆伤：50% + 遗器 79.6% + 助战技 80% + 歼灭协议 200%
    const cdmg = 0.5 + 0.796 + 0.8 + 2.0
    // 抗性：助战技全穿 20% + 4魂 10% + 6魂火穿 20%
    const res = 1 + 0.2 + (rank >= 4 ? 0.1 : 0) + (rank >= 6 ? 0.2 : 0)
    {
      // 大招行（rank0 核对）：q3弹射×6 + q3群体 + q2技能 + q弹射×3（均按终结技等级）
      const row = rows['大招歼破模式']
      const mult = (at(JIZI.q3Bounce, q) * 6 + at(JIZI.q3Aoe, q) +
        at(JIZI.q2Dmg, q) + at(JIZI.qBounce, q) * 3) * (rank >= 2 ? 1.3 : 1)
      const base = attack * mult * 1 * (1 + 0.08 + 0.2) * 0.5 * res * 0.9
      closeTo(row.critical, base * (1 + cdmg), `姬子•启行 rank${rank} 大招 暴击`)
      closeTo(row.expect, base * (1 + cpct * cdmg), `姬子•启行 rank${rank} 大招 期望`)
    }
    {
      // 助战技行（rank6 核对）：t2群体 + N×弹射（1魂 4→5）×(2魂 ×1.3)，6魂助战技 +75%
      const row = rows['助战技歼破模式']
      const bounce = rank >= 1 ? 5 : 4
      const mult = (at(JIZI.t2Aoe, t) + at(JIZI.t2Bounce, t) * bounce) * (rank >= 2 ? 1.3 : 1)
      const tDmg = rank >= 6 ? 0.75 : 0
      const base = attack * mult * 1 * (1 + 0.08 + 0.2 + tDmg) * 0.5 * res * 0.9
      closeTo(row.critical, base * (1 + cdmg), `姬子•启行 rank${rank} 助战技 暴击`)
      closeTo(row.expect, base * (1 + cpct * cdmg), `姬子•启行 rank${rank} 助战技 期望`)
    }
  }
})

test('大丽花（1321）手算对照：rank0/rank6 天赋追击(5段) + 终结技防御降低', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1321, 'Fire', PROPS[1321], rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——（行迹为击破特攻/效果抵抗/速度，无攻击向加成）
    const attack = 679.14 * (1 + 0.352) + 38.2
    const cpct = 0.05 + 0.425
    const cdmg = 0.5 + 0.796
    // 终结技防御力降低[q] → 无视防御（miao calc.js 为敌方持续减防，作用于全部行）；
    // 2魂全抗穿透 20%；4魂易伤 12%
    const defArea = 1 / (2 - at(DALIHUA.qDefDown, q))
    const dmgRatio = 1 + (rank >= 4 ? 0.12 : 0)
    const res = 1 + (rank >= 2 ? 0.2 : 0)
    {
      const row = rows['天赋追击伤害(5段)']
      const base = attack * (at(DALIHUA.tAppend, t) * 5) * dmgRatio * 1 * defArea * res * 0.9
      closeTo(row.critical, base * (1 + cdmg), `大丽花 rank${rank} 天赋追击 暴击`)
      closeTo(row.expect, base * (1 + cpct * cdmg), `大丽花 rank${rank} 天赋追击 期望`)
    }
    {
      const row = rows['终结技伤害']
      const base = attack * at(DALIHUA.qDmg, q) * dmgRatio * 1 * defArea * res * 0.9
      closeTo(row.critical, base * (1 + cdmg), `大丽花 rank${rank} 终结技 暴击`)
      closeTo(row.expect, base * (1 + cpct * cdmg), `大丽花 rank${rank} 终结技 期望`)
    }
  }
})

test('吉尔伽美什（1509）手算对照：rank0 战技 / rank6 战技(+2)与终结技（6魂暴伤）', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1509, 'Thunder', PROPS[1509], rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    // 攻击：717.95 ×(1 + 行迹攻击 18% + 遗器 35.2% + 1魂 60%) + 38.2
    const attack = 717.95 * (1 + 0.18 + 0.352 + (rank >= 1 ? 0.6 : 0)) + 38.2
    // 面板速度 97+30=127 < 140 → 王霸的竞逐不触发（手算取 0 档）
    const cpct = 0.05 + 0.187 + 0.425
    // 爆伤：50% + 遗器 79.6% + 英雄的孤傲 150%
    const cdmg = 0.5 + 0.796 + 1.5
    const defArea = 1 / (2 - 0.3) // 王来承认 无视防御 30%
    const dmgRatio = 1.2 // 终结技易伤 20%
    const res = 1 + (rank >= 6 ? 0.2 : 0)
    {
      // 战技行：e单体×2（2 段），2魂每段 +100% → 组合 +2（miao 文案口径，排位修正为 2 魂生效）
      const row = rows['战技·王之财宝']
      const mult = at(GILGAMESH.eSingle, e) * 2 + (rank >= 2 ? 2 : 0)
      const base = attack * mult * dmgRatio * (1 + 0.08) * defArea * res * 0.9
      closeTo(row.critical, base * (1 + cdmg), `吉尔伽美什 rank${rank} 战技 暴击`)
      closeTo(row.expect, base * (1 + cpct * cdmg), `吉尔伽美什 rank${rank} 战技 期望`)
    }
    {
      // 终结技行：q群攻 + 10×弹射；终结技增伤 40%；6魂黄金律暴伤 +300%
      const row = rows['终结技·天地乖离，开辟之星']
      const mult = at(GILGAMESH.qAoe, q) + at(GILGAMESH.qBounce, q) * 10
      const base = attack * mult * dmgRatio * (1 + 0.08 + 0.4) * defArea * res * 0.9
      closeTo(row.critical, base * (1 + cdmg + (rank >= 6 ? 3 : 0)), `吉尔伽美什 rank${rank} 终结技 暴击`)
      closeTo(row.expect, base * (1 + cpct * (cdmg + (rank >= 6 ? 3 : 0))), `吉尔伽美什 rank${rank} 终结技 期望`)
    }
  }
})

test('远坂凛（1508）手算对照：rank0/rank6 强化战技（2魂 ×1.3 与战技增伤）', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1508, 'Quantum', PROPS[1508], rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    // 攻击：698.54 ×(1 + 行迹攻击 18% + 遗器 35.2% + 秉持优雅 150%) + 38.2
    const attack = 698.54 * (1 + 0.18 + 0.352 + 1.5) + 38.2
    const cpct = 0.05 + 0.425
    // 爆伤：50% + 遗器 79.6% + 行迹 37.3% + 宝石魔术 70% + 4魂叠加第 2 层 70%
    const cdmg = 0.5 + 0.796 + 0.373 + 0.7 + (rank >= 4 ? 0.7 : 0)
    // 抗性：秉持优雅量子穿 20% + 6魂全穿 20%
    const res = 1 + 0.2 + (rank >= 6 ? 0.2 : 0)
    const dmgRatio = 1.2 // 终结技易伤 20%
    {
      // 强化战技：e2群攻 + 10×弹射（按战技等级）；2魂 ×1.3 + 战技增伤 30%
      const row = rows['强化战技·第二魔法实验']
      const mult = (at(RIN.e2Aoe, e) + at(RIN.e2Bounce, e) * 10) * (rank >= 2 ? 1.3 : 1)
      const eDmg = rank >= 2 ? 0.3 : 0
      const base = attack * mult * dmgRatio * (1 + 0.08 + eDmg) * 0.5 * res * 0.9
      closeTo(row.critical, base * (1 + cdmg), `远坂凛 rank${rank} 强化战技 暴击`)
      closeTo(row.expect, base * (1 + cpct * cdmg), `远坂凛 rank${rank} 强化战技 期望`)
    }
    {
      // 大招对五：q目标 + 4×q群攻
      const row = rows['终结技·对五']
      const mult = at(RIN.qTarget, q) + at(RIN.qAoe, q) * 4
      const base = attack * mult * dmgRatio * (1 + 0.08) * 0.5 * res * 0.9
      closeTo(row.critical, base * (1 + cdmg), `远坂凛 rank${rank} 大招 暴击`)
      closeTo(row.expect, base * (1 + cpct * cdmg), `远坂凛 rank${rank} 大招 期望`)
    }
  }
})

test('Saber（1014）手算对照：rank0/rank6 终结技·对单（1/2/4/6魂路径）', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1014, 'Wind', PROPS[1014], rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    const attack = 601.524 * (1 + 0.352) + 38.2
    // 暴击率 5% + 行迹 12% + 遗器 42.5% + 龙之骑士 20%；爆伤 50% + 79.6% + 星之冠冕 82%
    const cpct = 0.05 + 0.12 + 0.425 + 0.2
    const cdmg = 0.5 + 0.796 + 0.82
    const defArea = 1 / (2 - (rank >= 2 ? 0.15 : 0)) // 2魂 炉心 15 层无视防御 15%
    {
      // 终结技·对单：q技能 + 10×q随机；1魂终结技 +60%；4魂风穿 20%、6魂终结技行再 +20%
      const row = rows['终结技·对单总伤害']
      const mult = at(SABER.qDmg, q) + at(SABER.qRandom, q) * 10
      const injury = 1 + 0.224 + at(SABER.tDmgUp, t) + (rank >= 1 ? 0.6 : 0)
      const res = 1 + (rank >= 4 ? 0.2 : 0) + (rank >= 6 ? 0.2 : 0)
      const base = attack * mult * 1 * injury * defArea * res * 0.9
      closeTo(row.critical, base * (1 + cdmg), `Saber rank${rank} 终结技 暴击`)
      closeTo(row.expect, base * (1 + cpct * cdmg), `Saber rank${rank} 终结技 期望`)
    }
    {
      // 强化普攻·1名敌人：a2技能 + 1目标伤害（按普攻等级）
      const row = rows['强化普攻·1名敌人']
      const mult = at(SABER.a2Dmg, b) + at(SABER.a2Single, b)
      const injury = 1 + 0.224 + at(SABER.tDmgUp, t)
      const res = 1 + (rank >= 4 ? 0.2 : 0)
      const base = attack * mult * 1 * injury * defArea * res * 0.9
      closeTo(row.critical, base * (1 + cdmg), `Saber rank${rank} 强化普攻 暴击`)
      closeTo(row.expect, base * (1 + cpct * cdmg), `Saber rank${rank} 强化普攻 期望`)
    }
  }
})

test('Archer（1015）手算对照：rank0 5 次战技组合 / rank6 终结技（4魂+150%）', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1015, 'Quantum', PROPS[1015], rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    const attack = 620.928 * (1 + 0.18 + 0.352) + 38.2
    const cpct = 0.05 + 0.067 + 0.425
    const cdmg = 0.5 + 0.796 + 0.6 // 守护者 +60%
    const res = 1 + (rank >= 2 ? 0.2 : 0) // 2魂量子穿 20%
    {
      // 5 次战技：1 次无增益 + 4 次×(1+战技伤害提高[e]) → e×(5+4×提高)
      const row = rows['【回路连接】5次战技伤害']
      const mult = at(ARCHER.eDmg, e) * (5 + 4 * at(ARCHER.eDmgUp, e))
      const base = attack * mult * 1 * (1 + 0.224) * 0.5 * res * 0.9
      closeTo(row.critical, base * (1 + cdmg), `Archer rank${rank} 战技 暴击`)
      closeTo(row.expect, base * (1 + cpct * cdmg), `Archer rank${rank} 战技 期望`)
    }
    {
      const row = rows['终结技伤害']
      const base = attack * at(ARCHER.qDmg, q) * 1 * (1 + 0.224 + (rank >= 4 ? 1.5 : 0)) * 0.5 * res * 0.9
      closeTo(row.critical, base * (1 + cdmg), `Archer rank${rank} 终结技 暴击`)
      closeTo(row.expect, base * (1 + cpct * cdmg), `Archer rank${rank} 终结技 期望`)
    }
  }
})

/* ============================================================
 * 二、8 角色 rank0/rank6 完备性（有限正数、期望 ≤ 暴击、行数 = skillList 条目数）
 * ============================================================ */
const CHARS = {
  1014: ['Saber', 'Wind'], 1015: ['Archer', 'Quantum'], 1321: ['大丽花', 'Fire'],
  1504: ['不死途', 'Thunder'], 1507: ['千冶•刃', 'Fire'], 1508: ['远坂凛', 'Quantum'],
  1509: ['吉尔伽美什', 'Thunder'], 1510: ['姬子•启行', 'Fire']
}
const ELEMENT_SET = { Fire: '107', Physical: '105', Ice: '104', Quantum: '108', Thunder: '109', Wind: '110', Imaginary: '112' }
const WEAPON_CYCLE = [
  { id: 23001, rank: 5 }, { id: 21010, rank: 1 }, { id: 20007, rank: 3 },
  { id: 20014, rank: 2 }, { id: 21024, rank: 4 }, { id: 0, rank: 1 }
]
test('4.x 8 角色 rank0/rank6：全伤害行有限正数、期望 ≤ 暴击', async (t) => {
  let totalRows = 0
  for (const [idStr, [name, element]] of Object.entries(CHARS)) {
    const id = Number(idStr)
    for (const rank of [0, 6]) {
      await t.test(`${name} rank${rank}`, () => {
        const ret = damage({
          avatarId: id, name: '满配' + name, level: 80, rank, damage_type: element,
          properties: { hpBase: 1244.6, attackBase: 647.3, defenseBase: 501.2, speedBase: 100.5 },
          relics: [
            { id: 61011, main_affix_tag: 'AttackAddedRatio', main_affix_value: 0.352, sub_affix_id: [{ tag: 'CriticalDamageBase', value: 0.148 }, { tag: 'SpeedDelta', value: 3 }] },
            { id: 61012, main_affix_tag: 'CriticalDamageBase', main_affix_value: 0.648, sub_affix_id: [{ tag: 'AttackAddedRatio', value: 0.101 }] },
            { id: 61013, main_affix_tag: 'CriticalChanceBase', main_affix_value: 0.324, sub_affix_id: [{ tag: 'BreakDamageAddedRatioBase', value: 0.264 }] },
            { id: 61014, main_affix_tag: 'HPAddedRatio', main_affix_value: 0.432, sub_affix_id: [{ tag: 'StatusProbabilityBase', value: 0.078 }] },
            { id: 61015, main_affix_tag: 'SpeedDelta', main_affix_value: 25, sub_affix_id: [{ tag: 'HPDelta', value: 224.8 }] },
            { id: 61016, main_affix_tag: 'HPDelta', main_affix_value: 1146.6, sub_affix_id: [{ tag: 'AttackDelta', value: 38.2 }] }
          ],
          equipment: WEAPON_CYCLE[Number(idStr.slice(-1)) % WEAPON_CYCLE.length],
          relic_sets: [
            { set_id: ELEMENT_SET[element], set_name: '4件套' },
            { set_id: '114', set_name: '2件套' }
          ],
          skillTree: minorNodes(id),
          behaviorList: behavior(id, rank === 0 ? [8, 12, 13, 15] : [10, 14, 14, 14])
        })
        assert.ok(ret && Array.isArray(ret.damage) && ret.damage.length > 0, '应返回伤害行')
        assert.equal(ret.damage.length, Object.keys(skilldict[idStr].skillList).length,
          '行数应等于 skillList 槽位数')
        for (const row of ret.damage) {
          totalRows++
          const { critical, expect } = row.value
          assert.ok(Number.isFinite(critical) && critical > 0,
            `[${row.title}] 暴击伤害应为有限正数（critical=${critical}）`)
          assert.ok(Number.isFinite(expect) && expect > 0,
            `[${row.title}] 期望伤害应为有限正数（expect=${expect}）`)
          assert.ok(expect <= critical, `[${row.title}] 期望 ${expect} 应 ≤ 暴击 ${critical}`)
        }
      })
    }
  }
  t.diagnostic(`共检查 ${totalRows} 个伤害行`)
})

/* ============================================================
 * 三、SkillData 覆盖检查（数组长度覆盖星魂+2 后等级）
 * ============================================================ */
test('SkillData 覆盖：4.x 8 条目数组长度覆盖星魂+2 后等级', () => {
  for (const idStr of Object.keys(CHARS)) {
    for (const [slot, arr] of Object.entries(skilldict[idStr])) {
      if (slot === 'skillList' || slot === 'Ultra_Use' || slot === 'Maze') continue
      assert.ok(Array.isArray(arr), `${idStr}.${slot} 应为数组`)
      // 4.x 普攻表 10 级（E3 后 10 级恰好覆盖）；其余表 15 级（12+3）
      const required = slot === 'Normal' ? (idStr === '1015' ? 9 : 10) : 15
      assert.ok(arr.length >= required,
        `${idStr}.${slot} 长度 ${arr.length} 应 ≥ ${required}（覆盖星魂+2 后等级）`)
    }
  }
})

/* ============================================================
 * 四、钩子状态：倍率数组改写幂等、命途切换回退
 * ============================================================ */
test('钩子状态：rank6→rank0→rank6 交替计算，输出不累积且正确回退', () => {
  const seq = []
  for (const rank of [6, 0, 6, 0, 6]) {
    const ret = damage(panel(1504, 'Thunder', PROPS[1504], rank, rank === 0 ? R0 : R6))
    seq.push(JSON.stringify(ret.damage.map(r => r.value)))
  }
  assert.equal(seq[0], seq[2], '不死途 rank6 两次计算应逐字段一致（不累积）')
  assert.equal(seq[1], seq[3], '不死途 rank0 两次计算应逐字段一致（回退正确）')
  assert.equal(seq[0], seq[4], '不死途 rank6 第三次计算应逐字段一致')
  for (const id of [1507, 1510, 1509, 1508, 1014]) {
    const elem = { 1507: 'Fire', 1510: 'Fire', 1509: 'Thunder', 1508: 'Quantum', 1014: 'Wind' }[id]
    const r6a = damage(panel(id, elem, PROPS[id], 6, R6))
    const r0 = damage(panel(id, elem, PROPS[id], 0, R0))
    const r6b = damage(panel(id, elem, PROPS[id], 6, R6))
    assert.equal(JSON.stringify(r6a.damage), JSON.stringify(r6b.damage), `${id} rank6 重算应一致`)
    assert.notEqual(JSON.stringify(r6a.damage), JSON.stringify(r0.damage), `${id} rank0/6 应不同`)
  }
})
