/**
 * 风堇（1409，3.3 丰饶·记忆）伤害数据抽查 —— 批次规划遗漏角色的单角色补遗
 *
 * miao calc.js 行清单与收录口径：
 *   - 【雨过天晴】状态普攻伤害 → Normal 行（生命倍率，钩子注入雨过天晴提高后生命）
 *   - 忆灵技对单伤害-我方6目标-无烧血C（miao defDmgIdx=5 默认展示行）→ Me 行
 *     （累计治疗基数按 calc.js 模拟口径由钩子折入倍率，含 2魂速度档/4魂暴伤/
 *      6魂 3.4 经验系数/专武 23042 烧血 11 次档位切换）
 *   - 跳过并披露：战技/终结技/忆灵天赋/1魂附加全部治疗行（引擎无治疗通道，
 *     同藿藿/白露先例）；忆灵技 7 目标烧血C 档（单槽位不重复展示）；
 *     「战技回复遐蝶新蕊百分点」工具行（无引擎通道）
 *
 * 手算公式：伤害 = 基数 × 倍率 × 增伤区 × 防御区(0.5) × 抗性区 × 0.9 × 暴击区
 *   普通行基数 = 提高后生命上限；忆灵技行基数 = 累计治疗数值（miao 模拟口径）；
 *   行迹-阴云莞尔暴击率 +100% → 暴击率饱和 1，期望 = 暴击。
 * 数值锚点为 miao-plugin talent 表独立快照（已与 xiaoyao-cvs-plugin 游戏 dump 逐表对拍）。
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
 * 数值锚点：miao-plugin talent 表快照（2026-10 提取，独立于 SkillData.json；
 * 已与 xiaoyao-cvs-plugin 游戏 dump params 逐表交叉对拍一致）
 * ============================================================ */
const HY = {
  aDmg: [0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7],
  meDmg: [0.1, 0.12, 0.14, 0.16, 0.18, 0.2, 0.22, 0.24, 0.26, 0.28],
  tDmgUp: [0.4, 0.44, 0.48, 0.52, 0.56, 0.6, 0.65, 0.7, 0.75, 0.8, 0.84, 0.88, 0.92, 0.96, 1],
  qHpPct: [0.15, 0.165, 0.18, 0.195, 0.21, 0.225, 0.24375, 0.2625, 0.28125, 0.3, 0.315, 0.33, 0.345, 0.36, 0.375],
  qHpFlat: [150, 240, 307.5, 375, 420, 465, 498.75, 532.5, 566.25, 600, 633.75, 667.5, 701.25, 735, 768.75],
  eHealPct: [0.04, 0.045, 0.05, 0.055, 0.06, 0.064, 0.068, 0.072, 0.076, 0.08, 0.084, 0.088, 0.092, 0.096, 0.1],
  eHealFlat: [40, 64, 82, 100, 112, 124, 133, 142, 151, 160, 169, 178, 187, 196, 205],
  eMemoHealPct: [0.05, 0.05625, 0.0625, 0.06875, 0.075, 0.08, 0.085, 0.09, 0.095, 0.1, 0.105, 0.11, 0.115, 0.12, 0.125],
  eMemoHealFlat: [50, 80, 102.5, 125, 140, 155, 166.25, 177.5, 188.75, 200, 211.25, 222.5, 233.75, 245, 256.25],
  qHealPct: [0.05, 0.05625, 0.0625, 0.06875, 0.075, 0.08, 0.085, 0.09, 0.095, 0.1, 0.105, 0.11, 0.115, 0.12, 0.125],
  qHealFlat: [50, 80, 102.5, 125, 140, 155, 166.25, 177.5, 188.75, 200, 211.25, 222.5, 233.75, 245, 256.25],
  qMemoHealPct: [0.06, 0.0675, 0.075, 0.0825, 0.09, 0.096, 0.102, 0.108, 0.114, 0.12, 0.126, 0.132, 0.138, 0.144, 0.15],
  qMemoHealFlat: [60, 96, 123, 150, 168, 186, 199.5, 213, 226.5, 240, 253.5, 267, 280.5, 294, 307.5],
  mtHealPct: [0.01, 0.012, 0.014, 0.016, 0.018, 0.02, 0.022, 0.024, 0.026, 0.028],
  mtHealFlat: [10, 12, 14, 16, 18, 20, 22, 24, 26, 28]
}

