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

function Relic101(relic_set, base_attr, attribute_bonus){
	if(relic_set.set_name == '2件套'){
		var HealTakenRatio = get_let_value(attribute_bonus, 'HealTakenRatio')
		attribute_bonus['HealTakenRatio'] = attack_added_ratio + 0.1
	}
    return attribute_bonus
}

function Relic102(relic_set, base_attr, attribute_bonus){
	if(relic_set.set_name == '2件套'){
		var attack_added_ratio = get_let_value(attribute_bonus, 'AttackAddedRatio')
		attribute_bonus['AttackAddedRatio'] = attack_added_ratio + 0.12
	}
	if(relic_set.set_name == '4件套'){
		var SpeedAddedRatio = get_let_value(attribute_bonus, 'SpeedAddedRatio')
		attribute_bonus['SpeedAddedRatio'] = SpeedAddedRatio + 0.06
		
		var a_dmg = get_let_value(attribute_bonus, 'NormalDmgAdd')
		attribute_bonus['NormalDmgAdd'] = a_dmg + 0.10000000018626451
	}
    return attribute_bonus
}

function Relic103(relic_set, base_attr, attribute_bonus){
	if(relic_set.set_name == '2件套'){
		var defence_added_ratio = get_let_value(attribute_bonus, 'DefenceAddedRatio')
		attribute_bonus['DefenceAddedRatio'] = defence_added_ratio + 0.1500000001396984
	}
	if(relic_set.set_name == '4件套'){
		var shield_added_ratio = get_let_value(attribute_bonus, 'shield_added_ratio')
		attribute_bonus['shield_added_ratio'] = shield_added_ratio + 0.20000000018626451
	}
    return attribute_bonus
}

function Relic104(relic_set, base_attr, attribute_bonus){
	if(relic_set.set_name == '2件套'){
		var IceAddedRatio = get_let_value(attribute_bonus, 'IceAddedRatio')
		attribute_bonus['IceAddedRatio'] = IceAddedRatio + 0.10000000009313226
	}
	if(relic_set.set_name == '4件套'){
		var critical_damage_base = get_let_value(attribute_bonus, 'CriticalDamageBase')
		attribute_bonus['CriticalDamageBase'] = critical_damage_base + 0.25000000018626451
	}
    return attribute_bonus
}

function Relic105(relic_set, base_attr, attribute_bonus){
	if(relic_set.set_name == '2件套'){
		var PhysicalAddedRatio = get_let_value(attribute_bonus, 'PhysicalAddedRatio')
		attribute_bonus['PhysicalAddedRatio'] = PhysicalAddedRatio + 0.10000000009313226
	}
	if(relic_set.set_name == '4件套'){
		var attack_added_ratio = get_let_value(attribute_bonus, 'AttackAddedRatio')
		attribute_bonus['AttackAddedRatio'] = attack_added_ratio + 0.05000000004656613 * 5
	}
    return attribute_bonus
}

function Relic106(relic_set, base_attr, attribute_bonus){
    return attribute_bonus
}

function Relic107(relic_set, base_attr, attribute_bonus){
	if(relic_set.set_name == '2件套'){
		var FireAddedRatio = get_let_value(attribute_bonus, 'FireAddedRatio')
		attribute_bonus['FireAddedRatio'] = FireAddedRatio + 0.10000000009313226
	}
	if(relic_set.set_name == '4件套'){
		var FireAddedRatio = get_let_value(attribute_bonus, 'FireAddedRatio')
		attribute_bonus['FireAddedRatio'] = FireAddedRatio + 0.12000000009313226
		
		var e_dmg = get_let_value(attribute_bonus, 'BPSkillDmgAdd')
        attribute_bonus['BPSkillDmgAdd'] = e_dmg + 0.12000000011175871
	}
    return attribute_bonus
}

