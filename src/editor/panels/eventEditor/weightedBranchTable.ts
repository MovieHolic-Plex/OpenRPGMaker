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
  const rows: WeightedBranchRow[] = [];
  for (const rawLine of table.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const label = line.slice(0, eq).trim();
    const weight = Number(line.slice(eq + 1).trim());
    if (!label || !Number.isFinite(weight) || weight <= 0) continue;
    rows.push({ label, weight });
  }
  return rows;
}

/**
 * Serialize editor rows for storage/runtime.
 * Positive weights only; empty → 결과1=1 fallback.
 */
export function serializeWeightedBranchTable(rows: readonly WeightedBranchRow[]): string {
  const positive = rows
    .map((row, index) => ({
      label: row.label.trim() || `결과${index + 1}`,
      weight: row.weight,
    }))
    .filter((row) => Number.isFinite(row.weight) && row.weight > 0);
  if (positive.length === 0) return "결과1=1";
  return positive
    .map((row) => `${row.label}=${formatWeight(row.weight)}`)
    .join("\n");
}

/** Ensure the form always has ≥1 editable row. */
export function rowsForWeightedBranchEditor(table: string): WeightedBranchRow[] {
  const parsed = parseWeightedBranchTable(table);
  if (parsed.length > 0) return parsed.map((row) => ({ ...row }));
  // Preserve legacy default text if present but failed parse (shouldn't) — seed Korean defaults.
  if (!table.trim()) return DEFAULT_SEED_ROWS.map((row) => ({ ...row }));
  return [{ label: "결과1", weight: 1 }];
}

/** Integer percents for positive-weight rows only; last residual to sum 100. */
export function weightedBranchPercents(rows: readonly WeightedBranchRow[]): readonly number[] {
  const positive = rows.filter((row) => Number.isFinite(row.weight) && row.weight > 0);
  if (positive.length === 0) return [];
  const total = positive.reduce((sum, row) => sum + row.weight, 0);
  if (!(total > 0)) return positive.map(() => 0);
  const raw = positive.map((row) => (row.weight / total) * 100);
  const floored = raw.map((value) => Math.floor(value));
  let remainder = 100 - floored.reduce((sum, value) => sum + value, 0);
  // Distribute leftover to highest fractional parts first for stability, then last residual.
  const order = raw
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac || a.index - b.index);
  const out = [...floored];
  for (const item of order) {
    if (remainder <= 0) break;
    out[item.index] = (out[item.index] ?? 0) + 1;
    remainder -= 1;
  }
  if (remainder !== 0 && out.length > 0) {
    const last = out.length - 1;
    out[last] = Math.max(0, (out[last] ?? 0) + remainder);
  }
  return out;
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
      return pct === undefined ? label : `${label} ${pct}%`;
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

function formatWeight(weight: number): string {
  if (Number.isInteger(weight)) return String(weight);
  // Trim trailing zeros from finite floats without scientific notation surprises.
  return String(Number(weight.toPrecision(12)));
}
