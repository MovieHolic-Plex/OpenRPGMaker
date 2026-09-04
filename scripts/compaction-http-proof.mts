// scripts/compaction-http-proof.mts
// 대화 압축(contextCompaction)이 **실제 HTTP 경로**에서 동작하는지 증명하는 실증 스크립트.
//
// 왜 단위 테스트로 부족한가: 단위 테스트는 chat 함수를 주입해 llmClient 를 건너뛴다. 압축의
// 실패 모드는 대부분 "와이어에 실린 메시지 배열"에서 터진다 — 짝 없는 role:"tool" 응답,
// 시스템 프롬프트 유실, user 지시 삭제는 모두 공급자 400 이다. 그래서 이 스크립트는
// 루프백에 OpenAI 호환 서버를 띄우고 AssistantSession 이 **정말로 fetch 로 보낸 본문**을
// 서버 쪽에서 받아 검사한다.
//
// 실행: npx vite-node --script scripts/compaction-http-proof.mts
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { AssistantSession } from "@/ai/assistantSession";
import type { AiConfig, ChatMessage } from "@/ai/llmClient";
import {
  DEFAULT_COMPACTION_SETTINGS,
  SUMMARIZATION_SYSTEM_PROMPT,
  estimateContextTokens,
  isCompactionSummaryMessage,
  resolveContextWindow,
} from "@/ai/contextCompaction";
import { createBlankProject } from "@/project/defaults";

const SUMMARY_TEXT = [
  "## Goal",
  "아이스 그랜드 익스팬스 마을 저작을 계속한다.",
  "",
  "## Constraints & Preferences",
  "- 실내 맵은 villager-room-v1 파이프라인만 사용한다.",
  "",
  "## Progress",
  "### Done",
  "- [x] map_ice_village 바닥/도로 시공",
  "### In Progress",
  "- [ ] 주민 3명 배치",
  "### Blocked",
  "- (none)",
  "",
  "## Key Decisions",
  "- **author_village 사용**: 개별 author_house 보다 계약이 좁다.",
  "",
  "## Next Steps",
  "1. place_npc 로 주민 3명을 배치한다.",
  "",
  "## Critical Context",
  "- mapId: map_ice_village",
].join("\n");

interface CapturedRequest {
  readonly index: number;
  readonly bytes: number;
  readonly toolCount: number;
  readonly isSummarization: boolean;
  readonly roles: string[];
  readonly messages: ChatMessage[];
}

const captured: CapturedRequest[] = [];

function assistantReply(text: string): unknown {
  return {
    id: "chatcmpl-proof",
    object: "chat.completion",
    model: "gpt-4o-mini",
    choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }],
    usage: { prompt_tokens: 120_000, completion_tokens: 64, total_tokens: 120_064 },
  };
}

const server = createServer((req, res) => {
  let raw = "";
  req.on("data", (chunk) => {
    raw += chunk;
  });
  req.on("end", () => {
    const body = JSON.parse(raw) as { messages: ChatMessage[]; tools?: unknown[] };
    const first = body.messages[0];
    const isSummarization = typeof first?.content === "string" && first.content === SUMMARIZATION_SYSTEM_PROMPT;
    captured.push({
      index: captured.length + 1,
      bytes: Buffer.byteLength(raw),
      toolCount: body.tools?.length ?? 0,
      isSummarization,
      roles: body.messages.map((message) => message.role),
      messages: body.messages,
    });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(assistantReply(isSummarization ? SUMMARY_TEXT : "요약 이후 턴을 마쳤습니다.")));
  });
});

/** base64 런은 토큰당 문자 비율이 1에 가깝다 — 뷰포트 스크린샷이 컨텍스트를 폭파하는 실제 모양. */
function base64Blob(chars: number): string {
  return "A".repeat(chars);
}

function imageMessage(text: string, base64Chars: number): ChatMessage {
  return {
    role: "user",
    content: [
      { type: "text", text },
      { type: "image_url", image_url: { url: `data:image/png;base64,${base64Blob(base64Chars)}`, detail: "low" } },
    ],
  };
}

function toolResultMessage(id: string, chars: number): ChatMessage {
  return { role: "tool", tool_call_id: id, content: JSON.stringify({ ok: true, summary: "타일 시공", data: base64Blob(chars) }) };
}

function assistantToolCall(id: string, name: string): ChatMessage {
  return {
    role: "assistant",
    content: null,
    tool_calls: [{ id, type: "function", function: { name, arguments: JSON.stringify({ mapId: "map_ice_village" }) } }],
  };
}

function orphanToolMessages(messages: readonly ChatMessage[]): string[] {
  const calls = new Set<string>();
  for (const message of messages) {
    for (const call of message.tool_calls ?? []) calls.add(call.id);
  }
  return messages
    .filter((message) => message.role === "tool" && (!message.tool_call_id || !calls.has(message.tool_call_id)))
    .map((message) => message.tool_call_id ?? "(no id)");
}

