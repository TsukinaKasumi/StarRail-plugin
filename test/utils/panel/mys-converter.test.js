/**
 * 米游社星铁角色详情 → 面板缓存条目转换器 —— utils/panel/mysConverter.js
 *
 * 输入 fixture（test/fixtures/panel/mys-avatar-list.json）为合成数据，
 * 字段名对照 miao-plugin models/serv/api/MysPanelHSRData.js 的解析代码：
 *   avatar_list[].properties[{property_type, base, final}]
 *   avatar_list[].skills[{point_id, level, remake, point_type, is_activated}]
 *   avatar_list[].servant_detail.servant_skills（忆灵技能，同 skills 结构）
 *   avatar_list[].relics / ornaments[{pos, id, level, rarity,
 *     main_property{property_type}, properties[{property_type, value, times, is_preview}]}]
 *   avatar_list[].equip{id, level, rank}
 * 输出契约逐项对照 utils/panel/enhanced.js 头部的【面板缓存条目字段契约】断言。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { bootFakeRoot } from '../../helpers/boot.mjs'

// mysConverter 经 utils/path.js 读取 pluginRoot 下的 relics.json/character.json：
// 先伪根引导（资源联接只读），再动态 import
bootFakeRoot()

const { convertMysAvatarList, buildRelicSets } = await import('../../../utils/panel/mysConverter.js')
const affixData = await import('../../../utils/panel/affixData.js')

const here = path.dirname(fileURLToPath(import.meta.url))
const fixture = JSON.parse(fs.readFileSync(new URL('../../fixtures/panel/mys-avatar-list.json', import.meta.url), 'utf-8'))

const sd5 = affixData.starData['5']
/** 主词条查表重建公式（与游戏公式一致）：base + step × 强化等级 */
const mainVal = (attr, level) => sd5.main[attr][0] + sd5.main[attr][1] * level
const closeTo = (actual, expected, eps = 1e-9) =>
  assert.ok(Math.abs(actual - expected) < eps, `${actual} 应约等于 ${expected}`)

// ---------- 整体转换 ----------

test('avatar_list 整体转换：4 名合成角色，强化形态刃重映射为 2205', () => {
  const inputSnapshot = structuredClone(fixture)
  const entries = convertMysAvatarList(fixture)
  assert.deepEqual(fixture, inputSnapshot, '转换不得修改入参')
  assert.deepEqual(entries.map(e => e.avatarId), [1104, 1501, 1402, 2205])
  // 缓存条目顶层契约键（顺序即转换器产出顺序）
  assert.deepEqual(
    Object.keys(entries[0]),
    ['avatarId', 'name', 'level', 'rank', 'damage_type', 'properties', 'relics', 'equipment', 'behaviorList', 'relic_sets']
  )
})

// ---------- 普通角色：杰帕德（完整数据） ----------

let gepard
test('普通角色（杰帕德）：顶层契约 avatarId/name/level/rank/damage_type', () => {
  const entries = convertMysAvatarList(fixture)
  gepard = entries.find(e => e.avatarId === 1104)
  assert.equal(gepard.name, '杰帕德')
  assert.equal(gepard.level, 80)
  assert.equal(gepard.rank, 2)
  assert.equal(gepard.damage_type, 'Ice', 'element 中文「冰」应映射为 Ice 枚举')
})

