// 번들 칩셋 타일 시맨틱 테이블의 전수 커버리지·중복·라벨 고유성 검증기.
//
// 왜: 리포트(.omo/ulw-research/20260826-151943)에서 측정된 실패 양식은 두 가지였다.
//   1. "설명이 채워진 1,986칸" 전부가 그룹 설명 한 줄을 복제한 것 — 타일별 고유 서술은 0개.
//   2. 같은 인덱스가 큐레이션 테이블에 두 번 들어가 소비자마다 다른 답을 내는 중복(246·288·306).
// 이 스크립트는 그 두 실패를 바이너리로 잡는다. 통과 기준을 느슨하게 고치는 것은 회귀다.
//
// 사용:
//   vite-node scripts/verify-tile-semantics.mts            # 사람이 읽는 표
//   vite-node scripts/verify-tile-semantics.mts --json     # 기계 판독용
//   vite-node scripts/verify-tile-semantics.mts --sheet ship
//
// exit 0 = 모든 대상 시트 통과, exit 1 = 하나라도 실패.

import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

interface SemanticEntryLike {
  readonly index: number;
  readonly label: string;
  readonly role: string;
  readonly passage: "passable" | "solid";
  readonly tags: readonly string[];
}

interface SheetSpec {
  /** 검증 대상 식별자 (--sheet 인자와 일치) */
  readonly id: string;
  /** 번들 textureKey */
  readonly textureKey: string;
  /** 알파 채널이 있는 시트 PNG (public/ 기준 상대 경로) */
  readonly png: string;
  /** 시맨틱 테이블 모듈 (repo 루트 기준) */
  readonly module: string;
  /** 모듈이 내보내는 상수 이름 */
  readonly exportName: string;
}

/** 이번 범위: EasyRPG 번들 6종. scarloxy_* 와 modern_exteriors_nocturne 는 범위 밖이다. */
const SHEETS: readonly SheetSpec[] = [
  { id: "retro_dungeon", textureKey: "tex_easyrpg_chipset_retro_dungeon", png: "public/assets/easyrpg-chipset-retro-dungeon-transparent.png", module: "../src/project/defaults/tileSemanticsRetroDungeon.ts", exportName: "RETRO_DUNGEON_TILE_SEMANTICS" },
  { id: "retro_exterior", textureKey: "tex_easyrpg_chipset_retro_exterior", png: "public/assets/easyrpg-chipset-retro-exterior-transparent.png", module: "../src/project/defaults/tileSemanticsRetroExterior.ts", exportName: "RETRO_EXTERIOR_TILE_SEMANTICS" },
  { id: "retro_house", textureKey: "tex_easyrpg_chipset_retro_house", png: "public/assets/easyrpg-chipset-retro-house-transparent.png", module: "../src/project/defaults/tileSemanticsRetroHouse.ts", exportName: "RETRO_HOUSE_TILE_SEMANTICS" },
  { id: "retro_world", textureKey: "tex_easyrpg_chipset_retro_world", png: "public/assets/easyrpg-chipset-retro-world-transparent.png", module: "../src/project/defaults/tileSemanticsRetroWorld.ts", exportName: "RETRO_WORLD_TILE_SEMANTICS" },
  { id: "ship", textureKey: "tex_easyrpg_chipset_ship", png: "public/assets/easyrpg-chipset-ship-transparent.png", module: "../src/project/defaults/tileSemanticsShip.ts", exportName: "SHIP_TILE_SEMANTICS" },
  { id: "world", textureKey: "tex_easyrpg_chipset_world", png: "public/assets/easyrpg-chipset-world-transparent.png", module: "../src/project/defaults/tileSemanticsWorld.ts", exportName: "WORLD_TILE_SEMANTICS" },
];

/** 30타일/행 × 16행 = 480 슬롯. RPG Maker 2000 칩셋 규약. */
const COLS = 30;
const ROWS = 16;
const TILE = 16;
const SLOTS = COLS * ROWS;

/** 라벨 하나가 덮을 수 있는 최대 칸 수 — 이 위로 가면 "그룹 설명 복제" 양식이다. */
const MAX_TILES_PER_LABEL = 24;
/** 시트당 최소 고유 라벨 수. */
const MIN_DISTINCT_LABELS = 60;
/** 허용 role 값 — 소비자(resourceSearch/tileMetadataTools)가 문자열로 필터한다. */
const ALLOWED_PASSAGE = new Set(["passable", "solid"]);

/**
 * EasyRPG 칩셋의 분홍 배경색 키 — src/assets/chipsetTransparency.ts 의
 * INTERIOR_CHIPSET_OBJECT_BACKGROUND 와 동일한 값이다. 이 색만으로 채워진 칸은
 * 서술할 아트가 없는 무진 슬롯이다(실상: ship 16칸, world 2칸).
 */
