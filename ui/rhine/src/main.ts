import { isAndroid, skpHost, type UiSnapshot, type Presentation } from "./skp-host";
import "./skp.css";
import { FolderFacePanel } from "./folder-face-panel";
import { sections, functionResults, type SectionId } from "./function-index";
import type { ArchiveRecord, ArchiveAction } from "./data";
import { createRollingClock } from "./rolling-clock";
import { InspectionOverlay } from "./inspection-overlay";
import { DocumentDecryption } from "./document-decryption";
import "./document-decryption.css";
import "./decryption.css";
import { escapeHtml } from "./html";
import { normalizeQuality, qualityPresets, type QualityPreset, type RenderQuality } from "./render-quality";
import { qualityMarkup, syncQualityUI } from "./quality-settings";
import { superPerformanceQuality, wallpaperQuality } from "./wallpaper-quality";
import "@kitlangton/rolling-number/styles.css";
import "./style.css";
import "./quality-settings.css";
import "./responsive.css";
import { FloatingNavigation } from "./floating-navigation";
import "./floating-navigation.css";
import { viewportLayout, openingLayout } from "./viewport-layout";
import { assetUrl } from "./asset-url";
import { initPwa, pwaSettingsMarkup } from "./pwa";
import { createRollingNumber, createRollingText } from "@kitlangton/rolling-number";
import { ArchiveScene } from "./scene";
import { ModelViewer } from "./model-viewer";
import { ContentTransition, SurfaceTransition } from "./ui-transitions";
import { BootSequence } from "./boot";
import { loadBootWebfonts } from "./boot-lettering";
import { wrap, type ArchiveNavigation } from "./archive-loop";
import {
  records,
  categories,
  archiveColumns,
  columnFiles,
  fileLocation,
  replaceRecords,
  recordNumber,
} from "./data";
import { TerminalAudio } from "./audio";
import { audioSettingsMarkup } from "./audio-settings";
import { StartupGate } from "./startup";
import { isWallpaper, wallpaperHost, wallpaperFrame, type WallpaperProperties } from "./wallpaper";
import "./startup.css";
import "./wallpaper.css";
import { Workbench } from "./workbench";
let workbench: Workbench | undefined;
import { ArchivePlayground } from "./archive-playground";
import { ARRAY_OPENING_END, openingShowsDetail } from "./wallpaper-opening";
import { paintTheme, themeSettingsMarkup } from "./theme-ui";
let playground: ArchivePlayground | undefined;
import { WallpaperEffects } from "./wallpaper-effects";
import { WallpaperBackground } from "./wallpaper-background";
let wallpaperEffects: WallpaperEffects | undefined;

const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
import { logo, brandHeading } from "./brand";

$("#stage").innerHTML = `
  <div id="three-scene" class="three-scene"></div>
  <div class="scene-atmosphere archive-atmosphere"></div>
  <div id="boot-background" class="boot-background"><svg viewBox="0 0 1920 1080" preserveAspectRatio="none"><g fill="none" stroke="#fff" stroke-width="3"><path d="M-210 705C-45 705 182 704 247 567C337 377 99 306 4 435S27 680 169 631C309 584 227 314 279 111S568-113 568-113"/><path d="M1560-80C1374 114 1671 168 1601 323S1371 367 1431 480S1692 666 1559 787S1329 886 1498 1130"/><circle cx="1450" cy="648" r="346"/><circle cx="1450" cy="648" r="348"/></g></svg></div>
  <header class="brand">${brandHeading}</header>
  <nav class="system-nav" aria-label="系统导航">
    <button class="system-tool" data-action="search" aria-label="搜索功能" title="搜索功能"><span class="nav-glyph" aria-hidden="true"></span></button>
    <button data-action="saved" aria-label="常用" title="常用">＋ <span id="saved-count">00</span></button>
    <button class="settings-button system-tool" data-action="settings" aria-label="外观与声音" title="外观与声音"><span class="settings-glyph" aria-hidden="true"></span></button>
  </nav>
  <button id="skip" class="skip" data-action="skip">ENTER SYSTEM <span>↗</span></button>
  <section id="boot" class="boot" aria-label="系统启动">
    <div class="access-text">ACCESS</div>
    <div class="boot-logo">${logo}</div>
    <div class="auth-status"><span>▪</span> <span id="auth-message"></span><i></i></div>
    <div class="scan"><svg viewBox="0 0 1920 1080" aria-hidden="true"><g fill="none" stroke="#080a08" stroke-width="2" stroke-linecap="round"><path/><path stroke="#fff"/><path/><path/><path/><path/><circle class="orbit-dot" r="8" fill="#ed821b" stroke="none"/><circle class="orbit-dot" r="8" fill="#ed821b" stroke="none"/><circle class="scan-core" cx="960" cy="540" r="5" fill="#080a08" stroke="none"/></g></svg><span>SESSION INITIALIZED</span></div>
    <div class="welcome"><div class="welcome-panel"></div><div class="welcome-heading">WELCOME TO</div><div class="welcome-company"><strong>SKROOT PRO.</strong><strong class="welcome-highlight" aria-hidden="true">SKROOT PRO.</strong></div><div class="welcome-database">INTERNAL DATABASE</div><div class="welcome-logo">${logo}</div></div>
  </section>
  <svg id="inspection-marks" viewBox="0 0 1920 1080" aria-hidden="true"><path id="inspection-lines"/><g id="inspection-corners"></g><circle id="inspection-point" r="1.8"/></svg>
  <div id="inspection-text" aria-hidden="true">CONFIDENTIALITY:<strong>GENERAL BUSINESS USE</strong></div>
  <section id="archive-ui" class="archive-ui" aria-label="档案选择">
    <div class="archive-callout"><div class="eyebrow">INTERNAL DATABASE <span>／</span> <span id="archive-category">系统概览</span></div><button class="file-title" data-action="open">FILE NUMBER: <span id="selected-id">X-<span id="selected-code">001</span></span><span class="file-open">↗</span></button><div class="callout-rule"><i></i></div><div class="file-summary"><span id="selected-title">SKRoot Pro</span><span id="selected-clearance">BUSINESS AREA</span></div><button class="read-file" data-action="open">ACCESS FILE <span>→</span></button></div>
    <div id="hover-label" class="hover-label" hidden>X-<span id="hover-code">001</span> / <span id="hover-title"></span></div>
    <div class="archive-counter"><span class="tiny-label">ARCHIVE / SELECT</span><div><span id="selected-number">01</span><i>/</i><span class="count-total">12</span></div></div>
    <div class="archive-navigation"><button data-action="prev" aria-label="上一个档案">↑</button><div id="file-ticks" class="file-ticks"></div><button data-action="next" aria-label="下一个档案">↓</button></div>
    <div class="column-navigation"><button data-action="column-prev" aria-label="上一列">←</button><div><span id="column-number">COLUMN <span id="column-index">03</span> / 05</span><strong id="column-name">系统概览</strong></div><button data-action="column-next" aria-label="下一列">→</button></div>
    <div class="archive-row-navigation" role="group" aria-label="当前列档案"><button data-action="row-prev" aria-label="当前列上一张档案"><span aria-hidden="true">↑</span>上一张</button><output id="archive-row-position" aria-live="polite"><small id="archive-row-name">系统概览</small><strong><span id="archive-row-index">01</span><i>/</i><span id="archive-row-total">01</span></strong></output><button data-action="row-next" aria-label="当前列下一张档案">下一张<span aria-hidden="true">↓</span></button></div>
    <div class="archive-hint"><kbd>←</kbd> <kbd>→</kbd> 切换列 <span>／</span> <kbd>↑</kbd> <kbd>↓</kbd> 前后档案 <span>／</span> <kbd>ENTER</kbd> 读取</div>
  </section>
  <section id="detail-ui" class="detail-ui" aria-label="档案内容" hidden>
    <button class="back-button" data-action="back">← <span>ARCHIVE OVERVIEW</span><small>ESC</small></button>
    <div class="object-caption"><span id="object-id">NO.001</span><div>INTERNAL DATABASE</div><small>DRAG TO INSPECT <span>↔</span></small><button class="viewer-open" data-action="model-viewer">360° 查看文档模型 <span>↗</span></button></div>
    <article id="detail-content" class="detail-content"></article>
  </section>
  <div class="powered">POWERED BY <b>SKROOT PRO</b><i></i></div>
  <footer class="system-footer"><span><i class="status-light"></i> <b id="skp-status">SESSION CONNECTED</b>${isWallpaper ? '<button type="button" class="three-toggle" data-action="toggle-three" aria-pressed="true" title="卸载三维模型，保留 2D 界面">3D 开启</button>' : ''}</span><span>SKP SESSION <i>／</i> <span id="clock">00:00:00</span></span><button data-action="replay" title="重播启动流程">REINITIALIZE ↗</button></footer>
  <div id="pwa-update-notice" class="pwa-update-notice" role="status" hidden><span>新版本已就绪</span><button data-pwa-action="update">更新并重启 ↻</button></div>
  <div id="modal-root"></div><div id="toast" class="toast" role="status"></div>
  <div id="loading" class="loading"><div class="loading-mark">${logo}</div><span>CONNECTING TO INTERNAL DATABASE</span><i></i></div>
`;

$("#boot-background").insertAdjacentHTML(
  "beforeend",
  '<div class="boot-white"></div>',
);
const bootSequence = new BootSequence($("#stage"));
$("#viewport").insertAdjacentHTML("beforeend", '<button class="mobile-entry" data-action="skip">进入管理器 <span>→</span></button>');
$("#viewport").insertAdjacentHTML("beforeend", `<nav class="workspace-navigation" aria-label="主要分区" hidden>${sections.map((section,index)=>`<button data-section="${section.id}" aria-label="${section.label}" aria-current="false"><i>${String(index+1).padStart(2,"0")}</i><span>${section.label}</span></button>`).join("")}</nav>`);
const floatingNavigation = new FloatingNavigation($(".workspace-navigation"));
let sensorTilt = {x:0,y:0};

type Mode = "boot" | "archive" | "detail";
let mode: Mode = "boot",
  selected = 2,
  bootStart = 0,
  lastStep = "",
  ready = false;
let modal: "search" | "saved" | "settings" | null = null,
  searchQuery = "",
  filter = "全部档案";
let activeTab = "overview";
const reviewParams = new URLSearchParams(location.search);
let frozenTime =
  reviewParams.get("freeze") === "1"
    ? Number(reviewParams.get("time") ?? 0)
    : null;
