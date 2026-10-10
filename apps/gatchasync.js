import fs from 'fs'
import path from 'path'
import plugin from '../../../lib/plugins/plugin.js'
import cfg from '../../../lib/config/config.js'
import { rulePrefix } from '../utils/common.js'
import { pluginRoot, _path } from '../utils/path.js'
import {
  SYNC_TYPES,
  SKIPPED_TYPES,
  syncOneType,
  findSrJsonQQ,
  readJsonFile
} from '../utils/gatcha/sync.js'
import { gatchaType } from '../utils/gatcha/gatcha.js'
import NoteUser from '../../genshin/model/mys/NoteUser.js'

export class GatchaSync extends plugin {
  constructor (e) {
    super({
      name: '星铁plugin抽卡记录同步',
      dsc: '与 TRSS/miao 生态（data/srJson）双向同步抽卡记录、导出 UIGF',
      event: 'message',
      // 排在 TRSS 核心 gcLog（priority 300）之后：#星铁导出记录json 等 #-前缀命令仍由
      // TRSS 处理，本插件只接管 * / ＊ 前缀（TRSS 正则不匹配 * 前缀）及 TRSS 未覆盖的形式
      priority: 400,
      rule: [
        {
          reg: `^${rulePrefix}同步抽卡记录$`,
          fnc: 'syncGatcha'
        }
      ]
    })
  }

  /**
   * 解析同步目标（支持 @代同步）：优先 NoteUser.getUid('sr')，回退 redis STAR_RAILWAY:UID:{qq}
   * @returns {Promise<{qq: string, uid: string}>}
   */
  async resolveTarget (e) {
    let userId = e.user_id
    const ats = e.message.filter((m) => m.type === 'at')
    if (ats.length > 0 && !e.atBot) {
      userId = ats[0].qq
    } else if (ats.length > 1) {
      // @bot @用户 的形式：跳过 bot 本身取最后一个被 @ 的用户
      for (let i = ats.length - 1; i >= 0; i--) {
        if (ats[i].qq != e.bot.uin && ats[i].qq != e.bot.tiny_id) {
          userId = ats[i].qq
          break
        }
      }
    }
    let uid = ''
    if (cfg.package.name !== 'yunzai') {
      try {
        const user = await NoteUser.create(userId)
        uid = user?.getUid('sr') || ''
      } catch (err) {
        logger.warn(`[StarRail-plugin] 同步命令解析 NoteUser 失败：${err?.message || err}`)
      }
    }
    uid = uid || await redis.get(`STAR_RAILWAY:UID:${userId}`)
    return { qq: String(userId), uid }
  }

