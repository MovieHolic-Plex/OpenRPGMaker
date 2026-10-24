/**
 * 『폴른 스타』 제1막 마을 대사와 잔 일 셋(2026-10-24). 대사 원문 = docs/fallen-star/act1-script.md 3·4·5·14·15·16·18절.
 *
 * - 광장 사람들(미레·토비·문지기·할머니·리노)과 집 안 사람들(마르타·오든·오스본·토마·로한)의 대사를 대본대로 바꾼다.
 * - Q1 토마의 납작빵: 빵집 뒤채에서 두 번째로 말을 걸면 의뢰. 납작빵 넷을 문지기·오스본·리노·브람에게 건네고 돌아가면
 *   별빛빵과 빵 목록 확장. 끝나면 sw_fs_q_bread_done(하넬 H7 이 읽는다).
 * - Q2 마르타의 은수저: 여관에서 의뢰. 여관 저장고·약방 자루·토마네 밀가루 통에서 흔적을 찾으면 광장 다리 위 상자 곁에
 *   토비가 나타난다. 은수저 여섯 벌을 마르타에게 돌려주면 무료 숙박권. 끝나면 sw_fs_q_spoon_done(하넬 H8).
 * - Q3 로한의 창: 대장간에서 의뢰. 늑대 송곳니 셋·푸른 불씨 하나를 가져가면 「푸른 불꽃 창」 또는 「별쇠 장검」(별쇠 조각 필요).
 *   의뢰를 끝내기 전에는 대장간이 창을 팔지 않는다(「창은 안 판다」).
 * - 18절 꾸지람: 여관·약방·대장간 수납과 토마의 밀가루 통은 주인이 보고 있으면 한 줄 꾸지람과 작은 벌금. 두 번까지만 말한다.
 * - 의뢰 일지: project.quests 에 그래프 퀘스트 셋(스위치로 단계가 찬다).
 *
 * 수납 이벤트(ev_fs_box_*)는 townLife.ts 가 먼저 단다. 이 파일은 그 위에 페이지를 덧붙이기만 한다.
 */
import { isPassable } from "@/project/collision";
import type { QuestGraphDef } from "@/project/quest/questDef";
import type { Command, Condition, EventPage, GameEvent, GameMap, Project } from "@/project/types";
import { FS_NAMES } from "../fallenStarStory";
import { FS_BAKERY_PRE_IRIS, FS_BREAD_FLAT, FS_BREAD_STARLIGHT, FS_FREE_NIGHT, FS_SILVER_SPOON, fallenBakeryStock, fallenSmithyStock } from "./townLife";

const KAEL = FS_NAMES.hero;
const IRIS = FS_NAMES.android;
const MIRE = "빵집 아주머니 미레";
const TOBI = "꼬마 토비";
const GATE = "동문 문지기";
const ELDER = "광장의 할머니";
const KNIGHT = "심문회 기사";
const RINO = "리노";
const MARTA = "여관 주인 마르타";
const ODEN = "약재상 오든";
const OSBORN = "늙은 별지기 오스본";
const TOMA = "빵집 아저씨 토마";
const ROHAN = "대장장이 로한";
const BRAM = "숲지기 브람";

/** 새 화자 이름 → 얼굴을 빌릴 기존 화자(chronoBell 의 얼굴 표에 덧붙인다). */
export const FS_QUEST_FACE_ALIASES: Readonly<Record<string, string>> = { [MIRE]: "빵집 아주머니", [RINO]: KNIGHT };

const SW_IRIS = "sw_fs_iris_joined";
const SW_MARCHED = "sw_fs_knight_marched";

// Q1 — 토마의 납작빵
const Q1_ON = "sw_fs_q_bread_on";
const Q1_DONE = "sw_fs_q_bread_done";
const Q1_GATE = "sw_fs_q_bread_gate";
const Q1_OSBORN = "sw_fs_q_bread_osborn";
const Q1_RINO = "sw_fs_q_bread_rino";
const Q1_BRAM = "sw_fs_q_bread_bram";
const Q1_COUNT = "var_fs_q_bread_given";
const Q1_HEARD = "sw_fs_q_bread_heard";
// Q2 — 마르타의 은수저
const Q2_ON = "sw_fs_q_spoon_on";
const Q2_DONE = "sw_fs_q_spoon_done";
const Q2_INN = "sw_fs_q_spoon_inn";
const Q2_SACK = "sw_fs_q_spoon_sack";
const Q2_FLOUR = "sw_fs_q_spoon_flour";
const Q2_FOUND = "sw_fs_q_spoon_found";
// Q3 — 로한의 창
const Q3_MET = "sw_fs_q_spear_met";
const Q3_ON = "sw_fs_q_spear_on";
const Q3_DONE = "sw_fs_q_spear_done";
const Q3_FANGS = "var_fs_q_spear_fangs";
const FANG = "item_fs_wolf_fang";
const EMBER = "item_fs_wisp_ember";
const STARIRON = "item_fs_stariron_shard";
const SPEAR_REWARD = "equip_fs_spear_pike";
const SWORD_REWARD = "equip_fs_sword_star";

type Cell = { x: number; y: number };

// ── 명령 도우미 ────────────────────────────────────────────────────────────
const say = (speaker: string, body: string): Command => ({ kind: "text", speaker, body } as Command);
const narrate = (body: string): Command => ({ kind: "text", body, context: "narration", position: "bottom" } as Command);
const sw = (switchId: string, value = true): Condition => ({ kind: "switch", switchId, value });
const varCond = (variableId: string, op: "==" | ">=" | "<=" | ">" | "<" | "!=", value: number): Condition => ({ kind: "variable", variableId, op, value });
const has = (itemId: string): Condition => ({ kind: "item", itemId, present: true });
const all = (...conditions: Condition[]): Condition => ({ kind: "all", conditions });
const fork = (condition: Condition, then: Command[], otherwise: Command[] = []): Command => ({ kind: "fork", condition, then, else: otherwise } as unknown as Command);
const setSw = (switchId: string, value = true): Command => ({ kind: "setSwitch", switchId, value } as Command);
const addVar = (variableId: string, value: number): Command => ({ kind: "setVariable", variableId, op: "+=", value } as Command);
const setVar = (variableId: string, value: number): Command => ({ kind: "setVariable", variableId, op: "=", value } as Command);
const item = (itemId: string, amount: number): Command =>
  ({ kind: "changeItem", itemId, op: amount >= 0 ? "+=" : "-=", amount: Math.abs(amount) } as Command);
