import { skilldict } from '../data/data.js';
function get_let_value(let_list, name) {
    if (let_list[name]) {
        return let_list[name];
    }
    return 0;
}

/* ==================== 欢愉命途（4.0+）角色共用 ====================
 * 属性键约定（与 utils/damage/main.js 欢愉分支一致）：
 *   joy / joyPlus / joyPct / merrymakes / xeEnemydmg / xeIgnore 单位为百分比数值（引擎内 /100），
 *   punchline 为笑点数；易伤走 DmgRatio；技能位专属加成用 "{技能位}_DmgRatio / _CriticalDamageBase" 键。
 * 笑点为战斗内全局资源（面板数据无此词条），钩子统一设代表值 50。
 * 面板属性在钩子时点计算：遗器词条已并入 attribute_bonus，光锥/套装增益此时尚未并入（近似值）。
 */
function panelAttack(base_attr, attribute_bonus) {
    return get_let_value(attribute_bonus, 'AttackDelta') +
        base_attr.attack * (get_let_value(attribute_bonus, 'AttackAddedRatio') + 1);
}
function panelSpeed(base_attr, attribute_bonus) {
    return get_let_value(attribute_bonus, 'SpeedDelta') +
        base_attr.speed * (get_let_value(attribute_bonus, 'SpeedAddedRatio') + 1);
}
function panelDefence(base_attr, attribute_bonus) {
    return get_let_value(attribute_bonus, 'DefenceDelta') +
        base_attr.defence * (get_let_value(attribute_bonus, 'DefenceAddedRatio') + 1);
}
// 火花终结技基础倍率缓存（终结技倍率含 0.6×欢愉度的动态部分，每次按面板重算）
let HuoXuaUltraBase = null;
// 爻光欢愉技基础倍率缓存（6魂倍率 ×2，按命途切换，需可回退）
let YaoGuangXeBase = null;

