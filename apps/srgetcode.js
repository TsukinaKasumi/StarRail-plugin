import plugin from '../../../lib/plugins/plugin.js'
import common from '../../../lib/common/common.js'
import { rulePrefix } from '../utils/common.js'
import fetch from 'node-fetch'
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
    let actid = await this.getActId()
    if (!actid) return false
    this.actId = actid

    /** index info */
    let index = await this.getData('index')
    logger.debug(index)
    if (!index) return false
    if (index.retcode != 0) {
      return await this.reply(`错误：${index.message}`)
    }

    let { title, code_ver, remain } = index.data.live
    this.code_ver = code_ver
    if (remain > 0) {
      return await this.reply(`暂无直播兑换码\n${title}`)
    }

    let code = await this.getData('code')
    if (!code || !code.data?.code_list) return false
    let codes = []

    for (let val of code.data.code_list) {
      if (val.code) {
        codes.push(val.code)
      }
    }

    let msg = ''
    if (codes.length >= 3) {
      msg = [`${title}-直播兑换码`, '兑换码存在有效期，请及时兑换哦~', `兑换码过期时间: \n${this.deadline}`, ...codes]
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
      index: 'https://api-takumi.mihoyo.com/event/miyolive/index',
      code: `https://api-takumi-static.mihoyo.com/event/miyolive/refreshCode?version=${this.code_ver}&time=${this.now}`,
      actId: 'https://bbs-api.mihoyo.com/painter/api/user_instant/list?offset=0&size=20&uid=288909600'
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

  async getActId () {
    // 获取 "act_id"
    let ret = await this.getData('actId')
    if (ret.error || ret.retcode !== 0) {
      return ''
    }

    for (const p of ret.data.list) {
      const post = p.post.post
      if (!post) {
        continue
      }
      let date = new Date(post.created_at * 1000)
      date.setDate(date.getDate() + 1)
      this.deadline = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} 12:00:00`
      let structured_content = post.structured_content

      let result = structured_content.match(/{"link":"https:\/\/webstatic.mihoyo.com\/bbs\/event\/live\/index.html\?act_id=(.*?)\\/)
      if (result) {
        return result[1]
      }
    }
  }
}
