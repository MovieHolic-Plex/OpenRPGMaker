// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import {
  EVENT_LABEL_FONT_FAMILY,
  EVENT_LABEL_FONT_SIZE,
  eventLabelResolution,
} from "@/editor/editSceneEventMarkers";

describe("eventLabelResolution", () => {
  it("devicePixelRatio가 없으면 기본 2배로 래스터화한다", () => {
    expect(eventLabelResolution(undefined, 1)).toBe(2);
  });

  it("devicePixelRatio와 카메라 zoom을 곱해 올림한다", () => {
    expect(eventLabelResolution(1.25, 1)).toBe(2);
    expect(eventLabelResolution(2, 1)).toBe(2);
    expect(eventLabelResolution(1.5, 2)).toBe(3);
  });

  it("텍스처 메모리 낭비를 막으려 해상도를 4로 제한한다", () => {
    expect(eventLabelResolution(2, 4)).toBe(4);
    expect(eventLabelResolution(3, 8)).toBe(4);
  });

  it("비정상 입력에는 안전한 값으로 폴백한다", () => {
    expect(eventLabelResolution(0, 1)).toBe(2);
    expect(eventLabelResolution(Number.NaN, 1)).toBe(2);
    expect(eventLabelResolution(2, 0)).toBe(2);
    expect(eventLabelResolution(2, Number.NaN)).toBe(2);
  });
});

describe("EVENT_LABEL 폰트 스택", () => {
  it("한글 본문 폰트를 모노 폰트보다 앞에 둔다", () => {
    expect(EVENT_LABEL_FONT_FAMILY.indexOf("Pretendard")).toBeLessThan(EVENT_LABEL_FONT_FAMILY.indexOf("Cascadia Mono"));
    expect(EVENT_LABEL_FONT_FAMILY.indexOf("Malgun Gothic")).toBeLessThan(EVENT_LABEL_FONT_FAMILY.indexOf("Cascadia Mono"));
  });

  it("sans-serif를 모노 폴백보다 앞에 둔다", () => {
    expect(EVENT_LABEL_FONT_FAMILY.indexOf("sans-serif")).toBeLessThan(EVENT_LABEL_FONT_FAMILY.indexOf("monospace"));
  });

  it("캔버스에서 뭉개지는 11px 대신 12px를 쓴다", () => {
    expect(EVENT_LABEL_FONT_SIZE).toBe("12px");
  });
});
