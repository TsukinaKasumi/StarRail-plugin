/**
 * 批次2 · B 组：特殊基数与增益型角色（7 个）伤害数据抽查
 *   藿藿 1217（生命倍率普攻）/ 砂金 1304（防御倍率）/ 知更鸟 1309（固定爆伤必暴）/ 花火 1306 /
 *   星期日 1313 / 阮•梅 1303（仅普攻行）/ 黑天鹅 1307（DOT 行不支持）
 *
 * 手算对照数值锚点为 miao-plugin resources/meta-sr/character/{角色}/data.json
 * talent 表的独立快照（本文件硬编码，测试不依赖 miao-plugin 在场）；
 * 推导过程见各 test 内注释；面板输入全部合成自建。
 *
 * 覆盖：
 *   - 7 角色 rank0/rank6 手算对照（暴击与期望双口径；知更鸟附加伤害期望=暴击）
 *   - 全伤害行完备性（有限正数、期望 ≤ 暴击、行数 = skillList 条目数）
 *   - SkillData 覆盖检查（2.x 普攻表 miao 仅 9 级，E3 后 10 级越界收敛）
 *   - 钩子状态：倍率数组改写幂等、命途切换回退
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
// 藿藿（a 技能伤害）
const HUOHUO = {
  aDmg: [0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65]
}
// 砂金（a / q 技能+暴伤 / t 每段）
const SHAJIN = {
  aDmg: [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3],
  qDmg: [1.62, 1.728, 1.836, 1.944, 2.052, 2.16, 2.295, 2.43, 2.565, 2.7, 2.808, 2.916, 3.024, 3.132, 3.24],
  qCdmg: [0.09, 0.096, 0.102, 0.108, 0.114, 0.12, 0.1275, 0.135, 0.1425, 0.15, 0.156, 0.162, 0.168, 0.174, 0.18],
  tPerSeg: [0.125, 0.1375, 0.15, 0.1625, 0.175, 0.1875, 0.203125, 0.21875, 0.234375, 0.25, 0.2625, 0.275, 0.2875, 0.3, 0.3125]
}
// 知更鸟（a / e 伤害提高 / q 附加伤害+攻击提高 / t 暴伤）
const ZHIGENGNIAN = {
  aDmg: [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3],
  eDmgUp: [0.25, 0.275, 0.3, 0.325, 0.35, 0.375, 0.40625, 0.4375, 0.46875, 0.5, 0.525, 0.55, 0.575, 0.6, 0.625],
  qExtra: [0.72, 0.768, 0.816, 0.864, 0.912, 0.96, 1.02, 1.08, 1.14, 1.2, 1.248, 1.296, 1.344, 1.392, 1.44],
  qAtkPct: [0.152, 0.1596, 0.1672, 0.1748, 0.1824, 0.19, 0.1995, 0.209, 0.2185, 0.228, 0.2356, 0.2432, 0.2508, 0.2584, 0.266],
  qAtkFlat: [50, 65, 80, 95, 110, 125, 143.75, 162.5, 181.25, 200, 215, 230, 245, 260, 275],
  tCdmg: [0.05, 0.065, 0.08, 0.095, 0.11, 0.125, 0.14375, 0.1625, 0.18125, 0.2, 0.215, 0.23, 0.245, 0.26, 0.275]
}
// 花火 / 星期日 / 阮•梅 / 黑天鹅（a 技能伤害同表口径）
const SIMPLE_A = [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3]
// 黑天鹅（e 技能+减防 / q 技能+易伤）
const HEITIANE = {
  eDmg: [0.45, 0.495, 0.54, 0.585, 0.63, 0.675, 0.73125, 0.7875, 0.84375, 0.9, 0.945, 0.99, 1.035, 1.08, 1.125],
  eDefDown: [0.148, 0.154, 0.16, 0.166, 0.172, 0.178, 0.1855, 0.193, 0.2005, 0.208, 0.214, 0.22, 0.226, 0.232, 0.238],
  qDmg: [0.72, 0.768, 0.816, 0.864, 0.912, 0.96, 1.02, 1.08, 1.14, 1.2, 1.248, 1.296, 1.344, 1.392, 1.44],
  qEnemyDmg: [0.15, 0.16, 0.17, 0.18, 0.19, 0.2, 0.2125, 0.225, 0.2375, 0.25, 0.26, 0.27, 0.28, 0.29, 0.3]
}

/* ============================================================
 * 合成手算面板（遗器合计同 A 组：攻击% 35.2 / 爆伤 79.6 / 暴击 42.5 /
 * 击破特攻 26.4 / 效果命中 10.8 / 生命% 43.2 / 速度 25 /
 * 固定生命 1371.4 / 固定攻击 38.2；砂金将固定攻击副词条换为防御% 35%）
 * ============================================================ */
