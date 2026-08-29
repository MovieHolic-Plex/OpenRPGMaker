// 편집 행위 기록 회귀 테스트.
//
// 2026-08-29 관측성 감사에서 라이브 프로브로 재현한 증상을 정식화한다. 당시 결과:
//   1. NPC 생성 → 기록 0건   2. 이름 변경 → 0건   3. 커맨드 추가 → 0건
//   4. 조건 변경 → 0건       5. 적용 → 1건, 라벨 "이벤트 편집", 어떤 NPC 인지 없음
// 이 테스트는 각 단계가 기록되고, 적용 기록이 **어떤 NPC의 어떤 필드**인지 담는 것을 고정한다.

import { beforeEach, describe, expect, it } from "vitest";
import {
  _resetEditActivityForTest,
  editActivityEntryCount,
  getEditActivityEntries,
  recordEditActivity,
  unlabeledEditActivityCount,
} from "@/editor/editActivityLog";
import { describeEventDiff, shortEventPath } from "@/editor/eventDiffLabel";
import { editorState } from "@/editor/editorState";
import { beginExistingEventDraft, createEventDraft, discardEventDraft, saveEventDraft } from "@/editor/eventDraftActions";
import { setEventPageTextCommand, updateEventPage } from "@/editor/eventPages";
import { createBlankProject } from "@/project/defaults";
import { _resetEventDraftVaultForTest } from "@/project/eventDraftVault";
import { store } from "@/project/store";

beforeEach(() => {
  _resetEventDraftVaultForTest();
  store.replaceProject(createBlankProject());
  editorState.set({ selectedEventId: null, selectedEventPageId: null });
  _resetEditActivityForTest();
});

function labels(): readonly string[] {
  return getEditActivityEntries().map((entry) => entry.label ?? "(라벨 없음)");
}

describe("store mutation 초크포인트", () => {
  it("모든 mutation 메서드가 행위를 기록한다", () => {
    const mapId = store.getCurrent().startMapId;

    store.update((project) => {
      project.meta.title = "제목 변경";
    }, { scope: "project", label: "제목 변경" });
    store.updateMap(mapId, (map) => {
      map.lowerTiles[0] = 5;
    }, { label: "타일 편집", cells: [{ x: 0, y: 0, layer: "lower" }] });

    const entries = getEditActivityEntries();
    expect(entries.map((entry) => entry.label)).toEqual(["타일 편집", "제목 변경"]);
    // updateMap 은 맵 스코프 + 셀 수를 남긴다 — 어느 맵의 몇 칸인지 알 수 있어야 한다.
    const tileEntry = entries[0]!;
    expect(tileEntry.scope).toBe("map");
    expect(tileEntry.mapId).toBe(mapId);
    expect(tileEntry.cellCount).toBe(1);
  });

  it("라벨 없는 mutation 을 별도로 집계한다", () => {
    store.update((project) => {
      project.meta.title = "라벨 없음";
    });
    expect(unlabeledEditActivityCount()).toBe(1);
    expect(getEditActivityEntries()[0]?.label).toBeNull();
  });

  it("database 스코프는 컬렉션 이름을 남긴다", () => {
    store.update((project) => {
      project.database.items = [];
    }, { scope: "database", collection: "items", label: "아이템 초기화" });
    const entry = getEditActivityEntries()[0]!;
    expect(entry.scope).toBe("database");
    expect(entry.collection).toBe("items");
  });
});

