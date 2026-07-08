import { describe, expect, it } from "vitest";
import type { Command } from "@/project/types";
import { roundtripCommands, runCommandContract } from "./harness";

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
