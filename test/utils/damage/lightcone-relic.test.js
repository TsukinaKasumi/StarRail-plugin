/**
 * 欢愉光锥/遗器套装增益手算对照（迁移自 tools/test-damage.js 的增益冒烟段）
 * 用例 G 花花世界迷人眼（joy+36% 手算锚点）/ H 套装 joy 档位爆伤 / I 魔法少女 xeIgnore /
 * J 卜者速度档 / K 邂逅花季易伤 / L 菇菇嘎嘎 / M 新补光锥防崩溃（23048 旧攻击路径）
 *
 * 数值来源：miao-plugin weapon/欢愉/calc.js 与 artifact/calc.js（engine 侧 json 与钩子同口径）。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { damage, skilldict } from './engine.mjs'
import { gearChar } from '../../fixtures/damage/charinfo-builders.mjs'

// 欢愉技注入（同 elation.test.js：Xe 等级 3 -> 倍率 1.68，1 段；本文件与该文件分属独立进程）
skilldict['1102'].Xe = [1.2, 1.44, 1.68]
skilldict['1102'].Xe2 = [3.0, 3.15, 3.3]
skilldict['1102'].skillList.Xe = ['elation', '欢愉技', 1, 'Xe']
skilldict['1102'].skillList.Xe2 = ['elation', '强化欢愉技', 3, 'Xe2']

const findSkill = (result, title) => result.damage.find(d => d.title === title)
const REL_TOL = 1e-4
function closeTo (actual, expected, label) {
  const rel = Math.abs(actual - expected) / Math.abs(expected)
  assert.ok(rel < REL_TOL,
    `${label}：引擎 ${actual} vs 手算 ${expected}（相对误差 ${(rel * 100).toExponential(3)}%，超过 0.01%）`)
}

// 各用例共用乘区（同 elation.test.js 用例 A）：欢愉基础伤害 7535.11，倍率 1.68，
// 抗性区 1.2（avatar 1102 钩子），减伤区 0.9，基础暴击 5%/50%

test('用例 G：花花世界迷人眼（23053，叠影 5）joy+36% 手算锚点', () => {
  // Equipment.json 常驻：暴击伤害 +0.80 -> 爆伤 0.5+0.8=1.3
  // 钩子：每消耗 1 战技点无视防御 9%（满 4 层 = 36%）+ 推流全队欢愉度 +36%
  // 手算：欢愉度区 = 1.36；防御区 = 1000/(1000+1000x0.64) = 1000/1640；
  //       暴击 = 1+1.3 = 2.3；期望 = 1+0.05x1.3 = 1.065
  const xe = findSkill(damage(gearChar({ equipment: { id: 23053, rank: 5 } })), '欢愉技')
  assert.ok(xe, '未找到欢愉技条目')
  closeTo(xe.value.critical, 7535.11 * 1.68 * 1.36 * (1000 / 1640) * 1.2 * 0.9 * 2.3,
    '用例 G 暴击伤害（joy+36%/无视防御 36%/爆伤+80%）')
  closeTo(xe.value.expect, 7535.11 * 1.68 * 1.36 * (1000 / 1640) * 1.2 * 0.9 * 1.065,
    '用例 G 期望伤害')
})

test('用例 H：零号关卡朋克洛德 2 件套（325）+ 欢愉度副词条 36', () => {
  // RelicSetSkill.json 常驻：joy +8；副词条 joy +36 -> 合计 44（>=40、<80 -> 钩子暴击伤害 +0.20）
  // 手算：欢愉度区 = 1.44；爆伤 = 0.5+0.2 = 0.7 -> 暴击 1.7；期望 = 1+0.05x0.7 = 1.035
  const joyRelic = {
    id: 61013,
    main_affix_tag: 'HPDelta',
    main_affix_value: 705.6,
    sub_affix_id: [{ tag: 'joy', value: 36 }]
  }
  const xe = findSkill(damage(gearChar({
    relics: [joyRelic],
    relic_sets: [{ set_id: '325', set_name: '2件套' }]
  })), '欢愉技')
  assert.ok(xe, '未找到欢愉技条目')
  closeTo(xe.value.critical, 7535.11 * 1.68 * 1.44 * 0.5 * 1.2 * 0.9 * 1.7,
    '用例 H 暴击伤害（joy 8+36=44 -> 爆伤+20%）')
  closeTo(xe.value.expect, 7535.11 * 1.68 * 1.44 * 0.5 * 1.2 * 0.9 * 1.035,
    '用例 H 期望伤害')
})

test('用例 I：闪耀功勋的魔法少女 4 件套（129）xeIgnore+20', () => {
  // 4 件套钩子：欢愉伤害无视 10% + 每累计 5 点笑点额外 1%（满 10 层）= xeIgnore +20
  // 手算：防御区 = 1000/(1000+1000x0.8) = 1000/1800（= 用例 A 防御区 0.5 x 10/9）
  const xe = findSkill(damage(gearChar({
    relic_sets: [{ set_id: '129', set_name: '4件套' }]
  })), '欢愉技')
  assert.ok(xe, '未找到欢愉技条目')
  closeTo(xe.value.critical, 7535.11 * 1.68 * (1000 / 1800) * 1.2 * 0.9 * 1.5,
    '用例 I 暴击伤害（xeIgnore+20）')
  closeTo(xe.value.critical, 10253.777688 * 10 / 9,
    '用例 I 与用例 A 的比值校验（防御区 0.5 -> 10/18）')
})

test('用例 J：应天涉远的卜者 4 件套（130）速度档 120', () => {
  // 4 件套钩子：速度 102.5x(1+0.25[avatar 1102 钩子]) = 128.125 >= 120 -> 暴击率 +0.10；全队欢愉度 +10
  // （引擎既有 4 件套口径：RelicSetSkill 的 "2" 词条不与 "4" 同时读取，故速度不吃本套装 2 件套 6%）
  // 手算：欢愉度区 = 1.10；暴击率 = 0.05+0.10 = 0.15 -> 暴击 1.5；期望 = 1+0.15x0.5 = 1.075
  const xe = findSkill(damage(gearChar({
    relic_sets: [{ set_id: '130', set_name: '4件套' }]
  })), '欢愉技')
  assert.ok(xe, '未找到欢愉技条目')
  closeTo(xe.value.critical, 7535.11 * 1.68 * 1.10 * 0.5 * 1.2 * 0.9 * 1.5,
    '用例 J 暴击伤害（速度档 120 -> 暴击率+10%/joy+10）')
  closeTo(xe.value.expect, 7535.11 * 1.68 * 1.10 * 0.5 * 1.2 * 0.9 * 1.075,
    '用例 J 期望伤害')
})

test('用例 K：邂逅于下一个花季（23058，叠影 1）', () => {
  // Equipment.json 常驻：暴击伤害 +0.60、能量恢复效率 +0.10（不影响伤害）；
  // 钩子：施放欢愉技时敌方受到的伤害提高 15%（通用易伤 DmgRatio +0.15）
  // 手算：易伤区 = 1+0.15 = 1.15；爆伤 = 0.5+0.6 = 1.1 -> 暴击 2.1；期望 = 1+0.05x1.1 = 1.055
  const xe = findSkill(damage(gearChar({ equipment: { id: 23058, rank: 1 } })), '欢愉技')
  assert.ok(xe, '未找到欢愉技条目')
  closeTo(xe.value.critical, 7535.11 * 1.68 * 1.15 * 0.5 * 1.2 * 0.9 * 2.1,
    '用例 K 暴击伤害（爆伤+60%/易伤+15%）')
  closeTo(xe.value.expect, 7535.11 * 1.68 * 1.15 * 0.5 * 1.2 * 0.9 * 1.055,
    '用例 K 期望伤害')
})

test('用例 L：菇菇嘎嘎历险记（21064，叠影 5）', () => {
  // 钩子：欢愉度 +20 + 施放欢愉技时敌方全体受到的欢愉伤害提高 10%（xeEnemydmg +10）
  // 手算：欢愉度区 = 1.20；欢愉易伤 = 1+10/100 = 1.1
  const xe = findSkill(damage(gearChar({ equipment: { id: 21064, rank: 5 } })), '欢愉技')
  assert.ok(xe, '未找到欢愉技条目')
  closeTo(xe.value.critical, 7535.11 * 1.68 * 1.20 * 1.1 * 0.5 * 1.2 * 0.9 * 1.5,
    '用例 L 暴击伤害（joy+20/xeEnemydmg+10）')
})

test('用例 M：新补光锥走旧攻击路径（Equipment.json 补全防崩溃，23048）', () => {
  // 金血铭刻的时代（23058 同批补入的 23048，叠影 1）：常驻攻击力 +0.64，无特效钩子
  // 普攻 6 级（倍率 1.0）手算：攻击力 = 640.3x1.64；增伤区 1.75（avatar 1102 钩子）；
  //   暴击 = 640.3x1.64x1.0x1.75x0.5x1.2x0.9x1.5 = 1488.50541
  const normal = findSkill(damage(gearChar({ equipment: { id: 23048, rank: 1 } })), '普攻')
  assert.ok(normal, '未找到普攻条目（Equipment.json 补全后旧路径异常）')
  closeTo(normal.value.critical, 640.3 * 1.64 * 1.75 * 0.5 * 1.2 * 0.9 * 1.5,
    '用例 M 新补光锥（23048 攻击力+64%）普攻暴击伤害')
  closeTo(normal.value.expect, 640.3 * 1.64 * 1.75 * 0.5 * 1.2 * 0.9 * 1.025,
    '用例 M 新补光锥普攻期望伤害')
})
