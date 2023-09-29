/* eslint-disable camelcase */
import fs from 'fs'
import _ from 'lodash'
import fetch from 'node-fetch'
import runtimeRender from '../common/runtimeRender.js'
import MysSRApi from '../runtime/MysSRApi.js'
import panelApi from '../runtime/PanelApi.js'
import alias from '../utils/alias.js'
import weapon_ability from './damage/weapon.js'
import avatar_ability from './damage/avatar.js'
import relice_ability from './damage/relice.js'
import { getSign } from '../utils/auth.js'
import { getCk, rulePrefix } from '../utils/common.js'
import { pluginResources, pluginRoot } from '../utils/path.js'
import setting from '../utils/setting.js'
import moment from 'moment'

// 引入技能数值
const skilldictData = readJson('resources/panel/data/SkillData.json')
// 引入遗器地址数据
const relicsPathData = readJson('resources/panel/data/relics.json')
// 引入角色数据
const charData = readJson('resources/panel/data/character.json')
// 引入技能树位置
const skillTreeData = readJson('resources/panel/data/skillTree.json')
// 技能树背景图
const skillTreeImgBaseURL = 'panel/resources/skill_tree/'
const skillTreeImg = {
  存护: `${skillTreeImgBaseURL}Knight.svg`,
  智识: `${skillTreeImgBaseURL}Mage.svg`,
  丰饶: `${skillTreeImgBaseURL}Priest.svg`,
  巡猎: `${skillTreeImgBaseURL}Rogue.svg`,
  毁灭: `${skillTreeImgBaseURL}Warrior.svg`,
  同谐: `${skillTreeImgBaseURL}Shaman.svg`,
  虚无: `${skillTreeImgBaseURL}Warlock.svg`
}

export class Panel extends plugin {
  constructor (e) {
    super({
      name: '星铁plugin-面板',
      dsc: '星穹铁道面板信息',
      /** https://oicqjs.github.io/oicq/#events */
      event: 'message',
      priority: 1,
      rule: [
        {
          reg: `^${rulePrefix}(.+)面板(更新)?(.*)`,
          fnc: 'panel'
        },
        {
          reg: `^${rulePrefix}面板(列表)?$`,
          fnc: 'plmb'
        },
        {
          reg: `^${rulePrefix}(更新面板|面板更新)(.*)`,
          fnc: 'update'
        },
        {
          reg: `^${rulePrefix}(设置|切换)面板(API|api)?`,
          fnc: 'changeApi'
        },
        {
          reg: `^${rulePrefix}(API|api)列表$`,
          fnc: 'apiList'
        },
        {
          reg: '^#?原图$',
          fnc: 'origImg'
        }
      ]
    })
  }

  async panel (e) {
    let user = this.e.user_id
    let ats = e.message.filter(m => m.type === 'at')
    const messageText = e.msg
    let messageReg = new RegExp(`^${rulePrefix}(.+)面板(更新)?`)
    const matchResult = messageText.match(messageReg)
    const charName = matchResult ? matchResult[4] : null
    if (!charName) return await this.plmb(e)
    if (charName === '更新' || matchResult[5]) return false
    if (charName === '切换' || charName === '设置') return await this.changeApi(e)
    if (charName.includes('参考')) return false
    let uid = messageText.replace(messageReg, '')
    if (!uid) {
      if (ats.length > 0 && !e.atBot) {
        user = ats[0].qq
      }
      await this.miYoSummerGetUid()
      uid = await redis.get(`STAR_RAILWAY:UID:${user}`)
    }
    if (!uid) {
      return await e.reply('尚未绑定uid,请发送#星铁绑定uid进行绑定')
    }
    // await e.reply('正在获取面板数据中')
    try {
      const api = await panelApi()
      let data = await this.getCharData(charName, uid, e)
      data.uid = uid
      data.api = api.split('/')[2]
      data.charpath = charData[data.avatarId].path
      data.relics.forEach((item, i) => {
        data.relics[i].path = relicsPathData[item.id]?.icon
      })
      // 行迹
      data.skillTreeBkg = skillTreeImg[data.charpath]
      data.skillTree = this.handleSkillTree(data.behaviorList, data.charpath)
	  data.skilllist = _.cloneDeep(data.behaviorList)
      data.behaviorList = this.handleBehaviorList(data.behaviorList)
      // 面板图
      data.charImage = this.getCharImage(data.name, data.avatarId)
      
	  // 伤害
	  if (String(data.avatarId) == '1102' && String(data.equipment.id) == '23001') {
		data.damages = this.getdamages(data)
	  }
	  logger.mark('damages：', data.damages)
      logger.debug(`${e.logFnc} 面板图:`, data.charImage)
      let msgId = await runtimeRender(
        e,
        '/panel/new_panel.html',
        data,
        {
          retType: 'msgId',
          scale: 1.6
        }
      )
      msgId &&
        redis.setEx(
          `STAR_RAILWAY:panelOrigImg:${msgId.message_id}`,
          60 * 60,
          data.charImage
        )
    } catch (error) {
      logger.error('SR-panelApi', error)
      return await e.reply(error.message)
    }
  }
  
