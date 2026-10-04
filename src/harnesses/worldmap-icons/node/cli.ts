import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export async function run(argv: string[]): Promise<number> {
  const baking = argv[0] === "build" || argv[0] === "check";
  const script = fileURLToPath(new URL(baking ? "../bake.py" : "../harness.py", import.meta.url));
  const result = spawnSync("python3", [script, ...argv], { stdio: "inherit" });
  if (result.error) console.error(result.error.message);
  return result.status ?? 1;
}
