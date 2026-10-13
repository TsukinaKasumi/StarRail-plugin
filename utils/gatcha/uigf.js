/**
 * UIGF v4 抽卡记录导出（hkrpg 块）
 *
 * 标准要点（UIGF v4.0+，v4.1 起支持联动池 gacha_type 21/22）：
 * - 与原神 hk4e 的关键差异：星铁 hkrpg 条目没有 uigf_gacha_type 字段
 *   （hk4e 专属，用于 301/400 同保底池合并），直接使用 gacha_type
 * - gacha_type 枚举（字符串）："1" 常驻 / "2" 新手 / "11" 角色活动 /
 *   "12" 光锥活动 / "21" 角色联动 / "22" 光锥联动
 * - list 条目字段全部字符串：gacha_type/gacha_id/item_id/time/id 必填，
 *   count/name/item_type/rank_type 可选；lang 是账号级字段（hkrpg 块），
 *   uid 同理，均不在单条记录内
 * - list 按 time 升序（UIGF 惯例旧记录在前，与 TRSS 导出顺序一致）
 * - info 四字段必填：export_timestamp（秒级）/ export_app /
 *   export_app_version / version（格式 ^v\d+\.\d+$）
 * - timezone 为整数（服务器时区偏移小时数，国服 8），按记录 time 的
 *   UTC 偏移计算（与 TRSS exportLog 的 moment(time).utcOffset()/60 同口径）
 *
 * 本模块只依赖 fs/path 与 utils/path.js（pluginRoot 基于 process.cwd()，
 * 测试脚本需从 Yunzai 根目录运行）。
 */
import fs from 'fs'
import path from 'path'
import { pluginRoot } from '../path.js'
import { SYNC_TYPES } from './sync.js'

/** 导出应用名（info.export_app） */
export const EXPORT_APP = 'StarRail-plugin'

/** UIGF 版本号（info.version，v4.x 伞形版本） */
export const UIGF_VERSION = 'v4.0'

/** 星铁合法 gacha_type 枚举（字符串） */
export const UIGF_GACHA_TYPES = ['1', '2', '11', '12', '21', '22']

/** 单条记录导出的字段（UIGF v4 hkrpg list 条目，全部字符串） */
const RECORD_FIELDS = ['gacha_type', 'gacha_id', 'item_id', 'count', 'time', 'name', 'item_type', 'rank_type', 'id']

/** 插件版本（info.export_app_version，读插件 package.json） */
export function getPluginVersion () {
  try {
    return JSON.parse(fs.readFileSync(path.join(pluginRoot, 'package.json'), 'utf-8')).version
  } catch (err) {
    return '0.0.0'
  }
}

/**
 * 读取插件侧全部本地记录（type 1/11/12/21/22）
 * @param {string|number} uid
 * @returns {{[type: string]: Array}} 各类型记录（保持存储序：新在前）；损坏文件抛出
 */
export function collectLocalRecords (uid) {
  const result = {}
  for (const type of SYNC_TYPES) {
    const filePath = path.join(pluginRoot, 'data', 'gatcha', String(uid), `${type}.json`)
    if (!fs.existsSync(filePath)) {
      continue
    }
    try {
      result[type] = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    } catch (err) {
      throw new Error(`读取 ${type}.json 失败：${err?.message || err}`)
    }
  }
  return result
}

/**
 * 计算 UTC 时区偏移小时数：按记录 time（'YYYY-MM-DD HH:mm:ss' 本地时间字符串）解析，
 * 国服记录在国服时区机器上得 8（与 TRSS moment(time).utcOffset()/60 同口径）
 * @returns {number}
 */
function timezoneOf (time) {
  const date = new Date(String(time).replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) {
    return -new Date().getTimezoneOffset() / 60
  }
  return -date.getTimezoneOffset() / 60
}

/**
 * 构建 UIGF v4 导出对象
 * @param {{[type: string]: Array}} recordsByType 各类型本地记录（新在前；导出按旧在前排序）
 * @param {string|number} uid
 * @param {string} appVersion info.export_app_version
 * @returns {{uigf: Object, total: number}}
 */
export function buildUigfV4 (recordsByType, uid, appVersion) {
  const list = []
  let lang = ''
  for (const type of Object.keys(recordsByType)) {
    for (const record of recordsByType[type] || []) {
      // lang 为账号级字段：从第一条带 lang 的原始记录取，缺省 zh-cn
      if (!lang && record.lang) {
        lang = String(record.lang)
      }
      list.push(toUigfRecord(record))
    }
  }
  // UIGF 惯例旧记录在前：time 升序，同秒 id 升序
  list.sort(compareRecordsAsc)
  return {
    uigf: {
      info: {
        export_timestamp: String(Math.floor(Date.now() / 1000)),
        export_app: EXPORT_APP,
        export_app_version: String(appVersion),
        version: UIGF_VERSION
      },
      // 星铁块为 hkrpg；无 uigf_gacha_type（原神 hk4e 专属），gacha_type 直接使用枚举值
      hkrpg: [
        {
          uid: String(uid),
          lang: lang || 'zh-cn',
          timezone: list.length > 0 ? timezoneOf(list[0].time) : -new Date().getTimezoneOffset() / 60,
          list
        }
      ]
    },
    total: list.length
  }
}

/** 单条记录 → UIGF v4 条目（仅标准字段，全部字符串，缺省字段不输出） */
function toUigfRecord (record) {
  const item = {}
  for (const field of RECORD_FIELDS) {
    const value = record[field]
    if (value !== undefined && value !== null) {
      item[field] = String(value)
    }
  }
  return item
}

/** 旧在前的排序：time 升序，同秒 id 升序（19 位等长数字串字典序即数值序） */
function compareRecordsAsc (a, b) {
  if (a.time !== b.time) {
    return a.time < b.time ? -1 : 1
  }
  const aid = String(a.id)
  const bid = String(b.id)
  if (aid !== bid) {
    return aid < bid ? -1 : 1
  }
  return 0
}