test('properties 契约：引擎 4 基础键 + 模板展示键 + 7 属性伤害键，base/final 口径正确', () => {
  const p = gepard.properties
  assert.deepEqual(Object.keys(p).sort(), [
    'hpBase', 'attackBase', 'defenseBase', 'speedBase',
    'hpDelta', 'attackDelta', 'defenseDelta', 'speedAdd',
    'criticalChance', 'criticalDamage', 'statusResistance', 'statusProbability',
    'breakDamageAdded', 'spRatio', 'healRatio',
    'physicalAdded', 'fireAdded', 'iceAdded', 'thunderAdded',
    'windAdded', 'quantumAdded', 'imaginaryAdded'
  ].sort())
  // 引擎基础键 = properties[].base（含光锥白值，不含遗器/行迹/套装）
  assert.equal(p.hpBase, 1122.5)
  assert.equal(p.attackBase, 623.25)
  assert.equal(p.defenseBase, 703.75)
  assert.equal(p.speedBase, 101)
  // 展示增量 = final - base（手算）
  assert.equal(p.hpDelta, 2142)
  assert.equal(p.attackDelta, 1075)
  assert.equal(p.defenseDelta, 1205)
  assert.equal(p.speedAdd, 11.5)
  // 终值键直接取 final；spRatio 为超出 100% 的部分（1.25 - 1）
  assert.equal(p.criticalChance, 0.3215)
  assert.equal(p.criticalDamage, 0.647)
  assert.equal(p.statusResistance, 0.204)
  assert.equal(p.statusProbability, 0.1335)
  assert.equal(p.breakDamageAdded, 0.5364)
  assert.equal(p.spRatio, 0.25)
  assert.equal(p.healRatio, 0)
  // 7 个属性伤害键全量填充，模板按角色自身属性取键（冰角色 → iceAdded）
  assert.equal(p.iceAdded, 0.2264)
  for (const k of ['physicalAdded', 'fireAdded', 'thunderAdded', 'windAdded', 'quantumAdded', 'imaginaryAdded']) {
    assert.equal(p[k], 0, `${k} 应为 0`)
  }
})

test('relics 契约：cavern(relics) 与 planar(ornaments) 合并，主词条查表重建 + 副词条 value 解析', () => {
  const relics = gepard.relics
  assert.equal(relics.length, 6, 'relics(4) + ornaments(2) 应合并')

  const [head, hand, body, feet, sphere, rope] = relics
  // 头部：主词条 property_type 27 → HPDelta（主词条位第二套编号），+15 级查表
  assert.deepEqual(
    { id: head.id, level: head.level, name: head.name, max_level: head.max_level },
    { id: 61011, level: 15, name: '过客的逢春木簪', max_level: 15 },
    '遗器静态字段应来自本插件 relics.json'
  )
  assert.equal(head.main_affix_tag, 'HPDelta')
  assert.equal(head.main_affix_name, '生命值')
  closeTo(head.main_affix_value, 705.6, 1e-9) // 手算：112.896 + 39.5136×15 = 705.6
  assert.deepEqual(head.sub_affix_id, [
    { tag: 'CriticalChanceBase', name: '暴击率', value: 0.03888, cnt: 3 }, // '3.888%' → 0.03888
    { tag: 'HPDelta', name: '生命值', value: 112.32, cnt: 2 }, // 平砍值字符串
    { tag: 'SpeedDelta', name: '速度', value: 2.3, cnt: 2 },
    { tag: 'HPAddedRatio', name: '生命值', value: 0.0432, cnt: 2 } // property_type 32 → 生命百分比
  ])
  assert.ok(!head.sub_affix_id.some(s => s.tag === 'SPRatioBase'), 'is_preview 预览词条应被过滤')

  // 手部：property_type 29 → AttackDelta
  closeTo(hand.main_affix_value, mainVal('atkPlus', 15))
  assert.equal(hand.main_affix_tag, 'AttackDelta')
  assert.deepEqual(hand.sub_affix_id, [
    { tag: 'AttackAddedRatio', name: '攻击力', value: 0.0864, cnt: 1 } // property_type 33 → 攻击百分比
  ])

  // 躯干：property_type 52 → 暴击率主词条（15 级手算锚点）
  assert.equal(body.main_affix_tag, 'CriticalChanceBase')
  closeTo(body.main_affix_value, 0.324) // 手算：5.184% + 1.8144%×15 = 32.4% → 0.324
  assert.deepEqual(body.sub_affix_id, [
    { tag: 'CriticalDamageBase', name: '暴击伤害', value: 12.96 / 100, cnt: 4 }, // '12.96%' → /100
    { tag: 'BreakDamageAddedRatioBase', name: '击破特攻', value: 0.0518, cnt: 2 } // property_type 58
  ])

  // 脚部：property_type 51 → 速度主词条
  assert.equal(feet.main_affix_tag, 'SpeedDelta')
  closeTo(feet.main_affix_value, 25.032) // 手算：4.032 + 1.4×15 = 25.032
  assert.deepEqual(feet.sub_affix_id, [
    { tag: 'StatusProbabilityBase', name: '效果命中', value: 0.01728, cnt: 1 }
  ])

  // 位面球（ornaments）：property_type 16 → 冰伤主词条
  assert.equal(sphere.id, 63015)
  assert.equal(sphere.main_affix_tag, 'IceAddedRatio')
  assert.equal(sphere.main_affix_value, mainVal('ice', 15) / 100)
  assert.deepEqual(sphere.sub_affix_id, [
    { tag: 'CriticalChanceBase', name: '暴击率', value: 0.03456, cnt: 2 }
  ])

  // 连接绳：property_type 54 → 能量回复，12 级
  assert.equal(rope.level, 12)
  assert.equal(rope.main_affix_tag, 'SPRatioBase')
  assert.equal(rope.main_affix_value, mainVal('recharge', 12) / 100)
  assert.deepEqual(rope.sub_affix_id, [
    { tag: 'AttackDelta', name: '攻击力', value: 33.87, cnt: 3 }
  ])
})

