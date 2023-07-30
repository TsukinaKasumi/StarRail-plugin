/**
 * @Author: Lycofuture
 * @Date: 2023-07-30 19:06:55
 * @LastEditors: Lycofuture 
 * @LastEditTime: 2023-07-30 19:15:27
 */
import fs from 'node:fs'

if (!global.segment) {
  global.segment = (await import("oicq")).segment
}

if (!global.core) {
  try {
    global.core = (await import("oicq")).core
  } catch (err) { }
}

const files = fs.readdirSync('./plugins/StarRail-plugin/apps').filter(file => file.endsWith('.js'))

let ret = []

logger.info('------(ˊ·ω·ˋ)------')
logger.info('StarRail-plugin  载入中')
files.forEach((file) => {
  ret.push(import(`./apps/${file}`))
})

ret = await Promise.allSettled(ret)

let apps = {}
for (let i in files) {
  let name = files[i].replace('.js', '')

  if (ret[i].status != 'fulfilled') {
    logger.error(`载入插件错误：${logger.red(name)}`)
    logger.error('StarRail-plugin 载入失败')
    logger.error(ret[i].reason)
    continue
  }
  apps[name] = ret[i].value[Object.keys(ret[i].value)[0]]
}
logger.info('StarRail-plugin 载入成功!')
logger.info('仓库地址 https://gitee.com/hewang1an/StarRail-plugin')
logger.info('插件群号: 758447726')
logger.info('Created By 鹤望兰')
logger.info('-------------------')
export { apps }
