import plugin from '../../../lib/plugins/plugin.js'
import common from '../../../lib/common/common.js'
import { rulePrefix } from '../utils/common.js'
import fetch from 'node-fetch'
import lodash from 'lodash'

export class exchange extends plugin {
 constructor(e) {
 super({
 name: '星铁plugin兑换码',
  dsc: '星穹铁道直播兑换码',
   event: 'message',
   priority: -100000,
   rule: [
   {
   reg: /^(#|\*)?(星铁|崩铁)?(直播|前瞻)?兑换码$/,
   fnc: 'getCode'
   }
  ]
  }  )
   }

  async getCode() {
    let reg = this.e.msg.match(/^(#|\*)?(星铁|崩铁)?(直播|前瞻)?兑换码$/)
    let game = 'srActId'
    if (reg[1] == '*' || ["星铁", "崩铁"].includes(reg[2])) {
    game = 'srActId'
    }
    this.code_ver = ''
    this.now = parseInt(Date.now() / 1000)
    let actid = await this.getActId(game)
    if (!actid) return
    this.actId = actid

 /** index info */
   let index = await this.getData('index')
   if (!index || !index.data) return
   if (index.data === null) {
   return await this.reply(`错误：\n${index.message}`)
   }
     
    let index_data = index.data.live;
    let title = index_data['title'];
    this.code_ver = index_data['code_ver'];
    if (index_data.remain > 0) {
    return await this.reply(`暂无直播兑换码\n${title}`)
   }

    let code = await this.getData('code')
    if (!code || !code.data?.code_list) return
    let codes = [];

 for (let val of code.data.code_list) {
 if (val.code){
    codes.push(val.code)
  }
 }

   let msg = ''
   if (codes.length >= 3) {
    msg = [`${title}-直播兑换码`, `兑换码存在有效期，请及时兑换哦~`, ...codes]
    msg = await common.makeForwardMsg(this.e, msg, msg[0])
    } else if (this.e.msg.includes('#')) {
    msg += codes.join('\n')
    } else {
    msg = `${title}-直播兑换码\n`
    msg += codes.join('\n')
    }

   await this.reply(msg)
  }

  async getData(type) {
    let url = {
      index: `https://api-takumi.mihoyo.com/event/miyolive/index`,
      code: `https://api-takumi-static.mihoyo.com/event/miyolive/refreshCode?version=${this.code_ver}&time=${this.now}`,
      srActId: "https://bbs-api.mihoyo.com/painter/api/user_instant/list?offset=0&size=20&uid=288909600",
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

  async getActId(game) {
    // 获取 "act_id"
    let ret = await this.getData(game)
    if (ret.error || ret.retcode !== 0) {
      return "";
    }

    let actId = "";
    for (const p of ret.data.list) {
      const post = p.post.post;
      if (!post) {
        continue;
      }
    let structured_content = post.structured_content

    let result = structured_content.match(/{\"link\":\"https:\/\/webstatic.mihoyo.com\/bbs\/event\/live\/index.html\?act_id=(.*?)\\/)
    if (result) {
        actId = result[1]
    }
      if (actId) {
        break;
      }
    }

    return actId;
  }
}