test('relic_sets 契约：4 件套优先于 2 件套，按 set_id 排序', () => {
  assert.deepEqual(gepard.relic_sets, [
    { set_id: '101', set_name: '4件套' },
    { set_id: '301', set_name: '2件套' }
  ])
  // buildRelicSets 可独立复用：同套装 2 件成套，跨套装单件不成套
  assert.deepEqual(buildRelicSets([{ id: 61011 }, { id: 61012 }]), [
    { set_id: '101', set_name: '2件套' }
  ])
  assert.deepEqual(buildRelicSets([{ id: 61011 }, { id: 63015 }]), [])
})

test('equipment 契约：id/rank 透传，缺省字段降级', () => {
  assert.deepEqual(gepard.equipment, {
    id: 23013,
    level: 70,
    rank: 3,
    promotion: 5, // 70 级落在 60-70 突破段
    name: '光锥23013', // mys equip 未返回 name → 降级命名
    rarity: 'CombatLightConeRarity5', // 23xxx → 5 星光锥
    hp: 0, atk: 0, def: 0
  })
})

test('behaviorList 契约：前 5 项 = 普攻/战技/终结技/天赋/秘技，缺失槽位占位，行迹按 id 排序', () => {
  const bl = gepard.behaviorList
  assert.equal(bl.length, 9, '5 主技能 + 4 行迹节点')
  // 前 5 项固定槽位（id = avatarId×1000+槽位：001/002/003/004/007）
  assert.deepEqual(bl.slice(0, 5), [
    { id: 1104001, level: 6, type: '普攻', anchor: 'Point01', icon: 'icon/skill/1104_basic_atk.png', max_level: 6 },
    { id: 1104002, level: 10, type: '战技', anchor: 'Point02', icon: 'icon/skill/1104_skill.png', max_level: 10 },
    { id: 1104003, level: 10, type: '终结技', anchor: 'Point03', icon: 'icon/skill/1104_ultimate.png', max_level: 10 },
    { id: 1104004, level: 10, type: '天赋', anchor: 'Point04', icon: 'icon/skill/1104_talent.png', max_level: 10 },
    // mys skills 缺秘技 → 1 级占位保持索引稳定
    { id: 1104007, level: 1, type: '秘技', anchor: 'Point05', icon: 'icon/skill/1104_technique.png', max_level: 1 }
  ])
  // 行迹节点：能力节点(101)带图标，属性小节点(201-210)查 skillTreeStats 属性表补图标；未激活 level=0
  assert.deepEqual(bl.slice(5), [
    { id: 1104101, level: 1, type: '行迹', anchor: 'Point06', icon: 'icon/skill/1104_skilltree1.png', max_level: 1 },
    { id: 1104201, level: 1, type: '行迹', anchor: 'Point09', icon: 'icon/skill/tree-ice.webp', max_level: 1 },
    { id: 1104202, level: 0, type: '行迹', anchor: 'Point10', icon: 'icon/skill/tree-effDef.webp', max_level: 1 },
    { id: 1104203, level: 0, type: '行迹', anchor: 'Point11', icon: 'icon/skill/tree-ice.webp', max_level: 1 }
  ])
})

