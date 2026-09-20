package com.linux.permissionmanager.ui.startup

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.linux.permissionmanager.BuildConfig
import com.linux.permissionmanager.R
import com.linux.permissionmanager.ui.motion.rememberTerminalMotionEnabled

/** Shared native entry surface; no WebView, blur, or continuous rendering loop. */
@Composable
fun StartupTerminalFrame(
    step: String,
    title: String,
    subtitle: String,
    modifier: Modifier = Modifier,
    actions: @Composable () -> Unit = {},
    content: @Composable ColumnScope.() -> Unit,
) {
    val colors = MaterialTheme.colorScheme
    val accent = if (colors.background.luminance() > .5f) Color(0xFF71509A) else colors.primary
    val motion = rememberTerminalMotionEnabled()
    var entered by rememberSaveable { mutableStateOf(false) }
    val reveal = remember { Animatable(if (entered || !motion) 1f else 0f) }
    LaunchedEffect(motion) {
        entered = true
        if (motion) reveal.animateTo(1f, tween(480)) else reveal.snapTo(1f)
    }
    CompositionLocalProvider(LocalContentColor provides colors.onBackground) {
    Box(modifier.fillMaxSize().background(colors.background).testTag("startup-screen"), contentAlignment = Alignment.TopCenter) {
        Canvas(Modifier.matchParentSize()) {
            val grid = 48.dp.toPx()
            var x = grid / 2
            while (x < size.width) {
                var y = grid / 2
                while (y < size.height) {
                    drawLine(colors.outlineVariant.copy(alpha = .16f), Offset(x - 2, y), Offset(x + 2, y), 1f)
                    drawLine(colors.outlineVariant.copy(alpha = .16f), Offset(x, y - 2), Offset(x, y + 2), 1f)
                    y += grid
                }
                x += grid
            }
        }
        Column(
            Modifier.widthIn(max = 560.dp).fillMaxSize().safeDrawingPadding().imePadding().padding(horizontal = 24.dp, vertical = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Row(Modifier.widthIn(max = 480.dp).fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Image(painterResource(R.drawable.skp_startup_mark), null, Modifier.size(48.dp))
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Text("SKROOT PRO", fontSize = 16.sp, lineHeight = 22.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.sp)
                    Text("KERNEL MANAGEMENT", fontSize = 9.sp, lineHeight = 14.sp, letterSpacing = 0.sp, color = colors.onSurfaceVariant)
                }
                Text(step, fontSize = 12.sp, fontFamily = FontFamily.Monospace, color = accent, letterSpacing = 0.sp)
            }
            Spacer(Modifier.height(12.dp))
            HorizontalDivider(Modifier.widthIn(max = 480.dp).drawWithContent {
                drawContent()
                drawLine(colors.primary, Offset.Zero, Offset(size.width * reveal.value, 0f), 2.dp.toPx())
            }, color = colors.outlineVariant.copy(alpha = .5f))
            BoxWithConstraints(Modifier.weight(1f).widthIn(max = 432.dp).fillMaxWidth()) {
                Column(
                    Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).heightIn(min = maxHeight)
                        .padding(vertical = 28.dp).graphicsLayer {
                            alpha = .65f + reveal.value * .35f
                            translationY = (1f - reveal.value) * 8.dp.toPx()
                        },
                    verticalArrangement = Arrangement.Center,
                ) {
                    Text(subtitle, color = accent, fontSize = 10.sp, lineHeight = 16.sp, fontFamily = FontFamily.Monospace, letterSpacing = 0.sp)
                    Spacer(Modifier.height(10.dp))
                    Text(title, fontSize = 20.sp, lineHeight = 28.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.sp,
                        modifier = Modifier.fillMaxWidth().testTag("startup-title"))
                    Spacer(Modifier.height(24.dp))
                    content()
                }
            }
            Column(Modifier.widthIn(max = 432.dp).fillMaxWidth().testTag("startup-actions")) { actions() }
            Spacer(Modifier.height(12.dp))
            HorizontalDivider(Modifier.widthIn(max = 480.dp), color = colors.outlineVariant.copy(alpha = .5f))
            Row(Modifier.widthIn(max = 480.dp).fillMaxWidth().padding(top = 10.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("LOCAL / SESSION", fontSize = 9.sp, lineHeight = 14.sp, color = colors.onSurfaceVariant, letterSpacing = 0.sp)
                Text(BuildConfig.VERSION_NAME, fontFamily = FontFamily.Monospace, fontSize = 10.sp, lineHeight = 14.sp, color = colors.onSurfaceVariant, letterSpacing = 0.sp)
            }
        }
    }
    }
}
