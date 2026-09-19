package com.linux.permissionmanager.ui

import android.content.Context
import android.content.pm.ActivityInfo
import android.content.res.Configuration
import android.graphics.Bitmap
import android.os.SystemClock
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasAnyDescendant
import androidx.compose.ui.test.hasScrollToIndexAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.Lifecycle
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.linux.permissionmanager.AppSettings
import com.linux.permissionmanager.MainActivity
import com.linux.permissionmanager.PermissionManagerApplication
import com.linux.permissionmanager.data.ManagerUiMode
import com.linux.permissionmanager.data.ManagerUiStore
import com.linux.permissionmanager.data.UiEffect
import com.linux.permissionmanager.ui.rhine.RhineSessionViewModel
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
import org.junit.runner.RunWith

/** Exercises the production Activity and local WebMessagePort without submitting Root operations. */
@RunWith(AndroidJUnit4::class)
class DualUiModeTest {
    @get:Rule val compose = createEmptyComposeRule()
    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private val app get() = instrumentation.targetContext.applicationContext as PermissionManagerApplication
    private val preferences get() = app.getSharedPreferences("AppSettings", Context.MODE_PRIVATE)
    private var scenario: ActivityScenario<MainActivity>? = null
    private var savedPreferences: Map<String, Any?> = emptyMap()
    private var savedMode: ManagerUiMode? = null
    private var backedUp = false
    private var savedRequestedOrientation: Int? = null

    @Before fun preserveUiPreferences() {
        // A configured Root device is not an appropriate fixture for this non-Root suite.
        assumeTrue("Use an emulator/test profile without a Root key", app.container.settings.rootKey.isBlank())
        savedPreferences = preferences.all.filterKeys { it in modeKeys }
        savedMode = app.container.managerUi.mode.value
        backedUp = true
    }

    @After fun restoreUiPreferences() {
        savedRequestedOrientation?.let { original ->
            scenario?.onActivity { it.requestedOrientation = original }
        }
        scenario?.close()
        scenario = null
        if (!backedUp) return
        val edit = preferences.edit()
        modeKeys.forEach(edit::remove)
        savedPreferences.forEach { (key, value) ->
            when (value) {
                is String -> edit.putString(key, value)
                is Boolean -> edit.putBoolean(key, value)
            }
        }
        assertTrue("Restore only the UI preference keys", edit.commit())
        instrumentation.runOnMainSync { setInMemoryMode(savedMode) }
    }

    @Test fun firstChoicePrecedesRootAndSurvivesRecreationAndBack() {
        launch(null)
        compose.onNodeWithTag("ui-mode-choice").assertIsDisplayed()
        compose.onNodeWithText("新版 RhineLabUI").assertIsDisplayed()
        compose.onNodeWithText("旧版 SKRoot Pro Compose").assertIsDisplayed()
        assertNull(webView())
        assertFalse(preferences.getBoolean(AppSettings.KEY_MANAGER_UI_SELECTED, false))
        scenario!!.onActivity { it.onBackPressedDispatcher.onBackPressed() }
        compose.onNodeWithTag("ui-mode-choice").assertIsDisplayed()
        scenario!!.recreate()
        compose.onNodeWithTag("ui-mode-choice").assertIsDisplayed()
        capture("first-choice")

        compose.onNodeWithText("旧版 SKRoot Pro Compose").performClick()
        awaitMode(ManagerUiMode.LEGACY)
        compose.onNodeWithTag("ui-mode-choice").assertDoesNotExist()
        withActivity { activity -> assertTrue(models(activity).main.state.value.rootConfig.visible) }
        dismissRootConfig()
        awaitLegacy()
        assertPersisted(ManagerUiMode.LEGACY)
        scenario!!.recreate()
        awaitLegacy()
        compose.onNodeWithTag("ui-mode-choice").assertDoesNotExist()
        assertPersisted(ManagerUiMode.LEGACY)
        capture("legacy-home")
    }

