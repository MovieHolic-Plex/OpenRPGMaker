import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { lookMismatches, pristineFantasyHero, titleBackdropMismatch } from "@/ai/v2/lookChecks";
import { applyStorySetupDefaults } from "@/ai/v2/genreDefaults";
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { findNpcGraphicMatches } from "@/assets/charsetQuery";
import { faceLookText } from "@/assets/faceLooks";
import type { GameEvent, Project } from "@/project/types";

// 2026-10-25 조수 단독 게임 심사 J35·J30·J41·J38·J43 — 그림을 이름표가 아니라 그림 설명으로 맞댄다.

function withNpc(project: Project, name: string, commands: unknown[], sprite?: { id: string; characterIndex: number }): Project {
  const p = structuredClone(project);
  const map = Object.values(p.maps)[0]!;
  map.events = [...(map.events ?? []), {
    id: `ev_${map.events?.length ?? 0}`, name, x: 4, y: 4, trigger: "action",
    pages: [{ id: "p1", name: "", conditions: [], trigger: "action", priority: "same", commands,
      ...(sprite ? { graphic: { sprite: { type: "bundled", id: sprite.id }, direction: "down", pattern: charsetFrameIndex({ characterIndex: sprite.characterIndex, direction: "down", pattern: 1 }) } } : {}) }],
  } as unknown as GameEvent];
  return p;
}

const say = (speaker: string, faceId: string) => [
  { kind: "changeFace", resourceId: faceId },
  { kind: "text", speaker, text: "……" },
];

describe("v2 look checks: name ↔ picture (J35·J30·J41)", () => {
  const before = createBlankProject() as Project;

  it("flags a young speaker drawn with an old man's face", () => {
    const problems = lookMismatches(before, withNpc(before, "젊은 제페토", say("젊은 제페토", "easyrpg-faceset-people1-06")));
    expect(problems.some((p) => p.includes("[게임 검사 얼굴]") && p.includes("젊은 제페토"))).toBe(true);
  });

  it("flags a doll and a clockwork soldier speaking with human faces", () => {
    const doll = lookMismatches(before, withNpc(before, "마리오네트", say("오르골 인형", "easyrpg-faceset-people1-01")));
    expect(doll.some((p) => p.includes("인형"))).toBe(true);
    const soldier = lookMismatches(before, withNpc(before, "태엽 병정", say("깨어난 태엽 병정", "easyrpg-faceset-people1-00")));
    expect(soldier.some((p) => p.includes("[게임 검사 얼굴]"))).toBe(true);
    // 기계 얼굴은 태엽 병정에 맞는다.
    expect(lookMismatches(before, withNpc(before, "태엽 병정", say("깨어난 태엽 병정", "generated-faceset-missing-people-13")))).toEqual([]);
  });

  it("flags a white-dress woman on the pink-dress princess chip", () => {
    const problems = lookMismatches(before, withNpc(before, "하얀 드레스의 여자", [], { id: "tex_easyrpg_charset_people3", characterIndex: 3 }));
    expect(problems.some((p) => p.includes("[게임 검사 그림]") && p.includes("하얀 드레스"))).toBe(true);
  });

  it("asks nothing of names without age, kind or colour words", () => {
    expect(lookMismatches(before, withNpc(before, "상인", say("상인", "easyrpg-faceset-people1-06")))).toEqual([]);
  });
});

describe("picture descriptions are searchable", () => {
  it("face descriptions carry age and kind", () => {
    expect(faceLookText("easyrpg-faceset-people1-06")).toContain("노인");
    expect(faceLookText("generated-faceset-missing-people-13")).toContain("기계");
  });

  it("「하얀 드레스」 finds a chip whose appearance is a white dress", () => {
    const top = findNpcGraphicMatches("하얀 드레스").slice(0, 5);
    expect(top.some((m) => /(흰|하얀)[^,.]*드레스/u.test(m.entry.appearance ?? ""))).toBe(true);
  });
});

describe("v2 look checks: title backdrop era (J38)", () => {
  it("flags a modern skyline title in a fairy-tale workshop game", () => {
    const p = createBlankProject() as Project;
    p.system.titleScreen = { ...(p.system.titleScreen ?? {}), backgroundResourceId: "oprn-pano-sunset-skyline", backgroundLayers: [] } as Project["system"]["titleScreen"];
    expect(titleBackdropMismatch(p, "동화 같은 인형 공방 이야기를 만들어 줘")).toHaveLength(1);
    expect(titleBackdropMismatch(p, "서울 도시의 노을 이야기")).toEqual([]);
  });
});

describe("v2 hero look in story games (J43)", () => {
  it("flags the factory sword-and-shield hero on a modern story and redresses it at story setup", () => {
    const p = createBlankProject() as Project;
    const hero = p.database.actors.find((a) => a.id === "actor_hero") ?? p.database.actors[0]!;
    hero.characterResourceId = "easyrpg-charset-actor1";
    hero.characterIndex = 0;
    expect(pristineFantasyHero(p, "현대 카페 연애 이야기")).toHaveLength(1);
    expect(pristineFantasyHero(p, "용사의 모험 이야기")).toEqual([]);

    const applied = applyStorySetupDefaults(p, "폐업 직전 장난감 가게 회상 스토리 게임", true);
    expect(applied.some((line) => line.includes("주인공 차림"))).toBe(true);
    const after = p.database.actors.find((a) => a.id === hero.id)!;
    expect(after.characterResourceId).not.toBe("easyrpg-charset-actor1");
    expect(after.initialEquipment?.weapon).not.toBe("equip_sword");
    expect(pristineFantasyHero(p, "현대 카페 연애 이야기")).toEqual([]);
  });
});
