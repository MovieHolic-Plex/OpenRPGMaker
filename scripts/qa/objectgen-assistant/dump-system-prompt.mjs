// 실제 Pi 시공 에이전트 시스템 프롬프트(buildPiAgentSystemPrompt)를 시험 프로젝트·맵 기준으로 뽑는다 — 조수 대용 역할극이 같은 문장을 받게.
// node scripts/qa/objectgen-assistant/dump-system-prompt.mjs <project.json> <mapId> <out.txt>
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { withTsModule } from "../../ontology-ts-loader.mjs";

const [projectPath, mapId, out] = process.argv.slice(2);
const entry = resolve(fileURLToPath(new URL("./systemPromptEntry.ts", import.meta.url)));
await withTsModule(entry, "sysprompt.mjs", async (module) => {
  const project = module.normalize(JSON.parse(readFileSync(projectPath, "utf8")));
  writeFileSync(out, module.buildPiAgentSystemPrompt(project, [mapId], false).join("\n"));
});
console.log(`wrote ${out}`);
