/**
 * 战绩类命令的数字参数解析（常规演算/周期演算/货币战争战绩共用）
 *
 * 语法：≤2位数字=记录下标（*常规演算1、*货币战绩10），≥3位数字=uid查他人
 * （*常规演算123456789，同 *宇宙(uid) 口径），两段式「下标 uid」（*常规演算1 123456789）；
 * @查他人不进 e.msg（TRSS loader 只写 e.at），由调用方走 MysInfo.getUid(e, false) 的 at 分支
 */

/**
 * 解析命令中的下标与uid
 * @param {string} msg 命令原文
 * @returns {{index: number, queryUid: string}}
 */
export function parseArchiveArgs (msg) {
  let nums = msg.match(/\d+/g) || []
  let index = 1
  let queryUid = ''
  if (nums.length >= 2) {
    index = Number(nums[0])
    queryUid = nums[1]
  } else if (nums.length === 1) {
    if (nums[0].length <= 2) index = Number(nums[0])
    else queryUid = nums[0]
  }
  if (!(index >= 1)) index = 1
  return { index, queryUid }
}
