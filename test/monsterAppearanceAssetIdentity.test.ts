import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ToolReadEvidence } from "@/ai/toolReadEvidence";
import { AssistantSession } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { runTool } from "@/editor/tools";
import { fixedDeclarer } from "./intentFixture";
import { goblinId, slimeId, monsterContext, monsterWriters } from "./monsterAiFixture";

const image = (color: string) => `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="${color}"/></svg>`).toString("base64")}`;
const redImage = image("red");
const blueImage = image("blue");
const upload = (dataUrl: string) => ({ resource: { id: goblinId, name: "Goblin", kind: "monster", dataUrl } });
const readers = [
  { name: "get_monster_resource", args: { resourceId: goblinId } },
  { name: "list_monster_resources", args: { ids: [goblinId], include: "full" } },
];

function registeredUpload() {
  const ctx = monsterContext();
  const result = runTool(ctx, "upsert_resource", upload(redImage));
  expect(result.ok, result.summary).toBe(true);
  return ctx;
}

describe.each(monsterWriters)("$name image identity authorization", writer => {
  it.each(readers)("rejects stale $name evidence when image bytes change at the same ID", reader => {
    // Given an actual registered upload and an observed full resource read.
    const ctx = registeredUpload();
    const evidence = new ToolReadEvidence();
    evidence.begin(undefined);
    evidence.observe(reader.name, reader.args, runTool(ctx, reader.name, reader.args));
    expect(runTool(ctx, "upsert_resource", upload(blueImage)).ok).toBe(true);
    // When assigning the same ID using the old read, with unchanged effective metadata.
    const result = evidence.beforeWrite(ctx.project, writer.name, { ...writer.args({ monsterResourceId: goblinId }), appearanceTags: ["goblin"] });
    // Then different image bytes require a new full read.
    expect(result?.issues?.[0]?.code).toBe("monster-resource-read-required");
  });

  it("rejects a changed assignment using an old image read", () => {
    // Given an existing record with different art and a stale read of the requested art.
    const ctx = registeredUpload();
    expect(runTool(ctx, writer.name, writer.args({ monsterResourceId: slimeId })).ok).toBe(true);
    const evidence = new ToolReadEvidence();
    evidence.begin(undefined);
    const reader = readers[0];
    evidence.observe(reader.name, reader.args, runTool(ctx, reader.name, reader.args));
    expect(runTool(ctx, "upsert_resource", upload(blueImage)).ok).toBe(true);
    // When changing to the replaced image.
    const result = evidence.beforeWrite(ctx.project, writer.name, { ...writer.args({ monsterResourceId: goblinId }), appearanceTags: ["goblin"] });
    // Then existing records do not bypass new-selection evidence.
    expect(result?.issues?.[0]?.code).toBe("monster-resource-read-required");
  });

  it.each(readers)("accepts a fresh full $name read after image replacement", reader => {
    // Given replaced image bytes and a fresh successful full read.
    const ctx = registeredUpload();
    const evidence = new ToolReadEvidence();
    evidence.begin(undefined);
    evidence.observe(reader.name, reader.args, runTool(ctx, reader.name, reader.args));
    expect(runTool(ctx, "upsert_resource", upload(blueImage)).ok).toBe(true);
    evidence.observe(reader.name, reader.args, runTool(ctx, reader.name, reader.args));
    // When selecting the current image using its current full read.
    const result = evidence.beforeWrite(ctx.project, writer.name, { ...writer.args({ monsterResourceId: goblinId }), appearanceTags: ["goblin"] });
    // Then fresh evidence restores authorization.
    expect(result).toBeNull();
  });

  it("preserves unchanged art edits even after the underlying upload changes", () => {
    // Given an already assigned graphic, then a separate upload replacement.
    const ctx = registeredUpload();
    expect(runTool(ctx, writer.name, writer.args({ monsterResourceId: goblinId })).ok).toBe(true);
    expect(runTool(ctx, "upsert_resource", upload(blueImage)).ok).toBe(true);
    const evidence = new ToolReadEvidence();
    evidence.begin(undefined);
    // When updating the existing record without choosing different art.
    const result = evidence.beforeWrite(ctx.project, writer.name, writer.args({}));
    // Then this focused gate does not reinterpret unchanged-art edits as selections.
    expect(result).toBeNull();
  });
});

it("keeps stat-only updates valid without image evidence", () => {
  // Given an existing enemy whose assigned upload was replaced independently.
  const ctx = registeredUpload();
  expect(runTool(ctx, "upsert_enemy", { enemy: { id: "stat_enemy", name: "Boss", monsterResourceId: goblinId } }).ok).toBe(true);
  expect(runTool(ctx, "upsert_resource", upload(blueImage)).ok).toBe(true);
  const evidence = new ToolReadEvidence();
  evidence.begin(undefined);
  const args = { enemy: { id: "stat_enemy", stats: { maxHp: 99 } } };
  // When the AI updates only stats through the existing gate and tool runner.
  const result = evidence.beforeWrite(ctx.project, "upsert_enemy", args) ?? runTool(ctx, "upsert_enemy", args);
  // Then stats update without selecting different art.
  expect(result.ok).toBe(true);
  expect(ctx.project.database.enemies.find(enemy => enemy.id === "stat_enemy")).toMatchObject({ monsterResourceId: goblinId, stats: { maxHp: 99 } });
});

it("exposes a compact shared asset identity in both full reads without shipping image data", () => {
  // Given one registered monster image.
  const ctx = registeredUpload();
  const assetIdentity = `sha256:${createHash("sha256").update(JSON.stringify([goblinId, redImage, {}])).digest("hex")}`;
  // When reading it through both full response paths.
  const results = readers.map(reader => runTool(ctx, reader.name, reader.args));
  // Then each full entry carries a compact digest, not the data URL.
  expect(results[0].data).toMatchObject({ resource: { assetIdentity } });
  expect(results[1].data).toMatchObject({ resources: [{ assetIdentity }] });
  expect(JSON.stringify(results)).not.toContain(redImage);
});

it("rejects stale image identity and recovers after a new full read in the actual session", async () => {
  // Given an actual upload and a model that replaces bytes after reading them.
  const ctx = registeredUpload();
  const write = { name: "upsert_enemy", args: { enemy: { id: "session_boss", name: "Custom Boss", monsterResourceId: goblinId }, appearanceTags: ["goblin"] } };
  const rounds = [[readers[0]], [{ name: "upsert_resource", args: upload(blueImage) }], [write], [readers[0]], [write]];
  let cursor = 0;
  const session = new AssistantSession(ctx.project, {
    config: { ...defaultAiConfig(), agentMode: "chat", apiKey: "fixture" },
    declareIntent: fixedDeclarer({ mode: "modify", needsPlan: false, tools: ["upsert_enemy", "upsert_resource"] }),
    chat: async (_config, request): Promise<ChatResult> => {
      if (!request.tools?.length) return { message: { role: "assistant", content: '{"action":"direct","reason":"test"}' }, finishReason: "stop" };
      const calls = rounds[cursor++];
      return calls ? { message: { role: "assistant", content: null, tool_calls: calls.map((call, i) => ({ id: `image_${cursor}_${i}`, type: "function", function: { name: call.name, arguments: JSON.stringify(call.args) } })) }, finishReason: "tool_calls" }
        : { message: { role: "assistant", content: "완료" }, finishReason: "stop" };
    },
  });
  // When the model attempts a stale selection then reads the new image identity.
  await session.sendUserMessage("몬스터 소재를 읽고 교체한 뒤 보스에 적용해줘");
  // Then only the post-reread assignment executes.
  expect(session.getAuditEntries().filter(entry => entry.kind === "tool" && entry.name === "upsert_enemy").map(entry => entry.ok)).toEqual([false, true]);
  expect(session.getProposedProject().database.enemies.find(enemy => enemy.id === "session_boss")?.monsterResourceId).toBe(goblinId);
});
