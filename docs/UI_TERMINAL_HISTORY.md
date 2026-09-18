# SKP-PRTS UI 候选实现与测试说明

> 日期：2026-09-18。状态：可测试候选实现；Debug/Release 构建、来源校验、Android 仪器测试、截图与回滚证据已登记。真机 Root、性能和发布仍未验收。
> 本文是实现覆盖与实机测试指南，不是“全计划已通过”或正式发布声明。权威执行记录：`D:/SKP-PRTS-UI-transaction/VERIFICATION.txt`。

## 1. 对象与交付边界

- 原项目：`D:/Users/Administrator/Documents/ChatGPT/SKP-PRTS`，保留原始基线，不直接在该目录落地 UI 改动。
- 当前候选：`D:/SKP-PRTS-UI-transaction/MODIFIED_FILE`。
- 默认应用：`com.linux.prts` / `SKP-PRTS`；版本源继续为 `SKROOT_CORE_VERSION=4.6.2`、`SKROOT_UI_REVISION=1`。
- 本次目标是可安装测试 APK，不包含远程仓库接入、发布签名、版本升级、正式发布或启用原项目更新渠道。
- JNI、AIDL、JSON、Root 调用顺序、Native 源码与 SDK 来源不属于 UI 改造范围；原有构建来源检查继续保留。最终无关文件对比和来源检查以验证记录为准。

最终测试包：[SKP-PRTS-4.6.2.1-terminal-debug-arm64.apk](D:/SKP-PRTS-UI-transaction/deliverables/SKP-PRTS-4.6.2.1-terminal-debug-arm64.apk)，SHA-256 `280d8c1cc379645167ac97222c1557e3e0d384c7f68dbef6b466501b714c8a9a`，23,497,111 bytes。它使用 Android debug certificate，适合本地测试，不是正式发行包。

## 2. 实现覆盖

| 范围 | 当前候选实现 | 验收边界 |
| --- | --- | --- |
| 主题与排版 | 冷白/石墨亮暗主题、信号黄、语义绿/红、小圆角/细分隔、系统字体与等宽数字/标签 | 采用移动端工具排版，不是桌面构图等比缩放；完整对比度/TalkBack 实测未完成 |
| 导航与外壳 | 四个稳定目的地；紧凑屏底栏、宽屏侧栏；可中断切页；页面可见性参与动画门控 | 快速交互、开场遮挡和所有系统入口由 Android QA 最终汇总 |
| 概览 | SKP-PRTS 品牌、真实环境状态、滚动状态、系统信息、常用操作、独立三维区域 | 无伪造认证结果；Root 安装/卸载/重启的真实行为需授权测试设备验证 |
| 授权 | 终端式应用列表、搜索/筛选/选择及原有确认入口 | UI/callback 测试不等于已在真实 Root 环境添加或撤销授权 |
| 模块与市场 | 档案式条目、搜索、详情、加载/空/错状态及原有下载/WebUI/快捷方式入口 | 模块执行、市场网络、下载取消、快捷方式系统回流仍需真机流程覆盖 |
| 设置与外观 | 自动/浅色/深色、均衡/完整、三维开关、减少动态、主动重播开场；背景与透明度偏好保留 | 新设置使用 `appearance_terminal_v2_*` 键；旧调色板/玻璃导航值保留，但不主导新终端视觉 |
| 日志 | 稳定原文、复制/清空/导出入口及 `SelectionContainer` 文本选择 | 权限拒绝/授权回流/写入失败和大日志性能仍需系统场景验证 |
| Root 配置与本地定制 | 接入统一主题与组件，保留输入、导入/导出、取消/忙碌及生成/安装回调 | 不修改 Root 协议；输入法组合文本、签名冲突和系统安装流程需实际设备验证 |
| 动效 | `GlitchText`、`RollingText`、逐行遮罩揭示、路径进度、可跳过的开场重播；API 33+ 可用局部 AGSL，旧系统保留基础路径 | 不保证所有 GPU 的 Shader 表现一致；关闭动态时直接呈现真实最终状态 |
| 三维 | 自有机械核心、双环刻度、金属框架、透射盖板、状态姿态、按需帧循环、独立原生回退 | 无 Root/命令 JS 桥；浏览器检查通过，不据此宣布真机 WebView 性能验收通过 |
| 测试源码 | 校准既有 Compose 回归，新增外观/动效单元测试、页面视觉 fixture 和 Android WebView fixture | 最终执行数量、失败/通过及设备信息待 `VERIFICATION.txt` 汇总；测试源码存在不等于执行通过 |

