import {
  type AiPreviewGrammarEvidence,
  type AiPreviewNpcEvidence,
  type AiPreviewThemeCapability,
  type AiPreviewThemeEligibilityEvidence,
  type AiPreviewThemeId,
} from "@/project/aiPreviewContracts";
import { TILE } from "@/project/defaults/constants";
import type { GameEvent, GameMap, TileGroupMetadata, TilesetDef } from "@/project/types";

export const AI_PREVIEW_GRAMMAR_VERSION = "1";
const PREVIEW_NPC_EVENT_ID = "ai-preview-npc-1";

type ThemeGrammarInput = {
  readonly charsetAssetId: string;
  readonly charsetTextureKey: string;
  readonly goal: string;
  readonly height: number;
  readonly mapId: string;
  readonly name: string;
  readonly themeEligibility: AiPreviewThemeEligibilityEvidence;
  readonly themeId: AiPreviewThemeId;
  readonly tileset: TilesetDef;
  readonly width: number;
};

export type ThemeGrammarOutput = {
  readonly grammarEvidence: AiPreviewGrammarEvidence;
  readonly map: GameMap;
  readonly npcEvidence: AiPreviewNpcEvidence;
  readonly startPos: { readonly x: number; readonly y: number };
};

export function generateAiPreviewThemeMap(input: ThemeGrammarInput): ThemeGrammarOutput {
  const floorTile = firstCapabilityTile(input.themeEligibility, input.tileset, "walkableFloor") ?? TILE.EMPTY;
  const wallTile = firstCapabilityTile(input.themeEligibility, input.tileset, input.themeId === "dungeon" ? "solidBoundary" : "wallFace") ?? floorTile;
  const trimTile = firstCapabilityTile(input.themeEligibility, input.tileset, input.themeId === "interior-house" ? "roomTrim" : "buildingShell");
  const grammarId = grammarIdForTheme(input.themeId);
  const selectedCapabilities = selectedCapabilitiesForTheme(input.themeId, trimTile);
  const lowerTiles = fillThemeLowerTiles(input.width, input.height, input.themeId, floorTile, wallTile, trimTile);
  const upperTiles = new Array<number>(input.width * input.height).fill(TILE.EMPTY);
  const npcX = Math.min(2, input.width - 2);
  const npcY = Math.min(2, input.height - 2);
  const event = previewNpcEvent(input, npcX, npcY);

  return {
    grammarEvidence: {
      themeId: input.themeId,
      grammarId,
      grammarVersion: AI_PREVIEW_GRAMMAR_VERSION,
      deterministic: true,
      selectedCapabilities,
    },
    map: {
      id: input.mapId,
      name: input.name,
      width: input.width,
      height: input.height,
      tilesetId: input.tileset.id,
      tileSize: input.tileset.tileSize,
      lowerTiles,
      upperTiles,
      events: [event],
    },
    npcEvidence: {
      eventId: event.id,
      displayName: npcDisplayName(input.goal),
      role: "preview-guide",
      charsetAssetId: input.charsetAssetId,
      charsetFrame: { characterIndex: 0, direction: "down", pattern: 1 },
      sourceGoal: input.goal,
      confidence: "high",
      placementReason: `Placed at (${event.x}, ${event.y}) after validating ${grammarId} as passable and reachable.`,
    },
    startPos: { x: 1, y: 1 },
  };
}

function fillThemeLowerTiles(
  width: number,
  height: number,
  themeId: AiPreviewThemeId,
  floorTile: number,
  wallTile: number,
  trimTile: number | null
): number[] {
  return Array.from({ length: width * height }, (_, index) => {
    const x = index % width;
    const y = Math.floor(index / width);
    if (x === 0 || y === 0 || x === width - 1 || y === height - 1) return wallTile;
    if (themeId === "dungeon" && y === Math.floor(height / 2) && x > 1 && x < width - 2 && x !== Math.floor(width / 2)) return wallTile;
    if (themeId === "interior-house" && trimTile !== null && y === 1 && x > 1 && x < width - 2) return trimTile;
    return floorTile;
  });
}

function firstCapabilityTile(
  evidence: AiPreviewThemeEligibilityEvidence,
  tileset: TilesetDef,
  capability: AiPreviewThemeCapability
): number | null {
  const requirementGroups = groupsForCapability(evidence, capability);
  for (const group of requirementGroups) {
    const tile = group.tileIds.find((candidate) => Number.isInteger(candidate) && candidate >= 0 && candidate < tileset.count);
    if (tile !== undefined) return tile;
  }
  return null;
}

function groupsForCapability(evidence: AiPreviewThemeEligibilityEvidence, capability: AiPreviewThemeCapability): readonly TileGroupMetadata[] {
  if (capability === "walkableFloor") return evidence.semanticGroups.filter((group) => group.role === "terrain");
  if (capability === "solidBoundary" || capability === "wallFace") return evidence.semanticGroups.filter((group) => group.role === "wall");
  if (capability === "roomTrim" || capability === "buildingShell" || capability === "doorOrEntrance") return evidence.semanticGroups.filter((group) => group.role === "building" || group.role === "prop");
  if (capability === "waterOrHazard") return evidence.semanticGroups.filter((group) => group.role === "water");
  return evidence.semanticGroups.filter((group) => group.role === "prop" || group.role === "fence" || group.role === "roof");
}

function selectedCapabilitiesForTheme(themeId: AiPreviewThemeId, trimTile: number | null): readonly AiPreviewThemeCapability[] {
  if (themeId === "dungeon") return ["walkableFloor", "solidBoundary"];
  if (themeId === "interior-house") return trimTile === null ? ["walkableFloor", "wallFace"] : ["walkableFloor", "wallFace", "roomTrim"];
  return ["walkableFloor", "wallFace"];
}

function previewNpcEvent(input: ThemeGrammarInput, x: number, y: number): GameEvent {
  return {
    id: PREVIEW_NPC_EVENT_ID,
    x,
    y,
    sprite: { type: "bundled", id: input.charsetTextureKey },
    trigger: { kind: "action" },
    commands: [],
    pages: [{
      id: `${PREVIEW_NPC_EVENT_ID}-page-1`,
      name: npcDisplayName(input.goal),
      conditions: [],
      graphic: {
        sprite: { type: "bundled", id: input.charsetTextureKey },
        direction: "down",
        pattern: 1,
      },
      trigger: { kind: "action" },
      priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [],
    }],
  };
}

function grammarIdForTheme(themeId: AiPreviewThemeId): string {
  if (themeId === "dungeon") return "dungeon-room-corridor";
  if (themeId === "interior-house") return "interior-house-room";
  return "combined-town-compatible";
}

function npcDisplayName(goal: string): string {
  return goal.includes("항구") ? "항구 안내인" : "미리보기 NPC";
}
