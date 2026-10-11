/**
 * 批次3 · A 组：1.x 直伤输出角色（8 个）伤害数据抽查
 *   丹恒 1002 / 阿兰 1008 / 黑塔 1013 / 希露瓦 1103 / 虎克 1109 /
 *   卢卡 1111 / 素裳 1206 / 三月七·巡猎 1224
 *
 * 引擎无 DOT 通道（希露瓦触电/虎克灼烧/卢卡裂伤行跳过）；等级错位行
 * （减速档终结技/终结技副目标/强化战技/强化普攻/剑势战技）由钩子按
 * 真实技能等级改写为常量数组。手算对照数值锚点为 miao-plugin
 * resources/meta-sr/character/{角色}/data.json talent 表的独立快照
 * （本文件硬编码，测试不依赖 miao-plugin 在场）。
 *
 * 手算公式：伤害 = 攻击 × 倍率 × 增伤区 × 防御区(0.5，同级无无视) × 抗性区 × 0.9 × 暴击区
 * 覆盖：
 *   - 8 角色 rank0/rank6 手算对照（核心输出行，暴击与期望双口径）
 *   - 全伤害行完备性（有限正数、期望 ≤ 暴击、行数 = skillList 条目数）
 *   - SkillData 覆盖检查（普攻 9 级 miao 口径、其余 15 级）
 *   - 钩子状态：倍率数组改写幂等、rank 切换回退
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
// 丹恒（q 技能 + q 减速加成 / t 风抗穿 / a）
const DANHENG = {
  aDmg: [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3],
  qDmg: [2.4, 2.56, 2.72, 2.88, 3.04, 3.2, 3.4, 3.6, 3.8, 4, 4.16, 4.32, 4.48, 4.64, 4.8],
  qSlow: [0.72, 0.768, 0.816, 0.864, 0.912, 0.96, 1.02, 1.08, 1.14, 1.2, 1.248, 1.296, 1.344, 1.392, 1.44],
  tKx: [0.18, 0.198, 0.216, 0.234, 0.252, 0.27, 0.2925, 0.315, 0.3375, 0.36, 0.378, 0.396, 0.414, 0.432, 0.45]
}
// 阿兰（q 主/副 / t 增伤）
const ALAN = {
  qMain: [1.92, 2.048, 2.176, 2.304, 2.432, 2.56, 2.72, 2.88, 3.04, 3.2, 3.328, 3.456, 3.584, 3.712, 3.84],
  qAdj: [0.96, 1.024, 1.088, 1.152, 1.216, 1.28, 1.36, 1.44, 1.52, 1.6, 1.664, 1.728, 1.792, 1.856, 1.92],
  tDmgUp: [0.36, 0.396, 0.432, 0.468, 0.504, 0.54, 0.585, 0.63, 0.675, 0.72, 0.756, 0.792, 0.828, 0.864, 0.9]
}
// 黑塔（e 技能伤害）
const HEITA = {
  eDmg: [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8125, 0.875, 0.9375, 1, 1.05, 1.1, 1.15, 1.2, 1.25]
}
// 希露瓦（a 技能伤害）
const XILUWA = {
  aDmg: [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3]
}
// 虎克（e2 强化战技主/副）
const HUKE = {
  e2Main: [1.4, 1.54, 1.68, 1.82, 1.96, 2.1, 2.275, 2.45, 2.625, 2.8, 2.94, 3.08, 3.22, 3.36, 3.5],
  e2Adj: [0.4, 0.44, 0.48, 0.52, 0.56, 0.6, 0.65, 0.7, 0.75, 0.8, 0.84, 0.88, 0.92, 0.96, 1]
}
// 卢卡（a2 直冲拳每段/碎天拳 / q 伤害提高）
const LUKA = {
  a2Seg: [0.1, 0.12, 0.14, 0.16, 0.18, 0.2, 0.22, 0.24, 0.26],
  a2Finish: [0.4, 0.48, 0.56, 0.64, 0.72, 0.8, 0.88, 0.96, 1.04],
  qEnemyDmg: [0.12, 0.128, 0.136, 0.144, 0.152, 0.16, 0.17, 0.18, 0.19, 0.2, 0.208, 0.216, 0.224, 0.232, 0.24]
}
// 素裳（e 技能 / e 附加伤害）
const SUSHANG = {
  eDmg: [1.05, 1.155, 1.26, 1.365, 1.47, 1.575, 1.70625, 1.8375, 1.96875, 2.1, 2.205, 2.31, 2.415, 2.52, 2.625],
  ePlus: [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8125, 0.875, 0.9375, 1, 1.05, 1.1, 1.15, 1.2, 1.25]
}
// 三月七·巡猎（a2 强化普攻 / t 增伤 / q）
const MARCHHUNT = {
  a2Dmg: [0.4, 0.48, 0.56, 0.64, 0.72, 0.8, 0.88, 0.96, 1.04],
  qDmg: [1.44, 1.536, 1.632, 1.728, 1.824, 1.92, 2.04, 2.16, 2.28, 2.4, 2.496, 2.592, 2.688, 2.784, 2.88],
  tDmgUp: [0.4, 0.44, 0.48, 0.52, 0.56, 0.6, 0.65, 0.7, 0.75, 0.8, 0.84, 0.88, 0.92, 0.96, 1]
}

/* ============================================================
 * 合成手算面板（遗器合计同批次2：攻击% 35.2 / 爆伤 79.6 / 暴击 42.5 /
 * 击破特攻 26.4 / 效果命中 10.8 / 生命% 43.2 / 速度 25 /
 * 固定生命 1371.4 / 固定攻击 38.2；行迹小节点属性取 character.json 聚合）
 * ============================================================ */
