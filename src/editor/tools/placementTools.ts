import { buildGroupSample, type GroupSample } from "@/ai/groupSampleBuilder";
import { TILE } from "@/project/defaults/constants";
import { tileAt, tilePassability } from "@/project/collision";
import { protectedHouseCells } from "./houseProtection";
import { isRoadTile } from "@/project/defaults/roadAutotile";
import { isSandTile } from "@/project/defaults/sandAutotile";
import { isCobbleTile } from "@/project/defaults/cobbleAutotile";
import { isLakeAutotileTile } from "@/project/defaults/lakeAutotile";
import { mapSurfaceProbe, type SurfaceProbe } from "@/project/placementSurface";
import { isTreeCanopyTileId, isTreeTrunkTileId, isUpperOnlyOverlayTile } from "@/project/tilesetHarness";
import type { Command, GameMap, PaletteSlotRole, Project, TileGroupMetadata, TilesetDef } from "@/project/types";
import { tileLayerHome } from "@/editor/tileLayerClassification";
import { inMapBounds, passabilityWarning, passableCellCount, requireMap, setLower, type Point } from "./mapHelpers";
import { hardClusterRuleCount, nonEmptyFootprintTileCount } from "./clusterRulePlacement";
import { clusterScatter, poissonScatter, type ScatterBounds } from "./naturalScatter";
import { naturalnessArg, naturalnessLabel, NATURALNESS_GUIDANCE, rngForTool, seedForTool } from "./naturalToolArgs";
import { paletteTilePickerForTool, type PaletteTilePicker } from "./paletteToolArgs";
import { placementSoftPenalty } from "./placementScoring";
import { resolvePlacementStructure, type StructureCellEdit } from "./placementStructure";
import { mulberry32 } from "@/util/rng";
import { ToolError, type JsonSchema, type ToolDefinition, type ToolExecResult } from "./types";

type Area = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
type Rect = Area;
type ScatterMode = "uniform" | "poisson" | "cluster";
type RecordValue = { readonly [key: string]: unknown };
/** natural = 지금까지의 자연 산포. dense = 빈틈 없이 채워 통행을 막는다. */
export type ScatterPacking = "natural" | "dense";
export type PropRejectionReason = "outOfBounds" | "upperOccupied" | "lowerImpassable"
  | "protectedSurface" | "blockedLowerSurface" | "lowerIncompatible" | "protectedEvent"
  | "protectedOwnership" | "trunkVisibility";
export type PropPlacementDiagnostics = {
  readonly unit: "candidate-origin";
  readonly scope: "area-candidate-origins" | "explicit-candidate-origins";
  readonly footprint: { readonly w: number; readonly h: number };
  readonly candidateOrigins: number;
  readonly rejectedOrigins: number;
  readonly eligibleOrigins: number;
  /** An origin counts once per reason; reasons can overlap across its footprint. */
  readonly rejectedBy: Partial<Record<PropRejectionReason, number>>;
  readonly upperErase: { readonly recommended: boolean; readonly upperOnlyOrigins: number };
};

/** Zero-placement errors keep the existing runner contract. The full issue message
 * carries a JSON record; callers must not parse the human summary (it is clipped). */
export class PropPlacementError extends ToolError {
  constructor(message: string, mapId: string, readonly diagnostics: PropPlacementDiagnostics) {
    const recovery = diagnostics.upperErase.recommended
      ? ' tile_erase(layer:"upper") 로 상위 레이어를 비운 뒤 재시도할 수 있습니다.'
      : " 상위 레이어만 비워서는 해결되지 않습니다. 다른 영역·배치 조건을 확인하세요.";
    const labels: Record<PropRejectionReason, string> = {
      outOfBounds: "맵/영역 밖", upperOccupied: "상위 점유", lowerImpassable: "하층 통행 불가",
      protectedSurface: "길/모래/포석 보호", blockedLowerSurface: "물/벽 표면 보호",
      lowerIncompatible: "하층 배치 불일치", protectedEvent: "시작/이벤트/전이 보호",
      protectedOwnership: "집/구조물 소유 보호", trunkVisibility: "밑동 가림",
    };
    const causes = Object.entries(diagnostics.rejectedBy)
      .map(([reason, count]) => `${labels[reason as PropRejectionReason]} ${count}`).join(", ");
    super(`${message}${recovery} 배치 원점 ${diagnostics.candidateOrigins}개 검사: ${causes || "들어가는 발자국 없음"}.`
      + `\nplacement_diagnostics: ${JSON.stringify(diagnostics)}`, { code: "placement-zero", mapId });
  }
}

/** Used only after zero placement, before any writes. This is an area census,
 * not a claim that the sampler tried every origin or that eligible origins pack. */
export function measurePropRejections(
  candidates: readonly Point[],
  footprint: { readonly w: number; readonly h: number },
  inspect: (origin: Point, reasons: Set<PropRejectionReason>) => void,
  scope: PropPlacementDiagnostics["scope"] = "area-candidate-origins",
): PropPlacementDiagnostics {
  const rejectedBy: Partial<Record<PropRejectionReason, number>> = {};
  let rejectedOrigins = 0;
  let upperOnlyOrigins = 0;
  for (const origin of candidates) {
    const reasons = new Set<PropRejectionReason>();
    inspect(origin, reasons);
    if (reasons.size === 0) continue;
    rejectedOrigins += 1;
    for (const reason of reasons) rejectedBy[reason] = (rejectedBy[reason] ?? 0) + 1;
    if (reasons.size === 1 && reasons.has("upperOccupied")) upperOnlyOrigins += 1;
  }
  return {
    unit: "candidate-origin", scope, footprint: { w: footprint.w, h: footprint.h },
    candidateOrigins: candidates.length, rejectedOrigins, eligibleOrigins: candidates.length - rejectedOrigins,
    rejectedBy, upperErase: { recommended: candidates.length > 0 && upperOnlyOrigins === candidates.length, upperOnlyOrigins },
  };
}

/** Keep event opt-out and unconditional ownership protection distinct in diagnostics. */
export function propProtectionReasons(project: Project, map: GameMap, avoidEvents = true): Map<string, PropRejectionReason[]> {
  const reasons = new Map<string, PropRejectionReason[]>();
  if (avoidEvents) for (const cell of protectedEventCells(project, map)) reasons.set(cell, ["protectedEvent"]);
  for (const { x, y } of protectedHouseCells(map)) {
    const cell = key(x, y);
    reasons.set(cell, [...(reasons.get(cell) ?? []), "protectedOwnership"]);
  }
  return reasons;
}

type ScatterArgs = {
  readonly mapId: string;
  readonly groupId?: string;
  readonly area: Area;
  readonly count: number;
  readonly minGap: number;
  readonly maxGap: number;
  readonly naturalness: number;
  readonly mode: ScatterMode;
  readonly seed?: number;
  readonly avoidProtected: boolean;
  readonly preferSoftRules: boolean;
  readonly applyStructure: boolean;
  readonly packing: ScatterPacking;
  /** true 면 수관이 남의 밑동을 덮지 않는다 — 숲 합성 전용(일반 소품 밀집은 영향 없음). */
  readonly trunkVisible: boolean;
};
type Footprint = { readonly w: number; readonly h: number; readonly lower: readonly number[]; readonly upper: readonly number[] };
type ChooseInput = {
  readonly choices: readonly Point[];
  readonly allowed: readonly Point[];
  readonly placed: readonly Rect[];
  readonly footprint: Footprint;
  readonly minGap: number;
  readonly seed: string;
  readonly step: number;
  readonly map: GameMap;
  readonly group: TileGroupMetadata;
  readonly preferSoftRules: boolean;
  readonly probe: SurfaceProbe;
};
type UniformChooseInput = Omit<ChooseInput, "choices"> & {
  readonly maxGap: number;
};
type RankedChooseInput = {
  readonly allowed: readonly Point[];
  readonly choices: readonly Point[];
  readonly footprint: Footprint;
  readonly group: TileGroupMetadata;
  readonly map: GameMap;
  readonly minGap: number;
  readonly placed: readonly Rect[];
  readonly preferSoftRules: boolean;
  readonly probe: SurfaceProbe;
  readonly rankByPoint: ReadonlyMap<string, number>;
  readonly remaining: number;
};

const AREA_SCHEMA: JsonSchema = {
  type: "object",
  properties: { x: { type: "integer" }, y: { type: "integer" }, w: { type: "integer" }, h: { type: "integer" } },
  required: ["x", "y", "w", "h"],
};

/**
 * 산포 엔진 — place_props(v3)와 레거시 scatter_object 툴이 공유.
 * 새 코드는 ToolDefinition 이름 대신 이 함수를 호출할 것.
 */
/**
 * 2026-09-18 거부 대신 확장. 요청 영역에 한 개도 못 놓으면(우물 자리가 소품·길로 꽉 찬 광장 등) 바로
 * 실패하던 것을, 영역을 2칸씩 최대 3번 넓혀 재시도한다. 그래도 0개면 원래 진단과 함께 실패한다.
 * 넓혔으면 summary 앞에 붙여 알린다. 0개 배치는 여전히 성공이 아니다.
 */
export function runScatterObject(draft: Project, rawArgs: Record<string, unknown>): ToolExecResult {
  return withAreaExpansion(draft, rawArgs, runScatterObjectOnce);
}

