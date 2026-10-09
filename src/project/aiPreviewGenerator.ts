import {
  AI_PREVIEW_DEFERRED_COMMAND_CONTRACT,
  hasCompleteRuntimeArrays,
  missingPreviewClarification,
  selectHighConfidenceCharsetCandidate,
  type AiPreviewEvidence,
  type AiPreviewMissingEvidence,
  type AiPreviewValidationEvidence,
} from "@/project/aiPreviewContracts";
import { generateAiPreviewThemeMap } from "@/project/aiPreviewThemeGrammar";
import { resolveAiPreviewTheme } from "@/project/aiPreviewThemeResolver";
import { canMove, cellPassability } from "@/project/collision";
import { TILE } from "@/project/defaults/constants";
import { eventBodyRect, eventCoversPoint } from "@/project/eventFootprintQuery";
import { rectCells } from "@/project/footprint";
import type { GameEvent, GameMap, Project, TilesetDef } from "@/project/types";

export type AiPreviewRequest = {
  readonly goal: string;
  readonly sourceProject: Project;
  readonly tilesetId?: string;
  readonly charsetGroup?: string;
  readonly mapId?: string;
  readonly mapName?: string;
  readonly width?: number;
  readonly height?: number;
};

export type AiPreviewSuccess = {
  readonly ok: true;
  readonly project: Project;
  readonly map: GameMap;
  readonly evidence: AiPreviewEvidence;
};

export type AiPreviewFailure = {
  readonly ok: false;
  readonly missingEvidence: readonly AiPreviewMissingEvidence[];
  readonly clarificationQuestion: string;
};

export type AiPreviewResult = AiPreviewFailure | AiPreviewSuccess;

const DEFAULT_PREVIEW_WIDTH = 12;
const DEFAULT_PREVIEW_HEIGHT = 10;
const PREVIEW_MAP_ID = "ai-preview-map";
const MAX_PREVIEW_TILES = 4_096;
const MIN_PREVIEW_DIMENSION = 7;

export function createAiPreviewProject(request: AiPreviewRequest): AiPreviewResult {
  const sourceProject = request.sourceProject;
  const sourceMap = sourceProject.maps[sourceProject.startMapId];
  if (!sourceMap) {
    return fail([{ code: "chipset_not_renderable", detail: `Start map ${sourceProject.startMapId} does not exist in the source project.` }]);
  }
  const tilesetId = request.tilesetId ?? sourceMap.tilesetId;
  if (!sourceProject.tilesets[tilesetId]) {
    return fail([{ code: "chipset_not_renderable", detail: `Tileset ${tilesetId} does not exist in the source project.` }]);
  }

  const themeResolution = resolveAiPreviewTheme(sourceProject, request.goal, tilesetId, request.tilesetId !== undefined);
  if (!themeResolution.ok) return fail(themeResolution.missingEvidence);
  const tileset = themeResolution.tileset;
  const charset = selectHighConfidenceCharsetCandidate(request.goal, request.charsetGroup);
  if (!charset) {
    return fail([{ code: "charset_not_high_confidence", detail: "No high-confidence EasyRPG CharSet candidate matched the preview request." }]);
  }

  const width = normalizedPreviewDimension(request.width, DEFAULT_PREVIEW_WIDTH);
  const height = normalizedPreviewDimension(request.height, DEFAULT_PREVIEW_HEIGHT);
  if (width === null || height === null) {
    return fail([{ code: "incomplete_runtime_arrays", detail: `Preview dimensions must be positive safe integers of at least ${MIN_PREVIEW_DIMENSION}x${MIN_PREVIEW_DIMENSION}.` }]);
  }
  if (width * height > MAX_PREVIEW_TILES) {
    return fail([{ code: "incomplete_runtime_arrays", detail: `Preview dimensions cannot exceed ${MAX_PREVIEW_TILES} tiles.` }]);
  }
  const mapId = request.mapId ?? uniquePreviewMapId(sourceProject, PREVIEW_MAP_ID);
  if (request.mapId && sourceProject.maps[request.mapId]) {
    return fail([{ code: "incomplete_runtime_arrays", detail: `Preview map id ${request.mapId} already exists in the source project.` }]);
  }
  if (!mapId) {
    return fail([{ code: "incomplete_runtime_arrays", detail: "No collision-free deterministic AI preview map id is available." }]);
  }
  const generated = generateAiPreviewThemeMap({
    charsetAssetId: charset.assetId,
    charsetTextureKey: charset.textureKey,
    goal: request.goal,
    height,
    mapId,
    name: request.mapName ?? previewMapName(request.goal),
    themeEligibility: themeResolution.themeEligibility,
    themeId: themeResolution.themeId,
    tileset,
    width,
  });
  const previewProject = cloneProject(sourceProject);
  previewProject.maps[generated.map.id] = generated.map;
  previewProject.mapTree = appendPreviewMapTreeNode(previewProject.mapTree, generated.map.id);
  previewProject.startMapId = generated.map.id;
  previewProject.startPos = { ...generated.startPos };

  const validation = validateAiPreviewProject(previewProject, generated.map.id);
  if (!allValidationPassed(validation)) {
    return fail([{ code: "incomplete_runtime_arrays", detail: `Generated preview map failed validation: ${failedValidationKeys(validation).join(", ")}.` }]);
  }

  return {
    ok: true,
    project: previewProject,
    map: generated.map,
    evidence: {
      sourceGoal: request.goal,
      chipsetCandidate: themeResolution.chipsetCandidate,
      charsetCandidates: [charset],
      tileGroups: themeResolution.chipsetCandidate.semanticGroups,
      themeEligibility: themeResolution.themeEligibility,
      grammarEvidence: generated.grammarEvidence,
      deferredCommandContract: AI_PREVIEW_DEFERRED_COMMAND_CONTRACT,
      npcMetadata: [generated.npcEvidence],
      validation,
      missingEvidence: [],
      clarificationQuestion: null,
    },
  };
}

