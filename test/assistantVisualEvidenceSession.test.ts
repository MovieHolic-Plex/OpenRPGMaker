// 2026-09-17 수용 원장 제거 — imageReviewed 수용 기준·review_acceptance 판정·수용 스냅샷 status 를 검증하던 테스트는 삭제했다.
// 남은 것은 시각 확인 영수증(show_map_region 이미지 전달 → adventureProblems) 의 무효화·유지 계약이다.
import { beforeEach, describe, expect, it } from "vitest";
import { AssistantSession, type SessionEvent, type ToolImageRenderer } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults";
import { fixedDeclarer } from "./intentFixture";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";

beforeEach(resetIntentDeclarationCache);

type Call = { readonly name: string; readonly args: Record<string, unknown> };
type Stop = "final" | "max-tool-calls" | "token-budget";
const image = { label: "Map render", dataUrl: "data:image/png;base64,AA==" };
function fixture(options: { readonly stop?: Stop; readonly render?: ToolImageRenderer; readonly requireBattle?: boolean } = {}) {
  const project = createBlankProject();
  const start = project.maps[project.startMapId];
  project.maps.second = { ...structuredClone(start), id: "second", name: "Second" };
  const maps = Object.values(project.maps);
  const plan: Call[] = [{ name: "set_work_plan", args: {
    goal: "Inspect both maps", layers: [{ title: "Inspect", items: [{ id: "work", title: "Inspect", instruction: "Inspect" }] }],
  } }, { name: "skip_work_item", args: {} }];
  const shows: Call[] = maps.map(map => ({ name: "show_map_region", args: { mapId: map.id, x: 0, y: 0, w: map.width, h: map.height } }));
  const dbWrite: Call[] = [{ name: "upsert_skill", args: { skill: { id: "visual_test_skill", name: "DB only" } } }];
  const rounds: Call[][] = [plan, shows, dbWrite];
  const events: SessionEvent[] = [];
  let round = 0;
  let deliveredImages = 0;
  const session = new AssistantSession(project, {
    config: { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test",
      // maxToolCalls 는 라운드 상한이다 — 마지막 스크립트 라운드(dbWrite) 직후 끊는다.
      maxToolCalls: options.stop === "max-tool-calls" ? rounds.length : 20, maxTokens: 10000 },
    declareIntent: fixedDeclarer({ mode: "modify", targetMapId: start.id, adventure: { village: false, dungeon: false, party: false, battle: options.requireBattle ?? false } }),
    renderImages: options.render ?? (async () => [image]),
    chat: async (_config, request): Promise<ChatResult> => {
      const imageDelivery = request.messages.flatMap((message, messageIndex) => Array.isArray(message.content)
        ? message.content.flatMap((part, partIndex) => part.type === "image_url" ? [{ messageIndex, partIndex }] : []) : []);
      deliveredImages = request.messages.flatMap(message => Array.isArray(message.content) ? message.content : []).filter(part => part.type === "image_url").length;
      const batch = rounds[round++];
      return batch ? { imageDelivery, message: { role: "assistant", content: null, tool_calls: batch.map((call, index) => ({ id: `c${round}_${index}`, type: "function", function: { name: call.name, arguments: JSON.stringify(call.args) } })) }, finishReason: "tool_calls",
        usage: { prompt_tokens: 1, completion_tokens: options.stop === "token-budget" && round === rounds.length ? 10000 : 0, total_tokens: 1 } }
        : { imageDelivery, message: { role: "assistant", content: "SCRIPTED_FINAL" }, finishReason: "stop" };
    },
  });
  return { project, session, events, rounds, shows, deliveredImages: () => deliveredImages,
    run: () => session.sendUserMessage("Inspect both authored maps", event => events.push(event)) };
}

