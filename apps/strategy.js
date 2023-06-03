import plugin from '../../../lib/plugins/plugin.js'
import common from '../../../lib/common/common.js'
import _ from 'lodash'
import fs from 'node:fs'
import fetch from 'node-fetch'
import { rulePrefix } from '../utils/common.js'

const roleAlias = {
  阿兰: ['Alan', '阿郎', '阿蓝', 'Arlan'],
  艾丝妲: ['爱思达', '爱丝妲', '爱思妲', '爱丝达', '艾思达', '艾思妲', '艾丝达', '富婆', 'Asta'],
  白露: ['龙女', '小龙女', '白鹭', '白鹿', '白麓', 'Bailu'],
  布洛妮娅: ['布诺妮亚', '布洛妮亚', '布诺妮娅', '布洛尼亚', '鸭鸭', '大鸭鸭', 'Bronya'],
  丹恒: ['单恒', '单垣', '丹垣', '丹桁', '冷面小青龙', 'DanHeng'],
  黑塔: ['人偶', '转圈圈', 'Herta'],
  虎克: ['胡克', 'Hook'],
  姬子: ['机子', '寄子', 'Himeko'],
  杰帕德: ['杰哥', 'Gepard'],
  景元: ['JingYuan'],
  开拓者_存护: ['火爷', '火主', '开拓者存护', '火开拓者'],
  开拓者_毁灭: ['物理爷', '物爷', '物理主', '物主', '开拓者毁灭', '岩开拓者'],
  克拉拉: ['可拉拉', '史瓦罗', 'Clara'],
  娜塔莎: ['那塔莎', '那塔沙', '娜塔沙', 'Natasha', '渡鸦'],
  佩拉: ['配拉', '佩啦', '冰砂糖', 'Pela'],
  青雀: ['青却', '卿雀', 'Qingque'],
  三月七: ['三月', '看板娘', '三七', '三祁', '纠缠之缘', 'March7th', '37'],
  桑博: ['Sampo'],
  素裳: ['李素裳', 'Sushang'],
  停云: ['停运', '听云', 'Tingyun'],
  瓦尔特: ['杨叔', '老杨', 'Welt'],
  希儿: ['希尔', 'Seele'],
  希露瓦: ['希录瓦', 'Serval'],
  彦卿: ['言情', '彦情', '彦青', '言卿', '燕青', 'Yanqing']
}

export class strategy extends plugin {
  constructor () {
    super({
      name: '米游社星铁攻略',
      dsc: '米游社星铁攻略图',
      event: 'message',
      priority: 1,
      rule: [
        {
          reg: `^${rulePrefix}?(更新)?\\S+攻略([1-4])?$`,
          fnc: 'strategy'
        },
        {
          reg: `^${rulePrefix}攻略(说明|帮助)?$`,
          fnc: 'strategy_help'
        }
        // {
        //   reg: '^#?设置默认攻略([1-4])?$', // 待添加
        //   fnc: 'strategy_setting'
        // }
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
    let reg = new RegExp(`^${rulePrefix}?(更新)?(\\S+)攻略([1-4])?$`)
    let [,,,, isUpdate, roleName, group = 1] = this.e.msg.match(reg)
    let role = this.getRole(roleName)

    if (!role) return false

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
      '攻略帮助:\n',
      '#希儿攻略[123]\n',
      '#更新希儿攻略[123]\n',
      '#设置默认攻略[123]\n',
      '示例: 希儿攻略3\n',
      '\n攻略来源:\n',
      '1——初始镜像\n',
      '2——小橙子阿\n',
      '3——星穷中心'
    ])
  }

  /** #设置默认攻略1 */
  async strategy_setting () {
    let match = /^#?设置默认攻略([1-4])?$/.exec(this.e.msg)
    let set = './plugins/genshin/config/mys.set.yaml'
    let config = fs.readFileSync(set, 'utf8')
    let num = Number(match[1])
    if (isNaN(num)) {
      await this.e.reply('默认攻略设置方式为: \n#设置默认攻略[1234] \n 请增加数字1-4其中一个')
      return
    }
    config = config.replace(/defaultSource: [1-4]/g, 'defaultSource: ' + num)
    fs.writeFileSync(set, config, 'utf8')

    await this.e.reply('默认攻略已设置为: ' + match[1])
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
    let [_name, type] = name.split('_')
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
        let max = 0
        image_list.forEach((v, i) => {
          if ((group == 0 && i == 0) || (group == 1 && _name == '开拓者')) {
            max = 1
            return
          }
          if (Number(v.size) >= Number(image_list[max].size)) {
            max = i
          }
        })
        url = image_list[max].url
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

  getRole (roleName) {
    for (const i in roleAlias) {
      if (roleName === i) {
        return i
      } else if (roleAlias[i].includes(roleName)) {
        return i
      }
    }
    return false
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
