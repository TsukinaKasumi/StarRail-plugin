/**
 * 批次1 · 3.x 常规限定角色（10 个）伤害数据抽查
 *
 * 手算对照数值锚点为 miao-plugin resources/meta-sr/character/{角色}/data.json
 * talent 表的独立快照（本文件硬编码，测试不依赖 miao-plugin 在场）；
 * 推导过程见各 test 内注释；面板输入全部合成自建。
 *
 * 覆盖：
 *   - 10 角色 rank0/rank6 手算对照（暴击与期望双口径，核心输出行）
 *   - 全伤害行完备性（有限正数、期望 ≤ 暴击、行数 = skillList 条目数）
 *   - SkillData 覆盖检查（数组长度覆盖星魂+2 后等级；3.x 普攻表 miao 仅 9 级，
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
// 万敌（a / e2 弑神登神 / q 技能）
const WANDI = {
  aDmg: [0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65],
  e2Dmg: [1.4, 1.54, 1.68, 1.82, 1.96, 2.1, 2.275, 2.45, 2.625, 2.8, 2.94, 3.08, 3.22, 3.36, 3.5],
  qDmg: [0.96, 1.024, 1.088, 1.152, 1.216, 1.28, 1.36, 1.44, 1.52, 1.6, 1.664, 1.728, 1.792, 1.856, 1.92]
}
// 大黑塔（a / e2 技能+所有目标 / q 技能+攻击力提高 / t 每层倍率）
const HEITA = {
  aDmg: [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3],
  e2Dmg: [0.4, 0.44, 0.48, 0.52, 0.56, 0.6, 0.65, 0.7, 0.75, 0.8, 0.84, 0.88, 0.92, 0.96, 1],
  e2All: [0.2, 0.22, 0.24, 0.26, 0.28, 0.3, 0.325, 0.35, 0.375, 0.4, 0.42, 0.44, 0.46, 0.48, 0.5],
  qDmg: [1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.625, 1.75, 1.875, 2, 2.1, 2.2, 2.3, 2.4, 2.5],
  qAtkUp: [0.4, 0.44, 0.48, 0.52, 0.56, 0.6, 0.65, 0.7, 0.75, 0.8, 0.84, 0.88, 0.92, 0.96, 1],
  tPerStack: [0.04, 0.044, 0.048, 0.052, 0.056, 0.06, 0.065, 0.07, 0.075, 0.08, 0.084, 0.088, 0.092, 0.096, 0.1]
}
// 缇宝（a / e 抗穿 / q 技能+易伤 / t 追加）
const TIBAO = {
  aDmg: [0.15, 0.18, 0.21, 0.24, 0.27, 0.3, 0.33, 0.36, 0.39],
  eKx: [0.12, 0.132, 0.144, 0.156, 0.168, 0.18, 0.195, 0.21, 0.225, 0.24, 0.252, 0.264, 0.276, 0.288, 0.3],
  qDmg: [0.15, 0.165, 0.18, 0.195, 0.21, 0.225, 0.24375, 0.2625, 0.28125, 0.3, 0.315, 0.33, 0.345, 0.36, 0.375],
  qEnemyDmg: [0.15, 0.165, 0.18, 0.195, 0.21, 0.225, 0.24375, 0.2625, 0.28125, 0.3, 0.315, 0.33, 0.345, 0.36, 0.375],
  tAppend: [0.09, 0.099, 0.108, 0.117, 0.126, 0.135, 0.14625, 0.1575, 0.16875, 0.18, 0.189, 0.198, 0.207, 0.216, 0.225]
}
// 那刻夏（a / e / q / t 伤害提高）
const NAKEXIA = {
  eDmg: [0.35, 0.385, 0.42, 0.455, 0.49, 0.525, 0.56875, 0.6125, 0.65625, 0.7, 0.735, 0.77, 0.805, 0.84, 0.875],
  qDmg: [0.8, 0.88, 0.96, 1.04, 1.12, 1.2, 1.3, 1.4, 1.5, 1.6, 1.68, 1.76, 1.84, 1.92, 2],
  tDmgUp: [0.18, 0.192, 0.204, 0.216, 0.228, 0.24, 0.255, 0.27, 0.285, 0.3, 0.312, 0.324, 0.336, 0.348, 0.36]
}
// 赛飞儿（a / e / q / t）
const SEFEIER = {
  eDmg: [1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.625, 1.75, 1.875, 2, 2.1, 2.2, 2.3, 2.4, 2.5],
  qDmg: [0.6, 0.66, 0.72, 0.78, 0.84, 0.9, 0.975, 1.05, 1.125, 1.2, 1.26, 1.32, 1.38, 1.44, 1.5],
  tDmg: [0.75, 0.825, 0.9, 0.975, 1.05, 1.125, 1.21875, 1.3125, 1.40625, 1.5, 1.575, 1.65, 1.725, 1.8, 1.875]
}
// 白厄（a2 强化普攻 / e2 死星天裁 / q / t 暴伤 / t2 攻击力）
const BAIER = {
  a2Dmg: [1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.25],
  e2Dmg: [5.85, 6.435, 7.02, 7.605, 8.19, 8.775, 9.50625, 10.2375, 10.96875, 11.7, 12.285, 12.87, 13.455, 14.04, 14.625],
  qDmg: [4.8, 5.28, 5.76, 6.24, 6.72, 7.2, 7.8, 8.4, 9, 9.6, 10.08, 10.56, 11.04, 11.52, 12],
  tCdmg: [0.15, 0.165, 0.18, 0.195, 0.21, 0.225, 0.24375, 0.2625, 0.28125, 0.3, 0.315, 0.33, 0.345, 0.36, 0.375],
  t2Atk: [0.4, 0.44, 0.48, 0.52, 0.56, 0.6, 0.65, 0.7, 0.75, 0.8, 0.84, 0.88, 0.92, 0.96, 1]
}
// 海瑟音（a / e 易伤+技能 / q 减防+技能）
const HAISEYIN = {
  eEnemyDmg: [0.1, 0.11, 0.12, 0.13, 0.14, 0.15, 0.1625, 0.175, 0.1875, 0.2, 0.21, 0.22, 0.23, 0.24, 0.25],
  eDmg: [0.7, 0.77, 0.84, 0.91, 0.98, 1.05, 1.1375, 1.225, 1.3125, 1.4, 1.47, 1.54, 1.61, 1.68, 1.75],
  qDefDown: [0.15, 0.16, 0.17, 0.18, 0.19, 0.2, 0.2125, 0.225, 0.2375, 0.25, 0.26, 0.27, 0.28, 0.29, 0.3],
  qDmg: [1.2, 1.28, 1.36, 1.44, 1.52, 1.6, 1.7, 1.8, 1.9, 2, 2.08, 2.16, 2.24, 2.32, 2.4]
}
// 刻律德菈（a / q / t 附加伤害）
const KELVUDELA = {
  qDmg: [1.44, 1.536, 1.632, 1.728, 1.824, 1.92, 2.04, 2.16, 2.28, 2.4, 2.496, 2.592, 2.688, 2.784, 2.88],
  tAppend: [0.3, 0.33, 0.36, 0.39, 0.42, 0.45, 0.4875, 0.525, 0.5625, 0.6, 0.63, 0.66, 0.69, 0.72, 0.75]
}
// 长夜月（a / q 长夜+易伤+增伤 / t 暴伤 / me 长夜+额外 / mt 增伤 / e 忆灵暴伤）
const CHANGYEYUE = {
  aDmg: [0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7],
  qDmg: [1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.625, 1.75, 1.875, 2, 2.1, 2.2, 2.3, 2.4, 2.5],
  qEnemyDmg: [0.15, 0.165, 0.18, 0.195, 0.21, 0.225, 0.24375, 0.2625, 0.28125, 0.3, 0.315, 0.33, 0.345, 0.36, 0.375],
  qDmgUp: [0.3, 0.33, 0.36, 0.39, 0.42, 0.45, 0.4875, 0.525, 0.5625, 0.6, 0.63, 0.66, 0.69, 0.72, 0.75],
  tCdmg: [0.3, 0.33, 0.36, 0.39, 0.42, 0.45, 0.4875, 0.525, 0.5625, 0.6, 0.63, 0.66, 0.69, 0.72, 0.75],
  meDmg: [0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7],
  meExtra: [0.05, 0.06, 0.07, 0.08, 0.09, 0.1, 0.11, 0.12, 0.13, 0.14],
  mtDmgUp: [0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7],
  eMeCdmg: [0.12, 0.132, 0.144, 0.156, 0.168, 0.18, 0.195, 0.21, 0.225, 0.24, 0.252, 0.264, 0.276, 0.288, 0.3]
}
// 丹恒•腾荒（a / q 全体+追击+附加）
const DANHENG = {
  aDmg: [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4],
  qDmg: [1.5, 1.65, 1.8, 1.95, 2.1, 2.25, 2.4375, 2.625, 2.8125, 3, 3.15, 3.3, 3.45, 3.6, 3.75],
  qZhui: [0.4, 0.44, 0.48, 0.52, 0.56, 0.6, 0.65, 0.7, 0.75, 0.8, 0.84, 0.88, 0.92, 0.96, 1],
  qFuJia: [0.4, 0.44, 0.48, 0.52, 0.56, 0.6, 0.65, 0.7, 0.75, 0.8, 0.84, 0.88, 0.92, 0.96, 1]
}

/* ============================================================
 * 合成手算面板（同批次1 4.x 口径；遗器合计：攻击% 35.2 / 爆伤 79.6 /
 * 暴击 42.5 / 生命% 50.9 / 速度 30 / 固定生命 1371.4 / 固定攻击 38.2）
 * ============================================================ */
