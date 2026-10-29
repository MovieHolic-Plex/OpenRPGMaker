// 단계 건너뛰는 지름길 전수 검사(src/ai/v2/stepSkip.ts).
//   bun scripts/qa/assistant-v2/stepSkipCheck.mts <project.json|player.json> [...]
// 한 줄에 한 판: 지름길 수와 「단계 k 맵 ← 출발 맵 (x,y)」.
import fs from "node:fs";
import { stepSkipShortcuts } from "../../../src/ai/v2/stepSkip";

let bad = 0;
for (const file of process.argv.slice(2)) {
  const project = JSON.parse(fs.readFileSync(file, "utf8"));
  const found = stepSkipShortcuts(project);
  const exits = found.reduce((n, f) => n + f.exits.length, 0);
  if (exits) bad += 1;
  console.log(`${exits}\t${file}\t${found.map((f) => `단계${f.step}「${f.stepEvent}」 ${f.map} ← ${f.exits.map((e) => `${e.from}(${e.x},${e.y})`).join(", ")}`).join(" / ")}`);
}
console.log(`지름길 있는 판 ${bad}/${process.argv.length - 2}`);
