import { records, type ArchiveAction, type ArchiveRecord } from "./data";
import { escapeHtml } from "./html";
import { hudQuadMatrix, type HudPoint } from "./hud-projection";
import "./folder-face-panel.css";
import { WORKING_HEIGHT, FACE_WIDTH, FACE_HEIGHT } from "./spatial-motion";
import type { FolderDepthSample } from "./folder-depth-mask";

export type FolderSection = "home" | "authorization" | "modules" | "market" | "settings";
export interface FolderFaceState {
  section: FolderSection;
  recordId: string;
  root: boolean;
  queries: Partial<Record<FolderSection, string>>;
  scroll: Record<string, number>;
}
export interface FolderFaceCallbacks {
  select(index: number): void;
  action(recordId: string, actionId: string): void;
  section(section: FolderSection): void;
  appearance(): void;
  browse(): void;
  back(): void;
  bookmark(recordId: string): void;
  changed?(): void;
}

type PresentationAction = ArchiveAction & {
  controlLabel?: string;
};
type PresentationRecord = ArchiveRecord & {
  section?: FolderSection;
  kind?: string;
  isRoot?: boolean;
  fields?: { label: string; value: string; key?: string; healthy?: boolean }[];
  status?: { label: string; tone?: string; value?: string };
  loading?: boolean;
  error?: string;
  displayCode?: string;
  keywords?: string[];
};
const sections: Record<FolderSection, { label: string; category: string; rootId: string }> = {
  home: { label: "概览", category: "系统概览", rootId: "home.summary" },
  authorization: { label: "授权", category: "授权", rootId: "authorization:manager" },
  modules: { label: "模块", category: "已安装模块", rootId: "modules:manager" },
  market: { label: "市场", category: "模块市场", rootId: "market:catalog" },
  settings: { label: "设置", category: "设置与诊断", rootId: "settings:controls" },
};
const isSection = (value: string): value is FolderSection => Object.hasOwn(sections, value);
const h = (value: unknown) => escapeHtml(String(value ?? ""));
const actions = (record: PresentationRecord) => (record.actions ?? []) as PresentationAction[];
const idOf = (action: PresentationAction, index: number) => action.id ?? String(index);
const disabled = (action: PresentationAction) => action.disabled || action.enabled === false;

/** DOM content remains on the model's physical front plane throughout its motion. */
export class FolderFacePanel {
  readonly element: HTMLElement;
  private header: HTMLElement;
  private scroller: HTMLElement;
  private footer: HTMLElement;
  private queryRow: HTMLElement;
  private query: HTMLInputElement;
  private body: HTMLElement;
  private state: FolderFaceState = { section: "home", recordId: "home.summary", root: true, queries: {}, scroll: {} };
  private shown = false;
  private progress = 0;
  private target = 0;
  private reduced = false;
  private lastTime = 0;
  private anchored?: HudPoint[];
  private onModel = false;
  private heightScale = WORKING_HEIGHT;
  private resize: ResizeObserver;
  private renderSignature = "";
  private frameWidth = 0;
  private frameHeight = 0;
  private surfaceMatrix: number[] = [];
  private layerBoxes: { node:HTMLElement; x:number; y:number; width:number; height:number; depth:number }[] = [];
  private layerLayoutDirty = true;
  private compactActions = false;
  private restoring = false;
  private externallyInert = false;
  private maskCanvas = document.createElement("canvas");
  private maskPixels?: Uint8ClampedArray;
  private maskWidth = 256;
  private maskHeight = 181;
  private lastMaskTime = -1;
  private maskHash = -1;
  private maskPending = false;
  private maskEpoch = 0;
  private maskUrl?: string;
  private maskSource?: object;
  private forwarded = new Set<number>();

