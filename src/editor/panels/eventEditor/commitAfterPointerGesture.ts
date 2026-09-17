// 입력 상자의 change 는 **다른 곳을 누르는 순간**(pointerdown → blur) 발화한다. 그때 store 를 갱신하면
// 편집기 본문이 동기적으로 다시 그려져, 누르던 버튼이 pointerup 전에 교체된다 — click 이 성립하지 않아
// 「이름을 치고 + 를 눌렀는데 아무 일도 없다」가 된다(2026-09-18 실측: 이벤트 이름 → 페이지 추가).
//
// 포인터가 눌린 채면 그 제스처(pointerup + click 디스패치)가 끝난 뒤에 커밋한다. 눌린 게 없으면 즉시.

let pointerDown = false;
let queued: (() => void)[] = [];

function flush(): void {
  const jobs = queued;
  queued = [];
  for (const job of jobs) job();
}

if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("pointerdown", () => { pointerDown = true; }, true);
  const release = (): void => {
    if (!pointerDown) return;
    pointerDown = false;
    // click 은 pointerup 뒤에 디스패치된다 — 한 틱 뒤에 커밋해야 click 이 먼저 도착한다.
    if (queued.length > 0) window.setTimeout(flush, 0);
  };
  window.addEventListener("pointerup", release, true);
  window.addEventListener("pointercancel", release, true);
}

export function commitAfterPointerGesture(commit: () => void): void {
  if (!pointerDown) {
    commit();
    return;
  }
  queued.push(commit);
}
