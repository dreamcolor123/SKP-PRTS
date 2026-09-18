package com.linux.permissionmanager.ui.rhine

/** A native confirmation can be consumed once, including before recomposition. */
class RhineConfirmation {
    private var consumed = false
    @Synchronized fun consume(available: Boolean): Boolean {
        if (!available || consumed) return false
        consumed = true
        return true
    }
    @Synchronized fun cancel() { consumed = true }
}
