/**
 * 从 apps/*.js 源码提取命令规则（reg/fnc 对），不加载 Yunzai 框架即可测试命令分派。
 *
 * 返回 [{ app, fnc, reg, regex }]：reg 为替换 ${rulePrefix} 后的正则字符串，
 * regex 为可执行的 RegExp（全局大小写敏感，与 Yunzai 加载行为一致）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const APPS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'apps')

const RULE_PREFIX = String.raw`((#|\*)?(星铁|星轨|崩铁|星穹铁道|铁道|sr)|\*|＊)`

export function extractRules () {
  const rules = []
  for (const file of fs.readdirSync(APPS_DIR).filter((f) => f.endsWith('.js'))) {
    const source = fs.readFileSync(path.join(APPS_DIR, file), 'utf8')
    const re = /reg:\s*(?:'([^']+)'|`([^`]+)`)[\s\S]{0,120}?fnc:\s*'(\w+)'/g
    let m
    while ((m = re.exec(source))) {
      // 还原 JS 字符串字面量转义为运行时语义（单引号与模板字面量都会处理 \\ 转义：
      // 文件文本 '\\d' 的运行时值是 \d、'\d' 是 d）。须在 ${rulePrefix} 替换之前做，
      // 避免前缀里的 \\* 被二次还原
      const ESCAPE_MAP = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', '0': '\0' }
      const unescape = (s) => s.replace(/\\([\s\S])/g, (all, c) => ESCAPE_MAP[c] ?? c)
      const raw = unescape(m[2] ?? m[1])
      const reg = raw.replaceAll('${rulePrefix}', RULE_PREFIX)
      let regex
      try {
        regex = new RegExp(reg)
      } catch (e) {
        throw new Error(`apps/${file} 的正则无法编译: ${reg}\n${e.message}`)
      }
      rules.push({ app: file.replace('.js', ''), fnc: m[3], reg, regex })
    }
  }
  return rules
}

/** 断言辅助：返回全部命中给定消息的规则 */
export function matchRules (rules, msg) {
  return rules.filter((r) => r.regex.test(msg))
}
