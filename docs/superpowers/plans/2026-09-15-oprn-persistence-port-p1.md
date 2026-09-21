# 저장소 포트 도입(P1) 실행 계획 — 동작 불변

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** store 와 주변 모듈이 LegacyDb sync 모듈을 직접 부르는 대신 `ProjectRepository` 포트 하나를 부르게 하고, 그 뒤에 LegacyDb 어댑터(기존 모듈을 그대로 감쌈)와 메모리 어댑터를 세운다. 네트워크 요청·호출 인자·테스트 결과는 하나도 바뀌지 않는다.

**Architecture:** 순수 함수(정규 JSON, 저장 와이어, 맵 병합·충돌, 로드 복구, 맵 패치 계획)를 `src/project/persistence/core/` 로 옮겨 DOM·네트워크 없는 영역을 만든다. 그 위에 `persistence/types.ts` 의 포트 인터페이스, `persistence/target.ts` 의 저장 대상 타입, `persistence/repository.ts` 의 선택기(기본 LegacyDb, 테스트 주입)를 둔다. `legacyDbRepository.ts` 는 sync 함수를 메서드 본문에서 named import 로 그대로 부르고, `memoryRepository.ts` 는 core 함수만으로 같은 의미를 구현한다. 계약 테스트 하나가 두 어댑터에 같은 스펙을 돌린다. store 는 저장·읽기·활성화·헬스체크만 포트로 바꾸고, 원격 설정 초안·URL 바·프로젝트 전환 트랜잭션은 P4·P6 으로 남긴다.

**Tech Stack:** TypeScript 5.7 strict, Vite 6, vitest 3.2.4(node 환경, `test/**/*.test.ts`, testTimeout 15s), Node 24.11, zod 4(이번 단계에서는 쓰지 않음).

**Spec:** `docs/superpowers/specs/2026-09-15-oprn-local-sqlite-store-design.md` — 3절(가드 정책)·5절(포트와 어댑터)·8절 P1 행.

## Global Constraints

- **동작 불변.** 같은 입력에 같은 URL·헤더·본문·호출 인자. sync 함수의 이름·시그니처·모듈 경로는 P6 까지 그대로 둔다(테스트 809 파일이 store 를, 26 파일이 `saveProjectToLegacyDb` 를 참조한다).
- **어댑터는 sync 함수를 메서드 본문 안에서 named import 로 부른다.** 모듈 로드 시점에 함수 표를 만들거나 구조 분해로 캐시하지 않는다. `vi.mock`·`vi.spyOn` 이 갈아 끼운 함수를 보아야 한다(`test/storePersistenceProof.test.ts` 가 `recordProjectCommitToLegacyDb` 를 spy 한다).
- **호출 인자는 호출부가 넘긴 그대로 전달한다.** 기본 대상 대체는 sync 의 기본 매개변수(`config = legacyDbProjectConfig()`)가 하도록 `undefined` 를 그대로 넘긴다. 어댑터가 `?? currentTarget()` 로 먼저 채우지 않는다.
- **가드 `test/noLocalProjectDb.test.ts` 는 이번 단계에서 손대지 않고 초록이어야 한다.** 이 가드는 `src/project`·`src/editor` 의 파일 **본문 전체**에서 문자열 `sqlite`·`sql.js`·`better-sqlite`·`indexedDB`·`openDatabase(` 를 찾는다. 주석에도 그 단어를 쓰지 말 것. P2 이야기를 적고 싶으면 "로컬 스토어" 라고 쓴다.
- **core 경계.** `src/project/persistence/core/**` 는 `window`·`document`·`localStorage`·`navigator`·`fetch(`·`import.meta.env` 토큰과 `legacyDb`·`@/editor`·`@/ai`·`@/app`·`spatial/persistence` 경로 import 가 없다. Task 1 의 가드 테스트가 고정한다.
- **이름 규칙.** 새 식별자는 `oprn` 계열이거나 중립 이름이다. `rpgzzu`·`rpg-zzu`·`RPG_ZZU` 를 새로 만들지 않는다(`test/detsukuruBrandStrings.test.ts` 가 막는다). Postgres 스키마 `rpg_zzu` 는 데이터라 sync 모듈과 가짜 PostgREST 에 그대로 남는다.
- **커밋.** `type(scope): 한국어 서술형` + 본문 + Lore 트레일러(`Constraint:`/`Rejected:`/`Confidence:`/`Scope-risk:`/`Reversibility:`/`Directive:`/`Tested:`/`Not-tested:`) + `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. 태스크마다 커밋 하나.
- **브랜치·PR.** `persistence/p1-port` 를 `origin/main` 에서 딴다. 워크트리를 쓰면 `node_modules` 는 주 체크아웃(`/home/main/z-project/rpg-zzu/node_modules`)으로 심링크한다. main 병합은 `gh pr create` 로만.
- **테스트 실행.** 전체 vitest 는 28분·OOM 이라 돌리지 않는다. 파일 단위 `npx vitest run <files>` 와 마지막에 `npm run test:changed -- origin/main`. 실패 파일은 격리 재실행 → 기준 트리(`git archive origin/main`)에서 같은 파일 실행으로 회귀/기존 실패/부하 플레이크를 가른다.
- **테스트 assertion 이 인자 개수에 걸리면** (예: `toHaveBeenCalledWith(project, config)` 인데 어댑터가 `(project, config, undefined)` 로 부름) 어댑터에 개수 맞추는 분기를 넣지 말고 assertion 을 `expect.anything()`/앞 두 인자 확인으로 고친다. 커밋 본문에 어느 테스트를 왜 고쳤는지 적는다.

---

## 파일 구조

**새로 만드는 것**

```
src/project/persistence/
  core/
    canonicalJson.ts     canonicalJsonString — sync 모듈에서 이동
    projectWire.ts       projectWire(project) → { serialized, json, sha256 } — sync 의 private 를 이동·공개
    mapMerge.ts          changedMapIdsBetween·mapSaveConflicts·mergeProjectMaps·맵트리 병합 — sync 에서 이동
    loadRepair.ts        deserializeStoredProjectJson·repairStoredLoadFoundation 와 그 보조 함수 — sync 에서 이동
    mapPatch.ts          canonicalizeForMapComparison·readMapPatchSnapshot·mapPatchChangeSet·planMapPatch
  target.ts              ProjectTarget(P1 = 원격 모양)·projectTargetKey·sameProjectTarget(saveRouting 에서 이동)
  types.ts               중립 이름 별칭 + ProjectRepository 인터페이스
  repository.ts          projectRepository()·setProjectRepositoryForTest()
  legacyDbRepository.ts  createLegacyDbRepository() — sync 모듈 래핑
  memoryRepository.ts    createMemoryRepository() — core 만으로 구현
test/persistence/
  coreBoundary.test.ts   core 디렉터리에 DOM·네트워크·LegacyDb 토큰 없음
  mapMerge.test.ts       병합·충돌 순수 함수
  mapPatch.test.ts       planMapPatch: 비겹침 병합·충돌·참조 검증
  repositorySelection.test.ts
  fakePostgrest.ts       메모리 PostgREST(테스트 도우미, .test 아님)
  repositoryContract.test.ts  메모리·가짜 전송 LegacyDb 두 어댑터에 같은 스펙
```

**고치는 것**

- `src/project/legacyDbProjectSync.ts` — 옮긴 함수를 core 에서 import. `saveProjectMapPatchToLegacyDb` 본문이 `planMapPatch` 를 쓴다. `LegacyDbAiAnalysisRunInput` 을 export. `canonicalJsonString` 은 re-export 로 남긴다.
- `src/project/spatial/saveRouting.ts` — `sameProjectTarget` 정의를 `persistence/target.ts` 로 옮기고 re-export.
- `src/project/store.ts` — 저장·읽기·증명 읽기·활성화·헬스체크·상태를 포트로.
- `src/project/projectCommitLog.ts`, `src/editor/teamWorkflowUi.ts`, `src/ai/activityLog.ts`, `src/ai/conversationStore.ts`, `src/project/tileMetadataDb.ts` — 포트로.
- `src/editor/tools/applyChangesetToStore.ts`, `src/project/authoredProjectBaseline.ts` — `canonicalJsonString` import 경로를 core 로.

**이번 단계에서 손대지 않는 것(어디서 처리하는지)**

| 남는 것 | 위치 | 처리 단계 |
|---|---|---|
| `legacyDbProjectConfigDraft*`·`stageLegacyDbProjectConfigDraft`·`saveLegacyDbSelectedProjectId`·`syncProjectToUrl` | `store.ts` 의 `loadNewRemoteProject*`·`getE2ESnapshot`·`syncProjectUrlBar` | P4(시작 화면이 전환을 맡음)·P6(삭제) |
| `cacheLegacyDbRootResources` | `store.ts` `refreshLegacyDbResourceCache` | P3(미디어 분리와 함께 로컬 모드 건너뜀)·P6 |
| `loadDevProjectOverride`·`saveDevProjectOverride` | `store.ts` | P6 |
| 프로젝트 고르기·연결 설정 패널(`listLegacyDbProjects`·`loadLegacyDbProjectPreview`) | `src/editor/panels/dbConnection*.ts`, `projectPickerCover.ts` | P4·P6 |
| `list_project_commits` 동기 XHR | `src/editor/tools/queryTools.ts` | P4(브리지 `sendSync` 한 곳) |
| 맵 편집 잠금 | `src/editor/mapEditLocks.ts` | P6(원격 전용 퇴역) |
| 초안 금고 키의 projectId | `src/project/eventDraftVault.ts` | P4(로컬 대상 UUID 로) |
| `SpatialPersistenceError`·`ProjectRoutingError` 를 복구 UI 가 직접 봄 | `saveActions.ts`, `persistenceRecoveryUi.ts`, `spatial/actions.ts` | P4 |

---

## 시작 전

```bash
git fetch origin main
git switch -c persistence/p1-port origin/main
ls -la node_modules | head -1      # 심링크가 아니면: ln -s /home/main/z-project/rpg-zzu/node_modules node_modules
npx vitest run test/noLocalProjectDb.test.ts test/legacyDbProjectSync.test.ts --reporter=dot   # 기준선: 둘 다 초록이어야 시작
```

---

## Task 1: core 뼈대 — 정규 JSON·저장 와이어·경계 가드

**Files:**
- Create: `src/project/persistence/core/canonicalJson.ts`
- Create: `src/project/persistence/core/projectWire.ts`
- Create: `test/persistence/coreBoundary.test.ts`
- Modify: `src/project/legacyDbProjectSync.ts` (`canonicalJsonString` 1310–1320행 삭제 후 re-export, private `projectWire`·`ProjectWire` 874–881행 삭제)
- Modify: `src/editor/tools/applyChangesetToStore.ts`, `src/project/authoredProjectBaseline.ts` (import 경로)

**Interfaces:**
- Produces: `canonicalJsonString(value: unknown): string`; `projectWire(project: Project): Promise<ProjectWire>`; `type ProjectWire = { readonly json: unknown; readonly serialized: string; readonly sha256: string }`.

- [ ] **Step 1: 경계 가드 테스트를 쓴다 (디렉터리가 없어 실패)**

```ts
// test/persistence/coreBoundary.test.ts
import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const CORE_DIR = "src/project/persistence/core";
// 렌더러 전용 능력. core 는 메인 프로세스·노드 스크립트에서도 그대로 돌아야 한다.
const FORBIDDEN_TOKENS = ["window.", "document.", "localStorage", "navigator.", "fetch(", "import.meta.env", "XMLHttpRequest"] as const;
// LegacyDb 와 편집기 UI 로 되돌아가는 import.
const FORBIDDEN_IMPORTS = ["legacyDb", "@/editor", "@/ai", "@/app", "spatial/persistence", "spatial/saveRouting"] as const;

function coreFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? coreFiles(path) : path.endsWith(".ts") ? [path] : [];
  });
}

