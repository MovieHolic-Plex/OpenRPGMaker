// REFMAP「町の外観」로 깐 맵 3장(마을·숲·물가)을 호스트 공용 DB(shared-content.sqlite)에 에디터 모델 그대로 올린다.
// 타일셋(원본 시트를 MV 프리셋으로 구운 합본) → 오브젝트(프리셋 소품 킷 + 맵에서 떼어 낸 집 킷) → 장소(root → 층 장소 → 구획 킷).
//
// 그림은 저장소에 없다. 원본 시트·맵 JSON 은 사용자가 받아 둔 로컬 사본만 읽는다(무가공 재배포 금지 약관).
//   시트: ~/.local/share/oprn/refmap-downloads/_packs/refmap-town-outside/*.png
//   맵:   ~/.local/share/oprn/refmap-downloads/_maps/{village,forest,water}.json (+ .png = 그때 그린 그림, 대조용)
// 맵 JSON: auto[0|1] = MZ 1·2층 오토타일 [x,y,시트,종류], stamps[0|1] = 3·4층 [x,y,[[시트,열,행]…]],
//          px = 칸에 맞지 않는 물체 [시트,열,행,폭,높이,px,py] → 가장 가까운 칸으로 붙인다(비는 층에).
//
//   bun scripts/content/refmap/publish-refmap-places.mts [--dry] [--out /tmp/refmap-publish]
// 결과 증거: tiledata/refmap/shared-library-proof.json (그림 없음), --out 폴더에 다시 그린 PNG·차이 그림.
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PNG } from "pngjs";
import { buildMvPackTileset } from "../../../src/project/rpgmakerMv/tilesetPreset.ts";
import { REFMAP_TOWN_OUTSIDE as PRESET } from "../../../src/project/rpgmakerMv/packs/refmapTownOutside.ts";
import { mvAutotileShapeKind, mvSheetPart, mvTileIndex, MV_TILE_SIZE } from "../../../src/project/rpgmakerMv/layout.ts";
import { floorShapeForMask, wallShapeForMask, waterfallShapeForMask } from "../../../src/project/rpgmakerMv/autotile.ts";
import { AUTOTILE_DIR } from "../../../src/project/defaults/autotileEngine.ts";
import type { RgbaImage } from "../../../src/project/rpgmakerMv/bake.ts";

const arg = (name: string, fallback?: string) => { const i = process.argv.indexOf(`--${name}`); return i < 0 ? fallback : process.argv[i + 1] ?? fallback; };
const DRY = process.argv.includes("--dry");
const OUT = arg("out", "/tmp/refmap-publish")!;
const ROOT = path.join(os.homedir(), ".local/share/oprn/refmap-downloads");
const LIBRARY_ID = "refmap-town-exterior-local";
const TILESET_ID = "shared_refmap_town_outside";
const ASSET_ID = `${TILESET_ID}_atlas`;
const T = MV_TILE_SIZE;
const sha = (s: string | Buffer) => crypto.createHash("sha256").update(s).digest("hex");
fs.mkdirSync(OUT, { recursive: true });

