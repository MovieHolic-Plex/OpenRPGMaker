// editor/panels/mapTreeAiBadges.ts
// 맵 목록의 「누가 쓰는 중 / 잠금 대기」 배지(2026-11-24 qa1124 목업 v4 맵 목록).
//
// 재료는 이미 있는 두 원천뿐이다 — 새 관측을 만들지 않는다:
//  - 맵별 실행 대기열(aiMapRunQueue): 앞 턴·맵별 실행이 잡은 맵(running)과 그 맵을 기다리는 요청(waiting).
//  - AI 존재감(aiPresence): 팀 일꾼(agent_spawn 의 mapId)이 지금 쓰는 맵과 그 일꾼 이름·색 번호.
// 진행률·남은 시간 같은 짐작은 넣지 않는다. 글은 한국어 짧은 말만.

import { mapRunQueue, type MapRunTicket } from "@/editor/aiMapRunQueue";
import { currentPresences, subscribeAiPresence, type Presence } from "@/editor/panels/aiPresence";
import { el } from "@/util/dom";

export interface MapAiBadge {
  readonly kind: "working" | "waiting";
  readonly text: string;
  /** 마우스를 올리면 보이는 한 줄. */
  readonly title: string;
  /** 작업 번호 색(0~3) — 지도 위 이름표·상태 줄과 같은 색. 기다림은 색 번호 없이 경고 색. */
  readonly tone?: number;
}

function workingText(name: string): string {
  return !name || name === "조수" ? "조수 작업 중" : `${name} 작업 중`;
}

function waitTitle(ticket: MapRunTicket): string {
  if (ticket.wait === "capacity") return "동시에 도는 작업이 많아 차례를 기다리는 중";
  if (ticket.wait === "exclusive") return "팀 작업이 끝나길 기다리는 중";
  return `같은 맵 ${ticket.ahead + 1}번째로 기다리는 중 · ${ticket.label}`;
}

/**
 * 맵 id → 배지(작업 중이 먼저, 기다림이 뒤). `isMap` 은 실제 맵인지 — 「프로젝트 전체」 같은 대기열 키는 배지가 없다.
 * 순수 함수: 화면·테스트가 같은 규칙을 쓴다.
 */
export function mapAiBadges(
  presences: readonly Presence[],
  tickets: readonly MapRunTicket[],
  isMap: (mapId: string) => boolean,
): ReadonlyMap<string, readonly MapAiBadge[]> {
  const working = new Map<string, MapAiBadge>();
  const waiting = new Map<string, MapAiBadge>();
  // 일꾼 이름과 색 번호가 있는 쪽(존재감)을 먼저 — 같은 맵의 대기열 표보다 말이 구체적이다.
  for (const presence of presences) {
    if (presence.state !== "working" || presence.readsOnly || !presence.mapId || !isMap(presence.mapId)) continue;
    if (working.has(presence.mapId)) continue;
    working.set(presence.mapId, {
      kind: "working", text: workingText(presence.name), tone: presence.tone,
      title: presence.action ? `${presence.name || "조수"} · ${presence.action}` : workingText(presence.name),
    });
  }
  for (const ticket of tickets) {
    if (ticket.exclusive || !isMap(ticket.mapKey)) continue;
    if (ticket.status === "running" && !working.has(ticket.mapKey)) {
      working.set(ticket.mapKey, { kind: "working", text: "조수 작업 중", title: ticket.label ? `조수 · ${ticket.label}` : "조수 작업 중" });
    } else if (ticket.status === "waiting" && !waiting.has(ticket.mapKey)) {
      const count = tickets.filter((t) => t.status === "waiting" && !t.exclusive && t.mapKey === ticket.mapKey).length;
      waiting.set(ticket.mapKey, {
        kind: "waiting",
        text: ticket.wait === "capacity" ? "차례 대기" : count > 1 ? `잠금 대기 ${count}` : "잠금 대기",
        title: waitTitle(ticket),
      });
    }
  }
  const out = new Map<string, MapAiBadge[]>();
  for (const [mapId, badge] of working) out.set(mapId, [badge]);
  for (const [mapId, badge] of waiting) out.set(mapId, [...(out.get(mapId) ?? []), badge]);
  return out;
}

export function mapAiBadgeElements(badges: readonly MapAiBadge[] | undefined, mapId: string): HTMLElement[] {
  return (badges ?? []).map((badge) => el("span", {
    class: `map-tree-ai-badge is-${badge.kind}`,
    text: badge.text,
    attrs: { title: badge.title },
    dataset: { testid: `map-tree-ai-badge-${mapId}`, kind: badge.kind, ...(badge.tone !== undefined ? { tone: String(badge.tone) } : {}) },
  }));
}

let watching = false;
let snapshot: ReadonlyMap<string, readonly MapAiBadge[]> = new Map();
let isMapRef: (mapId: string) => boolean = () => false;
const changeListeners = new Set<() => void>();

function recompute(): void {
  const next = mapAiBadges(currentPresences(), mapRunQueue().tickets(), isMapRef);
  if (sameBadges(snapshot, next)) return;
  snapshot = next;
  for (const listener of [...changeListeners]) listener();
}

function sameBadges(a: ReadonlyMap<string, readonly MapAiBadge[]>, b: ReadonlyMap<string, readonly MapAiBadge[]>): boolean {
  if (a.size !== b.size) return false;
  for (const [mapId, list] of a) {
    const other = b.get(mapId);
    if (!other || other.length !== list.length) return false;
    for (let i = 0; i < list.length; i += 1) {
      const x = list[i]!, y = other[i]!;
      if (x.kind !== y.kind || x.text !== y.text || x.title !== y.title || x.tone !== y.tone) return false;
    }
  }
  return true;
}

/** 지금 배지(맵 목록이 행을 그릴 때 읽는다). 처음 부르면 두 원천을 구독한다 — 편집기 수명 동안 붙어 있다. */
export function currentMapAiBadges(isMap: (mapId: string) => boolean): ReadonlyMap<string, readonly MapAiBadge[]> {
  isMapRef = isMap;
  if (!watching) {
    watching = true;
    subscribeAiPresence(() => recompute());
    mapRunQueue().subscribe(() => recompute());
  }
  recompute();
  return snapshot;
}

/** 배지가 바뀌면 부른다(맵 목록이 그 줄만 다시 붙인다). */
export function onMapAiBadgesChange(listener: () => void): () => void {
  changeListeners.add(listener);
  return () => { changeListeners.delete(listener); };
}