const itemVar = (itemId: string, op: "+=" | "-=", variableId: string): Command => ({ kind: "changeItem", itemId, op, amount: { kind: "var", id: variableId } } as Command);
const gold = (amount: number): Command => ({ kind: "changeGold", op: "-=", amount } as Command);
const emote = (eventId: string | "player", kind: string, durationMs = 900): Command =>
  ({ kind: "showEmote", target: eventId === "player" ? "player" : { eventId }, emote: kind, durationMs } as unknown as Command);
const choices = (options: [string, Command[]][], cancel = options.length): Command =>
  ({ kind: "choices", options: options.map(([text, branch]) => ({ text, branch })), cancelBehavior: `choice${cancel}` } as unknown as Command);
const shop = (itemIds: string[]): Command => ({ kind: "shop", shopType: "normal", itemIds, allowSell: true } as Command);
const selfOn = (key: "A" | "B" | "C" | "D"): Command => ({ kind: "setSelfSwitch", key, value: true } as Command);
const self = (key: "A" | "B" | "C" | "D", value = true): Condition => ({ kind: "selfSwitch", key, value });

function ensureSwitch(project: Project, id: string, name: string): void {
  if (!project.switches.some((s) => s.id === id)) project.switches.push({ id, name });
}
function ensureVariable(project: Project, id: string, name: string): void {
  if (!project.variables.some((v) => v.id === id)) project.variables.push({ id, name });
}

/** 첫 페이지의 그림·걸음을 그대로 두고 조건·명령만 바꾼 페이지. */
function pageLike(base: EventPage, id: string, name: string, conditions: Condition[], commands: Command[]): EventPage {
  return { ...structuredClone(base), id, name, conditions, commands } as EventPage;
}
/** 보이지 않고 막지 않는 빈 페이지 — 그 조건 동안 사람을 다른 자리로 옮겨 보이게 할 때. */
function hiddenPage(id: string, conditions: Condition[]): EventPage {
  return {
    id, name: "다른 곳에 있음", conditions, graphic: { transparent: true }, trigger: { kind: "action" }, priority: "below",
    overlapForbidden: false, movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [],
  } as unknown as EventPage;
}
function findEvent(map: GameMap | undefined, id: string): GameEvent | undefined {
  return map?.events.find((e) => e.id === id);
}
function mustEvent(project: Project, mapId: string, id: string): GameEvent {
  const event = findEvent(project.maps[mapId], id);
  if (!event?.pages?.[0]) throw new Error(`[fallen-quests] ${mapId}/${id} 이벤트가 없다`);
  return event;
}
/**
 * 계산대 뒤 주인은 계산대 칸의 투명한 대리 이벤트(<id>_counter, fallenTownInteriors.ts)로 말을 받는다 —
 * 주인의 페이지를 바꾼 뒤 대리 이벤트에도 같은 페이지를 다시 입힌다(투명·고정). 셀프 스위치는 둘이 따로라 쓰지 않는다.
 */
function syncCounter(project: Project, mapId: string, id: string): void {
  const map = project.maps[mapId];
  const npc = findEvent(map, id);
  const proxy = findEvent(map, `${id}_counter`);
  if (!npc || !proxy) return;
  proxy.pages = structuredClone(npc.pages ?? []).map((page) => ({
    ...page, id: `${page.id}_counter`, graphic: { transparent: true }, priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
  })) as EventPage[];
}

/** 사람 이벤트의 페이지를 통째로 바꾼다. specs 는 뒤에 올수록 우선(마지막으로 조건이 맞는 페이지가 켜진다). */
function rewritePages(event: GameEvent, specs: { name: string; conditions: Condition[]; commands: Command[] }[]): void {
  const base = event.pages![0]!;
  event.pages = specs.map((s, i) => pageLike(base, `${event.id}_q${i}`, `${event.name} · ${s.name}`, s.conditions, s.commands));
}

// ── Q1 납작빵 건네기(받는 사람 쪽) ──────────────────────────────────────────
function breadHandOff(given: string, lines: Command[]): Command {
  return fork(all(sw(Q1_ON), sw(Q1_DONE, false), sw(given, false), has(FS_BREAD_FLAT)), [
    narrate("납작빵을 하나 건넸다."),
    item(FS_BREAD_FLAT, -1),
    ...lines,
    setSw(given),
    addVar(Q1_COUNT, 1),
    fork(varCond(Q1_COUNT, ">=", 4), [narrate("납작빵을 모두 전했다. 토마에게 돌아가자.")]),
  ]);
}

