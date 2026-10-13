/**
 * GatchaData 统计与归组（utils/gatcha/index.js）
 * 覆盖场景（记录时间点取自 poolData 时间线，数据全部由 factories 合成）：
 * ① 常规期归组：2026-10 的 11 类记录归 ver4.6up，isUp 按当期 UP 名单判定
 * ② 二期联动窗口：2026-08 的 21/22 类记录归 ver4.4collab（期次按时间，UP 按当期名单）
 * ③ 一期联动：2025-08 的 21/22 类记录归 ver3.4collab（二期尚未开池）
 * ④ 维护窗口兜底：版本 to(14:59:59)~次日 06:00 之间的记录归上一期；超过 24h 不回退
 * ⑤⑥ stat(0) 全类型混合：分池计数、currInfo.last 全键、两类联动 typeName、currPool 不含联动
 * ⑦ 新手池 type 2 走实时拉取分支（fetch-mock 提供分页），以及 getData 文件分支与 reject 语义
 *
 * 时间鲁棒性：当期池与当期窗口随运行日期变化，期望值通过下方镜像函数从
 * poolData + 运行时刻推导，测试可在任意日期运行（poolData 更新后自动跟随）。
 */
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import '../../helpers/globals.mjs'
import { register } from 'node:module'
import { bootFakeRoot } from '../../helpers/boot.mjs'
import { makeRecord, makeRecordSet, writePluginGatcha } from '../../helpers/factories.mjs'
import { enqueue, resetFetchMock } from '../../helpers/fetch-mock.mjs'
import { poolData } from '../../../utils/gatcha/poolData.js'

const sandbox = bootFakeRoot()
register('../../helpers/hooks.mjs', import.meta.url)
const { default: GatchaData } = await import('../../../utils/gatcha/index.js')

// ---- 时间口径：与被测模块一致（'YYYY-MM-DD HH:mm:ss' 按本地时区解析） ----
const parseLocal = (s) => new Date(String(s).replace(' ', 'T'))
const fmtLocal = (d) => [
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
].join(' ')

/** 镜像 stat 的当期池查找：首个包含当前时间的常规（非联动）条目 */
const findCurrentRegularPool = () => {
  const now = new Date()
  return poolData.find((p) => !p.gachaType && parseLocal(p.from) < now && now < parseLocal(p.to)) || null
}
/** 镜像 withList 的当期判定：记录时间落在当期池窗口内 */
const inCurrentPool = (pool, time) =>
  !!pool && parseLocal(pool.from) < parseLocal(time) && parseLocal(time) < parseLocal(pool.to)
/** 'YYYY-MM-DD HH:mm:ss' 字典序即时间序，取最大者 */
const maxTime = (times) => times.filter(Boolean).sort().pop()

beforeEach(() => resetFetchMock())

