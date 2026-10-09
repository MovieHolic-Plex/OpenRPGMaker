// aiPanelLayoutResponsive.test.ts
// 컴포저 캡슐 폭 저장 + 뷰포트 반응형 클램프 계약.
// 2026-08-31: 도크가 float 하나가 되면서 per-dock 키(oprn:ai-panel-size:<dock>) 3종이
// 캡슐 폭 하나로 합쳐졌다. 낡은 float 키는 최초 1회만 읽어 사용자 폭을 물려받는다.
// vitest 환경은 "node" — 돔 대신 storage(globalThis.localStorage)만 스텁한다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clampPanelSize,
  clampPanelSizeToViewport,
  loadPanelBarSize,
  PANEL_SIZE_LIMITS,
  savePanelBarSize,
  savePanelSize,
  stepAiFontSize,
} from "@/editor/panels/aiPanelLayout";

let storage: Map<string, string>;

function installFakeLocalStorage(): void {
  storage = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, String(value)),
      removeItem: (key: string) => void storage.delete(key),
      clear: () => storage.clear(),
    },
  });
}

beforeEach(() => {
  installFakeLocalStorage();
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, "localStorage");
});

describe("clampPanelSizeToViewport", () => {
  it("작은 뷰포트에서는 폭/높이를 뷰포트의 90%로 상한을 잡는다", () => {
    // 900x900 (한계 내) → 800x700 뷰포트: width=round(800*0.9)=720, height=round(700*0.9)=630
    expect(clampPanelSizeToViewport({ width: 900, height: 900 }, { width: 800, height: 700 })).toEqual({
      width: 720,
      height: 630,
    });
  });

  it("아무리 작은 뷰포트라도 minWidth/minHeight 아래로 내려가지 않는다", () => {
    expect(clampPanelSizeToViewport({ width: 900, height: 900 }, { width: 200, height: 200 })).toEqual({
      width: PANEL_SIZE_LIMITS.minWidth,
      height: PANEL_SIZE_LIMITS.minHeight,
    });
  });

  it("비유효 뷰포트(0/NaN)는 뷰포트 상한 없이 clampPanelSize와 같다", () => {
    const size = { width: 500, height: 600 };
    expect(clampPanelSizeToViewport(size, { width: 0, height: NaN })).toEqual(clampPanelSize(size));
  });
});

describe("캡슐 폭 저장/복원", () => {
  it("저장한 폭을 그대로 왕복하고, 저장이 없으면 null 이다", () => {
    expect(loadPanelBarSize()).toBeNull();
    savePanelBarSize({ width: 560, height: 880 });
    expect(loadPanelBarSize()).toEqual({ width: 560, height: 880 });
  });

  it("낡은 float 도크 키를 물려받는다 — 도크 삭제로 사용자 폭을 잃지 않는다", () => {
    storage.set("oprn:ai-panel-size:float", JSON.stringify({ width: 620, height: 700 }));
    expect(loadPanelBarSize()).toEqual({ width: 620, height: 700 });
  });

  it("새 키가 있으면 낡은 float 키보다 우선한다", () => {
    storage.set("oprn:ai-panel-size:float", JSON.stringify({ width: 620, height: 700 }));
    savePanelSize({ width: 480, height: 640 });
    expect(loadPanelBarSize()).toEqual({ width: 480, height: 640 });
  });

  it("삭제된 glass/side 키는 더 이상 읽지 않는다", () => {
    storage.set("oprn:ai-panel-size:glass", JSON.stringify({ width: 400, height: 700 }));
    storage.set("oprn:ai-panel-size:side", JSON.stringify({ width: 560, height: 880 }));
    expect(loadPanelBarSize()).toBeNull();
  });

  it("저장된 쓰레기 값은 예외 없이 null을 돌려준다", () => {
    storage.set("oprn:ai-panel-size", '{"width":"wide"}');
    expect(loadPanelBarSize()).toBeNull();
  });
});

describe("글자 크기 스테퍼", () => {
  it("작게↔보통↔크게에서 끝은 더 나가지 않는다", () => {
    expect(stepAiFontSize("normal", 1)).toBe("large");
    expect(stepAiFontSize("large", 1)).toBe("large");
    expect(stepAiFontSize("small", -1)).toBe("small");
    expect(stepAiFontSize("large", -1)).toBe("normal");
  });
});
