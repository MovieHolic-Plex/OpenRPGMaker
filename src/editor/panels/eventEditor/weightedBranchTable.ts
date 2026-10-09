export type WeightedBranchRow = {
  readonly label: string;
  readonly weight: number;
};

const DEFAULT_SEED_ROWS: readonly WeightedBranchRow[] = [
  { label: "성공", weight: 1 },
  { label: "실패", weight: 1 },
] as const;

/** Parse `label=weight` lines. Invalid / non-positive weights are dropped. */
export function parseWeightedBranchTable(table: string): WeightedBranchRow[] {
  return readWeightedBranchRows(table).filter(row => row.weight > 0);
}

function readWeightedBranchRows(table: string): WeightedBranchRow[] {
  const rows: WeightedBranchRow[] = [];
  for (const rawLine of table.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    // Match selectWeightedIndex: runtime reads only the first numeric field.
    const [name, value] = line.split("=");
    const label = name?.trim() || `결과${rows.length + 1}`;
    if (value === undefined) continue;
    const weight = Number(value);
    if (!Number.isFinite(weight) || weight < 0) continue;
    rows.push({ label, weight });
  }
  return rows;
}

/**
 * Serialize editor rows for storage/runtime.
 * Preserve named zero-weight rows for editing; runtime ignores them.
 */
export function serializeWeightedBranchTable(rows: readonly WeightedBranchRow[]): string {
  const stored = rows
    .map((row, index) => ({
      label: row.label.replace(/=/g, "＝").replace(/[\r\n]+/g, " ").trim() || `결과${index + 1}`,
      weight: row.weight,
    }))
    .filter((row) => Number.isFinite(row.weight) && row.weight >= 0);
  return stored
    .map((row) => `${row.label}=${String(row.weight)}`)
    .join("\n");
}

/** Ensure the form always has ≥1 editable row. */
export function rowsForWeightedBranchEditor(table: string): WeightedBranchRow[] {
  const parsed = readWeightedBranchRows(table);
  if (parsed.length > 0) return parsed.map((row) => ({ ...row }));
  // Preserve legacy default text if present but failed parse (shouldn't) — seed Korean defaults.
  if (!table.trim()) return DEFAULT_SEED_ROWS.map((row) => ({ ...row }));
  return [{ label: "결과1", weight: 1 }];
}

/** Unrounded percentages for positive rows; presentation must not erase rare outcomes. */
export function weightedBranchPercents(rows: readonly WeightedBranchRow[]): readonly number[] {
  const positive = rows.filter((row) => Number.isFinite(row.weight) && row.weight > 0);
  if (positive.length === 0) return [];
  const maximum = positive.reduce((max, row) => Math.max(max, row.weight), 0);
  const total = positive.reduce((sum, row) => sum + row.weight / maximum, 0);
  return positive.map((row) => (row.weight / maximum / total) * 100);
}

export function formatWeightedBranchPercent(value: number): string {
  if (value > 0 && value < 0.01) return String(Number(value.toPrecision(3)));
  // Retain the small complement instead of displaying false certainty.
  const remainder = 100 - value;
  if (remainder > Number.EPSILON * 100 && remainder < 0.01) {
    const decimals = Math.min(14, Math.max(2, 2 - Math.floor(Math.log10(remainder))));
    return String(Number(value.toFixed(decimals)));
  }
  return String(Number(value.toFixed(2)));
}

export function weightedBranchSummaryBits(
  table: string,
  resultVariableId: string,
  variableDisplayName?: string,
): { readonly outcomes: string; readonly variable: string } {
  const rows = parseWeightedBranchTable(table);
  const percents = weightedBranchPercents(rows);
  const labels = rows.map((row, index) => row.label.trim() || `결과${index + 1}`);
  let outcomes: string;
  if (labels.length === 0) {
    outcomes = "결과 없음";
  } else {
    const shown = labels.slice(0, 3).map((label, index) => {
      const pct = percents[index];
      return pct === undefined ? label : `${label} ${formatWeightedBranchPercent(pct)}%`;
    });
    if (labels.length > 3) shown.push(`외 ${labels.length - 3}`);
    outcomes = shown.join(" · ");
  }
  const id = resultVariableId.trim();
  const variable = id
    ? `변수 ${variableDisplayName?.trim() || id}`
    : "변수 (미선택)";
  return { outcomes, variable };
}

export function formatWeightedBranchSummary(
  table: string,
  resultVariableId: string,
  variableDisplayName?: string,
): string {
  const bits = weightedBranchSummaryBits(table, resultVariableId, variableDisplayName);
  return `${bits.outcomes} → ${bits.variable}`;
}
