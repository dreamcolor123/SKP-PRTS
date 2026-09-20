package com.linux.permissionmanager.ui

import android.content.Context
import android.content.ContextWrapper
import android.graphics.Bitmap
import android.os.SystemClock
import android.view.View
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.linux.permissionmanager.data.AppearanceSettings
import com.linux.permissionmanager.data.ManagerUiMode
import com.linux.permissionmanager.ui.startup.StartupRootContent
import com.linux.permissionmanager.ui.theme.SkpTheme
import java.io.File
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import kotlin.math.min

/** Pure presentation fixtures. Every Root operation is a counter or an in-memory state update. */
@RunWith(AndroidJUnit4::class)
class StartupTerminalTest {
    @get:Rule val compose = createComposeRule()
    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private val rootView = AtomicReference<View>()
    private var renderedDensity = 1f

    @Test fun choiceSuccessfulSelectionCannotBeSubmittedTwice() {
        val selections = mutableListOf<ManagerUiMode>()
        show { ManagerUiChoice { selections += it; true } }
        compose.onNodeWithTag("ui-mode-choice").assertIsDisplayed()
        compose.onNodeWithText("新版 RhineLabUI").performClick()
        compose.onNodeWithText("新版 RhineLabUI").assertIsNotEnabled().performClick()
        compose.onNodeWithText("旧版 SKRoot Pro Compose").assertIsNotEnabled().performClick()
        compose.runOnIdle { assertEquals(listOf(ManagerUiMode.RHINE), selections) }
    }

    @Test fun choiceFailedSaveCanRetryWithoutLockingTheScreen() {
        val calls = AtomicInteger()
        show { ManagerUiChoice { calls.incrementAndGet() > 1 } }
        compose.onNodeWithText("旧版 SKRoot Pro Compose").performClick()
        compose.onNodeWithText("旧版 SKRoot Pro Compose").assertIsEnabled()
        compose.onNodeWithText("新版 RhineLabUI").assertIsEnabled()
        compose.onNodeWithText("旧版 SKRoot Pro Compose").performClick()
        compose.onNodeWithText("旧版 SKRoot Pro Compose").assertIsNotEnabled()
        compose.runOnIdle { assertEquals(2, calls.get()) }
    }

    @Test fun rootPasswordModeImportAndExportKeepOriginalStateRules() {
        var state by mutableStateOf(RootConfigUiState(visible = true))
        val imports = AtomicInteger()
        val exports = AtomicInteger()
        val confirmations = AtomicInteger()
        val dismissals = AtomicInteger()
        show {
            StartupRootContent(
                state, { dismissals.incrementAndGet() }, { state = state.copy(rootKey = it) },
                { state = state.copy(hotload = it) },
                {
                    imports.incrementAndGet()
                    state = state.copy(rootKey = "fixture-imported-key", hotloadCommand = "ROOT_KEY=fixture-imported-key", method = "SHELL")
                },
                { exports.incrementAndGet() }, { confirmations.incrementAndGet() },
            )
        }
        compose.onNodeWithTag("startup-mode-boot").assertIsSelected()
        compose.onNodeWithTag("startup-root-key")
            .assert(SemanticsMatcher.keyIsDefined(SemanticsProperties.Password))
            .performTextInput("fixture-manual-key")
        compose.runOnIdle { assertEquals("fixture-manual-key", state.rootKey) }
        compose.onNodeWithTag("startup-mode-hotload").performClick().assertIsSelected()
        compose.onNodeWithTag("startup-export").assertIsNotEnabled()
        compose.onNodeWithTag("startup-import").performScrollTo().performClick()
        compose.onNodeWithTag("startup-root-key").assertIsNotEnabled()
        compose.onNodeWithTag("startup-export").assertIsEnabled().performClick()
        compose.onNodeWithTag("startup-confirm").performClick()
        compose.onNodeWithTag("startup-cancel").performClick()
        compose.runOnIdle {
            assertTrue(state.hotload)
            assertEquals("fixture-imported-key", state.rootKey)
            assertEquals(1, imports.get())
            assertEquals(1, exports.get())
            assertEquals(1, confirmations.get())
            assertEquals(1, dismissals.get())
        }
    }

