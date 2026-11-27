// editor/tools/searchContainerTools.ts
// 뒤질 수 있는 수납(통·상자·항아리·자루·서랍) + 시대별 100종 상호작용 오브젝트(project/interactiveProps) 배치 조수 도구.
//  - place_search_containers: 기존 수납 뒤지기 패턴 + 선택적 propId(100종 실원본 멀티프레임 PNG 스트립) 지원.
//  - list_interactive_props: 100종 실원본 상호작용 오브젝트(판타지·던전·현대·조선·무림·SF·스팀펑크) 검색.
//  - place_interactive_props: 항아리 파괴·양문 옷장·비밀 책장·자판기·화로 점화·에어록·봉인 제단 등 100종을 맵에 즉시 배치.
import { buildContainerSearchEvent, ownerNoticeCommands, withLootPopups } from "@/project/containerSearchPattern";
import { CONTAINER_STYLES, isContainerStyle, propFxId, type ContainerStyle } from "@/project/containerFx";
import {
  INTERACTIVE_PROP_CATEGORIES,
  INTERACTIVE_PROP_ERAS,
  INTERACTIVE_PROP_ERA_LABELS,
  INTERACTIVE_PROP_GENRES,
  INTERACTIVE_PROP_ROLES,
  inferInteractivePropEra,
  interactivePropById,
  searchInteractiveProps,
  type InteractivePropCategory,
  type InteractivePropEntry,
  type InteractivePropEra,
  type InteractivePropGenre,
  type InteractivePropMotion,
  type InteractivePropMount,
  type InteractivePropPlayback,
  type InteractivePropRole,
  type InteractivePropZone,
} from "@/project/interactiveProps";
import {
  AUTHOR_MOTION_RECIPES,
  buildAuthoredPropStrip,
  type AuthorMotionRecipe,
  type PixelRect,
} from "@/project/interactivePropAuthoring";
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
      const requestedProp = typeof raw.propId === "string" && raw.propId.trim() ? interactivePropById(raw.propId.trim(), draft) : undefined;
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
    "5축(세계·장르·기능 카테고리·배치 공간·게임플레이 역할) 기반 실원본 상호작용 오브젝트 카탈로그를 검색한다. "
    + "공포(horror)·퍼즐탈출(puzzle-escape)·일상(romance-daily)·숨기(hide)·밀기문(door-pass)·파괴(breakable) 등으로 정확히 찾아 place_interactive_props 에 넘긴다.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "검색어(예: 공포, 밀기문, 항아리, 옷장, 숨기, 자판기, 거울)" },
      era: { type: "string", enum: [...INTERACTIVE_PROP_ERAS], description: "시대 필터(생략 시 전체 또는 mapId 추론)" },
      genre: { type: "string", enum: [...INTERACTIVE_PROP_GENRES], description: "장르 필터(horror·puzzle-escape·adventure·romance-daily·monster-collect·life-survival·eastern·cyber-scifi)" },
      category: { type: "string", enum: [...INTERACTIVE_PROP_CATEGORIES], description: "기능 카테고리(door-pass·container·breakable·machine·light-fire·water-env·gimmick·outdoor-ride)" },
      zone: { type: "string", enum: ["indoor", "outdoor", "both"], description: "배치 공간(실내/실외)" },
      role: { type: "string", enum: [...INTERACTIVE_PROP_ROLES], description: "게임플레이 역할(loot·passage·hide·puzzle-clue·ambient-light·hazard-trap)" },
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
      : (!args.query && !args.genre && !args.category && !args.role && inferredEra ? inferredEra : undefined);
    const genre = typeof args.genre === "string" && (INTERACTIVE_PROP_GENRES as readonly string[]).includes(args.genre)
      ? (args.genre as InteractivePropGenre) : undefined;
    const category = typeof args.category === "string" && (INTERACTIVE_PROP_CATEGORIES as readonly string[]).includes(args.category)
      ? (args.category as InteractivePropCategory) : undefined;
    const zone = typeof args.zone === "string" && ["indoor", "outdoor", "both"].includes(args.zone)
      ? (args.zone as InteractivePropZone) : undefined;
    const role = typeof args.role === "string" && (INTERACTIVE_PROP_ROLES as readonly string[]).includes(args.role)
      ? (args.role as InteractivePropRole) : undefined;
    const playback = typeof args.playback === "string" ? (args.playback as InteractivePropPlayback) : undefined;
    const matches = searchInteractiveProps({
      query: typeof args.query === "string" ? args.query : undefined,
      era,
      genre,
      category,
      zone,
      role,
      playback,
    }, draft);
    const limit = Math.max(1, Math.min(100, Number(args.limit ?? 30) || 30));
    const sliced = matches.slice(0, limit);
    const lines = sliced.map((p) => `${p.id} | ${p.name} | ${INTERACTIVE_PROP_ERA_LABELS[p.era]} | ${p.category ?? "-"}/${p.zone ?? "-"} | [${(p.genres ?? []).join(",")}]`);
    return {
      summary: `상호작용 오브젝트 ${matches.length}건 중 ${sliced.length}건:\n${lines.join("\n")}`,
      data: {
        total: matches.length,
        props: sliced.map((p) => ({
          id: p.id, name: p.name, era: p.era, world: p.world, category: p.category,
          genres: p.genres, zone: p.zone, mount: p.mount, roles: p.roles,
          motion: p.motion, playback: p.playback, tags: p.tags,
        })),
      },
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
      const prop = interactivePropById(typeof raw.propId === "string" ? raw.propId.trim() : undefined, draft);
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

const RECIPE_TO_MOTION: Readonly<Record<AuthorMotionRecipe, { readonly motion: InteractivePropMotion; readonly playback: InteractivePropPlayback; readonly se: string; readonly loopFromFrame?: number }>> = {
  "push-in-door": { motion: "swing-single", playback: "toggle", se: "door_wood" },
  "swing-door": { motion: "swing-single", playback: "toggle", se: "door_wood" },
  "curtain-part": { motion: "swing-double", playback: "toggle", se: "cloth_rustle" },
  "hinge-lid": { motion: "hinge-lid", playback: "toggle", se: "chest_open" },
  "slide-door": { motion: "slide-door", playback: "toggle", se: "stone_scrape" },
  "smash-break": { motion: "smash-break", playback: "break", se: "ceramic_break" },
  "horror-flicker": { motion: "activate-loop", playback: "loopAfterOpen", se: "steam_click", loopFromFrame: 1 },
  "glow-activate": { motion: "activate-loop", playback: "loopAfterOpen", se: "magic_chime", loopFromFrame: 2 },
  "rattle-scare": { motion: "toggle-switch", playback: "oneshot", se: "wood_creak" },
};

function slugPropId(name: string, rawId?: string): string {
  const base = (rawId?.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, "-")).replace(/^-+|-+$/g, "");
  if (base && /^[a-z0-9][a-z0-9-]{2,48}$/.test(base)) return base;
  let h = 2166136261;
  for (let i = 0; i < name.length; i += 1) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `custom-prop-${(h >>> 0).toString(36)}`;
}

