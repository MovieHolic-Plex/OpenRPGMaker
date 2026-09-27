import { describe, expect, it } from "vitest";
import { runTool, type ToolContext } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { isPassable } from "@/project/collision";
import { mapTexture } from "@/project/mapTexture";
import type { GameMap, Project } from "@/project/types";

describe("place_examine_hotspots 보이지 않는 조사 지점", () => {
  it("그림 생략·투명 명시 모두 대체 그림 없이 투명으로 두고 빈 바닥 경고", () => {
    const ctx = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    const res = runTool(ctx, "place_examine_hotspots", {
      mapId,
      hotspots: [
        { at: { x: 3, y: 3 }, name: "메멘토: 낡은 턴테이블", lines: ["바늘이 멈춰 있다."] },
        { at: { x: 4, y: 3 }, name: "숨은 쪽지", lines: ["글씨"], graphic: { transparent: true } },
        { at: { x: 5, y: 3 }, name: "보물 상자", lines: ["비어 있다."], graphic: { query: "보물 상자" } },
      ],
    });
    expect(res.ok, res.summary).toBe(true);
    expect(res.summary).toContain("2개는 빈 바닥 위 투명");
    const notes = JSON.stringify(res.warnings ?? res.diff);
    expect(notes).not.toContain("보석 표식");
    expect(notes).toContain("메멘토: 낡은 턴테이블");
    expect(notes).toContain("숨은 쪽지");
    expect(notes).not.toContain("보물 상자,");
    const turntable = ctx.project.maps[mapId]!.events.find((event) => event.pages?.[0]?.name === "메멘토: 낡은 턴테이블");
    expect(turntable?.pages?.[0]?.graphic).toEqual({ transparent: true });
  });
});

/** 지배 바닥이면서 통행 가능·비어 있는 칸 — 게임 검사 dream-invisible-objects 와 같은 기준. */
function barePassableCell(project: Project, taken: ReadonlySet<string>): { x: number; y: number } {
  const map = project.maps[project.startMapId]!;
  const texture = mapTexture(map);
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const index = y * map.width + x;
      if (map.lowerTiles[index] === texture.dominantTile && !(map.upperTiles[index] > 0)
        && isPassable(project, map, x, y) && !taken.has(`${x},${y}`)) return { x, y };
    }
  }
  throw new Error("빈 판 통행 가능 칸을 찾지 못했습니다");
}

function occupy(map: GameMap, at: { x: number; y: number }): ReadonlySet<string> {
  return new Set([...map.events.map((event) => `${event.x},${event.y}`), `${at.x},${at.y}`]);
}

describe("upsert_event 맨바닥 조사 사물", () => {
  it("이름에 맞는 그림이 없는 조사 사물(제단)은 보석 등 대체 그림 없이 투명 + 경고", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    const at = barePassableCell(ctx.project, new Set(ctx.project.maps[mapId]!.events.map((event) => `${event.x},${event.y}`)));
    const res = runTool(ctx, "upsert_event", {
      mapId,
      event: { id: "ev_truth_altar", name: "고대 진실의 제단", x: at.x, y: at.y, trigger: { kind: "action" }, commands: [{ kind: "text", body: "제단에 글씨가 새겨져 있다." }] },
    });
    expect(res.ok, res.summary).toBe(true);
    const event = ctx.project.maps[mapId]!.events.find((entry) => entry.id === "ev_truth_altar");
    expect(event?.pages?.[0]?.graphic?.sprite).toBeUndefined();
    expect(event?.pages?.[0]?.graphic?.transparent).toBe(true);
    expect(event?.pages?.[0]?.priority).toBe("below");
    const notes = (res.diff?.warnings ?? []).join(" ");
    expect(notes).toContain("보이지 않습니다");
    expect(notes).not.toContain("보석 표식");
  });

  it("명시 graphic:{transparent:true} 는 의도로 받아 투명 그대로", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    const at = barePassableCell(ctx.project, new Set(ctx.project.maps[mapId]!.events.map((event) => `${event.x},${event.y}`)));
    const res = runTool(ctx, "upsert_event", {
      mapId,
      event: {
        id: "ev_invisible_note", x: at.x, y: at.y, trigger: { kind: "action" },
        pages: [{ conditions: [], graphic: { transparent: true }, commands: [{ kind: "text", body: "보이지 않는 기록." }] }],
      },
    });
    expect(res.ok, res.summary).toBe(true);
    const event = ctx.project.maps[mapId]!.events.find((entry) => entry.id === "ev_invisible_note");
    expect(event?.pages?.[0]?.graphic?.transparent).toBe(true);
    expect(event?.pages?.[0]?.graphic?.sprite).toBeUndefined();
  });

  it("그 칸에 위층 장식이 있으면(사물 타일이 그림) 투명으로 남고 경고만 한다", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    const map = ctx.project.maps[mapId]!;
    const taken = new Set(map.events.map((event) => `${event.x},${event.y}`));
    const at = barePassableCell(ctx.project, taken);
    // 위층 칸 하나를 골라 통행성까지 유지하는 장식 타일을 찾는다(통행을 깨면 이벤트가 다른 칸으로 옮겨 간다).
    const index = at.y * map.width + at.x;
    const original = map.upperTiles[index]!;
    let decor = original;
    for (let tile = 1; tile < 600; tile++) {
      if (tile === original) continue;
      map.upperTiles[index] = tile;
      if (isPassable(ctx.project, map, at.x, at.y)) { decor = tile; break; }
    }
    expect(decor).not.toBe(original);
    const res = runTool(ctx, "upsert_event", {
      mapId,
      event: { id: "ev_tiled_statue", x: at.x, y: at.y, trigger: { kind: "action" }, commands: [{ kind: "text", body: "타일 위 석상." }] },
    });
    expect(res.ok, res.summary).toBe(true);
    // runTool 은 ctx.project 를 새 객체로 바꾼다 — 이전에 들고 있던 지도로는 결과가 안 보인다(핸드오프 함정).
    const stored = ctx.project.maps[mapId]!;
    const event = stored.events.find((entry) => entry.id === "ev_tiled_statue");
    expect(event?.pages?.[0]?.graphic?.sprite).toBeUndefined();
    expect(event?.pages?.[0]?.graphic?.transparent).toBe(true);
    expect((res.diff?.warnings ?? []).join(" ")).toContain("보이지 않습니다");
    expect((res.diff?.warnings ?? []).join(" ")).not.toContain("보석 표식");
  });
});
