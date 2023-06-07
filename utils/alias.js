import YAML from 'yaml';
import fs from 'fs';
import { pluginRoot } from '../utils/path.js';

export async function findName(name) {
  // 读取角色文件
  try {
    const result = await isFileExisted(pluginRoot + '/config/alias.yaml');
    const defaultAlias = {
      阿兰: ['Alan', '阿郎', '阿蓝', 'Arlan'],
      艾丝妲: [
        '爱思达',
        '爱丝妲',
        '爱思妲',
        '爱丝达',
        '艾思达',
        '艾思妲',
        '艾丝达',
        '富婆',
        'Asta',
      ],
      白露: ['龙女', '小龙女', '白鹭', '白鹿', '白麓', 'Bailu'],
      布洛妮娅: [
        '布诺妮亚',
        '布洛妮亚',
        '布诺妮娅',
        '布洛尼亚',
        '鸭鸭',
        '大鸭鸭',
        'Bronya',
      ],
      丹恒: ['单恒', '单垣', '丹垣', '丹桁', '冷面小青龙', 'DanHeng'],
      黑塔: ['人偶', '转圈圈', 'Herta'],
      虎克: ['胡克', 'Hook'],
      姬子: ['机子', '寄子', 'Himeko'],
      杰帕德: ['杰哥', 'Gepard'],
      景元: ['JingYuan'],
      开拓者·存护: ['火爷', '火主', '开拓者存护', '火开拓者'],
      开拓者·毁灭: [
        '物理爷',
        '物爷',
        '物理主',
        '物主',
        '开拓者毁灭',
        '岩开拓者',
      ],
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
      银狼:['音浪', '银浪', '隐狼', '淫狼', '骇兔', '鸭子', '小鸭', '小鸭鸭', 'yinlang', 'YinLang'],
    };
    let nameList = defaultAlias;
    if (result) {
      const fileNameList =
        YAML.parse(
          fs.readFileSync(pluginRoot + '/config/alias.yaml', 'utf8')
        ) || {};
      nameList = { ...defaultAlias, ...fileNameList };
    }
    if (name in nameList) return name;
    let roleName = null;
    Object.keys(nameList).forEach(value => {
      const alias = nameList[value];
      if (alias.includes(name)) {
        roleName = value;
      }
    });
    if (roleName) return roleName;
    else return Promise.reject('未找到角色');
  } catch (error) {
    return Promise.reject(error);
  }
}
function isFileExisted(path) {
  return new Promise((resolve, reject) => {
    fs.access(path, err => {
      if (err) {
        resolve(false); //"不存在"
      } else {
        resolve(true); //"存在"
      }
    });
  });
}
