import { weapon_effect } from '../data/data.js';
function get_let_value(let_list, name) {
    if (let_list[name]) {
        return let_list[name];
    }
    return 0;
}
const Weapon = (equipment, Ultra_Use, base_attr, attribute_bonus) => {
    const weaponGetter = {
        '23001': () => {
            let char_speed = get_let_value(attribute_bonus, 'SpeedDelta') +
                get_let_value(base_attr, 'speed') *
                    (get_let_value(attribute_bonus, 'SpeedAddedRatio') + 1);
            let count_ = Math.min(6, (char_speed - 100) / 10);
            let normal_dmg_add = get_let_value(attribute_bonus, 'NormalDmgAdd');
            attribute_bonus['NormalDmgAdd'] =
                normal_dmg_add +
                    weapon_effect['23001']['Param']['a_dmg'][equipment.rank - 1] * count_;
            let bp_skill_dmg_add = get_let_value(attribute_bonus, 'BPSkillDmgAdd');
            attribute_bonus['BPSkillDmgAdd'] =
                bp_skill_dmg_add +
                    weapon_effect['23001']['Param']['e_dmg'][equipment.rank - 1] * count_;
            let ultra_critical_chance_base = get_let_value(attribute_bonus, 'Ultra_CriticalDamageBase');
            attribute_bonus['Ultra_CriticalDamageBase'] =
                ultra_critical_chance_base +
                    weapon_effect['23001']['Param']['q_crit_dmg'][equipment.rank - 1] *
                        count_;
        },
        '20000': () => {
            let critical_chance_base = get_let_value(attribute_bonus, 'CriticalChance');
            attribute_bonus['CriticalChance'] =
                critical_chance_base +
                    weapon_effect['20000']['Param']['CriticalChance'][equipment.rank - 1];
        },
        '21031': () => { },
        '21010': () => {
            let all_damage_added_ratio = get_let_value(attribute_bonus, 'AllDamageAddedRatio');
            attribute_bonus['AllDamageAddedRatio'] =
                all_damage_added_ratio +
                    weapon_effect['21010']['Param']['AllDamageAddedRatio'][equipment.rank - 1] *
                        5;
        },
        '23016': () => {
            let talent_dmg_add = get_let_value(attribute_bonus, 'TalentDmgAdd');
            attribute_bonus['TalentDmgAdd'] =
                talent_dmg_add +
                    weapon_effect['23016']['Param']['TalentDmgAdd'][equipment.rank - 1];
            let critical_chance_base = get_let_value(attribute_bonus, 'CriticalDamageBase');
            attribute_bonus['CriticalDamageBase'] =
                critical_chance_base +
                    weapon_effect['23016']['Param']['CriticalDamageBase'][equipment.rank - 1] *
                        2;
        },
        '23012': () => {
            let critical_chance_base = get_let_value(attribute_bonus, 'CriticalChanceBase');
            attribute_bonus['CriticalChanceBase'] =
                critical_chance_base +
                    weapon_effect['23012']['Param']['CriticalChance'][equipment.rank - 1];
        },
        '23014': () => {
            let all_damage_added_ratio = get_let_value(attribute_bonus, 'AllDamageAddedRatio');
            attribute_bonus['AllDamageAddedRatio'] =
                all_damage_added_ratio +
                    weapon_effect['23014']['Param']['AllDamageAddedRatio'][equipment.rank - 1] *
                        3;
            let resistance_penetration = get_let_value(attribute_bonus, 'AllResistancePenetration');
            attribute_bonus['AllResistancePenetration'] =
                resistance_penetration +
                    weapon_effect['23014']['Param']['ResistancePenetration'][equipment.rank - 1];
        },
        '20006': () => {
            let ultra_dmg_add = get_let_value(attribute_bonus, 'UltraDmgAdd');
            attribute_bonus['UltraDmgAdd'] =
                ultra_dmg_add +
                    weapon_effect['20006']['Param']['r_dmg'][equipment.rank - 1];
        },
        '20013': () => { },
        '20020': () => {
            let a3_attack_added_ratio = get_let_value(attribute_bonus, 'UltraAttackAddedRatio');
            attribute_bonus['UltraAttackAddedRatio'] =
                a3_attack_added_ratio +
                    weapon_effect['20020']['Param']['A3_AttackAddedRatio'][equipment.rank - 1];
        },
        '20004': () => {
            let status_probability = get_let_value(attribute_bonus, 'StatusProbabilityBase');
            attribute_bonus['StatusProbabilityBase'] =
                status_probability +
                    weapon_effect['20004']['Param']['StatusProbability'][equipment.rank - 1];
        },
        '20011': () => { },
        '20018': () => { },
        '20002': () => {
            let normal_dmg_add = get_let_value(attribute_bonus, 'NormalDmgAdd');
            attribute_bonus['NormalDmgAdd'] =
                normal_dmg_add +
                    weapon_effect['20002']['Param']['a_dmg'][equipment.rank - 1];
            let bp_skill_dmg_add = get_let_value(attribute_bonus, 'BPSkillDmgAdd');
            attribute_bonus['BPSkillDmgAdd'] =
                bp_skill_dmg_add +
                    weapon_effect['20002']['Param']['e_dmg'][equipment.rank - 1];
        },
        '20009': () => {
            let all_damage_added_ratio = get_let_value(attribute_bonus, 'AllDamageAddedRatio');
            attribute_bonus['AllDamageAddedRatio'] =
                all_damage_added_ratio +
                    weapon_effect['20009']['Param']['AllDamageAddedRatio'][equipment.rank - 1];
        },
        '20016': () => {
            let critical_chance_base = get_let_value(attribute_bonus, 'CriticalChanceBase');
            attribute_bonus['CriticalChanceBase'] =
                critical_chance_base +
                    weapon_effect['20016']['Param']['CriticalChance'][equipment.rank - 1];
        },
        '20003': () => {
            let defence_added_ratio = get_let_value(attribute_bonus, 'DefenceAddedRatio');
            attribute_bonus['DefenceAddedRatio'] =
                defence_added_ratio +
                    weapon_effect['20003']['Param']['DefenceAddedRatio'][equipment.rank - 1];
        },
        '20010': () => { },
        '20017': () => { },
        '21002': () => { },
        '21009': () => { },
        '21016': () => { },
        '21023': () => { },
        '21030': () => { },
        '24002': () => { },
        '23005': () => {
            let defence_added_ratio = get_let_value(attribute_bonus, 'DefenceAddedRatio');
            attribute_bonus['DefenceAddedRatio'] =
                defence_added_ratio +
                    weapon_effect['23005']['Param']['DefenceAddedRatio'][equipment.rank - 1];
        },
        '23011': () => {
            let all_damage_added_ratio = get_let_value(attribute_bonus, 'AllDamageAddedRatio');
            attribute_bonus['AllDamageAddedRatio'] =
                all_damage_added_ratio +
                    weapon_effect['23011']['Param']['AllDamageAddedRatio'][equipment.rank - 1] *
                        3;
        },
        '21001': () => {
            let all_damage_added_ratio = get_let_value(attribute_bonus, 'AllDamageAddedRatio');
            attribute_bonus['AllDamageAddedRatio'] =
                all_damage_added_ratio +
                    weapon_effect['21001']['Param']['AllDamageAddedRatio'][equipment.rank - 1] *
                        3;
        },
        '21008': () => { },
        '21015': () => {
            let ignore_defence = get_let_value(attribute_bonus, 'ignore_defence');
            attribute_bonus['ignore_defence'] =
                ignore_defence +
                    weapon_effect['21015']['Param']['ignore_defence'][equipment.rank - 1];
        },
        '21022': () => {
            let all_damage_added_ratio = get_let_value(attribute_bonus, 'AllDamageAddedRatio');
            attribute_bonus['AllDamageAddedRatio'] =
                all_damage_added_ratio +
                    weapon_effect['21022']['Param']['AllDamageAddedRatio'][equipment.rank - 1];
        },
        '21029': () => { },
        '22000': () => { },
        '24003': () => { },
        '23004': () => {
            let all_damage_added_ratio = get_let_value(attribute_bonus, 'AllDamageAddedRatio');
            attribute_bonus['AllDamageAddedRatio'] =
                all_damage_added_ratio +
                    weapon_effect['23004']['Param']['AllDamageAddedRatio'][equipment.rank - 1];
            let a2_status_probability = get_let_value(attribute_bonus, 'BPSkillStatusProbabilityBase');
            attribute_bonus['BPSkillStatusProbabilityBase'] =
                a2_status_probability +
                    weapon_effect['23004']['Param']['A2_StatusProbability'][equipment.rank - 1];
            let a2_attack_added_ratio = get_let_value(attribute_bonus, 'BPSkillAttackAddedRatio');
            attribute_bonus['BPSkillAttackAddedRatio'] =
                a2_attack_added_ratio +
                    weapon_effect['23004']['Param']['A2_AttackAddedRatio'][equipment.rank - 1];
        },
        '23006': () => {
            let all_damage_added_ratio = get_let_value(attribute_bonus, 'AllDamageAddedRatio');
            attribute_bonus['AllDamageAddedRatio'] =
                all_damage_added_ratio +
                    weapon_effect['23006']['Param']['AllDamageAddedRatio'][equipment.rank - 1];
            let speed_added_ratio = get_let_value(attribute_bonus, 'SpeedAddedRatio');
            attribute_bonus['SpeedAddedRatio'] =
                speed_added_ratio +
                    weapon_effect['23006']['Param']['SpeedAddedRatio'][equipment.rank - 1] *
                        3;
        },
        '23007': () => {
            let damage_ratio = get_let_value(attribute_bonus, 'DmgRatio');
            attribute_bonus['DmgRatio'] =
                damage_ratio +
                    weapon_effect['23007']['Param']['DmgRatio'][equipment.rank - 1];
            let critical_chance_base = get_let_value(attribute_bonus, 'CriticalChanceBase');
            attribute_bonus['CriticalChanceBase'] =
                critical_chance_base +
                    weapon_effect['23007']['Param']['CriticalChance'][equipment.rank - 1];
        },
        '21005': () => {
            let attack_added_ratio = get_let_value(attribute_bonus, 'AttackAddedRatio');
            attribute_bonus['AttackAddedRatio'] =
                attack_added_ratio +
                    weapon_effect['21005']['Param']['AttackAddedRatio'][equipment.rank - 1] *
                        3;
        },
        '21019': () => {
            let critical_chance_base = get_let_value(attribute_bonus, 'CriticalChanceBase');
            attribute_bonus['CriticalChanceBase'] =
                critical_chance_base +
                    weapon_effect['21019']['Param']['CriticalChance'][equipment.rank - 1];
        },
        '21026': () => {
            let all_damage_added_ratio = get_let_value(attribute_bonus, 'AllDamageAddedRatio');
            attribute_bonus['AllDamageAddedRatio'] =
                all_damage_added_ratio +
                    weapon_effect['21026']['Param']['AllDamageAddedRatio'][equipment.rank - 1];
        },
        '21033': () => { },
        '24000': () => {
            let attack_added_ratio = get_let_value(attribute_bonus, 'AttackAddedRatio');
            attribute_bonus['AttackAddedRatio'] =
                attack_added_ratio +
                    weapon_effect['24000']['Param']['AttackAddedRatio'][equipment.rank - 1] *
                        4;
            let all_damage_added_ratio = get_let_value(attribute_bonus, 'AllDamageAddedRatio');
            attribute_bonus['AllDamageAddedRatio'] =
                all_damage_added_ratio +
                    weapon_effect['24000']['Param']['AllDamageAddedRatio'][equipment.rank - 1];
        },
        '23002': () => {
            let all_damage_added_ratio = get_let_value(attribute_bonus, 'AllDamageAddedRatio');
            attribute_bonus['AllDamageAddedRatio'] =
                all_damage_added_ratio +
                    weapon_effect['23002']['Param']['AllDamageAddedRatio'][equipment.rank - 1];
        },
        '23009': () => {
            let all_damage_added_ratio = get_let_value(attribute_bonus, 'AllDamageAddedRatio');
            attribute_bonus['AllDamageAddedRatio'] =
                all_damage_added_ratio +
                    weapon_effect['23009']['Param']['AllDamageAddedRatio'][equipment.rank - 1];
        },
        '23015': () => {
            let attack_added_ratio = get_let_value(attribute_bonus, 'AttackAddedRatio');
            attribute_bonus['AttackAddedRatio'] =
                attack_added_ratio +
                    weapon_effect['23015']['Param']['AttackAddedRatio'][equipment.rank - 1] *
                        2;
        },
        '21012': () => {
            let all_damage_added_ratio = get_let_value(attribute_bonus, 'AllDamageAddedRatio');
            attribute_bonus['AllDamageAddedRatio'] =
                all_damage_added_ratio +
                    weapon_effect['21012']['Param']['AllDamageAddedRatio'][equipment.rank - 1];
        },
        '21006': () => {
            let talent_dmg_add = get_let_value(attribute_bonus, 'TalentDmgAdd');
            attribute_bonus['TalentDmgAdd'] =
                talent_dmg_add +
                    weapon_effect['21006']['Param']['t_dmg'][equipment.rank - 1];
        },
        '21013': () => {
            let ultra_dmg_add = get_let_value(attribute_bonus, 'UltraDmgAdd');
            attribute_bonus['UltraDmgAdd'] =
                ultra_dmg_add +
                    weapon_effect['21013']['Param']['r_dmg'][equipment.rank - 1];
        },
        '21020': () => {
            let critical_chance_base = get_let_value(attribute_bonus, 'CriticalDamageBase');
            attribute_bonus['CriticalDamageBase'] =
                critical_chance_base +
                    weapon_effect['21020']['Param']['CriticalDamageBase'][equipment.rank - 1];
        },
        '21027': () => {
            let all_damage_added_ratio = get_let_value(attribute_bonus, 'AllDamageAddedRatio');
            attribute_bonus['AllDamageAddedRatio'] =
                all_damage_added_ratio +
                    weapon_effect['21027']['Param']['AllDamageAddedRatio'][equipment.rank - 1];
            let attack_added_ratio = get_let_value(attribute_bonus, 'AttackAddedRatio');
            attribute_bonus['AttackAddedRatio'] =
                attack_added_ratio +
                    weapon_effect['21027']['Param']['AttackAddedRatio'][equipment.rank - 1] *
                        3;
        },
        '21034': () => {
            let all_damage_added_ratio = get_let_value(attribute_bonus, 'AllDamageAddedRatio');
            attribute_bonus['AllDamageAddedRatio'] =
                all_damage_added_ratio +
                    weapon_effect['21034']['Param']['AllDamageAddedRatio'][equipment.rank - 1] *
                        Ultra_Use[0];
        },
        '23000': () => {
            let attack_added_ratio = get_let_value(attribute_bonus, 'AttackAddedRatio');
            attribute_bonus['AttackAddedRatio'] =
                attack_added_ratio +
                    weapon_effect['23000']['Param']['AttackAddedRatio'][equipment.rank - 1];
            let all_damage_added_ratio = get_let_value(attribute_bonus, 'AllDamageAddedRatio');
            attribute_bonus['AllDamageAddedRatio'] =
                all_damage_added_ratio +
                    weapon_effect['23000']['Param']['AllDamageAddedRatio'][equipment.rank - 1];
        },
        '23010': () => {
            let bp_skill_dmg_add = get_let_value(attribute_bonus, 'BPSkillDmgAdd');
            attribute_bonus['BPSkillDmgAdd'] =
                bp_skill_dmg_add +
                    weapon_effect['23010']['Param']['e_dmg'][equipment.rank - 1];
            let ultra_dmg_add = get_let_value(attribute_bonus, 'UltraDmgAdd');
            attribute_bonus['UltraDmgAdd'] =
                ultra_dmg_add +
                    weapon_effect['23010']['Param']['r_dmg'][equipment.rank - 1];
            let talent_dmg_add = get_let_value(attribute_bonus, 'TalentDmgAdd');
            attribute_bonus['TalentDmgAdd'] =
                talent_dmg_add +
                    weapon_effect['23010']['Param']['t_dmg'][equipment.rank - 1];
        },
        '24001': () => {
            let critical_chance_base = get_let_value(attribute_bonus, 'CriticalChanceBase');
            attribute_bonus['CriticalChanceBase'] =
                critical_chance_base +
                    weapon_effect['24001']['Param']['CriticalChance'][equipment.rank - 1];
            let attack_added_ratio = get_let_value(attribute_bonus, 'AttackAddedRatio');
            attribute_bonus['AttackAddedRatio'] =
                attack_added_ratio +
                    weapon_effect['24001']['Param']['AttackAddedRatio'][equipment.rank - 1];
        },
        '21003': () => {
            let critical_chance_base = get_let_value(attribute_bonus, 'CriticalChanceBase');
            attribute_bonus['CriticalChanceBase'] =
                critical_chance_base +
                    weapon_effect['21003']['Param']['CriticalChance'][equipment.rank - 1];
        },
        '21024': () => {
            let speed_added_ratio = get_let_value(attribute_bonus, 'SpeedAddedRatio');
            attribute_bonus['SpeedAddedRatio'] =
                speed_added_ratio +
                    weapon_effect['21024']['Param']['SpeedAddedRatio'][equipment.rank - 1];
            let all_damage_added_ratio = get_let_value(attribute_bonus, 'AllDamageAddedRatio');
            attribute_bonus['AllDamageAddedRatio'] =
                all_damage_added_ratio +
                    weapon_effect['21024']['Param']['AllDamageAddedRatio'][equipment.rank - 1];
        },
        '20014': () => {
            let speed_added_ratio = get_let_value(attribute_bonus, 'SpeedAddedRatio');
            attribute_bonus['SpeedAddedRatio'] =
                speed_added_ratio +
                    weapon_effect['20014']['Param']['SpeedAddedRatio'][equipment.rank - 1];
        },
        '20007': () => {
            let attack_added_ratio = get_let_value(attribute_bonus, 'AttackAddedRatio');
            attribute_bonus['AttackAddedRatio'] =
                attack_added_ratio +
                    weapon_effect['20007']['Param']['AttackAddedRatio'][equipment.rank - 1];
        },
        // ===== 欢愉光锥（数值来源 miao-plugin resources/meta-sr/weapon/欢愉/calc.js）=====
        // 欢愉键口径：joy/joyPct/xeIgnore/xeEnemydmg 存百分点数值（36 = 36%），punchline 存点数；
        // 常规词条（暴击/攻击/速度等）存小数。触发型特效按面板计算惯例视为已触发（与既有光锥钩子一致）。
        '20023': () => {
            // 嗤笑：阿哈时刻期间欢愉度提高（视为常驻）
            let joy = get_let_value(attribute_bonus, 'joy');
            attribute_bonus['joy'] =
                joy + weapon_effect['20023']['Param']['joy'][equipment.rank - 1];
        },
        '20024': () => {
            // 残泪：拥有的笑点大于等于 10 时暴击伤害提高（视为常驻）
            let critical_damage_base = get_let_value(attribute_bonus, 'CriticalDamageBase');
            attribute_bonus['CriticalDamageBase'] =
                critical_damage_base +
                    weapon_effect['20024']['Param']['CriticalDamageBase'][equipment.rank - 1];
        },
        '21064': () => {
            // 菇菇嘎嘎历险记：欢愉度提高 + 施放欢愉技时敌方全体受到的欢愉伤害提高（视为已触发）
            let joy = get_let_value(attribute_bonus, 'joy');
            attribute_bonus['joy'] =
                joy + weapon_effect['21064']['Param']['joy'][equipment.rank - 1];
            let xe_enemydmg = get_let_value(attribute_bonus, 'xeEnemydmg');
            attribute_bonus['xeEnemydmg'] =
                xe_enemydmg +
                    weapon_effect['21064']['Param']['xeEnemydmg'][equipment.rank - 1];
        },
        '21066': () => {
            // 放个短假：欢愉度提高 + 施放欢愉技期间无视目标防御力（仅欢愉伤害路径消费 xeIgnore，视为常驻）
            let joy_pct = get_let_value(attribute_bonus, 'joyPct');
            attribute_bonus['joyPct'] =
                joy_pct + weapon_effect['21066']['Param']['joyPct'][equipment.rank - 1];
            let xe_ignore = get_let_value(attribute_bonus, 'xeIgnore');
            attribute_bonus['xeIgnore'] =
                xe_ignore + weapon_effect['21066']['Param']['xeIgnore'][equipment.rank - 1];
        },
        '22007': () => {
            // 未来，有我们一起：施放终结技后我方全体欢愉度提高（视为已触发）
            let joy = get_let_value(attribute_bonus, 'joy');
            attribute_bonus['joy'] =
                joy + weapon_effect['22007']['Param']['joy'][equipment.rank - 1];
        },
        '23053': () => {
            // 花花世界迷人眼：每消耗 1 战技点欢愉伤害无视 5-9% 防御（按满 4 层计算），
            // 持有【推流】时全队欢愉度提高（视为已触发）；常驻暴击伤害在 Equipment.json
            let xe_ignore = get_let_value(attribute_bonus, 'xeIgnore');
            attribute_bonus['xeIgnore'] =
                xe_ignore +
                    weapon_effect['23053']['Param']['xeIgnore'][equipment.rank - 1] * 4;
            let joy = get_let_value(attribute_bonus, 'joy');
            attribute_bonus['joy'] =
                joy + weapon_effect['23053']['Param']['joy'][equipment.rank - 1];
        },
        '23054': () => {
            // 当她决定看见：持有【上上签】时我方全体暴击率/暴击伤害提高（视为已触发）；
            // 常驻速度在 Equipment.json；能量恢复效率不影响伤害不入模型
            let critical_chance_base = get_let_value(attribute_bonus, 'CriticalChanceBase');
            attribute_bonus['CriticalChanceBase'] =
                critical_chance_base +
                    weapon_effect['23054']['Param']['CriticalChanceBase'][equipment.rank - 1];
            let critical_damage_base = get_let_value(attribute_bonus, 'CriticalDamageBase');
            attribute_bonus['CriticalDamageBase'] =
                critical_damage_base +
                    weapon_effect['23054']['Param']['CriticalDamageBase'][equipment.rank - 1];
        },
        '23055': () => {
            // 献给明日的色彩：施放欢愉技时敌方全体受到的伤害提高（视为已触发，通用易伤 DmgRatio）；
            // 常驻防御力在 Equipment.json
            let damage_ratio = get_let_value(attribute_bonus, 'DmgRatio');
            attribute_bonus['DmgRatio'] =
                damage_ratio + weapon_effect['23055']['Param']['DmgRatio'][equipment.rank - 1];
        },
        '23057': () => {
            // 欢迎来到银河城：欢愉伤害无视目标防御力（常驻，走 xeIgnore）+
            // 对自身单体施放终结技时获得笑点（视为已触发）；常驻速度在 Equipment.json
            let xe_ignore = get_let_value(attribute_bonus, 'xeIgnore');
            attribute_bonus['xeIgnore'] =
                xe_ignore + weapon_effect['23057']['Param']['xeIgnore'][equipment.rank - 1];
            let punchline = get_let_value(attribute_bonus, 'punchline');
            attribute_bonus['punchline'] =
                punchline + weapon_effect['23057']['Param']['punchline'][equipment.rank - 1];
        },
        '23058': () => {
            // 邂逅于下一个花季：施放欢愉技时敌方目标受到的伤害提高（视为已触发，通用易伤 DmgRatio）；
            // 常驻暴击伤害/能量恢复效率在 Equipment.json
            let damage_ratio = get_let_value(attribute_bonus, 'DmgRatio');
            attribute_bonus['DmgRatio'] =
                damage_ratio + weapon_effect['23058']['Param']['DmgRatio'][equipment.rank - 1];
        },
        '23064': () => {
            // 向浪花掷下盛夏：【风口】速度提高 + 【潮流】欢愉度提高（均视为已触发）；
            // 常驻暴击率在 Equipment.json
            let speed_added_ratio = get_let_value(attribute_bonus, 'SpeedAddedRatio');
            attribute_bonus['SpeedAddedRatio'] =
                speed_added_ratio +
                    weapon_effect['23064']['Param']['SpeedAddedRatio'][equipment.rank - 1];
            let joy_pct = get_let_value(attribute_bonus, 'joyPct');
            attribute_bonus['joyPct'] =
                joy_pct + weapon_effect['23064']['Param']['joyPct'][equipment.rank - 1];
        },
    };
    equipment.id in weaponGetter && weaponGetter[equipment.id]();
    return attribute_bonus;
};
export function weapon_ability(equipment, Ultra_Use, base_attr, attribute_bonus) {
    attribute_bonus = Weapon(equipment, Ultra_Use, base_attr, attribute_bonus);
    return attribute_bonus;
}
