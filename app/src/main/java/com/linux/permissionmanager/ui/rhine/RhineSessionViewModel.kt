package com.linux.permissionmanager.ui.rhine

import androidx.compose.runtime.mutableStateOf
import androidx.lifecycle.ViewModel
import com.linux.permissionmanager.PendingLocalInstall
import com.linux.permissionmanager.data.LogPayload
import java.io.File

/** Presentation and outstanding system requests survive Activity recreation.
 * No Root key or command is serialized to the renderer or saved-state bundle.
 */
internal class RhineSessionViewModel : ViewModel() {
    val bootTime = mutableStateOf(1.76)
    val bootCompleted = mutableStateOf(false)
    val workspace = mutableStateOf<String?>(null)
    val sensorEnabled = mutableStateOf(false)
    val basicManagement = mutableStateOf(false)
    val rendererGeneration = mutableStateOf(0)
    val rendererError = mutableStateOf<String?>(null)
    val logPayload = mutableStateOf(LogPayload("日志", ""))
    val pendingRunOnce = mutableStateOf(false)
    val pendingStorage = mutableStateOf<RhineStorageAction?>(null)
    val pendingExport = mutableStateOf<File?>(null)
    val pendingInstall = mutableStateOf<PendingLocalInstall?>(null)
}

internal enum class RhineStorageAction { REQUEST, IMPORT_HOTLOAD, EXPORT_HOTLOAD, EXPORT_LOG }