export function withAreaExpansion(draft: Project, rawArgs: Record<string, unknown>,
  once: (draft: Project, args: Record<string, unknown>) => ToolExecResult): ToolExecResult {
  try {
    return once(draft, rawArgs);
  } catch (error) {
    if (!(error instanceof PropPlacementError)) throw error;
    // expandArea:false — 호출자가 "이 칸에만" 을 뜻할 때(적격성 검사·정밀 배치) 확장을 끈다.
    if (rawArgs.expandArea === false) throw error;
    const area = rawArgs.area as { x?: unknown; y?: unknown; w?: unknown; h?: unknown } | undefined;
    const map = typeof rawArgs.mapId === "string" ? draft.maps[rawArgs.mapId] : undefined;
    if (!map || !area || [area.x, area.y, area.w, area.h].some(v => typeof v !== "number")) throw error;
    const base = { x: area.x as number, y: area.y as number, w: area.w as number, h: area.h as number };
    // 맵과 전혀 겹치지 않는 영역은 좌표 실수다 — 넓혀서 구제하지 않고 원래 진단(영역 밖)을 그대로 낸다.
    const overlapsMap = base.x < map.width && base.y < map.height && base.x + base.w > 0 && base.y + base.h > 0;
    if (!overlapsMap) throw error;
    for (let step = 1; step <= 3; step += 1) {
      const grow = step * 2;
      const x = Math.max(0, base.x - grow), y = Math.max(0, base.y - grow);
      const w = Math.min(map.width - x, base.w + grow * 2), h = Math.min(map.height - y, base.h + grow * 2);
      if (x === base.x && y === base.y && w === base.w && h === base.h) break;
      try {
        const result = once(draft, { ...rawArgs, area: { x, y, w, h } });
        return { ...result, summary: `(요청 영역에 자리가 없어 ${grow}칸 넓힘 → (${x},${y}) ${w}×${h}) ${result.summary}`,
          warnings: [...(result.warnings ?? []), `요청 영역 (${base.x},${base.y}) ${base.w}×${base.h} 에는 놓을 자리가 없어 ${grow}칸 넓혀 배치했습니다.`] };
      } catch (retryError) {
        if (!(retryError instanceof PropPlacementError)) throw retryError;
      }
    }
    // 넓혀도 자리가 없었다는 사실을 진단 앞에 붙인다 — 모델이 같은 자리를 다시 넓혀 달라고 하지 않도록.
    error.message = `${error.message.split("\n")[0]} (영역을 6칸까지 넓혀 재시도했지만 자리가 없었습니다 — 다른 위치를 고르세요)${error.message.includes("\n") ? "\n" + error.message.split("\n").slice(1).join("\n") : ""}`;
    throw error;
  }
}

/** 영역 확장 없이 한 번만 시도한다 — place_props 처럼 바깥에서 이미 확장을 감싼 호출자용(이중 확장 방지). */
export function runScatterObjectOnce(draft: Project, rawArgs: Record<string, unknown>): ToolExecResult {
    const args = parseArgs(rawArgs);
    const map = requireMap(draft, args.mapId);
    const tileset = draft.tilesets[map.tilesetId];
    if (!tileset) throw new ToolError(`타일셋을 찾을 수 없습니다: ${map.tilesetId}`, { code: "tileset-not-found", mapId: map.id });
    const picker = paletteTilePickerForTool(tileset, rawArgs, scatterSeedSignature(map, args));
    if (!picker && !args.groupId) throw new ToolError("scatter_object에는 groupId 또는 presetId+paletteRole이 필요합니다.", { code: "invalid-args", mapId: map.id });
    const group = picker ? syntheticPaletteGroup(picker) : groupById(map, draft, args.groupId as string);
    // 문법 없는 다수 타일 prop 가방(소품 잡동사니)은 1칸씩 랜덤 타일로 뿌린다.
    // 전체를 세로 쌍/한 줄 스탬프로 묶으면 벤치 좌우 타일이 위아래로 붙는 버그가 난다.
    const bagProp = !picker && isBagPropGroup(group);
    const footprint = picker
      ? singleTileFootprint()
      : bagProp
        ? singleUpperPropFootprint(group.tileIds[0] ?? TILE.EMPTY, tileset)
        : treeLayeredFootprint(group, tileset)
          ?? oneInstance(buildGroupSample(tileset, {
            role: group.role,
            tileIds: group.tileIds,
            patternGrammar: group.patternGrammar,
          }), group, tileset);
    const protectionReasons = propProtectionReasons(draft, map, args.avoidProtected);
    if (footprint.lower.some(isTreeTrunkTileId)) {
      // Tree pairs need valid ground across the whole object, not just at the trunk.
      // Otherwise cleanup removes a canopy over a wall and runner repair recreates it
      // after the house is sealed. Preexisting occupied upper cells are not free
      // ground. Existing lower trunks still allow canopy overlap.
      for (let y = Math.max(0, args.area.y); y < Math.min(map.height, args.area.y + args.area.h); y += 1) {
        for (let x = Math.max(0, args.area.x); x < Math.min(map.width, args.area.x + args.area.w); x += 1) {
          const { lower, upper } = tileAt(map, x, y);
          const pass = tilePassability(tileset, lower, TILE.EMPTY);
          const reasons = protectionReasons.get(key(x, y)) ?? [];
          if (upper !== TILE.EMPTY) reasons.push("upperOccupied");
          if (lower !== TILE.EMPTY && !isTreeTrunkTileId(lower)
            && !(pass.up || pass.down || pass.left || pass.right)) reasons.push("lowerImpassable");
          if (reasons.length > 0) protectionReasons.set(key(x, y), reasons);
        }
      }
    }
    const protectedCells = new Set(protectionReasons.keys());
    const candidates = origins(map, args.area, footprint).filter((origin) => footprintFits(map, footprint, origin, protectedCells));
    // 배치 면 채점용 프로브는 루프 밖에서 한 번 만든다 — 스텝마다 만들면 후보 수만큼 재생성된다.
    // 루프 안에서는 맵을 쓰지 않으므로(쓰기는 touched 로 뒤에 한 번) 찍기 전 지형을 보는 것이 맞다.
    const surfaceProbe = mapSurfaceProbe(draft, map);
    const legacySeed = scatterSeedSignature(map, args);
    const seed = args.seed === undefined ? legacySeed : String(args.seed);
    const ranked = args.mode === "uniform" || args.packing === "dense"
      ? null
      : rankedNaturalCandidates({ args, candidates, footprint, legacySeed, map });
    const stepFootprintAt = (step: number): Footprint => (bagProp ? bagPropFootprint(group, tileset, seed, step) : footprint);
    const passableBefore = passableCellCount(draft, map, args.area);
    const placed: Rect[] = [];
    const footprints: Footprint[] = [];
    if (args.packing === "dense") {
      const dense = planDensePlacements({
        map,
        area: args.area,
        count: args.count,
        protectedCells,
        footprintAt: stepFootprintAt,
        selectionSeed: seedForTool(rawArgs, legacySeed),
        trunkVisible: args.trunkVisible,
        explicitOrigins: parseExplicitOrigins(rawArgs.origins),
      });
      placed.push(...dense.placed);
      footprints.push(...dense.footprints);
    }
    for (let step = 0; args.packing !== "dense" && step < args.count; step += 1) {
      const stepFootprint = stepFootprintAt(step);
      const sourceCandidates = ranked?.ordered ?? candidates;
      // 성능 캡(2026-07-17): 스텝마다 전 후보(면적 규모)를 재검사·재채점하면 대형 맵에서
      // count×면적 곱으로 폭주한다(100×100 침엽수 84그루 = 수백 초). ranked는 이미
      // 자연도 순 정렬이라 "상위 512개 중 선택"이 의미를 보존한다. uniform은 전수 유지.
      const allowedCap = ranked ? 512 : Number.POSITIVE_INFINITY;
      const allowed: typeof candidates = [];
      for (const origin of sourceCandidates) {
        if (allowed.length >= allowedCap) break;
        if (!footprintFits(map, stepFootprint, origin, protectedCells)) continue;
        // 숲: 레이어가 다르면 발자국이 겹쳐도 됨(수관 upper + 밑동 lower).
        if (picker
          ? !spaced(rectAt(origin, stepFootprint), placed, args.minGap)
          : !layeredSpaced(rectAt(origin, stepFootprint), stepFootprint, placed, footprints, args.minGap)) continue;
        allowed.push(origin);
      }
      if (allowed.length === 0) break;
      const remaining = args.count - placed.length;
      const chosen = ranked
        ? chooseRanked({
          allowed,
          choices: allowed,
          placed,
          footprint: stepFootprint,
          minGap: args.minGap,
          map,
          group,
          preferSoftRules: args.preferSoftRules,
          probe: surfaceProbe,
          rankByPoint: ranked.rankByPoint,
          remaining,
        })
        : chooseUniform({ allowed, placed, footprint: stepFootprint, minGap: args.minGap, maxGap: args.maxGap, seed, step, map, group, preferSoftRules: args.preferSoftRules, probe: surfaceProbe });
      placed.push(rectAt(chosen, stepFootprint));
      footprints.push(stepFootprint);
    }
    const touched = placed.flatMap((rect, index) => {
      if (picker) return paintPaletteTile(map, tileset, picker, { x: rect.x, y: rect.y });
      return paint(map, footprints[index] ?? footprint, { x: rect.x, y: rect.y });
    });
    const structureTouched = args.applyStructure && ((group.junctions?.length ?? 0) > 0 || (group.overlays?.length ?? 0) > 0)
      ? applyStructureEdits(map, resolvePlacementStructure({ map, tileset, group, placed }))
      : [];
    const skipped = args.count - placed.length;
    if (placed.length === 0) {
      // 라이브 QA 사고: '키큰 풀' 로 채운 영역에 침엽수를 깔면 0그루가 놓이는데도 ok 로 끝나
      // 나무 한 그루 없는 "빽빽한 숲" 이 완성으로 보고됐다. 0개 배치는 성공이 아니다.
      const explicitOrigins = args.packing === "dense" ? parseExplicitOrigins(rawArgs.origins) : undefined;
      const diagnosticOrigins = explicitOrigins
        ? [...new Map(explicitOrigins.map((origin) => [pointKey(origin), origin])).values()]
        : origins(map, args.area, footprint);
      const diagnostics = measurePropRejections(diagnosticOrigins, footprint, (origin, reasons) => {
        if (origin.x < args.area.x || origin.y < args.area.y
          || origin.x + footprint.w > args.area.x + args.area.w || origin.y + footprint.h > args.area.y + args.area.h) {
          reasons.add("outOfBounds");
          return;
        }
        const probe = { reasons, protectionReasons };
        // Natural candidates pass the base footprint filter before the first
        // bag-prop choice. Dense uses only the actual first-step footprint.
        if (args.packing !== "dense") footprintFits(map, footprint, origin, protectedCells, probe);
        footprintFits(map, stepFootprintAt(0), origin, protectedCells, probe);
        if (args.packing === "dense" && args.trunkVisible && !explicitOrigins
          && !trunkStaysVisible(map, stepFootprintAt(0), origin, new Set(), new Set())) reasons.add("trunkVisibility");
        if (reasons.has("upperOccupied")) {
          // The ordinary upper-only furniture predicate is intentionally not
          // broadened here. Recovery must still not propose exposing blocked
          // lower ground anywhere in the footprint (including another cell).
          const firstFootprint = stepFootprintAt(0);
          for (let y = 0; y < firstFootprint.h; y += 1) {
            for (let x = 0; x < firstFootprint.w; x += 1) {
              const index = y * firstFootprint.w + x;
              if (firstFootprint.lower[index] === TILE.EMPTY && firstFootprint.upper[index] === TILE.EMPTY) continue;
              const lower = tileAt(map, origin.x + x, origin.y + y).lower;
              // Existing trunks legitimately support overlapping tree canopies.
              if (isTreeTrunkTileId(lower) && isTreeCanopyTileId(firstFootprint.upper[index] ?? TILE.EMPTY)) continue;
              const pass = tilePassability(tileset, lower, TILE.EMPTY);
              if (!(pass.up || pass.down || pass.left || pass.right)) reasons.add("lowerImpassable");
            }
          }
        }
      }, explicitOrigins ? "explicit-candidate-origins" : "area-candidate-origins");
      throw new PropPlacementError(
        `${sourceNameOf(picker, group)}를 ${args.count}개 요청했지만 영역 (${args.area.x},${args.area.y}) ${args.area.w}×${args.area.h} 에 한 개도 놓지 못했습니다`,
        map.id, diagnostics,
      );
    }
    const warning = passabilityWarning(draft, map, [...touched, ...structureTouched]);
    const atomicTileCount = picker ? 1 : nonEmptyFootprintTileCount(footprint);
    const clusterNote = !picker && hardClusterRuleCount(group) > 0
      ? ` = ${placed.length * atomicTileCount}타일(클러스터 동반 배치 포함)`
      : "";
    const sourceName = sourceNameOf(picker, group);
    const passableAfter = passableCellCount(draft, map, args.area);
    // dense 를 시킨 쪽은 "정말 못 지나가나" 를 알고 싶어 한다. 남은 통행 칸을 세서 말해준다.
    const passabilityNote = args.packing === "dense"
      ? ` — 영역 ${args.area.w}×${args.area.h} 통행 가능 칸 ${passableBefore}→${passableAfter}${passableAfter === 0 ? " (완전 차단)" : ""}`
      : "";
    const dressing = args.packing === "dense"
      ? `밀집, 간격 0${passabilityNote}`
      : `${args.mode}, 자연도 ${naturalnessLabel(args.naturalness)}, 간격 ${args.minGap}~${args.maxGap}`;
    return {
      summary: `${map.name}에 ${sourceName} ${placed.length}개${clusterNote} 배치(${dressing})${skipped > 0 && args.packing !== "dense" ? ` — ${skipped}개 건너뜀: 보호셀/간격/공간 부족` : ""}${skipped > 0 && args.packing === "dense" ? ` — 자리가 다 차서 ${skipped}개는 놓지 못했습니다` : ""}`,
      data: {
        mode: args.mode,
        packing: args.packing,
        naturalness: args.naturalness,
        placed: placed.length,
        requested: args.count,
        skipped,
        tilesPlaced: placed.length * atomicTileCount,
        passableBefore,
        passableAfter,
      },
      warnings: warning ? [warning] : undefined,
    };
}

