/**
 * 行迹画布渲染链 —— apps/panel.js skillTreeImg/handleSkillTree + skillTree.json 坐标完备性
 *
 * 坐标换算契约（由既有 7 命途逆向验证固化，防 SVG 与坐标单方改动导致节点错位）：
 *   - 行迹画布 canvas 尺寸 = SVG intrinsic 尺寸 × 2（new_panel.html draw()）
 *   - skillTree.json 坐标 = 2x 画布空间中节点图标框的左上角
 *   - 图标框边长：Point01-05 主技能 138 / Point06-08 能力节点 144 / Point09-18 属性小节点 102
 *   - 即 SVG 锚点圆心 = ((canvasX + W/2) / 2, (canvasY + W/2) / 2)，
 *     每个坐标都应命中 SVG 内同位置的锚点圆（r≈34.5 / 36 / 25.5，容差 4px——
 *     存量 Knight 命途存在约 3px 的历史手测偏差，属可接受视觉误差）
 *
 * 记忆/欢愉（4.x 新命途）：背景为本插件自建（Memory.svg / Joy.svg，风格对齐既有 7 命途），
 * 布局按 BWiki 行迹页实测形态重排（欢愉 19 锚点含欢愉技 Point19；记忆 20 锚点含忆灵技
 * Point19/忆灵天赋 Point20），坐标与 SVG 锚点由 temp/gen-skilltree-svg.mjs 成对生成，
 * 本文件验证成对一致性。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import '../helpers/globals.mjs'
import { register } from 'node:module'
import { bootFakeRoot } from '../helpers/boot.mjs'

register('../helpers/hooks.mjs', import.meta.url)

const sandbox = bootFakeRoot()

const { Panel, skillTreeImg } = await import('../../apps/panel.js')
const panel = new Panel()

const treeDir = path.join(sandbox.pluginRoot, 'resources/panel/resources/skill_tree')
const skillDir = path.join(sandbox.pluginRoot, 'resources/panel/resources/skill')
const tree = JSON.parse(fs.readFileSync(
  path.join(sandbox.pluginRoot, 'resources/panel/data/skillTree.json'), 'utf8'))
const charTable = JSON.parse(fs.readFileSync(
  path.join(sandbox.pluginRoot, 'resources/panel/data/character.json'), 'utf8'))

/** 节点图标框边长（canvas 空间，new_panel.html type1/2/3 绘制尺寸） */
const anchorWidth = (anchor) =>
  /^(Point0[1-5]|Point19|Point20)$/.test(anchor) ? 138 : /^Point0[6-8]$/.test(anchor) ? 144 : 102

/** 锚点圆半径容差窗（r≈34.5/34 双圆主技能插座、r≈36 能力节点、r≈25.5 属性小节点） */
const anchorRadiusWindow = (anchor) =>
  /^(Point0[1-5]|Point19|Point20)$/.test(anchor) ? [32, 36] : /^Point0[6-8]$/.test(anchor) ? [34, 38] : [23, 27]

/** 提取 SVG 全部 circle/ellipse 的最终圆心与半径（解析 matrix/translate 变换） */
function extractAnchorShapes (svg) {
  const out = []
  const re = /<(circle|ellipse)[^>]*>/g
  let m
  while ((m = re.exec(svg))) {
    const tag = m[0]
    const cx = parseFloat(tag.match(/cx="([-\d.]+)"/)?.[1])
    const cy = parseFloat(tag.match(/cy="([-\d.]+)"/)?.[1])
    const r = parseFloat(tag.match(/[^r]r="([-\d.]+)"/)?.[1])
    const rx = parseFloat(tag.match(/rx="([-\d.]+)"/)?.[1])
    let x = cx
    let y = cy
    const tr = tag.match(/transform="([^"]+)"/)?.[1]
    if (tr) {
      const mm = tr.match(/matrix\(([-\d.eE]+) ([-\d.eE]+) ([-\d.eE]+) ([-\d.eE]+) ([-\d.eE]+) ([-\d.eE]+)\)/)
      if (mm) {
        const [a, b, c, d, e, f] = mm.slice(1).map(Number)
        x = a * cx + c * cy + e
        y = b * cx + d * cy + f
      } else {
        const tt = tr.match(/translate\(([-\d.]+)[ ,]+([-\d.]+)\)/)
        if (tt) { x += +tt[1]; y += +tt[2] }
      }
    }
    if (Number.isFinite(x) && Number.isFinite(y)) {
      out.push({ x, y, r: Number.isFinite(r) ? r : rx })
    }
  }
  return out
}

// ---------- 背景映射与坐标换算（全部命途，含存量 7 命途） ----------