describe("one visual evidence lifecycle", () => {
  it.each<Stop>(["final", "max-tool-calls", "token-budget"])("preserves delivered map images after a DB-only write at %s termination", async stop => {
    // Given two delivered maps followed by a real non-rendering DB tool.
    const f = fixture({ stop });
    // When the session terminates normally or through either execution budget.
    const result = await f.run();
    // Then the image receipts stay current — a DB-only write does not retire them.
    expect(f.events.find(event => event.type === "tool_call" && event.name === "upsert_skill")).toMatchObject({ result: { ok: true } });
    expect(f.session.getProposedProject().database.skills.some(skill => skill.id === "visual_test_skill")).toBe(true);
    expect(f.deliveredImages()).toBe(2);
    expect(f.session["adventureProblems"]()).toEqual([]);
    // 2026-09-17: 예산 소진은 더 이상 초안 폐기가 아니다 — 결정적 검사(lint error 0)를 통과하면 final 로 바뀌어 적용된다.
    expect(result.stoppedReason).toBe("final");
    expect(result.review?.status).toBe("approved");
    if (stop !== "final") expect(result.assistantText).toContain("예산이 소진되어 여기까지의 초안을 적용합니다");
    else expect(result.assistantText).not.toContain("예산이 소진되어");
  });

  it.each(["empty", "failed"])("does not credit metadata when rendering is %s", async mode => {
    // Given successful map metadata but no delivered rendered image.
    const f = fixture({ render: async () => { if (mode === "failed") throw new Error("Render failed"); return []; } });
    f.rounds.pop();
    // When the model attempts to finalize.
    const result = await f.run();
    // Then metadata alone is not visual coverage — both maps stay reported as unconfirmed.
    expect(f.deliveredImages()).toBe(0);
    expect(f.session["adventureProblems"]()).toHaveLength(2);
    expect(result.assistantText).not.toBe("SCRIPTED_FINAL");
  });
});

describe("visual evidence invalidation boundaries", () => {
  it("invalidates only the changed map after a real resize and does not revive it on undo", async () => {
    // Given both maps delivered before one map is resized by the real tool.
    const f = fixture();
    f.rounds[2] = [{ name: "resize_map", args: { mapId: f.project.startMapId, width: 21, height: 15 } }];
    // When finalizing and then undoing to the previously delivered project.
    const result = await f.run();
    expect(f.events.find(event => event.type === "tool_call" && event.name === "resize_map")).toMatchObject({ result: { ok: true } });
    // 2026-09-17: 이미지 확인은 승인 조건이 아니라 턴은 결정적 검사로 승인되지만, 리사이즈된 맵의 영수증은
    // 물러나 시각 확인 누락으로 남는다. 다른 맵은 건드리지 않는다.
    expect(result.review?.status, result.error).toBe("approved");
    expect(f.session["adventureProblems"]()).toHaveLength(1);
    f.session.rebaseProject(f.project);
    // Then undo cannot recreate the retired image receipt; the untouched map keeps its receipt.
    expect(f.session["adventureProblems"]()).toHaveLength(1);
  });

  it("retains current images across a follow-up without a new render", async () => {
    // Given a completed inspection in this conversation.
    const f = fixture();
    await f.run();
    // When another non-resetting user turn has no render-input changes.
    const result = await f.run();
    // Then the same current receipts are reused rather than reset.
    expect(f.session["adventureProblems"]()).toEqual([]);
    expect(result.assistantText).toBe("SCRIPTED_FINAL");
  });

  it("requires coverage of every promised map", async () => {
    // Given only the first map's image, despite a promise covering both maps.
    const f = fixture();
    f.shows.splice(1); f.rounds.pop();
    // When the model finalizes.
    await f.run();
    // Then unrelated coverage cannot stand in for the missing second map.
    expect(f.session["adventureProblems"]()).toHaveLength(1);
  });

  it("does not turn delivered map images into game-completion proof", async () => {
    // Given full delivered images but a requested battle that is not connected.
    const f = fixture({ requireBattle: true });
    // When the model claims completion.
    const result = await f.run();
    // Then static adventure requirements remain independent of image delivery.
    expect(f.session["adventureRequirements"]?.battle).toBe(true);
    expect(f.session["adventureProblems"]()).toHaveLength(1);
    expect(result.assistantText).not.toBe("SCRIPTED_FINAL");
  });
});
