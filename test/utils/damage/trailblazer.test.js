/**
 * 批次4 · 最终批：开拓者 6 个旧形态伤害数据抽查
 *   穹·毁灭 8001 / 星·毁灭 8002 / 穹·存护 8003 / 星·存护 8004 /
 *   穹·同谐 8005 / 星·同谐 8006
 *
 * 每对穹/星同命途形态技能组相同（miao 源数据经 gen-batch4 校验一致），
 * SkillData 两份条目 + 钩子共享函数，本文件断言配对形态输出逐字段一致。
 *
 * 引擎无护盾/击破通道：存护天赋护盾量行、同谐超击破/文本行跳过（披露）；
 * 毁灭 4魂（对弱点击破目标暴击率+25%）与存护行迹-行胜思（持护盾攻击+15%）
 * 为 miao calc 未收录的条件加成，照抄 miao 不虚构（披露）。
 *
 * 手算公式：伤害 = 攻击 × 倍率 × 增伤区 × 防御区(0.5，同级无无视) × 抗性区 × 0.9 × 暴击区
 * 数值锚点为 miao-plugin talent 表独立快照（本文件硬编码，测试不依赖 miao-plugin 在场）。
 * 存护防御倍率折入：mult = 攻击倍率 + 防御倍率 × def/atk（钩子按面板重算，
 * 与 miao basic(atkTd×atk + defTd×def) 代数等价，round10 精度内一致）。
 *
 * 覆盖：
 *   - 毁灭/存护/同谐代表形态 rank0/rank6 手算对照（全部伤害行，暴击与期望双口径）
 *   - 三对配对形态输出逐字段一致（rank0/rank6）
 *   - 全 6 形态 rank0/rank6 完备性（有限正数、期望 ≤ 暴击、行数 = skillList 条目数）
 *   - SkillData 覆盖检查（普攻 9 级 miao 口径、其余 15 级、Ultra_Use 能量上限）
 *   - character.json 新条目（8005/8006）行迹小节点属性抽核
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
const round10 = v => Math.round(v * 1e10) / 1e10

/* ============================================================
 * 数值锚点：miao-plugin talent 表快照（2026-10 提取，独立于 SkillData.json）
 * ============================================================ */
// 毁灭（a 技能 / e 技能 / q 单体·扩散·相邻 / t 攻击力提高）
const DES = {
  aDmg: [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3],
  eDmg: [0.625, 0.6875, 0.75, 0.8125, 0.875, 0.9375, 1.01563, 1.09375, 1.17188, 1.25, 1.3125, 1.375, 1.4375, 1.5, 1.5625],
  qSingle: [3, 3.15, 3.3, 3.45, 3.6, 3.75, 3.9375, 4.125, 4.3125, 4.5, 4.65, 4.8, 4.95, 5.1, 5.25],
  qBlast: [1.8, 1.89, 1.98, 2.07, 2.16, 2.25, 2.3625, 2.475, 2.5875, 2.7, 2.79, 2.88, 2.97, 3.06, 3.15],
  qAdj: [1.08, 1.134, 1.188, 1.242, 1.296, 1.35, 1.4175, 1.485, 1.5525, 1.62, 1.674, 1.728, 1.782, 1.836, 1.89],
  tAtkPct: [0.1, 0.11, 0.12, 0.13, 0.14, 0.15, 0.1625, 0.175, 0.1875, 0.2, 0.21, 0.22, 0.23, 0.24, 0.25]
}
// 存护（a 技能 / a2 主·邻 / q 攻击力倍率·防御力倍率）
const PRE = {
  aDmg: [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3],
  a2Main: [0.9, 0.99, 1.08, 1.17, 1.26, 1.35, 1.4625, 1.575, 1.6875],
  a2Adj: [0.36, 0.396, 0.432, 0.468, 0.504, 0.54, 0.585, 0.63, 0.675],
  qAtk: [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8125, 0.875, 0.9375, 1, 1.05, 1.1, 1.15, 1.2, 1.25],
  qDef: [0.75, 0.825, 0.9, 0.975, 1.05, 1.125, 1.21875, 1.3125, 1.40625, 1.5, 1.575, 1.65, 1.725, 1.8, 1.875]
}
// 同谐（e 技能，每段）
const HAR = {
  eDmg: [0.25, 0.275, 0.3, 0.325, 0.35, 0.375, 0.40625, 0.4375, 0.46875, 0.5, 0.525, 0.55, 0.575, 0.6, 0.625]
}

