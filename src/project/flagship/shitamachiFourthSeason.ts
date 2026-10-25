/**
 * 『시타마치의 네 번째 계절』 — 일본 시타마치(下町) 상점가 연애 데모(약 10~15분, 엔딩 넷).
 *
 * 하진은 여덟 살까지 살던 시타마치로 올봄 돌아왔다. 돌아온 지 세 계절, 가을의 끝. 내일 밤은 아케이드 등롱 축제다.
 * 학생회장 서연이 진흥회 일을 떠맡았고, 정문 큰 등롱에 넣을 「소원 등롱」 세 개가 아직 모이지 않았다 —
 * 하나는 소꿉친구 지호네 코하루 베이커리, 하나는 전철에서 늘 마주치는 유나네 센토 「마츠노유」, 하나는 진흥회 사무소의 서연.
 * 셋을 모아 등롱지기 할아버지에게 가져가면 아케이드에 불이 켜지고, 누구와 등롱 길을 걸을지 고른다.
 * 그 사람에게 마음을 전하면, 그동안 쌓인 마음(장면 선택)이 결말을 가른다.
 *
 * 흐름은 변수 하나(var_sm_stage)가 쥔다: 0 전철 → 1 상점가 도착 → 2 등롱 모으기 → 3 점등 뒤 옥상.
 * 2026-10-25 개편 전의 판은 1분 만에 엔딩 넷 중 아무거나 고를 수 있었고, 실내 넷은 순간이동 메뉴로만 가는 빈 방,
 * 넷은 갈 길이 없는 맵이었다(VQA before: tmp/vqa raw-argon-before / raw-sonnet-before). 지금은 거리 문(link_jp_city_interior)
 * 으로 걸어 들어가고, 쓰지 않는 맵은 두지 않는다.
 */
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { reviewedFaceIdForCharset } from "@/assets/reviewedCharsetFaces";
import { runTool } from "@/editor/tools/toolRunner";
import "@/editor/tools/toolRegistry";
import { isPassable } from "@/project/collision";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_ACTOR_ID } from "@/project/defaults/constants";
import { blankFillTileFor, createStarterMap } from "@/project/defaults/defaultMaps";
import { createJpCityTileset, JP_CITY_ID } from "@/project/defaults/jpCity";
import { M2_COMMAND_CATALOG } from "@/project/eventCommands/m2Catalog";
import { deserialize, serialize } from "@/project/io";
import { applyRomanceDefaults } from "@/project/romancePreset";
import type { Command, Dir, EventPage, EventPageCondition, GameEvent, GameMap, LightSource, Project } from "@/project/types";
import { FLAGSHIP_BEAT_MANIFESTS } from "./beats";
import type { FlagshipDemoBuildResult } from "./types";

// ── 상태 ──
const V_STAGE = "var_sm_stage";
const V_DATE = "var_sm_date";
const V_LANTERNS = "var_sm_lanterns";
const V_SEOYEON = "var_sm_seoyeon";
const V_JIHO = "var_sm_jiho";
const V_YUNA = "var_sm_yuna";
const SW_L_SEOYEON = "sw_sm_lantern_seoyeon";
const SW_L_JIHO = "sw_sm_lantern_jiho";
const SW_L_YUNA = "sw_sm_lantern_yuna";
const SW_LIT = "sw_shitamachi_lantern_lit";
const SW_PHOTO = "sw_sm_photo_seen";
const SW_NOTE = "sw_sm_note_read";

/** 진심 결말 문턱 — 그 사람의 장면 둘에서 마음이 닿는 선택을 하면 4~5, 하나만 맞으면 2~3. */
const TRUE_AT = 4;

const END_SEOYEON = "end_shitamachi_seoyeon";
const END_JIHO = "end_shitamachi_jiho";
const END_YUNA = "end_shitamachi_yuna";
const END_FRIENDS = "end_shitamachi_friends";

// ── 맵 ──
const M = {
  hub: "map_shitamachi_arcade",
  train: "map_venue_train",
  house: "map_venue_house",
  bakery: "map_venue_bakery",
  sento: "map_venue_sento",
  office: "map_venue_council",
  rooftop: "map_venue_rooftop",
} as const;

// ── 소리 (CC0 카탈로그 — 첫사랑에서 귀 판정·VQA 를 거친 현대 일상 곡만) ──
const BGM_DAY = "cc0-bgm-rtp-qui-001"; // 휘파람·어쿠스틱 셔플 — 낮의 상점가·빵집
const BGM_CALM = "cc0-bgm-rtp-pon-001"; // 라운지 피아노·브러시 — 저녁 전철·센토·사무소
const BGM_ROOF = "cc0-bgm-rtp-rad-002"; // 로파이 재즈합 — 옥상·밤 등롱 길
const BGM_MEMORY = "cc0-bgm-rtp-rst-001"; // 피아노·어쿠스틱 기타 발라드 — 타이틀·오프닝
const BGM_CONFESS = "cc0-bgm-rtp-mys-002"; // 잔향 깊은 피아노 독주 — 고백
const BGM_HAPPY = "cc0-bgm-rtp-res-002"; // 차오르는 귀환곡 — 진심 결말
const BGM_FRIENDS = "cc0-bgm-rtp-flt-022"; // 하프·현 — 청춘 결말
const SE_HEART = "cc0-se-orp-interface-interface3";
const SE_CHIME = "cc0-se-osx-dishes-02"; // 두 음 «딩동» — 전철 안내음
const SE_LANTERN = "cc0-se-osx-bell-01"; // 등롱 하나가 켜질 때

// ── 인물 (공용 걷기 칩 ↔ 공용 흉상은 sharedCharacterGraphics.json 의 짝) ──
type Who = "hajin" | "seoyeon" | "jiho" | "yuna" | "keeper";
type Expr = "base" | "happy" | "surprised" | "sad" | "embarrassed";
interface CastMember { readonly name: string; readonly stem: string; readonly tex: string; readonly resource: string; readonly index: number; readonly side: "left" | "right" }
const CAST: Readonly<Record<Who, CastMember>> = {
  hajin: { name: "하진", stem: "uni-boy-navy", tex: "tex_oprn_charset_modern1", resource: "oprn-charset-modern1", index: 0, side: "left" },
  seoyeon: { name: "서연", stem: "uni-girl-navy", tex: "tex_oprn_charset_modern1", resource: "oprn-charset-modern1", index: 4, side: "right" },
  jiho: { name: "지호", stem: "apron-olive", tex: "tex_oprn_charset_modern3", resource: "oprn-charset-modern3", index: 5, side: "right" },
  yuna: { name: "유나", stem: "uni-girl-sailor", tex: "tex_oprn_charset_modern1", resource: "oprn-charset-modern1", index: 5, side: "right" },
  keeper: { name: "등롱지기 할아버지", stem: "teacher-tweed", tex: "tex_oprn_charset_modern3", resource: "oprn-charset-modern3", index: 6, side: "right" },
};
const bustId = (who: Who, expr: Expr): string => `shared-modern-${CAST[who].stem}-expressions-bust-${expr}`;
const CLEAR_FACE: Command = { kind: "changeFace", resourceId: "", position: "left", flipHorizontally: false } as Command;

