// NPC 커맨드/페이지 편집의 감사 라벨 회귀 테스트.
//
// 2026-08-29 관측성 감사 실측: `eventPages.ts` 의 `store.update` 17곳과 `eventActions.ts` 의
// 이벤트 CRUD 가 라벨 없이(또는 `{scope,mapId}` 만) 호출돼, 커맨드 추가·삭제·이동과
// 페이지 추가·삭제·복사가 감사 로그에서 서로 구분되지 않았다. 이 테스트는 각 행위가
// **사람이 읽는 이름 + 어느 맵/이벤트인지** 를 남기는 것을 고정한다.
//
// 완료 조건은 `unlabeledEditActivityCount() === 0` 이다 — 라벨 하나만 빠져도 로그에서
// 그 행위는 다시 `(라벨 없음)` 으로 사라진다.

import { beforeEach, describe, expect, it } from "vitest";
import {
  _resetEditActivityForTest,
  getEditActivityEntries,
  unlabeledEditActivityCount,
  type EditActivityEntry,
} from "@/editor/editActivityLog";
import { editorState } from "@/editor/editorState";
import { addCommand, addEvent, deleteCommand, deleteEvent, moveEvent, replaceCommand, updateEvent } from "@/editor/eventActions";
import {
  addEventPage,
  addEventPageCommand,
  addEventPageCommandAt,
  copyEventPage,
  copyEventPageToClipboard,
  deleteEventPage,
  deleteEventPageCommandAt,
  ensureEventPages,
  insertEventPageCommandAt,
  moveEventPage,
  moveEventPageCommandAcross,
  moveEventPageCommandAt,
  moveEventPageCommandToIndex,
  pasteEventPage,
  replaceEventPageCommandAt,
  replaceEventPageCommands,
  setEventPageTextCommand,
  updateEventPage,
} from "@/editor/eventPages";
import { FORK_THEN_BRANCH_INDEX } from "@/editor/eventCommandPaths";
import { createBlankProject } from "@/project/defaults";
import { _resetEventDraftVaultForTest } from "@/project/eventDraftVault";
import { store } from "@/project/store";
import type { Command, EventPage } from "@/project/types";

let mapId = "";
let eventId = "";
let pageId = "";

beforeEach(() => {
  _resetEventDraftVaultForTest();
  store.replaceProject(createBlankProject());
  editorState.set({ selectedEventId: null, selectedEventPageId: null });
  mapId = store.getCurrent().startMapId;
  eventId = addEvent(mapId, 3, 4);
  pageId = pages()[0]!.id;
  // 준비 과정(프로젝트 교체·이벤트 추가)의 기록은 각 테스트의 관심사가 아니다.
  _resetEditActivityForTest();
});

function pages(): readonly EventPage[] {
  return store.getCurrent().maps[mapId]?.events.find((event) => event.id === eventId)?.pages ?? [];
}

/** 최신순으로 오므로 읽기 편하게 시간순으로 뒤집는다. */
function entries(): readonly EditActivityEntry[] {
  return [...getEditActivityEntries()].reverse();
}

function labels(): readonly string[] {
  return entries().map((entry) => entry.label ?? "(라벨 없음)");
}

function text(body: string): Command {
  return { kind: "text", body };
}

describe("페이지 편집 라벨", () => {
  it("추가·순서 이동·복사·삭제를 행위 이름과 페이지 이름으로 남긴다", () => {
    const addedId = addEventPage(mapId, eventId);
    moveEventPage(mapId, eventId, addedId, -1);
    const copiedId = copyEventPage(mapId, eventId, pageId);
    deleteEventPage(mapId, eventId, copiedId);

    expect(labels()).toEqual([
      "페이지 추가 (2번째)",
      "페이지 순서 이동: 페이지 2 (앞으로)",
      "페이지 복제: 페이지 1",
      "페이지 삭제: 페이지 1 복사본",
    ]);
  });

  it("모든 엔트리가 맵·이벤트 스코프를 담는다", () => {
    addEventPage(mapId, eventId);
    setEventPageTextCommand(mapId, eventId, pageId, "촌장", "안녕하세요");

    for (const entry of entries()) {
      expect(entry.scope).toBe("map");
      expect(entry.mapId).toBe(mapId);
      expect(entry.eventId).toBe(eventId);
      expect(entry.origin).toBe("human");
    }
  });

  it("클립보드 복사는 프로젝트를 바꾸지 않으므로 붙여넣기만 기록된다", () => {
    expect(copyEventPageToClipboard(mapId, eventId, pageId)).toBe(true);
    expect(labels()).toEqual([]);

    pasteEventPage(mapId, eventId);
    expect(labels()).toEqual(["페이지 붙여넣기: 페이지 1"]);
  });

  it("페이지 기본값 생성은 사람 행위가 아니라 system origin 으로 갈라진다", () => {
    ensureEventPages(mapId, eventId);
    const entry = entries()[0]!;
    expect(entry.label).toBe("페이지 기본값 생성");
    expect(entry.origin).toBe("system");
  });
});

