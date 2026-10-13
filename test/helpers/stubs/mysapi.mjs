/** genshin/model/mys/mysApi.js 桩：只实现 MysSRApi 继承用到的表面（构造器 + cacheKey/cache/getAgent） */
import md5 from 'md5'

export default class MysApi {
  constructor (uid, cookie, option = {}, isSr) {
    this.uid = uid
    this.cookie = cookie
    this.option = { log: true, ...option }
    this.cacheCd = 300
  }

  cacheKey (type, data) {
    return 'Yz:genshin:mys:cache:' + md5(this.uid + type + JSON.stringify(data))
  }

  async cache (res, cacheKey) {
    if (!res || res.retcode !== 0) return
    redis.setEx(cacheKey, this.cacheCd, JSON.stringify(res))
  }

  async getAgent () {
    return null
  }
}
