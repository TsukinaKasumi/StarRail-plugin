/**
 * 遗器本地评分（替代已死的 avocado.wiki 服务端评分）
 *
 * 算法忠实移植自 miao-plugin（models/artis/ArtisMark.js + ArtisMarkCfg.js +
 * resources/meta-sr/artifact/meta.js 的 sr 分支），为静态移植、不依赖
 * miao-plugin 运行时；权重与角色基础属性快照在
 * resources/panel/data/artis-mark.json（由 temp/gen-artis-mark.mjs 生成）。
 *
 * ============================ miao 评分口径 ============================
 * 【词条权重】每角色 12 键权重（hp/atk/def/speed/cpct/cdmg/stance/heal/
 *   recharge/effPct/effDef/dmg），0 = 无效词条。
 * 【mark/fixWeight】
 *   普通词条（如 cpct）：mark = weight / 单次满强化值（cpct 3.24 等，见 attrMap）；
 *     fixWeight = weight。
 *   小词条（atkPlus/hpPlus/defPlus，继承对应大词条权重）：按角色 80 级基础
 *     属性折算 —— mark = weight / attrMap[基].value / (baseAttr[基] + plus) × 100
 *     （plus 仅 atk 为 520，miao 原式照抄），fixWeight = mark × 单次满强化值。
 *   attrs 表只收录 weight > 0 的词条，评分时未收录词条贡献 0。
 * 【部位满分 posMaxMark】部位 1/2（头/手）主词条固定且不计分；满分 = 最优主词条
 *   fixWeight×2 + 最优 4 副词条（首位×6 + 其余各×1，排除主词条占位）。
 * 【单件得分 getMark】(主词条 mark×值/4 + Σ副词条 mark×值) × (1+fixPct)/2 /
 *   posMaxMark × 66 —— 理想遗器约 66 分（评分档位 D<7 … ACE<56, MAX≥56，
 *   满档上限 70）。fixPct 为主词条契合度（weight / 部位最优主词条权重，夹在
 *   0-1）：3/4/5/6 部位错主词条时减半（×1/2），充能绳不衰减；5 部位（球）
 *   本属性伤害球视同「伤害加成」权重。
 * 【副词条 weight（本插件展示语义，替代 avocado 同名字段）】
 *   weight = mark × 值 / 100 = 「等效最优词条的满强化次数」：
 *   100 权重词条满强化一次 = 1.0（模板 ≥1 高亮 weight-heavy），
 *   0 < weight < 1 次高亮 weight-normal，0 = 无效词条不高亮。
 *
 * ============================ 输入输出 ============================
 * 输入为本插件遗器条目（缓存契约见 utils/panel/enhanced.js）：
 *   { id, level, main_affix_tag, main_affix_value,
 *     sub_affix_id: [{tag, value, ...}] }
 * 百分比词条（affixData.miaoAttrToAffix 的 percent: true，如暴击率）值为小数
 * （0.0324），评分前 ×100 换回 miao 的百分点口径（3.24）。
 * 输出：relic.score = 单件得分（0-70 量纲，模板 toFixed(1)）；
 *   sub_affix_id[i].weight = 副词条展示权重（上述语义）。
 */

import fs from 'fs'
import { pluginRoot } from '../path.js'
import { miaoAttrToAffix } from './affixData.js'

// ---------- 词条属性口径（快照自 miao meta-sr/artifact/meta.js） ----------
// value = 副词条单次满强化值（5星）；base = 小词条对应的大词条键
const attrMap = {
  atk: { value: 4.32 },
  atkPlus: { value: 127 / 6, base: 'atk' },
  def: { value: 5.4 },
  defPlus: { value: 127 / 6, base: 'def' },
  hp: { value: 4.32 },
  hpPlus: { value: 254 / 6, base: 'hp' },
  speed: { value: 2.6 },
  cpct: { value: 3.24 },
  cdmg: { value: 6.48 },
  recharge: { value: 3.11 },
  dmg: { value: 6.22 },
  heal: { value: 5.53 },
  stance: { value: 6.48 },
  effPct: { value: 4.32 },
  effDef: { value: 4.32 }
}