describe("NPC 편집 세션 (원래 증상 재현 시나리오)", () => {
  it("생성·이름변경·커맨드추가·적용이 각각 기록되고 적용 기록이 필드 경로를 담는다", () => {
    const mapId = store.getCurrent().startMapId;

    // 1. NPC 생성
    const eventId = createEventDraft(mapId, 4, 5);
    expect(eventId).not.toBe("");
    expect(editActivityEntryCount()).toBeGreaterThan(0);
    expect(labels()[0]).toContain("이벤트 생성");

    // 드래프트를 적용해 기존 이벤트로 만든다(이후 단계가 "수정" 이 되게).
    saveEventDraft(mapId, eventId);
    _resetEditActivityForTest();

    // 2. 편집 시작 → 3. 이름 변경 → 4. 커맨드 추가
    expect(beginExistingEventDraft(mapId, eventId)).toBe(true);
    const pageId = store.getCurrent().maps[mapId]!.events.find((e) => e.id === eventId)!.pages![0]!.id;
    updateEventPage(mapId, eventId, pageId, { name: "촌장" });
    setEventPageTextCommand(mapId, eventId, pageId, undefined, "안녕하세요");

    // 편집 중 단계들도 기록에 남아야 한다 — 예전에는 여기까지 0건이었다.
    const midSession = editActivityEntryCount();
    expect(midSession).toBeGreaterThan(1);

    // 5. 적용
    const diff = saveEventDraft(mapId, eventId);
    expect(diff).not.toBeNull();

    const applied = getEditActivityEntries().find((entry) => entry.label?.startsWith("이벤트 편집:"));
    expect(applied, "적용 기록이 있어야 한다").toBeDefined();
    // 핵심: 어떤 NPC 인지 라벨에 있어야 한다.
    expect(applied!.label).toContain("촌장");
    expect(applied!.eventId).toBe(eventId);
    // 핵심: 어느 필드가 바뀌었는지 경로가 남아야 한다.
    const paths = (applied!.fields ?? []).map((field) => field.path);
    expect(paths.some((path) => path.includes("name"))).toBe(true);
    expect(paths.some((path) => path.includes("commands"))).toBe(true);
  });

  it("편집 취소도 기록에 남는다", () => {
    const mapId = store.getCurrent().startMapId;
    const eventId = createEventDraft(mapId, 6, 6);
    saveEventDraft(mapId, eventId);
    beginExistingEventDraft(mapId, eventId);
    _resetEditActivityForTest();

    discardEventDraft(mapId, eventId);
    expect(labels().some((label) => label.includes("이벤트 편집 취소"))).toBe(true);
  });
});

describe("연속 편집 병합", () => {
  it("같은 라벨의 연속 맵 편집을 한 엔트리로 합치고 셀 수를 누적한다", () => {
    const mapId = store.getCurrent().startMapId;
    for (let x = 0; x < 12; x += 1) {
      store.updateMap(mapId, (map) => {
        map.lowerTiles[x] = 7;
      }, { label: "타일 편집", cells: [{ x, y: 0, layer: "lower" }] });
    }
    const entries = getEditActivityEntries({ scope: "map" });
    // 드래그 12칸이 12줄이 되면 로그가 스트로크 노이즈로 덮인다.
    expect(entries).toHaveLength(1);
    expect(entries[0]!.cellCount).toBe(12);
    expect(entries[0]!.mergedCount).toBe(12);
  });

  it("필드 상세가 붙은 엔트리는 병합하지 않는다", () => {
    recordEditActivity({ scope: "map", mapId: "m", label: "이벤트 편집", generation: 1, fields: [{ path: "a" }] });
    recordEditActivity({ scope: "map", mapId: "m", label: "이벤트 편집", generation: 2, fields: [{ path: "b" }] });
    expect(getEditActivityEntries()).toHaveLength(2);
  });
});

describe("EventDiff 라벨", () => {
  it("경로를 커맨드/페이지 단위까지 줄인다", () => {
    expect(shortEventPath("event.pages[0].commands[2].body.text")).toBe("pages[0].commands[2]");
    expect(shortEventPath("event.pages[0].name")).toBe("pages[0].name");
    expect(shortEventPath("event")).toBe("전체");
  });

  it("생성/수정을 구분하고 이름을 담는다", () => {
    expect(describeEventDiff({ mapId: "m", eventId: "e", kind: "created", changes: [] }, "촌장")).toBe("이벤트 생성: 촌장");
    const updated = describeEventDiff(
      {
        mapId: "m",
        eventId: "e",
        kind: "updated",
        changes: [
          { path: "event.pages[0].name", before: "페이지 1", after: "촌장" },
          { path: "event.pages[0].commands[0]", before: undefined, after: {} },
        ],
      },
      "촌장",
    );
    expect(updated).toContain("촌장");
    expect(updated).toContain("pages[0].name");
  });

  it("diff 가 없으면 일반 라벨로 떨어진다", () => {
    expect(describeEventDiff(null)).toBe("이벤트 편집");
  });
});
