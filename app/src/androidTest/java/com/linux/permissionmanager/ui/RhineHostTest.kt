package com.linux.permissionmanager.ui

import android.graphics.Bitmap
import android.graphics.Color
import android.os.SystemClock
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.linux.permissionmanager.data.*
import com.linux.permissionmanager.ui.rhine.RhineStateMapper
import com.linux.permissionmanager.ui.rhine.RhineWebHost
import com.linux.permissionmanager.ui.theme.SkpTheme
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import org.json.JSONObject
import org.json.JSONTokener
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** Real Android rendering and port fixtures. No fixture executes Root actions. */
@RunWith(AndroidJUnit4::class)
class RhineHostTest {
    @get:Rule val compose = createComposeRule()
    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private val root = AtomicReference<View>()
    private val actions = AtomicInteger()
    private val failure = AtomicReference<String>()
    private var active by mutableStateOf(true)
    private var audioActive by mutableStateOf<Boolean?>(null)
    private var allowed by mutableStateOf(true)
    private var reduced by mutableStateOf(false)
    private var snapshot by mutableStateOf(fixture())
    private val events = mutableListOf<JSONObject>()

    @Test fun firstConfigurationGateStartsAtBeginningAndPauses() {
        allowed = false
        active = false
        show()
        await("port ready behind key form") { it.optBoolean("ready") && it.optJSONObject("host")?.optBoolean("connected") == true }
        assertNotEquals("started", inspect().optString("startup"))
        compose.runOnIdle { active = true; allowed = true }
        compose.waitForIdle()
        val started = await("automatic startup") { it.optString("startup") == "started" }
        val openingEvent = synchronized(events) { events.firstOrNull { it.optBoolean("bootStarted") } }
        assertNotNull("Missing start event: $started", openingEvent)
        assertFalse(openingEvent!!.getBoolean("bootCompleted"))
        assertTrue("First key form must not advance the boot clock: $openingEvent", openingEvent.getDouble("bootTime") < 3)
        eval("window.rhine.seek(8);window.rhine.resume();true")
        SystemClock.sleep(200)
        compose.runOnIdle { active = false }
        compose.waitForIdle()
        await("pause message delivered") { !it.getJSONObject("host").getJSONObject("presentation").getBoolean("active") }
        SystemClock.sleep(300)
        val frame = eval("document.querySelector('#stage').dataset.bootFrame")
        SystemClock.sleep(650)
        assertEquals(frame, eval("document.querySelector('#stage').dataset.bootFrame"))
        compose.runOnIdle { active = true }
        compose.waitForIdle()
        await("resumed") { it.getJSONObject("host").getJSONObject("presentation").getBoolean("active") }
        assertNull(failure.get())
    }

    @Test fun completeMotionKeyframesCompositeOnAndroid() {
        show()
        await("ready") { it.optBoolean("ready") && it.optString("startup") == "started" }
        for (time in listOf(2.0, 8.0, 15.5, 19.0, 23.0, 27.0, 31.0, 34.0)) {
            eval("window.rhine.seek($time);true")
            await("frame $time") { it.optString("mode") == "boot" && kotlin.math.abs(it.optDouble("bootTime") - time - 5) < .01 }
            SystemClock.sleep(600)
            capture("frame-${time.toString().replace('.', '_')}")
        }
        eval("window.rhine.archive();true")
        SystemClock.sleep(700)
        capture("array")
        eval("window.rhine.detail();true")
        SystemClock.sleep(1500)
        capture("detail")
        assertNull(failure.get())
    }

    @Test fun foregroundPanelsKeepMusicRunningButBackgroundStillPauses() {
        reduced = true
        audioActive = true
        show(completed = true)
        await("workspace ready") { it.optString("mode") == "detail" }
        eval("document.querySelector('.system-nav [data-action=settings]').click();true")
        eval("const music=document.querySelector('[data-pref=music]');music.checked=true;music.dispatchEvent(new Event('change',{bubbles:true}));true")
        await("music running in settings") { it.optJSONObject("audio")?.optString("state") == "running" && it.getJSONObject("audio").optInt("tracks") == 3 }
        assertMusicAdvances("Web settings")
        eval("window.rhine.back();document.querySelector('.system-nav [data-action=search]').click();true")
        assertMusicAdvances("Web search")
        eval("window.rhine.back();true")
        compose.runOnIdle { active = false }
        compose.waitForIdle()
        await("native panel freezes rendering only") { !it.getJSONObject("host").getJSONObject("presentation").getBoolean("active") }
        assertMusicAdvances("native panel")
        compose.runOnIdle { audioActive = false }
        compose.waitForIdle()
        val paused = await("background mutes music") { it.getJSONObject("audio").optString("state") == "suspended" && it.getJSONObject("audio").optInt("tracks") == 0 }
        val audioTime = paused.getJSONObject("audio").getDouble("time")
        SystemClock.sleep(350)
        assertEquals(audioTime, inspect().getJSONObject("audio").getDouble("time"), .01)
        compose.runOnIdle { active = true; audioActive = true }
        compose.waitForIdle()
        await("foreground resumes music") { it.getJSONObject("audio").optString("state") == "running" && it.getJSONObject("audio").optInt("tracks") == 3 }
        assertNull(failure.get())
    }

