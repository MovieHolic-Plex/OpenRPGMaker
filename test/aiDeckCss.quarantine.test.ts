// 조수 데크 CSS 계약 (2026-09-03). 브라우저 레이아웃 결과는 fakeDom 으로 못 잡으므로 원문을 읽어 잠근다.
// 지키는 것: (1) 표면 단일 소유자 — 13~17 레이어가 되살아나지 않는다, (2) 새 hex 0 · !important 0,
// (3) 데크·레일·알약 상태 규칙이 존재한다, (4) import 목록이 18·19 를 싣고 13~17 을 싣지 않는다.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { readCssFamily } from "./cssFamily";

const ROOT = process.cwd();
const DIR = "src/styles/database/tabs-b-assistant-panel";
const DECK = `${DIR}/18-assistant-deck.css`;
const CARDS = `${DIR}/19-assistant-cards.css`;
const MANIFEST = "src/styles/database/tabs-b-assistant-panel.css";
const DELETED = [
  "13-assistant-modern.css",
  "14-assistant-ux-repair.css",
  "15-assistant-readable.css",
  "16-modern-change-first.css",
  "17-assistant-modern-shell.css",
] as const;

function read(path: string): string {
  return readFileSync(resolve(ROOT, path), "utf8");
}

/** 주석을 걷은 원문 — check-css-budget.mjs 와 같은 이유(주석 속 hex/!important 는 규칙이 아니다). */
function rulesOnly(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//gu, "");
}

describe("조수 데크 CSS 계약", () => {
  it("데크·카드 파일이 있고 13~17 레이어는 없다", () => {
    // Break: 누가 옛 레이어를 되살리거나 18/19 를 다른 이름으로 갈아치운다.
    expect(existsSync(resolve(ROOT, DECK))).toBe(true);
    expect(existsSync(resolve(ROOT, CARDS))).toBe(true);
    for (const name of DELETED) {
      expect(existsSync(resolve(ROOT, `${DIR}/${name}`)), name).toBe(false);
    }
  });

  it("import 목록은 18·19 를 싣고 13~17 을 싣지 않는다", () => {
    // Break: manifest 가 옛 레이어를 다시 import 해 캐스케이드가 두 소유자를 갖는다.
    const manifest = read(MANIFEST);
    expect(manifest).toContain("18-assistant-deck.css");
    expect(manifest).toContain("19-assistant-cards.css");
    for (const name of DELETED) expect(manifest, name).not.toContain(name);
    // 18 은 컴포저 시트 뒤에 와야 특이도가 같은 규칙에서도 이긴다.
    expect(manifest.indexOf("assistant-composer.css")).toBeLessThan(manifest.indexOf("18-assistant-deck.css"));
  });

  it("새 파일은 hex 리터럴 0 · !important 0 이다(토큰만 쓴다)", () => {
    // Break: 색을 hex 로 박거나 캐스케이드를 !important 로 이긴다 — CSS 예산 게이트가 잡기 전에 여기서 잡는다.
    for (const path of [DECK, CARDS]) {
      const css = rulesOnly(readCssFamily("src/styles/database/index.css", path));
      expect(css.match(/#[0-9a-fA-F]{3,8}\b/gu) ?? [], `${path} hex`).toEqual([]);
      expect(css.match(/!\s*important/gu) ?? [], `${path} important`).toEqual([]);
    }
  });

  it("데크 표면·레일·상태·알약 규칙이 있다", () => {
    // Break: 선택자 이름이 바뀌어 TS 가 붙이는 클래스와 어긋난다.
    const css = rulesOnly(readCssFamily("src/styles/database/index.css", DECK));
    for (const selector of [
      ".ai-deck",
      ".ai-deck-rail",
      ".ai-deck-rail-dot[data-ai-state=\"run\"]",
      ".ai-deck-rail-dot[data-ai-state=\"attention\"]",
      ".ai-deck-rail[data-ai-state=\"run\"]::before",
      ".ai-collapsed-restore[data-ai-state=\"attention\"]",
      ".ai-composer-effort-select",
      ".ai-command-menu-meta",
      ".ai-suggest-row",
    ]) {
      expect(css, selector).toContain(selector);
    }
    // The existing glass owner consumes the background preference, never element opacity.
    expect(css).toContain("color-mix(in srgb, var(--bg-raised) var(--ai-background-opacity, 82%), transparent)");
    expect(css.match(/saturate\(([\d.]+)\)/gu)?.every((m) => Number(m.slice(9, -1)) <= 1.08)).toBe(true);
    // @> 글리프는 화면에서 걷는다(DOM 계약은 aiConversationLog 테스트가 지킨다).
    expect(css).toMatch(/\.ai-chat-log \.ai-command-prefix\s*\{\s*display:\s*none;/u);
  });

  it("데크 입력칸은 유리 위에서도 보인다 — inset 필드 + 입력칸 직접 포커스 링", () => {
    // Break: 데크 오버라이드가 입력 배경·테두리를 transparent/0 으로 지우면 "어디에 치는지" 안 보인다(2026-09-04).
    const css = rulesOnly(readCssFamily("src/styles/database/index.css", DECK));
    const blockOf = (selector: string): string => {
      const start = css.indexOf(selector);
      expect(start, selector).toBeGreaterThanOrEqual(0);
      const open = css.indexOf("{", start);
      const close = css.indexOf("}", open);
      return css.slice(open, close);
    };
    const composer = blockOf(":is(.ai-deck, .ai-studio-composer) .ai-composer {");
    expect(composer).toContain("border-top: 1px solid var(--ai-deck-line)");
    const input = blockOf(":is(.ai-deck, .ai-studio-composer) .ai-composer .ai-assistant-input {");
    expect(input).toContain("background: var(--bg-inset)");
    expect(input).toContain("border: 1px solid var(--border-default)");
    expect(input).not.toContain("transparent");
    // 포커스 링은 셸(:focus-within — 데크 셸은 border:0)이 아니라 입력칸이 직접 그린다.
    const focus = blockOf(":is(.ai-deck, .ai-studio-composer) .ai-composer .ai-assistant-input:focus,");
    expect(focus).toContain("border-color: var(--accent-border)");
    expect(focus).toContain("color-mix(in srgb, var(--accent) 14%, transparent)");
    expect(focus).not.toContain("box-shadow: none");
  });

  it("영수증 카드는 지금/적용 후 쌍과 되돌리기 버튼 규칙을 갖고 넓은 뷰어 z 계산식을 지킨다", () => {
    // Break: 카드 규칙 이관에서 뷰어의 z-index 식이 빠지거나 하드코딩된다(editorZLayerOrder 와 짝).
    const css = rulesOnly(readCssFamily("src/styles/database/index.css", CARDS));
    expect(css).toContain(".ai-change-pair");
    expect(css).toContain(".ai-change-undo");
    expect(css).toContain(".ai-change-wide");
    expect(css).toContain("calc(var(--z-app-modal) + 20)");
  });
});
