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
function panelHp(base_attr, attribute_bonus) {
    return get_let_value(attribute_bonus, 'HPDelta') +
        base_attr.hp * (get_let_value(attribute_bonus, 'HPAddedRatio') + 1);
}
// 常规技能位等级（behaviorList 前四项：普攻/战技/终结技/天赋）
function stdLevel(data, idx) {
    return data.behaviorList && data.behaviorList[idx] ? data.behaviorList[idx].level : 1;
}
// 忆灵技/忆灵天赋等级：behaviorList 按 pointId 末三位 301/302 匹配（与 main.js 引擎同口径）
function memoSkillLevel(data, suffix) {
    const list = data.behaviorList || [];
    for (let i = 0; i < list.length; i++) {
        if (String(list[i].id).endsWith(suffix)) {
            return list[i].level;
        }
    }
    return 1;
}
// 倍率数组按等级取值（越界收敛末位，与引擎 getskilllevelnum 一致）
function levelValue(list, level) {
    if (!list || list.length === 0) {
        return 0;
    }
    return list[Math.min(level, list.length) - 1];
}
/* 生命倍率转攻击注入：引擎 attack 分支仅支持攻击力倍率（生命倍率仅 1205/1208 硬编码），
 * 记忆命途生命倍率角色以 AttackDelta 把最终攻击补齐为生命值口径（merged attack = hp 注入值）。
 * 钩子时点遗器词条/行迹/光锥基础属性已并入；光锥与套装特效若再提供攻击加成会引入近似偏差（引擎架构限制）。 */
