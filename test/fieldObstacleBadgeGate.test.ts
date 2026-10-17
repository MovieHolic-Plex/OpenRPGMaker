// place_field_obstacle: 배지·스위치 게이팅(requiresBadge/requiresSwitchId), 조사 「쓸까?」 선택지, 비전서 상자(giverX/giverY).
// 런타임 증거는 scripts/qa/runtime/monster-hm.mjs(출하 플레이어, 실제 입력). 이 파일은 도구 계약만 본다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { getTool } from "@/editor/tools";
import { isPassable } from "@/project/collision";
import type { Command, EventPage, GameEvent, Project } from "@/project/types";

/** 이 칩셋에서 upper 층에 깔면 (3,3) 이 막히는 첫 칸 번호 — 번들 칩셋 번호를 하드코딩하지 않는다. */
function blockingTile(project: Project): number {
  const map = structuredClone(project.maps[project.startMapId]!);
  const count = project.tilesets[map.tilesetId]?.count ?? 0;
  for (let tile = 1; tile < count; tile += 1) {
    map.upperTiles[3 * map.width + 3] = tile;
    if (!isPassable({ ...project, maps: { ...project.maps, [map.id]: map } }, map, 3, 3)) return tile;
  }
  throw new Error("막히는 칸이 없다");
}

function roadProject(): Project {
  const project = createBlankProject();
  const map = project.maps[project.startMapId]!;
  project.system.monsterCampaign = {
    id: "c", name: "c", speciesIds: [], speciesNotes: {}, locations: [], objectives: [],
    badges: [{ id: "badge_1", name: "새잎 배지", switchId: "mx_badge_1", cityMapId: map.id }],
  };
  return project;
}

function place(project: Project, args: Record<string, unknown>) {
  const map = project.maps[project.startMapId]!;
  const draft = structuredClone(project);
  const target = draft.maps[map.id]!;
  // 걸을 수 있는 칸 하나를 찾아 장애물 후보로 쓴다(타일셋에 자르기 칸이 없으면 tile 로 직접 지정).
  const out = getTool("place_field_obstacle")!.run(draft, { mapId: map.id, x: 3, y: 3, kind: "tree", tile: blockingTile(project), ...args } as never) as { data: Record<string, unknown>; warnings?: string[] };
  return { draft, out, map: target };
}

const flat = (commands: readonly Command[]): Command[] => commands.flatMap((c) => [c, ...(c.kind === "fork" ? [...flat(c.then), ...flat(c.else ?? [])] : []), ...(c.kind === "choices" ? c.options.flatMap((o) => flat(o.branch)) : [])]);
const pagesOf = (event: GameEvent): EventPage[] => event.pages ?? [];

describe("place_field_obstacle 배지 게이팅", () => {
  it("requiresBadge 는 캠페인 배지 스위치로 공통 이벤트 분기를 감싸고, 배지 없이 아는 파티 전용 안내 페이지를 둔다", () => {
    const { draft, out } = place(roadProject(), { requiresBadge: 1, id: "ev_gate" });
    expect(out.data.requiresSwitchIds).toEqual(["mx_badge_1"]);
    const ce = draft.commonEvents.find((entry) => entry.id === out.data.commonEventId)!;
    const forks = flat(ce.commands).filter((c) => c.kind === "fork");
    expect(forks.some((c) => c.kind === "fork" && c.condition.kind === "switch" && c.condition.switchId === "mx_badge_1")).toBe(true);
    const event = draft.maps[draft.startMapId]!.events.find((entry) => entry.id === "ev_gate")!;
    const names = pagesOf(event).map((page) => page.name);
    expect(names).toContain("기술은 알지만 조건 부족");
    const know = pagesOf(event).find((page) => page.name === "기술을 앎")!;
    expect(know.conditions.some((c) => c.kind === "switch" && c.switchId === "mx_badge_1")).toBe(true);
  });

  it("배지 조건이 없으면 조건 부족 페이지가 없고 「쓸까?」 선택지가 있다", () => {
    const { draft } = place(roadProject(), { id: "ev_free" });
    const event = draft.maps[draft.startMapId]!.events.find((entry) => entry.id === "ev_free")!;
    expect(pagesOf(event).map((page) => page.name)).not.toContain("기술은 알지만 조건 부족");
    const know = pagesOf(event).find((page) => page.name === "기술을 앎")!;
    const choices = know.commands.find((c) => c.kind === "choices");
    expect(choices && choices.kind === "choices" && choices.options.length).toBe(2);
  });

  it("requiresBadge 범위·giver 한 쪽만 준 경우는 거절한다", () => {
    expect(() => place(roadProject(), { requiresBadge: 0 })).toThrow(/배지 번호/);
    expect(() => place(roadProject(), { giverX: 4 })).toThrow(/함께/);
    expect(() => place(roadProject(), { giverX: 4, giverY: 4, machine: "none" })).toThrow(/none/);
  });

  it("giverX/giverY 는 비전서 상자 이벤트를 놓고 요약에 적는다", () => {
    const { draft, out } = place(roadProject(), { id: "ev_g", giverX: 5, giverY: 5 });
    expect(draft.maps[draft.startMapId]!.events.some((entry) => entry.id === "ev_g_giver")).toBe(true);
    expect(JSON.stringify(out)).not.toContain("누가 주는지 이어야");
  });
});