test('① 常规期归组：2026-10 的 11 类记录归 ver4.6up，isUp 按当期 UP 名单判定', async () => {
  const uid = '100000001'
  const records = makeRecordSet([
    { type: 11, time: '2026-10-05 10:00:00', name: '真珠', itemId: '1013', rank: 5 }, // 当期 UP 五星
    { type: 11, time: '2026-10-03 09:00:00', name: '希儿', itemId: '1101', rank: 5 }, // 五星但非当期 UP
    { type: 11, time: '2026-10-01 08:00:00', name: '青雀', itemId: '1008', rank: 4 },
    { type: 11, time: '2026-09-29 07:30:00', name: '米沙', itemId: '1004', rank: 4 }
  ])
  writePluginGatcha(sandbox, uid, records)

  const obj = await new GatchaData(uid).stat(11)

  assert.equal(obj.data.length, 1, 'stat(11) 仅返回 11 类一组')
  const entry = obj.data[0]
  assert.equal(entry.type, 11)
  assert.equal(entry.typeName, '限定跃迁')
  assert.deepEqual(entry.records.map((r) => r.name), ['真珠', '希儿', '青雀', '米沙'], 'records 新在前')

  // 全部归入 ver4.6up（2026-09-28 06:00 ~ 2026-10-21 11:59:59）
  for (const r of entry.records) {
    assert.equal(r.pool, 'ver4.6up')
    assert.equal(r.poolInfo.id, 'ver4.6up')
    assert.equal(r.poolInfo.version, '4.6')
  }
  // isUp：仅当期 UP 名单内的五星为 true
  assert.equal(entry.records[0].isUp, true, '真珠为 ver4.6up UP 五星')
  assert.equal(entry.records[1].isUp, false, '希儿不在 ver4.6up UP 名单')
  assert.equal(entry.records[2].isUp, false, '四星恒为 false')
  assert.equal(entry.records[3].isUp, false)
  // 角色渲染元数据
  assert.equal(entry.records[0].imgPath, 'gatcha/images/char/1013.png')
  assert.equal(entry.records[0].className, 'char rank5')
  // 分组与总量
  assert.deepEqual(Object.keys(entry.groups), ['ver4.6up'])
  assert.equal(entry.groups['ver4.6up'].total, 4)
  assert.equal(obj.totalNum, 4)
  assert.equal(obj.totalNum11, 4)
  assert.equal(obj.totalNum1 + obj.totalNum12 + obj.totalNum21 + obj.totalNum22, 0)
  // 持有：四星 2、五星 2（全为角色）
  assert.deepEqual(obj.holdNum.num, [2, 2])
  assert.deepEqual(obj.characterHoldNum.num, [2, 2])
  assert.deepEqual(obj.lightConesHoldNum.num, [0, 0])
  // 本地记录时间范围：初始值取当期池窗口，被记录跨度收窄/外推
  const curr = findCurrentRegularPool()
  assert.equal(obj.localFirstTime, '2026-09-29 07:30:00')
  assert.equal(obj.localLastTime, maxTime([curr?.from, '2026-10-05 10:00:00']))
  // 当期池与当期统计随运行日期由时间线决定（镜像推导期望值）
  assert.equal(obj.currInfo.currPool?.id, curr?.id)
  const inWindow = records.filter((r) => inCurrentPool(curr, r.time))
  assert.equal(obj.currInfo.totalNum, inWindow.length)
  assert.deepEqual(obj.currInfo.holdNum.num, [
    inWindow.filter((r) => r.rank_type === '4').length,
    inWindow.filter((r) => r.rank_type === '5').length
  ])
})

test('② 二期联动窗口：2026-08 的 21/22 类记录归 ver4.4collab，联动 UP isUp=true', async () => {
  const uid = '100000002'
  writePluginGatcha(sandbox, uid, [
    ...makeRecordSet([
      { type: 21, time: '2026-08-10 14:00:00', name: '远坂凛', itemId: '1014', rank: 5 },
      { type: 21, time: '2026-08-01 13:00:00', name: 'Saber', itemId: '1015', rank: 5 }, // 一期 UP，在二期窗口不判 UP
      { type: 21, time: '2026-07-25 12:30:00', name: '青雀', itemId: '1008', rank: 4 }
    ]),
    ...makeRecordSet([
      { type: 22, time: '2026-08-20 09:00:00', name: '星火悄然闪耀', itemId: '23020', rank: 5 },
      { type: 22, time: '2026-08-02 10:00:00', name: '没有回报的加冕', itemId: '23010', rank: 5 } // 一期联动光锥 UP
    ])
  ])

  const charObj = await new GatchaData(uid).stat(21)
  const entry21 = charObj.data[0]
  assert.equal(entry21.typeName, '角色联动跃迁')
  assert.equal(charObj.totalNum21, 3)
  assert.deepEqual(entry21.records.map((r) => r.name), ['远坂凛', 'Saber', '青雀'])
  for (const r of entry21.records) {
    assert.equal(r.pool, 'ver4.4collab', '二期窗口（≥2026-07-24 开池）应归二期联动')
    assert.equal(r.poolInfo.gachaType, 21)
  }
  assert.equal(entry21.records[0].isUp, true, '远坂凛为二期联动 UP')
  assert.equal(entry21.records[1].isUp, false, 'Saber 为一期 UP：期次按时间归组，不跨期判 UP')
  assert.equal(entry21.records[2].isUp, false)
  assert.ok(entry21.groups['ver4.4collab'], '联动池也生成分组')

  const coneObj = await new GatchaData(uid).stat(22)
  const entry22 = coneObj.data[0]
  assert.equal(entry22.typeName, '光锥联动跃迁')
  assert.equal(coneObj.totalNum22, 2)
  for (const r of entry22.records) {
    assert.equal(r.pool, 'ver4.4collabWeapon')
  }
  assert.equal(entry22.records[0].isUp, true, '星火悄然闪耀为二期联动光锥 UP')
  assert.equal(entry22.records[1].isUp, false, '没有回报的加冕为一期 UP，不算二期 UP')
  // 光锥渲染元数据
  assert.equal(entry22.records[0].imgPath, 'panel/resources/weapon/23020.png')
  assert.equal(entry22.records[0].className, 'cones rank5')
})

