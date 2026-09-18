# SKP × RhineLabUI 测试交付状态

> 最新遮挡同步、传感器轴向及逐张导航见 [交互修复](UI_DEPTH_NAVIGATION.md)。旧文档保留为历史。

> 最新性能、图标、列序、视差和弹窗音乐修复见 [UI 修复](UI_POLISH.md)。本页旧计数与 APK 为历史记录。

> 最新一轮高度、悬浮导航、方向传感器和状态规则见 [UI 细化](UI_REFINEMENT.md)。前文阶段产物和数字保留为历史；最新 APK 和结果以事务 VERIFICATION.txt 为准。

> 最新交互优化见 [档案正面交互优化](INTERACTION_UPGRADE.md)。控件始终通过真实透视投影绑定模型正面，新增五分区直达与功能搜索；下文 APK 和计数保留前一轮交付历史，新包及最新验证见事务 VERIFICATION.txt。

日期：2026-09-18。默认主界面已改为完整离线 RhineLabUI 移植；第一轮 Compose 终端风方案与旧结果归档于 UI_TERMINAL_HISTORY.md。

## 当前实现

- MainActivity 主路由接入 RhineManagement、RhineWebHost、RhineStateMapper.snapshot，五列展示真实 SKP 数据。
- 原始约 34 秒 MG/3D 开场、自由拖动与惯性、玻璃解密、文字揭示、滚动字形、模型拆解、主题波及动态展示已接入。
- 首次原生密钥入口、后续自动开场、后台暂停与恢复、减少动态、音效/配乐及独立音量已接入。
- 原创 SKRoot Pro 连续 SK 电路标志、字标、Android 动态启动图标、原生线条图标、直角控件与同源 MiSans 字形已接入。
- 业务仍由现有 ViewModel 执行。RhineRequestLedger 处理会话请求去重，RhineConfirmation.consume 防止原生确认重复回调。
- 原生基础管理保留；WebView 失败可重建、重试或进入基础管理。Root 密钥、命令及原始日志留在原生层。

## 最终验证

| 验证 | 结果 |
| --- | --- |
| Native 来源、Debug 与 AndroidTest APK | 通过，Modified exit 0 |
| JVM 单元测试 | 58 项，0 失败 |
| Android 仪器测试 | API 35 / WebView 124 / 宿主 GPU，34 项通过 |
| Lint、Release | 通过；0 errors / 153 warnings，Release exit 0 |
| 前端测试 | 6 项通过，包含离线摘要、空列表、稳定 ID 与不同列长度 |
| 浏览器 QA | 8 个 MG 时间点、桥接、模型/展示、暂停及横竖屏通过 |
| 参考对照 | 16 组配对截图；2627 个运动参数采样零差异；29 个核心源文件/资产一致 |
| 品牌时间轴 | 851 帧原始运动参数一致，9 个关键帧，无字形回退 |
| 实际 MainActivity | 完整开场录屏、Root 配置打开/取消、10 次切列、主题、拆解重组、后台恢复通过 |
| 源码边界 | 原工程 272 文件摘要不变；206 个业务/Native 文件不变；Gradle 除 UI 打包段外不变 |
| 回滚 | 脚本 exit 0，恢复 272 文件；同一命令复现基线两项缺失测试回调，exit 1 |

历史失败保留：软件 GPU 模拟器退出导致 adb 255；宿主 GPU 重启后测试包缺失；最初状态变更 fixture 未推进 Compose 测试帧。修正后完整套件通过。

## 测试包

文件：D:/SKP-PRTS-UI-transaction/deliverables/SKP-PRTS-4.6.2.1-rhinelab-debug-arm64.apk

SHA-256：ec9f0d249639d11495a365781168ca8d1981f626770bf7184985fbfa0d7c534c

57,499,020 bytes；com.linux.prts；版本 4.6.2.1；arm64-v8a；最低 Android 8 / API 26；Android debug certificate。签名及 APK 身份已检查。

安装命令：adb install -r SKP-PRTS-4.6.2.1-rhinelab-debug-arm64.apk

同包名但签名不同时不要自动卸载或清除原应用数据，应使用独立测试设备。设置中可分别关闭音效和音乐、减少动态、调整画质及重播开场。默认参考“原始”画质。

录屏：D:/SKP-PRTS-UI-transaction/deliverables/SKP-PRTS-rhinelab-opening.mp4

43.23 秒、720×1600、60fps，来自 Android 实际屏幕，无音轨；音频引擎另有运行证据。录屏帧率不代表真机性能测试结果。

## 证据与限制

完整命令、stdout、stderr、退出码、摘要、截图、对照和事务重建以 D:/SKP-PRTS-UI-transaction/VERIFICATION.txt 为准。

真机 Root 安装/授权/模块/重启、API 26–32 设备、高刷、GPU 兼容、温升及完整 TalkBack/权限/输入法矩阵尚未实机验收。模拟器与截图不替代这些结果。品牌及业务内容有意替换，跨设备逐像素一致性不作已验证结论。未配置正式签名、发布渠道或远程仓库。