const minorNodes = (id) =>
  Array.from({ length: 10 }, (_, i) => ({ id: id * 1000 + 201 + i, level: 1 }))
const behavior = (id, [basicLv, skillLv, ultLv, talentLv]) =>
  [[1, basicLv], [2, skillLv], [3, ultLv], [4, talentLv], [7, 1]]
    .map(([n, level]) => ({ id: id * 1000 + n, level }))
const RELICS = [
  { id: 61011, main_affix_tag: 'AttackAddedRatio', main_affix_value: 0.352, sub_affix_id: [{ tag: 'CriticalDamageBase', value: 0.148 }] },
  { id: 61012, main_affix_tag: 'CriticalDamageBase', main_affix_value: 0.648, sub_affix_id: [{ tag: 'CriticalChanceBase', value: 0.101 }] },
  { id: 61013, main_affix_tag: 'CriticalChanceBase', main_affix_value: 0.324, sub_affix_id: [{ tag: 'HPAddedRatio', value: 0.077 }] },
  { id: 61014, main_affix_tag: 'HPAddedRatio', main_affix_value: 0.432, sub_affix_id: [{ tag: 'SpeedDelta', value: 5 }] },
  { id: 61015, main_affix_tag: 'SpeedDelta', main_affix_value: 25, sub_affix_id: [{ tag: 'HPDelta', value: 224.8 }] },
  { id: 61016, main_affix_tag: 'HPDelta', main_affix_value: 1146.6, sub_affix_id: [{ tag: 'AttackDelta', value: 38.2 }] }
]
const PROPS = {
  1401: { hpBase: 1164.24, attackBase: 679.14, defenseBase: 485.1, speedBase: 99 },
  1403: { hpBase: 1047.816, attackBase: 523.908, defenseBase: 727.65, speedBase: 96 },
  1404: { hpBase: 1552.32, attackBase: 426.888, defenseBase: 194.04, speedBase: 95 },
  1405: { hpBase: 970.2, attackBase: 756.756, defenseBase: 557.865, speedBase: 97 },
  1406: { hpBase: 931.392, attackBase: 640.332, defenseBase: 509.355, speedBase: 106 },
  1408: { hpBase: 1435.9, attackBase: 582.12, defenseBase: 703.4, speedBase: 94 },
  1410: { hpBase: 1203.048, attackBase: 601.524, defenseBase: 485.1, speedBase: 102 },
  1412: { hpBase: 1358.28, attackBase: 620.928, defenseBase: 485.1, speedBase: 99 },
  1413: { hpBase: 1319.472, attackBase: 543.312, defenseBase: 582.12, speedBase: 99 },
  1414: { hpBase: 1047.816, attackBase: 582.12, defenseBase: 776.16, speedBase: 97 }
}
const R0 = [6, 8, 10, 10]
const R6 = [10, 14, 14, 14] // 星魂满后等级（普攻 10 越过 3.x 表长 9 时由引擎收敛到 9 级值）
function panel (id, elem, rank, levels, extraBehavior = []) {
  return {
    avatarId: id, name: '手算', level: 80, rank, damage_type: elem,
    properties: PROPS[id], relics: RELICS,
    equipment: { id: 0, rank: 1 }, relic_sets: [],
    skillTree: minorNodes(id), behaviorList: [...behavior(id, levels), ...extraBehavior]
  }
}

