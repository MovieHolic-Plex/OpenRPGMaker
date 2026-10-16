// util/frameBatch.ts
// 같은 프레임 안의 여러 「다시 그려라」를 한 번으로 모은다.
//
// 조수 스트림은 초당 수십 건의 이벤트를 내고, 이벤트마다 구독자가 DOM 을 고치면 프레임마다 스타일·레이아웃이 여러 번 돈다.
// 구독자는 「바뀌었다」만 표시하고 실제 그리기는 다음 프레임 시작에 한 번 한다. 읽기(getBoundingClientRect 등)도 그 한 번 안에서 쓰기보다 먼저 한다.
//
// - 화면이 숨겨져 rAF 가 멈춘 탭에서는 타이머(기본 120ms)가 대신 돈다 — 상태가 영영 갱신되지 않는 일은 없다.
// - rAF 가 없는 환경(헤드리스 테스트)은 동기 실행으로 폴백한다 — 기존 호출 순서가 그대로다.

export interface FrameBatch {
  /** 다음 프레임에 `run` 을 한 번 돌리도록 예약한다. 이미 예약됐으면 아무것도 하지 않는다. */
  schedule(): void;
  /** 예약이 있으면 지금 돌린다(없으면 아무것도 하지 않는다). */
  flush(): void;
  /** 예약을 취소한다. */
  cancel(): void;
  pending(): boolean;
}

export function createFrameBatch(run: () => void, fallbackMs = 120): FrameBatch {
  let raf = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let scheduled = false;
  const clear = (): void => {
    if (raf) { if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(raf); raf = 0; }
    if (timer !== null) { clearTimeout(timer); timer = null; }
  };
  const go = (): void => {
    if (!scheduled) return;
    scheduled = false;
    clear();
    run();
  };
  return {
    schedule(): void {
      if (scheduled) return;
      scheduled = true;
      if (typeof requestAnimationFrame !== "function") { go(); return; }
      raf = requestAnimationFrame(go);
      timer = setTimeout(go, fallbackMs);
    },
    flush: go,
    cancel(): void {
      scheduled = false;
      clear();
    },
    pending: () => scheduled,
  };
}
