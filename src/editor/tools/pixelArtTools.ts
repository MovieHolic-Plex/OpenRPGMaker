// author_pixel_art — 조수가 «행 문자열 + 팔레트»로 도트를 직접 찍어 이 프로젝트에 넣는다.
// 맞는 칩셋·기물·그림이 없을 때 «없다»고 멈추지 않고 만들 수 있게 하는 입구다. 세 종류:
//   object  : 맵에 놓는 물체(16px 칸 단위) — 칩셋 끝에 굽고 id `workshop:<이름>` 으로 stamp_tileset_object 가 찍는다.
//   charset : 걷는 캐릭터셋(24×32, 위·오른쪽·아래·왼쪽 × 걷기 3프레임) — 컷신 배우 character:{resourceId, characterIndex}.
//   picture : 컷신·연출용 그림 한 장(투명 배경 소품 또는 배경).
// 그림 생성이 아니라 모델이 한 화소씩 쓰는 도트라서, 같은 입력은 같은 그림이고 모델 호출 대기가 없다.
// 3/4 탑뷰 관문(object-gate)은 이 도구에 아직 배선돼 있지 않다 — 결과 요약이 그 사실을 그대로 말한다(프로젝트 로컬 사용 전제).
import { bundledChipsetTilesPerRow } from "@/assets/bundledChipsetGeometry";
import { encodePng, type RgbaImage } from "@/editor/cutsceneArt/imageProcess";
import { artStats, autoWalkFrames, flipHorizontal, padToTiles, parsePalette, parseRows, PixelArtError, previewImage, rowsToImage, sliceTiles, tilesToSheet, touchesBottom } from "@/editor/pixelArt/rowsImage";
import { bakeWorkshopObject, workshopAssetId, WORKSHOP_OBJECT_PREFIX, type WorkshopHandKind } from "@/project/workshopTiles";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

export const PIXEL_ART_TOOL = "author_pixel_art";

const TILE = 16, FRAME_W = 24, FRAME_H = 32, SHEET_W = 288, SHEET_H = 256;
const DIRECTIONS = ["up", "right", "down", "left"] as const;
type Dir = (typeof DIRECTIONS)[number];
const OBJECT_KINDS = { standing: "floor", flat: "flat", wall_front: "wall", wall_hung: "hang" } as const satisfies Record<string, WorkshopHandKind>;

interface Prepared {
  readonly kind: "object" | "charset" | "picture";
  readonly id: string;
  readonly name: string;
  readonly dataUrl?: string;
  readonly previewUrl?: string;
  readonly width?: number;
  readonly height?: number;
  readonly sheetDataUrl?: string;
  readonly cells?: { sourceTile: number; dx: number; dy: number }[];
  readonly columns?: number;
  readonly rows?: number;
  readonly padTop?: number;
  readonly characters?: string[];
  readonly warnings?: string[];
  readonly error?: string;
}
const prepared = new Map<string, Prepared>();

/** 영문·숫자 조각만 남긴다. 한글 이름처럼 다 지워지면 이름 해시로 대신해 서로 다른 그림이 같은 id 로 겹치지 않게 한다. */
function slug(text: string): string {
  const base = text.toLowerCase().replace(/[^a-z0-9]+/gu, "_").replace(/^_+|_+$/gu, "");
  if (base) return base;
  let h = 0x811c9dc5;
  for (const ch of text) { h ^= ch.codePointAt(0)!; h = Math.imul(h, 0x01000193); }
  return `n${(h >>> 0).toString(36)}`;
}
function idOf(args: Record<string, unknown>, prefix: string): string {
  const raw = typeof args.id === "string" && args.id.trim() ? args.id : typeof args.name === "string" ? args.name : "art";
  return `${prefix}${slug(raw)}`;
}
const nameOf = (args: Record<string, unknown>, fallback: string): string => (typeof args.name === "string" && args.name.trim() ? args.name.trim() : fallback);
const asRecord = (value: unknown, field: string): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new PixelArtError(`${field} 는 객체여야 합니다.`);
  return value as Record<string, unknown>;
};

function frameImage(raw: unknown, palette: ReturnType<typeof parsePalette>, field: string): RgbaImage {
  const rows = parseRows(raw, field);
  const image = rowsToImage(rows, palette, field);
  if (image.width !== FRAME_W || image.height !== FRAME_H) throw new PixelArtError(`${field} 는 ${FRAME_W}×${FRAME_H} 여야 합니다(받은 크기 ${image.width}×${image.height}) — 가로 ${FRAME_W}글자 × ${FRAME_H}줄.`);
  return image;
}

