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
import type { Command, EventPage, EventPageGraphic, GameEvent, MapId, EventPageCondition } from "@/project/types";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";
import { eventSurfaceFileContaining } from "./helpers/eventSurfaceCss";
import { readFileSync } from "node:fs";
import { editorState } from "@/editor/editorState";
import { renderEventEditor } from "@/editor/panels/eventEditor";
import { openEventEditorModal } from "@/editor/panels/eventEditor/modal";
import { eventDraftDiff, eventDraftHasUserChanges } from "@/project/eventDrafts";
import { _resetEventDraftVaultForTest } from "@/project/eventDraftVault";
import { resetToastsForTest } from "@/util/toast";
import { normalizeEventPage } from "@/editor/eventPages";
import { renderClassicPageTabStrip } from "@/editor/panels/eventEditor/pageProps";
import { isolateTimers } from "./mergedTeardown";
import { shortRecordName } from "@/editor/shortRecordName";
import { hasBatchim, josa, readIdentifier, readScriptLabels } from "@/editor/script/scriptLabels";
import { shortArmLabel } from "@/editor/panels/eventEditor/scriptLines";
import { flattenScript, renderEventPageFlow, renderEventPagePreview } from "@/editor/panels/eventEditor/eventScriptModernViews";
import { FORK_THEN_BRANCH_INDEX, isContainerInsideCommand, moveCommandBetweenLists, resolveCommandListAtPath } from "@/editor/eventCommandPaths";
import { fieldSpawnBody } from "@/editor/panels/eventEditor/commandBodyFieldSpawn";
import { createCaptureProject } from "./fixtures/captureProject";
import { MINIMAL_COMMANDS } from "./fixtures/minimalCommands";
import { probeCommandControls } from "./eventEditorCommitProbe";

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

