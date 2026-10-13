/**
 * 抽取逻辑（apps/gachasimulation.js 的 lottery5/lottery4/getGachaData/getGachaType）
 *
 * 随机数注入：被测模块与测试文件解析到的是同一个 lodash 实例（同一 URL 的模块缓存），
 * 临时替换 lodash.random / lodash.sample 为受控序列即可获得确定性断言：
 *  - random 队列按调用顺序消费，注入值越界（超出 [min,max]）或队列耗尽立即抛错，
 *    使「调用序列与预期不符」在错误的位置尽早暴露；
 *  - sample 会校验注入值确实位于被抽样的候选池内，顺带断言了抽样来源池正确。
 * 恢复保障：每个用例 try/finally 调用恢复函数，并额外 t.after 注册同一（幂等）函数兜底，
 * 断言中途抛出也不会污染后续用例。
 *
 * 数据脱敏：redis 走 helpers/globals.mjs 的内存桩；QQ/UID 均为合成段（10001+）。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import lodash from 'lodash'
import moment from 'moment'
import '../../helpers/globals.mjs'
import { register } from 'node:module'
import { bootFakeRoot } from '../../helpers/boot.mjs'

bootFakeRoot()
register('../../helpers/hooks.mjs', import.meta.url)

const { default: Gacha } = await import('../../../apps/gachasimulation.js')
const { default: gachaInfo } = await import('../../../utils/gachasimulation.js')
const { gachaPool } = gachaInfo

const readJson = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'))
/** appdata 四张表与真实 import 资源一致（只读），lottery 结果的图片/属性名依赖它们 */
const appdata = {
  charToCharID: readJson('../../../resources/gachasimulation/resources/appdata/char2charid.json'),
  weaponJson: readJson('../../../resources/gachasimulation/resources/appdata/equipment.json'),
  weaponLife: readJson('../../../resources/gachasimulation/resources/appdata/equipment2life.json'),
  charDamageTypeJson: readJson('../../../resources/gachasimulation/resources/appdata/chardamagetype.json')
}

// ---- 随机数注入 ----
const origRandom = lodash.random
const origSample = lodash.sample

/** 注入确定性序列，返回幂等的恢复函数 */
function injectLodash ({ random = [], sample = [] } = {}) {
  const randomQueue = [...random]
  const sampleQueue = [...sample]
  lodash.random = (min, max) => {
    const v = randomQueue.shift()
    assert.ok(v !== undefined, `random(${min},${max}) 调用超出注入序列（调用序列与预期不符）`)
    assert.ok(v >= min && v <= max, `random(${min},${max}) 的注入值 ${v} 越界（调用序列与预期不符）`)
    return v
  }
  lodash.sample = (arr) => {
    const v = sampleQueue.shift()
    assert.ok(v !== undefined, `sample 调用超出注入序列：${JSON.stringify(arr)}`)
    assert.ok(Array.isArray(arr) && arr.includes(v), `注入值「${v}」不在被抽样池 ${JSON.stringify(arr)}`)
    return v
  }
  let done = false
  return () => {
    if (done) return
    done = true
    lodash.random = origRandom
    lodash.sample = origSample
  }
}

/**
 * 构造挂在 Gacha.prototype 原型链上的 fake this：
 * lottery5 内部调用 this.probability()，普通对象字面量无法提供，故用 Object.create。
 * QQ/群号均为合成数据。
 */
function mkGacha (type, poolState = {}) {
  const g = Object.create(Gacha.prototype)
  g.e = { isGroup: false, user_id: 10001, group_id: 7000001 }
  g.type = type
  g.gachaThisTime = []
  g.gachaData = {
    [type]: { isUp5: false, isUp4: false, num4: 0, num5: 0, today: { stars: [] }, ...poolState }
  }
  Object.assign(g, appdata)
  return g
}

const redis = globalThis.redis

// ============================== lottery5 ==============================

test('注入基础：被测模块与测试共享同一 lodash 实例（lottery3 取到注入值）', async (t) => {
  const g = mkGacha('up-char')
  const restore = injectLodash({ sample: ['乐圮'] })
  t.after(restore)
  try {
    g.lottery3()
    const r = g.gachaThisTime[0]
    assert.equal(r.name, '乐圮')
    assert.ok(gachaPool['three-weapon'].includes(r.name), '三星应取自 three-weapon 池')
    assert.equal(r.star, 3)
    assert.equal(r.fileName, `weapon/${appdata.weaponJson['乐圮']}.png`)
  } finally {
    restore()
  }
})

