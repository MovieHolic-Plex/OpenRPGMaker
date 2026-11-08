// Whether a text element the player script measured is actually drawn for the player. The overflow / off-screen
// checks in vm/player.mjs only measure elements this returns null for.
//
// `chain` is the element's computed-style snapshot followed by each ancestor's, up to the app root:
//   { cls, display, visibility, opacity, clip, clipPath, overflow, w, h }
// The function runs both in Node (tests) and inside the page (injected by vm/player.mjs as source), so it must stay
// self-contained: no imports, no closures over module state.
//
// Hidden on purpose:
//   - display:none on the element or any ancestor
//   - visibility hidden/collapse (computed, so already inherited) or opacity 0 on the element or any ancestor
//   - a clip / clip-path on the element itself (screen-reader-only text)
//   - an ancestor that clips everything: clip-path inset(>=50%) or the 1px overflow-hidden "visually hidden" box,
//     e.g. the pixel shop preset that keeps the key-hint row for focus/tests but removes it from the screen
//     (src/styles/runtime/shop.css `.runtime-shop-preset-pixel :is(.runtime-shop-topbar, .runtime-shop-prompt-panel)`)
//   - sr-only / visually-hidden class anywhere in the chain
// A decorative clip-path on an ancestor (a polygon panel edge) does not hide the text inside it.
export function hiddenReason(chain) {
  const fullInset = (v) => {
    const m = /^inset\(\s*([\d.]+)(%|px)?/.exec(v ?? "");
    return !!m && m[2] === "%" && Number(m[1]) >= 50;
  };
  for (let i = 0; i < chain.length; i += 1) {
    const n = chain[i];
    if (n.display === "none") return "display-none";
    if (n.visibility === "hidden" || n.visibility === "collapse") return "visibility-hidden";
    if (Number(n.opacity) === 0) return "opacity-0";
    if (/(?:^|\s)(?:sr-only|visually-hidden)(?:\s|$)/.test(n.cls ?? "")) return "sr-only";
    const clipped = n.clip && n.clip !== "auto";
    if (i === 0 && (clipped || (n.clipPath && n.clipPath !== "none"))) return "self-clipped";
    if (i > 0 && (fullInset(n.clipPath) || (clipped && /rect\(\s*0(px)?[ ,]+0(px)?[ ,]+0(px)?[ ,]+0(px)?\s*\)/.test(n.clip)))) return "ancestor-clipped";
    if (i > 0 && /hidden|clip/.test(n.overflow ?? "") && n.w <= 1 && n.h <= 1) return "ancestor-visually-hidden";
  }
  return null;
}
