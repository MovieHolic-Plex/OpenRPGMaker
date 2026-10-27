/**
 * npm run harness -- building-kit <단계> [옵션]
 *
 *   palette <테마> [--check]  ·  validate [<테마>]  ·  list <테마>
 *   draw <테마> <판> [--agent] [--lines A,B,C] [--jobs N] [--cmd "…"]  ·  dry <테마> <판> <후보>
 *   gate <테마> <판>  ·  assemble <테마> <판> [--line A] [--key A1]
 *   review <테마> <판> [--runs 3] [--judge-cmd "…"]
 *   sheet <테마> <판> [--show-failed]  ·  pick <테마> <판> <항목> <후보> --sha <앞 8자리>
 *   reject <테마> <판> <항목> <후보> --why "…"  ·  objgate <테마>  ·  status [<테마>]
 *
 * 실제 일은 같은 폴더의 harness.py(팔레트·손 도트·관문·조립·검수·시트)가 한다. 이 파일은 입구만 맡는다.
 */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

export async function run(argv: string[]): Promise<number> {
  const script = resolve(import.meta.dirname, "../harness.py");
  const result = spawnSync("python3", [script, ...argv], { stdio: "inherit" });
  return result.status ?? 1;
}
