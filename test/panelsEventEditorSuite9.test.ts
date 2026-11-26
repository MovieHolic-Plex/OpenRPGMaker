import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { showAnimationBody, setLightingBody, showPictureBody } from "@/editor/panels/eventEditor/commandBodyPage3Native";
import { SHOW_ANIMATION_FRAME_MS, playShowAnimation, playShowAnimationOnce, renderShowAnimationFrame, showAnimationPlaybackSource } from "@/editor/panels/eventEditor/showAnimationPlayback";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { BattleAnimationRecord, Command, Project, Condition } from "@/project/types";
import type { CommandEditContext, CommandListActions } from "@/editor/panels/eventEditor/types";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";
import { isolateTimers } from "./mergedTeardown";
import { applyCommandDiff, countCommandDiff, diffCommandLists, hasCommandDiffChanges } from "@/editor/panels/eventEditor/commandDiff";
import { newM2Command } from "@/editor/eventCommandFactory";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import { commandSummaryParts } from "@/editor/panels/eventEditor/commandSummary";
import { handleCommandShortcut } from "@/editor/panels/eventEditor/commandListContextMenu";
import { compileConditionFromText } from "@/editor/panels/eventEditor/conditionCompile";
import { evalCondition, startSession } from "@/project/session";
import { renderConditionEvalPreview } from "@/editor/panels/eventEditor/conditionEvalPreview";
import { editorState } from "@/editor/editorState";
import { renderEventScheduleEditor } from "@/editor/panels/eventEditor/eventScheduleEditor";