test('lottery5：未中五星 → num5+1、不产出结果', async (t) => {
  const g = mkGacha('up-char', { num5: 5, num4: 2 })
  const restore = injectLodash({ random: [10000] }) // 10000 > 60 → 未中
  t.after(restore)
  try {
    assert.equal(await g.lottery5(), false)
    assert.equal(g.gachaData['up-char'].num5, 6)
    assert.equal(g.gachaData['up-char'].num4, 2)
    assert.equal(g.gachaThisTime.length, 0)
    assert.equal(g.gachaData['up-char'].today.stars.length, 0)
    assert.equal(g.hasFive, undefined)
  } finally {
    restore()
  }
})

test('lottery5：UP 命中（点数恰等概率也算中）→ 从 five 数组抽 UP', async (t) => {
  const g = mkGacha('up-char', { num5: 0, num4: 1 })
  const restore = injectLodash({ random: [60, 50], sample: ['真珠'] })
  t.after(restore)
  try {
    assert.equal(await g.lottery5(), true)
    const r = g.gachaThisTime[0]
    assert.equal(r.name, '真珠')
    assert.equal(r.star, 5)
    assert.equal(r.isBigUP, false)
    assert.equal(r.count, 1, '本次为第 num5+1 抽')
    assert.equal(r.type, 1, '角色')
    assert.equal(r.charImageName, `char_image/${appdata.charToCharID['真珠']}.png`)
    assert.equal(r.charDamageType, appdata.charDamageTypeJson[appdata.charToCharID['真珠']])
    assert.equal(g.gachaData['up-char'].num5, 0, '中五星后保底清零')
    assert.equal(g.gachaData['up-char'].num4, 2, '四星保底 +1')
    assert.equal(g.gachaData['up-char'].isUp5, false)
    assert.equal(g.hasFive, true)
    assert.equal(g.gachaData['up-char'].today.stars.length, 1)
  } finally {
    restore()
  }
})

test('lottery5：歪 → 出常驻五星角色且 isUp5 置位，下次必中 UP（大保底）', async (t) => {
  const g = mkGacha('up-char')
  t.after(() => {})

  // 第一抽：UP 未中（random=100 > 50）→ 歪出常驻角色
  let restore = injectLodash({ random: [1, 100], sample: ['姬子'] })
  t.after(restore)
  try {
    assert.equal(await g.lottery5(), true)
    const r = g.gachaThisTime[0]
    assert.ok(gachaPool.normal.char.includes(r.name), `歪出「${r.name}」应为常驻五星角色`)
    assert.equal(r.type, 1)
    assert.equal(r.isBigUP, false)
    assert.equal(g.gachaData['up-char'].isUp5, true, '歪后 isUp5 置位')
  } finally {
    restore()
  }

  // 第二抽：isUp5=true → upProba=101，最差点数（100）也必中 UP
  restore = injectLodash({ random: [1, 100], sample: ['绯英'] })
  t.after(restore)
  try {
    assert.equal(await g.lottery5(), true)
    const r = g.gachaThisTime[1]
    assert.ok(gachaPool['up-char'].five.includes(r.name), '大保底应命中 UP 五星')
    assert.equal(r.isBigUP, true, '大保底命中标记 isBigUP')
    assert.equal(g.gachaData['up-char'].isUp5, false, '大保底已消耗')
  } finally {
    restore()
  }
})

test('lottery5：collab-char 歪出必为常驻 7 角色，UP 命中取联动 five', async (t) => {
  const g = mkGacha('collab-char')
  let restore = injectLodash({ random: [1, 100], sample: ['瓦尔特'] })
  t.after(restore)
  try {
    assert.equal(await g.lottery5(), true)
    const r = g.gachaThisTime[0]
    assert.ok(gachaPool.normal.char.includes(r.name), `联动角色池歪出「${r.name}」应为常驻五星角色`)
    assert.equal(r.type, 1)
    assert.equal(g.gachaData['collab-char'].isUp5, true, '联动池歪后同样置 isUp5')
  } finally {
    restore()
  }
  restore = injectLodash({ random: [1, 1], sample: ['Saber'] })
  t.after(restore)
  try {
    assert.equal(await g.lottery5(), true)
    const r = g.gachaThisTime[1]
    assert.ok(gachaPool['collab-char'].five.includes(r.name), 'UP 命中应取联动 five 名单')
    // 上一抽歪过（isUp5=true），本次 UP 命中即为大保底
    assert.equal(r.isBigUP, true)
    assert.equal(g.gachaData['collab-char'].isUp5, false, '大保底已消耗')
  } finally {
    restore()
  }
})

