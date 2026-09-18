package com.linux.permissionmanager.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.text.font.FontFamily
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.linux.permissionmanager.data.EnvironmentState
import com.linux.permissionmanager.ui.HomeUiState
import com.linux.permissionmanager.ui.components.*
import com.linux.permissionmanager.ui.theme.LocalSemanticColors
import com.linux.permissionmanager.ui.theme.AppearanceTokens
import com.linux.permissionmanager.ui.theme.LocalControlSurfaceAlpha
import com.linux.permissionmanager.ui.theme.LocalChromeSurfaceAlpha
import com.linux.permissionmanager.ui.theme.LocalContentDrawsBehindNavigation
import com.linux.permissionmanager.ui.theme.LocalTerminalAppearance
import com.linux.permissionmanager.ui.motion.LocalMotionActive
import com.linux.permissionmanager.ui.motion.RollingText
import com.linux.permissionmanager.ui.motion.rememberTerminalMotionEnabled
import com.linux.permissionmanager.ui.scene.TerminalCoreScene

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    state: HomeUiState,
    bottomPadding: PaddingValues,
    onConfigureRoot: () -> Unit,
    onRefresh: () -> Unit,
    onInstall: () -> Unit,
    onUninstall: () -> Unit,
    onTestRoot: () -> Unit,
    onRunCommand: (String) -> Unit,
    onCopyConsole: () -> Unit,
    onClearConsole: () -> Unit,
    onReboot: (String?, Boolean) -> Unit,
    onDismissCveSoftRebootPrompt: (refreshStatus: Boolean) -> Unit,
) {
    var commandDialog by remember { mutableStateOf(false) }
    var installDialog by remember { mutableStateOf(false) }
    var uninstallDialog by remember { mutableStateOf(false) }
    var rebootDialog by remember { mutableStateOf(false) }
    var pendingReboot by remember { mutableStateOf<RebootOption?>(null) }
    val scrollBehavior = TopAppBarDefaults.exitUntilCollapsedScrollBehavior()
    val semantic = LocalSemanticColors.current
    val drawsBehindNavigation = LocalContentDrawsBehindNavigation.current
    val navigationClearance = bottomPadding.calculateBottomPadding()
    val context = LocalContext.current
    val appearance = LocalTerminalAppearance.current
    val animationsAllowed = rememberTerminalMotionEnabled()
    val lifecycleState by LocalLifecycleOwner.current.lifecycle.currentStateFlow.collectAsStateWithLifecycle()
    val motionActive = LocalMotionActive.current && lifecycleState.isAtLeast(Lifecycle.State.RESUMED) &&
        !commandDialog && !installDialog && !uninstallDialog && !rebootDialog && pendingReboot == null && !state.showCveSoftRebootPrompt
    val applicationLabel = remember(context.packageName) {
        runCatching { context.packageManager.getApplicationLabel(context.applicationInfo).toString() }
            .getOrDefault("SKP-PRTS")
    }

    Scaffold(
        topBar = {
            TerminalTopBar(
                title = applicationLabel,
                code = "01 / SYSTEM OVERVIEW",
                    actions = {
                        IconButton(onClick = onRefresh) { Icon(Icons.Outlined.Refresh, "刷新") }
                        IconButton(onClick = { rebootDialog = true }) { Icon(Icons.Outlined.PowerSettingsNew, "重启选项") }
                        IconButton(onClick = onConfigureRoot) { Icon(Icons.Outlined.Key, "Root Key") }
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
                start = 16.dp,
                end = 16.dp,
                top = 8.dp,
                bottom = 20.dp + if (drawsBehindNavigation) navigationClearance else 0.dp,
            ),
            verticalArrangement = Arrangement.spacedBy(13.dp),
        ) {
            if (appearance.sceneEnabled) {
                item(key = "core-scene") {
                    TerminalCoreScene(
                        modifier = Modifier.fillMaxWidth().height(228.dp),
                        status = if (state.loading) "loading" else when (state.environment.state) {
                            EnvironmentState.RUNNING -> "running"
                            EnvironmentState.OUTDATED -> "outdated"
                            EnvironmentState.PENDING_REBOOT -> "pending"
                            EnvironmentState.NOT_INSTALLED -> "not_installed"
                            EnvironmentState.FAULT -> "fault"
                            else -> "unknown"
                        },
                        quality = appearance.sceneQuality.name.lowercase(),
                        dark = MaterialTheme.colorScheme.background.luminance() < 0.5f,
                        active = motionActive,
                        reducedMotion = !animationsAllowed,
                    )
                }
            }
            if (state.loading) item { LoadingState("正在检测 SKRoot 环境…") }
            state.error?.let { message -> item { ErrorState(message, onRefresh) } }
            if (!state.loading) {
                item {
                    val (icon, title, summary) = when (state.environment.state) {
                        EnvironmentState.RUNNING -> StatusVisual(
                            Icons.Outlined.CheckCircle, "正常运行",
                            "SKRoot 环境已就绪",
                        )
                        EnvironmentState.OUTDATED -> StatusVisual(
                            Icons.Outlined.Update, "核心版本过低",
                            "当前核心低于 SDK 版本，请更新环境",
                        )
                        EnvironmentState.PENDING_REBOOT -> StatusVisual(
                            Icons.Outlined.RestartAlt, "等待重启",
                            "环境更新已写入，重启设备后生效",
                        )
                        EnvironmentState.NOT_INSTALLED -> StatusVisual(
                            Icons.Outlined.WarningAmber, "环境未安装",
                            "安装后即可管理授权与模块",
                        )
                        EnvironmentState.FAULT -> StatusVisual(
                            Icons.Outlined.ErrorOutline, "运行异常",
                            "请检查日志或重新安装环境",
                        )
                        else -> StatusVisual(
                            Icons.Outlined.HelpOutline, "状态未知",
                            state.environment.rawState.ifBlank { "未返回有效环境状态" },
                        )
                    }
                    val showEnvironmentActionsInStatus = state.environment.state != EnvironmentState.RUNNING
                    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        HorizontalDivider(color = MaterialTheme.colorScheme.onSurface, thickness = 2.dp)
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("CORE / STATUS", style = MaterialTheme.typography.labelSmall, fontFamily = FontFamily.Monospace)
                            Text(if (state.environment.hotload) "HOTLOAD" else "BOOT", style = MaterialTheme.typography.labelSmall, fontFamily = FontFamily.Monospace)
                        }
                        Column(Modifier.padding(vertical = 4.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                                Icon(icon, null, modifier = Modifier.size(28.dp), tint = when (state.environment.state) {
                                    EnvironmentState.RUNNING -> semantic.success
                                    EnvironmentState.FAULT -> MaterialTheme.colorScheme.error
                                    else -> semantic.warning
                                })
                                Column(Modifier.weight(1f)) {
                                    RollingText(title, style = MaterialTheme.typography.headlineSmall)
                                    Text(summary, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                                StatusTag(
                                    if (state.environment.hotload) "热启动" else "Boot",
                                    containerColor = MaterialTheme.colorScheme.secondaryContainer,
                                    contentColor = MaterialTheme.colorScheme.onSecondaryContainer,
                                )
                            }
                            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                StatusTag(
                                    "核心 ${state.environment.installedVersion}",
                                    MaterialTheme.colorScheme.surfaceVariant,
                                    MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                                StatusTag(
                                    "SDK ${state.environment.sdkVersion}",
                                    MaterialTheme.colorScheme.surfaceVariant,
                                    MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                            if (showEnvironmentActionsInStatus) {
                                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                    Button(
                                        onClick = { installDialog = true },
                                        enabled = state.busyAction == null && state.environment.state != EnvironmentState.PENDING_REBOOT,
                                        modifier = Modifier.weight(1f).heightIn(min = 56.dp),
                                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 12.dp),
                                    ) {
                                        Icon(Icons.Outlined.SystemUpdateAlt, null, Modifier.size(18.dp))
                                        Spacer(Modifier.width(6.dp))
                                        Text(
                                            when (state.environment.state) {
                                                EnvironmentState.OUTDATED -> "更新环境"
                                                EnvironmentState.PENDING_REBOOT -> "等待重启"
                                                else -> "安装环境"
                                            },
                                        )
                                    }
                                    OutlinedButton(
                                        onClick = { uninstallDialog = true },
                                        enabled = state.busyAction == null,
                                        modifier = Modifier.weight(1f).heightIn(min = 56.dp),
                                        colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error),
                                        border = BorderStroke(1.dp, MaterialTheme.colorScheme.error.copy(alpha = .55f)),
                                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 12.dp),
                                    ) {
                                        Icon(Icons.Outlined.DeleteOutline, null, Modifier.size(18.dp))
                                        Spacer(Modifier.width(6.dp))
                                        Text("卸载环境")
                                    }
                                }
                            }
                        }
                    }
                }

                item { SectionTitle("01 / 系统状态") }
                item {
                    val rows = listOf(
                        SystemRow(Icons.Outlined.Security, "SELinux", selinuxText(state.system.selinux), state.system.selinux != 0),
                        SystemRow(Icons.Outlined.FilterAlt, "Seccomp", seccompText(state.system.seccomp), state.system.seccomp == 2),
                        SystemRow(Icons.Outlined.DeveloperMode, "ADB", if (state.system.adbEnabled) "已开启" else "未开启", !state.system.adbEnabled),
                        SystemRow(Icons.Outlined.VerifiedUser, "OPlus 接口", if (state.system.oplusIntercepted) "已拦截" else "无需拦截", true),
                    )
                    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        rows.forEach { row ->
                            SegmentedItem(
                                title = row.title,
                                summary = row.value,
                                icon = row.icon,
                                trailing = {
                                    Icon(
                                        if (row.good) Icons.Outlined.CheckCircle else Icons.Outlined.WarningAmber,
                                        null,
                                        tint = if (row.good) MaterialTheme.colorScheme.primary else semantic.warning,
                                    )
                                },
                            )
                        }
                    }
                }

                item { SectionTitle("02 / 基础操作") }
                if (state.environment.state == EnvironmentState.RUNNING) {
                    item {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            TonalCard(
                                modifier = Modifier.weight(1f),
                                enabled = state.busyAction == null,
                                onClick = { installDialog = true },
                            ) {
                                QuickAction(Icons.Outlined.SystemUpdateAlt, "安装环境", "重新安装或更新")
                            }
                            TonalCard(
                                modifier = Modifier.weight(1f),
                                enabled = state.busyAction == null,
                                onClick = { uninstallDialog = true },
                            ) {
                                QuickAction(Icons.Outlined.DeleteOutline, "卸载环境", "移除环境与模块")
                            }
                        }
                    }
                }
                item {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        TonalCard(Modifier.weight(1f), onClick = onTestRoot) {
                            QuickAction(Icons.Outlined.AdminPanelSettings, "测试 Root", "验证当前 Key")
                        }
                        TonalCard(Modifier.weight(1f), onClick = { commandDialog = true }) {
                            QuickAction(Icons.Outlined.Terminal, "Root 命令", "执行自定义命令")
                        }
                    }
                }
                item { SectionTitle("03 / 输出信息") }
                item { ConsoleCard(state.console, onCopyConsole, onClearConsole) }
            }
        }
    }

    if (commandDialog) {
        var command by remember { mutableStateOf("id") }
        AlertDialog(
            onDismissRequest = { commandDialog = false },
            icon = { Icon(Icons.Outlined.Terminal, null) },
            title = { Text("执行 Root 命令") },
            text = {
                OutlinedTextField(
                    value = command,
                    onValueChange = { command = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("命令") },
                    singleLine = true,
                )
            },
            confirmButton = { Button(onClick = { commandDialog = false; onRunCommand(command) }) { Text("执行") } },
            dismissButton = { TextButton(onClick = { commandDialog = false }) { Text("取消") } },
        )
    }
    if (installDialog) {
        val updating = state.environment.state == EnvironmentState.OUTDATED
        val reinstalling = state.environment.state == EnvironmentState.RUNNING ||
            state.environment.state == EnvironmentState.FAULT
        AlertDialog(
            onDismissRequest = { installDialog = false },
            icon = {
                Icon(
                    if (updating) Icons.Outlined.SystemUpdateAlt else Icons.Outlined.InstallMobile,
                    null,
                )
            },
            title = {
                Text(
                    when {
                        updating -> "更新 SKRoot 环境？"
                        reinstalling -> "重新安装 SKRoot 环境？"
                        else -> "安装 SKRoot 环境？"
                    },
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        when {
                            updating -> "将使用当前 SDK 更新核心环境，写入完成后需要重启设备才能生效。"
                            reinstalling -> "将重新写入核心环境。请确认 Root Key 和当前模式配置正确。"
                            else -> "将向设备写入 SKRoot 核心环境。请确认 Root Key 和当前模式配置正确。"
                        },
                    )
                    Text(
                        "当前安装模式：${installModeLabel(state.environment.hotload, state.environment.hotloadMethod)}",
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
            },
            confirmButton = {
                Button(onClick = { installDialog = false; onInstall() }) {
                    Text(if (updating) "确认更新" else "确认安装")
                }
            },
            dismissButton = { TextButton(onClick = { installDialog = false }) { Text("取消") } },
        )
    }
    if (uninstallDialog) {
        AlertDialog(
            onDismissRequest = { uninstallDialog = false },
            icon = { Icon(Icons.Outlined.DeleteForever, null) },
            title = { Text("卸载 SKRoot 环境？") },
            text = { Text("这会同时清空 SU 授权列表并删除已安装模块。") },
            confirmButton = {
                Button(
                    onClick = { uninstallDialog = false; onUninstall() },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                ) { Text("确认卸载") }
            },
            dismissButton = { TextButton(onClick = { uninstallDialog = false }) { Text("取消") } },
        )
    }
    if (state.showCveSoftRebootPrompt) {
        AlertDialog(
            onDismissRequest = { onDismissCveSoftRebootPrompt(true) },
            icon = { Icon(Icons.Outlined.CheckCircle, null) },
            title = { Text("环境安装完成") },
            text = {
                Text(
                    "当前 CVE 热启动环境已即时生效，模块也已激活。一般无需软重启；仅在使用改机型等特殊模块时再执行软重启。",
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        onDismissCveSoftRebootPrompt(false)
                        onReboot(null, true)
                    },
                ) { Text("软重启") }
            },
            dismissButton = {
                TextButton(onClick = { onDismissCveSoftRebootPrompt(true) }) { Text("不需要") }
            },
        )
    }
    if (rebootDialog) {
        RebootOptionsDialog(
            onDismiss = { rebootDialog = false },
            onSelect = {
                rebootDialog = false
                pendingReboot = it
            },
        )
    }
    pendingReboot?.let { option ->
        RebootConfirmDialog(
            option = option,
            onDismiss = { pendingReboot = null },
            onConfirm = {
                pendingReboot = null
                onReboot(option.command, option.soft)
            },
        )
    }
}