async function main(): Promise<void> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  const config: AiConfig = {
    authMode: "apiKey",
    baseUrl: `http://127.0.0.1:${port}/v1`,
    model: "gpt-4o-mini",
    liteModel: "gpt-4o-mini",
    apiKey: "proof-key",
    maxToolCalls: 4,
    maxTokens: 1024,
    agentMode: "chat",
  };

  const session = new AssistantSession(createBlankProject(), { config });
  // 압축 대상 히스토리 주입: 뷰포트 이미지 8장 + 누적 툴 결과 8건 = 실제 자율 런의 모양.
  // 크기는 임계값(창 128000 - 예약 16384 = 111616 토큰)을 확실히 넘도록 잡는다.
  const seeded = session.getMessages() as ChatMessage[];
  for (let turn = 0; turn < 8; turn += 1) {
    seeded.push(imageMessage(`${turn + 1}번째 지시: 마을 남쪽에 집 두 채를 지어줘`, 16_000));
    seeded.push(assistantToolCall(`call_${turn}`, "author_village"));
    seeded.push(toolResultMessage(`call_${turn}`, 8_000));
    seeded.push({ role: "assistant", content: `${turn + 1}번째 턴 결과를 정리했습니다.` });
  }

  const before = estimateContextTokens(seeded);
  const window = resolveContextWindow(config.model);
  console.log("=== 압축 실증(실제 HTTP) ===");
  console.log(`엔드포인트           http://127.0.0.1:${port}/v1/chat/completions`);
  console.log(`모델 컨텍스트 윈도우 ${window} 토큰, 예약 ${DEFAULT_COMPACTION_SETTINGS.reserveTokens}, 유지 ${DEFAULT_COMPACTION_SETTINGS.keepRecentTokens}`);
  console.log(`압축 임계값          ${window - DEFAULT_COMPACTION_SETTINGS.reserveTokens} 토큰`);
  console.log(`주입 후 메시지        ${seeded.length}개 / 추정 ${before} 토큰`);

  const events: string[] = [];
  await session.sendUserMessage("주민 3명을 배치해줘", (event) => {
    if (event.type === "phase") events.push(`phase:${event.value}`);
  });

  const after = session.getMessages();
  const summarization = captured.filter((entry) => entry.isSummarization);
  const turnRequests = captured.filter((entry) => !entry.isSummarization);
  const lastTurnRequest = turnRequests.at(-1);

  console.log("");
  console.log(`서버가 받은 요청      ${captured.length}건 (요약 ${summarization.length}건 / 턴 ${turnRequests.length}건)`);
  for (const entry of captured) {
    console.log(`  #${entry.index} ${entry.isSummarization ? "요약" : "턴  "} bytes=${entry.bytes} tools=${entry.toolCount} roles=${entry.roles.join(",")}`);
  }

  console.log("");
  console.log(`압축 후 세션 메시지    ${after.length}개 / 추정 ${estimateContextTokens(after)} 토큰`);
  console.log(`system 프롬프트 index0 ${after[0]?.role === "system" ? "OK" : "FAIL"}`);
  const summaryIndex = after.findIndex((message) => isCompactionSummaryMessage(message));
  console.log(`요약 메시지 index      ${summaryIndex}`);
  console.log(`사용자 지시 보존        ${after.some((m) => JSON.stringify(m.content ?? "").includes("주민 3명을 배치해줘") ) ? "OK" : "FAIL"}`);

  if (lastTurnRequest) {
    const orphans = orphanToolMessages(lastTurnRequest.messages);
    console.log("");
    console.log(`마지막 턴 요청 roles   ${lastTurnRequest.roles.join(",")}`);
    console.log(`짝 없는 tool 응답      ${orphans.length === 0 ? "없음 OK" : `FAIL ${orphans.join(",")}`}`);
    console.log(`와이어 본문 크기        ${lastTurnRequest.bytes} bytes`);
  }

  const summaryText = summaryIndex >= 0 ? String(after[summaryIndex]?.content ?? "") : "";
  console.log("");
  console.log("--- 압축 요약 메시지 본문 ---");
  console.log(summaryText.slice(0, 900));

  const auditLines = session.getAuditEntries()
    .filter((entry) => entry.kind === "status" && String((entry as { text?: string }).text ?? "").includes("압축"))
    .map((entry) => String((entry as { text?: string }).text ?? ""));
  console.log("");
  console.log("--- 압축 감사 로그 ---");
  for (const line of auditLines) console.log(`  ${line}`);

  const pass =
    summarization.length === 1 &&
    after[0]?.role === "system" &&
    summaryIndex === 1 &&
    (lastTurnRequest ? orphanToolMessages(lastTurnRequest.messages).length === 0 : false) &&
    estimateContextTokens(after) < before;
  console.log("");
  console.log(`RESULT: ${pass ? "PASS" : "FAIL"}`);
  server.close();
  process.exit(pass ? 0 : 1);
}

await main();
