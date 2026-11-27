import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { createSharedTilesetBlankProject as createBlankProject } from "./support/sharedBlankProject";
import { store } from "@/project/store";
import { renderCommandPreview } from "@/editor/panels/eventEditor/commandPreview";
import { eventCommandPickerTabEntries, eventCommandPickerSearchEntries } from "@/editor/panels/eventEditor/commandPicker";
import { M2_PICKER_APPEARANCE_GROUP, M2_PICKER_BATTLE_GROUP, M2_PICKER_GROWTH_GROUP, M2_PICKER_PARTY_GROUP, M2_MAP_SCREEN_SURFACE_GROUPS, M2_QUICK_AUTHORING_SURFACE_GROUPS } from "@/project/eventCommands/m2PickerLayout";
import { findByTestId, installFakeDom, renderWithFakeDom, FakeElement } from "./fakeDom";
import type { Command } from "@/project/types";
import { renderM2CommandBody } from "@/editor/panels/eventEditor/commandBodyM2";
import { commandSummaryParts, commandSummary, isSummaryVisualPart } from "@/editor/panels/eventEditor/commandSummary";
import type { CommandEditContext, CommandListActions } from "@/editor/panels/eventEditor/types";
import { renderCommandList } from "@/editor/panels/eventEditor/commandList";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import { newCommand, newM2Command } from "@/editor/eventActions";
import { renderStoryboard } from "@/editor/panels/eventEditor/storyboardView";
import { isolateTimers } from "./mergedTeardown";

describe("actorBattleAuthoringSurface", () => {
  isolateTimers();
  /**
   * 탭 2 「동료 · 전투」는 카탈로그 탭이 아니라 저작 작업면이다.
   * 계약: `.omo/plans/event-editor-actor-battle-adversarial-review.md`
   */
  describe("picker tab 2 information architecture", () => {
    it("puts zero informational (unselectable) rows on the tab-2 grid", () => {
      const informational = eventCommandPickerTabEntries(2)
        .filter((entry) => !entry.selectable)
        .map((entry) => entry.commandId);

      expect(informational).toEqual([]);
      expect(eventCommandPickerTabEntries(2).length).toBeGreaterThan(0);
    });

    it("groups tab 2 by work surface, not by RM classification names", () => {
      const groups = [...new Set(eventCommandPickerTabEntries(2).map((entry) => entry.group))];

      expect(groups).not.toContain("배우/전투");
      expect(groups).not.toContain("전투 전용");
      expect(groups).not.toContain("시스템/고급");
      for (const group of groups) {
        expect([
          M2_PICKER_BATTLE_GROUP,
          M2_PICKER_PARTY_GROUP,
          M2_PICKER_GROWTH_GROUP,
          M2_PICKER_APPEARANCE_GROUP,
        ]).toContain(group);
      }
      expect(groups).toContain(M2_PICKER_BATTLE_GROUP);
      expect(groups).toContain(M2_PICKER_PARTY_GROUP);
    });
  });
});

