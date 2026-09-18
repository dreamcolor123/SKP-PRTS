package com.linux.permissionmanager.ui.motion

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.height
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import com.linux.permissionmanager.data.AppearanceSettings
import com.linux.permissionmanager.ui.components.TerminalTopBar
import com.linux.permissionmanager.ui.components.TerminalNavigation
import com.linux.permissionmanager.ui.components.GlassNavigationItem
import com.linux.permissionmanager.ui.theme.SkpTheme
import org.junit.Assert.assertTrue
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import java.util.concurrent.atomic.AtomicInteger

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
class TerminalLargeTextTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun longApplicationNameAtTwoTimesFontScaleDoesNotOverlapActions() {
        val title = "SKP-PRTS 实验终端本地定制版本"
        compose.setContent {
            CompositionLocalProvider(LocalDensity provides Density(LocalDensity.current.density, 2f)) {
                SkpTheme(AppearanceSettings(motionEnabled = false, sceneEnabled = false)) {
                    Box(Modifier.width(360.dp)) {
                        TerminalTopBar(title, "01 / SYSTEM OVERVIEW", actions = {
                            repeat(3) { index ->
                                IconButton(onClick = {}) { Icon(Icons.Outlined.Refresh, "action-$index") }
                            }
                        })
                    }
                }
            }
        }
        val titleBounds = compose.onNodeWithText(title).assertIsDisplayed().fetchSemanticsNode().boundsInRoot
        val actionBounds = compose.onNodeWithContentDescription("action-0").assertIsDisplayed().fetchSemanticsNode().boundsInRoot
        val toolbarBounds = compose.onNodeWithTag("terminal-top-bar").fetchSemanticsNode().boundsInRoot
        assertTrue(titleBounds.right <= actionBounds.left)
        assertTrue(titleBounds.bottom <= toolbarBounds.bottom)
        assertTrue(titleBounds.top >= toolbarBounds.top)
    }

    @Test
    fun shortLargeTextRailCanScrollToLastDestination() {
        val selection = AtomicInteger(-1)
        compose.setContent {
            CompositionLocalProvider(LocalDensity provides Density(LocalDensity.current.density, 2f)) {
                SkpTheme(AppearanceSettings(motionEnabled = false, sceneEnabled = false)) {
                    Box(Modifier.width(600.dp).height(300.dp)) {
                        TerminalNavigation(
                            items = listOf("概览", "授权", "模块", "设置").map {
                                GlassNavigationItem(it, Icons.Outlined.Refresh, Icons.Outlined.Refresh)
                            },
                            selectedIndex = 0,
                            onSelect = { selection.set(it) },
                            vertical = true,
                        )
                    }
                }
            }
        }
        compose.onNodeWithText("设置").performScrollTo().assertIsDisplayed().performClick()
        compose.runOnIdle { assertEquals(3, selection.get()) }
    }
}