function blit(dst: RgbaImage, src: RgbaImage, ox: number, oy: number): void {
  for (let y = 0; y < src.height; y += 1) dst.data.set(src.data.subarray(y * src.width * 4, (y + 1) * src.width * 4), ((oy + y) * dst.width + ox) * 4);
}

async function buildCharset(args: Record<string, unknown>): Promise<Prepared> {
  const palette = parsePalette(args.palette);
  const list = Array.isArray(args.characters) ? (args.characters as unknown[]) : [];
  if (list.length < 1 || list.length > 8) throw new PixelArtError("characters 는 1~8명이어야 합니다(캐릭터셋 한 장 = 4×2 인물).");
  const sheet: RgbaImage = { width: SHEET_W, height: SHEET_H, data: new Uint8ClampedArray(SHEET_W * SHEET_H * 4) };
  const names: string[] = [];
  const warnings: string[] = [];
  list.forEach((entry, i) => {
    const c = asRecord(entry, `characters[${i}]`);
    names.push(typeof c.name === "string" && c.name.trim() ? c.name.trim() : `캐릭터${i + 1}`);
    const dirs = asRecord(c.directions, `characters[${i}].directions`);
    const frames: Partial<Record<Dir, [RgbaImage, RgbaImage, RgbaImage]>> = {};
    for (const dir of DIRECTIONS) {
      const raw = dirs[dir];
      if (raw === undefined) continue;
      const d = asRecord(raw, `characters[${i}].directions.${dir}`);
      const stand = frameImage(d.stand, palette, `characters[${i}].directions.${dir}.stand`);
      const [autoA, autoB] = autoWalkFrames(stand);
      const a = d.stepA !== undefined ? frameImage(d.stepA, palette, `characters[${i}].directions.${dir}.stepA`) : autoA;
      const b = d.stepB !== undefined ? frameImage(d.stepB, palette, `characters[${i}].directions.${dir}.stepB`) : autoB;
      if (d.stepA === undefined || d.stepB === undefined) warnings.push(`${names[i]} ${dir}: 걷기 프레임을 안 줘서 서 있는 그림에서 자동으로 만들었습니다(다리 한쪽을 1px 들어 올림). 더 자연스럽게 하려면 stepA/stepB 를 직접 찍으세요.`);
      frames[dir] = [a, stand, b];
    }
    if (!frames.down || !frames.up) throw new PixelArtError(`characters[${i}].directions 에는 최소 down(정면)과 up(뒷모습)이 있어야 합니다.`);
    if (!frames.right && !frames.left) throw new PixelArtError(`characters[${i}].directions 에는 right 또는 left(옆모습) 하나가 있어야 합니다 — 반대쪽은 뒤집어 만듭니다.`);
    if (!frames.right) frames.right = frames.left!.map(flipHorizontal) as [RgbaImage, RgbaImage, RgbaImage];
    if (!frames.left) frames.left = frames.right.map(flipHorizontal) as [RgbaImage, RgbaImage, RgbaImage];
    const ox = (i % 4) * (FRAME_W * 3), oy = Math.floor(i / 4) * (FRAME_H * 4);
    DIRECTIONS.forEach((dir, row) => frames[dir]!.forEach((frame, col) => blit(sheet, frame, ox + col * FRAME_W, oy + row * FRAME_H)));
    const stats = artStats(frames.down[1]);
    if (stats.coverage < 0.12) warnings.push(`${names[i]}: 정면 그림이 칸의 ${Math.round(stats.coverage * 100)}%만 칠해져 너무 작습니다 — 24×32 칸을 거의 채우는 크기로 찍으세요.`);
    if (!touchesBottom(frames.down[1])) warnings.push(`${names[i]}: 발이 칸의 맨 아래 줄에 닿지 않아 맵에서 떠 보입니다.`);
  });
  const id = idOf(args, "charset_");
  return { kind: "charset", id, name: nameOf(args, "도트 캐릭터셋"), dataUrl: await encodePng(sheet), previewUrl: await encodePng(previewImage(sheet, 3)), width: SHEET_W, height: SHEET_H, characters: names, warnings };
}