describe("changeParametersCommandBody", () => {
  isolateTimers();
  function ctx(replaceCommand = vi.fn()): CommandEditContext {
    return {
      path: [1],
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
  function changeParams(fields: Record<string, string | number> = {}): Extract<Command, { kind: "m2Command" }> {
    return {
      kind: "m2Command",
      commandId: "m2-014-change-parameters",
      fields: {
        target: "",
        parameter: "maxHp",
        operation: "add",
        value: 1,
        ...fields,
      },
    };
  }
  describe("change parameters command body UX", () => {
    let restoreDom: (() => void) | undefined;
    let actorId = "";

    beforeEach(() => {
      restoreDom = installFakeDom();
      const project = createBlankProject();
      actorId = project.database.actors[0]?.id ?? "";
      if (!actorId) throw new Error("missing actor");
      store.replace(project);
    });

    afterEach(() => {
      restoreDom?.();
    });

    it("renders rich target/param/op UI instead of raw text fields", () => {
      const body = renderWithFakeDom(() => renderM2CommandBody(ctx(), changeParams({ target: actorId, parameter: "attack", value: 5 }))!);
      expect(findByTestId(body, "change-parameters-command-body")).not.toBeNull();
      expect(findByTestId(body, "change-parameters-intent")).not.toBeNull();
      expect(findByTestId(body, "change-parameters-param-chips")).not.toBeNull();
      expect(findByTestId(body, "change-parameters-presets")).toBeNull();
      expect(findByTestId(body, "change-parameters-preview")).not.toBeNull();
      expect(body.textContent).toContain("영구 보정");
      expect(body.textContent).not.toContain("프리셋");
      expect(findByTestId(body, "change-parameters-param-attack")?.className).toContain("is-active");
    });

    it("writes mind parameter through chips", () => {
      const replaceCommand = vi.fn();
      const body = renderWithFakeDom(() => renderM2CommandBody(ctx(replaceCommand), changeParams({ target: actorId }))!);
      (findByTestId(body, "change-parameters-param-mind") as FakeElement | null)?.dispatchEvent(new Event("click"));
      expect(replaceCommand).toHaveBeenCalled();
      const next = replaceCommand.mock.calls.at(-1)?.[1] as Extract<Command, { kind: "m2Command" }>;
      expect(next.fields.parameter).toBe("mind");
    });

    it("summarizes change parameters in Korean labels", () => {
      const parts = commandSummaryParts(
        changeParams({ target: actorId, parameter: "defense", operation: "add", value: 7 })
      );
      const text = parts.map((part) => part.text).join("");
      expect(text).toContain("능력치 변경");
      expect(text).toContain("방어");
      expect(text).toContain("＋7");
    });

    it("preview caption uses the concrete Korean command title, not internal M2 jargon", () => {
      const preview = renderWithFakeDom(() =>
        renderCommandPreview(changeParams({ target: actorId, parameter: "maxHp", value: 1 }))
      );
      expect(preview.textContent).toContain("능력치 변경");
      expect(preview.textContent).not.toMatch(/M2|현대 명령/);
    });
  });
});

// [P1] 커맨드 리스트 인라인 썸네일 + 문장 폼 제어 문자 팔레트 + 얼굴 반영 프리뷰.
describe("commandListInlineThumbs", () => {
  isolateTimers();
  const noopActions: CommandListActions = {
    addCommand: () => {},
    insertCommand: () => {},
    replaceCommand: () => {},
    deleteCommand: () => {},
    moveCommand: () => {},
    moveCommandTo: () => {},
  };
  const FACE_RESOURCE = "easyrpg-faceset-actor1-00";
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
      const cmd: Command = { kind: "changeFace", resourceId: FACE_RESOURCE, position: "left", flipHorizontally: false };
      const parts = commandSummaryParts(cmd);
      const visuals = parts.filter(isSummaryVisualPart);
      expect(visuals.length).toBe(1);
      expect(visuals[0]?.visual).toMatchObject({ type: "faceCrop", resourceId: FACE_RESOURCE });
      expect(commandSummary(cmd)).toContain("얼굴 바꾸기");
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
        { kind: "changeFace", resourceId: FACE_RESOURCE, position: "left", flipHorizontally: false },
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
        renderCommandPreview({ kind: "text", body: "안녕" }, { face: { resourceId: FACE_RESOURCE } })
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
});

describe("innCommandBody", () => {
  isolateTimers();
  describe("inn command body", () => {
    let restoreDom: (() => void) | undefined;

    beforeEach(() => {
      restoreDom = installFakeDom();
    });

    afterEach(() => {
      restoreDom?.();
    });

    it("shows price mode, presets, options, timing units, and result branches without duplicating preview", () => {
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
          { kind: "inn", price: 20 } satisfies Command
        )
      );

      expect(findByTestId(body, "inn-command-body")).not.toBeNull();
      expect(findByTestId(body, "inn-price-source")).not.toBeNull();
      expect(findByTestId(body, "inn-price-input")).not.toBeNull();
      expect(findByTestId(body, "inn-price-presets")).not.toBeNull();
      expect(findByTestId(body, "inn-price-preset-20")).not.toBeNull();
      expect(findByTestId(body, "inn-dialog-mock")).toBeNull();
      expect(findByTestId(body, "inn-note-input")).not.toBeNull();
      expect(findByTestId(body, "inn-question-input")).not.toBeNull();
      expect(findByTestId(body, "inn-recover-mp")).not.toBeNull();
      expect(findByTestId(body, "inn-advance-morning")).not.toBeNull();
      expect(findByTestId(body, "inn-branch-on-stay")).not.toBeNull();
      expect(findByTestId(body, "inn-branch-on-cancel")).not.toBeNull();
      expect(findByTestId(body, "inn-branch-not-enough")).not.toBeNull();
      expect(body.textContent ?? "").toContain("숙박했을 때 분기");
      expect(body.textContent ?? "").toContain("거절했을 때 분기");
      expect(body.textContent ?? "").toContain("암전 연출 (ms)");
      expect(body.textContent ?? "").toContain("기상 표시 (ms)");
    });

    it("preserves spaces while typing note/question and commits stay/cancel/not-enough branch flags", () => {
      const replaceCommand = vi.fn();
      const body = renderWithFakeDom(() =>
        renderCommandBody(
          {
            path: [0],
            actions: {
              addCommand: () => undefined,
              deleteCommand: () => undefined,
              insertCommand: () => undefined,
              moveCommand: () => undefined,
              moveCommandTo: () => undefined,
              replaceCommand,
            },
          },
          { kind: "inn", price: 20 } satisfies Command
        )
      );

      const note = findByTestId(body, "inn-note-input") as HTMLInputElement;
      note.value = "환영합니다, ";
      note.dispatchEvent(new Event("input"));
      // 입력 도중 끝 공백을 강제로 잘라내지 않아야 띄어쓰기·IME 조합이 깨지지 않는다.
      expect(note.value).toBe("환영합니다, ");
      note.value = "환영합니다, 여행자여.";
      note.dispatchEvent(new Event("change"));

      const question = findByTestId(body, "inn-question-input") as HTMLInputElement;
      question.value = "오늘 밤 묵으시겠습니까?";
      question.dispatchEvent(new Event("change"));

      const recoverMp = findByTestId(body, "inn-recover-mp") as HTMLInputElement;
      recoverMp.checked = false;
      recoverMp.dispatchEvent(new Event("change"));

      const morning = findByTestId(body, "inn-advance-morning") as HTMLInputElement;
      morning.checked = true;
      morning.dispatchEvent(new Event("change"));

      const rest = findByTestId(body, "inn-rest-duration-input") as HTMLInputElement;
      rest.value = "250";
      rest.dispatchEvent(new Event("change"));

      const stayBranch = findByTestId(body, "inn-branch-on-stay") as HTMLInputElement;
      stayBranch.checked = true;
      stayBranch.dispatchEvent(new Event("change"));

      const cancelBranch = findByTestId(body, "inn-branch-on-cancel") as HTMLInputElement;
      cancelBranch.checked = true;
      cancelBranch.dispatchEvent(new Event("change"));

      const branch = findByTestId(body, "inn-branch-not-enough") as HTMLInputElement;
      branch.checked = true;
      branch.dispatchEvent(new Event("change"));

      const last = replaceCommand.mock.calls.at(-1)?.[1] as Extract<Command, { kind: "inn" }>;
      expect(last).toMatchObject({
        kind: "inn",
        price: 20,
        note: "환영합니다, 여행자여.",
        question: "오늘 밤 묵으시겠습니까?",
        recoverMp: false,
        advanceToMorning: true,
        restDurationMs: 250,
        branchOnStay: true,
        branchOnCancel: true,
        branchOnNotEnoughGold: true,
      });
      const summary = findByTestId(body, "inn-branch-summary");
      expect(summary?.hidden).toBe(false);
      expect(summary?.textContent).toContain("숙박했을 때");
      expect(summary?.textContent).toContain("거절했을 때");
      expect(summary?.textContent).toContain("골드 부족할 때");
    });

    it("previews custom copy, variable price, and result branches accurately", () => {
      const preview = renderWithFakeDom(() =>
        renderCommandPreview({
          kind: "inn",
          price: 50,
          note: "편히 쉬세요",
          question: "50G에 묵을까요?",
          recoverMp: false,
          advanceToMorning: true,
          branchOnStay: true,
          branchOnCancel: true,
          branchOnNotEnoughGold: true,
        })
      );
      expect(findByTestId(preview, "ecp-inn-window")).not.toBeNull();
      expect(preview.textContent ?? "").toContain("편히 쉬세요");
      expect(preview.textContent ?? "").toContain("50G에 묵을까요?");
      expect(preview.textContent ?? "").toContain("HP만 회복");
      expect(preview.textContent ?? "").toContain("아침 이동");
      expect(preview.textContent ?? "").toContain("숙박 분기");
      expect(preview.textContent ?? "").toContain("거절 분기");
      expect(preview.textContent ?? "").toContain("부족 분기");

      const varPreview = renderWithFakeDom(() =>
        renderCommandPreview({
          kind: "inn",
          price: { kind: "var", id: "var_fee" },
        })
      );
      expect(varPreview.textContent ?? "").not.toContain("(무료)");
      expect(varPreview.textContent ?? "").toContain("var_fee");
    });

    it("summarizes free inns and optional flags", () => {
      const free = commandSummaryParts({ kind: "inn", price: 0 }).map((part) => part.text).join("");
      expect(free).toContain("무료");

      const rich = commandSummaryParts({
        kind: "inn",
        price: 20,
        recoverMp: false,
        advanceToMorning: true,
        branchOnStay: true,
        branchOnCancel: true,
        branchOnNotEnoughGold: true,
      })
        .map((part) => part.text)
        .join("");
      expect(rich).toContain("HP만");
      expect(rich).toContain("아침");
      expect(rich).toContain("숙박분기");
      expect(rich).toContain("거절분기");
      expect(rich).toContain("부족분기");
    });
  });
});

