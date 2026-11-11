// 목표 꼬리의 출구 자리 말: 어느 맵의 자리인지(「이 맵 …」)와, 가장자리가 아닌 문은 들어서는 쪽을 적는다.
// 2026-11-11 fun-x1 눈가림 플레이: 「초승달 궁전 입구: 동쪽 끝 가운데」 가 «궁전의 동쪽 끝»으로, 맵 북쪽 피라미드의 남쪽 문이 「북쪽」 으로 읽혔다.
import { describe, expect, it } from "vitest";
import { whereHint } from "@/ai/v2/judge/objectiveWhere";
import type { Project } from "@/project/types";

const gate = (id: string, x: number, y: number, to: string, tx: number, ty: number) => ({ id, x, y, pages: [{ commands: [{ kind: "transfer", mapId: to, x: tx, y: ty }] }] });
const project = { maps: {
  town: { id: "town", name: "마을", width: 40, height: 30, events: [gate("g1", 39, 15, "field", 0, 15), gate("g2", 20, 8, "tomb", 6, 14)] },
  field: { id: "field", name: "들판", width: 40, height: 30, events: [gate("g3", 0, 15, "town", 38, 15), { id: "e", name: "석상", x: 30, y: 5, pages: [{ commands: [] }] }] },
  tomb: { id: "tomb", name: "무덤", width: 13, height: 16, events: [gate("g4", 6, 15, "town", 20, 9)] },
} } as unknown as Project;

describe("objective exit words", () => {
  it("names the map whose edge the exit is on", () => {
    expect(whereHint(project, "town", { mapId: "field", x: 30, y: 5, label: "석상" }, { x: 5, y: 5 })).toBe("들판 입구: 이 맵 동쪽 끝 가운데 → 석상");
  });

  it("says which side a door away from the edge is entered from (the cell the way back lands on)", () => {
    expect(whereHint(project, "town", { mapId: "tomb" }, { x: 5, y: 5 })).toBe("무덤 입구: 이 맵 북쪽 · 남쪽에서 들어간다");
  });

  it("keeps 「바로 옆」 for an exit two cells away and frames only the first leg of a pass-through route", () => {
    expect(whereHint(project, "town", { mapId: "field" }, { x: 38, y: 14 })).toBe("들판 입구: 바로 옆");
    expect(whereHint(project, "tomb", { mapId: "field", x: 30, y: 5, label: "석상" }, { x: 6, y: 3 })).toBe("마을 입구: 이 맵 남쪽 끝 가운데 → 마을에서 동쪽 끝 가운데 → 들판 · 석상");
  });
});
