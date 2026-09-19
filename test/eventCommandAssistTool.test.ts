import { describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import type { EventPage } from "@/project/types";
import { runToolAsync } from "@/editor/tools/asyncToolRunner";
import { getTool, runTool } from "@/editor/tools";
import { createPiToolset } from "@/ai/piAgent/toolAdapter";
import { defaultAiConfig } from "@/ai/llmClient";
import type { runEventCommandAssist } from "@/ai/eventCommandAssist";

function fixture() {
  const project = createBlankProject();
  const mapId = Object.keys(project.maps)[0];
  const page: EventPage = {
    id: "page-1", name: "페이지", conditions: [], graphic: {}, trigger: { kind: "action" },
    priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [{ kind: "text", body: "이전 대사" }],
  };
  project.maps[mapId].events.push({ id: "ev-assist", name: "대화", x: 2, y: 2,
    trigger: { kind: "action" }, commands: [], pages: [page, { ...structuredClone(page), id: "page-2" }] });
  return { ctx: { project }, args: { mapId, eventId: "ev-assist", pageId: page.id, prompt: "대사를 고쳐 줘" } };
}

const generated: Awaited<ReturnType<typeof runEventCommandAssist>> = {
  commands: [{ kind: "text", body: "새 대사" }], scope: "page", attempts: 1,
};

describe("event_command_assist", () => {
  it("is a discoverable write tool excluded from read-only Pi sessions", () => {
    const { ctx } = fixture();
    expect(getTool("event_command_assist")?.mode).toBe("write");
    expect(createPiToolset(ctx, { readOnly: true }).some(t => t.name === "event_command_assist")).toBe(false);
    expect(createPiToolset(ctx, { toolNames: ["event_command_assist"] })).toHaveLength(1);
  });

  it("updates only the chosen page through a cloned draft", async () => {
    const { ctx, args } = fixture();
    const before = ctx.project;
    const result = await runToolAsync(ctx, "event_command_assist", args, { generate: async () => generated });
    expect(result.ok).toBe(true);
    const oldEvent = before.maps[args.mapId].events.find(e => e.id === args.eventId)!;
    const next = ctx.project.maps[args.mapId].events.find(e => e.id === args.eventId)!;
    expect(oldEvent.pages![0].commands[0]).toEqual({ kind: "text", body: "이전 대사" });
    expect(next.pages![0]).toEqual({ ...oldEvent.pages![0], commands: generated.commands });
    expect(next.pages![1]).toEqual(oldEvent.pages![1]);
  });

  it("dry-run and synchronous calls cannot commit generated commands", async () => {
    const { ctx, args } = fixture();
    const before = ctx.project;
    expect(runTool(ctx, "event_command_assist", args).ok).toBe(false);
    const result = await runToolAsync(ctx, "event_command_assist", args, { dryRun: true, generate: async () => generated });
    expect(result.ok).toBe(true);
    expect(ctx.project).toBe(before);
  });

  it("rejects missing targets and long-page edits before generation", async () => {
    const { ctx, args } = fixture();
    const generate = vi.fn(async () => generated);
    expect((await runToolAsync(ctx, "event_command_assist", { ...args, pageId: "absent" }, { generate })).ok).toBe(false);
    ctx.project.maps[args.mapId].events.find(e => e.id === args.eventId)!.pages![0].commands = [{ kind: "text", body: "가".repeat(13000) }];
    expect((await runToolAsync(ctx, "event_command_assist", args, { generate })).ok).toBe(false);
    expect(generate).not.toHaveBeenCalled();
  });

  it("appends without replacing existing commands", async () => {
    const { ctx, args } = fixture();
    const result = await runToolAsync(ctx, "event_command_assist", { ...args, mode: "append" }, {
      generate: async options => {
        expect(options.context.scope).toBe("append");
        return { ...generated, scope: "append" };
      },
    });
    expect(result.ok).toBe(true);
    expect(ctx.project.maps[args.mapId].events.find(e => e.id === args.eventId)!.pages![0].commands).toHaveLength(2);
  });

  it("passes the host selection to generation and inserts after it in append mode", async () => {
    const { ctx, args } = fixture();
    const page = ctx.project.maps[args.mapId].events[0].pages![0];
    const last = { kind: "text" as const, body: "마지막 대사" };
    page.commands.push(last);
    const result = await runToolAsync(ctx, "event_command_assist", { ...args, mode: "append" }, {
      eventCommandScope: { ...args, mode: "append", selection: [0], selectionLabel: "선택한 첫 명령" },
      generate: async options => {
        expect(options.context.selection).toEqual([0]);
        expect(options.context.selectionLabel).toBe("선택한 첫 명령");
        return { ...generated, scope: "append" };
      },
    });
    expect(result.ok).toBe(true);
    expect(ctx.project.maps[args.mapId].events[0].pages![0].commands).toEqual([
      { kind: "text", body: "이전 대사" }, ...generated.commands, last,
    ]);
  });

  it("rejects stale or cancelled results without replacing the project", async () => {
    const { ctx, args } = fixture();
    const changed = structuredClone(ctx.project);
    const result = await runToolAsync(ctx, "event_command_assist", args, {
      generate: async () => { ctx.project = changed; return generated; },
    });
    expect(result.issues?.[0].code).toBe("stale-project");
    expect(ctx.project).toBe(changed);
    const controller = new AbortController();
    await expect(runToolAsync(ctx, "event_command_assist", args, {
      signal: controller.signal,
      generate: async () => { controller.abort(); return generated; },
    })).rejects.toThrow();
    expect(ctx.project).toBe(changed);
  });

  it("uses the shared generator's validation and repair loop", async () => {
    const { ctx, args } = fixture();
    const chat = vi.fn()
      .mockResolvedValueOnce({ message: { role: "assistant", content: '[{"kind":"not-a-command"}]' }, finishReason: "stop" })
      .mockResolvedValueOnce({ message: { role: "assistant", content: JSON.stringify(generated.commands) }, finishReason: "stop" });
    const result = await runToolAsync(ctx, "event_command_assist", args, { config: defaultAiConfig(), chat });
    expect(result.ok).toBe(true);
    expect(chat).toHaveBeenCalledTimes(2);
    expect(result.data).toMatchObject({ attempts: 2 });
  });

  it("keeps the draft unchanged when resource validation exhausts retries", async () => {
    const { ctx, args } = fixture();
    const before = ctx.project;
    const chat = vi.fn().mockResolvedValue({ message: { role: "assistant", content:
      JSON.stringify([{ kind: "playAudio", channel: "bgm", resourceId: "nonexistent-resource", volume: 100, pitch: 100 }]),
    }, finishReason: "stop" });
    const result = await runToolAsync(ctx, "event_command_assist", args, { config: defaultAiConfig(), chat });
    expect(result.ok).toBe(false);
    expect(chat).toHaveBeenCalledTimes(3);
    expect(ctx.project).toBe(before);
  });
});
