import { generateSeed } from './MysSRApi.js'
import crypto from 'crypto'
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
    this.uuid = crypto.randomUUID()
  }

  getUrlMap = (data = {}) => {
    const productName = data?.productName || 'XQ-BC52_EEA'
    const deviceType = data?.deviceType || 'XQ-BC52'
    const modelName = data?.modelName || 'XQ-BC52'
    const oaid = data?.oaid || this.uuid
    const osVersion = data?.osVersion || '13'
    const deviceInfo = data?.deviceInfo || 'Sony/XQ-BC52_EEA/XQ-BC52:13/61.2.A.0.472A/061002A0000472A0046651803:user/release-keys'
    const board = data?.board || 'lahaina'
    const deviceBrand = deviceInfo.split('/')[0]
    const deviceDisplay = deviceInfo.split('/')[3]
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
              app_name: 'bbs_cn',
              bbs_device_id: `${this.uuid}`,
              device_fp: '38d805c20d53d',
              device_id: 'cc57c40f763ae4cc',
              ext_fields: `{"proxyStatus":1,"isRoot":0,"romCapacity":"768","deviceName":"${modelName}","productName":"${productName}","romRemain":"727","hostname":"BuildHost","screenSize":"1096x2434","isTablet":0,"aaid":"${this.uuid}","model":"${modelName}","brand":"${deviceBrand}","hardware":"qcom","deviceType":"${deviceType}","devId":"REL","serialNumber":"unknown","sdCapacity":224845,"buildTime":"1692775759000","buildUser":"BuildUser","simState":1,"ramRemain":"218344","appUpdateTimeDiff":1740498108042,"deviceInfo":"${deviceInfo}","vaid":"${this.uuid}","buildType":"user","sdkVersion":"33","ui_mode":"UI_MODE_TYPE_NORMAL","isMockLocation":0,"cpuType":"arm64-v8a","isAirMode":0,"ringMode":2,"chargeStatus":1,"manufacturer":"${deviceBrand}","emulatorStatus":0,"appMemory":"768","osVersion":"${osVersion}","vendor":"unknown","accelerometer":"-1.588236x6.8404818x6.999604","sdRemain":218214,"buildTags":"release-keys","packageName":"com.mihoyo.hyperion","networkType":"WiFi","oaid":"${oaid}","debugStatus":1,"ramCapacity":"224845","magnetometer":"-47.04375x51.3375x137.96251","display":"${deviceDisplay}","appInstallTimeDiff":1740498108042,"packageVersion":"2.35.0","gyroscope":"-0.22601996x-0.09453133x0.09040799","batteryStatus":88,"hasKeyboard":0,"board":"${board}"}`,
              platform: '2',
              seed_id: `${this.uuid}`,
              seed_time: new Date().getTime() + ''
            },
            noDs: true
          },
          sign_info: {
            url: `${host}event/luna/info`,
            query: `lang=zh-cn&act_id=e202304121516551&region=${this.server}&uid=${this.uid}`,
            dsSalt: 'web'
          }
        } : {
          srUser: {
            url: `${host}binding/api/getUserGameRolesByCookie`,
            query: `game_biz=hkrpg_global&region=${this.server}&game_uid=${this.uid}`
          },
          getFp: {
            url: `${hostPublicData}device-fp/api/getFp`,
            body: {
              app_name: 'bbs_oversea',
              device_fp: '38d7f4c72b736',
              device_id: 'cc57c40f763ae4cc',
              ext_fields: `{"proxyStatus":1,"isRoot":0,"romCapacity":"768","deviceName":"${modelName}","productName":"${productName}","romRemain":"737","hostname":"BuildHost","screenSize":"1096x2434","isTablet":0,"model":"${modelName}","brand":"${deviceBrand}","hardware":"qcom","deviceType":"${deviceType}","devId":"REL","serialNumber":"unknown","sdCapacity":224845,"buildTime":"1692775759000","buildUser":"BuildUser","simState":1,"ramRemain":"218355","appUpdateTimeDiff":1740498134990,"deviceInfo":"${deviceInfo}","buildType":"user","sdkVersion":"33","ui_mode":"UI_MODE_TYPE_NORMAL","isMockLocation":0,"cpuType":"arm64-v8a","isAirMode":0,"ringMode":2,"app_set_id":"${this.uuid}","chargeStatus":1,"manufacturer":"${deviceBrand}","emulatorStatus":0,"appMemory":"768","adid":"${this.uuid}","osVersion":"${osVersion}","vendor":"unknown","accelerometer":"-0.6436693x5.510072x8.106883","sdRemain":218227,"buildTags":"release-keys","packageName":"com.mihoyo.hoyolab","networkType":"WiFi","debugStatus":1,"ramCapacity":"224845","magnetometer":"-46.143753x52.350002x141.54376","display":"${deviceDisplay}","appInstallTimeDiff":1740498134990,"packageVersion":"2.35.0","gyroscope":"0.21242823x0.11484258x-0.09850194","batteryStatus":88,"hasKeyboard":0,"board":"${board}"}`,
              hoyolab_device_id: `${this.uuid}`,
              platform: '2',
              seed_id: `${this.uuid}`,
              seed_time: new Date().getTime() + ''
            },
            noDs: true
          },
          sign_info: {
            url: `${host}event/luna/os/info`,
            query: 'lang=zh-cn&act_id=e202303301540311',
            dsSalt: 'web'
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
        srChallengeBoss: {
          url: `${hostRecord}game_record/app/hkrpg/api/challenge_boss`,
          query: `isPrev=&need_all=true&role_id=${this.uid}&schedule_type=${data.schedule_type || '1'}&server=${this.server}`
        },
        srChallengeBossSimple: {
          url: `${hostRecord}game_record/app/hkrpg/api/challenge_boss`,
          query: `role_id=${this.uid}&schedule_type=${data.schedule_type || '1'}&server=${this.server}`
        },
        srChallengePeak: {
          url: `${hostRecord}game_record/app/hkrpg/api/challenge_peak`,
          query: `isPrev=&need_all=true&role_id=${this.uid}&schedule_type=${data.schedule_type || '1'}&server=${this.server}`
        },
        srChallengePeakSimple: {
          url: `${hostRecord}game_record/app/hkrpg/api/challenge_peak`,
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
        srRogueNous: {
          url: `${hostRecord}game_record/app/hkrpg/api/rogue_nous`,
          query: `need_detail=true&role_id=${this.uid}&server=${this.server}`
        },
        srRogueMagic: {
          url: `${hostRecord}game_record/app/hkrpg/api/rogue_magic`,
          query: `role_id=${this.uid}&server=${this.server}`
        }, // need_detail=true&
        srPeriodicAct: {
          url: `${hostRecord}game_record/app/hkrpg/api/periodic_act`,
          query: `role_id=${this.uid}&server=${this.server}`
        },
        srPeriodicAct: {
          url: `${hostRecord}game_record/app/hkrpg/api/periodic_act`,
          query: `role_id=${this.uid}&server=${this.server}`
        },
        srRogueTourn: {
          url: `${hostRecord}game_record/app/hkrpg/api/rogue_tourn`,
          query: `need_detail=true&role_id=${this.uid}&server=${this.server}`
        },
        srGridFight: {
          url: `${hostRecord}game_record/app/hkrpg/api/grid_fight`,
          query: `role_id=${this.uid}&server=${this.server}`
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
        deviceLogin: {
          url: 'https://bbs-api.miyoushe.com/apihub/api/deviceLogin',
          body: {
            app_version: '2.73.1',
            device_id: data.deviceId,
            device_name: `${deviceBrand}${modelName}`,
            os_version: '33',
            platform: 'Android',
            registration_id: generateSeed(19)
          }
        },
        saveDevice: {
          url: 'https://bbs-api.miyoushe.com/apihub/api/saveDevice',
          body: {
            app_version: '2.73.1',
            device_id: data.deviceId,
            device_name: `${deviceBrand}${modelName}`,
            os_version: '33',
            platform: 'Android',
            registration_id: generateSeed(19)
          }
        }
      }
    }
    return urlMap[this.game]
  }
}