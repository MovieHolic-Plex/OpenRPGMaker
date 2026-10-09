// editor/tools/mapLocationTools.ts
// 조수가 명명 로케이션을 **읽고 해석하고 만드는** 툴. 목표는 하나다:
// 사용자가 "정문 광장"이라고 말하면 조수가 좌표를 되묻지 않고 바로 그 사각형을 쓴다.
//
// `find_layout_regions`(queryTools.ts) 와 역할이 다르다. 그쪽은 **마을 빌더의 설계 기록**을 본다.
// 이쪽은 **사람이 저작한 로케이션 레이어**를 본다. 승격(빌더 영역 → 로케이션)은
// `adopt_layout_regions` 한 방향뿐이며 layoutPlan 을 바꾸지 않는다.
//
// 이관은 두 툴로 나뉜다: `survey_layout_adoption`(읽기 전용 조사, 먼저) → `adopt_layout_regions`(실행).
// 실행 툴의 `roles` 기본값은 **전부가 아니라** `DEFAULT_ADOPTION_ROLES`(광장·장터)다 —
// 근거는 `project/mapLocationAdoption.ts` 상단.

import {
  DEFAULT_ADOPTION_ROLES,
  adoptLayoutRegionsForMaps,
  adoptionRoleCaution,
  adoptionRoleLabel,
  describeAdoptionOutcome,
  surveyProjectAdoption,
} from "@/project/mapLocationAdoption";
import {
  addMapLocation,
  deleteMapLocation,
  describeLocation,
  findLocationById,
  mapLocations,
  overlappingLocations,
  renameMapLocation,
  resizeMapLocation,
  resolveLocation,
  topLocationAtPoint,
} from "@/project/mapNamedLocations";
import {
  countLocationReferences,
  describeLocationReferenceImpact,
  repairMapLocationReferences,
  type LocationRepairPlan,
} from "@/project/mapLocationReferences";
import type { GameMap, MapNamedLocation } from "@/project/types";
import { requireMap } from "./mapHelpers";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

function locationData(location: MapNamedLocation): Record<string, unknown> {
  return {
    id: location.id,
    name: location.name,
    x: location.x,
    y: location.y,
    w: location.w,
    h: location.h,
    ...(location.note === undefined ? {} : { note: location.note }),
    ...(location.tags === undefined ? {} : { tags: location.tags }),
    ...(location.origin === undefined ? {} : { origin: location.origin }),
  };
}

function requireLocation(map: GameMap, idOrName: string): MapNamedLocation {
  const location = resolveLocation(map, idOrName);
  if (!location) {
    const known = mapLocations(map).map((entry) => `${entry.name}(${entry.id})`).join(", ") || "(없음)";
    throw new ToolError(`로케이션을 찾을 수 없습니다: ${idOrName}. 이 맵의 로케이션: ${known}`, {
      code: "location-not-found",
      mapId: map.id,
    });
  }
  return location;
}

const listMapLocations: ToolDefinition = {
  name: "list_map_locations",
  description:
    "맵의 명명 로케이션(사람이 이름 붙인 구역) 전량을 반환한다. 사용자가 '광장', '북쪽 숲' 처럼 장소 이름을 말하면 " +
    "좌표를 되묻지 말고 이 툴로 먼저 사각형을 얻어라. 마을 빌더의 설계 기록(layoutPlan.regions)은 find_layout_regions 가 본다 — 서로 다른 층이다.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
    },
    required: ["mapId"],
    additionalProperties: false,
  },
  run(project, args): ToolExecResult {
    const map = requireMap(project, args.mapId as string);
    const locations = mapLocations(map);
    return {
      summary:
        locations.length === 0
          ? `${map.name} 맵에 명명 로케이션이 없습니다. create_map_location 으로 만들거나 사용자에게 로케이션 레이어에서 그려 달라고 하세요.`
          : `로케이션 ${locations.length}개(${map.name}) — ${locations.map(describeLocation).join(" / ")}`,
      data: { locations: locations.map(locationData) },
    };
  },
};

