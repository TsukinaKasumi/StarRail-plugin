import setting from '../utils/setting.js'

export default function runtimeRender (e, path, renderData = {}, cfg = {}) {
  if (!e.runtime) {
    console.log('未找到e.runtime，请升级至最新版Yunzai')
  }
  let scale = setting.getConfig('gachaHelp').renderScale || 100
  scale = Math.min(2, Math.max(0.5, scale / 100))
  scale = (cfg.scale || 1) * scale
  const pct = `style='transform:scale(${scale})'`
  const layoutPath = process.cwd() + '/plugins/StarRail-plugin/resources/common/layout/'
  return e.runtime.render('StarRail-plugin', path, renderData, {
    ...cfg,
    beforeRender ({ data }) {
      return {
        ...data,
        sys: {
          scale: pct
        },
        defaultLayout: layoutPath + 'default.html',
        quality: 100
      }
    }
  })
}
