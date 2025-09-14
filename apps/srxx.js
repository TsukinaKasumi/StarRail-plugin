// 以下数据均来自于米游社
// 参考面板来自@blue菌hehe
// 强度榜来自@水云109
// 全角色攻略来自@萧熏儿mua
// 星琼预估来自@祈鸢ya
// 深渊攻略来自@栀子0v0
import plugin from '../../../lib/plugins/plugin.js'
import { pluginResources } from '../utils/path.js'
import fs from 'fs'
import fetch from 'node-fetch'
import common from '../../../lib/common/common.js'
import { rulePrefix } from '../utils/common.js'
import alias from '../utils/alias.js'
const srrolePath = `${pluginResources}/srsr/`
export class srxx extends plugin {
  constructor () {
    super({
      name: '星铁插件-角色信息/攻略',
      dsc: '星穹铁道攻略信息数据来自米游社',
      event: 'message',
      priority: -114514,
      rule: [
        {
          reg: `^${rulePrefix}(.*)参考面板$`,
          fnc: 'cankao'
        },
        {
          reg: `^${rulePrefix}参考面板帮助$`,
          fnc: 'srcankaohelp'
        },
        {
          reg: `^${rulePrefix}收益曲线$`,
          fnc: 'srsy'
        },
        {
          reg: `^${rulePrefix}(全角色)?强度榜$`,
          fnc: 'srqd'
        },
        {
          reg: `^${rulePrefix}攻略$`,
          fnc: 'srgl'
        },
        {
          reg: `^${rulePrefix}预估$`,
          fnc: 'srEstimate'
        },
        {
          reg: `^${rulePrefix}(深渊|忘却之庭)攻略$`,
          fnc: 'srsygl'
        },
        {
          reg: `^${rulePrefix}商店光锥推荐$`,
          fnc: 'srgz'
        }
        // {
        //   reg: `^${rulePrefix}(.*)配队$`,
        //   fnc: 'srpd'
        // }
      ]
    })
  }