const resolveMapLocation: ToolDefinition = {
  name: "resolve_map_location",
  description:
    "이름 또는 ID 로 로케이션 하나를 해석해 사각형(x,y,w,h)과 안정 ID 를 돌려준다. 이름은 부분일치도 허용한다. " +
    "point(x,y) 를 주면 그 칸을 덮는 가장 구체적인(면적이 작은) 로케이션을 돌려준다.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      query: { type: "string", description: "로케이션 이름 또는 ID" },
      x: { type: "integer", description: "point 조회용 타일 x" },
      y: { type: "integer", description: "point 조회용 타일 y" },
    },
    required: ["mapId"],
    additionalProperties: false,
  },
  run(project, args): ToolExecResult {
    const map = requireMap(project, args.mapId as string);
    if (typeof args.x === "number" && typeof args.y === "number") {
      const hit = topLocationAtPoint(map, { x: args.x, y: args.y });
      return hit
        ? { summary: `(${args.x},${args.y}) 는 ${describeLocation(hit)} 안입니다.`, data: { location: locationData(hit) } }
        : { summary: `(${args.x},${args.y}) 를 덮는 로케이션이 없습니다.`, data: { location: null } };
    }
    const query = typeof args.query === "string" ? args.query : "";
    if (!query.trim()) throw new ToolError("query 또는 x/y 중 하나는 필요합니다.", { code: "invalid-args", mapId: map.id });
    const location = requireLocation(map, query);
    const overlaps = overlappingLocations(map, location.id);
    return {
      summary: `${describeLocation(location)}${overlaps.length ? ` (겹침 ${overlaps.length}개)` : ""}`,
      data: { location: locationData(location), overlaps: overlaps.map(locationData) },
    };
  },
};

const createMapLocation: ToolDefinition = {
  name: "create_map_location",
  description:
    "맵에 이름 붙은 로케이션을 새로 만든다. 이후 이벤트 조건분기(구역 안/밖)와 랜덤 인카운터가 사각형을 복사하지 않고 이 ID 를 가리킬 수 있다. " +
    "겹침은 허용된다(상점가 안의 좌판처럼 포함 관계가 정상 저작이다).",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      name: { type: "string", description: "사용자에게 보이는 이름" },
      x: { type: "integer" },
      y: { type: "integer" },
      w: { type: "integer", minimum: 1 },
      h: { type: "integer", minimum: 1 },
      note: { type: "string", description: "저작 의도 메모" },
      tags: { type: "array", items: { type: "string" } },
    },
    required: ["mapId", "name", "x", "y", "w", "h"],
    additionalProperties: false,
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const result = addMapLocation(map, {
      name: args.name as string,
      x: args.x as number,
      y: args.y as number,
      w: args.w as number,
      h: args.h as number,
      ...(typeof args.note === "string" ? { note: args.note } : {}),
      ...(Array.isArray(args.tags) ? { tags: args.tags as string[] } : {}),
    });
    if (!result.ok) throw new ToolError(result.error, { code: "invalid-args", mapId: map.id });
    return { summary: `로케이션 생성 — ${describeLocation(result.location)}`, data: { location: locationData(result.location) } };
  },
};

const updateMapLocation: ToolDefinition = {
  name: "update_map_location",
  description:
    "로케이션의 이름 또는 사각형을 바꾼다. **이름을 바꿔도 ID 는 그대로**라 이벤트 조건·인카운터 참조가 끊기지 않는다. " +
    "사각형을 바꾸면 그 로케이션을 가리키는 모든 조건과 인카운터가 함께 따라간다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      locationId: { type: "string", description: "ID 또는 현재 이름" },
      name: { type: "string", description: "새 이름" },
      x: { type: "integer" },
      y: { type: "integer" },
      w: { type: "integer", minimum: 1 },
      h: { type: "integer", minimum: 1 },
    },
    required: ["mapId", "locationId"],
    additionalProperties: false,
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const location = requireLocation(map, args.locationId as string);
    const changes: string[] = [];
    if (typeof args.name === "string") {
      const renamed = renameMapLocation(map, location.id, args.name);
      if (!renamed.ok) throw new ToolError(renamed.error, { code: "invalid-args", mapId: map.id });
      changes.push(`이름 → ${args.name}`);
    }
    const wantsRect = ["x", "y", "w", "h"].some((key) => typeof args[key] === "number");
    if (wantsRect) {
      const resized = resizeMapLocation(map, location.id, {
        x: typeof args.x === "number" ? args.x : location.x,
        y: typeof args.y === "number" ? args.y : location.y,
        w: typeof args.w === "number" ? args.w : location.w,
        h: typeof args.h === "number" ? args.h : location.h,
      });
      if (!resized.ok) throw new ToolError(resized.error, { code: "invalid-args", mapId: map.id });
      changes.push(`영역 → (${resized.location.x},${resized.location.y}) ${resized.location.w}×${resized.location.h}`);
    }
    if (changes.length === 0) throw new ToolError("바꿀 항목(name 또는 x/y/w/h)이 없습니다.", { code: "invalid-args", mapId: map.id });
    const current = findLocationById(map, location.id)!;
    return { summary: `로케이션 수정 — ${changes.join(", ")} (${describeLocation(current)})`, data: { location: locationData(current) } };
  },
};

