#!/usr/bin/env bun
// 실서버 시험 — 「사용자 지정 (OpenAI 호환)」 제공자를 진짜 OpenAI 호환 서버(CLIProxyAPI·LiteLLM·Ollama…)에 대 본다.
//
//   OPRN_LIVE_KEY=<키> bun scripts/qa/openai-compat-live.mjs \
//     --base http://mdc-server:8318/v1 --models gemini-4-argon-high \
//     --items models,turn,effort,image --allow 'gemini-4-argon*' --block 'claude-*'
//
// 인자
//   --base    기본 주소(…/v1). 필수.
//   --models  쉼표로 나눈 모델 ID. 기본 gemini-4-argon-high 하나.
//   --items   models(GET /models) · turn(도구 호출 왕복 한 턴) · effort(추론 강도 세 방식) · image(이미지 입력). 기본 models,turn,effort.
//   --allow / --block  허용·차단 모델 패턴(쉼표). 기본 허용 gemini-4-argon*, 차단 claude-* . 패턴에 막힌 모델은 호출하지 않고 건너뛴다
//                      (비싼 모델을 실수로 부르지 않는다) — 에디터가 쓰는 같은 판정 함수(openAiCompatModelVerdict)를 쓴다.
//   --no-key  키 없이 시험(Ollama·LM Studio).
//
// 비밀: 키는 환경변수 OPRN_LIVE_KEY 로만 받는다. 인자·표준 출력·오류 어디에도 찍지 않고(출력은 전부 마스킹을 거친다) 파일에 쓰지 않는다.
// 전송은 에디터와 같은 코드(buildModel → pi-ai openai-completions, guardedOpenAiCompatFetch)를 지난다.

import { completeSimple } from "@oh-my-pi/pi-ai";
import {
  openAiCompatAllowedModels,
  openAiCompatModelVerdict,
  openAiCompatSuffixedModelId,
} from "../../src/ai/openAiCompat.ts";
import { testOpenAiCompat } from "../lib/openAiCompatRuntime.ts";
import { guardedOpenAiCompatFetch, registerOpenAiCompatEndpoints, resolveOpenAiCompatModel, shapeOpenAiCompatCall } from "../lib/openAiCompatModel.ts";

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0) return fallback;
  const next = process.argv[index + 1];
  return next === undefined || next.startsWith("--") ? true : next;
}
const list = (value) => String(value).split(",").map((item) => item.trim()).filter(Boolean);

const base = String(arg("base", "")).replace(/\/+$/u, "");
const noKey = arg("no-key", false) === true;
const KEY = noKey ? "" : (process.env.OPRN_LIVE_KEY ?? "");
const items = new Set(list(arg("items", "models,turn,effort")));
const policy = { allowModels: list(arg("allow", "gemini-4-argon*")), blockModels: list(arg("block", "claude-*")) };
const wanted = list(arg("models", "gemini-4-argon-high"));

const mask = (text) => (KEY.length >= 4 ? String(text).split(KEY).join("***") : String(text));
const say = (line) => process.stdout.write(`${mask(line)}\n`);

if (!base) { say("--base 가 필요합니다. 예: --base http://mdc-server:8318/v1"); process.exit(2); }
if (!noKey && !KEY) { say("OPRN_LIVE_KEY 환경변수가 비어 있습니다(키 없는 서버면 --no-key)."); process.exit(2); }

const results = [];
const record = (item, label, ok, detail) => { results.push({ item, label, ok }); say(`[${ok ? "OK " : "FAIL"}] ${item} · ${label}${detail ? ` — ${detail}` : ""}`); };

// 에디터가 워커에 싣는 것과 같은 모양의 엔드포인트 정의. 모드는 항목마다 바꿔 끼운다.
const providerId = "openai-compat:live";
const defineEndpoint = (reasoningMode, extra = {}) => registerOpenAiCompatEndpoints({
  [providerId]: {
    id: providerId, name: "live", baseUrl: base, headers: {}, keyless: noKey, reasoningMode,
    allowModels: policy.allowModels, blockModels: policy.blockModels, supportsImages: extra.images === true,
    maxOutputTokens: 2048, contextWindow: 128000, firstTokenTimeoutSec: 90,
  },
});

async function call(modelId, { mode = "none", level, tools, messages, images = false } = {}) {
  defineEndpoint(mode, { images });
  const model = resolveOpenAiCompatModel(providerId, modelId);
  const shaped = shapeOpenAiCompatCall(providerId, model, { ...(level ? { reasoning: level } : {}) });
  const context = { systemPrompt: ["Answer very briefly."], messages: messages ?? [{ role: "user", content: [{ type: "text", text: "Reply with the single word: pong" }], timestamp: Date.now() }], ...(tools ? { tools } : {}) };
  const started = Date.now();
  const message = await completeSimple(shaped.model, context, {
    apiKey: KEY || "oprn-no-key", fetch: guardedOpenAiCompatFetch(fetch), ...shaped.options, maxTokens: 512,
  });
  return { message, ms: Date.now() - started, wireId: shaped.model.id };
}

