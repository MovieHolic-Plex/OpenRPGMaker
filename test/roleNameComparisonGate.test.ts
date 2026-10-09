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
 * `\brole` 로 잡으므로 `group.role` 과 지역변수 `role` 둘 다 걸린다. 단어
 * 경계가 `paletteRole ===` 같은 다른 식별자를 막는다.
 *
 * 잡는 형태는 세 갈래다:
 *   1. `role === "wall"` — 원래의 등호 비교
 *   2. `role !== "wall"` / `role == …` / `role != …` — 부정·느슨한 비교.
 *      `===` 만 보던 판이 `placementTools.ts:1217` 의 `group.role !== "prop"` 을
 *      그냥 통과시켰다. 새로 들어오는 `role !== "wall"` 이 조용히 지나가면
 *      게이트의 존재 이유가 없어진다. (`role = "wall"` 대입은 두 번째 `=` 가
 *      없어 걸리지 않는다.)
 *   3. `switch (role) { case "wall": … }` — 등호를 안 쓰는 같은 분기.
 *      `mapTools.ts:638` 과 `placementTools.ts:358` 이 이 형태로 빠져나갔다.
 *
 * 어휘를 역할 이름으로 좁힌 이유: `\brole === "<소문자>"` 만으로 열어 두면
 * 100 줄이 걸리는데 대부분이 **다른 role 축**이다 — LLM 대화 역할
 * (`message.role === "user"`), 패턴 파트 역할(`part.role === "center"`),
 * 레이아웃 구역 역할(`region.role === "plaza"`), 직업 역할
 * (`role === "caster"`), 그리고 `typeof meta.role === "string"` 타입 가드.
 * 이들은 타일 역할과 무관하므로 허용 목록을 불리는 대신 정규식을 좁혔다.
 *
 * `case` 는 어휘를 좁히는 것만으로는 부족했다 — `switch (block.kind)`,
 * `switch (layer)`, `switch (tab.id)`, `switch (intent)` 안에도 `case "water":`
 * `case "wall":` `case "terrain":` 이 있다(8 곳). 이들 역시 다른 축이므로
 * **switch 대상이 role 인 경우에만** case 를 센다. 허용 목록을 불리는 대신
 * 판정을 좁히는 쪽을 택했다.
 */
const ROLE_NAMES = Object.keys(LEGACY_ROLE_CAPABILITIES);
const ROLE_LITERAL = `["'](?:${ROLE_NAMES.join("|")})["']`;
const ROLE_COMPARISON = new RegExp(`\\brole\\s*(?:===|!==|==|!=)\\s*${ROLE_LITERAL}`, "g");
const ROLE_CASE = new RegExp(`\\bcase\\s+${ROLE_LITERAL}\\s*:`, "g");
const SWITCH_SUBJECT = /\bswitch\s*\(([^)]*)\)/;

/**
 * 남겨 둔 곳과 그 **일치 개수**. 개수까지 박는 이유는 파일 단위 면제만 두면 이미
 * 면제된 파일에 새 역할 비교가 슬쩍 들어와도 게이트가 조용하기 때문이다.
 *
 * 줄 수가 아니라 일치 개수를 세는 이유: `mapTools.ts:666` 은 한 줄에 비교 3 개를
 * 담고 있다(`role === "decor" || role === "furniture" || role === "roof"`).
 * 줄 수로 세면 그 줄에 네 번째 비교를 덧붙여도 개수가 1 로 그대로라 게이트가
 * 통과한다. 개수로 세면 3 → 4 로 드러난다.
 *
 * 각 항목은 "역할 능력으로 접히지 않는다"고 판정한 이유를 달고 있다.
 */
