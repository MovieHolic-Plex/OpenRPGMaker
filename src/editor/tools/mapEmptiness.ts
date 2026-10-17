// editor/tools/mapEmptiness.ts
// 「단색 잔디 빈 맵」 측정·안내·검사 도구. 순수 함수 + check_map_emptiness 읽기 도구.
//
// 2026-10-15 FF6 감사 #35: 역할극 필드 맵 7장이 전부 단색 잔디였다(create_map 만 부르고 구성기를 못 찾았다).
// 측정은 qa:game 의 flatMapFinding(visual-flat)과 같은 기준이다 — 가장 흔한 바닥 타일이 80% 이상이고 그 위 장식이 10% 이하.
// 쓰이는 곳:
//   - create_map 결과 summary 의 「다음에 부를 도구」 한 줄(emptyMapNextStep)
//   - run_lint · evaluate_game_quality 의 warning `map-flat-ground`(flatGroundIssues) — 완료 직전 검사에서 자동으로 걸린다
//   - check_map_emptiness 도구(맵별 수치 + 구체 호출문)

import { TILE } from "@/project/defaults/constants";
import type { LintIssue } from "@/project/lint/projectLint";
import type { GameMap, Project } from "@/project/types";
import { THEME_SCENES, themeSceneToolArgs, type ThemeScene } from "./themeScenes";
import { ToolError, type ToolDefinition } from "./types";

export const FLAT_MIN_CELLS = 100;
export const FLAT_DOMINANT_RATIO = 0.8;
export const FLAT_DECOR_RATIO = 0.1;

type EmptinessMap = Pick<GameMap, "id" | "name" | "width" | "height" | "tilesetId" | "lowerTiles" | "upperTiles" | "lowerOverlayTiles" | "upperOverlayTiles" | "events">;

export interface MapEmptiness {
  readonly cells: number;
  readonly dominantTile: number;
  /** 가장 흔한 바닥 타일이 맵을 덮는 비율(0~1). */
  readonly dominantRatio: number;
  /** 가장 흔한 바닥이 아닌 칸 + 위층·덧층이 있는 칸의 비율(0~1) — 길·물·나무·건물·소품이 얼마나 있는가. */
  readonly decorRatio: number;
  readonly distinctGround: number;
  readonly events: number;
  /** 단색에 가깝다(플레이어에게는 무늬 없는 빈 판). */
  readonly flat: boolean;
}

export function measureMapEmptiness(map: EmptinessMap): MapEmptiness {
  const cells = map.width * map.height;
  const counts = new Map<number, number>();
  for (const tile of map.lowerTiles) counts.set(tile, (counts.get(tile) ?? 0) + 1);
  let dominant = 0, dominantTile = -1;
  for (const [tile, n] of counts) if (n > dominant) { dominant = n; dominantTile = tile; }
  let decor = 0;
  for (let i = 0; i < cells; i += 1) {
    const others = [map.upperTiles[i], map.lowerOverlayTiles?.[i], map.upperOverlayTiles?.[i]];
    if (others.some((tile) => tile !== undefined && tile >= 0) || map.lowerTiles[i] !== dominantTile) decor += 1;
  }
  const dominantRatio = cells > 0 ? dominant / cells : 0;
  const decorRatio = cells > 0 ? decor / cells : 0;
  return {
    cells, dominantTile, dominantRatio, decorRatio, distinctGround: counts.size, events: map.events?.length ?? 0,
    flat: cells >= FLAT_MIN_CELLS && dominantRatio >= FLAT_DOMINANT_RATIO && decorRatio <= FLAT_DECOR_RATIO,
  };
}

/** ai/workItemOutcome.isUnauthoredMap 과 같은 판정 — 그 모듈은 시험 실행기까지 끌고 와 도구 레지스트리와 순환할 수 있어 복사했다. */
export function isBlankMap(map: GameMap): boolean {
  if (map.events.length > 0) return false;
  if (Object.keys(map.lowerTileStacks ?? {}).length > 0) return false;
  if (Object.keys(map.upperTileStacks ?? {}).length > 0) return false;
  if (map.upperTiles.some((tile) => tile !== TILE.EMPTY)) return false;
  if (map.lowerTiles.length === 0) return true;
  const first = map.lowerTiles[0];
  return map.lowerTiles.every((tile) => tile === first);
}

const callText = (tool: string, args: Record<string, unknown>): string => `${tool}(${JSON.stringify(args)})`;

function scenesFor(tilesetId: string): ThemeScene[] {
  return THEME_SCENES.filter((scene) => scene.tilesetId === tilesetId);
}

/** 맵 이름에 든 낱말로 이 칩셋의 장면을 줄 세운다(없으면 정의 순서). */
function rankScenes(map: Pick<EmptinessMap, "name">, scenes: readonly ThemeScene[]): ThemeScene[] {
  const text = map.name.toLowerCase();
  return scenes
    .map((scene, index) => ({ scene, index, hit: scene.keywords.filter((word) => text.includes(word)).length }))
    .sort((left, right) => right.hit - left.hit || left.index - right.index)
    .map((entry) => entry.scene);
}