function sourceNameOf(
  // paletteTilePickerForTool 은 «고른 것 없음» 을 null 로 준다. undefined 만 받으면 호출부마다
  // ?? undefined 를 붙여야 해서 정의를 넓힌다.
  picker: { readonly presetId: string; readonly role: string } | null | undefined,
  group: { readonly name: string },
): string {
  return picker ? `${picker.presetId}/${picker.role}` : group.name;
}

const scatterObject: ToolDefinition = {
  name: "scatter_object",
  description: `타일 그룹 오브젝트를 영역 안에 여러 개 흩뿌려 배치한다. 프리셋이 있으면 groupId 대신 presetId+paletteRole을 우선 사용하라. 풋프린트 단위로 원자 배치하며 시작칸/이벤트/transfer/상위 타일·물·흙길/모래길·통행 불가 하층 보호셀을 피한다(avoidProtected 기본 true). poisson/cluster는 자연 샘플 rank 를 따르며, 요청 개수를 채울 수 없는 후보만 제외한다. ${NATURALNESS_GUIDANCE}`,
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      groupId: { type: "string" },
      presetId: { type: "string", description: "팔레트 프리셋 id. 지정 시 paletteRole과 함께 1×1 타일 산포" },
      paletteRole: { type: "string", description: "팔레트 role. presetId와 함께 지정" },
      area: AREA_SCHEMA,
      count: { type: "integer" },
      minGap: { type: "integer", description: "오브젝트 사이 최소 빈 칸 수(기본 1)" },
      maxGap: { type: "integer", description: "흩뿌림 후보를 고를 때 선호하는 최대 빈 칸 수(기본 3)" },
      naturalness: { type: "number", description: "0~1 자연도. <0.3 uniform, 0.3~0.7 poisson, >0.7 cluster(기본 0.5)" },
      mode: { type: "string", enum: ["uniform", "poisson", "cluster"], description: "자연산포 모드 명시 오버라이드" },
      seed: { type: "integer", description: "선택 PRNG 시드(같은 입력/시드면 같은 산포)" },
      packing: {
        type: "string",
        enum: ["natural", "dense"],
        description: '"dense"는 빈틈 없이 맞닿게 채운다(간격 0, 자연도 무시). 통행을 막아 달라는 요청에 쓴다. 기본 "natural"',
      },
      avoidProtected: { type: "boolean", description: "시작칸/이벤트/transfer/상위 타일/물·흙길/모래길·통행 불가 하층 회피(기본 true)" },
      preferSoftRules: { type: "boolean", description: "soft/medium 규칙 만족을 우선(기본 true)" },
      applyStructure: { type: "boolean", description: "overlay/처마 생략 등 구조 규칙 자동 적용(기본 true)" },
    },
    required: ["mapId", "area", "count"],
  },
  run: runScatterObject,
};

export const PLACEMENT_TOOLS: readonly ToolDefinition[] = [scatterObject];

function parseArgs(args: Record<string, unknown>): ScatterArgs {
  const areaRecord = record(args["area"], "area{x,y,w,h}");
  const area = { x: int(areaRecord["x"], "area.x"), y: int(areaRecord["y"], "area.y"), w: int(areaRecord["w"], "area.w"), h: int(areaRecord["h"], "area.h") };
  const count = int(args["count"], "count");
  const minGap = int(args["minGap"] ?? 1, "minGap");
  const maxGap = int(args["maxGap"] ?? 3, "maxGap");
  const naturalness = naturalnessArg(args);
  const mode = modeArg(args["mode"], naturalness);
  const seed = optionalInt(args["seed"], "seed");
  const packing = packingArg(args["packing"]);
  if (area.w < 1 || area.h < 1) throw new ToolError("area.w/h는 1 이상이어야 합니다.", { code: "invalid-args" });
  if (count < 1) throw new ToolError("count는 1 이상이어야 합니다.", { code: "invalid-args" });
  if (minGap < 0 || maxGap < minGap) throw new ToolError("간격은 0 이상이고 maxGap은 minGap 이상이어야 합니다.", { code: "invalid-args" });
  return {
    mapId: str(args["mapId"], "mapId"),
    ...(typeof args["groupId"] === "string" && args["groupId"].trim() !== "" ? { groupId: str(args["groupId"], "groupId") } : {}),
    area,
    count,
    // dense 는 "빈틈 없이" 라는 뜻이라 간격 인자를 0 으로 눕힌다. 모델이 minGap:1 을
    // 같이 보내도 dense 의 의미가 이긴다(2026-08-29 "아예 통행불가능하게" 지시).
    minGap: packing === "dense" ? 0 : minGap,
    maxGap: packing === "dense" ? 0 : maxGap,
    packing,
    naturalness,
    mode,
    ...(seed === undefined ? {} : { seed }),
    avoidProtected: bool(args["avoidProtected"] ?? true, "avoidProtected"),
    preferSoftRules: bool(args["preferSoftRules"] ?? true, "preferSoftRules"),
    applyStructure: bool(args["applyStructure"] ?? true, "applyStructure"),
    trunkVisible: args["trunkVisible"] === true,
  };
}

