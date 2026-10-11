/**
 * gachaPool 卡池数据完整性（utils/gachasimulation.js）
 * 覆盖：4.6 当期 UP（真珠+绯英 / 献给明日的色彩+邂逅于下一个花季）、联动五星名单、
 * 四星 23 角色 / 31 光锥与三星 25 把全量池、UP 四星 ⊆ 全量四星、常驻 7+7、
 * 名字全部命中 appdata（对照 resources/gachasimulation/resources 的 import 资源）、
 * 强化角色（Pro / 2xxx）不可抽取。
 * 注：常驻 7+7 的调研锚点另见 test/utils/gacha/pool-data.test.js，此处从 gachaPool 角度复验。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import gachaInfo from '../../../utils/gachasimulation.js'

const { gachaPool } = gachaInfo

const readJson = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'))
const char2charid = readJson('../../../resources/gachasimulation/resources/appdata/char2charid.json')
const equipment = readJson('../../../resources/gachasimulation/resources/appdata/equipment.json')
const equipment2life = readJson('../../../resources/gachasimulation/resources/appdata/equipment2life.json')

/** 强化形态角色（Pro，avatarId 2xxx）——与 utils/panel/enhanced.js 白名单一致，不可抽取 */
const ENHANCED_CHAR_NAMES = [
  '瓦尔特Pro', '卡芙卡Pro', '银狼Pro', '希儿Pro', '刃Pro', '镜流Pro',
  '藿藿Pro', '花火Pro', '黑天鹅Pro', '流萤Pro'
]

const noDup = (list, what) => {
  assert.equal(new Set(list).size, list.length, `${what} 存在重复：${list.join('、')}`)
}

const ALL_CHAR_NAMES = () => [
  ...gachaPool['up-char'].five,
  ...gachaPool['up-char'].four,
  ...gachaPool['collab-char'].five,
  ...gachaPool.normal.char,
  ...gachaPool['four-char']
]

const ALL_WEAPON_NAMES = () => [
  ...gachaPool['up-weapon'].five,
  ...gachaPool['up-weapon'].four,
  ...gachaPool['collab-weapon'].five,
  ...gachaPool.normal.weapon,
  ...gachaPool['four-weapon'],
  ...gachaPool['three-weapon']
]

test('池 key 全集为 8 个，UP 池 five 为数组（一池多五星 UP 结构）', () => {
  assert.deepEqual(
    Object.keys(gachaPool).sort(),
    ['collab-char', 'collab-weapon', 'four-char', 'four-weapon', 'normal', 'three-weapon', 'up-char', 'up-weapon']
  )
  // 3.2 起铭心之萃/真意之汇集合池一池多 UP，five 统一为数组
  for (const key of ['up-char', 'up-weapon', 'collab-char', 'collab-weapon']) {
    assert.ok(Array.isArray(gachaPool[key].five), `${key}.five 应为数组`)
    assert.ok(gachaPool[key].five.length > 0, `${key}.five 不应为空`)
  }
})

test('up-char 为 4.6 上半当期：真珠 + 绯英', () => {
  assert.deepEqual(gachaPool['up-char'].five, ['真珠', '绯英'])
  assert.deepEqual(gachaPool['up-char'].four, ['青雀', '雪衣', '米沙'])
})

test('up-weapon 为 4.6 上半当期：献给明日的色彩 + 邂逅于下一个花季', () => {
  assert.deepEqual(gachaPool['up-weapon'].five, ['献给明日的色彩', '邂逅于下一个花季'])
  assert.deepEqual(gachaPool['up-weapon'].four, ['一场术后对话', '与行星相会', '无边曼舞'])
})

test('collab 五星名单：Saber/Archer/远坂凛/吉尔伽美什 与四把专属光锥', () => {
  assert.deepEqual(gachaPool['collab-char'].five, ['Saber', 'Archer', '远坂凛', '吉尔伽美什'])
  assert.deepEqual(
    gachaPool['collab-weapon'].five,
    ['没有回报的加冕', '理想燃烧的地狱', '星火悄然闪耀', '所见即我']
  )
  // 联动池四星无 UP（真实机制未证实），四星走全量四星池
  assert.deepEqual(gachaPool['collab-char'].four, [])
  assert.deepEqual(gachaPool['collab-weapon'].four, [])
})

