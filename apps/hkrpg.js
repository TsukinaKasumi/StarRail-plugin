import plugin from '../../../lib/plugins/plugin.js'
import MysSRApi from '../runtime/MysSRApi.js'
import User from '../../genshin/model/user.js'
import fetch from 'node-fetch'
import GsCfg from '../../genshin/model/gsCfg.js'
import { gatchaType, statistics } from '../utils/gatcha.js'
import setting from '../utils/setting.js'
import { getPaylogUrl } from '../utils/payLog.js'
import { getAuthKey } from '../utils/authkey.js'
import _ from 'lodash'

export class hkrpg extends plugin {
  constructor (e) {
    super({
      name: '星穹铁道',
      dsc: '星穹铁道基本信息',
      /** https://oicqjs.github.io/oicq/#events */
      event: 'message',
      priority: 500,
      rule: [
        {
          /** 命令正则匹配 */
          reg: '^#(绑定星铁|星铁绑定)(uid|UID)?(\\s)*[1-9][0-9]{8}$',
          /** 执行方法 */
          fnc: 'bindSRUid'
        },
        {
          reg: '^#(星铁|星轨|崩铁|星穹铁道)(卡片|探索)$',
          fnc: 'card'
        },
        {
          reg: '^#(星铁|星轨|崩铁|星穹铁道)体力$',
          fnc: 'note'
        },
        {
          reg: '^#(星铁|星轨|崩铁|星穹铁道)(星琼获取|月历|月收入|收入|原石)$',
          fnc: 'month'
        },
        {
          reg: '^#(星铁|星轨|崩铁|星穹铁道)(.*)面板$',
          fnc: 'avatar'
        },
        {
          reg: '^#(星铁|星轨|崩铁|星穹铁道)帮助$',
          fnc: 'help'
        },
        {
          reg: '^#(星铁|星轨|崩铁|星穹铁道)抽卡链接(绑定)?$',
          fnc: 'bindAuthKey'
        },
        {
          reg: '^#(星铁|星轨|崩铁|星穹铁道)(跃迁|抽卡)(记录)?分析',
          fnc: 'gatcha'
        },
        {
          reg: '^#(星铁|星轨|崩铁|星穹铁道)抽卡帮助$',
          fnc: 'gatchahelp'
        },
        {
          reg: '^#星铁充值记录$',
          fnc: 'getPayLog'
        }
      ]
    })
    this.User = new User(e)
  }

  get appconfig () {
    return setting.getConfig('gachaHelp')
  }

