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
import ts from "typescript";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC_ROOT = join(REPO_ROOT, "src");

/** 사용자에게 보이거나 출하 번들에 들어가는 확장자만 훑는다. */
const SCANNED_EXTENSIONS = new Set([".ts", ".tsx", ".css", ".html", ".json", ".webmanifest"]);

/**
 * 상표·계보 표현. 개별 단어는 일반명사일 수 있으나(예: "maker") 아래 형태는
 * RPG Maker 제품군을 특정한다.
 *
 * 표시형(공백으로 띄운 "RPG MAKER" / "RPG ZZU")과 **식별자형**을 모두 잡는다.
 * 식별자형은 Phase 2b(DOM 지문 개명, 2026-08-21)가 끝난 뒤 활성화했다 — 그 전에 켜면
 * 1,800줄이 상시 빨강이라 그물이 무력해진다. 활성화 시점 실측: 잔여 0건.
 *
 * 그 밖의 의도적 제외:
 * - `RTP` 단독 — 남은 것은 **식별자·트랙 코드**다: `EASYRPG_RTP_ASSETS` 심볼,
 *   `rtp-manifest.json` 경로, bgmCatalog 의 `trackCode: "RTP-FLD-001"`(원본 카탈로그 대조용).
 *   사용자에게 보이던 표시명 205건은 2026-08-23 에 정리했다 — 생성기
 *   `scripts/sync-easyrpg-rtp-assets.mjs` 의 displayName 이 `"Arrow · 전투 효과 · EasyRPG"`
 *   형태를 낸다. 재발은 아래 LABEL_LIKE_FORBIDDEN 이 막는다.
 * - 에셋 경로(`/assets/…/rm2k3/…png`) — 파일을 옮겨야 하므로 Phase 5 범위. 아래
 *   isExempt 가 아니라 스캔 시 경로 줄을 건너뛰는 방식으로 처리한다.
 */
const FORBIDDEN_PATTERNS: readonly { readonly label: string; readonly re: RegExp }[] = [
  { label: "RPG Maker 제품명", re: /RPG\s+MAKER/i },
  { label: "RPG 만들기(한국 정식 제품명)", re: /RPG\s*만들기/ },
  { label: "쯔꾸르 / 쯔구르 (ツクール 음차)", re: /쯔꾸르|쯔구르/ },
  { label: "ツクール", re: /ツクール/ },
  { label: "tkool", re: /tkool/i },
  { label: "구 제품명 RPG ZZU", re: /RPG\s+ZZU/i },
  // ── 식별자형 (Phase 2b 완료 후 활성) ──────────────────────────────
  { label: "CSS 클래스·testid 접두사 rm2k3-", re: /rm2k3-/ },
  { label: "CSS 클래스·testid 접두사 rpg-maker-", re: /rpg-maker-/ },
  { label: "아이콘 클래스 접두사 rm-tool-icon-", re: /rm-tool-icon-/ },
  { label: "심볼 접두사 rpgMaker", re: /rpgMaker/ },
  { label: "window 전역 __rpgzzu", re: /__rpgzzu/ },
  { label: "구 저장 키 접두사 rpg-zzu", re: /rpg-zzu[:.]/ },
  { label: "심볼 접두사 RM2K3_", re: /RM2K3_/ },
];

/**
 * `rpg-zzu-` (하이픈)은 **데이터 식별자**여서 위 패턴에 넣지 않았다. 남아 있는 것과 이유 —
 *
 * · `DEFAULT_SUPABASE_PROJECT_ID = "rpg-zzu-house-template-gallery"` 와
 *   `iceDiagonalTerrain` 의 `projectId` — **원격 Supabase 레코드를 가리킨다.** 바꾸면
 *   그 프로젝트를 못 찾는다. 서버 쪽 마이그레이션과 함께 다뤄야 한다.
 * · 타이틀 리소스 id 구 이름(`rpg-zzu-title-*`) — generatedAssetResourceResolver 에
 *   **읽기 별칭으로만** 남아 있다. 새로 쓰는 곳은 모두 `oprn-title-*` 를 쓴다.
 *   지우면 사용자가 만든 기존 프로젝트의 타이틀 화면이 빈 화면이 된다.
 *
 * 사용자에게 보이던 것(내보내기 기본 파일명 `rpg-zzu-project.oprn` / `rpg-zzu-game-web.zip`)은
 * 2026-08-21 에 교체했다.
 */