function Relic108(relic_set, base_attr, attribute_bonus){
	if(relic_set.set_name == '2件套'){
		logger.debug('量子2件套加10%量子伤害')
		var quantum_added_ratio = get_let_value(attribute_bonus, 'QuantumAddedRatio')
		attribute_bonus['QuantumAddedRatio'] = quantum_added_ratio + 0.10000000009313226
	}
	if(relic_set.set_name == '4件套'){
		logger.debug('量子4件套加20%量子穿透')
		var ignore_defence = get_let_value(attribute_bonus, 'ignore_defence')
		attribute_bonus['ignore_defence'] = ignore_defence + (0.10000000009313226 * 2)
	}
	return attribute_bonus
}

function Relic109(relic_set, base_attr, attribute_bonus){
	if(relic_set.set_name == '2件套'){
		logger.debug('Relic109 2 check success')
		var ThunderAddedRatio = get_let_value(attribute_bonus, 'ThunderAddedRatio')
		attribute_bonus['ThunderAddedRatio'] = ThunderAddedRatio + 0.10000000009313226
	}
	if(relic_set.set_name == '4件套'){
		var attack_added_ratio = get_let_value(attribute_bonus, 'AttackAddedRatio')
		attribute_bonus['AttackAddedRatio'] = attack_added_ratio + 0.20000000018626451
	}
    return attribute_bonus
}

function Relic110(relic_set, base_attr, attribute_bonus){
	if(relic_set.set_name == '2件套'){
		var WindAddedRatio = get_let_value(attribute_bonus, 'WindAddedRatio')
		attribute_bonus['WindAddedRatio'] = WindAddedRatio + 0.10000000009313226
	}
	if(relic_set.set_name == '4件套'){
		logger.debug('ModifyActionDelay')
	}
    return attribute_bonus
}

function Relic111(relic_set, base_attr, attribute_bonus){
	if(relic_set.set_name == '2件套'){
		var BreakDamageAddedRatioBase = get_let_value(attribute_bonus, 'BreakDamageAddedRatioBase')
		attribute_bonus['BreakDamageAddedRatioBase'] = BreakDamageAddedRatioBase + 0.16000000009313226
	}
	if(relic_set.set_name == '4件套'){
		var BreakDamageAddedRatioBase = get_let_value(attribute_bonus, 'BreakDamageAddedRatioBase')
		attribute_bonus['BreakDamageAddedRatioBase'] = BreakDamageAddedRatioBase + 0.16000000009313226
	}
    return attribute_bonus
}

function Relic112(relic_set, base_attr, attribute_bonus){
	if(relic_set.set_name == '2件套'){
		var ImaginaryAddedRatio = get_let_value(attribute_bonus, 'ImaginaryAddedRatio')
		attribute_bonus['ImaginaryAddedRatio'] = ImaginaryAddedRatio + 0.16000000009313226
	}
	if(relic_set.set_name == '4件套'){
		var critical_chance_base = get_let_value(attribute_bonus, 'CriticalChanceBase')
		attribute_bonus['CriticalChanceBase'] = critical_chance_base + 0.10000000009313226
		
		var critical_damage_base = get_let_value(attribute_bonus, 'CriticalDamageBase')
		attribute_bonus['CriticalDamageBase'] = critical_damage_base + 0.20000000018626451
	}
    return attribute_bonus
}

function Relic113(relic_set, base_attr, attribute_bonus){
	if(relic_set.set_name == '2件套'){
		var HPAddedRatio = get_let_value(attribute_bonus, 'HPAddedRatio')
		attribute_bonus['HPAddedRatio'] = HPAddedRatio + 0.12000000009313226
	}
	if(relic_set.set_name == '4件套'){
		var critical_chance_base = get_let_value(attribute_bonus, 'CriticalChanceBase')
		attribute_bonus['CriticalChanceBase'] = critical_chance_base + 0.08000000009313226 * 2
	}
    return attribute_bonus
}