  constructor(private viewport: HTMLElement, private callbacks: FolderFaceCallbacks) {
    this.element = document.createElement("section");
    this.element.className = "folder-face-panel";
    this.element.setAttribute("aria-label", "档案工作区");
    this.element.hidden = true;
    this.element.innerHTML = `<div class="ff-edge" aria-hidden="true"></div><header class="ff-header"></header>
      <div class="ff-query" hidden><label><span class="ff-search-mark" aria-hidden="true"></span><input type="search" autocomplete="off" enterkeyhint="search" aria-label="搜索当前列表" placeholder="搜索名称或标识"></label><span class="ff-count"></span></div>
      <div class="ff-downloads" aria-live="polite"></div><div class="ff-scroll" tabindex="0"><div class="ff-body"></div></div><footer class="ff-footer"></footer>`;
    this.header = this.element.querySelector(".ff-header")!;
    this.scroller = this.element.querySelector(".ff-scroll")!;
    this.footer = this.element.querySelector(".ff-footer")!;
    this.queryRow = this.element.querySelector(".ff-query")!;
    this.query = this.element.querySelector("input")!;
    this.body = this.element.querySelector(".ff-body")!;
    viewport.append(this.element);
    for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel"] as const) {
      this.element.addEventListener(type, event => {
        const covered = type === "pointerdown" && !this.pointVisible(event.clientX,event.clientY);
        if (!covered && !this.forwarded.has(event.pointerId)) return;
        event.preventDefault();event.stopImmediatePropagation();
        if(type === "pointerdown") this.forwarded.add(event.pointerId);
        const canvas = this.viewport.querySelector<HTMLCanvasElement>("#three-scene canvas");
        canvas?.dispatchEvent(new PointerEvent(type,{pointerId:event.pointerId,pointerType:event.pointerType,clientX:event.clientX,clientY:event.clientY,button:event.button,buttons:event.buttons,bubbles:true}));
        if(type === "pointerup"||type === "pointercancel")this.forwarded.delete(event.pointerId);
      },true);
    }
    this.element.addEventListener("click",event=>{if(!this.pointVisible(event.clientX,event.clientY)&&event.detail){event.preventDefault();event.stopImmediatePropagation();}},true);
    this.element.addEventListener("click", event => this.click(event));
    for (const event of ["pointerdown", "pointerup", "pointermove", "wheel"]) {
      this.element.addEventListener(event, e => e.stopPropagation(), { passive: true });
    }
    this.scroller.addEventListener("scroll", () => {
      if (this.restoring) return;
      this.state.scroll[this.locationKey()] = this.scroller.scrollTop;
      this.callbacks.changed?.();
    }, { passive: true });
    this.query.addEventListener("input", () => {
      this.state.queries[this.state.section] = this.query.value;
      this.state.scroll[this.locationKey()] = 0;
      this.renderSignature = "";
      this.refresh();
      this.scroller.scrollTop = 0;
      this.callbacks.changed?.();
    });
    this.resize = new ResizeObserver(() => { this.frameWidth = 0; this.paint(); });
    this.resize.observe(viewport);
  }

  get isActive() { return this.shown; }
  get active() { return this.shown; }
  get currentSection() { return this.state.section; }
  get currentRecordId() { return this.state.recordId; }
  get isRoot() { return this.state.root; }
  setInert(value: boolean) { this.externallyInert = value; this.element.inert = value || !this.shown; }
  getState(): FolderFaceState {
    return { ...this.state, queries: { ...this.state.queries }, scroll: { ...this.state.scroll } };
  }
  restoreState(value: Partial<FolderFaceState>) {
    if (value.section && isSection(value.section)) this.state.section = value.section;
    if (typeof value.recordId === "string") this.state.recordId = value.recordId;
    if (typeof value.root === "boolean") this.state.root = value.root;
    if (value.queries) for (const key of Object.keys(sections) as FolderSection[]) {
      if (typeof value.queries[key] === "string") this.state.queries[key] = value.queries[key]!.slice(0, 500);
    }
    if (value.scroll) for (const [key, offset] of Object.entries(value.scroll)) {
      if (Number.isFinite(offset) && offset >= 0) this.state.scroll[key] = offset;
    }
    this.renderSignature = "";
    if (this.shown) this.refresh();
  }
  show(recordId: string, section: string, root: boolean, reduced: boolean) {
    if (this.shown && this.state.recordId === recordId && this.state.section === section && this.state.root === root) {
      this.reduced = reduced;
      this.element.dataset.reduced = String(reduced);
      this.refresh();
      return;
    }
    this.saveScroll();
    this.maskEpoch++;
    this.maskHash=-1;
    if(this.onModel){this.element.style.maskImage="linear-gradient(transparent,transparent)";this.maskPixels=new Uint8ClampedArray(this.maskWidth*this.maskHeight*4);this.element.dataset.visibleFraction="0";}
    this.state.section = isSection(section) ? section : "home";
    this.state.recordId = recordId;
    this.state.root = root;
    this.reduced = reduced;
    this.target = 1;
    if (!this.shown) this.progress = reduced ? 1 : 0;
    this.shown = true;
    this.element.hidden = false;
    this.element.inert = this.externallyInert;
    this.element.dataset.section = this.state.section;
    this.element.dataset.root = String(root);
    this.element.dataset.reduced = String(reduced);
    this.lastTime = performance.now();
    this.renderSignature = "";
    this.refresh();
    this.paint();
  }
  hide(reduced = this.reduced) {
    if (!this.shown && this.target === 0) {
      if (reduced) { this.progress = 0; this.element.hidden = true; }
      return;
    }
    this.saveScroll();
    this.shown = false;
    this.target = 0;
    this.reduced = reduced;
    this.element.inert = true;
    this.lastTime = performance.now();
    if (reduced) { this.progress = 0; this.element.hidden = true; }
  }
  private locationKey() { return `${this.state.section}:${this.state.root ? "root" : this.state.recordId}`; }
  private saveScroll() {
    if (this.shown) this.state.scroll[this.locationKey()] = this.scroller.scrollTop;
  }
  private sectionRecords() {
    return (records as PresentationRecord[]).filter(r => r.section === this.state.section || (!r.section && r.category === sections[this.state.section].category));
  }
  private rootRecord(): PresentationRecord | undefined {
    const items = this.sectionRecords();
    return items.find(r => r.isRoot || r.id === sections[this.state.section].rootId) ?? items[0];
  }
  private isBookmarked(id: string) {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem("rhine-saved") ?? "[]");
      return Array.isArray(saved) && saved.includes(id);
    } catch { return false; }
  }

  refresh() {
    if (!this.shown) return;
    this.layerLayoutDirty=true;
    const downloads = (records as PresentationRecord[]).filter(r=>r.kind === "download");
    this.element.querySelector(".ff-downloads")!.innerHTML = downloads.map(record=>`<div class="ff-download"><div class="ff-section-heading"><strong>${h(record.title)}</strong>${actions(record).map(a=>this.actionButton(record,a,"inline")).join("")}</div><progress max="1" ${typeof record.progress === "number" ? `value="${record.progress}"` : ""}></progress></div>`).join("");
    const all = this.sectionRecords();
    let record = this.state.root ? this.rootRecord() : all.find(r => r.id === this.state.recordId);
    const removed = !record && !this.state.root;
    if (removed) { this.state.root = true; record = this.rootRecord(); }
    if (!record) {
      this.header.innerHTML = `<h2>${sections[this.state.section].label}</h2>`;
      this.body.innerHTML = `<div class="ff-empty" role="status">正在读取设备状态…</div>`;
      this.footer.innerHTML = "";
      return;
    }
    if (this.state.root) this.state.recordId = record.id;
    const bookmarked = this.isBookmarked(record.id);
    const signature = JSON.stringify([all, this.state.recordId, this.state.root, this.state.queries[this.state.section], bookmarked, this.compactActions, document.documentElement.dataset.largeWorkspaceText]);
    if (signature === this.renderSignature) return;
    this.renderSignature = signature;
    const scroll = this.state.scroll[this.locationKey()] ?? 0;
    const focused = document.activeElement instanceof HTMLElement && this.element.contains(document.activeElement)
      ? document.activeElement.dataset.focusKey : undefined;
    const root = this.state.root;
    const title = root ? sections[this.state.section].label : record.title;
    const status = record.status;
    this.element.dataset.root = String(root);
    this.header.innerHTML = `<div class="ff-heading"><span class="ff-code">${h(record.displayCode ?? `SKP / ${String(record.code ?? 1).padStart(3, "0")}`)}</span>
      <div class="ff-title-row">${!root ? `<button class="ff-icon ff-back" data-command="back" title="返回${sections[this.state.section].label}" aria-label="返回${sections[this.state.section].label}"><span aria-hidden="true">←</span></button>` : ""}
      <h2>${h(title)}</h2><span class="ff-header-tools">${!root ? `<button class="ff-icon" data-command="bookmark" title="${bookmarked ? "移出常用" : "加入常用"}" aria-label="${bookmarked ? "移出常用" : "加入常用"}" aria-pressed="${bookmarked}"><span aria-hidden="true">${bookmarked ? "★" : "☆"}</span></button>` : ""}
      <button class="ff-icon ff-browse" data-command="browse" title="浏览阵列" aria-label="浏览阵列"><span class="ff-array-mark" aria-hidden="true"></span></button></span></div>
      <div class="ff-subtitle">${status ? `<span class="ff-status" data-tone="${h(status.tone ?? "neutral")}"><i aria-hidden="true"></i>${h(status.label)}</span>` : ""}<span>${h(root ? record.abstract : record.en)}</span></div></div>`;
    const list = root && ["authorization", "modules", "market"].includes(this.state.section);
    this.queryRow.hidden = !list;
    if (this.query.value !== (this.state.queries[this.state.section] ?? "")) this.query.value = this.state.queries[this.state.section] ?? "";
    this.query.placeholder = this.state.section === "authorization" ? "搜索应用名称或包名" : "搜索模块名称或 ID";
    const notice = removed ? `<div class="ff-notice" role="status">该项目已移除，已返回列表。</div>` : "";
    const feedback = record.error ? `<div class="ff-notice ff-error" role="alert">${h(record.error)}</div>` : record.loading ? `<div class="ff-notice ff-loading" role="status">正在读取…</div>` : "";
    if (list) this.body.innerHTML = notice + feedback + this.list(all, record);
    else if (root && this.state.section === "settings") this.body.innerHTML = notice + feedback + this.settings(all);
    else if (root && this.state.section === "home") this.body.innerHTML = notice + feedback + this.home(all, record);
    else this.body.innerHTML = notice + feedback + this.detail(record);
    this.footer.innerHTML = this.actionBar(record);
    this.footer.hidden = !this.footer.innerHTML;
    this.layerLayoutDirty = true;
    this.restoring = true;
    this.scroller.scrollTop = scroll;
    this.restoring = false;
    if (focused) this.element.querySelector<HTMLElement>(`[data-focus-key="${CSS.escape(focused)}"]`)?.focus({ preventScroll: true });
  }

  private fields(record: PresentationRecord): string {
    if(record.fields?.some(field=>typeof field.healthy === "boolean")) return `<dl class="ff-health-list">${record.fields.map(field=>`<div data-health="${field.healthy===true?'normal':'warning'}"><dt>${h(field.label)}</dt><dd>${h(field.value)}</dd><span class="ff-health-icon" role="img" aria-label="${field.healthy===true?'正常':'注意'}">${field.healthy===true?'✓':'!'}</span></div>`).join("")}</dl>`;
    if (record.fields?.length) return `<dl class="ff-fields">${record.fields.map(field => `<div><dt>${h(field.label)}</dt><dd>${h(field.value)}</dd></div>`).join("")}</dl>`;
    return record.findings.length ? `<ul class="ff-findings">${record.findings.map(value => `<li>${h(value)}</li>`).join("")}</ul>` : "";
  }
  private home(all: PresentationRecord[], record: PresentationRecord) {
    return `<section class="ff-information"><h3>环境信息</h3>${this.fields(record)}</section>` + all.filter(r => r.id !== record.id && !r.empty).map(r =>
      `<section class="ff-information"><div class="ff-section-heading"><h3>${h(r.title)}</h3><button class="ff-icon" data-record="${h(r.id)}" title="查看${h(r.title)}" aria-label="查看${h(r.title)}"><span aria-hidden="true">→</span></button></div>${this.fields(r)}</section>`).join("");
  }
  private list(all: PresentationRecord[], root: PresentationRecord) {
    const query = (this.state.queries[this.state.section] ?? "").trim().toLocaleLowerCase();
    const items = all.filter(r => r.id !== root.id && !r.empty && r.kind !== "download");
    const filtered = items.filter(r => [r.title, r.en, r.abstract, r.lead, r.id, ...(r.keywords ?? []), ...(r.fields ?? []).map(f => f.value)].join(" ").toLocaleLowerCase().includes(query));
    this.queryRow.querySelector(".ff-count")!.textContent = query ? `${filtered.length} / ${items.length}` : `${items.length} 项`;
    const downloads = filtered.filter(r => r.kind === "download" || r.id === "market:download");
    const normal = filtered.filter(r => !downloads.includes(r));
    const content = downloads.map(r => this.download(r)).join("") + normal.map(r => this.listItem(r)).join("");
    if (content) return `<div class="ff-list">${content}</div>`;
    const empty = query ? "没有匹配的项目" : this.state.section === "authorization" ? "暂无已授权应用" : this.state.section === "modules" ? "尚未安装模块" : "暂无市场模块";
    return `<div class="ff-empty" role="status"><span class="ff-empty-mark" aria-hidden="true"></span><strong>${empty}</strong>${query ? `<button class="ff-text-action" data-command="clear-query">清除搜索</button>` : ""}</div>`;
  }
  private listItem(record: PresentationRecord) {
    const candidates = actions(record);
    const quickAction = candidates.find(a => a.action === "module.webui.open") ?? candidates.find(a => a.action === "market.install.request" || a.action === "authorization.remove.request");
    const status = record.status;
    return `<article class="ff-item"><button class="ff-item-open" data-record="${h(record.id)}" data-focus-key="record:${h(record.id)}"><span class="ff-item-heading"><strong>${h(record.title)}</strong>${status ? `<span class="ff-item-status" data-tone="${h(status.tone ?? "neutral")}">${h(status.label)}</span>` : ""}</span><span class="ff-item-id">${h(record.en)}</span>${record.abstract ? `<span class="ff-item-description">${h(record.abstract)}</span>` : ""}</button>${quickAction ? this.actionButton(record, quickAction, "inline") : `<button class="ff-icon" data-record="${h(record.id)}" aria-label="查看${h(record.title)}" title="查看详情"><span aria-hidden="true">→</span></button>`}</article>`;
  }
  private download(record: PresentationRecord) {
    const progress = record.progress;
    return `<section class="ff-download" aria-label="下载进度"><div class="ff-section-heading"><strong>${h(record.title)}</strong>${actions(record).filter(a => a.action === "download.cancel").map(a => this.actionButton(record, a, "inline")).join("")}</div><progress max="1" ${typeof progress === "number" ? `value="${Math.max(0, Math.min(1, progress))}"` : ""}></progress>${this.fields(record)}</section>`;
  }
  private settings(all: PresentationRecord[]) {
    return all.filter(r => !r.empty).map(record => {
      const recordActions = actions(record);
      return `<section class="ff-settings-group"><h3>${h(record.title)}</h3>${recordActions.map(action => {
        if (action.action === "settings.toggle") {
          const checked = typeof action.checked === "boolean" ? action.checked : action.payload?.enabled === false;
          const key = String(action.payload?.key ?? action.id ?? "");
          const label = action.controlLabel ?? ({ bootFailProtect: "启动保护", adbForcedDisabled: "强制关闭 ADB", logEnabled: "日志记录" } as Record<string, string>)[key] ?? action.label;
          return `<div class="ff-setting-row"><span>${h(label)}</span><button class="ff-switch" type="button" role="switch" aria-label="${h(label)}" aria-checked="${checked}" data-action="${h(idOf(action, recordActions.indexOf(action)))}" data-owner="${h(record.id)}" data-focus-key="${h(record.id)}:${h(idOf(action, recordActions.indexOf(action)))}" ${disabled(action) ? "disabled" : ""}><span></span></button></div>`;
        }
        if (action.action === "refresh") return "";
        return this.actionButton(record, action, "setting");
      }).join("")}${record.id === "settings:about" ? this.fields(record) : ""}</section>`;
    }).join("");
  }
  private detail(record: PresentationRecord) {
    if (record.kind === "download" || record.id === "market:download") return this.download(record);
    return `${record.abstract ? `<p class="ff-description">${h(record.abstract)}</p>` : ""}${this.fields(record)}`;
  }
  private actionButton(record: PresentationRecord, action: PresentationAction, style: string) {
    const actionId = idOf(action, actions(record).indexOf(action));
    const unavailable = disabled(action);
    return `<button class="ff-action ff-action-${style}${action.destructive ? " ff-destructive" : ""}" type="button" data-action="${h(actionId)}" data-owner="${h(record.id)}" data-focus-key="${h(record.id)}:${h(actionId)}" ${unavailable ? "disabled" : ""} ${action.disabledReason ? `title="${h(action.disabledReason)}"` : ""}><span>${h(action.label)}</span>${style === "setting" ? `<span class="ff-chevron" aria-hidden="true">→</span>` : ""}</button>`;
  }
  private actionBar(record: PresentationRecord) {
    const available = actions(record).filter(a => a.action !== "settings.toggle");
    if (!available.length) return "";
    const primary = available.find(a => a.placement === "primary") ?? available.find(a => !a.destructive && a.placement !== "overflow") ?? available[0];
    const secondary = this.compactActions || document.documentElement.dataset.largeWorkspaceText === "true" ? [] : available.filter(a => a !== primary && a.placement === "secondary").slice(0, 2);
    const more = available.filter(a => a !== primary && !secondary.includes(a));
    const reason = disabled(primary) && primary.disabledReason ? `<div class="ff-disabled-reason">${h(primary.disabledReason)}</div>` : "";
    return `${reason}<div class="ff-actionbar">${this.actionButton(record, primary, "primary")}${secondary.map(a => this.actionButton(record, a, "secondary")).join("")}${more.length ? `<details class="ff-more"><summary title="更多操作" aria-label="更多操作"><span aria-hidden="true">···</span></summary><div class="ff-more-menu">${more.map(a => this.actionButton(record, a, "menu")).join("")}</div></details>` : ""}</div>`;
  }
  private click(event: MouseEvent) {
    const target = (event.target as Element).closest<HTMLElement>("button,[data-command]");
    if (!target || target.matches(":disabled")) return;
    const command = target.dataset.command;
    if (command === "back") this.callbacks.back();
    else if (command === "browse") this.callbacks.browse();
    else if (command === "bookmark") this.callbacks.bookmark(this.state.recordId);
    else if (command === "clear-query") { this.query.value = ""; this.query.dispatchEvent(new Event("input")); this.query.focus(); }
    else if (target.dataset.record) {
      const index = records.findIndex(r => r.id === target.dataset.record);
      if (index >= 0) { this.saveScroll(); this.callbacks.select(index); }
    } else if (target.dataset.action && target.dataset.owner) {
      const owner = records.find(r => r.id === target.dataset.owner) as PresentationRecord | undefined;
      const action = owner && actions(owner).find((a, index) => idOf(a, index) === target.dataset.action);
      if (!owner || !action || disabled(action)) return;
      this.element.querySelector<HTMLDetailsElement>(".ff-more")?.removeAttribute("open");
      if (action.action === "appearance.open") this.callbacks.appearance();
      else this.callbacks.action(owner.id, target.dataset.action);
    }
  }

  update(scene: { projectCard(x: number, y: number,z?:number): number[]; workHeightScale?:number; deviceTilt?:{x:number;y:number}; folderMask?(): FolderDepthSample|Promise<FolderDepthSample> } | undefined, active = true, _dt?: number) {
    const now = performance.now();
    const elapsed = Math.min(100, Math.max(0, now - (this.lastTime || now)));
    this.lastTime = now;
    if ((!active && this.target !== 0) || this.element.hidden) return;
    this.onModel = Boolean(scene);
    if (scene) {
      this.heightScale = scene.workHeightScale ?? WORKING_HEIGHT;
      const stage = this.viewport.querySelector<HTMLElement>("#stage");
      const stageRect = stage?.getBoundingClientRect();
      const viewportRect = this.viewport.getBoundingClientRect();
      const scale = stage && stageRect ? stageRect.width / stage.offsetWidth : 1;
      const corners = [[-2.28, 3.4], [2.28, 3.4], [2.28, .18], [-2.28, .18]].map(([x, y]) => {
        const projected = scene.projectCard(x, y);
        return { x: projected[0] * scale + (stageRect?.left ?? viewportRect.left) - viewportRect.left,
          y: projected[1] * scale + (stageRect?.top ?? viewportRect.top) - viewportRect.top };
      });
      if (corners.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)) && Math.abs(corners[1].x - corners[0].x) > 1) this.anchored = corners;
      this.element.dataset.plane = "model-front";
      this.element.dataset.corners = JSON.stringify(corners);
      if(this.maskSource!==scene){this.maskSource=scene;this.maskEpoch++;this.maskHash=-1;}
      if (scene.folderMask && !this.maskPending && now-this.lastMaskTime>=32) {
        this.lastMaskTime=now;
        this.maskPending=true;
        const epoch=this.maskEpoch;
        Promise.resolve().then(()=>scene.folderMask!()).then(sample=>{
          if(epoch===this.maskEpoch&&this.onModel)return this.updateMask(sample,epoch);
        }).catch(()=>{
          if(epoch!==this.maskEpoch)return;
          this.element.style.maskImage="linear-gradient(transparent,transparent)";
          this.maskPixels=new Uint8ClampedArray(this.maskWidth*this.maskHeight*4);this.maskHash=-1;
        }).finally(()=>{this.maskPending=false;});
      }
    } else {
      if(this.maskSource){this.maskSource=undefined;this.maskEpoch++;}
      this.anchored = undefined;
      this.element.dataset.plane = "fallback";
      this.element.style.maskImage="none"; this.maskPixels=undefined; this.maskHash=-1;
      for (const node of [this.header, this.queryRow, this.scroller, this.footer]) {
        node.style.removeProperty("transform");
        node.style.removeProperty("transform-origin");
        delete node.dataset.depth;
      }
      this.element.style.setProperty("--control-float-x", "0px");
      this.element.style.setProperty("--control-float-y", "0px");
      this.layerLayoutDirty = true;
    }
    this.progress = this.reduced ? this.target : this.target > this.progress
      ? Math.min(this.target, this.progress + elapsed / 280) : this.target < this.progress
        ? Math.max(this.target, this.progress - elapsed / 180) : this.progress;
    this.paint();
    if(scene)this.paintLayers(scene);
    if (!this.shown && this.progress <= 0) this.element.hidden = true;
  }
  private async updateMask(sample:FolderDepthSample,epoch:number) {
    const {width,height,pixels,quad}=sample;
    const mw=this.maskWidth,mh=this.maskHeight;
    if(sample.solid){this.element.style.maskImage="none";this.maskPixels=undefined;this.maskHash=-1;this.element.dataset.visibleFraction="1";return;}
    const matrix=hudQuadMatrix(mw,mh,quad.map(([x,y])=>({x,y})));
    const output=new Uint8ClampedArray(mw*mh*4);
    let visible=0,hash=2166136261;
    for(let y=0;y<mh;y++)for(let x=0;x<mw;x++){
      const w=matrix[3]*(x+.5)+matrix[7]*(y+.5)+matrix[15];
      const sx=Math.floor((matrix[0]*(x+.5)+matrix[4]*(y+.5)+matrix[12])/w);
      const sy=Math.floor((matrix[1]*(x+.5)+matrix[5]*(y+.5)+matrix[13])/w);
      const alpha=sx>=0&&sx<width&&sy>=0&&sy<height ? pixels[((height-1-sy)*width+sx)*4] : 0;
      const i=(y*mw+x)*4;output[i]=output[i+1]=output[i+2]=255;output[i+3]=alpha;
      visible+=alpha/255;hash=Math.imul(hash^alpha,16777619);
    }
    if(hash===this.maskHash)return;
    this.maskHash=hash;
    if(visible===mw*mh){this.element.style.maskImage="none";this.maskPixels=undefined;this.element.dataset.visibleFraction="1";return;}
    this.maskCanvas.width=mw;this.maskCanvas.height=mh;
    this.maskCanvas.getContext("2d")!.putImageData(new ImageData(output,mw,mh),0,0);
    const blob=await new Promise<Blob|null>(resolve=>this.maskCanvas.toBlob(resolve,"image/png"));
    if(!blob)throw new Error("Visibility mask encoding failed");
    if(epoch!==this.maskEpoch)return;
    const url=URL.createObjectURL(blob),image=new Image();
    image.src=url;
    try{await image.decode();}catch(error){URL.revokeObjectURL(url);throw error;}
    if(epoch!==this.maskEpoch){URL.revokeObjectURL(url);return;}
    const previous=this.maskUrl;this.maskUrl=url;
    this.maskPixels=output;
    this.element.dataset.visibleFraction=String(visible/(mw*mh));
    this.element.style.maskImage=`url(${url})`;
    if(previous)URL.revokeObjectURL(previous);
    this.element.style.maskSize="100% 100%";
    this.element.style.maskRepeat="no-repeat";
  }
  private pointVisible(clientX:number,clientY:number) {
    if(!this.maskPixels)return true;
    const rect=this.viewport.getBoundingClientRect();
    const local=new DOMMatrix(getComputedStyle(this.element).transform).inverse().transformPoint({x:clientX-rect.left,y:clientY-rect.top});
    const x=Math.floor(local.x/local.w/this.frameWidth*this.maskWidth),y=Math.floor(local.y/local.w/this.frameHeight*this.maskHeight);
    return x>=0&&y>=0&&x<this.maskWidth&&y<this.maskHeight&&this.maskPixels[(y*this.maskWidth+x)*4+3]>127;
  }
  private paint() {
    if (this.element.hidden) return;
    const width = this.viewport.clientWidth, height = this.viewport.clientHeight;
    const wide = width >= 900;
    const x = wide ? Math.max(126, Math.min(width * .4, width - 560)) : 14;
    const y = height < 540 ? 60 : 96;
    // Stable local coordinates prevent text reflow while the model turns.
    const sideNavigation=width>=900||(width>=700&&height<540);
    const readableWidth=Math.max(180, Math.min(760,width-40,(height-(sideNavigation?112:184))*FACE_WIDTH/(4.3*WORKING_HEIGHT)));
    const w = this.onModel ? readableWidth : Math.max(220, width-x-14);
    const bottom = wide ? 28 : 88;
    const frameHeight = this.onModel ? w * FACE_HEIGHT * this.heightScale / FACE_WIDTH : Math.max(140, height-y-bottom);
    if (w !== this.frameWidth || frameHeight !== this.frameHeight) {
      this.frameWidth = w; this.frameHeight = frameHeight;
      this.element.style.width = `${w}px`; this.element.style.height = `${frameHeight}px`;
      this.layerLayoutDirty = true;
      const compact=w<290;
      if(compact!==this.compactActions){this.compactActions=compact;this.element.dataset.compact=String(compact);this.renderSignature="";this.refresh();}
    }
    const destination = [{ x, y }, { x: x + w, y }, { x: x + w, y: y + frameHeight }, { x, y: y + frameHeight }];
    const amount = 1 - Math.pow(1 - this.progress, 3);
    const quad = this.onModel && this.anchored ? this.anchored : destination;
    this.surfaceMatrix = hudQuadMatrix(w, frameHeight, quad);
    this.element.style.transform = `matrix3d(${this.surfaceMatrix.join(",")})`;
    this.element.style.opacity = String(this.progress === 0 && !this.shown ? 0 : amount);
    this.element.dataset.expanded = String(this.progress === 1);
  }
  private paintLayers(scene:{projectCard(x:number,y:number,z?:number):number[];deviceTilt?:{x:number;y:number}}) {
    if(!this.surfaceMatrix.length)return;
    if(this.layerLayoutDirty) {
      this.layerLayoutDirty=false;
      this.layerBoxes = [
        {node:this.header,depth:.32}, {node:this.queryRow,depth:.34},
        {node:this.scroller,depth:.285}, {node:this.footer,depth:.37},
      ].filter(layer=>!layer.node.hidden).map(layer=>({...layer,x:layer.node.offsetLeft,y:layer.node.offsetTop,width:layer.node.offsetWidth,height:layer.node.offsetHeight}));
    }
    const stage=this.viewport.querySelector<HTMLElement>('#stage')!;
    const stageRect=stage.getBoundingClientRect(),viewportRect=this.viewport.getBoundingClientRect();
    const scale=stageRect.width/stage.offsetWidth;
    const inverse=new DOMMatrix(this.surfaceMatrix).inverse();
    for(const layer of this.layerBoxes){
      if(!layer.width||!layer.height)continue;
      const corners=[[0,0],[layer.width,0],[layer.width,layer.height],[0,layer.height]].map(([x,y])=>{
        const u=(layer.x+x)/this.frameWidth, v=(layer.y+y)/this.frameHeight;
        const point=scene.projectCard(-2.28+u*FACE_WIDTH,3.4-v*FACE_HEIGHT,layer.depth);
        const local=inverse.transformPoint({x:point[0]*scale+stageRect.left-viewportRect.left,y:point[1]*scale+stageRect.top-viewportRect.top});
        return {x:local.x/local.w-layer.x,y:local.y/local.w-layer.y};
      });
      layer.node.style.transformOrigin='0 0';
      layer.node.style.transform=`matrix3d(${hudQuadMatrix(layer.width,layer.height,corners).join(',')})`;
      layer.node.dataset.depth=String(layer.depth);
    }
    const tilt=this.reduced?{x:0,y:0}:scene.deviceTilt??{x:0,y:0};
    this.element.style.setProperty('--control-float-x',`${tilt.x*1.8}px`);
    this.element.style.setProperty('--control-float-y',`${tilt.y*1.5}px`);
  }
  dispose() { this.maskEpoch++;if(this.maskUrl)URL.revokeObjectURL(this.maskUrl);this.resize.disconnect(); this.element.remove(); }
}
