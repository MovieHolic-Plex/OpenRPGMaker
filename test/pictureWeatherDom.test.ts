import { EventEmitter } from "node:events";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { RuntimeDomOverlay } from "@/player/runtimeDom";
import { runCommands } from "@/player/playSceneInterpreter";
import { CUTSCENE_END_LABEL } from "@/player/cutsceneControl";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { store } from "@/project/store";
import type { Command, Project } from "@/project/types";
import { runTransitionPhase } from "@/player/transitions/transitionOverlay";
import { showPictureState } from "@/project/session";
import { createSaveSnapshot, applySaveSnapshot, readSaveSlot, saveToSlot } from "@/player/saveSlots";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { FakeElement, installFakeDom, findByTestId, flushFakeAnimationFrames } from "./fakeDom";
import type { PictureState } from "@/project/session";

// 속성 선택자([data-testid=...])를 dataset 기반으로 지원하는 테스트 host.
class TestHost extends FakeElement {
  constructor() {
    super("div");
  }
  override querySelector(selector: string): FakeElement | null {
    const match = selector.match(/data-testid=['"]([^'"]+)['"]/);
    if (match) return findByTestId(this, match[1]!) ?? null;
    return super.querySelector(selector);
  }
}

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

let restore: (() => void) | null = null;

beforeEach(() => {
  restore = installFakeDom();
});

afterEach(() => {
  restore?.();
  restore = null;
});

function pic(partial: Partial<PictureState>): PictureState {
  return { pictureId: "pic1", resourceId: "res", x: 0, y: 0, ...partial };
}

// FakeElement 기반 TestHost 를 HTMLElement 파라미터에 전달하기 위한 캐스트.
function asHost(host: TestHost): HTMLElement {
  return host as unknown as HTMLElement;
}

describe("syncPictureLayer — 실 이미지 렌더", () => {
  it("해석되는 리소스는 <img>, 미해석 리소스는 텍스트 라벨로 폴백", () => {
    const host = new TestHost();
    const overlay = new RuntimeDomOverlay(() => asHost(host));

    overlay.syncPictureLayer({
      pic1: pic({ pictureId: "pic1", resourceId: "hero", x: 10, y: 20 }),
      bg: pic({ pictureId: "bg", resourceId: "no-such-resource", x: 0, y: 0 }),
    });

    const imageSlot = findByTestId(host, "picture-pic1");
    expect(imageSlot).not.toBeNull();
    expect(imageSlot!.dataset.render).toBe("image");
    expect(imageSlot!.childNodes.some((child) => child instanceof FakeElement && child.tagName === "IMG")).toBe(true);
    // 위치는 left/top 로 즉시 적용(트윈 없음).
    expect(imageSlot!.style.left).toBe("10px");
    expect(imageSlot!.style.top).toBe("20px");

    const labelSlot = findByTestId(host, "picture-bg");
    expect(labelSlot!.dataset.render).toBe("label");
    expect(labelSlot!.textContent.length).toBeGreaterThan(0);
  });

  it("z-order 는 픽처 번호를 따른다", () => {
    const host = new TestHost();
    const overlay = new RuntimeDomOverlay(() => asHost(host));
    overlay.syncPictureLayer({
      pic1: pic({ pictureId: "pic1", resourceId: "hero" }),
      pic5: pic({ pictureId: "pic5", resourceId: "hero" }),
    });
    expect(findByTestId(host, "picture-pic1")!.style.zIndex).toBe("21");
    expect(findByTestId(host, "picture-pic5")!.style.zIndex).toBe("25");
  });

  it("사라진 픽처 슬롯은 제거된다", () => {
    const host = new TestHost();
    const overlay = new RuntimeDomOverlay(() => asHost(host));
    overlay.syncPictureLayer({ pic1: pic({ pictureId: "pic1", resourceId: "hero" }) });
    expect(findByTestId(host, "picture-pic1")).not.toBeNull();
    overlay.syncPictureLayer({});
    expect(findByTestId(host, "picture-pic1")).toBeNull();
  });

  it("durationMs=0 이면 scale/opacity 를 즉시 적용", () => {
    const host = new TestHost();
    const overlay = new RuntimeDomOverlay(() => asHost(host));
    overlay.syncPictureLayer({ pic1: pic({ pictureId: "pic1", resourceId: "hero", scale: 200, opacity: 128 }) });
    const slot = findByTestId(host, "picture-pic1")!;
    expect(slot.style.transform).toContain("scale(2)");
    expect(Number(slot.style.opacity)).toBeCloseTo(0.502, 2);
  });
});

