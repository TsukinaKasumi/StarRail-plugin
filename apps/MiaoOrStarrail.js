import fs from 'fs'
import cfg from '../../../lib/config/config.js'

let SR = {
  miao: true,
  sr: true
}

/**
 * 是否拦截星铁插件的绑定UID
 * 拦截后默认使用喵崽绑定的星铁UID
 * false为不拦截、true为拦截
 */
let tof = (cfg.package.name != 'yunzai') ? true : false
let intercept = tof

export class StarRail extends plugin {
  constructor () {
    super({
      name: '星铁面板-兼容版',
      dsc: '可同时使用miao-plugin和StarRail-plugin',
      event: 'message',
      priority: -1000,
      rule: [
        {
          reg: '^#星铁更新面板.*$',
          fnc: 'update'
        },
        {
          reg: '^#星铁(?!插件)(?!更新)(.+)面板$',
          fnc: 'StarRail'
        },
        {
          reg: '^#(喵喵|星铁)?插件面板(开启|关闭|状态)$',
          fnc: 'Sr'
        }
      ]
    })
  }

  /** 更新全部面板 */
  async update () {
    if (SR.miao) {
      ((await import("../../miao-plugin/apps/profile/ProfileList.js")).default).refresh(this.e)
    }

    if (SR.sr) {
      const new_panel = new (await import("../../StarRail-plugin/apps/panel.js")).Panel()
      new_panel.e = this.e
      new_panel.reply = this.reply
      await new_panel.update(this.e)
    }
  }

  /** 查看角色详细面板 */
  async StarRail () {
    if (SR.miao) {
      ((await import("../../miao-plugin/apps/profile/ProfileDetail.js")).default).detail(this.e)
    }

    if (SR.sr) {
      const new_panel = new (await import("../../StarRail-plugin/apps/panel.js")).Panel()
      new_panel.e = this.e
      new_panel.reply = this.reply
      await new_panel.panel(this.e)
    }
  }

  async Sr (e) {
    if (!e.isMaster) {
      e.reply('只有主人才能使用该命令哦~')
      return false
    }
    const fileurl = import.meta.url
    const sr_name = fileurl.substring(fileurl.lastIndexOf('/') + 1).split('?')[0]
    const _path = process.cwd() + "/plugins"
    let cfg = fs.readFileSync(_path + `/StarRail-plugin/apps/${sr_name}`, 'utf8')
    const msg = e.msg
    if (/喵喵/.test(msg)) {
      if (/开启/.test(msg) && !SR.miao) {
        SR.miao = true
        cfg = cfg.replace('miao: false', 'miao: true')
      } else if (/关闭/.test(msg) && SR.miao) {
        SR.miao = false
        cfg = cfg.replace('miao: true', 'miao: false')
      }
    } else if (/星铁/.test(msg)) {
      if (!fs.existsSync(_path + "/StarRail-plugin")) {
        return e.reply("....死开，你有这个插件？")
      }
      if (/开启/.test(msg) && !SR.sr) {
        SR.sr = true
        cfg = cfg.replace('sr: false', 'sr: true')
      } else if (/关闭/.test(msg) && SR.sr) {
        SR.sr = false
        cfg = cfg.replace('sr: true', 'sr: false')
      }
    }
    await fs.promises.writeFile(_path + `/StarRail-plugin/apps/${sr_name}`, cfg, 'utf8')

    const miao = `喵喵：${SR.miao === true ? "开启" : "关闭"}`
    const sr_ = `星铁：${SR.sr === true ? "开启" : "关闭"}`
    e.reply(`当前状态：\n${miao}\n${sr_}`)
  }
}

/** 拦截星铁插件绑定UID */
if (fs.existsSync("./plugins/StarRail-plugin") && intercept) {
  const Hkrpg = (await import("../../StarRail-plugin/apps/hkrpg.js")).Hkrpg
  Hkrpg.prototype.bindSRUid = async function () {
    logger.info("星铁插件绑定UID已经被拦截...")
    return false
  }
}
