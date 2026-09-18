package com.linux.permissionmanager.ui.theme

import android.app.Activity
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.Font
import com.linux.permissionmanager.R
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.view.WindowCompat
import com.linux.permissionmanager.data.AppearanceSettings
import com.linux.permissionmanager.data.ThemeMode

data class SemanticColors(
    val success: Color,
    val onSuccess: Color,
    val successContainer: Color,
    val onSuccessContainer: Color,
    val warning: Color,
    val warningContainer: Color,
    val onWarningContainer: Color,
    val infoContainer: Color,
    val onInfoContainer: Color,
)

object TerminalPalette {
    val Signal = Color(0xFFD8C5F2)
    val Ink = Color(0xFF080A08)
    val Paper = Color(0xFFEAE5E1)
    val Panel = Color(0xFFEDEBE4)
    val Night = Color(0xFF11181B)
}

val LocalSemanticColors = staticCompositionLocalOf { LightSemanticColors }
val LocalTerminalAppearance = staticCompositionLocalOf { AppearanceSettings() }
val LocalChromeSurfaceAlpha = staticCompositionLocalOf { 1f }
val LocalControlSurfaceAlpha = staticCompositionLocalOf { AppearanceTokens.defaultControlSurfaceAlpha }
val LocalContentDrawsBehindNavigation = staticCompositionLocalOf { false }

object AppearanceTokens {
    // The background owns the image/fallback; page surfaces must not paint it twice.
    const val pageSurfaceAlpha = 0f
    const val defaultControlSurfaceAlpha = 0.76f
    const val dialogSurfaceAlpha = 0.98f
}

private val TerminalLight = lightColorScheme(
    primary = TerminalPalette.Signal,
    onPrimary = Color(0xFF21182E),
    primaryContainer = TerminalPalette.Signal,
    onPrimaryContainer = TerminalPalette.Ink,
    secondary = Color(0xFF77756D),
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFE7E3D9),
    onSecondaryContainer = TerminalPalette.Ink,
    tertiary = Color(0xFF16705B),
    onTertiary = Color.White,
    tertiaryContainer = Color(0xFFD9EFE6),
    onTertiaryContainer = Color(0xFF164D3D),
    background = TerminalPalette.Paper,
    onBackground = TerminalPalette.Ink,
    surface = TerminalPalette.Paper,
    onSurface = TerminalPalette.Ink,
    surfaceVariant = Color(0xFFE7E3D9),
    onSurfaceVariant = Color(0xFF77756D),
    surfaceContainerLowest = Color(0xFFF6F2EF),
    surfaceContainerLow = Color(0xFFEEEAE6),
    surfaceContainer = Color(0xFFEDEBE4),
    surfaceContainerHigh = Color(0xFFE7E3D9),
    surfaceContainerHighest = Color(0xFFDEDACF),
    surfaceTint = Color.Transparent,
    outline = Color(0xFF77756D),
    outlineVariant = Color(0xFFAAA59A),
    inverseSurface = TerminalPalette.Ink,
    inverseOnSurface = TerminalPalette.Paper,
    inversePrimary = TerminalPalette.Signal,
    error = Color(0xFFB83240),
    onError = Color.White,
    errorContainer = Color(0xFFFBE0E2),
    onErrorContainer = Color(0xFF792330),
)

private val TerminalDark = darkColorScheme(
    primary = TerminalPalette.Signal,
    onPrimary = Color(0xFF21182E),
    primaryContainer = Color(0xFF44374F),
    onPrimaryContainer = Color(0xFFE8DDF7),
    secondary = Color(0xFFA6B0B1),
    onSecondary = TerminalPalette.Ink,
    secondaryContainer = Color(0xFF2A363B),
    onSecondaryContainer = Color(0xFFE0E3DC),
    tertiary = Color(0xFF69C9A7),
    onTertiary = Color(0xFF0B3023),
    tertiaryContainer = Color(0xFF1D4436),
    onTertiaryContainer = Color(0xFFC1ECD9),
    background = TerminalPalette.Night,
    onBackground = Color(0xFFE0E3DC),
    surface = TerminalPalette.Night,
    onSurface = Color(0xFFE0E3DC),
    surfaceVariant = Color(0xFF2A363B),
    onSurfaceVariant = Color(0xFFA6B0B1),
    surfaceContainerLowest = Color(0xFF0B1114),
    surfaceContainerLow = Color(0xFF172126),
    surfaceContainer = Color(0xFF202A2F),
    surfaceContainerHigh = Color(0xFF253137),
    surfaceContainerHighest = Color(0xFF2A363B),
    surfaceTint = Color.Transparent,
    outline = Color(0xFFA6B0B1),
    outlineVariant = Color(0xFF536166),
    inverseSurface = TerminalPalette.Paper,
    inverseOnSurface = TerminalPalette.Ink,
    inversePrimary = TerminalPalette.Ink,
    error = Color(0xFFFF8791),
    onError = Color(0xFF561520),
    errorContainer = Color(0xFF50212A),
    onErrorContainer = Color(0xFFFFDADF),
)

