// 「서 있는 필드 적을 조사 단추로 연다」 시나리오 픽스처: 조수 판 저장본(project.sqlite)에서 프로젝트를 꺼내
// 시작 위치를 필드 적 바로 아래 칸으로 옮기고 오프닝을 끈다.
//   npx vite-node --script scripts/qa/runtime/field-foe-action-fixture.mts --sqlite <판>/project/project.sqlite --out /tmp/field-foe.json
// 판 저장본(씬 벤치 omo-fr-t terra forest-path r3: 숲길 (13,28) 슬라임 정찰대, 판정자가 (13,29)에서 Enter 로 못 열었다).
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { serializePretty } from "@/project/io";
import { readProjectSqlite } from "../../content/read-project-sqlite.mts";

const { values } = parseArgs({ options: { sqlite: { type: "string" }, out: { type: "string" } } });
if (!values.sqlite || !values.out) throw new Error("--sqlite <project.sqlite> --out <json>");
const project = readProjectSqlite(values.sqlite);
// 전투 명령이 든 닿기 페이지를 가진 첫 필드 적(숲 맵 먼저)
let foe: { mapId: string; x: number; y: number; id: string } | undefined;
const maps = Object.values(project.maps).sort((a, b) => Number(!/forest|숲/u.test(`${a.id}${a.name}`)) - Number(!/forest|숲/u.test(`${b.id}${b.name}`)));
for (const map of maps) for (const ev of map.events ?? []) {
  if (!foe && (ev.pages ?? []).some((p) => p.trigger?.kind === "eventTouch" && JSON.stringify(p.commands ?? []).includes('"battleProcessing"'))) foe = { mapId: map.id, x: ev.x, y: ev.y, id: ev.id };
}
if (!foe) throw new Error("필드 적이 없다");
project.startMapId = foe.mapId;
project.startPos = { ...project.startPos, x: foe.x, y: foe.y + 1 };
// 픽스처를 가볍게(전체 사본은 142MB 라 플레이어 탭이 부팅 중 죽었다): 맵이 쓰는 타일셋만 남기고 참고문서를 뺀다.
const used = new Set(Object.values(project.maps).map((m) => m.tilesetId));
project.tilesets = Object.fromEntries(Object.entries(project.tilesets).filter(([id]) => used.has(id)));
for (const ts of Object.values(project.tilesets)) delete (ts as { referenceDocuments?: unknown }).referenceDocuments;
(project.system as { opening?: { enabled?: boolean } }).opening = { ...((project.system as { opening?: object }).opening ?? {}), enabled: false };
writeFileSync(values.out, serializePretty(project), "utf8");
console.log(JSON.stringify({ out: values.out, foe }));