const minorNodes = (id) =>
  Array.from({ length: 10 }, (_, i) => ({ id: id * 1000 + 201 + i, level: 1 }))
const behavior = (id, [basicLv, skillLv, ultLv, talentLv]) =>
  [[1, basicLv], [2, skillLv], [3, ultLv], [4, talentLv], [7, 1]]
    .map(([n, level]) => ({ id: id * 1000 + n, level }))
const RELICS = [
  { id: 61011, main_affix_tag: 'AttackAddedRatio', main_affix_value: 0.352, sub_affix_id: [{ tag: 'CriticalDamageBase', value: 0.148 }] },
  { id: 61012, main_affix_tag: 'CriticalDamageBase', main_affix_value: 0.648, sub_affix_id: [{ tag: 'CriticalChanceBase', value: 0.101 }] },
  { id: 61013, main_affix_tag: 'CriticalChanceBase', main_affix_value: 0.324, sub_affix_id: [{ tag: 'BreakDamageAddedRatioBase', value: 0.264 }] },
  { id: 61014, main_affix_tag: 'HPAddedRatio', main_affix_value: 0.432, sub_affix_id: [{ tag: 'StatusProbabilityBase', value: 0.108 }] },
  { id: 61015, main_affix_tag: 'SpeedDelta', main_affix_value: 25, sub_affix_id: [{ tag: 'HPDelta', value: 224.8 }] },
  { id: 61016, main_affix_tag: 'HPDelta', main_affix_value: 1146.6, sub_affix_id: [{ tag: 'AttackDelta', value: 38.2 }] }
]
const PROPS = {
  1002: { hpBase: 882, attackBase: 546.84, defenseBase: 396.9, speedBase: 110 },
  1008: { hpBase: 1199.52, attackBase: 599.76, defenseBase: 330.75, speedBase: 102 },
  1013: { hpBase: 952.56, attackBase: 582.12, defenseBase: 396.9, speedBase: 100 },
  1103: { hpBase: 917.28, attackBase: 652.68, defenseBase: 374.85, speedBase: 104 },
  1109: { hpBase: 1340.64, attackBase: 617.4, defenseBase: 352.8, speedBase: 94 },
  1111: { hpBase: 917.28, attackBase: 582.12, defenseBase: 485.1, speedBase: 103 },
  1206: { hpBase: 917.28, attackBase: 564.48, defenseBase: 418.95, speedBase: 107 },
  1224: { hpBase: 1058.4, attackBase: 564.48, defenseBase: 441, speedBase: 102 }
}
// 行迹小节点聚合（character.json 201-210 level=1 属性合计，测试面板全点亮）
const NODES = {
  1002: { wind: 0.224, atk: 0.18 },
  1008: { atk: 0.28 },
  1013: { ice: 0.224, cpct: 0.067 },
  1103: { cpct: 0.187 },
  1109: { atk: 0.28, cdmg: 0.133 },
  1111: { atk: 0.28 },
  1206: { atk: 0.28 },
  1224: { atk: 0.28, cdmg: 0.24 }
}
const R0 = [6, 8, 10, 10]
const R6 = [10, 14, 14, 14] // 星魂满后等级（普攻 10 越过表长 9 时由引擎收敛到 9 级值）
function panel (id, elem, rank, levels) {
  return {
    avatarId: id, name: '手算', level: 80, rank, damage_type: elem,
    properties: PROPS[id], relics: RELICS,
    equipment: { id: 0, rank: 1 }, relic_sets: [],
    skillTree: minorNodes(id), behaviorList: behavior(id, levels)
  }
}
function checkRow (rows, title, base, cdmg, cpct, label) {
  const row = rows[title]
  assert.ok(row && row.critical > 0 && row.expect > 0, `${label} ${title} 行存在且为正`)
  closeTo(row.critical, base * (1 + cdmg), `${label} ${title} 暴击`)
  closeTo(row.expect, base * (1 + cpct * cdmg), `${label} ${title} 期望`)
}

