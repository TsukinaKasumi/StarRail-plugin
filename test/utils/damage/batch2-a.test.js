/**
 * 批次2 · A 组：直伤输出角色（9 个）伤害数据抽查
 *   雪衣 1214 / 银枝 1302 / 米沙 1312 / 真理医生 1305 / 椒丘 1218 /
 *   貊泽 1223 / 飞霄 1220 / 云璃 1221 / 翡翠 1314
 *
 * 手算对照数值锚点为 miao-plugin resources/meta-sr/character/{角色}/data.json
 * talent 表的独立快照（本文件硬编码，测试不依赖 miao-plugin 在场）；
 * 推导过程见各 test 内注释；面板输入全部合成自建。
 *
 * 覆盖：
 *   - 9 角色 rank0/rank6 手算对照（暴击与期望双口径，核心输出行）
 *   - 全伤害行完备性（有限正数、期望 ≤ 暴击、行数 = skillList 条目数）
 *   - SkillData 覆盖检查（e/q/t 表 15 级；2.x 普攻表 miao 仅 9 级，
 *     E3 后 10 级经引擎越界收敛到 9 级值——miao 截断，披露见提交说明）
 *   - 钩子状态：倍率数组改写幂等（多次计算不累积）、命途切换正确回退
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { damage, skilldict } from './engine.mjs'

const REL_TOL = 1e-7
function closeTo (actual, expected, label) {
  const rel = Math.abs(actual - expected) / Math.abs(expected)
  assert.ok(rel < REL_TOL,
    `${label}：引擎 ${actual} vs 手算 ${expected}（相对误差 ${(rel * 100).toExponential(3)}%，超过 1e-7）`)
}
const rowsOf = ret => Object.fromEntries(ret.damage.map(r => [r.title, r.value]))
const at = (arr, lv) => arr[Math.min(lv, arr.length) - 1]

/* ============================================================
 * 数值锚点：miao-plugin talent 表快照（2026-10 提取，独立于 SkillData.json）
 * ============================================================ */
