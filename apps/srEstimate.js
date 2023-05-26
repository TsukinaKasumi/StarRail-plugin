import plugin from '../../../lib/plugins/plugin.js'
import common from '../../../lib/common/common.js'
import { rulePrefix } from '../utils/common.js'
import fetch from 'node-fetch'
import lodash from 'lodash'

//项目路径
const _path = process.cwd() + '/plugins/StarRail-plugin'

export class srEstimate extends plugin {
    constructor() {
        super({
            name: '星穹铁道星琼预估',
            dsc: '星琼预估',
            event: 'message',
            priority: 100,
            rule: [
                {
                    reg: `^${rulePrefix}预估$`,
                    fnc: 'srEstimate'
                }
            ]
        })
    }
//返回文件夹路径图片
    async srEstimate(e) {
        let msg = [
            segment.image(`${_path}/resources/sryugu/星琼预估.png`),
        ]
        e.reply(msg)
        return true
    }
}