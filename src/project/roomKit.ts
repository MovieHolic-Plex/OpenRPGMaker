/**
 * 방 짓기 역할표 만들기 — 사용자가 올린 칩셋에서 바닥·벽면·천장 칸을 고르면, 조립기(build_hand_interior_room)가 쓰는
 * 사양(HandInteriorSpec 모양)과 그 사양이 요구하는 변형 칸(벽 밑·서쪽 그림자, 천장 테두리)을 만든다.
 *
 * 변형 칸은 고른 칸의 픽셀을 어둡게 하거나 테두리를 그어 만든 새 그림이다 — 시트 한 장(업로드 에셋)으로 묶어
 * 타일셋 끝에 이식(tileGrafts)한다. 원래 칸의 통행·층은 건드리지 않는다(사양은 이식 칸만 가리킨다).
 * 픽셀 처리는 순수 함수다(RGBA 배열 in/out). PNG 인코딩·이미지 읽기는 호출하는 쪽(편집기 캔버스)이 한다.
 */
import type { PassFlag, TileAiMetadata, TilesetDef } from "./types";

export const ROOM_KIT_ASSET_PREFIX = "roomkit_";
/** 변형 칸 시트 에셋 id. 칸 크기를 id 에 넣어 이식 칸을 읽는 쪽(bundledChipsetGeometry)이 칸 크기·줄 칸 수를 안다. */
export function roomKitAssetId(tileSize: number, dataUrl: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < dataUrl.length; i++) { h ^= dataUrl.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return `${ROOM_KIT_ASSET_PREFIX}${tileSize}_${(h >>> 0).toString(16).padStart(8, "0")}_${dataUrl.length.toString(36)}`;
}

/**
 * 고른 칸 하나 = 칩셋 칸 번호, 또는 시트의 픽셀 창(왼쪽 위 px·py, 크기는 칸 크기).
 * 픽셀 창은 RPG Maker 오토타일 블록처럼 「반 칸 어긋난 자리」가 이음매 없는 가운데인 시트에서 쓴다(rpgMakerBlockPicks).
 */
export type RoomKitCell = number | { readonly px: number; readonly py: number };
/**
 * 고른 칸. 시트마다 칸을 늘어놓는 방식이 달라(벽 4줄을 한 줄에 이어 둔 시트도 있다) 사각형이 아니라 칸 격자로 받는다.
 * floor = 반복 무늬 판(줄마다 같은 길이, 8×8 이하), wall = 벽면 두 줄 [위 줄, 아래 줄](같은 길이), ceiling = 천장 칸 하나.
 */
export interface RoomKitPicks {
  readonly floor: readonly (readonly RoomKitCell[])[];
  readonly wall: readonly [readonly RoomKitCell[], readonly RoomKitCell[]];
  readonly ceiling: RoomKitCell;
}
export interface RgbaImage { readonly width: number; readonly height: number; readonly data: Uint8Array | Uint8ClampedArray }

type Role = "floor" | "wall" | "ceiling" | "void";
export interface CompiledRoomKit {
  /** 변형 칸 시트(칸 ROOM_KIT_SHEET_COLS 열). */
  readonly sheet: { readonly width: number; readonly height: number; readonly data: Uint8ClampedArray };
  readonly roles: readonly Role[];
  /** 칸 순서 = 사양 번호를 매기는 순서(아래 installRoomKit 이 base 를 더한다). */
  readonly floorCols: number; readonly floorRows: number; readonly wallCols: number;
}

/** bundledChipsetTilesPerRow 의 roomkit_ 규칙과 같아야 한다. */
const ROOM_KIT_SHEET_COLS = 16;
const PASS: PassFlag = { up: true, down: true, left: true, right: true };
const BLOCK: PassFlag = { up: false, down: false, left: false, right: false };
/** 손 도트 사양과 같은 그늘 단계(jp interior/ikit.py FOOT/WEST/TOP_SHADE) — 팔레트 단 대신 곱셈으로. */
const DARK = [1, 0.82, 0.64] as const;
const FOOT_SHADE = [2, 1, 1];
const WEST_SHADE = [2, 2, 1, 1, 1, 0];
const TOP_SHADE = [2, 2, 1, 1];

