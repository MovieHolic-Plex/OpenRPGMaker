// 톱바 한 줄 맞춤 — 왼쪽·가운데·오른쪽 세 묶음이 서로 덮지 않게 한다.
//
// 왜 미디어 쿼리가 아니라 실측인가 (2026-10-21 UI 감사 01-shell-01): 묶음의 폭은 화면 폭만이
// 아니라 언어(영어 「Upper」·「Assistant」), 프로젝트·맵 이름, 저장 문구(「저장 실패」·「Not saved
// (temporary)」)에 따라 달라진다. 폭 경계로 접으면 언어마다 경계를 다시 재야 하고, 놓친 조합에서는
// 넘친 버튼이 옆 칸 버튼 위에 그려져 클릭을 가로챘다. 그래서 실제로 넘칠 때만 단계적으로 접는다.
//
// 단계(누적, CSS `studio-bar.modern.css` 「14. 넘침 맞춤」 이 모양을 소유한다 — 2026-11 개편 배치):
//  1 = 경로의 맵 이름을 걷는다(맵 트리가 이미 말한다).
//  2 = 자료집·소재·조수의 글자를 걷고 아이콘만 둔다(이름은 title·aria-label 이 말한다).
//  3 = 상품 이름표 글자를 걷는다(점 「O」는 남는다).
//  4 = 그래도 넘치면 묶음끼리 겹치지 않게 상단 바를 가로로 민다(200% 확대·아주 좁은 창 — C-19).
const MAX_FIT_LEVEL = 4;

export function installTopbarFit(bar: HTMLElement): () => void {
  if (typeof ResizeObserver === "undefined" || typeof requestAnimationFrame === "undefined") return () => {};
  const boxes = [bar, bar.querySelector(".studio-bar-lead"), bar.querySelector(".studio-bar-center"), bar.querySelector(".editor-topbar-trailing")]
    .filter((node): node is HTMLElement => node instanceof HTMLElement);
  const overflows = (): boolean => boxes.some((box) => box.scrollWidth > box.clientWidth + 1);

  let frame = 0;
  // 매번 접지 않은 상태에서 다시 잰다 — 넓어졌을 때 펼치는 경로도 같은 계산이다.
  const fit = (): void => {
    frame = 0;
    if (!bar.isConnected) return;
    let level = 0;
    bar.dataset.fitLevel = "0";
    while (level < MAX_FIT_LEVEL && overflows()) {
      level += 1;
      bar.dataset.fitLevel = String(level);
    }
  };
  const schedule = (): void => {
    if (frame === 0) frame = requestAnimationFrame(fit);
  };

  // 바 자체(창 폭)와 각 묶음의 자식(번역·프로젝트 이름·맵 이름·저장 문구가 바꾸는 폭)을 본다.
  const observer = new ResizeObserver(schedule);
  observer.observe(bar);
  for (const box of boxes.slice(1)) {
    for (const child of Array.from(box.children)) observer.observe(child);
  }
  return () => {
    observer.disconnect();
    if (frame !== 0) cancelAnimationFrame(frame);
    frame = 0;
  };
}
