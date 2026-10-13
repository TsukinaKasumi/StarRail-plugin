/**
 * fetch mock 控制（配合 hooks.mjs 拦截的 node-fetch 桩使用）。
 * 用法：先 register hooks，再 import 被测模块，然后：
 *   enqueue({ body: {...} })          按顺序消费的响应
 *   enqueue((url) => ({ body: f(url) }))  按 URL 动态生成
 *   setFallback((url) => ({ body: ... }))  兜底响应
 *   resetFetchMock()                  清空（每个 test 前建议 reset）
 */
const state = (globalThis.__fetchMock = globalThis.__fetchMock || { queue: [], fallback: null })

export function enqueue (item) {
  state.queue.push(item)
}

export function setFallback (fn) {
  state.fallback = fn
}

export function resetFetchMock () {
  state.queue.length = 0
  state.fallback = null
}
