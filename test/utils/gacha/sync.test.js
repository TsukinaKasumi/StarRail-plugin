/**
 * sync.js 双向合并与同步（utils/gatcha/sync.js）
 * 覆盖：
 * - 常量 SYNC_TYPES/SKIPPED_TYPES（新手池跳过说明）
 * - mergeRecords：id 字符串去重（19 位精度逐字符保持）、time 倒排新在前、双方全空/单边空
 * - syncOneType：本地→远端与远端→本地双向计数；幂等（二跑 added 双零且不写文件）；
 *   远端文件存在且有变化时写前备份（.bak- 内容为写前原样）；损坏 JSON 跳过不覆盖
 * - findSrJsonQQ：srJson 根目录扫描
 * 数据全部由 factories 合成（uid/qq 均为虚构），两侧文件写入伪根沙箱。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { bootFakeRoot } from '../../helpers/boot.mjs'
import { makeRecord, makeRecordSet, writePluginGatcha, writeSrJson } from '../../helpers/factories.mjs'
import { SYNC_TYPES, SKIPPED_TYPES, mergeRecords, syncOneType, findSrJsonQQ } from '../../../utils/gatcha/sync.js'

const sandbox = bootFakeRoot()

/** 工厂补充：覆盖 id（19 位数字字符串，保证可复现且与精度用例一致） */
const rec = (spec, id) => ({ ...makeRecord(spec), id: String(id) })

test('常量：SYNC_TYPES 五类型；SKIPPED_TYPES 说明文案含插件名', () => {
  assert.deepEqual(SYNC_TYPES, [1, 11, 12, 21, 22])
  assert.deepEqual(Object.keys(SKIPPED_TYPES), ['2'], '仅新手池被跳过')
  assert.ok(SKIPPED_TYPES[2].includes('StarRail-plugin'), '跳过说明应含 StarRail-plugin')
})

test('mergeRecords：id 字符串去重，19 位精度逐字符不变', () => {
  const idA = '1765941000011781299'
  const idB = '1765941000011781300' // 与 idA 仅末位不同：Number 化后同为 ...400，必须按字符串比较
  assert.equal(String(Number(idA)), String(Number(idB)), '前置对照：两 id Number 化后坍缩为同值')

  const sharedLocal = rec({ type: 11, time: '2026-10-01 11:00:00' }, idA)
  const sharedRemote = rec({ type: 11, time: '2026-10-01 11:00:00' }, idA) // 两侧各自存储的同一条
  const localOnly = rec({ type: 11, time: '2026-10-01 12:00:00' }, idB)
  const remoteOnly = rec({ type: 11, time: '2026-09-30 10:00:00' }, '1765941000011781298')
  const local = [localOnly, sharedLocal]
  const remote = [sharedRemote, remoteOnly]

  const { merged, addedLocal, addedRemote } = mergeRecords(local, remote)

  assert.equal(merged.length, 3, '同 id 去重后 3 条')
  assert.deepEqual(merged.map((r) => r.id), [idB, idA, '1765941000011781298'],
    '合并后 id 逐字符不变，且 time 倒序新在前')
  assert.deepEqual(addedLocal.map((r) => r.id), ['1765941000011781298'], '仅 srJson 独有写入插件侧')
  assert.deepEqual(addedRemote.map((r) => r.id), [idB], '仅插件独有写入 srJson 侧')
  // 入参不被修改（顺序与内容保持）
  assert.deepEqual(local.map((r) => r.id), [idB, idA])
  assert.deepEqual(remote.map((r) => r.id), [idA, '1765941000011781298'])
  assert.ok(merged.every((r) => typeof r.id === 'string' && typeof r.gacha_type === 'string'))
})

test('mergeRecords：time 倒排（新在前），同秒按 id 倒序', () => {
  const sameTime = '2026-10-02 10:00:00'
  const rHi = rec({ type: 11, time: sameTime }, '1765941000011781500')
  const rLo = rec({ type: 11, time: sameTime }, '1765941000011781499')
  const rOld = rec({ type: 11, time: '2026-10-01 09:00:00' }, '1765941000011781498')
  const { merged } = mergeRecords([rOld, rLo], [rHi]) // 乱序输入
  assert.deepEqual(merged.map((r) => r.id),
    ['1765941000011781500', '1765941000011781499', '1765941000011781498'],
    '同秒 id 大者（后抽）在前')
})

test('mergeRecords：双方全空与单边空', () => {
  assert.deepEqual(mergeRecords([], []), { merged: [], addedLocal: [], addedRemote: [] })
  const onlyLocal = makeRecordSet([
    { type: 11, time: '2026-10-01 10:00:00' },
    { type: 11, time: '2026-09-01 10:00:00' }
  ])
  const onlyRemote = makeRecordSet([{ type: 11, time: '2026-08-01 10:00:00' }])

  let r = mergeRecords(onlyLocal, [])
  assert.deepEqual(r.addedLocal, [])
  assert.deepEqual(r.addedRemote, onlyLocal, '本地独有全部待写入远端')
  assert.equal(r.merged.length, 2)

  r = mergeRecords([], onlyRemote)
  assert.deepEqual(r.addedLocal, onlyRemote, '远端独有全部待写入本地')
  assert.deepEqual(r.addedRemote, [])
  assert.equal(r.merged.length, 1)
})

