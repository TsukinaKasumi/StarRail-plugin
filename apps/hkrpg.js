import plugin from '../../../lib/plugins/plugin.js'
import MysSRApi from '../runtime/MysSRApi.js'
import User from '../../genshin/model/user.js'
import fetch from 'node-fetch'
import GsCfg from '../../genshin/model/gsCfg.js'
import { gatchaType, statistics } from '../utils/gatcha.js';

export class hkrpg extends plugin {
  constructor (e) {
    super({
      name: '星穹铁道',
      dsc: '星穹铁道基本信息',
      /** https://oicqjs.github.io/oicq/#events */
      event: 'message',
      priority: 5000,
      rule: [
        {
          /** 命令正则匹配 */
          reg: '^#绑定星铁(uid|UID)?(\\s)*[1-9][0-9]{8}$',
          /** 执行方法 */
          fnc: 'bindSRUid'
        },
        {
          reg: '^#星铁(卡片|探索)',
          fnc: 'card'
        },
        {
          reg: '^#星铁体力$',
          fnc: 'note'
        },
        {
          reg: '^#星铁(星琼|月历|月收入|收入)$',
          fnc: 'month'
        },
        {
          reg: '^#(星铁)?.*面板',
          fnc: 'avatar'
        },
        {
          reg: '^#星铁帮助$',
          fnc: 'help'
        },
        {
          reg: '^#星铁抽卡链接$',
          fnc: 'bindAuthKey'
        },
        {
          reg: '^#星铁抽卡分析',
          fnc: 'gatcha'
        }
      ]
    })
    this.User = new User(e)
  }

