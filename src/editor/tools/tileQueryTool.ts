import { defaultOutdoorTilesetId } from "@/project/defaults/outdoorTileset";
// 타일 지식 통합 조회 — 활성 LLM 툴 (core 노출).
// 구 v2 지식 쓰기 래퍼(tile_metadata/group/…)는 제거. 쓰기는 propose_tile_vocabulary.
import { approvedVocabulary, suggestMaterialsByLabel, unapprovedVocabulary } from "@/project/tileVocabulary";
import type { Project } from "@/project/types";
import { requireMap } from "./mapHelpers";
import { QUERY_TOOLS } from "./queryTools";
import { TILE_METADATA_TOOLS } from "./tileMetadataTools";
import { VISION_QUERY_TOOLS } from "./visionQueryTools";
import type { ToolDefinition, ToolExecResult } from "./types";
import { byName, coerceEnum, compactArgs, failWithExample } from "./toolArgCoerce";
/** 명시 tilesetId → 명시 mapId → startMap → DEFAULT. 명시한 선택자는 폴백하지 않는다. */
function resolveQueryTilesetId(draft: Project, args: Record<string, unknown>): string {
  if (typeof args.tilesetId === "string") return args.tilesetId.trim();
  if (typeof args.mapId === "string") {
    return requireMap(draft, args.mapId.trim()).tilesetId;
  }
  const startMap = draft.maps[draft.startMapId];
  if (startMap?.tilesetId) return startMap.tilesetId;
  return defaultOutdoorTilesetId(draft);
}


const v1GetTileInfo = byName(TILE_METADATA_TOOLS, "get_tile_info");
const v1ListUnclassified = byName(TILE_METADATA_TOOLS, "list_unclassified_tiles");
const v1AnalyzeUsage = byName(TILE_METADATA_TOOLS, "analyze_map_tile_usage");
const v1QueryTiles = byName(QUERY_TOOLS, "query_tiles");
const v1FindSimilar = byName(VISION_QUERY_TOOLS, "find_similar_tiles");

const QUERY_EXAMPLE = { ask: "palette", role: "decor", limit: 20 };
const ASK_KINDS = ["tile_info", "unclassified", "palette", "usage", "similar", "unapproved", "vocab", "labels"] as const;

