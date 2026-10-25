/**
 * 런타임 창의 「반 줄」·「글자 중간 잘림」을 막는 측정 도우미.
 *
 * 창 안 목록은 남는 높이를 그대로 받으면 마지막 행이 창 테두리에 반쯤 걸린다(상점 J21: 「회복약 60G」 반토막).
 * 문장은 nowrap + 말줄임이면 장비 능력치가 영영 안 보인다. 둘 다 실제 배치를 재서 고친다 —
 * 오버레이는 transform: scale 로 키우므로 크기는 배치 px(offset/client/scroll) 와 BCR 의 비율로 환산한다.
 */

/**
 * 목록 높이를 「다 보이는 행」 경계로 자른다. 넘치지 않으면 손대지 않는다. 행은 그대로 스크롤되며,
 * 선택 행을 block:"nearest" 로 끌어오면 스크롤 위치도 행 경계에 선다(행 높이가 같을 때).
 * 부모 창 크기가 바뀌면(아래 설명창이 두 줄이 되는 등) 다시 잰다.
 */
export function keepWholeRows(list: HTMLElement): void {
  if (typeof ResizeObserver === "undefined") return;
  let watchingParent = false;
  const fit = (): void => {
    if (!list.isConnected) return;
    if (!watchingParent && list.parentElement) {
      observer.observe(list.parentElement);
      watchingParent = true;
    }
    list.style.maxHeight = "";
    const available = list.clientHeight;
    if (available <= 0 || list.scrollHeight <= available + 1) return;
    const listRect = list.getBoundingClientRect();
    const scale = listRect.height > 0 ? listRect.height / list.offsetHeight : 1;
    if (!(scale > 0)) return;
    const contentTop = listRect.top - list.scrollTop * scale;
    let cut = 0;
    for (const row of Array.from(list.children) as HTMLElement[]) {
      const rect = row.getBoundingClientRect();
      if (rect.height <= 0) continue;
      const bottom = (rect.bottom - contentTop) / scale;
      if (bottom <= available + 0.5) cut = Math.max(cut, bottom);
    }
    // 한 행도 통째로 안 들어가면 자르지 않는다(빈 창보다 반 행이 낫다).
    // BCR→배치 px 환산은 offsetHeight(정수) 반올림 오차가 섞인다. 행 경계는 보통 정수 px 이므로 가까운 정수로 붙인다.
    if (cut > 0) list.style.maxHeight = `${Math.round(cut) <= available ? Math.round(cut) : Math.floor(cut)}px`;
  };
  const observer = new ResizeObserver(() => fit());
  observer.observe(list);
}

export type FitTextOptions = {
  /** 먼저 이 줄 수 안에 넣어 본다(글자를 줄여서라도). */
  readonly preferLines: number;
  /** 그래도 넘치면 이 줄 수까지 늘린다. 마지막엔 이 줄 수에서 말줄임. */
  readonly maxLines: number;
  /** 이보다 작게는 줄이지 않는다(도트 글꼴이 뭉개진다). */
  readonly minFontPx: number;
};

/**
 * 문장을 줄 바꿈 + 글자 크기 줄이기로 정해진 줄 수 안에 넣는다. 끝내 안 들어가면 마지막 줄을
 * 온 글자 단위 말줄임(-webkit-line-clamp)으로 끝내고 전문은 title 에 둔다.
 * 요소는 white-space: normal 이고 높이가 내용에 따라 늘어나야 한다.
 */
export function fitTextToLines(node: HTMLElement, options: FitTextOptions): void {
  node.style.fontSize = "";
  node.classList.remove("is-text-clamped");
  node.style.removeProperty("-webkit-line-clamp");
  node.removeAttribute("title");
  if (!node.isConnected || node.clientWidth <= 0 || !node.textContent?.trim()) return;
  const base = parseFloat(getComputedStyle(node).fontSize);
  if (!(base > 0)) return;
  const linesAt = (): number => {
    const style = getComputedStyle(node);
    const size = parseFloat(style.fontSize);
    const lineHeight = parseFloat(style.lineHeight) || size * 1.2;
    return node.scrollHeight / lineHeight;
  };
  for (let lines = options.preferLines; lines <= options.maxLines; lines += 1) {
    for (let px = base; px >= options.minFontPx; px -= 1) {
      node.style.fontSize = px === base ? "" : `${px}px`;
      if (linesAt() <= lines + 0.3) return;
    }
  }
  node.style.fontSize = options.minFontPx < base ? `${options.minFontPx}px` : "";
  node.classList.add("is-text-clamped");
  node.style.setProperty("-webkit-line-clamp", String(options.maxLines));
  node.title = node.textContent ?? "";
}
