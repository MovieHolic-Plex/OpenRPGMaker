import { describe, expect, it } from "vitest";
import { createPiToolset, harvestFindToolsNames, resolvePiToolShape, selectPiToolDefinitions } from "@/ai/piAgent/toolAdapter";
import { TOOL_REGISTRY } from "@/editor/tools/toolRegistry";
import { createBlankProject } from "@/project/defaults";
import { piMapScopeGuard } from "@/ai/piAgent/protocol";

describe("piAgent toolAdapter", () => {
  it("살아 있는 레지스트리 툴을 전부 Pi 툴 모양으로 감싼다", () => {
    const live = TOOL_REGISTRY.filter((tool) => !tool.deprecated && tool.supersededBy === undefined);
    const tools = createPiToolset({ project: createBlankProject() });
    expect(tools.map((tool) => tool.name).sort()).toEqual([...new Set(live.map((tool) => tool.name))].sort());
    expect(tools.length).toBe(new Set(tools.map(tool => tool.name)).size);
    expect(selectPiToolDefinitions(undefined, { toolNames: [] })).toEqual([]);
    for (const tool of tools) {
      expect(tool.label).toBe(tool.name);
      expect(typeof tool.description).toBe("string");
      expect(tool.parameters).toBeTruthy();
      expect(typeof tool.execute).toBe("function");
      // Every registry tool, including newly discovered tools, must carry a policy.
      expect(tool.concurrency).toBe(live.find(def => def.name === tool.name)!.mode === "read" ? "shared" : "exclusive");
    }
  });

  it("도메인을 주면 그 도메인 + 범용 툴만 고른다", () => {
    const selected = selectPiToolDefinitions(["tile"]);
    expect(selected.length).toBeGreaterThan(0);
    for (const tool of selected) {
      expect(tool.deprecated).not.toBe(true);
      expect(!tool.domains || tool.domains.length === 0 || tool.domains.includes("tile")).toBe(true);
    }
    expect(selected.some((tool) => !tool.domains || tool.domains.length === 0)).toBe(true);
  });

  it("성공은 JSON 본문으로, 실패는 issues 를 실은 예외로 옮긴다", async () => {
    const ctx = { project: createBlankProject() };
    const calls: string[] = [];
    const tools = createPiToolset(ctx, { onCall: (record) => calls.push(`${record.name}:${record.result.ok}`) });
    const byName = new Map(tools.map((tool) => [tool.name, tool]));

    const create = byName.get("create_map");
    expect(create).toBeTruthy();
    const ok = await create!.execute("c1", { id: "map_pi", name: "파이 마을", width: 12, height: 10 });
    const body = JSON.parse(ok.content[0]!.text) as { ok: boolean; summary: string };
    expect(body.ok).toBe(true);
    expect(ctx.project.maps.map_pi).toBeTruthy();

    await expect(create!.execute("c2", { id: "map_pi", name: "중복", width: 12, height: 10 }))
      .rejects.toThrow(/"ok":false/);
    expect(calls).toEqual(["create_map:true", "create_map:false"]);
  });

  it("긴 읽기 data 는 잘라서 힌트를 붙인다", async () => {
    const ctx = { project: createBlankProject() };
    const tools = createPiToolset(ctx, { maxDataChars: 64 });
    const read = tools.find((tool) => tool.name === "get_database_records");
    expect(read).toBeTruthy();
    const out = await read!.execute("r1", { collection: "maps", include: "full" });
    const body = JSON.parse(out.content[0]!.text) as { dataTruncated?: boolean; dataPreview?: string; hint?: string };
    expect(body.dataTruncated).toBe(true);
    expect(body.dataPreview?.length).toBe(64);
    expect(body.hint).toMatch(/잘렸습니다/);
  });

  describe("에스컬레이션 해석기", () => {
    it("find_tools 결과에서 후보 이름을 수확한다", () => {
      const found = harvestFindToolsNames({
        ok: true,
        summary: "3개 발견",
        data: { matches: [{ name: "fill_region" }, { name: "set_project_settings" }, { noName: true }, "junk"] },
      });
      expect(found).toEqual(["fill_region", "set_project_settings"]);
      expect(harvestFindToolsNames({ ok: false, summary: "x" })).toEqual([]);
      expect(harvestFindToolsNames({ ok: true, summary: "x" })).toEqual([]);
      expect(harvestFindToolsNames({ ok: true, summary: "x", data: {} })).toEqual([]);
    });

    it("실행 경계 안의 이름만 셰이프로 만든다", async () => {
      const ctx = { project: createBlankProject() };
      // 쓰기 가능 실행 — 쓰기 툴도 만든다.
      expect(resolvePiToolShape(ctx, "set_project_settings")).toBeTruthy();
      expect(resolvePiToolShape(ctx, "set_project_settings")?.concurrency).toBe("exclusive");
      expect(resolvePiToolShape(ctx, "get_project_summary")?.concurrency).toBe("shared");
      // 읽기 전용 실행 — 쓰기 툴은 절대 못 만든다(질문 승격의 구조적 보장).
      expect(resolvePiToolShape(ctx, "set_project_settings", { readOnly: true })).toBeUndefined();
      expect(resolvePiToolShape(ctx, "get_project_summary", { readOnly: true })).toBeTruthy();
      // toolNames 는 하드 경계다 — 목록 밖 이름은 못 만든다(팀 역할 제한).
      expect(resolvePiToolShape(ctx, "set_project_settings", { toolNames: ["get_project_summary"] })).toBeUndefined();
      expect(resolvePiToolShape(ctx, "get_project_summary", { toolNames: ["get_project_summary"] })).toBeTruthy();
      // 레지스트리에 없는 이름·빈 이름은 언제나 undefined.
      expect(resolvePiToolShape(ctx, "not_a_tool")).toBeUndefined();
      expect(resolvePiToolShape(ctx, "")).toBeUndefined();
      // 만들어진 셰이프는 실제로 실행된다 — 같은 ctx·onCall 배선을 탄다.
      const calls: string[] = [];
      const shape = resolvePiToolShape(ctx, "set_project_settings", { onCall: (record) => calls.push(record.name) });
      const out = await shape!.execute("e1", { title: "승격됨" });
      expect(JSON.parse(out.content[0]!.text)).toMatchObject({ ok: true });
      expect(ctx.project.meta.title).toBe("승격됨");
      expect(calls).toEqual(["set_project_settings"]);
    });
  });

  describe("맵 묶음 범위 가드", () => {
    // run10 재현: 빈 시작 맵(map_blank_start)은 묶음 밖인데 문을 달았고, 병합이 그 맵을 버려 길이 끊겼다.
    function townProject() {
      const ctx = { project: createBlankProject() };
      const [create] = createPiToolset(ctx, { toolNames: ["create_map"] });
      return { ctx, create: create! };
    }

    it("묶음 밖 맵을 바꾸는 쓰기는 되돌리고 실패로 돌려준다", async () => {
      const { ctx, create } = townProject();
      await create.execute("c0", { id: "town", name: "마을", width: 48, height: 36 });
      const startMapId = ctx.project.startMapId;
      expect(startMapId).not.toBe("town");
      const before = ctx.project;
      const results: boolean[] = [];
      const tools = createPiToolset(ctx, { scopeMapIds: ["town"], onCall: (record) => results.push(record.result.ok) });
      const pair = tools.find((tool) => tool.name === "create_transfer_pair")!;
      await expect(pair.execute("t1", { a: { mapId: startMapId, x: 10, y: 8 }, b: { mapId: "town", x: 24, y: 22 } }))
        .rejects.toThrow(new RegExp(`${startMapId}.*set_start_position`, "s"));
      expect(ctx.project).toBe(before);
      expect(results).toEqual([false]);
    });

    it("묶음 안 맵과 묶음 아래 새 실내 맵은 통과한다", async () => {
      const { ctx, create } = townProject();
      await create.execute("c0", { id: "town", name: "마을", width: 48, height: 36 });
      await create.execute("c1", { id: "house", name: "집", width: 12, height: 10 });
      // 실내 맵을 마을 아래로 옮긴다 — 묶음(mapTree 부분 트리) 안이다.
      const root = ctx.project.mapTree;
      root.children = root.children.filter((child) => child.mapId !== "house");
      root.children.find((child) => child.mapId === "town")!.children.push({ mapId: "house", children: [] });
      const tools = createPiToolset(ctx, { scopeMapIds: ["town"] });
      const pair = tools.find((tool) => tool.name === "create_transfer_pair")!;
      const out = await pair.execute("t2", { a: { mapId: "house", x: 6, y: 9 }, b: { mapId: "town", x: 24, y: 22 } });
      expect(JSON.parse(out.content[0]!.text)).toMatchObject({ ok: true });
      const start = tools.find((tool) => tool.name === "set_start_position")!;
      await start.execute("s1", { mapId: "town", x: 5, y: 5 });
      expect(ctx.project.startMapId).toBe("town");
    });

    it("평문(scopeStrict=false)이라도 병합 실행이면 가드가 켜지고, 거부 문구는 DB·시스템은 된다고 말한다", async () => {
      const guard = piMapScopeGuard({ mapIds: ["town"], scopeStrict: false, mapBundleMerge: true });
      expect(guard).toEqual({ scopeMapIds: ["town"], scopeAllowsSystem: true });
      const { ctx, create } = townProject();
      await create.execute("c0", { id: "town", name: "마을", width: 48, height: 36 });
      const startMapId = ctx.project.startMapId;
      const before = ctx.project;
      const tools = createPiToolset(ctx, guard);
      const pair = tools.find((tool) => tool.name === "create_transfer_pair")!;
      const error = await pair.execute("t1", { a: { mapId: startMapId, x: 10, y: 8 }, b: { mapId: "town", x: 24, y: 22 } }).catch((e: Error) => e);
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toMatch(/DB·시스템.*(편집|수정).*할 수 있/s);
      expect((error as Error).message).toMatch(/다른 맵/);
      expect(ctx.project).toBe(before);
      // 묶음 안 맵·DB 쓰기는 통과한다.
      const start = tools.find((tool) => tool.name === "set_start_position")!;
      await start.execute("s1", { mapId: "town", x: 5, y: 5 });
      const settings = tools.find((tool) => tool.name === "set_project_settings")!;
      await settings.execute("p1", { title: "승격됨" });
      expect(ctx.project.meta.title).toBe("승격됨");
    });

    it("단일 평문 턴(scopeStrict=false, 병합 없음)은 가드를 켜지 않는다", () => {
      expect(piMapScopeGuard({ mapIds: ["town"], scopeStrict: false })).toEqual({});
      expect(piMapScopeGuard({ mapIds: [], scopeStrict: true, mapBundleMerge: true })).toEqual({});
      // 옛 호출자(CLI·팀원)는 scopeStrict 를 비워 보낸다 — 기존처럼 계약 가드.
      expect(piMapScopeGuard({ mapIds: ["town"] })).toEqual({ scopeMapIds: ["town"], scopeAllowsSystem: false });
    });

    it("묶음 밖에 새로 만든 맵은 막지 않고 경고를 붙인다", async () => {
      const { ctx, create } = townProject();
      await create.execute("c0", { id: "town", name: "마을", width: 48, height: 36 });
      const results: Array<{ ok: boolean; warnings?: readonly string[] }> = [];
      const tools = createPiToolset(ctx, { scopeMapIds: ["town"], onCall: (record) => results.push(record.result) });
      const createMap = tools.find((tool) => tool.name === "create_map")!;
      const out = await createMap.execute("c1", { id: "house", name: "집", width: 12, height: 10 });
      const body = JSON.parse(out.content[0]!.text) as { ok: boolean; warnings?: string[] };
      expect(body.ok).toBe(true);
      expect(ctx.project.maps.house).toBeTruthy();
      const warning = body.warnings?.find((w) => w.includes("house"));
      expect(warning).toMatch(/작업 범위.*밖.*버려.*manage_map_tree.*town/s);
      expect(results[0]!.warnings).toContain(warning);
    });
  });
});