    @Test fun busyRootStateDisablesEveryMutationAndDismissal() {
        val callbacks = AtomicInteger()
        show {
            StartupRootContent(
                RootConfigUiState(visible = true, hotload = true, rootKey = "fixture-key", hotloadCommand = "fixture-script", busy = true),
                { callbacks.incrementAndGet() }, { callbacks.incrementAndGet() }, { callbacks.incrementAndGet() },
                { callbacks.incrementAndGet() }, { callbacks.incrementAndGet() }, { callbacks.incrementAndGet() },
            )
        }
        for (tag in listOf("startup-mode-boot", "startup-mode-hotload", "startup-root-key", "startup-import", "startup-export", "startup-confirm", "startup-cancel")) {
            compose.onNodeWithTag(tag).assertIsNotEnabled()
        }
        compose.onNodeWithTag("startup-confirm").performClick()
        compose.onNodeWithTag("startup-cancel").performClick()
        compose.runOnIdle { assertEquals(0, callbacks.get()) }
    }

    @Test fun compactAndLargeTextLayoutsKeepActionsInsideTheSharedFrame() {
        var configuration by mutableStateOf(LayoutCase(360, 640, 1f, false))
        show(layout = { configuration }) {
            if (configuration.root) {
                StartupRootContent(RootConfigUiState(visible = true, hotload = true), {}, {}, {}, {}, {}, {})
            } else ManagerUiChoice { false }
        }
        for (root in listOf(false, true)) for ((width, height) in listOf(360 to 640, 640 to 360)) for (fontScale in listOf(1f, 1.6f)) {
            val next = LayoutCase(width, height, fontScale, root)
            compose.runOnIdle { configuration = next }
            compose.waitForIdle()
            val name = "${if (root) "root" else "choice"}-${width}x$height-font$fontScale"
            capture(name, next)
            val screen = compose.onNodeWithTag("startup-screen").assertIsDisplayed().fetchSemanticsNode().boundsInRoot
            val actions = if (root) compose.onNodeWithTag("startup-actions").assertIsDisplayed().fetchSemanticsNode().boundsInRoot else null
            if (actions != null) assertTrue("Action strip escapes the screen: $next", actions.left >= screen.left - 1 && actions.right <= screen.right + 1 &&
                actions.top >= screen.top - 1 && actions.bottom <= screen.bottom + 1)
            val buttons = if (root) listOf(compose.onNodeWithTag("startup-confirm"), compose.onNodeWithTag("startup-cancel"))
                else listOf(compose.onNodeWithText("新版 RhineLabUI"), compose.onNodeWithText("旧版 SKRoot Pro Compose"))
            buttons.forEach { node ->
                if (!root) node.performScrollTo()
                val bounds = node.assertIsDisplayed().fetchSemanticsNode().boundsInRoot
                assertTrue("Touch target below 48 dp: $next $bounds", bounds.height + 1 >= 48 * renderedDensity)
                if (actions != null) assertTrue("Button escapes action strip: $next", bounds.left >= actions.left - 1 && bounds.right <= actions.right + 1 &&
                    bounds.top >= actions.top - 1 && bounds.bottom <= actions.bottom + 1)
            }
            val heading = compose.onNodeWithTag("startup-title").performScrollTo().assertIsDisplayed().fetchSemanticsNode()
            val layouts = mutableListOf<TextLayoutResult>()
            heading.config[SemanticsActions.GetTextLayoutResult].action?.invoke(layouts)
            assertTrue("Heading must expose actual text layout", layouts.isNotEmpty())
            recordTextLayout(name, layouts.single())
            capture(name, next)
            assertTrue("Compact heading must not return to hero scale", layouts.single().layoutInput.style.fontSize.value <= 22f)
            assertFalse("Heading has clipped text: $next", layouts.single().hasVisualOverflow)
            capture(name, next)
        }
    }

