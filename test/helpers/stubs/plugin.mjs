/** Yunzai lib/plugins/plugin.js 桩：仅存储构造配置 */
export default class plugin {
  constructor (cfg) {
    Object.assign(this, cfg)
  }
}
