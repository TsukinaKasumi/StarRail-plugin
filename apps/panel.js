/* eslint-disable camelcase */
import fs from 'fs'
import _ from 'lodash'
import fetch from 'node-fetch'
import runtimeRender from '../common/runtimeRender.js'
import MysSRApi from '../runtime/MysSRApi.js'
import panelApi from '../runtime/PanelApi.js'
import alias from '../utils/alias.js'
import {getSign} from '../utils/auth.js'
import {getCk, rulePrefix} from '../utils/common.js'
import {pluginResources, pluginRoot} from '../utils/path.js'
import setting from '../utils/setting.js'
import moment from 'moment'
import {damage as damageCalculator} from '../utils/damage/main.js'
import {
  AvatarRankSkillUp,
  char_dict,
  skilldict,
  relicsetskill,
  equipment_dict
} from '../utils/damage/data/data.js'
import {avatar_ability} from '../utils/damage/effect/avatar.js'
import {weapon_ability} from '../utils/damage/effect/weapon.js'
import {relice_ability} from '../utils/damage/effect/relice.js'
import {detectAndRemapAvatar} from '../utils/panel/enhanced.js'
import {statNodeIcon} from '../utils/panel/affixData.js'
import {convertMysAvatarList} from '../utils/panel/mysConverter.js'
import {damageTypeToMiaoElem, scoreRelics} from '../utils/panel/relicScore.js'
import {getMiaoProfileTime, importMiaoPlayerData} from '../utils/panel/miaoSync.js'
import GsCfg from '../../genshin/model/gsCfg.js'
import NoteUser from '../../genshin/model/mys/NoteUser.js'
import cfg from '../../../lib/config/config.js'