/* ============================================================
 * 合成手算面板（遗器合计同批次2/3：攻击% 35.2 / 爆伤 79.6 / 暴击 42.5 /
 * 生命% 43.2 / 速度 25 / 固定生命 1371.4 / 固定攻击 38.2；
 * 行迹小节点全点亮：速度 +14 / 效果抵抗 +18% / 生命 +10%）
 * ============================================================ */
const minorNodes = (id) =>
  Array.from({ length: 10 }, (_, i) => ({ id: id * 1000 + 201 + i, level: 1 }))
const behavior = (id, [basicLv, skillLv, ultLv, talentLv], me = 1, mt = 1) =>
  [[1, basicLv], [2, skillLv], [3, ultLv], [4, talentLv], [7, 1], [301, me], [302, mt]]
    .map(([n, level]) => ({ id: id * 1000 + n, level }))
const RELICS = (speedDelta = 25) => ([
  { id: 61011, main_affix_tag: 'AttackAddedRatio', main_affix_value: 0.352, sub_affix_id: [{ tag: 'CriticalDamageBase', value: 0.148 }] },
  { id: 61012, main_affix_tag: 'CriticalDamageBase', main_affix_value: 0.648, sub_affix_id: [{ tag: 'CriticalChanceBase', value: 0.101 }] },
  { id: 61013, main_affix_tag: 'CriticalChanceBase', main_affix_value: 0.324, sub_affix_id: [{ tag: 'BreakDamageAddedRatioBase', value: 0.264 }] },
  { id: 61014, main_affix_tag: 'HPAddedRatio', main_affix_value: 0.432, sub_affix_id: [{ tag: 'StatusProbabilityBase', value: 0.108 }] },
  { id: 61015, main_affix_tag: 'SpeedDelta', main_affix_value: speedDelta, sub_affix_id: [{ tag: 'HPDelta', value: 224.8 }] },
  { id: 61016, main_affix_tag: 'HPDelta', main_affix_value: 1146.6, sub_affix_id: [{ tag: 'AttackDelta', value: 38.2 }] }
])
const PROPS = { hpBase: 1086.624, attackBase: 388.08, defenseBase: 630.63, speedBase: 110 }
function panel (rank, levels, me, mt, { speedDelta = 25, equipment = { id: 0, rank: 1 } } = {}) {
  return {
    avatarId: 1409, name: '手算风堇', level: 80, rank, damage_type: 'Wind',
    properties: PROPS, relics: RELICS(speedDelta),
    equipment, relic_sets: [],
    skillTree: minorNodes(1409), behaviorList: behavior(1409, levels, me, mt)
  }
}

/* ============================================================
 * 手算参考实现（照抄 miao calc.js「我方6目标-无烧血C」档 + 钩子注入口径）
 * ============================================================ */
