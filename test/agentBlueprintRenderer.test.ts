import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AgentBlueprintRenderer,
  BLUEPRINT_MAX_LABELS,
  blueprintEntryCaption,
  blueprintStatusStyle,
} from "@/editor/agentBlueprintRenderer";
import { clearAgentBlueprint, markAgentBlueprintProgress, setAgentBlueprintFromSpec } from "@/editor/agentBlueprint";
import type { BuildSpec } from "@/ai/buildSpec";
import type { BlueprintEntry } from "@/editor/agentBlueprint";

function entry(patch: Partial<BlueprintEntry> = {}): BlueprintEntry {
  return { id: "a", kind: "house", label: "집", x: 0, y: 0, w: 2, h: 2, order: 1, status: "planned", ...patch };
}

describe("blueprintStatusStyle", () => {
  it("상태를 선 굵기·알파로만 구분한다 — 트윈·펄스를 쓰지 않는다", () => {
    const planned = blueprintStatusStyle("planned");
    const building = blueprintStatusStyle("building");
    const done = blueprintStatusStyle("done");
    expect(building.strokeWidth).toBeGreaterThan(planned.strokeWidth);
    expect(building.strokeAlpha).toBeGreaterThan(planned.strokeAlpha);
    expect(done.strokeAlpha).toBeLessThan(planned.strokeAlpha);
    expect(done.fillAlpha).toBe(0);
    expect(done.labelAlpha).toBeLessThan(planned.labelAlpha);
  });
});

describe("blueprintEntryCaption", () => {
  it("순번과 사람 말 라벨만 쓴다 — 도구명·에셋 id 를 노출하지 않는다", () => {
    expect(blueprintEntryCaption(entry({ order: 2 }), 5)).toBe("2/5 집");
    expect(blueprintEntryCaption(entry({ order: 2, status: "building" }), 5)).toBe("2/5 집");
    expect(blueprintEntryCaption(entry({ order: 2, status: "done" }), 5)).toBe("2/5 집 ✓");
    expect(blueprintEntryCaption(entry({ id: "house_left_wing" }), 1)).not.toContain("house_left_wing");
  });
});

describe("AgentBlueprintRenderer", () => {
  let mockLayer: any;
  let mockScene: any;
  let graphicsCalls: any[];
  let textCalls: any[];

  beforeEach(() => {
    graphicsCalls = [];
    textCalls = [];
    mockLayer = makeContainer();
    mockScene = {
      add: {
        container: vi.fn(() => makeContainer()),
        graphics: vi.fn(() => {
          const record = { fills: [] as number[][], strokes: [] as number[][] };
          graphicsCalls.push(record);
          return {
            fillStyle: vi.fn((color: number, alpha: number) => record.fills.push([color, alpha])),
            fillRect: vi.fn(),
            lineStyle: vi.fn((width: number, color: number, alpha: number) => record.strokes.push([width, color, alpha])),
            strokeRect: vi.fn(),
            destroy: vi.fn(),
          };
        }),
        text: vi.fn((x: number, y: number, content: string, style: Record<string, unknown>) => {
          const object = { x, y, content, style, alpha: 1, setAlpha: vi.fn((a: number) => (object.alpha = a)), destroy: vi.fn() };
          textCalls.push(object);
          return object;
        }),
      },
      cameras: { main: { zoom: 2 } },
    };
  });

  afterEach(() => {
    clearAgentBlueprint();
  });

  it("청사진이 없으면 아무것도 그리지 않는다", () => {
    const renderer = new AgentBlueprintRenderer(mockScene, mockLayer, () => "m1");
    renderer.render();
    expect(mockScene.add.container).not.toHaveBeenCalled();
    expect(mockLayer.removeAll).toHaveBeenCalled();
  });

  it("다른 맵을 보고 있으면 그리지 않는다", () => {
    setAgentBlueprintFromSpec(spec());
    const renderer = new AgentBlueprintRenderer(mockScene, mockLayer, () => "m2");
    renderer.render();
    expect(mockScene.add.container).not.toHaveBeenCalled();
  });

  it("칸마다 사각형 하나와 라벨 하나를 그린다", () => {
    setAgentBlueprintFromSpec(spec());
    const renderer = new AgentBlueprintRenderer(mockScene, mockLayer, () => "m1");
    renderer.render();
    expect(graphicsCalls).toHaveLength(2);
    expect(textCalls.map((text) => text.content)).toEqual(["1/2 길", "2/2 집"]);
    // 라벨은 사각형 안쪽 위 — 맵 위쪽 경계에서도 화면 밖으로 나가지 않는다.
    expect(textCalls[0].y).toBeGreaterThanOrEqual(0);
    // zoom 을 반영해 고해상도로 래스터화한다(캔버스에서 뭉개지지 않게).
    expect(textCalls[0].style.resolution).toBeGreaterThanOrEqual(2);
  });

  it("진행 중인 칸은 더 굵은 선으로 그려진다", () => {
    setAgentBlueprintFromSpec(spec());
    markAgentBlueprintProgress("build_house", { mapId: "m1", x: 10, y: 10, w: 4, h: 4 });
    const renderer = new AgentBlueprintRenderer(mockScene, mockLayer, () => "m1");
    renderer.render();
    const [roadStroke, houseStroke] = graphicsCalls.map((record) => record.strokes[0][0]);
    expect(houseStroke).toBeGreaterThan(roadStroke);
    expect(textCalls[1].alpha).toBe(blueprintStatusStyle("building").labelAlpha);
  });

  it("칸이 너무 많으면 라벨을 생략한다 — 텍스처 낭비를 막는다", () => {
    setAgentBlueprintFromSpec({
      mapId: "m1",
      assets: Array.from({ length: BLUEPRINT_MAX_LABELS + 1 }, (_unused, index) => ({
        id: `a${index}`,
        kind: "prop",
        x: index,
        y: 0,
        w: 1,
        h: 1,
      })),
    });
    const renderer = new AgentBlueprintRenderer(mockScene, mockLayer, () => "m1");
    renderer.render();
    expect(graphicsCalls).toHaveLength(BLUEPRINT_MAX_LABELS + 1);
    expect(textCalls).toHaveLength(0);
  });

  it("add.text 가 없는 씬(가짜 씬)에서도 터지지 않는다", () => {
    setAgentBlueprintFromSpec(spec());
    const sceneWithoutText = { ...mockScene, add: { ...mockScene.add, text: undefined } };
    const renderer = new AgentBlueprintRenderer(sceneWithoutText as any, mockLayer, () => "m1");
    expect(() => renderer.render()).not.toThrow();
    expect(graphicsCalls).toHaveLength(2);
  });

  function spec(): BuildSpec {
    return {
      mapId: "m1",
      buildOrder: ["road", "house"],
      assets: [
        { id: "house_a", kind: "house", x: 10, y: 10, w: 4, h: 4 },
        { id: "road_a", kind: "road", x: 0, y: 5, w: 20, h: 2 },
      ],
    };
  }
});

function makeContainer(): any {
  const children: any[] = [];
  return {
    add: vi.fn((child: any) => {
      children.push(child);
      return child;
    }),
    removeAll: vi.fn(() => {
      children.length = 0;
    }),
    setName: vi.fn(),
    setDepth: vi.fn(),
    destroy: vi.fn(),
    list: children,
  };
}