// ── 타일셋 ──
const sheets = new Map<string, RgbaImage>();
for (const s of PRESET.sheets) {
  const bytes = fs.readFileSync(path.join(ROOT, "_packs", s.folder, s.file));
  if (sha(bytes) !== s.sha256) throw new Error(`시트 판본이 다르다: ${s.file}`);
  sheets.set(s.file, PNG.sync.read(bytes));
}
const toPng = (image: RgbaImage) => {
  const png = new PNG({ width: image.width, height: image.height });
  png.data = Buffer.from(image.data.buffer, image.data.byteOffset, image.data.byteLength);
  return PNG.sync.write(png);
};
// pngjs 압축이 약하다(합본 15MB). 파이썬 PIL 로 무손실 재압축하면 1/4 이 된다 — 모든 프로젝트에 실리는 그림이라 줄인다.
const optimize = (png: Buffer) => {
  const out = spawnSync("python3", ["-c", "import sys,io\nfrom PIL import Image\nb=io.BytesIO()\nImage.open(io.BytesIO(sys.stdin.buffer.read())).save(b,'PNG',optimize=True)\nsys.stdout.buffer.write(b.getvalue())"],
    { input: png, maxBuffer: 256 * 1024 * 1024 });
  return out.status === 0 && out.stdout.length > 0 && out.stdout.length < png.length ? out.stdout : png;
};
const encodePng = (image: RgbaImage) => `data:image/png;base64,${optimize(toPng(image)).toString("base64")}`;
const built = buildMvPackTileset({ preset: PRESET, sheets, tilesetId: TILESET_ID, assetId: ASSET_ID, encodePng });
const tileset = built.tileset;
const columns = tileset.tilesPerRow;
const index = mvTileIndex(built.layout);
const fullName = (short: string) => {
  const s = PRESET.sheets.find((x) => x.file.startsWith(`${short}_`));
  if (!s) throw new Error(`시트 없음: ${short}`);
  return s.file;
};
const tileOf = (short: string, kind: number, shape = 0) => {
  const t = index(fullName(short), kind, shape);
  if (t === undefined) throw new Error(`칸 없음: ${short} ${kind} ${shape}`);
  return t;
};
const flatTile = (short: string, col: number, row: number) => tileOf(short, row * Math.floor(sheets.get(fullName(short))!.width / T) + col);

// ── 그리기 (에디터 drawMapTileLayer 와 같은 순서: 1층 → 2층 → 3층 → 4층, 칩 그대로 알파 합성) ──
function blank(w: number, h: number): RgbaImage { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) } as RgbaImage; }
function blit(dst: RgbaImage, tile: number, dx: number, dy: number) {
  if (tile < 0) return;
  const sx = (tile % columns) * T, sy = Math.floor(tile / columns) * T, src = built.atlas;
  for (let y = 0; y < T; y += 1) for (let x = 0; x < T; x += 1) {
    const s = ((sy + y) * src.width + sx + x) * 4, d = ((dy + y) * dst.width + dx + x) * 4;
    const a = src.data[s + 3]! / 255;
    if (a === 0) continue;
    for (let c = 0; c < 3; c += 1) dst.data[d + c] = Math.round(src.data[s + c]! * a + dst.data[d + c]! * (1 - a));
    dst.data[d + 3] = Math.round(255 * (a + (dst.data[d + 3]! / 255) * (1 - a)));
  }
}
interface Layers { width: number; height: number; lowerTiles: number[]; lowerOverlayTiles: number[]; upperTiles: number[]; upperOverlayTiles: number[] }
function render(m: Layers): RgbaImage {
  const img = blank(m.width * T, m.height * T);
  for (const layer of [m.lowerTiles, m.lowerOverlayTiles, m.upperTiles, m.upperOverlayTiles]) {
    layer.forEach((t, i) => blit(img, t, (i % m.width) * T, Math.floor(i / m.width) * T));
  }
  return img;
}
function shrink(img: RgbaImage, max = 480): RgbaImage {
  const k = Math.max(1, Math.ceil(Math.max(img.width, img.height) / max));
  const out = blank(Math.floor(img.width / k), Math.floor(img.height / k));
  for (let y = 0; y < out.height; y += 1) for (let x = 0; x < out.width; x += 1) {
    const acc = [0, 0, 0, 0];
    for (let yy = 0; yy < k; yy += 1) for (let xx = 0; xx < k; xx += 1) {
      const s = ((y * k + yy) * img.width + x * k + xx) * 4;
      for (let c = 0; c < 4; c += 1) acc[c]! += img.data[s + c]!;
    }
    const d = (y * out.width + x) * 4;
    for (let c = 0; c < 4; c += 1) out.data[d + c] = Math.round(acc[c]! / (k * k));
  }
  return out;
}

