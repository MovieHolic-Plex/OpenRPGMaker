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

  it("marks non-fixed event graphics as animated previews", () => {
    const graphic = {
      sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" },
    } satisfies EventPageGraphic;

    const preview = renderWithFakeDom(() => renderEventGraphicPreview(graphic, "random"));

    expect(preview).toBeInstanceOf(FakeElement);
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

    const picker = findByTestId(body, "m2-command-resourceId-picker");
    expect(picker?.tagName).toBe("SELECT");
    expect(picker?.value).toBe("easyrpg-picture-cloud");
    expect(findByTestId(body, "m2-command-resourceId-selected-name")?.textContent).toContain(
      "EasyRPG RTP Cloud Picture"
    );
    expect(findByTestId(body, "m2-command-resourceId-preview")?.dataset.resourceId).toBe("easyrpg-picture-cloud");
    expect(findByTestId(body, "m2-command-pictureId-input")?.value).toBe("pic_demo");
    expect(findByTestId(body, "m2-command-x-input")?.value).toBe("24");
    expect(findByTestId(body, "m2-command-y-input")?.value).toBe("32");
  });

  it("renders the selected face graphic crop inside the Change Face command editor", () => {
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
          resourceId: "easyrpg-faceset-actor1",
          faceIndex: 5,
          position: "right",
          flipHorizontally: true,
        }
      )
    );

    const preview = findByTestId(body, "event-command-face-preview");

    expect(preview).not.toBeNull();
    expect(preview?.dataset.resourceId).toBe("easyrpg-faceset-actor1");
    expect(preview?.dataset.faceIndex).toBe("5");
    expect(preview?.textContent).toContain("얼굴 6");
    expect(findByTestId(body, "event-command-edit-summary")?.textContent).toContain("얼굴 그래픽 변경");
    expect(findByTestId(body, "event-command-edit-summary")?.textContent).toContain("easyrpg-faceset-actor1");
    expect(findByTestId(body, "event-command-edit-summary")?.textContent).toContain("오른쪽");
    expect(findByTestId(body, "event-command-edit-summary")?.textContent).not.toContain("right");
    expect(findByTestId(body, "event-command-face-index")?.attrs.max).toBe(String(RESOURCE_SLICING.faceset.count));
    expect(findByTestId(body, "event-command-face-resource-set")).not.toBeNull();
    expect(findByTestId(body, "event-command-face-crop")?.style["--face-x"]).toBe("-48px");
    expect(findByTestId(body, "event-command-face-crop")?.style["--face-y"]).toBe("-48px");
    expect(findByTestId(body, "event-command-face-crop")?.style["--face-sheet-size"]).toBe("192px");
    expect(findByTestId(body, "event-command-face-crop")?.style["--face-display-width"]).toBe("112px");
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
          faceIndex: 0,
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

  it("updates the Change Face dialog preview when resource and face inputs change", () => {
    openFacesetDialog({ kind: "changeFace", resourceId: "", faceIndex: 0, position: "left", flipHorizontally: false }, () => undefined);

    const dialog = findByTestId(document.body as unknown as FakeElement, "event-command-faceset-dialog");
    const resource = findByTestId(dialog ?? new FakeElement("div"), "faceset-resource-id");
    const faceIndex = findByTestId(dialog ?? new FakeElement("div"), "faceset-index");

    if (!resource || !faceIndex || !dialog) throw new Error("missing faceset dialog controls");
    resource.value = "easyrpg-faceset-actor1"; resource.dispatchEvent(new Event("input"));
    faceIndex.value = "6"; faceIndex.dispatchEvent(new Event("input"));

    const preview = findByTestId(dialog, "event-command-face-preview");
    expect(preview?.dataset.resourceId).toBe("easyrpg-faceset-actor1");
    expect(preview?.dataset.faceIndex).toBe("5");
    expect(preview?.textContent).toContain("얼굴 6");
    expect(faceIndex.max).toBe(String(RESOURCE_SLICING.faceset.count));
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
