import { inlineAssetSource } from "@/assets/inlineAssetStore";
import bounds from "@/assets/battleContactBounds.json";
type Bounds = readonly [number, number, number, number];
type Row = { cell: number; idle: Bounds; strike: Bounds; attack: Bounds };
/** Unknown and uploaded assets keep the existing fallback. No async decoding in the frame loop. */
export function battleContactBounds(
  url: string | undefined,
  pose: "idle" | "strike" | "attack" = "strike",
): Bounds | undefined {
  const raw = url?.replace(/^url\(["']?|["']?\)$/g, "");
  const source = raw ? (inlineAssetSource(raw) ?? raw) : undefined;
  const path = source?.match(
    /assets\/generated\/(?:charset-battlers|party-pixel|pixel-enemies)\/[^?"')]+\.png/,
  )?.[0];
  return path
    ? (bounds as unknown as Record<string, Row>)[path]?.[pose]
    : undefined;
}
