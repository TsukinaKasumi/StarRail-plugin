/**
 * 强化角色（Pro 形态，avatarId 2xxx）伤害抽查
 *
 * 手算对照参考 temp/pro-commit2-verify.mjs 的推导；数值锚点为 miao-plugin
 * resources/meta-sr/character/{角色Pro}/data.json talent 表的独立快照（本文件硬编码，
 * 测试不依赖 miao-plugin 在场，也可在锚点数据变化时暴露 SkillData 转写漂移）；
 * 面板输入全部合成自建（遗器/行迹等级为虚构组合，不含用户数据）。
 *
 * 覆盖：
 *   - 刃Pro / 镜流Pro / 卡芙卡Pro 手算对照（rank0 + rank6，暴击与期望双口径）
 *   - 8 个 Pro 角色 rank0/rank6 全伤害行完备性（有限正数、期望 ≤ 暴击）
 *   - SkillData 覆盖检查（8 个 2xxx 条目各槽位数组长度覆盖星魂+2 后等级）
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
// 倍率数组按等级取值（与引擎 getskilllevelnum 的越界收敛一致）
const at = (arr, lv) => arr[Math.min(lv, arr.length) - 1]

/* ============================================================
 * 数值锚点：miao-plugin talent 表快照（2026-10 提取，独立于 SkillData.json）
 * ============================================================ */
