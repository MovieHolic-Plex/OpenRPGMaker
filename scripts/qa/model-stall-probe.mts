// 모델 호출 무응답 감시 확인(좁은 스크립트 — vitest 아님): 일부러 침묵하는 가짜 OpenAI 호환 끝점에 실제 runPiAgent 를 붙여
// 재시도·포기를 보인다. 모델·키·네트워크를 쓰지 않는다(127.0.0.1 임시 서버).
//   bun scripts/qa/model-stall-probe.mts            # 세 경우를 차례로: silent(포기) · recover(재시도 뒤 성공) · midstall(토큰 사이 침묵)
//   OPRN_MODEL_FIRST_EVENT_TIMEOUT_MS / OPRN_MODEL_IDLE_TIMEOUT_MS / OPRN_MODEL_STALL_RETRIES 로 값을 바꿔 볼 수 있다(기본: 3000 / 2000 / 2).
// 계약: src/ai/piAgent/providerRetry.ts(modelStallLimits) · openwiki/assistant-v2.md 「모델 호출 무응답 한도」.
process.env.OPRN_MODEL_FIRST_EVENT_TIMEOUT_MS ??= "3000";
process.env.OPRN_MODEL_IDLE_TIMEOUT_MS ??= "2000";
process.env.OPRN_MODEL_STALL_RETRIES ??= "2";
import { createServer, type ServerResponse } from "node:http";
import { runPiAgent } from "../lib/piAgentRuntime.ts";
import { registerOpenAiCompatEndpoints } from "../lib/openAiCompatModel.ts";
import { createBlankProject } from "../../src/project/defaults.ts";
import type { PiAgentEvent } from "../../src/ai/piAgent/protocol.ts";

type Mode = "silent" | "recover" | "midstall";
const chunk = (res: ServerResponse, delta: Record<string, unknown>, finish: string | null = null) =>
  res.write(`data: ${JSON.stringify({ id: "x", object: "chat.completion.chunk", created: 1, model: "fake", choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`);

async function probe(mode: Mode) {
  let requests = 0;
  const server = createServer((req, res) => {
    req.on("data", () => {}); req.on("end", () => {
      requests += 1;
      res.writeHead(200, { "content-type": "text/event-stream" });
      // 헤더만 보내고 침묵(silent·recover 의 첫 요청) — 또는 토큰 하나 뒤 침묵(midstall).
      // pi-ai 는 첫 응답 감시를 SDK 요청 층에서 한 번 더 걸어 한 시도에 HTTP 요청이 둘 갈 수 있다 — 세 번째 HTTP 요청부터 답해 우리 재시도를 거치게 한다.
      if (mode === "recover" && requests >= 3) { chunk(res, { role: "assistant", content: "끝" }); chunk(res, {}, "stop"); res.end("data: [DONE]\n\n"); return; }
      if (mode === "midstall") chunk(res, { role: "assistant", content: "생각 중" });
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  const port = (server.address() as { port: number }).port;
  const provider = "openai-compat:stallprobe";
  registerOpenAiCompatEndpoints({ [provider]: { id: provider, name: "stallprobe", baseUrl: `http://127.0.0.1:${port}/v1`, headers: {}, keyless: true, reasoningMode: "none",
    allowModels: [], blockModels: [], supportsImages: false, maxOutputTokens: 256, contextWindow: 8000, firstTokenTimeoutSec: 600 } });
  const events: PiAgentEvent[] = [];
  const t0 = Date.now();
  const done = await runPiAgent({ provider, model: "fake", task: "무응답 시험", mapIds: [], project: createBlankProject(), toolDomains: ["core"], maxTurns: 5 } as never,
    { apiKey: "unused", onEvent: (e) => events.push(e), timeoutMs: 120_000 }).catch((error: unknown) => ({ thrown: error instanceof Error ? error.message : String(error) }));
  server.close();
  const pick = (name: string) => events.filter((e) => e.type === "execution_status" && (e as { name?: string }).name === name).map((e) => (e as { summary?: string }).summary);
  const errors = events.filter((e) => e.type === "error").map((e) => (e as { message: string }).message);
  console.log(JSON.stringify({ mode, seconds: Math.round((Date.now() - t0) / 100) / 10, requests, retries: pick("provider_stall_retry"), giveUp: pick("provider_stall_giveup"), errors,
    ok: (done as { ok?: boolean }).ok, thrown: (done as { thrown?: string }).thrown }, null, 1));
  return { requests, retries: pick("provider_stall_retry").length, giveUp: pick("provider_stall_giveup").length, errors };
}

const silent = await probe("silent");
const recover = await probe("recover");
const mid = await probe("midstall");
const retries = Number(process.env.OPRN_MODEL_STALL_RETRIES);
// HTTP 요청 수는 시도 수 이상(SDK 층 재요청 포함)이다 — 판정은 우리 재시도·포기 이벤트로 한다.
const pass = silent.retries === retries && silent.giveUp === 1 && silent.requests >= retries + 1
  && recover.retries >= 1 && recover.giveUp === 0 && recover.errors.length === 0
  && mid.retries === retries && mid.giveUp === 1 && mid.requests === retries + 1;
console.log(pass ? "PROBE OK — 침묵하면 같은 요청을 다시 보내고, 한도 뒤 차례를 실패로 끝내며, 다시 답하면 이어 간다" : "PROBE FAIL");
process.exit(pass ? 0 : 1);