/* ============================================================
 * 一、手算对照
 * ============================================================ */

test('万敌（1404）手算对照：rank0/rank6 弑神登神（血仇生命注入+血祥罩衫暴击）', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1404, 'Imaginary', rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    // 生命：1552.32 ×(1 + 行迹生命 18% + 遗器 50.9%) + 1371.4，再 +50%（血仇）→ 注入为攻击基数
    const hp0 = 1552.32 * (1 + 0.18 + 0.509) + 1371.4
    const hp = hp0 * 1.5
    // 血祥罩衫：floor(生命-4000)/100 档（上限 40）×1.2% 暴击率
    const cpctSteps = Math.min(Math.floor(hp - 4000) / 100, 40)
    const cpct = 0.05 + 0.425 + cpctSteps * 0.012
    // 爆伤 50% + 遗器 79.6% + 行迹 37.3% + 4魂 30%
    const cdmg = 0.5 + 0.796 + 0.373 + (rank >= 4 ? 0.3 : 0)
    const defArea = 1 / (2 - (rank >= 2 ? 0.15 : 0)) // 2魂无视防御 15%
    {
      const row = rows['战技【弑神登神】伤害·主目标']
      const mult = at(WANDI.e2Dmg, e) + (rank >= 1 ? 0.3 : 0) // 1魂主目标 +30%
      const base = hp * mult * 1 * 1 * defArea * 1 * 0.9
      closeTo(row.critical, base * (1 + cdmg), `万敌 rank${rank} 弑神登神 暴击`)
      closeTo(row.expect, base * (1 + cpct * cdmg), `万敌 rank${rank} 弑神登神 期望`)
    }
    {
      const row = rows['终结技伤害']
      const base = hp * at(WANDI.qDmg, q) * 1 * 1 * defArea * 1 * 0.9
      closeTo(row.critical, base * (1 + cdmg), `万敌 rank${rank} 终结技 暴击`)
      closeTo(row.expect, base * (1 + cpct * cdmg), `万敌 rank${rank} 终结技 期望`)
    }
  }
})

