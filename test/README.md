# 单元测试

基于 Node 内置测试器（`node:test`，零第三方测试框架）。运行：`npm test` 或 `node --test "test/**/*.test.js"`（注意：Node 24 不支持目录参数，须用引号包住的 glob）。

## 目录结构（与源码镜像，按模块分层）

```
test/
├── infra.test.js              # 测试基建自检（桩覆盖全部 apps、伪根引导、正则提取）
├── helpers/                   # 测试基建（各测试文件只读使用，勿在测试内修改）
│   ├── globals.mjs            #   logger/redis 全局桩（副作用导入）
│   ├── hooks.mjs              #   模块解析钩子：Yunzai 侧 import → 桩
│   ├── stubs/                 #   Yunzai 模块桩（plugin/cfg/common/User/NoteUser/GsCfg/MysInfo）
│   ├── boot.mjs               #   伪 Yunzai 根引导（pluginRoot 的 cwd 依赖；data 写入沙箱）
│   ├── rule-extractor.mjs     #   从 apps 源码提取命令正则（免加载框架测分派）
│   ├── factories.mjs          #   合成数据工厂（抽卡记录/srJson 树）
│   └── fetch-mock.mjs         #   网络请求 mock（测试禁真实网络）
├── fixtures/                  # 静态合成数据（按域分目录；严禁真实用户数据）
├── apps/                      # 与 apps/ 镜像（命令分派等 app 层测试）
└── utils/                     # 与 src 的 utils/ 镜像
    ├── gacha/                 #   抽卡记录域（poolData/stat/url/sync/uigf）
    ├── gachasimulation/       #   模拟抽卡域（pools/probability/simulate）
    ├── panel/                 #   面板域（enhanced/mys-converter/miao-sync）
    └── damage/                #   伤害引擎域（elation/memosprite/…/regression 基线）
```

## 约定

1. **数据脱敏（硬性）**：fixtures 与测试内数据全部合成；禁止出现真实 QQ/UID/抽卡记录，
   禁止任何 cookie/stoken/authKey 形态的字符串。需要请求数据时用 factories 生成或 Mock。
2. **依赖 Yunzai 运行时的被测模块**：先 `import './helpers/globals.mjs'`（副作用），
   再 `register(HOOKS_URL)`（HOOKS_URL 从 helpers/hooks.mjs 导入，子目录文件免手写相对路径），最后**动态 import** 被测模块
   （静态 import 会在钩子注册前解析）。
3. **依赖 pluginRoot 路径的被测模块**：先 `bootFakeRoot()`（chdir 到伪根）再动态 import，
   本地数据写入走沙箱，不污染仓库与线上数据。
4. **网络请求**：hooks 已把 node-fetch 重定向到桩，任何真实网络请求都会抛错——
   用 fetch-mock 的 enqueue/setFallback 提供响应。
5. devDependencies（lodash/moment/node-fetch/md5）仅用于无 Yunzai 环境跑测试（CI）；
   运行时依赖由 Yunzai 根 node_modules 提供。