// ── 광장 사람들 ───────────────────────────────────────────────────────────
function plazaPeople(project: Project, hubId: string): void {
  const hub = project.maps[hubId]!;
  const mire = mustEvent(project, hubId, "ev_fs_baker");
  rewritePages(mire, [
    { name: "기본", conditions: [], commands: [
      say(MIRE, "어젯밤 하늘이 대낮처럼 밝았지 뭐니.\n놀라서 반죽을 다 망쳤어."),
      say(MIRE, "우리 토마도 오늘은 밀가루만 쳐다보고 있어.\n저이가 저러면 안 되는데."),
    ] },
    { name: "이리스 합류 뒤", conditions: [sw(SW_IRIS)], commands: [
      say(MIRE, "그 아가씨, 은빛 머리 맞지?\n…아니, 못 봤다고 해 두자. 나는 못 봤다."),
      say(MIRE, "토마한테 가 보렴.\n오늘 반죽이 부풀었다고 울고 있단다."),
    ] },
  ]);

  const tobi = mustEvent(project, hubId, "ev_fs_kid");
  rewritePages(tobi, [
    { name: "기본", conditions: [], commands: [
      say(TOBI, "형도 별똥별 봤어? 나 소원 빌었다!\n뭘 빌었는지는 비밀이야."),
      say(TOBI, "근데 있잖아, 별똥별이 방향 틀면\n소원이 이뤄진 거래. 누가 그랬는데."),
    ] },
    { name: "이리스 합류 뒤", conditions: [sw(SW_IRIS)], commands: [
      say(TOBI, "기계 누나지? 저기,\n내 소원 들어준 거 맞지!"),
      say(TOBI, "아직 말하면 안 돼.\n말하면 안 이뤄진댔어. 발렌 아저씨가."),
      fork(sw(Q2_DONE), [
        say(IRIS, "저는, 친구 맞아요?"),
        say(TOBI, "그럼! 기계여도 돼.\n기계가 더 튼튼하잖아."),
      ]),
    ] },
  ]);
  // 은수저를 숨긴 동안 토비는 광장 다리 위 상자 곁에 있다(아래 bridgeScene).
  tobi.pages!.push(hiddenPage(`${tobi.id}_q_bridge`, [sw(Q2_FLOUR), sw(Q2_FOUND, false)]));

  const gate = mustEvent(project, hubId, "ev_fs_gate");
  const gateQ1 = breadHandOff(Q1_GATE, [say(GATE, "…딱딱하군. 근데 따뜻하네.\n브람 영감이 이 시간엔 공터 쪽 오두막에 있을 거야.")]);
  rewritePages(gate, [
    { name: "기본", conditions: [], commands: [
      gateQ1,
      say(GATE, "문 밖에서 북쪽으로 돌면 바로 숲이다.\n심문관들은 남쪽 골짜기부터 뒤진다더군."),
      say(GATE, "숲길은 브람 영감이 제일 잘 알아.\n동쪽은 이틀 안에 직접 보신다던데."),
      say(GATE, "별지기가 숲엔 왜? …묻지 않겠다.\n길 벗어나지 마라. 늑대가 사납다."),
    ] },
    { name: "이리스 합류 뒤", conditions: [sw(SW_IRIS)], commands: [
      gateQ1,
      say(GATE, "어제 그 길로 나갔다가 셋이 돌아왔군.\n…난 둘만 센 걸로 하지."),
    ] },
  ]);

  const elder = mustEvent(project, hubId, "ev_fs_elder");
  rewritePages(elder, [
    { name: "기본", conditions: [], commands: [
      say(ELDER, "별이 떨어지면 큰일 난다는 옛말이 있지.\n이번엔 영 마음이 쓰이는구먼."),
      say(ELDER, "하늘에서 온 것을 함부로 부르면\n화를 입는 법이야."),
    ] },
  ]);

  placeRino(project, hub);
}

/**
 * 기사 리노 — 행렬이 동문으로 떠난 뒤(sw_fs_knight_marched) 동문 곁 초소에 홀로 남은 심문회 기사.
 * 행렬 속 「심문회 기사」(ev_fs_knight)는 포고 직후 떠나므로, 납작빵을 받는 쪽은 이 초소의 리노다.
 */
function placeRino(project: Project, hub: GameMap): void {
  const knight = mustEvent(project, hub.id, "ev_fs_knight");
  const guard = mustEvent(project, hub.id, "ev_fs_gate");
  const id = "ev_fs_rino";
  hub.events = hub.events.filter((e) => e.id !== id);
  const gates = hub.events.filter((e) => String(e.id).startsWith("ev_gate_"));
  const near = (c: Cell) => hub.events.some((e) => Math.abs(e.x - c.x) + Math.abs(e.y - c.y) <= 1);
  const onGatePath = (c: Cell) => gates.some((g) => Math.abs(g.x - c.x) <= 1 && c.y >= g.y - 1 && c.y <= g.y + 3);
  const cands: Cell[] = [];
  for (let dy = -3; dy <= 3; dy += 1) for (let dx = -4; dx <= 4; dx += 1) {
    const c = { x: guard.x + dx, y: guard.y + dy };
    if (c.x < 1 || c.y < 1 || c.x >= hub.width - 1 || c.y >= hub.height - 1) continue;
    if (!isPassable(project, hub, c.x, c.y) || near(c) || onGatePath(c)) continue;
    const sides = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([ox, oy]) => isPassable(project, hub, c.x + ox!, c.y + oy!)).length;
    if (sides >= 2) cands.push(c);
  }
  cands.sort((a, b) => (Math.abs(a.x - guard.x) + Math.abs(a.y - guard.y)) - (Math.abs(b.x - guard.x) + Math.abs(b.y - guard.y)) || a.y - b.y || a.x - b.x);
  const spot = cands[0];
  if (!spot) throw new Error("[fallen-quests] 리노가 설 칸이 없다");
  const base = knight.pages![0]!;
  const named = "sw_fs_rino_named";
  ensureSwitch(project, named, "기사 리노가 이름을 밝혔다");
  const rinoSays = (body: string): Command => fork(sw(named), [say(RINO, body)], [say(KNIGHT, body)]);
  const commands: Command[] = [
    fork(all(sw(Q1_ON), sw(Q1_DONE, false), sw(Q1_RINO, false), has(FS_BREAD_FLAT)), [
      narrate("납작빵을 하나 건넸다."),
      item(FS_BREAD_FLAT, -1),
      say(KNIGHT, "…고맙다. 아침부터 아무것도 못 먹었어."),
      say(KNIGHT, "대장님이 이틀 안에 직접 북쪽 숲을 보신다.\n나는 그전에 지도를 외워 두라는 명이고."),
      say(RINO, "…네가 어디로 갔는지는 못 본 걸로 한다.\n이름은 리노다. 잊어라."),
      setSw(named),
      setSw(Q1_RINO),
      addVar(Q1_COUNT, 1),
      fork(varCond(Q1_COUNT, ">=", 4), [narrate("납작빵을 모두 전했다. 토마에게 돌아가자.")]),
    ], [
      rinoSays("…별지기 꼬마들인가.\n오늘은 소란 피우지 마라. 부탁이다."),
    ]),
  ];
  const page = pageLike(base, `${id}_p0`, "기사 리노 · 동문 초소", [sw(SW_MARCHED)], commands);
  page.movement = { type: "fixed", speed: 3, frequency: 3 } as EventPage["movement"];
  hub.events.push({ id, name: "심문회 기사 리노", x: spot.x, y: spot.y, trigger: { kind: "action" }, commands: [], pages: [page] } as unknown as GameEvent);
}

// ── 숲지기 브람: Q1 납작빵 ─────────────────────────────────────────────────
function bramBread(project: Project, forestId: string): void {
  const bram = findEvent(project.maps[forestId], "ev_fs_bram");
  if (!bram) return;
  const handOff = breadHandOff(Q1_BRAM, [
    say(BRAM, "토마가 보냈나. 그 친구 빵은 평생\n부풀어서 걱정이었는데, 이건 납작하군."),
    say(BRAM, "고맙다고 전해라. 오늘은\n아무 데서도 얻어먹지 못했거든."),
  ]);
  for (const page of bram.pages ?? []) {
    const list = page.commands as Command[];
    // 마주 서기(앞의 fork·moveEvent) 뒤, 첫 대사 앞에 끼운다.
    const at = list.findIndex((c) => c.kind === "text" || c.kind === "changeFace");
    list.splice(at < 0 ? list.length : at, 0, handOff);
  }
}

