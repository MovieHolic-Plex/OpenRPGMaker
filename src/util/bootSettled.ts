/**
 * 첫 화면이 뜰 때까지 미뤄 둘 한가한 일(요약 데우기 같은 것)을 위한 신호.
 *
 * 왜(2026-10-14 실측, 타일셋 379칸 98MB 프로젝트): 로드 직후 걸어 둔 «한가할 때» 일은 `requestIdleCallback(timeout 3s)` 라
 * 편집기 셸이 아직 그려지는 중에도 3초 안에는 반드시 시작해 첫 화면을 3~5초 늦췄다. 편집기 부팅(main.ts)이 이 신호를 켜 두면
 * 첫 화면(부팅 로더 걷힘) 뒤에 시작한다. 켜지 않은 환경(헤드리스·테스트·플레이어·두 번째 호출)은 기다리지 않고 바로 돈다.
 */
const FALLBACK_MS = 45_000;
let expected = false;
let settled = false;
let waiting: Array<() => void> = [];
let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

function flush(): void {
  if (fallbackTimer !== null) clearTimeout(fallbackTimer);
  fallbackTimer = null;
  const queued = waiting;
  waiting = [];
  for (const run of queued) run();
}

/** 편집기 부팅이 시작할 때 한 번. 이후 `afterBootSettled` 는 첫 화면까지 기다린다. */
export function expectBootSettle(): void {
  if (settled) return;
  expected = true;
}

/** 첫 화면이 떴거나 부팅이 실패로 끝났다. 멱등. */
export function markBootSettled(): void {
  if (settled) return;
  settled = true;
  flush();
}

/** 첫 화면 뒤에 부른다. 신호를 켜지 않았거나 이미 떴으면 바로. 끝내 안 오면 45초 뒤에 부른다. */
export function afterBootSettled(run: () => void): void {
  if (!expected || settled) {
    run();
    return;
  }
  waiting.push(run);
  fallbackTimer ??= setTimeout(flush, FALLBACK_MS);
}

/** @internal 테스트 전용 */
export function _resetBootSettledForTest(): void {
  expected = false;
  settled = false;
  waiting = [];
  if (fallbackTimer !== null) clearTimeout(fallbackTimer);
  fallbackTimer = null;
}
