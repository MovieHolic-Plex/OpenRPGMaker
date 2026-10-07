/**
 * npm run harness -- tileset-authoring <단계> --theme <테마> [옵션]
 * 단계 구현은 손 도트 도구(Pillow)와 같은 파이썬이다 — harness.py 가 실제 일을 하고 여기서는 넘기기만 한다.
 */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

export async function run(argv: string[]): Promise<number> {
  const script = resolve(import.meta.dirname, "../harness.py");
  const result = spawnSync("python3", [script, ...argv], { stdio: "inherit" });
  return result.status ?? 1;
}
