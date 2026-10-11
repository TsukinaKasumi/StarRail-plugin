/**
 * miao-plugin 面板数据按时间戳同步（只读 miao，绝不回写）
 *
 * 数据源：
 * - miao 面板数据文件 {Yunzai根}/data/PlayerData/sr/{uid}.json（只读）：
 *   顶层 _profile = 最后更新时间戳（ms）；avatars{id:{name,elem,level,promote,
 *   cons,talent{a,e,q,t,me?,mt?,xe?},trees[],weapon{id,level,promote,affix},
 *   artis{位置:{level,id,mainId,attrIds["词条ID,次数,步进",...]}}}}
 * - miao-plugin/resources/meta-sr 下的 character/weapon data.json（只读，
 *   提供角色突破等级属性表 attr[promate].attrs+grow、光锥同名口径表、
 *   行迹常驻加成 tree{pointId:{key,value}}）；miao 未安装/缺文件时全部降级跳过
 *
 * 基础属性口径（精确，非近似）：
 *   基础值 = 角色表 attr[promote].attrs + grow×(level-1)（miao getLvAttr 同式）
 *            + 光锥表 attr[promote].attrs + growAttr×(level-1)
 *   即"含光锥白值、不含遗器/行迹/套装加成"，与米游社 properties.base 及
 *   avocado 条目的 properties 基础键口径一致。
 * 展示增量（hpDelta 等）= 遗器词条 + 行迹常驻 + 套装常驻 + 光锥常驻词条聚合，
 *   等于游戏面板终值与基础值之差；套装/光锥常驻词条取自本插件
 *   utils/damage/json 的 RelicSetSkill / Equipment。
 * 输出契约见 utils/panel/enhanced.js 头部（= avocado displayAvatar 条目形状）。
 *
 * 已知口径限制（披露）：
 * - miao 数据不落盘 强化欢愉技(xe2) 等级（miao talent 键无 xe2），该技能位
 *   引擎按默认 1 级参与计算；
 * - miao trees 只存已激活行迹节点，未激活节点不进 skillTree（画布不画锁），
 *   不影响引擎（引擎只读 level==1 节点）；
 * - miao talent 存的是扣除星魂加成后的基础等级，与本插件 behaviorList 口径
 *   一致（handleBehaviorList 按 avatarRankSkillUp 加回）。
 */

import fs from 'fs'
import { _path } from '../path.js'
import { buildRelicSets } from './mysConverter.js'
import {
  miaoAttrToAffix, elemToDamageType, anchorBySlot, mainSlotType,
  mainSlotIcon, mainSlotMaxLevel, extraSlotType, extraSlotIcon,
  starData, mainIdx, weaponRarityById, weaponRarityStr, relicRarityById,
  statNodeIcon
} from './affixData.js'
import { relicsetskill, equipment_dict } from '../damage/data/data.js'

const MIAO_PLUGIN_ROOT = `${_path}/plugins/miao-plugin`
const MIAO_SR_PLAYER_DIR = `${_path}/data/PlayerData/sr`

const warn = (...args) => {
  if (globalThis.logger && globalThis.logger.warn) {
    globalThis.logger.warn(...args)
  } else {
    console.warn(...args)
  }
}

// ---------- miao meta 索引（懒加载 + 模块级缓存，miao 缺失时为空表降级） ----------

let charMetaIndex = null
function getCharMeta (id) {
  if (charMetaIndex === null) {
    charMetaIndex = {}
    scanMetaDir(`${MIAO_PLUGIN_ROOT}/resources/meta-sr/character`, 2, charMetaIndex)
  }
  return charMetaIndex[String(id)]
}

let weaponMetaIndex = null
function getWeaponMeta (id) {
  if (weaponMetaIndex === null) {
    weaponMetaIndex = {}
    scanMetaDir(`${MIAO_PLUGIN_ROOT}/resources/meta-sr/weapon`, 2, weaponMetaIndex)
  }
  return weaponMetaIndex[String(id)]
}

/** 递归扫描（最多 depth 层）目录下的 data.json，按其 id 字段建索引 */
function scanMetaDir (dir, depth, index) {
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch (e) {
    return
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const dataFile = `${dir}/${entry.name}/data.json`
    if (fs.existsSync(dataFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'))
        if (data && data.id != null && !index[String(data.id)]) {
          index[String(data.id)] = data
        }
      } catch (e) {
        warn(`SR-miaoSync 读取 meta 失败：${dataFile}`, e)
      }
    } else if (depth > 1) {
      scanMetaDir(`${dir}/${entry.name}`, depth - 1, index)
    }
  }
}

// ---------- 本插件遗器静态表（id -> {set_id, name, rarity, max_level}） ----------

