// Database Studio v2 (2026-09-03) — 셸 브레드크럼과 통합 스타일시트의 계약.
//
// 30개 탭이 공유하는 셸·레일·목록·폼 문법을 studio-v2.css 한 층으로 접었다. 이 파일은
// 그 층이 조용히 무너지는 세 경로를 막는다:
//   1. 헤더 브레드크럼이 활성 탭을 따라가지 않으면 "어디를 편집하고 있나" 가 다시 사라진다.
//   2. 시트가 database/modern/* 뒤에서 읽히지 않으면 두 세대 목록 창이 다시 갈라진다.
//   3. 시트에 `!important` · hex · 글꼴 스택 리터럴이 들어오면 예산 래칫과 폰트 가드가 깨지고,
//      다음 사람은 또 "고쳤는데 안 먹는" 함정을 밟는다.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { openDatabaseModal, requestDatabaseModalClose } from "@/editor/panels/databaseModal";
import { databaseTabLabel, setDatabaseActiveTab } from "@/editor/panels/database";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { installFakeDom } from "./fakeDom";

const root = resolve(__dirname, "..");
const read = (rel: string): string => readFileSync(resolve(root, rel), "utf8");
const stripComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//gu, "");

let restoreDom: (() => void) | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
  store.replace(createBlankProject());
  resetMapEditHistory();
});

afterEach(() => {
  requestDatabaseModalClose("battleTest");
  document.querySelector("[data-testid='database-modal']")?.remove();
  restoreDom?.();
  restoreDom = undefined;
});

function crumbText(): string {
  const crumb = document.querySelector<HTMLElement>("[data-testid='database-modal-crumb']");
  if (!crumb) throw new Error("브레드크럼이 없다");
  return (crumb.textContent ?? "").replace(/\s+/g, "");
}

describe("데이터베이스 모달 헤더 — 현재 위치 브레드크럼", () => {
  it("keeps the primary and nested Map ancestors in the real modal breadcrumb", () => {
    openDatabaseModal("worldGen");
    const crumb = document.querySelector<HTMLElement>("[data-testid='database-modal-crumb']")!;
    const parts = Array.from(crumb.querySelectorAll<HTMLElement>(".database-modal-crumb-tab"));
    expect(parts.map((part) => part.dataset.tab)).toEqual(["scratchConcepts", "villages", "worldGen"]);
    expect(parts.map((part) => part.textContent)).toEqual(["scratchConcepts", "villages", "worldGen"].map((tab) => databaseTabLabel(tab as "scratchConcepts" | "villages" | "worldGen")));
    setDatabaseActiveTab("terrain");
    expect(Array.from(crumb.querySelectorAll<HTMLElement>(".database-modal-crumb-tab")).map((part) => part.dataset.tab)).toEqual(["tilesets", "terrain"]);
    setDatabaseActiveTab("tilesetAutotile");
    expect(Array.from(crumb.querySelectorAll<HTMLElement>(".database-modal-crumb-tab")).map((part) => part.dataset.tab)).toEqual(["tilesets"]);
  });

  it("열 때 활성 탭의 그룹 › 탭 을 적는다", () => {
    openDatabaseModal("skills");
    expect(crumbText()).toBe("파티›스킬");
    // fakeDom 셀렉터 엔진은 콤비네이터·태그 선택을 지원하지 않는다 — 헤더 텍스트로 본다.
    const header = document.querySelector<HTMLElement>(".database-modal-header");
    expect(header?.textContent ?? "").toContain("데이터베이스");
  });

  it("활성 탭이 바뀌면 따라간다 — 레일 클릭·G006 점프·Ctrl+T 전부 같은 setter 를 지난다", () => {
    openDatabaseModal("skills");
    setDatabaseActiveTab("enemies");
    expect(crumbText()).toBe("몬스터›몬스터");
    setDatabaseActiveTab("switches");
    expect(crumbText()).toBe("시스템›스위치");
  });

  it("개요처럼 그룹 밖 탭은 탭 이름만 남긴다", () => {
    openDatabaseModal("overview");
    expect(crumbText()).toBe("개요");
    expect(document.querySelector(".database-modal-crumb-sep")).toBeNull();
  });

  it("창 컨트롤은 텍스트 글리프가 아니라 SVG 아이콘이다", () => {
    openDatabaseModal("actors");
    for (const testid of ["database-dock-toggle", "database-modal-maximize", "database-modal-close"]) {
      const button = document.querySelector<HTMLElement>(`[data-testid='${testid}']`);
      expect(button, testid).not.toBeNull();
      expect((button?.textContent ?? "").trim(), `${testid} 는 글자를 담지 않는다`).toBe("");
      // fakeDom 은 setAttribute("class") 를 className 에 반영하지 않으므로 자식 태그와 속성으로 본다.
      const icon = button?.children[0] as HTMLElement | undefined;
      expect(icon?.tagName.toLowerCase(), `${testid} 아이콘 태그`).toBe("svg");
      expect(icon?.getAttribute("class"), `${testid} 아이콘 클래스`).toBe("database-modal-icon");
      expect(button?.getAttribute("aria-label"), `${testid} 접근성 이름`).toBeTruthy();
    }
  });
});

