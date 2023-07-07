import YAML from 'yaml'
import chokidar from 'chokidar'
import fs from 'node:fs'
import { _path, pluginResources, pluginRoot } from './path.js'

class Setting {
  constructor () {
    /** 默认设置 */
    this.defPath = `${_path}/plugins/StarRail-plugin/defSet/`
    this.defSet = {}

    /** 用户设置 */
    this.configPath = `${_path}/plugins/StarRail-plugin/config/`
    this.config = {}

    this.dataPath = `${_path}/plugins/StarRail-plugin/data/`
    this.data = {}

    /** 监听文件 */
    this.watcher = { config: {}, defSet: {} }

    this.initCfg()
  }

  /** 初始化配置 */
  initCfg () {
    const files = fs.readdirSync(this.defPath).filter(file => file.endsWith('.yaml'))
    for (let file of files) {
      if (!fs.existsSync(`${this.configPath}${file}`)) {
        fs.copyFileSync(`${this.defPath}${file}`, `${this.configPath}${file}`)
      }
      this.watch(`${this.configPath}${file}`, file.replace('.yaml', ''), 'config')
    }
  }

  // 配置对象化 用于锅巴插件界面填充
  merge () {
    let sets = {}
    let appsConfig = fs.readdirSync(this.defPath).filter(file => file.endsWith('.yaml'))
    for (let appConfig of appsConfig) {
      // 依次将每个文本填入键
      let filename = appConfig.replace(/.yaml/g, '').trim()
      sets[filename] = this.getConfig(filename)
    }
    return sets
  }

  // 配置对象分析 用于锅巴插件界面设置
  analysis (config) {
    for (let key of Object.keys(config)) {
      this.setConfig(key, config[key])
    }
  }

  // 获取对应模块数据文件
  getData (path, filename) {
    path = `${this.dataPath}${path}/`
    try {
      if (!fs.existsSync(`${path}${filename}.yaml`)) { return false }
      return YAML.parse(fs.readFileSync(`${path}${filename}.yaml`, 'utf8'))
    } catch (error) {
      logger.error(`[${filename}] 读取失败 ${error}`)
      return false
    }
  }

  // 写入对应模块数据文件
  setData (path, filename, data) {
    path = `${this.dataPath}${path}/`
    try {
      if (!fs.existsSync(path)) {
        // 递归创建目录
        fs.mkdirSync(path, { recursive: true })
      }
      fs.writeFileSync(`${path}${filename}.yaml`, YAML.stringify(data), 'utf8')
    } catch (error) {
      logger.error(`[${filename}] 写入失败 ${error}`)
      return false
    }
  }

  // 获取对应模块默认配置
  getdefSet (app) {
    return this.getYaml(app, 'defSet')
  }

  // 获取对应模块用户配置
  getConfig (app) {
    return { ...this.getdefSet(app), ...this.getYaml(app, 'config') }
        // return this.mergeConfigObjectArray({...this.getdefSet(app)},{...this.getYaml(app, 'config')});
  }

  //合并两个对象 相同的数组对象 主要用于yml的列表属性合并 并去重  先备份一下方法
  mergeConfigObjectArray(obj1,obj2){
    for (const key in obj2) {
      if (Array.isArray(obj2[key]) && Array.isArray(obj1[key])) {
        //合并两个对象中相同 数组属性
        const uniqueElements = new Set([...obj1[key], ...obj2[key]]);
        obj1[key] = [...uniqueElements];
      } else {
        //否则以obj2中的为准
        obj1[key] = obj2[key];
      }
    }

    return obj1;
  }

  // 设置对应模块用户配置
  setConfig (app, Object) {
    return this.setYaml(app, 'config', { ...this.getdefSet(app), ...Object })
  }

  // 将对象写入YAML文件
  setYaml (app, type, Object) {
    let file = this.getFilePath(app, type)
    try {
      fs.writeFileSync(file, YAML.stringify(Object), 'utf8')
    } catch (error) {
      logger.error(`[${app}] 写入失败 ${error}`)
      return false
    }
  }

  // 读取YAML文件 返回对象
  getYaml (app, type) {
    let file = this.getFilePath(app, type)
    if (this[type][app]) return this[type][app]

    try {
      this[type][app] = YAML.parse(fs.readFileSync(file, 'utf8'))
    } catch (error) {
      logger.error(`[${app}] 格式错误 ${error}`)
      return false
    }
    this.watch(file, app, type)
    return this[type][app]
  }

  // 获取YAML文件目录
  getFilePath (app, type) {
    if (type === 'defSet') return `${this.defPath}${app}.yaml`
    else {
      try {
        if (!fs.existsSync(`${this.configPath}${app}.yaml`)) {
          fs.copyFileSync(`${this.defPath}${app}.yaml`, `${this.configPath}${app}.yaml`)
        }
      } catch (error) {
        logger.error(`星铁插件缺失默认文件[${app}]${error}`)
      }
      return `${this.configPath}${app}.yaml`
    }
  }

  // 监听配置文件
  watch (file, app, type = 'defSet') {
    if (this.watcher[type][app]) return

    const watcher = chokidar.watch(file)
    watcher.on('change', path => {
      delete this[type][app]
      logger.mark(`[星铁插件][修改配置文件][${type}][${app}]`)
      if (this[`change_${app}`]) {
        this[`change_${app}`]()
      }
    })
    this.watcher[type][app] = watcher
  }
}

export default new Setting()