const ALLOWED = new Map<string, { readonly matches: number; readonly why: string }>([
  // 프롬프트 예시 이름 고르기 휴리스틱 — 행동 게이트가 아니다(스펙 "제외: turnGuide.ts:60").
  // 한 줄에 4 개(prop/terrain/water/fence)가 몰려 있다.
  ["src/ai/turnGuide.ts", { matches: 4, why: "프롬프트 형식 예시 선택 휴리스틱" }],
  // 벤치마크 정답지 — 선언 표(시맨틱·하네스)를 직접 읽어 "역할이 이렇게 적혀 있다"는
  // 사실을 검증한다. 능력으로 바꾸면 검증 대상이 사라진다. furniture 는 Task 10 참고.
  ["src/benchmark/interior/groundTruth.ts", { matches: 8, why: "선언 표의 role 표기 자체를 검증하는 정답지" }],
  // BuildPaletteGroupRole(wall/door/window/roof/...) 프리셋 키 — TileGroupRole 이 아니다.
  ["src/editor/panels/buildPaletteCore.ts", { matches: 1, why: "빌드 팔레트 프리셋 키(다른 role 축)" }],
  // roleLabel(:613) — 역할 8 종을 한국어 표시 문자열로 바꾸는 switch. 능력이 아니라
  // 사람이 읽는 라벨이고, RoleCapabilities 8 필드에 라벨 항목이 없다.
  // tilesetKnowledgeWorkspaceState 와 같은 "UI 표시용" 범주다.
  // `case` 형태라 좁은 판정(=== 만)에서는 보이지 않았고, 이번 확장에서 처음 드러났다.
  ["src/editor/panels/clusterAiModal.ts", { matches: 8, why: "UI 표시용 역할 한국어 라벨(roleLabel switch)" }],
  // 워크스페이스 UI 의 그룹 종류 라벨 — 능력이 아니라 표시용 분류다.
  ["src/editor/panels/tilesetKnowledgeWorkspaceState.ts", { matches: 2, why: "UI 표시용 그룹 종류 라벨" }],
  // 배치 레이어 판정 — role→레이어를 묻지만 답이 layerHome 과 다르다
  // (prop 의 layerHome 은 perCell 인데 여기서는 upper). tileRoles 의 sampleLayer 처럼
  // 별도 능력이 필요하며 A-2 의 15개 분기에 없었다. A-3 후보.
  ["src/editor/tools/clusterRulePlacement.ts", { matches: 1, why: "배치 레이어 판정 — layerHome 과 답이 다름, A-3 후보" }],
  // :666 팔레트 레이어 판정(비교 3 개) + :638 paletteRoleAppliesToCell 의 switch(case 8 개).
  // 후자는 레이어가 아니라 "이 팔레트 역할이 스탬프의 이 행에 미치는가"를 묻는 별개 질문이며
  // 현행 능력 8 필드에 대응 항목이 없다. A-3 후보.
  ["src/editor/tools/mapTools.ts", { matches: 11, why: "팔레트 레이어 판정 + 행별 적용 범위 switch — 능력 필드 없음, A-3 후보" }],
  // :351/:503/:507/:1288 레이어·발자국 판정 + :1217 문법 없는 prop 가방 판정(`!== "prop"`)
  // + :358 paletteGroupRole 의 switch(PaletteSlotRole → TileGroupRole 매핑, case 5 개).
  // 뒤 두 형태는 === 만 보던 판정에서 빠져나갔다. 매핑은 능력 조회가 아니라 두 enum 사이의
  // 번역표이고, A-3 에서 두 enum 이 합쳐지면 사라진다.
  ["src/editor/tools/placementTools.ts", { matches: 13, why: "레이어/발자국 판정 + prop 가방 판정 + 두 enum 번역표, A-3 후보" }],
  // 어휘 선택 — "이 역할의 그룹을 골라라"는 질의이며 능력 조회가 아니다.
  ["src/editor/tools/v3/constructionTools.ts", { matches: 1, why: "역할로 그룹을 고르는 질의" }],
  // Roof completeness compares authored wall/roof groups, not collision/render capabilities.
  // Like constructionTools and benchmark groundTruth, substituting layerHome would mix in non-roof props.
  ["src/project/lint/postTileVerify.ts", { matches: 2, why: "저작 wall/roof 그룹으로 지붕 덮임을 검증하는 질의" }],
  ["src/editor/tools/v3/rmTypeExpander.ts", { matches: 1, why: "역할로 후보를 고르는 질의" }],
  ["src/editor/tools/v3/vocabularyTools.ts", { matches: 1, why: "클레임의 역할 선언 검사" }],
  // terrainTag 를 0(NORMAL)으로 강제 — 현행 능력 필드는 terrainTag?: "water" 뿐이라
  // "terrain → 0" 을 표현할 수 없다. terrainTag 가 number 로 열리는 A-3 후보.
  ["src/project/tilesetHarness/themePacks.ts", { matches: 2, why: "terrainTag=0 강제 — 능력 필드가 water 만 표현, A-3 후보" }],
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

/**
 * 위반 **하나마다** 한 항목. 같은 줄에 여러 개면 여러 항목이 나온다.
 *
 * `case` 가 어느 switch 에 속하는지는 **가장 최근에 지나온 `switch (…)` 줄**로 정한다
 * (한 번의 전진 순회로 유지). 중괄호 깊이를 세지 않는 이유: 문자열·주석 안의 중괄호에
 * 깊이가 어긋나면 case 의 소속이 엉뚱해지고, 그 어긋남은 게이트를 **약하게** 만드는
 * 방향으로도 작용한다(놓친 위반이 조용히 통과). 가장 최근 switch 줄을 보는 판정은
 * 그렇게 어긋날 수 없고, 실제 코드에서 case 묶음은 자기 switch 바로 밑에 붙어 있다.
 */
function offendingMatches(file: string): string[] {
  const lines = readFileSync(join(process.cwd(), file), "utf8").split("\n");
  const offenders: string[] = [];
  let subject: string | undefined;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    for (const match of line.matchAll(ROLE_COMPARISON)) {
      offenders.push(`${file}:${index + 1}  ${match[0]}`);
    }
    // 같은 줄에 `switch (role) { case "wall":` 이 다 들어오는 형태도 있으므로
    // case 를 판정하기 전에 이 줄의 switch 를 먼저 반영한다.
    const found = SWITCH_SUBJECT.exec(line);
    if (found) subject = found[1];
    if (subject === undefined || !/\brole\b/.test(subject)) continue;
    for (const match of line.matchAll(ROLE_CASE)) {
      offenders.push(`${file}:${index + 1}  switch(${subject.trim()}) ${match[0]}`);
    }
  }
  return offenders;
}

describe("A-2 게이트 — 역할 이름 비교 잔여", () => {
  it("허용 목록 밖에서 타일 역할 이름을 직접 비교하지 않는다", () => {
    const offenders = sourceFiles()
      .filter((file) => !ALLOWED.has(file))
      .flatMap(offendingMatches);
    expect(offenders).toEqual([]);
  });

  it("허용 목록 안에서도 비교가 늘어나지 않는다", () => {
    const counts = [...ALLOWED].map(([file, { matches }]) => `${file} ${offendingMatches(file).length}/${matches}`);
    const expected = [...ALLOWED].map(([file, { matches }]) => `${file} ${matches}/${matches}`);
    expect(counts).toEqual(expected);
  });

  it("허용 목록에 죽은 항목이 없다", () => {
    const dead = [...ALLOWED.keys()].filter((file) => offendingMatches(file).length === 0);
    expect(dead).toEqual([]);
  });
});
