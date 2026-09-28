// REFMAP 세트(MV/MZ 시트 묶음) 공용 도우미: 원본 시트로 타일셋을 굽고, 맵 기술(JSON)을 MZ 4층으로 바꾸고, 그린다.
// 원본 그림은 저장소 밖 로컬 사본만 읽는다(~/.local/share/oprn/refmap-downloads). 무가공 재배포 금지 약관.
//
// 세트 폴더(_work/<세트>)에는 sheets.json(시트 파일·sha256), preset.json(이름 붙인 재료·물체), maps/*.json(맵 기술)이 있다.
// 맵 기술 형식은 openwiki/refmap-town-outside.md 「세트 맵 기술」.
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PNG } from "pngjs";
import { buildMvPackTileset } from "../../../src/project/rpgmakerMv/tilesetPreset.ts";
import { mvAutotileShapeKind, mvSheetPart, mvTileIndex, MV_TILE_SIZE } from "../../../src/project/rpgmakerMv/layout.ts";
import { floorShapeForMask, wallShapeForMask, waterfallShapeForMask } from "../../../src/project/rpgmakerMv/autotile.ts";
import { tileOpacity, type RgbaImage } from "../../../src/project/rpgmakerMv/bake.ts";
import { AUTOTILE_DIR } from "../../../src/project/defaults/autotileEngine.ts";
import type { MvPackPreset } from "../../../src/project/rpgmakerMv/packPreset.ts";
import { passabilityOf } from "../../../src/project/collision.ts";
import { lintPackPassage, lintPackStructure, packEmptyRects, type PackLintInput, type PackLintMaterial } from "../../../src/project/rpgmakerMv/packMapLint.ts";

export const T = MV_TILE_SIZE;
export const REFMAP_ROOT = path.join(os.homedir(), ".local/share/oprn/refmap-downloads");
export const sha = (s: string | Buffer) => crypto.createHash("sha256").update(s).digest("hex");

export function blank(w: number, h: number): RgbaImage { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; }
export function toPng(image: RgbaImage): Buffer {
  const png = new PNG({ width: image.width, height: image.height });
  png.data = Buffer.from(image.data.buffer, image.data.byteOffset, image.data.byteLength);
  return PNG.sync.write(png);
}
// pngjs 압축이 약하다. 파이썬 PIL 로 무손실 재압축하면 1/4 이 된다 — 공용 DB 에 실리는 그림이라 줄인다.
export function optimizePng(png: Buffer): Buffer {
  const out = spawnSync("python3", ["-c", "import sys,io\nfrom PIL import Image\nb=io.BytesIO()\nImage.open(io.BytesIO(sys.stdin.buffer.read())).save(b,'PNG',optimize=True)\nsys.stdout.buffer.write(b.getvalue())"],
    { input: png, maxBuffer: 256 * 1024 * 1024 });
  return out.status === 0 && out.stdout.length > 0 && out.stdout.length < png.length ? out.stdout : png;
}
export const encodePng = (image: RgbaImage, optimize = true) => {
  const png = toPng(image);
  return `data:image/png;base64,${(optimize ? optimizePng(png) : png).toString("base64")}`;
};

// ── 세트 ──
export interface SheetEntry { file: string; part: string; sha256: string; source?: string }
export interface SetSheets { tag: string; name: string; sheets: SheetEntry[] }
export interface PresetJson {
  id: string; name: string; guide: string;
  autotiles: { sheet: string; kind: number; name: string; role: string; description?: string }[];
  flats?: { sheet: string; cell: number; name: string; role: string; description?: string }[];
  objects: { id: string; sheet: string; x: number; y: number; w: number; h: number; kind: string; name: string; description?: string; solid?: [number, number][]; growth?: string }[];
}

/** 시트 짧은 이름: 「A2_REFMAP_MZ_Ground_Green.png」(tag MZ_Ground) → 「A2_Green」, 「B_REFMAP_Snow.png」 → 「B」. */
export function sheetKey(file: string, tag: string): string {
  const [head, rest = ""] = file.replace(/\.png$/, "").split("_REFMAP_");
  const extra = rest.startsWith(tag) ? rest.slice(tag.length).replace(/^_/, "") : "";
  return extra ? `${head}_${extra}` : head!;
}

export interface LoadedSet {
  id: string; dir: string; packDir: string; sheets: SetSheets; presetJson: PresetJson; preset: MvPackPreset;
  built: ReturnType<typeof buildMvPackTileset>; columns: number;
  fileOf: (key: string) => string; tileOf: (key: string, kind: number, shape?: number) => number; flatTile: (key: string, col: number, row: number) => number;
  sheetImages: Map<string, RgbaImage>;
}

