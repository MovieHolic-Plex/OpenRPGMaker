// 첫 MVP 는 팀(2026-11-26 team-mvp-revive-r3: 세계 뼈대 미리 짓기 뒤 단일보다 빠름), 몬스터 수집은 단일 — 패널 라우팅이 읽는 순수 판정.
import { describe, expect, it } from "vitest";
import { createNewProjectSeed } from "@/editor/genrePacks";
import { buildWelcomeFreeTextPrompt } from "@/editor/welcomeGenrePresets";
import { firstMvpRoute } from "@/ai/piAgent/firstMvpRoute";
import { checkTeamMvp, FIRST_MVP_TEAM_RULES } from "@/ai/piAgent/teamMvp";
import { PI_TEAM_ROLES } from "@/ai/piAgent/team";
import { MVP_REACHED_SWITCH } from "@/project/gameBlueprint";

describe("firstMvpRoute", () => {
  const fresh = () => createNewProjectSeed(null);

  it("runs a first MVP as a team only for the measured genres (recall, JRPG adventure); other genres stay on the v2 single run", () => {
    for (const text of ["회상 형 게임 만들어 줘", "용사가 마을에서 출발해 숲 너머 동굴의 마물을 물리치는 모험 게임을 만들어 줘."]) {
      const route = firstMvpRoute(fresh(), text);
      expect(route.firstMvp, text).toBe(true);
      expect(route.team, text).toBe(true);
    }
    // 호러는 팀 2/2 가 끝 지점에 못 닿은 채 나갔다(2026-11-26 variant-remeasure) — 재지 않은 장르는 단일.
    for (const text of ["밤의 미술관에 갇힌 아이가 단서를 모아 빠져나가는 공포 게임을 만들어 줘.", buildWelcomeFreeTextPrompt("추리 게임 만들어 줘")]) {
      const route = firstMvpRoute(fresh(), text);
      expect(route.firstMvp, text).toBe(true);
      expect(route.team, text).toBe(false);
    }
  });

  it("keeps a monster-collect first build on the single run", () => {
    const route = firstMvpRoute(fresh(), "몬스터를 모으며 모험하는 게임을 만들어 줘.");
    expect(route.firstMvp).toBe(true);
    expect(route.team).toBe(false);
    const genre = fresh();
    genre.system.genre = "monster-collect";
    expect(firstMvpRoute(genre, "모험 게임 만들어 줘").team).toBe(false);
  });

  it("keeps small edits, questions and goal commands single", () => {
    expect(firstMvpRoute(fresh(), "이 집 지붕 색 빨갛게 바꿔 줘").team).toBe(false);
    expect(firstMvpRoute(fresh(), "타일셋이 뭐가 있어?").team).toBe(false);
    expect(firstMvpRoute(fresh(), "/goal 항구 지방을 탐험하는 RPG를 처음부터 만들어줘").team).toBe(false);
  });

  it("keeps whole-game requests single once the project has authored events", () => {
    const project = fresh();
    const map = Object.values(project.maps)[0]!;
    map.events = [{ id: "ev1", name: "촌장", x: 1, y: 1, pages: [] } as never];
    expect(firstMvpRoute(project, "회상 형 게임 만들어 줘").team).toBe(false);
  });
});

// 2026-11-24 assistant-measure: 첫 MVP 팀 실행은 v1 Pi 팀이라 v2 첫 판 약속(맵 3~5장 · 엔딩 없음 · 끝 지점)을 비켜 갔다.
describe("첫 MVP 팀 실행의 첫 판 약속", () => {
  const fresh = () => createNewProjectSeed(null);

  it("팀장 지시문에 첫 MVP 범위가 실린다(장르 프리셋이 아닌 한 줄 요청도)", () => {
    const project = fresh();
    const prompt = PI_TEAM_ROLES.orchestrator.systemPrompt(project, [], "이세계에 떨어진 마왕 살아남기 게임 만들어 줘").join("\n");
    expect(prompt).toContain(FIRST_MVP_TEAM_RULES[0]);
    expect(prompt).toContain(MVP_REACHED_SWITCH);
  });

  it("finish 관문: 엔딩 호출을 끝 지점 스위치로 바꾸고 엔딩 정의를 걷고, 맵이 모자라면 돌려보낸다", () => {
    const project = fresh();
    const map = Object.values(project.maps)[0]!;
    map.events = [{ id: "ev_end", name: "마왕", x: 2, y: 2, pages: [{ conditions: [], commands: [{ kind: "triggerEnding", endingId: "ending_a" }] }] } as never];
    (project as { endings?: unknown[] }).endings = [{ id: "ending_a", name: "끝", conditions: [], epilogue: [], presentation: {} }];
    const { applied, problems } = checkTeamMvp(project);
    expect(project.endings).toEqual([]);
    expect(JSON.stringify(map.events)).toContain(MVP_REACHED_SWITCH);
    expect(JSON.stringify(map.events)).not.toContain("triggerEnding");
    expect(applied.length).toBeGreaterThan(0);
    expect(problems.some((p) => p.startsWith("맵이 1장"))).toBe(true);
  });
});
