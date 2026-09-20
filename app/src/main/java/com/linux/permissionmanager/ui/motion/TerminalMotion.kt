package com.linux.permissionmanager.ui.motion

import android.animation.ValueAnimator
import android.database.ContentObserver
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import androidx.annotation.RequiresApi
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asComposeRenderEffect
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.takeOrElse
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.constrainHeight
import androidx.compose.ui.unit.constrainWidth
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.linux.permissionmanager.ui.theme.LocalTerminalAppearance
import com.linux.permissionmanager.ui.theme.TerminalPalette
import kotlinx.coroutines.delay
import kotlin.math.ceil
import kotlin.math.floor

val LocalMotionActive = staticCompositionLocalOf { true }

object TerminalMotionSpec {
    const val GLITCH_DURATION_MS = 200
    const val ROLL_DURATION_MS = 460
    const val REVEAL_DURATION_MS = 360
    const val BOOT_DURATION_MS = 1680

    fun glitchOffset(progress: Float): Float = when {
        progress < 0f || progress >= 1f -> 0f
        progress < 0.16f -> -1f
        progress < 0.28f -> 0.6f
        progress < 0.44f -> 0f
        progress < 0.56f -> 0.35f
        else -> 0f
    }

    fun revealFraction(progress: Float, band: Int, bands: Int): Float {
        val count = bands.coerceAtLeast(1)
        val stagger = if (count == 1) 0f else band.coerceIn(0, count - 1).toFloat() / (count - 1) * 0.3f
        return ((progress.coerceIn(0f, 1f) - stagger) / (1f - stagger)).coerceIn(0f, 1f)
    }

    fun nextRollingSlot(position: Float): Int = ceil(position).toInt() + 1

    fun visibleRollingSlots(position: Float): IntRange = floor(position).toInt()..ceil(position).toInt()

    fun enabled(pageActive: Boolean, preference: Boolean, resumed: Boolean, systemEnabled: Boolean): Boolean =
        pageActive && preference && resumed && systemEnabled
}

@Composable
fun rememberSystemMotionEnabled(): Boolean {
    val resolver = LocalContext.current.contentResolver
    fun read() = ValueAnimator.areAnimatorsEnabled() &&
        Settings.Global.getFloat(resolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) > 0f
    var enabled by remember(resolver) { mutableStateOf(read()) }
    DisposableEffect(resolver) {
        val observer = object : ContentObserver(Handler(Looper.getMainLooper())) {
            override fun onChange(selfChange: Boolean) { enabled = read() }
        }
        resolver.registerContentObserver(Settings.Global.getUriFor(Settings.Global.ANIMATOR_DURATION_SCALE), false, observer)
        enabled = read()
        onDispose { resolver.unregisterContentObserver(observer) }
    }
    return enabled
}

@Composable
fun rememberTerminalMotionEnabled(): Boolean {
    val resolver = LocalContext.current.contentResolver
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    var resumed by remember(lifecycle) { mutableStateOf(lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)) }
    var systemEnabled by remember { mutableStateOf(ValueAnimator.areAnimatorsEnabled()) }
    DisposableEffect(lifecycle, resolver) {
        fun refresh() {
            resumed = lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)
            systemEnabled = ValueAnimator.areAnimatorsEnabled() &&
                Settings.Global.getFloat(resolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) > 0f
        }
        val observer = LifecycleEventObserver { _, _ -> refresh() }
        val settingObserver = object : ContentObserver(Handler(Looper.getMainLooper())) {
            override fun onChange(selfChange: Boolean) = refresh()
        }
        lifecycle.addObserver(observer)
        resolver.registerContentObserver(Settings.Global.getUriFor(Settings.Global.ANIMATOR_DURATION_SCALE), false, settingObserver)
        refresh()
        onDispose {
            lifecycle.removeObserver(observer)
            resolver.unregisterContentObserver(settingObserver)
        }
    }
    return TerminalMotionSpec.enabled(
        pageActive = LocalMotionActive.current,
        preference = LocalTerminalAppearance.current.motionEnabled,
        resumed = resumed,
        systemEnabled = systemEnabled,
    )
}

@Composable
private fun rememberEntranceProgress(key: Any, enabled: Boolean, duration: Int): Animatable<Float, androidx.compose.animation.core.AnimationVector1D> {
    val progress = remember { Animatable(1f) }
    var consumedKey by remember { mutableStateOf<Any?>(null) }
    LaunchedEffect(key, enabled) {
        if (!enabled || consumedKey == key) {
            progress.snapTo(1f)
        } else {
            consumedKey = key
            progress.snapTo(0f)
            progress.animateTo(1f, tween(duration, easing = LinearEasing))
        }
    }
    return progress
}

