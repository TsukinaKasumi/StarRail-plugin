/* eslint-disable camelcase */
import User from '../../genshin/model/user.js';
import panelApi from '../runtime/PanelApi.js';
import fetch from 'node-fetch';
import MysSRApi from '../runtime/MysSRApi.js';
import _ from 'lodash';
import fs from 'fs';
import path from 'path';
import { pluginRoot, pluginResources } from '../utils/path.js';
import { findName } from '../utils/alias.js';
import { getSign } from '../utils/auth.js';
import { rulePrefix } from '../utils/common.js';
import setting from '../utils/setting.js';
import runtimeRender from '../common/runtimeRender.js';

export class hkrpg extends plugin {
  constructor(e) {
    super({
      name: '星铁plugin-面板',
      dsc: '星穹铁道面板信息',
      /** https://oicqjs.github.io/oicq/#events */
      event: 'message',
      priority: 1,
      rule: [
        {
          reg: `^${rulePrefix}(.+)面板(更新)?$`,
          fnc: 'panel',
        },
        {
          reg: `^${rulePrefix}面板(列表)?$`,
          fnc: 'ikun',
        },
        {
          reg: `^${rulePrefix}(更新面板|面板更新)$`,
          fnc: 'update',
        },
        {
          reg: `^${rulePrefix}(设置|切换)面板(API|api)?`,
          fnc: 'changeApi',
        },
        {
          reg: `^${rulePrefix}(API|api)列表`,
          fnc: 'apiList',
        },
        {
          reg: '^#?原图$',
          fnc: 'origImg',
        },
      ],
    });
    this.User = new User(e);
  }

  async panel(e) {
    let user = this.e.user_id;
    let ats = e.message.filter(m => m.type === 'at');
    const messageText = e.msg;
    let messageReg = new RegExp(`^${rulePrefix}(.+)面板(更新)?`);
    const matchResult = messageText.match(messageReg);
    const charName = matchResult ? matchResult[4] : null;
    if (!charName) return await this.ikun(e);
    if (charName === '更新' || matchResult[5]) return await this.update(e);
    let uid = messageText.replace(messageReg, '');
    if (!uid) {
      if (ats.length > 0 && !e.atBot) {
        user = ats[0].qq;
      }
      await this.miYoSummerGetUid();
      uid = await redis.get(`STAR_RAILWAY:UID:${user}`);
    }
    if (!uid) {
      return await e.reply('尚未绑定uid,请发送#星铁绑定uid进行绑定');
    }
    // await e.reply('正在获取面板数据中')
    try {
      const api = await panelApi();
      let data = await this.getCharData(charName, uid, e);
      data.uid = uid;
      data.api = api.split('/')[2];
      // 引入遗器地址数据
      let relicsPathData = pluginRoot + '/resources/panel/data/relics.json';
      relicsPathData = JSON.parse(fs.readFileSync(relicsPathData, 'utf-8'));
      // 引入角色数据
      let charData = pluginRoot + '/resources/panel/data/character.json';
      charData = JSON.parse(fs.readFileSync(charData, 'utf-8'));
      data.charpath = charData[data.avatarId].path;
      data.relics.forEach((item, i) => {
        const filePath = relicsPathData[item.id].icon;
        data.relics[i].path = filePath;
      });
      data.behaviorList.splice(5);
      data.behaviorList.forEach((item, i) => {
        const nameId = item.id.toString().slice(0, 4);
        let pathName = '';
        switch (i) {
          case 0:
            pathName = 'basic_atk';
            break;
          case 1:
            pathName = 'skill';
            break;
          case 2:
            pathName = 'ultimate';
            break;
          case 3:
            pathName = 'talent';
            break;
          case 4:
            pathName = 'technique';
            break;
        }
        const filePath = nameId + '_' + pathName + '.png';
        data.behaviorList[i].path = filePath;
      });
      // 面板图
      data.charImage = this.getCharImage(data.name, data.avatarId);
      logger.debug('面板图:', data.charImage);
      let msgId = await runtimeRender(
        e,
        'StarRail-plugin',
        '/panel/panel.html',
        data,
        {
          retType: 'msgId',
        }
      );
      msgId &&
        redis.setEx(
          `STAR_RAILWAY:panelOrigImg:${msgId.message_id}`,
          60 * 60,
          data.charImage
        );
    } catch (error) {
      logger.error('SR-panelApi', error);
      return await e.reply(error.message);
    }
  }

  /** 获取面板图 */
  getCharImage(name, avatarId) {
    const folderPath = 'profile/normal-character/';
    const fullFolderPath = pluginResources + '/' + folderPath;
    const leadId = {
      星: [8002, 8004],
      穹: [8001, 8003],
    };
    _.forIn(leadId, (v, k) => {
      if (v.includes(avatarId)) name = k;
    });
    if (fs.existsSync(fullFolderPath + `${name}.webp`)) {
      return folderPath + `${name}.webp`;
    } else if (fs.existsSync(fullFolderPath + name)) {
      return this.getRandomImage(folderPath + name);
    } else {
      // 适配原文件位置
      return this.getRandomImage(`panel/resources/char_image/${avatarId}`);
    }
  }