  async card (e) {
    let user = this.e.sender.user_id
    let ats = e.message.filter(m => m.type === 'at')
    if (ats.length > 0 && !e.atBot) {
      user = ats[0].qq
    }
    let hasPersonalCK = false
    let uid = e.msg.replace(/^#星铁卡片/, '')
    if (!uid) {
      uid = await redis.get(`STAR_RAILWAY:UID:${user}`)
    }
    if (!uid) {
      await e.reply('未绑定uid，请发送#绑定星铁uid进行绑定')
      return false
    }
    let ck = await this.User.getCk()
    if (!ck || Object.keys(ck).filter(k => ck[k].ck).length === 0) {
      let ckArr = GsCfg.getConfig('mys', 'pubCk') || []
      ck = ckArr[0]
    } else {
      hasPersonalCK = true
    }

    let api = new MysSRApi(uid, ck)
    const { url, headers } = api.getUrl('srCard')
    let res = await fetch(url, {
      headers
    })
    let cardData = await res.json()
    let result = cardData.data
    if (hasPersonalCK) {
      let userUrl = api.getUrl('srUser')
      res = await fetch(userUrl.url, {
        headers: userUrl.headers
      })
      let userData = await res.json()
      result = Object.assign(cardData.data, userData.data.list[0])
      result.level = result.level + '级'
    } else {
      result.game_uid = uid
      result.nickname = '开拓者'
    }
    await e.runtime.render('StarRail-plugin', '/card/card.html', result)
  }

  async note (e) {
    let user = this.e.sender.user_id
    let ats = e.message.filter(m => m.type === 'at')
    if (ats.length > 0 && !e.atBot) {
      user = ats[0].qq
    }
    let uid = await redis.get(`STAR_RAILWAY:UID:${user}`)
    if (!uid) {
      await e.reply('未绑定uid，请发送#绑定星铁uid进行绑定')
      return false
    }
    let ck = await this.User.getCk()
    if (!ck || Object.keys(ck).filter(k => ck[k].ck).length === 0) {
      await e.reply('未绑定ck')
      return false
    }

    let api = new MysSRApi(uid, ck)
    const { url, headers } = api.getUrl('srNote')
    let res = await fetch(url, {
      headers
    })

    let cardData = await res.json()
    let data = cardData.data
    data.expeditions.forEach(ex => {
      ex.remaining_time = formatDuration(ex.remaining_time)
    })
    if (data.max_stamina === data.current_stamina) {
      data.ktl_full = '开拓力已全部恢复'
    } else {
      data.ktl_full = `距开拓力恢复满${formatDuration(data.stamina_recover_time)}`
    }
    data.ktl_name = e.nickname
    data.ktl_user_id = `http://q2.qlogo.cn/headimg_dl?dst_uin=${e.user_id}&amp;spec=640`
    await e.runtime.render('StarRail-plugin', '/note/note.html', data)
  }

  async month (e) {
    let user = this.e.sender.user_id
    let ats = e.message.filter(m => m.type === 'at')

    if (ats.length > 0 && !e.atBot) {
      user = ats[0].qq
    }
    let uid = await redis.get(`STAR_RAILWAY:UID:${user}`)
    if (!uid) {
      await e.reply('未绑定uid，请发送#绑定星铁uid进行绑定')
      return false
    }
    let ck = await this.User.getCk()
    if (!ck || Object.keys(ck).filter(k => ck[k].ck).length === 0) {
      await e.reply('未绑定ck')
      return false
    }

    let api = new MysSRApi(uid, ck)
    const { url, headers } = api.getUrl('srMonth')
    let res = await fetch(url, {
      headers
    })
    let cardData = await res.json()
    let data = cardData.data
    await e.runtime.render('StarRail-plugin', '/month/month.html', data)
  }

  async avatar (e) {
    let uid = e.msg.replace(/^#(星铁)?.*面板/, '')
    let avatar = e.msg.replace(/^#(星铁)?/, '').replace('面板', '')
    if (!uid) {
      let user = this.e.sender.user_id
      let ats = e.message.filter(m => m.type === 'at')
      if (ats.length > 0 && !e.atBot) {
        user = ats[0].qq
      }
      uid = await redis.get(`STAR_RAILWAY:UID:${user}`)
    }
    if (!uid) {
      await e.reply('未绑定uid，请发送#绑定星铁uid进行绑定')
      return false
    }
    let ck = await this.User.getCk()
    if (!ck || Object.keys(ck).filter(k => ck[k].ck).length === 0) {
      let ckArr = GsCfg.getConfig('mys', 'pubCk') || []
      ck = ckArr[0]
    }

    let api = new MysSRApi(uid, ck)
    const { url, headers } = api.getUrl('srCharacterDetail')
    let res = await fetch(url, {
      headers
    })
    let cardData = await res.json()
    let avatarItem = cardData.data.avatar_list.filter(i => i.name === avatar)
    if (avatarItem.length > 0) {
      let data = avatarItem[0]
      let tops = [40, 153, 268, 383, 490, 605]
      data.ranks.forEach((rank, index) => {
        rank.width = rank.is_unlocked ? 0 : 60
        rank.top = tops[index]
      })
      let bgColorMap = {
        2: {
          bg: '#73de7b',
          border: '#3aa142'
        },
        3: {
          bg: '#407ac4',
          border: '#1959ab'
        },
        4: {
          bg: '#9166da',
          border: '#6234b0'
        },
        5: {
          bg: '#cb9b6d',
          border: '#b67333'
        }
      }
      data.relics.forEach(r => {
        r.bg = bgColorMap[r.rarity].bg
        r.border = bgColorMap[r.rarity].border
      })
      data.ornaments.forEach(r => {
        r.bg = bgColorMap[r.rarity].bg
        r.border = bgColorMap[r.rarity].border
      })
      data.uid = uid

      let rarity = []
      for (let i = 0; i < data.rarity; i++) {
        rarity.push(1)
      }
      data.rarity = rarity
      await e.runtime.render('StarRail-plugin', '/avatar/avatar.html', data)
    } else {
      await e.reply('请确认该角色存在且在面板首页')
    }
  }

  async gatcha (e) {
    let user = this.e.sender.user_id
    let type = 11
    let typeName = e.msg.replace(/^#星铁抽卡分析/, '')
    if (typeName.includes('常驻')) {
      type = 1
    } else if (typeName.includes('武器') || typeName.includes('光锥')) {
      type = 12
    } else if (typeName.includes('新手')) {
      type = 2
    }
    // let user = this.e.sender.user_id
    let ats = e.message.filter(m => m.type === 'at')
    if (ats.length > 0 && !e.atBot) {
      user = ats[0].qq
    }
    let authKey = await redis.get(`STAR_RAILWAY:AUTH_KEY:${user}`)
    if (!authKey) {
      await e.reply('未绑定抽卡链接，请点击链接查看说明\nhttps://starrailstation.com/cn/warp#import')
      return false
    }
    let result = {}
    result = await statistics(type, authKey)
    result.typeName = gatchaType[type]
    await e.runtime.render('StarRail-plugin', '/gatcha/gatcha.html', result)
  }

  async help (e) {
    let helpData = '#绑定星铁uid：绑定星铁uid\n#星铁卡片：查看卡片\n#星铁体力：查看开拓力\n#星铁收入：查看星铁收入\n#星铁[角色名]面板：查看面板\n＃星铁抽卡分析角色/光椎/常驻: 抽卡分析'
    await e.reply(helpData)
  }

  /** 复读 */
  async bindSRUid () {
  //   /** 设置上下文，后续接收到内容会执行doRep方法 */
  //   this.setContext('doBindSRUid')
  //   /** 回复 */
  //   await this.reply('请发送uid', false, { at: true })
  // }

    // /** 接受内容 */
    // async doBindSRUid () {

    let uid = parseInt(this.e.msg.replace(/[^0-9]/ig, ''))
    let user = this.e.sender.user_id
    await redis.set(`STAR_RAILWAY:UID:${user}`, uid)
    /** 复读内容 */
    this.reply('绑定成功', false)
    /** 结束上下文 */
    // this.finish('doBindSRUid')
  }

  async bindAuthKey (e) {
    this.setContext('doBindAuthKey')
    /** 回复 */
    await this.reply('请发送抽卡链接', false, { at: true })
  }

  async doBindAuthKey () {
    let key = this.e.msg.trim()
    key = key.split('authkey=')[1].split('&')[0]
    let user = this.e.sender.user_id
    await redis.set(`STAR_RAILWAY:AUTH_KEY:${user}`, key)
    /** 复读内容 */
    this.reply('绑定成功', false)
    /** 结束上下文 */
    this.finish('doBindAuthKey')
  }
}

function formatDuration (seconds) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours.toString().padStart(2, '0')}时${minutes.toString().padStart(2, '0')}分`
}