if (reviewParams.get("review") === "1") {
  $("#stage").dataset.review = "true";
  window.addEventListener("message", (event) => {
    if (
      event.origin !== location.origin ||
      event.source !== window.parent ||
      event.data?.type !== "rhine-review-frame"
    )
      return;
    const t = Number(event.data.time);
    if (!Number.isFinite(t) || t < 0 || t >= 35) return;
    frozenTime = t;
    if (ready && mode !== "boot") setMode("boot");
  });
}
let toastTimer: ReturnType<typeof setTimeout>;
let previousFocus: HTMLElement | null = null;
const detailTransition = new SurfaceTransition($("#detail-ui"), undefined, 180, 180);
const tabTransition = new ContentTransition();
let modalTransition: SurfaceTransition | undefined;
let modalClosing = false;
let modalSiblings: { node: HTMLElement; inert: boolean }[] = [];
let pendingDetailFocus = false;
let bookmarkFeedback: Animation | undefined;
function readLocal<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
}
const saved = new Set<string>(readLocal<string[]>("rhine-saved", []));
const storedPrefs = readLocal<Partial<{ sound: boolean; music: boolean; soundVolume: number; musicVolume: number; reduced: boolean; quality: boolean; rendering: RenderQuality; superPerformance: boolean; colorTheme: "light" | "dark" }>>("rhine-settings", {});
let userReduced = Boolean(storedPrefs.reduced);
const prefs = {
  sound: true,
  music: storedPrefs.music ?? true,
  soundVolume: .55,
  musicVolume: .5,
  quality: true,
  superPerformance: false,
  ...storedPrefs,
  reduced: userReduced || matchMedia("(prefers-reduced-motion: reduce)").matches,
  rendering: normalizeQuality(storedPrefs.rendering, storedPrefs.quality !== false),
  colorTheme: storedPrefs.colorTheme === "dark" ? "dark" : "light",
};
paintTheme(prefs.colorTheme === "dark" ? 1 : 0);
const rollingMotion = {
  duration: 460,
  motionBlur: true,
  animated: !prefs.reduced,
};
const updateFooterClock = createRollingClock($("#clock"));
const numberOptions = {
  ...rollingMotion,
  locales: "en-US",
  format: { minimumIntegerDigits: 2, useGrouping: false },
};
const fileCounter = createRollingNumber($("#selected-number"), {
  ...numberOptions,
  value: 1,
});
const columnCounter = createRollingNumber($("#column-index"), {
  ...numberOptions,
  value: 3,
});
const codeOptions = {
  ...numberOptions,
  format: { minimumIntegerDigits: 3, useGrouping: false },
  value: 1,
};
const textOptions = {
  ...rollingMotion,
  transition: "direct" as const,
  stagger: "none" as const,
};
const selectionTitle = createRollingText($("#selected-title"), {
  ...textOptions,
  text: $("#selected-title").textContent ?? "",
});
const columnTitle = createRollingText($("#column-name"), {
  ...textOptions,
  text: $("#column-name").textContent ?? "",
});
const hoverTitle = createRollingText($("#hover-title"), { ...textOptions, text: "" });
const categoryTitle = createRollingText($("#archive-category"), {
  ...textOptions,
  text: $("#archive-category").textContent ?? "",
});
const clearanceTitle = createRollingText($("#selected-clearance"), {
  ...textOptions,
  text: $("#selected-clearance").textContent ?? "",
});
const rollingTitles = [selectionTitle, columnTitle, hoverTitle, categoryTitle, clearanceTitle];
const selectedCode = createRollingNumber($("#selected-code"), codeOptions);
const hoverCode = createRollingNumber($("#hover-code"), codeOptions);
const audio = new TerminalAudio();
let musicSuppressed = false;
function configureAudio() { audio.configure({ ...prefs, music: prefs.music && !musicSuppressed }); }
configureAudio();
const reviewEntry = reviewParams.has("scene") || reviewParams.has("time") || reviewParams.get("review") === "1";
let started = false;
const loading = $("#loading");
// The entry screen uses the actual viewport, including portrait phones; the
// reference animation still uses its calibrated 1920 x 1080 stage.
$("#viewport").append(loading);
$("#stage").inert = true;
$(".mobile-entry").inert = true;
const entry = !isAndroid && !isWallpaper && !reviewEntry && (prefs.sound || prefs.music) ? new StartupGate({
  root: loading,
  unlock: () => audio.unlock(),
  cancel: () => audio.cancelEntry(),
  start: silent => completeStartup(silent),
}) : undefined;
if (entry) {
  audio.holdForEntry();
  if (prefs.music) void audio.prepareMusic().catch(() => { /* Entry offers retry. */ });
}
let audioPreview = false, audioPreviewRequest = 0;
let scene: ArchiveScene | undefined;
let threeState: "on" | "closing" | "off" | "loading" = "on";
let resumeCell: { lane: number; row: number } | undefined;
let resumeSelection = -1;
let viewer: ModelViewer | undefined;
const accessLog: { id: string; time: string }[] = [];
const columnMemory = archiveColumns.map((_, lane) => columnFiles(lane)[0]);
let visualLab = false;
let labRhythm = "wave";
let labFinish = true;
let pausedAt: number | undefined;
let pausedAnimations: Animation[] = [];
let hostReduced = false;
let snapshotReceived = false;
let activeSection: SectionId = "home";
let workspaceRoot = true;
let browsingArray = false;
let workspaceInitialized = false;
let labReturn: { id: string; section: SectionId; root: boolean } | undefined;
const facePanel = new FolderFacePanel($("#viewport"), {
  select: index => openWorkspace(index, false),
  action: (recordId, actionId) => {
    const record = records.find(r=>r.id === recordId);
    const action = record?.actions?.find((a,index)=>a.id === actionId || String(index) === actionId);
    if (record && action) executeFunction(record, action);
  },
  section: section => navigateSection(section as SectionId),
  appearance: () => openAppearance(),
  browse: () => browseArray(),
  back: () => nativeBack(),
  bookmark: recordId => {
    if (saved.has(recordId)) saved.delete(recordId); else saved.add(recordId);
    try { localStorage.setItem("rhine-saved", JSON.stringify([...saved])); } catch {}
    facePanel.refresh();
    updateSelection();
  },
  changed: () => publishPresentation(),
});
function sectionFor(record: ArchiveRecord): SectionId {
  return sections.find(s=>s.id === record.section || archiveColumns[s.lane] === record.category)?.id ?? "home";
}
function rootIndex(section: SectionId): number {
  const definition = sections.find(s=>s.id === section) ?? sections[0];
  const index = records.findIndex(r=>r.id === definition.root);
  return index >= 0 ? index : columnFiles(definition.lane)[0];
}
function syncWorkspaceChrome() {
  const visible = started && mode !== "boot" && !visualLab && !viewer?.isOpen;
  $("#viewport").dataset.workspace = String(visible);
  $("#viewport").dataset.overlay = String(Boolean(modal) || Boolean(viewer?.isOpen));
  $("#viewport").dataset.browsing = String(browsingArray);
  $(".workspace-navigation").hidden = !visible;
  $(".workspace-navigation").inert = !visible || Boolean(modal);
  $("#stage").dataset.workspace = String(visible);
  $("#stage").dataset.browsing = String(browsingArray);
  floatingNavigation.select(activeSection,prefs.reduced);
  if (visible && !browsingArray) facePanel.show(records[selected].id, activeSection, workspaceRoot, prefs.reduced);
  else facePanel.hide(prefs.reduced);
  facePanel.setInert(Boolean(modal) || Boolean(viewer?.isOpen));
}
function openWorkspace(index: number, root = false) {
  if (!records[index]) return;
  const continuing = workspaceInitialized && !browsingArray && mode === "detail";
  scene?.setWorkspaceNavigation(continuing);
  browsingArray = false;
  workspaceInitialized = true;
  workspaceRoot = root;
  activeSection = sectionFor(records[index]);
  select(index, undefined, continuing);
  setMode("detail");
  syncWorkspaceChrome();
  publishPresentation();
}
function navigateSection(section: SectionId) {
  const destination = sections.find(s=>s.id === section)?.id ?? "home";
  closeModal(()=>openWorkspace(rootIndex(destination), true));
}
function browseArray() {
  browsingArray = true;
  setMode("archive");
  syncWorkspaceChrome();
}
function openAppearance() { openModal("settings"); }
function executeFunction(record: ArchiveRecord, action: ArchiveAction) {
  if (action.disabled || action.enabled === false) { notify(action.disabledReason ?? "当前状态不可执行"); return; }
  if (action.action === "appearance.open") { openAppearance(); return; }
  skpHost.request(action.action, action.payload);
}
function workspaceState() {
  return { section:activeSection, recordId:records[selected]?.id, root:workspaceRoot, browsing:browsingArray, panel:facePanel.getState() };
}
function restoreWorkspace(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const state = value as ReturnType<typeof workspaceState>;
  if (!sections.some(s=>s.id === state.section)) return false;
  if (state.panel) facePanel.restoreState(state.panel);
  const index = records.findIndex(r=>r.id === state.recordId);
  openWorkspace(index >= 0 ? index : rootIndex(state.section), index < 0 || state.root);
  if (state.browsing) browseArray();
  return true;
}