export function presetFromJson(id: string, sheets: SetSheets, json: PresetJson, fileOf: (k: string) => string): MvPackPreset {
  return {
    id, version: 1, name: json.name, pack: `REFMAP ${sheets.tag.replace(/_/g, " ")}`, author: "REFMAP (unegoro-looseleaf)",
    url: "https://refmap-l.blog.jp/", credit: "Tileset: REFMAP (https://refmap-l.blog.jp/, @refmap_fsm)",
    license: "게임 제작에 무료. 가공한 그림은 배포 가능, 무가공 재배포·가공품 판매 금지. 작가 @refmap_fsm 의 규약을 따른다.",
    sheets: sheets.sheets.map((s) => ({ file: s.file, folder: id, sha256: s.sha256 })),
    autotiles: json.autotiles.map((a) => ({ ...a, sheet: fileOf(a.sheet) })) as MvPackPreset["autotiles"],
    flats: (json.flats ?? []).map((f) => ({ ...f, sheet: fileOf(f.sheet) })) as MvPackPreset["flats"],
    objects: json.objects.map((o) => ({ ...o, sheet: fileOf(o.sheet) })) as MvPackPreset["objects"],
    guide: json.guide,
  };
}

export function loadSet(id: string, options: { preset?: MvPackPreset; tilesetId?: string; assetId?: string; optimize?: boolean } = {}): LoadedSet {
  const dir = path.join(REFMAP_ROOT, "_work", id);
  const packDir = path.join(REFMAP_ROOT, "_packs", id);
  const sheets = JSON.parse(fs.readFileSync(path.join(dir, "sheets.json"), "utf8")) as SetSheets;
  const presetJson = JSON.parse(fs.readFileSync(path.join(dir, "preset.json"), "utf8")) as PresetJson;
  const keys = new Map(sheets.sheets.map((s) => [sheetKey(s.file, sheets.tag), s.file]));
  const fileOf = (key: string) => {
    const f = keys.get(key) ?? (sheets.sheets.some((s) => s.file === key) ? key : undefined);
    if (!f) throw new Error(`${id}: 시트 없음 「${key}」 (있는 것: ${[...keys.keys()].join(", ")})`);
    return f;
  };
  const sheetImages = new Map<string, RgbaImage>();
  for (const s of sheets.sheets) {
    const bytes = fs.readFileSync(path.join(packDir, s.file));
    if (sha(bytes) !== s.sha256) throw new Error(`${id}: 시트 판본이 다르다 ${s.file}`);
    sheetImages.set(s.file, PNG.sync.read(bytes));
  }
  const preset = options.preset ?? presetFromJson(id, sheets, presetJson, fileOf);
  const tilesetId = options.tilesetId ?? `shared_${id.replace(/-/g, "_")}`;
  const built = buildMvPackTileset({ preset, sheets: sheetImages, tilesetId, assetId: options.assetId ?? `${tilesetId}_atlas`,
    encodePng: (img) => encodePng(img, options.optimize ?? false) });
  const index = mvTileIndex(built.layout);
  const tileOf = (key: string, kind: number, shape = 0) => {
    const t = index(fileOf(key), kind, shape);
    if (t === undefined) throw new Error(`${id}: 칸 없음 ${key} ${kind} ${shape}`);
    return t;
  };
  const flatTile = (key: string, col: number, row: number) => {
    const img = sheetImages.get(fileOf(key))!;
    return tileOf(key, row * Math.floor(img.width / T) + col);
  };
  return { id, dir, packDir, sheets, presetJson, preset, built, columns: built.tileset.tilesPerRow, fileOf, tileOf, flatTile, sheetImages };
}

