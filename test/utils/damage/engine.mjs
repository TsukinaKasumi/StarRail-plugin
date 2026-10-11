/**
 * 伤害引擎测试装载器（test/utils/damage/ 各 *.test.js 顶部静态 import 本文件）
 *
 * 伤害引擎（utils/damage/）不 import 任何 Yunzai 模块、不依赖 plugin 类，
 * 因此【无需注册模块解析钩子（hooks）】，仅需要：
 *   1. 全局 logger 桩（helpers/globals.mjs 副作用导入，main.js/relice.js 调 logger.debug）
 *   2. pluginRoot 指向可读 utils/damage/json 的伪根 —— helpers 的伪根只联接
 *      resources/defSet，这里补一条 utils 联接（只读）供引擎 JSON 定位
 * 之后动态 import 引擎（静态 import 会在伪根就绪前解析 path.js，pluginRoot 将指向错误位置）。
 *
 * node --test 每个测试文件独立进程，本文件的 chdir 与 skilldict 注入互不串扰。
 */
import '../../helpers/globals.mjs'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { bootFakeRoot } from '../../helpers/boot.mjs'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const sandbox = bootFakeRoot()
fs.symlinkSync(
  path.join(REPO_ROOT, 'utils'),
  path.join(sandbox.pluginRoot, 'utils'),
  process.platform === 'win32' ? 'junction' : 'dir'
)

// globals 桩的 debug 映射 console.debug（写 stderr）；伤害引擎每行伤害打多条 debug，
// 在本装载器所在进程内静默（info/warn/error 保留），避免淹没 node:test 输出
globalThis.logger.debug = () => {}

export const { damage } = await import('../../../utils/damage/main.js')
export const { skilldict } = await import('../../../utils/damage/data/data.js')