    @Test fun actualImeLeavesSaveAndCancelReachable() {
        var state by mutableStateOf(RootConfigUiState(visible = true))
        val confirmed = AtomicInteger()
        show {
            StartupRootContent(state, {}, { state = state.copy(rootKey = it) }, { state = state.copy(hotload = it) }, {}, {}, { confirmed.incrementAndGet() })
        }
        val field = compose.onNodeWithTag("startup-root-key").performScrollTo().performClick()
        field.performTextInput("fixture-keyboard-input")
        instrumentation.runOnMainSync {
            val view = rootView.get()
            WindowInsetsControllerCompat(findActivity(view.context).window, view).show(WindowInsetsCompat.Type.ime())
        }
        val deadline = SystemClock.uptimeMillis() + 8_000
        var imeVisible = false
        var lastImeInset = -1
        var stableSamples = 0
        while (SystemClock.uptimeMillis() < deadline && stableSamples < 3) {
            compose.waitForIdle()
            var currentInset = 0
            instrumentation.runOnMainSync {
                val insets = ViewCompat.getRootWindowInsets(rootView.get())
                imeVisible = insets?.isVisible(WindowInsetsCompat.Type.ime()) == true
                currentInset = insets?.getInsets(WindowInsetsCompat.Type.ime())?.bottom ?: 0
            }
            stableSamples = if (imeVisible && currentInset > 0 && currentInset == lastImeInset) stableSamples + 1 else 0
            lastImeInset = currentInset
            SystemClock.sleep(100)
        }
        SystemClock.sleep(600)
        compose.waitForIdle()
        capture("root-keyboard", null, imeVisible)
        assertTrue("Software keyboard must be visible for this IME regression", imeVisible)
        val keyboardTop = AtomicInteger()
        val composeTop = AtomicInteger()
        val decorHeight = AtomicInteger()
        val decorTop = AtomicInteger()
        instrumentation.runOnMainSync {
            val view = rootView.get()
            val decor = findActivity(view.context).window.decorView
            val insets = requireNotNull(ViewCompat.getRootWindowInsets(decor))
            val decorLocation = IntArray(2).also(decor::getLocationOnScreen)
            decorTop.set(decorLocation[1])
            decorHeight.set(decor.height)
            keyboardTop.set(decorLocation[1] + decor.height - insets.getInsets(WindowInsetsCompat.Type.ime()).bottom)
            val location = IntArray(2).also(view::getLocationOnScreen)
            composeTop.set(location[1])
        }
        val saveBounds = compose.onNodeWithTag("startup-confirm").fetchSemanticsNode().boundsInRoot
        val cancelBounds = compose.onNodeWithTag("startup-cancel").fetchSemanticsNode().boundsInRoot
        val directory = File(instrumentation.targetContext.getExternalFilesDir(null), "visual/startup-terminal").apply { mkdirs() }
        File(directory, "root-keyboard-insets.json").writeText(JSONObject().put("imeBottom", lastImeInset)
            .put("stableSamples", stableSamples).put("keyboardTop", keyboardTop.get()).put("composeTop", composeTop.get())
            .put("decorHeight", decorHeight.get()).put("decorTop", decorTop.get())
            .put("saveBottomOnScreen", saveBounds.bottom + composeTop.get()).put("cancelBottomOnScreen", cancelBounds.bottom + composeTop.get()).toString(2))
        assertTrue("Keyboard inset must settle before checking occlusion", stableSamples >= 3)
        assertTrue("Save button is occluded by the actual keyboard", saveBounds.bottom + composeTop.get() <= keyboardTop.get() + 1)
        assertTrue("Cancel button is occluded by the actual keyboard", cancelBounds.bottom + composeTop.get() <= keyboardTop.get() + 1)
        compose.onNodeWithTag("startup-confirm").assertIsDisplayed().performClick()
        compose.onNodeWithTag("startup-cancel").assertIsDisplayed()
        compose.runOnIdle { assertEquals("fixture-keyboard-input", state.rootKey); assertEquals(1, confirmed.get()) }
    }