const tileQuery: ToolDefinition = {
  name: "tile_query",
  description:
    "타일 지식 통합 조회. ask: tile_info(tileIds 상세), unclassified(미분류 목록), palette(role/category/프리셋 필터로 타일 찾기), usage(맵 사용 현황: mapId), similar(비슷한 타일: tileId), unapproved(미승인 요약), vocab(재료 그룹 목록 — 참고용), labels(타일 라벨/설명 목록 — 시공 material 인자용, query 로 필터). similar/unclassified/labels/vocab/unapproved는 tilesetId 생략 시 mapId 또는 startMap 타일셋을 쓴다(place_props와 동일 타일셋). ask:\"labels\" 는 mapId 를 넣어 대상 맵 타일셋 라벨만 조회하라 — tilesetId 생략 시 mapId, 없으면 startMap 타일셋을 조회한다.",
  mode: "read",
  version: 3,
  domains: ["core", "tile"],
  parameters: {
    type: "object",
    properties: {
      ask: { type: "string", enum: [...ASK_KINDS] },
      tilesetId: { type: "string" },
      tileIds: { type: "array", items: { type: "integer" }, description: "ask=tile_info 전용" },
      tileId: { type: "integer", description: "ask=similar 전용" },
      mapId: {
        type: "string",
        description:
          "맵 id. ask=usage 필수. tile_info/palette/similar/unclassified/labels/vocab/unapproved에서 tilesetId 생략 시 이 맵(또는 startMap) 타일셋으로 조회 — place_props material과 맞추려면 mapId 권장.",
      },
      role: { type: "string", description: "ask=palette: 팔레트 role 또는 타일 role" },
      category: { type: "string", description: "ask=palette" },
      presetId: { type: "string", description: "ask=palette" },
      limit: { type: "integer" },
      query: { type: "string", description: "ask=labels 전용: 라벨/설명 검색어(예: 물, 침엽수)" },
    },
    required: ["ask"],
  },
  run(draft: Project, args: Record<string, unknown>): ToolExecResult {
    const ask = coerceEnum(args.ask, ASK_KINDS, "ask", QUERY_EXAMPLE);
    if (ask === "tile_info") {
      if (!Array.isArray(args.tileIds) || args.tileIds.length === 0) {
        failWithExample("ask=tile_info에는 tileIds 배열이 필요합니다", { ask, tileIds: [260, 290] });
      }
      return v1GetTileInfo.run(draft, compactArgs({ tileIds: args.tileIds, tilesetId: resolveQueryTilesetId(draft, args) }));
    }
    if (ask === "unclassified") {
      return v1ListUnclassified.run(draft, compactArgs({ tilesetId: resolveQueryTilesetId(draft, args), limit: args.limit }));
    }
    if (ask === "palette") {
      return v1QueryTiles.run(draft, compactArgs({
        tilesetId: resolveQueryTilesetId(draft, args), role: args.role, category: args.category, presetId: args.presetId, limit: args.limit,
      }));
    }
    if (ask === "usage") {
      if (typeof args.mapId !== "string") failWithExample("ask=usage에는 mapId가 필요합니다", { ask, mapId: "map_1" });
      return v1AnalyzeUsage.run(draft, compactArgs({ mapId: args.mapId }));
    }
    if (ask === "similar") {
      if (args.tileId === undefined) failWithExample("ask=similar에는 tileId가 필요합니다", { ask, tileId: 260 });
      return v1FindSimilar.run(draft, compactArgs({
        tilesetId: resolveQueryTilesetId(draft, args), tileId: args.tileId, limit: args.limit,
      }));
    }
    if (ask === "unapproved") {
      const tilesetId = resolveQueryTilesetId(draft, args);
      const tileset = draft.tilesets[tilesetId];
      if (!tileset) failWithExample(`타일셋을 찾을 수 없습니다: ${tilesetId}`, { ask, tilesetId: defaultOutdoorTilesetId(draft), mapId: draft.startMapId });
      const limit = typeof args.limit === "number" && Number.isInteger(args.limit) && args.limit > 0 ? args.limit : 10;
      const summary = unapprovedVocabulary(tileset, limit);
      return {
        summary:
          `미승인 어휘: 그룹 ${summary.groupCount}개, 타일 ${summary.tileCount}개 — 존재하는 그룹은 승인 여부와 무관하게 ` +
          "시공 프리미티브(build_wall 등)를 바로 호출할 수 있습니다(미합의는 맵 목업 확인). 새 재료 정의가 필요할 때만 propose_tile_vocabulary를 쓰세요.",
        data: { tilesetId, ...summary },
      };
    }
    if (ask === "vocab") {
      const tilesetId = resolveQueryTilesetId(draft, args);
      const tileset = draft.tilesets[tilesetId];
      if (!tileset) failWithExample(`타일셋을 찾을 수 없습니다: ${tilesetId}`, { ask, tilesetId: defaultOutdoorTilesetId(draft), mapId: draft.startMapId });
      const vocab = approvedVocabulary(tileset);
      const byRole = new Map<string, number>();
      for (const group of vocab.groups) byRole.set(group.role, (byRole.get(group.role) ?? 0) + 1);
      const roleSummary = [...byRole.entries()].map(([role, count]) => `${role} ${count}`).join(", ");
      return {
        summary: `사용 가능 재료 그룹 ${vocab.groups.length}개(${roleSummary}) + 낱개 타일 ${vocab.tiles.length}개. 시공 시 material 에 타일 라벨/설명을 넣으세요(그룹 id·vocabId 금지). ask:"labels" 로 라벨 목록 조회.`,
        data: {
          tilesetId,
          // 그룹 id는 엔진 내부 참고용 — LLM은 material 라벨을 쓴다.
          groups: vocab.groups.map((g) => ({
            name: g.name,
            role: g.role,
            layerHome: g.layerHome,
            ...(g.patternKind ? { patternKind: g.patternKind } : {}),
            ...(g.sourceSize ? { sourceSize: g.sourceSize } : {}),
            ...(g.blockSize ? { blockSize: g.blockSize } : {}),
            ...(g.passage ? { passage: g.passage } : {}),
            ...(g.description ? { description: g.description } : {}),
            ...(g.placementRules ? { placementRules: g.placementRules } : {}),
          })),
          looseTiles: vocab.tiles.map((t) => ({ tileId: t.tileId, label: t.label, layerHome: t.layerHome })),
        },
      };
    }
    if (ask === "labels") {
      const tilesetId = resolveQueryTilesetId(draft, args);
      const tileset = draft.tilesets[tilesetId];
      if (!tileset) failWithExample(`타일셋을 찾을 수 없습니다: ${tilesetId}`, { ask, tilesetId: defaultOutdoorTilesetId(draft), mapId: draft.startMapId });
      const limit = typeof args.limit === "number" && Number.isInteger(args.limit) && args.limit > 0 ? Math.min(args.limit, 80) : 40;
      const query = typeof args.query === "string" ? args.query : "";
      const materials = suggestMaterialsByLabel(tileset, query, limit);
      // 빈 검색어는 전체 목록 탐색, 비어 있지 않은 검색어는 일치 항목만 반환.
      const normalizedQuery = query.trim().toLowerCase();
      const groups = approvedVocabulary(tileset).groups.filter((group) => {
        if (!normalizedQuery) return true;
        return `${group.name} ${group.description ?? ""} ${group.placementRules ?? ""}`.toLowerCase().includes(normalizedQuery);
      });
      const labels: ({
        readonly kind: "group";
        readonly label: string;
        readonly description: string;
        readonly role: string;
        readonly layerHome: string;
        readonly patternKind?: string;
        readonly placementRules?: string;
        readonly passage?: unknown;
        readonly sourceSize?: unknown;
        readonly blockSize?: unknown;
      } | {
        readonly kind: "tile";
        readonly tileId: number;
        readonly label: string;
        readonly description: string;
        readonly role?: string;
      })[] = groups.slice(0, limit).map((group) => ({
        kind: "group",
        label: group.name,
        description: group.description ?? "",
        role: group.role,
        layerHome: group.layerHome,
        ...(group.patternKind ? { patternKind: group.patternKind } : {}),
        ...(group.placementRules ? { placementRules: group.placementRules } : {}),
        ...(group.passage ? { passage: group.passage } : {}),
        ...(group.sourceSize ? { sourceSize: group.sourceSize } : {}),
        ...(group.blockSize ? { blockSize: group.blockSize } : {}),
      }));
      const seenLabels = new Set<string>(labels.map((l) => l.label));
      for (const material of materials) {
        if (labels.length >= limit) break;
        if (seenLabels.has(material.label)) continue;
        seenLabels.add(material.label);
        labels.push({
          kind: "tile",
          tileId: material.tileId,
          label: material.label,
          description: material.description,
          ...(material.role ? { role: material.role } : {}),
        });
      }
      if (!normalizedQuery && labels.length === 0) {
        for (let tileId = 0; tileId < tileset.count && labels.length < limit; tileId += 1) {
          const meta = tileset.tileMeta?.[tileId];
          const label = typeof meta?.label === "string" ? meta.label.trim() : "";
          const description = typeof meta?.description === "string" ? meta.description.trim() : "";
          if (!label && !description) continue;
          const finalLabel = label || `타일 ${tileId}`;
          if (seenLabels.has(finalLabel)) continue;
          seenLabels.add(finalLabel);
          labels.push({
            kind: "tile",
            tileId,
            label: finalLabel,
            description,
            ...(typeof meta?.role === "string" && meta.role ? { role: meta.role } : {}),
          });
        }
      }
      const beodeulKits =
        tilesetId === "beodeul_city"
          ? [
              { objectId: "kit:beodeul_city/bd-pick-temple-ruins-mosaic-medallion-5x5", name: "버들항 신전 폐허 · 5×5 내전 모자이크 바닥 메달리온", size: "5×5", use: "stamp_object (신전·성소·광장 중심 모자이크 바닥)" },
              { objectId: "kit:beodeul_city/bd-pick-temple-ruins-floor-trav", name: "버들항 신전 폐허 · 2×2 트래버틴 대리석 바닥", size: "2×2", use: "stamp_object (대리석 판석 바닥)" },
              { objectId: "kit:beodeul_city/bd-pick-temple-ruins-floor-ruin", name: "버들항 신전 폐허 · 2×2 풍화된 유적 돌바닥", size: "2×2", use: "stamp_object (유적·던전 바닥)" },
              { objectId: "kit:beodeul_city/bd-prop-well_roofed", name: "버들항 지붕 있는 우물", size: "2×3", use: "stamp_object (광장 중심 우물)" },
              { objectId: "kit:beodeul_city/bd-prop-bench_wood", name: "버들항 나무 벤치", size: "2×1", use: "stamp_object (광장·길가 쉼터)" },
              { objectId: "kit:beodeul_city/bd-prop-lamp_crook", name: "버들항 지팡이 가로등", size: "1×2", use: "stamp_object (길가·광장 조명)" },
              { objectId: "kit:beodeul_city/bd-prop-flowerbox_long", name: "버들항 긴 꽃상자 화단", size: "2×1", use: "stamp_object (집 앞·광장 화단)" },
              { objectId: "kit:beodeul_city/bd-pick-temple-ruins-column-temple-tall", name: "버들항 키 큰 로마 신전 기둥", size: "1×3", use: "stamp_object (성소·유적 기둥)" },
              { objectId: "kit:beodeul_city/bd-tree-03a8f7", name: "버들항 큰 활엽수 A", size: "3×3", use: "stamp_object (숲·외곽 나무 군락)" },
              { objectId: "kit:beodeul_city/bd-tree-3e8732", name: "버들항 큰 활엽수 B", size: "3×3", use: "stamp_object (숲·외곽 나무 군락)" },
              { objectId: "kit:beodeul_city/bd-tree-f4f319", name: "버들항 둥근 덤불 A", size: "2×2", use: "stamp_object (길가·숲 가장자리 덤불)" },
              { objectId: "kit:beodeul_city/bd-house-village-cream", name: "버들항 회벽·목골 별채 집", size: "7×8", use: "stamp_object (마을 민가)" },
              { objectId: "kit:beodeul_city/bd-house-village-stone", name: "버들항 사암 돌벽 박공집", size: "6×7", use: "stamp_object (마을 돌집)" },
            ]
          : undefined;
      return {
        summary: `타일 라벨 ${labels.length}개 — fill_region/lay_path/place_props 등의 material 인자에 label 문자열(예: "버들항 길 포석", "버들항 광장 판석", "버들항 모랫길", "버들항 풀밭", "버들항 물")을 넣으세요.${beodeulKits ? " 버들항 다중칸 구조물·모자이크 바닥·나무·소품은 stamp_object(objectId: 'kit:beodeul_city/...') 및 dress_beodeul_ground 를 함께 쓰면 정교한 버들항 타일 배치가 완성됩니다." : ""}`,
        data: {
          tilesetId,
          query: query || null,
          labels,
          ...(beodeulKits ? { recommendedBeodeulKits: beodeulKits } : {}),
        },
      };
    }
    return failWithExample("알 수 없는 tile_query ask입니다", QUERY_EXAMPLE);
  },
};

export const TILE_QUERY_TOOLS: readonly ToolDefinition[] = [tileQuery];
