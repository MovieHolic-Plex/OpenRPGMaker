import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { commandSummary, commandSummaryParts } from "@/editor/panels/eventEditor/commandSummary";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import { renderCommandList } from "@/editor/panels/eventEditor/commandList";
import { renderM2CommandBody } from "@/editor/panels/eventEditor/commandBodyM2";
import { renderEventGraphicIcon, renderEventGraphicPreview } from "@/editor/panels/eventEditor/eventGraphicPreview";
import { renderPageConditions } from "@/editor/panels/eventEditor/pageConditions";
import { RESOURCE_SLICING } from "@/assets/resourceSlicing";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { el } from "@/util/dom";
import type { Command, EventPage, EventPageGraphic, Project } from "@/project/types";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";
import { renderAdvancedCommandBody } from "@/editor/panels/eventEditor/commandBodyAdvanced";
import { renderCommandPreview } from "@/editor/panels/eventEditor/commandPreview";
import type { CommandEditContext } from "@/editor/panels/eventEditor/types";
import { shortRecordName } from "@/editor/shortRecordName";
import { hasBatchim, josa, readIdentifier, readScriptLabels } from "@/editor/script/scriptLabels";
import { shortArmLabel } from "@/editor/panels/eventEditor/scriptLines";
import { isolateTimers } from "./mergedTeardown";

describe("eventEditorPresentation", () => {
  isolateTimers();
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

    it("showEmote 요약은 이모트 이름과 대상을 함께 보여준다", () => {
      expect(commandSummary({
        kind: "showEmote",
        target: { eventId: "town-npc" },
        emote: "heart",
      })).toBe("이모트 표시: 하트 / 이벤트 town-npc");
      expect(commandSummary({
        kind: "showEmote",
        target: "player",
        emote: "question",
      })).toBe("이모트 표시: 물음표 / 주인공");
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
          { pickerContext: "map" }
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

    it("says what an access toggle allows and never prints internal keys or raw booleans", () => {
      const blocked = commandSummary({ kind: "m2Command", commandId: "m2-077-change-save-access", fields: { enabled: "false" } });
      expect(blocked).toContain("저장 막기");
      expect(blocked).not.toMatch(/허가|금지 \/|false/);
      const allowed = commandSummary({ kind: "m2Command", commandId: "m2-077-change-save-access", fields: { enabled: "true", legacyFlag: true } });
      expect(allowed).toContain("저장 허용");
      expect(allowed).not.toMatch(/legacyFlag|true/);
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

    it("updates the Change Face preview when the face resource changes", () => {
      // 얼굴 편집면은 공용 명령 편집 모달의 본문이다 — 종류별 전용 다이얼로그는 없다.
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
          { kind: "changeFace", resourceId: "", position: "left", flipHorizontally: false }
        )
      );

      const resource = findByTestId(body, "event-command-face-resource");
      if (!resource) throw new Error("missing face resource input");
      // 칸 번호 스피너는 삭제됐다.
      expect(findByTestId(body, "faceset-index")).toBeNull();
      resource.value = "easyrpg-faceset-actor1-05";
      resource.dispatchEvent(new Event("input"));

      const preview = findByTestId(body, "event-command-face-preview");
      expect(preview?.dataset.resourceId).toBe("easyrpg-faceset-actor1-05");
      expect(preview?.dataset.faceIndex).toBeUndefined();
      expect(findByTestId(body, "faceset-crop-sheet")?.attrs.src).toContain(
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

    it("얼굴 바꾸기 폼에 AI 얼굴 만들기 칸이 있다", () => {
      const staged: Command = { kind: "changeFace", resourceId: "", position: "left", flipHorizontally: false };
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
            replaceCommand: () => undefined,
          },
        },
        staged,
      ));
      expect(findByTestId(body, "event-command-face-ai-prompt"), "얼굴 AI 프롬프트 칸").not.toBeNull();
      expect(findByTestId(body, "event-command-face-ai-generate"), "얼굴 AI 생성 버튼").not.toBeNull();
    });
  });
});

