// test/commandContracts/enterHeroName.contract.test.ts
// G1 계약: enterHeroName (스펙 §5.1 행 — "actorId의 이름 변경, maxLength 준수").
//
// 실측 메모 (§3 이탈 프로토콜):
// - §5 표 초안은 "없는 actor → warn + 스킵"이라 했으나, 실제 구현(commandCatalog.ts)은 actor 를
//   찾지 못해도 경고 없이 currentName="" 으로 pause 를 발생시키고, 입력된 이름을 세션 오버라이드
//   (session.actorNames)에 그대로 기록한다(크래시 없음). 케이스 2는 실측 동작을 고정하고,
//   차이는 보고서 "표 대조 결과"에 기록한다.
// - 이름 반영은 프로젝트 DB 가 아니라 세션 오버라이드(actorNames)다(저장 데이터 원복 유지).
// - maxLength 는 clampMaxLength 로 1~12 범위로 강제된다(코드포인트 기준 절단).
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import type { Command } from "@/project/types";
import { roundtripCommands, runCommandContract } from "./harness";

function validActor(): { actorId: string; name: string } {
  const project = createBlankProject();
  const actor = project.database.actors[0];
  if (!actor) throw new Error("blank project 에 actor 가 있어야 한다");
  return { actorId: actor.id, name: actor.name };
}

describe("enterHeroName 계약", () => {
  it("정상 효과: DB 이름을 currentName 으로 노출하고, 입력을 maxLength 로 잘라 세션 오버라이드에 기록한다", () => {
    const { actorId, name } = validActor();
    const commands: Command[] = [
      { kind: "enterHeroName", actorId, maxLength: 6, showInitialName: true },
    ];

    const result = runCommandContract(commands, { answers: ["가나다라마바사아"] });

    expect(result.pauses).toEqual([
      { kind: "enterHeroName", actorId, maxLength: 6, showInitialName: true, currentName: name },
    ]);
    // 8자 입력 → maxLength 6 으로 절단.
    expect(result.session.actorNames?.[actorId]).toBe("가나다라마바");
    expect(result.warnings).toEqual([]);
    expect(result.finished).toBe(true);
  });

  it("결측 참조: 없는 actor 여도 크래시 없이 currentName=\"\" 으로 진행된다 — 실측: 경고 없음(§5 표 초안은 warn+스킵)", () => {
    const result = runCommandContract(
      [
        { kind: "enterHeroName", actorId: "actor_missing", maxLength: 6, showInitialName: false },
        { kind: "setSwitch", switchId: "after_name", value: true },
      ],
      { answers: ["무명"] }
    );

    expect(result.pauses[0]).toMatchObject({ kind: "enterHeroName", currentName: "" });
    expect(result.session.switches.after_name).toBe(true);
    expect(result.finished).toBe(true);
    // 실측 고정: DB 검증/경고 없이 미지의 actorId 에도 오버라이드가 기록된다.
    expect(result.warnings).toEqual([]);
    expect(result.session.actorNames?.actor_missing).toBe("무명");
  });

  it("왕복 동일성: serialize→deserialize 후 실행해도 최종 세션 상태가 같다", () => {
    const { actorId } = validActor();
    const commands: Command[] = [
      { kind: "enterHeroName", actorId, maxLength: 8, showInitialName: false },
    ];

    const original = runCommandContract(commands, { answers: ["새이름"] });
    const restoredCommands = roundtripCommands(commands);
    expect(restoredCommands).toEqual(commands);
    const restored = runCommandContract(restoredCommands, { answers: ["새이름"] });

    expect(restored.session).toEqual(original.session);
    expect(original.session.actorNames?.[actorId]).toBe("새이름");
  });

  it("pause 의미론: blocking — pause 가 정확히 1회, kind=enterHeroName", () => {
    const { actorId } = validActor();
    const result = runCommandContract(
      [{ kind: "enterHeroName", actorId, maxLength: 6, showInitialName: true }],
      { answers: ["임시"] }
    );

    expect(result.pauses).toHaveLength(1);
    expect(result.pauses[0]?.kind).toBe("enterHeroName");
    expect(result.finished).toBe(true);
  });

  it("빈 입력(취소/공백)은 이름 오버라이드를 만들지 않는다", () => {
    const { actorId } = validActor();
    const command: Command = { kind: "enterHeroName", actorId, maxLength: 6, showInitialName: true };

    const dismissed = runCommandContract([command]); // answers 없음 → undefined 로 진행
    expect(dismissed.session.actorNames).toBeUndefined();
    expect(dismissed.finished).toBe(true);

    const whitespace = runCommandContract([command], { answers: ["   "] });
    expect(whitespace.session.actorNames).toBeUndefined();
    expect(whitespace.finished).toBe(true);
  });
});
