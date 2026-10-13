/**
 * 合成测试数据工厂 —— 全部为虚构数据，禁止混入任何真实用户数据
 * （真实 QQ/UID/记录一律不得出现在测试与 fixtures 中；CK/SK/authKey 类字符串零容忍）。
 *
 * 抽卡记录结构与米游社 API 原始格式同构：
 * { uid, gacha_id, gacha_type, item_id, count, time, name, lang, item_type, rank_type, id }
 * id 为 19 位纯数字字符串（毫秒时间戳 13 位 + 6 位序号），测试内保证唯一且可复现。
 */
import fs from 'node:fs'
import path from 'node:path'

let seq = 0

export function makeRecord ({ type = 11, time = '2026-01-01 12:00:00', name = '青雀', itemId = '20010', rank = 4, gachaId = '2099', uid = '100000001' } = {}) {
  seq += 1
  const ms = new Date(time.replace(' ', 'T') + '+08:00').getTime()
  return {
    uid,
    gacha_id: gachaId,
    gacha_type: String(type),
    item_id: itemId,
    count: '1',
    time,
    name,
    lang: 'zh-cn',
    item_type: itemId.startsWith('2') ? '光锥' : '角色',
    rank_type: String(rank),
    id: `${ms}${String(seq).padStart(6, '0')}`
  }
}

/** 批量生成记录（specs 顺序即返回顺序） */
export function makeRecordSet (specs) {
  return specs.map((s) => makeRecord(s))
}

/** 把记录按类型分文件写入伪根的 srJson 沙箱（qq/uid/type.json，与 TRSS 存储同构、tab 缩进） */
export function writeSrJson (sandbox, qq, uid, records) {
  const dir = sandbox.path('data', 'srJson', String(qq), String(uid))
  fs.mkdirSync(dir, { recursive: true })
  const byType = {}
  for (const r of records) {
    (byType[r.gacha_type] = byType[r.gacha_type] || []).push(r)
  }
  for (const [type, list] of Object.entries(byType)) {
    fs.writeFileSync(path.join(dir, `${type}.json`), JSON.stringify(list, '', '\t'), 'utf-8')
  }
  return dir
}

/** 把记录写入伪插件根的本插件数据目录（data/gatcha/{uid}/{type}.json，2 空格缩进） */
export function writePluginGatcha (sandbox, uid, records) {
  const dir = sandbox.pluginPath('data', 'gatcha', String(uid))
  fs.mkdirSync(dir, { recursive: true })
  const byType = {}
  for (const r of records) {
    (byType[r.gacha_type] = byType[r.gacha_type] || []).push(r)
  }
  for (const [type, list] of Object.entries(byType)) {
    fs.writeFileSync(path.join(dir, `${type}.json`), JSON.stringify(list, null, 2), 'utf-8')
  }
  return dir
}
