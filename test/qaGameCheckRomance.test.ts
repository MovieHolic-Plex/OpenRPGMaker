import { describe, expect, it } from "vitest";
import { checkRomance, isRomanceCheckTarget, isRomanceGameRequest } from "@/qa/gameCheck/romance";
import { createBlankProject } from "@/project/defaults";
import type { GameEvent, Project } from "@/project/types";

function romanceProject(): Project {
  const project = createBlankProject();
  project.system.fieldHud = { theme: "hearts", widgets: [] } as never;
  return project;
}
const npc = (id: string, patch: Partial<GameEvent> & { chip?: string } = {}): GameEvent => ({
  id, name: id, x: 1, y: 1, trigger: { kind: "action" }, commands: [],
  characterId: `char_${id}`, talkFriendship: true,
  pages: [{ id: `${id}_p0`, name: "p", conditions: [], trigger: { kind: "action" }, commands: [],
    graphic: patch.chip ? { sprite: { type: "bundled", id: patch.chip }, pattern: 1 } : { transparent: true } }],
  ...patch,
} as unknown as GameEvent);
const codes = (project: Project) => checkRomance(project).map((finding) => finding.code);

describe("checkRomance — 연애 게임 부합 경고", () => {
  it("연애 프로젝트가 아니면 아무것도 말하지 않는다", () => {
    const project = createBlankProject();
    expect(isRomanceCheckTarget(project, "")).toBe(false);
    expect(checkRomance(project, "")).toEqual([]);
  });

  it("뼈대 자리표시(기억의 길·첫 구간 끝)가 남으면 짚는다", () => {
    const project = romanceProject();
    const map = Object.values(project.maps)[0]!;
    project.maps.map_segment_route = { ...structuredClone(map), id: "map_segment_route", name: "기억의 길" };
    project.endings = [{ id: "ending_first_segment", name: "첫 구간 끝", conditions: [], priority: 0 } as never];
    const found = checkRomance(project).find((finding) => finding.code === "romance-skeleton-leftover");
    expect(found?.message).toContain("기억의 길");
    expect(found?.message).toContain("첫 구간 끝");
  });

  it("엔딩이 뼈대 하나뿐이면 짚고, 인물 엔딩이 더 있으면 조용하다", () => {
    const project = romanceProject();
    project.endings = [{ id: "ending_first_segment", name: "끝", conditions: [], priority: 0 } as never];
    expect(codes(project)).toContain("romance-only-skeleton-ending");
    project.endings.push({ id: "ending_a", name: "해피", conditions: [], priority: 1 } as never);
    expect(codes(project)).not.toContain("romance-only-skeleton-ending");
  });

  it("호감 인물이 하나도 없으면 짚는다", () => {
    expect(codes(romanceProject())).toContain("romance-no-relationship");
    const project = romanceProject();
    Object.values(project.maps)[0]!.events.push(npc("han", { chip: "sheetA" }));
    expect(codes(project)).not.toContain("romance-no-relationship");
  });

  it("투명한 인물·같은 칩을 나눠 쓰는 서로 다른 인물을 짚는다", () => {
    const project = romanceProject();
    const map = Object.values(project.maps)[0]!;
    map.events.push(npc("a"), npc("b", { chip: "sheetA" }), npc("c", { chip: "sheetA" }));
    const got = checkRomance(project);
    expect(got.find((finding) => finding.code === "romance-npc-invisible")?.message).toContain("1/3");
    expect(got.some((finding) => finding.code === "romance-npc-duplicate-chip")).toBe(true);
  });

  it("대사 본문 앞의 「[이름]」 이중 표기를 짚는다", () => {
    const project = romanceProject();
    const map = Object.values(project.maps)[0]!;
    const person = npc("han", { chip: "sheetA" });
    (person.pages[0] as { commands: unknown[] }).commands = [{ kind: "text", speaker: "한", body: "\"[한]\n안녕\"" }];
    map.events.push(person);
    expect(codes(project)).toContain("romance-speaker-in-body");
  });
  it("기한 엔딩의 마지막 기본 결말이 조건 달린 엔딩이면 짚고, 조건 없는 엔딩이면 조용하다", () => {
    const project = romanceProject();
    project.system.timeSystem = { enabled: true, onDayEnd: "ce_deadline" } as never;
    project.endings = [
      { id: "ending_han", name: "한", conditions: [{ kind: "friendshipAtLeast", npcKey: "han", value: 10 }], priority: 1 },
      { id: "ending_normal", name: "평범", conditions: [{ kind: "friendshipAtLeast", npcKey: "*", value: 5 }], priority: 0 },
    ] as never;
    const chain = (fallback: string) => [{
      kind: "fork", condition: { kind: "variable", variableId: "var_days", op: ">=", value: 14 },
      then: [{ kind: "fork", condition: { kind: "friendshipAtLeast", npcKey: "han", value: 10 },
        then: [{ kind: "triggerEnding", endingId: "ending_han" }], else: [{ kind: "triggerEnding", endingId: fallback }] }],
    }];
    project.commonEvents = [{ id: "ce_deadline", name: "기한", trigger: "none", commands: chain("ending_normal") }] as never;
    expect(codes(project)).toContain("romance-deadline-no-fallback");
    (project.endings![1] as { conditions: unknown[] }).conditions = [];
    expect(codes(project)).not.toContain("romance-deadline-no-fallback");
  });

  it("동사 없이 소재만 적은 한 줄도 제작 요청이고, 고치기·삭제 요청은 아니다", () => {
    expect(isRomanceGameRequest("고등학교 학원물 연애 게임, 여러 명 중 한 명과 이어지는 엔딩")).toBe(true);
    expect(isRomanceGameRequest("카페 아르바이트 로맨스 게임 만들어 줘")).toBe(true);
    expect(isRomanceGameRequest("연애 게임 맵 좀 고쳐줘")).toBe(false);
    expect(isRomanceGameRequest("던전 RPG 만들어 줘")).toBe(false);
  });
});
