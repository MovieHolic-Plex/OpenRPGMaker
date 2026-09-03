/**
 * 대상 플래시(flash.target === "target")용 SVG 필터.
 *
 * 왜 필터인가: 예전 `.battle-animation-target-flash::after` 는 배틀러 **노드 상자**(rm2000 적 160×180,
 * 대부분 투명)를 통째로 밝혀 스프라이트 둘레에 희끄무레한 사각형이 떴다(실측 2026-09-03, 슬라임 슬래시
 * 임팩트 프레임). CSS 만으로는 요소 자신의 알파로 오려낼 수 없다 — mask 는 정적 원본이라 idle 스트립
 * (영상 키드 프레임, 원본과 다른 순간)과 어긋나고, blend 는 투명 배경 위에서 원색이 그대로 남는다.
 * SVG 필터는 `SourceAlpha` 로 색을 오려 원본 위에 얹는다: RM2000 의 「대상 플래시 = 색을 세기만큼 섞기」
 * 와 같은 산식이고, 정적 `<img>`·idle 스트립 배경·48px 시트 어느 티어든 **그려진 알파**를 그대로 따른다.
 *
 * 색은 `feFlood` 의 `flood-color: var(--battle-flash-color)` 로 받는다. var() 는 필터가 걸린 이미지가
 * 아니라 feFlood 의 조상에서 풀리므로 battleAnimationDom 이 씬 루트에도 같은 변수를 쓴다.
 */
export const BATTLE_FLASH_FILTER_ID = "battle-flash-tint";

const SVG_NS = "http://www.w3.org/2000/svg";

/** 씬 루트에 필터 정의를 한 번 심는다. 이미 있으면 그대로 둔다. */
export function ensureBattleFlashFilter(root: HTMLElement): SVGSVGElement {
  const existing = root.querySelector<SVGSVGElement>("svg.battle-fx-defs");
  if (existing) return existing;
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "battle-fx-defs");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  const filter = document.createElementNS(SVG_NS, "filter");
  filter.id = BATTLE_FLASH_FILTER_ID;
  filter.setAttribute("color-interpolation-filters", "sRGB");
  // 필터 영역을 원본 상자에 맞춘다 — 기본(-10%/120%)이면 오려낸 뒤에도 상자 밖 여백이 남아 무해하지만 비용만 든다.
  filter.setAttribute("x", "0");
  filter.setAttribute("y", "0");
  filter.setAttribute("width", "100%");
  filter.setAttribute("height", "100%");
  const flood = document.createElementNS(SVG_NS, "feFlood");
  flood.setAttribute("result", "tint");
  // 폴백은 예전 오버레이와 같은 45% 흰색(battleAnimationEffectStyle.FLASH_PEAK_ALPHA).
  flood.setAttribute("style", "flood-color: var(--battle-flash-color, rgba(255, 255, 255, 0.45))");
  const cut = document.createElementNS(SVG_NS, "feComposite");
  cut.setAttribute("in", "tint");
  cut.setAttribute("in2", "SourceAlpha");
  cut.setAttribute("operator", "in");
  cut.setAttribute("result", "tint-shape");
  const over = document.createElementNS(SVG_NS, "feComposite");
  over.setAttribute("in", "tint-shape");
  over.setAttribute("in2", "SourceGraphic");
  over.setAttribute("operator", "over");
  filter.append(flood, cut, over);
  svg.append(filter);
  root.append(svg);
  return svg;
}
