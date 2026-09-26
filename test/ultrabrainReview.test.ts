import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { defaultAiConfig, loadAiConfig, saveAiConfig } from "@/ai/llmClient";
import { configForUltrabrain, ULTRABRAIN_REVIEW_MAX_TOKENS } from "@/ai/ultrabrainConfig";
import { HARMONY_REVIEW_CONCURRENCY, mapScopeNote, parseHarmonyReview, reviewMapHarmony, unresolvedReviewSignature, unusableReviewReason } from "@/ai/ultrabrainReview";
import { appendToTree } from "@/project/mapTree";

const mocks = vi.hoisted(() => ({ chat: vi.fn(), render: vi.fn() }));
vi.mock("@/ai/llmClient", async importOriginal => ({ ...await importOriginal<typeof import("@/ai/llmClient")>(), chatCompletion: mocks.chat }));
vi.mock("@/ai/ultrabrainImage", () => ({ renderHarmonyMapImages: mocks.render }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.render.mockResolvedValue([{ dataUrl: "data:image/png;base64,AA==", label: "whole" }]);
  mocks.chat.mockResolvedValue({ finishReason: "stop", message: { content: JSON.stringify({ harmonious: true, summary: "전체 배치가 어울립니다.", findings: [] }) }, imageDelivery: [{ messageIndex: 1, partIndex: 1 }] });
});
afterEach(() => vi.unstubAllGlobals());

