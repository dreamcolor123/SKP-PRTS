# SKP × RhineLabUI 完整离线移植

本文件替代第一轮 Compose 终端风改编方案。目标为移植 RhineLabUI 原始前端、完整运动图形和交互，并连接 SKP 的真实业务。参考固定提交：`17a16118f31b55b7156b68e89b6fe989408351f0`。

## 已确认的产品行为

- 离线 WebView 为默认主界面；五列依次为授权、已安装模块、系统概览、模块市场、设置与诊断，默认选择中央系统概览。
- 首次无密钥时展示原生 Root 配置入口；已有密钥跳过该入口。保存、取消、Boot/热启动、导入导出继续使用现有业务逻辑。
- 每次冷启动播放完整约 34 秒开场，可跳过。旋转、后台恢复、原生面板关闭和 WebView 重建不重新开始已完成开场。
- 声音与音乐默认开启，分别可关闭和调整音量。系统动画设置和减少动态继续有效。
- 原创 SKRoot Pro 连续 SK 电路标识及字标替换开屏、模型贴标、页面品牌和 Android 启动图标。
- 搜索、收藏及档案详情作用于真实 SKP 项目。模型拆解、波浪、升降、频谱、Relay、噪点和色散保留在动态展示中。

## 实现组成

`ui/rhine` 保留参考的 TypeScript、CSS、SVG、GLB、音频、字体及锁文件。Android 构建运行 `installRhineDependencies → buildRhineFrontend → packageRhineFrontend`，将生成资源装入 APK 的 `assets/rhine`。运行时通过本地 HTTPS 来源加载，逐项核对资源清单与 SHA-256。

`RhineStateMapper` 把现有 StateFlow 投影为五列档案；`RhineWebHost` 通过 WebMessagePort 交换版本化快照、展示状态和动作；`RhineManagement` 查找原生当前业务对象、打开原生确认/输入并调用现有 ViewModel。Root 密钥、Shell 输入、热启动脚本、原始日志和本地路径不进入网页。

`RhineSessionViewModel` 保存本进程的开场位置与系统选择器待办状态。返回按模型查看器、弹窗、动态展示、详情、主界面顺序处理。每个页面会话使用请求 ID 去重；确认在调用业务前消费。

原生密钥、应用选择、命令、日志、本地定制、快捷方式和确认面板使用相同的暖纸/暗色主题、直角控件、手绘线条图标及同源 MiSans 子集。原 Compose 管理页保留为明确的基础管理入口。

## 动画覆盖

| 范围 | 保留实现 |
| --- | --- |
| 开场 2D MG | BootSequence、bootMotion、Logo/轨道/扫描/品牌轨道、BootLettering |
| 开场 3D | 阵列波浪、沉降、抽取、长焦镜头、原始材质/灯光/后处理 |
| 详情 | 玻璃扫描与清晰化、模型投影 HUD、DOM Range 正文黑块揭示 |
| 日常操作 | 自由平面拖动与惯性、循环阵列、滚动编号/文字/时钟、详情/弹窗/页签转场 |
| 展示 | 模型旋转/缩放/拆解/组装、主题波、音频频谱、波浪/升降、Relay、屏幕效果 |

品牌替换保留原轨道的几何与时间参数；业务内容、品牌文字和 Android 原生输入属于明确改动区域。不同 WebView、GPU、字体回退和屏幕密度上的逐像素一致性不能由构建成功推定。

## 验证与交付

构建：Native 来源校验、JVM 测试、Debug、AndroidTest、Lint、Release。前端：离线资产摘要、稳定 ID/空列表、桥接及真实浏览器关键帧。设备：真实 WebView 合成截图、完整时间点、首次配置门控、暂停/恢复、减少动态、状态更新及动作去重。

所有最终通过/失败、命令、输出、APK 哈希和回滚记录以事务根目录 `VERIFICATION.txt` 为准。历史失败记录保留。真机 Root 操作、高刷性能、GPU 兼容和温升未获得设备实测时保持未验收。

原始工程不变；候选工程为 `D:/SKP-PRTS-UI-transaction/MODIFIED_FILE`。交付目标为 `SKP-PRTS-4.6.2.1-rhinelab-debug-arm64.apk`，测试签名，不作为正式发布签名。
