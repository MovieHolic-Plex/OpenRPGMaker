// aiPanelLayoutResponsive.test.ts
// 도킹 모드별 패널 크기(per-dock) + 뷰포트 반응형 클램프 계약(2026-08-25).
// vitest 환경은 "node" — 돔 대신 storage(globalThis.localStorage)만 스텁한다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clampPanelSize,
  clampPanelSizeToViewport,
  clearDockPanelSize,
  loadDockPanelSize,
  loadPanelSize,
  PANEL_SIZE_LIMITS,
  saveDockPanelSize,
  savePanelSize,
  type PanelDock,
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

describe("도크별 저장/복원 (per-dock)", () => {
  it("도크마다 독립적으로 왕복한다 — glass/side 각각, float은 저장 없으면 null", () => {
    saveDockPanelSize("glass", { width: 400, height: 700 });
    saveDockPanelSize("side", { width: 560, height: 880 });
    expect(loadDockPanelSize("glass")).toEqual({ width: 400, height: 700 });
    expect(loadDockPanelSize("side")).toEqual({ width: 560, height: 880 });
    // float은 저장도 레거시도 없음 → null
    expect(loadDockPanelSize("float")).toBeNull();
  });

  it("도크 키가 없으면 레거시 글로벌 값(oprn:ai-panel-size)으로 폴백한다", () => {
    savePanelSize({ width: 500, height: 600 });
    // per-dock 키가 없으면 어느 도크든 레거시 값을 그대로 쓴다
    expect(loadDockPanelSize("glass")).toEqual({ width: 500, height: 600 });
    expect(loadDockPanelSize("side")).toEqual({ width: 500, height: 600 });
  });

  it("clearDockPanelSize는 도크 키를 지워 null로 되돌린다 (레거시 없음)", () => {
    saveDockPanelSize("glass", { width: 400, height: 700 });
    expect(loadDockPanelSize("glass")).toEqual({ width: 400, height: 700 });
    clearDockPanelSize("glass");
    expect(loadDockPanelSize("glass")).toBeNull();
  });

  it("저장된 쓰레기 값은 예외 없이 null을 돌려준다", () => {
    storage.set("oprn:ai-panel-size:glass", '{"width":"wide"}');
    expect(loadDockPanelSize("glass")).toBeNull();
  });
});

// 저장 시 도크 키가 어떤 형태로 쓰이는지 타입 체크용 (런타임 무관)
void ((): PanelDock | undefined => undefined)();
