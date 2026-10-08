/**
 * npm run harness -- murim-chipset <단계> [옵션]
 *
 *   validate  ·  palette  ·  list [--wave style]
 *   draw <판>  ·  gate <판>  ·  sheet <판> [--force]
 *   pick <판> <항목> <후보> [--note "…"]      ← 사람이 고른 것을 받아 적을 때만. (항목, 줄)마다 하나
 *   reject <판> <항목> <후보> --why "…"
 *   후보: 화풍 판(style-r1)은 글자 = 줄(A·B), 이후 판은 <줄><번호>(A1 A2 B1 B2)
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
