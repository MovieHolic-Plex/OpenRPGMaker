// test/contextCompaction.test.ts
// senpi(@code-yeongyu/senpi) 의 컨텍스트 압축 알고리즘 이식 검증.
// 원본: dist/core/compaction/compaction.js(추정/절단/임계), dist/core/compaction/utils.js(요약 프롬프트),
//      dist/core/extensions/builtin/compaction/retained-message-safety.js(잔존 창 재생 가능성).
// 여기서 잠그는 것은 "숫자와 구조" 다 — 프롬프트 문장은 절대 고정하지 않는다(문구는 자유롭게 고쳐야 한다).

import { describe, expect, it } from "vitest";
import {
  COMPACTION_SUMMARY_MARKER,
  DEFAULT_COMPACTION_SETTINGS,
  DEFAULT_CONTEXT_WINDOW,
  buildCompactedMessages,
  buildSummarizationRequest,
  compactionSummaryMessage,
  estimateContextTokens,
  estimateMessageTokens,
  findCompactionCutPoint,
  findPreviousSummary,
  isCompactionSummaryMessage,
  repairRetainedTail,
  resolveContextWindow,
  resolveThresholdContextTokens,
  shouldCompact,
} from "@/ai/contextCompaction";
import type { ChatMessage } from "@/ai/llmClient";

function userText(text: string): ChatMessage {
  return { role: "user", content: text };
}

function assistantText(text: string): ChatMessage {
  return { role: "assistant", content: text };
}

function assistantToolCall(id: string, name = "edit_tile", args = '{"x":1,"y":2}'): ChatMessage {
  return { role: "assistant", content: null, tool_calls: [{ id, type: "function", function: { name, arguments: args } }] };
}

function toolResult(id: string, content: string): ChatMessage {
  return { role: "tool", content, tool_call_id: id };
}

/** 공백으로 끊긴 산문 — base64 런(512자 이상 연속) 조건에 걸리지 않는다. */
function prose(chars: number): string {
  return "word ".repeat(Math.ceil(chars / 5)).slice(0, chars);
}

describe("estimateMessageTokens", () => {
  it("Given 같은 문자 수의 base64 런과 산문 When 추정 Then base64 쪽이 더 크게 잡힌다", () => {
    const base64Message = userText("A".repeat(2000));
    const proseMessage = userText(prose(2000));

    // base64 런은 문자당 1토큰에 가깝다 → 가중치 4배 후 /4. 순수 chars/4 구현이면 둘이 같아져 실패한다.
    expect(estimateMessageTokens(base64Message)).toBe(2000);
    expect(estimateMessageTokens(proseMessage)).toBe(500);
    expect(estimateMessageTokens(base64Message)).toBeGreaterThan(estimateMessageTokens(proseMessage));
  });

  it("Given base64 데이터 URL 이 실린 user 메시지 When 추정 Then 같은 길이 산문보다 크다", () => {
    const dataUrl = `data:image/png;base64,${"Q".repeat(2000)}`;
    const imageLike = userText(dataUrl);
    const sameLengthProse = userText(prose(dataUrl.length));

    expect(estimateMessageTokens(imageLike)).toBeGreaterThan(estimateMessageTokens(sameLengthProse));
  });

  it("Given 짧은 런(512자 미만) When 추정 Then 가중치가 붙지 않는다", () => {
    expect(estimateMessageTokens(userText("A".repeat(400)))).toBe(100);
  });

  it("Given image_url 파트 When 추정 Then URL 길이와 무관하게 ESTIMATED_IMAGE_CHARS(4800) 로 센다", () => {
    const shortUrl: ChatMessage = {
      role: "user",
      content: [{ type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } }],
    };
    const longUrl: ChatMessage = {
      role: "user",
      content: [{ type: "image_url", image_url: { url: `data:image/png;base64,${"B".repeat(20000)}` } }],
    };

    expect(estimateMessageTokens(shortUrl)).toBe(1200);
    expect(estimateMessageTokens(longUrl)).toBe(1200);
  });

  it("Given assistant tool_calls When 추정 Then 이름 + 인자를 센다", () => {
    const args = `{"blob":"${"C".repeat(1000)}"}`;
    const message = assistantToolCall("call_1", "paint", args);

    // 이름(5) + 가중치 인자(1000자 런 → 4000, 그 밖의 구두점 문자)를 /4 로 올림.
    expect(estimateMessageTokens(message)).toBeGreaterThan(1000);
    expect(estimateMessageTokens(assistantToolCall("call_1", "paint", '{"x":1}'))).toBeLessThan(10);
  });

  it("Given content null When 추정 Then 0", () => {
    expect(estimateMessageTokens({ role: "assistant", content: null })).toBe(0);
  });
});

