// 조선 칩셋 맵 14장(마을 20호·국내성 둘·사냥터·동굴·실내 6·궁 내부 3)을 「장소」 카드로 싣는다. 호스트·공용 DB 에는 아무것도 쓰지 않는다(소급 게시는 별도 작업).
// 입력: save-joseon-baram.mjs 가 JOSEON_EXPORT_RELOADED=<경로> 로 내보낸, 저장소에서 다시 읽은 프로젝트 JSON.
// 출력: public/assets/region-references/<맵id>.{png,oprn.json}, src/project/regionReferences/joseon-village.json, src/project/joseonPlaceReferences.ts
// 내려받기 JSON(.oprn.json)의 타일셋은 가벼운 표(통행·우선순위·지형)만 담는다 — 조각·묶음·오토타일·참고문서·칸 메타는 번들이 소유하고 프로젝트를 열 때
// ensureBundledTilesets 가 되살린다(아래에서 실제로 되살아나는지 검증한다). 사냥터·궁 포함 14장이 각 7~10MB 가 되지 않게 하려는 것이다.
// 사용: JOSEON_EXPORT_RELOADED=/tmp/joseon-reloaded.json node scripts/content/save-joseon-baram.mjs
//       python3 scripts/content/prepare-joseon-baram-references.py      # 카드 그림 tiledata/joseon-village/images/<맵id>.png
//       node scripts/content/prepare-joseon-regions.mjs /tmp/joseon-reloaded.json
import fs from "node:fs";
import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { withTsModule } from "../ontology-ts-loader.mjs";
const [input] = process.argv.slice(2);
if (!input) throw Error("Usage: prepare-joseon-regions.mjs reloaded-project.json");
const DATA = "tiledata/joseon-village";
const project = JSON.parse(fs.readFileSync(input));
const stats = JSON.parse(fs.readFileSync(`${DATA}/build-stats.json`));
const proof = JSON.parse(fs.readFileSync(`${DATA}/storage-proof.json`));
const sheetDef = JSON.parse(fs.readFileSync("src/assets/joseonBaramTileset.json"));
const tileset = project.tilesets.joseon_baram;
assert(tileset, "재로드 프로젝트에 joseon_baram 이 없다");
// 마을·국내성 카드 문장의 조각·오토타일 수는 마을용(새 판 접두 fld_ cav_ in_b_ pal_ 제외)이다.
const NEW_PFX = ["fld_", "cav_", "in_b_", "pal_"];
const pieceWalk = JSON.parse(fs.readFileSync(`${DATA}/piece-walk.json`)).pieces;
const villagePieces = Object.keys(pieceWalk).filter((n) => !NEW_PFX.some((p) => n.startsWith(p))).length;
const villageAutotiles = sheetDef.autotileGroups.filter((a) => !/^jb_(fld|cav|in_b|pal)_/.test(a.id)).length;
const NATURAL = { joseon_field: "사냥터", joseon_cave: "동굴" };
const ROOMS = {
  joseon_in_house_b: ["민가", "한 가족이 사는 온돌 민가 — 부엌(흙바닥·황토벽) · 안방(온돌·회벽) · 마루(마루·창호벽, 길쌈). 방 사이 문 틈은 걷는 줄 한 칸."],
  joseon_in_inn_b: ["주막", "술청(마루) 한가운데 + 서쪽 부엌·곳간 + 동쪽 객실 둘. 평상 셋·술독·주가, 객실 이부자리."],
  joseon_in_smith_b: ["대장간", "흙바닥·돌벽 작업장(화덕·풀무·모루·숫돌·담금질 통) + 동쪽 장인의 작은 온돌방."],
  joseon_in_pharmacy_b: ["약방", "목재벽 약방(약장 벽 + 약 짓는 상·약연·작두·약탕) + 의원의 방."],
  joseon_in_school_b: ["서당", "강당(훈장 단 + 학동 서안 두 줄) + 훈장 방 + 서고. 목재 단·계단·병풍."],
  joseon_in_office_b: ["관아 동헌", "사또의 동헌(박석 대청·목재 단·병풍·의자·책상·붉은 기둥) + 곤장 틀·북 + 서기방·곳간."],
  joseon_in_throne: ["궁 정전 어좌 홀", "국내성 왕이 신하들을 마주하는 정전 — 북쪽 높은 단 위 어좌, 가운데 붉은 어도, 양쪽 단청 기둥 줄 사이 문신(서)·무신(동). 북벽 좌우 협문."],
  joseon_in_corridor: ["궁 회랑", "정전과 침전·관청을 잇는 긴 행각 — 북벽에 방으로 드는 쌍문 5곳, 남쪽은 단청 기둥과 난간으로 마당에 열려 있다. 마루 바닥."],
  joseon_in_bedchamber: ["궁 침전", "왕이 쉬는 안쪽 방 — 침소(온돌·병풍 앞 침구·용 문양 장·서안·화로)와 마루 접객 칸(방석·교자상), 칸막이 틈 2칸 폭."],
};
const PALACE = new Set(["joseon_in_throne", "joseon_in_corridor", "joseon_in_bedchamber"]);
const maps = {}, entries = [];
for (const mapId of Object.keys(stats.maps)) {
  const src = JSON.parse(fs.readFileSync(`${DATA}/maps/${mapId}.json`));
  const map = project.maps[mapId];
  assert(map, `재로드 프로젝트에 맵 ${mapId} 가 없다`);
  assert.deepEqual(map.lowerTiles, src.lowerTiles);
  assert.deepEqual(map.upperTiles, src.upperTiles);
  maps[mapId] = map;
  const slug = mapId.replace(/_/g, "-");
  const exported = structuredClone(project);
  exported.meta.title = src.name;
  exported.maps = { [mapId]: map };
  exported.mapTree = { mapId, children: [] };
  exported.mapConnections = [];
  exported.startMapId = mapId;
  exported.startPos = { x: src.start[0], y: src.start[1] };
  const { id, name, image, kind, family, tileSize, tilesPerRow, count, passability, priority, terrain } = tileset;
  exported.tilesets = { [id]: { id, name, image, kind, family, tileSize, tilesPerRow, count, passability, priority, terrain } };
  fs.writeFileSync(`public/assets/region-references/${slug}.oprn.json`, JSON.stringify(exported) + "\n");
  fs.copyFileSync(`${DATA}/images/${mapId}.png`, `public/assets/region-references/${slug}.png`);
  const walkable = src.walk.join("").split("1").length - 1;
  const reach = proof.engineChecks?.[mapId]?.reach;
  const reachTxt = reach ? ` (${reach.reachable}칸 도달, 놓친 곳 ${reach.missedCount})` : "";
  const kindId = NATURAL[mapId] ? "natural" : ROOMS[mapId] ? "facility" : "settlement";
  const doorTxt = (src.doors ?? []).map((d) => `(${d.x},${d.y})`).join(" ");
  const tail = [
    "칸 통행은 조각마다 X(막힘)·C(걸음, 사람 위)·F(걸음, 사람 아래)로 구운 값이다. 타일셋 「참고문서」에 조각 사전·칸 배열·오토타일 표·조립 예제·오류 교훈이 있다.",
    "새 프로젝트와 기존 프로젝트 모두 불러올 때 이 타일셋(joseon_baram)과 참고문서가 생긴다.",
  ];
  let rules, limitations = "지형·마을 외관 참고 사례. 실내 맵·문 이동·이벤트는 포함하지 않는다(주민 NPC만). 원본 그림 없이 팔레트만 참고한 손 도트다. 자동 생성 프리셋이 아니다.";
  if (kindId === "settlement") {
    rules = [
      `조선(바람의나라풍) 손 도트 조각 ${villagePieces}종과 오토타일 ${villageAutotiles}종으로 지은 마을 참고 사례. 칩셋 계열 \`oprn-joseon\`, 칸 ${map.width}×${map.height}.`,
      `집 문 ${src.doors.length}곳(문 앞 접근칸 + 디딤돌), 통로 ${src.passages.length}곳(대문·성문), 주민 ${src.people.length}명. 시작 칸 (${src.start[0]},${src.start[1]}).`,
      `걸을 수 있는 칸 ${walkable}/${map.width * map.height}. 시작 칸에서 모든 문 앞·디딤돌·통로·주민 칸까지 런타임 이동 규칙(canMove)으로 닿는 것을 확인했다${reachTxt}.`,
      ...tail,
    ];
  } else if (kindId === "natural") {
    const exits = (src.exits ?? []).map((e) => (e.x0 !== undefined ? `${e.side ?? ""} (${e.x0}..${e.x1},${e.y}) → ${e.to}` : `(${e.x},${e.y}) → ${e.to}`)).join(" · ");
    const zones = Object.entries(src.spawnZones ?? {}).map(([k, v]) => `${k} ${v}`).join(", ");
    const spawnN = (src.spawns ?? []).length;
    rules = mapId === "joseon_field" ? [
      `조선(바람의나라풍) 손 도트 사냥터 참고 사례. 칩셋 계열 \`oprn-joseon\`, 칸 ${map.width}×${map.height}. 구역 8곳(어귀·중앙 초원·동쪽 숲·서쪽 바위산·남쪽 야영지·폐허·늪·남쪽 숲띠)을 용도·앵커·동선으로 먼저 정하고 깔았다.`,
      "길은 큰길 → 짐승길 그물, 직선 + 모서리로만 꺾고 막다른 끝에는 목적지(굴 입구 셋·쉼터·야영지·무덤)가 있다. 같은 나무·바위 셋 일렬, 10×10 빈 광장, 큰 맨 풀 덩이는 두지 않는다.",
      `걸을 수 있는 칸 ${walkable}/${map.width * map.height}. 시작 칸 (${src.start[0]},${src.start[1]})에서 굴 입구 문 앞 ${src.doors.length}곳·주민 ${src.people.length}명·출구 칸까지 모두 런타임 이동 규칙(canMove)으로 닿는다${reachTxt}.`,
      `출구 자리: ${exits}. 지도 이동 이벤트는 없다(저작자가 출구 칸에 심는다). 스폰 자리 ${spawnN}곳(${zones})은 지도 데이터에 좌표로만 있고 몬스터 그림은 없다.`,
      ...tail,
    ] : [
      `조선(바람의나라풍) 손 도트 동굴 참고 사례. 칩셋 계열 \`oprn-joseon\`, 칸 ${map.width}×${map.height}. 방·복도(걸을 칸)만 정하면 천장(블롭) → 벽 앞면 2줄 → 바닥 그림자의 3단 벽이 규칙으로 나온다.`,
      "입구 방(화로 기둥 한 쌍 + 햇빛 문턱) · 광장(지하 못·석순·횃불) · 서방 광산 · 동방 짐승 소굴 · 북쪽 보물방 · 동남 수정 굴. 고리 동선이라 막다른 길은 목적(보물방·수정 굴)뿐이다. 소품은 복도 길목에 두지 않는다.",
      `걸을 수 있는 칸 ${walkable}/${map.width * map.height}. 입구 칸 (${src.start[0]},${src.start[1]})에서 모두 런타임 이동 규칙(canMove)으로 닿는다${reachTxt}.`,
      `출구 자리: ${exits}. 이동 이벤트는 없다. 스폰 자리 ${spawnN}곳은 좌표 기록뿐이다.`,
      ...tail,
    ];
    limitations = "지형·배치 참고 사례. 지도 이동·몬스터 출현·보물 상자 이벤트는 포함하지 않는다(주민 NPC만, 출구·스폰은 좌표 기록). 원본 그림 없이 팔레트만 참고한 손 도트다. 자동 생성 프리셋이 아니다.";
  } else {
    const [roomKo, what] = ROOMS[mapId];
    const exitDoor = (src.doors ?? []).find((d) => d.piece === "in_b_exit_mat");
    const otherDoors = (src.doors ?? []).filter((d) => d.piece !== "in_b_exit_mat");
    rules = [
      `조선(바람의나라풍) 손 도트 ${PALACE.has(mapId) ? "궁 내부" : "실내"} 참고 사례 「${roomKo}」 ${map.width}×${map.height}. ${what}`,
      `평면 → 천장 띠 → 바닥·그늘 → 벽면 2줄 → 입구 → 기물 순으로 깔았다. 천장 밑 두 줄은 벽 조각이고 같은 기물 셋 일렬·가구 겹침·입구 앞 3×3 가구는 없다.`,
      `출입구: 출구 깔개 (${exitDoor ? `${exitDoor.x},${exitDoor.y}` : "?"}) — 바깥 지도로 나가는 자리(이동 이벤트는 저작자가 심는다, 번들 맵에는 없다). 들어오는 칸 (${src.start[0]},${src.start[1]}).${otherDoors.length ? ` 방 문 ${otherDoors.length}곳 ${otherDoors.map((d) => `(${d.x},${d.y})`).join(" ")}.` : ""}`,
      `걸을 수 있는 칸 ${walkable}/${map.width * map.height}. 들어오는 칸에서 문 앞·출구 칸·주민 ${src.people.length}명 자리까지 걸을 수 있는 칸 전부가 런타임 이동 규칙(canMove)으로 닿는다${reachTxt}.`,
      ...tail,
    ];
    limitations = "지형·배치 참고 사례. 문 이동·NPC 대사·상점 이벤트는 포함하지 않는다(주민 NPC만 배치). 원본 그림 없이 팔레트만 참고한 손 도트다. 자동 생성 프리셋이 아니다.";
  }
  entries.push({
    id: `${slug}-${map.width}x${map.height}`,
    name: src.name,
    kind: "completed-place",
    placeKind: kindId,
    revision: 1,
    x: 0, y: 0, width: map.width, height: map.height,
    tilesetId: map.tilesetId,
    preview: `/assets/region-references/${slug}.png`,
    tilesetPreview: `/${sheetDef.image}`,
    projectDownload: `/assets/region-references/${slug}.oprn.json`,
    sourceProjectId: proof.projectId,
    sourceMapId: mapId,
    snapshotProjectId: `oprn-place-${slug}-v1`,
    rules,
    limitations,
  });
}
const { id, image, tileSize, tilesPerRow, count, passability, priority, terrain } = tileset;
fs.writeFileSync("src/project/regionReferences/joseon-village.json",
  JSON.stringify({ maps, tilesets: { [id]: { id, image, tileSize, tilesPerRow, count, passability, priority, terrain } } }) + "\n");
