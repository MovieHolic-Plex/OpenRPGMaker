// 리뷰 결함 [높음-4] 회귀: 그래픽 선택 다이얼로그 이미지 리치화.
// (a) 좌측 리소스 리스트 행에 대표 스프라이트(캐릭터 0, 아래, 패턴 1) 24x32 썸네일 크롭이 적용되고
// (b) 원시 리소스 이름은 고급 접힘 뒤에 기본으로 숨으며
// (c) 걷기 애니메이션 프리뷰(npc-walk-preview)가 존재하고 방향/캐릭터 변경 시 갱신된다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CHARSET_FRAME_HEIGHT,
  CHARSET_FRAME_WIDTH,
  charsetFrameIndex,
  charsetFrameSource,
  EASYRPG_CHARSET_ASSETS,
} from "@/assets/easyrpgRtp";
import { renderGraphicResourceList } from "@/editor/panels/eventEditor/npcGraphicPickerControls";
import { renderNpcGraphicPicker } from "@/editor/panels/eventEditor/npcGraphicPicker";
import { store } from "@/project/store";
import type { EventPage } from "@/project/types";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

const THUMB_SELECTION = { characterIndex: 0, direction: "down", pattern: 1 } as const;

function samplePage(): EventPage {
  return {
    id: "page-1",
    name: "1",
    conditions: [],
    graphic: {
      sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" },
      direction: "down",
      pattern: charsetFrameIndex(THUMB_SELECTION),
    },
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [],
  };
}

function renderPicker(): FakeElement {
  return renderWithFakeDom(() => renderNpcGraphicPicker("map-1", "ev-1", samplePage(), () => {}));
}

function radioInput(root: FakeElement, testId: string): FakeElement {
  const label = findByTestId(root, testId);
  expect(label, testId).not.toBeNull();
  const input = label?.querySelector("input");
  expect(input, `${testId} input`).not.toBeNull();
  return input as FakeElement;
}

