// 조수(헤드리스 Pi) 탈것 깔기 시험용 프로젝트 — 小学校·지하철역 맵을 노선 없이 넣는다(조수가 직접 깔게).
//
//   npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/content/jp-city/qa/transit-assist-fixture.mts --out qa-runs/transit-assist/fixture.json
//   bun scripts/pi-agent.mts --project qa-runs/transit-assist/fixture.json --task "…" --maps jp-city-school --current jp-city-school --out out.json --report r.json --log-args
//
// 헤드리스 로드는 ensureBundledTilesets 를 돌지 않으므로 번들 jp_city 타일셋(참고문서 포함)을 새로 만들어 넣는다.
import { readFileSync, writeFileSync } from "node:fs";
import { deserialize, serializePretty } from "@/project/io";
import { createJpCityTileset } from "@/project/defaults/jpCity";

let out: string | null = null;
for (let i = 2; i < process.argv.length; i += 1) if (process.argv[i] === "--out") out = process.argv[++i] ?? null;
if (!out) throw new Error("사용법: --out <경로.json>");
const project = deserialize(readFileSync("test/fixtures/projects/editor-authored-demo-v3.json", "utf8"));
project.tilesets.jp_city = createJpCityTileset();
for (const f of ["school", "station-concourse", "station-platform"]) {
  const m = JSON.parse(readFileSync(`scripts/content/jp-city/maps/out/${f}.map.json`, "utf8"));
  delete m.transit;
  m.events = (m.events ?? []).filter((e: { commands?: unknown[]; pages?: Array<{ commands: Array<{ kind: string; mapId?: string }> }> }) =>
    (e.pages ?? []).every((p) => p.commands.every((c) => c.kind !== "transfer" || ["jp-city-school", "jp-city-station-concourse", "jp-city-station-platform"].includes(c.mapId ?? ""))));
  project.maps[m.id] = m;
  project.mapTree = { ...project.mapTree, children: [...(project.mapTree?.children ?? []), { mapId: m.id, children: [] }] } as typeof project.mapTree;
}
writeFileSync(out, serializePretty(project), "utf8");
console.log(`픽스처: ${out} (참고문서 ${Object.keys(project.tilesets.jp_city.referenceDocuments ?? {}).length}용도)`);