test('大黑塔（1401）手算对照：rank0/rank6 强化战技（解读层数档）与终结技（谜底+6魂）', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1401, 'Ice', rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    // 攻击：679.14 ×(1 + 行迹攻击 18% + 遗器 35.2% + 终结技攻击力提高[q]) + 38.2
    const attack = 679.14 * (1 + 0.18 + 0.352 + at(HEITA.qAtkUp, q)) + 38.2
    const cpct = 0.05 + 0.425
    const cdmg = 0.5 + 0.796 + 0.8 // 视界外来信 +80%
    const injury = 1 + 0.224 + 0.5 // 行迹冰伤 22.4% + 冷漠的诚实 50%
    const res = 1 + (rank >= 6 ? 0.2 : 0) // 6魂冰穿
    {
      // 强化战技 = e2技能×3 + e2所有目标 + 天赋每层[t]×2×解读层数（42 / 1魂起 63）
      const row = rows['强化战技伤害·主目标']
      const stacks = rank >= 1 ? 63 : 42
      const mult = at(HEITA.e2Dmg, e) * 3 + at(HEITA.e2All, e) + at(HEITA.tPerStack, t) * 2 * stacks
      const base = attack * mult * 1 * injury * 0.5 * res * 0.9
      closeTo(row.critical, base * (1 + cdmg), `大黑塔 rank${rank} 强化战技 暴击`)
      closeTo(row.expect, base * (1 + cpct * cdmg), `大黑塔 rank${rank} 强化战技 期望`)
    }
    {
      // 终结技 = q技能 + 99 层谜底 0.99 + 6魂 1 名敌人档 +4.0
      const row = rows['终结技伤害']
      const mult = at(HEITA.qDmg, q) + 0.99 + (rank >= 6 ? 4 : 0)
      const base = attack * mult * 1 * injury * 0.5 * res * 0.9
      closeTo(row.critical, base * (1 + cdmg), `大黑塔 rank${rank} 终结技 暴击`)
      closeTo(row.expect, base * (1 + cpct * cdmg), `大黑塔 rank${rank} 终结技 期望`)
    }
  }
})

test('缇宝（1403）手算对照：rank0/rank6 天赋追击（6魂 +729%）', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1403, 'Quantum', rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    // 生命：1047.816 ×(1 + 行迹生命 10% + 遗器 50.9%) + 1371.4，再 +9%（长翅膀的玻璃球）→ 注入
    const hp = (1047.816 * (1 + 0.10 + 0.509) + 1371.4) * 1.09
    const cpct = 0.05 + 0.12 + 0.425 // 行迹暴击 12%
    const cdmg = 0.5 + 0.373 + 0.796 // 行迹爆伤 37.3%
    // 战技神启全穿[e]；终结技易伤[q]；行迹城墙外的羊羔儿 216% 增伤
    const res = 1 + at(TIBAO.eKx, e)
    const dmgRatio = 1 + at(TIBAO.qEnemyDmg, q)
    const injuryCommon = 1 + 2.16
    const defArea = 1 / (2 - (rank >= 4 ? 0.18 : 0)) // 4魂无视防御 18%
    {
      const row = rows['天赋追加攻击伤害']
      const injury = injuryCommon + (rank >= 6 ? 7.29 : 0) // 6魂天赋追击 +729%
      const base = hp * at(TIBAO.tAppend, t) * dmgRatio * injury * defArea * res * 0.9
      closeTo(row.critical, base * (1 + cdmg), `缇宝 rank${rank} 天赋追击 暴击`)
      closeTo(row.expect, base * (1 + cpct * cdmg), `缇宝 rank${rank} 天赋追击 期望`)
    }
    {
      const row = rows['终结技伤害']
      const base = hp * at(TIBAO.qDmg, q) * dmgRatio * injuryCommon * defArea * res * 0.9
      closeTo(row.critical, base * (1 + cdmg), `缇宝 rank${rank} 终结技 暴击`)
      closeTo(row.expect, base * (1 + cpct * cdmg), `缇宝 rank${rank} 终结技 期望`)
    }
  }
})

