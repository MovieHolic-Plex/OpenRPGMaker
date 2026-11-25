import { describe, expect, it } from "vitest";
import { allTools, getTool, runTool, toOpenAiTools, type ToolContext } from "@/editor/tools";
import { createBlankMap, createBlankProject } from "@/project/defaults";
import type { GameEvent, Project } from "@/project/types";
import { isolateTimers } from "./mergedTeardown";

// 생활(농사·낚시·동물) 시스템이 닫혀 있는 동안(electron/shared/lifeSim.ts LIFE_SIM_ENABLED=false) 조수 도구 목록의 계약.
// 닫을 16개는 레지스트리에서 빠지고, JRPG 상점·가방 「조합」·폴른 스타 공방이 쓰는 제작법·강화·판매가와 공포 장르의 목숨 꽃은 남는다.
// 목록은 소스의 집합을 읽지 않고 여기에 적는다 — 소스가 슬그머니 바뀌어도 이 시험이 잡는다.
describe("lifeSimToolClosure", () => {
  isolateTimers();
  const CLOSED = [
    "upsert_life_skill", "upsert_life_system", "upsert_tool_action", "configure_life_economy",
    "upsert_fish_species", "delete_fish_species", "configure_fishing", "configure_seasonal_forage", "configure_museum", "configure_collections",
    "upsert_farm_building_type", "upsert_home_decoration_type", "upsert_farm_animal_building", "set_session_farm_state",
    "create_farm_plot", "define_crop",
  ];
  const KEPT = ["upsert_craft_recipe", "delete_craft_recipe", "upsert_item_upgrade", "set_sell_prices", "set_life_flower"];
  describe("생활 시스템 닫힘 — 도구 레지스트리", () => {
    it("allTools() 이름에 닫을 16개는 0개이고 남길 5개는 모두 있다", () => {
      const names = new Set(allTools().map((tool) => tool.name));
      expect(CLOSED).toHaveLength(16);
      expect(CLOSED.filter((name) => names.has(name))).toEqual([]);
      expect(KEPT.filter((name) => !names.has(name))).toEqual([]);
    });
  });
});

