// 다듬기 라우팅·지시문 계약.
//
// 두 가지를 고정한다:
//  1) 어떤 문장이 다듬기 경로로 가는가 — 너무 넓게 잡으면 "꽃 흩뿌려줘" 같은 소품 요청이
//     타일 전권 재구성으로 바뀐다(사용자가 시키지 않은 파괴).
//  2) 지시문에 전권 문단·연결 좌표·[컨텍스트] footer 가 들어 있는가 — footer 포맷이 깨지면
//     buildSpec 의 정규식이 선택 영역을 못 읽어 구간 격리가 조용히 꺼진다.
import { describe, expect, it } from "vitest";
import { buildRegionPolishMessage, isRegionPolishRequest } from "@/editor/regionTask/regionPolish";
import { analyzeRegionSurroundings } from "@/editor/regionTask/regionSurroundings";
import type { RegionRect } from "@/editor/regionTask/clipToRegion";
import { POLISH_INSTRUCTION } from "@/editor/regionTask/suggestedCommands";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject, TILE } from "@/project/defaults";
import type { Project } from "@/project/types";

const MAP_ID = "map_polish";
const W = 20;
const REGION: RegionRect = { x: 8, y: 8, width: 4, height: 4 };

function makeProject(): Project {
  const context = { project: createBlankProject() };
  const created = runTool(context, "create_map", { id: MAP_ID, name: "다듬기 테스트", width: W, height: W });
  expect(created.ok, created.summary).toBe(true);
  const map = context.project.maps[MAP_ID];
  map.lowerTiles.fill(TILE.GRASS);
  return context.project;
}

describe("isRegionPolishRequest", () => {
  it("주변 어울림을 명시한 문장은 다듬기다", () => {
    expect(isRegionPolishRequest(POLISH_INSTRUCTION)).toBe(true);
    expect(isRegionPolishRequest("주변과 어울리게 해줘")).toBe(true);
    expect(isRegionPolishRequest("경계 다듬어줘")).toBe(true);
    expect(isRegionPolishRequest("이음새를 정리해줘")).toBe(true);
    expect(isRegionPolishRequest("polish this area")).toBe(true);
  });

  it("소품 산포·신규 건축 요청은 다듬기가 아니다 — 전권 재구성으로 승격되면 안 된다", () => {
    expect(isRegionPolishRequest("여기 잔디밭에 꽃이랑 잡초를 자연스럽게 흩뿌려줘")).toBe(false);
    expect(isRegionPolishRequest("이 영역에 작은 오두막 한 채 지어줘")).toBe(false);
    expect(isRegionPolishRequest("보물상자를 하나 숨겨줘")).toBe(false);
    expect(isRegionPolishRequest("")).toBe(false);
    expect(isRegionPolishRequest("   ")).toBe(false);
  });
});

describe("buildRegionPolishMessage", () => {
  const baseInput = {
    instruction: POLISH_INSTRUCTION,
    mapName: "다듬기 테스트",
    mapId: MAP_ID,
    region: REGION,
    materialHint: "- 이 맵에서 쓸 수 있는 재료: 잔디, 물, 모래",
  };

  it("사용자 원문을 맨 위에 두고 전권 문단과 [컨텍스트] footer 를 붙인다", () => {
    const message = buildRegionPolishMessage({ ...baseInput, surroundings: null });
    expect(message.startsWith(POLISH_INSTRUCTION)).toBe(true);
    expect(message).toContain("이번 작업은 「다듬기」다");
    expect(message).toContain("영역 안에서는 전권이다");
    expect(message).toContain("move_event");
    expect(message).toContain(baseInput.materialHint);
    // footer 포맷은 일반 영역 작업과 같아야 한다(buildSpec 이 이 줄을 파싱한다).
    expect(message).toContain(
      `[컨텍스트] 현재 맵: 다듬기 테스트 (${MAP_ID}) · 사용자 선택 영역: (8,8) 4×4`,
    );
    expect(message.trimEnd().endsWith("4×4")).toBe(true);
  });

  it("영역 밖으로 새 맵을 만들거나 이벤트를 내보내지 말라고 명시한다", () => {
    const message = buildRegionPolishMessage({ ...baseInput, surroundings: null });
    expect(message).toContain("영역 밖으로는 옮기지 말 것");
    expect(message).toContain("새 맵을 만들지 말 것");
  });

  it("물이 맞닿으면 연결 필수 좌표를 명령으로 재진술한다", () => {
    const project = makeProject();
    const map = project.maps[MAP_ID];
    for (let x = REGION.x; x < REGION.x + REGION.width; x += 1) {
      map.lowerTiles[(REGION.y + REGION.height) * W + x] = TILE.WATER;
    }
    const surroundings = analyzeRegionSurroundings(project, MAP_ID, REGION);
    const message = buildRegionPolishMessage({ ...baseInput, surroundings });

    expect(message).toContain("물 연결 필수");
    expect(message).toContain(`(${REGION.x},${REGION.y + REGION.height - 1})`);
    // 주변 브리핑 본문도 함께 들어간다 — 이것이 다듬기 지시의 근거다.
    expect(message).toContain("주변 상황 (영역 밖");
  });

  it("영역 안 이벤트를 브리핑으로 넘겨 재배치 대상을 알려 준다", () => {
    const project = makeProject();
    project.maps[MAP_ID].events = [
      { id: "ev_npc", x: REGION.x + 1, y: REGION.y + 2, trigger: { kind: "action" }, commands: [] },
    ];
    const surroundings = analyzeRegionSurroundings(project, MAP_ID, REGION);
    const message = buildRegionPolishMessage({ ...baseInput, surroundings });
    expect(message).toContain("[ev_npc]");
  });

  it("extraGuides 를 도구 가이드 뒤에 그대로 이어 붙인다", () => {
    const message = buildRegionPolishMessage({
      ...baseInput,
      surroundings: null,
      extraGuides: ["- 테스트 가이드 한 줄"],
    });
    expect(message).toContain("- 테스트 가이드 한 줄");
  });
});
