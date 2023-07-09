import setting from './setting.js'
import _ from 'lodash'

export default new class {
  /**
   * @description: 获取别名
   * @param {string} name 要匹配的名称
   * @return {string|false} 未匹配到别名则返回false
   */
  get (name) {
    const aliasList = { ...defAlias, ...setting.getConfig('alias') }
    // 读取角色文件
    if (name in aliasList) return name
    const roleName = _.findKey(aliasList, alias => alias.includes(name))
    if (roleName) {
      return roleName
    } else {
      logger.error('[星铁别名]未找到角色')
      return false
    }
  }
  
  getAllName () {
    // 读取角色文件
    return { ...defAlias, ...setting.getConfig('alias') }
  }
}()
const defAlias = {
  阿兰: ['Alan', '阿郎', '阿蓝', 'Arlan'],
  艾丝妲: ['爱思达', '爱丝妲', '爱思妲', '爱丝达', '艾思达', '艾思妲', '艾丝达', '富婆', 'Asta'],
  白露: ['龙女', '小龙女', '白鹭', '白鹿', '白麓', 'Bailu'],
  布洛妮娅: ['布诺妮亚', '布洛妮亚', '布诺妮娅', '布洛尼亚', '鸭鸭', '大鸭鸭', 'Bronya'],
  丹恒: ['单恒', '单垣', '丹垣', '丹桁', '冷面小青龙', 'DanHeng'],
  黑塔: ['人偶', '转圈圈', 'Herta'],
  虎克: ['胡克', 'Hook'],
  姬子: ['机子', '寄子', 'Himeko'],
  杰帕德: ['杰哥', 'Gepard', '杰帕徳', '杰杰'],
  景元: ['JingYuan', '景云'],
  开拓者·存护: ['火爷', '火主', '开拓者存护', '火开拓者'],
  开拓者·毁灭: ['物理爷', '物爷', '物理主', '物主', '开拓者毁灭', '岩开拓者'],
  克拉拉: ['可拉拉', '史瓦罗', 'Clara'],
  娜塔莎: ['那塔莎', '那塔沙', '娜塔沙', 'Natasha', '渡鸦'],
  佩拉: ['配拉', '佩啦', '冰砂糖', 'Pela'],
  青雀: ['青却', '卿雀', 'Qingque'],
  三月七: ['三月', '看板娘', '三七', '三祁', '纠缠之缘', 'March7th', '37'],
  桑博: ['Sampo'],
  素裳: ['李素裳', 'Sushang'],
  停云: ['停运', '听云', 'Tingyun'],
  瓦尔特: ['杨叔', '老杨', 'Welt'],
  希儿: ['希尔', 'Seele'],
  希露瓦: ['希录瓦', 'Serval'],
  彦卿: ['言情', '彦情', '彦青', '言卿', '燕青', 'Yanqing'],
  银狼: ['淫狼', '音浪', 'yinglang', 'Yinglang', '野狼', '英朗'],
  罗刹: ['罗差','罗莎','落差','螺子','lc','裸查','luocha'],
  驭空: ['俊空','军空','junk','jk','yukong',],
  刃: ['ren','刀刃','忍','任','人','仁'],
  卡芙卡: ['kfk','卡夫卡','咖啡','卡夫','卡','夫人','卡浮卡'],
  符玄: ['fx','浮选','复选','符仙'],
}
