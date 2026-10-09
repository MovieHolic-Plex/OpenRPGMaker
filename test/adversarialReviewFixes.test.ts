// 2026-09-24 적대 검수(자료집 20갈래 + 전체 검수 병합본)에서 소스로 확인한 결함의 회귀 고정.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { stateBehavior } from "@/battle/battleStates";
import { deleteSwitch, deleteVariable } from "@/editor/actions";
import { aiActivityActionLabel, aiActivityFamilySource } from "@/editor/aiActivityNarration";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { renderTermsTab } from "@/editor/panels/databaseUtilityViews";
import { createBlankProject } from "@/project/defaults";
import { repairProjectReferences } from "@/project/io/references";
import { isCaptureTool, itemAllowsBattle } from "@/project/itemUsage";
import { store } from "@/project/store";
import { setTeamRole } from "@/project/teamAccess";
import type { ItemRecord, StateRecord } from "@/project/types";
import { installFakeDom } from "./fakeDom";

function customState(patch: Partial<StateRecord>): StateRecord {
  const base = createBlankProject().database.states[0]!;
  return { ...base, id: "state_custom_review", name: "검수 상태", ...patch } as StateRecord;
}

describe("상태: 자료집 드롭다운 값과 턴당 HP 부호", () => {
  it("「행동 불가」 제한은 실제로 행동을 막는다", () => {
    expect(stateBehavior(customState({ restriction: "행동 불가" })).restrictsAction).toBe(true);
    expect(stateBehavior(customState({ restriction: "없음" })).restrictsAction).toBe(false);
  });

  it("「전투 종료 후 유지」는 전투가 끝나도 남는다", () => {
    expect(stateBehavior(customState({ removalCondition: "전투 종료 후 유지" })).removeOnBattleEnd).toBe(false);
    expect(stateBehavior(customState({ removalCondition: "전투 종료" })).removeOnBattleEnd).toBe(true);
  });

  it("칸에 저장한 턴당 정수는 음수 = 피해, 양수 = 회복이다", () => {
    const heal = stateBehavior(customState({ hpReleaseTurn: 8 }));
    expect(heal.hpDamagePercentPerTurn).toBe(0);
    expect(heal.hpHealPercentPerTurn).toBe(8);
    const damage = stateBehavior(customState({ hpReleaseTurn: -6 }));
    expect(damage.hpDamagePercentPerTurn).toBe(6);
    expect(damage.hpHealPercentPerTurn).toBe(0);
  });
});

describe("아이템: 종류를 약으로 바꾼 옛 포획 프로필", () => {
  const item = (patch: Partial<ItemRecord>): ItemRecord => ({
    ...createBlankProject().database.items[0]!,
    occasion: "always",
    captureProfile: { multiplier: 2 },
    ...patch,
  } as ItemRecord);

  it("약·책은 포획 도구가 아니고, 일반 물품 공은 여전히 포획 도구다", () => {
    expect(isCaptureTool(item({ type: "medicine" }))).toBe(false);
    expect(isCaptureTool(item({ type: "book" }))).toBe(false);
    expect(isCaptureTool(item({ type: "special" }))).toBe(true);
    expect(isCaptureTool(item({ type: "normalGoods" }))).toBe(true);
  });

  it("약은 약 규칙으로 전투 사용 여부를 판단한다", () => {
    expect(itemAllowsBattle(item({ type: "medicine", onlyEffectiveOnDeadActors: false }))).toBe(true);
  });
});

describe("AI 작업 줄: 파괴 규모를 숨기지 않는다", () => {
  it.each([
    ["clear_map", "맵 전체를 지우는 중"],
    ["reset_project", "프로젝트를 초기화하는 중"],
    ["delete_resource", "리소스를 지우는 중"],
  ] as const)("%s → %s", (tool, label) => {
    expect(aiActivityFamilySource(tool)).toBe("mapped");
    expect(aiActivityActionLabel(tool)).toBe(label);
  });
});

describe("축사 좌표 복구", () => {
  it("맵이 줄어 범위 밖이 된 축사는 지우지 않고 맵 안으로 당긴다", () => {
    const project = createBlankProject();
    const map = Object.values(project.maps)[0]!;
    project.system.farmAnimalBuildings = [{
      id: "barn_review", name: "축사", mapId: map.id, x: map.width + 50, y: map.height + 50, capacity: 4, allowedSpeciesIds: [],
    }];
    repairProjectReferences(project);
    expect(project.system.farmAnimalBuildings).toEqual([
      expect.objectContaining({ id: "barn_review", x: map.width - 1, y: map.height - 1 }),
    ]);
  });
});

describe("스위치·변수 삭제와 보기 전용", () => {
  let cleanupDom: (() => void) | undefined;
  const previousWindow = globalThis.window;

  beforeEach(() => {
    cleanupDom = installFakeDom();
    store.replace(createBlankProject());
    resetMapEditHistory();
  });

  afterEach(() => {
    setTeamRole(null);
    if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
    else Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
    cleanupDom?.();
    cleanupDom = undefined;
  });

  it("삭제해도 뒤 번호가 당겨지거나 같은 id 가 맨 끝에 되살아나지 않는다", () => {
    store.update((project) => {
      project.switches[1]!.name = "문 열림";
      project.session.switches[project.switches[1]!.id] = true;
      project.variables[2]!.name = "점수";
    });
    const switchIds = store.getCurrent().switches.map((record) => record.id);
    const variableIds = store.getCurrent().variables.map((record) => record.id);
    const targetSwitch = switchIds[1]!;

    expect(deleteSwitch(targetSwitch)).toEqual({ ok: true });
    expect(deleteVariable(variableIds[2]!)).toEqual({ ok: true });

    const after = store.getCurrent();
    expect(after.switches.map((record) => record.id)).toEqual(switchIds);
    expect(after.variables.map((record) => record.id)).toEqual(variableIds);
    expect(after.switches[1]!.name).toBe("");
    expect(after.session.switches[targetSwitch]).toBe(false);
  });

  it("보기 전용 팀 멤버의 삭제는 성공이라고 답하지 않는다", () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { ...(globalThis.window ?? {}), oprn: { team: {} } },
    });
    setTeamRole("viewer");
    const id = store.getCurrent().switches[0]!.id;
    expect(deleteSwitch(id)).toMatchObject({ ok: false });
  });

  it("용어 탭에서 방어·도주를 고칠 수 있다", () => {
    const host = document.createElement("div");
    renderTermsTab(host);
    const text = host.textContent ?? "";
    expect(text).toContain("방어");
    expect(text).toContain("도주");
  });
});
