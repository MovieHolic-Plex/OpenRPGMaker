import {
  evaluateThemeEligibility,
  type AiChipsetCandidate,
  type AiPreviewMissingEvidence,
  type AiPreviewThemeEligibilityEvidence,
  type AiPreviewThemeId,
} from "@/project/aiPreviewContracts";
import type { Project, TilesetDef } from "@/project/types";

export type AiPreviewThemeResolution =
  | {
      readonly ok: true;
      readonly themeId: AiPreviewThemeId;
      readonly tileset: TilesetDef;
      readonly chipsetCandidate: AiChipsetCandidate;
      readonly themeEligibility: AiPreviewThemeEligibilityEvidence;
    }
  | {
      readonly ok: false;
      readonly missingEvidence: readonly AiPreviewMissingEvidence[];
    };

const THEME_ORDER = ["combined-town", "dungeon", "interior-house"] as const satisfies readonly AiPreviewThemeId[];

export function resolveAiPreviewTheme(
  project: Project,
  goal: string,
  initialTilesetId: string,
  explicitTilesetId: boolean
): AiPreviewThemeResolution {
  const goalTheme = themeForGoal(goal);
  if (goalTheme === "unsupported") {
    return {
      ok: false,
      missingEvidence: [{ code: "unsupported_theme", detail: "World and ship preview generation are deferred until a later approved traversal-boundary validator exists." }],
    };
  }

  const preferredThemes = goalTheme ? [goalTheme] : THEME_ORDER;
  const preferredTilesets = explicitTilesetId
    ? [project.tilesets[initialTilesetId]].filter((tileset): tileset is TilesetDef => Boolean(tileset))
    : Object.values(project.tilesets);

  for (const themeId of preferredThemes) {
    for (const tileset of preferredTilesets) {
      const eligibility = evaluateThemeEligibility(tileset, themeId);
      if (!eligibility.eligible) continue;
      return {
        ok: true,
        themeId,
        tileset,
        chipsetCandidate: {
          tilesetId: tileset.id,
          textureKey: tileset.image.id,
          confidence: "high",
          semanticGroups: eligibility.evidence.semanticGroups,
        },
        themeEligibility: eligibility.evidence,
      };
    }
  }

  const fallbackTileset = project.tilesets[initialTilesetId] ?? preferredTilesets[0];
  const fallbackTheme = preferredThemes[0] ?? "combined-town";
  const fallback = fallbackTileset ? evaluateThemeEligibility(fallbackTileset, fallbackTheme) : null;
  return {
    ok: false,
    missingEvidence: fallback?.missingEvidence.length
      ? fallback.missingEvidence
      : [{ code: "unsupported_theme", detail: `No high-confidence metadata pack satisfies the requested ${fallbackTheme} preview theme.` }],
  };
}

function themeForGoal(goal: string): AiPreviewThemeId | "unsupported" | null {
  const normalized = goal.toLowerCase();
  if (hasUnsupportedThemeToken(normalized)) return "unsupported";
  if (hasSupportedThemeToken(normalized, ["dungeon", "cave", "crypt"], ["던전", "동굴", "지하", "폐허"])) return "dungeon";
  if (hasSupportedThemeToken(normalized, ["interior", "house", "room", "inn", "shop"], ["실내", "집", "방", "여관", "상점"])) return "interior-house";
  if (hasSupportedThemeToken(normalized, ["town", "village", "port"], ["마을", "항구", "도시", "촌락"])) return "combined-town";
  return null;
}

function includesAny(value: string, needles: readonly string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}

function hasUnsupportedThemeToken(value: string): boolean {
  if (includesAny(value, ["월드", "세계", "선박"])) return true;
  if (/(^|[\s,.;:!?])배($|[\s,.;:!?]|를|가|와|로|의|에|는|도|만)/u.test(value)) return true;
  return /\b(world|overworld|ship|boat|vehicle)s?\b/u.test(value);
}

function hasSupportedThemeToken(value: string, englishWords: readonly string[], koreanTerms: readonly string[]): boolean {
  return hasAnyEnglishWord(value, englishWords) || includesAny(value, koreanTerms);
}

function hasAnyEnglishWord(value: string, words: readonly string[]): boolean {
  return words.some((word) => new RegExp(`\\b${word}s?\\b`, "u").test(value));
}
