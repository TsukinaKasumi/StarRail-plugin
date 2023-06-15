import Cfg from './Cfg.js'

function sleep (ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export default {
  cfg: Cfg.get,
  isDisable: Cfg.isDisable,
  sleep
}
