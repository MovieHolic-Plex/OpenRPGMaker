// 사용자 지정(OpenAI 호환) 전송의 빈 답 지키기 — 2026-10-25 CLIProxyAPI(mdc-server:8318) 회귀.
// 이 서버는 이미지가 든 요청에 200 + 빈 내용(content:null, 도구 호출 없음, stop)을 돌려준다. 그대로 넘기면 조수가 아무 말 없이 턴을 끝냈다.
import { describe, expect, test } from "bun:test";
import {
  OPENAI_COMPAT_IMAGE_OMITTED_NOTE,
  guardedOpenAiCompatFetch,
  inspectChatReply,
  stripImageParts,
} from "../scripts/lib/openAiCompatModel.ts";
import { explainOpenAiCompatError } from "../src/ai/openAiCompat.ts";

const URL_ = "http://127.0.0.1:8318/v1/chat/completions";
const sse = (...events: string[]) => new Response(events.map((event) => `data: ${event}\n\n`).join(""), { headers: { "content-type": "text/event-stream" } });
const EMPTY_SSE = () => sse('{"choices":[{"delta":{"role":"assistant","content":null}}]}', '{"choices":[{"delta":{"content":null},"finish_reason":"stop"}]}', "[DONE]");
const TEXT_SSE = () => sse('{"choices":[{"delta":{"role":"assistant","content":null}}]}', '{"choices":[{"delta":{"content":"pong"}}]}', '{"choices":[{"delta":{},"finish_reason":"stop"}]}', "[DONE]");
const imageBody = JSON.stringify({
  model: "gemini-4-argon",
  stream: true,
  messages: [{ role: "user", content: [{ type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } }, { type: "image_url", image_url: { url: "data:image/png;base64,BBBB" } }, { type: "text", text: "what is this" }] }],
});
const textBody = JSON.stringify({ model: "gemini-4-argon", stream: true, messages: [{ role: "user", content: "hi" }] });

describe("inspectChatReply", () => {
  test("역할 조각과 stop 만 있는 스트림은 빈 답이다", async () => {
    expect((await inspectChatReply(EMPTY_SSE())).empty).toBe(true);
  });
  test("내용이 오면 모아 둔 조각부터 그대로 흘려보낸다", async () => {
    const { empty, response } = await inspectChatReply(TEXT_SSE());
    expect(empty).toBe(false);
    const text = await response.text();
    expect(text).toContain('"role":"assistant"');
    expect(text).toContain("pong");
    expect(text).toContain("[DONE]");
  });
  test("도구 호출·생각 조각도 내용으로 본다", async () => {
    expect((await inspectChatReply(sse('{"choices":[{"delta":{"tool_calls":[{"index":0,"id":"t","function":{"name":"x","arguments":"{}"}}]}}]}', "[DONE]"))).empty).toBe(false);
    expect((await inspectChatReply(sse('{"choices":[{"delta":{"reasoning_content":"hmm"}}]}', "[DONE]"))).empty).toBe(false);
  });
  test("JSON 본문도 본다", async () => {
    const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
    expect((await inspectChatReply(json({ choices: [{ message: { role: "assistant", content: null }, finish_reason: "stop" }] }))).empty).toBe(true);
    expect((await inspectChatReply(json({ choices: [{ message: { role: "assistant", content: "ok" } }] }))).empty).toBe(false);
  });
  test("200 이 아니면 건드리지 않는다", async () => {
    const response = new Response('{"error":"Missing API key"}', { status: 401 });
    const result = await inspectChatReply(response);
    expect(result.empty).toBe(false);
    expect(result.response).toBe(response);
  });
});

describe("stripImageParts", () => {
  test("이미지 자리를 「못 봤다」 글 한 줄로 바꾸고 글은 남긴다", () => {
    const stripped = JSON.parse(stripImageParts(imageBody) ?? "null");
    expect(stripped.messages[0].content).toEqual([{ type: "text", text: OPENAI_COMPAT_IMAGE_OMITTED_NOTE }, { type: "text", text: "what is this" }]);
  });
  test("이미지가 없으면 null", () => {
    expect(stripImageParts(textBody)).toBeNull();
  });
});

describe("guardedOpenAiCompatFetch 빈 답", () => {
  test("이미지 요청이 비면 이미지를 빼고 한 번 더 보낸다", async () => {
    const bodies: string[] = [];
    const base = (async (_input: unknown, init?: RequestInit) => {
      bodies.push(String(init?.body));
      return bodies.length === 1 ? EMPTY_SSE() : TEXT_SSE();
    }) as typeof fetch;
    const response = await guardedOpenAiCompatFetch(base)(URL_, { method: "POST", body: imageBody });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("pong");
    expect(bodies).toHaveLength(2);
    expect(bodies[1]).not.toContain("image_url");
    expect(bodies[1]).toContain(OPENAI_COMPAT_IMAGE_OMITTED_NOTE);
  });
  test("다시 보내도 비거나 이미지가 없으면 재시도되지 않는 오류(422)로 바꾼다", async () => {
    let calls = 0;
    const base = (async () => { calls += 1; return EMPTY_SSE(); }) as typeof fetch;
    const withImage = await guardedOpenAiCompatFetch(base)(URL_, { method: "POST", body: imageBody });
    expect(withImage.status).toBe(422);
    expect(calls).toBe(2);
    const textOnly = await guardedOpenAiCompatFetch(base)(URL_, { method: "POST", body: textBody });
    expect(textOnly.status).toBe(422);
    expect(calls).toBe(3);
    const message = (await textOnly.json() as { error: { message: string } }).error.message;
    expect(explainOpenAiCompatError(`422 ${message}`, { name: "CLIProxyAPI Argon" })).toContain("빈 답을 돌려줬어요");
  });
  test("채팅이 아닌 호출(/models)은 그대로 둔다", async () => {
    const base = (async () => new Response('{"data":[]}', { headers: { "content-type": "application/json" } })) as typeof fetch;
    const response = await guardedOpenAiCompatFetch(base)("http://127.0.0.1:8318/v1/models", { method: "GET" });
    expect(await response.text()).toBe('{"data":[]}');
  });
});

describe("explainOpenAiCompatError", () => {
  test("이름 풀이 실패는 Tailscale 대안 주소를 알려 준다", () => {
    expect(explainOpenAiCompatError("ENOTFOUND getaddrinfo mdc-server", { name: "x" })).toContain("*.ts.net");
  });
});
