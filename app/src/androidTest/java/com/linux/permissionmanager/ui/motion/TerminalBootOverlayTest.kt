package com.linux.permissionmanager.ui.motion

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.click
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTouchInput
import androidx.test.espresso.Espresso.onView
import androidx.test.espresso.action.ViewActions.pressBack
import androidx.test.espresso.matcher.RootMatchers.isDialog
import androidx.test.espresso.matcher.ViewMatchers.isRoot
import com.linux.permissionmanager.data.AppearanceSettings
import com.linux.permissionmanager.ui.theme.SkpTheme
import java.util.concurrent.atomic.AtomicInteger
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class TerminalBootOverlayTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun reducedMotionOverlayBlocksUnderlyingTouchesAndCanBeSkipped() {
        val underlyingClicks = AtomicInteger()
        val dismissals = AtomicInteger()
        compose.setContent {
            SkpTheme(AppearanceSettings(motionEnabled = false, sceneEnabled = false)) {
                Box(Modifier.fillMaxSize().clickable { underlyingClicks.incrementAndGet() })
                TerminalBootOverlay(onDismiss = { dismissals.incrementAndGet() })
            }
        }
        compose.onNodeWithTag("terminal-boot-overlay").assertIsDisplayed().performTouchInput { click(center) }
        compose.runOnIdle { assertEquals(0, underlyingClicks.get()) }
        compose.onNodeWithText("进入").performClick()
        compose.runOnIdle { assertEquals(1, dismissals.get()) }
    }

    @Test
    fun systemBackDismissesModalInsteadOfExitingUnderlyingScreen() {
        val dismissals = AtomicInteger()
        compose.setContent {
            SkpTheme(AppearanceSettings(motionEnabled = false, sceneEnabled = false)) {
                var showing by remember { mutableStateOf(true) }
                Box(Modifier.fillMaxSize().testTag("underlying-screen"))
                if (showing) TerminalBootOverlay(onDismiss = {
                    dismissals.incrementAndGet()
                    showing = false
                })
            }
        }
        compose.onNodeWithTag("terminal-boot-overlay").assertIsDisplayed()
        // The modal owns focus; the underlying activity must not be Espresso's key-event root.
        onView(isRoot()).inRoot(isDialog()).perform(pressBack())
        compose.waitUntil(5000) { dismissals.get() == 1 }
        compose.runOnIdle { assertEquals(1, dismissals.get()) }
        compose.onNodeWithTag("terminal-boot-overlay").assertDoesNotExist()
        compose.onNodeWithTag("underlying-screen").assertIsDisplayed()
    }
}