  /** 处理伤害技能 */
  getdamages (data) {
	var damage_list = []
	if (String(data.avatarId) == '1102') {
	  var skills = ['Normal','BPSkill','Ultra']
	}
	for (let i = 0; i < skills.length; i++){
	  let skill_list = this.getdamages_num(skills[i], data)
	  damage_list.push(skill_list)
	}
	return damage_list
  }
  
  
  /** 处理伤害 */
  getdamages_num(skill_type, data) {
	  let base_attr = this.get_base_attr(data.properties)
	  let attribute_bonus = this.get_attribute_bonus(data)
	  logger.mark('base_attr：', base_attr)
	  logger.mark('attribute_bonus：', attribute_bonus)
	  /** 天赋星魂区 */
	  logger.mark('检查战斗生效的天赋星魂')
	  attribute_bonus = avatar_ability(data, base_attr, attribute_bonus)
	  /** 技能区 */
	  let skill_info = skilldictData[data.avatarId]['skillList'][skill_type]
	  logger.mark('技能类型：', skill_info[1])
	  if(skill_type == 'Normal'){
		  var skill_multiplier = getskilllevelnum(data.avatarId, data.behaviorList, 'basic_atk', skill_info[3])
	  }else if(skill_type == 'BPSkill'){
		  var skill_multiplier = getskilllevelnum(data.avatarId, data.behaviorList, 'skill', skill_info[3])
	  }else if(skill_type == 'Ultra'){
		  var skill_multiplier = getskilllevelnum(data.avatarId, data.behaviorList, 'ultimate', skill_info[3])
	  }else if(skill_type == 'Talent'){
		  var skill_multiplier = getskilllevelnum(data.avatarId, data.behaviorList, 'talent', skill_info[3])
	  }
	  logger.mark('技能区：', skill_multiplier)
	  
	  /** 战斗buff区 */
      logger.mark('检查武器战斗生效的buff')
      var Ultra_Use = skilldictData[data.avatarId]['Ultra_Use']
      attribute_bonus = weapon_ability(data.equipment, Ultra_Use, base_attr, attribute_bonus)
	  
	  logger.mark('检查遗器战斗生效的buff')
	  let relic_sets = data.relic_sets
	  if(relic_sets.length > 0){
		  for (let i = 0; i < relic_sets.length; i++){
			  attribute_bonus = relice_ability(relic_sets[i], base_attr, attribute_bonus)
		  }
	  }
	  logger.mark(attribute_bonus)
	  
	  /** 属性计算 */
	  let merged_attr = this.merge_attribute(base_attr, attribute_bonus)
	  logger.mark('merged_attr：', merged_attr)
	  let skill_list = {}
	  if(skill_info[0] == 'attack'){
		var attack = merged_attr['attack']
		logger.mark('攻击力: ', attack)
		/** 模拟 同属性弱点 同等级 的怪物 */
		/** 韧性条减伤 */
		var enemy_damage_reduction = 0.1
		var damage_reduction = 1 - enemy_damage_reduction
		logger.mark('韧性区: ', damage_reduction)
		/** 抗性区 */
		var enemy_status_resistance = 0.0
		var merged_attrkey = Object.keys(merged_attr)
		for (let i = 0; i < merged_attrkey.length; i++){
			var attr = merged_attrkey[i]
			if (attr.search("ResistancePenetration") != -1){
				/** 检查是否有某一属性的抗性穿透 */
				var attr_name = attr.replace('ResistancePenetration', '')
				if (attr_name.search(data.damage_type) != -1 || attr_name.search("AllDamage") != -1){
					logger.mark(attr_name + '属性' + merged_attr[attr] + '穿透加成')
					enemy_status_resistance = enemy_status_resistance + merged_attr[attr]
				}
				/** 检查是否有某一技能属性的抗性穿透 */
				if (attr_name.search('_') != -1){
					var skill_name = attr_name.split('_')[0]
					var skillattr_name = attr_name.split('_')[1]
					if((skill_name.search(skill_type) != -1 || skill_name.search(skill_info[3]) != -1) && (skillattr_name.search(data.damage_type) != -1 || skillattr_name.search('AllDamage') != -1)){
						enemy_status_resistance = enemy_status_resistance + merged_attr[attr]
						logger.mark(skill_name + '对' + skillattr_name + '属性有' + merged_attr[attr] + '穿透加成')
					}
				}
			}
		}
		var resistance_area = 1.0 - (0 - enemy_status_resistance)
		logger.mark('抗性区: ', resistance_area)
		
		/** 防御区 */
		/** 检查是否有 ignore_defence */
		logger.mark('检查是否有 ignore_defence')
		var ignore_defence = 1.0
		if(merged_attr['ignore_defence']){
			ignore_defence = 1 - merged_attr['ignore_defence']
		}
		logger.mark('ignore_defence: ', ignore_defence)
		var enemy_defence = (data.level * 10 + 200) * ignore_defence
		var defence_multiplier = (data.level * 10 + 200) / (data.level * 10 + 200 + enemy_defence)
		logger.mark('防御区: ', defence_multiplier)
		
		/** 增伤区 */
		logger.mark('检查是否有对某一个技能的伤害加成')
		var injury_area = 0.0
		var element_area = 0.0
		for (let i = 0; i < merged_attrkey.length; i++){
			var attr = merged_attrkey[i]
			/** 检查是否有对某一个技能的伤害加成 */
			if (attr.search("DmgAdd") != -1){
				var attr_name = attr.split('DmgAdd')[0]
				if (attr_name.search(skill_type) != -1 || attr_name.search(skill_info[3]) != -1){
					logger.mark(attr + '对' + skill_type + '有' + merged_attr[attr] + '伤害加成')
					injury_area = injury_area + merged_attr[attr]
				}
			}
			/** 检查有无符合属性的伤害加成 */
			if (attr.search("AddedRatio") != -1){
				var attr_name = attr.split('AddedRatio')[0]
				if (attr_name.search(data.damage_type) != -1 || attr_name.search("AllDamage") != -1){
					logger.mark(attr + '对' + data.damage_type + '有' + merged_attr[attr] + '伤害加成')
					injury_area = injury_area + merged_attr[attr]
				}
			}
		}
		injury_area = injury_area + 1
		logger.mark('增伤区: ', injury_area)
		
		/** 易伤区 */
		logger.mark('检查是否有易伤加成')
		var damage_ratio = this.get_let_value(merged_attr, 'DmgRatio')
		/** 检查是否有对特定技能的易伤加成 */
		for (let i = 0; i < merged_attrkey.length; i++){
			var attr = merged_attrkey[i]
			if (attr.search("_DmgRatio") != -1){
				var attr_name = attr.split('_')[0]
				if (attr_name.search(skill_type) != -1 || attr_name.search(skill_info[3]) != -1){
					logger.mark(attr + '对' + skill_type + '有' + merged_attr[attr] + '易伤加成')
					damage_ratio = damage_ratio + merged_attr[attr]
				}
			}
		}
		damage_ratio = damage_ratio + 1
		logger.info('易伤: ', damage_ratio)
		
		/** 爆伤区 */
		if (skill_type == 'DOT'){
			var critical_damage_base = 0.0
		}
		else{
			logger.mark('检查是否有爆伤加成')
			var critical_damage_base = this.get_let_value(merged_attr, 'CriticalDamageBase')
			/** 检查是否有对特定技能的爆伤加成 */
			for (let i = 0; i < merged_attrkey.length; i++){
				var attr = merged_attrkey[i]
				if (attr.search("_CriticalDamageBase") != -1){
					var skill_name = attr.split('_')[0]
					if (skill_name.search(skill_type) != -1 || skill_name.search(skill_info[3]) != -1){
						logger.mark(attr + '对' + skill_type + '有' + merged_attr[attr] + '爆伤加成')
						critical_damage_base = critical_damage_base + merged_attr[attr]
					}
				}
			}
		}
		var critical_damage = critical_damage_base + 1
		logger.mark('暴伤: ', critical_damage)
		
		/** 暴击区 */
		logger.mark('检查是否有暴击加成')
		var critical_chance_base = merged_attr['CriticalChanceBase']
		/** 检查是否有对特定技能的暴击加成 */
		for (let i = 0; i < merged_attrkey.length; i++){
			var attr = merged_attrkey[i]
			if (attr.search("_CriticalChance") != -1){
				var skill_name = attr.split('_')[0]
				if (skill_name.search(skill_type) != -1 || skill_name.search(skill_info[3]) != -1){
					logger.mark(attr + '对' + skill_type + '有' + merged_attr[attr] + '暴击加成')
					critical_chance_base = critical_chance_base + merged_attr[attr]
				}
			}
		}
		critical_chance_base = Math.min(1, critical_chance_base)
		logger.mark('暴击: ', critical_chance_base)
		
		/** 期望伤害 */
		var qiwang_damage = (critical_chance_base * critical_damage_base) + 1
		logger.mark('暴击期望: ', qiwang_damage)
		var damage = attack * skill_multiplier * damage_ratio * injury_area * defence_multiplier * resistance_area * damage_reduction * critical_damage
		var damage_qw = attack * skill_multiplier * damage_ratio * injury_area * defence_multiplier * resistance_area * damage_reduction * qiwang_damage
		logger.mark(skill_info[1] + '暴击伤害: ' + damage + ' 期望伤害：' + damage_qw)
		
		skill_list['name'] = skill_info[1]
		skill_list['damage'] = damage
		skill_list['damage_qw'] = damage_qw
	  }
	  return skill_list
  }
  