// ── 빵집 뒤채: 토마 ───────────────────────────────────────────────────────
function toma(project: Project): void {
  const event = mustEvent(project, "fs_bakery_home", "ev_fs_baker_husband");
  const known = new Set(fallenBakeryStock(project));
  const pre = FS_BAKERY_PRE_IRIS.filter((id) => known.has(id));
  const full = fallenBakeryStock(project);
  const preGreeting = say(TOMA, "어서 와요. 오늘은 반죽이 안 부풀어서\n납작빵뿐이에요.");
  const reminder: Command[] = [
    say(TOMA, "동문 문지기, 오스본 어르신,\n심문회 기사님… 숲지기 브람도요."),
    fork(has(FS_BREAD_FLAT), [], [narrate("토마가 납작빵을 하나 더 싸 주었다."), item(FS_BREAD_FLAT, 1)]),
  ];
  const complete: Command[] = [
    say(TOMA, "다 전했어요? 어땠어요, 딱딱하죠?\n…뭐라고들 하던가요."),
    say(KAEL, "따뜻하다고 했어요. 모두요."),
    say(TOMA, "이 모양, 기억나니? 열일곱 해 동안\n천문대 계단에 놓던 별 모양 빵이야."),
    say(TOMA, "바구니 속 아기가 배고플까 봐.\n…이제 와서 말하네."),
    say(KAEL, "…토마 아저씨였어요?\n계단에 있던 빵이."),
    say(TOMA, "열일곱 해 동안 한 번도 안 들켰는데,\n오늘 반죽이 안 부풀어서 들켰네요."),
    narrate("「별빛빵」을 받았다. 토마네 빵 목록이 늘었다."),
    item(FS_BREAD_STARLIGHT, 1),
    setSw(Q1_DONE),
  ];
  rewritePages(event, [
    { name: "기본", conditions: [], commands: [
      say(TOMA, "아내는 광장에 나가 있어요.\n별이 떨어진 밤엔 반죽이 안 부푼다던데…"),
      say(TOMA, "그래도 오늘 새벽 반죽은 정말 안 부풀었어요."),
      setSw(Q1_HEARD),
      preGreeting,
      shop(pre),
    ] },
    { name: "의뢰(Q1)", conditions: [sw(Q1_HEARD)], commands: [
      say(TOMA, "오늘 새벽 반죽이 안 부풀었어요…\n이걸 가져가서 아침을 못 먹은 이들한테 좀 줘요."),
      say(TOMA, "동문 문지기, 오스본 어르신,\n심문회 기사님… 숲지기 브람도요."),
      choices([
        ["맡을게요", [
          say(TOMA, "별빛은 아니지만 따뜻해요.\n따뜻하면 됐죠. 부탁해요."),
          narrate("납작빵 4개를 받았다. 의뢰 「토마의 납작빵」을 맡았다."),
          item(FS_BREAD_FLAT, 4),
          setVar(Q1_COUNT, 0),
          setSw(Q1_ON),
        ]],
        ["다음에요", [say(TOMA, "그래요, 바쁘면 어쩔 수 없죠.\n빵은 식어도 기다려 줄 거예요.")]],
      ]),
      preGreeting,
      shop(pre),
    ] },
    { name: "의뢰를 마침", conditions: [sw(Q1_DONE)], commands: [
      say(TOMA, "어서 와요, 카엘."),
      shop(full),
    ] },
    { name: "이리스 합류 뒤", conditions: [sw(SW_IRIS)], commands: [
      say(TOMA, "…어, 반죽이 부풀었네!\n오늘은 다 있어요, 카엘."),
      say(TOMA, "기계 아가씨가 빵을 먹나요?\n…먹는 흉내라도 낸다면 하나 싸 줄게요."),
      shop(full),
    ] },
    { name: "의뢰 중(Q1)", conditions: [sw(Q1_ON), sw(Q1_DONE, false)], commands: [
      fork(varCond(Q1_COUNT, ">=", 4), complete, reminder),
      fork(sw(SW_IRIS), [shop(full)], [fork(sw(Q1_DONE), [shop(full)], [shop(pre)])]),
    ] },
  ]);
}

// ── 늙은 별지기 오스본: F4 + Q1 ────────────────────────────────────────────
function osborn(project: Project): void {
  const event = mustEvent(project, "fs_stargazer_home", "ev_fs_old_stargazer");
  const handOff = breadHandOff(Q1_OSBORN, [
    say(OSBORN, "반죽이 안 부풀었다고?\n별이 떨어진 밤엔 그랬지. 삼십 년 전에도."),
    say(OSBORN, "…아니, 늙은 별지기의 헛소리야.\n빵은 고맙네. 딱딱해서 이가 시리구먼."),
  ]);
  const base = [
    say(OSBORN, "나도 젊을 땐 저 천문대에서 별을 셌지.\n하넬 녀석이 내 자리를 물려받았고."),
    say(OSBORN, "어젯밤 그 별은 궤도가 이상했어.\n떨어진 게 아니라… 내려앉은 것처럼 보였지."),
  ];
  rewritePages(event, [
    { name: "기본", conditions: [], commands: [handOff, ...base, selfOn("B")] },
    { name: "두 번째부터(F4)", conditions: [self("B")], commands: [
      handOff, ...base,
      say(OSBORN, "…별을 가르친 건 나인데\n별을 두려워하는 법을 가르친 건 누구일꼬."),
    ] },
    { name: "이리스 합류 뒤", conditions: [sw(SW_IRIS)], commands: [
      handOff,
      say(OSBORN, "하늘을 건너는 배라…\n하넬이 평생 찾던 답이 그 아이 안에 있겠구먼."),
      say(OSBORN, "교단은 하늘을 두려워해. 두려운 건 덮으려 들지.\n조심하게, 카엘."),
    ] },
  ]);
}

