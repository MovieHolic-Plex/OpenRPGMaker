/**
 * npm run harness -- interactive-props <단계> [옵션]
 *
 *   validate
 *   list [--wave W] [--era E]
 *   gate [--wave W] [--id ID]
 *   sheet [--wave W] [--out DIR]
 *   pick <id> <strip.png> [--by NAME] [--note TEXT]
 *   build
 *   status
 */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

export async function run(argv: string[]): Promise<number> {
  const script = resolve(import.meta.dirname, "../harness.py");
  const result = spawnSync("python3", [script, ...argv], { stdio: "inherit" });
  return result.status ?? 1;
}