function hyacineRef ({ rank, levels: [b, e, q, t], me, mt }, { speedDelta = 25, equipment = { id: 0, rank: 1 } } = {}) {
  // —— 速度（2魂 +30% 常驻档 / 专武 23042 静态速度词条 r1 +18%，均为 miao 口径） ——
  const speed = (speedDelta + 14) + 110 * (1 + (rank >= 2 ? 0.3 : 0) + (equipment.id === 23042 ? 0.18 : 0))
  const stormy = speed > 200
  // —— 提高后生命：基础 1086.624 × (1 + 遗器 43.2% + 行迹 10% + 雨过天晴[q表] + 1魂 50% + 暴风停歇 20%) ——
  //   + 固定（遗器 1371.4 + 雨过天晴[q表固定值]）
  const hp = (224.8 + 1146.6 + at(HY.qHpFlat, q)) +
    1086.624 * (1 + 0.432 + 0.10 + at(HY.qHpPct, q) + (rank >= 1 ? 0.5 : 0) + (stormy ? 0.2 : 0))
  // —— 暴风停歇治疗量档：超出速度每点 +1%，最多 200 点 ——
  const healMult = 1 + (stormy ? Math.min(speed - 200, 200) : 0) / 100
  // —— 暴击区：阴云莞尔 +100% 饱和；爆伤 = 基础 50% + 遗器 79.6% + 4魂(超速×2%) ——
  const cpct = Math.min(1, 0.05 + 0.425 + 1)
  const cdmg = 0.5 + 0.796 + (rank >= 4 && stormy ? (speed - 200) * 2 / 100 : 0)
  // —— 累计治疗数值（miao 模拟口径） ——
  const perHeal = healMult * (hp * at(HY.mtHealPct, mt) + at(HY.mtHealFlat, mt))
  const cureDelta = equipment.id === 23042 ? 11 * perHeal : 0
  const nume = healMult * (5 * (hp * at(HY.eHealPct, e) + at(HY.eHealFlat, e)) +
    hp * at(HY.eMemoHealPct, e) + at(HY.eMemoHealFlat, e)) + cureDelta
  const numq = healMult * (5 * (hp * at(HY.qHealPct, q) + at(HY.qHealFlat, q)) +
    hp * at(HY.qMemoHealPct, q) + at(HY.qMemoHealFlat, q)) + cureDelta
  const cureAmount = ((nume * 2 + numq) / 3 + 7 * perHeal +
    (rank >= 1 ? 6 * healMult * hp * 0.08 : 0)) * (rank === 6 ? 3.4 : 1.6)
  // —— 伤害行：基数 × 倍率 × 增伤 × 防御 0.5 × 抗性 × 0.9 × 暴击区 ——
  const zones = (base, mult, injury) =>
    base * mult * injury * 0.5 * (rank >= 6 ? 1.2 : 1) * 0.9 * (1 + cdmg)
  return {
    speed, hp, stormy, healMult, cdmg, cureAmount,
    normal: {
      critical: zones(hp, at(HY.aDmg, b), 1),
      expect: zones(hp, at(HY.aDmg, b), 1) * (1 - cpct + cpct) // cpct=1 → 期望=暴击
    },
    me: {
      critical: zones(cureAmount, at(HY.meDmg, me), 1 + at(HY.tDmgUp, t) * 3),
      expect: zones(cureAmount, at(HY.meDmg, me), 1 + at(HY.tDmgUp, t) * 3)
    }
  }
}
function checkRows (rows, ref, label) {
  const normal = rows['普攻伤害']
  assert.ok(normal && normal.critical > 0 && normal.expect > 0, `${label} 普攻伤害行存在且为正`)
  closeTo(normal.critical, ref.normal.critical, `${label} 普攻伤害 暴击`)
  closeTo(normal.expect, ref.normal.expect, `${label} 普攻伤害 期望`)
  const me = rows['忆灵技对单伤害（我方6目标档）']
  assert.ok(me && me.critical > 0 && me.expect > 0, `${label} 忆灵技行存在且为正`)
  closeTo(me.critical, ref.me.critical, `${label} 忆灵技对单伤害 暴击`)
  closeTo(me.expect, ref.me.expect, `${label} 忆灵技对单伤害 期望`)
}

/* ============================================================
 * 一、手算对照
 * ============================================================ */

