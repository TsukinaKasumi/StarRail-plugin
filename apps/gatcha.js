import moment from 'moment'
import plugin from '../../../lib/plugins/plugin.js'
import common from "../../../lib/common/common.js"
import { rulePrefix } from '../utils/common.js'
import runtimeRender from '../common/runtimeRender.js'
import GatchaData from '../utils/gatcha/index.js'
import setting from '../utils/setting.js'

export class Gatcha extends plugin {
  constructor (e) {
    super({
      name: '星铁plug抽卡分析',
      dsc: '星铁plug抽卡分析',
      /** https://oicqjs.github.io/oicq/#events */
      event: 'message',
      priority: -114514,
      rule: [
        {
          reg: `^${rulePrefix}抽卡链接(绑定)?$`,
          fnc: 'bindAuthKey'
        },
        {
          reg: `^${rulePrefix}(角色|光锥|武器|常驻|新手)?(跃迁|抽卡)?(记录|分析|统计)`,
          fnc: 'gatcha'
        },
        {
          reg: `^${rulePrefix}抽卡帮助$`,
          fnc: 'gatchahelp'
        },
        {
          reg: `^${rulePrefix}更新(抽卡|跃迁)(记录)?$`,
          fnc: 'updateGatcha'
        }
      ]
    })
  }

  get appconfig () {
    return setting.getConfig('gachaHelp')
  }

  async gatchahelp (e) {
    await e.reply(`抽卡链接获取教程：${this.appconfig.docs}`)
  }

  async bindAuthKey (e) {
    if (!e.isPrivate && !this.appconfig.gatchaUrlGroup) {
      await this.reply('请私聊绑定', false, { at: true })
      return false
    }
    this.setContext('doBindAuthKey')
    await this.reply('请发送抽卡链接', false, { at: true })
  }

  async doBindAuthKey () {
    if (!this.e.isPrivate && !this.appconfig.gatchaUrlGroup) {
      await this.reply('请私聊发送抽卡链接', false, { at: true })
      return false
    }
    try {
      const uid = await redis.get(`STAR_RAILWAY:UID:${this.e.user_id}`)
      let key = this.e.msg.trim()
      key = key.split('authkey=')[1].split('&')[0]
      let user = this.e.user_id
      await redis.set(`STAR_RAILWAY:AUTH_KEY:${user}`, key)
      await this.reply('绑定成功，正在获取数据', false)
      console.log('uid', uid)
      await redis.set(`STAR_RAILWAY:GATCHA_LASTTIME:${uid}`, '')
      await this.updateGatcha(this.e)
    } catch (error) {
      this.reply('抽卡链接错误，请检查链接重新绑定', false)
    }
    this.finish('doBindAuthKey')
  }

  async getAuthKey () {
    let user = this.e.user_id
    let ats = this.e.message.filter((m) => m.type === 'at')
    if (ats.length > 0 && !this.e.atBot) {
      user = ats[0].qq
    }
    const authKey = await redis.get(`STAR_RAILWAY:AUTH_KEY:${user}`)
    if (!authKey) {
      await this.e.reply(
        `未绑定抽卡链接，请点击链接查看说明\n${this.appconfig.docs}\n发送[#星铁抽卡链接]绑定`
      )
      return false
    }
    return authKey
  }

  async updateGatcha (e) {
    let user = e.user_id
    const ats = e.message.filter(m => m.type === 'at')
    if (ats.length > 0 && !e.atBot) {
      user = ats[0].qq
    }

    const uid = await redis.get(`STAR_RAILWAY:UID:${user}`)
    if (!uid) {
      return e.reply('未绑定uid，请发送#星铁绑定uid进行绑定')
    }

    try {
      const authKey = await this.getAuthKey()
      const date = moment()
      const lastTime = await redis.get(`STAR_RAILWAY:GATCHA_LASTTIME:${uid}`)

      if (lastTime && date.diff(moment(lastTime), 'h') < 1) {
        await e.reply(`[${uid}]近期已经更新过数据了，上次更新时间：${lastTime}，两次更新间隔请大于1小时`)
        return false
      }

      redis.set(`STAR_RAILWAY:GATCHA_LASTTIME:${uid}`, date.format('YYYY-MM-DD HH:mm:ss'))

      await e.reply(`正在获取[${uid}]的跃迁数据...`)
      const gatcha = new GatchaData(uid, authKey)
      await gatcha.updateData()
      const msg = common.makeForwardMsg(e, ['跃迁数据获取成功，你可以使用：', '*跃迁分析\n*角色分析\n*光锥分析\n*常驻分析', '查看具体的跃迁数据'])
      await e.reply(msg)
    } catch (error) {
      console.log(error)
      await redis.set(`STAR_RAILWAY:GATCHA_LASTTIME:${uid}`, '')
      await e.reply('抽卡链接已过期，请重新获取并绑定')
    }
  }

  async gatcha (e) {
    let user = e.user_id
    const ats = e.message.filter(m => m.type === 'at')
    if (ats.length > 0 && !e.atBot) {
      user = ats[0].qq
    }
    const uid = await redis.get(`STAR_RAILWAY:UID:${user}`)
    try {
      const typeName = e.msg.replace(/#|\*|＊|星铁|星轨|崩铁|星穹铁道|穹批|跃迁|抽卡|记录|分析/g, '')
      let type = 0
      switch (typeName) {
        case '角色': {
          type = 11
          break
        }
        case '武器':
        case '光锥': {
          type = 12
          break
        }
        case '常驻': {
          type = 1
          break
        }
        case '新手': {
          type = 2
          break
        }
        default: {
          // eslint-disable-next-line no-unused-vars
          type = 0
          break
        }
      }

      const gatcha = new GatchaData(uid, type === 2 ? await this.getAuthKey() : '')
      const stat = await gatcha.stat(type)
      // console.log({
      //   ...stat,
      //   uid
      // })
      await runtimeRender(e, '/gatcha/new.html', {
        ...stat,
        uid,
        type,
        filterRank: type === 0 ? 5 : 4
      })
    } catch (err) {
      logger.error(err)
      await e.reply('本地暂无抽卡记录，请发送#星铁更新跃迁，更新抽卡记录')
    }
  }
}