function Relic114(relic_set, base_attr, attribute_bonus){
	if(relic_set.set_name == '2件套'){
		var SpeedAddedRatio = get_let_value(attribute_bonus, 'SpeedAddedRatio')
		attribute_bonus['SpeedAddedRatio'] = SpeedAddedRatio + 0.06
	}
	if(relic_set.set_name == '4件套'){
		var SpeedAddedRatio = get_let_value(attribute_bonus, 'SpeedAddedRatio')
		attribute_bonus['SpeedAddedRatio'] = SpeedAddedRatio + 0.12
	}
    return attribute_bonus
}

function Relic301(relic_set, base_attr, attribute_bonus){
	var attack_added_ratio = get_let_value(attribute_bonus, 'AttackAddedRatio')
	attribute_bonus['AttackAddedRatio'] = attack_added_ratio + 0.12
	var speed = (get_let_value(base_attr, 'speed') + get_let_value(attribute_bonus, 'SpeedDelta')) * (get_let_value(attribute_bonus, 'SpeedAddedRatio') + 1)
    if (relic_set.set_name == '2件套' && speed >= 120){
		logger.debug('Relic301 check success')
		var attack_added_ratio = get_let_value(attribute_bonus, 'AttackAddedRatio')
		attribute_bonus['AttackAddedRatio'] = attack_added_ratio + 0.1200000000745058
	}
    return attribute_bonus
}

function Relic302(relic_set, base_attr, attribute_bonus){
	var hp_added_ratio = get_let_value(attribute_bonus, 'HpAddedRatio')
	attribute_bonus['HpAddedRatio'] = hp_added_ratio + 0.12
	var speed = (get_let_value(base_attr, 'speed') + get_let_value(attribute_bonus, 'SpeedDelta')) * (get_let_value(attribute_bonus, 'SpeedAddedRatio') + 1)
    if (relic_set.set_name == '2件套' && speed >= 120){
		logger.debug('Relic302 check success')
		var attack_added_ratio = get_let_value(attribute_bonus, 'AttackAddedRatio')
		attribute_bonus['AttackAddedRatio'] = attack_added_ratio + 0.0800000000745058
	}
    return attribute_bonus
}

function Relic303(relic_set, base_attr, attribute_bonus){
	var status_probability = get_let_value(attribute_bonus, 'StatusProbabilityBase')
	attribute_bonus['StatusProbabilityBase'] = status_probability + 0.1
	if(relic_set.set_name == '2件套'){
		logger.debug('Relic303 check success')
		var attack_added_ratio = get_let_value(attribute_bonus, 'AttackAddedRatio')
		var status_probability = get_let_value(attribute_bonus, 'StatusProbabilityBase')
		attribute_bonus['AttackAddedRatio'] = attack_added_ratio + Math.min(0.25000000023283064, status_probability / 0.25)
	}
    return attribute_bonus
}

function Relic304(relic_set, base_attr, attribute_bonus){
	var defence_added_ratio = get_let_value(attribute_bonus, 'DefenceAddedRatio')
	attribute_bonus['DefenceAddedRatio'] = defence_added_ratio + 0.1500000001396984
	var StatusResistanceBase = get_let_value(base_attr, 'StatusResistanceBase') + get_let_value(attribute_bonus, 'StatusResistanceBase')
	if(relic_set.set_name == '2件套' && StatusResistanceBase >= 0.5){
		logger.debug('Relic304 check success')
		defence_added_ratio = get_let_value(attribute_bonus, 'DefenceAddedRatio')
		attribute_bonus['DefenceAddedRatio'] = defence_added_ratio + 0.1500000001396984
	}
    return attribute_bonus
}

