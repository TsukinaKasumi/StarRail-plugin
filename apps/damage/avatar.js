import fs from 'fs'
import _ from 'lodash'
import fetch from 'node-fetch'
import { pluginResources, pluginRoot } from '../../utils/path.js'
// 引入技能数值
const skilldictData = readJson('resources/panel/data/SkillData.json')
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

function Seele(data, base_attr, attribute_bonus){
	logger.mark('希儿天赋量子穿透')
	attribute_bonus['QuantumResistancePenetration'] = 0.2 + get_let_value(attribute_bonus, 'QuantumResistancePenetration')
	if(data.rank < 2){
		attribute_bonus['SpeedAddedRatio'] = 0.25 + get_let_value(attribute_bonus, 'SpeedAddedRatio')
	}
	if(data.rank >= 1){
		attribute_bonus['CriticalChanceBase'] = 0.15 + get_let_value(attribute_bonus, 'CriticalChanceBase')
	}
	if(data.rank >= 2){
		attribute_bonus['SpeedAddedRatio'] = 0.5 + get_let_value(attribute_bonus, 'SpeedAddedRatio')
	}
	logger.mark('希儿天赋技能增伤')
	var all_damage_added_ratio = getskilllevelnum(data.avatarId, data.behaviorList, 'talent', 'Talent')
	attribute_bonus['AllDamageAddedRatio'] = all_damage_added_ratio + get_let_value(attribute_bonus, 'AllDamageAddedRatio')
	return attribute_bonus
}

export default function avatar_ability (data, base_attr, attribute_bonus) {
  if(String(data.avatarId) == '1102'){
	  attribute_bonus = Seele(data, base_attr, attribute_bonus)
  }
  return attribute_bonus
}

/** 处理技能倍率 */
function getskilllevelnum(avatarId, behaviorList, leveltype, skilltype){
  if(leveltype == 'basic_atk'){
	  var skilllevel = behaviorList[0]['level']
  }else if(leveltype == 'skill'){
	  var skilllevel = behaviorList[1]['level']
  }else if(leveltype == 'ultimate'){
	  var skilllevel = behaviorList[2]['level']
  }else if(leveltype == 'talent'){
	  var skilllevel = behaviorList[3]['level']
  }else{
	  var skilllevel = 1
  }
  logger.mark(leveltype + '技能等级: '+ skilllevel)
  return skilldictData[avatarId][skilltype][skilllevel - 1]
}