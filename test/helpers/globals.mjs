/**
 * Yunzai 运行时全局对象的测试桩（node:test 进程内使用）
 *
 * 用法：在被测模块动态 import 之前
 *   import './helpers/globals.mjs'   // 副作用导入：安装全局桩
 */
import pluginStub from './stubs/plugin.mjs'

if (!globalThis.plugin) {
  // TRSS-Yunzai 将 plugin 基类注册为全局（部分 app 如 rogue.js 直接 extends plugin 不 import）
  globalThis.plugin = pluginStub
}

if (!globalThis.logger) {
  globalThis.logger = {
    info: console.info,
    warn: console.warn,
    error: console.error,
    mark: console.info,
    debug: console.debug,
    trace: console.debug
  }
}

if (!globalThis.redis) {
  globalThis.redis = new (class {
    constructor () {
      this.store = new Map()
    }

    async get (key) {
      return this.store.get(key) ?? null
    }

    async set (key, value) {
      this.store.set(key, value)
      return 'OK'
    }

    async setEx (key, ttl, value) {
      this.store.set(key, value)
      return 'OK'
    }

    async del (key) {
      return this.store.delete(key) ? 1 : 0
    }

    /** 测试辅助：清空桩数据 */
    clear () {
      this.store.clear()
    }
  })()
}
