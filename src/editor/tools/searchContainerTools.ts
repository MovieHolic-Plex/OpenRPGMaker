// editor/tools/searchContainerTools.ts
// 뒤질 수 있는 수납(통·상자·항아리·자루·서랍) — 폴른 스타 마을에서 손으로 짓던 패턴(project/containerSearchPattern)을 조수 도구로.
//  - 뒤지면 여는 연출 + 전리품 떠오르기, 처음 한 번만 나오고 다시 보면 「이미 뒤짐」.
//  - ownerId 가 있으면 집주인이 「볼 때만」(eventSeesPlayer: 벽·방 경계를 지키는 시선) 들킨다 → 돌아보고 「!」, 꾸중.
//    시끄러운 수납(상자·통)은 벽 너머에서도 듣고 「?」 하고 돌아본다(꾸중은 보았을 때만).
//  - 들킨 횟수를 변수에 세고(caughtVariableId), 들키면 못 챙기게(caughtTakesLoot:false) 할 수 있다.
//  - 칸 윗층이 비어 있으면 그 칸에 맞는 1칸 물건(통·상자·항아리…)을 찍어 눈에 보이게 한다.
import { buildContainerSearchEvent, ownerNoticeCommands } from "@/project/containerSearchPattern";
import { CONTAINER_STYLES, isContainerStyle, type ContainerStyle } from "@/project/containerFx";
import type { Command, GameEvent, Project } from "@/project/types";
import { withJosa } from "@/util/josa";
import { ensureNamedVariable } from "./flagHelpers";
import { inMapBounds, requireMap } from "./mapHelpers";
import { SHARED_OBJECT_TOOLS } from "./sharedObjectTools";
import { matchesQuery, sharedObjects } from "./sharedDesignCatalog";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

const STYLE_QUERY: Record<ContainerStyle, readonly string[]> = {
  chest: ["상자", "chest"], crate: ["상자", "crate"], barrel: ["통", "barrel"], sack: ["자루", "sack", "곡물"],
  straw: ["짚", "건초", "hay"], drawer: ["서랍", "옷장", "장롱", "drawer", "cabinet"], jar: ["항아리", "단지", "jar", "pot", "통"],
};
const STYLE_NAME: Record<ContainerStyle, string> = {
  chest: "상자", crate: "나무 상자", barrel: "통", sack: "자루", straw: "짚더미", drawer: "서랍", jar: "항아리",
};

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const say = (speaker: string | undefined, body: string): Command => ({ kind: "text", ...(speaker ? { speaker } : {}), body } as Command);

function stampVisible(project: Project, mapId: string, x: number, y: number, style: ContainerStyle, warnings: string[]): void {
  const map = project.maps[mapId]!;
  if ((map.upperTiles[y * map.width + x] ?? -1) > 0) return;
  const stamp = SHARED_OBJECT_TOOLS.find((t) => t.name === "stamp_object");
  if (!stamp) return;
  // 맵 칩셋의 1×1 물건 중 이 종류 이름이 붙은 것(작은 것 먼저: 「생선 통」보다 그냥 「통」).
  const pool = sharedObjects(project).filter((o) => o.tilesetId === map.tilesetId && o.width === 1 && o.height === 1);
  const candidates = STYLE_QUERY[style].flatMap((word) => pool.filter((o) => matchesQuery(o, word)).sort((p, q) => p.name.length - q.name.length).map((o) => o.id));
  for (const objectId of candidates.slice(0, 6)) {
    try {
      stamp.run(project, { mapId, objectId, x, y, layers: "upper" });
      if ((map.upperTiles[y * map.width + x] ?? -1) > 0) return;
    } catch { /* 다음 후보 */ }
  }
  warnings.push(`(${x},${y}) ${STYLE_NAME[style]}: 이 칩셋에 맞는 1칸 물건을 못 찾아 그림 없이 두었다 — stamp_object 로 그 칸에 물건을 찍어라.`);
}

