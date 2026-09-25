// Harbour pieces for the outdoor fishing village, from the shared harbor kit of PR #1439 (public/assets/harbor-kit,
// scripts/content/lib/village-harbor.mjs): it is already grafted into the forest-village tileset at HARBOR_SLOTS, so the
// outdoor maps keep tilesetId forest_harmony and only need the part shapes.
//   harborParts(forest) → [{ name, w, h, upper }] parts in the outdoor kit's shape (tile ids of the grafted slots)
import { HARBOR_SLOTS, HARBOR_TEXTURE, loadHarborKit } from "./village-harbor.mjs";

// Kit part → outdoor part name (the forest parts already have 나무 상자 / 술통, so the harbour copies are named apart).
const NAMES = { rowboat: "나룻배", post: "계류 말뚝", rope: "밧줄 뭉치", anchor: "닻", barrel: "부두 술통", crate: "부두 상자", openBarrel: "열린 물통" };

export function harborParts(ts) {
  const grafted = new Set((ts.tileGrafts ?? []).filter((g) => g.sourceChipset === HARBOR_TEXTURE).map((g) => g.targetTile));
  if (!grafted.size) return [];
  const kit = loadHarborKit();
  return Object.entries(kit.parts).map(([key, p]) => ({
    name: NAMES[key] ?? p.label, w: p.w, h: p.h, harbor: true,
    upper: Array.from({ length: p.h }, (_, dy) => Array.from({ length: p.w }, (_, dx) => { const k = dy * p.w + dx;
      return (p.empty ?? []).includes(k) ? -1 : HARBOR_SLOTS[p.tiles[k]]; })),
  }));
}