  /** 随机取文件夹图片 */
  getRandomImage(dirPath) {
    let _path = pluginResources + '/' + dirPath;
    const files = fs.readdirSync(_path);
    const images = files.filter(file => {
      return /\.(jpg|png|webp)$/i.test(file);
    });
    const randomNum = Math.floor(Math.random() * images.length);
    return dirPath + '/' + images[randomNum];
  }

  async update(e) {
    let user = this.e.user_id;
    let ats = e.message.filter(m => m.type === 'at');
    if (ats.length > 0 && !e.atBot) {
      user = ats[0].qq;
    }
    await this.miYoSummerGetUid();
    let uid = await redis.get(`STAR_RAILWAY:UID:${user}`);
    if (!uid) {
      return await e.reply('尚未绑定uid,请发送#星铁绑定uid进行绑定');
    }
    try {
      const api = await panelApi();
      const data = await this.getPanelData(uid, true);
      let renderData = {
        api: api.split('/')[2],
        uid,
        data,
      };
      // 渲染数据
      await runtimeRender(e, 'StarRail-plugin', '/panel/card.html', renderData);
      // await e.reply( '更新面板数据成功' );
    } catch (error) {
      logger.error('SR-panelApi', error);
      return await e.reply(error.message);
    }
  }
  // 查看API列表
  async apiList(e) {
    if (!e.isMaster) return await e.reply('仅限主人可以查看API列表');
    const apiConfig = setting.getConfig('panelApi');
    const apiList = apiConfig.api;
    let msg = 'API列表：\n';
    apiList.forEach((item, i) => {
      msg += `${i + 1}：${item.split('/')[2]}\n`;
    });
    await e.reply(msg);
  }
  // 切换API
  async changeApi(e) {
    if (!e.isMaster) return await e.reply('仅限主人可以切换API');
    const reg = /[1-9][0-9]*/g;
    const match = reg.exec(e.msg);
    if (!match || match.length < 1) return await e.reply('请输入正确的API序号');
    let apiIndex = match[match.length - 1];
    try {
      apiIndex = parseInt(apiIndex) - 1;
      // 获取API配置
      let apiConfig = setting.getConfig('panelApi');
      const apiList = apiConfig.api;
      if (!apiList[apiIndex]) return await e.reply('请输入正确的API序号');
      apiConfig.default = apiIndex + 1;
      setting.setConfig('panelApi', apiConfig);
      return await e.reply(
        `切换API成功，当前API：${apiList[apiIndex].split('/')[2]}`
      );
    } catch (error) {
      return await e.reply('切换API失败，请前往控制台查看报错！');
    }
  }
  /**
   * 获取角色数据
   * @param {string} name 角色名称
   * @param {number|string} uid 角色UID
   * @param e
   * @returns {Promise} 使用 try catch 捕获错误
   */
  async getCharData(name, uid, e) {
    const data = await this.getPanelData(uid, false, true);
    const charName = await findName(name);
    const charInfo = data.filter(item => item.name === charName)[0];
    if (!charInfo) {
      const data = await this.getPanelData(uid, true);
      const charInfo = data.filter(item => item.name === charName)[0];
      if (!charInfo) {
        throw Error(
          '未查询到角色数据，请检查角色是否放在了助战或者展柜，检查角色名是否正确，已设置的会有延迟，请等待一段时间重试。'
        );
      }
      return charInfo;
    }
    return charInfo;
  }

  /**
   * 获取面板数据
   * @param {number|string} uid 角色UID
   * @param {boolean} isForce 是否强制更新数据
   * @returns {Promise} 使用 try catch 捕获错误
   */
  async getPanelData(uid, isForce = false, forceCache = false) {
    const timeKey = `STAR_RAILWAY:userPanelDataTime:${uid}`;
    let previousData = await readData(uid);
    if ((previousData.length < 1 || isForce) && !forceCache) {
      logger.mark('SR-panelApi强制查询');
      await this.e.reply('正在更新面板数据中~可能需要一段时间，请耐心等待');
      try {
        logger.mark('SR-panelApi开始查询', uid);
        let time = await redis.get(timeKey);
        if (time) {
          time = parseInt(time);
          const leftTime = Date.now() - time;
          if (leftTime < 1 * 60 * 1000) {
            const seconds = Math.ceil((1 * 60 * 1000 - leftTime) / 1000);
            throw Error(`查询过于频繁，请${seconds}秒后重试`);
          }
        }
        const api = await panelApi();
        let res = null;
        let cardData = null;
        try {
          res = await fetch(api + uid, {
            headers: {
              'x-request-sr': getSign(uid),
              library: 'hewang1an',
            },
          });
          cardData = await res.json();
        } catch (error) {
          logger.error(error);
          throw Error('面板服务连接超时，请稍后重试');
        }
        if (!res) throw Error('面板服务连接超时，请稍后重试');
        // 设置查询时间
        await redis.setEx(timeKey, 360 * 60, Date.now().toString());
        if ('detail' in cardData) throw Error(cardData.detail);
        if (!('playerDetailInfo' in cardData)) {
          throw Error('未查询到任何数据');
        }
        if (!cardData.playerDetailInfo.isDisplayAvatarList) {
          throw Error('角色展柜未开启或者该用户不存在');
        }
        const assistRole = cardData.playerDetailInfo.assistAvatar;
        const displayRoles = cardData.playerDetailInfo.displayAvatars || [];
        const findAssRoleInBehaRole = displayRoles.findIndex(
          item => item.avatarId === assistRole.avatarId
        );
        let characters = [];
        if (findAssRoleInBehaRole != -1) {
          characters = displayRoles;
        } else {
          characters = [assistRole, ...displayRoles];
        }
        const chars = await updateData(previousData, characters);
        saveData(uid, chars);
        return chars;
      } catch (error) {
        throw Error(error);
      }
    } else {
      // logger.mark('SR-panelApi使用缓存')
      const cardData = previousData;
      return cardData;
    }
  }

