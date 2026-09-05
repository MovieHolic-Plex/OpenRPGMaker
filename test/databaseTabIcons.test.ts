// DB 사이드바 탭 아이콘 계약.
//
// 이 파일이 막는 사고는 실제로 일어난 것들이다:
//   1. 아이콘을 CSS per-testid `content` 글리프로 뿌렸더니 29개 탭 중 24개만 덮여서
//      생활 탭 5개(생활 기술·제작 / 계절·날씨 / 동물·축사 / 농장 건물 / 낚시·채집)가
//      `content: attr(data-short)` 폴백의 **한글 첫 글자**로 떴다.
//   2. system-studio.css 가 같은 `::before` 를 `content: none !important` 로 이겨서
//      시스템 탭을 열면 1100px 이상에서 레일 아이콘이 전부 사라졌다.
//   3. 글리프 계열이 섞여 있었다 — 체스 기물, 기하 도형, 맥 커맨드키, 텍스트("Aa").
//
// 그래서 소유권을 CSS 에서 `databaseTabIcons.ts` 로 옮겼고, `Record<DatabaseTab, …>` 로
// 못 박아 누락이 컴파일 에러가 되게 했다. 아래 단정은 그 이동이 되돌려지지 않게 지킨다.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderDatabasePanel, setDatabaseActiveTab, TAB_GROUPS } from "@/editor/panels/database";
import { DATABASE_TAB_ICONS, makeDatabaseTabIcon } from "@/editor/panels/databaseTabIcons";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, installFakeDom } from "./fakeDom";

const root = resolve(__dirname, "..");
const read = (rel: string): string => readFileSync(resolve(root, rel), "utf8");

/** 레일 아이콘을 배분하거나 죽일 수 있는 DB 시트 전부. */
const DB_SIDEBAR_SHEETS = [
  "src/styles/database/sidebar.css",
  "src/styles/database/system-studio.css",
];

const RAIL_TABS = ["overview", ...TAB_GROUPS.flatMap((group) => group.tabs)] as const;

let restoreDom: (() => void) | undefined;
let previousWindow: typeof globalThis.window | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
  previousWindow = globalThis.window;
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => void storage.set(key, value),
        removeItem: (key: string) => void storage.delete(key),
      },
    },
  });
  store.replace(createBlankProject());
  setDatabaseActiveTab("actors");
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
  if (previousWindow === undefined) {
    Reflect.deleteProperty(globalThis, "window");
    return;
  }
  Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
});

describe("database tab icons", () => {
  // Break caught: a tab ships without an icon and silently falls back to a Korean letter.
  it("covers every rail tab, overview included", () => {
    expect(RAIL_TABS.length).toBe(33);
    const missing = RAIL_TABS.filter((tab) => !DATABASE_TAB_ICONS[tab]);
    expect(missing, "탭에 아이콘이 없다 — TAB_ICONS 에 추가할 것").toEqual([]);
  });

  it("builds each icon to the house SVG spec with drawable children", () => {
    for (const tab of RAIL_TABS) {
      const svg = makeDatabaseTabIcon(tab);
      expect(svg.getAttribute("viewBox"), `${tab} viewBox`).toBe("0 0 22 22");
      expect(svg.getAttribute("stroke"), `${tab} stroke`).toBe("currentColor");
      expect(svg.getAttribute("fill"), `${tab} fill`).toBe("none");
      expect(svg.getAttribute("class"), `${tab} class`).toBe("db-tab-icon");
      // aria-hidden 이어야 버튼의 접근 가능한 이름이 라벨 텍스트로 남는다(G006).
      expect(svg.getAttribute("aria-hidden"), `${tab} aria-hidden`).toBe("true");
      expect(svg.getAttribute("focusable"), `${tab} focusable`).toBe("false");
      const children = (svg as unknown as FakeElement).children;
      expect(children.length, `${tab} 은 그릴 노드가 없다`).toBeGreaterThan(0);
      for (const child of children) {
        expect(["PATH", "RECT", "CIRCLE", "LINE"], `${tab} child ${child.tagName}`).toContain(
          child.tagName,
        );
      }
    }
  });

  it("hardcodes no colors — stroke follows currentColor so themes and the collapsed rail work", () => {
    const source = read("src/editor/panels/databaseTabIcons.ts");
    const colors = source.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/gu);
    expect(colors, "아이콘 스펙에 색 리터럴이 있다 — currentColor 만 쓴다").toBeNull();
  });

  it("uses no emoji or pictographic glyphs", () => {
    const source = read("src/editor/panels/databaseTabIcons.ts");
    const pictographs = source.match(/\p{Extended_Pictographic}/gu);
    expect(pictographs, "이모지는 폰트마다 다르게 렌더된다 — SVG 로 그릴 것").toBeNull();
  });

  // Break caught: a stylesheet reclaims the icon slot and the two owners fight again.
  it("keeps icon ownership out of CSS — no content glyphs, no data-short fallback", () => {
    for (const sheet of DB_SIDEBAR_SHEETS) {
      const css = read(sheet).replace(/\/\*[\s\S]*?\*\//gu, "");
      expect(css, `${sheet} 에 attr(data-short) 가 남아 있다`).not.toMatch(/attr\(\s*data-short/u);
      // `.db-tab` 계열에 `content:` 를 다시 붙이면 아이콘 소유자가 둘로 갈라진다.
      // `\.db-tab(?![-\w])` — 탭 버튼만 본다. `.db-tab-group::after` 의 꺾쇠는 정당한
      // CSS `content` 이고(그룹 헤더 장식), 아이콘 소유권과 무관하다.
      // `(?<![-\w])content` — 그게 없으면 `justify-content:` 가 걸린다.
      const tabRules = (css.match(/[^{}]*\.db-tab(?![-\w])[^{}]*\{[^}]*\}/gu) ?? []).filter(
        (rule) => /(?<![-\w])content\s*:/u.test(rule),
      );
      // 카운트 배지(`[data-count]::after`)는 텍스트를 그리는 게 목적이라 예외다.
      const glyphRules = tabRules.filter((rule) => !/\[data-count\]/u.test(rule));
      expect(glyphRules, `${sheet} 의 .db-tab 규칙이 content 로 글리프를 그린다`).toEqual([]);
    }
  });

  it("renders the icon as the first child while the label owns textContent", () => {
    const panelRoot = document.createElement("div") as unknown as FakeElement;
    panelRoot.className = "database-modal-body";
    renderDatabasePanel(panelRoot as unknown as HTMLElement);

    const buttons = panelRoot.querySelectorAll(".db-tab");
    expect(buttons.length).toBe(33);
    for (const button of buttons) {
      const icon = button.children[0];
      expect(icon?.tagName.toLowerCase(), `${button.dataset.testid} first child`).toBe("svg");
      expect(icon?.getAttribute("class")).toBe("db-tab-icon");
      // <svg> 자손은 텍스트 노드를 안 가지므로 라벨이 textContent 를 그대로 소유한다.
      const label = (button.textContent ?? "").trim();
      expect(label.length, `${button.dataset.testid} label`).toBeGreaterThan(0);
      expect(button.getAttribute("aria-label")).toBe(label);
      expect(button.getAttribute("title")).toBe(label);
    }
  });
});
