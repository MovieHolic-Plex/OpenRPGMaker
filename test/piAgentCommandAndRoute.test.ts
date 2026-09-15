import { describe, expect, it } from "vitest";
import { parsePiCommand } from "@/editor/panels/aiPiAgentCommand";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools";
// @ts-expect-error plain ESM JS module
import { handleCompanionRequest, isCompanionPath } from "../scripts/lib/ohMyPiHttp.mjs";

describe("/pi 명령 파서", () => {
  const ctx = { project: createBlankProject() };
  runTool(ctx, "create_map", { id: "map_a", name: "A", width: 10, height: 10 });
  runTool(ctx, "create_map", { id: "map_b", name: "B", width: 10, height: 10 });

  it("접두사가 없으면 null", () => {
    expect(parsePiCommand("집 지어줘", ctx.project, "map_a")).toBeNull();
    expect(parsePiCommand("/pixel", ctx.project, "map_a")).toBeNull();
  });
  it("맵 목록이 없으면 현재 맵이 범위다", () => {
    expect(parsePiCommand("/pi 집 지어줘", ctx.project, "map_a")).toEqual({ mode: "single", mapIds: ["map_a"], currentMapId: "map_a", task: "집 지어줘" });
    expect(parsePiCommand("/pi 집 지어줘", ctx.project, null)).toEqual({ mode: "single", mapIds: [], currentMapId: null, task: "집 지어줘" });
  });
  it("실존하는 맵 id 목록은 병렬 범위로 읽는다", () => {
    expect(parsePiCommand("/pi map_a,map_b 집 한 채", ctx.project, "map_a")).toEqual({ mode: "single", mapIds: ["map_a", "map_b"], currentMapId: "map_a", task: "집 한 채" });
    expect(parsePiCommand("/pi map_a,map_a 집", ctx.project, null)).toEqual({ mode: "single", mapIds: ["map_a"], currentMapId: null, task: "집" });
    // 없는 id 는 지시문의 첫 단어일 뿐이다.
    expect(parsePiCommand("/pi map_zzz 집", ctx.project, "map_a")).toEqual({ mode: "single", mapIds: ["map_a"], currentMapId: "map_a", task: "map_zzz 집" });
  });
});

describe("동반 라우터 /v1/agent/run", () => {
  it("경로를 인식하고 어댑터의 NDJSON 스트림을 그대로 넘긴다", async () => {
    expect(isCompanionPath("/v1/agent/run?provider=openai-codex")).toBe(true);
    const seen: unknown[] = [];
    const ndjson = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new TextEncoder().encode('{"type":"turn","index":1}\n')); c.close(); } });
    const adapters = { runAgent: async (provider: string, body: unknown, options: unknown) => { seen.push([provider, body, options]); return { stream: true, ndjson }; } };
    const result = await handleCompanionRequest(
      { method: "POST", url: "/v1/agent/run?provider=openai-codex", headers: {}, body: { task: "x", mapIds: [], project: {} } },
      adapters,
    );
    expect(result).toMatchObject({ status: 200, stream: true });
    expect(result.ndjson).toBe(ndjson);
    expect(seen).toEqual([["openai-codex", { task: "x", mapIds: [], project: {} }, {}]]);
  });
  it("어댑터가 없으면 501", async () => {
    const result = await handleCompanionRequest({ method: "POST", url: "/v1/agent/run", headers: {}, body: {} }, {});
    expect(result.status).toBe(501);
  });
});