/**
 * 고른 칸이 모양에 맞는지. 문제가 있으면 사람이 읽을 문장, 없으면 null. tileCount = 칩셋 칸 수.
 * sheet(픽셀 크기·칸 크기)를 주면 픽셀 창이 시트 안인지도 본다.
 */
export function roomKitPicksProblem(picks: RoomKitPicks, tileCount: number, sheet?: { width: number; height: number; tileSize: number }): string | null {
  const ok = (c: unknown) => typeof c === "object" && c !== null
    ? Number.isInteger((c as { px: number }).px) && Number.isInteger((c as { py: number }).py) && (c as { px: number }).px >= 0 && (c as { py: number }).py >= 0
      && (!sheet || ((c as { px: number }).px + sheet.tileSize <= sheet.width && (c as { py: number }).py + sheet.tileSize <= sheet.height))
    : Number.isInteger(c) && (c as number) >= 0 && (c as number) < tileCount;
  const { floor, wall } = picks;
  if (!Array.isArray(floor) || !floor.length || floor.length > 8) return "바닥 무늬는 1~8줄로 고릅니다.";
  const fw = floor[0]?.length ?? 0;
  if (fw < 1 || fw > 8 || floor.some((row) => !Array.isArray(row) || row.length !== fw)) return "바닥 무늬는 줄마다 같은 길이(1~8칸)로 고릅니다.";
  if (!Array.isArray(wall) || wall.length !== 2) return "벽면은 두 줄(위·아래)로 고릅니다.";
  const ww = wall[0]?.length ?? 0;
  if (ww < 1 || ww > 8 || wall[1]?.length !== ww) return "벽면 두 줄은 같은 길이(1~8칸)로 고릅니다.";
  if (![...floor.flat(), ...wall.flat(), picks.ceiling].every(ok)) return `칩셋에 없는 칸 번호가 있습니다(0~${tileCount - 1}).`;
  return null;
}

/**
 * 고른 칸 → 변형 칸 시트. sheet = 칩셋 그림 전체(이식 칸까지 구운 것, 줄마다 width/tileSize 칸).
 * tileSize 는 칩셋 칸 크기(16·32·48 — 그늘 폭은 비례).
 */
