/** xiaoyao-cvs-plugin model/user.js 桩（utils/authkey.js 的可选依赖，未装时走降级路径） */
export default class XyUser {
  async getCookie () {
    return null
  }

  async getStoken () {
    return {}
  }
}