function record(value: unknown, label: string): RecordValue {
  if (!isRecord(value)) throw new ToolError(`${label}가 필요합니다.`, { code: "invalid-args" });
  return value;
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null;
}

function str(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new ToolError(`${label}(문자열)가 필요합니다.`, { code: "invalid-args" });
  return value;
}

function int(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) throw new ToolError(`${label}(정수)가 필요합니다.`, { code: "invalid-args" });
  return value;
}

function optionalInt(value: unknown, label: string): number | undefined {
  if (value === undefined) return undefined;
  return int(value, label);
}

function bool(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new ToolError(`${label}(boolean)가 필요합니다.`, { code: "invalid-args" });
  return value;
}

function packingArg(value: unknown): ScatterPacking {
  if (value === undefined) return "natural";
  if (value === "natural" || value === "dense") return value;
  throw new ToolError('packing은 "natural" 또는 "dense"여야 합니다.', { code: "invalid-args" });
}

function modeArg(value: unknown, naturalness: number): ScatterMode {
  if (value === undefined) {
    if (naturalness < 0.3) return "uniform";
    if (naturalness <= 0.7) return "poisson";
    return "cluster";
  }
  if (value === "uniform" || value === "poisson" || value === "cluster") return value;
  throw new ToolError("mode는 uniform/poisson/cluster 중 하나여야 합니다.", { code: "invalid-args" });
}

function groupById(map: GameMap, project: Project, groupId: string): TileGroupMetadata {
  const group = project.tilesets[map.tilesetId]?.tileGroups?.find((entry) => entry.id === groupId);
  if (!group) throw new ToolError(`타일 그룹을 찾을 수 없습니다: ${groupId}`, { code: "group-not-found", mapId: map.id });
  return group;
}

function syntheticPaletteGroup(picker: PaletteTilePicker): TileGroupMetadata {
  const role = paletteGroupRole(picker.role);
  return {
    id: `${picker.presetId}:${picker.role}`,
    name: `${picker.presetId}/${picker.role}`,
    role,
    defaultLayer: role === "prop" || picker.role === "roof" ? "upper" : "lower",
    tileIds: [],
    description: "palette preset placement",
    placementRules: "",
  };
}

function paletteGroupRole(role: PaletteSlotRole): TileGroupMetadata["role"] {
  switch (role) {
    case "wall":
      return "wall";
    case "water":
      return "water";
    case "roof":
      return "roof";
    case "decor":
    case "furniture":
      return "prop";
    default:
      return "terrain";
  }
}

function singleTileFootprint(): Footprint {
  return { w: 1, h: 1, lower: [TILE.EMPTY], upper: [TILE.EMPTY] };
}

function oneInstance(sample: GroupSample, group: TileGroupMetadata, tileset: TilesetDef): Footprint {
  const sourceRect = sourceRectFootprint(group, tileset);
  if (sourceRect) return sourceRect;
  const hasUpper = sample.upper.some((tile) => tile !== TILE.EMPTY);
  const occupied = new Set<number>();
  for (let index = 0; index < sample.w * sample.h; index += 1) {
    const upper = sample.upper[index] ?? TILE.EMPTY;
    const lower = sample.lower[index] ?? TILE.EMPTY;
    if (upper !== TILE.EMPTY || (lower !== TILE.EMPTY && (!hasUpper || group.tileIds.includes(lower)))) occupied.add(index);
  }
  const first = [...occupied].sort((a, b) => a - b)[0];
  if (first === undefined) throw new ToolError(`타일 그룹 '${group.name}'에는 배치할 타일이 없습니다.`, { code: "empty-group" });
  const component = new Set<number>();
  const stack = [first];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined || component.has(current) || !occupied.has(current)) continue;
    component.add(current);
    const x = current % sample.w;
    const y = Math.floor(current / sample.w);
    if (x > 0) stack.push(y * sample.w + x - 1);
    if (x < sample.w - 1) stack.push(y * sample.w + x + 1);
    if (y > 0) stack.push((y - 1) * sample.w + x);
    if (y < sample.h - 1) stack.push((y + 1) * sample.w + x);
  }
  const xs = [...component].map((index) => index % sample.w);
  const ys = [...component].map((index) => Math.floor(index / sample.w));
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const lower: number[] = [];
  const upper: number[] = [];
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const source = y * sample.w + x;
      const sourceUpper = component.has(source) ? sample.upper[source] ?? TILE.EMPTY : TILE.EMPTY;
      const sourceLower = component.has(source) ? sample.lower[source] ?? TILE.EMPTY : TILE.EMPTY;
      lower.push(hasUpper && !group.tileIds.includes(sourceLower) ? backingLower(tileset, sourceUpper) : sourceLower);
      upper.push(sourceUpper);
    }
  }
  return { w: x1 - x0 + 1, h: y1 - y0 + 1, lower, upper };
}

function sourceRectFootprint(group: TileGroupMetadata, tileset: TilesetDef): Footprint | null {
  const waterAtlas = waterAtlasFootprint(group, tileset);
  if (waterAtlas) return waterAtlas;
  const layered = treeLayeredFootprint(group, tileset);
  if (layered) return layered;
  if (group.patternGrammar?.kind !== "source_rect") return null;
  const rect = group.sourceRect;
  if (rect && rect.width > 0 && rect.height > 0) {
    const w = rect.width;
    const h = rect.height;
    const expected = w * h;
    if (group.tileIds.length < expected) return null;
    const lower: number[] = [];
    const upper: number[] = [];
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const tile = group.tileIds[y * w + x] ?? TILE.EMPTY;
        if (tile === TILE.EMPTY) {
          lower.push(TILE.EMPTY);
          upper.push(TILE.EMPTY);
        } else if (footprintLayer(tileset, group, tile) === "upper") {
          lower.push(isTreeCanopyTileId(tile) ? TILE.EMPTY : backingLower(tileset, tile));
          upper.push(tile);
        } else {
          lower.push(tile);
          upper.push(TILE.EMPTY);
        }
      }
    }
    return { w, h, lower, upper };
  }
  // Legacy 2×2 four-corner fallback (pre-sourceRect groups).
  const topLeft = partTile(group, "topLeft", group.tileIds[0]);
  const topRight = partTile(group, "topRight", group.tileIds[1]);
  const bottomLeft = partTile(group, "bottomLeft", group.tileIds[2]);
  const bottomRight = partTile(group, "bottomRight", group.tileIds[3]);
  const tiles = [topLeft, topRight, bottomLeft, bottomRight];
  if (tiles.every((tile) => tile === TILE.EMPTY)) return null;
  const lower: number[] = [];
  const upper: number[] = [];
  for (const tile of tiles) {
    if (tile === TILE.EMPTY) {
      lower.push(TILE.EMPTY);
      upper.push(TILE.EMPTY);
    } else if (footprintLayer(tileset, group, tile) === "upper") {
      // 수관: lower 를 비워 기존 밑동을 보존(숲 겹침). 잔디 백킹 금지.
      lower.push(isTreeCanopyTileId(tile) ? TILE.EMPTY : backingLower(tileset, tile));
      upper.push(tile);
    } else {
      lower.push(tile);
      upper.push(TILE.EMPTY);
    }
  }
  return { h: 2, lower, upper, w: 2 };
}

function waterAtlasFootprint(group: TileGroupMetadata, tileset: TilesetDef): Footprint | null {
  const rect = group.sourceRect;
  if (group.sourceBlocks?.length !== 9 || !rect || rect.width !== 9 || rect.height !== 9) return null;
  if (group.tileIds.length !== rect.width * rect.height) return null;
  const lower: number[] = [];
  const upper: number[] = [];
  for (const [index, tile] of group.tileIds.entries()) {
    const layer = group.cellLayers?.[index] ?? footprintLayer(tileset, group, tile);
    lower.push(layer === "lower" ? tile : TILE.EMPTY);
    upper.push(layer === "upper" ? tile : TILE.EMPTY);
  }
  return { h: rect.height, lower, upper, w: rect.width };
}

function partTile(group: TileGroupMetadata, role: NonNullable<TileGroupMetadata["patternGrammar"]>["parts"][number]["role"], fallback: number | undefined): number {
  const tile = group.patternGrammar?.parts.find((part) => part.role === role)?.tileIds[0] ?? fallback;
  return typeof tile === "number" && Number.isInteger(tile) ? tile : TILE.EMPTY;
}

function footprintLayer(tileset: TilesetDef, group: TileGroupMetadata, tile: number): "lower" | "upper" {
  // 260–263(수관)/290–293(밑동)은 Combined Town 전역 숫자 판정이라 Modern Exteriors
  // 건물 스탬프(같은 30×16 인덱스지만 전혀 다른 그래픽)까지 나무로 오판한다.
  // building 스탬프(role:"building", defaultLayer:"lower")는 숫자만으로 레이어를 뒤집지 않고,
  // prop(나무/프롭) 컨텍스트에서만 트리 전용 레이어 규칙을 적용한다.
  if (group.role === "prop") {
    if (isTreeCanopyTileId(tile)) return "upper";
    if (isTreeTrunkTileId(tile)) return "lower";
  }
  if (group.defaultLayer === "upper" || group.role === "prop" || isUpperOnlyOverlayTile(tileset, tile)) return "upper";
  return tileset.priority[tile] === "upper" ? "upper" : "lower";
}

function backingLower(tileset: TilesetDef, upperTile: number): number {
  return isUpperOnlyOverlayTile(tileset, upperTile) ? defaultGrassTile(tileset) : TILE.EMPTY;
}

