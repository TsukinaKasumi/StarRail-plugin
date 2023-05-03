// import User from "../../xiaoyao-cvs-plugin/model/user.js";
import MysSRApi from '../runtime/MysSRApi.js'
let User
try {
  User = (await import('../../xiaoyao-cvs-plugin/model/user.js')).default
} catch (e) {
  logger.warn('建议安装逍遥插件自动获取星穹铁道抽卡链接')
}

/**
 * 此方法依赖逍遥插件
 * @returns {Promise<void>}
 */
export async function getAuthKey (e, srUid, authAppid = 'csc') {
  if (!User) {
    throw new Error('未安装逍遥插件，无法自动刷新抽卡链接')
  }
  let user = new User(e)
  // set genshin uid
  await user.getCookie(e)
  let ck = await user.getStoken(e.user_id)
  ck = `stuid=${ck.stuid};stoken=${ck.stoken};mid=${ck.mid};`
  let api = new MysSRApi(srUid, ck)
  let type = 'srPayAuthKey'
  switch (authAppid) {
    case 'csc': {
      type = 'srPayAuthKey'
      break
    }
    default:
  }
  const { url, headers, body } = api.getUrl(type)
  let res = await fetch(url, {
    method: 'POST',
    headers,
    body
  })
  res = await res.json()
  return res?.data?.authkey
}
