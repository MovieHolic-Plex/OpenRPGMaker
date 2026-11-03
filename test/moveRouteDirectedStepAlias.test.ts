// 걸음 kind 에 방향을 붙여 쓴 이동 경로({kind:"turnUp"}) — 컷신 전체가 「알 수 없는 move command kind」로 거절되던 것
// (2026-11-03 조수 대조 B1 감방, Opus 5.5 patch_event_page).
import { describe, expect, it } from "vitest";
import { canonicalizeCommandFieldAlias } from "@/project/eventCommands/commandFieldAliases";

describe("이동 경로의 방향 붙은 걸음 kind", () => {
  it("turnUp·moveLeft·faceDown·step_right 를 {kind,dir} 로 옮긴다", () => {
    const command: Record<string, unknown> = {
      kind: "moveEvent", eventId: "ev_rino",
      route: { moves: [{ kind: "move", dir: "left" }, { kind: "moveLeft" }, { kind: "turnUp" }, { kind: "faceDown" }, { kind: "step_right" }], wait: true },
    };
    expect(canonicalizeCommandFieldAlias(command)).toContain("route 객체로");
    expect((command.route as { moves: unknown[] }).moves).toEqual([
      { kind: "move", dir: "left" }, { kind: "move", dir: "left" }, { kind: "turn", dir: "up" }, { kind: "turn", dir: "down" }, { kind: "move", dir: "right" },
    ]);
    expect((command.route as { wait?: boolean }).wait).toBe(true);
  });

  it("dir 이 이미 있거나 뜻이 다른 kind 는 그대로 둔다", () => {
    const kept: Record<string, unknown> = { kind: "moveEvent", eventId: "e", route: { moves: [{ kind: "turnUp", dir: "down" }, { kind: "turnRandom" }], repeat: false } };
    expect(canonicalizeCommandFieldAlias(kept)).toBeUndefined();
    expect((kept.route as { moves: unknown[] }).moves).toEqual([{ kind: "turnUp", dir: "down" }, { kind: "turnRandom" }]);
  });
});

describe("다른 엔진식 한 걸음 명령", () => {
  it("moveActor turn/move 를 한 칸 moveEvent 로, setEventLocation 을 placeAt 경로로 옮긴다", () => {
    const turn: Record<string, unknown> = { kind: "moveActor", target: "@player", action: "turn", dir: "down" };
    expect(canonicalizeCommandFieldAlias(turn)).toContain("moveActor");
    expect(turn).toEqual({ kind: "moveEvent", eventId: "@player", route: { moves: [{ kind: "turn", dir: "down" }], repeat: false, wait: true } });
    const place: Record<string, unknown> = { kind: "setEventLocation", eventId: "rino", x: 4, y: 12 };
    canonicalizeCommandFieldAlias(place);
    expect(place).toEqual({ kind: "moveEvent", eventId: "rino", route: { moves: [{ kind: "placeAt", x: 4, y: 12 }], repeat: false, wait: true } });
  });

  it("다른 맵으로 옮기거나 방향이 없으면 그대로 둔다", () => {
    const other: Record<string, unknown> = { kind: "setEventLocation", eventId: "rino", mapId: "m2", x: 1, y: 1 };
    expect(canonicalizeCommandFieldAlias(other)).toBeUndefined();
    const vague: Record<string, unknown> = { kind: "moveActor", target: "@player", action: "jump" };
    expect(canonicalizeCommandFieldAlias(vague)).toBeUndefined();
  });
});
