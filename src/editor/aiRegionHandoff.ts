// 선택 영역 → 조수 채팅으로 넘기기. 우클릭 드래그 바·영역 메뉴·검사 패널·캔버스 AI 버튼이 모두 이 한 곳을 지난다.
//
// 예전에는 이 입구들이 «영역 작업» 창(regionTaskModal)을 따로 열었다. 바에 문장을 치고 Enter 를 눌러도
// 같은 문장이 든 큰 창이 한 번 더 떠서 실행 버튼을 다시 눌러야 했고, 그 창은 채팅과 다른 파이프라인이라
// 진행·중단·기록이 둘로 갈렸다. 이제 영역은 채팅 턴의 범위(선택 칩)로만 붙고, 실행은 채팅 한 경로다.
import type { MapId } from "@/project/types";

export const AI_REGION_HANDOFF_EVENT = "oprn:ai-region-handoff";

export interface AiRegionHandoff {
  readonly mapId: MapId;
  readonly region: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  /** 보낼 문장. 없으면 입력줄에 초점만 준다. */
  readonly instruction?: string;
  /** false 면 문장을 입력줄에 담아 두고 보내지 않는다(사용자가 고친 뒤 보낸다). 기본 true. */
  readonly autoRun?: boolean;
  /** true 면 바로 깔기로 보낸다. 없으면 입력줄의 현재 바로 깔기 설정을 따른다. */
  readonly stamp?: boolean;
}

export function requestAiRegionHandoff(handoff: AiRegionHandoff): void {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") return;
  let event: Event;
  if (typeof CustomEvent === "function") {
    event = new CustomEvent<AiRegionHandoff>(AI_REGION_HANDOFF_EVENT, { detail: handoff });
  } else {
    event = new Event(AI_REGION_HANDOFF_EVENT);
    Object.defineProperty(event, "detail", { configurable: true, value: handoff });
  }
  window.dispatchEvent(event);
}

export function aiRegionHandoffDetail(event: Event): AiRegionHandoff | null {
  const detail = (event as CustomEvent<unknown>).detail as Partial<AiRegionHandoff> | null | undefined;
  if (!detail || typeof detail !== "object" || typeof detail.mapId !== "string") return null;
  const region = detail.region;
  if (!region || ![region.x, region.y, region.width, region.height].every(Number.isInteger)) return null;
  if (region.width < 1 || region.height < 1) return null;
  return {
    mapId: detail.mapId,
    region: { x: region.x, y: region.y, width: region.width, height: region.height },
    ...(typeof detail.instruction === "string" ? { instruction: detail.instruction } : {}),
    ...(typeof detail.autoRun === "boolean" ? { autoRun: detail.autoRun } : {}),
    ...(typeof detail.stamp === "boolean" ? { stamp: detail.stamp } : {}),
  };
}

/**
 * 옛 «영역 작업 창 열기» 호출 모양을 그대로 받는 어댑터. 호출자(주입 가능한 deps)의 시그니처를 바꾸지 않고
 * 목적지만 채팅으로 돌린다. `initialInstruction` + `autoRun` 의 뜻은 창과 같다.
 */
export function openRegionInAssistant(options: {
  readonly mapId: MapId;
  readonly region: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly initialInstruction?: string;
  readonly autoRun?: boolean;
}): void {
  const instruction = options.initialInstruction?.trim();
  requestAiRegionHandoff({
    mapId: options.mapId,
    region: options.region,
    ...(instruction ? { instruction } : {}),
    autoRun: options.autoRun === true,
    stamp: false,
  });
}
