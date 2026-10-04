import { WORLDMAP_SELECTED_ICONS, WORLDMAP_SELECTED_ID, WORLDMAP_SELECTED_TEXTURE } from "@/project/defaults/worldmapSelected";
import { tilePassability } from "@/project/collision";
import { topTileInStack } from "@/project/mapOverlayTiles";
import { requireMap } from "./mapHelpers";
import { ToolError, type ToolDefinition } from "./types";

/** 번들의 사람 선택 사전만 노출한다. 검수 합격·미선택 후보는 이 목록에 없다. */
const list: ToolDefinition = {
  name: "list_worldmap_icons",
  mode: "read",
  description: "사람이 선택해 공용으로 구운 월드맵 아이콘 목록. theme·query로 거른다. 정확한 id·크기·용도·원본 SHA256·참고문서를 돌려준다. stamp_worldmap_icon으로 전체를 찍는다.",
  parameters: { type: "object", properties: { theme: { type: "string" }, query: { type: "string" } }, additionalProperties: false },
  run(_project, args) {
    const query = String(args.query ?? "").toLowerCase();
    const icons = WORLDMAP_SELECTED_ICONS.filter((i) => (!args.theme || i.theme === args.theme)
      && (!query || `${i.id} ${i.name} ${i.role}`.toLowerCase().includes(query)))
      .map((i) => ({ id: i.id, name: i.name, theme: i.theme, role: i.role, width: i.width, height: i.height, sha256: i.sha256, referenceCategoryId: "wmi-" + i.theme }));
    return { summary: `사람 선택 월드맵 아이콘 ${icons.length}개`, data: { sourceTilesetId: WORLDMAP_SELECTED_ID,
      references: "list_tileset_references / read_tileset_reference({tilesetId:worldmap_selected,categoryId:...})", icons } };
  },
};

const stamp: ToolDefinition = {
  name: "stamp_worldmap_icon",
  mode: "write",
  description: "사람 선택 월드맵 아이콘 전체를 at(왼쪽 위 16px 칸)에 찍는다. iconId=list_worldmap_icons의 id. 참고문서는 worldmap_selected에서 먼저 읽는다. 생성된 지도에도 타일 이식으로 찍으며 지형·타일셋 id를 보존한다. 맵 밖·기존 위층·막힌 육지 받침이면 전체 거부. 입구·접근 칸을 돌려주며 이동 이벤트는 별도로 연결한다.",
  parameters: { type: "object", properties: {
    mapId: { type: "string" }, iconId: { type: "string" },
    at: { type: "object", properties: { x: { type: "integer" }, y: { type: "integer" } }, required: ["x", "y"], additionalProperties: false },
  }, required: ["mapId", "iconId", "at"], additionalProperties: false },
  run(project, args) {
    const map = requireMap(project, args.mapId as string);
    const icon = WORLDMAP_SELECTED_ICONS.find((i) => i.id === args.iconId);
    if (!icon) throw new ToolError("사람 선택 목록에 없는 아이콘입니다. list_worldmap_icons에서 id를 읽으세요.", { code: "icon-not-selected" });
    const target = project.tilesets[map.tilesetId];
    const source = project.tilesets[WORLDMAP_SELECTED_ID];
    if (!source || !target || target.tileSize !== 16) throw new ToolError("16px 월드맵과 공용 worldmap_selected 타일셋이 필요합니다.", { code: "incompatible-tileset" });
    const at = args.at as { x: number; y: number };
    if (!at || !Number.isInteger(at.x) || !Number.isInteger(at.y) || at.x < 0 || at.y < 0
      || at.x + icon.width > map.width || at.y + icon.height >= map.height) {
      throw new ToolError("아이콘과 바로 아래 접근 줄이 맵 안에 있어야 합니다.", { code: "out-of-bounds" });
    }
    const entrance = { x: at.x + Math.floor(icon.width / 2), y: at.y + icon.height - 1 };
    const approach = { x: entrance.x, y: entrance.y + 1 };
    const ground = (index: number) => {
      const overlay = map.lowerOverlayTiles?.[index] ?? -1;
      return topTileInStack(map, "lower", index) ?? (overlay >= 0 ? overlay : map.lowerTiles[index] ?? -1);
    };
    for (let dy = 0; dy < icon.height; dy++) for (let dx = 0; dx < icon.width; dx++) {
      const index = (at.y + dy) * map.width + at.x + dx;
      if ((map.upperTiles[index] ?? -1) >= 0 || (map.upperOverlayTiles?.[index] ?? -1) >= 0 || topTileInStack(map, "upper", index) != null) {
        throw new ToolError("아이콘 자리의 위층이 비어 있지 않습니다.", { code: "occupied", x: at.x + dx, y: at.y + dy });
      }
      if (icon.role !== "floating" && dy === icon.height - 1) {
        const pass = tilePassability(target, ground(index), -1);
        if (!pass.up || !pass.down || !pass.left || !pass.right) throw new ToolError("밑줄은 열린 육지 받침에만 놓습니다.", { code: "blocked-backing", x: at.x + dx, y: at.y + dy });
      }
    }
    if (icon.role !== "floating") {
      const index = approach.y * map.width + approach.x;
      const overlay = map.upperOverlayTiles?.[index] ?? -1;
      const upper = topTileInStack(map, "upper", index) ?? (overlay >= 0 ? overlay : map.upperTiles[index] ?? -1);
      const pass = tilePassability(target, ground(index), upper);
      if (!pass.up || !pass.down || !pass.left || !pass.right) throw new ToolError("입구 바로 아래 접근 칸이 막혔습니다.", { code: "blocked-approach", ...approach });
    }
    // 모든 거부 조건 확인 후에만 슬롯·맵을 바꾼다. 이식은 덧붙이며 같은 소스 칸은 재사용한다.
    const grafts = [...(target.tileGrafts ?? [])];
    const mapping = new Map<number, number>();
    for (const tile of icon.rows.flat()) {
      if (target.image.type === "bundled" && target.image.id === WORLDMAP_SELECTED_TEXTURE) { mapping.set(tile, tile); continue; }
      const existing = grafts.find((g) => g.sourceChipset === WORLDMAP_SELECTED_TEXTURE && g.sourceTile === tile);
      const id = existing?.targetTile ?? target.count++;
      if (!existing) grafts.push({ targetTile: id, sourceChipset: WORLDMAP_SELECTED_TEXTURE, sourceTile: tile });
      target.passability[id] = { ...source.passability[tile]! };
      target.priority[id] = "upper";
      target.terrain[id] = 0;
      target.tileMeta ??= [];
      target.tileMeta[id] = { ...source.tileMeta![tile]! };
      mapping.set(tile, id);
    }
    if (grafts.length) target.tileGrafts = grafts;
    for (let dy = 0; dy < icon.height; dy++) for (let dx = 0; dx < icon.width; dx++) {
      map.upperTiles[(at.y + dy) * map.width + at.x + dx] = mapping.get(icon.rows[dy]![dx]!)!;
    }
    return { summary: `${map.name}: ${icon.name} ${icon.width}×${icon.height} (${at.x},${at.y}) 배치`,
      data: { iconId: icon.id, sha256: icon.sha256, entrance, approach, tilesetId: map.tilesetId, eventsCreated: false } };
  },
};

