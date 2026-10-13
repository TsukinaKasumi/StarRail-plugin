/**
 * gatcha.js（utils/gatcha/gatcha.js）API URL 构造与翻页
 * 覆盖：
 * - getRecords 分页链：首页 end_id=0，次页 end_id=首页末条 id（字符串链式透传），空列表停止
 * - 域名回归锚点：国服/B服（uid 前缀 1/2/5）public-operation-hkrpg.mihoyo.com，
 *   国际服（6/7/8/9/18）public-operation-hkrpg-sg.hoyoverse.com；绝不允许 api-takumi 残留
 * - 端点选择：联动池 21/22 走 getLdGachaLog（同域名不同路径），常规池 1/11/12 走 getGachaLog
 * 数据全部由 factories 合成；node-fetch 已由 hooks 重定向到桩，禁真实网络。
 */
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import '../../helpers/globals.mjs'
import { register } from 'node:module'
import { enqueue, resetFetchMock } from '../../helpers/fetch-mock.mjs'
import { makeRecordSet } from '../../helpers/factories.mjs'

register('../../helpers/hooks.mjs', import.meta.url)
const { getRecords, gatchaType } = await import('../../../utils/gatcha/gatcha.js')

/** 空列表页（翻页终止信号） */
const emptyPage = () => ({ body: { data: { list: [] } } })

/** 域名白名单 + api-takumi 零容忍（历史域名残留回归锚点） */
function assertSafeUrl (raw) {
  assert.ok(!raw.includes('api-takumi'), `URL 不得残留 api-takumi 域名: ${raw}`)
  const u = new URL(raw)
  assert.equal(u.protocol, 'https:')
  assert.ok(
    u.host === 'public-operation-hkrpg.mihoyo.com' || u.host === 'public-operation-hkrpg-sg.hoyoverse.com',
    `URL 域名应为国服/国际服白名单之一: ${raw}`
  )
  return u
}

/**
 * 并发执行多个"单页即止"的 getRecords 调用并按调用顺序收集 URL。
 * 顺序确定性依据：getRecords 在首个 await 前同步调用 fetch，桩同步 shift 队列，
 * 因此第 i 个响应项恰被第 i 个调用消费。
 */
async function fetchOncePerUid (cases) {
  const urls = []
  cases.forEach(() => enqueue((url) => { urls.push(url); return emptyPage() }))
  await Promise.all(cases.map(([uid]) => getRecords(uid, 11, '')))
  return urls
}

beforeEach(() => resetFetchMock())

test('getRecords 分页：首页 20 条、次页空列表停止，page/end_id 链式正确', async () => {
  const uid = '100000001'
  // 20 条合成 11 类记录（新在前，末条 id 即次页 end_id）
  const page1 = makeRecordSet(Array.from({ length: 20 }, (_, i) => ({
    type: 11,
    time: `2026-09-28 12:${String(59 - i).padStart(2, '0')}:00`
  })))
  const urls = []
  enqueue((url) => { urls.push(url); return { body: { data: { list: page1 } } } })
  enqueue((url) => { urls.push(url); return emptyPage() })

  const result = await getRecords(uid, 11, '')

  assert.equal(urls.length, 2, '空列表后应停止翻页（共 2 次请求）')
  const [u1, u2] = urls.map(assertSafeUrl)
  assert.equal(u1.host, 'public-operation-hkrpg.mihoyo.com', '1 前缀官服 uid')
  assert.equal(u1.pathname, '/common/gacha_record/api/getGachaLog')
  assert.equal(u1.searchParams.get('gacha_type'), '11')
  assert.equal(u1.searchParams.get('page'), '1')
  assert.equal(u1.searchParams.get('size'), '20')
  assert.equal(u1.searchParams.get('end_id'), '0', '首页 end_id 应为 0')
  assert.equal(u1.searchParams.get('game_biz'), 'hkrpg_cn')
  assert.equal(u1.searchParams.get('default_gacha_type'), '11')
  assert.equal(u1.searchParams.get('lang'), 'zh-cn')
  assert.equal(u2.searchParams.get('page'), '2')
  assert.equal(u2.searchParams.get('gacha_type'), '11')
  assert.equal(u2.searchParams.get('end_id'), page1[19].id, '次页 end_id 应为首页末条记录 id')
  assert.equal(result.length, 20)
  assert.deepEqual(result, page1, '结果应原样汇聚首页 20 条')
})

