package com.linux.permissionmanager.ui

import android.content.Context
import android.graphics.Bitmap
import android.os.SystemClock
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.lifecycle.ViewModelProvider
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.linux.permissionmanager.AppSettings
import com.linux.permissionmanager.MainActivity
import com.linux.permissionmanager.PermissionManagerApplication
import com.linux.permissionmanager.data.ManagerUiMode
import com.linux.permissionmanager.data.ManagerUiStore
import com.linux.permissionmanager.data.ThemeMode
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import kotlinx.coroutines.flow.MutableStateFlow
import org.json.JSONObject
import org.json.JSONTokener
import org.junit.After
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TestName
import org.junit.runner.RunWith

/** Pixel regression for the real Activity's edge-to-edge area, outside the WebView bounds. */
@RunWith(AndroidJUnit4::class)
class SystemBarThemeTest {
    @get:Rule val compose = createEmptyComposeRule()
    @get:Rule val testName = TestName()
    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private val app get() = instrumentation.targetContext.applicationContext as PermissionManagerApplication
    private val preferences get() = app.getSharedPreferences("AppSettings", Context.MODE_PRIVATE)
    private var scenario: ActivityScenario<MainActivity>? = null
    private var savedPreferences: Map<String, Any?> = emptyMap()
    private var savedMode: ManagerUiMode? = null
    private var savedTheme = ThemeMode.DARK
    private var savedWebPreferences: String? = null
    private var nativeBackedUp = false
    private var webBackedUp = false

    @Before fun preservePreferences() {
        assumeTrue("Use a test profile without a Root key", app.container.settings.rootKey.isBlank())
        savedPreferences = preferences.all.filterKeys(::isTestPreference)
        savedMode = app.container.managerUi.mode.value
        savedTheme = app.container.appearance.state.value.themeMode
        nativeBackedUp = true
    }

    @After fun restorePreferences() {
        try {
            if (webBackedUp && scenario != null) {
                instrumentation.runOnMainSync { check(app.container.managerUi.select(ManagerUiMode.RHINE)) }
                await("WebView available for preference restoration") { webView() != null }
                await("renderer available for preference restoration") { inspect().optBoolean("ready") }
                val raw = savedWebPreferences
                eval(if (raw == null) "localStorage.removeItem('rhine-settings'); true"
                    else "localStorage.setItem('rhine-settings', ${JSONObject.quote(raw)}); true")
                assertEquals(raw, eval("localStorage.getItem('rhine-settings')").takeUnless { it == JSONObject.NULL })
            }
        } finally {
            scenario?.close()
            scenario = null
            if (nativeBackedUp) {
                instrumentation.runOnMainSync { app.container.appearance.setThemeMode(savedTheme) }
                val edit = preferences.edit()
                preferences.all.keys.filter(::isTestPreference).forEach(edit::remove)
                savedPreferences.forEach { (key, value) ->
                    when (value) {
                        is String -> edit.putString(key, value)
                        is Boolean -> edit.putBoolean(key, value)
                        is Int -> edit.putInt(key, value)
                        is Long -> edit.putLong(key, value)
                        is Float -> edit.putFloat(key, value)
                    }
                }
                assertTrue("Restore exact native appearance and UI selection preferences", edit.commit())
                instrumentation.runOnMainSync { restoreModeInMemory(savedMode) }
            }
        }
    }

    @Test fun darkLightRoundTripAndRecreationPaintBothSystemBarSafeAreas() {
        launchLegacy()
        enterRhine()
        selectWebTheme("dark")
        assertBars("dark-before", DARK, lightIcons = false)
        selectWebTheme("light")
        assertBars("light-first", LIGHT, lightIcons = true)
        selectWebTheme("dark")
        assertBars("dark-return", DARK, lightIcons = false)
        selectWebTheme("light")
        assertBars("light-return", LIGHT, lightIcons = true)
        scenario!!.recreate()
        awaitRhine()
        awaitTheme(ThemeMode.LIGHT, true)
        assertBars("light-recreated", LIGHT, lightIcons = true)
    }