// ── 여관: 마르타 + Q2 ──────────────────────────────────────────────────────
function innStay(price: number): Command[] {
  return [fork(has(FS_FREE_NIGHT), [
    choices([
      ["숙박권으로 묵는다", [narrate("무료 숙박권을 건넸다."), item(FS_FREE_NIGHT, -1), { kind: "inn", price: 0 } as Command]],
      ["그냥 둔다", [{ kind: "inn", price } as Command]],
    ], 2),
  ], [{ kind: "inn", price } as Command])];
}
function marta(project: Project): void {
  const event = mustEvent(project, "fs_inn", "ev_fs_inn_keeper");
  const greet = say(MARTA, "어서 와요, 카엘. 어젯밤 별똥별 봤어요?\n손님들이 밤새 창가에 붙어 있었다니까.");
  const price = say(MARTA, "하룻밤 30골드. 푹 쉬고 가요.");
  const offer: Command[] = [
    say(MARTA, "카엘, 잠깐만. 은수저가 여섯 벌 없어졌어.\n어젯밤엔 분명 있었는데."),
    say(MARTA, "손님 중에 훔칠 사람은 없어.\n의심 가는 건… 아니, 말 못 하겠다."),
    say(MARTA, "찾아 주면 하룻밤 공짜야.\n부탁해도 될까?"),
    choices([
      ["찾아 볼게요", [narrate("의뢰 「마르타의 은수저」를 맡았다."), setSw(Q2_ON)]],
      ["지금은 어려워요", [say(MARTA, "그래요, 바쁘면 어쩔 수 없죠.\n생각나면 다시 말해 줘요.")]],
    ]),
  ];
  const complete: Command[] = [
    say(MARTA, "은수저 여섯 벌, 맞아요. 누가 가져갔어요?\n…토비구나. 알겠어요. 화 안 낼게요."),
    say(MARTA, "하룻밤 공짜 쿠폰이에요.\n토비한테는 제가 따로 말할게요."),
    item(FS_SILVER_SPOON, -6),
    narrate("「무료 숙박권」을 받았다."),
    item(FS_FREE_NIGHT, 1),
    setSw(Q2_DONE),
  ];
  const irisLines: Command[] = [
    say(MARTA, "그 아이… 이리스라고 했죠? 방은 넉넉해요.\n교단 사람들 눈에 안 띄게 안쪽 방을 써요."),
    fork(sw(Q2_DONE), [], [say(MARTA, "값은 안 받아요. 대신 은수저 얘기는\n나중에 해요. 지금은 쉬어요.")]),
  ];
  rewritePages(event, [
    { name: "기본", conditions: [], commands: [greet, ...offer, price, ...innStay(30)] },
    { name: "의뢰를 마침", conditions: [sw(Q2_DONE)], commands: [greet, price, ...innStay(30)] },
    { name: "이리스 합류 뒤", conditions: [sw(SW_IRIS)], commands: [...irisLines, { kind: "inn", price: 0 } as Command] },
    { name: "의뢰 중(Q2)", conditions: [sw(Q2_ON), sw(Q2_DONE, false)], commands: [
      fork(sw(Q2_FOUND), complete, [say(MARTA, "손님 중에 훔칠 사람은 없어.\n의심 가는 건… 아니, 말 못 하겠다.")]),
      fork(sw(SW_IRIS), [{ kind: "inn", price: 0 } as Command], [price, ...innStay(30)]),
    ] },
  ]);
}

function oden(project: Project): void {
  const event = mustEvent(project, "fs_apothecary", "ev_fs_apothecary");
  const after = event.pages?.[1];
  const cmd = (after?.commands as Command[] | undefined)?.find((c) => c.kind === "text") as { body?: string } | undefined;
  if (cmd) cmd.body = "심문관이 약방까지 와서 「하늘에서 떨어진 것」을\n본 사람 없냐고 묻고 갔어. 난 못 봤다고 했지.";
}

// ── 대장간: 로한 + Q3 ──────────────────────────────────────────────────────
function rohan(project: Project): void {
  const event = mustEvent(project, "fs_smithy", "ev_fs_smith");
  const full = fallenSmithyStock(project);
  const noSpears = full.filter((id) => !/spear|halberd/.test(id));
  const stock = (): Command => fork(sw(Q3_DONE), [shop(full)], [shop(noSpears)]);
  const daily = [
    say(ROHAN, "심문회가 칼을 갈러 왔었지.\n나는 이제 그쪽 일은 안 한다."),
    say(ROHAN, "한때는 교단 병기고에서 열쇠를 쥐었다.\n이젠 쇠를 두드리는 손일 뿐이야."),
  ];
  const ask: Command[] = [
    say(KAEL, "이유요? 늑대가 너무 많아서요. 숲길이 막혀요."),
    say(ROHAN, "…늑대 송곳니 세 개, 푸른 불씨 하나.\n그걸 가져오면 이유는 들어 주마."),
    narrate("의뢰 「로한의 창」을 맡았다."),
    setSw(Q3_ON),
  ];
  // 송곳니를 하나씩 받아 센다(아이템 개수 조건이 없다) — 모자라면 센 만큼 돌려준다.
  const takeFangs: Command[] = [setVar(Q3_FANGS, 0)];
  let nest: Command[] = [];
  for (let i = 0; i < 3; i += 1) {
    const step = fork(has(FANG), [item(FANG, -1), addVar(Q3_FANGS, 1)]);
    if (i === 0) { takeFangs.push(step); nest = (step as unknown as { then: Command[] }).then; } else { nest.push(step); nest = (step as unknown as { then: Command[] }).then; }
  }
  const giveBack = itemVar(FANG, "+=", Q3_FANGS);
  const forged = (rewardId: string, rewardName: string, extra: Command[]): Command[] => [
    ...extra,
    item(EMBER, -1),
    say(ROHAN, "서른 해 전 새벽샘에서\n나는 창을 들고 서 있었다."),
    say(ROHAN, "재를 헤치고 나온 아이가 있었어.\n…발렌이란 이름이 맞지?"),
    say(ROHAN, "그 아이한테 내가 한 말은\n「살아서 미안하다」가 아니라 「고개 들어라」였다."),
    say(ROHAN, "좀 더 다정하게 말해 줄 걸 그랬어."),
    say(KAEL, "…아저씨."),
    say(ROHAN, "이 창은 내 딸이 쓸 거다.\n네가 쓸 몫은 따로 만들어 둔다. 가져가라."),
    narrate(`「${rewardName}」을 받았다.`),
    item(rewardId, 1),
    setSw(Q3_DONE),
  ];
  const craft: Command[] = [
    say(ROHAN, "…가져왔나. 그래, 제대로 된 송곳니다.\n창을 만들어 주마. 어떤 걸 원하나."),
    say(ROHAN, "하나는 「푸른 불꽃 창」. 불이 붙고\n한 줄에 둘을 꿴다."),
    say(ROHAN, "하나는 「별쇠 장검」. 속성은 없지만\n한 번에 가장 세게 친다. 별쇠 조각이 필요하다."),
    choices([
      ["푸른 불꽃 창", forged(SPEAR_REWARD, "푸른 불꽃 창", [])],
      ["별쇠 장검", [fork(has(STARIRON), forged(SWORD_REWARD, "별쇠 장검", [item(STARIRON, -1)]), [
        say(ROHAN, "별쇠 조각이 없잖나. 공터 쪽 파편 더미를 뒤져 봐라.\n재료는 그때까지 맡아 두지 않는다."),
        giveBack,
      ])]],
      ["나중에", [giveBack]],
    ]),
  ];
  const progress: Command[] = [
    ...takeFangs,
    fork(all(varCond(Q3_FANGS, ">=", 3), has(EMBER)), craft, [
      giveBack,
      say(ROHAN, "송곳니는 늑대에서, 푸른 불씨는 도깨비불에서.\n숲에 있다. 먼저 해결부터 해라."),
    ]),
  ];
  rewritePages(event, [
    { name: "첫 방문", conditions: [], commands: [
      say(ROHAN, "…뭘 보나."),
      say(ROHAN, "별지기 꼬마가 대장간엔 웬일이냐.\n쇠 살 돈은 있고?"),
      say(KAEL, "창이 필요해요. 숲에 늑대가 많아서요."),
      say(ROHAN, "창은 안 판다.\n값이 아니라 이유를 가져와라."),
      setSw(Q3_MET),
      choices([["이유를 가져올게요", ask], ["가게만 볼게요", []]]),
      stock(),
    ] },
    { name: "평상시", conditions: [sw(Q3_MET)], commands: [
      ...daily,
      fork(sw(Q3_ON), [], [choices([["창 얘기를 다시 꺼낸다", [say(ROHAN, "창은 안 판다.\n값이 아니라 이유를 가져와라."), ...ask]], ["가게만 볼게요", []]])]),
      stock(),
    ] },
    { name: "이리스 합류 뒤", conditions: [sw(SW_IRIS)], commands: [
      say(ROHAN, "…그 아이, 사람이 아니라지.\n쇳소리가 난다. 고장난 쇳소리는 아니구나."),
      say(ROHAN, "내가 창을 들던 시절이면\n저 아이를 겨눴겠지. 지금은 안 겨눈다."),
      fork(all(sw(Q3_MET), sw(Q3_ON, false)), [choices([["창 얘기를 꺼낸다", ask], ["가게만 볼게요", []]])]),
      stock(),
    ] },
    { name: "의뢰 중(Q3)", conditions: [sw(Q3_ON), sw(Q3_DONE, false)], commands: [...progress, stock()] },
  ]);
}