test('风堇（1409）rank0 手算对照：普攻（生命倍率）+ 忆灵技（累计治疗基数）', () => {
  // 等级 [普攻6, 战技8, 终结技10, 天赋10]，忆灵技/忆灵天赋 5 级，无光锥
  // rank0 推导（无星魂）：
  //   速度 = 25 + 14 + 110 = 149 < 200，暴风停歇不触发，healMult = 1
  //   生命 = 1371.4 + 600(雨过天晴固定) + 1086.624 × (1 + 0.432 + 0.10 + 0.3)
  //        = 3962.095168
  //   普攻暴击 = 3962.095168 × 0.5 × 1 × 0.5 × 0.9 × 2.296 = 2046.8183637888
  //   perHeal = 3962.095168 × 0.018 + 18 = 89.317713024
  //   nume = 5×(3962.095168×0.072+142) + 3962.095168×0.09 + 177.5 = 2670.4428256
  //   numq = 5×(3962.095168×0.1+200) + 3962.095168×0.12 + 240 = 3696.49900416
  //   cure = ((2×nume+numq)/3 + 7×perHeal) × 1.6 = 5820.29686872747
  //   忆灵技暴击 = 5820.29686872747 × 0.18 × 3.4(天赋3层) × 0.5 × 0.9 × 2.296
  //             = 3680.28080356
  const ref = hyacineRef({ rank: 0, levels: [6, 8, 10, 10], me: 5, mt: 5 })
  assert.equal(ref.speed, 149)
  assert.equal(ref.stormy, false)
  closeTo(ref.hp, 3962.095168, 'rank0 提高后生命')
  closeTo(ref.normal.critical, 2046.8183637888, 'rank0 普攻暴击（锚点复核）')
  closeTo(ref.me.critical, 3680.28080355564, 'rank0 忆灵技暴击（锚点复核）')
  checkRows(rowsOf(damage(panel(0, [6, 8, 10, 10], 5, 5))), ref, '风堇 rank0')
})

test('风堇（1409）rank6 手算对照：1魂生命上限/6魂抗穿/3.4 经验系数', () => {
  // 等级 [普攻10, 战技14, 终结技14, 天赋14]，忆灵技/忆灵天赋 10 级
  // rank6 推导：
  //   速度 = 39 + 110 × (1+0.3[2魂]) = 182 < 200，暴风停歇不触发
  //   生命 = 2106.4 + 1086.624 × (1 + 0.432 + 0.10 + 0.36 + 0.5[1魂]) = 4705.604608
  //   普攻暴击 = 4705.604608 × 0.7 × 0.5 × 0.9 × 1.2[6魂全抗穿] × 2.296
  //            = 4083.937772027904
  //   perHeal = 4705.604608 × 0.028 + 28 = 159.756929024
  //   nume = 5×(4705.604608×0.096+196) + 4705.604608×0.12 + 245 = 4048.3627648
  //   numq = 5×(4705.604608×0.12+245) + 4705.604608×0.144 + 294 = 5019.969828352
  //   1魂附加 = 6 × 4705.604608 × 0.08 = 2258.69021184
  //   cure = ((2×nume+numq)/3 + 7×perHeal + 1魂附加) × 3.4[6魂] = 26347.349703372798
  //   忆灵技暴击 = 26347.349703372798 × 0.28 × 3.88(天赋3层) × 0.5 × 0.9 × 1.2 × 2.296
  //             = 35488.88348828798
  const ref = hyacineRef({ rank: 6, levels: [10, 14, 14, 14], me: 10, mt: 10 })
  assert.equal(ref.speed, 182)
  assert.equal(ref.stormy, false)
  closeTo(ref.hp, 4705.604608, 'rank6 提高后生命（1魂 +50%）')
  closeTo(ref.normal.critical, 4083.937772027904, 'rank6 普攻暴击（锚点复核）')
  closeTo(ref.me.critical, 35488.88348828798, 'rank6 忆灵技暴击（锚点复核）')
  checkRows(rowsOf(damage(panel(6, [10, 14, 14, 14], 10, 10))), ref, '风堇 rank6')
})

