/**
 * 批次3 · C 组：1.x 同谐增益与辅助直伤角色（8 个）伤害数据抽查
 *   艾丝妲 1009 / 布洛妮娅 1101 / 停云 1202 / 罗刹 1203 / 驭空 1207 /
 *   桂乃芬 1210 / 寒鸦 1215 / 加拉赫 1301
 *
 * miao 仅普攻伤害行/普攻+终结技两行的增益型角色照抄不虚构；桂乃芬灼烧
 * DOT 行与加拉赫治疗/击破行引擎不支持。手算对照数值锚点为 miao-plugin
 * talent 表的独立快照（本文件硬编码，测试不依赖 miao-plugin 在场）。
 *
 * 手算公式：伤害 = 攻击 × 倍率 × 增伤区 × 防御区(1/(2-无视)) ×
 * 抗性区 × 0.9 × 暴击区（同级敌人、韧性未击破）
 *
 * 覆盖：
 *   - 8 角色 rank0/rank6 手算对照（核心输出行，暴击与期望双口径；
 *     布洛妮娅覆盖号令普攻必暴路径、罗刹覆盖 6魂全抗降）
 *   - 全伤害行完备性（有限正数、期望 ≤ 暴击、行数 = skillList 条目数）
 *   - SkillData 覆盖检查（普攻 9 级 miao 口径、其余 15 级；a2 表 9 级特例）
 *   - character.json 新条目（1215/1301）行迹小节点抽核
 *   - 批次3 终检：23 个 1.x 条目全部收录（总数随后续批次递增，下限 98）
 *   - 钩子状态：倍率数组改写幂等、rank 切换回退
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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
// 艾丝妲（e 技能 ×5 段 / t 攻击力提高）
const ASTA = {
  eDmg: [0.25, 0.275, 0.3, 0.325, 0.35, 0.375, 0.40625, 0.4375, 0.46875, 0.5, 0.525, 0.55, 0.575, 0.6, 0.625],
  tAtkPct: [0.07, 0.077, 0.084, 0.091, 0.098, 0.105, 0.11375, 0.1225, 0.13125, 0.14, 0.147, 0.154, 0.161, 0.168, 0.175]
}
// 布洛妮娅（a）
const BRONYA = {
  aDmg: [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3]
}
// 停云（a）
const TINGYUN = {
  aDmg: [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3]
}
// 罗刹（q）
const LUOCHA = {
  qDmg: [1.2, 1.28, 1.36, 1.44, 1.52, 1.6, 1.7, 1.8, 1.9, 2, 2.08, 2.16, 2.24, 2.32, 2.4]
}
// 驭空（q 技能 / e 攻击 / q 暴击 / q 暴伤）
const YUKONG = {
  qDmg: [2.28, 2.432, 2.584, 2.736, 2.888, 3.04, 3.23, 3.42, 3.61, 3.8, 3.952, 4.104, 4.256, 4.408, 4.56],
  eAtkPct: [0.4, 0.44, 0.48, 0.52, 0.56, 0.6, 0.65, 0.7, 0.75, 0.8, 0.84, 0.88, 0.92, 0.96, 1],
  qCpct: [0.21, 0.217, 0.224, 0.231, 0.238, 0.245, 0.25375, 0.2625, 0.27125, 0.28, 0.287, 0.294, 0.301, 0.308, 0.315],
  qCdmg: [0.39, 0.416, 0.442, 0.468, 0.494, 0.52, 0.5525, 0.585, 0.6175, 0.65, 0.676, 0.702, 0.728, 0.754, 0.78]
}
// 桂乃芬（q 技能 / t 吞火易伤）
const GUIYINGFENG = {
  qDmg: [0.72, 0.768, 0.816, 0.864, 0.912, 0.96, 1.02, 1.08, 1.14, 1.2, 1.248, 1.296, 1.344, 1.392, 1.44],
  tEnemyDmg: [0.04, 0.043, 0.046, 0.049, 0.052, 0.055, 0.05875, 0.0625, 0.06625, 0.07, 0.073, 0.076, 0.079, 0.082, 0.085]
}
// 寒鸦（a / e 技能 / t 罚恶增伤）
const HANYA = {
  aDmg: [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3],
  eDmg: [1.2, 1.32, 1.44, 1.56, 1.68, 1.8, 1.95, 2.1, 2.25, 2.4, 2.52, 2.64, 2.76, 2.88, 3],
  tDmgUp: [0.15, 0.165, 0.18, 0.195, 0.21, 0.225, 0.24375, 0.2625, 0.28125, 0.3, 0.315, 0.33, 0.345, 0.36, 0.375]
}
// 加拉赫（a / a2 强化普攻）
const GALLAGHER = {
  aDmg: [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3],
  a2Dmg: [1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.25]
}

/* ============================================================
 * 合成手算面板（遗器合计同批次2/3A/3B：攻击% 35.2 / 爆伤 79.6 / 暴击 42.5 /
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
  1009: { hpBase: 1023.12, attackBase: 511.56, defenseBase: 463.05, speedBase: 106 },
  1101: { hpBase: 1241.856, attackBase: 582.12, defenseBase: 533.61, speedBase: 99 },
  1202: { hpBase: 846.72, attackBase: 529.2, defenseBase: 396.9, speedBase: 112 },
  1203: { hpBase: 1280.664, attackBase: 756.756, defenseBase: 363.825, speedBase: 101 },
  1207: { hpBase: 917.28, attackBase: 599.76, defenseBase: 374.85, speedBase: 107 },
  1210: { hpBase: 882, attackBase: 582.12, defenseBase: 441, speedBase: 106 },
  1215: { hpBase: 917.28, attackBase: 564.48, defenseBase: 352.8, speedBase: 110 },
  1301: { hpBase: 1305.36, attackBase: 529.2, defenseBase: 441, speedBase: 98 }
}
// 行迹小节点聚合（character.json 201-210 level=1 属性合计，测试面板全点亮）
const NODES = {
  1009: { fire: 0.224, cpct: 0.067 },
  1101: { wind: 0.224, cdmg: 0.24 },
  1202: { thunder: 0.08, atk: 0.28 },
  1203: { atk: 0.28 },
  1207: { imaginary: 0.224, atk: 0.1 },
  1210: { fire: 0.224 },
  1215: { atk: 0.28 },
  1301: {}
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

test('艾丝妲（1009）手算对照：rank0/rank6 战技 5 段（蓄能满层攻击/点燃火伤）', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1009, 'Fire', rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    // 攻击：蓄能 5 层 = 天赋攻击力[t]×5
    const attack = 511.56 * (1 + 0.352 + at(ASTA.tAtkPct, t) * 5) + 38.2
    const cpct = 0.05 + 0.425 + NODES[1009].cpct
    const cdmg = 0.5 + 0.796
    // 行迹-点燃火伤+18% + 行迹火伤节点
    const injury = 1 + NODES[1009].fire + 0.18
    const mult = at(ASTA.eDmg, e) * 5
    const base = attack * mult * injury * 0.5 * 0.9
    checkRow(rows, '战技伤害(5段)', base, cdmg, cpct, `艾丝妲 rank${rank}`)
  }
})

test('布洛妮娅（1101）手算对照：rank0/rank6 普攻（军势增伤/号令普攻必暴）', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1101, 'Wind', rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    const attack = 582.12 * (1 + 0.352) + 38.2
    const cdmg = 0.5 + 0.796 + NODES[1101].cdmg
    // 行迹-号令：普攻暴击率提高至 100% → 期望 = 暴击
    const cpct = 1
    const injury = 1 + NODES[1101].wind + 0.1 // 行迹-军势 +10%
    const base = attack * at(BRONYA.aDmg, b) * injury * 0.5 * 0.9
    checkRow(rows, '普攻伤害', base, cdmg, cpct, `布洛妮娅 rank${rank}`)
  }
})

test('停云（1202）手算对照：rank0/rank6 普攻（止厄增伤/雷伤节点）', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1202, 'Thunder', rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    const attack = 529.2 * (1 + 0.352 + NODES[1202].atk) + 38.2
    const cpct = 0.05 + 0.425
    const cdmg = 0.5 + 0.796
    // 行迹-止厄普攻+40% + 雷伤节点
    const injury = 1 + NODES[1202].thunder + 0.4
    const base = attack * at(TINGYUN.aDmg, b) * injury * 0.5 * 0.9
    checkRow(rows, '普攻伤害', base, cdmg, cpct, `停云 rank${rank}`)
  }
})

test('罗刹（1203）手算对照：rank0/rank6 终结技（1魂结界攻击/6魂全抗降）', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1203, 'Imaginary', rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    // 1魂：结界中我方全体攻击+20%（含自身）
    const attack = 756.756 * (1 + 0.352 + NODES[1203].atk + (rank >= 1 ? 0.2 : 0)) + 38.2
    const cpct = 0.05 + 0.425
    const cdmg = 0.5 + 0.796
    const resArea = rank >= 6 ? 1.2 : 1 // 6魂终结技全属性抗性降低 20%
    const base = attack * at(LUOCHA.qDmg, q) * resArea * 0.5 * 0.9
    checkRow(rows, '终结技伤害', base, cdmg, cpct, `罗刹 rank${rank}`)
  }
})

test('驭空（1207）手算对照：rank0/rank6 终结技（鸣弦攻击/暴击暴伤/迟彝/4魂增伤）', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1207, 'Imaginary', rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    // 战技-天阙鸣弦攻击力[e] + 终结技-贯云饮羽暴击率[q]/暴伤[q]
    const attack = 599.76 * (1 + 0.352 + NODES[1207].atk + at(YUKONG.eAtkPct, e)) + 38.2
    const cpct = 0.05 + 0.425 + at(YUKONG.qCpct, q)
    const cdmg = 0.5 + 0.796 + at(YUKONG.qCdmg, q)
    // 行迹-迟彝虚数+12% + 虚数节点；4魂持有号令伤害+30%
    const injury = 1 + NODES[1207].imaginary + 0.12 + (rank >= 4 ? 0.3 : 0)
    const base = attack * at(YUKONG.qDmg, q) * injury * 0.5 * 0.9
    checkRow(rows, '终结技伤害', base, cdmg, cpct, `驭空 rank${rank}`)
  }
})

test('桂乃芬（1210）手算对照：rank0/rank6 终结技（吞火 3/4 层易伤/逾锋增伤）', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1210, 'Fire', rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    const attack = 582.12 * (1 + 0.352) + 38.2
    const cpct = 0.05 + 0.425
    const cdmg = 0.5 + 0.796
    // 天赋-吞火易伤[t]×层数（6魂 3→4 层）；行迹-逾锋+20% + 火伤节点
    const stacks = rank >= 6 ? 4 : 3
    const ratio = 1 + at(GUIYINGFENG.tEnemyDmg, t) * stacks
    const injury = 1 + NODES[1210].fire + 0.2
    const base = attack * at(GUIYINGFENG.qDmg, q) * injury * ratio * 0.5 * 0.9
    checkRow(rows, '终结技伤害', base, cdmg, cpct, `桂乃芬 rank${rank}`)
  }
})

test('寒鸦（1215）手算对照：rank0/rank6 战技与普攻（罚恶增伤/6魂+10%）', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1215, 'Physical', rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    const attack = 564.48 * (1 + 0.352 + NODES[1215].atk) + 38.2
    const cpct = 0.05 + 0.425
    const cdmg = 0.5 + 0.796
    // 天赋-罚恶普攻/战技增伤[t]；6魂额外+10%
    const dmgUp = at(HANYA.tDmgUp, t) + (rank >= 6 ? 0.1 : 0)
    {
      const base = attack * at(HANYA.eDmg, e) * (1 + dmgUp) * 0.5 * 0.9
      checkRow(rows, '战技伤害', base, cdmg, cpct, `寒鸦 rank${rank}`)
    }
    {
      const base = attack * at(HANYA.aDmg, b) * (1 + dmgUp) * 0.5 * 0.9
      checkRow(rows, '普攻伤害', base, cdmg, cpct, `寒鸦 rank${rank}`)
    }
  }
})

test('加拉赫（1301）手算对照：rank0/rank6 强化普攻（a2 表按普攻等级常量）', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1301, 'Fire', rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    const attack = 529.2 * (1 + 0.352) + 38.2
    const cpct = 0.05 + 0.425
    const cdmg = 0.5 + 0.796
    {
      // 强化普攻（Talent 槽位按普攻等级常量；rank6 普攻 10 收敛 9 级值）
      const base = attack * at(GALLAGHER.a2Dmg, b) * 0.5 * 0.9
      checkRow(rows, '强化普攻伤害', base, cdmg, cpct, `加拉赫 rank${rank}`)
    }
    {
      const base = attack * at(GALLAGHER.aDmg, b) * 0.5 * 0.9
      checkRow(rows, '普攻伤害', base, cdmg, cpct, `加拉赫 rank${rank}`)
    }
  }
})

/* ============================================================
 * 二、C 组 8 角色 rank0/rank6：全伤害行有限正数、期望 ≤ 暴击
 * ============================================================ */