/** 인물 대사 — 흉상(표정)을 바꾸고 이름과 함께 말한다. */
function say(who: Who, expr: Expr, ...lines: string[]): Command[] {
  const c = CAST[who];
  return [
    { kind: "changeFace", resourceId: bustId(who, expr), presentation: "bust", position: c.side, flipHorizontally: false } as Command,
    ...lines.map((body): Command => ({ kind: "text", speaker: c.name, body, position: "bottom" } as Command)),
  ];
}
/** 하진의 속마음 — 얼굴 없이. */
function think(...lines: string[]): Command[] {
  return [CLEAR_FACE, ...lines.map((body): Command => ({ kind: "text", body, position: "bottom", context: "thought" } as Command))];
}
/** 장면 자막(시간·장소). */
function caption(...lines: string[]): Command[] {
  return [CLEAR_FACE, ...lines.map((body): Command => ({ kind: "text", body, position: "bottom", context: "narration" } as Command))];
}
function voice(speaker: string, ...lines: string[]): Command[] {
  return [CLEAR_FACE, ...lines.map((body): Command => ({ kind: "text", speaker, body, position: "bottom" } as Command))];
}
function m2(title: string, fields: Record<string, unknown> = {}): Command {
  const entry = M2_COMMAND_CATALOG.find((c) => c.title === title);
  if (!entry) throw new Error(`[shitamachi-fourth-season] m2 명령 없음: ${title}`);
  return { kind: "m2Command", commandId: entry.id, fields } as Command;
}
const wait = (ms: number): Command => ({ kind: "wait", ms } as Command);
const fadeOut = (ms = 600): Command[] => [m2("Screen Effect", { effect: "fadeOut", value: "", durationMs: ms }), wait(ms)];
const fadeIn = (ms = 600): Command[] => [m2("Screen Effect", { effect: "fadeIn", value: "", durationMs: ms }), wait(ms)];
const playSe = (resourceId: string): Command => ({ kind: "playAudio", resourceId, loop: false, channel: "se" } as Command);
const bgm = (resourceId: string, fadeInMs = 800): Command => ({ kind: "playAudio", resourceId, loop: true, channel: "bgm", fadeInMs } as Command);
const setVar = (variableId: string, op: "=" | "+=" | "-=", value: number): Command => ({ kind: "setVariable", variableId, op, value } as Command);
const setSw = (switchId: string, value: boolean): Command => ({ kind: "setSwitch", switchId, value } as Command);
const transfer = (mapId: string, at: { x: number; y: number }, direction: Dir = "down"): Command =>
  ({ kind: "transfer", mapId, x: at.x, y: at.y, direction, fade: "black" } as Command);
const ifCond = (condition: EventPageCondition, then: Command[], otherwise: Command[] = []): Command =>
  ({ kind: "fork", condition, then, ...(otherwise.length ? { else: otherwise } : {}) } as Command);
const choices = (options: { text: string; then: Command[] }[]): Command =>
  ({ kind: "choices", options: options.map((o) => ({ text: o.text, branch: o.then })), cancelBehavior: "disallow" } as Command);
const varIs = (v: string, n: number): EventPageCondition => ({ kind: "variable", variableId: v, op: "==", value: n } as EventPageCondition);
const varAtLeast = (v: string, n: number): EventPageCondition => ({ kind: "variable", variableId: v, op: ">=", value: n } as EventPageCondition);
const swOn = (id: string): EventPageCondition => ({ kind: "switch", switchId: id, value: true } as EventPageCondition);
const route = (eventId: string, moves: Record<string, unknown>[], waitDone = true): Command =>
  ({ kind: "moveEvent", eventId, route: { moves, repeat: false, wait: waitDone, skippable: true } } as Command);
const walk = (eventId: string, dirs: readonly Dir[], waitDone = true): Command => route(eventId, dirs.map((dir) => ({ kind: "move", dir })), waitDone);
const approach = (eventId: string, target: string, distance = 1): Command => route(eventId, [{ kind: "approach", target, ...(distance !== 1 ? { distance } : {}) }]);
const faceHero = (eventId: string): Command => route(eventId, [{ kind: "turnTowardPlayer" }]);
const turn = (eventId: string, dir: Dir): Command => route(eventId, [{ kind: "turn", dir }]);

/** 그 사람과의 마음이 n 만큼 닿았다 — 결말 판정은 변수, ESC 「호감도」 하트는 관계 기록(최대 1000, 한 점 = 100). */
function like(who: "seoyeon" | "jiho" | "yuna", n: number): Command[] {
  const variable = who === "seoyeon" ? V_SEOYEON : who === "jiho" ? V_JIHO : V_YUNA;
  return [setVar(variable, "+=", n), { kind: "changeFriendship", npcKey: who, delta: n * 100 } as Command, ...(n > 0 ? [playSe(SE_HEART)] : [])];
}

type PageOpts = { who?: Who; dir?: Dir; trigger?: "action" | "auto" | "playerTouch" | "parallel"; priority?: "below" | "same" | "above" };
function page(id: string, conditions: EventPageCondition[], commands: Command[], opts: PageOpts = {}): EventPage {
  const who = opts.who ? CAST[opts.who] : undefined;
  const dir = opts.dir ?? "down";
  return {
    id, name: id, conditions,
    graphic: who
      ? { sprite: { type: "bundled", id: who.tex }, direction: dir, pattern: charsetFrameIndex({ characterIndex: who.index, direction: dir, pattern: 1 }), transparent: false }
      : { direction: dir, pattern: 0, transparent: true },
    movement: { type: "fixed", speed: 3, frequency: 3 },
    priority: opts.priority ?? (who ? "same" : "below"),
    overlapForbidden: !!who,
    trigger: { kind: opts.trigger ?? "action" },
    commands,
  } as unknown as EventPage;
}
/** 아무 그림도 없는 «없음» 페이지 — 조건이 맞으면 그 인물이 사라진다(마지막 일치 페이지가 이긴다). */
const gone = (id: string, conditions: EventPageCondition[]): EventPage => page(id, conditions, [], { priority: "below" });
function event(id: string, name: string, at: { x: number; y: number }, pages: EventPage[], characterId?: string): GameEvent {
  return { id, name, x: at.x, y: at.y, trigger: pages[0]?.trigger ?? { kind: "action" }, commands: [], pages, ...(characterId ? { characterId } : {}) } as GameEvent;
}

function execTool(project: Project, name: string, args: Record<string, unknown>): { summary?: string; data?: unknown } {
  const ctx = { project, assistantRun: false };
  const res = runTool(ctx, name, args, { dryRun: false });
  if (!res.ok) throw new Error(`[shitamachi-fourth-season] ${name} failed: ${res.summary} ${JSON.stringify(res.issues ?? [])}`);
  Object.assign(project, ctx.project);
  return { summary: res.summary, data: res.data };
}

type Cell = { x: number; y: number };
/** want 에서 가장 가까운 걸을 수 있는 빈 칸(이벤트가 없는 칸). 없으면 던진다 — 레이아웃이 바뀌어 인물이 벽에 서는 일을 막는다. */
function nearestFree(project: Project, map: GameMap, want: Cell, avoid: readonly Cell[] = []): Cell {
  for (let r = 0; r < Math.max(map.width, map.height); r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const c = { x: want.x + dx, y: want.y + dy };
      if (c.x < 1 || c.y < 1 || c.x >= map.width - 1 || c.y >= map.height - 1) continue;
      if (!isPassable(project, map, c.x, c.y)) continue;
      if (map.events.some((e) => e.x === c.x && e.y === c.y) || avoid.some((a) => a.x === c.x && a.y === c.y)) continue;
      return c;
    }
  }
  throw new Error(`[shitamachi-fourth-season] ${map.id} 에 ${want.x},${want.y} 근처 빈 칸이 없다`);
}

/** 거리 건물 이름표(compose_jp_city_street 가 단 locations)에서 그 종류의 문 칸. */
function doorOf(map: GameMap, kind: string, nth = 0): Cell {
  const hits = (map.locations ?? []).filter((l) => (l.tags ?? []).includes("jp-building") && (l.tags ?? []).includes(kind) && !(l.note ?? "").includes("닿지 않음"));
  const loc = hits[nth];
  const m = loc ? /문 \((\d+),(\d+)\)/u.exec(loc.note ?? "") : null;
  if (!m) throw new Error(`[shitamachi-fourth-season] 거리에 ${kind} 건물(${nth})이 없다 — compose_jp_city_street 결과가 바뀌었다`);
  return { x: Number(m[1]), y: Number(m[2]) };
}