  merge_attribute(base_attr, attribute_bonus){
	  let merged_attr = {}
	  var attr_list = ['attack', 'defence', 'hp', 'speed']
	  var attribute_bonuskey = Object.keys(attribute_bonus)
	  for (let i = 0; i < attribute_bonuskey.length; i++){
		  if(attribute_bonuskey[i].search("Attack") != -1 || attribute_bonuskey[i].search("Defence") != -1 || attribute_bonuskey[i].search("HP") != -1 || attribute_bonuskey[i].search("Speed") != -1){
			  if(attribute_bonuskey[i].search("Delta") != -1){
				var attr = attribute_bonuskey[i].replace('Delta', '').toLowerCase()
				if(attr_list.includes(attr)){
					var attr_value = this.get_let_value(merged_attr, attr)
					merged_attr[attr] = attr_value + this.get_let_value(attribute_bonus, attribute_bonuskey[i])
				}
			  }else if(attribute_bonuskey[i].search("AddedRatio") != -1){
				var attr = attribute_bonuskey[i].replace('AddedRatio', '').toLowerCase()
				if(attr_list.includes(attr)){
					var attr_value = this.get_let_value(merged_attr, attr)
					merged_attr[attr] = attr_value + base_attr[attr] * (1 + this.get_let_value(attribute_bonus, attribute_bonuskey[i]))
				}
			  }
		  }else if(attribute_bonuskey[i].search("Base") != -1){
			  merged_attr[attribute_bonuskey[i]] = this.get_let_value(base_attr, attribute_bonuskey[i]) + this.get_let_value(attribute_bonus, attribute_bonuskey[i])
		  }else{
			  merged_attr[attribute_bonuskey[i]] = this.get_let_value(attribute_bonus, attribute_bonuskey[i])
		  }
	  }
	  return merged_attr
  }
  
