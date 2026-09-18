package com.linux.permissionmanager.ui.rhine

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Handler
import android.os.Looper
import android.view.View
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.exp
import kotlin.math.sign

internal data class RhineTilt(val x: Double = 0.0, val y: Double = 0.0)

/** Relative matrices avoid Euler-angle discontinuities when the phone is upright. */
internal class RhineOrientationFilter {
    private var neutral: FloatArray? = null
    private var rotation = -1
    private var timestamp = 0L
    private var current = RhineTilt()

    fun reset() {
        neutral = null
        rotation = -1
        timestamp = 0L
        current = RhineTilt()
    }

    fun sample(matrix: FloatArray, displayRotation: Int, timeNanos: Long): RhineTilt {
        if (matrix.size != 9 || matrix.any { !it.isFinite() } || displayRotation !in 0..3) return RhineTilt()
        if (neutral == null || rotation != displayRotation) {
            neutral = matrix.copyOf()
            rotation = displayRotation
            timestamp = timeNanos
            current = RhineTilt()
            return current
        }
        if (timeNanos <= timestamp) return current
        val baseline = neutral!!
        fun relative(row: Int, col: Int): Double = (0..2).sumOf { index ->
            baseline[index * 3 + row].toDouble() * matrix[index * 3 + col]
        }
        val z = relative(2, 2)
        val deviceX = atan2(relative(0, 2), z)
        val deviceY = atan2(-relative(1, 2), z)
        val screen = remap(deviceX, deviceY, displayRotation)
        val target = RhineTilt(normalize(screen.x), normalize(screen.y))
        val dt = ((timeNanos - timestamp) / 1_000_000_000.0).coerceAtMost(0.1)
        timestamp = timeNanos
        val alpha = 1.0 - exp(-dt / 0.16)
        current = RhineTilt(
            current.x + (target.x - current.x) * alpha,
            current.y + (target.y - current.y) * alpha,
        )
        return current
    }

    companion object {
        private const val DEAD_ZONE = 0.006
        private val FULL_SCALE = 12.0 * PI / 180.0

        internal fun normalize(angle: Double): Double {
            if (!angle.isFinite() || abs(angle) <= DEAD_ZONE) return 0.0
            return sign(angle) * ((abs(angle) - DEAD_ZONE) / (FULL_SCALE - DEAD_ZONE)).coerceIn(0.0, 1.0)
        }

        internal fun remap(x: Double, y: Double, rotation: Int): RhineTilt = when (rotation) {
            1 -> RhineTilt(-y, x)
            2 -> RhineTilt(-x, -y)
            3 -> RhineTilt(y, -x)
            else -> RhineTilt(x, y)
        }
    }
}

/** Main-thread sensor delivery is independent of Compose recomposition. */
internal class RhineOrientation(
    private val view: View,
    private val onTilt: (RhineTilt) -> Unit,
) : SensorEventListener {
    private val manager = view.context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
    private val filter = RhineOrientationFilter()
    private val matrix = FloatArray(9)
    private var listening = false
    private var lastEmission = Long.MIN_VALUE

    fun start() {
        stop()
        val sensorManager = manager ?: return
        val sensor = sensorManager.getDefaultSensor(Sensor.TYPE_GAME_ROTATION_VECTOR)
            ?: sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)
            ?: return
        listening = runCatching {
            sensorManager.registerListener(this, sensor, 33_334, Handler(Looper.getMainLooper()))
        }.getOrDefault(false)
    }

    fun stop() {
        listening = false
        manager?.unregisterListener(this)
        filter.reset()
        lastEmission = Long.MIN_VALUE
        onTilt(RhineTilt())
    }

    override fun onSensorChanged(event: SensorEvent) {
        if (!listening || event.values.size < 3 || event.values.any { !it.isFinite() }) return
        SensorManager.getRotationMatrixFromVector(matrix, event.values)
        val tilt = filter.sample(matrix, view.display?.rotation ?: 0, event.timestamp)
        if (lastEmission == Long.MIN_VALUE || event.timestamp - lastEmission >= 33_333_334L) {
            lastEmission = event.timestamp
            onTilt(tilt)
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
}