// ── 맵 변환 ──
type Auto = [number, number, string, number];
type Stamp = [number, number, [string, number, number][]];
type Px = [string, number, number, number, number, number, number];
interface RawMap { w: number; h: number; auto: Auto[][]; stamps: Stamp[][]; px: Px[] }

function autoLayer(w: number, h: number, cells: Auto[]): number[] {
  const out = new Array<number>(w * h).fill(-1);
  const key = new Array<string | null>(w * h).fill(null);
  for (const [x, y, s, k] of cells) key[y * w + x] = `${s}:${k}`;
  // 맵 밖 = 같은 재료(MV). A1 물은 폭포 칸도 이어진 물로 본다(RPG Maker 와 같다 — 물이 폭포로 끊기지 않고 흘러든다).
  const isFall = (k: string | null) => !!k && k.startsWith("A1:") && mvAutotileShapeKind("A1", Number(k.slice(3))) === "waterfall";
  const same = (x: number, y: number, k: string) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return true;
    const n = key[y * w + x];
    return n === k || (k.startsWith("A1:") && !isFall(k) && isFall(n));
  };
  for (const [x, y, s, kind] of cells) {
    const k = key[y * w + x]!;
    const part = mvSheetPart(fullName(s));
    const shapeKind = mvAutotileShapeKind(part, kind);
    let mask = 0;
    if (same(x, y - 1, k)) mask |= AUTOTILE_DIR.N;
    if (same(x + 1, y, k)) mask |= AUTOTILE_DIR.E;
    if (same(x, y + 1, k)) mask |= AUTOTILE_DIR.S;
    if (same(x - 1, y, k)) mask |= AUTOTILE_DIR.W;
    if (same(x + 1, y - 1, k)) mask |= AUTOTILE_DIR.NE;
    if (same(x + 1, y + 1, k)) mask |= AUTOTILE_DIR.SE;
    if (same(x - 1, y + 1, k)) mask |= AUTOTILE_DIR.SW;
    if (same(x - 1, y - 1, k)) mask |= AUTOTILE_DIR.NW;
    const shape = shapeKind === "wall" ? wallShapeForMask(mask) : shapeKind === "waterfall" ? waterfallShapeForMask(mask) : floorShapeForMask(mask);
    out[y * w + x] = tileOf(s, kind, shape);
  }
  return out;
}

interface Converted extends Layers { snapped: { x: number; y: number; dy: number; layer: number }[]; dropped: number }
function convert(raw: RawMap): Converted {
  const { w, h } = raw;
  const lowerTiles = autoLayer(w, h, raw.auto[0] ?? []);
  const lowerOverlayTiles = autoLayer(w, h, raw.auto[1] ?? []);
  const upperTiles = new Array<number>(w * h).fill(-1);
  const upperOverlayTiles = new Array<number>(w * h).fill(-1);
  let dropped = 0;
  const put = (i: number, t: number, prefer: 3 | 4) => {
    const order = prefer === 3 ? [upperTiles, upperOverlayTiles] : [upperOverlayTiles, upperTiles];
    for (const layer of order) if (layer[i]! < 0) { layer[i] = t; return layer === upperTiles ? 3 : 4; }
    dropped += 1; return 0;
  };
  (raw.stamps[0] ?? []).forEach(([x, y, stack]) => stack.forEach(([s, c, r]) => put(y * w + x, flatTile(s, c, r), 3)));
  (raw.stamps[1] ?? []).forEach(([x, y, stack]) => stack.forEach(([s, c, r]) => put(y * w + x, flatTile(s, c, r), 4)));
  const snapped: Converted["snapped"] = [];
  for (const [s, c, r, pw, ph, px, py] of raw.px) {
    const x = Math.round(px / T), y = Math.round(py / T);
    for (let dy = 0; dy < ph; dy += 1) for (let dx = 0; dx < pw; dx += 1) {
      if (x + dx >= w || y + dy >= h) continue;
      const layer = put((y + dy) * w + x + dx, flatTile(s, c + dx, r + dy), 4);
      snapped.push({ x: x + dx, y: y + dy, dy: y * T - py, layer });
    }
  }
  return { width: w, height: h, lowerTiles, lowerOverlayTiles, upperTiles, upperOverlayTiles, snapped, dropped };
}

