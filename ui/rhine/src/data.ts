/** Live Android presentation records; privileged inputs stay in Native. */
export interface ArchiveAction {
  id?: string;
  placement?: "primary" | "secondary" | "overflow";
  primary?: boolean;
  keywords?: string[];
  disabledReason?: string;
  control?: string;
  checked?: boolean;
  controlLabel?: string;
  action: string;
  label: string;
  payload?: Record<string, unknown>;
  disabled?: boolean;
  enabled?: boolean;
  destructive?: boolean;
}

export interface ArchiveRecord {
  section?: string;
  kind?: string;
  isRoot?: boolean;
  status?: { code: string; label: string; tone: string };
  fields?: { key: string; label: string; value: string; healthy?: boolean }[];
  loading?: boolean;
  empty?: boolean;
  error?: string | null;
  count?: number;
  id: string;
  code?: number;
  title: string;
  en: string;
  department: string;
  category: string;
  date: string;
  lead: string;
  clearance: string;
  abstract: string;
  findings: string[];
  source: string;
  actions?: ArchiveAction[];
  progress?: number;
}

export const archiveColumns = ["系统概览", "授权", "已安装模块", "模块市场", "设置与诊断"];
export const categories = ["全部档案", ...archiveColumns];
export const records: ArchiveRecord[] = archiveColumns.map((category, lane) => ({
  id: `empty:${lane}`, code: lane + 1, title: category, en: ["SYSTEM OVERVIEW", "AUTHORIZATION", "INSTALLED MODULES", "MODULE MARKET", "SETTINGS & DIAGNOSTICS"][lane],
  department: "SKRoot Pro", category, date: "LIVE STATE", lead: "SKP SESSION", clearance: "CONNECTING",
  abstract: "正在读取设备状态…", findings: [], source: "", empty: true,
}));

/** Keep array identity: the reference scene imports this mutable presentation. */
export function replaceRecords(incoming: ArchiveRecord[]): void {
  const clean = incoming.filter(r => r && typeof r.id === "string" && archiveColumns.includes(r.category));
  const seen = new Set<string>();
  const next: ArchiveRecord[] = clean.filter(r => !seen.has(r.id) && !!seen.add(r.id)).map((r, i) => ({
    ...r, code: Number.isFinite(r.code) ? r.code : i + 1,
    title: String(r.title ?? ""), en: String(r.en ?? "SKROOT PRO"), department: String(r.department ?? "SKRoot Pro"),
    date: String(r.date ?? "LIVE STATE"), lead: String(r.lead ?? "SKP SESSION"), clearance: String(r.clearance ?? ""),
    abstract: String(r.abstract ?? ""), source: "", findings: Array.isArray(r.findings) ? r.findings.map(String) : [],
    actions: Array.isArray(r.actions) ? r.actions.filter(a => typeof a?.action === "string" && typeof a.label === "string") : [],
  }));
  for (let lane = 0; lane < archiveColumns.length; lane++) {
    const category = archiveColumns[lane];
    if (!next.some(r => r.category === category)) next.push({
      id: `empty:${lane}`, code: 900 + lane, title: "暂无项目", en: "NO ITEMS", category,
      department: "SKRoot Pro", date: "LIVE STATE", lead: "SKP SESSION", clearance: "EMPTY",
      abstract: `${category}当前没有可显示的项目。`, findings: [], source: "", actions: [], empty: true,
    });
  }
  records.splice(0, records.length, ...next);
}
export function recordNumber(index: number): number { return records[index]?.code ?? index + 1; }

export function columnFiles(lane: number) {
  return records
    .map((record, index) => ({ record, index }))
    .filter(({ record }) => record.category === archiveColumns[lane])
    .map(({ index }) => index);
}
export function fileLocation(index: number) {
  const lane = Math.max(0, archiveColumns.indexOf(records[index]?.category));
  const row = 12 + Math.max(0, columnFiles(lane).indexOf(index));
  return { lane, row, slot: lane * 32 + row };
}
export function fileAtSlot(slot: number) {
  const files = columnFiles(Math.floor(slot / 32));
  return files[Math.max(0, Math.min(files.length - 1, (slot % 32) - 12))];
}