function Relic305(relic_set, base_attr, attribute_bonus){
    var critical_damage_base = get_let_value(attribute_bonus, 'CriticalDamageBase')
	attribute_bonus['CriticalDamageBase'] = critical_damage_base + 0.16
	critical_damage_base = get_let_value(base_attr, 'CriticalDamageBase') + get_let_value(attribute_bonus, 'CriticalDamageBase')
    if(relic_set.set_name == '2件套' && critical_damage_base >= 1.2){
		logger.debug('Relic305 check success')
		var critical_chance_base = get_let_value(attribute_bonus, 'CriticalChanceBase')
		attribute_bonus['CriticalChanceBase'] = critical_chance_base + 0.6000000005587935
	}
    return attribute_bonus
}

function Relic306(relic_set, base_attr, attribute_bonus){
	logger.debug('萨尔索图2件套加8%暴击率')
	var critical_chance_base = get_let_value(attribute_bonus, 'CriticalChanceBase')
	attribute_bonus['CriticalChanceBase'] = critical_chance_base + 0.08
	critical_chance_base = get_let_value(attribute_bonus, 'CriticalChanceBase') + get_let_value(base_attr, 'CriticalChanceBase')
	if(relic_set.set_name == '2件套' && critical_chance_base >= 0.5){
		logger.debug('萨尔索图2件套终结技和追加攻击造成的伤害提高15%')
		var q_dmg = get_let_value(attribute_bonus, 'UltraDmgAdd')
		attribute_bonus['UltraDmgAdd'] = q_dmg + 0.1500000001396984
		var a3_dmg = get_let_value(attribute_bonus, 'TalentDmgAdd')
		attribute_bonus['TalentDmgAdd'] = a3_dmg + 0.1500000001396984
	}
	return attribute_bonus
}

function Relic307(relic_set, base_attr, attribute_bonus){
	var speed = (get_let_value(base_attr, 'speed') + get_let_value(attribute_bonus, 'SpeedDelta')) * (get_let_value(attribute_bonus, 'SpeedAddedRatio') + 1)
	if (relic_set.set_name == '2件套' && speed >= 145){
		logger.debug('Relic307 check success')
		var BreakDamageAddedRatio = get_let_value(attribute_bonus, 'BreakDamageAddedRatio')
		attribute_bonus['BreakDamageAddedRatio'] = BreakDamageAddedRatio + 0.20000000018626451
	}
	return attribute_bonus
}

function Relic308(relic_set, base_attr, attribute_bonus){
    var speed = (get_let_value(base_attr, 'speed') + get_let_value(attribute_bonus, 'SpeedDelta')) * (get_let_value(attribute_bonus, 'SpeedAddedRatio') + 1)
	if (relic_set.set_name == '2件套' && speed >= 120){
		logger.debug('Relic308 check success')
		logger.info('ModifyActionDelay')
	}
	return attribute_bonus
}

function Relic309(relic_set, base_attr, attribute_bonus){
	logger.debug('Relic309 CriticalChanceBase add 0.08')
	var critical_chance_base = get_let_value(attribute_bonus, 'CriticalChanceBase')
	attribute_bonus['CriticalChanceBase'] = critical_chance_base + 0.08
	critical_chance_base = get_let_value(attribute_bonus, 'CriticalChanceBase') + get_let_value(base_attr, 'CriticalChanceBase')
	if(relic_set.set_name == '2件套' && critical_chance_base >= 0.7){
		logger.debug('Relic309 check success')
		var a_dmg = get_let_value(attribute_bonus, 'NormalDmgAdd')
		attribute_bonus['NormalDmgAdd'] = a_dmg + 0.20000000018626451
		var a2_dmg = get_let_value(attribute_bonus, 'BPSkillDmgAdd')
		attribute_bonus['BPSkillDmgAdd'] = a2_dmg + 0.20000000018626451
	}
    return attribute_bonus
}

function Relic310(relic_set, base_attr, attribute_bonus){
    var StatusResistanceBase = get_let_value(attribute_bonus, 'StatusResistanceBase')
	attribute_bonus['StatusResistanceBase'] = StatusResistanceBase + 0.1
	StatusResistanceBase = get_let_value(attribute_bonus, 'StatusResistanceBase') + get_let_value(base_attr, 'StatusResistanceBase')
	if(relic_set.set_name == '2件套' && StatusResistanceBase >= 0.3){
		var critical_damage_base = get_let_value(attribute_bonus, 'CriticalDamageBase')
		attribute_bonus['CriticalDamageBase'] = critical_damage_base + 0.10000000018626451
	}
    return attribute_bonus
}

