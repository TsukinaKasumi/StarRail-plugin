/**
 * 米游社星铁角色详情（avatar/info，need_wiki=true）→ 本插件面板缓存条目转换器
 *
 * 原始格式参考 miao-plugin models/serv/api/MysPanelHSRData.js 的解析口径
 * （本模块为独立实现，不依赖 miao-plugin 代码）：
 * - avatar_list[].properties：[{property_type, base, final}]，base 含光锥白值、
 *   不含遗器/行迹/套装加成；final 为面板终值（含基础值）
 * - avatar_list[].skills：[{point_id, level, remake, point_type, is_activated}]，
 *   point_type=2 为主技能（remake：普攻/战技/终结技/天赋/秘技/欢愉技/忆灵技/
 *   忆灵天赋），其余为行迹节点；忆灵技能在 servant_detail.servant_skills
 * - avatar_list[].relics / ornaments：[{pos, id, level, rarity,
 *   main_property{property_type}, properties[{property_type, value, times, is_preview}]}]
 * - avatar_list[].equip：{id, level, rank(叠影)}（name/rarity 若接口返回则透传）
 *
 * 输出契约见 utils/panel/enhanced.js 头部（= avocado displayAvatar 条目形状）。
 * 主词条数值由 affixData.starData 查表重建（base + step × 强化等级，与游戏
 * 公式一致）；副词条数值优先取米游社返回的 value 字符串（百分比词条带 '%'，
 * 换算为小数）。强化形态检测复用 utils/panel/enhanced.js。
 */

import fs from 'fs'
import { pluginRoot } from '../path.js'
import { detectAndRemapAvatar } from './enhanced.js'
import {
  propertyTypeToAffix, propertyTypeToMiaoAttr, elemToDamageType,
  damageTypeToAddedKey, anchorBySlot, mainSlotType, mainSlotIcon,
  mainSlotMaxLevel, extraSlotType, extraSlotIcon, starData,
  weaponRarityById, weaponRarityStr, relicRarityById, statNodeIcon
} from './affixData.js'

// 米游社 remake -> 主技能槽位（普攻=001、战技=002、终结技=003、天赋=004、秘技=007）
const remakeSlot = { 普攻: 1, 战技: 2, 终结技: 3, 天赋: 4, 秘技: 7 }

// damage_type -> 属性伤害 property_type（属性伤害行展示）
const addedKeyType = {
  physicalAdded: 12, fireAdded: 14, iceAdded: 16, thunderAdded: 18,
  windAdded: 20, quantumAdded: 22, imaginaryAdded: 24
}

let relicMetaCache = null
function getRelicMeta (id) {
  if (relicMetaCache === null) {
    try {
      relicMetaCache = JSON.parse(fs.readFileSync(
        `${pluginRoot}/resources/panel/data/relics.json`, 'utf8'))
    } catch (e) {
      relicMetaCache = {}
    }
  }
  return relicMetaCache[String(id)]
}

let charMetaCache = null
function getCharMeta (id) {
  if (charMetaCache === null) {
    try {
      charMetaCache = JSON.parse(fs.readFileSync(
        `${pluginRoot}/resources/panel/data/character.json`, 'utf8'))
    } catch (e) {
      charMetaCache = {}
    }
  }
  return charMetaCache[String(id)]
}

/**
 * 转换米游社 avatar_list 为面板缓存条目数组
 * @param {Array} avatarList 米游社 avatar/info 的 data.avatar_list
 * @returns {Array} 面板缓存条目（契约见 enhanced.js 头部）
 */
export function convertMysAvatarList (avatarList) {
  if (!Array.isArray(avatarList)) return []
  return avatarList.map(convertOne).filter(Boolean)
}