  async cankao (e) {
    const messageText = e.msg
    const reg = new RegExp(`^${rulePrefix}(.*)参考面板$`)
    const match = messageText.match(reg)
    let name = match[4].trim()
    let role = alias.get(name)
    if (!role) return false
    const roleFiles = this.getRoleList()
    // role = role.replaceAll('•', '·')
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

  async srcankaohelp (e) {
    let msg = [segment.image(`${srrolePath}/help.jpg`)]
    e.reply(msg)
    return true
  }

  async srsy (e) {
    let msg = [
      [
        '基础属性收益曲线',
        segment.image(`${srrolePath}/sy/基础属性收益曲线.jpg`)
      ],
      [
        '生存属性收益曲线',
        segment.image(`${srrolePath}/sy/生存属性收益曲线.jpg`)
      ],
      [
        '最优攻击百分比',
        segment.image(`${srrolePath}/sy/最优攻击百分比.jpg`)
      ],
      [
        '减防收益曲线',
        segment.image(`${srrolePath}/sy/减防收益曲线.jpg`)
      ],
      [
        '减抗收益曲线',
        segment.image(`${srrolePath}/sy/减抗收益曲线.jpg`)
      ]
    ]
    e.reply(await common.makeForwardMsg(e, msg, '星穹铁道收益曲线'))
    return false
  }

  async srqd (e) {
    let msg = [
      [
        '1.0版本角色强度排行榜\n     注意仅供参考!!!',
        segment.image(`${srrolePath}/qd/角色强度榜.jpg`)
      ],
      [
        '输出T0-T1',
        segment.image(`${srrolePath}/qd/输出榜T0-1.jpg`)
      ],
      [
        '输出T2',
        segment.image(`${srrolePath}/qd/输出榜T2.jpg`)
      ],
      [
        '输出T3',
        segment.image(`${srrolePath}/qd/输出榜T3.jpg`)
      ],
      [
        '辅助榜',
        segment.image(`${srrolePath}/qd/辅助榜.jpg`)
      ],
      [
        '生存榜',
        segment.image(`${srrolePath}/qd/生存榜.jpg`)
      ],
      [
        '注意,仅供参考!!!',
        segment.image(`${srrolePath}/qd/备注.jpg`)
      ]
    ]
    e.reply(await common.makeForwardMsg(e, msg, '星穹铁道角色强度排行榜'))
    return false
  }

  async srgl (e) {
    let msg = [
      [
        '「虚无」篇',
        segment.image(`${srrolePath}/gl/虚无.jpg`)
      ],
      [
        '「丰饶」篇',
        segment.image(`${srrolePath}/gl/丰饶.jpg`)
      ],
      [
        '「巡猎」篇',
        segment.image(`${srrolePath}/gl/巡猎.jpg`)
      ],
      [
        '「毁灭」篇',
        segment.image(`${srrolePath}/gl/毁灭.jpg`)
      ],
      [
        '「同谐」篇',
        segment.image(`${srrolePath}/gl/同谐.jpg`)
      ],
      [
        '「存护」篇',
        segment.image(`${srrolePath}/gl/存护.jpg`)
      ],
      [
        '「智识」篇',
        segment.image(`${srrolePath}/gl/智识.jpg`)
      ],
      '注意,仅供参考!!!'
    ]
    e.reply(await common.makeForwardMsg(e, msg, '星穹铁道1.1下半全角色攻略'))
    return false
  }

  async srEstimate (e) {
    const res = await (await fetch("https://bbs-api.miyoushe.com/painter/api/user_instant/search/list?keyword=%E6%98%9F%E7%90%BC%E7%BB%9F%E8%AE%A1&uid=137101761&size=20&offset=0&sort_type=2")).json()
    const post = res.data.list[0].post.post

    let promises = []
    for (let images of post.images)
      promises.push(segment.image(images))

    await Promise.all(promises)

    await e.reply(await common.makeForwardMsg(e, [[post.subject], promises]))
    return true
  }

  async srsygl (e) {
    let msg = [
      segment.image(`${srrolePath}/wq/忘却之庭.jpg`),
      segment.image(`${srrolePath}/wq/1.jpg`),
      [
        '------------其一上半推荐配队------------\n' +
      '推荐输出位:丹恒、希儿、青雀\n' +
      '推荐功能位:银狼、布洛妮娅、艾丝妲、停云\n' +
      '推荐生存位:白露、娜塔莎、火主、杰帕德\n',
        segment.image(`${srrolePath}/wq/2.jpg`)
      ],
      [
        '------------其一下半推荐配队------------\n' +
      '推荐输出位：景元、阿兰、希露瓦、素裳、物主\n' +
      '推荐功能位：银狼、佩拉、停云、瓦尔特\n' +
      '推荐生存位：杰帕德、火主、三月七、娜塔莎、白露\n',
        segment.image(`${srrolePath}/wq/3.jpg`)
      ],
      segment.image(`${srrolePath}/wq/4.jpg`),
      [
        '------------其二上半推荐配队------------\n' +
      '推荐输出位：彦卿、虎克、希儿\n' +
      '推荐功能位：银狼、艾丝妲、停云\n' +
      '推荐生存位：娜塔莎、火主、杰帕德、白露\n',
        segment.image(`${srrolePath}/wq/5.jpg`)
      ],
      [
        '------------其二下半推荐配队------------\n' +
      '推荐输出位：景元、彦卿、阿兰、希露瓦\n' +
      '推荐功能位：银狼、佩拉、停云、瓦尔特\n' +
      '推荐生存位：杰帕德、白露、火主、娜塔莎\n',
        segment.image(`${srrolePath}/wq/6.jpg`)
      ],
      segment.image(`${srrolePath}/wq/7.jpg`),
      [
        '------------其三上半推荐配队------------\n' +
      '推荐输出位：彦卿、景元、阿兰\n' +
      '推荐功能位：银狼、佩拉、停云、瓦尔特\n' +
      '推荐生存位：杰帕德、娜塔莎、白露、三月七\n',
        segment.image(`${srrolePath}/wq/8.jpg`)
      ],
      [
        '------------其三下半推荐配队------------\n' +
      '推荐输出位：景元、彦卿、阿兰、希露瓦\n' +
      '推荐功能位：银狼、佩拉、停云、瓦尔特\n' +
      '推荐生存位：杰帕德、娜塔莎、白露、三月七\n',
        segment.image(`${srrolePath}/wq/9.jpg`)
      ],
      segment.image(`${srrolePath}/wq/10.jpg`),
      [
        '------------其四上半推荐配队------------\n' +
      '推荐输出位：彦卿、景元、阿兰\n' +
      '推荐功能位：银狼、佩拉、停云、瓦尔特\n' +
      '推荐生存位：杰帕德、娜塔莎、白露、三月七\n',
        segment.image(`${srrolePath}/wq/11.jpg`)
      ],
      [
        '--------------其四下半推荐配队--------------\n' +
      '推荐输出位：丹恒、彦卿、希儿、景元\n' +
      '推荐功能位：银狼、艾丝妲、布洛妮娅、瓦尔特、停云\n' +
      '推荐生存位：娜塔莎、火主、杰帕德、白露\n',
        segment.image(`${srrolePath}/wq/12.jpg`)
      ],
      segment.image(`${srrolePath}/wq/13.jpg`),
      [
        '--------------其五上半推荐配队--------------\n' +
      '推荐输出位：希儿、丹恒、青雀\n' +
      '推荐功能位：银狼、艾丝妲、布洛妮娅、瓦尔特、停云' +
      '推荐生存位：娜塔莎、火主、杰帕德、白露\n',
        segment.image(`${srrolePath}/wq/14.jpg`)
      ],
      [
        '------------其五下半推荐配队------------\n' +
      '推荐输出位：景元、姬子、虎克、阿兰、希露瓦\n' +
      '推荐功能位：艾丝妲、停云、银狼\n' +
      '推荐生存位：白露、火主、娜塔莎、杰帕德\n',
        segment.image(`${srrolePath}/wq/15.jpg`)
      ],
      segment.image(`${srrolePath}/wq/16.jpg`),
      [
        '------------其六上半推荐配队------------\n' +
      '推荐输出位：素裳、物主、希儿、彦卿\n' +
      '推荐功能位：艾丝妲、银狼、瓦尔特、佩拉\n' +
      '推荐生存位：娜塔莎、火主、杰帕德、白露\n',
        segment.image(`${srrolePath}/wq/17.jpg`)
      ],
      [
        '-----------其六下半推荐配队-----------\n' +
      '推荐输出位：景元、彦卿、阿兰、希露瓦\n' +
      '推荐功能位：停云、银狼、瓦尔特、佩拉\n' +
      '推荐生存位：白露、杰帕德、娜塔莎\n',
        segment.image(`${srrolePath}/wq/18.jpg`)
      ],
      segment.image(`${srrolePath}/wq/19.jpg`),
      [
        '------------其七上半推荐配队------------\n' +
      '推荐输出位：希儿、虎克、青雀\n' +
      '推荐功能位：艾丝妲、银狼、布洛妮娅、停云\n' +
      '推荐生存位：娜塔莎、火主、白露、杰帕德\n',
        segment.image(`${srrolePath}/wq/20.jpg`)
      ],
      [
        '-----------其七下半推荐配队-----------\n' +
      '推荐输出位：景元、彦卿、阿兰、希露瓦\n' +
      '推荐功能位：停云、银狼、佩拉、瓦尔特\n' +
      '推荐生存位：杰帕德、白露、娜塔莎、火主\n',
        segment.image(`${srrolePath}/wq/21.jpg`)
      ],
      segment.image(`${srrolePath}/wq/22.jpg`),
      [
        '------------其八上半推荐配队------------\n' +
      '推荐输出位：希儿、青雀、丹恒\n' +
      '推荐功能位：艾丝妲、银狼、布洛妮娅、停云\n' +
      '推荐生存位：娜塔莎、白露、杰帕德、火主\n',
        segment.image(`${srrolePath}/wq/23.jpg`)
      ],
      [
        '----------其八下半推荐配队----------\n' +
      '推荐输出位：丹恒、素裳\n' +
      '推荐功能位：银狼、瓦尔特、布洛妮娅\n' +
      '推荐生存位：火主、杰帕德、娜塔莎、白露\n',
        segment.image(`${srrolePath}/wq/24.jpg`)
      ],
      segment.image(`${srrolePath}/wq/25.jpg`),
      [
        '-----------其九上半推荐配队-----------\n' +
      '推荐输出位：彦卿、虎克、希儿\n' +
      '推荐功能位：银狼、艾丝妲、瓦尔特、停云\n' +
      '推荐生存位：杰帕德、白露、娜塔莎、三月七\n',
        segment.image(`${srrolePath}/wq/26.jpg`)
      ],
      [
        '--------------其九下半推荐配队--------------\n' +
      '推荐输出位：景元、阿兰、希露瓦\n' +
      '推荐功能位：停云、银狼、艾丝妲、布洛妮娅、瓦尔特\n' +
      '推荐生存位：火主、白露、杰帕德、娜塔莎\n',
        segment.image(`${srrolePath}/wq/27.jpg`)
      ],
      segment.image(`${srrolePath}/wq/28.jpg`),
      [
        '------------其十上半推荐配队------------\n' +
      '推荐输出位：彦卿、希儿、黑塔、素裳\n' +
      '推荐功能位：佩拉、银狼、瓦尔特、停云\n' +
      '推荐生存位：杰帕德、娜塔莎、三月七、白露\n',
        segment.image(`${srrolePath}/wq/29.jpg`)
      ],
      [
        '---------其十下半推荐配队---------\n' +
      '推荐输出位：希儿、青雀、景元、虎克\n' +
      '推荐功能位：艾丝妲、银狼、停云\n' +
      '推荐生存位：火主、娜塔莎、白露\n',
        segment.image(`${srrolePath}/wq/30.jpg`)
      ]
    ]

    e.reply(await common.makeForwardMsg(e, msg, '忘却之庭攻略V1.0版本'))
    return false
  }

  async srgz (e) {
    let msg = [
      segment.image(`${srrolePath}/gz/商店光锥推荐.jpg`)
    ]
    e.reply(msg)
    return true
  }
}
