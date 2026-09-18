package com.linux.permissionmanager.utils

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class HotloadSupportTest {
    @Test
    fun missingOrUnknownMethodDefaultsToShell() {
        listOf(null, "", " ", "UNKNOWN", "CVE-UNKNOWN").forEach { value ->
            val method = HotloadSupport.methodFromConfig(value)
            assertEquals("SHELL", method)
            assertEquals("", HotloadSupport.exploitMethod(method))
            assertEquals(70L, HotloadSupport.scriptTimeoutSeconds(method))
            assertEquals("payload", HotloadSupport.prepareScript(method, "/data/app/lib", "payload"))
        }
    }

    @Test
    fun recognizedMethodsMatchUpstreamConfigCaseInsensitively() {
        assertEquals("SHELL", HotloadSupport.methodFromConfig("shell"))
        assertEquals("MAGICA", HotloadSupport.methodFromConfig("magica"))
        assertEquals("MAGICA", HotloadSupport.methodFromConfig("MAGICA"))
        assertEquals(HotloadSupport.CVE_2026_43499, HotloadSupport.methodFromConfig("cve-2026-43499"))
        assertEquals(HotloadSupport.CVE_2026_43499, HotloadSupport.methodFromConfig("CVE-2026-43499"))
    }

    @Test
    fun installModesMatchUpstreamProtocol() {
        assertEquals(
            EnvironmentInstallMode.BOOT,
            HotloadSupport.installMode(hotload = false, method = HotloadSupport.CVE_2026_43499),
        )
        assertEquals(
            EnvironmentInstallMode.HOTLOAD,
            HotloadSupport.installMode(hotload = true, method = "SHELL"),
        )
        assertEquals(
            EnvironmentInstallMode.HOTLOAD,
            HotloadSupport.installMode(hotload = true, method = "cve-2026-43499"),
        )
    }

    @Test
    fun exploitMethodUsesTheNewUpstreamThirdArgument() {
        assertEquals("", HotloadSupport.exploitMethod("SHELL"))
        assertEquals("MAGICA", HotloadSupport.exploitMethod("magica"))
        assertEquals(HotloadSupport.CVE_2026_43499, HotloadSupport.exploitMethod(" cve-2026-43499 "))
    }

    @Test
    fun cveHotloadUsesExtendedScriptTimeout() {
        assertEquals(70L, HotloadSupport.scriptTimeoutSeconds("SHELL"))
        assertEquals(70L, HotloadSupport.scriptTimeoutSeconds("MAGICA"))
        assertEquals(180L, HotloadSupport.scriptTimeoutSeconds(" cve-2026-43499 "))
    }

    @Test
    fun ordinaryHotloadScriptIsUnchanged() {
        val payload = "#!/system/bin/sh\necho payload\n"
        assertEquals(payload, HotloadSupport.prepareScript("SHELL", "/data/app/lib", payload))
    }

    @Test
    fun cveHotloadPrependsUpstreamGhostlockBootstrap() {
        val payload = "# ROOT_KEY=KEY\necho payload\n"
        val script = HotloadSupport.prepareScript(
            HotloadSupport.CVE_2026_43499,
            "/data/app/example/lib/arm64",
            payload,
        )

        val executable = "/data/app/example/lib/arm64/${HotloadSupport.GHOSTLOCK_LIBRARY}"
        assertTrue(script.startsWith("#!/system/bin/sh\n"))
        assertFalse(script.contains("[DEBUG] SCRIPT_PATH"))
        assertFalse(script.contains("[DEBUG] size="))
        assertTrue(script.contains("'$executable' \"\$SCRIPT_PATH\" \"\$SCRIPT_PATH\""))
        assertTrue(script.indexOf(executable) < script.indexOf(payload))
        assertTrue(script.endsWith(payload))
        assertFalse(script.contains("ROOT_KEY=KEY\n#!/system/bin/sh"))
    }
}
