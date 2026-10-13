/**
 * 战绩类命令数字参数解析（utils/archiveArgs.js）
 * 常规演算/周期演算/货币战争战绩共用的语法：
 *  - ≤2位数字=记录下标（货币战争支持到第10条）
 *  - ≥3位数字=uid查他人（同 *宇宙(uid) 口径）；两段式「下标 uid」
 *  - @不进 e.msg（TRSS loader 只写 e.at），解析层不感知
 * parseArchiveArgs 为纯函数，无框架依赖，直接静态 import
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseArchiveArgs } from '../../utils/archiveArgs.js'

test('parseArchiveArgs：无数字默认第1条', () => {
  assert.deepEqual(parseArchiveArgs('*常规演算'), { index: 1, queryUid: '' })
  assert.deepEqual(parseArchiveArgs('*本期演算'), { index: 1, queryUid: '' })
  assert.deepEqual(parseArchiveArgs('*货币战绩'), { index: 1, queryUid: '' })
})

test('parseArchiveArgs：≤2位数字=下标（含两位，货币战争第10条）', () => {
  assert.deepEqual(parseArchiveArgs('*常规演算1'), { index: 1, queryUid: '' })
  assert.deepEqual(parseArchiveArgs('*本期演算3'), { index: 3, queryUid: '' })
  assert.deepEqual(parseArchiveArgs('*货币战绩10'), { index: 10, queryUid: '' })
  assert.deepEqual(parseArchiveArgs('*上期演算战绩2'), { index: 2, queryUid: '' })
  assert.deepEqual(parseArchiveArgs('#星铁常规演算1'), { index: 1, queryUid: '' })
  assert.deepEqual(parseArchiveArgs('＊货币战绩回顾7'), { index: 7, queryUid: '' })
})

test('parseArchiveArgs：0/非法下标钳到 1', () => {
  assert.deepEqual(parseArchiveArgs('*常规演算0'), { index: 1, queryUid: '' })
})

test('parseArchiveArgs：≥3位数字=uid', () => {
  assert.deepEqual(parseArchiveArgs('*常规演算123456789'), { index: 1, queryUid: '123456789' })
  assert.deepEqual(parseArchiveArgs('*货币战绩123456789'), { index: 1, queryUid: '123456789' })
  assert.deepEqual(parseArchiveArgs('*上期演算战绩123456789'), { index: 1, queryUid: '123456789' })
})

test('parseArchiveArgs：两段式「下标 uid」', () => {
  assert.deepEqual(parseArchiveArgs('*常规演算1 123456789'), { index: 1, queryUid: '123456789' })
  assert.deepEqual(parseArchiveArgs('*货币战绩10 123456789'), { index: 10, queryUid: '123456789' })
  assert.deepEqual(parseArchiveArgs('*上期演算战绩3 123456789'), { index: 3, queryUid: '123456789' })
  assert.deepEqual(parseArchiveArgs('＊常规演算2 123456789'), { index: 2, queryUid: '123456789' })
})
