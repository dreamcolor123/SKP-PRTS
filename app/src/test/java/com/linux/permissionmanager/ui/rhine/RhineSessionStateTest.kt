package com.linux.permissionmanager.ui.rhine

import androidx.lifecycle.SavedStateHandle
import org.junit.Assert.*
import org.junit.Test

class RhineSessionStateTest {
    @Test fun recreationRestoresOnlyPresentationState() {
        val handle = SavedStateHandle()
        val session = RhineSessionViewModel(handle)
        session.bootTime.value = 35.0
        session.bootCompleted.value = true
        session.rootEntryCompleted.value = true
        session.workspace.value = "{\"section\":\"modules\"}"
        session.sensorEnabled.value = true
        session.rendererError.value = "context lost"
        val restored = RhineSessionViewModel(handle)
        assertEquals(35.0, restored.bootTime.value, 0.0)
        assertTrue(restored.bootCompleted.value)
        assertTrue(restored.rootEntryCompleted.value)
        assertEquals(session.workspace.value, restored.workspace.value)
        assertFalse(restored.sensorEnabled.value)
        assertNull(restored.rendererError.value)
        assertEquals(setOf("bootTime", "bootCompleted", "rootEntryCompleted", "workspace"), handle.keys())
    }
    @Test fun freshLaunchStartsOpeningAgain() {
        val session = RhineSessionViewModel(SavedStateHandle())
        assertEquals(1.76, session.bootTime.value, 0.0)
        assertFalse(session.bootCompleted.value)
        assertFalse(session.rootEntryCompleted.value)
        assertNull(session.workspace.value)
    }
    @Test fun uiSwitchWhitelistedAndObsoleteFallbackRejected() {
        assertTrue("ui.mode.set" in RHINE_ACTIONS)
        assertFalse("fallback.open" in RHINE_ACTIONS)
        var calls = 0
        val ledger = RhineRequestLedger("mode-test")
        repeat(2) { ledger.dispatch("mode-test", "mode-test:1", "ui.mode.set") { calls++; true } }
        assertEquals(1, calls)
        assertFalse(ledger.dispatch("mode-test", "mode-test:2", "fallback.open") { calls++; true }.accepted)
        assertEquals(1, calls)
    }
}