test('lottery5：collab-weapon 歪出必为常驻光锥，UP 命中取联动 five（75% 边界）', async (t) => {
  const g = mkGacha('collab-weapon')
  // 歪：75% UP 未中（100 > 75）；|| 链上第三次 random(1,100) 被消费但结果不影响分支（type 已排除角色分支）
  let restore = injectLodash({ random: [1, 100, 1], sample: ['银河铁道之夜'] })
  t.after(restore)
  try {
    assert.equal(await g.lottery5(), true)
    const r = g.gachaThisTime[0]
    assert.ok(gachaPool.normal.weapon.includes(r.name), `联动光锥池歪出「${r.name}」应为常驻五星光锥`)
    assert.equal(r.type, 2)
    assert.equal(r.fileName, `weapon/${appdata.weaponJson[r.name]}.png`)
    assert.equal(r.weaponLifeName, `weaponlife/${appdata.weaponLife[r.name]}.png`)
    assert.equal(g.gachaData['collab-weapon'].isUp5, true)
  } finally {
    restore()
  }
  // UP：光锥池 75% 阈值边界（random=75 恰好命中）
  restore = injectLodash({ random: [1, 75], sample: ['没有回报的加冕'] })
  t.after(restore)
  try {
    assert.equal(await g.lottery5(), true)
    const r = g.gachaThisTime[1]
    assert.ok(gachaPool['collab-weapon'].five.includes(r.name), 'UP 命中应取联动光锥 five 名单')
    assert.equal(r.type, 2)
    assert.equal(g.gachaData['collab-weapon'].isUp5, false, '已消耗上一抽的 isUp5')
  } finally {
    restore()
  }
})

test('lottery5：up-weapon 75% UP 与歪', async (t) => {
  const g = mkGacha('up-weapon')
  let restore = injectLodash({ random: [1, 75], sample: ['献给明日的色彩'] })
  t.after(restore)
  try {
    assert.equal(await g.lottery5(), true)
    const r = g.gachaThisTime[0]
    assert.ok(gachaPool['up-weapon'].five.includes(r.name))
    assert.equal(r.type, 2)
  } finally {
    restore()
  }
  restore = injectLodash({ random: [1, 76, 1], sample: ['以世界之名'] })
  t.after(restore)
  try {
    assert.equal(await g.lottery5(), true)
    const r = g.gachaThisTime[1]
    assert.ok(gachaPool.normal.weapon.includes(r.name), 'up-weapon 歪出应为常驻五星光锥')
    assert.equal(g.gachaData['up-weapon'].isUp5, true)
  } finally {
    restore()
  }
})

test('lottery5：normal 池无 UP 概念，角色/光锥各半且不置 isUp5', async (t) => {
  // upProba 被置 0：第二次 random(1,100) 任意值都进歪分支
  const gChar = mkGacha('normal')
  let restore = injectLodash({ random: [1, 1, 1], sample: ['布洛妮娅'] })
  t.after(restore)
  try {
    assert.equal(await gChar.lottery5(), true)
    const r = gChar.gachaThisTime[0]
    assert.ok(gachaPool.normal.char.includes(r.name))
    assert.equal(r.type, 1)
    assert.equal(gChar.gachaData.normal.isUp5, false, '常驻池不使用 isUp5')
    assert.equal(r.isBigUP, false)
  } finally {
    restore()
  }
  const gWeapon = mkGacha('normal')
  restore = injectLodash({ random: [1, 100, 100], sample: ['时节不居'] })
  t.after(restore)
  try {
    assert.equal(await gWeapon.lottery5(), true)
    const r = gWeapon.gachaThisTime[0]
    assert.ok(gachaPool.normal.weapon.includes(r.name))
    assert.equal(r.type, 2)
    assert.equal(gWeapon.gachaData.normal.isUp5, false)
  } finally {
    restore()
  }
})

