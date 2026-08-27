import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { commandSummary, commandSummaryParts } from "@/editor/panels/eventEditor/commandSummary";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import { renderCommandList } from "@/editor/panels/eventEditor/commandList";
import { renderM2CommandBody } from "@/editor/panels/eventEditor/commandBodyM2";
import { renderEventGraphicIcon, renderEventGraphicPreview } from "@/editor/panels/eventEditor/eventGraphicPreview";
import { openFacesetDialog } from "@/editor/panels/eventEditor/messageCommandDialogs";
import { renderPageConditions } from "@/editor/panels/eventEditor/pageConditions";
import { RESOURCE_SLICING } from "@/assets/resourceSlicing";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { el } from "@/util/dom";
import type { Command, EventPage, EventPageGraphic } from "@/project/types";
import { commandRuntimeSupport } from "@/project/eventCommands/runtimeSupport";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

describe("event editor presentation", () => {
  let restoreDom: (() => void) | undefined;

  beforeEach(() => {
    restoreDom = installFakeDom();
    const project = createBlankProject();
    const firstItem = project.database.items[0];
    if (firstItem) firstItem.name = "포션";
    const firstActor = project.database.actors[0];
    if (firstActor) firstActor.name = "잭";
    store.replace(project);
  });

  afterEach(() => {
    restoreDom?.();
  });

  it("keeps command text black by default while coloring command labels and important values", () => {
    const command = { kind: "text", body: "어서 와요. 이 마을의 이벤트는 모두 이 에디터 안에서 만들어졌어요." } satisfies Command;

    const parts = commandSummaryParts(command);

    expect(parts.map((part) => part.text).join("")).toBe(commandSummary(command));
    expect(parts).toContainEqual({ text: "문장 표시", tone: "command" });
    expect(parts).toContainEqual({ text: ": ", tone: "plain" });
    expect(parts.some((part) => part.tone === "plain" && part.text.includes("어서 와요"))).toBe(true);
  });

  it("renders choice options as chips and cancel as a distinct badge, not another option", () => {
    const command = {
      kind: "choices",
      prompt: "폐광 열쇠 조사도 맡겠나?",
      options: [
        { text: "맡는다", branch: [] },
        { text: "잠시 후", branch: [] },
      ],
      cancelBehavior: "choice2",
    } satisfies Command;

    const parts = commandSummaryParts(command);
    const text = commandSummary(command);

    expect(parts).toContainEqual({ text: "선택지 표시", tone: "command" });
    expect(parts).toContainEqual({ text: "1.맡는다", tone: "choice-option" });
    expect(parts).toContainEqual({ text: "2.잠시 후", tone: "choice-option" });
    expect(parts).toContainEqual({ text: "취소→잠시 후", tone: "choice-cancel" });
    // 취소 표기가 옵션 목록 사이에 섞이지 않는다.
    expect(text).toContain("1.맡는다");
    expect(text).toContain("2.잠시 후");
    expect(text).toContain("취소→잠시 후");
    expect(text).not.toMatch(/맡는다 \/ 잠시 후 \/ 취소/);
  });

  it("shows user-defined switch and variable names instead of raw internal ids", () => {
    const project = store.getCurrent();
    const variable = project.variables[0];
    const blankVariable = project.variables[1];
    const switchRecord = project.switches[0];
    if (!variable || !blankVariable || !switchRecord) throw new Error("missing default switch/variable slots");
    variable.name = "Gold Count";
    switchRecord.name = "Gate Open";
    store.replace(project);

    expect(commandSummary({ kind: "setVariable", variableId: variable.id, op: "=", value: { kind: "var", id: blankVariable.id } })).toContain("Gold Count");
    expect(commandSummary({ kind: "setSwitch", switchId: switchRecord.id, value: true })).toContain("Gate Open");
    expect(commandSummary({ kind: "setVariable", variableId: blankVariable.id, op: "=", value: 0 })).toContain("(이름 없음)");
    expect(commandSummary({ kind: "setVariable", variableId: blankVariable.id, op: "=", value: 0 })).not.toContain(blankVariable.id);
  });

  it("스위치 조작 요약은 ON/OFF/전환/변수 값을 구분한다", () => {
    const project = store.getCurrent();
    const switchRecord = project.switches[0];
    const variable = project.variables[0];
    if (!switchRecord || !variable) throw new Error("missing default switch/variable slots");
    switchRecord.name = "Gate Open";
    variable.name = "Flag Count";
    store.replace(project);

    expect(commandSummary({ kind: "setSwitch", switchId: switchRecord.id, value: true })).toContain("켜짐");
    expect(commandSummary({ kind: "setSwitch", switchId: switchRecord.id, value: false })).toContain("꺼짐");
    expect(commandSummary({ kind: "setSwitch", switchId: switchRecord.id, value: "toggle" })).toContain("전환");
    expect(commandSummary({
      kind: "setSwitch",
      switchId: switchRecord.id,
      value: { kind: "var", id: variable.id },
    })).toContain("Flag Count");
  });

  it("스위치 조작 폼은 인라인 검색·ON/OFF/전환/변수 값을 한 줄로 노출한다", () => {
    const project = store.getCurrent();
    const switchRecord = project.switches[0];
    const variable = project.variables[0];
    if (!switchRecord || !variable) throw new Error("missing default switch/variable slots");
    switchRecord.name = "Gate Open";
    variable.name = "Flag Count";
    store.replace(project);

    let staged: Command = { kind: "setSwitch", switchId: switchRecord.id, value: true };
    const body = renderWithFakeDom(() => renderCommandBody(
      {
        path: [0],
        lockKind: true,
        actions: {
          addCommand: () => undefined,
          deleteCommand: () => undefined,
          insertCommand: () => undefined,
          moveCommand: () => undefined,
          moveCommandTo: () => undefined,
          replaceCommand: (_path, next) => {
            staged = next;
          },
        },
      },
      staged,
    ));

    // 인라인 검색 필터는 변수·스위치 선택 모달 통일(2026-08)로 제거됐다. 검색은 "찾기" 트리거가 여는 모달이 소유한다.
    expect(findByTestId(body, "event-switch-inline-filter")).toBeNull();
    expect(findByTestId(body, "event-command-switch-value")).not.toBeNull();
    expect(findByTestId(body, "event-command-switch-value-row")).not.toBeNull();
    expect(findByTestId(body, "event-command-switch-hint")).not.toBeNull();
    // "값 소스" 배지/세그먼트는 쓰지 않는다.
    expect(findByTestId(body, "event-command-switch-value-mode")).toBeNull();
    expect(body.textContent).not.toContain("값 소스");

    const valueSelect = findByTestId(body, "event-command-switch-value") as unknown as HTMLSelectElement;
    valueSelect.value = "toggle";
    valueSelect.dispatchEvent(new Event("change"));
    expect(staged).toEqual({ kind: "setSwitch", switchId: switchRecord.id, value: "toggle" });

    valueSelect.value = "variable";
    valueSelect.dispatchEvent(new Event("change"));
    const operand = findByTestId(body, "event-command-switch-operand") as unknown as HTMLElement;
    expect(operand.hidden).toBe(false);
    const operandSelect = operand.querySelector("select") as HTMLSelectElement | null;
    if (!operandSelect) throw new Error("missing switch operand select");
    operandSelect.value = variable.id;
    operandSelect.dispatchEvent(new Event("change"));
    expect(staged).toEqual({
      kind: "setSwitch",
      switchId: switchRecord.id,
      value: { kind: "var", id: variable.id },
    });
  });

  it("marks non-fixed event graphics as animated previews", () => {
    const graphic = {
      sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" },
    } satisfies EventPageGraphic;

    const preview = renderWithFakeDom(() => renderEventGraphicPreview(graphic, "random"));

    expect(preview).toBeInstanceOf(FakeElement);
    expect(preview.style.boxSizing).toBe("content-box");
    expect(preview.style.width).toBe(`${RESOURCE_SLICING.charset.cellWidth * 2}px`);
    expect(preview.style.height).toBe(`${RESOURCE_SLICING.charset.cellHeight * 2}px`);
    expect(preview.style.backgroundRepeat).toBe("no-repeat");
    expect(preview.style.backgroundSize).toBe(
      `${RESOURCE_SLICING.charset.sheetWidth * 2}px ${RESOURCE_SLICING.charset.sheetHeight * 2}px`
    );
    expect(preview.classList.contains("moving")).toBe(true);
    expect(preview.dataset.movementType).toBe("random");
    expect(preview.style["--event-graphic-frame-a"]).toBeTruthy();
    expect(preview.style["--event-graphic-frame-b"]).toBeTruthy();
  });

  it("uses a distinct test id for small event list graphic icons", () => {
    const graphic = {
      sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" },
    } satisfies EventPageGraphic;

    const icon = renderWithFakeDom(() => renderEventGraphicIcon(graphic));

    expect(icon.dataset.testid).toBe("event-page-graphic-icon-preview");
    expect(icon.classList.contains("event-graphic-icon-preview")).toBe(true);
    // Default list icon stays compact (~0.6875 scale → 16.5×22).
    expect(icon.style.width).toBe(`${RESOURCE_SLICING.charset.cellWidth * 0.6875}px`);
    expect(icon.style.height).toBe(`${RESOURCE_SLICING.charset.cellHeight * 0.6875}px`);
  });

  it("renders page-tab icons at full charset cell size", () => {
    const graphic = {
      sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" },
    } satisfies EventPageGraphic;

    const icon = renderWithFakeDom(() => renderEventGraphicIcon(graphic, { scale: 1 }));

    expect(icon.style.width).toBe(`${RESOURCE_SLICING.charset.cellWidth}px`);
    expect(icon.style.height).toBe(`${RESOURCE_SLICING.charset.cellHeight}px`);
  });

  it("renders runtime support badges in the command list", () => {
    const host = renderWithFakeDom(() => {
      const node = el("div");
      renderCommandList(
        node,
        [{ kind: "m2Command", commandId: "m2-088-comment", fields: { comment: "메모" } }],
        [],
        {
          addCommand: () => undefined,
          deleteCommand: () => undefined,
          insertCommand: () => undefined,
          moveCommand: () => undefined,
          moveCommandTo: () => undefined,
          replaceCommand: () => undefined,
        }
      );
      return node;
    });

    const badge = findByTestId(host, "command-runtime-badge-list-0");
    expect(badge?.dataset.runtimeSupport).toBe("editor-only");
    expect(badge?.attrs.title).toContain("런타임에서 실행되지 않습니다");
  });

  it("renders the inserted native row with the same map support grade as lint and draft validation", () => {
    const host = renderWithFakeDom(() => {
      const node = el("div");
      renderCommandList(
        node,
        [{ kind: "giveMonster", speciesId: "monster_missing", level: 1 }],
        [],
        {
          addCommand: () => undefined,
          deleteCommand: () => undefined,
          insertCommand: () => undefined,
          moveCommand: () => undefined,
          moveCommandTo: () => undefined,
          replaceCommand: () => undefined,
        },
        { runtimeSupport: (command) => commandRuntimeSupport(command, "map") }
      );
      return node;
    });

    expect(findByTestId(host, "command-runtime-badge-list-0")?.dataset.runtimeSupport).toBe("runtime-partial");
  });

  it("renders M2 image resource fields with a picker, selected name, and preview", () => {
    const body = renderWithFakeDom(() => {
      const rendered = renderM2CommandBody(
        {
          path: [],
          actions: {
            addCommand: () => undefined,
            deleteCommand: () => undefined,
            insertCommand: () => undefined,
            moveCommand: () => undefined,
            moveCommandTo: () => undefined,
            replaceCommand: () => undefined,
          },
        },
        {
          kind: "m2Command",
          commandId: "m2-052-move-picture",
          fields: {
            pictureId: "pic_demo",
            resourceId: "easyrpg-picture-cloud",
            x: 24,
            y: 32,
          },
        }
      );
      if (!rendered) throw new Error("expected Move Picture editor body");
      return rendered;
    });

    expect(findByTestId(body, "move-picture-m2-resource-select")).toBeNull();
    expect(findByTestId(body, "move-picture-m2-preview")?.textContent).toContain("pic_demo");
    expect(findByTestId(body, "move-picture-m2-preview")?.textContent).toContain("(24, 32)");
    expect(findByTestId(body, "move-picture-m2-id-input")?.value).toBe("pic_demo");
    expect(findByTestId(body, "move-picture-m2-x-input")?.value).toBe("24");
    expect(findByTestId(body, "move-picture-m2-y-input")?.value).toBe("32");
  });

  it("renders the selected standalone face image inside the Change Face command editor", () => {
    const body = renderWithFakeDom(() =>
      renderCommandBody(
        {
          path: [],
          actions: {
            addCommand: () => undefined,
            deleteCommand: () => undefined,
            insertCommand: () => undefined,
            moveCommand: () => undefined,
            moveCommandTo: () => undefined,
            replaceCommand: () => undefined,
          },
        },
        {
          kind: "changeFace",
          resourceId: "easyrpg-faceset-actor1-05",
          position: "right",
          flipHorizontally: true,
        }
      )
    );

    const preview = findByTestId(body, "event-command-face-preview");

    expect(preview).not.toBeNull();
    expect(preview?.dataset.resourceId).toBe("easyrpg-faceset-actor1-05");
    // 칸 번호는 모델에서 사라졌다 — 표면에도 인덱스 흔적이 없어야 한다.
    expect(preview?.dataset.faceIndex).toBeUndefined();
    expect(findByTestId(body, "event-command-edit-summary")?.textContent).toBe("얼굴 바꾸기");
    expect(findByTestId(body, "event-command-face-index")).toBeNull();
    expect(findByTestId(body, "event-command-face-index-grid")).toBeNull();
    expect(findByTestId(body, "event-command-face-slot-5")).toBeNull();
    expect(findByTestId(body, "event-command-face-resource-set")).not.toBeNull();
    const crop = findByTestId(body, "event-command-face-crop");
    expect(crop?.style["--face-display-width"]).toBe("96px");
    expect(crop?.style["--face-x"]).toBeUndefined();
    expect(crop?.style["--face-sheet-size"]).toBeUndefined();
    expect(findByTestId(body, "faceset-crop-sheet")?.attrs.src).toContain(
      "/assets/easyrpg/faceset/Actor1/05.png",
    );
    // 4×4 격자 대신 낱장 얼굴 갤러리에서 고른다.
    expect(findByTestId(body, "event-command-face-gallery")).not.toBeNull();
    expect(
      findByTestId(body, "event-command-face-option-easyrpg-faceset-actor1-05")?.className,
    ).toContain("is-selected");
  });

  
  it("hides the face gallery for bust resources and shows a bust note", () => {
    const body = renderWithFakeDom(() =>
      renderCommandBody(
        {
          path: [],
          actions: {
            addCommand: () => undefined,
            deleteCommand: () => undefined,
            insertCommand: () => undefined,
            moveCommand: () => undefined,
            moveCommandTo: () => undefined,
            replaceCommand: () => undefined,
          },
        },
        {
          kind: "changeFace",
          resourceId: "generated-face-actor1-bust",
          position: "left",
          flipHorizontally: false,
        }
      )
    );

    expect(findByTestId(body, "event-command-face-bust-note")).not.toBeNull();
    expect(findByTestId(body, "event-command-face-gallery")).toBeNull();
    expect(findByTestId(body, "event-command-face-preview")?.dataset.faceMode).toBe("bust");
    expect(findByTestId(body, "event-command-face-bust-preset")).not.toBeNull();
  });

it("explains missing face graphic previews instead of leaving a blank slot", () => {
    const body = renderWithFakeDom(() =>
      renderCommandBody(
        {
          path: [],
          actions: {
            addCommand: () => undefined,
            deleteCommand: () => undefined,
            insertCommand: () => undefined,
            moveCommand: () => undefined,
            moveCommandTo: () => undefined,
            replaceCommand: () => undefined,
          },
        },
        {
          kind: "changeFace",
          resourceId: "missing-faceset",
          position: "left",
          flipHorizontally: false,
        }
      )
    );

    const preview = findByTestId(body, "event-command-face-preview");

    expect(preview?.dataset.empty).toBe("true");
    expect(preview?.textContent).toContain("missing-faceset");
    expect(preview?.textContent).toContain("미리보기를 찾을 수 없습니다.");
  });

  it("updates the Change Face dialog preview when the face resource changes", () => {
    openFacesetDialog({ kind: "changeFace", resourceId: "", position: "left", flipHorizontally: false }, () => undefined);

    const dialog = findByTestId(document.body as unknown as FakeElement, "event-command-faceset-dialog");
    const resource = findByTestId(dialog ?? new FakeElement("div"), "faceset-resource-id");

    if (!resource || !dialog) throw new Error("missing faceset dialog controls");
    // 칸 번호 스피너는 삭제됐다.
    expect(findByTestId(dialog, "faceset-index")).toBeNull();
    resource.value = "easyrpg-faceset-actor1-05"; resource.dispatchEvent(new Event("input"));

    const preview = findByTestId(dialog, "event-command-face-preview");
    expect(preview?.dataset.resourceId).toBe("easyrpg-faceset-actor1-05");
    expect(preview?.dataset.faceIndex).toBeUndefined();
    expect(findByTestId(dialog, "faceset-crop-sheet")?.attrs.src).toContain(
      "/assets/easyrpg/faceset/Actor1/05.png",
    );
  });

  it("renders page conditions as Korean RM-style condition rows", () => {
    const page = {
      id: "page-1",
      name: "EV0001",
      conditions: [
        { kind: "switch", switchId: "sw_gate", value: true },
        { kind: "switch", switchId: "sw_bonus", value: true },
        { kind: "variable", variableId: "var_score", op: ">=", value: 7 },
        { kind: "item", itemId: "item_potion", present: true },
        { kind: "actor", actorId: "actor_hero", present: true },
        { kind: "timer", timerId: "timer1", seconds: 65 },
      ],
      graphic: {},
      trigger: { kind: "action" },
      priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [],
    } satisfies EventPage;

    const conditions = renderWithFakeDom(() =>
      el("div", { children: renderPageConditions("map-start", "event-1", page) })
    );

    expect(conditions.textContent).toContain("스위치");
    expect(conditions.textContent).toContain("켜짐");
    expect(conditions.textContent).toContain("변수");
    expect(conditions.textContent).toContain("이상");
    expect(conditions.textContent).toContain("아이템");
    expect(conditions.textContent).toContain("보유 중");
    expect(conditions.textContent).toContain("주인공");
    expect(conditions.textContent).toContain("파티에 있음");
    expect(conditions.textContent).toContain("타이머 1");
    expect(conditions.textContent).toContain("포션");
    expect(conditions.textContent).toContain("잭");
    expect(conditions.textContent).toContain("초과");
    expect(conditions.textContent).toContain("미만");
    expect(findByTestId(conditions, "event-page-item-condition-input")?.tagName).toBe("SELECT");
    expect(findByTestId(conditions, "event-page-actor-condition-input")?.tagName).toBe("SELECT");
    expect(findByTestId(conditions, "event-page-timer1-condition-minutes")?.value).toBe("1");
    expect(findByTestId(conditions, "event-page-timer1-condition-seconds")?.value).toBe("5");
  });

  it("keeps extra page conditions in the expandable advanced condition list", () => {
    const page = {
      id: "page-1",
      name: "EV0001",
      conditions: [
        { kind: "switch", switchId: "sw_gate", value: true },
        { kind: "switch", switchId: "sw_bonus", value: true },
        { kind: "switch", switchId: "sw_secret", value: true },
        { kind: "variable", variableId: "var_score", op: ">=", value: 7 },
        { kind: "variable", variableId: "var_rank", op: ">=", value: 3 },
      ],
      graphic: {},
      trigger: { kind: "action" },
      priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [],
    } satisfies EventPage;

    const conditions = renderWithFakeDom(() =>
      el("div", { children: renderPageConditions("map-start", "event-1", page) })
    );

    expect(conditions.textContent).toContain("고급 조건 (2)");
    expect(findByTestId(conditions, "event-page-advanced-condition-list")).not.toBeNull();
    expect(findByTestId(conditions, "event-page-advanced-condition-switch-0")?.value).toBe("sw_secret");
    expect(findByTestId(conditions, "event-page-advanced-condition-variable-1")?.value).toBe("var_rank");
    expect(findByTestId(conditions, "event-page-advanced-condition-variable-picker-1")).not.toBeNull();
    expect(findByTestId(conditions, "event-page-advanced-condition-add")).not.toBeNull();
  });
});
