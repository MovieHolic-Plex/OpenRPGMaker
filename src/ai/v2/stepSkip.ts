// 단계 건너뛰는 지름길 검사 — 아무 단계도 하지 않은 처음 상태(스위치·아이템·자기 스위치 모두 꺼짐)에서
// 시작 맵부터 「지금 도는 페이지가 옮기는」 문만 따라가 닿는 맵에, 앞 단계와 다른 맵에 있는 뒤 단계 맵이 들어 있으면 지름길이다.
// 왜(2026-10-29 vm3 argon jrpg): 마을 서쪽 가장자리 (0,20)이 조건 없이 마왕의 옥좌로 옮겨 동굴·결계 단계를 건너뛰었다.
// 데이터 도달성·자동 플레이는 「엔딩에 닿는가」만 보므로 이 지름길을 못 본다.
import { visitNeedsProgress, visitsRunnableWithout } from "@/qa/gameCheck/autoPlay";
import type { Project } from "@/project/types";

type Cond = { kind?: string; switchId?: string; itemId?: string; key?: string; value?: unknown; present?: unknown };
type Page = { conditions?: Cond[]; commands?: unknown[] };

/** 처음 상태에서 참인 조건인가(꺼짐을 요구하는 스위치·자기 스위치, 없음을 요구하는 아이템만). 변수·배우 같은 다른 조건은 거짓으로 본다. */
const trueAtStart = (c: Cond): boolean =>
  ((c.kind === "switch" || c.kind === "selfSwitch") && c.value === false) || (c.kind === "item" && c.present === false);

function transfersOf(node: unknown, out: Set<string>): void {
  if (Array.isArray(node)) { for (const n of node) transfersOf(n, out); return; }
  if (!node || typeof node !== "object") return;
  const r = node as Record<string, unknown>;
  if (r.kind === "transfer" && typeof r.mapId === "string") out.add(r.mapId);
  for (const v of Object.values(r)) if (v && typeof v === "object") transfersOf(v, out);
}

/** 처음 상태에서 도는 페이지(조건이 모두 참인 마지막 페이지). */
function startPage(pages: readonly Page[]): Page | undefined {
  for (let i = pages.length - 1; i >= 0; i -= 1) if ((pages[i]!.conditions ?? []).every(trueAtStart)) return pages[i];
  return undefined;
}

export interface StepSkip { readonly step: number; readonly stepEvent: string; readonly map: string; readonly exits: { readonly from: string; readonly x: number; readonly y: number }[] }

/**
 * 처음 상태에서 바로 앞 단계의 맵을 거치지 않고 닿는 뒤 단계 맵과, 그 맵으로 열려 있는 출구들.
 * 단계 k 맵 T 가 시작 맵이거나 앞 단계도 T 에 있으면 보지 않는다. 앞 단계 맵을 거쳐야만 T 에 닿으면 정상 순서다.
 */
export function stepSkipShortcuts(project: Project): StepSkip[] {
  const steps = project.gameBlueprint?.steps ?? [];
  if (steps.length < 2) return [];
  const all = Object.values(project.maps).flatMap((map) => (map.events ?? []).map((ev) => ({ map, ev })));
  const stepMap = steps.map((s) => (all.find((r) => r.ev.id === s.event) ?? all.find((r) => String((r.ev as { name?: string }).name ?? "").trim() === s.event))?.map);
  const openEdges = new Map<string, { to: string; x: number; y: number }[]>();
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) {
    const page = startPage((ev.pages ?? []) as unknown as Page[]);
    if (!page) continue;
    const to = new Set<string>();
    transfersOf(page.commands ?? [], to);
    for (const id of to) if (project.maps[id] && id !== map.id) openEdges.set(map.id, [...(openEdges.get(map.id) ?? []), { to: id, x: ev.x, y: ev.y }]);
  }
  const out: StepSkip[] = [];
  steps.forEach((step, k) => {
    const target = stepMap[k], prev = stepMap[k - 1];
    if (!k || !target || !prev || prev.id === target.id || target.id === project.startMapId || prev.id === project.startMapId) return;
    if (stepMap.slice(0, k).some((m) => m?.id === target.id)) return;
    const seen = new Set<string>([project.startMapId]);
    const queue = [project.startMapId];
    const exits: StepSkip["exits"][number][] = [];
    for (let i = 0; i < queue.length; i += 1) {
      const from = queue[i]!;
      for (const e of openEdges.get(from) ?? []) {
        if (e.to === prev.id) continue;
        if (e.to === target.id) exits.push({ from: project.maps[from]?.name ?? from, x: e.x, y: e.y });
        if (!seen.has(e.to)) { seen.add(e.to); queue.push(e.to); }
      }
    }
    if (exits.length) out.push({ step: k, stepEvent: step.event, map: target.name ?? target.id, exits });
  });
  return out;
}

// ── 같은 맵 안 단계 건너뛰기 ─────────────────────────────────────────────
// 맵 출구만 보면 같은 맵 안에서 앞 단계를 건너뛰는 길을 못 본다 — 처음 상태에서 닿는 다른 이벤트가 뒤 단계의 조건(스위치·아이템·변수)을
// 켜 주면 앞 단계 없이 뒤 단계가 열린다. 단계 j 이벤트를 아예 건드리지 않고 실행할 수 있는 명령(고정점, 자동 플레이의 선행 판정과 같은 규칙)
// 가운데 뒤 단계 k 이벤트의 «하는» 명령(켜기·주기·변수·엔딩·전투·이동)이 있으면 단계 j 를 건너뛰는 지름길로 센다.

const DOING = new Set(["setSwitch", "changeItem", "setVariable", "triggerEnding", "battle", "startBattle", "battleProcessing", "transfer", "changeParty"]);

export interface StepSetterSkip { readonly skipped: number; readonly skippedEvent: string; readonly step: number; readonly stepEvent: string; readonly map: string; readonly via: string }

export function stepSkipSetters(project: Project): StepSetterSkip[] {
  const steps = project.gameBlueprint?.steps ?? [];
  if (steps.length < 2) return [];
  const all = Object.values(project.maps).flatMap((map) => (map.events ?? []).map((ev) => ({ map, ev })));
  const name = (ev: { name?: string }) => String(ev.name ?? "").trim();
  const refs = steps.map((s) => all.find((r) => r.ev.id === s.event) ?? all.find((r) => name(r.ev as { name?: string }) === s.event));
  const out: StepSetterSkip[] = [];
  steps.forEach((skippedStep, j) => {
    const skipped = refs[j];
    if (!skipped || j === steps.length - 1) return;
    const ran = visitsRunnableWithout(project, skipped.ev.id);
    for (let k = j + 1; k < steps.length; k += 1) {
      const ref = refs[k];
      if (!ref || ref.ev.id === skipped.ev.id) continue;
      const hit = ran.find((v) => v.page.event?.id === ref.ev.id && visitNeedsProgress(project, v) && DOING.has(String(v.command.kind))
        && !(v.command.kind === "changeItem" && v.command.op === "-=") && !(v.command.kind === "setSwitch" && v.command.value === false)
        && !(v.command.kind === "transfer" && v.command.mapId === v.page.map?.id));
      if (!hit) continue;
      out.push({ skipped: j, skippedEvent: skippedStep.event, step: k, stepEvent: steps[k]!.event, map: ref.map.name ?? ref.map.id, via: `p${hit.page.pageIndex} ${hit.indexPath.join(".")} ${String(hit.command.kind)}` });
      break;
    }
  });
  return out;
}
