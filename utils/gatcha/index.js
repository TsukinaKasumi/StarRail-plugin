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
      return await getRecords(2, this.authKey)
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
    /** 当前卡池 */
    const currPool = _.find(poolData, (v) => isDateOnRange(v.from, v.to))
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
          12: { 4: 0, 5: 0 }
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

        // 卡池数据
        const poolInfo = getPool(item.time)
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

    obj.totalNum = getMapValueLength(map, 1) + getMapValueLength(map, 11) + getMapValueLength(map, 12)
    obj.totalNum1 = getMapValueLength(map, 1)
    obj.totalNum11 = getMapValueLength(map, 11)
    obj.totalNum12 = getMapValueLength(map, 12)
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
      }
    ], (v) => !_.isEmpty(v.records))

    return obj
  }

  async updateData () {
    if (this.authKey) {
      const records_1 = this.merge(await this.readJSON(this.getFilePath(1)), await getRecords(1, this.authKey))
      await this.writeJSON(this.getFilePath(1), records_1)
      const records_11 = this.merge(await this.readJSON(this.getFilePath(11)), await getRecords(11, this.authKey))
      await this.writeJSON(this.getFilePath(11), records_11)
      const records_12 = this.merge(await this.readJSON(this.getFilePath(12)), await getRecords(12, this.authKey))
      await this.writeJSON(this.getFilePath(12), records_12)
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
    // 剔除开拓者
    if (type === 'characters') {
      dataMap.delete('8001')
      dataMap.delete('8002')
      dataMap.delete('8003')
      dataMap.delete('8004')
      // dataMap.delete('1005')
      // dataMap.delete('1006')
      // dataMap.delete('1203')
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

function getPool (time) {
  let pool = false
  for (let i = 0; i < poolData.length; i++) {
    const x = poolData[i]
    if (isDateOnRange(x.from, x.to, moment(time))) {
      pool = poolData[i]
      break
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
