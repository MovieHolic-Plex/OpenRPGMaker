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

import type { PassFlag, Project, TileGroupMetadata, TilesetDef } from "./types";
import { roleCapabilities } from "./tileRoles";
import { worldmapMaterialGroup } from './worldmapAutoBrush';
import { bagMaterialRejectMessage, isBagGroup, isBagMaterialQuery } from "./materialPolicy";

export type VocabLayerHome = "lower" | "upper" | "perCell";

export interface ApprovedVocabularyGroup {
  readonly blockSize?: { readonly height: number; readonly width: number };
  readonly description?: string;
  readonly id: string;
  readonly name: string;
  readonly role: TileGroupMetadata["role"];
  readonly layerHome: VocabLayerHome;
  readonly passage?: PassFlag | "mixed";
  readonly patternKind?: NonNullable<TileGroupMetadata["patternGrammar"]>["kind"];
  readonly placementRules?: string;
  readonly sourceSize?: { readonly height: number; readonly width: number };
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
      ...(group.description.trim() ? { description: group.description.trim() } : {}),
      ...(group.placementRules.trim() ? { placementRules: group.placementRules.trim() } : {}),
      ...(group.sourceRect ? { sourceSize: { height: group.sourceRect.height, width: group.sourceRect.width } } : {}),
      ...(group.patternGrammar?.blockHeight && group.patternGrammar.blockWidth
        ? { blockSize: { height: group.patternGrammar.blockHeight, width: group.patternGrammar.blockWidth } }
        : {}),
      ...(groupPassage(tileset, group) ? { passage: groupPassage(tileset, group) } : {}),
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

function groupPassage(tileset: TilesetDef, group: TileGroupMetadata): PassFlag | "mixed" | undefined {
  const first = tileset.passability[group.tileIds[0] ?? -1];
  if (!first) return undefined;
  const same = group.tileIds.every((tileId) => {
    const candidate = tileset.passability[tileId];
    return candidate
      && candidate.up === first.up
      && candidate.down === first.down
      && candidate.left === first.left
      && candidate.right === first.right;
  });
  return same ? { ...first } : "mixed";
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
  // 물건 이름 동의어는 질의 **전체**가 그 낱말일 때만 넓힌다. 부분 일치로 넓히면 「황금 나무 상자」가
  // 「나무 상자」로, 「돌 벤치 없는 광장」이 「벤치」로 풀려 수식어가 사라진다(2026-09-27 전수 조사).
  [/^(?:울타리|담장)$/, ["울타리"]],
  [/지붕|roof/, ["지붕"]],
  [/^문$|입구|door/, ["문", "입구", "나무 문"]],
  [/창문|window/, ["창문"]],
  [/^잔디$|풀밭|^grass$/, ["잔디"]],
  [/키큰\s*풀|tall\s*grass|dark\s*grass|짙은\s*잔디|인카운터\s*풀/, ["키큰 풀"]],
  [/^나무\s*상자$/, ["나무 상자", "상자"]],
  [/^과일\s*박스$/, ["과일박스", "과일"]],
  [/^벤치$/, ["벤치"]],
  [/^꽃$|꽃\/|꽃·/, ["꽃"]],
  // 모호한 요청만 확장. "가로 탁자 중" 같은 구체 라벨 문자열에 bare 탁자가 매칭되면 안 됨.
  // (동의어는 오케스트레이션 대체재가 아님 — 맵 타일셋 조회 + successTools 가드가 본선.)
  [/^(?:나무\s*)?탁자$|^식탁$|^카운터$|^table$/, ["가로 탁자", "사각 탁자", "긴 탁자", "원형 탁자", "탁자"]],
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
      /** "fillable": 라벨은 있지만 면 채우기 재료가 아니어서, 대신 채울 수 있는 재료를 제안한 경우. 기본 "similar". */
      readonly suggestionKind?: "similar" | "fillable";
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

/** 질의 낟말 중 몇 개가 이 텍스트에 들어 있는가 — 약매칭 전용 점수(최대 65, 자동 채택 기준 70 미만).
 *
 * 점수가 문자열 통째라 "돌 제단" vs "석판 제단", "석조 기둥" vs "돌기둥" 이 전부 0점이었고,
 * 그래서 실패 메시지의 후보 목록이 **빈 배열**로 나갔다(F3). 자동 채택은 그대로 막고 후보만 살린다. */
function tokenCoverageScore(text: string, term: string): number {
  const tokens = term.split(/[\s/·,]+/).filter((token) => token.length >= 2);
  if (tokens.length === 0) return 0;
  const covered = tokens.filter((token) => text.includes(token)).length;
  if (covered === 0) return 0;
  return Math.min(65, 40 + Math.round((15 * covered) / tokens.length));
}

function scoreTextMatch(haystack: string, terms: readonly string[]): number {
  const text = haystack.trim().toLowerCase();
  if (!text) return 0;
  let best = 0;
  for (const term of terms) {
    if (!term) continue;
    if (text === term) best = Math.max(best, 100);
    // 라벨이 질의로 시작하면 강매칭이다(「침엽수」→「침엽수 하단」). 반대로 **질의가 라벨로 시작하는** 경우는
    // 뒤의 조건을 버리게 되므로 약매칭으로 낮춘다 — 「우편함 없는 제단」이 우편함, 「황금 나무 상자」가 나무 상자로
    // 자동 시공되던 원인이다(2026-09-27 전수 조사). 후보로는 계속 보인다.
    else if (text.startsWith(term)) best = Math.max(best, 80);
    else if (term.startsWith(text)) best = Math.max(best, 60);
    else if (text.includes(term)) best = Math.max(best, 55);
    else if (term.length >= 2 && term.includes(text) && text.length >= 2) best = Math.max(best, 40);
    else best = Math.max(best, tokenCoverageScore(text, term));
  }
  return best;
}

/** 그룹 이름·설명도 후보다 — 대표 타일로 환산해 타일 후보와 같은 저울에 올린다.
 *
 * `tile_query ask:"labels"` 는 그룹 이름을 라벨로 보여 주는데(tileQueryTool) 해석기는 이름 **완전일치**만
 * 받았다. 그래서 모델이 본 대로 "꽃" 을 써도 "꽃/자연 소품" 을 못 찾고, 실패 메시지는 다시 tile_query 를
 * 권하는 순환이었다. 사전 자체를 넓힐 뿐, 점수 규칙·임계는 타일과 동일하다. */
function scoredGroupCandidates(tileset: TilesetDef, terms: readonly string[]): {
  tileId: number; score: number; label: string; description: string; role?: string;
}[] {
  const out: { tileId: number; score: number; label: string; description: string; role?: string }[] = [];
  for (const group of tileset.tileGroups ?? []) {
    const tileId = group.tileIds[0];
    if (tileId === undefined) continue;
    const label = group.name.trim();
    const description = (group.description ?? "").trim();
    const labelScore = scoreTextMatch(label, terms);
    const descScore = scoreTextMatch(description, terms);
    const score = Math.max(labelScore, descScore > 0 ? descScore - 5 : 0);
    if (score <= 0) continue;
    out.push({ tileId, score, label, description, ...(group.role ? { role: group.role } : {}) });
  }
  return out;
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

function isAutotileGroup(tileset: TilesetDef, group: TileGroupMetadata): boolean {
  // Explicit connection groups can live on the upper layer (worldmap forests/mountains).
  if (tileset.autotileGroups?.some(auto => auto.id === group.id
    && auto.memberTileIds.some(tile => group.tileIds.includes(tile)))) return true;
  const kind = group.patternGrammar?.kind;
  // 문법이 명시되면 역할보다 문법이 이긴다 — 역할 능력으로 접히지 않는 우선순위다.
  if (kind === "autotile_3x3" || kind === "animated_terrain") return true;
  return roleCapabilities(tileset, group.role).autotile;
}

/**
 * 문법 없는 통행 바닥 그룹(실내 나무 바닥·돌바닥·카펫·돗자리·나무 데크)도 면으로 깔 수 있다.
 *
 * 2026-09-24 꿈 세계 도그푸딩: 실내 칩셋 방 3개를 만들며 fill_region 「실내 나무 바닥」·「실내 돌바닥」·
 * 「붉은 카펫」이 전부 「면 채우기 재료가 아닙니다」로 거부됐다(7호출). 도구 설명은 「바닥 면은 이 툴」인데
 * 실내 하네스 바닥 그룹은 오토타일 문법이 없어 물/잔디만 통과했다. 역할이 자연 바닥(terrain·ground·path)
 * 이고 구조물이 아니며 윗층 재료가 아닌 그룹만 받는다 — 벽·지붕·소품은 그대로 거부한다.
 */
export function isFlatFillGroup(tileset: TilesetDef, group: TileGroupMetadata): boolean {
  if (group.patternGrammar || group.tileIds.length === 0) return false;
  if (group.defaultLayer === "upper" || group.layerHome === "upper") return false;
  const caps = roleCapabilities(tileset, group.role);
  return caps.naturalGround && !caps.structure;
}

/** fill_region 이 받는 그룹 — 오토타일 지형·수역, 또는 문법 없는 통행 바닥. */
export function isFillRegionGroup(tileset: TilesetDef, group: TileGroupMetadata): boolean {
  return isAutotileGroup(tileset, group) || isFlatFillGroup(tileset, group);
}

function findExactGroupByName(tileset: TilesetDef, query: string): TileGroupMetadata | undefined {
  const needle = normalizeMaterialQuery(query);
  if (!needle) return undefined;
  const groups = tileset.tileGroups ?? [];
  const exact = groups.filter((group) => normalizeMaterialQuery(group.name) === needle);
  if (exact.length === 0) return undefined;
  if (exact.length === 1) return exact[0];
  // multi exact-name ambiguity → missing path (caller falls through); prefer patterned/smaller.
  exact.sort((a, b) => {
    const aPat = a.patternGrammar ? 1 : 0;
    const bPat = b.patternGrammar ? 1 : 0;
    if (aPat !== bPat) return bPat - aPat;
    return a.tileIds.length - b.tileIds.length;
  });
  // Ambiguous same-name groups: do not auto-pick.
  return undefined;
}

/** 타일 label/description 만으로 재료를 고른다. 그룹 id·vocabId 는 입력으로 쓰지 않는다. */
/**
 * fill_region 이 실제로 채울 수 있는 재료(오토타일·수역 지형 그룹)를 라벨로 나열한다.
 * 실패 힌트가 실패한 라벨을 되돌려 주던 순환(「"돌바닥" 없음 → 비슷한 라벨: "돌바닥"」)의 대체 — 2026-09-03.
 */
export function fillableMaterialSuggestions(tileset: TilesetDef, limit = 8): MaterialSuggestion[] {
  const out: MaterialSuggestion[] = [];
  const seen = new Set<string>();
  for (const group of tileset.tileGroups ?? []) {
    // fill_region 이 받아 주는 조건과 같다(assertFillRegionGroup) — 여기서 더 좁히면 힌트가 툴과 어긋난다.
    if (!isFillRegionGroup(tileset, group)) continue;
    const label = group.name.trim();
    if (!label || seen.has(label)) continue;
    seen.add(label);
    out.push({ label, description: group.description ?? "", tileId: group.tileIds[0] ?? 0, role: group.role });
    if (out.length >= limit) break;
  }
  return out;
}

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
  // 잡소품 가방 라벨/id — 구체 재료로만 시공 (2026-07-10 small-props 사고).
  if (isBagMaterialQuery(raw)) {
    return {
      status: "missing",
      message: bagMaterialRejectMessage(raw),
      suggestions: suggestMaterialsByLabel(tileset, "소품", 5).filter((s) => !isBagMaterialQuery(s.label)),
    };
  }
  const worldmapGroup = worldmapMaterialGroup(tileset, raw);
  if (worldmapGroup) return materialAccessForGroup(tileset, worldmapGroup, {
    tileId: worldmapGroup.tileIds[0]!, label: worldmapGroup.name, description: worldmapGroup.description ?? '',
  });
  // 그룹 display name 완전 일치 우선(라벨 동의어 오염 방지 — "키큰 풀" ≠ "잔디").
  const exactGroup = findExactGroupByName(tileset, raw);
  if (exactGroup) {
    if (options.requireAutotileGroup && !isFillRegionGroup(tileset, exactGroup)) {
      // fall through to tile scoring
    } else {
      const seedTile = exactGroup.tileIds[0] ?? 0;
      const seedMeta = tileLabelDescription(tileset, seedTile);
      const hit = {
        tileId: seedTile,
        label: seedMeta.label || exactGroup.name,
        description: seedMeta.description || exactGroup.description || "",
      };
      if (options.preferGroup !== false || options.requireAutotileGroup === true || exactGroup.patternGrammar || exactGroup.tileIds.length > 1) {
        const byGroup = materialAccessForGroup(tileset, exactGroup, hit);
        if (byGroup.status !== "missing") return byGroup;
      }
    }
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
    // 역할 가산점은 이미 강매칭(70 이상)인 후보끼리의 순서만 바꾼다. 약매칭 60 에 12 를 얹어 자동 시공선을
    // 넘기면 「우편함 없는 제단」이 우편함으로 깔린다(2026-09-27 전수 조사).
    if (score >= 70 && options.preferRoles?.length && role && options.preferRoles.includes(role)) score += 12;
    scored.push({ tileId, score, label, description, role });
  }
  scored.sort((a, b) => b.score - a.score || a.tileId - b.tileId);
  // 약매칭(부분 포함만)은 후보 제시에 쓰고, 자동 시공은 강한 매칭만 채택.
  // 그룹 이름은 **타일 강매칭이 하나도 없을 때만** 후보가 된다. 같은 저울에 섮으면 기존에 타일로 풀리던
  // 라벨(예: 프리셋 "흰 집 밀")의 순위가 밀려 다른 타일이 시공된다 — 게이트 실측에서 잡혀다(2026-09-14).
  if (!scored.some((hit) => hit.score >= 70)) scored.push(...scoredGroupCandidates(tileset, terms));
  scored.sort((a, b) => b.score - a.score || a.tileId - b.tileId);
  const strong = scored.filter((hit) => hit.score >= 70);

  if (strong.length === 0) {
    // 면 채우기는 비슷한 라벨을 받아도 대부분 다시 막힌다 — 채울 수 있는 재료를 준다.
    const suggestions = options.requireAutotileGroup
      ? fillableMaterialSuggestions(tileset)
      : suggestMaterialsByLabel(tileset, raw, 5);
    // 후보를 메시지 안에 적는다: 모델은 issues[].message 문자열만 받으므로 구조화된 suggestions 를
    // 버리는 호출부에서는 후보가 아예 보이지 않았고, 대안 없는 거부는 같은 낟말 재시도로 돌아왔다.
    const listed = suggestions.slice(0, 5).map((entry) => `"${entry.label}"`).join(", ");
    const hint = listed
      ? ` 이 타일셋(${tileset.id})에서 ${options.requireAutotileGroup ? "채울 수 있는 재료" : "가까운 라벨"}: ${listed} — material 에 이 문자열을 그대로 넣으세요.`
      : ` 이 타일셋(${tileset.id})에는 비슷한 재료도 없습니다 — 맵의 타일셋이 이 요청과 맞는지 확인하세요(실내 재료는 실내 칩셋에만 있습니다).`;
    return {
      status: "missing",
      message: `라벨/설명이 "${raw}" 인 타일을 찾지 못했습니다.${hint}`,
      suggestions,
      ...(options.requireAutotileGroup ? { suggestionKind: "fillable" as const } : {}),
    };
  }

  const preferGroup = options.preferGroup !== false || options.requireAutotileGroup === true;
  for (const hit of strong.slice(0, 24)) {
    const group = groupContainingTile(tileset, hit.tileId);
    if (options.requireAutotileGroup) {
      if (!group || !isFillRegionGroup(tileset, group)) continue;
      return materialAccessForGroup(tileset, group, hit);
    }
    // 구체 라벨이 잡소품 가방에만 속한 타일(예: "팻말" 440)을 가리키면 가방으로 승격하지 않고 그 타일로 시공한다.
    // 가방 거절은 질의 자체가 가방 라벨/그룹 id 일 때만(위 isBagMaterialQuery) 적용한다.
    // 사고: author_house yard 태그 sign → "팻말" 이 small-props 가방 소속이라 집 2쵄 시공이 통째로 반려됨.
    const bagGroup = group !== undefined && isBagGroup(group);
    if (preferGroup && group && !bagGroup && (group.patternGrammar || group.tileIds.length > 1)) {
      if (options.preferRoles?.length && !options.preferRoles.includes(group.role) && hit.role && !options.preferRoles.includes(hit.role)) {
        continue;
      }
      return materialAccessForGroup(tileset, group, hit);
    }
    if (!options.requireAutotileGroup && !preferGroup) {
      return materialAccessForTile(tileset, hit);
    }
    // preferGroup 이어도 단일 타일 메타만 있거나 가방 소속이면 타일로 반환
    if (!group || bagGroup) return materialAccessForTile(tileset, hit);
  }

  // 그룹 필수였는데 실패 → 단일 타일 폴백(산포) 또는 missing
  if (options.requireAutotileGroup) {
    // 라벨은 있는데(정확 그룹명 또는 강한 라벨 매칭) 면 채우기 그룹이 아니다 — 같은 라벨을 다시 추천하면
    // 모델이 같은 실패를 반복한다. 이유와 채울 수 있는 재료를 준다.
    if (exactGroup || strong.length > 0) {
      const normalized = normalizeMaterialQuery(raw);
      return {
        status: "missing",
        message: `"${raw}" 은(는) 있지만 면 채우기 재료가 아닙니다 — 벽·건물·단일 타일은 fill_region 으로 채울 수 없습니다.${notFillableRoute(exactGroup?.role ?? strong[0]?.role)}`,
        suggestions: fillableMaterialSuggestions(tileset).filter((entry) => normalizeMaterialQuery(entry.label) !== normalized),
        suggestionKind: "fillable",
      };
    }
    return {
      status: "missing",
      message: `"${raw}" 에 해당하는 오토타일/수역 재료(라벨·설명)를 찾지 못했습니다.`,
      suggestions: suggestMaterialsByLabel(tileset, raw, 5),
    };
  }
  const best = strong[0]!;
  return materialAccessForTile(tileset, best);
}

/**
 * 면 채우기가 아닌 재료를 받았을 때 갈 도구. 추리 도그푸딩(qa-game mystery-3)에서 모델이 벽 재료
 * 「목골 석벽 집 벽 확장」 으로 fill_region 을 같은 인자 그대로 11번 다시 불렀다 — 「채울 수 없다」 만으로는
 * 어느 도구로 갈지 몰랐다.
 */
function notFillableRoute(role: string | undefined): string {
  switch (role) {
    case "wall":
      return " 벽이면 build_wall(material 에 이 라벨)로 선을 긋고, 방이 나뉜 실내 전체면 build_hand_interior_room 으로 지으세요.";
    case "building":
    case "castle":
    case "roof":
      return " 건물이면 stamp_object(건물 킷) 또는 build_hand_interior_room(실내)로 지으세요.";
    case "furniture":
    case "prop":
    case "decor":
      return " 가구·소품이면 place_props 나 paint_tiles(한 칸씩)로 놓으세요.";
    default:
      return "";
  }
}

function materialAccessForGroup(
  tileset: TilesetDef,
  group: TileGroupMetadata,
  hit: { tileId: number; label: string; description: string },
): MaterialResolveResult {
  if (isBagGroup(group)) {
    return {
      status: "missing",
      message: bagMaterialRejectMessage(group.name || group.id),
      suggestions: suggestMaterialsByLabel(tileset, "나무", 5).filter((s) => !isBagMaterialQuery(s.label)),
    };
  }
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
  // 모델이 tile_query 에서 본 그룹 이름이 후보에서만 빠져 있으면 고쳐 쓸 이름을 알 길이 없다.
  for (const candidate of scoredGroupCandidates(tileset, terms)) {
    scored.push({ score: candidate.score, suggestion: { label: candidate.label, description: candidate.description,
      tileId: candidate.tileId, ...(candidate.role ? { role: candidate.role } : {}) } });
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
