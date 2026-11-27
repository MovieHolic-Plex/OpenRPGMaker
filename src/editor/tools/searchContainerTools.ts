// editor/tools/searchContainerTools.ts
// 뒤질 수 있는 수납(통·상자·항아리·자루·서랍) + 시대별 100종 상호작용 오브젝트(project/interactiveProps) 배치 조수 도구.
//  - place_search_containers: 기존 수납 뒤지기 패턴 + 선택적 propId(100종 실원본 멀티프레임 PNG 스트립) 지원.
//  - list_interactive_props: 100종 실원본 상호작용 오브젝트(판타지·던전·현대·조선·무림·SF·스팀펑크) 검색.
//  - place_interactive_props: 항아리 파괴·양문 옷장·비밀 책장·자판기·화로 점화·에어록·봉인 제단 등 100종을 맵에 즉시 배치.
import { buildContainerSearchEvent, ownerNoticeCommands, withLootPopups } from "@/project/containerSearchPattern";
import { CONTAINER_STYLES, isContainerStyle, propFxId, type ContainerStyle } from "@/project/containerFx";
import {
  INTERACTIVE_PROP_ERAS,
  INTERACTIVE_PROP_ERA_LABELS,
  inferInteractivePropEra,
  interactivePropById,
  searchInteractiveProps,
  type InteractivePropEra,
  type InteractivePropPlayback,
} from "@/project/interactiveProps";
import type { Command, GameEvent, Project } from "@/project/types";
import { withJosa } from "@/util/josa";
import { ensureNamedSwitch, ensureNamedVariable } from "./flagHelpers";
import { inMapBounds, requireMap } from "./mapHelpers";
import { SHARED_OBJECT_TOOLS } from "./sharedObjectTools";
import { matchesQuery, sharedObjects } from "./sharedDesignCatalog";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

const STYLE_QUERY: Record<ContainerStyle, readonly string[]> = {
  chest: ["상자", "chest"], crate: ["상자", "crate"], barrel: ["통", "barrel"], sack: ["자루", "sack", "곡물"],
  straw: ["짚", "건초", "hay"], drawer: ["서랍", "drawer", "cabinet"], jar: ["항아리", "단지", "jar", "pot", "통"],
  wardrobe: ["옷장", "장롱", "wardrobe"],
};
const STYLE_NAME: Record<ContainerStyle, string> = {
  chest: "상자", crate: "나무 상자", barrel: "통", sack: "자루", straw: "짚더미", drawer: "서랍", jar: "항아리", wardrobe: "옷장",
};

type Rec = Record<string, unknown>;
type Page = NonNullable<GameEvent["pages"]>[number];
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const say = (speaker: string | undefined, body: string): Command => ({ kind: "text", ...(speaker ? { speaker } : {}), body } as Command);

function stampVisible(project: Project, mapId: string, x: number, y: number, style: ContainerStyle, warnings: string[]): void {
  const map = project.maps[mapId]!;
  if ((map.upperTiles[y * map.width + x] ?? -1) > 0) return;
  const stamp = SHARED_OBJECT_TOOLS.find((t) => t.name === "stamp_object");
  if (!stamp) return;
  const pool = sharedObjects(project).filter((o) => o.tilesetId === map.tilesetId && o.width === 1 && o.height === 1);
  const candidates = STYLE_QUERY[style].flatMap((word) => pool.filter((o) => matchesQuery(o, word)).sort((p, q) => p.name.length - q.name.length).map((o) => o.id));
  for (const objectId of candidates.slice(0, 6)) {
    try {
      stamp.run(project, { mapId, objectId, x, y, layers: "upper" });
      if ((map.upperTiles[y * map.width + x] ?? -1) > 0) return;
    } catch { /* 다음 후보 */ }
  }
  warnings.push(`(${x},${y}) ${STYLE_NAME[style]}: 이 칩셋에 맞는 1칸 물건을 못 찾아 그림 없이 두었다 — stamp_object 로 그 칸에 물건을 찍거나 propId 를 지정하라.`);
}

function buildLootCommands(draft: Project, rawLoot: unknown, label: string, warnings: string[]): Command[] {
  const loot: Command[] = [];
  const l = isRec(rawLoot) ? rawLoot : {};
  if (typeof l.itemId === "string" && l.itemId) {
    const item = draft.database.items.find((i) => i.id === l.itemId) ?? draft.database.equipment.find((i) => i.id === l.itemId);
    if (!item) warnings.push(`${label} itemId '${l.itemId}' 없음 — 아이템 빼고 둔다`);
    else {
      const count = Math.max(1, Math.min(99, Number(l.count ?? 1) || 1));
      loot.push({ kind: "changeItem", itemId: l.itemId, op: "+=", amount: count } as Command, say(undefined, `${withJosa(item.name, "을/를")} 찾았다!${count > 1 ? ` (×${count})` : ""}`));
    }
  }
  const gold = Math.max(0, Math.floor(Number(l.gold ?? 0) || 0));
  if (gold > 0) loot.push({ kind: "changeGold", op: "+=", amount: gold } as Command, say(undefined, `${gold}골드를 찾았다!`));
  return loot;
}