// ── 맵 짓기 ──
function buildMaps(project: Project): { arrive: Cell; links: Record<"house" | "bakery" | "sento" | "office" | "rooftop", { entry: Cell; exit: Cell; streetLanding: Cell }> } {
  project.tilesets[JP_CITY_ID] = createJpCityTileset();
  const hub = createStarterMap();
  hub.id = M.hub;
  hub.name = "시타마치 상점가";
  hub.tilesetId = JP_CITY_ID;
  hub.width = 40;
  hub.height = 28;
  hub.lowerTiles = new Array(40 * 28).fill(blankFillTileFor(JP_CITY_ID));
  hub.upperTiles = new Array(40 * 28).fill(-1);
  project.maps[M.hub] = hub;
  execTool(project, "compose_jp_city_street", { mapId: M.hub, style: "shotengai", seed: 11, replace: true });

  const rooms = [
    { mapId: M.train, name: "통학 전철 · 저녁", tileset: JP_CITY_ID, room: "train-car", seed: 1 },
    { mapId: M.house, name: "하진의 집", tileset: "modern_city", room: "mc_house", seed: 1 },
    { mapId: M.bakery, name: "코하루 베이커리", tileset: "modern_city", room: "mc_bakery_cafe", seed: 7 },
    { mapId: M.sento, name: "센토 마츠노유", tileset: "modern_city", room: "mc_sento", seed: 8 },
    { mapId: M.office, name: "상점가 진흥회 사무소", tileset: "modern_city", room: "mc_council_room", seed: 4 },
    { mapId: M.rooftop, name: "히카리 맨션 옥상", tileset: "modern_city", room: "mc_rooftop", seed: 6 },
  ] as const;
  for (const r of rooms) {
    execTool(project, "build_hand_interior_room", { mapId: r.mapId, name: r.name, tileset: r.tileset, replace: true, layout: { program: r.room, seed: r.seed, furnish: true } });
  }

  // 거리 문 ↔ 실내: 걸어 들어가고 걸어 나온다(순간이동 메뉴 없음).
  const linkSpec = {
    bakery: { kind: "shop", nth: 0, mapId: M.bakery },
    office: { kind: "office", nth: 0, mapId: M.office },
    rooftop: { kind: "apartment", nth: 0, mapId: M.rooftop },
    // 남쪽 줄 건물 문은 맵 끝 뒷골목에 갇혀 큰길에서 닿지 않는다(compose 경고) — 북쪽 뒷길의 마치야 둘을 집·센토로 쓴다.
    house: { kind: "machiya", nth: 0, mapId: M.house },
    sento: { kind: "machiya", nth: 1, mapId: M.sento },
  } as const;
  const links = {} as Record<keyof typeof linkSpec, { entry: Cell; exit: Cell; streetLanding: Cell }>;
  for (const [key, spec] of Object.entries(linkSpec) as [keyof typeof linkSpec, (typeof linkSpec)[keyof typeof linkSpec]][]) {
    const door = doorOf(project.maps[M.hub]!, spec.kind, spec.nth);
    const res = execTool(project, "link_jp_city_interior", { mapId: M.hub, door, interiorMapId: spec.mapId, replace: true });
    const data = res.data as { entryLanding: Cell; exitCells: Cell[]; exitLanding: Cell };
    links[key] = { entry: data.entryLanding, exit: data.exitCells[0]!, streetLanding: data.exitLanding };
  }
  for (const id of Object.keys(project.maps)) if (!(Object.values(M) as string[]).includes(id)) delete project.maps[id];

  // 큰길 서쪽 끝 = 역 방면. 전철에서 내리면 여기 선다.
  const arrive = nearestFree(project, project.maps[M.hub]!, { x: 1, y: 15 });
  return { arrive, links };
}

// ── 장면 ──

/** 0) 저녁 통학 전철 — 같은 칸의 유나. */
function buildTrain(project: Project, arrive: Cell): Cell {
  const map = project.maps[M.train]!;
  const heroAt = nearestFree(project, map, { x: 7, y: 4 });
  const yunaAt = nearestFree(project, map, { x: 12, y: 4 }, [heroAt]);
  const yunaId = "ev_sm_train_yuna";
  const scene: Command[] = [
    ...fadeIn(800),
    ...caption("가을의 끝, 저녁 통학 전철."),
    ...think(
      "여덟 살 때 떠났던 시타마치로 돌아온 게 올봄이었다.",
      "봄, 여름, 가을. 이 동네에서 맞는 세 번째 계절도 다 지나간다.",
      "…저 애, 오늘도 같은 칸이네.",
    ),
    faceHero(yunaId),
    ...say("yuna", "base", "…….", "(낡은 필름 카메라를 두 손으로 감싸 쥐고 창밖을 보고 있다.)"),
    choices([
      { text: "카메라에 대해 묻는다", then: [
        ...say("hajin", "base", "그거, 필름 카메라지? 요즘 보기 드문데."),
        ...say("yuna", "surprised", "아… 네. 할머니 거예요."),
        ...say("yuna", "happy", "내일 상점가 등롱 축제를 찍고 싶어서요. 불이 켜지는 순간이 제일 예쁘거든요."),
        ...like("yuna", 2),
      ] },
      { text: "가볍게 목례만 한다", then: [
        ...say("yuna", "embarrassed", "……(작게 고개를 숙인다)"),
        ...like("yuna", 1),
      ] },
      { text: "모른 척 창밖을 본다", then: [
        ...think("말을 걸 이유도 없지. 창밖으로 아케이드 지붕이 다가온다."),
      ] },
    ]),
    playSe(SE_CHIME),
    ...voice("안내 방송", "곧 시타마치, 시타마치입니다. 내리실 문은 왼쪽입니다."),
    ...say("yuna", "base", "…저, 여기서 내려요. 그럼."),
    walk(yunaId, ["left", "left"]),
    setSw("sw_sm_train_yuna_off", true),
    setVar(V_STAGE, "=", 1),
    ...fadeOut(700),
    transfer(M.hub, arrive, "right"),
  ];
  // 자동 실행 장면은 주인공 칸이 아닌 벽 칸에 둔다(주인공이 이벤트 칸 위에서 시작하면 헤드리스 자동 플레이가 길을 못 잡는다).
  map.events.push(event("ev_sm_train_scene", "저녁 전철", { x: 0, y: 0 }, [
    page("ev_sm_train_scene_p", [varIs(V_STAGE, 0)], scene, { trigger: "auto" }),
    gone("ev_sm_train_scene_done", [varAtLeast(V_STAGE, 1)]),
  ]));
  map.events.push(event(yunaId, "유나", yunaAt, [
    page(`${yunaId}_p`, [], [...say("yuna", "base", "…….")], { who: "yuna", dir: "left" }),
    gone(`${yunaId}_off`, [swOn("sw_sm_train_yuna_off")]),
  ], "yuna"));
  return heroAt;
}

