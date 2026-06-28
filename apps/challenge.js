import fetch from 'node-fetch'
import _ from 'lodash'
import moment from 'moment'
import User from '../../genshin/model/user.js'
import MysSRApi from '../runtime/MysSRApi.js'
import setting from '../utils/setting.js'
import { getCk, rulePrefix } from '../utils/common.js'
import runtimeRender from '../common/runtimeRender.js'
import MysInfo from '../../genshin/model/mys/mysInfo.js'

export class Challenge extends plugin {
  constructor (e) {
    super({
      name: '星铁plugin-深渊',
      dsc: '星穹铁道深渊信息',
      /** https://oicqjs.github.io/oicq/#events */
      event: 'message',
      priority: setting.getConfig('gachaHelp').noteFlag ? 5 : 500,
      rule: [
        {
          reg: `^${rulePrefix}(上期|本期)?(简易)?(深渊)`,
          fnc: 'challenge'
        },
        {
          reg: `^${rulePrefix}(最新|当期)(简易)?(深渊)`,
          fnc: 'challengeCurrent'
        },
        {
          reg: `^${rulePrefix}(上期|本期)?(简易)?(忘却|忘却之庭|混沌|混沌回忆)`,
          fnc: 'challengeForgottenHall'
        },
        {
          reg: `^${rulePrefix}(上期|本期)?(简易)?(虚构|虚构叙事)`,
          fnc: 'challengeStory'
        },
        {
          reg: `^${rulePrefix}(上期|本期)?(简易)?(末日|末日幻影)`,
          fnc: 'challengeBoss'
        },
        {
          reg: `^${rulePrefix}(往期|上期|本期)?(简易)?(异乡|异相|异向|仲裁|异相仲裁)`,
          fnc: 'challengePeak'
        }
      ]
    })
    this.User = new User(e)
  }

