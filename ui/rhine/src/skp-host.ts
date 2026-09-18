import type { ArchiveRecord } from "./data";

export const isAndroid = import.meta.env.MODE === "android" || new URLSearchParams(location.search).get("host") === "android";
export interface UiSnapshot { records: ArchiveRecord[]; configured?: boolean; statusText?: string; busy?: boolean; }
export interface Presentation { active: boolean; audioActive?: boolean; reducedMotion: boolean; bootAllowed: boolean; initialBootTime?: number; initialBootCompleted?: boolean; workspace?: unknown; textScale?: number; }
type HostMessage =
  | { type: "motion"; version: number; x: number; y: number }
  | { type: "state"; revision: number; state: UiSnapshot }
  | ({ type: "presentation" } & Partial<Presentation>)
  | { type: "notice"; text: string }
  | { type: "ack"; requestId: string; status: string; reason?: string }
  | { type: "back" };
export interface HostCallbacks {
  motion?(x:number,y:number):void;
  state(snapshot: UiSnapshot): void;
  presentation(value: Presentation): void;
  notice(text: string): void;
  back(): void;
}
/** Dedicated, origin-bound MessagePort. Reloads never replay action requests. */
export class SkpHost {
  private port?: MessagePort;
  private session = "";
  private sequence = 0;
  private revision = -1;
  private callbacks?: HostCallbacks;
  private snapshot?: UiSnapshot;
  private pending = new Map<string, { action: string; sent: number }>();
  presentation: Presentation = { active: true, reducedMotion: false, bootAllowed: !isAndroid };
  get connected() { return Boolean(this.port && this.session); }
  get sessionId() { return this.session; }
  constructor() {
    window.addEventListener("message", event => {
      // Android postWebMessage targets this exact origin, but its native sender
      // has no browsing-context origin (empty origin and null source in WebView).
      const nativeSender = isAndroid && event.origin === "" && event.source === null;
      if ((!nativeSender && event.origin !== location.origin) || event.ports.length !== 1) return;
      let payload: { type?: string; version?: number; sessionId?: string };
      try { payload = typeof event.data === "string" ? JSON.parse(event.data) : event.data; } catch { return; }
      if (!payload || payload.type !== "skp:init" || payload.version !== 1 || typeof payload.sessionId !== "string") return;
      this.port?.close(); this.port = event.ports[0]; this.session = payload.sessionId;
      this.sequence = 0; this.revision = -1; this.pending.clear();
      this.port.onmessage = message => this.receive(message.data); this.port.start();
      this.event("ready");
    });
  }
  bind(callbacks: HostCallbacks) {
    this.callbacks = callbacks;
    if (this.snapshot) callbacks.state(this.snapshot);
    callbacks.presentation(this.presentation);
  }
  private receive(raw: unknown) {
    let message: HostMessage;
    try { message = typeof raw === "string" ? JSON.parse(raw) : raw as HostMessage; } catch { return; }
    if (!message || typeof message !== "object" || !this.connected) return;
    if (message.type === "state" && message.revision > this.revision) {
      this.revision = message.revision; this.snapshot = message.state; this.callbacks?.state(message.state);
    } else if (message.type === "presentation") {
      this.presentation = { ...this.presentation, ...message }; this.callbacks?.presentation(this.presentation);
    } else if (message.type === "motion" && message.version === 1) {
      const clamp=(n:number)=>Number.isFinite(n)?Math.max(-1,Math.min(1,n)):0;
      this.callbacks?.motion?.(clamp(message.x),clamp(message.y));
    } else if (message.type === "notice") this.callbacks?.notice(String(message.text));
    else if (message.type === "back") this.callbacks?.back();
    else if (message.type === "ack") {
      this.pending.delete(message.requestId);
      if (message.status === "rejected") this.callbacks?.notice(message.reason || "操作未执行");
    }
  }
  request(action: string, payload: Record<string, unknown> = {}): string | undefined {
    if (!this.connected) { this.callbacks?.notice("尚未连接 Android 管理器"); return; }
    const now = performance.now(), identity = `${action}:${JSON.stringify(payload)}`;
    if ([...this.pending.values()].some(p => p.action === identity && now - p.sent < 1000)) return;
    const requestId = `${this.session}:${++this.sequence}`;
    this.pending.set(requestId, { action: identity, sent: now });
    for (const [id, pending] of this.pending) if (now - pending.sent > 30000) this.pending.delete(id);
    this.port!.postMessage(JSON.stringify({ version: 1, sessionId: this.session, requestId, action, payload }));
    return requestId;
  }
  event(type: string, payload: Record<string, unknown> = {}) {
    if (this.connected) this.port!.postMessage(JSON.stringify({ type, version: 1, sessionId: this.session, ...payload }));
  }
}
export const skpHost = new SkpHost();
