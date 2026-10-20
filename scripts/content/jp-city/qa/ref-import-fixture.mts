// 게시한 jp_city 장소를 조수·편집기와 같은 가져오기 경로(preloadRegionReferenceScene → importReferenceScene)로 들인 출하 플레이어 시험 프로젝트.
//   npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/content/jp-city/qa/ref-import-fixture.mts --out <경로.json> jp-city-town-96x80 jp-city-koban-14x9 …
// 첫 장소가 시작 맵이다. 장소 내려받기(public/assets/region-references/*.oprn.json)는 파일에서 읽는다.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deserialize, serializePretty } from "@/project/io";
import { setRegionReferenceDownloadLoader, preloadRegionReferenceScene, importReferenceScene } from "@/project/regionReferenceImport";

let out: string | null = null; const ids: string[] = [];
for (let i = 2; i < process.argv.length; i += 1) {
  if (process.argv[i] === "--out") out = process.argv[++i] ?? null; else ids.push(process.argv[i]!);
}
if (!out || !ids.length) throw new Error("사용법: --out <경로.json> <장소 id>…");
setRegionReferenceDownloadLoader(async (p) => JSON.parse(readFileSync(join(process.env.REF_PUBLIC ?? "public", p), "utf8")));   // REF_PUBLIC = 고치기 전 사본 비교용
const project = deserialize(readFileSync("test/fixtures/projects/editor-authored-demo-v3.json", "utf8"));
const made: string[] = [];
for (const id of ids) {
  const scene = await preloadRegionReferenceScene(id);
  const r = importReferenceScene(project, scene, { includeEvents: false });
  made.push(String((r as { mapId?: string }).mapId));
  console.log(id, scene.source, JSON.stringify(r).slice(0, 200));
}
project.startMapId = made[0] as typeof project.startMapId;
const start = project.maps[made[0]!]!;
project.startPos = { x: Math.floor(start.width / 2), y: Math.floor(start.height / 2) };
writeFileSync(out, serializePretty(project), "utf8");
console.log("maps", made.join(" "));
