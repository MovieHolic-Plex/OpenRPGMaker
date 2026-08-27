import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderCommandPreview } from "@/editor/panels/eventEditor/commandPreview";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import {
  openEventCommandEditDialog,
  shouldRerenderCommandForm,
} from "@/editor/panels/eventEditor/commandEditDialog";
import { createBlankProject } from "@/project/defaults";
import { newCommand } from "@/editor/eventActions";
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
      { kind: "inputNumber", variableId: project.variables[0]?.id ?? "var_0001", digits: 3, prompt: "PIN 입력", showPad: true },
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
    expect(findByTestId(preview, "ecp-message-speaker")?.className).toContain("ecp-message-speaker-nameplate");
    expect(preview.textContent).toContain("촌장");
    expect(preview.textContent).toContain("마을에 온 걸");
  });


  it("text preview resolves control codes and shows effect examples without raw escape syntax", () => {
    const bs = String.fromCharCode(92);
    const bodyText = [
      "값 ",
      bs + "v[1]",
      " 이름 ",
      bs + "n[1]",
      bs + "c[2]",
      " 색",
      bs + "s[3]",
      bs + "$",
      bs + "!",
      bs + ".",
      bs + "|",
      bs + ">",
      bs + "<",
      bs + "^",
      bs + "_",
      "끝",
    ].join("");
    const preview = renderWithFakeDom(() =>
      renderCommandPreview({ kind: "text", body: bodyText })
    );
    const body = findByTestId(preview, "ecp-message-body");
    expect(body).toBeTruthy();
    if (!body) return;
    expect(body.textContent).toContain("값 0");
    expect(body.textContent).toContain("이름");
    expect(body.textContent).toContain("색");
    expect(body.textContent).toContain(" 끝");
    expect(body.textContent).not.toContain(bs);
    expect(findByTestId(body, "ecp-message-control-pause")?.textContent).toContain("키 입력 대기");
    expect(findByTestId(body, "ecp-message-control-gold")?.textContent).toContain("소지금 창 · 0 G");
    expect(findByTestId(body, "ecp-message-control-speed")?.textContent).toContain("표시 속도 3");
    expect(findByTestId(body, "ecp-message-control-fast-on")?.textContent).toContain("즉시 표시 시작");
    expect(findByTestId(body, "ecp-message-control-skip-wait")?.textContent).toContain("입력 대기 없이 닫기");
    expect(findByTestId(body, "ecp-message-control-space")?.textContent).toContain("반각 공백");
    expect(body.textContent.indexOf("색")).toBeLessThan(body.textContent.indexOf("표시 속도 3"));
    expect(body.textContent.indexOf("표시 속도 3")).toBeLessThan(body.textContent.indexOf("소지금 창 · 0 G"));
    expect(body.textContent.indexOf("반각 공백")).toBeLessThan(body.textContent.lastIndexOf("끝"));
    expect(findByTestId(preview, "ecp-message-control-badges")).toBeNull();
  });

  it("text editor keeps preview and easy tools primary while raw controls stay advanced", () => {
    const body = renderWithFakeDom(() =>
      renderCommandBody(
        { path: [], actions: noopActions, lockKind: true },
        { kind: "text", body: "안녕" }
      )
    );
    expect(findByTestId(body, "event-command-text-editor")).toBeTruthy();
    expect(findByTestId(body, "event-command-text-live-preview")).toBeTruthy();
    expect(findByTestId(body, "event-command-text-body")).toBeTruthy();
    expect(findByTestId(body, "event-command-text-speaker")).toBeTruthy();
    expect(findByTestId(body, "event-command-text-easy-tools")).toBeTruthy();
    expect(findByTestId(body, "event-command-text-tool-emphasis")).toBeTruthy();
    const controlDetails = findByTestId(body, "event-command-text-control-details") as HTMLDetailsElement | null;
    expect(controlDetails?.open).toBe(false);
    expect(findByTestId(body, "event-command-text-palette")).toBeTruthy();
    expect(findByTestId(body, "event-command-text-insert-variable")?.textContent).toContain("변수");
  });


  it("renders digit-slot preview for inputNumber with prompt and optional pad", () => {
    const preview = renderWithFakeDom(() =>
      renderCommandPreview({ kind: "inputNumber", variableId: "", digits: 4, prompt: "비밀번호", showPad: true })
    );
    expect(findByTestId(preview, "ecp-number-window")).toBeTruthy();
    expect(findByTestId(preview, "ecp-number-slots")).toBeTruthy();
    expect(findByTestId(preview, "ecp-number-pad")).toBeTruthy();
    expect(preview.textContent).toContain("비밀번호");
    expect(preview.textContent).toContain("4자리");
    expect(preview.textContent).toContain("대기 중");
    const slots = findByTestId(preview, "ecp-number-slots");
    // FakeDom uses childNodes (no HTMLElement.children).
    expect(slots?.childNodes?.length).toBe(4);
    // Idle preview: empty slots, no filled sample digits like "1234".
    const slotNodes = [...(slots?.childNodes ?? [])] as Array<{ className?: string; textContent?: string }>;
    expect(slotNodes.every((node) => String(node.className ?? "").includes("empty"))).toBe(true);
    expect(slotNodes.some((node) => String(node.className ?? "").includes("cursor"))).toBe(true);
    expect(slotNodes.every((node) => !(node.textContent ?? "").trim())).toBe(true);
  });

  it("inputNumber form uses digit chips only and labels window title / keypad option", () => {
    const body = renderWithFakeDom(() =>
      renderCommandBody(
        { path: [0], actions: noopActions, lockKind: true },
        { kind: "inputNumber", variableId: "var_0001", digits: 2, prompt: "PIN", showPad: true }
      )
    );
    expect(findByTestId(body, "input-number-command-body")).toBeTruthy();
    expect(findByTestId(body, "input-number-digit-stepper")).toBeTruthy();
    expect(findByTestId(body, "input-number-digit-chip-2")?.className).toContain("active");
    expect(findByTestId(body, "input-number-digits")).toBeTruthy();
    expect(body.textContent).toContain("안내 문구");
    expect(body.textContent).toContain("화면에 숫자 버튼 보이기");
    expect(body.textContent).not.toContain("창 제목");
    expect(body.textContent).not.toContain("자릿수");
  });

  it("inputNumber preview without pad shows OK mock instead of keypad", () => {
    const preview = renderWithFakeDom(() =>
      renderCommandPreview({ kind: "inputNumber", variableId: "var_0001", digits: 1 })
    );
    expect(findByTestId(preview, "ecp-number-ok-mock")).toBeTruthy();
    expect(findByTestId(preview, "ecp-number-pad")).toBeFalsy();
    expect(preview.textContent).toContain("1자리");
  });

  it("setVariable form shows labeled fields, op segments, and live formula", () => {
    const project = store.getCurrent();
    const variableId = project.variables[0]?.id ?? "var_0001";
    const body = renderWithFakeDom(() =>
      renderCommandBody(
        { path: [0], actions: noopActions, lockKind: true },
        { kind: "setVariable", variableId, op: "+=", value: 7 }
      )
    );
    expect(findByTestId(body, "event-command-variable-form")).toBeTruthy();
    expect(findByTestId(body, "event-command-variable-op")).toBeTruthy();
    expect(findByTestId(body, "event-command-variable-value-source")).toBeTruthy();
    expect(findByTestId(body, "event-command-variable-number-value")).toBeTruthy();
    expect(body.textContent).toContain("대상 변수");
    expect(body.textContent).toContain("값은");
    expect(body.textContent).toContain("나누기는 나머지를 버립니다");
    const formula = findByTestId(body, "event-command-variable-formula");
    expect(formula?.textContent).toContain("+=");
    expect(formula?.textContent).toContain("7");
  });

  it("setVariable preview renders formula card for number and variable operands", () => {
    const project = store.getCurrent();
    const variableId = project.variables[0]?.id ?? "var_0001";
    const numberPreview = renderWithFakeDom(() =>
      renderCommandPreview({ kind: "setVariable", variableId, op: "=", value: 12 })
    );
    expect(findByTestId(numberPreview, "ecp-variable-card")).toBeTruthy();
    expect(findByTestId(numberPreview, "ecp-variable-formula")?.textContent).toContain("12");
    expect(numberPreview.textContent).toContain("값은 숫자");

    const varPreview = renderWithFakeDom(() =>
      renderCommandPreview({
        kind: "setVariable",
        variableId,
        op: "+=",
        value: { kind: "var", id: variableId },
      })
    );
    expect(findByTestId(varPreview, "ecp-variable-formula")?.textContent).toContain("+=");
    expect(varPreview.textContent).toContain("값은 변수");
  });

  it("changeFace play mock shows a tall message window with crop-only face (no editor meta card)", () => {
    const preview = renderWithFakeDom(() =>
      renderCommandPreview({
        kind: "changeFace",
        resourceId: "easyrpg-faceset-actor1",
        faceIndex: 0,
        position: "left",
        flipHorizontally: false,
      })
    );
    expect(findByTestId(preview, "ecp-message-window")).toBeTruthy();
    expect(findByTestId(preview, "event-command-face-crop-shell")).toBeTruthy();
    expect(findByTestId(preview, "event-command-face-crop")).toBeTruthy();
    expect(findByTestId(preview, "event-command-face-preview")).toBeNull();
    expect(preview.textContent).toContain("대사 창에");
    expect(findByTestId(preview, "ecp-face-caption")?.textContent).toContain("왼쪽");
    expect(findByTestId(preview, "ecp-face-caption")?.textContent).toContain("얼굴 1");
  });

  it("renders displayTextSettings with clean windowskin mock, position stage, and option badges", () => {
    const preview = renderWithFakeDom(() =>
      renderCommandPreview({
        kind: "displayTextSettings",
        format: "normal",
        position: "bottom",
        preventObscuringPlayer: true,
        allowEventMovementDuringWait: false,
      })
    );
    const win = findByTestId(preview, "ecp-message-window");
    expect(win).toBeTruthy();
    // System.png 시트를 인라인 border-image 로 붙이지 않는다 (팔레트 오염 방지).
    expect(String(win?.style?.borderImageSource ?? "")).not.toMatch(/System\.png/i);
    expect(win?.dataset?.systemResource).toBeUndefined();
    expect(findByTestId(preview, "ecp-settings-stage")?.className).toContain("pos-bottom");
    const badges = findByTestId(preview, "ecp-settings-badges");
    expect(badges?.textContent).toContain("일반");
    expect(badges?.textContent).toContain("하단");
    expect(badges?.textContent).toContain("가림 방지 켜짐");
    expect(badges?.textContent).toContain("이벤트 이동 정지");
  });

  it("groups displayTextSettings form into format/position segments and options fieldsets", () => {
    const body = renderWithFakeDom(() =>
      renderCommandBody(
        { path: [], actions: noopActions, lockKind: true },
        {
          kind: "displayTextSettings",
          format: "transparent",
          position: "top",
          preventObscuringPlayer: false,
          allowEventMovementDuringWait: true,
        }
      )
    );
    expect(findByTestId(body, "event-command-message-settings")).toBeTruthy();
    expect(findByTestId(body, "event-command-message-format")).toBeTruthy();
    expect(findByTestId(body, "event-command-message-position")).toBeTruthy();
    expect(findByTestId(body, "event-command-message-format-segment-transparent")?.className).toContain("selected");
    expect(findByTestId(body, "event-command-message-position-segment-top")?.className).toContain("selected");
    expect(findByTestId(body, "event-command-message-format-segment-normal")).toBeTruthy();
    expect(findByTestId(body, "event-command-message-position-segment-center")).toBeTruthy();
    expect(findByTestId(body, "event-command-message-position-segment-bottom")).toBeTruthy();
    expect(findByTestId(body, "event-command-message-prevent-obscuring")).toBeTruthy();
    expect(findByTestId(body, "event-command-message-allow-movement")).toBeTruthy();
    expect(body.textContent).toContain("윈도우 표시 형식");
    expect(body.textContent).toContain("윈도우 위치");
    expect(body.textContent).toContain("옵션");
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

  it("newCommand(moveEvent) defaults to at least one step for visible trajectory", () => {
    const cmd = newCommand("moveEvent");
    expect(cmd.kind).toBe("moveEvent");
    if (cmd.kind !== "moveEvent") return;
    expect(cmd.route.moves.length).toBeGreaterThanOrEqual(1);
  });

  it("move-route editor stacks multiple adds locally and shows path preview + command list", () => {
    let staged: Command = { kind: "moveEvent", eventId: "", route: { moves: [], repeat: false } };
    const actions: CommandListActions = {
      ...noopActions,
      replaceCommand: (_path, command) => {
        staged = command;
      },
    };
    const body = renderWithFakeDom(() => renderCommandBody({ path: [], actions, lockKind: true }, staged));
    expect(findByTestId(body, "move-route-editor")).toBeTruthy();
    expect(findByTestId(body, "move-route-path-preview")).toBeTruthy();
    expect(findByTestId(body, "move-route-command-list")).toBeTruthy();

    findByTestId(body, "move-route-add-move-up")?.click();
    findByTestId(body, "move-route-add-move-right")?.click();
    expect(staged.kind).toBe("moveEvent");
    if (staged.kind !== "moveEvent") return;
    expect(staged.route.moves).toEqual([
      { kind: "move", dir: "up" },
      { kind: "move", dir: "right" },
    ]);
    expect(findByTestId(body, "move-route-command-1")?.textContent).toContain("위 이동");
    expect(findByTestId(body, "move-route-command-2")?.textContent).toContain("오른쪽 이동");
    expect(findByTestId(body, "move-route-summary")?.textContent).toContain("위 이동 -> 오른쪽 이동");
    expect(findByTestId(body, "ecp-move-preview")).toBeTruthy();
  });

  it("empty move-route still shows path preview shell and command add panel", () => {
    const body = renderWithFakeDom(() =>
      renderCommandBody(
        {
          path: [],
          actions: noopActions,
          lockKind: true,
        },
        { kind: "moveEvent", eventId: "", route: { moves: [], repeat: false } },
      )
    );
    expect(findByTestId(body, "move-route-editor")).toBeTruthy();
    expect(findByTestId(body, "move-route-path-preview")).toBeTruthy();
    expect(findByTestId(body, "move-route-help")).toBeTruthy();
    expect(findByTestId(body, "ecp-move-preview")).toBeTruthy();
    expect(findByTestId(body, "move-route-add-move-up")).toBeTruthy();
    expect(findByTestId(body, "move-route-parameters-details")).toBeTruthy();
    // 매개변수는 접힌 채로 시작 — 주 작업면이 먼저 보인다.
    const params = findByTestId(body, "move-route-parameters-details") as unknown as { open?: boolean };
    expect(params?.open).toBeFalsy();
  });

  it("summarizes fork branches with then/else counts", () => {
    const preview = renderWithFakeDom(() =>
      renderCommandPreview({ kind: "fork", condition: { kind: "switch", switchId: "", value: true }, then: [{ kind: "text", body: "a" }, { kind: "text", body: "b" }] })
    );
    expect(findByTestId(preview, "ecp-fork-preview")).toBeTruthy();
    expect(preview.textContent).toContain("2개 명령");
    expect(preview.textContent).toContain("분기 없음");
  });

  it("setEventGraphicPattern shows charset sprite preview instead of text-only summary", () => {
    const preview = renderWithFakeDom(() =>
      renderCommandPreview({
        kind: "setEventGraphicPattern",
        eventId: "ev_house_door_77_map_village_77_48x48_1",
        pattern: 24,
      })
    );
    expect(findByTestId(preview, "ecp-pattern-stage")).toBeTruthy();
    expect(findByTestId(preview, "ecp-pattern-sprite")).toBeTruthy();
    expect(findByTestId(preview, "ecp-pattern-caption")?.textContent).toContain("ev_house_door");
    expect(preview.textContent).toContain("아래");
    expect(preview.textContent).toContain("왼쪽");
  });

  it("setEventGraphicPattern editor uses RM2003 graphic picker layout", () => {
    let staged: Command = {
      kind: "setEventGraphicPattern",
      eventId: "ev_door",
      pattern: 24, // ch0 down pattern0 closed door
    };
    const actions: CommandListActions = {
      ...noopActions,
      replaceCommand: (_path, command) => {
        staged = command;
      },
    };
    const body = renderWithFakeDom(() =>
      renderCommandBody({ path: [], actions, lockKind: true }, staged)
    );
    expect(findByTestId(body, "event-command-frame-editor")).toBeTruthy();
    // Same shell as page graphic dialog: file list + 8 character chips + direction/pattern radios.
    expect(findByTestId(body, "event-graphic-resource-list")).toBeTruthy();
    expect(findByTestId(body, "event-command-frame-character-grid")).toBeTruthy();
    expect(findByTestId(body, "event-command-frame-direction-group")).toBeTruthy();
    expect(findByTestId(body, "event-command-frame-pattern-group")).toBeTruthy();
    expect(findByTestId(body, "event-command-frame-probe")).toBeTruthy();
    expect(findByTestId(body, "event-command-frame-door-seq")).toBeTruthy();
    // Door open step 2 = direction up, pattern left → frame 0 for ch0.
    findByTestId(body, "event-command-frame-door-step-2")?.click();
    expect(staged.kind).toBe("setEventGraphicPattern");
    if (staged.kind !== "setEventGraphicPattern") return;
    expect(staged.pattern).toBe(0);
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

  it("shouldRerenderCommandForm flags fork structure and loop body length", () => {
    expect(
      shouldRerenderCommandForm(
        { kind: "fork", condition: { kind: "switch", switchId: "a", value: true }, then: [] },
        { kind: "fork", condition: { kind: "variable", variableId: "v", op: "==", value: 1 }, then: [] },
      ),
    ).toBe(true);
    expect(
      shouldRerenderCommandForm(
        { kind: "fork", condition: { kind: "switch", switchId: "a", value: true }, then: [] },
        { kind: "fork", condition: { kind: "switch", switchId: "a", value: true }, then: [], else: [] },
      ),
    ).toBe(true);
    expect(
      shouldRerenderCommandForm(
        { kind: "loop", body: [] },
        { kind: "loop", body: [{ kind: "text", body: "x" }] },
      ),
    ).toBe(true);
    expect(
      shouldRerenderCommandForm(
        { kind: "fork", condition: { kind: "switch", switchId: "a", value: true }, then: [] },
        { kind: "fork", condition: { kind: "switch", switchId: "a", value: false }, then: [] },
      ),
      ).toBe(false);
  });

  it("uses a Korean caption and a save-screen stage for openSaveMenu", () => {
    const preview = renderWithFakeDom(() => renderCommandPreview({ kind: "openSaveMenu" }));
    expect(preview.querySelector(".ecp-caption")?.textContent).toBe("저장 메뉴 열기");
    expect(preview.querySelector(".ecp-stage")).toBeTruthy();
    expect(preview.classList.contains("ecp-summary-only")).toBe(false);
  });

  it("renders leftover advanced-dialogue m2 commands as a message stage, not a 0x0 summary", () => {
    const preview = renderWithFakeDom(() =>
      renderCommandPreview({
        kind: "m2Command",
        commandId: "m2-209-advanced-dialogue",
        fields: { speaker: "미나", body: "숲으로 가자." },
      }),
    );
    expect(findByTestId(preview, "ecp-message-window")).toBeTruthy();
    expect(preview.querySelector(".ecp-stage")).toBeTruthy();
    expect(preview.textContent).toContain("미나");
    expect(preview.textContent).toContain("숲으로 가자");
    expect(preview.classList.contains("ecp-summary-only")).toBe(false);
  });

  it("keeps the native text editor's inline stage so the collapsed side panel is not the only preview", () => {
    const body = renderWithFakeDom(() =>
      renderCommandBody({ path: [], actions: noopActions, lockKind: true }, { kind: "text", speaker: "촌장", body: "마을에 온 걸 환영하네." }),
    );
    expect(body.querySelector(".event-command-text-preview-canvas .ecp-stage")).toBeTruthy();
    expect(findByTestId(body, "ecp-message-window")).toBeTruthy();
  });

  it("marks summary-only commands so the preview column can collapse", () => {
    const preview = renderWithFakeDom(() =>
      renderCommandPreview({
        kind: "m2Command",
        commandId: "m2-079-change-menu-access",
        fields: {},
      }),
    );
    expect(preview.classList.contains("ecp-summary-only")).toBe(true);
    expect(preview.querySelector(".ecp-summary-card")).toBeTruthy();
    expect(preview.querySelector(".ecp-stage")).toBeNull();
  });

  it("renders a visual stage for Screen Effect instead of a summary card", () => {
    const preview = renderWithFakeDom(() =>
      renderCommandPreview({
        kind: "m2Command",
        commandId: "m2-202-screen-effect",
        fields: { effect: "flash", value: "white", durationMs: 400 },
      }),
    );
    expect(findByTestId(preview, "ecp-screen-effect-stage")).toBeTruthy();
    expect(findByTestId(preview, "ecp-runtime-effect")).toBeFalsy();
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
