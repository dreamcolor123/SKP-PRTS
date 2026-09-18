package com.linux.permissionmanager.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class TerminalAppearanceTest {
    @Test
    fun missingTerminalPreferencesUseCompatibleDefaults() {
        val defaults = AppearanceSettings()
        assertEquals(ThemeMode.SYSTEM, defaults.themeMode)
        assertEquals(SceneQuality.BALANCED, defaults.sceneQuality)
        assertTrue(defaults.motionEnabled)
        assertTrue(defaults.sceneEnabled)
        assertEquals(ThemeMode.SYSTEM, ThemeMode.fromKey(""))
        assertEquals(SceneQuality.BALANCED, SceneQuality.fromKey(""))
    }

    @Test
    fun unknownTerminalValuesFallBackWithoutChangingLegacyPalette() {
        assertEquals(ThemeMode.SYSTEM, ThemeMode.fromKey("FUTURE_THEME"))
        assertEquals(SceneQuality.BALANCED, SceneQuality.fromKey("FUTURE_QUALITY"))
        assertEquals(ThemeMode.DARK, ThemeMode.fromKey("DARK"))
        assertEquals(SceneQuality.FULL, SceneQuality.fromKey("FULL"))
        assertEquals(PaletteId.CORAL, PaletteId.fromKey("coral"))
    }

    @Test
    fun changingTerminalModeRetainsLegacyBackgroundAndGlassSettings() {
        val legacy = AppearanceSettings(
            palette = PaletteId.FOREST,
            backgroundUri = "content://fixture/wallpaper",
            backgroundAlpha = 0.42f,
            chromeTransparency = 0.13f,
            controlTransparency = 0.27f,
            glassNavigationEnabled = false,
            glassNavigationTransparency = 0.37f,
        )
        val migrated = legacy.copy(themeMode = ThemeMode.DARK, motionEnabled = false, sceneQuality = SceneQuality.FULL)
        assertEquals(legacy, migrated.copy(themeMode = legacy.themeMode, motionEnabled = legacy.motionEnabled, sceneQuality = legacy.sceneQuality))
    }

    @Test
    fun terminalStorageUsesIndependentVersionedKeys() {
        val keys = listOf(TerminalAppearanceKeys.THEME_MODE, TerminalAppearanceKeys.MOTION_ENABLED, TerminalAppearanceKeys.SCENE_ENABLED, TerminalAppearanceKeys.SCENE_QUALITY)
        assertEquals(4, keys.distinct().size)
        assertTrue(keys.all { it.startsWith("appearance_terminal_v2_") })
    }
}