// 雪衣（e 单体+相邻 / q 技能+增伤上限 / t 追加单次）
const XUEYI = {
  eMain: [0.7, 0.77, 0.84, 0.91, 0.98, 1.05, 1.1375, 1.225, 1.3125, 1.4, 1.47, 1.54, 1.61, 1.68, 1.75],
  eAdj: [0.35, 0.385, 0.42, 0.455, 0.49, 0.525, 0.56875, 0.6125, 0.65625, 0.7, 0.735, 0.77, 0.805, 0.84, 0.875],
  qDmg: [1.5, 1.6, 1.7, 1.8, 1.9, 2, 2.125, 2.25, 2.375, 2.5, 2.6, 2.7, 2.8, 2.9, 3],
  qDmgUp: [0.36, 0.384, 0.408, 0.432, 0.456, 0.48, 0.51, 0.54, 0.57, 0.6, 0.624, 0.648, 0.672, 0.696, 0.72],
  tAppend: [0.45, 0.495, 0.54, 0.585, 0.63, 0.675, 0.73125, 0.7875, 0.84375, 0.9, 0.945, 0.99, 1.035, 1.08, 1.125]
}
// 银枝（e / q 技能 / q2 技能+额外随机）
const YINZHI = {
  eDmg: [0.6, 0.66, 0.72, 0.78, 0.84, 0.9, 0.975, 1.05, 1.125, 1.2, 1.26, 1.32, 1.38, 1.44, 1.5],
  qDmg: [0.96, 1.024, 1.088, 1.152, 1.216, 1.28, 1.36, 1.44, 1.52, 1.6, 1.664, 1.728, 1.792, 1.856, 1.92],
  q2Dmg: [1.68, 1.792, 1.904, 2.016, 2.128, 2.24, 2.38, 2.52, 2.66, 2.8, 2.912, 3.024, 3.136, 3.248, 3.36],
  q2Rand: [0.57, 0.608, 0.646, 0.684, 0.722, 0.76, 0.8075, 0.855, 0.9025, 0.95, 0.988, 1.026, 1.064, 1.102, 1.14]
}
// 米沙（e 单体+相邻 / q 每段）
const MISHA = {
  eMain: [1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.625, 1.75, 1.875, 2, 2.1, 2.2, 2.3, 2.4, 2.5],
  eAdj: [0.4, 0.44, 0.48, 0.52, 0.56, 0.6, 0.65, 0.7, 0.75, 0.8, 0.84, 0.88, 0.92, 0.96, 1],
  qSeg: [0.36, 0.384, 0.408, 0.432, 0.456, 0.48, 0.51, 0.54, 0.57, 0.6, 0.624, 0.648, 0.672, 0.696, 0.72]
}
// 真理医生（e / q / t 追加）
const ZHENLI = {
  eDmg: [0.75, 0.825, 0.9, 0.975, 1.05, 1.125, 1.21875, 1.3125, 1.40625, 1.5, 1.575, 1.65, 1.725, 1.8, 1.875],
  qDmg: [1.44, 1.536, 1.632, 1.728, 1.824, 1.92, 2.04, 2.16, 2.28, 2.4, 2.496, 2.592, 2.688, 2.784, 2.88],
  tAppend: [1.35, 1.485, 1.62, 1.755, 1.89, 2.025, 2.19375, 2.3625, 2.53125, 2.7, 2.835, 2.97, 3.105, 3.24, 3.375]
}
// 椒丘（e 目标+相邻 / q 技能+终结技易伤 / t 烬煨层）
const JIAOQIU = {
  eMain: [0.75, 0.825, 0.9, 0.975, 1.05, 1.125, 1.21875, 1.3125, 1.40625, 1.5, 1.575, 1.65, 1.725, 1.8, 1.875],
  eAdj: [0.45, 0.495, 0.54, 0.585, 0.63, 0.675, 0.73125, 0.7875, 0.84375, 0.9, 0.945, 0.99, 1.035, 1.08, 1.125],
  qDmg: [0.6, 0.64, 0.68, 0.72, 0.76, 0.8, 0.85, 0.9, 0.95, 1, 1.04, 1.08, 1.12, 1.16, 1.2],
  qEnemyUlt: [0.09, 0.096, 0.102, 0.108, 0.114, 0.12, 0.1275, 0.135, 0.1425, 0.15, 0.156, 0.162, 0.168, 0.174, 0.18],
  tLayer1: [0.075, 0.0825, 0.09, 0.0975, 0.105, 0.1125, 0.121875, 0.13125, 0.140625, 0.15, 0.1575, 0.165, 0.1725, 0.18, 0.1875],
  tStack: [0.025, 0.0275, 0.03, 0.0325, 0.035, 0.0375, 0.040625, 0.04375, 0.046875, 0.05, 0.0525, 0.055, 0.0575, 0.06, 0.0625]
}
// 貊泽（e / q / t 追加）
const MOZED = {
  eDmg: [0.75, 0.825, 0.9, 0.975, 1.05, 1.125, 1.21875, 1.3125, 1.40625, 1.5, 1.575, 1.65, 1.725, 1.8, 1.875],
  qDmg: [1.62, 1.728, 1.836, 1.944, 2.052, 2.16, 2.295, 2.43, 2.565, 2.7, 2.808, 2.916, 3.024, 3.132, 3.24],
  tAppend: [0.8, 0.88, 0.96, 1.04, 1.12, 1.2, 1.3, 1.4, 1.5, 1.6, 1.68, 1.76, 1.84, 1.92, 2]
}
// 飞霄（e / q 最多+最后 / t 追加+增伤）
const FEIXIAO = {
  eDmg: [1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.625, 1.75, 1.875, 2, 2.1, 2.2, 2.3, 2.4, 2.5],
  qMax: [4.02, 4.318, 4.616, 4.914, 5.212, 5.51, 5.8825, 6.255, 6.6275, 7, 7.298, 7.596, 7.894, 8.192, 8.49],
  qLast: [0.96, 1.024, 1.088, 1.152, 1.216, 1.28, 1.36, 1.44, 1.52, 1.6, 1.664, 1.728, 1.792, 1.856, 1.92],
  tAppend: [0.55, 0.605, 0.66, 0.715, 0.77, 0.825, 0.89375, 0.9625, 1.03125, 1.1, 1.155, 1.21, 1.265, 1.32, 1.375],
  tDmgUp: [0.3, 0.33, 0.36, 0.39, 0.42, 0.45, 0.4875, 0.525, 0.5625, 0.6, 0.63, 0.66, 0.69, 0.72, 0.75]
}
// 云璃（t 反击目标+相邻 / q 反击目标+相邻+随机+暴伤）
const YUNLI = {
  tMain: [0.6, 0.66, 0.72, 0.78, 0.84, 0.9, 0.975, 1.05, 1.125, 1.2, 1.26, 1.32, 1.38, 1.44, 1.5],
  tAdj: [0.3, 0.33, 0.36, 0.39, 0.42, 0.45, 0.4875, 0.525, 0.5625, 0.6, 0.63, 0.66, 0.69, 0.72, 0.75],
  qMain: [1.32, 1.408, 1.496, 1.584, 1.672, 1.76, 1.87, 1.98, 2.09, 2.2, 2.288, 2.376, 2.464, 2.552, 2.64],
  qAdj: [0.66, 0.704, 0.748, 0.792, 0.836, 0.88, 0.935, 0.99, 1.045, 1.1, 1.144, 1.188, 1.232, 1.276, 1.32],
  qRand: [0.432, 0.4608, 0.4896, 0.5184, 0.5472, 0.576, 0.612, 0.648, 0.684, 0.72, 0.7488, 0.7776, 0.8064, 0.8352, 0.864],
  qCdmg: [0.6, 0.64, 0.68, 0.72, 0.76, 0.8, 0.85, 0.9, 0.95, 1, 1.04, 1.08, 1.12, 1.16, 1.2]
}
// 翡翠（a 目标 / q 技能+追加倍率 / t 技能+每层爆伤）
const FEICUI = {
  aDmg: [0.45, 0.54, 0.63, 0.72, 0.81, 0.9, 0.99, 1.08, 1.17],
  qDmg: [1.2, 1.32, 1.44, 1.56, 1.68, 1.8, 1.95, 2.1, 2.25, 2.4, 2.52, 2.64, 2.76, 2.88, 3],
  qChaseUp: [0.4, 0.44, 0.48, 0.52, 0.56, 0.6, 0.65, 0.7, 0.75, 0.8, 0.84, 0.88, 0.92, 0.96, 1],
  tDmg: [0.6, 0.66, 0.72, 0.78, 0.84, 0.9, 0.975, 1.05, 1.125, 1.2, 1.26, 1.32, 1.38, 1.44, 1.5],
  tCdmgPer: [0.012, 0.0132, 0.0144, 0.0156, 0.0168, 0.018, 0.0195, 0.021, 0.0225, 0.024, 0.0252, 0.0264, 0.0276, 0.0288, 0.03]
}

