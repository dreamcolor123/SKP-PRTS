# Terminal Core 三维资源与验证

## 设计与实现

`app/src/main/assets/terminal/core.js` 是为 SKP-PRTS 新建的程序化装置，不包含 RhineLabUI 模型、游戏标志、纹理、字体或音效。内容包含金属底座、散热槽、螺栓、线路、双环刻度、信号色芯片和悬浮透射盖板。所有几何及演播室反射环境在本地创建，无需模型或纹理下载。

材质使用 Three.js `MeshPhysicalMaterial` 的 `transmission`、`thickness`、`ior`、`attenuationColor` 和 PMREM 环境反射。盖板粗糙度在入场时逐渐降低。这是真实实时透射材质，不是背景模糊截图；不宣称与参考的场景、资产或像素 1:1 相同。

- 默认均衡：像素比上限 1.25，关闭阴影贴图，保留透射和相同运动节奏。
- 完整：像素比上限 2，PCF 阴影与更清晰盖板。
- 进入 1100ms，状态变化 720ms；结束后不再请求帧。
- `reducedMotion=true` 直接呈现最终姿态，无故障闪烁或持续运动。
- 暗/亮、`unknown/loading/running/outdated/pending/not_installed/fault` 仅改变视觉姿态和色点，不表达虚构业务成功。
- 无环境遮蔽或景深后处理。此项是明确的移动端成本取舍，不将其写成已完成效果。

### Android WebView 124 合成兼容处理

Android 35 模拟器 / WebView `124.0.6367.219` 的测试发现：JavaScript 可报告 ready 和有效三角形，但实际屏幕仍为空白。去掉 Compose 的初始 alpha=0 图层后，该设备仍复现。Debug 首帧同步 `readPixels` 观察到 50892 个非透明像素（约 38.27%）、中心 RGBA `[141,152,147,255]`、`glError=0`、上下文未丢失；对应系统截图的场景区域对比像素比例为 0。因此问题位于 WebGL 输出到 WebView 合成的呈现阶段，不能把 JS ready 视为画面通过。

曾尝试 `preserveDrawingBuffer=true` 保留按需渲染的最后一帧，浏览器检查通过，但 Android 三项实际屏幕像素检查仍为 0；该无效方案已经撤回，避免引入不必要的保留缓冲成本。材质和静止停帧逻辑不变。Debug 首帧诊断只执行一次，Release 不进行 framebuffer 读取。测试同时等待 WebView 可视提交并在系统截图的真实场景 bounds 内断言至少 5% 对比像素，空白会失败并保留证据；最终 Android 兼容结论以之后的实际截图为准，不能沿用早期只检查 JS 状态的通过记录。

进一步连接实际 WebView 的 CDP，观察到 `innerHeight=229`，但 `body` 和 Canvas 的 DOM/computed height 都为 0，确定了实际原因是嵌入容器初始零布局后 CSS 高度未解析到有效视口，而不是材质没有绘制。单独改成 `100vh` 仍在该 WebView 上复现：原生 View 可见、alpha=1、硬件加速开启，DOM 高度却为 0。当前在初始化及窗口 resize 时读取真实 `innerWidth/innerHeight`，为 html/body 设置明确 CSS px 尺寸，并通过 `renderer.setSize(width,height,true)` 同时设置 Canvas 绘图尺寸及 CSS px 尺寸；CSS 固定定位仅承担放置，不再独立决定高度。测试对 DOM 高度非零作硬断言，并记录 DOM rect、computed display/visibility/opacity、原生 WebView 及其祖先的 alpha/visibility/尺寸/硬件加速信息，后续可直接排查类似布局与呈现问题。

## 隔离与生命周期

`TerminalCoreScene.kt` 使用 Android 原生 WebView，不增加 Android 依赖。所有业务操作仍由 Compose 负责。接口只有状态枚举、画质枚举、布尔主题/可见性/减少动态信息；没有 `addJavascriptInterface`，不向网页传 Root Key、命令、包列表或日志。

入口为 `https://appassets.androidplatform.net/assets/terminal/index.html`，自定义 `WebViewClient.shouldInterceptRequest` 仅允许精确列出的 HTML、CSS、核心 JS 和 vendor JS，其余返回 403。网络加载、文件访问、内容访问、混合内容、第三方 Cookie、多窗口均关闭；导航全部拒绝。HTML CSP 限制脚本为本地同源、禁用连接/对象/子框架/表单。Android 容器的枚举经过二次校验和 JSON 序列化。