// ---------- 欢愉角色：火花（xe 槽位 + 全面降级） ----------

test('欢愉角色（火花）：欢愉技 420 槽位；缺 name/element/properties/relics/equip 全部降级', () => {
  const [gepardEntry, sparkle] = convertMysAvatarList(fixture)
  assert.ok(gepardEntry && sparkle)
  assert.equal(sparkle.avatarId, 1501)
  assert.equal(sparkle.name, '火花', '缺 name → 本插件 character.json 兜底')
  assert.equal(sparkle.damage_type, 'Fire', '缺 element → character.json 元素「火」→ Fire')
  assert.equal(sparkle.level, 80)
  assert.equal(sparkle.rank, 0)
  // properties 全零降级
  for (const v of Object.values(sparkle.properties)) assert.equal(v, 0)
  assert.deepEqual(sparkle.relics, [])
  assert.deepEqual(sparkle.relic_sets, [])
  // 无光锥 → 默认 equipment
  assert.deepEqual(sparkle.equipment, {
    id: 0, level: 0, rank: 1, promotion: 0,
    name: '', rarity: 'CombatLightConeRarity5', hp: 0, atk: 0, def: 0
  })
  const bl = sparkle.behaviorList
  assert.equal(bl.length, 6, '5 主技能 + 1 欢愉技')
  // 无 remake 的主技能按 point_type=2 + 末三位槽位识别
  assert.deepEqual(bl.slice(0, 5).map(s => [s.id, s.level, s.type]), [
    [1501001, 1, '普攻'], [1501002, 9, '战技'], [1501003, 9, '终结技'],
    [1501004, 9, '天赋'], [1501007, 1, '秘技']
  ])
  // 欢愉技：point_id 1501420（avatarId×1000+420），type 取 remake 同名展示名
  assert.deepEqual(bl[5], {
    id: 1501420, level: 12, type: '欢愉技', anchor: 'Point19',
    icon: 'icon/skill/1501_elation.png', max_level: 10
  })
})

// ---------- 记忆角色：阿格莱雅（servant_detail 忆灵技能） ----------

test('记忆角色（阿格莱雅）：servant_skills 的忆灵技/忆灵天赋 → 301/302 扩展槽位', () => {
  const entries = convertMysAvatarList(fixture)
  const aglaea = entries.find(e => e.avatarId === 1402)
  assert.equal(aglaea.damage_type, 'Thunder')
  // base/final 口径：速度 final=base → speedAdd=0
  assert.equal(aglaea.properties.hpBase, 900.5)
  assert.equal(aglaea.properties.hpDelta, 300)
  assert.equal(aglaea.properties.speedAdd, 0)
  // 4 星光锥 21000 → CombatLightConeRarity4，60 级 → 突破 4
  assert.equal(aglaea.equipment.rarity, 'CombatLightConeRarity4')
  assert.equal(aglaea.equipment.promotion, 4)
  const bl = aglaea.behaviorList
  assert.equal(bl.length, 7, '5 主技能 + 忆灵技 301 + 忆灵天赋 302')
  assert.deepEqual(bl.slice(0, 5).map(s => [s.id, s.level, s.type]), [
    [1402001, 1, '普攻'], [1402002, 6, '战技'], [1402003, 10, '终结技'],
    [1402004, 6, '天赋'], [1402007, 1, '秘技']
  ])
  // mys 原始 point_id 为 8 位（fixture 14020301/14020302），转换器规范化为 avatarId×1000+槽位
  assert.deepEqual(bl[5], {
    id: 1402301, level: 10, type: '忆灵技', anchor: 'Point19',
    icon: 'icon/skill/1402_memosprite_skill.png', max_level: 6
  })
  assert.deepEqual(bl[6], {
    id: 1402302, level: 10, type: '忆灵天赋', anchor: 'Point20',
    icon: 'icon/skill/1402_memosprite_talent.png', max_level: 6
  })
})

