// editor/tools/vehicleTools.ts
// place_vehicle — 소형선·대형선·비행선·초코보·광산 수레·뗏목을 맵 칸에 세운다(system.vehicles). 탈것 통행은 지형 레코드의
// vehiclePassage(boat·ship·raft·chocobo·cart·airshipLand)와 칸 이름표(물·레일·숲)가 정하므로 이 도구는 자리만 적고, 자리가 그 탈것에 맞지 않으면 경고한다.
import { airshipCanLand, DEFAULT_VEHICLE_CHARACTER_INDEX, isVehicleId, vehicleCanEnter, type VehicleConfig } from "@/project/vehicles";
import { requireMap } from "./mapHelpers";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

const VEHICLE_LABEL = { boat: "소형선", ship: "대형선", airship: "비행선", chocobo: "초코보", cart: "광산 수레", raft: "뗏목" } as const;
const VEHICLE_HINT = {
  boat: "물 칸에 세우거나 지형의 vehiclePassage.boat 를 켜라.",
  ship: "바다 칸에 세우거나 지형의 vehiclePassage.ship 을 켜라.",
  raft: "강 칸에 세우거나 지형의 vehiclePassage.raft 를 켜라.",
  chocobo: "걸을 수 있는 칸이나 숲 칸에 세워라(물·산은 안 된다).",
  cart: "레일 칸(칸 이름 선로·레일·궤도)에 세우거나 지형의 vehiclePassage.cart 를 켜라 — 레일 타일이 칩셋에 없으면 업로드·타일 이름표로 붙여야 한다.",
  airship: "",
} as const;
const ALLOWED_KEYS = ["vehicle", "mapId", "x", "y", "characterIndex", "flightView"] as const;

