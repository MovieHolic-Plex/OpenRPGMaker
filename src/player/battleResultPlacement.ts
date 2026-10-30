/**
 * 결과 상자가 아군 배틀러를 덮지 않게 옆으로 비킨다.
 *
 * 결과 상자는 무대 가운데(left 50%·translate -50%)에 뜬다. 측면 전투는 아군이 오른쪽에 대각선으로 서므로
 * 뒷줄 맨 앞(보통 주인공)이 상자 오른쪽 끝 아래에 깔려 승리 화면에서 주인공만 사라진 것처럼 보였다
 * (이세계 고딩 첫인상 리뷰 2026-10-30: 민재가 살아 있는데 결과 창에 에델·피오만 보였다).
 * 적은 이미 쓰러져 비어 있는 쪽으로 상자를 미는 것으로 충분하다 — 상자 크기·글자는 건드리지 않는다.
 *
 * CSS `translate` 속성만 쓴다. 상자의 등장 애니메이션은 `transform` 을 움직이므로 서로 덮어쓰지 않는다.
 * 레이아웃을 한 번 읽는다(결과 상자가 처음 생길 때만 부른다).
 */
export function keepResultPanelOffParty(root: HTMLElement, panel: HTMLElement): void {
  if (root.dataset.battleUiStyle === "pokemon") return;
  panel.style.removeProperty("translate");
  const scene = root.getBoundingClientRect();
  const box = panel.getBoundingClientRect();
  if (!(box.width > 0 && scene.width > 0)) return;
  const actors = [...root.querySelectorAll<HTMLElement>(".battle-actor-group .battle-actor")]
    .filter((node) => !node.classList.contains("defeated"))
    .map((node) => node.getBoundingClientRect())
    .filter((rect) => rect.width > 0 && rect.height > 0);
  // 그림 칸에는 투명 여백이 있다 — 몸통 가운데 절반만 「보여야 할 자리」로 본다.
  const bodies = actors.map((rect) => ({
    left: rect.left + rect.width * 0.25,
    right: rect.right - rect.width * 0.25,
    top: rect.top + rect.height * 0.2,
    bottom: rect.bottom,
  }));
  const hidden = bodies.filter((body) => body.right > box.left && body.left < box.right && body.bottom > box.top && body.top < box.bottom);
  if (hidden.length === 0) return;
  const gap = 8;
  const margin = 8;
  const partyRight = (hidden.reduce((sum, body) => sum + body.left + body.right, 0) / hidden.length / 2) > box.left + box.width / 2;
  let dx = partyRight
    ? Math.min(...hidden.map((body) => body.left)) - gap - box.right
    : Math.max(...hidden.map((body) => body.right)) + gap - box.left;
  // 무대 밖으로는 밀지 않는다 — 못 비키면 갈 수 있는 데까지만.
  dx = partyRight ? Math.max(dx, scene.left + margin - box.left) : Math.min(dx, scene.right - margin - box.right);
  if ((partyRight && dx >= 0) || (!partyRight && dx <= 0)) return;
  // 무대가 정수배로 늘려 그려질 수 있다 — 화면 px 를 상자의 CSS px 로 되돌린다.
  const scale = panel.offsetWidth > 0 ? box.width / panel.offsetWidth : 1;
  panel.style.translate = `${Math.round(dx / (scale || 1))}px 0`;
  panel.dataset.resultAvoidsParty = "true";
}