// ---------- 强化形态：刃 ----------

test('强化形态（刃）：11205xxx 前缀 → avatarId 2205 / 刃Pro / point_id 前缀重写', () => {
  const entries = convertMysAvatarList(fixture)
  const blade = entries.find(e => e.avatarId === 2205)
  assert.ok(blade, '转换输出应为重映射后的 2205')
  assert.equal(blade.name, '刃Pro')
  assert.equal(blade.damage_type, 'Wind', '元素不随强化形态改变')
  assert.equal(blade.rank, 1)
  const bl = blade.behaviorList
  assert.equal(bl.length, 8, '5 主技能 + 3 行迹')
  assert.deepEqual(bl.map(s => s.id), [
    2205001, 2205002, 2205003, 2205004, 2205007, // 主技能 '1'+1205 前缀 → 2205 前缀
    2205101, 2205201, 2205202 // 行迹节点前缀同样重写（未激活 2205202 保留）
  ])
  assert.deepEqual(bl.map(s => s.level), [6, 9, 9, 9, 1, 1, 1, 0])
  // 0 级遗器主词条 = base（无步进）
  assert.equal(blade.relics.length, 2)
  closeTo(blade.relics[0].main_affix_value, sd5.main.hpPlus[0], 1e-12)
  closeTo(blade.relics[1].main_affix_value, sd5.main.atkPlus[0], 1e-12)
  assert.deepEqual(blade.relic_sets, [{ set_id: '101', set_name: '2件套' }])
})

// ---------- 边界与降级 ----------

test('边界：空 avatar_list 与缺 id 条目', () => {
  assert.deepEqual(convertMysAvatarList(null), [])
  assert.deepEqual(convertMysAvatarList(undefined), [])
  assert.deepEqual(convertMysAvatarList([]), [])
  assert.deepEqual(convertMysAvatarList([null, {}, { level: 80 }, { id: null }]), [], '无 id 条目应被过滤')
})

test('降级：仅 id 的角色 → character.json 兜底 + 全占位 behaviorList', () => {
  const [entry] = convertMysAvatarList([{ id: 1220 }])
  assert.equal(entry.name, '飞霄')
  assert.equal(entry.damage_type, 'Wind')
  assert.equal(entry.level, 1, '缺 level 降级为 1')
  assert.deepEqual(entry.behaviorList.map(s => [s.id, s.level]), [
    [1220001, 1], [1220002, 1], [1220003, 1], [1220004, 1], [1220007, 1]
  ])
  assert.deepEqual(entry.relics, [])
  assert.deepEqual(entry.relic_sets, [])
})

test('降级：未收录遗器 ID → 稀有度按首位推导、遗器名/set_id 兜底；缺 pos 的遗器被丢弃', () => {
  const [entry] = convertMysAvatarList([{
    id: 1220,
    relics: [
      { pos: 1, id: 69999, level: 15, main_property: { property_type: 27 }, properties: [] },
      { id: 69998, level: 15, main_property: { property_type: 27 }, properties: [] } // 缺 pos
    ]
  }])
  assert.equal(entry.relics.length, 1, '缺 pos 的遗器应被过滤')
  const relic = entry.relics[0]
  assert.equal(relic.name, '遗器69999')
  assert.equal(relic.max_level, 15, '6xxxx → 5 星 → max_level 15')
  assert.equal(relic.main_affix_tag, 'HPDelta')
  closeTo(relic.main_affix_value, 705.6)
  assert.deepEqual(entry.relic_sets, [], '单件不成套（set_id 兜底 999 也无 2 件）')
})

