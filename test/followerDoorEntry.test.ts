// J9: 문·계단으로 막 들어와 주인공 뒤 칸이 막혔으면 파티 동료를 주인공 앞·옆에 세우지 않는다.
// 예전에는 trailBehind 가 앞 칸으로 꺾어 세워서, 첫 걸음에 동료가 주인공을 뚫고 뒤로 튀었다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { addFollowerToSession, followerPositions, recordFollowerPlayerStep, resetFollowerTrailNearPlayer } from "@/project/followers";
import { startSession } from "@/project/session";
import { startOnRetiredCombinedTown } from "./support/retiredEasyRpgTilesets";

function partyAtTopEdge() {
  // 고른 풀밭 위에서 본다 — 2026-10-07 정리 뒤 기본 시작 맵(beodeul_city)에는 막힌 칸이 섞여 있어 옆·뒤 칸 판정이 달라진다.
  const project = startOnRetiredCombinedTown(createBlankProject());
  // J9 는 간격 따르기(spaced)의 계약이다 — #3509 부터 기본은 고전 빵부스러기(breadcrumb)라 짧은 궤적에선 동료가 주인공 칸에 겹친다.
  project.system.companions = { ...project.system.companions, followMode: "spaced" };
  const session = startSession(project);
  addFollowerToSession(project, session, { actorId: "actor_hero", name: "미아" });
  // 맵 위 끝에서 아래를 본다 — 뒤(위)는 맵 밖, 계단으로 내려온 자리와 같다.
  session.x = 10;
  session.y = 0;
  return { project, session, map: project.maps[session.currentMapId]! };
}

describe("문으로 들어온 직후 동료 자리", () => {
  it("뒤가 막혔으면 앞·옆에 세우지 않고 숨겼다가 첫 걸음에 떠난 칸에 나타난다", () => {
    const { project, session, map } = partyAtTopEdge();
    resetFollowerTrailNearPlayer(session, map, project.system.companions, { project, facing: "down" });
    expect(session.followerTrail).toEqual([]);
    const world = { project, map };
    expect(followerPositions(session, project.system.companions, world)[0]).toMatchObject({ hidden: true });

    // 첫 걸음: (10,0) 을 떠나 (10,1) 로 — 동료는 주인공이 떠난 칸에 선다(앞에서 뒤로 튀지 않는다).
    recordFollowerPlayerStep(session, { x: 10, y: 0, direction: "down" });
    session.y = 1;
    const placed = followerPositions(session, project.system.companions, world)[0]!;
    expect(placed.hidden).toBeFalsy();
    expect({ x: placed.x, y: placed.y }).toEqual({ x: 10, y: 0 });
  });

  it("도착하자마자 이야기 장면이 돌면 액터 동료는 옆 빈 칸에 선다", () => {
    const { project, session, map } = partyAtTopEdge();
    resetFollowerTrailNearPlayer(session, map, project.system.companions, { project, facing: "down" });
    const placed = followerPositions(session, project.system.companions, { project, map, storyScene: true })[0]!;
    expect(placed.hidden).toBeFalsy();
    expect({ x: placed.x, y: placed.y }).not.toEqual({ x: session.x, y: session.y });
  });

  it("뒤가 열려 있으면 예전처럼 바로 뒤 칸에 선다", () => {
    const { project, session, map } = partyAtTopEdge();
    session.y = 5;
    resetFollowerTrailNearPlayer(session, map, project.system.companions, { project, facing: "down" });
    const placed = followerPositions(session, project.system.companions, { project, map })[0]!;
    expect({ x: placed.x, y: placed.y }).toEqual({ x: 10, y: 4 });
  });
});
