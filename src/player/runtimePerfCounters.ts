// player/runtimePerfCounters.ts
// 런타임 프레임 예산을 갉아먹는 **재생성** 횟수를 센다.
//
// 왜 존재하나: 「움직임이 불안정하다」는 보고는 대개 프레임 한 번이 늦어진 것이 아니라
// 맵 타일 1만~2만 개를 통째로 파괴·재생성하거나 카메라를 강제로 다시 붙이는(startFollow 는
// 스크롤을 대상 좌표로 스냅한다) 호출이 이벤트 스텝마다 반복된 결과다. 그 횟수는 화면을
// 봐서는 셀 수 없고, 프로파일러 없이 QA 하네스가 읽을 수 있는 숫자여야 한다.
//
// 계측은 값을 올리기만 한다 — 게임 동작에는 아무 영향이 없고, 출하 플레이어에서도 켜져
// 있지만 정수 몇 개를 올리는 비용뿐이다(`__oprnPerf` 훅은 QA 계측 부팅에서만 붙는다).

export interface RuntimePerfCounters {
  /** update() 호출 수 — 다른 계수의 분모. */
  frames: number;
  /** renderTiles 가 실제로 타일 GameObject 를 전부 다시 만든 횟수. */
  tileRebuilds: number;
  /** renderTiles 가 서명 일치로 재생성을 건너뛴 횟수. */
  tileRebuildsSkipped: number;
  /** 타일 계층에 만들어진 GameObject 누계(타일·쿼터·오버레이). */
  tileObjectsCreated: number;
  /** 이벤트 스프라이트 계층을 통째로 다시 만든 횟수. */
  eventLayerRebuilds: number;
  /** 카메라 startFollow 가 실제로 호출된 횟수(호출마다 스크롤이 스냅된다). */
  cameraRefollows: number;
  /** 같은 대상을 이미 따르고 있어 startFollow 를 생략한 횟수. */
  cameraRefollowsSkipped: number;
}

export function createRuntimePerfCounters(): RuntimePerfCounters {
  return {
    frames: 0,
    tileRebuilds: 0,
    tileRebuildsSkipped: 0,
    tileObjectsCreated: 0,
    eventLayerRebuilds: 0,
    cameraRefollows: 0,
    cameraRefollowsSkipped: 0,
  };
}

/** 계수기가 있으면 올린다 — 최소 컨텍스트로 도는 테스트 스텁은 계수기가 없다. */
export function bumpPerfCounter(
  host: { perfCounters?: RuntimePerfCounters } | undefined,
  key: keyof RuntimePerfCounters,
  amount = 1,
): void {
  const counters = host?.perfCounters;
  if (!counters) return;
  counters[key] += amount;
}