function diff(a: RgbaImage, b: RgbaImage, skip: (x: number, y: number) => boolean) {
  let all = 0, outside = 0;
  const img = blank(a.width, a.height);
  for (let y = 0; y < a.height; y += 1) for (let x = 0; x < a.width; x += 1) {
    const i = (y * a.width + x) * 4;
    const d = Math.max(Math.abs(a.data[i]! - b.data[i]!), Math.abs(a.data[i + 1]! - b.data[i + 1]!), Math.abs(a.data[i + 2]! - b.data[i + 2]!));
    img.data[i] = img.data[i + 1] = img.data[i + 2] = a.data[i]! >> 2; img.data[i + 3] = 255;
    if (d > 2) { all += 1; if (!skip(x, y)) outside += 1; img.data[i] = 255; img.data[i + 1] = 0; img.data[i + 2] = 0; }
  }
  return { all, outside, img };
}

// ── 집 오브젝트: 마을 2층의 지붕·벽(A3) 덩이 + 그 위 3·4층 칸 ──
function houses(m: Converted, raw: RawMap) {
  const { width: w, height: h } = m;
  const isA3 = new Array<boolean>(w * h).fill(false);
  for (const [x, y, s] of raw.auto[1] ?? []) if (s === "A3") isA3[y * w + x] = true;
  const seen = new Array<boolean>(w * h).fill(false);
  const out: { x: number; y: number; w: number; h: number; tiles: number[][]; upper: number[][] }[] = [];
  for (let i = 0; i < w * h; i += 1) {
    if (!isA3[i] || seen[i]) continue;
    const q = [i]; seen[i] = true;
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    while (q.length) {
      const c = q.pop()!, cx = c % w, cy = Math.floor(c / w);
      x0 = Math.min(x0, cx); y0 = Math.min(y0, cy); x1 = Math.max(x1, cx); y1 = Math.max(y1, cy);
      for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]] as const) {
        const n = ny * w + nx;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && isA3[n] && !seen[n]) { seen[n] = true; q.push(n); }
      }
    }
    // 굴뚝이 지붕 위로 한 줄 솟는다 — 위 한 줄에 3층 칸이 있으면 넣는다.
    const top = y0 > 0 && [...Array(x1 - x0 + 1).keys()].some((k) => m.upperTiles[(y0 - 1) * w + x0 + k]! >= 0) ? y0 - 1 : y0;
    const tiles: number[][] = [], upper: number[][] = [];
    for (let y = top; y <= y1; y += 1) {
      tiles.push([]); upper.push([]);
      for (let x = x0; x <= x1; x += 1) {
        const c = y * w + x;
        tiles.at(-1)!.push(isA3[c] ? m.lowerOverlayTiles[c]! : -1);
        upper.at(-1)!.push(m.upperTiles[c]! >= 0 ? m.upperTiles[c]! : m.upperOverlayTiles[c]!);
      }
    }
    out.push({ x: x0, y: top, w: x1 - x0 + 1, h: y1 - top + 1, tiles, upper });
  }
  return out;
}

// ── 장소 정의 ──
const MAPS = [
  { id: "village", name: "REFMAP 풀밭 마을", tags: ["장소유형:마을·도시", "공간형태:실외"], usage: "마을",
    note: "흙길이 가로지르는 풀밭 마을. 지붕·벽 오토타일(2층)로 지은 집 여러 채, 우물·가로등·장터 가판·빨래줄·꽃밭. 42×30." },
  { id: "forest", name: "REFMAP 숲 언덕", tags: ["장소유형:자연", "공간형태:실외"], usage: "필드",
    note: "빽빽한 숲 수관·줄기 벽(A4)과 풀 언덕 절벽 사이로 흙길이 지난다. 돌계단·동굴 입구·그루터기. 42×30." },
  { id: "water", name: "REFMAP 물가 마을", tags: ["장소유형:마을·도시", "공간형태:실외"], usage: "마을",
    note: "연못과 폭포, 나무 다리로 잇는 물가 마을. 풀 언덕 절벽, 물가 풀, 작은 집. 42×30." },
] as const;

