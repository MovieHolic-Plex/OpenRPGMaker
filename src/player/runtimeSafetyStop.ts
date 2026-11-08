/**
 * 테스트 안전 레일 — 끝나지 않는 실행을 멈춘 기록.
 *
 * 인터프리터의 명령·루프·스택 예산과 「걸음 없이 같은 자동 실행이 계속 다시 켜짐」은 예전에 조용히 끝나거나
 * (console.warn 만 남김) 게임을 영원히 잠갔다. 조수가 만든 이벤트가 「안 돌아간다」를 사람과 도구가 같이 읽도록
 * 이유를 이 한 모양으로 남긴다. 사람은 테스트 플레이 화면의 알림으로, 도구는 상태 JSON·장면 테스트 결과로 읽는다.
 */
export type RuntimeSafetyStopKind = "instruction-budget" | "loop-budget" | "stack-budget" | "autorun-repeat";

export interface RuntimeSafetyStop {
  readonly kind: RuntimeSafetyStopKind;
  readonly limit: number;
  readonly eventId?: string;
  readonly commonEventId?: string;
  readonly mapId?: string;
  /** 사람에게 보이는 한 줄(한국어 정본). */
  readonly message: string;
}

/** 같은 자동 실행이 플레이어가 한 걸음도 걷지 않은 채 다시 시작될 수 있는 횟수. 넘으면 그 자동 실행을 세운다. */
export const AUTORUN_REPEAT_LIMIT = 10;
/** 한 세션에 쌓아 두는 기록 수. */
export const SAFETY_STOP_HISTORY_LIMIT = 20;

export function safetyStopMessage(stop: Omit<RuntimeSafetyStop, "message">): string {
  const owner = stop.commonEventId ? `공용 이벤트 ${stop.commonEventId}` : stop.eventId ? `이벤트 ${stop.eventId}` : "이벤트";
  switch (stop.kind) {
    case "instruction-budget":
      return `${owner}: 명령을 ${stop.limit}번 실행해도 끝나지 않아 멈췄습니다. 끝나는 조건이나 「반복 중단」을 확인하세요.`;
    case "loop-budget":
      return `${owner}: 반복이 ${stop.limit}번 돌아도 끝나지 않아 빠져나왔습니다. 반복 안에 「반복 중단」이 있는지 확인하세요.`;
    case "stack-budget":
      return `${owner}: 이벤트 호출이 ${stop.limit}단 넘게 겹쳐 멈췄습니다. 자기 자신을 부르는 호출을 확인하세요.`;
    case "autorun-repeat":
      return `${owner}: 자동 실행이 걸음 없이 ${stop.limit}번 다시 시작돼 멈췄습니다. 실행 뒤 스위치를 꺼서 자동 실행을 끝내세요.`;
  }
}

export function createSafetyStop(stop: Omit<RuntimeSafetyStop, "message">): RuntimeSafetyStop {
  return { ...stop, message: safetyStopMessage(stop) };
}
