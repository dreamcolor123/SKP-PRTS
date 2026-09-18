package com.linux.permissionmanager.ui.rhine

import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class RhineOrientationTest {
    private val identity = floatArrayOf(1f, 0f, 0f, 0f, 1f, 0f, 0f, 0f, 1f)

    private fun rotateX(radians: Double) = floatArrayOf(
        1f, 0f, 0f,
        0f, cos(radians).toFloat(), -sin(radians).toFloat(),
        0f, sin(radians).toFloat(), cos(radians).toFloat(),
    )

    private fun rotateY(radians: Double) = floatArrayOf(
        cos(radians).toFloat(), 0f, sin(radians).toFloat(),
        0f, 1f, 0f,
        -sin(radians).toFloat(), 0f, cos(radians).toFloat(),
    )

    private fun rotateZ(radians: Double) = floatArrayOf(
        cos(radians).toFloat(), -sin(radians).toFloat(), 0f,
        sin(radians).toFloat(), cos(radians).toFloat(), 0f,
        0f, 0f, 1f,
    )

    private fun multiply(a: FloatArray, b: FloatArray) = FloatArray(9) { index ->
        (0..2).sumOf { k -> a[index / 3 * 3 + k].toDouble() * b[k * 3 + index % 3] }.toFloat()
    }

    private fun settled(baseline: FloatArray, delta: FloatArray, rotation: Int): RhineTilt {
        val filter = RhineOrientationFilter()
        filter.sample(baseline, rotation, 1L)
        val reading = multiply(baseline, delta)
        var result = RhineTilt()
        repeat(120) { index -> result = filter.sample(reading, rotation, 1L + (index + 1) * 33_333_334L) }
        return result
    }

    private fun assertTilt(label: String, expected: RhineTilt, actual: RhineTilt, tolerance: Double = 0.00001) {
        assertEquals("$label x", expected.x, actual.x, tolerance)
        assertEquals("$label y", expected.y, actual.y, tolerance)
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

    @Test fun screenAxesRemainIndependentAtEveryDisplayRotationAndHoldingPose() {
        val poses = listOf(
            "flat" to identity,
            "upright" to rotateX(PI / 2),
            "inverted" to rotateX(PI),
            "sideways" to rotateY(PI / 2),
            "oblique" to multiply(multiply(rotateZ(0.7), rotateX(1.1)), rotateY(-0.4)),
        )
        val angle = 5.0 * PI / 180.0
        val magnitude = RhineOrientationFilter.normalize(angle)
        // These device-local rotations tilt the display normal right/down at
        // Surface.ROTATION_0, 90, 180 and 270, respectively.
        val horizontal = listOf<(Double) -> FloatArray>(::rotateY, { rotateX(-it) }, { rotateY(-it) }, ::rotateX)
        val vertical = listOf<(Double) -> FloatArray>(::rotateX, ::rotateY, { rotateX(-it) }, { rotateY(-it) })
        for ((name, pose) in poses) for (rotation in 0..3) for (sign in listOf(-1.0, 1.0)) {
            val label = "$name rotation=$rotation sign=$sign"
            assertTilt("$label horizontal", RhineTilt(sign * magnitude, 0.0), settled(pose, horizontal[rotation](angle * sign), rotation))
            assertTilt("$label vertical", RhineTilt(0.0, sign * magnitude), settled(pose, vertical[rotation](angle * sign), rotation))
        }
    }

    @Test fun twistingAroundTheDisplayNormalDoesNotBecomeTilt() {
        val poses = listOf(identity, rotateX(PI / 2), multiply(rotateZ(0.6), rotateX(1.2)))
        for (pose in poses) for (rotation in 0..3) for (angle in listOf(-PI / 2, -0.1, 0.1, PI / 2)) {
            assertTilt("twist rotation=$rotation angle=$angle", RhineTilt(), settled(pose, rotateZ(angle), rotation))
        }
    }

    @Test fun diagonalTiltContainsBothAxesWithoutWorldPoseDependency() {
        val delta = multiply(rotateY(0.05), rotateX(0.07))
        val expected = settled(identity, delta, 0)
        assertTrue(expected.x > 0.0 && expected.y > 0.0)
        val poses = listOf(rotateX(PI / 2), rotateY(PI / 2), multiply(rotateZ(2.7), rotateX(-1.1)))
        for (pose in poses) for (rotation in 0..3) {
            assertTilt("diagonal rotation=$rotation", RhineOrientationFilter.remap(expected.x, expected.y, rotation), settled(pose, delta, rotation))
        }
    }

    @Test fun tenDegreeTiltReachesFullScaleAndSmallMotionRemainsVisible() {
        val tenDegrees = 10.0 * PI / 180.0
        assertEquals(1.0, RhineOrientationFilter.normalize(tenDegrees), 0.000001)
        assertEquals(-1.0, RhineOrientationFilter.normalize(-tenDegrees), 0.000001)
        assertTrue(RhineOrientationFilter.normalize(2.0 * PI / 180.0) > 0.15)
    }

    @Test fun neutralReturnConvergesOnBothAxesWithoutOvershoot() {
        val filter = RhineOrientationFilter()
        filter.sample(identity, 0, 1L)
        val tilted = multiply(rotateY(-0.1), rotateX(0.1))
        var time = 1L
        repeat(120) { time += 33_333_334L; filter.sample(tilted, 0, time) }
        var previous = filter.sample(tilted, 0, time + 1)
        repeat(120) {
            time += 33_333_334L
            val next = filter.sample(identity, 0, time)
            assertTrue(next.x in previous.x..0.0)
            assertTrue(next.y in 0.0..previous.y)
            previous = next
        }
        assertTilt("neutral", RhineTilt(), previous)
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
