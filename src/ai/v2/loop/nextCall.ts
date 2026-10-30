// H3·H7·H8 — «다음 호출 한 개»를 결정적으로 고른다(할 일 고리 갈고리).
//   H3 도구 실패 직후: 거절을 분류해 다음 호출(동사 + 채운 인자 뼈대)을 결과에 싣고, 다음 차례 그 동사를 우선한다(실행기 SoftToolRequirement).
//   H7 멈춤 재주입: 「지금 할 것: <항목> — 다음 호출: <동사>(<인자 뼈대>)」 — 항목의 기계 확인 종류에서 뼈대를 만든다.
//   H8 같은 거절 두 번: 같은 동사·같은 모양을 버리는 전략 안내(맵을 다시 지을 수 없으면 꾸밈 한두 번 뒤 막힘, 새 장소가 꼭 필요하면 새 맵+잇기).
// 근거: terra boss-room r1~r3 — edit_place 거절 글이 move_event·stamp_object 를 일렀는데 모델은 다른 길을 찾지 못하고 block 했다.
import type { Project } from "@/project/types";
import type { TodoItem } from "../todo/types";
import { eventListLine, findMapId } from "./argGuard";
import { nameScore } from "../todo/names";

type Obj = Record<string, unknown>;
export interface NextCall {
  readonly verb: string;
  readonly args: Obj;
  /** 왜 이 호출인가(한 줄) */
  readonly why: string;
}

const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
/** 사람·모델이 읽는 호출 한 줄 — 자리표시는 <…> 로 둔다. */
export function formatCall(call: NextCall): string {
  const body = JSON.stringify(call.args).replace(/"(<[^"<>]*>)"/gu, "$1");
  return `${call.verb}(${body.length > 420 ? `${body.slice(0, 420)}…` : body})`;
}

const mapOf = (args: Obj): string | undefined => typeof args.mapId === "string" ? args.mapId
  : isObj(args.patch) && typeof args.patch.mapId === "string" ? args.patch.mapId
  : isObj(args.a) && typeof args.a.mapId === "string" ? args.a.mapId : undefined;

/** 쓰기 동사 이름이 거절 글에 들어 있나(낱말 경계). */
const mentions = (text: string, verb: string) => new RegExp(`(^|[^a-z_])${verb}([^a-z_]|$)`, "u").test(text);

/** 동사마다 «처음 부를 때» 쓰는 인자 뼈대(자리표시 <…>). mapId 를 알면 채운다. */
export function skeletonFor(verb: string, mapId?: string, extra: Obj = {}): Obj {
  const m = mapId ?? "<mapId>";
  switch (verb) {
    case "stamp_object": return { objectId: "<list_spatial_designs({kind:'object'}) 의 id>", mapId: m, x: "<x>", y: "<y>", ...extra };
    case "move_event": return { mapId: m, eventId: "<eventId>", x: "<x>", y: "<y>", ...extra };
    case "fill_region": return { mapId: m, x: "<x>", y: "<y>", w: "<w>", h: "<h>", tile: "<타일>", ...extra };
    case "move_object": return { mapId: m, at: { x: "<x>", y: "<y>" }, to: { x: "<x>", y: "<y>" }, ...extra };
    case "dress_room": return { mapId: m, at: { x: "<바닥 x>", y: "<바닥 y>" }, purpose: "<방 쓰임>", ...extra };
    case "create_transfer_pair": return { a: { mapId: m, x: "<x>", y: "<y>" }, b: { mapId: "<도착 mapId>", x: "<x>", y: "<y>" }, ...extra };
    case "make_place": return { type: "<interior|village|dungeon|cave>", name: "<장소 이름>", ...extra };
    case "add_people": return { mapId: m, people: [{ role: "<역할>", name: "<이름>", where: "<자리 낱말>", firstTalk: ["<대사>"] }], ...extra };
    case "add_event": return { event: { kind: "cutscene", mapId: m, when: "touch", beats: [{ do: "say", who: "<누가>", text: "<대사>" }] }, ...extra };
    case "get_event": return { mapId: m, eventId: "<eventId>", ...extra };
    case "inspect": return { mapId: m, ...extra };
    default: return { ...(mapId ? { mapId } : {}), ...extra };
  }
}