/* ============================================================
 * 一、手算对照
 * ============================================================ */

test('丹恒（1002）手算对照：rank0/rank6 减速档终结技与普攻（风抗穿/罡风/1魂暴击）', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1002, 'Wind', rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    // 攻击：546.84 ×(1 + 遗器 35.2% + 行迹攻击 18%) + 38.2
    const attack = 546.84 * (1 + 0.352 + NODES[1002].atk) + 38.2
    const cpct = 0.05 + 0.425 + (rank >= 1 ? 0.12 : 0)
    const cdmg = 0.5 + 0.796
    const windInjury = 1 + NODES[1002].wind
    {
      // 减速档终结技 = q技能[q] + q减速加成[q]（Talent 槽位按终结技等级常量）
      const mult = at(DANHENG.qDmg, q) + at(DANHENG.qSlow, q)
      const resArea = 1 + at(DANHENG.tKx, t) // 天赋-穿云风抗穿
      const base = attack * mult * windInjury * resArea * 0.5 * 0.9
      checkRow(rows, '减速目标终结技伤害', base, cdmg, cpct, `丹恒 rank${rank}`)
    }
    {
      // 普攻：行迹-罡风 +40%（与风伤节点同区相加）；天赋风抗穿为全局属性，同作用于普攻行
      const resArea = 1 + at(DANHENG.tKx, t)
      const base = attack * at(DANHENG.aDmg, b) * (windInjury + 0.4) * resArea * 0.5 * 0.9
      checkRow(rows, '普攻伤害', base, cdmg, cpct, `丹恒 rank${rank}`)
    }
  }
})

test('阿兰（1008）手算对照：rank0/rank6 终结技副目标（天赋增伤/6魂取主目标倍率+20%）', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1008, 'Thunder', rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    const attack = 599.76 * (1 + 0.352 + NODES[1008].atk) + 38.2
    const cpct = 0.05 + 0.425
    const cdmg = 0.5 + 0.796
    // 副目标倍率：rank<6 取 q相邻[q]；6魂提高到主目标 q技能[q]
    const mult = rank >= 6 ? at(ALAN.qMain, q) : at(ALAN.qAdj, q)
    // 天赋-至痛至怒增伤 + 6魂终结技伤害+20%（Talent 槽位键）
    const injury = 1 + at(ALAN.tDmgUp, t) + (rank >= 6 ? 0.2 : 0)
    const base = attack * mult * injury * 0.5 * 0.9
    checkRow(rows, '终结技伤害·副目标', base, cdmg, cpct, `阿兰 rank${rank}`)
  }
})

test('黑塔（1013）手算对照：rank0/rank6 战技（效率+高生命增伤/2魂暴击/6魂攻击）', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1013, 'Ice', rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    // 攻击：6魂后攻击+25%（行迹攻击无、冰伤节点不并入攻击）
    const attack = 582.12 * (1 + 0.352 + (rank >= 6 ? 0.25 : 0)) + 38.2
    const cpct = 0.05 + 0.425 + NODES[1013].cpct + (rank >= 2 ? 0.15 : 0)
    const cdmg = 0.5 + 0.796
    // 行迹-效率 +25% 与战技高生命 +20% 均为战技位增伤
    const injury = 1 + NODES[1013].ice + 0.45
    const base = attack * at(HEITA.eDmg, e) * injury * 0.5 * 0.9
    checkRow(rows, '战技伤害', base, cdmg, cpct, `黑塔 rank${rank}`)
  }
})

test('希露瓦（1103）手算对照：rank0/rank6 普攻（1魂×1.6/行迹狂热/6魂增伤）', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1103, 'Thunder', rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    // 攻击：行迹-狂热 +20%
    const attack = 652.68 * (1 + 0.352 + 0.2) + 38.2
    const cpct = 0.05 + 0.425 + NODES[1103].cpct
    const cdmg = 0.5 + 0.796
    // 1魂：随机相邻 60% 普攻伤害折入主行 ×1.6；6魂对触电目标 +30%
    const mult = at(XILUWA.aDmg, b) * (rank >= 1 ? 1.6 : 1)
    const injury = 1 + (rank >= 6 ? 0.3 : 0)
    const base = attack * mult * injury * 0.5 * 0.9
    checkRow(rows, '普攻伤害', base, cdmg, cpct, `希露瓦 rank${rank}`)
  }
})

