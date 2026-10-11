// 높이 지형 버들항 마을 네 장의 게임 화면 — 맵 북쪽 끝 위 여백(검은 띠가 서던 자리)과 길이 오르는 매끈한 경사로를 찍는다.
//
// 픽스처·좌표: scripts/qa/runtime/relief-village-fixture.mts
//   bun scripts/qa/runtime/relief-village-fixture.mts --out .omo/runtime-qa/relief-village.json
//   npm run qa:runtime -- --scenario relief-village --project .omo/runtime-qa/relief-village.json --out verify-shots/relief-village
// 좌표 파일은 RELIEF_VILLAGE_POINTS(기본 .omo/runtime-qa/relief-village.json.points.json)에서 읽는다.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("../../../", import.meta.url));
const pointsPath = process.env.RELIEF_VILLAGE_POINTS ?? `${REPO}.omo/runtime-qa/relief-village.json.points.json`;
const points = JSON.parse(readFileSync(pointsPath, "utf8"));

const at = (id, p) => ({
  id, note: p.note,
  ops: [
    { kind: "teleport", mapId: p.mapId, x: p.x, y: p.y },
    { kind: "waitForPosition", mapId: p.mapId, x: p.x, y: p.y, timeoutMs: 15000 },
    { kind: "face", dir: "up" },
  ],
  expect: { mapId: p.mapId, x: p.x, y: p.y },
  shot: true,
});

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const reliefVillageScenario = {
  id: "relief-village",
  beats: [
    { id: "boot", note: "타이틀 넘기기", ops: [{ kind: "key", key: "Enter" }, { kind: "waitFor", testid: "title-screen", state: "absent" }, { kind: "waitForRuntime" }], shot: false },
    ...Object.entries(points).map(([id, p]) => at(id, p)),
  ],
};
