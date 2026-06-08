import User from '../../genshin/model/user.js'
import MysSRApi from '../runtime/MysSRApi.js'
import setting from '../utils/setting.js'
import fetch from 'node-fetch'
import _ from 'lodash'
import { getCk, rulePrefix } from '../utils/common.js'
import runtimeRender from '../common/runtimeRender.js'
import GsCfg from '../../genshin/model/gsCfg.js'

export class Rogue extends plugin {
  constructor (e) {
    super({
      name: '星铁plugin-模拟宇宙',
      dsc: '星穹铁道模拟宇宙信息',
      /** https://oicqjs.github.io/oicq/#events */
      event: 'message',
      priority: setting.getConfig('gachaHelp').noteFlag ? 5 : 500,
      rule: [
        {
          reg: `^${rulePrefix}(上期|本期)?(模拟)?宇宙`,
          fnc: 'rogue'
        },
        {
          reg: `^${rulePrefix}(寰宇)?蝗灾`,
          fnc: 'rogue_locust'
        },
        {
          reg: `^${rulePrefix}(黄金与机械|黄金|机械|黄金机械)`,
          fnc: 'rogue_nous'
        },
        {
          reg: `^${rulePrefix}(不可知域)`,
          fnc: 'rogue_magic'
        },
        {
          reg: `^${rulePrefix}(差分宇宙|差分)`,
          fnc: 'rogue_tourn'
        },
        {
          reg: `^${rulePrefix}常规(差分(宇宙)?|演算)(战绩|回顾|战报|记录)?(一|二|三)?`,
          fnc: 'rogue_tourn_normal'
        },
        {
          reg: `^${rulePrefix}(本期|上期|本周|上周)(差分(宇宙)?|演算)(战绩|回顾|战报|记录)?(一|二|三)?`,
          fnc: 'rogue_tourn_week'
        },
        {
          reg: `^${rulePrefix}周期(差分(宇宙)?|演算)(战绩|回顾|战报|记录)?(一|二|三)?`,
          fnc: 'rogue_tourn_week_help'
        }
      ]
    })
    this.User = new User(e)
  }

  get app2config () {
    return setting.getConfig('cookieHelp')
  }

  async rogue (e) {
    this.e.isSr = true
    this.isSr = true
    let user = this.e.user_id
    let ats = e.message.filter(m => m.type === 'at')
    if (ats.length > 0 && !e.atBot) {
      user = ats[0].qq
      this.e.user_id = user
      this.User = new User(this.e)
    }
    let uid = e.msg.match(/\d+/)?.[0]
    await this.miYoSummerGetUid()
    uid = uid || (await redis.get(`STAR_RAILWAY:UID:${user}`)) || this.e.user?.getUid('sr')
    if (!uid) {
      return e.reply('未绑定uid，请发送#星铁绑定uid进行绑定')
    }
    let ck = await getCk(e)
    if (!ck || Object.keys(ck).filter(k => ck[k].ck).length === 0) {
      let ckArr = GsCfg.getConfig('mys', 'pubCk') || []
      ck = ckArr[0]
    }
    if (!ck) {
      await e.reply(`尚未绑定Cookie,${this.app2config.docs}`)
      return false
    }
    let api = new MysSRApi(uid, ck)
    let schedule_type = '1'
    if (e.msg.indexOf('上期') > -1) {
      schedule_type = '2'
    }

    let sdk = api.getUrl('getFp')
    let fpRes = await fetch(sdk.url, { headers: sdk.headers, method: 'POST', body: sdk.body })
    fpRes = await fpRes.json()
    let deviceFp = fpRes?.data?.device_fp
    if (deviceFp) {
      await redis.set(`STARRAIL:DEVICE_FP:${uid}`, deviceFp, { EX: 86400 * 7 })
    }
    const { url, headers } = api.getUrl('srRogue', { deviceFp, schedule_type })
    delete headers['x-rpc-page']
    logger.debug({ url, headers })
    let res = await fetch(url, {
      headers
    })

    let cardData = await res.json()
    cardData = await api.checkCode(this.e, cardData, 'srRogue', { deviceFp, schedule_type })
    if (cardData.retcode !== 0) {
      return false
    }
    let data = Object.assign(cardData.data, { uid })
    if (schedule_type === '1') {
      // 懒得改了
      data.last_record = data.current_record
    }
    await runtimeRender(e, '/rogue/rogue.html', data, {
      scale: 1.4
    })
    // await e.runtime.render('StarRail-plugin', '/rogue/rogue.html', cardData.data)
    // await e.reply(JSON.stringify(cardData))
  }

