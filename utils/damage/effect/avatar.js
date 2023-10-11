import { skilldict } from '../data/data.js';
function get_let_value(let_list, name) {
    if (let_list[name]) {
        return let_list[name];
    }
    return 0;
}
const Avatar = (data, _, attribute_bonus) => {
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
