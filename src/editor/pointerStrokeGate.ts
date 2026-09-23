// editor/pointerStrokeGate.ts
// 누른 채 끄는 동안(칠하기·지우기 스트로크) 미뤄도 되는 무거운 후속 작업을 손을 뗄 때까지 미룬다.
//
// 왜(2026-09-23 실측, 기본 100×100 마을): 스트로크는 칸을 넘을 때마다 store emit 을 낸다.
// 도구막대(=좌측 팔레트 전체)·규칙 감사·숨은 내보내기 미러가 그때마다 디바운스 타이머를 걸었는데,
// 천천히 끄는 드래그는 칸 사이가 200ms 를 넘어 어떤 시간 창으로도 묶이지 않았다 — 칠하는 도중에
// 팔레트 재구축(100~200ms)·직렬화가 끼어들어 붓이 끊겼다. 스트로크 중에는 이들 화면에 바뀔
// 것이 없으므로(배지·미러는 끝난 뒤 맞으면 된다) 시간 대신 «손을 뗐는가» 로 묶는다.
//
// 캡처 단계의 window 리스너라 캔버스·오버레이 어느 쪽이 이벤트를 삼켜도 본다. 창 밖에서 손을
// 떼 pointerup 이 안 오는 경우를 위해 blur 도 해제로 친다.

let installed = false;
let pointerHeld = false;
const deferred = new Set<() => void>();

function install(): void {
  if (installed || typeof window === "undefined" || typeof window.addEventListener !== "function") return;
  installed = true;
  window.addEventListener("pointerdown", () => { pointerHeld = true; }, true);
  window.addEventListener("pointerup", release, true);
  window.addEventListener("pointercancel", release, true);
  window.addEventListener("blur", release);
}

function release(): void {
  pointerHeld = false;
  if (deferred.size === 0) return;
  const tasks = [...deferred];
  deferred.clear();
  // 뗀 순간의 프레임(마지막 칸)이 먼저 그려지게, 미룬 일은 각자 다음 매크로태스크로 흩는다.
  // 한 핸들러에서 몰아 돌리면 팔레트 재구축+직렬화가 하나의 긴 태스크가 된다.
  for (const task of tasks) setTimeout(task, 0);
}

/**
 * 포인터를 누르고 있지 않으면 지금 실행하고, 누르고 있으면 뗄 때 한 번 실행한다.
 * 같은 함수를 여러 번 미뤄도 뗄 때 한 번만 돈다.
 */
export function runWhenPointerReleased(task: () => void): void {
  install();
  if (!pointerHeld) {
    task();
    return;
  }
  deferred.add(task);
}

/** 모듈을 불러온 순간부터 누름 상태를 본다 — 첫 스트로크의 pointerdown 을 놓치지 않게. */
export function installPointerStrokeGate(): void {
  install();
}

export function resetPointerStrokeGateForTests(): void {
  pointerHeld = false;
  deferred.clear();
}