/** 1~3) 상점가 — 서연의 부탁, 등롱지기, 점등과 선택. */
function buildHub(project: Project, arrive: Cell): void {
  const hub = project.maps[M.hub]!;
  const seoyeonAt = nearestFree(project, hub, { x: arrive.x + 3, y: arrive.y }, [arrive]);
  const seoyeonId = "ev_shitamachi_seoyeon";
  const intro: Command[] = [
    ...fadeIn(600),
    ...caption("시타마치 상점가. 아케이드 지붕 아래로 저녁 장 보는 사람들이 오간다."),
    ...say("seoyeon", "happy", "하진! 딱 맞춰 왔네."),
    ...say("hajin", "surprised", "서연? 학생회장이 여기서 뭐 해?"),
    ...say("seoyeon", "base",
      "내일 밤이 「시타마치 등롱 축제」인 거 알지? 진흥회 어르신들 일손이 모자라서 학생회가 돕기로 했어.",
      "정문 큰 등롱에 「소원 등롱」 세 개를 넣어야 불이 켜지는데, 아직 하나도 안 모였어."),
    ...say("seoyeon", "base",
      "하나는 코하루 베이커리, 하나는 센토 마츠노유. 마지막 하나는… 진흥회 사무소에서 서류랑 씨름 중인 나한테 있고.",
      "셋 다 모이면 정문 옆 등롱지기 할아버지께 가져다드리면 돼."),
    choices([
      { text: "「같이 하자. 너 혼자 다 떠안지 말고.」", then: [
        ...say("seoyeon", "embarrassed", "…떠안은 거 아니거든. 그래도, 고마워."),
        ...like("seoyeon", 2),
      ] },
      { text: "「알았어, 금방 모아 올게.」", then: [
        ...say("seoyeon", "happy", "믿을게. 사무소는 큰길 동쪽 끝이야."),
        ...like("seoyeon", 1),
      ] },
      { text: "「학생회 일을 왜 내가…」", then: [
        ...say("seoyeon", "sad", "…그러게. 미안, 부탁할 사람이 너밖에 생각이 안 났어."),
      ] },
    ]),
    ...say("seoyeon", "base", "베이커리는 지호네잖아. 네 소꿉친구. 센토는 아케이드 지나 북쪽 뒷길이고. 그럼, 사무소에서 기다릴게!"),
    walk(seoyeonId, ["right", "right", "right", "right"]),
    setSw("sw_sm_seoyeon_hub_off", true),
    setVar(V_STAGE, "=", 2),
    ...think("소원 등롱 세 개. 베이커리, 센토, 진흥회 사무소."),
  ];
  hub.events.push(event(seoyeonId, "서연", seoyeonAt, [
    page(`${seoyeonId}_intro`, [varIs(V_STAGE, 1)], intro, { who: "seoyeon", dir: "left", trigger: "auto" }),
    gone(`${seoyeonId}_off`, [swOn("sw_sm_seoyeon_hub_off")]),
  ], "seoyeon"));

  // 등롱지기 할아버지 — 북쪽 아케이드 정문(지붕 덮인 길) 옆.
  const keeperAt = nearestFree(project, hub, { x: 12, y: 12 });
  const keeperId = "ev_sm_keeper";
  const remaining = (n: number): Command => ifCond(varIs(V_LANTERNS, n), say("keeper", "base", `소원 등롱이 ${n}개 모였구먼. ${3 - n}개 더 가져오게. 베이커리, 센토, 진흥회 사무소일세.`));
  const heroines = [
    { who: "seoyeon" as const, at: { x: keeperAt.x - 1, y: keeperAt.y + 2 } },
    { who: "jiho" as const, at: { x: keeperAt.x + 1, y: keeperAt.y + 2 } },
    { who: "yuna" as const, at: { x: keeperAt.x + 3, y: keeperAt.y + 2 } },
  ].map((h) => ({ ...h, at: nearestFree(project, hub, h.at, [keeperAt]) }));
  // 등롱 불빛 — 정문 등롱과 가게 앞 처마 등롱. 칸은 거리 건물 문 칸(맨 아래 줄)이라 그 바로 위에 단다.
  const lampCells: Cell[] = [
    { x: 14, y: 9 }, { x: 15, y: 9 },
    ...(hub.locations ?? []).filter((l) => (l.tags ?? []).includes("jp-building")).map((l) => {
      const m = /문 \((\d+),(\d+)\)/u.exec(l.note ?? "");
      return m ? { x: Number(m[1]), y: Number(m[2]) - 1 } : null;
    }).filter((c): c is Cell => !!c),
  ];
  const lightUp: Command[] = [
    { kind: "setLighting", ambient: 0.62, color: "#141a38", transitionMs: 1800 } as Command,
    wait(1800),
    ...lampCells.flatMap((c, i): Command[] => [
      { kind: "addLight", source: { id: `sm_lantern_${i}`, at: c, radius: i < 2 ? 4 : 2.6, intensity: 1, color: "#ffb35c", flicker: true } satisfies LightSource } as Command,
      ...(i < 2 || i % 3 === 0 ? [playSe(SE_LANTERN), wait(220)] : [wait(90)]),
    ]),
  ];
  const finale: Command[] = [
    ...say("keeper", "happy", "오오, 세 개 다 모였구먼! 서연이 아가씨 말대로 든든한 청년이야."),
    ...say("keeper", "base", "자, 정문 큰 등롱에 넣어 보게. 이 등롱은 해마다 동네 아이들 소원으로 불을 켰지."),
    ...fadeOut(500), setSw("sw_sm_gather", true), ...fadeIn(500),
    ...say("seoyeon", "happy", "하진, 다 모았구나! 지호랑 유나도 불렀어. 점등은 다 같이 봐야지."),
    ...say("jiho", "happy", "우리 빵집 등롱도 들어갔지? 내 소원은 비밀!"),
    ...say("yuna", "base", "…카메라, 준비됐어요."),
    bgm(BGM_ROOF, 1200),
    ...lightUp,
    setSw(SW_LIT, true),
    ...caption("아케이드 지붕 아래, 등롱이 하나씩 켜진다."),
    ...say("yuna", "happy", "……예쁘다."),
    ...say("jiho", "happy", "와아… 어릴 때 본 거랑 똑같아!"),
    ...say("seoyeon", "embarrassed", "해냈네, 우리."),
    ...say("keeper", "happy", "허허. 등롱 길은 둘이 걸어야 제맛이지. 자네는 누구랑 걸을 텐가?"),
    choices([
      { text: "서연과 걷는다", then: [setVar(V_DATE, "=", 1)] },
      { text: "지호와 걷는다", then: [setVar(V_DATE, "=", 2)] },
      { text: "유나와 걷는다", then: [setVar(V_DATE, "=", 3)] },
      { text: "다 같이 걷는다", then: [setVar(V_DATE, "=", 4)] },
    ]),
    ifCond(varIs(V_DATE, 4), [
      ...say("seoyeon", "happy", "그래, 오늘은 다 같이!"),
      ...say("jiho", "happy", "그럼 등롱빵 남은 거 다 같이 먹자!"),
      ...say("yuna", "happy", "…넷이서 한 장 찍어요."),
      { kind: "triggerEnding", endingId: END_FRIENDS } as Command,
    ], [
      ...say("keeper", "happy", "맨션 옥상에 올라가 보게. 아케이드 등롱이 한눈에 보이는 자리라네."),
      setVar(V_STAGE, "=", 3),
      ...fadeOut(800),
      { kind: "transfer", mapId: M.rooftop, x: 0, y: 0, direction: "up", fade: "black" } as Command, // 좌표는 buildRooftop 이 채운다
    ]),
  ];
  hub.events.push(event(keeperId, "등롱지기 할아버지", keeperAt, [
    page(`${keeperId}_p0`, [], [
      faceHero(keeperId),
      ...say("keeper", "base", "아케이드 정문 등롱은 내일 밤에 켠다네. 소원 등롱 세 개가 들어가야 불이 붙지."),
    ], { who: "keeper" }),
    page(`${keeperId}_p2`, [varAtLeast(V_STAGE, 2)], [
      faceHero(keeperId),
      ...say("keeper", "base", "자네가 서연이 아가씨가 말한 그 청년이구먼."),
      ...[0, 1, 2].map(remaining),
      ifCond(varIs(V_LANTERNS, 3), finale),
    ], { who: "keeper" }),
  ]));
  for (const h of heroines) {
    hub.events.push(event(`ev_sm_gather_${h.who}`, CAST[h.who].name, h.at, [
      gone(`ev_sm_gather_${h.who}_off`, []),
      page(`ev_sm_gather_${h.who}_on`, [swOn("sw_sm_gather")], [...say(h.who, "happy", "등롱, 예쁘다.")], { who: h.who, dir: "up" }),
    ], h.who));
  }
  // 거리 행인 — 저녁 장을 보는 사람들(현대 칩, 사람을 새로 만들지 않는다).
  execTool(project, "add_street_walkers", {
    mapId: M.hub,
    walkers: [
      { name: "장 보는 아주머니", graphic: { selectionId: "charset:oprn-charset-modern3:2" }, stops: [{ x: 3, y: 12 }, { x: 25, y: 12 }], lines: ["내일 등롱 축제지? 우리 가게도 등롱 달았어."] },
      { name: "퇴근길 회사원", graphic: { selectionId: "charset:oprn-charset-modern3:0" }, stops: [{ x: 38, y: 18 }, { x: 6, y: 18 }], lines: ["역 앞 고로케집, 오늘도 줄이 길더라."] },
      { name: "하굣길 학생", graphic: { selectionId: "charset:oprn-charset-modern1:1" }, stops: [{ x: 15, y: 3 }, { x: 15, y: 12 }, { x: 30, y: 12 }], lines: ["회장님이 등롱 모으러 다니더라. 너도 도와?"] },
    ],
  });
}