    @Test fun legacyBackgroundIsUnchangedAndReturningRhineKeepsLightSafeAreas() {
        launchLegacy()
        val legacyBefore = captureBars("legacy-before", null)
        assertTrue(legacyBefore.lightStatus && legacyBefore.lightNavigation)
        enterRhine()
        selectWebTheme("light")
        eval("document.querySelector('.terminal-modal [data-ui-mode=legacy]').click(); true")
        await("Legacy after light theme") {
            app.container.managerUi.mode.value == ManagerUiMode.LEGACY && webView() == null
        }
        val legacyAfter = captureBars("legacy-after", null)
        assertEquals("Legacy status background changed", legacyBefore.statusRgb, legacyAfter.statusRgb)
        assertEquals("Legacy navigation background changed", legacyBefore.navigationRgb, legacyAfter.navigationRgb)
        assertTrue(legacyAfter.lightStatus && legacyAfter.lightNavigation)
        enterRhine()
        awaitTheme(ThemeMode.LIGHT, true)
        assertBars("light-after-mode-return", LIGHT, lightIcons = true)
    }

    private fun launchLegacy() {
        instrumentation.runOnMainSync { check(app.container.managerUi.select(ManagerUiMode.LEGACY)) }
        scenario = ActivityScenario.launch(MainActivity::class.java)
        compose.waitForIdle()
        withActivity { activity ->
            ViewModelProvider(activity, AppViewModelFactory(app))[MainViewModel::class.java].dismissRootConfig()
        }
        compose.waitForIdle()
        assertNull(webView())
    }

    private fun enterRhine() {
        compose.onNodeWithContentDescription("设置").performClick()
        compose.onNodeWithText("新版").performClick()
        awaitRhine()
        if (!webBackedUp) {
            savedWebPreferences = eval("localStorage.getItem('rhine-settings')").takeUnless { it == JSONObject.NULL } as? String
            webBackedUp = true
        }
    }

    private fun awaitRhine() = await("interactive Rhine") {
        app.container.managerUi.mode.value == ManagerUiMode.RHINE && inspect().optString("mode") == "detail"
    }

    private fun selectWebTheme(theme: String) {
        eval("if (!document.querySelector('.terminal-modal')) document.querySelector('.system-nav [data-action=settings]').click(); true")
        await("theme selector") { eval("Boolean(document.querySelector('.terminal-modal [data-color-theme=$theme]'))") == true }
        eval("document.querySelector('.terminal-modal [data-color-theme=$theme]').click(); true")
        awaitTheme(if (theme == "light") ThemeMode.LIGHT else ThemeMode.DARK, theme == "light")
        // Let theme tint interpolation and the platform compositor settle before sampling pixels.
        SystemClock.sleep(700)
    }

    private fun awaitTheme(theme: ThemeMode, lightIcons: Boolean) = await("native theme ${theme.name} and system icon flags") {
        val bars = geometry()
        app.container.appearance.state.value.themeMode == theme &&
            bars.lightStatus == lightIcons && bars.lightNavigation == lightIcons
    }

    private data class BarGeometry(
        val width: Int, val height: Int, val originX: Int, val originY: Int,
        val statusTop: Int, val navigationBottom: Int,
        val lightStatus: Boolean, val lightNavigation: Boolean,
    )

    private data class BarObservation(val statusRgb: Int, val navigationRgb: Int, val lightStatus: Boolean, val lightNavigation: Boolean)

    private fun geometry(): BarGeometry {
        val result = AtomicReference<BarGeometry>()
        withActivity { activity ->
            val decor = activity.window.decorView
            val insets = requireNotNull(ViewCompat.getRootWindowInsets(decor)) { "Missing actual root window insets" }
            val origin = IntArray(2).also(decor::getLocationOnScreen)
            val controller = WindowCompat.getInsetsController(activity.window, decor)
            result.set(BarGeometry(decor.width, decor.height, origin[0], origin[1],
                insets.getInsets(WindowInsetsCompat.Type.statusBars()).top,
                insets.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom,
                controller.isAppearanceLightStatusBars, controller.isAppearanceLightNavigationBars))
        }
        return result.get()
    }

    private fun assertBars(label: String, expected: Int, lightIcons: Boolean) {
        val sample = captureBars(label, expected)
        assertEquals("$label status safe-area RGB; screenshot and pixel evidence saved", hex(expected), hex(sample.statusRgb))
        assertEquals("$label navigation safe-area RGB; screenshot and pixel evidence saved", hex(expected), hex(sample.navigationRgb))
        assertEquals("$label status icon flag", lightIcons, sample.lightStatus)
        assertEquals("$label navigation icon flag", lightIcons, sample.lightNavigation)
    }

