// 배치 프리셋 → 실제 마을 전경 한 장.
//
// 프리셋의 값(길 폭·광장 모양·마당 스타일…)은 서로 얽혀 있어서 항목별 설명을 읽어도
// 결과가 그려지지 않는다. 그래서 **진짜 시공기를 돌려** 보여준다 — 화면이 자기 나름의
// 그림을 상상해 그리면 결과와 어긋나고, 어긋난 미리보기는 없는 것보다 나쁘다.
//
// 안전 계약:
//  · 현재 프로젝트를 복제한 초안 위에서만 돈다. `src/editor/tools/village/*` 는 store·DOM·
//    window 를 참조하지 않는 순수 모듈이라(2026-08-31 확인) 초안 변형이 실제 프로젝트로
//    새지 않는다. 미리보기가 맵을 하나 만들지만 그 초안은 그리고 나서 버린다.
//  · 실내·문 이벤트·NPC 는 끈다. 전경 한 장에 보이지 않는 데다 시공 시간의 대부분이
//    거기서 나온다.

import { buildVillageDomain } from "@/editor/tools/village/builder";
import { houseKitTileset } from "@/editor/panels/villageHousePreview";
import type { GameMap, Project, TilesetDef } from "@/project/types";

/** 미리보기 맵 크기(칸). 광장 + 집 여러 채가 들어가는 최소선(MIN_SIZE=20)보다 넉넉하게. */
export const PRESET_PREVIEW_SIZE = 40;

export type PresetPreviewResult =
  | {
      readonly ok: true;
      readonly map: GameMap;
      readonly tileset: TilesetDef;
      readonly housesBuilt: number;
      readonly warnings: readonly string[];
    }
  | { readonly ok: false; readonly reason: string };

/**
 * 프리셋 하나를 초안에 시공하고 결과 맵을 돌려준다. 순수 함수 — 캔버스가 없는 환경에서도
 * 돌아가므로 "프리셋 값이 실제 시공에 먹었는지" 를 유닛 테스트로 볼 수 있다.
 */
export function buildPresetPreview(project: Project, presetId: string, seed: number): PresetPreviewResult {
  const tileset = houseKitTileset(project);
  if (!tileset) return { ok: false, reason: "합본 마을 칩셋을 쓰는 타일셋이 프로젝트에 없습니다." };
  const preset = (project.villagePresets ?? []).find((entry) => entry.id === presetId);
  if (!preset) return { ok: false, reason: `프리셋을 찾을 수 없습니다: ${presetId}` };

  const draft = structuredClone(project) as Project;
  try {
    const built = buildVillageDomain(draft, {
      name: `${preset.name || preset.id} 미리보기`,
      width: PRESET_PREVIEW_SIZE,
      height: PRESET_PREVIEW_SIZE,
      presetId,
      seed,
      interior: false,
      doorEvent: false,
      npcCount: 0,
    });
    const data = (built.data ?? {}) as { mapId?: unknown; housesBuilt?: unknown; warnings?: unknown };
    const mapId = typeof data.mapId === "string" ? data.mapId : "";
    const map = draft.maps[mapId];
    if (!map) return { ok: false, reason: built.summary || "시공 결과 맵을 찾지 못했습니다." };
    return {
      ok: true,
      map,
      // 초안이 만든 맵은 프로젝트 타일셋을 가리키므로 원본 타일셋 정의를 그대로 쓴다.
      tileset: draft.tilesets[map.tilesetId] ?? tileset,
      housesBuilt: typeof data.housesBuilt === "number" ? data.housesBuilt : 0,
      warnings: Array.isArray(data.warnings) ? data.warnings.filter((entry): entry is string => typeof entry === "string") : [],
    };
  } catch (error) {
    // 시공기는 규약 위반에 ToolError 를 던진다 — 미리보기가 탭을 깨뜨리면 안 된다.
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}
