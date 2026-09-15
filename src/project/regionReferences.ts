import emeraldSnapshot from "./regionReferences/emerald-basin.json";
import snapshot from "./regionReferences/walled-settlement.json";
import lakeSnapshot from "./regionReferences/lake-village.json";
import castleSnapshot from "./regionReferences/castle-town.json";

/** Fixed authored examples, independent of procedural RegionDesign and the active project. */
export const REGION_REFERENCES = [{
  id: "walled-settlement-43x45", name: "성벽으로 둘러싸인 정주지", kind: "completed-map" as const,
  revision: 1, width: 43, height: 45, tilesetId: snapshot.tileset.id,
  preview: "/assets/region-references/walled-settlement.png",
  sourceProjectId: "rpg-zzu-reference-houses-20260913-6890",
  sourceMapId: snapshot.map.id,
  snapshotProjectId: "rpg-zzu-region-reference-walled-settlement-v1",
  rules: [
    "성벽의 수직 벽면은 3칸. 난간·보행로는 별도이며 동쪽 계단으로 접근한다.",
    "집의 삼각 박공 아래 기본 벽 높이는 3칸. 위쪽 두 집은 ㅜ자 돌출 구조다.",
    "지붕 접합부의 빈 칸을 채우고 경사와 벽의 끝기둥을 연결한다. 여관은 두 봉우리다.",
    "성문 입구와 마을 길은 모래길. 성벽 보행로·쉼터·우물 주변은 일반 판석이다.",
    "과일상자는 마을 상단에 모으고 텃밭·풀숲·덩굴로 꾸민다. 문 앞과 계단 동선은 비운다.",
    "중앙 길 옆에 우물과 물통, 성문 양옆에 횃불, 여관 옆에 장작과 항아리를 둔다.",
  ],
  limitations: "완성 맵 참고 사례. 생성 프리셋이나 배치 명령이 아니다. 실내·우물 상호작용은 포함하지 않는다.",
}, {
  id: "castle-town-100x100", name: "왕궁이 있는 이중 성벽 도시", kind: "completed-map" as const,
  revision: 1, width: 100, height: 100, tilesetId: castleSnapshot.tileset.id,
  preview: "/assets/region-references/castle-town.png",
  sourceProjectId: "rpg-zzu-castle-town-100-20260913-6890",
  sourceMapId: castleSnapshot.map.id,
  snapshotProjectId: "rpg-zzu-region-reference-castle-town-v1",
  rules: [
    "100×100 도시. 북쪽에 강이 흐르고, 외성과 내성을 떨어뜨려 배치한다. 각 성벽은 남쪽 문만 개방한다.",
    "외성·내성 각각 왼쪽 아래와 오른쪽 아래에 원형 탑 두 개를 둔다. 계단은 성벽 위 보행로에 연결한다.",
    "중앙 왕궁은 3층 외관으로 북쪽 성벽 위로 솟는다. 층별 창과 이어지는 지붕·처마로 높이를 표현한다.",
    "내성은 석재 마당 중심이며 작은 정원 두 곳에 나무·꽃·벤치를 모은다.",
    "남문에서 이어지는 중앙 대로는 5칸. 주택가의 가지 길과 북쪽 통로는 테두리가 이어지는 포장으로 구분한다.",
    "작은 회벽 주택 34채를 불규칙하게 배치하고 박공·가로 지붕·돌출형을 섞는다. 통나무 벽은 쓰지 않는다.",
    "사용자가 최종 수정한 길·정원·궁전 입구·지붕 배치를 그대로 동결한 참고 자료다.",
  ],
  limitations: "외관 배치 참고 사례. 궁전 3개 층의 실내 맵과 상호작용은 포함하지 않는다. 사용자 최종 수정 이후의 플레이 검증은 별도다.",
}, {
  id: "lake-village-60x60", name: "숲과 선착장이 있는 호수마을", kind: "completed-map" as const,
  revision: 1, width: 60, height: 60, tilesetId: lakeSnapshot.tileset.id,
  preview: "/assets/region-references/lake-village.png",
  sourceProjectId: "rpg-zzu-lake-village-60-20260913-6890", sourceMapId: lakeSnapshot.map.id,
  snapshotProjectId: "rpg-zzu-region-reference-lake-village-v1",
  rules: ["호숫가를 도는 모래길과 작은 집 13채. 선착장 앞은 짐을 놓는 넓은 공터다.",
    "2×2 활엽수와 1×2 나무를 섞고, 하층 줄기 위로 상층 수관을 대각으로 겹친다.",
    "울타리 마당·텃밭·우물 쉼터를 배치하고 소품은 작업과 생활 공간별로 모은다.",
    "키 큰 풀은 숲과 물가에 불규칙하게 모으며 마른 나무는 드물게 둔다. 선착장 양끝에 사다리가 있다."],
  limitations: "외관 참고 사례. 실내·낚시·수영·NPC 상호작용은 포함하지 않는다.",
}] as const;

