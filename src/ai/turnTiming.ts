// 어시스턴트 턴 한 번을 «단계별 벽시계» 로 쪼개는 순수 기록기. DOM·스토어·piAgent 를 모르므로
// 패널·헤드리스 도구·테스트가 같은 구현을 함께 쓴다.
//
// 실측(2026-09-26, 로컬 동반자 127.0.0.1:17832 직결, gemini-3.8-flash): 읽기 전용 3턴 Pi 실행이
// thinking low 6.36s/7.41s, high 9.09s/8.47s 였고 도구 실행 자체는 ~0ms(로컬)였다. 즉 턴의 벽시계는
// 사실상 모델 호출의 합이다 — 어느 단계가 몇 번 돌아 얼마를 먹었는지 이름별로 더해야 병목이 보인다.

export interface TurnTimingStage {
  readonly name: string;
  readonly ms: number;
}

export interface TurnTimingRecord {
  readonly totalMs: number;
  readonly stages: readonly TurnTimingStage[];
}

export interface TurnTimingRecorder {
  start(name: string): void;
  end(name: string): void;
  snapshot(): TurnTimingRecord;
}

/** 기본 시계는 단조 시계다 — 시스템 시각이 뒤로 점프해도 구간이 음수가 되지 않는다. */
function defaultNow(): number {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

type StageState = {
  /** 닫힌 구간의 합. 같은 이름이 N 번 돌면 N 개 구간이 여기에 더해진다. */
  accumulatedMs: number;
  /** 열려 있는 start 의 시각들(LIFO). 중첩·재개를 허용하므로 스택이어야 한다. */
  readonly openAt: number[];
};

/**
 * 누적(마지막 값 덮어쓰기가 아니라 합)이 계약인 이유: 한 턴에서 같은 단계가 여러 번 돈다 —
 * 쓰기 도구마다 체크포인트 하나, 맵마다 검수 호출 하나. 우리가 보고해야 하는 비용은
 * "마지막 체크포인트가 얼마였나" 가 아니라 "그 단계가 이 턴에서 다 합쳐 얼마를 먹었나" 다.
 * 덮어쓰기로 적으면 12번 돈 단계가 1번짜리로 보여 병목이 표에서 사라진다.
 */
export function createTurnTiming(now: () => number = defaultNow): TurnTimingRecorder {
  // Map 은 삽입 순서를 보존한다 — 표의 열 순서가 «처음 열린 순서» 라는 계약을 이걸로 지킨다.
  const stages = new Map<string, StageState>();
  let firstStartAt: number | undefined;

  return {
    start(name) {
      const at = now();
      if (firstStartAt === undefined) firstStartAt = at;
      const state = stages.get(name);
      if (state) {
        state.openAt.push(at);
        return;
      }
      stages.set(name, { accumulatedMs: 0, openAt: [at] });
    },
    end(name) {
      const at = now();
      const state = stages.get(name);
      const openAt = state?.openAt.pop();
      // 짝 없는 end 는 무시한다 — 오류 경로에서 finally 가 한 번 더 닫는 일이 실제로 생기고,
      // 그때 근거 없는 구간을 합에 더하는 것보다 그 end 를 버리는 쪽이 정직하다.
      if (!state || openAt === undefined) return;
      state.accumulatedMs += at - openAt;
    },
    snapshot() {
      // 읽기 전용이다 — 열린 구간을 닫지도, 누적을 비우지도 않으므로 턴 중간에 몇 번이든 찍는다.
      const at = now();
      const rows = [...stages].map(([name, state]) => ({ name, ms: Math.round(state.accumulatedMs) }));
      return {
        totalMs: firstStartAt === undefined ? 0 : Math.round(at - firstStartAt),
        stages: rows,
      };
    },
  };
}
