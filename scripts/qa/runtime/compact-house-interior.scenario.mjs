import fs from "node:fs";
import path from "node:path";
const flag = process.argv.indexOf("--project");
const projectFixture =
  flag >= 0
    ? process.argv[flag + 1]
    : "output/evidence/compact-interior/reloaded-project.json";
const project = JSON.parse(fs.readFileSync(projectFixture, "utf8"));
const proof = JSON.parse(
  fs.readFileSync(
    path.join(path.dirname(projectFixture), "walkthroughs.json"),
    "utf8",
  ),
);
const { roomMapId, yardMapId, street, entry, enter, exit } = proof;
const beats = [
  { id: "title", expect: { testidPresent: ["title-screen"] } },
  {
    id: "start",
    ops: [{ kind: "key", key: "Enter" }, { kind: "waitForRuntime" }],
    expect: { mapId: project.startMapId, playerSpriteTextureLoaded: true },
  },
  {
    id: "yard",
    note: "저장된 작은 집의 마당에서 출발",
    shot: true,
    ops: [
      { kind: "teleport", mapId: yardMapId, x: street.x, y: street.y },
      { kind: "waitForPosition", mapId: yardMapId, x: street.x, y: street.y },
    ],
    expect: { mapId: yardMapId, x: street.x, y: street.y },
  },
  {
    id: "enter",
    note: "현관까지 실제로 걸어 들어가기",
    shot: true,
    ops: [
      { kind: "dir", dir: "up" },
      { kind: "waitForPosition", ...enter.to },
      { kind: "dir", dir: null },
    ],
    expect: { ...enter.to, playerSpriteTextureLoaded: true },
  },
  {
    id: "clear-door",
    ops: [
      { kind: "dir", dir: "up" },
      { kind: "waitForPosition", mapId: roomMapId, x: entry.x, y: entry.y - 1 },
      { kind: "dir", dir: null },
    ],
    expect: { mapId: roomMapId, x: entry.x, y: entry.y - 1 },
  },
  ...proof.walks.map((w) => ({
    id: w.id,
    note:
      w.id === "exit"
        ? "현관을 통해 마당으로 돌아오기"
        : `${w.id} 앞까지 실제 이동`,
    shot: true,
    ops: [
      { kind: "playerRoute", moves: w.moves },
      {
        kind: "waitForPosition",
        ...(w.id === "exit"
          ? exit.to
          : { mapId: roomMapId, x: w.end.x, y: w.end.y }),
      },
    ],
    expect: {
      ...(w.id === "exit"
        ? exit.to
        : { mapId: roomMapId, x: w.end.x, y: w.end.y }),
      playerSpriteTextureLoaded: true,
    },
  })),
];
export default { id: "compact-house-interior", projectFixture, beats };