export function compileRoomKit(image: RgbaImage, tileSize: number, picks: RoomKitPicks): CompiledRoomKit {
  const T = tileSize, cols = Math.floor(image.width / T), rows = Math.floor(image.height / T);
  const problem = roomKitPicksProblem(picks, cols * rows, { width: image.width, height: image.height, tileSize: T });
  if (problem) throw new Error(problem);
  const { floor, wall } = picks;
  const k = T / 16;
  const tiles: Uint8ClampedArray[] = [];
  const roles: Role[] = [];
  const read = (cell: RoomKitCell): Uint8ClampedArray => {
    const [ox, oy] = typeof cell === "number" ? [(cell % cols) * T, Math.floor(cell / cols) * T] : [cell.px, cell.py];
    const out = new Uint8ClampedArray(T * T * 4);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const s = ((oy + y) * image.width + ox + x) * 4, d = (y * T + x) * 4;
      out[d] = image.data[s]!; out[d + 1] = image.data[s + 1]!; out[d + 2] = image.data[s + 2]!; out[d + 3] = image.data[s + 3]!;
    }
    return out;
  };
  const scale = (t: Uint8ClampedArray, px: number, f: number) => { for (let c = 0; c < 3; c++) t[px + c] = Math.round(t[px + c]! * f); };
  const shadeRows = (t: Uint8ClampedArray, steps: readonly number[]) => {
    for (let y = 0; y < T; y++) {
      const n = steps[Math.floor(y / k)] ?? 0;
      if (n) for (let x = 0; x < T; x++) scale(t, (y * T + x) * 4, DARK[n]!);
    }
    return t;
  };
  const shadeCols = (t: Uint8ClampedArray, steps: readonly number[]) => {
    for (let x = 0; x < T; x++) {
      const n = steps[Math.floor(x / k)] ?? 0;
      if (n) for (let y = 0; y < T; y++) scale(t, (y * T + x) * 4, DARK[n]!);
    }
    return t;
  };
  // 바닥: ((y%rows)*cols + x%cols)*4 + 그림자(1 = 벽면 밑, 2 = 서쪽)
  const fh = floor.length, fw = floor[0]!.length, ww = wall[0].length;
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) for (let sh = 0; sh < 4; sh++) {
    let t = read(floor[y]![x]!);
    if (sh & 1) t = shadeRows(t, FOOT_SHADE);
    if (sh & 2) t = shadeCols(t, WEST_SHADE);
    tiles.push(t); roles.push("floor");
  }
  // 벽면: ((줄-1)*cols + x%cols)*2 + 서쪽. 윗줄 위쪽은 천장 띠 밑 그늘.
  for (let r = 0; r < 2; r++) for (let x = 0; x < ww; x++) for (let west = 0; west < 2; west++) {
    let t = read(wall[r]![x]!);
    if (r === 0) t = shadeRows(t, TOP_SHADE);
    if (west) t = shadeCols(t, WEST_SHADE);
    tiles.push(t); roles.push("wall");
  }
  // 천장 32: bit 1 아래·2 위·4 서·8 동 = 그쪽이 방 안(테두리), 16 = 위가 바깥(맵 끝). 테두리 = 바깥 1px 어둡게 + 안쪽 밝은 선.
  const base = read(picks.ceiling);
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < base.length; i += 4) if (base[i + 3]! > 0) { r += base[i]!; g += base[i + 1]!; b += base[i + 2]!; n++; }
  const avg = n ? [r / n, g / n, b / n] : [40, 40, 48];
  const rim = avg.map((v) => Math.round(v + (255 - v) * 0.45));
  const edge = avg.map((v) => Math.round(v * 0.45));
  for (let bits = 0; bits < 32; bits++) {
    const t = new Uint8ClampedArray(base);
    const put = (x: number, y: number, c: readonly number[]) => { const p = (y * T + x) * 4; t[p] = c[0]!; t[p + 1] = c[1]!; t[p + 2] = c[2]!; t[p + 3] = 255; };
    const w = Math.max(1, Math.round(k));
    for (let i = 0; i < T; i++) for (let d = 0; d < w; d++) {
      if (bits & 1) { put(i, T - 1 - d, edge); put(i, T - 1 - w - d, rim); }
      if (bits & 2) { put(i, d, edge); put(i, w + d, rim); }
      if (bits & 4) { put(d, i, edge); put(w + d, i, rim); }
      if (bits & 8) { put(T - 1 - d, i, edge); put(T - 1 - w - d, i, rim); }
    }
    tiles.push(t); roles.push("ceiling");
  }
  tiles.push(new Uint8ClampedArray(base)); roles.push("void");

  const sheetRows = Math.ceil(tiles.length / ROOM_KIT_SHEET_COLS);
  const W = ROOM_KIT_SHEET_COLS * T, H = sheetRows * T;
  const data = new Uint8ClampedArray(W * H * 4);
  tiles.forEach((t, i) => {
    const ox = (i % ROOM_KIT_SHEET_COLS) * T, oy = Math.floor(i / ROOM_KIT_SHEET_COLS) * T;
    for (let y = 0; y < T; y++) data.set(t.subarray(y * T * 4, (y + 1) * T * 4), ((oy + y) * W + ox) * 4);
  });
  return { sheet: { width: W, height: H, data }, roles, floorCols: fw, floorRows: fh, wallCols: ww };
}

type ProjectLike = { tilesets: Record<string, TilesetDef>; assets?: { uploaded: Record<string, unknown> } };

