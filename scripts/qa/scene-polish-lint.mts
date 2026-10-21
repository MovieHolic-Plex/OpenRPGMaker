// 장면 다듬기 경고(scene-*)를 프로젝트 JSON 하나에 돌린다 — 데모 회귀·조수 시험 확인용.
//   npx --no-install tsx scripts/qa/scene-polish-lint.mts <project.json> [--json]
// 규칙: src/project/lint/scenePolishLint.ts · 스킬: assistant-skills/game-scene-polish/SKILL.md
import { readFileSync } from "node:fs";
import { lintScenePolish } from "../../src/project/lint/scenePolishLint";
import type { Project } from "../../src/project/types";

const file = process.argv[2];
if (!file) { console.error("usage: scene-polish-lint.mts <project.json> [--json]"); process.exit(2); }
const project = JSON.parse(readFileSync(file, "utf8")) as Project;
const issues = lintScenePolish(project);
if (process.argv.includes("--json")) { console.log(JSON.stringify(issues, null, 1)); process.exit(0); }
const byCode = new Map<string, typeof issues>();
for (const issue of issues) byCode.set(issue.code, [...(byCode.get(issue.code) ?? []), issue]);
console.log(`${file}: scene 경고 ${issues.length}건`);
for (const [code, list] of [...byCode].sort()) {
  console.log(`\n## ${code} (${list.length})`);
  for (const issue of list) console.log(`- ${issue.message}`);
}
