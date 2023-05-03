import MysApi from '../../genshin/model/mys/mysApi.js'
import md5 from 'md5'
import _ from 'lodash'
const DEVICE_ID = randomString(32).toUpperCase()
const DEVICE_NAME = randomString(_.random(1, 10))
export default class MysSRApi extends MysApi {
  constructor (uid, cookie, option = {}) {
    super(uid, cookie, option)
    this.server = 'prod_gf_cn'
    // this.server = 'hkrpg_cn'
  }

  getUrl (type, data = {}) {
    let host, hostRecord
    if (['prod_gf_cn'].includes(this.server)) {
      host = 'https://api-takumi.mihoyo.com/'
      hostRecord = 'https://api-takumi-record.mihoyo.com/'
    } else {
      host = 'https://api-os-takumi.mihoyo.com/'
      hostRecord = 'https://bbs-api-os.mihoyo.com/'
    }
    let urlMap = {
      srCharacterDetail: {
        url: `${hostRecord}game_record/app/hkrpg/api/avatar/info`,
        query: `need_wiki=true&role_id=${this.uid}&server=${this.server}`
      },
      srUser: {
        url: `${host}binding/api/getUserGameRolesByCookie`,
        query: 'game_biz=hkrpg_cn'
      },
      srCharacter: {
        url: `${hostRecord}game_record/app/hkrpg/api/avatar/basic`,
        query: `rolePageAccessNotAllowed=&role_id=${this.uid}&server=${this.server}`
      },
      srNote: {
        url: `${hostRecord}game_record/app/hkrpg/api/note`,
        query: `role_id=${this.uid}&server=${this.server}`
      },
      srCard: {
        url: `${hostRecord}game_record/app/hkrpg/api/index`,
        query: `role_id=${this.uid}&server=${this.server}`
      },
      srMonth: {
        url: `${host}event/srledger/month_info`,
        query: `uid=${this.uid}&region=${this.server}&month=`
      },
      srPayAuthKey: {
        url: `${host}binding/api/genAuthKey`,
        body: {
          auth_appid: 'csc',
          game_biz: 'hkrpg_cn',
          game_uid: this.uid * 1,
          region: 'prod_gf_cn'
        }
      }
    }
    if (!urlMap[type]) return false
    let { url, query = '', body = '', sign = '' } = urlMap[type]
    if (query) url += `?${query}`
    if (body) body = JSON.stringify(body)

    let headers = this.getHeaders(query, body)
    if (typeof this.cookie == 'string') {
      headers.cookie = this.cookie
    } else {
      let cookie = this.cookie[Object.keys(this.cookie).filter(k => this.cookie[k].ck)[0]]
      headers.cookie = cookie?.ck
    }
    if (type === 'srPayAuthKey') {
      headers.DS = this.getDS2()
      let extra = {
        'x-rpc-app_version': '2.40.1',
        'User-Agent': 'okhttp/4.8.0',
        'x-rpc-client_type': '5',
        Referer: 'https://app.mihoyo.com',
        Origin: 'https://webstatic.mihoyo.com',
        // Cookie: this.cookies,
        DS: this.getDS2(),
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
    let r = Math.floor(Math.random() * 900000 + 100000)
    let DS = md5(`salt=${n}&t=${t}&r=${r}&b=${b}&q=${q}`)
    return `${t},${r},${DS}`
  }

  getDS2 () {
    let t = Math.round(new Date().getTime() / 1000)
    let r = randomString(6)
    let sign = md5(`salt=jEpJb9rRARU2rXDA9qYbZ3selxkuct9a&t=${t}&r=${r}`)
    return `${t},${r},${sign}`
  }
}

export function randomString (length) {
  let randomStr = ''
  for (let i = 0; i < length; i++) {
    randomStr += _.sample('abcdefghijklmnopqrstuvwxyz0123456789')
  }
  return randomStr
}
