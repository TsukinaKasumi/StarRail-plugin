import MysApi from '../../genshin/model/mys/mysApi.js'
import md5 from 'md5'
import _ from 'lodash'
import crypto from 'crypto'
import SRApiTool from "./SRApiTool.js";
const DEVICE_ID = randomString(32).toUpperCase()
const DEVICE_NAME = randomString(_.random(1, 10))
export default class MysSRApi extends MysApi {
  constructor (uid, cookie, option = {}) {
    super(uid, cookie, option, true)
    this.uid = uid
    this.server = 'prod_gf_cn'
    // this.isSr = true
    // this.server = 'hkrpg_cn'
    this.apiTool = new SRApiTool(uid, this.server)
  }

  getUrl (type, data = {}) {
    let urlMap = this.apiTool.getUrlMap(data)
    if (!urlMap[type]) return false
    let { url, query = '', body = '', noDs = false, dsSalt = '' } = urlMap[type]
    if (query) url += `?${query}`
    if (body) body = JSON.stringify(body)

    let headers = this.getHeaders(query, body)
    if (data.deviceFp) {
      headers['x-rpc-device_fp'] = data.deviceFp
      // 兼容喵崽
      this._device_fp = { data: { device_fp: data.deviceFp } }
    }
    if (typeof this.cookie == 'string') {
      headers.cookie = this.cookie
    } else if (this.cookie) {
      let cookie = this.cookie[Object.keys(this.cookie).filter(k => this.cookie[k].ck)[0]]
      this.cookie = cookie?.ck
      headers.cookie = cookie?.ck
      this.deviceId = cookie?.device_id
    }
    if (!this.deviceId) {
      this.deviceId = crypto.randomUUID()
    }
    if (this.deviceId) {
      headers['x-rpc-device_id'] = this.deviceId
    }
    switch (dsSalt) {
      case 'web': {
        headers.DS = this.getDS2()
        break
      }
      case 'x6': {
        headers.DS = this.getDsX6(query, body)
        break
      }
      default:
    }
    if (type === 'srPayAuthKey') {
      let extra = {
        'x-rpc-app_version': '2.40.1',
        'User-Agent': 'okhttp/4.8.0',
        'x-rpc-client_type': '5',
        Referer: 'https://app.mihoyo.com',
        Origin: 'https://webstatic.mihoyo.com',
        // Cookie: this.cookies,
        // DS: this.getDS2(),
        'x-rpc-sys_version': '12',
        'x-rpc-channel': 'mihoyo',
        'x-rpc-device_id': DEVICE_ID,
        'x-rpc-device_name': DEVICE_NAME,
        'x-rpc-device_model': 'Mi 10',
        Host: 'api-takumi.mihoyo.com'
      }
      headers = Object.assign(headers, extra)
    } else {
      headers.DS = this.getDs(query, body)
    }
    if (noDs) {
      delete headers.DS
      if (this.deviceId) {
        body = JSON.parse(body)
        body.device_id = this.deviceId
        body = JSON.stringify(body)
      }
    }
    return { url, headers, body }
  }

  getDs (q = '', b = '') {
    let n = ''
    if (['prod_gf_cn'].includes(this.server)) {
      n = 'xV8v4Qu54lUKrEYFZkJhB8cuOh9Asafs'
    } else if (['os_usa', 'os_euro', 'os_asia', 'os_cht'].includes(this.server)) {
      n = 'okr4obncj8bw5a65hbnn5oo6ixjc3l9w'
    }
    let t = Math.round(new Date().getTime() / 1000)
    let r = Math.floor(Math.random() * 90000 + 10000)
    let DS = md5(`salt=${n}&t=${t}&r=1${r}&b=${b}&q=${q}`)
    return `${t},1${r},${DS}`
  }

  getDS2 () {
    let t = Math.round(new Date().getTime() / 1000)
    let r = randomString(6)
    let sign = md5(`salt=jEpJb9rRARU2rXDA9qYbZ3selxkuct9a&t=${t}&r=${r}`)
    return `${t},${r},${sign}`
  }

