import plugin from '../../../lib/plugins/plugin.js';
import { pluginRoot } from '../utils/path.js';
import lodash from 'lodash';
import moment from 'moment';
import User from '../../genshin/model/user.js';
import fetch from 'node-fetch';
import fs from 'node:fs';
import { rulePrefix } from '../utils/common.js';
import gachaInfo from '../utils/gachasimulation.js';
import setting from '../utils/setting.js';

export default class Gacha extends plugin {
  /**
   * @param e icqq 消息e
   * @param e.user_id 用户id
   */
  constructor(e) {
    super({
      name: '星穹铁道',
      dsc: '星穹铁道抽卡插件',
      event: 'message',
      priority: -114514,
      rule: [
        {
          /** 命令正则匹配 */
          reg: `^${rulePrefix}(抽卡|十连)(角色|光锥|常驻)?$`,
          /** 执行方法 */
          fnc: 'main',
        },
      ],
    });
    this.User = new User(e);
    this.type = '';
    this.gachaThisTime = [];
    this.config = setting.getConfig('gccfg');
    try {
      // 读取武器对应id的json
      this.weaponJson = JSON.parse(
        fs.readFileSync(
          pluginRoot +
            '/resources/gachasimulation/resources/appdata/equipment.json',
          'utf8'
        )
      );
      this.weaponLife = JSON.parse(
        fs.readFileSync(
          pluginRoot +
            '/resources/gachasimulation/resources/appdata/equipment2life.json',
          'utf8'
        )
      );
      this.charDamageTypeJson = JSON.parse(
        fs.readFileSync(
          pluginRoot +
            '/resources/gachasimulation/resources/appdata/chardamagetype.json',
          'utf8'
        )
      );
      this.charToCharID = JSON.parse(
        fs.readFileSync(
          pluginRoot +
            '/resources/gachasimulation/resources/appdata/char2charid.json',
          'utf8'
        )
      );
    } catch (error) {
      Promise.reject(error);
    }
  }
  // 获取抽卡类型
  async getGachaType() {
    let type = 'up-char';
    if (this.e.msg.includes('角色')) {
      type = 'up-char';
    } else if (this.e.msg.includes('光锥')) {
      type = 'up-weapon';
    } else if (this.e.msg.includes('常驻')) {
      type = 'normal';
    }
    this.type = type;
    return type;
  }
  // 获取 Redis key
  getKey() {
    if (this.e.isGroup) {
      return `sr-gacha:group:${this.e.group_id}:user:${this.e.user_id}`;
    } else {
      return `sr-gacha:private:${this.e.user_id}`;
    }
  }
  // 获取抽卡记录数据
  async getGachaData() {
    if (this.gachaData) return this.gachaData;
    let key = this.getKey();
    let data = await redis.get(key);
    let today = moment().format('YYYY-MM-DD');
    const defaultData = {
      time: today,
      'up-char': {
        isUp5: false,
        isUp4: false,
        num4: 0,
        num5: 0,
        today: {
          stars: [],
        },
      },
      'up-weapon': {
        isUp5: false,
        isUp4: false,
        num4: 0,
        num5: 0,
        today: {
          stars: [],
        },
      },
      normal: {
        isUp5: false,
        isUp4: false,
        num4: 0,
        num5: 0,
        today: {
          stars: [],
        },
      },
    };
    if (data) {
      data = JSON.parse(data);
      if (data.time != today) {
        data.time = today;
        data['up-char'].today.stars = [];
        data['up-weapon'].today.stars = [];
        data['normal'].today.stars = [];
        await redis.setEx(key, 3600 * 24 * 14, JSON.stringify(data));
      }
      this.gachaData = data;
    } else {
      data = defaultData;
      this.gachaData = defaultData;
    }
    return data;
  }
  // 判断是否可以抽卡
  async canGacha() {
    logger.mark(this.config);
    if (!this.config.limit.group && this.e.isGroup) {
      return false;
    }
    if (!this.config.limit.private && !this.e.isGroup) {
      return false;
    }
    let data = await this.getGachaData();
    let currentData = data[this.type];
    let count = currentData.today.stars.length || 0;
    if (
      this.config.limit.count != 0 &&
      count * 10 >= this.config.limit.count &&
      !this.e.isMaster
    ) {
      let fiveCount = 0;
      currentData.today.stars.forEach(element => {
        if (element.star === 5) {
          fiveCount++;
        }
      });
      this.e.reply(
        `今日抽已抽${count}抽，${
          fiveCount ? `其中${fiveCount}个五星` : '没有五星'
        }，明日再来吧`
      );
      return false;
    }
    return true;
  }
  // 写入抽卡数据
  async setGachaData(data) {
    // 先获取数据
    let key = this.getKey();
    let gachaData = await this.getGachaData();
    // 写入 Redis
    await redis.setEx(key, 3600 * 24 * 14, JSON.stringify(data));
    this.gachaData = gachaData;
  }
  // 概率计算
  async probability() {
    let prob = 0;
    if (this.type === 'up-char' || this.type === 'normal') {
      prob = 60;
      /** 保底 */
      if (this.gachaData[this.type].num5 >= 90) {
        prob = 10000;
      } else if (this.gachaData[this.type].num5 >= 74) {
        /** 74抽之后逐渐增加概率 */
        prob = 590 + (this.gachaData[this.type].num5 - 74) * 530;
      } else if (this.gachaData[this.type].num5 >= 60) {
        /** 60抽之后逐渐增加概率 */
        prob = 60 + (this.gachaData[this.type].num5 - 50) * 40;
      }
    } else if (this.type === 'up-weapon') {
      prob = 75;
      /** 80次都没中五星 */
      if (this.gachaData[this.type].num5 >= 80) {
        prob = 10000;
      } else if (this.gachaData[this.type].num5 >= 62) {
        /** 62抽后逐渐增加概率 */
        prob = prob + (this.gachaData[this.type].num5 - 61) * 700;
      } else if (this.gachaData[this.type].num5 >= 45) {
        /** 50抽后逐渐增加概率 */
        prob = prob + (this.gachaData[this.type].num5 - 45) * 60;
      } else if (
        this.gachaData[this.type].num5 >= 10 &&
        this.gachaData[this.type].num5 <= 20
      ) {
        prob = prob + (this.gachaData[this.type].num5 - 10) * 30;
      }
    }
    return prob;
  }

