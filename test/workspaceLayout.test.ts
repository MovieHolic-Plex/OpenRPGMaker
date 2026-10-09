// 워크스페이스 레이아웃 계약.
//
// 핵심 계약:
//  1. 프리셋은 도크 구성만 정한다. 편집 모드와 밀도는 2026-09-27 에 없앴다 — 옛 저장값의 density 는 읽지 않는다.
//  2. 깨진 저장값이 부팅을 막지 않는다.
import { beforeEach, describe, expect, it } from "vitest";
import {
  closePanel,
  dockOf,
  isPanelVisible,
  layoutFromPreset,
  movePanel,
  parseWorkspaceLayout,
  presetById,
  reopenPanel,
  serializeWorkspaceLayout,
  visiblePanels,
  WORKSPACE_PRESETS,
  WORKSPACE_STORAGE_KEY,
} from "@/editor/workspace/workspaceLayout";
import { allPanels, defaultDockFor, isPanelId, panelById } from "@/editor/workspace/panelRegistry";

describe("workspace layout", () => {
  beforeEach(() => {
  });

  it("저장 키가 oprn 접두사를 쓴다", () => {
    expect(WORKSPACE_STORAGE_KEY).toBe("oprn:workspace:v1");
  });

  it("프리셋 3개가 작업이 아닌 레이아웃 이름을 쓴다", () => {
    expect(WORKSPACE_PRESETS.map((preset) => preset.label)).toEqual(["맵 중심", "이벤트 중심", "데이터 중심"]);
  });

  it("모든 프리셋의 패널이 레지스트리에 등록되어 있다", () => {
    for (const preset of WORKSPACE_PRESETS) {
      for (const zone of ["left", "right", "bottom"] as const) {
        for (const id of preset.docks[zone]) {
          expect(isPanelId(id), `${preset.id}/${zone}: ${id}`).toBe(true);
          expect(panelById(id)).toBeDefined();
        }
      }
    }
  });

  it("이벤트 연출 프리셋은 팔레트를 접고 맵 트리만 남긴다", () => {
    const layout = layoutFromPreset("event");
    expect(layout.docks.left).toEqual(["maps"]);
    expect(isPanelVisible(layout, "tiles")).toBe(false);
  });

  it("자료 밸런싱 프리셋은 좌측 도크를 비운다", () => {
    const layout = layoutFromPreset("data");
    expect(layout.docks.left).toEqual([]);
  });

  it("저장값이 없으면 맵 그리기 프리셋으로 시작한다", () => {
    expect(parseWorkspaceLayout(null).presetId).toBe("map");
  });

  it("옛 저장값의 density 는 레이아웃에 남지 않는다", () => {
    const raw = JSON.stringify({ presetId: "map", density: "guided" });
    expect(parseWorkspaceLayout(raw)).not.toHaveProperty("density");
  });

  it("직렬화에는 density 가 들어가지 않는다", () => {
    const serialized = serializeWorkspaceLayout(layoutFromPreset("data"));
    expect(JSON.parse(serialized)).toEqual({
      presetId: "data",
      docks: { left: [], right: ["assistant"], bottom: [] },
    });
  });

  it("깨진 JSON·낯선 패널·낯선 프리셋을 조용히 걷어낸다", () => {
    expect(parseWorkspaceLayout("{not json").presetId).toBe("map");
    expect(parseWorkspaceLayout("[]").presetId).toBe("map");
    const junk = JSON.stringify({ presetId: "zzz", docks: { left: ["tiles", "nope"], right: 7 } });
    const layout = parseWorkspaceLayout(junk);
    expect(layout.presetId).toBe("map");
    expect(layout.docks.left).toEqual(["tiles"]);
    expect(layout.docks.right).toEqual([]);
  });

  it("같은 패널이 두 도크에 중복 저장되면 첫 자리만 남는다", () => {
    const raw = JSON.stringify({ presetId: "map", docks: { left: ["tiles"], right: ["tiles", "assistant"] } });
    const layout = parseWorkspaceLayout(raw);
    expect(layout.docks.left).toEqual(["tiles"]);
    expect(layout.docks.right).toEqual(["assistant"]);
  });

  it("패널 이동은 이전 도크에서 빼고 넣는다", () => {
    const moved = movePanel(layoutFromPreset("map"), "tiles", "right");
    expect(moved.docks.left).toEqual(["maps"]);
    expect(moved.docks.right).toEqual(["tiles", "assistant"]);
    expect(dockOf(moved, "tiles")).toBe("right");
    expect(visiblePanels(moved)).toHaveLength(3);
  });

  // 실측으로 잡은 회귀: 도크 순서가 클릭 순서를 따르면 `.left-panel` 3행 그리드에서
  // 맵 트리가 늘어나는 1행을 차지하고 팔레트가 300px 칸에 갇혀 73px 로 찌그러졌다.
  it("도크 순서는 클릭 순서가 아니라 레지스트리 순서를 따른다", () => {
    const base = layoutFromPreset("map");
    const detoured = movePanel(movePanel(base, "tiles", "right"), "tiles", "left");
    expect(detoured.docks.left).toEqual(["tiles", "maps"]);
  });

  it("저장값 순서가 뒤집혀 있어도 레지스트리 순서로 되돌린다", () => {
    const raw = JSON.stringify({ presetId: "map", docks: { left: ["maps", "tiles"] } });
    expect(parseWorkspaceLayout(raw).docks.left).toEqual(["tiles", "maps"]);
  });

  it("닫은 패널은 선호 도크로 되돌아온다", () => {
    const base = layoutFromPreset("map");
    const closed = closePanel(base, "tiles");
    expect(dockOf(closed, "tiles")).toBeNull();
    const reopened = reopenPanel(closed, "tiles");
    expect(dockOf(reopened, "tiles")).toBe(defaultDockFor("tiles"));
    expect(reopened.docks.left).toEqual(["tiles", "maps"]);
  });

  it("이미 열린 패널의 reopen 은 자리를 옮기지 않는다", () => {
    const moved = movePanel(layoutFromPreset("map"), "tiles", "right");
    expect(reopenPanel(moved, "tiles")).toBe(moved);
  });

  it("presetById 는 낯선 id 에 첫 프리셋을 준다", () => {
    // @ts-expect-error — 저장값이 깨진 경우를 흉내낸다
    expect(presetById("nope").id).toBe("map");
  });

  it("조수 패널은 render 를 갖지 않는다 (AI 독이 자기 수명주기를 소유)", () => {
    expect(panelById("assistant")?.render).toBeUndefined();
    for (const panel of allPanels()) {
      if (panel.id === "assistant") continue;
      expect(typeof panel.render, panel.id).toBe("function");
    }
  });
});