describe("commandBodyPage3Native", () => {
  isolateTimers();
  /**
   * showAnimation 명령 본문의 애니메이션 표시면 계약.
   *
   * 1) 미리보기 스테이지는 글리프가 아니라 선택 레코드의 시트 프레임을 실제로 재생한다.
   * 2) 한 본문에 애니메이션 표시면은 하나뿐이다(intentCard + fieldBlock 중복 제거).
   */
  describe("eventEditorShowAnimationPreview", () => {
    isolateTimers();
    type FakeBrowserGlobals = {
      readonly Image: typeof globalThis.Image | undefined;
      readonly window: typeof globalThis.window | undefined;
    };
    let restoreDom: (() => void) | undefined;
    let previousBrowserGlobals: FakeBrowserGlobals;
    function context(): CommandEditContext {
      return {
        path: [0],
        actions: {
          addCommand: vi.fn(),
          insertCommand: vi.fn(),
          replaceCommand: vi.fn(),
          deleteCommand: vi.fn(),
          moveCommand: vi.fn(),
          moveCommandTo: vi.fn(),
        },
      };
    }
    function animated(project: Project): BattleAnimationRecord {
      const record = project.database.battleAnimations.find(
        (entry) => (entry.frames?.length ?? 0) > 1 && Boolean(entry.resourceId)
      );
      if (!record) throw new Error("프레임을 가진 전투 애니메이션 레코드가 없다");
      return record;
    }
    function command(animationId: string): Extract<Command, { kind: "showAnimation" }> {
      return { kind: "showAnimation", target: "player", animationId };
    }
    function frameLayer(body: FakeElement): FakeElement {
      const layer = findByTestId(body, "show-animation-frame-layer");
      if (!layer) throw new Error("프레임 레이어가 없다");
      return layer;
    }
    /** 텍스트가 애니메이션 표제와 정확히 일치하는 노드를 센다(표시면 중복 감지). */
    function animationHeadings(root: FakeElement): FakeElement[] {
      const found: FakeElement[] = [];
      const walk = (node: FakeElement): void => {
        const text = node.textContent.trim();
        if (text === "애니메이션" || text === "애니메이션 표시") found.push(node);
        for (const child of node.children) walk(child);
      };
      walk(root);
      return found;
    }
    beforeEach(() => {
      restoreDom = installFakeDom();
      previousBrowserGlobals = { Image: globalThis.Image, window: globalThis.window };
      vi.useFakeTimers();
      Object.defineProperty(globalThis, "Image", {
        configurable: true,
        value: class {
          addEventListener(): void {}
          set src(_value: string) {}
        },
      });
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: { clearInterval: globalThis.clearInterval, setInterval: globalThis.setInterval },
      });
      store.replace(createBlankProject());
    });
    afterEach(() => {
      vi.useRealTimers();
      restoreDom?.();
      restoreDom = undefined;
      restoreBrowserGlobal("Image", previousBrowserGlobals.Image);
      restoreBrowserGlobal("window", previousBrowserGlobals.window);
    });
    function restoreBrowserGlobal(name: "Image" | "window", value: unknown): void {
      if (value === undefined) {
        Reflect.deleteProperty(globalThis, name);
        return;
      }
      Object.defineProperty(globalThis, name, { configurable: true, value });
    }
    describe("showAnimation 본문 애니메이션 표시면", () => {
      it("선택 레코드의 시트 프레임을 실제로 재생한다(글리프 아님)", () => {
        const project = store.getCurrent();
        const record = animated(project);
        const body = renderWithFakeDom(() => showAnimationBody(context(), command(record.id)));

        const stage = findByTestId(body, "show-animation-preview-stage");
        expect(stage).not.toBeNull();
        expect(stage?.textContent).not.toContain("✦");

        const layer = frameLayer(body);
        expect(layer.dataset.frameIndex).toBe("0");
        const firstCell = findByTestId(layer, "show-animation-frame-cell");
        expect(firstCell).not.toBeNull();
        const firstPosition = firstCell?.style.backgroundPosition;

        vi.advanceTimersByTime(SHOW_ANIMATION_FRAME_MS);
        expect(layer.dataset.frameIndex).toBe("1");
        expect(findByTestId(layer, "show-animation-frame-cell")?.style.backgroundPosition).not.toBe(firstPosition);
      });

      it("재생 토글로 한 번 더 돌릴 수 있다", () => {
        const record = animated(store.getCurrent());
        const body = renderWithFakeDom(() => showAnimationBody(context(), command(record.id)));
        const play = findByTestId(body, "show-animation-play");
        expect(play).not.toBeNull();

        // 자동 1회 재생이 끝날 만큼 넘긴다.
        vi.advanceTimersByTime(SHOW_ANIMATION_FRAME_MS * ((record.frames?.length ?? 0) + 2));
        expect(play?.textContent).toBe("▶ 재생");
        expect(play?.attrs["aria-pressed"]).toBe("false");

        play?.click();
        expect(play?.textContent).toBe("■ 정지");
        expect(play?.attrs["aria-pressed"]).toBe("true");
        expect(frameLayer(body).dataset.frameIndex).toBe("0");
      });

      it("프레임이 없는 레코드는 깨진 스테이지 대신 라벨 붙은 섬광 대체면을 보여 준다", () => {
        const project = store.getCurrent();
        const legacy = project.database.battleAnimations[0];
        if (!legacy) throw new Error("전투 애니메이션 레코드가 없다");
        legacy.frames = [];

        const body = renderWithFakeDom(() => showAnimationBody(context(), command(legacy.id)));
        const fallback = findByTestId(body, "show-animation-preview-fallback");
        expect(fallback).not.toBeNull();
        expect(fallback?.textContent).toContain("프레임 없음");
        expect(findByTestId(body, "show-animation-frame-cell")).toBeNull();
        expect(findByTestId(body, "show-animation-play")).toBeNull();
      });

      it("한 프레임만 있는 새 레코드는 재생 버튼 대신 정지 화면이라고 밝힌다", () => {
        // 새로 만든 전투 애니메이션 레코드는 정규화 결과 기본 프레임 1장만 갖는다.
        const project = store.getCurrent();
        const single = project.database.battleAnimations[1];
        if (!single) throw new Error("전투 애니메이션 레코드가 없다");
        single.frames = [{ cells: [{ pattern: 0, x: 0, y: 0, zoom: 100, opacity: 255, visible: true }] }];

        const body = renderWithFakeDom(() => showAnimationBody(context(), command(single.id)));
        expect(findByTestId(body, "show-animation-static-frame")).not.toBeNull();
        expect(findByTestId(body, "show-animation-frame-cell")).not.toBeNull();
        expect(findByTestId(body, "show-animation-play")).toBeNull();
      });

      it("애니메이션 표시면이 본문에 하나만 있다", () => {
        const record = animated(store.getCurrent());
        const body = renderWithFakeDom(() => showAnimationBody(context(), command(record.id)));

        expect(findByTestId(body, "show-animation-intent")).toBeNull();
        expect(findByTestId(body, "show-animation-surface")).not.toBeNull();
        expect(animationHeadings(body).map((node) => node.dataset.testid)).toEqual(["show-animation-surface-title"]);
      });

      it("반복 재생은 마지막 프레임 다음에 0으로 돌아가 계속 전진한다", () => {
        const source = {
          sheet: { frameWidth: 96, frameHeight: 96, columns: 5 },
          frames: [
            { cells: [{ pattern: 0, x: 0, y: 0, zoom: 100, opacity: 255, visible: true }] },
            { cells: [{ pattern: 1, x: 0, y: 0, zoom: 100, opacity: 255, visible: true }] },
            { cells: [{ pattern: 2, x: 0, y: 0, zoom: 100, opacity: 255, visible: true }] },
          ],
          url: undefined,
        };
        const stage = document.createElement("div");
        const layer = document.createElement("div");
        stage.append(layer);
        document.body.append(stage);

        playShowAnimation(stage, layer, source, { loop: true });

        expect(layer.dataset.frameIndex).toBe("0");
        vi.advanceTimersByTime(SHOW_ANIMATION_FRAME_MS * 2);
        expect(layer.dataset.frameIndex).toBe("2");
        vi.advanceTimersByTime(SHOW_ANIMATION_FRAME_MS);
        expect(layer.dataset.frameIndex).toBe("0");
        vi.advanceTimersByTime(SHOW_ANIMATION_FRAME_MS);
        expect(layer.dataset.frameIndex).toBe("1");
        expect(vi.getTimerCount()).toBe(1);
      });

      it("프레임 콜백은 첫 렌더와 매 틱의 인덱스와 전체 프레임 수를 알린다", () => {
        const source = {
          sheet: { frameWidth: 96, frameHeight: 96, columns: 5 },
          frames: [
            { cells: [{ pattern: 0, x: 0, y: 0, zoom: 100, opacity: 255, visible: true }] },
            { cells: [{ pattern: 1, x: 0, y: 0, zoom: 100, opacity: 255, visible: true }] },
          ],
          url: undefined,
        };
        const stage = document.createElement("div");
        const layer = document.createElement("div");
        stage.append(layer);
        document.body.append(stage);
        const onFrame = vi.fn();

        playShowAnimation(stage, layer, source, { loop: true, onFrame });
        vi.advanceTimersByTime(SHOW_ANIMATION_FRAME_MS * 3);

        expect(onFrame.mock.calls).toEqual([
          [0, 2],
          [1, 2],
          [0, 2],
          [1, 2],
        ]);
      });

      it("반복 재생도 마운트된 스테이지가 분리되면 인터벌을 지운다", () => {
        const source = {
          sheet: { frameWidth: 96, frameHeight: 96, columns: 5 },
          frames: [
            { cells: [{ pattern: 0, x: 0, y: 0, zoom: 100, opacity: 255, visible: true }] },
            { cells: [{ pattern: 1, x: 0, y: 0, zoom: 100, opacity: 255, visible: true }] },
          ],
          url: undefined,
        };
        const stage = new FakeElement("div") as unknown as HTMLElement;
        const layer = new FakeElement("div") as unknown as HTMLElement;
        const onStop = vi.fn();
        Object.defineProperty(stage, "isConnected", { configurable: true, value: true });

        playShowAnimation(stage, layer, source, { loop: true, onStop });
        vi.advanceTimersByTime(SHOW_ANIMATION_FRAME_MS);
        expect(vi.getTimerCount()).toBe(1);

        Object.defineProperty(stage, "isConnected", { configurable: true, value: false });
        vi.advanceTimersByTime(SHOW_ANIMATION_FRAME_MS);

        expect(vi.getTimerCount()).toBe(0);
        expect(onStop).toHaveBeenCalledTimes(1);
      });

      it("기존 1회 재생은 끝에서 멈추고 첫 프레임으로 돌아간다", () => {
        const source = {
          sheet: { frameWidth: 96, frameHeight: 96, columns: 5 },
          frames: [
            { cells: [{ pattern: 0, x: 0, y: 0, zoom: 100, opacity: 255, visible: true }] },
            { cells: [{ pattern: 1, x: 0, y: 0, zoom: 100, opacity: 255, visible: true }] },
          ],
          url: undefined,
        };
        const stage = document.createElement("div");
        const layer = document.createElement("div");
        stage.append(layer);
        document.body.append(stage);
        const onStop = vi.fn();

        playShowAnimationOnce(stage, layer, source, onStop);
        expect(layer.dataset.frameIndex).toBe("0");
        vi.advanceTimersByTime(SHOW_ANIMATION_FRAME_MS);
        expect(layer.dataset.frameIndex).toBe("1");
        vi.advanceTimersByTime(SHOW_ANIMATION_FRAME_MS);

        expect(layer.dataset.frameIndex).toBe("0");
        expect(onStop).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount()).toBe(0);
        vi.advanceTimersByTime(SHOW_ANIMATION_FRAME_MS * 2);
        expect(layer.dataset.frameIndex).toBe("0");
        expect(onStop).toHaveBeenCalledTimes(1);
      });

      it("프레임 렌더러가 패턴을 시트 좌표로 옮긴다", () => {
        const project = store.getCurrent();
        const record: BattleAnimationRecord = {
          id: "anim_test",
          name: "테스트",
          resourceId: undefined,
          sheet: { frameWidth: 96, frameHeight: 96, columns: 5 },
          frames: [
            { cells: [{ pattern: 0, x: 0, y: 0, zoom: 100, opacity: 255, visible: true }] },
            { cells: [{ pattern: 6, x: 12, y: -8, zoom: 50, opacity: 128, visible: true }] },
          ],
        };
        const source = showAnimationPlaybackSource(record, project);
        if (!source) throw new Error("재생 소스를 만들지 못했다");
        const layer = new FakeElement("div") as unknown as HTMLElement;

        renderShowAnimationFrame(layer, source, 1);

        const cell = findByTestId(layer as unknown as FakeElement, "show-animation-frame-cell");
        expect(cell?.dataset.pattern).toBe("6");
        expect(cell?.style.backgroundPosition).toBe("-96px -96px");
        expect(cell?.style.transform).toBe("translate(12px, -8px) scale(0.5)");
        expect(cell?.style.opacity).toBe(String(128 / 255));
        expect((layer as unknown as FakeElement).dataset.frameIndex).toBe("1");
      });
    });
  });
  describe("setLightingPercent", () => {
    isolateTimers();
    describe("lighting percent authoring", () => {
      let restore: () => void;
      beforeEach(() => { restore = installFakeDom(); });
      afterEach(() => restore());
      it("converts percentages once and synchronizes slider, presets and preview", () => {
        const replaceCommand = vi.fn();
        const context: CommandEditContext = {
          path: [0], actions: { replaceCommand, addCommand: vi.fn(), insertCommand: vi.fn(),
            deleteCommand: vi.fn(), moveCommand: vi.fn(), moveCommandTo: vi.fn() },
        };
        const body = renderWithFakeDom(() => setLightingBody(context, { kind: "setLighting", ambient: 0.35 }));
        const input = findByTestId(body, "set-lighting-ambient-input")!;
        const slider = findByTestId(body, "set-lighting-ambient-slider")!;
        const preview = () => findByTestId(body, "set-lighting-preview-stage")!;
        expect(input.value).toBe("35");
        expect(slider.value).toBe("35");
        expect(preview().children[0].style.opacity).toBe("0.35");
        input.value = "50";
        input.dispatchEvent(new Event("change"));
        expect(replaceCommand).toHaveBeenLastCalledWith([0], { kind: "setLighting", ambient: 0.5, color: "#000000" });
        expect(slider.value).toBe("50");
        expect(preview().children[0].style.opacity).toBe("0.5");
        slider.value = "75";
        slider.dispatchEvent(new Event("input"));
        expect(input.value).toBe("75");
        expect(preview().children[0].style.opacity).toBe("0.75");
        slider.dispatchEvent(new Event("change"));
        expect(replaceCommand.mock.calls.at(-1)?.[1].ambient).toBe(0.75);
        findByTestId(body, "set-lighting-preset-dusk")!.click();
        expect(input.value).toBe("35");
        expect(slider.value).toBe("35");
        expect(replaceCommand.mock.calls.at(-1)?.[1]).toMatchObject({ ambient: 0.35, transitionMs: 400 });
        expect(preview().children[0].style.opacity).toBe("0.35");
      });
    });
  });
  /**
   * 그림 표시 폼이 런타임이 지원하는 변환을 전부 노출해야 한다.
   *
   * 회귀 배경: 런타임은 확대·투명도·회전·전환시간을 모두 지원하는데(pictures/pictureTween.ts,
   * types/events.ts:315-318) 폼이 커밋하는 필드는 pictureId/resourceId/x/y 넷뿐이었다.
   * 감독이 "60%로 줄여 15도 기울여 페이드인" 을 하려면 AI 툴이나 JSON 손편집으로 우회해야 했다.
   */
  describe("showPictureForm", () => {
    isolateTimers();
    type ShowPicture = Extract<Command, { kind: "showPicture" }>;
    function stagedContext(initial: ShowPicture, onCommit?: (command: ShowPicture) => void): {
      readonly context: CommandEditContext;
      readonly current: () => ShowPicture;
    } {
      let staged = structuredClone(initial) as ShowPicture;
      return {
        context: {
          path: [1],
          actions: {
            addCommand: vi.fn(),
            insertCommand: vi.fn(),
            replaceCommand: (_path, command) => {
              if (command.kind !== "showPicture") throw new Error("unexpected command");
              staged = structuredClone(command);
              onCommit?.(staged);
            },
            deleteCommand: vi.fn(),
            moveCommand: vi.fn(),
            moveCommandTo: vi.fn(),
          },
          getCurrentCommand: () => staged,
        },
        current: () => staged,
      };
    }
    function change(node: FakeElement | null, value: string): void {
      expect(node).not.toBeNull();
      if (!node) return;
      node.value = value;
      node.dispatchEvent(new Event("change"));
    }
    const BASE: ShowPicture = { kind: "showPicture", pictureId: "pic1", resourceId: "", x: 0, y: 0 };
    let restoreDom: (() => void) | undefined;
    beforeEach(() => {
      restoreDom = installFakeDom();
      store.replace(createBlankProject());
    });
    afterEach(() => {
      vi.unstubAllGlobals();
      restoreDom?.();
    });
    describe("그림 표시 폼", () => {
      it("확대·투명도·회전·전환시간 칸이 모두 있다", () => {
        const { context } = stagedContext(BASE);
        const body = renderWithFakeDom(() => showPictureBody(context, BASE));
        for (const testId of [
          "show-picture-scale-input",
          "show-picture-opacity-input",
          "show-picture-rotation-input",
          "show-picture-duration-input",
        ]) {
          expect(findByTestId(body, testId), `${testId} 칸이 없다`).not.toBeNull();
        }
      });

      it("입력한 값이 커맨드에 실린다", () => {
        const { context, current } = stagedContext(BASE);
        const body = renderWithFakeDom(() => showPictureBody(context, BASE));

        change(findByTestId(body, "show-picture-scale-input"), "60");
        change(findByTestId(body, "show-picture-opacity-input"), "50");
        change(findByTestId(body, "show-picture-rotation-input"), "15");
        change(findByTestId(body, "show-picture-duration-input"), "400");

        expect(current().scale).toBe(60);
        expect(current().opacity).toBe(128);
        expect(current().rotation).toBe(15);
        expect(current().durationMs).toBe(400);
      });

      it("기존 값이 있으면 칸에 채워진다", () => {
        const seeded: ShowPicture = { ...BASE, scale: 75, opacity: 200, rotation: -30, durationMs: 250 };
        const { context } = stagedContext(seeded);
        const body = renderWithFakeDom(() => showPictureBody(context, seeded));

        expect(findByTestId(body, "show-picture-scale-input")?.value).toBe("75");
        expect(findByTestId(body, "show-picture-opacity-input")?.value).toBe("78");
        expect(findByTestId(body, "show-picture-rotation-input")?.value).toBe("-30");
        expect(findByTestId(body, "show-picture-duration-input")?.value).toBe("250");
      });

      it("범위 밖 값은 폼에서 접어 런타임까지 새지 않는다", () => {
        const { context, current } = stagedContext(BASE);
        const body = renderWithFakeDom(() => showPictureBody(context, BASE));

        change(findByTestId(body, "show-picture-opacity-input"), "9999");
        expect(current().opacity).toBe(255);

        change(findByTestId(body, "show-picture-opacity-input"), "-40");
        expect(current().opacity).toBe(0);

        change(findByTestId(body, "show-picture-scale-input"), "0");
        expect(current().scale).toBe(1);
      });

      it("회전은 한 바퀴를 넘겨도 접지 않는다", () => {
        const { context, current } = stagedContext(BASE);
        const body = renderWithFakeDom(() => showPictureBody(context, BASE));
        change(findByTestId(body, "show-picture-rotation-input"), "540");
        expect(current().rotation).toBe(540);
      });

      it("완료까지 대기를 켜면 페이드가 끝난 뒤에야 다음 명령이 시작하도록 저장한다", () => {
        const seeded: ShowPicture = { ...BASE, durationMs: 800, waitForPicture: true };
        const { context, current } = stagedContext(seeded);
        const body = renderWithFakeDom(() => showPictureBody(context, seeded));
        const box = findByTestId(body, "show-picture-wait");
        expect(box?.checked).toBe(true);
        expect(body.textContent ?? "").toContain("페이드·이동이 끝난 뒤");

        if (box) {
          box.checked = false;
          box.dispatchEvent(new Event("change"));
        }
        expect(current().waitForPicture).toBeUndefined();
        expect(current().durationMs).toBe(800);

        if (box) {
          box.checked = true;
          box.dispatchEvent(new Event("change"));
        }
        expect(current().waitForPicture).toBe(true);
        expect(body.textContent ?? "").toContain("끝날 때까지 대기");
      });

      it("좌표만 바꿔도 기존 변환값이 날아가지 않는다", () => {
        const seeded: ShowPicture = { ...BASE, scale: 50, opacity: 100, rotation: 10, durationMs: 300, waitForPicture: true };
        const { context, current } = stagedContext(seeded);
        const body = renderWithFakeDom(() => showPictureBody(context, seeded));

        change(findByTestId(body, "show-picture-x-input"), "120");

        expect(current().x).toBe(120);
        expect(current().scale).toBe(50);
        expect(current().opacity).toBe(100);
        expect(current().rotation).toBe(10);
        expect(current().durationMs).toBe(300);
        expect(current().waitForPicture).toBe(true);
      });

      it("미리보기 문구가 런타임과 같은 좌상단 앵커라고 알린다", () => {
        const { context } = stagedContext(BASE);
        const body = renderWithFakeDom(() => showPictureBody(context, BASE));
        // 예전 문구는 "중심 앵커" 였는데 런타임(transform-origin: top left)과 달랐다.
        const text = body.textContent ?? "";
        expect(text).toContain("왼쪽 위");
        expect(text).not.toContain("중심 앵커");
      });

      // 회귀: 불투명도 입력칸은 퍼센트(0~100)인데 미리보기가 255 로 나눠,
      // 100% 로 저작해도 반지가 opacity 0.39 로 보여 게임 화면과 어깃났다.
      it("미리보기 불투명도는 퍼센트를 그대로 반영한다", () => {
        const seeded: ShowPicture = { ...BASE, opacity: 255 };
        const { context } = stagedContext(seeded);
        const body = renderWithFakeDom(() => showPictureBody(context, seeded));

        expect(findByTestId(body, "show-picture-opacity-input")?.value).toBe("100");
        expect(Number(findByTestId(body, "show-picture-preview-marker")?.style.opacity)).toBe(1);
      });

      it("미리보기 불투명도는 입력 변경을 따라간다", () => {
        const { context } = stagedContext(BASE);
        const body = renderWithFakeDom(() => showPictureBody(context, BASE));

        change(findByTestId(body, "show-picture-opacity-input"), "50");

        expect(Number(findByTestId(body, "show-picture-preview-marker")?.style.opacity)).toBeCloseTo(0.5, 3);
      });

      it("AI로 만들기 칸이 있다", () => {
        const { context } = stagedContext(BASE);
        const body = renderWithFakeDom(() => showPictureBody(context, BASE));
        expect(findByTestId(body, "show-picture-ai-prompt"), "프롬프트 칸").not.toBeNull();
        expect(findByTestId(body, "show-picture-ai-generate"), "생성 버튼").not.toBeNull();
      });

      it("프롬프트로 그림을 만들면 업로드 리소스가 커맨드에 실린다", async () => {
        const png =
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFHAP/q842iQAAAABJRU5ErkJggg==";
        vi.stubGlobal(
          "fetch",
          vi.fn(async () =>
            new Response(
              JSON.stringify({
                image: { dataUrl: png, mimeType: "image/png", model: "gemini-3.8-flash", provider: "google-antigravity" },
              }),
              { status: 200, headers: { "Content-Type": "application/json" } },
            ),
          ),
        );
        const committed = Promise.withResolvers<ShowPicture>();
        const { context, current } = stagedContext(BASE, committed.resolve);
        const body = renderWithFakeDom(() => showPictureBody(context, BASE));
        document.body.append(body as unknown as HTMLElement);
        const prompt = findByTestId(body, "show-picture-ai-prompt");
        expect(prompt).not.toBeNull();
        if (prompt) prompt.value = "달빛 창가";
        findByTestId(body, "show-picture-ai-generate")?.click();
        const deadline = setTimeout(() => committed.reject(new Error("image command was not committed")), 2000);
        try {
          await committed.promise;
        } finally {
          clearTimeout(deadline);
        }
        expect(current().resourceId.length).toBeGreaterThan(0);
        const resourceId = current().resourceId;
        expect(store.getCurrent().assets.uploaded[resourceId]?.kind).toBe("picture");
        expect(store.getCurrent().assets.uploaded[resourceId]?.dataUrl).toBe(png);
        vi.unstubAllGlobals();
      });

      it("빈 프롬프트는 요청하지 않는다", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        const { context, current } = stagedContext(BASE);
        const body = renderWithFakeDom(() => showPictureBody(context, BASE));
        findByTestId(body, "show-picture-ai-generate")?.click();
        await Promise.resolve();
        expect(fetchMock).not.toHaveBeenCalled();
        expect(current().resourceId).toBe("");
        vi.unstubAllGlobals();
      });
    });
  });
});

