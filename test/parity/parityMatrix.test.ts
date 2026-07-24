// test/parity/parityMatrix.test.ts
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DATABASE_COLLECTIONS, PARITY_MATRIX, REQUIRED_CONTENT_TYPES } from "./parityMatrix";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

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
    const counts = { covered: 0, planned: 0, gap: 0 };
    for (const row of PARITY_MATRIX) {
      if (row.status === "covered") counts.covered += 1;
      else if (row.status === "gap") counts.gap += 1;
      else counts.planned += 1;
    }
    console.info(`[parity-matrix] rows=${PARITY_MATRIX.length} covered=${counts.covered} planned=${counts.planned} gap=${counts.gap}`);
    expect(PARITY_MATRIX.length).toBeGreaterThan(0);
  });
});
