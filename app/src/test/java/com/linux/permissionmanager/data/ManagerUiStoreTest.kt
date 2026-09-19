package com.linux.permissionmanager.data

import org.junit.Assert.*
import org.junit.Test

class ManagerUiStoreTest {
    @Test fun firstLaunchRequiresExplicitChoice() {
        val store = ManagerUiStore({ "rhine" }, { false }, { error("Unexpected write") })
        assertNull(store.mode.value)
    }
    @Test fun invalidPersistedModeRequiresChoice() {
        assertNull(ManagerUiStore({ "invalid" }, { true }, { true }).mode.value)
    }
    @Test fun choicePersistsOnceAndRestores() {
        var value = ""; var writes = 0
        val store = ManagerUiStore({ value }, { false }, { value = it; writes++; true })
        assertTrue(store.select(ManagerUiMode.RHINE))
        assertTrue(store.select(ManagerUiMode.RHINE))
        assertEquals(1, writes)
        assertEquals(ManagerUiMode.RHINE, ManagerUiStore({ value }, { true }, { true }).mode.value)
        assertTrue(store.select(ManagerUiMode.LEGACY))
        assertEquals("legacy", value)
    }
    @Test fun persistenceFailureDoesNotSwitch() {
        val store = ManagerUiStore({ "rhine" }, { true }, { false })
        assertFalse(store.select(ManagerUiMode.LEGACY))
        assertEquals(ManagerUiMode.RHINE, store.mode.value)
    }
    @Test fun fatalRendererFailureStillEscapesWhenStorageFails() {
        val store = ManagerUiStore({ "rhine" }, { true }, { false })
        assertFalse(store.fallbackToLegacy())
        assertEquals(ManagerUiMode.LEGACY, store.mode.value)
    }
}
