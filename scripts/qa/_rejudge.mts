
import { existsSync } from "node:fs";
import { join } from "node:path";
import { blindJudge } from "./authentic-pilot-qa.mts";
import { JRPG_200_CASES } from "./jrpg-200-cases.mts";
import { resolveRequestApiKey } from "../lib/aiAuthRuntime.ts";
const provider = process.env.PILOT_JUDGE_PROVIDER ?? "google-antigravity";
const key = await resolveRequestApiKey(provider);
if (!key) throw new Error("no credentials for " + provider);
const vizDir = "/home/main/claude-viz/authentic-pilot";
const ids = (process.argv[2] ?? "jrpg_016,jrpg_002,jrpg_003,jrpg_046").split(",");
console.log("judge:", provider, process.env.PILOT_JUDGE_MODEL ?? "(default)");
for (const id of ids) {
  const c = JRPG_200_CASES.find((x) => x.id === id)!;
  const imgs = [join(vizDir, id + "_map.png"), join(vizDir, id + "_A_pre.png"), join(vizDir, id + "_A.png"), join(vizDir, id + "_A_peak.png"), join(vizDir, id + "_B_peak.png")];
  const missing = imgs.filter((p) => !existsSync(p));
  if (missing.length) { console.log(id, "missing images:", missing.map((m) => m.split("/").pop())); continue; }
  const t = Date.now();
  try {
    const j = await blindJudge(c.prompt, imgs, key);
    console.log(id, "passed=" + j.passed, "score=" + j.score, "votes=" + JSON.stringify(j.votes), ((Date.now() - t) / 1000).toFixed(0) + "s");
    console.log("   ", j.critique.replace(/\s+/g, " ").slice(0, 230));
  } catch (e) {
    console.log(id, "FAIL", String((e as Error).message).slice(0, 200).replace(/\s+/g, " "));
  }
}
