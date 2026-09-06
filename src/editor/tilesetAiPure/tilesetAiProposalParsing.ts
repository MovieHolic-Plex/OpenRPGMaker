import type { TilesetAiPatternGrammar } from "@/editor/tilesetAiPure/tilesetAiMappingRules";

export type AiMappingResult = {
  readonly confidence?: string;
  readonly groups?: readonly {
    readonly defaultLayer?: string;
    readonly description?: string;
    readonly name?: string;
    readonly patternGrammar?: TilesetAiPatternGrammar;
    readonly placementRules?: string;
    readonly previewMap?: AiPreviewMap;
    readonly role?: string;
    readonly tileIds?: readonly number[];
  }[];
  readonly minimumQuestions?: readonly string[];
  readonly patternBlocks?: readonly {
    readonly confidence?: string;
    readonly label?: string;
    readonly patternGrammar?: TilesetAiPatternGrammar;
    readonly sourceRect?: { readonly height?: number; readonly width?: number; readonly x?: number; readonly y?: number };
    readonly tileIds?: readonly number[];
  }[];
  readonly previewMaps?: readonly AiPreviewMap[];
  readonly summary?: string;
  readonly tiles?: readonly {
    readonly defaultLayer?: string;
    readonly description?: string;
    readonly label?: string;
    readonly placementRules?: string;
    readonly repeatability?: string;
    readonly role?: string;
    readonly tile?: number;
    readonly userLocked?: boolean;
  }[];
  readonly userQuestionAnswers?: readonly {
    readonly answer: string;
    readonly question: string;
  }[];
};

export type AiPreviewMap = {
  readonly height?: number;
  readonly lowerTiles?: readonly number[];
  readonly name?: string;
  readonly upperTiles?: readonly number[];
  readonly width?: number;
};

export function parseAiMappingResult(answer: string): AiMappingResult | null {
  try {
    const parsed: unknown = JSON.parse(answer);
    return isAiMappingResult(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function isAiFailureText(text: string): boolean {
  return text.startsWith("AI 호출 실패") || text.startsWith("AI 응답 시간") || text.startsWith("AI 설정");
}

export function readLockedEdits(answer: string): unknown {
  if (!answer) return null;
  const result = parseAiMappingResult(answer);
  if (!result) return null;
  return {
    tiles: result.tiles?.filter((tile) => tile.userLocked),
    userQuestionAnswers: result.userQuestionAnswers ?? [],
  };
}

export function mergeLockedEdits(answer: string, lockedAnswer: string): string {
  const result = parseAiMappingResult(answer);
  const lockedResult = parseAiMappingResult(lockedAnswer);
  if (!result || !lockedResult) return answer;
  const lockedTiles = new Map((lockedResult.tiles ?? []).filter((tile) => tile.userLocked).map((tile) => [tile.tile, tile]));
  if (lockedTiles.size === 0 && !lockedResult.userQuestionAnswers?.length) return answer;
  const tiles = result.tiles?.map((tile) => {
    const lockedTile = lockedTiles.get(tile.tile);
    return lockedTile ? { ...tile, ...lockedTile, userLocked: true } : tile;
  });
  return JSON.stringify({
    ...result,
    tiles,
    userQuestionAnswers: lockedResult.userQuestionAnswers ?? result.userQuestionAnswers,
  });
}

// Runtime boundary: callers must not trust a JSON object merely because it parsed.
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function optional(r: Record<string, unknown>, key: string, check: (value: unknown) => boolean): boolean {
  return r[key] === undefined || check(r[key]);
}
const string = (v: unknown) => typeof v === "string";
const number = (v: unknown) => typeof v === "number" && Number.isSafeInteger(v);
const boolean = (v: unknown) => typeof v === "boolean";
const array = (check: (v: unknown) => boolean) => (v: unknown) => Array.isArray(v) && v.every(check);
function fields(r: Record<string, unknown>, keys: string[], check: (v: unknown) => boolean): boolean {
  return keys.every(k => optional(r, k, check));
}
function grammar(v: unknown): boolean {
  if (!record(v)) return false;
  return ["animated_terrain", "autotile_3x3", "event_required_object", "horizontal_expandable", "nine_slice_expandable", "overlay_detail", "single", "source_rect", "vertical_expandable"].includes(String(v.kind))
    && typeof v.kind === "string" && boolean(v.preserveCaps)
    && ["body", "center", "source_order"].includes(String(v.repeat))
    && optional(v, "axis", a => a === "both" || a === "horizontal" || a === "vertical")
    && fields(v, ["minHeight", "minWidth"], number)
    && array(p => record(p) && ["bottom", "bottomCap", "bottomLeft", "bottomRight", "center", "left", "leftCap", "repeatBody", "right", "rightCap", "top", "topCap", "topLeft", "topRight"].includes(String(p.role)) && array(number)(p.tileIds))(v.parts);
}
function preview(v: unknown): boolean {
  if (!record(v)) return false;
  if (!fields(v, ["width", "height"], number) || !optional(v, "name", string) || !fields(v, ["lowerTiles", "upperTiles"], array(number))) return false;
  if (typeof v.width === "number" && typeof v.height === "number") {
    if (v.width <= 0 || v.height <= 0) return false;
    for (const key of ["lowerTiles", "upperTiles"]) if (Array.isArray(v[key]) && v[key].length !== v.width * v.height) return false;
  }
  return true;
}
function isAiMappingResult(v: unknown): v is AiMappingResult {
  return record(v) && fields(v, ["summary", "confidence"], string)
    && optional(v, "minimumQuestions", array(string))
    && optional(v, "tiles", array(t => record(t) && fields(t, ["defaultLayer", "description", "label", "placementRules", "repeatability", "role"], string) && optional(t, "tile", number) && optional(t, "userLocked", boolean)))
    && optional(v, "groups", array(g => record(g) && fields(g, ["defaultLayer", "description", "name", "placementRules", "role"], string) && optional(g, "tileIds", array(number)) && optional(g, "patternGrammar", grammar) && optional(g, "previewMap", preview)))
    && optional(v, "patternBlocks", array(b => record(b) && fields(b, ["confidence", "label"], string) && optional(b, "tileIds", array(number)) && optional(b, "patternGrammar", grammar) && optional(b, "sourceRect", r => record(r) && fields(r, ["height", "width", "x", "y"], number))))
    && optional(v, "previewMaps", array(preview))
    && optional(v, "userQuestionAnswers", array(a => record(a) && string(a.answer) && string(a.question)));
}
