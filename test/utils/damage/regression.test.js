/**
 * 42 用例基线回归（14 名 1.3 角色 × 3 变体，迁移自 tools/test-damage.js）
 *
 * 基线 test/fixtures/damage/baseline.json 由 `node tools/test-damage.js --save` 生成
 * （从 Yunzai 根目录运行），值为纯合成输入的引擎输出快照。引擎数值口径有意变动时：
 * 重生成基线 → 人工核对 diff → 基线随引擎改动一并提交。
 * 断言：引擎输出与基线逐字段一致（含用例集合不多不少）。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { damage } from './engine.mjs'
import { makeRegressionCase, CHAR_ELEMENT } from '../../fixtures/damage/charinfo-builders.mjs'

const baseline = JSON.parse(
  readFileSync(new URL('../../fixtures/damage/baseline.json', import.meta.url), 'utf8')
).results

test('基线完整性：42 用例 = 14 名 1.3 角色 × 3 变体，键不多不少', () => {
  const keys = Object.keys(baseline)
  assert.equal(keys.length, 42, `基线用例数应为 42，实际 ${keys.length}`)
  assert.deepEqual(
    [...new Set(keys.map(k => k.split('-v')[0]))].sort(),
    Object.keys(CHAR_ELEMENT).map(Number).map(String).sort(),
    '角色集合应与 CHAR_ELEMENT 一致'
  )
  for (const id of Object.keys(CHAR_ELEMENT)) {
    for (let v = 0; v < 3; v++) {
      assert.ok(`${id}-v${v}` in baseline, `基线缺用例 ${id}-v${v}`)
    }
  }
})

test('回归：42 用例引擎输出与基线逐字段一致', async (t) => {
  for (const key of Object.keys(baseline).sort((a, b) => Number(a) - Number(b))) {
    const [id, variant] = key.split('-v')
    // node 22 的 runner 不等待未 await 的子测试队列（父函数返回即取消剩余子测试），必须逐个 await
    await t.test(key, () => {
      const charinfo = makeRegressionCase(Number(id), Number(variant))
      // 引擎对个别数据缺陷角色的抛错行为也纳入基线（thrown 字段）；当前基线无 thrown 用例
      let ret
      try {
        ret = damage(charinfo)
      } catch (e) {
        ret = { thrown: String(e && e.message) }
      }
      assert.ok(ret, 'damage() 不应返回 null')
      assert.deepEqual(ret, baseline[key], `${key} 输出与基线不一致`)
    })
  }
})