    private fun captureBars(label: String, expected: Int?): BarObservation {
        compose.waitForIdle()
        SystemClock.sleep(150)
        val geometry = geometry()
        val bitmap = requireNotNull(instrumentation.uiAutomation.takeScreenshot())
        val directory = File(app.getExternalFilesDir(null), "visual/system-bars").apply { mkdirs() }
        val stem = "${testName.methodName}-$label"
        File(directory, "$stem.png").outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        val json = JSONObject().put("width", bitmap.width).put("height", bitmap.height)
            .put("decorWidth", geometry.width).put("decorHeight", geometry.height)
            .put("decorOriginX", geometry.originX).put("decorOriginY", geometry.originY)
            .put("statusTop", geometry.statusTop).put("navigationBottom", geometry.navigationBottom)
            .put("lightStatusIconsFlag", geometry.lightStatus).put("lightNavigationIconsFlag", geometry.lightNavigation)
            .put("uiMode", app.container.managerUi.mode.value?.key)
            .put("nativeTheme", app.container.appearance.state.value.themeMode.name)
            .put("expectedRgb", expected?.let(::hex) ?: JSONObject.NULL)
        try {
            assertEquals("Screenshot/decor width", geometry.width, bitmap.width)
            assertEquals("Screenshot/decor height", geometry.height, bitmap.height)
            assertEquals("Full-screen window origin X", 0, geometry.originX)
            assertEquals("Full-screen window origin Y", 0, geometry.originY)
            assertTrue("Status inset must be visible", geometry.statusTop in 4 until bitmap.height / 4)
            assertTrue("Navigation inset must be visible", geometry.navigationBottom in 4 until bitmap.height / 4)
            val statusX = bitmap.width / 2
            val statusY = geometry.statusTop / 2
            val navigationX = bitmap.width / 8
            val navigationY = bitmap.height - geometry.navigationBottom / 2
            val status = bitmap.getPixel(statusX, statusY) and 0xffffff
            val navigation = bitmap.getPixel(navigationX, navigationY) and 0xffffff
            json.put("statusSample", JSONObject().put("x", statusX).put("y", statusY).put("rgb", hex(status)))
                .put("navigationSample", JSONObject().put("x", navigationX).put("y", navigationY).put("rgb", hex(navigation)))
            return BarObservation(status, navigation, geometry.lightStatus, geometry.lightNavigation)
        } finally {
            File(directory, "$stem.json").writeText(json.toString(2))
            bitmap.recycle()
        }
    }

    private fun isTestPreference(key: String) = key.startsWith("appearance_") ||
        key == AppSettings.KEY_MANAGER_UI_MODE || key == AppSettings.KEY_MANAGER_UI_SELECTED

    @Suppress("UNCHECKED_CAST")
    private fun restoreModeInMemory(mode: ManagerUiMode?) {
        val field = ManagerUiStore::class.java.getDeclaredField("mutableMode").apply { isAccessible = true }
        (field.get(app.container.managerUi) as MutableStateFlow<ManagerUiMode?>).value = mode
    }

    private fun withActivity(block: (MainActivity) -> Unit) = requireNotNull(scenario).onActivity { block(it) }

    private fun webView(): WebView? {
        val result = AtomicReference<WebView?>()
        withActivity { result.set(findWeb(it.window.decorView)) }
        return result.get()
    }

    private fun findWeb(view: View): WebView? {
        if (view is WebView) return view
        if (view is ViewGroup) for (index in 0 until view.childCount) findWeb(view.getChildAt(index))?.let { return it }
        return null
    }

    private fun inspect() = runCatching { eval("window.rhine ? window.rhine.stats() : {}") as JSONObject }.getOrDefault(JSONObject())

    private fun eval(expression: String): Any? {
        val view = requireNotNull(webView()) { "No live WebView" }
        val latch = CountDownLatch(1)
        val result = AtomicReference<String>()
        instrumentation.runOnMainSync {
            val script = if (';' in expression) "JSON.stringify((() => { $expression; return true; })())" else "JSON.stringify($expression)"
            view.evaluateJavascript(script) { result.set(it); latch.countDown() }
        }
        check(latch.await(10, TimeUnit.SECONDS)) { "JavaScript callback timed out" }
        val decoded = JSONTokener(result.get()).nextValue()
        return if (decoded is String) JSONTokener(decoded).nextValue() else decoded
    }

    private fun await(label: String, predicate: () -> Boolean) {
        val deadline = SystemClock.uptimeMillis() + 60_000
        while (SystemClock.uptimeMillis() < deadline) {
            compose.waitForIdle()
            if (predicate()) return
            SystemClock.sleep(100)
        }
        captureBars("timeout-${label.replace(' ', '-')}", null)
        fail("Timed out: $label")
    }

    private fun hex(rgb: Int) = "#%06x".format(rgb and 0xffffff)

    companion object {
        private const val DARK = 0x11181b
        private const val LIGHT = 0xeae5e1
    }
}