private data class StatusVisual(
    val icon: androidx.compose.ui.graphics.vector.ImageVector,
    val title: String,
    val summary: String,
)
private data class SystemRow(
    val icon: androidx.compose.ui.graphics.vector.ImageVector,
    val title: String,
    val value: String,
    val good: Boolean,
)

@Composable
private fun QuickAction(icon: androidx.compose.ui.graphics.vector.ImageVector, title: String, summary: String) {
    Column(Modifier.fillMaxWidth().padding(16.dp)) {
        Icon(icon, null, tint = MaterialTheme.colorScheme.primary)
        Spacer(Modifier.height(16.dp))
        Text(title, style = MaterialTheme.typography.titleMedium)
        Text(summary, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

// 部分 ROM 会限制普通应用读取 /sys/fs/selinux/enforce，Native 此时返回 -1。
// Android 8+ 的生产设备默认处于 Enforcing；沿用旧版页面语义，仅明确的 0 显示宽容模式。
private fun selinuxText(value: Int) = if (value == 0) "宽容模式" else "严格模式"
private fun seccompText(value: Int) = when (value) { 0 -> "未开启"; 1 -> "严格模式"; 2 -> "过滤模式"; else -> "未知" }

private fun installModeLabel(hotload: Boolean, method: String): String = when {
    !hotload -> "Boot"
    method.equals("CVE-2026-43499", ignoreCase = true) -> "热启动 · CVE-2026-43499（即时生效）"
    else -> "热启动（重启生效）"
}
