/**
 * node-fetch 桩：单元测试内禁止真实网络请求（脱敏 + 确定性）。
 * 通过 globalThis.__fetchMock 控制（见 helpers/fetch-mock.mjs）。
 */
const state = (globalThis.__fetchMock = globalThis.__fetchMock || { queue: [], fallback: null })

function makeRes ({ status = 200, body }) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json () {
      return body
    },
    async text () {
      return typeof body === 'string' ? body : JSON.stringify(body)
    }
  }
}

export default async function fetchStub (url, opts) {
  if (state.queue.length > 0) {
    const item = state.queue.shift()
    const res = typeof item === 'function' ? item(url, opts) : item
    return makeRes(res)
  }
  if (state.fallback) {
    return makeRes(state.fallback(url, opts))
  }
  throw new Error(`单元测试禁止真实网络请求（未设置 mock）：${url}`)
}
