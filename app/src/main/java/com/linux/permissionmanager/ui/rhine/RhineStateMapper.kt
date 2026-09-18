package com.linux.permissionmanager.ui.rhine

import com.linux.permissionmanager.BuildConfig
import com.linux.permissionmanager.data.EnvironmentState
import com.linux.permissionmanager.data.ModuleRunState
import com.linux.permissionmanager.ui.HomeUiState
import com.linux.permissionmanager.ui.MainUiState
import com.linux.permissionmanager.ui.ModuleUiState
import com.linux.permissionmanager.ui.SettingsUiState
import com.linux.permissionmanager.ui.SuperUserUiState
import org.json.JSONArray
import org.json.JSONObject

/** Display-only projection. Secrets, shell strings, paths and raw logs never cross this boundary. */
object RhineStateMapper {
    fun snapshot(main: MainUiState, home: HomeUiState, authorization: SuperUserUiState,
                 modules: ModuleUiState, settings: SettingsUiState): String {
        val records = JSONArray()
        val busy = main.rootConfig.busy || home.busyAction != null || authorization.busy || modules.busy || settings.busyItem != null
        val configured = main.activeRootKey.isNotBlank()
        val environment = when {
            home.loading -> "正在检测"
            home.error != null -> "检测失败"
            else -> when (home.environment.state) {
                EnvironmentState.RUNNING -> "正常运行"
                EnvironmentState.OUTDATED -> "需要更新"
                EnvironmentState.PENDING_REBOOT -> "等待重启"
                EnvironmentState.NOT_INSTALLED -> "尚未安装"
                EnvironmentState.FAULT -> "环境异常"
                EnvironmentState.CHECKING -> "正在检测"
                EnvironmentState.UNKNOWN -> "状态未知"
            }
        }
        fun action(label: String, action: String, payload: JSONObject = JSONObject(), disabled: Boolean = busy,
                   placement: String = "overflow", disabledReason: String? = null) =
            JSONObject().put("label", label).put("action", action).put("payload", payload).put("disabled", disabled)
                .put("placement", placement).put("primary", placement == "primary")
                .put("destructive", action in destructiveActions)
                .put("keywords", JSONArray(listOf(label) + actionKeywords(action, payload)))
                .apply {
                    if (disabled) put("disabledReason", disabledReason ?: if (busy) "有操作正在进行，请稍候" else "当前状态不可用")
                    if (action == "settings.toggle") {
                        put("control", "toggle").put("checked", !payload.getBoolean("enabled"))
                        put("controlLabel", when (payload.optString("key")) {
                            "bootFailProtect" -> "启动保护"
                            "adbForcedDisabled" -> "强制关闭 ADB"
                            else -> "日志记录"
                        })
                    }
                }
        fun payload(key: String, value: Any) = JSONObject().put(key, value)
        fun field(key: String, label: String, value: Any, healthy: Boolean? = null) =
            JSONObject().put("key", key).put("label", label).put("value", value).apply {
                healthy?.let { put("healthy", it) }
            }
        fun status(code: String, label: String, tone: String = "neutral") = JSONObject().put("code", code).put("label", label).put("tone", tone)
        fun listStatus(loading: Boolean, error: String?, count: Int) = when {
            loading -> status("loading", "正在读取", "progress")
            error != null -> status("error", "读取失败", "error")
            count == 0 -> status("empty", "暂无项目")
            else -> status("ready", "$count 个项目", "success")
        }
        fun record(key: String, code: String, title: String, en: String, category: String, abstract: String,
                   findings: List<String>, actions: List<JSONObject>, lead: String = "SKRoot Pro", date: String = "4.6.2.1",
                   kind: String = "summary", state: JSONObject = status("ready", "已就绪"), fields: List<JSONObject> = emptyList(),
                   loading: Boolean = false, error: String? = null, count: Int? = null, progress: Float? = null) {
            val section = when (category) {
                "授权" -> "authorization"
                "已安装模块" -> "modules"
                "模块市场" -> "market"
                "设置与诊断" -> "settings"
                else -> "home"
            }
            actions.forEach { item ->
                val data = item.getJSONObject("payload")
                // Toggle identity excludes its current target value, so focus survives a state refresh.
                val identity = data.keys().asSequence().filter { it != "enabled" }.sorted()
                    .joinToString("&") { "$it=${data.get(it)}" }
                item.put("id", "$key/${item.getString("action")}${if (identity.isBlank()) "" else "?$identity"}")
            }
            records.put(JSONObject().put("key", key).put("id", key).put("code", records.length() + 1).put("displayCode", code).put("title", title).put("en", en)
                .put("department", category).put("category", category).put("date", date).put("lead", lead)
                .put("clearance", "LOCAL").put("abstract", abstract).put("findings", JSONArray(findings))
                .put("source", "").put("actions", JSONArray(actions)).put("section", section).put("kind", kind)
                .put("isRoot", key in setOf("home.summary", "authorization:manager", "modules:manager", "market:catalog", "settings:controls"))
                .put("status", state).put("fields", JSONArray(fields)).put("loading", loading)
                .put("empty", !loading && error == null && count == 0).apply {
                    // Raw backend errors may contain paths or command fragments; only display a fixed diagnostic.
                    if (error != null) put("error", "读取失败，请刷新重试")
                    if (count != null) put("count", count)
                    if (progress != null) put("progress", progress.toDouble())
                })
        }
        val primaryHomeAction = when {
            !configured -> "root.config.open"
            home.loading || home.error != null -> "refresh"
            home.environment.state == EnvironmentState.NOT_INSTALLED || home.environment.state == EnvironmentState.OUTDATED || home.environment.state == EnvironmentState.FAULT -> "environment.install.request"
            home.environment.state == EnvironmentState.PENDING_REBOOT -> "reboot.options.open"
            home.environment.state == EnvironmentState.RUNNING -> "root.test"
            else -> "refresh"
        }
        fun homePlacement(name: String) = if (name == primaryHomeAction) "primary" else "overflow"
        val environmentStatus = status(
            if (home.loading) "loading" else if (home.error != null) "error" else home.environment.state.name.lowercase(), environment,
            if (home.loading) "progress" else if (home.error != null || home.environment.state == EnvironmentState.FAULT) "error"
            else if (home.environment.state == EnvironmentState.RUNNING) "success" else "warning")
        // Keep the same device-health semantics as the original manager, including restricted SELinux reads.
        val selinux = if (home.system.selinux == 0) "宽容模式" else "严格模式"
        val seccomp = when (home.system.seccomp) { 0 -> "未开启"; 1 -> "严格模式"; 2 -> "过滤模式"; else -> "未知" }
        val adb = if (home.system.adbEnabled) "已开启" else "未开启"
        val oplus = if (home.system.oplusIntercepted) "已拦截" else "无需拦截"
        // The original scene initializes on record zero in its central column.
        record("home.summary", "S-001", "系统概览", "SYSTEM OVERVIEW", "系统概览", "$environment · SKRoot Pro ${BuildConfig.VERSION_NAME}",
            listOf("环境：$environment", "内核 SDK：${home.environment.sdkVersion}", "已安装版本：${home.environment.installedVersion}",
                "启动方式：${if (home.environment.hotload) "热启动 / ${home.environment.hotloadMethod}" else "Boot"}",
                "Root 配置：${if (configured) "已配置" else "尚未配置"}", "操作：${home.busyAction ?: "空闲"}"),
            listOf(action("配置 Root", "root.config.open", placement = homePlacement("root.config.open")),
                action("刷新状态", "refresh", payload("scope", "home"), placement = homePlacement("refresh")),
                action(if (home.environment.state == EnvironmentState.OUTDATED) "更新环境" else "安装环境", "environment.install.request",
                    disabled = busy || !configured || home.loading || home.environment.state == EnvironmentState.PENDING_REBOOT,
                    placement = homePlacement("environment.install.request"), disabledReason = when {
                        !configured -> "请先配置 Root"
                        home.loading -> "正在检测环境"
                        home.environment.state == EnvironmentState.PENDING_REBOOT -> "重启完成后可安装环境"
                        else -> null
                    }),
                action("卸载环境", "environment.uninstall.request"), action("测试 Root", "root.test", placement = homePlacement("root.test")),
                action("重启选项", "reboot.options.open", placement = homePlacement("reboot.options.open")),
                action("控制台", "console.open", disabled = false, placement = "secondary"),
                action("查看日志", "log.open", disabled = false, placement = "secondary")),
            state = environmentStatus, loading = home.loading, error = home.error,
            fields = listOf(field("environment", "环境", environment), field("coreVersion", "核心版本", BuildConfig.SKROOT_CORE_VERSION),
                field("sdkVersion", "内核 SDK", home.environment.sdkVersion), field("installedVersion", "已安装版本", home.environment.installedVersion),
                field("bootMode", "启动方式", if (home.environment.hotload) "热启动 / ${home.environment.hotloadMethod}" else "Boot"),
                field("configured", "Root 配置", if (configured) "已配置" else "尚未配置")))
        record("system:security", "S-002", "设备状态", "DEVICE STATUS", "系统概览", "设备安全状态与通道概况",
            listOf("SELinux：$selinux", "Seccomp：$seccomp", "ADB：$adb", "OPlus 接口：$oplus"),
            listOf(action("刷新状态", "refresh", payload("scope", "home"), placement = "primary"), action("基础诊断", "diagnostics.open", payload("kind", "basic"), placement = "secondary")),
            fields = listOf(field("selinux", "SELinux", selinux, home.system.selinux != 0),
                field("seccomp", "Seccomp", seccomp, home.system.seccomp == 2), field("adbEnabled", "ADB", adb, !home.system.adbEnabled),
                field("oplusIntercepted", "OPlus 接口", oplus, true)))
        record("system:console", "S-003", "命令与控制台", "COMMAND TERMINAL", "系统概览", "执行命令并查看原始输出",
            listOf("控制台：${if (home.console.isBlank()) "暂无输出" else "已有输出"}", "命令输入、日志选择与复制在本机管理面板完成。"),
            listOf(action("执行命令", "command.input.open", placement = "primary"), action("打开控制台", "console.open", disabled = false, placement = "secondary"),
                action("复制输出", "console.copy", disabled = home.console.isBlank(), placement = "secondary", disabledReason = "暂无输出可复制"),
                action("清空输出", "console.clear", disabled = home.console.isBlank(), disabledReason = "暂无输出可清空")),
            fields = listOf(field("hasOutput", "控制台", if (home.console.isBlank()) "暂无输出" else "已有输出")))
        record("authorization:manager", "A-000", "授权管理", "AUTHORIZATION", "授权", "${authorization.grants.size} 个应用已授权",
            listOf(if (authorization.loading) "正在读取授权列表" else if (authorization.error != null) "读取失败，请刷新重试" else if (authorization.grants.isEmpty()) "暂无已授权应用" else "选择应用档案查看详情或撤销授权"),
            listOf(action("添加应用", "authorization.picker.open", placement = "primary"), action("授权 ADB", "authorization.adb.add"),
                action("撤销全部", "authorization.clear.request", disabled = busy || authorization.grants.isEmpty(), disabledReason = if (authorization.grants.isEmpty()) "暂无已授权应用" else null),
                action("刷新授权", "refresh", payload("scope", "authorization"))),
            state = listStatus(authorization.loading, authorization.error, authorization.grants.size), loading = authorization.loading,
            error = authorization.error, count = authorization.grants.size, fields = listOf(field("count", "已授权应用", authorization.grants.size)))
        authorization.grants.forEach { grant ->
            record("authorization:${grant.packageName}", stableCode("A", grant.packageName), grant.label, grant.packageName,
                "授权", "已授权应用", listOf("应用：${grant.label}", "包名：${grant.packageName}", "状态：已授权"),
                listOf(action("撤销授权", "authorization.remove.request", payload("packageName", grant.packageName), placement = "secondary")),
                kind = "application", state = status("authorized", "已授权", "success"),
                fields = listOf(field("label", "应用", grant.label), field("packageName", "包名", grant.packageName)))
        }
        record("modules:manager", "M-000", "模块管理", "INSTALLED MODULES", "已安装模块", "${modules.installed.size} 个已安装模块",
            listOf(if (modules.installedLoading) "正在读取模块" else if (modules.installedError != null) "读取失败，请刷新重试" else if (modules.installed.isEmpty()) "暂无已安装模块" else "选择模块档案管理运行状态与更新"),
            listOf(action("安装模块", "module.pick", payload("runOnce", false), busy || modules.download != null, "primary", if (modules.download != null) "请等待当前下载完成" else null),
                action("临时运行", "module.pick", payload("runOnce", true), busy || modules.download != null, "secondary", if (modules.download != null) "请等待当前下载完成" else null),
                action("刷新模块", "refresh", payload("scope", "modules"))),
            state = listStatus(modules.installedLoading, modules.installedError, modules.installed.size), loading = modules.installedLoading,
            error = modules.installedError, count = modules.installed.size, fields = listOf(field("count", "已安装模块", modules.installed.size),
                field("updates", "可用更新", modules.installed.count { it.update?.hasNewVersion == true })))
        modules.installed.forEach { module ->
            val id = payload("id", module.id)
            val state = when (module.runState) { ModuleRunState.RUNNING -> "运行中"; ModuleRunState.NOT_RUNNING -> "未运行"; ModuleRunState.ABNORMAL -> "异常"; ModuleRunState.REMOVED_PENDING_REBOOT -> "已移除，等待重启" }
            val actions = mutableListOf(action("模块详情", "module.details", id, false))
            if (module.hasWebUi) { actions += action("打开 WebUI", "module.webui.open", id, placement = "primary"); actions += action("桌面快捷方式", "module.shortcut.open", id, placement = "secondary") }
            actions += action("检查更新", "module.update.check", id, placement = if (!module.hasWebUi && module.update?.hasNewVersion != true) "primary" else "overflow")
            if (!module.update?.changelogUrl.isNullOrBlank()) actions += action("更新日志", "module.changelog", id)
            if (module.update?.hasNewVersion == true) actions += action("更新模块", "module.update.request", id, busy || modules.download != null,
                if (module.hasWebUi) "secondary" else "primary", if (modules.download != null) "请等待当前下载完成" else null)
            actions += action("卸载模块", "module.remove.request", id, placement = if (module.hasWebUi && module.update?.hasNewVersion == true) "overflow" else "secondary")
            record("module:${module.id}", stableCode("M", module.id), module.name, module.id, "已安装模块", module.description,
                listOf("版本：${module.version}", "状态：$state", "作者：${module.author}", "最低 SDK：${module.minSdk}",
                    "更新：${module.update?.let { if (it.hasNewVersion) it.latestVersion else "已是最新" } ?: "尚未检查"}"), actions, module.author, module.version,
                kind = "module", state = status(module.runState.name.lowercase(), state,
                    when (module.runState) { ModuleRunState.RUNNING -> "success"; ModuleRunState.ABNORMAL -> "error"; ModuleRunState.REMOVED_PENDING_REBOOT -> "warning"; else -> "neutral" }),
                fields = listOf(field("id", "模块 ID", module.id), field("version", "版本", module.version), field("author", "作者", module.author),
                    field("minSdk", "最低 SDK", module.minSdk), field("update", "更新", module.update?.let { if (it.hasNewVersion) it.latestVersion else "已是最新" } ?: "尚未检查")))
        }
        record("market:catalog", "C-000", "模块市场", "MODULE CATALOG", "模块市场", "${modules.market.size} 个市场模块",
            listOf(if (modules.marketLoading) "正在加载模块市场" else if (modules.marketError != null) "市场加载失败，请检查连接后刷新" else if (modules.market.isEmpty()) "暂无市场模块" else "支持搜索模块名称、作者与说明"),
            listOf(action("刷新市场", "refresh", payload("scope", "market"), placement = "primary")),
            state = listStatus(modules.marketLoading, modules.marketError, modules.market.size), loading = modules.marketLoading,
            error = modules.marketError, count = modules.market.size, fields = listOf(field("count", "市场模块", modules.market.size)))
        modules.market.forEach { module ->
            val actions = mutableListOf(action(if (module.isInstalled) "已安装" else "安装模块", "market.install.request", payload("id", module.id), busy || module.isInstalled || modules.download != null,
                "primary", when { module.isInstalled -> "此模块已安装"; modules.download != null -> "请等待当前下载完成"; else -> null }))
            if (module.sourceUrl.isNotBlank()) actions += action("项目来源", "link.open", JSONObject().put("linkId", "module.source").put("moduleId", module.id), false, "secondary")
            record("market:${module.id}", stableCode("C", module.id), module.displayName, module.englishName.ifBlank { module.id }, "模块市场", module.description,
                listOf("版本：${module.version}", "作者：${module.author}", "更新日期：${module.updateDate}", "状态：${if (module.isInstalled) "已安装" else "可安装"}"), actions, module.author, module.updateDate,
                kind = "market-module", state = status(if (module.isInstalled) "installed" else "available", if (module.isInstalled) "已安装" else "可安装", if (module.isInstalled) "success" else "neutral"),
                fields = listOf(field("id", "模块 ID", module.id), field("version", "版本", module.version), field("author", "作者", module.author), field("updateDate", "更新日期", module.updateDate)))
        }
        modules.download?.let { download ->
            record("market:download", "C-DL", download.title, "DOWNLOAD", "模块市场", "下载进行中",
                listOf("已下载：${download.downloadedBytes} B", "总大小：${if (download.totalBytes > 0) "${download.totalBytes} B" else "未知"}",
                    "进度：${download.fraction?.let { "${(it * 100).toInt()}%" } ?: "等待数据"}"),
                listOf(action("取消下载", "download.cancel", disabled = !download.cancellable, placement = "secondary", disabledReason = "正在完成下载，暂时不能取消")),
                kind = "download", state = status("downloading", "下载进行中", "progress"), progress = download.fraction,
                fields = listOf(field("downloadedBytes", "已下载", "${download.downloadedBytes} B"),
                    field("totalBytes", "总大小", if (download.totalBytes > 0) "${download.totalBytes} B" else "未知")))
        }
        val settingsActions = listOf(
            action(if (settings.bootFailProtect) "关闭启动保护" else "开启启动保护", "settings.toggle", JSONObject().put("key", "bootFailProtect").put("enabled", !settings.bootFailProtect), busy || settings.loading, disabledReason = if (settings.loading) "正在读取设置" else null),
            action(if (settings.adbForcedDisabled) "取消强制关闭 ADB" else "强制关闭 ADB", "settings.toggle", JSONObject().put("key", "adbForcedDisabled").put("enabled", !settings.adbForcedDisabled), busy || settings.loading, disabledReason = if (settings.loading) "正在读取设置" else null),
            action(if (settings.logEnabled) "关闭日志记录" else "开启日志记录", "settings.toggle", JSONObject().put("key", "logEnabled").put("enabled", !settings.logEnabled), busy || settings.loading, disabledReason = if (settings.loading) "正在读取设置" else null),
            action("刷新设置", "refresh", payload("scope", "settings")))
        record("settings:controls", "P-001", "内核设置", "KERNEL SETTINGS", "设置与诊断", "启动保护、ADB 与日志控制",
            listOf("启动保护：${if (settings.bootFailProtect) "开启" else "关闭"}", "强制关闭 ADB：${if (settings.adbForcedDisabled) "开启" else "关闭"}",
                "日志记录：${if (settings.logEnabled) "开启" else "关闭"}", if (settings.loading) "正在读取设置" else if (settings.error != null) "读取失败，请刷新重试" else "设置已读取"), settingsActions,
            kind = "settings", state = if (settings.loading) status("loading", "正在读取", "progress") else if (settings.error != null) status("error", "读取失败", "error") else status("ready", "设置已读取", "success"),
            loading = settings.loading, error = settings.error, fields = listOf(field("bootFailProtect", "启动保护", settings.bootFailProtect),
                field("adbForcedDisabled", "强制关闭 ADB", settings.adbForcedDisabled), field("logEnabled", "日志记录", settings.logEnabled)))
        record("settings:diagnostics", "P-002", "诊断与日志", "DIAGNOSTICS", "设置与诊断", "内核通道、默认模块与原始日志",
            listOf("诊断结果保留原文显示", "日志支持选择、复制与导出"),
            listOf(action("基础测试", "diagnostics.open", payload("kind", "basic"), placement = "secondary"), action("默认模块测试", "diagnostics.open", payload("kind", "modules"), placement = "secondary"),
                action("查看日志", "log.open", disabled = false, placement = "primary"), action("清理日志", "log.clear.request"), action("重启选项", "reboot.options.open")), kind = "settings")
        record("settings:appearance", "P-003", "外观与声音", "PERSONALIZATION", "设置与诊断", "画质、动态、音效与音乐",
            listOf("场景画质、音效、音乐与动态设置可在界面设置中调整。", "本地定制支持应用名称、包名与图标。"),
            listOf(action("外观与声音", "appearance.open", disabled = false, placement = "primary"), action("本地定制", "customizer.open", placement = "secondary")), kind = "settings")
        record("settings:about", "P-004", "关于 SKRoot Pro", "ABOUT SKROOT PRO", "设置与诊断", "SKP-PRTS ${BuildConfig.VERSION_NAME}",
            listOf("内核版本：${BuildConfig.SKROOT_CORE_VERSION}", "界面版本：${BuildConfig.SKROOT_UI_REVISION}", "内核 SDK：${settings.sdkVersion}", "UI 基于 RhineLabUI 固定提交离线移植", "管理器更新检测默认关闭"),
            listOf(action("SKRoot Pro 项目", "link.open", payload("linkId", "upstream"), false, "primary"), action("RhineLabUI 来源", "link.open", payload("linkId", "reference"), false, "secondary")),
            kind = "settings", fields = listOf(field("version", "应用版本", BuildConfig.VERSION_NAME), field("coreVersion", "内核版本", BuildConfig.SKROOT_CORE_VERSION),
                field("uiRevision", "界面版本", BuildConfig.SKROOT_UI_REVISION), field("sdkVersion", "内核 SDK", settings.sdkVersion)))
        return JSONObject().put("version", 1).put("records", records).put("statusText", environment).put("configured", configured).put("busy", busy)
            .put("environment", home.environment.state.name.lowercase()).put("loading", home.loading).toString()
    }

