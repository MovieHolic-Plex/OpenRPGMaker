/**
 * 구운 데모 project.json 위에 「이야기」 lore 패스만 다시 돌려 본다 — 전체 굽기(수 분) 없이 lore 파일을 고칠 때.
 *
 *   node --max-old-space-size=8000 node_modules/vite-node/dist/cli.mjs --script scripts/content/check-demo-lore.mts \
 *     --demo chrono-bell --in dist/demos/chrono-bell.project.json [--out /tmp/x.project.json]
 *
 * 도구 거절(없는 ref·잘못된 칸)은 그대로 던진다. 끝에 칸별 개수와 하한 미달(demoLoreProblems)을 찍는다.
 * 원본 파일은 바꾸지 않는다(--out 을 주면 그쪽에 쓴다).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { deserialize, serialize } from "@/project/io";
import type { Project } from "@/project/types";
import { demoLoreCounts, demoLoreProblems, loreExec, type LoreExec } from "@/project/flagship/loreKit";

function argOf(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

type Apply = (project: Project, exec?: LoreExec) => void;
const LORE: Record<string, () => Promise<Apply>> = {
  "chrono-bell": async () => (await import("@/project/flagship/fallen/lore")).applyFallenStarLore,
  "emerald-crown": async () => (await import("@/project/flagship/emeraldCrownLore")).applyEmeraldCrownLore,
  "shitamachi-fourth-season": async () => (await import("@/project/flagship/shitamachiLore")).applyShitamachiLore,
  "first-love": async () => (await import("@/project/flagship/firstLoveLore")).applyFirstLoveLore,
  "maou-konbini": async () => (await import("@/project/flagship/maouKonbiniLore")).applyMaouKonbiniLore,
};

const demo = argOf("demo");
const input = argOf("in");
if (!demo || !input || !LORE[demo]) {
  throw new Error(`--demo (${Object.keys(LORE).join("|")}) 와 --in <project.json> 이 필요하다`);
}
const project = deserialize(readFileSync(input, "utf8"));
console.log("before", JSON.stringify(demoLoreCounts(project)));
const apply = await LORE[demo]!();
apply(project, loreExec);
// 두 번 불러도 같은 결과여야 한다(빌더가 lore 를 다시 부르는 판본이 생겨도 문서가 늘어나지 않게).
const once = JSON.stringify({ c: project.worldCanon, w: project.world, ch: project.characters });
apply(project, loreExec);
const twice = JSON.stringify({ c: project.worldCanon, w: project.world, ch: project.characters });
const reloaded = deserialize(serialize(project));
console.log("after ", JSON.stringify(demoLoreCounts(reloaded)));
console.log("idempotent(text)", once.replace(/"at":\d+|_\d+"/g, "") === twice.replace(/"at":\d+|_\d+"/g, ""));
const problems = demoLoreProblems(reloaded);
console.log(problems.length ? `PROBLEMS: ${problems.join(" / ")}` : "lore ok");
const out = argOf("out");
if (out) writeFileSync(out, serialize(reloaded));
