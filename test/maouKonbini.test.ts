import { beforeAll, describe, expect, it } from "vitest";
import { canMove } from "@/project/collision";
import { rectCells } from "@/project/footprint";
import { createMaouKonbiniFlagshipDemo } from "@/project/flagship/maouKonbini";
import { runtimeEventViewsForMap } from "@/project/runtimeEventState";
import { startSession, setSwitch } from "@/project/session";
import type { Project } from "@/project/types";
import { CAST, say } from "@/project/flagship/maouKonbiniKit";
import { createBlankProject } from "@/project/defaults/blankProject";
import { FLAGSHIP_BEAT_MANIFESTS, FLAGSHIP_DEMO_IDS, validateFlagshipStyleLock } from "@/project/flagship";
import { createInterpreter } from "@/player/interpreter";
import { isolateTimers } from "./mergedTeardown";

describe("maouKonbiniStreetReachability", () => {
  isolateTimers();
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
});

describe("maouKonbiniStyleLock", () => {
  isolateTimers();
  it("마왕 편의점만 오프닝 네 컷을 허용한다", () => {
    const project = createBlankProject();
    const scenes = Array.from({ length: 4 }, (_, i) => ({
      id: String(i), kind: "text" as const, narration: "", durationMs: 1000,
    }));
    project.system.opening = { enabled: true, skippable: false, scenes };

    for (const id of FLAGSHIP_DEMO_IDS) {
      const { violations } = validateFlagshipStyleLock(id, project);
      expect(violations.includes("오프닝 샷 수 부족: 4 < 5")).toBe(id !== "maou-konbini");
    }
    expect(FLAGSHIP_BEAT_MANIFESTS["maou-konbini"].beats[0].playerFeel).toContain("네 컷");
    scenes.pop();
    expect(validateFlagshipStyleLock("maou-konbini", project).violations).toContain("오프닝 샷 수 부족: 3 < 4");
  });
  it("면접의 히나와 채용 전후 주인공이 지정된 기존 에셋을 쓴다", () => {
    const manifest = FLAGSHIP_BEAT_MANIFESTS["maou-konbini"];
    const hinaPortrait = "shared-modern-casual-girl-pink-expressions-bust-base";

    expect(CAST.hina).toMatchObject({ resource: "oprn-charset-modern2", index: 5 });
    expect(say("hina", "base", "안녕.")[0]).toMatchObject({ resourceId: hinaPortrait, presentation: "bust" });
    expect(manifest.cast.find((member) => member.id === "npc_mk_hina")?.assetId).toBe(hinaPortrait);
    expect(CAST.zervas).toMatchObject({ resource: "oprn-charset-modern2", index: 3, stem: "casual-boy-olive" });
    expect(CAST.maou).toMatchObject({ resource: "oprn-charset-scarloxy-people5", index: 0 });
    expect(manifest.styleLock.allowedCharsetPrefixes).toContain(CAST.maou.resource);
  });
});

describe("maouKonbiniTaskHints", () => {
  isolateTimers();
  const shifts = [
    [3, "sw_mk_t_box1", "sw_mk_t_trash1", "왼쪽 진열대 사이", "입구 왼쪽"],
    [5, "sw_mk_t_snack2", "sw_mk_t_order2", "진열대 끝", "옆 책상"],
    [7, "sw_mk_t_box3", "sw_mk_t_waste3", "왼쪽 진열대 사이", "백룸 선반"],
  ] as const;
  describe("마왕 편의점 미완료 업무 위치 안내", () => {
    let project: Project;
    beforeAll(() => {
      ({ project } = createMaouKonbiniFlagshipDemo());
    });

    it.each(shifts)("진행 단계 %i에서 점장과 히나가 남은 업무 위치만 알려 준다", (stage, first, second, firstPlace, secondPlace) => {
      const map = project.maps.map_mk_konbini!;
      for (const eventId of ["ev_mk_mgr_back", "ev_mk_hina"]) {
        const page = map.events.find((event) => event.id === eventId)?.pages?.find((entry) => entry.id === `${eventId}_p${stage}`);
        expect(page).toBeDefined();
        const commands = page!.commands;
        for (const [switchId, place] of [[first, firstPlace], [second, secondPlace]] as const) {
          expect(commands).toContainEqual(expect.objectContaining({
            kind: "fork",
            condition: { kind: "switch", switchId, value: false },
            then: expect.arrayContaining([expect.objectContaining({ kind: "text", body: expect.stringContaining(place) })]),
          }));
        }
        for (const [firstDone, secondDone] of [[false, false], [true, false], [false, true], [true, true]] as const) {
          const session = startSession(project);
          session.currentMapId = map.id;
          session.variables.var_mk_stage = stage;
          // Both one-task combinations get the same progress count.
          session.variables.var_mk_tasks = Number(firstDone) + Number(secondDone);
          setSwitch(session, first, firstDone);
          setSwitch(session, second, secondDone);
          const interpreter = createInterpreter(commands, session, project, { currentEventId: eventId });
          const lines: string[] = [];
          for (let step = interpreter.start(); step.kind !== "done"; step = interpreter.resume(undefined)) {
            if (step.kind === "text") lines.push(step.body);
          }
          expect(lines.some((line) => line.includes(firstPlace))).toBe(!firstDone);
          expect(lines.some((line) => line.includes(secondPlace))).toBe(!secondDone);
        }
      }
    });
  });
});
