// 워크스페이스 레이아웃 계약 — 프리셋이 3단 모드를 흡수한 뒤의 규칙을 못박는다.
//
// 핵심 계약 3개:
//  1. 밀도의 원천은 `editorUiMode` 하나다 — 저장값에 density 가 있어도 무시한다.
//  2. 프리셋 전환은 도크 구성 + 밀도를 함께 바꾼다(그래서 모드 토글이 없어도 된다).
//  3. 깨진 저장값이 부팅을 막지 않는다.
import { beforeEach, describe, expect, it } from "vitest";
import {
  closePanel,
  dockOf,
  densityForUiMode,
  isPanelVisible,
  layoutFromPreset,
  movePanel,
  parseWorkspaceLayout,
  presetById,
  reopenPanel,
  serializeWorkspaceLayout,
  uiModeForDensity,
  visiblePanels,
  WORKSPACE_PRESETS,
  WORKSPACE_STORAGE_KEY,
} from "@/editor/workspace/workspaceLayout";
import { allPanels, defaultDockFor, isPanelId, panelById } from "@/editor/workspace/panelRegistry";
import { resetEditorUiModeForTests } from "@/editor/editorUiMode";

describe("workspace layout", () => {
  beforeEach(() => {
    resetEditorUiModeForTests("standard");
  });

  it("저장 키가 oprn 접두사를 쓴다", () => {
    expect(WORKSPACE_STORAGE_KEY).toBe("oprn:workspace:v1");
  });

  it("프리셋 3개가 계획서의 작업 이름을 쓴다", () => {
    expect(WORKSPACE_PRESETS.map((preset) => preset.label)).toEqual(["맵 그리기", "이벤트 연출", "자료 밸런싱"]);
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
    expect(layout.density).toBe("dense");
  });

  it("밀도와 3단 모드가 왕복 변환된다", () => {
    for (const mode of ["beginner", "standard", "expert"] as const) {
      expect(uiModeForDensity(densityForUiMode(mode))).toBe(mode);
    }
  });

  it("저장값이 없으면 맵 그리기 프리셋 + 쓰던 모드의 밀도로 시작한다", () => {
    const layout = parseWorkspaceLayout(null, "expert");
    expect(layout.presetId).toBe("map");
    expect(layout.density).toBe("dense");
  });

  // 밀도가 두 곳에 저장되면 커맨드 팔레트의 「밀도」 명령과 프리셋 토글이 갈라진다.
  it("저장값의 density 는 무시하고 전달된 모드에서 파생한다", () => {
    const raw = JSON.stringify({ presetId: "map", density: "guided" });
    expect(parseWorkspaceLayout(raw, "expert").density).toBe("dense");
  });

  it("직렬화에는 density 가 들어가지 않는다", () => {
    const serialized = serializeWorkspaceLayout(layoutFromPreset("data"));
    expect(JSON.parse(serialized)).toEqual({
      presetId: "data",
      docks: { left: [], right: ["assistant"], bottom: [] },
    });
  });

  it("깨진 JSON·낯선 패널·낯선 프리셋을 조용히 걷어낸다", () => {
    expect(parseWorkspaceLayout("{not json", "standard").presetId).toBe("map");
    expect(parseWorkspaceLayout("[]", "standard").presetId).toBe("map");
    const junk = JSON.stringify({ presetId: "zzz", docks: { left: ["tiles", "nope"], right: 7 } });
    const layout = parseWorkspaceLayout(junk, "standard");
    expect(layout.presetId).toBe("map");
    expect(layout.docks.left).toEqual(["tiles"]);
    expect(layout.docks.right).toEqual([]);
  });

  it("같은 패널이 두 도크에 중복 저장되면 첫 자리만 남는다", () => {
    const raw = JSON.stringify({ presetId: "map", docks: { left: ["tiles"], right: ["tiles", "assistant"] } });
    const layout = parseWorkspaceLayout(raw, "standard");
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
    expect(parseWorkspaceLayout(raw, "standard").docks.left).toEqual(["tiles", "maps"]);
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