let relicMetaCache = null
function getRelicMeta (id) {
  if (relicMetaCache === null) {
    try {
      relicMetaCache = JSON.parse(fs.readFileSync(
        `${_path}/plugins/StarRail-plugin/resources/panel/data/relics.json`, 'utf8'))
    } catch (e) {
      relicMetaCache = {}
    }
  }
  return relicMetaCache[String(id)]
}

// ---------- 对外接口 ----------

/**
 * 读取 miao 面板数据的 _profile 时间戳
 * @param {string|number} uid
 * @returns {number} 最后更新时间戳 ms；文件不存在/解析失败返回 0
 */
export function getMiaoProfileTime (uid) {
  try {
    const file = `${MIAO_SR_PLAYER_DIR}/${uid}.json`
    if (!fs.existsSync(file)) return 0
    const data = JSON.parse(fs.readFileSync(file, 'utf8'))
    return Number(data && data._profile) || 0
  } catch (e) {
    warn(`SR-miaoSync 读取 _profile 失败：uid=${uid}`, e)
    return 0
  }
}

/**
 * 导入 miao 面板数据为面板缓存条目数组（第二个转换器）
 * @param {string|number} uid
 * @returns {Array|null} 条目数组；miao 数据不存在/无可转换角色时返回 null
 */
