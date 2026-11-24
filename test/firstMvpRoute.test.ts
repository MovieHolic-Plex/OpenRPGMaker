// 첫 MVP 생성은 팀 실행, 작은 수정·대화는 단일(오너 2026-11-24) — 패널 라우팅이 읽는 순수 판정.
import { describe, expect, it } from "vitest";
import { createNewProjectSeed } from "@/editor/genrePacks";
import { buildWelcomeFreeTextPrompt } from "@/editor/welcomeGenrePresets";
import { firstMvpRoute } from "@/ai/piAgent/firstMvpRoute";

describe("firstMvpRoute", () => {
  const fresh = () => createNewProjectSeed(null);

  it("routes a whole-game request on a fresh project to the team", () => {
    expect(firstMvpRoute(fresh(), "회상 형 게임 만들어 줘").team).toBe(true);
    expect(firstMvpRoute(fresh(), buildWelcomeFreeTextPrompt("추리 게임 만들어 줘")).team).toBe(true);
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