/* ============================================================
 * 合成手算面板（遗器合计：攻击% 35.2 / 爆伤 79.6 / 暴击 42.5 /
 * 击破特攻 26.4 / 效果命中 10.8 / 生命% 43.2 / 速度 25 /
 * 固定生命 1371.4 / 固定攻击 38.2；椒丘另将效果命中副词条提至 72%）
 * ============================================================ */
const minorNodes = (id) =>
  Array.from({ length: 10 }, (_, i) => ({ id: id * 1000 + 201 + i, level: 1 }))
const behavior = (id, [basicLv, skillLv, ultLv, talentLv]) =>
  [[1, basicLv], [2, skillLv], [3, ultLv], [4, talentLv], [7, 1]]
    .map(([n, level]) => ({ id: id * 1000 + n, level }))
const RELICS = (effPctSub = 0.108) => [
  { id: 61011, main_affix_tag: 'AttackAddedRatio', main_affix_value: 0.352, sub_affix_id: [{ tag: 'CriticalDamageBase', value: 0.148 }] },
  { id: 61012, main_affix_tag: 'CriticalDamageBase', main_affix_value: 0.648, sub_affix_id: [{ tag: 'CriticalChanceBase', value: 0.101 }] },
  { id: 61013, main_affix_tag: 'CriticalChanceBase', main_affix_value: 0.324, sub_affix_id: [{ tag: 'BreakDamageAddedRatioBase', value: 0.264 }] },
  { id: 61014, main_affix_tag: 'HPAddedRatio', main_affix_value: 0.432, sub_affix_id: [{ tag: 'StatusProbabilityBase', value: effPctSub }] },
  { id: 61015, main_affix_tag: 'SpeedDelta', main_affix_value: 25, sub_affix_id: [{ tag: 'HPDelta', value: 224.8 }] },
  { id: 61016, main_affix_tag: 'HPDelta', main_affix_value: 1146.6, sub_affix_id: [{ tag: 'AttackDelta', value: 38.2 }] }
]
const PROPS = {
  1214: { hpBase: 1047.816, attackBase: 640.332, defenseBase: 509.355, speedBase: 103 },
  1218: { hpBase: 1047.816, attackBase: 543.312, defenseBase: 606.375, speedBase: 98 },
  1220: { hpBase: 1122.468, attackBase: 679.14, defenseBase: 485.1, speedBase: 112 },
  1221: { hpBase: 1358.28, attackBase: 679.14, defenseBase: 485.1, speedBase: 101 },
  1223: { hpBase: 1047.816, attackBase: 601.524, defenseBase: 545.7375, speedBase: 102 },
  1302: { hpBase: 1122.468, attackBase: 679.14, defenseBase: 485.1, speedBase: 96 },
  1305: { hpBase: 1047.816, attackBase: 640.332, defenseBase: 545.7375, speedBase: 100 },
  1312: { hpBase: 1122.468, attackBase: 679.14, defenseBase: 485.1, speedBase: 94 },
  1314: { hpBase: 1047.816, attackBase: 640.332, defenseBase: 509.355, speedBase: 100 }
}
const R0 = [6, 8, 10, 10]
const R6 = [10, 14, 14, 14] // 星魂满后等级（普攻 10 越过 2.x 表长 9 时由引擎收敛到 9 级值）
function panel (id, elem, rank, levels, relics) {
  return {
    avatarId: id, name: '手算', level: 80, rank, damage_type: elem,
    properties: PROPS[id], relics: relics || RELICS(),
    equipment: { id: 0, rank: 1 }, relic_sets: [],
    skillTree: minorNodes(id), behaviorList: behavior(id, levels)
  }
}
// 通用断言：某行暴击/期望双口径
function checkRow (rows, title, base, cdmg, cpct, label) {
  const row = rows[title]
  assert.ok(row && row.critical > 0 && row.expect > 0, `${label} ${title} 行存在且为正`)
  closeTo(row.critical, base * (1 + cdmg), `${label} ${title} 暴击`)
  closeTo(row.expect, base * (1 + cpct * cdmg), `${label} ${title} 期望`)
}

