// 워크스페이스 바는 조수를 자기 패널 목록에 넣지 않는다.
//
// 원래 이 파일은 `workspace-assistant-dock-{glass,side,float}` 3칸 라디오를 고정하고 있었다.
// 조수 띠는 배치가 하나라 고를 것이 없어 그 라디오가 사라졌고(스펙 §1), 남는 계약은 하나다:
// **일반 패널 행에 조수가 끼지 않는다**(`workspaceBar.ts` 의 `candidate.id !== "assistant"`).
//
// 왜 그 한 줄이 아직 회귀 가치가 있나: 일반 행은 워크스페이스 JSON 만 고쳤고 조수는
// 그 JSON 을 읽지 않았다. 즉 눌러도 아무 일이 없는 버튼이었다. 조수가 목록에 되돌아오면
// 그 죽은 버튼도 같이 되돌아온다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderWorkspaceBar } from "@/editor/panels/workspaceBar";
import { layoutFromPreset } from "@/editor/workspace/workspaceLayout";
import { resetWorkspaceForTests } from "@/editor/workspace/workspaceStore";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | null = null;

beforeEach(() => {
  restoreDom = installFakeDom();
  resetWorkspaceForTests(layoutFromPreset("map"));
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
});

describe("워크스페이스 바 조수 항목", () => {
  it("조수는 일반 패널 행으로도 배치 라디오로도 나오지 않는다", () => {
    const root = document.createElement("div") as unknown as FakeElement;
    root.append(...renderWorkspaceBar() as unknown as FakeElement[]);

    expect(findByTestId(root, "workspace-panel-row-assistant")).toBeNull();
    for (const dock of ["glass", "side", "float"]) {
      expect(findByTestId(root, `workspace-assistant-dock-${dock}`), dock).toBeNull();
    }
  });

  it("다른 패널 행은 그대로 렌더된다 — 조수만 빠진다", () => {
    // 조수가 빠진 것이 「행 자체가 안 그려진다」와 구별되게 이웃 둘을 같이 잰다.
    const root = document.createElement("div") as unknown as FakeElement;
    root.append(...renderWorkspaceBar() as unknown as FakeElement[]);

    expect(findByTestId(root, "workspace-panel-row-tiles")).toBeTruthy();
    expect(findByTestId(root, "workspace-panel-row-maps")).toBeTruthy();
  });
});
