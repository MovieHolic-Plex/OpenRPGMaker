import type { TilesetAiPatternGrammar } from "@/editor/panels/tilesetAiMappingRules";

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
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as AiMappingResult;
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
