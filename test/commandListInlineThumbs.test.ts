// [P1] 커맨드 리스트 인라인 썸네일 + 문장 폼 제어 문자 팔레트 + 얼굴 반영 프리뷰.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderCommandList } from "@/editor/panels/eventEditor/commandList";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import { renderCommandPreview } from "@/editor/panels/eventEditor/commandPreview";
import { commandSummary, commandSummaryParts, isSummaryVisualPart } from "@/editor/panels/eventEditor/commandSummary";
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

const FACE_RESOURCE = "easyrpg-faceset-actor1";

describe("커맨드 리스트 인라인 썸네일 (P1)", () => {
  let restoreDom: (() => void) | undefined;

  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
  });

  afterEach(() => {
    restoreDom?.();
  });

  it("changeFace 요약에 얼굴 크롭 썸네일 토큰이 붙고 문자열 요약은 불변이다", () => {
    const cmd: Command = { kind: "changeFace", resourceId: FACE_RESOURCE, faceIndex: 2, position: "left", flipHorizontally: false };
    const parts = commandSummaryParts(cmd);
    const visuals = parts.filter(isSummaryVisualPart);
    expect(visuals.length).toBe(1);
    expect(visuals[0]?.visual).toMatchObject({ type: "faceCrop", resourceId: FACE_RESOURCE, faceIndex: 2 });
    expect(commandSummary(cmd)).toContain("얼굴 그래픽 변경");
    expect(commandSummary(cmd)).not.toContain("undefined");
  });

  it("장소 이동 요약에 맵 썸네일 토큰, 그래픽 변경 포함 이동 경로에 스프라이트 토큰이 붙는다", () => {
    const mapId = store.getCurrent().startMapId;
    const transfer: Command = { kind: "transfer", mapId, x: 1, y: 1 };
    expect(commandSummaryParts(transfer).some((part) => isSummaryVisualPart(part) && part.visual.type === "mapThumb")).toBe(true);
    const moveWithGraphic: Command = {
      kind: "moveEvent",
      eventId: "",
      route: { moves: [{ kind: "changeGraphic", spriteId: "tex_easyrpg_charset_people1" }], repeat: false },
    };
    expect(
      commandSummaryParts(moveWithGraphic).some((part) => isSummaryVisualPart(part) && part.visual.type === "charsetSprite")
    ).toBe(true);
    // 그래픽 변경이 없으면 토큰도 없다.
    const plainMove: Command = { kind: "moveEvent", eventId: "", route: { moves: [{ kind: "move", dir: "up" }], repeat: false } };
    expect(commandSummaryParts(plainMove).some(isSummaryVisualPart)).toBe(false);
  });

  it("문장 표시 줄에는 직전 changeFace 의 얼굴 크롭이 부가된다", () => {
    const commands: Command[] = [
      { kind: "text", body: "얼굴 없음" },
      { kind: "changeFace", resourceId: FACE_RESOURCE, faceIndex: 0, position: "left", flipHorizontally: false },
      { kind: "text", body: "얼굴 있음" },
    ];
    const host = renderWithFakeDom(() => {
      const root = document.createElement("div") as unknown as HTMLElement;
      renderCommandList(root, commands, [], noopActions);
      return root;
    });
    const faces = host.querySelectorAll(".cmd-thumb-face");
    // changeFace 자체 줄 + 두 번째 text 줄 = 최소 2개 (첫 text 줄에는 없어야 한다)
    expect(faces.length).toBeGreaterThanOrEqual(2);
    const speakerFace = findByTestId(host, "cmd-speaker-face");
    expect(speakerFace).not.toBeNull();
  });

  it("문장 표시 폼에 제어 문자 팔레트가 렌더되고 클릭 시 본문에 삽입된다", () => {
    let latest: Command | undefined;
    const actions: CommandListActions = { ...noopActions, replaceCommand: (_path, cmd) => { latest = cmd; } };
    const body = renderWithFakeDom(() =>
      renderCommandBody({ path: [], actions, lockKind: true }, { kind: "text", body: "안녕" })
    );
    const palette = findByTestId(body, "event-command-text-palette");
    expect(palette).not.toBeNull();
    const colorButton = findByTestId(body, "event-command-text-insert-color");
    expect(colorButton).not.toBeNull();
    colorButton?.click();
    expect(latest && latest.kind === "text" ? latest.body : "").toContain("\\c[1]");
  });

  it("문장 프리뷰는 previewFace 문맥이 있으면 얼굴 크롭(에디터 카드 아님)을 포함한다", () => {
    const withFace = renderWithFakeDom(() =>
      renderCommandPreview({ kind: "text", body: "안녕" }, { face: { resourceId: FACE_RESOURCE, faceIndex: 1 } })
    );
    expect(findByTestId(withFace, "event-command-face-crop-shell")).not.toBeNull();
    expect(findByTestId(withFace, "event-command-face-crop")).not.toBeNull();
    // Play mock must not embed editor resource-id chrome.
    expect(findByTestId(withFace, "event-command-face-preview")).toBeNull();
    const withoutFace = renderWithFakeDom(() =>
      renderCommandPreview({ kind: "text", body: "안녕" })
    );
    expect(findByTestId(withoutFace, "event-command-face-crop-shell")).toBeNull();
  });
});
