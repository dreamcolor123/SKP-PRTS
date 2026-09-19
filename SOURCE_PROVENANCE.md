# SKP-PRTS Native 来源记录

检查日期：2026-09-18

## 上游身份

- 仓库：`https://github.com/abcz316/SKRoot-linuxKernelRoot`
- 上游提交：`b770cf3bdfe6e2935283dedfcf5d64d931a7fb4d`
- 上游路径：`Pro(众测开放中)/src/PermissionManager`
- SDK 路径：`Pro(众测开放中)/src/testModule/kernel_module_kit`

## 资产哈希

```text
testModule/kernel_module_kit/lib/libkernel_module_kit_static.a
D066B9A55CE5319552EC2F42BC3AE11D38F3F1F541220EE2E7DE645B63B8A3AA

app/src/main/jniLibs/arm64-v8a/libresetprop.so
70558E6D6199FA5A961B7BAFEB8F96D8157CC63810DB8DF2A3CDED1881763697

app/src/main/jniLibs/arm64-v8a/libcve2026_43499_ghostlock.so
7B2D158FAD8AF96082B3954D1ECB65E91E7A62D8CD475BA067698A0DFCD20778
```

Ghostlock 使用上游仓库中的原始预编译 ARM64 文件，Gradle 打包时会剥离调试符号。本项目构建不读取任何上游 APK。

## 源码构建验证

迁移前使用上游未修改的 `PermissionManager/app/src/main/cpp/CMakeLists.txt`，NDK `26.3.11579264`、CMake `3.18.1`、ARM64/API 26、C++20、Release 配置编译成功。本项目沿用这些构建目标，仅将 SDK 路径调整为项目内的 `testModule/kernel_module_kit`：

- `libpermissionmanager.so`：JNI 导出 30 个，与当前官方库导出集合一致。
- `libmagica.so`：JNI 导出 1 个，与当前官方库导出集合一致。
- Debug APK 已由 Gradle 从 CMake 产出上述两个库。

源码构建产物不会与官方 APK 二进制哈希相同；这不构成运行时等价证明。`libkernel_module_kit_static.a` 仍是预编译闭源依赖，SDK `src` 目录当前只有空的“即将开放”占位文件。

## 明确排除

- 不提取或复制 `libpermissionmanager.so`、`libmagica.so` APK 二进制。
- 不复制签名密钥、密码、GitHub Token 或旧项目 `.git`。
- 本地保留初始源码及后续 UI 提交历史。经项目所有者明确要求，公开源码仓库为 `https://github.com/dreamcolor123/SKP-PRTS`；不随源码提交签名材料或本地 APK，也不启用自动发布。
- 来源记录不是许可证。第三方 Native 与 SDK 不因项目根目录的 MIT 声明而被重新授权，详见 `THIRD_PARTY_NOTICES.md`。
