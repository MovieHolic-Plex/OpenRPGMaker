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
export function isBeodeulHouseStyle(style: string): style is BeodeulHouseStyle { return Object.hasOwn(BEODEUL_HOUSE_STYLES, style); }
export function beodeulHouseMinWidth(style: BeodeulHouseStyle): number { return style.startsWith("beodeul-manor-") ? 7 : 5; }

function partsFor(style: BeodeulHouseStyle): string[] {
  if (style.startsWith("beodeul-manor-")) {
    const variant = style.slice("beodeul-manor-".length);
    return ["bd-mpart-roof-l", "bd-mpart-roof-m", "bd-mpart-roof-r", "bd-mpart-door-bay",
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
export function quickBeodeulHouse(tileset: TilesetDef, options: { style: BeodeulHouseStyle; width: number; stories: number; height?: number }): SectionStructureKitDef | undefined {
  if (!beodeulHouseStyles(tileset).includes(options.style)) return undefined;
  const manor = options.style.startsWith("beodeul-manor-"), width = Math.max(beodeulHouseMinWidth(options.style), Math.min(24, Math.round(options.width)));
  const groundRows = manor ? 3 : 2, floorRows = 2;
  const stories = Math.max(1, Math.min(9, options.height === undefined ? options.stories : 1 + Math.round((options.height - 3 - groundRows) / floorRows)));
  const height = 3 + groundRows + (stories - 1) * floorRows;
  const id = `quick_house_${options.style}_${width}_${stories}`;
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
  const doorX = Math.floor(width / 2);
  if (manor) {
    stampRows("bd-mpart-roof-l", 0, 0);
    for (let x = 3; x < width - 3; x++) stampRows("bd-mpart-roof-m", x, 0);
    stampRows("bd-mpart-roof-r", width - 3, 0);
    const variant = options.style.slice("beodeul-manor-".length);
    for (let floor = 0; floor < stories; floor++) {
      const ground = floor === stories - 1, sourceRows = ground ? [2, 3, 4] : [0, 1], y = 3 + floor * floorRows;
      for (let x = 0; x < width; x++) {
        const side = x < doorX ? "l" : "r", window = x % 2 === 0;
        stampRows(`bd-mpart-bay-${window ? `win-${variant}` : "plain"}-${side}`, x, y, sourceRows);
      }
      stampRows("bd-mpart-door-bay", doorX - 1, y, sourceRows);
    }
  } else {
    stampRows("bd-out-roof-hl", 0, 0);
    for (let x = 1; x < width - 1; x++) stampRows(x % 4 === 3 ? "bd-out-roof-m2" : "bd-out-roof-m", x, 0);
    stampRows("bd-out-roof-hr", width - 1, 0);
    for (let floor = 0; floor < stories; floor++) {
      const y = 3 + floor * floorRows;
      for (let x = 0; x < width; x++) stampRows(x === 0 ? "bd-out-log-l" : x === width - 1 ? "bd-out-log-r"
        : x === doorX && floor === stories - 1 ? `bd-out-log-door-${options.style.slice("beodeul-log-".length)}`
        : x === doorX || Math.abs(x - doorX) === 1 ? "bd-out-log-wall"
        : x % 2 === 0 ? "bd-out-log-window-box" : "bd-out-log-window-shut", x, y);
    }
  }
  const kit: SectionStructureKitDef = { id, kind: "section", name: `${BEODEUL_HOUSE_STYLES[options.style]} · ${width}×${height}칸 · ${stories}층`,
    width, height, rows, tileSize: tileset.tileSize, learnedFrom: "db-authored", createdAt: "2026-10-03T00:00:00.000Z",
    parts: [{ id: "door", kind: "entrance", dx: doorX, dy: height - 2, w: 1, h: 2 }],
    ai: { role: "building", tags: ["버들항", "house", "조립식"], description: "버들항 공용 지붕·벽·창·문 부품으로 조립한 집. 입구 아래 한 칸이 문 앞 길." } };
  entries.set(id, kit); return kit;
}
