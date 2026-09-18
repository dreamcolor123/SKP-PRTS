@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package com.linux.permissionmanager.ui.components

import android.graphics.drawable.Drawable
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.Inbox
import androidx.compose.material.icons.outlined.ContentCopy
import androidx.compose.material.icons.outlined.DeleteOutline
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.graphics.drawable.toBitmap
import com.linux.permissionmanager.utils.FileUtils
import com.linux.permissionmanager.ui.theme.LocalControlSurfaceAlpha
import com.linux.permissionmanager.ui.theme.LocalChromeSurfaceAlpha
import com.linux.permissionmanager.ui.theme.TerminalPalette
import com.linux.permissionmanager.ui.motion.GlitchText
import com.linux.permissionmanager.ui.motion.rememberTerminalMotionEnabled

@Composable
fun TonalCard(
    modifier: Modifier = Modifier,
    color: Color = MaterialTheme.colorScheme.surfaceContainerLow,
    enabled: Boolean = true,
    onClick: (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val line = MaterialTheme.colorScheme.outlineVariant
    Column(
        modifier = modifier
            .background(color.copy(alpha = LocalControlSurfaceAlpha.current))
            .drawBehind { drawLine(line, Offset(0f, size.height), Offset(size.width, size.height), 1.dp.toPx()) }
            .then(if (onClick != null) Modifier.clickable(enabled = enabled, onClick = onClick) else Modifier),
        content = content,
    )
}

@Composable
fun StatusTag(
    text: String,
    containerColor: Color = MaterialTheme.colorScheme.primary,
    contentColor: Color = MaterialTheme.colorScheme.onPrimary,
) {
    Surface(color = containerColor, contentColor = contentColor, shape = RoundedCornerShape(2.dp)) {
        Text(
            text = text,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

@Composable
fun SectionTitle(text: String, modifier: Modifier = Modifier) {
    Row(modifier.fillMaxWidth().padding(vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(width = 3.dp, height = 14.dp).background(TerminalPalette.Signal))
        Text(
            text = text,
            modifier = Modifier.padding(horizontal = 10.dp).weight(1f),
            color = MaterialTheme.colorScheme.onSurface,
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.SemiBold,
        )
        Box(Modifier.width(24.dp).height(1.dp).background(MaterialTheme.colorScheme.outlineVariant))
    }
}

@Composable
fun SegmentedGroup(
    title: String,
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(modifier) {
        SectionTitle(title)
        Column(content = content)
    }
}

@Composable
fun SegmentedItem(
    title: String,
    summary: String? = null,
    icon: ImageVector? = null,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    onClick: (() -> Unit)? = null,
    trailing: (@Composable () -> Unit)? = null,
) {
    val line = MaterialTheme.colorScheme.outlineVariant
    Surface(
        modifier = modifier
            .fillMaxWidth()
            .drawBehind { drawLine(line, Offset(0f, size.height), Offset(size.width, size.height), 1.dp.toPx()) }
            .then(if (onClick != null) Modifier.clickable(enabled = enabled, onClick = onClick) else Modifier),
        color = MaterialTheme.colorScheme.surfaceContainerLow.copy(alpha = LocalControlSurfaceAlpha.current),
        contentColor = if (enabled) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurface.copy(alpha = .38f),
        shape = RoundedCornerShape(0.dp),
    ) {
        Row(
            modifier = Modifier.heightIn(min = 64.dp).padding(horizontal = 12.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (icon != null) Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(22.dp))
            Column(Modifier.weight(1f)) {
                Text(title, style = MaterialTheme.typography.bodyLarge)
                if (!summary.isNullOrBlank()) {
                    Spacer(Modifier.height(3.dp))
                    Text(summary, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            trailing?.invoke()
        }
    }
}

@Composable
fun SegmentedSwitchItem(
    title: String,
    summary: String,
    icon: ImageVector,
    checked: Boolean,
    enabled: Boolean,
    onCheckedChange: (Boolean) -> Unit,
) {
    SegmentedItem(
        title = title,
        summary = summary,
        icon = icon,
        enabled = enabled,
        onClick = { onCheckedChange(!checked) },
        trailing = { Switch(checked = checked, onCheckedChange = null, enabled = enabled) },
    )
}

@Composable
fun LoadingState(label: String, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.fillMaxWidth().padding(40.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        if (rememberTerminalMotionEnabled()) {
            LinearProgressIndicator(Modifier.width(112.dp).height(3.dp), color = MaterialTheme.colorScheme.onSurface, trackColor = MaterialTheme.colorScheme.primaryContainer)
        } else {
            Box(Modifier.width(36.dp).height(3.dp).background(TerminalPalette.Signal))
        }
        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
fun EmptyState(
    title: String,
    summary: String,
    modifier: Modifier = Modifier,
    icon: ImageVector = Icons.Outlined.Inbox,
) {
        Column(
            modifier = modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 36.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Icon(icon, null, modifier = Modifier.size(36.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(title, style = MaterialTheme.typography.titleMedium)
            Text(summary, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
}

@Composable
fun ErrorState(message: String, onRetry: () -> Unit, modifier: Modifier = Modifier) {
    TonalCard(modifier.fillMaxWidth(), color = MaterialTheme.colorScheme.errorContainer) {
        Column(Modifier.fillMaxWidth().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(Icons.Outlined.ErrorOutline, null, tint = MaterialTheme.colorScheme.onErrorContainer)
            Spacer(Modifier.height(10.dp))
            Text(message, color = MaterialTheme.colorScheme.onErrorContainer)
            Spacer(Modifier.height(14.dp))
            FilledTonalButton(onClick = onRetry) { Text("重试") }
        }
    }
}

@Composable
fun AppIcon(drawable: Drawable?, contentDescription: String?, modifier: Modifier = Modifier) {
    if (drawable == null) {
        Box(modifier.clip(MaterialTheme.shapes.medium).background(MaterialTheme.colorScheme.secondaryContainer))
    } else {
        val bitmap = remember(drawable) { drawable.toBitmap(96, 96).asImageBitmap() }
        androidx.compose.foundation.Image(
            bitmap = bitmap,
            contentDescription = contentDescription,
            modifier = modifier.clip(MaterialTheme.shapes.medium),
            contentScale = ContentScale.Crop,
        )
    }
}

@Composable
fun ConsoleCard(
    text: String,
    onCopy: () -> Unit,
    onClear: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        color = TerminalPalette.Night,
        contentColor = Color(0xFFEDF2EE),
        shape = RoundedCornerShape(4.dp),
    ) {
        Column(Modifier.fillMaxWidth().padding(16.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(5.dp).background(TerminalPalette.Signal))
                Text("OUTPUT", Modifier.padding(start = 8.dp).weight(1f), style = MaterialTheme.typography.labelSmall, fontFamily = FontFamily.Monospace, color = Color(0xFFAEBAB2))
                ConsoleAction("复制", Icons.Outlined.ContentCopy, onCopy, text.isNotBlank())
                ConsoleAction("清空", Icons.Outlined.DeleteOutline, onClear, text.isNotBlank())
            }
            HorizontalDivider(color = Color(0xFF39473D))
            Spacer(Modifier.height(12.dp))
            SelectionContainer { Text(
                text = text.ifBlank { "命令输出将显示在这里" },
                style = MaterialTheme.typography.bodySmall,
                fontFamily = FontFamily.Monospace,
                minLines = 5,
            ) }
        }
    }
}

@Composable
private fun ConsoleAction(label: String, icon: ImageVector, onClick: () -> Unit, enabled: Boolean) {
    TooltipBox(positionProvider = TooltipDefaults.rememberPlainTooltipPositionProvider(), tooltip = { PlainTooltip { Text(label) } }, state = rememberTooltipState()) {
        IconButton(onClick = onClick, enabled = enabled) {
            Icon(icon, contentDescription = label, tint = if (enabled) Color(0xFFEDF2EE) else Color(0xFF7E8C83))
        }
    }
}

@Composable
fun TerminalTopBar(
    title: String,
    code: String,
    actions: @Composable RowScope.() -> Unit = {},
    navigationIcon: @Composable () -> Unit = {},
    scrollBehavior: TopAppBarScrollBehavior? = null,
) {
    val line = MaterialTheme.colorScheme.outlineVariant
    // Variable-height titles cannot use the fixed-height Material collapse range.
    SideEffect {
        scrollBehavior?.state?.heightOffsetLimit = 0f
        scrollBehavior?.state?.heightOffset = 0f
    }
    Surface(
        modifier = Modifier.fillMaxWidth().testTag("terminal-top-bar")
            .drawBehind { drawLine(line, Offset(0f, size.height), Offset(size.width, size.height), 1.dp.toPx()) },
        color = MaterialTheme.colorScheme.background.copy(alpha = LocalChromeSurfaceAlpha.current),
    ) {
        Row(
            Modifier.windowInsetsPadding(TopAppBarDefaults.windowInsets)
                .heightIn(min = 78.dp).padding(horizontal = 4.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box { navigationIcon() }
            Column(Modifier.weight(1f).padding(horizontal = 12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(code, style = MaterialTheme.typography.labelSmall, fontFamily = FontFamily.Monospace,
                    color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                GlitchText(title, style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.onSurface)
            }
            Row(verticalAlignment = Alignment.CenterVertically, content = actions)
        }
    }
}

fun formatBytes(value: Long): String = FileUtils.formatFileSize(value.coerceAtLeast(0))