describe("페이지 속성 라벨", () => {
  it("라벨을 생략하면 patch 키를 한국어 필드 이름으로 적는다", () => {
    updateEventPage(mapId, eventId, pageId, { name: "촌장", graphic: {} });
    expect(labels()).toEqual(["페이지 속성 변경: 페이지 1 — 이름, 그림"]);
  });

  it("키가 많으면 3개까지만 적고 나머지를 개수로 접는다", () => {
    updateEventPage(mapId, eventId, pageId, {
      name: "촌장",
      graphic: {},
      conditions: [],
      priority: "above",
      overlapForbidden: true,
    });
    expect(labels()).toEqual(["페이지 속성 변경: 페이지 1 — 이름, 그림, 출현 조건 외 2개"]);
  });

  it("호출자가 넘긴 라벨이 기본 라벨을 대신한다", () => {
    updateEventPage(mapId, eventId, pageId, { movement: { type: "living", speed: 3, frequency: 3 } }, "NPC 생활 동선 변경: 마을 (7,8)");
    expect(labels()).toEqual(["NPC 생활 동선 변경: 마을 (7,8)"]);
  });

  it("대사 설정은 화자를 남긴다", () => {
    setEventPageTextCommand(mapId, eventId, pageId, "촌장", "안녕하세요");
    setEventPageTextCommand(mapId, eventId, pageId, undefined, "안녕하세요");
    expect(labels()).toEqual(["대사 설정: 촌장", "대사 설정"]);
  });
});

describe("커맨드 편집 라벨", () => {
  it("추가·삽입·교체·이동·삭제가 커맨드 종류와 자리를 남긴다", () => {
    addEventPageCommand(mapId, eventId, pageId, text("첫 줄"));
    addEventPageCommand(mapId, eventId, pageId, text("둘째 줄"));
    insertEventPageCommandAt(mapId, eventId, pageId, [0], { kind: "wait", ms: 100 });
    replaceEventPageCommandAt(mapId, eventId, pageId, [0], { kind: "label", name: "시작" });
    moveEventPageCommandAt(mapId, eventId, pageId, [0], 1);
    moveEventPageCommandToIndex(mapId, eventId, pageId, [1], 2);
    deleteEventPageCommandAt(mapId, eventId, pageId, [2]);

    expect(labels()).toEqual([
      "커맨드 추가: 문장 표시 (#0)",
      "커맨드 추가: 문장 표시 (#1)",
      "커맨드 삽입: 대기 (#0)",
      "커맨드 교체: 대기 → 라벨 (#0)",
      "커맨드 순서 이동: 라벨 (#0 → #1)",
      "커맨드 순서 이동: 라벨 (#1 → #2)",
      "커맨드 삭제: 라벨 (#2)",
    ]);
  });

  it("경계에서 막힌 이동은 없는 자리로 갔다고 적지 않는다", () => {
    addEventPageCommand(mapId, eventId, pageId, text("첫 줄"));
    addEventPageCommand(mapId, eventId, pageId, text("둘째 줄"));
    _resetEditActivityForTest();

    // 맨 위에서 "위로", 맨 아래에서 "아래로" — 둘 다 mutator 가 거절한다.
    moveEventPageCommandAt(mapId, eventId, pageId, [0], -1);
    moveEventPageCommandToIndex(mapId, eventId, pageId, [1], 9);

    expect(labels()).toEqual([
      "커맨드 순서 이동: 문장 표시 (#0, 이동 없음)",
      "커맨드 순서 이동: 문장 표시 (#1, 이동 없음)",
    ]);
  });

  it("커맨드 목록 교체는 규모를 개수로 남긴다", () => {
    replaceEventPageCommands(mapId, eventId, pageId, [text("가"), text("나"), text("다")]);
    expect(labels()).toEqual(["커맨드 목록 교체: 3개"]);
  });

  it("분기 안쪽 편집은 경로를 그대로 적어 어느 분기인지 남긴다", () => {
    addEventPageCommand(mapId, eventId, pageId, {
      kind: "fork",
      condition: { kind: "switch", switchId: "sw1", value: true },
      then: [],
    });
    const thenBranch = [0, FORK_THEN_BRANCH_INDEX];
    addEventPageCommandAt(mapId, eventId, pageId, thenBranch, text("분기 안"));
    addEventPageCommand(mapId, eventId, pageId, text("루트 끝"));
    moveEventPageCommandAcross(mapId, eventId, pageId, [1], thenBranch, 0);

    expect(labels()).toEqual([
      "커맨드 추가: 조건 분기 (#0)",
      "커맨드 추가: 문장 표시 (#0/-2 안)",
      "커맨드 추가: 문장 표시 (#1)",
      "커맨드 분기 이동: 문장 표시 (#1 → #0/-2 안 #0)",
    ]);
    // 라벨만이 아니라 실제 이동도 그대로여야 한다(관측을 붙이며 동작을 바꾸지 않았다).
    const fork = pages()[0]!.commands[0]!;
    expect(fork.kind === "fork" && fork.then).toHaveLength(2);
  });
});

