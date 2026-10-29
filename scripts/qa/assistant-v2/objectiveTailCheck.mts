// 목표 칩 꼬리 재생(모델 없음): 저장된 조수 게임의 목표 문구(objectiveChip)에서 지난 코드가 붙인 「(… )」 꼬리를 떼고
// 지금 코드의 withWhere 로 다시 붙여 전/후를 나란히 적는다.
//   bun scripts/qa/assistant-v2/objectiveTailCheck.mts <run-dir 또는 project.json>... [--out <log.txt>]
import fs from "node:fs";
import path from "node:path";
import { readProjectSqlite } from "../../content/read-project-sqlite.mts";
import { withWhere } from "../../../src/ai/v2/discoverability.ts";
import type { Project } from "../../../src/project/types.ts";

const argv = process.argv.slice(2);
const outAt = argv.indexOf("--out");
const out = outAt >= 0 ? argv[outAt + 1] : undefined;
const inputs = argv.filter((_, i) => outAt < 0 || (i !== outAt && i !== outAt + 1));
const lines: string[] = [];
const say = (line: string) => { lines.push(line); console.log(line); };
const load = (input: string): Project => input.endsWith(".json") ? JSON.parse(fs.readFileSync(input, "utf8")) as Project : readProjectSqlite(path.join(input, "project"));
const messages = (value: unknown, found: string[]): void => {
  if (Array.isArray(value)) { for (const item of value) messages(item, found); return; }
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  const fields = record.fields as Record<string, unknown> | undefined;
  if (record.kind === "m2Command" && fields?.surface === "objectiveChip" && typeof fields.message === "string") found.push(fields.message);
  for (const child of Object.values(record)) if (child && typeof child === "object") messages(child, found);
};
for (const input of inputs) {
  const project = load(input);
  say(`### ${input.replace(/^.*\/runs\//u, "")}`);
  for (const map of Object.values(project.maps)) for (const event of map.events ?? []) {
    const found: string[] = [];
    messages(event.pages ?? [], found);
    for (const before of new Set(found)) {
      const raw = before.replace(/\s*\([^()]*\)\s*$/u, "").trim();
      const after = withWhere(project, map.id, raw);
      say(`  전 ${before.length}자: ${before}`);
      say(`  후 ${after.length}자: ${after}`);
    }
  }
}
if (out) { fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, lines.join("\n") + "\n"); }
