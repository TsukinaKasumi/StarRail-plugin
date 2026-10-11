/**
 * 面板词条静态数据表（米游社直连 / miao 数据同步 两个转换器的共享底表）
 *
 * 数值表来源说明（数据快照，非运行时依赖 miao-plugin，未装 miao 也可工作）：
 * - starData / mainIdx 数值取自 miao-plugin resources/meta-sr/artifact/meta.json
 *   的 metaData（starData/mainIdx），为游戏遗器词条的基础值/步进表：
 *   主词条值 = base + step × 强化等级；副词条值 = count × base + steps × step。
 * - property_type 数字 -> 属性键映射参照 miao-plugin MysPanelHSRMappings.js 的
 *   propertyType2attrName 数字表，改写为本插件伤害引擎/模板消费的属性键
 *   （完整字段契约见 utils/panel/enhanced.js 头部注释）。
 * 词条基础数值为版本稳定的游戏配置，新稀有度出现时需同步更新本表。
 */

import fs from 'fs'
import { pluginRoot } from '../path.js'

// 米游社 property_type 数字 -> 词条属性
// tag：引擎属性键（relics main_affix_tag / sub_affix_id[].tag）
// name：面板展示名；percent：true 时值为小数（0.052），false 为平砍值（33.87）
export const propertyTypeToAffix = {
  1: { tag: 'HPDelta', name: '生命值', percent: false },
  2: { tag: 'AttackDelta', name: '攻击力', percent: false },
  3: { tag: 'DefenceDelta', name: '防御力', percent: false },
  4: { tag: 'SpeedDelta', name: '速度', percent: false },
  5: { tag: 'CriticalChanceBase', name: '暴击率', percent: true },
  6: { tag: 'CriticalDamageBase', name: '暴击伤害', percent: true },
  7: { tag: 'HealRatioBase', name: '治疗量加成', percent: true },
  9: { tag: 'SPRatioBase', name: '能量恢复效率', percent: true },
  10: { tag: 'StatusProbabilityBase', name: '效果命中', percent: true },
  11: { tag: 'StatusResistanceBase', name: '效果抵抗', percent: true },
  12: { tag: 'PhysicalAddedRatio', name: '物理属性伤害提高', percent: true },
  14: { tag: 'FireAddedRatio', name: '火属性伤害提高', percent: true },
  16: { tag: 'IceAddedRatio', name: '冰属性伤害提高', percent: true },
  18: { tag: 'ThunderAddedRatio', name: '雷属性伤害提高', percent: true },
  20: { tag: 'WindAddedRatio', name: '风属性伤害提高', percent: true },
  22: { tag: 'QuantumAddedRatio', name: '量子属性伤害提高', percent: true },
  24: { tag: 'ImaginaryAddedRatio', name: '虚数属性伤害提高', percent: true },
  // 27/29/31 与 51-59：主词条位专用的第二套编号（同名属性）
  27: { tag: 'HPDelta', name: '生命值', percent: false },
  29: { tag: 'AttackDelta', name: '攻击力', percent: false },
  31: { tag: 'DefenceDelta', name: '防御力', percent: false },
  32: { tag: 'HPAddedRatio', name: '生命值', percent: true },
  33: { tag: 'AttackAddedRatio', name: '攻击力', percent: true },
  34: { tag: 'DefenceAddedRatio', name: '防御力', percent: true },
  51: { tag: 'SpeedDelta', name: '速度', percent: false },
  52: { tag: 'CriticalChanceBase', name: '暴击率', percent: true },
  53: { tag: 'CriticalDamageBase', name: '暴击伤害', percent: true },
  54: { tag: 'SPRatioBase', name: '能量恢复效率', percent: true },
  55: { tag: 'HealRatioBase', name: '治疗量加成', percent: true },
  56: { tag: 'StatusProbabilityBase', name: '效果命中', percent: true },
  57: { tag: 'StatusResistanceBase', name: '效果抵抗', percent: true },
  58: { tag: 'BreakDamageAddedRatioBase', name: '击破特攻', percent: true },
  59: { tag: 'BreakDamageAddedRatioBase', name: '击破特攻', percent: true }
}

// 米游社 property_type -> miao 词条属性名（starData.main 键，主词条数值查表用）
export const propertyTypeToMiaoAttr = {
  1: 'hpPlus', 2: 'atkPlus', 3: 'defPlus', 4: 'speed',
  5: 'cpct', 6: 'cdmg', 7: 'heal', 9: 'recharge',
  10: 'effPct', 11: 'effDef',
  12: 'phy', 14: 'fire', 16: 'ice', 18: 'elec', 20: 'wind',
  22: 'quantum', 24: 'imaginary',
  27: 'hpPlus', 29: 'atkPlus', 31: 'defPlus',
  32: 'hp', 33: 'atk', 34: 'def',
  51: 'speed', 52: 'cpct', 53: 'cdmg', 54: 'recharge', 55: 'heal',
  56: 'effPct', 57: 'effDef', 58: 'stance', 59: 'stance'
}

