import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import { renderM2CommandBody } from "@/editor/panels/eventEditor/commandBodyM2";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import type { CommandEditContext } from "@/editor/panels/eventEditor/types";
import { findByTestId, installFakeDom, renderWithFakeDom, FakeElement } from "./fakeDom";
import { m2CommandById } from "@/project/eventCommands/m2Catalog";
import { startSession } from "@/project/session";
import { executeM2RuntimeCommand } from "@/player/interpreter/m2Runtime";
import { isolateTimers } from "./mergedTeardown";

describe("eventEditorM2CommandBody", () => {
  isolateTimers();
  const MOVE_PICTURE_COMMAND = {
    kind: "m2Command",
    commandId: "m2-052-move-picture",
    fields: {
      pictureId: "pic_cloud",
      resourceId: "easyrpg-picture-cloud",
      x: 12,
      y: 34,
    },
  } satisfies Command;
  function contextWithReplaceSpy(replaceCommand: CommandEditContext["actions"]["replaceCommand"]): CommandEditContext {
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
  describe("event editor M2 command body", () => {
    let restoreDom: (() => void) | undefined;

    beforeEach(() => {
      restoreDom = installFakeDom();
      const project = createBlankProject();
      const firstActor = project.database.actors[0];
      const firstClass = project.database.classes[0];
      const firstAnimation = project.database.battleAnimations[0];
      if (firstActor) firstActor.name = "테스트 주인공";
      if (firstClass) firstClass.name = "테스트 직업";
      if (firstAnimation) firstAnimation.name = "테스트 애니메이션";
      store.replace(project);
    });

    afterEach(() => {
      restoreDom?.();
    });

    it("renders Move Picture as the canonical rich picture-slot movement form", () => {
      const context = contextWithReplaceSpy(vi.fn());

      const body = renderWithFakeDom(() => renderM2CommandBody(context, MOVE_PICTURE_COMMAND) ?? document.createElement("div"));

      expect(body.textContent).not.toMatch(/catalog-disabled|missing-runtime|runtime:/);
      expect(findByTestId(body, "move-picture-m2-command-body")).not.toBeNull();
      expect(findByTestId(body, "move-picture-m2-intent")?.textContent).toContain("그림 이동");
      expect(findByTestId(body, "move-picture-m2-preview")).not.toBeNull();
      expect(findByTestId(body, "move-picture-m2-resource-select")).toBeNull();
    });

    it("keeps Move Picture numeric fields editable through the normal command replace path", () => {
      const replaceCommand = vi.fn<CommandEditContext["actions"]["replaceCommand"]>();
      const context = contextWithReplaceSpy(replaceCommand);

      const body = renderWithFakeDom(() => renderM2CommandBody(context, MOVE_PICTURE_COMMAND) ?? document.createElement("div"));
      const pictureId = findByTestId(body, "move-picture-m2-id-input");
      const x = findByTestId(body, "move-picture-m2-x-input");
      const y = findByTestId(body, "move-picture-m2-y-input");
      expect(pictureId?.value).toBe("pic_cloud");
      expect(x?.value).toBe("12");
      expect(y?.value).toBe("34");
      if (!x) throw new Error("missing Move Picture X input");

      x.value = "48";
      x.dispatchEvent(new Event("change"));

      expect(replaceCommand).toHaveBeenCalledWith(
        [2],
        expect.objectContaining({
          kind: "m2Command",
          commandId: "m2-052-move-picture",
          fields: expect.objectContaining({ pictureId: "pic_cloud", x: 48, y: 34 }),
        })
      );
    });

    it("renders database-backed generic command ids as Korean record selectors instead of raw text inputs", () => {
      const replaceCommand = vi.fn<CommandEditContext["actions"]["replaceCommand"]>();
      const context = contextWithReplaceSpy(replaceCommand);

      const body = renderWithFakeDom(
        () =>
          renderM2CommandBody(context, {
            kind: "m2Command",
            commandId: "m2-091-change-actor-class",
            fields: { target: "actor_hero", operation: "set", value: "class_hero" },
          }) ?? document.createElement("div")
      );

      expect(Boolean(findByTestId(body, "m2-command-target-input"))).toBe(false);
      expect(Boolean(findByTestId(body, "m2-command-value-input"))).toBe(false);
      const actor = findByTestId(body, "change-actor-class-actor-select");
      const actorClass = findByTestId(body, "change-actor-class-class-select");
      expect(findByTestId(body, "change-actor-class-command-body")).not.toBeNull();
      expect(actor?.tagName).toBe("SELECT");
      expect(actor?.textContent).toContain("테스트 주인공");
      expect(actorClass?.tagName).toBe("SELECT");
      expect(actorClass?.textContent).toContain("테스트 직업");
    });

    it("renders generic animation ids as battle animation record selectors", () => {
      const context = contextWithReplaceSpy(vi.fn());

      const body = renderWithFakeDom(
        () =>
          renderM2CommandBody(context, {
            kind: "m2Command",
            commandId: "m2-054-show-animation",
            fields: { target: "this-event", animationId: "anim_sword" },
          }) ?? document.createElement("div")
      );

      expect(Boolean(findByTestId(body, "m2-command-animationId-input"))).toBe(false);
      const animation = findByTestId(body, "show-animation-m2-animation-select");
      expect(findByTestId(body, "show-animation-m2-command-body")).not.toBeNull();
      expect(animation?.tagName).toBe("SELECT");
      expect(animation?.textContent).toContain("테스트 애니메이션");
    });

    it("renders system graphic values as resource selectors with a preview", () => {
      const context = contextWithReplaceSpy(vi.fn());

      const body = renderWithFakeDom(
        () =>
          renderM2CommandBody(context, {
            kind: "m2Command",
            commandId: "m2-029-change-system-graphic",
            fields: { target: "window", operation: "set", value: "windowskin-warm" },
          }) ?? document.createElement("div")
      );

      expect(Boolean(findByTestId(body, "m2-command-value-input"))).toBe(false);
      const picker = findByTestId(body, "m2-command-value-resource-picker");
      const preview = findByTestId(body, "m2-command-value-resource-preview");
      expect(picker?.tagName).toBe("SELECT");
      expect(picker?.attrs["aria-label"]).toBe("메뉴 모습 선택");
      expect(picker?.textContent).toContain("windowskin-warm");
      expect(preview?.dataset.resourceId).toBe("windowskin-warm");
    });

    it("renders map/event location commands with friendly event, map, and coordinate controls", () => {
      const context = contextWithReplaceSpy(vi.fn());

      const body = renderWithFakeDom(
        () =>
          renderM2CommandBody(context, {
            kind: "m2Command",
            commandId: "m2-040-set-event-location",
            fields: { target: "event_starter_mina", mapId: "map_starter_village", x: 3, y: 4 },
          }) ?? document.createElement("div")
      );

      expect(body.textContent).not.toMatch(/catalog-disabled|missing-runtime|runtime:/);
      expect(findByTestId(body, "set-event-location-command-body")).not.toBeNull();
      expect(findByTestId(body, "set-event-location-event-select")?.tagName).toBe("SELECT");
      expect(findByTestId(body, "set-event-location-map-select")?.tagName).toBe("SELECT");
      expect(findByTestId(body, "set-event-location-x-input")?.value).toBe("3");
      expect(findByTestId(body, "set-event-location-y-input")?.value).toBe("4");
    });

    it("renders modern commands as guided controls instead of raw note fields", () => {
      const replaceCommand = vi.fn<CommandEditContext["actions"]["replaceCommand"]>();
      const context = contextWithReplaceSpy(replaceCommand);

      const body = renderWithFakeDom(
        () =>
          renderM2CommandBody(context, {
            kind: "m2Command",
            commandId: "m2-201-camera-control",
            fields: { mode: "panTo", target: "player", x: 10, y: 12, zoom: 1.25, durationMs: 450 },
          }) ?? document.createElement("div")
      );

      expect(body.textContent).toContain("값을 고르고 확인을 누르면 적용됩니다.");
      expect(findByTestId(body, "m2-command-mode-option-select")?.tagName).toBe("SELECT");
      expect(findByTestId(body, "m2-command-target-option-select")?.tagName).toBe("SELECT");
      expect(findByTestId(body, "m2-command-x-input")?.value).toBe("10");
      expect(findByTestId(body, "m2-command-y-input")?.value).toBe("12");
      expect(findByTestId(body, "m2-command-zoom-input")?.value).toBe("1.25");
      expect(findByTestId(body, "m2-command-durationMs-input")?.value).toBe("450");
      expect(findByTestId(body, "m2-command-note-input")).toBeNull();
    });

    it("routes Advanced Dialogue into the native text form (merged)", async () => {
      // Advanced Dialogue is now existingKind:text — generic m2 body is not used.
      const { m2CommandById } = await import("@/project/eventCommands/m2Catalog");
      const entry = m2CommandById("m2-209-advanced-dialogue");
      expect(entry?.existingKind).toBe("text");
      expect(entry?.bodyStrategy).toBe("existing");
    });

    it("renders Call Event as a common-event record selector, not map coordinates", () => {
      const project = store.getCurrent();
      project.commonEvents.push({ id: "ce_test", name: "테스트 공통 이벤트", commands: [], trigger: "none" });
      store.replace(project);
      const context = contextWithReplaceSpy(vi.fn());
      const body = renderWithFakeDom(() =>
        renderM2CommandBody(context, {
          kind: "m2Command",
          commandId: "m2-087-call-event",
          fields: {},
        }) ?? document.createElement("div")
      );

      // m2-087은 existingKind:callCommonEvent 별칭이라 제네릭 껍데기만 낸다.
      // 실제 저작은 네이티브 폼이 맡으므로, 별칭 껍데기가 맵 좌표 입력을 내놓지 않으면 된다.
      expect(Boolean(findByTestId(body, "m2-command-target-input"))).toBe(false);
      expect(Boolean(findByTestId(body, "m2-command-mapId-input"))).toBe(false);
      expect(Boolean(findByTestId(body, "m2-command-x-input"))).toBe(false);
      expect(Boolean(findByTestId(body, "m2-command-y-input"))).toBe(false);
    });

    it("renders Play Movie resource ids as movie picks, not image picks", () => {
      const context = contextWithReplaceSpy(vi.fn());
      const body = renderWithFakeDom(() =>
        renderM2CommandBody(context, {
          kind: "m2Command",
          commandId: "m2-066-play-movie",
          fields: {},
        }) ?? document.createElement("div")
      );

      const picker = findByTestId(body, "m2-command-resourceId-picker");
      expect(picker?.attrs["aria-label"]).toBe("영상 선택");
      expect(body.textContent).not.toContain("합본 마을");
      expect(body.textContent).not.toContain("tex_easyrpg_chipset_combined_town");
      expect(body.textContent).toContain("동영상을 고르세요");
      expect(body.textContent).not.toContain("그림을 고르세요");
    });

    it("explains Wait for All Movement intent for authors", () => {
      const context = contextWithReplaceSpy(vi.fn());
      const body = renderWithFakeDom(() =>
        renderM2CommandBody(context, {
          kind: "m2Command",
          commandId: "m2-058-wait-for-all-movement",
          fields: {},
        }) ?? document.createElement("div")
      );

      expect(findByTestId(body, "m2-command-body-m2-058-wait-for-all-movement")).not.toBeNull();
      expect(findByTestId(body, "m2-command-note-input")).toBeNull();
      expect(body.textContent).toContain("이 명령은 추가 설정 없이 실행됩니다");
      const hints = (body.textContent?.match(/추가 설정 없음/g) ?? []).length;
      expect(hints).toBeLessThanOrEqual(1);
    });
    it("announces retired catalog rows inside the dialog", () => {
      const context = contextWithReplaceSpy(vi.fn());
      // m2-055는 전용 애니메이션 폼 경로 — 배너가 전용 폼에도 붙는지 본다.
      const body = renderWithFakeDom(() =>
        renderCommandBody(context, {
          kind: "m2Command",
          commandId: "m2-055-show-animation",
          fields: {},
        })
      );

      expect(findByTestId(body, "show-animation-m2-command-body")).not.toBeNull();
      const notice = findByTestId(body, "m2-command-deprecated-notice");
      expect(notice).not.toBeNull();
      expect(notice?.textContent).toContain("m2-054-show-animation");
    });
  });
});

/** Page-3 (map and presentation) command body behavior contracts. */
describe("page3CommandBodies", () => {
  isolateTimers();
  function stagedContext(initial: Command): {
    readonly context: CommandEditContext;
    readonly current: () => Command;
  } {
    let staged = structuredClone(initial);
    return {
      context: {
        path: [1],
        actions: {
          addCommand: vi.fn(),
          insertCommand: vi.fn(),
          replaceCommand: (_path, command) => { staged = structuredClone(command); },
          deleteCommand: vi.fn(),
          moveCommand: vi.fn(),
          moveCommandTo: vi.fn(),
        },
        getCurrentCommand: () => staged,
      },
      current: () => staged,
    };
  }
  function m2(
    commandId: string,
    fields: Record<string, string | number | boolean> = {}
  ): Extract<Command, { kind: "m2Command" }> {
    return { kind: "m2Command", commandId, fields };
  }
  function change(node: FakeElement | null, value: string): void {
    expect(node).not.toBeNull();
    if (!node) return;
    node.value = value;
    node.dispatchEvent(new Event("change"));
  }
  function execute(command: Extract<Command, { kind: "m2Command" }>) {
    const project = store.getCurrent();
    const session = startSession(project);
    const entry = m2CommandById(command.commandId);
    expect(entry).toBeTruthy();
    if (entry) executeM2RuntimeCommand(session, entry, command, { project });
    return session;
  }
  describe("page3 command body UX (맵·연출)", () => {
    let restoreDom: (() => void) | undefined;
    let pictureResourceId = "";

    beforeEach(() => {
      restoreDom = installFakeDom();
      const project = createBlankProject();
      pictureResourceId =
        project.resources?.find?.((r) => (r as { kind?: string }).kind === "picture")?.id ??
        project.database.actors[0]?.faceResourceId ??
        "picture_sample";
      store.replace(project);
    });

    afterEach(() => {
      restoreDom?.();
    });


    describe("M2 page3 form-to-runtime contracts", () => {
      it("commits tint fields and applies them to runtime screen state", () => {
        const initial = m2("m2-046-tint-screen", { color: "neutral", value: "", duration: 0 });
        const staged = stagedContext(initial);
        const body = renderWithFakeDom(() => renderM2CommandBody(staged.context, initial)!);
        findByTestId(body, "tint-screen-color-blue")?.click();
        change(findByTestId(body, "tint-screen-duration-input"), "240");

        const command = staged.current() as Extract<Command, { kind: "m2Command" }>;
        // 편집기는 이제 durationMs 로 쓰고 옛 duration 키는 지운다(tintScreenBody commit).
        expect(command.fields).toMatchObject({ color: "blue", value: "", durationMs: 240 });
        expect(command.fields).not.toHaveProperty("duration");
        const session = execute(command);
        expect(session.m2Runtime?.screen).toMatchObject({ tint: "blue", tintDurationMs: 240 });
      });

      it("commits flash fields and applies the flash color to runtime", () => {
        const initial = m2("m2-047-flash-screen", { color: "white", value: "white", durationMs: 180 });
        const staged = stagedContext(initial);
        const body = renderWithFakeDom(() => renderM2CommandBody(staged.context, initial)!);
        change(findByTestId(body, "flash-screen-color"), "red");
        change(findByTestId(body, "flash-screen-duration-input"), "320");

        const command = staged.current() as Extract<Command, { kind: "m2Command" }>;
        expect(command.fields).toMatchObject({ color: "red", value: "red", durationMs: 320 });
        expect(execute(command).m2Runtime?.screen.flash).toBe("red");
      });

      it("commits shake fields and applies the intensity to runtime", () => {
        const initial = m2("m2-048-shake-screen", { intensity: "3", value: 3, durationMs: 300 });
        const staged = stagedContext(initial);
        const body = renderWithFakeDom(() => renderM2CommandBody(staged.context, initial)!);
        change(findByTestId(body, "shake-screen-intensity"), "6");
        change(findByTestId(body, "shake-screen-duration-input"), "450");

        const command = staged.current() as Extract<Command, { kind: "m2Command" }>;
        expect(command.fields).toMatchObject({ intensity: "6", value: 6, durationMs: 450 });
        expect(execute(command).m2Runtime?.screen.shake).toBe(6);
      });

      it("commits scroll fields and applies the canonical map runtime record", () => {
        const initial = m2("m2-049-scroll-map", { direction: "down", distance: 1, speed: 4, wait: "true", mode: "return" });
        const staged = stagedContext(initial);
        const body = renderWithFakeDom(() => renderM2CommandBody(staged.context, initial)!);
        change(findByTestId(body, "scroll-map-direction"), "right");
        change(findByTestId(body, "scroll-map-distance-input"), "5");

        const command = staged.current() as Extract<Command, { kind: "m2Command" }>;
        expect(command.fields).toMatchObject({ direction: "right", distance: 5, speed: 4, wait: "true", mode: "return" });
        expect(execute(command).m2Runtime?.map.scroll_map).toMatchObject({ value: "", x: 0, y: 0 });
      });

      it("commits weather fields and applies parsed weather to runtime", () => {
        const initial = m2("m2-050-set-weather-effects", { value: "none", transitionMs: 0, durationMs: 0 });
        const staged = stagedContext(initial);
        const body = renderWithFakeDom(() => renderM2CommandBody(staged.context, initial)!);
        findByTestId(body, "set-weather-effects-kind-snow")?.click();
        change(findByTestId(body, "set-weather-effects-intensity-input"), "0.75");
        change(findByTestId(body, "set-weather-effects-transition-input"), "400");

        const command = staged.current() as Extract<Command, { kind: "m2Command" }>;
        expect(command.fields).toMatchObject({ value: "snow,0.75", transitionMs: 400, durationMs: 400 });
        expect(execute(command).m2Runtime?.screen.weather).toBe("snow,0.75");
      });

      it("commits picture movement and updates the runtime picture slot", () => {
        const initial = m2("m2-052-move-picture", { pictureId: "pic1", resourceId: pictureResourceId, x: 8, y: 9, durationMs: 0 });
        const staged = stagedContext(initial);
        const body = renderWithFakeDom(() => renderM2CommandBody(staged.context, initial)!);
        change(findByTestId(body, "move-picture-m2-x-input"), "24");
        change(findByTestId(body, "move-picture-m2-y-input"), "30");
        change(findByTestId(body, "move-picture-m2-duration-input"), "500");

        const command = staged.current() as Extract<Command, { kind: "m2Command" }>;
        expect(command.fields).toMatchObject({ pictureId: "pic1", x: 24, y: 30, durationMs: 500, duration: 500 });
        const session = startSession(store.getCurrent());
        session.pictures = { pic1: { pictureId: "pic1", resourceId: pictureResourceId, x: 8, y: 9 } };
        executeM2RuntimeCommand(session, m2CommandById(command.commandId)!, command, { project: store.getCurrent() });
        expect(session.pictures.pic1).toMatchObject({ pictureId: "pic1", resourceId: pictureResourceId, x: 24, y: 30, durationMs: 500 });
      });

      it("commits encounter rate and applies the runtime map value", () => {
        const initial = m2("m2-070-set-encounter-rate", { value: 24, valueSource: "number", valueVariableId: "" });
        const staged = stagedContext(initial);
        const body = renderWithFakeDom(() => renderM2CommandBody(staged.context, initial)!);
        change(findByTestId(body, "set-encounter-rate-value-input"), "12");

        const command = staged.current() as Extract<Command, { kind: "m2Command" }>;
        expect(command.fields).toMatchObject({ target: "map", operation: "set", value: 12, valueSource: "number" });
        expect(execute(command).m2Runtime?.map.encounter_rate?.value).toBe("12");
      });
    });

  });
});

// 시스템·연출(피커 3페이지) 명령 프리뷰 폴리시 계약.
// 색조/날씨/먼 배경/키 입력 프리뷰가 "실제 시각 요소"를 갖는지 구조로만 검사한다
// (한국어 산문 전문·픽셀 색은 고정하지 않는다).
describe("page3SystemEffectPreviews", () => {
  isolateTimers();
  const TINT_ID = "m2-046-tint-screen";
  const WEATHER_ID = "m2-050-set-weather-effects";
  const KEY_INPUT_ID = "m2-067-key-input-processing";
  const PARALLAX_ID = "m2-069-change-parallax-back";
  const UPLOADED_BACKDROP_ID = "uploaded-parallax-cliff";
  let replaceCommand = vi.fn<CommandEditContext["actions"]["replaceCommand"]>();
  function context(): CommandEditContext {
    return {
      path: [3],
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
  function renderBody(commandId: string, fields: Record<string, unknown>): FakeElement {
    const cmd = { kind: "m2Command", commandId, fields } as unknown as Command;
    return renderWithFakeDom(() => renderM2CommandBody(context(), cmd) ?? document.createElement("div"));
  }
  function requireTestId(root: FakeElement, testId: string): FakeElement {
    const found = findByTestId(root, testId);
    if (!found) throw new Error(`missing [data-testid="${testId}"]`);
    return found;
  }
  /** 프리뷰 구조 불변조건: [시각 요소] → .actor-m2-preview-line → .actor-m2-preview-note */
  function expectVisualFirstThenLineThenNote(preview: FakeElement, visualTestId: string): void {
    const first = preview.children[0];
    expect(first?.dataset.testid).toBe(visualTestId);
    const classes = preview.children.map((child) => child.className);
    const lineIndex = classes.findIndex((name) => name.split(/\s+/).includes("actor-m2-preview-line"));
    const noteIndex = classes.findIndex((name) => name.split(/\s+/).includes("actor-m2-preview-note"));
    expect(lineIndex).toBeGreaterThan(0);
    expect(noteIndex).toBeGreaterThan(lineIndex);
  }
  describe("page 3 시스템·연출 프리뷰 폴리시", () => {
    let restoreDom: (() => void) | undefined;

    beforeEach(() => {
      restoreDom = installFakeDom();
      replaceCommand = vi.fn<CommandEditContext["actions"]["replaceCommand"]>();
      const project = createBlankProject();
      project.assets.uploaded[UPLOADED_BACKDROP_ID] = {
        id: UPLOADED_BACKDROP_ID,
        name: "절벽 원경.png",
        kind: "backdrop",
        dataUrl: "data:image/png;base64,iVBORw0KGgo=",
        meta: { width: 640, height: 480 },
      };
      store.replace(project);
    });

    afterEach(() => {
      restoreDom?.();
    });

    describe("화면 색조", () => {
      it("프리뷰 첫 자식이 stage + 색 swatch이고 프리셋 선택이 data-tint로 반영된다", () => {
        const body = renderBody(TINT_ID, { color: "blue", value: "", duration: 600 });
        const preview = requireTestId(body, "tint-screen-preview");
        const stage = requireTestId(preview, "tint-screen-preview-stage");
        const swatch = requireTestId(stage, "tint-screen-preview-swatch");

        expect(stage.className.split(/\s+/)).toEqual(
          expect.arrayContaining(["actor-m2-preview-stage", "page3-preview-stage"])
        );
        expect(swatch.className.split(/\s+/)).toEqual(
          expect.arrayContaining(["actor-m2-effect-swatch", "page3-tint-preview"])
        );
        expect(swatch.dataset.tint).toBe("blue");
        expect(swatch.dataset.durationMs).toBe("600");
        expectVisualFirstThenLineThenNote(preview, "tint-screen-preview-stage");
        expect(findByTestId(body, "tint-screen-preview-error")).toBeNull();
      });

      it("기존 색상 칩 testid를 유지하고 칩 클릭이 swatch 색조를 갱신한다", () => {
        const body = renderBody(TINT_ID, { color: "neutral", value: "", duration: 0 });
        expect(findByTestId(body, "tint-screen-color-chips")).not.toBeNull();
        for (const id of ["neutral", "white", "red", "green", "blue", "yellow", "purple", "black"]) {
          expect(findByTestId(body, `tint-screen-color-${id}`), id).not.toBeNull();
        }
        expect(requireTestId(body, "tint-screen-preview-swatch").dataset.tint).toBe("neutral");

        requireTestId(body, "tint-screen-color-red").click();

        expect(requireTestId(body, "tint-screen-preview-swatch").dataset.tint).toBe("red");
      });

      it("유효한 직접 색은 custom swatch + 인라인 효과 색 변수로 표현된다", () => {
        const body = renderBody(TINT_ID, { color: "blue", value: "#3366ff", duration: 200 });
        const swatch = requireTestId(body, "tint-screen-preview-swatch");

        expect(swatch.dataset.tint).toBe("custom");
        expect(swatch.style.getPropertyValue("--actor-m2-effect-color")).not.toBe("");
        expect(findByTestId(body, "tint-screen-preview-error")).toBeNull();
      });

      it("무효한 직접 색은 status 오류 안내를 띄운다", () => {
        const body = renderBody(TINT_ID, { color: "blue", value: "nope", duration: 200 });
        const error = requireTestId(body, "tint-screen-preview-error");

        expect(error.getAttribute("role")).toBe("status");
        expect(error.textContent.trim().length).toBeGreaterThan(0);
        expect(requireTestId(body, "tint-screen-preview-swatch").dataset.tint).toBe("blue");
      });

      it("폼을 여는 것만으로는 명령을 저장하지 않는다", () => {
        renderBody(TINT_ID, { color: "blue", value: "", duration: 600 });
        expect(replaceCommand).not.toHaveBeenCalled();
      });
    });

    describe("날씨 효과", () => {
      it("stage 안에 강도가 반영된 오버레이가 항상 존재한다", () => {
        const body = renderBody(WEATHER_ID, { value: "rain,0.7", transitionMs: 800 });
        const preview = requireTestId(body, "set-weather-effects-preview");
        const stage = requireTestId(preview, "set-weather-effects-preview-stage");
        const overlay = requireTestId(stage, "set-weather-effects-preview-overlay");

        expect(stage.className.split(/\s+/)).toEqual(
          expect.arrayContaining(["actor-m2-preview-stage", "page3-preview-stage", "page3-preview-weather"])
        );
        expect(overlay.className.split(/\s+/)).toEqual(
          expect.arrayContaining(["actor-m2-weather-overlay", "page3-weather-preview"])
        );
        expect(overlay.dataset.weather).toBe("rain");
        expect(Number(overlay.dataset.intensity)).toBeCloseTo(0.7, 5);
        expect(overlay.dataset.transitionMs).toBe("800");
        expectVisualFirstThenLineThenNote(preview, "set-weather-effects-preview-stage");
      });

      it("날씨 없음에서도 오버레이를 DOM에서 제거하지 않는다", () => {
        const body = renderBody(WEATHER_ID, { value: "none", transitionMs: 0 });
        const overlay = requireTestId(body, "set-weather-effects-preview-overlay");

        expect(overlay.dataset.weather).toBe("none");
      });

      it("종류 칩마다 색 점을 붙이고 기존 칩 testid를 유지한다", () => {
        const body = renderBody(WEATHER_ID, { value: "snow,0.4", transitionMs: 0 });
        for (const id of ["none", "rain", "storm", "snow", "fog"]) {
          const chip = requireTestId(body, `set-weather-effects-kind-${id}`);
          const dot = requireTestId(chip, `set-weather-effects-kind-${id}-dot`);
          expect(dot.className.split(/\s+/)).toContain("actor-m2-weather-dot");
        }
      });

      it("안개일 때만 원·근 두 겹의 안개 층이 생긴다", () => {
        const fog = renderBody(WEATHER_ID, { value: "fog,0.7", transitionMs: 800 });
        const far = requireTestId(fog, "set-weather-effects-preview-fog-far");
        const near = requireTestId(fog, "set-weather-effects-preview-fog-near");
        expect(far.className.split(/\s+/)).toContain("actor-m2-fog-layer");
        expect(near.className.split(/\s+/)).toContain("actor-m2-fog-layer");
        expect(fog.querySelectorAll(".actor-m2-fog-layer")).toHaveLength(2);

        const rain = renderBody(WEATHER_ID, { value: "rain,0.7", transitionMs: 0 });
        expect(rain.querySelectorAll(".actor-m2-fog-layer")).toHaveLength(0);
        expect(findByTestId(rain, "set-weather-effects-preview-fog-far")).toBeNull();
        expect(findByTestId(rain, "set-weather-effects-preview-fog-near")).toBeNull();
      });

      it("강도 슬라이더가 숫자 입력·오버레이와 동기화되고 저장 형식은 그대로다", () => {
        const body = renderBody(WEATHER_ID, { value: "fog,0.7", transitionMs: 800 });
        const slider = requireTestId(body, "set-weather-effects-intensity-slider");
        const numberInput = requireTestId(body, "set-weather-effects-intensity-input");
        expect(slider.className.split(/\s+/)).toContain("page3-range-input");
        expect(slider.getAttribute("type")).toBe("range");
        expect(Number(slider.value)).toBeCloseTo(0.7, 5);

        slider.value = "0.35";
        slider.dispatchEvent(new Event("input"));

        expect(Number(numberInput.value)).toBeCloseTo(0.35, 5);
        expect(Number(requireTestId(body, "set-weather-effects-preview-overlay").dataset.intensity)).toBeCloseTo(0.35, 5);
        expect(replaceCommand).toHaveBeenCalledWith(
          [3],
          expect.objectContaining({
            fields: expect.objectContaining({ value: "fog,0.35" }),
          })
        );
      });

      it("폼을 여는 것만으로는 명령을 저장하지 않는다", () => {
        renderBody(WEATHER_ID, { value: "fog,0.7", transitionMs: 800 });
        expect(replaceCommand).not.toHaveBeenCalled();
      });
    });

    describe("먼 배경 변경", () => {
      it("선택된 배경은 실제 이미지 + 캡션으로 보인다", () => {
        const body = renderBody(PARALLAX_ID, { value: UPLOADED_BACKDROP_ID });
        const preview = requireTestId(body, "change-parallax-back-preview");
        const panel = requireTestId(preview, "change-parallax-back-preview-image");

        expect(panel.className.split(/\s+/)).toEqual(
          expect.arrayContaining(["actor-m2-parallax-preview", "actor-m2-preview-stage"])
        );
        expect(panel.dataset.state).toBe("ready");
        const images = panel.querySelectorAll("img");
        expect(images).toHaveLength(1);
        expect(images[0]?.className.split(/\s+/)).toContain("actor-m2-parallax-preview-img");
        expect(images[0]?.getAttribute("alt")).toContain("먼 배경");
        const caption = requireTestId(preview, "change-parallax-back-preview-caption");
        expect(caption.getAttribute("title")).toBe(UPLOADED_BACKDROP_ID);
        expectVisualFirstThenLineThenNote(preview, "change-parallax-back-preview-image");
      });

      it("미선택이면 empty 상태 안내만 보이고 이미지가 없다", () => {
        const body = renderBody(PARALLAX_ID, { value: "" });
        const panel = requireTestId(body, "change-parallax-back-preview-image");

        expect(panel.dataset.state).toBe("empty");
        expect(panel.querySelectorAll("img")).toHaveLength(0);
        expect(findByTestId(panel, "change-parallax-back-preview-empty")).not.toBeNull();
        expect(findByTestId(panel, "change-parallax-back-preview-missing")).toBeNull();
      });

      it("해석할 수 없는 리소스는 missing 상태로 알린다", () => {
        const body = renderBody(PARALLAX_ID, { value: "no-such-backdrop-#$%" });
        const panel = requireTestId(body, "change-parallax-back-preview-image");

        expect(panel.dataset.state).toBe("missing");
        expect(panel.querySelectorAll("img")).toHaveLength(0);
        expect(findByTestId(panel, "change-parallax-back-preview-missing")).not.toBeNull();
      });

      it("기존 리소스 선택/피커 testid를 유지하고 오픈 시 저장하지 않는다", () => {
        const body = renderBody(PARALLAX_ID, { value: UPLOADED_BACKDROP_ID });
        expect(findByTestId(body, "change-parallax-back-resource-select")).not.toBeNull();
        expect(findByTestId(body, "change-parallax-back-resource-picker")).not.toBeNull();
        expect(replaceCommand).not.toHaveBeenCalled();
      });
    });

    describe("키 입력", () => {
      it("저장되는 키 코드 집합을 키캡으로 전부 보여준다", () => {
        const body = renderBody(KEY_INPUT_ID, { variableId: "", value: "true" });
        const preview = requireTestId(body, "key-input-processing-preview");
        const keycaps = requireTestId(preview, "key-input-processing-keycaps");

        expect(keycaps.className.split(/\s+/)).toContain("actor-m2-keycaps");
        expect(keycaps.getAttribute("aria-label")).toBe("입력 가능한 키 코드");
        for (const code of ["1", "2", "3", "4", "5", "6", "7", "digits"]) {
          const cap = requireTestId(keycaps, `key-input-processing-keycap-${code}`);
          expect(cap.className.split(/\s+/)).toContain("actor-m2-keycap");
        }
        expect(keycaps.querySelectorAll(".actor-m2-keycap")).toHaveLength(8);
        expectVisualFirstThenLineThenNote(preview, "key-input-processing-keycaps");
      });

      it("대상 변수·대기 배지를 시각 요소와 함께 노출한다", () => {
        const waiting = renderBody(KEY_INPUT_ID, { variableId: "", value: "true" });
        expect(requireTestId(waiting, "key-input-processing-preview-target").textContent.trim().length).toBeGreaterThan(0);
        expect(requireTestId(waiting, "key-input-processing-preview-wait").dataset.wait).toBe("true");

        const notWaiting = renderBody(KEY_INPUT_ID, { variableId: "", value: "false" });
        expect(requireTestId(notWaiting, "key-input-processing-preview-wait").dataset.wait).toBe("false");
      });

      it("기존 변수/대기 컨트롤 testid를 유지하고 오픈 시 저장하지 않는다", () => {
        const body = renderBody(KEY_INPUT_ID, { variableId: "", value: "true" });
        expect(findByTestId(body, "key-input-processing-variable")).not.toBeNull();
        expect(findByTestId(body, "key-input-processing-wait")).not.toBeNull();
        expect(replaceCommand).not.toHaveBeenCalled();
      });
    });
  });
});
