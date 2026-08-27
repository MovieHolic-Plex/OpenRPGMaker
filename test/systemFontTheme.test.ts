// 폰트 통일 계약 — 레지스트리 · SystemRecords.fonts 정규화 · DOM 적용.
//
// 지켜야 할 불변식:
//   1. 레지스트리가 선택 가능한 글꼴의 유일한 목록이다(에디터 UI · 런타임 · 캔버스 텍스트 공용).
//   2. 기본값은 이 변경 **이전의** 스택과 글자 단위로 같다 — 손대지 않은 프로젝트는 렌더가 안 바뀐다.
//   3. tokens.css 의 --font-ui / --font-pixel / --font-mono 선언이 레지스트리 기본 스택과 일치한다.
//      (JS 레지스트리와 CSS 단일 진실 공급원이 갈라지면 폰트 통일 자체가 무의미해진다.)
//   4. normalizeSystemRecords 는 화이트리스트다 — fonts 가 여기 없으면 저장/로드 1회 왕복에 사라진다.
//      실제로 skillSystem 이 그렇게 사라진 전례가 databaseRecordModel.ts 주석에 남아 있다.
//   5. 기본값과 같은 선택은 저장하지 않는다(battleUiStyle · battleModel 과 같은 관례).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyProjectFontTheme } from "@/app/fontTheme";
import {
  DEFAULT_FONT_SELECTION,
  FONT_REGISTRY,
  fontOptionsForRole,
  isFontFamilyId,
  resolveFontSelection,
  resolveFontStack,
} from "@/project/fontRegistry";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { installFakeDom } from "./fakeDom";

const repoRoot = resolve(__dirname, "..");
const readText = (rel: string): string => readFileSync(resolve(repoRoot, rel), "utf8");

/** tokens.css 의 커스텀 프로퍼티 값을 읽는다(여러 줄 선언 허용, 주석 제거 후). */
function tokenValue(css: string, name: string): string {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//gu, "");
  const match = stripped.match(new RegExp(`${name}\\s*:\\s*([^;]+);`, "u"));
  if (!match) throw new Error(`tokens.css 에 ${name} 선언이 없다`);
  return match[1].replace(/\s+/gu, " ").trim();
}

describe("폰트 레지스트리", () => {
  it("id 가 중복되지 않고 모든 엔트리가 비어 있지 않은 스택과 역할을 갖는다", () => {
    const ids = FONT_REGISTRY.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of FONT_REGISTRY) {
      expect(entry.stack.trim().length).toBeGreaterThan(0);
      expect(entry.label.trim().length).toBeGreaterThan(0);
      expect(entry.roles.length).toBeGreaterThan(0);
    }
  });

  it("번들된 픽셀 글꼴 3종이 pixel 역할로 선택 가능하다", () => {
    const pixelIds = fontOptionsForRole("pixel").map((entry) => entry.id);
    expect(pixelIds).toContain("neodgm");
    expect(pixelIds).toContain("galmuri11");
    expect(pixelIds).toContain("galmuri9");
  });

  it("역할별 기본 선택이 레지스트리에 존재하고 그 역할을 실제로 지원한다", () => {
    for (const role of ["ui", "pixel", "mono"] as const) {
      const id = DEFAULT_FONT_SELECTION[role];
      expect(isFontFamilyId(id)).toBe(true);
      const entry = FONT_REGISTRY.find((candidate) => candidate.id === id);
      expect(entry?.roles).toContain(role);
    }
  });

  it("isFontFamilyId 가 미등록 id 를 거부한다", () => {
    expect(isFontFamilyId("neodgm")).toBe(true);
    expect(isFontFamilyId("comic-sans")).toBe(false);
    expect(isFontFamilyId(undefined)).toBe(false);
    expect(isFontFamilyId(42)).toBe(false);
  });

  it("tokens.css 의 폰트 토큰이 레지스트리 기본 스택과 일치한다", () => {
    const tokens = readText("src/styles/tokens.css");
    expect(tokenValue(tokens, "--font-ui")).toBe(resolveFontStack(DEFAULT_FONT_SELECTION.ui));
    expect(tokenValue(tokens, "--font-pixel")).toBe(resolveFontStack(DEFAULT_FONT_SELECTION.pixel));
    expect(tokenValue(tokens, "--font-mono")).toBe(resolveFontStack(DEFAULT_FONT_SELECTION.mono));
  });

  it("runtime/system.css 가 --runtime-pixel-font 를 --font-pixel 의 별칭으로 둔다", () => {
    const css = readText("src/styles/runtime/system.css");
    expect(tokenValue(css, "--runtime-pixel-font")).toBe("var(--font-pixel)");
  });
});