这里的“实现”指候选中有对应代码与连接；只有对应测试记录才能称为“已验收”。尚未操作到的异常分支和系统回流不按推测打勾。

## 3. 参考还原与移动端改编

| 项目 | 实现取舍 |
| --- | --- |
| 身份与资产 | 保留实验终端的网格、刻度、有限故障和层次语言，但品牌为 SKP-PRTS；不打包游戏标志、参考模型、图片或音源 |
| 文字滚动 | 固定裁切视窗、460ms 时长；完整文本参与测量，不通过逐 UTF-16 字符随机替换破坏中文或组合字符 |
| 故障标题 | 确定性 200ms 局部位移/遮罩；不持续全屏闪烁，不作用于密钥、命令和日志正文 |
| 正文揭示 | 360ms 移动端短揭示，按实际换行布局处理；不是参考全部约 0.95 秒仪式过程的照搬 |
| 开场 | 自有 1680ms 主动重播流程，可跳过；日常操作不依赖强制长开场 |
| 三维 | 1100ms 有限入场、720ms 状态过渡，结束停帧；完整与均衡保留相同状态语言 |
| 画质 | 完整像素比上限 2/PCF 阴影/更清晰透射，均衡上限 1.25/关闭阴影贴图；无景深与 AO 后处理 |
| 手机结构 | 真实操作保留在 Compose；首页三维占独立区域，手机不是被缩小的桌面档案展示；列表保持可扫读密度 |

上述是当前实现参数，不是已通过全部设备性能目标的证明。没有完成与参考的逐帧轨迹、字体、遮罩、材质和空间构图逐项视觉验收，不能声称 1:1。

## 4. 素材许可与离线边界

- Three.js 固定 `0.170.0`，原始 MIT 许可随 APK 保留。`vendor/manifest.json` 记录来源、未修改声明、大小与 SHA-256；浏览器验证脚本会实际校验这些值。
- 装置的几何、线路、刻度和反射环境由本项目代码生成，无外部模型、图片、音效或自定义字体依赖。
- 三维资产未压缩约 707KB；精确 APK 增量和内存峰值尚待统一测量，不能由 JS 大小推算实际 APK 或运行内存。
- HTML/JS/CSS 全部随包，Android 仅拦截固定 `appassets.androidplatform.net` 路径；外链/文件/内容/网络请求被拒绝，不提供 `addJavascriptInterface`。
- 场景只接收固定展示状态和布尔/画质设置。初始化失败、渲染进程退出和上下文丢失使用原生装置回退，不阻断真实操作。
- 本地背景图片仍属于用户选择的现有功能，不向新三维容器传递该 URI 或其数据。

详细来源与三维测试记录见 `docs/SCENE_ASSETS.md`。

## 5. 已观察的独立浏览器结果

环境：Windows / Chrome `153.0.8010.52` / Playwright / 软件 WebGL；原始证据为 `tools/terminal-scene/artifacts/verification.json`。

1. 1280x720 完整浅色、390x844 均衡浅色、412x240 均衡浅色与 412x240 完整深色均有实际截图；截图已打开检查，装置四边完整、核心和盖板可见。
2. PNG 像素检查通过非空、有色像素和取景边界；动画中/结束像素不同。
3. 动画结束 `animating=false`，继续等待后帧数不增加；`active=false` 不渲染；减少动态没有排队过渡。
4. 每页仅请求本地四个静态资源；浏览器切离线后视觉状态仍正常更新，无新增网络请求。
5. 主动触发 WebGL 上下文丢失后固定状态为 `fault`，供 Android 回退；页面 JavaScript 错误为 0。

共四个画面组合加一个上下文故障用例。该结果不包含 Android Root 操作，不代表 60/90/120Hz 达标，不测输入时延、GPU 温升或真机内存。

Android WebView 124 的第一轮截图曾显示 JS framebuffer 有内容但屏幕区域全空；CDP 和原生层级诊断进一步发现 DOM/body/canvas height 为 0，尽管原生 WebView 可见且硬件加速开启。随后已将场景改为按真实 `innerWidth/innerHeight` 写入 html/body/canvas 的明确 CSS px，并在 Android fixture 对 DOM 高度和系统截图场景 bounds 像素做硬断言。此修正需要重新构建 APK 并复测；之前仅检查 `ready`、`triangles` 或 `frames` 的 Android 记录不能作为画面通过证据。

## 6. 最终 Android 结果登记

以下结果来自统一执行记录 `VERIFICATION.txt`；失败的早期运行保留在 `device-qa/`，没有被覆盖：

