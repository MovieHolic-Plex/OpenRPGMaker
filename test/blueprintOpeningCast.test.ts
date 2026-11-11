// 청사진 기본 오프닝(bp-open-*) — 맵 조각만 넘기던 장면에 그 맵에 선 사람·끝까지 남는 자막을 넣고, 첫 순간을 덮던 전환을 뺀다.
// 2026-11-11 Terra 네 판 장부: «인물이 한 명도 없고 대사 상자도 없이 맵 일부만», «시작 프레임이 붉은 점무늬».
import { describe, expect, it } from "vitest";
import { applyBlueprintOpening } from "@/editor/tools/blueprintOpening";
import { createBlankProject } from "@/project/defaults";

type Layer = { id: string; kind: string; role?: string; x: number; y: number; width: number; height: number; walk?: { holdFrame?: number; frames: number[] }; caption?: { fadeOutMs?: number; cues: { text: string }[] } };
type Scene = { id: string; composition: { height: number; letterbox?: number; transition?: { kind: string }; layers: Layer[] } };

function fixture() {
  const project = createBlankProject();
  const map = project.maps[project.startMapId]!;
  map.lowerTiles[3] = (map.lowerTiles[0] ?? 0) + 1; // 그릴 것이 있는 맵
  const person = (id: string, x: number, y: number, pattern: number, conditions: unknown[] = []) =>
    ({ id, name: id, x, y, pages: [{ conditions, graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" }, direction: "down", pattern }, trigger: "action", commands: [] }] });
  // 맨 아래 줄에 선 촌장(자막 띠에 가려지던 자리)과, 스위치가 켜진 뒤에야 나타나는 사람.
  map.events.push(person("ev_elder", 6, map.height - 1, 31) as never, person("ev_later", 8, 6, 79, [{ kind: "switch", switchId: "sw_later", value: true }]) as never);
  project.gameBlueprint = {
    title: "시험", genre: "모험", playerGoal: "촌장과 이야기하고 샘을 되살리자.", places: [{ name: map.name }],
    steps: [{ id: "s1", kind: "talk", place: map.name, action: "촌장에게 샘의 사연을 듣는다", feeling: "따뜻한 마을에 닥친 위기" }], ending: { name: "끝", how: "샘이 돌아왔다." },
  } as never;
  return project;
}

describe("청사진 기본 오프닝 — 선 사람·자막·전환", () => {
  it("장면마다 cut 으로 들어오고, 자막이 장면 끝까지 남는다", () => {
    const project = fixture();
    expect(applyBlueprintOpening(project)).toHaveLength(1);
    const scenes = (project.system.opening?.scenes ?? []) as unknown as Scene[];
    expect(scenes.length).toBeGreaterThanOrEqual(2);
    for (const scene of scenes) {
      expect(scene.id.startsWith("bp-open-"), scene.id).toBe(true);
      expect(scene.composition.transition?.kind, scene.id).toBe("cut");
      const caption = scene.composition.layers.find((l) => l.kind === "caption");
      expect(caption?.caption?.cues[0]?.text, scene.id).toBeTruthy();
      expect(caption?.caption?.fadeOutMs, scene.id).toBe(0);
    }
  }, 60_000);

  it("그 맵에 처음부터 선 사람을 제 칸에 세운다 — 맨 아래 줄의 사람도 자막 띠 위에 보이고, 나중에 나타나는 사람은 없다", () => {
    const project = fixture();
    applyBlueprintOpening(project);
    const scenes = (project.system.opening?.scenes ?? []) as unknown as Scene[];
    const first = scenes[0]!.composition;
    const bar = Math.ceil(first.height * (first.letterbox ?? 0));
    const bg = first.layers.find((l) => l.role === "background")!;
    // 배경은 자막 띠 사이에만 깔린다.
    expect([bg.y, bg.height]).toEqual([bar, first.height - 2 * bar]);
    const people = first.layers.filter((l) => l.role === "actor");
    expect(people.map((l) => l.walk?.holdFrame)).toEqual([31]);
    expect(people[0]!.walk?.frames).toEqual([31]); // 서 있는 한 칸(걷는 연기 없음)
    expect(people[0]!.y + people[0]!.height).toBeLessThanOrEqual(first.height - bar);
    expect(people[0]!.y).toBeGreaterThanOrEqual(bar);
    // 마지막 장면에는 주인공이 시작 칸에 선다.
    const last = scenes[scenes.length - 1]!.composition.layers;
    expect(last.some((l) => l.id === "hero" && l.role === "actor")).toBe(true);
  }, 60_000);
});
