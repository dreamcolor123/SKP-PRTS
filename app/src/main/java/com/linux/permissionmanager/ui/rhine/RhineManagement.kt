package com.linux.permissionmanager.ui.rhine

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import com.linux.permissionmanager.ui.rhine.RhineButton as Button
import com.linux.permissionmanager.ui.rhine.RhineTextButton as TextButton
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.linux.permissionmanager.PermissionManagerApplication
import com.linux.permissionmanager.data.*
import com.linux.permissionmanager.ui.*
import com.linux.permissionmanager.ui.screens.*
import com.linux.permissionmanager.utils.ModuleWebUiShortcutRequest
import org.json.JSONObject

private data class NativeRequest(val action: String, val payload: JSONObject, val confirmation: RhineConfirmation)

class RhineOverlayViewModel : ViewModel() {
    internal var action by mutableStateOf<String?>(null)
    internal var payload = JSONObject()
    internal var confirmation = RhineConfirmation()
    internal var command by mutableStateOf<String?>(null)
    internal var reboot by mutableStateOf<RebootOption?>(null)
}

/** The renderer requests existing manager actions; it never receives execution capability. */
@Composable
internal fun RhineManagement(
    application: PermissionManagerApplication,
    session: RhineSessionViewModel,
    main: MainViewModel,
    home: HomeViewModel,
    authorization: SuperUserViewModel,
    modules: ModuleViewModel,
    settings: SettingsViewModel,
    customizer: LocalCustomizerViewModel,
    active: Boolean,
    audioActive: Boolean,
    reducedMotion: Boolean,
    onConsole: (String) -> Unit,
    onLegacyAppearance: () -> Unit,
) {
    val mainState by main.state.collectAsStateWithLifecycle()
    val homeState by home.state.collectAsStateWithLifecycle()
    val authorizationState by authorization.state.collectAsStateWithLifecycle()
    val moduleState by modules.state.collectAsStateWithLifecycle()
    val settingsState by settings.state.collectAsStateWithLifecycle()
    val overlays: RhineOverlayViewModel = viewModel()
    val snapshot = remember(mainState, homeState, authorizationState, moduleState, settingsState) {
        RhineStateMapper.snapshot(mainState, homeState, authorizationState, moduleState, settingsState)
    }
    val busy = mainState.rootConfig.busy || homeState.busyAction != null || authorizationState.busy ||
        moduleState.busy || settingsState.busyItem != null
    fun isBusyNow() = main.state.value.rootConfig.busy || home.state.value.busyAction != null ||
        authorization.state.value.busy || modules.state.value.busy || settings.state.value.busyItem != null
    val pending = overlays.action?.let { NativeRequest(it, overlays.payload, overlays.confirmation) }
    fun dismiss() { overlays.confirmation.cancel(); overlays.action = null; overlays.payload = JSONObject() }
    fun consume(request: NativeRequest): Boolean = request.confirmation.consume(overlays.action == request.action && overlays.payload === request.payload && !isBusyNow())
    fun open(action: String, payload: JSONObject = JSONObject()): Boolean {
        if (overlays.action != null || overlays.reboot != null || main.state.value.rootConfig.visible || isBusyNow()) return false
        overlays.payload = payload
        overlays.confirmation = RhineConfirmation()
        overlays.action = action
        return true
    }
    fun installed(payload: JSONObject) = modules.state.value.installed.firstOrNull { it.id == payload.optString("id") }
    fun market(payload: JSONObject) = modules.state.value.market.firstOrNull { it.id == payload.optString("id") }
    val dispatch: (String, JSONObject) -> Boolean = dispatch@{ action, payload ->
        val busy = isBusyNow()
        when (action) {
            "navigation.exit" -> { application.container.events.emit(UiEffect.FinishActivity); true }
            "fallback.open" -> { session.basicManagement.value = true; true }
            "root.config.open" -> if (busy || overlays.action != null) false else { main.showRootConfig(); true }
            "refresh", "home.refresh" -> {
                when (payload.optString("scope", "home")) {
                    "authorization" -> authorization.refresh()
                    "modules" -> modules.refreshInstalled()
                    "market" -> modules.refreshMarket()
                    "settings" -> settings.refresh()
                    else -> home.refresh()
                }; true
            }
            "authorization.refresh" -> { authorization.refresh(); true }
            "module.refresh", "modules.refresh" -> { modules.refreshInstalled(); true }
            "market.refresh" -> { modules.refreshMarket(); true }
            "settings.refresh" -> { settings.refresh(); true }
            "page.select" -> { main.selectPage(payload.optInt("index", 0)); true }
            "module.tab.select" -> { modules.selectTab(payload.optInt("index", 0)); true }
            "console.open" -> { onConsole(homeState.console); true }
            "console.copy" -> { home.copyConsole(); true }
            "console.clear" -> { home.clearConsole(); true }
            "root.test" -> if (busy) false else { home.testRoot(); true }
            "authorization.picker.open" -> if (busy) false else { authorization.showPicker(); true }
            "authorization.search" -> { authorization.setQuery(payload.optString("query")); true }
            "market.search" -> { modules.setMarketQuery(payload.optString("query")); true }
            "module.pick" -> if (busy || moduleState.download != null) false else {
                modules.requestPick(payload.optBoolean("runOnce")); true
            }
            "module.details" -> installed(payload)?.let { modules.showDetails(it); true } ?: false
            "module.webui.open" -> if (busy) false else installed(payload)?.let { modules.openWebUi(it); true } ?: false
            "module.update.check" -> if (busy) false else installed(payload)?.let { modules.checkUpdate(it); true } ?: false
            "module.changelog" -> installed(payload)?.let { modules.showChangelog(it); true } ?: false
            "download.cancel" -> if (moduleState.download?.cancellable == true) { modules.cancelDownload(); true } else false
            "log.open" -> { settings.showLog(); true }
            "customizer.open" -> if (busy) false else { customizer.show(); true }
            "appearance.open" -> { onLegacyAppearance(); true }
            "settings.toggle" -> {
                if (busy || !payload.has("enabled")) false else when (payload.optString("key")) {
                    "bootFailProtect" -> { settings.setBootFail(payload.getBoolean("enabled")); true }
                    "adbForcedDisabled" -> { settings.setAdbDisabled(payload.getBoolean("enabled")); true }
                    "logEnabled" -> { settings.setLogEnabled(payload.getBoolean("enabled")); true }
                    else -> false
                }
            }
            "link.open" -> {
                val link = when (payload.optString("linkId")) {
                    "guide" -> "https://abcz316.github.io/SKRoot-linuxKernelRoot/skroot_pro_app/module_developer_help.pdf"
                    "upstream" -> "https://github.com/abcz316/SKRoot-linuxKernelRoot"
                    "compose" -> UpdateRepository.REPOSITORY_URL
                    "reference" -> "https://github.com/LBEILC/RhineLabUI"
                    "telegram" -> "https://t.me/skrootabc"
                    "market.source" -> market(payload)?.sourceUrl
                    "market.download" -> market(payload)?.downloadUrl
                    "module.source" -> moduleState.market.firstOrNull { it.id == payload.optString("moduleId") }?.sourceUrl
                    else -> null
                }
                if (link.isNullOrBlank()) false else { settings.openUrl(link); true }
            }
            "environment.install.request", "environment.uninstall.request", "command.input.open",
            "authorization.adb.add", "authorization.remove.request", "authorization.clear.request",
            "module.remove.request", "module.update.request", "market.install.request",
            "module.shortcut.open", "log.clear.request", "reboot.options.open", "diagnostics.open",
            "authorization.search.open" -> open(action, payload)
            else -> false
        }
    }
    val rendererActive = active && pending == null && overlays.reboot == null && !authorizationState.pickerVisible &&
        !homeState.showCveSoftRebootPrompt && session.rendererError.value == null
    key(session.rendererGeneration.value) {
        RhineWebHost(
            snapshot = snapshot,
            active = rendererActive,
            audioActive = audioActive && session.rendererError.value == null,
            reducedMotion = reducedMotion,
            bootAllowed = !mainState.rootConfig.visible && !mainState.rootConfig.busy,
            initialBootTime = session.bootTime.value,
            initialBootCompleted = session.bootCompleted.value,
            initialWorkspace = session.workspace.value,
            sensorEnabled = session.sensorEnabled.value,
            onAction = dispatch,
            onPresentation = { state ->
                if (state.has("sensorEnabled")) session.sensorEnabled.value = state.optBoolean("sensorEnabled")
                state.optJSONObject("workspace")?.let { session.workspace.value = it.toString() }
                if (state.has("rendererError")) session.rendererError.value = state.optString("rendererError")
                if (state.has("time")) session.bootTime.value = state.optDouble("time", 1.76).coerceIn(0.0, 35.0)
                if (state.has("bootTime")) session.bootTime.value = state.optDouble("bootTime", 1.76).coerceIn(0.0, 35.0)
                if (state.has("bootCompleted")) session.bootCompleted.value = state.optBoolean("bootCompleted")
                if (state.has("completed")) session.bootCompleted.value = state.optBoolean("completed")
                if (state.has("dark")) {
                    val theme = if (state.optBoolean("dark")) ThemeMode.DARK else ThemeMode.LIGHT
                    if (application.container.appearance.state.value.themeMode != theme) application.container.appearance.setThemeMode(theme)
                }
            },
            onFailure = { reason ->
                session.rendererError.value = reason
            },
            modifier = Modifier.fillMaxSize().safeDrawingPadding(),
        )
    }
    session.rendererError.value?.let { error ->
        RhineDialog("界面加载失败", { session.rendererError.value = null; session.basicManagement.value = true },
            confirm = { session.rendererError.value = null; session.rendererGeneration.value++ }, confirmLabel = "重试界面") {
            Text(error)
            TextButton(onClick = { session.rendererError.value = null; session.basicManagement.value = true }) { Text("进入基础管理") }
        }
    }
    if (authorizationState.pickerVisible) AppPickerDialog(
        state = authorizationState,
        onDismiss = authorization::hidePicker,
        onSearch = authorization::setPickerQuery,
        onFilterSystem = { authorization.setFilters(system = it) },
        onFilterThirdParty = { authorization.setFilters(thirdParty = it) },
        onSelect = { if (!isBusyNow() && authorization.state.value.pickerVisible) { authorization.hidePicker(); authorization.add(it) } },
    )
    if (homeState.showCveSoftRebootPrompt) RhineDialog(
        "环境安装完成", { home.dismissCveSoftRebootPrompt(true) },
        confirm = { if (home.state.value.showCveSoftRebootPrompt && !isBusyNow()) { home.dismissCveSoftRebootPrompt(false); settings.reboot(null, true) } },
        confirmLabel = "软重启", dismissLabel = "不需要",
    ) { Text("当前 CVE 热启动环境已即时生效，模块也已激活。一般无需软重启；仅在使用改机型等特殊模块时再执行软重启。") }

    pending?.let { request ->
        val payload = request.payload
        val module = installed(payload)
        val marketModule = market(payload)
        val grant = authorizationState.grants.firstOrNull { it.packageName == payload.optString("packageName") }
        when (request.action) {
            "command.input.open" -> {
                if (overlays.command == null) overlays.command = application.container.settings.lastRootCommand
                RhineDialog("执行 Root 命令", ::dismiss, confirm = {
                    if (!consume(request)) return@RhineDialog
                    val command = overlays.command.orEmpty(); dismiss()
                    if (command.isNotBlank()) home.runCommand(command)
                }, confirmLabel = "执行", enabled = !busy && !overlays.command.isNullOrBlank()) {
                    OutlinedTextField(overlays.command.orEmpty(), { overlays.command = it }, Modifier.fillMaxWidth(), label = { Text("命令") })
                }
            }
            "authorization.search.open" -> RhineDialog("检索授权", ::dismiss, confirm = ::dismiss, confirmLabel = "完成") {
                OutlinedTextField(authorizationState.query, authorization::setQuery, Modifier.fillMaxWidth(), label = { Text("应用或包名") })
            }
            "reboot.options.open" -> RebootOptionsDialog(::dismiss) { dismiss(); overlays.reboot = it }
            "module.shortcut.open" -> if (module == null) {
                RhineDialog("模块已不存在", ::dismiss) { Text("刷新模块列表后重试。") }
            } else WebUiShortcutDialog(module, ::dismiss) { name, icon ->
                if (!consume(request)) return@WebUiShortcutDialog
                dismiss(); modules.requestWebUiShortcut(ModuleWebUiShortcutRequest(module.id, module.name, name, icon))
            }
            "diagnostics.open" -> RhineDialog("核心诊断", ::dismiss) {
                val basic = payload.optString("kind", "basic") !in setOf("module", "modules")
                val choices = if (basic) listOf("通道检查" to "Channel", "内核起始地址" to "KernelBase", "写入内存测试" to "WriteTest", "读取跳板" to "ReadTrampoline", "写入跳板" to "WriteTrampoline", "物理地址计算" to "PhysAddrCalc")
                else listOf("Root 权限模块（打印）" to "RootBridgePrint", "Root 权限模块（执行）" to "RootBridgeExec", "su 重定向（打印）" to "SuRedirectPrint", "su 重定向（执行）" to "SuRedirectExec", "系统目录净化（打印）" to "TombstonesPurgePrint")
                choices.forEach { (label, value) -> TextButton(onClick = {
                    if (consume(request)) { dismiss(); if (basic) settings.testBasic(value) else settings.testDefaultModule(value) }
                }, enabled = !busy, modifier = Modifier.fillMaxWidth()) { Text(label) } }
            }
            else -> {
                val title: String
                val explanation: String
                val valid: Boolean
                when (request.action) {
                    "environment.install.request" -> {
                        title = if (homeState.environment.state == EnvironmentState.OUTDATED) "更新 SKRoot 环境？" else "安装 SKRoot 环境？"
                        explanation = "将向设备写入 SKRoot 核心环境。请确认 Root Key 和当前模式配置正确。\n当前模式：${if (homeState.environment.hotload) "热启动 · ${homeState.environment.hotloadMethod}" else "Boot"}"
                        valid = homeState.environment.state != EnvironmentState.PENDING_REBOOT
                    }
                    "environment.uninstall.request" -> { title = "卸载 SKRoot 环境？"; explanation = "这会同时清空 SU 授权列表并删除已安装模块。"; valid = true }
                    "authorization.adb.add" -> { title = "添加 ADB 授权？"; explanation = "允许 com.android.shell 使用 SU 权限。"; valid = true }
                    "authorization.remove.request" -> { title = "移除授权？"; explanation = "确定移除 ${grant?.label ?: payload.optString("packageName")} 的 SU 授权吗？"; valid = grant != null }
                    "authorization.clear.request" -> { title = "清空所有授权？"; explanation = "所有应用的 SU 授权都将被移除。"; valid = true }
                    "module.remove.request" -> { title = "删除模块？"; explanation = "确定删除 ${module?.name.orEmpty()} 吗？重启后生效。"; valid = module != null }
                    "module.update.request" -> { title = "更新 ${module?.name.orEmpty()}？"; explanation = "检测到新版本 ${module?.update?.latestVersion.orEmpty()}，是否下载并安装？"; valid = module?.update?.hasNewVersion == true && moduleState.download == null }
                    "market.install.request" -> { title = "安装 ${marketModule?.displayName.orEmpty()}？"; explanation = marketModule?.chineseAlert?.ifBlank { "将下载模块 ZIP 并自动安装。" }.orEmpty(); valid = marketModule != null && moduleState.download == null }
                    "log.clear.request" -> { title = "清理日志？"; explanation = "当前 SKRoot 日志将被删除。"; valid = true }
                    else -> { title = "操作不可用"; explanation = "请刷新后重试。"; valid = false }
                }
                RhineDialog(title, ::dismiss, confirm = {
                    // Consume the pending confirmation before invoking a business callback.
                    if (!valid || !consume(request)) return@RhineDialog
                    dismiss()
                    when (request.action) {
                        "environment.install.request" -> home.install(mainState.activeRootKey)
                        "environment.uninstall.request" -> home.uninstall()
                        "authorization.adb.add" -> authorization.addAdb()
                        "authorization.remove.request" -> grant?.let(authorization::remove)
                        "authorization.clear.request" -> authorization.clear()
                        "module.remove.request" -> module?.let(modules::remove)
                        "module.update.request" -> module?.let(modules::downloadUpdate)
                        "market.install.request" -> marketModule?.let(modules::downloadMarket)
                        "log.clear.request" -> settings.clearLog()
                    }
                }, enabled = valid && !busy) {
                    Text(explanation)
                    if (request.action == "market.install.request" && marketModule != null) TextButton(onClick = { dismiss(); settings.openUrl(marketModule.downloadUrl) }) { Text("浏览器下载 ↗") }
                }
            }
        }
    }
    overlays.reboot?.let { option -> RebootConfirmDialog(option, { overlays.reboot = null }) {
        if (overlays.reboot != null && !busy) { overlays.reboot = null; settings.reboot(option.command, option.soft) }
    } }
}

@Composable
internal fun RhineDialog(
    title: String,
    onDismiss: () -> Unit,
    confirm: (() -> Unit)? = null,
    confirmLabel: String = "确认",
    dismissLabel: String = "取消",
    enabled: Boolean = true,
    content: @Composable ColumnScope.() -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("SKROOT PRO / SYSTEM", style = MaterialTheme.typography.labelSmall)
            HorizontalDivider()
            Text(title)
        } },
        text = { Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(16.dp), content = content) },
        confirmButton = { if (confirm != null) Button(onClick = confirm, enabled = enabled) { Text("$confirmLabel  →") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text(dismissLabel) } },
    )
}
