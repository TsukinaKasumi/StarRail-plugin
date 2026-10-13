/**
 * poolData 卡池时间线数据完整性
 * 覆盖：条目数量与排序、联动条目位置与标记、各池名称能被 appdata 映射命中（防错别字）
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { poolData } from '../../../utils/gatcha/poolData.js'

const readJson = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf-8'))
const char2charid = readJson('../../../resources/gachasimulation/resources/appdata/char2charid.json')
const equipment = readJson('../../../resources/gachasimulation/resources/appdata/equipment.json')
const equipment2life = readJson('../../../resources/gachasimulation/resources/appdata/equipment2life.json')

test('时间线规模：68 条，每条含起止时间', () => {
  assert.ok(poolData.length >= 68, `条目数 ${poolData.length} 应不少于 68`)
  for (const p of poolData) {
    assert.ok(p.from && p.to, `${p.id} 缺少起止时间`)
    assert.ok(new Date(p.from) < new Date(p.to), `${p.id} 起止时间颠倒`)
  }
})

test('联动条目固定置数组末尾且带 gachaType 标记', () => {
  const collab = poolData.filter((p) => p.gachaType)
  assert.equal(collab.length, 4, '应有 4 条联动条目（两期角色/光锥）')
  assert.deepEqual(poolData.slice(-4).map((p) => p.gachaType), [21, 22, 21, 22])
  for (const p of collab) {
    assert.ok(p.id.includes('collab'), `${p.id} 应含 collab 标识`)
  }
})

test('4.6 上下半条目存在且五星为当期（真珠/千冶•刃）', () => {
  const up = poolData.find((p) => p.id === 'ver4.6up')
  const down = poolData.find((p) => p.id === 'ver4.6down')
  assert.ok(up && down, '4.6 上下半条目存在')
  assert.ok(up.char5.includes('真珠'))
  assert.ok(down.char5.includes('千冶•刃'))
})

test('全部角色名能命中 char2charid（防错别字回归）', () => {
  const names = new Set([
    ...poolData.flatMap((p) => p.char5 || []),
    ...poolData.flatMap((p) => p.char4 || [])
  ])
  for (const name of names) {
    assert.ok(char2charid[name], `卡池角色「${name}」不在 char2charid 中`)
  }
})

test('全部光锥名能命中 equipment 与 equipment2life（防错别字回归）', () => {
  const names = new Set([
    ...poolData.flatMap((p) => p.weapon5 || []),
    ...poolData.flatMap((p) => p.weapon4 || [])
  ])
  for (const name of names) {
    assert.ok(equipment[name], `卡池光锥「${name}」不在 equipment 中`)
    assert.ok(equipment2life[name], `卡池光锥「${name}」不在 equipment2life 中`)
  }
})

test('常驻池 7+7 自 1.0 未扩充（调研结论回归锚点）', () => {
  const source = readFileSync(new URL('../../../utils/gachasimulation.js', import.meta.url), 'utf8')
  const list = (re) => {
    const m = source.match(re)
    assert.ok(m, `未匹配到常驻池数组`)
    return m[1].split(',').map((s) => s.trim()).filter(Boolean)
  }
  assert.equal(list(/char:\s*\[([^\]]+)\]/).length, 7, '常驻五星角色应为 7 个')
  assert.equal(list(/weapon:\s*\[([^\]]+)\]/).length, 7, '常驻五星光锥应为 7 把')
})