function homeIndex() {
  const index = records.findIndex(record => record.id === "home.summary");
  return index >= 0 ? index : rootIndex("home");
}
function applySnapshot(snapshot: UiSnapshot) {
  if (!snapshot || !Array.isArray(snapshot.records)) return;
  const previous = records[selected];
  const previousLane = fileLocation(selected).lane;
  const previousRow = columnFiles(previousLane).indexOf(selected);
  const previousSignature = JSON.stringify(previous);
  const memories = columnMemory.map(index => records[index]?.id);
  replaceRecords(snapshot.records);
  archiveColumns.forEach((_, lane) => {
    const index = records.findIndex(record => record.id === memories[lane] && record.category === archiveColumns[lane]);
    columnMemory[lane] = index >= 0 ? index : columnFiles(lane)[0];
  });
  const stable = records.findIndex(record => record.id === previous?.id);
  const neighbors = columnFiles(previousLane);
  const removed = snapshotReceived && stable < 0 && workspaceInitialized;
  selected = !snapshotReceived ? homeIndex() : stable >= 0 ? stable : removed ? rootIndex(activeSection) : neighbors[Math.min(Math.max(0, previousRow), neighbors.length - 1)];
  if (removed) { workspaceRoot = true; notify("项目已移除，已返回列表"); }
  snapshotReceived = true;
  $("#skp-status").textContent = snapshot.statusText ?? (snapshot.configured ? "ROOT CONFIGURED" : "ROOT NOT CONFIGURED");
  scene?.select(selected);
  updateSelection();
  if (mode === "detail" && previousSignature !== JSON.stringify(records[selected])) {
    const scroll = $("#detail-content").scrollTop;
    renderDetail(true);
    $("#detail-content").scrollTop = scroll;
  }
  if (modal === "search" || modal === "saved") renderResults();
  if (workspaceInitialized) { syncWorkspaceChrome(); facePanel.refresh(); }
}
function nativeActionsMarkup() {
  const record = records[selected];
  const progress = typeof record.progress === "number" ? Math.max(0, Math.min(1, record.progress > 1 ? record.progress / 100 : record.progress)) : undefined;
  return `<div class="skp-actions" aria-label="${escapeHtml(record.title)}操作">${(record.actions ?? []).map((action, index) => `<button class="${action.destructive ? "destructive" : ""}" data-native-action="${index}" ${action.disabled || action.enabled === false ? "disabled" : ""}><span>${escapeHtml(action.label)}</span><b aria-hidden="true">${action.destructive ? "−" : "↗"}</b></button>`).join("")}</div>${progress === undefined ? "" : `<div class="skp-progress" role="progressbar" aria-label="下载进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progress * 100)}"><i style="transform:scaleX(${progress})"></i><span>${Math.round(progress * 100)}%</span></div>`}`;
}
function bootTime() { return frozenTime ?? (pausedAt ?? performance.now()) / 1000 - bootStart; }
function publishPresentation() {
  skpHost.event("presentation", { bootTime: !started ? 1.76 : mode === "boot" ? Math.max(0, bootTime()) : 35, bootStarted: started, bootCompleted: started && mode !== "boot", sensorEnabled:started&&mode!=="boot"&&!prefs.reduced&&!modal&&!viewer?.isOpen, dark: prefs.colorTheme === "dark", workspace:workspaceState(), navigation: viewer?.isOpen ? "viewer" : modal ?? (visualLab ? "visual-lab" : mode) });
}
function applyPresentation(value: Presentation) {
  document.documentElement.style.setProperty("--workspace-text-scale", String(Math.max(1, Math.min(2, Number(value.textScale) || 1))));
  document.documentElement.dataset.largeWorkspaceText = String((Number(value.textScale)||1)>1.25);
  facePanel.refresh();
  if (hostReduced !== value.reducedMotion) {
    hostReduced = value.reducedMotion;
    prefs.reduced = hostReduced || userReduced || matchMedia("(prefers-reduced-motion: reduce)").matches;
    savePrefs();
    if (prefs.reduced && started && mode === "boot") setMode("archive");
  }
  syncHostPause();
  if (value.bootAllowed && ready && !started) {
    void audio.unlock();
    completeStartup(false);
  }
}
function syncHostPause() {
  const pause = document.hidden || !skpHost.presentation.active;
  if (pause && pausedAt === undefined) {
    pausedAt = performance.now();
    pausedAnimations = document.getAnimations().filter(animation => animation.playState === "running");
    pausedAnimations.forEach(animation => animation.pause());
    publishPresentation();
  } else if (!pause && pausedAt !== undefined) {
    if (started && mode === "boot") bootStart += (performance.now() - pausedAt) / 1000;
    pausedAt = undefined;
    pausedAnimations.forEach(animation => { if (animation.playState === "paused") animation.play(); });
    pausedAnimations = [];
  }
  audio.setHostPaused(document.hidden || !(skpHost.presentation.audioActive ?? skpHost.presentation.active) ||
    (isAndroid && !started && !skpHost.presentation.bootAllowed));
}
function nativeBack() {
  if (viewer?.isOpen) viewer.close();
  else if (modal) closeModal();
  else if (playground?.active) playground.stop();
  else if (visualLab) setVisualLab(false);
  else if (browsingArray) openWorkspace(selected, workspaceRoot);
  else if (workspaceInitialized && !workspaceRoot) navigateSection(activeSection);
  else if (workspaceInitialized && activeSection !== "home") navigateSection("home");
  else if (workspaceInitialized && mode !== "boot") skpHost.request("navigation.exit");
  else if (mode !== "archive" && started) setMode("archive");
  else skpHost.request("navigation.exit");
}
function visualLabMarkup() {
  return `<section class="skp-lab-settings"><div class="panel-label">MOTION LAB / 动态展示</div><p>原始三维拆解、波浪、升降、音乐频谱、屏幕噪点与波纹接力。</p><div class="skp-actions"><button data-action="visual-lab">${visualLab ? "返回管理器" : "打开动态展示"}<b>↗</b></button><button data-action="lab-model">三维模型 / 拆解与组装<b>↗</b></button><button data-action="native-fallback">基础管理界面<b>↗</b></button></div></section>`;
}
function applyLabSettings() {
  window.dispatchEvent(new CustomEvent("rhine-wallpaper-properties", { detail: {
    audioreactive: { value: visualLab }, reactivemute: { value: false }, reactiveintensity: { value: 100 },
    selectionstyle: { value: "music-flat" }, rhythmstyle: { value: labRhythm }, idlebreathing: { value: true },
    showgame: { value: true }, screenfinish: { value: visualLab && labFinish }, screengrain: { value: 20 },
    screengrainsize: { value: 20 }, screenfringe: { value: 20 }, screenvignette: { value: 20 },
  } }));
  document.querySelectorAll<HTMLElement>("[data-lab-rhythm]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.labRhythm === labRhythm)));
  document.querySelector<HTMLElement>('[data-action="lab-finish"]')?.setAttribute("aria-pressed", String(labFinish));
}
function setVisualLab(enabled: boolean) {
  if (enabled && !visualLab) labReturn = {id:records[selected].id,section:activeSection,root:workspaceRoot};
  visualLab = enabled;
  if (!enabled) playground?.stop();
  else setMode("archive");
  $("#stage").dataset.visualLab = String(enabled);
  if (!playground) playground = new ArchivePlayground($("#stage"), () => scene,
    () => ({ enabled: visualLab && mode === "archive" && ready, paused: Boolean(modal) || modalClosing || !skpHost.presentation.active || document.hidden, reduced: prefs.reduced }),
    value => { musicSuppressed = value; configureAudio(); }, () => audio.play("tick"));
  wallpaperEffects ??= new WallpaperEffects($("#stage"), () => scene);
  if (!document.querySelector(".skp-lab-controls")) $("#stage").insertAdjacentHTML("beforeend", `<section class="skp-lab-controls" aria-label="动态展示控制"><span>MOTION LAB</span><button data-lab-rhythm="wave">波浪</button><button data-lab-rhythm="lift">升降</button><button data-lab-rhythm="legacy">原始节奏</button><button data-action="lab-finish">噪点 / 色散</button><button data-action="lab-model">模型拆解 ↗</button><button data-action="lab-exit">返回管理器 ×</button></section>`);
  applyLabSettings();
  if (!enabled && labReturn) {
    const target = labReturn; labReturn = undefined;
    const index = records.findIndex(r=>r.id === target.id);
    openWorkspace(index >= 0 ? index : rootIndex(target.section), target.root);
  }
  syncWorkspaceChrome();
  publishPresentation();
}
function recordAccess() {
  accessLog.unshift({
    id: records[selected].id,
    time: new Date().toLocaleTimeString("en-GB"),
  });
}
function saveAudioPrefs() {
  try {
    localStorage.setItem("rhine-settings", JSON.stringify({ ...prefs, reduced: userReduced }));
  } catch {}
  configureAudio();
}
function superPerformanceEnabled() { return isWallpaper ? wallpaperHost()?.properties.superperformance?.value === true : prefs.superPerformance; }
function effectiveRenderQuality() { return superPerformanceEnabled() ? superPerformanceQuality : prefs.rendering; }
function savePrefs() {
  saveAudioPrefs();
  if (prefs.reduced) {
    rollingTitles.forEach(title => title.finish());
    detailTransition.finish();
    modalTransition?.finish();
    tabTransition.cancel();
    bookmarkFeedback?.cancel();
  }
  scene?.setReduced(prefs.reduced);
  scene?.setTheme(prefs.colorTheme === "dark", prefs.reduced || !started);
  document.querySelectorAll<HTMLElement>("[data-color-theme]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.colorTheme === prefs.colorTheme)));
  scene?.setSuperPerformance(superPerformanceEnabled());
  viewer?.setSuperPerformance(superPerformanceEnabled());
  scene?.setQuality(effectiveRenderQuality());
  viewer?.setQuality(effectiveRenderQuality());
  syncQualityUI(prefs.rendering);
  updateQualitySummary();
  fileCounter.update({ animated: !prefs.reduced && mode === "archive" });
  rollingTitles.forEach(title => title.update({ animated: !prefs.reduced && mode === "archive" }));
  columnCounter.update({ animated: !prefs.reduced && mode === "archive" });
  selectedCode.update({ animated: !prefs.reduced && mode === "archive" });
  hoverCode.update({ animated: !prefs.reduced && mode === "archive" });
  $("#stage").classList.toggle("reduce-motion", prefs.reduced);
  syncWallpaperBackground();
  if (started) publishPresentation();
}
let previousLayout = "";
function fit() {
  const stage = $("#stage");
  const viewport = $("#viewport");
  floatingNavigation.resize();
  if (isAndroid) {
    const width = window.innerWidth, height = window.innerHeight;
    document.documentElement.style.width = document.body.style.width = viewport.style.width = `${width}px`;
    document.documentElement.style.height = document.body.style.height = viewport.style.height = `${height}px`;
  }
  const coarse = matchMedia("(pointer: coarse)").matches;
  const reference = reviewParams.has("time") || reviewParams.get("review") === "1";
  const { width, height, scale, kind } = mode === "boot" && !reference
    ? openingLayout(viewport.clientWidth, viewport.clientHeight)
    : viewportLayout(viewport.clientWidth, viewport.clientHeight, coarse, mode === "boot");
  stage.style.width = `${width}px`;
  stage.style.height = `${height}px`;
  stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
  stage.dataset.layout = kind;
  stage.dataset.touch = String(coarse);
  viewport.dataset.mobileBoot = String(mode === "boot" && (coarse || viewport.clientWidth < 1100));
  stage.style.setProperty("--stage-scale", String(scale));
  stage.style.setProperty("--opening-width", `${width}px`);
  stage.style.setProperty("--opening-height", `${height}px`);
  stage.style.setProperty("--opening-scan-scale", String(Math.min(1, width / 1920)));
  stage.dataset.openingPortrait = String(width < height);
  // The software keyboard resizes dialogs without recomposing the 3D scene.
  const visible = window.visualViewport;
  const stageTop = (viewport.clientHeight - height * scale) / 2;
  stage.style.setProperty("--modal-top", `${Math.max(0, (visible?.offsetTop ?? 0) - stageTop) / scale}px`);
  stage.style.setProperty("--modal-height", `${Math.min(height, (visible?.height ?? viewport.clientHeight) / scale)}px`);
  $("#viewport").style.setProperty("--scale", String(scale));
  const marks = document.querySelector("#inspection-marks");
  marks?.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const layoutKey = JSON.stringify([width, height, scale, kind, devicePixelRatio]);
  if (layoutKey !== previousLayout) {
    previousLayout = layoutKey;
    scene?.resize();
    viewer?.resize();
  }
  updateQualitySummary();
  // Re-measure line covers and tab underline after wrapping changes.
  requestAnimationFrame(() => {
    documentDecryption.refresh();
    const tab = document.querySelector<HTMLElement>(".detail-tabs button.active");
    const indicator = document.querySelector<HTMLElement>(".tab-indicator");
    if (tab && indicator) indicator.style.transform = `translateX(${tab.offsetLeft}px) scaleX(${tab.offsetWidth})`;
  });
}
window.addEventListener("resize", fit);
window.visualViewport?.addEventListener("resize", fit);
window.visualViewport?.addEventListener("scroll", fit);
matchMedia("(pointer: coarse)").addEventListener("change", fit);
fit();
let fileTicks: HTMLButtonElement[] = [];

function setMode(next: Mode) {
  if (workbench?.enabled && next === "detail") next = "archive";
  if (next !== "detail") scene?.setWorkspaceNavigation(false);
  const previousMode = mode;
  rollingTitles.forEach(title => title.update({ animated: !prefs.reduced && next === "archive" }));
  if (next !== "archive") {
    rollingTitles.forEach(title => title.finish());
    hoverCode.finish();
    $("#hover-label").hidden = true;
  }
  if (next === "detail" && mode !== "detail") recordAccess();
  mode = next;
  if (previousMode === "boot" && next !== "boot" && !reviewParams.has("time") && !isWallpaper) {
    workspaceInitialized = true;
    browsingArray = false;
    workspaceRoot = true;
    activeSection = "home";
    if (next === "archive") queueMicrotask(()=>{ if (mode === "archive" && !browsingArray) openWorkspace(homeIndex(), true); });
  }
  publishPresentation();
  syncWallpaperBackground();
  audio.setScene(next);
  if (next !== "boot" && audioPreview) {
    audioPreview = false;
    audioPreviewRequest++;
    configureAudio();
  }
  $("#stage").dataset.mode = next;
  workbench?.syncVisibility();
  if (previousMode !== next) fit();
  $("#boot").inert = next !== "boot";
  $("#boot").setAttribute("aria-hidden", String(next !== "boot"));
  $("#archive-ui").inert = next !== "archive" || Boolean(modal) || Boolean(workbench?.enabled);
  $("#archive-ui").setAttribute("aria-hidden", String(next !== "archive" || Boolean(workbench?.enabled)));
  $(".system-nav").inert = next === "boot" || Boolean(modal);
  $(".system-footer").inert = next === "boot" || Boolean(modal);
  if (next === "detail") {
    if (previousMode !== "detail") detailTransition.show(prefs.reduced);
  } else if (previousMode === "detail" || (next === "boot" && !$("#detail-ui").hidden)) {
    pendingDetailFocus = false;
    tabTransition.cancel();
    detailTransition.hide(prefs.reduced || next === "boot");
    if (!modal && next === "archive") $(".read-file").focus({ preventScroll: true });
  }
  $("#detail-ui").inert = next !== "detail" || Boolean(modal);
  scene?.setMode(next === "boot" ? "hidden" : next);
  if (next !== "boot") {
    bootSequence.reset();
    $(".file-title").firstChild!.textContent = "FILE NUMBER: ";
    $("#stage").dataset.boot = "done";
  }
  if (next === "detail" && previousMode !== "detail") {
    renderDetail();
    pendingDetailFocus = true;
    if (!scene) {
      $("#detail-content").style.opacity = "1";
      $("#detail-content").style.translate = "0 0";
      $("#detail-content").inert = false;
    }
  }
  if (typeof facePanel !== "undefined") syncWorkspaceChrome();
}
function select(index: number, navigation?: ArchiveNavigation, keepWorkspaceShot = false) {
  selected = (index + records.length) % records.length;
  columnMemory[fileLocation(selected).lane] = selected;
  if(browsingArray){activeSection=sectionFor(records[selected]);floatingNavigation.select(activeSection,prefs.reduced);}
  if (mode === "detail" && !keepWorkspaceShot) setMode("archive");
  activeTab = "overview";
  scene?.select(selected, navigation);
  updateSelection(navigation);
  if (keepWorkspaceShot) renderDetail();
  const columnMove = navigation && "axis" in navigation && navigation.axis === "lane";
  audio.play(columnMove ? "column" : "tick", columnMove ? navigation.direction * .45 : 0);
}
function stepFile(direction: number) {
  const files = columnFiles(fileLocation(selected).lane).filter(index => !records[index].empty);
  if (files.length < 2) return;
  select(
    files[(files.indexOf(selected) + direction + files.length) % files.length],
    { axis: "row", direction },
  );
}
function stepColumn(direction: number) {
  const lane = fileLocation(selected).lane;
  const next = wrap(lane + direction, archiveColumns.length);
  select(columnMemory[next], { axis: "lane", direction });
}
function updateSelection(navigation?: ArchiveNavigation) {
  const r = records[selected];
  const { lane } = fileLocation(selected);
  const files = columnFiles(lane);
  const actualFiles = files.filter(index => !records[index].empty);
  const actualPosition = Math.max(0, actualFiles.indexOf(selected) + 1);
  $("#archive-row-index").textContent = String(actualPosition).padStart(2, "0");
  $("#archive-row-total").textContent = String(actualFiles.length).padStart(2, "0");
  $("#archive-row-name").textContent = archiveColumns[lane];
  $("#archive-row-position").setAttribute("aria-label", `${archiveColumns[lane]}，第 ${actualPosition} 张，共 ${actualFiles.length} 张`);
  $<HTMLButtonElement>('[data-action="row-prev"]').disabled = actualFiles.length < 2;
  $<HTMLButtonElement>('[data-action="row-next"]').disabled = actualFiles.length < 2;
  selectionTitle.update({ text: r.title, animated: !prefs.reduced && mode === "archive" });
  clearanceTitle.update({ text: r.clearance, animated: !prefs.reduced && mode === "archive" });
  categoryTitle.update({ text: r.category, animated: !prefs.reduced && mode === "archive" });
  const direction =
    navigation && "axis" in navigation
      ? navigation.direction > 0
        ? "up"
        : "down"
      : "auto";
  selectedCode.update({
    value: recordNumber(selected),
    animated: !prefs.reduced && mode === "archive",
    direction,
  });
  fileCounter.update({
    value: files.indexOf(selected) + 1,
    animated: !prefs.reduced && mode === "archive",
    direction:
      navigation && "axis" in navigation && navigation.axis === "row"
        ? direction
        : "auto",
  });
  $(".count-total").textContent = String(files.length).padStart(2, "0");
  columnCounter.update({
    value: lane + 1,
    animated: !prefs.reduced && mode === "archive",
    direction:
      navigation && "axis" in navigation && navigation.axis === "lane"
        ? direction
        : "auto",
  });
  columnTitle.update({ text: archiveColumns[lane], animated: !prefs.reduced && mode === "archive" });
  $<HTMLButtonElement>('[data-action="column-prev"]').disabled = false;
  $<HTMLButtonElement>('[data-action="column-next"]').disabled = false;
  // A native list may grow or shrink. Keep ticks matched to the current lane.
  const visibleFiles = files.length > 24 ? files.slice(Math.max(0, files.indexOf(selected) - 12), Math.max(24, files.indexOf(selected) + 12)) : files;
  const tickKey = visibleFiles.join(",");
  if ($("#file-ticks").dataset.items !== tickKey) {
    $("#file-ticks").dataset.items = tickKey;
    $("#file-ticks").innerHTML = visibleFiles.map(index => `<button data-select="${index}"></button>`).join("");
    fileTicks = [...$("#file-ticks").querySelectorAll<HTMLButtonElement>("button")];
  }
  fileTicks.forEach((button, slot) => {
    const index = visibleFiles[slot], record = records[index];
    button.dataset.select = String(index);
    button.setAttribute("aria-label", `选择档案 ${record.id} ${record.title}`);
    button.title = `${record.id} · ${record.title}`;
    button.classList.toggle("selected", index === selected);
    button.setAttribute("aria-pressed", String(index === selected));
  });
  $("#saved-count").textContent = String(saved.size).padStart(2, "0");
}
function replayBoot(forcePreview = false) {
  if (!ready) return;
  closeModal(() => replayBootAfterModal(forcePreview));
}
function replayBootAfterModal(forcePreview: boolean) {
  bootStart = performance.now() / 1000 - 1.76;
  frozenTime = null;
  lastStep = "";
  setMode(prefs.reduced && !forcePreview ? "archive" : "boot");
  audio.restartBoot();
  selected = homeIndex();
  scene?.select(selected);
  updateSelection();
  if (!forcePreview) audio.play("ui-tick");
}
function openFile() {
  if (!ready) return;
  closeModal(() => {
    openWorkspace(selected, sections.some(s=>s.root === records[selected].id));
    audio.play("open");
  });
}
function toggleSaved() {
  const id = records[selected].id;
  if (saved.has(id)) saved.delete(id);
  else saved.add(id);
  try {
    localStorage.setItem("rhine-saved", JSON.stringify([...saved]));
  } catch {}
  $("#saved-count").textContent = String(saved.size).padStart(2, "0");
  const button = $<HTMLButtonElement>('[data-action="bookmark"]');
  const added = saved.has(id);
  button.firstChild!.textContent = added ? "− REMOVE FROM SAVED" : "＋ SAVE ARCHIVE";
  button.querySelector("span")!.textContent = added ? "已收藏" : "收藏档案";
  button.setAttribute("aria-pressed", String(added));
  bookmarkFeedback?.cancel();
  if (!prefs.reduced) bookmarkFeedback = button.animate(
    [{ backgroundColor: "#67634c" }, { backgroundColor: "#252820" }],
    { duration: 220, easing: "ease-out" },
  );
  audio.play("confirm");
  notify(saved.has(id) ? "档案已加入收藏" : "已取消收藏");
}
function renderDetail(preserveReveal = false) {
  tabTransition.cancel();
  const r = records[selected];
  $("#object-id").textContent = "NO." + String(selected + 1).padStart(3, "0");
  $("#detail-content").innerHTML = `
  <div class="detail-kicker"><span>FILE ${escapeHtml(r.id)}</span><span>${escapeHtml(r.clearance)}</span></div>
  <h2>${escapeHtml(r.en)}</h2><div class="detail-title-cn">${escapeHtml(r.title)}<span>${escapeHtml(r.category)}</span></div>
  <div class="detail-rule"></div>
  <dl class="metadata"><div><dt>COMPONENT / 组件</dt><dd>${escapeHtml(r.department)}</dd></div><div><dt>VERSION / 版本</dt><dd>${escapeHtml(r.date)}</dd></div><div><dt>CONTEXT / 上下文</dt><dd>${escapeHtml(r.lead)}</dd></div><div><dt>STATUS / 状态</dt><dd><i></i>${escapeHtml(r.clearance)}</dd></div></dl>
  <div class="detail-tabs" role="tablist"><button id="tab-overview" class="active" role="tab" aria-controls="tab-panel" aria-selected="true" data-tab="overview">01 <span>概述</span></button><button id="tab-notes" role="tab" aria-controls="tab-panel" aria-selected="false" data-tab="notes">02 <span>状态信息</span></button><button id="tab-history" role="tab" aria-controls="tab-panel" aria-selected="false" data-tab="history">03 <span>访问日志</span></button><i class="tab-indicator" aria-hidden="true"></i></div>
  <div id="tab-panel" class="tab-panel" role="tabpanel">${overview()}</div>
  ${nativeActionsMarkup()}
  <div class="detail-actions"><button class="solid-button" data-action="bookmark">${saved.has(r.id) ? "− REMOVE FROM SAVED" : "＋ SAVE ARCHIVE"}<span>${saved.has(r.id) ? "已收藏" : "收藏档案"}</span></button><button class="export-button" data-action="refresh-state" aria-label="刷新当前状态">REFRESH <span>↻</span></button></div>
  <div class="detail-footnote"><span>SKROOT PRO / LIVE DEVICE STATE</span><span>${String(selected + 1).padStart(3, "0")} / ${String(records.length).padStart(3, "0")}</span></div>`;
  $("#detail-content").setAttribute("tabindex", "-1");
  $('[data-action="bookmark"]').setAttribute("aria-pressed", String(saved.has(r.id)));
  documentDecryption.reset($("#detail-content"), preserveReveal || prefs.reduced || !scene || scene.decryptionFrame.phase === "clear");
  setTab(activeTab, false);
}
function overview() {
  return `<div class="panel-label">ABSTRACT / 摘要</div><p>${escapeHtml(records[selected].abstract)}</p>`;
}
function setTab(tab: string, sound = true) {
  if (sound && tab === activeTab) return;
  activeTab = tab;
  document.querySelectorAll("[data-tab]").forEach((b) => {
    const active = (b as HTMLElement).dataset.tab === tab;
    b.classList.toggle("active", active);
    b.setAttribute("aria-selected", String(active));
    b.setAttribute("tabindex", active ? "0" : "-1");
  });
  const r = records[selected];
  const tabButton = $<HTMLButtonElement>(`[data-tab="${tab}"]`);
  const indicator = $(".tab-indicator");
  indicator.style.transition = sound ? "" : "none";
  indicator.style.transform = `translateX(${tabButton.offsetLeft}px) scaleX(${tabButton.offsetWidth})`;
  $("#tab-panel").setAttribute("aria-labelledby", tabButton.id);
  $("#tab-panel").innerHTML =
    tab === "overview"
      ? overview()
      : tab === "notes"
        ? `<div class="panel-label">DEVICE STATE / 状态信息</div><ol class="research-notes">${r.findings.map((f, i) => `<li><span>${String(i + 1).padStart(2, "0")}</span>${escapeHtml(f)}</li>`).join("")}</ol>`
        : `<div class="panel-label">ACCESS LOG / 本次访问</div>${accessLog
            .filter((entry) => entry.id === r.id)
            .slice(0, 4)
            .map(
              (entry) =>
                `<div class="log-row"><span>${entry.time}</span><span>SKP SESSION</span><b>VIEW OPENED</b></div>`,
            )
            .join(
              "",
            )}<p class="log-note">此处记录本次界面访问。设备 Root 状态以实时管理器结果为准。</p>`;
  $("#tab-panel").scrollTop = 0;
  documentDecryption.refresh();
  if (sound) {
    tabTransition.reveal($("#tab-panel"), prefs.reduced);
    audio.play("ui-tick");
  }
}
function notify(message: string) {
  clearTimeout(toastTimer);
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 2600);
}

function openModal(kind: NonNullable<typeof modal>) {
  if (!ready) return;
  if (!modal) {
    previousFocus = document.activeElement as HTMLElement;
    modalSiblings = [...$("#stage").children]
      .filter((node): node is HTMLElement => node instanceof HTMLElement && node.id !== "modal-root")
      .map((node) => ({ node, inert: node.inert }));
    modalSiblings.forEach(({ node }) => (node.inert = true));
    $(".workspace-navigation").inert = true;
    facePanel.setInert?.(true);
  }
  modalClosing = false;
  modal = kind;
  $("#viewport").dataset.overlay = "true";
  searchQuery = "";
  filter = "全部档案";
  audio.play("page-open");
  renderModal();
  publishPresentation();
}
function closeModal(afterClose?: () => void) {
  if (!modal) {
    afterClose?.();
    publishPresentation();
    return;
  }
  if (modalClosing) return;
  modalClosing = true;
  audio.play("page-close");
  modalTransition!.hide(prefs.reduced, () => {
    modal = null;
    $("#viewport").dataset.overlay = String(Boolean(viewer?.isOpen));
    modalClosing = false;
    $("#modal-root").replaceChildren();
    modalTransition = undefined;
    modalSiblings.forEach(({ node, inert }) => (node.inert = inert));
    modalSiblings = [];
    $("#archive-ui").inert = mode !== "archive" || Boolean(workbench?.enabled);
    $("#detail-ui").inert = mode !== "detail";
    $(".workspace-navigation").inert = false;
    facePanel.setInert?.(false);
    previousFocus?.focus({ preventScroll: true });
    afterClose?.();
    publishPresentation();
  });
}
function renderModal() {
  if (!modal) return;
  modalTransition?.dispose();
  $("#modal-root").innerHTML =
    `<div class="modal-backdrop"><section class="terminal-modal ${modal === "settings" ? "settings-modal" : ""}" role="dialog" aria-modal="true" aria-label="${modal === "settings" ? "系统设置" : modal === "saved" ? "收藏档案" : "档案检索"}"><div class="modal-top"><span>SKROOT PRO / ${modal === "settings" ? "SYSTEM PREFERENCES" : "ARCHIVE DIRECTORY"}</span><button data-action="close-modal" aria-label="关闭窗口">CLOSE <span>×</span></button></div>${modal === "settings" ? settingsMarkup() : `<h2>${modal === "saved" ? "SAVED ARCHIVES" : "ARCHIVE INDEX"}<small>${modal === "saved" ? "收藏档案" : "内部档案检索"}</small></h2><div class="search-field"><span>⌕</span><input id="archive-search" type="search" autocomplete="off" placeholder="输入档案编号、名称或科室" aria-label="检索档案"/><span class="key">ESC</span></div><div class="category-filters">${categories.map((c, i) => `<button data-filter="${escapeHtml(c)}" class="${i === 0 ? "active" : ""}">${escapeHtml(c)}</button>`).join("")}</div><div class="result-header"><span>FILE / 档案</span><span>COMPONENT / 组件</span><span>ACCESS</span></div><div id="search-results" class="search-results"></div><div class="modal-bottom"><span id="result-count"></span><span>INTERNAL DATABASE <i>●</i> CONNECTED</span></div>`}</section></div>`;
  const backdrop = $(".modal-backdrop");
  backdrop.hidden = true;
  modalTransition = new SurfaceTransition(backdrop, $(".terminal-modal"));
  modalTransition.show(prefs.reduced);
  if (modal === "settings") updateQualitySummary();
  if (modal !== "settings") {
    renderResults();
    requestAnimationFrame(() => {
      if (backdrop.isConnected && !modalClosing) $("#archive-search").focus();
    });
  } else
    requestAnimationFrame(() => {
      if (backdrop.isConnected && !modalClosing) $('[data-action="close-modal"]').focus();
    });
  $("#modal-root")
    .querySelector(".modal-backdrop")
    ?.addEventListener("click", (e) => {
      if (e.target === e.currentTarget) closeModal();
    });
}
function renderResults() {
  const results = functionResults(records, searchQuery, filter, modal === "saved" ? saved : undefined);
  $("#search-results").innerHTML = results.length ? results.map(({kind,record:r,action,index})=>{
    const actionIndex = action ? r.actions!.indexOf(action) : -1;
    const disabled = action?.disabled || action?.enabled === false;
    return `<button class="result-row function-result" ${action ? `data-function-record="${escapeHtml(r.id)}" data-function-action="${actionIndex}"` : `data-result="${index}"`} ${disabled ? 'aria-disabled="true"' : ""}><span class="result-name"><b>${kind === "action" ? "功能" : r.kind === "application" ? "应用" : "项目"}</b><span>${escapeHtml(action?.label ?? r.title)}<small>${escapeHtml(r.category)}${action ? ` / ${escapeHtml(r.title)}` : ""}</small></span></span><span>${escapeHtml(disabled ? action?.disabledReason ?? "暂不可用" : r.status?.label ?? "")}</span><span aria-hidden="true">↗</span></button>`;
  }).join("") : `<div class="empty-results"><strong>${modal === "saved" ? "暂无常用项目" : "没有匹配的功能或项目"}</strong><button data-action="reset-search">全部功能 →</button></div>`;
  $("#result-count").textContent =
    `${String(results.length).padStart(2, "0")} RECORDS FOUND`;
  $("#archive-search").setAttribute("placeholder", "搜索功能、应用、模块或包名");
  $("#archive-search").setAttribute("aria-label", "搜索功能");
  const heading = document.querySelector(".terminal-modal h2");
  if (heading) heading.innerHTML = `${modal === "saved" ? "常用" : "搜索功能"}<small>SKROOT PRO / FUNCTION INDEX</small>`;
  const resultsHeader = document.querySelector(".result-header");
  if (resultsHeader) resultsHeader.innerHTML = '<span>功能与项目</span><span>当前状态</span><button data-search-saved="true">常用 →</button>';
}
function updateQualitySummary() {
  const summary = document.querySelector("#quality-summary");
  if (!summary) return;
  if (!scene) { summary.textContent = "3D 已关闭 · 三维模型与渲染资源已释放"; return; }
  const canvas = scene.renderer.domElement;
  const metrics = JSON.parse(canvas.parentElement?.dataset.renderQuality ?? "{}");
  summary.textContent = `${superPerformanceEnabled() ? "超级性能模式已启用 · 画质设置暂被覆盖，关闭后恢复 · " : ""}实际渲染 ${canvas.width} × ${canvas.height} · ${effectiveRenderQuality().antialias === "smaa" ? "SMAA" : "原始抗锯齿"} · 纹理 ${metrics.anisotropy ?? 1}×${metrics.limited ? " · 已达到缓冲上限" : ""}`;
}
function motionSettingsMarkup() {
  return `<div id="motion-preference-note" class="motion-preference-note"><p>${prefs.reduced
    ? `当前已减少动态效果。${matchMedia("(prefers-reduced-motion: reduce)").matches ? "系统也请求减少动画，可仅为本站启用完整动效。" : "关闭上方开关可恢复完整动效。"}`
    : "当前使用完整动效。"}</p>${prefs.reduced ? '<button data-action="enable-motion">启用完整动效并重播 ↻</button>' : ""}</div>`;
}
function settingsMarkup() {
  return `<h2>SYSTEM SETTINGS<small>终端偏好设置</small></h2><p class="settings-intro">SKP SESSION <span>·</span> SESSION CONNECTED</p>${isWallpaper ? '<p class="wallpaper-settings-note">每次启动都会读取 Wallpaper Engine 中的设置。在此修改仅对当前运行生效，无法持久保存；如需保留，请在 Wallpaper Engine 的壁纸属性中调整。</p>' : ""}<div class="settings-list">${themeSettingsMarkup(prefs.colorTheme === "dark")}${!isWallpaper ? `<label><div><strong>SUPER PERFORMANCE</strong><span>降低三维画质和渲染分辨率，保留完整动效；关闭后恢复原画质</span></div><input type="checkbox" data-pref="superPerformance" ${prefs.superPerformance ? "checked" : ""}/><i class="toggle"></i></label>` : ""}${workbench?.settingsMarkup() ?? ""}${audioSettingsMarkup(prefs)}<label><div><strong>REDUCED MOTION</strong><span>跳过开机动画，简化选档、镜头和文字动效</span></div><input type="checkbox" data-pref="reduced" ${prefs.reduced ? "checked" : ""}/><i class="toggle"></i></label></div>${motionSettingsMarkup()}${qualityMarkup(prefs.rendering)}${isAndroid ? visualLabMarkup() : pwaSettingsMarkup()}<div class="settings-shortcuts">${isWallpaper ? '<span>DESKTOP CONTROLS</span><p>拖动阵列或点击界面按钮浏览档案。桌面模式下，方向键与滚轮可能无法传入壁纸。</p>' : '<span>KEYBOARD CONTROLS</span><p><kbd>←</kbd><kbd>→</kbd> 切列 <kbd>↑</kbd><kbd>↓</kbd> 选档 <kbd>ENTER</kbd> 读取 <kbd>/</kbd> 检索 <kbd>ESC</kbd> 返回</p>'}</div><div class="settings-bottom">${!isWallpaper && document.fullscreenEnabled ? '<button data-action="fullscreen">FULLSCREEN <span>↗</span></button>' : ''}<button data-action="restart">REINITIALIZE SYSTEM <span>↻</span></button></div><div class="modal-bottom"><span>SKP-PRTS / 4.6.2.1 · 使用 MiSans 字体（小米） <a href="${assetUrl("fonts/MiSans-license.pdf")}" target="_blank" rel="noopener">字体许可</a></span><span>POWERED BY SKROOT PRO</span></div>`;
}

document.addEventListener("input", (e) => {
  const slider = e.target as HTMLInputElement;
  if (slider.dataset.quality) {
    const output = document.querySelector<HTMLOutputElement>(`[data-quality-output="${slider.dataset.quality}"]`);
    if (output) output.value = `${slider.value}%`;
  }
  const volume = e.target as HTMLInputElement;
  if (volume.dataset.volume === "musicVolume" || volume.dataset.volume === "soundVolume") {
    prefs[volume.dataset.volume] = Number(volume.value) / 100;
    volume.closest("label")?.querySelector("output")?.replaceChildren(`${volume.value}%`);
    saveAudioPrefs();
  }
  if ((e.target as HTMLElement).id === "archive-search") {
    searchQuery = (e.target as HTMLInputElement).value;
    renderResults();
  }
});
document.addEventListener("change", (e) => {
  const el = e.target as HTMLInputElement;
  if (el.id === "quality-preset" && Object.hasOwn(qualityPresets, el.value)) {
    prefs.rendering = { ...qualityPresets[el.value as QualityPreset] };
    savePrefs();
  } else if (el.dataset.quality) {
    const key = el.dataset.quality as keyof RenderQuality;
    prefs.rendering = normalizeQuality({ ...prefs.rendering, [key]: key === "antialias" ? el.value : Number(el.value) });
    savePrefs();
  }
  if (el.dataset.pref) {
    const key = el.dataset.pref;
    if (key === "reduced") {
      userReduced = el.checked;
      prefs.reduced = userReduced || hostReduced || matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.checked = prefs.reduced;
      if (prefs.reduced && mode === "boot") setMode("archive");
    } else if (key === "sound" || key === "music" || key === "quality" || key === "superPerformance") prefs[key] = el.checked;
    if (key === "sound" || key === "music") saveAudioPrefs(); else savePrefs();
    if (key === "reduced") $("#motion-preference-note").outerHTML = motionSettingsMarkup();
    audio.play("confirm");
  }
});
document.addEventListener("click", (e) => {
  const sectionButton = (e.target as Element).closest<HTMLElement>(".workspace-navigation [data-section]");
  if (sectionButton && started && mode !== "boot") { navigateSection(sectionButton.dataset.section as SectionId); return; }
  if ((e.target as Element).closest("[data-search-saved]")) { modal = "saved"; renderModal(); return; }
  const themeButton = (e.target as Element).closest<HTMLElement>("[data-color-theme]");
  if (themeButton) { prefs.colorTheme = themeButton.dataset.colorTheme === "dark" ? "dark" : "light"; savePrefs(); publishPresentation(); return; }
  if (!started) return;
  if (modalClosing) return;
  const el = (e.target as Element).closest<HTMLElement>("button");
  if (!el) return;
  if (el.dataset.functionRecord) {
    const record = records.find(r=>r.id === el.dataset.functionRecord);
    const action = record?.actions?.[Number(el.dataset.functionAction)];
    if (record && action) closeModal(()=>executeFunction(record, action));
    return;
  }
  if (el.dataset.nativeAction !== undefined) {
    const action = records[selected]?.actions?.[Number(el.dataset.nativeAction)];
    if (action?.action === "appearance.open") { openModal("settings"); return; }
    if (action && action.enabled !== false && !action.disabled) skpHost.request(action.action, action.payload);
    return;
  }
  if (el.dataset.select !== undefined) {
    select(Number(el.dataset.select));
    return;
  }
  if (el.dataset.result) {
    const index = Number(el.dataset.result);
    closeModal(() => {
      select(index);
      openFile();
    });
    return;
  }
  if (el.dataset.filter) {
    filter = el.dataset.filter;
    document
      .querySelectorAll("[data-filter]")
      .forEach((b) =>
        b.classList.toggle(
          "active",
          (b as HTMLElement).dataset.filter === filter,
        ),
      );
    renderResults();
    return;
  }
  if (el.dataset.tab) {
    setTab(el.dataset.tab);
    return;
  }
  const action = el.dataset.action;
  if (action === "refresh-state") { skpHost.request("refresh", { scope: ["authorization", "modules", "home", "market", "settings"][fileLocation(selected).lane] }); return; }
  if (action === "visual-lab") { closeModal(() => setVisualLab(!visualLab)); return; }
  if (action === "lab-exit") { setVisualLab(false); return; }
  if (action === "lab-finish") { labFinish = !labFinish; applyLabSettings(); return; }
  if (action === "native-fallback") { skpHost.request("fallback.open"); return; }
  if (action === "lab-model") { closeModal(() => { setMode("detail"); document.querySelector<HTMLButtonElement>('[data-action="model-viewer"]')?.click(); }); return; }
  if (el.dataset.labRhythm) { labRhythm = el.dataset.labRhythm; applyLabSettings(); return; }
  if (action === "toggle-three") { void toggleThree(); return; }
  if (action === "sound-preview") audio.play("confirm");
  if (action === "skip") {
    if (isAndroid) skpHost.event("presentation", { bootCompleted: true, bootStarted: true, bootTime: 35, navigation: "archive" });
    setMode("archive");
    audio.play("confirm");
  }
  if (action === "prev" || action === "row-prev") stepFile(-1);
  if (action === "next" || action === "row-next") stepFile(1);
  if (action === "column-prev") stepColumn(-1);
  if (action === "column-next") stepColumn(1);
  if (action === "open") openFile();
  if (action === "model-viewer" && mode === "detail" && scene) {
    const activeScene = scene;
    // Safari does not always focus a button when it is tapped. Capture the
    // actual opener so closing the modal reliably restores the right control.
    el.focus({ preventScroll: true });
    viewer ??= new ModelViewer($("#stage"), () => { audio.setScene(mode); audio.play("page-close"); syncWorkspaceChrome(); publishPresentation(); }, (sound) => audio.play(sound === "tick" ? "ui-tick" : sound));
    audio.setScene("viewer");
    viewer.setSuperPerformance(superPerformanceEnabled());
    viewer.setQuality(effectiveRenderQuality());
    scene.finishDecryption();
    viewer.open(
      records[selected].id,
      records[selected].title,
      () => activeScene.createAssemblyModel(),
      prefs.reduced,
    );
    syncWorkspaceChrome();
    publishPresentation();
    audio.play("page-open");
  }
  if (action === "back") {
    nativeBack();
    audio.play("back");
  }
  if (action === "search" || action === "saved" || action === "settings") {
    el.focus({ preventScroll: true });
    openModal(action);
  }
  if (action === "close-modal") closeModal();
  if (action === "bookmark") toggleSaved();
  if (action === "reset-search") {
    modal = "search";
    searchQuery = "";
    filter = "全部档案";
    renderModal();
  }
  if (action === "replay" || action === "restart") {
    replayBoot();
  }
  if (action === "enable-motion") {
    userReduced = false;
    prefs.reduced = hostReduced || matchMedia("(prefers-reduced-motion: reduce)").matches;
    savePrefs();
    replayBoot();
  }
  if (action === "fullscreen" && document.fullscreenEnabled) {
    if (document.fullscreenElement) void document.exitFullscreen();
    else
      void document.documentElement
        .requestFullscreen()
        .catch(() => notify("请使用浏览器的全屏快捷键 F11"));
  }
});
document.addEventListener("keydown", (e) => {
  if (workspaceInitialized && mode !== "boot" && !modal && !visualLab && !viewer?.isOpen) {
    if (e.key === "Escape") { e.preventDefault(); nativeBack(); return; }
    if (!browsingArray && ["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Enter"," "].includes(e.key)) return;
  }
  if (!started) return;
  if (viewer?.isOpen) return;
  if (playground?.active && !modal) {
    if (e.key === "Escape") { e.preventDefault(); playground.stop(); }
    else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", "/"].includes(e.key) && !(e.target instanceof HTMLButtonElement)) e.preventDefault();
    return;
  }
  if (modalClosing) {
    e.preventDefault();
    return;
  }
  const typing = e.target instanceof HTMLInputElement;
  if (e.key === "Escape") {
    if (modal) closeModal();
    else if (mode === "detail" || (mode === "boot" && ready)) { const sound = mode === "detail" ? "back" : "ui-tick"; setMode("archive"); audio.play(sound); }
    return;
  }
  if (modal && e.key === "Tab") {
    const focusables = [
      ...$("#modal-root").querySelectorAll<HTMLElement>(
        'button,input:not(:disabled),select:not(:disabled),summary,[tabindex="0"]',
      ),
    ];
    const visible = focusables.filter(el => el.getClientRects().length > 0);
    const first = visible[0],
      last = visible.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
    return;
  }
  if (typing || modal || !ready) return;
  if (
    (e.target as HTMLElement).dataset.tab &&
    ["ArrowLeft", "ArrowRight"].includes(e.key)
  ) {
    e.preventDefault();
    const tabs = ["overview", "notes", "history"];
    setTab(
      tabs[(tabs.indexOf(activeTab) + (e.key === "ArrowRight" ? 1 : 2)) % 3],
    );
    $<HTMLButtonElement>(`[data-tab="${activeTab}"]`).focus();
    return;
  }
  if (e.key === "/") {
    e.preventDefault();
    if (mode === "boot") setMode("archive");
    openModal("search");
  }
  if (e.key === "ArrowLeft" && mode !== "boot") {
    e.preventDefault();
    stepColumn(-1);
  }
  if (e.key === "ArrowRight" && mode !== "boot") {
    e.preventDefault();
    stepColumn(1);
  }
  if (["ArrowUp", "ArrowDown"].includes(e.key) && mode !== "boot") {
    e.preventDefault();
    stepFile(e.key === "ArrowUp" ? -1 : 1);
  }
  if (
    e.key === "Enter" &&
    (document.activeElement === document.body ||
      document.activeElement?.id === "detail-content" ||
      ["prev", "next", "column-prev", "column-next"].includes(
        (document.activeElement as HTMLElement)?.dataset.action ?? "",
      ) ||
      (document.activeElement as HTMLElement)?.dataset.select)
  ) {
    e.preventDefault();
    if (mode === "boot") setMode("archive");
    else if (mode === "archive") openFile();
  }
});

const ease = (t: number) => {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
};
function bootFrame(t: number) {
  if (isWallpaper && !scene && frozenTime === null && t >= 21.9) {
    setMode("archive");
    return undefined;
  }
  if (isWallpaper && frozenTime === null && t >= ARRAY_OPENING_END &&
      !openingShowsDetail(wallpaperHost()?.properties.openingdetail?.value, !!workbench?.enabled)) {
    setMode("archive");
    return undefined;
  }
  audio.updateBoot(t, frozenTime !== null);
  const motion = bootSequence.update(t);
  if (workbench?.enabled && frozenTime === null) {
    const end = openingShowsDetail(wallpaperHost()?.properties.openingdetail?.value, true) ? 35 : ARRAY_OPENING_END;
    if (t > end - .35) $(".powered").style.opacity = String(1 - ease((t - end + .35) / .35));
  }
  let step: string = motion.step;
  if (t >= 22) {
    step = "array";
  }
  if (t >= 25.68) {
    step = "select";
  }
  if (t >= 28.3) {
    step = "inspect";
  }
  if (step !== lastStep) {
    $("#stage").dataset.boot = step;
    lastStep = step;
  }
  $(".file-title").firstChild!.textContent =
    step === "array"
      ? "SELECTING FILES...".slice(0, Math.max(0, Math.floor((t - 21.94) * 18)))
      : "FILE NUMBER: ";
  $("#stage").style.setProperty(
    "--entry-opacity",
    String(ease((t - 21.9) / 0.13)),
  );
  $(".callout-rule").style.transform = `scaleX(${ease((t - 22.08) / 0.9)})`;
  const reveal = ease((t - 22) / 0.4),
    lift = ease((t - 26) / 1.8),
    zoom = 0.55 * ease((t - 27.3) / 1.65) + 0.45 * ease((t - 29.0) / 5.0);
  if (t >= 35) {
    setMode("detail");
    return undefined;
  }
  return { reveal, lift, zoom, time: t };
}

const inspectionOverlay = new InspectionOverlay();
const documentDecryption = new DocumentDecryption();
// A newly opened archive can introduce another font shard. Re-measure its
// redaction lines after font swap while retaining the current reveal progress.
document.fonts.addEventListener("loadingdone", () => documentDecryption.refresh());

let lastTime = 0,
  frameCount = 0,
  frameStart = performance.now(),
  fps = 0;
function frame(ms: number) {
  if (!wallpaperFrame(ms)) { requestAnimationFrame(frame); return; }
  if (document.hidden || !skpHost.presentation.active) { requestAnimationFrame(frame); return; }
  workbench?.tick();
  const time = ms / 1000;
  const tiltEnabled = started && mode !== "boot" && !prefs.reduced && !modal && !viewer?.isOpen && skpHost.presentation.active;
  scene?.setDeviceTilt(tiltEnabled?sensorTilt.x:0,tiltEnabled?sensorTilt.y:0);
  const theme = scene?.themeAmount ?? (prefs.colorTheme === "dark" ? 1 : 0);
  paintTheme(theme);
  viewer?.setTheme(theme);
  if (visualLab) { const samples = audio.spectrum(); if (samples) window.rhineWallpaperSpectrum = { samples, time }; }
  playground?.tick(time);
  const cinema =
    mode === "boot" && ready
      ? bootFrame(frozenTime ?? time - bootStart)
      : undefined;
  wallpaperEffects?.update(time, prefs.reduced);
  // The calibrated 2D opening fully covers the scene until array entry.
  scene?.setFolderFrameSync(facePanel.needsDepthFrame && started && mode!=="boot" && !visualLab && !viewer?.isOpen && !modal);
  // Present the completed pair before preparing the next one, allowing one
  // matched canvas/mask per refresh without synchronously waiting for the GPU.
  if(scene?.folderFrameSynchronized&&facePanel.depthFrameReady)facePanel.update(scene,true,time);
  if (!viewer?.isOpen && (!cinema || cinema.time >= 21.9)) scene?.update(time, cinema);
  viewer?.update(time);
  if (threeState === "closing" && scene?.presentationHidden) releaseThree();
  playground?.position();
  if (scene && mode === "detail") {
    documentDecryption.update(time, scene.decryptionFrame, prefs.reduced);
    $("#detail-content").style.opacity = String(scene.detailVisibility);
    $("#detail-content").style.translate =
      `0 ${(1 - scene.detailVisibility) * 18}px`;
    $("#detail-content").inert = scene.detailVisibility < 0.1;
    if (pendingDetailFocus && scene.detailVisibility >= 0.1 && !modal && !viewer?.isOpen) {
      $("#detail-content").focus({ preventScroll: true });
      pendingDetailFocus = false;
    }
  }
  facePanel.update(scene, started && mode !== "boot" && !browsingArray && !visualLab && !viewer?.isOpen, time);
  const tilt = tiltEnabled ? scene?.deviceTilt ?? {x:0,y:0} : {x:0,y:0};
  floatingNavigation.setMotion(tilt.x,tilt.y,prefs.reduced);
  $(".brand").style.translate=`${tilt.x*.3}px ${tilt.y*.25}px`;
  $(".system-nav").style.translate=`${tilt.x*.55}px ${tilt.y*.45}px`;
  $("#stage").style.setProperty("--detail-shade", String(mode === "boot" ? 0 : scene?.detailVisibility ?? 0));
  const currentScene = scene;
  if (currentScene) inspectionOverlay.render(currentScene.decryptionFrame,
    (x, y) => currentScene.projectCard(x, y), Boolean(cinema));
  if (Math.floor(time) !== lastTime) {
    lastTime = Math.floor(time);
    updateFooterClock(new Date(), !prefs.reduced);
  }
  frameCount++;
  if (ms - frameStart > 1000) {
    fps = (frameCount * 1000) / (ms - frameStart);
    frameStart = ms;
    frameCount = 0;
    publishPresentation();
    $("#three-scene").dataset.fps = String(Math.round(fps));
    $("#three-scene").dataset.renderStats = JSON.stringify(scene?.getStats() ?? { loaded: false, drawCalls: 0, triangles: 0 });
  }
  requestAnimationFrame(frame);
}
function bindScene(scene: ArchiveScene, cell?: { lane: number; row: number }) {
    scene.onOpen = index => { if (!visualLab && !modal) openWorkspace(index, sections.some(s=>s.root===records[index]?.id)); };
    let backgroundStart: {x:number;y:number;pointer:number}|undefined;
    const canvas = scene.renderer.domElement;
    canvas.addEventListener("pointerdown", event => { backgroundStart = {x:event.clientX,y:event.clientY,pointer:event.pointerId}; }, true);
    canvas.addEventListener("pointermove", event => {
      if (!backgroundStart || event.pointerId !== backgroundStart.pointer || browsingArray || visualLab || modal || mode !== "detail") return;
      if (Math.hypot(event.clientX-backgroundStart.x,event.clientY-backgroundStart.y) <= 10) return;
      backgroundStart = undefined;
      browseArray();
      canvas.dispatchEvent(new PointerEvent("pointerdown", {pointerId:event.pointerId,pointerType:event.pointerType,clientX:event.clientX,clientY:event.clientY,button:0,buttons:1,bubbles:true}));
    }, true);
    canvas.addEventListener("pointerup", ()=>{backgroundStart=undefined;}, true);
    canvas.addEventListener("pointercancel", ()=>{backgroundStart=undefined;}, true);
    scene.renderer.domElement.addEventListener("webglcontextlost", event => {
      event.preventDefault();
      skpHost.event("error", { reason: "三维绘制上下文丢失，请重试界面或进入基础管理。" });
    }, { once: true });
    scene.select(selected, cell ? { cell } : undefined);
    scene.onSelect = (i, cell) => {
      if (mode !== "archive" || modal || viewer?.isOpen) return;
      select(i, cell ? { cell } : undefined);
    };
    scene.onNavigate = (axis, direction) => {
      if (mode !== "archive" || modal || viewer?.isOpen) return;
      if (axis === "lane") stepColumn(direction);
      else stepFile(direction);
    };
    scene.onHover = (i) => {
      const label = $("#hover-label");
      if (i === null) {
        label.hidden = true;
        hoverCode.finish();
        hoverTitle.finish();
        return;
      }
      const animated = !prefs.reduced && mode === "archive";
      hoverCode.update({
        value: recordNumber(i),
        animated: !label.hidden && animated,
      });
      hoverTitle.update({ text: records[i].title, animated: !label.hidden && animated });
      label.hidden = false;
      // Prepare the first visible value so the next hover can animate immediately.
      hoverCode.update({ animated });
      hoverTitle.update({ animated });
    };
}
function syncThreeButton() {
  $("#stage").dataset.threeState = threeState;
  syncWallpaperBackground();
  const button = document.querySelector<HTMLButtonElement>('[data-action="toggle-three"]');
  if (!button) return;
  button.textContent = threeState === "loading" ? "3D 载入中…" : threeState === "closing" ? "3D 关闭中…" : threeState === "off" ? "3D 关闭" : "3D 开启";
  button.disabled = threeState === "loading";
  button.setAttribute("aria-pressed", String(threeState === "on"));
  button.title = threeState === "off" ? "重新载入三维模型" : threeState === "closing" ? "取消关闭，恢复三维画面" : "卸载三维模型，保留 2D 界面";
}
function releaseThree() {
  if (!scene) return;
  resumeCell = { ...scene.getStats().selectedCell }; resumeSelection = selected;
  viewer?.dispose(); viewer = undefined;
  scene.dispose(); scene = undefined;
  if (mode === "detail") {
    $("#detail-content").style.opacity = "1";
    $("#detail-content").style.translate = "0 0";
    $("#detail-content").inert = false;
    documentDecryption.reset($("#detail-content"), true);
  }
  threeState = "off"; syncThreeButton();
  $("#hover-label").hidden = true;
  delete $("#three-scene").dataset.renderQuality;
  updateQualitySummary();
}
async function toggleThree() {
  if ((!isWallpaper && !isAndroid) || !ready || threeState === "loading") return;
  if (threeState === "closing") {
    scene?.setPresentationVisible(true, prefs.reduced);
    threeState = "on"; syncThreeButton(); return;
  }
  if (scene) {
    playground?.stop();
    threeState = "closing"; syncThreeButton();
    scene.setPresentationVisible(false, prefs.reduced);
    if (prefs.reduced) releaseThree();
    return;
  }
  threeState = "loading"; syncThreeButton();
  let next: ArchiveScene | undefined;
  try {
    next = new ArchiveScene($("#three-scene"));
    next.renderer.domElement.style.opacity = "0";
    next.setPresentationVisible(false, true);
    await next.load();
    next.setMode(mode === "detail" ? "detail" : "archive");
    bindScene(next, resumeSelection === selected ? resumeCell : undefined);
    next.revealImmediately();
    scene = next;
    scene.setTheme(prefs.colorTheme === "dark", true);
    scene.setArchiveCoverage(wallpaperHost()?.properties.archivecoverage?.value === "extra");
    savePrefs();
    scene.setPresentationVisible(true, prefs.reduced);
    threeState = "on"; syncThreeButton();
  } catch (error) {
    next?.dispose(); scene = undefined;
    threeState = "off"; syncThreeButton();
    notify("三维模型载入失败，请点击 3D 关闭重试。");
    console.error(error);
  }
}

async function start() {
  try {
    if (isWallpaper) await window.rhineWallpaperPropertiesReady;
    if (!isWallpaper || wallpaperHost()?.properties.load3donstartup?.value !== false) {
      scene = new ArchiveScene($("#three-scene"));
      scene.setTheme(prefs.colorTheme === "dark", true);
      scene.setArchiveCoverage(wallpaperHost()?.properties.archivecoverage?.value === "extra");
    } else {
      threeState = "off";
      syncThreeButton();
    }
    await Promise.all([
      scene?.load(),
      loadBootWebfonts(),
      // With unicode-range faces, preload the opening's actual characters,
      // not every font shard. Other archive text loads on demand.
      document.fonts.load("300 20px MiSans", "ACCESS WELCOME TO INTERNAL DATABASE"),
      document.fonts.load("400 20px MiSans", "身份信息确认请求已接收开始处理权限验证通过欢迎访问SKRoot Pro内部资料档案编号保密级别商业区选择档案：0123456789 SKP SESSION"),
      document.fonts.load("600 20px MiSans", "SYNTHESIZE INFORMATION ANALYSIS OS"),
      document.fonts.load("700 20px MiSans", "SKROOT PRO WELCOME TO INTERNAL DATABASE"),
    ]);
    if (scene) bindScene(scene);
    savePrefs();
    ready = true;
    select(homeIndex());
    if (entry) entry.ready();
    else {
      if (isWallpaper || isAndroid) {
        // CEF allows automatic audio; never block the visual on audio policy or decoding.
        await Promise.race([audio.unlock(), new Promise(resolve => setTimeout(resolve, 3000))]);
      }
      if (!isAndroid || skpHost.presentation.bootAllowed) completeStartup(false);
    }
  } catch (error) {
    console.error(error);
    skpHost.event("error", { reason: String(error) });
    scene?.dispose(); scene = undefined; threeState = "off";
    ready = true;
    if (!isAndroid || skpHost.presentation.bootAllowed) completeStartup(false);
    notify("三维资源暂不可用，管理功能仍可使用；设置中可重试。");
  }
}
function completeStartup(silent: boolean) {
  if (started || !ready || (isAndroid && !skpHost.presentation.bootAllowed)) return;
  started = true;
  // A first-run native key form can hold the page before the boot clock exists.
  // Pause compensation starts with this boot, never with resource loading.
  if (pausedAt !== undefined) pausedAt = performance.now();
  if (silent) {
    prefs.sound = false;
    prefs.music = false;
    saveAudioPrefs();
  }
  audio.releaseEntry();
  audio.restartBoot();
  const fade = prefs.reduced ? 0 : 600;
  bootStart = performance.now() / 1000 - (reviewParams.has("time") ? Number(reviewParams.get("time")) : 1.76);
  if (!reviewParams.has("time")) bootStart += fade / 1000;
  setMode("boot");
  if (reviewParams.get("scene") === "archive" || (prefs.reduced && !reviewParams.has("time"))) setMode("archive");
  if (reviewParams.get("scene") === "detail") setMode("detail");
  if (isWallpaper && wallpaperHost()?.properties.boot?.value === false) setMode("archive");
  if (isAndroid && !reviewEntry) {
    if (skpHost.presentation.initialBootCompleted) setMode("archive");
    else if (typeof skpHost.presentation.initialBootTime === "number" && skpHost.presentation.initialBootTime > 0) bootStart = performance.now() / 1000 - skpHost.presentation.initialBootTime;
  }
  if (isAndroid && !reviewEntry && skpHost.presentation.initialBootCompleted) {
    if (!restoreWorkspace(skpHost.presentation.workspace)) openWorkspace(homeIndex(), true);
  }
  publishPresentation();
  $("#stage").inert = false;
  $(".mobile-entry").inert = false;
  loading.classList.add("loaded");
  loading.inert = true;
  setTimeout(() => {
    const restoreFocus = loading.contains(document.activeElement) || document.activeElement === document.body;
    loading.remove();
    if (entry && restoreFocus) {
      const skip = $("#skip");
      const target = mode === "boot" ? skip.getClientRects().length ? skip : $(".mobile-entry") : $(".read-file");
      target.focus({ preventScroll: true });
    }
  }, fade);
  requestAnimationFrame(frame);
  // Do not compete with entry audio/font downloads. Full offline installation
  // begins after startup is complete and remains atomic.
  if (!isAndroid) setTimeout(() => void initPwa(notify), 1500);
}
updateSelection();
const customBackground = isWallpaper ? new WallpaperBackground($("#stage"), notify) : undefined;
function syncWallpaperBackground(retry = false) {
  customBackground?.update(wallpaperHost()?.properties ?? {}, mode !== "boot" && (threeState === "off" || threeState === "loading"), prefs.reduced, retry);
}
if (isWallpaper) {
  const apply = (properties: WallpaperProperties) => {
    const theme = properties.colortheme?.value;
    if (theme === "light" || theme === "dark") prefs.colorTheme = theme;
    scene?.setArchiveCoverage(properties.archivecoverage?.value === "extra" || wallpaperHost()?.properties.archivecoverage?.value === "extra");
    for (const key of ["sound", "music", "reduced"] as const)
      if (typeof properties[key]?.value === "boolean") prefs[key] = properties[key].value as boolean;
    for (const key of ["soundVolume", "musicVolume"] as const) {
      const value = properties[key.toLowerCase()]?.value;
      if (typeof value === "number" && Number.isFinite(value)) prefs[key] = Math.max(0, Math.min(1, value / 100));
    }
    const qualityProperties = { ...wallpaperHost()?.properties, ...properties };
    if (Object.keys(properties).some(key => key === "renderquality" || key.startsWith("quality")))
      prefs.rendering = wallpaperQuality(qualityProperties, prefs.rendering);
    savePrefs();
    if (properties.customwallpaperfile || properties.customwallpaper?.value === true) syncWallpaperBackground(true);
    if (properties.boot?.value === false && started && mode === "boot") setMode("archive");
    // Keep an already-open settings surface in sync without replacing focused controls.
    document.querySelectorAll<HTMLInputElement>("[data-pref]").forEach(input => {
      const key = input.dataset.pref as "sound" | "music" | "reduced";
      if (key in prefs) input.checked = prefs[key];
    });
    for (const key of ["soundVolume", "musicVolume"] as const) {
      const input = document.querySelector<HTMLInputElement>(`[data-volume="${key}"]`);
      if (input) { input.value = String(Math.round(prefs[key] * 100)); input.closest("label")?.querySelector("output")?.replaceChildren(`${input.value}%`); }
    }
  };
  window.addEventListener("rhine-wallpaper-properties", event => apply((event as CustomEvent<WallpaperProperties>).detail));
  let pausedAt: number | undefined;
  const pause = () => {
    const paused = wallpaperHost()?.paused ?? false;
    if (paused && pausedAt === undefined) pausedAt = performance.now();
    if (!paused && pausedAt !== undefined) {
      if (started && mode === "boot") bootStart += (performance.now() - pausedAt) / 1000;
      pausedAt = undefined;
    }
    audio.setHostPaused(paused);
  };
  window.addEventListener("rhine-wallpaper-pause", pause);
  apply(wallpaperHost()?.properties ?? {});
  pause();
}
if (isWallpaper) {
  workbench = new Workbench($("#stage"), () => {
    if (ready && mode !== "boot") setMode("archive");
  }, lane => {
    if (ready && !modal) select(columnMemory[lane]);
  });
  playground = new ArchivePlayground($("#stage"), () => scene,
    () => ({ enabled: !!workbench?.enabled && mode === "archive" && ready, paused: Boolean(modal) || modalClosing || Boolean(wallpaperHost()?.paused) || document.hidden, reduced: prefs.reduced }),
    value => { musicSuppressed = value; configureAudio(); }, () => audio.play("tick"));
  wallpaperEffects = new WallpaperEffects($("#stage"), () => scene);
  document.addEventListener("click", event => {
    const button = (event.target as Element).closest<HTMLElement>("[data-workbench-mode]");
    if (button) closeModal(() => { workbench!.setEnabled(button.dataset.workbenchMode === "workbench"); });
  });
}
skpHost.bind({ state: applySnapshot, presentation: applyPresentation, notice: notify, back: nativeBack,
  motion: (x,y) => { sensorTilt = {x,y}; },
});
document.addEventListener("visibilitychange", syncHostPause);
void start();
// Deterministic review controls: the running application, never a video surrogate.
Object.assign(window, {
  rhine: {
    // The review button supplies a real user activation. Preferences stay local to this preview.
    playBootPreview: async (music = false) => {
      if (!ready || !navigator.userActivation.isActive) return false;
      const request = ++audioPreviewRequest;
      audioPreview = true;
      audio.configure({ ...prefs, sound: true, music });
      const unlocked = await audio.unlock();
      if (request !== audioPreviewRequest) return false;
      if (!unlocked) {
        audioPreview = false;
        configureAudio();
        return false;
      }
      replayBoot(true);
      return true;
    },
    seek: (t: number) => {
      frozenTime = t;
      setMode("boot");
      bootStart = performance.now() / 1000 - t;
      lastStep = "";
    },
    resume: () => { const t = frozenTime; frozenTime = null; if (t !== null) bootStart = performance.now() / 1000 - t; },
    visualLab: () => setVisualLab(true),
    workspace: (section: SectionId) => navigateSection(section),
    workspaceState,
    workspaceQuad: () => scene ? [[-2.28,3.4],[2.28,3.4],[2.28,.18],[-2.28,.18]].map(([x,y])=>scene!.projectCard(x,y)) : null,
    browse: browseArray,
    snapshot: applySnapshot,
    presentation: applyPresentation,
    back: nativeBack,
    archive: () => setMode("archive"),
    detail: () => openFile(),
    select: (i: number) => select(i),
    stats: () => ({
      ...scene?.getStats(),
      threeState,
      fps: Math.round(fps),
      mode,
      ready,
      host: { connected: skpHost.connected, presentation: skpHost.presentation, visualLab },
      viewport: { width: innerWidth, height: innerHeight, canvasWidth: scene?.renderer.domElement.width, canvasHeight: scene?.renderer.domElement.height },
      startup: started ? "started" : entry?.phase ?? "loading",
      motion: { reduced: prefs.reduced, systemReduced: matchMedia("(prefers-reduced-motion: reduce)").matches },
      face: {plane:facePanel.element.dataset.plane, visibleFraction:Number(facePanel.element.dataset.visibleFraction ?? 1), backdrop:getComputedStyle(facePanel.element).backdropFilter},
      bootTime: mode === "boot" ? started ? (frozenTime ?? performance.now() / 1000 - bootStart) + 5 : 6.76 : null,
      selected: records[selected].id,
      saved: [...saved],
      audio: audio.stats(),
      wallpaper: isWallpaper ? wallpaperHost() : null,
    }),
  },
});
if (import.meta.hot) import.meta.hot.dispose(() => audio.dispose());