    private fun assertMusicAdvances(label: String) {
        val before = inspect().getJSONObject("audio")
        SystemClock.sleep(450)
        val after = inspect().getJSONObject("audio")
        assertEquals("$label: $after", "running", after.getString("state"))
        assertEquals("$label: $after", 3, after.getInt("tracks"))
        assertFalse("$label: $after", after.getBoolean("hostPaused"))
        assertTrue("$label: $before -> $after", after.getDouble("time") > before.getDouble("time") + .2)
    }

    @Test fun nativeActionAndLiveStateUseTheActualPort() {
        reduced = true
        show()
        await("workspace") { it.optString("mode") == "detail" && it.optString("selected") == "home.summary" }
        eval("window.rhine.detail();true")
        SystemClock.sleep(500)
        eval("document.querySelector('.ff-action-primary').click();document.querySelector('.ff-action-primary').click();true")
        val until = SystemClock.uptimeMillis() + 5000
        while (actions.get() == 0 && SystemClock.uptimeMillis() < until) SystemClock.sleep(50)
        assertEquals("Rapid duplicate click dispatches once", 1, actions.get())
        compose.runOnIdle { snapshot = fixture(EnvironmentState.RUNNING) }
        compose.waitForIdle()
        await("native status update") { it.optString("selected") == "home.summary" && it.optString("statusText").contains("正常运行") }
        val status = eval("document.querySelector('#skp-status').textContent").toString()
        assertTrue(status, status.contains("正常运行"))
        capture("live-state")
        assertNull(failure.get())
    }

    @Test fun rebuildSkipsCompletedBootAndReducedMotionRemainsUsable() {
        reduced = true
        show(completed = true, time = 35.0)
        await("restored workspace") { it.optString("startup") == "started" && it.optString("mode") == "detail" }
        assertTrue(inspect().getJSONObject("motion").getBoolean("reduced"))
        eval("document.querySelector('[data-action=settings]').click();true")
        SystemClock.sleep(250)
        capture("settings-reduced")
        eval("window.rhine.back();true")
        eval("window.rhine.visualLab();true")
        SystemClock.sleep(400)
        capture("motion-lab")
    }

    @Test fun fiveSectionsAndSearchAreDirectlyAccessible() {
        reduced = true
        show(completed = true)
        await("workspace ready") { it.optString("mode") == "detail" }
        for (section in listOf("home", "authorization", "modules", "market", "settings")) {
            eval("document.querySelector('.workspace-navigation [data-section=$section]').click();true")
            assertEquals(section, eval("window.rhine.workspaceState().section"))
            SystemClock.sleep(150)
            capture("workspace-$section")
        }
        eval("window.rhine.workspace('modules');true")
        eval("document.querySelector('.system-nav [data-action=search]').click();true")
        eval("document.querySelector('#archive-search').value='重启';document.querySelector('#archive-search').dispatchEvent(new Event('input',{bubbles:true}));true")
        assertTrue((eval("document.querySelectorAll('[data-function-record]').length") as Number).toInt() > 0)
        capture("function-search")
        eval("document.querySelector('[data-function-record]').click();true")
        SystemClock.sleep(200)
        assertEquals(1, actions.get())
        eval("window.rhine.workspace('authorization');true")
        assertEquals("authorization", eval("window.rhine.workspaceState().section"))
        eval("window.rhine.back();true")
        assertEquals("home", eval("window.rhine.workspaceState().section"))
    }

