import fs from 'node:fs'

if (!global.segment) {
  global.segment = (await import("oicq")).segment
}

if (!global.core) {
  try {
    global.core = (await import("oicq")).core
  } catch (err) {}
}

const files = fs.readdirSync('./plugins/StarRail-plugin/apps').filter(file => file.endsWith('.js'))

let ret = []

logger.info('星铁插件载入成功!')

files.forEach((file) => {
  ret.push(import(`./apps/${file}`))
})

ret = await Promise.allSettled(ret)

let apps = {}
for (let i in files) {
  let name = files[i].replace('.js', '')

  if (ret[i].status != 'fulfilled') {
    logger.error(`载入插件错误：${logger.red(name)}`)
    logger.error(ret[i].reason)
    continue
  }
  apps[name] = ret[i].value[Object.keys(ret[i].value)[0]]
}
export { apps }
