// editor/tools/sceneStageGuard.ts
// build_scene_setting 이 지은 무대의 초점·동선(이벤트 칸 둘레 2칸, 생존 걷기 길, 다리·둑길·참배로)을 로케이션으로 남기고,
// 그 위에 조수가 stamp_object·place_props 로 소품을 덧찍지 못하게 한다.
// 왜(2026-10-18 authentic-pilot 사용자 피드백 «기물 배치가 엉망»): 대칭으로 짠 무대 한가운데·동선 위에 1×1 뼈·잔해가 흩어져
// 무대가 «아무렇게나 뿌린 잡동사니» 로 읽혔다. 무대가 비워 둔 칸은 용도로 비운 칸이다.

import type { GameMap, Rect } from "@/project/types";
import { ToolError } from "./types";

export const SCENE_STAGE_TAG = "scene-stage";

export function rejectOnSceneStage(map: GameMap, rect: Rect, tool: string): void {
  const hit = (map.locations ?? []).filter((l) => (l.tags ?? []).includes(SCENE_STAGE_TAG)
    && l.x < rect.x + rect.w && rect.x < l.x + l.w && l.y < rect.y + rect.h && rect.y < l.y + l.h);
  if (!hit.length) return;
  const zones = hit.map((l) => `${l.name} (${l.x},${l.y}) ${l.w}×${l.h}`).join(", ");
  throw new ToolError(
    `${tool} 영역 (${rect.x},${rect.y}) ${rect.w}×${rect.h} 이 build_scene_setting 무대의 보호 구역 ${zones} 과 겹친다 — `
    + "무대의 초점·동선은 비워 둔 칸이라 소품을 얹지 않는다. 연출 인물·사물은 upsert_event 로 이벤트에 두고, 소품은 보호 구역 밖에 찍는다.",
    { code: "scene-stage-protected", mapId: map.id },
  );
}