test('虎克（1109）手算对照：rank0/rank6 强化战技主目标（1魂+20%/6魂+20%）与副目标', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1109, 'Fire', rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    const attack = 617.4 * (1 + 0.352 + NODES[1109].atk) + 38.2
    const cpct = 0.05 + 0.425
    const cdmg = 0.5 + 0.796 + NODES[1109].cdmg
    // 1魂强化战技 +20%（Talent/Xe 槽位键）；6魂对灼烧目标 +20%
    const injury = 1 + (rank >= 1 ? 0.2 : 0) + (rank >= 6 ? 0.2 : 0)
    {
      const base = attack * at(HUKE.e2Main, e) * injury * 0.5 * 0.9
      checkRow(rows, '强化战技伤害·主目标', base, cdmg, cpct, `虎克 rank${rank}`)
    }
    {
      const base = attack * at(HUKE.e2Adj, e) * injury * 0.5 * 0.9
      checkRow(rows, '强化战技伤害·副目标', base, cdmg, cpct, `虎克 rank${rank}`)
    }
  }
})

test('卢卡（1111）手算对照：rank0/rank6 强化普攻总伤（终结技易伤/1魂/4魂攻击）', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1111, 'Physical', rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    // 攻击：4魂 4 层斗志 +20%
    const attack = 582.12 * (1 + 0.352 + NODES[1111].atk + (rank >= 4 ? 0.2 : 0)) + 38.2
    const cpct = 0.05 + 0.425
    const cdmg = 0.5 + 0.796
    // 强化普攻总伤 = 3×直冲拳[b] + 碎天拳[b]（Talent 槽位按普攻等级常量）
    const mult = 3 * at(LUKA.a2Seg, b) + at(LUKA.a2Finish, b)
    // 终结技易伤[q] + 1魂对裂伤目标 +15%
    const ratio = 1 + at(LUKA.qEnemyDmg, q)
    const injury = 1 + (rank >= 1 ? 0.15 : 0)
    const base = attack * mult * ratio * injury * 0.5 * 0.9
    checkRow(rows, '强化普攻伤害(总伤)', base, cdmg, cpct, `卢卡 rank${rank}`)
  }
})

test('素裳（1206）手算对照：rank0/rank6 满剑势战技（Xe 槽位常量+逐寇折入）', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1206, 'Physical', rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    const attack = 564.48 * (1 + 0.352 + NODES[1206].atk) + 38.2
    const cpct = 0.05 + 0.425
    const cdmg = 0.5 + 0.796
    {
      // 满剑势战技 = e技能[e] + 2×剑势附加×1.2（逐寇 +20% 折入）
      const mult = at(SUSHANG.eDmg, e) + at(SUSHANG.ePlus, e) * 2 * 1.2
      const base = attack * mult * 0.5 * 0.9
      checkRow(rows, '满剑势战技伤害', base, cdmg, cpct, `素裳 rank${rank}`)
    }
    {
      // 战技+剑势 = e技能[e] + 剑势附加×1.2
      const mult = at(SUSHANG.eDmg, e) + at(SUSHANG.ePlus, e) * 1.2
      const base = attack * mult * 0.5 * 0.9
      checkRow(rows, '战技+剑势伤害', base, cdmg, cpct, `素裳 rank${rank}`)
    }
  }
})

test('三月七·巡猎（1224）手算对照：rank0/rank6 强化普攻（天赋增伤/6魂普攻爆伤+50%）', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1224, 'Imaginary', rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    const attack = 564.48 * (1 + 0.352 + NODES[1224].atk) + 38.2
    const cpct = 0.05 + 0.425
    const cdmg = 0.5 + 0.796 + NODES[1224].cdmg
    // 天赋-师父我悟了：充能≥1 伤害提高[t]（miao 误标 cons:1，按官方文本常驻）
    const injury = 1 + at(MARCHHUNT.tDmgUp, t)
    {
      // 强化普攻单次（普攻 10 级收敛到 9 级值）；6魂强化普攻爆伤+50%
      const base = attack * at(MARCHHUNT.a2Dmg, b) * injury * 0.5 * 0.9
      const cdmgRow = cdmg + (rank >= 6 ? 0.5 : 0)
      checkRow(rows, '强化普攻单次伤害', base, cdmgRow, cpct, `三月七·巡猎 rank${rank}`)
    }
    {
      const base = attack * at(MARCHHUNT.qDmg, q) * injury * 0.5 * 0.9
      checkRow(rows, '终结技伤害', base, cdmg, cpct, `三月七·巡猎 rank${rank}`)
    }
  }
})

