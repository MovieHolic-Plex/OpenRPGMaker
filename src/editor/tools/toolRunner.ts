import { stripResourceSearchIdPrefixes } from "./resourceSearchIdArgs";
import { adoptBuiltMapAsStart, seedMapPlacementNote } from "./startOnBuiltMap";
import { syncHeroineDeadline } from "@/project/deadlineEnding";
import { normalizePlaceToolArgs } from "./spatialPlaceContract";
// editor/tools/toolRunner.ts
// 툴 실행기. runTool(ctx, name, args, {dryRun}) → ToolResult.
// - 인자를 JSON Schema로 최소 검증.
// - 읽기 툴: project를 읽기만 하고 data 반환.
// - 쓰기 툴: draft(구조적 복제)에 적용 → diff 요약 → commitChangeset(projectLint 게이트).
//   차단 error가 있으면 반영 거부(ok:false). cluster-rule hard error는 issues로 보고하되 통과한다.
//   dryRun이면 통과해도 ctx.project를 갱신하지 않는다.

import type { LintIssue } from "@/project/lint/projectLint";
import type { GameMap, Project } from "@/project/types";
import { sameFamilyTilesets, tilesetFamily, tilesetFamilyLabel } from "@/project/tilesetFamily";
import { assertGenreLock, enforcingGenreLock, GENRE_LOCK_EXEMPT_TOOLS, GenreLockError, genreLockAllowsTileset, genreLockDefaultTileset, genreLockHidesTool, genreLockHiddenToolMessage, markMonsterGenre, monsterMarkerTool, monsterToolStartsLock } from "@/project/genreLock";
import { applyMonsterIntentStart } from "@/project/genrePresets";
import { isRomanceTitleTarget, romanceTitleMismatch, romanceTitleMismatchMessage } from "@/project/romanceTitleArt";
import { assertGenreLockCharsets, genreLockCharsetCatalogFilter, GenreLockCharsetError } from "@/project/genreLockCharsets";
import { enforceGenreLockVisuals, genreLockVisualCatalogFilter, GenreLockVisualError, withGenreLockVisualCatalog, type VisualCatalogFilter } from "@/project/genreLockVisuals";
import { isMonsterOnlyTool, monsterAssetsAllowed, monsterToolArgViolation, monsterToolRejection, withMonsterTurn } from "@/project/genreLockMonsterAssets";
import { assertMonsterAssetLock, monsterAssetCatalogFilters, MonsterAssetLockError } from "@/project/genreLockMonsterAssetsDiff";
import { withNpcGraphicCatalogFilter } from "@/assets/charsetQuery";
import { isRetiredEasyRpgTileset, LIBRARY_IMPORT_TOOLS, retiredEasyRpgMessage } from "@/project/retiredEasyRpgTilesets";
import { guardWholeRecordRewrite } from "./assistantRewriteGuard";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { beginSpatialToolProposal, sealSpatialToolProposal } from "./spatialToolState";
import { verifyPostTilePlacement } from "@/project/lint/postTileVerify";
import { newScenePolishIssues } from "@/project/lint/scenePolishLint";
import { compactMapLayers, EXTRA_LAYER_KEYS, hasExtraLayers } from "@/project/mapLayers";
import { formatTreePairRepairSummary, repairTreePairsOnMap } from "@/project/lint/repairTreePairs";
import { resolveForestCanopyReplacementExemptTileIds } from "./forestComposition";
import { commitChangeset, createDraft, finishDraftTilesets, shareUnchangedTilesets, summarizeChanges, tileBuffersDiffer, tileChangedMapIds } from "./changeset";
import { normalizeArgsForSchema, validateArgs } from "./jsonSchema";
import { applyArgAliases, describeArgError } from "./argRepair";
import { getTool } from "./toolRegistry";
import { authoringWritePrerequisite } from '../../harnesses/_core/authoringRegistry';
import { ToolError, type JsonSchema, type ToolContext, type ToolDefinition, type ToolResult } from "./types";
import { assertHouseProtection, captureHouseProtection, newlyBuiltHouseSnapshots, type HouseSnapshot } from "./houseProtection";

export interface RunToolOptions {
  readonly dryRun?: boolean;
}

/**
 * 사용자가 올린 타일셋을 쓰던 기존 맵의 칩셋을 도구가 말없이 바꾸면 거부한다.
 * 실측(2026-09-25): Rasak 얼음 동굴 요청에 조수가 run_dungeon_room_pipeline 을 불러 맵이
 * easyrpg_chipset_dungeon 으로 바뀌었고, 사용자 타일셋과 그 참고문서는 한 번도 쓰이지 않았다.
 * 칩셋을 일부러 바꾸는 호출은 인자에 새 tilesetId 를 적으므로 통과한다.
 * 프로젝트를 통째로 되돌리거나 갈아 끼우는 도구는 ToolDefinition.allowsTilesetChange 로 빠진다(호출부에서 거른다).
 */
function rejectUploadedTilesetSwap(before: Project, draft: Project, name: string, args: Record<string, unknown>): void {
  for (const [id, previous] of Object.entries(before.maps)) {
    const next = draft.maps[id];
    if (!next || next.tilesetId === previous.tilesetId) continue;
    const tileset = before.tilesets[previous.tilesetId];
    if (tileset?.image.type !== "uploaded" || args.tilesetId === next.tilesetId) continue;
    throw new ToolError(
      `맵 ${id} 은 업로드 타일셋 「${tileset.name}」(${tileset.id}) 을 쓴다 — ${name} 이 칩셋을 ${next.tilesetId} 로 바꾸므로 거부했다. `
      + `이 타일셋의 참고문서(list_tileset_references)를 읽고 paint_tiles·stamp_layer_block 으로 직접 깔아라. 칩셋을 정말 바꾸려면 tilesetId 를 명시하라.`,
      { code: "uploaded-tileset-replaced", mapId: id },
    );
  }
}

/** edit_world_terrain 이 만든 세계 지도 — 칩셋이 그 맵 전용 `worldmap_<mapId>` 다. */
function isWorldmapKitMap(map: GameMap): boolean {
  return Boolean(map.worldmapSource) && map.tilesetId === `worldmap_${map.id}`;
}

/**
 * 기본 칩셋 한 가지 타일로만 채우고 이벤트도 없는 맵 — 새 프로젝트의 빈 시작 맵처럼 사용자가 아직 그림체를 고르지 않은 맵.
 * 사용자가 다른 칩셋을 고른 빈 맵(업로드 칩셋 등)은 고른 것이므로 기준으로 남는다.
 */
