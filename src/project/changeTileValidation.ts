// changeTile 명령의 저작 검증. 로드 시에는 쓰지 않는다(옛 저장본을 막지 않으려고) — 도구 경계(upsert_event·patch_event_page·
// tile_change_effect)와 린트가 쓴다. 실측(2026-10-15 CT 감사): 모델이 `tileId` 를 쓰면 `tile` 이 비어 변경이 조용히 사라졌다.
import type { Project } from "@/project/types";

export const CHANGE_TILE_LAYERS = ["lower", "upper", "lower2", "upper2"] as const;
const CHANGE_TILE_KEYS: ReadonlySet<string> = new Set(["kind", "mapId", "layer", "x", "y", "tile"]);

/** 흔한 틀린 이름 → 맞는 이름. 모르는 키는 이 표에 없어도 거절 문구에 허용 키 목록을 싣는다. */
const CHANGE_TILE_KEY_HINTS: Readonly<Record<string, string>> = {
  tileId: "tile", tileIndex: "tile", tile_id: "tile", gid: "tile", id: "tile", to: "tile", value: "tile",
  map: "mapId", map_id: "mapId", mapID: "mapId",
  layerId: "layer", layerIndex: "layer", z: "layer",
  col: "x", column: "x", row: "y", posX: "x", posY: "y", at: "x와 y",
};

export const CHANGE_TILE_USAGE =
  `changeTile 명령은 {kind:'changeTile', mapId, layer:'${CHANGE_TILE_LAYERS.join("'|'")}', x, y, tile} 만 받는다(lower=1층, lower2=2층, upper=3층, upper2=4층, 그림자는 못 바꾼다). `
  + "한 칸씩 손으로 쓰지 말고 영역을 바꾸는 인과(씨앗을 심으면 다른 시대 맵에 나무가 자란다)는 tile_change_effect 한 호출로 만든다.";

/** 문제 문구 목록. 비면 통과. project 를 주면 맵·좌표·타일 범위까지 본다. */
export function changeTileProblems(command: unknown, project?: Project): string[] {
  if (!command || typeof command !== "object") return ["changeTile 은 객체여야 한다."];
  const record = command as Record<string, unknown>;
  const problems: string[] = [];
  for (const key of Object.keys(record)) {
    if (CHANGE_TILE_KEYS.has(key)) continue;
    const hint = CHANGE_TILE_KEY_HINTS[key];
    problems.push(`알 수 없는 키 '${key}'${hint ? ` — '${hint}' 를 쓴다` : ""}(허용: ${[...CHANGE_TILE_KEYS].filter((k) => k !== "kind").join(", ")}). 모르는 키는 저장되지만 실행기가 읽지 않아 변경이 사라진다.`);
  }
  if (typeof record.mapId !== "string" || !record.mapId) problems.push("mapId(바뀌는 맵의 id 문자열)가 없다.");
  if (!CHANGE_TILE_LAYERS.includes(record.layer as never)) problems.push(`layer 는 ${CHANGE_TILE_LAYERS.join("|")} 중 하나여야 한다(받은 값: ${JSON.stringify(record.layer)}).`);
  for (const key of ["x", "y", "tile"] as const) {
    if (!Number.isInteger(record[key])) problems.push(`${key} 는 정수여야 한다(받은 값: ${JSON.stringify(record[key])}).`);
  }
  if (problems.length > 0 || !project) return problems;
  const map = project.maps[record.mapId as string];
  if (!map) return [`맵 '${String(record.mapId)}' 가 없다. list_maps 로 id 를 확인한다.`];
  const x = record.x as number;
  const y = record.y as number;
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) problems.push(`(${x},${y}) 는 맵 '${map.id}'(${map.width}×${map.height}) 밖이다.`);
  const tileset = project.tilesets[map.tilesetId];
  const tile = record.tile as number;
  if (tileset && (tile < -1 || tile >= tileset.count)) problems.push(`tile ${tile} 은 타일셋 '${map.tilesetId}'(0~${tileset.count - 1}, -1=비움) 밖이다. tile_query 로 번호를 확인한다.`);
  return problems;
}

/** 이벤트·명령 입력 트리에서 changeTile 명령을 모두 찾는다(분기 안까지). */
export function collectChangeTileCommands(node: unknown, found: unknown[] = []): unknown[] {
  if (Array.isArray(node)) {
    for (const entry of node) collectChangeTileCommands(entry, found);
  } else if (node && typeof node === "object") {
    const record = node as Record<string, unknown>;
    if (record.kind === "changeTile") found.push(record);
    for (const value of Object.values(record)) collectChangeTileCommands(value, found);
  }
  return found;
}
