package com.linux.permissionmanager.ui.rhine

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.View
import android.webkit.ConsoleMessage
import android.webkit.CookieManager
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebChromeClient
import android.webkit.WebMessage
import android.webkit.WebMessagePort
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.linux.permissionmanager.BuildConfig
import java.io.ByteArrayInputStream
import java.security.MessageDigest
import java.util.UUID
import kotlinx.coroutines.delay
import org.json.JSONObject

private const val RHINE_ORIGIN = "https://appassets.androidplatform.net"
private const val RHINE_PAGE = "$RHINE_ORIGIN/index.html"

/** The only bridge is a port transferred to our verified, offline main document. */
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun RhineWebHost(
    snapshot: String,
    active: Boolean,
    reducedMotion: Boolean,
    bootAllowed: Boolean,
    initialBootTime: Double,
    initialBootCompleted: Boolean,
    onAction: (action: String, payload: JSONObject) -> Boolean,
    onPresentation: (JSONObject) -> Unit,
    onFailure: (String) -> Unit,
    modifier: Modifier = Modifier,
    initialWorkspace: String? = null,
    sensorEnabled: Boolean = true,
    audioActive: Boolean = active,
) {
    val owner = LocalLifecycleOwner.current
    val textScale = LocalConfiguration.current.fontScale
    val currentAction by rememberUpdatedState(onAction)
    val currentPresentation by rememberUpdatedState(onPresentation)
    val currentFailure by rememberUpdatedState(onFailure)
    val latestSnapshot by rememberUpdatedState(snapshot)
    var resumed by remember(owner) { mutableStateOf(owner.lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)) }
    var generation by remember { mutableIntStateOf(0) }
    var failed by remember { mutableStateOf(false) }
    var webView by remember { mutableStateOf<WebView?>(null) }
    var connection by remember { mutableStateOf<RhineConnection?>(null) }
    var connected by remember { mutableStateOf(false) }
    val effectiveActive = active && resumed
    val effectiveAudioActive = audioActive && resumed
    val control = JSONObject().put("type", "presentation").put("version", 1)
        .put("active", effectiveActive).put("reducedMotion", reducedMotion).put("bootAllowed", bootAllowed)
        .put("audioActive", effectiveAudioActive)
        .put("textScale", textScale)
        .put("initialBootTime", initialBootTime.takeIf { it.isFinite() }?.coerceIn(0.0, 40.0) ?: 0.0)
        .put("initialBootCompleted", initialBootCompleted)
        .put("workspace", initialWorkspace?.let { runCatching { JSONObject(it) }.getOrNull() } ?: JSONObject.NULL).toString()
    val latestControl by rememberUpdatedState(control)

    fun fail(reason: String) {
        if (failed) return
        connection?.close()
        connection = null
        connected = false
        if (generation == 0) {
            generation = 1
        } else {
            failed = true
            currentFailure(reason)
        }
    }

    DisposableEffect(owner) {
        val observer = LifecycleEventObserver { _, _ -> resumed = owner.lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED) }
        owner.lifecycle.addObserver(observer)
        onDispose { owner.lifecycle.removeObserver(observer) }
    }
    DisposableEffect(webView, connection, connected, effectiveActive, reducedMotion, sensorEnabled) {
        val bridge = connection
        val sensor = webView?.let { view ->
            RhineOrientation(view) { tilt ->
                if (connected) bridge?.send(JSONObject().put("type", "motion").put("version", 1)
                    .put("x", tilt.x).put("y", tilt.y).toString())
            }
        }
        if (connected && effectiveActive && !reducedMotion && sensorEnabled) sensor?.start() else sensor?.stop()
        onDispose { sensor?.stop() }
    }
    LaunchedEffect(connection, connected, snapshot) {
        if (connected) connection?.sendSnapshot(snapshot)
    }
    LaunchedEffect(webView, connection, connected, control) {
        val view = webView ?: return@LaunchedEffect
        if (effectiveActive || effectiveAudioActive) view.onResume()
        if (connected) connection?.send(control)
        // Native panels freeze rendering, not music. Only leaving the foreground pauses WebView.
        if (!effectiveActive && !effectiveAudioActive) {
            delay(80)
            view.onPause()
        }
    }
    LaunchedEffect(generation, failed) {
        if (failed) return@LaunchedEffect
        delay(30_000)
        if (!connected) fail("离线界面初始化超时")
    }
    BackHandler(connected && active && !failed) { connection?.send(JSONObject().put("type", "back").toString()) }
    Box(modifier) {
        if (!failed) key(generation) {
            AndroidView<View>(
                modifier = Modifier.fillMaxSize(),
                factory = { viewContext ->
                    try {
                        val assets = RhineAssetStore(viewContext)
                        object : WebView(viewContext) {
                            override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
                                super.onSizeChanged(w, h, oldw, oldh)
                                if (w > 0 && h > 0) post { applyPixelViewport() }
                            }
                        }.apply {
                            setBackgroundColor(Color.rgb(245, 245, 242))
                            isVerticalScrollBarEnabled = false
                            isHorizontalScrollBarEnabled = false
                            overScrollMode = View.OVER_SCROLL_NEVER
                            settings.apply {
                                javaScriptEnabled = true
                                domStorageEnabled = true
                                databaseEnabled = false
                                allowFileAccess = false
                                allowContentAccess = false
                                @Suppress("DEPRECATION")
                                allowFileAccessFromFileURLs = false
                                @Suppress("DEPRECATION")
                                allowUniversalAccessFromFileURLs = false
                                blockNetworkLoads = true
                                mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
                                mediaPlaybackRequiresUserGesture = false
                                javaScriptCanOpenWindowsAutomatically = false
                                setSupportMultipleWindows(false)
                                setSupportZoom(false)
                                cacheMode = WebSettings.LOAD_NO_CACHE
                                useWideViewPort = true
                                loadWithOverviewMode = false
                                textZoom = 100
                            }
                            CookieManager.getInstance().setAcceptThirdPartyCookies(this, false)
                            webChromeClient = object : WebChromeClient() {
                                override fun onConsoleMessage(message: ConsoleMessage): Boolean {
                                    if (BuildConfig.DEBUG && message.messageLevel() == ConsoleMessage.MessageLevel.ERROR)
                                        Log.e("RhineWebHost", "${message.message()} @${message.lineNumber()}")
                                    return true
                                }
                            }
                            webViewClient = object : WebViewClient() {
                                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse = assets.response(request)
                                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean = true
                                override fun onPageFinished(view: WebView, url: String) {
                                    if (url != RHINE_PAGE || view !== webView || failed) return
                                    view.applyPixelViewport()
                                    connection?.close()
                                    connected = false
                                    val bridge = RhineConnection(view, { action, payload -> currentAction(action, payload) },
                                        { currentPresentation(it) }, {
                                            connected = true
                                            connection?.sendSnapshot(latestSnapshot)
                                            connection?.send(latestControl)
                                        })
                                    connection = bridge
                                    bridge.connect()
                                }
                                override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                                    if (request.isForMainFrame && view === webView) fail("离线界面资源无法加载")
                                }
                                override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                                    if (view === webView) fail("界面渲染进程已退出")
                                    return true
                                }
                            }
                            webView = this
                            loadUrl(RHINE_PAGE)
                        }
                    } catch (error: Exception) {
                        fail("离线界面初始化失败：${error.javaClass.simpleName}")
                        View(viewContext)
                    } catch (_: LinkageError) {
                        fail("设备 WebView 不可用")
                        View(viewContext)
                    }
                },
                onRelease = { view ->
                    if (view is WebView) {
                        if (webView === view) { connection?.close(); connection = null; webView = null; connected = false }
                        runCatching { view.stopLoading() }
                        runCatching { view.onPause() }
                        runCatching { view.removeAllViews() }
                        runCatching { view.destroy() }
                    }
                },
            )
        }
    }
}

