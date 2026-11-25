import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { QUEST_TOOLS } from "@/editor/tools/questTools";
import { parseQuestDef, QUEST_DEF_EXAMPLE } from "@/editor/tools/questToolSchemas";
import { runTool } from "@/editor/tools/toolRunner";
import { isStepQuestDef } from "@/project/quest/questDef";
import type { JsonSchema, ToolContext } from "@/editor/tools/types";
import { createPiToolset, harvestFindToolsNames, resolvePiToolShape, selectPiToolDefinitions } from "@/ai/piAgent/toolAdapter";
import { TOOL_REGISTRY, getTool } from "@/editor/tools/toolRegistry";
import { piMapScopeGuard } from "@/ai/piAgent/protocol";
import assert from "node:assert/strict";
import { deserialize, serialize } from "@/project/io";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { isolateTimers } from "./mergedTeardown";

describe("questToolContract", () => {
  isolateTimers();
  const MAP = "map_blank_start";
  const base = () => ({
    key: "q_contract", title: "안부 전하기", summary: "약초꾼에게 안부를 전해주세요.",
    giver: { create: { mapId: MAP, x: 5, y: 5, name: "촌장" } },
    steps: [{ kind: "talk", target: { create: { mapId: MAP, x: 8, y: 5, name: "약초꾼" } } }],
  });
  const schema = (name: string) => QUEST_TOOLS.find((tool) => tool.name === name)!.parameters;
  function field(root: JsonSchema, ...path: string[]): JsonSchema {
    return path.reduce((node, key) => key === "[]" ? node.items! : node.properties![key], root);
  }
  describe("quest model-facing contract", () => {
    it("노출 스키마가 컴파일러의 중첩 입력과 실제 graph 조건만 설명한다", () => {
      const create = schema("create_quest");
      expect(field(create, "def", "giver", "create").required).toEqual(["mapId", "x", "y", "name"]);
      expect(field(create, "def", "steps", "[]", "target", "create").required).toContain("name");
      expect(field(create, "def", "steps", "[]", "at").required).toEqual(["mapId", "x", "y"]);
      expect(field(create, "def", "steps", "[]", "sources", "[]", "troopId").type).toBe("string");
      const condition = field(schema("define_quest"), "nodes", "[]", "completesWhen");
      expect(field(condition, "kind").enum).toEqual(["switch", "variable", "storyFlag"]);
      expect(field(condition, "all", "[]", "kind").enum).toEqual(["switch", "variable", "storyFlag"]);
      expect(field(condition, "value").description).toContain("boolean");
      expect(field(condition, "flagId").type).toBe("string");
    });

    it.each([
      [{ kind: "kill", troopId: "tr_wolves", mapId: MAP, x: 12, y: 10 }, "def.steps[0].at"],
      [{ kind: "talk", mapId: MAP, x: 14, y: 17, lines: ["보고합니다."] }, "def.steps[0].target"],
      [{ kind: "collect", itemId: "it_herb", count: 2 }, "def.steps[0].sources"],
      [{ kind: "collect", itemId: "it_herb", count: 0, sources: [] }, "def.steps[0].count"],
      [{ kind: "collect", itemId: "it_herb", count: 1, sources: [{ kind: "drop", mapId: MAP, x: 1, y: 1 }] }, "def.steps[0].sources[0].troopId"],
      [{ kind: "kill", troopId: "tr_wolves", at: { mapId: MAP, x: null, y: 1 } }, "def.steps[0].at.x"],
      [{ kind: "talk", target: { create: {} } }, "def.steps[0].target.create.mapId"],
      [{ kind: "reach", mapId: MAP, x: 1 }, "def.steps[0].y"],
    ])("잘못된 단계는 %j에서 누락 경로와 정답 구조를 반환한다", (step, path) => {
      const project = createBlankProject();
      const before = JSON.stringify(project);
      const ctx = { project };
      const result = runTool(ctx, "create_quest", { def: { ...base(), steps: [step] } }, { dryRun: false });
      expect(result.ok).toBe(false);
      const message = JSON.stringify(result);
      expect(message).toContain(path);
      expect(message).toContain("troopId");
      expect(message).toContain("at");
      expect(message).not.toMatch(/Cannot read properties|후처리 실패|TypeError/);
      expect(ctx.project).toBe(project);
      expect(JSON.stringify(project)).toBe(before);
    });

    it.each([
      [{ create: {} }, "def.giver.create.mapId"],
      [{ mapId: MAP }, "def.giver.eventId"],
      [null, "def.giver"],
    ])("잘못된 giver도 컴파일 전에 거부한다", (giver, path) => {
      expect(() => parseQuestDef({ ...base(), giver })).toThrow(path);
    });

    it("최소 정답 예시가 실제 create_quest를 통과하고 steps 메타를 보존한다", () => {
      const ctx = { project: createBlankProject() };
      const result = runTool(ctx, "create_quest", QUEST_DEF_EXAMPLE, { dryRun: false });
      expect(result.ok, JSON.stringify(result)).toBe(true);
      expect(result.data).toMatchObject({ questId: "village_errand", kind: "steps", stepCount: 1 });
      expect(ctx.project.quests).toHaveLength(1);
      expect(isStepQuestDef(ctx.project.quests?.[0])).toBe(true);
    });

    it("reach의 flat 좌표는 kill at 정규화 때문에 거부되지 않는다", () => {
      const ctx = { project: createBlankProject() };
      const result = runTool(ctx, "create_quest", { def: { ...base(), steps: [{ kind: "reach", mapId: MAP, x: 8, y: 5 }] } }, { dryRun: false });
      expect(result.ok, JSON.stringify(result)).toBe(true);
    });

    it("같은 ID의 1노드 graph로 원래 단계 정의를 지울 수 없다", () => {
      const ctx = { project: createBlankProject() };
      const created = runTool(ctx, "create_quest", { def: base() }, { dryRun: false });
      expect(created.ok, JSON.stringify(created)).toBe(true);
      const before = JSON.stringify(ctx.project);
      const result = runTool(ctx, "define_quest", {
        id: "q_contract", title: "축소된 퀘스트",
        nodes: [{ id: "start", description: "수락", completesWhen: { kind: "switch", switchId: "sw_q_contract_started", value: true } }],
        edges: [],
      }, { dryRun: false });
      expect(result.ok).toBe(false);
      expect(result.issues?.[0]?.code).toBe("quest-kind-conflict");
      expect(JSON.stringify(ctx.project)).toBe(before);
    });

    it.each(["gold", "item", "selfSwitch", "all"])("graph의 미지원 %s 조건에는 지원 형태를 안내한다", (kind) => {
      const result = runTool({ project: createBlankProject() }, "define_quest", {
        id: "q_invalid", title: "입력 오류",
        nodes: [{ id: "reward", description: "보상", completesWhen: { kind, amount: 100 } }], edges: [],
      });
      expect(result.ok).toBe(false);
      expect(JSON.stringify(result)).toContain("storyFlag");
      expect(JSON.stringify(result)).toContain("지원하지 않습니다");
    });

    it("all 조건과 storyFlag의 boolean/number 값이 실제 graph 정의에 도달한다", () => {
      const project = createBlankProject();
      project.switches.push({ id: "sw_q_ready", name: "수락" });
      project.variables.push({ id: "var_q_count", name: "수집" });
      project.storyFlags = [{ id: "quest_count", kind: "variable", targetId: "var_q_count", description: "수집 개수" }];
      // Schema + graph parser only: write-site lint belongs to the normal runner and is covered by questGraph.test.ts.
      const tool = QUEST_TOOLS.find((entry) => entry.name === "define_quest")!;
      const result = tool.run(project, {
        id: "q_all", title: "여러 조건",
        nodes: [{ id: "all", description: "수락 후 수집", completesWhen: { all: [
          { kind: "switch", switchId: "sw_q_ready", value: true },
          { kind: "storyFlag", flagId: "quest_count", op: ">=", value: 2 },
        ] } }], edges: [],
      });
      expect(result.summary).toContain("1 nodes");
    });
  });
});