/** 실내에서 그 사람이 설 칸 — 방 안 want 근처(입구 발판·출구는 피한다). */
function placeIn(project: Project, mapId: string, want: Cell, avoid: Cell[]): Cell {
  return nearestFree(project, project.maps[mapId]!, want, avoid);
}

function lanternGiven(sw: string): Command[] {
  return [setSw(sw, true), setVar(V_LANTERNS, "+=", 1), playSe(SE_LANTERN), ...caption("소원 등롱을 받았다.")];
}

function buildBakery(project: Project, link: { entry: Cell; exit: Cell }): void {
  const at = placeIn(project, M.bakery, { x: 17, y: 5 }, [link.entry, link.exit]);
  const id = "ev_sm_jiho";
  const first: Command[] = [
    faceHero(id),
    ...say("jiho", "surprised", "어서 오세요~ …어? 하진이잖아!"),
    ...say("jiho", "happy", "등롱 받으러 왔지? 서연이한테 들었어. 근데 잠깐만, 내일 팔 등롱빵 반죽이 아직 반이나 남았거든."),
    ...say("jiho", "base", "어릴 때 너, 우리 가게 반죽 몰래 뜯어 먹다가 할머니한테 혼났던 거 기억나?"),
    choices([
      { text: "「기억나. 그때 네가 대신 혼나 줬지.」", then: [
        ...say("jiho", "embarrassed", "…그걸 기억해? 나만 기억하는 줄 알았는데."),
        ...like("jiho", 2),
      ] },
      { text: "「반죽 같이 빚을게. 앞치마 있어?」", then: [
        ...say("jiho", "happy", "진짜? 손 씻고 와! 모양 이상하게 만들면 네가 다 사 가는 거다?"),
        ...like("jiho", 2),
      ] },
      { text: "「바쁘면 등롱만 받아 갈게.」", then: [
        ...say("jiho", "sad", "…응. 그렇지. 바쁘지, 다들."),
      ] },
    ]),
    ifCond(swOn(SW_PHOTO), [
      ...say("hajin", "base", "집에서 옛날 사진 봤어. 이 가게 앞에서 찍은 거. 너 그때 등롱 들고 울고 있더라."),
      ...say("jiho", "embarrassed", "으아, 그 사진! …그날 너 이사 가는 날이었잖아. 내년 등롱은 같이 보자고, 네가 약속했어."),
      ...like("jiho", 1),
    ]),
    ifCond(swOn(SW_NOTE), [
      ...say("hajin", "base", "아, 엄마가 안부 전해 달래. 내가 어릴 때 여기서 살다시피 했다고."),
      ...say("jiho", "happy", "아줌마가? 헤헤. 우리 할머니도 네 얘기 자주 해. 그 반죽 도둑은 잘 크고 있냐고."),
      ...like("jiho", 1),
    ]),
    ...say("jiho", "base", "자, 코하루 베이커리 소원 등롱. 안에 뭐 적었는지는 보지 마!"),
    ...lanternGiven(SW_L_JIHO),
  ];
  // 등롱을 받은 뒤 다시 말을 걸면 한 번, 내일 팔 등롱빵 시식 — 지호와의 두 번째 장면.
  const taste: Command[] = [
    faceHero(id),
    ...say("jiho", "happy", "잠깐! 내일 팔 등롱빵 첫 판이 나왔어. 시식해 줘. 솔직하게!"),
    ...caption("주황색 등롱 모양 빵. 겉은 바삭하고, 안에는 따뜻한 커스터드."),
    choices([
      { text: "「옛날 그 맛이다. 할머니 빵이랑 똑같아.」", then: [
        ...say("jiho", "embarrassed", "…그거 내가 제일 듣고 싶던 말이야. 할머니 레시피, 나 혼자 다시 맞춘 거거든."),
        ...like("jiho", 1),
      ] },
      { text: "「맛있다. 근데 조금 달아.」", then: [
        ...say("jiho", "base", "흐음, 설탕 조금 줄여 볼게. 역시 넌 솔직하다니까."),
      ] },
    ]),
    setSw("sw_sm_jiho_taste", true),
  ];
  const after: Command[] = [faceHero(id), ...say("jiho", "happy", "내일 축제 끝나면 남은 등롱빵 다 같이 먹자. 약속!")];
  project.maps[M.bakery]!.events.push(event(id, "지호", at, [
    page(`${id}_p1`, [], first, { who: "jiho" }),
    page(`${id}_p2`, [swOn(SW_L_JIHO)], taste, { who: "jiho" }),
    page(`${id}_p3`, [swOn("sw_sm_jiho_taste")], after, { who: "jiho" }),
  ], "jiho"));
}

function buildSento(project: Project, link: { entry: Cell; exit: Cell }): void {
  const at = placeIn(project, M.sento, { x: link.entry.x + 3, y: link.entry.y - 3 }, [link.entry, link.exit]);
  const id = "ev_sm_yuna";
  const first: Command[] = [
    faceHero(id),
    ...say("yuna", "surprised", "어서 오세… 아. 전철의…"),
    ...say("hajin", "surprised", "여기가 너네 집이었어?"),
    ...say("yuna", "base", "할머니 센토예요. 저는 번대(접수대)를 봐요. …등롱, 받으러 오셨죠."),
    ...say("yuna", "base", "이 사진, 십 년 전 등롱 축제예요. 할머니가 찍었어요. 저는 이 불빛을 다시 찍고 싶어서 카메라를 들었어요."),
    choices([
      { text: "「내일 네 사진, 나도 보고 싶어.」", then: [
        ...say("yuna", "embarrassed", "…현상하면, 제일 먼저 보여 드릴게요."),
        ...like("yuna", 3),
      ] },
      { text: "「할머니 사진 좋다. 따뜻해.」", then: [
        ...say("yuna", "happy", "…네. 할머니가 들으면 좋아하실 거예요."),
        ...like("yuna", 2),
      ] },
      { text: "「사진은 휴대폰으로 찍으면 되잖아.」", then: [
        ...say("yuna", "sad", "…그렇죠. 다들 그렇게 말해요."),
      ] },
    ]),
    ...say("yuna", "base", "마츠노유의 소원 등롱이에요. 조심히… 들고 가세요."),
    ...lanternGiven(SW_L_YUNA),
  ];
  const after: Command[] = [faceHero(id), ...say("yuna", "base", "…내일, 정문 앞에서 찍을 거예요. 비 안 왔으면 좋겠다.")];
  project.maps[M.sento]!.events.push(event(id, "유나", at, [
    page(`${id}_p1`, [], first, { who: "yuna" }),
    page(`${id}_p2`, [swOn(SW_L_YUNA)], after, { who: "yuna" }),
  ], "yuna"));
}