    private data class LayoutCase(val widthDp: Int, val heightDp: Int, val fontScale: Float, val root: Boolean)

    private fun show(layout: (() -> LayoutCase)? = null, content: @Composable () -> Unit) {
        compose.setContent {
            rootView.set(LocalView.current)
            val activity = findActivity(LocalView.current.context)
            SideEffect {
                activity.enableEdgeToEdge()
                activity.window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
            }
            val base = LocalDensity.current
            val configuration = LocalConfiguration.current
            val selected = layout?.invoke()
            val density = if (selected == null) base else Density(
                min(base.density, min(configuration.screenWidthDp * base.density / selected.widthDp,
                    configuration.screenHeightDp * base.density / selected.heightDp)), selected.fontScale,
            )
            renderedDensity = density.density
            CompositionLocalProvider(LocalDensity provides density) {
                SkpTheme(AppearanceSettings(motionEnabled = false, sceneEnabled = false)) {
                    if (selected == null) content()
                    else key(selected) { Box(Modifier.requiredSize(selected.widthDp.dp, selected.heightDp.dp)) { content() } }
                }
            }
        }
    }

    private fun findActivity(context: Context): ComponentActivity {
        var current = context
        while (current is ContextWrapper) {
            if (current is ComponentActivity) return current
            current = current.baseContext
        }
        error("Startup fixture must be hosted by ComponentActivity")
    }

    private fun capture(name: String, layout: LayoutCase?, imeVisible: Boolean? = null) {
        compose.waitForIdle()
        instrumentation.waitForIdleSync()
        SystemClock.sleep(250)
        val bitmap = requireNotNull(instrumentation.uiAutomation.takeScreenshot())
        val directory = File(instrumentation.targetContext.getExternalFilesDir(null), "visual/startup-terminal").apply { mkdirs() }
        File(directory, "$name.png").outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        File(directory, "$name.json").writeText(JSONObject().put("screenshotWidth", bitmap.width).put("screenshotHeight", bitmap.height)
            .put("fixtureWidthDp", layout?.widthDp ?: JSONObject.NULL).put("fixtureHeightDp", layout?.heightDp ?: JSONObject.NULL)
            .put("fontScale", layout?.fontScale ?: JSONObject.NULL).put("fixtureDensity", renderedDensity)
            .put("actualImeVisible", imeVisible ?: JSONObject.NULL).put("viewportIsSimulated", layout != null).toString(2))
        bitmap.recycle()
    }

    private fun recordTextLayout(name: String, result: TextLayoutResult) {
        val directory = File(instrumentation.targetContext.getExternalFilesDir(null), "visual/startup-terminal").apply { mkdirs() }
        val lines = org.json.JSONArray()
        repeat(result.lineCount) { index ->
            lines.put(JSONObject().put("index", index).put("left", result.getLineLeft(index)).put("right", result.getLineRight(index))
                .put("top", result.getLineTop(index)).put("bottom", result.getLineBottom(index)).put("baseline", result.getLineBaseline(index)))
        }
        val json = JSONObject().put("text", result.layoutInput.text.text).put("fontSizeSp", result.layoutInput.style.fontSize.value)
            .put("lineHeightSp", result.layoutInput.style.lineHeight.value).put("sizeWidth", result.size.width).put("sizeHeight", result.size.height)
            .put("constraints", result.layoutInput.constraints.toString()).put("density", result.layoutInput.density.density)
            .put("fontScale", result.layoutInput.density.fontScale).put("multiParagraphWidth", result.multiParagraph.width)
            .put("multiParagraphHeight", result.multiParagraph.height).put("didOverflowWidth", result.didOverflowWidth)
            .put("didOverflowHeight", result.didOverflowHeight).put("hasVisualOverflow", result.hasVisualOverflow)
            .put("lineCount", result.lineCount).put("lines", lines)
        File(directory, "$name-text-layout.json").writeText(json.toString(2))
    }
}