private val LightSemanticColors = SemanticColors(
    success = Color(0xFF16705B), onSuccess = Color.White,
    successContainer = Color(0xFFD9EFE6), onSuccessContainer = Color(0xFF164D3D),
    warning = Color(0xFF756012), warningContainer = Color(0xFFF6E8A7),
    onWarningContainer = Color(0xFF51430D), infoContainer = Color(0xFFE0EAE7),
    onInfoContainer = Color(0xFF284B43),
)

private val DarkSemanticColors = SemanticColors(
    success = Color(0xFF69C9A7), onSuccess = Color(0xFF0B3023),
    successContainer = Color(0xFF1D4436), onSuccessContainer = Color(0xFFC1ECD9),
    warning = Color(0xFF9B7247), warningContainer = Color(0xFF514719),
    onWarningContainer = Color(0xFFFFE58B), infoContainer = Color(0xFF273E36),
    onInfoContainer = Color(0xFFCAE7DB),
)

private val RhineNativeFont = FontFamily(
    Font(R.font.skp_misans_regular, FontWeight.Normal),
    Font(R.font.skp_misans_demibold, FontWeight.SemiBold),
    Font(R.font.skp_misans_bold, FontWeight.Bold),
)

private fun terminalText(size: Int, height: Int, weight: FontWeight = FontWeight.Normal) = TextStyle(
    fontFamily = RhineNativeFont,
    fontWeight = weight,
    fontSize = size.sp,
    lineHeight = height.sp,
    letterSpacing = 0.sp,
)

private val TerminalTypography = Typography(
    displayLarge = terminalText(44, 50, FontWeight.Bold),
    displayMedium = terminalText(36, 42, FontWeight.Bold),
    displaySmall = terminalText(32, 38, FontWeight.Bold),
    headlineLarge = terminalText(30, 36, FontWeight.Bold),
    headlineMedium = terminalText(27, 34, FontWeight.Bold),
    headlineSmall = terminalText(24, 30, FontWeight.Bold),
    titleLarge = terminalText(22, 28, FontWeight.SemiBold),
    titleMedium = terminalText(17, 24, FontWeight.SemiBold),
    titleSmall = terminalText(14, 20, FontWeight.SemiBold),
    bodyLarge = terminalText(16, 24),
    bodyMedium = terminalText(14, 21),
    bodySmall = terminalText(12, 18),
    labelLarge = terminalText(14, 20, FontWeight.SemiBold),
    labelMedium = terminalText(12, 18, FontWeight.Medium),
    labelSmall = terminalText(11, 16, FontWeight.Medium),
)

private val TerminalShapes = Shapes(
    extraSmall = RoundedCornerShape(0.dp),
    small = RoundedCornerShape(0.dp),
    medium = RoundedCornerShape(0.dp),
    large = RoundedCornerShape(0.dp),
    extraLarge = RoundedCornerShape(0.dp),
)

@Composable
fun SkpTheme(
    appearance: AppearanceSettings = AppearanceSettings(),
    content: @Composable () -> Unit,
) {
    val context = LocalContext.current
    val dark = when (appearance.themeMode) {
        ThemeMode.SYSTEM -> isSystemInDarkTheme()
        ThemeMode.LIGHT -> false
        ThemeMode.DARK -> true
    }

    LaunchedEffect(dark) {
        val window = (context as? Activity)?.window ?: return@LaunchedEffect
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = !dark
            isAppearanceLightNavigationBars = !dark
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.isNavigationBarContrastEnforced = false
        }
    }

    CompositionLocalProvider(
        LocalTerminalAppearance provides appearance,
        LocalSemanticColors provides if (dark) DarkSemanticColors else LightSemanticColors,
        LocalChromeSurfaceAlpha provides appearance.chromeSurfaceAlpha,
        LocalControlSurfaceAlpha provides appearance.controlSurfaceAlpha,
    ) {
        MaterialTheme(
            colorScheme = if (dark) TerminalDark else TerminalLight,
            typography = TerminalTypography,
            shapes = TerminalShapes,
            content = content,
        )
    }
}
