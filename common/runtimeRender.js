import setting from '../utils/setting.js'

export default function runtimeRender (e, path, data = {}, cfg = {}) {
  if (!e.runtime) {
    console.log('未找到e.runtime，请升级至最新版Yunzai')
  }
  let scale = setting.getConfig('gachaHelp').renderScale || 100
  scale = Math.min(2, Math.max(0.5, scale / 100))
  const pct = `style=transform:scale(${scale})`
  return e.runtime.render('StarRail-plugin', path, data, {
    beforeRender ({ data }) {
      return {
        sys: {
          scale: pct
        }
      }
    }
  })
}