export default function relice_ability (relic_set, base_attr, attribute_bonus) {
  if(String(relic_set.set_id) == '101'){
	  attribute_bonus = Relic101(relic_set, base_attr, attribute_bonus)
  }
  if(String(relic_set.set_id) == '102'){
	  attribute_bonus = Relic102(relic_set, base_attr, attribute_bonus)
  }
  if(String(relic_set.set_id) == '103'){
	  attribute_bonus = Relic103(relic_set, base_attr, attribute_bonus)
  }
  if(String(relic_set.set_id) == '104'){
	  attribute_bonus = Relic104(relic_set, base_attr, attribute_bonus)
  }
  if(String(relic_set.set_id) == '105'){
	  attribute_bonus = Relic105(relic_set, base_attr, attribute_bonus)
  }
  if(String(relic_set.set_id) == '106'){
	  attribute_bonus = Relic106(relic_set, base_attr, attribute_bonus)
  }
  if(String(relic_set.set_id) == '107'){
	  attribute_bonus = Relic107(relic_set, base_attr, attribute_bonus)
  }
  if(String(relic_set.set_id) == '108'){
	  attribute_bonus = Relic108(relic_set, base_attr, attribute_bonus)
  }
  if(String(relic_set.set_id) == '109'){
	  attribute_bonus = Relic109(relic_set, base_attr, attribute_bonus)
  }
  if(String(relic_set.set_id) == '110'){
	  attribute_bonus = Relic110(relic_set, base_attr, attribute_bonus)
  }
  if(String(relic_set.set_id) == '111'){
	  attribute_bonus = Relic111(relic_set, base_attr, attribute_bonus)
  }
  if(String(relic_set.set_id) == '112'){
	  attribute_bonus = Relic112(relic_set, base_attr, attribute_bonus)
  }
  if(String(relic_set.set_id) == '113'){
	  attribute_bonus = Relic113(relic_set, base_attr, attribute_bonus)
  }
  if(String(relic_set.set_id) == '114'){
	  attribute_bonus = Relic114(relic_set, base_attr, attribute_bonus)
  }
  if(String(relic_set.set_id) == '301'){
	  attribute_bonus = Relic301(relic_set, base_attr, attribute_bonus)
  }
  if(String(relic_set.set_id) == '302'){
	  attribute_bonus = Relic302(relic_set, base_attr, attribute_bonus)
  }
  if(String(relic_set.set_id) == '303'){
	  attribute_bonus = Relic303(relic_set, base_attr, attribute_bonus)
  }
  if(String(relic_set.set_id) == '304'){
	  attribute_bonus = Relic304(relic_set, base_attr, attribute_bonus)
  }
  if(String(relic_set.set_id) == '305'){
	  attribute_bonus = Relic305(relic_set, base_attr, attribute_bonus)
  }
  if(String(relic_set.set_id) == '306'){
	  attribute_bonus = Relic306(relic_set, base_attr, attribute_bonus)
  }
  if(String(relic_set.set_id) == '307'){
	  attribute_bonus = Relic307(relic_set, base_attr, attribute_bonus)
  }
  if(String(relic_set.set_id) == '308'){
	  attribute_bonus = Relic308(relic_set, base_attr, attribute_bonus)
  }
  if(String(relic_set.set_id) == '309'){
	  attribute_bonus = Relic309(relic_set, base_attr, attribute_bonus)
  }
  if(String(relic_set.set_id) == '310'){
	  attribute_bonus = Relic310(relic_set, base_attr, attribute_bonus)
  }
  return attribute_bonus
}
