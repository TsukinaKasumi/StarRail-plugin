function get_let_value(let_list, name) {
    if (let_list[name]) {
        return let_list[name];
    }
    return 0;
}
const Relic = (relic_set, base_attr, attribute_bonus) => {
    const relicGetter = {
        '101': () => {
            if (!relic_set.set_name.startsWith('4'))
                return;
            let SpeedAddedRatio = get_let_value(attribute_bonus, 'SpeedAddedRatio');
            attribute_bonus['SpeedAddedRatio'] = SpeedAddedRatio + 0.06;
            let a_dmg = get_let_value(attribute_bonus, 'NormalDmgAdd');
            attribute_bonus['NormalDmgAdd'] = a_dmg + 0.10000000018626451;
        },
        '102': () => {
            if (!relic_set.set_name.startsWith('4'))
                return;
            let SpeedAddedRatio = get_let_value(attribute_bonus, 'SpeedAddedRatio');
            attribute_bonus['SpeedAddedRatio'] = SpeedAddedRatio + 0.06;
            let a_dmg = get_let_value(attribute_bonus, 'NormalDmgAdd');
            attribute_bonus['NormalDmgAdd'] = a_dmg + 0.10000000018626451;
        },
        '103': () => {
            if (!relic_set.set_name.startsWith('4'))
                return;
            let shield_added_ratio = get_let_value(attribute_bonus, 'shield_added_ratio');
            attribute_bonus['shield_added_ratio'] =
                shield_added_ratio + 0.20000000018626451;
        },
        '104': () => {
            if (!relic_set.set_name.startsWith('4'))
                return;
            let critical_damage_base = get_let_value(attribute_bonus, 'CriticalDamageBase');
            attribute_bonus['CriticalDamageBase'] =
                critical_damage_base + 0.25000000018626451;
        },
        '105': () => {
            if (!relic_set.set_name.startsWith('4'))
                return;
            let attack_added_ratio = get_let_value(attribute_bonus, 'AttackAddedRatio');
            attribute_bonus['AttackAddedRatio'] =
                attack_added_ratio + 0.05000000004656613 * 5;
        },
        '106': () => { },
        '107': () => {
            if (!relic_set.set_name.startsWith('4'))
                return;
            let FireAddedRatio = get_let_value(attribute_bonus, 'FireAddedRatio');
            attribute_bonus['FireAddedRatio'] = FireAddedRatio + 0.12000000009313226;
            let e_dmg = get_let_value(attribute_bonus, 'BPSkillDmgAdd');
            attribute_bonus['BPSkillDmgAdd'] = e_dmg + 0.12000000011175871;
        },
        '108': () => {
            if (!relic_set.set_name.startsWith('4'))
                return;
            let ignore_defence = get_let_value(attribute_bonus, 'ignore_defence');
            attribute_bonus['ignore_defence'] =
                ignore_defence + 0.10000000009313226 * 2;
        },
        '109': () => {
            if (!relic_set.set_name.startsWith('4'))
                return;
            let attack_added_ratio = get_let_value(attribute_bonus, 'AttackAddedRatio');
            attribute_bonus['AttackAddedRatio'] =
                attack_added_ratio + 0.20000000018626451;
        },
        '110': () => {
            if (!relic_set.set_name.startsWith('4'))
                return;
        },
        '111': () => {
            if (!relic_set.set_name.startsWith('4'))
                return;
            let BreakDamageAddedRatioBase = get_let_value(attribute_bonus, 'BreakDamageAddedRatioBase');
            attribute_bonus['BreakDamageAddedRatioBase'] =
                BreakDamageAddedRatioBase + 0.16000000009313226;
        },
        '112': () => {
            if (!relic_set.set_name.startsWith('4'))
                return;
            let critical_chance_base = get_let_value(attribute_bonus, 'CriticalChanceBase');
            attribute_bonus['CriticalChanceBase'] =
                critical_chance_base + 0.10000000009313226;
            let critical_damage_base = get_let_value(attribute_bonus, 'CriticalDamageBase');
            attribute_bonus['CriticalDamageBase'] =
                critical_damage_base + 0.20000000018626451;
        },
        '113': () => {
            if (!relic_set.set_name.startsWith('4'))
                return;
            let critical_chance_base = get_let_value(attribute_bonus, 'CriticalChanceBase');
            attribute_bonus['CriticalChanceBase'] =
                critical_chance_base + 0.08000000009313226 * 2;
        },
        '114': () => {
            if (!relic_set.set_name.startsWith('4'))
                return;
            let SpeedAddedRatio = get_let_value(attribute_bonus, 'SpeedAddedRatio');
            attribute_bonus['SpeedAddedRatio'] = SpeedAddedRatio + 0.12;
        },
        '301': () => {
            if (!relic_set.set_name.startsWith('2'))
                return;
            let speed = get_let_value(attribute_bonus, 'SpeedDelta') +
                get_let_value(base_attr, 'speed') *
                    (get_let_value(attribute_bonus, 'SpeedAddedRatio') + 1);
            if (speed >= 120) {
                let attack_added_ratio = get_let_value(attribute_bonus, 'AttackAddedRatio');
                attribute_bonus['AttackAddedRatio'] =
                    attack_added_ratio + 0.1200000000745058;
            }
        },
        '302': () => {
            if (!relic_set.set_name.startsWith('2'))
                return;
            let speed = get_let_value(attribute_bonus, 'SpeedDelta') +
                get_let_value(base_attr, 'speed') *
                    (get_let_value(attribute_bonus, 'SpeedAddedRatio') + 1);
            if (relic_set.set_name.startsWith('2') && speed >= 120) {
                let attack_added_ratio = get_let_value(attribute_bonus, 'AttackAddedRatio');
                attribute_bonus['AttackAddedRatio'] =
                    attack_added_ratio + 0.0800000000745058;
            }
        },
        '303': () => {
            if (!relic_set.set_name.startsWith('2'))
                return;
            let attack_added_ratio = get_let_value(attribute_bonus, 'AttackAddedRatio');
			// logger.debug('attack_added_ratio：', attack_added_ratio)
            let status_probability = get_let_value(attribute_bonus, 'StatusProbabilityBase');
			let add_atk = Math.min(0.25000000023283064, status_probability * 0.25);
            attribute_bonus['AttackAddedRatio'] = attack_added_ratio + add_atk
                    
        },
        '304': () => {
            if (!relic_set.set_name.startsWith('2'))
                return;
            let StatusResistanceBase = get_let_value(base_attr, 'StatusResistanceBase') +
                get_let_value(attribute_bonus, 'StatusResistanceBase');
            let defence_added_ratio = 0;
            if (relic_set.set_name.startsWith('2') && StatusResistanceBase >= 0.5) {
                defence_added_ratio = get_let_value(attribute_bonus, 'DefenceAddedRatio');
                attribute_bonus['DefenceAddedRatio'] =
                    defence_added_ratio + 0.1500000001396984;
            }
        },
        '305': () => {
            if (!relic_set.set_name.startsWith('2'))
                return;
            let critical_damage_base = get_let_value(base_attr, 'CriticalDamageBase') +
                get_let_value(attribute_bonus, 'CriticalDamageBase');
            if (relic_set.set_name.startsWith('2') && critical_damage_base >= 1.2) {
                let critical_chance_base = get_let_value(attribute_bonus, 'CriticalChanceBase');
                attribute_bonus['CriticalChanceBase'] =
                    critical_chance_base + 0.6000000005587935;
            }
        },
        '306': () => {
            if (!relic_set.set_name.startsWith('2'))
                return;
            let critical_chance_base = get_let_value(attribute_bonus, 'CriticalChanceBase') +
                get_let_value(base_attr, 'CriticalChanceBase');
            if (relic_set.set_name.startsWith('2') && critical_chance_base >= 0.5) {
                let q_dmg = get_let_value(attribute_bonus, 'UltraDmgAdd');
                attribute_bonus['UltraDmgAdd'] = q_dmg + 0.1500000001396984;
                let a3_dmg = get_let_value(attribute_bonus, 'TalentDmgAdd');
                attribute_bonus['TalentDmgAdd'] = a3_dmg + 0.1500000001396984;
            }
        },
        '307': () => {
            if (!relic_set.set_name.startsWith('2'))
                return;
            let speed = get_let_value(attribute_bonus, 'SpeedDelta') +
                get_let_value(base_attr, 'speed') *
                    (get_let_value(attribute_bonus, 'SpeedAddedRatio') + 1);
            if (relic_set.set_name.startsWith('2') && speed >= 145) {
                let BreakDamageAddedRatio = get_let_value(attribute_bonus, 'BreakDamageAddedRatio');
                attribute_bonus['BreakDamageAddedRatio'] =
                    BreakDamageAddedRatio + 0.20000000018626451;
            }
        },
        '308': () => {
            if (!relic_set.set_name.startsWith('2'))
                return;
            let speed = get_let_value(attribute_bonus, 'SpeedDelta') +
                get_let_value(base_attr, 'speed') *
                    (get_let_value(attribute_bonus, 'SpeedAddedRatio') + 1);
            if (relic_set.set_name.startsWith('2') && speed >= 120) {
            }
        },
        '309': () => {
            if (!relic_set.set_name.startsWith('2'))
                return;
            let critical_chance_base = get_let_value(attribute_bonus, 'CriticalChanceBase') +
                get_let_value(base_attr, 'CriticalChanceBase');
            if (relic_set.set_name.startsWith('2') && critical_chance_base >= 0.7) {
                let a_dmg = get_let_value(attribute_bonus, 'NormalDmgAdd');
                attribute_bonus['NormalDmgAdd'] = a_dmg + 0.20000000018626451;
                let a2_dmg = get_let_value(attribute_bonus, 'BPSkillDmgAdd');
                attribute_bonus['BPSkillDmgAdd'] = a2_dmg + 0.20000000018626451;
            }
        },
        '310': () => {
            if (!relic_set.set_name.startsWith('2'))
                return;
            let StatusResistanceBase = get_let_value(base_attr, 'StatusResistanceBase') +
                get_let_value(attribute_bonus, 'StatusResistanceBase');
            if (relic_set.set_name.startsWith('2') && StatusResistanceBase >= 0.3) {
                let critical_damage_base = get_let_value(attribute_bonus, 'CriticalDamageBase');
                attribute_bonus['CriticalDamageBase'] =
                    critical_damage_base + 0.10000000018626451;
            }
        },
    };
    relic_set.set_id in relicGetter && relicGetter[relic_set.set_id]();
    return attribute_bonus;
};
export function relice_ability(relic_set, base_attr, attribute_bonus) {
    attribute_bonus = Relic(relic_set, base_attr, attribute_bonus);
    return attribute_bonus;
}