export function importMiaoPlayerData (uid) {
  let player
  try {
    const file = `${MIAO_SR_PLAYER_DIR}/${uid}.json`
    if (!fs.existsSync(file)) return null
    player = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (e) {
    warn(`SR-miaoSync 读取 PlayerData 失败：uid=${uid}`, e)
    return null
  }
  const avatars = player && player.avatars
  if (!avatars || typeof avatars !== 'object') return null
  const entries = []
  for (const av of Object.values(avatars)) {
    const entry = convertMiaoAvatar(av)
    if (entry) entries.push(entry)
  }
  return entries.length > 0 ? entries : null
}

// ---------- 单角色转换 ----------

function convertMiaoAvatar (av) {
  if (!av || av.id == null) return null
  const avatarId = Number(av.id)
  const meta = getCharMeta(avatarId)
  const level = Number(av.level) || 1
  let promote = Number(av.promote)
  if (!Number.isInteger(promote) || promote < 0) promote = calcPromote(level)
  promote = Math.min(promote, 6)
  // 角色基础属性（突破表精确计算；miao meta 缺失时该角色跳过）
  const lvAttr = meta && meta.attr && meta.attr[String(promote)]
  if (!lvAttr || !lvAttr.attrs) return null
  const grow = lvAttr.grow || {}
  const charBase = {}
  for (const key of ['hp', 'atk', 'def', 'speed']) {
    charBase[key] = (Number(lvAttr.attrs[key]) || 0) +
      (Number(grow[key]) || 0) * (level - 1)
  }
  // 光锥（名称/星级/白值均来自 miao 光锥 meta，精确）
  const weapon = av.weapon && av.weapon.id ? av.weapon : null
  const wMeta = weapon ? getWeaponMeta(weapon.id) : null
  let wAttr = { hp: 0, atk: 0, def: 0 }
  let wPromote = 0
  if (weapon && wMeta && wMeta.attr) {
    wPromote = Number(weapon.promote)
    if (!Number.isInteger(wPromote) || wPromote < 0) wPromote = calcPromote(Number(weapon.level) || 1)
    wPromote = Math.min(wPromote, 6)
    const wLv = wMeta.attr[String(wPromote)]
    if (wLv && wLv.attrs) {
      const wGrow = wMeta.growAttr || {}
      for (const key of ['hp', 'atk', 'def']) {
        wAttr[key] = (Number(wLv.attrs[key]) || 0) +
          (Number(wGrow[key]) || 0) * ((Number(weapon.level) || 1) - 1)
      }
    }
  }
  const hpBase = charBase.hp + wAttr.hp
  const attackBase = charBase.atk + wAttr.atk
  const defenseBase = charBase.def + wAttr.def
  const speedBase = charBase.speed

  // 词条聚合（口径 = 游戏面板终值 - 基础值）：
  // 遗器主/副词条 + 行迹常驻 + 套装常驻 + 光锥常驻
  const bonus = {}
  const addBonus = (tag, value) => {
    if (tag && Number.isFinite(value) && value !== 0) {
      bonus[tag] = (bonus[tag] || 0) + value
    }
  }
  const relics = buildRelicsFromMiaoArtis(av.artis)
  for (const relic of relics) {
    addBonus(relic.main_affix_tag, relic.main_affix_value)
    for (const sub of relic.sub_affix_id) {
      addBonus(sub.tag, sub.value)
    }
  }
  // 行迹常驻节点（miao char meta tree 表：atk/hp/def 为百分比、speed 为平砍）
  if (meta && meta.tree) {
    for (const tid of av.trees || []) {
      const node = meta.tree[tid]
      if (!node) continue
      const key = ['hpPct', 'atkPct', 'defPct'].includes(node.key)
        ? node.key.slice(0, -3)
        : node.key
      const affix = miaoAttrToAffix[key]
      if (!affix) continue // joy 等非面板属性键跳过（欢愉度行走 getJoyValue 口径）
      addBonus(affix.tag, affix.percent ? Number(node.value) / 100 : Number(node.value))
    }
  }
  const relicSets = buildRelicSets(relics)
  // 套装常驻词条（本插件 RelicSetSkill，未知套装降级跳过）
  for (const set of relicSets) {
    const setNum = String(set.set_name).split('件套')[0]
    const setSkill = relicsetskill[set.set_id] &&
      relicsetskill[set.set_id][setNum]
    if (setSkill && setSkill.Property) {
      addBonus(setSkill.Property, setSkill.Value)
    }
  }
  // 光锥常驻词条（本插件 Equipment，按 叠影 取档；未知光锥降级跳过）
  if (weapon) {
    const equipAttrs = (equipment_dict[weapon.id] || {})[Number(weapon.affix) || 1] || []
    for (const attr of equipAttrs) {
      addBonus(attr.PropertyType, attr.Value && attr.Value.Value)
    }
  }

  const properties = {
    hpBase,
    attackBase,
    defenseBase,
    speedBase,
    hpDelta: (bonus.HPDelta || 0) + hpBase * (bonus.HPAddedRatio || 0),
    attackDelta: (bonus.AttackDelta || 0) + attackBase * (bonus.AttackAddedRatio || 0),
    defenseDelta: (bonus.DefenceDelta || 0) + defenseBase * (bonus.DefenceAddedRatio || 0),
    speedAdd: (bonus.SpeedDelta || 0) + speedBase * (bonus.SpeedAddedRatio || 0),
    criticalChance: 0.05 + (bonus.CriticalChanceBase || 0),
    criticalDamage: 0.5 + (bonus.CriticalDamageBase || 0),
    statusResistance: bonus.StatusResistanceBase || 0,
    statusProbability: bonus.StatusProbabilityBase || 0,
    breakDamageAdded: bonus.BreakDamageAddedRatioBase || 0,
    spRatio: bonus.SPRatioBase || 0,
    healRatio: bonus.HealRatioBase || 0,
    physicalAdded: bonus.PhysicalAddedRatio || 0,
    fireAdded: bonus.FireAddedRatio || 0,
    iceAdded: bonus.IceAddedRatio || 0,
    thunderAdded: bonus.ThunderAddedRatio || 0,
    windAdded: bonus.WindAddedRatio || 0,
    quantumAdded: bonus.QuantumAddedRatio || 0,
    imaginaryAdded: bonus.ImaginaryAddedRatio || 0
  }

  const elem = av.elem || (meta && meta.elem)
  return {
    avatarId,
    name: av.name || (meta && meta.name) || String(avatarId),
    level,
    rank: Number(av.cons) || 0,
    damage_type: elemToDamageType[elem] || 'Physical',
    properties,
    relics,
    equipment: weapon ? {
      id: weapon.id,
      level: Number(weapon.level) || 1,
      rank: Number(weapon.affix) || 1,
      promotion: wPromote,
      name: (wMeta && wMeta.name) || `光锥${weapon.id}`,
      rarity: weaponRarityStr(wMeta ? wMeta.star : weaponRarityById(weapon.id)),
      hp: wAttr.hp,
      atk: wAttr.atk,
      def: wAttr.def
    } : {
      id: 0, level: 0, rank: 1, promotion: 0,
      name: '', rarity: weaponRarityStr(5), hp: 0, atk: 0, def: 0
    },
    behaviorList: buildBehaviorList(avatarId, av, meta),
    relic_sets: relicSets
  }
}

/** miao artis（{位置:{level,id,mainId,attrIds}}）-> relics 条目 */
function buildRelicsFromMiaoArtis (artis) {
  if (!artis || typeof artis !== 'object') return []
  const relics = []
  for (let pos = 1; pos <= 6; pos++) {
    const arti = artis[String(pos)]
    if (!arti || arti.id == null) continue
    const meta = getRelicMeta(arti.id)
    // 稀有度：本插件 relics.json 优先，未收录的新遗器按 ID 首位推导
    const rarity = Number(meta && meta.rarity) || relicRarityById(arti.id)
    const level = Math.min(15, Number(arti.level) || 0)
    // 主词条：mainIdx[部位][mainId] -> miao 属性名 -> starData 查表
    const mainAttr = mainIdx[String(pos)] &&
      mainIdx[String(pos)][String(arti.mainId)]
    const mainAffix = miaoAttrToAffix[mainAttr]
    const mainTable = mainAttr && starData[String(rarity)] &&
      starData[String(rarity)].main[mainAttr]
    let mainValue = 0
    if (mainTable) {
      mainValue = mainTable[0] + mainTable[1] * level
      if (mainAffix && mainAffix.percent) mainValue = mainValue / 100
    }
    // 副词条：attrIds '词条ID,次数,步进' -> count×base + steps×step
    const subAffixId = (arti.attrIds || []).map(item => {
      const [subId, count, steps] = String(item).split(',').map(Number)
      const sub = starData[String(rarity)] &&
        starData[String(rarity)].sub[String(subId)]
      if (!sub) return null
      const affix = miaoAttrToAffix[sub[0]]
      if (!affix) return null
      let value = (Number.isFinite(count) ? count : 1) * sub[1] +
        (Number.isFinite(steps) ? steps : 0) * sub[2]
      if (affix.percent) value = value / 100
      return {
        tag: affix.tag,
        name: affix.name,
        value,
        cnt: Number.isFinite(count) ? count : 1
      }
    }).filter(Boolean)
    relics.push({
      id: arti.id,
      level,
      // 新遗器未进本插件 relics.json 时降级命名（模板 icon 同样走 panel() 的
      // relicsPathData[id]?.icon 可选链，不中断渲染）
      name: (meta && meta.name) || `遗器${arti.id}`,
      max_level: (meta && meta.max_level) || rarity * 3,
      main_affix_tag: (mainAffix && mainAffix.tag) || '',
      main_affix_name: (mainAffix && mainAffix.name) || '',
      main_affix_value: mainValue,
      sub_affix_id: subAffixId
    })
  }
  return relics
}

/** talent/trees -> behaviorList（槽位与口径见文件头注释） */
function buildBehaviorList (avatarId, av, meta) {
  const talent = av.talent || {}
  const behaviorList = []
  // 主技能：a=001、e=002、q=003、t=004、秘技=007（缺失按 1 级占位保索引）
  const talentSlot = { 1: 'a', 2: 'e', 3: 'q', 4: 't', 7: null }
  for (const slot of [1, 2, 3, 4, 7]) {
    const level = slot === 7
      ? 1
      : (Number(talent[talentSlot[slot]]) || 1)
    behaviorList.push({
      id: avatarId * 1000 + slot,
      level,
      type: mainSlotType[slot],
      anchor: anchorBySlot[slot],
      icon: synthSkillIcon(avatarId, slot),
      max_level: mainSlotMaxLevel[slot]
    })
  }
  // 扩展技能位：忆灵技 301 / 忆灵天赋 302 / 欢愉技 420
  // （miao 数据无 xe2 强化欢愉技等级，该技能位引擎按默认 1 级）
  const extraTalentSlot = { 301: 'me', 302: 'mt', 420: 'xe' }
  for (const slotStr of Object.keys(extraTalentSlot).map(Number).sort((a, b) => a - b)) {
    const level = Number(talent[extraTalentSlot[slotStr]]) || 0
    if (level > 0) {
      behaviorList.push({
        id: avatarId * 1000 + slotStr,
        level,
        type: extraSlotType[slotStr],
        anchor: null,
        icon: synthSkillIcon(avatarId, slotStr),
        max_level: 1
      })
    }
  }
  // 行迹节点（miao trees = 已激活的非技能节点，引擎按 level==1 采集常驻属性）
  for (const tid of (av.trees || []).map(Number).sort((a, b) => a - b)) {
    const slot = Number(String(tid).slice(-3))
    behaviorList.push({
      id: tid,
      level: 1,
      type: '行迹',
      anchor: anchorBySlot[slot] || null,
      icon: synthTreeIcon(avatarId, slot),
      max_level: 1
    })
  }
  return behaviorList
}

function synthSkillIcon (avatarId, slot) {
  const name = mainSlotIcon[slot] || extraSlotIcon[slot]
  return name ? `icon/skill/${avatarId}_${name}.png` : ''
}

function synthTreeIcon (avatarId, slot) {
  if (slot >= 101 && slot <= 103) {
    return `icon/skill/${avatarId}_skilltree${slot - 100}.png`
  }
  return statNodeIcon(avatarId, slot)
}

/** 突破等级推导（SR：1-20-30-40-50-60-70-80 八段，miao 未存 promote 时兜底） */
function calcPromote (level) {
  const lvs = [1, 20, 30, 40, 50, 60, 70, 80]
  let promote = 0
  for (let idx = 0; idx <= lvs.length - 1; idx++) {
    if (level >= lvs[idx] && level <= lvs[idx + 1]) return promote
    promote++
  }
  return Math.min(promote, 6)
}
