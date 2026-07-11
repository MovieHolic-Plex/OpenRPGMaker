import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderCommandPreview } from "@/editor/panels/eventEditor/commandPreview";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import {
  openEventCommandEditDialog,
  shouldRerenderCommandForm,
} from "@/editor/panels/eventEditor/commandEditDialog";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { PLAYER_MOVE_TARGET } from "@/project/moveRouteTarget";
import type { Command } from "@/project/types";
import type { CommandListActions } from "@/editor/panels/eventEditor/types";
import { FakeElement, FakeNode, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

const noopActions: CommandListActions = {
  addCommand: () => {},
  insertCommand: () => {},
  replaceCommand: () => {},
  deleteCommand: () => {},
  moveCommand: () => {},
  moveCommandTo: () => {},
};

describe("command edit modal — image-rich preview", () => {
  let restoreDom: (() => void) | undefined;

  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
  });

  afterEach(() => {
    restoreDom?.();
  });

  it("renders a preview for every representative command kind without throwing", () => {
    const project = store.getCurrent();
    const itemId = project.database.items[0]?.id ?? "";
    const switchId = project.switches[0]?.id ?? "";
    const actorId = project.database.actors[0]?.id ?? "";
    const mapId = project.startMapId;
    const samples: Command[] = [
      { kind: "text", speaker: "용사", body: "안녕\n반가워" },
      { kind: "changeFace", resourceId: "", faceIndex: 0, position: "left", flipHorizontally: false },
      { kind: "displayTextSettings", format: "transparent", position: "top", preventObscuringPlayer: false, allowEventMovementDuringWait: false },
      { kind: "choices", options: [{ text: "예", branch: [] }, { text: "아니오", branch: [] }] },
      { kind: "fork", condition: { kind: "switch", switchId, value: true }, then: [{ kind: "text", body: "참" }], else: [] },
      { kind: "moveEvent", eventId: PLAYER_MOVE_TARGET, route: { moves: [{ kind: "move", dir: "left" }, { kind: "move", dir: "up" }], repeat: false } },
      { kind: "transfer", mapId, x: 3, y: 4 },
      { kind: "showPicture", pictureId: "1", resourceId: "", x: 160, y: 120 },
      { kind: "changeItem", itemId, op: "+=", amount: 2 },
      { kind: "shop", itemIds: [itemId] },
      { kind: "changeParty", actorId, action: "add" },
      { kind: "changeGold", op: "-=", amount: 50 },
      { kind: "battleProcessing", troopId: "", canEscape: true, canLose: false },
      { kind: "playAudio", resourceId: "bgm", loop: true },
      { kind: "stopAudio" },
      { kind: "setSwitch", switchId, value: true },
      { kind: "gameOver" },
      { kind: "wait", ms: 500 },
    ];
    for (const cmd of samples) {
      const preview = renderWithFakeDom(() => renderCommandPreview(cmd));
      expect(preview.dataset.previewKind).toBe(cmd.kind);
      expect(findByTestId(preview, "event-command-preview-body")).toBeTruthy();
    }
  });

  it("renders the RM2003 message window for text and reflects speaker + body", () => {
    const preview = renderWithFakeDom(() => renderCommandPreview({ kind: "text", speaker: "촌장", body: "마을에 온 걸 환영하네." }));
    expect(findByTestId(preview, "ecp-message-window")).toBeTruthy();
    expect(preview.textContent).toContain("촌장");
    expect(preview.textContent).toContain("마을에 온 걸");
  });

  it("shows the move tape with direction chips and repeat/wait badges (SVG-less env falls back to tape)", () => {
    const preview = renderWithFakeDom(() =>
      renderCommandPreview({ kind: "moveEvent", eventId: "", route: { moves: [{ kind: "move", dir: "up" }, { kind: "wait" }], repeat: true, wait: true } })
    );
    const tape = findByTestId(preview, "ecp-move-tape");
    expect(tape).toBeTruthy();
    expect(tape?.textContent).toContain("↑");
    expect(preview.textContent).toContain("반복");
    expect(preview.textContent).toContain("완료까지 대기");
  });

  it("summarizes fork branches with then/else counts", () => {
    const preview = renderWithFakeDom(() =>
      renderCommandPreview({ kind: "fork", condition: { kind: "switch", switchId: "", value: true }, then: [{ kind: "text", body: "a" }, { kind: "text", body: "b" }] })
    );
    expect(findByTestId(preview, "ecp-fork-preview")).toBeTruthy();
    expect(preview.textContent).toContain("2개 명령");
    expect(preview.textContent).toContain("분기 없음");
  });

  it("locks the command-kind select when editing an existing command, keeps it for new commands", () => {
    const cmd: Command = { kind: "text", body: "hi" };
    const locked = renderWithFakeDom(() => renderCommandBody({ path: [], actions: noopActions, lockKind: true }, cmd));
    const unlocked = renderWithFakeDom(() => renderCommandBody({ path: [], actions: noopActions }, cmd));
    expect(hasKindSelect(locked)).toBe(false);
    expect(hasKindSelect(unlocked)).toBe(true);
  });

  it("preserves fork branches through the edit dialog OK path", () => {
    const original: Command = {
      kind: "fork",
      condition: { kind: "switch", switchId: "", value: true },
      then: [{ kind: "text", body: "참 분기" }],
      else: [{ kind: "text", body: "거짓 분기" }],
    };
    let applied: Command | null = null;
    openEventCommandEditDialog({ initial: original, lockKind: true, onApply: (command) => (applied = command) });
    const body = globalThis.document.body as unknown as FakeNode;
    const ok = findByTestId(body, "event-command-edit-ok");
    expect(ok).toBeTruthy();
    ok?.click();
    expect(applied).toEqual(original);
  });

  it("rebuilds shop dual lists after add so selected items stay in sync", () => {
    const project = store.getCurrent();
    const first = project.database.items[0];
    const second = project.database.items[1];
    expect(first && second).toBeTruthy();
    if (!first || !second) return;

    openEventCommandEditDialog({
      initial: { kind: "shop", itemIds: [first.id] },
      lockKind: true,
      onApply: () => {},
    });
    const body = globalThis.document.body as unknown as FakeNode;
    const available = findByTestId(body, "shop-available-items") as FakeElement | null;
    const add = findByTestId(body, "shop-add-item");
    expect(available && add).toBeTruthy();
    if (!available || !add) return;

    // select second item from available list
    available.value = second.id;
    add.click();

    const selected = findByTestId(body, "shop-selected-items") as FakeElement | null;
    expect(selected).toBeTruthy();
    const optionValues = selected
      ? [...selected.childNodes]
          .filter((node): node is FakeElement => node instanceof FakeElement && node.tagName === "OPTION")
          .map((option) => option.value)
      : [];
    expect(optionValues).toContain(first.id);
    expect(optionValues).toContain(second.id);

    const summary = findByTestId(body, "shop-selection-summary");
    expect(summary?.textContent).toContain(first.name);
    expect(summary?.textContent).toContain(second.name);
  });

  it("shows shop transaction branch controls when branch checkbox is enabled", () => {
    openEventCommandEditDialog({
      initial: { kind: "shop", itemIds: [] },
      lockKind: true,
      onApply: () => {},
    });
    const body = globalThis.document.body as unknown as FakeNode;
    const branch = findByTestId(body, "shop-branch-on-transaction") as FakeElement | null;
    expect(branch).toBeTruthy();
    if (!branch) return;
    branch.checked = true;
    branch.dispatchEvent(new Event("change", { bubbles: true }));

    const controls = findByTestId(body, "shop-transaction-branch-controls");
    expect(controls).toBeTruthy();
    expect(controls?.className.includes("is-hidden")).toBe(false);
  });

  it("shouldRerenderCommandForm flags shop list/branch and choices cancel changes", () => {
    expect(
      shouldRerenderCommandForm(
        { kind: "shop", itemIds: ["a"] },
        { kind: "shop", itemIds: ["a", "b"] }
      )
    ).toBe(true);
    expect(
      shouldRerenderCommandForm(
        { kind: "shop", itemIds: [], branchOnTransaction: false },
        { kind: "shop", itemIds: [], branchOnTransaction: true }
      )
    ).toBe(true);
    expect(
      shouldRerenderCommandForm(
        { kind: "shop", itemIds: ["a"], messageType: "welcome" },
        { kind: "shop", itemIds: ["a"], messageType: "direct" }
      )
    ).toBe(false);
    expect(
      shouldRerenderCommandForm(
        { kind: "choices", options: [{ text: "예", branch: [] }] },
        { kind: "choices", options: [{ text: "예", branch: [] }], cancelBehavior: "branch" }
      )
    ).toBe(true);
  });
});

function hasKindSelect(root: FakeElement): boolean {
  return findByPredicate(root, (element) => element.dataset.commandKindSelect === "true") !== null;
}

function findByPredicate(root: FakeNode, predicate: (element: FakeElement) => boolean): FakeElement | null {
  if (root instanceof FakeElement && predicate(root)) return root;
  for (const child of root.childNodes) {
    const match = findByPredicate(child, predicate);
    if (match) return match;
  }
  return null;
}
