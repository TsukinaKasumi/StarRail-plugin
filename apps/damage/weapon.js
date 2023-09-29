import fs from 'fs'
import _ from 'lodash'
import fetch from 'node-fetch'
import { pluginResources, pluginRoot } from '../../utils/path.js'

const weaponData = readJson('resources/panel/data/weapon_effect.json')
/**
 * @description: 读取JSON文件
 * @param {string} path 路径
 * @param {string} root 目录
 * @return {object}
 */
function readJson (file, root = pluginRoot) {
  if (fs.existsSync(`${root}/${file}`)) {
    try {
      return JSON.parse(fs.readFileSync(`${root}/${file}`, 'utf8'))
    } catch (e) {
      logger.error(e)
    }
  }
  return {}
}

function get_let_value(let_list, name){
  if(let_list[name]){
	  return let_list[name]
  }else{
	  return 0
  }
}

function IntheNight (equipment, Ultra_Use, base_attr, attribute_bonus) {
	/** 使装备者的暴击率提高18%。当装备者在战斗中速度大于100时，每超过10点，普攻和战技造成的伤害提高6%，同时终结技的暴击伤害提高12%，该效果可叠加6层。 */
	/** 暴击率 */
	var critical_chance_base = get_let_value(attribute_bonus, 'CriticalChanceBase')
	attribute_bonus['CriticalChanceBase'] = critical_chance_base + weaponData[equipment.id]['Param']['CriticalChance'][equipment.rank - 1]
	
	/** 速度加成 */
	var char_speed = (get_let_value(base_attr, 'speed') + get_let_value(attribute_bonus, 'SpeedDelta')) * (get_let_value(attribute_bonus, 'SpeedAddedRatio') + 1)
	var count_ = Math.min(6, parseInt((char_speed - 100) / 10))
	var normal_dmg_add = get_let_value(attribute_bonus, 'NormalDmgAdd')
	attribute_bonus['NormalDmgAdd'] = normal_dmg_add + weaponData['23001']['Param']['a_dmg'][equipment.rank - 1] * count_
	
	var bp_skill_dmg_add = get_let_value(attribute_bonus, 'BPSkillDmgAdd')
	attribute_bonus['BPSkillDmgAdd'] = bp_skill_dmg_add + weaponData['23001']['Param']['e_dmg'][equipment.rank - 1] * count_
	var ultra_critical_chance_base = get_let_value(attribute_bonus, 'Ultra_CriticalDamageBase')
	attribute_bonus['Ultra_CriticalDamageBase'] = ultra_critical_chance_base + weaponData['23001']['Param']['q_crit_dmg'][equipment.rank - 1] * count_
	return attribute_bonus
}

export default function weapon_ability (equipment, Ultra_Use, base_attr, attribute_bonus) {
  if(String(equipment.id) == '23001'){
	  attribute_bonus = IntheNight(equipment, Ultra_Use, base_attr, attribute_bonus)
  }
  return attribute_bonus
}