describe("viewFocusTool", () => {
  isolateTimers();
  function merchant(id = "ev_hana", name = "상인 하나", x = 6): GameEvent {
    return {
      id,
      x,
      y: 9,
      trigger: { kind: "action" },
      commands: [],
      pages: [
        {
          id: `${id}_page_1`,
          name,
          conditions: [],
          graphic: {},
          trigger: { kind: "action" },
          priority: "same",
          movement: { type: "fixed", speed: 3, frequency: 3 },
          commands: [],
        },
      ],
    };
  }
  function fixture(): Project {
    const project = createBlankProject();
    const start = project.maps[project.startMapId];
    if (!start) throw new Error("blank project has no start map");
    start.name = "햇살 마을";
    start.events = [merchant(), merchant("ev_dul", "상인 둘", 10)];
    const house = createBlankMap("상인 하나의 집", 20, 16);
    house.id = "map_house_interior_1";
    project.maps[house.id] = house;
    return project;
  }
  function context(project: Project): ToolContext {
    return { project };
  }
  function focus(project: Project, args: Record<string, unknown>) {
    return runTool(context(project), "focus_editor_view", args);
  }
  describe("focus_editor_view", () => {
    it("is registered as a read tool", () => {
      const tool = getTool("focus_editor_view");

      expect(tool?.mode).toBe("read");
    });

    // 노출되지 않으면 기능이 없는 것과 같다 — "어디야?" 는 도메인 상황을 가리지 않고 들어오므로
    // 타일·이벤트처럼 상한(40) 트림이 세게 걸리는 모드에서도 남아야 한다.
    it("stays exposed to the model in every tool mode", () => {
      for (const mode of ["map", "tile", "event", "quest", "system"] as const) {
        const exposed = new Set(toOpenAiTools(undefined, { mode }).map((entry) => entry.function.name));
        expect(exposed.has("focus_editor_view"), `mode=${mode}`).toBe(true);
      }
    });

    it("핀이 대표 도구를 밀어내지 않고 주요 모드에 함께 노출된다", () => {
      const expectations = {
        map: [],
        tile: [],
        event: ["set_scene_mood", "create_transfer_pair"],
      } as const;

      for (const [mode, representativeTools] of Object.entries(expectations) as [keyof typeof expectations, readonly string[]][]) {
        const exposed = new Set(toOpenAiTools(undefined, { mode }).map((entry) => entry.function.name));
        expect(exposed.has("focus_editor_view"), `mode=${mode}`).toBe(true);
        for (const toolName of representativeTools) {
          expect(exposed.has(toolName), `mode=${mode}, tool=${toolName}`).toBe(true);
        }
      }
    });

    it("맵 이름을 맵 전체 영역으로 해석한다", () => {
      const project = fixture();

      const result = focus(project, { query: "상인 하나의 집" });

      expect(result.ok).toBe(true);
      expect(result.data).toEqual({
        mapId: "map_house_interior_1",
        x: 0,
        y: 0,
        w: 20,
        h: 16,
        label: "상인 하나의 집",
        kind: "map",
      });
    });

    it("resolves an event name to its own tile", () => {
      const project = fixture();

      const result = focus(project, { query: "상인 하나" });

      expect(result.ok).toBe(true);
      expect(result.data).toMatchObject({
        mapId: project.startMapId,
        x: 6,
        y: 9,
        w: 1,
        h: 1,
        kind: "event",
        eventId: "ev_hana",
      });
    });

    it("서로 다른 부분 이름이 여럿이면 후보 이름을 알리고 정확한 이름은 찾는다", () => {
      const project = fixture();

      const ambiguous = focus(project, { query: "상인" });
      const exact = focus(project, { query: "상인 하나" });

      expect(ambiguous.ok).toBe(false);
      expect(ambiguous.summary).toContain("상인 하나");
      expect(ambiguous.summary).toContain("상인 둘");
      expect(exact.ok).toBe(true);
      expect(exact.data).toMatchObject({ eventId: "ev_hana" });
    });

    it("clamps an explicit rectangle into the map", () => {
      const project = fixture();

      const result = focus(project, { mapId: "map_house_interior_1", x: 18, y: 14, w: 40, h: 40 });

      expect(result.data).toMatchObject({ mapId: "map_house_interior_1", x: 18, y: 14, w: 2, h: 2 });
    });

    it("fails with a name the project does not have", () => {
      const result = focus(fixture(), { query: "용의 성" });

      expect(result.ok).toBe(false);
      expect(result.summary).toContain("찾지 못했습니다");
    });

    it("mapId가 있으면 모호한 query보다 좌표 지정을 우선한다", () => {
      const project = createBlankProject();
      const first = createBlankMap("여관", 20, 16);
      first.id = "map_inn_a";
      const second = createBlankMap("여관", 24, 18);
      second.id = "map_inn_b";
      project.maps = { [first.id]: first, [second.id]: second };
      project.startMapId = first.id;

      const result = focus(project, { query: "여관", mapId: second.id, x: 4, y: 5 });

      expect(result.ok).toBe(true);
      expect(result.data).toMatchObject({ mapId: second.id, x: 4, y: 5 });
    });

    it("같은 이름이 여러 곳이면 임의로 고르지 않는다", () => {
      const project = createBlankProject();
      const first = createBlankMap("여관", 20, 16);
      first.id = "map_inn_a";
      const second = createBlankMap("여관", 20, 16);
      second.id = "map_inn_b";
      project.maps = { [first.id]: first, [second.id]: second };
      project.startMapId = first.id;

      const result = focus(project, { query: "여관" });

      expect(result.ok).toBe(false);
      expect(result.summary).toContain("2곳");
    });

    it("needs either a name or a map id", () => {
      const result = focus(fixture(), {});

      expect(result.ok).toBe(false);
    });

    it("changes nothing in the project", () => {
      const project = fixture();
      const before = JSON.stringify(project);

      focus(project, { query: "상인 하나" });

      expect(JSON.stringify(project)).toBe(before);
    });
  });
});

describe("worldCanonTool", () => {
  isolateTimers();
  describe("set_world_canon", () => {
    it("stores the world backbone and preserves omitted fields on a later patch", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const first = runTool(ctx, "set_world_canon", {
        canon: {
          name: "아르카디아",
          premise: "왕국의 봉인이 무너지고 변방의 주인공이 움직인다.",
          era: "봉건 중세",
          tones: ["mythic", "grim"],
          laws: { power: { present: true, note: "혈통과 계약이 함께 작동한다" } },
        },
      });
      expect(first.ok, first.summary).toBe(true);
      const second = runTool(ctx, "set_world_canon", { canon: { techCeiling: "화약 이전" } });
      expect(second.ok, second.summary).toBe(true);
      expect(ctx.project.worldCanon).toMatchObject({ name: "아르카디아", era: "봉건 중세", techCeiling: "화약 이전" });
      expect(ctx.project.worldCanon?.laws?.power?.present).toBe(true);
    });
  });
});
