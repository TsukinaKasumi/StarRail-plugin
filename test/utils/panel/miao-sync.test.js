/**
 * miao-plugin 面板数据同步 —— utils/panel/miaoSync.js（+ apps/panel.js 的时间戳同步决策链）
 *
 * 沙箱搭建（miaoSync 的 _path = process.cwd()，必须在 bootFakeRoot 后动态 import）：
 * 1. miao PlayerData 写入 <伪根>/data/PlayerData/sr/{uid}.json（合成 fixture）；
 * 2. miao meta（character/weapon data.json）为 miaoSync 运行时按
 *    {_path}/plugins/miao-plugin/resources/meta-sr 只读扫描 —— 不可注入，
 *    故在伪根沙箱内放置最小合成副本（schema 对照真实 miao meta 校验）；
 * 3. miaoSync 另读本插件 utils/damage/json 的 RelicSetSkill/Equipment 常驻词条表
 *    （bootFakeRoot 只联接 resources/defSet，未联接 utils/，伪根下读不到真实表）——
 *    以合成最小表写入沙箱同路径，数值为可手算整值。
 * 时间戳三态（较新导入/本地较新不导入/文件不存在）经 apps/panel.js getPanelData 的
 * 真实决策链断言（getPanelData → getMiaoProfileTime → importMiaoPlayerData → updateData → saveData）。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import '../../helpers/globals.mjs'
import { register } from 'node:module'
import { bootFakeRoot } from '../../helpers/boot.mjs'

register('../../helpers/hooks.mjs', import.meta.url)

const sandbox = bootFakeRoot()

// ---------- 沙箱搭建 ----------

// (2) miao meta 合成副本（静态游戏元数据 schema，非用户数据）
fs.cpSync(
  new URL('../../fixtures/panel/miao-meta-sr', import.meta.url),
  sandbox.path('plugins', 'miao-plugin', 'resources', 'meta-sr'),
  { recursive: true }
)

// (3) 本插件 damage 常驻词条表（合成最小表；_comment 说明键不写入沙箱）
const dmgJsonDir = sandbox.pluginPath('utils', 'damage', 'json')
fs.mkdirSync(dmgJsonDir, { recursive: true })
const readFixture = (p) => JSON.parse(fs.readFileSync(new URL(`../../fixtures/panel/${p}`, import.meta.url), 'utf-8'))
const stripComment = ({ _comment, ...rest }) => rest
fs.writeFileSync(path.join(dmgJsonDir, 'RelicSetSkill.json'), JSON.stringify(stripComment(readFixture('synth-relicsetskill.json'))))
fs.writeFileSync(path.join(dmgJsonDir, 'Equipment.json'), JSON.stringify(stripComment(readFixture('synth-equipment.json'))))

// (1) miao PlayerData（各测试按场景改写 _profile / 删除文件）
const UID = '100000001' // 合成 UID
const playerFixture = readFixture('miao-player-data.json')
const miaoDir = sandbox.path('data', 'PlayerData', 'sr')
const miaoFile = path.join(miaoDir, `${UID}.json`)
function writeMiaoPlayer (overrides = {}) {
  fs.mkdirSync(miaoDir, { recursive: true })
  fs.writeFileSync(miaoFile, JSON.stringify({ ...playerFixture, ...overrides }))
}

// 被测模块（依赖 chdir 后的 cwd，动态 import）
const miaoSync = await import('../../../utils/panel/miaoSync.js')
const affixData = await import('../../../utils/panel/affixData.js')
const { Panel } = await import('../../../apps/panel.js')

// 期望值计算口径（对照 affixData.starData 快照 = miao artifact meta.json）
const sd5 = affixData.starData['5']
const mainVal = (attr, level) => sd5.main[attr][0] + sd5.main[attr][1] * level
const subVal = (subId, count, steps) => sd5.sub[subId][1] * count + sd5.sub[subId][2] * steps
const pct = (v) => v / 100
const closeTo = (actual, expected, eps = 1e-9) =>
  assert.ok(Math.abs(actual - expected) < eps, `${actual} 应约等于 ${expected}`)

const localPanelFile = sandbox.pluginPath('data', 'panel', `${UID}.json`)
function writeLocalPanel (lastUpdateTime) {
  fs.mkdirSync(path.dirname(localPanelFile), { recursive: true })
  fs.writeFileSync(localPanelFile, JSON.stringify([
    { avatarId: 1220, name: '飞霄', level: 80, rank: 3, lastUpdateTime, relics: [], behaviorList: [] }
  ]))
}

// ---------- getMiaoProfileTime 三态 ----------

test('getMiaoProfileTime：文件不存在 → 0；损坏 JSON → 0；正常 → _profile 时间戳', () => {
  fs.rmSync(miaoFile, { force: true })
  assert.equal(miaoSync.getMiaoProfileTime(UID), 0, '文件不存在应返回 0')

  fs.mkdirSync(miaoDir, { recursive: true })
  fs.writeFileSync(miaoFile, '{bad json')
  assert.equal(miaoSync.getMiaoProfileTime(UID), 0, '解析失败应返回 0')

  writeMiaoPlayer({ _profile: 1700000005000 })
  assert.equal(miaoSync.getMiaoProfileTime(UID), 1700000005000)
})

// ---------- importMiaoPlayerData：读取与降级 ----------

test('importMiaoPlayerData：文件不存在/损坏/无 avatars → null', () => {
  fs.rmSync(miaoFile, { force: true })
  assert.equal(miaoSync.importMiaoPlayerData(UID), null)

  fs.mkdirSync(miaoDir, { recursive: true })
  fs.writeFileSync(miaoFile, '{bad json')
  assert.equal(miaoSync.importMiaoPlayerData(UID), null)

  fs.writeFileSync(miaoFile, JSON.stringify({ _profile: 1700000005000 }))
  assert.equal(miaoSync.importMiaoPlayerData(UID), null, '无 avatars 应返回 null')
})

// ---------- 转换：杰帕德（普通角色，全字段） ----------

test('转换（杰帕德）：基础属性按 attr[promote] 突破表 + 光锥白值精确口径（手算）', () => {
  writeMiaoPlayer()
  const entries = miaoSync.importMiaoPlayerData(UID)
  const gepard = entries.find(e => e.avatarId === 1104)

  assert.equal(gepard.name, '杰帕德')
  assert.equal(gepard.level, 80)
  assert.equal(gepard.rank, 2, 'rank 应取 miao cons')
  assert.equal(gepard.damage_type, 'Ice')

  const p = gepard.properties
  // 手算：角色 attr[6] 800+10×79=1590、350+4.5×79=705.5、460+5×79=855、速度 101
  //      光锥 attr[5] 70 级 1000+10×69=1690、400+5×69=745、200+2×69=338
  assert.equal(p.hpBase, 1590 + 1690, 'hpBase = 角色表 + 光锥表（含光锥白值口径）')
  assert.equal(p.attackBase, 705.5 + 745)
  assert.equal(p.defenseBase, 855 + 338)
  assert.equal(p.speedBase, 101)
})

test('转换（杰帕德）：词条聚合口径 = 遗器主副 + 行迹常驻 + 套装常驻 + 光锥常驻（手算）', () => {
  writeMiaoPlayer()
  const gepard = miaoSync.importMiaoPlayerData(UID).find(e => e.avatarId === 1104)
  const p = gepard.properties
  assert.deepEqual(Object.keys(p).sort(), [
    'hpBase', 'attackBase', 'defenseBase', 'speedBase',
    'hpDelta', 'attackDelta', 'defenseDelta', 'speedAdd',
    'criticalChance', 'criticalDamage', 'statusResistance', 'statusProbability',
    'breakDamageAdded', 'spRatio', 'healRatio',
    'physicalAdded', 'fireAdded', 'iceAdded', 'thunderAdded',
    'windAdded', 'quantumAdded', 'imaginaryAdded'
  ].sort())

  // 遗器（starData 反算）：主 = base+step×level，副 = count×base+steps×step
  const headMainHp = mainVal('hpPlus', 15)
  const headSubHp = subVal('1', 1, 0)
  const headSubSpeed = subVal('7', 2, 0) // 速度副词条 = 2×2 = 4
  const handMainAtk = mainVal('atkPlus', 15)
  const handSubCpct = pct(subVal('8', 2, 0))
  const bodyMainCpct = pct(mainVal('cpct', 15)) // +15 暴击率主词条 = 32.4% → 0.324
  const bodySubCdmg = pct(subVal('9', 1, 2)) // 副词条 id 9 = 暴击伤害
  const feetMainSpeed = mainVal('speed', 15) // 4.032+1.4×15 = 25.032
  const sphereMainIce = pct(mainVal('ice', 15))
  const sphereSubEffDef = pct(subVal('11', 2, 0))
  const ropeMainRecharge = pct(mainVal('recharge', 12))
  const ropeSubAtk = subVal('2', 2, 0)

  // 行迹常驻（合成 meta tree）：def10% + hp8% + cpct4% + atkPct4%（joy 跳过、speed 节点未激活不计）
  // 套装常驻（合成表）：101 四件套 HP+12%、301 两件套 ATK+8%
  // 光锥常驻（合成表）：23013 叠影3 暴伤+28%
  const hpRatio = 0.08 + 0.12
  const atkRatio = 0.04 + 0.08
  closeTo(bodyMainCpct, 0.324)
  closeTo(headSubSpeed, 4)
  closeTo(feetMainSpeed, 25.032)

  closeTo(p.hpDelta, headMainHp + headSubHp + (1590 + 1690) * hpRatio, 1e-8)
  closeTo(p.attackDelta, handMainAtk + ropeSubAtk + (705.5 + 745) * atkRatio, 1e-8)
  closeTo(p.defenseDelta, (855 + 338) * 0.10, 1e-8)
  closeTo(p.speedAdd, headSubSpeed + feetMainSpeed)
  closeTo(p.criticalChance, 0.05 + handSubCpct + bodyMainCpct + 0.04, 1e-8)
  closeTo(p.criticalDamage, 0.5 + bodySubCdmg + 0.28, 1e-8)
  closeTo(p.statusResistance, sphereSubEffDef)
  closeTo(p.spRatio, ropeMainRecharge)
  closeTo(p.iceAdded, sphereMainIce)
  // 无来源的键全部为 0
  for (const k of ['statusProbability', 'breakDamageAdded', 'healRatio', 'physicalAdded', 'fireAdded',
    'thunderAdded', 'windAdded', 'quantumAdded', 'imaginaryAdded']) {
    assert.equal(p[k], 0, `${k} 应为 0`)
  }
})

test('转换（杰帕德）：遗器主词条 mainIdx 反查 + 副词条 attrIds 重建 + equipment 取 miao 光锥表', () => {
  writeMiaoPlayer()
  const gepard = miaoSync.importMiaoPlayerData(UID).find(e => e.avatarId === 1104)

  const [head, hand, body, feet, sphere, rope] = gepard.relics
  assert.deepEqual(
    [head.id, head.level, head.name, head.max_level],
    [61011, 15, '过客的逢春木簪', 15],
    '遗器静态字段来自本插件 relics.json'
  )
  // pos1 mainId 1 → hpPlus；副词条 "7,2,0"/"1,1,0" → 速度 4.0 / 生命 33.87004
  assert.equal(head.main_affix_tag, 'HPDelta')
  assert.equal(head.main_affix_name, '生命值')
  closeTo(head.main_affix_value, mainVal('hpPlus', 15))
  assert.deepEqual(head.sub_affix_id, [
    { tag: 'SpeedDelta', name: '速度', value: subVal('7', 2, 0), cnt: 2 },
    { tag: 'HPDelta', name: '生命值', value: subVal('1', 1, 0), cnt: 1 }
  ])

  // pos3 mainId 4 → cpct（+15 = 0.324 手算锚点）
  assert.equal(body.main_affix_tag, 'CriticalChanceBase')
  closeTo(body.main_affix_value, 0.324)
  assert.deepEqual(body.sub_affix_id, [
    { tag: 'CriticalDamageBase', name: '暴击伤害', value: pct(subVal('9', 1, 2)), cnt: 1 }
  ])

  assert.equal(hand.main_affix_tag, 'AttackDelta')
  closeTo(hand.main_affix_value, mainVal('atkPlus', 15))
  assert.deepEqual(hand.sub_affix_id, [
    { tag: 'CriticalChanceBase', name: '暴击率', value: pct(subVal('8', 2, 0)), cnt: 2 }
  ])

  assert.equal(feet.main_affix_tag, 'SpeedDelta')
  closeTo(feet.main_affix_value, mainVal('speed', 15))
  assert.deepEqual(feet.sub_affix_id, [])

  assert.equal(sphere.main_affix_tag, 'IceAddedRatio')
  closeTo(sphere.main_affix_value, pct(mainVal('ice', 15)))
  assert.deepEqual(sphere.sub_affix_id, [
    { tag: 'StatusResistanceBase', name: '效果抵抗', value: pct(subVal('11', 2, 0)), cnt: 2 }
  ])

  assert.equal(rope.level, 12)
  assert.equal(rope.main_affix_tag, 'SPRatioBase')
  closeTo(rope.main_affix_value, pct(mainVal('recharge', 12)))
  assert.deepEqual(rope.sub_affix_id, [
    { tag: 'AttackDelta', name: '攻击力', value: subVal('2', 2, 0), cnt: 2 }
  ])

  // 光锥：名称/星级/白值均取自 miao 光锥 meta（70 级 5 突破）
  assert.deepEqual(gepard.equipment, {
    id: 23013, level: 70, rank: 3, promotion: 5,
    name: '合成巡猎光锥', rarity: 'CombatLightConeRarity5',
    hp: 1690, atk: 745, def: 338
  })
  assert.deepEqual(gepard.relic_sets, [
    { set_id: '101', set_name: '4件套' },
    { set_id: '301', set_name: '2件套' }
  ])
})

test('转换（杰帕德）：behaviorList = talent 槽位 + 已激活行迹（miao trees 只存已激活节点）', () => {
  writeMiaoPlayer()
  const gepard = miaoSync.importMiaoPlayerData(UID).find(e => e.avatarId === 1104)
  const bl = gepard.behaviorList
  assert.equal(bl.length, 10, '5 主技能 + 5 已激活行迹')
  assert.deepEqual(bl.slice(0, 5), [
    { id: 1104001, level: 6, type: '普攻', anchor: 'Point01', icon: 'icon/skill/1104_basic_atk.png', max_level: 6 },
    { id: 1104002, level: 10, type: '战技', anchor: 'Point02', icon: 'icon/skill/1104_skill.png', max_level: 10 },
    { id: 1104003, level: 10, type: '终结技', anchor: 'Point03', icon: 'icon/skill/1104_ultimate.png', max_level: 10 },
    { id: 1104004, level: 10, type: '天赋', anchor: 'Point04', icon: 'icon/skill/1104_talent.png', max_level: 10 },
    { id: 1104007, level: 1, type: '秘技', anchor: 'Point05', icon: 'icon/skill/1104_technique.png', max_level: 1 }
  ])
  // talent 缺失技能按 1 级占位；行迹节点全部 level=1（miao 口径：只存已激活），
  // 属性小节点(201-210)查 skillTreeStats 属性表补图标
  assert.deepEqual(bl.slice(5), [
    { id: 1104101, level: 1, type: '行迹', anchor: 'Point06', icon: 'icon/skill/1104_skilltree1.png', max_level: 1 },
    { id: 1104201, level: 1, type: '行迹', anchor: 'Point09', icon: 'icon/skill/tree-ice.webp', max_level: 1 },
    { id: 1104202, level: 1, type: '行迹', anchor: 'Point10', icon: 'icon/skill/tree-effDef.webp', max_level: 1 },
    { id: 1104204, level: 1, type: '行迹', anchor: 'Point12', icon: 'icon/skill/tree-def.webp', max_level: 1 },
    { id: 1104205, level: 1, type: '行迹', anchor: 'Point13', icon: 'icon/skill/tree-ice.webp', max_level: 1 }
  ])
})

// ---------- 转换：火花（欢愉 xe）与阿格莱雅（记忆 me/mt） ----------

test('转换（火花）：xe talent → 420 欢愉槽位；光锥 meta 缺失降级', () => {
  writeMiaoPlayer()
  const sparkle = miaoSync.importMiaoPlayerData(UID).find(e => e.avatarId === 1501)
  assert.equal(sparkle.damage_type, 'Fire')
  // 手算：750+7.5×79=1342.5、500+5×79=895、310+3.1×79=554.9
  closeTo(sparkle.properties.hpBase, 1342.5)
  closeTo(sparkle.properties.attackBase, 895)
  closeTo(sparkle.properties.defenseBase, 554.9)
  assert.equal(sparkle.properties.speedBase, 102)
  assert.equal(sparkle.properties.criticalChance, 0.05, '基础暴击率 5%')
  assert.equal(sparkle.properties.criticalDamage, 0.5, '基础暴伤 50%')
  // 光锥 21005 无 miao meta：白值 0、命名降级、稀有度按 ID 推导（21xxx → 4 星）
  assert.deepEqual(sparkle.equipment, {
    id: 21005, level: 60, rank: 1, promotion: 0,
    name: '光锥21005', rarity: 'CombatLightConeRarity4',
    hp: 0, atk: 0, def: 0
  })
  assert.deepEqual(sparkle.relics, [])
  assert.deepEqual(sparkle.relic_sets, [])
  const bl = sparkle.behaviorList
  assert.equal(bl.length, 6, '5 主技能 + 欢愉技')
  assert.deepEqual(bl.slice(0, 5).map(s => [s.id, s.level, s.type]), [
    [1501001, 1, '普攻'], [1501002, 9, '战技'], [1501003, 9, '终结技'],
    [1501004, 9, '天赋'], [1501007, 1, '秘技']
  ])
  assert.deepEqual(bl[5], {
    id: 1501 * 1000 + 420, level: 12, type: '欢愉技', anchor: 'Point19',
    icon: 'icon/skill/1501_elation.png', max_level: 10
  })
})

test('转换（阿格莱雅）：me/mt talent → 301/302 忆灵槽位；缺 promote 按等级推导；行迹 atk 常驻', () => {
  writeMiaoPlayer()
  const aglaea = miaoSync.importMiaoPlayerData(UID).find(e => e.avatarId === 1402)
  assert.equal(aglaea.damage_type, 'Thunder')
  assert.equal(aglaea.rank, 1)
  // 缺 promote → calcPromote(70)=5：角色 700+7×69=1183、480+4.8×69=811.2、300+3×69=507、速度 104
  // 光锥 23013（70 级 5 突破）：1690/745/338
  closeTo(aglaea.properties.hpBase, 1183 + 1690)
  closeTo(aglaea.properties.attackBase, 811.2 + 745)
  closeTo(aglaea.properties.defenseBase, 507 + 338)
  assert.equal(aglaea.properties.speedBase, 104)
  // 行迹 1402201 atk 5% → attackDelta = attackBase×0.05；速度副词条 2.0；武器叠影1 暴伤+20%
  closeTo(aglaea.properties.attackDelta, (811.2 + 745) * 0.05, 1e-8)
  closeTo(aglaea.properties.speedAdd, subVal('7', 1, 0))
  closeTo(aglaea.properties.criticalChance, 0.05 + pct(mainVal('cpct', 15)), 1e-9)
  closeTo(aglaea.properties.criticalDamage, 0.5 + 0.2)

  const bl = aglaea.behaviorList
  assert.equal(bl.length, 8, '5 主技能 + 忆灵技/忆灵天赋 + 1 行迹')
  assert.deepEqual(bl.slice(0, 5).map(s => [s.id, s.level, s.type]), [
    [1402001, 1, '普攻'], [1402002, 6, '战技'], [1402003, 10, '终结技'],
    [1402004, 6, '天赋'], [1402007, 1, '秘技']
  ])
  assert.deepEqual(bl[5], {
    id: 1402 * 1000 + 301, level: 10, type: '忆灵技', anchor: 'Point19',
    icon: 'icon/skill/1402_memosprite_skill.png', max_level: 6
  })
  assert.deepEqual(bl[6], {
    id: 1402 * 1000 + 302, level: 10, type: '忆灵天赋', anchor: 'Point20',
    icon: 'icon/skill/1402_memosprite_talent.png', max_level: 6
  })
  assert.deepEqual(bl[7], {
    id: 1402201, level: 1, type: '行迹', anchor: 'Point09', icon: 'icon/skill/tree-elec.webp', max_level: 1
  })
})

test('转换：miao meta 缺失的角色被跳过（飞霄 1220），不中断整包导入', () => {
  writeMiaoPlayer()
  const entries = miaoSync.importMiaoPlayerData(UID)
  // avatars 为整数键对象：Object.values 按数值升序迭代（1104 < 1402 < 1501）
  assert.deepEqual(entries.map(e => e.avatarId), [1104, 1402, 1501], '无 meta 的 1220 应被跳过')
})

// ---------- 只读保证 ----------

test('只读保证：导入不回写 miao 数据文件（mtime 与目录内容不变）', () => {
  writeMiaoPlayer()
  const before = fs.statSync(miaoFile).mtimeMs
  const entries = miaoSync.importMiaoPlayerData(UID)
  assert.ok(entries.length === 3)
  assert.equal(fs.statSync(miaoFile).mtimeMs, before, 'miao 数据文件 mtime 不应变化')
  assert.deepEqual(fs.readdirSync(miaoDir), [`${UID}.json`], 'PlayerData 目录不应新增文件')
})

// ---------- 时间戳同步决策链（apps/panel.js getPanelData） ----------

test('时间戳同步：miao _profile 较新 → 整包导入合并并落盘（is_new/lastUpdateTime=miaoTime）', async () => {
  writeMiaoPlayer() // _profile = 1700000005000
  writeLocalPanel(1700000000000) // 本地缓存较旧
  const panel = new Panel()
  const data = await panel.getPanelData(UID)

  assert.deepEqual(data.map(d => d.avatarId), [1104, 1402, 1501, 1220], '导入条目置前（avatars 整数键升序），旧缓存保留')
  for (const d of data.slice(0, 3)) {
    assert.equal(d.is_new, true)
    assert.equal(d.lastUpdateTime, 1700000005000, 'lastUpdateTime 应取 miao _profile')
  }
  assert.equal(data[3].is_new, false, '旧条目应清除 is_new')
  assert.equal(data[3].lastUpdateTime, 1700000000000)
  // 导入条目为转换产物（与 importMiaoPlayerData 同口径）
  assert.equal(data[0].properties.hpBase, 3280)

  // 落盘内容与返回一致
  const saved = JSON.parse(fs.readFileSync(localPanelFile, 'utf-8'))
  assert.deepEqual(saved.map(d => d.avatarId), [1104, 1402, 1501, 1220])
  assert.equal(saved[0].lastUpdateTime, 1700000005000)
})

test('时间戳同步：本地缓存较新 → 不导入，返回本地缓存且不落盘', async () => {
  writeMiaoPlayer() // _profile = 1700000005000
  writeLocalPanel(1700000009000) // 本地较新
  const before = fs.readFileSync(localPanelFile, 'utf-8')

  const panel = new Panel()
  const data = await panel.getPanelData(UID)
  assert.deepEqual(data.map(d => d.avatarId), [1220], '本地较新时不应导入 miao 数据')
  assert.equal(fs.readFileSync(localPanelFile, 'utf-8'), before, '未导入时不应写缓存文件')
})

test('时间戳同步：miao 数据文件不存在 → getMiaoProfileTime=0，走本地缓存', async () => {
  fs.rmSync(miaoFile, { force: true })
  writeLocalPanel(1700000000000)
  const panel = new Panel()
  const data = await panel.getPanelData(UID)
  assert.deepEqual(data.map(d => d.avatarId), [1220])
  assert.equal(data[0].is_new, undefined, '不经 updateData 的本地条目保持原状')
})

// ---------- 第三方拉取失败时的 miao 兜底（fetch 分支回退） ----------

test('兜底：空缓存 + 第三方拉取失败 + miao 有数据 → 自动导入返回（boot 首次数入路径）', async () => {
  fs.rmSync(localPanelFile, { force: true }) // 清掉前序测试留下的本地缓存，验证真正的空缓存路径
  writeMiaoPlayer() // _profile = 1700000005000
  const { setFallback, resetFetchMock } = await import('../../helpers/fetch-mock.mjs')
  setFallback(() => { throw new Error('面板服务连接超时（模拟）') })
  const panel = new Panel()
  panel.e = { reply: async () => {} } // 拉取分支的"正在获取"提示桩
  const data = await panel.getPanelData(UID, true) // isForce 走拉取分支
  resetFetchMock()
  assert.deepEqual(data.map(d => d.avatarId), [1104, 1402, 1501], '应导入 miao 数据')
  assert.equal(data[0].lastUpdateTime, 1700000005000)
  // 兜底后频控不应被占用（失败查询不写 60s 冷却）
  assert.equal(await globalThis.redis.get('STAR_RAILWAY:userPanelDataTime:' + UID), null)
})

test('兜底：本地缓存较旧（miao 更新）时兜底导入并与本地合并', async () => {
  writeMiaoPlayer() // 1700000005000
  writeLocalPanel(1700000000000) // 本地较旧
  const { setFallback, resetFetchMock } = await import('../../helpers/fetch-mock.mjs')
  setFallback(() => { throw new Error('面板服务连接超时（模拟）') })
  const panel = new Panel()
  panel.e = { reply: async () => {} }
  const data = await panel.getPanelData(UID, true)
  resetFetchMock()
  assert.deepEqual(data.map(d => d.avatarId), [1104, 1402, 1501, 1220], '导入条目与本地缓存合并')
})

test('兜底：miao 不比本地新 → 不兜底，如实抛出第三方错误', async () => {
  writeMiaoPlayer() // 1700000005000
  writeLocalPanel(1700000009000) // 本地较新
  const { setFallback, resetFetchMock } = await import('../../helpers/fetch-mock.mjs')
  setFallback(() => { throw new Error('面板服务连接超时（模拟）') })
  const panel = new Panel()
  panel.e = { reply: async () => {} }
  await assert.rejects(() => panel.getPanelData(UID, true), /连接超时|超时/)
  resetFetchMock()
})

test('兜底：无 miao 数据 → 维持原报错', async () => {
  fs.rmSync(miaoFile, { force: true })
  const { setFallback, resetFetchMock } = await import('../../helpers/fetch-mock.mjs')
  setFallback(() => { throw new Error('面板服务连接超时（模拟）') })
  const panel = new Panel()
  panel.e = { reply: async () => {} }
  await assert.rejects(() => panel.getPanelData(UID, true), /连接超时|超时/)
  resetFetchMock()
})
