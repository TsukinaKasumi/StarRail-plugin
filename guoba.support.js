import setting from './utils/setting.js'
import lodash from 'lodash'
import { pluginResources } from './utils/path.js'
import path from 'path'

// 支持锅巴
export function supportGuoba () {
  let allGroup = []
  Bot.gl.forEach((v, k) => { allGroup.push({ label: `${v.group_name}(${k})`, value: k }) })
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
        component: 'Divider',
        label: '通用设置'
      },
      {
        field: 'gachaHelp.noteFlag',
        label: '体力',
        bottomHelpMessage: '是否使用本插件的体力模板',
        component: 'Switch'
      },
      {
        field: 'gachaHelp.renderScale',
        label: '渲染精度',
        bottomHelpMessage: '设置插件的渲染精度，可选值50~200，建议100。设置高精度会提高图片的精细度，但因图片较大可能会影响渲染与发送速度',
        component: 'InputNumber',
        required: true,
        componentProps: {
          min: 50,
          max: 200,
          placeholder: '请输入数字'
        }
      },
      {
        field: 'gachaHelp.gatchaUrlGroup',
        label: '抽卡链接群聊绑定',
        bottomHelpMessage: '是否允许在群内绑定抽卡链接',
        component: 'Switch'
      },
      {
        field: 'gachaHelp.abbrSetAuth',
        label: '角色别名管理权限',
        bottomHelpMessage: '# 别名设置权限 0-所有群员都可以添加 1-群管理员才能添加 2-主人才能添加',
        component: 'InputNumber',
        required: true,
        componentProps: {
          min: 0,
          max: 2,
          placeholder: '请输入0-2数字'
        }
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
          placeholder: '请输入链接'
        }
      },
      {
        field: 'cookieHelp.docs',
        label: 'Cookie帮助',
        bottomHelpMessage: '发送出来的Cookie帮助',
        component: 'Input',
        required: true,
        componentProps: {
          placeholder: 'Cookie帮助'
        }
      },
      {
        component: 'Divider',
        label: '面板设置'
      },
      {
        field: 'PanelSetting.no_profile',
        label: '禁用群号',
        bottomHelpMessage: '禁用第三方面板图功能的群',
        component: 'Select',
        componentProps: {
          allowAdd: true,
          allowDel: true,
          mode: 'multiple',
          options: allGroup
        }
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
          placeholder: '请输入数字',
          addonAfter: '秒'
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
          placeholder: '请输入数量',
          addonAfter: '次'
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
          placeholder: '请输入数字',
          addonAfter: '秒'
        }
      },
      {
        field: 'gccfg.disable_group',
        label: '禁用群号',
        bottomHelpMessage: '禁用抽卡功能的群',
        component: 'Select',
        componentProps: {
          allowAdd: true,
          allowDel: true,
          mode: 'multiple',
          options: allGroup
        }
      },
      {
        component: 'Divider',
        label: '攻略设置'
      },
      {
        field: 'mys.defaultSource',
        label: '攻略图默认来源',
        bottomHelpMessage: '米游社攻略图默认来源设置',
        component: 'InputNumber',
        required: true,
        componentProps: {
          min: 1,
          max: 6,
          placeholder: '请输入数字'
        }
      }
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
