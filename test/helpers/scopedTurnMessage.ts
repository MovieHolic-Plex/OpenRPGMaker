// 스코프 턴(선택 영역이 걸린 조수 턴)이 실제로 모델에 보내는 사용자 메시지를 조립한다.
//
// 왜 헬퍼인가 — 예전에는 `runRegionTask.buildRegionTaskMessage` 하나가 "지시 + 가이드 + 푸터"를
// 통째로 만들었고, 도구 노출·프롬프트 회귀 테스트가 그 문자열을 잣대로 썼다. 통합 후에는
// `aiChatPanel.sendText` 가 세 조각(지시 / buildTurnGuide / contextFooter)을 합치고 가이드만
// 순수 함수로 남았다. 테스트가 보려는 것은 **합쳐진 결과**(도구 노출 계산은 footer 의 "맵"
// 같은 단어까지 본다)이므로, 그 조립을 여기 한 곳에서만 재현한다.
import { buildTurnGuide } from "@/ai/turnGuide";
import type { MapId, TilesetDef } from "@/project/types";

export interface ScopedRegion {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** aiChatPanel.contextFooter 와 같은 포맷(buildSpec.ts 의 정규식이 파싱한다). */
export function scopedContextFooter(mapName: string, mapId: MapId, region: ScopedRegion): string {
  return `[컨텍스트] 현재 맵: ${mapName} (${mapId}) · 사용자 선택 영역: (${region.x},${region.y}) ${region.width}×${region.height}`;
}

export function buildScopedTurnMessage(
  instruction: string,
  mapName: string,
  mapId: MapId,
  region: ScopedRegion,
  tileset?: TilesetDef,
): string {
  const guide = buildTurnGuide({ instruction, tileset, scope: { mapId, region } });
  return [instruction.trim(), guide, scopedContextFooter(mapName, mapId, region)]
    .filter((part) => part.length > 0)
    .join("\n\n");
}
