package com.linux.permissionmanager.ui.scene

import android.annotation.SuppressLint
import android.graphics.Color as AndroidColor
import android.net.Uri
import android.view.View
import android.view.MotionEvent
import android.util.Log
import android.webkit.ConsoleMessage
import android.webkit.CookieManager
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebChromeClient
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.linux.permissionmanager.BuildConfig
import java.io.ByteArrayInputStream
import kotlinx.coroutines.delay
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import org.json.JSONObject
import kotlin.coroutines.resume
import kotlin.math.cos
import kotlin.math.sin

private const val SCENE_HOST = "appassets.androidplatform.net"
private const val SCENE_PATH = "/assets/terminal/index.html"
private val sceneStatuses = setOf("unknown", "loading", "running", "outdated", "pending", "not_installed", "fault")
private val sceneAssets = mapOf(
    SCENE_PATH to "text/html",
    "/assets/terminal/styles.css" to "text/css",
    "/assets/terminal/core.js" to "text/javascript",
    "/assets/terminal/vendor/three.module.min.js" to "text/javascript"
)

/** A decorative, offline renderer. This WebView has no native JavaScript bridge. */
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun TerminalCoreScene(
    modifier: Modifier = Modifier,
    status: String,
    quality: String,
    dark: Boolean,
    active: Boolean,
    reducedMotion: Boolean
) {
    val lifecycleOwner = LocalLifecycleOwner.current
    var resumed by remember(lifecycleOwner) {
        mutableStateOf(lifecycleOwner.lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED))
    }
    var view by remember { mutableStateOf<WebView?>(null) }
    var pageLoaded by remember { mutableStateOf(false) }
    var ready by remember { mutableStateOf(false) }
    var failed by remember { mutableStateOf(false) }
    val sanitizedStatus = status.takeIf { it in sceneStatuses } ?: "unknown"
    val sanitizedQuality = if (quality == "full") "full" else "balanced"
    val effectiveActive = active && resumed
    val visualState = remember(sanitizedStatus, sanitizedQuality, dark, effectiveActive, reducedMotion) {
        JSONObject().put("status", sanitizedStatus).put("quality", sanitizedQuality)
            .put("dark", dark).put("active", effectiveActive).put("reducedMotion", reducedMotion).toString()
    }

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, _ ->
            resumed = lifecycleOwner.lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    LaunchedEffect(view, pageLoaded, failed) {
        val current = view ?: return@LaunchedEffect
        if (!pageLoaded || failed) return@LaunchedEffect
        // Initialization is bounded. Later context loss uses the same fixed-status read.
        var attempts = 0
        while (!ready && !failed && attempts++ < 48) {
            when (withTimeoutOrNull(1000) { current.rendererState() } ?: "fault") {
                "ready" -> ready = true
                "fault" -> failed = true
            }
            if (!ready && !failed) delay(125)
        }
        if (!ready) failed = true
    }

    LaunchedEffect(view, ready, failed, visualState) {
        val current = view ?: return@LaunchedEffect
        if (!ready || failed) return@LaunchedEffect
        // Deliver the latest inactive state before pausing WebView processing. Awaiting
        // the callback also keeps a cancelled, older update from pausing a resumed view.
        if (runCatching { current.onResume() }.isFailure) {
            failed = true
            return@LaunchedEffect
        }
        val applied = withTimeoutOrNull(1000) { current.applyRendererState(visualState) } ?: false
        if (!applied) failed = true
        if (!effectiveActive && runCatching { current.onPause() }.isFailure) failed = true
    }

    LaunchedEffect(view, ready, failed, effectiveActive) {
        val current = view ?: return@LaunchedEffect
        if (!ready || failed || !effectiveActive) return@LaunchedEffect
        while (true) {
            delay(2000)
            if ((withTimeoutOrNull(1000) { current.rendererState() } ?: "fault") == "fault") {
                failed = true
                break
            }
        }
    }

    Box(modifier = modifier.clearAndSetSemantics { }) {
        if (!failed) {
            AndroidView<View>(
                // Do not render a WebGL WebView through an initially transparent
                // Compose layer: its surface can stay uncomposited after ready.
                modifier = Modifier.matchParentSize(),
                factory = { context ->
                    var initializing: WebView? = null
                    fun unavailable(): View {
                        initializing?.releaseSceneResources()
                        if (view === initializing) view = null
                        failed = true
                        return View(context)
                    }
                    try {
                        object : WebView(context) {
                            override fun dispatchTouchEvent(event: MotionEvent): Boolean = false
                        }.also { initializing = it }.apply {
                            setBackgroundColor(AndroidColor.TRANSPARENT)
                            isFocusable = false
                            isFocusableInTouchMode = false
                            isClickable = false
                            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
                            overScrollMode = View.OVER_SCROLL_NEVER
                            isVerticalScrollBarEnabled = false
                            isHorizontalScrollBarEnabled = false
                            settings.apply {
                                javaScriptEnabled = true
                                javaScriptCanOpenWindowsAutomatically = false
                                allowFileAccess = false
                                allowContentAccess = false
                                @Suppress("DEPRECATION")
                                allowFileAccessFromFileURLs = false
                                @Suppress("DEPRECATION")
                                allowUniversalAccessFromFileURLs = false
                                blockNetworkLoads = true
                                mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
                                domStorageEnabled = false
                                databaseEnabled = false
                                cacheMode = WebSettings.LOAD_NO_CACHE
                                mediaPlaybackRequiresUserGesture = true
                                setSupportMultipleWindows(false)
                                setSupportZoom(false)
                            }
                            CookieManager.getInstance().setAcceptThirdPartyCookies(this, false)
                            if (BuildConfig.DEBUG) {
                                webChromeClient = object : WebChromeClient() {
                                    override fun onConsoleMessage(message: ConsoleMessage): Boolean {
                                        if (message.messageLevel() == ConsoleMessage.MessageLevel.ERROR ||
                                            message.messageLevel() == ConsoleMessage.MessageLevel.WARNING) {
                                            Log.w("TerminalCoreRenderer", "${message.messageLevel()}: ${message.message()} @${message.lineNumber()}")
                                        }
                                        return true
                                    }
                                }
                            }
                            webViewClient = object : WebViewClient() {
                                override fun shouldInterceptRequest(webView: WebView, request: WebResourceRequest): WebResourceResponse {
                                    val uri = request.url
                                    val mime = sceneAssets[uri.path]
                                    if (request.method != "GET" || uri.scheme != "https" || uri.host != SCENE_HOST ||
                                        uri.port != -1 || uri.userInfo != null || mime == null) return blockedResource()
                                    return try {
                                        WebResourceResponse(mime, "UTF-8", 200, "OK", mapOf(
                                            "Cache-Control" to "no-store", "X-Content-Type-Options" to "nosniff",
                                            "Access-Control-Allow-Origin" to "https://$SCENE_HOST"
                                        ), context.assets.open(uri.path!!.removePrefix("/assets/")))
                                    } catch (_: Exception) { blockedResource() }
                                }

                                override fun shouldOverrideUrlLoading(webView: WebView, request: WebResourceRequest): Boolean = true

                                override fun onPageFinished(webView: WebView, url: String) {
                                    if (Uri.parse(url).host == SCENE_HOST && Uri.parse(url).path == SCENE_PATH) pageLoaded = true
                                }

                                override fun onReceivedError(webView: WebView, request: WebResourceRequest, error: WebResourceError) {
                                    if (request.isForMainFrame) failed = true
                                }

                                override fun onRenderProcessGone(webView: WebView, detail: RenderProcessGoneDetail): Boolean {
                                    failed = true
                                    return true
                                }
                            }
                            view = this
                            val url = Uri.Builder().scheme("https").authority(SCENE_HOST).path(SCENE_PATH)
                                .appendQueryParameter("status", sanitizedStatus)
                                .appendQueryParameter("quality", sanitizedQuality)
                                .appendQueryParameter("dark", dark.toString())
                                .appendQueryParameter("active", effectiveActive.toString())
                                .appendQueryParameter("reducedMotion", reducedMotion.toString())
                                .appendQueryParameter("diagnostics", BuildConfig.DEBUG.toString()).build()
                            loadUrl(url.toString())
                        }
                    } catch (_: Exception) {
                        unavailable()
                    } catch (_: LinkageError) {
                        unavailable()
                    }
                },
                onRelease = { released ->
                    if (released is WebView) {
                        released.releaseSceneResources()
                        if (view === released) view = null
                    }
                }
            )
        }
        if (!ready || failed) {
            TerminalCoreFallback(
                Modifier.matchParentSize().background(MaterialTheme.colorScheme.background),
                sanitizedStatus,
                dark,
            )
        }
    }
}