const CHARS = {
  1009: ['艾丝妲', 'Fire'],
  1101: ['布洛妮娅', 'Wind'],
  1202: ['停云', 'Thunder'],
  1203: ['罗刹', 'Imaginary'],
  1207: ['驭空', 'Imaginary'],
  1210: ['桂乃芬', 'Fire'],
  1215: ['寒鸦', 'Physical'],
  1301: ['加拉赫', 'Fire']
}
const ELEMENT_SET = { Fire: '107', Physical: '105', Ice: '104', Quantum: '108', Thunder: '109', Wind: '110', Imaginary: '112' }
const WEAPON_CYCLE = [
  { id: 23001, rank: 5 }, { id: 21010, rank: 1 }, { id: 20007, rank: 3 },
  { id: 20014, rank: 2 }, { id: 21024, rank: 4 }, { id: 0, rank: 1 },
  { id: 23001, rank: 5 }
]
test('C 组 8 角色 rank0/rank6：全伤害行有限正数、期望 ≤ 暴击', async (t) => {
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
 * 三、SkillData 覆盖检查 + character.json 新条目抽核
 * ============================================================ */
test('SkillData 覆盖：C 组 8 条目数组长度（普攻 9 级 miao 口径、其余 15 级）', () => {
  for (const idStr of Object.keys(CHARS)) {
    for (const [slot, arr] of Object.entries(skilldict[idStr])) {
      if (slot === 'skillList' || slot === 'Ultra_Use' || slot === 'Maze') continue
      assert.ok(Array.isArray(arr), `${idStr}.${slot} 应为数组`)
      // 加拉赫 Talent 为强化普攻(a2)表，仅 9 级（普攻等级联动，越界收敛）
      const shortSlots = idStr === '1301' && slot === 'Talent'
      const required = slot === 'Normal' || shortSlots ? 9 : 15
      assert.ok(arr.length >= required,
        `${idStr}.${slot} 长度 ${arr.length} 应 ≥ ${required}`)
    }
  }
})

test('character.json 新条目：1215/1301 行迹小节点属性抽核（引擎 skillTree 通路）', () => {
  const charDict = JSON.parse(readFileSync(new URL('../../../utils/damage/json/character.json', import.meta.url), 'utf8'))
  // 寒鸦：201 攻击 4%（levelReq=1 锚定）/209 速度 4（平速）/210 攻击 8%
  const h201 = charDict['1215']['1215201'].levels[0].properties[0]
  assert.equal(h201.type, 'AttackAddedRatio')
  closeTo(h201.value, 0.04, '寒鸦 201 攻击强化')
  const h209 = charDict['1215']['1215209'].levels[0].properties[0]
  assert.equal(h209.type, 'SpeedDelta')
  closeTo(h209.value, 4, '寒鸦 209 速度强化')
  const h210 = charDict['1215']['1215210'].levels[0].properties[0]
  assert.equal(h210.type, 'AttackAddedRatio')
  closeTo(h210.value, 0.08, '寒鸦 210 攻击强化')
  // 加拉赫：201 效果抵抗 4%（levelReq=1 锚定）/206 击破 8%/210 生命 8%
  const g201 = charDict['1301']['1301201'].levels[0].properties[0]
  assert.equal(g201.type, 'StatusResistanceBase')
  closeTo(g201.value, 0.04, '加拉赫 201 效果抵抗强化')
  const g206 = charDict['1301']['1301206'].levels[0].properties[0]
  assert.equal(g206.type, 'BreakDamageAddedRatioBase')
  closeTo(g206.value, 0.08, '加拉赫 206 击破强化')
  const g210 = charDict['1301']['1301210'].levels[0].properties[0]
  assert.equal(g210.type, 'HPAddedRatio')
  closeTo(g210.value, 0.08, '加拉赫 210 生命强化')
  // 1224（A 组新增）树值修正抽核：204 防 5% / 208 防 7.5%（miao treeData 4.8 笔误修正）
  const m204 = charDict['1224']['1224204'].levels[0].properties[0]
  assert.equal(m204.type, 'DefenceAddedRatio')
  closeTo(m204.value, 0.05, '三月七·巡猎 204 防御强化')
  const m208 = charDict['1224']['1224208'].levels[0].properties[0]
  assert.equal(m208.type, 'DefenceAddedRatio')
  closeTo(m208.value, 0.075, '三月七·巡猎 208 防御强化（4.8 笔误修正为 7.5）')
})

/* ============================================================
 * 四、批次3 终检：23 个 1.x 条目全部收录
 * ============================================================ */
test('批次3 终检：23 个 1.x 剩余条目全部收录（总数随后续批次递增，下限 98）', () => {
  const ids = Object.keys(skilldict)
  assert.ok(ids.length >= 98, `SkillData 条目数应 ≥ 98（实际 ${ids.length}）`)
  const batch3 = ['1001', '1002', '1008', '1009', '1013', '1101', '1103', '1104',
    '1105', '1106', '1108', '1109', '1110', '1111', '1202', '1203', '1206',
    '1207', '1210', '1211', '1215', '1224', '1301']
  for (const id of batch3) {
    assert.ok(skilldict[id] && skilldict[id].skillList && Object.keys(skilldict[id].skillList).length > 0,
      `${id} 应有 skillList 伤害行`)
  }
})

/* ============================================================
 * 五、钩子状态：倍率数组改写幂等、rank 切换回退
 * ============================================================ */
test('钩子状态：rank6→rank0→rank6 交替计算，输出不累积且正确回退', () => {
  const seq = []
  for (const rank of [6, 0, 6, 0, 6]) {
    const ret = damage(panel(1301, 'Fire', rank, rank === 0 ? R0 : R6))
    seq.push(JSON.stringify(ret.damage.map(r => r.value)))
  }
  assert.equal(seq[0], seq[2], '加拉赫 rank6 两次计算应逐字段一致（不累积）')
  assert.equal(seq[1], seq[3], '加拉赫 rank0 两次计算应逐字段一致（回退正确）')
  assert.equal(seq[0], seq[4], '加拉赫 rank6 第三次计算应逐字段一致')
  for (const [id, elem] of [[1009, 'Fire'], [1203, 'Imaginary'], [1207, 'Imaginary'], [1210, 'Fire'], [1215, 'Physical']]) {
    const r6a = damage(panel(id, elem, 6, R6))
    const r0 = damage(panel(id, elem, 0, R0))
    const r6b = damage(panel(id, elem, 6, R6))
    assert.equal(JSON.stringify(r6a.damage), JSON.stringify(r6b.damage), `${id} rank6 重算应一致`)
    assert.notEqual(JSON.stringify(r6a.damage), JSON.stringify(r0.damage), `${id} rank0/6 应不同`)
  }
})
