// 탈-쯔구르 회귀 그물 (2026-08-21)
//
// 변호사 지적: 제품이 RPG 쯔구르(RPG Maker / RPG 만들기 / ツクール)의 UI·UX·정체성을
// 재현하고 있어 벗어나야 한다. 가장 위험했던 것은 이름이 아니라 **자백 문장**이었다 —
// helpModal 개요에 "RPG 만들기 2000/2003의 감성과 작업 방식을 본따 만들었고" 가 실려
// 출하되고 있었고, 「정보」 메뉴 토스트는 "RPG 쯔꾸르 - RM2000/2003 스타일 웹 에디터" 였다.
//
// 이 스펙은 소스를 직접 읽어 그 부류의 문자열이 **다시 들어오지 못하게** 막는다.
// e2e 로 렌더된 DOM 을 보는 검사(test/e2e/_detsukuru-brand.spec.ts)와 짝이다 —
// 이쪽은 브라우저 없이 돌아 CI 에서 싸고, 저쪽은 실제 화면을 본다.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PRODUCT_BRAND, PRODUCT_SLUG, PRODUCT_TAGLINE } from "@/brand";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC_ROOT = join(REPO_ROOT, "src");

/** 사용자에게 보이거나 출하 번들에 들어가는 확장자만 훑는다. */
const SCANNED_EXTENSIONS = new Set([".ts", ".tsx", ".css", ".html", ".json", ".webmanifest"]);

/**
 * 상표·계보 표현. 개별 단어는 일반명사일 수 있으나(예: "maker") 아래 형태는
 * RPG Maker 제품군을 특정한다.
 *
 * **표시형만 잡는다.** 공백으로 띄운 "RPG MAKER" / "RPG ZZU" 는 사람이 읽는 문자열이라
 * 여기서 막고, 식별자형(`rpgMakerTileToolbar`, `__rpgzzuCamera`, `rm2k3-tool-button`,
 * `rpg-zzu:` 저장 키)은 **Phase 2b(DOM 지문 개명)** 범위다. 지금 막으면 그 라운드까지
 * 상시 빨강이 되어 그물이 무력해지므로, 2b 가 끝나면 아래에 식별자 패턴을 추가한다.
 *
 * 그 밖의 의도적 제외:
 * - `RTP` 단독 — EasyRPG RTP 대체본 출처 표기에 쓰인다(Phase 5 에서 표시명 정리 예정).
 */
const FORBIDDEN_PATTERNS: readonly { readonly label: string; readonly re: RegExp }[] = [
  { label: "RPG Maker 제품명", re: /RPG\s+MAKER/i },
  { label: "RPG 만들기(한국 정식 제품명)", re: /RPG\s*만들기/ },
  { label: "쯔꾸르 / 쯔구르 (ツクール 음차)", re: /쯔꾸르|쯔구르/ },
  { label: "ツクール", re: /ツクール/ },
  { label: "tkool", re: /tkool/i },
  { label: "구 제품명 RPG ZZU", re: /RPG\s+ZZU/i },
];

/**
 * 아직 켜지 않은 패턴 — 켜는 순간 상시 빨강이 되므로 해당 라운드가 끝난 뒤 위로 옮긴다.
 * 실측 잔여 건수는 각 항목에 적어 둔다(2026-08-21 기준).
 *
 * | 패턴                  | 잔여 | 어디에                                          | 켜는 라운드 |
 * |-----------------------|------|------------------------------------------------|-------------|
 * | /RM\s*200[03]/i       | 7+   | 코드 주석(동작 계보 서술), CSS 파일·클래스명,     | Phase 2b·3  |
 * |                       |      | `--runtime-window-skin: windowskin-rm2003.png` | Phase 5     |
 * | /rm2k3/i (식별자)      | 1889 | CSS 클래스·testid·파일명                        | Phase 2b    |
 * | /rpgMaker/ (식별자)    | —    | `rpgMakerTileToolbar*.ts` 심볼·파일명            | Phase 2b    |
 * | /rpg-zzu:/ (저장 키)   | 43   | localStorage 키 접두사                          | Phase 2b    |
 * | /__rpgzzu/ (전역)      | ~30  | window 디버그·e2e 훅                            | Phase 2b    |
 *
 * 특히 `windowskin-rm2003.png` 은 **모든 게임의 기본 대사창 스킨**이다 — 이름만 문제가
 * 아니라 그림 자체가 RM2003 창을 재현하는지 Phase 5 출처 조사에서 함께 확인해야 한다.
 */