private fun WebView.releaseSceneResources() {
    runCatching { evaluateJavascript("window.TerminalCore && window.TerminalCore.dispose();", null) }
    runCatching { stopLoading() }
    runCatching { onPause() }
    runCatching { removeAllViews() }
    runCatching { destroy() }
}

private fun blockedResource() = WebResourceResponse(
    "text/plain", "UTF-8", 403, "Blocked", mapOf("Cache-Control" to "no-store"), ByteArrayInputStream(ByteArray(0))
)

private suspend fun WebView.rendererState(): String = suspendCancellableCoroutine { continuation ->
    try {
        evaluateJavascript("window.__terminalRenderState === 'ready' ? 'ready' : (window.__terminalRenderState === 'fault' ? 'fault' : 'loading')") { value ->
            if (continuation.isActive) continuation.resume(value.removeSurrounding("\""))
        }
    } catch (_: Exception) {
        if (continuation.isActive) continuation.resume("fault")
    }
}

private suspend fun WebView.applyRendererState(state: String): Boolean = suspendCancellableCoroutine { continuation ->
    try {
        evaluateJavascript("(function(){if(!window.TerminalCore)return false;window.TerminalCore.setState($state);return true;})()") { value ->
            if (continuation.isActive) continuation.resume(value == "true")
        }
    } catch (_: Exception) {
        if (continuation.isActive) continuation.resume(false)
    }
}

