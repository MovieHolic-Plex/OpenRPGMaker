import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { endingClosing, normalizeGameBlueprint, type GameBlueprint } from "@/project/gameBlueprint";
import { applyShipDefaults } from "@/ai/v2/story/shipDefaults";
import { fillPartyNames } from "@/ai/v2/story/shipLookDefaults";
import type { GameEvent, Project } from "@/project/types";
import { applyDraftCast, draftCastCounts, BOSS_PROFILE_KEY } from "@/ai/v2/story/draftCast";

// 2026-11-12 Haiku r1h-mystery · r1h-snow: 엔딩 화면에 청사진의 설계 메모(ending.how — «강수연 아내를 지목하면 … 진실 엔딩. 다른 지목은 미궁»)가
// 그대로 나오고, 용의자 「이도윤」이 있는 게임의 주인공이 「도윤」이 되어 «도윤은 … 이 여정을 끝까지 걸어냈다» 로 맺었다.
// 엔딩에서 플레이어가 읽는 글은 ending.closing 이고, how 는 화면에 내지 않는다. 문서 openwiki/assistant-v2.md 「엔딩 맺음 글」.

const HOW = "강수연 아내를 지목하면 처방전과 유언장을 근거로 자백을 받아 진실 엔딩. 다른 지목은 사건을 미궁에 빠뜨린다.";
const ACTION = "모은 증거로 범인을 지목한다";
const CLOSING = ["강수연은 처방전과 유언장 앞에서 끝내 고개를 떨구었다.", "박만석은 서재의 불을 끄고, 이도윤은 말없이 저택을 떠났다."];

function game(closing?: string[]): Project {
  const project = createBlankProject();
  const place = project.maps[project.startMapId]!.name || project.startMapId;
  const blueprint: GameBlueprint = normalizeGameBlueprint({
    title: "저택의 밤", genre: "추리", playerGoal: "범인을 찾아 지목하자.",
    ending: { name: "진실", how: HOW, feeling: "차갑게 가라앉은 진실", ...(closing ? { closing } : {}) },
    steps: [
      { id: "s1", kind: "talk", who: "박만석 (집사)", place, event: "박만석", action: "집사에게 사건을 듣는다", gives: "의뢰", feeling: "긴장" },
      { id: "s2", kind: "talk", who: "이도윤 (조카)", place, event: "이도윤", action: ACTION, needs: "의뢰", gives: "엔딩", feeling: "결단" },
    ],
  });
  project.gameBlueprint = blueprint;
  (project as unknown as { endings: unknown[] }).endings = [{ id: "ending_truth", name: "진실", conditions: [], epilogue: [], presentation: {} }];
  return project;
}
const shown = (project: Project): string[] => ((project.endings ?? []) as unknown as { epilogue?: { text?: string }[] }[]).flatMap((e) => (e.epilogue ?? []).map((b) => String(b.text ?? "")).filter(Boolean));

describe("청사진 ending.closing — 엔딩 화면에서 플레이어가 읽는 글", () => {
  it("closing 을 남기고(빈 줄은 버린다) 옛 청사진(closing 없음)도 그대로 읽는다", () => {
    expect(endingClosing(game([...CLOSING, "  "]).gameBlueprint!)).toEqual(CLOSING);
    const legacy = game().gameBlueprint!;
    expect(legacy.ending.closing).toBeUndefined();
    expect(endingClosing(legacy)).toEqual([]);
  });
});

describe("기본 맺음 글은 설계 메모를 화면에 내지 않는다", () => {
  it("closing 이 없으면 how · 마지막 단계의 action 을 맺음 글로 쓰지 않는다", () => {
    const project = game();
    applyShipDefaults(project);
    const text = shown(project).join("\n");
    expect(text).not.toContain("지목하면");
    expect(text).not.toContain("진실 엔딩");
    expect(text).not.toContain(ACTION);
  });

  it("closing 이 있으면 그 줄이 맺음 글의 앞에 선다", () => {
    const project = game(CLOSING);
    applyShipDefaults(project);
    const lines = shown(project);
    expect(lines.slice(0, 2)).toEqual(CLOSING);
    expect(lines.join("\n")).not.toContain("지목하면");
  });
});

describe("주인공 기본 이름은 게임 속 인물 이름에 든 이름을 피한다", () => {
  it("「이도윤」 · 「김하람」 … 이 있는 게임의 주인공은 그 이름들이 아니다", () => {
    const project = game();
    const map = project.maps[project.startMapId]!;
    for (const [i, name] of ["이도윤", "김하람", "박이안", "최시온", "정태오"].entries()) map.events.push({ id: `ev_extra_${i}`, name, x: 8 + i, y: 5, pages: [{ conditions: [], commands: [] }] } as unknown as GameEvent);
    fillPartyNames(project, "");
    const hero = project.database.actors.find((a) => a.id === project.system.startActorIds?.[0])!.name;
    expect(hero).toBe("라온");
  });
});