const KEY_COLOR = { r: 255, g: 103, b: 139 } as const;
const KEY_TOLERANCE = 12;

interface EmptySlots {
  /** 알파 0 — 진짜 무진 공기 */
  readonly alphaEmpty: Set<number>;
  /** 컴러키 단색 — 아트 없음 */
  readonly keyColorEmpty: Set<number>;
  /** 도화 대상에서 제외할 합집합 */
  readonly all: Set<number>;
}

/** 서술할 아트가 없는 슬롯(알파 0 또는 컴러키 단색)을 실제 픽셀에서 구한다. */
function emptySlots(pngPath: string): EmptySlots {
  const png = PNG.sync.read(fs.readFileSync(pngPath));
  if (png.width !== COLS * TILE || png.height !== ROWS * TILE) {
    throw new Error(`${pngPath}: 예상 ${COLS * TILE}x${ROWS * TILE}, 실제 ${png.width}x${png.height}`);
  }
  const alphaEmpty = new Set<number>();
  const keyColorEmpty = new Set<number>();
  for (let slot = 0; slot < SLOTS; slot += 1) {
    const row = Math.floor(slot / COLS);
    const col = slot % COLS;
    let opaque = false;
    let allKey = true;
    for (let y = 0; y < TILE; y += 1) {
      for (let x = 0; x < TILE; x += 1) {
        const idx = ((row * TILE + y) * png.width + (col * TILE + x)) * 4;
        if (png.data[idx + 3]! <= 8) continue;
        opaque = true;
        const d =
          Math.abs(png.data[idx]! - KEY_COLOR.r) +
          Math.abs(png.data[idx + 1]! - KEY_COLOR.g) +
          Math.abs(png.data[idx + 2]! - KEY_COLOR.b);
        if (d >= KEY_TOLERANCE) allKey = false;
      }
    }
    if (!opaque) alphaEmpty.add(slot);
    else if (allKey) keyColorEmpty.add(slot);
  }
  return { alphaEmpty, keyColorEmpty, all: new Set([...alphaEmpty, ...keyColorEmpty]) };
}

interface SheetResult {
  sheet: string;
  textureKey: string;
  moduleFound: boolean;
  drawable: number;
  emptyAir: number[];
  keyColorEmpty: number[];
  covered: number;
  missing: number[];
  duplicateIndexes: number[];
  outOfRange: number[];
  distinctLabels: number;
  maxTilesPerLabel: number;
  worstLabel: string | null;
  emptyLabels: number[];
  badPassage: number[];
  taglessEntries: number[];
  pass: boolean;
  failures: string[];
}

async function loadTable(spec: SheetSpec): Promise<readonly SemanticEntryLike[] | null> {
  const abs = path.resolve(import.meta.dirname, spec.module);
  if (!fs.existsSync(abs)) return null;
  const mod = (await import(`file://${abs.replace(/\\/g, "/")}`)) as Record<string, unknown>;
  const table = mod[spec.exportName];
  if (!Array.isArray(table)) {
    throw new Error(`${spec.module}: export ${spec.exportName} 가 배열이 아니다`);
  }
  return table as readonly SemanticEntryLike[];
}

