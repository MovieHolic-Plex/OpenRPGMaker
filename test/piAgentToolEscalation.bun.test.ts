import { describe, expect, test } from "bun:test";

// Pi 툴 에스컬레이션 회귀 — 진짜 Agent 루프를 스크립트 모델로 돌린다.
// 계약: 초기 노출이 도메인으로 좁혀져도 find_tools 수확(선언 승격)과 resolveFallbackTool
// (미노출 호출 구제)이 실행 중에 툴을 얹는다. 단, readOnly·toolNames 경계는 에스컬레이션이
// 넘지 못한다 — 읽기 전용 실행에 쓰기 툴이 스는 순간 「편집하지 마」보장이 무너진다.
import { createAssistantMessageEventStream } from "@oh-my-pi/pi-ai";
import { selectPiToolDefinitions } from "../src/ai/piAgent/toolAdapter.ts";
import { runPiAgent } from "../scripts/lib/piAgentRuntime.ts";
import { createBlankProject } from "../src/project/defaults.ts";
import type { PiAgentEvent, PiAgentRequest } from "../src/ai/piAgent/protocol.ts";

interface ScriptedCall {
  readonly toolNames: readonly string[];
}

function assistantMessage(content: unknown[], stopReason: string) {
  return {
    role: "assistant",
    content,
    api: "gemini",
    provider: "google-antigravity",
    model: "scripted",
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0 },
    stopReason,
    timestamp: Date.now(),
  } as never;
}

/** 순서대로 툴콜을 내고 마지막에 텍스트로 끝나는 스크립트 모델. 각 호출 시점의 선언 툴을 기록한다. */
function scriptedStream(calls: ScriptedCall[], toolCallsPerTurn: readonly { name: string; args: Record<string, unknown> }[]) {
  return (_model: unknown, context: { tools?: readonly { name: string }[] }) => {
    calls.push({ toolNames: (context.tools ?? []).map((tool) => tool.name) });
    const step = toolCallsPerTurn[calls.length - 1];
    const stream = createAssistantMessageEventStream();
    queueMicrotask(() => {
      if (step) {
        const message = assistantMessage(
          [{ type: "toolCall", id: `c${calls.length}`, name: step.name, arguments: step.args }],
          "toolUse",
        );
        stream.push({ type: "start", partial: message } as never);
        stream.push({ type: "toolcall_end", contentIndex: 0, toolCall: (message as never as { content: never[] }).content[0], partial: message } as never);
        stream.push({ type: "done", reason: "toolUse", message } as never);
      } else {
        const message = assistantMessage([{ type: "text", text: "끝" }], "stop");
        stream.push({ type: "start", partial: message } as never);
        stream.push({ type: "done", reason: "stop", message } as never);
      }
    });
    return stream;
  };
}

function request(overrides: Partial<PiAgentRequest> = {}): PiAgentRequest {
  return {
    provider: "google-antigravity",
    task: "테스트 실행",
    mapIds: [],
    project: createBlankProject(),
    toolDomains: ["core"],
    maxTurns: 6,
    ...overrides,
  };
}