// ── Q2 흔적: 수납 이벤트 위에 덧붙이는 페이지 ───────────────────────────────
function boxesOf(map: GameMap | undefined): GameEvent[] {
  return (map?.events ?? []).filter((e) => String(e.id).startsWith("ev_fs_box_"));
}
function pickBox(map: GameMap | undefined, labels: RegExp[]): GameEvent | undefined {
  const boxes = boxesOf(map);
  for (const re of labels) {
    const hit = boxes.filter((e) => re.test(String(e.name).replace("수납 · ", ""))).sort((a, b) => a.y - b.y || a.x - b.x)[0];
    if (hit) return hit;
  }
  return undefined;
}
function cluePage(box: GameEvent, key: string, conditions: Condition[], commands: Command[]): void {
  const base = box.pages![0]!;
  box.pages!.push(pageLike(base, `${box.id}_${key}`, `${box.name} · ${key}`, conditions, commands));
}

function spoonClues(project: Project, hubId: string): Record<string, string> {
  const found: Record<string, string> = {};
  const inn = pickBox(project.maps.fs_inn, [/^상자$/, /궤짝/, /통/]);
  if (inn) {
    cluePage(inn, "q2_inn", [sw(Q2_ON), sw(Q2_INN, false), sw(Q2_DONE, false)], [
      narrate("저장고에는 은수저의 흔적이 없다.\n빈 상자 모서리에 작은 손자국이 있다."),
      setSw(Q2_INN),
    ]);
    found.inn = inn.id;
  }
  const sack = pickBox(project.maps.fs_apothecary, [/^자루$/, /자루/]);
  if (sack) {
    cluePage(sack, "q2_sack", [sw(Q2_ON), sw(Q2_SACK, false), sw(Q2_DONE, false)], [
      say(ODEN, "아까 꼬마가 맴돌더니…\n내 약초 자루가 가벼워졌구나."),
      setSw(Q2_SACK),
    ]);
    found.sack = sack.id;
  }
  const flour = pickBox(project.maps.fs_bakery_home, [/밀가루/, /^통$/]);
  if (flour) {
    cluePage(flour, "q2_flour", [sw(Q2_ON), sw(Q2_FLOUR, false), sw(Q2_DONE, false)], [
      narrate("밀가루 통 속에 은수저 두 벌이 숨겨져 있다.\n하얀 가루가 수저마다 묻어 있다."),
      narrate("「은수저」 2벌을 찾았다. 하얀 발자국이 광장 다리 쪽으로 이어진다."),
      item(FS_SILVER_SPOON, 2),
      setSw(Q2_FLOUR),
    ]);
    found.flour = flour.id;
  }
  const bridge = bridgeScene(project, hubId);
  if (bridge) found.bridge = bridge;
  return found;
}

