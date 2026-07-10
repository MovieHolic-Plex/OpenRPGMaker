// project/tileVocabulary.ts
// 어휘 접근 판정 계층 (타일 툴 v3).
//
// 규약:
// - 영구 합의 표식은 origin === "user" (그룹: TileGroupMetadata.origin, 타일: tileMeta.origin).
// - 시공 프리미티브는 미합의 재료를 하드 차단하지 않는다. resolveVocabForBuild 가
//   approved | soft | missing 을 돌려 soft 면 맵에 그린 뒤 사용자 목업 확인으로 합의한다.
// - origin:"user" 마킹은 (1) propose_tile_vocabulary 수락 (2) soft-confirm 제안 수락
//   (3) T1b/위저드 confirmedByUser 경로에서만 한다. 이 모듈 자체는 마킹하지 않는다.
// - 그룹 한정 예외: source === "bundled-default"(큐레이션 번들)는 origin:"user"와 동급 신뢰(2026-07-11).

import type { Project, TileGroupMetadata, TilesetDef } from "./types";

export type VocabLayerHome = "lower" | "upper" | "perCell";

export interface ApprovedVocabularyGroup {
  readonly id: string;
  readonly name: string;
  readonly role: TileGroupMetadata["role"];
  readonly layerHome: VocabLayerHome;
  readonly patternKind?: NonNullable<TileGroupMetadata["patternGrammar"]>["kind"];
  readonly tileIds: readonly number[];
}

export interface ApprovedVocabularyTile {
  readonly tileId: number;
  readonly label: string;
  readonly role?: string;
  readonly layerHome: VocabLayerHome;
}

export interface ApprovedVocabulary {
  readonly groups: readonly ApprovedVocabularyGroup[];
  readonly tiles: readonly ApprovedVocabularyTile[];
}

export interface UnapprovedVocabularySummary {
  readonly groupCount: number;
  // 대표 미승인 그룹(limit개) — 모델이 propose_tile_vocabulary 대상으로 삼을 수 있게 id를 준다.
  readonly groups: readonly { readonly id: string; readonly name: string; readonly role: string }[];
  // 메타(라벨/role)가 있으나 미승인인 타일 수 + 대표 id.
  readonly tileCount: number;
  readonly sampleTileIds: readonly number[];
}

// 번들 하네스 그룹은 사람이 큐레이션한 재료라 zero-trust가 막으려는 "AI 추정 이름"이
// 아니다. origin:"user"(명시 합의)와 동급으로 신뢰한다(2026-07-11 승인 시드).
// 낱개 타일(tileMeta)에는 적용하지 않는다 — 라벨이 반자동 생성이라 목업 확인 유지.
export function isTrustedGroupSource(group: TileGroupMetadata): boolean {
  return group.origin === "user" || group.source === "bundled-default";
}

export function isApprovedTile(tileset: TilesetDef, tileId: number): boolean {
  return tileset.tileMeta?.[tileId]?.origin === "user";
}

export function isApprovedGroup(tileset: TilesetDef, groupId: string): boolean {
  const group = findGroup(tileset, groupId);
  return group ? isTrustedGroupSource(group) : false;
}

// 그룹의 어휘 홈 레이어 — layerHome이 없으면 defaultLayer에서 유도(mixed/event → perCell).
export function groupLayerHome(group: TileGroupMetadata): VocabLayerHome {
  if (group.layerHome) return group.layerHome;
  if (group.defaultLayer === "lower" || group.defaultLayer === "upper") return group.defaultLayer;
  return "perCell";
}

// 승인된 어휘 전체(승인 그룹 + 그룹에 속하지 않은 승인 낱개 타일 — 소품류).
export function approvedVocabulary(tileset: TilesetDef): ApprovedVocabulary {
  const groups: ApprovedVocabularyGroup[] = (tileset.tileGroups ?? [])
    .filter((group) => isTrustedGroupSource(group))
    .map((group) => ({
      id: group.id,
      name: group.name,
      role: group.role,
      layerHome: groupLayerHome(group),
      ...(group.patternGrammar ? { patternKind: group.patternGrammar.kind } : {}),
      tileIds: [...group.tileIds],
    }));
  const groupedTileIds = new Set(groups.flatMap((group) => group.tileIds));
  const tiles: ApprovedVocabularyTile[] = [];
  (tileset.tileMeta ?? []).forEach((meta, tileId) => {
    if (meta?.origin !== "user" || groupedTileIds.has(tileId)) return;
    tiles.push({
      tileId,
      label: meta.label,
      ...(typeof meta.role === "string" && meta.role ? { role: meta.role } : {}),
      layerHome: approvedTileLayerHome(tileset, tileId),
    });
  });
  return { groups, tiles };
}

// 미승인 어휘 요약 — tile_query ask:"unapproved"가 소비한다.
export function unapprovedVocabulary(tileset: TilesetDef, limit = 10): UnapprovedVocabularySummary {
  const unapprovedGroups = (tileset.tileGroups ?? []).filter((group) => !isTrustedGroupSource(group));
  const unapprovedTileIds: number[] = [];
  (tileset.tileMeta ?? []).forEach((meta, tileId) => {
    if (!meta || meta.origin === "user") return;
    const hasContent = (typeof meta.label === "string" && meta.label.trim().length > 0) || (typeof meta.role === "string" && meta.role.length > 0);
    if (hasContent) unapprovedTileIds.push(tileId);
  });
  return {
    groupCount: unapprovedGroups.length,
    groups: unapprovedGroups.slice(0, Math.max(0, limit)).map((group) => ({ id: group.id, name: group.name, role: group.role })),
    tileCount: unapprovedTileIds.length,
    sampleTileIds: unapprovedTileIds.slice(0, Math.max(0, limit)),
  };
}

