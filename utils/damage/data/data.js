import { readJson } from '../utils/json.js';
const baseDir = 'utils/damage/json/';
export const skilldict = readJson(`${baseDir}SkillData.json`);
export const weapon_effect = readJson(`${baseDir}weapon_effect.json`);
export const char_dict = readJson(`${baseDir}SkillTreeConfig.json`);