async function verifySheet(spec: SheetSpec): Promise<SheetResult> {
  const slots = emptySlots(spec.png);
  const empty = slots.all;
  const drawable = SLOTS - empty.size;
  const base: SheetResult = {
    sheet: spec.id,
    textureKey: spec.textureKey,
    moduleFound: false,
    drawable,
    emptyAir: [...slots.alphaEmpty].sort((a, b) => a - b),
    keyColorEmpty: [...slots.keyColorEmpty].sort((a, b) => a - b),
    covered: 0,
    missing: [],
    duplicateIndexes: [],
    outOfRange: [],
    distinctLabels: 0,
    maxTilesPerLabel: 0,
    worstLabel: null,
    emptyLabels: [],
    badPassage: [],
    taglessEntries: [],
    pass: false,
    failures: [],
  };

  let table: readonly SemanticEntryLike[] | null = null;
  try {
    table = await loadTable(spec);
  } catch (error) {
    base.failures.push(`모듈 로드 실패: ${(error as Error).message}`);
    return base;
  }
  if (!table) {
    base.failures.push(`모듈 없음: ${spec.module}`);
    base.missing = Array.from({ length: SLOTS }, (_, i) => i).filter((i) => !empty.has(i));
    return base;
  }

  base.moduleFound = true;
  const seen = new Map<number, number>();
  const labelCount = new Map<string, number>();
  for (const entry of table) {
    seen.set(entry.index, (seen.get(entry.index) ?? 0) + 1);
    if (entry.index < 0 || entry.index >= SLOTS) base.outOfRange.push(entry.index);
    const label = typeof entry.label === "string" ? entry.label.trim() : "";
    if (!label) base.emptyLabels.push(entry.index);
    else labelCount.set(label, (labelCount.get(label) ?? 0) + 1);
    if (!ALLOWED_PASSAGE.has(entry.passage)) base.badPassage.push(entry.index);
    if (!Array.isArray(entry.tags) || entry.tags.length === 0) base.taglessEntries.push(entry.index);
  }

  base.duplicateIndexes = [...seen.entries()].filter(([, n]) => n > 1).map(([i]) => i).sort((a, b) => a - b);
  base.missing = Array.from({ length: SLOTS }, (_, i) => i).filter((i) => !empty.has(i) && !seen.has(i));
  base.covered = drawable - base.missing.length;
  base.distinctLabels = labelCount.size;
  const worst = [...labelCount.entries()].sort((a, b) => b[1] - a[1])[0];
  base.maxTilesPerLabel = worst ? worst[1] : 0;
  base.worstLabel = worst ? worst[0] : null;

  if (base.missing.length > 0) base.failures.push(`미커버 ${base.missing.length}칸 (예: ${base.missing.slice(0, 12).join(",")})`);
  if (base.duplicateIndexes.length > 0) base.failures.push(`중복 인덱스 ${base.duplicateIndexes.length}개: ${base.duplicateIndexes.slice(0, 12).join(",")}`);
  if (base.outOfRange.length > 0) base.failures.push(`범위 밖 인덱스: ${base.outOfRange.slice(0, 12).join(",")}`);
  const coveredEmpty = [...empty].filter((i) => seen.has(i)).sort((a, b) => a - b);
  if (coveredEmpty.length > 0) base.failures.push(`아트 없는 칸에 엔트리: ${coveredEmpty.join(",")}`);
  if (base.distinctLabels < MIN_DISTINCT_LABELS) base.failures.push(`고유 라벨 ${base.distinctLabels} < ${MIN_DISTINCT_LABELS}`);
  if (base.maxTilesPerLabel > MAX_TILES_PER_LABEL) base.failures.push(`라벨 "${base.worstLabel}" 가 ${base.maxTilesPerLabel}칸 (> ${MAX_TILES_PER_LABEL}) — 그룹 설명 복제 양식`);
  if (base.emptyLabels.length > 0) base.failures.push(`빈 라벨 엔트리: ${base.emptyLabels.slice(0, 12).join(",")}`);
  if (base.badPassage.length > 0) base.failures.push(`passage 값 오류: ${base.badPassage.slice(0, 12).join(",")}`);
  if (base.taglessEntries.length > 0) base.failures.push(`태그 없는 엔트리: ${base.taglessEntries.slice(0, 12).join(",")}`);

  base.pass = base.failures.length === 0;
  return base;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const asJson = args.includes("--json");
  const sheetArg = args.indexOf("--sheet");
  const only = sheetArg >= 0 ? args[sheetArg + 1] : null;
  const targets = only ? SHEETS.filter((s) => s.id === only) : SHEETS;
  if (targets.length === 0) {
    console.error(`알 수 없는 시트: ${only}. 가능: ${SHEETS.map((s) => s.id).join(", ")}`);
    process.exit(2);
  }

  const results: SheetResult[] = [];
  for (const spec of targets) results.push(await verifySheet(spec));
  const allPass = results.every((r) => r.pass);

  if (asJson) {
    console.log(JSON.stringify({ pass: allPass, sheets: results }, null, 2));
  } else {
    const pad = (s: string, n: number) => s.padEnd(n);
    console.log(pad("sheet", 16) + pad("covered", 12) + pad("skip air/key", 14) + pad("labels", 9) + pad("max/label", 11) + "verdict");
    for (const r of results) {
      const verdict = r.pass ? "PASS" : `FAIL — ${r.failures.join(" · ")}`;
      console.log(pad(r.sheet, 16) + pad(`${r.covered}/${r.drawable}`, 12) + pad(`${r.emptyAir.length}/${r.keyColorEmpty.length}`, 14) + pad(String(r.distinctLabels), 9) + pad(String(r.maxTilesPerLabel), 11) + verdict);
    }
    console.log(allPass ? "\nALL PASS" : `\nFAILED ${results.filter((r) => !r.pass).length}/${results.length} sheets`);
  }
  process.exit(allPass ? 0 : 1);
}

await main();
