import User from '../../genshin/model/user.js'
import panelApi from '../runtime/PanelApi.js'
import fetch from 'node-fetch'
import MysSRApi from '../runtime/MysSRApi.js'
import _ from 'lodash'
import fs from 'fs'
import { pluginRoot } from '../utils/path.js'
import { findName } from '../utils/alias.js'
export class hkrpg extends plugin {
  constructor (e) {
    super({
      name: '星穹铁道-面板',
      dsc: '星穹铁道面板信息',
      /** https://oicqjs.github.io/oicq/#events */
      event: 'message',
      priority: 500,
      rule: [
        {
          reg: '^#?(星铁|星轨|崩铁|星穹铁道)(.+)面板',
          fnc: 'panel'
        },
        {
          reg: '^#?(星铁|星轨|崩铁|星穹铁道)面板(列表)?$',
          fnc: 'ikun'
        },
        {
          reg: '^#?更新(星铁|星轨|崩铁|星穹铁道)面板$',
          fnc: 'update'
        }
      ]
    })
    this.User = new User(e)
  }

  async panel (e) {
    let user = this.e.sender.user_id
    let ats = e.message.filter(m => m.type === 'at')
    const messageText = e.msg
    const charName =
      messageText.match(/#?(星铁|星轨|崩铁|星穹铁道)(.+)面板/)[2] || null
    if (!charName) return await this.ikun(e)
    if (charName === '更新') return await this.update(e)
    let uid = messageText.replace(/^#?(星铁|星轨|崩铁|星穹铁道)(.+)面板/, '')
    if (!uid) {
      if (ats.length > 0 && !e.atBot) {
        user = ats[0].qq
      }
      await this.miYoSummerGetUid()
      uid = await redis.get(`STAR_RAILWAY:UID:${user}`)
    }
    if (!uid) {
      await e.reply('尚未绑定uid,请发送#绑定星铁uid＋uid进行绑定')
      return false
    }
    // await e.reply('正在获取面板数据中')
    try {
      const api = await panelApi()
      let data = await this.getCharData(charName, uid, e)
      data.uid = uid
      data.api = api.split('/')[2]
      // 引入遗器地址数据
      let relicsPathData = pluginRoot + '/resources/panel/data/relics.json'
      relicsPathData = JSON.parse(fs.readFileSync(relicsPathData, 'utf-8'))
      // 引入角色数据
      let charData = pluginRoot + '/resources/panel/data/character.json'
      charData = JSON.parse(fs.readFileSync(charData, 'utf-8'))
      data.charpath = charData[data.avatarId].path
      data.relics.forEach((item, i) => {
        const filePath = relicsPathData[item.id].icon
        data.relics[i].path = filePath
      })
      data.behaviorList.splice(5)
      data.behaviorList.forEach((item, i) => {
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
        data.behaviorList[i].path = filePath
      })
      await e.runtime.render('StarRail-plugin', '/panel/panel.html', data)
    } catch (error) {
      logger.mark('SR-panelApi', error)
      return await e.reply(error)
    }
  }

  async update (e) {
    let user = this.e.sender.user_id
    let ats = e.message.filter(m => m.type === 'at')
    if (ats.length > 0 && !e.atBot) {
      user = ats[0].qq
    }
    await this.miYoSummerGetUid()
    let uid = await redis.get(`STAR_RAILWAY:UID:${user}`)
    if (!uid) {
      await e.reply('尚未绑定uid,请发送#绑定星铁uid＋uid进行绑定')
      return false
    }
    await e.reply('正在更新面板数据中~可能需要一段时间，请耐心等待')
    try {
      const api = await panelApi()
      const data = await this.getPanelData(uid, true)
      let renderData = {
        api: api.split('/')[2],
        uid,
        data
      }
      // 渲染数据
      await e.runtime.render('StarRail-plugin', '/panel/card.html', renderData)
      // await e.reply( '更新面板数据成功' );
    } catch (error) {
      logger.mark('SR-panelApi', error)
      return await e.reply(error)
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
    try {
      const data = await this.getPanelData(uid)
      const charName = await findName(name)
      const charInfo = data.filter(item => item.name === charName)[0]
      if (!charInfo) {
        await e.reply('正在获取面板数据中')
        const data = await this.getPanelData(uid, true)
        const charInfo = data.filter(item => item.name === charName)[0]
        if (!charInfo) {
          return Promise.reject(
            '未查询到角色数据，请检查角色是否放在了助战或者展柜，检查角色名是否正确，已设置的会有延迟，请等待一段时间重试。'
          )
        }
      }
      return charInfo
    } catch (error) {
      return Promise.reject(error)
    }
  }

  /**
   * 获取面板数据
   * @param {number|string} uid 角色UID
   * @param {boolean} isForce 是否强制更新数据
   * @returns {Promise} 使用 try catch 捕获错误
   */
  async getPanelData (uid, isForce = false) {
    // logger.mark('SR-panelApi', uid, isForce);
    const timeKey = `STAR_RAILWAY:userPanelDataTime:${uid}`
    const key = `STAR_RAILWAY:userPanelData:${uid}`
    let previousData = await redis.get(key)
    if (!previousData || isForce) {
      logger.mark('SR-panelApi强制查询')
      try {
        logger.mark('SR-panelApi开始查询', uid)
        let time = await redis.get(timeKey)
        if (time) {
          time = parseInt(time)
          const leftTime = Date.now() - time
          if (leftTime < 5 * 60 * 1000) {
            const seconds = Math.ceil((5 * 60 * 1000 - leftTime) / 1000)
            return Promise.reject(`查询过于频繁，请${seconds}秒后重试`)
          }
        }
        previousData = JSON.parse(previousData) || []
        const api = await panelApi()
        let res = null
        try {
          res = await fetch(api + uid)
        } catch (error) {
          return Promise.reject('面板服务连接超时，请稍后重试')
        }
        if (!res) return
        const cardData = await res.json()
        // 设置查询时间
        await redis.setEx(timeKey, 360 * 60, Date.now().toString())
        if ('detail' in cardData) return Promise.reject(cardData.detail)
        if (!('playerDetailInfo' in cardData)) { return Promise.reject('未查询到任何数据') }
        if (!cardData.playerDetailInfo.isDisplayAvatarList) { return Promise.reject('角色展柜未开启或者该用户不存在') }
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
        // logger.mark('SR-panelApi-SetRedis', JSON.stringify(chars));
        await redis.setEx(key, 360 * 60, JSON.stringify(chars))
        return chars
      } catch (error) {
        return Promise.reject(error)
      }
    } else {
      try {
        logger.mark('SR-panelApi使用缓存')
        const cardData = JSON.parse(previousData)
        return cardData
      } catch (error) {
        return Promise.reject(error)
      }
    }
  }

  async ikun (e) {
    let user = this.e.sender.user_id
    let ats = e.message.filter(m => m.type === 'at')
    if (ats.length > 0 && !e.atBot) {
      user = ats[0].qq
    }
    let uid = await redis.get(`STAR_RAILWAY:UID:${user}`)
    if (!uid) {
      await e.reply('尚未绑定uid,请发送#绑定星铁uid＋uid进行绑定')
      return false
    }
    const api = await panelApi()
    const data = await this.getPanelData(uid, false)
    let renderData = {
      api: api.split('/')[2],
      uid,
      data
    }
    // 渲染数据
    await e.runtime.render('StarRail-plugin', '/panel/list.html', renderData)
  }

  /** 通过米游社获取UID */
  async miYoSummerGetUid () {
    let key = `STAR_RAILWAY:UID:${this.e.user_id}`
    let ck = this.User.getCk()
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
  oldData.forEach((oldItem, i) => {
    if (oldData[i].name === '{nickname}' || oldData[i].name === '{NICKNAME}') { oldData[i].name = '开拓者' }
    oldData[i].relics = oldItem.relics || []
    oldData[i].behaviorList = oldItem.behaviorList || []
    oldData[i].is_new = false
  })
  newData.forEach((newItem, i) => {
    newData[i].is_new = true
    if (newData[i].name === '{nickname}' || newData[i].name === '{NICKNAME}') { newData[i].name = '开拓者' }
    newData[i].relics = newItem.relics || []
    newData[i].behaviorList = newItem.behaviorList || []
    returnData = returnData.filter(
      oldItem => oldItem.avatarId != newItem.avatarId
    )
  })
  returnData.unshift(...newData)
  return returnData
}
