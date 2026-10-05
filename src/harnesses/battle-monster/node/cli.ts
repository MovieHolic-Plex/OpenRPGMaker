import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { BATTLE_MONSTER_HARNESS } from "../harness";

export async function run(argv: string[]): Promise<number> {
  const [stage, ...args] = argv;
  if (!stage || stage === "--help") {
    console.log(BATTLE_MONSTER_HARNESS.stages.map((item) => `${item.id}: ${item.summary}`).join("\n"));
    return 0;
  }
  if (!BATTLE_MONSTER_HARNESS.stages.some((item) => item.id === stage)) {
    console.error(`모르는 단계: ${stage}`);
    return 2;
  }
  const script = fileURLToPath(new URL(stage === "serve" ? "./dashboard.py" : stage === "wave" ? "./wave.py" : "./pipeline.py", import.meta.url));
  return new Promise((resolve) => {
    const child = spawn(process.env.PYTHON3 ?? "python3", [script, ...(["serve", "wave"].includes(stage) ? [] : [stage]), ...args], { stdio: "inherit" });
    child.once("error", (error) => { console.error(error.message); resolve(1); });
    child.once("exit", (code) => resolve(code ?? 1));
  });
}
