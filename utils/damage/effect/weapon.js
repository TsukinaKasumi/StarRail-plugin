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
    };
    equipment.id in weaponGetter && weaponGetter[equipment.id]();
    return attribute_bonus;
};
export function weapon_ability(equipment, Ultra_Use, base_attr, attribute_bonus) {
    attribute_bonus = Weapon(equipment, Ultra_Use, base_attr, attribute_bonus);
    return attribute_bonus;
}
