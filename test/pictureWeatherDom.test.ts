import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { RuntimeDomOverlay } from "@/player/runtimeDom";
import { runTransitionPhase } from "@/player/transitions/transitionOverlay";
import { FakeElement, installFakeDom, findByTestId } from "./fakeDom";
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
