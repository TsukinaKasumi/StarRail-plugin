/**
 * 欢愉（elation）公式手算对照（迁移自 tools/test-damage.js 的欢愉冒烟段）
 * 用例 A 裸欢愉技 / B 全词条欢愉技 / C 强化欢愉技 xe2 / 旧路径零影响
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { damage, skilldict } from './engine.mjs'
import { elationChar } from '../../fixtures/damage/charinfo-builders.mjs'

// 欢愉倍率数组与技能位注入：C16 落地欢愉角色时等价于在 SkillData.json 写入以下条目
//   "Xe":  [1.2, 1.44, 1.68],
//   "Xe2": [3.0, 3.15, 3.3],
//   "skillList": {
//     ..., "Xe": ["elation", "欢愉技", 1, "Xe"], "Xe2": ["elation", "强化欢愉技", 3, "Xe2"]
//   }
// 此处向内存中的 skilldict 注入，用于验证引擎通路（不改动 json 文件）。
skilldict['1102'].Xe = [1.2, 1.44, 1.68]
skilldict['1102'].Xe2 = [3.0, 3.15, 3.3]
skilldict['1102'].skillList.Xe = ['elation', '欢愉技', 1, 'Xe']
skilldict['1102'].skillList.Xe2 = ['elation', '强化欢愉技', 3, 'Xe2']

const findSkill = (result, title) => result.damage.find(d => d.title === title)
const REL_TOL = 1e-4 // 0.01% 相对误差
function closeTo (actual, expected, label) {
  const rel = Math.abs(actual - expected) / Math.abs(expected)
  assert.ok(rel < REL_TOL,
    `${label}：引擎 ${actual} vs 手算 ${expected}（相对误差 ${(rel * 100).toExponential(3)}%，超过 0.01%）`)
}

test('用例 A：裸欢愉技（无任何欢愉词条）', () => {
  // 输入：Lv80 1102 rank0，Xe 等级 3（倍率 1.68，1 段），无遗器/光锥/套装/行迹
  // 手算（引擎各乘区）：
  //   欢愉基础伤害(Lv80) = 7535.11（= 击破基础伤害 3767.55 x 2，miao DmgCalcMeta 表）
  //   欢愉度区 joy_num   = 1 + 0/100 = 1        （无 joy 词条）
  //   增笑区 merrymakes  = 1 + 0/100 = 1        （无 merrymakes 词条）
  //   笑点系数 punchline = 1 + 5x0/(0+240) = 1  （P = 0）
  //   抗性区             = 1 + 0.2 = 1.2        （avatar 1102 钩子：量子无视抗性 +0.2）
  //   防御区             = 1000/(1000+1000) = 0.5  （等级 80：80x10+200=1000，无无视防御）
  //   易伤区             = 1                     （无 DmgRatio/xeEnemydmg 词条）
  //   暴击区             = 暴击 1+0.5=1.5；期望 1+0.05x0.5=1.025（基础 5%/50%）
  //   减伤区             = 0.9                   （韧性未击破通用减伤）
  //   注意：avatar 1102 钩子提供的 AllDamageAddedRatio（天赋倍率 0.75）与攻击力均【不参与】欢愉公式
  // 暴击伤害 = 7535.11 x 1.68 x 1 x 1 x 1 x 1 x 0.5 x 1.2 x 0.9 x 1.5 = 10253.777688
  // 期望伤害 = 7535.11 x 1.68 x 1.025 x 0.5 x 1.2 x 0.9 = 7006.7480868
  const xe = findSkill(damage(elationChar([], 3)), '欢愉技')
  assert.ok(xe, '未找到欢愉技条目（elation 分支未生效）')
  closeTo(xe.value.critical, 10253.777688, '用例 A 暴击伤害')
  closeTo(xe.value.expect, 7006.7480868, '用例 A 期望伤害')
})

test('用例 B：全词条欢愉技（欢愉度/增笑/笑点/无视防御/欢愉易伤，经遗器副词条注入）', () => {
  // 输入：同用例 A，遗器 1 件，副词条：
  //   joy=36, joyPlus=10, joyPct=4（合计欢愉度 50%），merrymakes=20（增笑 20%），
  //   punchline=50（笑点 50），xeIgnore=10（欢愉无视防御 10%），xeEnemydmg=12（欢愉易伤 12%），
  //   CriticalChanceBase=0.25, CriticalDamageBase=0.30, QuantumResistancePenetration=0.10
  // 手算（引擎各乘区）：
  //   欢愉度区 = 1 + (36+10+4)/100 = 1.5
  //   增笑区   = 1 + 20/100 = 1.2
  //   笑点系数 = 1 + 5x50/(50+240) = 1 + 250/290 = 1.8620689655172413
  //   抗性区   = 1 + 0.2(角色钩子) + 0.10(副词条) = 1.3
  //   防御区   = 无视 10% -> 敌方防御 1000x0.9=900，1000/(1000+900) = 0.5263157894736842
  //   易伤区   = 1 + 12/100 = 1.12
  //   暴击区   = 暴击率 0.05+0.25=0.30，爆伤 0.5+0.30=0.80 -> 暴击 1.8；期望 1+0.30x0.80=1.24
  // 暴击伤害 = 7535.11 x 1.68 x 1.5 x 1.2 x 1.8620689655 x 1.12 x 0.5263157894 x 1.3 x 0.9 x 1.8
  //          = 52673.227963（分步：12658.9848 x1.5=18988.4772 x1.2=22786.17264 x1.862=42429.424913
  //            x1.12=47520.955902 x10/19=25011.029422 x1.3=32514.338249 x0.9=29262.904424 x1.8）
  // 期望伤害 = 29262.904424 x 1.24 = 36286.001486
  const joyRelic = {
    id: 61011,
    main_affix_tag: 'HPDelta',
    main_affix_value: 705.6,
    sub_affix_id: [
      { tag: 'joy', value: 36 },
      { tag: 'joyPlus', value: 10 },
      { tag: 'joyPct', value: 4 },
      { tag: 'merrymakes', value: 20 },
      { tag: 'punchline', value: 50 },
      { tag: 'xeIgnore', value: 10 },
      { tag: 'xeEnemydmg', value: 12 },
      { tag: 'CriticalChanceBase', value: 0.25 },
      { tag: 'CriticalDamageBase', value: 0.3 },
      { tag: 'QuantumResistancePenetration', value: 0.1 }
    ]
  }
  const xe = findSkill(damage(elationChar([joyRelic], 3)), '欢愉技')
  assert.ok(xe, '未找到欢愉技条目')
  closeTo(xe.value.critical, 52673.227963, '用例 B 暴击伤害')
  closeTo(xe.value.expect, 36286.001486, '用例 B 期望伤害')
})

test('用例 C：强化欢愉技（Xe2，3 段）+ 笑点 80', () => {
  // 输入：Xe2 等级 2（倍率数组 [3.0,3.15,3.3] 取 3.15，3 段 -> 每段 1.05），
  //       遗器 1 件：punchline=80
  // 手算：
  //   笑点系数 = 1 + 5x80/(80+240) = 1 + 400/320 = 2.25
  //   其余同用例 A（欢愉度/增笑/易伤/无视防御均无）
  // 每段暴击 = 7535.11 x 1.05 x 2.25 x 0.5 x 1.2 x 0.9 x 1.5 = 14419.37487375
  //   （分步：7911.8655 x2.25=17801.697375 x0.5=8900.8486875 x1.2=10681.018425
  //     x0.9=9612.9165825 x1.5）
  // 总暴击（3 段） = 43258.12462125
  // 每段期望 = 9612.9165825 x 1.025 = 9853.2394970625，总期望 = 29559.7184911875
  const punchlineRelic = {
    id: 61012,
    main_affix_tag: 'HPDelta',
    main_affix_value: 705.6,
    sub_affix_id: [{ tag: 'punchline', value: 80 }]
  }
  const xe2 = findSkill(damage(elationChar([punchlineRelic], 3, 2)), '强化欢愉技')
  assert.ok(xe2, '未找到强化欢愉技条目')
  closeTo(xe2.value.critical, 43258.12462125, '用例 C 暴击伤害（3 段合计）')
  closeTo(xe2.value.expect, 29559.7184911875, '用例 C 期望伤害（3 段合计）')
})

test('旧路径零影响：欢愉词条不改变普攻/战技/终结技输出', () => {
  // 同一面板，去掉 joy/joyPlus/joyPct/merrymakes/punchline/xeIgnore/xeEnemydmg 副词条后，
  // Normal/BPSkill/Ultra 三个旧技能的输出必须与带欢愉词条时完全一致。
  const joyRelic = {
    id: 61011,
    main_affix_tag: 'HPDelta',
    main_affix_value: 705.6,
    sub_affix_id: [
      { tag: 'joy', value: 36 },
      { tag: 'joyPlus', value: 10 },
      { tag: 'joyPct', value: 4 },
      { tag: 'merrymakes', value: 20 },
      { tag: 'punchline', value: 50 },
      { tag: 'xeIgnore', value: 10 },
      { tag: 'xeEnemydmg', value: 12 },
      { tag: 'CriticalChanceBase', value: 0.25 },
      { tag: 'CriticalDamageBase', value: 0.3 },
      { tag: 'QuantumResistancePenetration', value: 0.1 }
    ]
  }
  const plainRelic = {
    id: 61011,
    main_affix_tag: 'HPDelta',
    main_affix_value: 705.6,
    sub_affix_id: [
      { tag: 'CriticalChanceBase', value: 0.25 },
      { tag: 'CriticalDamageBase', value: 0.3 },
      { tag: 'QuantumResistancePenetration', value: 0.1 }
    ]
  }
  const withJoy = damage(elationChar([joyRelic], 3))
  const withoutJoy = damage(elationChar([plainRelic], 3))
  for (const title of ['普攻', '战技', '终结技']) {
    const a = findSkill(withJoy, title)
    const b = findSkill(withoutJoy, title)
    assert.ok(a && b, `缺少 ${title} 条目`)
    assert.deepEqual(a, b, `${title} 输出被欢愉词条改变`)
  }
})