private fun WebView.applyPixelViewport() {
    // Android WebView can report ready while a vh canvas has zero composited height.
    // Explicit CSS pixels retain the tested surface sizing on API 26+ providers.
    val density = resources.displayMetrics.density.coerceAtLeast(0.1f)
    val cssWidth = (width / density).toInt().coerceAtLeast(1)
    val cssHeight = (height / density).toInt().coerceAtLeast(1)
    evaluateJavascript("(()=>{document.documentElement.style.width='${cssWidth}px';document.documentElement.style.height='${cssHeight}px';if(document.body){document.body.style.width='${cssWidth}px';document.body.style.height='${cssHeight}px';}window.dispatchEvent(new Event('resize'));})()", null)
}

private class RhineConnection(
    private val view: WebView,
    private val onAction: (String, JSONObject) -> Boolean,
    private val onPresentation: (JSONObject) -> Unit,
    private val onReady: () -> Unit,
) {
    private val session = UUID.randomUUID().toString()
    private val ledger = RhineRequestLedger(session)
    private var nativePort: WebMessagePort? = null
    private var revision = 0
    private var ready = false
    fun connect() {
        val ports = view.createWebMessageChannel()
        nativePort = ports[0]
        ports[0].setWebMessageCallback(object : WebMessagePort.WebMessageCallback() {
            override fun onMessage(port: WebMessagePort, message: WebMessage) {
                val text = message.data ?: return
                if (text.length > 32_768) return
                val json = runCatching { JSONObject(text) }.getOrNull() ?: return
                if (json.optInt("version") != 1 || json.optString("sessionId") != session) return
                when (json.optString("type")) {
                    "ready" -> if (!ready) { ready = true; onReady() }
                    "presentation" -> if (ready) onPresentation(json)
                    "error" -> if (ready) onPresentation(json.put("rendererError", json.optString("reason", "三维渲染失败")))
                    else -> if (ready && json.has("requestId")) {
                        val id = json.optString("requestId")
                        val action = json.optString("action")
                        val result = ledger.dispatch(session, id, action) { onAction(action, json.optJSONObject("payload") ?: JSONObject()) }
                        send(JSONObject().put("type", "ack").put("requestId", id)
                            .put("status", if (result.accepted) "accepted" else "rejected")
                            .put("reason", result.reason ?: JSONObject.NULL).toString())
                    }
                }
            }
        }, Handler(Looper.getMainLooper()))
        view.postWebMessage(WebMessage(JSONObject().put("type", "skp:init").put("version", 1)
            .put("sessionId", session).toString(), arrayOf(ports[1])), Uri.parse(RHINE_ORIGIN))
    }
    fun sendSnapshot(snapshot: String) {
        val state = runCatching { JSONObject(snapshot) }.getOrNull() ?: return
        send(JSONObject().put("type", "state").put("version", 1).put("revision", ++revision).put("state", state).toString())
    }
    fun send(text: String) { runCatching { nativePort?.postMessage(WebMessage(text)) } }
    fun close() { ready = false; runCatching { nativePort?.close() }; nativePort = null }
}

