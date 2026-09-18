# SKP-PRTS 开发规范

这是一个从已验证的 SKRoot Pro Compose `4.6.2.1` 基线拆出的独立 UI 重构项目。

## 构建边界

- 项目不从 APK 提取 `libpermissionmanager.so` 或 `libmagica.so`。
- `permissionmanager.so` 与 `magica.so` 由 `app/src/main/cpp` 的上游管理器源码通过 Gradle externalNativeBuild/CMake 编译。
- `libkernel_module_kit_static.a` 仍是上游公开 SDK 的预编译依赖；其核心实现源码尚未开放。
- `libresetprop.so` 和 `libcve2026_43499_ghostlock.so` 直接来自上游 Git 仓库 `Pro(众测开放中)/src/PermissionManager/app/src/main/jniLibs/arm64-v8a`，不是 APK 提取物。
- 修改 Native 或协议前必须保持 JNI、AIDL、JSON 字段、调用顺序和 Root 行为与上游一致。

## UI 重构边界

- 后续 UI 重构优先修改 Compose 页面、状态和主题，不要把 UI 改动混入 Native 或 SDK 迁移。
- 默认 Application ID 为 `com.linux.prts`，默认应用名为 `SKP-PRTS`；发布时可通过 Gradle 参数覆盖。
- 当前版本源仍为 `gradle.properties` 中的 `SKROOT_CORE_VERSION=4.6.2` 与 `SKROOT_UI_REVISION=1`。
- 本目录无 GitHub remote、签名密钥或 Token；保留手动 GitHub Actions 构建模板，但不自动发布。是否接入远端由后续明确任务决定。
- 管理器更新检测默认关闭，继承的更新代码仍指向原 Compose 项目。SKP-PRTS 正式发布前必须明确自有更新渠道，不得把原项目 APK 当作 SKP-PRTS 更新。

## 验证

```text
./gradlew :app:verifyUpstreamNativeBinaries
./gradlew :app:testDebugUnitTest
./gradlew :app:assembleDebug
./gradlew :app:lintDebug
./gradlew :app:assembleRelease
```

Release 前需额外确认源编译出的两个 Native 库与应用运行行为，再决定版本修订号和发布渠道。不要把临时 APK、签名文件、`local.properties` 或 `.gradle` 提交进仓库。
