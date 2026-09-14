// 변경 내역(긴 명세) — 큰 위임의 검토는 칩이 아니라 항목별 before → after 로 한다.
//
// 깨질 것(실측 2026-09-14, 감독 지시): "before/after 가 굉장히 긴 명세여야 하는 것 아닌가.
// 보통 맡기는 일이 매우 클텐데" — 지도 그림 두 장과 칩 한 줄로는 위임을 검토할 수 없다.
import { describe, expect, it } from "vitest";
import { buildChangeLedger, summarizeLedgerValue, type ChangeLedgerEntry } from "@/project/changeLedger";
import { createBlankProject } from "@/project/defaults";
import type { GameEvent, GameMap, Project } from "@/project/types";

function blank(): { project: Project; mapId: string } {
  const project = createBlankProject();
  return { project, mapId: Object.keys(project.maps)[0]! };
}

function clone(project: Project): Project {
  return structuredClone(project) as Project;
}

function mapOf(project: Project, mapId: string): GameMap {
  const map = project.maps[mapId];
  if (!map) throw new TypeError(`맵 없음: ${mapId}`);
  return map;
}

function event(id: string, name: string, x: number, y: number): GameEvent {
  return { id, name, x, y, trigger: "action", commands: [], pages: [] } as unknown as GameEvent;
}

function entryFor(entries: readonly ChangeLedgerEntry[], label: string): ChangeLedgerEntry {
  const entry = entries.find((candidate) => candidate.label === label);
  if (!entry) throw new Error(`항목 없음: ${label} — ${entries.map((candidate) => candidate.label).join(", ")}`);
  return entry;
}

function mapLabel(project: Project, mapId: string): string {
  return `${mapOf(project, mapId).name} (${mapId})`;
}

