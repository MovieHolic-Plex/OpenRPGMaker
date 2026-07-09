import type { DatabaseElementRecord } from "@/project/types";

const DEFAULT_MULTIPLIERS = { A: 200, B: 150, C: 100, D: 50, E: 0 } as const;
const MIN_ELEMENTS = 1;
const MAX_ELEMENTS = 99;

/** Resize the elements list by truncating or appending blank records with unique ids. */
export function resizeElementRecords(
  elements: readonly DatabaseElementRecord[],
  count: number,
): DatabaseElementRecord[] {
  const nextCount = clampCount(count);
  if (elements.length === nextCount) return elements.map(cloneElement);
  if (elements.length > nextCount) return elements.slice(0, nextCount).map(cloneElement);

  const used = new Set(elements.map((entry) => entry.id));
  const next = elements.map(cloneElement);
  while (next.length < nextCount) {
    const ordinal = next.length + 1;
    const id = nextUniqueElementId(used, ordinal);
    used.add(id);
    next.push({
      id,
      name: `속성 ${ordinal}`,
      kind: "physical",
      rateLabels: ["A", "B", "C", "D", "E"],
      damageMultipliers: { ...DEFAULT_MULTIPLIERS },
    });
  }
  return next;
}

export function clampElementListCount(count: number): number {
  return clampCount(count);
}

function clampCount(count: number): number {
  if (!Number.isFinite(count)) return MIN_ELEMENTS;
  return Math.max(MIN_ELEMENTS, Math.min(MAX_ELEMENTS, Math.trunc(count)));
}

function nextUniqueElementId(used: ReadonlySet<string>, ordinal: number): string {
  let candidate = `element_${String(ordinal).padStart(4, "0")}`;
  let suffix = 0;
  while (used.has(candidate)) {
    suffix += 1;
    candidate = `element_${String(ordinal).padStart(4, "0")}_${suffix}`;
  }
  return candidate;
}

function cloneElement(record: DatabaseElementRecord): DatabaseElementRecord {
  return {
    ...record,
    rateLabels: [...record.rateLabels],
    damageMultipliers: { ...record.damageMultipliers },
  };
}
