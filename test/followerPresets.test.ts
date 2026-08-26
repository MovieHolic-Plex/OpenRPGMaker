import { describe, expect, it } from "vitest";
import { buildFollowerPresets, followerPresetToCommands } from "@/editor/followerPresets";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { ActorRecord, Command } from "@/project/types";

/**
 * 2026-08-10 회귀 가드 — "동행" 프리셋 칩 실수 클릭 사고.
 *
 * 사고: 몬스터 프리셋 칩이 실제 파티 편입 대신 저자용 안내 showMessage 를
 * 이벤트 커맨드로 삽입했고, 저작물(네온의 유언 목격자 이벤트)에 쓰레기 커맨드가 박혔다.
 * 수정: 몬스터 칩 자체를 제거(편입 경로는 도감 → 파티 편입이 유일)하고,
 * 남은 프리셋은 항상 실제 실행 커맨드(addFollower)만 생성한다.
 */
describe("follower presets (post monster-chip removal)", () => {
  it("buildFollowerPresets never emits monster-kind chips", () => {
    const presets = buildFollowerPresets();
    // FollowerPresetKind 에 "monster" 자체가 없어졌으므로(타입 레벨 제거) 런타임 가드는
    // kind 가 항상 actor|mascot 인지 + 몬스터 id 프리픽스가 없는지로 확인한다.
    for (const p of presets) {
      expect(["actor", "mascot"]).toContain(p.kind);
    }
    expect(presets.some((p) => p.id.startsWith("preset:monster:"))).toBe(false);
  });

  it("keeps the fixed mascot presets and companion actor", () => {
    const presets = buildFollowerPresets();
    const ids = presets.map((p) => p.id);
    expect(ids).toContain("preset:pet-dog");
    expect(ids).toContain("preset:pet-cat");
    expect(ids).toContain("preset:pet-chick");
    expect(ids).toContain("preset:companion-hero");
  });

  it("lists every database actor with portrait metadata", () => {
    const project = createBlankProject();
    const template = project.database.actors[0];
    if (!template) throw new Error("missing default actor fixture");
    const actors = [
      actorFixture(template, "actor-companion-a", "세라", "easyrpg-faceset-actor1", "easyrpg-charset-actor1"),
      actorFixture(template, "actor-companion-b", "루카", "easyrpg-faceset-actor2", "easyrpg-charset-actor2"),
      actorFixture(template, "actor-companion-c", "미나", "easyrpg-faceset-actor3", "easyrpg-charset-actor3"),
      actorFixture(template, "actor-companion-d", "가온", "easyrpg-faceset-actor4", "easyrpg-charset-actor4"),
    ];
    project.database.actors = actors;
    store.replace(project);

    const presets = buildFollowerPresets().filter((preset) => preset.kind === "actor");

    expect(presets.map((preset) => preset.refId)).toEqual(actors.map((actor) => actor.id));
    expect(presets.map((preset) => preset.faceResourceId)).toEqual(actors.map((actor) => actor.faceResourceId));
    expect(presets.map((preset) => preset.characterResourceId)).toEqual(actors.map((actor) => actor.characterResourceId));
  });

  it("mascot preset converts to one addFollower with bundled graphic", () => {
    const presets = buildFollowerPresets();
    const dog = presets.find((p) => p.id === "preset:pet-dog")!;
    const cmds = followerPresetToCommands(dog);
    expect(cmds).toHaveLength(1);
    expect(cmds[0]).toMatchObject({ kind: "addFollower", name: dog.displayName });
    const graphic = (cmds[0] as { graphic?: { sprite?: { type?: string; id?: string } } }).graphic;
    expect(graphic?.sprite?.type).toBe("bundled");
    expect(graphic?.sprite?.id).toBeTruthy();
  });

  it("actor preset converts to one addFollower with actorId", () => {
    const presets = buildFollowerPresets();
    const hero = presets.find((p) => p.id === "preset:companion-hero")!;
    const cmds = followerPresetToCommands(hero);
    expect(cmds).toHaveLength(1);
    expect(cmds[0]).toMatchObject({ kind: "addFollower", actorId: hero.refId });
  });

  it("never inserts showMessage author guidance for any built preset", () => {
    // 핵심 불변식: 프리셋 칩은 실제 실행 커맨드만 생성한다.
    // 저자용 안내(도감 경로 안내 등)가 게임 콘텐츠로 흘러들어가면 안 된다.
    const presets = buildFollowerPresets();
    expect(presets.length).toBeGreaterThan(0);
    for (const preset of presets) {
      const cmds = followerPresetToCommands(preset);
      expect(cmds.length).toBeGreaterThan(0);
      for (const cmd of cmds) {
        expect((cmd as Command).kind).not.toBe("showMessage");
      }
    }
  });
});

function actorFixture(
  template: ActorRecord,
  id: ActorRecord["id"],
  name: string,
  faceResourceId: string,
  characterResourceId: string,
): ActorRecord {
  return {
    ...structuredClone(template),
    id,
    name,
    faceResourceId,
    faceIndex: 0,
    characterResourceId,
    characterIndex: 0,
  };
}