/* ============================================================
 * 一、手算对照
 * ============================================================ */

test('雪衣（1214）手算对照：rank0/rank6 终结技（增伤上限档）与天赋追击(3段)', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1214, 'Quantum', rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    // 攻击：640.332 ×(1 + 遗器攻击 35.2%) + 38.2（行迹无攻击%）
    const attack = 640.332 * (1 + 0.352) + 38.2
    const cpct = 0.05 + 0.425
    const cdmg = 0.5 + 0.796
    // 行迹-预兆机杼：min(击破特攻, 240)%（遗器 26.4% + 行迹 37.3% + 4魂 40%）
    const stance = 26.4 + 37.3 + (rank >= 4 ? 40 : 0)
    const dmgUp = Math.min(stance, 240) / 100
    const defArea = 0.5
    const resArea = 1
    {
      // 终结技：增伤 = 行迹量子 8% + 天罚贯身[q] + 摧锋轴承 10% + 预兆机杼
      const injury = 1 + 0.08 + at(XUEYI.qDmgUp, q) + 0.1 + dmgUp
      const base = attack * at(XUEYI.qDmg, q) * injury * defArea * resArea * 0.9
      checkRow(rows, '终结技伤害', base, cdmg, cpct, `雪衣 rank${rank}`)
    }
    {
      // 天赋追击(3段)：增伤 = 量子 8% + 预兆机杼 + 1魂追加 40%
      const injury = 1 + 0.08 + dmgUp + (rank >= 1 ? 0.4 : 0)
      const base = attack * at(XUEYI.tAppend, t) * 3 * injury * defArea * resArea * 0.9
      checkRow(rows, '天赋追击伤害(3段)', base, cdmg, cpct, `雪衣 rank${rank}`)
    }
    {
      // 战技(扩散)：e单体 + 2×相邻
      const injury = 1 + 0.08 + dmgUp
      const mult = at(XUEYI.eMain, e) + 2 * at(XUEYI.eAdj, e)
      const base = attack * mult * injury * defArea * resArea * 0.9
      checkRow(rows, '战技伤害(扩散)', base, cdmg, cpct, `雪衣 rank${rank}`)
    }
  }
})