export type VocabularyRef =
  | { readonly groupId: string; readonly tileId?: undefined }
  | { readonly tileId: number; readonly groupId?: undefined };

/** soft-confirm 카드/수락 훅이 소비하는 재료 스냅샷. */
export interface VocabSoftConfirm {
  readonly kind: "group" | "tile";
  readonly groupId?: string;
  readonly tileId?: number;
  readonly tileIds: readonly number[];
  readonly name: string;
  readonly role: string;
  readonly layerHome: VocabLayerHome;
  readonly tilesetId: string;
}

export type VocabBuildAccess =
  | { readonly status: "approved"; readonly kind: "group"; readonly group: TileGroupMetadata }
  | { readonly status: "soft"; readonly kind: "group"; readonly group: TileGroupMetadata; readonly softConfirm: VocabSoftConfirm }
  | { readonly status: "approved"; readonly kind: "tile"; readonly tileId: number }
  | { readonly status: "soft"; readonly kind: "tile"; readonly tileId: number; readonly softConfirm: VocabSoftConfirm }
  | { readonly status: "missing"; readonly message: string };

export const VOCAB_SOFT_CONFIRM_WARNING_PREFIX = "목업 확인 대기 재료";

export function isVocabSoftConfirm(value: unknown): value is VocabSoftConfirm {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (record.kind === "group" || record.kind === "tile")
    && typeof record.name === "string"
    && typeof record.role === "string"
    && typeof record.tilesetId === "string"
    && Array.isArray(record.tileIds);
}

export function extractVocabSoftConfirm(data: unknown): VocabSoftConfirm | null {
  if (typeof data !== "object" || data === null) return null;
  const soft = (data as { vocabSoftConfirm?: unknown }).vocabSoftConfirm;
  return isVocabSoftConfirm(soft) ? soft : null;
}

/** 시공 툴용 어휘 해석 — 존재하는 재료는 soft 허용, 없는 id만 missing. */
export function resolveVocabForBuild(tileset: TilesetDef, ref: VocabularyRef): VocabBuildAccess {
  if (typeof ref.groupId === "string") {
    const group = findGroup(tileset, ref.groupId);
    if (!group) {
      return {
        status: "missing",
        message: `타일 그룹을 찾을 수 없습니다: ${ref.groupId}. tile_query 또는 list 하네스 그룹 id를 확인하세요.`,
      };
    }
    if (isApprovedGroup(tileset, group.id)) {
      return { status: "approved", kind: "group", group };
    }
    return {
      status: "soft",
      kind: "group",
      group,
      softConfirm: softConfirmForGroup(tileset, group),
    };
  }
  const tileId = ref.tileId;
  if (!Number.isInteger(tileId) || tileId < 0 || tileId >= tileset.count) {
    return {
      status: "missing",
      message: `타일 id 범위 밖: ${tileId} (0~${tileset.count - 1})`,
    };
  }
  if (isApprovedTile(tileset, tileId)) {
    return { status: "approved", kind: "tile", tileId };
  }
  return {
    status: "soft",
    kind: "tile",
    tileId,
    softConfirm: softConfirmForTile(tileset, tileId),
  };
}

export function softConfirmForGroup(tileset: TilesetDef, group: TileGroupMetadata): VocabSoftConfirm {
  return {
    kind: "group",
    groupId: group.id,
    tileIds: [...group.tileIds],
    name: group.name || group.id,
    role: group.role || "prop",
    layerHome: groupLayerHome(group),
    tilesetId: tileset.id,
  };
}

export function softConfirmForTile(tileset: TilesetDef, tileId: number): VocabSoftConfirm {
  const meta = tileset.tileMeta?.[tileId];
  return {
    kind: "tile",
    tileId,
    tileIds: [tileId],
    name: meta?.label?.trim() || `타일 ${tileId}`,
    role: (typeof meta?.role === "string" && meta.role) || "prop",
    layerHome: approvedTileLayerHome(tileset, tileId),
    tilesetId: tileset.id,
  };
}

/** 수락 시 soft 재료에 origin:user 를 박는다(영구 합의). */
export function applyVocabSoftConfirmApprovals(project: Project, softConfirms: readonly VocabSoftConfirm[]): number {
  let marked = 0;
  for (const soft of softConfirms) {
    const tileset = project.tilesets[soft.tilesetId];
    if (!tileset) continue;
    if (soft.kind === "group" && soft.groupId) {
      const group = findGroup(tileset, soft.groupId);
      if (!group) continue;
      if (group.origin !== "user") {
        group.origin = "user";
        group.source = "user";
        marked += 1;
      }
      continue;
    }
    if (soft.kind === "tile" && typeof soft.tileId === "number") {
      if (!tileset.tileMeta) tileset.tileMeta = [];
      const existing = tileset.tileMeta[soft.tileId] ?? { label: soft.name };
      if (existing.origin === "user") continue;
      tileset.tileMeta[soft.tileId] = {
        ...existing,
        label: existing.label || soft.name,
        role: existing.role || soft.role,
        origin: "user",
        source: "user",
      };
      marked += 1;
    }
  }
  return marked;
}

function approvedTileLayerHome(tileset: TilesetDef, tileId: number): VocabLayerHome {
  const declared = tileset.tileMeta?.[tileId]?.defaultLayer;
  if (declared === "lower" || declared === "upper") return declared;
  if (declared === "mixed" || declared === "event") return "perCell";
  return tileset.priority[tileId] ?? "lower";
}

function findGroup(tileset: TilesetDef, groupId: string): TileGroupMetadata | undefined {
  return tileset.tileGroups?.find((group) => group.id === groupId);
}