// ── 그리기 (에디터 drawMapTileLayer 순서: 1층 → 2층 → 3층 → 4층, 칩 그대로 알파 합성) ──
export interface Layers { width: number; height: number; lowerTiles: number[]; lowerOverlayTiles: number[]; upperTiles: number[]; upperOverlayTiles: number[] }
export function blit(dst: RgbaImage, src: RgbaImage, columns: number, tile: number, dx: number, dy: number): void {
  if (tile < 0) return;
  const sx = (tile % columns) * T, sy = Math.floor(tile / columns) * T;
  for (let y = 0; y < T; y += 1) for (let x = 0; x < T; x += 1) {
    const s = ((sy + y) * src.width + sx + x) * 4, d = ((dy + y) * dst.width + dx + x) * 4;
    const a = src.data[s + 3]! / 255;
    if (a === 0) continue;
    for (let c = 0; c < 3; c += 1) dst.data[d + c] = Math.round(src.data[s + c]! * a + dst.data[d + c]! * (1 - a));
    dst.data[d + 3] = Math.round(255 * (a + (dst.data[d + 3]! / 255) * (1 - a)));
  }
}
export function render(set: LoadedSet, m: Layers): RgbaImage {
  const img = blank(m.width * T, m.height * T);
  for (const layer of [m.lowerTiles, m.lowerOverlayTiles, m.upperTiles, m.upperOverlayTiles]) {
    layer.forEach((t, i) => blit(img, set.built.atlas, set.columns, t, (i % m.width) * T, Math.floor(i / m.width) * T));
  }
  return img;
}
export function shrink(img: RgbaImage, max = 480): RgbaImage {
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

// ── 오토타일 모양 ──
/** 칸마다 「시트키:종류」(오토타일) 또는 「#칸번호」(고정 칸). 맵 밖 = 같은 재료(MV), A1 물은 폭포 칸도 이어진 물로 센다. */
export function shapeLayer(set: LoadedSet, w: number, h: number, keys: (string | null)[]): number[] {
  const out = new Array<number>(w * h).fill(-1);
  const isFall = (k: string | null) => {
    if (!k || k.startsWith("#")) return false;
    const [s, kind] = k.split(":");
    return mvSheetPart(set.fileOf(s!)) === "A1" && mvAutotileShapeKind("A1", Number(kind)) === "waterfall";
  };
  const isA1 = (k: string) => !k.startsWith("#") && mvSheetPart(set.fileOf(k.split(":")[0]!)) === "A1";
  const same = (x: number, y: number, k: string) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return true;
    const n = keys[y * w + x] ?? null;
    return n === k || (isA1(k) && !isFall(k) && isFall(n));
  };
  keys.forEach((k, i) => {
    if (!k) return;
    if (k.startsWith("#")) { out[i] = Number(k.slice(1)); return; }
    const x = i % w, y = Math.floor(i / w);
    const [s, kindText] = k.split(":");
    const kind = Number(kindText);
    const shapeKind = mvAutotileShapeKind(mvSheetPart(set.fileOf(s!)), kind);
    let mask = 0;
    if (same(x, y - 1, k)) mask |= AUTOTILE_DIR.N;
    if (same(x + 1, y, k)) mask |= AUTOTILE_DIR.E;
    if (same(x, y + 1, k)) mask |= AUTOTILE_DIR.S;
    if (same(x - 1, y, k)) mask |= AUTOTILE_DIR.W;
    if (same(x + 1, y - 1, k)) mask |= AUTOTILE_DIR.NE;
    if (same(x + 1, y + 1, k)) mask |= AUTOTILE_DIR.SE;
    if (same(x - 1, y + 1, k)) mask |= AUTOTILE_DIR.SW;
    if (same(x - 1, y - 1, k)) mask |= AUTOTILE_DIR.NW;
    const shape = !shapeKind ? 0 : shapeKind === "wall" ? wallShapeForMask(mask) : shapeKind === "waterfall" ? waterfallShapeForMask(mask) : floorShapeForMask(mask);
    out[i] = shapeKind ? set.tileOf(s!, kind, shape) : set.tileOf(s!, kind);
  });
  return out;
}

// ── 맵 기술 ──
export type Mat = string | { sheet: string; kind: number } | { sheet: string; cell: [number, number] };
export type Op =
  | { layer: 1 | 2; mat: Mat; rect?: [number, number, number, number]; cells?: [number, number][] }
  | { layer: 1 | 2; rows: string[]; legend: Record<string, Mat>; at?: [number, number] }
  | { erase: 1 | 2 | 3 | 4; rect: [number, number, number, number] }
  | { obj: string; at: [number, number]; layer?: 3 | 4 }
  | { tile: { sheet: string; x: number; y: number; w?: number; h?: number }; at: [number, number]; layer?: 3 | 4; pass?: boolean };
export interface MapSpec {
  id: string; name: string; note: string; tags: string[]; usage: string; w: number; h: number; ops: Op[];
  entry?: [number, number];
}
export interface Converted extends Layers { warnings: string[]; objects: { id: string; x: number; y: number }[]; keys1: (string | null)[]; keys2: (string | null)[] }