// test/eventIdReadout.test.ts
//
// OPRN-OUT-014 — 선택한 이벤트의 정본 `event.id` 를 읽기 전용 속성으로 보여 준다.
//
// 왜 이 게이트가 필요한가: 이 값이 보이는 곳은 목록 호버 카드와 전역 검색 결과뿐이었다 —
// 둘 다 «값을 이미 알아야» 닿는 경로다. 그리고 예전 헤더의 `0007` 은 ID 가 아니라 맵
// events 배열 순번이었다(modal.ts 주석). 그래서 이 테스트는 두 가지를 동시에 못 박는다:
//   1) 화면에 뜨는 문자열이 **저장된 event.id 그 자체**여야 한다(순번·이름·characterId 유도 금지)
//   2) 그 표시를 만지는 것으로 프로젝트도 이벤트 드래프트도 더러워지지 않아야 한다
describe("eventIdReadout", () => {
  isolateTimers();
  let restoreFakeDom: () => void = () => undefined;
  /** 실제 genId("ev") 출력 모양 — prefix + v4 UUID. 39자라 좁은 상자에서 레이아웃을 시험한다. */
  const LONG_UUID_ID = "ev_3f1c9b2e-8a47-4d6b-9c05-7e2a1b4d8f30";
  function fakeContainer(): HTMLElement {
    return new FakeElement("div") as unknown as HTMLElement;
  }
  function page(id = "page-1", name = "EV001"): EventPage {
    return {
      id,
      name,
      conditions: [],
      graphic: {},
      trigger: { kind: "action" },
      priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [],
    };
  }
  function gameEvent(id: string, overrides: Partial<GameEvent> = {}): GameEvent {
    return {
      id,
      x: 7,
      y: 4,
      trigger: { kind: "action" },
      commands: [],
      pages: [page()],
      ...overrides,
    };
  }
  /** 맵에 이벤트를 심고 첫 번째를 선택한 상태로 만든다. */
  function seed(events: readonly GameEvent[], selectedId = events[0]?.id ?? null): MapId {
    const project = createBlankProject();
    const mapId = project.startMapId;
    project.maps[mapId].events = events.map((event) => ({ ...event }));
    store.replaceProject(project);
    editorState.set({
      currentMapId: mapId,
      selectedEventId: selectedId,
      selectedEventPageId: events.find((event) => event.id === selectedId)?.pages?.[0]?.id ?? null,
    });
    return mapId;
  }
  function renderSidebar(): HTMLElement {
    const container = fakeContainer();
    renderEventEditor(container);
    return container;
  }
  function readout(root: HTMLElement, scope = "event-summary"): HTMLElement {
    const node = root.querySelector<HTMLElement>(`[data-testid="${scope}-event-id"]`);
    if (!node) throw new Error(`${scope}-event-id 를 찾지 못했다`);
    return node;
  }
  function valueInput(root: HTMLElement, scope = "event-summary"): HTMLInputElement {
    const node = root.querySelector<HTMLInputElement>(`[data-testid="${scope}-event-id-value"]`);
    if (!node) throw new Error(`${scope}-event-id-value 를 찾지 못했다`);
    return node;
  }
  describe("이벤트 ID 읽기 전용 표시 (OPRN-OUT-014)", () => {
    beforeEach(() => {
      _resetEventDraftVaultForTest();
      restoreFakeDom = installFakeDom();
      resetToastsForTest();
    });

    afterEach(() => {
      document.querySelector<HTMLElement>('[data-testid="event-list-tooltip"]')?.remove();
      document.querySelector<HTMLElement>('[data-testid="event-editor-modal"]')?.remove();
      resetToastsForTest();
      _resetEventDraftVaultForTest();
      restoreFakeDom();
      vi.unstubAllGlobals();
    });

    // ── 정확한 값 ────────────────────────────────────────────────────────────────

    it("저장된 이벤트: 선택 요약이 저장된 id 를 글자 그대로 보여 준다", () => {
      seed([gameEvent("ev_saved_alpha")]);
      expect(valueInput(renderSidebar()).value).toBe("ev_saved_alpha");
    });

    it("새 드래프트: 아직 커밋 전이어도 배정된 id 를 보여 준다", () => {
      seed([gameEvent("ev_fresh_draft", { draft: { kind: "new" } })]);
      expect(valueInput(renderSidebar()).value).toBe("ev_fresh_draft");
    });

    it("복제 이벤트: 원본이 아니라 자기 id 를 보여 준다", () => {
      const source = gameEvent("ev_source", { pages: [page("page-1", "원본")] });
      const clone = gameEvent("ev_clone", { x: 8, pages: [page("page-1", "원본")] });
      seed([source, clone], "ev_clone");
      expect(valueInput(renderSidebar()).value).toBe("ev_clone");
    });

    it("레거시·커스텀 id: 접두사 규칙을 안 따라도 그대로 보여 준다", () => {
      seed([gameEvent("EV003")]);
      expect(valueInput(renderSidebar()).value).toBe("EV003");
    });

    it("긴 UUID id: 잘리지 않은 전체 값이 value 와 title 에 남는다", () => {
      seed([gameEvent(LONG_UUID_ID)]);
      const input = valueInput(renderSidebar());
      expect(input.value).toBe(LONG_UUID_ID);
      expect(input.getAttribute("title")).toContain(LONG_UUID_ID);
    });

    it("표시 이름·페이지 id·characterId·목록 순번을 값으로 쓰지 않는다", () => {
      seed([
        gameEvent("ev_first"),
        gameEvent("ev_target", {
          characterId: "npc_baker",
          pages: [page("page-xyz", "빵집 주인")],
        }),
      ], "ev_target");
      const input = valueInput(renderSidebar());
      expect(input.value).toBe("ev_target");
      expect(input.value).not.toContain("npc_baker");
      expect(input.value).not.toContain("page-xyz");
      expect(input.value).not.toContain("빵집");
      expect(input.value).not.toBe("2");
    });

    // ── 읽기 전용 ────────────────────────────────────────────────────────────────

    it("readonly 속성으로 잠근다 — disabled 는 키보드 선택을 막으므로 쓰지 않는다", () => {
      seed([gameEvent("ev_locked")]);
      const input = valueInput(renderSidebar());
      expect(input.getAttribute("readonly")).not.toBeNull();
      expect(input.getAttribute("disabled")).toBeNull();
      expect(input.disabled).toBe(false);
      // 탭 순서에 남아야 포커스 → Ctrl+A → 복사가 가능하다.
      expect(input.getAttribute("tabindex")).not.toBe("-1");
    });

    it("값을 바꿔 change 를 쏘아도 프로젝트도 드래프트도 바뀌지 않는다", () => {
      // 드래프트에 원본 스냅샷을 실어 둔다 — original 이 없으면 diff 가 무조건 null 이라
      // 「diff 에 안 들어간다」를 증명하지 못한다.
      const base = gameEvent("ev_immutable");
      const mapId = seed([{ ...base, draft: { kind: "edit", original: { ...base } } }]);
      const input = valueInput(renderSidebar());

      input.value = "ev_hacked";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));

      const project = store.getCurrent();
      const stored = project.maps[mapId]?.events.find((event) => event.id === "ev_immutable");
      expect(stored).toBeDefined();
      expect(project.maps[mapId]?.events.some((event) => event.id === "ev_hacked")).toBe(false);
      expect(eventDraftHasUserChanges(project, mapId, "ev_immutable")).toBe(false);
      expect(eventDraftDiff(mapId, stored!)?.changes ?? []).toEqual([]);
    });

    it("읽기 전용 표시를 만지는 것만으로 프로젝트가 미저장 상태가 되지 않는다", () => {
      seed([gameEvent("ev_clean")]);
      const before = store.hasUnsavedChanges();
      const input = valueInput(renderSidebar());
      input.focus();
      input.select();
      input.value = "ev_typed";
      input.dispatchEvent(new Event("change", { bubbles: true }));
      expect(store.hasUnsavedChanges()).toBe(before);
    });

    // ── 라벨·도움말 ──────────────────────────────────────────────────────────────

    it("라벨과 도움말이 이벤트 이름·페이지·characterId·목록 순서와 구분해 준다", () => {
      seed([gameEvent("ev_labelled")]);
      const root = renderSidebar();
      const label = root.querySelector<HTMLElement>('[data-testid="event-summary-event-id-label"]');
      const hint = root.querySelector<HTMLElement>('[data-testid="event-summary-event-id-hint"]');
      expect(label?.textContent).toBe("이벤트 ID");

      const help = hint?.textContent ?? "";
      expect(help).toContain("이벤트 이름");
      expect(help).toContain("페이지");
      expect(help).toContain("characterId");
      expect(help).toContain("순서");
      // 「고칠 수 없다」를 말해야 사용자가 이름칸으로 오해하지 않는다.
      expect(help).toMatch(/고칠 수 없|수정할 수 없/u);

      // 스크린리더가 라벨/설명을 실제로 집도록 연결돼 있어야 한다.
      const input = valueInput(root);
      expect(input.getAttribute("aria-labelledby")).toBe(label?.getAttribute("id"));
      expect(input.getAttribute("aria-describedby")).toBe(hint?.getAttribute("id"));
    });

    // ── 선택 변경 ────────────────────────────────────────────────────────────────

    it("다른 이벤트를 고르면 표시가 따라 바뀐다 — 낡은 값이 남지 않는다", () => {
      seed([gameEvent("ev_one"), gameEvent("ev_two", { x: 9 })], "ev_one");
      expect(valueInput(renderSidebar()).value).toBe("ev_one");

      editorState.set({ selectedEventId: "ev_two", selectedEventPageId: "page-1" });
      const second = renderSidebar();
      expect(valueInput(second).value).toBe("ev_two");
      expect(second.querySelector('[data-testid="event-summary-event-id-value"]')).not.toBeNull();
      // 같은 컨테이너 안에 ID 표시는 하나뿐이어야 한다(이전 렌더 잔존 금지).
      expect(second.querySelectorAll('[data-testid="event-summary-event-id-value"]').length).toBe(1);
    });

    it("선택이 없으면 ID 표시도 없다 — 빈 값이나 마지막 이벤트가 남지 않는다", () => {
      seed([gameEvent("ev_only")], null);
      expect(renderSidebar().querySelector('[data-testid="event-summary-event-id"]')).toBeNull();
    });

    // ── 복사 동작 ────────────────────────────────────────────────────────────────

    it("복사 성공은 접근 가능한 토스트로 알린다", async () => {
      seed([gameEvent(LONG_UUID_ID)]);
      const dirtyBefore = store.hasUnsavedChanges();
      const writeText = vi.fn(async () => undefined);
      vi.stubGlobal("navigator", { clipboard: { writeText } });

      const root = renderSidebar();
      const copy = root.querySelector<HTMLElement>('[data-testid="event-summary-event-id-copy"]');
      expect(copy).not.toBeNull();
      expect(copy?.getAttribute("aria-label")).toContain("이벤트 ID");
      // 눈에 보이는 글자 라벨이어야 한다 — 아이콘만 넣으면 이 저장소에는 SVG 크기 규칙이
      // 없어 8×8px 로 찍힌다(1440×900 실측).
      expect(copy?.textContent?.trim()).toBe("복사");
      copy?.dispatchEvent(new Event("click", { bubbles: true }));
      await vi.waitFor(() => {
        expect(writeText).toHaveBeenCalledWith(LONG_UUID_ID);
      });

      await vi.waitFor(() => {
        const alive = document.querySelector<HTMLElement>('[data-testid="toast"]');
        expect(alive?.textContent ?? "").toContain("복사");
        expect(alive?.className ?? "").toContain("ok");
      });
      // 복사는 읽기 동작이다 — 프로젝트를 더럽히지 않는다.
      expect(store.hasUnsavedChanges()).toBe(dirtyBefore);
    });

    it("복사 실패는 조용히 지나가지 않고 error 토스트로 알린다", async () => {
      seed([gameEvent("ev_copy_fail")]);
      // Clipboard API 없음 + execCommand 없음 → 폴백까지 실패하는 경로.
      vi.stubGlobal("navigator", {});

      const root = renderSidebar();
      root.querySelector<HTMLElement>('[data-testid="event-summary-event-id-copy"]')
        ?.dispatchEvent(new Event("click", { bubbles: true }));

      await vi.waitFor(() => {
        const alive = document.querySelector<HTMLElement>('[data-testid="toast"]');
        expect(alive?.className ?? "").toContain("error");
        expect(alive?.getAttribute("role")).toBe("alert");
      });
    });

    // ── 이벤트 편집 모달 헤더 ────────────────────────────────────────────────────

    it("이벤트 편집 모달 헤더도 같은 id 를 읽기 전용으로 보여 준다", () => {
      const mapId = seed([gameEvent(LONG_UUID_ID)]);
      openEventEditorModal(mapId, LONG_UUID_ID);
      const modal = document.querySelector<HTMLElement>('[data-testid="event-editor-modal"]');
      expect(modal).not.toBeNull();

      const input = valueInput(modal!, "event-editor");
      expect(input.value).toBe(LONG_UUID_ID);
      expect(input.getAttribute("readonly")).not.toBeNull();
      expect(input.getAttribute("disabled")).toBeNull();
      // 헤더는 48px 한 줄이라 도움말 문장을 붙일 자리가 없다 — title 이 그 역할을 한다.
      expect(input.getAttribute("title") ?? "").toContain("이벤트 ID");
      expect(readout(modal!, "event-editor").dataset.variant).toBe("chip");
    });

    it("모달 헤더 ID 상자의 change 도 이벤트를 바꾸지 않는다", () => {
      const mapId = seed([gameEvent("ev_modal_ro")]);
      openEventEditorModal(mapId, "ev_modal_ro");
      const modal = document.querySelector<HTMLElement>('[data-testid="event-editor-modal"]')!;
      const input = valueInput(modal, "event-editor");
      input.value = "ev_modal_hacked";
      input.dispatchEvent(new Event("change", { bubbles: true }));

      const project = store.getCurrent();
      expect(project.maps[mapId]?.events.map((event) => event.id)).toContain("ev_modal_ro");
      expect(project.maps[mapId]?.events.map((event) => event.id)).not.toContain("ev_modal_hacked");
    });

    // ── 기존 표면 보존 ───────────────────────────────────────────────────────────

    it("목록 호버 카드의 `ID <event.id>` 표기는 그대로다", async () => {
      const { buildEventListTooltipModel } = await import("@/editor/eventMarkerUx");
      const model = buildEventListTooltipModel(gameEvent(LONG_UUID_ID));
      expect(model.identity).toBe(LONG_UUID_ID);
      expect(model.plainText).toContain(`ID ${LONG_UUID_ID}`);
    });

    it("전역 검색은 여전히 event.id 로 이벤트를 찾는다", async () => {
      const mapId = seed([gameEvent(LONG_UUID_ID)]);
      const { searchProject } = await import("@/editor/panels/mapEventSearchModel");
      const results = searchProject({
        project: store.getCurrent(),
        selectedMapId: mapId,
        query: LONG_UUID_ID,
        scope: "all",
      });
      const hit = results.find((result) => result.kind === "mapEvent");
      expect(hit).toBeDefined();
      expect(hit?.detail).toContain(LONG_UUID_ID);
    });

    // ── 레이아웃 ─────────────────────────────────────────────────────────────────

    it("긴 값이 상자를 밀어내지 않도록 두 변형 모두 넘침 규칙을 갖는다", () => {
      // 왜 CSS 를 파일로 읽는가: 맵/모달 캔버스는 WebGL 이고 단위 테스트 DOM 에는 레이아웃
      // 엔진이 없다. 「긴 UUID 가 레이아웃을 깨지 않는다」는 약속을 검증 가능한 형태로
      // 고정할 수 있는 지점은 규칙 자체다(값이 사라지면 이 테스트가 먼저 깨진다).
      // 2026-09-11 Task 13: 카드 변형(옛 from-editor-core-part-2.css)과 칩 변형(옛 event-editor.balanced.css)은 이제 구성 요소
      // 버킷(pages*.css) 에 있다. 파일 이름 대신 각 변형의 선택자를 가진 리프 시트를 찾아 읽는다.
      const cardFile = eventSurfaceFileContaining(".event-editor input.event-id-readout-value");
      const chipFile = eventSurfaceFileContaining(".event-editor-modal-header .event-id-readout {");
      expect(cardFile, "카드 변형 규칙을 가진 이벤트 시트").toBeDefined();
      expect(chipFile, "칩 변형 규칙을 가진 이벤트 시트").toBeDefined();
      const card = readFileSync(cardFile!, "utf8");
      const chip = readFileSync(chipFile!, "utf8");

      const cardRule = card.slice(card.indexOf(".event-id-readout-value"));
      expect(card).toContain(".event-id-readout");
      // 카드 변형은 전체 값을 보여 준다 — 줄바꿈으로 감싸고 가로 스크롤을 만들지 않는다.
      expect(cardRule).toMatch(/min-width:\s*0/u);
      expect(cardRule).toMatch(/text-overflow:\s*ellipsis/u);

      const chipRule = chip.slice(chip.indexOf(".event-id-readout"));
      expect(chip).toContain(".event-editor-modal-header .event-id-readout");
      // 칩 변형은 48px 헤더 안에 갇혀야 한다 — 상한 폭 + 줄임표.
      expect(chipRule).toMatch(/max-width:/u);
      expect(chipRule).toMatch(/text-overflow:\s*ellipsis/u);
    });
  });
});

