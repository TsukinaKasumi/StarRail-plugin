/**
 * 忆灵技（me）/忆灵天赋（mt）手算对照（迁移自 tools/test-damage.js 的忆灵冒烟段）
 * 用例 D 忆灵技 / D2 无条目回落 1 级 / E 忆灵天赋越界收敛 / F 忆灵技越界收敛 / 旧路径零影响
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { damage, skilldict } from './engine.mjs'
import { memoChar } from '../../fixtures/damage/charinfo-builders.mjs'

// 忆灵倍率数组与技能位注入：W3-E 落地记忆命途角色时等价于在 SkillData.json 写入以下条目
//   "Me":  [0.55, 0.66, 0.77, 0.88, 0.99, 1.1, 1.21],  // 取自阿格莱雅「刺纹之陷」表 1（7 级）
//   "Mt":  [0.5, 0.6, 0.7],                            // 合成短数组（3 级），用于验证越界收敛
//   "skillList": {
//     ..., "Me": ["attack", "忆灵技", 1, "Me"], "Mt": ["attack", "忆灵天赋", 2, "Mt"]
//   }
// 忆灵技/忆灵天赋走常规攻击力伤害分支（skillList 第 0 位 'attack'），仅倍率数组与等级来源不同；
// 等级从 behaviorList 中按技能 ID 匹配（忆灵技 ID 规律：角色ID x 1000 + 301，忆灵天赋 +302）。
// 此处向内存中的 skilldict 注入，用于验证引擎通路（不改动 json 文件）。
skilldict['1102'].Me = [0.55, 0.66, 0.77, 0.88, 0.99, 1.1, 1.21]
skilldict['1102'].Mt = [0.5, 0.6, 0.7]
skilldict['1102'].skillList.Me = ['attack', '忆灵技', 1, 'Me']
skilldict['1102'].skillList.Mt = ['attack', '忆灵天赋', 2, 'Mt']

const findSkill = (result, title) => result.damage.find(d => d.title === title)
const REL_TOL = 1e-4
function closeTo (actual, expected, label) {
  const rel = Math.abs(actual - expected) / Math.abs(expected)
  assert.ok(rel < REL_TOL,
    `${label}：引擎 ${actual} vs 手算 ${expected}（相对误差 ${(rel * 100).toExponential(3)}%，超过 0.01%）`)
}

// 1102 裸面板各乘区（me/mt 与普攻共用）：
//   攻击力   = 640.3（无遗器/光锥加成）
//   增伤区   = 1 + 0.75（avatar 1102 钩子：AllDamageAddedRatio = 天赋 9 级倍率 0.75）= 1.75
//   易伤区   = 1
//   防御区   = 1000/(1000+1000) = 0.5（Lv80，无无视防御）
//   抗性区   = 1 + 0.2（avatar 1102 钩子：量子无视抗性 0.2）= 1.2
//   减伤区   = 0.9
//   暴击区   = 暴击 1+0.5=1.5；期望 1+0.05x0.5=1.025（基础 5%/50%）
//   速度区   = avatar 1102 钩子 SpeedAddedRatio +0.25（rank<2），不影响伤害

test('用例 D：忆灵技（Me，等级 5 -> 倍率 0.99，1 段）', () => {
  // 暴击伤害 = 640.3 x 0.99 x 1.75 x 0.5 x 1.2 x 0.9 x 1.5
  //          = 633.897 -> 1109.31975 -> 554.659875 -> 665.59185 -> 599.032665 -> 898.5489975
  // 期望伤害 = 599.032665 x 1.025 = 614.008481625
  const me = findSkill(damage(memoChar(5)), '忆灵技')
  assert.ok(me, '未找到忆灵技条目（me 技能位未生效）')
  closeTo(me.value.critical, 898.5489975, '用例 D 忆灵技暴击伤害')
  closeTo(me.value.expect, 614.008481625, '用例 D 忆灵技期望伤害')
})

test('用例 D2：behaviorList 无忆灵技条目时回落默认 1 级（倍率 0.55）', () => {
  // 暴击伤害 = 640.3 x 0.55 x 1.75 x 0.5 x 1.2 x 0.9 x 1.5 = 499.1938875
  // 期望伤害 = 332.795925 x 1.025 = 341.115823125
  const me = findSkill(damage(memoChar(0, 0)), '忆灵技')
  assert.ok(me, '未找到忆灵技条目')
  closeTo(me.value.critical, 499.1938875, '用例 D2 忆灵技默认 1 级暴击伤害')
  closeTo(me.value.expect, 341.115823125, '用例 D2 忆灵技默认 1 级期望伤害')
})

test('用例 E：忆灵天赋（Mt，等级 6 超出 3 级数组 -> 收敛末位 0.7，2 段）', () => {
  // 每段倍率 = 0.7/2 = 0.35
  // 每段暴击 = 640.3 x 0.35 x 1.75 x 0.5 x 1.2 x 0.9 x 1.5
  //          = 224.105 -> 392.18375 -> 196.091875 -> 235.31025 -> 211.779225 -> 317.6688375
  // 总暴击（2 段） = 635.337675；总期望 = 211.779225 x 1.025 x 2 = 434.14741125
  const mt = findSkill(damage(memoChar(5, 6)), '忆灵天赋')
  assert.ok(mt, '未找到忆灵天赋条目（mt 技能位未生效）')
  closeTo(mt.value.critical, 635.337675, '用例 E 忆灵天赋暴击伤害（2 段合计，等级越界收敛）')
  closeTo(mt.value.expect, 434.14741125, '用例 E 忆灵天赋期望伤害（2 段合计，等级越界收敛）')
})

test('用例 F：忆灵技等级 8（模拟星魂加等级后超出 7 级数组 -> 收敛末位 1.21）', () => {
  // 暴击伤害 = 640.3 x 1.21 x 1.75 x 0.5 x 1.2 x 0.9 x 1.5
  //          = 774.763 -> 1355.83525 -> 677.917625 -> 813.50115 -> 732.151035 -> 1098.2265525
  // 期望伤害 = 732.151035 x 1.025 = 750.454810875
  const me = findSkill(damage(memoChar(8)), '忆灵技')
  assert.ok(me, '未找到忆灵技条目')
  closeTo(me.value.critical, 1098.2265525, '用例 F 忆灵技等级越界收敛暴击伤害')
  closeTo(me.value.expect, 750.454810875, '用例 F 忆灵技等级越界收敛期望伤害')
})

test('旧路径零影响：追加忆灵条目不改变普攻/战技/终结技输出', () => {
  // 忆灵技/忆灵天赋条目（301/302）追加在 behaviorList 末尾，旧技能按前 4 项索引取等级，不受影响。
  const withMemo = damage(memoChar(5, 6))
  const withoutMemo = damage(memoChar(0, 0))
  for (const title of ['普攻', '战技', '终结技']) {
    const a = findSkill(withMemo, title)
    const b = findSkill(withoutMemo, title)
    assert.ok(a && b, `缺少 ${title} 条目`)
    assert.deepEqual(a, b, `${title} 输出被忆灵条目改变`)
  }
})