// projectDefaults: 타일셋·그림을 모든 프로젝트에 싣는다 — 그래야 오브젝트 탭에 소품·집 킷이 뜬다(PAW 와 같다).
const lib: Record<string, any> = { version: 1, projectDefaults: true, roots: [], places: {}, tilesets: {}, assets: {}, maps: {}, previews: {}, regions: {}, sourceProjectId: LIBRARY_ID };
tileset.name = `${PRESET.name} (공용)`;
tileset.structureKits = [...(tileset.structureKits ?? [])];
lib.tilesets[TILESET_ID] = tileset;
lib.assets[ASSET_ID] = { id: ASSET_ID, name: tileset.name, kind: "chipset", dataUrl: encodePng(built.atlas),
  meta: { tileSize: T, frames: tileset.count, frameWidth: T, frameHeight: T, width: built.atlas.width, height: built.atlas.height,
    source: `REFMAP Town Outside 원본 시트 ${PRESET.sheets.length}장을 MV 프리셋(${PRESET.id} v${PRESET.version})으로 구운 합본` } };

// 프리셋 소품 킷 미리보기
const objectKits = tileset.structureKits.filter((k: any) => k.learnedFrom === "pack-preset");
for (const k of objectKits) {
  const img = blank(k.width * T, k.height * T);
  k.rows.forEach((row: any, y: number) => row.upperTiles?.forEach((t: number, x: number) => blit(img, t, x * T, y * T)));
  lib.previews[k.id] = encodePng(img);
}