describe("mapScreenAuthoringSurface", () => {
  isolateTimers();
  /**
   * 탭 3 「지도 · 화면 효과」는 RM2003 Event Command 4페이지가 아니라 연출 작업면이다.
   * 계약: `.omo/plans/event-editor-map-screen-effects-adversarial-review.md`
   *
   * - 조명 · 날씨 · 그림 · 화면 효과를 탭 3에서 찾는다(탭 4로 숨지 않는다).
   * - 화면 효과 / 카메라 미리보기는 토큰 요약 카드가 아니라 필드에 반응하는 그림이다.
   * - 지형 변경은 칩셋 크롭을 보여 준다. 번호 입력만으로는 무슨 그림인지 알 수 없다.
   * - 같은 일을 하는 레거시 RM 행(`m2-050`·`054`·`066`)은 네이티브로 통합돼 피커에 없다(2026-11-26).
   */
  describe("picker tab 3 information architecture", () => {
    it("puts zero informational (unselectable) rows on the tab-3 grid", () => {
      const entries = eventCommandPickerTabEntries(3);

      expect(entries.filter((entry) => !entry.selectable)).toEqual([]);
      expect(entries.length).toBeGreaterThan(0);
    });

    it("groups tab 3 by work surface, not by RM classification names", () => {
      const groups = [...new Set(eventCommandPickerTabEntries(3).map((entry) => entry.group))];

      expect(groups).not.toContain("맵/이동");
      expect(groups).not.toContain("화면/연출");
      expect(groups).not.toContain("시스템/고급");
      expect(groups).not.toContain("소리");
      for (const group of groups) expect(M2_MAP_SCREEN_SURFACE_GROUPS).toContain(group);
      expect(groups).toContain("지도");
      expect(groups).toContain("조명·날씨");
      expect(groups).toContain("그림");
      expect(groups).toContain("화면 연출");
    });

    it("keeps lighting, weather, pictures, screen effects and camera on tab 3", () => {
      const tabThree = eventCommandPickerTabEntries(3);
      const ids = tabThree.map((entry) => entry.commandId);

      expect(ids).toContain("setLighting");
      expect(ids).toContain("setWeather");
      expect(ids).toContain("m2-051-show-picture");
      expect(ids).toContain("m2-053-erase-picture");
      expect(ids).toContain("m2-202-screen-effect");
      expect(ids).toContain("m2-201-camera-control");
      expect(ids).toContain("m2-071-change-tile");

      // 조명·날씨는 한 헤딩 아래 모인다 — 작가가 분위기를 만들 때 두 곳을 뒤지지 않게.
      const lightingGroup = tabThree.find((entry) => entry.commandId === "setLighting")?.group;
      expect(tabThree.find((entry) => entry.commandId === "setWeather")?.group).toBe(lightingGroup);
      // 애니메이션 표시는 소리가 아니라 화면 연출이다.
      expect(tabThree.find((entry) => entry.commandId === "showAnimation")?.group).toBe("화면 연출");
    });

    it("shows only the native 날씨·애니메이션·동영상 rows (legacy m2 twins are merged)", () => {
      const tabThree = eventCommandPickerTabEntries(3).map((entry) => entry.commandId);
      const search = eventCommandPickerSearchEntries().map((entry) => entry.commandId);

      for (const native of ["setWeather", "showAnimation", "playMovie"]) expect(tabThree).toContain(native);
      for (const legacy of ["m2-050-set-weather-effects", "m2-054-show-animation", "m2-066-play-movie"]) {
        expect(tabThree).not.toContain(legacy);
        expect(search).not.toContain(legacy);
      }
      expect(search.filter((id) => id === "setWeather")).toHaveLength(1);
    });
  });
  describe("map and screen previews react to fields", () => {
    function withProject<T>(run: () => T): T {
      const restore = installFakeDom();
      try {
        store.replace(createBlankProject());
        return run();
      } finally {
        restore();
      }
    }

    function preview(cmd: Command): FakeElement {
      return renderWithFakeDom(() => renderCommandPreview(cmd));
    }

    function m2(commandId: string, fields: Record<string, string | number | boolean>): Command {
      const command = newM2Command(commandId);
      if (command.kind !== "m2Command") throw new Error(`expected m2Command: ${commandId}`);
      return { ...command, fields: { ...command.fields, ...fields } };
    }

    it("stages Screen Effect on the shared play stage instead of a token summary card", () => {
      withProject(() => {
        const root = preview(m2("m2-202-screen-effect", { effect: "tint", value: "#ff0000", durationMs: 600 }));

        const stage = findByTestId(root, "ecp-screen-effect-stage");
        expect(stage).toBeTruthy();
        expect(findByTestId(root, "ecp-screen-effect-scene")).toBeTruthy();
        expect(findByTestId(root, "ecp-screen-effect-overlay")).toBeTruthy();
        expect(root.querySelectorAll(".ecp-summary-card")).toHaveLength(0);
        expect(findByTestId(root, "ecp-runtime-effect")).toBeNull();
      });
    });

    it("moves legacy RM screen rows onto the same stage as the modern one", () => {
      withProject(() => {
        // 색조·플래시·숨기기·표시·날씨 효과 — 전부 토큰 카드가 아니다.
        for (const [commandId, fields, effect] of [
          ["m2-046-tint-screen", { color: "red", value: "", duration: 30 }, "tint"],
          ["m2-047-flash-screen", { color: "white", durationMs: 300 }, "flash"],
          ["m2-044-hide-screen", {}, "fadeOut"],
          ["m2-045-show-screen", {}, "fadeIn"],
          ["m2-050-set-weather-effects", { value: "rain", intensity: 0.8, transitionMs: 400 }, "weather"],
        ] as const) {
          const root = preview(m2(commandId, fields));
          const stage = findByTestId(root, "ecp-screen-effect-stage");
          expect(stage, commandId).toBeTruthy();
          expect(stage?.dataset.effect, commandId).toBe(effect);
          expect(findByTestId(root, "ecp-screen-effect-overlay"), commandId).toBeTruthy();
          expect(root.querySelectorAll(".ecp-summary-card"), commandId).toHaveLength(0);
        }
      });
    });

    it("reads the legacy tint colour instead of guessing one", () => {
      withProject(() => {
        const red = findByTestId(preview(m2("m2-046-tint-screen", { color: "red", value: "" })), "ecp-screen-effect-overlay");
        const blue = findByTestId(preview(m2("m2-046-tint-screen", { color: "blue", value: "" })), "ecp-screen-effect-overlay");

        expect(red?.style.background).toContain("255,0,0");
        expect(blue?.style.background).toContain("0,0,255");
      });
    });

    it("draws the camera viewport moving to its target", () => {
      withProject(() => {
        const root = preview(m2("m2-201-camera-control", { mode: "panTo", target: "screen", x: 6, y: 3, zoom: 2, durationMs: 500 }));

        const stage = findByTestId(root, "ecp-camera-stage");
        expect(stage?.dataset.mode).toBe("pan");
        expect(stage?.dataset.zoom).toBe("2");
        expect(stage?.dataset.target).toBe("(6, 3)");
        expect(findByTestId(root, "ecp-camera-canvas-1")?.tagName).toBe("CANVAS");
        expect(findByTestId(root, "ecp-camera-frame-0")?.dataset.zoom).toBe("1");
        expect(findByTestId(root, "ecp-camera-frame-2")?.dataset.zoom).toBe("2");
        expect(root.querySelectorAll(".ecp-summary-card")).toHaveLength(0);
        expect(findByTestId(root, "ecp-camera-caption")?.textContent).toContain("500ms");
      });
    });

    it("shows a chipset crop and a neighbour palette for 지형 변경", () => {
      withProject(() => {
        const project = store.getCurrent();
        const command = newCommand("changeTile");
        expect(command.kind).toBe("changeTile");
        if (command.kind !== "changeTile") return;
        const root = preview({ ...command, mapId: project.startMapId, x: 3, y: 4, tile: 12, layer: "upper" });

        const stage = findByTestId(root, "ecp-tile-chipsel");
        expect(stage?.dataset.tile).toBe("12");
        expect(stage?.dataset.tileset).toBeTruthy();
        const chip = findByTestId(root, "ecp-tile-chip-selected");
        // 칩셋 이미지를 직접 크롭해 보여 준다 — 색 상자나 숫자 스와치가 아니다.
        expect(chip?.style.backgroundImage ?? "").toContain("url(");
        expect(chip?.style.backgroundPosition ?? "").toMatch(/^-\d+(\.\d+)?px -\d+(\.\d+)?px$/);
        expect(findByTestId(root, "ecp-tile-chip-strip")?.childNodes.length).toBeGreaterThanOrEqual(4);
        expect(findByTestId(root, "ecp-tile-chipsel-title")?.textContent).toContain("그림 12");
        expect(root.textContent).toContain("상위");
        // 번호 스와치 폴백이 아니다.
        expect(root.querySelectorAll(".ecp-tile-swatch")).toHaveLength(0);
        expect(root.querySelectorAll(".ecp-summary-card")).toHaveLength(0);
      });
    });

    it("marks a negative tile as clearing the cell", () => {
      withProject(() => {
        const project = store.getCurrent();
        const root = preview({ kind: "changeTile", mapId: project.startMapId, layer: "lower", x: 1, y: 1, tile: -1 });

        expect(findByTestId(root, "ecp-tile-chip-selected")?.dataset.tile).toBe("-1");
        expect(findByTestId(root, "ecp-tile-chipsel-title")?.textContent).toContain("비웁니다");
      });
    });
  });
});