function buildOffice(project: Project, link: { entry: Cell; exit: Cell }): void {
  const at = placeIn(project, M.office, { x: link.entry.x, y: link.entry.y - 7 }, [link.entry, link.exit]);
  const id = "ev_sm_seoyeon_office";
  const first: Command[] = [
    faceHero(id),
    ...say("seoyeon", "sad", "왔어? …미안, 서류가 산더미라. 축제 순서표에 가게 마흔 곳 등롱 위치에, 안전 점검표까지."),
    ...say("seoyeon", "base", "학생회장이 이런 것도 못 하면 안 되잖아. 그러니까 괜찮아."),
    choices([
      { text: "「반 나눠. 내가 순서표 할게.」", then: [
        ...say("seoyeon", "surprised", "…진짜? 그럼 나는 점검표 할게."),
        ...caption("둘이서 서류 더미를 반씩 나눴다. 창밖이 붉어질 무렵, 마지막 장에 도장이 찍혔다."),
        ...say("seoyeon", "happy", "끝났다…! 혼자였으면 밤샜을 거야."),
        ...like("seoyeon", 3),
      ] },
      { text: "「잠깐 쉬어. 따뜻한 차 사 올게.」", then: [
        ...say("seoyeon", "embarrassed", "…쉬라는 말, 오랜만에 들어 봐."),
        ...like("seoyeon", 2),
      ] },
      { text: "「회장이니까 잘하겠지. 등롱만 줘.」", then: [
        ...say("seoyeon", "sad", "…응. 그래야지."),
      ] },
    ]),
    ...say("seoyeon", "base", "진흥회 몫 소원 등롱이야. …내 소원도 들어 있어. 읽지 마."),
    ...lanternGiven(SW_L_SEOYEON),
  ];
  const after: Command[] = [faceHero(id), ...say("seoyeon", "base", "등롱 셋 다 모이면 등롱지기 할아버지께 가져가. 정문 옆에 계셔.")];
  project.maps[M.office]!.events.push(event(id, "서연", at, [
    page(`${id}_p1`, [], first, { who: "seoyeon" }),
    page(`${id}_p2`, [swOn(SW_L_SEOYEON)], after, { who: "seoyeon" }),
  ], "seoyeon"));
}

function buildHouse(project: Project, link: { entry: Cell; exit: Cell }): void {
  const map = project.maps[M.house]!;
  const noteAt = placeIn(project, M.house, { x: link.entry.x - 6, y: link.entry.y - 4 }, [link.entry, link.exit]);
  const photoAt = placeIn(project, M.house, { x: noteAt.x - 4, y: noteAt.y }, [link.entry, link.exit, noteAt]);
  map.events.push(event("ev_sm_house_note", "식탁 위 쪽지", noteAt, [
    page("ev_sm_house_note_p", [], [
      ...caption("식탁 위에 엄마의 쪽지가 있다."),
      ...voice("엄마의 쪽지", "하진아, 진흥회 일 돕는다며? 내일 축제 끝나고 늦으면 연락해. 저녁은 냉장고에.", "추신. 지호네 빵집에 안부 전해 줘. 너 어릴 때 거기서 살다시피 했잖니."),
      setSw(SW_NOTE, true),
    ], { priority: "same" }),
  ]));
  map.events.push(event("ev_sm_house_photo", "책장 위 사진", photoAt, [
    page("ev_sm_house_photo_p", [], [
      ...caption("책장 위에 낡은 사진 한 장."),
      ...think("코하루 베이커리 앞. 등롱을 든 채 울고 있는 꼬마 지호와, 그 옆에서 어쩔 줄 모르는 나.", "…이사 가던 날이다. 내년엔 같이 등롱 보자고, 그렇게 말했었지."),
      setSw(SW_PHOTO, true),
    ], { priority: "same" }),
  ]));
}

function buildRooftop(project: Project, link: { entry: Cell; exit: Cell }): Cell {
  const map = project.maps[M.rooftop]!;
  const arrive = link.entry;
  const spot = placeIn(project, M.rooftop, { x: arrive.x, y: arrive.y - 6 }, [link.entry, link.exit]);
  const scenes: Record<1 | 2 | 3, { who: "seoyeon" | "jiho" | "yuna"; variable: string; ending: string; open: Command[]; yes: Command[]; no: Command[] }> = {
    1: {
      who: "seoyeon", variable: V_SEOYEON, ending: END_SEOYEON,
      open: [
        ...say("seoyeon", "base", "여기서 보니까 아케이드가 등롱 강 같다."),
        ...say("seoyeon", "embarrassed", "있잖아, 하진. 학생회장 말고, 그냥 나로 있어도 되는 곳이 생긴 것 같아. …오늘 사무소에서."),
      ],
      yes: [
        ...say("seoyeon", "embarrassed", "…바보. 등롱에 적은 내 소원, 지금 이뤄졌어."),
        ...say("seoyeon", "happy", "좋아해. 나도. 다음 계절에도, 그다음에도."),
      ],
      no: [
        ...say("seoyeon", "sad", "…고마워. 근데 미안. 아직 나, 너를 잘 몰라."),
        ...say("seoyeon", "base", "대신 내일 축제, 같이 운영하자. 친구로서. 그건 진심이야."),
      ],
    },
    2: {
      who: "jiho", variable: V_JIHO, ending: END_JIHO,
      open: [
        ...say("jiho", "happy", "와, 우리 가게 지붕도 보여! 저기 저 노란 등롱."),
        ...say("jiho", "base", "있지, 십 년 전에 네가 한 약속. 내년엔 같이 등롱 보자던 거. …나 진짜로 십 년 기다렸다?"),
      ],
      yes: [
        ...say("jiho", "embarrassed", "…늦었잖아, 바보. 십 년이나."),
        ...say("jiho", "happy", "그래도 돌아왔으니까 봐줄게. 내일 아침부터 빵 반죽은 네 담당이야."),
      ],
      no: [
        ...say("jiho", "sad", "…그치. 너한텐 그냥 옛날 일이지."),
        ...say("jiho", "happy", "괜찮아! 소꿉친구 자리는 아무한테도 안 뺏길 거니까."),
      ],
    },
    3: {
      who: "yuna", variable: V_YUNA, ending: END_YUNA,
      open: [
        ...say("yuna", "base", "…여기, 할머니가 십 년 전에 사진 찍은 자리예요."),
        ...say("yuna", "embarrassed", "한 장 남았어요, 필름. …누구를 찍을지 정했어요."),
      ],
      yes: [
        ...say("yuna", "embarrassed", "……찰칵."),
        ...say("yuna", "happy", "등롱보다, 이 얼굴이 더 남기고 싶었어요. 매일 같은 전철에서, 매일."),
      ],
      no: [
        ...say("yuna", "sad", "……그렇구나."),
        ...say("yuna", "base", "그래도, 이 사진은 줄게요. 등롱 앞의 당신. 친구로서."),
      ],
    },
  };
  const pages: EventPage[] = [gone("ev_sm_roof_idle", [])];
  for (const [n, s] of Object.entries(scenes) as unknown as [string, (typeof scenes)[1]][]) {
    const date = Number(n);
    const heroineId = `ev_sm_roof_${s.who}`;
    map.events.push(event(heroineId, CAST[s.who].name, spot, [
      gone(`${heroineId}_off`, []),
      page(`${heroineId}_on`, [varIs(V_DATE, date)], [...say(s.who, "base", "…….")], { who: s.who, dir: "up" }),
    ], s.who));
    pages.push(page(`ev_sm_roof_scene_${s.who}`, [varIs(V_STAGE, 3), varIs(V_DATE, date)], [
      bgm(BGM_CONFESS, 1500),
      ...caption("히카리 맨션 옥상. 발밑으로 아케이드의 등롱 길이 강처럼 흐른다."),
      approach("@player", heroineId),
      turn(heroineId, "down"),
      ...s.open,
      choices([
        { text: "「좋아해. 이번 계절도, 다음 계절도 너랑 걷고 싶어.」", then: [
          ifCond(varAtLeast(s.variable, TRUE_AT), [
            ...s.yes,
            { kind: "triggerEnding", endingId: s.ending } as Command,
          ], [
            ...s.no,
            { kind: "triggerEnding", endingId: END_FRIENDS } as Command,
          ]),
        ] },
        { text: "「오늘은 그냥, 같이 등롱을 보자.」", then: [
          ...say(s.who, "happy", "…응. 그것도 좋다."),
          { kind: "triggerEnding", endingId: END_FRIENDS } as Command,
        ] },
      ]),
    ], { trigger: "auto" }));
  }
  map.events.push(event("ev_sm_roof_scene", "옥상 고백", { x: 1, y: 1 }, pages));
  // 밤 옥상 — 도시 불빛과 난간 등.
  map.defaultLighting = {
    ambient: 0.55, color: "#121734",
    sources: [
      { id: "roof_glow_a", at: spot, radius: 5, intensity: 0.9, color: "#ffbf73", flicker: false },
      { id: "roof_glow_b", at: arrive, radius: 3, intensity: 0.7, color: "#ffd9a0", flicker: false },
    ],
  };
  map.bgm = { mode: "custom", resourceId: BGM_ROOF } as GameMap["bgm"];
  return arrive;
}

