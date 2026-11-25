import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { addFollowerToSession, followerPositions, recordFollowerPlayerStep, resetFollowerTrailNearPlayer, charsetFollowerGraphic } from "@/project/followers";
import { startSession } from "@/project/session";
import { startOnRetiredCombinedTown } from "./support/retiredEasyRpgTilesets";
import { isPassable } from "@/project/collision";
import { isolateTimers } from "./mergedTeardown";

// J9: 문·계단으로 막 들어와 주인공 뒤 칸이 막혔으면 파티 동료를 주인공 앞·옆에 세우지 않는다.
// 예전에는 trailBehind 가 앞 칸으로 꺾어 세워서, 첫 걸음에 동료가 주인공을 뚫고 뒤로 튀었다.
describe("followerDoorEntry", () => {
  isolateTimers();
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
});

describe("followersScenesOnly", () => {
  isolateTimers();
  // FF6 식 동료 표시(companions.display = "scenesOnly") — 필드에선 숨고, 이야기 장면에서만 주인공 옆에 선다.

  function fixture() {
    const project = createBlankProject();
    project.system.companions = { display: "scenesOnly" };
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("map fixture missing");
    const session = startSession(project);
    // 시작 칸 타일(통행 가능)로 맵을 덮는다 — 기본 칩셋이 바뀌어도 열린 들판이 된다.
    map.lowerTiles.fill(map.lowerTiles[session.y * map.width + session.x]!);
    map.events = [];
    session.x = 6;
    session.y = 6;
    addFollowerToSession(project, session, { actorId: "actor_hero", name: "가리" });
    addFollowerToSession(project, session, { graphic: charsetFollowerGraphic("tex_easyrpg_charset_animal", 0), name: "야옹이" });
    for (let i = 0; i < 4; i += 1) recordFollowerPlayerStep(session, { x: 2 + i, y: 6, direction: "right" });
    if (!isPassable(project, map, 5, 6)) throw new Error("fixture: 들판이 통행 불가");
    return { project, map, session };
  }
  describe("동료 표시 scenesOnly", () => {
    it("이야기 장면이 아니면 동료는 모두 숨는다(궤적이 있어도)", () => {
      const { project, map, session } = fixture();
      const positions = followerPositions(session, project.system.companions, { project, map, storyScene: false });
      expect(positions).toHaveLength(2);
      expect(positions.every((entry) => entry.hidden === true)).toBe(true);
    });

    it("이야기 장면이면 주인공과 겹치지 않는 인접 칸에 나란히 선다", () => {
      const { project, map, session } = fixture();
      const positions = followerPositions(session, project.system.companions, { project, map, storyScene: true, playerFacing: "right" });
      expect(positions.every((entry) => entry.hidden !== true)).toBe(true);
      const cells = positions.map((entry) => `${entry.x},${entry.y}`);
      expect(new Set(cells).size).toBe(cells.length);
      expect(cells).not.toContain(`${session.x},${session.y}`);
      for (const entry of positions) {
        expect(Math.abs(entry.x - session.x) + Math.abs(entry.y - session.y)).toBeLessThanOrEqual(3);
        expect(entry.direction).toBe("right");
      }
    });

    it("follow(기본)는 기존처럼 궤적을 따라 보인다", () => {
      const { project, map, session } = fixture();
      const positions = followerPositions(session, { display: "follow" }, { project, map, storyScene: false });
      expect(positions.some((entry) => entry.hidden !== true)).toBe(true);
    });
  });
});