const DATA_ID_NOTE = "rpg-zzu- 데이터 식별자는 서버·프로젝트 파일 호환 때문에 남는다";

/**
 * 에셋 경로가 있는 줄은 건너뛴다 — 파일을 옮기지 않으면 로드가 깨진다(Phase 5).
 * 예: `/assets/generated/starter/hero-01-battle.png`, `assets/easyrpg-chipset-exterior.png`
 */
const ASSET_PATH_LINE = /\/assets\/|assets\/|\.png|\.jpe?g|\.webp/;

/**
 * 아직 켜지 않은 패턴 — 켜는 순간 상시 빨강이 되므로 해당 라운드가 끝난 뒤 위로 옮긴다.
 * 실측 잔여 건수는 각 항목에 적어 둔다(2026-08-21 기준).
 *
 * | 패턴                  | 잔여 | 어디에                                          | 켜는 라운드 |
 * |-----------------------|------|------------------------------------------------|-------------|
 * | /RM\s*200[03]/i       | 7+   | 코드 주석(동작 계보 서술), CSS 파일·클래스명,     | Phase 2b·3  |
 * |                       |      | `--runtime-window-skin: windowskin-default.png` | Phase 5     |
 * | /rm2k3/i (식별자)      | 1889 | CSS 클래스·testid·파일명                        | Phase 2b    |
 * | /rpgMaker/ (식별자)    | —    | `rpgMakerTileToolbar*.ts` 심볼·파일명            | Phase 2b    |
 * | /rpg-zzu:/ (저장 키)   | 43   | localStorage 키 접두사                          | Phase 2b    |
 * | /__oprn/ (전역)      | ~30  | window 디버그·e2e 훅                            | Phase 2b    |
 *
 * `windowskin-default.png` 출처는 확인됐다(2026-08-23) — public/assets/ATTRIBUTION.md
 * 기준 **우리가 생성한 9-slice** 이고 RM2003 창 그림을 옮겨 온 것이 아니다. 기본 타일
 * 그림판(`easyrpg-chipset-exterior.png`)도 vendor/easyrpg-rtp/ChipSet/Exterior.png 와
 * IHDR·PLTE·IDAT 가 바이트 동일하고 tRNS(팔레트 0번 투명) 한 청크만 더해진 사본이다 —
 * 픽셀은 JasonPerry 의 CC0 대체본이며 Enterbrain 자산이 아니다.
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
  // `RTP` 는 Enterbrain 의 용어다 — 표시명·라벨에서 2026-08-23 에 뺐고(205건) 다시 못 들어오게
  // 막는다. 식별자·트랙 코드는 잡지 않는다(위 주석 참조).
  //
  // 키에 따옴표가 붙는 **JSON 형태**도 잡는다(`"name": "…"`). 이게 필요한 이유 —
  // `fixtures/dew-village-demo.json` 이 생성 당시의 표시명을 저장된 리소스 이름으로
  // 223건 들고 있었다. 같은 날 defaultResourceProfiles() 산출값으로 교정하고 Supabase
  // 데모 행(rpg-zzu-dew-village)에도 재장해 양쪽을 맞췄다.
  { label: "표시명·라벨에 RTP", re: /(?:name|label|text|title|aria-label)"?\s*:\s*"[^"]*\bRTP\b/ },
];

/**
 * 타사 프랜차이즈 이름 — **라벨에만** 금지한다.
 *
 * 2026-08-21 적대 스캔에서 발견: 자료집→시스템의 전투 스킨 드롭다운이 이 이름 12개를
 * 사용자에게 그대로 뿌리고 있었다. 변호사 지적은 RPG Maker 계열이었지만 노출의 성격이
 * 같으므로 전부 창 색·레이아웃 서술어로 바꿨다.
 *
 * 왜 라벨 형태만 잡나 — 이 단어들은 **정당한 문맥**에도 나온다. 데모 프로젝트 이름
 * (`Scarloxy 포켓몬풍 데모`), 파일·리소스 id(`battle-skin-dragonquest-backdrop`),
 * 그리고 "포켓몬풍 전투를 만들어 달라" 같은 사용자 의도 문구. 전면 금지하면 그런
 * 정상 사용까지 막히고 그물이 무력해진다.
 */