  async queryChallenge (e, challengeType, all, uid, ck) {
    this.e.isSr = true
    this.isSr = true
    const simple = this.e.msg.match('简易')
    const recent = this.e.msg.match('往期')
    const last = this.e.msg.match('上期')

    if (all !== true) {
      uid = await this.userUid(e)
      ck = await this.userCk(e, uid)
    }

    let scheduleType = '1'
    if (last) {
      scheduleType = '2'
    }
    if ((recent || last) && challengeType == 3) {
      scheduleType = '3'
    }

    let api = new MysSRApi(uid, ck)
    let sdk = api.getUrl('getFp')
    let fpRes = await fetch(sdk.url, { headers: sdk.headers, method: 'POST', body: sdk.body })
    fpRes = await fpRes.json()
    let deviceFp = fpRes?.data?.device_fp
    if (deviceFp) {
      await redis.set(`STARRAIL:DEVICE_FP:${uid}`, deviceFp, { EX: 86400 * 7 })
    }
    let challengeData, res, simpleRes
    // 先查详细的
    if (!simple) {
      let requestType = [
        'srChallengeBoss',
        'srChallengeStory',
        'srChallenge',
        'srChallengePeak'
      ][challengeType]
      res = await api.getData(requestType, { deviceFp, schedule_type: scheduleType })
      res = await api.checkCode(this.e, res, requestType, { deviceFp, schedule_type: scheduleType })
    }
    if (simple || res.retcode !== 0) {
      // 详细的出验证码了，查简单的
      let simpleRequestType = [
        'srChallengeBossSimple',
        'srChallengeStorySimple',
        'srChallengeSimple',
        'srChallengePeakSimple'
      ][challengeType]
      simpleRes = await api.getData(simpleRequestType, { deviceFp, schedule_type: scheduleType })
      simpleRes = await api.checkCode(this.e, simpleRes, simpleRequestType, { deviceFp, schedule_type: scheduleType })
      // 连简单的也出验证码，打住
      if (simpleRes.retcode !== 0) return false
    }
    if (!simple && res.retcode === 0) {
      challengeData = res
    } else if (simple && simpleRes.retcode === 0) {
      challengeData = simpleRes
    } else {
      challengeData = simpleRes
      let queryName = [
        '末日幻影',
        '虚构叙事',
        '忘却之庭',
        '异相仲裁'
      ][challengeType]
      logger.warn(`星铁${queryName}详细信息出现验证码，仅显示最后一层信息`)
    }
    // await api.checkCode(this.e, challengeData, 'srNote')
    // if (challengeData.retcode !== 0) {
    //   return false
    // }
    const data = { ...challengeData.data }

    // 根据 scheduleType 选择对应的 group（末日幻影/虚构叙事的 groups 包含本期和上期）
    if (data.groups && data.groups.length > 1) {
      const activeGroup = scheduleType === '1'
        ? data.groups.find(g => g.status === 'New')
        : data.groups.find(g => g.status === 'End')
      if (activeGroup) {
        data.groups = [activeGroup]
      }
    }

    if (recent && challengeType == 3) return {
      data,
      uid,
      challengeType,
      type: scheduleType
    }
    // 最新更新的深渊
    data.currentType = this.getCurrentChallengeType()
    // 起止日期要分开处理
    if ([0, 1].includes(challengeType)) {
      // 末日幻影、虚构叙事
      data.beginTime = this.timeFormat(data.groups[0].begin_time)
      data.endTime = this.timeFormat(data.groups[0].end_time)
    } else if (challengeType == 2) {
      // 忘却之庭
      data.beginTime = this.timeFormat(data.begin_time)
      data.endTime = this.timeFormat(data.end_time)
    } else {
      // 异相仲裁
      data.peak_records = last ? data.challenge_peak_records[1] : data.challenge_peak_records[0]
      data.beginTime = this.timeFormat(data.peak_records.group.begin_time)
      data.endTime = this.timeFormat(data.peak_records.group.end_time)
    }
    if (challengeType != 3) {
      data.all_floor_detail = _.map(data.all_floor_detail, (floor) => {
        return {
          ...floor,
          node_1: {
            ...floor.node_1,
            ...(/challenge_time/.test(floor.node_1) && {
              challengeTime: this.timeFormat(floor.node_1.challenge_time, 'YYYY.MM.DD HH:mm')
            }) // 快速通关就没有 challenge_time 这个属性
          },
          node_2: {
            ...floor.node_2,
            ...(/challenge_time/.test(floor.node_2) && {
              challengeTime: this.timeFormat(floor.node_2.challenge_time, 'YYYY.MM.DD HH:mm')
            })
          },
          ...(floor.node_3 && {
            node_3: {
              ...floor.node_3,
              ...(/challenge_time/.test(floor.node_3) && {
                challengeTime: this.timeFormat(floor.node_3.challenge_time, 'YYYY.MM.DD HH:mm')
              })
            }
          })
        }
      })
    } else {
      // 异相仲裁
      // 王棋
      if (data.peak_records.boss_record) {
        data.peak_records.boss_record.challengeTime =
          this.timeFormat(data.peak_records.boss_record.challenge_time, 'YYYY.MM.DD HH:mm')
      }

      // 骑士
      data.peak_records.mob_records = 
        _.map(data.peak_records.mob_records, (record) => {
          return {
            ...record,
            ...(/challenge_time/.test(record) && {
              challengeTime: this.timeFormat(record.challenge_time, 'YYYY.MM.DD HH:mm')
            })
          }
        })
      
      // TODO: 如果打了部分骑士关卡（e.g., 只打了第三关），mob_records 会长什么样？
    }
    // 末日幻影、虚构叙事：计算两边节点的总分
    if ([0, 1].includes(challengeType)) {
      data.all_floor_detail = _.map(data.all_floor_detail, (floor) => {
        if (floor.node_1.score != null) {
          let totalScore = parseInt(floor.node_1.score) + parseInt(floor.node_2.score)
          if (floor.node_3 && floor.is_tierce) {
            totalScore += parseInt(floor.node_3.score)
          }
          return {
            ...floor,
            score: totalScore.toString()
          }
        } else {
          return floor
        }
      })
    }
    return {
      data,
      uid,
      challengeType,
      type: scheduleType
    }
  }

