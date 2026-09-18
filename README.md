# SKP-PRTS

基于 SKRoot Pro 4.6.2.1 的独立 Kotlin + Jetpack Compose UI 重构基线，供后续 UI 重构使用。

本项目从已验证的 `SKRoot-Pro-Compose-public` 工作树复制而来，但 Native 管理器库已切换为上游管理器源码构建，不依赖 APK 提取。

## 当前状态

- 上游核心：`4.6.2`
- 应用版本：`4.6.2.1`
- 默认 Application ID：`com.linux.prts`
- 默认应用名：`SKP-PRTS`
- ABI：`arm64-v8a`
- Git：已初始化本地 `main` 并建立源码基线提交，未配置 remote
- Release：本项目尚未发布

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

环境：JDK 17、Gradle 8.9、AGP 8.7.3、Kotlin 2.1.0、NDK 26.3.11579264、CMake 3.18.1。

```bash
./gradlew :app:verifyUpstreamNativeBinaries
./gradlew :app:testDebugUnitTest
./gradlew :app:assembleDebug
./gradlew :app:lintDebug
./gradlew :app:assembleRelease
```

Debug APK：`app/build/outputs/apk/debug/app-debug.apk`

不提供签名参数时，Release 是未签名的构建验证包，不能直接安装。需要签名时沿用 `RELEASE_STORE_FILE`、`RELEASE_STORE_PASSWORD`、`RELEASE_KEY_ALIAS`、`RELEASE_KEY_PASSWORD` 四项 Gradle 参数，并使用新项目自行管理的签名身份。

Windows 若遇到 `Unable to establish loopback connection`，可在当前终端设置 `JAVA_TOOL_OPTIONS=-Djdk.net.unixdomain.tmpdir=C:/__skroot_build_tcp_fallback__` 后重试；该路径应不存在，使当前 JDK 使用 TCP 回环。Android SDK 通过 `ANDROID_HOME` 或未提交的 `local.properties` 指定。

发布前必须先验证源码编译出的两个 Native 库在真机上的行为，再决定 UI 修订号、签名和 Release 渠道。不要提交签名密钥、Token、`local.properties`、`.gradle` 或构建输出。

## UI 重构边界

保留原有 JNI、AIDL、JSON、Root、授权、模块及 Magica 协议；后续改动优先集中在 Compose 页面、状态、主题和导航。Native 或 SDK 行为变更需要单独记录并重新验证。

管理器更新检测仍默认关闭；现有检测代码继承自原 Compose 项目，启用后仍查询其 Release。建立 SKP-PRTS 自有发布渠道前请保持关闭。模块市场和模块更新协议保持原样。
