/**
 * 필드 HUD 가 비키는 규칙 — 화면에 늘 떠 있는 창(HUD 위젯·목표 창·미니맵…)은 플레이어가 지금 봐야 하는 것을 가리지 않는다.
 *
 *  1) 주인공과 그 둘레 한 칸(마주 본 것·말을 걸 대상·길을 막은 것은 늘 이 안에 있다), 그 칸에 선 사람·적의 그림 — 창이 이것을 덮으면 그동안 흐려진다.
 *  2) 잠깐 뜨는 알림(「새 목표」 카드·지역 알림·토스트)과 겹친 창은 그 알림이 떠 있는 동안 숨는다 — 알림과 상시 창이 겹쳐 보이지 않는다.
 *
 * 창은 자리를 옮기지 않는다(자리가 뛰면 어디를 봐야 할지 모른다). 저작한 자리 그대로 두고 투명도만 바꾼다.
 * 왜(2026-11-12 증기의 심장 직접 플레이): 「동료」 판 밑에서 주인공이 출발했고, 판 밑의 통에 세 번 막혔고, 여관에서는 주인도 주인공도 안 보였다.
 */
export type YieldRect = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
export type HudYieldState = "fade" | "hide" | null;

const overlaps = (a: YieldRect, b: YieldRect, pad = 0): boolean =>
  a.x < b.x + b.width + pad && a.x + a.width + pad > b.x && a.y < b.y + b.height + pad && a.y + a.height + pad > b.y;

/**
 * 창 하나의 상태. `was` 는 지금 상태 — 이미 비킨 창은 가장자리에서 깜빡이지 않게 조금 더 넉넉히(stick px) 본다.
 */
export function hudYieldState(panel: YieldRect, protect: readonly YieldRect[], banners: readonly YieldRect[], was: HudYieldState = null, stick = 3): HudYieldState {
  if (banners.some((banner) => overlaps(panel, banner, was === "hide" ? stick : 0))) return "hide";
  if (protect.some((rect) => overlaps(panel, rect, was === "fade" ? stick : 0))) return "fade";
  return null;
}

/** 비키는 창들 — 화면에 고정된 상시 UI. 대사창·메뉴·전투 화면은 HUD 를 통째로 숨기므로 여기 없다. */
const PANEL_SELECTOR = [
  ".field-hud > .hud-widget:not([hidden])",
  ".zone-feedback > .zone-feedback-objective:not([hidden])",
  ".action-hud", ".hand-slot", ".runtime-time-hud", "[data-testid='minimap-root']",
].join(",");
/** 잠깐 뜨는 알림 — 겹친 상시 창을 숨긴다. */
const BANNER_SELECTOR = [
  ":scope > .objective-card:not([hidden])",
  ".zone-feedback > .zone-feedback-banner:not([hidden])",
  ".zone-feedback > .zone-feedback-toast:not([hidden])",
].join(",");

function hostRects(host: HTMLElement, selector: string): { node: HTMLElement; rect: YieldRect }[] {
  const hostRect = host.getBoundingClientRect();
  const scale = hostRect.width > 0 && host.clientWidth > 0 ? hostRect.width / host.clientWidth : 1;
  const out: { node: HTMLElement; rect: YieldRect }[] = [];
  for (const node of host.querySelectorAll<HTMLElement>(selector)) {
    if (node.offsetParent === null) continue;
    const r = node.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    out.push({ node, rect: { x: (r.x - hostRect.x) / scale, y: (r.y - hostRect.y) / scale, width: r.width / scale, height: r.height / scale } });
  }
  return out;
}

/**
 * 호스트 안의 상시 창마다 `data-yield` 를 건다(fade · hide · none). 투명도는 CSS 가 바꾼다(fieldHud.css).
 * `protect` 는 호스트 논리 px. 목표 카드가 떠 있으면 목표 창은 겹치지 않아도 숨는다 — 같은 글이 두 군데 뜨지 않는다.
 */
export function applyHudYield(host: HTMLElement, protect: readonly YieldRect[]): void {
  const banners = hostRects(host, BANNER_SELECTOR);
  const card = banners.some(({ node }) => node.classList.contains("objective-card"));
  const bannerRects = banners.map(({ rect }) => rect);
  for (const { node, rect } of hostRects(host, PANEL_SELECTOR)) {
    const was = node.dataset.yield === "fade" || node.dataset.yield === "hide" ? node.dataset.yield : null;
    const next = card && node.classList.contains("zone-feedback-objective") ? "hide" : hudYieldState(rect, protect, bannerRects, was);
    // 「none」 을 남겨 둔다 — 속성이 있어야 돌아올 때도 투명도 전환이 걸린다.
    const value = next ?? "none";
    if (node.dataset.yield !== value) node.dataset.yield = value;
  }
}
