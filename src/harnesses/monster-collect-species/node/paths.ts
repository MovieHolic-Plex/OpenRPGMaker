import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MONSTER_COLLECT_SPECIES_HARNESS } from "../harness";

const ID = MONSTER_COLLECT_SPECIES_HARNESS.id;

/** src/harnesses/<id>/node → 저장소 루트 */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

export const PATHS = {
  seed: resolve(REPO_ROOT, MONSTER_COLLECT_SPECIES_HARNESS.seed),
  data: resolve(REPO_ROOT, "harness-data", ID),
  ledger: resolve(REPO_ROOT, "harness-data", ID, "ledger.json"),
  grids: resolve(REPO_ROOT, "harness-data", ID, "grids"),
  /** 번들 결과물 — 런타임이 /assets/harnesses/<id>/<종>/<front|back>.png 로 읽는다 */
  bundle: resolve(REPO_ROOT, "public/assets/harnesses", ID),
  /** 실행 산출물 (gitignore) */
  runs: resolve(REPO_ROOT, "qa-runs/harnesses", ID),
};

export function relativeToRepo(path: string): string {
  return path.startsWith(REPO_ROOT + "/") ? path.slice(REPO_ROOT.length + 1) : path;
}