// ── 타이틀·오프닝·엔딩 ──
function buildTitleAndOpening(project: Project, spots: { jiho: Cell; yuna: Cell; seoyeon: Cell; keeper: Cell }): void {
  if (project.system.titleScreen) project.system.titleScreen.backgroundFit = "cover";
  project.system.opening = { enabled: true, skippable: true, scenes: [] };
  const STAGE = { width: 384, height: 216 };
  const shots: { id: string; mapId: string; focus: Cell; caption: string; actors: { who: Who; at: Cell; dir: "down" | "left" | "right" | "up"; walk?: number }[] }[] = [
    {
      id: "sm_shot_arcade", mapId: M.hub, focus: { x: 14, y: 8 }, caption: "도쿄 시타마치. 지붕 덮인 상점가, 가을의 끝.",
      actors: [{ who: "hajin", at: { x: 9, y: 12 }, dir: "right", walk: 72 }],
    },
    {
      id: "sm_shot_bakery", mapId: M.bakery, focus: { x: spots.jiho.x, y: spots.jiho.y + 4 }, caption: "어릴 적 약속을 기억하는 소꿉친구, 지호.",
      actors: [{ who: "jiho", at: spots.jiho, dir: "down" }],
    },
    {
      id: "sm_shot_sento", mapId: M.sento, focus: { x: spots.yuna.x, y: spots.yuna.y - 2 }, caption: "같은 전철, 같은 칸. 필름 카메라를 든 유나.",
      actors: [{ who: "yuna", at: spots.yuna, dir: "down" }],
    },
    {
      id: "sm_shot_office", mapId: M.office, focus: { x: spots.seoyeon.x, y: spots.seoyeon.y + 2 }, caption: "축제를 혼자 떠안은 학생회장, 서연.",
      actors: [{ who: "seoyeon", at: spots.seoyeon, dir: "down" }],
    },
    {
      id: "sm_shot_gate", mapId: M.hub, focus: { x: 14, y: 11 }, caption: "내일 밤, 아케이드에 등롱이 켜진다.",
      actors: [{ who: "keeper", at: spots.keeper, dir: "down" }, { who: "hajin", at: { x: spots.keeper.x + 2, y: spots.keeper.y + 1 }, dir: "up" }],
    },
  ];
  for (const [index, s] of shots.entries()) {
    execTool(project, "create_opening_animatic_shot", { shotId: s.id, durationMs: 5200, width: STAGE.width, height: STAGE.height, replace: true, clearLayers: true });
    execTool(project, "set_opening_pixel_grid", { shotId: s.id, width: STAGE.width, height: STAGE.height });
    execTool(project, "place_opening_background", { shotId: s.id, layerId: "bg", mapId: s.mapId, focus: s.focus });
    const scene = project.system.opening!.scenes.find((sc) => sc.id === s.id);
    const crop = scene?.kind === "animatic" ? scene.composition.layers.find((l) => l.id === "bg")?.crop : undefined;
    if (!crop) throw new Error(`[shitamachi-fourth-season] 오프닝 ${s.id} 배경 crop 이 없다`);
    // 무대 화소 = 맵 화소 - crop 왼쪽 위(1:1). 배우 발은 칸 아랫변에.
    for (const [ai, a] of s.actors.entries()) {
      const x = a.at.x * 16 + 8 - crop.x;
      const y = (a.at.y + 1) * 16 - crop.y;
      execTool(project, "place_opening_charset_actor", {
        shotId: s.id, layerId: `actor_${ai}`, charsetResourceId: CAST[a.who].resource, characterIndex: CAST[a.who].index,
        direction: a.dir, scale: 1, x, y,
        ...(a.walk ? { fromX: x, toX: x + a.walk, durationMs: 4800, stride: 8 } : {}),
      });
    }
    if (index === shots.length - 1) {
      execTool(project, "upsert_opening_light_fx", {
        shotId: s.id, layerId: "lantern", kind: "glow", x: 15 * 16 - crop.x - 20, y: 9 * 16 + 8 - crop.y - 20, width: 40, height: 40,
        color: "#ff9a3c", blend: "screen", inner: 0.12, pulse: { hz: 0.5, amount: 0.25, pattern: "pulse", seed: 7 },
      });
    }
    execTool(project, "set_opening_caption", { shotId: s.id, layerId: "caption", letterbox: 0.15, color: "#fff4e6", cues: [{ atMs: 300, text: s.caption, typewriterMs: 900 }] });
  }
  const opening = project.system.opening!;
  opening.musicResourceId = BGM_MEMORY;
  for (const scene of opening.scenes) if (scene.kind === "animatic") scene.narration = "";
}

function defineEndings(project: Project): void {
  const credits = "시타마치의 네 번째 계절\n\nOPRN 에디터 공식 데모\n그림: OPRN 기본 에셋(jp_city · 현대 칩셋 · 공용 흉상)\n음악·효과음: CC0 카탈로그";
  execTool(project, "define_ending", {
    id: END_SEOYEON, name: "서연 · 학생회장이 아닌 날", priority: 10, conditions: [{ kind: "friendshipAtLeast", npcKey: "seoyeon", value: TRUE_AT * 100 }],
    presentation: { kicker: "두 사람의 이야기", musicResourceId: BGM_HAPPY, tone: "warm", backgroundResourceId: "oprn-title-romance-school", credits },
    epilogue: [
      { kind: "say", speaker: "서연", text: "축제 다음 날, 사무소 책상 위에 순서표가 두 장 놓여 있었다. 내 글씨와, 네 글씨." },
      { kind: "say", speaker: "하진", text: "다음 계절에도 반씩 나누자. 서류도, 등롱도." },
    ],
  });
  execTool(project, "define_ending", {
    id: END_JIHO, name: "지호 · 십 년 늦은 약속", priority: 10, conditions: [{ kind: "friendshipAtLeast", npcKey: "jiho", value: TRUE_AT * 100 }],
    presentation: { kicker: "두 사람의 이야기", musicResourceId: BGM_HAPPY, tone: "warm", backgroundResourceId: "oprn-title-romance-cafe", credits },
    epilogue: [
      { kind: "say", speaker: "지호", text: "코하루 베이커리 진열대에 새 빵이 생겼다. 이름은 「약속빵」. 모양이 좀 이상한 건 반죽 담당 탓이다." },
      { kind: "say", speaker: "하진", text: "내년 등롱도, 그다음 해도. 이번엔 약속 지킬게." },
    ],
  });
  execTool(project, "define_ending", {
    id: END_YUNA, name: "유나 · 마지막 한 장", priority: 10, conditions: [{ kind: "friendshipAtLeast", npcKey: "yuna", value: TRUE_AT * 100 }],
    presentation: { kicker: "두 사람의 이야기", musicResourceId: BGM_HAPPY, tone: "warm", backgroundResourceId: "oprn-title-romance-town", credits },
    epilogue: [
      { kind: "say", speaker: "유나", text: "현상한 사진은 마츠노유 번대 옆에 걸렸다. 등롱 불빛 앞에서 웃는 사람 하나." },
      { kind: "say", speaker: "하진", text: "내일 아침 전철에서 봐. 같은 칸에서." },
    ],
  });
  execTool(project, "define_ending", {
    id: END_FRIENDS, name: "청춘 · 넷이서 본 등롱", conditions: [],
    presentation: { kicker: "우리들의 이야기", musicResourceId: BGM_FRIENDS, tone: "warm", backgroundResourceId: "oprn-title-romance-school", credits },
    epilogue: [
      { kind: "say", speaker: "서연", text: "축제는 무사히 끝났다. 정리는 넷이서 하니 금방이었다." },
      { kind: "say", speaker: "지호", text: "남은 등롱빵은 우리가 다 먹었고," },
      { kind: "say", speaker: "유나", text: "…넷이서 찍은 사진은, 생각보다 잘 나왔어요." },
      { kind: "say", speaker: "하진", text: "시타마치에서 맞는 네 번째 계절은, 혼자가 아니다." },
    ],
  });
}

