/**
 * showAnimation 명령 본문의 애니메이션 표시면 계약.
 *
 * 1) 미리보기 스테이지는 글리프가 아니라 선택 레코드의 시트 프레임을 실제로 재생한다.
 * 2) 한 본문에 애니메이션 표시면은 하나뿐이다(intentCard + fieldBlock 중복 제거).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { showAnimationBody } from "@/editor/panels/eventEditor/commandBodyPage3Native";
import {
  SHOW_ANIMATION_FRAME_MS,
  playShowAnimation,
  playShowAnimationOnce,
  renderShowAnimationFrame,
  showAnimationPlaybackSource,
} from "@/editor/panels/eventEditor/showAnimationPlayback";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { BattleAnimationRecord, Command, Project } from "@/project/types";
import type { CommandEditContext } from "@/editor/panels/eventEditor/types";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

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
    const stage = new FakeElement("div") as unknown as HTMLElement;
    const layer = new FakeElement("div") as unknown as HTMLElement;

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
    const stage = new FakeElement("div") as unknown as HTMLElement;
    const layer = new FakeElement("div") as unknown as HTMLElement;
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
    const stage = new FakeElement("div") as unknown as HTMLElement;
    const layer = new FakeElement("div") as unknown as HTMLElement;
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
