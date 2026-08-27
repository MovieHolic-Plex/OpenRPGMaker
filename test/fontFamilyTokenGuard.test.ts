// 폰트 단일 진실 공급원 가드.
//
// 통일 작업의 수명은 이 테스트가 결정한다. 스윕만 하고 가드가 없으면 다음 기능 브랜치가
// font-family 를 다시 하드코딩하고, 저자가 DB 에서 글꼴을 바꿔도 그 영역만 안 따라온다 —
// 통일 이전 상태로 조용히 되돌아간다. 그래서 소비지점의 형태 자체를 기계로 고정한다.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(__dirname, "..");
const srcRoot = join(repoRoot, "src");

/** 글꼴 스택 자체를 선언할 자격이 있는 유일한 두 파일. */
const FONT_DECLARATION_OWNERS: readonly string[] = [
  "src/styles/tokens.css",
  "src/project/fontRegistry.ts",
];

const STYLE_EXTENSIONS = [".css"] as const;

const ROLE_TOKENS: readonly string[] = ["--font-ui", "--font-mono", "--font-pixel", "--font-serif"];

const GENERIC_FAMILY = /\b(sans-serif|serif|monospace|cursive|fantasy|system-ui|ui-monospace|ui-sans-serif)\b/u;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function cssFiles(): string[] {
  return walk(srcRoot).filter((file) => STYLE_EXTENSIONS.some((ext) => file.endsWith(ext)));
}

/**
 * `@font-face` 블록을 지운다. 그 안의 font-family 는 글꼴 **정의**(woff2 등록)이지
 * 소비지점이 아니므로 토큰으로 바꿀 수 없다.
 */
function stripFontFaceBlocks(css: string): string {
  return css.replace(/@font-face\s*\{[^}]*\}/gu, "");
}

function offendingDeclarations(css: string): string[] {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//gu, "");
  const scanned = stripFontFaceBlocks(withoutComments);
  return [...scanned.matchAll(/font-family\s*:\s*([^;}]+)/gu)].map((match) => match[1].trim());
}

/** `--name: value` 선언 전체를 모은다. 같은 이름이 여러 번 선언되면 값을 모두 보관한다. */
function customPropertyDeclarations(files: readonly string[]): Map<string, string[]> {
  const declarations = new Map<string, string[]>();
  for (const file of files) {
    const css = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//gu, "");
    for (const match of css.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/gu)) {
      const values = declarations.get(match[1]) ?? [];
      values.push(match[2].trim());
      declarations.set(match[1], values);
    }
  }
  return declarations;
}

/**
 * 값이 역할 토큰까지 **전이적으로** 도달하는지 본다.
 *
 * `--runtime-pixel-font: var(--font-pixel)` 처럼 의미 있는 별칭 한 단계는 정당한 CSS 다.
 * 금지 대상은 별칭 뒤에 숨은 리터럴 스택이며, 실제로 `--mk-mono` 가 그렇게 네 번째 진실
 * 공급원으로 남아 있었다. 그래서 소비지점 문자열만 보지 않고 체인을 끝까지 따라간다.
 */
function resolvesToRoleToken(
  value: string,
  declarations: Map<string, string[]>,
  seen: ReadonlySet<string> = new Set(),
): boolean {
  const reference = value.match(/^var\(\s*(--[\w-]+)/u);
  if (!reference) return false;
  const name = reference[1];
  if (ROLE_TOKENS.includes(name)) return true;
  if (seen.has(name)) return false;
  const targets = declarations.get(name);
  if (!targets || targets.length === 0) return false;
  const nextSeen = new Set([...seen, name]);
  return targets.every((target) => resolvesToRoleToken(target, declarations, nextSeen));
}

describe("폰트 토큰 가드", () => {
  it("소비지점 CSS 의 모든 font-family 가 역할 토큰까지 도달한다", () => {
    const files = cssFiles();
    const declarations = customPropertyDeclarations(files);
    const violations: string[] = [];
    for (const file of files) {
      const rel = relative(repoRoot, file).split("\\").join("/");
      if (FONT_DECLARATION_OWNERS.includes(rel)) continue;
      for (const value of offendingDeclarations(readFileSync(file, "utf8"))) {
        const bare = value.replace(/\s*!important$/u, "").trim();
        if (bare === "inherit") continue;
        if (resolvesToRoleToken(bare, declarations)) continue;
        violations.push(`${rel}: font-family: ${value}`);
      }
    }
    expect(violations).toEqual([]);
  });

  // 소비지점이 아직 없는 리터럴 별칭은 위 규칙을 통과하므로 선언 쪽도 따로 막는다.
  it("소유 파일 밖의 커스텀 프로퍼티는 리터럴 글꼴 스택을 선언하지 않는다", () => {
    const violations: string[] = [];
    for (const file of cssFiles()) {
      const rel = relative(repoRoot, file).split("\\").join("/");
      if (FONT_DECLARATION_OWNERS.includes(rel)) continue;
      const css = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//gu, "");
      for (const match of css.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/gu)) {
        const [, name, rawValue] = match;
        const value = rawValue.trim();
        if (value.startsWith("var(")) continue;
        if (!GENERIC_FAMILY.test(value)) continue;
        violations.push(`${rel}: ${name}: ${value}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("tokens.css 가 네 역할 토큰을 모두 선언한다", () => {
    const tokens = readFileSync(join(repoRoot, "src/styles/tokens.css"), "utf8");
    for (const token of ["--font-ui", "--font-mono", "--font-pixel", "--font-serif"]) {
      expect(tokens).toContain(`${token}:`);
    }
  });

  it("런타임 픽셀 폰트 별칭이 자기 스택을 다시 선언하지 않는다", () => {
    const css = readFileSync(join(repoRoot, "src/styles/runtime/system.css"), "utf8");
    const declarations = [...css.matchAll(/--runtime-pixel-font\s*:\s*([^;]+);/gu)].map((match) => match[1].trim());
    expect(declarations).toEqual(["var(--font-pixel)"]);
  });

  it("Phaser 캔버스 텍스트는 리터럴 스택 대신 레지스트리를 쓴다", () => {
    const canvasCallSites = [
      "src/editor/editSceneEventMarkers.ts",
      "src/player/playSceneActionCombat.ts",
    ];
    for (const rel of canvasCallSites) {
      const source = readFileSync(join(repoRoot, rel), "utf8");
      const literals = [...source.matchAll(/fontFamily\s*:\s*"([^"]*)"/gu)].map((match) => match[1]);
      expect(literals, `${rel} 에 리터럴 fontFamily 가 남아 있다`).toEqual([]);
    }
  });

  // 기본값을 직접 읽으면 DB → 시스템 → 폰트에서 고른 선택을 캔버스 텍스트만 무시하게 된다.
  it("캔버스 텍스트가 기본값이 아니라 현재 프로젝트 선택을 읽는다", () => {
    for (const rel of ["src/editor/editSceneEventMarkers.ts", "src/player/playSceneActionCombat.ts"]) {
      const source = readFileSync(join(repoRoot, rel), "utf8");
      expect(source, `${rel} 은 projectFontStack 을 서야 한다`).toContain("projectFontStack");
      expect(
        source,
        `${rel} 이 DEFAULT_FONT_SELECTION 을 직접 읽으면 자자 선택이 무시된다`,
      ).not.toContain("DEFAULT_FONT_SELECTION");
    }
  });
});