const placeSearchContainers: ToolDefinition = {
  name: "place_search_containers",
  description:
    "뒤질 수 있는 통·상자·항아리·자루·서랍을 여러 개 한 번에 둔다(폴른 스타 마을 수납 패턴). 뒤지면 여는 연출(소리·파편)과 전리품 떠오르기, "
    + "처음 한 번만 나오고 다시 보면 「비어 있다」. 칸에 물건 타일이 없으면 그 종류의 1칸 물건을 찍어 눈에 보이게 한다. "
    + "ownerId(집주인 이벤트 id)를 주면 주인이 그 칸을 「볼 수 있을 때만」 들킨다 — 벽·다른 방 너머는 못 본다(시야·방 경계 판정). "
    + "들키면 돌아보고 「!」 + caughtLines 꾸중. caughtTakesLoot:false 면 들켰을 때 못 챙긴다. caughtVariableId 를 주면 들킨 횟수를 1씩 더한다"
    + "(「세 번 걸리면 상점 거절」은 그 변수 >= 3 조건 페이지로). loot 를 비우면 빈 수납(「아무것도 없다」).",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      containers: {
        type: "array",
        items: {
          type: "object",
          properties: {
            x: { type: "integer" }, y: { type: "integer" },
            style: { type: "string", enum: [...CONTAINER_STYLES], description: "chest·crate(나무 상자)·barrel(통)·sack(자루)·straw(짚)·drawer(서랍·옷장)·jar(항아리)" },
            name: { type: "string" },
            loot: {
              type: "object",
              properties: { itemId: { type: "string" }, count: { type: "integer" }, gold: { type: "integer" } },
              description: "없으면 빈 수납",
            },
            ownerId: { type: "string", description: "지켜보는 집주인 이벤트 id" },
            caughtLines: { type: "array", items: { type: "string" }, description: "주인이 보았을 때 꾸중(화자 = 주인 이름)" },
            caughtTakesLoot: { type: "boolean", description: "들켜도 챙기나(기본 false = 못 챙김)" },
            caughtVariableId: { type: "string", description: "들킨 횟수를 세는 변수 id(없으면 만든다)" },
          },
          required: ["x", "y"],
        },
      },
    },
    required: ["mapId", "containers"],
  },
  invalidArgsExample: { mapId: "map_1", containers: [{ x: 5, y: 6, style: "barrel", loot: { gold: 30 } }, { x: 8, y: 6, style: "crate", loot: { itemId: "item_potion" }, ownerId: "npc_baker", caughtLines: ["남의 물건에 손대지 마!"] }] },
  run(draft, args): ToolExecResult {
    const mapId = String(args.mapId);
    const map = requireMap(draft, mapId);
    const list = Array.isArray(args.containers) ? args.containers : [];
    if (!list.length) throw new ToolError("containers 가 비었습니다.");
    const used = new Set(Object.values(draft.maps).flatMap((m) => m.events.map((e) => e.id)));
    const taken = new Set(map.events.map((e) => `${e.x},${e.y}`));
    const warnings: string[] = [];
    const placed: string[] = [];
    list.forEach((raw, index) => {
      if (!isRec(raw)) { warnings.push(`containers[${index}] 객체가 아님 — 건너뜀`); return; }
      const x = Number(raw.x), y = Number(raw.y);
      if (!inMapBounds(map, x, y)) { warnings.push(`containers[${index}] 맵 밖 (${x},${y}) — 건너뜀`); return; }
      if (taken.has(`${x},${y}`)) { warnings.push(`containers[${index}] (${x},${y}) 에 이미 이벤트 — 건너뜀`); return; }
      const style: ContainerStyle = isContainerStyle(raw.style) ? raw.style : "crate";
      const name = typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : STYLE_NAME[style];
      const ownerId = typeof raw.ownerId === "string" && raw.ownerId ? raw.ownerId : undefined;
      let ownerName: string | undefined;
      if (ownerId) {
        const owner = map.events.find((e) => e.id === ownerId) as (GameEvent & { name?: string }) | undefined;
        if (!owner) { warnings.push(`containers[${index}] ownerId '${ownerId}' 가 이 맵에 없다 — 주인 없이 둔다`); }
        else ownerName = owner.name;
      }
      const loot: Command[] = [];
      const l = isRec(raw.loot) ? raw.loot : {};
      if (typeof l.itemId === "string" && l.itemId) {
        const item = draft.database.items.find((i) => i.id === l.itemId) ?? draft.database.equipment.find((i) => i.id === l.itemId);
        if (!item) warnings.push(`containers[${index}] itemId '${l.itemId}' 없음 — 아이템 빼고 둔다`);
        else {
          const count = Math.max(1, Math.min(99, Number(l.count ?? 1) || 1));
          loot.push({ kind: "changeItem", itemId: l.itemId, op: "+=", amount: count } as Command, say(undefined, `${withJosa(item.name, "을/를")} 찾았다!${count > 1 ? ` (×${count})` : ""}`));
        }
      }
      const gold = Math.max(0, Math.floor(Number(l.gold ?? 0) || 0));
      if (gold > 0) loot.push({ kind: "changeGold", op: "+=", amount: gold } as Command, say(undefined, `${gold}골드를 찾았다!`));
      if (!loot.length) loot.push(say(undefined, `${withJosa(name, "을/를")} 뒤져 봤지만 아무것도 없다.`));
      const caught: Command[] = [];
      const keep = raw.caughtTakesLoot === true;
      if (ownerId && ownerName !== undefined) {
        const lines = Array.isArray(raw.caughtLines) && raw.caughtLines.length ? raw.caughtLines.map(String) : ["이봐, 남의 물건에 손대지 마!"];
        for (const line of lines) caught.push(say(ownerName, line));
        if (typeof raw.caughtVariableId === "string" && raw.caughtVariableId) {
          ensureNamedVariable(draft, raw.caughtVariableId, `${ownerName} 에게 들킨 횟수`);
          caught.push({ kind: "setVariable", variableId: raw.caughtVariableId, op: "+=", value: 1 } as Command);
        }
      }
      let id = `ev_search_${mapId}_${x}_${y}`.replace(/[^\w]/g, "_");
      for (let n = 2; used.has(id); n += 1) id = `ev_search_${mapId}_${x}_${y}_${n}`.replace(/[^\w]/g, "_");
      used.add(id); taken.add(`${x},${y}`);
      const event = buildContainerSearchEvent({
        id, name, x, y, style, loot,
        ...(ownerId && ownerName !== undefined ? { ownerId, caught } : {}),
        searchedText: [say(undefined, `${withJosa(name, "은/는")} 이미 뒤져 봤다. 비어 있다.`)],
      });
      if (ownerId && ownerName !== undefined && !keep) {
        // 들켰을 때는 챙기지 못한다 — 「봄」 분기에서 전리품만 빼고(셀프 스위치는 켜지 않아 다음에 몰래 다시 뒤질 수 있다).
        const search = event.pages![0]!;
        search.commands = search.commands.map((c) => stripLootInSeen(c, ownerId));
      }
      map.events.push(event);
      stampVisible(draft, mapId, x, y, style, warnings);
      placed.push(`${name}(${x},${y})${ownerName ? ` 주인 ${ownerName}` : ""}`);
    });
    return { summary: `뒤질 수 있는 수납 ${placed.length}개: ${placed.join(", ")}`, warnings };
  },
};