function isBlankCanvasMap(map: GameMap): boolean {
  if (map.tilesetId !== DEFAULT_TILESET_ID || map.events.length > 0 || map.upperTiles.some((t) => t >= 0)) return false;
  if (EXTRA_LAYER_KEYS.some((key) => map[key]?.some((t) => key === "shadowBits" ? t !== 0 : t >= 0))) return false;
  if (map.relief?.levels.some((level) => level !== 0) || map.relief?.ramps?.some((ramp) => ramp !== 0)
    || map.relief?.wallDecor?.length || map.doodadGroups?.length) return false;
  const first = map.lowerTiles[0];
  return map.lowerTiles.every((t) => t === first);
}

/**
 * 그림체 기준 맵. 보는 맵이 세계 지도(지도 그림을 자른 전용 칩셋)거나 빈 캔버스(새 프로젝트의 빈 시작 맵)면 그 칩셋은 사용자가 고른 그림체가 아니다 —
 * 프로젝트에서 실제로 칠한 맵 중 가장 많은 계열의 맵을 기준으로, 그런 맵이 없으면 기준 없음(검사 안 함 — 조수가 처음 고른 계열이 다음부터 기준이 된다).
 * 실측(2026-10-03 조선 시험): 빈 버들항 시작 맵 때문에 조선 고을을 로마풍 버들항 칩셋으로 깔았다.
 */