  async rogue_locust (e) {
    this.e.isSr = true
    this.isSr = true
    let user = this.e.user_id
    let ats = e.message.filter(m => m.type === 'at')
    if (ats.length > 0 && !e.atBot) {
      user = ats[0].qq
      this.e.user_id = user
      this.User = new User(this.e)
    }
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
    }
    if (!ck) {
      await e.reply(`尚未绑定Cookie,${this.app2config.docs}`)
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
    const { url, headers } = api.getUrl('srRogueLocust', { deviceFp })
    delete headers['x-rpc-page']
    logger.debug({ url, headers })
    let res = await fetch(url, {
      headers
    })

    let cardData = await res.json()
    cardData = await api.checkCode(this.e, cardData, 'srRogueLocust', { deviceFp })
    if (cardData.retcode !== 0) {
      return false
    }
    let data = Object.assign(cardData.data, { uid })
    await runtimeRender(e, '/rogue/rogue_locust.html', data, {
      scale: 1.4
    })
  }

  async rogue_nous (e) {

  }

  async rogue_magic (e) {

  }

  // 时间格式化函数
  formatTime(timeObj) {
    if (!timeObj) return ''
    const { year, month, day, hour, minute, second } = timeObj
    return `${year}.${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`
  }

  async rogue_tourn (e) {
    this.e.isSr = true
    this.isSr = true
    let user = this.e.user_id
    let ats = e.message.filter(m => m.type === 'at')
    if (ats.length > 0 && !e.atBot) {
      user = ats[0].qq
      this.e.user_id = user
      this.User = new User(this.e)
    }
    let uid = e.msg.match(/\d+/)?.[0]
    await this.miYoSummerGetUid()
    uid = uid || (await redis.get(`STAR_RAILWAY:UID:${user}`)) || this.e.user?.getUid('sr')
    if (!uid) {
      return e.reply('未绑定uid，请发送#星铁绑定uid进行绑定')
    }
    let ck = await getCk(e)
    if (!ck || Object.keys(ck).filter(k => ck[k].ck).length === 0) {
      let ckArr = GsCfg.getConfig('mys', 'pubCk') || []
      ck = ckArr[0]
    }
    if (!ck) {
      await e.reply(`尚未绑定Cookie,${this.app2config.docs}`)
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
    const { url, headers } = api.getUrl('srRogueTourn', { deviceFp })
    delete headers['x-rpc-page']
    logger.debug({ url, headers })
    let res = await fetch(url, {
      headers
    })

    let cardData = await res.json()
    cardData = await api.checkCode(this.e, cardData, 'srRogueTourn', { deviceFp })
    if (cardData.retcode !== 0) {
      return false
    }
    let data = Object.assign(cardData.data, { uid })
    
    // 格式化时间
    if (data.normal_detail?.records && data.normal_detail.records.length > 0) {
      data.normal_detail.records[0].format_finish_time = this.formatTime(data.normal_detail.records[0].finish_time)
    }
    
    await runtimeRender(e, '/rogue/rogueTourn.html', data, {
      scale: 1.4
    })
  }

  async rogue_tourn_normal (e) {
    this.e.isSr = true
    this.isSr = true
    let user = this.e.user_id
    let ats = e.message.filter(m => m.type === 'at')
    if (ats.length > 0 && !e.atBot) {
      user = ats[0].qq
      this.e.user_id = user
      this.User = new User(this.e)
    }
    let uid = e.msg.match(/\d+/)?.[0]
    await this.miYoSummerGetUid()
    uid = uid || (await redis.get(`STAR_RAILWAY:UID:${user}`)) || this.e.user?.getUid('sr')
    if (!uid) {
      return e.reply('未绑定uid，请发送#星铁绑定uid进行绑定')
    }
    let ck = await getCk(e)
    if (!ck || Object.keys(ck).filter(k => ck[k].ck).length === 0) {
      let ckArr = GsCfg.getConfig('mys', 'pubCk') || []
      ck = ckArr[0]
    }
    if (!ck) {
      await e.reply(`尚未绑定Cookie,${this.app2config.docs}`)
      return false
    }

    let indexMap = { 一: 1, 二: 2, 三: 3 }
    let indexStr = e.msg.match(/(一|二|三)$/)?.[0]
    let index = indexMap[indexStr] || 1

    let api = new MysSRApi(uid, ck)
    let sdk = api.getUrl('getFp')
    let fpRes = await fetch(sdk.url, { headers: sdk.headers, method: 'POST', body: sdk.body })
    fpRes = await fpRes.json()
    let deviceFp = fpRes?.data?.device_fp
    if (deviceFp) {
      await redis.set(`STARRAIL:DEVICE_FP:${uid}`, deviceFp, { EX: 86400 * 7 })
    }
    const { url, headers } = api.getUrl('srRogueTourn', { deviceFp })
    delete headers['x-rpc-page']
    logger.debug({ url, headers })
    let res = await fetch(url, {
      headers
    })

    let cardData = await res.json()
    cardData = await api.checkCode(this.e, cardData, 'srRogueTourn', { deviceFp })
    if (cardData.retcode !== 0) {
      return false
    }

    let data = cardData.data
    if (!data.normal_detail?.records || data.normal_detail.records.length < index) {
      return e.reply(`未找到差分宇宙·常规演算第${index}条记录：${periodName}共有${weekDetail.records.length || 0}条记录`)
    }

    let record = data.normal_detail.records[index - 1]
    let renderData = {
      uid,
      role: data.role,
      basic: data.basic,
      record: record,
      index_of_archive: `${index} / ${data.normal_detail.records.length}`
    }

    // 格式化时间
    renderData.record.format_finish_time = this.formatTime(renderData.record.finish_time)

    // 计算祝福总数
    let buffs_count = 0
    renderData.record.buffs.forEach(group => {
      buffs_count += group.items.length
    })
    renderData.buffs_count = buffs_count

    await runtimeRender(e, '/rogue/rogueTournNormal.html', renderData, {
      scale: 1.4
    })
  }

  async rogue_tourn_week (e) {
    this.e.isSr = true
    this.isSr = true
    let user = this.e.user_id
    let ats = e.message.filter(m => m.type === 'at')
    if (ats.length > 0 && !e.atBot) {
      user = ats[0].qq
      this.e.user_id = user
      this.User = new User(this.e)
    }
    let uid = e.msg.match(/\d+/)?.[0]
    await this.miYoSummerGetUid()
    uid = uid || (await redis.get(`STAR_RAILWAY:UID:${user}`)) || this.e.user?.getUid('sr')
    if (!uid) {
      return e.reply('未绑定uid，请发送#星铁绑定uid进行绑定')
    }
    let ck = await getCk(e)
    if (!ck || Object.keys(ck).filter(k => ck[k].ck).length === 0) {
      let ckArr = GsCfg.getConfig('mys', 'pubCk') || []
      ck = ckArr[0]
    }
    if (!ck) {
      await e.reply(`尚未绑定Cookie,${this.app2config.docs}`)
      return false
    }

    let indexMap = { 一: 1, 二: 2, 三: 3 }
    let indexStr = e.msg.match(/(一|二|三)/)?.[0]
    let index = indexMap[indexStr] || 1

    let period = e.msg.match(/上期|上周/) ? 'last_week_detail' : 'cur_week_detail'
    let periodName = e.msg.match(/上期|上周/) ? '上期' : '本期'

    let api = new MysSRApi(uid, ck)
    let sdk = api.getUrl('getFp')
    let fpRes = await fetch(sdk.url, { headers: sdk.headers, method: 'POST', body: sdk.body })
    fpRes = await fpRes.json()
    let deviceFp = fpRes?.data?.device_fp
    if (deviceFp) {
      await redis.set(`STARRAIL:DEVICE_FP:${uid}`, deviceFp, { EX: 86400 * 7 })
    }
    const { url, headers } = api.getUrl('srRogueTourn', { deviceFp })
    delete headers['x-rpc-page']
    logger.debug({ url, headers })
    let res = await fetch(url, {
      headers
    })

    let cardData = await res.json()
    cardData = await api.checkCode(this.e, cardData, 'srRogueTourn', { deviceFp })
    if (cardData.retcode !== 0) {
      return false
    }

    let data = cardData.data
    let weekDetail = data[period]
    if (!weekDetail || !weekDetail.records || weekDetail.records.length < index) {
      return e.reply(`未找到差分宇宙·周期演算${periodName}第${index}条记录：${periodName}共有${weekDetail.records.length || 0}条记录`)
    }

    let record = weekDetail.records[index - 1]
    let renderData = {
      uid,
      role: data.role,
      basic: data.basic,
      record: record,
      weekly_name: weekDetail.weekly_name,
      weekly_buff_desc: weekDetail.weekly_buff_desc?.map(s => s?.replace(/^●/g, '')),
      index_of_archive: `${index} / ${weekDetail.records.length}`,
      periodName
    }

    // 格式化时间
    renderData.record.format_finish_time = this.formatTime(renderData.record.finish_time)

    // 计算祝福总数
    let buffs_count = 0
    renderData.record.buffs.forEach(group => {
      buffs_count += group.items.length
    })
    renderData.buffs_count = buffs_count

    await runtimeRender(e, '/rogue/rogueTournWeek.html', renderData, {
      scale: 1.4
    })
  }

  async rogue_tourn_week_help (e) {
    return e.reply('请查询【本期】或【上期】的【差分宇宙·周期演算】，如发送命令【*本期演算】') 
  }

  async grid_fight (e) {

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
