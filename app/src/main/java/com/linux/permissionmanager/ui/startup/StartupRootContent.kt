package com.linux.permissionmanager.ui.startup

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.linux.permissionmanager.ui.RootConfigUiState
import com.linux.permissionmanager.ui.rhine.RhineIcons

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun StartupRootContent(
    state: RootConfigUiState,
    onDismiss: () -> Unit,
    onRootKeyChange: (String) -> Unit,
    onModeChange: (Boolean) -> Unit,
    onImport: () -> Unit,
    onExport: () -> Unit,
    onConfirm: () -> Unit,
) {
    val keyboard = LocalSoftwareKeyboardController.current
    BackHandler { if (!state.busy) { keyboard?.hide(); onDismiss() } }
    StartupTerminalFrame("02 / 02", "Root 密钥配置", "ACCESS / CONFIGURATION", actions = {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            OutlinedButton(onClick = { keyboard?.hide(); onDismiss() }, enabled = !state.busy, shape = RectangleShape,
                modifier = Modifier.heightIn(min = 48.dp).testTag("startup-cancel")) { Text("取消", fontSize = 13.sp, letterSpacing = 0.sp) }
            Button(onClick = { keyboard?.hide(); onConfirm() }, enabled = !state.busy, shape = RectangleShape,
                modifier = Modifier.weight(1f).heightIn(min = 48.dp).testTag("startup-confirm"), contentPadding = PaddingValues(horizontal = 12.dp, vertical = 12.dp)) {
                Text("保存并进入", fontSize = 13.sp, letterSpacing = 0.sp, modifier = Modifier.weight(1f))
                Spacer(Modifier.width(8.dp))
                Icon(Icons.AutoMirrored.Outlined.ArrowForward, null, Modifier.size(18.dp))
            }
        }
    }) {
        Text("运行模式", fontSize = 12.sp, lineHeight = 18.sp, letterSpacing = 0.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(8.dp))
        SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
            listOf(false to "Boot", true to "热启动").forEach { (hotload, label) ->
                SegmentedButton(selected = state.hotload == hotload, onClick = { onModeChange(hotload) }, enabled = !state.busy,
                    shape = RectangleShape, modifier = Modifier.heightIn(min = 48.dp).testTag(if (hotload) "startup-mode-hotload" else "startup-mode-boot"),
                    icon = { SegmentedButtonDefaults.Icon(state.hotload == hotload) }) {
                    Text(label, fontSize = 13.sp, letterSpacing = 0.sp)
                }
            }
        }
        Spacer(Modifier.height(20.dp))
        OutlinedTextField(state.rootKey, onRootKeyChange, Modifier.fillMaxWidth().testTag("startup-root-key"),
            label = { Text("Root Key", fontSize = 12.sp, letterSpacing = 0.sp) },
            enabled = !state.busy && state.hotloadCommand.isBlank(),
            shape = RectangleShape,
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            textStyle = MaterialTheme.typography.bodyMedium.copy(fontSize = 14.sp, lineHeight = 20.sp, letterSpacing = 0.sp),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, autoCorrectEnabled = false, imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(onDone = { keyboard?.hide() }),
        )
        if (state.hotload) {
            Spacer(Modifier.height(14.dp))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                TextButton(onClick = onImport, enabled = !state.busy, shape = RectangleShape, modifier = Modifier.heightIn(min = 48.dp).testTag("startup-import")) {
                    Icon(RhineIcons.FileOpen, null, Modifier.size(18.dp)); Spacer(Modifier.width(8.dp))
                    Text("从 1.h 导入", fontSize = 12.sp, letterSpacing = 0.sp)
                }
                TextButton(onClick = onExport, enabled = !state.busy && state.hotloadCommand.isNotBlank(), shape = RectangleShape,
                    modifier = Modifier.heightIn(min = 48.dp).testTag("startup-export")) {
                    Icon(RhineIcons.SaveAlt, null, Modifier.size(18.dp)); Spacer(Modifier.width(8.dp))
                    Text("导出", fontSize = 12.sp, letterSpacing = 0.sp)
                }
            }
            if (state.hotloadCommand.isNotBlank()) Text("已加载热启动脚本 · ${state.method}", fontSize = 11.sp,
                lineHeight = 17.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, letterSpacing = 0.sp)
        }
        if (state.busy) {
            Spacer(Modifier.height(16.dp))
            LinearProgressIndicator(Modifier.fillMaxWidth())
        }
    }
}
