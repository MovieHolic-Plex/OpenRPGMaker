import { beforeAll, describe, expect, it } from "vitest";
import { canMove } from "@/project/collision";
import { rectCells } from "@/project/footprint";
import { createMaouKonbiniFlagshipDemo } from "@/project/flagship/maouKonbini";
import { runtimeEventViewsForMap } from "@/project/runtimeEventState";
import { startSession } from "@/project/session";
import type { Project } from "@/project/types";

const STREET = "map_mk_street";
const ROOM = "map_mk_room";
const SHOP = "map_mk_konbini";
const steps = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
type Cell = { x: number; y: number };
const key = ({ x, y }: Cell) => `${x},${y}`;

describe("마왕 편의점 상점가 통행", () => {
  let project: Project;
  beforeAll(() => {
    ({ project } = createMaouKonbiniFlagshipDemo());
  });

  it.each([2, 4, 6])("진행 단계 %i에서 원룸과 가게 문 앞을 오갈 수 있다", (stage) => {
    const street = project.maps[STREET]!;
    const session = startSession(project);
    session.currentMapId = STREET;
    session.variables.var_mk_stage = stage;
    const views = runtimeEventViewsForMap(project, street, session, {});
    const blocked = new Set<string>();
    const exits = new Set<string>();
    for (const view of views) {
      if (view.priority === "same" && view.overlapForbidden) {
        for (const cell of rectCells(view.passRect)) blocked.add(key(cell));
      }
      if (view.trigger.kind === "playerTouch" && view.page?.commands.some((c) => c.kind === "transfer" && c.mapId !== STREET)) {
        exits.add(key(view));
      }
    }
    const roomLanding = project.maps[ROOM]!.events.flatMap((e) => e.pages?.flatMap((p) => p.commands) ?? [])
      .find((c) => c.kind === "transfer" && c.mapId === STREET);
    if (roomLanding?.kind !== "transfer") throw new Error("원룸에서 거리로 나가는 문이 없다");
    const approach = (id: string): Cell => {
      const door = street.events.find((e) => e.id === id);
      if (!door) throw new Error(`문 이벤트가 없다: ${id}`);
      return { x: door.x, y: door.y + 1 };
    };
    const roomDoor = approach("ev_jp_enter_map_mk_room");
    const shopDoor = approach("ev_jp_enter_map_mk_konbini");
    const cafeDoor = approach("ev_mk_st_cafe");

    const mayStep = (from: Cell, to: Cell): boolean =>
      !exits.has(key(from)) && !blocked.has(key(from)) && !blocked.has(key(to)) && canMove(project, street, from.x, from.y, to.x, to.y);
    const flood = (start: Cell, reverse = false): Set<string> => {
      expect(blocked.has(key(start)), key(start)).toBe(false);
      const seen = new Set([key(start)]);
      const queue = [start];
      for (const cell of queue) {
        for (const [dx, dy] of steps) {
          const next = { x: cell.x + dx, y: cell.y + dy };
          if (seen.has(key(next)) || !(reverse ? mayStep(next, cell) : mayStep(cell, next))) continue;
          seen.add(key(next));
          queue.push(next);
        }
      }
      return seen;
    };
    const fromLanding = flood(roomLanding);
    expect(fromLanding).toContain(key(roomDoor));
    for (const from of [fromLanding, flood(roomDoor)]) {
      for (const destination of [shopDoor, cafeDoor]) {
        expect(from, key(destination)).toContain(key(destination));
        const canReturn = flood(destination, true);
        expect([...from].filter((cell) => !exits.has(cell) && !canReturn.has(cell)), key(destination)).toEqual([]);
      }
    }
    // 서쪽 끝에서 보도 두 줄을 모두 쓸 수 있어야 한다. 한 줄이라도 막히면
    // 벤치와 강둑 사이에서 방향을 바꿔 한 칸짜리 목으로 되돌아가야 한다.
    for (const x of [0, 1, 2]) {
      const from = { x, y: 10 };
      const to = { x: x + 1, y: 10 };
      expect(mayStep(from, to), `${key(from)} → ${key(to)}`).toBe(true);
      expect(mayStep(to, from), `${key(to)} → ${key(from)}`).toBe(true);
    }
    expect(fromLanding).toContain("0,8");
    expect(fromLanding).toContain("0,9");
    expect(fromLanding).toContain("0,10");
    expect(mayStep({ x: 8, y: 10 }, { x: 9, y: 10 }), "화분 앞 보도").toBe(true);
  });
});