// 各部位可选主词条（1/2 部位固定 hpPlus/atkPlus 不在此表）
const mainAttr = {
  3: 'atk,def,hp,cpct,cdmg,heal,effPct'.split(','),
  4: 'atk,def,hp,speed'.split(','),
  5: 'atk,def,hp,dmg'.split(','),
  6: 'atk,def,hp,recharge,stance'.split(',')
}

// 副词条候选全集（getMaxMark 取最优 4 用的遍历序，影响同权重并列时的取舍）
const subAttr = 'atk,atkPlus,def,defPlus,hp,hpPlus,speed,cpct,cdmg,effPct,effDef,stance'.split(',')

// 属性伤害主词条键（5 部位球），本属性球按 dmg 权重计
const elemKeys = ['phy', 'fire', 'ice', 'elec', 'wind', 'quantum', 'imaginary']

// 小攻击词条换算的 miao 原式常数（atk 基础值 +520）
const ATK_PLUS_FIX = 520

// 面板 damage_type -> miao 元素键（属性球同属性判定）
export const damageTypeToMiaoElem = {
  Fire: 'fire', Ice: 'ice', Thunder: 'elec', Quantum: 'quantum',
  Wind: 'wind', Imaginary: 'imaginary', Physical: 'phy'
}

// ---------- 本插件词条 tag -> miao 词条键（复用 affixData 的映射反查） ----------
// tagToMiao[tag] = { key: miao键, percent: 值是否为小数（需 ×100） }
const tagToMiao = {}
for (const [key, affix] of Object.entries(miaoAttrToAffix)) {
  tagToMiao[affix.tag] = { key, percent: !!affix.percent }
}

// 遗器部位（1头 2手 3衣 4鞋 5球 6绳）
const relicTypeToPos = { HEAD: 1, HAND: 2, BODY: 3, FOOT: 4, NECK: 5, OBJECT: 6 }

// ---------- 静态数据（懒加载 + 模块级缓存，缺文件时降级空表） ----------

let markDataCache = null
function getMarkData () {
  if (markDataCache === null) {
    try {
      markDataCache = JSON.parse(fs.readFileSync(
        `${pluginRoot}/resources/panel/data/artis-mark.json`, 'utf8'))
    } catch (e) {
      markDataCache = {}
    }
  }
  return markDataCache
}

let relicMetaCache = null
function getRelicMeta (id) {
  if (relicMetaCache === null) {
    try {
      relicMetaCache = JSON.parse(fs.readFileSync(
        `${pluginRoot}/resources/panel/data/relics.json`, 'utf8'))
    } catch (e) {
      relicMetaCache = {}
    }
  }
  return relicMetaCache[String(id)]
}

/** 遗器 id -> 部位（1-6）；relics.json type 优先，未收录 ID 退回编号末位 */
export function getRelicPos (id) {
  const meta = getRelicMeta(id)
  if (meta && relicTypeToPos[meta.type]) return relicTypeToPos[meta.type]
  const last = Number(String(id).slice(-1))
  return last >= 1 && last <= 6 ? last : null
}

// ---------- 权重解析 ----------

const normName = s => String(s).replace(/[\u2022\u00b7\u2027]/g, '.')

/**
 * 解析角色评分配置（avatarId 或角色名）
 * @returns {{name:string, weights:object, base:{hp,atk,def}}} 权重未收录时
 *   返回 default 权重（Saber/Archer 等，与 miao 的 defaultAttrWeight 行为一致）
 */
