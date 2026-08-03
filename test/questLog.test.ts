// test/questLog.test.ts
// 퀘스트 로그 모델(순수) + "임무" 메뉴 항목/화면 렌더 검증.

import { describe, expect, it } from "vitest";
import { buildQuestLog, questLogEntry } from "@/player/questLog";
import { renderPlayerStatusMenu, STATUS_MENU_COMMAND_IDS, statusMenuCommandLabel } from "@/player/playerStatusMenu";
import type { QuestDef } from "@/project/quest/questDef";
import { isStepQuestDef } from "@/project/quest/questDef";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";
import { startSession } from "@/project/session";
import type { PlaySession } from "@/project/session";
import type { Project } from "@/project/types";
import type { ToolContext } from "@/editor/tools/types";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

const VILLAGE = "m_village";

function questDef(): QuestDef {
  return {
    key: "q_demo",
    title: "데모 임무",
    summary: "약초를 모으고 슬라임을 처치하라.",
    giver: { create: { mapId: VILLAGE, x: 10, y: 8, name: "촌장", textureKey: "tex_easyrpg_charset_people1", characterIndex: 6 } },
    steps: [
      { kind: "talk", target: { create: { mapId: VILLAGE, x: 5, y: 5, name: "세라", graphicQuery: "여관 주인" } } },
      { kind: "kill", troopId: "tr_slime", at: { mapId: VILLAGE, x: 14, y: 12, graphicQuery: "슬라임" } },
    ],
    rewards: { gold: 50 },
  };
}

function projectWithQuest(): Project {
  const ctx: ToolContext = { project: createEmptyToolProject("퀘스트 로그 테스트") };
  const setup = [
    { name: "create_map", args: { name: "마을", width: 20, height: 16, id: VILLAGE } },
    { name: "set_start_position", args: { mapId: VILLAGE, x: 10, y: 10 } },
    { name: "upsert_enemy", args: { enemy: { id: "en_slime", name: "슬라임" } } },
    { name: "upsert_troop", args: { troop: { id: "tr_slime", name: "슬라임 무리", enemyIds: ["en_slime"] } } },
    { name: "create_quest", args: { def: questDef() } },
  ];
  for (const step of setup) {
    const result = runTool(ctx, step.name, step.args, { dryRun: false });
    if (!result.ok) throw new Error(`셋업 실패 ${step.name}: ${JSON.stringify(result.issues)}`);
  }
  return ctx.project;
}

describe("questLog", () => {
  const project = projectWithQuest();

  it('메뉴에 "임무" 명령이 등록된다', () => {
    expect(STATUS_MENU_COMMAND_IDS).toContain("quests");
    expect(statusMenuCommandLabel("quests", true)).toBe("임무");
  });

  it("미시작 퀘스트는 not-started로 표시된다", () => {
    const session = startSession(project);
    const log = buildQuestLog(project, session);
    expect(log.length).toBe(1);
    expect(log[0].state).toBe("not-started");
    expect(log[0].completedSteps).toBe(0);
    expect(log[0].totalSteps).toBe(2);
  });

  it("스위치 상태에 따라 진행 중/단계 완료가 반영된다", () => {
    const session: PlaySession = startSession(project);
    session.switches.sw_q_demo_started = true;
    session.switches.sw_q_demo_step0 = true;
    const quest = project.quests![0];
    if (!isStepQuestDef(quest)) throw new Error("step quest expected");
    const entry = questLogEntry(quest, session);
    expect(entry.state).toBe("active");
    expect(entry.steps[0].done).toBe(true);
    expect(entry.steps[1].done).toBe(false);
    expect(entry.completedSteps).toBe(1);
  });

  it("완료 퀘스트는 모든 단계를 완료로 본다", () => {
    const session = startSession(project);
    session.switches.sw_q_demo_done = true;
    const quest = project.quests![0];
    if (!isStepQuestDef(quest)) throw new Error("step quest expected");
    const entry = questLogEntry(quest, session);
    expect(entry.state).toBe("done");
    expect(entry.steps.every((step) => step.done)).toBe(true);
  });

  it('메인 메뉴 레일의 "기록 ▸" 를 열면 "임무" 가 나온다', () => {
    installFakeDom();
    const session = startSession(project);
    const menu = renderWithFakeDom(() =>
      renderPlayerStatusMenu({ project, session, slots: [], selectedCommand: "items", mode: "main", actions: emptyActions() })
    );
    // 사이드바 높이 때문에 기록/시스템/파티 그룹은 접혔다 — 레일에는 그룹 열기 항목만 있다.
    expect(findByTestId(menu, "status-menu-command-quests")).toBeNull();
    expect(findByTestId(menu, "status-menu-command-record-menu")?.textContent).toContain("기록");

    const record = renderWithFakeDom(() =>
      renderPlayerStatusMenu({ project, session, slots: [], selectedCommand: "record-menu", mode: "function", actions: emptyActions() })
    );
    const entry = findByTestId(record, "status-menu-group-command-quests");
    expect(entry).not.toBeNull();
    expect(entry?.textContent).toContain("임무");
  });

  it("임무 함수 화면이 퀘스트/단계 testid를 렌더한다", () => {
    installFakeDom();
    const session = startSession(project);
    session.switches.sw_q_demo_started = true;
    const menu = renderWithFakeDom(() =>
      renderPlayerStatusMenu({ project, session, slots: [], selectedCommand: "quests", mode: "function", actions: emptyActions() })
    );
    expect(findByTestId(menu, "status-menu-quest-q_demo")).not.toBeNull();
    expect(findByTestId(menu, "status-menu-quest-step-q_demo-0")).not.toBeNull();
    expect(findByTestId(menu, "status-menu-quest-state-q_demo")).not.toBeNull();
  });
});

function emptyActions() {
  const noop = () => undefined;
  return {
    onCommand: noop,
    onSaveSlot: noop,
    onLoadSlot: noop,
    onSelectItemTarget: noop,
    onUseItem: noop,
    onSelectSkillActor: noop,
    onSelectSkill: noop,
    onSelectEquipmentActor: noop,
    onSelectEquipmentSlot: noop,
    onEquipItem: noop,
    onUnequipItem: noop,
    onToggleRow: noop,
    onSelectFormationActor: noop,
    onMoveFormationActor: noop,
    onToggleMonsterView: noop,
    onMoveMonster: noop,
    onToggleWait: noop,
    onToTitle: noop,
  };
}