    @Test fun choosingRhineStartsOpeningAndRecreationKeepsProgress() {
        launch(null)
        compose.onNodeWithText("新版 RhineLabUI").performClick()
        awaitMode(ManagerUiMode.RHINE)
        dismissRootConfig()
        val started = awaitStats("first Rhine opening") { it.optString("mode") == "boot" }
        assertTrue("Opening should not be treated as completed: $started", started.optDouble("bootTime") < 35.0)
        eval("window.rhine.seek(8); true")
        awaitStats("seek into opening") { it.optDouble("bootTime") >= 12.0 }
        val session = AtomicReference<RhineSessionViewModel>()
        withActivity { activity -> session.set(ViewModelProvider(activity)[RhineSessionViewModel::class.java]) }
        scenario!!.recreate()
        awaitStats("opening resumes after recreation") { it.optString("mode") == "boot" && it.optDouble("bootTime") >= 12.0 }
        withActivity { activity -> assertSame(session.get(), ViewModelProvider(activity)[RhineSessionViewModel::class.java]) }
        assertPersisted(ManagerUiMode.RHINE)
        capture("rhine-opening-restored")
    }

    @Test fun settingsSwitchBothWaysKeepsViewModelsQueriesAndWorkspace() {
        launch(ManagerUiMode.LEGACY)
        dismissRootConfig()
        awaitLegacy()
        val retained = AtomicReference<Models>()
        withActivity { activity ->
            retained.set(models(activity))
            retained.get().authorization.setQuery("dual-ui-authorization")
            retained.get().modules.setMarketQuery("dual-ui-market")
        }
        openLegacySettings()
        capture("legacy-settings-mode-at-top")
        compose.onNodeWithText("新版").performClick()
        awaitMode(ManagerUiMode.RHINE)
        awaitStats("runtime switch bypasses opening") { it.optString("mode") == "detail" }
        assertPersisted(ManagerUiMode.RHINE)
        assertRetained(retained.get())

        eval("window.rhine.workspace('settings'); true")
        awaitStats("settings workspace") { it.optString("selected") == "settings:controls" }
        await("settings content after face transition") {
            eval("document.querySelector('.ff-body > section')?.classList.contains('ui-mode-settings')") == true
        }
        assertEquals(2, (eval("document.querySelectorAll('.ff-body [data-ui-mode]').length") as Number).toInt())
        assertEquals(0, (eval("document.querySelectorAll('[data-action=\\\"native-fallback\\\"],[data-action=\\\"fallback.open\\\"]').length") as Number).toInt())
        capture("rhine-settings-mode-at-top")

        eval("window.rhine.workspace('authorization'); true")
        awaitStats("remembered workspace") { it.optString("selected") == "authorization:manager" }
        eval("document.querySelector('.system-nav [data-action=settings]').click(); true")
        assertEquals(true, eval("document.querySelector('.terminal-modal > section')?.classList.contains('ui-mode-settings')"))
        capture("rhine-appearance-mode-at-top")
        // Both clicks occur before Native's response. The controller must dispatch only one selection.
        eval("const button=document.querySelector('.terminal-modal [data-ui-mode=legacy]'); button.click(); button.click(); true")
        awaitLegacy()
        assertPersisted(ManagerUiMode.LEGACY)
        assertRetained(retained.get())
        withActivity { activity -> assertEquals(0, models(activity).main.state.value.selectedPage) }

        openLegacySettings()
        compose.onNodeWithText("新版").performClick()
        awaitMode(ManagerUiMode.RHINE)
        awaitStats("workspace restored without opening") {
            it.optString("mode") == "detail" && it.optString("selected") == "authorization:manager"
        }
        assertRetained(retained.get())
        scenario!!.recreate()
        awaitStats("Rhine recreation restores workspace") {
            it.optString("mode") == "detail" && it.optString("selected") == "authorization:manager"
        }
        assertRetained(retained.get())
        capture("rhine-roundtrip-restored")
    }