export function createShitamachiFourthSeasonFlagshipDemo(): FlagshipDemoBuildResult {
  const project = createBlankProject();
  project.meta.title = "시타마치의 네 번째 계절";
  project.meta.author = "OPRN Flagship Studio";
  // 작은 도트 무대에 매끈한 유리 대화창(첫사랑과 같은 현대 이야기 구성). 연애 기본값이 1024×768 전신 대화창으로 바꾸지 않게 먼저 정한다.
  project.system.playResolution = { width: 480, height: 270 };
  delete project.system.cameraZoom;
  project.system.dialogueStyle = "glass";

  const hero = project.database.actors.find((a) => a.id === DEFAULT_ACTOR_ID) ?? project.database.actors[0];
  if (hero) {
    hero.name = "하진";
    hero.nickname = "돌아온 전학생";
    hero.characterResourceId = CAST.hajin.resource;
    hero.characterIndex = CAST.hajin.index;
    const face = reviewedFaceIdForCharset(CAST.hajin.tex, CAST.hajin.index);
    if (face) hero.faceResourceId = face; else delete hero.faceResourceId;
  }

  const ensureVar = (id: string, name: string): void => { if (!project.variables.some((v) => v.id === id)) project.variables.push({ id, name }); };
  const ensureSw = (id: string, name: string): void => { if (!project.switches.some((s) => s.id === id)) project.switches.push({ id, name }); };
  for (const [id, name] of [[V_STAGE, "시타마치 진행 단계"], [V_DATE, "등롱 길을 함께 걷는 사람"], [V_LANTERNS, "모은 소원 등롱"],
    [V_SEOYEON, "서연 마음 점수"], [V_JIHO, "지호 마음 점수"], [V_YUNA, "유나 마음 점수"]] as const) ensureVar(id, name);
  for (const [id, name] of [[SW_L_SEOYEON, "서연의 소원 등롱"], [SW_L_JIHO, "지호의 소원 등롱"], [SW_L_YUNA, "유나의 소원 등롱"],
    [SW_LIT, "아케이드 등롱 점등"], [SW_PHOTO, "옛 사진을 봄"], [SW_NOTE, "엄마 쪽지를 읽음"], ["sw_sm_gather", "점등식에 셋이 모임"], ["sw_sm_jiho_taste", "지호: 등롱빵 시식"],
    ["sw_sm_train_yuna_off", "전철: 유나 하차"], ["sw_sm_seoyeon_hub_off", "상점가: 서연 사무소로"]] as const) ensureSw(id, name);

  const { arrive, links } = buildMaps(project);
  const trainStart = buildTrain(project, arrive);
  buildHub(project, arrive);
  buildBakery(project, links.bakery);
  buildSento(project, links.sento);
  buildOffice(project, links.office);
  buildHouse(project, links.house);
  const roofArrive = buildRooftop(project, links.rooftop);
  // 점등 뒤 옥상으로 옮기는 명령의 자리를 채운다.
  const fillRoofTransfer = (cmds: unknown): void => {
    if (!Array.isArray(cmds)) return;
    for (const c of cmds as Record<string, unknown>[]) {
      if (c?.kind === "transfer" && c.mapId === M.rooftop) { c.x = roofArrive.x; c.y = roofArrive.y; }
      for (const v of Object.values(c ?? {})) if (Array.isArray(v)) { fillRoofTransfer(v); for (const o of v) if (o && typeof o === "object") fillRoofTransfer((o as Record<string, unknown>).branch); }
    }
  };
  for (const e of project.maps[M.hub]!.events) for (const p of e.pages ?? []) fillRoofTransfer(p.commands);
  execTool(project, "set_title_screen", { title: "시타마치의 네 번째 계절", logoSubtitle: "등롱이 켜지는 밤", backgroundResourceId: "oprn-title-romance-campus", logoStyle: "glow", musicResourceId: BGM_MEMORY });
  defineEndings(project);

  const spot = (mapId: string, eventId: string): Cell => {
    const e = project.maps[mapId]!.events.find((ev) => ev.id === eventId);
    if (!e) throw new Error(`[shitamachi-fourth-season] ${eventId} 가 없다`);
    return { x: e.x, y: e.y };
  };
  buildTitleAndOpening(project, {
    jiho: spot(M.bakery, "ev_sm_jiho"), yuna: spot(M.sento, "ev_sm_yuna"), seoyeon: spot(M.office, "ev_sm_seoyeon_office"), keeper: spot(M.hub, "ev_sm_keeper"),
  });

  // 맵 BGM·조명(조명이 없는 맵은 앞 맵의 조명을 이어 받는다 — 낮 맵은 모두 못 박는다).
  const mapBgm: Record<string, string> = { [M.train]: BGM_CALM, [M.hub]: BGM_DAY, [M.house]: BGM_CALM, [M.bakery]: BGM_DAY, [M.sento]: BGM_CALM, [M.office]: BGM_CALM };
  for (const [id, res] of Object.entries(mapBgm)) project.maps[id]!.bgm = { mode: "custom", resourceId: res } as GameMap["bgm"];
  for (const id of Object.values(M)) { const m = project.maps[id]!; if (!m.defaultLighting) m.defaultLighting = { ambient: 0, color: "#000000", sources: [] }; }
  // 저녁 전철은 노을빛.
  project.maps[M.train]!.defaultLighting = { ambient: 0.18, color: "#ff9a5a", sources: [] };

  project.characters = {
    ...(project.characters ?? {}),
    seoyeon: { displayName: "서연", note: "세이화 학원 학생회장. 등롱 축제를 진흥회 대신 떠맡았다. 부탁을 잘 못 한다." },
    jiho: { displayName: "지호", note: "코하루 베이커리 딸. 하진의 소꿉친구. 십 년 전 약속을 기억한다." },
    yuna: { displayName: "유나", note: "센토 마츠노유 손녀. 같은 통학 전철, 같은 칸. 할머니의 필름 카메라를 든다." },
  };
  project.meta.oprnFieldMenu = { version: 1, entries: [
    { command: "relationships", label: "호감도" }, { command: "backlog", label: "대화 기록" }, { command: "endings", label: "엔딩" },
    { command: "save", label: "저장" }, { command: "load", label: "불러오기" }, { command: "options", label: "설정" }, { command: "to-title", label: "타이틀로" },
  ] };

  project.startMapId = M.train;
  project.startPos = trainStart;
  project.mapTree = {
    mapId: M.hub,
    children: [M.train, M.house, M.bakery, M.sento, M.office, M.rooftop].map((mapId) => ({ mapId, children: [] })),
  };

  // 이야기형 연애 기본값 — 체력 하트 대신 호감 하트, 관계 메뉴, 대사 읽기 보조, 장르 잠금. 하루 루프는 없다.
  applyRomanceDefaults(project, { force: true, dayLoop: false });

  const serialized = serialize(project);
  const reloaded = deserialize(serialized);
  return {
    id: "shitamachi-fourth-season",
    manifest: { ...FLAGSHIP_BEAT_MANIFESTS["shitamachi-fourth-season"], mapCount: Object.keys(reloaded.maps).length, endingCount: reloaded.endings?.length ?? 0 },
    project: reloaded,
    serialized,
  };
}