function convertOne (ds) {
  if (!ds || ds.id == null) return null
  const avatarId = Number(ds.id)
  const damageType = resolveDamageType(avatarId, ds.element)
  const relics = buildRelics([...(ds.relics || []), ...(ds.ornaments || [])])
  const entry = {
    avatarId,
    name: ds.name || getCharMeta(avatarId)?.name || String(avatarId),
    level: Number(ds.level) || 1,
    rank: Number(ds.rank) || 0,
    damage_type: damageType,
    properties: buildProperties(ds.properties || [], damageType),
    relics,
    equipment: buildEquipment(ds.equip),
    behaviorList: buildBehaviorList(avatarId, ds)
  }
  entry.relic_sets = buildRelicSets(relics)
  // 强化形态（刃Pro 等）：avatarId/point_id 前缀重映射
  const remapped = detectAndRemapAvatar(entry)
  // pointId 规范化：统一为 avatarId×1000+槽位 的标准形（与 miaoSync/avocado 契约一致）。
  // 米游社对忆灵技/忆灵天赋返回 8 位原始 point_id（如 14020301 → 规范为 1402301），
  // 下游面板星魂加级按完整 pointId 匹配，非标准形会失配；
  // 强化形态经上面重写后已是 7 位标准形，长度判定不受影响
  for (const s of remapped.behaviorList) {
    const canonical = remapped.avatarId * 1000 + Number(String(s.id).slice(-3))
    if (String(s.id).length > String(canonical).length) {
      s.id = canonical
    }
  }
  return remapped
}

/** damage_type 解析：米游社 element（中文/英文枚举）→ 本插件角色表兜底 */
function resolveDamageType (avatarId, element) {
  if (element) {
    if (elemToDamageType[element]) return elemToDamageType[element]
    const values = Object.values(elemToDamageType)
    if (values.includes(element)) return element
  }
  const metaElem = getCharMeta(avatarId)?.element
  return elemToDamageType[metaElem] || 'Physical'
}

/**
 * properties：base/final -> 基础键 + 展示增量键
 * 引擎只消费 4 个基础键（含光锥白值口径）；模板展示 delta = final - base
 */
function buildProperties (props, damageType) {
  const byType = {}
  for (const p of props) {
    if (p && p.property_type != null) byType[Number(p.property_type)] = p
  }
  const num = v => {
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : 0
  }
  const base = t => num(byType[t] && byType[t].base)
  const final = t => num(byType[t] && byType[t].final)
  const delta = t => Math.max(0, final(t) - base(t))
  const properties = {
    hpBase: base(1),
    attackBase: base(2),
    defenseBase: base(3),
    speedBase: base(4),
    hpDelta: delta(1),
    attackDelta: delta(2),
    defenseDelta: delta(3),
    speedAdd: delta(4),
    criticalChance: final(5),
    criticalDamage: final(6),
    statusResistance: final(11),
    statusProbability: final(10),
    breakDamageAdded: final(58),
    spRatio: delta(9),
    healRatio: final(7)
  }
  // 7 个属性伤害键全量填充，模板按角色自身属性取键
  for (const [key, type] of Object.entries(addedKeyType)) {
    properties[key] = final(type)
  }
  if (!damageTypeToAddedKey[damageType]) {
    // 未知属性兜底：属性伤害行至少有键可读
    properties.physicalAdded = properties.physicalAdded || 0
  }
  return properties
}