const minorNodes = (id) =>
  Array.from({ length: 10 }, (_, i) => ({ id: id * 1000 + 201 + i, level: 1 }))
const behavior = (id, [basicLv, skillLv, ultLv, talentLv]) =>
  [[1, basicLv], [2, skillLv], [3, ultLv], [4, talentLv], [7, 1]]
    .map(([n, level]) => ({ id: id * 1000 + n, level }))
const RELICS = (opt = {}) => [
  { id: 61011, main_affix_tag: 'AttackAddedRatio', main_affix_value: 0.352, sub_affix_id: [{ tag: 'CriticalDamageBase', value: 0.148 }] },
  { id: 61012, main_affix_tag: 'CriticalDamageBase', main_affix_value: 0.648, sub_affix_id: [{ tag: 'CriticalChanceBase', value: 0.101 }] },
  { id: 61013, main_affix_tag: 'CriticalChanceBase', main_affix_value: 0.324, sub_affix_id: [{ tag: 'BreakDamageAddedRatioBase', value: 0.264 }] },
  { id: 61014, main_affix_tag: 'HPAddedRatio', main_affix_value: 0.432, sub_affix_id: [{ tag: 'StatusProbabilityBase', value: 0.108 }] },
  { id: 61015, main_affix_tag: 'SpeedDelta', main_affix_value: 25, sub_affix_id: [{ tag: 'HPDelta', value: 224.8 }] },
  { id: 61016, main_affix_tag: 'HPDelta', main_affix_value: 1146.6, sub_affix_id: opt.defSub ? [{ tag: 'DefenceAddedRatio', value: 0.35 }] : [{ tag: 'AttackDelta', value: 38.2 }] }
]
const PROPS = {
  1217: { hpBase: 1552.32, attackBase: 543.312, defenseBase: 485.1, speedBase: 98 },
  1303: { hpBase: 1122.468, attackBase: 543.312, defenseBase: 582.12, speedBase: 104 },
  1304: { hpBase: 1122.468, attackBase: 543.312, defenseBase: 938.4525, speedBase: 101 },
  1306: { hpBase: 1047.816, attackBase: 523.908, defenseBase: 545.7375, speedBase: 101 },
  1307: { hpBase: 1047.816, attackBase: 620.928, defenseBase: 545.7375, speedBase: 102 },
  1309: { hpBase: 1047.816, attackBase: 640.332, defenseBase: 545.7375, speedBase: 102 },
  1313: { hpBase: 1122.468, attackBase: 620.928, defenseBase: 545.7375, speedBase: 96 }
}
const R0 = [6, 8, 10, 10]
const R6 = [10, 14, 14, 14] // 星魂满后等级（普攻 10 越过 2.x 表长 9 时由引擎收敛到 9 级值）
function panel (id, elem, rank, levels, opt) {
  return {
    avatarId: id, name: '手算', level: 80, rank, damage_type: elem,
    properties: PROPS[id], relics: RELICS(opt),
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

test('藿藿（1217）手算对照：rank0/rank6 生命倍率普攻（注入生命为攻击基数）', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1217, 'Wind', rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    // 生命合计：1552.32 ×(1 + 行迹生命 28% + 遗器生命 43.2%) + 1371.4 → 注入为攻击基数
    const hp = 1552.32 * (1 + 0.28 + 0.432) + 1371.4
    const cpct = 0.05 + 0.425
    const cdmg = 0.5 + 0.796
    // rank6 普攻等级 10 越过 2.x 表长 9 → 引擎收敛到 9 级值 0.65（miao 截断）
    const base = hp * at(HUOHUO.aDmg, b) * 0.5 * 1 * 0.9
    checkRow(rows, '普攻伤害', base, cdmg, cpct, `藿藿 rank${rank}`)
  }
})

