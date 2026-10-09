import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { chipWindow, regionFromToolCall, renderMapChip } from "@/editor/panels/aiMapChip";
import { createBlankProject } from "@/project/defaults";
import { FakeElement, installFakeDom } from "./fakeDom";

const ok = { ok: true, summary: "" } as const;

describe("aiMapChip — 툴 호출에서 맵 자리를 읽는다", () => {
  it("인자의 x/y 한 칸, x/y/w/h 사각형, rect 객체를 영역으로 읽는다", () => {
    // Break: 인자 모양 하나가 빠지면 그 툴의 행이 빈 아이콘 칩으로 떨어진다.
    expect(regionFromToolCall({ x: 3, y: 4 }, ok)).toEqual({ x: 3, y: 4, width: 1, height: 1 });
    expect(regionFromToolCall({ x: 2, y: 2, w: 4, h: 6 }, ok)).toEqual({ x: 2, y: 2, width: 4, height: 6 });
    expect(regionFromToolCall({ rect: { x: 1, y: 2, w: 5, h: 3 } }, ok)).toEqual({ x: 1, y: 2, width: 5, height: 3 });
    expect(regionFromToolCall({ region: { x: 1, y: 2, width: 5, height: 3 } }, ok)).toEqual({ x: 1, y: 2, width: 5, height: 3 });
  });

  it("인자에 없으면 결과 data 의 좌표·영역을 본다", () => {
    // Break: 결과 좌표(예: 빈 자리 찾기)가 무시되어 조회 툴 행에 칩이 없다.
    expect(regionFromToolCall({}, { ...ok, data: { x: 7, y: 8 } })).toEqual({ x: 7, y: 8, width: 1, height: 1 });
    expect(regionFromToolCall(undefined, { ...ok, data: { region: { x: 0, y: 1, width: 2, height: 2 } } }))
      .toEqual({ x: 0, y: 1, width: 2, height: 2 });
  });

  it("좌표가 없거나 유효하지 않으면 null", () => {
    // Break: NaN·음수·문자열 좌표를 영역으로 만들어 렌더러가 던진다.
    expect(regionFromToolCall({ name: "두리" }, ok)).toBeNull();
    expect(regionFromToolCall({ x: "3", y: 4 }, ok)).toBeNull();
    expect(regionFromToolCall({ x: -1, y: 4 }, ok)).toBeNull();
    expect(regionFromToolCall({ x: 1, y: 1, w: 0, h: 2 }, ok)).toBeNull();
  });

  it("칩 창은 영역을 가운데 두고 최소 7×5 로 넓힌 뒤 맵 안으로 자른다", () => {
    // Break: 한 칸 영역을 그대로 그려 46×32 칩에 타일 하나가 뭉개져 보이거나, 맵 밖을 그리려 한다.
    expect(chipWindow({ x: 10, y: 10, width: 1, height: 1 }, { width: 60, height: 45 })).toEqual({ x: 7, y: 8, width: 7, height: 5 });
    expect(chipWindow({ x: 0, y: 0, width: 1, height: 1 }, { width: 60, height: 45 })).toEqual({ x: 0, y: 0, width: 7, height: 5 });
    expect(chipWindow({ x: 58, y: 44, width: 1, height: 1 }, { width: 60, height: 45 })).toEqual({ x: 53, y: 40, width: 7, height: 5 });
    // 큰 영역은 그대로 두고 여백 1칸만 더한다.
    expect(chipWindow({ x: 10, y: 10, width: 20, height: 12 }, { width: 60, height: 45 })).toEqual({ x: 9, y: 9, width: 22, height: 14 });
  });
});

describe("renderMapChip", () => {
  let restoreDom: (() => void) | null = null;
  beforeEach(() => {
    restoreDom = installFakeDom();
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = null;
  });

  it("맵이 있으면 캔버스를 비동기로 붙이고 핀을 찍는다", async () => {
    // Break: 렌더러 결과를 버리거나 핀이 없어 어디가 바뀌었는지 알 수 없다.
    const project = createBlankProject();
    const mapId = project.startMapId;
    const canvas = document.createElement("canvas");
    const chip = renderMapChip({
      project,
      mapId,
      region: { x: 3, y: 3, width: 1, height: 1 },
      renderShot: () => Promise.resolve(canvas),
    });
    expect(chip.className).toContain("ai-act-chip");
    await Promise.resolve();
    await Promise.resolve();
    expect((chip as unknown as FakeElement).childNodes).toContain(canvas);
    expect(chip.querySelector(".ai-act-pin")).not.toBeNull();
    expect(chip.dataset.region).toBe("3,3 1×1");
  });

  it("렌더가 실패하면 아이콘 칩으로 남고 예외를 밖으로 내지 않는다", async () => {
    // Break: 타일셋 로드 실패가 로그 렌더 전체를 죽인다.
    const project = createBlankProject();
    const chip = renderMapChip({
      project,
      mapId: project.startMapId,
      region: { x: 0, y: 0, width: 1, height: 1 },
      renderShot: () => Promise.reject(new Error("no tileset")),
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(chip.querySelector("canvas")).toBeNull();
    expect(chip.className).toContain("is-icon");
  });

  it("맵이 없으면 아이콘 칩", () => {
    const project = createBlankProject();
    const chip = renderMapChip({ project, mapId: "nope", region: { x: 0, y: 0, width: 1, height: 1 } });
    expect(chip.className).toContain("is-icon");
  });
});
