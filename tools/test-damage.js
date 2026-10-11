/**
 * StarRail-plugin 伤害引擎回归基线工具（开发用）
 *
 * node:test 体系已承接全部断言（test/utils/damage/*.test.js）：
 *   - 42 用例基线回归：test/utils/damage/regression.test.js
 *   - 欢愉/忆灵/光锥遗器手算对照：elation / memosprite / lightcone-relic .test.js
 * 本工具仅保留开发流程中的基线再生成与本地比对：
 *   node tools/test-damage.js --save   引擎数值口径有意变动后，重新生成提交基线
 *                                     （写入 test/fixtures/damage/baseline.json，
 *                                       重生成后请人工核对 diff 再随引擎改动一并提交）
 *   node tools/test-damage.js          本地快速比对（与 regression.test.js 等价的逐字段比对）
 *
 * 合成输入构造器与提交基线均在 test/fixtures/damage/（charinfo-builders.mjs / baseline.json），
 * 开发流程与提交基线为同一来源。
 *
 * 运行依赖 Yunzai 环境：引擎 JSON 以 process.cwd()/plugins/<插件名> 定位（utils/path.js），
 * 本脚本先自行 chdir 到 Yunzai 根目录（本文件位于 plugins/StarRail-plugin/tools/），
 * 即要求插件处于 <yunzai>/plugins/StarRail-plugin 目录结构下。
 */
import path from 'path'
import fs from 'fs'
import { fileURLToPath, pathToFileURL } from 'url'

// 引擎代码使用 Yunzai 运行时的全局 logger，独立运行时打桩
if (!globalThis.logger) {
  globalThis.logger = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: console.error,
    mark: () => {}
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pluginDir = path.resolve(__dirname, '..') // <yunzai>/plugins/StarRail-plugin
const yunzaiRoot = path.resolve(pluginDir, '..', '..')
// utils/path.js 以 process.cwd()/plugins/<插件名> 定位插件根，先切到 Yunzai 根目录
process.chdir(yunzaiRoot)

const { damage } = await import(
  pathToFileURL(path.join(pluginDir, 'utils/damage/main.js')).href
)
const { makeRegressionCase, CHAR_ELEMENT } = await import(
  pathToFileURL(path.join(pluginDir, 'test/fixtures/damage/charinfo-builders.mjs')).href
)

// 提交基线（test/utils/damage/regression.test.js 的对照文件）
const BASELINE_FILE = path.join(pluginDir, 'test', 'fixtures', 'damage', 'baseline.json')

let failed = 0
const fail = (msg) => { failed++; console.log('  [FAIL] ' + msg) }
const pass = (msg) => console.log('  [PASS] ' + msg)

/* ========== 回归用例执行（14 名 1.3 角色 × 3 变体，输入构造见 fixtures） ========== */

function runRegression () {
  const results = {}
  for (const id of Object.keys(CHAR_ELEMENT)) {
    for (let variant = 0; variant < 3; variant++) {
      const charinfo = makeRegressionCase(Number(id), variant)
      // 引擎对个别数据缺陷角色的抛错行为也纳入基线（thrown 字段），保证改动前后行为可比
      let ret
      try {
        ret = damage(charinfo)
      } catch (e) {
        ret = { thrown: String(e && e.message) }
      }
      if (!ret) {
        fail(`回归 ${id}-v${variant}：damage() 返回 null`)
        continue
      }
      results[`${id}-v${variant}`] = ret
    }
  }
  return results
}

/* ========== 基线保存 / 比对 ========== */

function saveBaseline (results) {
  fs.writeFileSync(
    BASELINE_FILE,
    JSON.stringify({ savedAt: new Date().toISOString(), node: process.version, results }, null, 2),
    'utf8'
  )
  console.log(`回归基线已保存：${path.relative(yunzaiRoot, BASELINE_FILE)}（${Object.keys(results).length} 个用例）`)
}

function compareBaseline (results) {
  if (!fs.existsSync(BASELINE_FILE)) {
    fail(`未找到回归基线 ${BASELINE_FILE}（可先运行 node tools/test-damage.js --save 生成）`)
    return
  }
  const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')).results
  const baseKeys = Object.keys(baseline)
  const newKeys = Object.keys(results)
  let diffCount = 0
  for (const key of baseKeys) {
    if (!(key in results)) {
      fail(`回归 ${key}：改动后缺失该用例`)
      diffCount++
      continue
    }
    const b = JSON.stringify(baseline[key])
    const n = JSON.stringify(results[key])
    if (b !== n) {
      diffCount++
      if (baseline[key].thrown || results[key].thrown) {
        fail(`回归 ${key}：抛错行为变化\n         基线: ${b}\n         现在: ${n}`)
        continue
      }
      const bd = baseline[key].damage
      const nd = results[key].damage
      for (let i = 0; i < Math.max(bd.length, nd.length); i++) {
        const bs = bd[i] && JSON.stringify(bd[i])
        const ns = nd[i] && JSON.stringify(nd[i])
        if (bs !== ns) {
          fail(`回归 ${key} 第 ${i} 项不一致\n         基线: ${bs}\n         现在: ${ns}`)
        }
      }
    }
  }
  for (const key of newKeys) {
    if (!(key in baseline)) {
      fail(`回归 ${key}：改动后多出该用例`)
      diffCount++
    }
  }
  if (diffCount === 0) {
    pass(`回归：${baseKeys.length} 个用例（14 名 1.3 角色 x 3 变体）输出与基线逐字段一致`)
  } else {
    fail(`回归：${diffCount} 个用例与基线不一致`)
  }
}

/* ========== 入口 ========== */

const saveMode = process.argv.includes('--save')
console.log(`StarRail-plugin 伤害引擎基线工具（cwd: ${process.cwd()}）`)
if (saveMode) {
  saveBaseline(runRegression())
} else {
  compareBaseline(runRegression())
}

console.log('')
if (failed > 0) {
  console.log(`结果：${failed} 项失败`)
  process.exit(1)
}
console.log('结果：全部通过')
