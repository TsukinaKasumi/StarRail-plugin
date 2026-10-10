/**
 * 抽卡记录双向同步（本插件 data/gatcha ↔ TRSS/miao 生态 data/srJson）
 *
 * 两边单条记录均为米哈游 API 原始格式（字段全部字符串），新记录在前：
 *   { uid, gacha_id, gacha_type, item_id, count, time, name, lang, item_type, rank_type, id }
 *
 * 本模块只提供纯函数（fs IO 除外，不依赖 redis/logger/插件运行时），便于独立测试。
 * 注意：
 * - id 为 19 位数字字符串，严禁 Number 化（超过 Number.MAX_SAFE_INTEGER 会丢精度），一律按字符串比较
 * - rank_type / gacha_type 均为字符串，合并时保持原字段类型与值不动
 * - srJson 由 TRSS 核心 writeJson 写入（tab 缩进、无尾换行），写回时须对齐该格式；
 *   且仅当 id 集合有新增时才写文件，避免纯格式 diff 弄脏 TRSS/miao 侧数据
 */
import fs from 'fs'
import path from 'path'

/** 参与双向同步的卡池类型（type 2 新手池插件不落盘，跳过，见 SKIPPED_TYPES） */
export const SYNC_TYPES = [1, 11, 12, 21, 22]

/** 不同步的类型及原因（用于命令回复说明） */
export const SKIPPED_TYPES = {
  2: '新手池记录本插件不落盘（分析时实时从 API 获取），已跳过'
}

/**
 * 双向合并两份抽卡记录，按 id 字符串去重
 * - 合并结果按 time 倒序（新在前，与两侧存储惯例一致）；同秒按 id 倒序（id 内嵌毫秒时间戳+序号，大者后抽）
 * - 同 id 记录两侧内容本应一致，若有出入以 remote（srJson/TRSS 侧）为准
 * - 不修改入参记录对象（保持原字段类型）
 * @param {Array} local 插件侧记录（新在前）
 * @param {Array} remote srJson 侧记录（新在前）
 * @returns {{merged: Array, addedLocal: Array, addedRemote: Array}}
 *   merged     合并后的完整记录（新在前）
 *   addedLocal 需写入插件侧的新增（来自 remote、插件侧原本没有）
 *   addedRemote 需写入 srJson 侧的新增（来自 local、srJson 侧原本没有）
 */
export function mergeRecords (local = [], remote = []) {
  const localIds = new Set(local.map((r) => String(r.id)))
  const remoteIds = new Set(remote.map((r) => String(r.id)))
  /** 将写入插件侧的新增（remote 独有） */
  const addedLocal = remote.filter((r) => !localIds.has(String(r.id)))
  /** 将写入 srJson 侧的新增（local 独有） */
  const addedRemote = local.filter((r) => !remoteIds.has(String(r.id)))

  const seen = new Set()
  const merged = []
  for (const record of [...remote, ...local]) {
    const id = String(record.id)
    if (seen.has(id)) {
      continue
    }
    seen.add(id)
    merged.push(record)
  }
  merged.sort(compareRecordsDesc)
  return { merged, addedLocal, addedRemote }
}

/** 新在前的排序：time 倒序，同秒 id 倒序（字符串比较，19 位等长数字串字典序即数值序） */
function compareRecordsDesc (a, b) {
  if (a.time !== b.time) {
    return a.time < b.time ? 1 : -1
  }
  const aid = String(a.id)
  const bid = String(b.id)
  if (aid !== bid) {
    return aid < bid ? 1 : -1
  }
  return 0
}

/**
 * 读取 JSON 文件；文件不存在返回 []，内容损坏时抛出（由调用方跳过该类型，避免误覆盖）
 * @param {string} filePath
 * @returns {Array}
 */
export function readJsonFile (filePath) {
  if (!fs.existsSync(filePath)) {
    return []
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

/**
 * 写 JSON 文件（自动创建目录）
 * @param {string} filePath
 * @param {Array|Object} data
 * @param {number|string} indent 插件侧 2 空格（对齐 GatchaData.writeJSON）；srJson 侧 '\t'（对齐 TRSS writeJson）
 */
export async function writeJsonFile (filePath, data, indent = 2) {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true })
  await fs.promises.writeFile(filePath, JSON.stringify(data, null, indent), 'utf-8')
}

