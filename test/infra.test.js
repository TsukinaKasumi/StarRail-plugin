/**
 * 测试基建自检：
 * 1. 模块钩子 + 全局桩能让全部 apps/*.js 在无 Yunzai 环境下加载（桩漂移守卫）
 * 2. 伪根引导使 pluginRoot 指向沙箱
 * 3. 命令正则提取器可编译全部规则
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import './helpers/globals.mjs'
import { register } from 'node:module'
import { bootFakeRoot } from './helpers/boot.mjs'
import { extractRules } from './helpers/rule-extractor.mjs'

const sandbox = bootFakeRoot()
register('./helpers/hooks.mjs', import.meta.url)

const appFiles = readdirSync(new URL('../apps', import.meta.url)).filter((f) => f.endsWith('.js'))

test(`模块钩子：全部 ${appFiles.length} 个 app 文件可在无 Yunzai 环境下加载`, async (t) => {
  for (const file of appFiles) {
    await t.test(file, { timeout: 30000 }, async () => {
      const mod = await import(`../apps/${file}`)
      const classes = Object.values(mod).filter((v) => typeof v === 'function')
      assert.ok(classes.length > 0, '应至少导出一个插件类')
    })
  }
})

test('伪根引导：pluginRoot 指向沙箱且资源可读', async () => {
  const { pluginRoot } = await import('../utils/path.js')
  assert.ok(pluginRoot.includes('sr-plugin-test-'), `pluginRoot 应在沙箱内: ${pluginRoot}`)
  const { readFileSync, existsSync } = await import('node:fs')
  assert.ok(existsSync(`${pluginRoot}/resources/baseData/characters.json`), '资源联接应可读')
  readFileSync(`${pluginRoot}/resources/baseData/characters.json`)
})

test('全局桩：logger 与 redis 可用', async () => {
  assert.ok(globalThis.logger?.info)
  await globalThis.redis.set('infra-test', '1')
  assert.equal(await globalThis.redis.get('infra-test'), '1')
})

test(`命令正则提取器：${'>='}50 条规则全部可编译`, () => {
  const rules = extractRules()
  assert.ok(rules.length >= 50, `提取到 ${rules.length} 条`)
  const apps = new Set(rules.map((r) => r.app))
  assert.ok(apps.size >= 15, `覆盖 ${apps.size} 个 app 文件`)
})