Activity 不处于 RESUMED、所在页面隐藏时暂停帧循环；WebView 不截获装饰区域触摸。退出释放 WebView，脚本释放材质、纹理、几何和 renderer。初始化读固定状态最多约 6 秒，单次回调上限 1 秒。就绪后仅在显示时每 2 秒检查固定 `ready/fault/loading` 状态，不执行渲染。初始化失败、渲染进程退出、WebGL 上下文丢失会使用原生 Canvas 同构装置回退，真实页面操作不依赖场景就绪。

## 资产与许可

| 资源 | 来源 | 许可/处理 | 未压缩大小 |
| --- | --- | --- | --- |
| `vendor/three.module.min.js` | [three@0.170.0](https://unpkg.com/three@0.170.0/build/three.module.min.js) | 原样固定版本，MIT | 691648 bytes |
| `vendor/THREE-LICENSE.txt` | [three@0.170.0 LICENSE](https://unpkg.com/three@0.170.0/LICENSE) | 原样随包保留版权与许可 | 1081 bytes |
| `core.js` | 本项目新建 | 程序化几何/材质/时序，无外部非代码资产 | 约 14KB |
| `index.html`, `styles.css` | 本项目新建 | 本地入口与透明全幅画布 | 合计 827 bytes |
| 环境纹理 | `studioEnvironment()` 本地 Canvas 生成 | 白/灰反射面，无图片素材 | 不落盘 |

精确 vendor 大小、SHA-256 与来源保存在可解析的 `app/src/main/assets/terminal/vendor/manifest.json`。

## 浏览器验证

运行：

```text
node tools/terminal-scene/verify.cjs
```

需要 Node.js、`playwright`、`pngjs` 和 Chrome。可通过 `NODE_PATH` 指向已安装包；`PLAYWRIGHT_CHANNEL` 可更改浏览器 channel。脚本启动自己的 `127.0.0.1:4318` 只读服务器，完成后关闭，不依赖运行时 CDN。首次自动选择 bundled Chromium 时缺少对应版本，实际验证改用已安装 Chrome channel。

2026-09-18 实测 Chrome `153.0.8010.52` / Playwright / Windows 软件 WebGL：

- 1280x720 完整画质浅色、390x844 均衡浅色、412x240 均衡浅色、412x240 完整深色全部非空且装置完整落在画布中。
- PNG 像素检查：有色像素、非透明区域及四边界通过；截图已实际打开检查，机械结构、盖板、环形刻度与核心均可见。
- 状态变化前后及动画中的 PNG 不同，说明动画确实渲染而不是只变诊断状态。
- 有限动画结束后 `animating=false`；等待后帧计数不变。`active=false` 帧计数不变；减少动态不安排动画帧。
- 页面仅请求 4 个本地静态资源，无远程资源。浏览器离线后状态变化正常且没有新增请求。
- 主动触发 `WEBGL_lose_context` 后固定状态变为 `fault`，供原生容器进入回退。
- 页面 JavaScript 错误为 0。

原始证据：`tools/terminal-scene/artifacts/verification.json`，8 张截图在同目录，包含每个尺寸的正常/故障状态。

这不是 Android 真机性能结论。软件渲染下测试只验证视觉、状态及停帧机制，不据此声称 60/120fps、温升、内存稳定或 Android WebView 的材质兼容性。Android 模拟器和真机结果应由项目的统一验收记录补充。

## 本地预览

```text
node tools/terminal-scene/serve.cjs
```

打开 `http://127.0.0.1:4317/?status=running&quality=full&dark=false`。支持上述三个参数以及 `active`、`reducedMotion`。端口被占用时通过 `PORT` 环境变量指定其他端口。页面只有实际场景，没有将演示控制界面混入 APK。

## Android 待验证矩阵

- API 26-32 和 API 33+ 至少各一设备，记录 WebView 与 GPU；旧 WebView 不支持模块/WebGL2时验证原生回退。
- 模拟器与真机断网首次打开首页，检查本地 HTTPS 拦截确实返回资产。
- 30 次导航/后台恢复/旋转，确认不累积 renderer 或重复业务调用。
- 完整/均衡/减少动态切换、系统关闭动画、WebView 进程退出、上下文丢失。
- 大字体下原生文本与场景区域互不遮挡，场景触摸不阻止首页滚动。
- 记录连续 10 分钟帧时间、温升、内存。未获得上述数据前不宣称真机性能验收完成。
