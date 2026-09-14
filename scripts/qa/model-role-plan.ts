// Live read-only Ultrabrain Pi smoke test. Minimal fixture, no remote persistence.
import { createBlankProject } from "../../src/project/defaults";
import { writeFileSync } from "node:fs";
const project = createBlankProject();
const writerCheck = process.argv.includes("--writer");
const model = writerCheck ? "gemini-3.7-flash" : "gemini-3.8-flash";
const response = await fetch(`${process.env.QA_BASE_URL || "http://127.0.0.1:9816"}/v1/agent/run?provider=google-antigravity`, {
  method: "POST", headers: { "Content-Type": "application/json", "X-Rpgzzu-Provider": "google-antigravity" },
  body: JSON.stringify({ mode: "single", provider: "google-antigravity", model, thinkingLevel: "high",
    ...(writerCheck ? { roleModels: { writer: { provider: "google-antigravity", model: "gemini-3.7-flash", thinkingLevel: "medium" } } } : {}),
    task: writerCheck ? "반드시 consult_writer 도구를 한 번 호출해 친절한 숲 안내자의 환영 대사 한 문장을 작성하게 하고 그 대사를 반환하세요. 프로젝트는 수정하지 마세요." : "계획만 작성하세요. 이 빈 맵을 작은 숲 쉼터로 꾸밀 계획을 두 항목으로 짧게 제안하세요. 이번 검증에서는 도구 조회 없이 일반적인 계획만 작성하세요.",
    mapIds: Object.keys(project.maps), project, readOnly: true, maxTurns: 4, timeoutMs: 120000 }),
  signal: AbortSignal.timeout(150000),
});
if (!response.ok) throw new Error(`HTTP ${response.status}`);
const events = (await response.text()).trim().split("\n").map(line => JSON.parse(line));
const error = events.find(e => e.type === "error");
const start = events.find(e => e.type === "start");
const done = events.find(e => e.type === "done");
const answer = events.filter(e => e.type === "assistant").at(-1)?.text;
if (error || !done || done.changedKeys.length || !answer || start?.model !== model || (writerCheck && !events.some(e => e.type === "tool_start" && e.name === "consult_writer"))) throw new Error(error?.message || "Plan failed/read-only violated");
writeFileSync(`output/evidence/ultrabrain/${writerCheck ? "writer" : "plan"}-wire.json`, JSON.stringify({ start, answer, changedKeys: done.changedKeys, stats: done.stats }, null, 2));
console.log(JSON.stringify({ model: start.model, readOnly: true, changedKeys: done.changedKeys, answer }));