// 引入遗器地址数据
const relicsPathData = readJson('resources/panel/data/relics.json')
// 引入角色数据
const charData = readJson('resources/panel/data/character.json')
// 引入技能树位置
const skillTreeData = readJson('resources/panel/data/skillTree.json')
// 技能树背景图（导出供测试消费：test/apps/panel-skilltree.test.js 校验映射与坐标完备性）
const skillTreeImgBaseURL = 'panel/resources/skill_tree/'
export const skillTreeImg = {
  存护: `${skillTreeImgBaseURL}Knight.svg`,
  智识: `${skillTreeImgBaseURL}Mage.svg`,
  丰饶: `${skillTreeImgBaseURL}Priest.svg`,
  巡猎: `${skillTreeImgBaseURL}Rogue.svg`,
  毁灭: `${skillTreeImgBaseURL}Warrior.svg`,
  同谐: `${skillTreeImgBaseURL}Shaman.svg`,
  虚无: `${skillTreeImgBaseURL}Warlock.svg`,
  // 记忆/欢愉：4.x 新命途，背景与坐标为本插件自建（Memory.svg/Joy.svg +
  // skillTree.json 同名键），风格对齐既有 7 命途
  记忆: `${skillTreeImgBaseURL}Memory.svg`,
  欢愉: `${skillTreeImgBaseURL}Joy.svg`
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
          reg: `^${rulePrefix}(?!米游社)(?!同步)(.+)面板(更新)?(.*)`,
          fnc: 'panel'
        },
        {
          reg: `^${rulePrefix}同步面板(更新)?$`,
          fnc: 'syncMiao'
        },
        {
          reg: `^${rulePrefix}面板(列表)?$`,
          fnc: 'plmb'
        },
        {
          // 米游社直连更新：仅收 * / ＊ 前缀（#星铁米游社更新面板 是 miao-plugin
          // 的既有命令，不使用 rulePrefix 抢占）
          reg: '^(\\*|＊)(米游社|mys)(更新面板|面板更新)(\\d{9,10})?$',
          fnc: 'mysUpdate'
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
    let user = this.e.user
    let ats = e.message.filter(m => m.type === 'at')
    const messageText = e.msg
    let messageReg = new RegExp(`^${rulePrefix}(.+)面板(更新)?`)
    const matchResult = messageText.match(messageReg)
    const charName = matchResult ? matchResult[4] : null
    if (!charName) return await this.plmb(e)
    if (charName === '更新' || matchResult[5]) return false
    if (charName === '切换' || charName === '设置') {
      return await this.changeApi(e)
    }
    if (charName.includes('参考')) return false
    let uid = messageText.replace(messageReg, '')
    if (!uid && cfg.package.name != 'yunzai') {
      if (ats.length > 0) {
        if (!e.atBot) {
          let { at = '' } = e
          user = await NoteUser.create(at)
        } else if (ats.length > 1) {
          for (let i = ats.length - 1; i >= 0; i--) {
            if (ats[i].qq != e.bot.uin &&
              ats[i].qq != e.bot.tiny_id) {
              let at = ats[i].qq
              user = await NoteUser.create(at)
              break
            }
          }
        }
      }
      await this.miYoSummerGetUid()
      uid = user?.getUid('sr') || ''
    }
    user = this.e.user_id
    if (!uid) {
      if (ats.length > 0) {
        if (!e.atBot) {
          user = ats[ats.length - 1].qq
        } else if (ats.length > 1) {
          for (let i = ats.length - 1; i >= 0; i--) {
            if (ats[i].qq != e.bot.uin &&
              ats[i].qq != e.bot.tiny_id) {
              user = ats[i].qq
              break
            }
          }
        }
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
      // 强化形态（2xxx）等静态数据未收录的角色降级渲染（charpath 为 undefined 时
      // 模板跳过命途文字与行迹画布，伤害计算同样按未收录降级），不中断整个面板查询
      data.charpath = charData[data.avatarId]?.path
      this.fixupRelicMeta(data.relics)
      // 遗器本地评分（avocado.wiki 服务端评分已死，缓存数据无分值）：
      // 就地覆盖 relic.score 与 sub_affix_id[i].weight，旧缓存残留的旧分值一并覆盖
      scoreRelics(data.avatarId, data.relics, {
        elem: damageTypeToMiaoElem[data.damage_type]
      })
      // 行迹画布背景与坐标（记忆/欢愉已自建；再往后的新命途在两者缺位时由
      // 模板 {{if skillTreeBkg}} 跳过行迹渲染、handleSkillTree 返回无坐标列表降级）
      data.skillTreeBkg = skillTreeImg[data.charpath]
      data.skillTree = this.handleSkillTree(data.behaviorList, data.charpath, data.avatarId)
      data.skilllist = _.cloneDeep(data.behaviorList)
      data.behaviorList = this.handleBehaviorList(data.behaviorList, data.avatarId, data.rank)
      // 面板图
      data.charImage = this.getCharImage(data.name, data.avatarId)

      // 伤害
      try {
        let damage = damageCalculator(data)
        if (damage) {
          data.damages = damage.damage
          logger.debug('damages：', data.damages.damage)
          // 欢愉度行：伤害计算可用（SkillData 已收录该角色）才计算展示；
          // 未收录角色 damage() 返回 null，不设置 joy，模板即不渲染该行
          // （优雅降级：不报错、不显示无意义的 0%）
          try {
            let joy = getJoyValue(data)
            // 欢愉命途角色展示该行（数值可为 0%）；非欢愉命途仅在确有欢愉词条时展示
            if (data.charpath === '欢愉' || joy > 0) {
              data.joy = joy
            }
          } catch (err) {
            logger.warn('欢愉度计算出错，不展示欢愉度', err)
          }
        }
      } catch (e) {
        logger.warn('伤害计算出错，不展示伤害')
      }
      logger.debug(`${e.logFnc} 面板图:`, data.charImage)
      let msgId = await runtimeRender(e, '/panel/new_panel.html', data, {
        retType: 'msgId',
        scale: 1.6
      })
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

  /**
   * 渲染前遗器静态元数据重解析（就地修补，仅影响本次渲染数据，不回写缓存）
   *
   * 旧缓存条目产生于 relics.json 未收录该 ID 的时期：转换器（miaoSync/mysConverter）
   * 当时把名称降级为「遗器{id}」烙进了缓存文件，icon 也取不到（path 为 undefined）。
   * 静态表补齐后，对这类条目用 relics.json 重新解析 name 与 icon；
   * name 正常的条目仅按表补 path（兼容 512x512 老图 / 128x128 新图混合的图标目录）。
   */
  fixupRelicMeta (relics) {
    if (!Array.isArray(relics)) return relics
    relics.forEach((item, i) => {
      const meta = relicsPathData[item.id]
      if (!meta) return
      if (!item.name || /^遗器\d+$/.test(item.name)) {
        relics[i].name = meta.name
      }
      item.path = meta.icon
    })
    return relics
  }

  /** 处理行迹 */
  handleBehaviorList (data, avatarId, rank) {
    let _data = _.cloneDeep(data)
    _data.splice(5)
    // 保留忆灵技/忆灵天赋（pointId 末三位 301/302）与欢愉技（420/421）条目：
    // 这些技能等级由伤害引擎按 pointId 末三位解析，前 5 项截断会导致等级回落默认值
    _.cloneDeep(data).slice(5).forEach((item) => {
      if (['301', '302', '420', '421'].includes(item.id.toString().slice(-3))) {
        _data.push(item)
      }
    })
    _data.forEach((item, i) => {
      const nameId = item.id.toString().slice(0, 4)
      // 星魂技能升级条目的 id 形如 角色IDx100+技能槽位（基础技能槽 001-009）；
      // 忆灵/欢愉技能位（301/302/420/421）没有两位压缩形态，直接用完整 pointId 匹配
      const slot = Number(item.id.toString().slice(-3))
      let Behaviorid = slot > 99
        ? item.id.toString()
        : (avatarId * 100 + slot).toString()
      for (let m = 1; m <= rank; m++) {
        let rankid = (avatarId * 100 + m).toString()
        let level_up_skill = AvatarRankSkillUp[rankid]
        if (level_up_skill) {
          for (let j = 0; j < level_up_skill.length; j++) {
            let skill_id = level_up_skill[j]['id']
            let skill_up_num = level_up_skill[j]['num']
            if (String(skill_id) == String(Behaviorid)) {
              let skilllevel = item.level + skill_up_num
              _data[i].level = skilllevel
            }
          }
        }
      }
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
      // 第 5 项之后仅保留的新命途扩展技能位：按 pointId 末三位取图标名
      // （StarRailRes 命名：忆灵技=_memosprite_skill、忆灵天赋=_memosprite_talent、欢愉技=_elation）
      if (i > 4) {
        const extraPathName = {
          '301': 'memosprite_skill',
          '302': 'memosprite_talent',
          '420': 'elation',
          '421': 'elation'
        }[item.id.toString().slice(-3)]
        if (extraPathName) {
          pathName = extraPathName
        }
      }
      const filePath = nameId + '_' + pathName + '.png'
      _data[i].path = filePath
    })
    // 去除秘技
    return _data.filter(i => i.type != '秘技')
  }

  /** 处理技能树 */
  handleSkillTree (data, charpath, avatarId) {
    let _data = _.cloneDeep(data)
    // skillTree.json 未收录的命途（未来新命途）：降级返回不带坐标的列表，
    // 配合 skillTreeBkg 缺失时模板跳过行迹渲染，不抛错
    if (!skillTreeData[charpath]) {
      return _data.map(item => {
        return {
          ...item,
          position: null
        }
      })
    }
    _data = _data.map(item => {
      return {
        ...item,
        // 属性小节点（Point09-18）游戏数据 icon 为空串：按 角色+槽位 查
        // skillTreeStats 补属性图标，旧缓存（avocado/miao 同步早期）无需重拉
        icon: item.icon ||
          statNodeIcon(avatarId, Number(item.id.toString().slice(-3))),
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
    // 强化形态（2xxx）暂无专属立绘资源，回退到原始形态（'2'+ID[1:] -> '1'+ID[1:]）
    // 的默认头像图，避免图片 404
    if (
      String(avatarId).startsWith('2') &&
      !fs.existsSync(
        `${pluginResources}/panel/resources/char_image/${avatarId}.png`
      )
    ) {
      avatarId = String(avatarId).replace(/^2/, '1')
    }
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
    let user = this.e.user
    let ats = e.message.filter(m => m.type === 'at')
    const messageText = e.msg
    const messageReg = new RegExp(`^${rulePrefix}(更新面板|面板更新)`)
    let uid = messageText.replace(messageReg, '')
    if (!uid && cfg.package.name != 'yunzai') {
      if (ats.length > 0) {
        if (!e.atBot) {
          let { at = '' } = e
          user = await NoteUser.create(at)
        } else if (ats.length > 1) {
          for (let i = ats.length - 1; i >= 0; i--) {
            if (ats[i].qq != e.bot.uin &&
              ats[i].qq != e.bot.tiny_id) {
              let at = ats[i].qq
              user = await NoteUser.create(at)
              break
            }
          }
        }
      }
      await this.miYoSummerGetUid()
      uid = user?.getUid('sr') || ''
    }
    user = this.e.user_id
    if (!uid) {
      if (ats.length > 0) {
        if (!e.atBot) {
          user = ats[ats.length - 1].qq
        } else if (ats.length > 1) {
          for (let i = ats.length - 1; i >= 0; i--) {
            if (ats[i].qq != e.bot.uin &&
              ats[i].qq != e.bot.tiny_id) {
              user = ats[i].qq
              break
            }
          }
        }
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
      // 顺带说明数据来源（米游社直连路径的回复已在 mysUpdate 内注明）
      await e.reply(`本次面板数据来源：${api.split('/')[2]}（三方面板服务）`)
      // await e.reply( '更新面板数据成功' );
      return false
    } catch (error) {
      logger.error('SR-panelApi', error)
      return await e.reply(error.message)
    }
  }

  /**
   * 米游社直连更新面板（*米游社更新面板）
   * 三方面板源（avocado/lulu/sr.roki）不可达时的直连兜底路径：
   * CK 鉴权调用 srCharacterDetail（只读的角色详情接口）→ mysConverter 转换
   * → updateData 合并缓存 → 渲染更新卡片
   */
  async mysUpdate (e) {
    let uid = e.msg.match(/\d{9,10}/)?.[0] || ''
    let user = this.e.user_id
    const ats = e.message.filter(m => m.type === 'at')
    if (!uid) {
      if (ats.length > 0 && !e.atBot) {
        user = ats[ats.length - 1].qq
      } else if (ats.length > 1) {
        for (let i = ats.length - 1; i >= 0; i--) {
          if (ats[i].qq != e.bot.uin && ats[i].qq != e.bot.tiny_id) {
            user = ats[i].qq
            break
          }
        }
      }
      if (cfg.package.name != 'yunzai') {
        try {
          const noteUser = await NoteUser.create(user)
          uid = noteUser?.getUid('sr') || ''
        } catch (err) {
          logger.debug('SR-panelApi mysUpdate NoteUser 取 uid 失败', err)
        }
      }
      if (!uid) {
        await this.miYoSummerGetUid()
        uid = await redis.get(`STAR_RAILWAY:UID:${user}`)
      }
    }
    if (!uid) {
      return await e.reply('尚未绑定uid,请发送#星铁绑定uid进行绑定')
    }
    // 国际服 uid 走海外域与国服 CK 不互通，明确提示回退三方面板源
    const serverPrefix = String(uid).slice(0, -8)
    if (['6', '7', '8', '9', '18'].includes(serverPrefix)) {
      return await e.reply(
        `UID:${uid} 为国际服uid，暂不支持米游社直连更新\n可尝试发送*更新面板（三方面板服务）`
      )
    }
    // CK：个人 CK 优先，无则回退公共 CK
    let ck = await getCk(e)
    if (!ck || Object.keys(ck).filter(k => ck[k].ck).length === 0) {
      const ckArr = GsCfg.getConfig('mys', 'pubCk') || []
      ck = ckArr[0]
    }
    if (!ck || !ck.ck) {
      return await e.reply(
        '暂无可用米游社Cookie，无法使用米游社直连更新\n可尝试发送*更新面板（三方面板服务）'
      )
    }
    // 频控：与三方面板更新共用每 uid 60s 限制（仅约束网络拉取）
    const timeKey = `STAR_RAILWAY:userPanelDataTime:${uid}`
    const lastTime = await redis.get(timeKey)
    if (lastTime) {
      const leftTime = Date.now() - parseInt(lastTime)
      if (leftTime < 1 * 60 * 1000) {
        const seconds = Math.ceil((1 * 60 * 1000 - leftTime) / 1000)
        return await e.reply(`查询过于频繁，请${seconds}秒后重试~`)
      }
    }
    await e.reply(
      `正在通过米游社直连获取uid${uid}面板数据中~\n可能需要一段时间，请耐心等待`
    )
    try {
      const api = new MysSRApi(uid, ck)
      let res = await api.getData('srCharacterDetail')
      res = await api.checkCode(e, res, 'srCharacterDetail')
      if (!res || Number(res.retcode) !== 0) {
        // checkCode 已按返回码回复具体原因
        return false
      }
      const avatarList = res?.data?.avatar_list
      if (!Array.isArray(avatarList) || avatarList.length === 0) {
        throw Error(
          `UID:${uid}米游社直连更新失败\n未获取到角色数据，可能是米游社数据未公开或该uid不存在`
        )
      }
      await redis.setEx(timeKey, 360 * 60, Date.now().toString())
      const previousData = await readData(uid)
      const characters = convertMysAvatarList(avatarList)
      const data = await updateData(previousData, characters)
      saveData(uid, data)
      // 渲染数据（数据来源注明为米游社直连）
      await renderCard(e, {
        api: '米游社直连',
        uid,
        data,
        type: 'update'
      })
      return false
    } catch (error) {
      logger.error('SR-panelApi-mys', error)
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
    msg += `当前API：\n${defaultSelect}：${
      apiList[defaultSelect - 1].split('/')[2]
    }`
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

  /** 面板命令的 uid 解析（NoteUser 优先，redis 绑定兜底，支持 @ 代查） */
  async resolvePanelUid (e) {
    let user = e.user_id
    const ats = e.message.filter((m) => m.type === 'at')
    let atTarget = ''
    if (ats.length > 0 && !e.atBot) {
      atTarget = String(ats[0].qq)
      user = atTarget
    }
    if (cfg.package.name != 'yunzai') {
      const u = await NoteUser.create(atTarget || user)
      const uid = u?.getUid('sr')
      if (uid) return uid
    }
    return await redis.get(`STAR_RAILWAY:UID:${user}`)
  }

  /**
   * *同步面板：手动从 miao-plugin 导入面板数据（只读 miao 数据文件，绝不回写）。
   * 查询面板时也会自动按时间戳同步（getPanelData 缓存分支），
   * 本命令用于显式触发/引导，尤其适合本地无缓存的首次数入。
   */
  async syncMiao (e) {
    const uid = await this.resolvePanelUid(e)
    if (!uid) {
      return await e.reply('尚未绑定uid，请发送#星铁绑定uid进行绑定')
    }
    const fmt = (t) => moment(Number(t)).format('YYYY-MM-DD HH:mm:ss')
    const miaoTime = getMiaoProfileTime(uid)
    if (miaoTime <= 0) {
      return await e.reply([
        `未找到 UID ${uid} 的 miao-plugin 面板数据`,
        '可先在 miao 侧更新：#星铁更新面板 或 #星铁米游社更新面板',
        '或使用本插件直连更新：*米游社更新面板'
      ].join('\n'))
    }
    const local = await readData(uid)
    const maxLocal = local.length
      ? Math.max(...local.map((i) => Number(i && i.lastUpdateTime) || 0))
      : 0
    if (miaoTime <= maxLocal) {
      return await e.reply([
        `miao-plugin 侧数据（${fmt(miaoTime)}）不比本地缓存（${fmt(maxLocal)}）新，无需同步`,
        '如需刷新最新数据可发送：*米游社更新面板'
      ].join('\n'))
    }
    const imported = importMiaoPlayerData(uid)
    if (!imported || imported.length < 1) {
      return await e.reply('miao-plugin 侧没有可导入的角色数据')
    }
    const merged = await updateData(local, imported, miaoTime)
    saveData(uid, merged)
    return await e.reply([
      `面板数据同步完成（UID：${uid}）`,
      `从 miao-plugin 导入 ${imported.length} 名角色（数据时间 ${fmt(miaoTime)}）`,
      '发送 *面板列表 查看已有角色，*角色名面板 查询详情'
    ].join('\n'))
  }

  /**
   * 第三方面板服务不可用时的 miao-plugin 数据兜底：
   * miao 侧存在数据且比本地缓存新（或本地为空）时整包导入，返回合并数据；
   * 否则返回 null，维持原报错（强制更新时 miao 也不比本地新则如实报失败）。
   */
  async fallbackToMiao (uid) {
    try {
      const miaoTime = getMiaoProfileTime(uid)
      if (miaoTime <= 0) return null
      const local = await readData(uid)
      const maxLocal = local.length
        ? Math.max(...local.map((i) => Number(i && i.lastUpdateTime) || 0))
        : 0
      if (maxLocal > 0 && miaoTime <= maxLocal) return null
      const imported = importMiaoPlayerData(uid)
      if (!imported || imported.length < 1) return null
      const merged = await updateData(local, imported, miaoTime)
      saveData(uid, merged)
      logger.info(
        `SR-panelApi 第三方面板服务不可用，已回退 miao 数据：uid${uid} 导入 ${imported.length} 名角色`
      )
      return merged
    } catch (err) {
      logger.warn('SR-panelApi miao 数据兜底失败', err)
      return null
    }
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
      logger.info('SR-panelApi强制查询')
      await this.e.reply(
        `正在获取uid${uid}面板数据中~\n可能需要一段时间，请耐心等待`
      )
      try {
        logger.info('SR-panelApi开始查询', uid)
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
          // 第三方面板服务不可用：回退 miao-plugin 数据（存在且不比本地缓存旧时导入）
          const rescued = await this.fallbackToMiao(uid)
          if (rescued) return rescued
          throw Error(`UID:${uid}更新面板失败\n面板服务连接超时，请稍后重试`)
        }
        if (!res) {
          const rescued = await this.fallbackToMiao(uid)
          if (rescued) return rescued
          throw Error(`UID:${uid}更新面板失败\n面板服务连接超时，请稍后重试`)
        }
        if ('detail' in cardData) {
          const rescued = await this.fallbackToMiao(uid)
          if (rescued) return rescued
          throw Error(cardData.detail)
        }
        if (!('playerDetailInfo' in cardData)) {
          const rescued = await this.fallbackToMiao(uid)
          if (rescued) return rescued
          throw Error(`uid:${uid}未查询到任何数据`)
        }
        if (!cardData.playerDetailInfo.isDisplayAvatarList) {
          throw Error(
            `uid:${uid}更新面板失败\n可能是角色展柜未开启或者该用户不存在`
          )
        }
        // 设置查询时间（仅在第三方数据校验通过后，失败查询不应占用 60s 冷却）
        await redis.setEx(timeKey, 360 * 60, Date.now().toString())
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
        // 强化形态检测与重映射：白名单角色若 point_id 带 '1'+avatarId 前缀
        // （如刃 1205 的 11205003），重映射 avatarId -> 2xxx 并重写 point_id 前缀，
        // 否则强化角色的技能等级/行迹解析全部失效（仅处理新入库数据，不追溯旧缓存）
        characters = characters.map(item => detectAndRemapAvatar(item))
        const chars = await updateData(previousData, characters)
        saveData(uid, chars)
        return chars
      } catch (error) {
        throw Error(error)
      }
    } else {
      // miao-plugin 面板数据按时间戳同步（只读 miao 数据文件，绝不回写）：
      // miao 侧 _profile 比本地缓存最新更新时间新时整包导入合并。
      // 本地文件转换不触发 60s 频控（频控只约束网络拉取）
      try {
        const miaoTime = getMiaoProfileTime(uid)
        if (miaoTime > 0) {
          const maxLocal = previousData.length
            ? Math.max(...previousData.map(
              item => Number(item && item.lastUpdateTime) || 0
            ))
            : 0
          if (miaoTime > maxLocal) {
            const imported = importMiaoPlayerData(uid)
            if (imported && imported.length > 0) {
              previousData = await updateData(previousData, imported, miaoTime)
              saveData(uid, previousData)
              logger.info(
                `SR-panelApi miao数据同步：uid${uid} 导入 ${imported.length} 名角色`
              )
            }
          }
        }
      } catch (err) {
        logger.warn('SR-panelApi miao数据同步失败，使用本地缓存', err)
      }
      // logger.info('SR-panelApi使用缓存')
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
    const lastUpdateTime = data.find(
      i => i.is_new && i.lastUpdateTime
    )?.lastUpdateTime
    let renderData = {
      api: api.split('/')[2],
      uid,
      data,
      time:
        moment(lastUpdateTime).format('YYYY-MM-DD HH:mm:ss dddd') ??
        '该页数据为缓存数据，非最新数据'
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
 * @param {number} time 新数据条目的 lastUpdateTime（默认当前时间；
 *   miao 数据同步传 miao 侧 _profile 时间戳）
 * @returns {Promise} 使用 try catch 捕获错误
 */
async function updateData (oldData, newData, time = Date.now()) {
  let returnData = oldData
  // logger.info('SR-updateData', oldData, newData);
  const handle = name => {
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
    newData[i].lastUpdateTime = time
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
    fs.writeFileSync(
      `${dataDir}/${uid}.json`,
      JSON.stringify(data, null, '\t'),
      'utf-8'
    )
    return true
  } catch (err) {
    logger.error('写入失败：', err)
    return false
  }
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

/**
 * @description: 计算欢愉度合计（百分点，即模板展示的 % 数值）
 * @param {object} data 面板角色数据（与传入 damageCalculator 的同一对象）
 * @return {number} 引擎口径的 joy/joyPlus/joyPct 三键之和
 */
export function getJoyValue (data) {
  // 面板欢愉度显示口径：对齐 miao-plugin 面板（models/attr/Attr.calc）——
  // 只聚合静态源（遗器主/副词条 + 行迹小节点 + 光锥静态属性 + 套装常驻词条），
  // 不含角色被动转化（如砂金•戏浪速度转欢愉）、光锥/套装效果钩子——这些
  // 动态 buff 在 miao 侧仅进 DmgAttr 伤害计算、不进面板显示（用户以 miao 显示为准）。
  // 引擎伤害计算的欢愉消费（utils/damage/main.js elation 分支）不受本函数影响。
  let attribute_bonus = {}
  let addBonus = (name, value) => {
    attribute_bonus[name] = (attribute_bonus[name] || 0) + value
  }
  // 遗器主/副词条
  data.relics.forEach(relic => {
    addBonus(relic.main_affix_tag, relic.main_affix_value)
    relic.sub_affix_id.forEach(sub => {
      addBonus(sub.tag, sub.value)
    })
  })
  // 行迹节点常驻属性（level 1 且 character.json 收录该节点时）
  data.skillTree.forEach(behavior => {
    if (behavior.level == 1 &&
      data.avatarId in char_dict &&
      behavior.id in char_dict[data.avatarId] &&
      char_dict[data.avatarId][behavior.id].levels[0].properties[0]) {
      let properties = char_dict[data.avatarId][behavior.id].levels[0].properties[0]
      addBonus(properties.type, properties.value)
    }
  })
  // 光锥静态属性（未知光锥降级为空）
  if (data.equipment.id) {
    let equipattr = (equipment_dict[data.equipment.id] || {})[data.equipment.rank] || []
    equipattr.forEach(attr => {
      addBonus(attr.PropertyType, attr.Value.Value)
    })
  }
  // 遗器套装常驻词条（未知套装降级跳过）
  if (data.relic_sets) {
    data.relic_sets.forEach(relic_set => {
      let set_num = relic_set.set_name.split('件套')[0]
      let set_skill = relicsetskill[relic_set.set_id] &&
        relicsetskill[relic_set.set_id][set_num]
      if (set_skill && set_skill.Property) {
        addBonus(set_skill.Property, set_skill.Value)
      }
    })
  }
  return (attribute_bonus.joy || 0) +
    (attribute_bonus.joyPlus || 0) +
    (attribute_bonus.joyPct || 0)
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
