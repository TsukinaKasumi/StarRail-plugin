/**
 * 批次3 · B 组：1.x 存护·虚无·丰饶角色（7 个）伤害数据抽查
 *   三月七 1001 / 杰帕德 1104 / 娜塔莎 1105 / 佩拉 1106 / 桑博 1108 /
 *   玲可 1110 / 白露 1211
 *
 * 引擎无护盾/治疗/DOT 通道（护盾、治疗、桑博风化行整体跳过）；玲可普攻为
 * 生命倍率（注入生命为攻击基数，同 1217 藿藿）；三月七 4魂反击、娜塔莎
 * 6魂普攻附加按「flat 伤害折入倍率 = 固定值/攻击」换算，基线缓存可回退。
 * 手算对照数值锚点为 miao-plugin talent 表的独立快照（本文件硬编码，
 * 测试不依赖 miao-plugin 在场）。
 *
 * 手算公式：伤害 = 攻击(或注入生命) × 倍率 × 增伤区 × 防御区(1/(2-无视)) ×
 * 抗性区 × 0.9 × 暴击区（同级敌人、韧性未击破）
 *
 * 覆盖：
 *   - 7 角色 rank0/rank6 手算对照（核心输出行，暴击与期望双口径）
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
// 三月七（q 技能 + q 冻结附加 / t 反击 / a）
const MARCH7 = {
  aDmg: [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3],
  qDmg: [0.9, 0.96, 1.02, 1.08, 1.14, 1.2, 1.275, 1.35, 1.425, 1.5, 1.56, 1.62, 1.68, 1.74, 1.8],
  qFreeze: [0.3, 0.33, 0.36, 0.39, 0.42, 0.45, 0.4875, 0.525, 0.5625, 0.6, 0.63, 0.66, 0.69, 0.72, 0.75],
  tCounter: [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8125, 0.875, 0.9375, 1, 1.05, 1.1, 1.15, 1.2, 1.25]
}
// 杰帕德（e 技能伤害）
const GEPARD = {
  eDmg: [1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.625, 1.75, 1.875, 2, 2.1, 2.2, 2.3, 2.4, 2.5]
}
// 娜塔莎（a 技能伤害）
const NATASHA = {
  aDmg: [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3]
}
// 佩拉（q 技能伤害 + q 防御降低）
const PELA = {
  qDmg: [0.6, 0.64, 0.68, 0.72, 0.76, 0.8, 0.85, 0.9, 0.95, 1, 1.04, 1.08, 1.12, 1.16, 1.2],
  qDefDown: [0.3, 0.31, 0.32, 0.33, 0.34, 0.35, 0.3625, 0.375, 0.3875, 0.4, 0.41, 0.42, 0.43, 0.44, 0.45]
}
// 桑博（e 技能伤害 ×5 段）
const SAMPO = {
  eDmg: [0.28, 0.308, 0.336, 0.364, 0.392, 0.42, 0.455, 0.49, 0.525, 0.56, 0.588, 0.616, 0.644, 0.672, 0.7]
}
// 玲可（a 技能伤害，生命倍率）
const LYNX = {
  aDmg: [0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65]
}
// 白露（a 技能伤害）
const BAILU = {
  aDmg: [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3]
}

/* ============================================================
 * 合成手算面板（遗器合计同批次2/3A：攻击% 35.2 / 爆伤 79.6 / 暴击 42.5 /
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
  1001: { hpBase: 1058.4, attackBase: 511.56, defenseBase: 573.3, speedBase: 101 },
  1104: { hpBase: 1397.088, attackBase: 543.312, defenseBase: 654.885, speedBase: 92 },
  1105: { hpBase: 1164.24, attackBase: 476.28, defenseBase: 507.15, speedBase: 98 },
  1106: { hpBase: 987.84, attackBase: 546.84, defenseBase: 463.05, speedBase: 105 },
  1108: { hpBase: 1023.12, attackBase: 617.4, defenseBase: 396.9, speedBase: 102 },
  1110: { hpBase: 1058.4, attackBase: 493.92, defenseBase: 551.25, speedBase: 100 },
  1211: { hpBase: 1319.472, attackBase: 562.716, defenseBase: 485.1, speedBase: 98 }
}
// 行迹小节点聚合（character.json 201-210 level=1 属性合计，测试面板全点亮）
const NODES = {
  1001: { ice: 0.224, def: 0.225 },
  1104: { ice: 0.224, def: 0.125 },
  1105: { hp: 0.28 },
  1106: { ice: 0.224, atk: 0.18 },
  1108: { atk: 0.28 },
  1110: { hp: 0.28 },
  1211: {}
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

test('三月七（1001）手算对照：rank0/rank6 反击（4魂防御折算）与冻结附加', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1001, 'Ice', rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    const attack = 511.56 * (1 + 0.352) + 38.2
    const cpct = 0.05 + 0.425
    const cdmg = 0.5 + 0.796
    const iceInjury = 1 + NODES[1001].ice
    {
      // 反击：4魂提高数值 = 防御 ×30%（折入倍率，面板时点换算）
      const defence = 573.3 * (1 + NODES[1001].def)
      const mult = at(MARCH7.tCounter, t) + (rank >= 4 ? defence * 0.3 / attack : 0)
      const base = attack * mult * iceInjury * 0.5 * 0.9
      checkRow(rows, '天赋反击伤害', base, cdmg, cpct, `三月七 rank${rank}`)
    }
    {
      // 冻结附加（BPSkill 槽位按终结技等级常量）
      const base = attack * at(MARCH7.qFreeze, q) * iceInjury * 0.5 * 0.9
      checkRow(rows, '终结技冻结附加伤害', base, cdmg, cpct, `三月七 rank${rank}`)
    }
  }
})

test('杰帕德（1104）手算对照：rank0/rank6 战技（行迹-战意 防御→攻击折算）', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1104, 'Ice', rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    // 行迹-战意：攻击力 + 面板防御 ×35%
    const defence = 654.885 * (1 + NODES[1104].def)
    const attack = 543.312 * (1 + 0.352) + 38.2 + defence * 0.35
    const cpct = 0.05 + 0.425
    const cdmg = 0.5 + 0.796
    const iceInjury = 1 + NODES[1104].ice
    const base = attack * at(GEPARD.eDmg, e) * iceInjury * 0.5 * 0.9
    checkRow(rows, '战技伤害', base, cdmg, cpct, `杰帕德 rank${rank}`)
  }
})

test('娜塔莎（1105）手算对照：rank0/rank6 普攻（6魂生命上限 40% 附加折算）', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1105, 'Physical', rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    const attack = 476.28 * (1 + 0.352) + 38.2
    const hp = 1164.24 * (1 + 0.432 + NODES[1105].hp) + 1371.4
    const cpct = 0.05 + 0.425
    const cdmg = 0.5 + 0.796
    // 6魂：普攻附加生命上限 40% 的物理伤害（折入倍率，面板时点换算）
    const mult = at(NATASHA.aDmg, b) + (rank >= 6 ? hp * 0.4 / attack : 0)
    const base = attack * mult * 0.5 * 0.9
    checkRow(rows, '普攻伤害', base, cdmg, cpct, `娜塔莎 rank${rank}`)
  }
})

test('佩拉（1106）手算对照：rank0/rank6 终结技（通解减防按无视防御/痛击追歼增伤/4魂冰抗降）', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1106, 'Ice', rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    const attack = 546.84 * (1 + 0.352 + NODES[1106].atk) + 38.2
    const cpct = 0.05 + 0.425
    const cdmg = 0.5 + 0.796
    // 终结技-【通解】防御降低[q]（按无视防御计）
    const defArea = 1 / (2 - at(PELA.qDefDown, q))
    // 行迹-痛击 +20% 与追歼 +20%（miao 默认常驻）+ 冰伤节点
    const injury = 1 + NODES[1106].ice + 0.4
    const resArea = rank >= 4 ? 1.12 : 1 // 4魂冰抗性降低 12%
    const base = attack * at(PELA.qDmg, q) * injury * defArea * resArea * 0.9
    checkRow(rows, '终结技伤害', base, cdmg, cpct, `佩拉 rank${rank}`)
  }
})

test('桑博（1108）手算对照：rank0/rank6 战技 5 段/1魂 6 段（miao 折总口径）', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1108, 'Wind', rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    const attack = 617.4 * (1 + 0.352 + NODES[1108].atk) + 38.2
    const cpct = 0.05 + 0.425
    const cdmg = 0.5 + 0.796
    // 战技 5 段合计；1魂对随机单体额外 1 段（合计 6 段）
    const mult = at(SAMPO.eDmg, e) * (rank >= 1 ? 6 : 5)
    const base = attack * mult * 0.5 * 0.9
    checkRow(rows, '战技伤害(5段)', base, cdmg, cpct, `桑博 rank${rank}`)
  }
})

test('玲可（1110）手算对照：rank0/rank6 生命倍率普攻（注入生命为攻击基数）', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1110, 'Quantum', rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    // 普攻为生命倍率：注入后攻击基数 = 面板生命
    const hp = 1058.4 * (1 + 0.432 + NODES[1110].hp) + 1371.4
    const cpct = 0.05 + 0.425
    const cdmg = 0.5 + 0.796
    const base = hp * at(LYNX.aDmg, b) * 0.5 * 0.9
    checkRow(rows, '普攻伤害', base, cdmg, cpct, `玲可 rank${rank}`)
  }
})

test('白露（1211）手算对照：rank0/rank6 普攻（无直伤 buff 基线行）', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1211, 'Thunder', rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    const attack = 562.716 * (1 + 0.352) + 38.2
    const cpct = 0.05 + 0.425
    const cdmg = 0.5 + 0.796
    const base = attack * at(BAILU.aDmg, b) * 0.5 * 0.9
    checkRow(rows, '普攻伤害', base, cdmg, cpct, `白露 rank${rank}`)
  }
})

/* ============================================================
 * 二、B 组 7 角色 rank0/rank6：全伤害行有限正数、期望 ≤ 暴击
 * ============================================================ */