describe("recommendBgm", () => {
  isolateTimers();
  describe("piAgentToolAdapter", () => {
    isolateTimers();
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
  });
  // 계약: upsert_event 로 만든 presentItem 이 run_scene_test 로 끝까지 검증된다.
  // 추리 게임 도그푸딩에서 「증거를 들이민다」가 choices + 소지 조건 흉내뿐이라 틀린 증거·
  // 안 낸 경우를 헤드리스로 가를 수 없었다. 이 테스트가 도구 → 저장 → 실행 → 검증 한 바퀴를 잠근다.
  describe("presentItemToolContract", () => {
    isolateTimers();
    function fixture() {
      const ctx = { project: createBlankProject() };
      const template = ctx.project.database.items[0];
      assert(template);
      ctx.project.database.items.push(
        { ...template, id: "item_knife", name: "피 묻은 칼" },
        { ...template, id: "item_letter", name: "찢긴 편지" },
      );
      ctx.project.switches.push({ id: "sw_confessed", name: "자백" }, { id: "sw_wrong", name: "헛짚음" }, { id: "sw_silent", name: "안 냄" });
      const mapId = ctx.project.startMapId;
      const { x, y } = ctx.project.startPos;
      const upsert = runTool(ctx, "upsert_event", {
        mapId,
        event: {
          id: "ev_suspect", name: "용의자", x, y: y - 1,
          pages: [{
            id: "p1", name: "심문", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same",
            movement: { type: "fixed", speed: 3, frequency: 3 },
            commands: [{
              kind: "presentItem",
              prompt: "증거를 제시하라",
              itemIds: ["item_knife", "item_letter"],
              options: [{ itemId: "item_knife", branch: [{ kind: "setSwitch", switchId: "sw_confessed", value: true }] }],
              otherwiseBranch: [{ kind: "setSwitch", switchId: "sw_wrong", value: true }],
              cancelBranch: [{ kind: "setSwitch", switchId: "sw_silent", value: true }],
              consume: true,
            }],
          }],
        },
      });
      assert(upsert.ok, upsert.summary);
      const scene = (steps: unknown[]) => {
        const tool = runTool(ctx, "run_scene_test", {
          mapId, start: { x, y },
          steps: [{ kind: "set", inventory: { item_knife: 1, item_letter: 1 }, facing: "up" }, { kind: "interact", eventId: "ev_suspect" }, ...steps],
        });
        assert(tool.ok, tool.summary);
        return tool.data as { ok: boolean; failureReason?: string; stepsRun: number; totalSteps: number };
      };
      return { ctx, mapId, scene };
    }
    describe("presentItem: upsert_event → run_scene_test", () => {
      it("도구 설명과 스키마가 presentItem 을 안내한다", () => {
        const upsert = getTool("upsert_event");
        expect(JSON.stringify(upsert?.parameters)).toContain("presentItem");
        expect(getTool("run_scene_test")?.description).toContain("{kind:'present',itemId?}");
      });

      it("맞는 증거 → 정답 분기, consume 으로 소모", () => {
        const { scene } = fixture();
        const result = scene([{ kind: "present", itemId: "item_knife" }, { kind: "expect", switchOn: "sw_confessed", switchOff: ["sw_wrong", "sw_silent"], inventoryCount: { item_knife: 0, item_letter: 1 }, interactionComplete: true }]);
        expect(result, result.failureReason).toMatchObject({ ok: true, stepsRun: result.totalSteps });
      });

      it("틀린 증거 → otherwiseBranch", () => {
        const { scene } = fixture();
        const result = scene([{ kind: "present", itemId: "item_letter" }, { kind: "expect", switchOn: "sw_wrong", switchOff: "sw_confessed", inventoryCount: { item_letter: 1 } }]);
        expect(result, result.failureReason).toMatchObject({ ok: true, stepsRun: result.totalSteps });
      });

      it("안 내고 닫음 → cancelBranch", () => {
        const { scene } = fixture();
        const result = scene([{ kind: "present" }, { kind: "expect", switchOn: "sw_silent" }]);
        expect(result, result.failureReason).toMatchObject({ ok: true, stepsRun: result.totalSteps });
      });

      it("목록에 없는 아이템을 내려 하면 그 스텝에서 실패한다", () => {
        const { scene } = fixture();
        const result = scene([{ kind: "present", itemId: "item_ghost" }]);
        expect(result.ok).toBe(false);
        expect(result.failureReason).toMatch(/item_ghost/);
      });

      it("저장 왕복 후에도 같은 이벤트가 남는다", () => {
        const { ctx, mapId } = fixture();
        const restored = deserialize(serialize(ctx.project));
        const event = restored.maps[mapId]?.events.find((entry) => entry.id === "ev_suspect");
        expect(event?.pages?.[0]?.commands[0]).toMatchObject({ kind: "presentItem", consume: true, options: [{ itemId: "item_knife" }] });
      });

      it("없는 아이템을 정답으로 넣으면 upsert_event 가 거부한다", () => {
        const ctx = { project: createBlankProject() };
        const result = runTool(ctx, "upsert_event", {
          mapId: ctx.project.startMapId,
          event: { id: "ev_bad", x: 1, y: 1, trigger: { kind: "action" }, commands: [{ kind: "presentItem", options: [{ itemId: "item_nope", branch: [] }] }] },
        });
        expect(result.ok).toBe(false);
      });
    });
    describe("presentItem lint", () => {
      it("없는 아이템은 참조 오류, 후보 밖 정답·정답 없음은 경고", async () => {
        const { projectLint } = await import("@/project/lint/projectLint");
        const { ctx, mapId } = fixture();
        const page = ctx.project.maps[mapId]!.events.find((entry) => entry.id === "ev_suspect")!.pages![0]!;
        expect(projectLint(ctx.project, { skipRoundtrip: true }).filter((issue) => issue.code.startsWith("presentItem"))).toEqual([]);

        page.commands = [
          { kind: "presentItem", itemIds: ["item_letter"], options: [{ itemId: "item_knife", branch: [] }] },
          { kind: "presentItem", options: [] },
          { kind: "presentItem", options: [{ itemId: "item_ghost", branch: [] }] },
        ];
        const issues = projectLint(ctx.project, { skipRoundtrip: true });
        expect(issues.filter((issue) => issue.code.startsWith("presentItem")).map((issue) => [issue.severity, issue.code]))
          .toEqual([["warning", "presentItem.option-not-offered"], ["warning", "presentItem.no-options"]]);
        expect(issues.some((issue) => issue.code === "reference-validation" && issue.message.includes("item_ghost"))).toBe(true);
      });
    });
  });
  // recommend_bgm — 분위기/장면 질의 → 후보 10곡 + 전체 설명 1호출.
  // list_resources(제목만, 240자 잘림) + get_audio_resource N번의 1+N 호출을
  // 한 번으로 합친 읽기 툴. 제목 먼저 훑고 설명까지 보고 고르는 계약을 강제한다.
  describe("recommendBgm", () => {
    isolateTimers();
    function run(ctx: ToolContext, args: Record<string, unknown>) {
      return runTool(ctx, "recommend_bgm", args, { dryRun: false });
    }
    describe("recommend_bgm RED", () => {
      it("등록된 읽기 툴이다", () => {
        expect(getTool("recommend_bgm")?.mode).toBe("read");
      });

      it("분위기 질의에 후보 10곡 + 전체 설명을 한 번에 돌려준다", () => {
        const ctx: ToolContext = { project: createEmptyToolProject() };
        const result = run(ctx, { query: "슬픈 마을", limit: 10 });
        expect(result.ok, result.summary).toBe(true);
        const data = result.data as {
          candidates: Array<{
            resourceId: string; name: string; score: number;
            description: string; descriptionTruncated: boolean; descriptionSource: string;
          }>;
          total: number;
        };
        expect(data.candidates).toHaveLength(10);
        for (const candidate of data.candidates) {
          // 전체 설명 — 잘림 없음
          expect(candidate.descriptionTruncated).toBe(false);
          expect(candidate.description.length).toBeGreaterThan(0);
          expect(typeof candidate.score).toBe("number");
        }
      });

      it("query 없이 장면만으로도 후보를 돌려준다", () => {
        const ctx: ToolContext = { project: createEmptyToolProject() };
        const result = run(ctx, { scene: "village", limit: 10 });
        expect(result.ok, result.summary).toBe(true);
        const data = result.data as { candidates: unknown[] };
        expect(data.candidates).toHaveLength(10);
      });

      it("query도 scene도 없으면 거절한다", () => {
        const ctx: ToolContext = { project: createEmptyToolProject() };
        const result = run(ctx, { limit: 10 });
        expect(result.ok).toBe(false);
      });
    });
  });
});
