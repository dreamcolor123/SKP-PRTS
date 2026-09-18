package com.linux.permissionmanager.ui

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Rect
import android.os.SystemClock
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.dp
import androidx.core.view.WindowCompat
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.linux.permissionmanager.data.AppearanceSettings
import com.linux.permissionmanager.data.ThemeMode
import com.linux.permissionmanager.ui.scene.TerminalCoreScene
import com.linux.permissionmanager.ui.theme.SkpTheme
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import org.json.JSONObject
import org.json.JSONArray
import org.json.JSONTokener
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** Android WebView rendering fixtures only. No Root state or operation enters the scene. */
@RunWith(AndroidJUnit4::class)
class TerminalSceneTest {
    @get:Rule
    val compose = createComposeRule()

    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private val root = AtomicReference<View?>()
    private var active by mutableStateOf(true)
    private var reducedMotion by mutableStateOf(true)
    private var status by mutableStateOf("running")

    @Test
    fun lightSceneRendersInAndroidWebView() {
        show(dark = false)
        val ready = awaitScene("light scene ready") {
            it.optString("state") == "ready" && it.optBoolean("active") &&
                it.optInt("triangles") > 0 && it.optLong("frames") > 0
        }
        assertTrue(ready.getInt("width") > 0)
        assertTrue(ready.getInt("height") > 0)
        assertEquals("balanced", ready.getString("quality"))
        assertEquals("running", ready.getString("status"))
        assertFalse(ready.getBoolean("animating"))
        capture("light", ready)
    }

    @Test
    fun darkSceneStopsRenderingWhenInactive() {
        reducedMotion = false
        show(dark = true)
        awaitScene("dark scene ready") { it.optString("state") == "ready" && it.optLong("frames") > 0 }
        compose.runOnIdle { active = false }
        val paused = awaitScene("inactive scene") { !it.optBoolean("active", true) && !it.optBoolean("animating", true) }
        SystemClock.sleep(450)
        val later = inspect()
        assertEquals("Inactive scene must not produce frames", paused.getLong("frames"), later.getLong("frames"))
        assertFalse(later.getBoolean("animating"))
        capture("dark", later)
    }

    @Test
    fun reducedMotionResumesAtLatestStateWithoutQueuedAnimation() {
        show(dark = false)
        awaitScene("reduced-motion scene ready") { it.optString("state") == "ready" && it.optLong("frames") > 0 }
        compose.runOnIdle { active = false }
        val paused = awaitScene("paused reduced-motion scene") { !it.optBoolean("active", true) }
        for (next in listOf("pending", "fault", "not_installed", "outdated")) {
            compose.runOnIdle { status = next }
            val changed = awaitScene("latest state $next") { it.optString("status") == next }
            assertFalse(changed.getBoolean("animating"))
            assertEquals(paused.getLong("frames"), changed.getLong("frames"))
        }
        compose.runOnIdle { active = true }
        val resumed = awaitScene("resumed at latest state") {
            it.optBoolean("active") && it.optString("status") == "outdated" &&
                it.optLong("frames") > paused.getLong("frames")
        }
        assertFalse(resumed.getBoolean("animating"))
        SystemClock.sleep(900)
        val settled = inspect()
        assertEquals("Reduced motion must not queue transition frames", resumed.getLong("frames"), settled.getLong("frames"))
        assertEquals("outdated", settled.getString("status"))
        capture("reduced-motion", settled)
    }

    @Test
    fun webViewDomCompositorDiagnostic() {
        show(dark = false)
        awaitScene("DOM diagnostic scene ready") { it.optString("state") == "ready" }
        val callback = CountDownLatch(1)
        instrumentation.runOnMainSync {
            val webView = requireNotNull(root.get()?.let(::findWebView))
            webView.setBackgroundColor(Color.YELLOW)
            webView.evaluateJavascript("""
                (function(){
                  document.body.style.backgroundColor = '#ffff00';
                  const probe = document.createElement('div');
                  probe.id = 'compositor-probe';
                  Object.assign(probe.style, {position:'fixed',left:'20%',top:'20%',width:'50%',height:'50%',backgroundColor:'#ff0000',zIndex:'2147483647'});
                  document.body.appendChild(probe);
                  return true;
                })()
            """.trimIndent()) { callback.countDown() }
        }
        assertTrue(callback.await(5, TimeUnit.SECONDS))
        capture("dom-compositor-diagnostic", inspect())
    }