function defaultGrassTile(tileset: TilesetDef): number {
  if (TILE.GRASS >= 0 && TILE.GRASS < tileset.count) return TILE.GRASS;
  const firstLower = tileset.priority.findIndex((layer) => layer === "lower");
  return firstLower >= 0 ? firstLower : TILE.EMPTY;
}

/** 이벤트·transfer·시작칸만 — 지형 점유는 footprintFits 가 레이어별로 본다(숲 겹침용). */
/**
 * 시작칸·이벤트칸·transfer 목적지 — 여기에 소품을 놓으면 무결성 게이트가 커밋 전체를 거부한다
 * (실측 2026-08-30: 합성 숲 dense 가 시작칸을 덮어 `start-position` 오류로 통째로 반려됐다).
 */
export function protectedEventCells(project: Project, map: GameMap): Set<string> {
  const blocked = new Set<string>();
  const visit = (commands: readonly Command[]): void => {
    for (const command of commands) {
      if (command.kind === "transfer" && command.mapId === map.id) blocked.add(key(command.x, command.y));
      else if (command.kind === "choices") {
        for (const option of command.options) visit(option.branch);
        visit(command.cancelBranch ?? []);
      } else if (command.kind === "fork") {
        visit(command.then);
        visit(command.else ?? []);
      } else if (command.kind === "loop") visit(command.body);
    }
  };
  for (const event of map.events) blocked.add(key(event.x, event.y));
  if (project.startMapId === map.id) blocked.add(key(project.startPos.x, project.startPos.y));
  for (const sourceMap of Object.values(project.maps)) {
    for (const event of sourceMap.events) {
      visit(event.commands);
      for (const page of event.pages ?? []) visit(page.commands);
    }
  }
  for (const commonEvent of project.commonEvents) visit(commonEvent.commands);
  return blocked;
}

/**
 * 숲/벤치/가구 등 다칸 소품 풋프린트.
 * 나무: 수관 upper + 밑동 lower (숲 겹침).
 * 벤치·탁자·과일박스: 전부 upper.
 */
function treeLayeredFootprint(group: TileGroupMetadata, _tileset: TilesetDef): Footprint | null {
  const id = group.id;

  // 가로 벤치 327|328
  if (id.includes("bench-horizontal")) {
    const left = group.tileIds[0] ?? 327;
    const right = group.tileIds[1] ?? 328;
    return {
      w: 2,
      h: 1,
      upper: [left, right],
      lower: [TILE.EMPTY, TILE.EMPTY],
    };
  }

  // 세로 의자 358|388 — 둘 다 upper (나무 밑동/수관 분리 금지)
  if (id.includes("bench-vertical")) {
    const top = group.patternGrammar?.parts.find((p) => p.role === "top")?.tileIds[0]
      ?? group.tileIds[0]
      ?? 358;
    const bottom = group.patternGrammar?.parts.find((p) => p.role === "bottom")?.tileIds[0]
      ?? group.tileIds[1]
      ?? 388;
    return {
      w: 1,
      h: 2,
      upper: [top, bottom],
      lower: [TILE.EMPTY, TILE.EMPTY],
    };
  }

  // 가로 탁자 234|235|236 (산포 시 최소 3칸)
  if (id.includes("table-horizontal")) {
    return {
      w: 3,
      h: 1,
      upper: [234, 235, 236],
      lower: [TILE.EMPTY, TILE.EMPTY, TILE.EMPTY],
    };
  }

  // 세로 탁자 144/174/204
  if (id.includes("table-vertical")) {
    return {
      w: 1,
      h: 3,
      upper: [144, 174, 204],
      lower: [TILE.EMPTY, TILE.EMPTY, TILE.EMPTY],
    };
  }

  // 과일박스 202|203
  if (id.includes("fruit-box")) {
    return {
      w: 2,
      h: 1,
      upper: [202, 203],
      lower: [TILE.EMPTY, TILE.EMPTY],
    };
  }

  // 세로 2칸 나무만: conifer/dry (vertical_expandable 가구·문은 여기 넣지 않음)
  const verticalTree = id.includes("conifer-tree")
    || id.includes("dry-tree");
  if (verticalTree) {
    const top = group.patternGrammar?.parts.find((p) => p.role === "top")?.tileIds[0]
      ?? group.tileIds[0]
      ?? TILE.EMPTY;
    const bottom = group.patternGrammar?.parts.find((p) => p.role === "bottom")?.tileIds[0]
      ?? group.tileIds[1]
      ?? TILE.EMPTY;
    return {
      w: 1,
      h: 2,
      upper: [top, TILE.EMPTY],
      lower: [TILE.EMPTY, bottom],
    };
  }
  if (id.includes("broadleaf-tree")) {
    const tl = partTile(group, "topLeft", group.tileIds[0]);
    const tr = partTile(group, "topRight", group.tileIds[1]);
    const bl = partTile(group, "bottomLeft", group.tileIds[2]);
    const br = partTile(group, "bottomRight", group.tileIds[3]);
    return {
      w: 2,
      h: 2,
      upper: [tl, tr, TILE.EMPTY, TILE.EMPTY],
      lower: [TILE.EMPTY, TILE.EMPTY, bl, br],
    };
  }
  return null;
}

/** 흙길·모래 등 길/포장 하층 — 소품 산포 시 보호. */
export function isPathSurfaceTile(tile: number): boolean {
  // 포석(129 블록)도 길 표면 — 소품 산포가 돌길을 막지 않게 보호.
  return isRoadTile(tile) || isSandTile(tile) || tile === TILE.PATH || isCobbleTile(tile);
}

function origins(map: GameMap, area: Area, footprint: Footprint): readonly Point[] {
  const points: Point[] = [];
  for (let y = area.y; y <= area.y + area.h - footprint.h; y += 1) {
    for (let x = area.x; x <= area.x + area.w - footprint.w; x += 1) {
      if (inMapBounds(map, x, y) && inMapBounds(map, x + footprint.w - 1, y + footprint.h - 1)) points.push({ x, y });
    }
  }
  return points;
}

/**
 * 레이어별 적합 — upper 만 쓸 칸은 기존 lower(밑동) 위를 허용(숲 겹침).
 * lower 에 밑동을 쓸 칸은 잔디/빈 칸만(물·길·벽·다른 구조 금지).
 */
function footprintFits(map: GameMap, footprint: Footprint, origin: Point, protectedCells: ReadonlySet<string>, probe?: {
  readonly reasons: Set<PropRejectionReason>;
  readonly protectionReasons: ReadonlyMap<string, readonly PropRejectionReason[]>;
}): boolean {
  if (!inMapBounds(map, origin.x, origin.y) || !inMapBounds(map, origin.x + footprint.w - 1, origin.y + footprint.h - 1)) {
    probe?.reasons.add("outOfBounds");
    return false;
  }
  for (let y = 0; y < footprint.h; y += 1) {
    for (let x = 0; x < footprint.w; x += 1) {
      const mx = origin.x + x;
      const my = origin.y + y;
      if (protectedCells.has(key(mx, my))) {
        if (!probe) return false;
        for (const reason of probe.protectionReasons.get(key(mx, my)) ?? []) probe.reasons.add(reason);
      }
      const source = y * footprint.w + x;
      const wantLower = footprint.lower[source] ?? TILE.EMPTY;
      const wantUpper = footprint.upper[source] ?? TILE.EMPTY;
      if (wantLower === TILE.EMPTY && wantUpper === TILE.EMPTY) continue;
      const index = my * map.width + mx;
      const haveLower = map.lowerTiles[index];
      const haveUpper = map.upperTiles[index];
      if (isLakeAutotileTile(haveLower) || haveLower === TILE.WALL) {
        if (!probe) return false;
        probe.reasons.add("blockedLowerSurface");
      }
      if (isPathSurfaceTile(haveLower)) {
        if (!probe) return false;
        probe.reasons.add("protectedSurface");
      }
      if (wantUpper !== TILE.EMPTY) {
        if (haveUpper !== TILE.EMPTY) {
          if (!probe) return false;
          probe.reasons.add("upperOccupied");
        }
        // 상위 소품: 물·길·벽만 금지. 실내 나무바닥(72) 등 비-잔디 통행 바닥 위에도 놓인다.
        // (예전 잔디/빈칸/나무밑동 제한은 야외 수관 전제 — 실내 가구 place_props가 0개 스킵되던 원인)
      }
      if (wantLower !== TILE.EMPTY) {
        // 밑동 자리: 잔디/빈 칸만. 이미 밑동이 있으면 겹침 금지.
        if ((haveLower !== TILE.EMPTY && haveLower !== TILE.GRASS && haveLower !== wantLower)
          || (isTreeTrunkTileId(haveLower) && isTreeTrunkTileId(wantLower))) {
          if (!probe) return false;
          probe.reasons.add("lowerIncompatible");
        }
      }
    }
  }
  return !probe || probe.reasons.size === 0;
}

function rectAt(origin: Point, footprint: Footprint): Rect {
  return { x: origin.x, y: origin.y, w: footprint.w, h: footprint.h };
}

/**
 * 밀집 배치(packing: "dense") — 영역을 행 우선으로 훑으며 발자국이 들어가는 곳마다 바로 놓는다.
 *
 * 왜 별도 경로인가: 자연 산포는 스텝마다 전 후보를 재검사·재채점하고(상위 512 캡) 자연도 rank 로
 * 고른다. "빈틈 없이 채워라"는 순서가 무의미하고, count 가 커지면 count×후보 곱으로 폭주한다.
 * 여기서는 점유 격자를 들고 한 번만 훑어 O(면적×발자국) 으로 끝낸다.
 *
 * 겹침 규칙은 자연 경로와 같다 — 같은 레이어를 두 번 쓰지만 않으면 수관(upper)이 남의 밑동(lower)
 * 칸을 덮어도 된다. 그래야 나무가 실제로 맞닿아 통행이 막힌다.
 */
