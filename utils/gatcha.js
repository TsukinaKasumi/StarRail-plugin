import fetch from 'node-fetch'
import _ from 'lodash'
import moment from 'moment'

// const demo = {
//   uid: '105099680',
//   gacha_id: '1001',
//   gacha_type: '1',
//   item_id: '20006',
//   count: '1',
//   time: '2023-04-30 17:11:17',
//   name: '智库',
//   lang: 'zh-cn',
//   item_type: '光锥',
//   rank_type: '3',
//   id: '1682845800002458280'
// }

export const gatchaType = {
  11: '限定跃迁',
  12: '光锥跃迁',
  1: '群星跃迁',
  2: '新手跃迁',
  0: '数据总览'
}

const gatchaRole = new Map([
  [2003, {
    gacha_id: '2003',
    gacha_name: '蝶立锋锷',
    gacha_type: '1',
    time: ['2023-04-25 09:00', '2023-05-17 17:59']
  }],
  [2004, {
    gacha_id: '2004',
    gacha_name: '天戈麾斥',
    gacha_type: '1',
    time: ['2023-05-17 18:00', '2023-06-06 14:59']
  }]
])

const gatchaWeapon = new Map([
  [3003, {
    gacha_id: '3003',
    gacha_name: '流光定影(拂晓之前)',
    gacha_type: '1',
    time: ['2023-04-25 09:00', '2023-05-17 17:59']
  }],
  [3004, {
    gacha_id: '3004',
    gacha_name: '流光定影(于夜色中)',
    gacha_type: '1',
    time: ['2023-05-17 18:00', '2023-06-06 14:59']
  }]
])

const lastTime = [moment('2023-05-17 18:00'), moment('2023-06-06 14:59')]

export async function getRecords (type = 11, authKey) {
  let page = 1
  let data = {
    data: {}
  }
  let endId = 0
  let result = []
  do {
    logger.info(`正在获取${gatchaType[type]}第${page}页`)
    const url = getRecordUrl(type, page, 20, authKey, endId)
    const response = await fetch(url)
    data = await response.json()
    result.push(...data.data.list)
    endId = result[result.length - 1]?.id
    // 延迟500ms，防止请求过快
    await new Promise(resolve => setTimeout(resolve, 500))
    page++
  } while (data.data.list && data.data.list.length > 0)

  logger.info(`=== ${gatchaType[type]}记录拉取完成 ===`)
  return result
}

export async function statistics (authKey) {
  const data = {
    mapData: new Map(),
    totalGatchaNum: 0, // 总抽卡数
    rarityNum: { 5: 0, 4: 0 }, // 总计
    roleRarityNum: { 5: 0, 4: 0 }, // 角色总计
    weaponRarityNum: { 5: 0, 4: 0 }, // 光锥总计
    currGatchaNum: 0 // 本期抽卡总数
  }

  // 获取全部抽卡记录
  const arr = _.keys(_.omit(gatchaType, [0, 2]))
  const getData = async (i) => {
    if (i) {
      const item = { typeName: gatchaType[i], rarityNum: { 5: 0, 4: 0 } }
      const recordsSrc = await getRecords(i, authKey)
      const until = { 5: 0, 4: 0 }
      item.records = _.reduce(recordsSrc.reverse(), (prev, curr, index) => {
        const currTime = moment(curr.time)
        data.totalGatchaNum++
        until[curr.rank_type]++

        if (currTime.diff(lastTime[0]) > 0 && currTime.diff(lastTime[1]) < 0) {
          data.currGatchaNum++
        }

        if (curr.rank_type == 4 || curr.rank_type == 5) {
          const newCurr = { ...curr, url: imageUrls[curr.name] }

          item.rarityNum[curr.rank_type]++
          data.rarityNum[curr.rank_type]++

          prev.push(newCurr)
          until[curr.rank_type] = 0

          if (curr.item_type === '光锥') {
            data.weaponRarityNum[curr.rank_type]++
          } else {
            data.roleRarityNum[curr.rank_type]++
          }
        }
        return prev
      }, [])
      data.mapData.set(i, item)
      await new Promise(resolve => setTimeout(resolve, 1000))
      _.remove(arr, (x) => x === i)
      await getData(arr[0])
    }
  }

  await getData(arr[0])

  return data
  // logger.info(data)

  // return data
  // let records = await getRecords(type, authKey)
  // let total = records.length
  // let rarity5Num = records.filter(item => item.rank_type === '5').length
  // let rarity4Num = records.filter(item => item.rank_type === '4').length
  // let rarity5Rate = ((rarity5Num / total) * 100).toFixed(2) + '%'
  // let rarity4Rate = ((rarity4Num / total) * 100).toFixed(2) + '%'
  // let events = []
  // let rarity5Until = 0
  // let rarity4Until = 0
  // records.reverse().forEach(record => {
  //   if (record.rank_type === '5') {
  //     events.push({
  //       name: record.name,
  //       time: record.time,
  //       until: rarity5Until,
  //       rarity: 5,
  //       url: imageUrls[record.name]
  //     })
  //     rarity5Until = 0
  //     rarity4Until = 0
  //   } else {
  //     rarity5Until++
  //   }
  //   if (record.rank_type === '4') {
  //     events.push({
  //       name: record.name,
  //       time: record.time,
  //       until: rarity4Until,
  //       rarity: 4,
  //       url: imageUrls[record.name]
  //     })
  //     rarity4Until = 0
  //   } else {
  //     rarity4Until++
  //   }
  // })
  // events = events.reverse()
  // return {
  //   total, rarity5Num, rarity4Num, rarity5Rate, rarity4Rate, events, rarity5Until
  // }
}