describe("NPC 그래픽 선택 다이얼로그 — 이미지 리치화", () => {
  let restoreDom: (() => void) | undefined;

  beforeEach(() => {
    restoreDom = installFakeDom();
  });

  afterEach(() => {
    restoreDom?.();
  });

  it("리소스 행 아이콘에 대표 스프라이트 24x32 썸네일 크롭이 적용된다", () => {
    const list = renderGraphicResourceList(EASYRPG_CHARSET_ASSETS, () => {});
    const source = charsetFrameSource(THUMB_SELECTION);
    expect(list.buttons.length).toBe(EASYRPG_CHARSET_ASSETS.length);
    list.buttons.forEach((button, index) => {
      const asset = EASYRPG_CHARSET_ASSETS[index];
      const icon = (button as unknown as FakeElement).querySelector(".event-graphic-resource-icon");
      expect(icon, asset?.textureKey).not.toBeNull();
      expect(icon?.classList.contains("charset-thumb")).toBe(true);
      expect(icon?.style.width).toBe(`${CHARSET_FRAME_WIDTH}px`);
      expect(icon?.style.height).toBe(`${CHARSET_FRAME_HEIGHT}px`);
      expect(icon?.style.backgroundPosition).toBe(`-${source.x}px -${source.y}px`);
      expect(icon?.dataset.transparentColorKeyPath).toBe(asset?.path);
    });
  });

  it("타일셋 자리표시 행을 더 이상 보여 주지 않는다", () => {
    const list = renderGraphicResourceList(EASYRPG_CHARSET_ASSETS, () => {});
    const root = list.root as unknown as FakeElement;
    const disabledRows = root
      .querySelectorAll(".disabled")
      .filter((row) => row.classList.contains("event-graphic-resource-row"));
    expect(disabledRows.length).toBe(0);
  });

  it("직접 이름 입력은 고급 접힘 안에 기본으로 들어간다", () => {
    const root = renderPicker();
    const details = root.querySelector(".npc-advanced-sprite");
    expect(details).not.toBeNull();
    expect(details?.tagName).toBe("DETAILS");
    expect((details as FakeElement & { open?: boolean }).open ?? false).toBe(false);
    const summary = details?.querySelector("summary");
    expect(summary?.textContent).toBe("고급 · 파일 이름 직접 넣기");
    // testid 는 불변이어야 하고, 입력이 details 내부로 이동해야 한다.
    const input = findByTestId(details as FakeElement, "event-graphic-direct-sprite-input");
    expect(input).not.toBeNull();
    expect(input?.value).toBe("tex_easyrpg_charset_people1");
  });

  it("걷기 프리뷰가 존재하고 방향/캐릭터 변경 시 dataset 과 걷기 프레임 변수가 갱신된다", () => {
    const root = renderPicker();
    const walkPreview = findByTestId(root, "npc-walk-preview");
    expect(walkPreview).not.toBeNull();
    expect(walkPreview?.dataset.slot).toBe("0");
    expect(walkPreview?.dataset.direction).toBe("down");

    // 방향 변경 → dataset.direction + 프레임 변수 갱신
    const leftRadio = radioInput(root, "npc-direction-left");
    leftRadio.checked = true;
    leftRadio.dispatchEvent(new Event("change"));
    expect(walkPreview?.dataset.direction).toBe("left");
    for (const pattern of [0, 1, 2]) {
      const source = charsetFrameSource({ characterIndex: 0, direction: "left", pattern });
      expect(walkPreview?.style[`--npc-walk-frame-${pattern}`]).toBe(
        `-${source.x * 2}px -${source.y * 2}px`
      );
    }

    // 캐릭터 슬롯 변경 → dataset.slot 갱신
    const slot3 = findByTestId(root, "npc-character-slot-3");
    expect(slot3).not.toBeNull();
    slot3?.click();
    expect(walkPreview?.dataset.slot).toBe("3");
    const slot3Source = charsetFrameSource({ characterIndex: 3, direction: "left", pattern: 1 });
    expect(walkPreview?.style["--npc-walk-frame-1"]).toBe(
      `-${slot3Source.x * 2}px -${slot3Source.y * 2}px`
    );
  });

  it("기존 testid (프레임 프로브/확인/취소/리소스 행)가 유지된다", () => {
    const root = renderPicker();
    expect(findByTestId(root, "npc-frame-preview")).not.toBeNull();
    expect(findByTestId(root, "event-graphic-confirm")).not.toBeNull();
    expect(findByTestId(root, "event-graphic-cancel")).not.toBeNull();
    expect(findByTestId(root, "event-graphic-resource-tex_easyrpg_charset_people1")).not.toBeNull();
  });

  it("소재 관리자에서 업로드한 charset이 리소스 목록에 나타난다", () => {
    const project = store.getCurrent();
    const uploadedId = "uploaded-custom-hero";
    project.assets.uploaded[uploadedId] = {
      id: uploadedId,
      name: "커스텀 영웅.png",
      kind: "charset",
      dataUrl: "data:image/png;base64,iVBORw0KGgo=",
      meta: { width: 288, height: 256 },
    };
    try {
      const root = renderPicker();
      const uploadedRow = findByTestId(root, `event-graphic-resource-${uploadedId}`);
      expect(uploadedRow, "uploaded charset row").not.toBeNull();
      expect(uploadedRow?.textContent).toContain("커스텀 영웅");
    } finally {
      delete project.assets.uploaded[uploadedId];
    }
  });

  it("uploaded가 아닌 kind(tileset 등)은 charset 목록에 나타나지 않는다", () => {
    const project = store.getCurrent();
    const tilesetId = "uploaded-tileset-x";
    project.assets.uploaded[tilesetId] = {
      id: tilesetId,
      name: "타일셋X.png",
      kind: "tileset",
      dataUrl: "data:image/png;base64,iVBORw0KGgo=",
      meta: { width: 480, height: 256 },
    };
    try {
      const root = renderPicker();
      const tilesetRow = findByTestId(root, `event-graphic-resource-${tilesetId}`);
      expect(tilesetRow).toBeNull();
    } finally {
      delete project.assets.uploaded[tilesetId];
    }
  });
});
