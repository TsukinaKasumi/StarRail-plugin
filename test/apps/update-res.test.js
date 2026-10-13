/**
 * 图片加量包更新命令构造 —— apps/update.js buildUpdateResCommand
 *
 * 行为契约（*更新图像 / *图像更新，可选 强制 / github / gitee 后缀）：
 *  - 已安装：git pull（强制时先 checkout 还原，字符串与旧实现逐字一致）；
 *    显式 github/gitee 后缀时先 git remote set-url 换源再拉取
 *    （gitee 后缀此前不生效、github 源失联后无法换到 gitee——本次修复的行为锚点）
 *  - 未安装：git clone 浅克隆，默认 gitee 源，github 后缀选 github 源
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import '../helpers/globals.mjs'
import { register } from 'node:module'
import { bootFakeRoot } from '../helpers/boot.mjs'

register('../helpers/hooks.mjs', import.meta.url)
bootFakeRoot()

const { buildUpdateResCommand } = await import('../../apps/update.js')

const GITEE = 'https://gitee.com/yuan_hu_sheng/StarRail-plugin-PanelPic.git'
const GITHUB = 'https://github.com/yhs21241/StarRail-plugin-PanelPic.git'
const RES = '/srv/yunzai/plugins/StarRail-plugin/resources'
const cmd = (msg, hasPack) => buildUpdateResCommand(msg, hasPack, RES)

test('已安装·无后缀：跟随 origin 的 git pull（强制含还原，与旧实现逐字一致）', () => {
  assert.equal(cmd('*更新图像', true), 'git pull')
  assert.equal(cmd('*图像更新', true), 'git pull')
  assert.equal(cmd('#星铁强制更新图像', true), 'git  checkout . && git  pull')
})

test('已安装·显式源后缀：先 set-url 换源再拉取（修复锚点：gitee 后缀此前不生效）', () => {
  assert.equal(cmd('*更新图像gitee', true), `git remote set-url origin ${GITEE} && git pull`)
  assert.equal(cmd('*更新图像github', true), `git remote set-url origin ${GITHUB} && git pull`)
  assert.equal(
    cmd('*强制更新图像gitee', true),
    `git remote set-url origin ${GITEE} && git  checkout . && git  pull`
  )
  assert.equal(
    cmd('*强制更新图像github', true),
    `git remote set-url origin ${GITHUB} && git  checkout . && git  pull`
  )
})

test('未安装：git clone 浅克隆，默认 gitee 源、github 后缀换 github 源', () => {
  assert.equal(cmd('*更新图像', false), `git clone ${GITEE} "${RES}/pro-file/" --depth=1`)
  assert.equal(cmd('*更新图像gitee', false), `git clone ${GITEE} "${RES}/pro-file/" --depth=1`)
  assert.equal(cmd('*更新图像github', false), `git clone ${GITHUB} "${RES}/pro-file/" --depth=1`)
})