/**
 * H3 — 거절 하나 뒤의 다음 호출. available = 이 실행에 있는 동사, used = 거절 뒤로 이미 부른 동사(같은 제안을 되풀이하지 않게).
 * 없으면 undefined(그때는 고리의 실패 세기·막힘이 다음을 정한다).
 */
export function nextAfterFailure(tool: string, args: unknown, failure: string, project: Project, available: ReadonlySet<string>, used: ReadonlySet<string> = new Set()): NextCall | undefined {
  const a = isObj(args) ? args : {};
  const body = failure.replace(/^[^:]*실행 실패:\s*/u, "");
  const mapId = mapOf(a);
  const has = (v: string) => available.has(v);
  // 이동 칸 잇기 — 문앞이 막힘: doorAt 을 빼고 부르면 도구가 걸어 닿는 가장 가까운 칸으로 옮겨 잇는다.
  if (tool === "create_transfer_pair" && /안전한 출입구를 만들 수 없|봉쇄|겹칩니다|doorAt/u.test(body)) {
    const strip = (e: unknown) => { if (!isObj(e)) return e; const { doorAt: _d, ...rest } = e; return rest; };
    return { verb: tool, args: { ...a, a: strip(a.a), b: strip(a.b) }, why: "문앞 칸이 막혀 거절 — doorAt 을 빼면 도구가 걸어 닿는 가장 가까운 칸으로 옮겨 잇는다" };
  }
  if (tool === "upsert_troop" && /최소 1마리/u.test(body)) {
    const troop = isObj(a.troop) ? a.troop : a;
    const enemies = ((project.database?.enemies ?? []) as { id: string; name?: string }[]).slice(0, 4).map((e) => e.id);
    return { verb: tool, args: { troop: { id: troop.id ?? "<troop id>", name: troop.name ?? "<이름>", enemyIds: [enemies[0] ?? "<적 id>"] } }, why: `enemyIds 에 적 id 하나 이상(members 는 비우지 말고 빼기) — 적 후보: ${enemies.join(", ")}` };
  }
  if (/이벤트를 찾을 수 없습니다|존재하지 않는 이벤트/u.test(body)) {
    const list = eventListLine(project, mapId, 8);
    const first = /이 맵의 이벤트:\s*([^\s,)…]+)/u.exec(body)?.[1];
    if (list || first) return { verb: "get_event", args: { mapId: mapId ?? "<mapId>", eventId: "<아래 목록의 id>" }, why: `그 id 는 없다(지워졌거나 다시 지어 id 가 바뀜) — 그 맵의 이벤트: ${list || first}` };
  }
  // 거절 글이 다른 동사를 일렀다(«stamp_object·fill_region·move_event 로 고친다»): 그중 아직 안 쓴 것 하나.
  const named = [...available].filter((v) => v !== tool && v !== "todo" && mentions(body, v)).sort((x, y) => body.indexOf(x) - body.indexOf(y));
  const fresh = named.find((v) => !used.has(v)) ?? named[0];
  if (fresh) {
    // 고치기 결함이 짚은 칸이 있으면 뼈대에 넣는다(비평 «(3,10) 13×5»).
    const at = /\((\d+)\s*,\s*(\d+)\)/u.exec(body);
    const extra: Obj = at && (fresh === "stamp_object" || fresh === "move_event") ? { x: Number(at[1]), y: Number(at[2]) } : {};
    return { verb: fresh, args: skeletonFor(fresh, mapId, extra), why: `거절 글이 이른 다른 길 — ${fresh}` };
  }
  // 그림 판에 맵 밖·덮음 거절이 남았다: 빈 땅을 먼저 본다.
  if (tool === "stamp_object" && has("inspect")) return { verb: "inspect", args: skeletonFor("inspect", mapId), why: "놓을 빈 땅을 다시 본다(가까운 자리가 모두 막힘) — 그래도 없으면 todo block" };
  return undefined;
}