// ---------- 对照真实 miao meta（快照漂移守卫，条件跳过） ----------

const miaoMetaPath = path.resolve(here, '../../../..', 'miao-plugin', 'resources', 'meta-sr', 'artifact', 'meta.json')

test('affixData.starData/mainIdx 与 miao-plugin artifact meta.json 一致（快照漂移守卫）', { skip: !fs.existsSync(miaoMetaPath) }, () => {
  const miaoMeta = JSON.parse(fs.readFileSync(miaoMetaPath, 'utf8'))
  assert.deepEqual(affixData.mainIdx, miaoMeta.mainIdx, 'mainIdx 应为 miao metaData 快照')
  for (const rarity of ['2', '3', '4', '5']) {
    const miaoStar = miaoMeta.starData[rarity]
    const ours = affixData.starData[rarity]
    assert.deepEqual(Object.keys(ours.main).sort(), Object.keys(miaoStar.main).sort(), `main 键集一致（${rarity} 星）`)
    for (const attr of Object.keys(miaoStar.main)) {
      const { base, step } = miaoStar.main[attr]
      assert.deepEqual(ours.main[attr], [base, step], `${rarity} 星主词条 ${attr}`)
    }
    assert.deepEqual(Object.keys(ours.sub).sort(), Object.keys(miaoStar.sub).sort(), `sub 键集一致（${rarity} 星）`)
    for (const subId of Object.keys(miaoStar.sub)) {
      const { key, base, step } = miaoStar.sub[subId]
      assert.deepEqual(ours.sub[subId], [key, base, step], `${rarity} 星副词条 ${subId}`)
    }
  }
})

// ---------- 属性小节点图标（skillTreeStats.json + statNodeIcon） ----------

test('statNodeIcon：槽位 201-210 按角色查属性图标，非属性槽位与未收录角色返回空串', () => {
  assert.equal(affixData.statNodeIcon(1204, 201), 'icon/skill/tree-atk.webp', '景元 201=攻击')
  assert.equal(affixData.statNodeIcon(1204, 202), 'icon/skill/tree-cpct.webp', '景元 202=暴击率')
  assert.equal(affixData.statNodeIcon(1513, 204), 'icon/skill/tree-joy.webp', '砂金•戏浪 204=欢愉')
  assert.equal(affixData.statNodeIcon(2205, 201), 'icon/skill/tree-hp.webp', '刃Pro 2205 表直查')
  assert.equal(affixData.statNodeIcon(1204, 1), '', '主技能槽位非属性节点')
  assert.equal(affixData.statNodeIcon(1204, 101), '', '能力节点槽位非属性节点')
  assert.equal(affixData.statNodeIcon(1204, 211), '', '槽位越界')
  assert.equal(affixData.statNodeIcon(9999, 201), '', '未收录角色')
})

test('skillTreeStats 数据一致性：每角色 201-210 全槽位，引用的属性图标文件全部存在', () => {
  const stats = JSON.parse(fs.readFileSync(
    path.resolve(here, '../../../resources/panel/data/skillTreeStats.json'), 'utf8'))
  assert.ok(Object.keys(stats).length >= 100, `角色覆盖应 >=100（现 ${Object.keys(stats).length}）`)
  const skillDir = path.resolve(here, '../../../resources/panel/resources/skill')
  const have = new Set(fs.readdirSync(skillDir))
  for (const [avatarId, slots] of Object.entries(stats)) {
    for (const slot of ['201', '202', '203', '204', '205', '206', '207', '208', '209', '210']) {
      assert.ok(slots[slot], `${avatarId} 缺槽位 ${slot}`)
      assert.ok(have.has(`tree-${slots[slot]}.webp`),
        `${avatarId} 槽位 ${slot} 属性 ${slots[slot]} 缺图标文件`)
    }
  }
})
