import { escapeHtml } from "./html";

export type ManagerUiMode = "rhine" | "legacy";
export interface UiModeSnapshot {
  uiMode?: ManagerUiMode;
  uiModeSwitchAllowed?: boolean;
  uiModeSwitchReason?: string;
}
export interface UiModeState {
  mode: ManagerUiMode;
  allowed: boolean;
  pending: boolean;
  reason: string;
}

/** Native settings own the preference; a click never changes the selected mode. */
export class UiModeController {
  private snapshot: UiModeSnapshot = {};
  private pending?: { requestId: string; mode: ManagerUiMode };
  private rejection = "";
  private send: (action: string, payload: { mode: ManagerUiMode }) => string | undefined;
  private changed: () => void;

  constructor(send: (action: string, payload: { mode: ManagerUiMode }) => string | undefined, changed: () => void) {
    this.send = send;
    this.changed = changed;
  }

  get state(): UiModeState {
    const supported = this.snapshot.uiMode === "rhine" || this.snapshot.uiMode === "legacy";
    return {
      mode: this.snapshot.uiMode === "legacy" ? "legacy" : "rhine",
      allowed: supported && this.snapshot.uiModeSwitchAllowed !== false && !this.pending,
      pending: Boolean(this.pending),
      reason: this.pending ? "正在切换界面…" : this.rejection || this.snapshot.uiModeSwitchReason || (supported ? "" : "正在读取界面设置…"),
    };
  }

  update(snapshot: UiModeSnapshot) {
    this.snapshot = snapshot;
    this.rejection = "";
    if (this.pending?.mode === snapshot.uiMode) this.pending = undefined;
    this.changed();
  }

  select(value: string | undefined) {
    if ((value !== "rhine" && value !== "legacy") || !this.state.allowed || this.state.mode === value) return;
    const requestId = this.send("ui.mode.set", { mode: value });
    if (!requestId) return;
    this.pending = { requestId, mode: value };
    this.rejection = "";
    this.changed();
  }

  acknowledge(requestId: string, status: string, reason?: string) {
    if (this.pending?.requestId !== requestId || status !== "rejected") return;
    this.pending = undefined;
    this.rejection = reason || "界面未切换，请重试";
    this.changed();
  }
}

export function uiModeMarkup(state: UiModeState): string {
  return `<section class="ui-mode-settings" aria-label="界面模式" aria-busy="${state.pending}"><h3>界面模式</h3><div class="ui-mode-options" role="group" aria-label="界面模式">${([
    ["rhine", "新版", "RhineLabUI"], ["legacy", "旧版", "SKRoot Pro Compose"],
  ] as const).map(([mode, title, name]) => `<button type="button" data-ui-mode="${mode}" data-focus-key="ui-mode:${mode}" aria-pressed="${state.mode === mode}" ${state.allowed ? "" : "disabled"}><strong>${title}</strong><span>${name}</span></button>`).join("")}</div><p class="ui-mode-reason" role="status" ${state.reason ? "" : "hidden"}>${escapeHtml(state.reason)}</p></section>`;
}

export function syncUiModeControls(root: ParentNode, state: UiModeState) {
  root.querySelectorAll<HTMLElement>(".ui-mode-settings").forEach(group => {
    group.setAttribute("aria-busy", String(state.pending));
    group.querySelectorAll<HTMLButtonElement>("[data-ui-mode]").forEach(button => {
      button.disabled = !state.allowed;
      button.setAttribute("aria-pressed", String(button.dataset.uiMode === state.mode));
    });
    const reason = group.querySelector<HTMLElement>(".ui-mode-reason");
    if (reason) { reason.hidden = !state.reason; reason.textContent = state.reason; }
  });
}
