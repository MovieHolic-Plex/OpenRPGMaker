import { assert, requireArray, requireNumber, requireRecord, requireString } from "./guards";

export function validateTileGroupKnowledgeFields(
  label: string,
  record: Record<string, unknown>,
  tileCount: number
): void {
  validateCellLayers(label, record);
  validateSourceBlocks(label, record, tileCount);
  validateRepeatableBlock(label, record, tileCount);
}

function validateCellLayers(label: string, record: Record<string, unknown>): void {
  if (record.cellLayers === undefined) return;
  const layers = requireArray(`${label}.cellLayers`, record.cellLayers);
  const tileIds = requireArray(`${label}.tileIds`, record.tileIds);
  assert(layers.length === tileIds.length, `${label}.cellLayers length mismatch`);
  for (const layerValue of layers) {
    const layer = requireString(`${label}.cellLayers[]`, layerValue);
    assert(layer === "lower" || layer === "upper", `${label}.cellLayers[] invalid`);
  }
}

function validateSourceBlocks(label: string, record: Record<string, unknown>, tileCount: number): void {
  if (record.sourceBlocks === undefined) return;
  const positions = new Set<string>();
  for (const [index, blockValue] of requireArray(`${label}.sourceBlocks`, record.sourceBlocks).entries()) {
    const blockLabel = `${label}.sourceBlocks[${index}]`;
    const block = requireRecord(blockLabel, blockValue);
    const column = positiveInteger(`${blockLabel}.column`, block.column, true);
    const row = positiveInteger(`${blockLabel}.row`, block.row, true);
    const position = `${row}:${column}`;
    assert(!positions.has(position), `${label}.sourceBlocks duplicate position ${position}`);
    positions.add(position);
    const rect = requireRecord(`${blockLabel}.sourceRect`, block.sourceRect);
    const width = positiveInteger(`${blockLabel}.sourceRect.width`, rect.width, false);
    const height = positiveInteger(`${blockLabel}.sourceRect.height`, rect.height, false);
    positiveInteger(`${blockLabel}.sourceRect.x`, rect.x, true);
    positiveInteger(`${blockLabel}.sourceRect.y`, rect.y, true);
    const tileIds = requireArray(`${blockLabel}.tileIds`, block.tileIds);
    assert(tileIds.length === width * height, `${blockLabel}.tileIds length mismatch`);
    validateTileIds(`${blockLabel}.tileIds`, tileIds, tileCount);
  }
}

function validateRepeatableBlock(label: string, record: Record<string, unknown>, tileCount: number): void {
  if (record.patternGrammar === undefined) return;
  const grammar = requireRecord(`${label}.patternGrammar`, record.patternGrammar);
  if (grammar.kind !== "repeatable_block") return;
  const width = positiveInteger(`${label}.patternGrammar.blockWidth`, grammar.blockWidth, false);
  const height = positiveInteger(`${label}.patternGrammar.blockHeight`, grammar.blockHeight, false);
  const parts = requireArray(`${label}.patternGrammar.parts`, grammar.parts);
  const body = parts
    .map((part, index) => requireRecord(`${label}.patternGrammar.parts[${index}]`, part))
    .find((part) => part.role === "repeatBody");
  assert(body !== undefined, `${label}.patternGrammar repeatBody missing`);
  const tileIds = requireArray(`${label}.patternGrammar.repeatBody.tileIds`, body.tileIds);
  assert(tileIds.length === width * height, `${label}.patternGrammar repeatBody length mismatch`);
  validateTileIds(`${label}.patternGrammar.repeatBody.tileIds`, tileIds, tileCount);
}

function validateTileIds(label: string, values: readonly unknown[], tileCount: number): void {
  for (const value of values) {
    const tile = requireNumber(`${label}[]`, value);
    assert(Number.isInteger(tile) && tile >= 0 && tile < tileCount, `${label} tileId out of range`);
  }
}

function positiveInteger(label: string, value: unknown, allowZero: boolean): number {
  const number = requireNumber(label, value);
  assert(Number.isInteger(number) && (allowZero ? number >= 0 : number > 0), `${label} invalid`);
  return number;
}
