// 톱바 한 줄 맞춤 — 왼쪽·가운데·오른쪽 세 묶음이 서로 덮지 않게 한다.
//
// 왜 미디어 쿼리가 아니라 실측인가 (2026-10-21 UI 감사 01-shell-01): 왼쪽 묶음의 폭은 화면 폭만이
// 아니라 언어(영어 「Upper layer」), 프로젝트 이름, 저장 실패 칩, AI 연결 문구에 따라 달라진다.
// 폭 경계로 접으면 언어마다 경계를 다시 재야 하고, 놓친 조합에서는 넘친 버튼이 옆 칸 버튼 위에
// 그려져 클릭을 가로챘다(영어 1440 에서 찾기 → 전투 테스트). 그래서 실제로 넘칠 때만 단계적으로 접는다.
//
// 단계(누적, CSS `studio-bar.modern.css` 「14. 넘침 맞춤」 이 모양을 소유한다):
//  1 = 세계관·음악·찾기 아이콘을 「더 보기 ⋯」 메뉴 하나로 접는다.
//  2 = AI 연결 칩은 점만 남긴다(이름은 title 이 말한다).
//  3 = 레이어 전환·프로젝트 이름의 여백을 줄인다.
const MAX_FIT_LEVEL = 3;

export function installTopbarFit(bar: HTMLElement): () => void {
  if (typeof ResizeObserver === "undefined" || typeof requestAnimationFrame === "undefined") return () => {};
  const boxes = [bar, bar.querySelector(".studio-bar-lead"), bar.querySelector(".editor-topbar-trailing")]
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

  // 바 자체(창 폭)와 각 묶음의 자식(번역·프로젝트 이름·저장 칩·연결 문구가 바꾸는 폭)을 본다.
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
