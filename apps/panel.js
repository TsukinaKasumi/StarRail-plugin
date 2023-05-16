import User from '../../genshin/model/user.js'
import panelApi from '../runtime/PanelApi.js'
import fetch from 'node-fetch'
import MysSRApi from '../runtime/MysSRApi.js'
import _ from 'lodash'
import fs from 'fs'
import path from 'path'
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
    let user = this.e.user_id
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
      // 面板图
      data.charImage = this.getCharImage(data.name, data.avatarId)
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
      logger.error('SR-panelApi', error)
      return await e.reply(error.message)
    }
  }

  /** 获取面板图 */
  getCharImage (name, avatarId) {
    const root = pluginRoot + '/resources/profile/normal-character/'

    const leadId = {
      星: [8002, 8004],
      穹: [8001, 8003]
    }
    for (let i in leadId) {
      if (leadId[i].includes(avatarId)) {
        name = i
      }
    }
    if (fs.existsSync(root + `${name}.webp`)) {
      return path.join(root, `${name}.webp`)
    } else if (fs.existsSync(root + name)) {
      return this.getRandomImage(root + name)
    } else {
      // 适配原文件位置
      return this.getRandomImage(pluginRoot + `/resources/panel/resources/char_image/${avatarId}/`)
    }
  }

  /** 随机取文件夹图片 */
  getRandomImage (dirPath) {
    const files = fs.readdirSync(dirPath)
    const images = files.filter((file) => {
      return /\.(jpg|png|webp)$/i.test(file)
    })
    const randomNum = Math.floor(Math.random() * images.length)
    return path.join(dirPath, images[randomNum])
  }

  async update (e) {
    let user = this.e.user_id
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
      logger.error('SR-panelApi', error)
      return await e.reply(error.message)
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
    const charName = await findName(name)
    const charInfo = data.filter(item => item.name === charName)[0]
    if (!charInfo) {
      const data = await this.getPanelData(uid, true)
      const charInfo = data.filter(item => item.name === charName)[0]
      if (!charInfo) {
        throw Error(
          '未查询到角色数据，请检查角色是否放在了助战或者展柜，检查角色名是否正确，已设置的会有延迟，请等待一段时间重试。'
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
      await this.e.reply('正在更新面板数据中~可能需要一段时间，请耐心等待')
      try {
        logger.mark('SR-panelApi开始查询', uid)
        let time = await redis.get(timeKey)
        if (time) {
          time = parseInt(time)
          const leftTime = Date.now() - time
          if (leftTime < 5 * 60 * 1000) {
            const seconds = Math.ceil((5 * 60 * 1000 - leftTime) / 1000)
            throw Error(`查询过于频繁，请${seconds}秒后重试`)
          }
        }
        const api = await panelApi()
        let res = null
        let cardData = null
        try {
          res = await fetch(api + uid)
          cardData = await res.json()
        } catch (error) {
          throw Error('面板服务连接超时，请稍后重试')
        }
        if (!res) throw Error('面板服务连接超时，请稍后重试')
        // 设置查询时间
        await redis.setEx(timeKey, 360 * 60, Date.now().toString())
        if ('detail' in cardData) throw Error(cardData.detail)
        if (!('playerDetailInfo' in cardData)) {
          throw Error('未查询到任何数据')
        }
        if (!cardData.playerDetailInfo.isDisplayAvatarList) {
          throw Error('角色展柜未开启或者该用户不存在')
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
      logger.mark('SR-panelApi使用缓存')
      const cardData = previousData
      return cardData
    }
  }

  async ikun (e) {
    let user = this.e.user_id
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
    if (oldData[i].name === '{nickname}' || oldData[i].name === '{NICKNAME}') {
      oldData[i].name = '开拓者'
    }
    oldData[i].relics = oldItem.relics || []
    oldData[i].behaviorList = oldItem.behaviorList || []
    oldData[i].is_new = false
  })
  newData.forEach((newItem, i) => {
    newData[i].is_new = true
    if (newData[i].name === '{nickname}' || newData[i].name === '{NICKNAME}') {
      newData[i].name = '开拓者'
    }
    newData[i].relics = newItem.relics || []
    newData[i].behaviorList = newItem.behaviorList || []
    returnData = returnData.filter(
      oldItem => oldItem.avatarId != newItem.avatarId
    )
  })
  returnData.unshift(...newData)
  return returnData
}
async function saveData (uid, data) {
  // 文件路径
  const filePath = pluginRoot + '/data/panel/' + uid + '.json'
  // 确保目录存在，如果不存在则创建
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true })
  // 判断文件是否存在，并写入数据
  try {
    await fs.promises.access(filePath, fs.constants.F_OK)
    await fs.promises.writeFile(filePath, JSON.stringify(data), 'utf-8')
    return true
  } catch (err) {
    await fs.promises.appendFile(filePath, JSON.stringify(data), 'utf-8')
    return false
  }
}
async function readData (uid) {
  // 文件路径
  const filePath = pluginRoot + '/data/panel/' + uid + '.json'
  // 判断文件是否存在并读取文件
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath))
  } else {
    return []
  }
}
