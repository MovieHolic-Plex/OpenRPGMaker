// 「현재 목표」가 가리키는 다음 대상 — 목표 글에서 지금 맵의 이벤트(또는 다른 맵으로 가는 문)를 찾는다(순수 함수).
//
// 왜(2026-10-29 VM 측정 판 5개 판정자 공통 지적): 「조사 위치가 눈에 안 띈다 · 어떤 물건이 메모·시계인지 모른다 · 장화 자국 위치를 못 찾았다」.
// 조사 이벤트는 대부분 투명이고 반짝임은 반경 2칸 안에서 한 번만 뜬다. 목표 글은 빌더가 「(젖은 장화: 시골 여관 가운데)」처럼
// 대상 이벤트 이름을 꼬리에 붙이므로(ai/v2/discoverability withWhere), 그 이름으로 대상을 찾아 화면에 은은한 표시를 늘 둔다.
import type { RuntimeEventView } from "@/project/runtimeEventState";
import type { Command, GameMap, Project } from "@/project/types";

const bare = (text: string): string => text.replace(/[\s「」『』"'·.,!?]/gu, "");

/** 조작으로 부를 수 있는 대상(조사·접촉) — 자동 실행·병렬·목표 걸기는 대상이 아니다. 관문 이벤트는 문(다른 맵으로 가는 것)일 때만. */
function pickable(view: RuntimeEventView, allowGate = false): boolean {
  const id = view.event.id;
  if (!view.page || id.startsWith("ev_objective") || (!allowGate && id.startsWith("ev_gate_"))) return false;
  const kind = view.trigger.kind;
  return kind === "action" || kind === "playerTouch" || kind === "eventTouch";
}

function transferMapIds(commands: readonly Command[] | undefined, out: Set<string>): void {
  for (const command of commands ?? []) {
    const record = command as unknown as Record<string, unknown>;
    if (command.kind === "transfer" && typeof record.mapId === "string") out.add(record.mapId);
    for (const value of Object.values(record)) {
      if (Array.isArray(value) && value.length && typeof value[0] === "object" && value[0] && "kind" in (value[0] as object)) transferMapIds(value as Command[], out);
    }
    if (command.kind === "choices") for (const option of command.options) transferMapIds(option.branch, out);
  }
}

/** 지금 맵에서 mapIds 중 하나로 가는 문·계단 이벤트. */
function doorsTo(views: readonly RuntimeEventView[], mapIds: ReadonlySet<string>): RuntimeEventView[] {
  return views.filter((view) => {
    const targets = new Set<string>();
    transferMapIds(view.page?.commands, targets);
    return [...targets].some((id) => mapIds.has(id));
  });
}

/** 맵에서 옮기기로 바로 갈 수 있는 맵들(모든 이벤트·페이지). */
function mapExits(map: GameMap): Set<string> {
  const out = new Set<string>();
  for (const event of map.events ?? []) {
    for (const page of event.pages ?? []) transferMapIds(page.commands, out);
    transferMapIds((event as { commands?: Command[] }).commands, out);
  }
  out.delete(map.id);
  return out;
}

/**
 * from → to 의 가장 짧은 맵 경로(양 끝 포함, 옮기기 이벤트로 잇는다). 길이 없으면 undefined.
 * 목표 꼬리(ai/v2/discoverability whereHint)와 런타임 목표 표시가 같은 경로를 본다 — 다음 맵이 둘 이상 건너면 첫 출구를 가리킨다.
 */
export function mapRoute(project: Pick<Project, "maps">, fromId: string, toId: string): string[] | undefined {
  if (fromId === toId) return [fromId];
  const prev = new Map<string, string>([[fromId, fromId]]);
  const queue = [fromId];
  for (let i = 0; i < queue.length; i += 1) {
    const map = project.maps[queue[i]!];
    if (!map) continue;
    for (const next of mapExits(map)) {
      if (prev.has(next) || !project.maps[next]) continue;
      prev.set(next, map.id);
      if (next === toId) {
        const route = [next];
        while (route[0] !== fromId) route.unshift(prev.get(route[0]!)!);
        return route;
      }
      queue.push(next);
    }
  }
  return undefined;
}

/** 지금 맵에서 targets 맵들로 가는 첫 출구 — 바로 가는 문이 있으면 그것, 없으면 가장 짧은 경로의 첫 맵으로 가는 문. */
function firstExitsTo(project: Pick<Project, "maps">, map: GameMap, views: readonly RuntimeEventView[], targets: ReadonlySet<string>): RuntimeEventView[] {
  const direct = doorsTo(views, targets);
  if (direct.length) return direct;
  const hops = new Set<string>();
  let best = Infinity;
  for (const id of targets) {
    const route = mapRoute(project, map.id, id);
    if (!route || route.length < 2 || route.length > best) continue;
    if (route.length < best) { hops.clear(); best = route.length; }
    hops.add(route[1]!);
  }
  return hops.size ? doorsTo(views, hops) : [];
}

/**
 * 목표 글의 대상 이벤트들(지금 맵).
 * 1) 꼬리 「(이름: 자리)」의 이름과 같은 이벤트 — 「(<맵> 입구: …)」 면 그 맵으로 가는 문.
 * 2) 글에 이름이 나온 이벤트(두 글자 이상, 다른 나온 이름에 품긴 짧은 이름은 뺀다).
 * 3) 글에 이름이 나온 다른 맵으로 가는 문.
 */
export function objectiveTargetViews(project: Pick<Project, "maps">, map: GameMap, views: readonly RuntimeEventView[], text: string | null | undefined): RuntimeEventView[] {
  const objective = (text ?? "").trim();
  if (!objective) return [];
  const candidates = views.filter((view) => pickable(view));
  const doorCandidates = views.filter((view) => pickable(view, true));
  const tailMatch = /\(([^():]+):([^()]*)\)\s*$/u.exec(objective);
  const tail = tailMatch?.[1]?.trim();
  const others = Object.values(project.maps).filter((other) => other.id !== map.id);
  /** 이름으로 다른 맵 찾기 — 「객실 입구」→ 「2층 객실」처럼 맵 이름이 목표 글보다 길 때도 잇는다(같은 이름이 먼저). */
  const mapsNamed = (name: string): Set<string> => {
    const key = bare(name);
    const exactMaps = others.filter((other) => bare(other.name ?? "") === key);
    return new Set((exactMaps.length || key.length < 2 ? exactMaps : others.filter((other) => bare(other.name ?? "").includes(key))).map((other) => other.id));
  };
  if (tail) {
    const entrance = /^(.+?)\s*입구$/u.exec(tail)?.[1];
    if (entrance) {
      const doors = firstExitsTo(project, map, doorCandidates, mapsNamed(entrance));
      if (doors.length) return doors;
    }
    // 「(숲 입구: 북동쪽 → 숲 통과)」·「(마을 입구: 남쪽 → 마왕의 동굴 · 마왕 처치)」 — 「→」 뒤는 그 뒤에 찾을 대상이다.
    // 그 맵에 들어선 뒤(입구 맵 = 지금 맵)에는 이 맵의 그 이벤트를, 아직 가는 길이면 목적지 맵으로 가는 첫 출구를 가리킨다.
    // 「(로비 입구: 남쪽 → 로비에서 서쪽 → 뒤뜰 · 단서 발견)」 — 거쳐 가는 맵의 방위 마디가 낄 수 있어 첫 「→」 뒤를 모두 본다(뒤 마디가 먼저).
    const after = tailMatch?.[2]?.split("→").slice(1).join("·");
    if (after) {
      const parts = after.split("·").map((part) => part.trim()).filter(Boolean);
      for (const part of [...parts].reverse()) {
        const named = candidates.filter((view) => bare(view.event.name ?? "") === bare(part));
        if (named.length) return named;
      }
      for (const part of [...parts].reverse()) {
        const ids = mapsNamed(part);
        if (!ids.size) continue;
        const doors = firstExitsTo(project, map, doorCandidates, ids);
        if (doors.length) return doors;
      }
    }
    const exact = candidates.filter((view) => bare(view.event.name ?? "") === bare(tail));
    if (exact.length) return exact;
  }
  const plain = bare(objective);
  // 글에 이름이 나온 이벤트 전부 — 다른 나온 이름의 일부인 것(「상인」 ⊂ 「상인 도윤」)은 뺀다. 용의자 셋을 한 목표가 부르면 셋 다.
  const named0 = candidates.filter((view) => { const name = bare(view.event.name ?? ""); return name.length >= 2 && plain.includes(name); });
  const best = named0.filter((view) => { const name = bare(view.event.name ?? ""); return !named0.some((other) => { const o = bare(other.event.name ?? ""); return o.length > name.length && o.includes(name); }); });
  if (best.length) return best;
  const named = new Set(Object.values(project.maps).filter((other) => other.id !== map.id && bare(other.name ?? "").length >= 2 && plain.includes(bare(other.name ?? ""))).map((other) => other.id));
  return named.size ? firstExitsTo(project, map, doorCandidates, named) : [];
}

const GENERIC_NAME = /^(?:ev[_-]|event|이벤트|npc\b|조사\s*지점$|조사$|단서$|지점$)/iu;

/** 「Z 조사 · 책장」의 이름 부분 — 이벤트 이름(사람이 읽는 이름이면), 문이면 가는 맵 이름, 없으면 그 칸 가구 이름표. */
export function promptTargetName(project: Pick<Project, "maps">, view: RuntimeEventView | undefined, label: string | null, tileLabel?: string): string | undefined {
  if (!view || !label) return undefined;
  const clip = (name: string): string => (name.length > 12 ? `${name.slice(0, 11)}…` : name);
  if (label === "Z 이동") {
    const targets = new Set<string>();
    transferMapIds(view.page?.commands, targets);
    const name = [...targets].map((id) => project.maps[id]?.name?.trim()).find(Boolean);
    return name ? clip(name) : undefined;
  }
  const raw = String(view.event.name ?? "").replace(/^숨을\s*곳\s*:\s*/u, "").trim();
  if (raw && !GENERIC_NAME.test(raw) && !ID_LIKE.test(raw) && /[\p{L}]/u.test(raw)) return clip(raw);
  // 말 거는 사람(대사 화자)이면 그 이름 — 2026-10-30 씬 벤치 gym-leader: 이름 없는 관장 앞에 단상 칸 이름 「gyd_dais_gr…」가 떴다.
  const speaker = firstSpeaker(view.page?.commands);
  if (speaker) return clip(speaker);
  const tile = tileLabel?.split(" · ")[0]?.replace(/\s*\([^)]*\)/gu, "").replace(/\s+\d+\s*[w×x]\s*\d*$/iu, "").trim();
  return tile && !ID_LIKE.test(tile) ? clip(tile) : undefined;
}

/** 내부 식별자(영문·숫자·밑줄만, 밑줄 포함 — 「gyd_dais_grass」「mx_map_x_leader」)는 사람에게 보이는 이름이 아니다. */
const ID_LIKE = /^(?=.*_)[A-Za-z0-9_.:-]+$/u;

function firstSpeaker(commands: unknown): string | undefined {
  const stack: unknown[] = [commands];
  while (stack.length) {
    const node = stack.shift();
    if (Array.isArray(node)) { stack.unshift(...node); continue; }
    if (!node || typeof node !== "object") continue;
    const r = node as Record<string, unknown>;
    if (r.kind === "text" && typeof r.speaker === "string" && r.speaker.trim() && !ID_LIKE.test(r.speaker.trim())) return r.speaker.trim();
    for (const v of Object.values(r)) if (v && typeof v === "object") stack.push(v);
  }
  return undefined;
}