| 项目 | 当前登记 |
| --- | --- |
| Native 来源验证、单元测试、Debug、Lint、Release 构建 | 已通过：Modified 0、Release 0；50 个单元测试无失败；Lint 0 errors/153 warnings |
| Android 仪器测试与视觉 fixture | API 35 模拟器 / WebView 124，最终 30 tests 通过；13 页面截图与场景截图已拉取 |
| 非 Root 导航与后台恢复 | 32 次四页循环、返回后台再启动通过；未执行安装、授权变更、命令或重启 |
| Android WebView 初始化、亮暗、隐藏停帧、减少动态 | 4 个场景检查（含 DOM 尺寸与合成像素）通过；场景截图可见 |
| APK 绝对路径、构建类型、签名类型、大小、SHA-256 | 已登记于 `deliverables/APK.json` 与 `ApkInspection.result.json` |
| 原源码摘要、候选差异、回滚后摘要 | 207 个非 UI 边界文件保持摘要，回滚副本 272/272 与原工程一致 |
| 中端真机/高刷真机性能 | 未验收 |
| Root 真实安装、授权、模块和重启行为 | 未在本文验证，不以模拟器/fixture 代替 |
| 正式发布 | 未启动、未授权 |

首轮 Android 验证发现暂停状态 fixture 未推进 Compose 测试帧、开场层触摸穿透，以及 WebView CSS 视口高度折叠；均已修复并在后续构建中覆盖。失败运行和 WebView 空白诊断仍保留，最终 API 35 模拟器运行 30 tests 通过。模拟器不替代真实设备的 GPU、温升、刷新率或 Root 行为验收。

## 7. 可执行真机测试步骤

### 7.1 准备与安装

使用专用、已备份且允许测试的 Android 设备；先做不改变 Root 状态的 UI 检查。连接后在 PowerShell 设置真实值，禁止将 `SERIAL` 或 `APK_PATH` 原样执行：

```powershell
$Serial = 'SERIAL'
$Apk = 'APK_PATH'
$Package = 'com.linux.prts'
$Activity = 'com.linux.permissionmanager.MainActivity'
$Evidence = Join-Path $PWD 'device-evidence'
New-Item -ItemType Directory -Force -Path $Evidence | Out-Null
adb devices -l
Get-FileHash -Algorithm SHA256 -LiteralPath $Apk
adb -s $Serial shell getprop ro.product.model
adb -s $Serial shell getprop ro.soc.model
adb -s $Serial shell getprop ro.build.version.release
adb -s $Serial shell getprop ro.build.version.sdk
adb -s $Serial shell getprop ro.product.cpu.abilist
adb -s $Serial shell dumpsys webviewupdate
adb -s $Serial shell wm size
adb -s $Serial shell wm density
adb -s $Serial shell settings get system peak_refresh_rate
adb -s $Serial install -r $Apk
adb -s $Serial shell am start -W -n "$Package/$Activity"
```

核对 SHA-256 与最终交付记录一致。若同包名已有不同签名应用而安装失败，停止，不自动卸载日用应用或清除其数据；改用干净测试设备或另行约定测试包身份。`arm64-v8a` ABI 是现有项目边界，普通不支持 ARM 翻译的 x86 模拟器不属于可直接安装对象。

### 7.2 无 Root 状态改变的验收

1. 首次打开后，记录真实未安装/运行/错误状态，不把动画完成当作认证成功。先验证刷新、打开并取消 Root 配置、返回、导航与搜索，不执行安装或重启。
2. 设置分别选自动/浅色/深色，三维完整/均衡/关闭、减少动态开/关；重启应用检查持久化。旧背景 URI 失效时不得崩溃，恢复外观不应清除 Root Key 或授权。
3. 在系统中关闭动画，检查标题/文字/三维不继续运动；重新打开系统动画后只按当前状态表现，不补播后台积累动画。所有系统设置测试结束恢复原值。
4. 从设置重播开场，测试跳过/返回；遮挡期间不得点击到背后的安装/授权等业务控件。快速切换四页、进出详情、前后台、旋转各至少 30 次，检查重复动作与泄漏。
5. 断开网络后首次进入首页，确认本地三维或原生回退仍可见且原生按钮可操作；网络依赖的市场应显示真实错误/重试，不伪造成功。
6. 系统字体分别设 1.0/1.3/2.0，检查长中文名、长包名、键盘、横屏、360dp/412dp 和至少 600dp 宽屏。检查文字、底栏/侧栏和输入控件无相互遮挡。
7. 打开 TalkBack：检查读序、按钮名称、焦点与至少 48dp 点击区；三维装饰不重复读出。检查日志可选取、复制结果与原文相同。
8. 日志导出分别测试权限拒绝、授权返回、成功和不可写位置，确认明确结果且无重复操作；不要把含 Root Key/设备标识/私有模块内容的日志上传到公开报告。

