import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { ledgerPath } from "./paths";

export type LedgerEntry = { at: string; step: string } & Record<string, unknown>;
export type Ledger = { version: 1; $comment?: string; entries: LedgerEntry[] };

export function readLedger(path = ledgerPath()): Ledger {
  if (!existsSync(path)) return { version: 1, entries: [] };
  const parsed = JSON.parse(readFileSync(path, "utf8")) as Ledger;
  if (parsed.version !== 1 || !Array.isArray(parsed.entries)) throw new Error(`ledger 모양이 틀렸다: ${path}`);
  return parsed;
}

/** 기록 한 줄을 덧붙인다. 하네스만 쓴다(손으로 고치지 않는다). */
export function appendLedger(step: string, fields: Record<string, unknown>, path = ledgerPath()): LedgerEntry {
  const ledger = readLedger(path);
  const entry: LedgerEntry = { at: new Date().toISOString(), step, ...fields };
  ledger.entries.push(entry);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(ledger, null, 1) + "\n");
  return entry;
}
