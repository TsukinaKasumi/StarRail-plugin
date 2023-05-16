import User from '../../genshin/model/user.js'
import MysSRApi from '../runtime/MysSRApi.js'
import setting from '../utils/setting.js'
import fetch from 'node-fetch'
import _ from 'lodash'
import YAML from 'yaml'
import fs from 'fs'
export class hkrpg extends plugin {
  constructor (e) {
    super({
      name: '星穹铁道-体力',
      dsc: '星穹铁道体力信息',
      /** https://oicqjs.github.io/oicq/#events */
      event: 'message',
      priority: setting.getConfig('gachaHelp').noteFlag ? 5 : 500,
      rule: [
        {
          reg: '^#?(星铁|星轨|崩铁|星穹铁道)体力$',
          fnc: 'note'
        }
      ]
    })
    this.User = new User(e)
  }

  async note (e) {
    let user = this.e.user_id
    let ats = e.message.filter(m => m.type === 'at')
    let _user = this.User
    if (ats.length > 0 && !e.atBot) {
      user = ats[0].qq
      e.user_id = user
      _user = new User(e)
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
    let ck = await _user.getCk()
    if (!ck || Object.keys(ck).filter(k => ck[k].ck).length === 0) {
      await e.reply('尚未绑定cookie, 请发送#扫码登录进行绑定')
      return false
    }

    let api = new MysSRApi(uid, ck)
    const { url, headers } = api.getUrl('srNote')
    let res = await fetch(url, {
      headers
    })

    let cardData = await res.json()

    if (cardData.retcode !== 0) {
      logger.error(JSON.stringify(cardData))
      await e.reply(
        '查询失败, 可能是ck失效或遇到验证码\n您可以尝试重新扫码登录后再进行查询'
      )
      return false
    }

    let data = cardData.data
    const icons = YAML.parse(
      fs.readFileSync(setting.configPath + 'dispatch_icon.yaml', 'utf-8')
    )
    logger.mark(icons)
    data.expeditions.forEach(ex => {
      ex.remaining_time = formatDuration(ex.remaining_time)
      ex.icon = icons[ex.name]
      if (ex.remaining_time == '00时00分') ex.remaining_time = '委托已完成'
    })
    logger.warn(data.expeditions)
    if (data.max_stamina === data.current_stamina) {
      data.ktl_full = '开拓力已全部恢复'
    } else {
      data.ktl_full = `${formatDuration(data.stamina_recover_time)}`
      data.ktl_full_time_str = getRecoverTimeStr(data.stamina_recover_time)
    }
    data.uid = uid // uid显示
    data.ktl_name = e.nickname // 名字显示
    data.ktl_qq = parseInt(e.user_id) // QQ头像
    await e.runtime.render('StarRail-plugin', '/note/note.html', data)
  }

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

function formatDuration (seconds) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours.toString().padStart(2, '0')}时${minutes
    .toString()
    .padStart(2, '0')}分`
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
  return `预计[${str}]${timeStr}完全恢复`
}
