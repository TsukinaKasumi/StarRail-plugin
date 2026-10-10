/**
 * 强化形态（Pro 形态）检测与重映射
 *
 * 机制说明（参考 miao-plugin models/serv/api/MysPanelHSRApi.js 的同名逻辑，
 * 本模块为独立实现，不依赖 miao-plugin 代码）：
 * 米游社 / 三方面板数据里，强化形态角色（刃Pro、镜流Pro 等 10 名）的
 * avatarId 仍是原始 ID（如刃 = 1205），但技能 point_id 带前缀 '1'+avatarId
 * （如 "11205" 开头的 8 位数 point_id）。检测命中后需要：
 *   1. avatarId 重映射为 '2'+原ID[1:]（1205 -> 2205）；
 *   2. 所有 point_id 的 '1'+原ID 前缀重写为新 ID 前缀（11205003 -> 2205003）；
 *   3. name 同步为 Pro 命名（与 utils/alias.js 的 Pro 别名键、
 *      miao-plugin PlayerData 的 Pro 名称保持一致，保证 *XX面板 查询可达）。
 * 不做重映射时，强化角色的行迹节点 ID 无法命中 char_dict（1205101 系），
 * 技能等级/图标前缀解析全部失效。
 *
 * ===================== 面板缓存条目字段契约（输出约束）=====================
 * 两个转换器（mysConverter.js / miaoSync.js）与 avocado 数据入口产出的
 * 缓存条目 = avocado displayAvatar 条目原样 + is_new/lastUpdateTime 标记，
 * 下游消费字段（穷举自 apps/panel.js + utils/damage/main.js +
 * resources/panel/new_panel.html）：
 *
 * 【顶层】
 *   avatarId   角色ID（强化形态为 2xxx）
 *   name       角色名（需能被 utils/alias.js 反查，如 "刃Pro"）
 *   level      等级 1-80
 *   rank       命座 0-6
 *   damage_type 属性英文枚举：Fire/Ice/Thunder/Quantum/Wind/Imaginary/Physical
 *              （模板 common/element/{{damage_type.toLowerCase()}}.png）
 *
 * 【properties】引擎 get_base_attr 只读 4 个基础键；模板属性行读全部展示键：
 *   引擎：hpBase / attackBase / defenseBase / speedBase
 *         （口径：含光锥基础白值、不含遗器/行迹/套装加成，与米游社
 *          properties[].base 一致；遗器等加成单独存在于 relics 词条）
 *   模板：hpBase/hpDelta、attackBase/attackDelta、defenseBase/defenseDelta、
 *         speedBase/speedAdd、criticalChance、criticalDamage、
 *         statusResistance、statusProbability、breakDamageAdded、
 *         spRatio（超出 100% 的部分，模板按 100+spRatio*100 展示）、
 *         healRatio（丰饶行）、{{damage_type小写}}Added（属性伤害行，如 fireAdded）
 *
 * 【relics[]】引擎 get_attribute_bonus 逐条累加：
 *   id、level、main_affix_tag、main_affix_value、
 *   sub_affix_id[{tag, value}]（tag 为引擎属性键，如 CriticalChanceBase）
 *   模板另读：name、max_level（=稀有度x3）、main_affix_name、
 *   sub_affix_id[].name/.cnt/.weight、score（缺省时模板展示 0 分）
 *   path 由 apps/panel.js 从 resources/panel/data/relics.json 按 id 补齐
 *
 * 【relic_sets[]】引擎按 set_name 前缀数字取 RelicSetSkill[set_id][N]：
 *   set_id（字符串）、set_name（'2件套' / '4件套'，4 件套不含 2 件套加成）
 *
 * 【equipment】引擎 get_attribute_bonus 读 equipment_dict[id][rank] 常驻词条：
 *   id、rank（叠影 1-5）
 *   模板另读：name、level、rarity（字符串，末 7 位需为 Rarity{3|4|5}）、
 *   hp/atk/def（光锥白值，缺省 0）
 *
 * 【behaviorList[]】前 5 项按序 = 普攻/战技/终结技/天赋/秘技
 *   （引擎 getskilllevelnum 按索引取等级；handleBehaviorList 按索引配图标），
 *   第 6 项起仅 point_id 末三位 301/302（忆灵技/忆灵天赋）、420/421
 *   （欢愉技/强化欢愉技）的条目会被保留参与等级解析：
 *   条目 {id, level}，id = avatarId*1000+槽位
 *   （槽位：普攻=001、战技=002、终结技=003、天赋=004、秘技=007，
 *    与 avatarRankSkillUp 的星魂加成 id（avatarId*100+槽位）及
 *    char_dict 行迹节点键（avatarId*1000+槽位）一致）；
 *   渲染另读：type（'秘技' 被过滤）、anchor（Point01-18）、icon、max_level
 *
 * 【skillTree】渲染期由 behaviorList 派生（handleSkillTree 补坐标），
 *   画布按 anchor 定位、level>0 判激活；引擎读 level==1 的行迹节点
 *   （从 char_dict[avatarId][pointId].levels[0].properties 取加成）
 *
 * 【标记】is_new（本次更新条目）、lastUpdateTime（ms 时间戳）
 */