describe("estimateContextTokens", () => {
  it("Given 메시지 목록과 추가 문자 When 추정 Then 메시지 합 + 추가분/4", () => {
    const messages = [userText(prose(400)), assistantText(prose(800))];

    expect(estimateContextTokens(messages)).toBe(100 + 200);
    expect(estimateContextTokens(messages, 4000)).toBe(100 + 200 + 1000);
  });
});

describe("resolveThresholdContextTokens", () => {
  it("Given 통상 usage 와 estimate When 해석 Then 큰 쪽", () => {
    expect(resolveThresholdContextTokens(30_000, 20_000)).toBe(30_000);
    expect(resolveThresholdContextTokens(10_000, 120_000)).toBe(120_000);
    expect(resolveThresholdContextTokens(200_000, 10_000)).toBe(200_000);
  });

  it("Given estimate 60000 에 usage 600000(cacheRead 스파이크) When 해석 Then estimate 를 쓴다", () => {
    expect(resolveThresholdContextTokens(600_000, 60_000)).toBe(60_000);
  });

  it("Given 음수 When 해석 Then 0 으로 클램프", () => {
    expect(resolveThresholdContextTokens(-5, -7)).toBe(0);
  });
});

describe("shouldCompact", () => {
  const settings = DEFAULT_COMPACTION_SETTINGS;
  const window = DEFAULT_CONTEXT_WINDOW;
  const threshold = window - settings.reserveTokens;

  it("Given 정확히 임계값 When 판정 Then false, +1 이면 true", () => {
    expect(shouldCompact(threshold, window, settings)).toBe(false);
    expect(shouldCompact(threshold + 1, window, settings)).toBe(true);
  });

  it("Given enabled:false When 판정 Then 항상 false", () => {
    expect(shouldCompact(window * 2, window, { ...settings, enabled: false })).toBe(false);
  });
});

describe("기본값 / 컨텍스트 창", () => {
  it("Given 기본 설정 When 읽기 Then senpi 기본값과 같다", () => {
    expect(DEFAULT_COMPACTION_SETTINGS).toEqual({ enabled: true, reserveTokens: 16_384, keepRecentTokens: 20_000 });
    expect(DEFAULT_CONTEXT_WINDOW).toBe(128_000);
  });

  it("Given 모르는 모델 When 해석 Then 보수적 기본 창", () => {
    expect(resolveContextWindow("made-up-model-9")).toBe(DEFAULT_CONTEXT_WINDOW);
    expect(resolveContextWindow("")).toBe(DEFAULT_CONTEXT_WINDOW);
  });

  it("Given 알려진 모델 When 해석 Then 기본 창보다 크다", () => {
    expect(resolveContextWindow("gemini-3.7-flash")).toBeGreaterThan(DEFAULT_CONTEXT_WINDOW);
    expect(resolveContextWindow("cpen/gpt-5-6-luna")).toBeGreaterThan(DEFAULT_CONTEXT_WINDOW);
  });
});

