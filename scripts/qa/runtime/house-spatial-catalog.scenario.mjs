// Walk the Supabase-reloaded house examples through actual player.html transfers.
import { readFileSync } from "node:fs";
const flag = process.argv.indexOf("--project");
const projectFixture = flag >= 0 ? process.argv[flag + 1] : "output/evidence/house-spatial-catalog/reloaded-project.json";
const project = JSON.parse(readFileSync(projectFixture, "utf8"));
export function houseSpatialScenario(study, count) {
  const beats = [
    { id: "title", expect: { testidPresent: ["title-screen"] } },
    { id: "start", ops: [{ kind: "key", key: "Enter" }, { kind: "waitForRuntime" }],
      expect: { mapId: project.startMapId, playerSpriteTextureLoaded: true } },
  ];
  const moves = (dir, count) => Array.from({ length: count }, () => ({ kind: "move", dir }));
  // Each independent example gets a fresh player session. Debug teleport must not
  // replace the scene in the middle of the other example's exit event.
  const root = `house-example:${study}`;
  const children = Object.values(project.spatialAuthoring.occurrences).filter(value => value.parentId === root && value.kind === "space");
  const yard = children.find(value => value.level === 0).bindings[0];
  const floors = children.filter(value => value.level > 0).sort((a, b) => a.level - b.level).map(value => value.bindings[0].mapId);
  if (floors.length !== count) throw new Error(`Missing real floors for ${study}`);
  const street = yard.ports[0];
  const front = project.mapConnections.find(link => link.from.mapId === yard.mapId && link.to.mapId === floors[0]);
  beats.push({ id: `${study}-yard`, note: "저장된 마당에서 실제 문까지 걷기 시작", shot: true,
    ops: [{ kind: "teleport", mapId: yard.mapId, x: street.x, y: street.y },
      { kind: "waitForPosition", mapId: yard.mapId, x: street.x, y: street.y }],
    expect: { mapId: yard.mapId, x: street.x, y: street.y, playerSpriteTextureLoaded: true } });
  beats.push({ id: `${study}-enter`, note: "현관 앞을 밟으면 1층으로 이동", shot: true,
    // Ordinary input respects the preceding transfer's fade-in/event lock. A
    // short forced route can reach the door while that event is still running.
    ops: [{ kind: "dir", dir: "up" },
      { kind: "waitForPosition", ...front.to }, { kind: "dir", dir: null }],
    expect: { ...front.to, playerSpriteTextureLoaded: true } });
  for (let level = 1; level < count; level++) {
    const link = project.mapConnections.find(value => value.from.mapId === floors[level - 1] && value.to.mapId === floors[level]);
    beats.push({ id: `${study}-up-${level + 1}`, note: `${level}층에서 계단을 밟아 ${level + 1}층으로 이동`, shot: level === count - 1,
      ops: [{ kind: "playerRoute", moves: [...moves("right", 3), ...moves("up", 7)] },
        { kind: "waitForPosition", ...link.to }], expect: { ...link.to, playerSpriteTextureLoaded: true } });
  }
  for (let level = count; level >= 1; level--) {
    const link = project.mapConnections.find(value => value.from.mapId === floors[level - 1] && value.to.mapId === (level === 1 ? yard.mapId : floors[level - 2]));
    // A two-step forced route can run during transfer's fade-in while the event is
    // still running. Real directional input waits for that event before moving.
    const travel = level === count ? [
      { kind: "dir", dir: "up" },
      { kind: "waitForPosition", mapId: floors[level - 1], x: 8, y: 12 },
      { kind: "dir", dir: null },
      { kind: "dir", dir: "down" },
      { kind: "waitForPosition", ...link.to },
      { kind: "dir", dir: null },
    ] : [
      { kind: "playerRoute", moves: [...moves("right", 1), ...moves("down", 7), ...moves("left", 4)] },
      { kind: "waitForPosition", ...link.to },
    ];
    beats.push({ id: `${study}-down-${level - 1}`, note: level === 1 ? "현관을 통해 마당으로 복귀" : `${level - 1}층으로 내려오기`, shot: level === 1,
      ops: travel,
      expect: { ...link.to, playerSpriteTextureLoaded: true } });
  }
  return { id: `house-spatial-catalog-${count}f`, projectFixture, beats };
}
export default houseSpatialScenario("inn-3f", 3);
