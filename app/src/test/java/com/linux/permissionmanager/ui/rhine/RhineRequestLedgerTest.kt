package com.linux.permissionmanager.ui.rhine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RhineRequestLedgerTest {
    @Test fun repeatedRequestReturnsOriginalOutcomeWithoutRunningAgain() {
        val ledger = RhineRequestLedger("session")
        var calls = 0
        val first = ledger.dispatch("session", "1", "root.test") { calls++; true }
        val duplicate = ledger.dispatch("session", "1", "root.test") { calls++; false }
        assertTrue(first.accepted)
        assertEquals(first, duplicate)
        assertEquals(1, calls)
    }
    @Test fun reentrantDispatchCannotExecuteTwice() {
        val ledger = RhineRequestLedger("session")
        var calls = 0
        val result = ledger.dispatch("session", "1", "root.test") {
            calls++
            assertFalse(ledger.dispatch("session", "1", "root.test") { calls++; true }.accepted)
            true
        }
        assertTrue(result.accepted)
        assertEquals(1, calls)
    }
    @Test fun staleSessionUnknownActionsAndMalformedIdsNeverReachDispatcher() {
        val ledger = RhineRequestLedger("current")
        var calls = 0
        assertEquals("stale_session", ledger.dispatch("old", "1", "root.test") { calls++; true }.reason)
        assertEquals("invalid_request", ledger.dispatch("current", "../1", "root.test") { calls++; true }.reason)
        assertEquals("unknown_action", ledger.dispatch("current", "2", "shell.run") { calls++; true }.reason)
        assertEquals(0, calls)
    }
    @Test fun failureIsRememberedAndCapacityNeverEvictsExecutedRequest() {
        val ledger = RhineRequestLedger("session", capacity = 1)
        var calls = 0
        val failure = ledger.dispatch("session", "1", "root.test") { calls++; error("failure") }
        assertEquals("dispatch_failed", failure.reason)
        assertEquals("session_capacity", ledger.dispatch("session", "2", "root.test") { calls++; true }.reason)
        assertEquals(failure, ledger.dispatch("session", "1", "root.test") { calls++; true })
        assertEquals(1, calls)
    }
}