// 星·欢愉/穹·欢愉（开拓者·欢愉，两者 calc 数据完全相同）
function trailblazerElation(data, base_attr, attribute_bonus) {
    // 行迹-快哉快哉：攻击力高于 1000 时每超 200 点欢愉度+10%，最多+60%
    const joy = Math.min(
        Math.trunc((panelAttack(base_attr, attribute_bonus) - 1000) / 200 * 10), 60);
    attribute_bonus['joy'] = joy + get_let_value(attribute_bonus, 'joy');
    // 行迹-跟你爆了：暴击率+15%
    attribute_bonus['CriticalChanceBase'] =
        0.15 + get_let_value(attribute_bonus, 'CriticalChanceBase');
    attribute_bonus['punchline'] = 50 + get_let_value(attribute_bonus, 'punchline');
    if (data.rank >= 4) {
        // 4魂：施放欢愉技时敌方受到的伤害+10%（易伤）
        attribute_bonus['DmgRatio'] = 0.1 + get_let_value(attribute_bonus, 'DmgRatio');
    }
    if (data.rank >= 6) {
        // 6魂：施放欢愉技时暴击伤害+100%
        attribute_bonus['CriticalDamageBase'] =
            1 + get_let_value(attribute_bonus, 'CriticalDamageBase');
    }
}
const Avatar = (data, base_attr, attribute_bonus) => {
    const avatarGetter = {
        '1102': () => {
            attribute_bonus['QuantumResistancePenetration'] =
                0.2 + get_let_value(attribute_bonus, 'QuantumResistancePenetration');
            if (data.rank < 2) {
                attribute_bonus['SpeedAddedRatio'] =
                    0.25 + get_let_value(attribute_bonus, 'SpeedAddedRatio');
            }
            if (data.rank >= 1) {
                attribute_bonus['CriticalChanceBase'] =
                    0.15 + get_let_value(attribute_bonus, 'CriticalChanceBase');
            }
            if (data.rank >= 2) {
                attribute_bonus['SpeedAddedRatio'] =
                    0.5 + get_let_value(attribute_bonus, 'SpeedAddedRatio');
            }
            let all_damage_added_ratio = getskilllevelnum(String(data.avatarId), data.behaviorList, 'talent', 'Talent');
            attribute_bonus['AllDamageAddedRatio'] =
                all_damage_added_ratio +
                    get_let_value(attribute_bonus, 'AllDamageAddedRatio');
        },
        '1204': () => {
            if (data.rank >= 2) {
                attribute_bonus['NormalDmgAdd'] =
                    0.2 + get_let_value(attribute_bonus, 'NormalDmgAdd');
                attribute_bonus['BPSkillDmgAdd'] =
                    0.2 + get_let_value(attribute_bonus, 'BPSkillDmgAdd');
                attribute_bonus['UltraDmgAdd'] =
                    0.2 + get_let_value(attribute_bonus, 'UltraDmgAdd');
            }
            if (data.rank >= 6) {
                attribute_bonus['Talent_DmgRatio'] =
                    0.288 + get_let_value(attribute_bonus, 'Talent_DmgRatio');
            }
            attribute_bonus['CriticalDamageBase'] =
                0.25 + get_let_value(attribute_bonus, 'CriticalDamageBase');
            attribute_bonus['CriticalChanceBase'] =
                0.21 + get_let_value(attribute_bonus, 'CriticalChanceBase');
        },
        '1107': () => {
            if (data.rank >= 2) {
                attribute_bonus['AttackAddedRatio'] =
                    0.2 + get_let_value(attribute_bonus, 'AttackAddedRatio');
            }
            attribute_bonus['TalentDmgAdd'] =
                0.3 + get_let_value(attribute_bonus, 'TalentDmgAdd');
            attribute_bonus['UltraDmgAdd'] =
                0.3 + get_let_value(attribute_bonus, 'UltraDmgAdd');
        },
        '1213': () => {
            if (data.rank >= 1) {
                attribute_bonus['Atk_buff'] =
                    1 + get_let_value(attribute_bonus, 'Atk_buff');
            }
            if (data.rank >= 4) {
                attribute_bonus['Normal_buff'] =
                    4 + get_let_value(attribute_bonus, 'Normal_buff');
            }
            if (data.rank >= 6) {
                attribute_bonus['Normal3_ImaginaryResistancePenetration'] =
                    0.6 +
                        get_let_value(attribute_bonus, 'Normal3_ImaginaryResistancePenetration');
            }
            attribute_bonus['CriticalDamageBase'] =
                0.24 + get_let_value(attribute_bonus, 'CriticalDamageBase');
        },
        '1006': () => {
            if (data.rank >= 6) {
                attribute_bonus['AllDamageAddedRatio'] =
                    1 + get_let_value(attribute_bonus, 'AllDamageAddedRatio');
            }
            let enemy_status_resistance = 0.03 +
                getskilllevelnum(String(data.avatarId), data.behaviorList, 'skill', 'BPSkill_D');
            attribute_bonus['QuantumResistancePenetration'] =
                enemy_status_resistance +
                    get_let_value(attribute_bonus, 'QuantumResistancePenetration');
            let ultra_defence = getskilllevelnum(String(data.avatarId), data.behaviorList, 'ultimate', 'Ultra_D');
            let talent_defence = getskilllevelnum(String(data.avatarId), data.behaviorList, 'talent', 'Talent');
            let ignore_defence = ultra_defence + talent_defence;
            attribute_bonus['ignore_defence'] =
                ignore_defence + get_let_value(attribute_bonus, 'ignore_defence');
        },
        '1005': () => {
            if (data.rank >= 1) {
                attribute_bonus['DOTDmgAdd'] =
                    0.3 + get_let_value(attribute_bonus, 'DOTDmgAdd');
            }
            if (data.rank >= 2) {
                attribute_bonus['DOTDmgAdd'] =
                    0.25 + get_let_value(attribute_bonus, 'DOTDmgAdd');
            }
        },
        '1205': () => {
            if (data.rank >= 2) {
                attribute_bonus['CriticalChanceBase'] =
                    0.15 + get_let_value(attribute_bonus, 'CriticalChanceBase');
            }
            if (data.rank >= 4) {
                attribute_bonus['HPAddedRatio'] =
                    0.4 + get_let_value(attribute_bonus, 'HPAddedRatio');
            }
            attribute_bonus['TalentDmgAdd'] =
                0.2 + get_let_value(attribute_bonus, 'TalentDmgAdd');
			let all_damage_added_ratio = getskilllevelnum(String(data.avatarId), data.behaviorList, 'skill', 'BPSkill');
			attribute_bonus['AllDamageAddedRatio'] =
                all_damage_added_ratio +
                    get_let_value(attribute_bonus, 'AllDamageAddedRatio');
        },
        '1208': () => {
            if (data.rank >= 1) {
                attribute_bonus['CriticalDamageBase'] =
                    0.3 + get_let_value(attribute_bonus, 'CriticalDamageBase');
            }
            attribute_bonus['CriticalChanceBase'] =
                getskilllevelnum(String(data.avatarId), data.behaviorList, 'skill', 'BPSkill_CC') + get_let_value(attribute_bonus, 'CriticalChanceBase');
            attribute_bonus['HPAddedRatio'] =
                getskilllevelnum(String(data.avatarId), data.behaviorList, 'skill', 'BPSkill_HP') + get_let_value(attribute_bonus, 'HPAddedRatio');
        },
        '1209': () => {
            if (data.rank >= 4) {
                attribute_bonus['IceResistancePenetration'] =
                    0.15 + get_let_value(attribute_bonus, 'IceResistancePenetration');
            }
            attribute_bonus['SpeedAddedRatio'] =
                0.1 + get_let_value(attribute_bonus, 'SpeedAddedRatio');
            let critical_damage_base_t = getskilllevelnum(String(data.avatarId), data.behaviorList, 'talent', 'Talent_CD');
            let critical_damage_base_u = getskilllevelnum(String(data.avatarId), data.behaviorList, 'ultimate', 'Ultra_CD');
            attribute_bonus['CriticalDamageBase'] =
                critical_damage_base_t +
                    get_let_value(attribute_bonus, 'CriticalDamageBase');
            attribute_bonus['CriticalChanceBase'] =
                critical_damage_base_u +
                    0.6 +
                    get_let_value(attribute_bonus, 'CriticalChanceBase');
        },
        '1004': () => {
	    attribute_bonus['DmgRatio'] =
                0.12 + get_let_value(attribute_bonus, 'AllDamageAddedRatio');
            attribute_bonus['AllDamageAddedRatio'] =
                0.2 + get_let_value(attribute_bonus, 'AllDamageAddedRatio');
        },
        '1003': () => {
            if (data.rank >= 1) {
                attribute_bonus['SpeedAddedRatio'] =
                    0.1 + get_let_value(attribute_bonus, 'SpeedAddedRatio');
            }
            if (data.rank >= 2) {
                attribute_bonus['AllDamageAddedRatio'] =
                    0.15 + get_let_value(attribute_bonus, 'AllDamageAddedRatio');
            }
            attribute_bonus['BPSkillDmgAdd'] =
                0.2 + get_let_value(attribute_bonus, 'BPSkillDmgAdd');
            attribute_bonus['CriticalChanceBase'] =
                0.15 + get_let_value(attribute_bonus, 'CriticalChanceBase');
        },
        '1201': () => {
            if (data.rank >= 1) {
                attribute_bonus['UltraDmgAdd'] =
                    0.1 + get_let_value(attribute_bonus, 'UltraDmgAdd');
            }
            attribute_bonus['SpeedAddedRatio'] =
                0.1 + get_let_value(attribute_bonus, 'SpeedAddedRatio');
            let all_damage_added_ratio = getskilllevelnum(String(data.avatarId), data.behaviorList, 'skill', 'BPSkill') + 0.1;
            attribute_bonus['AllDamageAddedRatio'] =
                get_let_value(attribute_bonus, 'AllDamageAddedRatio') +
                    all_damage_added_ratio * 4;
            attribute_bonus['AttackAddedRatio'] =
                getskilllevelnum(String(data.avatarId), data.behaviorList, 'talent', 'Talent') + get_let_value(attribute_bonus, 'AttackAddedRatio');
        },
        '1212': () => {
            if (data.rank >= 1) {
                attribute_bonus['CriticalDamageBase'] =
                    0.24 + get_let_value(attribute_bonus, 'CriticalDamageBase');
            }
            if (data.rank >= 2) {
                attribute_bonus['BPSkill1DmgAdd'] =
                    0.8 + get_let_value(attribute_bonus, 'BPSkill1DmgAdd');
            }
            if (data.rank >= 4) {
                attribute_bonus['BPSkill1AttackAddedRatio'] =
                    0.3 + get_let_value(attribute_bonus, 'BPSkill1AttackAddedRatio');
                attribute_bonus['UltraAttackAddedRatio'] =
                    0.3 + get_let_value(attribute_bonus, 'UltraAttackAddedRatio');
            }
            if (data.rank >= 6) {
                attribute_bonus['Ultra_CriticalDamageBase'] =
                    0.5 + get_let_value(attribute_bonus, 'Ultra_CriticalDamageBase');
                attribute_bonus['BPSkill1_CriticalDamageBase'] =
                    0.5 + get_let_value(attribute_bonus, 'BPSkill1_CriticalDamageBase');
            }
            attribute_bonus['UltraDmgAdd'] =
                0.2 + get_let_value(attribute_bonus, 'UltraDmgAdd');
            let critical_chance_base = getskilllevelnum(String(data.avatarId), data.behaviorList, 'talent', 'Talent_CC');
            attribute_bonus['Ultra_CriticalChanceBase'] =
                get_let_value(attribute_bonus, 'Ultra_CriticalChanceBase') +
                    critical_chance_base;
            attribute_bonus['BPSkill1_CriticalChanceBase'] =
                get_let_value(attribute_bonus, 'BPSkill1_CriticalChanceBase') +
                    critical_chance_base;
            let attack_added_ratio = getskilllevelnum(String(data.avatarId), data.behaviorList, 'talent', 'Talent_atk');
            attribute_bonus['BPSkill1AttackAddedRatio'] =
                get_let_value(attribute_bonus, 'BPSkill1AttackAddedRatio') +
                    critical_chance_base;
            attribute_bonus['UltraAttackAddedRatio'] =
                get_let_value(attribute_bonus, 'UltraAttackAddedRatio') +
                    attack_added_ratio;
        },
        '1112': () => {
            if (data.rank >= 1) {
                attribute_bonus['Talent_CriticalDamageBase'] =
                    0.5 + get_let_value(attribute_bonus, 'Talent_CriticalDamageBase');
            }
            if (data.rank >= 6) {
                attribute_bonus['Talent1_FireResistancePenetration'] =
                    0.1 +
                        get_let_value(attribute_bonus, 'Talent1_FireResistancePenetration');
            }
            attribute_bonus['AllDamageAddedRatio'] =
                0.15 + get_let_value(attribute_bonus, 'AllDamageAddedRatio');
            let critical_damage_base = getskilllevelnum(String(data.avatarId), data.behaviorList, 'ultimate', 'Ultra_CD');
            attribute_bonus['Talent1_CriticalDamageBase'] =
                get_let_value(attribute_bonus, 'Talent1_CriticalDamageBase') +
                    critical_damage_base;
            attribute_bonus['TalentDmgAdd'] =
                getskilllevelnum(String(data.avatarId), data.behaviorList, 'skill', 'BPSkill_add') + get_let_value(attribute_bonus, 'TalentDmgAdd');
        },
        // ==================== 欢愉命途（4.0+）角色 ====================
        // buff 数值与转化公式一律对照 miao-plugin 各角色 calc.js
        '1501': () => {
            // 火花
            // 行迹-甜蜜！笑点签售会：攻击力高于 2000 时每超 100 点欢愉度+5%，最多+80%
            let joy = Math.min(Math.trunc((panelAttack(base_attr, attribute_bonus) - 2000) / 100 * 5), 80);
            if (data.rank >= 4) {
                // 4魂：施放终结技时欢愉度+36%
                joy += 36;
            }
            attribute_bonus['joy'] = joy + get_let_value(attribute_bonus, 'joy');
            // 行迹-神闲意满/沸腾！真伪调色盘：暴击伤害+60%/+80%
            attribute_bonus['CriticalDamageBase'] =
                1.4 + get_let_value(attribute_bonus, 'CriticalDamageBase');
            if (data.rank >= 2) {
                // 2魂：暴击伤害+40%
                attribute_bonus['CriticalDamageBase'] =
                    0.4 + get_let_value(attribute_bonus, 'CriticalDamageBase');
            }
            let kx = 0;
            if (data.rank >= 1) {
                // 1魂：全属性抗性穿透+15%
                kx += 0.15;
            }
            if (data.rank >= 6) {
                // 6魂：全属性抗性穿透+20%（欢愉技弹射次数+至 40 为情景加成，不计入）
                kx += 0.2;
            }
            if (kx > 0) {
                attribute_bonus['AllDamageResistancePenetration'] =
                    kx + get_let_value(attribute_bonus, 'AllDamageResistancePenetration');
            }
            attribute_bonus['punchline'] = 50 + get_let_value(attribute_bonus, 'punchline');
            // 终结技倍率含「0.6×欢愉度」的动态部分（官方：0.6*欢愉度+$1% 攻击力）。
            // 引擎倍率数组为静态数据、无技能位倍率入口，此处按钩子时点可得欢愉度
            //（行迹小节点 + 上述转化/4魂；光锥与套装的 joyPct 在后续钩子才并入，无法计入）改写数组。
            if (!HuoXuaUltraBase) {
                HuoXuaUltraBase = [...skilldict['1501'].Ultra];
            }
            const joyTotal = get_let_value(attribute_bonus, 'joy') +
                get_let_value(attribute_bonus, 'joyPlus') + get_let_value(attribute_bonus, 'joyPct');
            skilldict['1501'].Ultra = HuoXuaUltraBase.map(v => v + joyTotal * 0.006);
        },
        '1502': () => {
            // 爻光
            if (data.rank >= 2) {
                // 2魂：速度+12%（先加，行迹欢愉度转化按最终速度计）
                attribute_bonus['SpeedAddedRatio'] =
                    0.12 + get_let_value(attribute_bonus, 'SpeedAddedRatio');
            }
            // 行迹-开屏有礼：速度≥120 时欢愉度+30%，每超 1 点再+1%，最多计入 200 点超出速度
            const speed = panelSpeed(base_attr, attribute_bonus);
            let joy = get_let_value(attribute_bonus, 'joy') +
                (speed >= 120 ? Math.min(speed - 120 + 30, 230) : 0);
            if (data.rank >= 2) {
                // 2魂：欢愉度额外+16%
                joy += 16;
            }
            // 战技（结界）：我方全体欢愉度提高，数值等同于爻光欢愉度的 20%
            joy = joy * 1.2;
            attribute_bonus['joy'] = joy;
            // 凶星低语（欢愉技施加状态）：目标受到的伤害+16%（易伤）
            attribute_bonus['DmgRatio'] = 0.16 + get_let_value(attribute_bonus, 'DmgRatio');
            // 行迹-神闲意满：暴击伤害+80%
            attribute_bonus['CriticalDamageBase'] =
                0.8 + get_let_value(attribute_bonus, 'CriticalDamageBase');
            // 终结技：全属性抗性穿透+20%（miao calc.js 固定值）
            attribute_bonus['AllDamageResistancePenetration'] =
                0.2 + get_let_value(attribute_bonus, 'AllDamageResistancePenetration');
            if (data.rank >= 1) {
                // 1魂：我方全体造成欢愉伤害时无视目标 20% 防御力
                attribute_bonus['xeIgnore'] = 20 + get_let_value(attribute_bonus, 'xeIgnore');
            }
            if (data.rank >= 6) {
                // 6魂：我方全体欢愉伤害增笑+25%
                attribute_bonus['merrymakes'] = 25 + get_let_value(attribute_bonus, 'merrymakes');
            }
            attribute_bonus['punchline'] = 50 + get_let_value(attribute_bonus, 'punchline');
            // 6魂：爻光欢愉技伤害倍率提高原倍率的 100%（×2）——动态改写倍率数组，按命途切换
            if (!YaoGuangXeBase) {
                YaoGuangXeBase = [...skilldict['1502'].Xe];
            }
            skilldict['1502'].Xe = data.rank >= 6
                ? YaoGuangXeBase.map(v => v * 2)
                : YaoGuangXeBase;
        },
        '1503': () => {
            // 真珠（伤害技能全部为防御力倍率，引擎 attack 分支仅支持攻击/生命倍率，
            // 面板仅展示可正确计算的欢愉伤害行；治疗行同理不支持）
            // 行迹-洞察万物：防御力≥2400 时欢愉度+32%，超出部分每 100 点+3%（最多计入 3600 点）
            const def = panelDefence(base_attr, attribute_bonus);
            let joy = def >= 2400
                ? 32 + Math.floor(Math.min(def - 2400, 3600)) / 10 * 3
                : 0;
            if (data.rank >= 1) {
                // 1魂：队伍欢愉角色 2/3/4+ 名时全体欢愉度+10%/20%/60%（miao calc.js 取 60% 满档）
                joy += 60;
            }
            attribute_bonus['joy'] = joy + get_let_value(attribute_bonus, 'joy');
            if (data.rank >= 2) {
                // 2魂：我方全体欢愉伤害增笑+15%
                attribute_bonus['merrymakes'] = 15 + get_let_value(attribute_bonus, 'merrymakes');
            }
            if (data.rank >= 6) {
                // 6魂：全属性抗性穿透+20%
                attribute_bonus['AllDamageResistancePenetration'] =
                    0.2 + get_let_value(attribute_bonus, 'AllDamageResistancePenetration');
            }
            attribute_bonus['punchline'] = 50 + get_let_value(attribute_bonus, 'punchline');
        },
        '1505': () => {
            // 绯英
            if (data.rank >= 2) {
                // 2魂：暴击伤害+36%（天赋欢愉度转化按最终爆伤计，先加）
                attribute_bonus['CriticalDamageBase'] =
                    0.36 + get_let_value(attribute_bonus, 'CriticalDamageBase');
            }
            // 天赋：获得等同于暴击伤害 20% 的欢愉度（爆伤为小数存储，×20 转百分比单位）
            const cdmg = get_let_value(base_attr, 'CriticalDamageBase') +
                get_let_value(attribute_bonus, 'CriticalDamageBase');
            attribute_bonus['joy'] = cdmg * 20 + get_let_value(attribute_bonus, 'joy');
            // 行迹-瞰众乐：暴击率+30%
            attribute_bonus['CriticalChanceBase'] =
                0.3 + get_let_value(attribute_bonus, 'CriticalChanceBase');
            // 行迹-行裁断：狐狸老师攻击时目标易伤+12%
            attribute_bonus['DmgRatio'] = 0.12 + get_let_value(attribute_bonus, 'DmgRatio');
            if (data.rank >= 1) {
                // 1魂：全属性抗性穿透+20%
                attribute_bonus['AllDamageResistancePenetration'] =
                    0.2 + get_let_value(attribute_bonus, 'AllDamageResistancePenetration');
            }
            if (data.rank >= 4) {
                // 4魂：造成的伤害无视敌方 15% 防御力（攻击路 ignore_defence + 欢愉路 xeIgnore）
                attribute_bonus['ignore_defence'] =
                    0.15 + get_let_value(attribute_bonus, 'ignore_defence');
                attribute_bonus['xeIgnore'] = 15 + get_let_value(attribute_bonus, 'xeIgnore');
            }
            if (data.rank >= 6) {
                // 6魂：欢愉伤害增笑+15%，每 100 点好活当赏额外+2%（miao calc.js 按 1000 点满档取 35）
                attribute_bonus['merrymakes'] = 35 + get_let_value(attribute_bonus, 'merrymakes');
            }
            attribute_bonus['punchline'] = 50 + get_let_value(attribute_bonus, 'punchline');
        },
        '1506': () => {
            // 银狼LV.999（天赋按隐藏分加暴击/爆伤为战斗内成长属性，miao calc.js 未计入，保持一致）
            // 行迹-假结局速通攻略：速度≥160 时欢愉度+50%，每超 1 点再+2%（最多+200%）
            const speed = panelSpeed(base_attr, attribute_bonus);
            const joy = speed >= 160
                ? 50 + Math.min(Math.trunc((speed - 160) * 2), 200)
                : 0;
            attribute_bonus['joy'] = joy + get_let_value(attribute_bonus, 'joy');
            attribute_bonus['punchline'] = 50 + get_let_value(attribute_bonus, 'punchline');
            if (data.rank >= 1) {
                // 1魂：无敌玩家结界内敌方受到的伤害+20%——状态型易伤，
                // 仅注入两个状态行（终结技盲盒/强化欢愉技），普攻战技附加行不受影响
                attribute_bonus['Ultra_DmgRatio'] =
                    0.2 + get_let_value(attribute_bonus, 'Ultra_DmgRatio');
                attribute_bonus['Xe2_DmgRatio'] =
                    0.2 + get_let_value(attribute_bonus, 'Xe2_DmgRatio');
            }
        },
        '1513': () => {
            // 砂金•戏浪
            // 行迹-极乐派对：速度≥140 时欢愉度+30%，每超 1 点再+1%，最多计入 200 点超出速度
            const speed = panelSpeed(base_attr, attribute_bonus);
            // 行迹-纵享惊涛：队伍存在其他欢愉角色时全体+20%、自身额外+80%（miao calc.js 固定按 100 计）
            const joy = (speed >= 140 ? 30 + Math.min(speed - 140, 200) : 0) + 100;
            attribute_bonus['joy'] = joy + get_let_value(attribute_bonus, 'joy');
            // 行迹-旧梦淘金：暴击伤害+48%，队友攻击后再+48%（miao calc.js 按 96 计）
            attribute_bonus['CriticalDamageBase'] =
                0.96 + get_let_value(attribute_bonus, 'CriticalDamageBase');
            if (data.rank >= 1) {
                // 1魂：全属性抗性穿透+24%
                attribute_bonus['AllDamageResistancePenetration'] =
                    0.24 + get_let_value(attribute_bonus, 'AllDamageResistancePenetration');
            }
            if (data.rank >= 4) {
                // 4魂：施放战技时我方全体无视 18% 防御力
                attribute_bonus['ignore_defence'] =
                    0.18 + get_let_value(attribute_bonus, 'ignore_defence');
                attribute_bonus['xeIgnore'] = 18 + get_let_value(attribute_bonus, 'xeIgnore');
            }
            if (data.rank >= 6) {
                // 6魂：自身欢愉伤害增笑+25%
                attribute_bonus['merrymakes'] = 25 + get_let_value(attribute_bonus, 'merrymakes');
            }
            attribute_bonus['punchline'] = 50 + get_let_value(attribute_bonus, 'punchline');
            // 2魂：热意上限 30→50，【All in！敬炽烈一夏】按 50 点热意计。
            // 两档完整倍率数组存于 SkillData 的 Xe2_Heat30/Xe2_Heat50，按命途切换
            skilldict['1513'].Xe2 = data.rank >= 2
                ? [...skilldict['1513'].Xe2_Heat50]
                : [...skilldict['1513'].Xe2_Heat30];
        },
        '8009': () => {
            // 穹·欢愉（与星·欢愉数据完全相同）
            trailblazerElation(data, base_attr, attribute_bonus);
        },
        '8010': () => {
            // 星·欢愉
            trailblazerElation(data, base_attr, attribute_bonus);
        },
    };
    String(data.avatarId) in avatarGetter &&
        avatarGetter[String(data.avatarId)]();
    return attribute_bonus;
};
export function avatar_ability(data, base_attr, attribute_bonus) {
    attribute_bonus = Avatar(data, base_attr, attribute_bonus);
    return attribute_bonus;
}
function getskilllevelnum(avatarId, skills, leveltype, skilltype) {
    if (leveltype == 'basic_atk') {
        var skilllevel = skills[0]['level'];
    }
    else if (leveltype == 'skill') {
        var skilllevel = skills[1]['level'];
    }
    else if (leveltype == 'ultimate') {
        var skilllevel = skills[2]['level'];
    }
    else if (leveltype == 'talent') {
        var skilllevel = skills[3]['level'];
    }
    else {
        var skilllevel = 1;
    }
    return skilldict[avatarId][skilltype][skilllevel - 1];
}
