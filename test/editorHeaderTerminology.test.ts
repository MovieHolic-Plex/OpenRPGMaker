// 에디터 헤더(메뉴바 · 톱바 트레일링 클러스터 · 클래식 툴바) 용어 계약.
//
// 실측 배경(2026-08-30, expert 모드 renderTopbar 를 직접 렌더해 수집):
//  · `toolbar-database` 는 label 만 `uiLabel` 을 지나고 title 에 "데이터베이스" 를 하드코딩했다.
//  · 보관함은 도구 메뉴 "자료 보관함" / 툴바 label "소재" / 툴바 title "자료 보관함" 세 이름.
//  · 음악은 메뉴 "음악·효과음" / 툴바 title "음악/효과음" 로 구분자가 갈렸다.
//  · 찾기는 메뉴 "맵·이벤트 찾기" / 툴바 title "맵/이벤트 찾기" 로 갈렸다.
//  · 한 동작(테스트 실행)에 "시연 실행" · "테스트" · "실행" 세 이름이 붙어 있었다.
//  · `menu.ts` 하단에 "하위"/"상위" 를 반환하는 낡은 `layerShortLabel` 사본이 있어
//    visually-hidden `layer-selector` 가 스크린리더에 폐기 용어를 읽어 줬다.
//
// 계약: 헤더의 사용자 가시 문구는 `src/editor/uiCopy.ts` 한 곳에서만 나온다.
// title/aria-label 은 정본, label 은 정본 또는 *Short 축약형. 설명 문구는 title 의 정본 뒤에
// `—` 로 잇는다(그래서 이름 수집기는 `—` 앞부분만 이름으로 본다).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editorState } from "@/editor/editorState";
import { getEditorChrome, resetEditorUiModeForTests } from "@/editor/editorUiMode";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { uiLabel, type UiCopyKey } from "@/editor/uiCopy";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

const { renderTopbar } = await import("@/editor/panels/menu");

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

let restoreDom: (() => void) | null = null;
let previousWindow: unknown;
let pendingTimers: ReturnType<typeof globalThis.setTimeout>[] = [];

function fake(node: HTMLElement | FakeElement): FakeElement {
  if (node instanceof FakeElement) return node;
  throw new Error("expected FakeElement");
}

function installBrowserGlobals(): void {
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, writable: true, value: storage });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: {
      localStorage: storage,
      innerWidth: 1600,
      innerHeight: 1000,
      setTimeout: ((handler: TimerHandler, timeout?: number) => {
        const handle = globalThis.setTimeout(handler as () => void, timeout);
        pendingTimers.push(handle);
        return handle;
      }) as typeof globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
      requestAnimationFrame: (cb: FrameRequestCallback) => { void cb; return 0; },
      getComputedStyle: () => ({ getPropertyValue: () => "" }),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    },
  });
  Object.defineProperty(document, "documentElement", { configurable: true, value: document.createElement("html") });
  Object.defineProperty(document, "fullscreenElement", { configurable: true, writable: true, value: null });
}

function openMenu(topbar: HTMLElement, menuId: string): void {
  const popupId = `menu-popup-${menuId.replace(/^menu-/, "")}`;
  const body = (): FakeElement => fake(document.body as unknown as HTMLElement);
  const trigger = findByTestId(fake(topbar), menuId);
  trigger?.click();
  // menu.ts 는 열린 팝업을 모듈 상태로 들고 있어 첫 클릭이 남은 팝업을 닫기만 할 수 있다.
  if (!findByTestId(body(), popupId)) trigger?.click();
}

type Finding = { readonly owner: string; readonly text: string };

/**
 * 헤더 표면의 사용자 가시 문구 전부(텍스트 · title · aria-label).
 *
 * 메뉴 팝업은 한 번에 하나만 열린다(menu.ts 가 모듈 상태로 하나를 부잡고 있다) — 그래서
 * 도구·게임 메뉴를 번갈아 여며 두 번 순회해 합친다.
 */
function headerStrings(topbar: HTMLElement): Finding[] {
  const found: Finding[] = [];
  const seen = new Set<string>();
  const walk = (node: FakeElement, inheritedOwner: string): void => {
    const owner = node.dataset.testid ?? inheritedOwner;
    const own = node.children.length === 0 ? node.textContent : null;
    for (const raw of [node.getAttribute("title"), node.getAttribute("aria-label"), own]) {
      if (!raw || !raw.trim()) continue;
      const key = `${owner}\u0000${raw}`;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({ owner, text: raw });
    }
    for (const child of node.children) walk(child, owner);
  };
  for (const menuId of ["menu-project", "menu-tools", "menu-help"]) {
    openMenu(topbar, menuId);
    walk(fake(topbar), "editor-topbar");
    // 메뉴 팝업은 document.body 로 붙는다.
    for (const child of fake(document.body as unknown as HTMLElement).children) walk(child, "menu-popup");
  }
  return found;
}

