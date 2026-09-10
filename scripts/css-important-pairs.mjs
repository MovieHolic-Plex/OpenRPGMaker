// 레이어를 씌우면 승자가 바뀔 수 있는 !important 쌍을 열거한다. 1단계 전 1회용.
import path from "node:path";
import fs from "node:fs";
import { flattenImports, indexDeclarations, lastCompound } from "./css-flatten.mjs";
const registry = JSON.parse(fs.readFileSync("scripts/css-surfaces.json", "utf8"));
const root = path.resolve("src/styles");
const decls = indexDeclarations(flattenImports(path.resolve("src/styles/index.css")), root);
const planned = (file) => { // 1단계 배정표(Task 7 Step 1)와 같은 규칙
  if (file.startsWith("database/")) return "database";
  if (file.startsWith("shell/")) return "shell";
  if (/^editor\/(event-editor|storyboard)/.test(file)) return "event";
  // editor/ 안의 셸 대화상자 — Task 7 Step 1 이 수동으로 shell 에 배정하는 다섯 시트.
  if (/^editor\/(ai-settings-modal|help-modal|audio-test-dialog|cluster-ai-modal|local-diagnostics)\.css$/.test(file)) return "shell";
  if (file.startsWith("editor/")) return "map";
  // map/ 는 registry 의 map 표면 디렉터리. Task 7 Step 1 은 index.css 외에 base 로 떨어지는 파일이 없어야 한다.
  if (file.startsWith("map/")) return "map";
  if (file === "tokens.css") return "tokens";
  if (file.startsWith("runtime/") || file === "dialogue.css") return "runtime";
  if (file.startsWith("components/")) return "components";
  if (file.startsWith("resources/")) return "resources";
  return "base";
};
const rank = Object.fromEntries(registry.layerOrder.map((l, i) => [l, i]));
const imps = decls.filter((d) => d.imp);
const byKey = new Map();
for (const d of decls) { const k = lastCompound(d.sel) + "|" + d.prop; (byKey.get(k) ?? byKey.set(k, []).get(k)).push(d); }
for (const a of imps) {
  for (const b of byKey.get(lastCompound(a.sel) + "|" + a.prop) ?? []) {
    if (b === a || !b.imp) continue;
    const sa = planned(a.file), sb = planned(b.file);
    if (sa === sb) continue;
    // 현재: 뒤(seq 큼)가 이김. 레이어 후: !important 는 낮은 레이어가 이김.
    const nowWinner = a.seq > b.seq ? a : b;
    const laterWinner = rank[sa] < rank[sb] ? a : b;
    if (nowWinner !== laterWinner) console.log(`FLIP ${a.file}:${a.line} [${sa}] vs ${b.file}:${b.line} [${sb}]  ${a.sel} {${a.prop}}`);
  }
}
