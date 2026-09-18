package com.linux.permissionmanager.ui.rhine

import com.linux.permissionmanager.data.EnvironmentInfo
import com.linux.permissionmanager.data.EnvironmentState
import com.linux.permissionmanager.data.DownloadProgress
import com.linux.permissionmanager.data.InstalledModule
import com.linux.permissionmanager.data.MarketModule
import com.linux.permissionmanager.data.ModuleRunState
import com.linux.permissionmanager.data.SuGrant
import com.linux.permissionmanager.data.SystemStatus
import com.linux.permissionmanager.ui.HomeUiState
import com.linux.permissionmanager.ui.MainUiState
import com.linux.permissionmanager.ui.ModuleUiState
import com.linux.permissionmanager.ui.RootConfigUiState
import com.linux.permissionmanager.ui.SettingsUiState
import com.linux.permissionmanager.ui.SuperUserUiState
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RhineStateMapperTest {
    @Test fun snapshotContainsAllFiveLanesAndTruthfulEmptyStatesWithoutSecrets() {
        val text = RhineStateMapper.snapshot(
            MainUiState(activeRootKey = "secret-key", rootConfig = RootConfigUiState(rootKey = "edited-key", hotloadCommand = "secret-script")),
            HomeUiState(loading = false, environment = EnvironmentInfo(state = EnvironmentState.NOT_INSTALLED), console = "private-log"),
            SuperUserUiState(loading = false), ModuleUiState(installedLoading = false, marketLoading = false), SettingsUiState(loading = false),
        )
        listOf("secret-key", "edited-key", "secret-script", "private-log").forEach { assertFalse(text.contains(it)) }
        val snapshot = JSONObject(text)
        assertTrue(snapshot.getBoolean("configured"))
        assertEquals("尚未安装", snapshot.getString("statusText"))
        val records = snapshot.getJSONArray("records")
        assertEquals("home.summary", records.getJSONObject(0).getString("id"))
        assertEquals(setOf("授权", "已安装模块", "系统概览", "模块市场", "设置与诊断"),
            (0 until records.length()).map { records.getJSONObject(it).getString("category") }.toSet())
        assertTrue(text.contains("暂无已安装模块"))
        assertTrue(text.contains("暂无市场模块"))
        assertTrue(text.contains("暂无已授权应用"))
    }
    @Test fun actionsHaveKnownNamesAndModuleIdentitySurvivesListReordering() {
        fun module(id: String) = InstalledModule(id, "<script>alert('x')</script>", "1.0", id, "author", "", "26", true, ModuleRunState.RUNNING)
        fun snapshot(order: List<String>) = JSONObject(RhineStateMapper.snapshot(
            MainUiState(), HomeUiState(), SuperUserUiState(grants = listOf(SuGrant("com.test", "Application", null))),
            ModuleUiState(installed = order.map(::module)), SettingsUiState())).getJSONArray("records")
        val first = snapshot(listOf("one", "two"))
        val second = snapshot(listOf("two", "one"))
        fun moduleKey(records: org.json.JSONArray): String = (0 until records.length()).map { records.getJSONObject(it) }
            .first { it.optString("id") == "module:one" }.getString("id")
        assertEquals(moduleKey(first), moduleKey(second))
        for (i in 0 until first.length()) {
            val actions = first.getJSONObject(i).getJSONArray("actions")
            for (j in 0 until actions.length()) assertTrue(actions.getJSONObject(j).getString("action") in RHINE_ACTIONS)
        }
        val text = first.toString()
        assertTrue(text.contains("module.webui.open"))
        assertTrue(text.contains("authorization.remove.request"))
        assertFalse(text.contains("downloadUrl"))
        assertFalse(text.contains("managerUpdateCheck"))
    }

    @Test fun sectionRootsAndStructuredFieldsDoNotDependOnTranslatedProse() {
        val records = records()
        assertEquals(setOf("home", "authorization", "modules", "market", "settings"), records.map { it.getString("section") }.toSet())
        assertEquals(setOf("home.summary", "authorization:manager", "modules:manager", "market:catalog", "settings:controls"),
            records.filter { it.getBoolean("isRoot") }.map { it.getString("id") }.toSet())
        val home = records.first { it.getString("id") == "home.summary" }
        assertEquals("not_installed", home.getJSONObject("status").getString("code"))
        assertTrue(home.fields().any { it.getString("key") == "coreVersion" })
        assertTrue(home.fields().any { it.getString("key") == "configured" })
        assertFalse(home.fields().any { it.getString("key") in setOf("adbEnabled", "selinux", "seccomp", "oplusIntercepted") })
        assertTrue(home.fields().none { it.has("healthy") })
    }

    @Test fun selinuxUsesOriginalManagerStrictFallbackAndHealthCheck() {
        mapOf(-1 to ("严格模式" to true), 0 to ("宽容模式" to false), 1 to ("严格模式" to true),
            7 to ("严格模式" to true)).forEach { (value, expected) ->
            val field = deviceFields(SystemStatus(selinux = value)).getValue("selinux")
            assertEquals(expected.first, field.getString("value"))
            assertEquals(expected.second, field.getBoolean("healthy"))
        }
    }

    @Test fun seccompHasOriginalManagerLabelsAndOnlyFilterModeIsHealthy() {
        mapOf(-1 to ("未知" to false), 0 to ("未开启" to false), 1 to ("严格模式" to false),
            2 to ("过滤模式" to true), 3 to ("未知" to false)).forEach { (value, expected) ->
            val field = deviceFields(SystemStatus(seccomp = value)).getValue("seccomp")
            assertEquals(expected.first, field.getString("value"))
            assertEquals(expected.second, field.getBoolean("healthy"))
        }
    }

    @Test fun adbAndOplusUseOriginalManagerBooleanLabelsAndHealthChecks() {
        listOf(false, true).forEach { enabled ->
            val fields = deviceFields(SystemStatus(adbEnabled = enabled, oplusIntercepted = enabled))
            val adb = fields.getValue("adbEnabled")
            assertEquals(if (enabled) "已开启" else "未开启", adb.getString("value"))
            assertEquals(!enabled, adb.getBoolean("healthy"))
            val oplus = fields.getValue("oplusIntercepted")
            assertEquals("OPlus 接口", oplus.getString("label"))
            assertEquals(if (enabled) "已拦截" else "无需拦截", oplus.getString("value"))
            assertTrue(oplus.getBoolean("healthy"))
        }
    }

    @Test fun versionValuesStayUnmodifiedLikeOriginalManager() {
        val originalVersion = "4.6.2-preview.1"
        val originalSdk = "4.7"
        val home = records(home = HomeUiState(loading = false,
            environment = EnvironmentInfo(installedVersion = originalVersion, sdkVersion = originalSdk)))
            .first { it.getString("id") == "home.summary" }
        val fields = home.fields().associateBy { it.getString("key") }
        assertEquals(originalVersion, fields.getValue("installedVersion").getString("value"))
        assertEquals(originalSdk, fields.getValue("sdkVersion").getString("value"))
    }

    @Test fun homePrimaryTracksConfigurationAndEnvironmentAndRetainsDirectConsoleAndLog() {
        fun primary(state: EnvironmentState, configured: Boolean = true): String {
            val home = records(main = MainUiState(activeRootKey = if (configured) "secret" else ""),
                home = HomeUiState(loading = false, environment = EnvironmentInfo(state = state))).first()
            val actions = home.actions()
            assertEquals(listOf("console.open", "log.open"), actions.filter { it.optString("placement") == "secondary" }.map { it.getString("action") })
            return actions.single { it.getBoolean("primary") }.getString("action")
        }
        assertEquals("root.config.open", primary(EnvironmentState.NOT_INSTALLED, false))
        assertEquals("environment.install.request", primary(EnvironmentState.NOT_INSTALLED))
        assertEquals("environment.install.request", primary(EnvironmentState.OUTDATED))
        assertEquals("root.test", primary(EnvironmentState.RUNNING))
        assertEquals("reboot.options.open", primary(EnvironmentState.PENDING_REBOOT))
        assertEquals("refresh", primary(EnvironmentState.UNKNOWN))
    }

    @Test fun actionsHaveUniqueStableIdsAndConstrainedVisualPriority() {
        val all = records(modules = ModuleUiState(installed = listOf(module("one"), module("two")), installedLoading = false, marketLoading = false))
        val actions = all.flatMap { it.actions() }
        assertEquals(actions.size, actions.map { it.getString("id") }.toSet().size)
        all.forEach { record ->
            assertTrue(record.actions().count { it.getString("placement") == "primary" } <= 1)
            assertTrue(record.actions().count { it.getString("placement") == "secondary" } <= 2)
        }
        val first = all.first { it.getString("id") == "module:one" }.actions().map { it.getString("id") }
        val reordered = records(modules = ModuleUiState(installed = listOf(module("two"), module("one"))))
            .first { it.getString("id") == "module:one" }.actions().map { it.getString("id") }
        assertEquals(first, reordered)
        assertTrue(actions.filter { it.getString("action") in setOf("module.remove.request", "log.clear.request", "reboot.options.open") }
            .all { it.getBoolean("destructive") })
    }

    @Test fun settingToggleIdentitySurvivesCheckedStateChanges() {
        fun toggles(enabled: Boolean) = records(settings = SettingsUiState(loading = false, bootFailProtect = enabled,
            adbForcedDisabled = enabled, logEnabled = enabled)).first { it.getString("id") == "settings:controls" }
            .actions().filter { it.getString("action") == "settings.toggle" }
        val off = toggles(false)
        val on = toggles(true)
        assertEquals(3, off.size)
        assertEquals(off.map { it.getString("id") }, on.map { it.getString("id") })
        off.forEach { assertEquals("toggle", it.getString("control")); assertFalse(it.getBoolean("checked")); assertTrue(it.getJSONObject("payload").getBoolean("enabled")) }
        on.forEach { assertTrue(it.getBoolean("checked")); assertFalse(it.getJSONObject("payload").getBoolean("enabled")) }
        assertEquals(3, off.map { it.getString("id") }.toSet().size)
    }

    @Test fun emptyLoadingAndErrorListsAreDistinguishedWithoutLeakingRawErrors() {
        val empty = records().first { it.getString("id") == "authorization:manager" }
        assertTrue(empty.getBoolean("empty"))
        assertEquals(0, empty.getInt("count"))
        assertEquals("empty", empty.getJSONObject("status").getString("code"))
        val loading = records(authorization = SuperUserUiState(loading = true)).first { it.getString("id") == "authorization:manager" }
        assertTrue(loading.getBoolean("loading"))
        assertFalse(loading.getBoolean("empty"))
        assertEquals("loading", loading.getJSONObject("status").getString("code"))
        val error = records(authorization = SuperUserUiState(loading = false, error = "private-path /secret/command"))
            .first { it.getString("id") == "authorization:manager" }
        assertFalse(error.getBoolean("empty"))
        assertEquals("error", error.getJSONObject("status").getString("code"))
        assertFalse(error.toString().contains("private-path"))
    }

    @Test fun downloadProgressAndCancellationRemainAvailableWhileInstallActionsAreDisabled() {
        val all = records(modules = ModuleUiState(busy = true, installedLoading = false, marketLoading = false,
            download = DownloadProgress("Module", 25, 100), market = listOf(MarketModule("模块", "Module", "", "1", "id", "", "", "", "private-url", "", ""))))
        val download = all.first { it.getString("id") == "market:download" }
        assertEquals("download", download.getString("kind"))
        assertEquals(0.25, download.getDouble("progress"), 0.0001)
        assertFalse(download.actions().single().getBoolean("disabled"))
        assertTrue(all.first { it.getString("id") == "modules:manager" }.actions().filter { it.getString("action") == "module.pick" }.all { it.getBoolean("disabled") })
        val marketAction = all.first { it.getString("id") == "market:id" }.actions().single()
        assertTrue(marketAction.getBoolean("disabled"))
        assertTrue(marketAction.getString("disabledReason").isNotBlank())
        assertFalse(all.toString().contains("private-url"))
    }

    @Test fun actionKeywordsMakeAliasesSearchableWithoutBackendStrings() {
        val actions = records().flatMap { it.actions() }
        assertTrue(actions.first { it.getString("action") == "reboot.options.open" }.getJSONArray("keywords").toString().contains("重启"))
        assertTrue(actions.first { it.getString("action") == "authorization.adb.add" }.getJSONArray("keywords").toString().contains("ADB"))
        assertTrue(actions.first { it.getString("action") == "appearance.open" }.getJSONArray("keywords").toString().contains("静音"))
    }

    private fun module(id: String) = InstalledModule(id, "Module", "1.0", id, "author", "", "26", true, ModuleRunState.RUNNING)
    private fun JSONObject.actions() = getJSONArray("actions").let { values -> (0 until values.length()).map { values.getJSONObject(it) } }
    private fun JSONObject.fields() = getJSONArray("fields").let { values -> (0 until values.length()).map { values.getJSONObject(it) } }
    private fun deviceFields(system: SystemStatus) = records(home = HomeUiState(loading = false, system = system))
        .first { it.getString("id") == "system:security" }.fields().associateBy { it.getString("key") }
    private fun records(
        main: MainUiState = MainUiState(),
        home: HomeUiState = HomeUiState(loading = false, environment = EnvironmentInfo(state = EnvironmentState.NOT_INSTALLED)),
        authorization: SuperUserUiState = SuperUserUiState(loading = false),
        modules: ModuleUiState = ModuleUiState(installedLoading = false, marketLoading = false),
        settings: SettingsUiState = SettingsUiState(loading = false),
    ) = JSONObject(RhineStateMapper.snapshot(main, home, authorization, modules, settings)).getJSONArray("records")
        .let { values -> (0 until values.length()).map { values.getJSONObject(it) } }
}