test('lottery5：num5 计数递增与中五星清零（count 记录保底抽数）', async (t) => {
  const g = mkGacha('up-char', { num5: 89 })
  // 89 抽：概率 8540，差一点未中 → num5 到 90
  let restore = injectLodash({ random: [9000] })
  t.after(restore)
  try {
    assert.equal(await g.lottery5(), false)
    assert.equal(g.gachaData['up-char'].num5, 90)
  } finally {
    restore()
  }
  // 90 抽：概率 10000，random=10000 恰等也算中 → 保底清零，count 记为 91
  restore = injectLodash({ random: [10000, 100], sample: ['姬子'] })
  t.after(restore)
  try {
    assert.equal(await g.lottery5(), true)
    assert.equal(g.gachaData['up-char'].num5, 0)
    assert.equal(g.gachaThisTime[0].count, 91)
  } finally {
    restore()
  }
})

// ============================== lottery4 ==============================

test('lottery4：基础 510/万，未中 num4+1', async (t) => {
  const g = mkGacha('up-char', { num4: 0 })
  const restore = injectLodash({ random: [511] }) // 511 > 510 → 未中
  t.after(restore)
  try {
    assert.equal(await g.lottery4(), false)
    assert.equal(g.gachaData['up-char'].num4, 1)
    assert.equal(g.gachaThisTime.length, 0)
  } finally {
    restore()
  }
})

test('lottery4：非 UP 池四星走全量池（collab-char 半角色半光锥）', async (t) => {
  // collab-char：tmpUp=0 → 走全量；角色侧从 23 个全量四星角色抽
  const gChar = mkGacha('collab-char')
  let restore = injectLodash({ random: [510, 100, 1], sample: ['阿兰'] })
  t.after(restore)
  try {
    assert.equal(await gChar.lottery4(), true)
    const r = gChar.gachaThisTime[0]
    assert.ok(gachaPool['four-char'].includes(r.name), `「${r.name}」应取自全量四星角色池`)
    assert.equal(r.star, 4)
    assert.equal(r.type, 1)
    assert.equal(gChar.gachaData['collab-char'].num4, 0)
    assert.equal(gChar.gachaData['collab-char'].isUp4, true, '非 UP 命中后 isUp4 置位')
  } finally {
    restore()
  }
  // collab-char：光锥侧从 31 把全量四星光锥抽
  const gWeapon = mkGacha('collab-char')
  restore = injectLodash({ random: [510, 100, 100], sample: ['论剑'] })
  t.after(restore)
  try {
    assert.equal(await gWeapon.lottery4(), true)
    const r = gWeapon.gachaThisTime[0]
    assert.ok(gachaPool['four-weapon'].includes(r.name))
    assert.equal(r.type, 2)
  } finally {
    restore()
  }
})

test('lottery4：normal 池无四星 UP，恒走全量光锥（现行为锚点）', async (t) => {
  const g = mkGacha('normal')
  const restore = injectLodash({ random: [510, 100, 1], sample: ['余生的第一天'] })
  t.after(restore)
  try {
    assert.equal(await g.lottery4(), true)
    const r = g.gachaThisTime[0]
    assert.ok(gachaPool['four-weapon'].includes(r.name), '常驻池四星当前恒为光锥（行为锚点）')
    assert.equal(r.type, 2)
    assert.equal(g.gachaData.normal.isUp4, true)
  } finally {
    restore()
  }
})

test('lottery4：UP 池 50% 机制与四星小保底（isUp4 下次必 UP）', async (t) => {
  const g = mkGacha('up-char')
  // 50% 未中（100 > 50）→ 全量光锥，isUp4 置位
  let restore = injectLodash({ random: [510, 100, 100], sample: ['晚安与睡颜'] })
  t.after(restore)
  try {
    assert.equal(await g.lottery4(), true)
    const r = g.gachaThisTime[0]
    assert.ok(gachaPool['four-weapon'].includes(r.name))
    assert.equal(g.gachaData['up-char'].isUp4, true)
  } finally {
    restore()
  }
  // 小保底：isUp4=true → tmpUp=100，最差点数（100）也必中 UP 四星
  restore = injectLodash({ random: [510, 100], sample: ['米沙'] })
  t.after(restore)
  try {
    assert.equal(await g.lottery4(), true)
    const r = g.gachaThisTime[1]
    assert.ok(gachaPool['up-char'].four.includes(r.name), '小保底应命中 UP 四星')
    assert.equal(r.type, 1)
    assert.equal(g.gachaData['up-char'].isUp4, false, 'isUp4 已消耗')
  } finally {
    restore()
  }
  // 50% 命中边界（random=50 恰好等于）→ 直接 UP 四星
  restore = injectLodash({ random: [510, 50], sample: ['青雀'] })
  t.after(restore)
  try {
    assert.equal(await g.lottery4(), true)
    const r = g.gachaThisTime[2]
    assert.ok(gachaPool['up-char'].four.includes(r.name))
  } finally {
    restore()
  }
})

