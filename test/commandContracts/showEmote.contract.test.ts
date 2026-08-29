// test/commandContracts/showEmote.contract.test.ts
// G1 계약: showEmote (정수리 이모트).
//
// 실측 메모: 이모트는 씬 표면 명령이라 인터프리터가 pause 로 넘기고 씬이 즉시 재개한다
// (showAnimation 의 wait:false 와 같은 등급). 세션 상태를 바꾸지 않으므로 계약은
// "어떤 단계를 어떤 값으로 넘기는가" 와 "저장 왕복" 에 걸린다.
import { describe, expect, it } from "vitest";
import { EMOTE_DEFAULT_DURATION_MS, EMOTE_MAX_DURATION_MS } from "@/project/emotes";
import type { StepResult } from "@/player/interpreter/types";
import type { Command } from "@/project/types";
import { CONTRACT_EVENT_ID, roundtripCommands, runCommandContract } from "./harness";

describe("showEmote 계약", () => {
  it("정상 효과: 이모트 단계를 넘기고 세션 상태는 건드리지 않는다", () => {
    const result = runCommandContract([
      { kind: "showEmote", target: "player", emote: "heart", durationMs: 900 },
      { kind: "setSwitch", switchId: "after_emote", value: true },
    ]);

    expect(result.session.switches.after_emote).toBe(true);
    expect(result.session.selfSwitches).toBeUndefined();
    expect(result.warnings).toEqual([]);
    expect(result.finished).toBe(true);
  });

  it("경계: 표시 시간이 없으면 기본값, 범위를 넘으면 상한으로 잘린다", () => {
    const stepOf = (command: Command): Extract<StepResult, { kind: "showEmote" }> => {
      const emoteStep = runCommandContract([command]).pauses.find((step) => step.kind === "showEmote");
      expect(emoteStep, "showEmote 단계가 흘러나와야 한다").toBeDefined();
      return emoteStep as Extract<StepResult, { kind: "showEmote" }>;
    };

    expect(stepOf({ kind: "showEmote", target: "player", emote: "smile" }).durationMs).toBe(
      EMOTE_DEFAULT_DURATION_MS
    );
    expect(
      stepOf({ kind: "showEmote", target: "player", emote: "smile", durationMs: 10_000_000 }).durationMs
    ).toBe(EMOTE_MAX_DURATION_MS);
  });

  it("대상 규약: 빈 eventId 는 실행 중인 이벤트를 뜻하고 그대로 씬에 전달된다", () => {
    const result = runCommandContract([{ kind: "showEmote", target: { eventId: "" }, emote: "question" }]);
    const emoteStep = result.pauses.find((step) => step.kind === "showEmote");

    expect(emoteStep).toMatchObject({ target: { eventId: "" }, emote: "question" });
    expect(CONTRACT_EVENT_ID).toBeTruthy();
    expect(result.finished).toBe(true);
  });

  it("저장 왕복: target·emote·durationMs 가 보존된다", () => {
    const commands: Command[] = [
      { kind: "showEmote", target: "player", emote: "music", durationMs: 700 },
      { kind: "showEmote", target: { eventId: "ev_partner" }, emote: "anger" },
    ];

    expect(roundtripCommands(commands)).toEqual(commands);
  });
});
