/**
 * 面板遗器静态表与渲染兜底 —— apps/panel.js fixupRelicMeta + resources/panel/data/relics.json
 *
 * 背景：relics.json 曾长期停在 454 条（止于 3.x 套装），4.x 新套装（set 115-134、317-328）
 * 未收录时转换器把名称降级为「遗器{id}」烙进面板缓存，图标也取不到。
 * 现由 tools/gen-data.js --only=relicdata 从 StarRailRes 索引全量重建（774 条），
 * 渲染端 fixupRelicMeta 对旧缓存条目按新表重解析 name/icon（不回写缓存文件）。
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

const { Panel } = await import('../../apps/panel.js')
const panel = new Panel()

const relicsTable = JSON.parse(fs.readFileSync(
  path.join(sandbox.pluginRoot, 'resources/panel/data/relics.json'), 'utf8'))
const relicIconDir = path.join(sandbox.pluginRoot, 'resources/panel/resources/relic')

// ---------- 静态表结构（对 gen-data relicdata 重建的形状守卫） ----------

test('relics.json：4.x 新套装已收录（修复「遗器63265」缺名缺图的根因）', () => {
  assert.ok(Object.keys(relicsTable).length >= 700, `条目数 ${Object.keys(relicsTable).length} 应 ≥700（StarRailRes 全量）`)
  assert.deepEqual(
    { name: relicsTable['63265']?.name, icon: relicsTable['63265']?.icon, set_id: relicsTable['63265']?.set_id },
    { name: '千星城的传媒总部', icon: '326_0.png', set_id: '326' },
    '用户线上反馈的 63265 应为 千星城的传媒总部（set 326）'
  )
  for (const set of ['115', '134', '325', '328']) {
    assert.ok(
      Object.values(relicsTable).some(r => r.set_id === set),
      `套装 ${set} 应已收录`
    )
  }
})

test('relics.json：条目字段形状完整且 icon 为 basename（本地 relic 目录命名）', () => {
  for (const [id, r] of Object.entries(relicsTable)) {
    assert.deepEqual(
      Object.keys(r).sort(),
      ['icon', 'id', 'main_affix_id', 'max_level', 'name', 'rarity', 'set_id', 'sub_affix_id', 'type'],
      `条目 ${id} 字段形状漂移`
    )
    assert.match(r.icon, /^\d+_\d\.png$/, `条目 ${id} icon 应为 {set}_{pos}.png basename`)
    assert.equal(r.max_level, r.rarity * 3, `条目 ${id} max_level 应为 rarity×3`)
    assert.ok(r.icon.startsWith(`${r.set_id}_`), `条目 ${id} icon 前缀应与 set_id 一致`)
    assert.ok(r.name && !/^遗器\d+$/.test(r.name), `条目 ${id} 不应残留降级名`)
  }
})

test('relics.json：每条 icon 与各套装 set 图标均存在本地资源', () => {
  for (const r of Object.values(relicsTable)) {
    assert.ok(
      fs.existsSync(path.join(relicIconDir, r.icon)),
      `缺遗器图标 ${r.icon}（可运行 node tools/gen-data.js --only=images 补齐）`
    )
  }
  const sets = new Set(Object.values(relicsTable).map(r => r.set_id))
  for (const set of sets) {
    assert.ok(fs.existsSync(path.join(relicIconDir, `${set}.png`)), `缺套装图标 ${set}.png`)
  }
})

// ---------- 渲染兜底（apps/panel.js fixupRelicMeta） ----------

test('fixupRelicMeta：旧缓存「遗器{id}」降级条目按静态表重解析 name + path', () => {
  const relics = [
    // 旧缓存形状：miaoSync/mysConverter 在未收录时期写入的降级条目
    { id: 63265, level: 15, name: '遗器63265', max_level: 15 },
    // 正常名称的旧缓存条目：仅补 path，不改名
    { id: 63135, level: 9, name: '茨冈尼亚的母神卧榻', max_level: 15 },
    // 仍未知的新 ID：保持原样（path 不设置，模板可选链降级）
    { id: 69999, level: 12, name: '遗器69999', max_level: 15 },
    // name 缺失的条目同样修复
    { id: 63255, level: 0 }
  ]
  const out = panel.fixupRelicMeta(relics)
  assert.equal(out, relics, '应就地修补并返回同一数组')
  assert.deepEqual(
    out.map(r => ({ name: r.name, path: r.path })),
    [
      { name: '千星城的传媒总部', path: '326_0.png' },
      { name: '茨冈尼亚的母神卧榻', path: '313_0.png' },
      { name: '遗器69999', path: undefined },
      { name: '朋克洛德的虹霓都市', path: '325_0.png' }
    ]
  )
})

test('fixupRelicMeta：非数组输入与空数组直接返回', () => {
  assert.equal(panel.fixupRelicMeta(undefined), undefined)
  assert.deepEqual(panel.fixupRelicMeta([]), [])
})
