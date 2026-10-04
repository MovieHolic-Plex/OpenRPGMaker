/**
 * npm run harness -- jp-city <단계> [옵션]
 *
 *   palette                                  palette.pal · mats.txt 다시 쓰기
 *   validate  ·  list [--wave houses]        시드 점검 · 항목 목록
 *   draw <항목> [--n 5] [--note "…"]         후보 그리기(백그라운드, 판 id 출력)
 *   status [판]  ·  sheet <판>  ·  review <판>
 *   pick <판> <글자> [--note]  ·  reject <판> <글자> --why "…"
 *
 * 실제 일은 같은 폴더의 harness.py(pxgrid·Sonnet 작업자)가 한다. 이 파일은 입구만 맡는다.
 */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

export async function run(argv: string[]): Promise<number> {
  const script = resolve(import.meta.dirname, "../harness.py");
  const result = spawnSync("python3", [script, ...argv], { stdio: "inherit" });
  return result.status ?? 1;
}