// EV-2 리치 이벤트 명령 편집 폼 테스트.
// - 레코드 픽커 카드(아이콘 + 이름 + 부제) 렌더
// - 연산 세그먼트 → 숨김 select 동기화 → replaceCommand 호출
// - 수량 스테퍼(− / +)
// - 전/후 프리뷰(시작 인벤토리/소지금/파티 기준) 라이브 계산
// - transfer 통행성 배지
describe("eventEditorRichForms", () => {
  isolateTimers();
  function contextWithReplaceSpy(
    replaceCommand: CommandEditContext["actions"]["replaceCommand"] = vi.fn()
  ): CommandEditContext {
    return {
      path: [2],
      actions: {
        addCommand: vi.fn(),
        insertCommand: vi.fn(),
        replaceCommand,
        deleteCommand: vi.fn(),
        moveCommand: vi.fn(),
        moveCommandTo: vi.fn(),
      },
    };
  }
  function renderBody(context: CommandEditContext, cmd: Command): FakeElement {
    return renderWithFakeDom(() => renderAdvancedCommandBody(context, cmd) ?? document.createElement("div"));
  }
  describe("event editor rich forms", () => {
    let restoreDom: (() => void) | undefined;
    let project: Project;
    let itemId: string;
    let actorId: string;

    beforeEach(() => {
      restoreDom = installFakeDom({ animationFrames: "manual" });
      project = createBlankProject();
      const item = project.database.items[0];
      const actor = project.database.actors[0];
      if (!item || !actor) throw new Error("blank project is missing default item/actor records");
      item.name = "회복약";
      item.iconResourceId = "cc0-jetrel-potion-red";
      actor.name = "잭";
      itemId = item.id;
      actorId = actor.id;
      // 시작 상태(전/후 프리뷰 기준값).
      project.session.inventory = { [itemId]: 3 };
      project.session.gold = 100;
      project.session.partyActorIds = [actorId];
      store.replace(project);
    });

    afterEach(() => {
      restoreDom?.();
    });

    it("renders the Change Item form with an icon card, op segments, and a before/after preview", () => {
      const body = renderBody(contextWithReplaceSpy(), { kind: "changeItem", itemId, op: "+=", amount: 2 });

      // 기존 select 는 testid/값 그대로 유지(테스트·자동화 보호).
      const select = findByTestId(body, "change-item-select");
      expect(select?.tagName).toBe("SELECT");
      expect(select?.value).toBe(itemId);
      expect(findByTestId(body, "change-item-op-select")?.value).toBe("+=");
      expect(findByTestId(body, "change-item-amount-input")?.value).toBe("2");

      // 선택 레코드 카드: 아이콘 + 이름 + 시작 보유 부제.
      const card = findByTestId(body, "change-item-select-card");
      expect(card?.textContent).toContain("회복약");
      expect(card?.textContent).toContain("시작 보유 ×3");
      expect(card?.querySelector("img")?.attrs.src).toContain("potion-red");

      // 전/후 프리뷰: 시작 인벤토리 3 + 2 = 5.
      const preview = findByTestId(body, "change-item-preview");
      expect(preview?.dataset.before).toBe("3");
      expect(preview?.dataset.after).toBe("5");
      expect(preview?.textContent).toContain("×3");
      expect(preview?.textContent).toContain("×5");
      expect(preview?.textContent).toContain("시작 인벤토리 기준");
    });

    it("changes the Change Item operation through segment buttons and keeps the hidden select in sync", () => {
      const replaceCommand = vi.fn<CommandEditContext["actions"]["replaceCommand"]>();
      const body = renderBody(contextWithReplaceSpy(replaceCommand), { kind: "changeItem", itemId, op: "+=", amount: 2 });

      const setSegment = findByTestId(body, "change-item-op-select-segment-set");
      expect(setSegment?.tagName).toBe("BUTTON");
      setSegment?.click();

      expect(findByTestId(body, "change-item-op-select")?.value).toBe("=");
      expect(setSegment?.classList.contains("selected")).toBe(true);
      expect(replaceCommand).toHaveBeenCalledWith([2], { kind: "changeItem", itemId, op: "=", amount: 2 });
      // 대입 연산 프리뷰: 3 → 2.
      expect(findByTestId(body, "change-item-preview")?.dataset.after).toBe("2");
    });

    it("steps the Change Item amount with the +/- stepper buttons and refreshes the preview", () => {
      const replaceCommand = vi.fn<CommandEditContext["actions"]["replaceCommand"]>();
      const body = renderBody(contextWithReplaceSpy(replaceCommand), { kind: "changeItem", itemId, op: "+=", amount: 2 });

      findByTestId(body, "change-item-amount-plus")?.click();

      expect(findByTestId(body, "change-item-amount-input")?.value).toBe("3");
      expect(replaceCommand).toHaveBeenCalledWith([2], { kind: "changeItem", itemId, op: "+=", amount: 3 });
      expect(findByTestId(body, "change-item-preview")?.dataset.after).toBe("6");

      findByTestId(body, "change-item-amount-minus")?.click();
      expect(findByTestId(body, "change-item-amount-input")?.value).toBe("2");
    });

    it("explains storage chest scope without exposing runtime implementation jargon", () => {
      const replaceCommand = vi.fn<CommandEditContext["actions"]["replaceCommand"]>();
      const body = renderBody(contextWithReplaceSpy(replaceCommand), {
        kind: "openChest",
        chestId: "farm_shared_storage",
      });

      expect(findByTestId(body, "open-chest-purpose-card")?.textContent).toContain("넣고 다시 꺼낼");
      expect(findByTestId(body, "open-chest-scope-select")?.value).toBe("shared");
      expect(findByTestId(body, "open-chest-id-input")?.value).toBe("farm_shared_storage");
      expect(body.textContent).not.toContain("session.chests");

      findByTestId(body, "open-chest-scope-select-segment-local")?.click();
      expect(replaceCommand).toHaveBeenLastCalledWith([2], { kind: "openChest" });
      expect(findByTestId(body, "open-chest-shared-settings")?.dataset.active).toBe("false");

      findByTestId(body, "open-chest-scope-select-segment-shared")?.click();
      const sharedId = findByTestId(body, "open-chest-id-input");
      if (!sharedId) throw new Error("missing open-chest-id-input");
      sharedId.value = "village_warehouse";
      sharedId.dispatchEvent(new Event("input"));
      expect(replaceCommand).toHaveBeenLastCalledWith([2], {
        kind: "openChest",
        chestId: "village_warehouse",
      });
    });

    it("previews storage as a two-way bag and chest interaction", () => {
      const preview = renderWithFakeDom(() => renderCommandPreview({
        kind: "openChest",
        chestId: "farm_shared_storage",
      })) as FakeElement;

      const stage = findByTestId(preview, "open-chest-preview");
      expect(stage?.textContent).toContain("가방");
      expect(stage?.textContent).toContain("보관 상자");
      expect(stage?.textContent).toContain("넣기");
      expect(stage?.textContent).toContain("꺼내기");
      expect(stage?.textContent).toContain("여러 상자 공유");
      expect(stage?.textContent).not.toContain("session.chests");
    });

    it("authors farm template, display name, and capacity on the storage chest form", () => {
      const replaceCommand = vi.fn<CommandEditContext["actions"]["replaceCommand"]>();
      const body = renderBody(contextWithReplaceSpy(replaceCommand), {
        kind: "openChest",
        template: "farm",
      });

      expect(findByTestId(body, "open-chest-template")?.value).toBe("farm");
      const name = findByTestId(body, "open-chest-display-name");
      if (!name) throw new Error("missing open-chest-display-name");
      name.value = "헛간";
      name.dispatchEvent(new Event("input"));
      expect(replaceCommand).toHaveBeenLastCalledWith([2], {
        kind: "openChest",
        displayName: "헛간",
        template: "farm",
      });
    });

    it("previews Change Gold against the project's starting gold with a clamped result", () => {
      const replaceCommand = vi.fn<CommandEditContext["actions"]["replaceCommand"]>();
      const body = renderBody(contextWithReplaceSpy(replaceCommand), { kind: "changeGold", op: "+=", amount: 150 });

      const preview = findByTestId(body, "change-gold-preview");
      expect(preview?.dataset.before).toBe("100");
      expect(preview?.dataset.after).toBe("250");
      expect(preview?.textContent).toContain("지금 100G");
      expect(preview?.textContent).toContain("실행 후 250G");
      expect(preview?.textContent).toContain("시작 소지금 기준");

      // 감소 세그먼트: 100 - 150 → 0 으로 클램프(런타임 changeGold 와 동일 규칙).
      findByTestId(body, "change-gold-op-select-segment-dec")?.click();
      expect(replaceCommand).toHaveBeenCalledWith([2], { kind: "changeGold", op: "-=", amount: 150 });
      expect(preview?.dataset.after).toBe("0");
    });

    it("keeps the legacy select change path working for op selects (Playwright selectOption compatibility)", () => {
      const replaceCommand = vi.fn<CommandEditContext["actions"]["replaceCommand"]>();
      const body = renderBody(contextWithReplaceSpy(replaceCommand), { kind: "changeGold", op: "+=", amount: 10 });

      const opSelect = findByTestId(body, "change-gold-op-select");
      if (!opSelect) throw new Error("missing change-gold-op-select");
      opSelect.value = "=";
      opSelect.dispatchEvent(new Event("change"));

      expect(replaceCommand).toHaveBeenCalledWith([2], { kind: "changeGold", op: "=", amount: 10 });
      expect(findByTestId(body, "change-gold-op-select-segment-set")?.classList.contains("selected")).toBe(true);
    });

    it("previews Change Party membership against the starting party", () => {
      const replaceCommand = vi.fn<CommandEditContext["actions"]["replaceCommand"]>();
      const body = renderBody(contextWithReplaceSpy(replaceCommand), { kind: "changeParty", actorId, action: "remove" });

      expect(findByTestId(body, "change-party-actor-select")?.value).toBe(actorId);
      expect(findByTestId(body, "change-party-actor-select-card")?.textContent).toContain("잭");

      const preview = findByTestId(body, "change-party-preview");
      expect(preview?.dataset.beforeIn).toBe("true");
      expect(preview?.dataset.afterIn).toBe("false");
      expect(preview?.textContent).toContain("파티에 있음");
      expect(preview?.textContent).toContain("파티에 없음");
      expect(preview?.textContent).toContain("시작 파티 기준");

      findByTestId(body, "change-party-action-select-segment-add")?.click();
      expect(replaceCommand).toHaveBeenCalledWith([2], { kind: "changeParty", actorId, action: "add" });
      expect(preview?.dataset.afterIn).toBe("true");
    });

    it("shows enemy names in the Battle Processing troop card subtitle", () => {
      const troop = project.database.troops[0];
      const enemy = project.database.enemies[0];
      if (!troop || !enemy) throw new Error("blank project is missing default troop/enemy records");
      enemy.name = "슬라임";
      troop.enemyIds = [enemy.id];
      store.replace(project);

      const replaceCommand = vi.fn<CommandEditContext["actions"]["replaceCommand"]>();
      const body = renderBody(contextWithReplaceSpy(replaceCommand), {
        kind: "battleProcessing",
        troopId: troop.id,
        canEscape: true,
        canLose: false,
      });

      expect(findByTestId(body, "battle-processing-troop-select")?.tagName).toBe("SELECT");
      expect(findByTestId(body, "battle-processing-troop-select-card")?.textContent).toContain("슬라임");
      const escape = findByTestId(body, "battle-processing-escape-select");
      const lose = findByTestId(body, "battle-processing-lose-select");
      expect(escape?.tagName).toBe("SELECT");
      expect(escape?.value).toBe("allow");
      expect(lose?.tagName).toBe("SELECT");
      expect(lose?.value).toBe("gameover");
      if (!escape) throw new Error("missing battle-processing-escape-select");
      escape.value = "deny";
      escape.dispatchEvent(new Event("change"));
      expect(replaceCommand).toHaveBeenCalledWith([2], {
        kind: "battleProcessing",
        troopId: troop.id,
        canEscape: false,
        canLose: false,
        battleFlow: undefined,
        troopSource: undefined,
        troopVariableId: undefined,
        branchOnResult: undefined,
        victoryBranch: undefined,
        defeatBranch: undefined,
        escapeBranch: undefined,
      });
    });

    it("renders equipment icons in the Change Equipment picker card", () => {
      const equipment = project.database.equipment[0];
      if (!equipment) throw new Error("blank project is missing default equipment records");
      equipment.name = "청동검";
      equipment.iconResourceId = "cc0-jetrel-bronze-sword";
      store.replace(project);

      const body = renderBody(contextWithReplaceSpy(), {
        kind: "changeEquipment",
        actorId,
        slot: "weapon",
        equipmentId: equipment.id,
      });

      expect(findByTestId(body, "change-equipment-actor-select")?.value).toBe(actorId);
      expect(findByTestId(body, "change-equipment-slot-select")?.tagName).toBe("SELECT");
      const selected = findByTestId(body, "change-equipment-selected");
      expect(selected?.textContent).toContain("청동검");
      expect(selected?.querySelector("img")?.attrs.src).toContain("bronze-sword");
    });

    it("renders Learn Skill with record picker cards while keeping the legacy select test ids", () => {
      const skill = project.database.skills[0];
      if (!skill) throw new Error("blank project is missing default skill records");
      skill.name = "파이어";
      store.replace(project);

      const body = renderBody(contextWithReplaceSpy(), { kind: "learnSkill", actorId, skillId: skill.id });

      expect(findByTestId(body, "learn-skill-actor-select")?.value).toBe(actorId);
      expect(findByTestId(body, "learn-skill-skill-select")?.value).toBe(skill.id);
      expect(findByTestId(body, "learn-skill-skill-select-card")?.textContent).toContain("파이어");
      expect(findByTestId(body, "event-command-learn-skill-form")).toBeTruthy();
      expect(findByTestId(body, "learn-skill-action-select")).toBeTruthy();
    });

    it("flags out-of-bounds transfer destinations with a blocked passability badge", () => {
      const body = renderBody(contextWithReplaceSpy(), {
        kind: "transfer",
        mapId: project.startMapId,
        x: -1,
        y: -1,
      });

      expect(findByTestId(body, "transfer-command-summary")).not.toBeNull();
      const badge = findByTestId(body, "transfer-passability-badge");
      expect(badge?.dataset.passable).toBe("false");
      expect(badge?.textContent).toContain("통행 불가 타일!");
    });

    it("seeds an unknown transfer target to the active start map and shows passability", async () => {
      const replaceCommand = vi.fn<CommandEditContext["actions"]["replaceCommand"]>();
      const body = renderBody(contextWithReplaceSpy(replaceCommand), { kind: "transfer", mapId: "", x: 0, y: 0 });
      const badge = findByTestId(body, "transfer-passability-badge");

      expect(findByTestId(body, "transfer-command-summary")?.textContent).toContain(project.maps[project.startMapId]?.name);
      expect(badge?.dataset.passable).toBe("true");
      await Promise.resolve();
      expect(replaceCommand).toHaveBeenCalledWith([2], {
        kind: "transfer",
        mapId: project.startMapId,
        x: 0,
        y: 0,
      });
    });
  });
});

