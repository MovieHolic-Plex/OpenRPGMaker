// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import {
  EVENT_LABEL_FONT_SIZE,
  eventLabelFontFamily,
  eventLabelResolution,
} from "@/editor/editSceneEventMarkers";
import { fontOptionsForRole, resolveFontStack } from "@/project/fontRegistry";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

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
  // 이전엔 리터럴 스택 하나의 순서만 고정했다. 글꼴이 자자 선택으로 바뀌었으므로 같은 우려
  // (한글 라벨이 모노 선단 때문에 글자마다 폴백해 베이스라인이 섞이는 것)를 두 갈래로 나눠 본다:
  // 기본 선택은 절대 모노로 시작하지 않고, 명시적 선택은 재정렬 없이 그대로 쓰인다.
  it("기본 선택은 모노로 시작하지 않는다", () => {
    store.replace(createBlankProject());
    const first = eventLabelFontFamily().split(",")[0].trim().replace(/^"|"$/gu, "");
    expect(first).not.toMatch(/^(Cascadia|Consolas|SFMono|JetBrains|ui-monospace|monospace)/u);
  });

  it("자자가 고른 UI 글꼴을 재정렬 없이 그대로 따른다", () => {
    for (const option of fontOptionsForRole("ui")) {
      const project = createBlankProject();
      project.system.fonts = { ui: option.id };
      store.replace(project);
      expect(eventLabelFontFamily(), `${option.id} 선택이 반영되지 않았다`).toBe(resolveFontStack(option.id));
    }
  });

  it("캔버스에서 뭉개지는 11px 대신 12px를 쓴다", () => {
    expect(EVENT_LABEL_FONT_SIZE).toBe("12px");
  });
});