/**
 * 호출부가 지정한 배치 원점 목록. 숲 합성이 2×2 활엽수를 **대각 엇갈림 격자**로 세울 때 쓴다 —
 * 후보를 코드가 고르면(행 우선이든 시드 셔플이든) 큰 원자가 서로 줄을 맞추거나 뭉쳐서
 * "대각선으로 선 나무" 라는 의도가 나오지 않는다.
 */
function parseExplicitOrigins(raw: unknown): readonly { readonly x: number; readonly y: number }[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const parsed: { x: number; y: number }[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const x = (entry as { x?: unknown }).x;
    const y = (entry as { y?: unknown }).y;
    if (typeof x !== "number" || typeof y !== "number") continue;
    parsed.push({ x: Math.floor(x), y: Math.floor(y) });
  }
  return parsed.length > 0 ? parsed : undefined;
}

function planDensePlacements(input: {
  readonly map: GameMap;
  readonly area: Area;
  readonly count: number;
  readonly protectedCells: ReadonlySet<string>;
  readonly footprintAt: (step: number) => Footprint;
  readonly selectionSeed: number;
  readonly trunkVisible: boolean;
  readonly explicitOrigins?: readonly { readonly x: number; readonly y: number }[];
}): { readonly placed: readonly Rect[]; readonly footprints: readonly Footprint[] } {
  const { map, area, count, protectedCells, footprintAt } = input;
  if (input.explicitOrigins) return planAtExplicitOrigins(input, input.explicitOrigins);
  // 숲은 행 우선 전수로 놓으면 수관줄·밑동줄이 짝짝이 반복하는 줄무늬이 된다 — 섞은 순서로 간다.
  if (input.trunkVisible) return planForestScatter(input);
  const organicRows = planDenseOrganicRows(input);
  if (organicRows) return organicRows;

  const usedUpper = new Set<number>();
  const usedLower = new Set<number>();
  const candidates: { readonly rect: Rect; readonly footprint: Footprint }[] = [];
  const maxX = area.x + area.w - 1;
  const maxY = area.y + area.h - 1;
  for (let y = area.y; y <= maxY; y += 1) {
    for (let x = area.x; x <= maxX; x += 1) {
      const footprint = footprintAt(candidates.length);
      if (x + footprint.w - 1 > maxX || y + footprint.h - 1 > maxY) continue;
      const origin = { x, y };
      if (!footprintFits(map, footprint, origin, protectedCells)) continue;
      if (!denseCellsFree(map, footprint, origin, usedUpper, usedLower)) continue;
      occupyDenseCells(map, footprint, origin, usedUpper, usedLower);
      candidates.push({ rect: rectAt(origin, footprint), footprint });
    }
  }
  if (count >= candidates.length) {
    return {
      placed: candidates.map((candidate) => candidate.rect),
      footprints: candidates.map((candidate) => candidate.footprint),
    };
  }

  const selected = selectDenseBlueNoise(candidates, count, input.selectionSeed);
  return {
    placed: selected.map((candidate) => candidate.rect),
    footprints: selected.map((candidate) => candidate.footprint),
  };
}

/** 지정된 원점만 순서대로 시도한다 — 맞지 않는 자리는 조용히 건너뛴다(격자가 영역 밖·보호셀에 걸릴 수 있다). */
function planAtExplicitOrigins(
  input: {
    readonly map: GameMap;
    readonly area: Area;
    readonly count: number;
    readonly protectedCells: ReadonlySet<string>;
    readonly footprintAt: (step: number) => Footprint;
  },
  origins: readonly { readonly x: number; readonly y: number }[],
): { readonly placed: readonly Rect[]; readonly footprints: readonly Footprint[] } {
  const { map, area, count, protectedCells, footprintAt } = input;
  const usedUpper = new Set<number>();
  const usedLower = new Set<number>();
  const placed: Rect[] = [];
  const footprints: Footprint[] = [];
  const maxX = area.x + area.w - 1;
  const maxY = area.y + area.h - 1;
  for (const origin of origins) {
    if (placed.length >= count) break;
    const footprint = footprintAt(placed.length);
    if (origin.x < area.x || origin.y < area.y) continue;
    if (origin.x + footprint.w - 1 > maxX || origin.y + footprint.h - 1 > maxY) continue;
    if (!footprintFits(map, footprint, origin, protectedCells)) continue;
    if (!denseCellsFree(map, footprint, origin, usedUpper, usedLower)) continue;
    occupyDenseCells(map, footprint, origin, usedUpper, usedLower);
    placed.push(rectAt(origin, footprint));
    footprints.push(footprint);
  }
  return { placed, footprints };
}

/**
 * 숲 전용 밀집 — 후보를 **시드로 섞은 순서**로 훑으며 놓는다.
 *
 * 왜 행 우선이 아닌가(실측): 밑동 가림 금지 + 행 우선 전수는 수관줄·밑동줄이 짝짝이 반복하는
 * **수평 줄밌무니**를 만들어 다시 기계적으로 읽혔다(24×24 전면이 ^/T 교대 줄무늬이었다).
 * 무작위 순서로 놓으면 나무가 서로 다른 y 오프셋에 서고 틈이 불야정하게 남아 덤불·하층식생이 들어갈
 * 자리가 생긴다. 점유 격자를 그대로 쓰므로 여전히 O(면적)이고 개수는 count 에서 멈춘다.
 */
function planForestScatter(input: {
  readonly map: GameMap;
  readonly area: Area;
  readonly count: number;
  readonly protectedCells: ReadonlySet<string>;
  readonly footprintAt: (step: number) => Footprint;
  readonly selectionSeed: number;
}): { readonly placed: readonly Rect[]; readonly footprints: readonly Footprint[] } {
  const { map, area, count, protectedCells, footprintAt } = input;
  const usedUpper = new Set<number>();
  const usedLower = new Set<number>();
  const origins: Point[] = [];
  const maxX = area.x + area.w - 1;
  const maxY = area.y + area.h - 1;
  for (let y = area.y; y <= maxY; y += 1) {
    for (let x = area.x; x <= maxX; x += 1) origins.push({ x, y });
  }
  const rng = mulberry32(input.selectionSeed);
  for (let index = origins.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    [origins[index], origins[swap]] = [origins[swap]!, origins[index]!];
  }

  const placed: Rect[] = [];
  const footprints: Footprint[] = [];
  for (const origin of origins) {
    if (placed.length >= count) break;
    const footprint = footprintAt(placed.length);
    if (origin.x + footprint.w - 1 > maxX || origin.y + footprint.h - 1 > maxY) continue;
    if (!footprintFits(map, footprint, origin, protectedCells)) continue;
    if (!denseCellsFree(map, footprint, origin, usedUpper, usedLower)) continue;
    if (!trunkStaysVisible(map, footprint, origin, usedUpper, usedLower)) continue;
    occupyDenseCells(map, footprint, origin, usedUpper, usedLower);
    placed.push(rectAt(origin, footprint));
    footprints.push(footprint);
  }
  return { placed, footprints };
}

/**
 * count 보다 후보가 많을 때 빠질 자리를 seeded hard-core 표본으로 고른다.
 * 첫 패스는 인접한 빈칸을 금지해 청색잡음처럼 흩뜨리고, 고밀도라 그 수만으로 부족할 때만
 * 무작위 순서의 나머지 후보를 보충한다. 셔플·근방 검사는 모두 O(후보)이고 개수는 정확하다.
 */
function planDenseOrganicRows(input: {
  readonly map: GameMap;
  readonly area: Area;
  readonly count: number;
  readonly protectedCells: ReadonlySet<string>;
  readonly footprintAt: (step: number) => Footprint;
  readonly selectionSeed: number;
}): { readonly placed: readonly Rect[]; readonly footprints: readonly Footprint[] } | null {
  const footprint = input.footprintAt(0);
  if (footprint.w < 2 || !sameDenseFootprint(footprint, input.footprintAt(input.count - 1))) return null;
  const rows = input.area.h - footprint.h + 1;
  const capacity = Math.floor(input.area.w / footprint.w);
  if (rows < 1 || capacity < 1 || input.count > rows * capacity) return null;

  const rng = mulberry32((input.selectionSeed ^ 0x9e3779b9) >>> 0);
  const quotas = new Array<number>(rows).fill(Math.floor(input.count / rows));
  const order = Array.from({ length: rows }, (_, index) => index);
  shuffleDenseIndices(order, rng);
  for (let index = 0; index < input.count % rows; index += 1) quotas[order[index]!]! += 1;
  // 같은 평균이라도 모든 행이 10그루면 수관이 수평선으로 이어진다. seed 기반 전송으로
  // 7~12그루 행을 섞되 합계는 보존해 세로 리듬까지 깨뜨린다.
  const floor = Math.max(1, Math.floor(input.count / rows) - 3);
  for (let attempt = 0; attempt < rows * 4; attempt += 1) {
    const donor = Math.floor(rng() * rows);
    const receiver = Math.floor(rng() * rows);
    if (donor === receiver || quotas[donor]! <= floor || quotas[receiver]! >= capacity) continue;
    quotas[donor]! -= 1;
    quotas[receiver]! += 1;
  }

  const placed: Rect[] = [];
  const footprints: Footprint[] = [];
  for (let row = 0; row < rows; row += 1) {
    const quota = quotas[row]!;
    const gaps = new Array<number>(quota + 1).fill(0);
    const slack = input.area.w - quota * footprint.w;
    // 남는 칸을 gap마다 한 칸씩 돌리지 않고 무작위 gap에 누적한다. 그래야 빈칸도 등간격
    // 점선이 되지 않고 작은 공터와 좁은 틈이 함께 생긴다.
    for (let cell = 0; cell < slack; cell += 1) gaps[Math.floor(rng() * gaps.length)]! += 1;
    let x = input.area.x + gaps[0]!;
    for (let index = 0; index < quota; index += 1) {
      const origin = { x, y: input.area.y + row };
      if (!footprintFits(input.map, footprint, origin, input.protectedCells)) return null;
      placed.push(rectAt(origin, footprint));
      footprints.push(footprint);
      x += footprint.w + gaps[index + 1]!;
    }
  }
  return { placed, footprints };
}