/** 광장 다리 위 상자 — 거리 수납 중 다리 상판 위의 것을 쓰고, 없으면 다리 서쪽 끝에 하나 둔다. 그 곁에 토비가 쭈그려 앉아 있다. */
function bridgeScene(project: Project, hubId: string): string | null {
  const hub = project.maps[hubId];
  const tileset = hub ? project.tilesets[hub.tilesetId] : undefined;
  if (!hub || !tileset) return null;
  const isDeck = (x: number, y: number) => {
    const t = hub.lowerTiles[y * hub.width + x];
    return t !== undefined && t >= 0 && /다리 상판/.test(tileset.tileMeta?.[t]?.label ?? "");
  };
  const deck: Cell[] = [];
  for (let y = 0; y < hub.height; y += 1) for (let x = 0; x < hub.width; x += 1) if (isDeck(x, y)) deck.push({ x, y });
  if (!deck.length) return null;
  // 광장(포고 자리)에 가장 가까운 다리.
  const plaza = findEvent(hub, "ev_fs_event") ?? findEvent(hub, "ev_fs_elder");
  const dist = (c: Cell) => (plaza ? Math.abs(c.x - plaza.x) + Math.abs(c.y - plaza.y) : c.y);
  const nearest = [...deck].sort((a, b) => dist(a) - dist(b))[0]!;
  const span = deck.filter((c) => Math.abs(c.y - nearest.y) <= 2 && Math.abs(c.x - nearest.x) <= 4);
  let box = boxesOf(hub).find((e) => span.some((c) => c.x === e.x && c.y === e.y));
  if (!box) {
    const cell = [...span].sort((a, b) => a.x - b.x || a.y - b.y).find((c) => !hub.events.some((e) => e.x === c.x && e.y === c.y));
    if (!cell) return null;
    hub.upperTiles[cell.y * hub.width + cell.x] = 24168; // 버들항 통
    box = {
      id: `ev_fs_box_${hubId}_${cell.x}_${cell.y}`, name: "수납 · 통", x: cell.x, y: cell.y, trigger: { kind: "action" }, commands: [],
      pages: [{
        id: `ev_fs_box_${hubId}_${cell.x}_${cell.y}_p0`, name: "뒤지기", conditions: [], graphic: { transparent: true },
        movement: { type: "fixed", speed: 3, frequency: 3 }, priority: "same", trigger: { kind: "action" },
        commands: [narrate("통을 뒤져 봤지만 먼지뿐이다. 비어 있다.")],
      }],
    } as unknown as GameEvent;
    hub.events.push(box);
  }
  // 18절: 다리 상자는 공용 — 문지기가 멀리서 한 번 소리친다(벌금 없음).
  const warned = "var_fs_scold_bridge";
  ensureVariable(project, warned, "다리 상자 경고(문지기)");
  const p0 = box.pages![0]!;
  p0.commands = [fork(varCond(warned, "<", 2), [say(GATE, "거기서 뭘 하는 거냐!"), addVar(warned, 1)]), ...(p0.commands as Command[])];

  const tobiStill = mustEvent(project, hubId, "ev_fs_kid");
  const spot = [...span].filter((c) => !hub.events.some((e) => e.x === c.x && e.y === c.y) && isPassable(project, hub, c.x, c.y))
    .sort((a, b) => (Math.abs(a.x - box!.x) + Math.abs(a.y - box!.y)) - (Math.abs(b.x - box!.x) + Math.abs(b.y - box!.y)))[0];
  const scene: Command[] = [
    emote("ev_fs_kid_bridge", "exclamation"),
    say(TOBI, "…형, 왔어?\n화내지 마. 나쁜 짓 한 거 아니야."),
    say(TOBI, "…별한테 줄 선물이야.\n별에서 아이가 온댔어."),
    say(TOBI, "친구 없이 오면 심심하잖아.\n그래서 가장 반짝이는 걸 골랐어."),
    say(KAEL, "…다음엔 말하고 가져가.\n같이 갖다 주러 가자."),
    say(KAEL, "대신 은수저는 마르타 누나한테 먼저."),
    narrate("토비가 상자 속 은수저를 내밀었다. 은수저 여섯 벌을 모두 찾았다."),
    item(FS_SILVER_SPOON, 4),
    setSw(Q2_FOUND),
  ];
  cluePage(box, "q2_bridge", [sw(Q2_FLOUR), sw(Q2_FOUND, false)], scene);
  if (spot) {
    const id = "ev_fs_kid_bridge";
    hub.events = hub.events.filter((e) => e.id !== id);
    const page = pageLike(tobiStill.pages![0]!, `${id}_p0`, "꼬마 토비 · 다리 위", [sw(Q2_FLOUR), sw(Q2_FOUND, false)], scene);
    page.movement = { type: "fixed", speed: 3, frequency: 3 } as EventPage["movement"];
    hub.events.push({ id, name: "꼬마 토비", x: spot.x, y: spot.y, trigger: { kind: "action" }, commands: [], pages: [page] } as unknown as GameEvent);
  }
  return box.id;
}

// ── 18절: 뒤지다 걸린 꾸지람 ───────────────────────────────────────────────
type Scold = { mapId: string; owner: string; key: string; line: [string, string]; fine: number; only?: RegExp };
const SCOLDS: readonly Scold[] = [
  { mapId: "fs_inn", owner: "ev_fs_inn_keeper", key: "marta", line: [MARTA, "손님? 거긴 제 창고예요!"], fine: 5 },
  { mapId: "fs_apothecary", owner: "ev_fs_apothecary", key: "oden", line: [ODEN, "허허, 약초 훔치면 병이 옮는다."], fine: 5 },
  { mapId: "fs_bakery_home", owner: "ev_fs_baker_husband", key: "toma", line: [TOMA, "밀가루는 팔 거예요, 그냥 못 줘요."], fine: 3, only: /밀가루/ },
  { mapId: "fs_smithy", owner: "ev_fs_smith", key: "rohan", line: [ROHAN, "도둑 잡는 척하며 도둑질이냐."], fine: 10 },
];

/** townLife 가 단 뒤지기 명령에서 「챙기기」 부분만 꺼낸다(토마네는 주인 시야 분기의 맨 안쪽 else). */
function takePart(commands: Command[]): Command[] {
  const first = commands[0] as unknown as { kind: string; condition?: { kind: string }; else?: Command[] } | undefined;
  if (first?.kind === "fork" && first.condition?.kind === "eventSeesPlayer") {
    const near = first.else?.[0] as unknown as { kind: string; else?: Command[] } | undefined;
    if (near?.kind === "fork" && near.else) return near.else;
  }
  return commands;
}

