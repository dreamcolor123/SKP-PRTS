package com.linux.permissionmanager.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import com.linux.permissionmanager.ui.theme.LocalTerminalAppearance
import com.linux.permissionmanager.ui.motion.rememberTerminalMotionEnabled

@Composable
fun TerminalNavigation(
    items: List<GlassNavigationItem>,
    selectedIndex: Int,
    onSelect: (Int) -> Unit,
    vertical: Boolean = false,
) {
    val scheme = MaterialTheme.colorScheme
    Surface(color = scheme.surface.copy(alpha = LocalTerminalAppearance.current.chromeSurfaceAlpha)) {
        if (vertical) {
            Column(
                Modifier.width(88.dp).fillMaxHeight().windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Vertical))
                    .verticalScroll(rememberScrollState()).selectableGroup(),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text("PRTS", Modifier.padding(vertical = 24.dp), style = MaterialTheme.typography.titleSmall, fontFamily = FontFamily.Monospace)
                HorizontalDivider(Modifier.padding(horizontal = 16.dp))
                Spacer(Modifier.height(20.dp))
                items.forEachIndexed { index, item ->
                    TerminalNavItem(item, index, selectedIndex == index, { onSelect(index) }, Modifier.fillMaxWidth())
                }
                Spacer(Modifier.height(20.dp))
            }
        } else {
            Column(Modifier.navigationBarsPadding()) {
                HorizontalDivider(color = scheme.outlineVariant)
                Row(Modifier.fillMaxWidth().selectableGroup()) {
                    items.forEachIndexed { index, item ->
                        TerminalNavItem(item, index, selectedIndex == index, { onSelect(index) }, Modifier.weight(1f))
                    }
                }
            }
        }
    }
}

@Composable
private fun TerminalNavItem(item: GlassNavigationItem, index: Int, selected: Boolean, onClick: () -> Unit, modifier: Modifier) {
    val scheme = MaterialTheme.colorScheme
    val progress by animateFloatAsState(if (selected) 1f else 0f, tween(if (rememberTerminalMotionEnabled()) 180 else 0), label = "navigation-selection")
    Column(
        modifier.heightIn(min = 48.dp).selectable(selected = selected, onClick = onClick, role = Role.Tab).padding(horizontal = 6.dp, vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Box(Modifier.width(28.dp).height(2.dp).background(scheme.primary.copy(alpha = progress)))
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            Icon(if (selected) item.selectedIcon else item.icon, null, Modifier.size(21.dp), tint = if (selected) scheme.onSurface else scheme.onSurfaceVariant)
            Text("0${index + 1}", style = MaterialTheme.typography.labelSmall, fontFamily = FontFamily.Monospace, color = scheme.onSurfaceVariant)
        }
        Text(item.label, style = MaterialTheme.typography.labelMedium, color = if (selected) scheme.onSurface else scheme.onSurfaceVariant)
    }
}
