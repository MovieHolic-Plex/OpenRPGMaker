import { describe, expect, it } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { ToolReadEvidence } from "@/ai/toolReadEvidence";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { fixedDeclarer } from "./intentFixture";

type Call = { name: string; args: Record<string, unknown> };
const readItem: Call = { name: "get_database_records", args: { collection: "items", ids: ["item_potion"], include: "full" } };
const writeItem: Call = { name: "upsert_item", args: { item: { id: "item_potion", price: 321 } } };
function scriptedSession(rounds: Call[][], contract?: { project: boolean; collections: string[]; references: boolean }) {
  const project = createBlankProject();
  let cursor = 0;
  const session = new AssistantSession(project, {
    config: { ...defaultAiConfig(), agentMode: "chat", apiKey: "test" },
    declareIntent: fixedDeclarer({ mode: "modify", needsPlan: false, ...(contract ? { readBeforeWrite: contract } : {}) }),
    chat: async (_config, request): Promise<ChatResult> => {
      if (!request.tools?.length) return { message: { role: "assistant", content: '{"action":"direct","reason":"test"}' }, finishReason: "stop" };
      if (contract?.project) expect(request.tools.map((tool) => tool.function.name)).toEqual(expect.arrayContaining([
        "get_project_summary", "get_map_region", "find_events", "get_database_records",
      ]));
      const calls = rounds[cursor++];
      return calls ? {
        message: { role: "assistant", content: null, tool_calls: calls.map((call, i) => ({
          id: `call_${cursor}_${i}`, type: "function", function: { name: call.name, arguments: JSON.stringify(call.args) },
        })) }, finishReason: "tool_calls",
      } : { message: { role: "assistant", content: "작업을 확인했습니다." }, finishReason: "stop" };
    },
  });
  return { session, project };
}

describe("실제 도구 결과에 기반한 조회 선행", () => {
  it("조회 실패 응답의 후속 쓰기는 실행하지 않고, 다음 응답에서 재조회 후 복구한다", async () => {
    const { session } = scriptedSession([
      [{ name: "get_database_records", args: { collection: "items", unsupportedFilter: true } }, readItem, writeItem],
      [readItem], [writeItem],
    ]);
    await session.sendUserMessage("기존 회복약 가격을 수정해줘");
    const audit = session.getAuditEntries().filter((entry) => entry.kind === "tool");
    expect(audit.map((entry) => [entry.name, entry.ok])).toEqual([
      ["get_database_records", false], ["get_database_records", true], ["upsert_item", false],
      ["get_database_records", true], ["upsert_item", true],
    ]);
    expect(audit[2]?.summary).toContain("같은 응답");
    expect(session.getProposedProject().database.items.find((item) => item.id === "item_potion")?.price).toBe(321);
  });

  it("전달된 원본은 첫 쓰기를 허용하고, 변경 뒤 재조회는 다음 응답에서만 현재 값 근거가 된다", async () => {
    const project = createBlankProject();
    // Use a fresh scripted session with its actual map ID, never a fabricated target.
    const map = project.maps[project.startMapId]!;
    const reads: Call[] = [
      { name: "get_project_summary", args: {} },
      { name: "find_events", args: { mapId: map.id } },
      { name: "get_map_region", args: { mapId: map.id, x: 0, y: 0, w: map.width, h: map.height } },
      readItem,
    ];
    const run = scriptedSession([[writeItem], [...reads, writeItem], [writeItem]], { project: true, collections: ["items"], references: true }).session;
    await run.sendUserMessage("기존 맵·이벤트·DB를 먼저 읽고 회복약 가격을 수정해줘");
    const writes = run.getAuditEntries().filter((entry) => entry.kind === "tool" && entry.name === "upsert_item");
    expect(writes.map((entry) => entry.ok)).toEqual([true, false, true]);
    expect(run.getProposedProject().database.items.find((item) => item.id === "item_potion")?.price).toBe(321);
  });

  it("ID 목록은 원본 수정 근거가 아니며, 읽은 레코드가 바뀌면 전체 값을 다시 조회한다", () => {
    const context = { project: createBlankProject() };
    const evidence = new ToolReadEvidence();
    evidence.begin({ project: false, collections: ["items"], references: true });
    const ids = { collection: "items", ids: ["item_potion"] };
    evidence.observe("get_database_records", ids, runTool(context, "get_database_records", ids));
    expect(evidence.beforeWrite(context.project, writeItem.name, writeItem.args)?.summary).toContain('include:"full"');
    evidence.observe(readItem.name, readItem.args, runTool(context, readItem.name, readItem.args));
    expect(evidence.beforeWrite(context.project, writeItem.name, writeItem.args)).toBeNull();
    expect(runTool(context, writeItem.name, writeItem.args, { dryRun: false }).ok).toBe(true);
    expect(evidence.beforeWrite(context.project, writeItem.name, writeItem.args)?.summary).toContain("현재 값");
  });

  it("DB 페이지는 실제 반환 ID만 담고 전체 원본은 ids로 좁혀 읽는다", () => {
    const context = { project: createBlankProject() };
    const page = runTool(context, "get_database_records", { collection: "items", limit: 5, offset: 0 });
    expect(page.ok).toBe(true);
    expect(page.data).toMatchObject({ total: context.project.database.items.length, nextOffset: 5 });
    const data = page.data as { records: { id: string; name: string }[] };
    expect(data.records).toHaveLength(5);
    const selected = data.records[1]!;
    const full = runTool(context, "get_database_records", { collection: "items", ids: [selected.id], include: "full" });
    expect(full.ok).toBe(true);
    expect(full.data).toMatchObject({ records: [context.project.database.items.find((item) => item.id === selected.id)], total: 1, nextOffset: null });
  });

  it("새로 만든 적도 조회 없이 트룹에서 참조할 수 없고, 반환된 ID만 참조 근거가 된다", () => {
    const context = { project: createBlankProject() };
    const evidence = new ToolReadEvidence();
    evidence.begin({ project: false, collections: [], references: true });
    const made = runTool(context, "upsert_enemy", {
      enemy: { id: "enemy_read_contract", name: "조회 계약 적", monsterResourceId: "generated-enemy-slime-01" },
    }, { dryRun: false });
    expect(made.ok).toBe(true);
    evidence.observe("upsert_enemy", {}, made);
    const args = { troop: { id: "troop_read_contract", name: "조회 무리", enemyIds: ["enemy_read_contract"] } };
    expect(evidence.beforeWrite(context.project, "upsert_troop", args)?.summary).toContain('ids:["enemy_read_contract"]');
    const wrongIds = { collection: "enemies", ids: ["missing"] };
    evidence.observe("get_database_records", wrongIds, runTool(context, "get_database_records", wrongIds));
    expect(evidence.beforeWrite(context.project, "upsert_troop", args)).not.toBeNull();
    const actualIds = { collection: "enemies", ids: ["enemy_read_contract"] };
    evidence.observe("get_database_records", actualIds, runTool(context, "get_database_records", actualIds));
    expect(evidence.beforeWrite(context.project, "upsert_troop", args)).toBeNull();
  });
});