/** 변형 칸이 놓일 첫 번호 — 칩셋 끝·다른 이식 끝 뒤 새 줄. */
export function roomKitBase(tileset: Pick<TilesetDef, "count" | "tilesPerRow" | "tileGrafts">): number {
  const graftEnd = (tileset.tileGrafts ?? []).reduce((m, g) => Math.max(m, g.targetTile + 1), 0);
  const per = Math.max(1, tileset.tilesPerRow);
  return Math.ceil(Math.max(tileset.count, graftEnd) / per) * per;
}

/**
 * 변형 칸 시트를 타일셋 끝에 이식하고 roomKit.spec 을 단다(project 를 제자리에서 고친다 — store.update 초안에 대고 부른다).
 * 다시 만들면 새 칸을 덧붙이고 사양만 새 칸을 가리킨다 — 이미 지은 맵은 옛 칸 그대로 남는다.
 */
export function installRoomKit(project: ProjectLike, tilesetId: string, compiled: CompiledRoomKit, asset: { readonly id: string; readonly dataUrl: string }, picks: RoomKitPicks): void {
  const tileset = project.tilesets[tilesetId];
  if (!tileset) throw new Error(`칩셋이 없습니다: ${tilesetId}`);
  if (!asset.id.startsWith(`${ROOM_KIT_ASSET_PREFIX}${tileset.tileSize}_`)) throw new Error(`변형 칸 시트 id 는 roomKitAssetId 로 만듭니다: ${asset.id}`);
  if (project.assets && !project.assets.uploaded[asset.id]) {
    project.assets.uploaded[asset.id] = {
      id: asset.id, name: `방 짓기 역할표 · ${tileset.name}`, kind: "tileset", dataUrl: asset.dataUrl,
      meta: { tileSize: tileset.tileSize, width: compiled.sheet.width, height: compiled.sheet.height },
    };
  }
  const base = roomKitBase(tileset);
  while (tileset.passability.length < base) tileset.passability.push({ ...PASS });
  while (tileset.priority.length < base) tileset.priority.push("lower");
  while (tileset.terrain.length < base) tileset.terrain.push(0);
  if (tileset.tileMeta) while (tileset.tileMeta.length < base) tileset.tileMeta.push({ label: "방 짓기 칸 자리(빈 칸)", description: "", source: "user" } as TileAiMetadata);
  tileset.tileGrafts ??= [];
  const KO: Record<Role, string> = { floor: "바닥", wall: "벽면", ceiling: "천장", void: "바깥" };
  compiled.roles.forEach((role, i) => {
    const id = base + i;
    tileset.tileGrafts!.push({ sourceChipset: asset.id, sourceTile: i, targetTile: id });
    tileset.passability[id] = role === "floor" ? { ...PASS } : { ...BLOCK };
    tileset.priority[id] = "lower";
    tileset.terrain[id] = 0;
    if (tileset.tileMeta) {
      tileset.tileMeta[id] = { label: `방 짓기 · ${KO[role]}`, description: "방 짓기 역할표가 만든 칸(그림자·테두리 변형)", source: "user", role: role === "floor" ? "terrain" : "wall",
        passage: role === "floor" ? "passable" : "solid", defaultLayer: "lower", tags: ["room-kit"], userLocked: true };
    }
  });
  tileset.count = base + compiled.roles.length;
  tileset.roomKit = { spec: roomKitSpec(compiled, base, picks) };
}

/** 변형 칸이 base 번부터 놓였을 때의 사양(HandInteriorSpec 모양). 견본 방 미리보기도 이것으로 짓는다. */
export function roomKitSpec(compiled: CompiledRoomKit, base: number, picks?: RoomKitPicks) {
  const ids = (role: Role) => compiled.roles.flatMap((r, i) => (r === role ? [base + i] : []));
  return {
    blank: -1, void: ids("void")[0]!,
    floors: { floor: { ko: "바닥", cols: compiled.floorCols, rows: compiled.floorRows, tiles: ids("floor") } },
    walls: { wall: { ko: "벽면", cols: compiled.wallCols, tiles: ids("wall") } },
    ceilings: { default: ids("ceiling") },
    objects: {}, tables: {}, lines: {}, daises: {}, goods: {},
    ...(picks ? { picks } : {}),
  };
}

