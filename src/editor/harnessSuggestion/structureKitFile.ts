// harnessSuggestion/structureKitFile.ts
// 구조물 파일 포맷 — DOM·store 의존 없음(유닛 테스트 대상).

import { PRODUCT_SLUG } from "@/brand";
import { structureKitSignature } from "@/editor/harnessSuggestion/structureKitModel";
import type {
  PlacementFacing,
  PlacementSurfaceCondition,
  PlacementZone,
  SectionStructureKitDef,
  StructureGrowthAxis,
  StructureKitAiMeta,
  StructureKitCellHint,
  TilesetDef,
} from "@/project/types";

export class StructureKitFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StructureKitFileError";
  }
}

/** 프로젝트 파일과 구분하는 판별자. 확장자만으로는 잘못 고른 파일을 못 거른다. */
export const STRUCTURE_KIT_FILE_FORMAT = `${PRODUCT_SLUG}-structure-kits` as const;
/**
 * 2026-09 제품명 스윕 전에 내보낸 파일의 판별자 — **읽기 전용**. 사용자 디스크에 남아 있는 파일이
 * 계속 열려야 하므로 parse 가 받아 주되, 결과는 새 판별자로 정규화한다. 새로 쓰는 파일에는 쓰지 않는다.
 */
export const LEGACY_STRUCTURE_KIT_FILE_FORMAT = "rpgzzu-structure-kits";
export const STRUCTURE_KIT_FILE_VERSION = 1;
/** 내보내기 파일 이름 접미사. 이중 확장자라 브라우저는 JSON 으로 연다. 가져오기는 접미사를 강제하지 않는다. */
export const STRUCTURE_KIT_FILE_SUFFIX = `.${PRODUCT_SLUG}-kit.json`;

export interface StructureKitFile {
  readonly format: typeof STRUCTURE_KIT_FILE_FORMAT;
  readonly version: number;
  readonly exportedAt?: string;
  /**
   * 내보낸 아틀라스의 신원. `tileSize` 는 **필수**다(2026-09-22) — 없으면 16px 판에서
   * 내보낸 킷을 32px 판으로 가져와도 알 수 없고, 반쪽 크기로 찍힌다. 구 파일에는 없으므로
   * 읽을 때는 optional 로 받고, 가져오기 쪽이 어긋남을 판정한다.
   */
  readonly tileset: { readonly id: string; readonly name: string; readonly tileSize?: number };
  readonly kits: readonly SectionStructureKitDef[];
}

/** 킷 하나가 걸러진 이유. 파일 하나가 통째로 죽지 않게 킷 단위로 격리한다. */
export interface KitDiagnostic {
  readonly index: number;
  readonly name: string;
  readonly reason: string;
}

/** exportedAt 을 인자로 받는다 — new Date() 를 안에서 부르면 결과를 단언할 수 없다. */
export function serializeStructureKitFile(
  tileset: TilesetDef,
  kits: readonly SectionStructureKitDef[],
  exportedAt: string,
): string {
  const file: StructureKitFile = {
    format: STRUCTURE_KIT_FILE_FORMAT,
    version: STRUCTURE_KIT_FILE_VERSION,
    exportedAt,
    tileset: { id: tileset.id, name: tileset.name, tileSize: tileset.tileSize },
    kits: kits.map((kit) => ({ ...kit })),
  };
  return `${JSON.stringify(file, null, 2)}\n`;
}