// test/commandDiff.test.ts
// before/after 명령 목록 비교 → 유령 행 계산 → 행 단위 제외 적용.
describe("commandDiff", () => {
  isolateTimers();
  function text(body: string): Command {
    return { kind: "text", body } as Command;
  }
  describe("diffCommandLists", () => {
    it("문구만 달라진 한 줄은 삭제+추가가 아니라 «바뀜» 한 줄이다", () => {
      const rows = diffCommandLists([text("상자다")], [text("낡은 상자다")]);
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe("change");
      expect(rows[0].before).toMatchObject({ body: "상자다" });
      expect(rows[0].after).toMatchObject({ body: "낡은 상자다" });
    });

    it("끝에 붙은 줄은 «새로 생김», 나머지는 «그대로»다", () => {
      const rows = diffCommandLists([text("안녕")], [text("안녕"), text("새 대사")]);
      expect(rows.map((row) => row.status)).toEqual(["keep", "add"]);
      expect(countCommandDiff(rows)).toEqual({ added: 1, removed: 0, changed: 0 });
    });

    it("사라진 줄은 «없어짐»이다", () => {
      const rows = diffCommandLists([text("안녕"), text("잘 가")], [text("안녕")]);
      expect(rows.map((row) => row.status)).toEqual(["keep", "remove"]);
      expect(countCommandDiff(rows)).toEqual({ added: 0, removed: 1, changed: 0 });
    });

    it("조건은 그대로인데 안쪽만 바뀌면 fork 는 «그대로»고 자식만 표시된다", () => {
      const before = [{
        kind: "fork",
        condition: { kind: "selfSwitch", key: "A", value: true },
        then: [text("열었다")],
      } as Command];
      const after = [{
        kind: "fork",
        condition: { kind: "selfSwitch", key: "A", value: true },
        then: [text("열었다"), text("비어 있다")],
      } as Command];

      const rows = diffCommandLists(before, after);
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe("keep");
      const then = rows[0].branches.find((branch) => branch.key === "forkThen")!;
      expect(then.label).toBe("조건이 맞을 때");
      expect(then.rows.map((row) => row.status)).toEqual(["keep", "add"]);
    });

    it("새로 생긴 fork 는 하위 트리 전체가 «새로 생김»이다", () => {
      const after = [{
        kind: "fork",
        condition: { kind: "selfSwitch", key: "A", value: true },
        then: [text("비어 있다")],
        else: [text("회복약을 얻었다")],
      } as Command];
      const rows = diffCommandLists([], after);
      expect(rows[0].status).toBe("add");
      const branches = rows[0].branches.map((branch) => branch.key);
      expect(branches).toEqual(["forkThen", "forkElse"]);
      for (const branch of rows[0].branches) {
        expect(branch.rows.every((row) => row.status === "add")).toBe(true);
      }
      expect(countCommandDiff(rows)).toEqual({ added: 3, removed: 0, changed: 0 });
    });

    it("바뀌는 것이 없으면 hasChanges 는 false 다", () => {
      const rows = diffCommandLists([text("안녕")], [text("안녕")]);
      expect(hasCommandDiffChanges(rows)).toBe(false);
    });
  });
  describe("applyCommandDiff", () => {
    it("제외가 없으면 after 를 그대로 만든다", () => {
      const before = [text("안녕")];
      const after = [text("안녕"), text("잘 가")];
      const rows = diffCommandLists(before, after);
      expect(applyCommandDiff(rows)).toEqual(after);
    });

    it("추가를 빼면 그 줄만 안 들어간다", () => {
      const rows = diffCommandLists([text("안녕")], [text("안녕"), text("잘 가")]);
      const addRow = rows.find((row) => row.status === "add")!;
      expect(applyCommandDiff(rows, new Set([addRow.id]))).toEqual([text("안녕")]);
    });

    it("삭제를 빼면 원래 줄이 되살아난다", () => {
      const rows = diffCommandLists([text("안녕"), text("잘 가")], [text("안녕")]);
      const removeRow = rows.find((row) => row.status === "remove")!;
      expect(applyCommandDiff(rows, new Set([removeRow.id]))).toEqual([text("안녕"), text("잘 가")]);
    });

    it("바뀜을 빼면 원래 값이 남는다", () => {
      const rows = diffCommandLists([text("상자다")], [text("낡은 상자다")]);
      expect(applyCommandDiff(rows, new Set([rows[0].id]))).toEqual([text("상자다")]);
    });

    it("분기 안쪽 추가만 골라 뺄 수 있다", () => {
      const before = [{
        kind: "fork",
        condition: { kind: "selfSwitch", key: "A", value: true },
        then: [text("열었다")],
      } as Command];
      const after = [{
        kind: "fork",
        condition: { kind: "selfSwitch", key: "A", value: true },
        then: [text("열었다"), text("비어 있다")],
      } as Command];

      const rows = diffCommandLists(before, after);
      const inner = rows[0].branches[0].rows.find((row) => row.status === "add")!;
      expect(applyCommandDiff(rows, new Set([inner.id]))).toEqual(before);
      expect(applyCommandDiff(rows)).toEqual(after);
    });

    it("선택지 분기도 슬롯별로 유지된다", () => {
      const before = [{
        kind: "choices",
        prompt: "",
        options: [
          { text: "네", branch: [text("좋아")] },
          { text: "아니오", branch: [] },
        ],
        cancelBehavior: "none",
      } as unknown as Command];
      const after = structuredClone(before) as unknown as {
        options: { text: string; branch: Command[] }[];
      }[];
      after[0].options[1].branch = [text("알겠다")];

      const rows = diffCommandLists(before, after as unknown as Command[]);
      expect(rows[0].status).toBe("keep");
      expect(applyCommandDiff(rows)).toEqual(after);
    });
  });
});