/** 遗器列表 -> relics 条目（词条 tag/value + 展示字段） */
function buildRelics (list) {
  if (!Array.isArray(list)) return []
  return list.filter(r => r && r.id != null && r.pos).map(relic => {
    const meta = getRelicMeta(relic.id)
    // 稀有度：米游社返回优先，其次本插件 relics.json，新遗器按 ID 首位推导
    const rarity = Number(relic.rarity) || Number(meta && meta.rarity) ||
      relicRarityById(relic.id)
    const level = Math.min(15, Number(relic.level) || 0)
    // 主词条：查表重建数值（base + step × 强化等级，与游戏公式一致）
    const mainType = Number(relic.main_property && relic.main_property.property_type)
    const mainAffix = propertyTypeToAffix[mainType]
    let mainValue = null
    const mainAttr = propertyTypeToMiaoAttr[mainType]
    const mainTable = mainAttr && starData[String(rarity)] &&
      starData[String(rarity)].main[mainAttr]
    if (mainTable) {
      mainValue = mainTable[0] + mainTable[1] * level
      if (mainAffix && mainAffix.percent) mainValue = mainValue / 100
    } else {
      mainValue = parseMysValue(relic.main_property && relic.main_property.value, mainAffix) || 0
    }
    // 副词条：米游社 value 字符串（百分比词条带 '%'）
    const subAffixId = (relic.properties || [])
      .filter(sub => sub && !sub.is_preview && sub.property_type != null)
      .map(sub => {
        const affix = propertyTypeToAffix[Number(sub.property_type)]
        if (!affix) return null
        const value = parseMysValue(sub.value, affix)
        if (value == null) return null
        return {
          tag: affix.tag,
          name: affix.name,
          value,
          cnt: Number(sub.times) || 1
        }
      })
      .filter(Boolean)
    return {
      id: relic.id,
      level,
      name: (meta && meta.name) || relic.name || `遗器${relic.id}`,
      max_level: (meta && meta.max_level) || rarity * 3,
      main_affix_tag: (mainAffix && mainAffix.tag) || '',
      main_affix_name: (mainAffix && mainAffix.name) || '',
      main_affix_value: mainValue,
      sub_affix_id: subAffixId
    }
  })
}

/**
 * 米游社数值字符串 -> 本插件数值
 * 百分比词条：'11.7%' -> 0.117（或直接给小数 0.117）；平砍词条：'38.8' -> 38.8
 */
function parseMysValue (value, affix) {
  if (value == null || value === '') return null
  const str = String(value).trim()
  const hasPercent = str.endsWith('%')
  const num = parseFloat(str)
  if (!Number.isFinite(num)) return null
  if (affix && affix.percent) {
    if (hasPercent || num > 1) return num / 100
    return num
  }
  return num
}

/** 遗器列表 -> relic_sets（按套装计数，4 件套优先于 2 件套；miaoSync 复用） */
export function buildRelicSets (relics) {
  const counts = {}
  for (const relic of relics) {
    const meta = getRelicMeta(relic.id)
    const setId = (meta && meta.set_id) || String(relic.id).slice(1, 4)
    counts[setId] = (counts[setId] || 0) + 1
  }
  const sets = []
  for (const setId of Object.keys(counts).sort()) {
    const n = counts[setId]
    if (n >= 4) {
      sets.push({ set_id: setId, set_name: '4件套' })
    } else if (n >= 2) {
      sets.push({ set_id: setId, set_name: '2件套' })
    }
  }
  return sets
}

/** 光锥 -> equipment（引擎消费 id/rank；模板展示字段做可用降级） */
function buildEquipment (equip) {
  if (!equip || !equip.id) {
    return {
      id: 0, level: 0, rank: 1, promotion: 0,
      name: '', rarity: weaponRarityStr(5), hp: 0, atk: 0, def: 0
    }
  }
  const level = Number(equip.level) || 1
  const star = Number(equip.rarity) || weaponRarityById(equip.id)
  const rarity = typeof equip.rarity === 'string' && !/^\d+$/.test(equip.rarity)
    ? equip.rarity
    : weaponRarityStr(star)
  const num = v => {
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : 0
  }
  return {
    id: equip.id,
    level,
    rank: Number(equip.rank) || 1,
    promotion: calcPromote(level),
    name: equip.name || `光锥${equip.id}`,
    rarity,
    hp: num(equip.hp),
    atk: num(equip.atk),
    def: num(equip.def)
  }
}

