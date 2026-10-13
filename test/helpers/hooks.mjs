/**
 * 模块解析钩子：把对 Yunzai 核心模块的 import 重定向到测试桩，
 * 使插件代码可以在无 Yunzai 环境（CI）下被单元测试加载。
 *
 * 用法（在被测 app 动态 import 之前）：
 *   import { register } from 'node:module'
 *   register('./helpers/hooks.mjs', import.meta.url)
 *
 * 桩清单与 apps/*.js 实际 import 的 Yunzai 模块一一对应（全为 default export）。
 * 新增桩请同步更新 STUB_MAP，注意保持各测试文件对此文件的只读约定。
 */
const stubUrl = (name) => new URL(`./stubs/${name}.mjs`, import.meta.url).href

const STUB_MAP = [
  ['lib/plugins/plugin.js', 'plugin'],
  ['lib/config/config.js', 'cfg'],
  ['lib/common/common.js', 'common'],
  ['genshin/model/user.js', 'user'],
  ['genshin/model/mys/NoteUser.js', 'noteuser'],
  ['genshin/model/gsCfg.js', 'gscfg'],
  ['genshin/model/mys/mysInfo.js', 'mysinfo'],
  ['genshin/model/mys/mysApi.js', 'mysapi'],  // runtime/MysSRApi.js 继承的父类：CI 无 genshin 插件，仅桩出继承表面
  ['xiaoyao-cvs-plugin/model/user.js', 'xiaoyao-user'],
  ['chokidar', 'chokidar'],  // setting.js 热更新监听：禁用（否则钉住事件循环）
  ['node-fetch', 'node-fetch']  // 网络请求：一律走 mock（见 helpers/fetch-mock.mjs），测试禁真实网络
]

/** 供 register(HOOKS_URL) 使用（子目录测试文件免手写相对路径） */
export const HOOKS_URL = new URL("./hooks.mjs", import.meta.url).href

export async function resolve (specifier, context, nextResolve) {
  for (const [fragment, stub] of STUB_MAP) {
    if (specifier.includes(fragment)) {
      return { url: stubUrl(stub), shortCircuit: true }
    }
  }
  return nextResolve(specifier, context)
}