function familyBaselineMap(project: Project, viewed: GameMap): GameMap | undefined {
  if (!isWorldmapKitMap(viewed) && !isBlankCanvasMap(viewed)) return viewed;
  const painted = Object.values(project.maps).filter((map) => !isWorldmapKitMap(map) && !isBlankCanvasMap(map));
  if (!painted.length) return undefined;
  const counts = new Map<string, number>();
  for (const map of painted) {
    const family = tilesetFamily(project, map.tilesetId);
    counts.set(family, (counts.get(family) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
  return painted.find((map) => tilesetFamily(project, map.tilesetId) === top);
}

/** 계열 검사 메시지에 싣는 같은 계열 후보 수 상한. */
const FAMILY_CANDIDATE_LIMIT = 8;

/**
 * 조수가 사용자가 보는 맵과 다른 그림체(칩셋 계열)로 맵을 만들거나 칩셋을 바꾸면 거부한다(2026-09-25 사용자 결정).
 * 기준 = ctx.currentMapId 맵의 칩셋 계열. 대상 = 이번에 새로 생긴 맵 + tilesetId 가 바뀐 맵.
 * 사용자가 이 대화에서 승인한 계열(ctx.approvedTilesetFamilies)은 통과한다. currentMapId 가 없으면 검사하지 않는다.
 * 같은 계열 후보를 알려 주고, 없으면 ask_tileset_change 로 견본을 보여 묻고 턴을 끝내라고 지시한다.
 */
/**
 * 조수 실행이 폐기된 EasyRPG 계열 칩셋으로 새 맵을 만들거나 맵 칩셋을 그 칩셋으로 바꾸면 거부한다(2026-10-06 「대체품이 생기기 전까지 막고」).
 * 이미 그 칩셋인 맵을 고치는 것과 등록 장소 가져오기(LIBRARY_IMPORT_TOOLS)는 통과한다. 계열 검사보다 먼저 돌아 폐기 사유를 말한다.
 */
/** 지금 보는 맵과 같은 계열의 칩셋 — 폐기 칩셋 대신 고를 자리. 실측(2026-10-06): 포켓몬풍 게임 조수가 동굴·체육관을 EasyRPG 던전으로 만들려다 거부만 받았다. */
function sameFamilyHint(ctx: ToolContext, before: Project): string {
  const viewed = ctx.currentMapId ? before.maps[ctx.currentMapId] : undefined;
  if (!viewed || isRetiredEasyRpgTileset(before, viewed.tilesetId)) return "";
  const choices = sameFamilyTilesets(before, tilesetFamily(before, viewed.tilesetId)).slice(0, 12);
  return choices.length > 1 ? ` 지금 보는 맵과 같은 계열 칩셋에서 고르세요: ${choices.map(t => `${t.id}(${t.name})`).join(", ")}.` : "";
}

function rejectRetiredEasyRpgMaps(ctx: ToolContext, before: Project, draft: Project, name: string): void {
  if (!ctx.assistantRun || LIBRARY_IMPORT_TOOLS.has(name)) return;
  for (const [id, next] of Object.entries(draft.maps)) {
    const previous = before.maps[id];
    if (previous && previous.tilesetId === next.tilesetId) continue;
    if (!isRetiredEasyRpgTileset(draft, next.tilesetId)) continue;
    throw new ToolError(retiredEasyRpgMessage(next.tilesetId, name) + sameFamilyHint(ctx, before), { code: "retired-easyrpg-tileset", mapId: id });
  }
}

function rejectTilesetFamilyChange(ctx: ToolContext, before: Project, draft: Project, name: string): void {
  const viewed = ctx.currentMapId ? before.maps[ctx.currentMapId] : undefined;
  if (!viewed) return;
  const currentMap = familyBaselineMap(before, viewed);
  if (!currentMap) return;
  const baseFamily = tilesetFamily(before, currentMap.tilesetId);
  const approved = new Set(ctx.approvedTilesetFamilies ?? []);
  for (const [id, next] of Object.entries(draft.maps)) {
    const previous = before.maps[id];
    if (previous && previous.tilesetId === next.tilesetId) continue;
    // 세계 지도를 만들거나 다시 빌드하는 것도 그림체를 바꾸는 게 아니다. 실측(2026-10-03 조선 시험): 버들항 빈 맵을 보던 조수의
    // edit_world_terrain 이 여기서 거부되고, 없는 타일셋으로 ask_tileset_change 를 부르다 턴을 끝냈다.
    if (isWorldmapKitMap(next)) continue;
    // Requested atlases own their newly created navigation maps. Dedicated
    // cartography does not replace the viewed town's tileset.
    if (!previous && name === 'author_worldmap_structure' && next.tilesetId === 'atlas_cartography'
      && draft.worldAtlases?.some(atlas => atlas.overviewMapId === id || atlas.nodes.some(node => node.mapId === id))) continue;
    const family = tilesetFamily(draft, next.tilesetId);
    if (family === baseFamily || approved.has(family)) continue;
    // 장르 잠금 중 기준 맵이 잠금 밖(켜기 전부터 있던 다른 계열 맵)이면 그 맵의 계열이 「맞는 그림체」가 아니다 — 허용 칩셋으로 새 맵을 만드는 것은 막지 않는다.
    // 기준 맵이 허용 계열이면 이 검사가 그대로 돈다(밝은 monster_* 와 에메랄드풍은 섞지 않는다 — 2026-10-06 연속성 결정).
    if (enforcingGenreLock(draft) && !genreLockAllowsTileset(draft, currentMap.tilesetId) && genreLockAllowsTileset(draft, next.tilesetId)) continue;
    const fromName = before.tilesets[currentMap.tilesetId]?.name ?? currentMap.tilesetId;
    const toName = draft.tilesets[next.tilesetId]?.name ?? next.tilesetId;
    const candidates = sameFamilyTilesets(before, baseFamily).slice(0, FAMILY_CANDIDATE_LIMIT)
      .map((tileset) => `${tileset.id}(${tileset.name})`);
    const fromLabel = tilesetFamilyLabel(before, baseFamily);
    const toLabel = tilesetFamilyLabel(draft, family);
    throw new ToolError(
      `${currentMap === viewed ? "사용자가 보고 있는 맵" : "프로젝트에서 칠한 맵"} ${currentMap.id} 의 칩셋은 「${fromName}」(${currentMap.tilesetId}, ${fromLabel} 계열)인데 `
      + `${name} 이 맵 ${id} 에 「${toName}」(${next.tilesetId}, ${toLabel} 계열)을 쓰려 해 거부했다 — 사용자 승인 없이 타일 그림체를 바꾸지 않는다. `
      + `같은 계열 후보: ${candidates.length ? candidates.join(", ") : "없음"}. `
      + `같은 계열 후보 중 맞는 것을 tilesetId 로 지정해 다시 불러라(이 도구가 tilesetId 를 못 받으면 create_map(tilesetId=후보) 로 빈 맵을 만든 뒤 칠하기 도구로 직접 깔아라). `
      + `맞는 후보가 없으면 칠하지 말고 ask_tileset_change(toTilesetId="${next.tilesetId}") 로 사용자에게 견본을 보여 묻고 턴을 끝내라.`,
      { code: "tileset-family-change", mapId: id },
    );
  }
}

/**
 * 장르 잠금(project/genreLock.ts): 조수·도구가 새 맵을 만들거나 맵 칩셋을 바꿔 허용 계열 밖이 되면 거부한다. 판정은 assertGenreLock 하나.
 * 편집기 직접 편집·예제·콘텐츠 스크립트(ctx.assistantRun 아님)는 막지 않는다. warn 모드는 경고만 돌려준다.
 */
function rejectGenreLockViolation(ctx: ToolContext, before: Project, draft: Project, name: string): string[] {
  if (!ctx.assistantRun || !draft.system.genreLock) return [];
  try {
    return assertGenreLock(before, draft, { toolName: name, approved: ctx.approvedTilesetFamilies ?? [] });
  } catch (cause) {
    if (cause instanceof GenreLockError) throw new ToolError(cause.message, { code: "genre-lock", mapId: cause.mapId });
    throw cause;
  }
}

/**
 * 장르 잠금(캐릭터 칩): 조수·도구가 새로 고르거나 바꾼 걷기 그림(이벤트 페이지·배우)이 허용 계열 밖이면 거부한다 — 판정은 assertGenreLockCharsets 하나.
 * 캠페인 생성·장소 가져오기처럼 프로젝트 내용을 통째로 들이는 도구(placesCuratedCast·allowsTilesetChange·라이브러리 가져오기)는 막지 않고 개수만 경고한다.
 * 이미 있던 그림은 건드리지 않는다. 편집기 직접 편집·콘텐츠 스크립트(ctx.assistantRun 아님)는 막지 않는다.
 */
function rejectGenreLockCharsets(ctx: ToolContext, tool: ToolDefinition, before: Project, draft: Project): string[] {
  if (!ctx.assistantRun || !draft.system.genreLock) return [];
  try {
    return assertGenreLockCharsets(before, draft, {
      toolName: tool.name,
      lenient: tool.placesCuratedCast === true || tool.allowsTilesetChange === true || LIBRARY_IMPORT_TOOLS.has(tool.name),
    });
  } catch (cause) {
    if (cause instanceof GenreLockCharsetError) throw new ToolError(cause.message, { code: "genre-lock" });
    throw cause;
  }
}

/**
 * 장르 잠금(얼굴·전투 그림): 조수·도구가 새로 고르거나 바꾼 얼굴·몬스터 전투 그림·트레이너 전투 그림·전투 배경이 허용 계열 밖이면, 가장 가까운 허용 그림이 있을 때는 거부하고
 * 맞는 허용 그림이 없는 칸은 비워 「생성 대기」로 저장한다(경고로 알린다) — 판정은 enforceGenreLockVisuals 하나. 그림 없이 새로 생긴 트레이너 적 그룹에는 근거가 확실한 번들 그림을 채운다.
 * 통째로 들이는 도구(placesCuratedCast·allowsTilesetChange·라이브러리 가져오기)는 막지 않고 개수만 경고한다. 이미 있던 그림·편집기 직접 편집(ctx.assistantRun 아님)은 건드리지 않는다.
 */
function rejectGenreLockVisuals(ctx: ToolContext, tool: ToolDefinition, before: Project, draft: Project): string[] {
  if (!ctx.assistantRun || !draft.system.genreLock) return [];
  try {
    return enforceGenreLockVisuals(before, draft, {
      toolName: tool.name,
      lenient: tool.placesCuratedCast === true || tool.allowsTilesetChange === true || LIBRARY_IMPORT_TOOLS.has(tool.name),
    });
  } catch (cause) {
    if (cause instanceof GenreLockVisualError) throw new ToolError(cause.message, { code: "genre-lock" });
    throw cause;
  }
}

/**
 * 몬스터 자산 역방향 잠금: 몬스터 프로젝트가 아니고 이번 요청도 몬스터 수집 요청이 아닐 때, 조수·도구가 새로 고르거나 바꾼 몬스터 전용 칩셋·시스템 설정·캐릭터 칩·얼굴·전투 그림을 거부한다.
 * 판정은 assertMonsterAssetLock 하나. 통째로 들이는 도구(캠페인 생성·장소 가져오기)의 그림은 막지 않고 개수만 경고한다(칩셋·시스템 설정은 항상 거부). 이미 있던 것·손 편집(ctx.assistantRun 아님)은 건드리지 않는다.
 */
function rejectMonsterAssets(ctx: ToolContext, tool: ToolDefinition, before: Project, draft: Project): string[] {
  if (!ctx.assistantRun) return [];
  try {
    return assertMonsterAssetLock(before, draft, {
      toolName: tool.name, turn: ctx,
      lenient: tool.placesCuratedCast === true || tool.allowsTilesetChange === true || LIBRARY_IMPORT_TOOLS.has(tool.name),
    });
  } catch (cause) {
    if (cause instanceof MonsterAssetLockError) throw new ToolError(cause.message, { code: "genre-lock" });
    throw cause;
  }
}

/**
 * 조수 실행 중 장르 잠금이 캐릭터 칩·얼굴·전투 그림을 잠그면 그림 검색·기본 선택을 허용 그림으로 좁힌다(동기 도구 실행 구간만).
 * 몬스터 프로젝트가 아니면 몬스터 전용 그림(Scarloxy 트레이너 칩·몬스터 전투 그림·트레이너·몬스터 배경)도 같은 방식으로 뺀다 — 두 필터를 모두 만족해야 보인다.
 * 이 구간 동안 ctx.monsterTurn 도 켜 두어 find_tools·목록 도구가 ctx 없이 같은 판정을 쓴다(withMonsterTurn).
 */
function withCharsetCatalog<T>(ctx: ToolContext, project: Project, run: () => T): T {
  const forwardChars = ctx.assistantRun ? genreLockCharsetCatalogFilter(project) : undefined;
  const forwardVisual = ctx.assistantRun ? genreLockVisualCatalogFilter(project) : undefined;
  const reverse = ctx.assistantRun ? monsterAssetCatalogFilters(project, ctx) : undefined;
  const filter = forwardChars && reverse ? (entry: { readonly textureKey: string }) => forwardChars(entry) && reverse.charset(entry) : forwardChars ?? reverse?.charset;
  const visual: VisualCatalogFilter | undefined = forwardVisual && reverse
    ? { face: (id) => forwardVisual.face(id) && reverse.visual.face(id), battler: (id) => forwardVisual.battler(id) && reverse.visual.battler(id), backdrop: (id) => forwardVisual.backdrop(id) && reverse.visual.backdrop(id) }
    : forwardVisual ?? reverse?.visual;
  const inner = filter ? () => withNpcGraphicCatalogFilter(filter, run) : run;
  const scoped = visual ? () => withGenreLockVisualCatalog(visual, inner) : inner;
  return withMonsterTurn(ctx.assistantRun ? { monsterTurn: ctx.monsterTurn === true } : undefined, scoped);
}

/**
 * 장르 잠금 중 tilesetId 를 생략한 create_map 류 호출의 기본 칩셋이 허용 밖이면(보는 맵이 잠금 이전부터 있던 다른 계열이어도) 허용 칩셋으로 대체하고 경고를 남긴다.
 * 모델이 tilesetId 를 직접 적었으면 건드리지 않는다 — 그것은 아래 거부 경로가 막는다(무음 대체 금지).
 */
/** 연애 게임의 타이틀 배경을 농장·모험 같은 어울리지 않는 번들 그림으로 바꾸는 호출은 거부한다(romanceTitleArt.ts). 이미 그렇던 것은 건드리지 않는다. */
function rejectRomanceTitleMismatch(ctx: ToolContext, before: Project, draft: Project): void {
  if (!ctx.assistantRun || !isRomanceTitleTarget(draft)) return;
  const next = draft.system.titleScreen?.backgroundResourceId;
  if (next === before.system.titleScreen?.backgroundResourceId) return;
  const mismatch = romanceTitleMismatch(next);
  if (mismatch) throw new ToolError(romanceTitleMismatchMessage(mismatch), { code: "romance-title-art" });
}

function genreLockedDefaultTileset(ctx: ToolContext, tool: ToolDefinition, original: Record<string, unknown>, args: Record<string, unknown>): { args: Record<string, unknown>; note?: string } {
  if (!ctx.assistantRun || !tool.defaultTilesetId || !enforcingGenreLock(ctx.project)) return { args };
  if (typeof original.tilesetId === "string" && original.tilesetId.trim().length > 0) return { args };
  if (typeof args.themeScene === "string" && args.themeScene.trim().length > 0) return { args };
  const effective = typeof args.tilesetId === "string" && args.tilesetId.trim().length > 0 ? args.tilesetId : tool.defaultTilesetId(ctx.project);
  const hint = `${tool.name} ${typeof args.name === "string" ? args.name : ""} ${typeof args.theme === "string" ? args.theme : ""} ${typeof args.purpose === "string" ? args.purpose : ""}`;
  const swap = genreLockDefaultTileset(ctx.project, effective, hint);
  return swap ? { args: { ...args, tilesetId: swap.tilesetId }, note: swap.note } : { args };
}

/**
 * tilesetId 없이 불린 create_map 류 도구에 지금 보는 맵의 칩셋을 채운다(ToolDefinition.defaultTilesetId 주석).
 * 도구 기본값이 지금 보는 맵과 같은 계열이면 그대로 둔다.
 */
function argsWithCurrentMapTileset(ctx: ToolContext, tool: ToolDefinition, args: Record<string, unknown>): Record<string, unknown> {
  if (tool.fillsCurrentMapId && ctx.currentMapId && !(typeof args.mapId === "string" && args.mapId.trim().length > 0)) {
    args = { ...args, mapId: ctx.currentMapId };
  }
  if (!tool.defaultTilesetId || !ctx.currentMapId) return args;
  // themeScene 은 자기 칩셋을 정한다 — 보는 맵의 칩셋을 덮어 넣지 않는다(계열이 다르면 실행기 계열 검사가 사용자에게 묻게 한다).
  if (typeof args.themeScene === "string" && args.themeScene.trim().length > 0) return args;
  if (typeof args.tilesetId === "string" && args.tilesetId.trim().length > 0) return args;
  const viewed = ctx.project.maps[ctx.currentMapId];
  const currentMap = viewed ? familyBaselineMap(ctx.project, viewed) : undefined;   // 빈 시작 맵·세계 지도는 채울 칩셋의 기준이 아니다
  if (!currentMap || !ctx.project.tilesets[currentMap.tilesetId]) return args;
  const own = tool.defaultTilesetId(ctx.project);
  if (tilesetFamily(ctx.project, own) === tilesetFamily(ctx.project, currentMap.tilesetId)) return args;
  return { ...args, tilesetId: currentMap.tilesetId };
}

/**
 * 2·4층·그림자가 모두 비면 키를 뺀다(옛 맵 모양으로). setLower 처럼 여러 도구가 공유하는 헬퍼가 칸을 비우므로
 * 도구마다가 아니라 실행기에서 한 번 정리한다. 선택 칸이 있는 맵만 훑는다 — 옛 맵은 비용 없음.
 * 이 도구가 건드린 맵만 정리한다: 새 맵, 칸이 바뀐 맵, 이번에 선택 칸 키가 새로 생긴 맵(썼다가 다 비운 경우 —
 * tileBuffersDiffer 는 없는 칸 = 빈칸으로 봐서 같다고 한다). 손대지 않은 맵의 빈 배열은 그대로 둔다 —
 * 지우면 event_command_assist 의 "명령 외의 변경" 비교와 맵 단위 되돌리기 스냅샷이 어긋난다.
 */
function compactTouchedMapLayers(before: Project, draft: Project): void {
  for (const [id, map] of Object.entries(draft.maps)) {
    if (!hasExtraLayers(map)) continue;
    const previous = before.maps[id];
    const touched = !previous
      || EXTRA_LAYER_KEYS.some((key) => map[key] !== undefined && previous[key] === undefined)
      || tileBuffersDiffer(previous, map);
    if (touched) compactMapLayers(map);
  }
}

function safeScenePolish(before: Project, after: Project): LintIssue[] {
  try { return newScenePolishIssues(before, after); } catch { return []; }
}

/**
 * 커밋 거부 요약에 첫 위반 사유를 싣는다. 예전에는 어느 lint 가 터졌든 `'<tool>' 커밋 거부(무결성 오류)`
 * 로 고정이라 DB AI 바·채팅 로그·모델 응답 어디에도 이유가 보이지 않았다(issues 에만 있었다 —
 * 2026-09-03 실측: `skill does not exist: skill_0001` 을 알아내려면 하네스를 뒤져야 했다).
 * 접두어는 그대로 둔다(기존 테스트·진단이 `커밋 거부` 로 잡는다).
 */
function commitRejectionSummary(name: string, blocking: readonly LintIssue[]): string {
  const base = `'${name}' 커밋 거부(무결성 오류)`;
  const head = blocking[0]?.message.split("\n")[0]?.trim();
  if (!head) return base;
  const clipped = head.length > 160 ? `${head.slice(0, 159)}…` : head;
  const rest = blocking.length - 1;
  return `${base} — ${clipped}${rest > 0 ? ` (+${rest}건)` : ""}`;
}

function issueFromError(cause: unknown): LintIssue {
  if (cause instanceof ToolError) {
    return { severity: "error", code: cause.code, mapId: cause.mapId, x: cause.x, y: cause.y, message: cause.message };
  }
  return { severity: "error", code: "tool-exception", message: cause instanceof Error ? cause.message : String(cause) };
}

// 실패 요약에 원인 한 줄을 포함한다 — 감사 로그만 보고도 원인을 알 수 있고,
// 모델도 summary 단계에서 바로 자가 수정 신호를 받는다.
function failureSummary(name: string, cause: unknown): string {
  const issue = issueFromError(cause);
  const message = issue.message.length > 200 ? `${issue.message.slice(0, 200)}…` : issue.message;
  return `'${name}' 실행 실패: ${message}`;
}

function postprocessFailureSummary(name: string, cause: unknown): string {
  const message = cause instanceof Error ? cause.message : String(cause);
  const compact = message.length > 200 ? `${message.slice(0, 200)}…` : message;
  return `'${name}' 후처리 실패: ${compact}`;
}

function argErrorMessage(message: string, example: Record<string, unknown> | undefined, hint: string | undefined): string {
  const withHint = hint ? `${message} — ${hint}` : message;
  return example ? `${withHint} — 다시 보낼 형식 예시: ${JSON.stringify(example)}` : withHint;
}

// 인자 모양 오류는 스키마 검증(실행 전)과 툴 내부 검사(실행 중) 두 곳에서 나오는데, 교정 예시·힌트·repair 는
// 실행 전 경로에만 붙어 있었다. 그래서 `upsert_event` · `set_scene_mood` 의 "커맨드 형식 오류" 는 고칠 본을
// 받지 못해 같은 인자로 재시도되었다(F1). 거부는 그대로고, 동일한 교정 정보만 둘 다 실어 보낸다.

/**
 * 조수가 빈 값으로 채운 「선택」 칸을 뺀다. gpt-6.1-sol 은 스키마의 선택 칸을 거의 다 채우고, 정할 것이 없으면 "" 나 null 을 넣는다
 * (2026-10-07 장르 시험: 레이어 id:"", 오프닝 text 장면의 composition:{} 같은 거부가 반복됐다). 필수 칸·빈 배열·0 은 건드리지 않는다 —
 * 빈 배열은 「해제」 뜻으로 쓰는 도구가 있다.
 */
/**
 * 모르는 최상위 인자를 말없이 버리지 않는다(2026-10-16 연애 감사). place_npc 는 선언 밖 키(talkFriendship·friendshipUnlock·schedule 등)를
 * 그냥 무시해서 「호감 대화를 켰다」고 믿은 NPC 가 아무 호감도 못 줬다. 조수 실행에서만 거부한다 — 편집기·콘텐츠 스크립트 호출은 그대로.
 * 이 목록은 선택 적용이다: 키를 아는 도구만 올린다(그 외 도구는 기존대로 관대).
 */
const STRICT_TOP_LEVEL_ARG_TOOLS: ReadonlyMap<string, readonly string[]> = new Map([
  // run() 이 직접 읽지만 스키마에는 없는 별칭 두 개.
  ["place_npc", ["dialogue", "commands"]],
]);

function unknownTopLevelArgKeys(tool: { name: string; parameters: JsonSchema }, args: Record<string, unknown>): string[] {
  const extra = STRICT_TOP_LEVEL_ARG_TOOLS.get(tool.name);
  if (!extra) return [];
  const declared = new Set([...Object.keys(tool.parameters.properties ?? {}), ...extra]);
  return Object.keys(args).filter((key) => !declared.has(key) && args[key] !== undefined);
}

function unknownArgKeysMessage(toolName: string, keys: readonly string[]): string {
  const hint = toolName === "place_npc"
    ? " 호감·선물·상점·시간표·friendshipUnlock 같은 인물 옵션은 make_villager 에 있고, place_npc 는 talkFriendship(호감 대화 켜기)만 받는다. 인물 옵션이 필요하면 make_villager 로 만들거나 place_npc 뒤에 update_event 로 고쳐라."
    : "";
  return `${toolName} 은 선언되지 않은 인자 ${keys.map((key) => `'${key}'`).join(", ")} 를 받지 않는다 — 말없이 버리면 저작한 내용이 사라진 채 성공처럼 보이므로 거부했다.${hint}`;
}

function pruneEmptyOptionalArgs(schema: JsonSchema | undefined, value: unknown, path: string, dropped: string[]): unknown {
  if (!schema || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    const items = schema.items;
    return items ? value.map((entry, index) => pruneEmptyOptionalArgs(items, entry, `${path}[${index}]`, dropped)) : value;
  }
  const properties = schema.properties ?? {};
  const required = new Set(schema.required ?? []);
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    const here = path ? `${path}.${key}` : key;
    const emptyObject = !!inner && typeof inner === "object" && !Array.isArray(inner) && Object.keys(inner).length === 0;
    if (!required.has(key) && (inner === "" || inner === null || emptyObject) && key in properties) { dropped.push(here); continue; }
    // 선택 객체인데 그 객체의 필수 칸이 비었으면 객체째 뺀다 — itemCost:{itemId:"",amount:1} 같은 「쓸 생각 없는」 칸.
    const innerSchema = properties[key];
    if (!required.has(key) && innerSchema?.required?.length && inner && typeof inner === "object" && !Array.isArray(inner)
      && innerSchema.required.some((name) => { const v = (inner as Record<string, unknown>)[name]; return v === "" || v === null; })) { dropped.push(here); continue; }
    out[key] = pruneEmptyOptionalArgs(innerSchema, inner, here, dropped);
  }
  return out;
}

function issueFromToolError(tool: ToolDefinition, normalizedArgs: Record<string, unknown>, cause: unknown): LintIssue {
  const issue = issueFromError(cause);
  // 이미 교정본을 실어 보내는 문구는 그대로 둔다. 모델도 테스트도 그 메시지의 JSON 을 끝까지 읽어 그대로
  // 다시 부르므로(`test/aiNativePageContract.test.ts`), 뒤에 무엇을 붙이든 그 예시를 깨뜨린다.
  if (issue.code !== "invalid-args" || issue.message.includes("repair: ") || issue.message.includes('{"')) return issue;
  const repair = tool.invalidArgsRepair?.(normalizedArgs);
  return { ...issue, message: argErrorMessage(issue.message, tool.invalidArgsExample, tool.invalidArgsHint)
    + (repair ? `\nrepair: ${JSON.stringify(repair)}` : "") };
}

export function normalizeToolArgs(name: string, args: Record<string, unknown>): Record<string, unknown> {
  const tool = getTool(name);
  if (!tool) return args;
  return normalizeArgsForSchema(tool.parameters, normalizePlaceToolArgs(tool.name, applyArgAliases(tool.name, tool.parameters, args).args)) as Record<string, unknown>;
}

export function runTool(
  ctx: ToolContext,
  name: string,
  args: Record<string, unknown>,
  options: RunToolOptions = {}
): ToolResult {
  const tool = getTool(name);
  if (!tool) {
    return { ok: false, summary: `알 수 없는 툴: ${name}`, issues: [{ severity: "error", code: "unknown-tool", message: `등록되지 않은 툴: ${name}` }] };
  }

  return runToolDefinition(ctx, tool, args, options);
}

export function runToolDefinition(
  ctx: ToolContext,
  tool: ToolDefinition,
  args: Record<string, unknown>,
  options: RunToolOptions = {},
): ToolResult {
  const name = tool.name;

  // 장르 잠금 중 허용 계열 밖 칩셋 전용 파이프라인은 조수에게 보이지 않는다(find_tools·Pi 도구 목록). 이미 알고 있는 이름으로 부르는 경우의 마지막 방어선.
  if (ctx.assistantRun && genreLockHidesTool(ctx.project, name)) {
    const message = genreLockHiddenToolMessage(ctx.project, name);
    return { ok: false, summary: `'${name}' 장르 잠금으로 거부`, issues: [{ severity: "error", code: "genre-lock", message }] };
  }

  // 몬스터 자산 역방향 잠금: 몬스터 프로젝트가 아니고 이번 요청도 몬스터 수집 요청이 아니면 포켓몬식 전용 도구는 실행하지 않는다(목록·find_tools 에서도 빠져 있다).
  // 일반 도구가 몬스터 전용 인자 값(genre:monster-collect·battleModel:gen1 …)을 받는 경우도 여기서 막는다. 판정은 genreLockMonsterAssets.ts 하나.
  if (ctx.assistantRun && !monsterAssetsAllowed(ctx.project, ctx)) {
    const argMessage = isMonsterOnlyTool(name) ? undefined : monsterToolArgViolation(name, args);
    if (isMonsterOnlyTool(name) || argMessage) {
      return { ok: false, summary: `'${name}' 몬스터 수집 잠금으로 거부`, issues: [{ severity: "error", code: "genre-lock", message: argMessage ?? monsterToolRejection(name) }] };
    }
  }

  const prunedPaths: string[] = [];
  // 모호하지 않은 인자 별칭(table→collection 등)은 옮기고 「X 는 Y 입니다」 경고를 남긴다(argRepair.ts) — 조용한 교정 금지.
  const aliased = applyArgAliases(name, tool.parameters, args);
  const filledArgs = argsWithCurrentMapTileset(ctx, tool,
    normalizeArgsForSchema(tool.parameters, normalizePlaceToolArgs(tool.name, stripResourceSearchIdPrefixes(
      ctx.assistantRun ? pruneEmptyOptionalArgs(tool.parameters, aliased.args, "", prunedPaths) as Record<string, unknown> : aliased.args))) as Record<string, unknown>);
  const lockedDefault = genreLockedDefaultTileset(ctx, tool, aliased.args, filledArgs);
  const normalizedArgs = lockedDefault.args;
  const prunedNote = [
    ...aliased.notes,
    ...(lockedDefault.note ? [lockedDefault.note] : []),
    ...(prunedPaths.length
      ? [`빈 값("" · null · {})으로 보낸 선택 칸 ${prunedPaths.slice(0, 8).join(", ")}${prunedPaths.length > 8 ? " …" : ""} 는 보내지 않은 것으로 봤다 — 정할 것이 없는 칸은 빼고 보낸다.`]
      : []),
  ].join("\n") || null;
  const unknownKeys = ctx.assistantRun ? unknownTopLevelArgKeys(tool, normalizedArgs) : [];
  if (unknownKeys.length > 0) {
    return {
      ok: false,
      summary: `'${name}' 인자 검증 실패`,
      issues: [{ severity: "error", code: "invalid-args", message: unknownArgKeysMessage(name, unknownKeys) }],
    };
  }
  const argErrors = validateArgs(tool.parameters, normalizedArgs);
  if (argErrors.length > 0) {
    const repair = tool.invalidArgsRepair?.(normalizedArgs);
    return {
      ok: false,
      summary: `'${name}' 인자 검증 실패`,
      issues: argErrors.map((message) => ({
        severity: "error",
        code: "invalid-args",
        message: argErrorMessage(describeArgError(message, tool.parameters, normalizedArgs, tool.invalidArgsExample !== undefined), tool.invalidArgsExample, tool.invalidArgsHint)
          + (repair ? `\nrepair: ${JSON.stringify(repair)}` : ""),
      })),
    };
  }

  if (tool.mode === "read") {
    try {
      const exec = withCharsetCatalog(ctx, ctx.project, () => tool.run(ctx.project, normalizedArgs));
      const warnings = [...(prunedNote ? [prunedNote] : []), ...(exec.warnings ?? [])];
      return {
        ok: true,
        summary: exec.summary,
        ...(exec.issues && exec.issues.length > 0 ? { issues: exec.issues } : {}),
        ...(warnings.length > 0 ? { warnings } : {}),
        data: exec.data,
      };
    } catch (cause) {
      const error = cause instanceof Error ? cause : new ToolError(String(cause), { code: "tool-exception" });
      return { ok: false, summary: failureSummary(name, error), issues: [issueFromToolError(tool, normalizedArgs, error)] };
    }
  }

  // 쓰기 툴: draft에 적용.
  const prerequisite = authoringWritePrerequisite(ctx.project);
  if (prerequisite && name !== prerequisite && name !== 'set_build_spec' && name !== 'set_romance_stage'
    && tool.domains?.some(domain => domain === 'event' || domain === 'map' || domain === 'tile')) {
    return { ok: false, summary: '첫 대화를 먼저 작성하세요.', issues: [{ severity: 'error', code: 'authoring-prerequisite',
      message: `${prerequisite}으로 확정한 두 선택의 대사를 먼저 작성한 뒤 장소를 꾸미세요. 임시 초안을 두고 배경 시공부터 시작하지 않습니다.` }] };
  }
  const before = ctx.project;
  const draft = createDraft(before);
  let exec;
  let protectedHouses: HouseSnapshot[];
  try {
    protectedHouses = captureHouseProtection(before);
    // 조수만: 기존 레코드를 통째로 다시 보내면 이벤트 페이지는 거부, DB 레코드는 바뀐 칸만 남긴다(assistantRewriteGuard.ts).
    const guarded = ctx.assistantRun ? guardWholeRecordRewrite(before, name, normalizedArgs) : undefined;
    beginSpatialToolProposal(draft, before);
    // 라우팅이 몬스터 의도를 놓친 자유 경로: 빈 시작 맵뿐인 프로젝트에서 몬스터 전용 도구가 처음 불리면, 도구가 NPC·트레이너를 놓기 전에 몬스터 키트 시작 + 장르 잠금을 건다.
    // 도구가 실패하면 draft 째로 버려지므로 「처음 성공하면」이다. 선언 장르가 이미 있거나(풀어 둔 프로젝트 포함) 맵이 있는 프로젝트는 건드리지 않는다.
    // 역방향 잠금: 일반 도구(set_encounter_table)는 몬스터 프로젝트·몬스터 요청 턴에서만 표지·키트 시작을 건다 — JRPG 의 랜덤 조우 한 줄이 프로젝트를 몬스터 게임으로 바꾸지 못하게 한다.
    const markerAllowed = !ctx.assistantRun || monsterAssetsAllowed(before, ctx);
    const lockProject: Project = ctx.assistantRun && markerAllowed && monsterToolStartsLock(name) && draft.system.genre === undefined && !draft.system.genreLock && applyMonsterIntentStart(draft).locked ? draft : before;
    exec = withCharsetCatalog(ctx, lockProject, () => tool.run(draft, guarded?.args ?? normalizedArgs));
    // 몬스터 수집 전용 도구가 성공하면 장르 표지(system.genre)를 남긴다 — 잠금(빈 시작 맵에서만 걸린다)을 소급해 걸지 않는 대신 기록만 한다.
    if (markerAllowed && monsterMarkerTool(name, normalizedArgs)) markMonsterGenre(draft);
    // 연애: 호감 대화 인물이 둘 이상이 되면 프리셋이 깔아 둔 기한 판정에 인물별 엔딩을 얹는다(rom-c·rom-a: 모델이 set_deadline_ending 을 안 불러 인물 엔딩이 영영 없었다).
    if (name === "place_npc" || name === "make_villager" || name === "upsert_event" || name === "patch_event_page" || name === "define_ending" || name === "set_deadline_ending") {
      const made = syncHeroineDeadline(draft);
      if (made.length) exec = { ...exec, warnings: [`호감 대화 인물이 둘 이상이라 기한 판정에 인물 엔딩 ${made.join(", ")} 을(를) 얹었습니다(기본 에필로그) — define_ending 으로 같은 id 의 에필로그를 그 인물에 맞게 다시 쓰세요.`, ...(exec.warnings ?? [])] };
    }
    const runnerWarnings = [...(prunedNote ? [prunedNote] : []), ...(guarded?.warnings ?? [])];
    if (runnerWarnings.length) exec = { ...exec, warnings: [...runnerWarnings, ...(exec.warnings ?? [])] };
    compactTouchedMapLayers(before, draft);
    // 장르 잠금은 계열 검사보다 먼저 돈다(허용 칩셋 목록·대안을 알리는 더 구체적인 거부). allowsTilesetChange 도구(예제 통째 가져오기 등)도 거친다 — 프로젝트를 통째로 되돌리거나 갈아 끼우는 도구만 빠진다.
    if (!GENRE_LOCK_EXEMPT_TOOLS.has(name)) {
      const lockWarnings = rejectGenreLockViolation(ctx, before, draft, name);
      if (lockWarnings.length) exec = { ...exec, warnings: [...lockWarnings, ...(exec.warnings ?? [])] };
      const charsetWarnings = rejectGenreLockCharsets(ctx, tool, before, draft);
      if (charsetWarnings.length) exec = { ...exec, warnings: [...charsetWarnings, ...(exec.warnings ?? [])] };
      const visualWarnings = rejectGenreLockVisuals(ctx, tool, before, draft);
      if (visualWarnings.length) exec = { ...exec, warnings: [...visualWarnings, ...(exec.warnings ?? [])] };
      rejectRomanceTitleMismatch(ctx, before, draft);
      const monsterWarnings = rejectMonsterAssets(ctx, tool, before, draft);
      if (monsterWarnings.length) exec = { ...exec, warnings: [...monsterWarnings, ...(exec.warnings ?? [])] };
    }
    if (!tool.allowsTilesetChange) {
      rejectUploadedTilesetSwap(before, draft, name, normalizedArgs);
      rejectRetiredEasyRpgMaps(ctx, before, draft, name);
      rejectTilesetFamilyChange(ctx, before, draft, name);
    }
  } catch (cause) {
    const error = cause instanceof Error ? cause : new ToolError(String(cause), { code: "tool-exception" });
    return { ok: false, summary: failureSummary(name, error), issues: [issueFromToolError(tool, normalizedArgs, error)] };
  }

  try {
    const builtHouses = newlyBuiltHouseSnapshots(draft, protectedHouses);
    // Capture the tool's raster changes BEFORE either repair can add changes.
    // Event/DB/name edits must not normalize trees in this or any other map.
    let treeRepairNote: string | null = null;
    if (draft.spatialAuthoring === undefined && tool.preservesAuthoredRaster !== true) {
      const rasterMapIds = tileChangedMapIds(before, draft);
      const repaired = { canopiesPlaced: 0, orphanTrunksRemoved: 0 };
      const repairOptions = rasterMapIds.length ? {
        canopyReplacementExemptTileIds: resolveForestCanopyReplacementExemptTileIds(draft),
      } : {};
      for (const id of rasterMapIds) {
        const map = draft.maps[id];
        if (!map) continue;
        const trees = repairTreePairsOnMap(map, draft.tilesets[map.tilesetId], repairOptions);
        repaired.canopiesPlaced += trees.canopiesPlaced;
        repaired.orphanTrunksRemoved += trees.orphanTrunksRemoved;
      }
      treeRepairNote = formatTreePairRepairSummary(repaired);
    }
    assertHouseProtection(protectedHouses, draft, builtHouses);
    // 새 프로젝트의 빈 시드 맵에 시작이 남은 채 새 맵만 지었으면 시작을 그 맵으로 옮긴다(startOnBuiltMap.ts).
    const startNote = ctx.assistantRun && tool.mode === "write" && name !== "set_start_position" ? adoptBuiltMapAsStart(before, draft) : null;
    if (startNote) exec = { ...exec, warnings: [...(exec.warnings ?? []).filter((w) => !w.startsWith("게임 시작 위치가 아직 빈 시드 맵")), startNote] };
    const seedNote = ctx.assistantRun && tool.mode === "write" ? seedMapPlacementNote(before, draft) : null;
    if (seedNote) exec = { ...exec, warnings: [...(exec.warnings ?? []), seedNote] };

    // 지연 타일셋 사전을 확정한다 — 아래 비교·커밋은 모든 타일셋을 훑으므로, 확정 전이면 전부 복제된다.
    finishDraftTilesets(draft);
    const diff = summarizeChanges(before, draft);
    if (exec.warnings) diff.warnings.push(...exec.warnings);
    if (treeRepairNote) diff.warnings.push(treeRepairNote);

    // baseline(before)을 넘겨 "이 변경이 새로 만든" 오류만 커밋을 막는다 — 선재 오류 프로젝트 편집 허용.
    // 타일 도구는 호출마다 프로젝트를 통째로 직렬화하고 모든 맵의 클러스터 규칙을 다시 훑었다.
    // 왕복은 적용 커밋에 남기고, 클러스터는 타일이 바뀐 맵만 본다.
    const commit = commitChangeset(draft, before, {
      skipRoundtrip: true,
      clusterMapIds: tileChangedMapIds(before, draft),
    });
    if (!commit.ok) {
      const blocking = commit.blocking.length > 0 ? commit.blocking : commit.issues;
      return {
        ok: false,
        summary: commitRejectionSummary(name, blocking),
        diff,
        issues: [...(exec.issues ?? []), ...blocking],
      };
    }

    sealSpatialToolProposal(draft);
    if (!options.dryRun) {
      shareUnchangedTilesets(before, draft);
      ctx.project = draft;
    }
    const postTile = verifyPostTilePlacement(draft, { name, args: normalizedArgs, data: exec.data });
    if (postTile.length > 0) diff.warnings.push(...postTile.map((issue) => issue.message));
    // 장면 다듬기(scene-*): 이번 변경이 새로 만든 것만 — 앞에 싣는다(모델에는 issues 앞 8건만 간다). 규칙은 game-scene-polish 스킬.
    const scene = tool.mode === "write" ? safeScenePolish(before, draft) : [];
    if (scene.length > 0) diff.warnings.push(...scene.map((issue) => issue.message));
    const issues = [...(exec.issues ?? []), ...scene, ...commit.issues, ...postTile];
    const summary = treeRepairNote ? `${exec.summary} · ${treeRepairNote}` : exec.summary;
    return {
      ok: true,
      summary,
      diff,
      issues: issues.length > 0 ? issues : undefined,
      data: exec.data,
    };
  } catch (cause) {
    return {
      ok: false,
      // Expected invariant rejections are tool failures, not postprocessor crashes.
      summary: cause instanceof ToolError ? failureSummary(name, cause) : postprocessFailureSummary(name, cause),
      issues: [cause instanceof ToolError ? issueFromError(cause)
        : { severity: "error", code: "tool-postprocess", message: cause instanceof Error ? cause.message : String(cause) }],
    };
  }
}