const inspect: ToolDefinition = {
  name: "inspect_worldmap_icon",
  mode: "read",
  description: "찍은 월드맵 아이콘을 공용 정답 배열과 대조한다. 누락·다른 칸·범위 밖을 실제 맵 좌표와 코드로 돌려준다. 타일 이식도 소스 번호로 해석한다. 이벤트 실행·미적 품질 판정은 별도다.",
  parameters: stamp.parameters,
  run(project, args) {
    const map = requireMap(project, args.mapId as string);
    const icon = WORLDMAP_SELECTED_ICONS.find((i) => i.id === args.iconId);
    if (!icon) throw new ToolError("사람 선택 목록에 없는 아이콘입니다.", { code: "icon-not-selected" });
    const t = project.tilesets[map.tilesetId]!;
    const at = args.at as {x:number;y:number};
    if (!at || !Number.isInteger(at.x) || !Number.isInteger(at.y)) throw new ToolError("at는 정수 좌표입니다.");
    const issues = [];
    for (let dy = 0; dy < icon.height; dy++) for (let dx = 0; dx < icon.width; dx++) {
      const x = at.x + dx, y = at.y + dy, expected = icon.rows[dy]![dx]!;
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) { issues.push({ code:"OUT_OF_BOUNDS",x,y }); continue; }
      const actual = map.upperTiles[y * map.width + x] ?? -1;
      const graft = t.tileGrafts?.find((g) => g.targetTile === actual);
      const resolved = graft ? (graft.sourceChipset === WORLDMAP_SELECTED_TEXTURE ? graft.sourceTile : -1)
        : t.image.type === "bundled" && t.image.id === WORLDMAP_SELECTED_TEXTURE ? actual : -1;
      if (resolved !== expected) issues.push({code:actual < 0 ? "MISSING_CELL" : "WRONG_CELL",x,y,expected,actual});
    }
    return {summary:`${icon.name}: ${issues.length ? `${issues.length}칸 불일치` : "전체 배열 일치"}`,data:{ok:issues.length===0,iconId:icon.id,sha256:icon.sha256,issues}};
  },
};

export const WORLDMAP_ICON_TOOLS: readonly ToolDefinition[] = [list, stamp, inspect];
