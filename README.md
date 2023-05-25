![logo](https://user-images.githubusercontent.com/21212372/235622221-7c5a5721-784b-4a31-9b24-60c88663548f.png)

<div align=center> <h1>云崽QQ机器人的《崩坏：星穹铁道》插件</h1> </div>
<div align=center>
 <img src ="https://img.shields.io/github/issues/hewang1an/StarRail-plugin?logo=github"/>
<img src ="https://img.shields.io/github/license/hewang1an/StarRail-plugin"/>
<!-- <img src ="https://img.shields.io/github/v/tag/hewang1an/StarRail-plugin?label=latest%20version&logo=github"/> -->
<img src ="https://img.shields.io/github/languages/top/hewang1an/StarRail-plugin?logo=github"/>
</div>

### 5.21更新：支持查询全平台数据(包括欧服以及美服），在config/panelAPI内将API修改为sr.ikechan8370
更新报错一律执行
<br>cd plugins/StarRail-plugin && git fetch --all && git reset --hard origin/main
### 使用说明

`StarRail-plugin`为查询崩坏：星穹铁道基本信息的插件，包括角色面板、体力以及米游社所拥有的的一切有关星轨的功能

具体功能可在安装插件后 通过 `#星铁帮助` 查看详细指令

### BUG反馈

QQ群：758447726
<br>注：只有加入QQ群聊才可申请参与内部测试！

### 如果觉得插件对你有帮助的话请点一个star！这是对我们最大的支持和动力！
---
星穹铁道插件

支持米游社相关的基本功能，后续会加其他功能，比如查看忘却之庭数据之类
有相关的建议和需要的功能可以在issues中提出，会尽量完善,核心功能完善后将优化部分代码和功能，以及UI部分。

### 安装方法

1. 进入Yunzai根目录

2. 推荐使用git进行安装，方便后续升级，在Yunzai根目录内打开终端执行以下命令

gitee
```shell
git clone --depth=1 https://gitee.com/hewang1an/StarRail-plugin.git ./plugins/StarRail-plugin
```
github
```shell
git clone --depth=1 https://github.com/hewang1an/StarRail-plugin.git ./plugins/StarRail-plugin
```

安装完成后，发送 `#星铁更新` 即可自动更新 StarRail-plugin

### 手动下载安装（不推荐）

手工下载的 zip 压缩包，先将解压后的 StarRail-plugin-master 文件夹更名为 StarRail-plugin 放置在 Yunzai-Bot 目录下的 plugins 文件夹内
因为压缩包不支持用`#星铁更新` 进行更新，不方便后续更新升级，所以不推荐下载压缩包

## 功能介绍

### *绑定＋你的uid

### *希儿面板
查看角色属性，遗器，命座，光锥等信息

### *更新面板
使用已有的面板API进行面板数据的更新，面板API来源:mihomo.me
支持官服、B服、国际服

### *收入
查看本月星琼收入

### *体力
查看目前开拓力信息和委托完成进度

### *抽卡链接（绑定）
在群内发送抽卡链接进行绑定，私聊发送可能会导致出错

### *在线时长
可查看七天内的在线时长，可能需要重新绑定cookie，建议先#扫码登录然后再绑定星铁uid后进行查看

### #白露攻略
查看对应角色的攻略，数据来源米游社 感谢[@真心](https://github.com/RealHeart)提供的攻略帮助

### *抽卡分析角色/光锥/常驻/新手(刷新)
查看卡池抽卡记录信息

### *切换面板1/*api列表
可在config/panelApi中配置
如果连不上请将API设置为sr.ikechan8370.com
  - https://sr.ikechan8370.com/v1/info/
  - https://lulu.roki.best/v1/info/
  - https://sr.roki.best/v1/info/
填入可选api

  抽卡分析默认会缓存结果，后面加上刷新才会获取新的抽卡记录

绝大部分功能需要绑定cookie进行使用，推荐使用[逍遥插件](https://gitee.com/Ctrlcvs/xiaoyao-cvs-plugin)发送#扫码登录进行cookie的绑定，否则可能会报错
获取抽卡链接看[这里](https://starrailstation.com/cn/warp#import)（仅pc，ios）


## 赞助

如果觉得本项目对你有帮助的话，愿意的话不妨赞助我们让我们有更多动力更新！
- [墨西哥鳄梨酱](https://afdian.net/a/ikechan8370) 提供插件本体和主要功能和面板API
- [鹤望兰](https://afdian.net/a/hewang1an) 提供部分功能以及后续维护

## 特别鸣谢♥
- mihomo.me：提供面板API来源
- [狐狸](https://github.com/Tighnari520)(依托答辩)：插件美工
- [bietiaop](https://github.com/bietiaop)：编写插件部分渲染以及部分功能

## 贡献者

感谢以下贡献者对本项目做出的贡献

<a href="https://github.com/hewang1an/StarRail-plugin/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=hewang1an/StarRail-plugin" />
</a>

![Alt](https://repobeats.axiom.co/api/embed/1c5c4f4bafef4a5d2c743f72703abad36a01762d.svg "Repobeats analytics image")

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=hewang1an/StarRail-plugin&type=Date)](https://star-history.com/#hewang1an/StarRail-plugin&Date)

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->
