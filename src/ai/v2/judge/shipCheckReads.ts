// 출하 검사가 같이 쓰는 읽기 — 출하 차단 한 건의 모양(ShipBlocker)과 이벤트 쪽·명령 걷기.
import type { Project } from "@/project/types";

export type Obj = Record<string, unknown>;

export interface ShipBlocker { readonly id: string; readonly message: string; readonly evidence: string }

export function walk(list: unknown, visit: (cmd: Obj) => void): void {
  if (!Array.isArray(list)) return;
  for (const raw of list) {
    const cmd = raw && typeof raw === "object" ? raw as Obj : undefined;
    if (!cmd) continue;
    visit(cmd);
    // 전투 victoryBranch·상점 transactionBranch 같은 「…Branch」 갈래도 걷는다(blueprint.ts walk 와 같은 규칙).
    for (const [key, value] of Object.entries(cmd)) if (Array.isArray(value) && (/^(then|else|branch|commands|body|loop|beats)$/u.test(key) || /Branch$/u.test(key))) walk(value, visit);
    if (Array.isArray(cmd.options)) for (const o of cmd.options as Obj[]) walk(o?.branch, visit);
  }
}

export function allCommands(project: Project): { cmd: Obj; mapId: string; eventName: string }[] {
  const out: { cmd: Obj; mapId: string; eventName: string }[] = [];
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) {
    const e = ev as unknown as Obj;
    for (const page of (e.pages as Obj[] | undefined) ?? []) walk(page.commands, (cmd) => out.push({ cmd, mapId: map.id, eventName: String(e.name ?? e.id) }));
    walk(e.commands, (cmd) => out.push({ cmd, mapId: map.id, eventName: String(e.name ?? e.id) }));
  }
  for (const ce of (project.commonEvents ?? []) as unknown as Obj[]) walk(ce.commands, (cmd) => out.push({ cmd, mapId: "common", eventName: String(ce.name ?? ce.id) }));
  return out;
}

export const textOf = (cmd: Obj): string => typeof cmd.text === "string" ? cmd.text : Array.isArray(cmd.lines) ? (cmd.lines as unknown[]).join(" ") : "";

export const pages = (project: Project): Obj[] => Object.values(project.maps).flatMap((m) => (m.events ?? []).flatMap((ev) => ((ev as unknown as Obj).pages as Obj[] | undefined) ?? []));