export function parseStructureKitFile(text: string): {
  readonly file: StructureKitFile;
  readonly diagnostics: readonly KitDiagnostic[];
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new StructureKitFileError("JSON 으로 읽을 수 없는 파일입니다.");
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new StructureKitFileError("구조물 파일 형식이 아닙니다.");
  }
  const record = parsed as Record<string, unknown>;
  if (record.format !== STRUCTURE_KIT_FILE_FORMAT && record.format !== LEGACY_STRUCTURE_KIT_FILE_FORMAT) {
    throw new StructureKitFileError("구조물 파일이 아닙니다. 프로젝트 파일을 고르셨는지 확인해 주세요.");
  }
  const version = typeof record.version === "number" ? record.version : 0;
  if (version > STRUCTURE_KIT_FILE_VERSION) {
    throw new StructureKitFileError("이 파일은 더 새 버전의 편집기에서 만들어졌습니다.");
  }
  const tilesetRecord = record.tileset as Record<string, unknown> | undefined;
  if (typeof tilesetRecord?.id !== "string") {
    throw new StructureKitFileError("파일에 타일셋 정보가 없습니다.");
  }
  if (!Array.isArray(record.kits)) {
    throw new StructureKitFileError("파일에 구조물 목록이 없습니다.");
  }

  const kits: SectionStructureKitDef[] = [];
  const diagnostics: KitDiagnostic[] = [];
  record.kits.forEach((raw, index) => {
    const result = readKit(raw, index);
    if ("reason" in result) diagnostics.push(result);
    else kits.push(result);
  });

  return {
    file: {
      format: STRUCTURE_KIT_FILE_FORMAT,
      version,
      ...(typeof record.exportedAt === "string" ? { exportedAt: record.exportedAt } : {}),
      tileset: {
        id: tilesetRecord.id,
        name: typeof tilesetRecord.name === "string" ? tilesetRecord.name : tilesetRecord.id,
        ...(Number.isSafeInteger(tilesetRecord.tileSize) && (tilesetRecord.tileSize as number) > 0
          ? { tileSize: tilesetRecord.tileSize as number } : {}),
      },
      kits,
    },
    diagnostics,
  };
}

function readKit(raw: unknown, index: number): SectionStructureKitDef | KitDiagnostic {
  const fail = (reason: string, name = "이름 없음"): KitDiagnostic => ({ index, name, reason });
  if (typeof raw !== "object" || raw === null) return fail("구조물 형식이 아닙니다");
  const record = raw as Record<string, unknown>;
  const name = typeof record.name === "string" ? record.name : "이름 없음";

  if (record.kind !== "section") return fail("타일 행렬이 없는 구조물입니다", name);

  const width = Math.floor(Number(record.width));
  const height = Math.floor(Number(record.height));
  if (!Number.isFinite(width) || width < 1) return fail("폭이 올바르지 않습니다", name);
  if (!Number.isFinite(height) || height < 1) return fail("높이가 올바르지 않습니다", name);
  if (!Array.isArray(record.rows) || record.rows.length !== height) {
    return fail(`행 수가 높이와 다릅니다 (${Array.isArray(record.rows) ? record.rows.length : 0} ≠ ${height})`, name);
  }

  const rows = [];
  for (const rawRow of record.rows) {
    if (typeof rawRow !== "object" || rawRow === null) return fail("행 형식이 올바르지 않습니다", name);
    const rowRecord = rawRow as Record<string, unknown>;
    if (!isIntArray(rowRecord.tiles, width)) return fail(`행 길이가 폭과 다릅니다 (폭 ${width})`, name);
    const upperTiles = rowRecord.upperTiles;
    if (upperTiles !== undefined && !isIntArray(upperTiles, width)) {
      return fail("상층 행 길이가 폭과 다릅니다", name);
    }
    rows.push(
      upperTiles === undefined
        ? { tiles: [...(rowRecord.tiles as number[])] }
        : { tiles: [...(rowRecord.tiles as number[])], upperTiles: [...(upperTiles as number[])] },
    );
  }

  const ai = readAiMeta(record.ai);
  return {
    id: typeof record.id === "string" && record.id ? record.id : `kit_imported_${index}`,
    kind: "section",
    name,
    width,
    height,
    rows,
    ...(Array.isArray(record.parts) ? { parts: readParts(record.parts) } : {}),
    ...(Array.isArray(record.cellHints) ? readCellHintPatch(record.cellHints, width, height) : {}),
    // 파일에 적힌 origin 을 그대로 보존한다 — 가져오기 체크는 "이 파일을 받겠다" 이지
    // "이 설명을 내가 보증한다" 가 아니다(제로 부트스트랩).
    ...(ai ? { ai } : {}),
    learnedFrom: "db-authored",
    ...(typeof record.createdAt === "string" ? { createdAt: record.createdAt } : {}),
  };
}

