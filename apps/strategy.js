import _ from 'lodash'
import fetch from 'node-fetch'
import fs from 'node:fs'
import common from '../../../lib/common/common.js'
import plugin from '../../../lib/plugins/plugin.js'
import alias from '../utils/alias.js'
import { ForwardMsg, rulePrefix} from '../utils/common.js'
import setting from '../utils/setting.js'
// 最大攻略数量
let maxNum = 6

export class strategy extends plugin {
  constructor () {
    super({
      name: '米游社星铁攻略',
      dsc: '米游社星铁攻略图',
      event: 'message',
      priority: 1,
      rule: [
        {
          reg: `^${rulePrefix}?(更新)?\\S+攻略([0-${maxNum}])?$`,
          fnc: 'strategy'
        },
        {
          reg: `^${rulePrefix}攻略(说明|帮助)$`,
          fnc: 'strategy_help'
        },
        {
          reg: `^${rulePrefix}设置默认攻略([0-${maxNum}])?$`,
          fnc: 'strategy_setting'
        }
      ]
    })

    this.path = './plugins/StarRail-plugin/temp/strategy'

    this.url = 'https://bbs-api.mihoyo.com/post/wapi/getPostFullInCollection?&gids=6&order_type=2&collection_id='
    this.collection_id = [
      // 来源：初始镜像
      [1996095],
      // 来源：小橙子阿
      [1998643],
      // 来源：星穹中心
      [2029394, 2009142, 2038092]
    ]

    this.source = ['初始镜像', '小橙子阿', '星穹中心']

    this.oss = '?x-oss-process=image//resize,s_1200/quality,q_90/auto-orient,0/interlace,1/format,jpg'
  }

  /** 初始化创建配置文件 */
  async init () {
    if (!fs.existsSync(this.path)) {
      fs.mkdirSync(this.path, { recursive: true })
    }
    /** 初始化子目录 */
    for (let subId of [1, 2, 3]) {
      let path = this.path + '/' + subId
      if (!fs.existsSync(path)) {
        fs.mkdirSync(path)
      }
    }
  }

  /** #心海攻略 */
  async strategy () {
    let reg = new RegExp(`^${rulePrefix}?(更新)?(\\S+)攻略([0-${maxNum}])?$`)
    let [, , , , isUpdate, roleName,
      group = setting.getConfig('mys')?.defaultSource
    ] = this.e.msg.match(reg)
    let role = alias.get(roleName)

    if (!role) return false

    if (group === 0) {
      // eslint-disable-next-line no-unused-vars
      let msg = []
      // eslint-disable-next-line no-unused-vars
      for (let i = 1; i <= maxNum; i++) {
        this.sfPath = `${this.path}/${i}/${role}.jpg`
        if (fs.existsSync(this.sfPath) && !isUpdate) {
          msg.push(segment.image(`file://${this.sfPath}`))
          continue
        }
        if (i < 4 && await this.getImg(role, i)) {
          msg.push(segment.image(`file://${this.sfPath}`))
        }
      }
      await ForwardMsg(this.e, msg)
      return
    }
    this.sfPath = `${this.path}/${group}/${role}.jpg`

    if (fs.existsSync(this.sfPath) && !isUpdate) {
      await this.e.reply(segment.image(`file://${this.sfPath}`))
      return
    }

    if (await this.getImg(role, group)) {
      await this.e.reply(segment.image(`file://${this.sfPath}`))
    }
  }

  /** #攻略帮助 */
  async strategy_help () {
    await this.e.reply([
      '星铁攻略帮助:\n',
      '*希儿攻略[0123456]\n',
      '*更新希儿攻略[0123456]\n',
      '*设置默认攻略[0123456]\n',
      '示例: *希儿攻略2\n',
      '\n攻略来源:\n',
      '1——初始镜像\n',
      '2——小橙子阿\n',
      '3——星穹中心\n',
      '4——水云109\n',
      '5——幻仙十六\n',
      '6——HoYo青枫\n',
    ])
  }

  /** #设置默认攻略1 */
  async strategy_setting () {
    let newREG = new RegExp('设置默认攻略([0-' + maxNum + '])?$', 'g')
    let match = newREG.exec(this.e.msg)
    let set = './plugins/StarRail-plugin/config/mys.yaml'
    let config = fs.readFileSync(set, 'utf8')
    let num = Number(match[1])
    if (isNaN(num)) {
      await this.e.reply(`星铁默认攻略设置方式为: \n*设置默认攻略[0123456] \n 请增加数字0-${maxNum}其中一个`)
      return
    }
    newREG = new RegExp('defaultSource: [0-' + maxNum + ']', 'g')
    config = config.replace(newREG, 'defaultSource: ' + num)
    fs.writeFileSync(set, config, 'utf8')

    await this.e.reply('星铁默认攻略已设置为: ' + match[1])
  }

  /** 下载攻略图 */
  async getImg (name, group) {
    group--
    let msyRes = []
    this.collection_id[group].forEach((id) => msyRes.push(this.getData(this.url + id)))

    try {
      msyRes = await Promise.all(msyRes)
    } catch (error) {
      this.e.reply('暂无攻略数据，请稍后再试')
      logger.error(`米游社接口报错：${error}}`)
      return false
    }

    let posts = _.flatten(_.map(msyRes, (item) => item.data.posts))
    let url
    // 开拓者特殊匹配
    let [_name, type] = name.split('·')
    for (let val of posts) {
      let { post: { subject }, image_list } = val
      if (
        subject.includes(name) ||
        (
          _name == '开拓者' &&
          subject.includes(_name) &&
          subject.includes(type)
        )
      ) {
        url = _.maxBy(image_list, (v) => v.height).url
        break
      }
    }

    if (!url) {
      this.e.reply(`暂无${name}攻略（${this.source[group]}）\n请尝试其他的攻略来源查询\n*攻略帮助，查看说明`)
      return false
    }

    logger.mark(`${this.e.logFnc} 下载星铁${name}攻略图`)

    if (!await common.downFile(url + this.oss, this.sfPath)) {
      return false
    }

    logger.mark(`${this.e.logFnc} 下载星铁${name}攻略成功`)

    return true
  }

  /** 获取数据 */
  async getData (url) {
    let response = await fetch(url, { method: 'get' })
    if (!response.ok) {
      return false
    }
    const res = await response.json()
    return res
  }
}
