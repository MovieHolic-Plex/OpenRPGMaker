// 청사진(맵 위 밑그림 오버레이) 강화 — 2026-09-03 적대적 리뷰 실측 결함의 회귀 테스트.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAgentBlueprint,
  getAgentBlueprintState,
  markAgentBlueprintProgress,
  setAgentBlueprintFromSpec,
  settleAgentBlueprintTurn,
  type BlueprintEntry,
} from "@/editor/agentBlueprint";
import {
  AgentBlueprintRenderer,
  BLUEPRINT_MAX_LABELS,
  blueprintLabelLayout,
  blueprintStatusStyle,
} from "@/editor/agentBlueprintRenderer";
import type { BuildSpec } from "@/ai/buildSpec";

const WRITE = { write: true } as const;

afterEach(() => {
  clearAgentBlueprint();
});

function entry(patch: Partial<BlueprintEntry> = {}): BlueprintEntry {
  return { id: "a", kind: "house", label: "집", x: 0, y: 0, w: 4, h: 4, order: 1, status: "planned", ...patch };
}

describe("재제출된 밑그림은 진행을 사각형 겹침으로 물려받는다", () => {
  it("에셋 id·사각형이 바뀐 재제출에서도 짓는 중이던 집은 planned 로 되감기지 않고, 정산에서 done 이 된다", () => {
    // break: entryShapeKey 로만 물려받으면 새 id·새 사각형의 집이 planned 로 떨어져 다 지은 맵 위에 파랑 계획이 남는다(run1 실측).
    setAgentBlueprintFromSpec({ mapId: "m1", buildOrder: ["house", "road"], assets: [
      { id: "house_1", kind: "house", x: 5, y: 10, w: 8, h: 10 },
      { id: "road_main", kind: "road", x: 13, y: 14, w: 5, h: 2 },
    ] });
    markAgentBlueprintProgress("author_house", { kind: "single", mapId: "m1", wings: [{ x: 5, y: 10, w: 8, h: 10 }] }, WRITE);
    expect(getAgentBlueprintState().entries.find((e) => e.id === "house_1")?.status).toBe("building");

    setAgentBlueprintFromSpec({ mapId: "m1", buildOrder: ["road", "npc", "house"], assets: [
      { id: "road_main", kind: "road", x: 8, y: 17, w: 14, h: 2 },
      { id: "npc_1", kind: "npc", x: 11, y: 19, w: 1, h: 1 },
      { id: "built_house_1", kind: "house", x: 6, y: 10, w: 7, h: 7 },
    ] });
    const inherited = getAgentBlueprintState().entries.find((e) => e.id === "built_house_1");
    expect(inherited?.status).toBe("building");

    settleAgentBlueprintTurn({ regions: [{ mapId: "m1", x: 5, y: 10, w: 8, h: 10 }], wholeTargetMapIds: [] });
    expect(getAgentBlueprintState().entries.find((e) => e.id === "built_house_1")?.status).toBe("done");
  });

  it("종류가 다르거나 절반도 겹치지 않으면 물려받지 않는다", () => {
    // break: 겹침 조건 없이 물려받으면 길 진행이 집으로 옮겨 붙는다.
    setAgentBlueprintFromSpec({ mapId: "m1", assets: [{ id: "road", kind: "road", x: 0, y: 10, w: 20, h: 2 }] });
    markAgentBlueprintProgress("paint_road", { mapId: "m1", points: [{ x: 0, y: 10 }, { x: 19, y: 10 }] }, WRITE);
    setAgentBlueprintFromSpec({ mapId: "m1", assets: [
      { id: "house", kind: "house", x: 0, y: 10, w: 6, h: 6 },
      { id: "road_2", kind: "road", x: 0, y: 14, w: 20, h: 2 },
    ] });
    expect(getAgentBlueprintState().entries.map((e) => `${e.id}:${e.status}`)).toEqual(["house:planned", "road_2:planned"]);
  });
});

