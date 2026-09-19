package com.linux.permissionmanager.data

import com.linux.permissionmanager.AppSettings
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

enum class ManagerUiMode(val key: String) {
    RHINE("rhine"), LEGACY("legacy");

    companion object {
        fun fromKey(value: String?): ManagerUiMode? = entries.firstOrNull { it.key == value }
    }
}

/** Only a committed native preference can change the active UI. */
class ManagerUiStore(
    readMode: () -> String = { AppSettings.getString(AppSettings.KEY_MANAGER_UI_MODE, "") },
    hasSelection: () -> Boolean = { AppSettings.getBoolean(AppSettings.KEY_MANAGER_UI_SELECTED, false) },
    private val persist: (String) -> Boolean = AppSettings::saveManagerUiMode,
) {
    private val mutableMode = MutableStateFlow(if (hasSelection()) ManagerUiMode.fromKey(readMode()) else null)
    val mode: StateFlow<ManagerUiMode?> = mutableMode.asStateFlow()

    fun select(mode: ManagerUiMode): Boolean {
        if (mutableMode.value == mode) return true
        if (!persist(mode.key)) return false
        mutableMode.value = mode
        return true
    }

    fun fallbackToLegacy(): Boolean {
        val saved = persist(ManagerUiMode.LEGACY.key)
        mutableMode.value = ManagerUiMode.LEGACY
        return saved
    }
}
