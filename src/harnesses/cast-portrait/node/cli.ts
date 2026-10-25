/**
 * npm run harness -- cast-portrait <단계> [옵션]
 *
 *   list · calibrate <project> · status <project>
 *   draw <project> <role> --round r1 [--n 4] [--variant nat]
 *   import <project> <role> <round> <candidate> <dir>   (already-made pictures; never resized)
 *   fix <project> <round> <candidate> <expr> x,y=#rrggbb … --why "…"
 *   check <project> <round> · lineup <project> <round> · dialogue <project> <role> <round>
 *   verdict <project> <round> <review.json> --reviewer argon · pick <project> <role> <round> <candidate> --by "<human>"
 *   install <project> <role> <round> <candidate>
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
