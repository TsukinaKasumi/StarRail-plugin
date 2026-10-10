/* eslint-disable prefer-promise-reject-errors */
/* eslint-disable camelcase */
import fs from 'fs'
import path from 'path'
import _ from 'lodash'
import { getRecords } from './gatcha.js'
import { pluginRoot } from '../path.js'
import { poolData } from './poolData.js'
import moment from 'moment'

export default class GatchaData {
  constructor (uid, authKey) {
    this.uid = uid
    this.data = []
    this.authKey = authKey
  }

  async getData (gatchaType) {
    if (gatchaType === 2) {
      return await getRecords(this.uid, 2, this.authKey)
    }
    if (gatchaType) {
      const filePath = this.getFilePath(gatchaType)
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath))
      } else {
        return Promise.reject('抽卡记录不存在')
      }
    }
    return Promise.reject('查询type为空')
  }

  // 卡池统计
  async stat (gatchaType = 0) {
    /** 当前卡池（排除联动条目：其 to 为 2036 远期哨兵，常规条目空窗期会被其拦截） */
    const currPool = _.find(poolData, (v) => !v.gachaType && isDateOnRange(v.from, v.to))
    /** 当前总数 */
    const currTotal = {
      /** 角色总数 */
      characterTotal: [this.getItemTotalNum('characters', '4'), this.getItemTotalNum('characters', '5')],
      /** 光锥总数 */
      lightConesTotal: [this.getItemTotalNum('light_cones', '4'), this.getItemTotalNum('light_cones', '5')],
      /** 总卡数 */
      total: 0
    }

    const obj = {
      /** 本地记录起始时间 */
      localFirstTime: '2077-06-06 00:00:00',
      /** 本地记录结束时间 */
      localLastTime: '2007-06-06 00:00:00',
      /** 总抽卡数 */
      totalNum: 0,
      /** 常驻池总抽卡数 */
      totalNum1: 0,
      /** 角色池总抽卡数 */
      totalNum11: 0,
      /** 光锥池总抽卡数 */
      totalNum12: 0,
      /** 角色联动池总抽卡数 */
      totalNum21: 0,
      /** 光锥联动池总抽卡数 */
      totalNum22: 0,
      /** 持有总数（包含角色，光锥） */
      holdNum: { num: [0, 0], holdingRate: [0, 0] },
      /** 角色总数 */
      characterHoldNum: { num: [0, 0], holdingRate: [0, 0] },
      /** 光锥(武器)总数 */
      lightConesHoldNum: { num: [0, 0], holdingRate: [0, 0] },
      /** 本期相关信息 */
      currInfo: {
        /** 本期总抽卡数 */
        totalNum: 0,
        /** 持有总数（包含角色，光锥） */
        holdNum: { num: [0, 0] },
        /** 角色总数 */
        characterHoldNum: { num: [0, 0] },
        /** 光锥(武器)总数 */
        lightConesHoldNum: { num: [0, 0] },
        /** 当期已抽未出 */
        last: {
          1: { 4: 0, 5: 0 },
          2: { 4: 0, 5: 0 },
          11: { 4: 0, 5: 0 },
          12: { 4: 0, 5: 0 },
          21: { 4: 0, 5: 0 },
          22: { 4: 0, 5: 0 }
        },
        currPool
      }
    }
    currTotal.total = currTotal.characterTotal[0] + currTotal.characterTotal[1] + currTotal.lightConesTotal[0] + currTotal.lightConesTotal[1]
    // 当前时间节点存在活动卡池
    if (currPool) {
      obj.localFirstTime = currPool.to
      obj.localLastTime = currPool.from
    }
    const map = new Map()

    function withList (list) {
      const limits = { 4: 0, 5: 0 }
      return _.map(_.reverse(list), (item) => {
        const newItem = { ...item, isUp: false }
        const rank = Number(item.rank_type)
        const type = Number(item.gacha_type)
        const flag = isDateOnRange(currPool?.from, currPool?.to, moment(item.time))

        // 本地记录起始时间根据记录自动前移
        if (moment(item.time).diff(moment(obj.localFirstTime)) < 0) {
          obj.localFirstTime = item.time
        }

        // 本地记录结束时间根据记录自动后移
        if (moment(item.time).diff(moment(obj.localLastTime)) > 0) {
          obj.localLastTime = item.time
        }

        // 统计总卡数
        setNumPlus(obj, 'holdNum', rank, currTotal.total)
        // 出货计数
        newItem.until = withUntilPlus(limits, rank)
        // 计算当前卡池出货总间隔
        obj.currInfo.last[type][4] = limits[4]
        obj.currInfo.last[type][5] = limits[5]

        if (flag) {
          // 统计当期总卡数
          setNumPlus(obj.currInfo, 'holdNum', rank)
          obj.currInfo.totalNum++
        }

        if (item.item_type === '光锥') {
          // 统计总光锥数
          setNumPlus(obj, 'lightConesHoldNum', rank, currTotal.lightConesTotal)
          if (flag) {
            // 统计当期总光锥数
            setNumPlus(obj.currInfo, 'lightConesHoldNum', rank)
          }

          // 光锥图片本地路径
          newItem.imgPath = `panel/resources/weapon/${item.item_id}.png`
          // 光锥class
          newItem.className = `cones rank${rank}`
        } else {
          // 统计总角色数
          setNumPlus(obj, 'characterHoldNum', rank, currTotal.characterTotal)
          if (flag) {
            // 统计当期总角色数
            setNumPlus(obj.currInfo, 'characterHoldNum', rank)
          }

          // 角色图片本地路径
          newItem.imgPath = `gatcha/images/char/${item.item_id}.png`
          // 角色class
          newItem.className = `char rank${rank}`
        }

        // 卡池数据（按记录 gacha_type 区分常规/联动归组，见 getPool）
        const poolInfo = getPool(item.time, type)
        newItem.poolInfo = poolInfo
        newItem.pool = poolInfo.id
        // 判断当前5行是否为up五星
        if (rank === 5 && _.includes(_.concat(poolInfo.char5, poolInfo.weapon5), item.name)) {
          newItem.isUp = true
        }
        return newItem
      })
    }

    if (gatchaType === 1 || gatchaType === 0) {
      map.set(1, withList(await this.getData(1)))
    }
    if (gatchaType === 2) {
      map.set(2, withList(await this.getData(2)))
    }
    if (gatchaType === 11 || gatchaType === 0) {
      map.set(11, withList(await this.getData(11)))
    }
    if (gatchaType === 12 || gatchaType === 0) {
      map.set(12, withList(await this.getData(12)))
    }
    if (gatchaType === 21 || gatchaType === 0) {
      map.set(21, withList(await this.getData(21)))
    }
    if (gatchaType === 22 || gatchaType === 0) {
      map.set(22, withList(await this.getData(22)))
    }

    obj.totalNum = getMapValueLength(map, 1) + getMapValueLength(map, 11) + getMapValueLength(map, 12) +
      getMapValueLength(map, 21) + getMapValueLength(map, 22)
    obj.totalNum1 = getMapValueLength(map, 1)
    obj.totalNum11 = getMapValueLength(map, 11)
    obj.totalNum12 = getMapValueLength(map, 12)
    obj.totalNum21 = getMapValueLength(map, 21)
    obj.totalNum22 = getMapValueLength(map, 22)
    obj.data = _.filter([
      {
        type: 1,
        typeName: '群星跃迁',
        records: _.reverse(map.get(1)),
        groups: groupByPool(map.get(1))
      },
      {
        type: 2,
        typeName: '新手跃迁',
        records: _.reverse(map.get(2))
      },
      {
        type: 11,
        typeName: '限定跃迁',
        records: _.reverse(map.get(11)),
        groups: groupByPool(map.get(11))
      },
      {
        type: 12,
        typeName: '光锥跃迁',
        records: _.reverse(map.get(12)),
        groups: groupByPool(map.get(12))
      },
      {
        type: 21,
        typeName: '角色联动跃迁',
        records: _.reverse(map.get(21)),
        groups: groupByPool(map.get(21))
      },
      {
        type: 22,
        typeName: '光锥联动跃迁',
        records: _.reverse(map.get(22)),
        groups: groupByPool(map.get(22))
      }
    ], (v) => !_.isEmpty(v.records))

    return obj
  }

  async updateData () {
    if (this.authKey) {
      const records_1 = this.merge(await this.readJSON(this.getFilePath(1)), await getRecords(this.uid, 1, this.authKey))
      await this.writeJSON(this.getFilePath(1), records_1)
      const records_11 = this.merge(await this.readJSON(this.getFilePath(11)), await getRecords(this.uid, 11, this.authKey))
      await this.writeJSON(this.getFilePath(11), records_11)
      const records_12 = this.merge(await this.readJSON(this.getFilePath(12)), await getRecords(this.uid, 12, this.authKey))
      await this.writeJSON(this.getFilePath(12), records_12)
      const records_21 = this.merge(await this.readJSON(this.getFilePath(21)), await getRecords(this.uid, 21, this.authKey))
      await this.writeJSON(this.getFilePath(21), records_21)
      const records_22 = this.merge(await this.readJSON(this.getFilePath(22)), await getRecords(this.uid, 22, this.authKey))
      await this.writeJSON(this.getFilePath(22), records_22)
    } else {
      throw new Error('authKey 为空')
    }
  }

  async writeJSON (filePath, data) {
    const newData = JSON.stringify(data, null, 2)
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true })
    try {
      await fs.promises.access(filePath, fs.constants.F_OK)
      await fs.promises.writeFile(filePath, newData, 'utf-8')
      return true
    } catch (error) {
      await fs.promises.appendFile(filePath, newData, 'utf-8')
      return false
    }
  }

  async readJSON (filePath) {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath))
    } else {
      return []
    }
  }

  merge (oldData = [], newData) {
    const lastItemId = oldData[0]?.id || ''
    const newArr = []
    for (let i = 0; i < newData.length; i++) {
      const curr = newData[i]
      if (curr.id === lastItemId) {
        break
      }
      newArr.push(curr)
    }
    return _.concat(newArr, oldData)
  }

  getFilePath (poolId) {
    return `${pluginRoot}/data/gatcha/${this.uid}/${poolId}.json`
  }

  getItemTotalNum (type = 'characters', rarity) {
    const path = `${pluginRoot}/resources/baseData/${type}.json`
    const data = JSON.parse(fs.readFileSync(path, 'utf-8'))
    const dataMap = new Map(Object.entries(data))
    // 剔除开拓者（8001-8010 及后续新增形态，统一按 80 前缀剔除）
    if (type === 'characters') {
      for (const id of [...dataMap.keys()]) {
        if (id.startsWith('80')) {
          dataMap.delete(id)
        }
      }
    }
    if (rarity) {
      let total = 0
      dataMap.forEach((value) => {
        if (value.rarity == rarity) {
          total++
        }
      })
      return total
    }
    return dataMap.size
  }
}