describe("persistence core boundary", () => {
  it("core 디렉터리가 있고 파일이 하나 이상이다", () => {
    expect(existsSync(CORE_DIR)).toBe(true);
    expect(coreFiles(CORE_DIR).length).toBeGreaterThan(0);
  });

  it("core 는 DOM·네트워크·LegacyDb 를 모른다", () => {
    const offenders: string[] = [];
    for (const file of coreFiles(CORE_DIR)) {
      const text = readFileSync(file, "utf8");
      for (const token of FORBIDDEN_TOKENS) if (text.includes(token)) offenders.push(`${file}: ${token}`);
      for (const line of text.split("\n")) {
        if (!/^\s*(import|export)\b.*\bfrom\s+["']/.test(line)) continue;
        for (const needle of FORBIDDEN_IMPORTS) if (line.includes(needle)) offenders.push(`${file}: import ${needle}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run test/persistence/coreBoundary.test.ts`
Expected: FAIL — `expect(existsSync(CORE_DIR)).toBe(true)` 가 false.

- [ ] **Step 3: `canonicalJson.ts` 를 만든다 (sync 1300–1320행 본문을 주석째 그대로 옮긴다)**

```ts
// src/project/persistence/core/canonicalJson.ts
/**
 * jsonb 키 정렬 불변 비교 문자열(todo 8 실측 결함).
 *
 * LegacyDb의 current_json/map_json 컬럼은 PostgreSQL jsonb 로 저장되어 키가
 * **알파벳순으로 정렬**된다(실측: {z:1,a:2,m:3} → {a:2,m:3,z:1}). 반면 에디터 메모리
 * (persistedBaseline/로컬 드래프트)의 객체는 삽입 순서 키를 유지한다. 같은 논리 맵도
 * JSON.stringify 결과가 달라져 매 flush가 가짜 conflict로 끝났다(첫 마일스톤 이후 저장 불가).
 * 키를 재귀적으로 정렬해 문자열로 만들면 jsonb 왕복 여부와 무관하게 같은 논리 값은 같은
 * 문자열이 된다. 배열 순서·값은 그대로 유지한다(배열 순서는 의미가 있다).
 */
export function canonicalJsonString(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJsonString(entry)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJsonString(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
```

- [ ] **Step 4: `projectWire.ts` 를 만든다**

```ts
// src/project/persistence/core/projectWire.ts
import { serialize } from "../../io";
import type { Project } from "../../types";
import { sha256HexText } from "@/util/sha256";

/** 저장 와이어: 직렬화 텍스트, 그 JSON, 그 텍스트의 sha256. 세 값은 같은 바이트에서 나온다. */
export type ProjectWire = {
  readonly json: unknown;
  readonly serialized: string;
  readonly sha256: string;
};

export async function projectWire(project: Project): Promise<ProjectWire> {
  const serialized = serialize(project);
  return {
    serialized,
    json: JSON.parse(serialized) as unknown,
    sha256: await sha256HexText(serialized),
  };
}
```

- [ ] **Step 5: sync 모듈을 고친다**

`src/project/legacyDbProjectSync.ts`:
1. 파일 상단 import 에 추가: `import { projectWire, type ProjectWire } from "./persistence/core/projectWire";` 와 `export { canonicalJsonString } from "./persistence/core/canonicalJson";` 그리고 내부 사용을 위해 `import { canonicalJsonString } from "./persistence/core/canonicalJson";`.
2. `type ProjectWire = {...}` (약 92–96행) 삭제.
3. `async function projectWire(project: Project): Promise<ProjectWire> {...}` (약 874–881행) 삭제.
4. `export function canonicalJsonString(...)` 과 그 주석(약 1300–1320행) 삭제. `mapSnapshot` 은 import 한 함수를 그대로 쓴다.

`src/editor/tools/applyChangesetToStore.ts` 와 `src/project/authoredProjectBaseline.ts`: `canonicalJsonString` 의 import 를 `@/project/persistence/core/canonicalJson` 으로 바꾼다(다른 import 는 그대로).

- [ ] **Step 6: 통과 확인**

Run: `npx vitest run test/persistence/coreBoundary.test.ts test/legacyDbProjectSync.test.ts test/noLocalProjectDb.test.ts --reporter=dot && npx tsc --noEmit -p tsconfig.app.json`
Expected: 세 파일 PASS, tsc 오류 0.

- [ ] **Step 7: 커밋**

```bash
git add src/project/persistence/core/canonicalJson.ts src/project/persistence/core/projectWire.ts test/persistence/coreBoundary.test.ts src/project/legacyDbProjectSync.ts src/editor/tools/applyChangesetToStore.ts src/project/authoredProjectBaseline.ts
git commit -F - <<'MSG'
refactor(persistence): 정규 JSON 과 저장 와이어를 core 로 옮긴다

저장소 포트의 첫 조각이다. DOM·네트워크·LegacyDb 를 모르는 `src/project/persistence/core/`
를 만들고 경계 가드 테스트로 고정한다. 함수 본문은 sync 모듈에서 그대로 옮겼고 sync 는
같은 함수를 import 한다.

Constraint: test/noLocalProjectDb.test.ts 가 src/project 본문에서 로컬 DB 단어를 찾는다 — persistence/ 주석에도 쓰지 않는다
Confidence: high
Scope-risk: narrow
Reversibility: clean
Directive: core 에 새 파일을 넣을 때 test/persistence/coreBoundary.test.ts 의 금지 토큰 목록을 먼저 읽는다
Tested: npx vitest run test/persistence/coreBoundary.test.ts test/legacyDbProjectSync.test.ts test/noLocalProjectDb.test.ts
Tested: npx tsc --noEmit -p tsconfig.app.json

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
MSG
```

---

## Task 2: core/mapMerge — 맵 병합·충돌 순수 함수 이동

**Files:**
- Create: `src/project/persistence/core/mapMerge.ts`
- Create: `test/persistence/mapMerge.test.ts`
- Modify: `src/project/legacyDbProjectSync.ts` (1117–1141행 `changedMapIdsBetween`·`mapSaveConflicts`, 1165–1275행 `mergeProjectMaps`~`insertMapTreeNode`, 1296–1298행 `mapSnapshot`, 1322–1324행 `mapConflictName` 삭제)

**Interfaces:**
- Produces:
  - `type MapSaveConflict = { readonly mapId: string; readonly name: string }`
  - `changedMapIdsBetween(base: Pick<Project,"maps"|"mapTree">, project: Pick<Project,"maps"|"mapTree">): readonly string[]`
  - `changedMapTreeIdsBetween(baseTree: MapTreeNode, tree: MapTreeNode): readonly string[]`
  - `mapSaveConflicts(base: Pick<Project,"maps">, project: Pick<Project,"maps">, latest: Pick<Project,"maps">, changedMapIds: readonly string[]): readonly MapSaveConflict[]`
  - `mergeProjectMaps(latest: Pick<Project,"maps"|"mapTree">, project: Project, changedMapIds: readonly string[], changedMapTreeIds: readonly string[]): Project`
  - `mapSnapshot(map: GameMap | undefined): string`

- [ ] **Step 1: 실패하는 테스트**

```ts
// test/persistence/mapMerge.test.ts
import { describe, expect, it } from "vitest";
import { createHouseTemplateGalleryProject } from "@/project/defaults/defaultProject";
import type { GameMap, Project } from "@/project/types";
import { changedMapIdsBetween, mapSaveConflicts, mergeProjectMaps } from "@/project/persistence/core/mapMerge";

function mapIds(project: Project): [string, string] {
  const [first, second] = Object.keys(project.maps);
  if (!first || !second) throw new Error("fixture needs two maps");
  return [first, second];
}
function renamed(project: Project, mapId: string, name: string): GameMap {
  const map = project.maps[mapId];
  if (!map) throw new Error(`expected map ${mapId}`);
  return { ...map, name };
}

describe("mapMerge core", () => {
  it("키 순서만 다른 맵은 바뀐 것으로 보지 않는다 (jsonb 왕복)", () => {
    const base = createHouseTemplateGalleryProject();
    const [mapId] = mapIds(base);
    const reordered = structuredClone(base);
    const map = reordered.maps[mapId];
    if (!map) throw new Error("expected map");
    reordered.maps[mapId] = Object.fromEntries(Object.entries(map).reverse()) as unknown as GameMap;
    expect(changedMapIdsBetween(base, reordered)).toEqual([]);
  });

  it("서로 다른 맵을 고친 두 편집은 충돌이 아니고, 병합 결과에 둘 다 남는다", () => {
    const base = createHouseTemplateGalleryProject();
    const [mineId, theirsId] = mapIds(base);
    const mine = structuredClone(base);
    mine.maps[mineId] = renamed(mine, mineId, "내 맵");
    const latest = structuredClone(base);
    latest.maps[theirsId] = renamed(latest, theirsId, "남의 맵");
    const changed = changedMapIdsBetween(base, mine);
    expect(changed).toEqual([mineId]);
    expect(mapSaveConflicts(base, mine, latest, changed)).toEqual([]);
    const merged = mergeProjectMaps(latest, mine, changed, []);
    expect(merged.maps[mineId]?.name).toBe("내 맵");
    expect(merged.maps[theirsId]?.name).toBe("남의 맵");
  });

  it("같은 맵을 다르게 고치면 그 맵만 충돌로 돌려준다", () => {
    const base = createHouseTemplateGalleryProject();
    const [mapId] = mapIds(base);
    const mine = structuredClone(base);
    mine.maps[mapId] = renamed(mine, mapId, "내 맵");
    const latest = structuredClone(base);
    latest.maps[mapId] = renamed(latest, mapId, "남의 맵");
    const changed = changedMapIdsBetween(base, mine);
    expect(mapSaveConflicts(base, mine, latest, changed)).toEqual([{ mapId, name: "내 맵" }]);
  });

  it("최신본과 같은 내용으로 고친 편집은 충돌이 아니다", () => {
    const base = createHouseTemplateGalleryProject();
    const [mapId] = mapIds(base);
    const mine = structuredClone(base);
    mine.maps[mapId] = renamed(mine, mapId, "같은 이름");
    const latest = structuredClone(mine);
    expect(mapSaveConflicts(base, mine, latest, changedMapIdsBetween(base, mine))).toEqual([]);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run test/persistence/mapMerge.test.ts`
Expected: FAIL — 모듈 `@/project/persistence/core/mapMerge` 없음.

- [ ] **Step 3: `mapMerge.ts` 를 만든다 — sync 의 함수 본문을 **그대로** 옮기고 export 만 붙인다**

```ts
// src/project/persistence/core/mapMerge.ts
import type { GameMap, MapTreeNode, Project } from "../../types";
import { canonicalJsonString } from "./canonicalJson";

export type MapSaveConflict = {
  readonly mapId: string;
  readonly name: string;
};

export function changedMapIdsBetween(baseProject: Pick<Project, "maps" | "mapTree">, project: Pick<Project, "maps" | "mapTree">): readonly string[] {
  const mapIds = [...new Set([...Object.keys(baseProject.maps), ...Object.keys(project.maps)])]
    .filter((mapId) => mapSnapshot(baseProject.maps[mapId]) !== mapSnapshot(project.maps[mapId]));
  return [...new Set([...mapIds, ...changedMapTreeIdsBetween(baseProject.mapTree, project.mapTree)])];
}

export function mapSaveConflicts(
  baseProject: Pick<Project, "maps">,
  project: Pick<Project, "maps">,
  latestProject: Pick<Project, "maps">,
  changedMapIds: readonly string[],
): readonly MapSaveConflict[] {
  return changedMapIds
    .filter((mapId) => {
      const baseSnapshot = mapSnapshot(baseProject.maps[mapId]);
      const latestSnapshot = mapSnapshot(latestProject.maps[mapId]);
      const localSnapshot = mapSnapshot(project.maps[mapId]);
      return latestSnapshot !== baseSnapshot && latestSnapshot !== localSnapshot;
    })
    .map((mapId) => ({ mapId, name: mapConflictName(mapId, project, latestProject, baseProject) }));
}

export function mergeProjectMaps(
  latestProject: Pick<Project, "maps" | "mapTree">,
  project: Project,
  changedMapIds: readonly string[],
  changedMapTreeIds: readonly string[],
): Project {
  const mergedMaps = { ...latestProject.maps };
  for (const mapId of changedMapIds) {
    const map = project.maps[mapId];
    if (map) {
      mergedMaps[mapId] = map;
    } else {
      delete mergedMaps[mapId];
    }
  }
  return {
    ...project,
    maps: mergedMaps,
    mapTree: mergeMapTree(latestProject.mapTree, project.mapTree, changedMapTreeIds),
  };
}

export function changedMapTreeIdsBetween(baseTree: MapTreeNode, tree: MapTreeNode): readonly string[] {
  const baseLocations = mapTreeLocations(baseTree);
  const locations = mapTreeLocations(tree);
  return [...new Set([...baseLocations.keys(), ...locations.keys()])]
    .filter((mapId) => baseLocations.get(mapId) !== locations.get(mapId));
}

export function mapSnapshot(map: GameMap | undefined): string {
  return map ? canonicalJsonString(map) : "";
}

// ── 아래는 sync 모듈에서 그대로 옮긴 비공개 보조 함수 ─────────────────────────
// mapTreeLocations, visitMapTreeLocations, mergeMapTree, mergeMapTreeNode, MapTreePlacement,
// findMapTreePlacement, removeMapTreeNode, insertMapTreeNode, mapConflictName —
// src/project/legacyDbProjectSync.ts 의 1194–1275행과 1322–1324행 본문을 한 글자도 바꾸지 않고 붙인다.
```

옮길 때 sync 의 해당 함수를 삭제하고, sync 상단에 `import { changedMapIdsBetween, changedMapTreeIdsBetween, mapSaveConflicts, mergeProjectMaps, type MapSaveConflict } from "./persistence/core/mapMerge";` 를 넣는다. `export type LegacyDbMapSaveConflict = {...}` 는 `export type LegacyDbMapSaveConflict = MapSaveConflict;` 로 바꾼다(이름은 남긴다 — `LegacyDbSaveResult` 와 테스트가 쓴다). `mapSnapshot` 은 sync 안에서 더 쓰는 곳이 없으면 import 하지 않는다(tsc 가 알려준다).

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run test/persistence/mapMerge.test.ts test/persistence/coreBoundary.test.ts test/legacyDbProjectSync.test.ts --reporter=dot && npx tsc --noEmit -p tsconfig.app.json`
Expected: PASS, tsc 0.

- [ ] **Step 5: 커밋**

```bash
git add src/project/persistence/core/mapMerge.ts test/persistence/mapMerge.test.ts src/project/legacyDbProjectSync.ts
git commit -F - <<'MSG'
refactor(persistence): 맵 병합·충돌 판정을 core 로 옮긴다

`changedMapIdsBetween`·`mapSaveConflicts`·`mergeProjectMaps` 와 맵 트리 병합 보조 함수를
sync 모듈에서 `persistence/core/mapMerge.ts` 로 옮겼다. 본문은 그대로이고 sync 는 import 한다.
두 어댑터와 다음 단계의 로컬 스토어가 같은 병합 코드를 쓰기 위한 준비다.

Confidence: high
Scope-risk: narrow
Reversibility: clean
Tested: npx vitest run test/persistence/mapMerge.test.ts test/legacyDbProjectSync.test.ts
Tested: npx tsc --noEmit -p tsconfig.app.json

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
MSG
```

---

## Task 3: core/loadRepair — 저장본 JSON 복구 함수 이동

**Files:**
- Create: `src/project/persistence/core/loadRepair.ts`
- Modify: `src/project/legacyDbProjectSync.ts` (1350행 `deserializeLegacyDbCurrentJson` 부터 파일 끝 `cloneRecord` 까지 이동; `isRecord` 는 sync 에 남긴다)

**Interfaces:**
- Produces: `deserializeStoredProjectJson(value: unknown): Project`, `repairStoredLoadFoundation(value: unknown): void`. (옛 이름 `deserializeLegacyDbCurrentJson`·`repairLegacyDbLoadFoundation`·`repairLegacyDbCurrentJson` 은 사라진다 — 모듈 밖에서 쓰던 곳이 없다.)

- [ ] **Step 1: 기존 복구 테스트가 기준선이다 — 먼저 이름을 확인해 둔다**

Run: `grep -n "legacy\|repair\|복구" test/legacyDbProjectSync.test.ts | head -20`
Expected: 로드 복구를 검사하는 `it(...)` 셋 이상이 보인다(파일 상단 주석이 "legacy 복구 경로를 검사하는 아래 세 테스트" 라고 말한다). 이 파일이 Step 4 에서 초록이면 이동이 맞다.

- [ ] **Step 2: 함수를 옮긴다**

1. `src/project/legacyDbProjectSync.ts` 에서 `function deserializeLegacyDbCurrentJson(value: unknown): Project {` 부터 파일 끝(`function cloneRecord`… 까지)을 잘라 `src/project/persistence/core/loadRepair.ts` 에 붙인다. `isRecord` 는 자르지 않는다(sync 가 여러 곳에서 쓴다). loadRepair 에는 아래 세 줄짜리 `isRecord` 를 새로 둔다.
2. 이름 셋만 바꾼다(정의와 loadRepair 안 호출부 모두): `deserializeLegacyDbCurrentJson → deserializeStoredProjectJson`, `repairLegacyDbCurrentJson → repairStoredProjectJson`, `repairLegacyDbLoadFoundation → repairStoredLoadFoundation`. 두 개를 `export` 한다: `deserializeStoredProjectJson`, `repairStoredLoadFoundation`. 나머지 보조 함수 이름은 그대로.
3. loadRepair 상단 import — 옮긴 본문이 쓰는 것만 sync 의 import 목록에서 가져온다. 기대 목록(실제로는 tsc 가 알려주는 대로):

```ts
// src/project/persistence/core/loadRepair.ts (상단)
import { deserialize } from "../../io";
import { collectProjectItemReferenceIds } from "../../io/references";
import { defaultResourceProfiles, removeLegacySpriteReferences } from "../../defaults/defaultAssets";
import { ensureBundledBattleAnimations } from "../../defaults/defaultDatabase";
import { defaultEquipmentRecords } from "../../defaults/defaultDatabaseEquipmentRecords";
import { defaultItemRecords } from "../../defaults/defaultDatabaseItemRecords";
import { defaultSkillRecords } from "../../defaults/defaultDatabaseStarterRecords";
import type { BattleAnimationRecord, Project } from "../../types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
```

4. sync 상단에 `import { deserializeStoredProjectJson, repairStoredLoadFoundation } from "./persistence/core/loadRepair";` 를 넣고, sync 안의 호출부 이름을 바꾼다: `loadProjectSnapshotFromLegacyDb` 의 `deserializeLegacyDbCurrentJson(row.current_json)`, `saveProjectMapPatchToLegacyDb` 의 `deserializeLegacyDbCurrentJson(candidate)`, `readMapPatchSnapshot` 안의 두 호출. sync 에서 더 이상 쓰지 않게 된 import(`defaultEquipmentRecords` 등)는 지운다 — tsc 의 unused 경고가 아니라 `npx eslint` 가 없으므로 `grep -c` 로 확인한다.

- [ ] **Step 3: 통과 확인**

Run: `npx vitest run test/legacyDbProjectSync.test.ts test/persistence/coreBoundary.test.ts --reporter=dot && npx tsc --noEmit -p tsconfig.app.json && grep -c "deserializeLegacyDbCurrentJson\|repairLegacyDbLoadFoundation" src/project/legacyDbProjectSync.ts`
Expected: PASS, tsc 0, grep 0.

- [ ] **Step 4: 커밋**

```bash
git add src/project/persistence/core/loadRepair.ts src/project/legacyDbProjectSync.ts
git commit -F - <<'MSG'
refactor(persistence): 저장본 JSON 로드 복구를 core 로 옮긴다

`deserializeLegacyDbCurrentJson` 계열을 `persistence/core/loadRepair.ts` 의
`deserializeStoredProjectJson`·`repairStoredLoadFoundation` 로 옮겼다. 본문은 그대로이고
이름의 LegacyDb 만 뗐다 — 이 복구는 저장소가 무엇이든 옛 문서에 필요하다.

Constraint: 로드 복구 실패 시 원본 행을 그대로 여는 try/catch 구조는 바꾸지 않는다 — 세 차례 리뷰의 결론
Confidence: high
Scope-risk: narrow
Reversibility: clean
Tested: npx vitest run test/legacyDbProjectSync.test.ts (legacy 복구 테스트 포함)
Tested: npx tsc --noEmit -p tsconfig.app.json

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
MSG
```

---

## Task 4: core/mapPatch — 맵 패치 계획(충돌 판정 + 병합 후보), sync 가 그것을 쓴다

**Files:**
- Create: `src/project/persistence/core/mapPatch.ts`
- Create: `test/persistence/mapPatch.test.ts`
- Modify: `src/project/legacyDbProjectSync.ts` (`canonicalizeForMapComparison`·`MapPatchSnapshot`·`readMapPatchSnapshot` 삭제, `saveProjectMapPatchToLegacyDb` 본문 교체)

**Interfaces:**
- Consumes: Task 1–3 의 `projectWire`, `mapMerge` 함수들, `deserializeStoredProjectJson`, `repairStoredLoadFoundation`.
- Produces:
  - `type MapPatchSnapshot = Pick<Project,"maps"|"mapTree"> & Partial<Pick<Project,"audioDescriptions"|"monsterMetadata">>`
  - `canonicalizeForMapComparison(project: Project): MapPatchSnapshot`
  - `readMapPatchSnapshot(value: unknown): MapPatchSnapshot`
  - `type MapPatchChangeSet = { baseProject, persistedProject, canonicalBase, canonicalLocal, changedMapIds, changedMapTreeIds }`
  - `mapPatchChangeSet(baseProject: Project, persistedProject: Project, changedMapIds?: readonly string[]): MapPatchChangeSet`
  - `type MapPatchPlan = { kind:"conflict"; conflicts } | { kind:"candidate"; mergedProject: Project; wire: ProjectWire }`
  - `planMapPatch(changeSet: MapPatchChangeSet, latest: MapPatchSnapshot): Promise<MapPatchPlan>`

- [ ] **Step 1: 실패하는 테스트**

```ts
// test/persistence/mapPatch.test.ts
import { describe, expect, it } from "vitest";
import { createHouseTemplateGalleryProject } from "@/project/defaults/defaultProject";
import { projectWithoutEventDrafts } from "@/project/eventDrafts";
import { serialize } from "@/project/io";
import type { GameMap, Project } from "@/project/types";
import { mapPatchChangeSet, planMapPatch, readMapPatchSnapshot } from "@/project/persistence/core/mapPatch";

function mapIds(project: Project): [string, string] {
  const [first, second] = Object.keys(project.maps);
  if (!first || !second) throw new Error("fixture needs two maps");
  return [first, second];
}
function renamed(project: Project, mapId: string, name: string): GameMap {
  const map = project.maps[mapId];
  if (!map) throw new Error(`expected map ${mapId}`);
  return { ...map, name };
}
/** 서버가 돌려주는 모양: 직렬화 → JSON 왕복(jsonb 처럼 키 순서가 바뀔 수 있다). */
function asStoredJson(project: Project): unknown {
  return JSON.parse(serialize(projectWithoutEventDrafts(project)));
}

describe("planMapPatch", () => {
  it("비겹침 편집은 후보를 만들고 후보에 최신본의 다른 맵이 남는다", async () => {
    const base = createHouseTemplateGalleryProject();
    const [mineId, theirsId] = mapIds(base);
    const mine = structuredClone(base);
    mine.maps[mineId] = renamed(mine, mineId, "내 맵");
    const latest = structuredClone(base);
    latest.maps[theirsId] = renamed(latest, theirsId, "남의 맵");

    const plan = await planMapPatch(mapPatchChangeSet(base, mine), readMapPatchSnapshot(asStoredJson(latest)));

    expect(plan.kind).toBe("candidate");
    if (plan.kind !== "candidate") return;
    expect(plan.mergedProject.maps[mineId]?.name).toBe("내 맵");
    expect(plan.mergedProject.maps[theirsId]?.name).toBe("남의 맵");
    expect(plan.wire.serialized).toBe(serialize(plan.mergedProject));
    expect(plan.wire.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("같은 맵의 다른 편집은 충돌이다", async () => {
    const base = createHouseTemplateGalleryProject();
    const [mapId] = mapIds(base);
    const mine = structuredClone(base);
    mine.maps[mapId] = renamed(mine, mapId, "내 맵");
    const latest = structuredClone(base);
    latest.maps[mapId] = renamed(latest, mapId, "남의 맵");

    const plan = await planMapPatch(mapPatchChangeSet(base, mine), readMapPatchSnapshot(asStoredJson(latest)));

    expect(plan).toEqual({ kind: "conflict", conflicts: [{ mapId, name: "내 맵" }] });
  });

  it("최신본이 없으면(첫 저장) 기준본을 최신본으로 써서 후보를 만든다", async () => {
    const base = createHouseTemplateGalleryProject();
    const [mapId] = mapIds(base);
    const mine = structuredClone(base);
    mine.maps[mapId] = renamed(mine, mapId, "내 맵");
    const changeSet = mapPatchChangeSet(base, mine);

    const plan = await planMapPatch(changeSet, changeSet.canonicalBase);

    expect(plan.kind).toBe("candidate");
  });

  it("호출자가 changedMapIds 를 주면 그 목록만 병합한다", async () => {
    const base = createHouseTemplateGalleryProject();
    const [mineId, otherId] = mapIds(base);
    const mine = structuredClone(base);
    mine.maps[mineId] = renamed(mine, mineId, "내 맵");
    mine.maps[otherId] = renamed(mine, otherId, "안 보낼 편집");
    const changeSet = mapPatchChangeSet(base, mine, [mineId]);

    const plan = await planMapPatch(changeSet, changeSet.canonicalBase);

    expect(plan.kind).toBe("candidate");
    if (plan.kind !== "candidate") return;
    expect(plan.mergedProject.maps[otherId]?.name).toBe(base.maps[otherId]?.name);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run test/persistence/mapPatch.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: `mapPatch.ts` 를 만든다**

```ts
// src/project/persistence/core/mapPatch.ts
import { applyAudioDescriptionDelta } from "../../audioDescriptions";
import { serialize } from "../../io";
import { validateProjectReferences } from "../../io/references";
import { readProjectV4MapMergeSnapshot } from "../../io/shape";
import { applyMonsterMetadataDelta } from "../../monsterMetadata";
import { SCHEMA_VERSION, type Project } from "../../types";
import { deserializeStoredProjectJson, repairStoredLoadFoundation } from "./loadRepair";
import { changedMapIdsBetween, changedMapTreeIdsBetween, mapSaveConflicts, mergeProjectMaps, type MapSaveConflict } from "./mapMerge";
import { projectWire, type ProjectWire } from "./projectWire";

// Map merging only needs maps/mapTree, but the audio-description and monster-metadata
// deltas compare the same remote snapshot, so those optional roots stay visible.
export type MapPatchSnapshot = Pick<Project, "maps" | "mapTree"> & Partial<Pick<Project, "audioDescriptions" | "monsterMetadata">>;

/**
 * Symmetric map comparison keeps load-compatible shape defaults without erasing
 * references before root ownership is resolved. Malformed local intermediates
 * retain the existing comparison fallback; the completed candidate must validate.
 */
export function canonicalizeForMapComparison(project: Project): MapPatchSnapshot {
  try {
    return readMapPatchSnapshot(JSON.parse(serialize(project)) as unknown);
  } catch {
    return project;
  }
}

export function readMapPatchSnapshot(value: unknown): MapPatchSnapshot {
  if (!isRecord(value) || value.version !== SCHEMA_VERSION) return deserializeStoredProjectJson(value);
  const snapshot = structuredClone(value);
  // Keep compatibility foundation changes, but never use ordinary load repair
  // to prune map references against roots that the local candidate may restore.
  repairStoredLoadFoundation(snapshot);
  return readProjectV4MapMergeSnapshot(snapshot);
}

/** 한 번의 저장 시도 동안 변하지 않는 재료. 재시도 루프 밖에서 한 번 계산한다. */
export type MapPatchChangeSet = {
  /** 이벤트 초안을 뺀 기준본. 호출자가 `projectWithoutEventDrafts` 와 legacy sprite 제거를 끝낸 것. */
  readonly baseProject: Project;
  /** 같은 처리를 끝낸 로컬 문서. */
  readonly persistedProject: Project;
  readonly canonicalBase: MapPatchSnapshot;
  readonly canonicalLocal: MapPatchSnapshot;
  readonly changedMapIds: readonly string[];
  readonly changedMapTreeIds: readonly string[];
};

export function mapPatchChangeSet(baseProject: Project, persistedProject: Project, changedMapIds?: readonly string[]): MapPatchChangeSet {
  const canonicalBase = canonicalizeForMapComparison(baseProject);
  const canonicalLocal = canonicalizeForMapComparison(persistedProject);
  return {
    baseProject,
    persistedProject,
    canonicalBase,
    canonicalLocal,
    changedMapIds: changedMapIds ?? changedMapIdsBetween(canonicalBase, canonicalLocal),
    changedMapTreeIds: changedMapTreeIdsBetween(canonicalBase.mapTree, canonicalLocal.mapTree),
  };
}

export type MapPatchPlan =
  | { readonly kind: "conflict"; readonly conflicts: readonly MapSaveConflict[] }
  | { readonly kind: "candidate"; readonly mergedProject: Project; readonly wire: ProjectWire };

/**
 * 최신 저장본 하나에 대해 충돌을 판정하고 병합 후보와 와이어를 만든다. 쓰지 않는다 —
 * 조건부 갱신(CAS)과 재시도는 어댑터의 몫이다. 어댑터마다 이 함수를 같은 순서로 부른다.
 */
export async function planMapPatch(changeSet: MapPatchChangeSet, latest: MapPatchSnapshot): Promise<MapPatchPlan> {
  const { baseProject, persistedProject, canonicalBase, canonicalLocal, changedMapIds, changedMapTreeIds } = changeSet;
  const conflicts = mapSaveConflicts(canonicalBase, canonicalLocal, latest, changedMapIds);
  if (conflicts.length > 0) return { kind: "conflict", conflicts };

  const candidate = mergeProjectMaps(latest, persistedProject, changedMapIds, changedMapTreeIds);
  const audioDescriptions = applyAudioDescriptionDelta(
    baseProject.audioDescriptions,
    persistedProject.audioDescriptions,
    latest.audioDescriptions,
  );
  // mergeProjectMaps returns a detached root; never mutate any input snapshot.
  if (audioDescriptions === undefined) delete candidate.audioDescriptions;
  else candidate.audioDescriptions = audioDescriptions;
  const monsterMetadata = applyMonsterMetadataDelta(
    baseProject.monsterMetadata,
    persistedProject.monsterMetadata,
    latest.monsterMetadata,
  );
  if (monsterMetadata === undefined) delete candidate.monsterMetadata;
  else candidate.monsterMetadata = monsterMetadata;
  // Do not let load repair silently discard invalid intended references. Only
  // the fully validated merge may enter the existing SHA-conditional write.
  validateProjectReferences(candidate);
  const mergedProject = deserializeStoredProjectJson(candidate);
  return { kind: "candidate", mergedProject, wire: await projectWire(mergedProject) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
```

- [ ] **Step 4: sync 의 `saveProjectMapPatchToLegacyDb` 본문을 교체한다**

`canonicalizeForMapComparison`·`type MapPatchSnapshot`·`readMapPatchSnapshot` (약 1144–1163행)을 sync 에서 지우고 `import { mapPatchChangeSet, planMapPatch, readMapPatchSnapshot } from "./persistence/core/mapPatch";` 를 넣는다. 함수 본문은 다음으로 바꾼다(앞 8줄 `if (!config)` ~ `removeLegacySpriteReferences(baseProject);` 는 그대로).

```ts
  const changeSet = mapPatchChangeSet(baseProject, persistedProject, input.changedMapIds);
  for (let attempt = 0; attempt < MAP_PATCH_MAX_ATTEMPTS; attempt += 1) {
    // Conflict/merge against current_json only (no maps overlay). RTT cut: drop
    // saveChangedMapRowsFromCanonical's before/after full-snapshot pair.
    const latestRow = await loadProjectRowFromLegacyDb(config);
    // A remotely activated canonical target must not be patched from stale legacy content.
    if (latestRow && isRecord(latestRow.current_json) && Object.hasOwn(latestRow.current_json, "spatialAuthoring")) {
      throw new ProjectRoutingError("activation-required", "The legacy target was activated remotely. Reload before editing; stale content cannot acquire its new token.");
    }
    const latestProject = latestRow ? readMapPatchSnapshot(latestRow.current_json) : changeSet.canonicalBase;
    const latestSha = latestRow?.current_sha256 ?? null;

    const plan = await planMapPatch(changeSet, latestProject);
    if (plan.kind === "conflict") return { kind: "conflict", conflicts: plan.conflicts };
    const saved = await saveProjectSnapshotToLegacyDb(config, plan.mergedProject, latestSha, plan.wire);
    if (!saved) continue;
    try {
      // maps table = map-content SoT mirror written after successful project snapshot.
      await saveChangedMapRows(config, plan.mergedProject, changeSet.changedMapIds);
    } catch (error) {
      if (!isOptionalTableMissingError(error)) throw error;
    }
    return { kind: "saved", project: plan.mergedProject, sha256: plan.wire.sha256 };
  }
  throw new LegacyDbProjectSyncError("LegacyDb project changed too often while saving map patch", 409);
```

이제 sync 에서 `applyAudioDescriptionDelta`·`applyMonsterMetadataDelta`·`validateProjectReferences`·`readProjectV4MapMergeSnapshot`·`SCHEMA_VERSION` 을 쓰는 곳이 남아 있는지 grep 하고, 없으면 import 를 지운다.

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run test/persistence --reporter=dot && npx vitest run test/legacyDbProjectSync.test.ts test/storeSaveOrdering.test.ts test/storeFlushShaEvidence.test.ts --reporter=dot && npx tsc --noEmit -p tsconfig.app.json`
Expected: 전부 PASS, tsc 0.

- [ ] **Step 6: 커밋**

```bash
git add src/project/persistence/core/mapPatch.ts test/persistence/mapPatch.test.ts src/project/legacyDbProjectSync.ts
git commit -F - <<'MSG'
refactor(persistence): 맵 패치 계획을 core 로 빼고 sync 가 그것을 부른다

충돌 판정·병합·오디오/몬스터 메타 델타·참조 검증·와이어 계산을 `planMapPatch` 하나로 묶었다.
`saveProjectMapPatchToLegacyDb` 는 최신 행 읽기 → 계획 → 조건부 갱신 → 미러 순서를 그대로
돌되 계획 부분만 core 를 부른다. 재시도 루프 밖에서 한 번 계산하던 changedMapIds·트리 변경도
`mapPatchChangeSet` 으로 같은 위치에 남는다.

Constraint: 조건부 갱신(CAS)과 재시도 횟수는 어댑터 소관 — core 는 쓰지 않는다
Rejected: planMapPatch 안에서 최신본을 읽게 하기 | 읽기가 전송 의존이라 core 경계를 깬다
Confidence: high
Scope-risk: narrow
Reversibility: clean
Directive: 어댑터의 saveMapPatch 는 항상 mapPatchChangeSet → (최신본 읽기 → planMapPatch → CAS) 루프 순서를 지킨다
Tested: npx vitest run test/persistence test/legacyDbProjectSync.test.ts test/storeSaveOrdering.test.ts test/storeFlushShaEvidence.test.ts
Tested: npx tsc --noEmit -p tsconfig.app.json

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
MSG
```

---

## Task 5: 포트 — 저장 대상, 인터페이스, 선택기

**Files:**
- Create: `src/project/persistence/target.ts`
- Create: `src/project/persistence/types.ts`
- Create: `src/project/persistence/repository.ts`
- Create: `test/persistence/repositorySelection.test.ts`
- Modify: `src/project/spatial/saveRouting.ts` (`sameProjectTarget` 정의 삭제 → import + re-export)
- Modify: `src/project/legacyDbProjectSync.ts` (`type LegacyDbAiAnalysisRunInput` 에 `export`)

**Interfaces:**
- Produces:
  - `type RemoteProjectTarget = LegacyDbProjectConfig`, `type ProjectTarget = RemoteProjectTarget` (P4 에서 유니언으로 넓힘), `projectTargetKey(target): string`, `sameProjectTarget(a: ProjectTarget, b: ProjectTarget | null): boolean`
  - `interface ProjectRepository` (아래 코드가 정본)
  - `projectRepository(): ProjectRepository`, `setProjectRepositoryForTest(repository: ProjectRepository | null): void`
- 이 태스크는 `createLegacyDbRepository` 를 아직 만들지 않는다. `repository.ts` 는 Task 7 까지 임시로 `throw` 하는 자리표시자를 두지 **않고**, Task 7 에서 import 를 채운다. 그래서 이 태스크의 테스트는 주입 경로만 검사한다.

- [ ] **Step 1: 실패하는 테스트**

```ts
// test/persistence/repositorySelection.test.ts
import { afterEach, describe, expect, it } from "vitest";
import { projectRepository, setProjectRepositoryForTest } from "@/project/persistence/repository";
import type { ProjectRepository } from "@/project/persistence/types";

const stub = { kind: "memory" } as unknown as ProjectRepository;

describe("projectRepository 선택기", () => {
  afterEach(() => setProjectRepositoryForTest(null));

  it("테스트 주입이 있으면 그것을 돌려준다", () => {
    setProjectRepositoryForTest(stub);
    expect(projectRepository()).toBe(stub);
  });

  it("주입을 지우면 기본 어댑터(remote)로 돌아간다", () => {
    setProjectRepositoryForTest(stub);
    setProjectRepositoryForTest(null);
    expect(projectRepository().kind).toBe("remote");
  });

  it("기본 어댑터는 한 번만 만들어진다", () => {
    expect(projectRepository()).toBe(projectRepository());
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run test/persistence/repositorySelection.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: `target.ts`**

```ts
// src/project/persistence/target.ts
import type { LegacyDbProjectConfig } from "../legacyDbProjectConfig";

/** 원격 행 대상. url·projectId·anonKey — 지금의 LegacyDbProjectConfig 와 같은 모양이다. */
export type RemoteProjectTarget = LegacyDbProjectConfig;

/**
 * 저장 대상. P1 에서는 원격 모양 하나다. Electron 어댑터를 붙이는 단계에서
 * `RemoteProjectTarget | LocalProjectTarget` 유니언으로 넓힌다 — 그때 컴파일러가 대상을
 * 만들고 비교하는 자리를 전부 찍어 준다. 지금 dead branch 를 두지 않는다.
 */
export type ProjectTarget = RemoteProjectTarget;

/** 대상 비교용 키. 자격증명은 넣지 않는다(로그·Map 키로 쓴다). */
export function projectTargetKey(target: ProjectTarget): string {
  return `remote:${target.url}:${target.projectId}`;
}

/** saveRouting 에 있던 정의를 옮겼다. 같은 url·projectId·anonKey 면 같은 대상이다. */
export function sameProjectTarget(a: ProjectTarget, b: ProjectTarget | null): boolean {
  return b !== null && a.url === b.url && a.projectId === b.projectId && a.anonKey === b.anonKey;
}
```

`src/project/spatial/saveRouting.ts`: `export function sameProjectTarget(...) {...}` 3줄을 지우고 상단에 `import { sameProjectTarget } from "../persistence/target";` 와 `export { sameProjectTarget };` 를 둔다(같은 파일에서 `routeSpatialSave` 가 쓰고, store 와 테스트가 이 경로로 import 한다).

- [ ] **Step 4: `types.ts`**

```ts
// src/project/persistence/types.ts
import type { Project } from "../types";
import type { CanonicalSave, ProjectWriteAuthority } from "../spatial/saveRouting";
import type { DbPersistenceDisabledReason, DbPersistenceStatus } from "../persistenceStatus";
import type {
  LegacyDbAiActivityLogInput,
  LegacyDbAiAnalysisRunInput,
  LegacyDbConversationInput,
  LegacyDbProjectCommitInput,
  LegacyDbProjectCommitListItem,
  LegacyDbProjectMapPatchInput,
  LegacyDbProjectSnapshot,
  LegacyDbSaveResult,
} from "../legacyDbProjectSync";
import type { ProjectTarget } from "./target";

// 중립 이름. 지금은 sync 모듈의 타입에 대한 별칭이고, LegacyDb 퇴역 단계에서 정의가 이쪽으로 온다.
export type ProjectSnapshot = LegacyDbProjectSnapshot;
export type SaveResult = LegacyDbSaveResult;
export type MapPatchInput = LegacyDbProjectMapPatchInput;
export type CommitInput = LegacyDbProjectCommitInput;
export type CommitListItem = LegacyDbProjectCommitListItem;
export type AiActivityInput = LegacyDbAiActivityLogInput;
export type AiAnalysisRunInput = LegacyDbAiAnalysisRunInput;
export type ConversationInput = LegacyDbConversationInput;
export type PersistenceStatus = DbPersistenceStatus;

export type LoadSnapshotOptions = {
  readonly overlayMaps?: boolean;
  readonly includeProjectId?: boolean;
  readonly signal?: AbortSignal;
};
export type ActivityListOptions = { readonly runId?: string };
export type ConversationListOptions = {
  readonly query?: string;
  readonly limit?: number;
  readonly offset?: number;
  readonly signal?: AbortSignal;
  readonly includeEntries?: boolean;
  readonly projectContextKey?: string;
};

/**
 * 프로젝트 저장소 포트. store 와 주변 모듈은 이것만 부른다.
 *
 * 대상 매개변수 규칙: `target` 을 **생략**하면 어댑터가 `currentTarget()` 을 쓴다.
 * `null` 을 **명시**하면 미설정으로 처리한다(sync 함수의 `config = legacyDbProjectConfig()`
 * 기본 매개변수와 같은 의미 — `undefined` 만 기본값을 부른다).
 */
export interface ProjectRepository {
  readonly kind: "remote" | "local" | "memory";
  /** 지금 이 편집기 세션이 향하는 대상. 원격이면 설정·URL·저장된 선택에서 계산한다. */
  currentTarget(): ProjectTarget | null;
  status(disabledReason: DbPersistenceDisabledReason | null): PersistenceStatus;
  /** 가벼운 연결 확인. 어댑터가 실패 이유를 로그로 남기고 boolean 만 돌려준다. */
  probe(): Promise<boolean>;
  /** 편집기 로드 읽기. 권한(authority)은 콜백으로 준다 — 지금 store.readRemoteProject 의 모양. */
  loadProject(target: ProjectTarget | null, onAuthority?: (authority: ProjectWriteAuthority) => void): Promise<Project | null>;
  loadSnapshot(target: ProjectTarget, options?: LoadSnapshotOptions): Promise<ProjectSnapshot | null>;
  /** 저장 증명용 읽기 — 커밋 tip 을 건드리지 않는다. */
  loadForProof(target: ProjectTarget, signal?: AbortSignal): Promise<ProjectSnapshot | null>;
  save(project: Project, target: ProjectTarget, authority?: ProjectWriteAuthority): Promise<SaveResult>;
  saveMapPatch(input: MapPatchInput, target: ProjectTarget): Promise<SaveResult>;
  /** 원격 전용: legacy 행을 spatial 정본으로 승격. 없는 어댑터에서는 store 가 ProjectRoutingError 를 던진다. */
  activateLegacy?(target: ProjectTarget): Promise<CanonicalSave>;
  readonly commits: {
    record(input: CommitInput, target?: ProjectTarget | null): Promise<SaveResult>;
    list(limit: number, target?: ProjectTarget | null): Promise<readonly CommitListItem[]>;
    hydrateTip(target?: ProjectTarget | null): Promise<string | null>;
    peekTip(projectId: string): string | null;
    seedTip(projectId: string, commitId: string | null | undefined): void;
  };
  readonly ai: {
    recordActivity(input: AiActivityInput, target?: ProjectTarget | null): Promise<SaveResult>;
    listActivity(limit: number, target?: ProjectTarget | null, options?: ActivityListOptions): Promise<readonly Record<string, unknown>[]>;
    recordConversation(input: ConversationInput, target?: ProjectTarget | null): Promise<SaveResult>;
    listConversations(options: ConversationListOptions, target?: ProjectTarget | null): Promise<readonly Record<string, unknown>[]>;
    loadConversation(conversationId: string, target?: ProjectTarget | null, signal?: AbortSignal): Promise<Record<string, unknown> | null>;
    recordAnalysisRun(input: AiAnalysisRunInput, target?: ProjectTarget | null): Promise<SaveResult>;
  };
}
```

`src/project/legacyDbProjectSync.ts` 의 `type LegacyDbAiAnalysisRunInput = {` 를 `export type LegacyDbAiAnalysisRunInput = {` 로 바꾼다.

- [ ] **Step 5: `repository.ts`**

```ts
// src/project/persistence/repository.ts
import { createLegacyDbRepository } from "./legacyDbRepository";
import type { ProjectRepository } from "./types";

let override: ProjectRepository | null = null;
let remote: ProjectRepository | null = null;

/**
 * 이 편집기 세션의 저장소. 부팅 시 고정되지 않고 부를 때마다 고른다 — store 는 모듈
 * 싱글턴이라 테스트가 import 뒤에 주입하기 때문이다. Electron 어댑터는 P4 에서 이 함수의
 * 첫 분기로 들어온다(preload 브리지 유무).
 */
export function projectRepository(): ProjectRepository {
  if (override) return override;
  remote ??= createLegacyDbRepository();
  return remote;
}

/** 테스트 전용. null 이면 기본 어댑터로 돌아간다. */
export function setProjectRepositoryForTest(repository: ProjectRepository | null): void {
  override = repository;
}
```

Task 7 전까지 `./legacyDbRepository` 가 없어 tsc 가 실패한다. 이 태스크의 커밋을 위해 **최소 어댑터**를 함께 만든다 — Task 7 에서 본체로 채운다:

```ts
// src/project/persistence/legacyDbRepository.ts (Task 5 시점의 최소본)
import { legacyDbProjectConfig } from "../legacyDbProjectConfig";
import { dbPersistenceStatus } from "../persistenceStatus";
import type { ProjectRepository } from "./types";

export function createLegacyDbRepository(): ProjectRepository {
  const notWired = (name: string) => () => Promise.reject(new Error(`legacyDbRepository.${name} 는 Task 7 에서 연결된다`));
  return {
    kind: "remote",
    currentTarget: () => legacyDbProjectConfig(),
    status: (disabledReason) => dbPersistenceStatus({ disabledReason }),
    probe: notWired("probe"),
    loadProject: notWired("loadProject"),
    loadSnapshot: notWired("loadSnapshot"),
    loadForProof: notWired("loadForProof"),
    save: notWired("save"),
    saveMapPatch: notWired("saveMapPatch"),
    commits: { record: notWired("commits.record"), list: notWired("commits.list"), hydrateTip: notWired("commits.hydrateTip"), peekTip: () => null, seedTip: () => undefined },
    ai: { recordActivity: notWired("ai.recordActivity"), listActivity: notWired("ai.listActivity"), recordConversation: notWired("ai.recordConversation"), listConversations: notWired("ai.listConversations"), loadConversation: notWired("ai.loadConversation"), recordAnalysisRun: notWired("ai.recordAnalysisRun") },
  };
}
```

아직 아무도 이 어댑터를 부르지 않으므로(store 는 Task 8 에서 바뀐다) 런타임 영향이 없다.

- [ ] **Step 6: 통과 확인**

Run: `npx vitest run test/persistence --reporter=dot && npx vitest run test/legacyDbProjectSync.test.ts test/legacyDbProjectConfig.test.ts test/spatialPersistence.test.ts --reporter=dot && npx tsc --noEmit -p tsconfig.app.json && npx tsc --noEmit`
Expected: PASS, 두 tsc 모두 0.

- [ ] **Step 7: 커밋**

```bash
git add src/project/persistence/target.ts src/project/persistence/types.ts src/project/persistence/repository.ts src/project/persistence/legacyDbRepository.ts test/persistence/repositorySelection.test.ts src/project/spatial/saveRouting.ts src/project/legacyDbProjectSync.ts
git commit -F - <<'MSG'
feat(persistence): 저장소 포트 인터페이스와 대상 타입, 선택기를 둔다

`ProjectRepository` 가 store 와 주변 모듈이 부를 유일한 저장 표면이다. 타입은 지금 sync 모듈의
것에 대한 중립 별칭이라 어댑터를 감싸도 의미가 바뀌지 않는다. `ProjectTarget` 은 P1 에서 원격
모양 하나이고 로컬 어댑터 단계에서 유니언으로 넓힌다. `sameProjectTarget` 정의는 saveRouting
에서 옮기고 re-export 로 옛 경로를 살렸다.

Constraint: store 는 모듈 싱글턴이라 저장소를 부팅 시 고정하면 테스트가 주입할 수 없다 — 부를 때마다 고른다
Rejected: ProjectTarget 을 지금 유니언으로 | 로컬 분기가 전부 dead code 가 되고 리뷰가 어렵다
Rejected: 대상 기본값을 어댑터가 currentTarget() 으로 채우기 | sync 의 기본 매개변수 의미(undefined 만 기본값)와 어긋나 null 명시 경로가 바뀐다
Confidence: high
Scope-risk: narrow
Reversibility: clean
Directive: 포트에 메서드를 더할 때는 실제 소비자가 있어야 한다 — listProjects·assets·외부 변경 구독은 그 소비자가 생기는 단계(P3·P4)에서 넣는다
Tested: npx vitest run test/persistence test/legacyDbProjectSync.test.ts test/legacyDbProjectConfig.test.ts test/spatialPersistence.test.ts
Tested: npx tsc --noEmit && npx tsc --noEmit -p tsconfig.app.json

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
MSG
```

---

## Task 6: 메모리 어댑터와 계약 테스트

**Files:**
- Create: `src/project/persistence/memoryRepository.ts`
- Create: `test/persistence/repositoryContract.test.ts`

**Interfaces:**
- Consumes: core 전부, `types.ts`, `target.ts`.
- Produces: `createMemoryRepository(options: { readonly target: ProjectTarget | null; readonly now?: () => string }): MemoryRepository` where `MemoryRepository = ProjectRepository & { readonly rows: ReadonlyMap<string, MemoryProjectRow> }`.

메모리 어댑터의 의미는 **legacy(비 spatial) 문서의 LegacyDb 경로**와 같다: 저장은 `projectWithoutEventDrafts` + legacy sprite 제거 + 와이어 계산 + 행 교체, 맵 패치는 `mapPatchChangeSet → planMapPatch → CAS` 루프, 커밋·AI 기록은 같은 컬럼 이름의 행. spatial 발행(`spatialAuthoring` 마커)은 모델링하지 않는다 — 계약 테스트는 legacy 문서만 쓴다.

- [ ] **Step 1: 계약 테스트를 쓴다 (메모리 어댑터만 먼저 등록)**

```ts
// test/persistence/repositoryContract.test.ts
import { afterEach, describe, expect, it } from "vitest";
import { createHouseTemplateGalleryProject } from "@/project/defaults/defaultProject";
import { projectWithoutEventDrafts } from "@/project/eventDrafts";
import { serialize, serializeForComparison } from "@/project/io";
import { createMemoryRepository } from "@/project/persistence/memoryRepository";
import type { ProjectTarget } from "@/project/persistence/target";
import type { ProjectRepository } from "@/project/persistence/types";
import type { GameMap, Project } from "@/project/types";
import { sha256HexText } from "@/util/sha256";

type Fixture = { readonly repository: ProjectRepository; readonly target: ProjectTarget; readonly cleanup?: () => void };
type FixtureFactory = (projectId: string) => Fixture | Promise<Fixture>;

let sequence = 0;
const nextProjectId = () => `contract-${Date.now().toString(36)}-${(sequence += 1)}`;
const identity = { id: "editor-1", label: "테스터", kind: "human" as const };

function mapIds(project: Project): [string, string] {
  const [first, second] = Object.keys(project.maps);
  if (!first || !second) throw new Error("fixture needs two maps");
  return [first, second];
}
function renamed(project: Project, mapId: string, name: string): GameMap {
  const map = project.maps[mapId];
  if (!map) throw new Error(`expected map ${mapId}`);
  return { ...map, name };
}

export function describeRepositoryContract(name: string, factory: FixtureFactory): void {
  describe(`ProjectRepository 계약 — ${name}`, () => {
    let fixture: Fixture | undefined;
    afterEach(() => { fixture?.cleanup?.(); fixture = undefined; });
    const open = async () => { fixture = await factory(nextProjectId()); return fixture; };

    it("상태: 대상이 있으면 ready, 비활성 사유가 있으면 disabled", async () => {
      const { repository, target } = await open();
      const ready = repository.status(null);
      expect(ready.kind).toBe("ready");
      if (ready.kind === "ready") expect(ready.projectId).toBe(target.projectId);
      expect(repository.status("dev-showcase")).toEqual({ kind: "disabled", reason: "dev-showcase" });
    });

    it("probe 는 연결이 있으면 true", async () => {
      const { repository } = await open();
      await expect(repository.probe()).resolves.toBe(true);
    });

    it("없는 프로젝트는 null", async () => {
      const { repository, target } = await open();
      await expect(repository.loadSnapshot(target)).resolves.toBeNull();
      await expect(repository.loadProject(target)).resolves.toBeNull();
    });

    it("저장 → 읽기: 같은 내용, sha256 은 직렬화 텍스트의 해시, 권한은 legacy", async () => {
      const { repository, target } = await open();
      const project = createHouseTemplateGalleryProject();
      const saved = await repository.save(project, target, { mode: "create", target });
      expect(saved.kind).toBe("saved");
      if (saved.kind !== "saved") return;
      const expectedSha = await sha256HexText(serialize(projectWithoutEventDrafts(project)));
      expect(saved.sha256).toBe(expectedSha);
      expect(saved.authority).toEqual({ mode: "legacy", target: { ...target } });

      const snapshot = await repository.loadSnapshot(target);
      expect(snapshot?.sha256).toBe(expectedSha);
      expect(snapshot?.authority.mode).toBe("legacy");
      expect(serializeForComparison(projectWithoutEventDrafts(snapshot!.project)))
        .toBe(serializeForComparison(projectWithoutEventDrafts(project)));

      const proof = await repository.loadForProof(target);
      expect(proof?.projectId).toBe(target.projectId);
    });

    it("loadProject 는 권한 콜백을 부르고 프로젝트를 돌려준다", async () => {
      const { repository, target } = await open();
      await repository.save(createHouseTemplateGalleryProject(), target);
      const modes: string[] = [];
      const project = await repository.loadProject(target, (authority) => { modes.push(authority.mode); });
      expect(project).not.toBeNull();
      expect(modes).toEqual(["legacy"]);
    });

    it("맵 패치: 서로 다른 맵을 고친 두 편집기가 차례로 저장하면 둘 다 남는다", async () => {
      const { repository, target } = await open();
      const base = createHouseTemplateGalleryProject();
      await repository.save(base, target);
      const [aId, bId] = mapIds(base);
      const editorA = structuredClone(base);
      editorA.maps[aId] = renamed(editorA, aId, "A 의 맵");
      const editorB = structuredClone(base);
      editorB.maps[bId] = renamed(editorB, bId, "B 의 맵");

      const first = await repository.saveMapPatch({ project: editorA, baseProject: base }, target);
      const second = await repository.saveMapPatch({ project: editorB, baseProject: base }, target);

      expect(first.kind).toBe("saved");
      expect(second.kind).toBe("saved");
      const latest = await repository.loadSnapshot(target);
      expect(latest?.project.maps[aId]?.name).toBe("A 의 맵");
      expect(latest?.project.maps[bId]?.name).toBe("B 의 맵");
    });

    it("맵 패치: 같은 맵을 다르게 고치면 두 번째는 충돌", async () => {
      const { repository, target } = await open();
      const base = createHouseTemplateGalleryProject();
      await repository.save(base, target);
      const [mapId] = mapIds(base);
      const editorA = structuredClone(base);
      editorA.maps[mapId] = renamed(editorA, mapId, "A 의 맵");
      const editorB = structuredClone(base);
      editorB.maps[mapId] = renamed(editorB, mapId, "B 의 맵");

      await repository.saveMapPatch({ project: editorA, baseProject: base }, target);
      const second = await repository.saveMapPatch({ project: editorB, baseProject: base }, target);

      expect(second).toEqual({ kind: "conflict", conflicts: [{ mapId, name: "B 의 맵" }] });
    });

    it("커밋: 기록한 커밋이 목록 맨 앞에 오고 tip 이 된다", async () => {
      const { repository, target } = await open();
      const project = createHouseTemplateGalleryProject();
      await repository.save(project, target);
      const recorded = await repository.commits.record({
        project, identity, reviewStatus: "direct", summary: "첫 커밋", toolNames: [],
      }, target);
      expect(recorded.kind).toBe("saved");
      if (recorded.kind !== "saved") return;
      const list = await repository.commits.list(5, target);
      expect(list[0]?.commitId).toBe(recorded.commitId);
      expect(list[0]?.message).toBe("첫 커밋");
      expect(list[0]?.authorLabel).toBe("테스터");
      expect(repository.commits.peekTip(target.projectId)).toBe(recorded.commitId);
    });

    it("AI 활동: 기록한 로그가 목록에 있고 runId 필터가 먹는다", async () => {
      const { repository, target } = await open();
      await repository.ai.recordActivity({ logId: "log-1", runId: "run-A", channel: "chat", instruction: "안녕", payload: { n: 1 } }, target);
      await repository.ai.recordActivity({ logId: "log-2", runId: "run-B", channel: "chat", instruction: "다른 런", payload: { n: 2 } }, target);
      const all = await repository.ai.listActivity(10, target);
      expect(all.map((row) => row.log_id).sort()).toEqual(["log-1", "log-2"]);
      const onlyA = await repository.ai.listActivity(10, target, { runId: "run-A" });
      expect(onlyA.map((row) => row.log_id)).toEqual(["log-1"]);
    });

    it("AI 대화: 저장한 대화를 범위 키로 다시 찾는다", async () => {
      const { repository, target } = await open();
      const scope = `remote:${target.projectId}`;
      const saved = await repository.ai.recordConversation({
        conversationId: "conv-1", destinationProjectId: target.projectId, title: "대화 제목", model: "test-model",
        projectContextKey: scope, entries: [{ role: "user", text: "안녕" }], savedAt: Date.parse("2026-09-15T10:00:00Z"),
      }, target);
      expect(saved.kind).toBe("saved");
      const rows = await repository.ai.listConversations({ projectContextKey: scope, includeEntries: true }, target);
      expect(rows.map((row) => row.conversation_id)).toEqual(["conv-1"]);
      expect(rows[0]?.title).toBe("대화 제목");
      const one = await repository.ai.loadConversation("conv-1", target);
      expect(one?.conversation_id).toBe("conv-1");
    });

    it("대상이 null 이면 쓰기는 not-configured", async () => {
      const { repository } = await open();
      const project = createHouseTemplateGalleryProject();
      await expect(repository.commits.record({ project, identity, reviewStatus: "direct", summary: "x", toolNames: [] }, null))
        .resolves.toEqual({ kind: "not-configured" });
      await expect(repository.ai.recordActivity({ logId: "l", channel: "c", instruction: "i", payload: null }, null))
        .resolves.toEqual({ kind: "not-configured" });
    });
  });
}

describeRepositoryContract("memory", (projectId) => {
  const target: ProjectTarget = { url: "memory://contract", anonKey: "memory", projectId };
  return { repository: createMemoryRepository({ target }), target };
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run test/persistence/repositoryContract.test.ts`
Expected: FAIL — `memoryRepository` 모듈 없음.

- [ ] **Step 3: `memoryRepository.ts`**

```ts
// src/project/persistence/memoryRepository.ts
import { removeLegacySpriteReferences } from "../defaults/defaultAssets";
import { projectWithoutEventDrafts } from "../eventDrafts";
import { deserialize, serialize } from "../io";
import type { DbPersistenceDisabledReason } from "../persistenceStatus";
import type { ProjectWriteAuthority } from "../spatial/saveRouting";
import type { Project } from "../types";
import { randomUuid } from "@/util/id";
import { sha256HexText } from "@/util/sha256";
import { mapPatchChangeSet, planMapPatch, readMapPatchSnapshot } from "./core/mapPatch";
import { projectWire } from "./core/projectWire";
import type { ProjectTarget } from "./target";
import type {
  AiActivityInput, AiAnalysisRunInput, CommitInput, CommitListItem, ConversationInput, ConversationListOptions,
  LoadSnapshotOptions, MapPatchInput, PersistenceStatus, ProjectRepository, ProjectSnapshot, SaveResult,
} from "./types";

export type MemoryProjectRow = {
  readonly projectId: string;
  readonly json: unknown;
  readonly serialized: string;
  readonly sha256: string;
  readonly title: string;
  readonly updatedAt: string;
};

export type MemoryRepository = ProjectRepository & {
  readonly rows: ReadonlyMap<string, MemoryProjectRow>;
};

type Row = Record<string, unknown>;
const MAP_PATCH_MAX_ATTEMPTS = 4;

/**
 * 테스트용 저장소. legacy 문서의 LegacyDb 경로와 같은 의미를 core 함수만으로 낸다.
 * spatial 발행은 모델링하지 않는다 — 문서에 spatialAuthoring 마커가 있어도 일반 저장으로 다룬다.
 */
export function createMemoryRepository(options: { readonly target: ProjectTarget | null; readonly now?: () => string }): MemoryRepository {
  const now = options.now ?? (() => new Date().toISOString());
  const rows = new Map<string, MemoryProjectRow>();
  const commits = new Map<string, CommitListItem[]>();
  const tips = new Map<string, string>();
  const activity = new Map<string, Row[]>();
  const conversations = new Map<string, Row[]>();
  const analysisRuns: Row[] = [];
  const bucket = <T>(store: Map<string, T[]>, key: string): T[] => {
    const existing = store.get(key);
    if (existing) return existing;
    const created: T[] = [];
    store.set(key, created);
    return created;
  };
  const currentTarget = (): ProjectTarget | null => options.target;
  const resolve = (target: ProjectTarget | null | undefined): ProjectTarget | null => (target === undefined ? currentTarget() : target);

  const snapshotOf = (row: MemoryProjectRow, target: ProjectTarget, includeProjectId: boolean): ProjectSnapshot => ({
    authority: { mode: "legacy", target: { ...target } },
    project: deserialize(row.serialized),
    sha256: row.sha256,
    projectId: includeProjectId ? row.projectId : null,
  });

  const putRow = async (target: ProjectTarget, project: Project): Promise<{ readonly project: Project; readonly sha256: string }> => {
    const wire = await projectWire(project);
    rows.set(target.projectId, {
      projectId: target.projectId, json: wire.json, serialized: wire.serialized, sha256: wire.sha256,
      title: project.meta.title, updatedAt: now(),
    });
    return { project, sha256: wire.sha256 };
  };

  const repository: MemoryRepository = {
    kind: "memory",
    rows,
    currentTarget,
    status(disabledReason: DbPersistenceDisabledReason | null): PersistenceStatus {
      if (disabledReason) return { kind: "disabled", reason: disabledReason };
      const target = currentTarget();
      if (!target) return { kind: "not-configured", missing: ["url", "anonKey"], projectId: "", source: "legacy" };
      return { kind: "ready", projectId: target.projectId, source: "custom", url: target.url };
    },
    probe: () => Promise.resolve(currentTarget() !== null),
    async loadProject(target, onAuthority) {
      if (!target) return null;
      const snapshot = await repository.loadSnapshot(target);
      if (snapshot) onAuthority?.(snapshot.authority);
      return snapshot?.project ?? null;
    },
    loadSnapshot(target, loadOptions: LoadSnapshotOptions = {}) {
      const row = rows.get(target.projectId);
      return Promise.resolve(row ? snapshotOf(row, target, loadOptions.includeProjectId === true) : null);
    },
    loadForProof: (target) => repository.loadSnapshot(target, { includeProjectId: true }),
    async save(project, target, authority?: ProjectWriteAuthority): Promise<SaveResult> {
      const persistedProject = projectWithoutEventDrafts(project);
      removeLegacySpriteReferences(persistedProject);
      const saved = await putRow(target, persistedProject);
      return {
        kind: "saved", project: saved.project, sha256: saved.sha256,
        ...(authority?.mode === "create" ? { authority: { mode: "legacy" as const, target: { ...target } } } : {}),
      };
    },
    async saveMapPatch(input: MapPatchInput, target): Promise<SaveResult> {
      const persistedProject = projectWithoutEventDrafts(input.project);
      const baseProject = projectWithoutEventDrafts(input.baseProject);
      removeLegacySpriteReferences(persistedProject);
      removeLegacySpriteReferences(baseProject);
      const changeSet = mapPatchChangeSet(baseProject, persistedProject, input.changedMapIds);
      for (let attempt = 0; attempt < MAP_PATCH_MAX_ATTEMPTS; attempt += 1) {
        const latestRow = rows.get(target.projectId);
        const latest = latestRow ? readMapPatchSnapshot(latestRow.json) : changeSet.canonicalBase;
        const latestSha = latestRow?.sha256 ?? null;
        const plan = await planMapPatch(changeSet, latest);
        if (plan.kind === "conflict") return { kind: "conflict", conflicts: plan.conflicts };
        // CAS: 계획을 세우는 동안 다른 쓰기가 끼어들었으면 다시 읽는다(단일 스레드라 실제로는 항상 통과).
        if ((rows.get(target.projectId)?.sha256 ?? null) !== latestSha) continue;
        rows.set(target.projectId, {
          projectId: target.projectId, json: plan.wire.json, serialized: plan.wire.serialized, sha256: plan.wire.sha256,
          title: plan.mergedProject.meta.title, updatedAt: now(),
        });
        return { kind: "saved", project: plan.mergedProject, sha256: plan.wire.sha256 };
      }
      throw new Error("memory project changed too often while saving map patch");
    },
    commits: {
      async record(input: CommitInput, target?): Promise<SaveResult> {
        const resolved = resolve(target);
        if (!resolved) return { kind: "not-configured" };
        const serialized = input.serialized ?? serialize(projectWithoutEventDrafts(input.project));
        await sha256HexText(serialized); // LegacyDb 경로와 같은 비용·순서(current_sha256 계산)를 유지한다.
        const commitId = randomUuid();
        const list = bucket(commits, resolved.projectId);
        list.unshift({
          agentName: input.identity.kind === "agent" ? input.identity.agentName ?? null : null,
          authorId: input.identity.id, authorKind: input.identity.kind, authorLabel: input.identity.label,
          commitId, createdAt: now(), message: input.summary, reviewStatus: input.reviewStatus, summary: input.summary,
        });
        tips.set(resolved.projectId, commitId);
        return { kind: "saved", commitId };
      },
      list(limit, target?) {
        const resolved = resolve(target);
        if (!resolved) return Promise.reject(new Error("온라인 저장 연결이 필요합니다"));
        const n = Math.max(1, Math.min(100, Math.floor(limit)));
        const list = bucket(commits, resolved.projectId).slice(0, n);
        const tip = list[0]?.commitId;
        if (tip) tips.set(resolved.projectId, tip);
        return Promise.resolve(list);
      },
      async hydrateTip(target?) {
        const resolved = resolve(target);
        if (!resolved) return null;
        return (await repository.commits.list(1, resolved))[0]?.commitId ?? null;
      },
      peekTip: (projectId) => tips.get(projectId) ?? null,
      seedTip(projectId, commitId) { if (commitId) tips.set(projectId, commitId); },
    },
    ai: {
      recordActivity(input: AiActivityInput, target?) {
        const resolved = resolve(target);
        if (!resolved) return Promise.resolve({ kind: "not-configured" });
        const list = bucket(activity, resolved.projectId);
        const row: Row = {
          log_id: input.logId, project_id: resolved.projectId, channel: input.channel,
          instruction: input.instruction.slice(0, 4000), map_id: input.mapId ?? null,
          ...(input.runId ? { run_id: input.runId } : {}), payload_json: input.payload, created_at: now(),
        };
        const index = list.findIndex((entry) => entry.log_id === input.logId);
        if (index >= 0) list[index] = row; else list.unshift(row);
        return Promise.resolve({ kind: "saved" });
      },
      listActivity(limit, target?, listOptions = {}) {
        const resolved = resolve(target);
        if (!resolved) return Promise.resolve([]);
        const n = Math.max(1, Math.min(100, Math.floor(limit)));
        const list = bucket(activity, resolved.projectId)
          .filter((row) => (listOptions.runId ? row.run_id === listOptions.runId : true))
          .slice(0, n)
          .map((row) => ({ ...row, source: "ai_activity_logs" }));
        return Promise.resolve(list);
      },
      recordConversation(input: ConversationInput, target?) {
        const resolved = resolve(target);
        if (!resolved || input.destinationProjectId === null) return Promise.resolve({ kind: "not-configured" });
        const projectId = input.destinationProjectId
          ?? (input.projectContextKey?.startsWith("remote:") ? input.projectContextKey.slice(7) : resolved.projectId);
        const list = bucket(conversations, projectId);
        const row: Row = {
          conversation_id: input.conversationId, project_id: projectId, title: input.title.slice(0, 200), model: input.model,
          project_context_key: input.projectContextKey ?? null, entries_json: input.entries, saved_at: new Date(input.savedAt).toISOString(),
        };
        const index = list.findIndex((entry) => entry.conversation_id === input.conversationId);
        if (index >= 0) list[index] = row; else list.push(row);
        return Promise.resolve({ kind: "saved" });
      },
      listConversations(listOptions: ConversationListOptions, target?) {
        const resolved = resolve(target);
        if (!resolved) return Promise.reject(new Error("Conversation recovery is not configured"));
        listOptions.signal?.throwIfAborted();
        const n = Math.max(1, Math.min(100, Math.floor(listOptions.limit ?? 50)));
        const offset = Math.max(0, Math.floor(listOptions.offset ?? 0));
        const query = listOptions.query?.trim().toLowerCase();
        const rowsForProject = bucket(conversations, resolved.projectId)
          .filter((row) => (listOptions.projectContextKey === undefined ? true : row.project_context_key === listOptions.projectContextKey))
          .filter((row) => (query ? String(row.title).toLowerCase().includes(query) : true))
          .sort((a, b) => String(b.saved_at).localeCompare(String(a.saved_at)) || String(a.conversation_id).localeCompare(String(b.conversation_id)))
          .slice(offset, offset + n)
          .map((row) => (listOptions.includeEntries ? row : Object.fromEntries(Object.entries(row).filter(([key]) => key !== "entries_json"))));
        return Promise.resolve(rowsForProject);
      },
      loadConversation(conversationId, target?, signal?) {
        const resolved = resolve(target);
        if (!resolved) return Promise.reject(new Error("Conversation recovery is not configured"));
        signal?.throwIfAborted();
        return Promise.resolve(bucket(conversations, resolved.projectId).find((row) => row.conversation_id === conversationId) ?? null);
      },
      recordAnalysisRun(input: AiAnalysisRunInput, target?) {
        const resolved = resolve(target);
        if (!resolved) return Promise.resolve({ kind: "not-configured" });
        analysisRuns.push({
          run_id: randomUuid(), project_id: resolved.projectId, tileset_id: input.tilesetId,
          selected_tile_ids_json: input.selectedTiles, prompt_context_json: input.promptContext, result_json: input.result, created_at: now(),
        });
        return Promise.resolve({ kind: "saved" });
      },
    },
  };
  return repository;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run test/persistence --reporter=dot && npx tsc --noEmit && npx vitest run test/noLocalProjectDb.test.ts --reporter=dot`
Expected: 계약 11건 PASS(memory), tsc 0, 가드 PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/project/persistence/memoryRepository.ts test/persistence/repositoryContract.test.ts
git commit -F - <<'MSG'
feat(persistence): 메모리 어댑터와 저장소 계약 테스트

계약 테스트는 어댑터 하나가 아니라 포트의 의미를 고정한다 — 저장/읽기 왕복, sha256 이 직렬화
텍스트의 해시라는 것, 비겹침 맵 패치 병합, 같은 맵 충돌, 커밋 tip, AI 기록 왕복, null 대상의
not-configured. 메모리 어댑터는 core 함수만으로 legacy 문서의 LegacyDb 경로와 같은 의미를 낸다.

Constraint: 메모리 어댑터는 spatial 발행을 모델링하지 않는다 — 계약 테스트는 legacy 문서만 쓴다
Rejected: 메모리 어댑터를 Map<projectId, Project> 로 단순화 | 와이어·sha·CAS 를 빼면 로컬 스토어와 의미가 갈라진다
Confidence: high
Scope-risk: narrow
Reversibility: clean
Directive: 포트에 동작을 더하면 계약 테스트에 먼저 케이스를 넣고 모든 어댑터에서 초록을 본다
Tested: npx vitest run test/persistence (계약 11건 memory)
Tested: npx tsc --noEmit

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
MSG
```

---

## Task 7: LegacyDb 어댑터 — 기존 sync 모듈 래핑, 가짜 PostgREST 로 계약 통과

**Files:**
- Modify: `src/project/persistence/legacyDbRepository.ts` (Task 5 의 최소본을 본체로)
- Create: `test/persistence/fakePostgrest.ts`
- Modify: `test/persistence/repositoryContract.test.ts` (두 번째 `describeRepositoryContract` 등록)

**Interfaces:**
- Consumes: sync 모듈의 export 함수들(이름 그대로), `activateSpatialProjectFromRaw`, `dbPersistenceStatus`, `legacyDbProjectConfig`.
- Produces: `createLegacyDbRepository(): ProjectRepository` (완성본), `createFakePostgrest(): { readonly fetch: typeof fetch; readonly tables: ReadonlyMap<string, Record<string, unknown>[]> }`.

- [ ] **Step 1: 계약 테스트에 LegacyDb(가짜 전송) 픽스처를 추가한다 (실패)**

`test/persistence/repositoryContract.test.ts` 맨 아래에 추가:

```ts
import { vi } from "vitest";
import { createLegacyDbRepository } from "@/project/persistence/legacyDbRepository";
import { createFakePostgrest } from "./fakePostgrest";

describeRepositoryContract("legacyDb (fake PostgREST)", (projectId) => {
  const origin = "http://contract-transport.invalid";
  const postgrest = createFakePostgrest();
  vi.stubEnv("VITE_LEGACY_DB_USE_PROXY", "0");
  vi.stubEnv("VITE_LEGACY_DB_ANON_KEY", "test-anon-key");
  vi.stubEnv("VITE_LEGACY_DB_PROJECT_ID", projectId);
  vi.stubEnv("VITE_LEGACY_DB_URL", origin);
  vi.stubGlobal("window", {
    location: { hostname: "127.0.0.1", pathname: "/", search: "" },
    localStorage: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined },
  });
  vi.stubGlobal("fetch", postgrest.fetch);
  return {
    repository: createLegacyDbRepository(),
    target: { url: origin, anonKey: "test-anon-key", projectId },
    cleanup: () => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); },
  };
});
```

(import 문은 파일 상단으로 올린다.)

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run test/persistence/repositoryContract.test.ts`
Expected: FAIL — `fakePostgrest` 없음 / 최소 어댑터가 `Task 7 에서 연결된다` 로 거부.

- [ ] **Step 3: `fakePostgrest.ts`**

```ts
// test/persistence/fakePostgrest.ts
// 메모리 PostgREST. sync 모듈이 실제로 보내는 요청 모양만 지원한다:
//   GET    /rest/v1/<table>?<col>=eq.<v>&<col>=in.(...)&select=&order=&limit=&offset=&title=ilike.*x*
//   POST   /rest/v1/<table>?on_conflict=a,b   (upsert; Prefer return=representation 이면 보낸 행을 돌려준다)
//   POST   /rest/v1/<table>                    (insert)
//   PATCH  /rest/v1/<table>?<filters>           (조건부 갱신; representation 이면 갱신된 행 배열, 없으면 [])
//   DELETE /rest/v1/<table>?<filters>
//   rpc/*  와 모르는 테이블은 404 PGRST205 — spatial 발행은 지원하지 않는다.
type Row = Record<string, unknown>;

const TABLES = ["projects", "maps", "tilesets", "project_commits", "project_changes", "ai_activity_logs", "ai_analysis_runs", "ai_conversations"] as const;
const CONTROL_PARAMS = new Set(["select", "order", "limit", "offset", "on_conflict"]);

export function createFakePostgrest(): { readonly fetch: typeof fetch; readonly tables: ReadonlyMap<string, Row[]> } {
  const tables = new Map<string, Row[]>(TABLES.map((name) => [name, []]));
  let clock = Date.parse("2026-09-15T00:00:00Z");
  const stamp = (): string => new Date((clock += 1000)).toISOString();

  const matches = (row: Row, params: URLSearchParams): boolean => {
    for (const [key, raw] of params) {
      if (CONTROL_PARAMS.has(key)) continue;
      if (raw.startsWith("eq.")) { if (String(row[key]) !== raw.slice(3)) return false; }
      else if (raw.startsWith("in.(") && raw.endsWith(")")) {
        const wanted = raw.slice(4, -1).split(",").map((value) => value.replace(/^"|"$/g, "").replaceAll("\\\"", "\"").replaceAll("\\\\", "\\"));
        if (!wanted.includes(String(row[key]))) return false;
      } else if (raw.startsWith("ilike.")) {
        const needle = raw.slice(6).replaceAll("*", "").toLowerCase();
        if (!String(row[key] ?? "").toLowerCase().includes(needle)) return false;
      } else throw new Error(`fake postgrest: unsupported filter ${key}=${raw}`);
    }
    return true;
  };

  const shape = (rows: Row[], params: URLSearchParams): Row[] => {
    let out = [...rows];
    const order = params.get("order");
    if (order) {
      const keys = order.split(",").map((part) => { const [col, dir] = part.split("."); return { col: col ?? "", desc: dir === "desc" }; });
      out.sort((a, b) => {
        for (const { col, desc } of keys) {
          const cmp = String(a[col] ?? "").localeCompare(String(b[col] ?? ""));
          if (cmp !== 0) return desc ? -cmp : cmp;
        }
        return 0;
      });
    }
    const offset = Number(params.get("offset") ?? 0);
    const limit = params.get("limit");
    out = out.slice(offset, limit === null ? undefined : offset + Number(limit));
    const select = params.get("select");
    if (select && select !== "*") {
      const cols = select.split(",");
      out = out.map((row) => Object.fromEntries(cols.filter((col) => col in row).map((col) => [col, row[col]])));
    }
    return out;
  };

  const fetchImpl: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const method = (init?.method ?? "GET").toUpperCase();
    const table = url.pathname.replace(/^\/rest\/v1\//, "");
    const rows = tables.get(table);
    if (!rows) {
      return Response.json({ code: "PGRST205", message: `Could not find the table 'rpg_zzu.${table}' in the schema cache` }, { status: 404 });
    }
    const prefer = new Headers(init?.headers).get("Prefer") ?? "";
    const body: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    if (method === "GET") return Response.json(shape(rows.filter((row) => matches(row, url.searchParams)), url.searchParams));
    if (method === "POST") {
      const incoming = (Array.isArray(body) ? body : body ? [body] : []) as Row[];
      const conflict = url.searchParams.get("on_conflict")?.split(",") ?? null;
      for (const raw of incoming) {
        const row: Row = { created_at: stamp(), ...raw };
        const index = conflict ? rows.findIndex((existing) => conflict.every((col) => existing[col] === row[col])) : -1;
        if (index >= 0) rows[index] = { ...rows[index], ...raw };
        else rows.push(row);
      }
      return prefer.includes("return=representation") ? Response.json(incoming, { status: 201 }) : new Response(null, { status: 201 });
    }
    if (method === "PATCH") {
      const updated: Row[] = [];
      rows.forEach((row, index) => {
        if (!matches(row, url.searchParams)) return;
        rows[index] = { ...row, ...(body as Row) };
        updated.push(rows[index]);
      });
      return Response.json(prefer.includes("return=representation") ? updated : []);
    }
    if (method === "DELETE") {
      const keep = rows.filter((row) => !matches(row, url.searchParams));
      rows.splice(0, rows.length, ...keep);
      return new Response(null, { status: 204 });
    }
    return new Response(`fake postgrest: ${method} not supported`, { status: 405 });
  };

  return { fetch: fetchImpl, tables };
}
```

- [ ] **Step 4: 어댑터 본체**

`src/project/persistence/legacyDbRepository.ts` 전체를 다음으로 교체한다.

```ts
// src/project/persistence/legacyDbRepository.ts
import { dbPersistenceStatus, type DbPersistenceDisabledReason } from "../persistenceStatus";
import { activateSpatialProjectFromRaw } from "../spatial/saveRouting";
import { legacyDbProjectConfig } from "../legacyDbProjectConfig";
import {
  hydrateLastRemoteCommitTip,
  listProjectCommitsFromLegacyDb,
  listLegacyDbAiActivityLogs,
  listLegacyDbConversations,
  loadProjectForPersistenceProof,
  loadProjectFromLegacyDb,
  loadProjectSnapshotFromLegacyDb,
  loadLegacyDbConversation,
  peekLastRemoteCommitTip,
  recordProjectCommitToLegacyDb,
  recordLegacyDbAiActivityLog,
  recordLegacyDbAiAnalysisRun,
  recordLegacyDbConversation,
  saveProjectMapPatchToLegacyDb,
  saveProjectToLegacyDb,
  seedLastRemoteCommitTip,
} from "../legacyDbProjectSync";
import type { ProjectTarget } from "./target";
import type { ProjectRepository } from "./types";

/**
 * 기존 LegacyDb sync 모듈을 포트 뒤에 그대로 감싼다. 동작 변화 없음이 목표다.
 *
 * 규칙 둘. (1) sync 함수는 메서드 **본문 안에서** named import 로 부른다 — 모듈 로드 시점에
 * 표로 만들거나 구조 분해로 캐시하면 vi.mock/vi.spyOn 이 바꿔 끼운 함수를 못 본다.
 * (2) 인자는 호출부가 넘긴 그대로 전달한다 — `target` 이 undefined 면 undefined 를 넘겨
 * sync 의 기본 매개변수(`config = legacyDbProjectConfig()`)가 대상을 채우게 한다.
 */
export function createLegacyDbRepository(): ProjectRepository {
  return {
    kind: "remote",
    currentTarget: (): ProjectTarget | null => legacyDbProjectConfig(),
    status: (disabledReason: DbPersistenceDisabledReason | null) => dbPersistenceStatus({ disabledReason }),
    async probe() {
      const config = legacyDbProjectConfig();
      if (!config) return false;
      try {
        // GET with limit=0 on a known table in the rpg_zzu schema. Must include Accept-Profile
        // (same as legacyDbJsonHeaders "read") so PostgREST resolves the table correctly.
        const response = await fetch(`${config.url}/rest/v1/projects?limit=0`, {
          headers: {
            apikey: config.anonKey,
            Authorization: `Bearer ${config.anonKey}`,
            Accept: "application/json",
            "Accept-Profile": "rpg_zzu",
          },
          signal: AbortSignal.timeout(8000),
        });
        return response.ok;
      } catch {
        return false;
      }
    },
    loadProject: (target, onAuthority) => loadProjectFromLegacyDb(target, onAuthority),
    loadSnapshot: (target, options) => (options === undefined ? loadProjectSnapshotFromLegacyDb(target) : loadProjectSnapshotFromLegacyDb(target, options)),
    loadForProof: (target, signal) => loadProjectForPersistenceProof(target, signal),
    save: (project, target, authority) => saveProjectToLegacyDb(project, target, authority),
    saveMapPatch: (input, target) => saveProjectMapPatchToLegacyDb(input, target),
    activateLegacy: (target) => activateSpatialProjectFromRaw(target),
    commits: {
      record: (input, target) => recordProjectCommitToLegacyDb(input, target),
      list: (limit, target) => listProjectCommitsFromLegacyDb(limit, target),
      hydrateTip: (target) => hydrateLastRemoteCommitTip(target),
      peekTip: (projectId) => peekLastRemoteCommitTip(projectId),
      seedTip: (projectId, commitId) => seedLastRemoteCommitTip(projectId, commitId),
    },
    ai: {
      recordActivity: (input, target) => recordLegacyDbAiActivityLog(input, target),
      listActivity: (limit, target, options) => listLegacyDbAiActivityLogs(limit, target, options),
      recordConversation: (input, target) => recordLegacyDbConversation(input, target),
      listConversations: (options, target) => listLegacyDbConversations(options, target),
      loadConversation: (conversationId, target, signal) => loadLegacyDbConversation(conversationId, target, signal),
      recordAnalysisRun: (input, target) => recordLegacyDbAiAnalysisRun(input, target),
    },
  };
}
```

주의: `recordProjectCommitToLegacyDb(input, target)` 에서 `target` 이 `undefined` 면 JS 는 기본 매개변수를 적용한다 — `undefined` 를 **자리에 넣어 넘기는 것**과 인자를 생략하는 것은 기본값 적용에서 같다. 다르게 보이는 것은 `toHaveBeenCalledWith` 의 인자 개수뿐이며, 그 경우는 Global Constraints 의 마지막 항목대로 assertion 을 고친다.

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run test/persistence --reporter=dot && npx tsc --noEmit`
Expected: 계약 22건(memory 11 + legacyDb 11) PASS, tsc 0.

가짜 PostgREST 가 어떤 요청을 못 받는지 보려면 `fakePostgrest.ts` 의 `throw new Error("fake postgrest: unsupported filter ...")` 메시지가 그대로 어댑터 예외로 올라온다 — 그때는 sync 가 실제로 보내는 필터를 `createFakePostgrest` 에 추가한다(sync 코드는 고치지 않는다).

- [ ] **Step 6: 커밋**

```bash
git add src/project/persistence/legacyDbRepository.ts test/persistence/fakePostgrest.ts test/persistence/repositoryContract.test.ts
git commit -F - <<'MSG'
feat(persistence): LegacyDb 어댑터가 기존 sync 모듈을 그대로 감싼다

메서드 하나가 sync 함수 하나를 같은 인자로 부른다. 새 동작은 없다. 계약 테스트는 메모리
PostgREST(`test/persistence/fakePostgrest.ts`) 위에서 같은 스펙 11건을 통과한다 — 조건부
갱신(PATCH current_sha256=eq.)·upsert·in.() 삭제까지 sync 가 실제로 보내는 요청 모양만 지원한다.

Constraint: 어댑터는 sync 함수를 메서드 본문에서 named import 로 부른다 — vi.mock/vi.spyOn 이 보이려면 호출 시점 바인딩이어야 한다
Rejected: 어댑터가 target 기본값을 currentTarget() 으로 채우기 | sync 기본 매개변수와 이중이 되고 null 명시 경로가 갈라진다
Rejected: 가짜 PostgREST 에 rpc/publish_spatial_project 모델링 | spatial 발행은 어댑터 안에 갇힌 분기이고 계약은 legacy 문서로 충분하다
Confidence: high
Scope-risk: narrow
Reversibility: clean
Tested: npx vitest run test/persistence (계약 22건)
Tested: npx tsc --noEmit

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
MSG
```

---

## Task 8: store 가 포트를 부른다 — 저장·읽기·증명·활성화·헬스체크·상태

**Files:**
- Modify: `src/project/store.ts`
- Create: `test/persistence/storeUsesRepository.test.ts`

**Interfaces:**
- Consumes: `projectRepository()`, `ProjectRepository`, `sameProjectTarget`(persistence/target), 메모리 어댑터(테스트).
- store 의 공개 API(메서드 이름·반환 타입·`TransactionalNewRemoteProjectDependencies`)는 바뀌지 않는다.

- [ ] **Step 1: 실패하는 테스트 — 주입한 메모리 저장소로 flush 가 간다**

```ts
// test/persistence/storeUsesRepository.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHouseTemplateGalleryProject } from "@/project/defaults/defaultProject";
import { createMemoryRepository, type MemoryRepository } from "@/project/persistence/memoryRepository";
import type { ProjectTarget } from "@/project/persistence/target";

// store 는 모듈 싱글턴이다. vi.resetModules() 뒤에는 store 가 **새 모듈 그래프**의
// persistence/repository 를 쓰므로, 주입도 같은 그래프에서 dynamic import 한 함수로 해야 한다.
// 이 파일 상단의 static import 로 setProjectRepositoryForTest 를 부르면 다른 인스턴스에 주입된다.
type StoreModule = typeof import("@/project/store");
type RepositoryModule = typeof import("@/project/persistence/repository");

const target: ProjectTarget = { url: "memory://store-test", anonKey: "memory", projectId: "store-uses-repository" };

describe("store 는 저장소 포트로 저장·읽기·상태를 얻는다", () => {
  let memory: MemoryRepository;
  let store: StoreModule["store"];
  let repositoryModule: RepositoryModule;

  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.stubEnv("VITE_EDIT_ACTIVITY_DISK_MIRROR", "0");
    vi.stubGlobal("window", {
      location: { hostname: "127.0.0.1", pathname: "/", search: "" },
      localStorage: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined },
    });
    memory = createMemoryRepository({ target });
    repositoryModule = await import("@/project/persistence/repository");
    repositoryModule.setProjectRepositoryForTest(memory);
    ({ store } = await import("@/project/store"));
  });
  afterEach(() => {
    repositoryModule.setProjectRepositoryForTest(null);
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("상태는 주입한 저장소의 것이다", () => {
    const status = store.getDbPersistenceStatus();
    expect(status.kind).toBe("ready");
    if (status.kind === "ready") expect(status.projectId).toBe(target.projectId);
  });

  it("flush 는 주입한 저장소에 쓰고 그 sha256 을 돌려준다", async () => {
    store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true, disabledReason: null });
    store.replaceProject(createHouseTemplateGalleryProject());

    const result = await store.flush();

    expect(result.kind).toBe("saved");
    if (result.kind !== "saved") return;
    expect(memory.rows.get(target.projectId)?.sha256).toBe(result.sha256);
  });

  it("reloadFromRemote 는 주입한 저장소에서 읽는다", async () => {
    const project = createHouseTemplateGalleryProject();
    await memory.save(project, target);
    store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true, disabledReason: null });

    const result = await store.reloadFromRemote({ force: true });

    expect(result.kind).toBe("reloaded");
    // 정규화기가 맵을 더할 수 있어 맵 키 목록은 비교하지 않는다 — 제목으로 같은 문서임을 본다.
    expect(store.getCurrent().meta.title).toBe(project.meta.title);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run test/persistence/storeUsesRepository.test.ts`
Expected: FAIL — `getDbPersistenceStatus` 가 `not-configured`(store 가 아직 `dbPersistenceStatus` 를 직접 부른다), flush 가 `not-configured`.

- [ ] **Step 3: import 를 바꾼다**

`src/project/store.ts` 상단:

```ts
// 지우기
import {
  loadProjectFromLegacyDb,
  loadProjectForPersistenceProof,
  loadProjectSnapshotFromLegacyDb,
  saveProjectMapPatchToLegacyDb,
  saveProjectToLegacyDb,
  type LegacyDbSaveResult,
  type ProjectWriteAuthority,
} from "./legacyDbProjectSync";
import { activateSpatialProjectFromRaw, assertCanonicalReplacement, ProjectRoutingError, sameProjectTarget } from "./spatial/saveRouting";
import { dbPersistenceStatus, type DbPersistenceDisabledReason, type DbPersistenceStatus } from "./persistenceStatus";

// 넣기
import type { LegacyDbSaveResult, ProjectWriteAuthority } from "./legacyDbProjectSync";
import { assertCanonicalReplacement, ProjectRoutingError } from "./spatial/saveRouting";
import type { DbPersistenceDisabledReason, DbPersistenceStatus } from "./persistenceStatus";
import { projectRepository } from "./persistence/repository";
import { sameProjectTarget } from "./persistence/target";
import type { ProjectRepository } from "./persistence/types";
```

`./legacyDbProjectConfig` import 에서 `legacyDbProjectConfig` 를 뺀다(`saveLegacyDbSelectedProjectId`·`stageLegacyDbProjectConfigDraft`·`legacyDbProjectConfigDraft`·`legacyDbProjectConfigDraftWithSource`·타입 둘은 남는다).

클래스 필드 선언 아래(예: `private localProjectSessionId = randomUuid();` 다음)에 추가:

```ts
  /** 부를 때마다 고른다 — 테스트가 import 뒤 setProjectRepositoryForTest 로 바꿔 끼우기 때문이다. */
  private get repository(): ProjectRepository {
    return projectRepository();
  }
```

- [ ] **Step 4: 호출부를 바꾼다 (전부 기계적 치환. 줄 번호는 이 계획을 쓴 시점의 것)**

| 위치 | 지금 | 이후 |
|---|---|---|
| `load()` 292 | `dbPersistenceStatus({ disabledReason: null })` | `this.repository.status(null)` |
| `loadSharedDemo()` 377 | `const base = legacyDbProjectConfig();` | `const base = this.repository.currentTarget();` |
| `loadSharedDemo()` 382 | `await loadProjectSnapshotFromLegacyDb(target)` | `await this.repository.loadSnapshot(target)` |
| `loadNewRemoteProject()` 449 | `const target = legacyDbProjectConfig();` | `const target = this.repository.currentTarget();` |
| 기본 dependencies 480 | `await loadProjectForPersistenceProof(config)` | `await projectRepository().loadForProof(config)` |
| 기본 dependencies 486 | `saveProjectToLegacyDb(candidate, config)` | `projectRepository().save(candidate, config)` |
| 트랜잭션 529 | `const baseConfig = legacyDbProjectConfig();` | `const baseConfig = this.repository.currentTarget();` |
| 트랜잭션 598 | `sameProjectTarget(baseConfig, legacyDbProjectConfig())` | `sameProjectTarget(baseConfig, this.repository.currentTarget())` |
| `getDbPersistenceStatus()` 782 | `dbPersistenceStatus({ disabledReason: this.remotePersistenceDisabledReason })` | `this.repository.status(this.remotePersistenceDisabledReason)` |
| `activateSpatialAuthoring()` 787 | `const target = legacyDbProjectConfig();` | `const target = this.repository.currentTarget();` |
| 같은 함수 809·828 | `sameProjectTarget(target, legacyDbProjectConfig())` | `sameProjectTarget(target, this.repository.currentTarget())` |
| `reconnectRemotePersistence()` 860 | `dbPersistenceStatus({ disabledReason: null })` | `this.repository.status(null)` |
| `reloadFromRemote()` 915 | `legacyDbProjectConfig()?.projectId ?? null` | `this.repository.currentTarget()?.projectId ?? null` |
| `reloadFromRemoteForE2E()` 972 | `const config = legacyDbProjectConfig();` | `const config = this.repository.currentTarget();` |
| `isPersistenceReceiptCurrent()` 1107 | `const config = legacyDbProjectConfig();` | `const config = this.repository.currentTarget();` |
| `verifyPersistedRevision()` 1126 | `await loadProjectForPersistenceProof(target, options.signal)` | `await this.repository.loadForProof(target, options.signal)` |
| `saveCurrentWithAutoSaveState()` 1441 | `const target = legacyDbProjectConfig();` | `const target = this.repository.currentTarget();` |
| 같은 함수 1456·1460·1473 | `sameProjectTarget(target, legacyDbProjectConfig())` | `sameProjectTarget(target, this.repository.currentTarget())` |
| `persistCurrent()` 1511 | `const config = legacyDbProjectConfig();` | `const config = this.repository.currentTarget();` |
| `persistCurrent()` 1557 | `sameProjectTarget(target, legacyDbProjectConfig())` | `sameProjectTarget(target, this.repository.currentTarget())` |
| `readRemoteProject()` 1628 | `const target = legacyDbProjectConfig();` | `const target = this.repository.currentTarget();` |
| 같은 함수 1634·1639 | `sameProjectTarget(target, legacyDbProjectConfig())` | `sameProjectTarget(target, this.repository.currentTarget())` |
| `syncProjectUrlBar()` 1726 | `legacyDbProjectConfig()?.projectId` | `this.repository.currentTarget()?.projectId` |

세 곳은 치환이 아니라 코드 교체다.

**(a) `persistCurrent()` 1529–1531**

```ts
    const result = commitBaseline
      ? await this.repository.saveMapPatch({ project: submittedProject, baseProject: commitBaseline, authority }, target)
      : await this.repository.save(submittedProject, target, authority);
```

**(b) `readRemoteProject()` 1633**

```ts
      const project = await this.repository.loadProject(target, value => { authority = value; });
```

**(c) `activateSpatialAuthoring()` 786–809** — 활성화는 원격 전용이라 어댑터가 없을 수 있다. 동기 가드 자리에서 확인하고 클로저 밖에서 함수를 잡아 둔다.

```ts
  async activateSpatialAuthoring(): Promise<ProjectFlushResult> {
    const repository = this.repository;
    const target = repository.currentTarget();
    if (!this.loaded || !this.remotePersistenceEnabled || !target || !this.writeAuthority
      || !sameProjectTarget(this.writeAuthority.target, target)) {
      throw new ProjectRoutingError("authority-required", "Load the legacy target before explicit activation.");
    }
    const activateLegacy = repository.activateLegacy;
    if (!activateLegacy) throw new ProjectRoutingError("authority-required", "This storage cannot activate a legacy target.");
    if (this.persistInFlight) throw new ProjectRoutingError("activation-stale", "A save is in progress; activation must start from an independent raw capture.");
    // … (기존 코드 그대로) …
    const run = (async (): Promise<ProjectFlushResult> => {
      try {
        const saved = await activateLegacy.call(repository, target);
        if (this.contentLineage !== lineage || !sameProjectTarget(target, this.repository.currentTarget())) return saved;
        // … (기존 코드 그대로) …
```

**(d) `runHealthCheck()` 1365–1400** — `config` 확인과 직접 `fetch` 를 어댑터의 `probe()` 로 바꾼다. 어댑터가 같은 `GET projects?limit=0` 을 같은 헤더로 보낸다.

```ts
    if (!this.repository.currentTarget()) {
      this.stopHealthCheck();
      return;
    }
    const reachable = await this.repository.probe();
    if (this.contentLineage !== lineage || this.healthCheckTimer !== timer) return;
    if (reachable) {
      log.info("Health check: DB reachable, attempting flush");
      this.stopHealthCheck();
      this.clearAutoSaveRetry();
      this.autoSaveRetryCount = 0;
      void this.saveCurrentWithAutoSaveState().catch((error) => {
        log.error("Health-check-triggered flush failed", error);
      });
    } else {
      log.warn("Health check: DB not reachable — not triggering flush");
    }
```

(로그 문구에서 HTTP 상태 코드가 빠진다. 네트워크 예외와 non-2xx 를 어댑터가 한 boolean 으로 접기 때문이다 — 커밋 본문에 적는다.)

- [ ] **Step 5: 남은 참조 확인**

Run: `grep -nE "legacyDbProjectConfig\(\)|dbPersistenceStatus\(|loadProjectFromLegacyDb|loadProjectForPersistenceProof|loadProjectSnapshotFromLegacyDb|saveProjectToLegacyDb|saveProjectMapPatchToLegacyDb|activateSpatialProjectFromRaw" src/project/store.ts`
Expected: 출력 없음. (`legacyDbProjectConfigDraft`·`legacyDbProjectConfigDraftWithSource`·`stageLegacyDbProjectConfigDraft`·`saveLegacyDbSelectedProjectId` 는 남아 있어야 한다 — 이번 단계 범위 밖.)

- [ ] **Step 6: 통과 확인**

Run: `npx vitest run test/persistence --reporter=dot && npx tsc --noEmit -p tsconfig.app.json && npx tsc --noEmit`
Expected: PASS, tsc 0.

Run (store 회귀): `npx vitest run test/storePersistenceProof.test.ts test/storeSaveOrdering.test.ts test/storeFlushShaEvidence.test.ts test/storeEventDraftPreserve.test.ts test/storeUpdateMap.test.ts test/storeUndoSnapshotInventory.test.ts test/spatialPersistence.test.ts test/p2SpatialPersistence.test.ts test/spatialPersistenceTransport.test.ts test/dbConnectionChip.test.ts test/legacyDbProjectSync.test.ts test/noLocalProjectDb.test.ts --reporter=dot`
Expected: PASS. 한 파일이 실패하면 먼저 그 파일만 다시 돌려 부하 타임아웃을 배제하고, 그다음 `git stash` 없이 `git show origin/main:<path>` 로 기준 트리에서도 실패하는지 본다(Task 10 의 A/B 절차). 인자 개수 assertion 이면 Global Constraints 의 규칙대로 assertion 을 고친다.

- [ ] **Step 7: 커밋**

```bash
git add src/project/store.ts test/persistence/storeUsesRepository.test.ts
git commit -F - <<'MSG'
refactor(store): 저장·읽기·증명·활성화·헬스체크를 저장소 포트로 부른다

store 는 이제 `projectRepository()` 만 안다. 저장 두 경로, 로드·재로드·증명 읽기, legacy 활성화,
연결 상태, 헬스체크의 연결 확인이 전부 포트 메서드다. 대상(`currentTarget()`)은 어댑터가 계산하고
store 는 비교만 한다. 기본 어댑터가 LegacyDb 이므로 요청 모양과 인자는 그대로다.

남긴 것: 원격 설정 초안·선택 저장·URL 바·프로젝트 전환 트랜잭션·리소스 캐시·개발 덮어쓰기.
시작 화면(P4)과 LegacyDb 퇴역(P6)이 맡는다 — 계획서의 "손대지 않는 것" 표.

Constraint: store 는 모듈 싱글턴 — 저장소를 필드에 고정하지 않고 getter 로 매번 고른다
Constraint: legacy 활성화는 원격 전용이라 포트에서 optional 이다 — 없으면 동기 가드에서 ProjectRoutingError
Rejected: legacyDbProjectConfigDraft 계열도 포트로 | 설정 초안은 원격 UI 의 개념이고 로컬 대상에는 대응물이 없다 — 시작 화면이 대체
Confidence: high
Scope-risk: broad
Reversibility: clean
Directive: store 에 sync 모듈이나 legacyDbProjectConfig() 값 import 를 다시 넣지 않는다 — Task 8 Step 5 의 grep 이 비어 있어야 한다
Tested: npx vitest run test/persistence (storeUsesRepository 3건 포함)
Tested: store 회귀 12 파일 (Step 6 목록)
Tested: npx tsc --noEmit && npx tsc --noEmit -p tsconfig.app.json
Not-tested: 헬스체크 로그 문구 변경(상태 코드 생략)은 로그만 바뀌고 동작은 같다 — 테스트 없음

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
MSG
```

---

## Task 9: 주변 모듈 — 커밋 로그·팀 패널·AI 활동·AI 대화·타일 메타

**Files:**
- Modify: `src/project/projectCommitLog.ts`
- Modify: `src/editor/teamWorkflowUi.ts`
- Modify: `src/ai/activityLog.ts`
- Modify: `src/ai/conversationStore.ts`
- Modify: `src/project/tileMetadataDb.ts`

**Interfaces:**
- Consumes: `projectRepository()`. 각 모듈의 export 시그니처는 그대로.

- [ ] **Step 1: 영향 테스트 목록을 먼저 뽑고 기준선을 잡는다**

Run:
```bash
grep -rlE "recordProjectCommitToLegacyDb|listProjectCommitsFromLegacyDb|recordLegacyDbAiActivityLog|recordLegacyDbConversation|listLegacyDbConversations|recordLegacyDbAiAnalysisRun|tileMetadataDb|projectCommitLog|teamWorkflowUi|conversationStore|ai/activityLog" test --include=*.test.ts | grep -v e2e | sort > /tmp/p1-task9-tests.txt; wc -l /tmp/p1-task9-tests.txt
npx vitest run $(cat /tmp/p1-task9-tests.txt) --reporter=dot 2>&1 | tail -6
```
Expected: 파일 수가 찍히고 기준선이 초록(또는 실패 목록을 적어 둔다 — 이 단계 전에 실패하던 것은 이 단계의 회귀가 아니다).

- [ ] **Step 2: `projectCommitLog.ts`**

```ts
// 지우기
import { recordProjectCommitToLegacyDb, type ProjectCommitReviewStatus } from "./legacyDbProjectSync";
// 넣기
import type { ProjectCommitReviewStatus } from "./legacyDbProjectSync";
import { projectRepository } from "./persistence/repository";
```
두 호출부(`recordProjectCommit` 의 `await recordProjectCommitToLegacyDb({`, `recordManualProjectCommitAfterSave` 의 `void recordProjectCommitToLegacyDb({`)를 `projectRepository().commits.record({` 로 바꾼다. 43행 근처 주석의 "`recordProjectCommitToLegacyDb` 호출부가" 는 "`commits.record` 호출부가" 로.

- [ ] **Step 3: `teamWorkflowUi.ts`**

```ts
// 지우기
import { listProjectCommitsFromLegacyDb, type LegacyDbProjectCommitListItem } from "@/project/legacyDbProjectSync";
// 넣기
import type { LegacyDbProjectCommitListItem } from "@/project/legacyDbProjectSync";
import { projectRepository } from "@/project/persistence/repository";
```
`const commits = await listProjectCommitsFromLegacyDb(20);` → `const commits = await projectRepository().commits.list(20);`

- [ ] **Step 4: `activityLog.ts`**

```ts
// 지우기
import { legacyDbProjectConfig } from "@/project/legacyDbProjectConfig";
import { recordLegacyDbAiActivityLog } from "@/project/legacyDbProjectSync";
// 넣기
import { projectRepository } from "@/project/persistence/repository";
```
- outbox sender: `const result = await recordLegacyDbAiActivityLog(payload as ...)` → `const result = await projectRepository().ai.recordActivity(payload as ReturnType<typeof aiActivityRemoteInput>);`
- `persistAiActivityNow`: `const remote = await recordLegacyDbAiActivityLog(remoteInput);` → `const remote = await projectRepository().ai.recordActivity(remoteInput);`
- `aiActivityPersistenceState`: `remote: legacyDbProjectConfig() !== null` → `remote: projectRepository().currentTarget() !== null`.

- [ ] **Step 5: `conversationStore.ts`**

```ts
// 지우기
import { legacyDbProjectConfig } from "@/project/legacyDbProjectConfig";
import { listLegacyDbConversations, recordLegacyDbConversation, type LegacyDbConversationInput } from "@/project/legacyDbProjectSync";
// 넣기
import type { LegacyDbConversationInput } from "@/project/legacyDbProjectSync";
import { projectRepository } from "@/project/persistence/repository";
```
- outbox sender: `const result = await recordLegacyDbConversation({ ... })` → `const result = await projectRepository().ai.recordConversation({ ... })`
- `saveConversation`: `const config = legacyDbProjectConfig();` → `const config = projectRepository().currentTarget();` 그리고 `void recordLegacyDbConversation(remoteInput, config).catch(` → `void projectRepository().ai.recordConversation(remoteInput, config).catch(` (두 번째 인자 `config` 를 **그대로** 넘긴다 — 저장 시점에 고정한 대상이다).
- `hydrateConversationArchive`: `const captured = legacyDbProjectConfig();` → `const captured = projectRepository().currentTarget();` 그리고 `await listLegacyDbConversations({ ... }, config)` → `await projectRepository().ai.listConversations({ ... }, config)`.

- [ ] **Step 6: `tileMetadataDb.ts`**

```ts
// 지우기
import { loadProjectSnapshotFromLegacyDb, recordLegacyDbAiAnalysisRun, saveProjectToLegacyDb, type ProjectWriteAuthority, type LegacyDbSaveResult } from "./legacyDbProjectSync";
// 넣기
import type { ProjectWriteAuthority, LegacyDbSaveResult } from "./legacyDbProjectSync";
import { projectRepository } from "./persistence/repository";
```

```ts
export async function loadProjectFromLegacyDbCanonicalStore(): Promise<StoredProject> {
  const repository = projectRepository();
  const target = repository.currentTarget();
  const snapshot = target ? await repository.loadSnapshot(target) : null;
  return snapshot ? { found: true, project: snapshot.project, authority: snapshot.authority } : { found: false, project: null };
}

export async function saveProjectToLegacyDbCanonicalStore(project: Project, authority?: ProjectWriteAuthority): Promise<LegacyDbSaveResult> {
  const repository = projectRepository();
  const target = repository.currentTarget();
  if (!target) return { kind: "not-configured" };
  return repository.save(projectWithoutEventDrafts(project), target, authority);
}
```
`recordAiAnalysisRun`: `await recordLegacyDbAiAnalysisRun(input);` → `await projectRepository().ai.recordAnalysisRun(input);`

(원래 `loadProjectSnapshotFromLegacyDb()` 와 `saveProjectToLegacyDb(project, undefined, authority)` 는 설정이 없으면 각각 null·not-configured 였다. 위 코드가 같은 결과를 낸다.)

- [ ] **Step 7: 남은 직접 호출 확인**

Run: `grep -rlE "from \"(@/project/|\./|\.\./project/)legacyDbProjectSync\"" src --include=*.ts | sort`
Expected(정확히 이 목록):
```
src/editor/panels/dbConnectionProjectPicker.ts
src/editor/panels/dbConnectionSettings.ts
src/editor/panels/projectPickerCover.ts
src/editor/teamWorkflowUi.ts          (type import 만)
src/ai/conversationStore.ts           (type import 만)
src/project/persistence/legacyDbRepository.ts
src/project/persistence/types.ts      (type import 만)
src/project/projectCommitLog.ts       (type import 만)
src/project/store.ts                  (type import 만)
src/project/tileMetadataDb.ts         (type import 만)
```
값 import 가 남은 파일은 어댑터와 패널 셋뿐이어야 한다. 확인 명령: `grep -rnE "^import \{[^}]*\b(load|save|record|list|hydrate|peek|seed)[A-Za-z]*(LegacyDb|FromLegacyDb|ToLegacyDb)[^}]*\} from" src --include=*.ts | grep -v persistence/legacyDbRepository.ts | grep -v "src/editor/panels/"` → 출력 없음.

- [ ] **Step 8: 통과 확인**

Run: `npx vitest run $(cat /tmp/p1-task9-tests.txt) test/persistence --reporter=dot 2>&1 | tail -6 && npx tsc --noEmit && npx tsc --noEmit -p tsconfig.app.json`
Expected: Step 1 기준선과 같은 결과(초록), tsc 0. `test/storePersistenceProof.test.ts` 의 `vi.spyOn(sync, "recordProjectCommitToLegacyDb")` 가 여전히 호출을 본다 — 어댑터가 호출 시점 바인딩으로 부르기 때문이다.

- [ ] **Step 9: 커밋**

```bash
git add src/project/projectCommitLog.ts src/editor/teamWorkflowUi.ts src/ai/activityLog.ts src/ai/conversationStore.ts src/project/tileMetadataDb.ts
git commit -F - <<'MSG'
refactor(persistence): 커밋 로그·팀 패널·AI 기록·타일 메타가 포트를 부른다

sync 함수를 값으로 import 하던 다섯 모듈을 `projectRepository()` 로 돌렸다. 인자는 그대로다 —
대화 미러는 저장 시점에 잡은 대상을 두 번째 인자로 계속 넘기고, 타일 메타의 설정 없음 경로는
전과 같이 null·not-configured 를 돌려준다. 이제 sync 함수를 값으로 부르는 곳은 LegacyDb 어댑터와
원격 전용 패널 셋뿐이다.

Constraint: 대화 미러의 대상은 저장 시점 고정 — 재시도가 현재 프로젝트를 채택하면 안 된다(기존 주석의 계약)
Confidence: high
Scope-risk: narrow
Reversibility: clean
Directive: src 에서 sync 함수를 값으로 import 하는 새 자리를 만들지 않는다 — 어댑터와 패널 셋(P4 에서 시작 화면으로 대체)만 예외
Tested: npx vitest run <Task 9 Step 1 의 영향 파일 목록> test/persistence
Tested: npx tsc --noEmit && npx tsc --noEmit -p tsconfig.app.json

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
MSG
```

---

## Task 10: 전체 검증과 PR

**Files:** 없음(검증·PR 만). 실패가 나오면 해당 태스크의 커밋에 `--fixup` 하지 말고 새 커밋으로 고친다(리뷰어가 무엇이 틀렸었는지 보게).

- [ ] **Step 1: 타입과 가드**

Run: `npx tsc --noEmit && npx tsc --noEmit -p tsconfig.app.json && npx vitest run test/noLocalProjectDb.test.ts test/detsukuruBrandStrings.test.ts test/persistence --reporter=dot`
Expected: 0 오류, 전부 PASS.

- [ ] **Step 2: 변경 영향 테스트 전체**

Run (백그라운드, 15분 상한):
```bash
npm run test:changed -- origin/main > /tmp/p1-test-changed.log 2>&1; echo "exit=$?" >> /tmp/p1-test-changed.log
```
끝나면 `grep -E "Test Files|Tests |exit=" /tmp/p1-test-changed.log` 와 실패 파일 목록 `grep -E "^ (FAIL|×)|FAIL " /tmp/p1-test-changed.log | sort -u`.

- [ ] **Step 3: 실패 파일 A/B 분류**

실패 파일마다:
1. 격리 재실행: `npx vitest run <file> --reporter=dot` — 통과하면 **부하 플레이크**.
2. 기준 트리에서 실행(처음 한 번만 만든다):
   ```bash
   rm -rf /tmp/p1-base && mkdir -p /tmp/p1-base && git archive origin/main | tar -x -C /tmp/p1-base && ln -s /home/main/z-project/rpg-zzu/node_modules /tmp/p1-base/node_modules
   (cd /tmp/p1-base && npx vitest run <file> --reporter=dot)
   ```
   기준에서도 실패하면 **기존 실패**. 기준에서 통과하고 격리에서도 실패하면 **회귀** — 원인을 고치고 새 커밋.
3. 표로 남긴다: `파일 | 분류 | 근거(명령·결과)`. PR 본문에 그대로 넣는다.

- [ ] **Step 4: 브라우저 스모크**

Run: `DEV_SERVER_PORT=9873 npx playwright test test/e2e/event-preview-state.spec.ts --reporter=line`
Expected: `1 passed`. (이 스펙은 `__OPRN_E2E_PROJECT__` 시드로 편집기를 부팅해 편집·미리보기를 돌린다 — store 부팅 경로가 포트를 지나는 것을 브라우저에서 확인한다. 포트가 점유돼 있으면 다른 번호를 쓴다.)

`.env.local` 이 있는 체크아웃이라면 한 번 더: `DEV_SERVER_PORT=9873 npx playwright test test/e2e/legacyDb-root-cache.spec.ts --reporter=line` — 실제 원격 행을 읽는 경로. 없으면 건너뛰고 PR 본문에 "검증 안 함" 으로 적는다.

- [ ] **Step 5: PR**

```bash
git push -u origin persistence/p1-port
gh pr create --base main --title "refactor(persistence): 저장소 포트 도입 — store 와 주변 모듈이 LegacyDb 를 직접 부르지 않는다" --body-file /tmp/p1-pr-body.md
```

`/tmp/p1-pr-body.md` 는 이 틀을 채운다:

```markdown
설계 `docs/superpowers/specs/2026-09-15-oprn-local-sqlite-store-design.md` 의 P1 입니다. 정본을 로컬 파일로 옮기기 전에, 렌더러가 저장 구현을 모르게 만드는 단계입니다. **동작은 바뀌지 않습니다** — 기본 어댑터가 기존 sync 모듈을 그대로 감싸므로 네트워크 요청·호출 인자가 같습니다.

**커밋 9개**
1. core: 정규 JSON·저장 와이어 + 경계 가드
2. core: 맵 병합·충돌
3. core: 로드 복구
4. core: 맵 패치 계획, sync 가 그것을 사용
5. 포트 인터페이스·대상 타입·선택기
6. 메모리 어댑터 + 계약 테스트
7. LegacyDb 어댑터 + 가짜 PostgREST
8. store → 포트
9. 커밋 로그·팀 패널·AI 기록·타일 메타 → 포트

**검증**
- `tsc --noEmit` 둘 다 0
- 계약 테스트 22건(메모리 11 + 가짜 전송 LegacyDb 11), core 단위 테스트, store 주입 테스트 3건
- `npm run test:changed -- origin/main`: N 파일 중 M 실패 → A/B 표 (아래)
- Playwright `event-preview-state.spec.ts` 통과
- (있으면) `legacyDb-root-cache.spec.ts` 통과 / 없으면 "검증 안 함"

| 실패 파일 | 분류 | 근거 |
|---|---|---|
| … | 기존 실패 / 부하 플레이크 / 회귀(수정 커밋 X) | … |

**남긴 것(다음 단계)**: 원격 설정 초안·URL 바·프로젝트 전환 트랜잭션·리소스 캐시(P4·P6), 패널 셋과 `list_project_commits` 동기 XHR(P4), 위키 두 페이지의 정책 기록(P2 에서 로컬 스토어와 함께).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

- [ ] **Step 6: 보고**

PR URL, 커밋 목록(`git log --oneline origin/main..HEAD`), A/B 표, 검증 안 한 것을 그대로 전달한다.
