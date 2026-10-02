import { describe, expect, it } from "vitest";
import {
  letterboxPercentFromValue,
  nextSpriteLook,
  normalizeSpriteLook,
  spriteLookKey,
} from "@/project/eventCommands/cinematicStaging";
import { planScreenEffect } from "@/player/interpreter/screenEffectPlan";
import { SCREEN_EFFECT_OPTIONS } from "@/project/eventCommands/m2ModernCatalog";
import { m2CommandById } from "@/project/eventCommands/m2Catalog";
import { compileCutscene } from "@/editor/cutscene";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults/blankProject";
import type { Command } from "@/project/types";

type M2 = Extract<Command, { kind: "m2Command" }>;
const m2Of = (commands: readonly Command[], commandId: string): M2[] =>
  commands.filter((command): command is M2 => command.kind === "m2Command" && command.commandId === commandId);

describe("모습 효과 모델", () => {
  it("준 칸만 바꾸고 나머지는 앞 모습을 잇는다", () => {
    const red = nextSpriteLook(undefined, { tint: "red", pose: "keep", flip: "keep" });
    expect(red).toEqual({ tint: "#ff6060" });
    const fallen = nextSpriteLook(red, { pose: "fallen", flip: "on" });
    expect(fallen).toEqual({ tint: "#ff6060", pose: "fallen", flip: true });
    expect(nextSpriteLook(fallen, { reset: true })).toEqual({});
    expect(nextSpriteLook(fallen, { reset: true, tint: "blue" })).toEqual({ tint: "#6080ff" });
  });

  it("직접 색이 선택지보다 앞서고, 흰색 곱하기는 효과가 아니다", () => {
    expect(nextSpriteLook(undefined, { tint: "red", tintHex: "#00FF88" })).toEqual({ tint: "#00ff88" });
    expect(normalizeSpriteLook({ tint: "#ffffff" })).toEqual({});
    expect(normalizeSpriteLook({ tint: "white", tintFill: true })).toEqual({ tint: "#ffffff", tintFill: true });
  });

  it("불투명도는 % 로 받아 0~1 로 저장하고, 1 이면 지운다", () => {
    expect(nextSpriteLook(undefined, { opacity: "60" })).toEqual({ alpha: 0.6 });
    expect(nextSpriteLook({ alpha: 0.6 }, { opacity: "100" })).toEqual({});
  });

  it("저장 키는 주인공 하나, 이벤트는 맵마다 따로", () => {
    expect(spriteLookKey({ kind: "player" })).toBe("player");
    expect(spriteLookKey({ kind: "event", mapId: "m1", eventId: "ev" })).toBe("m1/ev");
  });
});

describe("레터박스", () => {
  it("빈 값은 기본 두께, 범위 밖은 자른다, 걷기는 0", () => {
    expect(letterboxPercentFromValue("")).toBe(12);
    expect(letterboxPercentFromValue("40")).toBe(25);
    expect(planScreenEffect("letterbox", "8", 300)).toEqual({ kind: "letterbox", percent: 8, durationMs: 300 });
    expect(planScreenEffect("clearLetterbox", "", 300)).toEqual({ kind: "letterbox", percent: 0, durationMs: 300 });
  });

  it("화면 효과 선택지 전부에 렌더 경로가 있다 — 조용한 실패 없음", () => {
    for (const option of SCREEN_EFFECT_OPTIONS) expect(planScreenEffect(option.value, "", 300).kind).not.toBe("unsupported");
  });
});

describe("새 명령 카탈로그", () => {
  it("파티클·모습 효과가 카탈로그에 있고 흔들기에 방향 칸이 있다", () => {
    expect(m2CommandById("m2-224-particle-effect")?.title).toBe("Particle Effect");
    expect(m2CommandById("m2-225-sprite-look")?.title).toBe("Sprite Look");
    expect(m2CommandById("m2-048-shake-screen")?.fields.some((field) => field.key === "direction")).toBe(true);
  });
});

