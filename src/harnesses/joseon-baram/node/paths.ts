import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { JOSEON_BARAM_HARNESS } from "../harness";
import { validateSeed, type JoseonSeed } from "../seed";

/** src/harnesses/<id>/node → 저장소 루트 */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

export const SEED_PATH = resolve(REPO_ROOT, JOSEON_BARAM_HARNESS.seed);

/** JOSEON_BARAM_LEDGER 로 기록 파일을 돌릴 수 있다(시험이 커밋된 ledger.json 을 건드리지 않게). */
export function ledgerPath(): string {
  return process.env.JOSEON_BARAM_LEDGER ? resolve(process.env.JOSEON_BARAM_LEDGER) : resolve(REPO_ROOT, "harness-data", JOSEON_BARAM_HARNESS.id, "ledger.json");
}

/** 실행 산출물 폴더(gitignore). JOSEON_BARAM_RUNS 로 돌릴 수 있다. */
export function runsBase(): string {
  return process.env.JOSEON_BARAM_RUNS ? resolve(process.env.JOSEON_BARAM_RUNS) : resolve(REPO_ROOT, "qa-runs/harnesses", JOSEON_BARAM_HARNESS.id);
}

export function loadSeed(): JoseonSeed {
  return validateSeed(JSON.parse(readFileSync(SEED_PATH, "utf8")));
}

export function repoPath(rel: string): string {
  return resolve(REPO_ROOT, rel);
}
