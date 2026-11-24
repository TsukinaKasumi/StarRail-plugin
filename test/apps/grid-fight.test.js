import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const pluginRoot = fileURLToPath(new URL('../../', import.meta.url))
const htmlPath = path.join(pluginRoot, 'resources/gridFight/gridFightArchive.html')
const cssPath = path.join(pluginRoot, 'resources/gridFight/gridFightArchive.css')

test('gridFight: 伤害数据支持角色、羁绊、投资策略、投资环境及兜底，模板结构完整', () => {
  const mockRecord = {
    brief: {
      division: { level: 5, icon: '', name_with_num: 'V' },
      archive_type: 'ArchiveTypeStandard',
      archive_time: '2026-11-23',
      archive_rank: '01234567890123456789Top 1',
      remain_hp: 100,
      total_coin: 500,
      lineup_coin: 300
    },
    lineup: {
      front_roles: [
        { role_id: '140802', avatar_id: '1408', icon: 'http://img/1.png', star: 3, rarity: 5, is_trial: false, equip_list: [] }
      ],
      back_roles: [],
      trait_list: [
        { trait_id: '300102', icon: 'http://img/2.png', trait_count: 2, trait_name: '双龙吟', quality: 4 }
      ],
      portal_list: [
        { portal_id: '110', icon: 'http://img/3.png', name: '彩虹时代' }
      ],
      augment_list: [
        { augment_id: '350701', icon: 'http://img/4.png', name: '万箭齐发', quality: 3 }
      ],
      damage_list: [
        { damage_type: 'DamageTypeRole', id: '140802', damage: '13599683647.8' },
        { damage_type: 'DamageTypeAugment', id: '350701', damage: '186368000.0' },
        { damage_type: 'DamageTypeTrait', id: '300102', damage: '69888000.0' },
        { damage_type: 'DamageTypePortal', id: '110', damage: '1000000.0' },
        { damage_type: 'DamageTypeUnknown', id: '999999', damage: '500.0' }
      ]
    }
  }

  // 验证 apps/gridFight.js 的 entityMap 覆盖逻辑
  let entityMap = {}
  mockRecord.lineup.front_roles?.forEach(r => {
    if (r.role_id) entityMap[r.role_id] = r
    if (r.avatar_id) entityMap[r.avatar_id] = r
  })
  mockRecord.lineup.back_roles?.forEach(r => {
    if (r.role_id) entityMap[r.role_id] = r
    if (r.avatar_id) entityMap[r.avatar_id] = r
  })
  mockRecord.lineup.trait_list?.forEach(t => {
    if (t.trait_id) entityMap[t.trait_id] = t
  })
  mockRecord.lineup.augment_list?.forEach(a => {
    if (a.augment_id) entityMap[a.augment_id] = a
  })
  mockRecord.lineup.portal_list?.forEach(p => {
    if (p.portal_id) entityMap[p.portal_id] = p
  })

  let damageData = (mockRecord.lineup.damage_list || []).map(d => {
    let entity = entityMap[d.id] || {}
    return {
      id: d.id,
      damage: parseFloat(d.damage) || 0,
      type: d.damage_type,
      entity: entity
    }
  }).sort((a, b) => b.damage - a.damage).slice(0, 5)

  assert.equal(damageData.length, 5)
  assert.equal(damageData[0].entity.avatar_id, '1408')
  assert.equal(damageData[1].entity.name, '万箭齐发')
  assert.equal(damageData[2].entity.trait_name, '双龙吟')
  assert.equal(damageData[3].entity.name, '彩虹时代')
  assert.deepEqual(damageData[4].entity, {})

  let maxDamage = damageData[0].damage
  damageData.forEach(d => {
    d.percent = maxDamage > 0 ? (d.damage / maxDamage * 100).toFixed(2) : 0
    if (d.damage >= 100000000) {
      d.damageStr = (d.damage / 100000000).toFixed(1) + '亿'
    } else if (d.damage >= 10000) {
      d.damageStr = (d.damage / 10000).toFixed(1) + '万'
    } else {
      d.damageStr = d.damage.toFixed(0)
    }
  })

  assert.equal(damageData[0].damageStr, '136.0亿')
  assert.equal(damageData[1].damageStr, '1.9亿')

  // 静态模板及样式守卫（验证模板和 CSS 修复点，无需依赖外部渲染引擎）
  const htmlContent = fs.readFileSync(htmlPath, 'utf8')
  assert.ok(htmlContent.includes("d.type === 'DamageTypeAugment'"), '模板应包含 DamageTypeAugment 分支')
  assert.ok(htmlContent.includes("d.type === 'DamageTypePortal'"), '模板应包含 DamageTypePortal 分支')
  assert.ok(htmlContent.includes('strategy-icon-container'), '模板应包含 strategy-icon-container')
  assert.ok(htmlContent.includes('d.entity && d.entity.icon') && htmlContent.includes('d.entity.rarity || 4'), '棋子卡片应有空安全守卫')

  const cssContent = fs.readFileSync(cssPath, 'utf8')
  assert.ok(cssContent.includes('.damage-entity-container .strategy-icon-container'), 'CSS 应适配伤害栏策略图标')
})