  // 抽卡
  // 五星
  async lottery5() {
    /** 是否大保底 */
    let isBigUP = false;
    let tmpChance5 = await this.probability();
    let preNum5 = this.gachaData[this.type].num5 + 1 || 1;
    /** 没有抽中五星 */
    if (lodash.random(1, 10000) > tmpChance5) {
      /** 五星保底数 +1 */
      this.gachaData[this.type].num5++;
      return false;
    }
    /** 五星保底清零 */
    this.gachaData[this.type].num5 = 0;
    /** 四星保底数 +1 */
    this.gachaData[this.type].num4++;
    /** 五星中 up 的概率 */
    let upProba = 50;
    /** 抽中物品属性 */
    let type = 1;
    let weaponLifeName = '';
    let charDamageType = '';
    let charImageName = '';
    /** 抽中物品图片名 */
    let fileName = '';
    /** 如果已经小保底 */
    if (this.gachaData[this.type].isUp5 == true) {
      /** 概率拉爆 */
      upProba = 101;
    }
    if (this.type == 'normal') upProba = 0;

    let tmpName = '';
    if (lodash.random(1, 100) <= upProba) {
      if (this.type == 'up-char') {
        /** 当祈愿获取到5星角色时，有50%的概率为本期UP角色 */
        if (this.gachaData[this.type].isUp5 == true) isBigUP = true;
        /** 大保底清零 */
        this.gachaData[this.type].isUp5 = false;
        /** 抽取up */
        tmpName = gachaInfo.gachaPool['up-char'].five;
        charDamageType = this.charDamageTypeJson[this.charToCharID[tmpName]];
        charImageName = 'char_image/' + this.charToCharID[tmpName] + '.png';
      } else {
        /** 当祈愿获取到5星武器时，有75%的概率为本期UP武器 */
        if (this.gachaData[this.type].isUp5 == true) isBigUP = true;
        /** 大保底清零 */
        this.gachaData[this.type].isUp5 = false;
        /** 抽取up */
        tmpName = gachaInfo.gachaPool['up-weapon'].five;
        type = 2;
        fileName = 'weapon/' + this.weaponJson[tmpName] + '.png';
        weaponLifeName = 'weaponlife/' + this.weaponLife[tmpName] + '.png';
      }
    } else {
      if (this.type == 'normal') {
        if (lodash.random(1, 100) <= 50) {
          const chars = gachaInfo.gachaPool.normal.char;
          tmpName = lodash.sample(chars);
          charDamageType = this.charDamageTypeJson[this.charToCharID[tmpName]];
          charImageName = 'char_image/' + this.charToCharID[tmpName] + '.png';
        } else {
          const weapons = gachaInfo.gachaPool.normal.weapon;
          type = 2;
          tmpName = lodash.sample(weapons);
          fileName = 'weapon/' + this.weaponJson[tmpName] + '.png';
          weaponLifeName = 'weaponlife/' + this.weaponLife[tmpName] + '.png';
        }
      } else {
        /** 歪了 大保底 */
        this.gachaData[this.type].isUp5 = true;
        const chars = gachaInfo.gachaPool.normal.char;
        tmpName = lodash.sample(chars);
        charDamageType = this.charDamageTypeJson[this.charToCharID[tmpName]];
        charImageName = 'char_image/' + this.charToCharID[tmpName] + '.png';
      }
    }
    /** 记录今天五星 */
    const result = {
      name: tmpName,
      star: 5,
      isBigUP,
      count: preNum5,
      type,
      fileName,
      weaponLifeName,
      charDamageType,
      charImageName,
    };
    this.hasFive = true;
    this.gachaThisTime.push(result);
    this.gachaData[this.type].today.stars.push(result);
    return true;
  }
  // 四星
  async lottery4() {
    let tmpChance4 = 510;
    let type = 1;
    let fileName = '';
    let weaponLifeName = '';
    if (this.type == 'up-weapon') tmpChance4 = 660;
    /** 四星保底 */
    if (this.gachaData[this.type].num4 >= 9) {
      tmpChance4 += 10000;
    } else if (this.gachaData[this.type].num4 >= 5) {
      tmpChance4 =
        tmpChance4 + Math.pow(this.gachaData[this.type].num4 - 4, 2) * 500;
    }
    /** 没抽中四星 */
    if (lodash.random(1, 10000) > tmpChance4) {
      /** 四星保底数+1 */
      this.gachaData[this.type].num4++;
      return false;
    }
    /** 保底四星数清零 */
    this.gachaData[this.type].num4 = 0;
    /** 四星保底 */
    let tmpUp = 50;
    if (this.gachaData[this.type].isUp4 == true) {
      this.gachaData[this.type].isUp4 = false;
      tmpUp = 100;
    }
    if (this.type == 'normal') tmpUp = 0;
    let charDamageType = '';
    let charImageName = '';
    let tmpName = '';
    /** 当祈愿获取到4星物品时，有50%的概率为本期UP角色 */
    if (lodash.random(1, 100) <= tmpUp) {
      /** up 4星 */
      if (this.type == 'up-char') {
        const chars = gachaInfo.gachaPool['up-char'].four;
        tmpName = lodash.sample(chars);
        charDamageType = this.charDamageTypeJson[this.charToCharID[tmpName]];
        charImageName = 'char_image/' + this.charToCharID[tmpName] + '.png';
      } else {
        const weapons = gachaInfo.gachaPool['up-weapon'].four;
        type = 2;
        tmpName = lodash.sample(weapons);
        fileName = 'weapon/' + this.weaponJson[tmpName] + '.png';
        weaponLifeName = 'weaponlife/' + this.weaponLife[tmpName] + '.png';
      }
    } else {
      this.gachaData[this.type].isUp4 = true;
      /** 一半概率武器 一半4星 */
      if (lodash.random(1, 100) <= 50 && this.type == 'up-char') {
        const chars = gachaInfo.gachaPool['four-char'];
        tmpName = lodash.sample(chars);
        charDamageType = this.charDamageTypeJson[this.charToCharID[tmpName]];
        charImageName = 'char_image/' + this.charToCharID[tmpName] + '.png';
      } else {
        const weapons = gachaInfo.gachaPool['four-weapon'];
        type = 2;
        tmpName = lodash.sample(weapons);
        fileName = 'weapon/' + this.weaponJson[tmpName] + '.png';
        weaponLifeName = 'weaponlife/' + this.weaponLife[tmpName] + '.png';
      }
    }
    /** 记录今天四星 */
    const result = {
      name: tmpName,
      star: 4,
      type,
      fileName,
      weaponLifeName,
      charDamageType,
      charImageName,
    };
    this.gachaThisTime.push(result);
    this.gachaData[this.type].today.stars.push(result);
    return true;
  }
  // 三星
  lottery3() {
    /** 随机三星武器 */
    const weapons = gachaInfo.gachaPool['three-weapon'];
    let tmpName = lodash.sample(weapons);
    let fileName = 'weapon/' + this.weaponJson[tmpName] + '.png';
    let weaponLifeName = 'weaponlife/' + this.weaponLife[tmpName] + '.png';
    /** 记录今天三星 */
    const result = {
      name: tmpName,
      star: 3,
      type: 2,
      fileName,
      weaponLifeName,
    };
    this.gachaThisTime.push(result);
    this.gachaData[this.type].today.stars.push(result);
    return true;
  }
  // 抽卡函数
  async lottery() {
    this.gachaThisTime = [];
    this.hasFive = false;
    /** 十连抽 */
    for (let i = 1; i <= 10; i++) {
      this.index = i;
      if (await this.lottery5()) continue;
      if (await this.lottery4()) continue;
      this.lottery3();
    }
    await this.setGachaData(this.gachaData);
    return this.gachaThisTime;
  }
  // 执行抽卡
  async main() {
    this.gachaData = null;
    await this.getGachaType();
    let str = '抽到了：';
    // 判断是否可以抽卡
    if (!(await this.canGacha())) return;
    // 抽卡
    const result = await this.lottery();
    result.forEach(item => {
      str += `${item.name} `;
    });
    let data = {
      user_name: this.e.sender.card,
      result: [
        [result[0], result[1], result[2]],
        [result[3], result[4], result[5], result[6]],
        [result[7], result[8], result[9]],
      ],
    };
    const imageData = await this.e.runtime.render(
      'StarRail-plugin',
      '/gachasimulation/gacha.html',
      data,
      {
        retType: 'base64',
      }
    );
    this.e.reply(imageData, false, {
      recallMsg:
        this.hasFive || !this.config.recall.enable
          ? 0
          : this.config.recall.time
          ? this.config.recall.time
          : 110,
    });
  }
}