test('域名回归锚点：国服/B服(1/2/5)走 mihoyo.com，国际服(6/7/8/9/18)走 hoyoverse.com', async () => {
  const cases = [
    ['100000001', 'public-operation-hkrpg.mihoyo.com', 'hkrpg_cn'],         // 官服
    ['200000001', 'public-operation-hkrpg.mihoyo.com', 'hkrpg_cn'],         // 官服
    ['500000001', 'public-operation-hkrpg.mihoyo.com', 'hkrpg_cn'],         // B服
    ['600000001', 'public-operation-hkrpg-sg.hoyoverse.com', 'hkrpg_global'], // 美服
    ['700000001', 'public-operation-hkrpg-sg.hoyoverse.com', 'hkrpg_global'], // 欧服
    ['800000001', 'public-operation-hkrpg-sg.hoyoverse.com', 'hkrpg_global'], // 亚服
    ['900000001', 'public-operation-hkrpg-sg.hoyoverse.com', 'hkrpg_global'], // 港澳台服
    ['1800000001', 'public-operation-hkrpg-sg.hoyoverse.com', 'hkrpg_global'] // 亚服（10 位 uid 的 18 前缀）
  ]
  const urls = await fetchOncePerUid(cases)
  assert.equal(urls.length, cases.length, '每个 uid 恰好一次请求')
  cases.forEach(([uid, host, biz], i) => {
    const u = assertSafeUrl(urls[i])
    assert.equal(u.host, host, `uid ${uid} 的域名`)
    assert.equal(u.searchParams.get('game_biz'), biz, `uid ${uid} 的 game_biz`)
    assert.equal(u.pathname, '/common/gacha_record/api/getGachaLog')
  })
})

test('端点选择：常规池 1/11/12 走 getGachaLog，联动池 21/22 走 getLdGachaLog', async () => {
  const cases = [
    ['100000001', 1, 'public-operation-hkrpg.mihoyo.com', 'getGachaLog'],
    ['100000001', 11, 'public-operation-hkrpg.mihoyo.com', 'getGachaLog'],
    ['100000001', 12, 'public-operation-hkrpg.mihoyo.com', 'getGachaLog'],
    ['100000001', 21, 'public-operation-hkrpg.mihoyo.com', 'getLdGachaLog'],
    ['100000001', 22, 'public-operation-hkrpg.mihoyo.com', 'getLdGachaLog'],
    ['600000001', 21, 'public-operation-hkrpg-sg.hoyoverse.com', 'getLdGachaLog'],
    ['600000001', 11, 'public-operation-hkrpg-sg.hoyoverse.com', 'getGachaLog']
  ]
  const urls = []
  cases.forEach(() => enqueue((url) => { urls.push(url); return emptyPage() }))
  await Promise.all(cases.map(([uid, type]) => getRecords(uid, type, '')))
  assert.equal(urls.length, cases.length)
  cases.forEach(([uid, type, host, api], i) => {
    const u = assertSafeUrl(urls[i])
    assert.equal(u.host, host, `uid ${uid} type ${type} 的域名`)
    assert.equal(u.pathname, `/common/gacha_record/api/${api}`, `type ${type} 的端点路径`)
    assert.equal(u.searchParams.get('gacha_type'), String(type))
  })
})

test('gatchaType 映射：六类跃迁名称齐全（含两类联动）', () => {
  assert.deepEqual(gatchaType, {
    1: '群星跃迁',
    2: '新手跃迁',
    11: '限定跃迁',
    12: '光锥跃迁',
    21: '角色联动跃迁',
    22: '光锥联动跃迁'
  })
})