describe("buildChangeLedger — 항목별 before → after", () => {
  it("이벤트가 움직이면 영역·이름·좌표 변화가 나온다", () => {
    const { project: before, mapId } = blank();
    mapOf(before, mapId).events = [event("e1", "NPC_가드", 1, 1)];
    const after = clone(before);
    mapOf(after, mapId).events = [event("e1", "NPC_가드", 4, 7)];

    const { entries } = buildChangeLedger(before, after);
    const entry = entryFor(entries, "NPC_가드");

    expect(entry.area).toContain("이벤트 ·");
    expect(entry.change).toBe("changed");
    expect(entry.detail).toEqual(expect.arrayContaining(["X: 1 → 4", "Y: 1 → 7"]));
  });

  it("새 이벤트는 추가로, 지운 이벤트는 삭제로 남는다 — 어느 쪽도 조용히 사라지지 않는다", () => {
    const { project: before, mapId } = blank();
    mapOf(before, mapId).events = [event("e0", "사라진 경비", 2, 2)];
    const after = clone(before);
    mapOf(after, mapId).events = [event("e1", "새 상인", 5, 5)];

    const { entries } = buildChangeLedger(before, after);

    expect(entryFor(entries, "새 상인").change).toBe("added");
    expect(entryFor(entries, "새 상인").detail).toEqual(expect.arrayContaining(["X: 5", "Y: 5"]));
    expect(entryFor(entries, "사라진 경비").change).toBe("removed");
    expect(entryFor(entries, "사라진 경비").detail).toEqual(expect.arrayContaining(["X: 2"]));
  });

  it("퀘스트는 key 가 신원이고 title 이 이름이다", () => {
    const { project: before } = blank();
    const after = clone(before);
    after.quests = [{ key: "quest_bell", title: "종을 되찾아라", summary: "…", steps: [] } as never];

    const quest = entryFor(buildChangeLedger(before, after).entries, "종을 되찾아라");

    expect(quest.area).toBe("퀘스트");
    expect(quest.change).toBe("added");
    expect(quest.detail).toEqual(expect.arrayContaining(["제목: 종을 되찾아라"]));
  });

  it("데이터베이스 레코드의 필드 변화가 값과 함께 나온다", () => {
    const { project: before } = blank();
    before.database = { ...before.database, items: [{ id: "item_1", name: "포션", price: 50 } as never] };
    const after = clone(before);
    after.database = { ...after.database, items: [{ id: "item_1", name: "큰 포션", price: 120 } as never] };

    const item = entryFor(buildChangeLedger(before, after).entries, "큰 포션");

    expect(item.area).toBe("데이터베이스 · 아이템");
    expect(item.detail).toEqual(expect.arrayContaining(["이름: 포션 → 큰 포션", "가격: 50 → 120"]));
  });

  it("맵 타일은 칸 수로 요약한다 — 만 칸짜리 배열을 명세에 쏟지 않는다", () => {
    const { project: before, mapId } = blank();
    const after = clone(before);
    const map = mapOf(after, mapId);
    map.lowerTiles[0] = (map.lowerTiles[0] ?? 0) + 1;
    map.lowerTiles[1] = (map.lowerTiles[1] ?? 0) + 1;

    const detail = entryFor(buildChangeLedger(before, after).entries, mapLabel(after, mapId)).detail ?? [];

    expect(detail).toContain("아래층 타일: 2칸 바뀜");
    // 이벤트는 자기 항목이 맡는다 — 맵 항목이 이벤트 목록 전체를 요약하지 않는다.
    expect(detail.some((line) => line.startsWith("이벤트:"))).toBe(false);
  });

  it("맵 이름·인카운터 같은 속성 변화도 이름을 얻는다", () => {
    const { project: before, mapId } = blank();
    const after = clone(before);
    mapOf(after, mapId).name = "달빛 숲";
    mapOf(after, mapId).encounterRate = 12;

    const detail = entryFor(buildChangeLedger(before, after).entries, mapLabel(after, mapId)).detail ?? [];

    expect(detail).toEqual(expect.arrayContaining([`이름: ${summarizeLedgerValue(before.maps[mapId]!.name)} → 달빛 숲`]));
    expect(detail).toEqual(expect.arrayContaining(["인카운터율: 없음 → 12"]));
  });

  it("프로젝트 정보 같은 싱글톤도 필드별로 나온다", () => {
    const { project: before } = blank();
    const after = clone(before);
    after.meta = { ...after.meta, title: "새 게임", author: "나" };

    const meta = entryFor(buildChangeLedger(before, after).entries, "게임 정보");

    expect(meta.area).toBe("프로젝트 정보");
    expect(meta.detail).toEqual(expect.arrayContaining([`제목: ${summarizeLedgerValue(before.meta.title)} → 새 게임`]));
  });

  it("모르는 모양의 필드도 남는다 — 변경이 사라지지 않는다", () => {
    const { project: before } = blank();
    const after = clone(before);
    after.aiInstructions = "항상 한국어로";

    expect(entryFor(buildChangeLedger(before, after).entries, "AI 지시문").after).toBe("항상 한국어로");
  });

  it("아무것도 안 바뀌면 빈 명세", () => {
    const { project: before } = blank();
    const ledger = buildChangeLedger(before, clone(before));
    expect(ledger.entries).toEqual([]);
    expect(ledger.total).toBe(0);
  });

  it("상한을 넘으면 자르되 전체 수를 잃지 않는다", () => {
    const { project: before, mapId } = blank();
    const after = clone(before);
    mapOf(after, mapId).events = Array.from({ length: 12 }, (_, index) => event(`e${index}`, `NPC_${index}`, index, index));

    const ledger = buildChangeLedger(before, after, { maxEntries: 5 });

    expect(ledger.entries).toHaveLength(5);
    expect(ledger.total).toBeGreaterThan(5);
  });
});

describe("summarizeLedgerValue", () => {
  it("긴 본문은 잘라 한 줄로 만든다 — 명세가 카드를 삼키지 않게", () => {
    const summary = summarizeLedgerValue("가".repeat(400));
    expect(summary.length).toBeLessThanOrEqual(91);
    expect(summary.endsWith("…")).toBe(true);
  });

  it("빈 값·목록·불리언을 사람이 읽는 말로 바꾼다", () => {
    expect(summarizeLedgerValue(undefined)).toBe("없음");
    expect(summarizeLedgerValue("")).toBe("빈 값");
    expect(summarizeLedgerValue(["a", "b"])).toBe("a, b (2개)");
    expect(summarizeLedgerValue([{ a: 1 }, { b: 2 }])).toBe("2개 항목");
    expect(summarizeLedgerValue(true)).toBe("true");
  });

  it("중첩 개체는 JSON 대신 키 이름으로 — 명세에 소음을 쏟지 않는다", () => {
    expect(summarizeLedgerValue({ hp: "HP", mp: "MP" })).toBe("hp HP, mp MP (2개)");
    expect(summarizeLedgerValue({ pages: [{}, {}], commands: [] })).toBe("pages, commands … (2개 항목)");
    expect(summarizeLedgerValue({})).toBe("빈 값");
  });
});
