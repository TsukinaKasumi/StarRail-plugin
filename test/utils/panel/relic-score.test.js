/**
 * 遗器本地评分 —— utils/panel/relicScore.js + resources/panel/data/artis-mark.json
 * （+ apps/panel.js panel() 的评分接入）
 *
 * 评分口径忠实移植自 miao-plugin ArtisMark/ArtisMarkCfg（sr 分支）：
 * - 手算对照：合成遗器按 miao 口径逐步算分（0 级/15 级、头/衣/球、同色/异色球）
 * - 权重表完整性：character.json 全 108 角色覆盖（106 显式权重 + Saber/Archer 走 default）
 * - miao 交叉验证：子进程 import 真实 miao ArtisMark 全量对比（移植忠实度最强验证；
 *   miao models/index.js 的别名热更新 fs.watch 会挂住进程，必须独立进程 + process.exit；
 *   miao-plugin 未安装时跳过）
 * - 接入：panel() 真实数据链（缓存读取 → fixupRelicMeta → scoreRelics → 渲染数据）
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import '../../helpers/globals.mjs'
import { register } from 'node:module'
import { bootFakeRoot } from '../../helpers/boot.mjs'

register('../../helpers/hooks.mjs', import.meta.url)

const sandbox = bootFakeRoot()
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const MIAO_ROOT = path.resolve(REPO_ROOT, '..', 'miao-plugin')

// 被测模块（relicScore 经 utils/path.js 读 pluginRoot 下的 artis-mark.json/relics.json，
// 须在伪根引导后动态 import；资源联接指向真实 resources，数据与线上一致）
const relicScore = await import('../../../utils/panel/relicScore.js')
const { Panel } = await import('../../../apps/panel.js')
const affixData = await import('../../../utils/panel/affixData.js')

const {
  getCharCfg, scoreRelic, scoreRelics, resolveCharWeights, getRelicPos,
  getMarkClass, damageTypeToMiaoElem
} = relicScore

const markJson = JSON.parse(fs.readFileSync(
  path.join(sandbox.pluginRoot, 'resources/panel/data/artis-mark.json'), 'utf8'))
const characterJson = JSON.parse(fs.readFileSync(
  path.join(sandbox.pluginRoot, 'resources/panel/data/character.json'), 'utf8'))

// 数值口径（affixData.starData = miao artifact meta.json 快照，5 星档）
const sd5 = affixData.starData['5']
const mainVal = (attr, level) => sd5.main[attr][0] + sd5.main[attr][1] * level
const subVal = (subId, count, steps) => sd5.sub[subId][1] * count + sd5.sub[subId][2] * steps
const pct = v => v / 100
const closeTo = (actual, expected, eps = 1e-9, msg = '') =>
  assert.ok(Math.abs(actual - expected) < eps, `${msg} ${actual} 应约等于 ${expected}`)

// ---------- 评分配置（getCharCfg，miao ArtisMarkCfg.getCfg 口径手算） ----------

// 丹恒：权重 {atk:75, speed:75, cpct:100, cdmg:100, recharge:50, dmg:100}，
// 基础属性 {hp:882, atk:546.84, def:396.9}（miao baseAttr 快照）
const DYH = 1002
const dyhBase = { hp: 882, atk: 546.84, def: 396.9 }
// 小攻击折算（miao 原式：weight / attrMap.atk.value / (baseAttr.atk + 520) × 100）
const dyhAtkPlusMark = 75 / 4.32 / (546.84 + 520) * 100
const dyhCfg = getCharCfg(DYH)

test('getCharCfg：丹恒 attrs 表 = 权重/单次满强化值（小词条按基础属性折算）', () => {
  assert.deepEqual(Object.keys(dyhCfg.attrs).sort(),
    ['atk', 'atkPlus', 'cdmg', 'cpct', 'dmg', 'recharge', 'speed'],
    '只收录 weight>0 词条（hp/def/effPct/effDef/stance/heal 权重为 0 不进表）')
  closeTo(dyhCfg.attrs.atk.mark, 75 / 4.32, 1e-12, '大攻击 mark')
  closeTo(dyhCfg.attrs.cpct.mark, 100 / 3.24, 1e-12, '暴击率 mark')
  closeTo(dyhCfg.attrs.cdmg.mark, 100 / 6.48, 1e-12, '暴击伤害 mark')
  closeTo(dyhCfg.attrs.speed.mark, 75 / 2.6, 1e-12, '速度 mark')
  closeTo(dyhCfg.attrs.recharge.mark, 50 / 3.11, 1e-12, '充能 mark')
  closeTo(dyhCfg.attrs.dmg.mark, 100 / 6.22, 1e-12, '伤害加成 mark')
  closeTo(dyhCfg.attrs.atkPlus.mark, dyhAtkPlusMark, 1e-12, '小攻击 mark')
  closeTo(dyhCfg.attrs.atkPlus.fixWeight, dyhAtkPlusMark * (127 / 6), 1e-9, '小攻击 fixWeight')
})

test('getCharCfg：丹恒 posMaxMark 手算（最优主词条×2 + 最优4副词条 首×6余×1）', () => {
  // 部位3：最优主词条 cdmg(fixWeight 100)×2；副词条排除 cdmg 后
  //   cpct×6 + speed + atk + atkPlus(34.45)
  const p3 = 100 * 2 + 100 * 6 + 75 + 75 + dyhAtkPlusMark * (127 / 6)
  // 部位4：最优主词条 speed(75)×2；副词条排除 speed：cdmg×6 + cpct + atk + atkPlus
  const p4 = 75 * 2 + 100 * 6 + 100 + 75 + dyhAtkPlusMark * (127 / 6)
  // 部位5：最优主词条 dmg(100)×2；副词条（dmg 不在副词条表）：cdmg×6 + cpct + atk + speed
  const p5 = 100 * 2 + 100 * 6 + 100 + 75 + 75
  // 部位6：最优主词条 atk(75)×2；副词条排除 atk：cdmg×6 + cpct + speed + atkPlus
  const p6 = 75 * 2 + 100 * 6 + 100 + 75 + dyhAtkPlusMark * (127 / 6)
  // 部位1/2：主词条固定不计分（mMark=0），副词条满分 cdmg×6 + cpct + atk + speed
  const p12 = 100 * 6 + 100 + 75 + 75
  const expected = {
    1: p12, 2: p12, 3: p3, 4: p4, 5: p5, 6: p6,
    m1: 0, m2: 0, m3: 100, m4: 75, m5: 100, m6: 75
  }
  for (const k of Object.keys(expected)) {
    closeTo(dyhCfg.posMaxMark[k], expected[k], 1e-9, `posMaxMark.${k}`)
  }
})

// ---------- 单件评分手算对照（scoreRelic，miao ArtisMark.getMark 口径） ----------

// 遗器条目工厂（本插件缓存格式：百分比词条值为小数）
function mkRelic (id, mainTag, mainMiaoAttr, level, subs) {
  const mv = mainVal(mainMiaoAttr, level)
  return {
    id, level,
    main_affix_tag: mainTag,
    main_affix_name: '测试主词条',
    main_affix_value: /Ratio|Base$/.test(mainTag) ? pct(mv) : mv,
    sub_affix_id: subs.map(([tag, miaoAttr, subId, count, steps]) => {
      const v = subVal(subId, count, steps)
      return { tag, name: '测试副词条', value: /Ratio|Base$/.test(tag) ? pct(v) : v, cnt: count }
    })
  }
}

test('scoreRelic：15 级暴击衣（丹恒）—— 主词条/4 + Σ副词条，归一 66 分制', () => {
  // 副词条：小攻击×1、攻击%(3档2步)、速度(2档1步)、暴击伤害×1
  const relic = mkRelic(61013, 'CriticalChanceBase', 'cpct', 15, [
    ['AttackDelta', 'atkPlus', '2', 1, 0],
    ['AttackAddedRatio', 'atk', '5', 3, 2],
    ['SpeedDelta', 'speed', '7', 2, 1],
    ['CriticalDamageBase', 'cdmg', '9', 1, 0]
  ])
  const { score, pos, weights } = scoreRelic(relic, dyhCfg, { elem: 'wind' })
  assert.equal(pos, 3, 'BODY → 部位 3')
  // 手算：主词条 cpct = mark×值/4；副词条 = mark×值
  const mainCpct = (100 / 3.24) * mainVal('cpct', 15) / 4
  const sAtkPlus = dyhAtkPlusMark * subVal('2', 1, 0)
  const sAtk = (75 / 4.32) * subVal('5', 3, 2)
  const sSpeed = (75 / 2.6) * subVal('7', 2, 1)
  const sCdmg = (100 / 6.48) * subVal('9', 1, 0)
  const total = mainCpct + sAtkPlus + sAtk + sSpeed + sCdmg
  // fixPct：主词条 cpct 权重 100 / 部位3 最优主词条权重 100 → 1（不衰减）
  const expected = total * (1 + 1) / 2 / dyhCfg.posMaxMark[3] * 66
  closeTo(score, expected, 1e-9, '15级暴击衣得分')
  assert.ok(score > 40 && score < 50, `暴击衣+优质副词条应在 SSS 档附近，实际 ${score}`)
  // 副词条展示权重（等效最优词条满强化次数）：小攻击 ~0.34、攻击% 0.75×档位
  closeTo(weights[0], sAtkPlus / 100, 1e-12, '小攻击 weight')
  closeTo(weights[1], sAtk / 100, 1e-12, '攻击% weight')
})

test('scoreRelic：0 级头（丹恒）—— 头/手主词条不计分，仅副词条', () => {
  const relic = mkRelic(61011, 'HPDelta', 'hpPlus', 0, [
    ['AttackDelta', 'atkPlus', '2', 1, 0],
    ['SpeedDelta', 'speed', '7', 1, 0],
    ['CriticalChanceBase', 'cpct', '8', 1, 0],
    ['CriticalDamageBase', 'cdmg', '9', 1, 0]
  ])
  const { score, pos } = scoreRelic(relic, dyhCfg, { elem: 'wind' })
  assert.equal(pos, 1, 'HEAD → 部位 1')
  const total = dyhAtkPlusMark * subVal('2', 1, 0) +
    (75 / 2.6) * subVal('7', 1, 0) +
    (100 / 3.24) * subVal('8', 1, 0) +
    (100 / 6.48) * subVal('9', 1, 0)
  closeTo(score, total / dyhCfg.posMaxMark[1] * 66, 1e-9, '0级头得分')
  assert.ok(score > 10 && score < 25, `4 条初始档副词条约 B 档，实际 ${score}`)
})

test('scoreRelic：15 级球同色/异色（丹恒风）—— 同色按 dmg 权重，异色减半', () => {
  const subs = [
    ['AttackAddedRatio', 'atk', '5', 3, 2],
    ['CriticalChanceBase', 'cpct', '8', 2, 1],
    ['CriticalDamageBase', 'cdmg', '9', 2, 1],
    ['SpeedDelta', 'speed', '7', 1, 0]
  ]
  const sameElem = mkRelic(63015, 'WindAddedRatio', 'wind', 15, subs)
  const offElem = mkRelic(63015, 'FireAddedRatio', 'fire', 15, subs)
  const subTotal = (75 / 4.32) * subVal('5', 3, 2) +
    (100 / 3.24) * subVal('8', 2, 1) +
    (100 / 6.48) * subVal('9', 2, 1) +
    (75 / 2.6) * subVal('7', 1, 0)
  // 同色：mainKey=dmg，fixPct=100/100=1
  const sameExpected = ((100 / 6.22) * mainVal('wind', 15) / 4 + subTotal) *
    (1 + 1) / 2 / dyhCfg.posMaxMark[5] * 66
  // 异色：fire 无权重 → 主词条计 0，fixPct=0 → 总分减半系数
  const offExpected = subTotal * (1 + 0) / 2 / dyhCfg.posMaxMark[5] * 66
  const same = scoreRelic(sameElem, dyhCfg, { elem: 'wind' })
  const off = scoreRelic(offElem, dyhCfg, { elem: 'wind' })
  assert.equal(same.pos, 5, 'NECK → 部位 5')
  closeTo(same.score, sameExpected, 1e-9, '同色球得分')
  closeTo(off.score, offExpected, 1e-9, '异色球得分')
  assert.ok(same.score > off.score, '同色球应高于异色球')
})

test('scoreRelic：15 级充能绳不衰减 + 满档位阈值（getMarkClass）', () => {
  // 充能主词条跳过 fixPct 衰减判定（miao 原式 key !== recharge）
  const relic = mkRelic(63016, 'SPRatioBase', 'recharge', 15, [
    ['SpeedDelta', 'speed', '7', 3, 2],
    ['AttackAddedRatio', 'atk', '5', 2, 0],
    ['StatusResistanceBase', 'effDef', '11', 1, 0],
    ['HPAddedRatio', 'hp', '4', 1, 0]
  ])
  const { score, pos } = scoreRelic(relic, dyhCfg, { elem: 'wind' })
  assert.equal(pos, 6, 'OBJECT → 部位 6')
  const mainRecharge = (50 / 3.11) * mainVal('recharge', 15) / 4
  const subTotal = (75 / 2.6) * subVal('7', 3, 2) + (75 / 4.32) * subVal('5', 2, 0)
  closeTo(score, (mainRecharge + subTotal) * (1 + 1) / 2 / dyhCfg.posMaxMark[6] * 66,
    1e-9, '充能绳得分')
  // 档位阈值与 miao getMarkClass 一致
  assert.equal(getMarkClass(6.9), 'D')
  assert.equal(getMarkClass(7), 'C')
  assert.equal(getMarkClass(13.9), 'C')
  assert.equal(getMarkClass(14), 'B')
  assert.equal(getMarkClass(34.9), 'S')
  assert.equal(getMarkClass(55.9), 'ACE')
  assert.equal(getMarkClass(70), undefined, '≥70 超档（理论上限 ~66）')
})

test('scoreRelic：副词条 weight 语义（1.0 = 最优词条一次满强化）', () => {
  // 丹恒 cpct 权重 100：单次满强化（base+2×step = 3.24% → 0.0324）→ weight 1.0
  const maxRoll = { id: 61011, level: 0, main_affix_tag: 'HPDelta', main_affix_value: 112.896,
    sub_affix_id: [{ tag: 'CriticalChanceBase', value: 0.0324, cnt: 1 }] }
  const { weights } = scoreRelic(maxRoll, dyhCfg, {})
  closeTo(weights[0], 1.0, 1e-9, 'cpct 满强化 weight = 1.0（weight-heavy 阈值）')
  // 大攻击权重 75：满强化 4.32% → 0.75
  const atkRoll = { ...maxRoll, sub_affix_id: [{ tag: 'AttackAddedRatio', value: 0.0432, cnt: 1 }] }
  closeTo(scoreRelic(atkRoll, dyhCfg, {}).weights[0], 0.75, 1e-9, '攻击 75 权重满强化 = 0.75')
  // 无权重词条（effDef 权重 0）→ 0（模板不高亮）
  const dead = { ...maxRoll, sub_affix_id: [{ tag: 'StatusResistanceBase', value: 0.0432, cnt: 1 }] }
  closeTo(scoreRelic(dead, dyhCfg, {}).weights[0], 0, 1e-12, '0 权重词条 weight = 0')
})

// ---------- 权重表完整性（artis-mark.json） ----------

test('artis-mark.json：character.json 全 108 角色覆盖，权重 12 键完备', () => {
  assert.deepEqual(
    Object.keys(markJson.chars).sort(),
    Object.keys(characterJson).sort(),
    'chars 键集应与 character.json 完全一致'
  )
  const noWeight = []
  for (const [id, entry] of Object.entries(markJson.chars)) {
    assert.equal(entry.name, characterJson[id].name, `角色 ${id} 名称应与 character.json 一致`)
    assert.ok(entry.miao, `角色 ${id} 应记录 miao 侧键名（溯源）`)
    for (const k of ['hp', 'atk', 'def']) {
      assert.ok(typeof entry.base?.[k] === 'number' && entry.base[k] > 0,
        `角色 ${id} base.${k} 应为正数（miao baseAttr 快照）`)
    }
    if (!entry.weight) {
      noWeight.push(id)
      continue
    }
    assert.deepEqual(
      Object.keys(entry.weight).sort(),
      ['atk', 'cdmg', 'cpct', 'def', 'dmg', 'effDef', 'effPct', 'heal', 'hp', 'recharge', 'speed', 'stance'],
      `角色 ${id} 权重应为 miao 12 键全集`
    )
    for (const v of Object.values(entry.weight)) {
      assert.ok(typeof v === 'number' && v >= 0 && v <= 100, `角色 ${id} 权重值 ${v} 应在 0-100`)
    }
  }
  // 仅 miao usefulAttr 未收录的 Saber/Archer 走 default（与 miao defaultAttrWeight 行为一致）
  assert.deepEqual(noWeight.sort(), ['1014', '1015'])
})

test('artis-mark.json：default = miao SR defaultAttrWeight（未收录角色兜底）', () => {
  assert.deepEqual(markJson.default, {
    hp: 0, atk: 75, def: 0, speed: 100, cpct: 100, cdmg: 100,
    stance: 0, heal: 0, recharge: 0, effPct: 0, effDef: 0, dmg: 100
  })
  const saber = getCharCfg(1014)
  assert.deepEqual(Object.keys(saber.attrs).sort(),
    ['atk', 'atkPlus', 'cdmg', 'cpct', 'dmg', 'speed'], 'Saber 走 default 权重')
  closeTo(saber.attrs.atk.mark, 75 / 4.32, 1e-12, 'default 大攻击 mark')
})

test('resolveCharWeights：avatarId / 名称 / 圆点变体 / 未知角色', () => {
  assert.equal(resolveCharWeights(1002).name, '丹恒', 'avatarId 解析')
  assert.equal(resolveCharWeights('2205').name, '刃Pro', '强化形态 2xxx ID')
  assert.equal(resolveCharWeights('刃Pro').name, '刃Pro', '名称解析')
  assert.equal(resolveCharWeights('丹恒·饮月').name, '丹恒•饮月', '圆点变体归一（·/•）')
  // 未知角色 → default 权重 + miao 兜底基础属性
  const unknown = resolveCharWeights('不存在的角色')
  assert.deepEqual(unknown.weights, markJson.default, '未知角色走 default')
  assert.deepEqual(unknown.base, { hp: 14000, atk: 230, def: 700 }, 'miao 的 baseAttr 兜底值')
})

test('getRelicPos：relics.json type 优先，未知 ID 退编号末位', () => {
  assert.equal(getRelicPos(61013), 3, 'BODY')
  assert.equal(getRelicPos(63015), 5, 'NECK')
  assert.equal(getRelicPos('63016'), 6, 'OBJECT（字符串 id）')
  assert.equal(getRelicPos(61101), 1, '未收录 ID 退末位数字（HEAD）')
  assert.equal(getRelicPos(99999), null, '无法判定 → null')
})

// ---------- 批量接入（scoreRelics 就地覆盖） ----------

test('scoreRelics：就地填 score/weight，覆盖旧缓存残留的 avocado 旧分值', () => {
  const relics = [
    mkRelic(61013, 'CriticalChanceBase', 'cpct', 15, [
      ['AttackAddedRatio', 'atk', '5', 3, 2],
      ['CriticalDamageBase', 'cdmg', '9', 2, 1],
      ['SpeedDelta', 'speed', '7', 1, 0],
      ['StatusResistanceBase', 'effDef', '11', 1, 0]
    ]),
    // 旧缓存残留 avocado 分值：score 999 / weight 9，应被覆盖
    { ...mkRelic(61011, 'HPDelta', 'hpPlus', 9, [
      ['CriticalChanceBase', 'cpct', '8', 2, 0]
    ]), score: 999, sub_affix_id: [{ tag: 'CriticalChanceBase', value: 0.0518, cnt: 2, weight: 9 }] }
  ]
  const out = scoreRelics(DYH, relics, { elem: 'wind' })
  assert.equal(out, relics, '返回同一数组（就地）')
  for (const r of relics) {
    assert.equal(typeof r.score, 'number', '每件遗器应有数值 score')
    assert.ok(r.score < 70, `score 应在 66 分制内，实际 ${r.score}`)
    for (const sub of r.sub_affix_id) {
      assert.equal(typeof sub.weight, 'number', '每个副词条应有数值 weight')
    }
  }
  assert.notEqual(relics[1].score, 999, '旧 score 应被覆盖')
  assert.notEqual(relics[1].sub_affix_id[0].weight, 9, '旧 weight 应被覆盖')
  // 与单件直算一致
  const direct = scoreRelic(structuredClone(relics[0]), dyhCfg, { elem: 'wind' })
  closeTo(relics[0].score, direct.score, 1e-12, '批量与单件一致')
})

test('scoreRelics：非数组透传 / 空数组 / 未知遗器 ID 降级', () => {
  assert.equal(scoreRelics(DYH, undefined), undefined)
  assert.deepEqual(scoreRelics(DYH, []), [])
  // 未知 ID（部位不可判定）：score 0，副词条 weight 仍按角色权重给出
  const weird = [{
    id: 99999, level: 5, main_affix_tag: 'HPDelta', main_affix_value: 100,
    sub_affix_id: [{ tag: 'CriticalChanceBase', value: 0.0324, cnt: 1 }]
  }]
  scoreRelics(DYH, weird, {})
  assert.equal(weird[0].score, 0, '部位未知 → score 0')
  closeTo(weird[0].sub_affix_id[0].weight, 1.0, 1e-9, '副词条 weight 与部位无关，照常计算')
  // 未知角色 → default 权重仍可评分
  const fallback = [mkRelic(61013, 'CriticalChanceBase', 'cpct', 15, [])]
  scoreRelics('未知角色', fallback, {})
  assert.ok(fallback[0].score > 0, 'default 权重应能给出正分')
})

// ---------- miao 交叉验证（子进程；miao-plugin 未安装时跳过） ----------

const miaoAvailable = fs.existsSync(path.join(MIAO_ROOT, 'models/artis/ArtisMark.js'))

test('miao 交叉验证：全角色评分配置 + 合成遗器矩阵逐分一致', { skip: !miaoAvailable && 'miao-plugin 未安装' }, async () => {
  // 子进程脚本：miao models/index.js 的别名热更新 watcher 会钉住事件循环，
  // 不能在测试进程内 import，须独立进程跑完 process.exit
  const script = `
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
const MIAO = process.argv[2]
const MIAO_URL = p => pathToFileURL(path.join(MIAO, p)).href
await import(MIAO_URL('resources/meta-sr/artifact/index.js'))
const { default: ArtisMark } = await import(MIAO_URL('models/artis/ArtisMark.js'))
const { default: ArtisMarkCfg } = await import(MIAO_URL('models/artis/ArtisMarkCfg.js'))
const REPO = process.argv[3]
const relicScore = await import(pathToFileURL(path.join(REPO, 'utils/panel/relicScore.js')).href)
const affixData = await import(pathToFileURL(path.join(REPO, 'utils/panel/affixData.js')).href)
const pluginData = p => JSON.parse(fs.readFileSync(path.join(process.cwd(), 'plugins/StarRail-plugin/resources/panel/data', p), 'utf8'))
const characterJson = pluginData('character.json')
const markJson = pluginData('artis-mark.json')
const elemKey = { '火': 'fire', '冰': 'ice', '雷': 'elec', '量子': 'quantum', '风': 'wind', '虚数': 'imaginary', '物理': 'phy' }
// miao 侧角色 meta（baseAttr，getCfg 的 char.baseAttr 来源）
const miaoCharById = {}
const charDir = path.join(MIAO, 'resources/meta-sr/character')
for (const d of fs.readdirSync(charDir, { withFileTypes: true })) {
  if (!d.isDirectory()) continue
  const f = path.join(charDir, d.name, 'data.json')
  if (fs.existsSync(f)) {
    try { const j = JSON.parse(fs.readFileSync(f, 'utf8')); if (j && j.id != null && !miaoCharById[String(j.id)]) miaoCharById[String(j.id)] = j } catch (e) {}
  }
}
function miaoCfgOf (id, elem) {
  const meta = miaoCharById[id]
  const name = markJson.chars[id]?.miao || meta?.name || characterJson[id]?.name
  return ArtisMarkCfg.getCfg({
    game: 'sr',
    char: { isGs: false, game: 'sr', name, abbr: name, baseAttr: meta?.baseAttr || { hp: 14000, atk: 230, def: 700 }, getArtisCfg: () => false },
    attr: {}, elem,
    weapon: { name: '', affix: 1 }, artis: { is: () => false }, cons: 0
  })
}
// 1) 全 108 角色评分配置（attrs + posMaxMark）
let cfgFail = 0
for (const [id, v] of Object.entries(characterJson)) {
  const elem = elemKey[v.element] || 'phy'
  const miaoCfg = miaoCfgOf(id, elem)
  const ours = relicScore.getCharCfg(id)
  const mk = Object.keys(miaoCfg.attrs).sort()
  const ok2 = Object.keys(ours.attrs).sort()
  if (JSON.stringify(mk) !== JSON.stringify(ok2)) { cfgFail++; console.error('attrs键集 ' + id); continue }
  for (const k of mk) {
    const m = miaoCfg.attrs[k]; const o = ours.attrs[k]
    if (Math.abs(m.mark - o.mark) > 1e-9 || Math.abs(m.fixWeight - o.fixWeight) > 1e-9 || Math.abs(m.weight - o.weight) > 1e-9) {
      cfgFail++; console.error('attrs.' + k + ' ' + id + ' miao=' + m.mark + '/' + m.fixWeight + ' ours=' + o.mark + '/' + o.fixWeight)
    }
  }
  for (const pk of Object.keys(miaoCfg.posMaxMark)) {
    if (Math.abs(miaoCfg.posMaxMark[pk] - ours.posMaxMark[pk]) > 1e-9) {
      cfgFail++; console.error('posMaxMark.' + pk + ' ' + id + ' miao=' + miaoCfg.posMaxMark[pk] + ' ours=' + ours.posMaxMark[pk])
    }
  }
}
// 2) 合成遗器矩阵（6 部位 × 多主词条 × 0/15 级 × 8 角色）
const sd5 = affixData.starData['5']
const mainVal = (a, lv) => sd5.main[a][0] + sd5.main[a][1] * lv
const subVal = (sid, c, s) => sd5.sub[sid][1] * c + sd5.sub[sid][2] * s
const ourTag = { hpPlus: 'HPDelta', atkPlus: 'AttackDelta', defPlus: 'DefenceDelta', hp: 'HPAddedRatio', atk: 'AttackAddedRatio', def: 'DefenceAddedRatio', speed: 'SpeedDelta', cpct: 'CriticalChanceBase', cdmg: 'CriticalDamageBase', effPct: 'StatusProbabilityBase', effDef: 'StatusResistanceBase', stance: 'BreakDamageAddedRatioBase', phy: 'PhysicalAddedRatio', fire: 'FireAddedRatio', ice: 'IceAddedRatio', elec: 'ThunderAddedRatio', wind: 'WindAddedRatio', quantum: 'QuantumAddedRatio', imaginary: 'ImaginaryAddedRatio', heal: 'HealRatioBase', recharge: 'SPRatioBase' }
const miaoKeyOfTag = {}
for (const [k, t] of Object.entries(ourTag)) miaoKeyOfTag[t] = k
const isPctTag = t => /Ratio$|Base$/.test(t)
const subId = { HPDelta: '1', AttackDelta: '2', DefenceDelta: '3', HPAddedRatio: '4', AttackAddedRatio: '5', DefenceAddedRatio: '6', SpeedDelta: '7', CriticalChanceBase: '8', CriticalDamageBase: '9', StatusProbabilityBase: '10', StatusResistanceBase: '11', BreakDamageAddedRatioBase: '12' }
const mainId = {
  3: { HPAddedRatio: 1, AttackAddedRatio: 2, DefenceAddedRatio: 3, CriticalChanceBase: 4, CriticalDamageBase: 5, HealRatioBase: 6, StatusProbabilityBase: 7 },
  4: { HPAddedRatio: 1, AttackAddedRatio: 2, DefenceAddedRatio: 3, SpeedDelta: 4 },
  5: { HPAddedRatio: 1, AttackAddedRatio: 2, DefenceAddedRatio: 3, PhysicalAddedRatio: 4, FireAddedRatio: 5, IceAddedRatio: 6, ThunderAddedRatio: 7, WindAddedRatio: 8, QuantumAddedRatio: 9, ImaginaryAddedRatio: 10 },
  6: { BreakDamageAddedRatioBase: 1, SPRatioBase: 2, HPAddedRatio: 3, AttackAddedRatio: 4, DefenceAddedRatio: 5 }
}
// [pos, relicId, mainTags, level, subs[tag, count, steps]]
const matrix = [
  [1, 61011, ['HPDelta'], 0, [['AttackDelta', 1, 0], ['SpeedDelta', 1, 0], ['CriticalChanceBase', 1, 0], ['CriticalDamageBase', 1, 0]]],
  [1, 61011, ['HPDelta'], 15, [['AttackAddedRatio', 3, 2], ['SpeedDelta', 2, 1], ['CriticalChanceBase', 1, 0], ['StatusResistanceBase', 2, 1]]],
  [2, 61012, ['AttackDelta'], 15, [['HPAddedRatio', 2, 0], ['AttackAddedRatio', 2, 1], ['SpeedDelta', 1, 0], ['CriticalChanceBase', 3, 2]]],
  [3, 61013, ['CriticalChanceBase', 'CriticalDamageBase', 'HealRatioBase', 'StatusProbabilityBase'], 15, [['AttackDelta', 1, 0], ['AttackAddedRatio', 3, 2], ['SpeedDelta', 2, 1], ['CriticalDamageBase', 1, 0]]],
  [3, 61013, ['CriticalDamageBase'], 0, [['DefenceAddedRatio', 1, 0], ['SpeedDelta', 1, 0], ['HPAddedRatio', 1, 0], ['DefenceDelta', 1, 0]]],
  [4, 61014, ['SpeedDelta', 'AttackAddedRatio'], 15, [['AttackAddedRatio', 2, 2], ['CriticalChanceBase', 2, 1], ['CriticalDamageBase', 1, 0], ['AttackDelta', 2, 0]]],
  [5, 63015, ['__ELEM__', '__OFF__', 'AttackAddedRatio'], 15, [['AttackAddedRatio', 3, 2], ['CriticalChanceBase', 2, 1], ['CriticalDamageBase', 2, 1], ['SpeedDelta', 1, 0]]],
  [6, 63016, ['SPRatioBase', 'BreakDamageAddedRatioBase', 'HPAddedRatio'], 15, [['BreakDamageAddedRatioBase', 2, 1], ['SpeedDelta', 2, 2], ['StatusResistanceBase', 1, 0], ['HPAddedRatio', 1, 0]]]
]
const charIds = ['1002', '1105', '1202', '1214', '1310', '1304', '2205', '1014']
let markFail = 0
let compared = 0
for (const id of charIds) {
  const v = characterJson[id]
  const elem = elemKey[v.element] || 'phy'
  const miaoCfg = miaoCfgOf(id, elem)
  const ourCfg = relicScore.getCharCfg(id)
  for (const [pos, relicId, mainTags, level, subs] of matrix) {
    for (let mainTag of mainTags) {
      if (mainTag === '__ELEM__') mainTag = { fire: 'FireAddedRatio', ice: 'IceAddedRatio', elec: 'ThunderAddedRatio', wind: 'WindAddedRatio', quantum: 'QuantumAddedRatio', imaginary: 'ImaginaryAddedRatio', phy: 'PhysicalAddedRatio' }[elem]
      if (mainTag === '__OFF__') mainTag = elem === 'fire' ? 'IceAddedRatio' : 'FireAddedRatio'
      const mk = miaoKeyOfTag[mainTag]
      const ourRelic = {
        id: relicId, level,
        main_affix_tag: mainTag,
        main_affix_value: isPctTag(mainTag) ? mainVal(mk, level) / 100 : mainVal(mk, level),
        sub_affix_id: subs.map(([t, c, s]) => {
          const val = subVal(subId[t], c, s)
          return { tag: t, value: isPctTag(t) ? val / 100 : val, cnt: c }
        })
      }
      const miaoArti = {
        main: { id: (mainId[pos] || {})[mainTag] || 0, key: mk, value: mainVal(mk, level) },
        attrs: subs.map(([t, c, s]) => ({ id: subId[t], key: miaoKeyOfTag[t], upNum: c, value: subVal(subId[t], c, s) }))
      }
      const miaoMark = ArtisMark.getMark({ charCfg: miaoCfg, idx: pos, arti: miaoArti, elem, game: 'sr', id: Number(id) })
      const ours = relicScore.scoreRelic(ourRelic, ourCfg, { elem })
      compared++
      if (Math.abs(miaoMark - ours.score) > 1e-9) {
        markFail++
        console.error('mark ' + id + ':' + v.name + ' pos' + pos + ' ' + mainTag + ' lv' + level + ' miao=' + miaoMark + ' ours=' + ours.score)
      }
    }
  }
}
console.log('MIAO_XVAL:' + JSON.stringify({ cfgFail, markFail, compared }))
process.exit(0)
`
  const scriptFile = path.join(os.tmpdir(), `sr-relic-xval-${process.pid}.mjs`)
  fs.writeFileSync(scriptFile, script, 'utf8')
  try {
    // cwd = 沙箱伪根（relicScore 的 pluginRoot 指向沙箱联接资源，与测试进程同数据源）
    const { stdout, stderr } = await promisify(execFile)(process.execPath,
      [scriptFile, MIAO_ROOT, REPO_ROOT],
      { cwd: sandbox.root, timeout: 120000, maxBuffer: 16 * 1024 * 1024 })
    const line = stdout.split(/\r?\n/).filter(l => l.startsWith('MIAO_XVAL:')).pop()
    assert.ok(line, `子进程应输出结果行；stderr=${stderr.slice(0, 500)}`)
    const result = JSON.parse(line.slice('MIAO_XVAL:'.length))
    assert.equal(result.cfgFail, 0, '全 108 角色评分配置应与 miao 一致（细节见 stderr）')
    assert.equal(result.markFail, 0, '合成遗器矩阵得分应与 miao 逐分一致（细节见 stderr）')
    assert.ok(result.compared >= 100, `矩阵对比件数 ${result.compared} 应 ≥100`)
  } finally {
    fs.rmSync(scriptFile, { force: true })
  }
})

// ---------- 接入：panel() 真实数据链 ----------

test('panel() 接入：渲染数据中的遗器带 score/weight（缓存 → scoreRelics → runtimeRender）', async () => {
  const UID = '100000002'
  // 面板缓存条目（转换器产出形状，见 utils/panel/enhanced.js 契约）
  const cacheRelics = [
    mkRelic(61011, 'HPDelta', 'hpPlus', 15, [
      ['AttackAddedRatio', 'atk', '5', 3, 2],
      ['SpeedDelta', 'speed', '7', 2, 1],
      ['CriticalChanceBase', 'cpct', '8', 1, 0],
      ['StatusResistanceBase', 'effDef', '11', 1, 0]
    ]),
    mkRelic(61013, 'CriticalDamageBase', 'cdmg', 15, [
      ['AttackAddedRatio', 'atk', '5', 3, 2],
      ['SpeedDelta', 'speed', '7', 1, 0],
      ['CriticalChanceBase', 'cpct', '8', 2, 1],
      ['StatusProbabilityBase', 'effPct', '10', 1, 0]
    ]),
    mkRelic(63015, 'WindAddedRatio', 'wind', 15, [
      ['AttackAddedRatio', 'atk', '5', 3, 2],
      ['CriticalChanceBase', 'cpct', '8', 2, 1],
      ['CriticalDamageBase', 'cdmg', '9', 2, 1],
      ['SpeedDelta', 'speed', '7', 1, 0]
    ])
  ]
  const entry = {
    avatarId: DYH, name: '丹恒', level: 80, rank: 0, damage_type: 'Wind',
    properties: { hpBase: 882, attackBase: 546.84, defenseBase: 396.9, speedBase: 110 },
    relics: cacheRelics,
    equipment: { id: 0, level: 0, rank: 1, promotion: 0, name: '', rarity: 'CombatLightConeRarity5', hp: 0, atk: 0, def: 0 },
    behaviorList: [],
    relic_sets: []
  }
  const panelDir = sandbox.pluginPath('data', 'panel')
  fs.mkdirSync(panelDir, { recursive: true })
  fs.writeFileSync(path.join(panelDir, `${UID}.json`), JSON.stringify([entry]))

  // mock 事件（e.runtime.render 捕获渲染数据；uid 直接写在命令里跳过绑定解析）
  let captured = null
  const e = {
    msg: `*丹恒面板${UID}`,
    user_id: '10001',
    message: [{ type: 'text', text: `*丹恒面板${UID}` }],
    isGroup: false, atBot: false, logFnc: '[test]',
    sender: { card: 'tester', nickname: 'tester' },
    user: { user_id: '10001' },
    runtime: {
      render: async (name, tpl, data) => {
        captured = data
        return { message_id: 'mock-msg-id' }
      }
    },
    reply: async () => true
  }
  const panel = new Panel()
  panel.e = e
  await panel.panel(e)
  assert.ok(captured, '应捕获 runtimeRender 渲染数据（未走异常分支）')
  assert.equal(captured.uid, UID)
  assert.equal(captured.avatarId, DYH)
  assert.equal(captured.relics.length, 3, '三件遗器全部进入渲染')
  // 期望值：与直接调用同一口径（avatarId + damage_type → elem）
  const expected = scoreRelics(DYH, structuredClone(cacheRelics),
    { elem: damageTypeToMiaoElem.Wind })
  captured.relics.forEach((r, i) => {
    assert.equal(typeof r.score, 'number', `渲染遗器 ${i} 应带 score`)
    closeTo(r.score, expected[i].score, 1e-9, `渲染遗器 ${i} score 与直算一致`)
    r.sub_affix_id.forEach((sub, j) => {
      assert.equal(typeof sub.weight, 'number', `渲染遗器 ${i} 副词条 ${j} 应带 weight`)
      closeTo(sub.weight, expected[i].sub_affix_id[j].weight, 1e-9, `遗器 ${i} 副词条 ${j} weight`)
    })
  })
  // 风伤球（damage_type=Wind → elem=wind）应按 dmg 权重计（同色不衰减）
  assert.ok(captured.relics[2].score > 0, '同色球得分应为正')
}, { timeout: 60000 })
