// 조수 데크 위치 이동 회귀 (2026-09-12): 레일 드래그로 데크를 캔버스 위 아무 데나 놓는다.
//
//   · 소유 프로퍼티: 패널의 CSS 변수 `--ai-deck-right` / `--ai-deck-bottom` (right/bottom 앵커)
//   · 저장 키: `oprn:ai-deck-pos` — { right, bottom } = 패널 변에서 데크 변까지의 거리(px)
//   · 손잡이: `.ai-deck-rail` 의 비상호작용 표면(who·state·spacer·레일 자체)
//     — 아이콘 줄(`.ai-deck-rail-actions`)과 레일에 붙은 팝오버(`.ai-composer-popover`)는 제외
//   · 더블클릭은 저장 위치를 지워 기본 자리(우하단 inset)로 되돌린다
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderAiChatPanel } from "@/editor/panels/aiChatPanel";
import { editorState } from "@/editor/editorState";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

const POS_KEY = "oprn:ai-deck-pos";

let restoreDom: (() => void) | null = null;
let restoreWindow: (() => void) | null = null;
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

function installFakeWindow(innerWidth = 1600, innerHeight = 1000): void {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  const target = new EventTarget() as EventTarget & Partial<Window>;
  target.setTimeout = ((..._args: Parameters<typeof setTimeout>) => 0) as typeof setTimeout;
  target.clearTimeout = ((..._args: Parameters<typeof clearTimeout>) => undefined) as typeof clearTimeout;
  Object.defineProperty(target, "innerWidth", { configurable: true, value: innerWidth });
  Object.defineProperty(target, "innerHeight", { configurable: true, value: innerHeight });
  Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: target });
  restoreWindow = () => {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
    restoreWindow = null;
  };
}

interface Surface {
  readonly panel: FakeElement;
  readonly deck: FakeElement;
  readonly rail: FakeElement;
}

/** 패널을 띄우고 위치 계약에 관여하는 세 노드를 뽑는다. */
function renderSurface(): Surface {
  const panel = renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;
  const deck = findByTestId(panel, "ai-deck");
  const rail = findByTestId(panel, "ai-deck-rail");
  if (!deck || !rail) throw new Error("deck/rail fixtures missing");
  return { panel, deck, rail };
}

function deckRight(panel: FakeElement): string {
  return panel.style["--ai-deck-right"] ?? "";
}

function deckBottom(panel: FakeElement): string {
  return panel.style["--ai-deck-bottom"] ?? "";
}

function savedPos(): unknown {
  return JSON.parse(storage.get(POS_KEY) ?? "null");
}

function pointerEvent(type: string, clientX: number, clientY: number): Event {
  const event = new Event(type);
  Object.defineProperty(event, "clientX", { configurable: true, value: clientX });
  Object.defineProperty(event, "clientY", { configurable: true, value: clientY });
  Object.defineProperty(event, "preventDefault", { configurable: true, value: () => undefined });
  return event;
}

type Rect = { width: number; height: number; right: number; bottom: number };
function stubRect(el: FakeElement, rect: Rect): void {
  (el as unknown as { getBoundingClientRect: () => object }).getBoundingClientRect = () =>
    ({ ...rect, x: 0, y: 0, top: 0, left: 0, toJSON: () => ({}) });
}

/** 패널 1600×1000, 데크 640×120 이 기본 우하단(right/bottom 16)에 있는 상태로 실측을 심는다. */
function stubMeasured(surface: Surface): void {
  stubRect(surface.panel, { width: 1600, height: 1000, right: 1600, bottom: 1000 });
  stubRect(surface.deck, { width: 640, height: 120, right: 1584, bottom: 984 });
}

beforeEach(() => {
  vi.stubEnv("VITE_LLM_API_URL", "");
  vi.stubEnv("VITE_LLM_API_KEY", "");
  store.replace(createBlankProject());
  editorState.set({ currentMapId: null, selection: null });
  restoreDom = installFakeDom();
  installFakeLocalStorage();
});