const deleteMapLocationTool: ToolDefinition = {
  name: "delete_map_location",
  description:
    "로케이션을 지운다. 그 로케이션을 가리키는 조건·인카운터가 있으면 **같은 호출에서 복구 방식을 밝혀야** 한다 " +
    "(brokenReferences: remap|detach|freezeRect). 밝히지 않으면 거부한다 — 참조를 끊는 것은 사용자에게 물어야 하는 결정이다. " +
    "사람은 편집기 로케이션 레이어에서 그냥 지우고 나중에 고칠 수 있다(드러나는 진단 + 복구 UI). 조수는 한 번에 원상복구해서 끝낸다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      locationId: { type: "string", description: "ID 또는 현재 이름" },
      brokenReferences: {
        type: "string",
        enum: ["remap", "detach", "freezeRect"],
        description:
          "remap = replacementLocationId 로 다시 지정 / detach = 구역 조건만 떼기 / freezeRect = 지우기 전 사각형을 레거시 raw 구역으로 굳혀 놓기(인카운터만)",
      },
      replacementLocationId: { type: "string", description: "brokenReferences=remap 일 때 대상 로케이션" },
    },
    required: ["mapId", "locationId"],
    additionalProperties: false,
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const location = requireLocation(map, args.locationId as string);
    const impact = describeLocationReferenceImpact(draft, map, location.id);
    const total = countLocationReferences(draft, location.id);
    const mode = typeof args.brokenReferences === "string" ? args.brokenReferences : undefined;
    if (total > 0 && !mode) {
      throw new ToolError(
        `'${location.name}' 을 가리키는 참조가 ${total}건 있습니다(${impact.join(", ")}). ` +
          "brokenReferences 로 remap(+replacementLocationId) / detach / freezeRect 중 하나를 지정하세요. " +
          "사용자의 의도를 모를 때는 지우지 말고 물어봐야 합니다.",
        { code: "location-referenced", mapId: map.id },
      );
    }
    const rect = { x: location.x, y: location.y, w: location.w, h: location.h };
    const replacement =
      mode === "remap" ? requireLocation(map, String(args.replacementLocationId ?? "")).id : undefined;
    deleteMapLocation(map, location.id);
    let repaired = 0;
    if (total > 0 && mode) {
      const plan: LocationRepairPlan =
        replacement !== undefined
          ? { kind: "remap", locationId: replacement }
          : mode === "freezeRect"
            ? { kind: "freezeRect", rect }
            : { kind: "detach" };
      repaired = repairMapLocationReferences(draft, location.id, plan).repaired;
    }
    return {
      summary:
        total === 0
          ? `로케이션 '${location.name}' 삭제 — 가리키는 참조가 없었습니다.`
          : `로케이션 '${location.name}' 삭제 — 참조 ${repaired}건을 ${mode} 로 원상복구했습니다(${impact.join(", ")}).`,
      data: { deletedId: location.id, brokenReferences: total, repaired, mode: mode ?? null, sites: impact },
    };
  },
};