    @Test fun actualWebGlLossPersistsLegacyAndDetachesRenderer() {
        launch(ManagerUiMode.LEGACY)
        dismissRootConfig()
        openLegacySettings()
        compose.onNodeWithText("新版").performClick()
        awaitStats("rendering before context loss") { it.optString("mode") == "detail" }
        val previous = requireNotNull(webView())
        val retained = AtomicReference<Models>()
        withActivity { activity -> retained.set(models(activity)) }
        assertEquals(true, eval("""(() => {
            const canvas=document.querySelector('#three-scene canvas');
            const gl=canvas?.getContext('webgl2');
            const extension=gl?.getExtension('WEBGL_lose_context');
            if (!extension) return false;
            setTimeout(() => extension.loseContext(), 100);
            return true;
        })()"""))
        awaitLegacy()
        assertPersisted(ManagerUiMode.LEGACY)
        instrumentation.runOnMainSync { assertFalse("Old WebView must leave the Activity", previous.isAttachedToWindow) }
        assertRetained(retained.get(), assertQueries = false)
        withActivity { activity ->
            val session = ViewModelProvider(activity)[RhineSessionViewModel::class.java]
            assertNull(session.rendererError.value)
            assertFalse(session.sensorEnabled.value)
        }
        capture("webgl-loss-legacy-fallback")
        scenario!!.recreate()
        awaitLegacy()
        assertPersisted(ManagerUiMode.LEGACY)
        assertNull(webView())
    }

    @Test fun backgroundAndRealRotationPreserveRhineWorkspaceAndViewModels() {
        launch(ManagerUiMode.LEGACY)
        dismissRootConfig()
        openLegacySettings()
        val retained = AtomicReference<Models>()
        withActivity { activity ->
            savedRequestedOrientation = activity.requestedOrientation
            retained.set(models(activity))
            retained.get().authorization.setQuery("dual-ui-authorization")
            retained.get().modules.setMarketQuery("dual-ui-market")
        }
        compose.onNodeWithText("新版").performClick()
        awaitMode(ManagerUiMode.RHINE)
        awaitStats("runtime switch before lifecycle changes") { it.optString("mode") == "detail" }
        eval("window.rhine.workspace('authorization'); true")
        awaitStats("authorization before background") {
            it.optString("mode") == "detail" && it.optString("selected") == "authorization:manager"
        }
        val retainedSession = AtomicReference<RhineSessionViewModel>()
        withActivity { activity ->
            retainedSession.set(ViewModelProvider(activity)[RhineSessionViewModel::class.java])
            assertTrue(retainedSession.get().bootCompleted.value)
        }

        scenario!!.moveToState(Lifecycle.State.STARTED)
        awaitStats("Rhine pauses below resumed lifecycle") {
            val presentation = it.optJSONObject("host")?.optJSONObject("presentation")
            presentation != null && !presentation.optBoolean("active") && !presentation.optBoolean("audioActive")
        }
        scenario!!.moveToState(Lifecycle.State.RESUMED)
        awaitStats("Rhine resumes the prior workspace") {
            it.optString("mode") == "detail" && it.optString("selected") == "authorization:manager" &&
                it.optJSONObject("host")?.optJSONObject("presentation")?.optBoolean("active") == true
        }
        assertRetained(retained.get())

        for ((requested, expected, label) in listOf(
            Triple(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE, Configuration.ORIENTATION_LANDSCAPE, "landscape"),
            Triple(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT, Configuration.ORIENTATION_PORTRAIT, "portrait"),
        )) {
            withActivity { it.requestedOrientation = requested }
            await("real $label configuration") {
                var matches = false
                withActivity { matches = it.resources.configuration.orientation == expected }
                matches
            }
            awaitStats("$label restores the prior workspace") {
                it.optString("mode") == "detail" && it.optString("selected") == "authorization:manager"
            }
            assertRetained(retained.get())
            withActivity { activity ->
                val session = ViewModelProvider(activity)[RhineSessionViewModel::class.java]
                assertSame("Presentation ViewModel was replaced by rotation", retainedSession.get(), session)
                assertTrue("Rotation must not replay the opening", session.bootCompleted.value)
            }
            assertPersisted(ManagerUiMode.RHINE)
            capture("rhine-lifecycle-$label")
        }
    }

