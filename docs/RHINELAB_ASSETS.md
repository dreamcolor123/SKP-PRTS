# RhineLabUI 来源与资产

上游：https://github.com/LBEILC/RhineLabUI

固定提交：`17a16118f31b55b7156b68e89b6fe989408351f0`。用户已明确要求直接复用原项目代码与 UI 资产进行本地完整移植。

- 上游自有代码、建模脚本和技术文档采用 MIT，保留 `ui/rhine/LICENSE`，版权为 Copyright (c) 2026 LBEILC。
- GLB、原作相关视觉及原 PV 三个逐字短音的来源说明按上游原文保留，不将其误记为全部受 MIT 授权。
- MiSans 和 Rolling Number 分别保留其原许可。不存在于参考仓库中的商业 Webfont Kit 未被引入；固定短语继续使用参考图形，SKRoot Pro 字标为手工路径。
- 三轨 Ogg 配乐来自参考的原创程序编配。`audio/README.md` 与逐字声音来源记录随资源保留。
- SKRoot Pro 标识、节点、终端符号和原生线条图标为本次原创路径。`build-skp-brand.mjs` 可重建 SVG、PNG 与原生图标。
- 原生 MiSans 使用同一份锁定的 WOFF2 轮廓制作本应用文字子集，保留原始字形轮廓及版权。`build-native-fonts.py`、`NATIVE-FONTS.json` 记录转换与摘要；动态内容未包含的字符由 Android 字体回退显示。

GLB、字体、音频和脚本打包后的逐文件摘要在 APK 的 `rhine/asset-manifest.json`，包含固定参考提交及每个文件的路径、大小、MIME 类型、SHA-256。
