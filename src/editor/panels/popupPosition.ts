type Rect = Pick<DOMRect, "left" | "right" | "top" | "bottom">;
type Size = { readonly width: number; readonly height: number };

/** overflow 컨테이너 밖의 fixed 팝업을 앵커 근처·뷰포트 안에 배치한다. */
export function anchoredPopupPosition(
  anchor: Rect,
  popup: Size,
  viewport: Size,
  gap = 4,
  margin = 8,
): { readonly left: number; readonly top: number } {
  const maxLeft = Math.max(margin, viewport.width - popup.width - margin);
  const left = Math.max(margin, Math.min(anchor.right - popup.width, maxLeft));
  const below = anchor.bottom + gap;
  const above = anchor.top - popup.height - gap;
  const maxTop = Math.max(margin, viewport.height - popup.height - margin);
  const preferredTop = below + popup.height <= viewport.height - margin ? below : above;
  const top = Math.max(margin, Math.min(preferredTop, maxTop));
  return { left: Math.round(left), top: Math.round(top) };
}