afterEach(() => {
  restoreWindow?.();
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("저장 위치 복원", () => {
  it("저장된 위치를 패널 CSS 변수로 적용한다", () => {
    installFakeWindow();
    storage.set(POS_KEY, JSON.stringify({ right: 200, bottom: 140 }));

    const { panel } = renderSurface();

    expect(deckRight(panel)).toBe("200px");
    expect(deckBottom(panel)).toBe("140px");
  });

  it("저장값이 없으면 변수를 쓰지 않는다 — CSS 기본 우하단이 산다", () => {
    installFakeWindow();

    const { panel } = renderSurface();

    expect(deckRight(panel)).toBe("");
    expect(deckBottom(panel)).toBe("");
  });

  it("깨진 저장값은 무시한다", () => {
    installFakeWindow();
    storage.set(POS_KEY, "not json");

    const { panel } = renderSurface();

    expect(deckRight(panel)).toBe("");
    expect(deckBottom(panel)).toBe("");
  });

  it("음수 저장값은 0 이상으로 읽고, 적용은 가장자리 여백 안쪽으로 자른다", () => {
    installFakeWindow();
    storage.set(POS_KEY, JSON.stringify({ right: -30, bottom: 50 }));

    const { panel } = renderSurface();

    // 읽기는 0 까지, 심을 때는 EDGE_MARGIN(4) 까지 — 두 단계 클램프다.
    expect(deckRight(panel)).toBe("4px");
    expect(deckBottom(panel)).toBe("50px");
  });

  it("접혀서 패널이 알약 크기로 줄어도 클램프는 호스트(inset:0) 기준이다", () => {
    installFakeWindow();
    storage.set(POS_KEY, JSON.stringify({ right: 650, bottom: 300 }));
    const surface = renderSurface();
    // 접힘 흉내: 패널을 inset:0 호스트 안에 넣고, 패널·데크 사각형은 알약 크기로 줄인다.
    // (2026-09-12 회귀 — 패널 사각형으로 자르면 저장 위치가 4px 로 뭉개져 알약이 우하단으로 도망갔다)
    const host = document.createElement("div") as unknown as FakeElement;
    host.append(surface.panel);
    stubRect(host, { width: 1134, height: 851, right: 1440, bottom: 900 });
    stubRect(surface.panel, { width: 72, height: 44, right: 1436, bottom: 896 });
    stubRect(surface.deck, { width: 0, height: 0, right: 0, bottom: 0 });

    globalThis.window.dispatchEvent(new Event("resize"));

    expect(deckRight(surface.panel)).toBe("650px");
    expect(deckBottom(surface.panel)).toBe("300px");
  });
});

describe("레일 드래그는 데크를 옮긴다", () => {
  it("왼쪽·위로 끌면 right/bottom 이 커지고 놓을 때 저장된다", () => {
    installFakeWindow();
    const surface = renderSurface();
    stubMeasured(surface);
    const { panel, rail } = surface;

    rail.dispatchEvent(pointerEvent("pointerdown", 1000, 900));
    expect(panel.className).toContain("is-dragging");
    globalThis.window.dispatchEvent(pointerEvent("pointermove", 800, 700));

    // right/bottom 앵커 — 왼쪽(−200)·위(−200)로 끌면 오프셋이 커진다.
    expect(deckRight(panel)).toBe("216px");
    expect(deckBottom(panel)).toBe("216px");
    // 아직 놓지 않았으므로 저장하지 않는다.
    expect(savedPos()).toBeNull();

    globalThis.window.dispatchEvent(pointerEvent("pointerup", 800, 700));
    expect(panel.className).not.toContain("is-dragging");
    expect(savedPos()).toEqual({ right: 216, bottom: 216 });
  });

  it("드래그 시작 오프셋은 실측 사각형에서 읽는다", () => {
    installFakeWindow();
    storage.set(POS_KEY, JSON.stringify({ right: 300, bottom: 200 }));
    const surface = renderSurface();
    // 저장 위치(right 300, bottom 200)에 놓인 데크를 흉내낸다.
    stubRect(surface.panel, { width: 1600, height: 1000, right: 1600, bottom: 1000 });
    stubRect(surface.deck, { width: 640, height: 120, right: 1300, bottom: 800 });

    surface.rail.dispatchEvent(pointerEvent("pointerdown", 1000, 700));
    globalThis.window.dispatchEvent(pointerEvent("pointermove", 900, 650));
    // 300 + 100, 200 + 50 — 실측에서 출발해야 튕기지 않는다.
    expect(deckRight(surface.panel)).toBe("400px");
    expect(deckBottom(surface.panel)).toBe("250px");
    globalThis.window.dispatchEvent(pointerEvent("pointerup", 900, 650));
    expect(savedPos()).toEqual({ right: 400, bottom: 250 });
  });

  it("끌어도 데크는 패널 안에 남는다 — 네 변에 여백을 둔다", () => {
    installFakeWindow();
    const surface = renderSurface();
    stubMeasured(surface);
    const { panel, rail } = surface;

    rail.dispatchEvent(pointerEvent("pointerdown", 1000, 900));

    // 왼쪽 끝까지: right 최대 = 1600 − 640 − 4 = 956.
    globalThis.window.dispatchEvent(pointerEvent("pointermove", -4000, 900));
    expect(deckRight(panel)).toBe("956px");
    // 위 끝까지: bottom 최대 = 1000 − 120 − 4 = 876.
    globalThis.window.dispatchEvent(pointerEvent("pointermove", 1000, -4000));
    expect(deckBottom(panel)).toBe("876px");
    // 오른쪽·아래 끝: 여백 4.
    globalThis.window.dispatchEvent(pointerEvent("pointermove", 4000, 4000));
    expect(deckRight(panel)).toBe("4px");
    expect(deckBottom(panel)).toBe("4px");

    globalThis.window.dispatchEvent(pointerEvent("pointerup", 4000, 4000));
    expect(savedPos()).toEqual({ right: 4, bottom: 4 });
  });

  it("움직이지 않고 놓으면 저장하지 않는다 — 클릭과 드래그를 가른다", () => {
    installFakeWindow();
    const surface = renderSurface();
    stubMeasured(surface);

    surface.rail.dispatchEvent(pointerEvent("pointerdown", 1000, 900));
    globalThis.window.dispatchEvent(pointerEvent("pointerup", 1000, 900));

    expect(savedPos()).toBeNull();
    expect(surface.panel.className).not.toContain("is-dragging");
  });

  it("드래그 중에는 문서 커서가 grabbing 이고 놓으면 되돌아온다", () => {
    installFakeWindow();
    const surface = renderSurface();
    stubMeasured(surface);
    const body = (globalThis.document as unknown as { body: FakeElement }).body;

    surface.rail.dispatchEvent(pointerEvent("pointerdown", 1000, 900));
    expect(body.style.getPropertyValue("cursor")).toBe("grabbing");
    globalThis.window.dispatchEvent(pointerEvent("pointermove", 900, 800));
    globalThis.window.dispatchEvent(pointerEvent("pointerup", 900, 800));
    expect(body.style.getPropertyValue("cursor")).toBe("");
  });
});

describe("손잡이가 아닌 표면은 드래그를 시작하지 않는다", () => {
  it("레일 아이콘 버튼 위 pointerdown 은 데크를 움직이지 않는다", () => {
    installFakeWindow();
    const surface = renderSurface();
    stubMeasured(surface);
    const collapse = findByTestId(surface.panel, "ai-collapse");
    const menuToggle = findByTestId(surface.panel, "ai-command-menu-toggle");
    if (!collapse || !menuToggle) throw new Error("rail buttons missing");

    for (const button of [collapse, menuToggle]) {
      button.dispatchEvent(pointerEvent("pointerdown", 1000, 900));
      globalThis.window.dispatchEvent(pointerEvent("pointermove", 800, 700));
      globalThis.window.dispatchEvent(pointerEvent("pointerup", 800, 700));
      expect(deckRight(surface.panel)).toBe("");
      expect(surface.panel.className).not.toContain("is-dragging");
    }
    expect(savedPos()).toBeNull();
  });

  it("레일에 붙은 팝오버 위 pointerdown 도 데크를 움직이지 않는다", () => {
    installFakeWindow();
    const surface = renderSurface();
    stubMeasured(surface);
    const popover = surface.rail.querySelector(".ai-composer-popover");
    if (!popover) throw new Error("rail popover missing");

    popover.dispatchEvent(pointerEvent("pointerdown", 1000, 900));
    globalThis.window.dispatchEvent(pointerEvent("pointermove", 800, 700));
    globalThis.window.dispatchEvent(pointerEvent("pointerup", 800, 700));

    expect(deckRight(surface.panel)).toBe("");
    expect(savedPos()).toBeNull();
  });

  it("도킹(전체 기록)·스튜디오 상태에서는 레일을 끌어도 움직이지 않는다", () => {
    installFakeWindow();
    const surface = renderSurface();
    stubMeasured(surface);
    surface.panel.classList.add("is-docked");

    surface.rail.dispatchEvent(pointerEvent("pointerdown", 1000, 900));
    globalThis.window.dispatchEvent(pointerEvent("pointermove", 800, 700));
    globalThis.window.dispatchEvent(pointerEvent("pointerup", 800, 700));

    expect(deckRight(surface.panel)).toBe("");
    expect(savedPos()).toBeNull();
  });
});

describe("더블클릭은 기본 위치로 되돌린다", () => {
  it("레일 더블클릭은 저장 위치와 CSS 변수를 지운다", () => {
    installFakeWindow();
    storage.set(POS_KEY, JSON.stringify({ right: 200, bottom: 140 }));
    const surface = renderSurface();
    stubMeasured(surface);
    expect(deckRight(surface.panel)).toBe("200px");

    surface.rail.dispatchEvent(new Event("dblclick"));

    expect(deckRight(surface.panel)).toBe("");
    expect(deckBottom(surface.panel)).toBe("");
    expect(savedPos()).toBeNull();
  });

  it("버튼 위 더블클릭은 리셋하지 않는다", () => {
    installFakeWindow();
    storage.set(POS_KEY, JSON.stringify({ right: 200, bottom: 140 }));
    const surface = renderSurface();
    const collapse = findByTestId(surface.panel, "ai-collapse");
    if (!collapse) throw new Error("collapse button missing");

    collapse.dispatchEvent(new Event("dblclick"));

    expect(deckRight(surface.panel)).toBe("200px");
    expect(savedPos()).toEqual({ right: 200, bottom: 140 });
  });
});