test('那刻夏（1405）手算对照：rank0 战技(1目标档) / rank6 终结技（6魂全行×1.3）', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1405, 'Wind', rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    const attack = 756.756 * (1 + 0.352 + (rank >= 4 ? 0.6 : 0)) + 38.2 // 4魂攻击 +60%
    const cpct = 0.05 + 0.12 + 0.425
    const cdmg = 0.5 + 0.796 + (rank >= 6 ? 1.4 : 0) // 6魂爆伤 +140%
    const defArea = 1 / (2 - 0.28) // 质性的嬗变无视 28%（1魂再 +16% 仅在 miao 为战技命中减防，
    // 此处按钩子全行口径核对：ignore 合计 0.28+0.16）
    const defAreaR6 = 1 / (2 - 0.28 - 0.16)
    const res = 1 + (rank >= 2 ? 0.2 : 0)
    {
      const row = rows['战技单次伤害（1个敌方目标）']
      const mult = at(NAKEXIA.eDmg, e) * (rank >= 6 ? 1.3 : 1)
      const injury = 1 + 0.224 + at(NAKEXIA.tDmgUp, t) + 0.5 + 0.2 // 风伤+天赋+留白+1目标档
      const base = attack * mult * 1 * injury * (rank >= 1 ? defAreaR6 : defArea) * res * 0.9
      closeTo(row.critical, base * (1 + cdmg), `那刻夏 rank${rank} 战技 暴击`)
      closeTo(row.expect, base * (1 + cpct * cdmg), `那刻夏 rank${rank} 战技 期望`)
    }
    {
      const row = rows['终结技伤害']
      const mult = at(NAKEXIA.qDmg, q) * (rank >= 6 ? 1.3 : 1)
      const injury = 1 + 0.224 + at(NAKEXIA.tDmgUp, t) + 0.5
      const base = attack * mult * 1 * injury * (rank >= 1 ? defAreaR6 : defArea) * res * 0.9
      closeTo(row.critical, base * (1 + cdmg), `那刻夏 rank${rank} 终结技 暴击`)
      closeTo(row.expect, base * (1 + cpct * cdmg), `那刻夏 rank${rank} 终结技 期望`)
    }
  }
})

test('赛飞儿（1406）手算对照：rank0/rank6 天赋追击（速度档暴击 + 6魂 +350%）', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1406, 'Quantum', rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    // 攻击：640.332 ×(1 + 遗器 35.2% + 战技 30% + 1魂 80%) + 38.2
    const attack = 640.332 * (1 + 0.352 + 0.3 + (rank >= 1 ? 0.8 : 0)) + 38.2
    // 速度 106+30+14=150：神行宝鞋 ≥140 档暴击 +25%
    const cpct = 0.05 + 0.425 + 0.25
    const cdmg = 0.5 + 0.796
    const dmgRatio = 1 + 0.4 + (rank >= 2 ? 0.3 : 0) // 偷天换日 40% + 2魂 30%
    {
      const row = rows['天赋追加攻击伤害']
      const injury = 1 + 0.144 + (rank >= 6 ? 3.5 : 0) // 行迹量子伤 + 6魂 350%
      const base = attack * at(SEFEIER.tDmg, t) * dmgRatio * injury * 0.5 * 1 * 0.9
      closeTo(row.critical, base * (1 + cdmg + 1), `赛飞儿 rank${rank} 天赋追击 暴击`)
      closeTo(row.expect, base * (1 + cpct * (cdmg + 1)), `赛飞儿 rank${rank} 天赋追击 期望`)
      //（偷天换日：天赋追加暴伤额外 +100%）
    }
    {
      const row = rows['战技伤害·主目标']
      const base = attack * at(SEFEIER.eDmg, e) * dmgRatio * (1 + 0.144) * 0.5 * 1 * 0.9
      closeTo(row.critical, base * (1 + cdmg), `赛飞儿 rank${rank} 战技 暴击`)
      closeTo(row.expect, base * (1 + cpct * cdmg), `赛飞儿 rank${rank} 战技 期望`)
    }
  }
})