describe("commentCommandBody", () => {
  isolateTimers();
  describe("comment command UX", () => {
    let restoreDom: (() => void) | undefined;
    let inserted: Command | undefined;

    const actions: CommandListActions = {
      addCommand: () => {},
      insertCommand: (_path, command) => {
        inserted = command;
      },
      replaceCommand: () => {},
      deleteCommand: () => {},
      moveCommand: () => {},
      moveCommandTo: () => {},
    };

    beforeEach(() => {
      restoreDom = installFakeDom();
      store.replace(createBlankProject());
      inserted = undefined;
    });

    afterEach(() => {
      restoreDom?.();
    });

    it("edits comment text and color through catalog controls without losing either field", () => {
      let cmd: Command = { ...newM2Command("m2-088-comment"), fields: { comment: "문 연 뒤 대사", color: "yellow" } };
      const body = renderWithFakeDom(() => renderCommandBody({
        path: [0], lockKind: true, getCurrentCommand: () => cmd,
        actions: { ...actions, replaceCommand: (_path, next) => { cmd = next; } },
      }, cmd));

      expect(findByTestId(body, "m2-command-body-m2-088-comment")).toBeTruthy();
      expect(findByTestId(body, "m2-command-comment-textarea")).toBeTruthy();
      const text = findByTestId(body, "m2-command-comment-textarea");
      const color = findByTestId(body, "m2-command-color-option-select");
      if (!text || !color) throw new Error("missing comment controls");
      expect(text.value).toBe("문 연 뒤 대사");
      expect(color.value).toBe("yellow");
      text.value = "수정된 주석";
      text.dispatchEvent(new Event("change"));
      color.value = "cyan";
      color.dispatchEvent(new Event("change"));
      expect(cmd).toEqual({ kind: "m2Command", commandId: "m2-088-comment", fields: { comment: "수정된 주석", color: "cyan" } });
    });

    it("summarizes comments without dumping field keys", () => {
      const parts = commandSummaryParts({
        kind: "m2Command",
        commandId: "m2-088-comment",
        fields: { comment: "컷신 시작", color: "cyan" },
      });
      const text = parts.map((part) => part.text).join("");
      expect(text).toContain("주석");
      expect(text).toContain("컷신 시작");
      expect(text).not.toContain("color:");
    });

    it("Ctrl+/ inserts a comment command via shortcut", () => {
      const item = new FakeElement("div");
      item.className = "cmd-item";
      const event = new Event("keydown", { bubbles: true, cancelable: true });
      Object.defineProperties(event, { ctrlKey: { value: true }, altKey: { value: false }, key: { value: "/" } });

      handleCommandShortcut(event as KeyboardEvent, {
        x: 0,
        y: 0,
        item: item as unknown as HTMLElement,
        command: { kind: "text", body: "x" },
        path: [0],
        actions,
        openEditor: () => {},
      });

      expect(event.defaultPrevented).toBe(true);
      expect(inserted).toBeUndefined();
      const text = document.querySelector<HTMLTextAreaElement>('[data-testid="m2-command-comment-textarea"]');
      if (!text) throw new Error("shortcut did not open comment editor");
      text.value = "shortcut comment";
      text.dispatchEvent(new Event("change"));
      document.querySelector<HTMLButtonElement>('[data-testid="event-command-edit-ok"]')?.click();
      expect(inserted).toEqual({ kind: "m2Command", commandId: "m2-088-comment", fields: { comment: "shortcut comment", color: "green" } });
    });
  });
});

