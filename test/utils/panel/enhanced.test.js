/**
 * 强化形态（Pro 形态）检测与重映射 —— utils/panel/enhanced.js
 *
 * 机制（对照 miao-plugin AvocadoApi.updatePlayer 的同名逻辑，独立实现）：
 * 强化形态角色（刃Pro 等 10 名白名单）的 avatarId 仍是原始 ID（1205），
 * 但技能 point_id 带 '1'+avatarId 前缀（11205003，8 位）。
 * 命中后：avatarId → '2'+原ID[1:]（2205）、point_id 前缀重写（2205003）、
 * name 同步为 Pro 命名（与 utils/alias.js 的 Pro 别名键一致）。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  detectAndRemapAvatar,
  enhancedCharIds,
  enhancedCharNames
} from '../../../utils/panel/enhanced.js'

/** 构造一个白名单角色的 avocado 形态条目（behaviorList 用 id 承载 point_id） */
function makeEntry (avatarId, pointIds, extra = {}) {
  return {
    avatarId,
    name: `角色${avatarId}`,
    level: 80,
    rank: 0,
    behaviorList: pointIds.map(id => ({ id, level: 6 })),
    ...extra
  }
}

test('刃 1205：behaviorList 含 11205003 → 重映射为 2205 / 2205003 / 刃Pro', () => {
  const entry = makeEntry(1205, [11205001, 11205002, 11205003, 11205004, 11205007, 11205201])
  const out = detectAndRemapAvatar(entry)
  assert.equal(out.avatarId, 2205, "avatarId 应重映射为 '2'+原ID[1:]")
  assert.equal(out.name, '刃Pro', 'name 应同步为 Pro 命名（alias.js Pro 别名键）')
  assert.deepEqual(
    out.behaviorList.map(s => s.id),
    [2205001, 2205002, 2205003, 2205004, 2205007, 2205201],
    "全部 point_id 的 '1'+原ID 前缀应重写为新 ID 前缀"
  )
  // 未携带前缀的字段保持原样
  assert.equal(out.level, 80)
  assert.equal(out.rank, 0)
  assert.deepEqual(out.behaviorList.map(s => s.level), entry.behaviorList.map(s => s.level))
})

test('mys 原始形态：skills 用 point_id 字段同样命中并重映射', () => {
  const entry = {
    avatarId: 1205,
    skills: [
      { point_id: 11205003, level: 9 },
      { point_id: 11205007, level: 1 }
    ]
  }
  const out = detectAndRemapAvatar(entry)
  assert.equal(out.avatarId, 2205)
  assert.deepEqual(out.skills.map(s => s.point_id), [2205003, 2205007])
})

test('skillTree 列表（id 或 point_id）均参与前缀重写', () => {
  const out = detectAndRemapAvatar({
    avatarId: 1212,
    skillTree: [{ pointId: 11212003 }, { id: 11212101, level: 1 }],
    behaviorList: []
  })
  assert.equal(out.avatarId, 2212)
  assert.equal(out.skillTree[1].id, 2212101)
})

test('白名单 10 名角色全部可重映射且 Pro 命名齐全（防白名单/命名表漂移）', () => {
  assert.equal(enhancedCharIds.length, 10)
  for (const id of enhancedCharIds) {
    const pointId = Number(`1${id}003`) // '1'+avatarId+槽位003，8 位
    const out = detectAndRemapAvatar(makeEntry(id, [pointId]))
    const newId = Number(`2${String(id).slice(1)}`)
    assert.equal(out.avatarId, newId, `${id} 应重映射为 ${newId}`)
    assert.equal(out.name, enhancedCharNames[newId], `${id} 的 Pro 命名应命中命名表`)
    assert.equal(out.behaviorList[0].id, newId * 1000 + 3)
  }
  // 命名表与 miao-plugin Character.enhancedCharIds 对应的 10 名 Pro 命名锚点
  assert.equal(enhancedCharNames[2205], '刃Pro')
  assert.equal(enhancedCharNames[2212], '镜流Pro')
  assert.equal(enhancedCharNames[2310], '流萤Pro')
})

