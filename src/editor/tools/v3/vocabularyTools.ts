// editor/tools/v3/vocabularyTools.ts
// propose_tile_vocabulary — 어휘 프로포절 write 툴 (타일 툴 v3, 2026-07-07 설계).
//
// 원칙 0(Zero-Trust Perception): 이 툴의 name/role/patternKind/layerHome은 전부 AI '추정'이다.
// 엔진이 확정할 수 있는 결정론 사실(레이어 홈 분류·통행성)은 facts로 병기하고, 추정과
// 모순되면 warnings로 노출한다(카드의 '사실 배지'). 이미지 픽셀 검사는 브라우저 전용이므로
// 헤드리스 툴 계층에서는 tileLayerHome(투명 배경 칩 판정 포함)·priority·passability로 대체한다.
//
// 승인 마킹: run()은 draft에 origin:"user"를 기록하지만, assistantSession이 이 툴을
// requiresApproval로 태깅하므로 자동 수락(메타데이터 자동 커밋/autoApprove) 경로는 차단되고
// 커밋은 사용자 명시 수락으로만 일어난다 — 즉 커밋된 origin:"user"는 곧 사용자 승인이다.
// UI 카드(인라인 편집)는 V3B 몫 — 여기서는 카드 렌더용 데이터만 반환한다.

import { tileLayerHome } from "@/editor/tileLayerClassification";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import type { VocabLayerHome } from "@/project/tileVocabulary";
import { isBlockedPassage } from "@/project/tilesetPassage";
import type { Project, TileAiMetadata, TileGroupLayer, TileGroupMetadata, TileGroupRole, TilesetDef } from "@/project/types";
import { ToolError, type ToolDefinition, type ToolExecResult } from "../types";
import { coerceEnum, failWithExample, optionalEnum } from "../v2/tileToolsV2Support";
import { tilesetGrammarProfile, type GrammarPatternKind } from "./grammarProfiles";
import { derivePatternGrammar, isExpandablePatternKind } from "./rmTypeExpander";

const ITEM_KINDS = ["group", "tile"] as const;
const GROUP_ROLES: readonly TileGroupRole[] = ["building", "castle", "fence", "roof", "terrain", "water", "wall", "prop"];
const LAYER_HOMES: readonly VocabLayerHome[] = ["lower", "upper", "perCell"];
const PATTERN_KINDS: readonly GrammarPatternKind[] = [
  "animated_terrain",
  "autotile_3x3",
  "event_required_object",
  "horizontal_expandable",
  "nine_slice_expandable",
  "overlay_detail",
  "single",
  "source_rect",
  "vertical_expandable",
];

const PROPOSE_EXAMPLE = {
  tilesetId: "easyrpg_chipset_combined_town",
  items: [
    { kind: "group", tileIds: [300, 301, 302, 330, 331, 332, 360, 361, 362], name: "석벽", role: "wall", patternKind: "nine_slice_expandable", layerHome: "lower" },
    { kind: "tile", tileIds: [357], name: "벤치", role: "prop", layerHome: "upper" },
  ],
};

// 카드 렌더용 사실 배지(결정론) — AI에게 묻지 않고 엔진이 판정한 값.
export interface VocabularyFactBadge {
  readonly tileId: number;
  // 레이어 홈 분류(투명 배경 칩이면 "upper") — 투명 픽셀 검사 대체 판정.
  readonly layerHome: "lower" | "upper" | "both";
  readonly passable: boolean;
}

export interface VocabularyProposalCard {
  readonly kind: "group" | "tile";
  readonly groupId?: string;
  readonly tileIds: readonly number[];
  // AI 추정(카드에서 사용자가 인라인 교정 후 수락 — V3B).
  readonly name: string;
  readonly role: TileGroupRole;
  readonly patternKind?: GrammarPatternKind;
  readonly layerHome: VocabLayerHome;
  // 패턴 파츠(patternGrammar)가 이미 정의돼 있는지 — 없으면 T1b/V3B에서 채운다.
  readonly patternDefined: boolean;
  readonly facts: readonly VocabularyFactBadge[];
  readonly warnings: readonly string[];
}

function requireTileset(project: Project, tilesetId: unknown): TilesetDef {
  const id = typeof tilesetId === "string" && tilesetId.length > 0 ? tilesetId : DEFAULT_TILESET_ID;
  const tileset = project.tilesets[id];
  if (!tileset) throw new ToolError(`타일셋을 찾을 수 없습니다: ${id}`, { code: "tileset-not-found" });
  return tileset;
}