const placeSearchContainers: ToolDefinition = {
  name: "place_search_containers",
  description:
    "뒤질 수 있는 통·상자·항아리·자루·서랍·옷장을 여러 개 한 번에 둔다(폴른 스타 마을 수납 패턴). 뒤지면 여는 연출(소리·파편 또는 100종 멀티프레임 PNG 스트립)과 전리품 떠오르기, "
    + "처음 한 번만 나오고 다시 보면 「비어 있다」. propId(list_interactive_props 로 조회한 100종 id, 예: water-jug-smash, treasure-chest, beodeul-wardrobe)를 지정하면 "
    + "기존 고퀄리티 원본 PNG 5프레임 애니메이션으로 렌더링·재생한다(break 계열은 파괴 후 밟고 지나갈 수 있음). "
    + "ownerId(집주인 이벤트 id)를 주면 주인이 그 칸을 「볼 수 있을 때만」 들킨다.",
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
            style: { type: "string", enum: [...CONTAINER_STYLES], description: "chest·crate(나무 상자)·barrel(통)·sack(자루)·straw(짚)·drawer(서랍)·jar(항아리)·wardrobe(옷장)" },
            propId: { type: "string", description: "선택: 100종 멀티프레임 상호작용 프롭 id(list_interactive_props 참고). 지정하면 해당 실원본 5프레임 PNG 스트립을 사용" },
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
  invalidArgsExample: { mapId: "map_1", containers: [{ x: 5, y: 6, style: "jar", propId: "water-jug-smash", loot: { gold: 30 } }, { x: 8, y: 6, style: "wardrobe", propId: "beodeul-wardrobe", loot: { itemId: "item_potion" }, ownerId: "npc_baker", caughtLines: ["남의 물건에 손대지 마!"] }] },
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
      const requestedProp = typeof raw.propId === "string" && raw.propId.trim() ? interactivePropById(raw.propId.trim()) : undefined;
      if (typeof raw.propId === "string" && raw.propId.trim() && !requestedProp) {
        warnings.push(`containers[${index}] propId '${raw.propId}' 없음 — 기본 수납 연출로 대체`);
      }
      const style: ContainerStyle = isContainerStyle(raw.style)
        ? raw.style
        : (requestedProp?.containerStyle && isContainerStyle(requestedProp.containerStyle) ? requestedProp.containerStyle : "crate");
      const name = typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : (requestedProp?.name ?? STYLE_NAME[style]);
      const ownerId = typeof raw.ownerId === "string" && raw.ownerId ? raw.ownerId : undefined;
      let ownerName: string | undefined;
      if (ownerId) {
        const owner = map.events.find((e) => e.id === ownerId) as (GameEvent & { name?: string }) | undefined;
        if (!owner) { warnings.push(`containers[${index}] ownerId '${ownerId}' 가 이 맵에 없다 — 주인 없이 둔다`); }
        else ownerName = owner.name;
      }
      const loot = buildLootCommands(draft, raw.loot, `containers[${index}]`, warnings);
      if (!loot.length) loot.push(say(undefined, `${withJosa(name, "을/를")} 확인했지만 아무것도 없다.`));
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
      const searchedMsg = requestedProp?.playback === "break"
        ? []
        : [say(undefined, `${withJosa(name, "은/는")} 이미 확인했다. 비어 있다.`)];
      const event = buildContainerSearchEvent({
        id, name, x, y, style, loot,
        ...(requestedProp ? { propId: requestedProp.id } : {}),
        ...(ownerId && ownerName !== undefined ? { ownerId, caught } : {}),
        searchedText: searchedMsg,
      });
      if (ownerId && ownerName !== undefined && !keep) {
        const search = event.pages![0]!;
        search.commands = search.commands.map((c) => stripLootInSeen(c, ownerId));
      }
      map.events.push(event);
      // propId 가 있으면 0번 원본 프레임 PNG 를 직접 그리므로 칩셋 타일을 중복 찍지 않는다.
      if (!requestedProp) stampVisible(draft, mapId, x, y, style, warnings);
      placed.push(`${name}${requestedProp ? `[${requestedProp.id}]` : ""}(${x},${y})${ownerName ? ` 주인 ${ownerName}` : ""}`);
    });
    return { summary: `뒤질 수 있는 수납 ${placed.length}개: ${placed.join(", ")}`, warnings };
  },
};

