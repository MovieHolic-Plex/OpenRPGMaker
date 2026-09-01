import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { LEGACY_ROLE_CAPABILITIES } from "@/project/tileRoles";

/**
 * A-2 완료 게이트 — 타일 역할 이름의 문자열 비교가 늘어나면 실패한다.
 *
 * 비교 대상 어휘는 LEGACY_ROLE_CAPABILITIES 의 키에서 가져온다. 하드코딩하지
 * 않는 이유는 A-3 에서 표에 역할이 추가될 때 게이트가 자동으로 따라가야 하기
 * 때문이다(역할을 표에서 빼서 게이트를 피하려면 표를 고쳐야 하고, 그건 눈에
 * 띈다).
 *
 * `\brole ===` 로 잡으므로 `group.role ===` 과 지역변수 `role ===` 둘 다
 * 걸린다. 단어 경계가 `paletteRole ===` 같은 다른 식별자를 막는다.
 *
 * 어휘를 역할 이름으로 좁힌 이유: `\brole === "<소문자>"` 만으로 열어 두면
 * 100 줄이 걸리는데 대부분이 **다른 role 축**이다 — LLM 대화 역할
 * (`message.role === "user"`), 패턴 파트 역할(`part.role === "center"`),
 * 레이아웃 구역 역할(`region.role === "plaza"`), 직업 역할
 * (`role === "caster"`), 그리고 `typeof meta.role === "string"` 타입 가드.
 * 이들은 타일 역할과 무관하므로 허용 목록을 불리는 대신 정규식을 좁혔다.
 */
const ROLE_NAMES = Object.keys(LEGACY_ROLE_CAPABILITIES);
const ROLE_COMPARISON = new RegExp(`\\brole\\s*===\\s*["'](?:${ROLE_NAMES.join("|")})["']`);

/**
 * 남겨 둔 곳과 그 줄 수. 줄 수까지 박는 이유는 파일 단위 면제만 두면 이미
 * 면제된 파일에 새 역할 비교가 슬쩍 들어와도 게이트가 조용하기 때문이다.
 *
 * 각 항목은 "역할 능력으로 접히지 않는다"고 판정한 이유를 달고 있다.
 */
const ALLOWED = new Map<string, { readonly lines: number; readonly why: string }>([
  // 프롬프트 예시 이름 고르기 휴리스틱 — 행동 게이트가 아니다(스펙 "제외: turnGuide.ts:60").
  ["src/ai/turnGuide.ts", { lines: 1, why: "프롬프트 형식 예시 선택 휴리스틱" }],
  // 벤치마크 정답지 — 선언 표(시맨틱·하네스)를 직접 읽어 "역할이 이렇게 적혀 있다"는
  // 사실을 검증한다. 능력으로 바꾸면 검증 대상이 사라진다. furniture 는 Task 10 참고.
  ["src/benchmark/interior/groundTruth.ts", { lines: 7, why: "선언 표의 role 표기 자체를 검증하는 정답지" }],
  // BuildPaletteGroupRole(wall/door/window/roof/...) 프리셋 키 — TileGroupRole 이 아니다.
  ["src/editor/panels/buildPaletteCore.ts", { lines: 1, why: "빌드 팔레트 프리셋 키(다른 role 축)" }],
  // 워크스페이스 UI 의 그룹 종류 라벨 — 능력이 아니라 표시용 분류다.
  ["src/editor/panels/tilesetKnowledgeWorkspaceState.ts", { lines: 2, why: "UI 표시용 그룹 종류 라벨" }],
  // 배치 레이어 판정 — role→레이어를 묻지만 답이 layerHome 과 다르다
  // (prop 의 layerHome 은 perCell 인데 여기서는 upper). tileRoles 의 sampleLayer 처럼
  // 별도 능력이 필요하며 A-2 의 15개 분기에 없었다. A-3 후보.
  ["src/editor/tools/clusterRulePlacement.ts", { lines: 1, why: "배치 레이어 판정 — layerHome 과 답이 다름, A-3 후보" }],
  ["src/editor/tools/mapTools.ts", { lines: 1, why: "팔레트 레이어 판정 — layerHome 과 답이 다름, A-3 후보" }],
  ["src/editor/tools/placementTools.ts", { lines: 4, why: "팔레트/발자국 레이어 판정 + 나무 타일 id 특례, A-3 후보" }],
  // 어휘 선택 — "이 역할의 그룹을 골라라"는 질의이며 능력 조회가 아니다.
  ["src/editor/tools/v3/constructionTools.ts", { lines: 1, why: "역할로 그룹을 고르는 질의" }],
  ["src/editor/tools/v3/rmTypeExpander.ts", { lines: 1, why: "역할로 후보를 고르는 질의" }],
  ["src/editor/tools/v3/vocabularyTools.ts", { lines: 1, why: "클레임의 역할 선언 검사" }],
  // terrainTag 를 0(NORMAL)으로 강제 — 현행 능력 필드는 terrainTag?: "water" 뿐이라
  // "terrain → 0" 을 표현할 수 없다. terrainTag 가 number 로 열리는 A-3 후보.
  ["src/project/tilesetHarness/themePacks.ts", { lines: 2, why: "terrainTag=0 강제 — 능력 필드가 water 만 표현, A-3 후보" }],
]);

/**
 * `src/` 아래 `.ts` 를 모은다(`.d.ts` 제외).
 *
 * `fs.globSync` 를 쓰지 않는 이유: 그 API 는 Node 22 이상에만 있고
 * `.github/workflows/parity.yml` 은 7 개 잡 전부 node-version 20 을 고정한다.
 * 거기서는 `globSync is not a function` 으로 이 파일 하나가 unit-tests 잡을
 * 통째로 죽인다. CI 의 노드를 올리는 쪽은 7 개 잡에 영향을 주므로 택하지
 * 않고, 순회를 직접 한다.
 */
function collectSourceFiles(dir: string, out: string[]): void {
  for (const entry of readdirSync(join(process.cwd(), dir), { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) collectSourceFiles(path, out);
    else if (entry.isFile() && path.endsWith(".ts") && !path.endsWith(".d.ts")) out.push(path);
  }
}

function sourceFiles(): string[] {
  const files: string[] = [];
  collectSourceFiles("src", files);
  return files.sort();
}

function offendingLines(file: string): string[] {
  const text = readFileSync(join(process.cwd(), file), "utf8");
  return text
    .split("\n")
    .map((line, index) => (ROLE_COMPARISON.test(line) ? `${file}:${index + 1}  ${line.trim()}` : undefined))
    .filter((entry): entry is string => entry !== undefined);
}

describe("A-2 게이트 — 역할 이름 비교 잔여", () => {
  it("허용 목록 밖에서 타일 역할 이름을 직접 비교하지 않는다", () => {
    const offenders = sourceFiles()
      .filter((file) => !ALLOWED.has(file))
      .flatMap(offendingLines);
    expect(offenders).toEqual([]);
  });

  it("허용 목록 안에서도 비교가 늘어나지 않는다", () => {
    const counts = [...ALLOWED].map(([file, { lines }]) => `${file} ${offendingLines(file).length}/${lines}`);
    const expected = [...ALLOWED].map(([file, { lines }]) => `${file} ${lines}/${lines}`);
    expect(counts).toEqual(expected);
  });

  it("허용 목록에 죽은 항목이 없다", () => {
    const dead = [...ALLOWED.keys()].filter((file) => offendingLines(file).length === 0);
    expect(dead).toEqual([]);
  });
});
