// 2026-09-28 실측 회귀: 숲·NPC가 있는 시작 맵에서 마을 계약이 target:{kind:"existing"}(bounds 없음)로 얼었고,
// author_village 는 내용 있는 맵의 전체 재시공을 village-requires-scope 로 거부했다. 계약이 인자 변경도 다른 쓰기도
// 막아서 모델은 같은 인자로 5번 헛돌았다. 이제 첫 거부에서 계약이 풀리고, 모델은 새 맵을 만들 수 있다.
import { expect, test } from "bun:test";
import { createAssistantMessageEventStream } from "@oh-my-pi/pi-ai";
import { runPiAgent } from "../scripts/lib/piAgentRuntime.ts";
import { createEmptyToolProject } from "../src/editor/tools/emptyProject.ts";
import { runTool } from "../src/editor/tools/toolRunner.ts";
import type { PiAgentEvent } from "../src/ai/piAgent/protocol.ts";

type Call = { name: string; arguments: Record<string, unknown> };

function scripted(next: (index: number, context: { messages: { role: string; content: unknown }[]; systemPrompt?: string[] }) => Call | undefined) {
  let calls = 0;
  const streamFn = (_model: unknown, context: { messages: { role: string; content: unknown }[]; systemPrompt?: string[] }) => {
    const call = next(calls++, context);
    const stream = createAssistantMessageEventStream();
    queueMicrotask(() => {
      const message = {
        role: "assistant", api: "gemini", provider: "google-antigravity", model: "scripted",
        usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0 }, timestamp: Date.now(),
        content: call ? [{ type: "toolCall", id: `c${calls}`, ...call }] : [{ type: "text", text: "보고" }],
        stopReason: call ? "toolUse" : "stop",
      };
      stream.push({ type: "start", partial: message } as never);
      if (call) stream.push({ type: "toolcall_end", contentIndex: 0, toolCall: message.content[0], partial: message } as never);
      stream.push({ type: "done", reason: message.stopReason, message } as never);
    });
    return stream;
  };
  return { streamFn, count: () => calls };
}

/** 모델이 받은 마지막 도구 결과 문장. 계약 해제 안내가 여기 붙어야 모델이 다음 수를 바꾼다. */
function lastToolResultText(messages: { role: string; content: unknown }[]): string {
  const last = [...messages].reverse().find(message => message.role === "toolResult");
  const content = last?.content;
  return Array.isArray(content) ? content.map(part => (part as { text?: string }).text ?? "").join("") : String(content ?? "");
}

test("a frozen whole-map contract on a lived map is released on the first structural refusal", async () => {
  const ctx = { project: createEmptyToolProject("contract release") };
  expect(runTool(ctx, "create_map", { id: "start", name: "빈 맵", width: 30, height: 20 }).ok).toBe(true);
  // 사용자가 이미 둔 NPC — 이 맵은 「내용이 있는 맵」이라 bounds 없는 전체 시공이 거부된다.
  ctx.project.maps.start!.events.push({ id: "ev_guide", x: 3, y: 3, trigger: { kind: "action" }, commands: [], pages: [] } as never);
  const frozen = { target: { kind: "existing", mapId: "start" }, houseCount: 2, npcCount: 0, countPolicy: "exact" };
  let sawNotice = "";
  const { streamFn, count } = scripted((index, context) => {
    if (index === 0) return { name: "author_village", arguments: { ...frozen, seed: 7, interior: false } };
    if (index === 1) {
      sawNotice = lastToolResultText(context.messages);
      // 계약이 풀렸으니 새 맵 인자로 부를 수 있다 — 예전에는 여기서 「마을 계약의 target를 유지하세요」로 막혔다.
      return { name: "author_village", arguments: { target: { kind: "new", mapId: "village", name: "마을" }, houseCount: 2, npcCount: 0, countPolicy: "exact", seed: 7, interior: false } };
    }
    return undefined;
  });
  const events: PiAgentEvent[] = [];
  const done = await runPiAgent({
    provider: "google-antigravity", task: "위로 올라가면 마을", project: ctx.project, mapIds: ["start"], maxTurns: 8,
    villageContract: { mapId: "start", houseCount: 2, npcCount: 0, args: frozen },
    initialToolNames: ["author_village", "get_map_region"],
  }, { streamFn: streamFn as never, onEvent: event => events.push(event) });

  const villageEnds = events.filter((event): event is Extract<PiAgentEvent, { type: "tool_end" }> => event.type === "tool_end" && event.name === "author_village");
  // 첫 호출은 거부, 두 번째(새 맵)는 성공. 같은 인자로 헛돌지 않는다.
  expect(villageEnds.map(event => event.ok)).toEqual([false, true]);
  expect(villageEnds[0]!.summary).toContain("이미 저작 내용이 있어");
  expect(events.some(event => event.type === "execution_status" && event.name === "village.contract_released")).toBe(true);
  expect(sawNotice).toContain("[마을 계약 해제]");
  expect(sawNotice).toContain("village-requires-scope");
  expect(done.villageContractReleased?.code).toBe("village-requires-scope");
  expect(done.project.maps.village).toBeDefined();
  // 사용자가 둔 NPC와 시작 맵은 건드리지 않는다.
  expect(done.project.maps.start!.events.map(event => event.id)).toEqual(["ev_guide"]);
  // 계약이 풀렸으니 「요청한 마을이 시공되지 않았습니다」 같은 계약 검사 결과가 아니라 일반 마을 검사를 받는다.
  expect(done.villageCompletion?.issues ?? []).not.toContain("요청한 마을이 시공되지 않았습니다.");
  expect(count()).toBeLessThanOrEqual(4);
}, 60000);

test("a failure the model can still fix does not release the contract", async () => {
  const ctx = { project: createEmptyToolProject("contract kept") };
  expect(runTool(ctx, "create_map", { id: "village", name: "Village", width: 50, height: 50 }).ok).toBe(true);
  const frozen = { target: { kind: "existing", mapId: "village" }, houseCount: 2, npcCount: 0, countPolicy: "exact" };
  const { streamFn } = scripted(index => index === 0
    // 계약 인자는 그대로지만 모델 몫 인자(residents)가 틀렸다 — 모델이 고칠 수 있으므로 계약은 유지된다.
    ? { name: "author_village", arguments: { ...frozen, seed: 7, interior: false, residents: "잘못된 값" } }
    : undefined);
  const events: PiAgentEvent[] = [];
  const done = await runPiAgent({
    provider: "google-antigravity", task: "마을을 지어라", project: ctx.project, mapIds: ["village"], maxTurns: 4,
    villageContract: { mapId: "village", houseCount: 2, npcCount: 0, args: frozen },
    initialToolNames: ["author_village"],
  }, { streamFn: streamFn as never, onEvent: event => events.push(event) });
  expect(events.some(event => event.type === "tool_end" && event.name === "author_village" && !event.ok)).toBe(true);
  expect(done.villageContractReleased).toBeUndefined();
  expect(done.villageCompletion?.issues).toContain("요청한 마을이 시공되지 않았습니다.");
}, 60000);
