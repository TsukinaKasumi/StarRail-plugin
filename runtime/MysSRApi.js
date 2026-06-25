import MysApi from '../../genshin/model/mys/mysApi.js'
import md5 from 'md5'
import _ from 'lodash'
import crypto from 'crypto'
import SRApiTool from './SRApiTool.js'
import getDeviceFp from './getDeviceFp.js'
// const DEVICE_ID = randomString(32).toUpperCase()
const DEVICE_NAME = randomString(_.random(1, 10))
export default class MysSRApi extends MysApi {
  constructor (uid, cookie, option = {}) {
    super(uid, cookie, option, true)
    this.uid = uid
    this.server = this.getServer()
    // this.isSr = true
    // this.server = 'hkrpg_cn'
    this.apiTool = new SRApiTool(uid, this.server)
    if (typeof this.cookie != 'string' && this.cookie) {
      let ck = this.cookie[Object.keys(this.cookie).filter(k => this.cookie[k].ck)[0]]
      this._device = ck?.device_id || ck?.device
      this.cookie = ck?.ck
    }
    if (!this._device) {
      this._device = crypto.randomUUID()
    }
  }

  getServer() {
    switch (String(this.uid).slice(0, -8)) {
      case '5':
        return 'prod_qd_cn' // B服
      case '6':
        return 'prod_official_usa' // 美服
      case '7':
        return 'prod_official_euro' // 欧服
      case '8':
      case '18':
        return 'prod_official_asia' // 亚服
      case '9':
        return 'prod_official_cht' // 港澳台服
    }
    return 'prod_gf_cn' // 官服
  }

  getUrl (type, data = {}) {
    let urlMap = this.apiTool.getUrlMap(data)
    if (!urlMap[type]) return false
    let { url, query = '', body = '', noDs = false, dsSalt = '' } = urlMap[type]
    if (query) url += `?${query}`
    if (body) body = JSON.stringify(body)

    let headers = this.getHeaders(query, body)
    // 如果有设备指纹，写入设备指纹
    if (data.deviceFp) {
      headers['x-rpc-device_fp'] = data.deviceFp
      // 兼容喵崽
      this._device_fp = { data: { device_fp: data.deviceFp } }
    }

    // 如果有设备ID，写入设备ID（传入的，这里是绑定设备方法1中的设备ID）
    if (data.deviceId) headers['x-rpc-device_id'] = data.deviceId

    // 如果有绑定设备信息，写入绑定设备信息，否则写入默认设备信息
    if (data?.deviceInfo && data?.modelName && data?.osVersion) {
      const osVersion = data.osVersion
      const modelName = data.modelName
      const deviceBrand = data.deviceInfo?.split('/')[0]
      const deviceDisplay = data.deviceInfo?.split('/')[3]
      try {
        headers['x-rpc-device_name'] = `${deviceBrand} ${modelName}`
        headers['x-rpc-device_model'] = modelName
        headers['x-rpc-csm_source'] = 'myself'
        // 国际服不需要绑定设备，故写入的'User-Agent'为国服
        headers['User-Agent'] = `Mozilla/5.0 (Linux; Android ${osVersion}; ${modelName} Build/${deviceDisplay}; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/111.0.5563.116 Mobile Safari/537.36 miHoYoBBS/2.73.1`
      } catch (error) {
        logger.error(`[starrail]设备信息解析失败：${error.message}`)
      }
    } else {
      try {
        headers['x-rpc-device_name'] = 'Sony XQ-BC52'
        headers['x-rpc-device_model'] = 'XQ-BC52'
        headers['x-rpc-csm_source'] = 'myself'
      } catch (error) {
        logger.error(`[starrail]设备信息解析失败：${error.message}`)
      }
    }

    if (type == 'deviceLogin' || type == 'saveDevice') {
      try {
        headers['x-rpc-sys_version'] = '12'
        headers['x-rpc-client_type'] = '2'
        headers['x-rpc-channel'] = 'miyousheluodi'
        headers['x-rpc-csm_source'] = 'home'
        headers['Host'] = 'bbs-api.miyoushe.com'
        headers['User-Agent'] = 'okhttp/4.9.3'
        headers['Referer'] = 'https://app.mihoyo.com/'
        headers['DS'] = this.getDS2()
      } catch (error) {
        logger.error(`[starrail]设备信息解析失败：${error.message}`)
      }
    }

    if (!data.deviceId) {
      headers['x-rpc-device_id'] = this._device
    }
    switch (dsSalt) {
      case 'web': {
        headers.DS = this.getDS2()
        break
      }
      default:
    }
    if (type === 'srPayAuthKey') {
      let extra = {
        'x-rpc-app_version': '2.73.1',
        'User-Agent': 'okhttp/4.9.3',
        'x-rpc-client_type': '2',
        Referer: 'https://act.mihoyo.com/',
        Origin: 'https://act.mihoyo.com',
        'x-rpc-sys_version': '12',
        'x-rpc-channel': 'miyousheluodi',
        'x-rpc-device_id': this._device,
        'x-rpc-device_name': 'XQ-BC52',
        'x-rpc-device_model': 'Sony XQ-BC52',
        Host: 'api-takumi.mihoyo.com'
      }
      headers = Object.assign(headers, extra)
    } else {
      headers.DS = this.getDs(query, body)
    }
    if (noDs) {
      delete headers.DS
      if (this._device) {
        body = JSON.parse(body)
        body.device_id = this._device
        body = JSON.stringify(body)
      }
    }
    return { url, headers, body }
  }


