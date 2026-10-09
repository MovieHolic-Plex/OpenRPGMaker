// test/commandContracts/breakLoop.contract.test.ts
// G1 계약: breakLoop (스펙 §5.2 loop/breakLoop 행).
//
// 실측 메모 (§3 이탈 프로토콜):
// - §5 표 초안은 "루프 밖 breakLoop → warn + no-op"이라 했으나, 실제 구현(stack.ts breakLoop)은
//   루프 프레임을 찾을 때까지 스택을 전부 pop 하므로 "경고 없이 이벤트 전체 종료"다.
//   RM2003(EasyRPG RPG_RT) 의 Break Loop 도 짝이 되는 End Loop 가 없으면 리스트 끝으로
//   점프(=이벤트 종료)하므로 명백한 버그로 볼 수 없다 → 코드 유지, ⚠ 판정 보류로 보고서에 기록.
//   이 파일의 케이스 2는 실측 동작을 고정한다.
import { describe, expect, it } from "vitest";
import type { Command } from "@/project/types";
import { roundtripCommands, runCommandContract } from "./harness";

// 카운터가 limit 에 도달하면 breakLoop 로 탈출하고, 루프 뒤 명령으로 계속 진행하는 프로그램.
function counterLoopProgram(counterId: string, afterId: string, limit: number): Command[] {
  return [
    { kind: "setVariable", variableId: counterId, op: "=", value: 0 },
    {
      kind: "loop",
      body: [
        { kind: "setVariable", variableId: counterId, op: "+=", value: 1 },
        {
          kind: "fork",
          condition: { kind: "variable", variableId: counterId, op: ">=", value: limit },
          then: [{ kind: "breakLoop" }],
        },
      ],
    },
    { kind: "setVariable", variableId: afterId, op: "=", value: 99 },
  ];
}

describe("breakLoop 계약", () => {
  it("정상 효과: 최근접 루프를 탈출하고 루프 다음 명령이 실행된다 (정확히 N회 반복)", () => {
    const result = runCommandContract(counterLoopProgram("counter", "after", 3));

    expect(result.session.variables.counter).toBe(3);
    expect(result.session.variables.after).toBe(99);
    expect(result.warnings).toEqual([]);
    expect(result.finished).toBe(true);
  });

  it("중첩 루프: 안쪽 breakLoop 는 안쪽 루프만 탈출하고 바깥 루프는 계속 돈다", () => {
    const commands: Command[] = [
      { kind: "setVariable", variableId: "outer", op: "=", value: 0 },
      {
        kind: "loop",
        body: [
          { kind: "setVariable", variableId: "outer", op: "+=", value: 1 },
          // 안쪽 루프는 즉시 탈출 — 바깥 루프에 영향이 없어야 한다.
          {
            kind: "loop",
            body: [
              { kind: "setVariable", variableId: "inner", op: "+=", value: 1 },
              { kind: "breakLoop" },
            ],
          },
          {
            kind: "fork",
            condition: { kind: "variable", variableId: "outer", op: ">=", value: 2 },
            then: [{ kind: "breakLoop" }],
          },
        ],
      },
      { kind: "setVariable", variableId: "after", op: "=", value: 1 },
    ];

    const result = runCommandContract(commands);

    expect(result.session.variables.outer).toBe(2);
    expect(result.session.variables.inner).toBe(2); // 바깥 반복마다 1회씩
    expect(result.session.variables.after).toBe(1);
    expect(result.finished).toBe(true);
  });

  it("경계(루프 밖 breakLoop): 한 번 경고하고 다음 명령으로 진행한다", () => {
    const result = runCommandContract([
      { kind: "setVariable", variableId: "before", op: "=", value: 1 },
      { kind: "breakLoop" },
      { kind: "setVariable", variableId: "after", op: "=", value: 2 },
    ]);

    // Malformed authored data must not destroy the event stack or stall on the
    // same instruction. Warn once, skip the invalid command, and keep going.
    expect(result.session.variables.before).toBe(1);
    expect(result.session.variables.after).toBe(2);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("breakLoop");
    expect(result.finished).toBe(true);
  });

  it("무한루프 방지: breakLoop 없는 루프는 하네스 maxSteps 안전핀이 실패시킨다", () => {
    const commands: Command[] = [
      { kind: "loop", body: [{ kind: "wait", ms: 1 }] },
    ];
    expect(() => runCommandContract(commands, { maxSteps: 20 })).toThrow(/maxSteps/);
  });

  it("왕복 동일성: serialize→deserialize 후 실행해도 최종 세션 상태가 같다", () => {
    const program = counterLoopProgram("var_loop_counter", "var_loop_after", 4);
    const registerVariables = (project: { variables: { id: string; name: string }[] }) => {
      project.variables.push(
        { id: "var_loop_counter", name: "계약 카운터" },
        { id: "var_loop_after", name: "계약 이후" }
      );
    };

    const original = runCommandContract(program);
    const restored = runCommandContract(roundtripCommands(program, registerVariables));

    expect(restored.session).toEqual(original.session);
    expect(restored.finished).toBe(true);
    expect(original.session.variables.var_loop_counter).toBe(4);
  });

  it("pause 의미론: loop/breakLoop 는 non-blocking — pause 가 발생하지 않는다", () => {
    const result = runCommandContract(counterLoopProgram("counter", "after", 5));

    expect(result.pauses).toEqual([]);
    expect(result.finished).toBe(true);
  });
});
