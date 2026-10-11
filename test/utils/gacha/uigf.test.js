/**
 * uigf.js UIGF v4 导出（utils/gatcha/uigf.js）
 * 覆盖：
 * - 常量：EXPORT_APP / UIGF_VERSION / UIGF_GACHA_TYPES；getPluginVersion 读插件版本
 * - buildUigfV4：info 恰好 4 字段；hkrpg 块 uid/lang/timezone/list；
 *   全文无 uigf_gacha_type（hk4e 专属）；list 条目全字符串、gacha_type 枚举合法（1/2/11/12/21/22）、
 *   time 升序（旧在前，同秒 id 升序）；19 位 id 精度；缺省字段不输出；数字字段字符串化
 * - collectLocalRecords：从沙箱 data/gatcha 读取五类型（type 2 不收集）、缺失类型跳过、损坏抛错
 * - 端到端：写入 → collectLocalRecords → buildUigfV4
 * 数据全部由 factories 合成；uigf.js 仅依赖 pluginRoot（bootFakeRoot 后动态 import）。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { bootFakeRoot } from '../../helpers/boot.mjs'
import { makeRecord, makeRecordSet, writePluginGatcha } from '../../helpers/factories.mjs'

const sandbox = bootFakeRoot()
const {
  EXPORT_APP, UIGF_VERSION, UIGF_GACHA_TYPES,
  buildUigfV4, collectLocalRecords, getPluginVersion
} = await import('../../../utils/gatcha/uigf.js')

/** 工厂补充：覆盖 id（19 位数字字符串） */
const rec = (spec, id) => ({ ...makeRecord(spec), id: String(id) })

const ALLOWED_FIELDS = ['gacha_type', 'gacha_id', 'item_id', 'count', 'time', 'name', 'item_type', 'rank_type', 'id']
const REQUIRED_FIELDS = ['gacha_type', 'gacha_id', 'item_id', 'time', 'id']
const ENUM_TYPES = ['1', '2', '11', '12', '21', '22']

test('常量：导出应用名 / UIGF 版本 / gacha_type 枚举', () => {
  assert.equal(EXPORT_APP, 'StarRail-plugin')
  assert.equal(UIGF_VERSION, 'v4.0')
  assert.match(UIGF_VERSION, /^v\d+\.\d+$/, 'version 需匹配 ^v\\d+\\.\\d+$')
  assert.deepEqual(UIGF_GACHA_TYPES, ENUM_TYPES)
})

test('getPluginVersion：读插件 package.json 版本', () => {
  const pkg = JSON.parse(fs.readFileSync(new URL('../../../package.json', import.meta.url), 'utf-8'))
  assert.match(pkg.version, /^\d+\.\d+/)
  assert.equal(getPluginVersion(), pkg.version)
})

test('collectLocalRecords：五类型收集、type 2 不收集、缺失跳过、损坏抛错', () => {
  const uid = '100000001'
  const records = [
    ...makeRecordSet([{ type: 1, time: '2026-01-10 08:00:00' }, { type: 1, time: '2026-01-09 08:00:00' }]),
    ...makeRecordSet([{ type: 11, time: '2026-03-15 10:00:00' }, { type: 11, time: '2026-03-14 22:00:00' }]),
    ...makeRecordSet([{ type: 12, time: '2026-02-20 09:00:00' }]),
    ...makeRecordSet([{ type: 21, time: '2026-08-10 14:00:00' }, { type: 21, time: '2026-08-01 13:00:00' }]),
    ...makeRecordSet([{ type: 22, time: '2026-08-20 09:00:00' }]),
    ...makeRecordSet([{ type: 2, time: '2026-01-05 09:00:00' }]) // 新手池：插件不落盘，应被忽略
  ]
  writePluginGatcha(sandbox, uid, records)

  const result = collectLocalRecords(uid)
  assert.deepEqual(Object.keys(result), ['1', '11', '12', '21', '22'], '恰好五类型（type 2 不在收集范围）')
  assert.deepEqual(
    ['1', '11', '12', '21', '22'].map((t) => result[t].length),
    [2, 2, 1, 2, 1]
  )
  assert.equal(result['11'][0].time, '2026-03-15 10:00:00', '保持存储序（新在前）')
  assert.ok(!('2' in result), 'type 2 落盘文件也不得流入收集结果')

  // 仅部分类型落盘时只返回存在的类型
  const uid2 = '100000002'
  writePluginGatcha(sandbox, uid2, makeRecordSet([
    { type: 11, time: '2026-03-01 10:00:00' },
    { type: 21, time: '2026-08-01 10:00:00' }
  ]))
  assert.deepEqual(Object.keys(collectLocalRecords(uid2)), ['11', '21'])

  // 无任何文件 → 空对象
  assert.deepEqual(collectLocalRecords('100000003'), {})

  // 损坏 JSON → 抛错（由调用方决定跳过或提示）
  const uid4 = '100000004'
  writePluginGatcha(sandbox, uid4, makeRecordSet([{ type: 11, time: '2026-03-01 10:00:00' }]))
  fs.writeFileSync(sandbox.pluginPath('data', 'gatcha', uid4, '11.json'), '{ 损坏', 'utf-8')
  assert.throws(() => collectLocalRecords(uid4), /读取 11\.json 失败/)
})