  async getData(type, data = { headers: {} }, cached = false) {
    const uid = this.uid
    const ck = this.cookie
    let ltuid = ck.match(/ltuid=(\d+)/)
    ltuid = ltuid[1]
    if (ltuid) {
      let bindInfo = await redis.get(`ZZZ:DEVICE_FP:${ltuid}:BIND`)
      if (bindInfo) {
        try {
          bindInfo = JSON.parse(bindInfo)
          data = {
            ...data,
            productName: bindInfo?.deviceProduct,
            deviceType: bindInfo?.deviceName,
            modelName: bindInfo?.deviceModel,
            oaid: bindInfo?.oaid,
            osVersion: bindInfo?.androidVersion,
            deviceInfo: bindInfo?.deviceFingerprint,
            board: bindInfo?.deviceBoard
          }
        } catch (error) {
          bindInfo = null
        }
      }
      const { deviceFp } = await getDeviceFp.Fp(uid, ck)
      if (deviceFp) {
        data.deviceFp = deviceFp
      }
      const device_id = await redis.get(`ZZZ:DEVICE_FP:${ltuid}:ID`)
      if (device_id) {
        data.deviceId = device_id
      }
    }
    if (!this._device_fp && !data?.Getfp && !data?.headers?.['x-rpc-device_fp']) {
      this._device_fp = await this.getData('getFp', {
        ...data,
        Getfp: true
      })
    }
    if (type === 'getFp' && !data?.Getfp) return this._device_fp

    let { url, headers, body } = this.getUrl(type, data)

    if (!url) return false

    let cacheKey = this.cacheKey(type, data)
    let cahce = await redis.get(cacheKey)
    if (cahce) return JSON.parse(cahce)

    headers.Cookie = ck

    if (data.headers) {
      headers = { ...headers, ...data.headers }
    }

    if (type !== 'getFp' && !headers['x-rpc-device_fp'] && this._device_fp.data?.device_fp) {
      headers['x-rpc-device_fp'] = this._device_fp.data.device_fp
    }

    let param = {
      headers,
      agent: await this.getAgent(),
      timeout: 10000
    }
    if (body) {
      param.method = 'post'
      param.body = body
    } else {
      param.method = 'get'
    }
    let response = {}
    let start = Date.now()
    try {
      response = await fetch(url, param)
    } catch (error) {
      logger.error(error.toString())
      return false
    }

    if (!response.ok) {
      logger.error(`[米游社接口][${type}][${this.uid}] ${response.status} ${response.statusText}`)
      return false
    }
    if (this.option.log) {
      logger.mark(`[米游社接口][${type}][${this.uid}] ${Date.now() - start}ms`)
    }
    const res = await response.json()

    if (!res) {
      logger.mark('mys接口没有返回')
      return false
    }

    res.api = type

    if (cached) this.cache(res, cacheKey)

    return res
  }

