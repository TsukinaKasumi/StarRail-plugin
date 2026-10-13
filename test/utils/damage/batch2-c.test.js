/**
 * 批次2 · C 组：击破体系直伤角色（5 个）伤害数据抽查
 *   流萤 1310 / 忘归人 1225 / 波提欧 1315 / 黄泉 1308 / 灵砂 1222
 *
 * 击破/超击破伤害行引擎不支持（无击破通道），本组仅收录 miao 展示行中的
 * 直伤部分；手算对照数值锚点为 miao-plugin resources/meta-sr/character/{角色}/
 * data.json talent 表的独立快照（本文件硬编码，测试不依赖 miao-plugin 在场）。
 *
 * 覆盖：
 *   - 5 角色 rank0/rank6 手算对照（暴击与期望双口径，核心输出行）
 *   - 全伤害行完备性（有限正数、期望 ≤ 暴击、行数 = skillList 条目数）
 *   - SkillData 覆盖检查（2.x 普攻表 miao 仅 9 级，E3 后 10 级越界收敛；
 *     批次2 全 21 条目齐全性终检）
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
// 流萤（a2 强化普攻 / e2 目标）
const LIUYING = {
  a2Dmg: [1, 1.2, 1.4, 1.6, 1.8, 2, 2.2, 2.4, 2.6],
  e2Main: [1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.625, 1.75, 1.875, 2, 2.1, 2.2, 2.3, 2.4, 2.5]
}
// 忘归人（a2 技能+相邻 / q 技能 / e 防御降低）
const WANGGUIREN = {
  a2Dmg: [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3],
  a2Adj: [0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65],
  qDmg: [1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.625, 1.75, 1.875, 2, 2.1, 2.2, 2.3, 2.4, 2.5],
  eDefDown: [0.08, 0.09, 0.1, 0.11, 0.12, 0.13, 0.1425, 0.155, 0.1675, 0.18, 0.19, 0.2, 0.21, 0.22, 0.23]
}
// 波提欧（a2 技能 / q 技能 / e 伤害提高）
const BOTIOU = {
  a2Dmg: [1.1, 1.32, 1.54, 1.76, 1.98, 2.2, 2.42, 2.64, 2.86],
  qDmg: [2.4, 2.56, 2.72, 2.88, 3.04, 3.2, 3.4, 3.6, 3.8, 4, 4.16, 4.32, 4.48, 4.64, 4.8],
  eEnemyDmg: [0.15, 0.165, 0.18, 0.195, 0.21, 0.225, 0.24375, 0.2625, 0.28125, 0.3, 0.315, 0.33, 0.345, 0.36, 0.375]
}
// 黄泉（a / e 单体+相邻 / q 单体+相邻 / t 抗降）
const HUANGQUAN = {
  aDmg: [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3],
  eMain: [0.8, 0.88, 0.96, 1.04, 1.12, 1.2, 1.3, 1.4, 1.5, 1.6, 1.68, 1.76, 1.84, 1.92, 2],
  eAdj: [0.3, 0.33, 0.36, 0.39, 0.42, 0.45, 0.4875, 0.525, 0.5625, 0.6, 0.63, 0.66, 0.69, 0.72, 0.75],
  qMain: [2.232, 2.3808, 2.5296, 2.6784, 2.8272, 2.976, 3.162, 3.348, 3.534, 3.72, 3.8688, 4.0176, 4.1664, 4.3152, 4.464],
  qAdj: [1.8, 1.92, 2.04, 2.16, 2.28, 2.4, 2.55, 2.7, 2.85, 3, 3.12, 3.24, 3.36, 3.48, 3.6],
  tKx: [0.1, 0.11, 0.12, 0.13, 0.14, 0.15, 0.1625, 0.175, 0.1875, 0.2, 0.21, 0.22, 0.23, 0.24, 0.25]
}
// 灵砂（q 技能）
const LINGSHA = {
  qDmg: [0.9, 0.96, 1.02, 1.08, 1.14, 1.2, 1.275, 1.35, 1.425, 1.5, 1.56, 1.62, 1.68, 1.74, 1.8]
}

/* ============================================================
 * 合成手算面板（遗器合计同 A/B 组：攻击% 35.2 / 爆伤 79.6 / 暴击 42.5 /
 * 击破特攻 26.4 / 效果命中 10.8 / 生命% 43.2 / 速度 25 /
 * 固定生命 1371.4 / 固定攻击 38.2；流萤基础攻击取 1400 覆盖过载核心档）
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
  1222: { hpBase: 1122.468, attackBase: 640.332, defenseBase: 545.7375, speedBase: 100 },
  1225: { hpBase: 1122.468, attackBase: 620.928, defenseBase: 545.7375, speedBase: 104 },
  1308: { hpBase: 1047.816, attackBase: 679.14, defenseBase: 485.1, speedBase: 96 },
  1310: { hpBase: 1047.816, attackBase: 1400, defenseBase: 485.1, speedBase: 104 },
  1315: { hpBase: 1122.468, attackBase: 654.966, defenseBase: 509.355, speedBase: 107 }
}
const R0 = [6, 8, 10, 10]
const R6 = [10, 14, 14, 14] // 星魂满后等级（普攻 10 越过 2.x 表长 9 时由引擎收敛到 9 级值）
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

test('流萤（1310）手算对照：rank0/rank6 强化普攻与强化战技（过载核心+击破特攻档）', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1310, 'Fire', rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    // 攻击：1400 ×(1 + 遗器攻击 35.2%) + 38.2 = 1931.0（行迹无攻击%）
    const attack = 1400 * (1 + 0.352) + 38.2
    const cpct = 0.05 + 0.425
    const cdmg = 0.5 + 0.796
    // 击破特攻 = 遗器 26.4% + 行迹 37.3% + 完全燃烧 25% + 过载核心（≥1800 每超 10 点 +0.8%）
    const stance = 26.4 + 37.3 + 25 + Math.floor((attack - 1800) / 10) * 0.8
    const defArea = 1 / (2 - (rank >= 1 ? 0.15 : 0)) // 1魂无视 15%
    const resArea = rank >= 6 ? 1.2 : 1 // 6魂火抗穿 20%
    {
      const base = attack * at(LIUYING.a2Dmg, b) * defArea * resArea * 0.9
      checkRow(rows, '强化普攻·底火斩击', base, cdmg, cpct, `流萤 rank${rank}`)
    }
    {
      // 强化战技主目标 = e2目标[e] + min(击破特攻×0.2, 72)%
      const mult = at(LIUYING.e2Main, e) + Math.min(stance * 0.2, 72) / 100
      const base = attack * mult * defArea * resArea * 0.9
      checkRow(rows, '强化战技·死星过载', base, cdmg, cpct, `流萤 rank${rank}`)
    }
  }
})

test('忘归人（1225）手算对照：rank0/rank6 强化普攻对三与终结技对三（狐祈减防档）', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1225, 'Fire', rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    const attack = 620.928 * (1 + 0.352) + 38.2
    const cpct = 0.05 + 0.425
    const cdmg = 0.5 + 0.796
    // 持【狐祈】档：狐祈持有者攻击使敌方防御降低[e表]，按无视防御计
    const defArea = 1 / (2 - at(WANGGUIREN.eDefDown, e))
    {
      // 强化普攻对三 = a2技能[b] + 2×a2相邻[b]
      const mult = at(WANGGUIREN.a2Dmg, b) + 2 * at(WANGGUIREN.a2Adj, b)
      const base = attack * mult * defArea * 0.9
      checkRow(rows, '强化普攻对三(直伤)', base, cdmg, cpct, `忘归人 rank${rank}`)
    }
    {
      const mult = at(WANGGUIREN.qDmg, q) * 3
      const base = attack * mult * defArea * 0.9
      checkRow(rows, '终结技对三(直伤)', base, cdmg, cpct, `忘归人 rank${rank}`)
    }
  }
})

test('波提欧（1315）手算对照：rank0/rank6 强化普攻与终结技（对峙易伤/幽灵装填）', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1315, 'Physical', rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    const attack = 654.966 * (1 + 0.18 + 0.352) + 38.2
    // 击破特攻 = 遗器 26.4% + 行迹 37.3% + 2魂对峙 30%
    const stance = 26.4 + 37.3 + (rank >= 2 ? 30 : 0)
    const cpct = 0.05 + 0.425 + Math.min(stance * 0.1, 30) / 100 // 幽灵装填暴击
    const cdmg = 0.5 + 0.796 + Math.min(stance * 0.5, 150) / 100 // 幽灵装填暴伤
    // 绝命对峙易伤[e表] + 4魂 12%
    const ratio = 1 + at(BOTIOU.eEnemyDmg, e) + (rank >= 4 ? 0.12 : 0)
    const defArea = 1 / (2 - (rank >= 1 ? 0.16 : 0)) // 1魂无视 16%
    {
      const base = attack * at(BOTIOU.a2Dmg, b) * ratio * defArea * 0.9
      checkRow(rows, '强化普攻伤害', base, cdmg, cpct, `波提欧 rank${rank}`)
    }
    {
      const base = attack * at(BOTIOU.qDmg, q) * ratio * defArea * 0.9
      checkRow(rows, '终结技伤害', base, cdmg, cpct, `波提欧 rank${rank}`)
    }
  }
})

test('黄泉（1308）手算对照：rank0/rank6 奈落×1.6 全行 + 雷心 + 6魂视为终结技路径', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1308, 'Thunder', rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    const attack = 679.14 * (1 + 0.28 + 0.352) + 38.2
    const cpct = 0.05 + 0.425 + (rank >= 1 ? 0.18 : 0)
    const cdmg = 0.5 + 0.796 + 0.24
    const injury = 1 + 0.08 + 0.9 // 行迹雷伤 + 雷心 90%
    const kx = at(HUANGQUAN.tKx, t) // 天赋-红叶时雨抗降（终结技行）
    {
      // 普攻：奈落 ×1.6；6魂视为终结技（抗降 kx+20%、易伤 8%）
      const resArea = rank >= 6 ? 1 + 0.2 + kx : 1
      const ratio = rank >= 6 ? 1.08 : 1
      const base = attack * at(HUANGQUAN.aDmg, b) * 1.6 * injury * ratio * 0.5 * resArea * 0.9
      checkRow(rows, '普攻伤害', base, cdmg, cpct, `黄泉 rank${rank}`)
    }
    {
      // 战技(扩散)：e单体 + 2×相邻，×1.6；6魂同普攻路径
      const mult = (at(HUANGQUAN.eMain, e) + 2 * at(HUANGQUAN.eAdj, e)) * 1.6
      const resArea = rank >= 6 ? 1 + 0.2 + kx : 1
      const ratio = rank >= 6 ? 1.08 : 1
      const base = attack * mult * injury * ratio * 0.5 * resArea * 0.9
      checkRow(rows, '战技伤害(扩散)', base, cdmg, cpct, `黄泉 rank${rank}`)
    }
    {
      // 终结技·对单 = (q单体[q] + 雷心 150%) × 1.6；抗降 kx + 6魂 20%；4魂易伤 8%
      const mult = (at(HUANGQUAN.qMain, q) + 1.5) * 1.6
      const resArea = 1 + kx + (rank >= 6 ? 0.2 : 0)
      const ratio = rank >= 4 ? 1.08 : 1
      const base = attack * mult * injury * ratio * 0.5 * resArea * 0.9
      checkRow(rows, '终结技伤害·对单', base, cdmg, cpct, `黄泉 rank${rank}`)
    }
    {
      // 终结技·对无花目标 = q相邻[q] × 1.6（Talent 槽位按终结技等级常量改写）
      const mult = at(HUANGQUAN.qAdj, q) * 1.6
      const resArea = 1 + kx + (rank >= 6 ? 0.2 : 0)
      const ratio = rank >= 4 ? 1.08 : 1
      const base = attack * mult * injury * ratio * 0.5 * resArea * 0.9
      checkRow(rows, '终结技伤害·对无花目标', base, cdmg, cpct, `黄泉 rank${rank}`)
    }
  }
})

test('灵砂（1222）手算对照：rank0/rank6 终结技直伤（朱燎攻击换算/1魂减防/6魂抗降）', () => {
  for (const rank of [0, 6]) {
    const [b, e, q, t] = rank === 0 ? R0 : R6
    const rows = rowsOf(damage(panel(1222, 'Fire', rank, rank === 0 ? R0 : R6)))
    // —— 手算 ——
    // 击破特攻 = 遗器 26.4% + 行迹 37.3% + 2魂 40%（miao 误写 20%，按官方文本修正）
    const stance = 26.4 + 37.3 + (rank >= 2 ? 40 : 0)
    // 行迹-朱燎：min(stance×0.25, 50)% 攻击
    const attack = 640.332 * (1 + 0.1 + 0.352 + Math.min(stance * 0.25, 50) / 100) + 38.2
    const cpct = 0.05 + 0.425
    const cdmg = 0.5 + 0.796
    const defArea = 1 / (2 - (rank >= 1 ? 0.2 : 0)) // 1魂弱点击破减防 20%
    const resArea = rank >= 6 ? 1.2 : 1 // 6魂浮元全抗降 20%
    const base = attack * at(LINGSHA.qDmg, q) * defArea * resArea * 0.9
    checkRow(rows, '终结技伤害(直伤)', base, cdmg, cpct, `灵砂 rank${rank}`)
  }
})

/* ============================================================
 * 二、C 组 5 角色 rank0/rank6：全伤害行有限正数、期望 ≤ 暴击
 * ============================================================ */