  async getDsX6 (q = '', b = '') {
    let salt
    try {
      let mysTool = await import('../../xiaoyao-cvs-plugin/model/mys/mysTool.js')
      salt = mysTool.default.salt2
    } catch (e) {
      throw new Error('需要安装逍遥插件使用此功能')
    }
    let t = Math.round(new Date().getTime() / 1000)
    let r = Math.floor(Math.random() * 900000 + 100000)
    let DS = md5(`salt=${salt}&t=${t}&r=${r}&b=${b}&q=${q}`)
    return `${t},${r},${DS}`
  }

  getHeaders (query = '', body = '') {
    const cn = {
      app_version: '2.44.1',
      User_Agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) miHoYoBBS/2.44.1',
      client_type: '5',
      Origin: 'https://webstatic.mihoyo.com',
      X_Requested_With: 'com.mihoyo.hyperion',
      Referer: 'https://webstatic.mihoyo.com/'
    }
    const os = {
      app_version: '2.9.0',
      User_Agent: `Mozilla/5.0 (Linux; Android 12; ${this.device}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.73 Mobile Safari/537.36 miHoYoBBSOversea/2.9.0`,
      client_type: '2',
      Origin: 'https://webstatic-sea.hoyolab.com',
      X_Requested_With: 'com.mihoyo.hoyolab',
      Referer: 'https://webstatic-sea.hoyolab.com'
    }
    let client
    if (this.server.startsWith('os')) {
      client = os
    } else {
      client = cn
    }
    return {
      'x-rpc-app_version': client.app_version,
      'x-rpc-client_type': client.client_type,
      // 'x-rpc-page': '3.1.3_#/rpg',
      'User-Agent': client.User_Agent,
      Referer: client.Referer,
      DS: this.getDs(query, body),
      Origin: client.Origin
    }
  }

  /**
   * 校验状态码
   * @param e 消息e
   * @param res 请求返回
   * @param type 请求类型 如 srNote
   * @param data 查询请求的数据
   * @returns {Promise<*|boolean>}
   */
  async checkCode (e, res, type, data) {
    if (!res || !e) {
      this.e.reply('米游社接口请求失败，暂时无法查询')
      return false
    }
    this.e = e
    this.e.isSr = true
    res.retcode = Number(res.retcode)
    switch (res.retcode) {
      case 0:
        break
      case 1034: {
        let handler = this.e.runtime?.handler || {}

        // 如果有注册的mys.req.err，调用
        if (handler.has('mys.req.err')) {
          logger.mark(`[米游社sr查询失败][uid:${this.uid}][qq:${this.userId}] 遇到验证码，尝试调用 Handler mys.req.err`)
          res = await handler.call('mys.req.err', this.e, { mysApi: this, type, res, data, mysInfo: this }) || res
        }
        if (!res || res?.retcode === 1034) {
          logger.mark(`[米游社查询失败][uid:${this.uid}][qq:${this.userId}] 遇到验证码`)
          this.e.reply('米游社查询遇到验证码，请稍后再试')
        }
        break
      }
      default:
        if (/(登录|login)/i.test(res.message)) {
          logger.mark(`[ck失效][uid:${this.uid}]`)
          this.e.reply(`UID:${this.uid}，米游社cookie已失效`)
        } else {
          this.e.reply(`米游社接口报错，暂时无法查询：${res.message || 'error'}`)
        }
        break
    }
    if (res.retcode !== 0) {
      logger.mark(`[米游社sr接口报错]${JSON.stringify(res)}，uid：${this.uid}`)
    }
    return res
  }
}

export function randomString (length) {
  let randomStr = ''
  for (let i = 0; i < length; i++) {
    randomStr += _.sample('abcdefghijklmnopqrstuvwxyz0123456789')
  }
  return randomStr
}

export function generateSeed (length = 16) {
  const characters = '0123456789abcdef'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += characters[Math.floor(Math.random() * characters.length)]
  }
  return result
}
