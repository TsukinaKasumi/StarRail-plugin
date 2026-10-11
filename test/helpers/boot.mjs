/**
 * 伪 Yunzai 根目录引导（解决 utils/path.js 的 pluginRoot = cwd + '/plugins/StarRail-plugin' 依赖）
 *
 * 构造临时目录：
 *   <tmp>/plugins/StarRail-plugin/   真实目录
 *     ├── resources -> <仓库>/resources   （联接：资源只读，与真实数据一致）
 *     ├── defSet    -> <仓库>/defSet      （联接：默认配置只读）
 *     ├── package.json                    （副本：版本号等读取）
 *     ├── config/                         （空目录：与真实用户配置隔离，绝不读取真实 config）
 *     ├── data/                           （空目录：测试写入沙箱，不污染仓库）
 *     └── temp/                           （空目录：导出等临时文件沙箱）
 * 然后 process.chdir(<tmp>)。
 *
 * 被测模块必须在 chdir 之后动态 import（其 path.js 在模块加载时计算 pluginRoot）。
 * node --test 每个测试文件独立进程，互不干扰；沙箱目录由系统临时目录派生。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

export function bootFakeRoot () {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sr-plugin-test-'))
  const fakePlugin = path.join(tmp, 'plugins', 'StarRail-plugin')
  fs.mkdirSync(fakePlugin, { recursive: true })
  const linkDir = (name) => fs.symlinkSync(
    path.join(REPO_ROOT, name),
    path.join(fakePlugin, name),
    process.platform === 'win32' ? 'junction' : 'dir'
  )
  linkDir('resources')
  linkDir('defSet')
  fs.copyFileSync(path.join(REPO_ROOT, 'package.json'), path.join(fakePlugin, 'package.json'))
  // 伪 Yunzai 根 package.json（部分 app 读取 _path/package.json 判断 Yunzai 版本）
  fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ name: 'trss-yunzai', version: '3.1.3' }, null, 2))
  for (const dir of ['config', 'data', 'temp']) {
    fs.mkdirSync(path.join(fakePlugin, dir), { recursive: true })
  }
  process.chdir(tmp)
  return {
    root: tmp,
    pluginRoot: fakePlugin,
    /** 相对伪根的路径（如 data/srJson 沙箱） */
    path: (...seg) => path.join(tmp, ...seg),
    /** 相对伪插件根的路径（data/panel 等） */
    pluginPath: (...seg) => path.join(fakePlugin, ...seg)
  }
}