  /** 处理基础属性 */
  get_base_attr(properties){
	  let base_attr = {}
	  /** 生命 */
	  base_attr['hp'] = properties.hpBase
	  /** 攻击 */
	  base_attr['attack'] = properties.attackBase
	  /** 防御 */
	  base_attr['defence'] = properties.defenseBase
	  /** 暴击 */
	  base_attr['CriticalChanceBase'] = 0.05
	  /** 爆伤 */
	  base_attr['CriticalDamageBase'] = 0.5
	  /** 速度 */
	  base_attr['speed'] = properties.speedBase
	  return base_attr
  }
  
  /** 处理加成属性 */
  get_attribute_bonus(data){
	  let attribute_bonus = {}
	  /** 处理遗器属性 */
	  let relics = data.relics
	  relics.forEach((relic, i) => {
		  /** 处理遗器主属性 */
		  var properties_name = relic.main_affix_tag
		  var properties_value = relic.main_affix_value
		  attribute_bonus[properties_name] = this.get_let_value(attribute_bonus, properties_name) + properties_value
		  /** 处理遗器副属性 */
		  let sub_affix = relic.sub_affix_id
		  sub_affix.forEach((sub_info, j) => {
			/* logger.mark('sub_info：', sub_info) */
			var properties_name = sub_info.tag
			var properties_value = sub_info.value
			attribute_bonus[properties_name] = this.get_let_value(attribute_bonus, properties_name) + properties_value
		  })
	  })
	  /** 处理技能树属性 */
	  let skilllist = data.skilllist
	  skilllist.forEach((behavior, i) => {
		  /* logger.mark('behavior：', behavior) */
		  if(charData[data.avatarId]['skill_tree'][behavior.id]['levels']['1']['status_add']['property']){
			var properties_name = charData[data.avatarId]['skill_tree'][behavior.id]['levels']['1']['status_add']['property']
			var properties_value = charData[data.avatarId]['skill_tree'][behavior.id]['levels']['1']['status_add']['value']
			attribute_bonus[properties_name] = this.get_let_value(attribute_bonus, properties_name) + properties_value
		  }
	  })
	  /** 处理武器副属性 */
	  /** 找不到json位置写在战斗buff里了 */
	  return attribute_bonus
  }
  
  
  get_let_value(let_list, name){
	  if(let_list[name]){
		  return let_list[name]
	  }else{
		  return 0
	  }
  }
  
