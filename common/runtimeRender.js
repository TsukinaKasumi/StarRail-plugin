import setting from '../utils/setting.js'
import Version from '../components/Version.js'
const decimalAdjust = (type, value, exp = 0) => {
  type = String(type)
  if (!['round', 'floor', 'ceil'].includes(type)) {
    throw new TypeError(
      "The type of decimal adjustment must be one of 'round', 'floor', or 'ceil'."
    )
  }
  exp = Number(exp)
  value = Number(value)
  if (exp % 1 !== 0 || Number.isNaN(value)) {
    return NaN
  } else if (exp === 0) {
    return Math[type](value)
  }
  const [magnitude, exponent = 0] = value.toString().split('e')
  const adjustedValue = Math[type](`${magnitude}e${exponent - exp}`)
  // Shift back
  const [newMagnitude, newExponent = 0] = adjustedValue.toString().split('e')
  return Number(`${newMagnitude}e${+newExponent + exp}`)
}
const MathPro = {
  floor10: function (value, exp) {
    return decimalAdjust('floor', value, exp)
  },
  ceil10: function (value, exp) {
    return decimalAdjust('ceil', value, exp)
  },
  round10: function (value, exp) {
    return decimalAdjust('round', value, exp)
  }
}
export default function runtimeRender (e, path, renderData = {}, cfg = {}) {
  if (!e.runtime) {
    console.log('未找到e.runtime，请升级至最新版Yunzai')
  }
  let scale = setting.getConfig('gachaHelp').renderScale || 100
  scale = Math.min(2, Math.max(0.5, scale / 100))
  scale = (cfg.scale || 1) * scale
  const pct = `style='transform:scale(${scale})'`
  const layoutPath =
    process.cwd() + '/plugins/StarRail-plugin/resources/common/layout/'
  return e.runtime.render('StarRail-plugin', path, renderData, {
    ...cfg,
    beforeRender ({ data }) {
      let resPath = data.pluResPath
      return {
        ...data,
        _res_path: resPath,
        _layout_path: layoutPath,
        defaultLayout: layoutPath + 'default.html',
        elemLayout: layoutPath + 'elem.html',
        sys: {
          scale: pct,
          copyright: `Created By ${Version.name}<span class="version">${Version.yunzai}</span> & StarRail-plugin<span class="version">${Version.version}</span>`,
          createdby: `Created By ${Version.name} & StarRail-plugin`,
        },
        Math,
        MathPro,
        quality: 100
      }
    }
  })
}