const proofMaps: Record<string, unknown> = {};
let houseCount = 0;
for (const def of MAPS) {
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, "_maps", `${def.id}.json`), "utf8")) as RawMap;
  const m = convert(raw);
  const full = render(m);
  const original = PNG.sync.read(fs.readFileSync(path.join(ROOT, "_maps", `${def.id}.png`))) as unknown as RgbaImage;
  const nearPx = (x: number, y: number) => raw.px.some(([, , , pw, ph, px, py]) => x >= px - T && x < px + pw * T + T && y >= py - T && y < py + ph * T + T);
  const d = diff(full, original, nearPx);
  fs.writeFileSync(path.join(OUT, `${def.id}.png`), toPng(full));
  fs.writeFileSync(path.join(OUT, `${def.id}-diff.png`), toPng(d.img));
  const w = m.width, h = m.height;
  const slug = `refmap_${def.id}`;
  const floor = `shared_floor_${slug}`, root = `shared_${slug}`, kit = `raster_${slug}`;
  // 구획 킷은 두 층만 담는다 — 2층은 1층 위에, 4층은 3층 위에 덮어 쓴다(완전한 4층은 층 장소의 맵에 있다).
  const kitLower = m.lowerTiles.map((t, i) => m.lowerOverlayTiles[i]! >= 0 ? m.lowerOverlayTiles[i]! : t);
  const kitUpper = m.upperTiles.map((t, i) => m.upperOverlayTiles[i]! >= 0 ? m.upperOverlayTiles[i]! : t);
  tileset.structureKits.push({ id: kit, name: def.name, kind: "section", width: w, height: h, tileSize: T,
    rows: Array.from({ length: h }, (_, y) => ({ tiles: kitLower.slice(y * w, (y + 1) * w), upperTiles: kitUpper.slice(y * w, (y + 1) * w) })),
    learnedFrom: "db-authored",
    ai: { description: `${def.name} 완성 맵 (${w}×${h}). ${def.note}`, placementRules: "통째로 쓰는 장소 구획. 4층 원본은 층 장소 맵에 있다.",
      role: "terrain", repeatability: "fixed", layerHome: "perCell", tags: ["refmap", "장소"], origin: "ai" } });
  lib.maps[floor] = { id: floor, name: def.name, width: w, height: h, tileSize: T, tilesetId: TILESET_ID,
    lowerTiles: m.lowerTiles, upperTiles: m.upperTiles,
    ...(m.lowerOverlayTiles.some((t) => t >= 0) ? { lowerOverlayTiles: m.lowerOverlayTiles } : {}),
    ...(m.upperOverlayTiles.some((t) => t >= 0) ? { upperOverlayTiles: m.upperOverlayTiles } : {}),
    events: [] };

  // 집 오브젝트 (마을·물가)
  const houseRows: string[] = [];
  for (const [n, hs] of houses(m, raw).entries()) {
    if (hs.w < 3 || hs.h < 3) continue;
    const id = `shared_refmap_house_${def.id}_${n + 1}`;
    const name = `REFMAP 집 (${def.id === "village" ? "마을" : "물가"} ${houseRows.length + 1}, ${hs.w}×${hs.h})`;
    tileset.structureKits.push({ id, kind: "section", name, width: hs.w, height: hs.h, tileSize: T,
      rows: hs.tiles.map((row, y) => ({ tiles: row, upperTiles: hs.upper[y]! })), learnedFrom: "db-authored",
      ai: { description: `${name}. 지붕·벽은 오토타일 모양을 굳힌 칸(아래층), 문·창·굴뚝·간판은 위층.`,
        placementRules: "풀밭·흙바닥 위에 통째로 찍는다. 빈 칸(-1)은 원래 칸을 남긴다. 문 앞 한 칸은 길로 비운다.",
        role: "building", repeatability: "fixed", layerHome: "perCell", tags: ["refmap", "집", `원본:${def.id}`], origin: "ai" } });
    const img = blank(hs.w * T, hs.h * T);
    hs.tiles.forEach((row, y) => row.forEach((t, x) => blit(img, t, x * T, y * T)));
    hs.upper.forEach((row, y) => row.forEach((t, x) => blit(img, t, x * T, y * T)));
    lib.previews[id] = encodePng(img);
    houseRows.push(`| ${name} | \`${id}\` | ${hs.x}, ${hs.y} |`);
    houseCount += 1;
  }

  const tags = ["그림체:REFMAP", ...def.tags, `용도:${def.usage}`];
  const kitDoc = objectKits.map((k: any) => `| ${k.name} | \`${k.id}\` | ${k.width}×${k.height} |`).join("\n");
  const head = { name: def.name, revision: 1, tags, provenance: { origin: "ai", sourceId: `refmap:${def.id}` }, kind: "facility", layout: "manual",
    referenceDocuments: [{ id: `refmap-${def.id}`, name: "구성 메모", description: def.note, documents: [
      { id: "note", name: "구성.md", markdown: `# ${def.name}\n\n${def.note}\n\n타일셋: \`${TILESET_ID}\` (${PRESET.pack}, ${PRESET.author})\n` +
        `층: 1층 바닥 오토타일 · 2층 지붕·벽·디딤돌 오토타일 · 3층 물체 · 4층 물체 겹침.\n` },
      { id: "objects", name: "오브젝트.md", markdown: `# 오브젝트\n\n## 이 맵에서 떼어 낸 집 (${houseRows.length})\n\n| 이름 | 킷 | 원래 자리 x, y |\n|---|---|---|\n${houseRows.join("\n") || "| (없음) | | |"}\n\n` +
        `## 프리셋 소품 (${objectKits.length})\n\n| 이름 | 킷 | 크기 |\n|---|---|---|\n${kitDoc}\n` },
    ], images: [] }] };
  const port = { x: Math.floor(w / 2), y: h - 1 };
  lib.places[floor] = { id: floor, ...head, children: [], connections: [], ports: [{ ...port, id: `entry-${slug}`, name: "입구" }], exterior: { tilesetId: TILESET_ID, kitId: kit } };
  lib.places[root] = { id: root, ...head, children: [{ id: `child-${slug}`, source: { kind: "place", id: floor }, x: 0, y: 0, level: 1 }], ports: [], connections: [] };
  lib.roots.push(root);
  lib.previews[floor] = lib.previews[root] = encodePng(shrink(full));
  proofMaps[def.id] = { place: root, size: `${w}×${h}`, pixels: full.width * full.height, diffPixels: d.all, diffOutsideSnappedObjects: d.outside,
    snapped: m.snapped, dropped: m.dropped, houses: houseRows.length };
}