function isIntArray(value: unknown, length: number): boolean {
  return Array.isArray(value) && value.length === length && value.every((item) => Number.isInteger(item));
}

function readParts(raw: readonly unknown[]): SectionStructureKitDef["parts"] {
  const kinds = new Set(["entrance", "window", "sign", "anchor"]);
  const parts = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const record = item as Record<string, unknown>;
    if (typeof record.kind !== "string" || !kinds.has(record.kind)) continue;
    if (![record.dx, record.dy, record.w, record.h].every((n) => Number.isInteger(n))) continue;
    parts.push({
      id: typeof record.id === "string" && record.id ? record.id : `pt_imported_${parts.length}`,
      kind: record.kind as "entrance" | "window" | "sign" | "anchor",
      dx: record.dx as number,
      dy: record.dy as number,
      w: record.w as number,
      h: record.h as number,
      ...(typeof record.note === "string" ? { note: record.note } : {}),
    });
  }
  return parts;
}

const TILE_GROUP_ROLES = new Set([
  "building",
  "castle",
  "fence",
  "roof",
  "terrain",
  "water",
  "wall",
  "prop",
]);

const GROWTH_AXES = new Set(["horizontal", "vertical", "both"]);
const PLACEMENT_ZONE_IDS = new Set([
  "anyFloor",
  "clearArea",
  "openFloor",
  "againstWall",
  "corner",
  "wallFace",
]);
const PLACEMENT_FACING_IDS = new Set(["north", "south", "east", "west", "any"]);

function readGrowthAxis(value: unknown): StructureGrowthAxis | undefined {
  return typeof value === "string" && GROWTH_AXES.has(value) ? (value as StructureGrowthAxis) : undefined;
}

/**
 * 칸 힌트 목록. 행렬 밖 좌표는 버린다 — 밖으로 나간 힌트는 편집기에서 지울 수 없는 유령이 되고,
 * AI 는 없는 칸을 근거로 삼는다. 한 칸에 하나만 남긴다(dx,dy 가 키) — 편집기와 같은 규약.
 */
function readCellHintPatch(
  raw: readonly unknown[],
  width: number,
  height: number,
): { cellHints?: StructureKitCellHint[] } {
  const byCell = new Map<string, StructureKitCellHint>();
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const record = item as Record<string, unknown>;
    const dx = record.dx;
    const dy = record.dy;
    if (!Number.isInteger(dx) || !Number.isInteger(dy)) continue;
    const cx = dx as number;
    const cy = dy as number;
    if (cx < 0 || cy < 0 || cx >= width || cy >= height) continue;
    const growth = readGrowthAxis(record.growth);
    const note = typeof record.note === "string" && record.note.trim() ? record.note : undefined;
    if (growth === undefined && note === undefined) continue;
    byCell.set(`${cx},${cy}`, {
      dx: cx,
      dy: cy,
      ...(growth === undefined ? {} : { growth }),
      ...(note === undefined ? {} : { note }),
    });
  }
  const cellHints = [...byCell.values()];
  return cellHints.length > 0 ? { cellHints } : {};
}

/**
 * 기계가 검사하는 배치 조건. 직렬화는 이미 이 값을 쓰고 있었지만 파서가 읽지 않아
 * 내보내기→가져오기를 한 번 거치면 «필수» 조건이 조용히 사라지고 아무 자리나 찍힐 수 있게 됐다.
 * 조건은 사람이 건 제한이므로 모르면 받지 않고 떨어뜨린다(모를 조건을 통과로 바꾸면 잡지 못한다).
 */