describe("quickAuthoringSurface", () => {
  isolateTimers();
  /**
   * 탭 1 「빠른 저작」은 28행 RM 카탈로그 페이지가 아니라 이야기 작업면이다.
   * 계약: `.omo/plans/event-editor-quick-authoring-adversarial-review.md`
   *
   * - 미리보기는 식별 가능하다: 문장·얼굴·맵·경로·상품이 보인다.
   * - 고를 수 없는 안내 행은 탭 1 그리드에 0개다.
   * - 전수 삽입(`entries.length === 28`)은 성공 조건이 아니다.
   */
  describe("picker tab 1 information architecture", () => {
    it("puts zero informational (unselectable) rows on the tab-1 grid", () => {
      const entries = eventCommandPickerTabEntries(1);

      expect(entries.filter((entry) => !entry.selectable).map((entry) => entry.commandId)).toEqual([]);
      expect(entries.length).toBeGreaterThan(0);
    });

    it("groups tab 1 by work surface, not by RM classification names", () => {
      const groups = [...new Set(eventCommandPickerTabEntries(1).map((entry) => entry.group))];

      expect(groups).not.toContain("대화/입력");
      expect(groups).not.toContain("조건/흐름");
      expect(groups).not.toContain("보상/상점");
      expect(groups).not.toContain("아이템/경제");
      expect(groups).not.toContain("상점/시설");
      for (const group of groups) expect(M2_QUICK_AUTHORING_SURFACE_GROUPS).toContain(group);
      expect(groups).toContain("말하기");
      expect(groups).toContain("옮기기");
      expect(groups).toContain("거래");
    });

    it("keeps comments off the tab-1 grid instead of treating them as first-class story cards", () => {
      const tabOne = eventCommandPickerTabEntries(1).map((entry) => entry.commandId);

      expect(tabOne).not.toContain("m2-088-comment");
      // 데이터는 남는다 — 다른 탭에서 여전히 고를 수 있다(카탈로그 삭제가 목표가 아니다).
      const elsewhere = [2, 3, 4].flatMap((page) =>
        eventCommandPickerTabEntries(page as 2 | 3 | 4).map((entry) => entry.commandId)
      );
      expect(elsewhere).toContain("m2-088-comment");
    });
  });
  describe("quick authoring previews are identifiable", () => {
    function withProject<T>(run: () => T): T {
      const restore = installFakeDom();
      try {
        store.replace(createBlankProject());
        return run();
      } finally {
        restore();
      }
    }

    function preview(cmd: Command): FakeElement {
      return renderWithFakeDom(() => renderCommandPreview(cmd));
    }

    it("speaks with sample dialogue (without a borrowed face) when the body is still empty", () => {
      withProject(() => {
        const root = preview({ kind: "text", speaker: "", body: "" });

        const window = findByTestId(root, "ecp-message-window");
        const body = findByTestId(root, "ecp-message-body");
        expect(window?.dataset.sample).toBe("true");
        expect(body?.textContent.trim()).not.toBe("...");
        expect(body?.textContent.length ?? 0).toBeGreaterThan(3);
        expect(findByTestId(root, "ecp-message-sample-note")).toBeTruthy();
        // 얼굴은 빌려 오지 않는다 — 얼굴 없는 명령은 게임에서도 얼굴 없이 뜬다(commandPreview.ts, 공개 기준선 0d4f13e7c8).
        expect(root.querySelectorAll(".event-command-face-crop-shell")).toHaveLength(0);
        expect(root.querySelectorAll(".ecp-summary-card")).toHaveLength(0);
      });
    });

    it("keeps the authored sentence once the writer types one", () => {
      withProject(() => {
        const root = preview({ kind: "text", speaker: "촌장", body: "달빛 약초를 찾아 주게." });

        expect(findByTestId(root, "ecp-message-window")?.dataset.sample).toBeUndefined();
        expect(findByTestId(root, "ecp-message-body")?.textContent).toContain("달빛 약초");
        expect(findByTestId(root, "ecp-message-sample-note")).toBeNull();
      });
    });

    it("previews a face change as a faceset crop", () => {
      withProject(() => {
        const root = preview({
          kind: "changeFace",
          resourceId: "easyrpg-faceset-actor1-02",
          position: "left",
          flipHorizontally: false,
        });

        expect(root.querySelectorAll(".event-command-face-crop-shell").length).toBeGreaterThanOrEqual(1);
        expect(findByTestId(root, "ecp-face-caption")?.textContent).toContain("왼쪽 · 얼굴");
        // 낱장 얼굴 모델: 캡션에 칸 순번이 다시 들어가지 않는다.
        expect(findByTestId(root, "ecp-face-caption")?.textContent).not.toMatch(/얼굴\s*\d/);
        expect(root.querySelectorAll(".ecp-summary-card")).toHaveLength(0);
      });
    });

    it("draws windows and buttons for choices and number input", () => {
      withProject(() => {
        const choices = preview({
          kind: "choices",
          prompt: "도울까?",
          options: [{ text: "예", branch: [] }, { text: "아니오", branch: [] }],
        });
        expect(choices.querySelectorAll(".ecp-choice-window").length).toBe(1);
        expect(choices.querySelectorAll(".ecp-choice").length).toBe(2);

        const project = store.getCurrent();
        const variableId = project.variables[0]?.id ?? "";
        const number = preview({ kind: "inputNumber", variableId, digits: 4, prompt: "몇 개?" });
        // 변수 표시명이 자리수 미리보기를 삼키지 않는다 — 자리수와 변수 칩이 따로 있다.
        expect(findByTestId(number, "ecp-number-digit-count")?.textContent).toContain("4자리");
        expect(findByTestId(number, "ecp-number-variable")?.textContent).toContain("변수");
        expect(findByTestId(number, "ecp-number-slots")?.childNodes.length).toBe(4);
      });
    });

    it("shows the transfer target on a map, not a coordinate sentence alone", () => {
      withProject(() => {
        const project = store.getCurrent();
        const mapId = project.startMapId;
        const root = preview({ kind: "transfer", mapId, x: 4, y: 5, direction: "retain", fade: "black" });

        expect(findByTestId(root, "ecp-transfer-canvas")).toBeTruthy();
        const caption = root.querySelectorAll(".ecp-map-caption")[0];
        expect(caption?.textContent).toContain("(4, 5)");
        expect(root.querySelectorAll(".ecp-summary-card")).toHaveLength(0);
      });
    });

    it("starts a move route with one trajectory step instead of an empty stage", () => {
      withProject(() => {
        const command = newCommand("moveEvent");
        expect(command.kind).toBe("moveEvent");
        if (command.kind !== "moveEvent") return;
        expect(command.route.moves.length).toBeGreaterThanOrEqual(1);

        const root = preview(command);
        const tape = findByTestId(root, "ecp-move-tape");
        expect(tape?.textContent).not.toContain("이동 명령 없음");
        expect(root.querySelectorAll(".ecp-move-chip").length).toBeGreaterThanOrEqual(1);
        expect(findByTestId(root, "ecp-move-grid-box")?.textContent).toContain("궤적");
      });
    });

    it("opens a new shop with an empty listing instead of invented catalog ids", () => {
      withProject(() => {
        const command = newCommand("shop");
        expect(command.kind).toBe("shop");
        if (command.kind !== "shop") return;
        expect(command.itemIds).toEqual([]);

        const root = preview(command);
        expect(findByTestId(root, "ecp-shop-empty-warn")).not.toBeNull();
        expect(root.textContent).toContain("상품 없음");
      });
    });

    it("draws wait as a timeline that states the duration once", () => {
      withProject(() => {
        const root = preview({ kind: "wait", ms: 500 });

        expect(findByTestId(root, "ecp-wait-timeline")).toBeTruthy();
        expect(findByTestId(root, "ecp-wait-span")).toBeTruthy();
        expect(root.querySelectorAll(".ecp-wait-node").length).toBe(2);
        expect(root.querySelectorAll(".ecp-wait-card")).toHaveLength(0);
        const occurrences = (root.textContent.match(/0\.5초/g) ?? []).length;
        expect(occurrences).toBe(1);
      });
    });
  });
  describe("empty event entry", () => {
    it("offers 말하기 / 장소 옮기기 / 상점 열기 as the first move", () => {
      const restore = installFakeDom();
      try {
        store.replace(createBlankProject());
        const picked: string[] = [];
        const board = renderWithFakeDom(() =>
          renderStoryboard([], { onQuickStart: (kind) => picked.push(kind) })
        );

        const quick = findByTestId(board, "event-storyboard-quick-starts");
        expect(quick).toBeTruthy();
        expect(findByTestId(board, "event-storyboard-quick-text")?.textContent).toContain("말하기");
        expect(findByTestId(board, "event-storyboard-quick-transfer")?.textContent).toContain("장소 옮기기");
        expect(findByTestId(board, "event-storyboard-quick-shop")?.textContent).toContain("상점 열기");

        findByTestId(board, "event-storyboard-quick-shop")?.dispatchEvent(new Event("click"));
        expect(picked).toEqual(["shop"]);
      } finally {
        restore();
      }
    });
  });
});