// 회귀: 첫 표시에 전환 시간이 있으면 두 분기(트윈 시작 / 즉시 적용) 모두 스킵되어
// applyPictureTransform 이 한 번도 불리지 않았다. 픽처가 위치·확대·불투명도 없이
// 기본 자리(left/top 미설정)에 떴다.
describe("syncPictureLayer — 첫 표시 + 전환 시간(페이드인)", () => {
  it("첫 표시에 durationMs 가 있어도 위치·확대는 즉시 적용된다", () => {
    const host = new TestHost();
    const overlay = new RuntimeDomOverlay(() => asHost(host));
    const session = startSession(createBlankProject());
    showPictureState(session, pic({ pictureId: "pic1", resourceId: "hero", x: 48, y: 72, scale: 150, durationMs: 300 }));

    overlay.syncPictureLayer(session.pictures);

    const slot = findByTestId(host, "picture-pic1")!;
    // 버그 시절에는 left/top/transform 이 전부 빈 문자열이었다.
    expect(slot.style.left).toBe("48px");
    expect(slot.style.top).toBe("72px");
    expect(slot.style.transform).toContain("scale(1.5)");
  });

  it("rAF 미지원 환경에서는 페이드인을 생략하고 목표 상태로 확정한다", () => {
    const host = new TestHost();
    const overlay = new RuntimeDomOverlay(() => asHost(host));
    const session = startSession(createBlankProject());
    showPictureState(session, pic({ pictureId: "pic1", resourceId: "hero", opacity: 255, durationMs: 300 }));

    overlay.syncPictureLayer(session.pictures);

    // 페이드인 시작값(0)에서 멈추면 픽처가 영구히 보이지 않는다.
    expect(Number(findByTestId(host, "picture-pic1")!.style.opacity)).toBe(1);
  });

  it("프레임마다 같은 상태를 동기화해도 페이드인이 목표 불투명도까지 완료된다", () => {
    restore?.();
    restore = installFakeDom({ animationFrames: "manual" });
    let clock = 0;
    const host = new TestHost();
    const overlay = new RuntimeDomOverlay(() => asHost(host), { pictureNow: () => clock });
    const session = startSession(createBlankProject());
    showPictureState(session, pic({ pictureId: "pic1", resourceId: "hero", opacity: 255, durationMs: 1000 }));

    overlay.syncPictureLayer(session.pictures);
    expect(Number(findByTestId(host, "picture-pic1")!.style.opacity)).toBe(0);

    const opacities = [0];
    for (clock = 100; clock <= 1000; clock += 100) {
      flushFakeAnimationFrames(0, 1);
      overlay.syncPictureLayer(session.pictures);
      opacities.push(Number(findByTestId(host, "picture-pic1")!.style.opacity));
    }

    expect(opacities).toEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]);
  });

  it("진행 중 새 Move Picture 목표는 현재 표시값에서 새 트윈을 시작한다", () => {
    restore?.();
    restore = installFakeDom({ animationFrames: "manual" });
    let clock = 0;
    const host = new TestHost();
    const overlay = new RuntimeDomOverlay(() => asHost(host), { pictureNow: () => clock });
    const session = startSession(createBlankProject());
    showPictureState(session, pic({ pictureId: "pic1", resourceId: "hero", x: 100, durationMs: 1000 }));
    overlay.syncPictureLayer(session.pictures);

    clock = 500;
    flushFakeAnimationFrames(0, 1);
    expect(Number(findByTestId(host, "picture-pic1")!.style.opacity)).toBeCloseTo(0.5, 3);
    showPictureState(session, pic({ pictureId: "pic1", resourceId: "hero", x: 200, durationMs: 1000 }));
    overlay.syncPictureLayer(session.pictures);

    clock = 1000;
    flushFakeAnimationFrames(0, 1);
    expect(findByTestId(host, "picture-pic1")!.style.left).toBe("150px");
    expect(Number(findByTestId(host, "picture-pic1")!.style.opacity)).toBeCloseTo(0.75, 3);
  });

  it("settled slot의 새 Move Picture 목표도 duration 동안 트윈한다", () => {
    restore?.();
    restore = installFakeDom({ animationFrames: "manual" });
    let clock = 0;
    const host = new TestHost();
    const overlay = new RuntimeDomOverlay(() => asHost(host), { pictureNow: () => clock });
    const session = startSession(createBlankProject());
    showPictureState(session, pic({ pictureId: "pic1", resourceId: "hero", x: 10 }));
    overlay.syncPictureLayer(session.pictures);
    showPictureState(session, pic({ pictureId: "pic1", resourceId: "hero", x: 210, durationMs: 1000 }));
    overlay.syncPictureLayer(session.pictures);

    clock = 500;
    flushFakeAnimationFrames(0, 1);

    expect(findByTestId(host, "picture-pic1")!.style.left).toBe("110px");
  });

  it("durationMs<=0 인 새 목표는 즉시 적용한다", () => {
    restore?.();
    restore = installFakeDom({ animationFrames: "manual" });
    let clock = 0;
    const host = new TestHost();
    const overlay = new RuntimeDomOverlay(() => asHost(host), { pictureNow: () => clock });
    const session = startSession(createBlankProject());
    showPictureState(session, pic({ pictureId: "pic1", resourceId: "hero", x: 10 }));
    overlay.syncPictureLayer(session.pictures);

    showPictureState(session, pic({ pictureId: "pic1", resourceId: "hero", x: 210, opacity: 128, durationMs: 0 }));
    overlay.syncPictureLayer(session.pictures);

    expect(findByTestId(host, "picture-pic1")!.style.left).toBe("210px");
    expect(Number(findByTestId(host, "picture-pic1")!.style.opacity)).toBeCloseTo(128 / 255, 3);
    clock = 500;
    flushFakeAnimationFrames(0, 1);
    expect(findByTestId(host, "picture-pic1")!.style.left).toBe("210px");
  });

  it("두 픽처의 Move Picture 트윈은 서로 간섭하지 않는다", () => {
    restore?.();
    restore = installFakeDom({ animationFrames: "manual" });
    let clock = 0;
    const host = new TestHost();
    const overlay = new RuntimeDomOverlay(() => asHost(host), { pictureNow: () => clock });
    const session = startSession(createBlankProject());
    showPictureState(session, pic({ pictureId: "pic1", resourceId: "hero", x: 0 }));
    showPictureState(session, pic({ pictureId: "pic2", resourceId: "hero", x: 20 }));
    overlay.syncPictureLayer(session.pictures);

    showPictureState(session, pic({ pictureId: "pic1", resourceId: "hero", x: 100, durationMs: 1000 }));
    showPictureState(session, pic({ pictureId: "pic2", resourceId: "hero", x: 220, durationMs: 1000 }));
    overlay.syncPictureLayer(session.pictures);
    clock = 500;
    flushFakeAnimationFrames(0, 1);

    expect(findByTestId(host, "picture-pic1")!.style.left).toBe("50px");
    expect(findByTestId(host, "picture-pic2")!.style.left).toBe("120px");
  });

  it("프레임마다 바뀌는 목표는 표시값에서 재시작하고 마지막 목표에 수렴한다", () => {
    restore?.();
    restore = installFakeDom({ animationFrames: "manual" });
    let clock = 0;
    const host = new TestHost();
    const overlay = new RuntimeDomOverlay(() => asHost(host), { pictureNow: () => clock });
    const session = startSession(createBlankProject());
    showPictureState(session, pic({ pictureId: "pic1", resourceId: "hero", x: 0 }));
    overlay.syncPictureLayer(session.pictures);

    const displayed: number[] = [];
    for (const target of [100, 200, 300, 400, 500]) {
      clock += 100;
      flushFakeAnimationFrames(0, 1);
      displayed.push(Number.parseFloat(findByTestId(host, "picture-pic1")!.style.left));
      showPictureState(session, pic({ pictureId: "pic1", resourceId: "hero", x: target, durationMs: 1000 }));
      overlay.syncPictureLayer(session.pictures);
    }

    expect(displayed).toHaveLength(5);
    [0, 10, 29, 56.1, 90.49].forEach((expected, index) => {
      expect(displayed[index]).toBeCloseTo(expected, 6);
    });
    expect(Number.parseFloat(findByTestId(host, "picture-pic1")!.style.left)).toBeCloseTo(90.49, 6);
    clock += 1000;
    flushFakeAnimationFrames(0, 1);
    expect(findByTestId(host, "picture-pic1")!.style.left).toBe("500px");
  });

  it("Move 완료 후 같은 세션의 새 overlay는 stale fade 없이 목표를 즉시 표시한다", () => {
    restore?.();
    restore = installFakeDom({ animationFrames: "manual" });
    let clock = 0;
    const session = startSession(createBlankProject());
    const firstHost = new TestHost();
    const firstOverlay = new RuntimeDomOverlay(() => asHost(firstHost), { pictureNow: () => clock });
    showPictureState(session, pic({ pictureId: "pic1", resourceId: "hero", x: 0 }));
    firstOverlay.syncPictureLayer(session.pictures);
    showPictureState(session, pic({ pictureId: "pic1", resourceId: "hero", x: 100, opacity: 255, durationMs: 1000 }));
    firstOverlay.syncPictureLayer(session.pictures);

    clock = 500;
    flushFakeAnimationFrames(0, 1);
    expect(findByTestId(firstHost, "picture-pic1")!.style.left).toBe("50px");

    const remountedHost = new TestHost();
    const remountedOverlay = new RuntimeDomOverlay(() => asHost(remountedHost), { pictureNow: () => clock });
    remountedOverlay.syncPictureLayer(session.pictures);

    expect(findByTestId(remountedHost, "picture-pic1")!.style.left).toBe("100px");
    expect(Number(findByTestId(remountedHost, "picture-pic1")!.style.opacity)).toBe(1);
  });

  it("applySession 형태의 인게임 로드는 기존 slot에 저장 변환을 즉시 적용한다", () => {
    restore?.();
    restore = installFakeDom({ animationFrames: "manual" });
    let clock = 0;
    const project = createBlankProject();
    const liveSession = startSession(project);
    const host = new TestHost();
    const overlay = new RuntimeDomOverlay(() => asHost(host), { pictureNow: () => clock });
    showPictureState(liveSession, pic({ pictureId: "pic1", resourceId: "hero", x: 0, opacity: 255 }));
    overlay.syncPictureLayer(liveSession.pictures);

    const savedSession = startSession(project);
    savedSession.pictures.pic1 = pic({ pictureId: "pic1", resourceId: "hero", x: 100, opacity: 200, durationMs: 1000 });
    const storage = new MemoryStorage();
    expect(saveToSlot(storage, 1, createSaveSnapshot(project, savedSession))).toEqual({ ok: true });
    const saved = readSaveSlot(storage, 1);
    expect(saved.kind).toBe("present");
    if (saved.kind !== "present") throw new Error("expected present save slot");
    const restored = applySaveSnapshot(project, saved.snapshot);

    overlay.syncPictureLayer(restored.pictures);

    expect(findByTestId(host, "picture-pic1")!.style.left).toBe("100px");
    expect(Number(findByTestId(host, "picture-pic1")!.style.opacity)).toBeCloseTo(200 / 255, 3);
    clock = 500;
    flushFakeAnimationFrames(0, 1);
    expect(findByTestId(host, "picture-pic1")!.style.left).toBe("100px");
    expect(Number(findByTestId(host, "picture-pic1")!.style.opacity)).toBeCloseTo(200 / 255, 3);
  });

  it("세이브를 storage 왕복해 복원한 픽처는 authored opacity로 즉시 표시된다", () => {
    restore?.();
    restore = installFakeDom({ animationFrames: "manual" });
    const project = createBlankProject();
    const session = startSession(project);
    showPictureState(session, pic({ pictureId: "pic1", resourceId: "hero", opacity: 200, durationMs: 1000 }));
    const storage = new MemoryStorage();
    expect(saveToSlot(storage, 1, createSaveSnapshot(project, session))).toEqual({ ok: true });
    const saved = readSaveSlot(storage, 1);
    expect(saved.kind).toBe("present");
    if (saved.kind !== "present") throw new Error("expected present save slot");
    const restored = applySaveSnapshot(project, saved.snapshot);
    const host = new TestHost();
    const overlay = new RuntimeDomOverlay(() => asHost(host), { pictureNow: () => 0 });

    overlay.syncPictureLayer(restored.pictures);

    expect(Number(findByTestId(host, "picture-pic1")!.style.opacity)).toBeCloseTo(200 / 255, 3);
  });

  it("이미 떠 있는 픽처의 이동은 현재 상태에서 트윈한다(0 으로 리셋하지 않는다)", () => {
    const host = new TestHost();
    const overlay = new RuntimeDomOverlay(() => asHost(host));
    const session = startSession(createBlankProject());

    showPictureState(session, pic({ pictureId: "pic1", resourceId: "hero", x: 10, y: 10 }));
    overlay.syncPictureLayer(session.pictures);
    expect(Number(findByTestId(host, "picture-pic1")!.style.opacity)).toBe(1);

    showPictureState(session, pic({ pictureId: "pic1", resourceId: "hero", x: 200, y: 10, durationMs: 300 }));
    overlay.syncPictureLayer(session.pictures);

    expect(Number(findByTestId(host, "picture-pic1")!.style.opacity)).toBe(1);
  });
});


