import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";

const bundle = await build({ entryPoints: ["src/ui-mode.ts"], bundle: true, write: false, format: "esm", platform: "node" });
const { UiModeController, uiModeMarkup, syncUiModeControls } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);

function fixture(send = (_, __) => "request-1") {
  const requests = [];
  let changes = 0;
  const controller = new UiModeController((action, payload) => {
    requests.push({ action, payload });
    return send(action, payload);
  }, () => changes++);
  return { controller, requests, changes: () => changes };
}

test("mode is native-owned, unsupported hosts stay disabled, and mode values are allowlisted", () => {
  const { controller, requests } = fixture();
  controller.select("legacy");
  assert.equal(requests.length, 0);
  controller.update({ uiMode: "rhine", uiModeSwitchAllowed: true });
  for (const value of [undefined, "", "LEGACY", "fallback.open", "rhine"]) controller.select(value);
  assert.equal(requests.length, 0);
  controller.select("legacy");
  assert.deepEqual(requests, [{ action: "ui.mode.set", payload: { mode: "legacy" } }]);
  assert.equal(controller.state.mode, "rhine");
  assert.equal(controller.state.pending, true);
  assert.equal(controller.state.allowed, false);
});

test("rapid clicks and unrelated snapshots or acknowledgements cannot resubmit a pending switch", () => {
  const { controller, requests } = fixture();
  controller.update({ uiMode: "rhine", uiModeSwitchAllowed: true });
  controller.select("legacy");
  controller.acknowledge("other-request", "rejected");
  controller.update({ uiMode: "rhine", uiModeSwitchAllowed: true });
  controller.acknowledge("request-1", "accepted");
  for (let i = 0; i < 10; i++) { controller.select("legacy"); controller.select("rhine"); }
  assert.equal(requests.length, 1);
  assert.equal(controller.state.mode, "rhine");
  controller.update({ uiMode: "legacy", uiModeSwitchAllowed: true });
  assert.equal(controller.state.mode, "legacy");
  assert.equal(controller.state.pending, false);
});

test("native prohibition and rejection report the reason without persisting a speculative mode", () => {
  const { controller, requests } = fixture();
  controller.update({ uiMode: "rhine", uiModeSwitchAllowed: false, uiModeSwitchReason: "安装中" });
  controller.select("legacy");
  assert.equal(requests.length, 0);
  assert.equal(controller.state.reason, "安装中");
  controller.update({ uiMode: "rhine", uiModeSwitchAllowed: true });
  controller.select("legacy");
  controller.acknowledge("request-1", "rejected", "先关闭当前确认");
  assert.equal(controller.state.allowed, true);
  assert.equal(controller.state.pending, false);
  assert.equal(controller.state.mode, "rhine");
  assert.equal(controller.state.reason, "先关闭当前确认");
  controller.select("legacy");
  assert.equal(requests.length, 2);
});

test("an unavailable bridge leaves the controls retryable", () => {
  const { controller } = fixture(() => undefined);
  controller.update({ uiMode: "rhine", uiModeSwitchAllowed: true });
  controller.select("legacy");
  assert.equal(controller.state.pending, false);
  assert.equal(controller.state.allowed, true);
});

test("shared segmented markup has exactly two explicit modes and escapes native reasons", () => {
  const markup = uiModeMarkup({ mode: "legacy", allowed: false, pending: false, reason: '<img src=x onerror="bad()">' });
  assert.equal((markup.match(/data-ui-mode=/g) || []).length, 2);
  assert.match(markup, /data-ui-mode="rhine"[^>]*aria-pressed="false"[^>]*disabled/);
  assert.match(markup, /data-ui-mode="legacy"[^>]*aria-pressed="true"[^>]*disabled/);
  assert.match(markup, /RhineLabUI/);
  assert.match(markup, /SKRoot Pro Compose/);
  assert.match(markup, /&lt;img/);
  assert.doesNotMatch(markup, /<img/);
});