async function buildObject(args: Record<string, unknown>): Promise<Prepared> {
  const palette = parsePalette(args.palette);
  const rows = parseRows(args.rows, "rows");
  const raw = rowsToImage(rows, palette, "rows");
  if (raw.width > 128 || raw.height > 128) throw new PixelArtError(`물체 그림은 128×128 이하여야 합니다(받은 크기 ${raw.width}×${raw.height}). 더 큰 건물은 부품으로 나눠 여러 번 만드세요.`);
  if (raw.width < 8 || raw.height < 8) throw new PixelArtError(`물체 그림이 ${raw.width}×${raw.height}로 너무 작습니다(8×8 이상).`);
  const stats = artStats(raw);
  if (stats.opaque === 0) throw new PixelArtError("그림이 비어 있습니다.");
  const warnings: string[] = [];
  if (stats.colors < 4) warnings.push(`색이 ${stats.colors}가지뿐이라 입체감이 없습니다 — 한 재질에 어두운 외곽선·그림자·바탕·밝은 면 4단 이상을 쓰세요.`);
  if (stats.coverage < 0.2) warnings.push(`캔버스의 ${Math.round(stats.coverage * 100)}%만 칠해졌습니다 — 캔버스를 그림에 맞게 줄이세요.`);
  const kindArg = typeof args.kind === "string" && args.kind in OBJECT_KINDS ? (args.kind as keyof typeof OBJECT_KINDS) : "standing";
  if ((kindArg === "standing" || kindArg === "wall_front") && !touchesBottom(raw)) throw new PixelArtError("서 있는 물체는 발밑이 캔버스 맨 아래 줄에 닿아야 합니다(바닥에 붙어 보이게) — 마지막 줄에 칠한 화소를 두거나, 떠 있는 그림이면 kind 를 flat 이나 wall_hung 으로 하세요.");
  const { image, padTop } = padToTiles(raw, TILE);
  const tiles = sliceTiles(image, TILE);
  const perRow = bundledChipsetTilesPerRow("workshop_");
  const sheet = tilesToSheet(tiles, TILE, perRow);
  const id = `${WORKSHOP_OBJECT_PREFIX}${slug(typeof args.id === "string" && args.id.trim() ? args.id : nameOf(args, "object"))}`;
  return {
    kind: "object", id, name: nameOf(args, "도트 물체"), dataUrl: await encodePng(sheet), previewUrl: await encodePng(previewImage(image, 6)),
    width: sheet.width, height: sheet.height, columns: image.width / TILE, rows: image.height / TILE, padTop,
    cells: tiles.map((t, k) => ({ sourceTile: k, dx: t.dx, dy: t.dy })), warnings,
  };
}

async function buildPicture(args: Record<string, unknown>): Promise<Prepared> {
  const palette = parsePalette(args.palette);
  const image = rowsToImage(parseRows(args.rows, "rows"), palette, "rows");
  if (image.width > 480 || image.height > 270) throw new PixelArtError(`그림은 480×270 이하여야 합니다(받은 크기 ${image.width}×${image.height}).`);
  if (artStats(image).opaque === 0) throw new PixelArtError("그림이 비어 있습니다.");
  const id = idOf(args, "pixelart_");
  return { kind: "picture", id, name: nameOf(args, "도트 그림"), dataUrl: await encodePng(image), previewUrl: await encodePng(previewImage(image, image.width <= 120 ? 4 : 2)), width: image.width, height: image.height, warnings: [] };
}

const keyOf = (args: Record<string, unknown>): string => JSON.stringify([args.kind, args.id ?? args.name]);

/** 조수가 방금 찍은 그림을 눈으로 검수하게 하는 확대 미리보기. */
export function pixelArtPreview(data: unknown): { dataUrl: string; label: string } | null {
  const d = data as { kind?: string; id?: string; resourceId?: string; objectId?: string } | undefined;
  const made = [...prepared.values()].find((p) => p.id === (d?.objectId ?? d?.resourceId ?? d?.id));
  return made?.previewUrl ? { dataUrl: made.previewUrl, label: `${made.name} (${made.kind}, 확대)` } : null;
}

