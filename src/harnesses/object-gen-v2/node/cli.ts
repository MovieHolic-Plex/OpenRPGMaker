import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../../../..");
const SUBREPO = join(ROOT, "harness/object-gen-v2");
const DEFAULT_PALETTE = join(SUBREPO, "palettes/fable-city.json");

function runPy(args: string[]): number {
  const res = spawnSync("python3", ["-m", "objectgen_v2.cli", ...args], {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, PYTHONPATH: SUBREPO },
  });
  return res.status ?? 1;
}

export async function run(argv: string[]): Promise<number> {
  const [stage = "status", ...rest] = argv;

  if (!existsSync(join(SUBREPO, "objectgen_v2/cli.py"))) {
    console.error(`서브레포 사본이 없다: ${SUBREPO} (npm run object-gen-v2:sync -- import 확인)`);
    return 1;
  }

  if (stage === "status") {
    const refsIdx = JSON.parse(readFileSync(join(SUBREPO, "references/index.json"), "utf8")) as {
      palette: string;
      references: Array<{ id: string; category: string; w: number; h: number }>;
    };
    const palettes = readdirSync(join(SUBREPO, "palettes")).filter((f) => f.endsWith(".json") || f.endsWith(".pal"));
    console.log(`[object-gen-v2] subrepo=${SUBREPO}`);
    console.log(`  권장 모델: gemini-4-carbon (thought_level: medium) — 다른 모델에서는 평면 fillRect 퇴행 위험`);
    console.log(`  잠금 팔레트(${palettes.length}): ${palettes.join(", ")}`);
    console.log(`  골드 레퍼런스(${refsIdx.references.length}): ${refsIdx.references.map((r) => `${r.id}(${r.category})`).join(", ")}`);
    const syncRes = spawnSync("node", [join(ROOT, "scripts/object-gen-v2-sync.mjs"), "status"], {
      cwd: ROOT,
      encoding: "utf8",
    });
    if (syncRes.stdout) process.stdout.write(syncRes.stdout.trim().split("\n").map((l) => `  [sync] ${l}`).join("\n") + "\n");
    return 0;
  }

  if (stage === "init-batch") {
    const hasPal = rest.includes("--palette");
    return runPy(["init-batch", ...(hasPal ? rest : [...rest, "--palette", DEFAULT_PALETTE])]);
  }

  if (stage === "verify") {
    const hasPal = rest.includes("--palette");
    const hasNoBlack = rest.includes("--no-pure-black");
    return runPy([
      "verify",
      ...rest,
      ...(hasPal ? [] : ["--palette", DEFAULT_PALETTE]),
      ...(hasNoBlack ? [] : ["--no-pure-black"]),
    ]);
  }

  if (stage === "sheet") {
    return runPy(["sheet", ...rest]);
  }

  if (stage === "pack") {
    return runPy(["pack", ...rest]);
  }

  if (stage === "test") {
    const res = spawnSync("python3", ["-m", "unittest", "discover", "-s", join(SUBREPO, "tests"), "-v"], {
      cwd: SUBREPO,
      stdio: "inherit",
      env: { ...process.env, PYTHONPATH: SUBREPO },
    });
    return res.status ?? 1;
  }

  if (stage === "sync") {
    const res = spawnSync("node", [join(ROOT, "scripts/object-gen-v2-sync.mjs"), ...rest], {
      cwd: ROOT,
      stdio: "inherit",
    });
    return res.status ?? 1;
  }

  console.error(`알 수 없는 단계: ${stage} (허용: status | init-batch | verify | sheet | pack | test | sync)`);
  return 2;
}
