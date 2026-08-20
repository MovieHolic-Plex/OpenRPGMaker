// test/parity/parityMatrix.test.ts
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DATABASE_COLLECTIONS, PARITY_MATRIX, REQUIRED_CONTENT_TYPES } from "./parityMatrix";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// Ratchet snapshot measured 2026-08-20. Only movement toward more coverage is
// allowed: gap may only shrink, covered may only grow. planned tiers
// (T4/T5/T6/T7) are compared as one pooled total so moving rows between tiers
// stays free.
const RATCHET = {
  maxGap: 16,
  minCovered: 0,
  minPlanned: 51,
} as const;

const RATCHET_GUIDE =
  "새 행은 gap이 아니라 planned-T4~T7 상태로 추가하세요. 기존 행을 covered에서 강등하거나 " +
  "planned를 gap으로 되돌리는 변경은 금지입니다. 래칫을 의도적으로 갱신해야 한다면 RATCHET 상수를 " +
  "고치고 그 사유를 커밋 메시지에 남기세요 (줄이는 방향만 허용).";

function countStatuses() {
  const counts = { covered: 0, planned: 0, gap: 0 };
  for (const row of PARITY_MATRIX) {
    if (row.status === "covered") counts.covered += 1;
    else if (row.status === "gap") counts.gap += 1;
    else counts.planned += 1;
  }
  return counts;
}

function dirContainsSymbol(dir: string, symbol: string): boolean {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      if (dirContainsSymbol(full, symbol)) return true;
    } else if (entry.name.endsWith(".ts") && readFileSync(full, "utf8").includes(symbol)) {
      return true;
    }
  }
  return false;
}

function consumerResolves(consumer: string): boolean {
  const hash = consumer.indexOf("#");
  const path = hash >= 0 ? consumer.slice(0, hash) : consumer;
  const symbol = hash >= 0 ? consumer.slice(hash + 1) : "";
  const abs = resolve(ROOT, path);
  if (!existsSync(abs)) return false;
  if (statSync(abs).isDirectory()) return symbol ? dirContainsSymbol(abs, symbol) : true;
  return symbol ? readFileSync(abs, "utf8").includes(symbol) : true;
}

describe("parity contract matrix", () => {
  it("names only player consumers that resolve in the source (anti-rot)", () => {
    const dead = PARITY_MATRIX.filter((row) => !consumerResolves(row.playerConsumer));
    expect(dead.map((row) => `${row.contentType}.${row.field} -> ${row.playerConsumer}`)).toEqual([]);
  });

  it("covers every required content type (11 DB collections + maps + events + system)", () => {
    const types = new Set(PARITY_MATRIX.map((row) => row.contentType));
    for (const contentType of REQUIRED_CONTENT_TYPES) expect(types.has(contentType)).toBe(true);
    for (const collection of DATABASE_COLLECTIONS) expect(types.has(collection)).toBe(true);
  });

  it("rejects dead consumers (stale_state probe)", () => {
    expect(consumerResolves("src/battle/runtime.ts#doesNotExist")).toBe(false);
    expect(consumerResolves("src/does/not/exist.ts#x")).toBe(false);
    expect(consumerResolves("src/battle/runtime.ts#applyItem")).toBe(true);
  });

  it("reports a coverage summary", () => {
    const counts = countStatuses();
    console.info(`[parity-matrix] rows=${PARITY_MATRIX.length} covered=${counts.covered} planned=${counts.planned} gap=${counts.gap}`);
    expect(PARITY_MATRIX.length).toBeGreaterThan(0);
  });

  it("ratchets coverage: gap never grows, covered never shrinks, planned never demotes to gap", () => {
    const counts = countStatuses();

    expect(counts.gap, `gap ${counts.gap} > maxGap ${RATCHET.maxGap}. ${RATCHET_GUIDE}`).toBeLessThanOrEqual(RATCHET.maxGap);
    expect(counts.covered, `covered ${counts.covered} < minCovered ${RATCHET.minCovered}. ${RATCHET_GUIDE}`).toBeGreaterThanOrEqual(RATCHET.minCovered);
    // Catches planned-* -> gap demotions: planned rows may only move forward to
    // covered, so the non-gap pool (planned + covered) may never shrink below
    // its snapshot. planned tiers (T4/T5/T6/T7) are pooled, so moving a row
    // between tiers stays free.
    expect(
      counts.planned + counts.covered,
      `planned+covered ${counts.planned + counts.covered} < ${RATCHET.minPlanned + RATCHET.minCovered} (planned ${counts.planned}, covered ${counts.covered}). planned 행은 covered로만 이동할 수 있고 gap으로 강등할 수 없습니다 (planned-T4~T7 티어 간 이동은 자유). ${RATCHET_GUIDE}`,
    ).toBeGreaterThanOrEqual(RATCHET.minPlanned + RATCHET.minCovered);
  });
});
