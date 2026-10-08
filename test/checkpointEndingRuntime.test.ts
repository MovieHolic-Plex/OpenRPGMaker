import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { createInterpreter } from "@/player/interpreter";
import { applySaveSnapshot, createSaveSnapshot } from "@/player/saveSlots";
import {
  attachSessionCheckpoint,
  hasSessionCheckpoint,
  restorePersistedSessionCheckpoint,
  restoreSessionCheckpoint,
} from "@/player/checkpoints";
import type { Command } from "@/project/types";

describe("checkpointSave / killPlayer / triggerEnding", () => {
  it("checkpointSave는 저장 슬롯 스냅샷으로 세션 상태를 왕복 복원한다", () => {
    const project = createBlankProject();
    const session = startSession(project);
    const switchId = project.switches[0]!.id;
    const variableId = project.variables[0]!.id;
    const actorId = session.partyActorIds[0]!;
    session.currentMapId = project.startMapId;
    session.x = 3;
    session.y = 4;
    session.switches[switchId] = true;
    session.variables[variableId] = 7;
    session.actorVitals[actorId]!.hp = 5;

    const result = createInterpreter([{ kind: "checkpointSave" }], session, project).start();
    expect(result).toEqual({ kind: "done" });

    session.x = 1;
    session.y = 1;
    session.switches[switchId] = false;
    session.variables[variableId] = 0;
    session.actorVitals[actorId]!.hp = 1;
    const restored = restoreSessionCheckpoint(project, session);

    expect(restored).not.toBeNull();
    expect(restored).toMatchObject({
      currentMapId: project.startMapId,
      x: 3,
      y: 4,
    });
    expect(restored!.switches[switchId]).toBe(true);
    expect(restored!.variables[variableId]).toBe(7);
    expect(restored!.actorVitals[actorId]!.hp).toBe(5);
  });

  it("체크포인트는 일반 세이브 스냅샷에 포함되지 않는다", () => {
    const project = createBlankProject();
    const session = startSession(project);
    createInterpreter([{ kind: "checkpointSave" }], session, project).start();
    expect(hasSessionCheckpoint(session)).toBe(true);

    const loaded = applySaveSnapshot(project, createSaveSnapshot(project, session));

    expect(hasSessionCheckpoint(loaded)).toBe(false);
  });

  it("실제 Continue가 새 세션으로 바뀌어도 저장된 체크포인트를 다시 연결한다", () => {
    const project = createBlankProject();
    const session = startSession(project);
    session.x = 3;
    session.y = 4;
    createInterpreter([{ kind: "checkpointSave" }], session, project).start();

    const saved = attachSessionCheckpoint(session, createSaveSnapshot(project, session));
    expect(saved.checkpoint).toBeDefined();
    expect((saved.checkpoint as unknown as Record<string, unknown>).checkpoint).toBeUndefined();

    const continued = applySaveSnapshot(project, JSON.parse(JSON.stringify(saved)));
    expect(hasSessionCheckpoint(continued)).toBe(false);
    restorePersistedSessionCheckpoint(project, continued, saved);
    expect(hasSessionCheckpoint(continued)).toBe(true);

    continued.x = 1;
    const retried = restoreSessionCheckpoint(project, continued);
    expect(retried).toMatchObject({ x: 3, y: 4 });
  });

  it("패배 분기 transfer 뒤 recoverAll을 이어서 실행한다", () => {
    const project = createBlankProject();
    const session = startSession(project);
    const actorId = session.partyActorIds[0]!;
    session.actorVitals[actorId]!.hp = 0;
    const interpreter = createInterpreter([{
      kind: "battleProcessing",
      troopId: "missing-troop",
      canEscape: true,
      canLose: true,
      branchOnResult: true,
      defeatBranch: [
        { kind: "transfer", mapId: project.startMapId, x: project.startPos.x, y: project.startPos.y },
        { kind: "recoverAll" },
      ],
    }], session, project);

    expect(interpreter.start().kind).toBe("battleProcessing");
    expect(interpreter.resume("defeat").kind).toBe("transfer");
    expect(interpreter.resume(undefined)).toEqual({ kind: "done" });
    expect(session.actorVitals[actorId]!.hp).toBe(session.actorVitals[actorId]!.maxHp);
  });

  it("killPlayer는 파티 전멸 후 gameOver를 내고 체크포인트 복원으로 이전 상태를 돌린다", () => {
    const project = createBlankProject();
    const session = startSession(project);
    const variableId = project.variables[0]!.id;
    const actorId = session.partyActorIds[0]!;
    session.x = 2;
    session.y = 2;

    const commands: Command[] = [
      { kind: "checkpointSave" },
      { kind: "setVariable", variableId, op: "=", value: 9 },
      { kind: "killPlayer", message: "함정" },
    ];
    const step = createInterpreter(commands, session, project).start();

    expect(step).toEqual({ kind: "gameOver", message: "함정" });
    expect(session.actorVitals[actorId]!.hp).toBe(0);
    const restored = restoreSessionCheckpoint(project, session);
    expect(restored).not.toBeNull();
    expect(restored!.x).toBe(2);
    expect(restored!.y).toBe(2);
    expect(restored!.variables[variableId]).toBe(0);
  });

  it("triggerEnding은 조건 만족 엔딩 중 priority가 가장 높은 항목을 고른다", () => {
    const project = createBlankProject();
    const session = startSession(project);
    const variableId = project.variables[0]!.id;
    project.endings = [
      { id: "ending_low", name: "낮은 엔딩", priority: 1, conditions: [{ kind: "variable", variableId, op: ">=", value: 0 }] },
      { id: "ending_high", name: "높은 엔딩", priority: 10, conditions: [{ kind: "variable", variableId, op: ">=", value: 0 }] },
    ];

    const step = createInterpreter([{ kind: "triggerEnding" }], session, project).start();

    expect(step).toEqual({ kind: "returnToTitle", title: "높은 엔딩", message: "" });
    expect(session.flags["ending:ending_high"]).toBe(true);
    expect(session.flags["ending:ending_low"]).toBeUndefined();
  });

  it("이름 있는 triggerEnding은 엔딩 조건이 거짓이면 끝나지 않고, 참이면 그 엔딩을 연다", () => {
    const project = createBlankProject();
    const session = startSession(project);
    const variableId = project.variables[0]!.id;
    project.endings = [
      { id: "ending_love", name: "고백", priority: 10, conditions: [{ kind: "variable", variableId, op: ">=", value: 6 }] },
    ];
    session.variables[variableId] = 2;
    const blocked = createInterpreter([{ kind: "triggerEnding", endingId: "ending_love" }], session, project).start();
    expect(blocked).toEqual({ kind: "done" });
    expect(session.flags["ending:ending_love"]).toBeUndefined();

    session.variables[variableId] = 6;
    const opened = createInterpreter([{ kind: "triggerEnding", endingId: "ending_love" }], session, project).start();
    expect(opened).toEqual({ kind: "returnToTitle", title: "고백", message: "" });
    expect(session.flags["ending:ending_love"]).toBe(true);
  });

  it("define_ending은 같은 조건 집합의 낮은 priority 엔딩을 warning으로 보고한다", () => {
    const project = createBlankProject();
    const switchId = project.switches[0]!.id;
    const ctx = { project };
    const first = runTool(ctx, "define_ending", {
      id: "ending_low",
      name: "낮은 엔딩",
      priority: 1,
      conditions: [{ kind: "switch", switchId, value: true }],
    });
    expect(first.ok, first.summary).toBe(true);

    const second = runTool(ctx, "define_ending", {
      id: "ending_high",
      name: "높은 엔딩",
      priority: 5,
      conditions: [{ kind: "switch", switchId, value: true }],
    });

    expect(second.ok, second.summary).toBe(true);
    expect(second.diff?.warnings.join("\n")).toContain("ending_low");
    expect(second.diff?.warnings.join("\n")).toContain("가려집니다");
  });
});