export function convertSpec(set: LoadedSet, spec: MapSpec): Converted {
  const { w, h } = spec;
  const k1 = new Array<string | null>(w * h).fill(null), k2 = new Array<string | null>(w * h).fill(null);
  const up3 = new Array<number>(w * h).fill(-1), up4 = new Array<number>(w * h).fill(-1);
  const warnings: string[] = [];
  const objects: Converted["objects"] = [];
  const placed: Placed[] = [];
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h;
  const matKey = (mat: Mat): string => {
    if (typeof mat === "string") {
      const a = set.presetJson.autotiles.find((e) => e.name === mat);
      if (a) return `${a.sheet}:${a.kind}`;
      const f = set.presetJson.flats?.find((e) => e.name === mat);
      if (f) return `#${set.tileOf(f.sheet, f.cell)}`;
      throw new Error(`${spec.id}: 재료 이름 없음 「${mat}」`);
    }
    if ("kind" in mat) { set.fileOf(mat.sheet); return `${mat.sheet}:${mat.kind}`; }
    return `#${set.flatTile(mat.sheet, mat.cell[0], mat.cell[1])}`;
  };
  const opaque = (tile: number) => tileOpacity(set.built.atlas, set.columns, tile) > 0;
  const put = (x: number, y: number, tile: number, prefer: 3 | 4, what: string) => {
    if (!inside(x, y)) { warnings.push(`${what}: (${x},${y}) 맵 밖`); return; }
    const i = y * w + x;
    const order = prefer === 3 ? [up3, up4] : [up4, up3];
    for (const layer of order) if (layer[i]! < 0) { layer[i] = tile; return; }
    warnings.push(`${what}: (${x},${y}) 3·4층이 이미 찼다 — 버림`);
  };
  for (const op of spec.ops) {
    if ("erase" in op) {
      const [x0, y0, rw, rh] = op.rect;
      for (let y = y0; y < y0 + rh; y += 1) for (let x = x0; x < x0 + rw; x += 1) if (inside(x, y)) {
        const i = y * w + x; ({ 1: k1, 2: k2 } as Record<number, (string | null)[]>)[op.erase]?.splice(i, 1, null);
        if (op.erase === 3) up3[i] = -1; if (op.erase === 4) up4[i] = -1;
      }
    } else if ("obj" in op) {
      const o = set.presetJson.objects.find((e) => e.id === op.obj);
      if (!o) throw new Error(`${spec.id}: 물체 id 없음 「${op.obj}」`);
      objects.push({ id: o.id, x: op.at[0], y: op.at[1] });
      const cells: [number, number][] = [];
      for (let dy = 0; dy < o.h; dy += 1) for (let dx = 0; dx < o.w; dx += 1) {
        const t = set.flatTile(o.sheet, o.x + dx, o.y + dy);
        if (opaque(t)) { put(op.at[0] + dx, op.at[1] + dy, t, op.layer ?? 3, o.id); cells.push([dx, dy]); }
      }
      placed.push({ o, x: op.at[0], y: op.at[1], cells });
    } else if ("tile" in op) {
      const tw = op.tile.w ?? 1, th = op.tile.h ?? 1;
      const id = `tile:${op.tile.sheet}(${op.tile.x},${op.tile.y})`;
      const cells: [number, number][] = [];
      for (let dy = 0; dy < th; dy += 1) for (let dx = 0; dx < tw; dx += 1) {
        const t = set.flatTile(op.tile.sheet, op.tile.x + dx, op.tile.y + dy);
        if (opaque(t)) { put(op.at[0] + dx, op.at[1] + dy, t, op.layer ?? 3, id); cells.push([dx, dy]); }
      }
      // 낱장 조각은 막힘으로 본다. 지나가는 무늬(계단 조각·바닥 그림)는 op 에 pass: true.
      placed.push({ o: { id, sheet: op.tile.sheet, x: op.tile.x, y: op.tile.y, w: tw, h: th, kind: op.pass ? "decal" : "prop", name: id }, x: op.at[0], y: op.at[1], cells });
    } else {
      const keys = op.layer === 1 ? k1 : k2;
      if ("rows" in op) {
        const [ax, ay] = op.at ?? [0, 0];
        const legend = Object.fromEntries(Object.entries(op.legend).map(([c, m]) => [c, matKey(m)]));
        op.rows.forEach((row, dy) => [...row].forEach((c, dx) => {
          if (c === "." || c === " ") return;
          if (!(c in legend)) throw new Error(`${spec.id}: 범례에 없는 글자 「${c}」`);
          if (inside(ax + dx, ay + dy)) keys[(ay + dy) * w + ax + dx] = legend[c]!;
        }));
      } else {
        const key = matKey(op.mat);
        if (op.rect) {
          const [x0, y0, rw, rh] = op.rect;
          for (let y = y0; y < y0 + rh; y += 1) for (let x = x0; x < x0 + rw; x += 1) if (inside(x, y)) keys[y * w + x] = key;
        }
        for (const [x, y] of op.cells ?? []) if (inside(x, y)) keys[y * w + x] = key;
      }
    }
  }
  const empty = k1.filter((k) => !k).length;
  if (empty) warnings.push(`1층 빈 칸 ${empty}개(검게 보인다)`);
  warnings.push(...lintStructure(set, w, h, k1, k2));
  const lo1 = shapeLayer(set, w, h, k1), lo2 = shapeLayer(set, w, h, k2);
  warnings.push(...lintPassage(set, spec, k1, k2, placed, [lo1, lo2, up3, up4]));
  return { width: w, height: h, lowerTiles: lo1, lowerOverlayTiles: lo2,
    upperTiles: up3, upperOverlayTiles: up4, warnings, objects, keys1: k1, keys2: k2 };
}

