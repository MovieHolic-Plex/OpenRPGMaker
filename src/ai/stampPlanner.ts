// ai/stampPlanner.ts
// 바로 깔기의 모델 계획 층 — 한 번의 가벼운 모델 호출로 문장을 여러 도구 단계로 나눈다.
//
// 왜: 옛 정규식 계획(stampPlace.ts, 2026-09-27 삭제)은 문장 하나를 도구 하나로 옮기고 남은 낱말을 재료로 넣었다.
// 「땅으로」가 place_props material 이 되어 「라벨/설명이 "땅으로" 인 타일을 찾지 못했습니다」로 끝났고,
// 「땅을 동그랗게, 물을 동그랗게 옆에 나무」처럼 여러 부분으로 나눠 말하면 알아듣지 못했다(2026-09-25 사용자 신고).
// 여기서는 모델이 **실제 타일셋 라벨 중에서** 재료를 고르고, 대상 사각형 안에 단계마다 하위 사각형을 나눈다.
// 좌표·도구·인자 모양은 코드가 검증한다 — 대상 사각형 밖으로 나간 칸은 잘라 내고, 허용 목록 밖 도구는 버린다.
// 이 파일은 순수하다(네트워크·스토어 없음). 호출·실행은 editor/stampPlaceRunner.ts.
import { clampChestGold, type MapPlacementContext } from "./mapPlacementContext";

export type StampTool =
  | "fill_region"
  | "place_props"
  | "paint_road"
  | "tile_erase"
  | "build_wall"
  | "place_door"
  | "author_house"
  | "place_chest"
  | "place_npc"
  | "place_savepoint"
  | "place_examine_hotspots";

export const STAMP_TOOLS: readonly StampTool[] = [
  "fill_region",
  "place_props",
  "paint_road",
  "tile_erase",
  "build_wall",
  "place_door",
  "author_house",
  "place_chest",
  "place_npc",
  "place_savepoint",
  "place_examine_hotspots",
];

/** 한 번에 받을 단계 상한. 바로 깔기는 한 문장이라 이보다 많으면 모델이 쪼개기에 빠진 것이다. */
export const STAMP_MAX_STEPS = 8;

export interface StampRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface StampStep {
  readonly tool: StampTool;
  /** 도구에 그대로 넘길 인자(mapId 포함). */
  readonly args: Record<string, unknown>;
  /** 채팅에 남길 한 줄 라벨. */
  readonly label: string;
  /** 코드가 고친 점과 근거(예: 상자 금액 보정). 결과 줄에 붙인다. */
  readonly note?: string;
}

/** 모델에게 주는 사실. 재료는 현재 맵 타일셋의 실제 라벨이다. */
export interface StampPlanFacts {
  readonly text: string;
  readonly mapId: string;
  readonly mapWidth: number;
  readonly mapHeight: number;
  /** 대상 사각형 — 선택 영역이면 그것, 없으면 맵 전체. */
  readonly target: StampRect;
  readonly targetIsSelection: boolean;
  readonly tilesetId?: string;
  /** fill_region 이 받는 면 재료 라벨(fillableMaterialSuggestions). */
  readonly fillMaterials: readonly string[];
  /** 채팅 컨텍스트와 같은 소품·지형 라벨 힌트 한 줄(formatMaterialLabelHint). */
  readonly materialHint: string;
  /** 벽·문 라벨 후보(있을 때만). */
  readonly wallMaterials?: readonly string[];
  readonly doorMaterials?: readonly string[];
  /** 현재 맵 사실 — 상자 보상·NPC·조사 지점을 이 맵에 맞춰 고르는 근거(1순위). */
  readonly placement?: MapPlacementContext;
}

