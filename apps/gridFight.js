import User from '../../genshin/model/user.js'
import MysSRApi from '../runtime/MysSRApi.js'
import setting from '../utils/setting.js'
import fetch from 'node-fetch'
import _ from 'lodash'
import { getCk, rulePrefix } from '../utils/common.js'
import runtimeRender from '../common/runtimeRender.js'
import GsCfg from '../../genshin/model/gsCfg.js'
import MysInfo from '../../genshin/model/mys/mysInfo.js'

export class GridFight extends plugin {
  constructor (e) {
    super({
      name: '星铁plugin-货币战争',
      dsc: '星穹铁道货币战争信息',
      event: 'message',
      priority: setting.getConfig('gachaHelp').noteFlag ? 5 : 500,
      rule: [
        {
          reg: `^${rulePrefix}(货币(战争)?|币战)$`,
          fnc: 'grid_fight'
        },
        {
          reg: `^${rulePrefix}(货币(战争)?|币战)(战绩|回顾|战报|记录)(一|二|三|四|五|六|七|八|九|十)?$`,
          fnc: 'grid_fight_archive'
        }
      ]
    })
    this.User = new User(e)
  }

  get app2config () {
    return setting.getConfig('cookieHelp')
  }

  async grid_fight (e) {
    this.e.isSr = true
    this.isSr = true

    let uid = await this.userUid(e)
    let ck = await this.userCk(e, uid)

    let api = new MysSRApi(uid, ck)
    let deviceFp = await api.getData('getFp')
    if (deviceFp?.retcode !== 0) return false
    deviceFp = deviceFp?.data?.device_fp

    let res = await api.getData('srGridFight', { deviceFp })
    res = await api.checkCode(this.e, res, 'srGridFight', { deviceFp })
    if (res.retcode !== 0) {
      return false
    }

    let data = Object.assign(res.data, { uid })

    await runtimeRender(e, '/gridFight/gridFight.html', data, {
      scale: 1.4
    })
  }

  async grid_fight_archive (e) {
    this.e.isSr = true
    this.isSr = true

    let uid = await this.userUid(e)
    let ck = await this.userCk(e, uid)

    let indexMap = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 }
    let indexStr = e.msg.match(/(一|二|三|四|五|六|七|八|九|十)$/)?.[0]
    let index = indexMap[indexStr] || 1

    let api = new MysSRApi(uid, ck)
    let deviceFp = await api.getData('getFp')
    if (deviceFp?.retcode !== 0) return false
    deviceFp = deviceFp?.data?.device_fp
    if (deviceFp) {
      await redis.set(`STARRAIL:DEVICE_FP:${uid}`, deviceFp, { EX: 86400 * 7 })
    }

    let res = await api.getData('srGridFight', { deviceFp })
    res = await api.checkCode(this.e, res, 'srGridFight', { deviceFp })
    if (res.retcode !== 0) {
      return false
    }

    let data = res.data
    if (!data.grid_fight_archive_list || data.grid_fight_archive_list.length < index) {
      return e.reply(`未找到货币战争第${index}条记录`)
    }

    let record = data.grid_fight_archive_list[index - 1]

    // Prepare damage data
    let damageData = []
    if (record.lineup.damage_list) {
      // Create a map for quick lookup
      let entityMap = {}
      record.lineup.front_roles.forEach(r => { entityMap[r.role_id] = r })
      record.lineup.back_roles.forEach(r => { entityMap[r.role_id] = r })
      record.lineup.trait_list.forEach(t => { entityMap[t.trait_id] = t })

      damageData = record.lineup.damage_list.map(d => {
        let entity = entityMap[d.id]
        return {
          id: d.id,
          damage: parseFloat(d.damage),
          type: d.damage_type,
          entity: entity
        }
      }).sort((a, b) => b.damage - a.damage).slice(0, 5)

      // Calculate percentage for bars
      if (damageData.length > 0) {
        let maxDamage = damageData[0].damage
        damageData.forEach(d => {
          d.percent = maxDamage > 0 ? (d.damage / maxDamage * 100).toFixed(2) : 0
          // Format damage numbers
          if (d.damage >= 10000) {
            d.damageStr = (d.damage / 10000).toFixed(1) + '万'
          } else {
            d.damageStr = d.damage.toFixed(0)
          }
        })
      }
    }

    let renderData = {
      uid,
      grid_fight_brief: data.grid_fight_brief,
      record: record,
      index_of_archive: `${index} / ${data.grid_fight_archive_list.length}`,
      damageData: damageData
    }

    await runtimeRender(e, '/gridFight/gridFightArchive.html', renderData, {
      scale: 1.4
    })
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