  async card (e) {
    try {
      let user = this.e.sender.user_id
      let ats = e.message.filter(m => m.type === 'at')
      if (ats.length > 0 && !e.atBot) {
        user = ats[0].qq
      }
      let hasPersonalCK = false
      let uid = e.msg.replace(/^#(星铁|星轨|崩铁|星穹铁道)(卡片|探索)/, '')
      await this.miYoSummerGetUid()
      uid = uid || (await redis.get(`STAR_RAILWAY:UID:${user}`))
      if (!uid) {
        await e.reply('未绑定uid，请发送#绑定星铁uid进行绑定')
        return false
      }
      let ck = this.User.getCk()
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
        await e.reply('未绑定ck,发送ck帮助查看说明')
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
      await e.runtime.render('StarRail-plugin', '/card/card.html', result)
    } catch (err) {
      e.reply('cookie错误或未绑定ck')
    }
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
    await redis.setEx(`STAR_RAILWAY:userData:${gameUid}`, 60 * 60, JSON.stringify(userData))
  }

  async note (e) {
    let user = this.e.sender.user_id
    let ats = e.message.filter(m => m.type === 'at')
    if (ats.length > 0 && !e.atBot) {
      user = ats[0].qq
    }
    await this.miYoSummerGetUid()
    let uid = await redis.get(`STAR_RAILWAY:UID:${user}`)
    if (!uid) {
      await e.reply('尚未绑定cookie')
      return false
    }
    let ck = await this.User.getCk()
    if (!ck || Object.keys(ck).filter(k => ck[k].ck).length === 0) {
      await e.reply('尚未绑定cookie')
      return false
    }

    let api = new MysSRApi(uid, ck)
    const { url, headers } = api.getUrl('srNote')
    let res = await fetch(url, {
      headers
    })

    let cardData = await res.json()
    if (!cardData || cardData.retcode != 0) return e.reply(cardData.message || '请求数据失败')
    let data = cardData.data
    data.expeditions.forEach(ex => {
      ex.remaining_time = formatDuration(ex.remaining_time)
	  if (ex.remaining_time == '00时00分') ex.remaining_time = '委托已完成'
    })
	logger.warn(data.expeditions)
    if (data.max_stamina === data.current_stamina) {
      data.ktl_full = '开拓力已全部恢复'
    } else {
      data.ktl_full = `距开拓力恢复满${formatDuration(data.stamina_recover_time)}`
    }
    data.uid = uid // uid显示
    data.ktl_name = e.nickname // 名字显示
    data.ktl_qq = parseInt(e.user_id)// QQ头像
    await e.runtime.render('StarRail-plugin', '/note/note.html', data)
  }

  async month (e) {
    let user = this.e.sender.user_id
    let ats = e.message.filter(m => m.type === 'at')

    if (ats.length > 0 && !e.atBot) {
      user = ats[0].qq
    }
    let uid = await redis.get(`STAR_RAILWAY:UID:${user}`)
    await this.miYoSummerGetUid()
    if (!uid) {
      await e.reply('尚未绑定cookie')
      return false
    }
    let ck = await this.User.getCk()
    if (!ck || Object.keys(ck).filter(k => ck[k].ck).length === 0) {
      await e.reply('尚未绑定cookie')
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

  async avatar (e) {
    try {
      let uid = e.msg.replace(/^#(星铁|星轨|崩铁|星穹铁道)?.*面板/, '')
      let avatar = e.msg.replace(/^#(星铁|星轨|崩铁|星穹铁道)?/, '').replace('面板', '')
      if (!uid) {
        let user = this.e.sender.user_id
        let ats = e.message.filter(m => m.type === 'at')
        if (ats.length > 0 && !e.atBot) {
          user = ats[0].qq
        }
        uid = await redis.get(`STAR_RAILWAY:UID:${user}`)
      }
      await this.miYoSummerGetUid()
      if (!uid) {
        await e.reply('尚未绑定cookie')
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
    } catch (err) {
      e.reply('未绑定ck,也有可能是角色未佩戴\n光锥请佩戴光锥后重新查看面板')
    }
  }

  async gatcha (e) {
    let user = this.e.sender.user_id
    let type = 11
    let typeName = e.msg.replace(/^#(星铁|星轨|崩铁|星穹铁道)(抽卡|跃迁)(记录)?分析/, '')
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
      await e.reply('未绑定抽卡链接，请点击链接查看说明\nhttps://docs.qq.com/doc/DTVF1REhRTm9mbGZ4?u=be8555d8e8dd4897a8017e43140ef651\n发送[#星铁抽卡链接]绑定')
      return false
    }
    let result = {}
    result = await statistics(type, authKey)
    result.typeName = gatchaType[type]
    await e.runtime.render('StarRail-plugin', '/gatcha/gatcha.html', result)
  }

  async gatchahelp (e) {
    await e.reply(`抽卡链接获取教程：${this.appconfig.docs}`)
  }

  async help (e) {
    await e.runtime.render('StarRail-plugin', '/help/help.html')
  }

  /** 复读 */
  async bindSRUid () {
    let uid = parseInt(this.e.msg.replace(/[^0-9]/ig, ''))
    let user = this.e.sender.user_id
    await redis.set(`STAR_RAILWAY:UID:${user}`, uid)
    /** 复读内容 */
    this.reply('绑定成功', false)
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

  async getPayLog (e) {
    let ck = await this.User.getCk()
    let api = new MysSRApi('', ck)
    const { url, headers } = api.getUrl('srUser')
    let userRes = await fetch(url, { headers })
    let uid
    try {
      uid = (await userRes.json())?.data?.list?.filter(i => i.game_biz.includes('hkrpg'))[0].game_uid
    } catch (e) {
      await e.reply('请安装逍遥插件并扫码绑定才能使用本功能哦')
      return false
    }
    if (!uid) {
      await e.reply('请安装逍遥插件并扫码绑定才能使用本功能哦')
      return false
    }
    let authKey
    try {
      authKey = await getAuthKey(e, uid)
    } catch (err) {
      // 未安装逍遥
      await e.reply('请安装逍遥插件并扫码绑定才能使用本功能哦')
      return false
    }
    if (!authKey) {
      await e.reply('请安装逍遥插件并扫码绑定才能使用本功能哦')
      return false
    }
    authKey = encodeURIComponent(authKey)
    let result = []
    let page = 1
    let size = 10
    let payLogUrl = getPaylogUrl(authKey, page, size)
    let res = await fetch(payLogUrl)
    let payLogList = await res.json()
    result.push(...payLogList.data.list)
    page++
    while (payLogList.data.list && payLogList.data.list.length > 0) {
      payLogUrl = getPaylogUrl(authKey, page, size)
      res = await fetch(payLogUrl)
      result.push(...payLogList.data.list)
      page++
    }
    result = result.filter(r => r.add_num > 0)
    payLogList = await res.json()
    let t = result.map(i => {
      return `${i.time}: ${i.action} 获得${i.add_num}古老梦华`
    }).join('\n')
    await e.reply(t)
  }
}

function formatDuration (seconds) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours.toString().padStart(2, '0')}时${minutes.toString().padStart(2, '0')}分`
}
