# 新旧界面

本次 UI 修订为 4.6.2.2，核心仍为 4.6.2，包名仍为 com.linux.prts。

## 模式与切换

首次安装或升级后尚未选择模式时，先选择新版 RhineLabUI 或旧版 SKRoot Pro Compose，然后进入原有 Root 配置流程。选择通过原生偏好保存，两套 UI 的设置顶部均可切换；当前操作、下载、文件选择或安装尚未结束时暂不可切换。

切换只重建界面，不重建六个业务 ViewModel，不清理 Root Key、模块、授权或日志。新版切回时恢复最后工作区；旧版进入主页。运行时切换不播放完整开场，冷启动新版仍按原规则播放。

新版渲染或资源初始化失败时释放 WebView、消息端口、音频及传感器，自动进入旧版并保存选择。若磁盘写入失败，仍在本次会话进入旧版并提示偏好未保存，避免停在空白页。没有传感器、音频解锁被系统拒绝不属于致命渲染故障。

## 旧版来源

旧 UI 来自 dreamcolor123/SKRoot-Pro-Compose 的 v4.6.2.1，固定提交 `d2a8ccf8067e031dddbbffc972eb1cb81ed77df5`。原始快照位于 tools/legacy-reference，适配代码位于 ui.legacy 包。

原页面、组件、字体排版、形状、浅色配色、玻璃导航、Root 配置、日志、应用选择器及定制弹窗均采用原实现。允许变化仅包括隔离包名、共享现有业务状态、提取导航宿主、设置顶部新增模式选择，以及 SKP 的应用名称、图标和实际版本信息。未将当前基础管理的终端样式冒充原版。

原版使用自身浅色主题，不受新版暗色偏好影响。旧版恢复默认外观只修改旧配色、背景和透明度，不重置新版画质、音频、减少动态或模式选择。

## 接口与边界

- 原生模式：ManagerUiMode.RHINE / LEGACY；持久化键 manager_ui_mode、manager_ui_selected。
- 前端动作：ui.mode.set，payload 为 mode: rhine 或 legacy；经过现有请求去重及原生忙碌检查。
- 展示快照追加 uiMode、uiModeSwitchAllowed、uiModeSwitchReason、appVersion，不包含密钥或执行能力。
- 删除 basicManagement 状态和 fallback.open 主动入口；渲染失败只走统一模式回退。
- Activity 统一持有业务状态、一次性事件、文件选择、安装回执和权限回流；Native/JNI/AIDL 与 Root 执行协议不变。

## 验证入口

`./gradlew :app:verifyLegacyUiSource` 校验原始/适配文件摘要与模式隔离；该检查也是 preBuild 前置条件。

`scripts/check_dual_ui_boundary.ps1` 对照已发布提交，验证业务/Native/SDK 原字节以及允许的模式偏好接线。`DualUiModeTest` 运行首次选择、重建、双向切换、共享状态、WebGL 丢失回退和旧版原生页面测试。前端 `npm run check:ui-mode` 验证模式入口、只读快照、动作去重及早期错误交付。

APK 沿用已有测试证书，不代表正式生产签名。真机 Root、高刷、温升及传感器手感仍需真机验收。
