package com.linux.permissionmanager.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.Image
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import com.linux.permissionmanager.ui.rhine.RhineIcons
import com.linux.permissionmanager.ui.rhine.RhineButton as Button
import com.linux.permissionmanager.ui.rhine.RhineOutlinedButton as OutlinedButton
import com.linux.permissionmanager.ui.rhine.RhineTonalButton as FilledTonalButton
import com.linux.permissionmanager.ui.rhine.RhineTextButton as TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import com.linux.permissionmanager.ui.RootConfigUiState
import com.linux.permissionmanager.R
import com.linux.permissionmanager.ui.components.TerminalTopBar
import com.linux.permissionmanager.ui.theme.AppearanceTokens

data class RebootOption(
    val title: String,
    val command: String? = null,
    val soft: Boolean = false,
)

val RebootOptions = listOf(
    RebootOption("普通重启", "setprop sys.powerctl reboot"),
    RebootOption("软重启", soft = true),
    RebootOption("重启到 Recovery", "setprop sys.powerctl reboot,recovery"),
    RebootOption("重启到 Fastboot", "setprop sys.powerctl reboot,bootloader"),
    RebootOption("重启到 FastbootD", "setprop sys.powerctl reboot,fastboot"),
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RootConfigDialog(
    state: RootConfigUiState,
    onDismiss: () -> Unit,
    onRootKeyChange: (String) -> Unit,
    onModeChange: (Boolean) -> Unit,
    onImport: () -> Unit,
    onExport: () -> Unit,
    onConfirm: () -> Unit,
    startup: Boolean = false,
) {
    Dialog(onDismissRequest = { if (!state.busy) onDismiss() }, properties = DialogProperties(usePlatformDefaultWidth = false, dismissOnBackPress = !state.busy, dismissOnClickOutside = !startup && !state.busy)) {
        Surface(
            modifier = if (startup) Modifier.fillMaxSize() else Modifier.widthIn(max = 560.dp).fillMaxWidth(.94f),
            color = MaterialTheme.colorScheme.background,
            shape = MaterialTheme.shapes.small,
            border = if (startup) null else BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        ) {
        Box(Modifier.safeDrawingPadding().padding(24.dp), contentAlignment = Alignment.Center) {
            Column(
                modifier = Modifier.widthIn(max = 480.dp).fillMaxWidth().verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(20.dp),
            ) {
                if (startup) {
                    Image(painterResource(R.drawable.skp_startup_mark), "SKRoot Pro", Modifier.width(150.dp).height(96.dp).align(Alignment.CenterHorizontally))
                    Text("SKROOT PRO / ACCESS CONFIGURATION", style = MaterialTheme.typography.labelSmall)
                } else Text("SKROOT PRO / ROOT CONFIGURATION", style = MaterialTheme.typography.labelSmall)
                Text("Root 密钥配置", style = MaterialTheme.typography.headlineSmall)
                HorizontalDivider()
                Text("运行模式", style = MaterialTheme.typography.labelLarge)
                SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                    listOf(false to "Boot", true to "热启动").forEachIndexed { index, (hotload, label) ->
                        SegmentedButton(
                            selected = state.hotload == hotload,
                            onClick = { onModeChange(hotload) },
                            enabled = !state.busy,
                            shape = MaterialTheme.shapes.small,
                            icon = { SegmentedButtonDefaults.Icon(state.hotload == hotload) },
                        ) { Text(label) }
                    }
                }
                OutlinedTextField(
                    value = state.rootKey,
                    onValueChange = onRootKeyChange,
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Root Key") },
                    supportingText = {
                        Text(if (state.hotload) "可手动输入，或从 /sdcard/1.h 导入" else "请输入当前 Boot 环境的 Root Key")
                    },
                    enabled = !state.busy && state.hotloadCommand.isBlank(),
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                )
                if (state.hotload) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        FilledTonalButton(onClick = onImport, enabled = !state.busy, modifier = Modifier.weight(1f)) {
                            Icon(RhineIcons.FileOpen, null)
                            Spacer(Modifier.width(8.dp))
                            Text("从 1.h 导入")
                        }
                        OutlinedButton(onClick = onExport, enabled = !state.busy && state.hotloadCommand.isNotBlank()) {
                            Icon(RhineIcons.SaveAlt, null)
                            Spacer(Modifier.width(8.dp))
                            Text("导出")
                        }
                    }
                    if (state.hotloadCommand.isNotBlank()) {
                        Text(
                            "已加载热启动脚本 · ${state.method}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.primary,
                        )
                    }
                }
                HorizontalDivider()
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    TextButton(onClick = onDismiss, enabled = !state.busy) { Text("取消") }
                    Spacer(Modifier.width(12.dp))
                    Button(onClick = onConfirm, enabled = !state.busy) { Text(if (startup) "保存并进入  →" else "确定") }
                }
                if (startup) Text("配置保存在本机 · 后续启动自动进入", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        }
    }
}

@Composable
fun BusyDialog(message: String) {
    AlertDialog(
        onDismissRequest = {},
        icon = { CircularProgressIndicator(Modifier.size(32.dp), strokeWidth = 3.dp) },
        title = { Text("正在处理") },
        text = { Text(message) },
        confirmButton = {},
    )
}

@Composable
fun RebootOptionsDialog(
    onDismiss: () -> Unit,
    onSelect: (RebootOption) -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        icon = { Icon(RhineIcons.PowerSettingsNew, null) },
        title = { Text("重启选项") },
        text = {
            Column {
                RebootOptions.forEach { option ->
                    TextButton(
                        onClick = { onSelect(option) },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(option.title, modifier = Modifier.fillMaxWidth())
                    }
                }
            }
        },
        confirmButton = {},
        dismissButton = { TextButton(onClick = onDismiss) { Text("取消") } },
    )
}

@Composable
fun RebootConfirmDialog(
    option: RebootOption,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        icon = { Icon(RhineIcons.PowerSettingsNew, null) },
        title = { Text("确认重启？") },
        text = { Text("确定要${option.title}吗？") },
        confirmButton = {
            Button(
                onClick = onConfirm,
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
            ) { Text("确认") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("取消") } },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LogScreen(
    title: String,
    content: String,
    onBack: () -> Unit,
    onCopy: () -> Unit,
    onExport: () -> Unit,
) {
    Scaffold(
        topBar = {
            TerminalTopBar(
                title = title,
                code = "SYSTEM / EVENT LOG",
                navigationIcon = { IconButton(onClick = onBack) { Icon(RhineIcons.ArrowBack, "返回") } },
                actions = {
                    IconButton(onClick = onCopy) { Icon(RhineIcons.ContentCopy, "复制") }
                    IconButton(onClick = onExport) { Icon(RhineIcons.SaveAlt, "导出") }
                },
            )
        },
        containerColor = MaterialTheme.colorScheme.surfaceContainer.copy(alpha = AppearanceTokens.pageSurfaceAlpha),
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("RAW OUTPUT", style = MaterialTheme.typography.labelMedium, fontFamily = FontFamily.Monospace)
                Text(
                    "${if (content.isEmpty()) 0 else content.count { it == '\n' } + 1} 行",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            HorizontalDivider()
            Surface(
                modifier = Modifier.fillMaxWidth().weight(1f),
                color = Color(0xFF111513),
                contentColor = Color(0xFFEDF2EE),
            ) {
                SelectionContainer {
                    Text(
                        text = content.ifEmpty { "(空)" },
                        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp).testTag("log-content"),
                        style = MaterialTheme.typography.bodySmall,
                        fontFamily = FontFamily.Monospace,
                    )
                }
            }
        }
    }
}