test('风堇（1409）rank4 手算对照：暴风停歇速度档（生命+20%/治疗+17%/4魂暴伤+34%）', () => {
  // 速度词条 25 -> 60：速度 = 74 + 110 × 1.3[2魂] = 217 > 200，暴风停歇触发
  //   healMult = 1 + 17/100 = 1.17；4魂暴伤 = 17 × 2% = 34%
  //   生命 = 2106.4 + 1086.624 × (1 + 0.432 + 0.10 + 0.36 + 0.5[1魂] + 0.2[暴风停歇])
  //   普攻暴击 = 生命 × 0.7 × 0.5 × 0.9 × (1 + 0.5 + 0.796 + 0.34)
  //   忆灵技行：全部治疗分量 × healMult，经验系数 1.6（rank4 < 6）
  const opt = { speedDelta: 60 }
  const ref = hyacineRef({ rank: 4, levels: [10, 14, 14, 14], me: 10, mt: 10 }, opt)
  assert.equal(ref.speed, 217)
  assert.equal(ref.stormy, true)
  closeTo(ref.healMult, 1.17, 'rank4 暴风停歇治疗量档')
  closeTo(ref.cdmg, 1.636, 'rank4 4魂超速暴伤')
  checkRows(rowsOf(damage(panel(4, [10, 14, 14, 14], 10, 10, opt))), ref, '风堇 rank4 速度档')
})

test('风堇（1409）rank0 专武 23042 手算对照：全队烧血治疗 11 次档', () => {
  // 专武「愿虹光永驻天空」r1 静态速度 +18%：速度 = 39 + 110 × 1.18 = 168.8 < 200
  // miao calc.js：cureDelta = 11 × perHeal 计入战技/终结技治疗分量
  //   （专武易伤/动态速度增益引擎光锥特效通道未覆盖，近似披露见提交说明）
  const opt = { equipment: { id: 23042, rank: 1 } }
  const ref = hyacineRef({ rank: 0, levels: [6, 8, 10, 10], me: 5, mt: 5 }, opt)
  closeTo(ref.speed, 168.8, '专武 r1 静态速度档')
  assert.equal(ref.stormy, false)
  assert.ok(ref.cureAmount > 0, '专武档累计治疗为正')
  checkRows(rowsOf(damage(panel(0, [6, 8, 10, 10], 5, 5, opt))), ref, '风堇 rank0 专武')
})

test('风堇（1409）忆灵技能位等级回落：behaviorList 无 301/302 条目时取 1 级', () => {
  // 忆灵技倍率取 me 表 1 级（0.1）；忆灵天赋治疗取 mt 表 1 级（1% + 10）
  const p = panel(0, [6, 8, 10, 10])
  p.behaviorList = p.behaviorList.filter(b => !String(b.id).endsWith('301') && !String(b.id).endsWith('302'))
  const ref = hyacineRef({ rank: 0, levels: [6, 8, 10, 10], me: 1, mt: 1 })
  checkRows(rowsOf(damage(p)), ref, '风堇 忆灵等级回落')
})

/* ============================================================
 * 二、完备性：全伤害行有限正数、期望 ≤ 暴击（阴云莞尔满暴 → 期望=暴击）
 * ============================================================ */
const WEAPON_CYCLE = [
  { id: 23001, rank: 5 }, { id: 21010, rank: 1 }, { id: 20007, rank: 3 },
  { id: 20014, rank: 2 }, { id: 21024, rank: 4 }, { id: 0, rank: 1 },
  { id: 23042, rank: 5 }
]
test('风堇 rank0/rank4/rank6 × 光锥轮换：全伤害行有限正数、期望 ≤ 暴击', async (t) => {
  let totalRows = 0
  for (const rank of [0, 4, 6]) {
    await t.test(`rank${rank}`, () => {
      for (const equipment of WEAPON_CYCLE) {
        const ret = damage(panel(rank, [10, 14, 14, 14], 10, 10, { equipment, speedDelta: 60 }))
        assert.ok(ret && Array.isArray(ret.damage) && ret.damage.length > 0, '应返回伤害行')
        assert.equal(ret.damage.length, Object.keys(skilldict['1409'].skillList).length,
          '行数应等于 skillList 槽位数')
        for (const row of ret.damage) {
          totalRows++
          const { critical, expect } = row.value
          assert.ok(Number.isFinite(critical) && critical > 0,
            `[${row.title}] 暴击伤害应为有限正数（critical=${critical}）`)
          assert.ok(Number.isFinite(expect) && expect > 0,
            `[${row.title}] 期望伤害应为有限正数（expect=${expect}）`)
          assert.ok(expect <= critical * (1 + 1e-12), `[${row.title}] 期望 ${expect} 应 ≤ 暴击 ${critical}`)
        }
      }
    })
  }
  t.diagnostic(`共检查 ${totalRows} 个伤害行（7 光锥 × 3 命途 × 2 行）`)
})