describe("SystemRecords.fonts 정규화", () => {
  it("등록된 선택을 저장/로드 왕복에서 보존한다", () => {
    const normalized = normalizeSystemRecords({
      startActorIds: [],
      fonts: { ui: "galmuri11", pixel: "galmuri9", mono: "neodgm" },
    });
    expect(normalized.fonts).toEqual({ ui: "galmuri11", pixel: "galmuri9", mono: "neodgm" });

    // 두 번째 왕복에서도 동일해야 한다 — 화이트리스트 누락은 1회 왕복 뒤에 드러난다.
    expect(normalizeSystemRecords(normalized).fonts).toEqual({
      ui: "galmuri11",
      pixel: "galmuri9",
      mono: "neodgm",
    });
  });

  it("미등록 id 는 버리고 남은 유효 선택만 유지한다", () => {
    const normalized = normalizeSystemRecords({
      startActorIds: [],
      fonts: { ui: "comic-sans", pixel: "galmuri9" } as never,
    });
    expect(normalized.fonts).toEqual({ pixel: "galmuri9" });
  });

  it("기본값과 같은 선택은 저장하지 않는다", () => {
    const normalized = normalizeSystemRecords({
      startActorIds: [],
      fonts: { ui: DEFAULT_FONT_SELECTION.ui, pixel: "galmuri9" },
    });
    expect(normalized.fonts).toEqual({ pixel: "galmuri9" });
  });

  it("빈 객체 · 유효 선택 없음 · 비객체는 fonts 키 자체를 남기지 않는다", () => {
    expect(normalizeSystemRecords({ startActorIds: [], fonts: {} }).fonts).toBeUndefined();
    expect(normalizeSystemRecords({ startActorIds: [], fonts: { ui: "nope" } as never }).fonts).toBeUndefined();
    expect(normalizeSystemRecords({ startActorIds: [], fonts: "neodgm" as never }).fonts).toBeUndefined();
    expect(normalizeSystemRecords({ startActorIds: [], fonts: null as never }).fonts).toBeUndefined();
    expect(normalizeSystemRecords({ startActorIds: [] }).fonts).toBeUndefined();
  });

  it("resolveFontSelection 이 생략된 역할을 기본값으로 채운다", () => {
    expect(resolveFontSelection(undefined)).toEqual(DEFAULT_FONT_SELECTION);
    expect(resolveFontSelection({ pixel: "galmuri9" })).toEqual({
      ...DEFAULT_FONT_SELECTION,
      pixel: "galmuri9",
    });
    expect(resolveFontSelection({ ui: "comic-sans" } as never)).toEqual(DEFAULT_FONT_SELECTION);
  });
});

describe("applyProjectFontTheme", () => {
  let cleanupDom: (() => void) | undefined;

  beforeEach(() => {
    cleanupDom = installFakeDom();
  });

  afterEach(() => {
    cleanupDom?.();
    cleanupDom = undefined;
  });

  it("선택한 글꼴 스택을 세 CSS 변수로 루트에 심는다", () => {
    const project = createBlankProject();
    project.system.fonts = { ui: "galmuri11", pixel: "galmuri9", mono: "neodgm" };
    const root = document.createElement("div");

    applyProjectFontTheme(project, root);

    expect(root.style.getPropertyValue("--font-ui")).toBe(resolveFontStack("galmuri11"));
    expect(root.style.getPropertyValue("--font-pixel")).toBe(resolveFontStack("galmuri9"));
    expect(root.style.getPropertyValue("--font-mono")).toBe(resolveFontStack("neodgm"));
  });

  it("fonts 가 없으면 기본 스택을 심어 tokens.css 와 같은 값을 유지한다", () => {
    const project = createBlankProject();
    delete project.system.fonts;
    const root = document.createElement("div");

    applyProjectFontTheme(project, root);

    expect(root.style.getPropertyValue("--font-ui")).toBe(resolveFontStack(DEFAULT_FONT_SELECTION.ui));
    expect(root.style.getPropertyValue("--font-pixel")).toBe(resolveFontStack(DEFAULT_FONT_SELECTION.pixel));
    expect(root.style.getPropertyValue("--font-mono")).toBe(resolveFontStack(DEFAULT_FONT_SELECTION.mono));
  });

  it("선택을 되돌리면 이전 선택이 남지 않는다", () => {
    const project = createBlankProject();
    const root = document.createElement("div");

    project.system.fonts = { ui: "galmuri11" };
    applyProjectFontTheme(project, root);
    expect(root.style.getPropertyValue("--font-ui")).toBe(resolveFontStack("galmuri11"));

    delete project.system.fonts;
    applyProjectFontTheme(project, root);
    expect(root.style.getPropertyValue("--font-ui")).toBe(resolveFontStack(DEFAULT_FONT_SELECTION.ui));
  });
});
