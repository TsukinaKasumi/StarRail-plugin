import setting from "./utils/setting.js";
import lodash from "lodash";
import { pluginResources } from "./utils/path.js";
import path from 'path'

// 支持锅巴
export function supportGuoba() {
  return {
    pluginInfo: {
      name: 'StarRail-plugin',
      title: '星穹铁道插件',
      author: '@鹤望兰',
      authorLink: 'https://gitee.com/hewang1an',
      link: 'https://gitee.com/hewang1an/StarRail-plugin',
      isV3: true,
      isV2: false,
      description: '提供崩坏星穹铁道相关查询功能',
      icon: 'bi:box-seam',
      iconColor: '#7ed99e',
      iconPath: path.join(pluginResources, 'card/pamu.png'),
    },
    // 配置项信息
    configInfo: {
      // 配置项 schemas
      schemas: [{
        field: 'gachaHelp.docs',
        label: '星铁抽卡教程链接',
        bottomHelpMessage: '发送出来的教程链接',
        component: 'Input',
        required: true,
        componentProps: {
          placeholder: '请输入链接',
        }
      }
    ],

      getConfigData() {
        return setting.merge()
      },
      // 设置配置的方法（前端点确定后调用的方法）
      setConfigData(data, { Result }) {
        let config = {}
        for (let [keyPath, value] of Object.entries(data)) {
          lodash.set(config, keyPath, value)
        }
        config = lodash.merge({}, setting.merge, config)
        setting.analysis(config)
        return Result.ok({}, '保存成功~')
      }
    }
  }
}
