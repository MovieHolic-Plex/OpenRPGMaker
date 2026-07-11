// project/tileVocabulary.ts
// 어휘 접근 판정 계층 (타일 툴 v3).
//
// 규약:
// - LLM/시공 툴 재료 지정은 **그룹 id(vocabId)가 아니라** 타일 label·description 문자열이다.
// - resolveMaterialByLabel 이 라벨/설명을 매칭해 타일 또는 그 타일이 속한 전개 그룹을 고른다.
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

// 한국어 재료어 동의어 — 라벨/설명 매칭 점수 보조용(자동 대체 아님).
// 패턴은 쿼리 전체에 대해 test — 느슨한 부분일치(예: '벽'⊂'돌벽')로 다른 재료를 끌어오지 않는다.
const MATERIAL_QUERY_SYNONYMS: readonly (readonly [RegExp, readonly string[]])[] = [
  [/돌벽|석벽|돌담|stone[-_]?wall|목골|석재/, ["돌벽", "석벽", "돌담", "석재", "목골", "stone", "castle", "timber"]],
  [/흰\s*집\s*벽|회벽|^벽$/, ["흰 집 벽", "회벽", "벽", "흰"]],
  [/흙길|모래길|dirt|sand|^길$|^도로$/, ["흙길", "모래", "길", "도로"]],
  [/^물$|호수|연못|^강$|lake|water/, ["물", "호수", "연못", "강", "오토타일"]],
  [/침엽수|conifer/, ["침엽수"]],
  [/활엽수|broadleaf/, ["활엽수"]],
  [/마른나무/, ["마른나무"]],
  [/^나무$|수목/, ["침엽수", "나무", "수목"]],
  [/울타리|담장/, ["울타리"]],
  [/지붕|roof/, ["지붕"]],
  [/^문$|입구|door/, ["문", "입구", "나무 문"]],
  [/창문|window/, ["창문"]],
  [/잔디|풀|grass/, ["잔디"]],
  [/나무\s*상자|나무상자/, ["나무 상자", "상자"]],
  [/과일\s*박스|과일박스/, ["과일박스", "과일"]],
  [/벤치/, ["벤치"]],
  [/^꽃$|꽃\/|꽃·/, ["꽃"]],
];

export interface MaterialSuggestion {
  readonly label: string;
  readonly description: string;
  readonly tileId: number;
  readonly role?: string;
}

export interface ResolveMaterialOptions {
  /** 그룹 전개(벽/지붕/길/수역)가 필요하면 true. false면 단일 타일 산포도 허용. */
  readonly preferGroup?: boolean;
  /** 이 role 을 가진 그룹/타일을 우선. */
  readonly preferRoles?: readonly string[];
  /** fill_region 등 오토타일 그룹만. */
  readonly requireAutotileGroup?: boolean;
}

export type MaterialResolveResult =
  | {
      readonly status: "approved" | "soft";
      readonly kind: "group";
      readonly group: TileGroupMetadata;
      readonly tileId: number;
      readonly matchedLabel: string;
      readonly matchedDescription: string;
      readonly softConfirm?: VocabSoftConfirm;
    }
  | {
      readonly status: "approved" | "soft";
      readonly kind: "tile";
      readonly tileId: number;
      readonly matchedLabel: string;
      readonly matchedDescription: string;
      readonly softConfirm?: VocabSoftConfirm;
    }
  | {
      readonly status: "missing";
      readonly message: string;
      readonly suggestions: readonly MaterialSuggestion[];
    };

function normalizeMaterialQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

function materialQueryTerms(query: string): string[] {
  const needle = normalizeMaterialQuery(query);
  if (!needle) return [];
  const terms = new Set<string>([needle]);
  for (const [pattern, expansions] of MATERIAL_QUERY_SYNONYMS) {
    if (pattern.test(needle)) expansions.forEach((term) => terms.add(term.toLowerCase()));
  }
  return [...terms];
}

function scoreTextMatch(haystack: string, terms: readonly string[]): number {
  const text = haystack.trim().toLowerCase();
  if (!text) return 0;
  let best = 0;
  for (const term of terms) {
    if (!term) continue;
    if (text === term) best = Math.max(best, 100);
    else if (text.startsWith(term) || term.startsWith(text)) best = Math.max(best, 80);
    else if (text.includes(term)) best = Math.max(best, 55);
    else if (term.length >= 2 && term.includes(text) && text.length >= 2) best = Math.max(best, 40);
  }
  return best;
}