    private fun stableCode(prefix: String, value: String): String = "$prefix-${value.hashCode().toUInt().toString(16).uppercase().padStart(8, '0')}"

    private val destructiveActions = setOf("environment.uninstall.request", "authorization.remove.request", "authorization.clear.request",
        "module.remove.request", "log.clear.request", "console.clear", "reboot.options.open", "download.cancel")

    private fun actionKeywords(action: String, payload: JSONObject): List<String> = when (action) {
        "root.config.open" -> listOf("Root", "密钥", "Root Key", "Boot", "热启动", "配置")
        "environment.install.request" -> listOf("安装环境", "更新环境", "内核", "Root")
        "environment.uninstall.request" -> listOf("卸载环境", "移除环境", "内核")
        "root.test" -> listOf("Root", "测试权限", "检测")
        "reboot.options.open" -> listOf("重启", "软重启", "Recovery", "Bootloader")
        "authorization.picker.open" -> listOf("添加应用", "授权", "SU", "应用权限")
        "authorization.adb.add" -> listOf("ADB", "shell", "授权")
        "authorization.remove.request" -> listOf("撤销授权", "移除授权", "SU")
        "authorization.clear.request" -> listOf("撤销全部", "清空授权", "SU")
        "module.pick" -> if (payload.optBoolean("runOnce")) listOf("临时运行", "模块", "ZIP") else listOf("安装模块", "本地安装", "ZIP")
        "module.webui.open" -> listOf("WebUI", "网页", "模块界面")
        "module.shortcut.open" -> listOf("快捷方式", "桌面", "WebUI")
        "module.details" -> listOf("模块详情", "信息")
        "module.update.check" -> listOf("检查更新", "模块")
        "module.update.request" -> listOf("更新模块", "下载")
        "module.changelog" -> listOf("更新日志", "版本说明")
        "module.remove.request" -> listOf("卸载模块", "删除模块")
        "market.install.request" -> listOf("安装模块", "市场", "下载")
        "download.cancel" -> listOf("取消下载", "停止下载")
        "command.input.open", "console.open" -> listOf("控制台", "终端", "命令", "Shell")
        "console.copy" -> listOf("复制输出", "控制台")
        "console.clear" -> listOf("清空输出", "控制台")
        "log.open", "log.clear.request" -> listOf("日志", "Log", "诊断")
        "diagnostics.open" -> listOf("诊断", "测试", if (payload.optString("kind") == "basic") "基础测试" else "默认模块")
        "appearance.open" -> listOf("外观", "声音", "音效", "音乐", "静音", "画质", "动画", "主题", "开场", "模型", "拆解")
        "customizer.open" -> listOf("应用定制", "应用名称", "包名", "图标")
        "settings.toggle" -> when (payload.optString("key")) {
            "bootFailProtect" -> listOf("启动保护", "Boot", "防护")
            "adbForcedDisabled" -> listOf("ADB", "强制关闭", "调试")
            else -> listOf("日志记录", "Log")
        }
        "refresh" -> listOf("刷新", "重新读取", payload.optString("scope"))
        "link.open" -> listOf("项目", "来源", "关于")
        else -> emptyList()
    }
}
