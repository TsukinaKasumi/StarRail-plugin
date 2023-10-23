import { pluginRoot } from '../../path.js'
import fs from 'fs'
/**
 * @description: 读取JSON文件
 * @param {string} path 路径
 * @param {string} root 目录
 * @return {object}
 */
export function readJson (file, root = pluginRoot) {
  if (fs.existsSync(`${root}/${file}`)) {
    try {
      return JSON.parse(fs.readFileSync(`${root}/${file}`, 'utf8'))
    } catch (e) {
      logger.error(e)
    }
  }
  return {}
}