@Composable
private fun TerminalCoreFallback(modifier: Modifier, status: String, dark: Boolean) {
    Canvas(modifier) {
        val center = Offset(size.width * 0.5f, size.height * 0.50f)
        val scale = minOf(size.width * 0.40f, size.height * 0.70f)
        val line = if (dark) Color(0xFF779083) else Color(0xFF6A8173)
        val fill = if (dark) Color(0xFF1C2922) else Color(0xFFE2E9E4)
        val accent = when (status) {
            "fault" -> Color(0xFFFF8791)
            "running" -> Color(0xFF69C9A7)
            "loading", "pending", "outdated" -> Color(0xFFE9C84A)
            else -> line
        }
        fun point(x: Float, y: Float) = Offset(center.x + x * scale, center.y + y * scale)
        fun plate(offset: Float): Path = Path().apply {
            moveTo(point(-1f, offset).x, point(-1f, offset).y)
            lineTo(point(0.25f, -0.48f + offset).x, point(0.25f, -0.48f + offset).y)
            lineTo(point(1f, offset).x, point(1f, offset).y)
            lineTo(point(-0.25f, 0.48f + offset).x, point(-0.25f, 0.48f + offset).y)
            close()
        }
        drawPath(plate(0.13f), fill)
        drawPath(plate(0.13f), line.copy(alpha = 0.5f), style = Stroke(1.3f))
        drawOval(line.copy(alpha = 0.5f), point(-0.58f, -0.20f), Size(scale * 1.16f, scale * 0.57f), style = Stroke(2f))
        drawOval(accent, point(-0.39f, -0.10f), Size(scale * 0.78f, scale * 0.38f), style = Stroke(3f))
        for (i in 0 until 40) {
            val a = i * Math.PI * 2 / 40
            drawLine(line.copy(alpha = 0.55f), point(cos(a).toFloat() * 0.60f, sin(a).toFloat() * 0.30f + 0.08f),
                point(cos(a).toFloat() * 0.64f, sin(a).toFloat() * 0.32f + 0.08f), 1f)
        }
        val core = Path().apply {
            moveTo(point(-0.17f, 0.07f).x, point(-0.17f, 0.07f).y)
            lineTo(point(0f, -0.04f).x, point(0f, -0.04f).y)
            lineTo(point(0.17f, 0.07f).x, point(0.17f, 0.07f).y)
            lineTo(point(0f, 0.18f).x, point(0f, 0.18f).y)
            close()
        }
        drawPath(core, Color(0xFFE9C84A))
        drawPath(plate(-0.14f), line.copy(alpha = 0.55f), style = Stroke(1.4f))
        for (x in listOf(-1f, 1f)) drawLine(line, point(x, -0.14f), point(x, 0.13f), 2f)
        drawLine(Color(0xFFE9C84A), point(-0.76f, 0.28f), point(-0.50f, 0.38f), 3f)
    }
}