function sameDenseFootprint(a: Footprint, b: Footprint): boolean {
  return a.w === b.w && a.h === b.h
    && a.upper.length === b.upper.length && a.upper.every((tile, index) => tile === b.upper[index])
    && a.lower.length === b.lower.length && a.lower.every((tile, index) => tile === b.lower[index]);
}

function shuffleDenseIndices(values: number[], rng: () => number): void {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    [values[index], values[swap]] = [values[swap]!, values[index]!];
  }
}

function selectDenseBlueNoise<T extends { readonly rect: Rect }>(
  candidates: readonly T[],
  count: number,
  seed: number,
): readonly T[] {
  const omitCount = candidates.length - count;
  const rng = mulberry32(seed);
  const order = candidates.map((_, index) => index);
  for (let index = order.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    [order[index], order[swap]] = [order[swap]!, order[index]!];
  }

  const omitted = new Set<number>();
  const blockedOrigins = new Set<string>();
  for (const index of order) {
    if (omitted.size >= omitCount) break;
    const rect = candidates[index]!.rect;
    if (blockedOrigins.has(key(rect.x, rect.y))) continue;
    omitted.add(index);
    blockNearbyOrigins(blockedOrigins, rect);
  }
  // 왜 보충 패스가 필요한가: 보호셀·큰 발자국이 후보 격자를 찢으면 인접 금지만으로 목표 빈칸 수를
  // 못 채울 수 있다. 실측 개수 계약을 버리지 않고 seeded 무작위 후보로 정확히 맞춘다.
  for (const index of order) {
    if (omitted.size >= omitCount) break;
    omitted.add(index);
  }
  return candidates.filter((_, index) => !omitted.has(index));
}

function blockNearbyOrigins(blocked: Set<string>, rect: Rect): void {
  for (let y = rect.y - 1; y <= rect.y + rect.h; y += 1) {
    for (let x = rect.x - 1; x <= rect.x + rect.w; x += 1) blocked.add(key(x, y));
  }
}

/**
 * 수괰이 다른 나무 수괰 밑에 바로 오면 거부한다 — 밑동이 가리지면 나무 한 그루가 안 보이고
 * 수괰만 이어진 생울타리 기둥이 된다(실측: 1칸 침엽수 dense 렌더가 세로 수관 사슬로 읽혔다).
 * 가로 밀집은 말리지 않는다 — 그것이 젬을 닿는 수단이다. 검사는 상수 칸만 봐서 선형 시간을 지탄다.
 */
function trunkStaysVisible(
  map: GameMap,
  footprint: Footprint,
  origin: Point,
  usedUpper: ReadonlySet<number>,
  usedLower: ReadonlySet<number>,
): boolean {
  for (let y = 0; y < footprint.h; y += 1) {
    for (let x = 0; x < footprint.w; x += 1) {
      const source = y * footprint.w + x;
      const cellX = origin.x + x;
      const cellY = origin.y + y;
      if (!inMapBounds(map, cellX, cellY)) continue;
      const index = cellY * map.width + cellX;
      // 수관만 보지 않는다 — 덤불도 밑동을 덮으므로 상위 타일 전심을 막는다.
      if ((footprint.upper[source] ?? TILE.EMPTY) !== TILE.EMPTY) {
        if (usedLower.has(index)) return false;
        if (isTreeTrunkTileId(map.lowerTiles[index] ?? TILE.EMPTY)) return false;
      }
      // 반대 방향도 막는다: 새 밑동이 이미 서 있는 수관 아래로 기어가도 가려진다.
      // 이 방향을 막지 않았을 때 24×24 에서 가린 밑동이 16칸 남았다(실측).
      if (isTreeTrunkTileId(footprint.lower[source] ?? TILE.EMPTY)) {
        if (usedUpper.has(index)) return false;
        if ((map.upperTiles[index] ?? TILE.EMPTY) !== TILE.EMPTY) return false;
      }
    }
  }
  return true;
}

function denseCellsFree(
  map: GameMap,
  footprint: Footprint,
  origin: Point,
  usedUpper: ReadonlySet<number>,
  usedLower: ReadonlySet<number>,
): boolean {
  for (let y = 0; y < footprint.h; y += 1) {
    for (let x = 0; x < footprint.w; x += 1) {
      const source = y * footprint.w + x;
      const index = (origin.y + y) * map.width + (origin.x + x);
      if ((footprint.upper[source] ?? TILE.EMPTY) !== TILE.EMPTY && usedUpper.has(index)) return false;
      if ((footprint.lower[source] ?? TILE.EMPTY) !== TILE.EMPTY && usedLower.has(index)) return false;
    }
  }
  return true;
}

function occupyDenseCells(
  map: GameMap,
  footprint: Footprint,
  origin: Point,
  usedUpper: Set<number>,
  usedLower: Set<number>,
): void {
  for (let y = 0; y < footprint.h; y += 1) {
    for (let x = 0; x < footprint.w; x += 1) {
      const source = y * footprint.w + x;
      const index = (origin.y + y) * map.width + (origin.x + x);
      if ((footprint.upper[source] ?? TILE.EMPTY) !== TILE.EMPTY) usedUpper.add(index);
      if ((footprint.lower[source] ?? TILE.EMPTY) !== TILE.EMPTY) usedLower.add(index);
    }
  }
}

function spaced(candidate: Rect, placed: readonly Rect[], minGap: number): boolean {
  return placed.every((rect) => !(candidate.x < rect.x + rect.w && candidate.x + candidate.w > rect.x && candidate.y < rect.y + rect.h && candidate.y + candidate.h > rect.y) && gap(candidate, rect) >= minGap);
}

/** 기하 간격 + 같은 레이어 충돌만 금지(upper 수관이 lower 밑동 칸에 겹치는 숲 허용). */
function layeredSpaced(
  candidate: Rect,
  candidateFp: Footprint,
  placed: readonly Rect[],
  placedFps: readonly Footprint[],
  minGap: number,
): boolean {
  for (let i = 0; i < placed.length; i += 1) {
    const rect = placed[i]!;
    const otherFp = placedFps[i] ?? candidateFp;
    const overlaps = candidate.x < rect.x + rect.w
      && candidate.x + candidate.w > rect.x
      && candidate.y < rect.y + rect.h
      && candidate.y + candidate.h > rect.y;
    if (!overlaps) {
      if (gap(candidate, rect) < minGap) return false;
      continue;
    }
    // 겹치는 맵 칸에서 둘 다 upper 또는 둘 다 lower 를 쓰면 충돌
    for (let y = Math.max(candidate.y, rect.y); y < Math.min(candidate.y + candidate.h, rect.y + rect.h); y += 1) {
      for (let x = Math.max(candidate.x, rect.x); x < Math.min(candidate.x + candidate.w, rect.x + rect.w); x += 1) {
        const ci = (y - candidate.y) * candidateFp.w + (x - candidate.x);
        const oi = (y - rect.y) * otherFp.w + (x - rect.x);
        const cU = candidateFp.upper[ci] ?? TILE.EMPTY;
        const cL = candidateFp.lower[ci] ?? TILE.EMPTY;
        const oU = otherFp.upper[oi] ?? TILE.EMPTY;
        const oL = otherFp.lower[oi] ?? TILE.EMPTY;
        if (cU !== TILE.EMPTY && oU !== TILE.EMPTY) return false;
        if (cL !== TILE.EMPTY && oL !== TILE.EMPTY) return false;
      }
    }
  }
  return true;
}

function gap(a: Rect, b: Rect): number {
  return Math.max(Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), 0), Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h), 0));
}

function rankedNaturalCandidates(input: {
  readonly args: ScatterArgs;
  readonly candidates: readonly Point[];
  readonly footprint: Footprint;
  readonly legacySeed: string;
  readonly map: GameMap;
}): { readonly ordered: readonly Point[]; readonly rankByPoint: ReadonlyMap<string, number> } {
  const { args, candidates, footprint, legacySeed, map } = input;
  const bounds = scatterBoundsForOrigins(args.area, footprint);
  const seedArgs: Record<string, unknown> = args.seed === undefined ? {} : { seed: args.seed };
  const signature = `${legacySeed}|${args.mode}|${naturalnessLabel(args.naturalness)}|${map.width}x${map.height}`;
  const rng = rngForTool(seedArgs, signature);
  const request = Math.min(candidates.length, Math.max(args.count * 4, args.count + 16));
  const sampled = args.mode === "poisson"
    ? poissonScatter(bounds, request, poissonOriginGap(args, footprint), rng).points
    : clusterScatter(bounds, [], request, clusterFalloff(bounds, args.naturalness), rng);
  return rankCandidateOrder(sampled, candidates, seedForTool(seedArgs, signature));
}