test('全量四星角色 23 个，名字全部命中 char2charid 且无重复', () => {
  const list = gachaPool['four-char']
  assert.equal(list.length, 23, `四星角色应为 23 个，实际 ${list.length}`)
  noDup(list, 'four-char')
  for (const name of list) {
    assert.ok(char2charid[name], `四星角色「${name}」不在 char2charid`)
  }
})

test('全量四星光锥 31 把 / 三星光锥 25 把，全部命中 equipment 且互不重叠', () => {
  const four = gachaPool['four-weapon']
  const three = gachaPool['three-weapon']
  assert.equal(four.length, 31, `四星光锥应为 31 把，实际 ${four.length}`)
  assert.equal(three.length, 25, `三星光锥应为 25 把，实际 ${three.length}`)
  noDup(four, 'four-weapon')
  noDup(three, 'three-weapon')
  for (const name of [...four, ...three]) {
    assert.ok(equipment[name], `光锥「${name}」不在 equipment`)
  }
  // 四星与三星不可同名（同一把光锥不会既是三星又是四星）
  assert.deepEqual(four.filter((n) => three.includes(n)), [], '四星与三星光锥名单重叠')
})

test('UP 四星 ⊆ 全量四星池', () => {
  for (const name of gachaPool['up-char'].four) {
    assert.ok(gachaPool['four-char'].includes(name), `UP 四星「${name}」不在全量四星角色池`)
  }
  for (const name of gachaPool['up-weapon'].four) {
    assert.ok(gachaPool['four-weapon'].includes(name), `UP 四星「${name}」不在全量四星光锥池`)
  }
})

test('常驻池 7 角色 + 7 光锥（自 1.0 未扩充，gachaPool 角度复验）', () => {
  assert.equal(gachaPool.normal.char.length, 7, '常驻五星角色应为 7 个')
  assert.equal(gachaPool.normal.weapon.length, 7, '常驻五星光锥应为 7 把')
  noDup(gachaPool.normal.char, 'normal.char')
  noDup(gachaPool.normal.weapon, 'normal.weapon')
  // 常驻五星与四星池不混淆
  for (const name of gachaPool.normal.char) {
    assert.ok(!gachaPool['four-char'].includes(name), `常驻五星「${name}」不应出现在四星池`)
  }
  for (const name of gachaPool.normal.weapon) {
    assert.ok(!gachaPool['four-weapon'].includes(name), `常驻五星光锥「${name}」不应出现在四星池`)
    assert.ok(!gachaPool['three-weapon'].includes(name), `常驻五星光锥「${name}」不应出现在三星池`)
  }
})

test('全部卡池名字命中 appdata（角色 char2charid，光锥 equipment/equipment2life，防错别字）', () => {
  for (const name of ALL_CHAR_NAMES()) {
    assert.ok(char2charid[name], `卡池角色「${name}」不在 char2charid`)
  }
  for (const name of ALL_WEAPON_NAMES()) {
    assert.ok(equipment[name], `卡池光锥「${name}」不在 equipment`)
    assert.ok(equipment2life[name], `卡池光锥「${name}」不在 equipment2life`)
  }
})

test('卡池不含强化角色（Pro / 2xxx，不可抽取）', () => {
  const names = ALL_CHAR_NAMES()
  for (const name of names) {
    assert.ok(!name.endsWith('Pro'), `卡池出现强化形态角色「${name}」`)
    assert.ok(!ENHANCED_CHAR_NAMES.includes(name), `卡池出现强化形态角色「${name}」`)
    // 2xxx 为强化形态 avatarId 段；可抽取角色的 char2charid 映射不得落在该段
    const id = char2charid[name]
    assert.ok(id && !String(id).startsWith('2'), `卡池角色「${name}」的 id ${id} 落在 2xxx 强化段`)
  }
})

test('UP/联动五星与常驻池、彼此之间不重叠', () => {
  const charFives = [...gachaPool['up-char'].five, ...gachaPool['collab-char'].five]
  const weaponFives = [...gachaPool['up-weapon'].five, ...gachaPool['collab-weapon'].five]
  noDup(charFives, '角色五星（UP+联动）')
  noDup(weaponFives, '光锥五星（UP+联动）')
  for (const name of charFives) {
    assert.ok(!gachaPool.normal.char.includes(name), `「${name}」同时是 UP/联动五星与常驻五星`)
  }
  for (const name of weaponFives) {
    assert.ok(!gachaPool.normal.weapon.includes(name), `「${name}」同时是 UP/联动五星与常驻五星`)
  }
})