test('buildUigfV4：info 四字段 / hkrpg 块 / 无 uigf_gacha_type / list 全字符串升序 / 19 位精度', () => {
  const idLo = '1765941000011781299'
  const idHi = '1765941000011781300'
  assert.equal(String(Number(idLo)), String(Number(idHi)), '前置对照：19 位 id Number 化坍缩为同值')

  // 可选字段缺省的记录（UIGF 允许 count/name/item_type/rank_type 缺省）
  const minimal = makeRecord({ type: 2, time: '2026-01-05 09:00:00' })
  delete minimal.name
  delete minimal.item_type
  delete minimal.rank_type
  delete minimal.count
  // 数字类型字段（防御性输入：应全部字符串化）
  const numeric = {
    gacha_type: 12,
    gacha_id: '2099',
    item_id: 23030,
    count: 1,
    time: '2026-02-20 10:00:00',
    name: '献给明日的色彩',
    item_type: '光锥',
    rank_type: 5,
    id: '1765941000011781234',
    uid: '100000001' // 账号级字段不在单条记录内，应被剔除
  }

  const recordsByType = {
    1: makeRecordSet([{ type: 1, time: '2026-01-10 08:00:00' }, { type: 1, time: '2026-01-09 08:00:00' }]),
    2: [minimal],
    11: [
      rec({ type: 11, time: '2026-03-15 10:00:00', name: '真珠', rank: 5 }, idHi),
      rec({ type: 11, time: '2026-03-15 10:00:00', name: '绯英', rank: 5 }, idLo),
      makeRecord({ type: 11, time: '2026-03-14 22:00:00', name: '青雀', rank: 4 })
    ],
    12: [numeric],
    21: makeRecordSet([
      { type: 21, time: '2026-08-10 14:00:00', name: '远坂凛', rank: 5 },
      { type: 21, time: '2026-08-01 13:00:00', name: 'Saber', rank: 5 }
    ]),
    22: makeRecordSet([{ type: 22, time: '2026-08-20 09:00:00', name: '星火悄然闪耀', itemId: '23020', rank: 5 }])
  }

  const { uigf, total } = buildUigfV4(recordsByType, 100000009, '9.9.9')
  const block = uigf.hkrpg[0]

  // info 恰好 4 字段
  assert.deepEqual(Object.keys(uigf.info),
    ['export_timestamp', 'export_app', 'export_app_version', 'version'])
  assert.equal(uigf.info.export_app, 'StarRail-plugin')
  assert.equal(uigf.info.export_app_version, '9.9.9')
  assert.equal(uigf.info.version, 'v4.0')
  assert.match(uigf.info.export_timestamp, /^\d{10}$/, '秒级时间戳')
  const drift = Math.abs(Number(uigf.info.export_timestamp) - Math.floor(Date.now() / 1000))
  assert.ok(drift <= 60, `export_timestamp 应接近当前时间（偏差 ${drift}s）`)

  // hkrpg 块：单元素数组，字段恰为 uid/lang/timezone/list
  assert.ok(Array.isArray(uigf.hkrpg) && uigf.hkrpg.length === 1)
  assert.deepEqual(Object.keys(block), ['uid', 'lang', 'timezone', 'list'])
  assert.equal(block.uid, '100000009', '数字 uid 应字符串化')
  assert.equal(block.lang, 'zh-cn', '取自记录的账号级 lang')
  assert.ok(Number.isInteger(block.timezone), 'timezone 为整数')
  assert.equal(block.timezone,
    -new Date(block.list[0].time.replace(' ', 'T')).getTimezoneOffset() / 60,
    '按首条记录 time 的 UTC 偏移计算（国服记录在国服时区机器上为 8）')

  // 全文无 uigf_gacha_type（原神 hk4e 专属字段）
  assert.ok(!JSON.stringify(uigf).includes('uigf_gacha_type'))

  // list 总量（六类型输入 → 10 条）
  assert.equal(total, 10)
  assert.equal(block.list.length, 10)
  for (const item of block.list) {
    for (const [k, v] of Object.entries(item)) {
      assert.equal(typeof v, 'string', `字段 ${k} 应为字符串`)
      assert.ok(ALLOWED_FIELDS.includes(k), `不得输出非标准字段 ${k}`)
    }
    for (const f of REQUIRED_FIELDS) {
      assert.ok(item[f] !== undefined, `必填字段 ${f} 不得缺省`)
    }
    assert.ok(ENUM_TYPES.includes(item.gacha_type), `gacha_type 枚举合法: ${item.gacha_type}`)
    assert.match(item.time, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    assert.match(item.id, /^\d{19}$/, 'id 为 19 位数字字符串')
  }

  // time 升序（旧在前，UIGF 惯例）；同秒按 id 升序
  for (let i = 1; i < block.list.length; i++) {
    const a = block.list[i - 1]
    const b = block.list[i]
    assert.ok(a.time < b.time || (a.time === b.time && String(a.id) < String(b.id)),
      `升序破坏: ${a.time}/${a.id} -> ${b.time}/${b.id}`)
  }
  assert.deepEqual(
    block.list.filter((x) => x.time === '2026-03-15 10:00:00').map((x) => x.id),
    [idLo, idHi],
    '同秒两条按 id 升序排列'
  )

  // 19 位 id 精度：逐字符保留（Number 化即坍缩的两个 id 同时在导出中）
  assert.ok(block.list.some((x) => x.id === idLo), `id ${idLo} 应逐字符保留`)
  assert.ok(block.list.some((x) => x.id === idHi), `id ${idHi} 应逐字符保留`)

  // 缺省可选字段不输出
  const minimalEntry = block.list.find((x) => x.gacha_type === '2')
  assert.deepEqual(Object.keys(minimalEntry).sort(), [...REQUIRED_FIELDS].sort())

  // 数字字段字符串化、账号级 uid 与未知字段剔除
  const numericEntry = block.list.find((x) => x.id === '1765941000011781234')
  assert.equal(numericEntry.gacha_type, '12')
  assert.equal(numericEntry.item_id, '23030')
  assert.equal(numericEntry.count, '1')
  assert.equal(numericEntry.rank_type, '5')
  assert.ok(!('uid' in numericEntry), '单条记录不含 uid')
})

test('buildUigfV4：lang 缺省 zh-cn；空记录输入结构仍完整', () => {
  const noLang = makeRecordSet([{ type: 11, time: '2026-03-01 10:00:00' }])
  for (const r of noLang) delete r.lang
  let out = buildUigfV4({ 11: noLang }, '100000010', '1.0.0')
  assert.equal(out.uigf.hkrpg[0].lang, 'zh-cn', '记录无 lang 时缺省 zh-cn')
  assert.equal(out.total, 1)

  out = buildUigfV4({}, '100000010', '1.0.0')
  assert.deepEqual(out.uigf.hkrpg[0].list, [])
  assert.equal(out.total, 0)
  assert.equal(out.uigf.hkrpg[0].lang, 'zh-cn')
  assert.ok(Number.isFinite(out.uigf.hkrpg[0].timezone))
  assert.deepEqual(Object.keys(out.uigf.info),
    ['export_timestamp', 'export_app', 'export_app_version', 'version'])
})

test('端到端：writePluginGatcha → collectLocalRecords → buildUigfV4（五类型合并导出）', () => {
  const uid = '100000005'
  const records = [
    ...makeRecordSet([{ type: 1, time: '2026-01-10 08:00:00' }, { type: 1, time: '2026-01-09 08:00:00' }]),
    ...makeRecordSet([{ type: 11, time: '2026-03-15 10:00:00' }]),
    ...makeRecordSet([{ type: 12, time: '2026-02-20 09:00:00' }]),
    ...makeRecordSet([{ type: 21, time: '2026-08-10 14:00:00' }]),
    ...makeRecordSet([{ type: 22, time: '2026-08-20 09:00:00' }, { type: 22, time: '2026-08-02 10:00:00' }])
  ]
  writePluginGatcha(sandbox, uid, records)

  const byType = collectLocalRecords(uid)
  assert.deepEqual(Object.keys(byType), ['1', '11', '12', '21', '22'])

  const { uigf, total } = buildUigfV4(byType, uid, '1.0.0')
  assert.equal(total, records.length)
  // id 集合与写入记录完全一致（19 位精度无损）
  const expectedIds = new Set(records.map((r) => String(r.id)))
  const gotIds = new Set(uigf.hkrpg[0].list.map((x) => x.id))
  assert.deepEqual([...gotIds].sort(), [...expectedIds].sort())
  assert.ok(uigf.hkrpg[0].list.every((x) => ENUM_TYPES.includes(x.gacha_type)))
  assert.ok(!uigf.hkrpg[0].list.some((x) => x.gacha_type === '2'), '新手池记录不流入导出')
})