describe("진행 귀속 — 스치는 잔여 영역은 큰 칸을 올리지 않는다", () => {
  it("집 호출의 문 앞 1칸이 맵 전체 정리 칸을 building 으로 올리지 않는다", () => {
    // break: 탐욕 벗겨내기에 덮인 비율 하한이 없으면 문 칸 1/4096 이 clear 칸에 귀속돼 정리가 노란 테두리로 맵을 덮는다(e1-03 실측).
    setAgentBlueprintFromSpec({ mapId: "m1", buildOrder: ["clear", "house"], assets: [
      { id: "clear_all", kind: "clear", x: 0, y: 0, w: 64, h: 64 },
      { id: "house_a", kind: "house", x: 4, y: 4, w: 7, h: 8 },
    ] });
    markAgentBlueprintProgress("author_house", { kind: "single", mapId: "m1", wings: [{ x: 4, y: 4, w: 7, h: 8 }] }, WRITE);
    const byId = Object.fromEntries(getAgentBlueprintState().entries.map((e) => [e.id, e.status]));
    expect(byId).toEqual({ clear_all: "planned", house_a: "building" });
  });

  it("맵 전체를 치우는 호출은 여전히 정리 칸을 올린다", () => {
    setAgentBlueprintFromSpec({ mapId: "m1", buildOrder: ["clear", "house"], assets: [
      { id: "clear_all", kind: "clear", x: 0, y: 0, w: 64, h: 64 },
      { id: "house_a", kind: "house", x: 4, y: 4, w: 7, h: 8 },
    ] });
    markAgentBlueprintProgress("tile_erase", { mapId: "m1", rect: { x: 0, y: 0, w: 64, h: 64 } }, WRITE);
    expect(getAgentBlueprintState().entries.find((e) => e.id === "clear_all")?.status).toBe("building");
  });
});

describe("라벨 배치 — 겹치지 않고, 가리지 않고, 사라지지 않는다", () => {
  it("좁은 칸(3칸 미만)은 순번만 쓰고, 같은 자리에서 시작하는 라벨은 줄을 내려 쌓는다", () => {
    // break: 모든 칸에 같은 위치·같은 길이의 캡션을 쓰면 1×1 주민 셋이 한 덩이로 겹치고 상위 장식 라벨이 집 라벨을 가린다(e1-01 실측).
    const entries = [
      entry({ id: "house", kind: "house", label: "집", x: 4, y: 4, w: 7, h: 8, order: 1 }),
      entry({ id: "tree", kind: "tree", label: "나무", x: 4, y: 4, w: 3, h: 3, order: 2 }),
      entry({ id: "npc_1", kind: "npc", label: "주민", x: 12, y: 16, w: 1, h: 1, order: 3 }),
      entry({ id: "npc_2", kind: "npc", label: "주민", x: 13, y: 16, w: 1, h: 1, order: 4, status: "done" }),
    ];
    const layout = blueprintLabelLayout(entries);
    expect(layout.map((label) => label.caption)).toEqual(["1/4 집", "2/4 나무", "3", "4 ✓"]);
    expect(layout.map((label) => label.row)).toEqual([0, 1, 0, 0]);
  });

  it("칸이 40개를 넘으면 라벨을 없애는 대신 순번만 남긴다", () => {
    // break: 41개부터 라벨을 전부 생략하면 무엇이 어디에 몇 번째인지 알 길이 없다(e1-04 실측).
    const entries = Array.from({ length: BLUEPRINT_MAX_LABELS + 5 }, (_unused, index) =>
      entry({ id: `p${index}`, kind: "prop", label: "소품", x: (index % 9) * 4, y: Math.floor(index / 9) * 4, w: 3, h: 3, order: index + 1 }),
    );
    const layout = blueprintLabelLayout(entries);
    expect(layout).toHaveLength(entries.length);
    expect(layout[0].caption).toBe("1");
    expect(layout.every((label) => !label.caption.includes("소품"))).toBe(true);
  });
});