test('③ 一期联动：2025-08 的 21/22 类记录归 ver3.4collab（二期尚未开池）', async () => {
  const uid = '100000003'
  writePluginGatcha(sandbox, uid, [
    ...makeRecordSet([
      { type: 21, time: '2025-08-10 12:00:00', name: 'Saber', itemId: '1015', rank: 5 },
      { type: 21, time: '2025-07-12 12:30:00', name: 'Archer', itemId: '1016', rank: 5 }
    ]),
    ...makeRecordSet([
      { type: 22, time: '2025-08-15 10:00:00', name: '理想燃烧的地狱', itemId: '23011', rank: 5 }
    ])
  ])

  const obj21 = await new GatchaData(uid).stat(21)
  assert.equal(obj21.totalNum21, 2)
  assert.deepEqual(Object.keys(obj21.data[0].groups), ['ver3.4collab'])
  for (const r of obj21.data[0].records) {
    assert.equal(r.pool, 'ver3.4collab', '一期窗口（2025-07-11 开池，二期未开）归一期联动')
    assert.equal(r.isUp, true, 'Saber/Archer 为一期联动 UP')
  }

  const obj22 = await new GatchaData(uid).stat(22)
  assert.equal(obj22.data[0].records[0].pool, 'ver3.4collabWeapon')
  assert.equal(obj22.data[0].records[0].isUp, true, '理想燃烧的地狱为一期联动光锥 UP')
})

test('④ 维护窗口兜底：版本 to(14:59:59)~次日 06:00 的记录归上一期', async () => {
  const uid = '100000004'
  // ver4.4down to=2026-08-25 14:59:59，ver4.5up from=2026-08-26 06:00:00
  // poolData 尾部常规池 +25h 的记录：视为尚未收录的新版本，不回退归组
  const lastRegular = poolData.filter((p) => !p.gachaType).pop()
  const beyondTime = fmtLocal(new Date(parseLocal(lastRegular.to).getTime() + 25 * 3600 * 1000))
  const records = makeRecordSet([
    { type: 11, time: beyondTime, name: '丹恒', itemId: '1002', rank: 5 }, // 新版本空窗（>24h）
    { type: 11, time: '2026-08-26 07:00:00', name: '素裳', itemId: '1006', rank: 4 }, // 对照：已进入 ver4.5up
    { type: 11, time: '2026-08-26 04:30:00', name: '停云', itemId: '1005', rank: 4 }, // 窗口末段
    { type: 11, time: '2026-08-25 20:00:00', name: '青雀', itemId: '1008', rank: 4 } // 窗口首段
  ])
  writePluginGatcha(sandbox, uid, records)

  const obj = await new GatchaData(uid).stat(11)
  const byName = Object.fromEntries(obj.data[0].records.map((r) => [r.name, r]))
  assert.equal(byName.青雀.pool, 'ver4.4down', '版本结束当日 14:59:59 之后的记录归上一期')
  assert.equal(byName.停云.pool, 'ver4.4down', '次日 06:00 开池前的记录归上一期')
  assert.equal(byName.素裳.pool, 'ver4.5up', '06:00 后的记录归新版本（对照）')
  assert.equal(byName.丹恒.poolInfo, false, `距上一期（${lastRegular.id}）结束超 24h 不回退，保持无归组`)
  assert.equal(byName.丹恒.pool, undefined)
})