const FRANCHISE_LABEL_FORBIDDEN: readonly { readonly label: string; readonly re: RegExp }[] = [
  { label: "라벨에 포켓몬", re: /label\s*:\s*"[^"]*포켓몬[^"]*"/ },
  { label: "라벨에 옥토패스", re: /label\s*:\s*"[^"]*옥토패스[^"]*"/ },
  { label: "라벨에 크로노 트리거", re: /label\s*:\s*"[^"]*크로노[^"]*"/ },
  { label: "라벨에 브레이블리", re: /label\s*:\s*"[^"]*브레이블리[^"]*"/ },
  { label: "라벨에 드퀘/드래곤 퀘스트", re: /label\s*:\s*"[^"]*(?:드퀘|드래곤\s*퀘스트|Dragon\s*Quest)[^"]*"/i },
  // `FF` 는 단어 시작에서만 잡는다 — "OFF / 금지" 처럼 다른 단어 끝의 FF 는 오탐이다(실측).
  { label: "라벨에 FF/파이널 판타지", re: /label\s*:\s*"(?:[^"]*\s)?(?:FF\s|파이널\s*판타지|Final\s*Fantasy)[^"]*"/i },
  { label: "라벨에 마더/언더테일", re: /label\s*:\s*"[^"]*(?:마더\/|언더테일|Undertale)[^"]*"/i },
  { label: "라벨에 골든선", re: /label\s*:\s*"[^"]*골든선[^"]*"/ },
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
 * 3. `src/util/appStorage.ts` — 구 저장 키 접두사 4종을 **값으로** 들고 있다. 그게 이
 *    파일의 존재 이유(기존 사용자 데이터 이관)이므로 영구 면제. 접두사가 실제로 코드에서
 *    쓰이는지는 test/appStorageMigration.test.ts 가 형태별로 검증한다.
 *
 * 미결(감독 판단 대기): 전투 스킨 라벨 8개가 여전히 닌텐도·스퀘어에닉스 계열
 * 프랜차이즈 이름이다 — 포켓몬·옥토패스·크로노 트리거·브레이블리·드퀘·FF 정통·
 * 마더/언더·골든선. 변호사 지적은 RPG Maker 계열이었고 그 4개(RM2003·RM2000·
 * RPG Maker MV·VX Ace)는 2026-08-21 에 중립 서술어로 교체했다. 위 패턴은 RPG Maker
 * 계열만 잡으므로 8개는 걸리지 않는다 — 감독이 정하면 패턴을 추가할 자리다.
 */
const EXEMPT_PREFIXES: readonly string[] = [
  "src/brand.ts",
  "src/util/appStorage.ts",
  "src/styles/runtime/battle-skins/",
];

function isExempt(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  return EXEMPT_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(prefix));
}

function shippingSource(source: string, extension: string): string {
  if (extension === ".ts" || extension === ".tsx") {
    const file = ts.createSourceFile(`source${extension}`, source, ts.ScriptTarget.Latest, true);
    return ts.createPrinter({ removeComments: true }).printFile(file);
  }
  return source;
}