export const STAMP_PLANNER_SYSTEM_PROMPT = [
  "You turn ONE short Korean map-editing sentence into direct tool steps for a 2D tile RPG editor. No questions, no plan prose.",
  "Return ONLY a JSON object: {\"steps\":[{\"tool\":\"...\",\"args\":{...},\"label\":\"짧은 한국어 설명\"}]}.",
  "Rules:",
  "- Every rectangle/point MUST lie inside facts.target (map coordinates, x right, y down, w/h in tiles). Split the target into sub-rectangles when the sentence names several parts (\"A 옆에 B\", \"왼쪽/오른쪽\", \"가운데\"). Parts should not overlap unless the sentence says so.",
  "- material MUST be copied verbatim from the provided labels (facts.fillMaterials for fill_region; the labels in facts.materialHint for place_props; facts.wallMaterials / facts.doorMaterials for walls/doors). Map everyday words to the closest real label: 땅/흙/맨땅 → a dirt/soil/earth fill label; 풀밭/잔디 → grass; 물/호수/연못 → water; 숲/나무 → a tree label. Never invent a label; never use a group id.",
  "- Shapes: 동그랗게/원/둥근/호수/연못 → fill_region shape \"circle\" (ellipse for wide ovals); otherwise \"rect\".",
  "- A circle needs a square box: give circle steps a sub-rectangle with w == h (the largest square that fits its part); use ellipse only when the user says 타원/길쭉하게.",
  "- Trees/forest use place_props with density: 숲/나무/숲길 → \"dense\" (walkable forest with water, small trees, rocks and hidden canopy paths), 울창/빽빽/통행 불가/막힌 → \"impassable\", 성글게 → \"normal\", 드문드문/가로수 → \"sparse\". Decorative crates/boxes (장식 상자·나무 상자) are place_props with count.",
  "- Game objects: 보물상자/상자(열어서 얻는) → place_chest; 사람/주민/상인/NPC/경비 → place_npc (one step per person, give each a fitting Korean name and 1-2 short lines); 세이브/저장 → place_savepoint; 조사/살펴보기/표지판/비석 → place_examine_hotspots. Put them on walkable ground inside the target, not on trees, water or walls.",
  "- facts.placement describes THIS map (its fights, existing chests, shops, NPCs, wiki). It is the main reference. Chest gold MUST be inside facts.placement.chestGold.min..max; prefer an item from facts.placement.rewardItems (use its id) when the sentence asks for items. Never invent item ids. NPC names must not repeat facts.placement.existing.npcs. Match NPC lines to the map name, locations and wiki.",
  "- An empty sentence (\"(빈 입력) …\") means: decorate the target sensibly for this map (terrain first); add at most one game object and only if it clearly fits.",
  "- Order steps ground first (fill_region / paint_road), then walls/houses, then props, so props land on finished ground.",
  "- Do not add things the user did not ask for. Empty steps [] only if nothing can be done.",
  `- At most ${STAMP_MAX_STEPS} steps. Omit mapId; code fills it.`,
  "Tool arg shapes (only these keys):",
  "fill_region {rect:{x,y,w,h}, material, shape?:\"rect\"|\"circle\"|\"ellipse\", clearUpper?:boolean}",
  "place_props {area:{x,y,w,h}, material, density?:\"sparse\"|\"normal\"|\"dense\"|\"impassable\", count?:int, packing?:\"natural\"|\"dense\"}",
  "paint_road {points:[{x,y},...], style?:\"dirt\"|\"sand\"}",
  "tile_erase {rect:{x,y,w,h}, layer?:\"both\"|\"lower\"|\"upper\"}",
  "build_wall {rect:{x,y,w,h}, material}",
  "place_door {at:{x,y}, material}",
  "author_house {wings:[{x,y,w,h}] (w>=3,h>=5), interior?:\"exterior-only\"|\"linked-interior\"}",
  "place_chest {at:{x,y}, gold?:int, itemId?:string, why?:\"short basis\"}",
  "place_npc {at:{x,y}, name, role?:string, lines?:[\"...\"], merchant?:boolean}",
  "place_savepoint {at:{x,y}}",
  "place_examine_hotspots {spots:[{at:{x,y}, name, lines:[\"...\"]}]}",
].join("\n");

export function buildStampPlannerUserPayload(facts: StampPlanFacts): string {
  return JSON.stringify({
    sentence: facts.text,
    map: { id: facts.mapId, width: facts.mapWidth, height: facts.mapHeight },
    target: { ...facts.target, source: facts.targetIsSelection ? "user selection" : "whole map" },
    tileset: facts.tilesetId ?? null,
    fillMaterials: facts.fillMaterials,
    materialHint: facts.materialHint,
    ...(facts.wallMaterials?.length ? { wallMaterials: facts.wallMaterials } : {}),
    ...(facts.doorMaterials?.length ? { doorMaterials: facts.doorMaterials } : {}),
    ...(facts.placement ? { placement: placementForModel(facts.placement) } : {}),
  });
}

/** 모델에게 보내는 맵 사실 — 거르는 데만 쓰는 id 목록은 뺀다(토큰만 먹는다). */
function placementForModel(placement: MapPlacementContext): Omit<MapPlacementContext, "knownItemIds"> {
  const { knownItemIds: _known, ...rest } = placement;
  return rest;
}