describe("렌더러 — 밝은 맵에서도 보이는 선, 원형 힌트", () => {
  let graphicsCalls: { strokes: number[][]; ellipses: number; rects: number }[];
  let textCalls: { x: number; y: number; content: string }[];
  let scene: any;
  let layer: any;

  beforeEach(() => {
    graphicsCalls = [];
    textCalls = [];
    const makeContainer = (): any => {
      const children: any[] = [];
      return { add: vi.fn((child: any) => children.push(child)), removeAll: vi.fn(() => { children.length = 0; }), setName: vi.fn(), children };
    };
    layer = makeContainer();
    scene = {
      add: {
        container: vi.fn(() => makeContainer()),
        graphics: vi.fn(() => {
          const record = { strokes: [] as number[][], ellipses: 0, rects: 0 };
          graphicsCalls.push(record);
          return {
            clear: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), strokePath: vi.fn(),
            fillStyle: vi.fn(), fillRect: vi.fn(), fillEllipse: vi.fn(),
            lineStyle: vi.fn((width: number, color: number, alpha: number) => record.strokes.push([width, color, alpha])),
            strokeRect: vi.fn(() => { record.rects += 1; }),
            strokeEllipse: vi.fn(() => { record.ellipses += 1; }),
            destroy: vi.fn(),
          };
        }),
        text: vi.fn((x: number, y: number, content: string) => {
          const object = { x, y, content, alpha: 1, setAlpha: vi.fn((a: number) => (object.alpha = a)), destroy: vi.fn() };
          textCalls.push(object);
          return object;
        }),
      },
      cameras: { main: { zoom: 1 } },
    };
  });

  it("계획 선 아래에 어두운 테두리(halo)를 깔아 얼음·눈 배경에서도 보이게 한다", () => {
    // break: 밝은 파랑 1px 0.6 알파만 그리면 얼음 배경 대비 1.5:1 로 계획이 보이지 않는다(e1-01 실측).
    setAgentBlueprintFromSpec({ mapId: "m1", assets: [{ id: "h", kind: "house", x: 2, y: 2, w: 4, h: 4 }] });
    new AgentBlueprintRenderer(scene, layer, () => "m1").render();
    const strokes = graphicsCalls[0].strokes;
    expect(strokes.length).toBe(2);
    const [halo, line] = strokes;
    expect(halo[0]).toBeGreaterThan(line[0]);
    expect(halo[1]).toBe(blueprintStatusStyle("planned").haloColor);
    expect(line[2]).toBeGreaterThanOrEqual(0.85);
  });

  it("shape 가 circle·ellipse 인 에셋은 타원으로 그린다", () => {
    // break: 형태 힌트를 버리면 원형 호수 계획이 네모로 찍힌다.
    setAgentBlueprintFromSpec({ mapId: "m1", assets: [
      { id: "pond", kind: "terrain", x: 2, y: 2, w: 8, h: 6, shape: "circle" },
      { id: "h", kind: "house", x: 12, y: 2, w: 4, h: 4 },
    ] });
    new AgentBlueprintRenderer(scene, layer, () => "m1").render();
    expect(graphicsCalls.map((record) => [record.ellipses, record.rects])).toEqual([[2, 0], [0, 2]]);
  });

  it("같은 자리에서 시작하는 라벨은 y 를 내려 쌓고, 좁은 칸의 라벨은 순번만 찍는다", () => {
    setAgentBlueprintFromSpec({ mapId: "m1", buildOrder: ["house", "tree", "npc"], assets: [
      { id: "house", kind: "house", x: 4, y: 4, w: 7, h: 8 },
      { id: "tree", kind: "tree", layer: "upper", x: 4, y: 4, w: 3, h: 3 },
      { id: "npc", kind: "npc", x: 12, y: 16, w: 1, h: 1 },
    ] });
    new AgentBlueprintRenderer(scene, layer, () => "m1").render();
    expect(textCalls.map((text) => text.content)).toEqual(["1/3 집", "2/3 나무", "3"]);
    expect(textCalls[1].y).toBeGreaterThan(textCalls[0].y);
  });
});

describe("BlueprintEntry 는 형태 힌트를 들고 간다", () => {
  it("스펙의 shape 가 청사진 칸에 남는다", () => {
    setAgentBlueprintFromSpec({ mapId: "m1", assets: [{ id: "pond", kind: "terrain", x: 2, y: 2, w: 8, h: 6, shape: "ellipse" }] } as BuildSpec);
    expect(getAgentBlueprintState().entries[0].shape).toBe("ellipse");
  });
});