test('银枝（1302）手算对照：rank0/rank6 强化终结技（2魂攻击档/6魂无视防御）', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1302, 'Physical', rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    // 攻击（普攻/战技行）：679.14 ×(1 + 行迹攻击 28% + 遗器 35.2%) + 38.2
    // 攻击（终结技行）：2魂起额外 +40%（技能位键仅作用于两个终结技行）
    const atkRatio = 1 + 0.28 + 0.352 + (rank >= 2 ? 0.4 : 0)
    const attack = 679.14 * atkRatio + 38.2
    // 暴击率：基础 5% + 遗器 42.5% + 升格 10层 25%（4魂 12层 30%）
    const cpct = 0.05 + 0.425 + (rank >= 4 ? 0.3 : 0.25)
    // 爆伤：基础 50% + 遗器 79.6% + 1魂 40%（4魂 48%）
    const cdmg = 0.5 + 0.796 + (rank >= 1 ? (rank >= 4 ? 0.48 : 0.4) : 0)
    // 增伤：行迹物理 14.4% + 行迹-勇气 15%
    const injury = 1 + 0.144 + 0.15
    // 防御区：6魂无视 30%（全局注入近似，普攻/战技行同享——引擎无技能位无视防御）
    const defArea = 1 / (2 - (rank >= 6 ? 0.3 : 0))
    {
      // 强化终结技 = q2技能 + 6×额外随机
      const mult = at(YINZHI.q2Dmg, q) + 6 * at(YINZHI.q2Rand, q)
      const base = attack * mult * injury * defArea * 0.9
      checkRow(rows, '强化终结技总伤害', base, cdmg, cpct, `银枝 rank${rank}`)
    }
    {
      // 终结技（Talent 槽位常量改写 = q表[q]，不吃 2魂攻击增益？——吃：TalentAttackAddedRatio）
      const mult = at(YINZHI.qDmg, q)
      const base = attack * mult * injury * defArea * 0.9
      checkRow(rows, '终结技伤害', base, cdmg, cpct, `银枝 rank${rank}`)
    }
  }
})

test('米沙（1312）手算对照：rank0/rank6 终结技 10/15 段（4魂每段+6%）', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1312, 'Ice', rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    const attack = 679.14 * (1 + 0.352) + 38.2
    const cpct = 0.05 + 0.425 + 0.067 // 行迹暴击 6.7%
    const cdmg = 0.5 + 0.796 + 0.3 // 行迹-传冲 30%
    const injury = 1 + 0.224 + (rank >= 6 ? 0.3 : 0) // 行迹冰伤 + 6魂 30%
    const defArea = 1 / (2 - (rank >= 2 ? 0.16 : 0)) // 2魂减防 16%
    const perSeg = at(MISHA.qSeg, q) + (rank >= 4 ? 0.06 : 0)
    {
      const base = attack * perSeg * 10 * injury * defArea * 0.9
      checkRow(rows, '终结技伤害·10段', base, cdmg, cpct, `米沙 rank${rank}`)
    }
    {
      // 15 段行（1魂 5 敌人档；Talent 槽位按终结技等级常量改写）
      const base = attack * perSeg * 15 * injury * defArea * 0.9
      checkRow(rows, '终结技伤害·15段', base, cdmg, cpct, `米沙 rank${rank}`)
    }
  }
})

test('真理医生（1305）手算对照：rank0/rank6 追加攻击(3负面)（归纳/推理/2魂附加）', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1305, 'Imaginary', rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    const attack = 640.332 * (1 + 0.28 + 0.352) + 38.2
    const cpct = 0.05 + 0.425 + 0.12 + (rank >= 1 ? 0.25 : 0.15) // 行迹暴击 + 归纳
    const cdmg = 0.5 + 0.796 + (rank >= 1 ? 0.5 : 0.3)
    {
      // 追加攻击：推理 30% + 6魂 50%；倍率 = t追加 + 2魂 3×20%
      const injury = 1 + 0.3 + (rank >= 6 ? 0.5 : 0)
      const mult = at(ZHENLI.tAppend, t) + (rank >= 2 ? 0.6 : 0)
      const base = attack * mult * injury * 0.5 * 0.9
      checkRow(rows, '追加攻击伤害(3负面)', base, cdmg, cpct, `真理医生 rank${rank}`)
    }
    {
      const injury = 1 + 0.3
      const base = attack * at(ZHENLI.qDmg, q) * injury * 0.5 * 0.9
      checkRow(rows, '终结技伤害', base, cdmg, cpct, `真理医生 rank${rank}`)
    }
  }
})