  /** 处理行迹 */
  handleBehaviorList (data) {
    let _data = _.cloneDeep(data)
    _data.splice(5)
    _data.forEach((item, i) => {
      const nameId = item.id.toString().slice(0, 4)
      let pathName = ''
      switch (i) {
        case 0:
          pathName = 'basic_atk'
          break
        case 1:
          pathName = 'skill'
          break
        case 2:
          pathName = 'ultimate'
          break
        case 3:
          pathName = 'talent'
          break
        case 4:
          pathName = 'technique'
          break
      }
      const filePath = nameId + '_' + pathName + '.png'
      _data[i].path = filePath
    })
    // 去除秘技
    return _data.filter(i => i.type != '秘技')
  }

  /** 处理技能树 */
  handleSkillTree (data, charpath) {
    let _data = _.cloneDeep(data)
    _data = _data.map(item => {
      return {
        ...item,
        position: skillTreeData[charpath][item.anchor]
      }
    })
    return _data
  }

  /** 获取面板图 */
  getCharImage (name, avatarId) {
    const folderPath = 'profile/normal-character/'
    const fullFolderPath = pluginResources + '/' + folderPath
    const folderPath1 = 'pro-file/pro-character/'
    const fullFolderPath1 = pluginResources + '/' + folderPath1
    const leadId = {
      星: [8002, 8004],
      穹: [8001, 8003]
    }
    _.forIn(leadId, (v, k) => {
      if (v.includes(avatarId)) name = k
    })
    this.config = setting.getConfig('PanelSetting')
    // 判断是否为群聊，并且群聊是否在限制名单中
    if (
      this.e.isGroup &&
      'no_profile' in this.config &&
      this.config.no_profile &&
      this.config.no_profile.includes(this.e.group_id)
    ) {
      // 返回默认图位置
      return `panel/resources/char_image/${avatarId}.png`
    }
    if (fs.existsSync(fullFolderPath1 + name) && Math.random() < 0.8) {
      return this.getRandomImage(folderPath1 + name)
    } else if (fs.existsSync(fullFolderPath + `${name}.webp`)) {
      return folderPath + `${name}.webp`
    } else if (fs.existsSync(fullFolderPath + name)) {
      return this.getRandomImage(folderPath + name)
    } else {
      // 返回默认图位置
      return `panel/resources/char_image/${avatarId}.png`
    }
  }

