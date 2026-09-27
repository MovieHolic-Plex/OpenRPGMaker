import { describe, expect, it } from "vitest";
import { mergesMapBundles, parsePiCommand } from "@/editor/panels/aiPiAgentCommand";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools";
// @ts-expect-error plain ESM JS module
import { handleCompanionRequest, isCompanionPath } from "../scripts/lib/ohMyPiHttp.mjs";

describe("맵 묶음 병합 여부 = 가드 신호", () => {
  it("평문이라도 에이전트가 둘 이상이면 병합한다(팀 제외)", () => {
    expect(mergesMapBundles({ team: false, mapIds: ["a", "b"], scopedByUser: false, groupCount: 2 })).toBe(true);
    expect(mergesMapBundles({ team: false, mapIds: ["a"], scopedByUser: true, groupCount: 1 })).toBe(true);
    expect(mergesMapBundles({ team: false, mapIds: ["a"], scopedByUser: false, groupCount: 1 })).toBe(false);
    expect(mergesMapBundles({ team: true, mapIds: ["a", "b"], scopedByUser: true, groupCount: 1 })).toBe(false);
    expect(mergesMapBundles({ team: false, mapIds: [], scopedByUser: false, groupCount: 1 })).toBe(false);
  });
});

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
  // scopedByUser 는 이 갈래에서만 켜진다 — 사용자가 맵을 **직접 적은** 턴과 현재 맵으로 채운
  // 기본값을 구별한다. 병합이 범위 밖을 버리는 것은 전자뿐이다(2026-09-17).
  it("실존하는 맵 id 목록은 병렬 범위로 읽고, 사용자가 정한 범위로 표시한다", () => {
    expect(parsePiCommand("/pi map_a,map_b 집 한 채", ctx.project, "map_a")).toEqual({ mode: "single", mapIds: ["map_a", "map_b"], currentMapId: "map_a", scopedByUser: true, task: "집 한 채" });
    expect(parsePiCommand("/pi map_a,map_a 집", ctx.project, null)).toEqual({ mode: "single", mapIds: ["map_a"], currentMapId: null, scopedByUser: true, task: "집" });
    // 없는 id 는 지시문의 첫 단어일 뿐이다.
    expect(parsePiCommand("/pi map_zzz 집", ctx.project, "map_a")).toEqual({ mode: "single", mapIds: ["map_a"], currentMapId: "map_a", task: "map_zzz 집" });
  });
  it("/team 은 /pi team 과 같은 뜻이다 — Pi 가 유일한 경로라 접두사는 의식일 뿐이다", () => {
    // currentMapId 는 팀장이 「여기」를 푸는 기준이라 팀 턴에도 늘 실린다(2026-09-15) — 이 기대값은
    // 그때 갱신되지 않아 계속 빨간불이었다.
    expect(parsePiCommand("/team 마을 셋", ctx.project, "map_a")).toEqual({ mode: "team", mapIds: [], currentMapId: "map_a", task: "마을 셋" });
    expect(parsePiCommand("/pi team 마을 셋", ctx.project, "map_a")).toEqual({ mode: "team", mapIds: [], currentMapId: "map_a", task: "마을 셋" });
    expect(parsePiCommand("/team map_a,map_b 집 두 채", ctx.project, "map_a")).toEqual({ mode: "team", mapIds: ["map_a", "map_b"], currentMapId: "map_a", scopedByUser: true, task: "집 두 채" });
    expect(parsePiCommand("/pi team map_a,map_b 집 두 채", ctx.project, "map_a")).toEqual({ mode: "team", mapIds: ["map_a", "map_b"], currentMapId: "map_a", scopedByUser: true, task: "집 두 채" });
    // 팀 키워드로 시작하는 일반 단어는 명령이 아니다.
    expect(parsePiCommand("/teamspeak 열어줘", ctx.project, "map_a")).toBeNull();
    expect(parsePiCommand("/team", ctx.project, "map_a")).toEqual({ mode: "team", mapIds: [], currentMapId: "map_a", task: "" });
  });
});

describe("동반 라우터 /v1/agent/run", () => {
  it("경로를 인식하고 어댑터의 NDJSON 을 실행 기록을 거쳐 seq 를 붙여 넘긴다", async () => {
    expect(isCompanionPath("/v1/agent/run?provider=openai-codex")).toBe(true);
    expect(isCompanionPath("/v1/agent/cancel")).toBe(true);
    const seen: unknown[] = [];
    const ndjson = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new TextEncoder().encode('{"type":"turn","index":1}\n')); c.close(); } });
    const adapters = { runAgent: async (provider: string, body: unknown, options: unknown) => { seen.push([provider, body, options]); return { stream: true, ndjson }; } };
    const result = await handleCompanionRequest(
      { method: "POST", url: "/v1/agent/run?provider=openai-codex", headers: {}, body: { task: "x", mapIds: [], project: {} } },
      adapters,
    );
    expect(result).toMatchObject({ status: 200, stream: true });
    // runId 를 안 보낸 옛 클라이언트도 호스트가 번호를 매겨 헤더로 알려 준다.
    expect(result.headers?.["X-Oprn-Run-Id"]).toMatch(/^[A-Za-z0-9-]{8,64}$/);
    const text = await new Response(result.ndjson).text();
    expect(text.trim().split("\n").map((line) => JSON.parse(line))).toEqual([{ seq: 0, type: "turn", index: 1 }]);
    expect(seen).toHaveLength(1);
    const [provider, body, options] = seen[0] as [string, unknown, { signal?: AbortSignal }];
    expect(provider).toBe("openai-codex");
    expect(body).toEqual({ task: "x", mapIds: [], project: {} });
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });
  it("어댑터가 없으면 501", async () => {
    const result = await handleCompanionRequest({ method: "POST", url: "/v1/agent/run", headers: {}, body: {} }, {});
    expect(result.status).toBe(501);
  });
});