test('椒丘（1218）手算对照：rank0/rank6 战技(扩散)与终结技（举炊/烬煨/易伤）', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1218, 'Fire', rank, rank === 0 ? R0 : R6, RELICS(0.72)))
    )
    // —— 手算 ——
    // 行迹-举炊：效果命中 (72% + 行迹 28%) = 100% → 超出 80% 部分每 15% +60% 攻击（1 档）
    const atkUp = Math.floor((100 - 80) / 15) * 0.6
    const attack = 543.312 * (1 + 0.352 + atkUp) + 38.2
    const cpct = 0.05 + 0.425
    const cdmg = 0.5 + 0.796
    const injury = 1 + 0.144 + (rank >= 1 ? 0.4 : 0) // 行迹火伤 + 1魂 40%
    // 满层【烬煨】易伤：1层[t] + 叠加[t]×层数（6魂 8 层）
    const stacks = rank >= 6 ? 8 : 4
    const vuln = at(JIAOQIU.tLayer1, t) + at(JIAOQIU.tStack, t) * stacks
    const defArea = 0.5
    const resArea = rank >= 6 ? 1.27 : 1 // 6魂 9层×3% 全抗穿
    {
      // 战技(扩散)：e目标 + 2×相邻，易伤 = 烬煨
      const mult = at(JIAOQIU.eMain, e) + 2 * at(JIAOQIU.eAdj, e)
      const base = attack * mult * injury * (1 + vuln) * defArea * resArea * 0.9
      checkRow(rows, '战技伤害(扩散)', base, cdmg, cpct, `椒丘 rank${rank}`)
    }
    {
      // 终结技：易伤 = 烬煨 + 终结技易伤[q]
      const ratio = 1 + vuln + at(JIAOQIU.qEnemyUlt, q)
      const base = attack * at(JIAOQIU.qDmg, q) * injury * ratio * defArea * resArea * 0.9
      checkRow(rows, '终结技伤害', base, cdmg, cpct, `椒丘 rank${rank}`)
    }
  }
})

test('貊泽（1223）手算对照：rank0/rank6 终结技与天赋追加（猎物易伤/6魂倍率）', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1223, 'Thunder', rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    const attack = 601.524 * (1 + 0.18 + 0.352) + 38.2
    const cpct = 0.05 + 0.425
    const cdmg = 0.5 + 0.796 + 0.373 + (rank >= 2 ? 0.4 : 0) // 行迹爆伤 + 2魂 40%
    const injury = 1 + (rank >= 4 ? 0.2 : 0) // 4魂 20%
    const ratio = 1.25 // 天赋：猎物受追加攻击伤害 +25%（追加/终结技行）
    {
      const base = attack * at(MOZED.qDmg, q) * injury * ratio * 0.5 * 0.9
      checkRow(rows, '终结技伤害', base, cdmg, cpct, `貊泽 rank${rank}`)
    }
    {
      const mult = at(MOZED.tAppend, t) + (rank >= 6 ? 0.25 : 0)
      const base = attack * mult * injury * ratio * 0.5 * 0.9
      checkRow(rows, '天赋追加攻击伤害', base, cdmg, cpct, `貊泽 rank${rank}`)
    }
  }
})

test('飞霄（1220）手算对照：rank0/rank6 Q最多/Q结束/天赋追加（1魂×1.5/6魂倍率+1.4）', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1220, 'Wind', rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    // 攻击：679.14 ×(1 + 行迹攻击 28% + 遗器 35.2% + 电举 48%) + 38.2
    const attack = 679.14 * (1 + 0.28 + 0.352 + 0.48) + 38.2
    const cpct = 0.05 + 0.425 + 0.12
    const cdmg = 0.5 + 0.796
    // 增伤：雷狩[t]（全行）
    const injury = 1 + at(FEIXIAO.tDmgUp, t)
    const defArea = 0.5
    const resArea = rank >= 6 ? 1.2 : 1 // 6魂终结技全抗穿 20%（三个 q 行）
    {
      // Q最多造成伤害（Normal 槽位按终结技等级常量改写）
      const base = attack * at(FEIXIAO.qMax, q) * injury * defArea * resArea * 0.9
      checkRow(rows, 'Q最多造成伤害', base, cdmg, cpct, `飞霄 rank${rank}`)
    }
    {
      // Q结束伤害：1魂 5层×10% → 倍率 ×1.5
      const mult = at(FEIXIAO.qLast, q) * (rank >= 1 ? 1.5 : 1)
      const base = attack * mult * injury * defArea * resArea * 0.9
      checkRow(rows, '终结技结束伤害', base, cdmg, cpct, `飞霄 rank${rank}`)
    }
    {
      // 天赋追加：解形暴伤 +36%（仅追加行）；6魂倍率 +1.4
      const cdmgT = cdmg + 0.36
      const mult = at(FEIXIAO.tAppend, t) + (rank >= 6 ? 1.4 : 0)
      const base = attack * mult * injury * defArea * resArea * 0.9
      checkRow(rows, '天赋追加攻击伤害', base, cdmgT, cpct, `飞霄 rank${rank}`)
    }
  }
})