function tileLabelDescription(tileset: TilesetDef, tileId: number): { label: string; description: string; role?: string } {
  const meta = tileset.tileMeta?.[tileId];
  const label = typeof meta?.label === "string" ? meta.label.trim() : "";
  const description = typeof meta?.description === "string" ? meta.description.trim() : "";
  const role = typeof meta?.role === "string" && meta.role ? meta.role : undefined;
  return { label, description, ...(role ? { role } : {}) };
}

function groupContainingTile(tileset: TilesetDef, tileId: number): TileGroupMetadata | undefined {
  const groups = tileset.tileGroups ?? [];
  // 멤버가 적고 패턴이 있는 그룹을 우선(가방 그룹보다 구조 그룹).
  const hits = groups.filter((group) => group.tileIds.includes(tileId));
  if (hits.length === 0) return undefined;
  hits.sort((a, b) => {
    const aPat = a.patternGrammar ? 1 : 0;
    const bPat = b.patternGrammar ? 1 : 0;
    if (aPat !== bPat) return bPat - aPat;
    return a.tileIds.length - b.tileIds.length;
  });
  return hits[0];
}

function isAutotileGroup(group: TileGroupMetadata): boolean {
  const kind = group.patternGrammar?.kind;
  return kind === "autotile_3x3" || kind === "animated_terrain" || group.role === "water";
}

/** 타일 label/description 만으로 재료를 고른다. 그룹 id·vocabId 는 입력으로 쓰지 않는다. */
export function resolveMaterialByLabel(
  tileset: TilesetDef,
  query: string,
  options: ResolveMaterialOptions = {},
): MaterialResolveResult {
  const raw = query.trim();
  if (!raw) {
    return { status: "missing", message: "material(타일 라벨/설명)이 비어 있습니다.", suggestions: [] };
  }
  // 명시적 그룹 id 스타일 입력을 거절 — 라벨 경로로 유도.
  if (/^harness-|^group-|^test-/.test(raw) || raw.includes("-combined-town-") || raw.includes("_vocab")) {
    return {
      status: "missing",
      message: `material에 그룹 id("${raw}")를 넣지 마세요. 타일 라벨·설명(예: "물", "침엽수", "나무 상자")을 쓰세요.`,
      suggestions: suggestMaterialsByLabel(tileset, raw.replace(/^harness-combined-town-/, "").replace(/-/g, " "), 5),
    };
  }

  const terms = materialQueryTerms(raw);
  type Scored = {
    tileId: number;
    score: number;
    label: string;
    description: string;
    role?: string;
  };
  const scored: Scored[] = [];
  const count = tileset.count;
  for (let tileId = 0; tileId < count; tileId += 1) {
    const { label, description, role } = tileLabelDescription(tileset, tileId);
    if (!label && !description) continue;
    const labelScore = scoreTextMatch(label, terms);
    const descScore = scoreTextMatch(description, terms);
    let score = Math.max(labelScore, descScore > 0 ? descScore - 5 : 0);
    if (score <= 0) continue;
    if (options.preferRoles?.length && role && options.preferRoles.includes(role)) score += 12;
    scored.push({ tileId, score, label, description, role });
  }
  scored.sort((a, b) => b.score - a.score || a.tileId - b.tileId);
  // 약매칭(부분 포함만)은 후보 제시에 쓰고, 자동 시공은 강한 매칭만 채택.
  const strong = scored.filter((hit) => hit.score >= 70);

  if (strong.length === 0) {
    return {
      status: "missing",
      message: `라벨/설명이 "${raw}" 인 타일을 찾지 못했습니다. tile_query ask:"labels" 로 후보를 확인하세요.`,
      suggestions: suggestMaterialsByLabel(tileset, raw, 5),
    };
  }

  const preferGroup = options.preferGroup !== false || options.requireAutotileGroup === true;
  for (const hit of strong.slice(0, 24)) {
    const group = groupContainingTile(tileset, hit.tileId);
    if (options.requireAutotileGroup) {
      if (!group || !isAutotileGroup(group)) continue;
      return materialAccessForGroup(tileset, group, hit);
    }
    if (preferGroup && group && (group.patternGrammar || group.tileIds.length > 1)) {
      if (options.preferRoles?.length && !options.preferRoles.includes(group.role) && hit.role && !options.preferRoles.includes(hit.role)) {
        continue;
      }
      return materialAccessForGroup(tileset, group, hit);
    }
    if (!options.requireAutotileGroup && !preferGroup) {
      return materialAccessForTile(tileset, hit);
    }
    // preferGroup 이어도 단일 타일 메타만 있으면 타일로 반환
    if (!group) return materialAccessForTile(tileset, hit);
  }

  // 그룹 필수였는데 실패 → 단일 타일 폴백(산포) 또는 missing
  if (options.requireAutotileGroup) {
    return {
      status: "missing",
      message: `"${raw}" 에 해당하는 오토타일/수역 재료(라벨·설명)를 찾지 못했습니다.`,
      suggestions: suggestMaterialsByLabel(tileset, raw, 5),
    };
  }
  const best = strong[0]!;
  return materialAccessForTile(tileset, best);
}

