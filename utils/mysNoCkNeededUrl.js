export function getPaylogUrl (authkey, type, page = 1, size = 10) {
  let type_url
  switch (type) {
    case '古老梦华':
      type_url = 'Dreams'
      break
    case '星琼':
      type_url = 'Stellar'
      break
    case '体力':
      type_url = 'Power'
      break
    case '遗器':
      type_url = 'Relic'
      break
    case '光锥':
      type_url = 'Cone'
      break
    default:
      type_url = 'Dreams'
      break
  }
  const url = `https://api-takumi.mihoyo.com/common/hkrpg_self_help_inquiry/${type_url}/GetList?sign_type=2&auth_appid=csc&authkey_ver=1&win_direction=portrait&page_id=4&bbs_auth_required=true&bbs_game_role_required=hkrpg_cn&app_client=bbs&game_biz=hkrpg_cn&lang=zh-cn&authkey=${authkey}&page=${page}&page_size=${size}`
  return url
}

export function getPowerUrl (authkey, page = 1, size = 10) {
  return `https://api-takumi.mihoyo.com/common/hkrpg_self_help_inquiry/Power/GetList?sign_type=2&auth_appid=csc&authkey_ver=1&win_direction=portrait&page_id=4&bbs_auth_required=true&bbs_game_role_required=hkrpg_cn&app_client=bbs&game_biz=hkrpg_cn&lang=zh-cn&authkey=${authkey}&page=${page}&page_size=${size}`
}