/* ============================================================
 * 三、SkillData 覆盖 + 总数终检
 * ============================================================ */
test('SkillData 覆盖：1409 数组长度（普攻/忆灵技/忆灵天赋表 10 级，其余 15 级）', () => {
  const entry = skilldict['1409']
  const expect10 = ['Normal', 'Me', 'Mt_HealPct', 'Mt_HealFlat']
  const expect15 = ['Talent', 'Q_HpPct', 'Q_HpFlat', 'E_HealPct', 'E_HealFlat',
    'E_MemoHealPct', 'E_MemoHealFlat', 'Q_HealPct', 'Q_HealFlat',
    'Q_MemoHealPct', 'Q_MemoHealFlat']
  for (const slot of expect10) {
    assert.ok(Array.isArray(entry[slot]) && entry[slot].length === 10,
      `1409.${slot} 应为 10 级数组（实际 ${entry[slot] && entry[slot].length}）`)
  }
  for (const slot of expect15) {
    assert.ok(Array.isArray(entry[slot]) && entry[slot].length === 15,
      `1409.${slot} 应为 15 级数组（实际 ${entry[slot] && entry[slot].length}）`)
  }
  assert.deepEqual(entry.Maze, [20])
  assert.deepEqual(entry.Ultra_Use, [140]) // miao data.json sp = 140
  assert.deepEqual(Object.keys(entry.skillList), ['Normal', 'Me'])
})

