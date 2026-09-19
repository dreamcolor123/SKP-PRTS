package com.linux.permissionmanager.ui.rhine

import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.MutableState
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import com.linux.permissionmanager.PendingLocalInstall
import com.linux.permissionmanager.data.LogPayload
import java.io.File

/** Presentation and outstanding system requests survive Activity recreation.
 * No Root key or command is serialized to the renderer or saved-state bundle.
 */
internal class RhineSessionViewModel(private val savedState: SavedStateHandle) : ViewModel() {
    private fun <T> presentationState(key: String, initial: T): MutableState<T> {
        val state = mutableStateOf(savedState.get<T>(key) ?: initial)
        return object : MutableState<T> {
            override var value: T
                get() = state.value
                set(value) { state.value = value; savedState[key] = value }
            override fun component1(): T = value
            override fun component2(): (T) -> Unit = { value = it }
        }
    }
    val bootTime = presentationState("bootTime", 1.76)
    val bootCompleted = presentationState("bootCompleted", false)
    val workspace = presentationState<String?>("workspace", null)
    val sensorEnabled = mutableStateOf(false)
    val rendererGeneration = mutableStateOf(0)
    val rendererError = mutableStateOf<String?>(null)
    val logPayload = mutableStateOf(LogPayload("日志", ""))
    val pendingRunOnce = mutableStateOf(false)
    val pendingStorage = mutableStateOf<RhineStorageAction?>(null)
    val pendingExport = mutableStateOf<File?>(null)
    val pendingInstall = mutableStateOf<PendingLocalInstall?>(null)
}

internal enum class RhineStorageAction { REQUEST, IMPORT_HOTLOAD, EXPORT_HOTLOAD, EXPORT_LOG }