test('白厄（1408）手算对照：rank0/rank6 死星天裁与强化普攻（卡厄斯兰那形态档）', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1408, 'Physical', rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    // 攻击：582.12 ×(1 + 遗器 35.2% + 卡厄斯兰那攻击力[t2] + 行迹照见 100%) + 38.2
    const attack = 582.12 * (1 + 0.352 + at(BAIER.t2Atk, t) + 1) + 38.2
    const cpct = 0.05 + 0.12 + 0.425
    const cdmg = 0.5 + 0.796 + 0.373 + at(BAIER.tCdmg, t) + (rank >= 1 ? 0.5 : 0)
    const injury = 1 + 0.45 // 身承炎炬万千
    const res = 1 + (rank >= 2 ? 0.2 : 0) // 2魂物理穿
    {
      const row = rows['强化战技【死星天裁】']
      const base = attack * at(BAIER.e2Dmg, e) * 1 * injury * 0.5 * res * 0.9
      closeTo(row.critical, base * (1 + cdmg), `白厄 rank${rank} 死星天裁 暴击`)
      closeTo(row.expect, base * (1 + cpct * cdmg), `白厄 rank${rank} 死星天裁 期望`)
    }
    {
      const row = rows['强化普攻伤害·主目标']
      const base = attack * at(BAIER.a2Dmg, b) * 1 * injury * 0.5 * res * 0.9
      closeTo(row.critical, base * (1 + cdmg), `白厄 rank${rank} 强化普攻 暴击`)
      closeTo(row.expect, base * (1 + cpct * cdmg), `白厄 rank${rank} 强化普攻 期望`)
    }
  }
})

test('海瑟音（1410）手算对照：rank0/rank6 终结技直伤（结界减防+易伤）', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1410, 'Physical', rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    // 攻击：601.524 ×(1 + 行迹攻击 18% + 遗器 35.2%) + 38.2；效果命中 10% < 60% 珍珠琴弦不触发
    const attack = 601.524 * (1 + 0.18 + 0.352) + 38.2
    const cpct = 0.05 + 0.425
    const cdmg = 0.5 + 0.796
    const dmgRatio = 1 + at(HAISEYIN.eEnemyDmg, e) // 战技易伤
    const defArea = 1 / (2 - at(HAISEYIN.qDefDown, q)) // 结界减防
    const res = 1 + (rank >= 4 ? 0.2 : 0) // 4魂全穿
    {
      const row = rows['终结技直伤']
      const base = attack * at(HAISEYIN.qDmg, q) * dmgRatio * 1 * defArea * res * 0.9
      closeTo(row.critical, base * (1 + cdmg), `海瑟音 rank${rank} 终结技 暴击`)
      closeTo(row.expect, base * (1 + cpct * cdmg), `海瑟音 rank${rank} 终结技 期望`)
    }
    {
      const row = rows['战技伤害']
      const base = attack * at(HAISEYIN.eDmg, e) * dmgRatio * 1 * defArea * res * 0.9
      closeTo(row.critical, base * (1 + cdmg), `海瑟音 rank${rank} 战技 暴击`)
      closeTo(row.expect, base * (1 + cpct * cdmg), `海瑟音 rank${rank} 战技 期望`)
    }
  }
})

test('刻律德菈（1412）手算对照：rank0/rank6 终结技（4魂+2.4）与天赋附加（6魂+3.0）', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1412, 'Wind', rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    const attack = 620.928 * (1 + 0.18 + 0.352) + 38.2
    // 见者暴击率 +100%（饱和）；攻击 < 2000 来者不触发
    const cpct = 1
    const cdmg = 0.5 + 0.796
    const injuryCommon = 1 + 0.224 + (rank >= 2 ? 1.6 : 0) // 行迹风伤 + 2魂 160%
    const res = 1 + (rank >= 6 ? 0.2 : 0)
    {
      const row = rows['终结技伤害']
      const mult = at(KELVUDELA.qDmg, q) + (rank >= 4 ? 2.4 : 0) // 4魂倍率 +240%
      const base = attack * mult * 1 * injuryCommon * 0.5 * res * 0.9
      closeTo(row.critical, base * (1 + cdmg), `刻律德菈 rank${rank} 终结技 暴击`)
      closeTo(row.expect, base * (1 + cpct * cdmg), `刻律德菈 rank${rank} 终结技 期望`)
    }
    {
      const row = rows['天赋附加伤害']
      const mult = at(KELVUDELA.tAppend, t) + (rank >= 6 ? 3 : 0) // 6魂倍率 +300%
      const base = attack * mult * 1 * injuryCommon * 0.5 * res * 0.9
      closeTo(row.critical, base * (1 + cdmg), `刻律德菈 rank${rank} 天赋附加 暴击`)
      closeTo(row.expect, base * (1 + cpct * cdmg), `刻律德菈 rank${rank} 天赋附加 期望`)
    }
  }
})

