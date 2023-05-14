import YAML from 'yaml';
import fs from 'fs';
import { pluginRoot } from '../utils/path.js';

export async function findName(name) {
  // 读取角色文件
  try {
    const nameList =
      YAML.parse(fs.readFileSync(pluginRoot + '/config/alias.yaml', 'utf8')) ||
      {};
    if (name in nameList) return name;
    let roleName = null;
    Object.keys(nameList).forEach(value => {
      const alias = nameList[value];
      if (alias.includes(name)) {
        roleName = value;
      }
    });
    if (roleName) return roleName;
    else return Promise.reject('未找到角色');
  } catch (error) {
    return Promise.reject(error);
  }
}
