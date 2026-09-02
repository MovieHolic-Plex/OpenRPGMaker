/**
 * 편집기 미리보기가 시트 배율을 존중한다.
 *
 * 미리보기는 RM px(320 시대) 좌표계로 그린다 — 96px 레거시 시트는 96 CSS px. 384px·0.5 시트도
 * 같은 96 CSS px 로 보여야 한다. 안 그러면 스킬 탭의 연출 카드와 이벤트 편집기의 애니메이션
 * 표시면이 384px 짜리 거대한 셀을 보여 준다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  renderShowAnimationFrame,
  showAnimationPlaybackSource,
} from "@/editor/panels/eventEditor/showAnimationPlayback";
import { renderAnimationStagePanel } from "@/editor/panels/databaseAnimationPreview";
import { createBlankProject } from "@/project/defaults";
import type { BattleAnimationFrame, BattleAnimationRecord, BattleAnimationSheet } from "@/project/types";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | undefined;
let previousImage: typeof globalThis.Image | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
  previousImage = globalThis.Image;
  Object.defineProperty(globalThis, "Image", {
    configurable: true,
    value: class {
      addEventListener(): void {}
      set src(_value: string) {}
    },
  });
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
  if (previousImage === undefined) {
    delete (globalThis as { Image?: unknown }).Image;
  } else {
    Object.defineProperty(globalThis, "Image", { configurable: true, value: previousImage });
  }
});

const HIRES: BattleAnimationSheet = { frameWidth: 384, frameHeight: 384, columns: 10, assetScale: 0.5 };
const FRAMES: BattleAnimationFrame[] = [
  { cells: [{ pattern: 0, x: 0, y: 0, zoom: 100, opacity: 255, visible: true }] },
  { cells: [{ pattern: 6, x: 12, y: -8, zoom: 50, opacity: 128, visible: true }] },
];

function hiresRecord(project: ReturnType<typeof createBlankProject>): BattleAnimationRecord {
  const existing = project.database.battleAnimations.find((entry) => Boolean(entry.resourceId));
  return {
    id: "anim_hires",
    name: "고해상도",
    resourceId: existing?.resourceId,
    sheet: HIRES,
    frames: FRAMES,
    timings: [],
  };
}

describe("showAnimation 표시면", () => {
  it("384px·0.5 시트를 96 CSS px 프레임으로 그리고 배경 좌표도 같은 배율로 옮긴다", () => {
    const project = createBlankProject();
    const source = showAnimationPlaybackSource(hiresRecord(project), project);
    if (!source) throw new Error("재생 소스를 만들지 못했다");
    const layer = new FakeElement("div") as unknown as HTMLElement;

    renderShowAnimationFrame(layer, source, 1);

    const cell = findByTestId(layer as unknown as FakeElement, "show-animation-frame-cell");
    expect(cell?.style.getPropertyValue("--animation-frame-width")).toBe("96px");
    expect(cell?.style.getPropertyValue("--animation-frame-height")).toBe("96px");
    // pattern 6, 10열 → 6열 0행 → 시트 px (-2304, 0) × 0.25 = (-576px, 0px)
    expect(cell?.style.backgroundPosition).toBe("-576px -0px");
    expect(cell?.style.backgroundSize).toBe("960px auto");
    // 셀 오프셋은 RM px 그대로다.
    expect(cell?.style.transform).toBe("translate(12px, -8px) scale(0.5)");
  });
});

describe("데이터베이스 애니메이션 스테이지", () => {
  it("384px·0.5 시트의 스테이지 프레임 변수도 96px 이다", () => {
    const project = createBlankProject();
    const animation = hiresRecord(project);
    const panel = renderAnimationStagePanel({
      animation,
      currentSelectedFrameCells: () => FRAMES[0]!.cells.map((cell) => ({ ...cell })),
      duplicateLastFrame: vi.fn(),
      frames: FRAMES,
      project,
      selectedFrame: FRAMES[0]!,
      selectedFrameIndex: 0,
      sheet: HIRES,
      updateSelectedFrameCells: vi.fn(),
    });
    if (!(panel instanceof FakeElement)) throw new Error("Expected fake animation panel");
    const surface = findByTestId(panel, "db-animation-sheet-preview-surface");
    expect(surface?.style.getPropertyValue("--animation-frame-width")).toBe("96px");
    expect(surface?.style.getPropertyValue("--animation-frame-height")).toBe("96px");
    const target = findByTestId(panel, "db-animation-stage-target");
    expect(target?.style.backgroundSize).toBe("960px auto");
  });
});