// 2026-11-24 ideal-flow-draft: 첫 판이 맵 3장만 짓고 세계관·동료·직업은 비었다. 청사진 cast·world·items 칸을 끝맺음 draft-cast 가 자료집으로 짓는다.
function castGame(battles = true): Project {
  const project = game();
  project.gameBlueprint = normalizeGameBlueprint({
    ...project.gameBlueprint, ...(battles ? {} : { battles: false }),
    cast: { hero: { name: "아젤", role: "몰락한 마왕", skill: "마왕의 위압" }, companions: [{ name: "리나", role: "견습 사제", bio: "변경의 사제." }, { name: "볼크", role: "퇴역 용병" }, { name: "리나" }, { role: "이름 없음" }], boss: { name: "용사 카일" } },
    world: { name: "아르센 변경", premise: "마법이 쇠한 인간 왕국의 변경.", rules: ["마력은 달이 뜰 때만 돌아온다"], tones: ["comic", "없는톤"] },
    items: ["달빛 결정", "변경 빵", "부러진 마왕의 뿔"],
  });
  return project;
}

describe("청사진 인물·세계 칸 → 첫 판 초안 데이터(draft-cast)", () => {
  it("cast 는 이름 없는·겹치는 동료를 버리고, world 는 목록에 없는 톤을 버린다", () => {
    const bp = castGame().gameBlueprint!;
    expect(bp.cast?.companions?.map((p) => p.name)).toEqual(["리나", "볼크"]);
    expect(bp.world?.tones).toEqual(["comic"]);
    expect(bp.items).toHaveLength(3);
  });

  it("주인공 이름·직업, 동료 둘(파티·직업·기술), 세계관, 물건 셋, 보스 적을 짓고 다시 돌면 아무것도 바꾸지 않는다", () => {
    const project = castGame();
    const before = draftCastCounts(project);
    expect(applyDraftCast(project).length).toBeGreaterThan(0);
    const party = (project.system.startActorIds ?? []).map((id) => project.database.actors.find((a) => a.id === id)!);
    expect(party.map((a) => a.name)).toEqual(["아젤", "리나", "볼크"]);
    expect(new Set(party.map((a) => a.faceResourceId)).size).toBe(3);
    expect(party.map((a) => project.database.classes.find((c) => c.id === a.classId)?.name)).toEqual(["몰락한 마왕", "견습 사제", "퇴역 용병"]);
    expect(project.database.skills.some((s) => s.name === "마왕의 위압" && party[0]!.learnedSkills.some((l) => l.skillId === s.id))).toBe(true);
    expect(project.worldCanon?.name).toBe("아르센 변경");
    expect(project.characters?.[party[1]!.id]?.note).toBe("변경의 사제.");
    expect(project.characters?.[BOSS_PROFILE_KEY]?.displayName).toBe("용사 카일");
    const after = draftCastCounts(project);
    expect(after.items - before.items).toBe(3);
    expect(after.classes).toBeGreaterThanOrEqual(3);
    expect(after.skills - before.skills).toBe(3);
    expect(project.database.enemies.some((e) => e.name === "용사 카일")).toBe(true);
    expect(applyDraftCast(project)).toEqual([]);
  });

  it("싸움 없는 게임은 동료를 파티에 세우지 않고 적도 짓지 않지만 인물 소개는 남긴다", () => {
    const project = castGame(false);
    applyDraftCast(project);
    expect(project.system.startActorIds).toHaveLength(1);
    expect(Object.values(project.characters ?? {}).map((p) => p.displayName)).toEqual(expect.arrayContaining(["리나", "볼크"]));
    expect(project.database.enemies.some((e) => e.name === "용사 카일")).toBe(false);
  });

  it("이미 시작 파티에 선 동료가 있으면 그 위에 동료를 더 세우지 않는다", () => {
    const project = castGame();
    const hero = project.database.actors.find((a) => a.id === project.system.startActorIds?.[0])!;
    const mate = { ...structuredClone(hero), id: "actor_seira", name: "세이라", nickname: "견습 마법사" };
    project.database.actors.push(mate);
    project.system.startActorIds = [hero.id, mate.id];
    applyDraftCast(project);
    const party = (project.system.startActorIds ?? []).map((id) => project.database.actors.find((a) => a.id === id)!.name);
    expect(party).toEqual(["아젤", "세이라", "리나"]);
    expect(project.characters?.actor_seira?.displayName).toBe("세이라");
  });

  it("cast 가 없으면 청사진 대화 상대로 동료 소개를 채우고, 그 사람들은 시작 파티에 넣지 않는다", () => {
    const project = game();
    applyDraftCast(project);
    expect(project.system.startActorIds).toHaveLength(1);
    const names = Object.values(project.characters ?? {}).map((p) => p.displayName);
    expect(names).toEqual(expect.arrayContaining(["박만석", "이도윤"]));
    expect(names).not.toContain("리안");
  });
});