test('syncOneType 导入方向：srJson → 插件，计数与 2 空格缩进、无备份', async () => {
  const uid = '100000001'
  const qq = '700000001'
  const records = makeRecordSet([
    { type: 21, time: '2026-08-10 14:00:00', name: '远坂凛', rank: 5 },
    { type: 21, time: '2026-08-01 13:00:00', name: 'Saber', rank: 5 },
    { type: 21, time: '2026-07-25 12:30:00', name: '青雀', rank: 4 }
  ])
  const srFile = path.join(writeSrJson(sandbox, qq, uid, records), '21.json')
  const pluginFile = sandbox.pluginPath('data', 'gatcha', uid, '21.json')
  assert.ok(!fs.existsSync(pluginFile))

  const r = await syncOneType(21, pluginFile, srFile)

  assert.equal(r.status, 'ok')
  assert.deepEqual([r.localCount, r.remoteCount, r.addedLocalCount, r.addedRemoteCount], [0, 3, 3, 0])
  assert.equal(r.backupPath, null, '插件侧写入不产生备份')
  // 插件侧写入：字节级对齐 GatchaData.writeJSON（2 空格缩进），内容为合并结果（新在前）
  assert.equal(fs.readFileSync(pluginFile, 'utf-8'), JSON.stringify(records, null, 2))
})

test('syncOneType 幂等：首跑同步后，二跑 added 双零且不写任何文件', async () => {
  const uid = '100000002'
  const qq = '700000002'
  const records = makeRecordSet([
    { type: 11, time: '2026-10-05 10:00:00', name: '真珠', rank: 5 },
    { type: 11, time: '2026-10-01 08:00:00', name: '青雀', rank: 4 }
  ])
  const srFile = path.join(writeSrJson(sandbox, qq, uid, records), '11.json')
  const pluginFile = sandbox.pluginPath('data', 'gatcha', uid, '11.json')

  const first = await syncOneType(11, pluginFile, srFile)
  assert.equal(first.status, 'ok')
  assert.deepEqual([first.addedLocalCount, first.addedRemoteCount], [2, 0], '首跑导入全量')

  const before = [pluginFile, srFile].map((f) => fs.statSync(f).mtimeMs)
  const second = await syncOneType(11, pluginFile, srFile)
  assert.equal(second.status, 'ok')
  assert.equal(second.addedLocalCount, 0, '二跑无新增（导入方向幂等）')
  assert.equal(second.addedRemoteCount, 0, '二跑无新增（导出方向幂等）')
  assert.equal(second.backupPath, null)
  assert.deepEqual([pluginFile, srFile].map((f) => fs.statSync(f).mtimeMs), before,
    '两侧文件 mtime 不变（未重写，避免纯格式 diff 弄脏数据）')
  // 两侧内容解析后一致（同一份合并结果，仅缩进不同）
  assert.deepEqual(JSON.parse(fs.readFileSync(pluginFile, 'utf-8')), JSON.parse(fs.readFileSync(srFile, 'utf-8')))
  assert.deepEqual(fs.readdirSync(path.dirname(srFile)).filter((f) => f.includes('.bak-')), [], '无备份文件产生')
})

test('syncOneType 导出方向：插件独有记录写入 srJson，写前生成 .bak- 备份（内容为写前原样）', async () => {
  const uid = '100000003'
  const qq = '700000003'
  const shared = makeRecord({ type: 21, time: '2026-08-01 13:00:00', name: 'Saber', rank: 5 })
  const localNew = makeRecord({ type: 21, time: '2026-08-10 14:00:00', name: '远坂凛', rank: 5 })
  writePluginGatcha(sandbox, uid, [localNew, shared])
  const srFile = path.join(writeSrJson(sandbox, qq, uid, [shared]), '21.json')
  const pluginFile = sandbox.pluginPath('data', 'gatcha', uid, '21.json')
  const srBefore = fs.readFileSync(srFile, 'utf-8')

  const r = await syncOneType(21, pluginFile, srFile)

  assert.equal(r.status, 'ok')
  assert.deepEqual([r.localCount, r.remoteCount, r.addedLocalCount, r.addedRemoteCount], [2, 1, 0, 1])
  // 写前备份：{原文件名}.bak-{时间戳}，内容为写前原样（不含新增记录）
  assert.match(path.basename(r.backupPath), /^21\.json\.bak-\d{8}-\d{6}$/)
  assert.equal(fs.readFileSync(r.backupPath, 'utf-8'), srBefore, '备份文件内容为写前原样')
  // srJson 侧被写为合并结果：tab 缩进、无尾换行（对齐 TRSS writeJson 格式）
  assert.equal(fs.readFileSync(srFile, 'utf-8'), JSON.stringify([localNew, shared], '', '\t'))
  // 插件侧无新增 → 未重写
  assert.equal(fs.readFileSync(pluginFile, 'utf-8'), JSON.stringify([localNew, shared], null, 2))
})

