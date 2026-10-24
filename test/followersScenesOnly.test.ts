import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import {
  addFollowerToSession,
  charsetFollowerGraphic,
  followerPositions,
  recordFollowerPlayerStep,
} from "@/project/followers";
import { startSession } from "@/project/session";
import { isPassable } from "@/project/collision";

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
