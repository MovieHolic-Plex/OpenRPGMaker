// editor/stampEffect.ts
// 바로 깔기가 실제로 바꾼 것을 센다 — 도구가 「성공」이라 말해도 화면에 그림이 없으면 거짓 성공이다.
//
// 2026-10-15 코퍼스(scripts/qa/stamp-place-corpus.mts): 200회 중 24회가 「성공」인데 타일도 보이는 이벤트도 없었다
// (조사 지점·투명 NPC 가 「빈 바닥 위 투명」). 결과 줄이 도구 요약을 이어 붙이기만 해서 사용자는 완료로 읽었다.
// 이 함수는 적용 전·후 프로젝트의 그 맵을 비교한다. 순수 — 스토어를 읽지 않는다.
import type { GameEvent, GameMap, Project } from "@/project/types";

export interface StampEffect {
  /** 바뀐 타일 칸 수(아래·위·겹침 층의 칸 합 — 같은 칸이 두 층에서 바뀌면 둘로 센다). */
  readonly tilesChanged: number;
  readonly eventsAdded: number;
  readonly eventsRemoved: number;
  /** 새 이벤트 중 보이는 그림(스프라이트·외형)이 있는 것. */
  readonly eventsWithArt: number;
  /** 새 이벤트 중 그림이 없거나 투명인 것 — 화면에 아무것도 안 보인다. */
  readonly eventsInvisible: number;
  /** 새로 깔리거나 바뀐 주행 탈것 노선(map.transit.routes) 수. */
  readonly transitRoutesChanged?: number;
}

const TILE_LAYERS = ["lowerTiles", "upperTiles", "lowerOverlayTiles", "upperOverlayTiles"] as const;

/** 이벤트의 첫 페이지가 보이는 그림을 가졌는가. */
export function eventHasVisibleArt(event: GameEvent): boolean {
  const graphic = (event.pages?.[0] as { graphic?: { sprite?: unknown; appearanceId?: unknown; transparent?: boolean } } | undefined)?.graphic;
  if (!graphic) return false;
  if (graphic.transparent === true) return false;
  return Boolean(graphic.sprite) || Boolean(graphic.appearanceId);
}

export function measureStampEffect(before: Project, after: Project, mapId: string): StampEffect {
  const a = before.maps[mapId];
  const b = after.maps[mapId];
  if (!a || !b) return { tilesChanged: 0, eventsAdded: 0, eventsRemoved: 0, eventsWithArt: 0, eventsInvisible: 0, transitRoutesChanged: 0 };
  let tilesChanged = 0;
  const size = Math.min(a.width * a.height, b.width * b.height);
  for (const key of TILE_LAYERS) {
    const x = (a as unknown as Record<string, readonly number[] | undefined>)[key];
    const y = (b as unknown as Record<string, readonly number[] | undefined>)[key];
    if (x === y) continue;
    for (let i = 0; i < size; i++) if ((x?.[i] ?? -1) !== (y?.[i] ?? -1)) tilesChanged += 1;
  }
  const beforeIds = new Set(a.events.map((event) => event.id));
  const afterIds = new Set(b.events.map((event) => event.id));
  const added = b.events.filter((event) => !beforeIds.has(event.id));
  const transitBefore = JSON.stringify(a.transit?.routes ?? []);
  const transitAfter = JSON.stringify(b.transit?.routes ?? []);
  const transitRoutesChanged = transitBefore !== transitAfter ? Math.max(b.transit?.routes?.length ?? 0, a.transit?.routes?.length ?? 0, 1) : 0;
  return {
    tilesChanged,
    eventsAdded: added.length,
    eventsRemoved: a.events.filter((event) => !afterIds.has(event.id)).length,
    eventsWithArt: added.filter(eventHasVisibleArt).length,
    eventsInvisible: added.filter((event) => !eventHasVisibleArt(event)).length,
    transitRoutesChanged,
  };
}

/** 결과 줄에 붙이는 한 줄 — 실제로 바뀐 것만 적는다. */
export function describeStampEffect(effect: StampEffect): string {
  const parts: string[] = [];
  parts.push(`타일 ${effect.tilesChanged}칸`);
  if (effect.eventsAdded > 0) {
    parts.push(`새 이벤트 ${effect.eventsAdded}개(그림 ${effect.eventsWithArt}${effect.eventsInvisible > 0 ? ` · 투명 ${effect.eventsInvisible}` : ""})`);
  }
  if (effect.eventsRemoved > 0) parts.push(`이벤트 ${effect.eventsRemoved}개 삭제`);
  if ((effect.transitRoutesChanged ?? 0) > 0) parts.push(`주행 노선 ${effect.transitRoutesChanged}개`);
  return `실제로 바뀐 것: ${parts.join(" · ")}`;
}

/** 화면에 보이는 변화가 하나라도 있는가(타일이 바뀌었거나 그림 있는 이벤트가 생김/지워짐, 또는 탈것 주행 노선이 바뀜). */
export function hasVisibleChange(effect: StampEffect): boolean {
  return effect.tilesChanged > 0 || effect.eventsWithArt > 0 || effect.eventsRemoved > 0 || (effect.transitRoutesChanged ?? 0) > 0;
}

export function mapOf(project: Project, mapId: string): GameMap | undefined {
  return project.maps[mapId];
}
