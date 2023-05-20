import setting from './utils/setting.js'
import lodash from 'lodash'
import { pluginResources } from './utils/path.js'
import path from 'path'

// 支持锅巴
export function supportGuoba () {
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
      iconPath: path.join(pluginResources, 'common/cont/pamu.png')
    },
    // 配置项信息
    configInfo: {
      // 配置项 schemas
      schemas: [{
        field: 'gachaHelp.noteFlag',
        label: '体力',
        bottomHelpMessage: '是否使用本插件的体力模板',
        component: 'Switch'
      },
      {
        component: 'Divider',
        label: '帮助设置'
      },
      {
        field: 'gachaHelp.docs',
        label: '星铁抽卡教程链接',
        bottomHelpMessage: '发送出来的教程链接',
        component: 'Input',
        required: true,
        componentProps: {
          placeholder: '请输入链接',
        }
      },
      {
        field: 'cookieHelp.docs',
        label: 'Cookie帮助所发送内容',
        bottomHelpMessage: '发送出来的Cookie帮助',
        component: 'Input',
        required: true,
        componentProps: {
          placeholder: 'Cookie帮助',
        }
      },
      {
        component: 'Divider',
        label: '面板设置'
      },
      {
        field: 'PanelSetting.originalPic',
        label: '面板原图',
        bottomHelpMessage: '是否开启面板原图开关',
        component: 'Switch'
      },
      {
        field: 'PanelSetting.backCalloriginalPic',
        label: '原图撤回',
        bottomHelpMessage: '是否开启原图撤回开关',
        component: 'Switch'
      },
      {
        field: 'PanelSetting.backCalloriginalPicTime',
        label: '撤回时间',
        bottomHelpMessage: '原图撤回时间',
        component: 'InputNumber',
        required: true,
        componentProps: {
          min: 0,
          max: 10000,
          placeholder: '请输入数字'
        }
      },
      {
        component: 'Divider',
        label: '抽卡设置'
      },
      {
        field: 'gccfg.limit.group',
        label: '群聊抽卡',
        bottomHelpMessage: '是否允许群聊抽卡',
        component: 'Switch'
      },
      {
        field: 'gccfg.limit.private',
        label: '私聊抽卡',
        bottomHelpMessage: '是否允许私聊抽卡',
        component: 'Switch'
      },
      {
        field: 'gccfg.limit.count',
        label: '抽卡次数',
        bottomHelpMessage: '限制抽卡次数,0为无限制',
        component: 'InputNumber',
        required: true,
        componentProps: {
          min: 0,
          max: 10000,
          placeholder: '请输入数量'
        }
      },
      {
        field: 'gccfg.recall.enable',
        label: '自动撤回',
        bottomHelpMessage: '是否自动撤回无五星的消息',
        component: 'Switch'
      },
      {
        field: 'gccfg.recall.time',
        label: '撤回时间',
        bottomHelpMessage: '自动撤回无五星消息的时间',
        component: 'InputNumber',
        required: true,
        componentProps: {
          min: 0,
          max: 10000,
          placeholder: '请输入数字'
        }
      },
    ],

      getConfigData () {
        return setting.merge()
      },
      // 设置配置的方法（前端点确定后调用的方法）
      setConfigData (data, { Result }) {
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
