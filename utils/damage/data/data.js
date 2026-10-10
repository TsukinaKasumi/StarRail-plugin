import { readJson } from '../utils/json.js';
const baseDir = 'utils/damage/json/';
export const skilldict = readJson(`${baseDir}SkillData.json`);
export const weapon_effect = readJson(`${baseDir}weapon_effect.json`);
export const char_dict = readJson(`${baseDir}character.json`);
export const equipment_dict = readJson(`${baseDir}Equipment.json`);
export const relicsetskill = readJson(`${baseDir}RelicSetSkill.json`);
export const AvatarRankSkillUp = readJson(`${baseDir}avatarRankSkillUp.json`);
// 欢愉基础伤害表（1-80 级，下标 = 等级-1）= 击破基础伤害 × 2，数值与 miao-plugin DmgCalcMeta 一致
export const elationBaseDmg = readJson(`${baseDir}elationBaseDmg.json`);