export function resolveCharWeights (charIdent) {
  const data = getMarkData()
  const chars = data.chars || {}
  let entry = null
  if (charIdent != null && charIdent !== '') {
    entry = chars[String(charIdent)] || null
    if (!entry) {
      // 名称匹配：先精确、再圆点变体归一（丹恒•饮月 / 丹恒·饮月）
      const target = normName(charIdent)
      for (const item of Object.values(chars)) {
        if (item && (item.name === charIdent || normName(item.name) === target)) {
          entry = item
          break
        }
      }
    }
  }
  return {
    name: (entry && entry.name) || String(charIdent || ''),
    weights: (entry && entry.weight) || data.default || {},
    base: (entry && entry.base) || { hp: 14000, atk: 230, def: 700 }
  }
}

// ---------- 评分配置（ArtisMarkCfg.getCfg + ArtisMark.getMaxMark 移植） ----------

/**
 * 构建 attrs 表：{ miao键: { weight, mark, fixWeight } }，只收录 weight>0 词条
 * （普通词条 mark = weight/满强化值；小词条按角色基础属性折算，式见文件头）
 */
function buildAttrs (attrWeight, baseAttr) {
  const attrs = {}
  for (const [key, cfg] of Object.entries(attrMap)) {
    const k = cfg.base || ''
    const weight = attrWeight[k || key]
    if (!weight || weight * 1 === 0) continue
    let mark, fixWeight
    if (!k) {
      mark = weight / cfg.value
      fixWeight = weight
    } else {
      const plus = k === 'atk' ? ATK_PLUS_FIX : 0
      mark = weight / attrMap[k].value / (baseAttr[k] + plus) * 100
      fixWeight = weight * cfg.value / attrMap[k].value / (baseAttr[k] + plus) * 100
    }
    attrs[key] = { weight, mark, fixWeight }
  }
  return attrs
}

/**
 * 候选词条按 fixWeight 取最优（稳定升序 + 反转，与 miao lodash.sortBy().reverse()
 * 的并列取舍一致：同权重时后遍历的排前）
 */
function getMaxAttr (attrs, list, maxLen, banAttr = '') {
  const tmp = []
  for (const attr of list) {
    if (attr === banAttr) continue
    if (!attrs[attr]) continue
    tmp.push({ attr, mark: attrs[attr].fixWeight })
  }
  tmp.sort((a, b) => a.mark - b.mark)
  tmp.reverse()
  return tmp.slice(0, maxLen).map(ds => ds.attr)
}

/** 各部位满分（口径见文件头）：{ 1-6: 部位满分, m1-m6: 部位最优主词条 fixWeight } */
function getMaxMark (attrs) {
  const ret = {}
  for (let idx = 1; idx <= 6; idx++) {
    let totalMark = 0
    let mMark = 0
    let mAttr = ''
    if (idx === 1) {
      mAttr = 'hpPlus'
    } else if (idx === 2) {
      mAttr = 'atkPlus'
    } else {
      const mainCandidates = getMaxAttr(attrs, mainAttr[idx])
      if (mainCandidates.length > 0) {
        mAttr = mainCandidates[0]
        mMark = attrs[mAttr].fixWeight
        totalMark += mMark * 2
      } else {
        mAttr = mainAttr[idx][0]
      }
    }
    const sAttr = getMaxAttr(attrs, subAttr, 4, mAttr)
    sAttr.forEach((attr, aIdx) => {
      totalMark += attrs[attr].fixWeight * (aIdx === 0 ? 6 : 1)
    })
    ret[idx] = totalMark
    ret['m' + idx] = mMark
  }
  return ret
}

/**
 * 角色评分配置（权重 + attrs + 部位满分）
 * @param {number|string} charIdent avatarId 或角色名
 */
export function getCharCfg (charIdent) {
  const { name, weights, base } = resolveCharWeights(charIdent)
  const attrs = buildAttrs(weights, base)
  return { name, weights, attrs, posMaxMark: getMaxMark(attrs) }
}

// ---------- 单件评分（ArtisMark.getMark sr 分支移植） ----------

