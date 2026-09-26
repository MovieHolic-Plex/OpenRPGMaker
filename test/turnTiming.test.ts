// 턴 단계 기록기의 계약을 잠근다.
//
// 실측 배경(2026-09-26): 읽기 전용 3턴 Pi 실행의 벽시계는 thinking low 6.36s/7.41s, high 9.09s/8.47s 였고
// 로컬 도구 실행은 ~0ms 였다. 즉 시간은 «모델 호출이 몇 번 돌았나» 에 있고, 같은 단계가 한 턴에
// 여러 번 돈다(쓰기 도구마다 체크포인트, 맵마다 검수). 누적이 깨지면 12번 돈 단계가 1번짜리로
// 보여 병목이 표에서 사라진다.
import { describe, expect, it } from "vitest";
import { createTurnTiming } from "@/ai/turnTiming";

/** 테스트 시계 — 눌러 둔 값만 흐르므로 sleep 없이 구간 길이를 정확히 고정한다. */
function fakeClock(): { now: () => number; advance: (ms: number) => void } {
  let value = 0;
  return {
    now: () => value,
    advance: (ms) => {
      value += ms;
    },
  };
}

describe("createTurnTiming", () => {
  it("같은 단계가 여러 번 돌면 ms 를 합산한다", () => {
    const clock = fakeClock();
    const timing = createTurnTiming(clock.now);

    timing.start("checkpoint");
    clock.advance(120);
    timing.end("checkpoint");
    clock.advance(5);
    timing.start("review");
    clock.advance(40);
    timing.end("review");
    timing.start("checkpoint");
    clock.advance(80);
    timing.end("checkpoint");

    const record = timing.snapshot();
    // 마지막 값(80)이 아니라 합(200)이다 — 이게 이 모듈의 존재 이유다.
    expect(record.stages).toEqual([
      { name: "checkpoint", ms: 200 },
      { name: "review", ms: 40 },
    ]);
    // 열 순서는 «처음 열린 순서» 다. checkpoint 가 나중에 또 돌아도 앞자리를 유지한다.
    expect(record.stages.map((stage) => stage.name)).toEqual(["checkpoint", "review"]);
    expect(record.totalMs).toBe(245);
  });

  it("start 없는 end 는 무시한다", () => {
    const clock = fakeClock();
    const timing = createTurnTiming(clock.now);

    clock.advance(10);
    timing.end("never-opened");
    timing.start("model");
    clock.advance(30);
    timing.end("model");
    // 오류 경로에서 finally 가 한 번 더 닫는 상황 — 두 번째 end 가 합을 늘리면 안 된다.
    clock.advance(500);
    timing.end("model");

    const record = timing.snapshot();
    expect(record.stages).toEqual([{ name: "model", ms: 30 }]);
  });

  it("snapshot 은 반복 호출해도 상태를 바꾸지 않는다", () => {
    const clock = fakeClock();
    const timing = createTurnTiming(clock.now);

    timing.start("model");
    clock.advance(50);
    timing.end("model");

    const first = timing.snapshot();
    const second = timing.snapshot();
    expect(second.stages).toEqual(first.stages);
    // totalMs 만 시계를 따라 늘어난다(구간 합은 그대로) — 스냅샷이 누적을 비우지 않는 증거다.
    clock.advance(70);
    const third = timing.snapshot();
    expect(third.stages).toEqual(first.stages);
    expect(third.totalMs).toBe(first.totalMs + 70);

    // 이어서 같은 단계를 더 돌리면 앞선 스냅샷이 아니라 기록기의 누적에 더해진다.
    timing.start("model");
    clock.advance(20);
    timing.end("model");
    expect(timing.snapshot().stages).toEqual([{ name: "model", ms: 70 }]);
    expect(first.stages).toEqual([{ name: "model", ms: 50 }]);
  });

  it("start 가 한 번도 없으면 totalMs 0, 단계 없음", () => {
    const clock = fakeClock();
    const timing = createTurnTiming(clock.now);
    clock.advance(1_000);

    const record = timing.snapshot();
    expect(record.totalMs).toBe(0);
    expect(record.stages).toEqual([]);
  });
});
