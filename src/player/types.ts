// player/types.ts
// 플레이어 쪽 공용 타입. 인터프리터가 요구하는 세션 인터페이스 등.
// v2: switches/variables/timers/commonEvents 포함.

import type { MapId, Command } from "@/project/types";

// 인터프리터가 요구하는 세션 인터페이스.
// project/session.ts의 PlaySession이 이를 만족.
export interface PlaySessionLike {
  flags: Record<string, boolean>; // 레거시 호환
  switches: Record<string, boolean>;
  variables: Record<string, number>;
  timers: Record<string, number>;
  currentMapId: MapId;
  x: number;
  y: number;
  // 공통 이벤트(callCommonEvent용). Project.commonEvents 참조를 세션에 복사.
  commonEvents?: { id: string; commands: Command[] }[];
}
