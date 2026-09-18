import frozen from "./regionReferences/ships.json";
import type { GameMap, TilesetDef, UploadedAsset } from "./types";

/** Approved, remotely persisted ships and quay; independent of the selected project. */
const source = frozen as unknown as {
  sourceProjectId: string;
  maps: Record<string, GameMap>;
  tilesets: Record<string, TilesetDef>;
  assets: Record<string, UploadedAsset>;
};
const entries = [
  ["bluewave-ship", "map_bluewave_ship", "푸른물결호 · 갑판", "왼쪽 뱃머리의 중앙에 선수 장식을 놓고 갑판·선미 난간을 이어 붙인다."],
  ["giant-ship", "map_bluewave_giant", "해왕호 · 대형선 갑판", "가로로 긴 선체에 높은 갑판 두 구획을 배치한다."],
  ["wide-ship", "map_bluewave_vertical", "북극성호 · 광폭 대형선 갑판", "배의 방향은 가로로 유지하며 선체의 위아래 폭을 넓힌다."],
  ["bluewave-harbor", "map_bluewave_harbor", "푸른물결항 · 돌부두와 배", "건물 없이 돌부두·화물 부두·정박한 배로 구성한다. 승선 다리는 높은 갑판 중앙에 연결한다."],
] as const;

export const SHIP_PLACE_REFERENCES = entries.map(([id, mapId, name, rule]) => {
  const map = source.maps[mapId];
  return {
    id, name, kind: "completed-place" as const, revision: 1, x: 0, y: 0,
    width: map.width, height: map.height, tilesetId: map.tilesetId,
    preview: `/assets/region-references/${id}.png`,
    sourceProjectId: source.sourceProjectId, sourceMapId: mapId,
    snapshotProjectId: source.sourceProjectId,
    rules: [rule, "배 · EasyRPG (CC0) 타일을 조립한 승인된 저장본이다."],
    limitations: "기본 장소의 읽기 전용 완성 사례입니다. 원본 이벤트·연결은 자료에 보존되며, 이 카드를 보는 것만으로 현재 프로젝트에 맵이 배치되지는 않습니다.",
  };
});

export function shipPlaceSnapshot(id: string) {
  const entry = SHIP_PLACE_REFERENCES.find(candidate => candidate.id === id);
  if (!entry) return undefined;
  const map = source.maps[entry.sourceMapId];
  return { map, tileset: source.tilesets[map.tilesetId] };
}