test('砂金（1304）手算对照：rank0/rank6 防御倍率注入 + 杠杆暴击档 + 4魂 10 段', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1304, 'Imaginary', rank, rank === 0 ? R0 : R6, { defSub: true })))
    // —— 手算 ——
    // 防御合计：938.4525 ×(1 + 行迹防御 35% + 遗器防御 35% + 4魂 40%) → 注入为攻击基数
    //（rank0：938.4525×1.7=1595.37 < 1600 → 杠杆 0 档；rank6：×2.1=1970.75 → 3 档 +6% 暴击）
    const def = 938.4525 * (1 + 0.35 + 0.35 + (rank >= 4 ? 0.4 : 0))
    const steps = Math.min(Math.floor(Math.max(def - 1600, 0) / 100), 24)
    const cpct = 0.05 + 0.425 + steps * 0.02
    // 爆伤：基础 50% + 遗器 79.6% + 终结技惊惶[q] + 1魂 20%
    const cdmg = 0.5 + 0.796 + at(SHAJIN.qCdmg, q) + (rank >= 1 ? 0.2 : 0)
    const injury = 1 + 0.144 + (rank >= 6 ? 1.5 : 0) // 行迹虚数 + 6魂 150%
    const defArea = 0.5
    const resArea = rank >= 2 ? 1.12 : 1 // 2魂全抗降 12%
    {
      const base = def * at(SHAJIN.aDmg, b) * injury * defArea * resArea * 0.9
      checkRow(rows, '普攻伤害', base, cdmg, cpct, `砂金 rank${rank}`)
    }
    {
      const base = def * at(SHAJIN.qDmg, q) * injury * defArea * resArea * 0.9
      checkRow(rows, '终结技伤害', base, cdmg, cpct, `砂金 rank${rank}`)
    }
    {
      // 追击：7 段（4魂 10 段）× 每段[t]
      const segs = rank >= 4 ? 10 : 7
      const base = def * at(SHAJIN.tPerSeg, t) * segs * injury * defArea * resArea * 0.9
      checkRow(rows, '追击伤害', base, cdmg, cpct, `砂金 rank${rank}`)
    }
  }
})

test('知更鸟（1309）手算对照：rank0/rank6 附加伤害（固定爆伤+必暴+攻击增益折入倍率）', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1309, 'Physical', rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    // 攻击：640.332 ×(1 + 行迹攻击 28% + 遗器 35.2%) + 38.2
    const attack = 640.332 * (1 + 0.28 + 0.352) + 38.2
    const cpct = 0.05 + 0.425
    const cdmgNormal = 0.5 + 0.796 + at(ZHIGENGNIAN.tCdmg, t) // 天赋-调性合颂
    const injury = 1 + at(ZHIGENGNIAN.eDmgUp, e) // 战技我方增伤
    {
      const base = attack * at(ZHIGENGNIAN.aDmg, b) * injury * 0.5 * 0.9
      checkRow(rows, '普攻伤害', base, cdmgNormal, cpct, `知更鸟 rank${rank}`)
    }
    {
      // 附加伤害：倍率折入终结技攻击增益 = q附加×(1+攻击%[q]) + q附加×固定值[q]/面板攻击
      const mult = at(ZHIGENGNIAN.qExtra, q) * (1 + at(ZHIGENGNIAN.qAtkPct, q)) +
        at(ZHIGENGNIAN.qExtra, q) * at(ZHIGENGNIAN.qAtkFlat, q) / attack
      const resArea = rank >= 1 ? 1.24 : 1 // 1魂协奏全抗穿 24%
      const base = attack * mult * injury * 0.5 * resArea * 0.9
      // 爆伤固定 150%（6魂 600%）、必定暴击 → 期望 = 暴击
      const fixed = rank >= 6 ? 6 : 1.5
      const row = rows['终结技附加伤害']
      assert.ok(row && row.critical > 0, '知更鸟 附加伤害行存在且为正')
      closeTo(row.critical, base * (1 + fixed), `知更鸟 rank${rank} 附加伤害 暴击`)
      closeTo(row.expect, base * (1 + fixed), `知更鸟 rank${rank} 附加伤害 期望（必暴）`)
      closeTo(row.expect, row.critical, `知更鸟 rank${rank} 附加伤害 期望=暴击`)
    }
  }
})