test('syncOneType 双向：两侧各有独有记录时双向计数并互写', async () => {
  const uid = '100000004'
  const qq = '700000004'
  const shared = makeRecord({ type: 11, time: '2026-10-02 10:00:00', name: '青雀', rank: 4 })
  const localNew = makeRecord({ type: 11, time: '2026-10-05 10:00:00', name: '真珠', rank: 5 })
  const remoteNew = makeRecord({ type: 11, time: '2026-10-03 10:00:00', name: '绯英', rank: 5 })
  writePluginGatcha(sandbox, uid, [localNew, shared])
  const srFile = path.join(writeSrJson(sandbox, qq, uid, [remoteNew, shared]), '11.json')
  const pluginFile = sandbox.pluginPath('data', 'gatcha', uid, '11.json')

  const r = await syncOneType(11, pluginFile, srFile)

  assert.equal(r.status, 'ok')
  assert.deepEqual([r.localCount, r.remoteCount], [2, 2])
  assert.deepEqual([r.addedLocalCount, r.addedRemoteCount], [1, 1], '远端→本地 +1、本地→远端 +1')
  // 两侧写后为同一份合并结果（3 条、新在前），远端有变化 → 已备份
  const mergedExpected = [localNew, remoteNew, shared]
  assert.deepEqual(JSON.parse(fs.readFileSync(pluginFile, 'utf-8')), mergedExpected)
  assert.deepEqual(JSON.parse(fs.readFileSync(srFile, 'utf-8')), mergedExpected)
  assert.ok(r.backupPath && fs.existsSync(r.backupPath))
})

test('syncOneType 保护：损坏 JSON 返回 error 不覆盖任何一侧；两侧全空返回 empty', async () => {
  const scratch = sandbox.pluginPath('temp', 'sync-protect')
  fs.mkdirSync(scratch, { recursive: true })

  // 1) 插件侧损坏：status error，两侧文件原样
  const badPlugin = path.join(scratch, 'plugin-broken.json')
  const srOk = path.join(scratch, 'sr-ok.json')
  const srOriginal = JSON.stringify([{ id: '1765941000011781299', time: '2026-10-01 00:00:00' }])
  fs.writeFileSync(badPlugin, '{ 不是合法json', 'utf-8')
  fs.writeFileSync(srOk, srOriginal, 'utf-8')
  let r = await syncOneType(11, badPlugin, srOk)
  assert.equal(r.status, 'error')
  assert.ok(r.error, '应携带错误说明')
  assert.equal(fs.readFileSync(srOk, 'utf-8'), srOriginal, '另一侧未被写入（防覆盖）')
  assert.equal(fs.readFileSync(badPlugin, 'utf-8'), '{ 不是合法json', '损坏文件保持原样')

  // 2) srJson 侧损坏：同样不覆盖插件侧
  const pluginOk = path.join(scratch, 'plugin-ok.json')
  const badSr = path.join(scratch, 'sr-broken.json')
  fs.writeFileSync(pluginOk, '[]', 'utf-8')
  fs.writeFileSync(badSr, 'not-json', 'utf-8')
  r = await syncOneType(11, pluginOk, badSr)
  assert.equal(r.status, 'error')
  assert.equal(fs.readFileSync(pluginOk, 'utf-8'), '[]')
  assert.equal(fs.readFileSync(badSr, 'utf-8'), 'not-json')

  // 3) 两侧文件均不存在：empty，且不创建文件
  const noneA = path.join(scratch, 'none-a.json')
  const noneB = path.join(scratch, 'none-b.json')
  r = await syncOneType(11, noneA, noneB)
  assert.equal(r.status, 'empty')
  assert.equal(r.addedLocalCount, 0)
  assert.equal(r.addedRemoteCount, 0)
  assert.ok(!fs.existsSync(noneA) && !fs.existsSync(noneB))
})

test('findSrJsonQQ：扫描 srJson 根目录定位 uid 所在 qq 目录', () => {
  const uid = '100000006'
  writeSrJson(sandbox, '700000005', uid, makeRecordSet([{ type: 11, time: '2026-10-01 10:00:00' }]))
  const srRoot = sandbox.path('data', 'srJson')
  assert.equal(findSrJsonQQ(srRoot, uid), '700000005')
  assert.equal(findSrJsonQQ(srRoot, Number(uid)), '700000005', '数字 uid 也能命中')
  assert.equal(findSrJsonQQ(srRoot, '999999999'), null, '不存在的 uid 返回 null')
  assert.equal(findSrJsonQQ(sandbox.path('data', 'no-such-dir'), uid), null, '根目录不存在返回 null')
})
