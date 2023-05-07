import plugin from '../../../lib/plugins/plugin.js'
import { pluginResources } from '../utils/path.js'
import fs from 'fs'
import { segment } from 'icqq'

const rolePath = `${pluginResources}/strategy/角色`

const roleAlias = {
  阿兰: ['Alan', '阿郎', '阿蓝'],
  艾丝妲: ['爱思达', '爱丝妲', '爱思妲', '爱丝达', '艾思达', '艾思妲', '艾丝达'],
  白露: ['龙女', '小龙女', '白鹭', '白鹿', '白麓'],
  布洛妮娅: ['布诺妮亚', '布洛妮亚', '布诺妮娅', '布洛尼亚', '鸭鸭', '大鸭鸭'],
  丹恒: ['单恒', '单垣', '丹垣', '丹桁', '冷面小青龙'],
  黑塔: ['人偶', '转圈圈'],
  虎克: ['胡克'],
  姬子: ['机子', '寄子'],
  杰帕德: ['杰哥'],
  景元: [],
  开拓者·存护: ['火爷', '火主', '开拓者存护'],
  开拓者·毁灭: ['物理爷', '物爷', '物理主', '物主', '开拓者毁灭'],
  克拉拉: ['可拉拉', '史瓦罗'],
  娜塔莎: ['那塔莎', '那塔沙', '娜塔沙'],
  佩拉: ['配拉', '佩啦', '冰砂糖'],
  青雀: ['青却', '卿雀'],
  三月七: ['三月', '看板娘', '三七', '三祁'],
  桑博: [],
  素裳: ['李素裳'],
  停云: ['停运', '听云'],
  瓦尔特: ['杨叔', '老杨', '瓦尔特杨'],
  希儿: ['希尔'],
  希露瓦: ['希录瓦'],
  彦卿: ['言情', '彦情', '彦青', '言卿', '燕青']
}

export class strategy extends plugin {
  constructor () {
    super({
      name: '星穹铁道-攻略',
      dsc: '查询崩坏：星穹铁道的角色攻略 数据来源于米游社',
      event: 'message',
      priority: 400,
      rule: [
        {
          reg: '^#(.*)(攻略)$',
          fnc: 'strategy'
        }
      ]
    })
  }

  async strategy (e) {
    const reg = /^#(.*)(攻略)$/
    const match = reg.exec(e.msg)
    let roleName = match[1].trim()

    let isSend = false

    const roleFiles = this.getRoleList()
    if (roleFiles.includes(roleName)) {
      isSend = true
    } else {
      Object.keys(roleAlias).forEach((value) => {
        const alias = roleAlias[value]
        if (alias.includes(roleName)) {
          roleName = value
          isSend = true
        }
      })
    }

    if (isSend) {
      const image = segment.image(`${rolePath}/${roleName}.png`)
      this.reply(image)
      return true
    }

    logger.mark(`[星穹铁道-攻略][strategy]未找到角色 [${roleName}] 放行消息交由云崽处理.`)
    return false
  }

  getRoleList () {
    const roleFiles = fs.readdirSync(rolePath)
    return roleFiles
      .filter((file) => file.endsWith('.png'))
      .map((file) => file.replace(/.png/g, ''))
  }
}