test('花火（1306）/ 星期日（1313）/ 阮•梅（1303）手算对照：rank0/rank6 普攻行', () => {
  // —— 花火：夜想曲攻击 +20%；行迹爆伤 24% ——
  for (const rank of [0, 6]) {
    const [b] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1306, 'Quantum', rank, rank === 0 ? R0 : R6)))
    const attack = 523.908 * (1 + 0.352 + 0.2) + 38.2
    const base = attack * at(SIMPLE_A, b) * 0.5 * 1 * 0.9
    checkRow(rows, '普攻伤害', base, 0.5 + 0.796 + 0.24, 0.475, `花火 rank${rank}`)
  }
  // —— 星期日：无自身增益；行迹爆伤 37.3% ——
  for (const rank of [0, 6]) {
    const [b] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1313, 'Imaginary', rank, rank === 0 ? R0 : R6)))
    const attack = 620.928 * (1 + 0.352) + 38.2
    const base = attack * at(SIMPLE_A, b) * 0.5 * 1 * 0.9
    checkRow(rows, '普攻伤害', base, 0.5 + 0.796 + 0.373, 0.475, `星期日 rank${rank}`)
  }
  // —— 阮•梅：无自身增益（弦外音/结界按 miao 口径不作用于自身普攻行）——
  for (const rank of [0, 6]) {
    const [b] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1303, 'Ice', rank, rank === 0 ? R0 : R6)))
    const attack = 543.312 * (1 + 0.352) + 38.2
    const base = attack * at(SIMPLE_A, b) * 0.5 * 1 * 0.9
    checkRow(rows, '普攻伤害', base, 0.5 + 0.796, 0.475, `阮•梅 rank${rank}`)
  }
})

test('黑天鹅（1307）手算对照：rank0/rank6 战技/终结技（烛影/减防/揭露易伤/1魂抗降）', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1307, 'Wind', rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    const attack = 620.928 * (1 + 0.28 + 0.352) + 38.2
    const cpct = 0.05 + 0.425
    const cdmg = 0.5 + 0.796
    // 行迹-烛影朕兆：min(效果命中×0.6, 72)%（效果命中 = 遗器 10.8% + 行迹 10%）
    const effPct = (0.108 + 0.1) * 100
    const injury = 1 + 0.144 + Math.min(effPct * 0.6, 72) / 100
    const defArea = 1 / (2 - at(HEITIANE.eDefDown, e)) // 战技减防按无视防御计
    const resArea = rank >= 1 ? 1.25 : 1 // 1魂风抗降 25%
    {
      const base = attack * at(HEITIANE.eDmg, e) * injury * defArea * resArea * 0.9
      checkRow(rows, '战技伤害', base, cdmg, cpct, `黑天鹅 rank${rank}`)
    }
    {
      const ratio = 1 + at(HEITIANE.qEnemyDmg, q) // 终结技【揭露】易伤
      const base = attack * at(HEITIANE.qDmg, q) * injury * ratio * defArea * resArea * 0.9
      checkRow(rows, '终结技伤害', base, cdmg, cpct, `黑天鹅 rank${rank}`)
    }
  }
})

/* ============================================================
 * 二、B 组 7 角色 rank0/rank6：全伤害行有限正数、期望 ≤ 暴击
 * ============================================================ */
const CHARS = {
  1217: ['藿藿', 'Wind'],
  1303: ['阮•梅', 'Ice'],
  1304: ['砂金', 'Imaginary'],
  1306: ['花火', 'Quantum'],
  1307: ['黑天鹅', 'Wind'],
  1309: ['知更鸟', 'Physical'],
  1313: ['星期日', 'Imaginary']
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
 * 四、钩子状态：倍率数组改写幂等、命途切换回退
 * ============================================================ */
test('钩子状态：rank6→rank0→rank6 交替计算，输出不累积且正确回退', () => {
  const seq = []
  for (const rank of [6, 0, 6, 0, 6]) {
    const ret = damage(panel(1309, 'Physical', rank, rank === 0 ? R0 : R6))
    seq.push(JSON.stringify(ret.damage.map(r => r.value)))
  }
  assert.equal(seq[0], seq[2], '知更鸟 rank6 两次计算应逐字段一致（不累积）')
  assert.equal(seq[1], seq[3], '知更鸟 rank0 两次计算应逐字段一致（回退正确）')
  assert.equal(seq[0], seq[4], '知更鸟 rank6 第三次计算应逐字段一致')
  for (const [id, elem, opt] of [[1304, 'Imaginary', { defSub: true }], [1307, 'Wind'], [1217, 'Wind']]) {
    const r6a = damage(panel(id, elem, 6, R6, opt))
    const r0 = damage(panel(id, elem, 0, R0, opt))
    const r6b = damage(panel(id, elem, 6, R6, opt))
    assert.equal(JSON.stringify(r6a.damage), JSON.stringify(r6b.damage), `${id} rank6 重算应一致`)
    assert.notEqual(JSON.stringify(r6a.damage), JSON.stringify(r0.damage), `${id} rank0/6 应不同`)
  }
})
