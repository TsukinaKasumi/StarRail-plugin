import _ from 'lodash'
import moment from 'moment'
import fetch from 'node-fetch'
import runtimeRender from '../common/runtimeRender.js'
import MysSRApi from '../runtime/MysSRApi.js'
import { getCk, rulePrefix } from '../utils/common.js'
import setting from '../utils/setting.js'

export class Note extends plugin {
  constructor (e) {
    super({
      name: '星铁plugin-体力',
      dsc: '星穹铁道体力信息',
      /** https://oicqjs.github.io/oicq/#events */
      event: 'message',
      priority: setting.getConfig('gachaHelp').noteFlag ? 5 : 500,
      rule: [
        {
          reg: `^${rulePrefix}体力(pro)?$`,
          fnc: 'note'
        }
      ]
    })
  }

  async note (e) {
    // const isPro = /pro/.test(e.msg)
    // 20230907 体力默认改用小组件
    const isPro = true
    this.e.isSr = true
    this.isSr = true
    let user = this.e.user_id
    let ats = e.message.filter(m => m.type === 'at')
    if (ats.length > 0 && !e.atBot) {
      user = ats[0].qq
      this.e.user_id = user
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
    let ck = await getCk(e, isPro)
    if (!ck || Object.keys(ck).filter(k => ck[k].ck).length === 0) {
      await e.reply('尚未绑定cookie, 请发送#cookie帮助查看帮助')
      return false
    }

    let api = new MysSRApi(uid, ck)
    let deviceFp = await redis.get(`STARRAIL:DEVICE_FP:${uid}`)
    if (!deviceFp) {
      let sdk = api.getUrl('getFp')
      let res = await fetch(sdk.url, { headers: sdk.headers, method: 'POST', body: sdk.body })
      let fpRes = await res.json()
      deviceFp = fpRes?.data?.device_fp
      if (deviceFp) {
        await redis.set(`STARRAIL:DEVICE_FP:${uid}`, deviceFp, { EX: 86400 * 7 })
      }
    }
    let type = isPro ? 'srWidget' : 'srNote'
    let cardData = await api.getData(type, { deviceFp })
    cardData = await api.checkCode(e, cardData, type, {})
    if (!cardData || cardData.retcode !== 0) return false
    let data = cardData.data
    data.type = isPro ? 'module' : 'ordinary'
    data.userData = userData
    data.uid = uid
    data.time = moment().format('YYYY-MM-DD HH:mm:ss dddd')
    // 名字显示
    data.ktl_name = this.e.nickname
    // 头像
    if (this.e.member?.getAvatarUrl) {
      data.ktl_avatar = await this.e.member.getAvatarUrl()
    } else if (this.e.friend?.getAvatarUrl) {
      data.ktl_avatar = await this.e.friend.getAvatarUrl()
    } else {
      data.ktl_avatar = this.e.bot.avatar
    }
    data = this.handleData(data)
    logger.debug(data)
    await runtimeRender(this.e, '/note/new_note.html', data, {
      scale: 1.6
    })
  }

  handleData (data) {
    data.expeditions.forEach(ex => {
      ex.format_remaining_time = formatDuration(ex.remaining_time)
      ex.progress = (72000 - ex.remaining_time) / 72000 * 100 + '%'
    })
    if (data.max_stamina === data.current_stamina) {
      data.ktl_full = '开拓力<span class="golden">已完全恢复</span>！'
      data.ktl_full_time_str = ''
    } else {
      data.ktl_full = `${formatDuration(data.stamina_recover_time, 'HH小时mm分钟')} |`
      data.ktl_full_time_str = getRecoverTimeStr(data.stamina_recover_time)
    }
    data.stamina_progress = (data.current_stamina / data.max_stamina) * 100 + '%'
    return data
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

function formatDuration (seconds, format = 'HH时mm分') {
  if (seconds == 0) return '已完成'
  const duration = moment.duration(seconds, 'seconds')
  return moment.utc(duration.asMilliseconds()).format(format)
}

/**
 * 获取开拓力完全恢复的具体时间文本
 * @param {number} seconds 秒数
 */
function getRecoverTimeStr (seconds) {
  const now = new Date()
  const dateTimes = now.getTime() + seconds * 1000
  const date = new Date(dateTimes)
  const dayDiff = date.getDate() - now.getDate()
  const str = dayDiff === 0 ? '今日' : '明日'
  const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date
      .getMinutes()
      .toString()
      .padStart(2, '0')}`
  return `<span class="golden">[${str}]</span> ${timeStr}完全恢复`
}