import _ from 'lodash'

/** 强化形态白名单（原始 avatarId，与 miao-plugin Character.enhancedCharIds 一致） */
export const enhancedCharIds = [1212, 1205, 1005, 1006, 1004, 1102, 1217, 1310, 1306, 1307]

/** 重映射后 avatarId -> Pro 命名（与 utils/alias.js Pro 别名键一致） */
export const enhancedCharNames = {
  2004: '瓦尔特Pro',
  2005: '卡芙卡Pro',
  2006: '银狼Pro',
  2102: '希儿Pro',
  2205: '刃Pro',
  2212: '镜流Pro',
  2217: '藿藿Pro',
  2306: '花火Pro',
  2307: '黑天鹅Pro',
  2310: '流萤Pro'
}

/** 条目中承载 point_id 的数组字段（avocado/转换器条目用 id，mys 原始数据用 point_id） */
const POINT_ID_LISTS = ['behaviorList', 'skillTree', 'skills']

/**
 * 检测并重映射强化形态角色条目
 * @param {object} entry 面板角色条目（avocado displayAvatar / 转换器产出 / mys 原始条目）
 * @returns {object} 命中强化形态时返回重映射后的深拷贝；否则原样返回（不改动入参）
 */
export function detectAndRemapAvatar (entry) {
  if (!entry || !enhancedCharIds.includes(Number(entry.avatarId))) {
    return entry
  }
  const originalIdStr = String(entry.avatarId)
  const enhancedPrefix = '1' + originalIdStr
  const isEnhanced = POINT_ID_LISTS.some(listName => {
    const list = entry[listName]
    return Array.isArray(list) && list.some(item => {
      if (!item) return false
      const pointId = item.point_id != null ? item.point_id : item.id
      return String(pointId).startsWith(enhancedPrefix)
    })
  })
  if (!isEnhanced) {
    return entry
  }
  const newId = parseInt('2' + originalIdStr.substring(1), 10)
  const remapped = _.cloneDeep(entry)
  remapped.avatarId = newId
  if (enhancedCharNames[newId]) {
    remapped.name = enhancedCharNames[newId]
  }
  for (const listName of POINT_ID_LISTS) {
    const list = remapped[listName]
    if (!Array.isArray(list)) continue
    list.forEach(item => {
      if (!item) return
      if (item.point_id != null) {
        item.point_id = remapPointId(item.point_id, originalIdStr, newId)
      }
      if (item.id != null) {
        item.id = remapPointId(item.id, originalIdStr, newId)
      }
    })
  }
  return remapped
}

/**
 * 重写单个 point_id 的强化形态前缀
 * '1'+原ID 前缀 -> 新ID 前缀（1205: 11205003 -> 2205003），未命中前缀原样返回
 */
function remapPointId (pointId, originalIdStr, newId) {
  const str = String(pointId)
  const oldPrefix = '1' + originalIdStr
  if (str.startsWith(oldPrefix)) {
    return parseInt(str.replace(oldPrefix, String(newId)), 10)
  }
  return pointId
}
