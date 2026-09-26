// editor/tools/vehicleTools.ts
// place_vehicle — 소형선·대형선·비행선을 맵 칸에 세운다(system.vehicles). 탈것 통행은 지형 레코드의
// vehiclePassage(보트·선박·비공정 착륙)가 정하므로 이 도구는 자리만 적고, 자리가 그 탈것에 맞지 않으면 경고한다.
import { airshipCanLand, DEFAULT_VEHICLE_CHARACTER_INDEX, isVehicleId, vehicleCanEnter, type VehicleConfig } from "@/project/vehicles";
import { requireMap } from "./mapHelpers";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

const VEHICLE_LABEL = { boat: "소형선", ship: "대형선", airship: "비행선" } as const;

const placeVehicle: ToolDefinition = {
  name: "place_vehicle",
  description:
    "탈것(boat 소형선 / ship 대형선 / airship 비행선)을 맵 칸에 세운다. {vehicle, mapId, x, y, characterIndex?} — 한 종류당 하나이고 다시 부르면 옮긴다."
    + " 플레이어는 정면의 탈것에 확인 키로 타고, 탄 채로 확인 키를 누르면 내린다. 소형선·대형선은 지형(DB 지형 효과)의 vehiclePassage.boat/ship 이 참인 칸(보통 물)만 가고"
    + " 걸을 수 있는 정면 칸으로 내린다. 비행선은 벽·물을 넘어 날고 vehiclePassage.airshipLand 인 칸에만 내려앉는다."
    + " 물 타일에 지형 태그가 없으면 set_tile_rules 의 terrainTag 로 그 지형 레코드 번호(1부터)를 준다. characterIndex 는 Vehicles 그림 칸(기본 boat 0, ship 1, airship 2).",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      vehicle: { type: "string", enum: ["boat", "ship", "airship"] },
      mapId: { type: "string" },
      x: { type: "integer" },
      y: { type: "integer" },
      characterIndex: { type: "integer", minimum: 0, maximum: 7, description: "Vehicles 캐릭터 시트 칸. 생략 시 종류별 기본값" },
    },
    required: ["vehicle", "mapId", "x", "y"],
    additionalProperties: false,
  },
  invalidArgsExample: { vehicle: "boat", mapId: "map_harbor", x: 6, y: 9 },
  run(draft, args): ToolExecResult {
    const id = args.vehicle;
    if (!isVehicleId(id)) throw new ToolError("vehicle 은 boat / ship / airship 중 하나여야 합니다.", { code: "invalid-args" });
    if (typeof args.mapId !== "string" || !Number.isInteger(args.x) || !Number.isInteger(args.y)) {
      throw new ToolError("mapId(문자열)와 정수 x, y 가 필요합니다.", { code: "invalid-args" });
    }
    const map = requireMap(draft, args.mapId);
    const x = args.x as number;
    const y = args.y as number;
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) {
      throw new ToolError(`(${x},${y}) 는 ${map.name}(${map.width}×${map.height}) 밖입니다.`, { code: "out-of-bounds" });
    }
    const characterIndex = args.characterIndex === undefined ? DEFAULT_VEHICLE_CHARACTER_INDEX[id] : args.characterIndex;
    if (!Number.isInteger(characterIndex) || (characterIndex as number) < 0 || (characterIndex as number) > 7) {
      throw new ToolError("characterIndex 는 0~7 정수여야 합니다.", { code: "invalid-args" });
    }
    const next: VehicleConfig = { id, characterIndex: characterIndex as number, mapId: map.id, x, y };
    const vehicles = (draft.system.vehicles ?? []).filter((entry) => entry.id !== id);
    const moved = vehicles.length !== (draft.system.vehicles ?? []).length;
    draft.system.vehicles = [...vehicles, next];
    const warnings: string[] = [];
    if (id === "airship") {
      if (!airshipCanLand(draft, map, x, y)) warnings.push(`(${x},${y}) 는 비행선 착륙 지형이 아니다 — 여기서 타면 같은 자리에 다시 내릴 수 없다.`);
    } else if (!vehicleCanEnter(draft, map, id, x, y)) {
      warnings.push(`(${x},${y}) 지형이 ${VEHICLE_LABEL[id]} 통행을 허용하지 않는다 — 탈 수는 있지만 한 칸도 못 움직인다. 물 칸에 세우거나 지형의 vehiclePassage 를 켜라.`);
    }
    return {
      summary: `${VEHICLE_LABEL[id]} ${moved ? "옮김" : "배치"}: ${map.name}(${x},${y})`,
      data: next,
      ...(warnings.length ? { warnings } : {}),
    };
  },
};

export const VEHICLE_TOOLS: readonly ToolDefinition[] = [placeVehicle];