function requireTileIds(tileset: TilesetDef, value: unknown, field: string): number[] {
  if (!Array.isArray(value) || value.length === 0) failWithExample(`${field}에 tileIds 배열(1개 이상)이 필요합니다`, PROPOSE_EXAMPLE);
  return value.map((raw) => {
    const tile = Number(raw);
    if (!Number.isInteger(tile) || tile < 0 || tile >= tileset.count) {
      failWithExample(`${field}의 타일 인덱스 범위 밖: ${String(raw)} (0~${tileset.count - 1})`, PROPOSE_EXAMPLE);
    }
    return tile;
  });
}

function slugFromName(name: string, existing: readonly TileGroupMetadata[]): string {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-+|-+$/g, "") || "group";
  let slug = base;
  let counter = 2;
  while (existing.some((group) => group.id === slug)) {
    slug = `${base}-${counter}`;
    counter += 1;
  }
  return slug;
}

function defaultLayerFor(layerHome: VocabLayerHome): TileGroupLayer {
  return layerHome === "perCell" ? "mixed" : layerHome;
}

function ensureTileMetaSlot(tileset: TilesetDef, tile: number): TileAiMetadata {
  tileset.tileMeta ??= [];
  while (tileset.tileMeta.length < tileset.count) tileset.tileMeta.push({ label: "", description: "" });
  return (tileset.tileMeta[tile] ??= { label: "", description: "" });
}

function factBadges(tileset: TilesetDef, tileIds: readonly number[]): VocabularyFactBadge[] {
  return tileIds.map((tileId) => ({
    tileId,
    layerHome: tileLayerHome(tileset, tileId),
    passable: !isBlockedPassage(tileset.passability[tileId]),
  }));
}

// 사실(결정론 분류)과 AI 추정(layerHome)의 모순을 경고로 만든다.
function factContradictions(label: string, claimed: VocabLayerHome, facts: readonly VocabularyFactBadge[]): string[] {
  if (claimed === "perCell" || facts.length === 0) return [];
  const decided = facts.filter((fact) => fact.layerHome !== "both");
  if (decided.length === 0) return [];
  if (decided.every((fact) => fact.layerHome !== claimed)) {
    const observed = decided[0].layerHome;
    return [
      `${label}: 제안한 layerHome '${claimed}'이(가) 사실 배지와 모순됩니다 — 엔진 분류는 전 타일 '${observed}'(투명 배경 칩 포함 판정). 카드에서 교정 후 수락하세요.`,
    ];
  }
  return [];
}