保存截图不要通过旧 PowerShell 的二进制重定向污染 PNG：

```powershell
adb -s $Serial shell screencap -p /data/local/tmp/skp-prts-ui.png
adb -s $Serial pull /data/local/tmp/skp-prts-ui.png (Join-Path $Evidence 'screen.png')
adb -s $Serial shell dumpsys meminfo $Package | Out-File -Encoding utf8 (Join-Path $Evidence 'meminfo.txt')
adb -s $Serial shell dumpsys thermalservice | Out-File -Encoding utf8 (Join-Path $Evidence 'thermal.txt')
```

### 7.3 自动化与性能

安装匹配的 Debug AndroidTest APK 后，可以直接运行独立 fixture；这些类不执行真实 Root 操作：

```powershell
adb -s $Serial shell am instrument -w -e class com.linux.permissionmanager.ui.TerminalSceneTest com.linux.prts.test/androidx.test.runner.AndroidJUnitRunner
adb -s $Serial shell am instrument -w -e class com.linux.permissionmanager.ui.TerminalVisualTest com.linux.prts.test/androidx.test.runner.AndroidJUnitRunner
adb -s $Serial pull /sdcard/Android/data/com.linux.prts/files/visual (Join-Path $Evidence 'visual')
```

若发布时覆盖 Application ID，需要同时替换应用与测试 runner 包名。只安装用户测试 APK 而没有 AndroidTest APK 时，不能将 runner 不存在解释为应用失败。

性能测量使用相同构建类型、设备、WebView、分辨率和刷新率；Debug 仅开发观察，正式性能判定优先 release-like/profileable 包。旧版基线与候选都预热后各跑至少 5 次，分别记录 60Hz 和设备支持的 90/120Hz，不取最好一次代替分布。

```powershell
adb -s $Serial shell dumpsys gfxinfo $Package reset
# 在设备执行固定的导航、滚动、详情与状态切换路径，再采集。
adb -s $Serial shell dumpsys gfxinfo $Package framestats | Out-File -Encoding utf8 (Join-Path $Evidence 'framestats.txt')
adb -s $Serial shell dumpsys meminfo $Package | Out-File -Encoding utf8 (Join-Path $Evidence 'meminfo-after.txt')
adb -s $Serial shell dumpsys thermalservice | Out-File -Encoding utf8 (Join-Path $Evidence 'thermal-after.txt')
```

持续固定交互 10 分钟，比较首尾温升、PSS、可获得的 GPU 内存及掉帧。结合 Perfetto/System Trace 分析 Compose 和 WebView，不能仅用 `gfxinfo` 一份输出断言所有 WebGL 帧都达标。目标保留为：输入可见反馈 p95 ≤100ms；60Hz 帧耗时 p95 ≤16.7ms，超截止时间比例 <5%。静止和后台应无持续渲染；不支持的硬件指标记录“不可获得”及原因。

### 7.4 Root 业务实机回归

该部分只在设备持有者明确允许且有可执行恢复方案时进行，不因希望展示动效而操作日用设备。先检查原生来源与 ABI，分别在旧版基线/候选记录同一输入和状态转换，再验证 Root 配置导入/导出、授权添加/撤销/清空、模块安装/更新/取消/卸载、模块 WebUI 与快捷入口、软重启提示及真实重启。每个操作确认只发送一次回调，忙碌和取消语义不变。

不要在文档或截图中填写真实密钥；使用测试设备的受控输入，敏感原始记录只保留本地。源码回滚不能恢复已经改变的 Root、授权或模块状态，设备恢复必须单独执行。

## 8. 尚未关闭的验收条件

- 用户对最终视觉及动效差异的确认，以及参考逐帧对比；不是 1:1 复刻验收。
- API 26-32 与 API 33+、至少一台中端和一台高刷真机的 WebView/材质/回退兼容。
- 全部异常路径、权限回流、外部快捷入口、输入法、TalkBack、大字体与长文本覆盖。
- 同条件旧版/候选的输入时延、帧时间分布、30 次循环资源回收、10 分钟温升/内存数据。
- 真实 Root 环境中授权、模块和重启行为回归。
- 正式版本号、发布签名、自有更新渠道与明确发布授权。

这些条件不得因为 APK 已成功构建而自动标成通过；下一轮设备证据应追加到现有验证记录，不替换已有基线、候选和回滚角色。
