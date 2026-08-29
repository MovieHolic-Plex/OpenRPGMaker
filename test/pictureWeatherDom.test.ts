import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { RuntimeDomOverlay } from "@/player/runtimeDom";
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

    for (clock = 100; clock <= 1000; clock += 100) {
      flushFakeAnimationFrames(0, 1);
      overlay.syncPictureLayer(session.pictures);
    }

    expect(Number(findByTestId(host, "picture-pic1")!.style.opacity)).toBe(1);
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