function materialAccessForGroup(
  tileset: TilesetDef,
  group: TileGroupMetadata,
  hit: { tileId: number; label: string; description: string },
): MaterialResolveResult {
  const access = resolveVocabForBuild(tileset, { groupId: group.id });
  if (access.status === "missing" || access.kind !== "group") {
    return {
      status: "missing",
      message: access.status === "missing" ? access.message : `재료 그룹을 해석할 수 없습니다: ${group.name}`,
      suggestions: [],
    };
  }
  if (access.status === "soft") {
    return {
      status: "soft",
      kind: "group",
      group: access.group,
      tileId: hit.tileId,
      matchedLabel: hit.label,
      matchedDescription: hit.description,
      softConfirm: access.softConfirm,
    };
  }
  return {
    status: "approved",
    kind: "group",
    group: access.group,
    tileId: hit.tileId,
    matchedLabel: hit.label,
    matchedDescription: hit.description,
  };
}

function materialAccessForTile(
  tileset: TilesetDef,
  hit: { tileId: number; label: string; description: string },
): MaterialResolveResult {
  const access = resolveVocabForBuild(tileset, { tileId: hit.tileId });
  if (access.status === "missing" || access.kind !== "tile") {
    return {
      status: "missing",
      message: access.status === "missing" ? access.message : `타일 ${hit.tileId} 을(를) 해석할 수 없습니다`,
      suggestions: [],
    };
  }
  if (access.status === "soft") {
    return {
      status: "soft",
      kind: "tile",
      tileId: hit.tileId,
      matchedLabel: hit.label,
      matchedDescription: hit.description,
      softConfirm: access.softConfirm,
    };
  }
  return {
    status: "approved",
    kind: "tile",
    tileId: hit.tileId,
    matchedLabel: hit.label,
    matchedDescription: hit.description,
  };
}

/** 라벨/설명 기준 재료 후보(에러 힌트·tile_query). */
export function suggestMaterialsByLabel(
  tileset: TilesetDef,
  query: string,
  limit = 5,
): MaterialSuggestion[] {
  const terms = materialQueryTerms(query);
  if (terms.length === 0) {
    // 빈 쿼리: 라벨이 있는 타일 일부
    const out: MaterialSuggestion[] = [];
    for (let tileId = 0; tileId < tileset.count && out.length < limit; tileId += 1) {
      const { label, description, role } = tileLabelDescription(tileset, tileId);
      if (!label) continue;
      out.push({ label, description, tileId, ...(role ? { role } : {}) });
    }
    return out;
  }
  const scored: { score: number; suggestion: MaterialSuggestion }[] = [];
  for (let tileId = 0; tileId < tileset.count; tileId += 1) {
    const { label, description, role } = tileLabelDescription(tileset, tileId);
    if (!label && !description) continue;
    const score = Math.max(scoreTextMatch(label, terms), scoreTextMatch(description, terms));
    if (score <= 0) continue;
    scored.push({
      score,
      suggestion: { label: label || `타일 ${tileId}`, description, tileId, ...(role ? { role } : {}) },
    });
  }
  scored.sort((a, b) => b.score - a.score || a.suggestion.tileId - b.suggestion.tileId);
  // 같은 라벨 중복 제거
  const seen = new Set<string>();
  const unique: MaterialSuggestion[] = [];
  for (const entry of scored) {
    const key = entry.suggestion.label;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(entry.suggestion);
    if (unique.length >= limit) break;
  }
  return unique;
}

/** @deprecated 그룹 id 검색 — 호환용. 신규 코드는 suggestMaterialsByLabel 사용. */
export function suggestVocabGroups(
  tileset: TilesetDef,
  query: string,
  limit = 3
): { id: string; name: string; role: string }[] {
  const materials = suggestMaterialsByLabel(tileset, query, limit * 2);
  const out: { id: string; name: string; role: string }[] = [];
  const seen = new Set<string>();
  for (const material of materials) {
    const group = groupContainingTile(tileset, material.tileId);
    if (!group || seen.has(group.id)) continue;
    seen.add(group.id);
    out.push({ id: group.id, name: group.name, role: group.role });
    if (out.length >= limit) break;
  }
  return out;
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
