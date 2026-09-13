import snapshot from "./regionReferences/walled-settlement.json";

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
}] as const;

export function regionReference(id: string) {
  return REGION_REFERENCES.find(entry => entry.id === id);
}

/** Bounded rows let AI recover the complete raster without truncating a single large response. */
export function readRegionReference(id: string, row = 0, rows = 8) {
  const reference = regionReference(id);
  if (!reference) throw new Error(`Unknown region reference: ${id}`);
  if (!Number.isInteger(row) || !Number.isInteger(rows) || row < 0 || row >= reference.height || rows < 1 || rows > 16) {
    throw new Error("row must be within the map; rows must be 1..16");
  }
  const endRow = Math.min(reference.height, row + rows), { map, tileset } = snapshot;
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
  return "## 지역 — 완성 맵 참고 사례\n" + REGION_REFERENCES.map(r =>
    `- ${r.name} (${r.id}, ${r.width}×${r.height}): ${r.rules.join(" ")}\n실제 배치: read_region_reference({id:'${r.id}',row:0,rows:8}), nextRow로 이어 읽기. 읽기 전용 참고 자료이며 생성 계약이 아니다.`
  ).join("\n");
}