/** Manifest membership and digest verification apply to every local resource. */
private class RhineAssetStore(private val context: Context) {
    private data class Entry(val mime: String, val sha256: String)
    private val verified = mutableSetOf<String>()
    private val entries: Map<String, Entry>
    init {
        val manifest = context.assets.open("rhine/asset-manifest.json").bufferedReader().use { JSONObject(it.readText()) }
        require(manifest.getInt("version") == 1)
        val files = manifest.getJSONArray("files")
        entries = buildMap {
            for (i in 0 until files.length()) {
                val file = files.getJSONObject(i)
                val path = file.getString("path")
                require(path.isNotBlank() && !path.startsWith('/') && '\\' !in path && path.split('/').none { it == ".." || it == "." })
                val hash = file.getString("sha256")
                require(hash.matches(Regex("[a-fA-F0-9]{64}")))
                put("/$path", Entry(file.getString("mime"), hash.lowercase()))
            }
        }
        require("/index.html" in entries)
    }
    fun response(request: WebResourceRequest): WebResourceResponse {
        val uri = request.url
        if (request.method != "GET" || uri.scheme != "https" || uri.host != "appassets.androidplatform.net" ||
            uri.port != -1 || uri.userInfo != null || uri.encodedPath?.contains('%') == true) return blocked()
        val path = uri.path ?: return blocked()
        val entry = entries[path] ?: return blocked()
        return runCatching {
            synchronized(verified) {
                if (path !in verified) {
                    val digest = MessageDigest.getInstance("SHA-256")
                    context.assets.open("rhine$path").use { input ->
                        val buffer = ByteArray(64 * 1024)
                        while (true) { val read = input.read(buffer); if (read < 0) break; digest.update(buffer, 0, read) }
                    }
                    check(digest.digest().joinToString("") { "%02x".format(it) } == entry.sha256)
                    verified += path
                }
            }
            WebResourceResponse(entry.mime, "UTF-8", 200, "OK", mapOf(
                "Cache-Control" to "no-store", "X-Content-Type-Options" to "nosniff",
                "Content-Security-Policy" to "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; media-src 'self' blob:; connect-src 'self'; worker-src 'self' blob:; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
            ), context.assets.open("rhine$path"))
        }.getOrElse { blocked() }
    }
    private fun blocked() = WebResourceResponse("text/plain", "UTF-8", 403, "Blocked", mapOf("Cache-Control" to "no-store"), ByteArrayInputStream(ByteArray(0)))
}