describe("studio-v2.css — 통합 시트의 불변식", () => {
  const css = read("src/styles/database/studio-v2.css");
  const body = stripComments(css);

  it("index.css 에서 database/modern/* 뒤, 다른 영역 시트 앞에 읽힌다", () => {
    const lines = read("src/styles/index.css").split("\n").map((line) => line.trim()).filter((line) => line.startsWith("@import"));
    const v2 = lines.findIndex((line) => line.includes("database/studio-v2.css"));
    const lastModern = lines.reduce((last, line, index) => (line.includes("database/modern/") ? index : last), -1);
    const resources = lines.findIndex((line) => line.includes("resources/resource-manager.css"));
    expect(v2, "studio-v2.css 가 import 되지 않았다").toBeGreaterThan(-1);
    expect(v2).toBeGreaterThan(lastModern);
    expect(v2).toBeLessThan(resources);
  });

  it("form-hierarchy-modern.css 를 흡수했다 — 옛 시트가 되살아나면 히어로 규칙이 둘이 된다", () => {
    const indexCss = read("src/styles/index.css");
    expect(indexCss).not.toContain("form-hierarchy-modern.css");
    expect(() => read("src/styles/database/form-hierarchy-modern.css")).toThrow();
  });

  it("!important 를 쓰지 않는다 — 앞선 층의 !important 는 그 층에서 값을 고친다", () => {
    expect(body).not.toMatch(/!important/u);
  });

  it("hex 리터럴을 쓰지 않는다 — 색은 --db-studio-* 토큰과 color-mix 로만", () => {
    // data-URI 안의 %23 은 hex 가 아니다(예산 래칫과 같은 판정).
    expect(body.match(/#[0-9a-fA-F]{3,8}\b/gu) ?? []).toEqual([]);
  });

  it("글꼴은 var(--font-ui) / var(--font-mono) 만 — 스택 리터럴 금지", () => {
    const families = [...body.matchAll(/font(?:-family)?\s*:\s*([^;}]+)/gu)].map((match) => match[1]);
    const literal = families.filter((value) => /"|'|Malgun|Segoe|sans-serif|monospace/u.test(value));
    expect(literal).toEqual([]);
  });

  it("모든 규칙이 .database-modal-backdrop 아래에 스코프된다", () => {
    const selectors = body.match(/[^{}]+(?=\s*\{)/gu) ?? [];
    const offenders = selectors
      .map((selector) => selector.trim())
      .filter((selector) => selector.length > 0 && !selector.startsWith("@") && !selector.startsWith(".database-modal-backdrop"));
    expect(offenders).toEqual([]);
  });

  it("속성 행 라벨은 말줄임하지 않는다 — 「이동 간격(…」 재발 방지", () => {
    const label = /\.database-modal-body \.db-field > span:first-child \{[^}]*\}/u.exec(body)?.[0] ?? "";
    expect(label).toMatch(/white-space:\s*normal/u);
    expect(label).toMatch(/word-break:\s*keep-all/u);
    expect(label).not.toMatch(/text-overflow:\s*ellipsis/u);
  });

  it("select 에는 padding 단축을 쓰지 않는다 — chevron 밴드 24px 를 지킨다", () => {
    const selectRule = /\.database-modal-body select \{[^}]*\}/u.exec(body)?.[0] ?? "";
    expect(selectRule).toMatch(/padding-right:\s*24px/u);
    expect(selectRule).not.toMatch(/(^|[;{\s])padding\s*:/u);
  });

  it("상세 본문(세로 flex)의 자식은 줄어들지 않는다 — 지형 요약 띠가 2px 로 짜부라지던 함정", () => {
    const children = /\.db-ws-detail-body > \* \{[^}]*\}/u.exec(body)?.[0] ?? "";
    expect(children).toMatch(/flex-shrink:\s*0/u);
  });

  it("보조 칩이 있는 목록 행은 이름도 칩도 자르지 않고 줄을 바꾼다 — 「킹슬…」·「연결만 있음 · 이벤…」", () => {
    const row = /\.db-list-row:has\(> \.db-list-sub\) \{[^}]*\}/u.exec(body)?.[0] ?? "";
    expect(row).toMatch(/flex-wrap:\s*wrap/u);
    const name = /\.db-list-row \.db-list-name \{[^}]*\}/u.exec(body)?.[0] ?? "";
    expect(name).toMatch(/min-width:\s*0/u);
    expect(name).not.toMatch(/min-width:\s*min\(/u);
    const sub = /\.db-list-row \.db-list-sub \{[^}]*\}/u.exec(body)?.[0] ?? "";
    expect(sub).toMatch(/max-width:\s*100%/u);
  });

  it("스테퍼는 격자가 아니라 flex — 좁은 칸(≤120px)에서 단추가 접히면 입력이 남는 폭을 받는다", () => {
    const stepper = /\.database-modal-body \.db-number-stepper \{[^}]*\}/u.exec(body)?.[0] ?? "";
    expect(stepper).toMatch(/display:\s*inline-flex/u);
    expect(stepper).not.toMatch(/grid-template-columns/u);
    // @container 는 특이성을 올려주지 않는다 — 접는 규칙은 위 display 규칙과 같은 깊이여야 이긴다.
    const fold = /@container \(max-width: 120px\) \{\s*([^{]+)\{([^}]*)\}/u.exec(body);
    expect(fold?.[1].trim()).toBe(".database-modal-backdrop .database-modal-window .database-modal-body .db-number-stepper-button");
    expect(fold?.[2]).toMatch(/display:\s*none/u);
  });
});
