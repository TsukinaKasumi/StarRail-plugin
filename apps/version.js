import plugin from '../../../lib/plugins/plugin.js'
import { exec, execSync } from 'child_process'
import { checkPnpm } from '../utils/common.js'

export class StarRailManagement extends plugin {
  constructor (e) {
    super({
      name: 'StarRail-Plugin更新日志',
      dsc: 'StarRail-Plugin更新日志',
      event: 'message',
      priority: 400,
      rule: [
        {
          reg: '^#?(星轨|星铁)(插件)?更新日志$',
          fnc: 'updateLog'
        }
      ]
    })
  }

  async checkAuth (e) {
    if (!e.isMaster) {
      e.reply('只有主人才能命令我哦~(*/ω＼*)')
      return false
    }
    return true
  }

  /**
     * 获取插件更新日志
     * @param {string} plugin 插件名称
     * @returns
     */
  async getLog (plugin = 'StarRail-plugin') {
    let cm = 'git log  -20 --oneline --pretty=format:"%h||[%cd]  %s" --date=format:"%m-%d %H:%M"'
    if (plugin) {
      cm = `cd ./plugins/${plugin}/ && ${cm}`
    }

    let logAll
    try {
      logAll = await execSync(cm, { encoding: 'utf-8', windowsHide: true })
    } catch (error) {
      logger.error(error.toString())
      this.reply(error.toString())
    }

    if (!logAll) return false

    logAll = logAll.split('\n')

    let log = []
    for (let str of logAll) {
      str = str.split('||')
      if (str[0] == this.oldCommitId) break
      if (str[1].includes('Merge branch')) continue
      log.push(str[1])
    }
    let line = log.length
    log = log.join('\n\n')

    if (log.length <= 0) return ''

    let end = ''
    if (!plugin) {
      end = '更多详细信息，请前往gitee查看\nhttps://gitee.com/hewang1an/StarRail-plugin'
    }

    log = await this.makeForwardMsg(`${plugin}更新日志，共${line}条`, log, end)

    return log
  }

  /**
   * 制作转发消息
   * @param {string} title 标题 - 首条消息
   * @param {string} msg 日志信息
   * @param {string} end 最后一条信息
   * @returns
   */
  async makeForwardMsg (title, msg, end) {
    let nickname = Bot.nickname
    if (this.e.isGroup) {
      let info = await Bot.getGroupMemberInfo(this.e.group_id, Bot.uin)
      nickname = info.card ?? info.nickname
    }
    let userInfo = {
      user_id: Bot.uin,
      nickname
    }

    let forwardMsg = [
      {
        ...userInfo,
        message: title
      },
      {
        ...userInfo,
        message: msg
      }
    ]

    if (end) {
      forwardMsg.push({
        ...userInfo,
        message: end
      })
    }

    /** 制作转发内容 */
    if (this.e.isGroup) {
      forwardMsg = await this.e.group.makeForwardMsg(forwardMsg)
    } else {
      forwardMsg = await this.e.friend.makeForwardMsg(forwardMsg)
    }

    /** 处理描述 */
    forwardMsg.data = forwardMsg.data
      .replace(/\n/g, '')
      .replace(/<title color="#777777" size="26">(.+?)<\/title>/g, '___')
      .replace(/___+/, `<title color="#777777" size="26">${title}</title>`)

    return forwardMsg
  }

  /*
   *更新日志的方法
   */
  async updateLog () {
    let log = await this.getLog()
    await this.reply(log)
  }
}