const STAGED_PATTERN_NOTE = "Phase 2b·3·5 에서 활성화";

/**
 * 위 미활성 패턴 중 `RM2000/RM2003` 은 **주석·CSS 파일명**에는 남아 있어도 되지만
 * **사용자에게 보이는 라벨**에는 안 된다. 실제로 이 구멍으로 두 곳이 빠져나갔다:
 * 전투 스킨 라벨(`label: "RM2003"`)과 적 그룹 편집의 「RM2003」 버튼.
 * 그래서 라벨 형태 — 따옴표로 감싼 짧은 UI 문자열 — 만 따로 잡는다.
 */
const LABEL_LIKE_FORBIDDEN: readonly { readonly label: string; readonly re: RegExp }[] = [
  { label: "라벨에 RM2000/RM2003", re: /(?:label|text|title|aria-label)\s*:\s*"[^"]*RM\s*200[03][^"]*"/i },
  { label: "actionButton 첫 인자에 RM2000/RM2003", re: /actionButton\(\s*"[^"]*RM\s*200[03][^"]*"/i },
  { label: "라벨에 VX Ace", re: /(?:label|text|title|aria-label)\s*:\s*"[^"]*VX\s*Ace[^"]*"/i },
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
      continue;
    }
    if (SCANNED_EXTENSIONS.has(extname(entry))) out.push(full);
  }
  return out;
}

/**
 * 면제 목록 — 각 항목에 이유와 해제 조건을 남긴다. 이유 없는 추가 금지.
 *
 * 1. `src/brand.ts` — 금지어 목록 자체를 주석으로 들고 있다. 영구 면제.
 *
 * 2. 전투 스킨 CSS (`src/styles/runtime/battle-skins/`) — 파일명·선택자가 `_rm2003.css`,
 *    `[data-battle-skin="vxace"]` 처럼 **식별자**다. 스킨 id 는 프로젝트 파일에 저장되어
 *    바꾸면 사용자 설정이 깨지므로 Phase 2b(식별자 개명 + 마이그레이션) 범위다.
 *    라벨(사용자에게 보이는 문자열)은 이미 중립화됐고 registry.ts 는 면제하지 않는다.
 *
 * 미결(감독 판단 대기): 전투 스킨 라벨 8개가 여전히 닌텐도·스퀘어에닉스 계열
 * 프랜차이즈 이름이다 — 포켓몬·옥토패스·크로노 트리거·브레이블리·드퀘·FF 정통·
 * 마더/언더·골든선. 변호사 지적은 RPG Maker 계열이었고 그 4개(RM2003·RM2000·
 * RPG Maker MV·VX Ace)는 2026-08-21 에 중립 서술어로 교체했다. 아래 패턴은 RPG Maker
 * 계열만 잡으므로 8개는 걸리지 않는다 — 감독이 정하면 패턴을 추가할 자리다.
 */
const EXEMPT_PREFIXES: readonly string[] = [
  "src/brand.ts",
  "src/styles/runtime/battle-skins/",
];

function isExempt(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  return EXEMPT_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(prefix));
}

