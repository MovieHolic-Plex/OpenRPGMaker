// project/eventSight.ts
// 플레이어가 화면에서 «거기 무언가 있다» 고 볼 수 있는 이벤트인가 — 짓는 쪽(조수 v2 사슬 빌더)과 재는 쪽(정직한 자동 플레이)이 같은 눈을 쓴다.
//
// 왜 (2026-11-12 r1w-fun 「불씨를 되찾아서」): 경로가 꼭 거쳐야 하는 「번호 쪽지」가 그림 없는 이벤트로 돌무더기 그림 위에 놓였고,
// 「거대 두개골」은 맨땅의 그림 없는 발밑 이벤트였다. 가까이 가면 한 번 반짝일 뿐이라(nearSparkle) 눈가림 판정자는 둘 다 찾지 못했는데,
// 기계 플레이어는 계획표의 좌표로 걸어가 조사했고 출하 검사는 「엔딩 도달」로 적었다.
//
// 보이는 것: 제 그림 · 늘 빛나는 표지(page.glow) · 그 자리에 그려진 작은 물건(이름표가 이벤트 이름의 물건 낱말을 담으면 «그 물건» 이다).
// 안 보이는 것: 가까이 가야 한 번 터지는 반짝임(nearSparkle)만 있는 칸, 맨바닥, 건물 한 채·성벽 같은 큰 그림의 한 칸.

import { objectClusterAt } from "./objectFootprint";
import type { EventPage, GameEvent, GameMap, Project } from "./types";

export type EventSight =
  /** 제 그림(사람·상자·문짝). */
  | { readonly seen: "graphic" }
  /** 늘 빛나는 표지. */
  | { readonly seen: "glow" }
  /** 그려진 작은 물건 위. named = 그 물건의 이름표가 이벤트 이름의 물건 낱말을 담는다(「낡은 책상」 ↔ 책상). */
  | { readonly seen: "art"; readonly label: string; readonly named: boolean }
  /** 안 보인다. under = 큰 그림(건물·성벽)의 한 칸이면 그 이름표. */
  | { readonly seen: "none"; readonly under?: string };

/** 「어느 칸인지」 알 수 있는 물건 한 점의 칸 수 — 건물 한 채의 벽면은 넘는다(discoverability 의 SMALL_OBJECT_CELLS 와 같은 값). */
const SMALL_ART_CELLS = 6;

/** 그 페이지가 제 그림으로 보이는가(투명·빈 그림은 아니다). */
export function pageHasGraphic(page: Pick<EventPage, "graphic"> | undefined): boolean {
  const g = page?.graphic;
  if (!g || g.transparent === true) return false;
  return Boolean(g.sprite || g.appearanceId || (typeof (g as { tileId?: unknown }).tileId === "number" && ((g as { tileId: number }).tileId) > 0));
}

/** 이벤트 이름의 물건 낱말 — 마지막 어절(「낡은 책상」 → 책상, 「old desk」 → desk). 두 글자 미만이면 없다. */
export function thingWord(name: string | undefined): string | undefined {
  const last = (name ?? "").trim().split(/\s+/u).at(-1)?.replace(/[^\p{L}\p{N}]/gu, "") ?? "";
  return last.length >= 2 ? last : undefined;
}

function bodyCells(page: EventPage | undefined, at: { x: number; y: number }): { x: number; y: number }[] {
  const w = Math.max(1, Math.floor(page?.footprint?.width ?? 1)), h = Math.max(1, Math.floor(page?.footprint?.height ?? 1));
  const left = at.x - Math.floor((w - 1) / 2);
  const cells: { x: number; y: number }[] = [];
  for (let dy = 0; dy < h; dy += 1) for (let dx = 0; dx < w; dx += 1) cells.push({ x: left + dx, y: at.y - dy });
  // 키 큰 물건은 발치 칸에 이벤트가 서고 그림은 한 칸 위까지 온다.
  cells.push({ x: at.x, y: at.y - h });
  return cells;
}

/**
 * 그 페이지가 켜져 있을 때 이 이벤트가 어떻게 보이는가. at 은 컷신이 옮긴 칸(없으면 저작 칸).
 * page 가 없으면(조건이 맞는 페이지가 없다) 안 보인다.
 */
export function eventSight(project: Project, map: GameMap, event: GameEvent, page: EventPage | undefined, at: { x: number; y: number } = event): EventSight {
  if (!page) return { seen: "none" };
  if (pageHasGraphic(page)) return { seen: "graphic" };
  if (page.glow) return { seen: "glow" };
  const word = thingWord(event.name);
  let under: string | undefined;
  for (const cell of bodyCells(page, at)) {
    const cluster = objectClusterAt(project, map, cell.x, cell.y);
    if (!cluster) continue;
    if (cluster.cells.length > SMALL_ART_CELLS) { under ??= cluster.label; continue; }
    return { seen: "art", label: cluster.label, named: Boolean(word && cluster.label.replace(/\s+/gu, "").includes(word)) };
  }
  return under ? { seen: "none", under } : { seen: "none" };
}