function readPlacementConditions(raw: readonly unknown[]): PlacementSurfaceCondition[] {
  const conditions: PlacementSurfaceCondition[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const record = item as Record<string, unknown>;
    if (typeof record.zone !== "string" || !PLACEMENT_ZONE_IDS.has(record.zone)) continue;
    const facing = typeof record.facing === "string" && PLACEMENT_FACING_IDS.has(record.facing)
      ? (record.facing as PlacementFacing)
      : undefined;
    conditions.push({
      id: typeof record.id === "string" && record.id ? record.id : `pc_imported_${conditions.length}`,
      zone: record.zone as PlacementZone,
      strength: record.strength === "soft" ? "soft" : "hard",
      ...(facing && facing !== "any" ? { facing } : {}),
      ...(typeof record.message === "string" && record.message.trim() ? { message: record.message } : {}),
    });
  }
  return conditions;
}

function readAiMeta(raw: unknown): StructureKitAiMeta | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const record = raw as Record<string, unknown>;
  const description = typeof record.description === "string" ? record.description : "";
  const placementRules = typeof record.placementRules === "string" ? record.placementRules : "";
  const tags = Array.isArray(record.tags)
    ? record.tags.filter((tag): tag is string => typeof tag === "string")
    : [];
  const themes = Array.isArray(record.themes)
    ? record.themes.filter((theme): theme is string => typeof theme === "string" && theme.trim().length > 0)
    : [];
  const role = typeof record.role === "string" && TILE_GROUP_ROLES.has(record.role)
    ? (record.role as StructureKitAiMeta["role"])
    : undefined;
  const repeatability = record.repeatability === "repeat" || record.repeatability === "fixed"
    ? record.repeatability
    : undefined;
  const growthAxis = readGrowthAxis(record.growthAxis);
  const layerHome = record.layerHome === "lower" || record.layerHome === "upper" || record.layerHome === "perCell"
    ? record.layerHome
    : undefined;
  const placement = Array.isArray(record.placement) ? readPlacementConditions(record.placement) : [];
  // 예전엔 두 자유 문장이 비면 메타를 통째로 버렸다. 그러면 「증분 축·테마·배치 조건만
  // 적은 벽」이 가져오기에서 어휘를 전부 잃는다 — 한 칸이라도 내용이 있으면 살린다.
  const interiorRole = typeof record.interiorRole === "string" && record.interiorRole.trim()
    ? record.interiorRole.trim()
    : undefined;
  const snap = record.snap === "wall-north" || record.snap === "wall-any"
    || record.snap === "floor" || record.snap === "free"
    ? record.snap
    : undefined;
  const hasAnything = Boolean(
    description || placementRules || role || repeatability || growthAxis || layerHome
    || tags.length > 0 || themes.length > 0 || placement.length > 0
    || interiorRole || snap,
  );
  if (!hasAnything) return undefined;
  return {
    description,
    placementRules,
    ...(tags.length > 0 ? { tags } : {}),
    ...(themes.length > 0 ? { themes } : {}),
    ...(role ? { role } : {}),
    ...(repeatability ? { repeatability } : {}),
    ...(growthAxis ? { growthAxis } : {}),
    ...(layerHome ? { layerHome } : {}),
    ...(placement.length > 0 ? { placement } : {}),
    ...(interiorRole ? { interiorRole } : {}),
    ...(snap ? { snap } : {}),
    ...(record.origin === "user" || record.origin === "ai" ? { origin: record.origin } : {}),
    ...(record.confidence === "high" || record.confidence === "medium" || record.confidence === "low"
      ? { confidence: record.confidence }
      : {}),
  };
}