// miao 词条属性名 -> 本插件词条（tag/name/percent 语义同上，miao 数据转换用）
export const miaoAttrToAffix = {
  hpPlus: { tag: 'HPDelta', name: '生命值', percent: false },
  atkPlus: { tag: 'AttackDelta', name: '攻击力', percent: false },
  defPlus: { tag: 'DefenceDelta', name: '防御力', percent: false },
  speed: { tag: 'SpeedDelta', name: '速度', percent: false },
  cpct: { tag: 'CriticalChanceBase', name: '暴击率', percent: true },
  cdmg: { tag: 'CriticalDamageBase', name: '暴击伤害', percent: true },
  heal: { tag: 'HealRatioBase', name: '治疗量加成', percent: true },
  recharge: { tag: 'SPRatioBase', name: '能量恢复效率', percent: true },
  effPct: { tag: 'StatusProbabilityBase', name: '效果命中', percent: true },
  effDef: { tag: 'StatusResistanceBase', name: '效果抵抗', percent: true },
  stance: { tag: 'BreakDamageAddedRatioBase', name: '击破特攻', percent: true },
  phy: { tag: 'PhysicalAddedRatio', name: '物理属性伤害提高', percent: true },
  fire: { tag: 'FireAddedRatio', name: '火属性伤害提高', percent: true },
  ice: { tag: 'IceAddedRatio', name: '冰属性伤害提高', percent: true },
  elec: { tag: 'ThunderAddedRatio', name: '雷属性伤害提高', percent: true },
  wind: { tag: 'WindAddedRatio', name: '风属性伤害提高', percent: true },
  quantum: { tag: 'QuantumAddedRatio', name: '量子属性伤害提高', percent: true },
  imaginary: { tag: 'ImaginaryAddedRatio', name: '虚数属性伤害提高', percent: true },
  hp: { tag: 'HPAddedRatio', name: '生命值', percent: true },
  atk: { tag: 'AttackAddedRatio', name: '攻击力', percent: true },
  def: { tag: 'DefenceAddedRatio', name: '防御力', percent: true }
}

// 遗器部位 -> 主词条编号 -> miao 属性名（miao artis 数据 mainId 反查用）
export const mainIdx = {"1":{"1":"hpPlus"},"2":{"1":"atkPlus"},"3":{"1":"hp","2":"atk","3":"def","4":"cpct","5":"cdmg","6":"heal","7":"effPct"},"4":{"1":"hp","2":"atk","3":"def","4":"speed"},"5":{"1":"hp","2":"atk","3":"def","4":"phy","5":"fire","6":"ice","7":"elec","8":"wind","9":"quantum","10":"imaginary"},"6":{"1":"stance","2":"recharge","3":"hp","4":"atk","5":"def"}}

