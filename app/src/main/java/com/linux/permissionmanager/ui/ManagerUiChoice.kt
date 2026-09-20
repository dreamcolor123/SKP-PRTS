package com.linux.permissionmanager.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.linux.permissionmanager.data.ManagerUiMode
import com.linux.permissionmanager.ui.startup.StartupTerminalFrame

@Composable
internal fun ManagerUiChoice(onChoose: (ManagerUiMode) -> Boolean) {
    var error by remember { mutableStateOf(false) }
    var submitted by remember { mutableStateOf(false) }
    BackHandler { }
    Box(Modifier.fillMaxSize().testTag("ui-mode-choice")) {
        StartupTerminalFrame("01 / 02", "选择管理器界面", "INTERFACE / SELECT") {
            listOf(ManagerUiMode.RHINE to "新版 RhineLabUI", ManagerUiMode.LEGACY to "旧版 SKRoot Pro Compose")
                .forEachIndexed { index, (mode, title) ->
                    Surface(
                        onClick = {
                            if (!submitted) {
                                submitted = true
                                error = !onChoose(mode)
                                if (error) submitted = false
                            }
                        },
                        modifier = Modifier.fillMaxWidth().heightIn(min = 80.dp),
                        enabled = !submitted,
                        shape = RectangleShape,
                        color = if (index == 0) MaterialTheme.colorScheme.primary.copy(alpha = .08f) else MaterialTheme.colorScheme.surface,
                        border = BorderStroke(1.dp, if (index == 0) MaterialTheme.colorScheme.primary.copy(alpha = .6f) else MaterialTheme.colorScheme.outlineVariant),
                    ) {
                        Row(Modifier.padding(horizontal = 16.dp, vertical = 18.dp), verticalAlignment = Alignment.CenterVertically) {
                            Text("0${index + 1}", fontFamily = FontFamily.Monospace, fontSize = 11.sp, letterSpacing = 0.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Spacer(Modifier.width(16.dp))
                            Text(title, fontSize = 14.sp, lineHeight = 21.sp, fontWeight = FontWeight.Medium,
                                letterSpacing = 0.sp, modifier = Modifier.weight(1f))
                            Spacer(Modifier.width(12.dp))
                            Icon(Icons.AutoMirrored.Outlined.ArrowForward, null, Modifier.size(18.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                    Spacer(Modifier.height(12.dp))
                }
            if (error) Text("无法保存界面选择，请重试", color = MaterialTheme.colorScheme.error, fontSize = 12.sp, letterSpacing = 0.sp)
        }
    }
}