const authorInteractivePropTool: ToolDefinition = {
  name: "author_interactive_prop",
  description:
    "카탈로그(156종)에 없는 새 상호작용 오브젝트(5프레임 가로 PNG 스트립)를 AI 조수가 직접 저작해 프로젝트에 등록한다. "
    + "모드 A: framesGrid(4~6프레임 문자 격자 배열) + palette 로 직접 프레임별 도트를 찍는다. "
    + "모드 B(권장): baseGrid(0번 정지 프레임 문자 격자 1장) + palette + motionRecipe(push-in-door·swing-door·curtain-part·hinge-lid·slide-door·smash-break·horror-flicker·glow-activate·rattle-scare)를 넘기면 "
    + "실제 픽셀을 물리 변환해 5프레임 스트립을 자동 합성·검증한다. "
    + "저장된 프롭은 project.assets.uploaded 에 PNG 로 내장되어 place_interactive_props·에디터 패널·게임 실행·내보내기에서 즉시 작동한다. "
    + "place({mapId,x,y,…}) 를 함께 주면 제작과 동시에 맵에 배치한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "선택: 영소문자·숫자·하이픈 프롭 id(예: custom-cuckoo-clock). 생략 시 자동 생성" },
      name: { type: "string", description: "프롭 한국어 이름(예: 저주받은 뻐꾸기시계)" },
      era: { type: "string", enum: [...INTERACTIVE_PROP_ERAS], description: "시대(기본 fantasy)" },
      category: { type: "string", enum: [...INTERACTIVE_PROP_CATEGORIES], description: "기능 카테고리(기본 gimmick)" },
      genres: { type: "array", items: { type: "string", enum: [...INTERACTIVE_PROP_GENRES] }, description: "장르 태그 배열" },
      zone: { type: "string", enum: ["indoor", "outdoor", "both"], description: "배치 공간(기본 both)" },
      mount: { type: "string", enum: ["floor", "wall", "doorway", "counter"], description: "부착면(기본 floor)" },
      roles: { type: "array", items: { type: "string", enum: [...INTERACTIVE_PROP_ROLES] }, description: "게임플레이 역할 배열" },
      palette: {
        type: "object",
        additionalProperties: true,
        description: "문자 1글자 -> #rrggbb (또는 투명 null). '.' 과 공백은 자동 투명.",
      },
      baseGrid: {
        type: "array",
        items: { type: "string" },
        description: "모드 B: 0번 정지 프레임 픽셀 문자 격자(24×32 캐릭터 1:1 도트 밀도 기준 — 소형 항아리·상자 16×16~24×20, 세로 가구·문 16×32~24×36, 대형 제단·석상 32×32~48×48).",
      },
      motionRecipe: {
        type: "string",
        enum: [...AUTHOR_MOTION_RECIPES],
        description: "모드 B 자동 물리 모션 레시피(push-in-door·swing-door·curtain-part·hinge-lid·slide-door·smash-break·horror-flicker·glow-activate·rattle-scare)",
      },
      framesGrid: {
        type: "array",
        items: { type: "array", items: { type: "string" } },
        description: "모드 A: 3~8프레임 픽셀 문자 격자를 직접 지정.",
      },
      region: {
        type: "object",
        properties: { x0: { type: "integer" }, y0: { type: "integer" }, x1: { type: "integer" }, y1: { type: "integer" } },
        description: "선택: 문짝·광원·뚜껑 등 모션이 적용될 픽셀 영역(생략 시 자동 추론)",
      },
      hingeSide: { type: "string", enum: ["left", "right"], description: "문 경첩 방향(기본 left)" },
      accentColor: { type: "string", description: "강조·광원·안광 hex 색(예: #ff3b4a, #7ee8ff)" },
      eyePoints: {
        type: "array",
        items: { type: "array", items: { type: "integer" } },
        description: "rattle-scare 에서 안광이 켜질 [x, y] 픽셀 좌표 목록",
      },
      playback: { type: "string", enum: ["oneshot", "toggle", "break", "loopAfterOpen"], description: "재생 방식(생략 시 레시피 기본값)" },
      frameMs: { type: "integer", description: "프레임당 밀리초(기본 110)" },
      se: { type: "string", description: "효과음 키(door_wood·ceramic_break·wood_creak·magic_chime·fire_ignite 등)" },
      tags: { type: "array", items: { type: "string" } },
      place: {
        type: "object",
        properties: {
          mapId: { type: "string" },
          x: { type: "integer" },
          y: { type: "integer" },
          message: { type: "string" },
          afterMessage: { type: "string" },
          toggleable: { type: "boolean" },
          switchId: { type: "string" },
          loot: { type: "object", properties: { itemId: { type: "string" }, count: { type: "integer" }, gold: { type: "integer" } } },
        },
        required: ["mapId", "x", "y"],
        description: "선택: 제작 직후 이 맵 좌표에 즉시 배치한다.",
      },
    },
    required: ["name", "palette"],
  },
  invalidArgsExample: {
    name: "저주받은 뻐꾸기시계",
    era: "fantasy",
    category: "gimmick",
    genres: ["horror", "puzzle-escape"],
    zone: "indoor",
    mount: "wall",
    roles: ["puzzle-clue", "hazard-trap"],
    palette: { ".": null, "d": "#2b1d18", "w": "#6d4833", "l": "#9c6d4c", "f": "#e6dcc8", "g": "#d9a441" },
    baseGrid: [
      "......dddd......",
      "....ddwwwwdd....",
      "...dwwllllwwd...",
      "..dwwlfffflwwd..",
      "..dwlffddfflwd..",
      "..dwlffdffflwd..",
      "..dwwlfffflwwd..",
      "..dwwwwggwwwwd..",
      "..dwwwddddwwwd..",
      "..dwwwd..dwwwd..",
      "..dwwwwwwwwwwd..",
      "...dddddddddd...",
      ".....d....d.....",
      ".....g....g.....",
      "................",
      "................",
    ],
    motionRecipe: "rattle-scare",
    accentColor: "#ff3844",
    eyePoints: [[6, 4], [9, 4]],
  },
  run(draft, args): ToolExecResult {
    const name = typeof args.name === "string" ? args.name.trim() : "";
    if (!name) throw new ToolError("name 이 비었습니다.", { code: "invalid-args" });
    if (!isRec(args.palette)) throw new ToolError("palette 객체가 필요합니다.", { code: "invalid-args" });

    const recipe: AuthorMotionRecipe = typeof args.motionRecipe === "string"
      && (AUTHOR_MOTION_RECIPES as readonly string[]).includes(args.motionRecipe)
      ? (args.motionRecipe as AuthorMotionRecipe)
      : "glow-activate";

    let region: PixelRect | undefined;
    if (isRec(args.region)) {
      region = {
        x0: Number(args.region.x0) || 0,
        y0: Number(args.region.y0) || 0,
        x1: Number(args.region.x1) || 0,
        y1: Number(args.region.y1) || 0,
      };
    }
    const eyePoints = Array.isArray(args.eyePoints)
      ? args.eyePoints
          .filter((pt): pt is [number, number] => Array.isArray(pt) && pt.length >= 2)
          .map((pt) => [Number(pt[0]) || 0, Number(pt[1]) || 0] as const)
      : undefined;

    let built;
    try {
      built = buildAuthoredPropStrip({
        palette: args.palette as Record<string, string | null>,
        framesGrid: Array.isArray(args.framesGrid) ? (args.framesGrid as string[][]) : undefined,
        baseGrid: Array.isArray(args.baseGrid) ? (args.baseGrid as string[]) : undefined,
        motionRecipe: recipe,
        region,
        hingeSide: args.hingeSide === "right" ? "right" : "left",
        accentColor: typeof args.accentColor === "string" ? args.accentColor : undefined,
        eyePoints,
      });
    } catch (err) {
      throw new ToolError(err instanceof Error ? err.message : String(err), { code: "invalid-args" });
    }

    const id = slugPropId(name, typeof args.id === "string" ? args.id : undefined);
    const resourceId = `iprop-${id}`;
    const recipeDef = RECIPE_TO_MOTION[recipe];
    const era: InteractivePropEra = typeof args.era === "string" && (INTERACTIVE_PROP_ERAS as readonly string[]).includes(args.era)
      ? (args.era as InteractivePropEra) : "fantasy";
    const category: InteractivePropCategory = typeof args.category === "string" && (INTERACTIVE_PROP_CATEGORIES as readonly string[]).includes(args.category)
      ? (args.category as InteractivePropCategory) : "gimmick";
    const genres: InteractivePropGenre[] = Array.isArray(args.genres)
      ? args.genres.filter((g): g is InteractivePropGenre => typeof g === "string" && (INTERACTIVE_PROP_GENRES as readonly string[]).includes(g))
      : ["adventure"];
    const roles: InteractivePropRole[] = Array.isArray(args.roles)
      ? args.roles.filter((r): r is InteractivePropRole => typeof r === "string" && (INTERACTIVE_PROP_ROLES as readonly string[]).includes(r))
      : ["ambient-light"];
    const zone: InteractivePropZone = typeof args.zone === "string" && ["indoor", "outdoor", "both"].includes(args.zone)
      ? (args.zone as InteractivePropZone) : "both";
    const mount: InteractivePropMount = typeof args.mount === "string" && ["floor", "wall", "doorway", "counter"].includes(args.mount)
      ? (args.mount as InteractivePropMount) : "floor";
    const playback: InteractivePropPlayback = typeof args.playback === "string" && ["oneshot", "toggle", "break", "loopAfterOpen"].includes(args.playback)
      ? (args.playback as InteractivePropPlayback) : recipeDef.playback;

    const entry: InteractivePropEntry = {
      id,
      name,
      wave: "custom-ai",
      era,
      world: era,
      genres: genres.length ? genres : ["adventure"],
      category,
      zone,
      mount,
      roles: roles.length ? roles : ["ambient-light"],
      motion: recipeDef.motion,
      playback,
      ...(recipeDef.loopFromFrame !== undefined && playback === "loopAfterOpen" ? { loopFromFrame: recipeDef.loopFromFrame } : {}),
      stripPath: built.dataUrl,
      resourceId,
      frameWidth: built.frameWidth,
      frameHeight: built.frameHeight,
      frames: built.frames,
      frameMs: Math.max(70, Math.min(350, Number(args.frameMs ?? 110) || 110)),
      footprint: [Math.max(1, Math.round(built.frameWidth / 16)), Math.max(1, Math.round(built.frameHeight / 16))] as const,
      anchorX: 0.5,
      anchorY: 0.92,
      se: typeof args.se === "string" && args.se.trim() ? args.se.trim() : recipeDef.se,
      tags: Array.isArray(args.tags) ? args.tags.map(String) : [name, category, ...genres],
      sha256: "custom-ai",
    };

    draft.assets.uploaded[resourceId] = {
      id: resourceId,
      name: `${name} 상호작용 스트립`,
      kind: "picture",
      dataUrl: built.dataUrl,
      meta: {
        width: built.frameWidth * built.frames,
        height: built.frameHeight,
        frameWidth: built.frameWidth,
        frameHeight: built.frameHeight,
        frames: built.frames,
        interactiveProp: entry as unknown as Record<string, unknown>,
      },
      generatedBy: "interactive-prop-studio:ai",
    };

    let placeSummary = "";
    const warnings: string[] = [];
    if (isRec(args.place) && typeof args.place.mapId === "string") {
      const placed = placeInteractivePropsTool.run(draft, {
        mapId: args.place.mapId,
        props: [{ ...args.place, propId: id, name }],
      });
      placeSummary = ` · ${placed.summary}`;
      if (placed.warnings) warnings.push(...placed.warnings);
    }

    return {
      summary: `커스텀 상호작용 오브젝트 '${name}' (${id}, ${built.frames}×${built.frameWidth}×${built.frameHeight}, ${playback}) 생성·등록 완료${placeSummary}`,
      data: {
        id,
        resourceId,
        name,
        frameWidth: built.frameWidth,
        frameHeight: built.frameHeight,
        frames: built.frames,
        playback,
        changedSteps: built.changedSteps,
        next: placeSummary ? "show_map_region 으로 배치 결과를 확인하라." : `place_interactive_props({mapId, props:[{x, y, propId:"${id}"}]}) 로 맵에 배치하라.`,
      },
      ...(warnings.length ? { warnings } : {}),
    };
  },
};

export const SEARCH_CONTAINER_TOOLS: readonly ToolDefinition[] = [
  placeSearchContainers,
  listInteractivePropsTool,
  placeInteractivePropsTool,
  authorInteractivePropTool,
];