/** 화면에 나타난 "이름". 설명 꼬리(`— …`)를 떼고 글리프·구두점을 지운다. */
function displayName(raw: string): string {
  const head = raw.split("—")[0] ?? raw;
  return head
    .replace(/[^\p{Script=Hangul}\p{L}\p{N}·\s]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function namesOf(topbar: HTMLElement, testIds: readonly string[]): Set<string> {
  const names = new Set<string>();
  for (const testId of testIds) {
    // 팝업 항목은 그 메뉴가 열려 있을 때만 DOM 에 있다.
    if (testId.startsWith("menu-tools-")) openMenu(topbar, "menu-tools");
    const node = findByTestId(fake(topbar), testId) ?? findByTestId(fake(document.body as unknown as HTMLElement), testId);
    expect(node, `${testId} 가 헤더에 있어야 한다`).not.toBeNull();
    if (!node) continue;
    const collect = (element: FakeElement): void => {
      const own = element.children.length === 0 ? element.textContent : null;
      for (const raw of [element.getAttribute("title"), element.getAttribute("aria-label"), own]) {
        if (!raw || !raw.trim()) continue;
        const name = displayName(raw);
        if (name) names.add(name);
      }
      for (const child of element.children) collect(child);
    };
    collect(node);
  }
  return names;
}

/** 폐기 문자열. 레이어 의미의 "하위"/"상위" 와 `자료` 단독형은 패턴으로 잡는다. */
const RETIRED_PATTERNS: readonly { readonly pattern: RegExp; readonly why: string }[] = [
  { pattern: /자료 보관함/u, why: "보관함 정본은 소재/리소스 보관함이다" },
  { pattern: /자료(?!집)/u, why: "databaseShort 의 `자료` 단독형은 폐기됐다" },
  { pattern: /시연 실행/u, why: "테스트 실행 정본으로 통일했다" },
  { pattern: /음악\/효과음/u, why: "구분자는 가운뎃점 하나다" },
  { pattern: /맵\/이벤트/u, why: "구분자는 가운뎃점 하나다" },
  { pattern: /검색/u, why: "이 표면의 이름은 찾기다" },
  { pattern: /하위/u, why: "레이어 이름은 바닥이다" },
  { pattern: /상위/u, why: "레이어 이름은 덧그림이다" },
];

type HeaderMode = "standard" | "expert";

type ConceptCase = {
  readonly concept: string;
  readonly canonical: UiCopyKey;
  readonly short?: UiCopyKey;
  /** 모드별 집. 표준은 세계관·음악·찾기가 「도구 ▾」 메뉴 항목이고, 전문가는 인라인 아이콘 버튼이다. */
  readonly homes: Readonly<Record<HeaderMode, readonly string[]>>;
};

const CONCEPTS: readonly ConceptCase[] = [
  { concept: "DB 편집기", canonical: "database", short: "databaseShort", homes: { standard: ["toolbar-database"], expert: ["toolbar-database"] } },
  { concept: "보관함", canonical: "resourceLibrary", short: "resources", homes: { standard: ["toolbar-resource-manager"], expert: ["toolbar-resource-manager"] } },
  { concept: "세계관", canonical: "world", homes: { standard: ["menu-tools-world"], expert: ["toolbar-world"] } },
  { concept: "음악·효과음", canonical: "audio", short: "audioShort", homes: { standard: ["menu-tools-audio"], expert: ["toolbar-sound-test"] } },
  { concept: "맵·이벤트 찾기", canonical: "mapEventSearch", short: "mapEventSearchShort", homes: { standard: ["menu-tools-search"], expert: ["toolbar-search"] } },
  { concept: "테스트 실행", canonical: "testPlay", short: "testPlayShort", homes: { standard: ["mode-play"], expert: ["mode-play"] } },
  { concept: "랜덤 전투 테스트", canonical: "battleTest", short: "battleTestShort", homes: { standard: ["topbar-battle-test"], expert: ["topbar-battle-test"] } },
];

/** title 이 정확히 정본이어야 하는 톱바 도구 버튼(전문가는 다섯 개가 모두 버튼이다). */
const TITLE_IS_CANONICAL: readonly { readonly testId: string; readonly key: UiCopyKey }[] = [
  { testId: "toolbar-database", key: "database" },
  { testId: "toolbar-resource-manager", key: "resourceLibrary" },
  { testId: "toolbar-sound-test", key: "audio" },
  { testId: "toolbar-search", key: "mapEventSearch" },
  { testId: "toolbar-world", key: "world" },
];

function renderExpertTopbar(): HTMLElement {
  return renderTopbarFor("expert");
}

function renderTopbarFor(mode: HeaderMode): HTMLElement {
  resetEditorUiModeForTests(mode);
  const topbar = document.createElement("div");
  renderTopbar(topbar);
  return topbar;
}

beforeEach(() => {
  previousWindow = globalThis.window;
  restoreDom = installFakeDom();
  installBrowserGlobals();
  store.replace(createBlankProject());
  editorState.set({
    currentMapId: store.getCurrent().startMapId,
    layer: "lower",
    tool: "paint",
    selectedEventId: null,
  });
});

afterEach(async () => {
  // menu.ts 는 바깥 클릭 리스너를 window.setTimeout(..., 0) 으로 미룬다 — 그 콜백이
  // document 를 만지므로 fake DOM 이 살아 있는 동안 큐를 비운다.
  await new Promise<void>((resolve) => { globalThis.setTimeout(resolve, 0); });
  for (const handle of pendingTimers) globalThis.clearTimeout(handle);
  pendingTimers = [];
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
  Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: previousWindow });
  resetEditorUiModeForTests("standard");
  vi.restoreAllMocks();
});