/** 거절 서명 — 같은 거절인지 가른다(수·id 가림). */
export const failureClass = (tool: string, failure: string): string =>
  `${tool}:${failure.replace(/^[^:]*실행 실패:\s*/u, "").replace(/\d+/gu, "#").replace(/[0-9a-f]{8,}|ev_[\w-]+|map_[\w-]+/giu, "@").slice(0, 80)}`;

/**
 * H8 — 같은 항목에서 같은 거절이 두 번: 같은 동사·모양을 버리는 결정적 전략 글. 없으면 undefined.
 * item.source 가 model(새로 만들기)이면 새 맵 + 잇기, 고치기 항목(gate·critic·vqa)이면 꾸밈 한두 번 뒤 막힘.
 */
export function strategyAfterRepeat(tool: string, failure: string, item: TodoItem | undefined, available: ReadonlySet<string>): { text: string; call?: NextCall } | undefined {
  const body = failure.replace(/^[^:]*실행 실패:\s*/u, "");
  const fixing = !!item && item.source !== "model";
  if (tool === "edit_place" && /다시 짓기 안 함|다시 지을 방 구성도|기록이 없고/u.test(body)) {
    if (fixing) return { text: "[전략 바꾸기] 이 장소는 다시 짓지 않는다(edit_place 는 같은 거절만 낸다). 짚힌 자리에 stamp_object 로 꾸밈을 한두 개 찍고, 그래도 남으면 todo block(\"다시 지을 수 없는 장소 — 꾸밈만 함\") 하고 다음 항목으로 간다.", ...(available.has("stamp_object") ? { call: { verb: "stamp_object", args: skeletonFor("stamp_object", undefined), why: "다시 짓지 않고 덧찍기" } } : {}) };
    return { text: "[전략 바꾸기] 있던 장소는 다시 짓지 않는다. 새 장소가 필요하면 make_place 로 새 맵을 짓고 create_transfer_pair 로 그 장소와 잇는다(있던 맵은 그대로).", call: { verb: "make_place", args: skeletonFor("make_place"), why: "새 맵 + 잇기" } };
  }
  if (tool === "stamp_object" && /완성된 집|transfer 목적지|겹치지 않습니다|겹칩니다/u.test(body)) {
    return { text: "[전략 바꾸기] 이 자리에는 찍을 수 없다(집·이동 칸·맵 밖). inspect 로 빈 땅을 고르거나, 그림이 꼭 필요하지 않으면 todo block(\"놓을 자리 없음\") 하고 다음 항목으로 간다.", call: { verb: "inspect", args: skeletonFor("inspect"), why: "빈 땅 다시 보기" } };
  }
  if (tool === "create_transfer_pair") {
    return { text: "[전략 바꾸기] 이 두 칸으로는 잇지 못한다. 양쪽 doorAt 을 빼고(도구가 걸어 닿는 칸으로 옮긴다) 다른 가장자리 길 끝 칸으로 다시 부르거나, 그래도 안 되면 todo block(이유).", call: { verb: "create_transfer_pair", args: skeletonFor("create_transfer_pair"), why: "doorAt 없이 다른 칸" } };
  }
  return { text: `[전략 바꾸기] ${tool} 가 같은 이유로 두 번 거절됐다 — 같은 동사·같은 인자 모양을 다시 쓰지 않는다. 다른 동사로 하거나, 할 수 없으면 todo block(이유) 하고 다음 항목으로 간다.` };
}

const PLACE_TYPE: Record<string, string> = { village: "village", interior: "interior", dungeon: "dungeon", cave: "cave", field: "village", street: "street" };

