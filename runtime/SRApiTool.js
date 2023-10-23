import { generateSeed } from './MysSRApi.js'
/**
 * derived from miao-yunzai
 */
export default class SRApiTool {
  /**
   *
   * @param {uid} uid
   * @param {server} server
   */
  constructor (uid, server) {
    this.uid = uid
    this.isSr = true
    this.server = server
    this.game = 'honkaisr'
  }

  getUrlMap = (data = {}) => {
    let host, hostRecord, hostPublicData
    if (['prod_gf_cn'].includes(this.server)) {
      host = 'https://api-takumi.mihoyo.com/'
      hostRecord = 'https://api-takumi-record.mihoyo.com/'
      hostPublicData = 'https://public-data-api.mihoyo.com/'
    } else {
      host = 'https://api-os-takumi.mihoyo.com/'
      hostRecord = 'https://bbs-api-os.mihoyo.com/'
    }
    if (['cn_gf01', 'cn_qd01', 'prod_gf_cn', 'prod_qd_cn'].includes(this.server)) {
      host = 'https://api-takumi.mihoyo.com/'
      hostRecord = 'https://api-takumi-record.mihoyo.com/'
    } else if (['os_usa', 'os_euro', 'os_asia', 'os_cht'].includes(this.server)) {
      host = 'https://api-os-takumi.mihoyo.com/'
      hostRecord = 'https://bbs-api-os.mihoyo.com/'
    }
    let urlMap = {
      honkaisr: {
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
        srWidget: {
          url: `${hostRecord}game_record/app/hkrpg/aapi/widget`,
          dsSalt: 'x6'
        },
        srCard: {
          url: `${hostRecord}game_record/app/hkrpg/api/index`,
          query: `role_id=${this.uid}&server=${this.server}`
        },
        srMonth: {
          url: `${host}event/srledger/month_info`,
          query: `uid=${this.uid}&region=${this.server}&month=`
        },
        srChallenge: {
          url: `${hostRecord}game_record/app/hkrpg/api/challenge`,
          query: `isPrev=&need_all=true&role_id=${this.uid}&schedule_type=${data.schedule_type || '1'}&server=${this.server}`
        },
        srChallengeSimple: {
          url: `${hostRecord}game_record/app/hkrpg/api/challenge`,
          query: `role_id=${this.uid}&schedule_type=${data.schedule_type || '1'}&server=${this.server}`
        },
        srRogue: {
          url: `${hostRecord}game_record/app/hkrpg/api/rogue`,
          query: `need_detail=true&role_id=${this.uid}&schedule_type=${data.schedule_type || '3'}&server=${this.server}`
        },
        srRogueLocust: {
          url: `${hostRecord}game_record/app/hkrpg/api/rogue_locust`,
          query: `need_detail=true&role_id=${this.uid}&server=${this.server}`
        },
        srPayAuthKey: {
          url: `${host}binding/api/genAuthKey`,
          body: {
            auth_appid: 'csc',
            game_biz: 'hkrpg_cn',
            game_uid: this.uid * 1,
            region: 'prod_gf_cn'
          },
          dsSalt: 'web'
        },
        getFp: {
          url: `${hostPublicData}device-fp/api/getFp`,
          body: {
            seed_id: `${generateSeed(16)}`,
            device_id: this.deviceId,
            platform: '5',
            seed_time: new Date().getTime() + '',
            ext_fields: '{"userAgent":"Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) miHoYoBBS/2.44.1","browserScreenSize":281520,"maxTouchPoints":5,"isTouchSupported":true,"browserLanguage":"zh-CN","browserPlat":"iPhone","browserTimeZone":"Asia/Shanghai","webGlRender":"Apple GPU","webGlVendor":"Apple Inc.","numOfPlugins":0,"listOfPlugins":"unknown","screenRatio":3,"deviceMemory":"unknown","hardwareConcurrency":"4","cpuClass":"unknown","ifNotTrack":"unknown","ifAdBlock":0,"hasLiedResolution":1,"hasLiedOs":0,"hasLiedBrowser":0}',
            app_name: 'account_cn',
            device_fp: '38d7ee834d1e9'
          },
          noDs: true
        }
      }
    }

    if (this.server.startsWith('os')) {
      urlMap.genshin.detail.url = 'https://sg-public-api.hoyolab.com/event/calculateos/sync/avatar/detail'// 角色天赋详情
      urlMap.genshin.detail.query = `lang=zh-cn&uid=${this.uid}&region=${this.server}&avatar_id=${data.avatar_id}`
      urlMap.genshin.avatarSkill.url = 'https://sg-public-api.hoyolab.com/event/calculateos/avatar/skill_list'// 查询未持有的角色天赋
      urlMap.genshin.avatarSkill.query = `lang=zh-cn&avatar_id=${data.avatar_id}`
      urlMap.genshin.compute.url = 'https://sg-public-api.hoyolab.com/event/calculateos/compute'// 已支持养成计算
      urlMap.genshin.blueprint.url = 'https://sg-public-api.hoyolab.com/event/calculateos/furniture/blueprint'
      urlMap.genshin.blueprint.query = `share_code=${data.share_code}&region=${this.server}&lang=zh-cn`
      urlMap.genshin.blueprintCompute.url = 'https://sg-public-api.hoyolab.com/event/calculateos/furniture/compute'
      urlMap.genshin.blueprintCompute.body = { lang: 'zh-cn', ...data.body }
      urlMap.genshin.ys_ledger.url = 'https://hk4e-api-os.mihoyo.com/event/ysledgeros/month_info'// 支持了国际服札记
      urlMap.genshin.ys_ledger.query = `lang=zh-cn&month=${data.month}&uid=${this.uid}&region=${this.server}`
      urlMap.genshin.useCdk.url = 'https://sg-hk4e-api.hoyoverse.com/common/apicdkey/api/webExchangeCdkey'
      urlMap.genshin.useCdk.query = `uid=${this.uid}&region=${this.server}&lang=zh-cn&cdkey=${data.cdk}&game_biz=hk4e_global`
    }
    return urlMap[this.game]
  }
}