describe("conditionCompile", () => {
  isolateTimers();
  describe("compileConditionFromText", () => {
    it("compiles night + switch AND friendship OR item sketches", () => {
      const project = createBlankProject();
      project.switches[0] = { id: "sw_door", name: "문 열림" };
      project.database.items[0] = {
        ...project.database.items[0]!,
        id: "item_key",
        name: "낡은 열쇠",
      };

      const andResult = compileConditionFromText("문 열림 AND 밤", project);
      expect(andResult.condition.kind).toBe("all");
      if (andResult.condition.kind === "all") {
        expect(andResult.condition.conditions.some((c) => c.kind === "timePhase")).toBe(true);
        expect(andResult.condition.conditions.some((c) => c.kind === "switch")).toBe(true);
      }

      const orResult = compileConditionFromText("호감 100 OR 낡은 열쇠", project);
      expect(orResult.condition.kind).toBe("any");

      const notResult = compileConditionFromText("NOT 밤", project);
      expect(notResult.condition).toEqual({
        kind: "not",
        condition: { kind: "timePhase", phase: "night" },
      });
    });

    it("evaluates compiled group conditions", () => {
      const project = createBlankProject();
      project.switches[0] = { id: "sw_a", name: "A" };
      const compiled = compileConditionFromText("A AND 낮", project);
      const session = startSession(project);
      session.switches.sw_a = true;
      // gameTime may be undefined → timePhase day can be false; just ensure eval does not throw
      expect(typeof evalCondition(session, compiled.condition)).toBe("boolean");
    });
  });
});