@Composable
fun GlitchText(
    text: String,
    modifier: Modifier = Modifier,
    style: TextStyle = LocalTextStyle.current,
    color: Color = Color.Unspecified,
) {
    val enabled = rememberTerminalMotionEnabled()
    val progress = rememberEntranceProgress(text, enabled, TerminalMotionSpec.GLITCH_DURATION_MS)
    val shader = if (Build.VERSION.SDK_INT >= 33) remember { runCatching { GlitchShader.create() }.getOrNull() } else null
    Text(
        text = text,
        style = style,
        color = color,
        modifier = modifier.clipToBounds().graphicsLayer {
            val displacement = if (enabled) TerminalMotionSpec.glitchOffset(progress.value) else 0f
            renderEffect = if (Build.VERSION.SDK_INT >= 33 && shader != null && displacement != 0f) {
                GlitchShader.effect(shader, displacement, size.width, size.height)
            } else null
        }.drawWithContent {
            val displacement = if (enabled) TerminalMotionSpec.glitchOffset(progress.value) * 3.dp.toPx() else 0f
            if (displacement == 0f || shader != null) {
                drawContent()
            } else {
                // Clip the already-shaped paragraph, never individual UTF-16 code units.
                repeat(4) { band ->
                    clipRect(top = size.height * band / 4, bottom = size.height * (band + 1) / 4) {
                        translate(left = if (band % 2 == 0) displacement else -displacement) { this@drawWithContent.drawContent() }
                    }
                }
            }
        },
    )
}

@RequiresApi(33)
private object GlitchShader {
    fun create() = android.graphics.RuntimeShader("""
        uniform shader content;
        uniform float2 resolution;
        uniform float displacement;
        half4 main(float2 p) {
            float band = floor(p.y / max(resolution.y / 4.0, 1.0));
            float offset = mod(band, 2.0) < 1.0 ? displacement : -displacement;
            return content.eval(float2(p.x + offset, p.y));
        }
    """.trimIndent())

    fun effect(shader: android.graphics.RuntimeShader, displacement: Float, width: Float, height: Float): androidx.compose.ui.graphics.RenderEffect {
        shader.setFloatUniform("resolution", width, height)
        shader.setFloatUniform("displacement", displacement * 3f)
        return android.graphics.RenderEffect.createRuntimeShaderEffect(shader, "content").asComposeRenderEffect()
    }
}

@Composable
fun RollingText(
    text: String,
    modifier: Modifier = Modifier,
    style: TextStyle = LocalTextStyle.current,
    color: Color = Color.Unspecified,
) {
    val enabled = rememberTerminalMotionEnabled()
    val position = remember { Animatable(0f) }
    var entries by remember { mutableStateOf(listOf(RollingEntry(0, text))) }
    var lastText by remember { mutableStateOf(text) }
    val measurer = rememberTextMeasurer(cacheSize = 8)
    val contentColor = LocalContentColor.current
    val resolvedColor = color.takeOrElse { style.color.takeOrElse { contentColor } }
    val resolvedStyle = LocalTextStyle.current.merge(style).copy(color = resolvedColor)
    val viewport = remember(resolvedStyle, LocalDensity.current) { RollingViewport() }
    LaunchedEffect(text, enabled) {
        if (!enabled) {
            position.snapTo(0f)
            entries = listOf(RollingEntry(0, text))
            lastText = text
        } else if (lastText != text) {
            // Retain both currently visible paragraphs, replacing only queued, unseen values.
            val next = TerminalMotionSpec.nextRollingSlot(position.value)
            val visible = TerminalMotionSpec.visibleRollingSlots(position.value)
            entries = entries.filter { it.slot in visible } + RollingEntry(next, text)
            lastText = text
            position.animateTo(next.toFloat(), tween(TerminalMotionSpec.ROLL_DURATION_MS, easing = FastOutSlowInEasing))
            entries = entries.takeLast(1)
        }
    }
    Layout(
        content = {
            // A single native Text owns accessibility and layout-result semantics.
            Text(text, style = resolvedStyle, modifier = Modifier.drawWithContent {})
        },
        modifier = modifier.clipToBounds().drawWithContent {
            drawContent()
            viewport.paragraphs.forEach { (entry, paragraph) ->
                drawText(paragraph, color = resolvedColor, topLeft = Offset(0f, (entry.slot - position.value) * size.height))
            }
        },
    ) { measurables, constraints ->
        val semanticsText = measurables.single().measure(constraints)
        val paragraphs = entries.map { it to measurer.measure(it.text, resolvedStyle, constraints = constraints) }
        if (viewport.constraints != constraints) {
            viewport.constraints = constraints
            viewport.width = 0
            viewport.height = 0
        }
        viewport.width = constraints.constrainWidth(maxOf(viewport.width, semanticsText.width, paragraphs.maxOfOrNull { it.second.size.width } ?: 0))
        viewport.height = constraints.constrainHeight(maxOf(viewport.height, semanticsText.height, paragraphs.maxOfOrNull { it.second.size.height } ?: 0))
        viewport.paragraphs = paragraphs
        layout(viewport.width, viewport.height) { semanticsText.place(0, 0) }
    }
}

