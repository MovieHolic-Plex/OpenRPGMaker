/**
 * npm run harness -- murim-chipset <단계> [옵션]
 *
 *   validate  ·  palette  ·  list [--wave style]
 *   draw <판>  ·  gate <판>  ·  sheet <판> [--force]
 *   pick <판> <항목> <글자> [--note "…"]      ← 사람이 고른 것을 받아 적을 때만
 *   reject <판> <항목> <글자> --why "…"
 *   status
 *
 * 실제 일은 같은 폴더의 harness.py(행 문자열 격자 손 도트·관문·시트)가 한다. 이 파일은 입구만 맡는다.
 */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

export async function run(argv: string[]): Promise<number> {
  const script = resolve(import.meta.dirname, "../harness.py");
  const result = spawnSync("python3", [script, ...argv], { stdio: "inherit" });
  return result.status ?? 1;
}
