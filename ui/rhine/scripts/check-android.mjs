import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { records, replaceRecords, archiveColumns, columnFiles, fileLocation, recordNumber } from "../src/data.ts";
import { build } from "esbuild";
import { selectionCell, fileAtCell, commonRowPeriod } from "../src/archive-loop.ts";
import { boundedTilt, followTilt, WORKING_HEIGHT } from "../src/spatial-motion.ts";
import { sections } from "../src/function-index.ts";

const record = (id, category, extra = {}) => ({ id, category, title: id, en: "SYSTEM", department: "SKRoot Pro", date: "LIVE", lead: "SESSION", clearance: "READY", abstract: "", findings: [], source: "", ...extra });
const motionBundle = await build({ entryPoints: ["src/boot-motion.ts"], bundle: true, write: false, format: "esm", platform: "node" });
const { bootMotion } = await import(`data:text/javascript;base64,${Buffer.from(motionBundle.outputFiles[0].text).toString("base64")}`);
test("navigation, placeholder labels and physical archive lanes share the same order", () => {
  const expected = [
    ["home", "系统概览", "SYSTEM OVERVIEW"],
    ["authorization", "授权", "AUTHORIZATION"],
    ["modules", "已安装模块", "INSTALLED MODULES"],
    ["market", "模块市场", "MODULE MARKET"],
    ["settings", "设置与诊断", "SETTINGS & DIAGNOSTICS"],
  ];
  assert.deepEqual(archiveColumns, expected.map(([,category]) => category));
  expected.forEach(([id,category,en], lane) => {
    assert.equal(sections[lane].id, id);
    assert.equal(sections[lane].lane, lane);
    assert.equal(records[columnFiles(lane)[0]].en, en);
    assert.equal(records[columnFiles(lane)[0]].category, category);
  });
  // Native record order is independent of navigation and must not reorder physical columns.
  replaceRecords([...sections].reverse().map(section => record(section.root, archiveColumns[section.lane], {section:section.id,isRoot:true})));
  sections.forEach(section => {
    const index = records.findIndex(entry => entry.id === section.root);
    assert.equal(fileLocation(index).lane, section.lane);
    assert.equal(fileAtCell({lane:section.lane,row:12}), index);
  });
});

test("empty native lists remain five truthful, navigable lanes", () => {
  replaceRecords([]);
  assert.equal(records.length, 5);
  for (let lane = 0; lane < 5; lane++) {
    assert.equal(columnFiles(lane).length, 1);
    assert.equal(records[columnFiles(lane)[0]].empty, true);
    assert.equal(fileAtCell({lane: lane + 5, row: -20}), columnFiles(lane)[0]);
  }
});
test("native IDs are stable and never coerced into numerical identities", () => {
  replaceRecords([record("home.summary", "系统概览"), record("module:alpha", "已安装模块", {code:24}), record("module:alpha", "已安装模块")]);
  assert.equal(records.filter(r => r.id === "module:alpha").length, 1);
  const index = records.findIndex(r => r.id === "module:alpha");
  assert.equal(recordNumber(index), 24);
  assert.equal(fileLocation(index).lane, 2);
  assert.equal(archiveColumns[fileLocation(0).lane], "系统概览");
  assert.equal(selectionCell(index, {lane:2,row:12}).lane, 2);
});
test("untrusted native metadata stays text and invalid records cannot remove a lane", () => {
  replaceRecords([record("a", "未知"), record("b", "授权", {title:"<img src=x onerror=alert(1)>",findings:[42],source:"https://example.invalid"})]);
  assert.equal(records.length, 5);
  assert.equal(records[0].title, "<img src=x onerror=alert(1)>");
  assert.deepEqual(records[0].findings, ["42"]);
  assert.equal(records[0].source, "");
});

test("unequal live column lengths retain record identity after coordinate rebasing", () => {
  replaceRecords(archiveColumns.flatMap((category,lane) => Array.from({length:[3,37,4,71,5][lane]},(_,i)=>record(`${lane}:${i}`,category))));
  const period = commonRowPeriod();
  assert.ok(period > 8);
  for(let lane=0;lane<5;lane++) for(const row of [-7000,12,3500,22000]) {
    assert.equal(fileAtCell({lane,row}),fileAtCell({lane,row:row-period}));
  }
});
test("reference opening retains calibrated MG stages", () => {
  const stages = [2, 8, 15, 19].map(t => bootMotion(t).step);
  assert.equal(new Set(stages).size, 4);
  assert.ok(bootMotion(19));
});

test("device tilt remains bounded, smooth and disabled with reduced motion",()=>{
  assert.equal(WORKING_HEIGHT,1.65);
  assert.deepEqual(boundedTilt(Infinity,-5),{x:0,y:-1});
  let tilt={x:0,y:0};
  for(let i=0;i<90;i++){tilt=followTilt(tilt,{x:1,y:-1},1/60,true);assert.ok(tilt.x<=1&&tilt.y>=-1);}
  assert.ok(tilt.x>.99);
  assert.deepEqual(followTilt(tilt,{x:1,y:1},1/60,false),{x:0,y:0});
});
test("all offline manifest entries match packaged bytes and include complete media", async () => {
  const manifest = JSON.parse(await readFile("dist/asset-manifest.json", "utf8"));
  assert.equal(manifest.reference, "17a16118f31b55b7156b68e89b6fe989408351f0");
  for (const file of manifest.files) {
    assert.ok(!file.path.startsWith("/") && !file.path.includes(".."));
    const bytes = await readFile(`dist/${file.path}`);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), file.sha256, file.path);
  }
  for (const name of ["index.html", "audio/atmosphere.ogg", "audio/motif.ogg", "audio/pulse.ogg", "assets/archive-cassette.glb", "assets/archive-assembly.glb"]) assert.ok(manifest.files.some(f => f.path === name), name);
  assert.ok(manifest.files.some(f => f.path.endsWith(".woff2")));
  assert.ok(!manifest.files.some(f => f.path.startsWith("archives/") || f.path === "sw.js"));
});
