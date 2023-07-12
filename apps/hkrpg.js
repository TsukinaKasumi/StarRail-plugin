import plugin from '../../../lib/plugins/plugin.js'
import MysSRApi from '../runtime/MysSRApi.js'
import fetch from 'node-fetch'
import GsCfg from '../../genshin/model/gsCfg.js'
// import { gatchaType, statistics } from '../utils/gatcha.js'
import setting from '../utils/setting.js'
import { getPaylogUrl, getPowerUrl } from '../utils/mysNoCkNeededUrl.js'
import { getAuthKey } from '../utils/authkey.js'
import _ from 'lodash'
import { statisticOnlinePeriods,statisticsOnlineDateGeneral,rulePrefix,getCk } from '../utils/common.js'
import runtimeRender from '../common/runtimeRender.js'

export class Hkrpg extends plugin {
  constructor (e) {
    super({
      name: '星铁plugin基本信息',
      dsc: '星穹铁道基本信息',
      /** https://oicqjs.github.io/oicq/#events */
      event: 'message',
      priority: -114514,
      rule: [
        {
          /** 命令正则匹配 */
          reg: `^${rulePrefix}绑定(uid|UID)?(\\s)?[1-9][0-9]{8}$`,
          /** 执行方法 */
          fnc: 'bindSRUid'
        },
        {
          reg: `^${rulePrefix}(卡片|探索|角色)$`,
          fnc: 'card'
        },
        {
          reg: `^${rulePrefix}(星琼|古老梦华|体力|遗器|光锥|充值|武器)记录(\\d){0,}$`,
          fnc: 'getPayLog'
        },
        {
          reg: `^${rulePrefix}在线(时长)?(统计|分析)?`,
          fnc: 'statisticsOnline'
        }
      ]
    })
  }

  get appconfig () {
    return setting.getConfig('gachaHelp')
  }

  get app2config () {
    return setting.getConfig('cookieHelp')
  }

  async card (e) {
    try {
      let user = this.e.user_id
      let ats = e.message.filter(m => m.type === 'at')
      if (ats.length > 0 && !e.atBot) {
        user = ats[0].qq
      }
      let hasPersonalCK = false
      let uid = e.msg.match(/\d+/)?.[0]
      await this.miYoSummerGetUid()
      uid = uid || (await redis.get(`STAR_RAILWAY:UID:${user}`))
      if (!uid) {
        return e.reply('未绑定uid，请发送#星铁绑定uid进行绑定')
      }
      let ck = await getCk(e)
      if (!ck || Object.keys(ck).filter(k => ck[k].ck).length === 0) {
        let ckArr = GsCfg.getConfig('mys', 'pubCk') || []
        ck = ckArr[0]
      } else {
        hasPersonalCK = true
      }

      let api = new MysSRApi(uid, ck)
      let cardData = await api.getData('srCard')
      let result = cardData?.data
      if (!result) {
        logger.error(cardData)
        await e.reply(`尚未绑定Cookie,${this.app2config.docs}`)
        return false
      }
      if (hasPersonalCK) {
        let userDataKey = `STAR_RAILWAY:userData:${uid}`
        let userData = JSON.parse(await redis.get(userDataKey))
        if (!userData) {
          userData = (await api.getData('srUser'))?.data?.list?.[0]
        }
        result = Object.assign(cardData.data, userData)
        result.level = result.level + '级'
      } else {
        result.game_uid = uid
        result.nickname = '开拓者'
      }
      await runtimeRender(e, '/card/card.html', result, {
        scale: 1.4
      })
    } catch (err) {
      e.reply('cookie错误或未绑定ck')
    }
  }

