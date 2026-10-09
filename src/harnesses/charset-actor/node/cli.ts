import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { CHARSET_ACTOR_HARNESS } from "../harness";

export async function run(argv: string[]): Promise<number> {
  const [stage, ...args] = argv;
  if (!stage || stage === "--help") {
    console.log(CHARSET_ACTOR_HARNESS.stages.map((s) => `${s.id}: ${s.summary}`).join("\n"));
    return 0;
  }
  if (!CHARSET_ACTOR_HARNESS.stages.some((s) => s.id === stage)) {
    console.error(`모르는 단계: ${stage}`);
    return 2;
  }
  const scripts: Record<string, string> = { serve: "review_server.py", produce: "studio.py", recipe: "recipes.py", bulk: "bulk.py", actions: "actions.py", export: "bulk-export.py", verify: "verify.py", audit: "audit.py", "walk-qa": "walk_qa.py" };
  const script = fileURLToPath(new URL(`../${scripts[stage] ?? "harness.py"}`, import.meta.url));
  return new Promise((resolve) => {
    const child = spawn(process.env.PYTHON3 ?? "python3", [script, ...(stage in scripts ? [] : [stage]), ...args], { stdio: "inherit" });
    child.once("error", (error) => { console.error(error.message); resolve(1); });
    child.once("exit", (code) => resolve(code ?? 1));
  });
}