    private fun show(dark: Boolean) {
        compose.setContent {
            val view = LocalView.current
            SideEffect {
                root.set(view.rootView)
                activity(view.context)?.window?.let { window ->
                    WindowCompat.setDecorFitsSystemWindows(window, false)
                    @Suppress("DEPRECATION")
                    window.statusBarColor = android.graphics.Color.TRANSPARENT
                    @Suppress("DEPRECATION")
                    window.navigationBarColor = android.graphics.Color.TRANSPARENT
                    WindowCompat.getInsetsController(window, window.decorView).apply {
                        isAppearanceLightStatusBars = !dark
                        isAppearanceLightNavigationBars = !dark
                    }
                }
            }
            SkpTheme(
                AppearanceSettings(
                    themeMode = if (dark) ThemeMode.DARK else ThemeMode.LIGHT,
                    sceneEnabled = true,
                    motionEnabled = false,
                ),
            ) {
                Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    Column(
                        Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing).padding(20.dp),
                        verticalArrangement = Arrangement.spacedBy(20.dp),
                    ) {
                        Text("SKP-PRTS", style = MaterialTheme.typography.headlineMedium)
                        Text("ANDROID WEBVIEW / TEST FIXTURE", style = MaterialTheme.typography.labelMedium)
                        TerminalCoreScene(
                            modifier = Modifier.fillMaxWidth().height(228.dp),
                            status = status,
                            quality = "balanced",
                            dark = dark,
                            active = active,
                            reducedMotion = reducedMotion,
                        )
                        Text("status: $status / active: $active", style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }
        compose.waitForIdle()
    }

    private fun awaitScene(label: String, predicate: (JSONObject) -> Boolean): JSONObject {
        val deadline = SystemClock.uptimeMillis() + 20_000
        var last = "No WebView found"
        while (SystemClock.uptimeMillis() < deadline) {
            // runOnIdle waits before the mutation, not after it. Drive the Compose
            // test frame clock before polling JavaScript on the real Android clock.
            compose.waitForIdle()
            val result = runCatching { inspect() }
            result.getOrNull()?.let { state ->
                last = state.toString()
                if (state.optString("state") == "fault") throw AssertionError("$label: renderer fault: $last")
                if (predicate(state)) {
                    val dom = state.getJSONObject("dom")
                    assertTrue("Canvas DOM height is zero: $dom", dom.getJSONObject("canvas").getJSONObject("rect").getDouble("height") > 0)
                    assertTrue("Body DOM height is zero: $dom", dom.getJSONObject("body").getJSONObject("rect").getDouble("height") > 0)
                    return state
                }
            }
            result.exceptionOrNull()?.let { last = it.toString() }
            SystemClock.sleep(100)
        }
        throw AssertionError("$label timed out; last renderer observation: $last")
    }

    private fun inspect(): JSONObject {
        val value = AtomicReference<String?>()
        val native = AtomicReference<JSONObject>()
        val failure = AtomicReference<Throwable?>()
        val callback = CountDownLatch(1)
        instrumentation.runOnMainSync {
            runCatching {
                val webView = checkNotNull(root.get()?.let(::findWebView)) { "No scene WebView; renderer may have fallen back" }
                val ancestors = JSONArray()
                var parent: View? = webView
                while (parent != null) {
                    val current = parent
                    val location = IntArray(2)
                    current.getLocationOnScreen(location)
                    ancestors.put(JSONObject().put("class", current.javaClass.name)
                        .put("alpha", current.alpha).put("visibility", current.visibility).put("isShown", current.isShown)
                        .put("layerType", current.layerType).put("hardwareAccelerated", current.isHardwareAccelerated)
                        .put("width", current.width).put("height", current.height)
                        .put("x", location[0]).put("y", location[1]).put("z", current.z))
                    parent = current.parent as? View
                }
                native.set(JSONObject().put("ancestors", ancestors))
                webView.evaluateJavascript(
                    """
                        JSON.stringify((function(){
                          const data = window.TerminalCore ? window.TerminalCore.inspect() : {state: window.__terminalRenderState || 'loading'};
                          const canvas = document.querySelector('canvas');
                          const style = canvas ? getComputedStyle(canvas) : null;
                          const bodyStyle = getComputedStyle(document.body);
                          data.dom = {
                            innerWidth,innerHeight,dpr:devicePixelRatio,visibility:document.visibilityState,
                            canvas:canvas ? {rect:canvas.getBoundingClientRect().toJSON(),display:style.display,visibility:style.visibility,opacity:style.opacity,transform:style.transform} : null,
                            body:{rect:document.body.getBoundingClientRect().toJSON(),display:bodyStyle.display,visibility:bodyStyle.visibility,opacity:bodyStyle.opacity},
                            probe:!!document.querySelector('#compositor-probe')
                          };
                          return data;
                        })())
                    """.trimIndent(),
                ) {
                    value.set(it)
                    callback.countDown()
                }
            }.onFailure {
                failure.set(it)
                callback.countDown()
            }
        }
        // Await on the instrumentation thread; the JS callback must remain free to run on main.
        check(callback.await(5, TimeUnit.SECONDS)) { "WebView inspection callback timed out" }
        failure.get()?.let { throw it }
        val json = JSONTokener(requireNotNull(value.get())).nextValue()
        check(json is String) { "Unexpected WebView result: $json" }
        return JSONObject(json).put("native", native.get())
    }

    private fun capture(name: String, observation: JSONObject) {
        val directory = File(requireNotNull(instrumentation.targetContext.getExternalFilesDir(null)), "visual")
        check(directory.exists() || directory.mkdirs())
        val file = File(directory, "fixture-scene-$name.png")
        val deadline = SystemClock.uptimeMillis() + 10_000
        var bitmap: Bitmap? = null
        var pixels = JSONObject()
        do {
            bitmap?.recycle()
            compose.waitForIdle()
            awaitVisualSubmission()
            instrumentation.waitForIdleSync()
            SystemClock.sleep(100)
            bitmap = requireNotNull(instrumentation.uiAutomation.takeScreenshot())
            pixels = scenePixels(bitmap)
            if (pixels.getDouble("contrastFraction") >= 0.05) break
        } while (SystemClock.uptimeMillis() < deadline)
        try {
            file.outputStream().use { check(requireNotNull(bitmap).compress(Bitmap.CompressFormat.PNG, 100, it)) }
        } finally {
            bitmap?.recycle()
        }
        File(directory, "fixture-scene-$name.json").writeText(
            JSONObject()
                .put("fixture", true)
                .put("androidSdk", android.os.Build.VERSION.SDK_INT)
                .put("webView", WebView.getCurrentWebViewPackage()?.versionName)
                .put("observed", observation)
                .put("screenPixels", pixels)
                .toString(2),
        )
        assertTrue(file.length() > 0)
        assertTrue("Composited WebView scene is blank: $pixels; screenshot=$file", pixels.getDouble("contrastFraction") >= 0.05)
        Log.i("TerminalSceneTest", "Android scene fixture: ${file.absolutePath}; $observation; pixels=$pixels")
    }

    private fun awaitVisualSubmission() {
        val submitted = CountDownLatch(1)
        instrumentation.runOnMainSync {
            val webView = requireNotNull(root.get()?.let(::findWebView))
            webView.postVisualStateCallback(SystemClock.uptimeMillis(), object : WebView.VisualStateCallback() {
                override fun onComplete(requestId: Long) { submitted.countDown() }
            })
            webView.invalidate()
        }
        // Paused WebViews may not submit a new frame; the screen-pixel assertion is
        // still authoritative for their last visible frame, not JS frame counters.
        submitted.await(2, TimeUnit.SECONDS)
    }

    private fun scenePixels(bitmap: Bitmap): JSONObject {
        val rectangle = AtomicReference<Rect>()
        instrumentation.runOnMainSync {
            val webView = requireNotNull(root.get()?.let(::findWebView))
            val location = IntArray(2)
            webView.getLocationOnScreen(location)
            rectangle.set(Rect(location[0], location[1], location[0] + webView.width, location[1] + webView.height))
        }
        val bounds = requireNotNull(rectangle.get())
        assertTrue("Scene is outside screenshot: $bounds", bounds.intersect(0, 0, bitmap.width, bitmap.height))
        val background = bitmap.getPixel(bounds.left + 1, bounds.top + 1)
        var contrast = 0
        var sampled = 0
        for (y in bounds.top until bounds.bottom step 2) {
            for (x in bounds.left until bounds.right step 2) {
                val color = bitmap.getPixel(x, y)
                val difference = maxOf(
                    kotlin.math.abs(Color.red(color) - Color.red(background)),
                    kotlin.math.abs(Color.green(color) - Color.green(background)),
                    kotlin.math.abs(Color.blue(color) - Color.blue(background)),
                )
                if (difference > 24) contrast++
                sampled++
            }
        }
        return JSONObject().put("bounds", bounds.toShortString()).put("sampled", sampled)
            .put("contrastPixels", contrast).put("contrastFraction", contrast.toDouble() / sampled.coerceAtLeast(1))
    }

    private fun findWebView(view: View): WebView? {
        if (view is WebView) return view
        if (view is ViewGroup) {
            for (index in 0 until view.childCount) {
                findWebView(view.getChildAt(index))?.let { return it }
            }
        }
        return null
    }

    private fun activity(context: Context): Activity? = when (context) {
        is Activity -> context
        is ContextWrapper -> context.baseContext.takeUnless { it === context }?.let(::activity)
        else -> null
    }
}