/* ============================================================
 * 合成手算面板（遗器合计同批次3：攻击% 35.2 / 爆伤 79.6 / 暴击 42.5 /
 * 击破特攻 26.4 / 效果命中 10.8 / 生命% 43.2 / 速度 25 /
 * 固定生命 1371.4 / 固定攻击 38.2；行迹小节点属性取 character.json 聚合）
 * Lv80 基础属性 = miao data.json baseAttr（穹/星同命途形态一致）
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
  8001: { hpBase: 1203.048, attackBase: 620.928, defenseBase: 460.845, speedBase: 100 },
  8002: { hpBase: 1203.048, attackBase: 620.928, defenseBase: 460.845, speedBase: 100 },
  8003: { hpBase: 1241.856, attackBase: 601.524, defenseBase: 606.375, speedBase: 95 },
  8004: { hpBase: 1241.856, attackBase: 601.524, defenseBase: 606.375, speedBase: 95 },
  8005: { hpBase: 1086.624, attackBase: 446.292, defenseBase: 679.14, speedBase: 105 },
  8006: { hpBase: 1086.624, attackBase: 446.292, defenseBase: 679.14, speedBase: 105 }
}
// 行迹小节点聚合（character.json 201-210 level=1 属性合计，测试面板全点亮）
const NODES = {
  8001: { atk: 0.28 },
  8003: { atk: 0.18, def: 0.35 },
  8005: { stance: 0.373, imaginary: 0.144 }
}
const R0 = [6, 8, 10, 10]
const R6 = [10, 14, 14, 14] // 星魂满后等级（普攻 10 越过表长 9 时由引擎收敛到 9 级值）
function panel (id, elem, rank, levels, withTree = true) {
  return {
    avatarId: id, name: '手算', level: 80, rank, damage_type: elem,
    properties: PROPS[id], relics: RELICS,
    equipment: { id: 0, rank: 1 }, relic_sets: [],
    skillTree: withTree ? minorNodes(id) : [], behaviorList: behavior(id, levels)
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

test('穹·毁灭（8001）手算对照：rank0/rank6 全 5 行（天赋攻击/坚韧/斗志/终结技双模式）', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(8001, 'Physical', rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    // 攻击：620.928 ×(1 + 遗器 35.2% + 行迹攻击 28% + 天赋-牵制盗垒[t]，miao 按单层) + 38.2
    const attack = 620.928 * (1 + 0.352 + NODES[8001].atk + at(DES.tAtkPct, t)) + 38.2
    const cpct = 0.05 + 0.425
    const cdmg = 0.5 + 0.796
    {
      // 普攻：无任何命中的增伤（斗志仅战技/终结技主目标）
      const base = attack * at(DES.aDmg, b) * 0.5 * 0.9
      checkRow(rows, '普攻伤害', base, cdmg, cpct, `毁灭 rank${rank}`)
    }
    {
      // 战技：行迹-斗志 +25%（BPSkill 槽位键）
      const base = attack * at(DES.eDmg, e) * 1.25 * 0.5 * 0.9
      checkRow(rows, '战技伤害', base, cdmg, cpct, `毁灭 rank${rank}`)
    }
    {
      // 终结技单体模式（【全胜•再见安打】，不吃斗志）
      const base = attack * at(DES.qSingle, q) * 0.5 * 0.9
      checkRow(rows, '终结技单体伤害', base, cdmg, cpct, `毁灭 rank${rank}`)
    }
    {
      // 终结技主目标（Talent 槽位按终结技等级常量；斗志经 TalentDmgAdd 命中）
      const base = attack * at(DES.qBlast, q) * 1.25 * 0.5 * 0.9
      checkRow(rows, '终结技伤害·主目标', base, cdmg, cpct, `毁灭 rank${rank}`)
    }
    {
      // 终结技副目标（Xe 槽位按终结技等级常量，不吃斗志）
      const base = attack * at(DES.qAdj, q) * 0.5 * 0.9
      checkRow(rows, '终结技伤害·副目标', base, cdmg, cpct, `毁灭 rank${rank}`)
    }
  }
})

test('穹·存护（8003）手算对照：rank0/rank6 全 3 行（1魂防御附加折入/6魂满层防御/复合倍率终结技）', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(8003, 'Fire', rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    // 攻击：601.524 ×(1 + 遗器 35.2% + 行迹攻击 18%) + 38.2（无攻击向命魂）
    const attack = 601.524 * (1 + 0.352 + NODES[8003].atk) + 38.2
    // 防御：606.375 ×(1 + 行迹防御 35% + 6魂满层 30%)
    const defence = 606.375 * (1 + NODES[8003].def + (rank >= 6 ? 0.3 : 0))
    const ratio = defence / attack
    const cpct = 0.05 + 0.425
    const cdmg = 0.5 + 0.796
    {
      // 普攻：1魂附加 25% 防御力火伤（折入倍率，round10 同钩子口径）
      const mult = round10(at(PRE.aDmg, b) + (rank >= 1 ? ratio * 0.25 : 0))
      const base = attack * mult * 0.5 * 0.9
      checkRow(rows, '普攻伤害', base, cdmg, cpct, `存护 rank${rank}`)
    }
    {
      // 强化普攻扩散总伤 = a2主 + 2×a2邻（Talent 槽位按普攻等级常量）；
      // 1魂附加 50%×3 防御（主目标 + 2 相邻各 50%）
      const mult = round10(at(PRE.a2Main, b) + at(PRE.a2Adj, b) * 2 +
        (rank >= 1 ? ratio * 0.5 * 3 : 0))
      const base = attack * mult * 0.5 * 0.9
      checkRow(rows, '强化普攻扩散伤害', base, cdmg, cpct, `存护 rank${rank}`)
    }
    {
      // 终结技：攻击力倍率[q] + 防御力倍率[q]×def/atk（对位折入，round10 同钩子口径）
      const mult = round10(at(PRE.qAtk, q) + at(PRE.qDef, q) * ratio)
      const base = attack * mult * 0.5 * 0.9
      checkRow(rows, '终结技伤害', base, cdmg, cpct, `存护 rank${rank}`)
    }
  }
})

test('穹·同谐（8005）手算对照：rank0/rank6 战技 5 段/7 段（行迹虚数增伤）', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(8005, 'Imaginary', rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    // 攻击：446.292 ×(1 + 遗器 35.2%) + 38.2（8005 行迹无攻击节点、无攻击向命魂）
    const attack = 446.292 * (1 + 0.352) + 38.2
    const cpct = 0.05 + 0.425
    const cdmg = 0.5 + 0.796
    // 战技 = 每段[e] ×(6魂 7 段，否则 5 段)；行迹虚数节点 +14.4% 增伤
    const count = rank >= 6 ? 7 : 5
    const base = attack * at(HAR.eDmg, e) * count * (1 + NODES[8005].imaginary) * 0.5 * 0.9
    checkRow(rows, '战技伤害', base, cdmg, cpct, `同谐 rank${rank}`)
  }
})

/* ============================================================
 * 二、配对一致性：穹/星同命途形态输出逐字段一致
 * ============================================================ */