test('skillTreeImg：覆盖 skillTree.json 全部命途且背景文件存在', () => {
  for (const charpath of Object.keys(tree)) {
    const bg = skillTreeImg[charpath]
    assert.ok(bg, `命途 ${charpath} 缺行迹背景映射（apps/panel.js skillTreeImg）`)
    assert.match(bg, /^panel\/resources\/skill_tree\/\w+\.svg$/)
    const file = path.join(sandbox.pluginRoot, 'resources', bg)
    assert.ok(fs.existsSync(file), `背景文件不存在：${bg}`)
  }
  // 反向：映射表不得引用无坐标数据的背景（坐标与背景必须成对出现）
  for (const charpath of Object.keys(skillTreeImg)) {
    assert.ok(tree[charpath], `skillTreeImg 映射了 ${charpath} 但 skillTree.json 无坐标`)
  }
})

test('坐标换算固化断言：每命途锚点数（18/欢愉19/记忆20）均命中 SVG 锚点圆（换算关系防漂移）', () => {
  const expectedCount = { 欢愉: 19, 记忆: 20 }
  for (const [charpath, points] of Object.entries(tree)) {
    const file = path.join(treeDir, path.basename(skillTreeImg[charpath]))
    const svg = fs.readFileSync(file, 'utf8')
    const svgW = parseFloat(svg.match(/width="(\d+)"/)[1])
    const svgH = parseFloat(svg.match(/height="(\d+)"/)[1])
    assert.equal(Object.keys(points).length, expectedCount[charpath] ?? 18,
      `${charpath} 应有 ${expectedCount[charpath] ?? 18} 个锚点坐标`)
    const shapes = extractAnchorShapes(svg)
    for (const [anchor, pos] of Object.entries(points)) {
      const w = anchorWidth(anchor)
      const cx = (pos[0] + w / 2) / 2
      const cy = (pos[1] + w / 2) / 2
      const [rLo, rHi] = anchorRadiusWindow(anchor)
      const hit = shapes.some(s =>
        Math.abs(s.x - cx) <= 4 && Math.abs(s.y - cy) <= 4 && s.r >= rLo && s.r <= rHi)
      assert.ok(hit, `${charpath} ${anchor} 坐标 (${pos}) 未命中 SVG 锚点圆（圆心应为 (${cx}, ${cy})，r 应在 ${rLo}-${rHi}）`)
      assert.ok(cx >= -1 && cy >= -1 && cx <= svgW + 1 && cy <= svgH + 1,
        `${charpath} ${anchor} 锚点圆心 (${cx}, ${cy}) 超出 SVG ${svgW}x${svgH} 画布`)
    }
  }
})

// ---------- 记忆/欢愉渲染链（handleSkillTree + 图标资产） ----------

/**
 * 合成面板缓存形态的 behaviorList（与 miaoSync/mysConverter 产出同构）：
 * 5 主技能（Point01-05 游戏图标路径）+ 3 能力节点（skilltree1-3）+ 10 属性小节点
 * （icon 空串——游戏数据对属性小节点无独立图标）+ 新命途扩展技能位（anchor null，
 * 模拟锚点映射加入前的旧缓存——handleSkillTree 按 pointId 末三位兜底解析）。
 */
function synthBehaviorList (avatarId, extraSlots = []) {
  const mains = {
    Point01: ['001', 'basic_atk', 6],
    Point02: ['002', 'skill', 10],
    Point03: ['003', 'ultimate', 10],
    Point04: ['004', 'talent', 10],
    Point05: ['007', 'technique', 1]
  }
  const list = Object.entries(mains).map(([anchor, [slot, name, max]]) => ({
    id: avatarId * 1000 + Number(slot),
    level: anchor === 'Point05' ? 1 : max,
    type: '技能',
    anchor,
    icon: `icon/skill/${avatarId}_${name}.png`,
    max_level: max
  }))
  const abilities = { Point06: '101', Point07: '102', Point08: '103' }
  for (const [anchor, slot] of Object.entries(abilities)) {
    list.push({
      id: avatarId * 1000 + Number(slot),
      level: 1,
      type: '行迹',
      anchor,
      icon: `icon/skill/${avatarId}_skilltree${Number(slot) - 100}.png`,
      max_level: 1
    })
  }
  for (let i = 0; i < 10; i++) {
    list.push({
      id: avatarId * 1000 + 201 + i,
      level: i % 2,
      type: '行迹',
      anchor: `Point${String(9 + i).padStart(2, '0')}`,
      icon: '',
      max_level: 1
    })
  }
  for (const slot of extraSlots) {
    list.push({
      id: avatarId * 1000 + slot,
      level: 1,
      type: '扩展技能',
      anchor: null,
      icon: '',
      max_level: 1
    })
  }
  return list
}

