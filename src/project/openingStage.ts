// 엔진 무대 오프닝(system.opening.stage) — 새 게임이 무대 맵의 그 칸에서 열리고, 그 맵의 무대 컷신(자동 실행)이 오프닝을 연출한다.
// 무대가 도는 동안 세션 flags 에 `opening:stage:<mapId>:<eventId>` 가 선다. 그 동안 그 맵의 자동·병렬 이벤트는 무대 컷신 하나만 돈다
// (playSceneMapRuntime.activeRuntimeEvents). 무대 컷신 끝의 setFlag false 가 표를 내린다(author_opening_stage 가 붙인다).
import type { Command } from "@/project/types";

export const OPENING_STAGE_FLAG_PREFIX = "opening:stage:";

export function openingStageFlag(mapId: string, eventId: string): string {
  return `${OPENING_STAGE_FLAG_PREFIX}${mapId}:${eventId}`;
}

/** 이 맵에서 지금 도는 무대 컷신 이벤트 id(없으면 undefined). */
export function openingStageEventId(flags: Readonly<Record<string, boolean>>, mapId: string): string | undefined {
  const prefix = `${OPENING_STAGE_FLAG_PREFIX}${mapId}:`;
  for (const key of Object.keys(flags)) if (flags[key] === true && key.startsWith(prefix)) return key.slice(prefix.length);
  return undefined;
}

/** 무대 표를 내리는 명령 — 무대 컷신의 건너뛰기 착지 뒤(꼬리)에 둔다. */
export function clearOpeningStageCommand(mapId: string, eventId: string): Command {
  return { kind: "setFlag", flag: openingStageFlag(mapId, eventId), value: false };
}