const CHARS = {
  1222: ['灵砂', 'Fire'],
  1225: ['忘归人', 'Fire'],
  1308: ['黄泉', 'Thunder'],
  1310: ['流萤', 'Fire'],
  1315: ['波提欧', 'Physical']
}
const ELEMENT_SET = { Fire: '107', Physical: '105', Ice: '104', Quantum: '108', Thunder: '109', Wind: '110', Imaginary: '112' }
const WEAPON_CYCLE = [
  { id: 23001, rank: 5 }, { id: 21010, rank: 1 }, { id: 20007, rank: 3 },
  { id: 20014, rank: 2 }, { id: 21024, rank: 4 }, { id: 0, rank: 1 },
  { id: 23001, rank: 5 }
]
test('C 组 5 角色 rank0/rank6：全伤害行有限正数、期望 ≤ 暴击', async (t) => {
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
 * 三、SkillData 覆盖检查 + 批次2 全 21 条目齐全性终检
 * ============================================================ */
test('SkillData 覆盖：C 组 5 条目数组长度（普攻 9 级 miao 口径、其余 15 级）', () => {
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

test('批次2 终检：21 个 2.x 条目全部收录（总数随后续批次递增，下限 75）', () => {
  const ids = Object.keys(skilldict)
  assert.ok(ids.length >= 75, `SkillData 条目数应 ≥ 75（实际 ${ids.length}）`)
  const batch2 = ['1214', '1217', '1218', '1220', '1221', '1222', '1223', '1225',
    '1302', '1303', '1304', '1305', '1306', '1307', '1308', '1309', '1310',
    '1312', '1313', '1314', '1315']
  for (const id of batch2) {
    assert.ok(skilldict[id] && skilldict[id].skillList && Object.keys(skilldict[id].skillList).length > 0,
      `${id} 应有 skillList 伤害行`)
  }
})

/* ============================================================
 * 四、钩子状态：倍率数组改写幂等、命途切换回退
 * ============================================================ */
test('钩子状态：rank6→rank0→rank6 交替计算，输出不累积且正确回退', () => {
  const seq = []
  for (const rank of [6, 0, 6, 0, 6]) {
    const ret = damage(panel(1308, 'Thunder', rank, rank === 0 ? R0 : R6))
    seq.push(JSON.stringify(ret.damage.map(r => r.value)))
  }
  assert.equal(seq[0], seq[2], '黄泉 rank6 两次计算应逐字段一致（不累积）')
  assert.equal(seq[1], seq[3], '黄泉 rank0 两次计算应逐字段一致（回退正确）')
  assert.equal(seq[0], seq[4], '黄泉 rank6 第三次计算应逐字段一致')
  for (const [id, elem] of [[1310, 'Fire'], [1315, 'Physical'], [1222, 'Fire'], [1225, 'Fire']]) {
    const r6a = damage(panel(id, elem, 6, R6))
    const r0 = damage(panel(id, elem, 0, R0))
    const r6b = damage(panel(id, elem, 6, R6))
    assert.equal(JSON.stringify(r6a.damage), JSON.stringify(r6b.damage), `${id} rank6 重算应一致`)
    assert.notEqual(JSON.stringify(r6a.damage), JSON.stringify(r0.damage), `${id} rank0/6 应不同`)
  }
})