function injectHpAsAttack(base_attr, attribute_bonus, hpValue) {
    const attack = panelAttack(base_attr, attribute_bonus);
    attribute_bonus['AttackDelta'] =
        get_let_value(attribute_bonus, 'AttackDelta') + (hpValue - attack);
}
// 火花终结技基础倍率缓存（终结技倍率含 0.6×欢愉度的动态部分，每次按面板重算）
let HuoXuaUltraBase = null;
// 爻光欢愉技基础倍率缓存（6魂倍率 ×2，按命途切换，需可回退）
let YaoGuangXeBase = null;
// 昔涟倍率基线缓存（强化普攻/忆灵技倍率含战技结界真实伤害系数与弹射段，按面板/命途每次重算）
let XiLianNormalBase = null;
let XiLianMeBase = null;
// 知更鸟•晴歌忆灵技基线缓存（6魂倍率 ×2，按命途切换）
let QingGeMeBase = null;

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
// 穹·记忆/星·记忆（开拓者·记忆，两者数据完全相同；miao 无 calc.js，按官方技能表直译）
function trailblazerMemory(data, base_attr, attribute_bonus) {
    const dict = skilldict[String(data.avatarId)];
    // 忆灵天赋-伙伴！一起！：全队暴击伤害提高 = 迷迷暴击伤害×比例 + 额外值（迷迷属性继承开拓者）
    const mtLevel = memoSkillLevel(data, '302');
    const cdmg = get_let_value(base_attr, 'CriticalDamageBase') +
        get_let_value(attribute_bonus, 'CriticalDamageBase');
    attribute_bonus['CriticalDamageBase'] =
        cdmg * levelValue(dict.Mt_CritDmg, mtLevel) +
        levelValue(dict.Mt_CritDmgExtra, mtLevel) +
        get_let_value(attribute_bonus, 'CriticalDamageBase');
    if (data.rank >= 6) {
        // 6魂：终结技暴击率固定 100%（引擎暴击率上限 min(1,·)，注入 1 即饱和）
        attribute_bonus['Ultra_CriticalChance'] =
            1 + get_let_value(attribute_bonus, 'Ultra_CriticalChance');
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
        // ==================== 记忆命途（3.x+）角色 ====================
        // buff 数值与转化公式一律对照 miao-plugin 各角色 calc.js；
        // 生命倍率行经 injectHpAsAttack 注入（引擎 attack 分支不支持生命倍率的架构内近似，见函数注释）
        '1402': () => {
            // 阿格莱雅（全部伤害行为攻击力倍率）
            // 行迹-短视之惩：至高之姿下攻击力提高 = 速度×(1+终结技每层速度提高×层数)×720% +
            //   (速度×35% + 忆灵天赋每层速度提高×层数)×360%；层数 4 魂前 6 层、4 魂起 7 层
            const num = data.rank > 3 ? 7 : 6;
            const speed = panelSpeed(base_attr, attribute_bonus);
            const qRate = levelValue(skilldict['1402'].Q_SpeedUp, stdLevel(data, 2));
            const mtSpeed = levelValue(skilldict['1402'].Mt_SpeedUp, memoSkillLevel(data, '302'));
            const atkPlus = speed * (1 + qRate * num) * 7.2 +
                (speed * 0.35 + mtSpeed * num) * 3.6;
            attribute_bonus['AttackDelta'] =
                atkPlus + get_let_value(attribute_bonus, 'AttackDelta');
            if (data.rank >= 1) {
                // 1魂：间隙织线敌人受到的伤害提高 15%（易伤）
                attribute_bonus['DmgRatio'] =
                    0.15 + get_let_value(attribute_bonus, 'DmgRatio');
            }
            if (data.rank >= 2) {
                // 2魂：无视 42% 防御力（14%×3 层满）
                attribute_bonus['ignore_defence'] =
                    0.42 + get_let_value(attribute_bonus, 'ignore_defence');
            }
            if (data.rank >= 6) {
                // 6魂：雷属性抗性穿透 +20%；速度档连携攻击伤害提高 60%（miao calc.js 按满档计）
                attribute_bonus['AllDamageResistancePenetration'] =
                    0.2 + get_let_value(attribute_bonus, 'AllDamageResistancePenetration');
                attribute_bonus['NormalDmgAdd'] =
                    0.6 + get_let_value(attribute_bonus, 'NormalDmgAdd');
            }
        },
        '1407': () => {
            // 遐蝶（全部伤害行为生命上限倍率 → 注入生命为攻击基数）
            injectHpAsAttack(base_attr, attribute_bonus, panelHp(base_attr, attribute_bonus));
            // 天赋：我方损失生命值叠加伤害提高（miao calc.js 按 3 层满计）
            attribute_bonus['AllDamageAddedRatio'] =
                levelValue(skilldict['1407'].Talent, stdLevel(data, 3)) * 3 +
                get_let_value(attribute_bonus, 'AllDamageAddedRatio');
            // 终结技：境界使敌方全体全属性抗性降低（按全属性穿透计）
            attribute_bonus['AllDamageResistancePenetration'] =
                levelValue(skilldict['1407'].Ultra, stdLevel(data, 2)) +
                get_let_value(attribute_bonus, 'AllDamageResistancePenetration');
            // 忆灵天赋-震彻寂壤的怒啸：死龙被召唤时我方全体伤害提高 10%
            attribute_bonus['AllDamageAddedRatio'] =
                0.1 + get_let_value(attribute_bonus, 'AllDamageAddedRatio');
            if (data.rank >= 6) {
                // 6魂：量子属性抗性穿透 +20%
                attribute_bonus['QuantumResistancePenetration'] =
                    0.2 + get_let_value(attribute_bonus, 'QuantumResistancePenetration');
            }
        },
        '1415': () => {
            // 昔涟（全部伤害行为生命上限倍率 → 注入）
            // 忆灵天赋-等待，在所有的过去：昔涟与德谬歌生命上限提高（先加，注入按提高后生命计）
            attribute_bonus['HPAddedRatio'] =
                levelValue(skilldict['1415'].Mt, memoSkillLevel(data, '302')) +
                get_let_value(attribute_bonus, 'HPAddedRatio');
            injectHpAsAttack(base_attr, attribute_bonus, panelHp(base_attr, attribute_bonus));
            // 天赋：我方全体造成的伤害提高
            attribute_bonus['AllDamageAddedRatio'] =
                levelValue(skilldict['1415'].Talent, stdLevel(data, 3)) +
                get_let_value(attribute_bonus, 'AllDamageAddedRatio');
            // 终结技-往昔的涟漪：暴击率提高
            attribute_bonus['CriticalChanceBase'] =
                levelValue(skilldict['1415'].Ultra, stdLevel(data, 2)) +
                get_let_value(attribute_bonus, 'CriticalChanceBase');
            // 行迹-三相的因果：速度≥180 全队伤害 +20%，冰抗穿透每超 1 点 +2%（最多计 60 点超出）
            const speed = panelSpeed(base_attr, attribute_bonus);
            if (speed >= 180) {
                attribute_bonus['AllDamageAddedRatio'] =
                    0.2 + get_let_value(attribute_bonus, 'AllDamageAddedRatio');
                attribute_bonus['IceResistancePenetration'] =
                    Math.min(speed - 180, 60) * 2 / 100 +
                    get_let_value(attribute_bonus, 'IceResistancePenetration');
            }
            if (data.rank >= 6) {
                // 6魂：真我触发后敌方全体防御力降低 20%
                attribute_bonus['ignore_defence'] =
                    0.2 + get_let_value(attribute_bonus, 'ignore_defence');
            }
            // 战技结界真实伤害：全部伤害行倍率 ×(1+真实伤害比例[+2魂 4 层×6%])；
            // 忆灵技 = 花与箭基础 + 弹射段数×弹射倍率（队友 3 段；1魂真我 +12 段；4魂每段 +144%）
            // ——均与命途/技能等级相关，改写倍率数组（基线缓存、可回退不累积）
            if (!XiLianNormalBase) {
                XiLianNormalBase = [...skilldict['1415'].Normal];
                XiLianMeBase = [...skilldict['1415'].Me_Base];
            }
            const fieldRate = levelValue(skilldict['1415'].BPSkill, stdLevel(data, 1)) +
                (data.rank >= 2 ? 0.24 : 0);
            const bounces = 3 + (data.rank >= 1 ? 12 : 0);
            const e4Bonus = data.rank >= 4 ? 1.44 : 0;
            skilldict['1415'].Normal = XiLianNormalBase.map(v => v * (1 + fieldRate));
            skilldict['1415'].Me = XiLianMeBase.map((v, i) =>
                (v + bounces * (skilldict['1415'].Me_Bounce[i] + e4Bonus)) * (1 + fieldRate));
        },
        '1512': () => {
            // 知更鸟•晴歌（唯一伤害行 = 忆灵攻击，基数为「晴空乐手」生命上限 = 自身 70%）
            // 气氛值：2魂前 44 点，2魂起 70 点
            const atmosphere = data.rank >= 2 ? 70 : 44;
            const mtLevel = memoSkillLevel(data, '302');
            // 行迹-重构谐乐：暴击率 +50%
            attribute_bonus['CriticalChanceBase'] =
                0.5 + get_let_value(attribute_bonus, 'CriticalChanceBase');
            // 忆灵天赋-Fever：造成的伤害提高 = 基础 + 气氛值×系数
            attribute_bonus['AllDamageAddedRatio'] =
                levelValue(skilldict['1512'].Mt_DmgUp1, mtLevel) +
                atmosphere * levelValue(skilldict['1512'].Mt_DmgUp2, mtLevel) +
                get_let_value(attribute_bonus, 'AllDamageAddedRatio');
            // 忆灵天赋：「晴空乐手」在场敌方全体受到的伤害提高（按 3 名成员档）
            attribute_bonus['DmgRatio'] =
                levelValue(skilldict['1512'].Mt_EnemyDmg, mtLevel) +
                get_let_value(attribute_bonus, 'DmgRatio');
            // 天赋：结界内无视防御 = 天赋表 + 气氛值×0.5%
            attribute_bonus['ignore_defence'] =
                levelValue(skilldict['1512'].Talent, stdLevel(data, 3)) + atmosphere * 0.005 +
                get_let_value(attribute_bonus, 'ignore_defence');
            if (data.rank >= 2) {
                // 2魂：全属性抗性穿透 +18%
                attribute_bonus['AllDamageResistancePenetration'] =
                    0.18 + get_let_value(attribute_bonus, 'AllDamageResistancePenetration');
            }
            injectHpAsAttack(base_attr, attribute_bonus,
                panelHp(base_attr, attribute_bonus) * 0.7);
            // 6魂：忆灵技倍率提高原倍率的 100%（×2）——动态改写，基线缓存可回退
            if (!QingGeMeBase) {
                QingGeMeBase = [...skilldict['1512'].Me];
            }
            skilldict['1512'].Me = data.rank >= 6
                ? QingGeMeBase.map(v => v * 2)
                : QingGeMeBase;
        },
        '8007': () => {
            // 穹·记忆（miao 无 calc.js，按官方技能表直译；与星·记忆数据完全相同）
            trailblazerMemory(data, base_attr, attribute_bonus);
        },
        '8008': () => {
            // 星·记忆
            trailblazerMemory(data, base_attr, attribute_bonus);
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