test('⑤⑥ stat(0) 全类型混合：总量校验、currInfo.last 全键、联动 typeName、currPool 不含联动', async () => {
  const uid = '100000005'
  const records = [
    // type 1 常驻（旧→新：5★、3★、3★ → 当期已抽未出 last[1] = {4:3, 5:2}）
    ...makeRecordSet([
      { type: 1, time: '2026-09-25 11:00:00', name: '乐圆', itemId: '20001', rank: 3 },
      { type: 1, time: '2026-09-22 10:00:00', name: '雾中灯', itemId: '20001', rank: 3 },
      { type: 1, time: '2026-09-20 10:00:00', name: '姬子', itemId: '1004', rank: 5 }
    ]),
    ...makeRecordSet([
      { type: 11, time: '2026-10-05 10:00:00', name: '真珠', itemId: '1013', rank: 5 },
      { type: 11, time: '2026-10-02 09:00:00', name: '绯英', itemId: '1017', rank: 5 },
      { type: 11, time: '2026-10-01 08:00:00', name: '青雀', itemId: '1008', rank: 4 }
    ]),
    ...makeRecordSet([
      { type: 12, time: '2026-10-04 20:00:00', name: '献给明日的色彩', itemId: '23030', rank: 5 },
      { type: 12, time: '2026-10-02 21:00:00', name: '一场术后对话', itemId: '21000', rank: 4 }
    ]),
    ...makeRecordSet([
      { type: 21, time: '2026-08-10 14:00:00', name: '远坂凛', itemId: '1014', rank: 5 },
      { type: 21, time: '2026-08-01 13:00:00', name: 'Saber', itemId: '1015', rank: 5 }
    ]),
    ...makeRecordSet([
      { type: 22, time: '2026-08-20 09:00:00', name: '星火悄然闪耀', itemId: '23020', rank: 5 },
      { type: 22, time: '2026-08-02 10:00:00', name: '没有回报的加冕', itemId: '23010', rank: 5 }
    ])
  ]
  writePluginGatcha(sandbox, uid, records)

  const obj = await new GatchaData(uid).stat(0)

  // 总量与分池计数
  assert.equal(obj.totalNum, 12)
  assert.equal(obj.totalNum1, 3)
  assert.equal(obj.totalNum11, 3)
  assert.equal(obj.totalNum12, 2)
  assert.equal(obj.totalNum21, 2)
  assert.equal(obj.totalNum22, 2)
  assert.equal(obj.totalNum, obj.totalNum1 + obj.totalNum11 + obj.totalNum12 + obj.totalNum21 + obj.totalNum22)

  // data：五个落盘类型（type 2 无本地记录被过滤），两类联动 typeName 存在
  assert.deepEqual(obj.data.map((d) => d.type), [1, 11, 12, 21, 22])
  const byType = Object.fromEntries(obj.data.map((d) => [d.type, d]))
  assert.equal(byType[21].typeName, '角色联动跃迁')
  assert.equal(byType[22].typeName, '光锥联动跃迁')
  assert.equal(byType[11].typeName, '限定跃迁')
  assert.equal(byType[1].typeName, '群星跃迁')
  assert.equal(byType[12].typeName, '光锥跃迁')

  // isUp 抽查（角色/光锥/联动、负例）
  const findRec = (name) => obj.data.flatMap((d) => d.records).find((r) => r.name === name)
  assert.equal(findRec('真珠').isUp, true)
  assert.equal(findRec('绯英').isUp, true)
  assert.equal(findRec('献给明日的色彩').isUp, true)
  assert.equal(findRec('远坂凛').isUp, true)
  assert.equal(findRec('Saber').isUp, false, '二期窗口内的一期 UP 不判 UP')
  assert.equal(findRec('姬子').isUp, false)

  // currInfo.last：六类键齐全（21/22 记录存在时不崩），值结构完整
  assert.deepEqual(Object.keys(obj.currInfo.last).map(Number).sort((a, b) => a - b), [1, 2, 11, 12, 21, 22])
  for (const t of Object.values(obj.currInfo.last)) {
    assert.equal(typeof t[4], 'number')
    assert.equal(typeof t[5], 'number')
  }
  // type 1 数据集（旧→新：5★、3★、3★）→ 距上个 4★+ 3 抽、距上个 5★ 2 抽
  assert.deepEqual(obj.currInfo.last[1], { 4: 3, 5: 2 })

  // currPool 不含联动条目（联动 to 为 2036 哨兵，当期判定须排除）
  const curr = findCurrentRegularPool()
  assert.equal(obj.currInfo.currPool?.id, curr?.id)
  assert.ok(!obj.currInfo.currPool?.gachaType, '当期池不得为联动条目')

  // 当期统计与时间线镜像一致
  const inWindow = records.filter((r) => inCurrentPool(curr, r.time))
  assert.equal(obj.currInfo.totalNum, inWindow.length)
  assert.deepEqual(obj.currInfo.holdNum.num, [
    inWindow.filter((r) => r.rank_type === '4').length,
    inWindow.filter((r) => r.rank_type === '5').length
  ])

  // 持有总数：四星 2、五星 8（角色 1/5、光锥 1/3）；本地记录时间范围
  assert.deepEqual(obj.holdNum.num, [2, 8])
  assert.deepEqual(obj.characterHoldNum.num, [1, 5])
  assert.deepEqual(obj.lightConesHoldNum.num, [1, 3])
  assert.equal(obj.localFirstTime, '2026-08-01 13:00:00')
  assert.equal(obj.localLastTime, maxTime([curr?.from, '2026-10-05 10:00:00']))
})

