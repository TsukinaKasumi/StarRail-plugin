/**
 * probability 五星概率曲线（apps/gachasimulation.js）
 * 加载方式：globals → hooks register → 伪根引导 → 动态 import 被测 app（见 test/README.md 约定），
 * 以 fake this 直接调用原型方法：Gacha.prototype.probability.call({ type, gachaData })。
 *
 * 锚点（万分比）：
 *  - 角色/常驻/角色联动池 60 / 74 / 90 结构；C6 软保底笔误修复锚点
 *    num5=73 → 580（旧笔误值 980 = 60+(73-50)*40 不得回归）
 *  - 光锥/光锥联动池 80 / 62 / 80 结构
 *  - 联动池与对应常规池同曲线、常驻池同角色池曲线
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import '../../helpers/globals.mjs'
import { register } from 'node:module'
import { bootFakeRoot } from '../../helpers/boot.mjs'

bootFakeRoot()
register('../../helpers/hooks.mjs', import.meta.url)

const { default: Gacha } = await import('../../../apps/gachasimulation.js')

/** 以 fake this 调 probability，返回该 num5 下的万分比概率 */
const prob = async (type, num5) =>
  Gacha.prototype.probability.call({ type, gachaData: { [type]: { num5 } } })

test('角色池基线：60 抽前固定 60/万', async () => {
  assert.equal(await prob('up-char', 0), 60)
  assert.equal(await prob('up-char', 59), 60)
})

test('C6 修复锚点：num5=73 → 580、num5=74 → 590（软保底连续性）', async () => {
  assert.equal(await prob('up-char', 73), 580, '73 抽应走 60 段公式：60+(73-60)*40')
  assert.equal(await prob('up-char', 74), 590, '74 抽应走 590 段起点')
  // 反向锚点：旧笔误公式 60+(73-50)*40=980 不得回归
  assert.notEqual(await prob('up-char', 73), 980)
})

test('角色池软保底斜率与硬保底', async () => {
  assert.equal(await prob('up-char', 60), 60)      // 60 段起点（未涨）
  assert.equal(await prob('up-char', 61), 100)     // 60 + 1*40
  assert.equal(await prob('up-char', 70), 460)     // 60 + 10*40
  assert.equal(await prob('up-char', 75), 1120)    // 590 + 1*530
  assert.equal(await prob('up-char', 89), 8540)    // 590 + 15*530
  assert.equal(await prob('up-char', 90), 10000)   // 硬保底
  assert.equal(await prob('up-char', 120), 10000)  // 超过 90 仍为满
})

test('角色池曲线 55→90 单调不减（软保底连续性）', async () => {
  let prev = 0
  for (let n = 55; n <= 90; n++) {
    const p = await prob('up-char', n)
    assert.ok(p >= prev, `num5=${n} 概率 ${p} 低于前一点 ${prev}（软保底断裂）`)
    prev = p
  }
})

test('光锥池 80/62/80 结构：62 → 780（80+700）', async () => {
  assert.equal(await prob('up-weapon', 0), 80)
  assert.equal(await prob('up-weapon', 49), 80)
  assert.equal(await prob('up-weapon', 50), 80)    // 50 段起点（未涨）
  assert.equal(await prob('up-weapon', 51), 140)   // 80 + 1*60
  assert.equal(await prob('up-weapon', 61), 740)   // 80 + 11*60
  assert.equal(await prob('up-weapon', 62), 780)   // 80 + 1*700
  assert.equal(await prob('up-weapon', 63), 1480)  // 80 + 2*700
  assert.equal(await prob('up-weapon', 80), 10000) // 硬保底
  assert.equal(await prob('up-weapon', 99), 10000)
})

test('光锥池 10~20 抽福利段与段外回落', async () => {
  assert.equal(await prob('up-weapon', 5), 80)
  assert.equal(await prob('up-weapon', 15), 230)   // 80 + 5*30
  assert.equal(await prob('up-weapon', 20), 380)   // 80 + 10*30
  assert.equal(await prob('up-weapon', 21), 80)    // 福利段外回落基础值
})

test('collab-char 与 up-char 同曲线（角色联动 60/74/90）', async () => {
  for (const n of [0, 15, 59, 60, 73, 74, 75, 89, 90]) {
    assert.equal(await prob('collab-char', n), await prob('up-char', n), `num5=${n}`)
  }
})

test('collab-weapon 与 up-weapon 同曲线（光锥联动 80/62/80）', async () => {
  for (const n of [0, 15, 50, 61, 62, 63, 79, 80]) {
    assert.equal(await prob('collab-weapon', n), await prob('up-weapon', n), `num5=${n}`)
  }
})

test('normal 常驻池同角色池曲线', async () => {
  for (const n of [0, 59, 60, 73, 74, 75, 89, 90]) {
    assert.equal(await prob('normal', n), await prob('up-char', n), `num5=${n}`)
  }
})