function getServer (uid) {
  switch (String(uid).slice(0, -8)) {
    case '1':
    case '2':
      return 'prod_gf_cn' // 官服
    case '5':
      return 'prod_qd_cn' // B服
    case '6':
      return 'prod_official_usa' // 美服
    case '7':
      return 'prod_official_euro' // 欧服
    case '8':
    case '18':
      return 'prod_official_asia' // 亚服
    case '9':
      return 'prod_official_cht' // 港澳台服
  }
  return 'prod_gf_cn'
}

function getRecordUrl (type, page, size = 10, authKey = '', endId = 0) {
  if (['prod_gf_cn', 'prod_qd_cn'].includes(getServer(uid)))
    return `https://api-takumi.mihoyo.com/common/gacha_record/api/getGachaLog?authkey_ver=1&default_gacha_type=11&lang=zh-cn&authkey=${authKey}&game_biz=hkrpg_cn&page=${page}&size=${size}&gacha_type=${type}&end_id=${endId}`
  else if (/official/.test(getServer(uid)))
    return `https://api-os-takumi.mihoyo.com/common/gacha_record/api/getGachaLog?authkey_ver=1&default_gacha_type=11&lang=zh-cn&authkey=${authKey}&game_biz=hkrpg_global&page=${page}&size=${size}&gacha_type=${type}&end_id=${endId}`
}

