export function getPaylogUrl (authkey, page = 1, size = 10) {
  let url = `https://api-takumi.mihoyo.com/common/hkrpg_self_help_inquiry/Dreams/GetList?sign_type=2&auth_appid=csc&authkey_ver=1&win_direction=portrait&page_id=4&bbs_auth_required=true&bbs_game_role_required=hkrpg_cn&app_client=bbs&game_biz=hkrpg_cn&lang=zh-cn&authkey=${authkey}&page=${page}&page_size=${size}`
  return url
}
