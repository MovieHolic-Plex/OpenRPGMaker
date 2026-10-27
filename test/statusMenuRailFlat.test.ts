import { describe, expect, it } from "vitest";
import {
  listStatusMenuGroupCommandIds,
  listStatusMenuRailIds,
  statusMenuCommandSummary,
  statusMenuRailIdForCommand,
} from "@/player/playerStatusMenuModel";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";

function flatProject() {
  const project = createBlankProject();
  project.system.menuUiStyle = "party-first";
  return project;
}

// 「전투 기록」(battle-reports)이 기록 묶음에, 「설정」(options)이 시스템 트레이에 들어왔다(공개 기준 커밋 0d4f13e7c8) —
// 기록 명령이 언제나 둘 이상이라 평면 레일에서도 「기록 ▸」 로 접힌다.
describe("flat status menu rail (painted skins)", () => {
  it("행동·파티를 펼치고 임무는 그대로, 저장은 꺼내고 시스템은 접는다", () => {
    const project = flatProject();
    expect(listStatusMenuRailIds(project, startSession(project))).toEqual([
      "items", "skills", "equipment", "status", "row", "formation", "monsters", "record-menu", "save", "system-menu",
    ]);
  });

  it("시스템 트레이는 저장을 빼고 로드·대기·설정·타이틀만 담는다", () => {
    const project = flatProject();
    expect(listStatusMenuGroupCommandIds("system-menu", project, startSession(project))).toEqual(["load", "wait", "options", "to-title"]);
  });

  it("기록 명령이 둘 이상이면 「기록 ▸」 로 접는다", () => {
    const project = flatProject();
    project.system.giftSystem = true; // 관계 명령 노출
    const session = startSession(project);
    const rail = listStatusMenuRailIds(project, session);
    expect(rail).toContain("record-menu");
    expect(rail).not.toContain("quests");
    expect(listStatusMenuGroupCommandIds("record-menu", project, session)).toEqual(["battle-reports", "quests", "relationships"]);
  });

  it("커서 강조 대상: 펼친 명령은 자신, 접힌 명령은 그룹 항목", () => {
    const project = flatProject();
    const session = startSession(project);
    expect(statusMenuRailIdForCommand("status", project, session)).toBe("status");
    expect(statusMenuRailIdForCommand("save", project, session)).toBe("save");
    expect(statusMenuRailIdForCommand("load", project, session)).toBe("system-menu");
    expect(statusMenuRailIdForCommand("to-title", project, session)).toBe("system-menu");
    expect(statusMenuRailIdForCommand("quests", project, session)).toBe("record-menu");
    expect(statusMenuRailIdForCommand("system-menu", project, session)).toBe("system-menu");
  });

  it("기본 스킨은 접힌 레일 6항목 그대로이고 상태는 파티▸ 로 강조된다", () => {
    const project = createBlankProject();
    const session = startSession(project);
    expect(listStatusMenuRailIds(project, session)).toEqual(["items", "skills", "equipment", "party-menu", "record-menu", "system-menu"]);
    expect(statusMenuRailIdForCommand("status", project, session)).toBe("party-menu");
    expect(statusMenuRailIdForCommand("status")).toBe("party-menu");
    expect(listStatusMenuGroupCommandIds("system-menu", project, session)).toEqual(["save", "load", "wait", "options", "to-title"]);
  });
});

describe("hub command summaries", () => {
  it("허브 타일의 한 줄 요약 — 아이템 종수·파티 상태·시스템 하위 명령", () => {
    const project = createBlankProject();
    const session = startSession(project);
    expect(statusMenuCommandSummary("items", project, session, [])).toMatch(/종$/);
    expect(statusMenuCommandSummary("party-menu", project, session, [])).toContain("명");
    expect(statusMenuCommandSummary("system-menu", project, session, [])).toContain("저장");
    expect(statusMenuCommandSummary("save", project, session, [{ kind: "empty", slot: 1 }, { kind: "empty", slot: 2 }, { kind: "empty", slot: 3 }])).toBe("0/3칸");
    expect(statusMenuCommandSummary("to-title", project, session, [])).toBe("");
  });
});