    @Test fun legacyPagesAndNativePanelsRemainNative() {
        launch(ManagerUiMode.LEGACY)
        capture("legacy-root-config")
        dismissRootConfig()
        awaitLegacy()
        capture("legacy-home")
        compose.onNodeWithContentDescription("授权").performClick()
        capture("legacy-authorization")
        withActivity { activity -> models(activity).authorization.showPicker() }
        compose.waitForIdle()
        capture("legacy-app-picker")
        withActivity { activity -> models(activity).authorization.hidePicker() }
        compose.onNodeWithContentDescription("模块").performClick()
        capture("legacy-modules")
        openLegacySettings()
        capture("legacy-settings-mode-at-top")
        val scrollId = compose.onNode(hasScrollToIndexAction() and hasAnyDescendant(hasText("新版")) and
            SemanticsMatcher.keyIsDefined(SemanticsProperties.VerticalScrollAxisRange)).fetchSemanticsNode().id
        // The top mode selector leaves the lazy composition as this scroll progresses.
        compose.onNode(SemanticsMatcher("Legacy settings list") { it.id == scrollId })
            .performScrollToNode(hasText("重启选项"))
        compose.onNodeWithText("重启选项").performClick()
        compose.onNodeWithText("普通重启").performClick()
        compose.onNodeWithText("确认重启？").assertIsDisplayed()
        capture("legacy-reboot-confirmation")
        compose.onNodeWithText("取消").performClick()

        withActivity { activity ->
            ViewModelProvider(activity, AppViewModelFactory(app))[LocalCustomizerViewModel::class.java].show()
        }
        compose.waitForIdle()
        capture("legacy-local-customizer")
        withActivity { activity ->
            ViewModelProvider(activity, AppViewModelFactory(app))[LocalCustomizerViewModel::class.java].dismiss()
            app.container.events.emit(UiEffect.ShowLog("日志", "Dual UI visual fixture\nNo Root operation was executed."))
        }
        compose.waitForIdle()
        compose.onNodeWithText("Dual UI visual fixture", substring = true).assertIsDisplayed()
        capture("legacy-log")
        assertNull(webView())
        assertPersisted(ManagerUiMode.LEGACY)
    }

    private fun launch(mode: ManagerUiMode?) {
        instrumentation.runOnMainSync {
            if (mode == null) {
                val edit = preferences.edit()
                modeKeys.forEach(edit::remove)
                check(edit.commit())
                setInMemoryMode(null)
            } else {
                check(app.container.managerUi.select(mode))
            }
        }
        scenario = ActivityScenario.launch(MainActivity::class.java)
        compose.waitForIdle()
    }

    @Suppress("UNCHECKED_CAST")
    private fun setInMemoryMode(mode: ManagerUiMode?) {
        // The process-wide store intentionally has no production reset API; only this test resets it.
        val field = ManagerUiStore::class.java.getDeclaredField("mutableMode").apply { isAccessible = true }
        (field.get(app.container.managerUi) as MutableStateFlow<ManagerUiMode?>).value = mode
    }

    private fun dismissRootConfig() {
        withActivity { activity -> models(activity).main.dismissRootConfig() }
        compose.waitForIdle()
    }

    private fun openLegacySettings() {
        awaitLegacy()
        compose.onNodeWithContentDescription("设置").performClick()
        compose.onNodeWithText("新版").assertIsDisplayed()
        compose.onNodeWithText("旧版").assertIsDisplayed()
    }

    private fun assertPersisted(mode: ManagerUiMode) {
        assertEquals(mode.key, preferences.getString(AppSettings.KEY_MANAGER_UI_MODE, ""))
        assertTrue(preferences.getBoolean(AppSettings.KEY_MANAGER_UI_SELECTED, false))
        assertEquals(mode, ManagerUiStore().mode.value)
    }

    private fun awaitMode(mode: ManagerUiMode) = await("mode ${mode.key}") { app.container.managerUi.mode.value == mode }
    private fun awaitLegacy() {
        awaitMode(ManagerUiMode.LEGACY)
        await("legacy without WebView") { webView() == null }
        compose.onNodeWithContentDescription("主页").assertExists()
    }

