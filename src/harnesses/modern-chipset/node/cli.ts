/**
 * npm run harness -- modern-chipset <단계> [옵션]
 *
 *   palette                                      vehicles.pal 다시 쓰기
 *   draw car side [--n 5] [--note "…"]           후보 그리기(백그라운드, 판 id 출력)
 *   status [판]  ·  sheet <판>  ·  review <판>
 *   pick <판> <글자> [--note]  ·  reject <판> <글자> --why "…"
 *
 * 실제 일은 같은 폴더의 harness.py(pxgrid·Sonnet 작업자)가 한다. 이 파일은 입구만 맡는다.
 */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

export async function run(argv: string[]): Promise<number> {
  if (argv[0] === "parking-wide") {
    const result = spawnSync("python3", [resolve(import.meta.dirname, "../parking_wide.py"), ...argv.slice(1)], { stdio: "inherit" });
    return result.status ?? 1;
  }
  if (argv[0] === "save-parking-project") {
    const result = spawnSync(process.execPath, [resolve(import.meta.dirname, "parkingProject.mjs"), ...argv.slice(1)], { stdio: "inherit" });
    return result.status ?? 1;
  }
  if (argv[0] === "publish-parking") {
    const result = spawnSync("python3", [resolve(import.meta.dirname, "../parking_bundle.py"), ...argv.slice(1)], { stdio: "inherit" });
    return result.status ?? 1;
  }
  const script = resolve(import.meta.dirname, "../harness.py");
  const result = spawnSync("python3", [script, ...argv], { stdio: "inherit" });
  return result.status ?? 1;
}
