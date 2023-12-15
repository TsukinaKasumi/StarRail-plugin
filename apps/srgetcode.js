import plugin from '../../../lib/plugins/plugin.js'
import common from '../../../lib/common/common.js'
import { rulePrefix } from '../utils/common.js'
import fetch from 'node-fetch'
import cheerio from 'cheerio'

// import lodash from 'lodash'
export class srexchange extends plugin {
  constructor (e) {
    super({
      name: '星穹铁道兑换码',
      dsc: '前瞻直播兑换码',
      event: 'message',
      priority: 100,
      rule: [
        {
          reg: `^${rulePrefix}兑换码$`,
          fnc: 'srgetCode'
        }
      ]
    })
  }

  async srgetCode () {
    this.now = parseInt(Date.now() / 1000)
    await this.getactId()
    /** index info */
    let index = await this.getData('index')

    if (!index) return false
    if (index.retcode != 0) {
      return await this.reply(`错误：${index.message}`)
    }

    const html = index.data.content.contents?.[0]?.text
    // 使用cheerio加载HTML
    const $ = cheerio.load(html)
    const elements = $('td[data-colwidth="173"]')
    const title = index.data.content.title.replace('直播回顾', '')
    let deadline = $('span[style="font-size:13px"]')
    const dateFormatRegex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01]) (2[0-3]|[01][0-9]):([0-5][0-9])$/
    deadline = deadline
      .map((_, element) => $(element).text())
      .get()
      .find(d => dateFormatRegex.test(d))
    // const deadline = time_deadline.match(/(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2})/)[1];
    const codes = elements
      .map((_, element) => $(element).text())
      .get()
      .filter(c => c.length === 12)

    if (codes.length == 0) {
      return await this.reply(`暂无直播兑换码\n${title}`)
    }

    let msg = ''
    if (codes.length >= 3) {
      msg = [`${title}-直播兑换码`, '兑换码存在有效期，请及时兑换哦~', `兑换码过期时间: \n${deadline}`, ...codes]
      msg = await common.makeForwardMsg(this.e, msg, msg[0])
    } else if (this.e.msg.includes('#')) {
      msg += codes.join('\n')
    } else {
      msg = `${title}-直播兑换码\n`
      msg += codes.join('\n')
    }
    await this.reply(msg)
  }

  async getData (type) {
    let url = {
      index: `https://api-static.mihoyo.com/common/blackboard/sr_wiki/v1/content/info?app_sn=sr_wiki&content_id=${this.content_id}`,
      code: `https://api-takumi-static.mihoyo.com/event/miyolive/refreshCode?version=${this.code_ver}&time=${this.now}`,
      actId: 'https://api-static.mihoyo.com/common/blackboard/sr_wiki/v1/home/content/list?app_sn=sr_wiki&channel_id=47'
    }

    let response
    try {
      response = await fetch(url[type], {
        method: 'get',
        headers: {
          'x-rpc-act_id': this.actId
        }
      })
    } catch (error) {
      logger.error(error.toString())
      return false
    }

    if (!response.ok) {
      logger.error(`[兑换码接口错误][${type}] ${response.status} ${response.statusText}`)
      return false
    }
    const res = await response.json()
    return res
  }

  async getactId () {
    const actId = await this.getData('actId')
    if (!actId) return false
    if (actId.retcode != 0) {
      return await this.reply(`错误：${actId.message}`)
    }
    let actID_list = actId.data.list[0].children
    actID_list = actID_list.find(item => item.name == '前瞻节目回顾').list
    this.content_id = actID_list[0].content_id
  }
}