describe("runTransitionPhase — 모자이크/블라인드 오버레이", () => {
  it("rAF 미지원 환경에서 out 단계는 오버레이를 남기고 최종 프레임 적용", async () => {
    const host = new TestHost();
    await runTransitionPhase(asHost(host), "mosaic", "out", 500);
    const overlay = findByTestId(host, "runtime-transition-overlay")!;
    expect(overlay.dataset.kind).toBe("mosaic");
    expect(Number(overlay.style.opacity)).toBe(1); // out 최종 = 완전 덮힘
  });

  it("blinds in 단계는 완료 후 오버레이를 제거", async () => {
    const host = new TestHost();
    await runTransitionPhase(asHost(host), "blinds", "in", 500);
    expect(findByTestId(host, "runtime-transition-overlay")).toBeNull();
  });
});

describe("G3-F10 renderer/interpreter completion and cancellation", () => {
  const SENTINEL = "u04-after-picture";
  const SKIPPED = "u04-skip-completed";
  const command = (waitForPicture: boolean | undefined, durationMs = 500): Extract<Command, { kind: "showPicture" }> => ({
    kind: "showPicture", pictureId: "pic1", resourceId: "hero", x: 10, y: 20,
    scale: 50, opacity: 128, rotation: 15, durationMs,
    ...(waitForPicture === undefined ? {} : { waitForPicture }),
  });
  const after: Command = { kind: "setSwitch", switchId: SENTINEL, value: true };
  let previousProject: Project;

  beforeEach(() => {
    restore?.();
    restore = installFakeDom({ animationFrames: "manual" });
    previousProject = store.getCurrent();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    vi.stubGlobal("window", globalThis);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    store.replace(previousProject);
  });

  function fixture() {
    const project = createBlankProject();
    store.replace(project);
    const session = startSession(project, 4);
    session.switches[SENTINEL] = false;
    session.switches[SKIPPED] = false;
    session.pictures.other = pic({ pictureId: "other", x: 77, y: 9, opacity: 255 });
    const host = new TestHost();
    let clock = 0;
    const overlay = new RuntimeDomOverlay(() => asHost(host), { pictureNow: () => clock });
    const events = new EventEmitter();
    const dialogue = {
      close: vi.fn(), hide: vi.fn(), showText: vi.fn(async () => undefined),
      showChoices: vi.fn(async () => 0), showNumberInput: vi.fn(async () => 0),
    };
    const scene = {
      session, runtimeDom: overlay, events, running: false, inputEnabled: true,
      map: { height: 8 }, tileY: 3, eventPositions: {},
      game: { registry: { get: (key: string) => key === "dialogue" ? dialogue : undefined } },
      setInputEnabled: vi.fn((value: boolean) => { scene.inputEnabled = value; }),
      syncRuntimeState: vi.fn(() => overlay.syncPictureLayer(scene.session.pictures)),
      refreshRuntimeSurfaces: vi.fn(() => overlay.syncPictureLayer(scene.session.pictures)),
      showRuntimeOverlay: vi.fn(), clearRuntimeOverlay: vi.fn(),
    } as unknown as PlaySceneContext;
    return { project, session, host, overlay, events, dialogue, scene,
      frame(at: number) { clock = at; flushFakeAnimationFrames(0, 1); },
      opacity: () => Number(findByTestId(host, "picture-pic1")!.style.opacity),
    };
  }

  it("elapsed duration without the final rendered update cannot release the command", async () => {
    const f = fixture();
    const finished = vi.fn();
    const running = runCommands(f.scene, [command(true), after]);
    void running.then(finished);
    expect(f.opacity()).toBe(0);
    // Timer time advances, but the renderer receives no frame. This reproduces
    // the real browser race without depending on scheduling luck or an epsilon.
    await vi.advanceTimersByTimeAsync(500);
    expect.soft(f.session.switches[SENTINEL]).toBe(false);
    expect.soft(finished).not.toHaveBeenCalled();
    expect(f.opacity()).toBe(0);
    const completed = f.overlay.waitForPicture("pic1");
    f.frame(499);
    await vi.advanceTimersByTimeAsync(0);
    expect(f.opacity()).toBe(0.501);
    expect(f.session.switches[SENTINEL]).toBe(false);
    expect(finished).not.toHaveBeenCalled();
    f.frame(500);
    expect(await completed).toBe("completed");
    await running;
    expect(f.opacity()).toBe(0.502);
    expect(f.session.switches[SENTINEL]).toBe(true);
    expect(findByTestId(f.host, "picture-other")!.style.left).toBe("77px");
    expect(f.events.eventNames()).toEqual([]);
  });

  it.each([true, false, undefined])("duration zero is immediate with wait=%s", async wait => {
    const f = fixture();
    await runCommands(f.scene, [command(wait, 0), after]);
    expect(await f.overlay.waitForPicture("pic1")).toBe("completed");
    expect(await f.overlay.waitForPicture("missing")).toBe("cancelled");
    expect(f.opacity()).toBe(0.502);
    expect(f.session.switches[SENTINEL]).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    expect(f.events.eventNames()).toEqual([]);
  });

  it.each([false, undefined])("wait=%s continues without advancing the renderer", async wait => {
    const f = fixture();
    await runCommands(f.scene, [command(wait), after]);
    expect(f.session.switches[SENTINEL]).toBe(true);
    expect(f.opacity()).toBe(0);
    f.frame(500);
    await vi.advanceTimersByTimeAsync(0);
    expect(f.opacity()).toBe(0.502);
    expect(f.events.eventNames()).toEqual([]);
  });

  // This test deliberately uses only APIs present at c66f5a8a, so the same test
  // characterizes original behavior and detects whole-event termination at 15bcc2267.
  it.each(["replacement", "erase", "resolved-coordinate retarget"] as const)("G3-F10 original continuation contract: same-session %s preserves following commands", async operation => {
    const f = fixture();
    const running = runCommands(f.scene, [command(true), after]);
    expect(f.opacity()).toBe(0);
    expect(f.session.switches[SENTINEL]).toBe(false);
    if (operation === "erase") delete f.session.pictures.pic1;
    else {
      f.session.variables["u04-target-x"] = 300;
      showPictureState(f.session, {
        ...command(true, 2000),
        x: operation === "replacement" ? 300 : f.session.variables["u04-target-x"]!,
      });
    }
    f.scene.syncRuntimeState();
    await vi.advanceTimersByTimeAsync(500);
    await running;
    expect(f.scene.session).toBe(f.session);
    expect(f.session.switches[SENTINEL]).toBe(true);
    expect(findByTestId(f.host, "picture-other")!.style.left).toBe("77px");
    f.frame(2000);
    expect(f.session.switches[SENTINEL]).toBe(true);
  });

  it.each(["replacement", "erase"] as const)("%s cancels picture observers but continues the live event once", async operation => {
    const f = fixture();
    const finished = vi.fn();
    const running = runCommands(f.scene, [command(true), after]);
    void running.then(finished);
    const first = f.overlay.waitForPicture("pic1");
    const second = f.overlay.waitForPicture("pic1");
    if (operation === "erase") delete f.session.pictures.pic1;
    else showPictureState(f.session, { ...command(true, 2000), x: 300 });
    f.scene.syncRuntimeState();
    expect(await first).toBe("cancelled");
    expect(await second).toBe("cancelled");
    const replacement = f.overlay.waitForPicture("pic1");
    await vi.advanceTimersByTimeAsync(0);
    await running;
    expect(f.session.switches[SENTINEL]).toBe(true);
    expect(finished).toHaveBeenCalledOnce();
    f.frame(2000);
    expect(await replacement).toBe(operation === "erase" ? "cancelled" : "completed");
    expect(f.session.switches[SENTINEL]).toBe(true);
    expect(finished).toHaveBeenCalledOnce();
    expect(findByTestId(f.host, "picture-other")!.style.left).toBe("77px");
    if (operation === "erase") expect(findByTestId(f.host, "picture-pic1")).toBeNull();
    else expect(findByTestId(f.host, "picture-pic1")!.style.left).toBe("300px");
    expect(f.events.eventNames()).toEqual([]);
  });

  it("G3-F10 same-generation retarget keeps the current waiter until the retargeted final frame", async () => {
    const f = fixture();
    const running = runCommands(f.scene, [command(true), after]);
    const generation = f.session.pictures.pic1!;
    f.session.variables["target-x"] = 10;
    // A resolved coordinate can change without reauthoring the picture object.
    Object.defineProperty(generation, "x", { get: () => f.session.variables["target-x"]! });
    const completion = f.overlay.waitForPicture("pic1");
    const settled = vi.fn();
    void completion.then(settled);
    f.frame(250);
    expect(f.opacity()).toBe(0.251);
    f.session.variables["target-x"] = 300;
    showPictureState(f.session, generation); // Same generation, explicit transition intent.
    f.scene.syncRuntimeState();
    expect(f.session.pictures.pic1).toBe(generation);
    await vi.advanceTimersByTimeAsync(500);
    expect.soft(settled).not.toHaveBeenCalled();
    expect.soft(f.session.switches[SENTINEL]).toBe(false);
    f.frame(500);
    await vi.advanceTimersByTimeAsync(0);
    expect(findByTestId(f.host, "picture-pic1")!.style.left).toBe("155px");
    expect(f.opacity()).toBe(0.376);
    expect.soft(f.session.switches[SENTINEL]).toBe(false);
    f.frame(750);
    expect(await completion).toBe("completed");
    await running;
    expect(f.session.switches[SENTINEL]).toBe(true);
    expect(findByTestId(f.host, "picture-pic1")!.style.left).toBe("300px");
    expect(f.opacity()).toBe(0.502);
    expect(settled).toHaveBeenCalledOnce();
    expect(settled).toHaveBeenCalledWith("completed");
    expect(f.events.eventNames()).toEqual([]);
  });

  it("G3-F10 same-generation retarget without transition intent completes after its existing immediate DOM update", async () => {
    const f = fixture();
    const running = runCommands(f.scene, [command(true), after]);
    const generation = f.session.pictures.pic1!;
    const completion = f.overlay.waitForPicture("pic1");
    Object.defineProperty(generation, "x", { get: () => 300 });
    f.scene.syncRuntimeState(); // No new transition intent: preserve the immediate-update rule.
    expect(findByTestId(f.host, "picture-pic1")!.style.left).toBe("300px");
    expect(f.opacity()).toBe(0.502);
    expect(await completion).toBe("completed");
    await running;
    expect(f.session.switches[SENTINEL]).toBe(true);
    expect(f.events.eventNames()).toEqual([]);
  });

  it("G3-F10 resource replacement cancels picture observers even with the same object identity", async () => {
    const f = fixture();
    const running = runCommands(f.scene, [command(true), after]);
    const generation = f.session.pictures.pic1!;
    const completion = f.overlay.waitForPicture("pic1");
    Object.defineProperty(generation, "resourceId", { value: "replacement-resource" });
    f.scene.syncRuntimeState();
    expect(f.session.pictures.pic1).toBe(generation);
    expect(await completion).toBe("cancelled");
    await running;
    expect(f.session.switches[SENTINEL]).toBe(true);
    f.frame(500);
    expect(f.events.eventNames()).toEqual([]);
  });

  it.each(["shutdown", "destroy"])("%s cancels the wait and renderer without refreshing a dead scene", async event => {
    const f = fixture();
    const running = runCommands(f.scene, [command(true), after]);
    const refreshes = vi.mocked(f.scene.refreshRuntimeSurfaces).mock.calls.length;
    f.events.emit(event);
    await vi.advanceTimersByTimeAsync(500);
    await running;
    expect(f.session.switches[SENTINEL]).toBe(false);
    expect(f.scene.refreshRuntimeSurfaces).toHaveBeenCalledTimes(refreshes);
    expect(f.dialogue.close).not.toHaveBeenCalled();
    expect(findByTestId(f.host, "picture-pic1")).toBeNull();
    expect(f.events.eventNames()).toEqual([]);
    f.frame(5000);
    expect(findByTestId(f.host, "picture-pic1")).toBeNull();
  });

  it.each([false, true])("session replacement after final frame=%s cannot resume the stale interpreter", async renderFinalFrame => {
    const f = fixture();
    const running = runCommands(f.scene, [command(true), after]);
    if (renderFinalFrame) f.frame(500);
    f.scene.session = startSession(f.project, 8);
    f.scene.session.pictures = structuredClone(f.session.pictures);
    f.scene.syncRuntimeState();
    await vi.advanceTimersByTimeAsync(500);
    await running;
    expect(f.session.switches[SENTINEL]).toBe(false);
    expect(f.scene.session.switches[SENTINEL]).not.toBe(true);
    expect(f.opacity()).toBe(0.502);
    expect(f.dialogue.close).not.toHaveBeenCalled();
  });

  it.each([false, undefined])("shutdown also owns a still-animating wait=%s picture after its command has returned", async wait => {
    const f = fixture();
    const cancelFrame = vi.spyOn(globalThis, "cancelAnimationFrame");
    await runCommands(f.scene, [command(wait)]);
    f.overlay.syncVisibleHud({ timers: { unaffected: 10 }, timerActive: { unaffected: true } });
    const cancelled = f.overlay.waitForPicture("pic1");
    f.events.emit("shutdown");
    expect(await cancelled).toBe("cancelled");
    expect(cancelFrame).toHaveBeenCalledOnce();
    expect(findByTestId(f.host, "picture-pic1")).toBeNull();
    expect(findByTestId(f.host, "runtime-timer-hud")).not.toBeNull();
    expect(f.events.eventNames()).toEqual([]);
    f.overlay.clearPictures();
    f.frame(5000);
    expect(cancelFrame).toHaveBeenCalledOnce();
  });

  it("shutdown between the final DOM write and promise continuation cannot execute the sentinel", async () => {
    const f = fixture();
    const running = runCommands(f.scene, [command(true), after]);
    f.frame(500);
    expect(f.opacity()).toBe(0.502);
    f.events.emit("shutdown");
    await running;
    expect(f.session.switches[SENTINEL]).toBe(false);
    expect(f.dialogue.close).not.toHaveBeenCalled();
    expect(f.events.eventNames()).toEqual([]);
  });

  it("cutscene skip interrupts the wait without a timer or a later stale continuation", async () => {
    const f = fixture();
    vi.spyOn(performance, "now").mockReturnValue(1000);
    const running = runCommands(f.scene, [
      { kind: "cutsceneControl", mode: "begin", skippable: true }, command(true), after,
      { kind: "label", name: CUTSCENE_END_LABEL }, { kind: "cutsceneControl", mode: "end" },
      { kind: "setSwitch", switchId: SKIPPED, value: true },
    ]);
    for (const _ of [0, 1]) {
      const event = new Event("keydown", { cancelable: true });
      Object.assign(event, { key: "Escape" });
      document.dispatchEvent(event);
    }
    await running;
    expect(f.session.switches[SENTINEL]).toBe(false);
    expect(f.session.switches[SKIPPED]).toBe(true);
    expect.soft(vi.getTimerCount()).toBe(0);
    f.frame(500);
    await vi.advanceTimersByTimeAsync(0);
    expect(f.session.switches[SENTINEL]).toBe(false);
    expect(f.events.eventNames()).toEqual([]);
  });
});