/** 이 빈 맵을 채울 「다음에 부를 도구」 — 구체 이름과 인자 예시. 한두 줄 문장. */
export function emptyMapNextStep(map: Pick<EmptinessMap, "id" | "name" | "width" | "height" | "tilesetId">): string {
  if (map.tilesetId === "atlas_biome_interior") {
    return `다음: 실내는 build_hand_interior_room({"mapId":"${map.id}",…}) 로 벽·바닥·가구를 한 번에 짓는다 — 단색 바닥만 있는 방은 완성이 아니다.`;
  }
  const scenes = rankScenes(map, scenesFor(map.tilesetId));
  if (scenes.length === 0) {
    return `다음: find_empty_ground({"mapId":"${map.id}"}) 로 빈 터를 찾고 furnish_outdoor_area({"mapId":"${map.id}"}) 로 채운다 — 길·나무·건물·물이 없는 단색 맵은 완성이 아니다.`;
  }
  const picks = scenes.slice(0, 3).map((scene) => {
    const style = scene.defaultStyle;
    const args = themeSceneToolArgs(scene, style, map.id, map, undefined);
    const choices = scene.styles ? ` [${scene.styleParam}: ${scene.styles.slice(0, 6).join("|")}${scene.styles.length > 6 ? "|…" : ""}]` : "";
    return `${scene.label} ${callText(scene.tool, args)}${choices}`;
  });
  return `다음: 이 칩셋의 구성기로 한 번에 채운다 — ${picks.join(" / ")}. 맵 크기가 안 맞으면 도구가 resize_map 안내를 준다. 단색 잔디 맵은 완성이 아니다.`;
}

/** 프로젝트의 단색 맵마다 warning `map-flat-ground` 하나. 월드맵·시작 때 남은 빈 시드 맵·(옵션)이미 error 로 걸린 빈 껍데기는 제외. */
export function flatGroundIssues(project: Project, options: { readonly includeBlank?: boolean } = {}): LintIssue[] {
  const issues: LintIssue[] = [];
  for (const map of Object.values(project.maps)) {
    if (map.worldmapSource) continue;
    if (map.id === "map_blank_start" && project.startMapId !== map.id) continue;
    const blank = isBlankMap(map);
    if (blank && options.includeBlank === false) continue;
    const m = measureMapEmptiness(map);
    if (!m.flat) continue;
    issues.push({
      severity: "warning", code: "map-flat-ground", mapId: map.id,
      message: `'${map.name}'(${map.id}) ${map.width}×${map.height}: 바닥 타일 ${m.dominantTile} 한 가지가 ${Math.round(m.dominantRatio * 100)}%, 장식 ${Math.round(m.decorRatio * 100)}% — 플레이어에게는 무늬 없는 빈 판입니다. ${emptyMapNextStep(map)}`,
    });
  }
  return issues;
}

export const CHECK_MAP_EMPTINESS_TOOL: ToolDefinition = {
  name: "check_map_emptiness",
  description: "맵이 단색 잔디 빈 판인지 잰다(가장 흔한 바닥 비율·장식 비율·이벤트 수) — 필드·마을·던전을 지은 직후, 그리고 게임을 끝내기 직전에 모든 맵에 대해 한 번 부른다. 빈 판이면 이 칩셋의 구성기를 구체 호출문으로 알려 준다(create_map({themeScene}) 도 같은 일을 한 번에 한다). mapId 를 생략하면 전체 맵을 훑는다. run_lint 의 map-flat-ground 경고와 같은 기준이다.",
  mode: "read",
  domains: ["map", "tile"],
  parameters: { type: "object", properties: { mapId: { type: "string", description: "한 맵만 검사(생략하면 전체)" } }, additionalProperties: false },
  invalidArgsExample: { mapId: "map_field_1" },
  run(project, args) {
    const wanted = typeof args.mapId === "string" && args.mapId.trim() ? args.mapId.trim() : undefined;
    if (wanted && !project.maps[wanted]) throw new ToolError(`맵이 없습니다: ${wanted} — get_project_summary 로 맵 id 를 확인하세요`, { code: "map-not-found", mapId: wanted });
    const maps = wanted ? [project.maps[wanted]!] : Object.values(project.maps).filter((map) => !map.worldmapSource);
    const rows = maps.map((map) => {
      const m = measureMapEmptiness(map);
      return {
        mapId: map.id, name: map.name, size: `${map.width}×${map.height}`, tilesetId: map.tilesetId, flat: m.flat, blank: isBlankMap(map),
        dominantRatio: Math.round(m.dominantRatio * 100) / 100, decorRatio: Math.round(m.decorRatio * 100) / 100, distinctGround: m.distinctGround, events: m.events,
        ...(m.flat ? { next: emptyMapNextStep(map) } : {}),
      };
    });
    const flat = rows.filter((row) => row.flat);
    return {
      summary: flat.length === 0
        ? `맵 ${rows.length}장 모두 단색 빈 판이 아닙니다(바닥 80% 미만이거나 장식 10% 초과).`
        : `단색 빈 판 ${flat.length}/${rows.length}장: ${flat.slice(0, 6).map((row) => `${row.name}(${row.mapId}, 바닥 ${Math.round(row.dominantRatio * 100)}%·장식 ${Math.round(row.decorRatio * 100)}%)`).join(", ")}. ${flat[0]!.next}`,
      data: { maps: rows, flat: flat.map((row) => row.mapId) },
    };
  },
};

export const MAP_EMPTINESS_TOOLS: readonly ToolDefinition[] = [CHECK_MAP_EMPTINESS_TOOL];