const NEW_PATH_CASES = [
  { charpath: '记忆', avatarId: 1402, extraSlots: [301, 302] }, // 阿格莱雅：忆灵技/忆灵天赋
  { charpath: '欢愉', avatarId: 8010, extraSlots: [420] } // 星·欢愉：欢愉技
]

for (const { charpath, avatarId, extraSlots } of NEW_PATH_CASES) {
  test(`渲染链（${charpath}/${avatarId}）：${18 + extraSlots.length} 坐标齐全（含扩展位）、节点图标本地存在`, () => {
    const behaviorList = synthBehaviorList(avatarId, extraSlots)
    const skillTree = panel.handleSkillTree(behaviorList, charpath, avatarId)
    assert.equal(skillTree.length, behaviorList.length)

    // 18 基础锚点 + 扩展位（301/302→Point19/20、420→Point19）全部解析到坐标
    const anchored = skillTree.filter(s => s.anchor)
    assert.equal(anchored.length, 18 + extraSlots.length)
    for (const s of anchored) {
      assert.ok(Array.isArray(s.position) && s.position.length === 2,
        `${charpath} ${s.anchor} 应有坐标（此前降级为 null）`)
      assert.ok(s.position.every(n => Number.isFinite(n)), `${charpath} ${s.anchor} 坐标应为数值`)
    }
    // 扩展技能位（忆灵/欢愉技能）：旧缓存 anchor null 兜底为 Point19/Point20，
    // 空图标规范到 extraSlotIcon 命名，画布按主技能尺寸（138px）绘制
    const extraAnchorBySlot = { 301: 'Point19', 302: 'Point20', 420: 'Point19', 421: 'Point19' }
    const extraMaxBySlot = { 301: 6, 302: 6, 420: 10, 421: 10 }
    for (const slot of extraSlots) {
      const extra = skillTree.find(s => s.id === avatarId * 1000 + slot)
      assert.ok(extra, `扩展位 ${slot} 应保留在列表`)
      assert.equal(extra.anchor, extraAnchorBySlot[slot], `扩展位 ${slot} anchor 应兜底为 ${extraAnchorBySlot[slot]}`)
      assert.ok(Array.isArray(extra.position), `扩展位 ${slot} 应有行迹画布坐标`)
      assert.match(extra.icon, new RegExp(`^icon/skill/${avatarId}_(elation|memosprite_(skill|talent))\\.png$`),
        `扩展位 ${slot} 图标应规范到 extraSlotIcon 命名（实际 ${extra.icon}）`)
      assert.equal(extra.max_level, extraMaxBySlot[slot], `扩展位 ${slot} 满级应规范（欢愉技 10 / 忆灵 6）`)
    }
    // 节点图标（含属性小节点按 skillTreeStats 补的属性图标）本地资源存在 —— 模板已本地化不再走 avocado CDN
    for (const s of anchored.filter(n => n.icon)) {
      const file = path.join(skillDir, s.icon.split('/').pop())
      assert.ok(fs.existsSync(file), `${charpath} ${s.anchor} 图标缺失：${s.icon}`)
    }
    // 画布尺寸契约：canvas = SVG intrinsic × 2，坐标在该 2x 空间内
    const svg = fs.readFileSync(path.join(treeDir, path.basename(skillTreeImg[charpath])), 'utf8')
    const svgW = parseFloat(svg.match(/width="(\d+)"/)[1])
    const svgH = parseFloat(svg.match(/height="(\d+)"/)[1])
    for (const s of anchored) {
      const [x, y] = s.position
      const w = anchorWidth(s.anchor)
      assert.ok(x >= -w && y >= -w && x <= svgW * 2 && y <= svgH * 2,
        `${charpath} ${s.anchor} 坐标超出 2x 画布空间`)
    }
  })
}

test('未知命途（未来新命途）：handleSkillTree 降级返回无坐标列表（守卫保留）', () => {
  const behaviorList = synthBehaviorList(9999)
  const out = panel.handleSkillTree(behaviorList, '未知命途')
  assert.equal(out.length, behaviorList.length)
  assert.ok(out.every(s => s.position === null), '未知命途全部 position:null，模板跳过行迹渲染')
  assert.equal(skillTreeImg['未知命途'], undefined, '未知命途无背景映射')
})

// ---------- 行迹图标资产完备性 ----------

test('行迹画布图标：character.json 全角色 skilltree1-3 均有本地资源（含强化形态占位）', () => {
  for (const id of Object.keys(charTable)) {
    for (let n = 1; n <= 3; n++) {
      assert.ok(
        fs.existsSync(path.join(skillDir, `${id}_skilltree${n}.png`)),
        `缺 ${id}_skilltree${n}.png（可运行 node tools/gen-data.js --only=images 补齐）`
      )
    }
  }
})
