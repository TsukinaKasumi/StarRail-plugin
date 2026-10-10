import fetch from 'node-fetch'

export const gatchaType = {
  1: '群星跃迁',
  2: '新手跃迁',
  11: '限定跃迁',
  12: '光锥跃迁',
  21: '角色联动跃迁',
  22: '光锥联动跃迁'
}

export async function getRecords (uid, type = 11, authKey) {
  let page = 1
  let data = {
    data: {}
  }
  let endId = 0
  let result = []
  do {
    logger.info(`正在获取${gatchaType[type]}第${page}页`)
    const url = getRecordUrl(uid, type, page, 20, authKey, endId)
    const response = await fetch(url)
    data = await response.json()
    result.push(...data.data.list)
    endId = result[result.length - 1]?.id
    // 延迟500ms，防止请求过快
    await new Promise(resolve => setTimeout(resolve, 500))
    page++
  } while (data.data.list && data.data.list.length > 0)

  logger.info(`=== ${gatchaType[type]}记录拉取完成 ===`)
  return result
}

function getServer (uid) {
  switch (String(uid).slice(0, -8)) {
    case '1':
    case '2':
      return 'prod_gf_cn' // 官服
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
  return 'prod_gf_cn'
}

function getRecordUrl (uid, type, page, size = 10, authKey = '', endId = 0) {
  // 联动池（gacha_type 21/22）走独立端点 getLdGachaLog（同域名不同路径）。
  // 联动池查询窗口为 24 个月（常规池 12 个月），由服务端控制返回范围，
  // 本方法按 end_id 自然翻页，无需特殊处理。
  const api = [21, 22].includes(Number(type)) ? 'getLdGachaLog' : 'getGachaLog'
  if (['prod_gf_cn', 'prod_qd_cn'].includes(getServer(uid)))
    return `https://public-operation-hkrpg.mihoyo.com/common/gacha_record/api/${api}?authkey_ver=1&default_gacha_type=11&lang=zh-cn&authkey=${authKey}&game_biz=hkrpg_cn&page=${page}&size=${size}&gacha_type=${type}&end_id=${endId}`
  else if (/official/.test(getServer(uid)))
    return `https://public-operation-hkrpg-sg.hoyoverse.com/common/gacha_record/api/${api}?authkey_ver=1&default_gacha_type=11&lang=zh-cn&authkey=${authKey}&game_biz=hkrpg_global&page=${page}&size=${size}&gacha_type=${type}&end_id=${endId}`
}