  /**
   * *同步抽卡记录：srJson（TRSS/miao 生态）↔ 插件 data/gatcha 双向合并
   * 不调用游戏 API（不受 1 小时更新冷却限制），仅做本地文件合并；60 秒防抖防连点
   */
  async syncGatcha (e) {
    const { qq: targetQQ, uid } = await this.resolveTarget(e)
    if (!uid) {
      return await e.reply('未绑定uid，请发送#星铁绑定uid进行绑定')
    }

    // 60 秒防抖（同步不调 API，无需 1 小时冷却，但避免连点反复读写文件）
    const debounceKey = `STAR_RAILWAY:GATCHA_SYNC_LASTTIME:${uid}`
    const last = await redis.get(debounceKey)
    if (last && Date.now() - Number(last) < 60 * 1000) {
      return await e.reply('同步冷却中（两次同步需间隔 60 秒），请稍后再试')
    }
    await redis.set(debounceKey, String(Date.now()), { EX: 60 })

    const srRoot = path.join(_path, 'data', 'srJson')
    const uidStr = String(uid)
    // 定位 srJson 源目录：优先目标 qq 名下；没有则全目录扫描该 uid（数据可能挂在其它 qq 下）
    let srQQ = targetQQ
    const sourceNotes = []
    if (!fs.existsSync(path.join(srRoot, srQQ, uidStr))) {
      const found = findSrJsonQQ(srRoot, uid)
      if (found) {
        srQQ = found
        sourceNotes.push(`srJson 数据实际来源：data/srJson/${found}/${uidStr}（${targetQQ} 名下无此 UID 的数据）`)
      }
    }
    const srDirExisted = fs.existsSync(path.join(srRoot, srQQ, uidStr))

    const lines = []
    const backups = []
    let importTotal = 0
    let exportTotal = 0
    let hasCollab = false

    try {
      for (const type of SYNC_TYPES) {
        const pluginFile = path.join(pluginRoot, 'data', 'gatcha', uidStr, `${type}.json`)
        const srFile = path.join(srRoot, srQQ, uidStr, `${type}.json`)
        const result = await syncOneType(type, pluginFile, srFile)
        const name = gatchaType[type] || `类型${type}`
        if (result.status === 'error') {
          lines.push(`◆ ${name}(${type})：${result.error}`)
          continue
        }
        if (result.status === 'empty') {
          continue
        }
        if (type === 21 || type === 22) {
          hasCollab = true
        }
        importTotal += result.addedLocalCount
        exportTotal += result.addedRemoteCount
        if (result.backupPath) {
          backups.push(path.basename(result.backupPath))
        }
        const changes = []
        if (result.addedLocalCount > 0) {
          changes.push(`导入 +${result.addedLocalCount}`)
        }
        if (result.addedRemoteCount > 0) {
          changes.push(`导出 +${result.addedRemoteCount}`)
        }
        const changeText = changes.length > 0 ? changes.join('，') : '无变化'
        lines.push(`◆ ${name}(${type})：srJson ${result.remoteCount} 条 / 插件 ${result.localCount} 条，${changeText}`)
      }
    } catch (err) {
      logger.error(err)
      return await e.reply(`同步失败：${err?.message || err}（此前完成的类型已写入）`)
    }

    // 新手池（type 2）：srJson 可能存在，但插件不落盘（分析时实时拉 API），说明后跳过
    const newbeeFile = path.join(srRoot, srQQ, uidStr, '2.json')
    if (fs.existsSync(newbeeFile)) {
      let count = 0
      try {
        count = readJsonFile(newbeeFile).length
      } catch (err) {
        count = -1
      }
      lines.push(`◆ ${gatchaType[2]}(2)：srJson ${count >= 0 ? `${count} 条` : '有记录'}，${SKIPPED_TYPES[2]}`)
    }

    if (lines.length === 0) {
      return await e.reply([
        `两侧均未找到 UID ${uidStr} 的本地抽卡记录（srJson 与插件侧均为空）。`,
        '可先发送【*更新抽卡记录】拉取，或在 TRSS 侧用【#星铁抽卡记录】更新后再同步。'
      ].join('\n'))
    }

    const replyMsg = [`抽卡记录双向同步完成（UID：${uidStr}）`, ...sourceNotes, ...lines]

    if (importTotal === 0 && exportTotal === 0) {
      replyMsg.push('两侧记录一致，本次无新增')
    } else {
      const totals = []
      if (importTotal > 0) {
        totals.push(`导入 ${importTotal} 条 → 插件`)
      }
      if (exportTotal > 0) {
        totals.push(`导出 ${exportTotal} 条 → srJson`)
      }
      replyMsg.push(`本次${totals.join('，')}`)
    }

    if (backups.length > 0) {
      replyMsg.push(`已备份 srJson 原文件（同目录）：${backups.join('、')}`)
    }
    if (exportTotal > 0 && !srDirExisted) {
      replyMsg.push(`srJson 侧原无此 UID 数据，已在 data/srJson/${srQQ}/${uidStr}/ 新建记录文件`)
    }
    replyMsg.push('提示：miao/TRSS 侧统计需重新触发（重新查询）后才会包含新写入的记录')
    if (hasCollab) {
      replyMsg.push('注：miao 统计暂不读取联动池(21/22)记录，联动数据可用本插件【*联动分析】或 TRSS【#星铁角色联动记录】查看')
    }

    return await e.reply(replyMsg.join('\n'))
  }
}
