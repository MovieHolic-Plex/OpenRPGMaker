// Optional live smoke: no authored content or writes. Uses the normal Pi prompt,
// a single agent, DEFAULT application mode and the real web-search transport.
import { mkdirSync, writeFileSync } from "node:fs";
import { resolveRequestApiKey } from "../lib/aiAuthRuntime.ts";
import { runPiAgent } from "../lib/piAgentRuntime.ts";
import { CODEX_WEB_SEARCH_ENDPOINT } from "../lib/codexWebSearchRuntime.ts";
import { createBlankProject } from "../../src/project/defaults.ts";

const provider = process.env.AI_PARALLEL_PROVIDER ?? "google-antigravity";
const out = process.env.AI_PARALLEL_EVIDENCE_DIR ?? ".omo/evidence/ai-tool-parallel/live";
const apiKey = await resolveRequestApiKey(provider);
const codexApiKey = provider === "openai-codex" ? apiKey : await resolveRequestApiKey("openai-codex");
if (!apiKey || !codexApiKey) throw new Error("Live smoke requires connected assistant and Codex search providers.");
const trace: Record<string, unknown>[] = [];
const started = performance.now();
const record = (event: string, fields: Record<string, unknown> = {}) => trace.push({
  event, atMs: Math.round(performance.now() - started), ...fields,
});
const originalFetch = globalThis.fetch;
let active = 0, peak = 0;
globalThis.fetch = (async (url, init) => {
  if (String(url) !== CODEX_WEB_SEARCH_ENDPOINT || !String(init?.body).includes('"web_search"')) return originalFetch(url, init);
  const body = JSON.parse(String(init?.body));
  // Record only the public query and timing, never headers/auth or raw payloads.
  const query = body.input?.[0]?.content?.[0]?.text;
  peak = Math.max(peak, ++active);
  record("search_http_start", { query });
  try {
    const response = await originalFetch(url, init);
    // The fetch resolves at headers. Wrap the body so duration includes streaming.
    const reader = response.body?.getReader();
    if (!reader) { active--; return response; }
    let finished = false;
    const finish = () => { if (!finished) { finished = true; active--; record("search_http_end", { query }); } };
    return new Response(new ReadableStream({
      async pull(controller) {
        try {
          const next = await reader.read();
          if (next.done) { finish(); controller.close(); } else controller.enqueue(next.value);
        } catch (error) { finish(); controller.error(error); }
      },
      async cancel(reason) { finish(); await reader.cancel(reason); },
    }), { status: response.status, statusText: response.statusText, headers: response.headers });
  } catch (error) { active--; record("search_http_error", { query }); throw error; }
}) as typeof fetch;
let result: Record<string, unknown>;
try {
  const done = await runPiAgent({
    provider, mode: "single", applyMode: "default", mapIds: [], project: createBlankProject(),
    maxTurns: 4, thinkingLevel: "low", initialToolNames: ["get_project_summary", "web_search"],
    task: "프로젝트 제목을 확인하고, SQLite WAL의 특징과 IndexedDB 트랜잭션의 특징을 각각 공식 자료로 웹 검색해서 세 문장으로 요약해줘.",
  }, {
    apiKey, codexApiKey, toolNames: ["get_project_summary", "web_search"], timeoutMs: 150_000,
    onCheckpoint: async () => { throw new Error("This smoke must not publish changes."); },
    onEvent: e => {
      if (e.type === "start") record(e.type, { provider: e.provider, model: e.model });
      if (e.type === "turn") record(e.type, { index: e.index });
      if (e.type === "tool_start" || e.type === "tool_end") record(e.type, { name: e.name, id: e.id, ...(e.type === "tool_end" ? { ok: e.ok } : {}) });
    },
  });
  result = { provider, liveModel: true, liveSearch: true, peakSearchConcurrency: peak, stats: done.stats, changedKeys: done.changedKeys, trace };
  if (done.stats.toolErrors || done.changedKeys.length || peak < 2) process.exitCode = 1;
} catch (error) {
  result = { provider, liveModel: true, liveSearch: true, peakSearchConcurrency: peak, error: error instanceof Error ? error.message : "Live smoke failed", trace };
  process.exitCode = 1;
} finally { globalThis.fetch = originalFetch; }
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/result.json`, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