// 各稀有度主/副词条基础值与步进（starData[rarity].main[attr] = [base, step]，
// starData[rarity].sub[id] = [miao属性名, base, step]）
export const starData = {"2":{"main":{"hpPlus":[45.1584,15.80544],"atkPlus":[22.5792,7.90272],"hp":[2.7647999999999997,0.9677],"atk":[2.7647999999999997,0.9677],"def":[3.4560002,1.2096001],"cpct":[2.0736001,0.7258],"cdmg":[4.1472,1.4515],"heal":[2.2117999999999998,0.77410005],"effPct":[2.7647999999999997,0.9677],"speed":[1.6128,1],"phy":[2.4882999999999997,0.8709],"fire":[2.4882999999999997,0.8709],"ice":[2.4882999999999997,0.8709],"elec":[2.4882999999999997,0.8709],"wind":[2.4882999999999997,0.8709],"quantum":[2.4882999999999997,0.8709],"imaginary":[2.4882999999999997,0.8709],"stance":[4.1472,1.4515],"recharge":[1.2442,0.43550003]},"sub":{"1":["hpPlus",13.548016,1.693502],"2":["atkPlus",6.774008,0.846751],"3":["defPlus",6.774008,0.846751],"4":["hp",1.3824001000000001,0.17280006],"5":["atk",1.3824001000000001,0.17280006],"6":["def",1.7280001,0.21600004],"7":["speed",1,0.1],"8":["cpct",1.0368001,0.12960007999999998],"9":["cdmg",2.0736001,0.25920009],"10":["effPct",1.3824001000000001,0.17280006],"11":["effDef",1.3824001000000001,0.17280006],"12":["stance",2.0736001,0.25920009]}},"3":{"main":{"hpPlus":[67.7376,23.70816],"atkPlus":[33.8688,11.85408],"hp":[4.1472,1.4515],"atk":[4.1472,1.4515],"def":[5.183999999999999,1.8144],"cpct":[3.1104,1.0886000999999998],"cdmg":[6.2208,2.1773001],"heal":[3.3178,1.1612],"effPct":[4.1472,1.4515],"speed":[2.4192,1],"phy":[3.7325,1.3064001],"fire":[3.7325,1.3064001],"ice":[3.7325,1.3064001],"elec":[3.7325,1.3064001],"wind":[3.7325,1.3064001],"quantum":[3.7325,1.3064001],"imaginary":[3.7325,1.3064001],"stance":[6.2208,2.1773001],"recharge":[1.8662,0.65320004]},"sub":{"1":["hpPlus",20.322023,2.540253],"2":["atkPlus",10.161012,1.270126],"3":["defPlus",10.161012,1.270126],"4":["hp",2.0736001,0.25920009],"5":["atk",2.0736001,0.25920009],"6":["def",2.5919999999999996,0.32400002],"7":["speed",1.2,0.1],"8":["cpct",1.5552,0.19440008],"9":["cdmg",3.1104,0.3888001],"10":["effPct",2.0736001,0.25920009],"11":["effDef",2.0736001,0.25920009],"12":["stance",3.1104,0.3888001]}},"4":{"main":{"hpPlus":[90.3168,31.61088],"atkPlus":[45.1584,15.80544],"hp":[5.529599999999999,1.9354],"atk":[5.529599999999999,1.9354],"def":[6.912,2.4192],"cpct":[4.1472,1.4515],"cdmg":[8.2944,2.9029999],"heal":[4.4237,1.5483],"effPct":[5.529599999999999,1.9354],"speed":[3.2256,1.1],"phy":[4.9765999999999995,1.7418],"fire":[4.9765999999999995,1.7418],"ice":[4.9765999999999995,1.7418],"elec":[4.9765999999999995,1.7418],"wind":[4.9765999999999995,1.7418],"quantum":[4.9765999999999995,1.7418],"imaginary":[4.9765999999999995,1.7418],"stance":[8.2944,2.9029999],"recharge":[2.4882999999999997,0.8709]},"sub":{"1":["hpPlus",27.096031,3.387004],"2":["atkPlus",13.548016,1.693502],"3":["defPlus",13.548016,1.693502],"4":["hp",2.7647999999999997,0.34560005],"5":["atk",2.7647999999999997,0.34560005],"6":["def",3.4560002,0.43200003],"7":["speed",1.6,0.2],"8":["cpct",2.0736001,0.25920009],"9":["cdmg",4.1472,0.5184000400000001],"10":["effPct",2.7647999999999997,0.34560005],"11":["effDef",2.7647999999999997,0.34560005],"12":["stance",4.1472,0.5184000400000001]}},"5":{"main":{"hpPlus":[112.896,39.5136],"atkPlus":[56.448,19.7568],"hp":[6.912,2.4192],"atk":[6.912,2.4192],"def":[8.64,3.0240001],"cpct":[5.183999999999999,1.8144],"cdmg":[10.367999999999999,3.6288],"heal":[5.529599999999999,1.9354],"effPct":[6.912,2.4192],"speed":[4.032,1.4],"phy":[6.2208,2.1773001],"fire":[6.2208,2.1773001],"ice":[6.2208,2.1773001],"elec":[6.2208,2.1773001],"wind":[6.2208,2.1773001],"quantum":[6.2208,2.1773001],"imaginary":[6.2208,2.1773001],"stance":[10.367999999999999,3.6288],"recharge":[3.1104,1.0886000999999998]},"sub":{"1":["hpPlus",33.87004,4.233755],"2":["atkPlus",16.935019,2.116877],"3":["defPlus",16.935019,2.116877],"4":["hp",3.4560002,0.43200003],"5":["atk",3.4560002,0.43200003],"6":["def",4.32,0.54],"7":["speed",2,0.3],"8":["cpct",2.5919999999999996,0.32400002],"9":["cdmg",5.183999999999999,0.64800004],"10":["effPct",3.4560002,0.43200003],"11":["effDef",3.4560002,0.43200003],"12":["stance",5.183999999999999,0.64800004]}}}

// 中文元素 -> damage_type 英文枚举（模板元素图标 common/element/*.png）
export const elemToDamageType = {
  火: 'Fire', 冰: 'Ice', 雷: 'Thunder', 量子: 'Quantum',
  风: 'Wind', 虚数: 'Imaginary', 物理: 'Physical'
}