    @Test fun facePerspectiveAndSavedWorkspaceSurviveRecreation() {
        reduced = true
        val saved = """{"section":"modules","recordId":"modules:manager","root":true,"browsing":false,"panel":{"section":"modules","recordId":"modules:manager","root":true,"queries":{"modules":"needle"},"scroll":{}}}"""
        show(completed = true, restored = saved)
        await("restored section") { it.optString("mode") == "detail" && it.optString("selected") == "modules:manager" }
        assertEquals("needle", eval("document.querySelector('.ff-query input').value"))
        SystemClock.sleep(1500)
        val plane = eval("""(()=>{
          const panel=document.querySelector('.folder-face-panel'), stage=document.querySelector('#stage');
          const matrix=new DOMMatrix(getComputedStyle(panel).transform),rect=stage.getBoundingClientRect(),scale=rect.width/stage.offsetWidth;
          const expected=window.rhine.workspaceQuad().map(([x,y])=>({x:x*scale+rect.left,y:y*scale+rect.top}));
          const actual=[[0,0],[panel.offsetWidth,0],[panel.offsetWidth,panel.offsetHeight],[0,panel.offsetHeight]].map(([x,y])=>{const p=matrix.transformPoint({x,y});return {x:p.x/p.w,y:p.y/p.w}});
          return {error:Math.max(...actual.map((p,i)=>Math.hypot(p.x-expected[i].x,p.y-expected[i].y))),slant:Math.abs(expected[0].y-expected[1].y),plane:panel.dataset.plane};
        })()""".trimIndent()) as JSONObject
        assertEquals("model-front", plane.getString("plane"))
        assertTrue(plane.toString(), plane.getDouble("error") < 1.0)
        assertTrue(plane.toString(), plane.getDouble("slant") > 1.0)
        assertTrue(inspect().getJSONObject("face").getString("backdrop").contains("blur"))
        assertEquals(0, actions.get())
        capture("perspective-restored")
    }

    @Test fun foregroundArchivesOccludeTheWorkSurfaceDuringExtraction() {
        show(completed = true)
        await("workspace") { it.optString("mode") == "detail" }
        eval("window.rhine.browse();true")
        SystemClock.sleep(2200)
        eval("window.rhine.workspace('modules');true")
        val visibility = mutableListOf<Double>()
        repeat(12) {
            SystemClock.sleep(40)
            visibility += inspect().optJSONObject("face")?.optDouble("visibleFraction", 1.0) ?: 1.0
        }
        assertTrue("Foreground did not occlude UI: $visibility", visibility.any { it < .9 })
        await("extracted face fully visible") {
            it.optString("mode") == "detail" && it.optDouble("cameraDetail") > .99 &&
                (it.optJSONObject("face")?.optDouble("visibleFraction", 0.0) ?: 0.0) > .9
        }
        capture("depth-frosted")
    }

    @Test fun tallerFaceFloatingNavigationAndOriginalDeviceStatus() {
        reduced = true
        show(completed = true)
        await("taller working face") { it.optDouble("workHeightScale", 1.0) > 1.6 && it.optString("mode") == "detail" }
        assertEquals("严格模式", eval("document.querySelector('.ff-health-list > div:first-child dd').textContent"))
        assertEquals(3, (eval("document.querySelectorAll('.ff-health-list [data-health=normal]').length") as Number).toInt())
        assertEquals(1, (eval("document.querySelectorAll('.ff-health-list [data-health=warning]').length") as Number).toInt())
        val navigation = eval("""(()=>{
            const nav=document.querySelector('.workspace-navigation'),rect=nav.getBoundingClientRect();
            return {left:rect.left,bottom:innerHeight-rect.bottom,blur:getComputedStyle(nav).backdropFilter};
        })()""".trimIndent()) as JSONObject
        assertTrue(navigation.toString(), navigation.getDouble("left") >= 12)
        assertTrue(navigation.toString(), navigation.getDouble("bottom") >= 12)
        assertTrue(navigation.getString("blur").contains("blur"))
        assertEquals("0.37", eval("document.querySelector('.ff-footer').dataset.depth"))
        capture("tall-overview-floating-nav")
    }

    @Test fun delayedDepthMasksPresentWithTheMatchingCanvas() {
        show(completed = true)
        await("first matched frame") { (it.optJSONObject("folderFrame")?.optInt("presented", 0) ?: 0) > 0 }
        eval("""(()=>{
            const wait=WebGL2RenderingContext.prototype.clientWaitSync,times=new WeakMap();
            window.restoreMaskEncoder=()=>{WebGL2RenderingContext.prototype.clientWaitSync=wait;};
            WebGL2RenderingContext.prototype.clientWaitSync=function(sync,...args){
                if(!times.has(sync))times.set(sync,performance.now());
                if(performance.now()-times.get(sync)<80)return this.TIMEOUT_EXPIRED;
                return wait.call(this,sync,...args);
            };
            window.rhine.workspace('authorization');return true;
        })()""")
        repeat(20) {
            val pair = eval("""(()=>{
                const panel=document.querySelector('.folder-face-panel'),canvas=document.querySelector('#three-scene canvas');
                return {panel:panel.dataset.folderFrame,canvas:canvas.dataset.folderFrame,retries:Number(panel.dataset.maskRetries||0)};
            })()""") as JSONObject
            assertEquals("Mismatched depth/canvas frame: $pair", pair.getString("canvas"), pair.getString("panel"))
            assertEquals(0, pair.getInt("retries"))
            SystemClock.sleep(40)
        }
        eval("window.restoreMaskEncoder();true")
        await("readable surface after delayed readback") { (it.optJSONObject("face")?.optDouble("visibleFraction", 0.0) ?: 0.0) > .9 && it.optBoolean("canInspect") }
        assertEquals(0, inspect().getJSONObject("folderMask").getInt("syncReads"))
        capture("matched-depth-frame")
    }