function scolds(project: Project): number {
  let n = 0;
  for (const s of SCOLDS) {
    const map = project.maps[s.mapId];
    if (!map || !findEvent(map, s.owner)) continue;
    const counter = `var_fs_scold_${s.key}`;
    ensureVariable(project, counter, `${s.line[0]}에게 들킨 횟수`);
    for (const box of boxesOf(map)) {
      if (s.only && !s.only.test(String(box.name))) continue;
      const p0 = box.pages![0]!;
      // 챙길 것 없는 살림 한 줄(townLife 의 flavor)은 들여다보기일 뿐 — 꾸짖지 않는다. 토마의 밀가루처럼 이름으로 정한 수납은 예외.
      if (!s.only && !/"kind":"change(Gold|Item)"/.test(JSON.stringify(p0.commands))) continue;
      const take = takePart(p0.commands as Command[]);
      p0.commands = [fork({ kind: "eventSeesPlayer", eventId: s.owner, range: 5 } as unknown as Condition, [
        emote(s.owner, "exclamation"),
        ...take,
        // 의뢰를 막지 않는다 — 두 번까지 같은 줄과 작은 벌금, 그 뒤로는 조용히 넘어간다.
        fork(varCond(counter, "<", 2), [say(s.line[0], s.line[1]), ...(s.fine > 0 ? [gold(s.fine), narrate(`벌금 ${s.fine}G 를 냈다.`)] : []), addVar(counter, 1)]),
      ], take)];
      n += 1;
    }
  }
  return n;
}

// ── 의뢰 일지 ─────────────────────────────────────────────────────────────
function journal(project: Project): void {
  const q = (id: string, title: string, summary: string, nodes: [string, string, Condition[]][]): QuestGraphDef => ({
    kind: "graph", id, title, summary,
    nodes: nodes.map(([nid, description, conds]) => ({
      id: nid, description,
      completesWhen: conds.length === 1 ? conds[0] as never : { all: conds as never },
    })),
    edges: nodes.slice(1).map(([nid], i) => ({ from: nodes[i]![0], to: nid })),
  });
  const defs: QuestGraphDef[] = [
    q("fs_q_bread", "토마의 납작빵", "빵집 뒤채의 토마가 부풀지 않은 납작빵을 아침을 못 먹은 이들에게 나눠 달라고 했다.", [
      ["accept", "토마에게 납작빵 넷을 받는다", [sw(Q1_ON)]],
      ["gate", "동문 문지기에게 건넨다", [sw(Q1_GATE)]],
      ["osborn", "늙은 별지기 오스본에게 건넨다", [sw(Q1_OSBORN)]],
      ["rino", "동문 초소의 심문회 기사에게 건넨다", [sw(Q1_RINO)]],
      ["bram", "숲지기 브람에게 건넨다", [sw(Q1_BRAM)]],
      ["report", "빵집 뒤채의 토마에게 돌아간다", [sw(Q1_DONE)]],
    ]),
    q("fs_q_spoon", "마르타의 은수저", "별빛 여관의 은수저 여섯 벌이 없어졌다. 마르타는 의심 가는 사람을 말하지 못했다.", [
      ["accept", "마르타의 부탁을 듣는다", [sw(Q2_ON)]],
      ["trail", "여관 저장고·약방 자루·토마네 밀가루 통을 뒤져 흔적을 찾는다", [sw(Q2_FLOUR)]],
      ["bridge", "광장 다리 위 상자에서 은수저를 되찾는다", [sw(Q2_FOUND)]],
      ["report", "마르타에게 은수저를 돌려준다", [sw(Q2_DONE)]],
    ]),
    q("fs_q_spear", "로한의 창", "대장장이 로한은 창을 팔지 않는다. 값이 아니라 이유를 가져오라고 했다.", [
      ["accept", "로한에게 창 얘기를 꺼낸다", [sw(Q3_ON)]],
      ["forge", "늑대 송곳니 셋과 푸른 불씨 하나를 로한에게 가져간다", [sw(Q3_DONE)]],
    ]),
  ];
  const ids = new Set(defs.map((d) => d.id));
  project.quests = [...(project.quests ?? []).filter((d) => !ids.has((d as { id?: string; key?: string }).id ?? (d as { key?: string }).key ?? "")), ...defs];
}

export type TownQuestResult = { clues: Record<string, string>; scoldedBoxes: number; rino: Cell | null; tobiBridge: Cell | null };

/** 마을 대사·잔 일 셋·꾸지람·일지. buildFallenTownLife(수납) 뒤, 행렬 길을 잰 뒤에 부른다. */
export function applyFallenTownQuests(project: Project, ids: { hub: string; forest: string }): TownQuestResult {
  for (const [id, name] of [
    [Q1_HEARD, "Q1 토마의 사정을 들었다"], [Q1_ON, "Q1 토마의 납작빵 수락"], [Q1_DONE, "Q1 토마의 납작빵 완료"], [Q1_GATE, "Q1 문지기에게 건넴"], [Q1_OSBORN, "Q1 오스본에게 건넴"],
    [Q1_RINO, "Q1 리노에게 건넴"], [Q1_BRAM, "Q1 브람에게 건넴"],
    [Q2_ON, "Q2 마르타의 은수저 수락"], [Q2_DONE, "Q2 마르타의 은수저 완료"], [Q2_INN, "Q2 여관 저장고 흔적"], [Q2_SACK, "Q2 약방 자루 흔적"],
    [Q2_FLOUR, "Q2 밀가루 통 은수저"], [Q2_FOUND, "Q2 토비에게서 은수저"],
    [Q3_MET, "Q3 로한 첫 만남"], [Q3_ON, "Q3 로한의 창 수락"], [Q3_DONE, "Q3 로한의 창 완료"],
  ] as const) ensureSwitch(project, id, name);
  ensureVariable(project, Q1_COUNT, "Q1 건넨 납작빵 수");
  ensureVariable(project, Q3_FANGS, "Q3 받은 송곳니 수(임시)");

  // 수납 페이지(흔적·꾸지람)는 사람 대사보다 먼저 — 꾸지람은 수납의 첫 페이지를 감싼다.
  const scoldedBoxes = scolds(project);
  const clues = spoonClues(project, ids.hub);
  plazaPeople(project, ids.hub);
  bramBread(project, ids.forest);
  toma(project);
  osborn(project);
  marta(project);
  oden(project);
  rohan(project);
  for (const [mapId, id] of [["fs_bakery_home", "ev_fs_baker_husband"], ["fs_inn", "ev_fs_inn_keeper"], ["fs_apothecary", "ev_fs_apothecary"], ["fs_smithy", "ev_fs_smith"]] as const) {
    syncCounter(project, mapId, id);
  }
  journal(project);
  const hub = project.maps[ids.hub]!;
  const at = (id: string) => { const e = findEvent(hub, id); return e ? { x: e.x, y: e.y } : null; };
  return { clues, scoldedBoxes, rino: at("ev_fs_rino"), tobiBridge: at("ev_fs_kid_bridge") };
}
