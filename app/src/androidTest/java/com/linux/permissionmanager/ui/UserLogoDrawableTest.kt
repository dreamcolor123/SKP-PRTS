package com.linux.permissionmanager.ui

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Rect
import android.graphics.drawable.Animatable2
import android.graphics.drawable.AnimatedVectorDrawable
import android.graphics.drawable.Drawable
import android.widget.ImageView
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.linux.permissionmanager.R
import java.io.File
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** Native rendering only: no WebView, bitmap substitution, or Root operations. */
@RunWith(AndroidJUnit4::class)
class UserLogoDrawableTest {
    @get:Rule val compose = createComposeRule()
    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private val context get() = instrumentation.targetContext

    @Test
    fun staticVectorRendersOriginalPurpleGradientOnNativeCanvas() {
        val bitmap = Bitmap.createBitmap(512, 512, Bitmap.Config.ARGB_8888)
        instrumentation.runOnMainSync {
            val drawable = context.getDrawable(R.drawable.skp_startup_mark)
            assertNotNull("Static logo drawable must inflate", drawable)
            drawable!!.setBounds(0, 0, bitmap.width, bitmap.height)
            drawable.draw(Canvas(bitmap))
        }
        save(bitmap, "user-logo-native-static.png")
        val pixels = inspect(bitmap)
        assertTrue("Native logo must not be empty: $pixels", pixels.purple > 2000)
        assertTrue("Opaque logo pixels must retain purple: $pixels", pixels.purple > pixels.opaque * .99)
        assertTrue("Both ends of the original gradient must render: $pixels", pixels.deepPurple > 300 && pixels.lightPurple > 300)
    }

    @Test
    fun attachedAnimatedVectorCompletesAndRendersPurpleFinalState() {
        val view = AtomicReference<ImageView>()
        val animation = AtomicReference<AnimatedVectorDrawable>()
        val starts = AtomicInteger()
        val ends = AtomicInteger()
        compose.setContent {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                AndroidView(
                    modifier = Modifier.size(240.dp),
                    factory = { context ->
                        ImageView(context).apply {
                            contentDescription = "SKRoot Pro native animated logo"
                            scaleType = ImageView.ScaleType.FIT_CENTER
                            setBackgroundColor(Color.WHITE)
                            val drawable = context.getDrawable(R.drawable.skp_startup_animated)
                            assertTrue("Startup asset must be an AnimatedVectorDrawable", drawable is AnimatedVectorDrawable)
                            val animated = drawable as AnimatedVectorDrawable
                            animated.registerAnimationCallback(object : Animatable2.AnimationCallback() {
                                override fun onAnimationStart(drawable: Drawable?) { starts.incrementAndGet() }
                                override fun onAnimationEnd(drawable: Drawable?) { ends.incrementAndGet() }
                            })
                            setImageDrawable(animated)
                            view.set(this)
                            animation.set(animated)
                        }
                    },
                )
            }
        }
        compose.waitForIdle()
        compose.runOnIdle {
            assertTrue("Animation must be attached to a real window", view.get().isAttachedToWindow)
            assertTrue("Test requires the real hardware-rendered path", view.get().isHardwareAccelerated)
            animation.get().start()
        }
        compose.waitUntil(timeoutMillis = 8000) { ends.get() == 1 }
        compose.runOnIdle {
            assertEquals("Native entry animation starts once", 1, starts.get())
            assertFalse("Native entry animation must finish, not loop", animation.get().isRunning)
        }
        instrumentation.waitForIdleSync()

        // Read the actual rendered window; software Drawable.draw cannot read RT animator state.
        val bounds = Rect()
        compose.runOnIdle {
            val position = IntArray(2)
            view.get().getLocationOnScreen(position)
            bounds.set(position[0], position[1], position[0] + view.get().width, position[1] + view.get().height)
        }
        val screen = requireNotNull(instrumentation.uiAutomation.takeScreenshot()) {
            "Actual native window screenshot must be available"
        }
        save(screen, "user-logo-native-screen.png")
        assertTrue("View bounds must fit the captured screen", Rect(0, 0, screen.width, screen.height).contains(bounds))
        val bitmap = Bitmap.createBitmap(screen, bounds.left, bounds.top, bounds.width(), bounds.height())
        save(bitmap, "user-logo-native.png")
        val pixels = inspect(bitmap)
        assertTrue("Final native animation must be visible: $pixels", pixels.purple > bitmap.width * bitmap.height * .035)
        assertTrue("Animation must preserve both purple gradient ends: $pixels", pixels.deepPurple > 100 && pixels.lightPurple > 100)
        assertEquals("No black logo pixels may replace the gradient", 0, pixels.dark)
    }

    private data class PixelCounts(val opaque: Int, val purple: Int, val deepPurple: Int, val lightPurple: Int, val dark: Int)

    private fun inspect(bitmap: Bitmap): PixelCounts {
        val values = IntArray(bitmap.width * bitmap.height)
        bitmap.getPixels(values, 0, bitmap.width, 0, 0, bitmap.width, bitmap.height)
        var opaque = 0
        var purple = 0
        var deep = 0
        var light = 0
        var dark = 0
        for (pixel in values) {
            if (Color.alpha(pixel) < 220) continue
            opaque++
            val red = Color.red(pixel)
            val green = Color.green(pixel)
            val blue = Color.blue(pixel)
            if (blue > 200 && blue > red + 30 && red > green + 35) {
                purple++
                if (red < 142 && green < 78) deep++
                if (red > 157 && green > 85) light++
            }
            if (red < 45 && green < 45 && blue < 45) dark++
        }
        return PixelCounts(opaque, purple, deep, light, dark)
    }

    private fun save(bitmap: Bitmap, name: String) {
        val directory = File(context.getExternalFilesDir(null), "visual").apply { mkdirs() }
        File(directory, name).outputStream().use {
            assertTrue("PNG capture must encode", bitmap.compress(Bitmap.CompressFormat.PNG, 100, it))
        }
    }
}