/* ============================================================
 * 二、A 组 8 角色 rank0/rank6：全伤害行有限正数、期望 ≤ 暴击
 * ============================================================ */
const CHARS = {
  1002: ['丹恒', 'Wind'],
  1008: ['阿兰', 'Thunder'],
  1013: ['黑塔', 'Ice'],
  1103: ['希露瓦', 'Thunder'],
  1109: ['虎克', 'Fire'],
  1111: ['卢卡', 'Physical'],
  1206: ['素裳', 'Physical'],
  1224: ['三月七·巡猎', 'Imaginary']
}
const ELEMENT_SET = { Fire: '107', Physical: '105', Ice: '104', Quantum: '108', Thunder: '109', Wind: '110', Imaginary: '112' }
const WEAPON_CYCLE = [
  { id: 23001, rank: 5 }, { id: 21010, rank: 1 }, { id: 20007, rank: 3 },
  { id: 20014, rank: 2 }, { id: 21024, rank: 4 }, { id: 0, rank: 1 },
  { id: 23001, rank: 5 }
]
test('A 组 8 角色 rank0/rank6：全伤害行有限正数、期望 ≤ 暴击', async (t) => {
  let totalRows = 0
  for (const [idStr, [name, element]] of Object.entries(CHARS)) {
    const id = Number(idStr)
    for (const rank of [0, 6]) {
      await t.test(`${name} rank${rank}`, () => {
        const ret = damage({
          avatarId: id, name: '满配' + name, level: 80, rank, damage_type: element,
          properties: { hpBase: 1244.6, attackBase: 647.3, defenseBase: 501.2, speedBase: 100.5 },
          relics: RELICS,
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
 * 三、SkillData 覆盖检查
 * ============================================================ */
test('SkillData 覆盖：A 组 8 条目数组长度（普攻 9 级 miao 口径、其余 15 级）', () => {
  for (const idStr of Object.keys(CHARS)) {
    for (const [slot, arr] of Object.entries(skilldict[idStr])) {
      if (slot === 'skillList' || slot === 'Ultra_Use' || slot === 'Maze') continue
      assert.ok(Array.isArray(arr), `${idStr}.${slot} 应为数组`)
      // 卢卡 Talent 为强化普攻(a2)表，仅 9 级（普攻等级联动，越界收敛）
      const shortSlots = idStr === '1111' && slot === 'Talent'
      const required = slot === 'Normal' || shortSlots ? 9 : 15
      assert.ok(arr.length >= required,
        `${idStr}.${slot} 长度 ${arr.length} 应 ≥ ${required}`)
    }
  }
})

/* ============================================================
 * 四、钩子状态：倍率数组改写幂等、rank 切换回退
 * ============================================================ */
test('钩子状态：rank6→rank0→rank6 交替计算，输出不累积且正确回退', () => {
  const seq = []
  for (const rank of [6, 0, 6, 0, 6]) {
    const ret = damage(panel(1008, 'Thunder', rank, rank === 0 ? R0 : R6))
    seq.push(JSON.stringify(ret.damage.map(r => r.value)))
  }
  assert.equal(seq[0], seq[2], '阿兰 rank6 两次计算应逐字段一致（不累积）')
  assert.equal(seq[1], seq[3], '阿兰 rank0 两次计算应逐字段一致（回退正确）')
  assert.equal(seq[0], seq[4], '阿兰 rank6 第三次计算应逐字段一致')
  for (const [id, elem] of [[1002, 'Wind'], [1103, 'Thunder'], [1109, 'Fire'], [1111, 'Physical'], [1206, 'Physical'], [1224, 'Imaginary']]) {
    const r6a = damage(panel(id, elem, 6, R6))
    const r0 = damage(panel(id, elem, 0, R0))
    const r6b = damage(panel(id, elem, 6, R6))
    assert.equal(JSON.stringify(r6a.damage), JSON.stringify(r6b.damage), `${id} rank6 重算应一致`)
    assert.notEqual(JSON.stringify(r6a.damage), JSON.stringify(r0.damage), `${id} rank0/6 应不同`)
  }
})