/**
 * 备份文件到同目录 {原文件名}.bak-{时间戳}（仅在文件已存在时由调用方调用）
 * @returns {Promise<string>} 备份文件完整路径
 */
export async function backupFile (filePath) {
  const backupPath = `${filePath}.bak-${formatTimestamp()}`
  await fs.promises.copyFile(filePath, backupPath)
  return backupPath
}

/** 本地时间戳字符串：yyyyMMdd-HHmmss（用于备份文件名） */
function formatTimestamp (date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return [
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`,
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  ].join('-')
}

/**
 * 对单个卡池类型执行一次双向同步（导入 srJson→插件 + 导出 插件→srJson）
 * - 两侧 id 集合比对：任一侧无新增即不写该侧文件（幂等，且避免纯格式 diff 弄脏 srJson）
 * - 写 srJson 前先备份原文件到同目录 {type}.json.bak-{时间戳}
 * - 两侧文件均不存在 → status 'empty'；任一侧 JSON 损坏 → status 'error'（不写任何一侧，避免覆盖）
 * @param {number|string} type 卡池类型
 * @param {string} pluginFile 插件侧文件路径（data/gatcha/{uid}/{type}.json）
 * @param {string} srFile srJson 侧文件路径（data/srJson/{qq}/{uid}/{type}.json）
 * @returns {Promise<{type, status, localCount, remoteCount, addedLocalCount, addedRemoteCount, backupPath, error}>}
 */
export async function syncOneType (type, pluginFile, srFile) {
  const empty = {
    type,
    status: 'empty',
    localCount: 0,
    remoteCount: 0,
    addedLocalCount: 0,
    addedRemoteCount: 0,
    backupPath: null
  }
  let local
  let remote
  try {
    local = readJsonFile(pluginFile)
    remote = readJsonFile(srFile)
  } catch (err) {
    return {
      ...empty,
      status: 'error',
      error: `记录文件损坏（${err?.message || err}），为避免覆盖已跳过`
    }
  }
  if (local.length === 0 && remote.length === 0) {
    return empty
  }

  const { merged, addedLocal, addedRemote } = mergeRecords(local, remote)
  let backupPath = null

  // 导入方向：srJson → 插件（仅当有新增时写，幂等）
  if (addedLocal.length > 0) {
    await writeJsonFile(pluginFile, merged, 2)
  }
  // 导出方向：插件 → srJson（仅当 id 集合有新增时写；写前备份原文件）
  if (addedRemote.length > 0) {
    if (fs.existsSync(srFile)) {
      backupPath = await backupFile(srFile)
    }
    await writeJsonFile(srFile, merged, '\t')
  }

  return {
    type,
    status: 'ok',
    localCount: local.length,
    remoteCount: remote.length,
    addedLocalCount: addedLocal.length,
    addedRemoteCount: addedRemote.length,
    backupPath
  }
}

/**
 * 在 srJson 根目录下扫描包含指定 uid 数据的 qq 目录
 * （用于目标 qq 名下没有该 uid 数据、但数据实际挂在其它 qq 目录下的情况）
 * @param {string} srRoot srJson 根目录（{Yunzai根}/data/srJson）
 * @param {string|number} uid
 * @returns {string|null} qq 目录名，未找到返回 null
 */
export function findSrJsonQQ (srRoot, uid) {
  if (!fs.existsSync(srRoot)) {
    return null
  }
  for (const qq of fs.readdirSync(srRoot)) {
    try {
      const uidDir = path.join(srRoot, qq, String(uid))
      if (fs.statSync(path.join(srRoot, qq)).isDirectory() &&
          fs.statSync(uidDir).isDirectory()) {
        return qq
      }
    } catch (err) {
      // 非常规条目（文件/权限异常）跳过
    }
  }
  return null
}