const textOf = (message) => message.content.filter((part) => part.type === "text").map((part) => part.text).join("").trim();
const errorOf = (message) => (message.stopReason === "error" ? String(message.errorMessage ?? "error").slice(0, 200) : "");

// 1) 모델 목록
let listed = [];
if (items.has("models")) {
  const response = await testOpenAiCompat({ baseUrl: base, apiKey: KEY || undefined, ...policy });
  listed = response.models;
  record("models", "GET /models", response.ok, `${response.message} (${response.latencyMs}ms)`);
  say(`        허용된 모델 ${listed.length}개${response.hiddenModels ? `, 패턴으로 숨김 ${response.hiddenModels}개` : ""}: ${listed.slice(0, 12).join(", ")}${listed.length > 12 ? " …" : ""}`);
}

// 호출할 모델 — 패턴에 막힌 것은 건너뛴다(호출 전에).
const callable = [];
for (const id of wanted) {
  const verdict = openAiCompatModelVerdict(policy, id);
  if (!verdict.allowed) { record("guard", id, true, `호출하지 않음 — ${verdict.reason}`); continue; }
  if (listed.length && !listed.includes(id)) say(`        주의: ${id} 는 모델 목록에 없습니다(그래도 시험합니다).`);
  callable.push(id);
}

// 2) 도구 호출 왕복 한 턴
if (items.has("turn")) {
  const tool = { name: "set_map_name", description: "Rename the current map.", parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } };
  for (const id of callable) {
    try {
      const first = await call(id, { tools: [tool], messages: [{ role: "user", content: [{ type: "text", text: "Call set_map_name with name 'live-test'. Do not answer in text." }], timestamp: Date.now() }] });
      const toolCall = first.message.content.find((part) => part.type === "toolCall");
      if (!toolCall) { record("turn", id, false, `도구 호출 없음 ${errorOf(first.message) || `(stop=${first.message.stopReason})`}`); continue; }
      const second = await call(id, {
        tools: [tool],
        messages: [
          { role: "user", content: [{ type: "text", text: "Call set_map_name with name 'live-test'. Do not answer in text." }], timestamp: Date.now() },
          first.message,
          { role: "toolResult", toolCallId: toolCall.id, toolName: toolCall.name, content: [{ type: "text", text: "ok: map renamed" }], isError: false, timestamp: Date.now() },
        ],
      });
      record("turn", id, second.message.stopReason !== "error", `1차 ${first.ms}ms 도구=${toolCall.name}(${JSON.stringify(toolCall.arguments)}) · 2차 ${second.ms}ms 답="${textOf(second.message).slice(0, 60)}" ${errorOf(second.message)}`);
    } catch (error) { record("turn", id, false, String(error?.message ?? error).slice(0, 200)); }
  }
}

// 3) 추론 강도 세 방식 — 서버가 어느 방식을 받는지 실측한다.
if (items.has("effort")) {
  for (const id of callable) {
    for (const mode of ["none", "field", "suffix"]) {
      try {
        const result = await call(id, { mode, level: "high" });
        const err = errorOf(result.message);
        record("effort", `${id} · ${mode}`, !err, `${result.ms}ms 모델=${result.wireId} ${err || `답="${textOf(result.message).slice(0, 30)}"`}`);
      } catch (error) { record("effort", `${id} · ${mode}`, false, String(error?.message ?? error).slice(0, 200)); }
    }
    // 이미 접미사가 붙은 ID 는 suffix 방식에서 그대로 남는다 — 확인용 한 줄.
    say(`        접미사 변환 예: ${openAiCompatSuffixedModelId(id, "high")}`);
  }
}

// 4) 이미지 입력 — 1x1 PNG 한 장.
if (items.has("image")) {
  const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  for (const id of callable) {
    try {
      const result = await call(id, { images: true, messages: [{ role: "user", content: [{ type: "image", data: PNG, mimeType: "image/png" }, { type: "text", text: "What is in this image? One short sentence." }], timestamp: Date.now() }] });
      const err = errorOf(result.message);
      record("image", id, !err, `${result.ms}ms ${err || `답="${textOf(result.message).slice(0, 60)}"`}`);
    } catch (error) { record("image", id, false, String(error?.message ?? error).slice(0, 200)); }
  }
}

const failed = results.filter((entry) => !entry.ok).length;
say(`\n요약: ${results.length - failed}/${results.length} 통과${failed ? ` · 실패 ${failed}` : ""}`);
process.exit(failed ? 1 : 0);
