// 전투 씬이 소유하는 지연 콜백을 한 곳에 모은다.
//
// 왜 필요한가 (2026-09-16 실측, 출하 플레이어): 전투가 끝나 씬이 파괴된 뒤에도
// battleJuice 의 700ms 콜백과 battleTransition 의 300ms 대기가 발화했다. 전자는 이미
// detach 된 root 의 클래스만 지우고 후자는 커버를 페이드아웃해 피해는 없지만, 소유자가
// 사라진 뒤 발화하는 지연 콜백은 "씬 수명 == 타이머 수명" 계약을 깬다.
//
// battleTransition 의 wait 은 예외다 — 그 promise 는 destroy() 가 resolve() 까지 해 줘야
// 한다(clearTimeout 만 하면 await 가 영원히 매달린다). 그래서 전환은 이 스코프를 쓰지 않고
// 자기 timers 맵 + destroy() 로 정리한다.
let active: Set<number> | null = null;

/** 전투가 소유한 지연 콜백. 스코프가 열려 있으면 teardown 이 끊을 수 있게 등록한다. */
export function scheduleBattleTimer(callback: () => void, ms: number): number {
  const id = window.setTimeout(() => {
    active?.delete(id);
    callback();
  }, ms);
  active?.add(id);
  return id;
}

/** 전투 마운트가 스코프를 연다. 이전 스코프가 남아 있으면 먼저 끊는다. */
export function openBattleTimerScope(): void {
  clearBattleTimerScope();
  active = new Set();
}

/** 전투 teardown 이 스코프를 닫고 남은 콜백을 모두 끊는다. */
export function clearBattleTimerScope(): void {
  if (!active) return;
  for (const id of active) window.clearTimeout(id);
  active.clear();
  active = null;
}