const LAKE_PLACE_REFERENCES = [
  { id: "lake-pier-workyard", name: "호숫가 선착장 작업터", x: 29, y: 33, width: 14, height: 13,
    rules: ["T자 선착장과 양끝 사다리. 진입 공터의 상자·통은 가운데 통로를 비우고 옆으로 모은다."] },
  { id: "lake-well-rest", name: "호수마을 우물 쉼터", x: 20, y: 35, width: 10, height: 11,
    rules: ["우물은 돌바닥 위에 놓고 벤치와 호숫길을 연결한다."] },
  { id: "lake-cottage-garden", name: "덩굴집과 텃밭 마당", x: 3, y: 30, width: 13, height: 13,
    rules: ["회벽 집 옆에 작은 텃밭과 과일상자를 모으고 덩굴과 나무로 마당을 구분한다."] },
].map(place => ({ ...REGION_REFERENCES[2], ...place, kind: "completed-place" as const,
  preview: `/assets/region-references/${place.id}.png`,
  limitations: "호수마을 저장본에서 추출한 읽기 전용 배치 사례. 이벤트는 포함하지 않는다." }));


/** Shipped place examples remain visible even in a new, empty project. */
export const PLACE_REFERENCES = [...LAKE_PLACE_REFERENCES, {
  id: "emerald-basin-80x64", name: "비취 대계곡", kind: "completed-place" as const,
  placeKind: "natural" as const, revision: 1, x: 0, y: 0, width: 80, height: 64,
  tilesetId: emeraldSnapshot.tileset.id,
  preview: "/assets/region-references/emerald-basin.png",
  tilesetPreview: "/assets/region-references/emerald-basin-atlas.png",
  sourceProjectId: "rpg-zzu-house-template-gallery", sourceMapId: emeraldSnapshot.map.id,
  rules: [
    "쌍폭포에서 시작된 강이 굽어 흐르고 지류와 합류한다. 다리는 양쪽 강둑과 길을 잇는다.",
    "대각 절벽의 윗선과 아랫선을 연결하고, 계단 높이를 해당 절벽 높이에 맞춘다.",
    "서쪽·동쪽·남쪽 길을 맵 끝까지 연결해 다음 맵으로 이어질 자리를 남긴다.",
    "활엽수·침엽수·관목은 군락으로 모으고 다리 입구와 계단 동선은 비운다.",
  ],
  limitations: "완성 필드 배치 참고 사례. 프로젝트와 관계없이 표시된다. 자동 생성·현재 맵 배치 기능은 포함하지 않는다.",
}];


export function regionReference(id: string) {
  return [...REGION_REFERENCES, ...PLACE_REFERENCES].find(entry => entry.id === id);
}

/** Bounded rows let AI recover the complete raster without truncating a single large response. */
export function readRegionReference(id: string, row = 0, rows = 8) {
  const reference = regionReference(id);
  if (!reference) throw new Error(`Unknown region reference: ${id}`);
  if (!Number.isInteger(row) || !Number.isInteger(rows) || row < 0 || row >= reference.height || rows < 1 || rows > 16) {
    throw new Error("row must be within the map; rows must be 1..16");
  }
  const place = LAKE_PLACE_REFERENCES.find(p => p.id === id);
  const source = reference.id === "emerald-basin-80x64" ? emeraldSnapshot : reference.id === "castle-town-100x100" ? castleSnapshot : reference.id === "walled-settlement-43x45" ? snapshot : lakeSnapshot;
  const crop = (tiles: number[]) => Array.from({length: reference.height}, (_, y) => tiles.slice((y + (place?.y ?? 0)) * source.map.width + (place?.x ?? 0), (y + (place?.y ?? 0)) * source.map.width + (place?.x ?? 0) + reference.width)).flat();
  const selected = place ? { ...source, map: { ...source.map, width: place.width, height: place.height, lowerTiles: crop(source.map.lowerTiles), upperTiles: crop(source.map.upperTiles), events: [] } } : source;
  const endRow = Math.min(reference.height, row + rows), { map, tileset } = selected;
  const lowerTiles = map.lowerTiles.slice(row * map.width, endRow * map.width);
  const upperTiles = map.upperTiles.slice(row * map.width, endRow * map.width);
  const used = [...new Set([...lowerTiles, ...upperTiles])].filter(tile => tile >= 0);
  return structuredClone({ ...reference, map: {
    id: map.id, width: map.width, height: map.height, tileSize: map.tileSize,
    tilesetId: map.tilesetId, row, rows: endRow - row, nextRow: endRow < map.height ? endRow : null,
    lowerTiles, upperTiles, events: map.events,
  }, tileset: { id: tileset.id, image: tileset.image, tileSize: tileset.tileSize, tilesPerRow: tileset.tilesPerRow,
    tiles: used.map(tile => ({ tile, passability: tileset.passability[tile], priority: tileset.priority[tile], terrain: tileset.terrain[tile] })),
  } });
}

export function regionReferenceContext(): string {
  return "## 지역 — 완성 맵 참고 사례\n" + [...REGION_REFERENCES, ...PLACE_REFERENCES].map(r =>
    `- ${r.name} (${r.id}, ${r.width}×${r.height}): ${r.rules.join(" ")}\n실제 배치: read_region_reference({id:'${r.id}',row:0,rows:8}), nextRow로 이어 읽기. 읽기 전용 참고 자료이며 생성 계약이 아니다.`
  ).join("\n");
}