  async miYoSummerGetUid () {
    let key = `STAR_RAILWAY:UID:${this.e.user_id}`
    let ck = await getCk(this.e)
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

  async bindSRUid () {
    let uid = parseInt(this.e.msg.replace(/[^0-9]/gi, ''))
    let user = this.e.user_id
    await redis.set(`STAR_RAILWAY:UID:${user}`, uid)
    this.reply(`绑定成功,当前绑定[sr]uid:${uid}`, false)
    return false
  }

  async getPayLog (e) {
    const reg = /(星琼|古老梦华|体力|遗器|光锥|充值|武器)记录(\d{0,})$/ig
    const command = reg.exec(e.msg)
    let type = command[1]
    const page = command[2] || 1
    if (type === '充值') type = '古老梦华'
    if (type === '武器') type = '光锥'
    let typeen
    switch (type) {
      case '星琼':
        typeen = 'Stellar'
        break
      case '古老梦华':
        typeen = 'Dreams'
        break
      case '体力':
        typeen = 'Power'
        break
      case '遗器':
        typeen = 'Relic'
        break
      case '光锥':
        typeen = 'Cone'
        break
      default:
        typeen = 'Dreams'
        break
    }
    await this.miYoSummerGetUid()
    let uid = await redis.get(`STAR_RAILWAY:UID:${e.user_id}`)
    if (!uid) {
      await e.reply('尚未绑定uid,请发送#星铁绑定uid进行绑定')
      return false
    }
    let authKey
    try {
      authKey = await getAuthKey(e, uid)
    } catch (err) {
      authKey = null
    }
    if (!authKey) {
      await e.reply(
        'authkey获取失败，请使用#扫码登录重新绑定stoken后再进行查看~'
      )
      return false
    }
    authKey = encodeURIComponent(authKey)
    let result = []
    let size = 10
    let payLogUrl = getPaylogUrl(authKey, type, page, size)
    let res = await fetch(payLogUrl)
    let payLogList = await res.json()
    result.push(...payLogList.data.list)
    // while (payLogList.data.list && payLogList.data.list.length === 10) {
    //   await new Promise(resolve => setTimeout(resolve, 500))
    //   payLogUrl = getPaylogUrl(authKey, page, size)
    //   res = await fetch(payLogUrl)
    //   payLogList = await res.json()
    //   result.push(...payLogList.data.list)
    //   page++
    // }

    logger.debug(result)
    result = result.filter(r => r.add_num > 0)
    if (type === '体力') result = result.filter(r => r.add_num > 1)
    if (result.length === 0) {
      await e.reply('暂无记录')
      return false
    }
    let data = {
      uid,
      list: result,
      type,
      page,
      typeen
    }
    // let t = result
    //   .map(i => {
    //     return `${i.time}: ${i.action} 获得${i.add_num}${type}`
    //   })
    //   .join('\n')
    // await e.reply(t)
    await runtimeRender(
      e,
      '/charge/charge.html',
      data,
      {
        retType: 'msgId',
        scale: 1.6
      }
    )
  }

  async statisticsOnline (e) {
    let lock = await redis.get(`STAR_RAILWAY:CD:ONLINE:${e.user_id}`)
    if (lock) {
      await e.reply('冷却时间没到，请稍后再试')
      return true
    }
    await this.miYoSummerGetUid()
    let uid = await redis.get(`STAR_RAILWAY:UID:${e.user_id}`)
    if (!uid) {
      await e.reply('未绑定uid，请发送#星铁绑定uid进行绑定')
      return false
    }
    let authKey
    try {
      authKey = await getAuthKey(e, uid)
    } catch (err) {
      // 未安装逍遥
      await e.reply('请先使用#cookie帮助绑定cookie和星铁绑定uid后再进行查看噢')
      return false
    }
    if (!authKey) {
      await e.reply('请先使用#cookie帮助绑定cookie和星铁绑定uid后再进行查看噢')
      return false
    }
    await e.reply('正在统计中，时间可能比较久请多等一会~')
    authKey = encodeURIComponent(authKey)
    let result = []
    let page = 1
    let size = 50
    let powerUrl = getPowerUrl(authKey, page, size)
    let res = await fetch(powerUrl)
    let powerChangeRecordList = await res.json()
    result.push(
      ...powerChangeRecordList.data.list.filter(
        i => i.action === '随时间回复开拓力'
      )
    )
    page++
    let earliest = new Date()
    earliest.setDate(earliest.getDate() - 8)
    while (
      powerChangeRecordList.data.list &&
      powerChangeRecordList.data.list.length > 0
    ) {
      powerUrl = getPowerUrl(authKey, page, size)
      res = await fetch(powerUrl)
      try {
        powerChangeRecordList = await res.json()
        result.push(
          ...powerChangeRecordList.data.list.filter(
            i => i.action === '随时间回复开拓力'
          )
        )
        page++
      } catch (err) {
        // 拉完或者一直拉到报错
        break
      }
      // 只拉七天的中间图不好看。
      // if (new Date(result[result.length - 1]?.time) < earliest) {
      //   break
      // }
      await new Promise(resolve => setTimeout(resolve, 500))
      logger.info('休息0.5秒，继续拉取开拓力记录')
    }
    const { data } = statisticsOnlineDateGeneral(result)
    let details = statisticOnlinePeriods(result)
    let userDataKey = `STAR_RAILWAY:userData:${uid}`
    let userData = JSON.parse(await redis.get(userDataKey))
    if (!userData) {
      let ck = await getCk(e)
      let api = new MysSRApi(uid, ck)
      userData = (await api.getData('srUser'))?.data?.list?.[0]
    }
    let renderData = Object.assign(userData || {}, {
      general: JSON.stringify(data),
      details
    })
    await e.runtime.render('StarRail-plugin', 'online/index.html', renderData)
  }
}