const proposeTileVocabulary: ToolDefinition = {
  name: "propose_tile_vocabulary",
  description:
    "미승인 타일/그룹을 승인 어휘로 편입하자고 사용자에게 제안한다(v3). items마다 kind=group(9분할 벽·기둥·오토타일 등 패턴 단위, groupId=기존 그룹 또는 tileIds=신규)/kind=tile(낱개 소품, tileIds). name/role/patternKind/layerHome은 너의 추정이며 카드에서 사용자가 교정 후 수락한다. **중요: 이 툴만 부르고 멈추지 마라 — 제안 직후 같은 턴에 build_wall 등 시공 프리미티브를 그 그룹 id로 호출하면, 미승인 실패가 승인 카드에 보류 시공으로 묶여 사용자 수락 한 번으로 시공까지 끝난다.** 배치 프리미티브는 승인 어휘만 소비한다.",
  mode: "write",
  version: 3,
  parameters: {
    type: "object",
    properties: {
      tilesetId: { type: "string", description: "생략 시 기본 타일셋" },
      items: {
        type: "array",
        description: "제안 항목 목록(1개 이상)",
        items: {
          type: "object",
          properties: {
            kind: { type: "string", enum: [...ITEM_KINDS], description: "group=패턴/그룹 단위 승인, tile=낱개 타일(소품류)" },
            groupId: { type: "string", description: "kind=group에서 기존 그룹을 승인 제안할 때" },
            tileIds: { type: "array", items: { type: "integer" }, description: "kind=group 신규 그룹 구성 타일 / kind=tile 대상 타일" },
            name: { type: "string", description: "추정 이름(예: '석벽') — 사용자가 카드에서 교정" },
            role: { type: "string", enum: GROUP_ROLES as unknown as string[] },
            patternKind: { type: "string", enum: PATTERN_KINDS as unknown as string[], description: "kind=group 권장 — 패턴 종류 추정" },
            layerHome: { type: "string", enum: [...LAYER_HOMES], description: "홈 레이어 추정 — perCell은 타일별 판정" },
          },
          required: ["kind", "name", "role", "layerHome"],
        },
      },
    },
    required: ["items"],
  },
  run(draft: Project, args: Record<string, unknown>): ToolExecResult {
    const tileset = requireTileset(draft, args.tilesetId);
    const profile = tilesetGrammarProfile(tileset);
    if (!Array.isArray(args.items) || args.items.length === 0) {
      failWithExample("items 배열(1개 이상)이 필요합니다", PROPOSE_EXAMPLE);
    }
    const cards: VocabularyProposalCard[] = [];
    const warnings: string[] = [];
    for (const [index, raw] of (args.items as unknown[]).entries()) {
      if (typeof raw !== "object" || raw === null) failWithExample(`items[${index}]는 객체여야 합니다`, PROPOSE_EXAMPLE);
      const item = raw as Record<string, unknown>;
      const kind = coerceEnum(item.kind, ITEM_KINDS, `items[${index}].kind`, PROPOSE_EXAMPLE);
      const role = coerceEnum(item.role, GROUP_ROLES, `items[${index}].role`, PROPOSE_EXAMPLE);
      const layerHome = coerceEnum(item.layerHome, LAYER_HOMES, `items[${index}].layerHome`, PROPOSE_EXAMPLE);
      const patternKind = optionalEnum(item.patternKind, PATTERN_KINDS, `items[${index}].patternKind`, PROPOSE_EXAMPLE);
      const name = typeof item.name === "string" ? item.name.trim() : "";
      if (!name) failWithExample(`items[${index}].name이 비어 있습니다`, PROPOSE_EXAMPLE);
      const itemLabel = `items[${index}] '${name}'`;
      if (patternKind && !profile.supportedPatternKinds.includes(patternKind)) {
        warnings.push(`${itemLabel}: 패턴 '${patternKind}'은(는) 문법 프로파일 '${profile.id}'가 아직 시공하지 못합니다(승인은 가능, 프리미티브 전개 제외).`);
      }
      const card = kind === "group"
        ? approveGroupItem(tileset, item, index, { name, role, layerHome, patternKind, itemLabel })
        : approveTileItems(tileset, item, index, { name, role, layerHome, patternKind, itemLabel });
      warnings.push(...card.warnings);
      cards.push(card);
    }
    const names = cards.map((card) => `'${card.name}'`).join(", ");
    return {
      summary: `타일 어휘 ${cards.length}건 제안(${names}). 다음 단계(필수): 지금 같은 턴에 이 그룹 id를 wallVocabId/pathVocabId 등으로 넣어 시공 프리미티브(build_wall/lay_path 등)를 곧바로 호출하세요. 미승인 상태라 그 호출은 실패하지만, 시스템이 그 시공을 이 승인 카드에 '보류 시공'으로 묶어 사용자가 [승인하고 시공]을 한 번 누르면 어휘 승인+시공이 함께 끝납니다. 제안만 하고 턴을 끝내지 마세요.`,
      ...(warnings.length > 0 ? { warnings } : {}),
      data: { tilesetId: tileset.id, grammarProfile: profile.id, cards },
    };
  },
};

interface ItemClaims {
  readonly name: string;
  readonly role: TileGroupRole;
  readonly layerHome: VocabLayerHome;
  readonly patternKind?: GrammarPatternKind;
  readonly itemLabel: string;
}