    private data class Models(
        val main: MainViewModel,
        val authorization: SuperUserViewModel,
        val modules: ModuleViewModel,
        val all: List<ViewModel>,
    )

    private fun models(activity: MainActivity): Models {
        val provider = ViewModelProvider(activity, AppViewModelFactory(app))
        val main = provider[MainViewModel::class.java]
        val authorization = provider[SuperUserViewModel::class.java]
        val modules = provider[ModuleViewModel::class.java]
        return Models(main, authorization, modules, listOf(main, authorization, modules,
            provider[HomeViewModel::class.java], provider[SettingsViewModel::class.java],
            provider[LocalCustomizerViewModel::class.java]))
    }

    private fun assertRetained(expected: Models, assertQueries: Boolean = true) {
        withActivity { activity ->
            val actual = models(activity)
            expected.all.zip(actual.all).forEach { (before, after) -> assertSame("Business ViewModel was replaced", before, after) }
            assertEquals("", actual.main.state.value.activeRootKey)
            if (assertQueries) {
                assertEquals("dual-ui-authorization", actual.authorization.state.value.query)
                assertEquals("dual-ui-market", actual.modules.state.value.marketQuery)
            }
        }
    }

    private fun withActivity(block: (MainActivity) -> Unit) = requireNotNull(scenario).onActivity { block(it) }

    private fun webView(): WebView? {
        val result = AtomicReference<WebView?>()
        withActivity { activity -> result.set(findWeb(activity.window.decorView)) }
        return result.get()
    }

    private fun findWeb(view: View): WebView? {
        if (view is WebView) return view
        if (view is ViewGroup) for (index in 0 until view.childCount) findWeb(view.getChildAt(index))?.let { return it }
        return null
    }

    private fun eval(expression: String): Any? {
        val view = requireNotNull(webView()) { "No live WebView" }
        val latch = CountDownLatch(1)
        val result = AtomicReference<String>()
        instrumentation.runOnMainSync {
            val script = if (';' in expression && !expression.trimStart().startsWith("(()")) {
                "JSON.stringify((() => { $expression; return true; })())"
            } else "JSON.stringify($expression)"
            view.evaluateJavascript(script) { result.set(it); latch.countDown() }
        }
        check(latch.await(10, TimeUnit.SECONDS)) { "JavaScript callback timed out" }
        val decoded = JSONTokener(result.get()).nextValue()
        return if (decoded is String) JSONTokener(decoded).nextValue() else decoded
    }

    private fun awaitStats(label: String, predicate: (JSONObject) -> Boolean): JSONObject {
        var last = JSONObject()
        var error: Throwable? = null
        try {
            await(label, 90_000) {
                runCatching { eval("window.rhine ? window.rhine.stats() : {}") as JSONObject }
                    .onSuccess { last = it; error = null }
                    .onFailure { error = it }
                predicate(last)
            }
        } catch (failure: AssertionError) {
            capture("failure-${label.replace(' ', '-')}")
            throw AssertionError("$label: last=$last; webView=${webView() != null}; error=$error", failure)
        }
        return last
    }

    private fun await(label: String, timeout: Long = 20_000, predicate: () -> Boolean) {
        val deadline = SystemClock.uptimeMillis() + timeout
        while (SystemClock.uptimeMillis() < deadline) {
            compose.waitForIdle()
            if (predicate()) return
            SystemClock.sleep(100)
        }
        fail("Timed out: $label; mode=${app.container.managerUi.mode.value}")
    }

    private fun capture(name: String) {
        compose.waitForIdle()
        SystemClock.sleep(250)
        val bitmap = requireNotNull(instrumentation.uiAutomation.takeScreenshot())
        val directory = File(app.getExternalFilesDir(null), "visual/dual-ui").apply { mkdirs() }
        File(directory, "$name.png").outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        assertTrue("Screenshot has usable dimensions", bitmap.width >= 320 && bitmap.height >= 320)
        bitmap.recycle()
    }

    companion object {
        private val modeKeys = setOf(AppSettings.KEY_MANAGER_UI_MODE, AppSettings.KEY_MANAGER_UI_SELECTED)
    }
}
