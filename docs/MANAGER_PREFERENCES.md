# Manager Motion And Audio Preferences

The Android Rhine manager uses these defaults for missing preferences:

| Key | Default | Scope |
| --- | --- | --- |
| `music` | `false` | Background music only; effect volume is unchanged |
| `reduced` | `true` | Daily navigation, camera and text motion |
| `openingEnabled` | `true` | Cold opening and manual opening replay |

Existing explicit choices remain unchanged. An older installation without
`openingEnabled` gets the enabled default, independently of `reduced`.
Dark mode, SUPER PERFORMANCE and saved rendering quality are unchanged.

The opening ignores the daily simplification preference, but respects both the
Android system animation setting and CSS reduced-motion setting. Changing either
system setting does not overwrite the stored user choices. Backgrounding pauses
the opening and sound rather than treating the pause as a request to skip it.
Runtime UI switching and completed-opening restoration retain their skip behavior.

Android no longer presents the dynamic showcase or model-viewer/disassembly
entries, and their old dispatch actions are ignored. Shared model assets remain
available to the opening. Non-Android model and Wallpaper functionality remain.

## Reproducible Checks

From `ui/rhine`:

```text
npm run check:manager-preferences
npx tsc --noEmit
npm run build:android
node scripts/check-manager-preferences-browser.mjs
```

The browser runner accepts `SKP_PLAYWRIGHT_PATH`, `SKP_PNGJS_PATH` and
`SKP_BROWSER_OUTPUT` environment variables. It runs the real Android bundle with a fake business bridge;
it does not invoke Root operations.

Android instrumentation:

```text
RhineHostTest#dailyReductionKeepsOpeningSeparateAndPauseDoesNotSkip
RhineHostTest#rebuildSkipsCompletedBootAndReducedMotionRemainsUsable
```

Device tests must target the disposable emulator explicitly. Real Root, physical
speaker output and device GPU performance require separate physical-device testing.