describe("findCompactionCutPoint", () => {
  it("Given tool 메시지에서 예산이 넘치는 대화 When 절단점 탐색 Then tool 에는 절대 착지하지 않는다", () => {
    const messages: ChatMessage[] = [
      { role: "system", content: "시스템" },
      userText("옛 지시"),
      assistantText("옛 답"),
      userText("현재 지시"),
      assistantToolCall("call_1"),
      toolResult("call_1", prose(40_000)), // 10,000 토큰
      assistantText("최종 답"),
    ];

    const cut = findCompactionCutPoint(messages, 1000);

    expect(messages[cut.firstKeptIndex]?.role).not.toBe("tool");
    expect(cut.firstKeptIndex).toBeGreaterThanOrEqual(1);
  });

  it("Given 균일한 대화 When keepRecentTokens 로 절단 Then 그만큼의 꼬리가 남고 앞은 버려진다", () => {
    const messages: ChatMessage[] = [{ role: "system", content: "시스템" }];
    for (let turn = 0; turn < 10; turn += 1) {
      messages.push(userText(prose(1000))); // 250 토큰
      messages.push(assistantText(prose(1000))); // 250 토큰
    }

    const cut = findCompactionCutPoint(messages, 1000);
    const tail = messages.slice(cut.firstKeptIndex);

    expect(cut.firstKeptIndex).toBeGreaterThan(1);
    expect(estimateContextTokens(tail)).toBeGreaterThanOrEqual(1000);
    expect(messages[cut.firstKeptIndex]?.role).not.toBe("tool");
  });

  it("Given 시스템 프롬프트만 있는 대화 When 절단점 탐색 Then 인덱스 0 은 절단점이 되지 않는다", () => {
    const cut = findCompactionCutPoint([{ role: "system", content: "시스템" }], 1000);

    expect(cut.firstKeptIndex).toBeGreaterThanOrEqual(1);
    expect(cut.isSplitTurn).toBe(false);
  });

  it("Given assistant 에서 잘리는 경우 When 절단점 탐색 Then 그 턴을 시작한 user 를 가리키고 split 로 표시한다", () => {
    const messages: ChatMessage[] = [
      { role: "system", content: "시스템" },
      userText(prose(200)),
      userText("턴 시작"),
      assistantToolCall("call_1"),
      toolResult("call_1", "ok"),
      assistantText(prose(8000)), // 2000 토큰 — 여기서 예산이 넘친다
    ];

    const cut = findCompactionCutPoint(messages, 1000);

    expect(messages[cut.firstKeptIndex]?.role).toBe("assistant");
    expect(cut.isSplitTurn).toBe(true);
    expect(messages[cut.turnStartIndex]?.role).toBe("user");
    expect(cut.turnStartIndex).toBeLessThan(cut.firstKeptIndex);
  });

  it("Given user 에서 잘리는 경우 When 절단점 탐색 Then split 아님", () => {
    const messages: ChatMessage[] = [
      { role: "system", content: "시스템" },
      userText(prose(200)),
      assistantText(prose(200)),
      userText(prose(8000)),
    ];

    const cut = findCompactionCutPoint(messages, 1000);

    expect(messages[cut.firstKeptIndex]?.role).toBe("user");
    expect(cut.isSplitTurn).toBe(false);
    expect(cut.turnStartIndex).toBe(-1);
  });
});

describe("repairRetainedTail", () => {
  it("Given 선두 tool 과 짝 없는 tool When 수리 Then 둘 다 버리고 짝지어진 쌍은 남긴다", () => {
    const window: ChatMessage[] = [
      toolResult("call_before_window", "잘린 턴의 응답"),
      assistantToolCall("call_1"),
      toolResult("call_1", "정상 결과"),
      toolResult("call_orphan", "짝 없는 결과"),
      assistantText("답"),
    ];

    const repaired = repairRetainedTail(window);

    expect(repaired.map((message) => message.role)).toEqual(["assistant", "tool", "assistant"]);
    expect(repaired[1]?.tool_call_id).toBe("call_1");
  });

  it("Given tool_call_id 없는 tool 메시지 When 수리 Then 버린다", () => {
    const repaired = repairRetainedTail([{ role: "tool", content: "정체불명" }, userText("계속")]);

    expect(repaired.map((message) => message.role)).toEqual(["user"]);
  });

  it("Given 이미 재생 가능한 창 When 수리 Then 그대로 둔다", () => {
    const window: ChatMessage[] = [userText("지시"), assistantToolCall("call_1"), toolResult("call_1", "ok")];

    expect(repairRetainedTail(window)).toEqual(window);
  });
});

describe("압축 요약 메시지", () => {
  it("Given 요약 When 메시지화 Then 마커로 식별되고 본문을 되찾을 수 있다", () => {
    const message = compactionSummaryMessage("## Goal\n타일셋 정리");

    expect(isCompactionSummaryMessage(message)).toBe(true);
    expect(String(message.content)).toContain(COMPACTION_SUMMARY_MARKER);
    expect(findPreviousSummary([userText("무관"), message])).toBe("## Goal\n타일셋 정리");
  });

  it("Given 요약이 두 번 있는 대화 When 이전 요약 탐색 Then 최신 것", () => {
    const messages = [compactionSummaryMessage("첫 요약"), assistantText("작업"), compactionSummaryMessage("두 번째 요약")];

    expect(findPreviousSummary(messages)).toBe("두 번째 요약");
  });

  it("Given 요약이 없는 대화 When 탐색 Then null", () => {
    expect(findPreviousSummary([userText("지시"), assistantText("답")])).toBeNull();
  });

  it("Given 평범한 user 메시지 When 식별 Then false", () => {
    expect(isCompactionSummaryMessage(userText("평범한 지시"))).toBe(false);
  });
});