  recentPeak (data) {
    // 异相仲裁
    data.beginTime = this.timeFormat(data.group.begin_time)
    data.endTime = this.timeFormat(data.group.end_time)
    // 王棋
    if (data.boss_record) {
      data.boss_record.challengeTime =
        this.timeFormat(data.boss_record.challenge_time, 'YYYY.MM.DD HH:mm')
    }

    // 骑士
    data.mob_records = 
      _.map(data.mob_records, (record) => {
        return {
          ...record,
          ...(/challenge_time/.test(record) && {
            challengeTime: this.timeFormat(record.challenge_time, 'YYYY.MM.DD HH:mm')
          })
        }
      })

    return { ...data }
  }

  async challengeForgottenHall (e) {
    await e.reply('正在获取忘却之庭数据，请稍后……')
    let res = await this.queryChallenge(e, 2)
    if (!res) return false
    await runtimeRender(e, '/challenge/index.html', res)
  }

  async challengeStory (e) {
    await e.reply('正在获取虚构叙事数据，请稍后……')
    let res = await this.queryChallenge(e, 1)
    if (!res) return false
    await runtimeRender(e, '/challenge/index.html', res)
  }

  async challengeBoss (e) {
    await e.reply('正在获取末日幻影数据，请稍后……')
    let res = await this.queryChallenge(e, 0)
    if (!res) return false
    await runtimeRender(e, '/challenge/index.html', res)
  }

  async challengePeak (e) {
    await e.reply('正在获取异相仲裁数据，请稍后……')
    let tplFile = '/challenge/index_peak.html'
    let res = await this.queryChallenge(e, 3)
    if (!res) return false
    if (e.msg.match('往期')) {
      tplFile = '/challenge/peak_recent.html'
      let present = this.recentPeak(res.data.challenge_peak_records[0])
      let last = this.recentPeak(res.data.challenge_peak_records[1])
      let early = this.recentPeak(res.data.challenge_peak_records[2])

      res = {
        ...res,
        present,
        last,
        early
      }
    }
    // 三路深渊的逻辑还不太一样，这里单独渲染
    // index_peak
    await runtimeRender(e, `${tplFile}`, res)
  }

  async challenge (e) {
    await e.reply('正在获取全部深渊数据，请稍后……')
    let uid = await this.userUid(e)
    let ck = await this.userCk(e, uid)
    let hall = await this.queryChallenge(e, 2, true, uid, ck)
    if (!hall) return false
    let story = await this.queryChallenge(e, 1, true, uid, ck)
    if (!story) return false
    let boss = await this.queryChallenge(e, 0, true, uid, ck)
    if (!boss) return false
    // TODO: 要不要把（没星琼奖励的）异相仲裁也加进来？
    let res = { hall, story, boss }
    await runtimeRender(e, '/challenge/index_all.html', res)
  }

  async challengeCurrent (e) {
    await e.reply('正在获取最新深渊数据，请稍后……')
    let res = await this.queryChallenge(e, this.getCurrentChallengeType())
    if (!res) return false
    await runtimeRender(e, '/challenge/index.html', res)
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

  timeFormat (timeObj, format = 'YYYY.MM.DD') {
    const { year, month, day, hour, minute } = timeObj
    return moment({
      year,
      month: month - 1,
      day,
      hour,
      minute
    }).format(format)
  }

  getCurrentChallengeType () {
    // 获取当前时间
    let currentTime = new Date()

    // 获取第一期混沌回忆的时间
    let firstTime = new Date('2024-06-24T04:00:00')

    // 计算时间差距（以毫秒为单位）
    if (currentTime < firstTime) {
      logger.error('当前系统时间早于第一期末日幻影时间，请检查系统配置！')
    }
    let timeDiff = currentTime - firstTime
    // 2周（14天）为一个周期
    let periodNum = Math.floor(timeDiff / (1000 * 60 * 60 * 24 * 14))
    // 0: 末日
    // 1: 虚构
    // 2: 混沌
    return periodNum % 3
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

  get app2config () {
    return setting.getConfig('cookieHelp')
  }
}
