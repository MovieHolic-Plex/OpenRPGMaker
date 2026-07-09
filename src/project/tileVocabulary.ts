// project/tileVocabulary.ts
// 승인 보캐뷸러리 판정 계층 (타일 툴 v3, 2026-07-07 설계 — 원칙 0: Zero-Trust Perception).
//
// 규약:
// - 승인의 유일한 표식은 origin === "user" (그룹: TileGroupMetadata.origin, 타일: tileMeta.origin).
// - 제로 부트스트랩: 이 모듈은 절대 승인을 마킹하지 않는다. 마킹 경로는
//   ① propose_tile_vocabulary 프로포절의 사용자 명시 수락(autoApprove 자동 수락 불인정 —
//      assistantSession의 requiresApproval 게이트가 자동 커밋 경로를 차단한다)
//   ② T1b 위저드/우클릭 교정(confirmedByUser=true → set_tile_metadata가 origin:"user" 기록)
//   뿐이다. source:"user"는 v1 upsert가 자동으로 박으므로 승인 근거로 쓰지 않는다.
// - V3B 공정 프리미티브(build_wall 등)는 assertApprovedOrFail로 미승인 어휘를 하드 차단한다.

import { ToolError } from "@/editor/tools/types";
import type { TileGroupMetadata, TilesetDef } from "./types";

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

export function isApprovedTile(tileset: TilesetDef, tileId: number): boolean {
  return tileset.tileMeta?.[tileId]?.origin === "user";
}

export function isApprovedGroup(tileset: TilesetDef, groupId: string): boolean {
  return findGroup(tileset, groupId)?.origin === "user";
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
    .filter((group) => group.origin === "user")
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
  const unapprovedGroups = (tileset.tileGroups ?? []).filter((group) => group.origin !== "user");
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

// 미승인 어휘 하드 차단 — V3B 프리미티브가 소비하는 헬퍼(v2 '다시 보낼 형식 예시' 규약 승계).
export function assertApprovedOrFail(tileset: TilesetDef, ref: VocabularyRef): void {
  if (typeof ref.groupId === "string") {
    if (isApprovedGroup(tileset, ref.groupId)) return;
    const group = findGroup(tileset, ref.groupId);
    const label = group ? `타일 그룹 '${group.name}'(${group.id})` : `타일 그룹 '${ref.groupId}'`;
    throw new ToolError(unapprovedMessage(label, proposeExampleForGroup(tileset, group, ref.groupId)), { code: "unapproved-vocabulary" });
  }
  if (isApprovedTile(tileset, ref.tileId)) return;
  const meta = tileset.tileMeta?.[ref.tileId];
  const label = meta?.label ? `타일 ${ref.tileId}('${meta.label}')` : `타일 ${ref.tileId}`;
  throw new ToolError(unapprovedMessage(label, proposeExampleForTile(ref.tileId, meta?.label)), { code: "unapproved-vocabulary" });
}

function unapprovedMessage(label: string, example: Record<string, unknown>): string {
  return `${label}은(는) 아직 사용자와 합의되지 않았습니다. propose_tile_vocabulary로 승인을 받으세요. — 다시 보낼 형식 예시: ${JSON.stringify(example)}`;
}

function proposeExampleForGroup(tileset: TilesetDef, group: TileGroupMetadata | undefined, groupId: string): Record<string, unknown> {
  return {
    tilesetId: tileset.id,
    items: [
      {
        kind: "group",
        groupId,
        name: group?.name ?? "9분할 벽",
        role: group?.role ?? "wall",
        patternKind: group?.patternGrammar?.kind ?? "nine_slice_expandable",
        layerHome: group ? groupLayerHome(group) : "lower",
      },
    ],
  };
}

function proposeExampleForTile(tileId: number, label: string | undefined): Record<string, unknown> {
  return {
    items: [{ kind: "tile", tileIds: [tileId], name: label || "우물", role: "prop", layerHome: "upper" }],
  };
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