// ── 검사 ──
// 규칙 본체는 src/project/rpgmakerMv/packMapLint.ts(편집기 check_pack_map·조수와 같은 것). 여기서는 맵 기술의 재료 키로 입력을 만든다.
type ObjDef = LoadedSet["presetJson"]["objects"][number];
export interface Placed { o: ObjDef; x: number; y: number; cells: [number, number][] }
function materialsOf(set: LoadedSet, keys: (string | null)[]): (PackLintMaterial | null)[] {
  const info = new Map(set.presetJson.autotiles.map((a) => [`${a.sheet}:${a.kind}`, a]));
  const flatName = new Map((set.presetJson.flats ?? []).map((f) => [`#${set.tileOf(f.sheet, f.cell)}`, f.name]));
  return keys.map((k) => {
    if (!k) return null;
    if (k.startsWith("#")) return { key: k, name: flatName.get(k) ?? "", part: "A5", flat: true };
    const [sheet, kind] = k.split(":");
    const a = info.get(k);
    return { key: k, name: a?.name ?? k, ...(a ? { role: a.role } : {}), part: mvSheetPart(set.fileOf(sheet!)), kind: Number(kind), flat: false };
  });
}
function lintInput(set: LoadedSet, spec: MapSpec, k1: (string | null)[], k2: (string | null)[], placed: Placed[], layers: [number[], number[], number[], number[]]): PackLintInput {
  const ts = set.built.tileset, n = spec.w * spec.h;
  return {
    w: spec.w, h: spec.h, m1: materialsOf(set, k1), m2: materialsOf(set, k2), placed,
    pass: Array.from({ length: n }, (_, i) => passabilityOf(ts, layers[0][i]!, layers[1][i]!, layers[2][i]!, layers[3][i]!)),
    basePass: Array.from({ length: n }, (_, i) => passabilityOf(ts, layers[0][i]!, -1, -1, -1)),
    occupied: Array.from({ length: n }, (_, i) => layers[2][i]! >= 0 || layers[3][i]! >= 0),
    ...(spec.entry ? { entry: spec.entry } : {}),
  };
}
export function lintPassage(set: LoadedSet, spec: MapSpec, k1: (string | null)[], k2: (string | null)[], placed: Placed[], layers: [number[], number[], number[], number[]]): string[] {
  return lintPackPassage(lintInput(set, spec, k1, k2, placed, layers));
}
export function lintStructure(set: LoadedSet, w: number, h: number, k1: (string | null)[], k2: (string | null)[]): string[] {
  return lintPackStructure({ w, h, m1: materialsOf(set, k1), m2: materialsOf(set, k2) });
}
// 「공간이 남으면 공간이 너무 큰 것이다.」 가장 큰 빈 바닥 직사각형들(packEmptyRects).
export function emptyRects(set: LoadedSet, m: Converted, minArea = 12, limit = 5, minSide = 1): { x: number; y: number; w: number; h: number }[] {
  const n = m.width * m.height;
  return packEmptyRects({ w: m.width, h: m.height, m1: materialsOf(set, m.keys1), m2: materialsOf(set, m.keys2),
    occupied: Array.from({ length: n }, (_, i) => m.upperTiles[i]! >= 0 || m.upperOverlayTiles[i]! >= 0) }, minArea, limit, minSide);
}

export function readMapSpecs(set: LoadedSet): MapSpec[] {
  const dir = path.join(set.dir, "maps");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort().map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as MapSpec);
}
