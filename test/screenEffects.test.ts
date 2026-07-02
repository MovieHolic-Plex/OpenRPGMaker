import { describe, it, expect } from "vitest";
import { createInterpreter } from "@/player/interpreter";
import { screenColorToRgb, clampMs } from "@/player/interpreter/commandCatalog";
import { M2_COMMAND_CATALOG } from "@/editor/eventCommands/m2Catalog";
import type { Command, M2CommandFields } from "@/project/types";
import type { PlaySessionLike } from "@/player/types";

function mkSession(): PlaySessionLike {
  return {
    flags: {},
    switches: {},
    variables: {},
    timers: {},
    gold: 0,
    inventory: {},
    partyActorIds: [],
    actorExperience: {},
    actorLevels: {},
    actorEquipment: {},
    actorVitals: {},
    currentMapId: "m1",
    x: 0,
    y: 0,
    audio: {},
    pictures: {},
  };
}

function modernM2Command(title: string, fields: M2CommandFields = {}): Command {
  const entry = M2_COMMAND_CATALOG.find((candidate) => candidate.title === title);
  if (!entry) throw new Error(`missing catalog entry for ${title}`);
  return { kind: "m2Command", commandId: entry.id, fields };
}

// flashScreen/shakeScreen 은 인터프리터가 pause 로 반환하므로 resume 으로 넘긴다.
// tint/hide screen 은 pause 없이 내부에서 상태 기록 후 바로 다음 명령으로 간다.
function drainScreenCommands(commands: Command[], session: PlaySessionLike): void {
  const interp = createInterpreter(commands, session);
  let r = interp.start();
  let guard = 0;
  while (r.kind !== "done" && guard++ < 1000) {
    if (r.kind === "flashScreen" || r.kind === "shakeScreen") {
      r = interp.resume(undefined);
    } else if (r.kind === "text" || r.kind === "wait") {
      r = interp.resume(undefined);
    } else {
      break;
    }
  }
}

describe("화면 효과 — 인터프리터", () => {
  it("Flash Screen 명령이 flashScreen StepResult 를 반환한다", () => {
    const session = mkSession();
    const interp = createInterpreter(
      [modernM2Command("Flash Screen", { color: "red", durationMs: 500 })],
      session
    );
    const r = interp.start();

    expect(r.kind).toBe("flashScreen");
    if (r.kind === "flashScreen") {
      expect(r.red).toBe(255);
      expect(r.green).toBe(0);
      expect(r.blue).toBe(0);
      expect(r.durationMs).toBe(500);
    }
  });

  it("Shake Screen 명령이 shakeScreen StepResult 를 반환한다", () => {
    const session = mkSession();
    const interp = createInterpreter(
      [modernM2Command("Shake Screen", { intensity: 6, durationMs: 700 })],
      session
    );
    const r = interp.start();

    expect(r.kind).toBe("shakeScreen");
    if (r.kind === "shakeScreen") {
      expect(r.intensity).toBe(6);
      expect(r.durationMs).toBe(700);
    }
  });

  it("Flash/Shake 효과 후 다음 명령이 정상 실행된다", () => {
    const session = mkSession();
    const commands: Command[] = [
      modernM2Command("Flash Screen", { color: "white" }),
      { kind: "setVariable", variableId: "v", op: "=", value: 1 },
    ];

    drainScreenCommands(commands, session);

    expect(session.variables.v).toBe(1);
  });

  it("Tint Screen 이 m2Runtime.screen.tint 에 색상을 기록한다", () => {
    const session = mkSession();
    drainScreenCommands([modernM2Command("Tint Screen", { color: "blue" })], session);

    expect(session.m2Runtime?.screen.tint).toBe("blue");
  });

  it("Tint Screen 의 value(r,g,b)가 color 보다 우선한다", () => {
    const session = mkSession();
    drainScreenCommands(
      [modernM2Command("Tint Screen", { color: "blue", value: "255,128,0" })],
      session
    );

    expect(session.m2Runtime?.screen.tint).toBe("255,128,0");
  });

  it("Hide Screen 이 m2Runtime.screen.hidden = true 를 기록한다", () => {
    const session = mkSession();
    drainScreenCommands([modernM2Command("Hide Screen")], session);

    expect(session.m2Runtime?.screen.hidden).toBe(true);
  });

  it("Show Screen 이 hidden 상태를 해제한다", () => {
    const session = mkSession();
    drainScreenCommands(
      [modernM2Command("Hide Screen"), modernM2Command("Show Screen")],
      session
    );

    expect(session.m2Runtime?.screen.hidden).toBe(false);
  });
});

describe("화면 효과 — 헬퍼", () => {
  it("screenColorToRgb 가 색 이름을 RGB 로 변환한다", () => {
    expect(screenColorToRgb("red")).toEqual({ red: 255, green: 0, blue: 0 });
    expect(screenColorToRgb("white")).toEqual({ red: 255, green: 255, blue: 255 });
  });

  it("screenColorToRgb 가 hex 를 RGB 로 변환한다", () => {
    expect(screenColorToRgb("#ff8800")).toEqual({ red: 255, green: 136, blue: 0 });
    expect(screenColorToRgb("00ff00")).toEqual({ red: 0, green: 255, blue: 0 });
  });

  it("clampMs 가 지속시간을 안전 범위로 묶는다", () => {
    expect(clampMs(300)).toBe(300);
    expect(clampMs(0)).toBe(300);
    expect(clampMs(-10)).toBe(300);
    expect(clampMs(99999)).toBe(5000);
    expect(clampMs(50)).toBe(50);
  });
});