test('长夜月（1413）手算对照：rank0/rank6 忆灵行（至暗之谜/忆灵暴伤转化/1魂）', () => {
  const ME_LV = 8 // 忆灵技/忆灵天赋等级（面板 301/302 条目）
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1413, 'Ice', rank, rank === 0 ? R0 : R6,
      [{ id: 1413301, level: ME_LV }, { id: 1413302, level: ME_LV }])))
    // —— 手算 ——
    // 生命：1319.472 ×(1 + 行迹生命 18% + 遗器 50.9%) + 1371.4 → 注入（忆灵行 50% 基数已折入倍率）
    const hp = 1319.472 * (1 + 0.18 + 0.509) + 1371.4
    // 暴击率 5% + 遗器 42.5% + 行迹暴击 18.7% + 天黑黑 35% → 饱和 100%
    const cpct = 1
    // 爆伤：50% + 遗器 79.6% + 行迹 13.3% + 天赋暴伤[t] + 天黑黑 15% + 2魂 40%
    const cdmg = 0.5 + 0.796 + 0.133 + at(CHANGYEYUE.tCdmg, t) + 0.15 + (rank >= 2 ? 0.4 : 0)
    // 忆灵天赋增伤[mt]；6魂全穿 20%
    const allDmg = at(CHANGYEYUE.mtDmgUp, ME_LV)
    const res = 1 + (rank >= 6 ? 0.2 : 0)
    {
      // 终结技-忆灵伤害（至暗之谜档）：q长夜×0.5；至暗增伤[q] + 易伤[q]；
      // 忆灵暴伤转化 = 当前爆伤×忆灵暴伤提高[e] + 行迹天亮了(memoryCount=1) 5%；1魂忆灵增伤 50%
      const row = rows['终结技-忆灵伤害']
      const mult = at(CHANGYEYUE.qDmg, q) * 0.5
      const dmgRatio = 1 + at(CHANGYEYUE.qEnemyDmg, q)
      const injury = 1 + allDmg + at(CHANGYEYUE.qDmgUp, q) + (rank >= 1 ? 0.5 : 0)
      const ultraCdmg = cdmg * at(CHANGYEYUE.eMeCdmg, e) + 0.05
      const base = hp * mult * dmgRatio * injury * 0.5 * res * 0.9
      closeTo(row.critical, base * (1 + cdmg + ultraCdmg), `长夜月 rank${rank} 终结技忆灵 暴击`)
      closeTo(row.expect, base * (1 + cpct * (cdmg + ultraCdmg)), `长夜月 rank${rank} 终结技忆灵 期望`)
    }
    {
      // 忆灵技-追忆蹁跹如雨(16层忆质)：(me长夜 + 4×me额外)×0.5（无至暗/忆灵暴伤转化）；
      // 1魂我方忆灵伤害 +50%
      const row = rows['忆灵技-追忆蹁跹如雨(16层忆质)']
      const mult = (at(CHANGYEYUE.meDmg, ME_LV) + at(CHANGYEYUE.meExtra, ME_LV) * 4) * 0.5
      const injury = 1 + allDmg + (rank >= 1 ? 0.5 : 0)
      const base = hp * mult * 1 * injury * 0.5 * res * 0.9
      closeTo(row.critical, base * (1 + cdmg), `长夜月 rank${rank} 忆灵技 暴击`)
      closeTo(row.expect, base * (1 + cpct * cdmg), `长夜月 rank${rank} 忆灵技 期望`)
    }
    {
      // 普攻：全额生命基数
      const row = rows['普攻伤害']
      const base = hp * at(CHANGYEYUE.aDmg, b) * 1 * (1 + allDmg) * 0.5 * res * 0.9
      closeTo(row.critical, base * (1 + cdmg), `长夜月 rank${rank} 普攻 暴击`)
      closeTo(row.expect, base * (1 + cpct * cdmg), `长夜月 rank${rank} 普攻 期望`)
    }
  }
})

test('丹恒•腾荒（1414）手算对照：rank0/rank6 强化龙灵追击（同袍攻击 3000 折算）', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1414, 'Physical', rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    const attack = 582.12 * (1 + 0.28 + 0.352) + 38.2 // 行迹攻击 28%
    const cpct = 0.05 + 0.425
    const cdmg = 0.5 + 0.796
    const comradeAtk = 3000 // miao defParams 默认同袍攻击
    {
      // 追击行 = 自身攻击×q追加[q] + 同袍攻击×(q附加[q]×[2魂×2] + 峥嵘 0.4)
      //（两段基数不同：钩子按 同袍/自身攻击比 折入倍率常量，无光锥/套装时精确）
      const row = rows['终结技强化龙灵追击']
      const mult = at(DANHENG.qZhui, q) + comradeAtk / attack * (at(DANHENG.qFuJia, q) * (rank >= 2 ? 2 : 1) + 0.4)
      const dmgRatio = 1 + (rank >= 6 ? 0.2 : 0) // 6魂易伤（仅追击行）
      const res = 1 + (rank >= 1 ? 0.18 : 0) // 1魂同袍全穿（仅追击行）
      const base = attack * mult * dmgRatio * 1 * 0.5 * res * 0.9
      closeTo(row.critical, base * (1 + cdmg), `丹恒•腾荒 rank${rank} 龙灵追击 暴击`)
      closeTo(row.expect, base * (1 + cpct * cdmg), `丹恒•腾荒 rank${rank} 龙灵追击 期望`)
    }
    {
      const row = rows['终结技伤害']
      const base = attack * at(DANHENG.qDmg, q) * 1 * 1 * 0.5 * 1 * 0.9
      closeTo(row.critical, base * (1 + cdmg), `丹恒•腾荒 rank${rank} 终结技 暴击`)
      closeTo(row.expect, base * (1 + cpct * cdmg), `丹恒•腾荒 rank${rank} 终结技 期望`)
    }
  }
})