  /** 随机取文件夹图片 */
  getRandomImage (dirPath) {
    let _path = pluginResources + '/' + dirPath
    const files = fs.readdirSync(_path)
    const images = files.filter(file => {
      return /\.(jpg|png|webp)$/i.test(file)
    })
    const randomNum = Math.floor(Math.random() * images.length)
    return dirPath + '/' + images[randomNum]
  }

  async update (e) {
    let user = this.e.user_id
    let ats = e.message.filter(m => m.type === 'at')
    const messageText = e.msg
    const messageReg = new RegExp(`^${rulePrefix}(更新面板|面板更新)`)
    let uid = messageText.replace(messageReg, '')
    if (!uid) {
      if (ats.length > 0 && !e.atBot) {
        user = ats[0].qq
      }
      await this.miYoSummerGetUid()
      uid = await redis.get(`STAR_RAILWAY:UID:${user}`)
    }
    if (!uid) {
      return await e.reply('尚未绑定uid,请发送#星铁绑定uid进行绑定')
    }
    try {
      const api = await panelApi()
      const data = await this.getPanelData(uid, true)
      let renderData = {
        api: api.split('/')[2],
        uid,
        data,
        type: 'update'
      }
      // 渲染数据
      await renderCard(e, renderData)
      // await e.reply( '更新面板数据成功' );
      return false
    } catch (error) {
      logger.error('SR-panelApi', error)
      return await e.reply(error.message)
    }
  }

  // 查看API列表
  async apiList (e) {
    if (!e.isMaster) return await e.reply('仅限主人可以查看API列表')
    const apiConfig = setting.getConfig('panelApi')
    const defaultSelect = apiConfig.default
    const apiList = apiConfig.api
    let msg = 'API列表：\n'
    apiList.forEach((item, i) => {
      msg += `${i + 1}：${item.split('/')[2]}\n`
    })
    msg += `当前API：\n${defaultSelect}：${apiList[defaultSelect - 1].split('/')[2]}`
    await e.reply(msg)
  }

  // 切换API
  async changeApi (e) {
    if (!e.isMaster) return await e.reply('仅限主人可以切换API')
    const reg = /[1-9][0-9]*/g
    const match = reg.exec(e.msg)
    if (!match || match.length < 1) return await e.reply('请输入正确的API序号')
    let apiIndex = match[match.length - 1]
    try {
      apiIndex = parseInt(apiIndex) - 1
      // 获取API配置
      let apiConfig = setting.getConfig('panelApi')
      const apiList = apiConfig.api
      if (!apiList[apiIndex]) return await e.reply('请输入正确的API序号')
      apiConfig.default = apiIndex + 1
      setting.setConfig('panelApi', apiConfig)
      return await e.reply(
        `切换API成功，当前API：${apiList[apiIndex].split('/')[2]}`
      )
    } catch (error) {
      return await e.reply('切换API失败，请前往控制台查看报错！')
    }
  }

