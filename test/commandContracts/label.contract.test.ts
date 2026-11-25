import { describe, expect, it } from "vitest";
import type { Command, Project } from "@/project/types";
import { roundtripCommands, runCommandContract, CONTRACT_EVENT_ID } from "./harness";
import { freshBlankProject } from "../support/blankProject";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";
import type { MonsterInstance } from "@/project/session";
import { isolateTimers } from "../mergedTeardown";

// test/commandContracts/inputNumber.contract.test.ts
// G1 계약: inputNumber (스펙 §5.1 행).
//
// 실측 메모 (§10.1):
// - 없는 variableId 도 런타임에서 무경고 생성된다.
// - digits 의 저장 가능 범위(1~6)는 deserialize/editor 입력 계층에서 검증·클램프한다. 인터프리터는
//   StepResult 로 digits 를 넘기고, resume 으로 받은 숫자를 그대로 변수에 쓴다.
describe("inputNumber.contract", () => {
  isolateTimers();
  function registerVariable(project: Project, id: string): void {
    project.variables.push({ id, name: id });
  }
  describe("inputNumber 계약", () => {
    it("정상 효과: inputNumber pause 후 입력값을 variableId 에 저장하고 digits 를 전달한다", () => {
      const result = runCommandContract([{ kind: "inputNumber", variableId: "var_number", digits: 3 }], {
        answers: [321],
      });

      expect(result.pauses).toEqual([
        expect.objectContaining({ kind: "inputNumber", variableId: "var_number", digits: 3 }),
      ]);
      expect(result.session.variables.var_number).toBe(321);
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("경계: digits 상한 6을 StepResult 에 그대로 전달한다", () => {
      const result = runCommandContract([{ kind: "inputNumber", variableId: "var_six_digits", digits: 6 }], {
        answers: [999999],
      });

      expect(result.pauses[0]).toMatchObject({ kind: "inputNumber", digits: 6 });
      expect(result.session.variables.var_six_digits).toBe(999999);
      expect(result.finished).toBe(true);
    });

    it("결측 참조: 없는 variableId 도 경고 없이 생성된다", () => {
      const result = runCommandContract([
        { kind: "inputNumber", variableId: "var_missing_runtime", digits: 2 },
        { kind: "setSwitch", switchId: "after_input_number", value: true },
      ], { answers: [42] });

      expect(result.session.variables.var_missing_runtime).toBe(42);
      expect(result.session.switches.after_input_number).toBe(true);
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("왕복 동일성: 등록된 variableId 는 serialize→deserialize 후 같은 결과를 낸다", () => {
      const commands: Command[] = [{ kind: "inputNumber", variableId: "var_number_roundtrip", digits: 4 }];
      const register = (project: Project) => registerVariable(project, "var_number_roundtrip");

      const original = runCommandContract(commands, { answers: [1234] });
      const restoredCommands = roundtripCommands(commands, register);
      expect(restoredCommands).toEqual(commands);
      const restored = runCommandContract(restoredCommands, { answers: [1234] });

      expect(restored.session).toEqual(original.session);
      expect(restored.pauses).toEqual(original.pauses);
    });

    it("pause 의미론: blocking — pause 가 정확히 1회, kind=inputNumber", () => {
      const result = runCommandContract([{ kind: "inputNumber", variableId: "var_pause_number", digits: 1 }], {
        answers: [7],
      });

      expect(result.pauses).toHaveLength(1);
      expect(result.pauses[0]?.kind).toBe("inputNumber");
      expect(result.finished).toBe(true);
    });

    it("선택 필드: prompt/showPad 가 pause 에 전달된다", () => {
      const result = runCommandContract(
        [{ kind: "inputNumber", variableId: "var_custom", digits: 2, prompt: "비밀번호", showPad: true }],
        { answers: [12] }
      );
      expect(result.pauses[0]).toMatchObject({
        kind: "inputNumber",
        prompt: "비밀번호",
        showPad: true,
        digits: 2,
      });
      expect(result.session.variables.var_custom).toBe(12);
    });
  });
});

// test/commandContracts/inputWait.contract.test.ts
// G1 계약: inputWait (스펙 §5.1 행).
//
// 실측 메모:
// - variableId 가 있으면 resume 숫자를 변수에 저장하고, 없으면 입력값을 무시한다.
describe("inputWait.contract", () => {
  isolateTimers();
  describe("inputWait 계약", () => {
    it("정상 효과: 입력 키 코드를 variableId 에 저장한다", () => {
      const result = runCommandContract([{ kind: "inputWait", variableId: "var_key" }], {
        answers: [13],
      });

      expect(result.pauses).toEqual([{ kind: "inputWait", variableId: "var_key" }]);
      expect(result.session.variables.var_key).toBe(13);
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("경계: variableId 가 없으면 경고 없이 입력값을 무시하고 진행한다", () => {
      const result = runCommandContract([
        { kind: "inputWait" },
        { kind: "setSwitch", switchId: "after_input_wait", value: true },
      ], { answers: [27] });

      expect(result.pauses).toEqual([{ kind: "inputWait", variableId: undefined }]);
      expect(result.session.variables).toEqual({});
      expect(result.session.switches.after_input_wait).toBe(true);
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("answers 소진/undefined resume 은 variableId 에 0 을 저장한다", () => {
      const result = runCommandContract([{ kind: "inputWait", variableId: "var_key_default" }]);

      expect(result.session.variables.var_key_default).toBe(0);
      expect(result.finished).toBe(true);
    });

    it("왕복 동일성: serialize→deserialize 후 실행해도 최종 세션 상태가 같다", () => {
      const commands: Command[] = [{ kind: "inputWait", variableId: "var_key_roundtrip" }];

      const original = runCommandContract(commands, { answers: [32] });
      const restoredCommands = roundtripCommands(commands);
      expect(restoredCommands).toEqual(commands);
      const restored = runCommandContract(restoredCommands, { answers: [32] });

      expect(restored.session).toEqual(original.session);
      expect(restored.pauses).toEqual(original.pauses);
    });

    it("pause 의미론: blocking — pause 가 정확히 1회, kind=inputWait", () => {
      const result = runCommandContract([{ kind: "inputWait" }]);

      expect(result.pauses).toHaveLength(1);
      expect(result.pauses[0]?.kind).toBe("inputWait");
      expect(result.finished).toBe(true);
    });
  });
});

// test/commandContracts/label.contract.test.ts
// G1 계약: label (스펙 §5.2 label/gotoLabel 행).
//
// 실측 메모:
// - label 은 실행 위치 표식일 뿐 단독으로는 상태를 바꾸지 않고 다음 명령으로 진행한다.
describe("label.contract", () => {
  isolateTimers();
  describe("label 계약", () => {
    it("정상 효과: label 은 no-op 으로 다음 명령을 실행한다", () => {
      const result = runCommandContract([
        { kind: "label", name: "start" },
        { kind: "setSwitch", switchId: "after_label", value: true },
      ]);

      expect(result.session.switches.after_label).toBe(true);
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("경계: 빈 label 이름도 경고 없이 no-op 으로 처리된다", () => {
      const result = runCommandContract([
        { kind: "label", name: "" },
        { kind: "setSwitch", switchId: "after_empty_label", value: true },
      ]);

      expect(result.session.switches.after_empty_label).toBe(true);
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("왕복 동일성: serialize→deserialize 후 실행해도 최종 세션 상태가 같다", () => {
      const commands: Command[] = [
        { kind: "label", name: "roundtrip_label" },
        { kind: "setSwitch", switchId: "after_label_roundtrip", value: true },
      ];

      const original = runCommandContract(commands);
      const restoredCommands = roundtripCommands(commands, (project) => {
        project.switches.push({ id: "after_label_roundtrip", name: "after label" });
      });
      expect(restoredCommands).toEqual(commands);
      const restored = runCommandContract(restoredCommands);

      expect(restored.session).toEqual(original.session);
    });

    it("pause 의미론: label 은 non-blocking — pause 가 발생하지 않는다", () => {
      const result = runCommandContract([{ kind: "label", name: "pause_label" }]);

      expect(result.pauses).toEqual([]);
      expect(result.finished).toBe(true);
    });
  });
});

// test/commandContracts/learnSkill.contract.test.ts
// G1 계약: learnSkill (스펙 §5.3 행 — "액터 스킬 목록에 추가(중복 없음)").
//
// 실측 메모 (§3 이탈 프로토콜):
// - §5 표 초안은 "없는 actor/skill → warn + 스킵"이라 했으나, 실제 구현(project/session.ts
//   learnSkill)은 세션 레벨 기록만 하고 프로젝트 DB 를 조회하지 않는다 → 존재하지 않는
//   actorId/skillId 도 경고 없이 그대로 기록된다(크래시 없음). 케이스 2는 실측 동작을 고정하고,
//   표와의 차이는 보고서 "표 대조 결과"에 기록한다.
describe("learnSkill.contract", () => {
  isolateTimers();
  // 하네스의 기본 프로젝트(createBlankProject)와 같은 DB 에서 유효 id 를 얻는다.
  function validIds(): { actorId: string; skillId: string } {
    const project = freshBlankProject();
    const actorId = project.database.actors[0]?.id;
    const skillId = project.database.skills[0]?.id;
    if (!actorId || !skillId) throw new Error("blank project 에 actor/skill 이 있어야 한다");
    return { actorId, skillId };
  }
  describe("learnSkill 계약", () => {
    it("정상 효과: 액터 스킬 목록에 추가되고, 같은 스킬을 다시 배워도 중복되지 않는다", () => {
      const { actorId, skillId } = validIds();
      const commands: Command[] = [
        { kind: "learnSkill", actorId, skillId },
        { kind: "learnSkill", actorId, skillId }, // 중복 습득 시도
      ];

      const result = runCommandContract(commands, {
        mutateSession: (session) => {
          session.partyActorIds = [actorId];
        },
      });

      expect(result.session.actorSkillIds?.[actorId]).toEqual([skillId]);
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("여러 스킬은 습득 순서대로 누적된다", () => {
      const { actorId } = validIds();
      const project = freshBlankProject();
      const skillIds = project.database.skills.slice(0, 2).map((skill) => skill.id);
      expect(skillIds.length).toBe(2);

      const result = runCommandContract(
        skillIds.map((skillId) => ({ kind: "learnSkill", actorId, skillId }) satisfies Command)
      );

      expect(result.session.actorSkillIds?.[actorId]).toEqual(skillIds);
      expect(result.finished).toBe(true);
    });

    it("결측 참조: 없는 actor/skill 이어도 크래시 없이 진행된다 — 실측: 경고 없이 세션에 기록(§5 표 초안은 warn+스킵)", () => {
      const result = runCommandContract([
        { kind: "learnSkill", actorId: "actor_missing", skillId: "skill_missing" },
        { kind: "setSwitch", switchId: "after_learn", value: true },
      ]);

      // 크래시 없이 다음 명령까지 진행.
      expect(result.session.switches.after_learn).toBe(true);
      expect(result.finished).toBe(true);
      // 실측 고정: DB 검증이 없어 경고가 발생하지 않고, 미지의 id 가 그대로 기록된다.
      expect(result.warnings).toEqual([]);
      expect(result.session.actorSkillIds?.actor_missing).toEqual(["skill_missing"]);
    });

    it("왕복 동일성: serialize→deserialize 후 실행해도 최종 세션 상태가 같다", () => {
      const { actorId, skillId } = validIds();
      const commands: Command[] = [{ kind: "learnSkill", actorId, skillId }];

      const original = runCommandContract(commands);
      const restoredCommands = roundtripCommands(commands);
      expect(restoredCommands).toEqual(commands);
      const restored = runCommandContract(restoredCommands);

      expect(restored.session).toEqual(original.session);
      expect(restored.finished).toBe(true);
    });

    it("pause 의미론: learnSkill 은 non-blocking — pause 가 발생하지 않는다", () => {
      const { actorId, skillId } = validIds();
      const result = runCommandContract([{ kind: "learnSkill", actorId, skillId }]);

      expect(result.pauses).toEqual([]);
      expect(result.finished).toBe(true);
    });
  });
});

// test/commandContracts/planSchedule.contract.test.ts
// G4 계약: planSchedule (주간 일정표 — 슬롯마다 활동 고르기).
//
// 실측 메모:
// - 재개 값은 고른 활동 id 배열. 보이지 않는 활동·모르는 id·문자열이 아닌 값은 걸러지고, 슬롯 수를 넘기지 않는다.
// - 고른 목록은 session.schedulePlans[scheduleId] 에 저장된다(빈 선택도 빈 배열로 저장).
// - 없는 일정표(또는 슬롯 0개)는 pause 없이 warn 후 다음 명령으로 진행한다.
// - 존재하지 않는 scheduleId 참조는 deserialize 의 참조 검증이 막는다.
describe("planSchedule.contract", () => {
  isolateTimers();
  const plan: Extract<Command, { kind: "planSchedule" }> = { kind: "planSchedule", scheduleId: "schedule_contract" };
  function registerSchedule(project: Project): void {
    project.switches.push({ id: "sw_secret", name: "secret" });
    project.commonEvents.push({ id: "ce_study", name: "study", trigger: "none", commands: [] });
    project.commonEvents.push({ id: "ce_rest", name: "rest", trigger: "none", commands: [] });
    project.database.schedules = [
      {
        id: "schedule_contract",
        title: "한 주",
        slots: [{ label: "월" }, { label: "화" }],
        activities: [
          { id: "study", label: "공부", description: "책을 읽는다", commonEventId: "ce_study" },
          { id: "rest", label: "휴식", description: "쉰다", commonEventId: "ce_rest", maxUses: 1 },
          {
            id: "secret",
            label: "비밀 훈련",
            description: "조건부",
            commonEventId: "ce_study",
            condition: { kind: "switch", switchId: "sw_secret", value: true },
          },
          { id: "extra", label: "여분", description: "넷째 활동", commonEventId: "ce_rest" },
        ],
      },
    ];
  }
  describe("planSchedule 계약", () => {
    it("정상 효과: pause 로 뷰를 내고, 고른 활동 id 를 session.schedulePlans 에 저장한다", () => {
      const result = runCommandContract([plan], { mutateProject: registerSchedule, answers: [["study", "rest"]] });
      expect(result.pauses).toEqual([
        expect.objectContaining({
          kind: "planSchedule",
          view: expect.objectContaining({
            scheduleId: "schedule_contract",
            slots: ["월", "화"],
            activities: [
              expect.objectContaining({ id: "study" }),
              expect.objectContaining({ id: "rest", remaining: 1 }),
              expect.objectContaining({ id: "extra" }),
            ],
          }),
        }),
      ]);
      expect(result.session.schedulePlans).toEqual({ schedule_contract: ["study", "rest"] });
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("조건이 거짓인 활동은 숨겨지고, 골라도 무시된다", () => {
      const result = runCommandContract([plan], { mutateProject: registerSchedule, answers: [["secret", "study"]] });
      expect(result.session.schedulePlans).toEqual({ schedule_contract: ["study"] });
    });

    it("틀린 입력: 모르는 id·문자열 아닌 값·슬롯 초과는 걸러진다", () => {
      const result = runCommandContract([plan], {
        mutateProject: registerSchedule,
        answers: [["nope", 7, "study", "extra", "study"]],
      });
      expect(result.session.schedulePlans).toEqual({ schedule_contract: ["study", "extra"] });
      expect(result.finished).toBe(true);
    });

    it("경계: 취소(배열 아님)는 빈 계획으로 저장하고, slotCount 는 칩 수를 줄인다", () => {
      const empty = runCommandContract([plan], { mutateProject: registerSchedule, answers: [undefined] });
      expect(empty.session.schedulePlans).toEqual({ schedule_contract: [] });
      expect(empty.finished).toBe(true);

      const limited = runCommandContract([{ ...plan, slotCount: 1 }], {
        mutateProject: registerSchedule,
        answers: [["study", "extra"]],
      });
      expect(limited.pauses[0]).toEqual(expect.objectContaining({ view: expect.objectContaining({ slots: ["월"] }) }));
      expect(limited.session.schedulePlans).toEqual({ schedule_contract: ["study"] });
    });

    it("결측 참조: 없는 일정표는 pause 없이 건너뛴다", () => {
      const result = runCommandContract([{ kind: "planSchedule", scheduleId: "schedule_missing" }, { kind: "setSwitch", switchId: "after", value: true }]);
      expect(result.pauses).toEqual([]);
      expect(result.session.switches.after).toBe(true);
      expect(result.session.schedulePlans).toBeUndefined();
      expect(result.finished).toBe(true);
    });

    it("왕복 동일성: serialize→deserialize 후에도 명령과 결과가 같다", () => {
      const commands: Command[] = [{ ...plan, slotCount: 2 }];
      const original = runCommandContract(commands, { mutateProject: registerSchedule, answers: [["study", "rest"]] });
      const restoredCommands = roundtripCommands(commands, registerSchedule);
      expect(restoredCommands).toEqual(commands);
      const restored = runCommandContract(restoredCommands, { mutateProject: registerSchedule, answers: [["study", "rest"]] });
      expect(restored.session).toEqual(original.session);
      expect(restored.pauses).toEqual(original.pauses);
    });

    it("참조 무결성: 없는 scheduleId 는 deserialize 가 거부한다", () => {
      expect(() => roundtripCommands([{ kind: "planSchedule", scheduleId: "schedule_missing" }], registerSchedule))
        .toThrow(/planSchedule.*schedule_missing/);
    });
  });
});

// test/commandContracts/presentItem.contract.test.ts
// G1 계약: presentItem (아이템 제시 — 증거 들이밀기).
//
// 실측 메모:
// - 재개 값은 고른 itemId 문자열. 목록에 없던 id·문자열이 아닌 값은 닫음(cancelBranch)이다.
// - 후보가 하나도 없어도 pause 는 1회 난다(items: []). UI 가 prompt 를 보이고 닫힘으로 재개한다.
// - 존재하지 않는 itemId 참조는 deserialize 의 참조 검증이 막는다.
describe("presentItem.contract", () => {
  isolateTimers();
  const evidence: Extract<Command, { kind: "presentItem" }> = {
    kind: "presentItem",
    prompt: "증거를 제시하라",
    itemIds: ["item_knife", "item_letter"],
    options: [{ itemId: "item_knife", branch: [{ kind: "setSwitch", switchId: "sw_right", value: true }] }],
    otherwiseBranch: [{ kind: "setSwitch", switchId: "sw_wrong", value: true }],
    cancelBranch: [{ kind: "setSwitch", switchId: "sw_cancel", value: true }],
    consume: true,
  };
  function registerEvidence(project: Project): void {
    for (const id of ["item_knife", "item_letter"]) {
      project.database.items.push({ ...structuredClone(project.database.items[0]!), id, name: id });
    }
    project.switches.push({ id: "sw_right", name: "right" }, { id: "sw_wrong", name: "wrong" }, { id: "sw_cancel", name: "cancel" });
  }
  const holdBoth = { mutateSession: (session: { inventory: Record<string, number> }) => { session.inventory.item_knife = 1; session.inventory.item_letter = 1; } };
  describe("presentItem 계약", () => {
    it("정상 효과: 맞는 아이템 → 그 branch, consume 으로 1개 소모", () => {
      const result = runCommandContract([evidence], { ...holdBoth, answers: ["item_knife"] });
      expect(result.pauses).toEqual([expect.objectContaining({
        kind: "presentItem",
        prompt: "증거를 제시하라",
        items: [{ itemId: "item_knife", count: 1 }, { itemId: "item_letter", count: 1 }],
      })]);
      expect(result.session.switches).toEqual({ sw_right: true });
      expect(result.session.inventory.item_knife ?? 0).toBe(0);
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("틀린 아이템 → otherwiseBranch, 소모 없음", () => {
      const result = runCommandContract([evidence], { ...holdBoth, answers: ["item_letter"] });
      expect(result.session.switches).toEqual({ sw_wrong: true });
      expect(result.session.inventory.item_letter).toBe(1);
      expect(result.finished).toBe(true);
    });

    it("경계: 후보를 하나도 안 가졌으면 빈 목록 pause 후 cancelBranch", () => {
      const result = runCommandContract([evidence], { answers: [undefined] });
      expect(result.pauses).toEqual([expect.objectContaining({ kind: "presentItem", items: [] })]);
      expect(result.session.switches).toEqual({ sw_cancel: true });
      expect(result.finished).toBe(true);
    });

    it("왕복 동일성: serialize→deserialize 후에도 명령과 결과가 같다", () => {
      const commands: Command[] = [evidence];
      const original = runCommandContract(commands, { ...holdBoth, answers: ["item_knife"] });
      const restoredCommands = roundtripCommands(commands, registerEvidence);
      expect(restoredCommands).toEqual(commands);
      const restored = runCommandContract(restoredCommands, { ...holdBoth, answers: ["item_knife"] });
      expect(restored.session).toEqual(original.session);
      expect(restored.pauses).toEqual(original.pauses);
    });

    it("참조 무결성: 없는 itemId 는 deserialize 가 거부한다", () => {
      expect(() => roundtripCommands([{ ...evidence, options: [{ itemId: "item_missing", branch: [] }] }], registerEvidence))
        .toThrow(/presentItem.*item_missing/);
    });
  });
});

// test/commandContracts/promoteActor.contract.test.ts
// G1 계약: promoteActor (Phase 8a 승급 커맨드).
describe("promoteActor.contract", () => {
  isolateTimers();
  function ids(): { actorId: string; fromClassId: string; toClassId: string } {
    const project = freshBlankProject();
    const actorId = project.database.actors[0]?.id;
    const fromClassId = project.database.actors[0]?.classId;
    const toClassId = project.database.classes.find((record) => record.id !== fromClassId)?.id;
    if (!actorId || !fromClassId || !toClassId) throw new Error("blank project 에 actor/class 2종이 있어야 한다");
    return { actorId, fromClassId, toClassId };
  }
  function addPromotion(project: Project, itemRequired = false): void {
    const { fromClassId, toClassId } = ids();
    const klass = project.database.classes.find((record) => record.id === fromClassId);
    if (!klass) throw new Error("missing source class");
    klass.promotions = [{ toClassId, requires: itemRequired ? { itemId: "item_contract_badge" } : { level: 1 } }];
    if (itemRequired) project.database.items.push({ ...project.database.items[0], id: "item_contract_badge", name: "계약 증표" });
  }
  function command(): Command {
    const { actorId, toClassId } = ids();
    return {
      kind: "promoteActor",
      actorId,
      toClassId,
      successBranch: [{ kind: "setFlag", flag: "promote_success", value: true }],
      failureBranch: [{ kind: "setFlag", flag: "promote_failure", value: true }],
    };
  }
  describe("promoteActor 계약", () => {
    it("정상 효과: 조건을 만족하면 성공 분기를 실행하고 classOverrides를 기록한다", () => {
      const { actorId, toClassId } = ids();
      const result = runCommandContract([command()], { mutateProject: (project) => addPromotion(project) });

      expect(result.session.classOverrides?.[actorId]).toBe(toClassId);
      expect(result.session.flags.promote_success).toBe(true);
      expect(result.session.flags.promote_failure).toBeUndefined();
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("조건 미충족: 실패 분기를 실행하고 직업을 바꾸지 않는다", () => {
      const { actorId } = ids();
      const result = runCommandContract([command()], { mutateProject: (project) => addPromotion(project, true) });

      expect(result.session.classOverrides?.[actorId]).toBeUndefined();
      expect(result.session.flags.promote_failure).toBe(true);
      expect(result.session.flags.promote_success).toBeUndefined();
      expect(result.finished).toBe(true);
    });

    it("왕복 동일성: serialize→deserialize 후 실행해도 최종 세션 상태가 같다", () => {
      const commands = [command()];
      const original = runCommandContract(commands, { mutateProject: (project) => addPromotion(project) });
      const restoredCommands = roundtripCommands(commands);
      expect(restoredCommands).toEqual(commands);
      const restored = runCommandContract(restoredCommands, { mutateProject: (project) => addPromotion(project) });

      expect(restored.session).toEqual(original.session);
      expect(restored.finished).toBe(true);
    });

    it("pause 의미론: promoteActor 는 non-blocking — pause 가 발생하지 않는다", () => {
      const result = runCommandContract([command()], { mutateProject: (project) => addPromotion(project) });

      expect(result.pauses).toEqual([]);
      expect(result.finished).toBe(true);
    });
  });
});

// test/commandContracts/recallParty.contract.test.ts
// 계약: recallParty (저장한 파티로 조작을 바꾸고, 자리가 다르면 transfer 로 옮긴다).
describe("recallParty.contract", () => {
  isolateTimers();
  function seedSets(x: number, y: number) {
    return (session: PlaySessionLike): void => {
      session.partyActorIds = ["actor_hero"];
      (session as PlaySessionLike & { partySets?: unknown }).partySets = {
        b: { actorIds: ["actor_mage"], mapId: session.currentMapId, x, y },
      };
    };
  }
  describe("recallParty 계약", () => {
    it("정상 효과: 구성원을 바꾸고 다른 자리면 transfer 로 pause 한다", () => {
      const result = runCommandContract([{ kind: "recallParty", partySetId: "b" }], { mutateSession: seedSets(2, 3) });
      expect(result.session.partyActorIds).toEqual(["actor_mage"]);
      expect(result.session.flags.recallPartySuccess).toBe(true);
      expect(result.pauses.map((step) => step.kind)).toEqual(["transfer"]);
    });

    it("같은 자리면 pause 없이 계속한다", () => {
      const result = runCommandContract([{ kind: "recallParty", partySetId: "b" }], {
        mutateSession: (session) => seedSets(session.x, session.y)(session),
      });
      expect(result.pauses).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("결측 참조: 없는 묶음은 실패 기억만 남기고 계속한다", () => {
      const result = runCommandContract([{ kind: "recallParty", partySetId: "ghost" }], { mutateSession: seedSets(2, 3) });
      expect(result.session.partyActorIds).toEqual(["actor_hero"]);
      expect(result.session.flags.recallPartySuccess).toBe(false);
      expect(result.finished).toBe(true);
    });

    it("왕복 동일성", () => {
      const commands: Command[] = [{ kind: "recallParty", partySetId: "b" }];
      expect(roundtripCommands(commands)).toEqual(commands);
    });
  });
});

describe("removeLight.contract", () => {
  isolateTimers();
  describe("removeLight 계약", () => {
    it("id 지정 제거와 all 제거를 세션 조명에 적용한다", () => {
      const result = runCommandContract([
        { kind: "addLight", source: { id: "a", at: "player", radius: 3 } },
        { kind: "addLight", source: { id: "b", at: { x: 2, y: 2 }, radius: 2 } },
        { kind: "removeLight", id: "a" },
        { kind: "removeLight", all: true },
      ]);

      expect(result.session.lighting).toEqual({ ambient: 0, sources: [] });
      expect(result.pauses).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("왕복 동일성: id 제거와 all 제거 shape가 보존된다", () => {
      const commands: Command[] = [
        { kind: "removeLight", id: "lamp" },
        { kind: "removeLight", all: true },
      ];

      expect(roundtripCommands(commands)).toEqual(commands);
    });
  });
});

// test/commandContracts/removeMonster.contract.test.ts
// 계약: removeMonster (놓아주기 — 파티 마지막 한 마리는 지키고, 빈 id 는 보관함 첫 개체).
describe("removeMonster.contract", () => {
  isolateTimers();
  function instance(instanceId: string): MonsterInstance {
    return { instanceId, speciesId: "species_wild_slime", level: 3, exp: 0, friendship: 70, caughtAt: { mapId: "m", x: 0, y: 0 } };
  }
  function seed(party: string[], box: string[]) {
    return (session: PlaySessionLike): void => {
      session.monsterInstances = Object.fromEntries([...party, ...box].map((id) => [id, instance(id)]));
      session.monsterParty = [...party];
      session.monsterBox = [...box];
    };
  }
  describe("removeMonster 계약", () => {
    it("정상 효과: 지정 개체를 지운다", () => {
      const result = runCommandContract([{ kind: "removeMonster", instanceId: "monster_2" }], { mutateSession: seed(["monster_1", "monster_2"], []) });
      expect(result.session.monsterParty).toEqual(["monster_1"]);
      expect(result.session.monsterInstances?.monster_2).toBeUndefined();
      expect(result.session.flags.removeMonsterSuccess).toBe(true);
      expect(result.finished).toBe(true);
    });

    it("파티의 마지막 한 마리는 놓아주지 않는다", () => {
      const result = runCommandContract([{ kind: "removeMonster", instanceId: "monster_1" }], { mutateSession: seed(["monster_1"], []) });
      expect(result.session.monsterParty).toEqual(["monster_1"]);
      expect(result.session.flags.removeMonsterSuccess).toBe(false);
    });

    it("결측 참조: 없는 개체는 크래시 없이 실패한다", () => {
      const result = runCommandContract([{ kind: "removeMonster", instanceId: "monster_missing" }]);
      expect(result.session.flags.removeMonsterSuccess).toBe(false);
      expect(result.finished).toBe(true);
    });

    it("왕복 동일성 · pause 없음", () => {
      const commands: Command[] = [{ kind: "removeMonster", instanceId: "" }];
      expect(roundtripCommands(commands)).toEqual(commands);
      expect(runCommandContract(commands, { mutateSession: seed(["monster_1"], ["monster_2"]) }).pauses).toEqual([]);
    });
  });
});

describe("runControl.contract", () => {
  isolateTimers();
  describe("runControl contract", () => {
    it("runs start, flag, room reset, floor advance, and completion in order", () => {
      const commands: Command[] = [
        { kind: "runControl", action: "start", seed: 42, runId: "contract-run", startFloor: 2 },
        { kind: "runControl", action: "setFlag", flag: "bossDoor", value: true },
        { kind: "runControl", action: "resetRoom" },
        { kind: "runControl", action: "resetRoom", roomId: "room-a" },
        { kind: "runControl", action: "advance", amount: 3 },
        { kind: "runControl", action: "end", result: "completed" },
      ];

      const result = runCommandContract(commands);

      expect(result.session.roguelikeRun).toEqual({
        version: 1,
        runId: "contract-run",
        seed: 42,
        floor: 5,
        status: "completed",
        flags: { bossDoor: true },
        roomResetCounts: { [result.session.currentMapId]: 1, "room-a": 1 },
        roomEventGenerationKeys: {},
      });
      expect(result.pauses).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("ignores mutations when no active run exists and continues", () => {
      const result = runCommandContract([
        { kind: "runControl", action: "advance", amount: 1 },
        { kind: "runControl", action: "setFlag", flag: "ignored", value: true },
        { kind: "runControl", action: "end", result: "failed" },
      ]);

      expect(result.session.roguelikeRun).toBeUndefined();
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("preserves every action variant through project serialization", () => {
      const commands: Command[] = [
        { kind: "runControl", action: "start", seed: 123, runId: "roundtrip", startFloor: 4 },
        { kind: "runControl", action: "advance", amount: 2 },
        { kind: "runControl", action: "setFlag", flag: "key", value: false },
        { kind: "runControl", action: "resetRoom", roomId: "room-b" },
        { kind: "runControl", action: "end", result: "abandoned" },
      ];

      expect(roundtripCommands(commands)).toEqual(commands);
    });
  });
});

// test/commandContracts/runSchedule.contract.test.ts
// G4 계약: runSchedule (저장된 주간 계획을 슬롯 순서대로 실행).
//
// 실측 메모:
// - 슬롯마다 slotVariableId(1부터)를 쓰고, 그 활동의 공용 이벤트를 부르고, session.scheduleUses 를 1 올린다.
// - 공용 이벤트가 끝나면 같은 명령으로 돌아와 다음 슬롯을 실행한다. 마지막 슬롯 뒤 session.scheduleRun 은 지워진다.
// - 계획에 없는/없어진 활동 슬롯은 건너뛴다. 계획이 비었으면 아무것도 하지 않고 다음 명령으로 진행한다.
// - 존재하지 않는 scheduleId·slotVariableId 참조는 deserialize 의 참조 검증이 막는다.
describe("runSchedule.contract", () => {
  isolateTimers();
  const run: Extract<Command, { kind: "runSchedule" }> = {
    kind: "runSchedule",
    scheduleId: "schedule_contract",
    slotVariableId: "var_slot",
  };
  function registerSchedule(project: Project): void {
    project.variables.push({ id: "var_slot", name: "slot" }, { id: "var_log", name: "log" });
    project.commonEvents.push({ id: "ce_study", name: "study", trigger: "none", commands: [] });
    project.commonEvents.push({ id: "ce_rest", name: "rest", trigger: "none", commands: [] });
    project.database.schedules = [
      {
        id: "schedule_contract",
        title: "한 주",
        slots: [{ label: "월" }, { label: "화" }],
        activities: [
          { id: "study", label: "공부", description: "", commonEventId: "ce_study" },
          { id: "rest", label: "휴식", description: "", commonEventId: "ce_rest" },
        ],
      },
    ];
  }
  /** 두 공용 이벤트가 각자 흔적(var_log=1, 스위치 rested)을 남긴다. */
  function seed(plan: string[] | undefined) {
    return (session: PlaySessionLike) => {
      session.commonEvents = [
        { id: "ce_study", commands: [{ kind: "setVariable", variableId: "var_log", op: "=", value: 1 }] },
        { id: "ce_rest", commands: [{ kind: "setSwitch", switchId: "rested", value: true }] },
      ];
      if (plan) session.schedulePlans = { schedule_contract: plan };
    };
  }
  describe("runSchedule 계약", () => {
    it("정상 효과: 두 슬롯의 공용 이벤트를 순서대로 부르고 슬롯 변수·사용 횟수를 갱신한다", () => {
      const result = runCommandContract(
        [run, { kind: "setSwitch", switchId: "after_run", value: true }],
        { mutateProject: registerSchedule, mutateSession: seed(["study", "rest"]) },
      );
      expect(result.session.variables.var_log).toBe(1);
      expect(result.session.switches.rested).toBe(true);
      expect(result.session.variables.var_slot).toBe(2);
      expect(result.session.scheduleUses).toEqual({ schedule_contract: { study: 1, rest: 1 } });
      expect(result.session.scheduleRun).toBeUndefined();
      expect(result.session.switches.after_run).toBe(true);
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("같은 활동을 두 번 고르면 사용 횟수가 2가 되고 슬롯 변수는 1,2 로 간다", () => {
      const result = runCommandContract([run], { mutateProject: registerSchedule, mutateSession: seed(["study", "study"]) });
      expect(result.session.scheduleUses).toEqual({ schedule_contract: { study: 2 } });
      expect(result.session.variables.var_slot).toBe(2);
      expect(result.finished).toBe(true);
    });

    it("경계: 계획이 없거나 비면 아무것도 실행하지 않고 다음 명령으로 진행한다", () => {
      for (const plan of [undefined, []]) {
        const result = runCommandContract(
          [run, { kind: "setSwitch", switchId: "after_run", value: true }],
          { mutateProject: registerSchedule, mutateSession: seed(plan) },
        );
        expect(result.session.scheduleUses).toBeUndefined();
        expect(result.session.scheduleRun).toBeUndefined();
        expect(result.session.switches.after_run).toBe(true);
        expect(result.finished).toBe(true);
      }
    });

    it("결측: 계획에 있던 활동이 일정표에서 없어졌으면 그 슬롯은 건너뛴다", () => {
      const result = runCommandContract([run], { mutateProject: registerSchedule, mutateSession: seed(["gone", "rest"]) });
      expect(result.session.switches.rested).toBe(true);
      expect(result.session.scheduleUses).toEqual({ schedule_contract: { rest: 1 } });
      expect(result.finished).toBe(true);
    });

    it("왕복 동일성: serialize→deserialize 후에도 명령과 결과가 같다", () => {
      const commands: Command[] = [run];
      const options = { mutateProject: registerSchedule, mutateSession: seed(["study", "rest"]) };
      const original = runCommandContract(commands, options);
      const restoredCommands = roundtripCommands(commands, registerSchedule);
      expect(restoredCommands).toEqual(commands);
      const restored = runCommandContract(restoredCommands, options);
      expect(restored.session).toEqual(original.session);
    });

    it("참조 무결성: 없는 scheduleId·slotVariableId 는 deserialize 가 거부한다", () => {
      expect(() => roundtripCommands([{ kind: "runSchedule", scheduleId: "schedule_missing" }], registerSchedule))
        .toThrow(/runSchedule.*schedule_missing/);
      expect(() => roundtripCommands([{ kind: "runSchedule", scheduleId: "schedule_contract", slotVariableId: "var_missing" }], registerSchedule))
        .toThrow(/runSchedule.*var_missing/);
    });
  });
});

// test/commandContracts/setDifficulty.contract.test.ts
// 계약: setDifficulty (system.difficulties 의 id 로 세션 난이도를 바꾼다).
describe("setDifficulty.contract", () => {
  isolateTimers();
  function withDifficulties(project: Project): void {
    project.system.difficulties = [{ id: "easy", name: "쉬움" }, { id: "hard", name: "어려움", enemyHpRate: 2 }];
  }
  describe("setDifficulty 계약", () => {
    it("정상 효과: 목록에 있는 난이도로 바꾼다", () => {
      const result = runCommandContract([{ kind: "setDifficulty", difficultyId: "hard" }], { mutateProject: withDifficulties });
      expect(result.session.difficultyId).toBe("hard");
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("결측 참조: 없는 난이도 id 는 무시하고 다음 명령을 실행한다", () => {
      const result = runCommandContract([
        { kind: "setDifficulty", difficultyId: "missing" },
        { kind: "setSwitch", switchId: "after_difficulty", value: true },
      ], { mutateProject: withDifficulties });
      expect(result.session.difficultyId).toBeUndefined();
      expect(result.session.switches.after_difficulty).toBe(true);
      expect(result.finished).toBe(true);
    });

    it("왕복 동일성: serialize→deserialize 후에도 같은 명령이다", () => {
      const commands: Command[] = [{ kind: "setDifficulty", difficultyId: "hard" }];
      expect(roundtripCommands(commands, withDifficulties)).toEqual(commands);
    });

    it("pause 의미론: non-blocking", () => {
      const result = runCommandContract([{ kind: "setDifficulty", difficultyId: "easy" }], { mutateProject: withDifficulties });
      expect(result.pauses).toEqual([]);
    });
  });
});

describe("setLighting.contract", () => {
  isolateTimers();
  describe("setLighting 계약", () => {
    it("transitionMs가 없거나 0이면 세션 조명을 즉시 변경한다", () => {
      const result = runCommandContract([
        { kind: "setLighting", ambient: 0.85, color: "#111111" },
        { kind: "setLighting", ambient: 0.25, transitionMs: 0 },
      ]);

      expect(result.session.lighting).toEqual({ ambient: 0.25, sources: [] });
      expect(result.pauses).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("transitionMs가 양수이면 플레이어 계층으로 blocking step을 넘긴다", () => {
      const result = runCommandContract([
        { kind: "setLighting", ambient: 0.9, color: "#000000", transitionMs: 320 },
      ]);

      expect(result.pauses).toEqual([
        { kind: "setLighting", ambient: 0.9, color: "#000000", transitionMs: 320 },
      ]);
      expect(result.session.lighting).toBeUndefined();
      expect(result.finished).toBe(true);
    });

    it("왕복 동일성: serialize→deserialize 후 명령 shape가 보존된다", () => {
      const commands: Command[] = [
        { kind: "setLighting", ambient: 0.75, color: "#101820", transitionMs: 160 },
      ];

      expect(roundtripCommands(commands)).toEqual(commands);
    });
  });
});

describe("setRelationship.contract", () => {
  isolateTimers();
  describe("setRelationship interpreter contract", () => {
    it("writes an explicit relationship immediately, without an owner handoff", () => {
      const command: Command = { kind: "setRelationship", npcKey: "npc_contract", state: "dating" };
      for (const commands of [[command], roundtripCommands([command])]) {
        const result = runCommandContract(commands);
        expect(result.session.relationships).toEqual({ npc_contract: "dating" });
        expect(result.pauses).toEqual([]);
        expect(result.warnings).toEqual([]);
        expect(result.finished).toBe(true);
      }
    });

    it("single clears an existing relationship instead of persisting a redundant state", () => {
      const result = runCommandContract([
        { kind: "setRelationship", npcKey: "npc_contract", state: "dating" },
        { kind: "setRelationship", npcKey: "npc_contract", state: "single" },
      ]);
      expect(result.session.relationships?.npc_contract).toBeUndefined();
      expect(result.finished).toBe(true);
    });

    it("uses owner character identity, and does not invent one when the owner is absent", () => {
      const command: Command = { kind: "setRelationship", state: "dating" };
      const owned = runCommandContract([command], { mutateProject: (project) => {
        const event = project.maps[project.startMapId].events.find((entry) => entry.id === CONTRACT_EVENT_ID);
        if (!event) throw new Error("Missing contract event");
        event.characterId = "character_contract";
      } });
      expect(owned.session.relationships).toEqual({ character_contract: "dating" });
      const unowned = runCommandContract([command], { currentEventId: null });
      expect(unowned.session.relationships).toBeUndefined();
      expect(unowned.finished).toBe(true);
    });
  });
});