function getMapValueLength (map, key) {
  return map.get(key)?.length || 0
}

function isDateOnRange (startDate, endDate, date) {
  const curr = date || moment()
  return curr.diff(moment(startDate)) > 0 && curr.diff(moment(endDate)) < 0
}

function setNumPlus (obj, key, rank, total) {
  let index = 0
  if (rank === 5) {
    index = 1
  }
  if (rank === 4 || rank === 5) {
    const n = obj[key].num[index]
    obj[key].num[index] = n + 1
    if (total) {
      const _total = _.isNumber(total) ? total : total[index]
      const r = (n / _total * 100).toFixed(0)
      obj[key].holdingRate[index] = Number(r)
    }
  }
}

function withUntilPlus (obj, rank) {
  obj[4]++
  obj[5]++
  const temp = obj[rank]
  if (rank === 4 || rank === 5) {
    obj[rank] = 0
  }
  return temp
}

function getPool (time, gachaType) {
  let pool = false
  if (gachaType === 21 || gachaType === 22) {
    // 联动池长期开放且多期时间互相重叠（to 均为 2036 哨兵），纯日期无法区分期次；
    // gacha_id 理论上可精确到池，但 poolData 未收录 gacha_id，按期次近似归组：
    // 在同 gachaType 的联动条目中取 from 最晚且早于记录时间的一条（晚于二期开池即归二期）
    for (let i = 0; i < poolData.length; i++) {
      const x = poolData[i]
      if (x.gachaType === gachaType && isDateOnRange(x.from, x.to, moment(time))) {
        if (!pool || moment(x.from).diff(moment(pool.from)) > 0) {
          pool = x
        }
      }
    }
    return pool
  }
  for (let i = 0; i < poolData.length; i++) {
    const x = poolData[i]
    // 常规记录排除联动条目（to 为 2036 哨兵，命中即拦截其后所有常规池归组）
    if (!x.gachaType && isDateOnRange(x.from, x.to, moment(time))) {
      pool = poolData[i]
      break
    }
  }
  if (!pool) {
    // 版本边界维护窗口兜底：相邻版本条目之间存在上期 to(14:59:59)~下期 from(次日 06:00)
    // 的空窗，期间仍可能有真实抽卡记录；回退到 from 早于记录时间的最后一个常规条目
    // （常规条目按时间升序排列）。距该期结束超过 1 天则视为 poolData 尚未覆盖的新
    // 版本，不回退（保持无归组，待卡池数据更新）
    const t = moment(time)
    for (let i = 0; i < poolData.length; i++) {
      const x = poolData[i]
      if (!x.gachaType && t.diff(moment(x.from)) > 0) {
        pool = x
      }
    }
    if (pool && t.diff(moment(pool.to)) > 24 * 60 * 60 * 1000) {
      pool = false
    }
  }
  return pool
}

function groupByPool (collection) {
  return _.mapValues(_.groupBy(collection, (value) => value.pool), (x = []) => {
    const poolInfo = x[0].poolInfo || {}
    return {
      pool: poolInfo,
      id: poolInfo.id,
      total: x.length,
      records: x
    }
  })
}