// test/eventReadability.test.ts — the naming pieces behind the event list's readability pass (2026-11-01):
// short switch/variable names (src/editor/shortRecordName.ts) and the Korean labels a script gives its own code
// (src/editor/script/scriptLabels.ts). Wiki: openwiki/script-sandbox.md 「목록에서 읽히는 스크립트」.
describe("eventReadability", () => {
  isolateTimers();
  describe("shortRecordName", () => {
    it("drops the description written into a name and never returns an empty name", () => {
      expect(shortRecordName("레버 퍼즐 진행 단계(0~4, 올바르게 당긴 레버 수)")).toBe("레버 퍼즐 진행 단계");
      expect(shortRecordName("마을 평판 (레버 퍼즐 해결 시 +10)")).toBe("마을 평판");
      expect(shortRecordName("레버 퍼즐(3→1→4→2)을 풀어 창고 문이 열림")).toBe("레버 퍼즐을 풀어 창고 문이 열림");
      expect(shortRecordName("평판 — 마을에서의 주인공 평판 (로직은 다음 작업에서 연결)")).toBe("평판");
      expect(shortRecordName("포션 할인율 % (평판×3, 최대 30)")).toBe("포션 할인율");
      expect(shortRecordName("지금 포션 가격 = 50 × (100-할인율) / 100, 소수점 버림")).toBe("지금 포션 가격");
      expect(shortRecordName("마을 평판. 할머니 퀘스트 완료 시 +10")).toBe("마을 평판");
      expect(shortRecordName("평판")).toBe("평판");
      expect(shortRecordName("(괄호만)")).toBe("(괄호만)");
    });
  });
  describe("readScriptLabels", () => {
    it("reads trailing-comment names, @label tags, JSDoc helper labels and heading comments", () => {
      const labels = readScriptLabels([
        "// 가격 계산",
        "const pct = discountPercent(rep); // 할인율",
        "const BASE = 120, MAX_OFF = 30; // 기본 가격, 최대 할인",
        'const url = "http://x"; // 주소',
        "// @label A: 이미 당김",
        "// @label LEVERS: 레버들",
        "/** @label 할인된 값 */",
        "function discounted(n: number) { return n; }",
        "",
        "// 틀린 순서: 원위치",
        "if (x) {",
        "}",
      ].join("\n"));
      expect(labels.names.get("pct")).toBe("할인율");
      expect(labels.names.get("BASE")).toBe("기본 가격");
      expect(labels.names.get("MAX_OFF")).toBe("최대 할인");
      expect(labels.names.get("url")).toBe("주소");
      expect(labels.names.get("LEVERS")).toBe("레버들");
      expect(labels.names.get("discounted")).toBe("할인된 값");
      expect(labels.selfSwitches.get("A")).toBe("이미 당김");
      expect([...labels.headings.entries()]).toEqual([[2, "가격 계산"], [11, "틀린 순서: 원위치"]]);
    });

    it("does not take a comma list that does not match the declarators, nor eslint/ts comments as headings", () => {
      const labels = readScriptLabels(["const a = 1, b = 2; // 하나", "// eslint-disable-next-line", "game.wait(1);"].join("\n"));
      expect(labels.names.size).toBe(0);
      expect(labels.headings.size).toBe(0);
    });
  });
  describe("readIdentifier / josa", () => {
    it("reads known words and keeps unknown identifiers", () => {
      expect(readIdentifier("discountedPrice")).toBe("할인된 가격");
      expect(readIdentifier("discountPercent")).toBe("할인율");
      expect(readIdentifier("ORDER")).toBe("순서");
      expect(readIdentifier("ev_lever1")).toBe("레버 1");
      expect(readIdentifier("BASE_PRICE")).toBe("기본 가격");
      expect(readIdentifier("sx")).toBeUndefined();
    });

    it("picks the particle by the last syllable or digit", () => {
      expect(josa("돈", "이", "가")).toBe("돈이");
      expect(josa("개수", "이", "가")).toBe("개수가");
      expect(hasBatchim("3")).toBe(true);
      expect(hasBatchim("4")).toBe(false);
      expect(hasBatchim("「평판」")).toBe(true);
    });

    it("says branch arms the short way in the list", () => {
      expect(shortArmLabel("조건이 맞을 때")).toBe("그러면");
      expect(shortArmLabel("조건이 맞지 않을 때")).toBe("아니면");
      expect(shortArmLabel("이겼을 때")).toBe("이겼을 때");
    });
  });
});