    private fun show(completed: Boolean = false, time: Double = 1.76, restored: String? = null) {
        compose.setContent {
            root.set(LocalView.current)
            SkpTheme(AppearanceSettings(themeMode = ThemeMode.LIGHT)) {
                Surface {
                    RhineWebHost(snapshot, active, reduced, allowed, time, completed,
                        onAction = { _, _ -> actions.incrementAndGet(); true },
                        onPresentation = { synchronized(events) { events += it } },
                        onFailure = { failure.set(it) }, modifier = Modifier.fillMaxSize(), initialWorkspace = restored,
                        audioActive = audioActive ?: active)
                }
            }
        }
    }
    private fun inspect(): JSONObject = (eval("window.rhine ? ({...window.rhine.stats(),statusText:document.querySelector('#skp-status')?.textContent}) : {ready:false}") as? JSONObject) ?: JSONObject()
    private fun await(label: String, predicate: (JSONObject) -> Boolean): JSONObject {
        val deadline = SystemClock.uptimeMillis() + 60_000
        var last = JSONObject()
        while (SystemClock.uptimeMillis() < deadline) {
            failure.get()?.let { fail("$label: $it") }
            runCatching { inspect() }.onSuccess { last = it; if (predicate(it)) return it }
            SystemClock.sleep(150)
        }
        fail("$label timed out: $last")
        return last
    }
    private fun eval(expression: String): Any? {
        val latch = CountDownLatch(1)
        val result = AtomicReference<String>()
        instrumentation.runOnMainSync {
            val web = requireNotNull(findWeb(root.get()))
            val script = if (';' in expression && !expression.startsWith("(()=>")) "JSON.stringify((()=>{$expression;return true})())" else "JSON.stringify($expression)"
            web.evaluateJavascript(script) { result.set(it); latch.countDown() }
        }
        check(latch.await(10, TimeUnit.SECONDS)) { "JS callback timed out" }
        val decoded = JSONTokener(result.get()).nextValue()
        return if (decoded is String) JSONTokener(decoded).nextValue() else decoded
    }
    private fun capture(name: String) {
        val submitted = CountDownLatch(1)
        instrumentation.runOnMainSync {
            requireNotNull(findWeb(root.get())).postVisualStateCallback(SystemClock.uptimeMillis(), object : WebView.VisualStateCallback() {
                override fun onComplete(requestId: Long) { submitted.countDown() }
            })
        }
        submitted.await(3, TimeUnit.SECONDS)
        val bitmap = requireNotNull(instrumentation.uiAutomation.takeScreenshot())
        val folder = File(instrumentation.targetContext.getExternalFilesDir(null), "visual/rhine").apply { mkdirs() }
        File(folder, "$name.png").outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        var dark = 0; var light = 0
        for (y in bitmap.height / 10 until bitmap.height * 9 / 10 step 4) for (x in 0 until bitmap.width step 4) {
            val color = bitmap.getPixel(x, y)
            val level = (Color.red(color) + Color.green(color) + Color.blue(color)) / 3
            if (level < 160) dark++
            if (level > 200) light++
        }
        bitmap.recycle()
        File(folder, "$name.json").writeText(inspect().put("screenDarkSamples", dark).put("screenLightSamples", light).toString(2))
        assertTrue("Screen has no visible ink: $name", dark > 20)
        assertTrue("Screen has no visible background: $name", light > 100)
    }
    private fun findWeb(view: View?): WebView? {
        if (view is WebView) return view
        if (view is ViewGroup) for (i in 0 until view.childCount) findWeb(view.getChildAt(i))?.let { return it }
        return null
    }
    companion object {
        private fun fixture(state: EnvironmentState = EnvironmentState.NOT_INSTALLED) = RhineStateMapper.snapshot(
            MainUiState(), HomeUiState(loading = false, environment = EnvironmentInfo(state = state, sdkVersion = "4.6.2")),
            SuperUserUiState(loading = false), ModuleUiState(installedLoading = false, marketLoading = false), SettingsUiState(loading = false))
    }
}
