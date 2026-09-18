package com.linux.permissionmanager.ui.rhine

import org.junit.Assert.*
import org.junit.Test

class RhineConfirmationTest {
    @Test fun repeatedNativeCallbacksExecuteOnceBeforeRecomposition() {
        val request = RhineConfirmation()
        var calls = 0
        repeat(20) { if (request.consume(true)) calls++ }
        assertEquals(1, calls)
    }
    @Test fun busyCanRetryButCancelledAndOldRequestsCannotExecute() {
        val previous = RhineConfirmation()
        assertFalse(previous.consume(false))
        previous.cancel()
        val next = RhineConfirmation()
        assertFalse(previous.consume(true))
        assertTrue(next.consume(true))
        assertFalse(next.consume(true))
    }
}
