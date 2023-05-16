import plugin from '../../../lib/plugins/plugin.js'
import MysSRApi from '../runtime/MysSRApi.js'
import User from '../../genshin/model/user.js'
import setting from '../utils/setting.js'
import _ from 'lodash'

export class hkrpg extends plugin {
  constructor (e) {
    super({
      name: '星穹铁道-收入',
      dsc: '星穹铁道收入信息',
      /** https://oicqjs.github.io/oicq/#events */
      event: 'message',
      priority: setting.getConfig('gachaHelp').noteFlag ? 5 : 500,
      rule: [
        {
          reg: '^#?(星铁|星轨|崩铁|星穹铁道)(星琼获取|月历|月收入|收入|原石)$',
          fnc: 'month'
        }
      ]
    })
    this.User = new User(e)
  }

  async month (e) {
    let user = this.e.user_id
    let ats = e.message.filter(m => m.type === 'at')
    if (ats.length > 0 && !e.atBot) {
      user = ats[0].qq
      e.user_id = user
      this.User = new User(e)
    }
    let userData = await this.miYoSummerGetUid()
    let uid = await redis.get(`STAR_RAILWAY:UID:${user}`)
    if (userData.game_uid) {
      uid = userData.game_uid
    }
    if (!uid) {
      await e.reply('尚未绑定uid,请发送#绑定星铁uid＋uid进行绑定')
      return false
    }
    let ck = await this.User.getCk()
    if (!ck || Object.keys(ck).filter(k => ck[k].ck).length === 0) {
      await e.reply('尚未绑定cookie, 请发送#扫码登录进行绑定')
      return false
    }

    let api = new MysSRApi(uid, ck)
    const cardData = await api.getData('srMonth')
    if (!cardData || cardData.retcode != 0) return e.reply(cardData.message || '请求数据失败')
    let data = cardData.data
    data.pieData = JSON.stringify(data.month_data.group_by.map((v) => {
      return {
        name: `${v.action_name} ${v.num}`,
        value: v.num
      }
    }))
    await e.runtime.render('StarRail-plugin', '/month/month.html', data)
  }

  async miYoSummerGetUid () {
    let key = `STAR_RAILWAY:UID:${this.e.user_id}`
    let ck = this.User.getCk()
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
