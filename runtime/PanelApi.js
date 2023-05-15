import YAML from 'yaml';
import fs from 'fs';
import { pluginRoot } from '../utils/path.js';

export default async function panelApi() {
  // 读取配置文件
  try {
    const result = await isFileExisted(pluginRoot + '/config/panelApi.yaml');
    const defaultConfig = {
      default: 1,
      api: ['https://sr.roki.best/v1/info/'],
    };
    let config = defaultConfig;
    if (result) {
      config = YAML.parse(
        fs.readFileSync(pluginRoot + '/config/panelApi.yaml', 'utf8')
      );
    }
    if (!config || !('default' in config) || !('api' in config))
      return Promise.reject(
        '配置文件读取失败或者配置文件为空，请检查插件文件夹下的config/panelApi.yaml文件是否存在或者是否为空'
      );
    if (config.api.length === 0)
      return Promise.reject(
        '配置文件中没有配置api列表，请检查插件文件夹下的config/panelApi.yaml文件是否配置了api列表'
      );
    const defaultApi = parseInt(config.default);
    if (isNaN(defaultApi) || defaultApi < 1 || defaultApi > config.api.length)
      return Promise.reject(
        '配置文件中默认api的值不正确，请检查插件文件夹下的config/panelApi.yaml文件中的default值是否正确'
      );
    const api = config.api[defaultApi - 1];
    return api;
  } catch (error) {
    return Promise.reject(error);
  }
}
function isFileExisted(path) {
  return new Promise((resolve, reject) => {
    fs.access(path, err => {
      if (err) {
        resolve(false); //"不存在"
      } else {
        resolve(true); //"存在"
      }
    });
  });
}