const bytes = JSON.stringify(lib).length;
if (bytes > 60 * 1024 * 1024) throw new Error(`library too large: ${bytes}`);
const summary = { id: LIBRARY_ID, tileset: TILESET_ID, tiles: tileset.count, atlas: `${built.atlas.width}×${built.atlas.height}`,
  places: lib.roots.length, placeRecords: Object.keys(lib.places).length, objectKits: objectKits.length, houseKits: houseCount,
  structureKits: tileset.structureKits.length, autotileGroups: tileset.autotileGroups?.length, bytes, maps: proofMaps };
console.log(JSON.stringify(summary, null, 1));
for (const [id, p] of Object.entries(proofMaps) as [string, any][]) if (p.diffOutsideSnappedObjects || p.dropped) throw new Error(`${id}: 원본 그림과 다르다 (${p.diffOutsideSnappedObjects}px, 버린 칸 ${p.dropped})`);
if (DRY) process.exit(0);

// ── 게시 ──
const { withTsModule } = await import("../../ontology-ts-loader.mjs");
await withTsModule("scripts/lib/sharedContentSqlite.ts", "publish-refmap-places.mts", async (api: any) => {
  const { DatabaseSync } = await import("node:sqlite");
  const file = api.sharedContentFile();
  const snapshot = (db: any) => Object.fromEntries(db.prepare("SELECT id, revision, payload FROM content_libraries").all().map((r: any) => [r.id, { revision: r.revision, sha: sha(r.payload) }]));
  let db = new DatabaseSync(file, { readOnly: true });
  const before = snapshot(db);
  const expected = before[LIBRARY_ID]?.revision ?? null;
  db.close();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backup = path.join(path.dirname(file), "backups", `shared-content-before-refmap-${stamp}.sqlite`);
  fs.mkdirSync(path.dirname(backup), { recursive: true });
  db = new DatabaseSync(file, { readOnly: true }); db.exec(`VACUUM INTO '${backup.replace(/'/g, "''")}'`); db.close();
  const receipt = api.publishSharedContent(LIBRARY_ID, lib, expected);
  const again = api.readSharedContent().libraries[LIBRARY_ID];
  const reloaded = JSON.stringify(again) === JSON.stringify(lib);
  if (!reloaded) throw new Error("reloaded library differs from the published one");
  db = new DatabaseSync(file, { readOnly: true });
  const after = snapshot(db); db.close();
  const others = Object.keys(before).filter((id) => id !== LIBRARY_ID);
  const changedOthers = others.filter((id) => JSON.stringify(before[id]) !== JSON.stringify(after[id]));
  if (changedOthers.length) throw new Error(`other libraries changed: ${changedOthers.join(", ")}`);
  const proof = { ...summary, file: receipt.file, revision: receipt.revision, reloaded, backup, otherLibraries: others.length,
    otherLibrariesUnchanged: true, publishedAt: new Date().toISOString() };
  fs.mkdirSync("tiledata/refmap", { recursive: true });
  fs.writeFileSync("tiledata/refmap/shared-library-proof.json", JSON.stringify(proof, null, 2) + "\n");
  console.log(JSON.stringify({ id: LIBRARY_ID, revision: receipt.revision, reloaded, otherLibraries: others.length, backup }));
});