describe("waitCommandBody", () => {
  isolateTimers();
  const noopActions = {
    addCommand: () => undefined,
    deleteCommand: () => undefined,
    insertCommand: () => undefined,
    moveCommand: () => undefined,
    moveCommandTo: () => undefined,
    replaceCommand: () => undefined,
  };
  describe("wait command body", () => {
    let restoreDom: (() => void) | undefined;

    beforeEach(() => {
      restoreDom = installFakeDom();
      store.replace(createBlankProject());
    });

    afterEach(() => {
      restoreDom?.();
    });

    it("renders time mode with seconds + presets (not a bare ms field)", () => {
      const body = renderWithFakeDom(() =>
        renderCommandBody(
          { path: [], actions: noopActions },
          { kind: "wait", ms: 500 } satisfies Command
        )
      );

      expect(findByTestId(body, "event-command-wait-body")).not.toBeNull();
      expect(findByTestId(body, "event-wait-mode-time")).not.toBeNull();
      expect(findByTestId(body, "event-wait-mode-variable")).not.toBeNull();
      expect(findByTestId(body, "event-wait-seconds")).not.toBeNull();
      expect(findByTestId(body, "event-wait-preset-1000")).not.toBeNull();
      expect(findByTestId(body, "event-wait-time-panel")?.hidden).toBe(false);
      expect(findByTestId(body, "event-wait-variable-panel")?.hidden).toBe(true);
    });

    it("shows variable panel when wait uses variableId", () => {
      const variableId = store.getCurrent().variables[0]?.id ?? "var_0001";
      const body = renderWithFakeDom(() =>
        renderCommandBody(
          { path: [], actions: noopActions },
          { kind: "wait", ms: 0, variableId } satisfies Command
        )
      );

      expect(findByTestId(body, "event-wait-variable-panel")?.hidden).toBe(false);
      expect(findByTestId(body, "event-wait-time-panel")?.hidden).toBe(true);
      const summary = commandSummaryParts({ kind: "wait", ms: 0, variableId }).map((part) => part.text).join("");
      expect(summary).toContain("변수");
    });

    it("previews fixed wait in seconds", () => {
      const preview = renderWithFakeDom(() => renderCommandPreview({ kind: "wait", ms: 1500 }));
      expect(findByTestId(preview, "ecp-wait-stage")).not.toBeNull();
      expect(preview.textContent ?? "").toContain("1.5초");
    });
  });
});
