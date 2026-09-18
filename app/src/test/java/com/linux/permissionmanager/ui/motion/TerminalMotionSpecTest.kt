package com.linux.permissionmanager.ui.motion

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class TerminalMotionSpecTest {
    @Test
    fun motionRequiresEveryGate() {
        assertTrue(TerminalMotionSpec.enabled(true, true, true, true))
        assertFalse(TerminalMotionSpec.enabled(false, true, true, true))
        assertFalse(TerminalMotionSpec.enabled(true, false, true, true))
        assertFalse(TerminalMotionSpec.enabled(true, true, false, true))
        assertFalse(TerminalMotionSpec.enabled(true, true, true, false))
    }

    @Test
    fun glitchHasDeterministicLimitedPulsesAndStaticEnd() {
        assertEquals(-1f, TerminalMotionSpec.glitchOffset(0f), 0f)
        assertEquals(0.6f, TerminalMotionSpec.glitchOffset(0.2f), 0f)
        assertEquals(0f, TerminalMotionSpec.glitchOffset(0.4f), 0f)
        assertEquals(0.35f, TerminalMotionSpec.glitchOffset(0.5f), 0f)
        assertEquals(0f, TerminalMotionSpec.glitchOffset(0.9f), 0f)
        assertEquals(0f, TerminalMotionSpec.glitchOffset(1f), 0f)
        assertEquals(0f, TerminalMotionSpec.glitchOffset(-1f), 0f)
    }

    @Test
    fun revealIsMonotonicAndCompletesEveryBand() {
        repeat(3) { band ->
            assertEquals(0f, TerminalMotionSpec.revealFraction(0f, band, 3), 0f)
            var previous = 0f
            for (step in 0..100) {
                val next = TerminalMotionSpec.revealFraction(step / 100f, band, 3)
                assertTrue(next in 0f..1f)
                assertTrue(next >= previous)
                previous = next
            }
            assertEquals(1f, previous, 0f)
        }
        assertTrue(TerminalMotionSpec.revealFraction(0.4f, 0, 3) > TerminalMotionSpec.revealFraction(0.4f, 2, 3))
    }

    @Test
    fun referenceRollingTimingAndBriefGlitchAreFixed() {
        assertEquals(460, TerminalMotionSpec.ROLL_DURATION_MS)
        assertTrue(TerminalMotionSpec.GLITCH_DURATION_MS in 120..220)
        assertTrue(TerminalMotionSpec.REVEAL_DURATION_MS in 240..420)
        assertTrue(TerminalMotionSpec.BOOT_DURATION_MS < 2000)
    }

    @Test
    fun longParagraphRevealStillFinishesEveryVisualLine() {
        repeat(80) { line ->
            assertEquals(0f, TerminalMotionSpec.revealFraction(0f, line, 80), 0f)
            assertEquals(1f, TerminalMotionSpec.revealFraction(1f, line, 80), 0f)
            var previous = 0f
            for (step in 0..100) {
                val next = TerminalMotionSpec.revealFraction(step / 100f, line, 80)
                assertTrue(next >= previous)
                previous = next
            }
        }
    }

    @Test
    fun retargetingKeepsVisibleParagraphsAndReplacesOnlyUnseenQueue() {
        assertEquals(1, TerminalMotionSpec.nextRollingSlot(0f))
        assertEquals(0..0, TerminalMotionSpec.visibleRollingSlots(0f))
        assertEquals(2, TerminalMotionSpec.nextRollingSlot(0.3f))
        assertEquals(0..1, TerminalMotionSpec.visibleRollingSlots(0.3f))
        assertEquals(2, TerminalMotionSpec.nextRollingSlot(0.7f))
        assertEquals(2, TerminalMotionSpec.nextRollingSlot(1f))
        assertEquals(3, TerminalMotionSpec.nextRollingSlot(1.1f))
        assertEquals(1..2, TerminalMotionSpec.visibleRollingSlots(1.1f))
    }

    @Test
    fun rapidRetargetsNeverAccumulateUnboundedPendingValues() {
        var slots = listOf(0)
        repeat(1000) { step ->
            val position = step / 100f
            val visible = TerminalMotionSpec.visibleRollingSlots(position)
            slots = slots.filter { it in visible } + TerminalMotionSpec.nextRollingSlot(position)
            assertTrue(slots.size <= 3)
            assertEquals(slots.size, slots.distinct().size)
        }
    }
}
