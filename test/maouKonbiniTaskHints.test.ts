import { beforeAll, describe, expect, it } from "vitest";
import { createInterpreter } from "@/player/interpreter";
import { createMaouKonbiniFlagshipDemo } from "@/project/flagship/maouKonbini";
import { setSwitch, startSession } from "@/project/session";
import type { Project } from "@/project/types";

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