const listInteractivePropsTool: ToolDefinition = {
  name: "list_interactive_props",
  description:
    "시대별 고퀄리티 원본 기반 상호작용 오브젝트 100종 카탈로그를 검색한다. "
    + "항아리/상자/수정 파괴(break), 옷장·서랍·문·금고·에어록 열닫기(toggle), 벽난로·화로·등롱·원자로·제단 점화/가동(loopAfterOpen), "
    + "자판기·우물·종·북·석관(oneshot)을 시대(fantasy·dungeon·modern·joseon·murim·scifi·steampunk)나 키워드로 찾아 place_interactive_props 에 넘긴다.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "검색어(예: 항아리, 옷장, 자판기, 화로, 에어록, 비밀, 파괴)" },
      era: { type: "string", enum: [...INTERACTIVE_PROP_ERAS], description: "시대 필터(생략 시 전체 또는 mapId 추론)" },
      mapId: { type: "string", description: "선택: 맵 칩셋에서 어울리는 시대를 자동 추론" },
      playback: { type: "string", enum: ["oneshot", "toggle", "break", "loopAfterOpen"] },
      limit: { type: "integer", description: "최대 반환 개수(기본 30)" },
    },
  },
  run(draft, args): ToolExecResult {
    const mapId = typeof args.mapId === "string" ? args.mapId : undefined;
    const map = mapId ? draft.maps[mapId] : undefined;
    const inferredEra = map ? inferInteractivePropEra(map.tilesetId, draft.tilesets[map.tilesetId]?.name) : undefined;
    const era = typeof args.era === "string" && (INTERACTIVE_PROP_ERAS as readonly string[]).includes(args.era)
      ? (args.era as InteractivePropEra)
      : (!args.query && inferredEra ? inferredEra : undefined);
    const playback = typeof args.playback === "string" ? (args.playback as InteractivePropPlayback) : undefined;
    const matches = searchInteractiveProps({
      query: typeof args.query === "string" ? args.query : undefined,
      era,
      playback,
    });
    const limit = Math.max(1, Math.min(100, Number(args.limit ?? 30) || 30));
    const sliced = matches.slice(0, limit);
    const lines = sliced.map((p) => `${p.id} | ${p.name} | ${INTERACTIVE_PROP_ERA_LABELS[p.era]} | ${p.motion}/${p.playback}`);
    return {
      summary: `상호작용 오브젝트 ${matches.length}건 중 ${sliced.length}건:\n${lines.join("\n")}`,
      data: { total: matches.length, props: sliced.map((p) => ({ id: p.id, name: p.name, era: p.era, motion: p.motion, playback: p.playback, tags: p.tags })) },
    };
  },
};