test('配对一致性：8001==8002 / 8003==8004 / 8005==8006（rank0/rank6 逐字段一致）', () => {
  const PAIRS = [
    [8001, 8002, 'Physical', '毁灭'],
    [8003, 8004, 'Fire', '存护'],
    [8005, 8006, 'Imaginary', '同谐']
  ]
  for (const [m, f, elem, name] of PAIRS) {
    for (const rank of [0, 6]) {
      const rm = damage(panel(m, elem, rank, rank === 0 ? R0 : R6))
      const rf = damage(panel(f, elem, rank, rank === 0 ? R0 : R6))
      assert.ok(rm && rf, `${name} 配对应可计算`)
      // 顶层 id 各自为形态 ID，其余（行序/标题/数值）应逐字段一致
      assert.equal(rf.id, String(f))
      assert.equal(rm.id, String(m))
      assert.deepEqual(rf.damage, rm.damage, `${name} 星(${f}) 与 穹(${m}) rank${rank} 输出应逐字段一致`)
    }
  }
})

/* ============================================================
 * 三、全 6 形态 rank0/rank6：全伤害行有限正数、期望 ≤ 暴击
 * ============================================================ */
const CHARS = {
  8001: ['穹·毁灭', 'Physical'],
  8002: ['星·毁灭', 'Physical'],
  8003: ['穹·存护', 'Fire'],
  8004: ['星·存护', 'Fire'],
  8005: ['穹·同谐', 'Imaginary'],
  8006: ['星·同谐', 'Imaginary']
}
const ELEMENT_SET = { Fire: '107', Physical: '105', Ice: '104', Quantum: '108', Thunder: '109', Wind: '110', Imaginary: '112' }
const WEAPON_CYCLE = [
  { id: 23001, rank: 5 }, { id: 21010, rank: 1 }, { id: 20007, rank: 3 },
  { id: 20014, rank: 2 }, { id: 21024, rank: 4 }, { id: 0, rank: 1 },
  { id: 23001, rank: 5 }
]
test('6 形态 rank0/rank6：全伤害行有限正数、期望 ≤ 暴击', async (t) => {
  let totalRows = 0
  for (const [idStr, [name, element]] of Object.entries(CHARS)) {
    const id = Number(idStr)
    await t.test(`${name} rank`, async (t2) => {
      for (const rank of [0, 6]) {
        await t2.test(`rank${rank}`, () => {
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
    })
  }
  t.diagnostic(`共检查 ${totalRows} 个伤害行`)
})

/* ============================================================
 * 四、SkillData 覆盖检查
 * ============================================================ */
test('SkillData 覆盖：6 条目数组长度（普攻/强化普攻 9 级 miao 口径、其余 15 级）与 Ultra_Use', () => {
  const shortTalent = { 8003: '强化普攻(a2) 9 级', 8004: '强化普攻(a2) 9 级' }
  for (const idStr of Object.keys(CHARS)) {
    for (const [slot, arr] of Object.entries(skilldict[idStr])) {
      if (slot === 'skillList' || slot === 'Ultra_Use' || slot === 'Maze') continue
      assert.ok(Array.isArray(arr), `${idStr}.${slot} 应为数组`)
      // 存护 Talent 为强化普攻(a2) 组合表，仅 9 级（普攻等级联动，越界收敛）
      const shortSlots = idStr in shortTalent && slot === 'Talent'
      const required = slot === 'Normal' || shortSlots ? 9 : 15
      assert.ok(arr.length >= required,
        `${idStr}.${slot} 长度 ${arr.length} 应 ≥ ${required}`)
    }
  }
  // Ultra_Use = miao data.json sp（终结技能量上限）：毁灭/存护 120、同谐 140
  assert.deepEqual(skilldict['8001'].Ultra_Use, [120])
  assert.deepEqual(skilldict['8004'].Ultra_Use, [120])
  assert.deepEqual(skilldict['8006'].Ultra_Use, [140])
  // 同谐两档段数数组（隐藏位不被钩子改写；展示位 BPSkill 会被 rank6 钩子切换为
  // 7 段档——rank0 手算已覆盖 5 段默认档，此处不读展示位避免测试顺序依赖）
  for (const idStr of ['8005', '8006']) {
    for (let i = 0; i < 15; i++) {
      closeTo(skilldict[idStr].BPSkill5[i], round10(HAR.eDmg[i] * 5), `${idStr} 5 段档第 ${i + 1} 级`)
      closeTo(skilldict[idStr].BPSkill7[i], round10(HAR.eDmg[i] * 7), `${idStr} 7 段档第 ${i + 1} 级`)
    }
  }
})

/* ============================================================
 * 五、character.json 新条目（8005/8006）行迹小节点抽核 + 引擎 skillTree 通路
 * ============================================================ */
test('character.json 新条目：8005/8006 行迹小节点属性抽核（引擎 skillTree 通路）', () => {
  const charDict = JSON.parse(readFileSync(new URL('../../../utils/damage/json/character.json', import.meta.url), 'utf8'))
  const expectNodes = [
    ['BreakDamageAddedRatioBase', 0.053], ['ImaginaryAddedRatio', 0.032],
    ['BreakDamageAddedRatioBase', 0.053], ['StatusResistanceBase', 0.04],
    ['BreakDamageAddedRatioBase', 0.08], ['ImaginaryAddedRatio', 0.048],
    ['BreakDamageAddedRatioBase', 0.08], ['StatusResistanceBase', 0.06],
    ['ImaginaryAddedRatio', 0.064], ['BreakDamageAddedRatioBase', 0.107]
  ]
  for (const id of ['8005', '8006']) {
    const entry = charDict[id]
    assert.ok(entry, `${id} 条目应存在`)
    assert.equal(Object.keys(entry).length, 18, `${id} 应有 18 个行迹节点`)
    // 小节点 201-210：属性键与值逐位核对（miao tree 为权威）
    for (let i = 0; i < 10; i++) {
      const node = entry[`${id}${201 + i}`]
      const [type, value] = expectNodes[i]
      const prop = node.levels[0].properties[0]
      assert.equal(prop.type, type, `${id} 节点 ${201 + i} 属性键`)
      closeTo(prop.value, value, `${id} 节点 ${201 + i} 属性值`)
      assert.equal(node.anchor, `Point${String(9 + i).padStart(2, '0')}`, `${id} 节点 ${201 + i} 锚点`)
    }
    // 大节点 101-103：名称/锚点/图标
    const bigs = [['卫我起舞', 'Point06', 'skilltree1'], ['随波逐流', 'Point07', 'skilltree2'], ['剧院之帽', 'Point08', 'skilltree3']]
    bigs.forEach(([name, anchor, icon], i) => {
      const node = entry[`${id}${101 + i}`]
      assert.equal(node.name, name, `${id} 大节点 ${101 + i} 名称`)
      assert.equal(node.anchor, anchor, `${id} 大节点 ${101 + i} 锚点`)
      assert.equal(node.icon, `icon/skill/${id}_${icon}.png`, `${id} 大节点 ${101 + i} 图标`)
    })
    // 主技能位 level_up_skills（baseData characters.json skills 列表来源）
    assert.deepEqual(entry[`${id}001`].level_up_skills, [{ id: `${id}01`, num: 1 }])
    assert.deepEqual(entry[`${id}007`].level_up_skills, [{ id: `${id}07`, num: 1 }])
  }
  // 引擎通路：skillTree 小节点点亮与否影响同谐战技行（虚数增伤 14.4%）
  const withTree = damage(panel(8005, 'Imaginary', 0, R0, true))
  const noTree = damage(panel(8005, 'Imaginary', 0, R0, false))
  assert.ok(withTree && noTree, '空 skillTree 面板应可计算')
  const a = withTree.damage[0].value.critical
  const b2 = noTree.damage[0].value.critical
  closeTo(a / b2, 1 + NODES[8005].imaginary, '行迹虚数小节点应并入战技行增伤区')
})

/* ============================================================
 * 六、批次4 终检：SkillData 总数 98 → 104
 * （风堇 1409 补遗后总数 105，改为下限口径——同批次3 先例，终态由 hyacine.test.js 锁定）
 * ============================================================ */
test('批次4 终检：6 个开拓者旧形态条目全部收录，SkillData 总数 98 → 104', () => {
  const ids = Object.keys(skilldict)
  assert.ok(ids.length >= 104, `SkillData 条目数应 ≥ 104（实际 ${ids.length}）`)
  for (const id of ['8001', '8002', '8003', '8004', '8005', '8006']) {
    assert.ok(skilldict[id] && skilldict[id].skillList && Object.keys(skilldict[id].skillList).length > 0,
      `${id} 应有 skillList 伤害行`)
  }
})

/* ============================================================
 * 七、钩子状态：倍率数组改写幂等、rank 切换回退
 * ============================================================ */
test('钩子状态：rank6→rank0→rank6 交替计算，输出不累积且正确回退', () => {
  const seq = []
  for (const rank of [6, 0, 6, 0, 6]) {
    const ret = damage(panel(8003, 'Fire', rank, rank === 0 ? R0 : R6))
    seq.push(JSON.stringify(ret.damage.map(r => r.value)))
  }
  assert.equal(seq[0], seq[2], '存护 rank6 两次计算应逐字段一致（不累积）')
  assert.equal(seq[1], seq[3], '存护 rank0 两次计算应逐字段一致（回退正确）')
  assert.equal(seq[0], seq[4], '存护 rank6 第三次计算应逐字段一致')
  // 配对形态混算：穹/星交替调用共享基线缓存，互不污染
  const mix = []
  for (const [id, elem, rank] of [[8001, 'Physical', 6], [8002, 'Physical', 0], [8001, 'Physical', 6],
    [8003, 'Fire', 6], [8004, 'Fire', 6], [8003, 'Fire', 6], [8005, 'Imaginary', 0], [8006, 'Imaginary', 6], [8005, 'Imaginary', 0]]) {
    mix.push(JSON.stringify(damage(panel(id, elem, rank, rank === 0 ? R0 : R6)).damage))
  }
  assert.equal(mix[0], mix[2], '毁灭穹 rank6 混算后应一致')
  assert.equal(mix[3], mix[5], '存护穹 rank6 混算后应一致')
  assert.equal(mix[6], mix[8], '同谐穹 rank0 混算后应一致')
  for (const [id, elem] of [[8001, 'Physical'], [8003, 'Fire'], [8005, 'Imaginary']]) {
    const r6a = damage(panel(id, elem, 6, R6))
    const r0 = damage(panel(id, elem, 0, R0))
    const r6b = damage(panel(id, elem, 6, R6))
    assert.equal(JSON.stringify(r6a.damage), JSON.stringify(r6b.damage), `${id} rank6 重算应一致`)
    assert.notEqual(JSON.stringify(r6a.damage), JSON.stringify(r0.damage), `${id} rank0/6 应不同`)
  }
})
