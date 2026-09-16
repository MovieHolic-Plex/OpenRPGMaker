import { describe, expect, it } from "vitest";
import { createPiToolset, harvestFindToolsNames, resolvePiToolShape, selectPiToolDefinitions } from "@/ai/piAgent/toolAdapter";
import { TOOL_REGISTRY } from "@/editor/tools/toolRegistry";
import { createBlankProject } from "@/project/defaults";

describe("piAgent toolAdapter", () => {
  it("살아 있는 레지스트리 툴을 전부 Pi 툴 모양으로 감싼다", () => {
    const live = TOOL_REGISTRY.filter((tool) => !tool.deprecated);
    const tools = createPiToolset({ project: createBlankProject() });
    expect(tools.map((tool) => tool.name).sort()).toEqual(live.map((tool) => tool.name).sort());
    for (const tool of tools) {
      expect(tool.label).toBe(tool.name);
      expect(typeof tool.description).toBe("string");
      expect(tool.parameters).toBeTruthy();
      expect(typeof tool.execute).toBe("function");
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
});