test('云璃（1221）手算对照：rank0/rank6 勘破灭主目标与天赋反击(3目标)', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1221, 'Physical', rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    // 攻击：679.14 ×(1 + 行迹攻击 28% + 遗器 35.2% + 反击攻击 30%) + 38.2
    const attack = 679.14 * (1 + 0.28 + 0.352 + 0.3) + 38.2
    // 暴击率：基础 + 遗器 + 行迹 6.7% + 6魂勘破灭 15%（仅勘破灭行）
    const cpctBase = 0.05 + 0.425 + 0.067
    // 爆伤：基础 + 遗器 + 终结技反击暴伤[q]
    const cdmg = 0.5 + 0.796 + at(YUNLI.qCdmg, q)
    const defArea = 1 / (2 - (rank >= 2 ? 0.2 : 0)) // 2魂无视 20%
    {
      // 勘破灭主目标：1魂 +20% 增伤、6魂 +15% 暴击 +20% 物穿（勘破灭三行）
      const cpct = cpctBase + (rank >= 6 ? 0.15 : 0)
      const injury = 1 + (rank >= 1 ? 0.2 : 0)
      const resArea = rank >= 6 ? 1.2 : 1
      const base = attack * at(YUNLI.qMain, q) * injury * defArea * resArea * 0.9
      checkRow(rows, '【勘破•灭】伤害·主目标', base, cdmg, cpct, `云璃 rank${rank}`)
    }
    {
      // 天赋反击(3目标)：t主 + 2×t相邻；不吃勘破灭专属 1魂/6魂增益
      const mult = at(YUNLI.tMain, t) + 2 * at(YUNLI.tAdj, t)
      const base = attack * mult * defArea * 0.9
      checkRow(rows, '天赋反击伤害(3目标)', base, cdmg, cpctBase, `云璃 rank${rank}`)
    }
  }
})

test('翡翠（1314）手算对照：rank0/rank6 强化追击/追击/终结技（当品暴伤/绝当品攻击）', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1314, 'Quantum', rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    // 攻击：640.332 ×(1 + 行迹攻击 18% + 遗器 35.2% + 绝当品 25%) + 38.2
    const attack = 640.332 * (1 + 0.18 + 0.352 + 0.25) + 38.2
    const cpct = 0.05 + 0.425 + (rank >= 2 ? 0.18 : 0) // 2魂 15层当品 18%
    // 爆伤：基础 + 遗器 + 剔烁之牙 50层×每层[t]
    const cdmg = 0.5 + 0.796 + at(FEICUI.tCdmgPer, t) * 50
    const injury = 1 + 0.224 // 行迹量子
    const defArea = 1 / (2 - (rank >= 4 ? 0.12 : 0)) // 4魂无视 12%
    const resArea = rank >= 6 ? 1.2 : 1 // 6魂量子穿 20%
    {
      // 追击：1魂追加 +32%
      const injuryT = injury + (rank >= 1 ? 0.32 : 0)
      const base = attack * at(FEICUI.tDmg, t) * injuryT * defArea * resArea * 0.9
      checkRow(rows, '追击伤害', base, cdmg, cpct, `翡翠 rank${rank}`)
    }
    {
      // 强化追击 = t技能[t] + q追加倍率[q]（BPSkill 槽位常量改写）；1魂 +32%
      const injuryT = injury + (rank >= 1 ? 0.32 : 0)
      const mult = at(FEICUI.tDmg, t) + at(FEICUI.qChaseUp, q)
      const base = attack * mult * injuryT * defArea * resArea * 0.9
      checkRow(rows, '强化追击伤害', base, cdmg, cpct, `翡翠 rank${rank}`)
    }
    {
      const base = attack * at(FEICUI.qDmg, q) * injury * defArea * resArea * 0.9
      checkRow(rows, '终结技伤害', base, cdmg, cpct, `翡翠 rank${rank}`)
    }
  }
})