export function validateAiPreviewProject(project: Project, mapId: string): AiPreviewValidationEvidence {
  const map = project.maps[mapId];
  const tileset = map ? project.tilesets[map.tilesetId] : undefined;
  if (!map || !tileset) return failedValidation();
  return {
    validTilesetId: map.tilesetId in project.tilesets && project.startMapId === mapId,
    validLayerLengths: map.lowerTiles.length === map.width * map.height && map.upperTiles.length === map.width * map.height,
    inRangeTileIds: [...map.lowerTiles, ...map.upperTiles].every((tile) => tile === TILE.EMPTY || inTileRange(tile, tileset)),
    passabilityCovered: hasCompleteRuntimeArrays(tileset),
    priorityCovered: hasCompleteRuntimeArrays(tileset),
    terrainCovered: hasCompleteRuntimeArrays(tileset),
    validStartPosition: inBounds(map, project.startPos.x, project.startPos.y) && isMapTilePassable(map, tileset, project.startPos.x, project.startPos.y),
    boundaryCollisionChecked: boundaryIsSolid(map, tileset),
    reachableNpcEvents: map.events.every((event) => eventIsReachable(project, map, tileset, event)),
  };
}


function fail(missingEvidence: readonly AiPreviewMissingEvidence[]): AiPreviewFailure {
  const clarification = missingPreviewClarification(missingEvidence);
  return {
    ok: false,
    missingEvidence,
    clarificationQuestion: clarification.question,
  };
}

function cloneProject(project: Project): Project {
  return structuredClone(project) as Project;
}

function appendPreviewMapTreeNode(root: Project["mapTree"], mapId: string): Project["mapTree"] {
  if (containsMapTreeNode(root, mapId)) return root;
  return {
    ...root,
    children: [...root.children, { mapId, children: [] }],
  };
}
function uniquePreviewMapId(project: Project, baseId: string): string | null {
  if (!project.maps[baseId]) return baseId;
  for (let suffix = 2; suffix <= 999; suffix += 1) {
    const candidate = `${baseId}-${suffix}`;
    if (!project.maps[candidate]) return candidate;
  }
  return null;
}

function containsMapTreeNode(node: Project["mapTree"], mapId: string): boolean {
  return node.mapId === mapId || node.children.some((child) => containsMapTreeNode(child, mapId));
}

function normalizedPreviewDimension(value: number | undefined, fallback: number): number | null {
  const dimension = value ?? fallback;
  return Number.isSafeInteger(dimension) && dimension >= MIN_PREVIEW_DIMENSION ? dimension : null;
}


function isMapTilePassable(map: GameMap, tileset: TilesetDef, x: number, y: number): boolean {
  if (!inBounds(map, x, y)) return false;
  const passability = cellPassability(tileset, map, y * map.width + x);
  return passability.up || passability.down || passability.left || passability.right;
}

function boundaryIsSolid(map: GameMap, tileset: TilesetDef): boolean {
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (x !== 0 && y !== 0 && x !== map.width - 1 && y !== map.height - 1) continue;
      if (isMapTilePassable(map, tileset, x, y)) return false;
    }
  }
  return true;
}

// 도달 판정은 이벤트의 **몸 사각** 아무 칸에 닿으면 성공이다. 앵커 한 칸만 보던 예전 판정은
// 2x2 이벤트의 앵커가 벽에 얹혀 있고 나머지 칸이 열려 있으면 "도달 불가" 로 오판했다.
// 1x1 이면 몸 사각이 앵커 한 칸이라 판정이 같다.
function eventIsReachable(project: Project, map: GameMap, tileset: TilesetDef, event: GameEvent): boolean {
  const body = rectCells(eventBodyRect(event));
  if (!body.some((cell) => inBounds(map, cell.x, cell.y) && isMapTilePassable(map, tileset, cell.x, cell.y))) return false;
  const seen = new Set<string>();
  const queue = [{ ...project.startPos }];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    const key = `${current.x},${current.y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (eventCoversPoint(event, current.x, current.y)) return true;
    for (const next of neighbors(current.x, current.y)) {
      const nextKey = `${next.x},${next.y}`;
      if (seen.has(nextKey) || !canMove(project, map, current.x, current.y, next.x, next.y)) continue;
      queue.push(next);
    }
  }
  return false;
}

function neighbors(x: number, y: number): readonly { readonly x: number; readonly y: number }[] {
  return [
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y: y + 1 },
    { x, y: y - 1 },
  ];
}

function inBounds(map: GameMap, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < map.width && y < map.height;
}

function inTileRange(tile: number, tileset: TilesetDef): boolean {
  return Number.isInteger(tile) && tile >= 0 && tile < tileset.count;
}

function failedValidation(): AiPreviewValidationEvidence {
  return {
    validTilesetId: false,
    validLayerLengths: false,
    inRangeTileIds: false,
    passabilityCovered: false,
    priorityCovered: false,
    terrainCovered: false,
    validStartPosition: false,
    boundaryCollisionChecked: false,
    reachableNpcEvents: false,
  };
}

function allValidationPassed(validation: AiPreviewValidationEvidence): boolean {
  return Object.values(validation).every(Boolean);
}

function failedValidationKeys(validation: AiPreviewValidationEvidence): string[] {
  return Object.entries(validation).filter(([, passed]) => !passed).map(([key]) => key);
}

function previewMapName(goal: string): string {
  return `AI Preview - ${goal}`.slice(0, 80);
}