/** 낱개는 구조물 이름, 묶음은 타일셋 이름과 개수. */
export function structureKitFileName(tilesetName: string, kits: readonly SectionStructureKitDef[]): string {
  if (kits.length === 1) return `${kits[0]!.name ?? "구조물"}${STRUCTURE_KIT_FILE_SUFFIX}`;
  return `${tilesetName}-구조물-${kits.length}개${STRUCTURE_KIT_FILE_SUFFIX}`;
}

export interface ImportCandidate {
  readonly kit: SectionStructureKitDef;
  /** 같은 모양이 이미 앨범에 있다. */
  readonly duplicate: boolean;
  /** 같은 이름의 다른 모양이 이미 있다. */
  readonly nameConflict: boolean;
  /** 충돌을 푼 최종 이름. */
  readonly resolvedName: string;
  readonly defaultChecked: boolean;
}

export interface ImportPlan {
  /** 파일의 칩셋이 지금 앨범과 다르다 — 타일 번호의 뜻이 달라 그림이 깨진다. */
  readonly tilesetMismatch: boolean;
  readonly fileTilesetId: string;
  readonly fileTilesetName: string;
  /**
   * 파일의 아틀라스 픽셀 크기가 지금 앨범과 다르다(2026-09-22).
   *
   * 왜 따로 보는가: `tilesetMismatch` 는 타일 번호의 뜻을 보지만, 같은 그림의 16px 판과
   * 32px 판은 **타일 번호가 같고 픽셀만 다르다**. 이걸 안 잡으면 반쪽 크기로 찍힌다.
   * 파일에 기록이 없으면(구 파일) 판정하지 않는다 — false.
   */
  readonly tileSizeMismatch: boolean;
  readonly fileTileSize?: number;
  readonly targetTileSize: number;
  readonly candidates: readonly ImportCandidate[];
  readonly diagnostics: readonly KitDiagnostic[];
}

/**
 * 가져오기 판정을 전부 미리 끝낸다 — 확인창은 이 계획을 그리기만 한다.
 * 대화상자 없이 충돌 정책 전부를 유닛 테스트할 수 있게 하려는 경계다.
 */
export function planImport(
  file: StructureKitFile,
  targetTileset: TilesetDef,
  existingKits: readonly SectionStructureKitDef[],
  diagnostics: readonly KitDiagnostic[],
): ImportPlan {
  const existingSignatures = new Set(existingKits.map((kit) => structureKitSignature(kit)));
  const takenNames = new Set(existingKits.map((kit) => kit.name ?? "구조물"));

  const candidates: ImportCandidate[] = [];
  for (const kit of file.kits) {
    const duplicate = existingSignatures.has(structureKitSignature(kit));
    const baseName = kit.name ?? "구조물";
    const nameConflict = takenNames.has(baseName);
    const resolvedName = nameConflict ? uniqueName(baseName, takenNames) : baseName;
    takenNames.add(resolvedName);
    candidates.push({
      kit,
      duplicate,
      nameConflict,
      resolvedName,
      // 같은 모양은 기본 해제 — 같은 파일을 두 번 가져와도 사본이 쌓이지 않는다.
      defaultChecked: !duplicate,
    });
  }

  return {
    tilesetMismatch: file.tileset.id !== targetTileset.id,
    fileTilesetId: file.tileset.id,
    fileTilesetName: file.tileset.name,
    tileSizeMismatch: file.tileset.tileSize !== undefined && file.tileset.tileSize !== targetTileset.tileSize,
    ...(file.tileset.tileSize === undefined ? {} : { fileTileSize: file.tileset.tileSize }),
    targetTileSize: targetTileset.tileSize,
    candidates,
    diagnostics,
  };
}

/** AI 가 kitName 부분 일치로 킷을 지목하므로, 같은 이름 둘은 조회를 불안정하게 만든다. */
function uniqueName(baseName: string, taken: ReadonlySet<string>): string {
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${baseName} (${n})`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${baseName} (${taken.size + 1})`;
}
