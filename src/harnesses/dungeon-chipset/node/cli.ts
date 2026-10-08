/**
 * npm run harness -- dungeon-chipset <단계> [옵션]
 *
 *   palette [--check]  ·  validate  ·  list [--wave W]
 *   draw <판>  ·  gate <판>  ·  sheet <판> [--force]
 *   pick <판> <항목> <후보> --sha <앞 8자리> [--note …]  ·  reject <판> <항목> <후보> --why …   (후보 = 줄 글자 A 또는 <줄><번호> A1)
 *   status
 *
 * 실제 일은 같은 폴더의 harness.py(손 도트 판 모듈·관문·시트)가 한다. 이 파일은 입구만 맡는다.
 */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

export async function run(argv: string[]): Promise<number> {
  const script = resolve(import.meta.dirname, "../harness.py");
  const result = spawnSync("python3", [script, ...argv], { stdio: "inherit" });
  return result.status ?? 1;
}