/** 评分档位（与 miao getMarkClass 一致） */
export function getMarkClass (mark) {
  const scoreMap = [['D', 7], ['C', 14], ['B', 21], ['A', 28],
    ['S', 35], ['SS', 42], ['SSS', 49], ['ACE', 56], ['MAX', 70]]
  for (const [cls, bound] of scoreMap) {
    if (mark < bound) return cls
  }
  return undefined
}

/**
 * 单件遗器评分
 * @param {object} relic 遗器条目（本插件缓存格式）
 * @param {object} charCfg getCharCfg 产出
 * @param {object} [opts] elem：角色 miao 元素键（damageTypeToMiaoElem 换算），
 *   属性球同属性判定用；缺省按异色球计分
 * @returns {{score:number, pos:number|null, weights:object[]}} weights 与
 *   sub_affix_id 等长（无效词条为 0），供调用方回填
 */
export function scoreRelic (relic, charCfg, { elem } = {}) {
  const { attrs, posMaxMark } = charCfg
  const pos = relic && relic.id != null ? getRelicPos(relic.id) : null
  const subs = (relic && Array.isArray(relic.sub_affix_id)) ? relic.sub_affix_id : []
  // 副词条展示权重（与部位无关，pos 未知也照常计算）
  const weights = subs.map(sub => {
    const m = sub && tagToMiao[sub.tag]
    if (!m) return 0
    const value = (Number(sub.value) || 0) * (m.percent ? 100 : 1)
    return (attrs[m.key]?.mark || 0) * value / 100
  })
  if (!pos) {
    return { score: 0, pos: null, weights }
  }
  const mainM = relic.main_affix_tag ? tagToMiao[relic.main_affix_tag] : null
  if (!mainM || !mainM.key) {
    return { score: 0, pos, weights }
  }
  const mainValue = (Number(relic.main_affix_value) || 0) * (mainM.percent ? 100 : 1)
  let ret = 0
  let fixPct = 1
  if (pos >= 3) {
    let mainKey = mainM.key
    if (mainKey !== 'recharge') {
      // 5 部位（球）：同属性伤害球视同 dmg 权重（异色球 attrs[键] 未收录 → 计 0）
      if (pos === 5 && elemKeys.includes(mainKey) && elem === mainKey) {
        mainKey = 'dmg'
      }
      const mMax = posMaxMark['m' + pos]
      fixPct = mMax > 0
        ? Math.max(0, Math.min(1, (attrs[mainKey]?.weight || 0) / mMax))
        : 1
    }
    ret += (attrs[mainKey]?.mark || 0) * mainValue / 4
  }
  for (const sub of subs) {
    const m = sub && tagToMiao[sub.tag]
    if (!m) continue
    const value = (Number(sub.value) || 0) * (m.percent ? 100 : 1)
    ret += (attrs[m.key]?.mark || 0) * value
  }
  const pMax = posMaxMark[pos]
  const score = pMax > 0 ? ret * (1 + fixPct) / 2 / pMax * 66 : 0
  return { score, pos, weights }
}

/**
 * 批量遗器评分（panel() 渲染前接入）
 * 就地覆盖 relic.score 与 sub_affix_id[i].weight（旧缓存残留的 avocado 旧分值
 * 一并覆盖，不重复消费），返回传入的 relics 数组
 * @param {number|string} charIdent avatarId 或角色名
 * @param {Array} relics 遗器列表
 * @param {object} [opts] elem：miao 元素键（一般传 damageTypeToMiaoElem[damage_type]）
 */
export function scoreRelics (charIdent, relics, { elem } = {}) {
  if (!Array.isArray(relics)) return relics
  const charCfg = getCharCfg(charIdent)
  for (const relic of relics) {
    if (!relic || typeof relic !== 'object') continue
    const { score, weights } = scoreRelic(relic, charCfg, { elem })
    relic.score = score
    if (Array.isArray(relic.sub_affix_id)) {
      relic.sub_affix_id.forEach((sub, i) => {
        if (sub && typeof sub === 'object') sub.weight = weights[i] || 0
      })
    }
  }
  return relics
}