/** 突破等级推导（SR：1-20-30-40-50-60-70-80 八段） */
function calcPromote (level) {
  const lvs = [1, 20, 30, 40, 50, 60, 70, 80]
  let promote = 0
  for (let idx = 0; idx <= lvs.length - 1; idx++) {
    if (level >= lvs[idx] && level <= lvs[idx + 1]) return promote
    promote++
  }
  return Math.min(promote, 6)
}

/**
 * 技能/行迹 -> behaviorList
 * 前 5 项固定为 普攻(001)/战技(002)/终结技(003)/天赋(004)/秘技(007)，
 * 缺失项用 1 级占位保持索引稳定（引擎按索引取等级、按索引配图标）；
 * 之后为扩展技能位（301/302 忆灵、420/421 欢愉等）与行迹节点
 * （level 0 表示未点亮，画布按 level 判激活）
 */
function buildBehaviorList (avatarId, ds) {
  const skills = Array.isArray(ds.skills) ? ds.skills : []
  const servantSkills = (ds.servant_detail &&
    Array.isArray(ds.servant_detail.servant_skills))
    ? ds.servant_detail.servant_skills
    : []
  const mains = {}
  const extras = []
  const trees = []
  for (const skill of [...skills, ...servantSkills]) {
    if (!skill || skill.point_id == null) continue
    const pointId = Number(skill.point_id)
    const slot = Number(String(skill.point_id).slice(-3))
    const remake = skill.remake
    if (remakeSlot[remake] != null) {
      mains[remakeSlot[remake]] = makeSkillEntry(pointId, slot, remake, skill, avatarId)
    } else if (skill.point_type === 2 && [1, 2, 3, 4, 7].includes(slot)) {
      mains[slot] = makeSkillEntry(pointId, slot, mainSlotType[slot], skill, avatarId)
    } else if (skill.point_type === 2) {
      extras.push(makeSkillEntry(pointId, slot, extraSlotType[slot] || remake || '技能', skill, avatarId))
    } else {
      const level = skill.is_activated === false
        ? 0
        : (Number(skill.level) || (skill.is_activated ? 1 : 0))
      trees.push({
        id: pointId,
        level,
        type: '行迹',
        anchor: anchorBySlot[slot] || null,
        icon: skill.icon || synthTreeIcon(avatarId, slot),
        max_level: Number(skill.max_level) || 1
      })
    }
  }
  const behaviorList = []
  for (const slot of [1, 2, 3, 4, 7]) {
    behaviorList.push(mains[slot] || {
      id: avatarId * 1000 + slot,
      level: 1,
      type: mainSlotType[slot],
      anchor: anchorBySlot[slot],
      icon: synthMainIcon(avatarId, slot),
      max_level: mainSlotMaxLevel[slot]
    })
  }
  extras.sort((a, b) => a.id - b.id)
  trees.sort((a, b) => a.id - b.id)
  behaviorList.push(...extras, ...trees)
  return behaviorList
}

function makeSkillEntry (pointId, slot, type, skill, avatarId) {
  return {
    id: pointId,
    level: Number(skill.level) || 1,
    type,
    anchor: anchorBySlot[slot] || null,
    icon: skill.icon || synthMainIcon(avatarId, slot),
    max_level: Number(skill.max_level) || mainSlotMaxLevel[slot] || 1
  }
}

/** 主技能位图标（游戏 Sprite 路径，与本地 resources/panel/resources/skill 命名一致） */
function synthMainIcon (avatarId, slot) {
  const name = mainSlotIcon[slot] || extraSlotIcon[slot]
  return name ? `icon/skill/${avatarId}_${name}.png` : ''
}

/** 行迹节点图标：能力节点(101-103)用 skilltree1-3，属性小节点(201-210)查属性表 */
function synthTreeIcon (avatarId, slot) {
  if (slot >= 101 && slot <= 103) {
    return `icon/skill/${avatarId}_skilltree${slot - 100}.png`
  }
  return statNodeIcon(avatarId, slot)
}
