// scripts/lib/genKitsDrift.mjs
// 편집기 빌드가 생성기 고정판(tiledata/gen-kits.lock.json)을 보고 크게 경고한다(2026-10-22).
// - 생성물(genKits/kits.json)의 커밋이 lock 과 다르면: lock 을 올리고 sync 를 안 돌렸다 → 공방은 옛 지시문으로 돈다.
// - 로컬 사본(.gen-kits/<kit>.git, npm run gen-kits:sync 가 받아 둔 것)이 있으면 그 main 이 lock 보다 몇 커밋 앞섰는지(네트워크 없이).
// 빌드를 막지는 않는다. 막으려면 OPRN_GEN_KITS_STRICT=1. CI 의 실패 검사는 npm run gen-kits:check(네트워크로 main 을 본다).
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function genKitsDriftReport(root) {
  const lock = JSON.parse(readFileSync(join(root, "tiledata/gen-kits.lock.json"), "utf8"));
  const summaryPath = join(root, "src/harnesses/_core/workshop/genKits/kits.json");
  const summary = existsSync(summaryPath) ? JSON.parse(readFileSync(summaryPath, "utf8")).kits ?? {} : {};
  const cache = join(root, process.env.OPRN_GEN_KITS_DIR || ".gen-kits");
  const problems = [];
  for (const [kit, spec] of Object.entries(lock.kits)) {
    if (summary[kit]?.commit !== spec.commit) problems.push(`${kit}: 생성물 커밋 ${String(summary[kit]?.commit ?? "없음").slice(0, 9)} ≠ lock ${spec.commit.slice(0, 9)} — npm run gen-kits:sync`);
    const gitDir = join(cache, `${kit}.git`);
    if (!existsSync(gitDir)) continue;
    try {
      const behind = Number(execFileSync("git", ["--git-dir", gitDir, "rev-list", "--count", `${spec.commit}..refs/heads/${spec.branch ?? "main"}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim());
      if (behind > 0) problems.push(`${kit}: lock 이 받아 둔 main 보다 ${behind}커밋 뒤처짐(공방은 아직 옛 지시문·판정 기준) — npm run gen-kits:sync -- --drift 로 보고 --bump ${kit}`);
    } catch { /* 받아 둔 사본에 lock 커밋이 없다 — sync 가 받는다 */ }
  }
  return problems;
}

export function genKitsDriftPlugin() {
  return {
    name: "oprn-gen-kits-drift",
    apply: "build",
    buildStart() {
      let problems;
      try { problems = genKitsDriftReport(process.cwd()); } catch (error) { problems = [`gen-kits 고정판을 읽지 못했다: ${error instanceof Error ? error.message : String(error)}`]; }
      if (!problems.length) return;
      const lines = ["", "!".repeat(96), "!!! 생성기 고정판(gen-kits) 드리프트 — 공방이 생성기 저장소 최신과 다르게 돈다", ...problems.map((p) => `!!!   ${p}`), "!".repeat(96), ""];
      console.warn(lines.join("\n"));
      if (process.env.OPRN_GEN_KITS_STRICT === "1") this.error(`gen-kits 드리프트: ${problems.join(" / ")}`);
    },
  };
}
