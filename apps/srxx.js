//以下数据均来自于米游社
//参考面板来自blue菌hehe
//强度榜来自水云109
//全角色攻略来自萧熏儿mua

import plugin from '../../../lib/plugins/plugin.js';
import { pluginResources } from '../utils/path.js';
import fs from 'fs';
import common from '../../../lib/common/common.js';
import { rulePrefix } from '../utils/common.js'
import alias from '../utils/alias.js'
const srrolePath = `${pluginResources}/srsr/`;

export class srxx extends plugin {
  constructor() {
    super({
      name: '星铁插件-角色信息/攻略',
      dsc: '星穹铁道角色信息',
      event: 'message',
      priority: -114514,
      rule: [
        {
          reg: `^${rulePrefix}(.*)参考面板$`,
          fnc: 'cankao',
        }, 
        {
          reg: `^${rulePrefix}参考面板帮助$`,
          fnc: 'srcankaohelp',
        },
        {
          reg: `^${rulePrefix}收益曲线$`,
          fnc: 'srsy',
        },
        {
          reg: `^${rulePrefix}(全角色)?强度榜$`,
          fnc: 'srqd',
        },
        {
          reg: `^${rulePrefix}攻略$`,
          fnc: 'srgl',
        },
      ],
    });
  }


  async cankao (e) {
    const messageText = e.msg;
    const reg = new RegExp(`^${rulePrefix}(.*)参考面板$`)
    const match = messageText.match(reg)
    let name = match[4].trim()
    let role = alias.get(name)
    if (!role) return false
    const roleFiles = this.getRoleList()
    if (roleFiles.includes(role)) {
      const image = segment.image(`${srrolePath}/${role}.jpg`)
      this.reply(image)
      return true
    }
    await this.e.reply(`暂无[${role}]参考面板`)
    return false
  }
  
    getRoleList () {
      const roleFiles = fs.readdirSync(srrolePath)
      return roleFiles
        .filter((file) => file.endsWith('.jpg'))
        .map((file) => file.replace(/.jpg/g, ''))
    }


  async srcankaohelp(e) {
  let msg = [segment.image(`${srrolePath}/help.jpg`),]
        e.reply(msg)
        return true
  }


 
 async srsy (e) {
  let msg = []
  msg.push('基础属性收益曲线',segment.image(`${srrolePath}/sy/基础属性收益曲线.jpg`))
  msg.push('生存属性收益曲线',segment.image(`${srrolePath}/sy/生存属性收益曲线.jpg`))
  msg.push('最优攻击百分比',segment.image(`${srrolePath}/sy/最优攻击百分比.jpg`)) 
  msg.push('减防收益曲线',segment.image(`${srrolePath}/sy/减防收益曲线.jpg`))
  msg.push('减抗收益曲线',segment.image(`${srrolePath}/sy/减抗收益曲线.jpg`))
  e.reply(await common.makeForwardMsg(e,msg,`星穹铁道收益曲线`))
    return false
 }

 async srqd (e) {
  let msg = []
  msg.push('1.1版本角色强度排行榜\n     注意仅供参考!!!',segment.image(`${srrolePath}/sy/角色强度榜.jpg`))
  msg.push('输出T0-T1',segment.image(`${srrolePath}/sy/输出榜T0-1.jpg`))
  msg.push('输出T2',segment.image(`${srrolePath}/sy/输出榜T2.jpg`))
  msg.push('输出T3',segment.image(`${srrolePath}/sy/输出榜T3.jpg`))
  msg.push('辅助榜',segment.image(`${srrolePath}/sy/辅助榜.jpg`))
  msg.push('生存榜',segment.image(`${srrolePath}/sy/生存榜.jpg`))
  msg.push('注意,仅供参考!!!',segment.image(`${srrolePath}/sy/备注.jpg`))
  e.reply(await common.makeForwardMsg(e,msg,`星穹铁道角色强度排行榜`))
    return false
 }

 async srgl (e) {
  let msg = []
  msg.push('「虚无」篇',segment.image(`${srrolePath}/gl/虚无.jpg`))
  msg.push('「丰饶」篇',segment.image(`${srrolePath}/gl/丰饶.jpg`))
  msg.push('「巡猎」篇',segment.image(`${srrolePath}/gl/巡猎.jpg`))
  msg.push('「毁灭」篇',segment.image(`${srrolePath}/gl/毁灭.jpg`))
  msg.push('「同谐」篇',segment.image(`${srrolePath}/gl/同谐.jpg`))
  msg.push('「存护」篇',segment.image(`${srrolePath}/gl/存护.jpg`))
  msg.push('「智识」篇',segment.image(`${srrolePath}/gl/智识.jpg`))
  msg.push('注意,仅供参考!!!')
  e.reply(await common.makeForwardMsg(e,msg,`星穹铁道全角色攻略`))
    return false
 }
}
