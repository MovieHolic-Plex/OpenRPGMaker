import type { Command, GameMap, Project } from "@/project/types";
import { SHARED_OBJECT_TOOLS, prepareSharedObject } from "./sharedObjectTools";
import { m2, revealInWaves, type RevealTheme } from "./puzzleKit";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

// 「…이 드러났다」 연출 — 대사만 있고 지도에는 아무것도 나타나지 않던 문제(폴른 스타 1막 승강 장치, 2026-10-25 사용자 지적)를
// 일반 도구로 푼다. 이벤트 한 페이지 안에 「카메라가 그 자리로 → 칸이 세 물결로 바뀜(먼지·흔들림·색조) → 카메라 복귀」를 끼운다.
// 바뀌는 칸은 공용 오브젝트(stamp_object 와 같은 id)를 그 자리에 찍었을 때의 차이로 계산하고, 맵 자체는 원래대로 둔다 —
// 그래서 실행 전에는 보이지 않고, 실행 중에 changeTile(세이브에 남는 칸 바꾸기)로 나타난다.

type LayerKey = "lowerTiles" | "upperTiles" | "lowerOverlayTiles" | "upperOverlayTiles";
const LAYERS: ReadonlyArray<[LayerKey, "lower" | "upper" | "lower2" | "upper2"]> = [
  ["lowerTiles", "lower"], ["lowerOverlayTiles", "lower2"], ["upperTiles", "upper"], ["upperOverlayTiles", "upper2"],
];
const THEMES: Readonly<Record<string, RevealTheme>> = {
  stone: { flash: "white", waves: ["dust", "smoke", "sparkle"] },
  machine: { flash: "blue", waves: ["dust", "smoke", "sparkle"] },
  magic: { flash: "white", waves: ["magic", "smoke", "sparkle"], pulse: "190,170,255" },
  fire: { flash: "red", waves: ["fire", "smoke", "sparkle"] },
};

type TileChange = { x: number; y: number; layer: "lower" | "upper" | "lower2" | "upper2"; tile: number };

function snapshot(map: GameMap): Record<LayerKey, number[] | undefined> {
  const m = map as unknown as Record<LayerKey, number[] | undefined>;
  return Object.fromEntries(LAYERS.map(([key]) => [key, m[key] ? [...m[key]!] : undefined])) as Record<LayerKey, number[] | undefined>;
}

/** 오브젝트를 실제로 찍어 본 뒤 차이만 남기고 맵은 되돌린다(이식된 그림 칸은 칩셋에 남는다 — 실행 중에 쓴다). */
function changesFromObject(project: Project, map: GameMap, objectId: string, x: number, y: number): TileChange[] {
  const stamp = SHARED_OBJECT_TOOLS.find((tool) => tool.name === "stamp_object");
  if (!stamp) throw new ToolError("stamp_object 도구가 없습니다.", { code: "reveal-no-stamp" });
  const before = snapshot(map);
  const m = map as unknown as Record<LayerKey, number[] | undefined>;
  try {
    stamp.run(project, { objectId, mapId: map.id, x, y });
  } catch (error) {
    for (const [key] of LAYERS) m[key] = before[key];
    throw error;
  }
  const changes: TileChange[] = [];
  for (const [key, layer] of LAYERS) {
    const after = m[key];
    if (!after) continue;
    const old = before[key];
    for (let i = 0; i < after.length; i += 1) {
      const was = old?.[i] ?? -1;
      if (after[i] === was) continue;
      changes.push({ x: i % map.width, y: Math.floor(i / map.width), layer, tile: after[i]! });
    }
  }
  for (const [key] of LAYERS) m[key] = before[key];
  return changes;
}

type CommandList = Command[];
/** 텍스트 본문에 anchor 가 든 첫 대사 바로 뒤에 넣는다(갈래·선택지 안까지 찾는다). 못 찾으면 false. */
function insertAfterText(list: CommandList, anchor: string, inserted: Command[]): boolean {
  for (let i = 0; i < list.length; i += 1) {
    const cmd = list[i] as unknown as Record<string, unknown>;
    if (cmd.kind === "text" && typeof cmd.body === "string" && cmd.body.includes(anchor)) {
      list.splice(i + 1, 0, ...inserted);
      return true;
    }
    for (const value of Object.values(cmd)) {
      if (Array.isArray(value)) {
        if (value.every((v) => v && typeof v === "object" && "kind" in v) && insertAfterText(value as CommandList, anchor, inserted)) return true;
        for (const v of value) {
          if (v && typeof v === "object" && Array.isArray((v as { branch?: unknown }).branch)
            && insertAfterText((v as { branch: CommandList }).branch, anchor, inserted)) return true;
        }
      }
    }
  }
  return false;
}