test('lottery4：up-weapon 池基础 660/万 与 UP 四星光锥', async (t) => {
  const g = mkGacha('up-weapon')
  // 660 边界命中 + UP 命中 → up-weapon.four
  let restore = injectLodash({ random: [660, 50], sample: ['一场术后对话'] })
  t.after(restore)
  try {
    assert.equal(await g.lottery4(), true)
    const r = g.gachaThisTime[0]
    assert.ok(gachaPool['up-weapon'].four.includes(r.name))
    assert.equal(r.type, 2)
    assert.equal(r.weaponLifeName, `weaponlife/${appdata.weaponLife[r.name]}.png`)
  } finally {
    restore()
  }
  // UP 未中 → 全量四星光锥（第三次 random 被消费但 type 非 up-char/collab-char，恒走光锥）
  restore = injectLodash({ random: [660, 100, 1], sample: ['晚安与睡颜'] })
  t.after(restore)
  try {
    assert.equal(await g.lottery4(), true)
    const r = g.gachaThisTime[1]
    assert.ok(gachaPool['four-weapon'].includes(r.name))
    assert.equal(g.gachaData['up-weapon'].isUp4, true)
  } finally {
    restore()
  }
})

test('lottery4：九抽保底（num4>=9 任意点数必出四星）', async (t) => {
  // num4=9：510+10000=10510 > 10000 → random=10000 也命中
  const g = mkGacha('up-char', { num4: 9 })
  let restore = injectLodash({ random: [10000, 1], sample: ['雪衣'] })
  t.after(restore)
  try {
    assert.equal(await g.lottery4(), true)
    const r = g.gachaThisTime[0]
    assert.equal(r.star, 4)
    assert.equal(g.gachaData['up-char'].num4, 0, '保底四星后 num4 清零')
  } finally {
    restore()
  }
  // num4=8：概率 510+(8-4)^2*500=8510，差一点未中 → num4 到 9
  const g2 = mkGacha('up-char', { num4: 8 })
  restore = injectLodash({ random: [8511] })
  t.after(restore)
  try {
    assert.equal(await g2.lottery4(), false)
    assert.equal(g2.gachaData['up-char'].num4, 9)
  } finally {
    restore()
  }
})

// ============================== getGachaData ==============================

/** 旧版存档（联动池上线前）：无 collab-char/collab-weapon key */
const legacyArchive = (time) => ({
  time,
  'up-char': { isUp5: true, isUp4: false, num4: 3, num5: 73, today: { stars: [{ name: '青雀', star: 4 }] } },
  'up-weapon': { isUp5: false, isUp4: true, num4: 0, num5: 61, today: { stars: [] } },
  normal: { isUp5: false, isUp4: false, num4: 1, num5: 12, today: { stars: [{ name: '黑塔', star: 4 }] } }
})

/** 构造 getGachaData 的读取者（原型链上提供 getKey） */
const mkReader = (e) => {
  const g = Object.create(Gacha.prototype)
  g.e = e
  return g
}

test('getKey：私聊/群聊 redis key 形态', () => {
  assert.equal(
    Gacha.prototype.getKey.call({ e: { isGroup: false, user_id: 10001 } }),
    'sr-gacha:private:10001'
  )
  assert.equal(
    Gacha.prototype.getKey.call({ e: { isGroup: true, group_id: 7000001, user_id: 10001 } }),
    'sr-gacha:group:7000001:user:10001'
  )
})

test('getGachaData：无存档 → defaultData 含全部 5 个池 key', async () => {
  redis.clear()
  const g = mkReader({ isGroup: false, user_id: 10011 })
  const data = await g.getGachaData()
  assert.deepEqual(
    Object.keys(data).sort(),
    ['collab-char', 'collab-weapon', 'normal', 'time', 'up-char', 'up-weapon']
  )
  for (const key of ['up-char', 'up-weapon', 'normal', 'collab-char', 'collab-weapon']) {
    assert.deepEqual(Object.keys(data[key]).sort(), ['isUp4', 'isUp5', 'num4', 'num5', 'today'])
    assert.deepEqual(data[key].today.stars, [])
    assert.equal(data[key].num5, 0)
    assert.equal(data[key].num4, 0)
    assert.equal(data[key].isUp5, false)
    assert.equal(data[key].isUp4, false)
  }
  assert.equal(data.time, moment().format('YYYY-MM-DD'))
  assert.equal(g.gachaData, data, '结果应缓存到 this.gachaData')
})