describe("탈-쯔구르: 출하 문자열", () => {
  it("src 안에 RPG Maker 계보 표현이 남아 있지 않다", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC_ROOT)) {
      const rel = relative(REPO_ROOT, file);
      if (isExempt(rel)) continue;
      const lines = readFileSync(file, "utf8").split(/\r?\n/);
      lines.forEach((line, index) => {
        for (const { label, re } of FORBIDDEN_PATTERNS) {
          if (re.test(line)) offenders.push(`${rel.replace(/\\/g, "/")}:${index + 1} [${label}] ${line.trim().slice(0, 120)}`);
        }
      });
    }
    expect(offenders, `금지 표현 ${offenders.length}건:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("엔트리 HTML·manifest 에도 남아 있지 않다", () => {
    const entries = ["index.html", "player.html", "public/manifest.webmanifest"];
    const offenders: string[] = [];
    for (const entry of entries) {
      const text = readFileSync(join(REPO_ROOT, entry), "utf8");
      for (const { label, re } of FORBIDDEN_PATTERNS) {
        if (re.test(text)) offenders.push(`${entry} [${label}]`);
      }
    }
    expect(offenders, `금지 표현:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("브랜드 상수 자체가 금지 표현을 담지 않는다", () => {
    for (const value of [PRODUCT_BRAND, PRODUCT_SLUG, PRODUCT_TAGLINE]) {
      for (const { label, re } of FORBIDDEN_PATTERNS) {
        expect(re.test(value), `${label} 가 "${value}" 안에 있다`).toBe(false);
      }
    }
  });

  it("브랜드 상수가 비어 있지 않다", () => {
    expect(PRODUCT_BRAND.trim()).not.toBe("");
    expect(PRODUCT_SLUG).toMatch(/^[a-z][a-z0-9-]*$/);
    expect(PRODUCT_TAGLINE.trim()).not.toBe("");
  });

  // 아직 못 잡는 것을 눈에 보이게 남긴다 — 면제 목록이 조용히 늘어나면 그물이 무력해진다.
  it("면제·미활성 목록이 문서화되어 있다", () => {
    expect(STAGED_PATTERN_NOTE).toContain("Phase");
    expect(EXEMPT_PREFIXES.length).toBeLessThanOrEqual(2);
  });

  // 전투 스킨 라벨은 자료집→시스템 드롭다운에 그대로 뿌려진다(databaseSystemView.ts).
  // id 는 저장 데이터라 못 바꾸지만 라벨은 사용자에게 보이는 문자열이므로 여기서 지킨다.
  it("전투 스킨 라벨에 RPG Maker 계열 이름이 없다", async () => {
    const { BATTLE_SKINS } = await import("@/battle/skins/registry");
    const patterns = [...FORBIDDEN_PATTERNS, { label: "RM2000/RM2003", re: /RM\s*200[03]/i }, { label: "VX Ace", re: /VX\s*Ace/i }];
    const offenders = Object.values(BATTLE_SKINS)
      .map((skin) => skin.label)
      .filter((label) => patterns.some(({ re }) => re.test(label)));
    expect(offenders, `금지 라벨: ${offenders.join(", ")}`).toEqual([]);
  });

  // 주석·CSS 파일명의 RM2000/RM2003 은 Phase 2b·3 범위지만, **라벨**에 들어가면 즉시 문제다.
  it("UI 라벨 형태에 RM2000/RM2003·VX Ace 가 없다", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC_ROOT)) {
      const rel = relative(REPO_ROOT, file).replace(/\\/g, "/");
      if (isExempt(rel)) continue;
      const lines = readFileSync(file, "utf8").split(/\r?\n/);
      lines.forEach((line, index) => {
        for (const { label, re } of LABEL_LIKE_FORBIDDEN) {
          if (re.test(line)) offenders.push(`${rel}:${index + 1} [${label}] ${line.trim().slice(0, 120)}`);
        }
      });
    }
    expect(offenders, `금지 라벨 ${offenders.length}건:\n${offenders.join("\n")}`).toEqual([]);
  });
});
