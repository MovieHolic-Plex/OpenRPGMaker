// 2026-10-31 실조수(Opus) 데모에서 나온 스크립트 후속 수리를 고정한다.
// - 끝맺음 게임 검사가 스크립트의 game.shake/flash/playBgm 을 「명령 없음」으로 오판했다.
// - 모델이 game.player().facing 을 추측했다(필드는 direction) — 치트시트에 타입이 없었다.
// - showEmote/showAnimation 의 'this' 대상.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { gameContentProblems } from "@/ai/v2/gameChecks";
import { runTodoCheck } from "@/ai/v2/todo/checks";
import { buildGameApiDts, scriptApiCheatSheet } from "@/project/script/dts";
import type { Command, GameEvent, Project } from "@/project/types";

function withScriptEvent(project: Project, source: string, name = "레버"): Project {
  const p = structuredClone(project);
  const map = Object.values(p.maps)[0]!;
  const script = { kind: "script", source, compiled: "/* compiled */", summary: "" } as unknown as Command;
  map.events = [...(map.events ?? []), {
    id: "ev_lever", name, x: 3, y: 3, trigger: "action",
    pages: [{ id: "p1", name: "", conditions: [], trigger: "action", priority: "same", commands: [script] }],
  } as unknown as GameEvent];
  return p;
}

describe("script follow-ups from the live assistant run", () => {
  const before = createBlankProject() as Project;
  const shakeTask = "레버를 틀리면 화면이 흔들려";

  it("a script that calls game.shake satisfies the shake check", () => {
    const after = withScriptEvent(before, "await game.shake(6, 40);");
    expect(gameContentProblems(before, after, shakeTask).some((p) => p.includes("흔들림"))).toBe(false);
  });

  it("a script without a shake still gets the shake check", () => {
    const after = withScriptEvent(before, "await game.showMessage('clunk');");
    expect(gameContentProblems(before, after, shakeTask).some((p) => p.includes("흔들림"))).toBe(true);
  });

  it("the cheat sheet lists helper types, so field names are not guessed", () => {
    const sheet = scriptApiCheatSheet();
    expect(sheet).toContain("## Types");
    expect(sheet).toMatch(/interface PlayerInfo \{[^}]*direction: Direction/);
    expect(sheet).toContain("type EmoteName =");
    expect(sheet).toContain("interface GameClock");
  });

  it("showEmote and showAnimation accept 'this' in the typed API", () => {
    const dts = buildGameApiDts();
    expect(dts).toMatch(/showEmote\(target: 'player' \| 'this' \| EventId/);
    expect(dts).toContain('type AnimTarget = "player" | "this" | EventId');
  });

  it("a todo talk check reads game.showMessage lines inside a script", () => {
    const after = withScriptEvent(before, "const p = 80;\nawait game.showMessage(`포션은 ${p}골드예요.`, { speaker: \"포션 상인\" });", "포션 상인");
    const result = runTodoCheck(after, { kind: "talk", who: "포션 상인", says: "골드예요" });
    expect(result.pass).toBe(true);
  });
});
