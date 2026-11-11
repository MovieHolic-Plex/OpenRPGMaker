import { describe, expect, it } from "vitest";
import { escapeLeaks } from "@/ai/v2/blueprint";
import { isEscapeBlueprint } from "@/ai/v2/request/scope";
import { mapsMinBlocker } from "@/ai/v2/judge/shipChecks";
import { createBlankProject } from "@/project/defaults";
import type { GameMap, Project } from "@/project/types";

// 2026-11-10 link 측정 forest-0001: «무서운 숲에서 탈출하는 게임» 이 갇힌 방 게임으로 판정돼, build_blueprint_path 의 sealEscapeExits 가
// 모델이 막 create_transfer_pair 로 만든 출구(시작 맵 → 새벽 숲 가장자리)를 «조건 없이 나가는 이동» 으로 지웠다(세는 맵 1/4).
// 갇힌 방 판정은 닫힌 공간 낱말이 있을 때만 «탈출» 을 센다. 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(CI 에서 돈다).

const bp = (playerGoal: string, request: string, endingName = "끝", how = "") => ({ playerGoal, request, ending: { name: endingName, how } }) as never;

describe("갇힌 방 게임 판정 — «탈출» 단독은 방탈출이 아니다", () => {
  it("열린 맵 게임(숲·성·학교에서 탈출)은 갇힌 방이 아니다", () => {
    expect(isEscapeBlueprint(bp("무서운 숲에서 표식과 등불을 찾아 길을 밝히고 숲의 출구로 탈출하자.", "무서운 숲에서 탈출하는 게임 만들어줘"))).toBe(false);
    expect(isEscapeBlueprint(bp("성에 숨어 들어가 비밀 문서를 훔치고 성 외곽으로 탈출하자.", "닌자 게임 만들어줘"))).toBe(false);
    expect(isEscapeBlueprint(bp("그림자 성에 잠입해 기밀 문서를 훔치고 무사히 탈출하자.", "닌자", "그림자 속 탈출"))).toBe(false);
    expect(isEscapeBlueprint(bp("밤의 학교에서 귀신을 피해 탈출하자", "학교 공포 게임"))).toBe(false);
  });
  it("방향·방법 같은 낱말 속 «방» 은 닫힌 공간이 아니다", () => {
    expect(isEscapeBlueprint(bp("방향을 찾아 숲을 탈출하자", "숲 게임"))).toBe(false);
    expect(isEscapeBlueprint(bp("나가는 방법을 찾아 탈출하자", "숲 게임"))).toBe(false);
  });
  it("방탈출·밀실·갇힌·감옥 탈출은 갇힌 방 게임이다", () => {
    expect(isEscapeBlueprint(bp("서재를 탈출하자", "방탈출 게임 하나 만들어 줘"))).toBe(true);
    expect(isEscapeBlueprint(bp("밀실에서 나가자", "밀실 추리"))).toBe(true);
    expect(isEscapeBlueprint(bp("갇힌 저택에서 나가자", "저택 게임"))).toBe(true);
    expect(isEscapeBlueprint(bp("잠긴 방에서 탈출하자", "방에서 탈출하는 게임"))).toBe(true);
    expect(isEscapeBlueprint(bp("감옥에서 탈출한다", "감옥 탈출 게임"))).toBe(true);
  });
  it("갇힌 공주·감옥 동료 구출 같은 열린 맵 이야기는 갇힌 방이 아니다", () => {
    expect(isEscapeBlueprint(bp("마왕성에 갇힌 공주를 구하자", "공주를 구하는 모험 게임"))).toBe(false);
    expect(isEscapeBlueprint(bp("감옥에서 동료를 구출하자", "구출 게임"))).toBe(false);
  });
});

function projectWithExit(request: string, goal: string): Project {
  const p = createBlankProject() as Project;
  const start = p.maps[p.startMapId]!;
  const other = JSON.parse(JSON.stringify(start)) as GameMap;
  other.id = "map_edge"; other.name = "새벽 숲 가장자리"; other.events = [];
  p.maps.map_edge = other;
  start.name = "무서운 숲";
  start.events = [{ id: "door", name: "door", x: 5, y: 5, trigger: { kind: "touch" }, commands: [], pages: [{ id: "p", conditions: [], trigger: { kind: "touch" }, commands: [{ kind: "transfer", mapId: "map_edge", x: 2, y: 2 }] }] } as never];
  p.gameBlueprint = { request, title: "t", genre: "g", premise: "x", playerGoal: goal, steps: [{ id: "s1", place: "무서운 숲", event: "e", does: "d" }], ending: { name: "끝", how: "z", feeling: "w" } } as never;
  return p;
}

describe("조건 없이 나가는 문 — 방탈출만 막는다", () => {
  it("숲에서 탈출 게임에서는 시작 맵의 출구를 누수로 세지 않는다", () => {
    expect(escapeLeaks(projectWithExit("무서운 숲에서 탈출하는 게임 만들어줘", "숲의 출구로 탈출하자"))).toEqual([]);
  });
  it("방탈출 게임에서는 같은 출구를 누수로 센다(기존 동작 유지)", () => {
    const leaks = escapeLeaks(projectWithExit("방탈출 게임 만들어줘", "방을 탈출하자"));
    expect(leaks.map((l) => l.toMapId)).toEqual(["map_edge"]);
  });
});

describe("맵 최소와 갇힌 방 판정이 같은 편이다", () => {
  it("«감옥에서 탈출» 청사진은 맵 최소 1장만 요구한다(문을 지우는 쪽과 반대로 작동하지 않는다)", () => {
    const p = projectWithExit("감옥 탈출 게임", "감옥에서 탈출한다");
    expect(mapsMinBlocker(p, "감옥 탈출 게임을 만들어 줘")[0]?.message).toContain("/1장");
  });
  it("«숲에서 탈출» 청사진은 맵 최소(현재 6장)를 그대로 요구한다", () => {
    const p = projectWithExit("무서운 숲에서 탈출하는 게임 만들어줘", "숲에서 탈출한다");
    expect(mapsMinBlocker(p, "숲 탈출 게임을 만들어 줘")[0]?.message).toContain("/6장");
  });
});