describe("eventPage", () => {
  isolateTimers();
  describe("eventPageNormalize", () => {
    isolateTimers();
    describe("normalizeEventPage", () => {
      it("fills the fields the event editor reads without optional chaining", () => {
        const page = normalizeEventPage({ id: "page-1", name: "첫 방문" });

        expect(page.graphic).toEqual({});
        expect(page.trigger).toEqual({ kind: "action" });
        expect(page.priority).toBe("same");
        expect(page.movement).toEqual({ type: "fixed", speed: 3, frequency: 3 });
        expect(page.conditions).toEqual([]);
        expect(page.commands).toEqual([]);
        expect(page.name).toBe("첫 방문");
      });

      it("keeps authored movement extras when only some fields are missing", () => {
        const page = normalizeEventPage({
          id: "page-2",
          name: "단골 창구",
          movement: { type: "random" } as never,
          commands: [{ kind: "text", body: "어서 오세요" }],
        });

        expect(page.movement.type).toBe("random");
        expect(page.movement.speed).toBe(3);
        expect(page.movement.frequency).toBe(3);
        expect(page.commands).toEqual([{ kind: "text", body: "어서 오세요" }]);
      });
    });
  });
  describe("eventPageTabsRich", () => {
    isolateTimers();
    let restoreFakeDom: () => void = () => undefined;
    function eventPage(id: string, overrides: Partial<EventPage> = {}): EventPage {
      return {
        id,
        name: "EV001",
        conditions: [],
        graphic: {},
        trigger: { kind: "action" },
        priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [],
        ...overrides,
      };
    }
    function gameEvent(pages: EventPage[]): GameEvent {
      return {
        id: "event-1",
        x: 1,
        y: 1,
        trigger: { kind: "action" },
        commands: [],
        pages,
      };
    }
    function richConditions(): EventPageCondition[] {
      return [
        { kind: "switch", switchId: "sw_0001", value: true },
        { kind: "variable", variableId: "var_0001", op: ">=", value: 3 },
        { kind: "item", itemId: "missing-item", present: true },
        { kind: "actor", actorId: "missing-actor", present: true },
        { kind: "timer", timerId: "timer1", seconds: 30 },
      ];
    }
    function renderStrip(pages: EventPage[], activePage: EventPage = pages[0]!): FakeElement {
      const strip = renderClassicPageTabStrip("map_start", gameEvent(pages), activePage);
      if (!(strip instanceof FakeElement)) throw new Error("expected FakeElement render");
      return strip;
    }
    describe("rich event page tabs", () => {
      beforeEach(() => {
        restoreFakeDom = installFakeDom();
        const project = createBlankProject();
        const firstSwitch = project.switches.find((record) => record.id === "sw_0001");
        if (firstSwitch) firstSwitch.name = "별등 의뢰 수락";
        const firstVariable = project.variables.find((record) => record.id === "var_0001");
        if (firstVariable) firstVariable.name = "별등 진행도";
        store.replace(project);
        editorState.set({ selectedEventPageId: null });
      });

      afterEach(() => {
        restoreFakeDom();
      });

      it("renders page tabs without graphic thumbnails (mockup v2 contract)", () => {
        const pages = [
          eventPage("page-1"),
          eventPage("page-2", { graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" } } }),
        ];
        const strip = renderStrip(pages);

        const tab1 = findByTestId(strip, "evt-page-segment-1");
        const tab2 = findByTestId(strip, "evt-page-segment-2");
        expect(tab1).not.toBeNull();
        expect(tab2).not.toBeNull();
        // 목업 v2: 탭은 번호 + 이름 + 조건 요약 + 배지만 가진다 — 썸네일은 없다.
        expect(findByTestId(tab1!, "event-page-tab-thumb")).toBeNull();
        expect(findByTestId(tab2!, "event-page-tab-thumb")).toBeNull();
        expect(tab2!.querySelector(".event-page-tab-thumb")).toBeNull();
      });

      it("renders condition badges capped at three plus an overflow counter", () => {
        const pages = [eventPage("page-1"), eventPage("page-2", { conditions: richConditions() })];
        const strip = renderStrip(pages);

        const tab1 = findByTestId(strip, "evt-page-segment-1");
        const tab2 = findByTestId(strip, "evt-page-segment-2");
        expect(tab1).not.toBeNull();
        expect(tab2).not.toBeNull();
        expect(findByTestId(tab1!, "event-page-tab-badges")).toBeNull();
        expect(findByTestId(tab2!, "event-page-tab-badges")).toBeNull();
      });

      it("summarizes conditions with database names in the tab tooltip", () => {
        const pages = [
          eventPage("page-1"),
          eventPage("page-2", { name: "의뢰 수락 후", conditions: richConditions() }),
        ];
        const strip = renderStrip(pages);

        const title1 = findByTestId(strip, "evt-page-segment-1")!.getAttribute("title") ?? "";
        expect(title1).toContain("페이지 1 — EV001");
        expect(title1).toContain("조건 없음");

        const title2 = findByTestId(strip, "evt-page-segment-2")!.getAttribute("title") ?? "";
        expect(title2).toContain("페이지 2 — 의뢰 수락 후");
        expect(title2).toContain("별등 의뢰 수락 · 켜짐");
        expect(title2).toContain("별등 진행도 3 이상");
        expect(title2).toContain("아이템 missing-item 보유 중");
        expect(title2).toContain("주인공 [missing-actor] 파티에 있음");
        expect(title2).toContain("타이머 1 30초 이하");
      });

      it("keeps the numeric label, testid, active class, and click selection behavior", () => {
        const pages = [eventPage("page-1"), eventPage("page-2", { conditions: richConditions() })];
        const strip = renderStrip(pages, pages[1]!);

        expect(strip.dataset.testid).toBe("evt-header-page-tabs");
        const tab1 = findByTestId(strip, "evt-page-segment-1")!;
        const tab2 = findByTestId(strip, "evt-page-segment-2")!;
        expect(tab1.tagName).toBe("BUTTON");
        expect(tab2.tagName).toBe("BUTTON");

        expect(tab1.querySelector(".evt-page-segment-number")?.textContent).toBe("1");
        expect(tab2.querySelector(".evt-page-segment-number")?.textContent).toBe("2");
        expect(tab1.textContent).toContain("1");
        expect(tab2.textContent).toContain("2");

        expect(tab1.className).not.toContain("active");
        expect(tab2.className).toContain("active");

        tab1.click();
        expect(editorState.get().selectedEventPageId).toBe("page-1");
        tab2.click();
        expect(editorState.get().selectedEventPageId).toBe("page-2");
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

// [P2] 라이브 미리보기/플로우 파생 뷰 + 크로스 컨테이너 이동.
describe("eventScriptModernViews", () => {
  isolateTimers();
  const PAGE_BASE: Omit<EventPage, "commands"> = {
    id: "pg_test",
    name: "테스트",
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
  };
  function pageWith(commands: Command[]): EventPage {
    return { ...PAGE_BASE, commands };
  }
  describe("이벤트 스크립트 모던 뷰 (P2)", () => {
    let restoreDom: (() => void) | undefined;

    beforeEach(() => {
      restoreDom = installFakeDom();
      store.replace(createBlankProject());
    });

    afterEach(() => {
      restoreDom?.();
    });

    it("flattenScript 는 분기 라벨과 시뮬레이션 상태를 스크립트 순서로 기록한다", () => {
      const commands: Command[] = [
        { kind: "changeFace", resourceId: "easyrpg-faceset-actor1-03", position: "left", flipHorizontally: false },
        { kind: "text", body: "안녕" },
        {
          kind: "fork",
          condition: { kind: "switch", switchId: "", value: true },
          then: [{ kind: "text", body: "참" }],
          else: [{ kind: "text", body: "거짓" }],
        },
      ];
      const steps = flattenScript(commands);
      expect(steps.map((step) => step.command.kind)).toEqual(["changeFace", "text", "fork", "text", "text"]);
      expect(steps[0]?.simState).toBeDefined();
      expect(steps[1]?.simState).toBeDefined();
      expect(steps[2]?.simState).toBeDefined();
      expect(steps[3]?.branchLabel).toBe("조건이 맞을 때");
      expect(steps[4]?.branchLabel).toBe("조건이 맞지 않을 때");
      const forkStep = steps.find((s) => s.command.kind === "fork");
      expect(forkStep?.forkTaken).toBeDefined();
    });

    it("미리보기 패널은 details 접힘 없이 무대와 스텝 조작을 바로 내건다", () => {
      const page = pageWith([{ kind: "text", body: "한 줄" }]);
      const root = renderWithFakeDom(() =>
        renderEventPagePreview({ mapId: "map_start", eventId: "ev_test", page })
      );
      const panel = findByTestId(root, "event-page-preview");
      expect(panel).not.toBeNull();
      expect((panel as unknown as { tagName?: string }).tagName?.toLowerCase()).not.toBe("details");
      expect(findByTestId(root, "event-script-live-stage")).not.toBeNull();
      expect(findByTestId(root, "event-script-live-prev")).not.toBeNull();
      expect(findByTestId(root, "event-script-live-next")).not.toBeNull();
      expect(findByTestId(root, "event-script-live-play")).not.toBeNull();
    });

    it("명령이 없으면 미리보기는 빈 안내를 내건다", () => {
      const root = renderWithFakeDom(() =>
        renderEventPagePreview({ mapId: "map_start", eventId: "ev_test", page: pageWith([]) })
      );
      expect(findByTestId(root, "event-page-preview-empty")).not.toBeNull();
      expect(findByTestId(root, "event-script-live-stage")).toBeNull();
    });

    it("플로우는 팝오버 details 가 아니라 칼럼 전체를 쓰는 보기 방식으로 렌더된다", () => {
      const page = pageWith([{ kind: "text", body: "한 줄" }]);
      const root = renderWithFakeDom(() =>
        renderEventPageFlow({ mapId: "map_start", eventId: "ev_test", page })
      );
      // 예전 도구 팝오버 아코디언(`event-script-flowchart`)은 미리보기 위에 겹쳐 떴다 — 이제 없다.
      expect(findByTestId(root, "event-script-flowchart")).toBeNull();
      expect(findByTestId(root, "event-page-flow")).not.toBeNull();
      expect(findByTestId(root, "event-flow-node-text")).not.toBeNull();
    });

    it("플로우는 fork/choices 분기를 하위 컬럼으로 렌더한다", () => {
      const root = renderWithFakeDom(() =>
        renderEventPageFlow({
          mapId: "map_start",
          eventId: "ev_test",
          page: pageWith([
            {
              kind: "choices",
              options: [
                { text: "예", branch: [{ kind: "text", body: "긍정" }] },
                { text: "아니오", branch: [] },
              ],
            },
          ]),
        })
      );
      const flow = findByTestId(root, "event-flowchart-body");
      expect(flow).not.toBeNull();
      const labels = flow ? flow.querySelectorAll(".event-flow-branch-label").map((node) => node.textContent) : [];
      expect(labels).toContain("예");
      expect(labels).toContain("아니오");
      expect(flow?.querySelectorAll(".event-flow-empty").length).toBe(1);
    });
  });
  describe("크로스 컨테이너 명령 이동 (P2)", () => {
    it("isContainerInsideCommand 는 자기 분기 안 이동만 참이다", () => {
      expect(isContainerInsideCommand([2], [2, FORK_THEN_BRANCH_INDEX])).toBe(true);
      expect(isContainerInsideCommand([2], [1, FORK_THEN_BRANCH_INDEX])).toBe(false);
      expect(isContainerInsideCommand([2, FORK_THEN_BRANCH_INDEX, 0], [])).toBe(false);
      expect(isContainerInsideCommand([0], [0])).toBe(false);
    });

    it("moveCommandBetweenLists 는 루트 → fork then 분기 이동을 수행한다", () => {
      const commands: Command[] = [
        { kind: "text", body: "이동 대상" },
        {
          kind: "fork",
          condition: { kind: "switch", switchId: "", value: true },
          then: [{ kind: "text", body: "기존" }],
        },
      ];
      const targetList = resolveCommandListAtPath(commands, [1, FORK_THEN_BRANCH_INDEX], { missingBranches: "create" });
      expect(targetList).not.toBeNull();
      if (!targetList) return;
      expect(moveCommandBetweenLists(commands, 0, targetList, Number.MAX_SAFE_INTEGER)).toBe(true);
      expect(commands.length).toBe(1);
      expect(commands[0]?.kind).toBe("fork");
      const fork = commands[0];
      if (fork?.kind !== "fork") return;
      expect(fork.then.map((cmd) => (cmd.kind === "text" ? cmd.body : ""))).toEqual(["기존", "이동 대상"]);
    });

    it("같은 리스트 이동은 기존 재정렬 규칙(클램프)을 따른다", () => {
      const list: Command[] = [
        { kind: "text", body: "A" },
        { kind: "text", body: "B" },
        { kind: "text", body: "C" },
      ];
      expect(moveCommandBetweenLists(list, 0, list, 99)).toBe(true);
      expect(list.map((cmd) => (cmd.kind === "text" ? cmd.body : ""))).toEqual(["B", "C", "A"]);
    });
  });
});

describe("eventSpawnNumericProbe", () => {
  isolateTimers();
  let restore: () => void;
  beforeEach(() => { restore = installFakeDom(); store.replace(createCaptureProject()); });
  afterEach(() => restore());
  describe("spawn numeric controls through the gate DOM", () => {
    it.each(["x", "y", "w", "h"] as const)("rejects invalid %s edits and accumulates valid commits", key => {
      const initial = MINIMAL_COMMANDS.spawnFieldEnemy;
      if (initial.kind !== "spawnFieldEnemy") throw new Error("Wrong fixture");
      let current: Command = structuredClone(initial);
      const replaceCommand = vi.fn((_path: readonly number[], command: Command) => { current = command; });
      const unexpected = () => { throw new Error("Unexpected action"); };
      const root = fieldSpawnBody({ path: [0], getCurrentCommand: () => current, actions: {
        replaceCommand, addCommand: unexpected, insertCommand: unexpected, deleteCommand: unexpected,
        moveCommand: unexpected, moveCommandTo: unexpected,
      } }, initial);
      if (!(root instanceof FakeElement)) throw new Error("Expected gate DOM");
      const input = findByTestId(root, `event-command-spawn-area-${key}`);
      if (!input) throw new Error("Missing numeric control");
      const invalid = vi.fn();
      input.addEventListener("invalid", invalid);
      for (const raw of ["", "NaN", "Infinity", "1e309", "0x10", "2.5"]) {
        input.value = raw;
        input.dispatchEvent(new Event("change"));
        expect(current).toEqual(initial);
        expect(replaceCommand).not.toHaveBeenCalled();
      }
      expect(invalid).toHaveBeenCalledTimes(6);
      for (const value of [3, 4]) {
        input.value = String(value);
        input.dispatchEvent(new Event("change"));
        expect(current).toEqual({ ...initial, spawn: { ...initial.spawn, area: { ...initial.spawn.area, [key]: value } } });
      }
      expect(replaceCommand).toHaveBeenCalledTimes(2);
    });

    it("existing native numeric consumers retain their number instead of the missing-API fallback", () => {
      const initial = MINIMAL_COMMANDS.changeFactionStance;
      if (initial.kind !== "changeFactionStance") throw new Error("Wrong fixture");
      const run = probeCommandControls(initial);
      expect(run.results).toHaveLength(4);
      for (const result of run.results) {
        expect(result.outcome).toBe("commit");
        expect(result.committed).toMatchObject({ value: result.key === "event-command-faction-value" ? Number(result.applied) : initial.value });
      }
    });

    it("the actual commit probe commits all seven fields without exceptions or no-commit exemptions", () => {
      const run = probeCommandControls(MINIMAL_COMMANDS.spawnFieldEnemy);
      expect(run.error).toBeUndefined();
      expect(run.results).toHaveLength(7);
      expect(run.results.map(result => result.outcome)).toEqual(Array(7).fill("commit"));
      for (const result of run.results) {
        expect(result.errorMessage).toBeUndefined();
        expect(result.callCount).toBe(1);
      }
    });
  });
});
