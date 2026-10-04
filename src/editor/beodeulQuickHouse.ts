import type { SectionStructureKitDef, TilesetDef } from "@/project/types";

export const BEODEUL_HOUSE_STYLES = {
  "beodeul-manor-a": "버들항 반목조 집 · 붉은 꽃",
  "beodeul-manor-b": "버들항 반목조 집 · 초록 창틀",
  "beodeul-manor-lit": "버들항 반목조 집 · 불 켠 창",
  "beodeul-log-green": "버들항 통나무 집 · 초록 문",
  "beodeul-log-blue": "버들항 통나무 집 · 파랑 문",
  "beodeul-log-red": "버들항 통나무 집 · 붉은 문",
} as const;
export type BeodeulHouseStyle = keyof typeof BEODEUL_HOUSE_STYLES;
export type BeodeulRoofForm = "gable" | "hip";
export function isBeodeulHouseStyle(style: string): style is BeodeulHouseStyle { return Object.hasOwn(BEODEUL_HOUSE_STYLES, style); }
export function beodeulHouseMinWidth(style: BeodeulHouseStyle): number { return style.startsWith("beodeul-manor-") ? 7 : 5; }

function partsFor(style: BeodeulHouseStyle): string[] {
  if (style.startsWith("beodeul-manor-")) {
    const variant = style.slice("beodeul-manor-".length);
    return ["bd-mpart-roof-l", "bd-mpart-roof-m", "bd-mpart-roof-r", "bd-mpart-gable", "bd-mpart-door-bay",
      ...["l", "r"].flatMap(side => [`bd-mpart-bay-plain-${side}`, `bd-mpart-bay-win-${variant}-${side}`])];
  }
  return ["bd-out-roof-hl", "bd-out-roof-m", "bd-out-roof-m2", "bd-out-roof-hr", "bd-out-log-l", "bd-out-log-r",
    "bd-out-log-wall", "bd-out-log-window-box", "bd-out-log-window-shut", `bd-out-log-door-${style.slice("beodeul-log-".length)}`];
}

/** Parts are the shipped Beodeul reference recipes, including their authored tile numbers and layers. */
export function beodeulHouseStyles(tileset: TilesetDef): BeodeulHouseStyle[] {
  if (tileset.id !== "beodeul_city" || tileset.tileSize !== 16) return [];
  const parts = new Map(tileset.structureKits?.map(p => [p.id, p]));
  return (Object.keys(BEODEUL_HOUSE_STYLES) as BeodeulHouseStyle[]).filter(style => partsFor(style).every(id => {
    const p = parts.get(id);
    return p?.kind === "section" && p.rows.length === p.height && p.rows.every(r => r.tiles.length === p.width
      && r.upperTiles?.length === p.width && [...r.tiles, ...r.upperTiles].every(t => t === -1 || t >= 0 && t < tileset.count));
  }));
}