describe("에디터 헤더 용어", () => {
  it("헤더 어디에도 폐기된 용어가 남지 않는다", () => {
    // Break: 헤더 문구를 uiCopy 대신 다시 손으로 적어 넣는다.
    const topbar = renderExpertTopbar();

    const violations = headerStrings(topbar)
      .flatMap(({ owner, text }) =>
        RETIRED_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ why }) => `${owner}: "${text}" (${why})`),
      );

    expect(violations, `폐기 용어가 헤더에 남아 있다:\n${violations.join("\n")}`).toEqual([]);
  });

  for (const mode of ["standard", "expert"] as const) {
    for (const { concept, canonical, short, homes } of CONCEPTS) {
      it(`${mode}: ${concept} 은 정본${short ? "(+축약)" : ""} 이름만 화면에 낸다`, () => {
        // Break: 같은 동작이 표면마다 다른 이름으로 불린다.
        const topbar = renderTopbarFor(mode);
        const style = getEditorChrome().jargonStyle;
        const allowed = new Set<string>([uiLabel(canonical, style), ...(short ? [uiLabel(short, style)] : [])]);

        const names = namesOf(topbar, homes[mode]);

        expect(names.has(uiLabel(canonical, style)), `${concept} 정본이 헤더에 없다: ${[...names].join(" / ")}`).toBe(true);
        const extra = [...names].filter((name) => !allowed.has(name));
        expect(extra, `${concept} 에 정본/축약 밖의 이름이 있다: ${extra.join(" / ")}`).toEqual([]);
      });
    }
  }

  it("톱바 도구 버튼 title 은 정확히 uiCopy 정본이다", () => {
    // Break: 툴바 title 을 손으로 적어 정본과 어긋난다.
    const topbar = renderExpertTopbar();
    const style = getEditorChrome().jargonStyle;

    for (const { testId, key } of TITLE_IS_CANONICAL) {
      const button = findByTestId(fake(topbar), testId);
      expect(button, testId).not.toBeNull();
      expect(button?.getAttribute("title"), testId).toBe(uiLabel(key, style));
    }
  });

  it("헤더에 찾기 표면은 하나다 — 커맨드 팔레트는 명령 실행기로 이름을 낸다", () => {
    // Break: 팔레트 버튼이 다시 `명령·맵·스킬 찾기` 처럼 말하면 한 헤더에 찾기 표면이 둘이 되고,
    // 둘 다 "맵을 찾는다" 고 주장해 사용자가 어느 것을 쓸지 구별할 수 없다.
    // 게다가 조수 스킬은 2026-08-27 에 삭제된 기능이라 없는 것을 광고하는 이름이다.
    const topbar = renderExpertTopbar();
    const style = getEditorChrome().jargonStyle;
    const canonical = uiLabel("mapEventSearch", style);

    const palette = findByTestId(fake(topbar), "workspace-command-palette-button");
    expect(palette, "workspace-command-palette-button").not.toBeNull();
    const paletteTitle = palette?.getAttribute("title") ?? "";
    expect(paletteTitle, "삭제된 조수 스킬을 광고하면 안 된다").not.toContain("스킬");
    expect(paletteTitle, "찾기 표면 이름을 나눠 쓰면 안 된다").not.toBe(canonical);
    expect(paletteTitle, "팔레트는 찾기 표면이 아니다").not.toMatch(/찾기/u);
    // 같은 버튼의 title 과 aria-label 은 한 이름을 쓴다 — 한쪽이 「명령 실행 · 맵 이동」,
    // 다른 쪽이 「명령 팔레트 열기」면 이 작업이 지우려는 분열을 그대로 재생산하는 것이다.
    const paletteName = "명령 팔레트";
    expect(displayName(paletteTitle), "title 은 정본 이름으로 시작하고 설명은 — 뒤에 단다").toBe(paletteName);
    expect(palette?.getAttribute("aria-label") ?? "", "aria-label 도 같은 이름을 쓴다").toContain(paletteName);

    // 헤더 전체에서 `…찾기` 로 끝나는 이름은 맵·이벤트 찾기 정본과 그 축약뿐이다.
    const allowed = new Set([canonical, uiLabel("mapEventSearchShort", style)]);
    const findingSurfaces = new Set(
      headerStrings(topbar)
        .map(({ text }) => displayName(text))
        .filter((name) => name.endsWith("찾기")),
    );
    const strays = [...findingSurfaces].filter((name) => !allowed.has(name));
    expect(strays, `찾기 표면이 둘 이상이다: ${strays.join(" / ")}`).toEqual([]);
  });
});