  async ikun(e) {
    let user = this.e.user_id;
    let ats = e.message.filter(m => m.type === 'at');
    if (ats.length > 0 && !e.atBot) {
      user = ats[0].qq;
    }
    let uid = await redis.get(`STAR_RAILWAY:UID:${user}`);
    if (!uid) {
      return await e.reply('尚未绑定uid,请发送#星铁绑定uid进行绑定');
    }
    const api = await panelApi();
    const data = await this.getPanelData(uid, false);
    let renderData = {
      api: api.split('/')[2],
      uid,
      data,
    };
    // 渲染数据
    await runtimeRender(e, 'StarRail-plugin', '/panel/list.html', renderData);
  }

  async origImg(e) {
    if (!e.source) return false;
    let source;
    if (e.isGroup) {
      source = (await e.group.getChatHistory(e.source.seq, 1)).pop();
    } else {
      source = (await e.friend.getChatHistory(e.source.time, 1)).pop();
    }
    let ImgPath = await redis.get(
      `STAR_RAILWAY:panelOrigImg:${source.message_id}`
    );
    if (!ImgPath) return false;
    let OP_setting = setting.getConfig('PanelSetting');
    if (OP_setting.originalPic || e.isMaster) {
      ImgPath = pluginResources + '/' + ImgPath;
      if (!OP_setting.backCalloriginalPic) {
        return e.reply(segment.image(ImgPath));
      } else {
        return e.reply(segment.image(ImgPath), false, {
          recallMsg: OP_setting.backCalloriginalPicTime,
        });
      }
    }
    return e.reply('星铁原图功能已关闭，如需开启请联系机器人主人');
  }

  /** 通过米游社获取UID */
  async miYoSummerGetUid() {
    let key = `STAR_RAILWAY:UID:${this.e.user_id}`;
    let ck = this.User.getCk();
    if (!ck) return false;
    if (await redis.get(key)) return false;
    let api = new MysSRApi('', ck);
    let userData = await api.getData('srUser');
    if (!userData?.data || _.isEmpty(userData.data.list)) return false;
    userData = userData.data.list[0];
    let { game_uid: gameUid } = userData;
    await redis.set(key, gameUid);
    await redis.setEx(
      `STAR_RAILWAY:userData:${gameUid}`,
      60 * 60,
      JSON.stringify(userData)
    );
    return userData;
  }
}
/**
 * 替换老数据
 * @param {Array} oldData 老数据
 * @param {Array} newData 新数据
 * @returns {Promise} 使用 try catch 捕获错误
 */
async function updateData(oldData, newData) {
  let returnData = oldData;
  // logger.mark('SR-updateData', oldData, newData);
  oldData.forEach((oldItem, i) => {
    if (oldData[i].name === '{nickname}' || oldData[i].name === '{NICKNAME}') {
      oldData[i].name = '开拓者';
    }
    oldData[i].relics = oldItem.relics || [];
    oldData[i].behaviorList = oldItem.behaviorList || [];
    oldData[i].is_new = false;
  });
  newData.forEach((newItem, i) => {
    newData[i].is_new = true;
    if (newData[i].name === '{nickname}' || newData[i].name === '{NICKNAME}') {
      newData[i].name = '开拓者';
    }
    newData[i].relics = newItem.relics || [];
    newData[i].behaviorList = newItem.behaviorList || [];
    returnData = returnData.filter(
      oldItem => oldItem.avatarId != newItem.avatarId
    );
  });
  returnData.unshift(...newData);
  return returnData;
}
async function saveData(uid, data) {
  // 文件路径
  const filePath = pluginRoot + '/data/panel/' + uid + '.json';
  // 确保目录存在，如果不存在则创建
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  // 判断文件是否存在，并写入数据
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    await fs.promises.writeFile(filePath, JSON.stringify(data), 'utf-8');
    return true;
  } catch (err) {
    await fs.promises.appendFile(filePath, JSON.stringify(data), 'utf-8');
    return false;
  }
}
async function readData(uid) {
  // 文件路径
  const filePath = pluginRoot + '/data/panel/' + uid + '.json';
  // 判断文件是否存在并读取文件
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath));
  } else {
    return [];
  }
}