/** 실패한 단계와 도구 오류를 보여 주고 대체 단계만 받는다. */
export function buildStampRepairPrompt(failures: readonly { readonly step: StampStep; readonly error: string }[]): string {
  const listed = failures.map((failure, index) => {
    const args = Object.fromEntries(Object.entries(failure.step.args).filter(([key]) => key !== "mapId"));
    return `${index + 1}. ${JSON.stringify({ tool: failure.step.tool, args, label: failure.step.label })}\n   error: ${failure.error}`;
  }).join("\n");
  return [
    "These steps failed when executed:",
    listed,
    "Return {\"steps\":[...]} with replacement steps for ONLY the failed steps (same JSON shape and rules). Use a label the error suggests or one from the provided lists. If a step cannot be fixed, leave it out.",
  ].join("\n");
}

// ── 파싱·검증 ────────────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteInt(value: unknown): number | null {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? Math.round(n) : null;
}

/** 모델 본문에서 JSON 객체 하나를 꺼낸다 — 코드펜스·앞뒤 잡담을 견딘다. */
export function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/iu.exec(trimmed);
  const body = fenced?.[1]?.trim() ?? trimmed;
  try {
    return JSON.parse(body);
  } catch {
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");
    if (start < 0 || end <= start) return undefined;
    try {
      return JSON.parse(body.slice(start, end + 1));
    } catch {
      return undefined;
    }
  }
}

