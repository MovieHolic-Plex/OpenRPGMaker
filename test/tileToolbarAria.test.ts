/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editorState } from "@/editor/editorState";
import type { TileToolbarModel } from "@/editor/panels/tileToolbarMenus";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

const lintMock = vi.hoisted(() => ({
  issues: [] as Array<{ code: string; message: string; severity: string }>,
}));

// 규칙 감사는 cluster-rule 만 보는 clusterRuleLintIssues 를 쓴다. projectLint 는 전체 왕복 lint 라
// 호출되면 안 된다 — 빈 목록 대역으로 두고 호출 여부만 본다.
vi.mock("@/project/lint/projectLint", () => ({
  projectLint: vi.fn(() => []),
}));
vi.mock("@/project/lint/clusterRuleLint", () => ({
  clusterRuleLintIssues: vi.fn(() => lintMock.issues),
}));

import { makeLeftLayerSwitcher } from "@/editor/panels/leftLayerSwitcher";
import { makeOverflowDropdown, resetTileToolbarMenusForTests } from "@/editor/panels/tileToolbarMenus";

function toolbarModel(): TileToolbarModel {
  const project = store.getCurrent();
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("missing start map");
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset) throw new Error("missing start tileset");
  return { map, rerender: vi.fn(), state: editorState.get(), tileset };
}

describe("표준/전문가 사이드바 접근성", () => {
  beforeEach(() => {
    resetTileToolbarMenusForTests();
    const project = createBlankProject();
    store.replace(project);
    editorState.set({
      currentMapId: project.startMapId,
      layer: "lower",
      paintShape: "pen",
      tool: "paint",
    });
    lintMock.issues = [];
  });

  afterEach(() => {
    resetTileToolbarMenusForTests();
  });

  it("규칙 위반 배지가 있으면 오버플로 토글 접근명에 그 의미와 개수를 넣는다", () => {
    lintMock.issues = [
      { code: "cluster-rule-count", message: "꽃 과밀", severity: "info" },
      { code: "cluster-rule-spacing", message: "창문 간격", severity: "warning" },
    ];

    const overflow = makeOverflowDropdown(toolbarModel());
    const toggle = overflow.querySelector<HTMLElement>('[data-testid="oprn-tool-overflow"]');
    const badge = overflow.querySelector<HTMLElement>('[data-testid="rule-audit-badge"]');

    expect(badge?.textContent).toBe("2");
    expect(toggle?.getAttribute("aria-label")).toContain(`규칙 위반 ${badge?.textContent}건`);
  });

  it("활성 레이어만 aria-current로 표시하고 독립 토글 상태는 노출하지 않는다", () => {
    const switcher = makeLeftLayerSwitcher("upper");
    const buttons = Array.from(switcher.querySelectorAll("button"));
    const active = switcher.querySelector<HTMLElement>('[data-testid="layer-upper"]');

    expect(active?.getAttribute("aria-current")).toBe("true");
    expect(buttons.every((button) => button.getAttribute("aria-pressed") === null)).toBe(true);
  });
});