function scatterBoundsForOrigins(area: Area, footprint: Footprint): ScatterBounds {
  return {
    x: area.x,
    y: area.y,
    width: Math.max(0, area.w - footprint.w + 1),
    height: Math.max(0, area.h - footprint.h + 1),
  };
}

function poissonOriginGap(args: ScatterArgs, footprint: Footprint): number {
  return Math.max(1, args.minGap + Math.min(3, Math.max(footprint.w, footprint.h) - 1));
}

function clusterFalloff(bounds: ScatterBounds, naturalness: number): number {
  const span = Math.max(1, Math.min(bounds.width, bounds.height));
  return Math.max(1, span * (1.05 - naturalness) * 0.3);
}

function rankCandidateOrder(
  sampled: readonly Point[],
  candidates: readonly Point[],
  seed: number
): { readonly ordered: readonly Point[]; readonly rankByPoint: ReadonlyMap<string, number> } {
  const candidateByKey = new Map(candidates.map((candidate) => [pointKey(candidate), candidate]));
  const seen = new Set<string>();
  const ordered: Point[] = [];
  for (const point of sampled) {
    const key = pointKey(point);
    const candidate = candidateByKey.get(key);
    if (!candidate || seen.has(key)) continue;
    seen.add(key);
    ordered.push(candidate);
  }
  const remaining = candidates
    .filter((candidate) => !seen.has(pointKey(candidate)))
    .sort((a, b) => hash(`${seed}|rest|${pointKey(a)}`) - hash(`${seed}|rest|${pointKey(b)}`));
  ordered.push(...remaining);
  const rankByPoint = new Map<string, number>();
  ordered.forEach((point, index) => rankByPoint.set(pointKey(point), index));
  return { ordered, rankByPoint };
}

function chooseUniform(input: UniformChooseInput): Point {
  const { allowed, placed, footprint, maxGap } = input;
  const nearby = placed.length === 0 ? allowed : allowed.filter((origin) => placed.some((rect) => gap(rectAt(origin, footprint), rect) <= maxGap));
  return choose({ ...input, choices: nearby.length > 0 ? nearby : allowed });
}

/**
 * uniform: soft → 시드 해시. 좁은 영역 패킹은 poisson 경로 + minGap 이 담당.
 * 전 후보 "남은 자리 최대화"는 넓은 들에서 격자 채우기를 만들어 산포가 깨지므로 쓰지 않는다.
 */
function choose(input: ChooseInput): Point {
  const { choices, seed, step, map, group, preferSoftRules, placed, footprint, probe } = input;
  const first = choices[0];
  if (!first) throw new ToolError("배치 후보가 없습니다.", { code: "no-placement" });
  let best = first;
  let bestPenalty = Number.POSITIVE_INFINITY;
  let bestRank = Number.POSITIVE_INFINITY;
  for (const candidate of choices) {
    const candidateRect = rectAt(candidate, footprint);
    const penalty = preferSoftRules ? placementSoftPenalty({ group, candidate: candidateRect, placed, map, probe }) : 0;
    const rank = hash(`${seed}|${step}|${candidate.x},${candidate.y}`);
    if (penalty < bestPenalty || (penalty === bestPenalty && rank < bestRank)) {
      best = candidate;
      bestPenalty = penalty;
      bestRank = rank;
    }
  }
  return best;
}

/**
 * poisson/cluster: naturalScatter 샘플 rank 를 1순위로 고른다(넓은 들에서 진짜 랜덤 산포).
 * 패킹 필터는 공간이 빠듯해 요청 개수를 못 채울 때만(needAfter > maxFuture).
 * soft 규칙은 동점 처리.
 */
function chooseRanked(input: RankedChooseInput & { readonly remaining: number }): Point {
  const { allowed, choices, placed, footprint, minGap, map, group, preferSoftRules, probe, rankByPoint, remaining } = input;
  const first = choices[0];
  if (!first) throw new ToolError("배치 후보가 없습니다.", { code: "no-placement" });

  const scored = choices.map((candidate) => {
    const candidateRect = rectAt(candidate, footprint);
    const future = allowed.filter(
      (origin) =>
        (origin.x !== candidate.x || origin.y !== candidate.y)
        && spaced(rectAt(origin, footprint), [...placed, candidateRect], minGap),
    ).length;
    return {
      candidate,
      future,
      rank: rankByPoint.get(pointKey(candidate)) ?? Number.POSITIVE_INFINITY,
      penalty: preferSoftRules ? placementSoftPenalty({ group, candidate: candidateRect, placed, map, probe }) : 0,
    };
  });

  const maxFuture = scored.reduce((max, row) => Math.max(max, row.future), 0);
  const needAfter = Math.max(0, remaining - 1);
  // 여유 있으면 poisson rank 그대로. 좁을 때만 최대 잔여 자리 후보로 제한.
  const tight = needAfter > maxFuture;
  const pool = tight ? scored.filter((row) => row.future >= maxFuture) : scored;
  const usePool = pool.length > 0 ? pool : scored;

  let best = usePool[0]!;
  for (const row of usePool) {
    if (
      row.rank < best.rank
      || (row.rank === best.rank && row.penalty < best.penalty)
      || (row.rank === best.rank && row.penalty === best.penalty && row.future > best.future)
    ) {
      best = row;
    }
  }
  return best.candidate;
}

/** 문법 없는 prop 가방(3타일 이상) — 1칸 단위 랜덤 산포. */
function isBagPropGroup(group: TileGroupMetadata): boolean {
  if (group.patternGrammar) return false;
  if (group.role !== "prop") return false;
  return group.tileIds.length > 2;
}

function singleUpperPropFootprint(tileId: number, tileset: TilesetDef): Footprint {
  const tile = Number.isInteger(tileId) && tileId >= 0 ? tileId : TILE.EMPTY;
  return {
    w: 1,
    h: 1,
    lower: [backingLower(tileset, tile)],
    upper: [tile],
  };
}

function bagPropFootprint(group: TileGroupMetadata, tileset: TilesetDef, seed: string, step: number): Footprint {
  const ids = group.tileIds.filter((tile) => Number.isInteger(tile) && tile >= 0);
  if (ids.length === 0) return singleUpperPropFootprint(TILE.EMPTY, tileset);
  const tile = ids[hash(`${seed}|bag|${step}`) % ids.length] ?? ids[0];
  return singleUpperPropFootprint(tile, tileset);
}

function hash(input: string): number {
  let value = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function paint(map: GameMap, footprint: Footprint, origin: Point): readonly Point[] {
  const touched: Point[] = [];
  for (let y = 0; y < footprint.h; y += 1) {
    for (let x = 0; x < footprint.w; x += 1) {
      const source = y * footprint.w + x;
      const lower = footprint.lower[source] ?? TILE.EMPTY;
      const upper = footprint.upper[source] ?? TILE.EMPTY;
      if (lower === TILE.EMPTY && upper === TILE.EMPTY) continue;
      const target = (origin.y + y) * map.width + origin.x + x;
      // Planning permits canopy/trunk overlap between trees in the same batch.
      // A later trunk must preserve the earlier tree's canopy, independent of
      // origin order. Ordinary ground replacement still clears its upper layer.
      if (isTreeTrunkTileId(lower)) map.lowerTiles[target] = lower;
      else if (lower !== TILE.EMPTY) setLower(map, origin.x + x, origin.y + y, lower);
      if (upper !== TILE.EMPTY) {
        map.upperTiles[target] = upper;
        // 빈 하층 위 수관이면 잔디 받침(투명 수관 아래 검정 방지). 밑동 위면 유지.
        const haveLower = map.lowerTiles[target];
        if (
          isTreeCanopyTileId(upper)
          && (haveLower === TILE.EMPTY || haveLower < 0)
        ) {
          map.lowerTiles[target] = TILE.GRASS;
        }
      }
      touched.push({ x: origin.x + x, y: origin.y + y });
    }
  }
  return touched;
}

function paintPaletteTile(map: GameMap, tileset: TilesetDef, picker: PaletteTilePicker, origin: Point): readonly Point[] {
  const tile = picker.pick();
  const index = origin.y * map.width + origin.x;
  const layer = paletteLayerForTile(tileset, tile, picker.role);
  if (layer === "upper") map.upperTiles[index] = tile;
  else {
    setLower(map, origin.x, origin.y, tile);
    map.upperTiles[index] = TILE.EMPTY;
  }
  return [{ x: origin.x, y: origin.y }];
}

function paletteLayerForTile(tileset: TilesetDef, tile: number, role: PaletteSlotRole): "lower" | "upper" {
  if (role === "decor" || role === "furniture" || role === "roof") return "upper";
  const home = tileLayerHome(tileset, tile);
  if (home === "upper" || home === "lower") return home;
  return "lower";
}

function applyStructureEdits(map: GameMap, edits: readonly StructureCellEdit[]): readonly Point[] {
  const touched: Point[] = [];
  for (const edit of edits) {
    if (!inMapBounds(map, edit.x, edit.y)) continue;
    const index = edit.y * map.width + edit.x;
    if (edit.layer === "lower") map.lowerTiles[index] = edit.tile;
    else map.upperTiles[index] = edit.tile;
    touched.push({ x: edit.x, y: edit.y });
  }
  return touched;
}

function key(x: number, y: number): string {
  return `${x},${y}`;
}

function pointKey(point: Point): string {
  return key(point.x, point.y);
}

function scatterSeedSignature(map: GameMap, args: ScatterArgs): string {
  const source = args.groupId ?? "palette";
  return `${map.id}|${source}|${args.area.x},${args.area.y},${args.area.w},${args.area.h}|${args.count}|${args.minGap}|${args.maxGap}`;
}