test('getGachaData（重点）：旧存档无 collab key → 内存补全不抛错、保底计数保留', async () => {
  redis.clear()
  const key = 'sr-gacha:private:10012'
  await redis.set(key, JSON.stringify(legacyArchive(moment().format('YYYY-MM-DD'))))
  const g = mkReader({ isGroup: false, user_id: 10012 })
  // 老用户存档缺 collab key：补全后直接取值不得 TypeError
  const data = await g.getGachaData()
  const freshPool = { isUp5: false, isUp4: false, num4: 0, num5: 0, today: { stars: [] } }
  assert.deepEqual(data['collab-char'], freshPool, '缺失的 collab-char 应被补全')
  assert.deepEqual(data['collab-weapon'], freshPool, '缺失的 collab-weapon 应被补全')
  // 既有保底计数与状态保留
  assert.equal(data['up-char'].num5, 73)
  assert.equal(data['up-char'].isUp5, true)
  assert.equal(data['up-char'].num4, 3)
  assert.equal(data['up-weapon'].num5, 61)
  assert.equal(data['up-weapon'].isUp4, true)
  assert.equal(data.normal.num5, 12)
  // 同日不清今日记录
  assert.equal(data['up-char'].today.stars.length, 1)
  assert.equal(data.normal.today.stars.length, 1)
})

test('getGachaData：跨天 → today.stars 重置但保底保留，并回写 redis', async () => {
  redis.clear()
  const key = 'sr-gacha:private:10013'
  await redis.set(key, JSON.stringify(legacyArchive('2000-01-01')))
  const g = mkReader({ isGroup: false, user_id: 10013 })
  const data = await g.getGachaData()
  const today = moment().format('YYYY-MM-DD')
  assert.equal(data.time, today, '跨天后 time 更新为今天')
  for (const poolKey of ['up-char', 'up-weapon', 'normal', 'collab-char', 'collab-weapon']) {
    assert.deepEqual(data[poolKey].today.stars, [], `${poolKey} 跨天应清空今日记录`)
  }
  // 跨天只清今日记录，不清保底计数
  assert.equal(data['up-char'].num5, 73)
  assert.equal(data['up-char'].num4, 3)
  assert.equal(data['up-char'].isUp5, true)
  assert.equal(data['up-weapon'].num5, 61)
  // 跨天分支应回写 redis，回写内容同样含全部池 key
  const saved = JSON.parse(await redis.get(key))
  assert.equal(saved.time, today)
  assert.ok(saved['collab-char'] && saved['collab-weapon'], '回写存档应含联动池 key')
  assert.equal(saved['up-char'].num5, 73)
})

test('getGachaData：群聊 key 形态（group:user）同样走旧档补全', async () => {
  redis.clear()
  const key = 'sr-gacha:group:7000002:user:10014'
  await redis.set(key, JSON.stringify(legacyArchive('2000-01-01')))
  const g = mkReader({ isGroup: true, group_id: 7000002, user_id: 10014 })
  const data = await g.getGachaData()
  assert.equal(data['up-weapon'].num5, 61)
  assert.ok(data['collab-char'] && data['collab-weapon'])
  assert.equal(data.time, moment().format('YYYY-MM-DD'))
})

// ============================== getGachaType ==============================

test('getGachaType：命令分派（联动判定优先于角色/光锥）', async () => {
  const cases = [
    ['*十连', 'up-char'],
    ['*抽卡', 'up-char'],
    ['*十连角色', 'up-char'],
    ['*十连光锥', 'up-weapon'],
    ['*十连常驻', 'normal'],
    ['*十连联动', 'collab-char'],
    ['*十连联动光锥', 'collab-weapon'],
    ['*十连联动角色', 'collab-char'],
    ['＊十连联动光锥', 'collab-weapon'],
    ['#星铁抽卡联动', 'collab-char']
  ]
  for (const [msg, expected] of cases) {
    const fake = { type: '', e: { msg } }
    assert.equal(await Gacha.prototype.getGachaType.call(fake), expected, msg)
    assert.equal(fake.type, expected, `${msg} 应同时写入 this.type`)
  }
})