function approveGroupItem(tileset: TilesetDef, item: Record<string, unknown>, index: number, claims: ItemClaims): VocabularyProposalCard {
  const warnings: string[] = [];
  tileset.tileGroups ??= [];
  const groupId = typeof item.groupId === "string" && item.groupId.trim() ? item.groupId.trim() : undefined;
  let group: TileGroupMetadata;
  if (groupId) {
    const existing = tileset.tileGroups.find((candidate) => candidate.id === groupId);
    if (!existing) {
      throw new ToolError(
        `그룹을 찾을 수 없습니다: ${groupId} (신규 그룹이면 groupId를 생략하고 tileIds를 보내세요) — 다시 보낼 형식 예시: ${JSON.stringify(PROPOSE_EXAMPLE)}`,
        { code: "group-not-found" }
      );
    }
    group = existing;
    if (item.tileIds !== undefined) group.tileIds = [...new Set(requireTileIds(tileset, item.tileIds, `items[${index}].tileIds`))];
  } else {
    const tileIds = [...new Set(requireTileIds(tileset, item.tileIds, `items[${index}].tileIds`))];
    group = {
      id: slugFromName(claims.name, tileset.tileGroups),
      name: claims.name,
      role: claims.role,
      defaultLayer: defaultLayerFor(claims.layerHome),
      tileIds,
      description: "",
      placementRules: "",
      source: "user",
    };
    tileset.tileGroups.push(group);
  }
  // 사실 배지는 반드시 마킹 전에 계산한다 — 마킹이 defaultLayer를 덮으면 사실이 추정에 오염된다.
  const facts = factBadges(tileset, group.tileIds);
  warnings.push(...factContradictions(claims.itemLabel, claims.layerHome, facts));
  // 승인 마킹 — 커밋은 사용자 명시 수락으로만 일어난다(requiresApproval 게이트).
  group.name = claims.name;
  group.role = claims.role;
  group.layerHome = claims.layerHome;
  group.defaultLayer = defaultLayerFor(claims.layerHome);
  group.origin = "user";
  group.source = "user"; // 하네스 재적용이 그룹을 재생성/정리하지 못하게 보호(기존 T1b 규약).
  if (claims.patternKind && group.patternGrammar && group.patternGrammar.kind !== claims.patternKind) {
    warnings.push(
      `${claims.itemLabel}: 제안한 patternKind '${claims.patternKind}'이(가) 기존 패턴 정의(사실)와 다릅니다 — 그룹에는 '${group.patternGrammar.kind}'이(가) 정의돼 있습니다.`
    );
  }
  // 승인 시 패턴 파츠 자동 생성(2026-07-07 §2.1.2) — 불변식: origin:"user" + 전개형
  // patternKind 그룹은 반드시 patternGrammar.parts를 갖는다. 이미 파츠가 있으면(사실) 유지.
  // tileIds가 모자라면 derivePatternGrammar가 pattern-underspecified를 던져 승인이 거부된다
  // (쓰기 draft는 runTool이 폐기하므로 부분 마킹이 남지 않는다).
  if (isExpandablePatternKind(claims.patternKind) && !group.patternGrammar) {
    group.patternGrammar = derivePatternGrammar(claims.patternKind, group.tileIds, tileset, { groupId: group.id, name: group.name });
  }
  return {
    kind: "group",
    groupId: group.id,
    tileIds: [...group.tileIds],
    name: claims.name,
    role: claims.role,
    ...(claims.patternKind ? { patternKind: claims.patternKind } : {}),
    layerHome: claims.layerHome,
    patternDefined: group.patternGrammar !== undefined,
    facts,
    warnings,
  };
}

function approveTileItems(tileset: TilesetDef, item: Record<string, unknown>, index: number, claims: ItemClaims): VocabularyProposalCard {
  const warnings: string[] = [];
  const tileIds = [...new Set(requireTileIds(tileset, item.tileIds, `items[${index}].tileIds`))];
  // 사실 배지는 반드시 마킹 전에 계산한다 — userLocked+defaultLayer 마킹이 분류를 덮어쓴다.
  const facts = factBadges(tileset, tileIds);
  warnings.push(...factContradictions(claims.itemLabel, claims.layerHome, facts));
  for (const tileId of tileIds) {
    const meta = ensureTileMetaSlot(tileset, tileId);
    // 사용자 확정 규약(set_tile_metadata confirmedByUser=true)과 동일한 마킹.
    meta.label = claims.name;
    meta.role = claims.role;
    meta.defaultLayer = defaultLayerFor(claims.layerHome);
    meta.origin = "user";
    meta.source = "user";
    meta.confidence = 1;
    meta.locked = true;
    meta.userLocked = true;
  }
  if (claims.patternKind && claims.patternKind !== "single") {
    warnings.push(`${claims.itemLabel}: kind=tile은 낱개 소품 승인용입니다 — 패턴 '${claims.patternKind}'이 필요하면 kind=group으로 보내세요.`);
  }
  return {
    kind: "tile",
    tileIds,
    name: claims.name,
    role: claims.role,
    ...(claims.patternKind ? { patternKind: claims.patternKind } : {}),
    layerHome: claims.layerHome,
    patternDefined: false,
    facts,
    warnings,
  };
}

export const VOCABULARY_TOOLS_V3: readonly ToolDefinition[] = [proposeTileVocabulary];