const cache = new WeakMap<TilesetDef, Map<string, SectionStructureKitDef>>();
/** Repeat whole native floor bands; roof ends, arch windows and the ground-floor door keep their original pixels. */
export function quickBeodeulHouse(tileset: TilesetDef, options: { style: BeodeulHouseStyle; width: number; stories: number; height?: number; roofWidth?: number; roofRows?: number; roofForm?: BeodeulRoofForm }): SectionStructureKitDef | undefined {
  if (!beodeulHouseStyles(tileset).includes(options.style)) return undefined;
  const manor = options.style.startsWith("beodeul-manor-"), wallWidth = Math.max(beodeulHouseMinWidth(options.style), Math.min(24, Math.round(options.width)));
  const width = Math.max(wallWidth, Math.min(24, Math.round(options.roofWidth ?? wallWidth))), wallX = Math.floor((width - wallWidth) / 2);
  const gabled = manor && options.roofForm !== "hip";
  const roofRows = Math.max(gabled ? 4 : 3, Math.min(12, Math.round(options.roofRows ?? (gabled ? 4 : 3))));
  const groundRows = manor ? 3 : 2, floorRows = 2;
  const stories = Math.max(1, Math.min(9, options.height === undefined ? options.stories : 1 + Math.round((options.height - roofRows - groundRows) / floorRows)));
  const height = roofRows + groundRows + (stories - 1) * floorRows;
  const id = `quick_house_${options.style}_${wallWidth}_${stories}${width === wallWidth && roofRows === 3 ? "" : `_roof${width}x${roofRows}`}${gabled ? "_gable" : ""}`;
  let entries = cache.get(tileset); if (!entries) { entries = new Map(); cache.set(tileset, entries); }
  const old = entries.get(id); if (old) return old;
  const source = new Map(tileset.structureKits!.map(p => [p.id, p]));
  const rows = Array.from({ length: height }, () => ({ tiles: Array<number>(width).fill(-1), upperTiles: Array<number>(width).fill(-1) }));
  const stampRows = (partId: string, x: number, y: number, sourceRows?: number[]) => {
    const part = source.get(partId)!;
    for (const [dy, sy] of (sourceRows ?? Array.from({ length: part.height }, (_, n) => n)).entries()) {
      const row = part.rows[sy]!;
      for (let dx = 0; dx < part.width; dx++) {
        const lower = row.tiles[dx]!, upper = row.upperTiles?.[dx] ?? -1;
        if (lower >= 0) rows[y + dy]!.tiles[x + dx] = lower;
        if (upper >= 0) rows[y + dy]!.upperTiles[x + dx] = upper;
      }
    }
  };
  const doorColumn = Math.floor(wallWidth / 2), doorX = wallX + doorColumn;
  const roofOffset = gabled ? 1 : 0;
  const roofSourceRows = [0, ...Array<number>(roofRows - roofOffset - 2).fill(1), 2];
  if (manor) {
    stampRows("bd-mpart-roof-l", 0, roofOffset, roofSourceRows);
    for (let x = 3; x < width - 3; x++) stampRows("bd-mpart-roof-m", x, roofOffset, roofSourceRows);
    stampRows("bd-mpart-roof-r", width - 3, roofOffset, roofSourceRows);
    // Native pointed front gable. Keep its complete four-row artwork, never stretch the triangle.
    if (gabled) stampRows("bd-mpart-gable", Math.max(0, Math.min(width - 5, doorX - 2)), roofRows - 4);
    const variant = options.style.slice("beodeul-manor-".length);
    for (let floor = 0; floor < stories; floor++) {
      const ground = floor === stories - 1, sourceRows = ground ? [2, 3, 4] : [0, 1], y = roofRows + floor * floorRows;
      for (let x = 0; x < wallWidth; x++) {
        const side = x < doorColumn ? "l" : "r", window = x % 2 === 0;
        stampRows(`bd-mpart-bay-${window ? `win-${variant}` : "plain"}-${side}`, wallX + x, y, sourceRows);
      }
      stampRows("bd-mpart-door-bay", doorX - 1, y, sourceRows);
    }
  } else {
    stampRows("bd-out-roof-hl", 0, 0, roofSourceRows);
    for (let x = 1; x < width - 1; x++) stampRows(x % 4 === 3 ? "bd-out-roof-m2" : "bd-out-roof-m", x, 0, roofSourceRows);
    stampRows("bd-out-roof-hr", width - 1, 0, roofSourceRows);
    for (let floor = 0; floor < stories; floor++) {
      const y = roofRows + floor * floorRows;
      for (let x = 0; x < wallWidth; x++) stampRows(x === 0 ? "bd-out-log-l" : x === wallWidth - 1 ? "bd-out-log-r"
        : x === doorColumn && floor === stories - 1 ? `bd-out-log-door-${options.style.slice("beodeul-log-".length)}`
        : x === doorColumn || Math.abs(x - doorColumn) === 1 ? "bd-out-log-wall"
        : x % 2 === 0 ? "bd-out-log-window-box" : "bd-out-log-window-shut", wallX + x, y);
    }
  }
  const kit: SectionStructureKitDef = { id, kind: "section", name: `${BEODEUL_HOUSE_STYLES[options.style]} · 벽 ${wallWidth}칸 ${stories}층 · ${gabled ? "박공" : "모임"} 지붕 ${width}×${roofRows}칸`,
    width, height, rows, tileSize: tileset.tileSize, learnedFrom: "db-authored", createdAt: "2026-10-03T00:00:00.000Z",
    parts: [{ id: "roof", kind: "anchor", dx: 0, dy: 0, w: width, h: roofRows },
      { id: "walls", kind: "anchor", dx: wallX, dy: roofRows, w: wallWidth, h: height - roofRows },
      { id: "door", kind: "entrance", dx: doorX, dy: height - 2, w: 1, h: 2 }],
    ai: { role: "building", tags: ["버들항", "house", "조립식"], description: "버들항 공용 지붕·벽·창·문 부품으로 조립한 집. 입구 아래 한 칸이 문 앞 길.", placementRules: "문 앞 한 칸이 길에 닿게 두고, 입구를 길로 향하게 놓는다." } };
  entries.set(id, kit); return kit;
}