const authorPixelArt: ToolDefinition = {
  name: PIXEL_ART_TOOL,
  description:
    "맞는 칩셋·물체·캐릭터·그림이 없을 때 «없다»고 멈추지 말고 도트를 직접 찍어 이 프로젝트에 넣는다. 문자 한 글자 = 화소 한 칸, '.' = 투명, palette 에 {글자:'#rrggbb'}. "
    + "kind:\"object\" — 맵에 놓을 물체(예: 부서진 기계 잔해, 깃발, 간판, 조형물). 16px 칸 단위 칩셋에 구워 id `workshop:<이름>` 로 등록되니 stamp_tileset_object 의 objectId 로 놓는다. "
    + "kind:\"charset\" — 맵 위를 걷는 캐릭터·기계·탈것(24×32, directions 마다 stand 한 장+선택 stepA/stepB, 안 주면 걷기를 자동 생성). 컷신 배우로 character:{resourceId, characterIndex}. "
    + "kind:\"picture\" — 컷신용 도트 그림 한 장(소품·배경, 480×270 이하). "
    + "그리는 법: 3/4 탑뷰(윗면이 면으로 보이고 앞면이 보이는 시점, 옆면 금지), 1px 어두운 외곽선, 재질마다 4~6단 명암(윗면이 가장 밝고 앞면이 어둡다), 발밑은 맨 아래 줄에 붙인다. 그림이 이 맵의 칩셋 색과 어울리도록 먼저 show_tiles·list_tileset_objects 로 기존 조각 색을 본 뒤 팔레트를 고른다. "
    + "도구가 확대 미리보기를 돌려주니 반드시 눈으로 보고 비뚤거나 알아보기 어렵거나 잘리면 같은 id 로 다시 호출해 고친다. 이 그림은 3/4 탑뷰 관문(object-gate) 영수증이 없다 — 이 프로젝트에서만 쓰고 공용·스토어에 올리지 않는다.",
  mode: "write",
  domains: ["event", "tile", "map"],
  fillsCurrentMapId: true,
  parameters: {
    type: "object", additionalProperties: false, required: ["kind", "name", "palette"],
    properties: {
      kind: { type: "string", enum: ["object", "charset", "picture"] },
      name: { type: "string", description: "이름(예: 부서진 정찰기 잔해)" },
      id: { type: "string", description: "영문 id 조각(선택, 같은 id 로 다시 부르면 그림을 갈아 끼움)" },
      mapId: { type: "string", description: "object 일 때 어느 맵의 칩셋에 넣을지(생략하면 지금 보는 맵)" },
      palette: { type: "object", additionalProperties: true, description: "{글자:'#rrggbb'} 40색 이하. '.' 는 투명이라 넣지 않는다." },
      objectKind: { type: "string", enum: ["standing", "flat", "wall_front", "wall_hung"], description: "object 종류: standing 서 있는 물체(발밑 1줄이 막힘) · flat 밟고 지나는 바닥 무늬 · wall_front 벽 앞 물체 · wall_hung 벽에 거는 것" },
      rows: { type: "array", items: { type: "string" }, description: "object·picture 의 화소 행 문자열들(모두 같은 길이). object 는 128×128 이하." },
      footRows: { type: "integer", minimum: 1, maximum: 4, description: "object: 발밑(통행이 막히는) 칸 줄 수. 기본 1" },
      description: { type: "string", description: "object: 무엇인지 한 줄(칩셋 이름표에 남는다)" },
      characters: {
        type: "array", minItems: 1, maxItems: 8,
        description: "charset: 인물 목록. 각 인물은 {name, directions:{down:{stand:[32줄×24글자]}, up:{stand}, right:{stand, stepA?, stepB?}, left?}}. left 를 생략하면 right 를 뒤집는다.",
        items: { type: "object", additionalProperties: true },
      },
    },
  },
  invalidArgsExample: {
    kind: "object", name: "깃발", palette: { k: "#1b1b26", r: "#b03a48", R: "#d9606c", w: "#8a6a44" },
    rows: ["....kkkkkkkk....", "....kRRRRRRk....", "....krrrrrrk....", "....krrrrrrk....", "....kkkkkkkk....", "....kw..........", "....kw..........", "....kw..........", "....kw..........", "....kw..........", "....kw..........", "....kw..........", "....kw..........", "....kw..........", "...kkwk.........", "..kkkkkk........"],
  },
  async prepare(args): Promise<void> {
    const key = keyOf(args);
    try {
      const kind = args.kind;
      if (kind === "object") prepared.set(key, await buildObject(args));
      else if (kind === "charset") prepared.set(key, await buildCharset(args));
      else if (kind === "picture") prepared.set(key, await buildPicture(args));
      else throw new PixelArtError("kind 는 object · charset · picture 중 하나여야 합니다.");
    } catch (error) {
      prepared.set(key, { kind: "object", id: "", name: "", error: error instanceof Error ? error.message : String(error) });
    }
  },
  run(draft, args): ToolExecResult {
    const made = prepared.get(keyOf(args));
    if (!made) throw new ToolError("그림이 준비되지 않았습니다 — 같은 인자로 다시 호출하세요.", { code: "art-not-prepared" });
    if (made.error || !made.dataUrl) throw new ToolError(`도트를 만들지 못했습니다: ${made.error ?? "알 수 없는 오류"}`, { code: "pixel-art-invalid" });
    const warnings = made.warnings ?? [];
    const gateNote = "3/4 관문 영수증 없음 — 이 프로젝트에서만 쓰세요.";
    if (made.kind === "charset") {
      draft.assets.uploaded[made.id] = { id: made.id, name: made.name, kind: "charset", generatedBy: "pixel-art", dataUrl: made.dataUrl, meta: { width: SHEET_W, height: SHEET_H } } as never;
      return {
        summary: `걷는 캐릭터셋 '${made.name}'(${made.id}) ${made.characters!.length}명 등록: ${made.characters!.map((n, i) => `${i}=${n}`).join(", ")}. script_cutscene_staged actors[].character:{resourceId:"${made.id}", characterIndex:N} 로 쓰세요. ${gateNote}`,
        warnings, data: { resourceId: made.id, characters: made.characters!.map((n, i) => ({ name: n, characterIndex: i })) },
      };
    }
    if (made.kind === "picture") {
      draft.assets.uploaded[made.id] = { id: made.id, name: made.name, kind: "picture", generatedBy: "pixel-art", dataUrl: made.dataUrl, meta: { width: made.width!, height: made.height! } } as never;
      return { summary: `도트 그림 '${made.name}'(${made.id}, ${made.width}×${made.height})을 등록했습니다. script_cutscene_staged 의 배우(resourceId)나 backdropResourceId 로 쓰세요. ${gateNote}`, warnings, data: { resourceId: made.id, width: made.width, height: made.height } };
    }
    const mapId = typeof args.mapId === "string" && draft.maps[args.mapId] ? args.mapId : (draft.startMapId as string);
    const map = draft.maps[mapId];
    const tilesetId = map?.tilesetId as string | undefined;
    const tileset = tilesetId ? draft.tilesets[tilesetId] : undefined;
    if (!map || !tilesetId || !tileset) throw new ToolError("물체를 넣을 맵·칩셋을 찾지 못했습니다 — mapId 를 주세요.", { code: "no-tileset" });
    if (tileset.tileSize !== TILE) throw new ToolError(`이 맵의 칩셋은 ${tileset.tileSize}px 칸이라 16px 도트 물체를 넣을 수 없습니다. 같은 그림을 kind:\"picture\" 로 만들어 연출에 쓰거나, 16px 칩셋 맵에서 부르세요.`, { code: "tile-size-mismatch" });
    const kindArg = typeof args.objectKind === "string" && args.objectKind in OBJECT_KINDS ? (args.objectKind as keyof typeof OBJECT_KINDS) : "standing";
    const footRows = typeof args.footRows === "number" ? Math.max(1, Math.min(made.rows!, Math.floor(args.footRows))) : 1;
    const gridHash = `${made.dataUrl.length}:${made.dataUrl.slice(-48)}`;
    const kit = bakeWorkshopObject(draft, tilesetId, {
      objectId: made.id, title: made.name, description: typeof args.description === "string" ? args.description : made.name,
      kind: OBJECT_KINDS[kindArg], columns: made.columns!, rows: made.rows!, footRows,
      risePx: Math.max(0, (made.rows! - footRows) * TILE - made.padTop!), use: [], gridHash,
      asset: { id: workshopAssetId(made.dataUrl), dataUrl: made.dataUrl, width: made.width!, height: made.height! }, cells: made.cells!,
    });
    return {
      summary: `물체 '${made.name}'(${kit.id}, ${made.columns}×${made.rows}칸)을 칩셋 ${tilesetId} 에 구웠습니다. stamp_tileset_object 의 objectId:\"${kit.id}\" 로 맵에 놓으세요. ${gateNote}`,
      warnings, data: { objectId: kit.id, tilesetId, columns: made.columns, rows: made.rows },
    };
  },
};

export const PIXEL_ART_TOOLS: readonly ToolDefinition[] = [authorPixelArt];