test('白名单外角色（1402 的 1402003）原样返回且为同一引用', () => {
  const entry = makeEntry(1402, [1402001, 1402003])
  const out = detectAndRemapAvatar(entry)
  assert.equal(out, entry, '未命中白名单应原样返回（同一对象）')
  assert.equal(out.avatarId, 1402)
  assert.deepEqual(out.behaviorList.map(s => s.id), [1402001, 1402003])
})

test('相邻 ID 不误判：1104 的 1104003 不受 1004 强化前缀 11004 影响', () => {
  // 1104（杰帕德）不在白名单：即便 point_id 与其他角色的强化前缀形似也不处理
  const adjacent = makeEntry(1104, [1104001, 1104003])
  assert.equal(detectAndRemapAvatar(adjacent), adjacent)

  // 1004（瓦尔特，白名单）的强化前缀是 5 位的 '11004'：
  // '1104003' 仅前 4 位（'1104'）形似，不得误判为强化形态
  const weltNormal = makeEntry(1004, [1004001, 1104003])
  assert.equal(detectAndRemapAvatar(weltNormal), weltNormal, '前缀匹配必须是完整的 1+avatarId')

  // 真正的强化 point_id（'11004'+'003' = 11004003）才触发重映射
  const weltPro = detectAndRemapAvatar(makeEntry(1004, [11004001, 11004003]))
  assert.equal(weltPro.avatarId, 2004)
  assert.deepEqual(weltPro.behaviorList.map(s => s.id), [2004001, 2004003])
  assert.equal(weltPro.name, '瓦尔特Pro')
})

test('无 behaviorList/skillTree/skills 条目：白名单角色也原样返回', () => {
  const entry = { avatarId: 1205, name: '刃', level: 70, rank: 2 }
  const out = detectAndRemapAvatar(entry)
  assert.equal(out, entry)
  // 空数组同样不触发
  const emptyLists = { avatarId: 1205, behaviorList: [], skills: [] }
  assert.equal(detectAndRemapAvatar(emptyLists), emptyLists)
})

test('白名单角色但 point_id 无强化前缀：原样返回（普通形态刃）', () => {
  const entry = makeEntry(1205, [1205001, 1205003])
  const out = detectAndRemapAvatar(entry)
  assert.equal(out, entry, '普通形态不得被重映射')
  assert.equal(out.avatarId, 1205)
})

test('纯函数性：入参对象不被修改，命中时返回深拷贝', () => {
  const input = makeEntry(1205, [11205003], {
    relics: [{ id: 61011, level: 15, sub_affix_id: [{ tag: 'HPDelta', value: 33.87 }] }],
    properties: { hpBase: 1358.28 }
  })
  const snapshot = structuredClone(input)

  const out = detectAndRemapAvatar(input)
  assert.deepEqual(input, snapshot, '入参不应被修改')
  assert.notEqual(out, input, '命中强化形态应返回拷贝而非原对象')
  assert.notEqual(out.behaviorList, input.behaviorList)
  assert.deepEqual(input, snapshot, '转换后入参仍保持原状')

  // 未命中路径也不修改入参（且返回同一引用）
  const plain = makeEntry(1402, [1402003])
  const plainSnapshot = structuredClone(plain)
  detectAndRemapAvatar(plain)
  assert.deepEqual(plain, plainSnapshot)
})

test('空值与缺字段的健壮性', () => {
  assert.equal(detectAndRemapAvatar(null), null)
  assert.equal(detectAndRemapAvatar(undefined), undefined)
  assert.deepEqual(detectAndRemapAvatar({}), {})
  // avatarId 非数字：Number() 为 NaN，不在白名单，原样返回
  const noId = { name: '未知条目', behaviorList: [{ id: 11205003 }] }
  assert.equal(detectAndRemapAvatar(noId), noId)
})