// damage_type -> 面板属性行展示键（properties[damage_type.toLowerCase() + 'Added']）
export const damageTypeToAddedKey = {
  Fire: 'fireAdded', Ice: 'iceAdded', Thunder: 'thunderAdded',
  Quantum: 'quantumAdded', Wind: 'windAdded',
  Imaginary: 'imaginaryAdded', Physical: 'physicalAdded'
}

// 行迹 point_id 槽位（末三位）-> 行迹画布锚点（Point01-18）
// 槽位规律（与 utils/damage/json/character.json 行迹节点键一致）：
// 001-004 = 普攻/战技/终结技/天赋升级节点，007 = 秘技节点（Point01-05），
// 101-103 = 能力节点（Point06-08），201-210 = 属性小节点（Point09-18）
export const anchorBySlot = {
  1: 'Point01', 2: 'Point02', 3: 'Point03', 4: 'Point04', 7: 'Point05',
  101: 'Point06', 102: 'Point07', 103: 'Point08',
  201: 'Point09', 202: 'Point10', 203: 'Point11', 204: 'Point12',
  205: 'Point13', 206: 'Point14', 207: 'Point15', 208: 'Point16',
  209: 'Point17', 210: 'Point18'
}

// 主技能槽位 -> behaviorList type 展示名（米游社 remake 字段同名）
export const mainSlotType = { 1: '普攻', 2: '战技', 3: '终结技', 4: '天赋', 7: '秘技' }

// 主技能槽位 -> 技能图标名后缀（resources/panel/resources/skill/{avatarId}_{name}.png）
export const mainSlotIcon = {
  1: 'basic_atk', 2: 'skill', 3: 'ultimate', 4: 'talent', 7: 'technique'
}

// 主技能槽位 -> 面板展示的最大等级（与 char_dict 行迹节点 max_level 一致）
export const mainSlotMaxLevel = { 1: 6, 2: 10, 3: 10, 4: 10, 7: 1 }

// 扩展技能槽位 -> behaviorList type 展示名（301/302 忆灵、420/421 欢愉）
export const extraSlotType = {
  301: '忆灵技', 302: '忆灵天赋', 420: '欢愉技', 421: '强化欢愉技'
}

// 扩展技能槽位 -> 技能图标名后缀（StarRailRes 命名：忆灵技=_memosprite_skill、
// 忆灵天赋=_memosprite_talent、欢愉技=_elation；xe2 强化欢愉技无独立资源，复用 _elation）
export const extraSlotIcon = {
  301: 'memosprite_skill', 302: 'memosprite_talent', 420: 'elation', 421: 'elation'
}

// 属性小节点（槽位 201-210）的游戏数据 icon 为空串，需按 角色+槽位 查属性 key
// 再映射到本地属性图标（resources/panel/resources/skill/tree-{key}.webp，
// key 集：atk/atkPct/hp/hpPct/def/defPct/cpct/cdmg/speed/stance/effDef/effPct/
// 七元素伤害/joy）。映射表快照自 miao-plugin meta-sr character/{角色}/data.json
// 的 tree 字段（数值快照，非运行时依赖 miao-plugin），由 tools 同步提取。
const skillTreeStats = JSON.parse(
  fs.readFileSync(`${pluginRoot}/resources/panel/data/skillTreeStats.json`, 'utf8')
)

/** 槽位 201-210 的属性小节点 -> 属性图标路径；非属性槽位或未收录角色返回 '' */
export function statNodeIcon (avatarId, slot) {
  if (slot < 201 || slot > 210) return ''
  const id = String(avatarId)
  const table = skillTreeStats[id] ||
    (id.startsWith('2') ? skillTreeStats[id.replace(/^2/, '1')] : null)
  const key = table?.[slot]
  return key ? `icon/skill/tree-${key}.webp` : ''
}

// 光锥 ID -> 稀有度（HSR 编号规律：20xxx=3星，21xxx/22xxx=4星，23xxx+=5星）
export function weaponRarityById (id) {
  const n = Number(id)
  if (!Number.isFinite(n)) return 5
  if (n < 21000) return 3
  if (n < 23000) return 4
  return 5
}

// 遗器 ID -> 稀有度（HSR 编号规律：3xxxx=2星、4xxxx=3星、5xxxx=4星、6xxxx=5星，
// 本插件 relics.json 未收录的新遗器兜底用，与已收录 454 条全量核对一致）
export function relicRarityById (id) {
  const first = Number(String(id).charAt(0))
  if (first >= 3 && first <= 6) return first - 1
  return 5
}

// 光锥稀有度 -> 模板 rarity 字符串（末 7 位需为 Rarity{3|4|5}，
// 模板取 star/LightCore_{rarity.slice(-7)}.png）
export function weaponRarityStr (star) {
  const n = Number(star)
  const valid = [3, 4, 5].includes(n) ? n : 5
  return `CombatLightConeRarity${valid}`
}
