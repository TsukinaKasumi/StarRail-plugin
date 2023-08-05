import { exec} from 'child_process'
import User from '../../genshin/model/user.js'
import { getStoken} from './authkey.js'

export const rulePrefix = '((#|\\*)?(星铁|星轨|崩铁|星穹铁道|铁道|sr)|\\*|＊)'

export async function checkPnpm () {
  let npm = 'npm'
  let ret = await execSync('pnpm -v')
  if (ret.stdout) npm = 'pnpm'
  return npm
}

async function execSync (cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { windowsHide: true }, (error, stdout, stderr) => {
      resolve({ error, stdout, stderr })
    })
  })
}

export function statisticsOnlineDateGeneral (powerRecoverList) {
  let startTime = powerRecoverList[powerRecoverList.length - 1].time
  let firstLoginDate = startTime.slice(0, 10) // 2023-05-07
  firstLoginDate = new Date(firstLoginDate)
  const today = new Date()
  const allDates = {}
  let date = firstLoginDate
  // eslint-disable-next-line no-unmodified-loop-condition
  while (date <= today) {
    const formattedDate = date.toISOString().slice(0, 10) // 将日期对象转换为字符串
    allDates[formattedDate] = 0
    date.setDate(date.getDate() + 1)
  }
  powerRecoverList.forEach(record => {
    if (record.add_num === 1) {
      // 离线后重新上线，回复开拓力是统一算的，数字会比较大
      // 回复一点开拓力，认为前6分钟都在线
      allDates[record.time.slice(0, 10)] += 6
    }
  })
  Object.keys(allDates).forEach(key => {
    allDates[key] = (allDates[key] / 60).toFixed(1)
  })
  return {
    data: allDates
  }
}

export function statisticOnlinePeriods (powerRecoverList) {
  // 获取当前日期
  let today = new Date()

  // 创建一个数组来存储日期
  let dateMap = {}

  // 迭代 14 天并将日期添加到数组中
  for (let i = 0; i < 7; i++) {
    let date = new Date(today)
    date.setDate(today.getDate() - i)
    dateMap[formatDate(date)] = []
  }
  for (let i = 0; i < powerRecoverList.length; i++) {
    let record = powerRecoverList[i]
    if (record.add_num === 1) {
      // 此刻往前6分钟都认为在线
      let cur = new Date(record.time)
      let today = formatDate(cur)
      if (!dateMap[today]) {
        // 到了上限（14天前）
        break
      }
      let sixMinBefore = new Date(cur.getTime() - 6 * 60000)

      let endMinutes = todayPastMinutes(cur)

      if (endMinutes >= 6) {
        // 如果结束时间是00:06之后
        let startMinutes = todayPastMinutes(sixMinBefore)
        dateMap[today].push([startMinutes, endMinutes])
      } else {
        // 结束时间刚好在00:00到00:06之间
        dateMap[today].push([0, endMinutes])
        cur.setDate(cur.getDay() - 1)
        let yesterday = formatDate(cur)
        if (dateMap[yesterday]) {
          dateMap[yesterday].push([1440 - (6 - endMinutes), 1440])
        }
      }
    }
  }
  // todo 改用游标遍历，不需要整理碎片了，以后再优化
  // 整理时间段碎片
  Object.keys(dateMap).forEach(date => {
    let periods = dateMap[date].reverse()
    // [[0, 3], [3,9], [609, 615]]
    let newPeriods = []
    let temp = null
    periods.forEach(period => {
      let start = period[0]
      let end = period[1]
      if (!temp) {
        temp = [start, end]
      } else {
        if (temp[1] === start) {
          temp[1] = end
        } else {
          newPeriods.push(temp)
          temp = [start, end]
        }
      }
    })
    if (temp) {
      newPeriods.push(temp)
    }
    let res = []
    let state = 0
    let negativeStart = 0
    let positiveStart = 0
    let positiveEnd = 0
    let negativeEnd = 0
    for (let cursor = 0; cursor <= 1440; cursor++) {
      let online = newPeriods.find(p => cursor < p[1] && cursor >= p[0])
      if (online) {
        // 此分钟online
        if (state <= 0) {
          if (negativeStart !== negativeEnd) {
            res.push({
              online: false,
              start: negativeStart,
              end: negativeEnd
            })
          }
          positiveStart = cursor
          state = 1
          positiveEnd = positiveStart
        } else if (state === 1) {
          positiveEnd++
        }
      } else {
        // 此分钟offline
        if (state >= 0) {
          if (positiveStart !== positiveEnd) {
            res.push({
              online: true,
              start: positiveStart,
              end: positiveEnd
            })
          }
          negativeStart = cursor
          state = -1
          negativeEnd = negativeStart
        } else if (state === -1) {
          negativeEnd++
        }
      }
    }
    if (state === 1 && positiveStart !== positiveEnd) {
      res.push({
        online: true,
        start: positiveStart,
        end: positiveEnd
      })
    } else if (state === -1 && negativeStart !== negativeEnd) {
      res.push({
        online: false,
        start: negativeStart,
        end: negativeEnd
      })
    }
    dateMap[date] = res
  })
  return Object.keys(dateMap).map(k => {
    dateMap[k].forEach(d => {
      d.width = Math.floor((d.end - d.start) / 1440 * 650)
      d.status = d.online ? 'online' : 'offline'
    })
    return {
      date: k,
      blocks: dateMap[k]
    }
  })
}

/**
 * 相对今天0点过去了多少分钟
 * @param date Date对象
 * @returns {number} 相对今天0点过去的分钟数
 */
function todayPastMinutes (date) {
  let midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0) // 获取当天 0 点的时间
  // 计算相对当天 0 点过去了多少分钟
  return Math.floor((date.getTime() - midnight.getTime()) / (1000 * 60))
}

export function formatDate (date) {
  let year = date.getFullYear()
  let month = ('0' + (date.getMonth() + 1)).slice(-2)
  let day = ('0' + date.getDate()).slice(-2)
  return year + '-' + month + '-' + day
}

export function formatDateTime (date) {
  let year = date.getFullYear()
  let month = ('0' + (date.getMonth() + 1)).slice(-2)
  let day = ('0' + date.getDate()).slice(-2)
  let hour = ('0' + date.getHours()).slice(-2)
  let minute = ('0' + date.getMinutes()).slice(-2)
  let second = ('0' + date.getSeconds()).slice(-2)
  return year + '-' + month + '-' + day + ' ' + hour + ':' + minute + ':' + second
}

export async function getCk (e, s = false) {
  e.isSr = true
  let stoken = ''
  let user = new User(e)
  if (s) {
    stoken = await getStoken(e)
  }
  if (typeof user.getCk === 'function') {
    let ck = user.getCk()
    Object.keys(ck).forEach(k => {
      if (ck[k].ck) {
        ck[k].ck = `${stoken}${ck[k].ck}`
      }
    })
    return ck
  }
  let mysUser = (await user.user()).getMysUser('sr')
  let ck
  if (mysUser) {
    ck = {
      default: {
        ck: `${stoken}${mysUser.ck}`,
        uid: mysUser.getUid('sr'),
        qq: '',
        ltuid: mysUser.ltuid,
        device_id: mysUser.device
      }
    }
  }
  return ck
}
