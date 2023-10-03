import { readJson } from '../utils/json.js';
const baseDir = 'utils/damage/json/';
export const skilldict = readJson(`${baseDir}SkillData.json`);
export const weapon_effect = readJson(`${baseDir}weapon_effect.json`);
export const char_dict = readJson(`${baseDir}character.json`);
export const equipment_dict = readJson(`${baseDir}Equipment.json`);
export const relicsetskill = readJson(`${baseDir}RelicSetSkill.json`);
export const AvatarRankSkillUp = readJson(`${baseDir}avatarRankSkillUp.json`);