/** 저장된 역할표가 이 모듈로 만든 것이면 그때 고른 칸(다시 고칠 때 시작점). */
export function savedRoomKitPicks(tileset: Pick<TilesetDef, "roomKit"> | undefined): RoomKitPicks | undefined {
  const picks = (tileset?.roomKit?.spec as { picks?: RoomKitPicks } | undefined)?.picks;
  return picks && Array.isArray(picks.floor) && Array.isArray(picks.wall) ? picks : undefined;
}

/** 손 도트 사양 가구 꼴(builder.ts SpecObject 와 같은 모양). */
export interface KitHandObject {
  readonly ko: string; readonly category: string; readonly category_ko: string; readonly kind: "floor" | "wall" | "hang" | "flat";
  readonly w: number; readonly h: number; readonly up: number; readonly cells: readonly (readonly [number, number, number, number])[];
  readonly desc: string; readonly tags: readonly string[]; readonly place: string; readonly pair: readonly string[]; readonly use: readonly string[];
}
/** 가구가 아닌 조립 부품(벽·바닥·지붕·울타리·건물·물) — 방 짓기 가구 목록에서 뺀다. */
const NOT_FURNITURE = new Set(["wall", "terrain", "fence", "roof", "building", "water", "floor", "path", "cliff"]);
const WALL_PLACE = /벽 앞|벽에 붙|북쪽 벽에|북벽 앞|north-wall/u;
const HANG_PLACE = /벽에 건|벽면에 건|걸이|걸어 둔/u;

/**
 * 칩셋의 조립 부품(structureKits) → 방 짓기 가구. 역할표에 가구 표가 없는 칩셋(마법 학교·사용자가 「방 짓기」 탭에서 만든 역할표)이
 * build_hand_interior_room 의 objects 로 가구를 놓게 한다. 공방 부품(workshop:)은 workshopHandObjects 가 따로 맡는다.
 * 발밑 줄 = 막힌 칸(네 방향 모두 막힘)이 처음 나오는 줄부터 맨 아래까지. 막힌 칸이 없으면 위층 칸이 없을 때 밟는 무늬(flat), 있으면 밟고 지나가는 소품(h 0).
 * 종류: 놓는 곳 설명에 「벽 앞·벽에 붙」 = wall(북쪽 벽 바로 아래 첫 줄), 「벽에 건·걸이」 = hang(벽면 윗줄), 나머지 = floor.
 */
export function kitHandObjects(tileset: TilesetDef | undefined): Record<string, KitHandObject> {
  const out: Record<string, KitHandObject> = {};
  if (!tileset) return out;
  const blocked = (tile: number) => {
    const p = tileset.passability[tile];
    return !!p && !p.up && !p.down && !p.left && !p.right;
  };
  for (const kit of tileset.structureKits ?? []) {
    if (kit.kind !== "section" || kit.learnedFrom === "workshop" || !kit.rows?.length) continue;
    const role = kit.ai?.role ?? "";
    if (NOT_FURNITURE.has(role)) continue;
    const H = kit.rows.length, W = kit.width;
    const firstBlocked = kit.rows.findIndex((row) => [...(row.tiles ?? []), ...(row.upperTiles ?? [])].some((t) => t >= 0 && blocked(t)));
    const hasUpper = kit.rows.some((row) => (row.upperTiles ?? []).some((t) => t >= 0));
    const place = `${kit.ai?.placementRules ?? ""} ${kit.ai?.description ?? ""}`;
    const kind: KitHandObject["kind"] = firstBlocked < 0
      ? (hasUpper ? (HANG_PLACE.test(place) ? "hang" : "floor") : "flat")
      : WALL_PLACE.test(kit.ai?.placementRules ?? "") ? "wall" : "floor";
    const foot = firstBlocked < 0 ? 0 : H - firstBlocked;
    // 칸 좌표: floor·wall 은 발밑 첫 줄이 dy 0(솟은 칸은 음수), hang·flat 은 맨 윗줄이 dy 0 — 발밑 없는 floor 는 맨 아랫줄이 dy 0.
    const top = kind === "hang" || kind === "flat" ? 0 : foot ? H - foot : H - 1;
    const cells: [number, number, number, number][] = [];
    kit.rows.forEach((row, y) => {
      (row.tiles ?? []).forEach((t, x) => { if (t >= 0) cells.push([x, y - top, t, 2]); });
      (row.upperTiles ?? []).forEach((t, x) => { if (t >= 0) cells.push([x, y - top, t, kind === "flat" ? 2 : 3]); });
    });
    if (!cells.length) continue;
    const tags = (kit.ai?.tags ?? []).filter((t) => !t.startsWith("use:"));
    out[kit.id] = {
      ko: kit.name ?? kit.id, category: role || "prop", category_ko: tags[2] ?? tags[1] ?? "가구", kind,
      w: W, h: kind === "hang" ? 0 : kind === "flat" ? H : foot, up: 0, cells,
      desc: (kit.ai?.description ?? "").slice(0, 60), tags, place: kit.ai?.placementRules ?? "", pair: [],
      use: (kit.ai?.tags ?? []).filter((t) => t.startsWith("use:")).map((t) => t.slice(4)),
    };
  }
  return out;
}

