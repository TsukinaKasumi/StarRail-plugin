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
    if (['prod_gf_cn', 'prod_qd_cn'].includes(this.server)) {
      host = 'https://api-takumi.mihoyo.com/'
      hostRecord = 'https://api-takumi-record.mihoyo.com/'
      hostPublicData = 'https://public-data-api.mihoyo.com/'
    } else if (/official/.test(this.server)) {
      host = 'https://sg-public-api.hoyolab.com/'
      hostRecord = 'https://bbs-api-os.hoyolab.com/'
      hostPublicData = 'https://sg-public-data-api.hoyoverse.com/'
    }
    let urlMap = {
      honkaisr: {
        ...(['prod_gf_cn', 'prod_qd_cn'].includes(this.server) ? {
          srUser: {
            url: `${host}binding/api/getUserGameRolesByCookie`,
            query: `game_biz=hkrpg_cn&region=${this.server}&game_uid=${this.uid}`
          },
          getFp: {
            url: `${hostPublicData}device-fp/api/getFp`,
            body: {
              seed_id: `${generateSeed(16)}`,
              device_id: data.deviceId,
              platform: '1',
              seed_time: new Date().getTime() + '',
              ext_fields: `{"ramCapacity":"3746","hasVpn":"0","proxyStatus":"0","screenBrightness":"0.550","packageName":"com.miHoYo.mhybbs","romRemain":"100513","deviceName":"iPhone","isJailBreak":"0","magnetometer":"-160.495300x-206.488358x58.534348","buildTime":"1706406805675","ramRemain":"97","accelerometer":"-0.419876x-0.748367x-0.508057","cpuCores":"6","cpuType":"CPU_TYPE_ARM64","packageVersion":"2.20.1","gyroscope":"0.133974x-0.051780x-0.062961","batteryStatus":"45","appUpdateTimeDiff":"1707130080397","appMemory":"57","screenSize":"414×896","vendor":"--","model":"iPhone12,5","IDFV":"${data.deviceId.toUpperCase()}","romCapacity":"488153","isPushEnabled":"1","appInstallTimeDiff":"1696756955347","osVersion":"17.2.1","chargeStatus":"1","isSimInserted":"1","networkType":"WIFI"}`,
              app_name: 'account_cn',
              device_fp: '38d7f0fa36179'
            },
            noDs: true
          }
        } : {
          srUser: {
            url: `${host}binding/api/getUserGameRolesByCookie`,
            query: `game_biz=hkrpg_global&region=${this.server}&game_uid=${this.uid}`
          },
          getFp: {
            url: `${hostPublicData}device-fp/api/getFp`,
            body: {
              seed_id: `${generateSeed(16)}`,
              device_id: data.deviceId,
              platform: '5',
              seed_time: new Date().getTime() + '',
              ext_fields: `{"userAgent":"Mozilla/5.0 (Linux; Android 11; J9110 Build/55.2.A.4.332; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.6367.179 Mobile Safari/537.36 miHoYoBBSOversea/2.55.0","browserScreenSize":"387904","maxTouchPoints":"5","isTouchSupported":"1","browserLanguage":"zh-CN","browserPlat":"Linux aarch64","browserTimeZone":"Asia/Shanghai","webGlRender":"Adreno (TM) 640","webGlVendor":"Qualcomm","numOfPlugins":"0","listOfPlugins":"unknown","screenRatio":"2.625","deviceMemory":"4","hardwareConcurrency":"8","cpuClass":"unknown","ifNotTrack":"unknown","ifAdBlock":"0","hasLiedLanguage":"0","hasLiedResolution":"1","hasLiedOs":"0","hasLiedBrowser":"0","canvas":"${generateSeed(64)}","webDriver":"0","colorDepth":"24","pixelRatio":"2.625","packageName":"unknown","packageVersion":"2.27.0","webgl":"${generateSeed(64)}"}`,
              app_name: 'hkrpg_global',
              device_fp: '38d7f2364db95'
            },
            noDs: true
          }
        }),
        srCharacterDetail: {
          url: `${hostRecord}game_record/app/hkrpg/api/avatar/info`,
          query: `need_wiki=true&role_id=${this.uid}&server=${this.server}`
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
          query: `lang=zh-cn&uid=${this.uid}&region=${this.server}&month=`
        },
        srChallenge: {
          url: `${hostRecord}game_record/app/hkrpg/api/challenge`,
          query: `isPrev=&need_all=true&role_id=${this.uid}&schedule_type=${data.schedule_type || '1'}&server=${this.server}`
        },
        srChallengeSimple: {
          url: `${hostRecord}game_record/app/hkrpg/api/challenge`,
          query: `role_id=${this.uid}&schedule_type=${data.schedule_type || '1'}&server=${this.server}`
        },
        srChallengeStory: {
          url: `${hostRecord}game_record/app/hkrpg/api/challenge_story`,
          query: `isPrev=&need_all=true&role_id=${this.uid}&schedule_type=${data.schedule_type || '1'}&server=${this.server}`
        }, // &type=story
        srChallengeStorySimple: {
          url: `${hostRecord}game_record/app/hkrpg/api/challenge_story`,
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
        }
      }
    }
    return urlMap[this.game]
  }
}