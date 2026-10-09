type AiTileMetadataEntry = {
  readonly label?: string;
  readonly repeatability?: string;
  readonly role?: string;
  readonly tile?: number;
  readonly userLocked?: boolean;
};

type AiPatternBlockEntry = {
  readonly sourceRect?: {
    readonly height?: number;
    readonly width?: number;
  };
  readonly tileIds?: readonly number[];
};

type AiNineSliceBlock = AiPatternBlockEntry & {
  readonly tileIds: readonly number[];
};

type AiMetadataResult = {
  readonly patternBlocks?: readonly AiPatternBlockEntry[];
  readonly tiles?: readonly AiTileMetadataEntry[];
};

type MutableAiTileMetadataEntry = {
  label?: string;
  repeatability?: string;
  role?: string;
  readonly tile?: number;
  readonly userLocked?: boolean;
};

const NINE_SLICE_METADATA = [
  { label: "좌상단", repeatability: "fixed", role: "edge" },
  { label: "상단", repeatability: "repeat", role: "edge" },
  { label: "우상단", repeatability: "fixed", role: "edge" },
  { label: "좌측", repeatability: "repeat", role: "edge" },
  { label: "중앙", repeatability: "repeat", role: "body" },
  { label: "우측", repeatability: "repeat", role: "edge" },
  { label: "좌하단", repeatability: "fixed", role: "edge" },
  { label: "하단", repeatability: "repeat", role: "edge" },
  { label: "우하단", repeatability: "fixed", role: "edge" },
] as const;

const POSITION_SUFFIX_PATTERN =
  /\s*(좌상단|우상단|좌하단|우하단|상단|하단|좌측|우측|중앙|왼쪽|오른쪽|윗변|아랫변|왼변|오른변|모서리|변)$/;

export function normalizeAiTileMetadata(answer: string): string {
  const parsed = parseAiMetadataResult(answer);
  if (!parsed) return answer;
  return normalizeAiMetadataResult(parsed, answer);
}

function parseAiMetadataResult(answer: string): AiMetadataResult | null {
  try {
    const parsed: unknown = JSON.parse(answer);
    return isAiMetadataResult(parsed) ? parsed : null;
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
}

function normalizeAiMetadataResult(parsed: AiMetadataResult, originalAnswer: string): string {
  const block = findNineSliceBlock(parsed.patternBlocks);
  if (!block) return originalAnswer;
  const tiles: MutableAiTileMetadataEntry[] | undefined = parsed.tiles?.map((tile) => ({ ...tile }));
  if (!tiles) return originalAnswer;
  const byTile = new Map(tiles.map((tile) => [tile.tile, tile]));
  const blockTiles = block.tileIds.map((tileId) => byTile.get(tileId)).filter(isPresentTile);
  if (blockTiles.length !== NINE_SLICE_METADATA.length) return originalAnswer;
  const repeatedLabels = repeatedUnlockedLabels(blockTiles);
  blockTiles.forEach((tile, index) => {
    if (tile.userLocked) return;
    const metadata = NINE_SLICE_METADATA[index] ?? NINE_SLICE_METADATA[4];
    tile.role = metadata.role;
    tile.repeatability = metadata.repeatability;
    if (!tile.label || !repeatedLabels.has(tile.label)) return;
    tile.label = positionLabel(tile.label, metadata.label);
  });
  return JSON.stringify({ ...parsed, tiles });
}

function findNineSliceBlock(blocks: readonly AiPatternBlockEntry[] | undefined): AiNineSliceBlock | null {
  return blocks?.find(isNineSliceBlock) ?? null;
}

function isNineSliceBlock(block: AiPatternBlockEntry): block is AiNineSliceBlock {
  return block.sourceRect?.width === 3 && block.sourceRect.height === 3 && block.tileIds?.length === NINE_SLICE_METADATA.length;
}

function isPresentTile(tile: MutableAiTileMetadataEntry | undefined): tile is MutableAiTileMetadataEntry & { readonly tile: number } {
  return typeof tile?.tile === "number";
}

function isAiMetadataResult(value: unknown): value is AiMetadataResult {
  return Boolean(value && typeof value === "object");
}

function repeatedUnlockedLabels(tiles: readonly MutableAiTileMetadataEntry[]): ReadonlySet<string> {
  const counts = new Map<string, number>();
  tiles.forEach((tile) => {
    if (tile.userLocked || !tile.label) return;
    counts.set(tile.label, (counts.get(tile.label) ?? 0) + 1);
  });
  return new Set([...counts].filter(([, count]) => count > 1).map(([label]) => label));
}

function positionLabel(label: string, position: string): string {
  const base = label.replace(POSITION_SUFFIX_PATTERN, "").trim();
  return `${base || label} ${position}`;
}
