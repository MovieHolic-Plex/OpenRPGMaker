import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { lintSceneStaging } from "@/project/lint/sceneStagingLint";
import type { Command, EventPage, GameEvent, Project } from "@/project/types";

// 첫사랑 r7 재회: 지후가 서하 두 칸 «아래»(같은 열)에 서서 배율 2 장면이 지후 뒤통수만 찍었다 — 같은 열 세로 1~2칸을 경고한다.
function page(commands: Command[], extra: Partial<EventPage> = {}): EventPage {
  return {
    id: `p${Math.random().toString(36).slice(2, 7)}`, name: "", conditions: [], graphic: { sprite: { type: "bundled", id: "Actor1" } },
    trigger: { kind: "action" }, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands, ...extra,
  } as unknown as EventPage;
}
const ev = (id: string, x: number, y: number, pages: EventPage[], name = id): GameEvent => ({ id, name, x, y, pages } as unknown as GameEvent);
const text = (speaker: string, body: string): Command => ({ kind: "text", speaker, body, position: "bottom" } as unknown as Command);

/** 서하(ev_a)가 지후(ev_b)에게 말한다 — 두 사람의 칸만 바꿔 경고가 나는지 본다. */
function stackedCodes(a: { x: number; y: number }, b: { x: number; y: number }): string[] {
  const project: Project = createBlankProject();
  const map = Object.values(project.maps)[0]!;
  map.events = [
    ev("ev_a", a.x, a.y, [page([{ kind: "text", speaker: "서하", body: "안녕하세요.", position: "bottom", addressee: "ev_b" } as unknown as Command, text("지후", "…네.")])], "서하"),
    ev("ev_b", b.x, b.y, [page([])], "지후"),
  ];
  return lintSceneStaging(project).filter((i) => i.code === "scene-talk-stacked").map((i) => i.code);
}

describe("scene-talk-stacked — 위·아래 한 열로 서서 말하면 경고", () => {
  it("바로 아래 칸(세로 1)과 두 칸 아래(세로 2)는 경고", () => {
    expect(stackedCodes({ x: 5, y: 4 }, { x: 5, y: 5 })).toEqual(["scene-talk-stacked"]);
    expect(stackedCodes({ x: 5, y: 4 }, { x: 5, y: 6 })).toEqual(["scene-talk-stacked"]);
  });
  it("같은 줄 한 칸 띄운 옆(16,4)/(18,4)과 비스듬한 (16,4)/(17,6)은 경고 없음", () => {
    expect(stackedCodes({ x: 5, y: 4 }, { x: 7, y: 4 })).toEqual([]);
    expect(stackedCodes({ x: 5, y: 4 }, { x: 6, y: 6 })).toEqual([]);
  });
});
