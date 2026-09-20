import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { managerPreferenceDefaults, openingAllowed, sceneMotionReduced } from "../src/manager-preferences.ts";

test("fresh manager defaults keep the opening independent from quiet daily motion", () => {
  assert.deepEqual(managerPreferenceDefaults({}, true), { music: false, reduced: true, openingEnabled: true });
  assert.equal(sceneMotionReduced(true, true, false), false);
  assert.equal(sceneMotionReduced(false, true, false), true);
  assert.equal(openingAllowed(true, false), true);
});
test("saved choices survive the new defaults; no inferred opening disable", () => {
  assert.deepEqual(managerPreferenceDefaults({ music: true, reduced: false, openingEnabled: false }, true),
    { music: true, reduced: false, openingEnabled: false });
  assert.equal(managerPreferenceDefaults({ reduced: true }, true).openingEnabled, true);
});
test("malformed preferences are treated as absent", () => {
  for (const value of [null, [], false, "broken", { music: "true", reduced: 0, openingEnabled: "false" }]) {
    assert.deepEqual(managerPreferenceDefaults(value, true), { music: false, reduced: true, openingEnabled: true });
  }
});
test("system motion overrides boot and daily animation, not saved choice", () => {
  assert.equal(openingAllowed(true, true), false);
  for (const boot of [false, true]) for (const reduced of [false, true]) assert.equal(sceneMotionReduced(boot, reduced, true), true);
  assert.equal(openingAllowed(false, false), false);
});
test("web and wallpaper defaults are not silently migrated", () => {
  assert.deepEqual(managerPreferenceDefaults({}, false), { music: true, reduced: false, openingEnabled: true });
});
test("manager blocks removed experiences while retaining model assets for opening", async () => {
  const source = await readFile("src/main.ts", "utf8");
  assert.doesNotMatch(source, /function visualLabMarkup|enable-motion|跳过开机动画/);
  assert.match(source, /function setVisualLab\(enabled: boolean\) \{\s+if \(isAndroid\) return/);
  assert.match(source, /isAndroid && \(\["visual-lab", "lab-exit", "lab-finish", "lab-model", "model-viewer"\]/);
  assert.match(source, /bootSequence\.update\(t,openingReduced\(\)\)/);
});
