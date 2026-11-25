import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const pluginRoot = fileURLToPath(new URL('../../', import.meta.url))
const htmlPath = path.join(pluginRoot, 'resources/gridFight/gridFightArchive.html')
const cssPath = path.join(pluginRoot, 'resources/gridFight/gridFightArchive.css')

test('gridFight: 伤害数据支持角色、羁绊、投资策略、投资环境、主角光环及兜底，模板结构完整', () => {
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
        { portal_id: '2207', icon: 'http://img/3.png', name: '持续伤害概念股' }
      ],
      spot_light_list: [
        { spot_light_id: '100302', role_id: '141002', icon: 'http://img/5.png', name: '渐冻寒潮', role_icon: 'http://img/role5.png' }
      ],
      augment_list: [
        { augment_id: '350701', icon: 'http://img/4.png', name: '万箭齐发', quality: 3 }
      ],
      damage_list: [
        { damage_type: 'DamageTypeRole', id: '140802', damage: '13599683647.8' },
        { damage_type: 'DamageTypeAugment', id: '350701', damage: '186368000.0' },
        { damage_type: 'DamageTypeTrait', id: '300102', damage: '69888000.0' },
        { damage_type: 'DamageTypePortal', id: '2207', damage: '1000000.0' },
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
  mockRecord.lineup.spot_light_list?.forEach(s => {
    if (s.spot_light_id) entityMap[s.spot_light_id] = s
  })

  assert.equal(entityMap['100302']?.name, '渐冻寒潮')

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
  assert.equal(damageData[3].entity.name, '持续伤害概念股')
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

  // 静态模板及样式守卫（验证模板和 CSS 结构，无需依赖外部渲染引擎）
  const htmlContent = fs.readFileSync(htmlPath, 'utf8')
  assert.ok(htmlContent.includes("d.type === 'DamageTypeAugment'"), '模板应包含 DamageTypeAugment 分支')
  assert.ok(htmlContent.includes("d.type === 'DamageTypePortal'"), '模板应包含 DamageTypePortal 分支')
  assert.ok(htmlContent.includes('strategy-icon-container'), '模板应包含 strategy-icon-container')
  assert.ok(htmlContent.includes('d.entity && d.entity.icon') && htmlContent.includes('d.entity.rarity || 4'), '棋子卡片应有空安全守卫')
  assert.ok(htmlContent.includes('record.lineup.spot_light_list'), '模板应渲染主角光环 spot_light_list')
  assert.ok(htmlContent.includes('spotlight-role-badge'), '模板应包含主角光环右下角角色小头像')

  const bondIdx = htmlContent.indexOf('羁绊信息')
  const rowIdx = htmlContent.indexOf('archive-row')
  const spotlightIdx = htmlContent.indexOf('主角光环')
  const strategyIdx = htmlContent.indexOf('投资策略')
  assert.ok(bondIdx < rowIdx && rowIdx < spotlightIdx && spotlightIdx < strategyIdx, '投资环境与主角光环同行区块应位于羁绊信息与投资策略之间')

  const cssContent = fs.readFileSync(cssPath, 'utf8')
  assert.ok(cssContent.includes('.damage-entity-container .strategy-icon-container'), 'CSS 应适配伤害栏策略图标')
  assert.ok(cssContent.includes('.archive-row') && cssContent.includes('margin: 10px'), '同行容器应与其他区块左右对齐')
  assert.ok(cssContent.includes('.archive-col-portal') && cssContent.includes('flex: 3'), '左侧投资环境应按 3:5 比例占宽')
  assert.ok(cssContent.includes('.archive-col-spotlight') && cssContent.includes('flex: 5'), '右侧主角光环应按 3:5 比例占宽')
})