const stageMapReveal: ToolDefinition = {
  name: "stage_map_reveal",
  mode: "write",
  domains: ["event", "map"],
  description:
    "이벤트 안에서 무언가가 지도 위에 실제로 「드러나게」 한다 — 숨은 문·승강 장치·계단·다리·봉인 해제 등. 「…이 드러났다」를 대사로만 쓰면 플레이어 화면에는 아무것도 바뀌지 않는다. " +
    "objectId(stamp_object 와 같은 공용 오브젝트 id, list_spatial_designs kind:object) 를 x,y 에 찍었을 때 바뀌는 칸을 계산해, 그 칸들을 실행 중에 changeTile 로 바꾸는 연출을 이벤트 페이지에 끼운다: " +
    "카메라가 그 자리로 이동 → 먼지·흔들림·색조와 함께 세 물결로 칸이 바뀜 → (switchId 를 주면 켬) → 카메라가 주인공에게 돌아옴. 맵 자체는 바꾸지 않는다(실행 전에는 보이지 않는다). " +
    "objectId 대신 tiles([{x,y,layer,tile}])로 직접 줄 수도 있다. afterText 를 주면 본문에 그 글이 든 첫 대사 바로 뒤에, 없으면 페이지 맨 끝에 넣는다. " +
    "드러난 것을 쓰게 하려면(타기·들어가기) 그 칸에 별도 이벤트를 만들고 같은 switchId 조건 페이지를 준다.",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "드러날 칸이 있는 맵(이벤트도 이 맵에 있어야 한다)" },
      eventId: { type: "string", description: "연출을 끼울 이벤트 id" },
      pageId: { type: "string", description: "그 이벤트의 페이지 id. 생략하면 afterText 가 든 첫 페이지, 그것도 없으면 마지막 페이지" },
      objectId: { type: "string", description: "드러날 공용 오브젝트 id(stamp_object 와 같은 id). tiles 와 둘 중 하나" },
      x: { type: "integer", description: "objectId 의 왼쪽 위 칸 x" },
      y: { type: "integer", description: "objectId 의 왼쪽 위 칸 y" },
      tiles: {
        type: "array", description: "직접 바꿀 칸 목록(objectId 대신)",
        items: { type: "object", properties: {
          x: { type: "integer" }, y: { type: "integer" },
          layer: { type: "string", enum: ["lower", "lower2", "upper", "upper2"] }, tile: { type: "integer" },
        }, required: ["x", "y", "layer", "tile"], additionalProperties: false },
      },
      afterText: { type: "string", description: "이 글이 본문에 든 첫 대사 바로 뒤에 넣는다(예: 「드러났다」)" },
      theme: { type: "string", enum: ["stone", "machine", "magic", "fire"], description: "입자·색조 묶음. 기본 stone" },
      camera: { type: "boolean", description: "false 면 카메라를 옮기지 않는다(이미 화면 안일 때). 기본 true" },
      switchId: { type: "string", description: "드러난 뒤 켤 스위치(그 칸 이벤트의 조건으로 쓴다)" },
    },
    required: ["mapId", "eventId"],
    additionalProperties: false,
  },
  invalidArgsExample: { mapId: "map_cave", eventId: "ev_lever", objectId: "hand-interior:iron gate open", x: 12, y: 3, afterText: "드러났다" },
  prepare: (args) => (typeof args.objectId === "string" ? prepareSharedObject(args.objectId) : Promise.resolve()),
  run(draft, args): ToolExecResult {
    const map = draft.maps[String(args.mapId)];
    if (!map) throw new ToolError(`맵을 찾을 수 없습니다: ${String(args.mapId)}`, { code: "reveal-map" });
    const event = map.events.find((e) => e.id === String(args.eventId));
    if (!event) throw new ToolError(`${map.id} 에 이벤트 ${String(args.eventId)} 가 없습니다.`, { code: "reveal-event" });
    const pages = event.pages ?? [];
    if (pages.length === 0) throw new ToolError(`이벤트 ${event.id} 에 페이지가 없습니다.`, { code: "reveal-page" });

    let changes: TileChange[];
    if (typeof args.objectId === "string") {
      if (!Number.isInteger(args.x) || !Number.isInteger(args.y)) throw new ToolError("objectId 에는 x·y(왼쪽 위 칸)가 필요합니다.", { code: "reveal-xy" });
      changes = changesFromObject(draft, map, args.objectId, Number(args.x), Number(args.y));
    } else if (Array.isArray(args.tiles) && args.tiles.length > 0) {
      changes = (args.tiles as TileChange[]).map((t) => {
        if (t.x < 0 || t.y < 0 || t.x >= map.width || t.y >= map.height) throw new ToolError(`칸 (${t.x},${t.y}) 이 맵 밖입니다.`, { code: "reveal-bounds" });
        return { x: t.x, y: t.y, layer: t.layer, tile: t.tile };
      });
    } else {
      throw new ToolError("objectId(+x,y) 또는 tiles 가 필요합니다.", { code: "reveal-what" });
    }
    if (changes.length === 0) throw new ToolError("바뀌는 칸이 없습니다 — 그 자리에 이미 같은 그림이 있습니다.", { code: "reveal-nothing" });

    const xs = changes.map((c) => c.x), ys = changes.map((c) => c.y);
    const cx = Math.round((Math.min(...xs) + Math.max(...xs)) / 2), cy = Math.round((Math.min(...ys) + Math.max(...ys)) / 2);
    const theme = THEMES[String(args.theme ?? "stone")] ?? THEMES.stone!;
    const changeTiles = changes.map((c) => ({ kind: "changeTile", mapId: map.id, layer: c.layer, x: c.x, y: c.y, tile: c.tile } as unknown as Command));
    const useCamera = args.camera !== false;
    const inserted: Command[] = [
      ...(useCamera ? [m2("Camera Control", { mode: "panTo", x: cx, y: cy, durationMs: "900", wait: "true" }), { kind: "wait", ms: 300 } as Command] : []),
      ...revealInWaves(changeTiles, theme),
      ...(typeof args.switchId === "string" && args.switchId ? [{ kind: "setSwitch", switchId: args.switchId, value: true } as unknown as Command] : []),
      { kind: "wait", ms: 600 } as Command,
      ...(useCamera ? [m2("Camera Control", { mode: "return", durationMs: "600", wait: "true" })] : []),
    ];

    const anchor = typeof args.afterText === "string" && args.afterText ? args.afterText : undefined;
    const ordered = typeof args.pageId === "string"
      ? pages.filter((p) => p.id === args.pageId)
      : anchor ? pages : [pages[pages.length - 1]!];
    if (ordered.length === 0) throw new ToolError(`페이지 ${String(args.pageId)} 가 없습니다.`, { code: "reveal-page" });
    let placedIn: string | undefined;
    let placement = "end";
    if (anchor) {
      for (const page of ordered) {
        if (insertAfterText(page.commands as Command[], anchor, inserted)) { placedIn = page.id; placement = `after「${anchor}」`; break; }
      }
      if (!placedIn) throw new ToolError(`「${anchor}」가 든 대사를 이벤트 ${event.id} 에서 찾지 못했습니다.`, { code: "reveal-anchor" });
    } else {
      const page = ordered[0]!;
      (page.commands as Command[]).push(...inserted);
      placedIn = page.id;
    }
    return {
      summary: `${map.id} (${cx},${cy}) 둘레 ${changes.length}칸이 이벤트 ${event.id} 페이지 ${placedIn} 에서 드러난다(${placement}${useCamera ? ", 카메라 이동" : ""}).`,
      data: { mapId: map.id, eventId: event.id, pageId: placedIn, cells: changes.length, center: { x: cx, y: cy }, commands: inserted.length },
    };
  },
};

export const REVEAL_TOOLS: readonly ToolDefinition[] = [stageMapReveal];
