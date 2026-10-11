/**
 * chokidar 桩：测试环境禁用配置文件热更新监听。
 * setting.js 的 watch() 会创建长期文件监听器，钉住事件循环导致测试进程无法退出。
 */
export default {
  watch: () => ({
    on: () => {},
    close: async () => {},
    add: () => {},
    unwatch: () => {}
  })
}