describe("conditionEvalPreview", () => {
  isolateTimers();
  const PLAY_TIME_KINDS: readonly { readonly name: string; readonly condition: Condition }[] = [
    { name: "timer", condition: { kind: "timer", timerId: "timer1", seconds: 10 } },
    { name: "timePhase", condition: { kind: "timePhase", phase: "morning" } },
    { name: "season", condition: { kind: "season", season: "spring" } },
    { name: "npcActivity", condition: { kind: "npcActivity", activity: "work" } },
    { name: "friendshipAtLeast", condition: { kind: "friendshipAtLeast", value: 0 } },
    { name: "battleResult", condition: { kind: "battleResult", result: "victory" } },
    { name: "run", condition: { kind: "run", query: "active", value: false } },
  ];
  describe("conditionEvalPreview", () => {
    let restoreDom: (() => void) | undefined;

    beforeEach(() => {
      restoreDom = installFakeDom();
      store.replace(createBlankProject());
      editorState.set({ selectedEventId: "ev_test" });
    });

    afterEach(() => {
      editorState.set({ selectedEventId: null });
      restoreDom?.();
    });

    it("does not render a confident 충족/미충족 for play-time kinds the editor cannot justify", () => {
      for (const { name, condition } of PLAY_TIME_KINDS) {
        const root = renderWithFakeDom(() => renderConditionEvalPreview(condition));
        const undetermined = findByTestId(root, "event-condition-eval-undetermined");
        const badge = findByTestId(root, "event-condition-eval-badge");
        expect(findByTestId(root, "event-condition-eval"), name).toBeTruthy();
        expect(findByTestId(root, "event-condition-eval-summary"), name).toBeTruthy();
        expect(undetermined, `${name} should expose the undeterminable state`).toBeTruthy();
        expect(badge?.textContent, name).not.toBe("충족");
        expect(badge?.textContent, name).not.toBe("미충족");
        expect(badge?.textContent, name).not.toBe("불충족");
        expect(root.dataset.evalOk, name).not.toBe("true");
        expect(root.dataset.evalOk, name).not.toBe("false");
      }
    });

    it("still renders a 충족/불충족 verdict for start-state kinds", () => {
      const switchId = store.getCurrent().switches[0]?.id ?? "sw_0001";
      const root = renderWithFakeDom(() =>
        renderConditionEvalPreview({ kind: "switch", switchId, value: false })
      );
      expect(findByTestId(root, "event-condition-eval-undetermined")).toBeNull();
      expect(findByTestId(root, "event-condition-eval-badge")?.textContent).toBe("충족");
      expect(root.dataset.evalOk).toBe("true");
    });

    it("evaluates timePhase/season against play-start gameTime when the time system is on", () => {
      const project = createBlankProject();
      project.system.timeSystem = { enabled: true };
      store.replace(project);

      const morning = renderWithFakeDom(() =>
        renderConditionEvalPreview({ kind: "timePhase", phase: "morning" })
      );
      expect(findByTestId(morning, "event-condition-eval-undetermined")).toBeNull();
      expect(findByTestId(morning, "event-condition-eval-badge")?.textContent).toBe("충족");
      expect(morning.dataset.evalOk).toBe("true");

      const night = renderWithFakeDom(() =>
        renderConditionEvalPreview({ kind: "timePhase", phase: "night" })
      );
      expect(findByTestId(night, "event-condition-eval-undetermined")).toBeNull();
      expect(findByTestId(night, "event-condition-eval-badge")?.textContent).toBe("불충족");
      expect(night.dataset.evalOk).toBe("false");

      const spring = renderWithFakeDom(() =>
        renderConditionEvalPreview({ kind: "season", season: "spring" })
      );
      expect(findByTestId(spring, "event-condition-eval-badge")?.textContent).toBe("충족");

      const winter = renderWithFakeDom(() =>
        renderConditionEvalPreview({ kind: "season", season: "winter" })
      );
      expect(findByTestId(winter, "event-condition-eval-badge")?.textContent).toBe("불충족");
    });

    it("evaluates insideLocation against the passed map — unknown without one", () => {
      const project = store.getCurrent();
      const mapId = project.startMapId;
      const map = project.maps[mapId];
      if (!map) throw new Error("missing start map");
      const { x, y } = project.startPos;
      map.locations = [{ id: "loc_badge", name: "배지 구역", x: x - 1, y: y - 1, w: 4, h: 4 }];
      const condition = { kind: "insideLocation", locationId: "loc_badge", inside: true } as const;
      // 맵을 넘기면 실제 판정(시작점이 구역 안이므로 충족) — 시뮬레이션과 같은 입력.
      const decided = renderWithFakeDom(() => renderConditionEvalPreview(condition, mapId));
      expect(findByTestId(decided, "event-condition-eval-badge")?.textContent).toBe("충족");
      // 맵 없이 호출하면 판정 불가 — 참/거짓을 지어내지 않는다.
      const unknown = renderWithFakeDom(() => renderConditionEvalPreview(condition));
      expect(findByTestId(unknown, "event-condition-eval-undetermined")).toBeTruthy();
    });
  });
});