/** H7 — 열린 항목의 다음 호출(기계 확인 종류에서). */
export function nextForItem(item: TodoItem, project: Project, available: ReadonlySet<string>): NextCall | undefined {
  const c = item.check;
  const has = (v: string) => available.has(v);
  const mapId = (name?: string) => findMapId(project, name);
  if (!c || c.kind === "none") {
    // 관문·비평 항목: 글 속 맵 id 와 «edit_place·move_object·dress_room / add_event» 낱말로.
    const m = /\((map_[\w-]+)\)/u.exec(item.content)?.[1];
    const verb = ["add_event", "edit_place", "stamp_object", "move_event", "create_transfer_pair"].find((v) => has(v) && new RegExp(`(^|[^a-z_])${v}([^a-z_]|$)`, "u").test(item.content));
    return verb ? { verb, args: skeletonFor(verb, m), why: "항목 글이 이른 동사" } : undefined;
  }
  switch (c.kind) {
    case "place": return has("make_place") ? { verb: "make_place", args: { type: PLACE_TYPE[c.placeKind ?? ""] ?? "<interior|village|dungeon|cave>", name: c.name }, why: "장소 짓기" } : undefined;
    case "person": return has("add_people") ? { verb: "add_people", args: { mapId: mapId(c.map) ?? "<mapId>", people: [{ role: c.name, name: c.name, where: "<자리 낱말>", firstTalk: ["<대사>"] }] }, why: "인물 두기" } : undefined;
    case "talk": {
      // 그 인물이 이미 있으면 말 걸기 장면, 없으면 사람 두기(대사 포함).
      const present = Object.values(project.maps).some((m) => (m.events ?? []).some((e) => (e.name ?? "").includes(c.who)));
      if (present && has("add_event")) return { verb: "add_event", args: { event: { kind: "talk", mapId: "<그 인물이 있는 mapId>", when: "talk", after: c.who, beats: [{ do: "say", who: c.who, text: c.says ? `<${c.says} 를 넣은 대사>` : "<대사>" }] } }, why: "그 인물 대사 장면" };
      return has("add_people") ? { verb: "add_people", args: { people: [{ role: c.who, name: c.who, where: "<자리 낱말>", firstTalk: [c.says ? `<${c.says} 를 넣은 대사>` : "<대사>"] }] }, why: "대사가 있는 인물 두기" } : undefined;
    }
    case "battle": {
      if (has("place_field_enemy") && !c.boss) return { verb: "place_field_enemy", args: { mapId: mapId(c.map) ?? "<mapId>", x: "<x>", y: "<y>", troopId: "<troop id>", behavior: "stationary" }, why: "보이는 적 한 마리" };
      if (has("patch_event_page")) return { verb: "patch_event_page", args: { mapId: mapId(c.map) ?? "<mapId>", eventId: `<${c.who ?? "보스"} 이벤트 id>`, pageIndex: 0, set: { commands: ["<원래 명령 그대로>", { kind: "battleProcessing", troopId: "<troop id>", canEscape: false }] } }, why: "대사 이벤트 끝에 전투 명령(원래 명령은 지우지 말고 이어 붙인다)" };
      return undefined;
    }
    case "link": {
      if (!has("create_transfer_pair")) return undefined;
      return { verb: "create_transfer_pair", args: { a: { mapId: mapId(c.from) ?? `<${c.from} mapId>`, x: "<가장자리 길 끝 x>", y: "<y>" }, b: { mapId: mapId(c.to) ?? `<${c.to} mapId>`, x: "<입구 x>", y: "<y>" } }, why: "두 맵 잇기(doorAt 은 문 그림이 있을 때만, 출입구 바로 위 칸)" };
    }
    case "ending": return has("define_ending") ? { verb: "define_ending", args: { "<엔딩 정의>": "…" }, why: "엔딩" } : has("add_event") ? { verb: "add_event", args: skeletonFor("add_event", mapId(c.map)), why: "엔딩 장면" } : undefined;
    case "item": return has("upsert_item") ? { verb: "upsert_item", args: { item: { id: "<item id>", name: c.name } }, why: "아이템" } : undefined;
    case "objective": return has("set_objective") ? { verb: "set_objective", args: { text: c.text ? `<${c.text} 를 넣은 목표 줄>` : "<목표 줄>", at: "start" }, why: "목표 줄" } : undefined;
    default: return undefined;
  }
}

