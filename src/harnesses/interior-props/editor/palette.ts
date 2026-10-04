/**
 * 실내 기물 팔레트 = v5 공통 램프 29개(v5Palette.json, tiledata/hand-interior/pick/palette/v5.pal 에서 생성)
 * + 접지 그림자 2색 + 지금 그림에만 있는 색(own:N). 모델은 이 키만 쓴다.
 */
import { collectOpaqueColors, colorId, makePalette } from "@/harnesses/_core/workshop/grid";
import type { Palette, PaletteEntry, Rgba, RgbaImage } from "@/harnesses/_core/workshop/types";
import ramps from "./v5Palette.json";

export const V5_RAMPS: readonly { name: string; colors: readonly string[] }[] = ramps;

export const INTERIOR_SHADOWS: readonly PaletteEntry[] = [
  { key: "shadow:0", rgba: [0x1c, 0x14, 0x18, 110], label: "그림자 속(발 칸 안, 오른쪽 아래)" },
  { key: "shadow:1", rgba: [0x1c, 0x14, 0x18, 58], label: "그림자 번짐" },
];

const rgbaOf = (hex: string): Rgba => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 255];

export function basePaletteEntries(): PaletteEntry[] {
  const entries: PaletteEntry[] = [];
  for (const ramp of V5_RAMPS) ramp.colors.forEach((hex, index) => entries.push({ key: `${ramp.name}:${index}`, rgba: rgbaOf(hex) }));
  return [...entries, ...INTERIOR_SHADOWS];
}

export function paletteForItem(current: RgbaImage | null): Palette {
  const entries = basePaletteEntries();
  const known = new Set(entries.map((entry) => colorId(entry.rgba)));
  let own = 0;
  for (const rgba of current ? collectOpaqueColors(current) : []) {
    if (known.has(colorId(rgba))) continue;
    known.add(colorId(rgba));
    entries.push({ key: `own:${own++}`, rgba, label: "지금 그림에만 있는 색" });
  }
  return makePalette(entries);
}

/** 지시문에 넣을 팔레트 설명 — 「wood 0(어두움)~8: #000000 …」 */
export function rampSummary(palette: Palette): string {
  const lines = V5_RAMPS.map((ramp) => `- ${ramp.name} 0~${ramp.colors.length - 1}: ${ramp.colors.join(" ")}`);
  const own = palette.entries.filter((entry) => entry.key.startsWith("own:"));
  if (own.length) lines.push(`- own 0~${own.length - 1} (지금 그림에만 있는 색): ${own.map((e) => `#${e.rgba.slice(0, 3).map((v) => v.toString(16).padStart(2, "0")).join("")}`).join(" ")}`);
  lines.push("- shadow:0 그림자 속, shadow:1 그림자 번짐 (반투명, 발 칸 안 오른쪽 아래에만)");
  return lines.join("\n");
}
