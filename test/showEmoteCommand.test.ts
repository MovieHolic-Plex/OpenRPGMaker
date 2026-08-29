// showEmote 명령 계약 — 저장 왕복, 표시 시간 클램프, 대상 해석, 자동 이모트 매핑.
import { describe, expect, it } from "vitest";
import { createInterpreter } from "@/player/interpreter";
import { createBlankProject } from "@/project/defaults";
import {
  clampEmoteDurationMs,
  EMOTE_DEFAULT_DURATION_MS,
  EMOTE_MAX_DURATION_MS,
  EMOTE_MIN_DURATION_MS,
  friendshipDeltaEmote,
  giftRankEmote,
} from "@/project/emotes";
import { deserialize, serialize } from "@/project/io";
import { ProjectFormatError } from "@/project/io/errors";
import { validateCommandArray } from "@/project/io/shapeCommandFields";
import { startSession } from "@/project/session";
import type { Command, GameEvent, Project } from "@/project/types";

function projectWithCommands(commands: readonly Command[]): Project {
  const project = createBlankProject();
  const mapId = project.startMapId;
  const event: GameEvent = {
    id: "ev_emote",
    x: 1,
    y: 1,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      {
        id: "p1",
        name: "이모트",
        conditions: [],
        graphic: {},
        trigger: { kind: "action" },
        priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [...commands],
      },
    ],
  };
  project.maps[mapId]!.events = [
    event,
    { id: "ev_partner", x: 2, y: 1, trigger: { kind: "action" }, commands: [] },
  ];
  return project;
}

function firstStep(command: Command) {
  const project = projectWithCommands([command]);
  const interpreter = createInterpreter([command], startSession(project), project, { currentEventId: "ev_emote" });
  return interpreter.start();
}

describe("showEmote 명령", () => {
  it("shape 검증이 어휘 밖 이모트를 거부한다", () => {
    expect(() =>
      validateCommandArray("cmds", [{ kind: "showEmote", target: "player", emote: "heart" }])
    ).not.toThrow();
    expect(() =>
      validateCommandArray("cmds", [{ kind: "showEmote", target: { eventId: "ev_a" }, emote: "heart", durationMs: 900 }])
    ).not.toThrow();
    expect(() =>
      validateCommandArray("cmds", [{ kind: "showEmote", target: "player", emote: "banana" }])
    ).toThrow(ProjectFormatError);
    expect(() =>
      validateCommandArray("cmds", [{ kind: "showEmote", target: {}, emote: "heart" }])
    ).toThrow(ProjectFormatError);
  });

  it("저장 → 불러오기 왕복에서 필드가 살아남는다", () => {
    const command: Command = {
      kind: "showEmote",
      target: { eventId: "ev_partner" },
      emote: "question",
      durationMs: 800,
    };
    const restored = deserialize(serialize(projectWithCommands([command])));
    const page = restored.maps[restored.startMapId]?.events[0]?.pages?.[0];
    expect(page?.commands[0]).toEqual(command);
  });

  it("인터프리터가 표시 시간을 클램프해서 씬 단계로 넘긴다", () => {
    expect(firstStep({ kind: "showEmote", target: "player", emote: "heart" })).toMatchObject({
      kind: "showEmote",
      target: "player",
      emote: "heart",
      durationMs: EMOTE_DEFAULT_DURATION_MS,
    });
    expect(firstStep({ kind: "showEmote", target: "player", emote: "heart", durationMs: 1 })).toMatchObject({
      durationMs: EMOTE_MIN_DURATION_MS,
    });
    expect(firstStep({ kind: "showEmote", target: "player", emote: "heart", durationMs: 999_999 })).toMatchObject({
      durationMs: EMOTE_MAX_DURATION_MS,
    });
  });

  it("빈 eventId 는 명령을 실행한 이벤트를 뜻한다(showAnimation 과 같은 규약)", () => {
    expect(firstStep({ kind: "showEmote", target: { eventId: "" }, emote: "smile" })).toMatchObject({
      target: { eventId: "" },
    });
  });

  it("표시 시간 클램프는 비정상 입력도 기본값으로 되돌린다", () => {
    expect(clampEmoteDurationMs(undefined)).toBe(EMOTE_DEFAULT_DURATION_MS);
    expect(clampEmoteDurationMs(Number.NaN)).toBe(EMOTE_DEFAULT_DURATION_MS);
    expect(clampEmoteDurationMs(1200.9)).toBe(1200);
  });

  it("선물 등급과 호감도 변화가 이모트로 매핑된다", () => {
    expect(giftRankEmote("loved")).toBe("heart");
    expect(giftRankEmote("liked")).toBe("smile");
    expect(giftRankEmote("neutral")).toBe("ellipsis");
    expect(giftRankEmote("disliked")).toBe("anger");
    expect(friendshipDeltaEmote(5)).toBe("heart");
    expect(friendshipDeltaEmote(-5)).toBe("anger");
    expect(friendshipDeltaEmote(0)).toBe("ellipsis");
  });
});