describe("Ultrabrain whole-map review", () => {
  it("keeps model and effort independent and round-trips explicit choices without substitution", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v) });
    const config = defaultAiConfig();
    expect(configForUltrabrain({ ...config, model: "other", reasoningEffort: "low" })).toMatchObject({ model: "gemini-3.8-flash", reasoningEffort: "high" });
    saveAiConfig({ ...config, model: "unknown-explicit", ultrabrainProviderId: "openai-codex", ultrabrainModel: "gpt-5.5", ultrabrainReasoningEffort: "medium" });
    expect(loadAiConfig()).toMatchObject({ model: "unknown-explicit", ultrabrainProviderId: "openai-codex", ultrabrainModel: "gpt-5.5", ultrabrainReasoningEffort: "medium" });
  });

  it("skips unchanged maps but reviews the whole map after even a one-tile edit", async () => {
    const before = createBlankProject();
    await reviewMapHarmony(before, before, "나무 수정", defaultAiConfig());
    expect(mocks.chat).not.toHaveBeenCalled();
    const after = structuredClone(before);
    const map = Object.values(after.maps)[0]!;
    map.lowerTiles[0] = (map.lowerTiles[0] ?? 0) + 1;
    await reviewMapHarmony(before, after, "나무 수정", defaultAiConfig());
    expect(mocks.render).toHaveBeenCalledWith(after, map);
    // 맵당 한 번 — 같은 이미지를 Vision 으로 먼저 한 번 더 보내지 않는다.
    expect(mocks.chat).toHaveBeenCalledTimes(1);
    const [config, request] = mocks.chat.mock.calls[0]!;
    expect(request.messages[0].content).toContain("You are Ultrabrain");
    expect(config).toMatchObject({ model: "gemini-3.8-flash", reasoningEffort: "high" });
    expect(request.messages[1].content.filter((p: { type: string }) => p.type === "image_url")).toHaveLength(1);
    expect(JSON.stringify(before)).not.toBe(JSON.stringify(after));
  });


  // 2026-09-18: 검수기에 요청 문장 전체를 맵마다 그대로 들이댔더니, 「여관 하나와 집 두 채가 있는
  // 마을을 만들어줘」 턴에 딸려 만들어진 집 실내가 «마을 외경 요청과 달리 단일 주택 내부라
  // 부합하지 않는다 — 실외 맵으로 재구성하라» 로 불합격했다. 고칠 수 없는 판정이라 수리 2회
  // 동안 글자 하나 안 바뀌고 반복됐고 턴이 끝나지 않았다.
  it("맵마다 «요청과 안 맞는다»를 못 적게 한다 — 한 요청이 여러 맵을 만든다", async () => {
    const before = createBlankProject();
    const after = structuredClone(before);
    const map = Object.values(after.maps)[0]!;
    map.lowerTiles[0] = (map.lowerTiles[0] ?? 0) + 1;
    await reviewMapHarmony(before, after, "마을 만들어줘", defaultAiConfig());
    for (const [, request] of mocks.chat.mock.calls) {
      const system = request.messages[0].content as string;
      expect(system, "범위 지적 금지를 건다").toMatch(/never report that the (map|image) is the wrong scene/i);
    }
    const brainSystem = mocks.chat.mock.calls[0]![1].messages[0].content as string;
    expect(brainSystem, "요청 부합 판정을 조화 기준에서 뺀다").not.toContain("fit to the user's request");
    const payload = JSON.parse(mocks.chat.mock.calls[0]![1].messages[1].content[0].text as string) as Record<string, unknown>;
    expect(payload.mapScope, "이 맵이 요청의 한 부분임을 알려 준다").toContain("요청 전체를 혼자 담지 않는다");
  });

  it("mapScopeNote 는 맵 트리 부모를 이름으로 알려 준다", () => {
    const project = createBlankProject();
    const parentId = project.startMapId;
    const child = structuredClone(project.maps[parentId]!);
    child.id = "map_child";
    child.name = "여관 2층";
    project.maps.map_child = child;
    project.maps[parentId]!.name = "초록바람 마을";
    appendToTree(project.mapTree, "map_child", parentId);
    expect(mapScopeNote(project, "map_child")).toContain("「초록바람 마을」의 하위 맵");
    expect(mapScopeNote(project, parentId)).toContain("여러 맵 중 하나일 수 있다");
  });

  it("mapIds 를 주면 그 맵만 본다 — 수리 뒤 재검수가 손대지 않은 맵을 다시 그리지 않는다", async () => {
    const before = createBlankProject();
    const after = structuredClone(before);
    const first = Object.values(after.maps)[0]!;
    const second = structuredClone(first);
    second.id = "map_second";
    second.lowerTiles[0] = (second.lowerTiles[0] ?? 0) + 7;
    after.maps.map_second = second;
    first.lowerTiles[0] = (first.lowerTiles[0] ?? 0) + 1;

    await reviewMapHarmony(before, after, "…", defaultAiConfig());
    expect(mocks.render, "기본은 바뀐 맵 전부").toHaveBeenCalledTimes(2);

    mocks.render.mockClear();
    mocks.chat.mockClear();
    await reviewMapHarmony(before, after, "…", defaultAiConfig(), { mapIds: new Set(["map_second"]) });
    expect(mocks.render).toHaveBeenCalledTimes(1);
    expect(mocks.render.mock.calls[0]![1].id).toBe("map_second");
  });

  it("맵 여러 장은 동시에 검수하되 결과 순서는 맵 순서다", async () => {
    const before = createBlankProject();
    const after = structuredClone(before);
    const first = Object.values(after.maps)[0]!;
    first.lowerTiles[0] = (first.lowerTiles[0] ?? 0) + 1;
    // **상한보다 맵을 하나 더 만든다** — 그래야 «상한 제거» 회귀가 peak 로 드러난다(2026-09-26 리뷰 R1).
    // 상한(6) 이하의 맵만 두면 `Promise.all(targets.map(reviewOne))` 같은 회귀가 두 단언을 모두 통과한다
    // (예전에는 상한 3 + 맵 4 였아서 우연히 잡혔는데, 상수를 올리자 그 커버리지가 조용히 사라졌다).
    const targetMaps = HARMONY_REVIEW_CONCURRENCY + 1;
    for (let i = Object.keys(after.maps).length; i < targetMaps; i += 1) {
      const copy = structuredClone(first);
      copy.id = `map_extra_${i}`;
      after.maps[copy.id] = copy;
    }
    let inFlight = 0;
    let peak = 0;
    const ok = { finishReason: "stop", message: { content: JSON.stringify({ harmonious: true, summary: "어울립니다.", findings: [] }) }, imageDelivery: [{ messageIndex: 1, partIndex: 1 }] };
    mocks.chat.mockImplementation(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise(resolve => setTimeout(resolve, 5));
      inFlight -= 1;
      return ok;
    });
    const reviews = await reviewMapHarmony(before, after, "…", defaultAiConfig());
    expect(reviews.map(review => review.mapId)).toEqual(Object.keys(after.maps));
    // 상한 계약: 동시에 묻되 상수를 넘지 않고, 맵이 상한보다 적으면 전부 동시에 뜬다.
    // (2026-09-26 실측으로 상한을 3 → 6 으로 올렸다 — 6 동시가 직렬화되지 않음을 확인했다.
    //  숫자를 박아 두면 상수를 바꿀 때마다 계약이 아니라 픽스처가 깨진다.)
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThanOrEqual(HARMONY_REVIEW_CONCURRENCY);
    expect(peak).toBe(Math.min(HARMONY_REVIEW_CONCURRENCY, Object.keys(after.maps).length));
  });

  it("unresolvedReviewSignature 는 통과한 맵을 빼고 순서에 흔들리지 않는다", () => {
    const ok = { mapId: "a", harmonious: true, summary: "좋다", findings: [] };
    const bad = { mapId: "b", harmonious: false, summary: "나쁘다", findings: ["x", "y"] };
    const other = { mapId: "c", harmonious: false, summary: "나쁘다", findings: ["z"] };
    expect(unresolvedReviewSignature([ok, bad, other])).toBe(unresolvedReviewSignature([other, bad, ok]));
    expect(unresolvedReviewSignature([ok, bad])).not.toBe(unresolvedReviewSignature([ok, other]));
    // 통과한 맵이 늘어나도 «안 풀린 지적» 은 그대로 — 수리가 진전을 냈는지만 본다.
    expect(unresolvedReviewSignature([bad])).toBe(unresolvedReviewSignature([bad, ok]));
    expect(unresolvedReviewSignature([ok])).toBe("");
  });

  // 2026-09-18 실측: `high` 추론 한 번이 출력 예산 4096 을 다 써 JSON 을 못 뱉었고(`finish=length`),
  // 재시도가 같은 예산이라 같은 자리에서 또 끊겨 마을 턴 전체가 「끝까지 검수하지 못했어요」로 끝났다.
  it("예산이 모자라 끊긴 응답은 예산을 넓혀 다시 묻는다", async () => {
    const before = createBlankProject(), after = structuredClone(before);
    const map = Object.values(after.maps)[0]!;
    map.lowerTiles[0] = (map.lowerTiles[0] ?? 0) + 1;
    const ok = { finishReason: "stop", message: { content: JSON.stringify({ harmonious: true, summary: "어울립니다.", findings: [] }) }, imageDelivery: [{ messageIndex: 1, partIndex: 1 }] };
    // 첫 호출이 length 로 끊긴다.
    mocks.chat.mockResolvedValueOnce({ finishReason: "length", message: { content: "" }, imageDelivery: [{ messageIndex: 1, partIndex: 1 }] })
      .mockResolvedValue(ok);
    await reviewMapHarmony(before, after, "…", defaultAiConfig());
    const budgets = mocks.chat.mock.calls.map(([config]) => (config as { maxTokens: number }).maxTokens);
    expect(budgets[0], "첫 검수 예산은 상수 그대로").toBe(ULTRABRAIN_REVIEW_MAX_TOKENS);
    expect(budgets[1], "끊긴 뒤 재시도는 예산을 넓힌다").toBeGreaterThan(budgets[0]!);
  });

  it("끊김이 아닌 실패는 같은 예산으로 다시 묻는다 — 일시 오류이기 때문", async () => {
    const before = createBlankProject(), after = structuredClone(before);
    const map = Object.values(after.maps)[0]!;
    map.lowerTiles[0] = (map.lowerTiles[0] ?? 0) + 1;
    const ok = { finishReason: "stop", message: { content: JSON.stringify({ harmonious: true, summary: "어울립니다.", findings: [] }) }, imageDelivery: [{ messageIndex: 1, partIndex: 1 }] };
    mocks.chat.mockResolvedValueOnce({ finishReason: "stop", message: { content: "" }, imageDelivery: [{ messageIndex: 1, partIndex: 1 }] })
      .mockResolvedValue(ok);
    await reviewMapHarmony(before, after, "…", defaultAiConfig());
    const budgets = mocks.chat.mock.calls.map(([config]) => (config as { maxTokens: number }).maxTokens);
    expect(budgets[1]).toBe(budgets[0]);
  });

  it("refuses missing image delivery, truncated output, inconsistent verdicts, and cancellation", async () => {
    const before = createBlankProject(), after = structuredClone(before);
    Object.values(after.maps)[0]!.lowerTiles[0] = 123;
    mocks.chat.mockResolvedValue({ finishReason: "stop", message: { content: "{}" } });
    await expect(reviewMapHarmony(before, after, "검수", defaultAiConfig())).rejects.toThrow("imageDelivery=");
    mocks.chat.mockResolvedValue({ finishReason: "length", message: { content: "{}" }, imageDelivery: [{ messageIndex: 1, partIndex: 1 }] });
    await expect(reviewMapHarmony(before, after, "검수", defaultAiConfig())).rejects.toThrow("finish=length");
    expect(() => parseHarmonyReview('{"harmonious":true,"summary":"ok","findings":["bad"]}', "m")).toThrow();
    await expect(reviewMapHarmony(before, after, "검수", defaultAiConfig(), { signal: AbortSignal.abort() })).rejects.toThrow();
  });

  it("names the exact unusable condition instead of blaming the image path", () => {
    const ok = { message: { role: "assistant" as const, content: "{}" }, finishReason: "stop", imageDelivery: [{ messageIndex: 1, partIndex: 1 }] };
    expect(unusableReviewReason(ok)).toBeNull();
    expect(unusableReviewReason({ ...ok, finishReason: "length" })).toBe("finish=length");
    expect(unusableReviewReason({ ...ok, message: { role: "assistant" as const, content: "" } })).toBe("content=비어 있음");
    expect(unusableReviewReason({ ...ok, message: { role: "assistant" as const, content: [{ type: "text" as const, text: "x" }] } })).toBe("contentType=object");
    expect(unusableReviewReason({ ...ok, imageDelivery: [] })).toBe("imageDelivery=[]");
    expect(unusableReviewReason({ ...ok, message: { role: "assistant" as const, content: "{}", tool_calls: [{ id: "call_1", type: "function" as const, function: { name: "x", arguments: "{}" } }] } })).toBe("toolCalls=1");
  });

  it("retries a response that came back without final output and still accepts the verdict", async () => {
    const before = createBlankProject(), after = structuredClone(before);
    Object.values(after.maps)[0]!.lowerTiles[0] = 123;
    mocks.chat
      .mockResolvedValueOnce({ finishReason: "stop", message: { content: "" }, imageDelivery: [{ messageIndex: 1, partIndex: 1 }] })
      .mockResolvedValue({ finishReason: "stop", message: { content: JSON.stringify({ harmonious: true, summary: "어울립니다.", findings: [] }) }, imageDelivery: [{ messageIndex: 1, partIndex: 1 }] });
    const reviews = await reviewMapHarmony(before, after, "검수", defaultAiConfig());
    expect(reviews).toHaveLength(1);
    expect(reviews[0]).toMatchObject({ harmonious: true });
    expect(mocks.chat).toHaveBeenCalledTimes(2);
  });

  it("does not retry after cancellation", async () => {
    const before = createBlankProject(), after = structuredClone(before);
    Object.values(after.maps)[0]!.lowerTiles[0] = 123;
    const controller = new AbortController();
    mocks.chat.mockImplementation(async () => {
      controller.abort();
      return { finishReason: "stop", message: { content: "" }, imageDelivery: [{ messageIndex: 1, partIndex: 1 }] };
    });
    await expect(reviewMapHarmony(before, after, "검수", defaultAiConfig(), { signal: controller.signal })).rejects.toThrow();
    expect(mocks.chat).toHaveBeenCalledTimes(1);
  });

  it("cancels a pending image load without calling the reviewer", async () => {
    const before = createBlankProject(), after = structuredClone(before);
    Object.values(after.maps)[0]!.lowerTiles[0] = 123;
    mocks.render.mockReturnValue(new Promise(() => {}));
    const controller = new AbortController();
    const pending = reviewMapHarmony(before, after, "검수", defaultAiConfig(), { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toThrow();
    expect(mocks.chat).not.toHaveBeenCalled();
  });
});