function stripLootInSeen(command: Command, ownerId: string): Command {
  if (command.kind !== "fork") return command;
  const fork = command as Command & { condition?: { kind?: string; eventId?: string; range?: number }; then?: Command[]; else?: Command[] };
  const seen = fork.condition?.kind === "eventSeesPlayer" && fork.condition.eventId === ownerId && (fork.condition.range ?? 5) > 0;
  if (!seen) return { ...fork, ...(fork.then ? { then: fork.then.map((c) => stripLootInSeen(c, ownerId)) } : {}), ...(fork.else ? { else: fork.else.map((c) => stripLootInSeen(c, ownerId)) } : {}) } as Command;
  const lootKinds = new Set(["changeItem", "changeGold", "setSelfSwitch"]);
  const then = (fork.then ?? []).filter((c) => !lootKinds.has(c.kind) && !(c.kind === "showAnimation" && String((c as { animationId?: string }).animationId).startsWith("fx:popup:"))
    && !(c.kind === "text" && /찾았다|아무것도 없다/u.test(String((c as { body?: string }).body))));
  return { ...fork, then: then.length ? then : ownerNoticeCommands(ownerId) } as Command;
}

export const SEARCH_CONTAINER_TOOLS: readonly ToolDefinition[] = [placeSearchContainers];
