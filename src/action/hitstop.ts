// 히트스톱(타격 순간의 아주 짧은 시간 정지) 계산 순수 함수.
// 게임 전체를 얼리지 않고 액션 전투 갱신만 잠깐 건너뛰는 데 쓴다.

export interface HitstopConsumeResult {
  readonly nextRemainingMs: number;
  readonly skipUpdate: boolean;
}

// 남은 히트스톱 시간에서 이번 프레임 deltaMs 를 소비한다.
// remainingMs 가 양수면 이번 프레임 갱신을 건너뛴다(skipUpdate=true).
// deltaMs 를 빼고 0 아래로는 내려가지 않는다.
export function consumeHitstop(remainingMs: number, deltaMs: number): HitstopConsumeResult {
  if (remainingMs <= 0) return { nextRemainingMs: 0, skipUpdate: false };
  return { nextRemainingMs: Math.max(0, remainingMs - deltaMs), skipUpdate: true };
}
