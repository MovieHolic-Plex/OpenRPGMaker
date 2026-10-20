// modern_city 실내 기물(r16 3/4 다시 그림) 런타임 확인 — 맵마다 화면 크기 간격으로 순간이동해 찍는다.
//   npm run qa:runtime -- --scenario modern-interior-props --project /tmp/mip34/qa/project.json
//   프로젝트는 scripts/content/modern-city-int/r16/qa_project.mts 가 만든다(옆의 qa-maps.json 을 읽는다).
import fs from "node:fs";
import path from "node:path";
const flag = process.argv.indexOf("--project");
const projectFixture = flag >= 0 ? process.argv[flag + 1] : "/tmp/mip34/qa/project.json";
const maps = JSON.parse(fs.readFileSync(path.join(path.dirname(projectFixture), "qa-maps.json"), "utf8"));
const pts = (n, step) => { const o = []; for (let v = Math.min(Math.floor(step / 2), n - 1); v < n; v += step) o.push(v); if (o[o.length - 1] < n - Math.floor(step / 2) - 1) o.push(n - Math.floor(step / 2) - 1); return o; };
const beats = [
  { id: "title", expect: { testidPresent: ["title-screen"] } },
  { id: "start", ops: [{ kind: "key", key: "Enter" }, { kind: "waitForRuntime" }], expect: { playerSpriteTextureLoaded: true } },
];
for (const m of maps) for (const y of pts(m.h, 14)) for (const x of pts(m.w, 26)) {
  const at = { mapId: m.id, x, y };
  beats.push({ id: `${m.id}-${x}-${y}`, shot: true, ops: [{ kind: "teleport", ...at }, { kind: "waitForPosition", ...at }], expect: { ...at } });
}
export default { id: "modern-interior-props", projectFixture, beats };
