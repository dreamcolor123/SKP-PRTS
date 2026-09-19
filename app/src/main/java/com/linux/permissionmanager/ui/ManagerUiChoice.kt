package com.linux.permissionmanager.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.linux.permissionmanager.data.ManagerUiMode

@Composable
internal fun ManagerUiChoice(onChoose: (ManagerUiMode) -> Boolean) {
    var error by remember { mutableStateOf(false) }
    BackHandler { }
    MaterialTheme {
        Surface(Modifier.fillMaxSize().testTag("ui-mode-choice")) {
            Box(Modifier.fillMaxSize().safeDrawingPadding().padding(24.dp), contentAlignment = Alignment.Center) {
                Column(Modifier.widthIn(max = 460.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    Text("SKRoot Pro", style = MaterialTheme.typography.headlineMedium)
                    Text("选择管理器界面", style = MaterialTheme.typography.titleLarge)
                    Button(onClick = { error = !onChoose(ManagerUiMode.RHINE) }, modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp)) {
                        Text("新版 RhineLabUI")
                    }
                    OutlinedButton(onClick = { error = !onChoose(ManagerUiMode.LEGACY) }, modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp)) {
                        Text("旧版 SKRoot Pro Compose")
                    }
                    if (error) Text("无法保存界面选择，请重试", color = MaterialTheme.colorScheme.error)
                }
            }
        }
    }
}
