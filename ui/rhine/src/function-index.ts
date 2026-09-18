import type { ArchiveRecord, ArchiveAction } from "./data";

export const sections = [
  { id: "home", label: "概览", lane: 0, root: "home.summary" },
  { id: "authorization", label: "授权", lane: 1, root: "authorization:manager" },
  { id: "modules", label: "模块", lane: 2, root: "modules:manager" },
  { id: "market", label: "市场", lane: 3, root: "market:catalog" },
  { id: "settings", label: "设置", lane: 4, root: "settings:controls" },
] as const;
export type SectionId = typeof sections[number]["id"];
export type FunctionResult = { kind: "action" | "record"; record: ArchiveRecord; action?: ArchiveAction; index: number; score: number };
const aliases: Record<string, string> = {
  "root.config.open": "密钥 key 配置 root", "module.pick": "安装模块 zip 本地安装 临时运行",
  "authorization.picker.open": "添加授权 应用 su", "authorization.adb.add": "adb shell 授权",
  "reboot.options.open": "重启 reboot recovery fastboot", "log.open": "日志 log 日志导出",
  "command.input.open": "命令 shell terminal 控制台", "appearance.open": "外观 动画 声音 配乐 画质 主题",
};
export function functionResults(records: ArchiveRecord[], query: string, category: string, saved?: Set<string>): FunctionResult[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const matches = (text: string) => terms.every(term => text.toLocaleLowerCase().includes(term));
  const results: FunctionResult[] = [];
  const used = new Set<string>();
  records.forEach((record, index) => {
    if (category !== "全部档案" && record.category !== category || saved && !saved.has(record.id)) return;
    const base = `${record.title} ${record.en} ${record.id} ${record.category} ${record.lead}`;
    if (matches(`${base} ${record.abstract} ${(record.fields ?? []).map(f=>`${f.label} ${f.value}`).join(" ")}`)) {
      results.push({kind:"record",record,index,score: terms.length && record.title.toLowerCase() === query.toLowerCase() ? 0 : 2});
    }
    for (const action of record.actions ?? []) {
      if (!matches(`${base} ${action.label} ${(action.keywords ?? []).join(" ")} ${aliases[action.action] ?? ""}`)) continue;
      const identity = `${action.action}:${JSON.stringify(action.payload ?? {})}`;
      if (used.has(identity)) continue;
      used.add(identity);
      results.push({kind:"action",record,action,index,score:terms.length && matches(`${action.label} ${(action.keywords??[]).join(" ")} ${aliases[action.action]??""}`) ? 0 : 3});
    }
  });
  return results.sort((a,b)=>a.score-b.score);
}