/** 사각형을 대상 안으로 자른다. 겹침이 없으면 null. */
export function clampRectToTarget(value: unknown, target: StampRect): StampRect | null {
  if (!isRecord(value)) return null;
  const x = finiteInt(value.x);
  const y = finiteInt(value.y);
  const w = finiteInt(value.w ?? value.width);
  const h = finiteInt(value.h ?? value.height);
  if (x === null || y === null || w === null || h === null || w < 1 || h < 1) return null;
  const x0 = Math.max(x, target.x);
  const y0 = Math.max(y, target.y);
  const x1 = Math.min(x + w, target.x + target.w);
  const y1 = Math.min(y + h, target.y + target.h);
  if (x1 <= x0 || y1 <= y0) return null;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function clampPointToTarget(value: unknown, target: StampRect): { x: number; y: number } | null {
  if (!isRecord(value)) return null;
  const x = finiteInt(value.x);
  const y = finiteInt(value.y);
  if (x === null || y === null) return null;
  return {
    x: Math.min(target.x + target.w - 1, Math.max(target.x, x)),
    y: Math.min(target.y + target.h - 1, Math.max(target.y, y)),
  };
}

function roadPoints(area: StampRect): { x: number; y: number }[] {
  if (area.w >= area.h) {
    const y = area.y + Math.floor((area.h - 1) / 2);
    return [{ x: area.x, y }, { x: area.x + area.w - 1, y }];
  }
  const x = area.x + Math.floor((area.w - 1) / 2);
  return [{ x, y: area.y }, { x, y: area.y + area.h - 1 }];
}

function stringArg(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function enumArg<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

export type StampStepCheck = { readonly step: StampStep } | { readonly dropped: string };

const TOOL_KO: Record<StampTool, string> = {
  fill_region: "칠하기",
  place_props: "깔기",
  paint_road: "길",
  tile_erase: "지우기",
  build_wall: "벽",
  place_door: "문",
  author_house: "집",
  place_chest: "보물상자",
  place_npc: "NPC",
  place_savepoint: "세이브 포인트",
  place_examine_hotspots: "조사 지점",
};

/**
 * 모델 단계 하나 → 도구 인자. 허용 키만 옮기고 좌표를 대상 사각형 안으로 자른다.
 * 모델은 rect 이름을 도구마다 헷갈리므로 rect/area 를 서로 받아 준다.
 */
export function validateStampStep(raw: unknown, facts: StampPlanFacts): StampStepCheck {
  if (!isRecord(raw)) return { dropped: "단계가 객체가 아닙니다" };
  const tool = typeof raw.tool === "string" ? raw.tool.trim() : "";
  if (!(STAMP_TOOLS as readonly string[]).includes(tool)) return { dropped: `허용되지 않은 도구 ${tool || "(없음)"}` };
  const stampTool = tool as StampTool;
  const args = isRecord(raw.args) ? raw.args : raw;
  const target = facts.target;
  const mapId = facts.mapId;
  const rectRaw = args.rect ?? args.area;
  const rect = rectRaw === undefined ? target : clampRectToTarget(rectRaw, target);
  const material = stringArg(args.material);
  const labelText = stringArg(raw.label);
  const label = labelText ?? `${material ? `${material} ` : ""}${TOOL_KO[stampTool]}`;
  const dropped = (reason: string): StampStepCheck => ({ dropped: `${stampTool}: ${reason}` });
  switch (stampTool) {
    case "fill_region": {
      if (!rect) return dropped("영역이 대상 밖입니다");
      if (!material) return dropped("재료가 없습니다");
      const shape = enumArg(args.shape, ["rect", "circle", "ellipse"] as const);
      const clearUpper = typeof args.clearUpper === "boolean" ? args.clearUpper : undefined;
      return { step: { tool: stampTool, label, args: { mapId, rect, material, shape: shape ?? "rect", ...(clearUpper !== undefined ? { clearUpper } : {}) } } };
    }
    case "place_props": {
      if (!rect) return dropped("영역이 대상 밖입니다");
      if (!material) return dropped("재료가 없습니다");
      const density = enumArg(args.density, ["sparse", "normal", "dense", "impassable"] as const);
      const count = finiteInt(args.count);
      const packing = enumArg(args.packing, ["natural", "dense"] as const);
      const cells = rect.w * rect.h;
      const sized = density
        ? { density }
        : count !== null && count > 0
          ? { count: Math.min(count, cells), ...(packing ? { packing } : {}) }
          : { count: cells, packing: "dense" as const };
      return { step: { tool: stampTool, label, args: { mapId, area: rect, material, ...sized } } };
    }
    case "paint_road": {
      const rawPoints = Array.isArray(args.points) ? args.points : [];
      const points = rawPoints
        .map((point) => clampPointToTarget(point, target))
        .filter((point): point is { x: number; y: number } => point !== null);
      const path = points.length >= 2 ? points : rect ? roadPoints(rect) : null;
      if (!path) return dropped("경로가 없습니다");
      const style = enumArg(args.style, ["dirt", "sand"] as const) ?? "dirt";
      return { step: { tool: stampTool, label, args: { mapId, points: path, style, naturalness: 0 } } };
    }
    case "tile_erase": {
      if (!rect) return dropped("영역이 대상 밖입니다");
      const layer = enumArg(args.layer, ["both", "lower", "upper"] as const) ?? "both";
      return { step: { tool: stampTool, label, args: { mapId, rect, layer } } };
    }
    case "build_wall": {
      if (!rect) return dropped("영역이 대상 밖입니다");
      return { step: { tool: stampTool, label, args: { mapId, rect, material: material ?? "벽" } } };
    }
    case "place_door": {
      const at = args.at !== undefined
        ? clampPointToTarget(args.at, target)
        : rect ? { x: rect.x + Math.floor((rect.w - 1) / 2), y: rect.y + rect.h - 1 } : null;
      if (!at) return dropped("문 위치가 없습니다");
      return { step: { tool: stampTool, label, args: { mapId, at, material: material ?? "문" } } };
    }
    case "author_house": {
      const wingRaw = Array.isArray(args.wings) && args.wings.length > 0 ? args.wings[0] : rectRaw;
      const wing = wingRaw === undefined ? target : clampRectToTarget(wingRaw, target);
      if (!wing) return dropped("집 자리가 대상 밖입니다");
      // 집은 3×5 미만이면 도구가 거부한다. 대상이 작으면 맵 안에서 넓힌다(정규식 경로와 같다).
      const w = Math.min(Math.max(3, wing.w), Math.max(1, facts.mapWidth - wing.x));
      const h = Math.min(Math.max(5, wing.h), Math.max(1, facts.mapHeight - wing.y));
      const interior = enumArg(args.interior, ["exterior-only", "linked-interior"] as const) ?? "exterior-only";
      return {
        step: {
          tool: stampTool,
          label,
          args: { kind: "single", mapId, wings: [{ x: wing.x, y: wing.y, w, h }], interior, door: interior === "linked-interior" },
        },
      };
    }
    case "place_chest": {
      const at = pointOrCenter(args.at, rect, target);
      if (!at) return dropped("상자 위치가 없습니다");
      const basis = facts.placement?.chestGold;
      const itemRaw = stringArg(args.itemId);
      const known = itemRaw && facts.placement ? facts.placement.knownItemIds.includes(itemRaw) : false;
      const itemId = known ? itemRaw : undefined;
      const goldRaw = finiteInt(args.gold);
      const notes: string[] = [];
      if (itemRaw && !known) notes.push(`없는 아이템 ${itemRaw} 은 뺐습니다`);
      let gold: number | undefined;
      if (goldRaw !== null && goldRaw > 0) {
        if (basis) {
          const clamped = clampChestGold(goldRaw, basis);
          gold = clamped.gold;
          notes.push(clamped.note);
        } else gold = goldRaw;
      }
      if (!itemId && gold === undefined) {
        gold = basis ? Math.round((basis.min + basis.max) / 2) : 50;
        notes.push(basis ? `금액이 없어 ${gold}G(${basis.reason})` : "금액이 없어 50G");
      }
      const note = notes.join(" · ");
      return { step: { tool: stampTool, label: labelText ?? "보물상자", note, args: { mapId, x: at.x, y: at.y, contents: { ...(itemId ? { itemId } : {}), ...(gold !== undefined ? { gold } : {}) } } } };
    }
    case "place_npc": {
      const at = pointOrCenter(args.at, rect, target);
      if (!at) return dropped("NPC 위치가 없습니다");
      const name = stringArg(args.name) ?? "마을 사람";
      const role = stringArg(args.role);
      const lines = stringList(args.lines, 3);
      const body = lines.length > 0 ? lines : [`${name}: 안녕하세요.`];
      return {
        step: {
          tool: stampTool,
          label: labelText ?? `${name} NPC`,
          args: {
            mapId, x: at.x, y: at.y, name,
            graphic: { query: role ?? name },
            pages: [{ lines: body }],
          },
        },
      };
    }
    case "place_savepoint": {
      const at = pointOrCenter(args.at, rect, target);
      if (!at) return dropped("세이브 위치가 없습니다");
      return { step: { tool: stampTool, label: labelText ?? "세이브 포인트", args: { mapId, x: at.x, y: at.y } } };
    }
    case "place_examine_hotspots": {
      const raw = Array.isArray(args.spots) ? args.spots : Array.isArray(args.hotspots) ? args.hotspots : [];
      const hotspots = raw.slice(0, 6).flatMap((spot) => {
        if (!isRecord(spot)) return [];
        const at = clampPointToTarget(spot.at, target);
        if (!at) return [];
        const lines = stringList(spot.lines, 3);
        return [{ at, name: stringArg(spot.name) ?? "조사 지점", lines: lines.length > 0 ? lines : ["특별한 것은 없다."] }];
      });
      if (hotspots.length === 0) return dropped("조사 지점이 없습니다");
      return { step: { tool: stampTool, label: labelText ?? `조사 지점 ${hotspots.length}곳`, args: { mapId, hotspots } } };
    }
  }
}

function stringList(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(stringArg).filter((line): line is string => Boolean(line)).map((line) => line.slice(0, 120)).slice(0, limit);
}

function pointOrCenter(value: unknown, rect: StampRect | null, target: StampRect): { x: number; y: number } | null {
  if (value !== undefined) return clampPointToTarget(value, target);
  const box = rect ?? target;
  return { x: box.x + Math.floor(box.w / 2), y: box.y + Math.floor(box.h / 2) };
}

export interface ParsedStampPlan {
  readonly steps: readonly StampStep[];
  /** 버린 단계와 이유(채팅에 한 줄로 남긴다). */
  readonly dropped: readonly string[];
  /** JSON 을 읽지 못했을 때만. */
  readonly error?: string;
}

export function parseStampPlan(raw: string, facts: StampPlanFacts): ParsedStampPlan {
  const parsed = extractJsonObject(raw);
  const list = isRecord(parsed) && Array.isArray(parsed.steps)
    ? parsed.steps
    : Array.isArray(parsed) ? parsed : null;
  if (!list) return { steps: [], dropped: [], error: "모델 응답에서 steps 를 읽지 못했습니다" };
  const steps: StampStep[] = [];
  const dropped: string[] = [];
  for (const entry of list) {
    if (steps.length >= STAMP_MAX_STEPS) {
      dropped.push(`단계 상한(${STAMP_MAX_STEPS}) 초과`);
      break;
    }
    const check = validateStampStep(entry, facts);
    if ("step" in check) steps.push(check.step);
    else dropped.push(check.dropped);
  }
  return { steps, dropped };
}