const placeInteractivePropsTool: ToolDefinition = {
  name: "place_interactive_props",
  description:
    "100종 실원본 멀티프레임 상호작용 오브젝트(항아리 파괴·양문 옷장·비밀 책장·자판기·화로 점화·에어록·봉인 제단 등)를 맵에 배치한다. "
    + "원본 PNG 0번 프레임이 맵에 바로 표시되고, 조사 시 5프레임 애니메이션+효과음이 재생된다. "
    + "파괴형(break)은 부서진 뒤 통과 가능해지며, 토글형(toggleable:true)은 다시 조사해 닫을 수 있다. switchId 를 주면 작동 시 스위치를 켠다(비밀문·기믹 연동).",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      props: {
        type: "array",
        items: {
          type: "object",
          properties: {
            x: { type: "integer" },
            y: { type: "integer" },
            propId: { type: "string", description: "list_interactive_props 에서 찾은 프롭 id (예: water-jug-smash, beodeul-bookshelf, modern-vending, dungeon-brazier, scifi-airlock)" },
            name: { type: "string" },
            message: { type: "string", description: "작동 후 표시할 대사(선택)" },
            afterMessage: { type: "string", description: "이미 작동한 뒤 다시 조사할 때 대사(선택)" },
            toggleable: { type: "boolean", description: "toggle 계열에서 다시 조사해 닫기(fx:prop:<id>:close) 허용 여부(기본 false)" },
            switchId: { type: "string", description: "작동 시 켤 스위치 id(없으면 생성, 비밀문·기믹 연계)" },
            loot: {
              type: "object",
              properties: { itemId: { type: "string" }, count: { type: "integer" }, gold: { type: "integer" } },
            },
          },
          required: ["x", "y", "propId"],
        },
      },
    },
    required: ["mapId", "props"],
  },
  invalidArgsExample: {
    mapId: "map_1",
    props: [
      { x: 4, y: 5, propId: "water-jug-smash", loot: { gold: 15 } },
      { x: 7, y: 3, propId: "beodeul-bookshelf", switchId: "sw_secret_open", message: "책장 뒤에서 비밀 통로가 열렸다!" },
      { x: 10, y: 4, propId: "dungeon-brazier", message: "화로에 불이 타올랐다." },
    ],
  },
  run(draft, args): ToolExecResult {
    const mapId = String(args.mapId);
    const map = requireMap(draft, mapId);
    const list = Array.isArray(args.props) ? args.props : [];
    if (!list.length) throw new ToolError("props 가 비었습니다.");
    const used = new Set(Object.values(draft.maps).flatMap((m) => m.events.map((e) => e.id)));
    const taken = new Set(map.events.map((e) => `${e.x},${e.y}`));
    const warnings: string[] = [];
    const placed: string[] = [];

    list.forEach((raw, index) => {
      if (!isRec(raw)) { warnings.push(`props[${index}] 객체가 아님 — 건너뜀`); return; }
      const x = Number(raw.x), y = Number(raw.y);
      if (!inMapBounds(map, x, y)) { warnings.push(`props[${index}] 맵 밖 (${x},${y}) — 건너뜀`); return; }
      if (taken.has(`${x},${y}`)) { warnings.push(`props[${index}] (${x},${y}) 에 이미 이벤트 — 건너뜀`); return; }
      const prop = interactivePropById(typeof raw.propId === "string" ? raw.propId.trim() : undefined);
      if (!prop) { warnings.push(`props[${index}] 알 수 없는 propId '${String(raw.propId)}' — 건너뜀`); return; }

      const name = typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : prop.name;
      const style: ContainerStyle = prop.containerStyle && isContainerStyle(prop.containerStyle) ? prop.containerStyle : "crate";
      const toggleable = raw.toggleable === true && prop.playback === "toggle";
      const switchId = typeof raw.switchId === "string" && raw.switchId.trim() ? raw.switchId.trim() : undefined;
      if (switchId) ensureNamedSwitch(draft, switchId, `${name} 작동`);

      const openCmds: Command[] = [
        { kind: "showAnimation", target: { eventId: "" }, animationId: propFxId(prop.id, "open"), wait: true } as Command,
      ];
      const loot = buildLootCommands(draft, raw.loot, `props[${index}]`, warnings);
      if (loot.length) openCmds.push(...withLootPopups(loot));
      if (typeof raw.message === "string" && raw.message.trim()) openCmds.push(say(undefined, raw.message.trim()));
      if (switchId) openCmds.push({ kind: "setSwitch", switchId, value: true } as Command);
      openCmds.push({ kind: "setSelfSwitch", key: "A", value: true } as Command);

      const afterCmds: Command[] = [];
      if (toggleable) {
        afterCmds.push({ kind: "showAnimation", target: { eventId: "" }, animationId: propFxId(prop.id, "close"), wait: true } as Command);
        if (switchId) afterCmds.push({ kind: "setSwitch", switchId, value: false } as Command);
        afterCmds.push({ kind: "setSelfSwitch", key: "A", value: false } as Command);
      } else if (typeof raw.afterMessage === "string" && raw.afterMessage.trim()) {
        afterCmds.push(say(undefined, raw.afterMessage.trim()));
      }

      let id = `ev_prop_${prop.id}_${x}_${y}`.replace(/[^\w]/g, "_");
      for (let n = 2; used.has(id); n += 1) id = `ev_prop_${prop.id}_${x}_${y}_${n}`.replace(/[^\w]/g, "_");
      used.add(id); taken.add(`${x},${y}`);

      const isBreak = prop.playback === "break";
      const p0: Page = {
        id: `${id}_p0`,
        name: "닫힘/대기",
        conditions: [],
        graphic: { transparent: true },
        trigger: { kind: "action" },
        priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        interaction: { kind: "container", style, propId: prop.id },
        commands: openCmds,
      } as unknown as Page;

      const p1: Page = {
        id: `${id}_p1`,
        name: isBreak ? "파괴됨" : "작동됨",
        conditions: [{ kind: "selfSwitch", key: "A", value: true }],
        graphic: { transparent: true },
        trigger: { kind: "action" },
        priority: isBreak ? "below" : "same",
        ...(isBreak ? { through: true } : {}),
        movement: { type: "fixed", speed: 3, frequency: 3 },
        interaction: { kind: "container", style, propId: prop.id, searched: true },
        commands: afterCmds,
      } as unknown as Page;

      const event = {
        id, name, x, y, trigger: { kind: "action" }, commands: [],
        pages: [p0, p1],
      } as unknown as GameEvent;

      map.events.push(event);
      placed.push(`${name}[${prop.id}](${x},${y})`);
    });

    return { summary: `상호작용 오브젝트 ${placed.length}개 배치: ${placed.join(", ")}`, warnings };
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

export const SEARCH_CONTAINER_TOOLS: readonly ToolDefinition[] = [
  placeSearchContainers,
  listInteractivePropsTool,
  placeInteractivePropsTool,
];
