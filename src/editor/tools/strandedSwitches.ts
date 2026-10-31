// 이벤트를 지우면 진행이 영영 안 열리는가 — 지울 이벤트가 켜는 스위치를 다른 어디도 켜지 않는데, 남는 이벤트의 페이지 조건이 그 스위치를 기다리면 «고아»다.
//
// 왜(2026-10-31 ja2a argon jrpg): 다듬기 할 일(「동굴 왼쪽 위를 정리」)에서 모델이 던전 빌더의 보스 이벤트를 remove_event 로 지웠다.
// 마지막 단계 「마왕」의 엔딩 페이지는 그 보스의 클리어 스위치를 조건으로 기다렸고, 그 스위치를 켜는 것은 그 보스뿐이었다 —
// 판정자는 보스를 이기고도 엔딩 페이지가 영영 안 열려 「시작 마을로 돌아가자」만 따라 헤맸다(엔딩 못 봄).
import { isScriptCommand, scriptHasDynamic, scriptWrites } from "@/project/script/effects";
import type { GameEvent, Project } from "@/project/types";

type Node = Record<string, unknown>;

function visit(node: unknown, fn: (n: Node) => void): void {
  if (Array.isArray(node)) { for (const v of node) visit(v, fn); return; }
  if (!node || typeof node !== "object") return;
  fn(node as Node);
  for (const v of Object.values(node as Node)) if (v && typeof v === "object") visit(v, fn);
}

/** 이 덩어리 안에서 켜는 스위치(setSwitch, 끄기 아님). 스크립트가 리터럴 id 로 쓰는 스위치도 켤 수 있다고 본다. */
function switchesSetIn(node: unknown, project: Project): Set<string> {
  const out = new Set<string>();
  visit(node, (n) => {
    if (n.kind === "setSwitch" && typeof n.switchId === "string" && n.value !== false) out.add(n.switchId);
    if (isScriptCommand(n)) for (const id of scriptWrites(n, "switch", project)) out.add(id);
  });
  return out;
}

/** 이 덩어리 안 스크립트가 계산된 id 로 스위치를 쓰는가 — 그러면 어느 스위치든 켤 수 있다. */
function dynamicSwitchWriterIn(node: unknown, project: Project): boolean {
  let found = false;
  visit(node, (n) => { if (!found && isScriptCommand(n) && scriptHasDynamic(n, "switch", { access: "write", library: project.scriptLibrary })) found = true; });
  return found;
}

export interface StrandedSwitch { switchId: string; switchName?: string; readers: { mapId: string; mapName?: string; eventId: string; eventName?: string }[] }

/**
 * mapId 의 eventId 를 지우면 고아가 되는 스위치들 — 그 이벤트만 켜고(다른 맵 이벤트·공통 이벤트·적 그룹 어디서도 안 켬),
 * 남는 다른 이벤트의 페이지 조건이 켜짐을 기다리는 것. 없으면 빈 배열.
 */
export function strandedByRemoval(project: Project, mapId: string, eventId: string): StrandedSwitch[] {
  const map = project.maps[mapId];
  const target = map?.events.find((e) => e.id === eventId);
  if (!map || !target) return [];
  const mine = switchesSetIn(target.pages ?? [], project);
  if (!mine.size) return [];
  // 나머지 전체에서 켜는 것 — 그 이벤트만 빼고 프로젝트 전체(맵 이벤트, 공통 이벤트, 적 그룹 페이지 등)를 훑는다.
  const elsewhere = new Set<string>();
  let dynamicElsewhere = false;
  for (const [key, value] of Object.entries(project as unknown as Node)) {
    if (key === "maps") continue;
    for (const id of switchesSetIn(value, project)) elsewhere.add(id);
    if (key !== "scriptLibrary" && dynamicSwitchWriterIn(value, project)) dynamicElsewhere = true;
  }
  for (const m of Object.values(project.maps)) {
    for (const ev of m.events ?? []) if (!(m.id === mapId && ev.id === eventId)) {
      for (const id of switchesSetIn(ev, project)) elsewhere.add(id);
      if (dynamicSwitchWriterIn(ev, project)) dynamicElsewhere = true;
    }
    const rest = { ...(m as unknown as Node) }; delete rest.events;
    for (const id of switchesSetIn(rest, project)) elsewhere.add(id);
  }
  // 남는 스크립트가 계산된 id 로 스위치를 쓰면 「다른 곳은 안 켠다」를 증명할 수 없다 — 거절하지 않는다.
  if (dynamicElsewhere) return [];
  const names = new Map<string, string>(((project.database as unknown as { switches?: { id: string; name?: string }[] })?.switches ?? []).map((s) => [s.id, String(s.name ?? "")]));
  const out: StrandedSwitch[] = [];
  for (const id of mine) {
    if (elsewhere.has(id)) continue;
    const readers: StrandedSwitch["readers"] = [];
    for (const m of Object.values(project.maps)) for (const ev of m.events ?? []) {
      if (m.id === mapId && ev.id === eventId) continue;
      const waits = (ev.pages ?? []).some((p) => ((p.conditions ?? []) as { kind?: string; switchId?: string; value?: unknown }[]).some((c) => c.kind === "switch" && c.switchId === id && c.value !== false));
      if (waits) readers.push({ mapId: m.id, mapName: m.name, eventId: ev.id, eventName: (ev as GameEvent & { name?: string }).name });
    }
    if (readers.length) out.push({ switchId: id, switchName: names.get(id) || undefined, readers });
  }
  return out;
}

/** 모델에게 돌려줄 영어 거절 글. */
export function strandedRefusal(eventId: string, stranded: StrandedSwitch[]): string {
  const parts = stranded.map((s) => {
    const who = s.readers.slice(0, 4).map((r) => `${r.eventName ? `«${r.eventName}» ` : ""}${r.eventId} on ${r.mapName ?? r.mapId}`).join(", ");
    return `switch ${s.switchId}${s.switchName ? ` «${s.switchName}»` : ""} — waited for by ${who}${s.readers.length > 4 ? ` and ${s.readers.length - 4} more` : ""}`;
  });
  return `Refused: ${eventId} is the only thing that turns on ${parts.join("; ")}. Removing it would leave those pages unreachable, so the story could never move past them. `
    + "Keep the event (use move_event to move it, or change its look), or first rewire or remove the pages that wait for that switch, then remove it.";
}