describe("컷신 연출 비트", () => {
  it("letterbox 는 정리 단계가 자동으로 걷고, keep 이면 남긴다", () => {
    const auto = compileCutscene([{ kind: "letterbox" }, { kind: "say", speaker: "A", text: "…" }]);
    const effects = m2Of(auto, "m2-202-screen-effect").map((command) => command.fields.effect);
    expect(effects).toEqual(["letterbox", "clearLetterbox"]);
    const kept = compileCutscene([{ kind: "letterbox", size: 10, keep: true }]);
    expect(m2Of(kept, "m2-202-screen-effect").map((command) => command.fields.effect)).toEqual(["letterbox", "letterbox"]);
  });

  it("look 은 대상·포즈·색을 명령 필드로 옮기고 #rrggbb 는 직접 색 칸으로 보낸다", () => {
    const commands = compileCutscene([
      { kind: "look", target: "ev_guard", pose: "fallen", tint: "#123456" },
      { kind: "look", target: "player", afterimage: true, alpha: 0.5 },
    ]);
    const looks = m2Of(commands, "m2-225-sprite-look");
    expect(looks[0]?.fields).toMatchObject({ target: "event", eventId: "ev_guard", pose: "fallen", tintHex: "#123456" });
    expect(looks[1]?.fields).toMatchObject({ target: "player", afterimage: "on", opacity: "50" });
    // 정리 단계가 같은 명령을 순서대로 다시 건다(건너뛰어도 끝 모습이 같다).
    expect(looks).toHaveLength(4);
  });

  it("particles 는 x,y 만 주면 칸 대상, emote·weather·shake axis 는 해당 명령으로", () => {
    const commands = compileCutscene([
      { kind: "particles", preset: "explosion", x: 4, y: 5 },
      { kind: "emote", target: "player", emote: "exclamation" },
      { kind: "weather", weather: "rain", intensity: 0.7 },
      { kind: "shake", intensity: 6, axis: "vertical" },
    ]);
    expect(m2Of(commands, "m2-224-particle-effect")[0]?.fields).toMatchObject({ preset: "explosion", target: "tile", x: 4, y: 5 });
    expect(commands).toContainEqual(expect.objectContaining({ kind: "showEmote", target: "player", emote: "exclamation" }));
    expect(commands).toContainEqual(expect.objectContaining({ kind: "setWeather", weather: "rain", intensity: 0.7 }));
    expect(m2Of(commands, "m2-048-shake-screen")[0]?.fields).toMatchObject({ direction: "vertical", intensity: "6" });
  });

  it("틀린 어휘는 조용히 기본값이 되지 않고 거부된다", () => {
    expect(() => compileCutscene([{ kind: "particles", preset: "confetti" as never }])).toThrow(/파티클 종류/);
    expect(() => compileCutscene([{ kind: "look", pose: "dance" as never }])).toThrow(/자세/);
  });

  it("script_cutscene 이 새 비트를 명령 형식 오류 없이 저장한다", () => {
    const ctx = { project: createBlankProject() };
    const result = runTool(ctx, "script_cutscene", {
      mapId: ctx.project.startMapId, x: 3, y: 3, trigger: "auto", once: true,
      beats: [
        { kind: "letterbox", size: 12 },
        { kind: "emote", target: "player", emote: "exclamation", wait: true },
        { kind: "parallel", beats: [
          { kind: "particles", preset: "explosion", x: 5, y: 5 },
          { kind: "shake", intensity: 6, axis: "both" },
          { kind: "flash", color: "white" },
        ] },
        { kind: "look", target: "player", pose: "fallen", tint: "gray" },
        { kind: "say", speaker: "나", text: "…" },
        { kind: "look", target: "player", reset: true },
      ],
    });
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
  });

  it("연출 지침 도구가 등록돼 있다", () => {
    const result = runTool({ project: createBlankProject() }, "read_directing_guide", {});
    expect(result.ok).toBe(true);
    expect(JSON.stringify(result)).toContain("letterbox");
  });
});
