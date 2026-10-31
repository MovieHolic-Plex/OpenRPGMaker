// editor/tools/interiorExitLint.ts
// 「아무 데도 안 가는 출구」 경고 — run_lint · evaluate_game_quality 의 warning `map-exit-leads-nowhere`.
//
// 왜(2026-10-31 이세계 고딩 맵 적대적 VQA): build_hand_interior_room 의 school-class-wing 교실은 맨 아래 줄에 1칸 출구 틈(13,16)을
// 그리는데, 아무도 그 틈에 이동 이벤트를 달지 않았다. 플레이어에게는 걸어 나갈 수 있어 보이는 문이 막다른 곳이다.
// 손 도트 실내는 모두 남쪽 출구 틈을 그리고 결과 data.exits 로 좌표를 알려 주지만, 잇는 일은 호출자 몫이라 빠지기 쉽다.
//
// 판정: 맨 아래 줄이 거의 막혀 있고(통행 칸 ≤ 3) 그 틈(handInteriorMapExits)에도, 틈 바로 위 칸에도 이벤트(이동 또는 「나갈 수 없다」
// 안내)가 없고 mapConnections 끝점도 없으면 경고. 바깥(맨 아래 줄이 넓게 트인 맵)이 없는 프로젝트(region-reference 견본 장소)와 아무도 들어오지 않는 맵은 건너뛴다.

import type { LintIssue } from "@/project/lint/projectLint";
import type { GameEvent, GameMap, Project } from "@/project/types";
import { handInteriorMapExits, type InteriorExitSpan } from "@/editor/handInterior/exits";
import { playerAnchors } from "./transferReachability";

const MAX_EXIT_CELLS = 3;

function spanLinked(project: Project, map: GameMap, span: InteriorExitSpan): boolean {
  const inSpan = (x: number, y: number): boolean => x >= span.x && x < span.x + span.width && (y === span.y || y === span.y - 1);
  // 이동이든 「나갈 수 없다」 안내든, 틈에 선 이벤트가 있으면 저자가 처리한 출구다(폴른 스타 연금의 밤 천문대 정문).
  if (map.events.some((event: GameEvent) => inSpan(event.x, event.y))) return true;
  return (project.mapConnections ?? []).some((connection) => [connection.from, connection.to]
    .some((end) => end.mapId === map.id && inSpan(end.x, end.y)));
}

/** 이동이 없는 남쪽 출구 틈마다 warning 하나. */
export function deadEndExitIssues(project: Project): LintIssue[] {
  const issues: LintIssue[] = [];
  const enclosed = Object.values(project.maps)
    .filter((map) => !map.worldmapSource && map.width >= 6 && map.height >= 4)
    .map((map) => ({ map, spans: handInteriorMapExits(project, map) }))
    .map((entry) => ({ ...entry, open: entry.spans.reduce((sum, span) => sum + span.width, 0) }));
  // 바깥(넓게 트인 맵)이 하나도 없으면 이을 곳이 없다 — region-reference 견본 장소(집 1·2층, 역사…)는 실내만 담는다.
  if (!enclosed.some((entry) => entry.open > MAX_EXIT_CELLS)) return issues;
  for (const { map, spans, open } of enclosed) {
    if (open === 0 || open > MAX_EXIT_CELLS) continue;
    if (project.startMapId !== map.id && playerAnchors(project, map).length === 0) continue;
    for (const span of spans) {
      if (spanLinked(project, map, span)) continue;
      const cells = Array.from({ length: span.width }, (_, i) => `(${span.x + i},${span.y})`).join(" ");
      // 닫을 때는 틈과 양옆 문틀 조각(왼·오른 틀 그림)을 맨 아래 줄의 가장 흔한 벽 타일로 덮는다 — 틈만 칠하면 문틀 선이 남는다.
      const row = map.lowerTiles.slice(span.y * map.width, (span.y + 1) * map.width);
      const counts = new Map<number, number>();
      row.forEach((tile, x) => { if (x < span.x || x >= span.x + span.width) counts.set(tile, (counts.get(tile) ?? 0) + 1); });
      const wallTile = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? row[0];
      const close: { x: number; y: number }[] = [];
      for (let x = Math.max(0, span.x - 1); x <= Math.min(map.width - 1, span.x + span.width); x += 1) close.push({ x, y: span.y });
      issues.push({
        severity: "warning", code: "map-exit-leads-nowhere", mapId: map.id,
        message: `'${map.name}'(${map.id}) has a south exit gap at ${cells} that leads nowhere: no event stands on it or just above it, so the player can walk into a door that goes nowhere. `
          + `Connect it to the outside door with create_transfer_pair({"a":{"mapId":"${map.id}","x":${span.x},"y":${span.y}},"b":{"mapId":"<outside map>","x":<door x>,"y":<door y>}}), `
          + `or, if the player must not leave this way, put an event on the gap that says why, or close the gap and its door frame with the plain wall tile of that row: paint_tiles(${JSON.stringify({ mapId: map.id, layer: "1", mode: "cells", tile: wallTile, cells: close })}).`,
      });
    }
  }
  return issues;
}
