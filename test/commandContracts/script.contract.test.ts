// test/commandContracts/script.contract.test.ts
// 계약: script (TypeScript 를 컴파일한 JS 를 QuickJS 샌드박스에서 실행).
//
// 실측 메모:
// - 동기 game 호출(setSwitch·addGold…)은 같은 명령의 효과를 그대로 낸다.
// - await 하는 호출은 보통 명령으로 바뀌어 자식 프레임으로 돈다 — text/choices/wait pause 가 그대로 보인다.
// - 오류는 게임을 멈추지 않는다: "[Script error] …" 글 한 번 뒤 다음 명령으로 진행한다.
// - 컴파일 결과(compiled)가 비면 아무 일 없이 지나간다. 소스만 있고 compiled 가 없으면 오류 글.
// 컴파일러는 여기서 부르지 않는다(손으로 쓴 JS) — 컴파일 계약은 test/scriptCompile.test.ts.
import { beforeAll, describe, expect, it } from "vitest";
import type { Command } from "@/project/types";
import { preloadScriptEngine } from "@/player/script/engine";
import { roundtripCommands, runCommandContract } from "./harness";

function script(compiled: string, extra: Partial<Extract<Command, { kind: "script" }>> = {}): Command {
  return { kind: "script", source: "// ts", compiled, ...extra };
}

beforeAll(async () => {
  await preloadScriptEngine();
});

describe("script 계약", () => {
  it("정상 효과: 동기 호출은 즉시 세션을 바꾸고 다음 명령으로 진행한다", () => {
    const result = runCommandContract([
      script(`game.setSwitch("door", true); game.addGold(30); game.setVar("v", game.gold() + 1);`),
      { kind: "setSwitch", switchId: "after", value: true },
    ]);
    expect(result.session.switches).toMatchObject({ door: true, after: true });
    expect(result.session.gold).toBe(30);
    expect(result.session.variables.v).toBe(31);
    expect(result.pauses).toEqual([]);
    expect(result.finished).toBe(true);
  });

  it("pause 의미론: await 호출은 text·choices·wait pause 로 보이고 선택 결과가 스크립트로 돌아온다", () => {
    const result = runCommandContract(
      [script(`await game.showMessage("Pull which lever?"); const pick = await game.showChoices(["left", "right"]); game.setVar("pick", pick); await game.wait(60);`)],
      { answers: [undefined, 1] }
    );
    expect(result.pauses.map((pause) => pause.kind)).toEqual(["text", "choices", "wait"]);
    expect(result.pauses[0]).toMatchObject({ kind: "text", body: "Pull which lever?" });
    expect(result.pauses[2]).toMatchObject({ kind: "wait", ms: 1000 });
    expect(result.session.variables.pick).toBe(1);
    expect(result.session.variables.__script_result).toBeUndefined();
    expect(result.finished).toBe(true);
  });

  it("경계: 빈 compiled 는 지나가고, 컴파일 안 된 소스는 오류 글 뒤 진행한다", () => {
    const empty = runCommandContract([{ kind: "script", source: "", compiled: "" }]);
    expect(empty.pauses).toEqual([]);
    expect(empty.finished).toBe(true);

    const uncompiled = runCommandContract([{ kind: "script", source: "game.addGold(1)", compiled: "" }]);
    expect(uncompiled.pauses).toHaveLength(1);
    expect(uncompiled.pauses[0]).toMatchObject({ kind: "text" });
    expect(String((uncompiled.pauses[0] as { body?: string }).body)).toContain("[Script error]");
    expect(uncompiled.finished).toBe(true);
  });

  it("오류는 게임을 멈추지 않는다: 예외 → 오류 글 → 다음 명령", () => {
    const result = runCommandContract([
      script(`game.setSwitch("before", true); throw new Error("boom");`),
      { kind: "setSwitch", switchId: "after", value: true },
    ]);
    expect(result.session.switches).toMatchObject({ before: true, after: true });
    expect(result.pauses).toHaveLength(1);
    expect(String((result.pauses[0] as { body?: string }).body)).toContain("boom");
    expect(result.finished).toBe(true);
  });

  it("왕복 동일성: serialize→deserialize 후에도 같은 결과", () => {
    const commands: Command[] = [
      script(`game.addVar("count", 2); await game.showMessage("n=" + game.getVar("count"));`, {
        name: "counter",
        summary: "변수 더하기 · 대사",
        effects: { reads: [{ kind: "variable", id: "count" }], writes: [{ kind: "variable", id: "count" }], calls: [], dynamic: [] },
        sourceHash: "0123456789abcdef",
        apiVersion: 1,
      }),
    ];
    const restored = roundtripCommands(commands);
    expect(restored).toEqual(commands);
    const original = runCommandContract(commands);
    const replay = runCommandContract(restored);
    expect(replay.pauses).toEqual(original.pauses);
    expect(replay.session.variables).toEqual(original.session.variables);
  });
});
