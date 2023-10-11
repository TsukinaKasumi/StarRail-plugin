import { weapon_ability } from './effect/weapon.js'
import { avatar_ability } from './effect/avatar.js'
import { relice_ability } from './effect/relice.js'
import { char_dict, skilldict, relicsetskill, equipment_dict } from './data/data.js'
export function damage (charinfo) {
  if (!(String(charinfo.avatarId) in skilldict)) { return null }
  if (!('skillTree' in charinfo)) { return null }
  let skill_info = skilldict[String(charinfo.avatarId)].skillList
  if (!skill_info) { return null }
  let skills = Object.keys(skill_info)
  logger.mark('skills：', skills)
  let damage_list = []
  for (let i = 0; i < skills.length; i++) {
    let skill_list = getdamages_num(skills[i], charinfo)
    damage_list.push(skill_list)
  }
  const result = {
    id: String(charinfo.avatarId),
    damage: damage_list
  }
  return result
}
function getdamages_num (skill_type, data) {
  let base_attr = get_base_attr(data.properties)
  let attribute_bonus = get_attribute_bonus(data)
  attribute_bonus = avatar_ability(data, base_attr, attribute_bonus)
  let skill_info = skilldict[String(data.avatarId)].skillList[skill_type]
  let skill_multiplier = 0
  if (skill_type == 'Normal') {
    skill_multiplier = getskilllevelnum(String(data.avatarId), data.behaviorList, 'basic_atk', skill_type)
    if (String(data.avatarId) == '1004' && data.rank >= 1) {
      skill_multiplier = skill_multiplier + skill_multiplier * 0.5
    }
  } else if (skill_type == 'BPSkill') {
    skill_multiplier = getskilllevelnum(String(data.avatarId), data.behaviorList, 'skill', skill_type)
    if (String(data.avatarId) == '1004' && data.rank >= 1) {
      skill_multiplier = skill_multiplier + skill_multiplier * 0.8
    }
  } else if (skill_type == 'Ultra') {
    skill_multiplier = getskilllevelnum(String(data.avatarId), data.behaviorList, 'ultimate', skill_type)
    if (String(data.avatarId) == '1006' && data.rank >= 4) {
      skill_multiplier = skill_multiplier + 1
    }
  } else if (skill_type == 'Talent') {
    skill_multiplier = getskilllevelnum(String(data.avatarId), data.behaviorList, 'talent', skill_type)
    if (String(data.avatarId) == '1209') {
      if (data.rank >= 1) {
        skill_multiplier = skill_multiplier + 0.9
      } else {
        skill_multiplier = skill_multiplier + 0.3
      }
    }
  } else {
    if (String(data.avatarId) == '1107') {
      let skill_multiplier_1 = getskilllevelnum(String(data.avatarId), data.behaviorList, 'talent', skill_info[3])
      let skill_multiplier_2 = getskilllevelnum(String(data.avatarId), data.behaviorList, 'ultimate', skill_info[3])
      skill_multiplier = skill_multiplier_1 + skill_multiplier_2
      skill_type = 'Talent'
    } else if (String(data.avatarId) == '1213' ||
            String(data.avatarId) == '1201') {
      skill_multiplier = getskilllevelnum(String(data.avatarId), data.behaviorList, 'basic_atk', skill_info[3])
      skill_type = 'Normal'
    } else if (String(data.avatarId) == '1005') {
      skill_multiplier = getskilllevelnum(String(data.avatarId), data.behaviorList, 'ultimate', skill_info[3])
      if (data.rank >= 6) {
        skill_multiplier = skill_multiplier + 1.56
      }
    } else if (String(data.avatarId) == '1205') {
      skill_multiplier = getskilllevelnum(String(data.avatarId), data.behaviorList, 'basic_atk', skill_info[3])
    } else if (String(data.avatarId) == '1212') {
      skill_multiplier = getskilllevelnum(String(data.avatarId), data.behaviorList, 'skill', skill_info[3])
      skill_type = 'BPSkill'
    } else if (String(data.avatarId) == '1112') {
      let skill_multiplier_1 = getskilllevelnum(String(data.avatarId), data.behaviorList, 'skill', 'BPSkill')
      let skill_multiplier_2 = getskilllevelnum(String(data.avatarId), data.behaviorList, 'ultimate', skill_info[3])
      skill_multiplier = skill_multiplier_1 + skill_multiplier_2
      skill_type = 'Talent'
    }
  }
  if (String(data.avatarId) == '1212' && data.rank >= 1) {
    if (skill_info[3] == 'BPSkill1' || skill_info[3] == 'Ultra') {
      skill_multiplier = skill_multiplier + 1
    }
  }
  let Ultra_Use = skilldict[String(data.avatarId)].Ultra_Use
  attribute_bonus = weapon_ability(data.equipment, Ultra_Use, base_attr, attribute_bonus)
  logger.mark('attribute_bonus：', attribute_bonus)
  let relic_sets = data.relic_sets
  if (relic_sets.length > 0) {
    for (let i = 0; i < relic_sets.length; i++) {
      attribute_bonus = relice_ability(relic_sets[i], base_attr, attribute_bonus)
    }
  }
  logger.mark('attribute_bonus：', attribute_bonus)
  let attribute_attrkey = Object.keys(attribute_bonus)
  for (let i = 0; i < attribute_attrkey.length; i++) {
    let attr = attribute_attrkey[i]
    if (attr.search('AttackAddedRatio') != -1) {
      let skill_name = attr.split('AttackAddedRatio')[0]
      if ([skill_type, skill_info[3]].includes(skill_name)) {
        let attack_added_ratio = get_let_value(attribute_bonus, 'AttackAddedRatio')
        attribute_bonus.AttackAddedRatio =
                    attack_added_ratio + attribute_bonus[attr]
      }
    }
    if (attr.search('StatusProbabilityBase') != -1) {
      let skill_name = attr.split('StatusProbabilityBase')[0]
      if ([skill_type, skill_info[3]].includes(skill_name)) {
        let status_probability = get_let_value(attribute_bonus, 'StatusProbabilityBase')
        attribute_bonus.StatusProbabilityBase =
                    status_probability + attribute_bonus[attr]
      }
    }
  }
  let merged_attr = merge_attribute(base_attr, attribute_bonus)
  logger.mark('merged_attr：', merged_attr)
  let skill_list = {}
  let damage = 0
  let damage_qw = 0
  let damage_cd_z = 0
  let damage_qw_z = 0
  if (skill_info[0] == 'attack') {
    let attack = merged_attr.attack
    if (String(data.avatarId) == '1004') {
      if (data.rank >= 6 && skill_type == 'BPSkill') {
        skill_info[2] = skill_info[2] + 1
      }
      let multiplier_add = getskilllevelnum(String(data.avatarId), data.behaviorList, 'talent', 'Talent')
      skill_multiplier = skill_multiplier + multiplier_add
    }
    if (String(data.avatarId) == '1201' &&
            data.rank >= 4 &&
            skill_type == 'Normal') {
      skill_info[2] = skill_info[2] + 1
    }
    let damage_add = 0
    let hp_multiplier = 0
    let hp_num = 0
    if (['1205', '1208'].includes(String(data.avatarId))) {
      hp_num = merged_attr.hp
      if (skill_type == 'Normal') {
        if (String(data.avatarId) == '1208') {
          hp_multiplier = getskilllevelnum(String(data.avatarId), data.behaviorList, 'basic_atk', 'Normal_HP')
        }
      } else if (skill_type == 'Normal1') {
        hp_multiplier = getskilllevelnum(String(data.avatarId), data.behaviorList, 'basic_atk', 'Normal1_HP')
        skill_type = 'Normal'
      } else if (skill_type == 'Ultra') {
        hp_multiplier = getskilllevelnum(String(data.avatarId), data.behaviorList, 'ultimate', 'Ultra_HP')
        if (data.rank >= 1 && String(data.avatarId) == '1205') {
          hp_multiplier += 0.9
        }
        if (data.rank >= 6 && String(data.avatarId) == '1208') {
          hp_multiplier += 1.2
        }
      } else if (skill_type == 'Talent') {
        hp_multiplier = getskilllevelnum(String(data.avatarId), data.behaviorList, 'talent', 'Talent_HP')
        if (data.rank >= 6 && String(data.avatarId) == '1205') {
          damage_add = hp_num * 0.5
        }
      } else {
        hp_multiplier = 0
      }
      attack = skill_multiplier * attack + hp_multiplier * hp_num
      skill_multiplier = 1
    }
    skill_multiplier = skill_multiplier / skill_info[2]
    let enemy_damage_reduction = 0.1
    let damage_reduction = 1 - enemy_damage_reduction
    let enemy_status_resistance = 0.0
    let merged_attrkey = Object.keys(merged_attr)
    for (let i = 0; i < merged_attrkey.length; i++) {
      let attr = merged_attrkey[i]
      if (attr.search('ResistancePenetration') != -1) {
        let attr_name = attr.replace('ResistancePenetration', '')
        if ([data.damage_type, 'AllDamage'].includes(attr_name)) {
          enemy_status_resistance = enemy_status_resistance + merged_attr[attr]
        }
        if (attr_name.search('_') != -1) {
          let skill_name = attr_name.split('_')[0]
          let skillattr_name = attr_name.split('_')[1]
          if ([skill_type, skill_info[3]].includes(skill_name) && [data.damage_type, 'AllDamage'].includes(skillattr_name)) {
            enemy_status_resistance =
                            enemy_status_resistance + merged_attr[attr]
          }
        }
      }
    }
    let resistance_area = 1.0 - (0 - enemy_status_resistance)
    let ignore_defence = 1.0
    if (merged_attr.ignore_defence) {
      ignore_defence = 1 - merged_attr.ignore_defence
    }
    let enemy_defence = (data.level * 10 + 200) * ignore_defence
    let defence_multiplier = (data.level * 10 + 200) / (data.level * 10 + 200 + enemy_defence)
    let injury_area = 0.0
    for (let i = 0; i < merged_attrkey.length; i++) {
      let attr = merged_attrkey[i]
      if (attr.search('DmgAdd') != -1) {
        let attr_name = attr.split('DmgAdd')[0]
        if ([skill_type, skill_info[3]].includes(attr_name)) {
          logger.mark(attr + '对' + attr_name + '有' + merged_attr[attr] + '增伤')
          injury_area = injury_area + merged_attr[attr]
        }
      }
      if (attr.search('AddedRatio') != -1) {
        let attr_name = attr.split('AddedRatio')[0]
        if ([data.damage_type, 'AllDamage'].includes(attr_name)) {
          logger.mark(attr + '对' + attr_name + '有' + merged_attr[attr] + '增伤')
          injury_area = injury_area + merged_attr[attr]
        }
      }
    }
    injury_area = injury_area + 1
    logger.mark('增伤：', injury_area)
    let damage_ratio = get_let_value(merged_attr, 'DmgRatio')
    for (let i = 0; i < merged_attrkey.length; i++) {
      let attr = merged_attrkey[i]
      if (attr.search('_DmgRatio') != -1) {
        let attr_name = attr.split('_')[0]
        if ([skill_type, skill_info[3]].includes(attr_name)) {
          logger.mark(attr + '对' + attr_name + '有' + merged_attr[attr] + '易伤加成')
          damage_ratio = damage_ratio + merged_attr[attr]
        }
      }
    }
    damage_ratio = damage_ratio + 1
    logger.mark('易伤：', damage_ratio)
    let critical_damage_base = 0.0
    if (skill_type != 'DOT') {
      critical_damage_base = get_let_value(merged_attr, 'CriticalDamageBase')
      for (let i = 0; i < merged_attrkey.length; i++) {
        let attr = merged_attrkey[i]
        if (attr.search('_CriticalDamageBase') != -1) {
          let skill_name = attr.split('_')[0]
          if ([skill_type, skill_info[3]].includes(skill_name)) {
            logger.mark(attr + '对' + skill_name + '有' + merged_attr[attr] + '爆伤加成')
            critical_damage_base = critical_damage_base + merged_attr[attr]
          }
        }
      }
    }
    let critical_damage = critical_damage_base + 1
    logger.mark('爆伤: ', critical_damage)
    let critical_chance_base = merged_attr.CriticalChanceBase
    for (let i = 0; i < merged_attrkey.length; i++) {
      let attr = merged_attrkey[i]
      if (attr.search('_CriticalChance') != -1) {
        let skill_name = attr.split('_')[0]
        if ([skill_type, skill_info[3]].includes(skill_name)) {
          critical_chance_base = critical_chance_base + merged_attr[attr]
        }
      }
    }
    critical_chance_base = Math.min(1, critical_chance_base)
    let qiwang_damage = critical_chance_base * critical_damage_base + 1
    for (let i = 1; i <= skill_info[2]; i++) {
      let injury_add = 0
      let critical_damage_add = 0
      if (String(data.avatarId) == '1213') {
        injury_add = getskilllevelnum(String(data.avatarId), data.behaviorList, 'talent', 'Talent')
        critical_damage_add = getskilllevelnum(String(data.avatarId), data.behaviorList, 'skill', 'BPSkill')
        let normal_buff = get_let_value(merged_attr, 'Normal_buff')
        if (i >= 4) {
          normal_buff = Math.min(4, normal_buff + (i - 3))
        }
        if (normal_buff >= 1) {
          critical_damage_add = normal_buff * critical_damage_add
        }
        let atk_buff = get_let_value(merged_attr, 'Atk_buff')
        atk_buff = Math.min(10, (i - 1) * (atk_buff + 1))
        injury_add = atk_buff * injury_add
        qiwang_damage =
                    critical_chance_base * (critical_damage_base + critical_damage_add) +
                        1
      }
      damage =
                attack *
                    skill_multiplier *
                    damage_ratio *
                    (injury_area + injury_add) *
                    defence_multiplier *
                    resistance_area *
                    damage_reduction *
                    (critical_damage + critical_damage_add) +
                    damage_add
      damage_cd_z = damage_cd_z + damage
      damage_qw =
                attack *
                    skill_multiplier *
                    damage_ratio *
                    (injury_area + injury_add) *
                    defence_multiplier *
                    resistance_area *
                    damage_reduction *
                    qiwang_damage +
                    damage_add
      damage_qw_z = damage_qw_z + damage_qw
      logger.mark('第' + String(i) + '段伤害' + damage)
    }
    if (String(data.avatarId) == '1003' && data.rank >= 6) {
      damage_cd_z = damage_cd_z * 1.8
      damage_qw_z = damage_qw_z * 1.8
    }
    skill_list.name = skill_info[1]
    skill_list.damage = damage_cd_z
    skill_list.damage_qw = damage_qw_z
  }
  let damages = {
    title: skill_info[1],
    value: {
      expect: damage_qw_z,
      critical: damage_cd_z
    }
  }
  return damages
}
function merge_attribute (base_attr, attribute_bonus) {
  let merged_attr = {}
  let attribute_bonuskey = Object.keys(attribute_bonus)
  for (let i = 0; i < attribute_bonuskey.length; i++) {
    if (attribute_bonuskey[i].search('Attack') != -1 ||
            attribute_bonuskey[i].search('Defence') != -1 ||
            attribute_bonuskey[i].search('HP') != -1 ||
            attribute_bonuskey[i].search('Speed') != -1) {
      continue
    } else if (attribute_bonuskey[i].search('Base') != -1) {
      merged_attr[attribute_bonuskey[i]] =
                get_let_value(base_attr, attribute_bonuskey[i]) +
                    get_let_value(attribute_bonus, attribute_bonuskey[i])
    } else {
      merged_attr[attribute_bonuskey[i]] = get_let_value(attribute_bonus, attribute_bonuskey[i])
    }
  }
  merged_attr.hp =
        get_let_value(attribute_bonus, 'HPDelta') +
            get_let_value(base_attr, 'hp') *
                (get_let_value(attribute_bonus, 'HPAddedRatio') + 1)
  merged_attr.attack =
        get_let_value(attribute_bonus, 'AttackDelta') +
            get_let_value(base_attr, 'attack') *
                (get_let_value(attribute_bonus, 'AttackAddedRatio') + 1)
  merged_attr.defence =
        get_let_value(attribute_bonus, 'DefenceDelta') +
            get_let_value(base_attr, 'defence') *
                (get_let_value(attribute_bonus, 'DefenceAddedRatio') + 1)
  merged_attr.speed =
        get_let_value(attribute_bonus, 'SpeedDelta') +
            get_let_value(base_attr, 'speed') *
                (get_let_value(attribute_bonus, 'SpeedAddedRatio') + 1)
  merged_attr.CriticalChanceBase =
        get_let_value(base_attr, 'CriticalChanceBase') +
            get_let_value(attribute_bonus, 'CriticalChanceBase')
  merged_attr.CriticalDamageBase =
        get_let_value(base_attr, 'CriticalDamageBase') +
            get_let_value(attribute_bonus, 'CriticalDamageBase')
  return merged_attr
}
function get_base_attr (attributes) {
  let base_attr = {}
  base_attr.hp = attributes.hpBase
  base_attr.attack = attributes.attackBase
  base_attr.defence = attributes.defenseBase
  base_attr.CriticalChanceBase = 0.05
  base_attr.CriticalDamageBase = 0.5
  base_attr.speed = attributes.speedBase
  return base_attr
}
function get_attribute_bonus (data) {
  let attribute_bonus = {}
  let relics = data.relics
  relics.forEach((relic, _) => {
    let properties_name = relic.main_affix_tag
    let properties_value = relic.main_affix_value
    attribute_bonus[properties_name] =
            get_let_value(attribute_bonus, properties_name) + properties_value
    let sub_affix = relic.sub_affix_id
    sub_affix.forEach((sub_info, j) => {
      let properties_name = sub_info.tag
      let properties_value = sub_info.value
      attribute_bonus[properties_name] =
                get_let_value(attribute_bonus, properties_name) + properties_value
    })
  })
  let skilllist = data.skillTree
  skilllist.forEach((behavior, i) => {
    if (behavior.level == 1 &&
			data.avatarId in char_dict &&
            behavior.id in char_dict[data.avatarId] &&
            char_dict[data.avatarId][behavior.id].levels[0].properties[0]) {
      // logger.mark(char_dict[data.avatarId][behavior.id].levels[0].properties[0])
      // logger.mark(behavior)
      let properties_name = char_dict[data.avatarId][behavior.id].levels[0].properties[0].type
      // logger.mark('properties_name：', properties_name)
      let properties_value = char_dict[data.avatarId][behavior.id].levels[0].properties[0].value
      // logger.mark('properties_value：', properties_value)
      attribute_bonus[properties_name] =
				get_let_value(attribute_bonus, properties_name) + properties_value
    }
  })
  if (data.equipment.id) {
    let equipattr = equipment_dict[data.equipment.id][data.equipment.rank]
    for (let i = 0; i < equipattr.length; i++) {
      let properties_name = equipattr[i].PropertyType
      let properties_value = equipattr[i].Value.Value
      attribute_bonus[properties_name] =
          get_let_value(attribute_bonus, properties_name) + properties_value
    }
  }
  let relic_sets = data.relic_sets
  if (relic_sets) {
    for (let i = 0; i < relic_sets.length; i++) {
      let set_num = relic_sets[i].set_name.split('件套')[0]
      if (relicsetskill[relic_sets[i].set_id][set_num].Property) {
        let properties_name = relicsetskill[relic_sets[i].set_id][set_num].Property
        let properties_value = relicsetskill[relic_sets[i].set_id][set_num].Value
        attribute_bonus[properties_name] = get_let_value(attribute_bonus, properties_name) + properties_value
      }
    }
  }

  return attribute_bonus
}
function get_let_value (let_list, name) {
  if (let_list[name]) {
    return let_list[name]
  }
  return 0
}
function getskilllevelnum (avatarId, skills, leveltype, skilltype) {
  let skilllevel = 1
  if (leveltype == 'basic_atk') {
    skilllevel = skills[0].level
  } else if (leveltype == 'skill') {
    skilllevel = skills[1].level
  } else if (leveltype == 'ultimate') {
    skilllevel = skills[2].level
  } else if (leveltype == 'talent') {
    skilllevel = skills[3].level
  }
  return skilldict[avatarId][skilltype][skilllevel - 1]
}
