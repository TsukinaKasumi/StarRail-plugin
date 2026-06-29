import User from '../../genshin/model/user.js'
import MysSRApi from '../runtime/MysSRApi.js'
import setting from '../utils/setting.js'
import fetch from 'node-fetch'
import _ from 'lodash'
import { getCk, rulePrefix } from '../utils/common.js'
import runtimeRender from '../common/runtimeRender.js'
import GsCfg from '../../genshin/model/gsCfg.js'
import MysInfo from '../../genshin/model/mys/mysInfo.js'

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

    let uid = await this.userUid(e)
    let ck = await this.userCk(e, uid)

    let api = new MysSRApi(uid, ck)
    let schedule_type = '1'
    if (e.msg.indexOf('上期') > -1) {
      schedule_type = '2'
    }

    let deviceFp = await api.getData('getFp')
    if (deviceFp?.retcode !== 0) return false
    deviceFp = deviceFp?.data?.device_fp

    let res = await api.getData('srRogue', { deviceFp, schedule_type })
    res = await api.checkCode(this.e, res, 'srRogue', { deviceFp, schedule_type })
    if (res.retcode !== 0) {
      return false
    }
    let data = Object.assign(res.data, { uid })
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

    let uid = await this.userUid(e)
    let ck = await this.userCk(e, uid)

    let api = new MysSRApi(uid, ck)
    let deviceFp = await api.getData('getFp')
    if (deviceFp?.retcode !== 0) return false
    deviceFp = deviceFp?.data?.device_fp

    let res = await api.getData('srRogueLocust', { deviceFp })
    res = await api.checkCode(this.e, res, 'srRogueLocust', { deviceFp })
    if (res.retcode !== 0) {
      return false
    }
    let data = Object.assign(res.data, { uid })
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

    let uid = await this.userUid(e)
    let ck = await this.userCk(e, uid)

    let api = new MysSRApi(uid, ck)
    let deviceFp = await api.getData('getFp')
    if (deviceFp?.retcode !== 0) return false
    deviceFp = deviceFp?.data?.device_fp

    let res = await api.getData('srRogueTourn', { deviceFp })
    res = await api.checkCode(this.e, res, 'srRogueTourn', { deviceFp })
    if (res.retcode !== 0) {
      return false
    }
    let data = Object.assign(res.data, { uid })

    let title = {
      0: '',
      1: 'I',
      2: 'II',
      3: 'III',
      4: 'IV',
      5: 'V'
    }
    if (data.basic.weekly_record_brief.common_info_v2.id) {
      data.basic.weekly_record_brief.title = title[data.basic.weekly_record_brief.common_info_v2.id]
    }
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

    let uid = await this.userUid(e)
    let ck = await this.userCk(e, uid)

    let indexMap = { 一: 1, 二: 2, 三: 3 }
    let indexStr = e.msg.match(/(一|二|三)$/)?.[0]
    let index = indexMap[indexStr] || 1

    let api = new MysSRApi(uid, ck)
    let deviceFp = await api.getData('getFp')
    if (deviceFp?.retcode !== 0) return false
    deviceFp = deviceFp?.data?.device_fp

    let res = await api.getData('srRogueTourn', { deviceFp })
    res = await api.checkCode(this.e, res, 'srRogueTourn', { deviceFp })
    if (res.retcode !== 0) {
      return false
    }

    let data = res.data
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

    let uid = await this.userUid(e)
    let ck = await this.userCk(e, uid)

    let indexMap = { 一: 1, 二: 2, 三: 3 }
    let indexStr = e.msg.match(/(一|二|三)/)?.[0]
    let index = indexMap[indexStr] || 1

    let period = e.msg.match(/上期|上周/) ? 'last_week_detail' : 'cur_week_detail'
    let periodName = e.msg.match(/上期|上周/) ? '上期' : '本期'

    let api = new MysSRApi(uid, ck)
    let deviceFp = await api.getData('getFp')
    if (deviceFp?.retcode !== 0) return false
    deviceFp = deviceFp?.data?.device_fp

    let res = await api.getData('srRogueTourn', { deviceFp })
    res = await api.checkCode(this.e, res, 'srRogueTourn', { deviceFp })
    if (res.retcode !== 0) {
      return false
    }

    let data = res.data
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

  async userUid (e) {
    let uid = e.msg.match(/\d+/)?.[0] || await MysInfo.getUid(e, false)
    if (!uid) {
      await e.reply('找不到uid，请：#刷新ck 或者：#扫码登录', true)
      return false
    }

    return uid
  }

  async userCk (e, uid) {
    let game = e.game
    let ck = await MysInfo.checkUidBing(uid, game)
    ck = ck.ck
    if (!ck) {
      await e.reply(`uid:${uid}当前尚未绑定Cookie，${this.app2config.docs}`)
      return false
    }

    return ck
  }
}