const CHARS = {
  1001: ['三月七', 'Ice'],
  1104: ['杰帕德', 'Ice'],
  1105: ['娜塔莎', 'Physical'],
  1106: ['佩拉', 'Ice'],
  1108: ['桑博', 'Wind'],
  1110: ['玲可', 'Quantum'],
  1211: ['白露', 'Thunder']
}
const ELEMENT_SET = { Fire: '107', Physical: '105', Ice: '104', Quantum: '108', Thunder: '109', Wind: '110', Imaginary: '112' }
const WEAPON_CYCLE = [
  { id: 23001, rank: 5 }, { id: 21010, rank: 1 }, { id: 20007, rank: 3 },
  { id: 20014, rank: 2 }, { id: 21024, rank: 4 }, { id: 0, rank: 1 },
  { id: 23001, rank: 5 }
]
test('B 组 7 角色 rank0/rank6：全伤害行有限正数、期望 ≤ 暴击', async (t) => {
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
test('SkillData 覆盖：B 组 7 条目数组长度（普攻 9 级 miao 口径、其余 15 级）', () => {
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
 * 四、钩子状态：倍率数组改写幂等、rank 切换回退
 * ============================================================ */
test('钩子状态：rank6→rank0→rank6 交替计算，输出不累积且正确回退', () => {
  const seq = []
  for (const rank of [6, 0, 6, 0, 6]) {
    const ret = damage(panel(1105, 'Physical', rank, rank === 0 ? R0 : R6))
    seq.push(JSON.stringify(ret.damage.map(r => r.value)))
  }
  assert.equal(seq[0], seq[2], '娜塔莎 rank6 两次计算应逐字段一致（不累积）')
  assert.equal(seq[1], seq[3], '娜塔莎 rank0 两次计算应逐字段一致（回退正确）')
  assert.equal(seq[0], seq[4], '娜塔莎 rank6 第三次计算应逐字段一致')
  for (const [id, elem] of [[1001, 'Ice'], [1108, 'Wind'], [1104, 'Ice'], [1106, 'Ice'], [1110, 'Quantum']]) {
    const r6a = damage(panel(id, elem, 6, R6))
    const r0 = damage(panel(id, elem, 0, R0))
    const r6b = damage(panel(id, elem, 6, R6))
    assert.equal(JSON.stringify(r6a.damage), JSON.stringify(r6b.damage), `${id} rank6 重算应一致`)
    assert.notEqual(JSON.stringify(r6a.damage), JSON.stringify(r0.damage), `${id} rank0/6 应不同`)
  }
})
