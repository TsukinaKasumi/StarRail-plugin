/**
 * 请注意，系统不会读取help_default.js ！！！！
 * 【请勿直接修改此文件，且可能导致后续冲突】
 *
 * 如需自定义可将文件【复制】一份，并重命名为 help.js
 *
 * */

export const helpCfg = {
  title: '星铁帮助',
  subTitle: 'Yunzai-Bot & StarRail-plugin',
  columnCount: 3,
  colWidth: 275,
  theme: 'all',
  themeExclude: ['default'],
  style: {
    fontColor: '#ceb78b',
    descColor: '#eee',
    contBgColor: 'rgba(6, 21, 31, .5)',
    contBgBlur: 3,
    headerBgColor: 'rgba(6, 21, 31, .4)',
    rowBgColor1: 'rgba(6, 21, 31, .2)',
    rowBgColor2: 'rgba(6, 21, 31, .35)'
  }
}

export const helpList = [
  {
    group: '星铁角色信息(支持#星铁,*前缀)',
    list: [
      {
        icon: 78,
        title: '*绑定uid(uid)',
        desc: '绑定你的星铁uid'
      }, {
        icon: 63,
        title: '*更新面板(uid)',
        desc: '更新星铁面板数据'
      }, {
        icon: 66,
        title: '*希儿面板(uid)',
        desc: '星铁角色面板详情'
      }, {
        icon: 107,
        title: '*(上期)宇宙(uid)',
        desc: '模拟宇宙信息(可带uid查询)'
      }, {
        icon: 107,
        title: '*寰宇蝗灾',
        desc: '模拟宇宙寰宇蝗灾信息'
      }, {
        icon: 98,
        title: '*收入',
        desc: '月度星琼统计'
      }, {
        icon: 95,
        title: '*体力',
        desc: '体力和委托信息'
      }, {
        icon: 75,
        title: '*卡片',
        desc: '角色卡片(仅支持绑定ck查询)'
      }, {
        icon: 110,
        title: '*(上期|本期)?(简易)?忘却',
        desc: '忘却之庭信息'
      }, {
        icon: 110,
        title: '*(上期|本期)?(简易)?虚构',
        desc: '虚构叙事信息'
      }, {
        icon: 110,
        title: '*(上期|本期)?(简易)?末日',
        desc: '末日幻影信息'
      }, {
        icon: 110,
        title: '*(上期|本期)?(简易)?异相',
        desc: '异相仲裁信息'
      }, {
        icon: 110,
        title: '*(上期|本期)?(简易)?深渊',
        desc: '全部深渊信息'
      }, {
        icon: 110,
        title: '*(最新|当期)(简易)?深渊',
        desc: '当期深渊信息'
      }, {
        icon: 91,
        title: '*在线时长',
        desc: '根据体力数据统计在线时长'
      }, {
        icon: 97,
        title: '*抽卡帮助',
        desc: '绑定抽卡链接教程'
      }, {
        icon: 97,
        title: '*抽卡链接',
        desc: '绑定星铁抽卡链接'
      }, {
        icon: 97,
        title: '*更新跃迁/抽卡',
        desc: '更新本地抽卡记录'
      }, {
        icon: 97,
        title: '*跃迁分析(角色|光锥|常驻)',
        desc: '抽卡分析默认为总览'
      }
    ]
  }, {
    group: '星穹铁道攻略信息,来自米游社(数据仅供参考)',
    list: [
      {
        icon: 106,
        title: '*希儿攻略(0 | 1 | 2 | 3 | 4 |5)',
        desc: '星铁角色攻略'
      }, {
        icon: 106,
        title: '*攻略',
        desc: '星铁全角色攻略'
      }, {
        icon: 100,
        title: '*抽卡(角色|常驻|光锥)',
        desc: '模拟星穹铁道抽卡'
      }, {
        icon: 96,
        title: '*兑换码',
        desc: '星铁前瞻直播兑换码'
      }, {
        icon: 98,
        title: '*预估',
        desc: '预估当前版本或下版本星琼'
      }, {
        icon: 104,
        title: '*xx参考面板(帮助)',
        desc: '星铁角色参考面板(帮助)'
      }, {
        icon: 111,
        title: '*强度榜',
        desc: '星铁角色强度榜(仅供参考)'
      }, {
        icon: 99,
        title: '*收益曲线',
        desc: '星铁各属性收益曲线(仅供参考)'
      }, {
        icon: 102,
        title: '*商店光锥推荐',
        desc: '跃迁商店推荐兑换光锥(仅供参考)'
      }, {
        icon: 108,
        title: '*深渊攻略',
        desc: '模拟宇宙阵容推荐(仅供参考)'
      }
    ]
  }, {
    group: '插件管理,仅管理员可用',
    auth: 'master',
    list: [{
      icon: 85,
      title: '*(强制)更新',
      desc: '(强制)更新星铁插件'
    }, {
      icon: 85,
      title: '*更新日志',
      desc: '星铁插件更新日志'
    }, {
      icon: 85,
      title: '*切换面板(1 | 2 | 3)',
      desc: '切换面板服务'
    }, {
      icon: 85,
      title: '*(强制)图像更新(github)',
      desc: '安装扩展图，需要一定时间，请勿重复执行'
    }, {
      icon: 85,
      title: '*设置默认攻略(0 | 1 | 2 | 3 | 4 |5)',
      desc: '设置星铁默认攻略'
    }, {
      icon: 85,
      title: '#(喵喵|星铁)插件面板(开启|关闭)',
      desc: '各自插件面板开关'
    }, {
      icon: 85,
      title: '*插件面板状态',
      desc: '查看喵喵与星铁插件面板状态'
    }
    ]
  }
]