test('⑦ 新手池 type 2：getData 走实时拉取分支（fetch-mock 一页数据 + 终止页）', async () => {
  const uid = '100000006' // 未落盘任何文件：若误走文件分支会 reject
  const page = makeRecordSet([
    { type: 2, time: '2026-10-06 12:05:00', name: '青雀', itemId: '1008', rank: 4 },
    { type: 2, time: '2026-10-06 12:00:00', name: '黑塔', itemId: '1003', rank: 4 }
  ])
  const urls = []
  enqueue((url) => { urls.push(url); return { body: { data: { list: page } } } })
  enqueue((url) => { urls.push(url); return { body: { data: { list: [] } } } })

  const records = await new GatchaData(uid).getData(2)

  assert.deepEqual(records, page, '应原样返回 API 分页结果')
  assert.equal(urls.length, 2)
  const [u1, u2] = urls.map((u) => new URL(u))
  assert.equal(u1.searchParams.get('gacha_type'), '2')
  assert.equal(u1.pathname, '/common/gacha_record/api/getGachaLog', 'type 2 走常规端点')
  assert.equal(u1.searchParams.get('page'), '1')
  assert.equal(u2.searchParams.get('page'), '2')
})

test('getData 文件分支：存在即读取，缺失/未指定 type 时以字符串 reject', async () => {
  const uid = '100000007'
  const records = makeRecordSet([{ type: 11, time: '2026-10-01 10:00:00', name: '真珠', rank: 5 }])
  writePluginGatcha(sandbox, uid, records)

  const gd = new GatchaData(uid)
  assert.deepEqual(await gd.getData(11), records)
  await assert.rejects(() => gd.getData(1), (err) => err === '抽卡记录不存在', '未落盘类型应以字符串 reject')
  await assert.rejects(() => new GatchaData(uid).getData(), (err) => err === '查询type为空', '未指定 type 应 reject')
})

// ---- 回归：总览容忍缺失类型（线上反馈 2026-10-11，曾因 C12 无条件拉取 21/22 崩溃）----

test('⑧ stat(0) 无 21/22 文件（未抽联动池用户）：总览跳过缺失类型不报错', async () => {
  const uid = '100000008'
  writePluginGatcha(sandbox, uid, makeRecordSet([
    { type: 1, time: '2026-10-01 10:00:00', name: '姬子', rank: 5 },
    { type: 11, time: '2026-10-01 10:01:00', name: '真珠', rank: 5 },
    { type: 12, time: '2026-10-01 10:02:00', name: '献给明日的色彩', rank: 5, itemId: '23061' }
  ]))
  const stat = await new GatchaData(uid).stat(0)
  assert.equal(stat.totalNum, 3)
  assert.deepEqual(stat.data.map((d) => d.typeName), ['群星跃迁', '限定跃迁', '光锥跃迁'], '缺失的 21/22 不产生数据块')
  assert.equal(stat.totalNum21, 0)
  assert.equal(stat.totalNum22, 0)
  // currInfo.last 含 21/22 键（初始化结构完整，渲染模板按类型读）
  assert.ok(stat.currInfo.last[21] && stat.currInfo.last[22])
})

test('⑨ 缺失类型的显式查询仍严格报错；总览全空保留引导提示语义', async () => {
  const uid = '100000009'
  writePluginGatcha(sandbox, uid, makeRecordSet([
    { type: 11, time: '2026-10-01 10:00:00', name: '真珠', rank: 5 }
  ]))
  const gd = new GatchaData(uid)
  await assert.rejects(() => gd.stat(21), (err) => err === '抽卡记录不存在',
    '显式查询联动池（无记录）应报错引导同步/更新')
  await assert.rejects(() => gd.stat(22), (err) => err === '抽卡记录不存在')
  // 完全无记录的 uid：总览也 reject（渲染层转为"本地暂无抽卡记录"提示）
  await assert.rejects(() => new GatchaData('100000010').stat(0), (err) => err === '抽卡记录不存在')
})
