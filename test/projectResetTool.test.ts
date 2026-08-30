import { describe, expect, it, vi } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { reassembleSelectedProposalProject } from "@/editor/panels/aiChatPanel";
import { resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { runTool, type ToolContext } from "@/editor/tools";
import { applyProposedProject } from "@/editor/tools/applyChangesetToStore";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { store } from "@/project/store";
import type { ChatResult } from "@/ai/llmClient";

const CONFIG = { authMode: "apiKey" as const, baseUrl: "x", model: "stub-model", apiKey: "sk", maxToolCalls: 4, maxTokens: 1024 };

function scriptedChat(steps: readonly ChatResult[]) {
  let index = 0;
  return async (): Promise<ChatResult> => steps[index++];
}

function resetCall(args: Record<string, unknown>): ChatResult {
  return {
    message: { role: "assistant", content: null, tool_calls: [{ id: "c_reset", type: "function", function: { name: "reset_project", arguments: JSON.stringify(args) } }] },
    finishReason: "tool_calls",
  } as ChatResult;
}

function finalMessage(): ChatResult {
  return { message: { role: "assistant", content: "새 프로젝트 초안을 제안합니다." }, finishReason: "stop" } as ChatResult;
}

describe("reset_project", () => {
  it("deterministically replaces old content with a valid blank seed and applies title/genre", () => {
    const old = createBlankProject();
    old.maps[old.startMapId].events.push({
      id: "old_event",
      x: 1,
      y: 1,
      trigger: { kind: "action" },
      commands: [],
      pages: [{
        id: "old_event_page",
        name: "old",
        conditions: [],
        graphic: { transparent: true },
        trigger: { kind: "action" },
        priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [],
      }],
    });
    old.database.items.push({ ...old.database.items[0], id: "old_item", name: "old" });
    const first: ToolContext = { project: structuredClone(old) };
    const second: ToolContext = { project: structuredClone(old) };
    const args = { prompt: "작은 농장 생활 RPG를 처음부터 시작해줘", title: "달빛 농장", genrePreset: "farm-life" };

    const firstResult = runTool(first, "reset_project", args);
    const secondResult = runTool(second, "reset_project", args);

    expect(firstResult.ok, firstResult.summary).toBe(true);
    expect(secondResult.ok, secondResult.summary).toBe(true);
    expect(first.project).toEqual(second.project);
    expect(() => deserialize(serialize(first.project))).not.toThrow();
    expect(first.project.meta.title).toBe("달빛 농장");
    expect(first.project.system.titleScreen?.title).toBe("달빛 농장");
    expect(first.project.system.genre).toBe("farm-life");
    expect(first.project.system.timeSystem?.enabled).toBe(true);
    expect(Object.values(first.project.maps).flatMap((map) => map.events).some((event) => event.id === "old_event")).toBe(false);
    expect(first.project.database.items.some((item) => item.id === "old_item")).toBe(false);
    expect(firstResult.data).toEqual({ title: "달빛 농장", genrePreset: "farm-life" });
    expect(firstResult.data).not.toHaveProperty("project");
  });

  it("bounds abstract input and never accepts a raw project payload", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const overlong = runTool(ctx, "reset_project", { prompt: "x".repeat(2001), title: "new" });
    const rawPayload = runTool(ctx, "reset_project", { prompt: "new game", title: "new", project: createBlankProject() });

    expect(overlong.ok).toBe(false);
    expect(overlong.issues?.[0]?.code).toBe("invalid-args");
    expect(rawPayload.ok).toBe(false);
    expect(rawPayload.issues?.[0]?.code).toBe("invalid-args");
  });

  it("remains a destructive proposal but no longer crosses an approval boundary", async () => {
    const project = createBlankProject();
    const session = new AssistantSession(project, {
      chat: scriptedChat([resetCall({ prompt: "새 게임 시작", title: "새 출발" }), finalMessage()]),
      config: CONFIG,
    });

    const result = await session.sendUserMessage("새 프로젝트로 처음부터 시작해줘");
    expect(result.proposedCalls).toHaveLength(1);
    expect(result.proposedCalls[0]).toMatchObject({ name: "reset_project", destructive: true, requiresApproval: true });
    expect(session.getProposedProject().meta.title).toBe("새 출발");
  });

  it("makes reset-rooted proposal replay all-or-nothing", () => {
    const baseline = createBlankProject();
    const ctx: ToolContext = { project: structuredClone(baseline) };
    const resetArgs = { prompt: "새 시작", title: "새 세계" };
    const resetResult = runTool(ctx, "reset_project", resetArgs);
    const downstreamResult = runTool(ctx, "set_title_screen", { title: "최종 제목" });
    if (!resetResult.ok || !downstreamResult.ok) throw new Error("proposal setup failed");
    const calls = [
      { name: "reset_project", args: resetArgs, summary: resetResult.summary, result: resetResult, destructive: true, requiresApproval: true },
      { name: "set_title_screen", args: { title: "최종 제목" }, summary: downstreamResult.summary, result: downstreamResult, destructive: false },
    ];

    const excludedReset = reassembleSelectedProposalProject(baseline, calls, [false, true]);
    const excludedDownstream = reassembleSelectedProposalProject(baseline, calls, [true, false]);

    expect(excludedReset.ok).toBe(false);
    expect(excludedDownstream.ok).toBe(false);
  });

  it("keeps the pre-reset project available through undo after applying a reset proposal", async () => {
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
    vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "");
    vi.stubEnv("VITE_SUPABASE_URL", "");
    try {
      const before = createBlankProject();
      before.meta.title = "되돌릴 프로젝트";
      store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
      store.replaceProject(before);
      resetMapEditHistory();
      const proposed = createBlankProject();
      proposed.meta.title = "초기화된 프로젝트";

      const result = await applyProposedProject(proposed, {
        source: "agent",
        summary: "프로젝트 초기화",
        toolNames: ["reset_project"],
        resetProject: true,
      });

      expect(result.ok).toBe(true);
      expect(store.getCurrent().meta.title).toBe("초기화된 프로젝트");
      expect(undoMapEdit()).toBe(true);
      expect(store.getCurrent().meta.title).toBe("되돌릴 프로젝트");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