export const imageUrls = {
  景元: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/24/288909604/95a06162f7df44a2b068e66939268b10_2067278512630665501.png?x-oss-process=image/quality,q_75/resize,s_280',
  希儿: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/23/288909604/90322bba0235561a0da0c5b22d6edb3d_5700836084211407678.png?x-oss-process=image/quality,q_75/resize,s_280',
  彦卿: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/24/288909604/cc600801af1f864cfb32bbfb01d9d867_5952117643253221767.png?x-oss-process=image/quality,q_75/resize,s_280',
  白露: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/24/159305577/c684357d96e8098e898e4ee6665fd01c_7826766061944986617.png?x-oss-process=image/quality,q_75/resize,s_280',
  姬子: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/24/288909604/4d5ac247ca1460b34b3f73244afbb0f6_8390343856757982675.png?x-oss-process=image/quality,q_75/resize,s_280',
  瓦尔特: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/24/288909604/d5a01ddc0494595417fee74fa3285b56_8110023215605946848.png?x-oss-process=image/quality,q_75/resize,s_280',
  布洛妮娅: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/24/288909604/b6419ce18c6fbfbbbaffa7dd68d676f5_767729707412690608.png?x-oss-process=image/quality,q_75/resize,s_280',
  克拉拉: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/24/288909604/827cb6eecdd28086ce68a1f39a9a0e09_6530506214724480230.png?x-oss-process=image/quality,q_75/resize,s_280',
  杰帕德: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/288909604/b2e6481377ac48abdca73a65e2d15052_1464378270277851447.png?x-oss-process=image/quality,q_75/resize,s_280',
  开拓者·毁灭: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/26/288909604/bb5959b4a67a0637f6862b2c8ba163ed_3921856926987798793.png?x-oss-process=image/quality,q_75/resize,s_280',
  开拓者·存护: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/24/288909604/1d351a764ae64aeed744296503bc6266_9196637429550074047.png?x-oss-process=image/quality,q_75/resize,s_280',
  三月七: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/24/288909604/6a4bd3468e9dbd577f26dbf8757f0b03_924968634176225322.png?x-oss-process=image/quality,q_75/resize,s_280',
  丹恒: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/24/159305577/e4a8703a06b4c42d692133c17b2cdc27_5408538855331042463.png?x-oss-process=image/quality,q_75/resize,s_280',
  青雀: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/25/289862258/2b3abc5a3dbed9d233e61c11f659473c_3453594130231722833.png?x-oss-process=image/quality,q_75/resize,s_280',
  停云: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/25/289862258/03d149b04918d43c1af097ee73858444_5948029424202771419.png?x-oss-process=image/quality,q_75/resize,s_280',
  黑塔: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/24/159305577/2f3693ba8a48e4a81832dac8344a2d14_1221820779792422378.png?x-oss-process=image/quality,q_75/resize,s_280',
  艾丝妲: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/24/159305577/4022a164be9404b271a965ec786cbf26_7272957779066061269.png?x-oss-process=image/quality,q_75/resize,s_280',
  希露瓦: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/24/159305577/e996982958ab237d46fd813099afbada_1034866961853716191.png?x-oss-process=image/quality,q_75/resize,s_280',
  娜塔莎: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/22/288909604/98045ee394641ca42188a9c6b5ae186e_7769781659310285488.png?x-oss-process=image/quality,q_75/resize,s_280',
  桑博: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/24/159305577/4021500c08db5dd7600373963a8fd7ae_2164524026920543792.png?x-oss-process=image/quality,q_75/resize,s_280',
  虎克: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/24/159305577/ced28df529eadd5d3a65a74d7cd0f1ee_1327794469495696321.png?x-oss-process=image/quality,q_75/resize,s_280',
  阿兰: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/24/159305577/d17025f2f6c52f10ccbcc93a0acd1b70_8940478888129430393.png?x-oss-process=image/quality,q_75/resize,s_280',
  佩拉: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/24/289862258/7099a63b46954eedc038bffc991a0437_5445770148856337075.png?x-oss-process=image/quality,q_75/resize,s_280',
  素裳: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/24/289862258/0f662b3c3a7f76bb8bab25dc48f3bef4_6922898942843883883.png?x-oss-process=image/quality,q_75/resize,s_280',
  拂晓之前: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/23/214441058/a1f733dd784fbc6ecffc2a09b0b11104_7972399684465006295.png?x-oss-process=image/quality,q_75/resize,s_280',
  天才们的休憩: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/190590294/e751871e7cda9a1c3a0004866db887b4_4470314258641119676.png?x-oss-process=image/quality,q_75/resize,s_280',
  于夜色中: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/23/214441058/fc882563a44b54e78d5e5f9a1e8c4399_4525887876546013963.png?x-oss-process=image/quality,q_75/resize,s_280',
  记忆的质料: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/23/109341043/0ef2f92a4ee6f5bf8b848e6b2555ffa9_4868302018570081407.png?x-oss-process=image/quality,q_75/resize,s_280',
  星海巡航: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/23/288909604/a2b3f93e2efa2a18941ea6eef3c8367e_6303407602832083418.png?x-oss-process=image/quality,q_75/resize,s_280',
  记一位星神的陨落: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/26/288909604/5de6ade884bf419dc2adc1815bd5a109_1893890981000298645.png?x-oss-process=image/quality,q_75/resize,s_280',
  银河铁道之夜: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/23/214441058/6c099fbdcd488fdb7408e4132e562403_4528940612834658072.png?x-oss-process=image/quality,q_75/resize,s_280',
  以世界之名: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/23/214441058/21886feabacbc0b5a4410a8da110317f_602268217580203504.png?x-oss-process=image/quality,q_75/resize,s_280',
  但战斗还未结束: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/23/214441058/eb12f0678e96a9264c8b67d38e95f0d8_3498440638007475874.png?x-oss-process=image/quality,q_75/resize,s_280',
  制胜的瞬间: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/23/214441058/779152d00007614b68c5bf6c7e5ac1b4_7130725355751336176.png?x-oss-process=image/quality,q_75/resize,s_280',
  无可取代的东西: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/23/214441058/bf0c26e434d9ab68ac5380f3e3d68846_3240303378927572941.png?x-oss-process=image/quality,q_75/resize,s_280',
  时节不居: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/22/214441058/e1f40839f00bd80e1060f00f4cba61b2_8158676828966241566.png?x-oss-process=image/quality,q_75/resize,s_280',
  如泥酣眠: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/23/214441058/165b709388e973ac51e3bc790a0cfeff_5625680177342760428.png?x-oss-process=image/quality,q_75/resize,s_280',
  春水初生: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/190590294/66a5f01dda8f0a7da58fb89abb7aef6f_1142572140416843653.png?x-oss-process=image/quality,q_75/resize,s_280',
  '点个关注吧！': 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/190590294/e77c0b0db54799d6bd5e0496886a1c3a_3192066082147055344.png?x-oss-process=image/quality,q_75/resize,s_280',
  决心如汗珠般闪耀: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/190590294/d20eb92c6e6b45e01a74a3eae3236a0c_8544948651264708528.png?x-oss-process=image/quality,q_75/resize,s_280',
  过往未来: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/190590294/80a0f12ef4c0e5f1695405b45d64253f_7149236409595209371.png?x-oss-process=image/quality,q_75/resize,s_280',
  '舞！舞！舞！': 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/190590294/65b8f2e9cb7397b6c45e5f1c217c9619_945859113093771003.png?x-oss-process=image/quality,q_75/resize,s_280',
  延长记号: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/190590294/46d03cb796c707c47eafc4be4d7a6429_239093705735527333.png?x-oss-process=image/quality,q_75/resize,s_280',
  我们是地火: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/190590294/0e829ea93e161cc0245dae46c2d18149_4486331441913943344.png?x-oss-process=image/quality,q_75/resize,s_280',
  宇宙市场趋势: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/190590294/48204f8db9e77016a30146a81a5fbf83_6906827343452491493.png?x-oss-process=image/quality,q_75/resize,s_280',
  等价交换: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/190590294/10f8e4b3fe4a9819a59cb2537ea8cf78_5953019562556435160.png?x-oss-process=image/quality,q_75/resize,s_280',
  此时恰好: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/190590294/2747312b548540c7a54233ce4d28ec93_1891498790757437734.png?x-oss-process=image/quality,q_75/resize,s_280',
  在蓝天下: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/22/190590294/ae08a1fb40c821ab314dfb833713a762_5172986260277745251.png?x-oss-process=image/quality,q_75/resize,s_280',
  '汪！散步时间！': 'https://act-upload.mihoyo.com/sr-wiki/2023/04/23/214441058/8374260f67cc5344eb48ad7f9e38eccc_3079203861207027155.png?x-oss-process=image/quality,q_75/resize,s_280',
  无处可逃: 'https://uploadstatic.mihoyo.com/sr-wiki/2023/04/21/288909602/b1e02ca609100c2893a81df73b3bd579_6100932689589816632.png?x-oss-process=image/quality,q_75/resize,s_280',
  重返幽冥: 'https://uploadstatic.mihoyo.com/sr-wiki/2023/04/21/288909602/da687b7cd5565c4886047ecc8dcc7035_8168745811377466824.png?x-oss-process=image/quality,q_75/resize,s_280',
  今日亦是和平的一日: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/288909604/17f059bf3a7b77c184bf7e7571c29365_4959888878352010800.png?x-oss-process=image/quality,q_75/resize,s_280',
  早餐的仪式感: 'https://uploadstatic.mihoyo.com/sr-wiki/2023/04/21/288909602/2b4508ad5bce4db860214f0ce20813ca_3972556125864564980.png?x-oss-process=image/quality,q_75/resize,s_280',
  镂月裁云之意: 'https://uploadstatic.mihoyo.com/sr-wiki/2023/04/21/288909602/93de9d798632df0c9ea660ac33926ba2_2747835853468939355.png?x-oss-process=image/quality,q_75/resize,s_280',
  后会有期: 'https://uploadstatic.mihoyo.com/sr-wiki/2023/04/21/288909602/0255c9eadff1083f7ce7b3fc958f8c0d_289765888772424889.png?x-oss-process=image/quality,q_75/resize,s_280',
  '这就是我啦！': 'https://uploadstatic.mihoyo.com/sr-wiki/2023/04/21/288909602/a6ba39da97774add5a33f21e3301310e_2372315290004238322.png?x-oss-process=image/quality,q_75/resize,s_280',
  暖夜不会漫长: 'https://uploadstatic.mihoyo.com/sr-wiki/2023/04/21/288909602/31696161875bfbfef1396f8fb68f5be6_2865781185367897767.png?x-oss-process=image/quality,q_75/resize,s_280',
  别让世界静下来: 'https://uploadstatic.mihoyo.com/sr-wiki/2023/04/21/288909602/556f94c66963b491c52f32323a51a841_6058128284624785268.png?x-oss-process=image/quality,q_75/resize,s_280',
  秘密誓心: 'https://uploadstatic.mihoyo.com/sr-wiki/2023/04/21/288909602/4058e6a3ca810444e16303d8f99e3cbf_2957053108094306450.png?x-oss-process=image/quality,q_75/resize,s_280',
  与行星相会: 'https://uploadstatic.mihoyo.com/sr-wiki/2023/04/21/288909602/e3481c397c1b6ecbe31d72091519f1b9_5419696652493888402.png?x-oss-process=image/quality,q_75/resize,s_280',
  论剑: 'https://uploadstatic.mihoyo.com/sr-wiki/2023/04/21/288909602/8ea6e08e213f1463dd592913057591b7_1597110980342981033.png?x-oss-process=image/quality,q_75/resize,s_280',
  朗道的选择: 'https://uploadstatic.mihoyo.com/sr-wiki/2023/04/21/288909602/4fc10608f7f63460220af99661eff9eb_2173462361556697626.png?x-oss-process=image/quality,q_75/resize,s_280',
  猎物的视线: 'https://uploadstatic.mihoyo.com/sr-wiki/2023/04/21/288909602/38142aab2e325f056fb903192712cd94_8435381312479183931.png?x-oss-process=image/quality,q_75/resize,s_280',
  同一种心情: 'https://uploadstatic.mihoyo.com/sr-wiki/2023/04/21/288909602/97c0debc944e304c0054c136d18c50f1_6722877704474086839.png?x-oss-process=image/quality,q_75/resize,s_280',
  '「我」的诞生': 'https://uploadstatic.mihoyo.com/sr-wiki/2023/04/21/288909602/3ff519a5181824f854811e6ca77e208c_509101673108415116.png?x-oss-process=image/quality,q_75/resize,s_280',
  鼹鼠党欢迎你: 'https://uploadstatic.mihoyo.com/sr-wiki/2023/04/21/288909602/7fc99a0d879716aca211a681ff410c89_692449159536190412.png?x-oss-process=image/quality,q_75/resize,s_280',
  记忆中的模样: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/23/214441058/db37e0f07974f38f2482584d3ea1343c_5398624370127048356.png?x-oss-process=image/quality,q_75/resize,s_280',
  唯有沉默: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/23/214441058/ccecfa65e89a767692c3d6b198e67375_8116761189465044541.png?x-oss-process=image/quality,q_75/resize,s_280',
  余生的第一天: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/23/214441058/97235128d3abb0e6227653256a7a9b59_7891226001801475234.png?x-oss-process=image/quality,q_75/resize,s_280',
  晚安与睡颜: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/23/214441058/6af2613ab53f384442122bfd27720f92_1559406493845442336.png?x-oss-process=image/quality,q_75/resize,s_280',
  一场术后对话: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/23/214441058/8b5deffd89904c55ac8d1fccc57a47af_7384354830209959343.png?x-oss-process=image/quality,q_75/resize,s_280',
  灵钥: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/23/214441058/09aec132b62a41a787a7a89ebfb9ba7f_4056017462349383335.png?x-oss-process=image/quality,q_75/resize,s_280',
  轮契: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/23/214441058/2d5a26a86d6401a3826b029a9cfeebfb_615755650846272907.png?x-oss-process=image/quality,q_75/resize,s_280',
  渊环: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/23/214441058/5516b364c118b5f59699df8926fc9af9_5293043332629217911.png?x-oss-process=image/quality,q_75/resize,s_280',
  戍御: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/23/214441058/7bcda699ff0fbe7e55643c541c426a42_30081035558284699.png?x-oss-process=image/quality,q_75/resize,s_280',
  乐圮: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/23/214441058/3ce71ad24bb9b5239a0d251cf6a78b7c_8652755492929625822.png?x-oss-process=image/quality,q_75/resize,s_280',
  嘉果: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/23/214441058/f97ca99cf03bfa210945ad220891302b_876506868934440869.png?x-oss-process=image/quality,q_75/resize,s_280',
  离弦: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/23/214441058/fc4dac32f3a90eb614eb8852b4944c0a_339074751134485637.png?x-oss-process=image/quality,q_75/resize,s_280',
  智库: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/23/214441058/4486e863f260f041f33f97853888417a_3420723413949371482.png?x-oss-process=image/quality,q_75/resize,s_280',
  齐颂: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/23/214441058/75eb0b7c88042f1bce8766da913d1eeb_4996861006675453708.png?x-oss-process=image/quality,q_75/resize,s_280',
  幽邃: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/23/214441058/49f73c7aac0155c42b68e3e839112487_5366746539759678931.png?x-oss-process=image/quality,q_75/resize,s_280',
  琥珀: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/23/214441058/957d8d26619f747b71850143c32ee1a9_6419055775139402596.png?x-oss-process=image/quality,q_75/resize,s_280',
  天倾: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/23/214441058/7deb06a9a24d66e5f5ea4202d611d3bf_5037156115374524018.png?x-oss-process=image/quality,q_75/resize,s_280',
  物穰: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/23/214441058/b93d356f7286d3d6ddd184dabbcab5bd_7272163511585222070.png?x-oss-process=image/quality,q_75/resize,s_280',
  锋镝: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/23/214441058/cef0df677c17b578cb7643759a52a5ee_4307166806168746030.png?x-oss-process=image/quality,q_75/resize,s_280',
  俱殁: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/22/103492603/5d68684855c1e6356991ec106160bb15_7665516313130129576.png?x-oss-process=image/quality,q_75/resize,s_280',
  相抗: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/22/103492603/3c0cbb7b550046e3decd11f36f474d53_6579811914373072860.png?x-oss-process=image/quality,q_75/resize,s_280',
  睿见: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/22/103492603/c75dcb67628de9898cf56d8cf3da31b0_5106499027839641089.png?x-oss-process=image/quality,q_75/resize,s_280',
  蕃息: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/22/103492603/0a70d8b3db45dbd1ef7d725df4fc6c63_7009915096429872669.png?x-oss-process=image/quality,q_75/resize,s_280',
  开疆: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/22/103492603/2a13e4c462242f585d1a359534f08207_804645297709649387.png?x-oss-process=image/quality,q_75/resize,s_280',
  匿影: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/22/103492603/52a5dc8b7e0aa01f070cbb207ebd3012_5303839694063749956.png?x-oss-process=image/quality,q_75/resize,s_280',
  调和: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/22/103492603/0526f6f02fb22d4f89e672f42b5080d2_7025757600934747848.png?x-oss-process=image/quality,q_75/resize,s_280',
  '「药王秘传」内丹士': 'https://act-upload.mihoyo.com/sr-wiki/2023/04/25/103492603/2e285d3b6718acc9e0b6623cdd377ff7_5512011134397871517.png?x-oss-process=image/quality,q_75/resize,s_280',
  丰饶玄鹿: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/25/288909604/f08066fee5df0f1fdfbd633d5c81a4be_4066486575355259398.png?x-oss-process=image/quality,q_75/resize,s_280',
  末日兽: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/288909604/c57e54ebadc6e10aedb19c91bcb6a06a_704924455591261836.png?x-oss-process=image/quality,q_75/resize,s_280',
  '可可利亚，虚妄之母': 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/288909604/38761cfa61da8c85d8bf409b3c59ef1c_3827174624233599983.png?x-oss-process=image/quality,q_75/resize,s_280',
  '「星核猎手」卡芙卡': 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/288909604/32567e10f96cfbacdd3283e1e1551187_3759454088329732270.png?x-oss-process=image/quality,q_75/resize,s_280',
  可可利亚: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/288909604/40ddd5f62f4df0e3edab594f7bf2fa54_3667627014647535363.png?x-oss-process=image/quality,q_75/resize,s_280',
  史瓦罗: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/288909604/ef947365faf6c3ea8aa46e5b95f9bca7_746149786718128555.png?x-oss-process=image/quality,q_75/resize,s_280',
  '「药王秘传」炼形者': 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/288909604/980b87a65ebf909d5bedb97c0ae61776_7684913377751874277.png?x-oss-process=image/quality,q_75/resize,s_280',
  魔阴身士卒: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/288909604/0fb9671638faac70834ea25f76b5ee57_7354014869330902272.png?x-oss-process=image/quality,q_75/resize,s_280',
  云骑巡防士卒: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/288909604/44187ae972d2a8551d5b4d92f6221b38_7710503623690509732.png?x-oss-process=image/quality,q_75/resize,s_280',
  金人司阍: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/288909604/83e926bee4843f6a9f01b4eab1003c42_733530918338521078.png?x-oss-process=image/quality,q_75/resize,s_280',
  入魔机巧·浓云金蟾: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/288909604/c463d049113bb082c69701b44cf1ac58_4814718634939815140.png?x-oss-process=image/quality,q_75/resize,s_280',
  入魔机巧·率从狻猊: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/288909604/593e0af2e91d3f843a4cf97a6eae1f7c_7546753584811252454.png?x-oss-process=image/quality,q_75/resize,s_280',
  入魔机巧·灯昼龙鱼: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/288909604/4171d8fa7989c1fefd0721799a1dda4e_2988759635324974738.png?x-oss-process=image/quality,q_75/resize,s_280',
  '自动机兵「甲虫」': 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/288909604/e1fe494505e2b929f33dc895c4618e22_4275144307416918893.png?x-oss-process=image/quality,q_75/resize,s_280',
  '自动机兵「齿狼」': 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/288909604/3fd226fe208650572e0dc2f9eab57fe3_1122530943730815373.png?x-oss-process=image/quality,q_75/resize,s_280',
  '自动机兵「蜘蛛」': 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/288909604/bdee7075e2250d32a1dfec3e8c071a48_6704456636806439845.png?x-oss-process=image/quality,q_75/resize,s_280',
  '自动机兵「灰熊」': 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/288909604/84b180ce66388b96b487910a6335e4f1_4759795030150858275.png?x-oss-process=image/quality,q_75/resize,s_280',
  '自动机兵「战犬」': 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/288909604/ac26149f3f8932e895d0045b32a94f29_7558527997088987576.png?x-oss-process=image/quality,q_75/resize,s_280',
  蚕食者之影: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/75216984/818ce27dc4bf48992c31a6ad74e994e0_8583984469218999429.png?x-oss-process=image/quality,q_75/resize,s_280',
  兴风者: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/288909604/cadf955d0e22c67ecb83149b4d52bf73_7459797066356559418.png?x-oss-process=image/quality,q_75/resize,s_280',
  深寒徘徊者: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/288909604/6efbeec979c08a1724cc9fd9a6d3a75d_4591783050905069810.png?x-oss-process=image/quality,q_75/resize,s_280',
  炽燃徘徊者: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/288909604/f2b9177295a9f4704f310f36f2e9a5d0_7559323677346584104.png?x-oss-process=image/quality,q_75/resize,s_280',
  虚数织叶者: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/288909604/ca057fd59c28108406b5b531192bafa2_5861299786370133241.png?x-oss-process=image/quality,q_75/resize,s_280',
  外宇宙之冰: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/288909604/b67c3e45a7dbf3a9717e2306bdb957fe_7912459172604459851.png?x-oss-process=image/quality,q_75/resize,s_280',
  外宇宙之炎: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/288909604/dc53b92cc8d9f51346428c45638d70c0_8702113272035780322.png?x-oss-process=image/quality,q_75/resize,s_280',
  无想面具: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/288909604/6e54341680f38206ee9fc4340eda5c7d_802664113938521853.png?x-oss-process=image/quality,q_75/resize,s_280',
  重子: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/288909604/40c27768e7441e239bb34556bccc2535_1675023277471997253.png?x-oss-process=image/quality,q_75/resize,s_280',
  反重子: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/288909604/2cf82ed838a7c7343279a83bfa0513ab_5003022123779448260.png?x-oss-process=image/quality,q_75/resize,s_280',
  次元扑满: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/288909604/c6a43f73b37c6c70a27f6e87212a34ee_6531031428749325700.png?x-oss-process=image/quality,q_75/resize,s_280',
  鸣雷造物: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/288909604/b771a057d8ca64fde563939d9ef48f84_7318632806519468830.png?x-oss-process=image/quality,q_75/resize,s_280',
  巽风造物: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/288909604/a07624d82c6f8eaf0c3c019060ccfc7c_6245582962645125902.png?x-oss-process=image/quality,q_75/resize,s_280',
  霜晶造物: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/288909604/ac849b62181d9e1908239f5da250ff57_1880955697297958177.png?x-oss-process=image/quality,q_75/resize,s_280',
  炎华造物: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/288909604/1a78ca70d7c98f28a390b994e1901a90_8974827657925391356.png?x-oss-process=image/quality,q_75/resize,s_280',
  虚卒·践踏者: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/288909604/b4a4a3f8dd83619a51c303cdd7dd9451_4501482520349259452.png?x-oss-process=image/quality,q_75/resize,s_280',
  虚卒·篡改者: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/288909604/8241a72d680e571a62e308f9e57b81b9_4520657017447196972.png?x-oss-process=image/quality,q_75/resize,s_280',
  虚卒·抹消者: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/288909604/d79f73041fbf59c7909396bc8bf088c7_6594239061442496664.png?x-oss-process=image/quality,q_75/resize,s_280',
  虚卒·掠夺者: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/288909604/6c6243815612809c2debc58d14a39d6c_2308088671673411210.png?x-oss-process=image/quality,q_75/resize,s_280',
  守护者之影: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/288909604/e0c4ee6835fd48c31a590023c11b24ee_6653963221843874641.png?x-oss-process=image/quality,q_75/resize,s_280',
  银鬃炮手: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/288909604/e8abb5264f2a61608e4af5f6ba8faebd_1085920574843717439.png?x-oss-process=image/quality,q_75/resize,s_280',
  银鬃射手: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/288909604/5d9c12a3eeb63be6ad0768e481711678_6227578393659357578.png?x-oss-process=image/quality,q_75/resize,s_280',
  银鬃尉官: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/288909604/bbd891ade7cd204d25cbe6d012af98e5_6645869544991975345.png?x-oss-process=image/quality,q_75/resize,s_280',
  银鬃近卫: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/288909604/9b650451e6f56d67deb7cb3159c5a09a_6325695445042784171.png?x-oss-process=image/quality,q_75/resize,s_280',
  流浪者: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/288909604/a9e7493e5a37d962766f187aed01919b_1515860484503819418.png?x-oss-process=image/quality,q_75/resize,s_280',
  火焚灾影: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/288909604/8ce94358092b06ef369f07cb446b3fca_4555453472258517049.png?x-oss-process=image/quality,q_75/resize,s_280',
  永冬灾影: 'https://act-upload.mihoyo.com/sr-wiki/2023/04/21/288909604/c051041edf9ae65317a8df23f083d58e_7750743927917395135.png?x-oss-process=image/quality,q_75/resize,s_280'
}