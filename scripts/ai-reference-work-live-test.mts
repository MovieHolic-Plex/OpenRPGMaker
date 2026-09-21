/**
 * 라이브 검증: 사용자가 실존 작품을 비유하면 조수가 **스스로 웹 검색**하고, 그 사실로 설계하는가.
 *
 *   ~/.bun/bin/bun run scripts/ai-reference-work-live-test.mts [--request "…"] [--json]
 *
 * 편집기가 실제로 타는 경로를 그대로 통과한다:
 *   의도 선언(LLM) → 참조 작품 노트 → Pi 에이전트 루프(워커와 같은 런타임) → web_search 실행.
 *
 * 판정은 **실제 실행된 툴 호출**로 한다 — 프롬프트가 검색을 권했는지가 아니라 검색이 나갔는지다.
 * 키는 로컬 동반 서비스에서만 읽고 출력하지 않는다.
 */
import { createBlankProject } from "../src/project/defaults.ts";
import { createLlmIntentDeclarer, buildIntentFacts } from "../src/ai/intentDeclarationClient.ts";
import { buildPiIntentNote } from "../src/ai/piAgent/executionRoute.ts";
import { resolveRequestApiKey } from "./lib/aiAuthRuntime.ts";
import { runPiAgent } from "./lib/piAgentRuntime.ts";
import type { PiAgentEvent } from "../src/ai/piAgent/protocol.ts";

// 브라우저는 페이지 오리진의 상대경로 /v1 을 친다. Node 하네스에는 오리진이 없으므로
// 로컬 동반 서비스로 돌린다 — 편집기의 dev 미들웨어와 같은 라우터를 쓴다.
const nativeFetch = globalThis.fetch;
globalThis.fetch = ((input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
  if (typeof input === "string" && input.startsWith("/")) {
    return nativeFetch(`http://127.0.0.1:17832${input}`, init);
  }
  return nativeFetch(input, init);
}) as typeof fetch;

const args = process.argv.slice(2);
const flag = (name: string): string | null => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] ?? null : null;
};
const asJson = args.includes("--json");
const REQUEST = flag("request") ?? "해리포터 같은 게임 만들고 싶다. 마법학교 분위기로.";
const MAX_TURNS = Number(flag("turns") ?? 8);

const project = createBlankProject();
const facts = buildIntentFacts({
  project, userText: REQUEST, currentMapId: null, selection: null, hasActivePlan: false,
});
const declared = await createLlmIntentDeclarer()(facts);
const intent = declared.intent;
const note = buildPiIntentNote({ intent, targetMap: null, selection: null });

const agyKey = await resolveRequestApiKey("google-antigravity");
const codexKey = await resolveRequestApiKey("openai-codex");

const events: PiAgentEvent[] = [];
await runPiAgent({
  provider: "google-antigravity",
  model: "gemini-3.7-flash",
  task: [REQUEST, note].filter(Boolean).join("\n\n"),
  mapIds: [],
  project,
  // 계획 턴과 같은 조건: 쓰기 툴 미제공. 검색은 read 툴이라 살아남아야 한다.
  readOnly: true,
  maxTurns: MAX_TURNS,
}, {
  apiKey: agyKey ?? undefined,
  codexApiKey: codexKey ?? undefined,
  onEvent: (event) => events.push(event),
});

const startedNames = events.filter((e) => e.type === "tool_start").map((e) => (e as { name: string }).name);
const unique = [...new Set(startedNames)];
const searchCalls = startedNames.filter((name) => name === "web_search").length;
const payload = JSON.stringify(events);
const sources = [...new Set(payload.match(/https?:\/\/[^"\\\s]{10,120}/g) ?? [])];
const assistant = events.filter((e) => e.type === "assistant").map((e) => (e as { text: string }).text).join("\n");

const report = {
  request: REQUEST,
  intent: {
    source: intent.source,
    mode: intent.mode,
    needsPlan: intent.needsPlan,
    referenceWork: intent.referenceWork ?? null,
    declaredSearch: intent.tools.includes("web_search"),
  },
  noteHasReferenceContract: /\[참조 작품\]/.test(note ?? ""),
  toolsStarted: unique,
  searchCalls,
  sources,
  assistantTail: assistant.slice(-600),
  verdict: searchCalls > 0 && sources.length > 0 ? "PASS" : "FAIL",
};

if (asJson) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  console.log(`요청: ${report.request}`);
  console.log(`의도: source=${report.intent.source} mode=${report.intent.mode} needsPlan=${report.intent.needsPlan}`);
  console.log(`참조 작품: ${JSON.stringify(report.intent.referenceWork)} (선언 툴에 web_search: ${report.intent.declaredSearch})`);
  console.log(`참조 계약 노트: ${report.noteHasReferenceContract}`);
  console.log(`실행된 툴: ${JSON.stringify(report.toolsStarted)}`);
  console.log(`web_search 호출: ${report.searchCalls}`);
  console.log(`출처: ${report.sources.length > 0 ? report.sources.slice(0, 3).join(" | ") : "없음"}`);
  console.log(`보고 끝: ${report.assistantTail.replace(/\n/g, " | ").slice(0, 300)}`);
  console.log(`판정: ${report.verdict}`);
}
process.exit(report.verdict === "PASS" ? 0 : 1);

