// test/nameEntry.test.ts
// 이름 입력(Name Entry) 기능 검증:
// 1) 순수 문자표 로직(한글 음절 생성 / 커서 이동 / 이름 clamp)
// 2) 인터프리터 상태머신(enterHeroName pause → submit → 액터 이름 반영)

import { describe, it, expect } from "vitest";
import { createInterpreter } from "@/player/interpreter";
import { changeActorName, resolveActorName } from "@/project/sessionActorCommands";
import { startSession } from "@/project/session";
import { createBlankProject } from "@/project/defaults";
import { applySaveSnapshot, createSaveSnapshot } from "@/player/saveSlots";
import type { Command, Project } from "@/project/types";
import type { PlaySessionLike } from "@/player/types";
import {
  appendChar,
  charAt,
  clampMaxLength,
  clampName,
  deleteLastChar,
  moveCursor,
  NAME_ENTRY_PAGES,
  pageById,
} from "@/player/nameEntry/hangulTable";

describe("nameEntry 문자표 순수 로직", () => {
  it("한글/영문 두 페이지를 제공한다", () => {
    expect(NAME_ENTRY_PAGES.map((page) => page.id)).toEqual(["hangul", "latin"]);
  });

  it("한글 페이지는 14×10 완성형 음절 그리드를 생성한다", () => {
    const hangul = pageById("hangul");
    expect(hangul.rows.length).toBe(14);
    expect(hangul.rows.every((row) => row.length === 10)).toBe(true);
    // 첫 셀은 '가', 두 번째 초성 행 첫 셀은 '나'.
    expect(hangul.rows[0][0]).toBe("가");
    expect(hangul.rows[1][0]).toBe("나");
    expect(hangul.rows[2][0]).toBe("다");
  });

  it("moveCursor 는 상하좌우로 순환하며 열을 clamp 한다", () => {
    const latin = pageById("latin");
    expect(moveCursor(latin, { row: 0, col: 0 }, "left")).toEqual({ row: 0, col: 12 });
    expect(moveCursor(latin, { row: 0, col: 0 }, "up")).toEqual({ row: latin.rows.length - 1, col: 0 });
    // 마지막 행(길이 13)에서 위로 가면 열이 clamp 되지 않는다(둘 다 13 이상 아님).
    const wrapped = moveCursor(latin, { row: 0, col: 12 }, "down");
    expect(charAt(latin, wrapped)).toBeTruthy();
  });

  it("clampName 은 최대 길이를 넘지 않게 자른다", () => {
    expect(clampName("가나다라마바사", 6)).toBe("가나다라마바");
    expect(clampMaxLength(999)).toBe(12);
    expect(clampMaxLength(0)).toBe(1);
  });

  it("appendChar/deleteLastChar 로 이름을 편집한다", () => {
    expect(appendChar("가나", "다", 6)).toBe("가나다");
    expect(appendChar("가나다라마바", "사", 6)).toBe("가나다라마바"); // 최대 길이 초과 무시
    expect(deleteLastChar("가나다")).toBe("가나");
    expect(deleteLastChar("")).toBe("");
  });
});

function mkProject(actorName: string): Project {
  return {
    database: { actors: [{ id: "a1", name: actorName }] },
  } as unknown as Project;
}

function mkSession(): PlaySessionLike {
  return {
    flags: {},
    switches: {},
    variables: {},
    timers: {},
    gold: 0,
    inventory: {},
    partyActorIds: ["a1"],
    actorVitals: {},
    currentMapId: "m1",
    x: 0,
    y: 0,
  } as unknown as PlaySessionLike;
}

describe("enterHeroName 인터프리터 상태머신", () => {
  it("pause 시 대상 액터의 현재 이름을 전달한다", () => {
    const project = mkProject("용사");
    const cmds: Command[] = [{ kind: "enterHeroName", actorId: "a1", maxLength: 6, showInitialName: true }];
    const interpreter = createInterpreter(cmds, mkSession(), project);
    const step = interpreter.start();
    expect(step).toMatchObject({
      kind: "enterHeroName",
      actorId: "a1",
      maxLength: 6,
      showInitialName: true,
      currentName: "용사",
    });
  });

  it("submit 한 이름을 세션 오버라이드에 반영하고(프로젝트 DB 원복) 다음 명령으로 진행한다", () => {
    const project = mkProject("용사");
    const session = mkSession();
    const cmds: Command[] = [
      { kind: "enterHeroName", actorId: "a1", maxLength: 6, showInitialName: false },
      { kind: "text", body: "done" },
    ];
    const interpreter = createInterpreter(cmds, session, project);
    interpreter.start();
    const next = interpreter.resume("철수");
    expect(session.actorNames?.a1).toBe("철수");
    // 프로젝트 DB 원본은 변경되지 않는다.
    expect(project.database.actors[0].name).toBe("용사");
    expect(next).toMatchObject({ kind: "text", body: "done" });
  });

  it("빈 이름을 submit 하면 오버라이드를 설정하지 않아 기존 이름을 유지한다", () => {
    const project = mkProject("용사");
    const session = mkSession();
    const cmds: Command[] = [{ kind: "enterHeroName", actorId: "a1", maxLength: 6, showInitialName: true }];
    const interpreter = createInterpreter(cmds, session, project);
    interpreter.start();
    interpreter.resume("   ");
    expect(session.actorNames?.a1).toBeUndefined();
    expect(resolveActorName(session, project.database.actors[0])).toBe("용사");
  });

  it("최대 길이를 넘는 이름은 잘라서 오버라이드에 반영한다", () => {
    const project = mkProject("용사");
    const session = mkSession();
    const cmds: Command[] = [{ kind: "enterHeroName", actorId: "a1", maxLength: 3, showInitialName: false }];
    const interpreter = createInterpreter(cmds, session, project);
    interpreter.start();
    interpreter.resume("가나다라마");
    expect(session.actorNames?.a1).toBe("가나다");
    expect(resolveActorName(session, project.database.actors[0])).toBe("가나다");
  });
});

describe("actorNames 세션 오버라이드 세이브 왕복", () => {
  it("세이브 스냅샷에 actorNames 를 포함하고 복원한다", () => {
    const project = createBlankProject();
    const session = startSession(project);
    const actorId = project.database.actors[0]?.id ?? "a1";
    changeActorName(session, actorId, "철수");

    const snapshot = createSaveSnapshot(project, session);
    expect(snapshot.session.actorNames?.[actorId]).toBe("철수");

    const restored = applySaveSnapshot(project, snapshot);
    expect(restored.actorNames?.[actorId]).toBe("철수");
  });
});
