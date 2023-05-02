import plugin from '../../../lib/plugins/plugin.js'
import { exec } from 'node:child_process'
import { checkPnpm } from '../utils/common.js'

export class StarRailManagement extends plugin {
  constructor (e) {
    super({
      name: 'StarRail-Plugin管理',
      dsc: '管理和更新代码',
      event: 'message',
      priority: 400,
      rule: [
        {
          reg: '#(星轨|星铁)(插件)?(强制)?更新',
          fnc: 'update'
        }
      ]
    })
  }

  async checkAuth (e) {
    if (!e.isMaster) {
      e.reply(`只有主人才能命令StarRail-Plugin哦~
    (*/ω＼*)`)
      return false
    }
    return true
  }

  // modified from miao-plugin
  async update (e) {
    let timer
    if (!await this.checkAuth(e)) {
      return true
    }
    let isForce = e.msg.includes('强制')
    let command = 'git  pull'
    if (isForce) {
      command = 'git  checkout . && git  pull'
      e.reply('正在执行强制更新操作，请稍等')
    } else {
      e.reply('正在执行更新操作，请稍等')
    }
    const _path = process.cwd()
    exec(command, { cwd: `${_path}/plugins/StarRail-plugin/` }, async function (error, stdout, stderr) {
      if (/(Already up[ -]to[ -]date|已经是最新的)/.test(stdout)) {
        e.reply('目前已经是最新版星轨插件了了~')
        return true
      }
      if (error) {
        e.reply('星轨插件更新失败！\nError code: ' + error.code + '\n' + error.stack + '\n 请稍后重试。')
        return true
      }
      e.reply('星轨插件更新成功，正在尝试重新启动Yunzai以应用更新...')
      e.reply('更新日志：\n' + stdout)
      timer && clearTimeout(timer)

      let data = JSON.stringify({
        isGroup: !!e.isGroup,
        id: e.isGroup ? e.group_id : e.user_id,
        time: new Date().getTime()
      })
      await redis.set('Yz:restart', data, { EX: 120 })
      let npm = await checkPnpm()
      timer = setTimeout(function () {
        let command = `${npm} start`
        if (process.argv[1].includes('pm2')) {
          command = `${npm} run restart`
        }
        exec(command, function (error, stdout, stderr) {
          if (error) {
            e.reply('自动重启失败，请手动重启以应用新版星轨插件。\nError code: ' + error.code + '\n' + error.stack + '\n')
            Bot.logger.error(`重启失败\n${error.stack}`)
            return true
          } else if (stdout) {
            Bot.logger.mark('重启成功，运行已转为后台，查看日志请用命令：npm run log')
            Bot.logger.mark('停止后台运行命令：npm stop')
            process.exit()
          }
        })
      }, 1000)
    })
    return true
  }
}
