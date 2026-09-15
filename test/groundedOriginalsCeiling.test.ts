// 한 요청에 인라인하는 원본 근거의 상한 — 실측 근거로 고정한다.
//
// 왜(2026-09-16 라이브 실측): 인텐트가 선언된 DB 턴은 639 엔트리 / 입력 419,153 토큰을
// 매 라운드 보냈고(툴 스키마 90,193 포함), 그 턴은 라운드 예산을 다 쓰고 검토 단계에
// 정착하지 못했다. 같은 프로젝트를 인텐트 없이 추출하면 116 엔트리 / 143,877 토큰이었다.
// 상한은 창(window)이 아니라 한 요청의 인라인 양을 제한한다 — 제외분은 매니페스트로 남아
// `get_original_context` 로 페이지되므로 근거가 사라지지 않는다.
import { describe, expect, it } from "vitest";
import { OriginalContextStore, type OriginalContext } from "@/ai/originalContext";
import { buildGroundedRequest, GROUNDED_ORIGINALS_TOKEN_CEILING } from "@/ai/contextBuilder";
import { toOpenAiTools } from "@/editor/tools";
import type { ChatMessage } from "@/ai/llmClient";

function storeWith(count: number, charsPerEntry: number): OriginalContextStore {
  const context: OriginalContext = {
    snapshotId: "ceiling-fixture",
    target: { mapId: "map", selection: null },
    entries: Array.from({ length: count }, (_, index) => ({
      id: `/records/record_${index}`,
      value: { id: `record_${index}`, body: "x".repeat(charsPerEntry) },
      reads: [],
    })),
    missing: [],
  };
  return new OriginalContextStore(context);
}

const messages: ChatMessage[] = [
  { role: "system", content: "System" },
  { role: "user", content: "슬라임의 최대 HP를 300으로 바꿔줘" },
];

const build = (store: OriginalContextStore) =>
  buildGroundedRequest(messages, toOpenAiTools(), { model: "gemini-3.7-flash", baseUrl: "x" }, store);

describe("그라운딩 원본 인라인 상한", () => {
  it("창이 커도 한 요청에 상한을 넘겨 인라인하지 않는다", () => {
    const store = storeWith(400, 2000);
    const result = build(store);
    const originalTokens = result.budget.inputTokens - result.budget.toolsTokens;
    expect(originalTokens).toBeLessThanOrEqual(GROUNDED_ORIGINALS_TOKEN_CEILING + 20_000);
    expect(result.includedIds.length).toBeGreaterThan(0);
    expect(result.includedIds.length).toBeLessThan(store.context.entries.length);
  });

  it("제외된 근거는 매니페스트에 남는다 — 없애지 않고 미룬다", () => {
    const store = storeWith(400, 2000);
    const result = build(store);
    const manifest = JSON.parse(result.messages.at(-1)!.content as string).originalContext;
    expect(manifest.omitted.count).toBeGreaterThan(0);
    expect(manifest.omitted.count + result.includedIds.length).toBe(store.context.entries.length);
  });

  it("상한보다 작은 프로젝트는 전부 인라인한다 — 조용히 줄이지 않는다", () => {
    const store = storeWith(3, 100);
    const result = build(store);
    expect(result.includedIds.length).toBe(store.context.entries.length);
  });
});
