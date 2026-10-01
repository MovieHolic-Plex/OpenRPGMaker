import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MONSTER_COLLECT_SPECIES_HARNESS } from "../harness";

const ID = MONSTER_COLLECT_SPECIES_HARNESS.id;

/** src/harnesses/<id>/node → 저장소 루트 */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

export type HarnessPaths = {
  seed: string;
  data: string;
  ledger: string;
  grids: string;
  /** 번들 결과물 — 런타임이 /assets/harnesses/<id>/<종>/<front|back>.png 로 읽는다 */
  bundle: string;
  /** 실행 산출물 (gitignore) */
  runs: string;
};

/**
 * MONSTER_HARNESS_SANDBOX=<폴더> 를 주면 시드·기록·번들·산출물을 전부 그 폴더 아래로 돌린다.
 * 시험 실행이 커밋된 seed.json·ledger.json·번들을 건드리지 않게 하려는 것.
 */
export function harnessPaths(sandbox = process.env.MONSTER_HARNESS_SANDBOX): HarnessPaths {
  if (sandbox) {
    const root = resolve(sandbox);
    return {
      seed: resolve(root, "data/seed.json"),
      data: resolve(root, "data"),
      ledger: resolve(root, "data/ledger.json"),
      grids: resolve(root, "data/grids"),
      bundle: resolve(root, "bundle"),
      runs: resolve(root, "runs"),
    };
  }
  return {
    seed: resolve(REPO_ROOT, MONSTER_COLLECT_SPECIES_HARNESS.seed),
    data: resolve(REPO_ROOT, "harness-data", ID),
    ledger: resolve(REPO_ROOT, "harness-data", ID, "ledger.json"),
    grids: resolve(REPO_ROOT, "harness-data", ID, "grids"),
    bundle: resolve(REPO_ROOT, "public/assets/harnesses", ID),
    runs: resolve(REPO_ROOT, "qa-runs/harnesses", ID),
  };
}

export const PATHS: HarnessPaths = harnessPaths();

export function relativeToRepo(path: string): string {
  return path.startsWith(REPO_ROOT + "/") ? path.slice(REPO_ROOT.length + 1) : path;
}
