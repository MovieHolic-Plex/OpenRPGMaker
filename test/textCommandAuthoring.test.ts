import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import type { CommandListActions } from "@/editor/panels/eventEditor/types";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

const noopActions: CommandListActions = {
  addCommand: () => {},
  insertCommand: () => {},
  replaceCommand: () => {},
  deleteCommand: () => {},
  moveCommand: () => {},
  moveCommandTo: () => {},
};

describe("문장 표시 쉬운 저작 화면", () => {
  let restoreDom: (() => void) | undefined;

  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
  });

  afterEach(() => {
    restoreDom?.();
  });

  it("주 편집 화면 안에서 실제 대화창 미리보기를 즉시 갱신한다", () => {
    // Break: 인스펙터에는 별도 우측 프리뷰 패널이 없어서 본문을 바꿔도 결과를 볼 수 없다.
    const body = renderWithFakeDom(() =>
      renderCommandBody({ path: [], actions: noopActions, lockKind: true }, { kind: "text", body: "처음 문장" })
    );
    const preview = findByTestId(body, "event-command-text-live-preview");
    const textarea = findByTestId(body, "event-command-text-body") as HTMLTextAreaElement | null;

    expect(preview?.textContent).toContain("처음 문장");
    if (!textarea) throw new Error("missing text body");
    textarea.value = "바뀐 문장";
    textarea.dispatchEvent(new Event("input"));
    expect(preview?.textContent).toContain("바뀐 문장");
    expect(preview?.textContent).not.toContain("처음 문장");
  });

  it("선택한 문장을 쉬운 강조 도구로 감싸고 명령 데이터에 반영한다", () => {
    // Break: 저수준 제어문자 팔레트만 있으면 사용자가 강조 범위를 직접 escape 코드로 작성해야 한다.
    let latest: Command | undefined;
    const actions: CommandListActions = {
      ...noopActions,
      replaceCommand: (_path, command) => {
        latest = command;
      },
    };
    const body = renderWithFakeDom(() =>
      renderCommandBody({ path: [], actions, lockKind: true }, { kind: "text", body: "중요한 말" })
    );
    const textarea = findByTestId(body, "event-command-text-body") as HTMLTextAreaElement | null;
    const emphasize = findByTestId(body, "event-command-text-tool-emphasis");
    if (!textarea || !emphasize) throw new Error("missing easy authoring control");

    textarea.setSelectionRange(0, 3);
    emphasize.click();

    expect(latest).toMatchObject({ kind: "text", body: "\\c[2]중요한\\c[0] 말" });
    expect(findByTestId(body, "event-command-text-live-preview")?.textContent).toContain("중요한 말");
  });

  it("원시 제어문자 팔레트는 닫힌 고급 영역에 두되 계속 사용할 수 있다", () => {
    // Break: 제어문자 버튼 열두 개가 기본 작성 흐름을 밀어내거나, 반대로 고급 입력 경로가 사라진다.
    let latest: Command | undefined;
    const actions: CommandListActions = {
      ...noopActions,
      replaceCommand: (_path, command) => {
        latest = command;
      },
    };
    const body = renderWithFakeDom(() =>
      renderCommandBody({ path: [], actions, lockKind: true }, { kind: "text", body: "안녕" })
    );
    const advanced = findByTestId(body, "event-command-text-control-details") as HTMLDetailsElement | null;
    const colorButton = findByTestId(body, "event-command-text-insert-color");

    expect(advanced).not.toBeNull();
    expect(advanced?.open).toBe(false);
    expect(findByTestId(body, "event-command-text-palette")?.closest("details")).toBe(advanced);
    colorButton?.click();
    expect(latest).toMatchObject({ kind: "text", body: "\\c[1]안녕" });
  });
});