  /**
   * 获取角色数据
   * @param {string} name 角色名称
   * @param {number|string} uid 角色UID
   * @param e
   * @returns {Promise} 使用 try catch 捕获错误
   */
  async getCharData (name, uid, e) {
    const data = await this.getPanelData(uid, false, true)
    const charName = alias.get(name)
    const charInfo = data.filter(item => item.name === charName)[0]
    if (!charInfo) {
      const data = await this.getPanelData(uid, true)
      const charInfo = data.filter(item => item.name === charName)[0]
      if (!charInfo) {
        let realName = charName
        if (charName === false) {
          realName = name
        }
        throw Error(
          `未查询到uid：${uid} 角色：${realName} 的数据，请检查角色是否放在了助战或者展柜\n请检查角色名是否正确,已设置的会有延迟,等待一段时间后重试~`
        )
      }
      return charInfo
    }
    return charInfo
  }

  /**
   * 获取面板数据
   * @param {number|string} uid 角色UID
   * @param {boolean} isForce 是否强制更新数据
   * @returns {Promise} 使用 try catch 捕获错误
   */
  async getPanelData (uid, isForce = false, forceCache = false) {
    const timeKey = `STAR_RAILWAY:userPanelDataTime:${uid}`
    let previousData = await readData(uid)
    if ((previousData.length < 1 || isForce) && !forceCache) {
      logger.mark('SR-panelApi强制查询')
      await this.e.reply(`正在获取uid${uid}面板数据中~\n可能需要一段时间，请耐心等待`)
      try {
        logger.mark('SR-panelApi开始查询', uid)
        let time = await redis.get(timeKey)
        if (time) {
          time = parseInt(time)
          const leftTime = Date.now() - time
          if (leftTime < 1 * 60 * 1000) {
            const seconds = Math.ceil((1 * 60 * 1000 - leftTime) / 1000)
            throw Error(`查询过于频繁，请${seconds}秒后重试~`)
          }
        }
        const api = await panelApi()
        let res = null
        let cardData = null
        try {
          res = await fetch(api + uid, {
            headers: {
              'x-request-sr': getSign(uid),
              library: 'hewang1an'
            }
          })
          cardData = await res.json()
        } catch (error) {
          logger.error(error)
          throw Error(`UID:${uid}更新面板失败\n面板服务连接超时，请稍后重试`)
        }
        if (!res) throw Error(`UID:${uid}更新面板失败\n面板服务连接超时，请稍后重试`)
        // 设置查询时间
        await redis.setEx(timeKey, 360 * 60, Date.now().toString())
        if ('detail' in cardData) throw Error(cardData.detail)
        if (!('playerDetailInfo' in cardData)) {
          throw Error(`uid:${uid}未查询到任何数据`)
        }
        if (!cardData.playerDetailInfo.isDisplayAvatarList) {
          throw Error(`uid:${uid}更新面板失败\n可能是角色展柜未开启或者该用户不存在`)
        }
        const assistRole = cardData.playerDetailInfo.assistAvatar
        const displayRoles = cardData.playerDetailInfo.displayAvatars || []
        const findAssRoleInBehaRole = displayRoles.findIndex(
          item => item.avatarId === assistRole.avatarId
        )
        let characters = []
        if (findAssRoleInBehaRole != -1) {
          characters = displayRoles
        } else {
          characters = [assistRole, ...displayRoles]
        }
        const chars = await updateData(previousData, characters)
        saveData(uid, chars)
        return chars
      } catch (error) {
        throw Error(error)
      }
    } else {
      // logger.mark('SR-panelApi使用缓存')
      const cardData = previousData
      return cardData
    }
  }

  async plmb (e) {
    let user = this.e.user_id
    let ats = e.message.filter(m => m.type === 'at')
    if (ats.length > 0 && !e.atBot) {
      user = ats[0].qq
    }
    let uid = await redis.get(`STAR_RAILWAY:UID:${user}`)
    if (!uid) {
      return await e.reply('尚未绑定uid,请发送#星铁绑定uid进行绑定')
    }
    const api = await panelApi()
    const data = await this.getPanelData(uid, false)
    const lastUpdateTime = data.find(i => i.is_new && i.lastUpdateTime)?.lastUpdateTime
    let renderData = {
      api: api.split('/')[2],
      uid,
      data,
      time: moment(lastUpdateTime).format('YYYY-MM-DD HH:mm:ss dddd') ?? '该页数据为缓存数据，非最新数据'
    }
    // 渲染数据
    await renderCard(e, renderData)
  }