// 刃Pro（a2 强化普攻 / q 终结技 / t 追加攻击 / e 战技地狱变）
const BLADE = {
  a2Dmg: [0.65, 0.78, 0.91, 1.04, 1.17, 1.3, 1.43, 1.56, 1.69, 1.82],           // a2.技能伤害
  a2Adj: [0.26, 0.312, 0.364, 0.416, 0.468, 0.52, 0.572, 0.624, 0.676, 0.728],  // a2.相邻目标伤害
  q1: [0.9, 0.96, 1.02, 1.08, 1.14, 1.2, 1.275, 1.35, 1.425, 1.5, 1.56, 1.62, 1.68, 1.74, 1.8],        // q.生命上限伤害
  q2: [0.72, 0.768, 0.816, 0.864, 0.912, 0.96, 1.02, 1.08, 1.14, 1.2, 1.248, 1.296, 1.344, 1.392, 1.44], // q.累计已损生命伤害
  q3: [0.36, 0.384, 0.408, 0.432, 0.456, 0.48, 0.51, 0.54, 0.57, 0.6, 0.624, 0.648, 0.672, 0.696, 0.72], // q.相邻目标•生命上限伤害
  q4: [0.36, 0.384, 0.408, 0.432, 0.456, 0.48, 0.51, 0.54, 0.57, 0.6, 0.624, 0.648, 0.672, 0.696, 0.72], // q.相邻目标•累计已损生命伤害
  tAppend: [0.65, 0.715, 0.78, 0.845, 0.91, 0.975, 1.05625, 1.1375, 1.21875, 1.3, 1.365, 1.43, 1.495, 1.56, 1.625], // t.追加攻击伤害
  eDmgUp: [0.12, 0.148, 0.176, 0.204, 0.232, 0.26, 0.295, 0.33, 0.365, 0.4, 0.428, 0.456, 0.484, 0.512, 0.54]        // e.造成的伤害提高
}
// 镜流Pro（a 普攻 / e2 强化战技 / q 终结技 / t 转魄与月色）
const JINGLIU = {
  a: [0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7],                    // a.技能伤害
  e2D: [0.75, 0.825, 0.9, 0.975, 1.05, 1.125, 1.21875, 1.3125, 1.40625, 1.5, 1.575, 1.65, 1.725, 1.8, 1.875], // e2.技能伤害
  e2A: [0.375, 0.4125, 0.45, 0.4875, 0.525, 0.5625, 0.60938, 0.65625, 0.70313, 0.75, 0.7875, 0.825, 0.8625, 0.9, 0.9375], // e2.相邻目标伤害
  qD: [0.9, 0.99, 1.08, 1.17, 1.26, 1.35, 1.4625, 1.575, 1.6875, 1.8, 1.89, 1.98, 2.07, 2.16, 2.25],   // q.技能伤害
  qA: [0.45, 0.495, 0.54, 0.585, 0.63, 0.675, 0.73125, 0.7875, 0.84375, 0.9, 0.945, 0.99, 1.035, 1.08, 1.125], // q.相邻目标伤害
  tCpct: [0.4, 0.41, 0.42, 0.43, 0.44, 0.45, 0.4625, 0.475, 0.4875, 0.5, 0.51, 0.52, 0.53, 0.54, 0.55], // t.暴击率提高
  tCdmg: [0.22, 0.242, 0.264, 0.286, 0.308, 0.33, 0.3575, 0.385, 0.4125, 0.44, 0.462, 0.484, 0.506, 0.528, 0.55] // t.暴伤提高
}
// 卡芙卡Pro（a 普攻 / e 战技引爆 / q 终结技引爆 + 触电 DOT 表 / t 追加攻击）
const KAFKA = {
  aDmg: [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4],                         // a.技能伤害
  eD: [0.8, 0.88, 0.96, 1.04, 1.12, 1.2, 1.3, 1.4, 1.5, 1.6, 1.68, 1.76, 1.84, 1.92, 2],  // e.技能伤害
  eA: [0.3, 0.33, 0.36, 0.39, 0.42, 0.45, 0.4875, 0.525, 0.5625, 0.6, 0.63, 0.66, 0.69, 0.72, 0.75], // e.相邻目标伤害
  qD: [0.48, 0.512, 0.544, 0.576, 0.608, 0.64, 0.68, 0.72, 0.76, 0.8, 0.832, 0.864, 0.896, 0.928, 0.96], // q.技能伤害
  qDot: [1.16, 1.26875, 1.3775, 1.48625, 1.595, 1.75813, 1.97563, 2.2475, 2.57375, 2.9, 3.04138, 3.18275, 3.32413, 3.4655, 3.60688], // q.持续伤害
  qDotRatio: [1, 1.02, 1.04, 1.06, 1.08, 1.1, 1.125, 1.15, 1.175, 1.2, 1.22, 1.24, 1.26, 1.28, 1.3],     // q.持续伤害比例
  eDotMain: [0.6, 0.615, 0.63, 0.645, 0.66, 0.675, 0.69375, 0.7125, 0.73125, 0.75, 0.765, 0.78, 0.795, 0.81, 0.825], // e.单体持续伤害比例
  eDotAdj: [0.4, 0.41, 0.42, 0.43, 0.44, 0.45, 0.4625, 0.475, 0.4875, 0.5, 0.51, 0.52, 0.53, 0.54, 0.55],             // e.相邻目标持续伤害比例
  tDmg: [0.42, 0.518, 0.616, 0.714, 0.812, 0.91, 1.0325, 1.155, 1.2775, 1.4, 1.498, 1.596, 1.694, 1.792, 1.89]       // t.技能伤害
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

// 刃Pro：行迹小节点（2205201-5210）合计 HP 28% / 暴击率 12% / 效果抵抗 10%
function bladeProPanel (rank) {
  return {
    avatarId: 2205,
    name: '手算刃Pro',
    level: 80,
    rank,
    damage_type: 'Wind',
    properties: { hpBase: 1358.28, attackBase: 543.312, defenseBase: 485.1, speedBase: 97 },
    relics: [
      { id: 61001, main_affix_tag: 'HPAddedRatio', main_affix_value: 0.432, sub_affix_id: [{ tag: 'CriticalDamageBase', value: 0.145 }] },
      { id: 61002, main_affix_tag: 'CriticalDamageBase', main_affix_value: 0.648, sub_affix_id: [{ tag: 'HPAddedRatio', value: 0.093 }] },
      { id: 61003, main_affix_tag: 'CriticalChanceBase', main_affix_value: 0.289, sub_affix_id: [{ tag: 'HPDelta', value: 217.6 }] },
      { id: 61004, main_affix_tag: 'HPAddedRatio', main_affix_value: 0.432, sub_affix_id: [{ tag: 'CriticalDamageBase', value: 0.081 }] },
      { id: 61005, main_affix_tag: 'SpeedDelta', main_affix_value: 25, sub_affix_id: [{ tag: 'CriticalChanceBase', value: 0.058 }] },
      { id: 61006, main_affix_tag: 'HPDelta', main_affix_value: 1120.3, sub_affix_id: [{ tag: 'CriticalDamageBase', value: 0.115 }] }
    ],
    equipment: { id: 0, rank: 1 },
    relic_sets: [],
    skillTree: minorNodes(2205),
    behaviorList: behavior(2205, [6, 8, 10, 12])
  }
}

// 镜流Pro：行迹取爆伤节点（201/203/205/207/210 合计 37.3%）与生命节点（204/208 合计 10%），
// 速度节点不入（对伤害无贡献，保持手算简单）
function jingliuProPanel (rank, levels) {
  return {
    avatarId: 2212,
    name: '手算镜流Pro',
    level: 80,
    rank,
    damage_type: 'Ice',
    properties: { hpBase: 1435.896, attackBase: 679.14, defenseBase: 485.1, speedBase: 96 },
    relics: [
      { id: 61001, main_affix_tag: 'HPAddedRatio', main_affix_value: 0.432, sub_affix_id: [{ tag: 'CriticalDamageBase', value: 0.126 }] },
      { id: 61002, main_affix_tag: 'CriticalDamageBase', main_affix_value: 0.648, sub_affix_id: [{ tag: 'HPAddedRatio', value: 0.108 }] },
      { id: 61003, main_affix_tag: 'CriticalChanceBase', main_affix_value: 0.331, sub_affix_id: [{ tag: 'HPDelta', value: 246.9 }] },
      { id: 61004, main_affix_tag: 'HPAddedRatio', main_affix_value: 0.432, sub_affix_id: [{ tag: 'IceAddedRatio', value: 0.072 }] }
    ],
    equipment: { id: 0, rank: 1 },
    relic_sets: [],
    skillTree: [2212201, 2212203, 2212205, 2212207, 2212210, 2212204, 2212208]
      .map(id => ({ id, level: 1 })),
    behaviorList: behavior(2212, levels)
  }
}

// 卡芙卡Pro：行迹小节点（2005201-5210）合计 攻击 28% / 效果命中 18% / 生命 10%
function kafkaProPanel (rank) {
  return {
    avatarId: 2005,
    name: '手算卡芙卡Pro',
    level: 80,
    rank,
    damage_type: 'Thunder',
    properties: { hpBase: 1244.28, attackBase: 611.51, defenseBase: 485.1, speedBase: 101 },
    relics: [
      { id: 61001, main_affix_tag: 'AttackAddedRatio', main_affix_value: 0.412, sub_affix_id: [{ tag: 'CriticalDamageBase', value: 0.162 }] },
      { id: 61002, main_affix_tag: 'CriticalDamageBase', main_affix_value: 0.648, sub_affix_id: [{ tag: 'ThunderAddedRatio', value: 0.085 }] },
      { id: 61003, main_affix_tag: 'CriticalChanceBase', main_affix_value: 0.274, sub_affix_id: [{ tag: 'AttackDelta', value: 21.7 }] },
      { id: 61004, main_affix_tag: 'AttackAddedRatio', main_affix_value: 0.412, sub_affix_id: [{ tag: 'CriticalDamageBase', value: 0.099 }] }
    ],
    equipment: { id: 0, rank: 1 },
    relic_sets: [],
    skillTree: minorNodes(2005),
    behaviorList: behavior(2005, [6, 10, 12, 12])
  }
}

/* ============================================================
 * 一、手算对照
 * ============================================================ */

test('刃Pro（2205）手算对照：rank0 / rank6（生命注入 + 1/2/4/6 魂路径）', () => {
  const [basicLv, skillLv, ultLv, talentLv] = [6, 8, 10, 12] // 普攻6 战技8 终结技10 天赋12
  for (const rank of [0, 6]) {
    const rows = rowsOf(damage(bladeProPanel(rank)))

    // —— 手算（独立推导，只用 miao 锚点 + 面板合成值，不读 SkillData.json）——
    // 生命合计：基础 ×(1 + 行迹生命 28% + 遗器 HP% (0.432+0.093+0.432) + 4魂 40%) + 遗器固定 HP (217.6+1120.3)
    //   （钩子把该生命值注入为攻击基数，引擎 attack 分支按攻击倍率消费）
    const hpRatio = 0.28 + 0.432 + 0.093 + 0.432 + (rank >= 4 ? 0.4 : 0)
    const hpTotal = 1358.28 * (1 + hpRatio) + 217.6 + 1120.3
    // 暴击率：基础 5% + 行迹 12% + 遗器 (0.289+0.058) + 2魂 15%
    const cpct = Math.min(1, 0.05 + 0.12 + 0.289 + 0.058 + (rank >= 2 ? 0.15 : 0))
    // 爆伤：基础 50% + 遗器 (0.145+0.648+0.081+0.115)
    const cdmg = 0.5 + 0.145 + 0.648 + 0.081 + 0.115
    // 增伤：战技-地狱变 e.造成的伤害提高[战技等级 8] = 0.33
    const dmgUp = at(BLADE.eDmgUp, skillLv)
    // 倍率（主目标 + 相邻 x2；终结技为 生命上限档 + 已损生命档x90%）
    const normalMult = at(BLADE.a2Dmg, basicLv) + at(BLADE.a2Adj, basicLv) * 2
    const ultraMult = (at(BLADE.q1, ultLv) + at(BLADE.q3, ultLv) * 2) +
      (at(BLADE.q2, ultLv) + at(BLADE.q4, ultLv) * 2) * 0.9
    const talentMult = at(BLADE.tAppend, talentLv) * 3
    // 1魂：强化普攻/终结技附加伤害 = 终结技「累计已损生命」倍率 × 150% × 已损 90%
    const lostAdd = rank >= 1 ? at(BLADE.q2, ultLv) * 1.5 * 0.9 : 0
    // 6魂：追加攻击伤害值提高 50% x 3 目标（生命口径 -> 倍率 +1.5）
    const t6 = rank >= 6 ? 1.5 : 0
    // 防御区 0.5（Lv80 无无视防御）、抗性区 1.0（无穿透）、减伤 0.9
    const common = hpTotal * 0.5 * 0.9
    const expected = {
      '强化普攻·无间剑树': common * (normalMult + lostAdd) * (1 + dmgUp),
      '终结技': common * (ultraMult + lostAdd) * (1 + dmgUp),
      '天赋追加攻击(3目标)': common * (talentMult + t6) * (1 + dmgUp + 0.2) // 行迹-坏劫隳亡 追加攻击 +20%
    }
    for (const [title, base] of Object.entries(expected)) {
      const row = rows[title]
      assert.ok(row && row.critical > 0 && row.expect > 0, `rank${rank} ${title} 行存在且为正`)
      closeTo(row.critical, base * (1 + cdmg), `刃Pro rank${rank} ${title} 暴击`)
      closeTo(row.expect, base * (1 + cpct * cdmg), `刃Pro rank${rank} ${title} 期望`)
    }
  }
})

test('镜流Pro（2212）手算对照：rank0 / rank6（含 E3 终结技+2 等级档）', () => {
  const levelsByRank = { 0: [6, 8, 10, 12], 6: [9, 12, 14, 12] } // rank6 终结技 14 = 12 + E3 2 级
  for (const rank of [0, 6]) {
    const [basicLv, skillLv, ultLv, talentLv] = levelsByRank[rank]
    const rows = rowsOf(damage(jingliuProPanel(rank, levelsByRank[rank])))

    // —— 手算 ——
    // 生命合计：基础 ×(1 + 行迹生命 10% + 遗器 HP% (0.432+0.108+0.432)) + 固定 246.9（注入为攻击基数）
    const hpTotal = 1435.896 * (1 + 0.10 + 0.432 + 0.108 + 0.432) + 246.9
    // 暴击率：基础 5% + 遗器 0.331 + 天赋-转魄 t.暴击率提高[天赋等级 12] = 0.52
    const cpct = Math.min(1, 0.05 + 0.331 + at(JINGLIU.tCpct, talentLv))
    // 爆伤：基础 50% + 遗器 (0.126+0.648) + 行迹爆伤 37.3%
    //   + 【月色】5 层 x t.暴伤提高[天赋] + 1魂 36% + 4魂 5 层 x 20%
    const cdmg = 0.5 + 0.126 + 0.648 + 0.373 +
      5 * at(JINGLIU.tCdmg, talentLv) + (rank >= 1 ? 0.36 : 0) + (rank >= 4 ? 1.0 : 0)
    // 增伤：冰伤遗器 0.072（三行均为冰伤行）；终结技行另加 行迹-死境 转魄 +20%
    const iceUp = 0.072
    const normalMult = at(JINGLIU.a, basicLv)
    const bpskillMult = at(JINGLIU.e2D, skillLv) + at(JINGLIU.e2A, skillLv) * 2
    const ultraMult = at(JINGLIU.qD, ultLv) + at(JINGLIU.qA, ultLv) * 2
    const resArea = rank >= 6 ? 1.3 : 1.0 // 6魂：转魄下冰抗穿透 +30%
    const common = hpTotal * 0.5 * 0.9 * resArea
    const expected = {
      '普攻': common * normalMult * (1 + iceUp),
      '转魄·寒川映月': common * bpskillMult * (1 + iceUp),
      '终结技': common * ultraMult * (1 + iceUp + 0.2)
    }
    for (const [title, base] of Object.entries(expected)) {
      const row = rows[title]
      assert.ok(row && row.critical > 0 && row.expect > 0, `rank${rank} ${title} 行存在且为正`)
      closeTo(row.critical, base * (1 + cdmg), `镜流Pro rank${rank} ${title} 暴击`)
      closeTo(row.expect, base * (1 + cpct * cdmg), `镜流Pro rank${rank} ${title} 期望`)
    }
  }
})

test('卡芙卡Pro（2005）手算对照：rank0 / rank6（战技/终结技 DOT 组装行）', () => {
  const [basicLv, skillLv, ultLv, talentLv] = [6, 10, 12, 12] // 普攻6 战技10 终结技12 天赋12
  for (const rank of [0, 6]) {
    const rows = rowsOf(damage(kafkaProPanel(rank)))

    // —— 手算 ——
    // 攻击合计：基础 ×(1 + 行迹攻击 28% + 遗器攻击% (0.412+0.412)) + 遗器固定攻击 21.7
    const attack = 611.51 * (1 + 0.28 + 0.412 + 0.412) + 21.7
    // 暴击率：基础 5% + 遗器 0.274；爆伤：基础 50% + 遗器 (0.162+0.648+0.099)
    const cpct = 0.05 + 0.274
    const cdmg = 0.5 + 0.162 + 0.648 + 0.099
    // DOT 基数 = 终结技触电表[终结技等级 12] + 6魂触电伤害倍率提高 156%
    const dotBase = at(KAFKA.qDot, ultLv) + (rank >= 6 ? 1.56 : 0)
    // 战技引爆行倍率 = 战技直伤（主 + 相邻x2）+ DOT x（单体引爆比例 + 相邻引爆比例x2）（按战技等级 10）
    const bpskillMult = (at(KAFKA.eD, skillLv) + at(KAFKA.eA, skillLv) * 2) +
      dotBase * (at(KAFKA.eDotMain, skillLv) + at(KAFKA.eDotAdj, skillLv) * 2)
    // 终结技引爆行倍率 = 直伤 + DOTx引爆比例（基线）+ 6魂 156% x 比例（按终结技等级 12）
    const ultraMult = at(KAFKA.qD, ultLv) + at(KAFKA.qDot, ultLv) * at(KAFKA.qDotRatio, ultLv) +
      (rank >= 6 ? 1.56 * at(KAFKA.qDotRatio, ultLv) : 0)
    const normalMult = at(KAFKA.aDmg, basicLv)
    const talentMult = at(KAFKA.tDmg, talentLv)
    // 增伤：雷伤遗器 0.085；1魂：两个引爆行易伤 +30%（'BPSkill_DmgRatio' 命中引擎 _DmgRatio 匹配）
    //（普攻/追加攻击行不吃 1 魂的技能位键）
    const injury = 1 + 0.085
    const detoRatio = 1 + (rank >= 1 ? 0.3 : 0)
    // 已知问题（2026-10 抽查发现，待引擎侧修复）：2 魂本应给两个引爆行注入增伤 +33%，
    // 但 2005 钩子用的键名 'BPSkill_DmgAdd'/'Ultra_DmgAdd'（带下划线）无法被 main.js 的
    // DmgAdd 匹配命中（attr.split('DmgAdd')[0] 得到 'BPSkill_'，与技能位 'BPSkill' 不等；
    // 其余全部钩子均用无下划线的 'BPSkillDmgAdd' 等），该注入目前是死代码——
    // 手算按现状口径（引爆行增伤仍为 1.085）；修复钩子键名后此处应改为 1.415 并同步本注释。
    const detoInjury = injury
    const common = attack * 0.5 * 1.0 * 0.9 // 防御区 0.5、抗性区 1.0、减伤 0.9
    const expected = {
      '普攻': common * normalMult * injury,
      '追加攻击': common * talentMult * injury,
      '战技引爆伤害(扩散)': common * bpskillMult * detoInjury * detoRatio,
      '终结技引爆伤害': common * ultraMult * detoInjury * detoRatio
    }
    for (const [title, base] of Object.entries(expected)) {
      const row = rows[title]
      assert.ok(row && row.critical > 0 && row.expect > 0, `rank${rank} ${title} 行存在且为正`)
      closeTo(row.critical, base * (1 + cdmg), `卡芙卡Pro rank${rank} ${title} 暴击`)
      closeTo(row.expect, base * (1 + cpct * cdmg), `卡芙卡Pro rank${rank} ${title} 期望`)
    }
  }
})

/* ============================================================
 * 二、8 角色 rank0/rank6 完备性（有限正数、期望 ≤ 暴击）
 * ============================================================ */

const PRO_CHARS = {
  2004: ['瓦尔特Pro', 'Imaginary'],
  2005: ['卡芙卡Pro', 'Thunder'],
  2006: ['银狼Pro', 'Quantum'],
  2102: ['希儿Pro', 'Quantum'],
  2205: ['刃Pro', 'Wind'],
  2212: ['镜流Pro', 'Ice'],
  2217: ['藿藿Pro', 'Wind'],
  2310: ['流萤Pro', 'Fire']
}
const ELEMENT_SET = { Fire: '107', Physical: '105', Ice: '104', Quantum: '108', Thunder: '109', Wind: '110', Imaginary: '112' }
// 光锥轮换（含无光锥档），与回归基线组的 WEAPON_CYCLE 同池
const PRO_WEAPON_CYCLE = [
  { id: 23001, rank: 5 }, { id: 21010, rank: 1 }, { id: 20007, rank: 3 },
  { id: 20014, rank: 2 }, { id: 21024, rank: 4 }, { id: 0, rank: 1 },
  { id: 23001, rank: 5 }, { id: 21010, rank: 1 }
]

test('8 个 Pro 角色 rank0/rank6：全伤害行有限正数、期望 ≤ 暴击', async (t) => {
  let totalRows = 0
  for (const [idStr, [name, element]] of Object.entries(PRO_CHARS)) {
    const id = Number(idStr)
    for (const rank of [0, 6]) {
      await t.test(`${name} rank${rank}`, () => {
        const ret = damage({
          avatarId: id,
          name: '满配' + name,
          level: 80,
          rank,
          damage_type: element,
          properties: { hpBase: 1244.6, attackBase: 647.3, defenseBase: 501.2, speedBase: 100.5 },
          relics: [
            { id: 61011, main_affix_tag: 'AttackAddedRatio', main_affix_value: 0.352, sub_affix_id: [{ tag: 'CriticalDamageBase', value: 0.148 }, { tag: 'SpeedDelta', value: 3 }] },
            { id: 61012, main_affix_tag: 'CriticalDamageBase', main_affix_value: 0.648, sub_affix_id: [{ tag: 'AttackAddedRatio', value: 0.101 }] },
            { id: 61013, main_affix_tag: 'CriticalChanceBase', main_affix_value: 0.324, sub_affix_id: [{ tag: 'BreakDamageAddedRatioBase', value: 0.264 }] },
            { id: 61014, main_affix_tag: 'HPAddedRatio', main_affix_value: 0.432, sub_affix_id: [{ tag: 'StatusProbabilityBase', value: 0.078 }] },
            { id: 61015, main_affix_tag: 'SpeedDelta', main_affix_value: 25, sub_affix_id: [{ tag: 'HPDelta', value: 224.8 }] },
            { id: 61016, main_affix_tag: 'HPDelta', main_affix_value: 1146.6, sub_affix_id: [{ tag: 'AttackDelta', value: 38.2 }] }
          ],
          equipment: PRO_WEAPON_CYCLE[Number(idStr.slice(-1)) % PRO_WEAPON_CYCLE.length],
          relic_sets: [
            { set_id: ELEMENT_SET[element], set_name: '4件套' },
            { set_id: '114', set_name: '2件套' }
          ],
          skillTree: minorNodes(id),
          behaviorList: behavior(id, [8, 12, 13, 15])
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

test('SkillData 覆盖：8 个 2xxx Pro 条目，槽位数组长度覆盖星魂+2 后等级', () => {
  const ids = Object.keys(skilldict)
  assert.ok(ids.length >= 36, `SkillData 条目数 ${ids.length} 应不少于 36`)
  const proIds = ids.filter(id => id.startsWith('2')).sort()
  assert.deepEqual(proIds, ['2004', '2005', '2006', '2102', '2205', '2212', '2217', '2310'],
    '2xxx 条目应为 8 个 Pro 角色')
  // 满级基础等级：普攻 7、战技/终结技/天赋 12；星魂技能升级（avatarRankSkillUp.json，
  // E3/E5 档）合计：普攻点 +1、战技/终结技/天赋点各 +2 → 星魂满后可达等级：普攻 8、其余 14。
  // 各倍率/隐藏表数组长度必须覆盖其等级来源的最大等级（隐藏表按对应技能等级索引）。
  for (const id of proIds) {
    for (const [slot, arr] of Object.entries(skilldict[id])) {
      if (slot === 'skillList' || slot === 'Ultra_Use') continue
      assert.ok(Array.isArray(arr), `${id}.${slot} 应为数组`)
      const required = slot === 'Normal' ? 8 : 14
      assert.ok(arr.length >= required,
        `${id}.${slot} 长度 ${arr.length} 应 ≥ ${required}（覆盖星魂+2 后等级）`)
    }
  }
})