describe("piAgent 툴 에스컬레이션", () => {
  test("find_tools 수확이 다음 턴 선언에 툴을 얹는다", async () => {
    const calls: ScriptedCall[] = [];
    const events: PiAgentEvent[] = [];
    const done = await runPiAgent(request(), {
      streamFn: scriptedStream(calls, [
        { name: "find_tools", args: { query: "set_project_settings" } },
        { name: "set_project_settings", args: { title: "승격된 제목" } },
      ]) as never,
      onEvent: (event) => events.push(event),
    });

    // 초기 노출은 core+범용뿐 — set_project_settings 는 없다.
    expect(calls[0]!.toolNames).toContain("find_tools");
    expect(calls[0]!.toolNames).not.toContain("set_project_settings");
    // find_tools 가 발견한 이름은 다음 턴 요청에 선언으로 실려 있다.
    expect(calls[1]!.toolNames).toContain("set_project_settings");
    // 그리고 실제로 실행됐다.
    const setEnd = events.find((event) => event.type === "tool_end" && event.name === "set_project_settings");
    expect(setEnd && setEnd.type === "tool_end" ? setEnd.ok : false).toBe(true);
    expect(done.project.meta.title).toBe("승격된 제목");
    expect(done.stats.toolErrors).toBe(0);
  });

  test("미노출 툴의 직접 호출도 폴백이 구제한다", async () => {
    const calls: ScriptedCall[] = [];
    const done = await runPiAgent(request(), {
      streamFn: scriptedStream(calls, [
        { name: "set_project_settings", args: { title: "직접 호출" } },
      ]) as never,
    });
    expect(calls[0]!.toolNames).not.toContain("set_project_settings");
    expect(done.project.meta.title).toBe("직접 호출");
    // 구제된 툴은 이후 요청에도 선언된다.
    expect(calls[1]!.toolNames).toContain("set_project_settings");
  });

  test("읽기 전용 실행은 폴백이 쓰기 툴을 못 만든다 — 승격이 경계를 넘지 않는다", async () => {
    const calls: ScriptedCall[] = [];
    const events: PiAgentEvent[] = [];
    const done = await runPiAgent(request({ readOnly: true }), {
      readOnlyTools: true,
      streamFn: scriptedStream(calls, [
        { name: "set_project_settings", args: { title: "못 바꿈" } },
      ]) as never,
      onEvent: (event) => events.push(event),
    });
    expect(done.project.meta.title).not.toBe("못 바꿈");
    expect(done.stats.toolErrors).toBeGreaterThan(0);
    const setEnd = events.find((event) => event.type === "tool_end" && event.name === "set_project_settings");
    expect(setEnd && setEnd.type === "tool_end" ? setEnd.ok : true).toBe(false);
  });

  test("find_tools 로 찾은 쓰기 툴도 읽기 전용에선 주입되지 않는다", async () => {
    const calls: ScriptedCall[] = [];
    const done = await runPiAgent(request({ readOnly: true }), {
      readOnlyTools: true,
      streamFn: scriptedStream(calls, [
        { name: "find_tools", args: { query: "set_project_settings" } },
        { name: "get_project_summary", args: {} },
      ]) as never,
    });
    // find_tools 는 읽기 툴만 주입할 수 있다 — 쓰기 툴 이름이 결과에 있어도 걸러진다.
    expect(calls[1]!.toolNames).not.toContain("set_project_settings");
    expect(done.stats.toolErrors).toBe(0);
  });
  test("initial candidates cross the worker boundary and permit discovery outside them", async () => {
    const calls: ScriptedCall[] = [];
    const done = await runPiAgent(request({ initialToolNames: ["find_tools", "get_project_summary"] }), {
      streamFn: scriptedStream(calls, [
        { name: "find_tools", args: { query: "set_project_settings" } },
        { name: "set_project_settings", args: { title: "Pi initial candidates" } },
      ]) as never,
    });
    // Reference reads, search and the preview-only build spec are always exposed.
    // Keep exact membership checks so unrelated authoring tools cannot leak in.
    expect(new Set(calls[0]!.toolNames)).toEqual(new Set([
      "get_project_summary", "find_tools", "list_tileset_references", "read_tileset_reference", "web_search", "set_build_spec",
    ]));
    expect(calls[1]!.toolNames).toContain("set_project_settings");
    expect(done.project.meta.title).toBe("Pi initial candidates");
    expect(done.stats.toolErrors).toBe(0);
  });

  test("empty search restores all permitted schemas on the next real Agent turn", async () => {
    const calls: ScriptedCall[] = [];
    await runPiAgent(request({ initialToolNames: ["find_tools"] }), {
      streamFn: scriptedStream(calls, [{ name: "find_tools", args: { query: "쀍쀍쀍쀍쀍" } }]) as never,
    });
    expect(new Set(calls[0]!.toolNames)).toEqual(new Set([
      "find_tools", "list_tileset_references", "read_tileset_reference", "web_search", "set_build_spec",
    ]));
    expect(new Set(calls[1]!.toolNames)).toEqual(new Set([...selectPiToolDefinitions().map(tool => tool.name), "set_build_spec"]));
    expect(calls[1]!.toolNames.length).toBe(new Set(calls[1]!.toolNames).size);
  });

  test("empty search and direct calls cannot escape read-only or role allowlists", async () => {
    for (const readOnly of [false, true]) {
      const calls: ScriptedCall[] = [];
      const done = await runPiAgent(request({ readOnly, initialToolNames: ["find_tools", "set_party"] }), {
        toolNames: ["find_tools", "get_project_summary", "set_project_settings"],
        streamFn: scriptedStream(calls, [
          { name: "find_tools", args: { query: "쀍쀍쀍쀍쀍" } },
          { name: "set_party", args: { actorIds: [] } },
        ]) as never,
      });
      expect(calls[0]!.toolNames).toEqual(readOnly ? ["find_tools"] : ["find_tools", "set_build_spec"]);
      expect(new Set(calls[1]!.toolNames)).toEqual(new Set(readOnly
        ? ["find_tools", "get_project_summary"] : ["find_tools", "get_project_summary", "set_project_settings", "set_build_spec"]));
      expect(done.changedKeys).toEqual([]);
      expect(done.stats.toolErrors).toBe(1);
    }
  });

  test("more than sixteen discovered tools remain declared instead of silently disappearing", async () => {
    const calls: ScriptedCall[] = [];
    const targets = selectPiToolDefinitions().filter(tool => tool.mode === "read" && tool.name !== "find_tools").slice(0, 20);
    await runPiAgent(request({ initialToolNames: ["find_tools"], maxTurns: 25 }), {
      streamFn: scriptedStream(calls, targets.map(tool => ({ name: "find_tools", args: { query: tool.name, limit: 1 } }))) as never,
    });
    expect(calls.at(-1)!.toolNames).toEqual(expect.arrayContaining(targets.map(tool => tool.name)));
  });

  test("discovered authoring tools change actual world, portrait, charset, equipment and party data", async () => {
    const project = createBlankProject();
    const hero = project.database.actors[0]!;
    const calls: ScriptedCall[] = [];
    const patches = [
      { name: "set_world_canon", args: { canon: { name: "테스트 왕국", era: "봉건 중세" } } },
      { name: "upsert_equipment", args: { equipment: { id: "equip_pi_qa", name: "검증검", slot: "weapon" } } },
      { name: "upsert_actor", args: { actor: { id: hero.id, faceResourceId: "easyrpg-faceset-actor2-00",
        characterResourceId: "easyrpg-charset-actor2", characterIndex: 3, initialEquipment: { weapon: "equip_pi_qa" } } } },
      { name: "set_party", args: { scope: "start", actorIds: [hero.id] } },
    ];
    const done = await runPiAgent(request({ project, initialToolNames: ["find_tools"], maxTurns: 12 }), {
      streamFn: scriptedStream(calls, patches.flatMap(patch => [
        { name: "find_tools", args: { query: patch.name, limit: 1 } }, patch,
      ])) as never,
    });
    expect(done.stats.toolErrors).toBe(0);
    expect(done.project.worldCanon).toMatchObject({ name: "테스트 왕국", era: "봉건 중세" });
    expect(done.project.database.actors.find(actor => actor.id === hero.id)).toMatchObject({
      faceResourceId: "easyrpg-faceset-actor2-00", characterResourceId: "easyrpg-charset-actor2",
      characterIndex: 3, initialEquipment: { weapon: "equip_pi_qa" },
    });
    expect(done.project.system.startActorIds).toEqual([hero.id]);
    expect(done.project.session.partyActorIds).toEqual([hero.id]);
    expect(project.database.actors[0]).toEqual(hero); // Source project remains detached.
  });

});