/* ============================================================
 * 二、A 组 9 角色 rank0/rank6：全伤害行有限正数、期望 ≤ 暴击
 * ============================================================ */
const CHARS = {
  1214: ['雪衣', 'Quantum'],
  1218: ['椒丘', 'Fire'],
  1220: ['飞霄', 'Wind'],
  1221: ['云璃', 'Physical'],
  1223: ['貊泽', 'Thunder'],
  1302: ['银枝', 'Physical'],
  1305: ['真理医生', 'Imaginary'],
  1312: ['米沙', 'Ice'],
  1314: ['翡翠', 'Quantum']
}
const ELEMENT_SET = { Fire: '107', Physical: '105', Ice: '104', Quantum: '108', Thunder: '109', Wind: '110', Imaginary: '112' }
const WEAPON_CYCLE = [
  { id: 23001, rank: 5 }, { id: 21010, rank: 1 }, { id: 20007, rank: 3 },
  { id: 20014, rank: 2 }, { id: 21024, rank: 4 }, { id: 0, rank: 1 },
  { id: 23001, rank: 5 }, { id: 21010, rank: 1 }, { id: 20007, rank: 3 }
]
test('A 组 9 角色 rank0/rank6：全伤害行有限正数、期望 ≤ 暴击', async (t) => {
  let totalRows = 0
  for (const [idStr, [name, element]] of Object.entries(CHARS)) {
    const id = Number(idStr)
    for (const rank of [0, 6]) {
      await t.test(`${name} rank${rank}`, () => {
        const ret = damage({
          avatarId: id, name: '满配' + name, level: 80, rank, damage_type: element,
          properties: { hpBase: 1244.6, attackBase: 647.3, defenseBase: 501.2, speedBase: 100.5 },
          relics: RELICS(),
          equipment: WEAPON_CYCLE[Number(idStr.slice(-1)) % WEAPON_CYCLE.length],
          relic_sets: [
            { set_id: ELEMENT_SET[element], set_name: '4件套' },
            { set_id: '114', set_name: '2件套' }
          ],
          skillTree: minorNodes(id), behaviorList: behavior(id, rank === 0 ? [8, 12, 13, 15] : [10, 14, 14, 14])
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
 * 三、SkillData 覆盖检查（2.x 普攻表 miao 仅 9 级：E3 后 10 级越界收敛）
 * ============================================================ */
test('SkillData 覆盖：A 组 9 条目数组长度（普攻 9 级 miao 口径、其余 15 级）', () => {
  for (const idStr of Object.keys(CHARS)) {
    for (const [slot, arr] of Object.entries(skilldict[idStr])) {
      if (slot === 'skillList' || slot === 'Ultra_Use' || slot === 'Maze') continue
      assert.ok(Array.isArray(arr), `${idStr}.${slot} 应为数组`)
      const required = slot === 'Normal' ? 9 : 15
      assert.ok(arr.length >= required,
        `${idStr}.${slot} 长度 ${arr.length} 应 ≥ ${required}`)
    }
  }
})

/* ============================================================
 * 四、钩子状态：倍率数组改写幂等、命途切换回退
 * ============================================================ */
test('钩子状态：rank6→rank0→rank6 交替计算，输出不累积且正确回退', () => {
  const seq = []
  for (const rank of [6, 0, 6, 0, 6]) {
    const ret = damage(panel(1220, 'Wind', rank, rank === 0 ? R0 : R6))
    seq.push(JSON.stringify(ret.damage.map(r => r.value)))
  }
  assert.equal(seq[0], seq[2], '飞霄 rank6 两次计算应逐字段一致（不累积）')
  assert.equal(seq[1], seq[3], '飞霄 rank0 两次计算应逐字段一致（回退正确）')
  assert.equal(seq[0], seq[4], '飞霄 rank6 第三次计算应逐字段一致')
  for (const [id, elem] of [[1221, 'Physical'], [1302, 'Physical'], [1305, 'Imaginary'], [1312, 'Ice'], [1314, 'Quantum']]) {
    const r6a = damage(panel(id, elem, 6, R6))
    const r0 = damage(panel(id, elem, 0, R0))
    const r6b = damage(panel(id, elem, 6, R6))
    assert.equal(JSON.stringify(r6a.damage), JSON.stringify(r6b.damage), `${id} rank6 重算应一致`)
    assert.notEqual(JSON.stringify(r6a.damage), JSON.stringify(r0.damage), `${id} rank0/6 应不同`)
  }
})