describe("탈-쯔구르: 출하 문자열", () => {
  it("comment filtering retains machine identifiers and comment-like string contents", () => {
    const source = shippingSource('// __rpgzzu\n/* __rpgzzu */\nconst __rpgzzu = "/* __rpgzzu */";', ".ts");
    expect(source.match(/__rpgzzu/gu)).toHaveLength(2);
    expect(source).toContain('"/* __rpgzzu */"');
  });
  it("src 안에 RPG Maker 계보 표현이 남아 있지 않다", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC_ROOT)) {
      const rel = relative(REPO_ROOT, file);
      if (isExempt(rel)) continue;
      // Source comments document compatibility/history but are not shipped UI or identifiers.
      const lines = shippingSource(readFileSync(file, "utf8"), extname(file)).split(/\r?\n/);
      lines.forEach((line, index) => {
        if (ASSET_PATH_LINE.test(line)) return;
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
    expect(DATA_ID_NOTE).toContain("데이터 식별자");
    expect(EXEMPT_PREFIXES.length).toBeLessThanOrEqual(3);
  });

  // 전투 스킨 라벨은 자료집→시스템 드롭다운에 그대로 뿌려진다(databaseSystemView.ts).
  // id 는 저장 데이터라 못 바꾸지만 라벨은 사용자에게 보이는 문자열이므로 여기서 지킨다.
  it("전투 스킨 라벨에 타사 제품·프랜차이즈 이름이 없다", async () => {
    const { BATTLE_SKINS } = await import("@/battle/skins/registry");
    const patterns = [
      ...FORBIDDEN_PATTERNS,
      { label: "RM2000/RM2003", re: /RM\s*200[03]/i },
      { label: "VX Ace", re: /VX\s*Ace/i },
      { label: "포켓몬", re: /포켓몬/ },
      { label: "옥토패스", re: /옥토패스/ },
      { label: "크로노", re: /크로노/ },
      { label: "브레이블리", re: /브레이블리/ },
      { label: "드퀘/드래곤 퀘스트", re: /드퀘|드래곤\s*퀘스트/ },
      { label: "FF/파이널 판타지", re: /^FF\s|파이널\s*판타지/i },
      { label: "마더/언더테일", re: /마더\/|언더테일/ },
      { label: "골든선", re: /골든선/ },
    ];
    const offenders = Object.values(BATTLE_SKINS)
      .map((skin) => skin.label)
      .filter((label) => patterns.some(({ re }) => re.test(label)));
    expect(offenders, `금지 라벨: ${offenders.join(", ")}`).toEqual([]);
  });

  // 12개가 서로 구분돼야 한다 — 같은 이름이 둘이면 감독이 드롭다운에서 못 고른다.
  it("전투 스킨 라벨 12개가 모두 다르다", async () => {
    const { BATTLE_SKINS } = await import("@/battle/skins/registry");
    const labels = Object.values(BATTLE_SKINS).map((skin) => skin.label);
    expect(new Set(labels).size, `중복: ${labels.join(", ")}`).toBe(labels.length);
    for (const label of labels) expect(label.trim()).not.toBe("");
  });

  // 라벨 형태의 프랜차이즈 이름은 registry 밖(다른 패널 라벨)에도 들어오면 안 된다.
  it("어떤 UI 라벨에도 타사 프랜차이즈 이름이 없다", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC_ROOT)) {
      const rel = relative(REPO_ROOT, file).replace(/\\/g, "/");
      if (isExempt(rel)) continue;
      readFileSync(file, "utf8")
        .split(/\r?\n/)
        .forEach((line, index) => {
          if (ASSET_PATH_LINE.test(line)) return;
          for (const { label, re } of FRANCHISE_LABEL_FORBIDDEN) {
            if (re.test(line)) offenders.push(`${rel}:${index + 1} [${label}] ${line.trim().slice(0, 110)}`);
          }
        });
    }
    expect(offenders, `금지 라벨 ${offenders.length}건:\n${offenders.join("\n")}`).toEqual([]);
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