fs.writeFileSync("src/project/joseonPlaceReferences.ts", `// Generated by scripts/content/prepare-joseon-regions.mjs from a canonical reload.
// The Joseon (joseon_baram) places under 장소: villages, Gungnae, hunting field, cave, house/inn/smith/pharmacy/school/office rooms and palace rooms; snapshots in regionReferences/joseon-village.json.
export const JOSEON_PLACE_REFERENCES = ${JSON.stringify(entries, null, 2)} as const;
`);
// 내려받기 JSON 의 가벼운 타일셋이 프로젝트를 열 때 번들 것으로 완전히 되살아나는지 확인한다(새 프로젝트의 번들 타일셋과 같아야 한다).
await withTsModule("scripts/content/lib/joseon-baram-entry.ts", "joseon-regions-verify.mjs", async (api) => {
  const fresh = api.createJoseonBaramTileset();
  for (const e of entries) {
    const file = JSON.parse(fs.readFileSync(`public${e.projectDownload}`, "utf8"));
    const p = api.createBlankProject();
    p.tilesets = { ...file.tilesets };
    p.maps = file.maps;
    api.ensureBundledTilesets(p);
    assert(isDeepStrictEqual(p.tilesets.joseon_baram, fresh), `${e.id}: 내려받기 JSON 의 타일셋이 번들로 되살아나지 않는다`);
    assert(isDeepStrictEqual(p.maps, file.maps), `${e.id}: 되살리는 중 맵이 바뀌었다`);
  }
  console.log(`내려받기 JSON ${entries.length}장: 가벼운 타일셋이 ensureBundledTilesets 로 번들 타일셋과 같게 되살아난다(맵 불변)`);
});
console.log(entries.map((e) => e.id), { snapshotBytes: fs.statSync("src/project/regionReferences/joseon-village.json").size });