const placeVehicle: ToolDefinition = {
  name: "place_vehicle",
  description:
    "탈것(boat 소형선 / ship 대형선 / airship 비행선 / chocobo 초코보 / cart 광산 수레 / raft 뗏목)을 맵 칸에 세운다. {vehicle, mapId, x, y, characterIndex?} — 한 종류당 하나이고 다시 부르면 옮긴다."
    + " 플레이어는 정면의 탈것에 확인 키로 타고, 탄 채로 확인 키를 누르면 내린다(걸을 수 있는 정면 칸으로 내리고 탈것은 그 자리에 남는다)."
    + " 통행 규칙: 소형선·대형선 = 지형(DB 지형 효과) vehiclePassage.boat/ship 이 참인 칸(물). 뗏목 = raft 가 참인 강(·얕은 물) — 바다는 못 간다."
    + " 초코보 = 걸을 수 있는 칸 + 숲(걸을 수 없는 숲 포함)을 지나고 물·산은 못 간다(걸음 두 배). 광산 수레 = 칸 이름에 선로·레일·궤도가 있는 레일 칸(또는 vehiclePassage.cart)에서만 달린다(걸음 두 배)."
    + " 비행선은 벽·물을 넘어 날고 걸을 수 있는 칸에 내려앉는다(지형 기록이 있으면 airshipLand 를 따른다)."
    + " 월드맵 키트 지도는 지형 태그가 이미 붙어 있다(바다 boat·ship, 강 boat·raft, 숲 chocobo). 물 타일에 태그가 없으면 set_tile_rules 의 terrainTag 로 지형 레코드 번호(1부터)를 준다."
    + " 비행선에는 flightView:\"mode7\" 로 FF6식 비행 시점(타는 동안 멀리 보기 + 지평선 원근)을 켤 수 있다 — 생략하면 기존 탑뷰 그대로."
    + " characterIndex 는 그림 칸(기본 boat 0·ship 1·airship 2 = Vehicles 시트, 초코보 5 = Animal 시트의 말, 광산 수레 5(임시: 무한궤도 차)·뗏목 0 = Vehicles 시트). 전용 수레·초코보 도트가 생기면 칸만 바꾸면 된다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      vehicle: { type: "string", enum: ["boat", "ship", "airship", "chocobo", "cart", "raft"] },
      mapId: { type: "string" },
      x: { type: "integer" },
      y: { type: "integer" },
      flightView: { type: "string", enum: ["mode7", "flat"], description: "비행선 전용 시점. mode7 = 타는 동안 멀리 보기 + 지평선 원근 필터(WebGL 에서만, 캔버스는 멀리 보기만). flat 또는 생략 = 기존 탑뷰(다시 호출해 생략하면 앞서 정한 값을 유지, flat 이면 해제). 비행선이 아니면 무시하고 경고한다. 알려진 한계: 비행선·주인공 스프라이트가 원근으로 약간 납작해 보인다." },
      characterIndex: { type: "integer", minimum: 0, maximum: 7, description: "탈것 그림 칸(0~7; 초코보는 Animal 시트, 나머지는 Vehicles 시트). 생략 시 종류별 기본값" },
    },
    required: ["vehicle", "mapId", "x", "y"],
    additionalProperties: false,
  },
  invalidArgsExample: { vehicle: "boat", mapId: "map_harbor", x: 6, y: 9 },
  run(draft, args): ToolExecResult {
    const extraKeys = Object.keys(args).filter((key) => !(ALLOWED_KEYS as readonly string[]).includes(key));
    if (extraKeys.length) throw new ToolError(`place_vehicle 이 모르는 인자: ${extraKeys.join(", ")} — 있는 것: ${ALLOWED_KEYS.join(", ")}.`, { code: "invalid-args" });
    const id = args.vehicle;
    if (!isVehicleId(id)) throw new ToolError("vehicle 은 boat / ship / airship / chocobo / cart / raft 중 하나여야 합니다.", { code: "invalid-args" });
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
    if (args.flightView !== undefined && args.flightView !== "mode7" && args.flightView !== "flat") {
      throw new ToolError("flightView 는 mode7 | flat 중 하나여야 합니다 — 생략하면 기존 탑뷰(또는 앞서 정한 값)를 유지합니다.", { code: "invalid-args" });
    }
    const previousView = (draft.system.vehicles ?? []).find((entry) => entry.id === id)?.flightView;
    const flightView = id === "airship" ? (args.flightView === undefined ? previousView : args.flightView === "mode7" ? ("mode7" as const) : undefined) : undefined;
    const next: VehicleConfig = { id, characterIndex: characterIndex as number, mapId: map.id, x, y, ...(flightView ? { flightView } : {}) };
    const vehicles = (draft.system.vehicles ?? []).filter((entry) => entry.id !== id);
    const moved = vehicles.length !== (draft.system.vehicles ?? []).length;
    draft.system.vehicles = [...vehicles, next];
    const warnings: string[] = [];
    if (args.flightView !== undefined && id !== "airship") warnings.push(`flightView 는 비행선(airship) 전용이라 ${VEHICLE_LABEL[id]} 에는 적용되지 않는다(무시).`);
    if (flightView === "mode7") warnings.push("비행 시점 mode7 은 WebGL 에서만 원근이 그려진다(캔버스 렌더러는 멀리 보기만). 비행선·주인공 그림이 원근으로 약간 납작해 보이는 것은 알려진 한계다.");
    if (id === "airship") {
      if (!airshipCanLand(draft, map, x, y)) warnings.push(`(${x},${y}) 는 비행선 착륙 지형이 아니다 — 여기서 타면 같은 자리에 다시 내릴 수 없다.`);
    } else if (!vehicleCanEnter(draft, map, id, x, y)) {
      warnings.push(`(${x},${y}) 지형이 ${VEHICLE_LABEL[id]} 통행을 허용하지 않는다 — 탈 수는 있지만 한 칸도 못 움직인다. ${VEHICLE_HINT[id]}`);
    }
    return {
      summary: `${VEHICLE_LABEL[id]} ${moved ? "옮김" : "배치"}: ${map.name}(${x},${y})`,
      data: next,
      ...(warnings.length ? { warnings } : {}),
    };
  },
};

export const VEHICLE_TOOLS: readonly ToolDefinition[] = [placeVehicle];