const adoptLayoutRegions: ToolDefinition = {
  name: "adopt_layout_regions",
  description:
    "마을 빌더의 설계 영역(layoutPlan.regions)을 명명 로케이션으로 **복사**한다. 멱등이며, layoutPlan 자체는 한 바이트도 바뀌지 않는다 " +
    "(다시 시공해도 사람의 로케이션 편집이 사라지지 않는 이유). 이미 승격된 region 은 건너뛴다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      roles: {
        type: "array",
        items: { type: "string" },
        description: `이 role 만 승격. 생략하면 기본 선택(${DEFAULT_ADOPTION_ROLES.join(", ")})이며 "전부"가 아니다. house 는 시공 단위라 수십 개가 한꺼번에 생긴다.`,
      },
      regionIds: { type: "array", items: { type: "string" }, description: "특정 region id 만 승격." },
      collisionPolicy: { type: "string", enum: ["suffix", "skip"], description: "이름이 겹칠 때: suffix 는 번호를 붙여 만들고 skip 은 건너뛴다. 기본 suffix." },
    },
    required: ["mapId"],
    additionalProperties: false,
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    if (!map.layoutPlan) {
      throw new ToolError(`${map.name} 맵에 layoutPlan 이 없습니다(빌더로 만든 맵이 아닙니다). create_map_location 을 쓰세요.`, {
        code: "no-layout-plan",
        mapId: map.id,
      });
    }
    // 역할을 생략하면 기본 선택(광장·장터)이다. "전부"가 아니라는 것이 중요하다 —
    // 조수가 말을 즐기다 집 롯 40개를 사용자-가시 장소로 만들면 사람이 손으로 지우는 수밖에 없다.
    const roles = Array.isArray(args.roles) ? (args.roles as string[]) : [...DEFAULT_ADOPTION_ROLES];
    const outcome = adoptLayoutRegionsForMaps(draft, {
      mapIds: [map.id],
      roles,
      ...(Array.isArray(args.regionIds) ? { regionIds: args.regionIds as string[] } : {}),
      collisionPolicy: args.collisionPolicy === "skip" ? "skip" : "suffix",
    });
    const cautions = roles.map((role) => adoptionRoleCaution(role)).filter(Boolean);
    return {
      summary:
        `${describeAdoptionOutcome(outcome)} 역할 ${roles.map(adoptionRoleLabel).join("·")} (layoutPlan 불변)` +
        (cautions.length > 0 ? ` — 주의: ${cautions.join(" ")}` : ""),
      data: {
        adopted: outcome.adopted,
        skippedAlreadyAdopted: outcome.skippedAlreadyAdopted,
        skippedNameCollision: outcome.skippedNameCollision,
        rebound: outcome.rebound,
        roles,
      },
    };
  },
};

const surveyLayoutAdoption: ToolDefinition = {
  name: "survey_layout_adoption",
  description:
    "프로젝트 전체에서 아직 명명 로케이션으로 옮기지 않은 빌더 설계 영역을 **읽기만** 하고 맵별로 센다. " +
    "아무것도 바꾸지 않는다. 사용자가 '어느 맵을 이관해야 하나' 를 물으면 adopt_layout_regions 보다 먼저 이걸 써라.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      roles: {
        type: "array",
        items: { type: "string" },
        description: `이 role 기준으로 센다. 생략하면 기본 ${DEFAULT_ADOPTION_ROLES.join(", ")}.`,
      },
    },
    additionalProperties: false,
  },
  run(project, args): ToolExecResult {
    const survey = surveyProjectAdoption(project, {
      ...(Array.isArray(args.roles) ? { roles: args.roles as string[] } : {}),
    });
    if (survey.maps.length === 0) {
      return {
        summary: "빌더 설계 기록(layoutPlan.regions)이 있는 맵이 없습니다. 이관할 것이 없습니다.",
        data: { maps: [], totalAdoptable: 0 },
      };
    }
    const lines = survey.maps.map(
      (map) =>
        `${map.mapName}(${map.mapId}): 후보 ${map.adoptableCount} · 이미 ${map.adoptedCount}` +
        `${map.rebindableCount > 0 ? ` · 재시공으로 다시 묶을 것 ${map.rebindableCount}` : ""}` +
        `${map.collisions.length > 0 ? ` · 이름 충돌 ${map.collisions.length}` : ""}`,
    );
    return {
      summary: `설계 기록 맵 ${survey.maps.length}개 · 역할 ${survey.selectedRoles.map(adoptionRoleLabel).join("·")} 기준 승격 후보 ${survey.totalAdoptable}개 — ${lines.join(" / ")}`,
      data: { maps: survey.maps, roles: survey.roles, selectedRoles: survey.selectedRoles, totalAdoptable: survey.totalAdoptable },
    };
  },
};

export const MAP_LOCATION_TOOLS: readonly ToolDefinition[] = [
  listMapLocations,
  resolveMapLocation,
  createMapLocation,
  updateMapLocation,
  deleteMapLocationTool,
  surveyLayoutAdoption,
  adoptLayoutRegions,
];
