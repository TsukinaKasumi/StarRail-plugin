import fetch from 'node-fetch'
import _ from 'lodash'
import moment from 'moment'
import User from '../../genshin/model/user.js'
import MysSRApi from '../runtime/MysSRApi.js'
import setting from '../utils/setting.js'
import { getCk, rulePrefix } from '../utils/common.js'
import runtimeRender from '../common/runtimeRender.js'

export class Rogue extends plugin {
  constructor (e) {
    super({
      name: '星铁plugin-深渊',
      dsc: '星穹铁道深渊信息',
      /** https://oicqjs.github.io/oicq/#events */
      event: 'message',
      priority: setting.getConfig('gachaHelp').noteFlag ? 5 : 500,
      rule: [
        {
          reg: `^${rulePrefix}(上期|本期)?深渊$`,
          fnc: 'rogue'
        }
      ]
    })
    this.User = new User(e)
  }

  async rogue (e) {
    let user = this.e.user_id
    let ats = e.message.filter(m => m.type === 'at')
    if (ats.length > 0 && !e.atBot) {
      user = ats[0].qq
      this.e.user_id = user
      this.User = new User(this.e)
    }
    let userData = await this.miYoSummerGetUid()
    let uid = await redis.get(`STAR_RAILWAY:UID:${user}`)
    if (userData.game_uid) {
      uid = userData.game_uid
    } else {
      await e.reply('当前使用的ck无星穹铁道角色，如绑定多个ck请尝试切换ck')
      return false
    }
    if (!uid) {
      await e.reply('尚未绑定uid,请发送#星铁绑定uid进行绑定')
      return false
    }
    let schedule_type = '1'
    if (e.msg.indexOf('上期') > -1) {
      schedule_type = '2'
    }
    let ck = await getCk(e)
    if (!ck || Object.keys(ck).filter(k => ck[k].ck).length === 0) {
      await e.reply('尚未绑定cookie, 请发送#cookie帮助查看帮助')
      return false
    }

    let api = new MysSRApi(uid, ck)
    let sdk = api.getUrl('getFp')
    let fpRes = await fetch(sdk.url, { headers: sdk.headers, method: 'POST', body: sdk.body })
    fpRes = await fpRes.json()
    let deviceFp = fpRes?.data?.device_fp
    if (deviceFp) {
      await redis.set(`STARRAIL:DEVICE_FP:${uid}`, deviceFp, { EX: 86400 * 7 })
    }
    const { url, headers } = api.getUrl('srChallenge', { deviceFp, schedule_type })
    delete headers['x-rpc-page']
    logger.mark({ url, headers })
    let res = await fetch(url, {
      headers
    })

    let cardData = await res.json()
    await api.checkCode(this.e, cardData, 'srNote')
    if (cardData.retcode !== 0) {
      return false
    }

    const data = { ...cardData.data }
    data.beginTime = moment(data.begin_time).format('YYYY.MM.DD')
    data.endTime = moment(data.end_time).format('YYYY.MM.DD')
    data.all_floor_detail = _.map(data.all_floor_detail, (floor) => {
      return {
        ...floor,
        node_1: _.map(floor.node_1, (node) => {
          return {
            ...node,
            challengeTime: moment(node.challenge_time).format('YYYY.MM.DD HH:SS')
          }
        }),
        node_2: _.map(floor.node_2, (node) => {
          return {
            ...node,
            challengeTime: moment(node.challenge_time).format('YYYY.MM.DD HH:SS')
          }
        })
      }
    })

    console.log(data.all_floor_detail)

    // await e.reply(JSON.stringify(cardData))
    await runtimeRender(e, '/challenge/index.html', {
      data,
      uid,
      type: schedule_type
    })
    // await e.reply(JSON.stringify(cardData))
  }

  async miYoSummerGetUid () {
    let key = `STAR_RAILWAY:UID:${this.e.user_id}`
    let ck = await getCk(this.e)
    if (!ck) return false
    // if (await redis.get(key)) return false
    // todo check ck
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