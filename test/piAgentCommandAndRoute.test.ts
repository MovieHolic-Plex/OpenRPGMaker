import { describe, expect, it } from "vitest";
import { MAX_PI_LOOP, parsePiDirective, plainPiCommand } from "@/editor/panels/aiPiAgentCommand";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools";
// @ts-expect-error plain ESM JS module
import { handleCompanionRequest, isCompanionPath } from "../scripts/lib/ohMyPiHttp.mjs";

describe("슬래시 노브 파서", () => {
  const ctx = { project: createBlankProject() };
  runTool(ctx, "create_map", { id: "map_a", name: "A", width: 10, height: 10 });
  runTool(ctx, "create_map", { id: "map_b", name: "B", width: 10, height: 10 });
  const commandOf = (text: string, currentMapId: string | null = "map_a") => {
    const parsed = parsePiDirective(text, ctx.project, currentMapId);
    expect(parsed?.kind).toBe("command");
    return parsed?.kind === "command" ? parsed.command : null;
  };
  const errorOf = (text: string): string => {
    const parsed = parsePiDirective(text, ctx.project, "map_a");
    expect(parsed?.kind).toBe("error");
    return parsed?.kind === "error" ? parsed.message : "";
  };

  it("명령이 아니면 null — 평문은 그대로 지시문이다", () => {
    expect(parsePiDirective("집 지어줘", ctx.project, "map_a")).toBeNull();
    expect(parsePiDirective("/pixel", ctx.project, "map_a")).toBeNull();
    expect(parsePiDirective("/5x 집", ctx.project, "map_a")).toBeNull();
  });
  it("맵 목록이 없으면 현재 맵이 범위다", () => {
    expect(commandOf("/pi 집 지어줘")).toEqual({ mode: "single", mapIds: ["map_a"], task: "집 지어줘", loop: 1 });
    expect(commandOf("/pi 집 지어줘", null)).toEqual({ mode: "single", mapIds: [], task: "집 지어줘", loop: 1 });
  });
  it("실존하는 맵 id 목록은 병렬 범위로 읽는다", () => {
    expect(commandOf("/pi map_a,map_b 집 한 채")).toEqual({ mode: "single", mapIds: ["map_a", "map_b"], task: "집 한 채", loop: 1 });
    expect(commandOf("/pi map_a,map_a 집", null)).toEqual({ mode: "single", mapIds: ["map_a"], task: "집", loop: 1 });
    // 없는 id 는 지시문의 첫 단어일 뿐이다.
    expect(commandOf("/pi map_zzz 집")).toEqual({ mode: "single", mapIds: ["map_a"], task: "map_zzz 집", loop: 1 });
  });
  it("team 노브는 /pi 없이도 팀 모드다", () => {
    expect(commandOf("/team 집")).toEqual({ mode: "team", mapIds: [], task: "집", loop: 1 });
    expect(commandOf("/pi team map_a,map_b 집")).toEqual({ mode: "team", mapIds: ["map_a", "map_b"], task: "집", loop: 1 });
  });
  it("loop 노브는 반복 횟수, 시간 토큰은 한 실행의 상한이다", () => {
    expect(commandOf("/loop 3 집")).toEqual({ mode: "single", mapIds: ["map_a"], task: "집", loop: 3 });
    expect(commandOf("/30m 집")).toEqual({ mode: "single", mapIds: ["map_a"], task: "집", loop: 1, timeoutMs: 1_800_000 });
    expect(commandOf("/90s 집")).toMatchObject({ timeoutMs: 90_000 });
    expect(commandOf("/team /loop 2 /1h map_a,map_b 마을")).toEqual({
      mode: "team", mapIds: ["map_a", "map_b"], task: "마을", loop: 2, timeoutMs: 3_600_000,
    });
  });
  it("노브 인자가 틀리면 조용히 지시문이 되지 않고 사용법을 말한다", () => {
    expect(errorOf("/loop abc 집")).toMatch(/1~20/);
    expect(errorOf(`/loop ${MAX_PI_LOOP + 1} 집`)).toMatch(/1~20/);
    expect(errorOf("/1s 집")).toMatch(/10s~2h/);
    expect(errorOf("/3h 집")).toMatch(/10s~2h/);
  });
  it("평문 지시는 라우트가 고른 경로로 조립된다", () => {
    expect(plainPiCommand("집 지어줘", "single", "map_a")).toEqual({ mode: "single", mapIds: ["map_a"], task: "집 지어줘", loop: 1 });
    expect(plainPiCommand("마을 셋", "team", "map_a")).toEqual({ mode: "team", mapIds: [], task: "마을 셋", loop: 1 });
    expect(plainPiCommand("집 지어줘", "single", null)).toEqual({ mode: "single", mapIds: [], task: "집 지어줘", loop: 1 });
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