test('SkillData 终检：1409 收录后总数恰为 105（全角色伤害数据补齐）', () => {
  const ids = Object.keys(skilldict)
  assert.equal(ids.length, 105, `SkillData 条目数应为 105（实际 ${ids.length}）`)
  assert.ok(skilldict['1409'] && skilldict['1409'].skillList, '1409 应有 skillList 伤害行')
  // 块头出现次数 = 解析键数（文件级强校验，防重复块/缩进漂移）
  const raw = readFileSync(new URL('../../../utils/damage/json/SkillData.json', import.meta.url), 'utf8')
  const headers = []
  for (const line of raw.split('\n')) {
    const m = line.replace(/\r$/, '').match(/^([ \t]*)"(\d+)": \{$/)
    if (m && (m[1] === '    ' || m[1] === '\t')) headers.push(m[2])
  }
  assert.equal(headers.length, 105, `块头出现次数 ${headers.length} 应 = 105`)
  assert.equal(new Set(headers).size, 105, '块头不得重复')
})

/* ============================================================
 * 四、character.json 1409 行迹节点抽核（引擎 skillTree 通路）
 * ============================================================ */
test('character.json 1409：18 节点齐全、小节点属性与大节点名称抽核', () => {
  const charDict = JSON.parse(readFileSync(new URL('../../../utils/damage/json/character.json', import.meta.url), 'utf8'))
  const e = charDict['1409']
  assert.ok(e, 'character.json 应有 1409 条目')
  assert.deepEqual(Object.keys(e), [
    '1409001', '1409002', '1409003', '1409004', '1409007',
    '1409101', '1409102', '1409103',
    '1409201', '1409202', '1409203', '1409204', '1409205',
    '1409206', '1409207', '1409208', '1409209', '1409210'
  ], '节点应为 001-004/007 + 101-103 + 201-210（301/302 忆灵技能位不入表）')
  // 大节点名称（xiaoyao 游戏 dump 原文）
  assert.equal(e['1409101'].name, '阴云莞尔')
  assert.equal(e['1409102'].name, '雷雨轻柔')
  assert.equal(e['1409103'].name, '暴风停歇')
  // 小节点属性抽核（与 miao tree 逐节点对拍一致的快照）
  const prop = (id) => e[id].levels[0].properties[0]
  assert.deepEqual(prop('1409201'), { type: 'SpeedDelta', value: 2 })
  assert.deepEqual(prop('1409204'), { type: 'HPAddedRatio', value: 0.04 })
  assert.deepEqual(prop('1409208'), { type: 'HPAddedRatio', value: 0.06 })
  assert.deepEqual(prop('1409209'), { type: 'StatusResistanceBase', value: 0.08 })
  assert.deepEqual(prop('1409210'), { type: 'SpeedDelta', value: 4 })
})

/* ============================================================
 * 五、avatarRankSkillUp 1409 星魂加等级快照（与官方星魂文本核对一致）
 * ============================================================ */
test('avatarRankSkillUp 1409：3魂/5魂技能升级映射、其余星魂无升级', () => {
  const rankUp = JSON.parse(readFileSync(new URL('../../../utils/damage/json/avatarRankSkillUp.json', import.meta.url), 'utf8'))
  // 官方文本：3魂 终结技+2/普攻+1/忆灵技+1；5魂 战技+2/天赋+2/忆灵天赋+1
  assert.deepEqual(rankUp['140903'], [
    { id: '140903', num: 2 }, { id: '140901', num: 1 }, { id: '1409301', num: 1 }
  ])
  assert.deepEqual(rankUp['140905'], [
    { id: '140902', num: 2 }, { id: '140904', num: 2 }, { id: '1409302', num: 1 }
  ])
  for (const k of ['140901', '140902', '140904', '140906']) {
    assert.deepEqual(rankUp[k], [], `${k} 应无技能升级`)
  }
})

/* ============================================================
 * 六、钩子状态：幂等（多次计算不累积）、面板相关重算、命途切换回退
 * ============================================================ */
test('钩子状态：rank6→rank0→rank6 交替与不同面板重算，输出不累积且正确回退', () => {
  const seq = []
  for (const rank of [6, 0, 6, 0, 6]) {
    const ret = damage(panel(rank, rank === 0 ? [6, 8, 10, 10] : [10, 14, 14, 14],
      rank === 0 ? 5 : 10, rank === 0 ? 5 : 10))
    seq.push(JSON.stringify(ret.damage.map(r => r.value)))
  }
  assert.equal(seq[0], seq[2], 'rank6 两次计算应逐字段一致（不累积）')
  assert.equal(seq[1], seq[3], 'rank0 两次计算应逐字段一致（回退正确）')
  assert.equal(seq[0], seq[4], 'rank6 第三次计算应逐字段一致')
  assert.notEqual(seq[0], seq[1], 'rank0/6 应不同（3.4 系数/1魂/6魂切换）')
  // 不同面板（速度档切换）在同进程内先后计算：各自命中各自参考值（倍率按面板重算）
  const fast = damage(panel(4, [10, 14, 14, 14], 10, 10, { speedDelta: 60 }))
  const slow = damage(panel(4, [10, 14, 14, 14], 10, 10, { speedDelta: 25 }))
  checkRows(rowsOf(fast), hyacineRef({ rank: 4, levels: [10, 14, 14, 14], me: 10, mt: 10 }, { speedDelta: 60 }), '风堇 rank4 重算快档')
  checkRows(rowsOf(slow), hyacineRef({ rank: 4, levels: [10, 14, 14, 14], me: 10, mt: 10 }, { speedDelta: 25 }), '风堇 rank4 重算慢档')
  assert.notEqual(JSON.stringify(fast.damage), JSON.stringify(slow.damage), '速度档应影响忆灵技行输出')
})