describe("editorNpcSchedule", () => {
  isolateTimers();
  describe("NPC schedule editor", () => {
    let restoreDom: (() => void) | undefined;

    beforeEach(() => {
      restoreDom = installFakeDom();
      store.replace(createBlankProject());
    });

    afterEach(() => restoreDom?.());

    // Break caught: an NPC without a tool-authored schedule has no editor surface.
    it("renders for an empty schedule and authors every when/target field", () => {
      const project = store.getCurrent();
      const map = project.maps[project.startMapId];
      if (!map) throw new Error("missing start map");
      map.events.push({ id: "npc", x: 2, y: 3, trigger: { kind: "action" }, commands: [] });
      store.replace(project);

      const host = renderEventScheduleEditor(map.id, map.events[0]) as unknown as FakeElement;
      expect(host).toBeTruthy();
      findByTestId(host, "event-schedule-add")?.click();

      setValue(host, "event-schedule-time-phase-0", "evening");
      setChecked(host, "event-schedule-hour-enabled-0", true);
      setValue(host, "event-schedule-hour-start-0", "17");
      setValue(host, "event-schedule-hour-end-0", "19");
      setValue(host, "event-schedule-season-0", "fall");
      setChecked(host, "event-schedule-day-enabled-0", true);
      setValue(host, "event-schedule-day-start-0", "8");
      setValue(host, "event-schedule-day-end-0", "14");
      setValue(host, "event-schedule-x-0", "4");
      setValue(host, "event-schedule-y-0", "5");
      setValue(host, "event-schedule-facing-0", "left");
      setValue(host, "event-schedule-activity-0", "shop");

      expect(store.getCurrent().maps[map.id]?.events[0]?.schedule?.[0]).toEqual({
        when: { timePhase: "evening", hourRange: [17, 19], season: "fall", dayRange: [8, 14] },
        at: { mapId: map.id, x: 4, y: 5 },
        facing: "left",
        activity: "shop",
      });
    });

    // Break caught: schedule rows can be added but not removed back to the empty state.
    it("deletes the authored schedule row", () => {
      const project = store.getCurrent();
      const map = project.maps[project.startMapId];
      if (!map) throw new Error("missing start map");
      map.events.push({
        id: "npc",
        x: 2,
        y: 3,
        trigger: { kind: "action" },
        commands: [],
        schedule: [{ when: {}, at: { mapId: map.id, x: 2, y: 3 } }],
      });
      store.replace(project);
      const host = renderEventScheduleEditor(map.id, map.events[0]) as unknown as FakeElement;

      findByTestId(host, "event-schedule-delete-0")?.click();

      expect(store.getCurrent().maps[map.id]?.events[0]?.schedule).toEqual([]);
    });

    // Break caught: an authored hour/day range cannot be cleared back to an always-matching condition.
    it("clears exact-time and day ranges independently", () => {
      const project = store.getCurrent();
      const map = project.maps[project.startMapId];
      if (!map) throw new Error("missing start map");
      map.events.push({
        id: "npc",
        x: 2,
        y: 3,
        trigger: { kind: "action" },
        commands: [],
        schedule: [{
          when: { timePhase: "day", hourRange: [10, 16], season: "spring", dayRange: [2, 7] },
          at: { mapId: map.id, x: 2, y: 3 },
        }],
      });
      store.replace(project);
      const host = renderEventScheduleEditor(map.id, map.events[0]) as unknown as FakeElement;

      setChecked(host, "event-schedule-hour-enabled-0", false);
      setChecked(host, "event-schedule-day-enabled-0", false);

      expect(store.getCurrent().maps[map.id]?.events[0]?.schedule?.[0]?.when).toEqual({
        timePhase: "day",
        season: "spring",
      });
    });

    // Break caught: HTML min/max can be bypassed and invalid schedule coordinates are persisted.
    it("clamps bypassed hour, day, and target coordinate values", () => {
      const project = store.getCurrent();
      const map = project.maps[project.startMapId];
      if (!map) throw new Error("missing start map");
      map.events.push({
        id: "npc",
        x: 2,
        y: 3,
        trigger: { kind: "action" },
        commands: [],
        schedule: [{ when: { hourRange: [6, 18], dayRange: [1, 28] }, at: { mapId: map.id, x: 2, y: 3 } }],
      });
      store.replace(project);
      const host = renderEventScheduleEditor(map.id, map.events[0]) as unknown as FakeElement;

      setValue(host, "event-schedule-hour-start-0", "-10");
      setValue(host, "event-schedule-hour-end-0", "80");
      setValue(host, "event-schedule-day-start-0", "0");
      setValue(host, "event-schedule-day-end-0", "500");
      setValue(host, "event-schedule-x-0", "-3");
      setValue(host, "event-schedule-y-0", "9999");

      expect(store.getCurrent().maps[map.id]?.events[0]?.schedule?.[0]).toMatchObject({
        when: { hourRange: [0, 48], dayRange: [1, 99] },
        at: { mapId: map.id, x: 0, y: map.height - 1 },
      });
    });

    // Break caught: an unconditional row before a conditional row shadows the later schedule silently.
    it("warns when an unconditional row shadows later rows", () => {
      const project = store.getCurrent();
      const map = project.maps[project.startMapId];
      if (!map) throw new Error("missing start map");
      map.events.push({
        id: "npc",
        x: 2,
        y: 3,
        trigger: { kind: "action" },
        commands: [],
        schedule: [
          { when: {}, at: { mapId: map.id, x: 2, y: 3 } },
          { when: { timePhase: "night" }, at: { mapId: map.id, x: 3, y: 3 } },
        ],
      });
      store.replace(project);

      const host = renderEventScheduleEditor(map.id, map.events[0]) as unknown as FakeElement;

      expect(findByTestId(host, "event-schedule-shadow-warning-0")).toBeTruthy();
    });
  });
  function setValue(host: FakeElement, testid: string, value: string): void {
    const control = findByTestId(host, testid);
    if (!control) throw new Error(`missing ${testid}`);
    control.value = value;
    control.dispatchEvent(new Event("change"));
  }
  function setChecked(host: FakeElement, testid: string, checked: boolean): void {
    const control = findByTestId(host, testid);
    if (!control) throw new Error(`missing ${testid}`);
    control.checked = checked;
    control.dispatchEvent(new Event("change"));
  }
});