private data class RollingEntry(val slot: Int, val text: String)

private class RollingViewport {
    var constraints: Constraints? = null
    var width = 0
    var height = 0
    var paragraphs = emptyList<Pair<RollingEntry, TextLayoutResult>>()
}

@Composable
fun RedactionReveal(
    text: String,
    modifier: Modifier = Modifier,
    style: TextStyle = LocalTextStyle.current,
    color: Color = Color.Unspecified,
    maxLines: Int = Int.MAX_VALUE,
    overflow: TextOverflow = TextOverflow.Clip,
) {
    val enabled = rememberTerminalMotionEnabled()
    val progress = rememberEntranceProgress(text, enabled, TerminalMotionSpec.REVEAL_DURATION_MS)
    var layout by remember(text) { mutableStateOf<TextLayoutResult?>(null) }
    val shade = MaterialTheme.colorScheme.onSurface
    Text(
        text = text,
        style = style,
        color = color,
        maxLines = maxLines,
        overflow = overflow,
        onTextLayout = { layout = it },
        modifier = modifier.drawWithContent {
            drawContent()
            val paragraph = layout
            if (enabled && progress.value < 1f && paragraph != null) {
                repeat(paragraph.lineCount) { line ->
                    val left = paragraph.getLineLeft(line)
                    val right = paragraph.getLineRight(line)
                    val fraction = TerminalMotionSpec.revealFraction(progress.value, line, paragraph.lineCount)
                    val start = left + (right - left) * fraction
                    drawRect(
                        color = shade,
                        topLeft = Offset(start, paragraph.getLineTop(line)),
                        size = Size((right - start).coerceAtLeast(0f), paragraph.getLineBottom(line) - paragraph.getLineTop(line)),
                    )
                }
            }
        },
    )
}

@Composable
fun RedactionReveal(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    val enabled = rememberTerminalMotionEnabled()
    val key = remember { Any() }
    val progress = rememberEntranceProgress(key, enabled, TerminalMotionSpec.REVEAL_DURATION_MS)
    val shade = MaterialTheme.colorScheme.onSurface
    Box(modifier.drawWithContent {
        drawContent()
        if (enabled && progress.value < 1f) {
            repeat(3) { band ->
                val width = size.width * (1f - TerminalMotionSpec.revealFraction(progress.value, band, 3))
                drawRect(
                    color = shade,
                    topLeft = Offset(size.width - width, size.height * band / 3),
                    size = Size(width, size.height / 3),
                )
            }
        }
    }) { content() }
}

@Composable
fun TerminalBootOverlay(onDismiss: () -> Unit, modifier: Modifier = Modifier) {
    val enabled = rememberTerminalMotionEnabled()
    val currentDismiss by rememberUpdatedState(onDismiss)
    val trace = remember { Animatable(if (enabled) 0f else 1f) }
    LaunchedEffect(enabled) {
        if (enabled) {
            trace.animateTo(1f, tween(TerminalMotionSpec.BOOT_DURATION_MS, easing = FastOutSlowInEasing))
            delay(240)
            currentDismiss()
        } else {
            trace.snapTo(1f)
        }
    }
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(
            usePlatformDefaultWidth = false,
            decorFitsSystemWindows = false,
            dismissOnBackPress = true,
            dismissOnClickOutside = false,
        ),
    ) {
        Box(
            modifier.fillMaxSize().testTag("terminal-boot-overlay")
                .background(TerminalPalette.Night).windowInsetsPadding(WindowInsets.safeDrawing).padding(24.dp),
        ) {
            Column(Modifier.align(Alignment.Center).widthIn(max = 460.dp).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Text("PRTS / 01", color = TerminalPalette.Signal, style = MaterialTheme.typography.labelLarge, fontFamily = FontFamily.Monospace)
                GlitchText("SKP-PRTS", style = MaterialTheme.typography.displayMedium, color = Color(0xFFEDF2EE))
                Canvas(Modifier.fillMaxWidth().height(2.dp)) {
                    drawLine(Color(0xFF39473D), Offset.Zero, Offset(size.width, 0f), strokeWidth = size.height)
                    drawLine(TerminalPalette.Signal, Offset.Zero, Offset(size.width * trace.value, 0f), strokeWidth = size.height)
                }
                RollingText("SYSTEM / INTERFACE", style = MaterialTheme.typography.bodySmall.copy(fontFamily = FontFamily.Monospace), color = Color(0xFFAEBAB2))
            }
            TextButton(onClick = onDismiss, modifier = Modifier.align(Alignment.BottomEnd)) {
                Text("进入", color = TerminalPalette.Signal)
                Spacer(Modifier.padding(4.dp))
                Icon(Icons.AutoMirrored.Outlined.ArrowForward, contentDescription = null, tint = TerminalPalette.Signal)
            }
        }
    }
}
