package com.linux.permissionmanager.ui.rhine

import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class RhineOrientationTest {
    private val identity = floatArrayOf(1f, 0f, 0f, 0f, 1f, 0f, 0f, 0f, 1f)

    private fun rotateY(radians: Double) = floatArrayOf(
        cos(radians).toFloat(), 0f, sin(radians).toFloat(),
        0f, 1f, 0f,
        -sin(radians).toFloat(), 0f, cos(radians).toFloat(),
    )

    private fun multiply(a: FloatArray, b: FloatArray) = FloatArray(9) { index ->
        (0..2).sumOf { k -> a[index / 3 * 3 + k].toDouble() * b[k * 3 + index % 3] }.toFloat()
    }

    @Test fun firstReadingCalibratesAtAnyPoseAndResetRecalibrates() {
        val filter = RhineOrientationFilter()
        assertEquals(RhineTilt(), filter.sample(rotateY(1.2), 0, 1L))
        assertEquals(RhineTilt(), filter.sample(rotateY(1.2), 0, 50_000_001L))
        assertTrue(filter.sample(rotateY(1.3), 0, 100_000_001L).x > 0)
        filter.reset()
        assertEquals(RhineTilt(), filter.sample(rotateY(1.3), 0, 150_000_001L))
    }

    @Test fun deadZoneAndClampingAreSymmetricAndFinite() {
        assertEquals(0.0, RhineOrientationFilter.normalize(0.005), 0.0)
        assertEquals(0.0, RhineOrientationFilter.normalize(-0.005), 0.0)
        assertEquals(1.0, RhineOrientationFilter.normalize(PI), 0.0)
        assertEquals(-1.0, RhineOrientationFilter.normalize(-PI), 0.0)
        assertEquals(0.0, RhineOrientationFilter.normalize(Double.NaN), 0.0)
        assertEquals(0.0, RhineOrientationFilter.normalize(Double.POSITIVE_INFINITY), 0.0)
    }

    @Test fun lowPassConvergesWithoutOvershoot() {
        val filter = RhineOrientationFilter()
        filter.sample(identity, 0, 1L)
        var previous = 0.0
        repeat(120) { index ->
            val sample = filter.sample(rotateY(0.5), 0, 1L + (index + 1) * 33_333_334L)
            assertTrue(sample.x in previous..1.0)
            assertEquals(0.0, sample.y, 0.0)
            previous = sample.x
        }
        assertEquals(1.0, previous, 0.0001)
    }

    @Test fun displayRotationRemapsAxesAndRecalibrates() {
        assertEquals(RhineTilt(-0.2, 0.1), RhineOrientationFilter.remap(0.1, 0.2, 1))
        assertEquals(RhineTilt(-0.1, -0.2), RhineOrientationFilter.remap(0.1, 0.2, 2))
        assertEquals(RhineTilt(0.2, -0.1), RhineOrientationFilter.remap(0.1, 0.2, 3))
        val filter = RhineOrientationFilter()
        filter.sample(identity, 0, 1L)
        assertTrue(filter.sample(rotateY(0.2), 0, 50_000_001L).x > 0)
        assertEquals(RhineTilt(), filter.sample(rotateY(0.2), 1, 100_000_001L))
        val landscape = filter.sample(rotateY(0.3), 1, 150_000_001L)
        assertEquals(0.0, landscape.x, 0.0)
        assertTrue(landscape.y > 0)
    }

    @Test fun relativeRotationDoesNotJumpAtEulerBoundaryOrVerticalPose() {
        val filter = RhineOrientationFilter()
        filter.sample(rotateY(PI - 0.01), 0, 1L)
        val sample = filter.sample(rotateY(-PI + 0.01), 0, 50_000_001L)
        assertTrue(sample.x > 0 && sample.x < 0.1)
        val upright = floatArrayOf(1f, 0f, 0f, 0f, 0f, -1f, 0f, 1f, 0f)
        filter.reset()
        filter.sample(upright, 0, 1L)
        assertTrue(filter.sample(multiply(upright, rotateY(0.1)), 0, 50_000_001L).x > 0)
    }

    @Test fun duplicateTimestampsAndMalformedReadingsDoNotPoisonCalibration() {
        val filter = RhineOrientationFilter()
        filter.sample(identity, 0, 10L)
        assertEquals(RhineTilt(), filter.sample(rotateY(0.5), 0, 10L))
        assertEquals(RhineTilt(), filter.sample(FloatArray(9) { Float.NaN }, 0, 20L))
        assertEquals(RhineTilt(), filter.sample(FloatArray(2), 0, 20L))
        assertEquals(RhineTilt(), filter.sample(identity, 4, 20L))
        assertTrue(filter.sample(rotateY(0.1), 0, 50_000_010L).x > 0)
    }
}