/* ============================================================
 * 二、10 角色 rank0/rank6 完备性（有限正数、期望 ≤ 暴击、行数 = skillList 条目数）
 * ============================================================ */
const CHARS = {
  1401: ['大黑塔', 'Ice'], 1403: ['缇宝', 'Quantum'], 1404: ['万敌', 'Imaginary'],
  1405: ['那刻夏', 'Wind'], 1406: ['赛飞儿', 'Quantum'], 1408: ['白厄', 'Physical'],
  1410: ['海瑟音', 'Physical'], 1412: ['刻律德菈', 'Wind'], 1413: ['长夜月', 'Ice'],
  1414: ['丹恒•腾荒', 'Physical']
}
const ELEMENT_SET = { Fire: '107', Physical: '105', Ice: '104', Quantum: '108', Thunder: '109', Wind: '110', Imaginary: '112' }
const WEAPON_CYCLE = [
  { id: 23001, rank: 5 }, { id: 21010, rank: 1 }, { id: 20007, rank: 3 },
  { id: 20014, rank: 2 }, { id: 21024, rank: 4 }, { id: 0, rank: 1 }
]
test('3.x 10 角色 rank0/rank6：全伤害行有限正数、期望 ≤ 暴击', async (t) => {
  let totalRows = 0
  for (const [idStr, [name, element]] of Object.entries(CHARS)) {
    const id = Number(idStr)
    for (const rank of [0, 6]) {
      await t.test(`${name} rank${rank}`, () => {
        const bl = behavior(id, rank === 0 ? [8, 12, 13, 15] : [10, 14, 14, 14])
        if (idStr === '1413') bl.push({ id: 1413301, level: 10 }, { id: 1413302, level: 10 })
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
          skillTree: minorNodes(id), behaviorList: bl
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
 * 三、SkillData 覆盖检查（3.x 普攻表 miao 仅 9 级：E3 后 10 级越界收敛）
 * ============================================================ */
test('SkillData 覆盖：3.x 10 条目数组长度（普攻 9 级/忆灵技 10 级 miao 口径、其余 15 级）', () => {
  for (const idStr of Object.keys(CHARS)) {
    for (const [slot, arr] of Object.entries(skilldict[idStr])) {
      if (slot === 'skillList' || slot === 'Ultra_Use' || slot === 'Maze') continue
      assert.ok(Array.isArray(arr), `${idStr}.${slot} 应为数组`)
      // 普攻表 3.x 为 9 级（E3 后 10 级经引擎越界收敛）；忆灵技/忆灵天赋表 10 级；其余 15 级
      const required = slot === 'Normal' ? 9 : /^Me|^Mt/.test(slot) ? 10 : 15
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
    const ret = damage(panel(1401, 'Ice', rank, rank === 0 ? R0 : R6))
    seq.push(JSON.stringify(ret.damage.map(r => r.value)))
  }
  assert.equal(seq[0], seq[2], '大黑塔 rank6 两次计算应逐字段一致（不累积）')
  assert.equal(seq[1], seq[3], '大黑塔 rank0 两次计算应逐字段一致（回退正确）')
  assert.equal(seq[0], seq[4], '大黑塔 rank6 第三次计算应逐字段一致')
  for (const [id, elem] of [[1404, 'Imaginary'], [1405, 'Wind'], [1412, 'Wind'], [1413, 'Ice'], [1414, 'Physical']]) {
    const extra = id === 1413 ? [{ id: 1413301, level: 8 }, { id: 1413302, level: 8 }] : []
    const r6a = damage(panel(id, elem, 6, R6, extra))
    const r0 = damage(panel(id, elem, 0, R0, extra))
    const r6b = damage(panel(id, elem, 6, R6, extra))
    assert.equal(JSON.stringify(r6a.damage), JSON.stringify(r6b.damage), `${id} rank6 重算应一致`)
    assert.notEqual(JSON.stringify(r6a.damage), JSON.stringify(r0.damage), `${id} rank0/6 应不同`)
  }
})