describe("buildCompactedMessages", () => {
  it("Given 절단점과 요약 When 재조립 Then 시스템 0번, 요약 1번, 그 뒤에 수리된 꼬리", () => {
    const system: ChatMessage = { role: "system", content: "시스템 프롬프트" };
    const messages: ChatMessage[] = [
      system,
      userText("옛 지시"),
      assistantToolCall("call_old"),
      toolResult("call_old", "옛 결과"),
      toolResult("call_old", "창 밖 짝의 결과"), // 절단 후 선두가 되는 tool → 버려진다
      userText("최근 지시"),
      assistantToolCall("call_new"),
      toolResult("call_new", "최근 결과"),
    ];

    const compacted = buildCompactedMessages({
      messages,
      cutPoint: { firstKeptIndex: 4, turnStartIndex: -1, isSplitTurn: false },
      summary: "## Goal\n계속하기",
    });

    expect(compacted[0]).toEqual(system);
    expect(isCompactionSummaryMessage(compacted[1])).toBe(true);
    expect(compacted.slice(2)).toEqual(repairRetainedTail(messages.slice(4)));
    expect(compacted.map((message) => message.role)).toEqual(["system", "user", "user", "assistant", "tool"]);
    expect(estimateContextTokens(compacted)).toBeLessThan(estimateContextTokens(messages) + 100);
  });

  it("Given 시스템 프롬프트가 없는 대화 When 재조립 Then 요약이 선두", () => {
    const messages: ChatMessage[] = [userText("지시"), assistantText("답"), userText("최근")];

    const compacted = buildCompactedMessages({
      messages,
      cutPoint: { firstKeptIndex: 2, turnStartIndex: -1, isSplitTurn: false },
      summary: "요약",
    });

    expect(isCompactionSummaryMessage(compacted[0])).toBe(true);
    expect(compacted).toHaveLength(2);
  });
});

describe("buildSummarizationRequest", () => {
  const source: ChatMessage[] = [
    { role: "system", content: "시스템 프롬프트는 요약 입력에 넣지 않는다" },
    userText("맵을 정리해줘"),
    { role: "assistant", content: "타일을 확인합니다", reasoning: "먼저 지도를 읽자" },
    assistantToolCall("call_1", "read_map", '{"mapId":"m1"}'),
    toolResult("call_1", "타일 결과"),
  ];

  it("Given 이전 요약 없음 When 요약 요청 구성 Then system + 직렬 대화 + 지시 3개", () => {
    const request = buildSummarizationRequest(source);

    expect(request.map((message) => message.role)).toEqual(["system", "user", "user"]);
    const conversation = String(request[1]?.content);
    expect(conversation).toContain("<conversation>");
    expect(conversation).toContain("맵을 정리해줘");
    expect(conversation).toContain("read_map");
    expect(conversation).not.toContain("<previous-summary>");
    expect(conversation).not.toContain("시스템 프롬프트는 요약 입력에 넣지 않는다");
  });

  it("Given 이전 요약 있음 When 요약 요청 구성 Then previous-summary 태그가 실리고 지시가 UPDATE 변형으로 바뀐다", () => {
    const fresh = buildSummarizationRequest(source);
    const updated = buildSummarizationRequest(source, "## Goal\n이미 정한 목표");

    const conversation = String(updated[1]?.content);
    expect(conversation).toContain("<previous-summary>");
    expect(conversation).toContain("## Goal\n이미 정한 목표");
    // 문구를 고정하지 않는다 — 분기가 갈렸다는 사실만 잠근다.
    expect(updated[2]?.content).not.toBe(fresh[2]?.content);
  });

  it("Given 아주 긴 tool 결과 When 직렬화 Then 잘려서 요약 요청이 폭주하지 않는다", () => {
    const request = buildSummarizationRequest([toolResult("call_1", prose(50_000))]);
    const conversation = String(request[1]?.content);

    expect(conversation.length).toBeLessThan(10_000);
  });
});