/**
 * RPG Maker MV/MZ 오토타일 시트(A2 바닥 16×12칸 · A4 벽 16×15칸)인가. 칸 수로 본다(칸 크기는 상관없다).
 * 이런 시트의 칸 하나를 그대로 고르면 오토타일 테두리가 칸마다 남아 바닥·벽에 격자가 생긴다.
 */
export function rpgMakerAutotileSheet(cols: number, rows: number): "A2" | "A4" | null {
  if (cols === 16 && rows === 12) return "A2";
  if (cols === 16 && rows === 15) return "A4";
  return null;
}

/** A4 블록 줄: 윗면(2×3칸) 3줄 → 벽면(2×2칸) 2줄을 세 번. 반환 = [블록 첫 줄, 줄 수, 종류]. */
function a4Band(row: number): [number, number, "top" | "side"] | null {
  const bands: [number, number, "top" | "side"][] = [[0, 3, "top"], [3, 2, "side"], [5, 3, "top"], [8, 2, "side"], [10, 3, "top"], [13, 2, "side"]];
  return bands.find(([y, h]) => row >= y && row < y + h) ?? null;
}

/**
 * 오토타일 블록 안 칸 (col,row) 를 눌렀을 때 그 블록에서 뗄 이음매 없는 픽셀 창.
 * - 윗면·바닥 블록(2×3): 아래 2×2 칸의 4×4 쿼터 중 가운데 2×2 쿼터 → surface(바닥·천장으로 쓴다).
 * - A4 벽면 블록(2×2): 가운데 열(반 칸 오른쪽)의 위 줄·아래 줄 → wallTop·wallBottom.
 */
export function rpgMakerBlockPicks(kind: "A2" | "A4", col: number, row: number, T: number): { surface?: RoomKitCell; wallTop?: RoomKitCell; wallBottom?: RoomKitCell } | null {
  const bx = Math.floor(col / 2) * 2 * T, h = T / 2;
  if (kind === "A2") {
    const by = Math.floor(row / 3) * 3 * T;
    return { surface: { px: bx + h, py: by + T + h } };
  }
  const band = a4Band(row);
  if (!band) return null;
  const by = band[0] * T;
  if (band[2] === "top") return { surface: { px: bx + h, py: by + T + h } };
  return { wallTop: { px: bx + h, py: by }, wallBottom: { px: bx + h, py: by + T } };
}

/**
 * AI 초안 — 시트 그림(가장자리에 열·줄 번호를 단 것)을 보여 주고 바닥·벽면·천장 자리를 묻는다. 답은 열·줄 좌표 JSON.
 * 사람은 견본 방을 보고 고친다(초안을 그대로 저장하지 않는다).
 */