describe("이벤트 CRUD 라벨", () => {
  it("추가·이동·속성 변경·삭제가 이벤트 이름과 좌표를 남긴다", () => {
    updateEventPage(mapId, eventId, pageId, { name: "촌장" }, "이름 지정");
    _resetEditActivityForTest();

    moveEvent(mapId, eventId, 9, 10);
    updateEvent(mapId, eventId, { sprite: undefined, schedule: undefined });
    deleteEvent(mapId, eventId);
    const addedId = addEvent(mapId, 2, 2);

    expect(labels()).toEqual([
      "이벤트 위치 이동: 촌장 → (9,10)",
      "이벤트 속성 변경: 촌장 — 그림, 생활 일정",
      "이벤트 삭제: 촌장",
      "이벤트 추가 (2,2)",
    ]);
    // 추가 기록은 방금 생긴 이벤트를 가리켜야 한다 — 이후 편집 기록과 묶는 축이다.
    expect(entries()[3]!.eventId).toBe(addedId);
  });

  it("레거시 루트 커맨드 편집은 접두로 페이지 커맨드와 갈라진다", () => {
    addCommand(mapId, eventId, [], text("루트 줄"));
    replaceCommand(mapId, eventId, [0], { kind: "wait", ms: 50 });
    deleteCommand(mapId, eventId, [0]);

    expect(labels()).toEqual([
      "이벤트 커맨드 추가: 문장 표시 (루트)",
      "이벤트 커맨드 교체: 문장 표시 → 대기 (#0)",
      "이벤트 커맨드 삭제: 대기 (#0)",
    ]);
  });
});

describe("완료 조건", () => {
  it("이 파일들의 편집 경로를 전부 돌려도 라벨 없는 mutation 이 0 이다", () => {
    ensureEventPages(mapId, eventId);
    const addedId = addEventPage(mapId, eventId);
    moveEventPage(mapId, eventId, addedId, -1);
    const copiedId = copyEventPage(mapId, eventId, pageId);
    copyEventPageToClipboard(mapId, eventId, pageId);
    pasteEventPage(mapId, eventId);
    deleteEventPage(mapId, eventId, copiedId);
    updateEventPage(mapId, eventId, pageId, { name: "촌장" });
    setEventPageTextCommand(mapId, eventId, pageId, "촌장", "안녕하세요");
    addEventPageCommand(mapId, eventId, pageId, text("첫 줄"));
    addEventPageCommandAt(mapId, eventId, pageId, [], text("둘째 줄"));
    insertEventPageCommandAt(mapId, eventId, pageId, [0], { kind: "wait", ms: 10 });
    replaceEventPageCommandAt(mapId, eventId, pageId, [0], { kind: "label", name: "시작" });
    moveEventPageCommandAt(mapId, eventId, pageId, [0], 1);
    moveEventPageCommandToIndex(mapId, eventId, pageId, [1], 0);
    deleteEventPageCommandAt(mapId, eventId, pageId, [0]);
    replaceEventPageCommands(mapId, eventId, pageId, [text("가")]);
    addCommand(mapId, eventId, [], text("루트"));
    replaceCommand(mapId, eventId, [0], { kind: "wait", ms: 20 });
    deleteCommand(mapId, eventId, [0]);
    moveEvent(mapId, eventId, 5, 6);
    updateEvent(mapId, eventId, { schedule: undefined });
    deleteEvent(mapId, eventId);

    expect(unlabeledEditActivityCount()).toBe(0);
    expect(labels().every((label) => label !== "(라벨 없음)")).toBe(true);
  });
});