test("snapshot updates synchronize both existing settings entries without replacing their DOM", () => {
  const groups = Array.from({ length: 2 }, () => {
    const buttons = ["rhine", "legacy"].map(mode => ({ dataset: { uiMode: mode }, disabled: false, attrs: {}, setAttribute(key, value) { this.attrs[key] = value; } }));
    const reason = { hidden: true, textContent: "" };
    return { buttons, reason, attrs: {}, setAttribute(key, value) { this.attrs[key] = value; }, querySelectorAll: () => buttons, querySelector: () => reason };
  });
  syncUiModeControls({ querySelectorAll: () => groups }, { mode: "rhine", allowed: false, pending: true, reason: "正在切换界面…" });
  for (const group of groups) {
    assert.equal(group.attrs["aria-busy"], "true");
    assert.deepEqual(group.buttons.map(button => button.disabled), [true, true]);
    assert.deepEqual(group.buttons.map(button => button.attrs["aria-pressed"]), ["true", "false"]);
    assert.equal(group.reason.hidden, false);
    assert.equal(group.reason.textContent, "正在切换界面…");
  }
});

test("both settings entries place the shared native control first and the old manual fallback is removed", async () => {
  const [main, panel, bridge, css] = await Promise.all(["src/main.ts", "src/folder-face-panel.ts", "src/skp-host.ts", "src/ui-mode.css"].map(path => readFile(path, "utf8")));
  assert.match(main, /function settingsMarkup\(\)\s*\{\s*return \(isAndroid \? uiModeMarkup\(uiMode\.state\) : ""\) \+ appearanceSettingsMarkup\(\)/);
  assert.match(main, /uiModeSettings: \(\) => isAndroid \? uiModeMarkup\(uiMode\.state\)/);
  assert.match(panel, /return \(this\.callbacks\.uiModeSettings\?\.\(\) \?\? ""\) \+ all\.filter/);
  assert.match(main, /uiMode\.update\(snapshot\)/);
  assert.match(bridge, /callbacks\?\.acknowledge\?\.\(message\.requestId, message\.status, message\.reason\)/);
  assert.doesNotMatch(main, /native-fallback|fallback\.open|基础管理/);
  assert.match(css, /min-height: 48px/);
  const source = await readFile("src/ui-mode.ts", "utf8");
  assert.doesNotMatch(source, /localStorage|sessionStorage/);
  assert.doesNotMatch(main, /SKP-PRTS \/ 4\.6\.2\.1/);
  assert.match(main, /appVersion = snapshot\.appVersion \?\? "4\.6\.2\.2"/);
  assert.match(main, /if \(isAndroid\) \{ failAndroidRenderer\(String\(error\)\); return; \}/);
  assert.match(main, /audio\.unlock\(\)\.catch\(\(\) => false\)/);
});

test("a fatal resource error before bridge initialization is delivered once after ready", async () => {
  const previousWindow = globalThis.window, previousLocation = globalThis.location;
  const listeners = [];
  globalThis.window = { addEventListener: (_, listener) => listeners.push(listener) };
  globalThis.location = { origin: "https://appassets.androidplatform.net", search: "" };
  try {
    const source = await build({ entryPoints: ["src/skp-host.ts"], bundle: true, write: false, format: "esm", platform: "node", define: { "import.meta.env.MODE": '"android"' } });
    const { skpHost } = await import(`data:text/javascript;base64,${Buffer.from(source.outputFiles[0].text).toString("base64")}`);
    const sent = [];
    skpHost.event("error", { reason: "missing model" });
    assert.equal(sent.length, 0);
    const port = { postMessage: value => sent.push(JSON.parse(value)), start() {}, close() {} };
    listeners[0]({ origin: "", source: null, ports: [port], data: { type: "skp:init", version: 1, sessionId: "first" } });
    assert.deepEqual(sent.map(message => message.type), ["ready", "error"]);
    assert.equal(sent[1].reason, "missing model");
    listeners[0]({ origin: "", source: null, ports: [port], data: { type: "skp:init", version: 1, sessionId: "second" } });
    assert.deepEqual(sent.map(message => message.type), ["ready", "error", "ready"]);
  } finally { globalThis.window = previousWindow; globalThis.location = previousLocation; }
});