export function roomKitDraftPrompt(cols: number, rows: number): string {
  return [
    `This is an RPG tileset sheet, ${cols} columns × ${rows} rows of tiles. Column numbers are printed along the top edge and row numbers along the left edge (both start at 0).`,
    "I will build top-down 3/4-view interior rooms from it. Find these four things:",
    "1. floor: an indoor floor surface that repeats seamlessly (wood planks, stone flags, tiles, carpet). A rectangle of 1-4 columns × 1-4 rows that tiles without visible seams.",
    "2. wallTop and wallBottom: the FRONT FACE of an interior wall as seen from the room (bricks/plaster/wood panels standing vertically, usually with a baseboard at the bottom). wallTop is the upper row and wallBottom the row just below it; both are the same horizontal run of 1-4 columns. If the sheet stores the face rows side by side instead of stacked, give each row's own position.",
    "3. ceiling: one tile for the solid area outside/above rooms — a dark plain fill, wall-top or roof surface with little pattern.",
    "Prefer the plainest, most repeatable tiles. Never pick furniture, characters, doors, windows or transparent tiles.",
    'Answer with JSON only: {"floor":{"col":0,"row":0,"w":1,"h":1},"wallTop":{"col":0,"row":0,"w":1},"wallBottom":{"col":0,"row":0,"w":1},"ceiling":{"col":0,"row":0},"reason":"one short sentence"}',
  ].join("\n");
}

/** 글 속 첫 JSON 객체(코드 울타리·앞뒤 말 무시, 문자열 안 괄호는 센다). */
function firstJsonObject(text: string): Record<string, unknown> | null {
  for (let start = text.indexOf("{"); start >= 0; start = text.indexOf("{", start + 1)) {
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < text.length; i++) {
      const ch = text[i]!;
      if (inStr) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') inStr = true;
      else if (ch === "{") depth++;
      else if (ch === "}" && --depth === 0) {
        try { const v = JSON.parse(text.slice(start, i + 1)) as unknown; if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>; } catch { /* 다음 후보 */ }
        break;
      }
    }
  }
  return null;
}

/** AI 초안 답 → 고른 칸. 모양이 틀리면 문장(사람에게 보인다). */
export function parseRoomKitDraft(text: string, cols: number, rows: number): { picks: RoomKitPicks; reason: string } | string {
  let raw: Record<string, { col?: unknown; row?: unknown; w?: unknown; h?: unknown } | string | undefined>;
  const found = firstJsonObject(text);
  if (!found) return `AI 답을 읽지 못했습니다: ${text.slice(0, 160)}`;
  raw = found as typeof raw;
  const num = (v: unknown, lo: number, hi: number) => (Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi ? (v as number) : null);
  const box = (key: string, needH: boolean) => {
    const v = raw[key];
    if (!v || typeof v !== "object") return null;
    const col = num(v.col, 0, cols - 1), row = num(v.row, 0, rows - 1);
    const w = v.w === undefined ? 1 : num(v.w, 1, 8), h = !needH || v.h === undefined ? 1 : num(v.h, 1, 8);
    if (col === null || row === null || w === null || h === null || col + w > cols || row + h > rows) return null;
    return { col, row, w, h };
  };
  const f = box("floor", true), wt = box("wallTop", false), wb = box("wallBottom", false), c = box("ceiling", false);
  if (!f || !wt || !wb || !c) return "AI 초안의 좌표가 시트 밖이거나 빠졌습니다 — 직접 골라 주세요.";
  const runOf = (b: { col: number; row: number; w: number }, w: number) => Array.from({ length: w }, (_, i) => b.row * cols + b.col + i);
  const ww = Math.min(wt.w, wb.w);
  return {
    picks: {
      floor: Array.from({ length: f.h }, (_, y) => Array.from({ length: f.w }, (_, x) => (f.row + y) * cols + f.col + x)),
      wall: [runOf(wt, ww), runOf(wb, ww)],
      ceiling: c.row * cols + c.col,
    },
    reason: typeof raw.reason === "string" ? raw.reason.slice(0, 200) : "",
  };
}
