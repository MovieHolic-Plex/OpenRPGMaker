/**
 * npm run harness -- battle-trainer-sprites <단계> [옵션]
 *
 *   list  ·  draw [역할|all] [--n 5] [--par 5] [--plate p1] [--no-throw] [--background]
 *   status [판]  ·  sheet <판>  ·  pick <판> 역할=글자 …  ·  bake <판> [역할 …]
 *
 * 실제 일은 같은 폴더의 harness.py 가 한다. 이 파일은 입구만 맡는다.
 */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

export async function run(argv: string[]): Promise<number> {
  const script = resolve(import.meta.dirname, "../harness.py");
  const result = spawnSync("python3", [script, ...argv], { stdio: "inherit" });
  return result.status ?? 1;
}
