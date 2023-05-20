import plugin from '../../../lib/plugins/plugin.js'
import { pluginResources } from '../utils/path.js'
import fs from 'fs'

const rolePath = `${pluginResources}/strategy/角色/`

const roleAlias = {
  阿兰: ['Alan', '阿郎', '阿蓝', 'Arlan'],
  艾丝妲: ['爱思达', '爱丝妲', '爱思妲', '爱丝达', '艾思达', '艾思妲', '艾丝达', '富婆', 'Asta'],
  白露: ['龙女', '小龙女', '白鹭', '白鹿', '白麓', 'Bailu'],
  布洛妮娅: ['布诺妮亚', '布洛妮亚', '布诺妮娅', '布洛尼亚', '鸭鸭', '大鸭鸭', 'Bronya'],
  丹恒: ['单恒', '单垣', '丹垣', '丹桁', '冷面小青龙', 'DanHeng'],
  黑塔: ['人偶', '转圈圈', 'Herta'],
  虎克: ['胡克', 'Hook'],
  姬子: ['机子', '寄子', 'Himeko'],
  杰帕德: ['杰哥', 'Gepard'],
  景元: ['JingYuan'],
  开拓者·存护: ['火爷', '火主', '开拓者存护', '火开拓者'],
  开拓者·毁灭: ['物理爷', '物爷', '物理主', '物主', '开拓者毁灭', '岩开拓者'],
  克拉拉: ['可拉拉', '史瓦罗', 'Clara'],
  娜塔莎: ['那塔莎', '那塔沙', '娜塔沙', 'Natasha','渡鸦'],
  佩拉: ['配拉', '佩啦', '冰砂糖', 'Pela'],
  青雀: ['青却', '卿雀', 'Qingque'],
  三月七: ['三月', '看板娘', '三七', '三祁', '纠缠之缘', 'March7th', '37'],
  桑博: ['Sampo'],
  素裳: ['李素裳', 'Sushang'],
  停云: ['停运', '听云', 'Tingyun'],
  瓦尔特: ['杨叔', '老杨', 'Welt'],
  希儿: ['希尔', 'Seele'],
  希露瓦: ['希录瓦', 'Serval'],
  彦卿: ['言情', '彦情', '彦青', '言卿', '燕青', 'Yanqing']
}

export class strategy extends plugin {
  constructor () {
    super({
      name: '星铁plugin-角色攻略',
      dsc: '查询崩坏：星穹铁道的角色攻略 数据来源于米游社',
      event: 'message',
      priority: 400,
      rule: [
        {
          reg: '^#?(.*)(攻略([1-4])?)$',
          fnc: 'strategy'
        }
      ]
    })
  }

  async strategy (e) {
    const reg = /^#?(.*)(攻略([1-4])?)$/
    const match = reg.exec(e.msg)
    let roleName = match[1].trim()
    let group = match[3] ? match[3] : "1"
    
    let isSend = false

    const roleFiles = this.getRoleList(group)
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
      // const image = segment.image(`${rolePath}${group}/${roleName}.jpg`)
      // this.reply(image)
      let result = []
      result.imagePath = `${rolePath}${group}/${roleName}.webp`
      await e.runtime.render('StarRail-plugin', '/strategy/strategy.html', result)
      return true
    }

    logger.mark(`[星穹铁道-攻略][strategy]未找到角色 [${roleName}] 放行消息交由云崽处理.`)
    return false
  }

  getRoleList (group) {
    const Path = rolePath + group;
    const roleFiles = fs.readdirSync(Path)
    return roleFiles
      .filter((file) => file.endsWith('.webp'))
      .map((file) => file.replace(/.webp/g, ''))
  }
}
