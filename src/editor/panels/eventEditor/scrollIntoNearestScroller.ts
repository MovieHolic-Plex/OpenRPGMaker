// 대상을 **가장 가까운 스크롤 컨테이너 안에서만** 보이게 한다.
//
// `element.scrollIntoView()` 는 스크롤 가능한 모든 조상을 함께 밀어 올린다 — overflow:hidden 인
// 워크벤치도 프로그램 스크롤은 되기 때문에, 경고 항목을 누르면 3열 컨테이너 전체가 올라가
// 「이 페이지 설정 / 이 페이지가 하는 일」 열 머리가 잘렸다(2026-09-17 적대적 리뷰 P1-11).
// 여기서는 실제로 스크롤바가 있는(overflow auto/scroll + 넘치는) 첫 조상만 움직���다.

export function scrollIntoNearestScroller(target: HTMLElement, block: "center" | "nearest" = "center"): void {
  if (typeof getComputedStyle !== "function") return;
  let scroller: HTMLElement | null = target.parentElement;
  while (scroller) {
    const style = getComputedStyle(scroller);
    const scrollable = /(auto|scroll)/u.test(style.overflowY) && scroller.scrollHeight > scroller.clientHeight + 1;
    if (scrollable) break;
    scroller = scroller.parentElement;
  }
  if (!scroller) return;
  const targetRect = target.getBoundingClientRect();
  const hostRect = scroller.getBoundingClientRect();
  if (block === "nearest" && targetRect.top >= hostRect.top && targetRect.bottom <= hostRect.bottom) return;
  const offset = targetRect.top - hostRect.top;
  const next = block === "center"
    ? scroller.scrollTop + offset - (hostRect.height - targetRect.height) / 2
    : targetRect.top < hostRect.top
      ? scroller.scrollTop + offset
      : scroller.scrollTop + (targetRect.bottom - hostRect.bottom);
  scroller.scrollTop = Math.max(0, next);
}
