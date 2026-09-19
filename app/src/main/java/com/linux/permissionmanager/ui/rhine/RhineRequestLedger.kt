package com.linux.permissionmanager.ui.rhine

/** One page session, one result per request. Full ledgers reject work rather than evicting IDs. */
class RhineRequestLedger(private val sessionId: String, private val capacity: Int = 4096) {
    data class Result(val accepted: Boolean, val reason: String? = null)
    private val results = LinkedHashMap<String, Result>()

    @Synchronized
    fun dispatch(session: String, requestId: String, action: String, execute: () -> Boolean): Result {
        if (session != sessionId) return Result(false, "stale_session")
        if (!requestId.matches(Regex("[A-Za-z0-9_.:-]{1,128}"))) return Result(false, "invalid_request")
        results[requestId]?.let { return it }
        if (results.size >= capacity) return Result(false, "session_capacity")
        // Register before dispatch so a reentrant callback cannot submit twice.
        results[requestId] = Result(false, "in_progress")
        val result = when {
            action !in RHINE_ACTIONS -> Result(false, "unknown_action")
            else -> runCatching { if (execute()) Result(true) else Result(false, "unavailable") }
                .getOrElse { Result(false, "dispatch_failed") }
        }
        results[requestId] = result
        return result
    }
}

val RHINE_ACTIONS: Set<String> = setOf(
    "environment.install.request", "environment.uninstall.request", "root.config.open", "root.test",
    "command.input.open", "console.open", "console.copy", "console.clear",
    "authorization.picker.open", "authorization.adb.add", "authorization.remove.request", "authorization.clear.request",
    "module.pick", "module.details", "module.webui.open", "module.shortcut.open", "module.update.check",
    "module.changelog", "module.update.request", "module.remove.request", "market.install.request", "download.cancel",
    "settings.toggle", "diagnostics.open", "log.open", "log.clear.request", "reboot.options.open",
    "customizer.open", "link.open", "refresh", "appearance.open", "ui.mode.set", "navigation.exit"
)
