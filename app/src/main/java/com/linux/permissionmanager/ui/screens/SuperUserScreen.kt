package com.linux.permissionmanager.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import com.linux.permissionmanager.ui.rhine.RhineIcons
import com.linux.permissionmanager.ui.rhine.RhineButton as Button
import com.linux.permissionmanager.ui.rhine.RhineTextButton as TextButton
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.linux.permissionmanager.data.InstalledApp
import com.linux.permissionmanager.data.SuGrant
import com.linux.permissionmanager.ui.SuperUserUiState
import com.linux.permissionmanager.ui.components.*
import com.linux.permissionmanager.ui.motion.RollingText
import com.linux.permissionmanager.ui.theme.AppearanceTokens
import com.linux.permissionmanager.ui.theme.LocalContentDrawsBehindNavigation

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SuperUserScreen(
    state: SuperUserUiState,
    bottomPadding: PaddingValues,
    onRefresh: () -> Unit,
    onSearch: (String) -> Unit,
    onShowPicker: () -> Unit,
    onHidePicker: () -> Unit,
    onPickerSearch: (String) -> Unit,
    onFilterSystem: (Boolean) -> Unit,
    onFilterThirdParty: (Boolean) -> Unit,
    onAdd: (InstalledApp) -> Unit,
    onAddAdb: () -> Unit,
    onRemove: (SuGrant) -> Unit,
    onClear: () -> Unit,
) {
    var menuExpanded by remember { mutableStateOf(false) }
    var pendingRemove by remember { mutableStateOf<SuGrant?>(null) }
    var clearConfirm by remember { mutableStateOf(false) }
    val scrollBehavior = TopAppBarDefaults.exitUntilCollapsedScrollBehavior()
    val drawsBehindNavigation = LocalContentDrawsBehindNavigation.current
    val navigationClearance = bottomPadding.calculateBottomPadding()

    Scaffold(
        topBar = {
            TerminalTopBar(
                title = "授权",
                code = "02 / ACCESS CONTROL",
                actions = {
                    IconButton(onClick = onRefresh) { Icon(RhineIcons.Refresh, "刷新") }
                    Box {
                        IconButton(onClick = { menuExpanded = true }) { Icon(RhineIcons.Add, "添加") }
                        DropdownMenu(expanded = menuExpanded, onDismissRequest = { menuExpanded = false }) {
                            DropdownMenuItem(
                                text = { Text("添加 SU 授权") },
                                leadingIcon = { Icon(RhineIcons.Apps, null) },
                                onClick = { menuExpanded = false; onShowPicker() },
                            )
                            DropdownMenuItem(
                                text = { Text("添加 ADB 授权") },
                                leadingIcon = { Icon(RhineIcons.Terminal, null) },
                                onClick = { menuExpanded = false; onAddAdb() },
                            )
                            HorizontalDivider()
                            DropdownMenuItem(
                                text = { Text("清空授权", color = MaterialTheme.colorScheme.error) },
                                leadingIcon = { Icon(RhineIcons.DeleteSweep, null, tint = MaterialTheme.colorScheme.error) },
                                onClick = { menuExpanded = false; clearConfirm = true },
                            )
                        }
                    }
                },
                scrollBehavior = scrollBehavior,
            )
        },
        containerColor = MaterialTheme.colorScheme.surfaceContainer.copy(alpha = AppearanceTokens.pageSurfaceAlpha),
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(
                    top = innerPadding.calculateTopPadding(),
                    bottom = if (drawsBehindNavigation) 0.dp else navigationClearance,
                )
                .nestedScroll(scrollBehavior.nestedScrollConnection),
            contentPadding = PaddingValues(
                start = 16.dp, end = 16.dp,
                top = 8.dp,
                bottom = 20.dp + if (drawsBehindNavigation) navigationClearance else 0.dp,
            ),
            verticalArrangement = Arrangement.spacedBy(0.dp),
        ) {
            item {
                Row(
                    Modifier.fillMaxWidth().padding(vertical = 16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Icon(RhineIcons.VerifiedUser, null, tint = MaterialTheme.colorScheme.primary)
                    Text("SU 授权记录", style = MaterialTheme.typography.labelLarge, modifier = Modifier.weight(1f))
                    RollingText(
                        "${state.grants.size}",
                        style = MaterialTheme.typography.headlineSmall.copy(fontFamily = FontFamily.Monospace),
                    )
                }
                HorizontalDivider()
            }
            item {
                OutlinedTextField(
                    value = state.query,
                    onValueChange = onSearch,
                    modifier = Modifier.fillMaxWidth().padding(vertical = 16.dp),
                    leadingIcon = { Icon(RhineIcons.Search, null) },
                    trailingIcon = if (state.query.isNotBlank()) {
                        { IconButton(onClick = { onSearch("") }) { Icon(RhineIcons.Close, "清除") } }
                    } else null,
                    placeholder = { Text("搜索应用或包名") },
                    singleLine = true,
                    shape = MaterialTheme.shapes.small,
                )
            }
            if (state.loading) item { LoadingState("正在读取授权列表…") }
            state.error?.let { item { ErrorState(it, onRefresh) } }
            if (!state.loading && state.error == null && state.filteredGrants.isEmpty()) {
                item { EmptyState(if (state.query.isBlank()) "暂无 SU 授权" else "没有匹配的授权", if (state.query.isBlank()) "尚无应用获得 SU 权限" else "未找到符合当前搜索条件的记录", icon = RhineIcons.Shield) }
            }
            items(state.filteredGrants, key = { it.packageName }) { grant ->
                Column(Modifier.fillMaxWidth()) {
                    Row(
                        Modifier.fillMaxWidth().padding(vertical = 14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(14.dp),
                    ) {
                        AppIcon(grant.icon, grant.label, Modifier.size(44.dp))
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(grant.label.ifBlank { grant.packageName }, style = MaterialTheme.typography.titleMedium, maxLines = 2, overflow = TextOverflow.Ellipsis)
                            Text(grant.packageName, style = MaterialTheme.typography.bodySmall, fontFamily = FontFamily.Monospace, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 2, overflow = TextOverflow.Ellipsis)
                            Text("SU / 已授权", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                        }
                        IconButton(onClick = { pendingRemove = grant }) { Icon(RhineIcons.DeleteOutline, "移除", tint = MaterialTheme.colorScheme.error) }
                    }
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                }
            }
        }
    }

    if (state.pickerVisible) {
        AppPickerDialog(
            state = state,
            onDismiss = onHidePicker,
            onSearch = onPickerSearch,
            onFilterSystem = onFilterSystem,
            onFilterThirdParty = onFilterThirdParty,
            onSelect = onAdd,
        )
    }
    pendingRemove?.let { grant ->
        AlertDialog(
            onDismissRequest = { pendingRemove = null },
            title = { Text("移除授权？") },
            text = { Text("确定移除 ${grant.label.ifBlank { grant.packageName }} 的 SU 授权吗？") },
            confirmButton = {
                Button(
                    onClick = { pendingRemove = null; onRemove(grant) },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                ) { Text("移除") }
            },
            dismissButton = { TextButton(onClick = { pendingRemove = null }) { Text("取消") } },
        )
    }
    if (clearConfirm) {
        AlertDialog(
            onDismissRequest = { clearConfirm = false },
            title = { Text("清空所有授权？") },
            text = { Text("所有应用的 SU 授权都将被移除。") },
            confirmButton = {
                Button(
                    onClick = { clearConfirm = false; onClear() },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                ) { Text("清空") }
            },
            dismissButton = { TextButton(onClick = { clearConfirm = false }) { Text("取消") } },
        )
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun AppPickerDialog(
    state: SuperUserUiState,
    onDismiss: () -> Unit,
    onSearch: (String) -> Unit,
    onFilterSystem: (Boolean) -> Unit,
    onFilterThirdParty: (Boolean) -> Unit,
    onSelect: (InstalledApp) -> Unit,
) {
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(
            modifier = Modifier.widthIn(max = 720.dp).fillMaxWidth(.94f).fillMaxHeight(.90f),
            shape = MaterialTheme.shapes.small,
            color = MaterialTheme.colorScheme.surface,
        ) {
            Column(Modifier.fillMaxSize().padding(18.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("ACCESS / APPLICATIONS", style = MaterialTheme.typography.labelSmall, fontFamily = FontFamily.Monospace, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text("选择应用", style = MaterialTheme.typography.headlineSmall)
                    }
                    IconButton(onClick = onDismiss) { Icon(RhineIcons.Close, "关闭") }
                }
                Spacer(Modifier.height(12.dp))
                OutlinedTextField(
                    value = state.pickerQuery,
                    onValueChange = onSearch,
                    modifier = Modifier.fillMaxWidth(),
                    leadingIcon = { Icon(RhineIcons.Search, null) },
                    placeholder = { Text("搜索应用或包名") },
                    singleLine = true,
                    shape = MaterialTheme.shapes.small,
                )
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(vertical = 12.dp)) {
                    FilterChip(
                        selected = state.showThirdPartyApps,
                        onClick = { onFilterThirdParty(!state.showThirdPartyApps) },
                        label = { Text("第三方应用") },
                        leadingIcon = if (state.showThirdPartyApps) {{ Icon(RhineIcons.Check, null, Modifier.size(18.dp)) }} else null,
                    )
                    FilterChip(
                        selected = state.showSystemApps,
                        onClick = { onFilterSystem(!state.showSystemApps) },
                        label = { Text("系统应用") },
                        leadingIcon = if (state.showSystemApps) {{ Icon(RhineIcons.Check, null, Modifier.size(18.dp)) }} else null,
                    )
                }
                HorizontalDivider()
                LazyColumn(Modifier.weight(1f)) {
                    if (state.filteredApps.isEmpty()) {
                        item { EmptyState("没有匹配的应用", "当前筛选结果为空", icon = RhineIcons.SearchOff) }
                    }
                    items(state.filteredApps, key = { it.packageName }) { app ->
                        Surface(onClick = { onSelect(app) }, color = MaterialTheme.colorScheme.surface) {
                            Row(Modifier.fillMaxWidth().padding(vertical = 12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                                AppIcon(app.icon, app.label, Modifier.size(44.dp))
                                Column(Modifier.weight(1f)) {
                                    Text(app.label, maxLines = 2, overflow = TextOverflow.Ellipsis)
                                    Text(app.packageName, style = MaterialTheme.typography.bodySmall, fontFamily = FontFamily.Monospace, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 2, overflow = TextOverflow.Ellipsis)
                                }
                                Icon(RhineIcons.Add, "授权此应用", Modifier.size(20.dp), tint = MaterialTheme.colorScheme.primary)
                            }
                        }
                        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                    }
                }
            }
        }
    }
}