  async origImg (e) {
    if (!e.source) return false
    let source
    if (e.isGroup) {
      source = (await e.group.getChatHistory(e.source.seq, 1)).pop()
    } else {
      source = (await e.friend.getChatHistory(e.source.time, 1)).pop()
    }
    let ImgPath = await redis.get(
      `STAR_RAILWAY:panelOrigImg:${source.message_id}`
    )
    if (!ImgPath) return false
    let OP_setting = setting.getConfig('PanelSetting')
    if (OP_setting.originalPic || e.isMaster) {
      ImgPath = pluginResources + '/' + ImgPath
      if (!OP_setting.backCalloriginalPic) {
        // eslint-disable-next-line no-undef
        return e.reply(segment.image(ImgPath))
      } else {
        // eslint-disable-next-line no-undef
        return e.reply(segment.image(ImgPath), false, {
          recallMsg: OP_setting.backCalloriginalPicTime
        })
      }
    }
    return e.reply('星铁原图功能已关闭，如需开启请联系机器人主人')
  }

  /** 通过米游社获取UID */
  async miYoSummerGetUid () {
    let key = `STAR_RAILWAY:UID:${this.e.user_id}`
    let ck = getCk(this.e)
    if (!ck) return false
    if (await redis.get(key)) return false
    let api = new MysSRApi('', ck)
    let userData = await api.getData('srUser')
    if (!userData?.data || _.isEmpty(userData.data.list)) return false
    userData = userData.data.list[0]
    let { game_uid: gameUid } = userData
    await redis.set(key, gameUid)
    await redis.setEx(
      `STAR_RAILWAY:userData:${gameUid}`,
      60 * 60,
      JSON.stringify(userData)
    )
    return userData
  }
}
/**
 * 替换老数据
 * @param {Array} oldData 老数据
 * @param {Array} newData 新数据
 * @returns {Promise} 使用 try catch 捕获错误
 */
async function updateData (oldData, newData) {
  let returnData = oldData
  // logger.mark('SR-updateData', oldData, newData);
  const handle = (name) => {
    return name === '{nickname}' || name === '{NICKNAME}' ? '开拓者' : name
  }
  oldData.forEach((oldItem, i) => {
    oldData[i].name = handle(oldData[i].name)
    oldData[i].relics = oldItem.relics || []
    oldData[i].behaviorList = oldItem.behaviorList || []
    oldData[i].is_new = false
  })
  newData.forEach((newItem, i) => {
    newData[i].is_new = true
    newData[i].name = handle(newData[i].name)
    newData[i].relics = newItem.relics || []
    newData[i].behaviorList = newItem.behaviorList || []
    // 最后更新时间
    newData[i].lastUpdateTime = Date.now()
    returnData = returnData.filter(
      oldItem => oldItem.avatarId != newItem.avatarId
    )
  })
  returnData.unshift(...newData)
  return returnData
}

const dataDir = pluginRoot + '/data/panel'

function saveData (uid, data) {
  // 判断目录是否存在，不存在则创建
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }
  try {
    fs.writeFileSync(`${dataDir}/${uid}.json`, JSON.stringify(data, null, '\t'), 'utf-8')
    return true
  } catch (err) {
    logger.error('写入失败：', err)
    return false
  }
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

function readData (uid) {
  // 文件路径
  const filePath = `${dataDir}/${uid}.json`
  // 判断文件是否存在并读取文件
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath))
  } else {
    return []
  }
}
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

async function renderCard (e, data) {
  let renderData = {
    time: moment().format('YYYY-MM-DD HH:mm:ss dddd'),
    userName: e.sender.card || e.sender.nickname,
    ...data
  }
  await runtimeRender(e, '/panel/new_card.html', renderData, {
    escape: false,
    scale: 1.6
  })
}