/**
 * H5 동사 범위 — 항목 확인 종류마다 상위 동사(한 번에 그 요소를 짓는 것)와, 상위 동사 전에 부르면 돌려보낼 하위 도구.
 * 하위 도구로 한 칸씩 조립하면 싼 모델은 이벤트 페이지·좌표를 손으로 맞추다 거절을 쌓는다(omo-loop-1030b terra: get_event 44·patch_event_page 22).
 * battle 은 «말을 걸고 → 보스전» 을 한 번에 짓는 상위 동사가 없다 — 하위 도구 조립이 유일한 길이라 돌려보내지 않고 기록만 한다.
 */
export const VERB_SCOPE: Readonly<Partial<Record<string, { high: readonly string[]; low: readonly string[] }>>> = {
  place: { high: ["make_place", "author_forest_route", "edit_place"], low: ["stamp_object", "upsert_event", "patch_event_page", "add_event_page", "place_npc"] },
  person: { high: ["add_people"], low: ["upsert_event", "place_npc", "add_event_page"] },
  talk: { high: ["add_people", "add_event"], low: ["upsert_event", "place_npc"] },
  link: { high: ["create_transfer_pair"], low: ["upsert_event", "patch_event_page", "add_event_page"] },
};
/** 상위 동사가 없어 하위 도구로만 짓는 확인 종류(측정 보고용). */
export const MISSING_HIGH_VERB: Readonly<Partial<Record<string, string>>> = {
  battle: "대사 → 전투(보스전) 를 한 번에 짓는 동사가 없다 — upsert_enemy·upsert_troop·patch_event_page(battleProcessing) 조립",
  ending: "엔딩 장면(축하 대사 → 엔딩 호출)을 한 번에 짓는 동사가 없다 — add_event 대사 + define_ending·patch_event_page 조립",
};

/** 이 항목에서 이 도구를 돌려보낼까: 하위 도구이고, 이 항목에서 상위 동사를 아직 안 불렀고, 묶인 대상이 없을 때. 돌려보내면 상위 동사 호출 하나. */
export function scopeRedirect(item: TodoItem, tool: string, usedOnItem: ReadonlySet<string> | undefined, project: Project, available: ReadonlySet<string>): NextCall | undefined {
  const kind = item.check?.kind;
  const scope = kind ? VERB_SCOPE[kind] : undefined;
  if (!scope || !scope.low.includes(tool)) return undefined;
  if (scope.high.some((v) => usedOnItem?.has(v))) return undefined;
  const r = item.refs;
  if (r && (r.mapIds?.length || r.eventIds?.length)) return undefined;
  // 이미 있는 대상을 고치는 항목이면 하위 도구가 맞다 — 장소 이름이 지금 맵이거나, 인물·대사 이름이 지금 이벤트 이름이면 돌려보내지 않는다.
  const c = item.check!;
  if (c.kind === "place" && findMapId(project, c.name)) return undefined;
  const who = c.kind === "person" ? c.name : c.kind === "talk" ? c.who : undefined;
  if (who && Object.values(project.maps).some((m) => (m.events ?? []).some((ev) => nameScore(who, String(ev.name ?? "")) > 0))) return undefined;
  const call = nextForItem(item, project, available);
  if (!call || !scope.high.includes(call.verb)) {
    const verb = scope.high.find((v) => available.has(v));
    return verb ? { verb, args: skeletonFor(verb), why: `${kind} 항목의 상위 동사` } : undefined;
  }
  return { ...call, why: `${kind} 항목은 ${call.verb} 한 번으로 짓는다` };
}
