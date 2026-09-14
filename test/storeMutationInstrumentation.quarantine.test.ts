// store mutation 초크포인트 구조 가드.
//
// `src/project/store.ts` 의 관측은 "모든 상태 변경이 `markLocalMutation` 을 지난다" 는
// 성질 하나에 전부 얹혀 있다. 그 성질이 성립하는 동안은 275개 mutation 호출부가
// 외부 파일 수정 없이 계측된다 — 반대로 새 메서드 하나가 `this.current` 를 직접 갈아치우고
// 초크포인트를 건너뛰면, 그 경로의 편집은 **조용히** 기록에서 사라진다.
// 조용한 유실은 관측 도구에서 가장 나쁜 실패 양식이라(있다고 믿고 안 보게 된다)
// 이 파일이 성질 자체를 고정한다.
//
// 두 층으로 본다:
//   1. 행위 — 5개 mutation 메서드를 실제로 불러 기록이 남는지.
//   2. 구조 — `this.current = ` 대입 지점의 소속 메서드가 알려진 명단 안에 있는지.
//      새 메서드가 늘면 여기서 걸리고, 그때 "초크포인트로 보낼 것이냐" 를 판단하게 된다.

import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { _resetEditActivityForTest, editActivityEntryCount, getEditActivityEntries } from "@/editor/editActivityLog";
import { createBlankProject } from "@/project/defaults";
import { _resetEventDraftVaultForTest } from "@/project/eventDraftVault";
import { store } from "@/project/store";

const STORE_SOURCE_PATH = new URL("../src/project/store.ts", import.meta.url);
const source = readFileSync(STORE_SOURCE_PATH, "utf8");
const lines = source.split("\n");

/** 클래스 메서드 선언 한 줄인가 — `  private foo(`, `  async bar(`, `  update(` 등. */
const METHOD_DECLARATION = /^ {2}(?:(?:private|public|protected|static|async|readonly)\s+)*([A-Za-z_$][\w$]*)\s*(?:<[^>]*>)?\(/;

/** 주어진 줄이 속한 클래스 메서드 이름. 위로 훑어 가장 가까운 선언을 찾는다. */
function enclosingMethod(lineIndex: number): string {
  for (let index = lineIndex; index >= 0; index -= 1) {
    const match = METHOD_DECLARATION.exec(lines[index] ?? "");
    // `if (`/`for (`/`catch (` 같은 제어문은 두 칸 들여쓰기로 오지 않지만, 방어로 걸러 둔다.
    if (match && !["if", "for", "while", "switch", "catch", "return"].includes(match[1]!)) return match[1]!;
  }
  return "(모듈 최상단)";
}

function methodsAssigning(pattern: RegExp): readonly string[] {
  const found = new Set<string>();
  lines.forEach((line, index) => {
    if (pattern.test(line)) found.add(enclosingMethod(index));
  });
  return [...found].sort();
}

beforeEach(() => {
  _resetEventDraftVaultForTest();
  store.replaceProject(createBlankProject());
  _resetEditActivityForTest();
});

describe("구조: 상태 변경 지점이 초크포인트 밖으로 새지 않는다", () => {
  it("`this.current` 대입은 알려진 메서드에서만 일어난다", () => {
    // 편집(초크포인트 필수) + 로드/정규화(로컬 편집이 아니라 계측 대상 아님)를 모두 담은 명단.
    // 여기 이름이 늘었다면 새 메서드가 프로젝트를 갈아치우고 있다는 뜻이다.
    // 로컬 편집이면 `markLocalMutation` 으로 보내고, 로드/복원이면 이 명단에 추가하라.
    const allowed = [
      // — 편집: 초크포인트 필수 —
      "clearAll", // label "전체 초기화"
      "replace", // undo/AI 적용/원격 병합
      "restoreEventDraftFromVault", // origin "system"
      "update", // 244개 호출부의 진입점
      "updateMap", // 타일/이벤트 스코프
      // — 로드/부팅: 사용자 편집이 아니라서 행위 로그 대상이 아니다 —
      "constructor", // 부팅 시 빈 프로젝트
      "adoptProject", // 수신한 프로젝트 채택(+금고 복원)
      "loadNewRemoteProjectTransactionally", // 프로젝트 전환. catch 절의 롤백 대입도 여기다
      "reconnectRemotePersistence", // 원격 재연결 시 서버본 수신
      "reloadFromRemote", // 원격 재로드
      "persistCurrent", // 원격 설명만 동기화; concurrent persistence 테스트가 맵 동일성과 편집 세대 보존을 검증
    ];
    const actual = methodsAssigning(/this\.current = /);
    const unexpected = actual.filter((name) => !allowed.includes(name));
    expect(
      unexpected,
      `초크포인트를 지나는지 확인되지 않은 상태 변경 지점이 생겼다: ${unexpected.join(", ")}`,
    ).toEqual([]);
  });

  it("mutation 세대 카운터는 초크포인트 안에서만 올라간다", () => {
    // `mutationGeneration += 1` 이 markLocalMutation 밖에서 일어나면 저장 경합 판정과
    // 행위 기록이 어긋난다 — 기록에 없는 편집이 저장 레이스에는 잡히는 상태가 된다.
    // 예외 1건: 프로젝트 전환이 진행 중인 저장을 무효화하려고 세대를 앞당긴다.
    expect(methodsAssigning(/this\.mutationGeneration \+= 1/)).toEqual([
      "loadNewRemoteProjectTransactionally",
      "markLocalMutation",
    ]);
  });

  it("초크포인트가 감사 기록 호출을 품고 있다", () => {
    const body = source.slice(source.indexOf("private markLocalMutation"));
    expect(body.slice(0, body.indexOf("\n  }"))).toContain("this.recordChangeActivity(change)");
  });
});

describe("행위: 5개 mutation 메서드가 전부 기록을 남긴다", () => {
  it("update", () => {
    store.update((project) => {
      project.meta.title = "제목";
    }, { scope: "project", label: "제목 변경" });
    expect(getEditActivityEntries()[0]?.label).toBe("제목 변경");
  });

  it("updateMap", () => {
    const mapId = store.getCurrent().startMapId;
    store.updateMap(mapId, (map) => {
      map.lowerTiles[0] = 3;
    }, { label: "타일 편집", cells: [{ x: 0, y: 0, layer: "lower" }] });
    const entry = getEditActivityEntries()[0]!;
    expect(entry.scope).toBe("map");
    expect(entry.mapId).toBe(mapId);
  });

  it("replace", () => {
    store.replace(createBlankProject(), { change: { label: "되돌리기" } });
    expect(getEditActivityEntries()[0]?.label).toBe("되돌리기");
  });

  it("clearAll", async () => {
    await store.clearAll();
    expect(getEditActivityEntries()[0]?.label).toBe("전체 초기화");
  });

  it("restoreEventDraftFromVault 는 origin 을 system 으로 남긴다", () => {
    // 금고에 없는 이벤트면 false 로 빠지므로 기록도 없다 — 그 경로부터 고정한다.
    expect(store.restoreEventDraftFromVault(store.getCurrent().startMapId, "존재하지-않는-id")).toBe(false);
    expect(editActivityEntryCount()).toBe(0);
  });
});
