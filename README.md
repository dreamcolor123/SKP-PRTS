# SKP-PRTS

基于 SKRoot Pro 4.6.2.1 的独立 UI 重构项目，将 RhineLabUI 的离线三维档案界面接入原生管理器。业务逻辑保留 Kotlin / Jetpack Compose，界面由本地 WebView、Three.js 与原生操作面板共同呈现。

本项目从已验证的 `SKRoot-Pro-Compose-public` 工作树复制而来，但 Native 管理器库已切换为上游管理器源码构建，不依赖 APK 提取。

## 当前状态

- 上游核心：`4.6.2`
- 应用版本：`4.6.2.1`
- 默认 Application ID：`com.linux.prts`
- 默认应用名：`SKP-PRTS`
- ABI：`arm64-v8a`
- 源码仓库：[dreamcolor123/SKP-PRTS](https://github.com/dreamcolor123/SKP-PRTS)
- 当前应用实现提交：`9d7403d`，包含开场结束后首次导航方向修复
- Release：[v4.6.2.1 测试版](https://github.com/dreamcolor123/SKP-PRTS/releases/tag/v4.6.2.1)，提供已签名的 arm64 APK 和 SHA-256；沿用测试证书，尚未配置正式发布签名、自动更新渠道或自动发布

## 界面与交互

- 原创 SKRoot Pro 动态标识、完整开场与连续镜头过渡。
- 档案正面的透视工作区、物理遮挡、玻璃材质与悬浮导航。
- 概览、授权、模块、市场、设置五个入口，搜索直达现有原生操作。
- 默认暗色与 SUPER PERFORMANCE，保留已保存的外观设置。
- 离线字体、模型、配乐和音效；后台暂停、减少动态及原生回退。
- 抽卡磨砂转清晰为 1 秒；首次和后续导航采用一致的栏位坐标。

前端来源固定为 RhineLabUI 提交 `17a16118f31b55b7156b68e89b6fe989408351f0`。源码、模型、字体与声音的授权范围并不相同，详见文末许可说明。

## Native 来源

| 文件 | 来源 |
| --- | --- |
| `libpermissionmanager.so` | `app/src/main/cpp/native-lib.cpp` + 上游 SDK `.a`，由 CMake 编译 |
| `libmagica.so` | `app/src/main/cpp/magica/jni`，由 CMake 编译 |
| `libkernel_module_kit_static.a` | 上游公开 SDK 的预编译库；核心实现源码尚未开放 |
| `libresetprop.so` | 上游 Git 仓库 `PermissionManager/app/src/main/jniLibs` |
| `libcve2026_43499_ghostlock.so` | 上游 Git 仓库 `PermissionManager/app/src/main/jniLibs` |

`libpermissionmanager.so` 和 `libmagica.so` 不放在 `app/src/main/jniLibs`；首次构建时由 Gradle externalNativeBuild/CMake 生成。完整来源与哈希见 [`SOURCE_PROVENANCE.md`](SOURCE_PROVENANCE.md)。

## 构建

环境：JDK 17、Node.js 22.12+ 与 npm、Gradle 8.9、AGP 8.7.3、Kotlin 2.1.0、NDK 26.3.11579264、CMake 3.18.1、Android SDK 35。Gradle 在打包前依据 `ui/rhine/package-lock.json` 构建离线前端，首次构建需要下载依赖。

```bash
./gradlew :app:verifyUpstreamNativeBinaries
./gradlew :app:testDebugUnitTest
./gradlew :app:assembleDebug
./gradlew :app:lintDebug
./gradlew :app:testReleaseUnitTest :app:lintRelease
./gradlew :app:assembleRelease
```

Debug APK：`app/build/outputs/apk/debug/app-debug.apk`

不提供签名参数时，Release 是未签名的构建验证包，不能直接安装。需要签名时沿用 `RELEASE_STORE_FILE`、`RELEASE_STORE_PASSWORD`、`RELEASE_KEY_ALIAS`、`RELEASE_KEY_PASSWORD` 四项 Gradle 参数，并使用新项目自行管理的签名身份。

Windows 若遇到 `Unable to establish loopback connection`，可在当前终端设置 `JAVA_TOOL_OPTIONS=-Djdk.net.unixdomain.tmpdir=C:/__skroot_build_tcp_fallback__` 后重试；该路径应不存在，使当前 JDK 使用 TCP 回环。Android SDK 通过 `ANDROID_HOME` 或未提交的 `local.properties` 指定。

发布前必须先验证源码编译出的两个 Native 库在真机上的行为，再决定 UI 修订号、签名和 Release 渠道。不要提交签名密钥、Token、`local.properties`、`.gradle` 或构建输出。

## UI 重构边界

保留原有 JNI、AIDL、JSON、Root、授权、模块及 Magica 协议；后续改动优先集中在 Compose 页面、状态、主题和导航。Native 或 SDK 行为变更需要单独记录并重新验证。

管理器更新检测仍默认关闭；现有检测代码继承自原 Compose 项目，启用后仍查询其 Release。建立 SKP-PRTS 自有发布渠道前请保持关闭。模块市场和模块更新协议保持原样。

## 验证范围

当前版本已完成 Debug / Release 构建、各 80 项 JVM 测试、Native 来源检查及模拟器安装启动。新增导航回归覆盖手机和宽屏下的完整开场、跳过、重播、首次直接进入模块及减少动态；镜头回归检查连续轨迹与开场交接。

真机 Root 操作、高刷新率、温升与不同设备的传感器手感仍需单独验证。模拟器和桌面结果不等于真机性能保证。未签名 Release 不能直接安装；本地测试签名也不代表正式发布签名。

## 许可

本项目自行编写且有权授权的代码和文档采用 [MIT License](LICENSE)。第三方代码、SDK 二进制、字体、模型、原作视觉及采样声音不因本项目的 MIT 声明而被重新授权。

请同时阅读 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)、[RhineLabUI 资产说明](docs/RHINELAB_ASSETS.md) 和 [Native 来源记录](SOURCE_PROVENANCE.md)，并保留原作者的许可与署名。

## 致谢

- 感谢 [LBEILC / RhineLabUI](https://github.com/LBEILC/RhineLabUI) 提供原始 UI 项目。本项目的三维档案界面、开场 MG、材质、交互与动画移植建立在其代码及资产之上。
- 感谢 [abcz316 / SKRoot-linuxKernelRoot](https://github.com/abcz316/SKRoot-linuxKernelRoot) 提供 SKRoot 项目、管理器源码与公开 SDK。本项目沿用其核心能力、Native 接口和管理器业务流程，主要工作集中于 UI 重构与交互适配。

感谢两位作者及相关贡献者的工作。原项目与第三方素材的版权和授权条款继续有效；本项目是独立 UI 改编，不代表上述项目的官方版本。
