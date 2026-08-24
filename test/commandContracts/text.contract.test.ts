// test/commandContracts/text.contract.test.ts
// G1 계약: text (스펙 §5.1 행).
//
// 실측 메모:
// - text 는 항상 text pause 를 1회 발생시킨다. 빈 body 도 스킵되지 않는다.
// - pause payload 는 speaker/body 와 함께 현재 face/messageWindowSettings 상태를 전달한다.
import { describe, expect, it } from "vitest";
import type { Command } from "@/project/types";
import { roundtripCommands, runCommandContract } from "./harness";

describe("text 계약", () => {
  it("정상 효과: speaker/body 를 text pause 로 전달하고 끝까지 진행한다", () => {
    const result = runCommandContract([{ kind: "text", speaker: "Guide", body: "Hello" }]);

    expect(result.pauses).toEqual([
      expect.objectContaining({ kind: "text", speaker: "Guide", body: "Hello" }),
    ]);
    expect(result.warnings).toEqual([]);
    expect(result.finished).toBe(true);
  });

  it("경계: 빈 body 여도 경고 없이 text pause 가 발생한다", () => {
    const result = runCommandContract([{ kind: "text", body: "" }]);

    expect(result.pauses).toEqual([expect.objectContaining({ kind: "text", body: "" })]);
    expect(result.warnings).toEqual([]);
    expect(result.finished).toBe(true);
  });

  it("연쇄: displayTextSettings/changeFace 상태가 이후 text pause 에 반영된다", () => {
    const commands: Command[] = [
      {
        kind: "displayTextSettings",
        format: "transparent",
        position: "top",
        preventObscuringPlayer: false,
        allowEventMovementDuringWait: true,
      },
      {
        kind: "changeFace",
        resourceId: "easyrpg-faceset-actor1",
        faceIndex: 2,
        position: "right",
        flipHorizontally: true,
      },
      { kind: "text", body: "configured" },
    ];

    const result = runCommandContract(commands);

    expect(result.pauses).toMatchObject([
      {
        kind: "text",
        body: "configured",
        face: {
          resourceId: "easyrpg-faceset-actor1",
          faceIndex: 2,
          position: "right",
          flipHorizontally: true,
        },
        settings: {
          format: "transparent",
          position: "top",
          preventObscuringPlayer: false,
          allowEventMovementDuringWait: true,
        },
      },
    ]);
    expect(result.finished).toBe(true);
  });

  it("왕복 동일성: serialize→deserialize 후 실행해도 pause 와 최종 세션이 같다", () => {
    const commands: Command[] = [{ kind: "text", speaker: "Round", body: "trip" }];

    const original = runCommandContract(commands);
    const restoredCommands = roundtripCommands(commands);
    expect(restoredCommands).toEqual(commands);
    const restored = runCommandContract(restoredCommands);

    expect(restored.pauses).toEqual(original.pauses);
    expect(restored.session).toEqual(original.session);
    expect(restored.finished).toBe(true);
  });

  it("pause 의미론: blocking — pause 가 정확히 1회, kind=text", () => {
    const result = runCommandContract([{ kind: "text", body: "pause" }]);

    expect(result.pauses).toHaveLength(1);
    expect(result.pauses[0]?.kind).toBe("text");
    expect(result.finished).toBe(true);
  });
});
