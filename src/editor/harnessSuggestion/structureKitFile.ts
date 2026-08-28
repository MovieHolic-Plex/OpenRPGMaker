// harnessSuggestion/structureKitFile.ts
// 구조물 파일 포맷 — DOM·store 의존 없음(유닛 테스트 대상).
//
// 규칙 하나: 파일에 들어가는 순간 사진이 된다.
//   집 킷은 내보낼 때 전개해서 rows 로 담는다. 포맷이 한 종류라 파서·검증이 하나이고,
//   받는 쪽에서 항상 편집 가능하며 AI 가 항상 모양을 읽을 수 있다.
//   받는 프로젝트에 그 houseKitId 가 있는지 걱정할 필요도 없다.

import { bakeStructureKit } from "@/editor/harnessSuggestion/structureKitRasterModel";
import { structureKitSignature } from "@/editor/harnessSuggestion/structureKitModel";
import type { SectionStructureKitDef, StructureKitDef, StructureKitAiMeta, TilesetDef } from "@/project/types";

export class StructureKitFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StructureKitFileError";
  }
}

/** 프로젝트 파일과 구분하는 판별자. 확장자만으로는 잘못 고른 파일을 못 거른다. */
export const STRUCTURE_KIT_FILE_FORMAT = "rpgzzu-structure-kits";
export const STRUCTURE_KIT_FILE_VERSION = 1;

export interface StructureKitFile {
  readonly format: typeof STRUCTURE_KIT_FILE_FORMAT;
  readonly version: number;
  readonly exportedAt?: string;
  readonly tileset: { readonly id: string; readonly name: string };
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
  kits: readonly StructureKitDef[],
  exportedAt: string,
): string {
  const baked = kits.map((kit) => bakeStructureKit(kit, kit.id, kit.name ?? "구조물"));
  const file: StructureKitFile = {
    format: STRUCTURE_KIT_FILE_FORMAT,
    version: STRUCTURE_KIT_FILE_VERSION,
    exportedAt,
    tileset: { id: tileset.id, name: tileset.name },
    kits: baked,
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
  if (record.format !== STRUCTURE_KIT_FILE_FORMAT) {
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

  return {
    id: typeof record.id === "string" && record.id ? record.id : `kit_imported_${index}`,
    kind: "section",
    name,
    width,
    height,
    rows,
    ...(Array.isArray(record.parts) ? { parts: readParts(record.parts) } : {}),
    // 파일에 적힌 origin 을 그대로 보존한다 — 가져오기 체크는 "이 파일을 받겠다" 이지
    // "이 설명을 내가 보증한다" 가 아니다(제로 부트스트랩).
    ...(readAiMeta(record.ai) ? { ai: readAiMeta(record.ai)! } : {}),
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

function readAiMeta(raw: unknown): StructureKitAiMeta | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const record = raw as Record<string, unknown>;
  const description = typeof record.description === "string" ? record.description : "";
  const placementRules = typeof record.placementRules === "string" ? record.placementRules : "";
  if (!description && !placementRules) return undefined;
  return {
    description,
    placementRules,
    ...(Array.isArray(record.tags)
      ? { tags: record.tags.filter((tag): tag is string => typeof tag === "string") }
      : {}),
    ...(typeof record.role === "string" ? { role: record.role as StructureKitAiMeta["role"] } : {}),
    ...(record.repeatability === "repeat" || record.repeatability === "fixed"
      ? { repeatability: record.repeatability }
      : {}),
    ...(record.origin === "user" || record.origin === "ai" ? { origin: record.origin } : {}),
    ...(record.confidence === "high" || record.confidence === "medium" || record.confidence === "low"
      ? { confidence: record.confidence }
      : {}),
  };
}

/** 낱개는 구조물 이름, 묶음은 타일셋 이름과 개수. 이중 확장자라 브라우저는 JSON 으로 연다. */
export function structureKitFileName(tilesetName: string, kits: readonly StructureKitDef[]): string {
  if (kits.length === 1) return `${kits[0]!.name ?? "구조물"}.rpgzzu-kit.json`;
  return `${tilesetName}-구조물-${kits.length}개.rpgzzu-kit.json`;
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
  existingKits: readonly StructureKitDef[],
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