  getDs (q = '', b = '') {
    let n = ''
    if (['prod_gf_cn', 'prod_qd_cn'].includes(this.server)) {
      n = 'xV8v4Qu54lUKrEYFZkJhB8cuOh9Asafs'
    } else if (/official/.test(this.server)) {
      n = 'okr4obncj8bw5a65hbnn5oo6ixjc3l9w'
    }
    let t = Math.round(new Date().getTime() / 1000)
    let r = Math.floor(Math.random() * 900000 + 100000)
    let DS = md5(`salt=${n}&t=${t}&r=${r}&b=${b}&q=${q}`)
    return `${t},${r},${DS}`
  }

  getDS2 () {
    let t = Math.round(new Date().getTime() / 1000)
    let r = randomString(6)
    let sign = md5(`salt=WGtruoQrwczmsjLOPXzJLnaAYycsLavx&t=${t}&r=${r}`)
    return `${t},${r},${sign}`
  }

  getHeaders (query = '', body = '') {
    const cn = {
      app_version: '2.73.1',
      User_Agent: 'Mozilla/5.0 (Linux; Android 13; XQ-BC52 Build/61.2.A.0.472A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/111.0.5563.116 Mobile Safari/537.36 miHoYoBBS/2.73.1',
      client_type: '5',
      Origin: 'https://webstatic.mihoyo.com',
      X_Requested_With: 'com.mihoyo.hyperion',
      Referer: 'https://webstatic.mihoyo.com/'
    }
    const os = {
      app_version: '2.57.1',
      User_Agent: 'Mozilla/5.0 (Linux; Android 13; XQ-BC52 Build/61.2.A.0.472A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/111.0.5563.116 Mobile Safari/537.36 miHoYoBBSOversea/2.57.1',
      client_type: '2',
      Origin: 'https://act.hoyolab.com',
      X_Requested_With: 'com.mihoyo.hoyolab',
      Referer: 'https://act.hoyolab.com/'
    }
    let client
    if (/official/.test(this.server)) {
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
  async checkCode (e, res, type, data = {}) {
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
      case 10102:
        if (res.message === 'Data is not public for the user') {
          this.e.reply(`\nUID:${this.uid}，米游社数据未公开`, false, { at: this.userId })
        } else {
          this.e.reply(`UID:${this.uid}，请先去米游社绑定角色`)
        }
        break
      case 10041:
      case 5003:
        this.e.reply(`UID:${this.uid}，米游社账号异常，暂时无法查询`)
        break
      case 10035:
      case 1034: {
        let handler = this.e.runtime?.handler || {}

        // 如果有注册的mys.req.err，调用
        if (handler.has('mys.req.err')) {
          logger.mark(`[米游社sr查询失败][UID:${this.uid}][qq:${this.userId}] 遇到验证码，尝试调用 Handler mys.req.err`)
          res = await handler.call('mys.req.err', this.e, { mysApi: this, type, res, data, mysInfo: this }) || res
        }
        if (!res || res?.retcode === 1034 || res?.retcode === 10035) {
          logger.mark(`[米游社查询失败][UID:${this.uid}][qq:${this.userId}] 遇到验证码`)
          this.e.reply('米游社查询遇到验证码，请稍后再试')
        }
        break
      }
      default:
        if (/(登录|login)/i.test(res.message)) {
          logger.mark(`[ck失效][UID:${this.uid}]`)
          this.e.reply(`UID:${this.uid}，米游社cookie已失效`)
        } else {
          this.e.reply(`米游社接口报错，暂时无法查询：${res.message || 'error'}`)
        }
        break
    }
    if (res.retcode !== 0) {
      logger.mark(`[米游社sr接口报错]${JSON.stringify(res)}，UID：${this.uid}`)
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
