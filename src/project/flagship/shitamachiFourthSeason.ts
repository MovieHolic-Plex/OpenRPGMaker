/**
 * 『시타마치의 네 번째 계절』 — 일본 시타마치(下町) 상점가 연애 데모(약 10~15분, 엔딩 넷).
 *
 * 하진은 여덟 살까지 살던 시타마치로 올봄 돌아왔다. 돌아온 지 세 계절, 가을의 끝. 내일 밤은 아케이드 등롱 축제다.
 * 학생회장 서연이 진흥회 일을 떠맡았고, 정문 큰 등롱에 넣을 「소원 등롱」 세 개가 아직 모이지 않았다 —
 * 하나는 소꿉친구 지호네 코하루 베이커리, 하나는 전철에서 늘 마주치는 유나네 센토 「마츠노유」, 하나는 진흥회 사무소의 서연.
 * 셋을 모아 등롱지기 아저씨에게 가져가면 아케이드에 불이 켜지고, 누구와 등롱 길을 걸을지 고른다.
 * 그 사람에게 마음을 전하면, 그동안 쌓인 마음(장면 선택)이 결말을 가른다.
 *
 * 흐름은 변수 하나(var_sm_stage)가 쥔다: 0 전철 → 1 상점가 도착 → 2 등롱 모으기 → 3 점등 뒤 옥상.
 * 2026-10-25 개편 전의 판은 1분 만에 엔딩 넷 중 아무거나 고를 수 있었고, 실내 넷은 순간이동 메뉴로만 가는 빈 방,
 * 넷은 갈 길이 없는 맵이었다(VQA before: tmp/vqa raw-argon-before / raw-sonnet-before). 지금은 거리 문(link_jp_city_interior)
 * 으로 걸어 들어가고, 쓰지 않는 맵은 두지 않는다.
 */
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { reviewedFaceIdForCharset } from "@/assets/reviewedCharsetFaces";
import modernCityRoomSpec from "@/assets/modernCityRoomSpec.json";
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
  keeper: { name: "등롱지기 아저씨", stem: "teacher-tweed", tex: "tex_oprn_charset_modern3", resource: "oprn-charset-modern3", index: 6, side: "right" },
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
  // 화자를 비우면 그 이벤트 인물(characterId) 이름이 붙는다 — 속마음은 하진의 것이라고 못 박는다.
  return [CLEAR_FACE, ...lines.map((body): Command => ({ kind: "text", speaker: CAST.hajin.name, body, position: "bottom", context: "thought" } as Command))];
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
/** 엔딩 그림 — 대사창 뒤로 화면 가득(480×270 무대에 1672×941 그림 = 29%). 맵 위 마지막 장면이 끝나면 이 그림으로 넘어가 엔딩 카드가 뜬다. */
const ENDING_PICTURE = "sm_ending";
const endingPicture = (resourceId: string): Command[] => [
  { kind: "showPicture", pictureId: ENDING_PICTURE, resourceId, x: -4, y: -3, scale: 29, opacity: 255, waitForPicture: false } as Command,
  ...fadeIn(1100),
];
const epiloguePicture = (resourceId: string) => ({ kind: "picture", action: "show", pictureId: ENDING_PICTURE, resourceId, x: -4, y: -3, scale: 29, opacity: 255, durationMs: 1400 });
const ART = {
  seoyeon: "oprn-shitamachi-end-seoyeon", jiho: "oprn-shitamachi-end-jiho", yuna: "oprn-shitamachi-yuna", friends: "oprn-shitamachi-end-friends",
} as const;
/** 이야기 중간의 한 장면 그림(고백 순간·옛 사진) — 대사창 아래에 서서히 떠올랐다가, 다음 장면 전에 서서히 걷힌다. */
const CG_PICTURE = "sm_cg";
const CG = {
  seoyeon: "oprn-shitamachi-roof-seoyeon", jiho: "oprn-shitamachi-roof-jiho", yuna: "oprn-shitamachi-roof-yuna", photo: "oprn-shitamachi-photo",
} as const;
const cgIn = (resourceId: string): Command[] => [
  { kind: "showPicture", pictureId: CG_PICTURE, resourceId, x: -4, y: -3, scale: 29, opacity: 0, waitForPicture: false } as Command,
  { kind: "showPicture", pictureId: CG_PICTURE, resourceId, x: -4, y: -3, scale: 29, opacity: 255, durationMs: 1200, easing: "easeOut", waitForPicture: true } as Command,
];
/** 그림이 화면을 채운 동안에는 흉상을 띄우지 않는다 — 그림 속 인물 위에 같은 사람 흉상이 겹친다. 이름표만 남긴다. */
const overCg = (commands: Command[]): Command[] => [CLEAR_FACE, ...commands.filter((c) => c.kind !== "changeFace")];
const cgOut = (resourceId: string): Command[] => [
  { kind: "showPicture", pictureId: CG_PICTURE, resourceId, x: -4, y: -3, scale: 29, opacity: 0, durationMs: 700, easing: "easeIn", waitForPicture: true } as Command,
  { kind: "erasePicture", pictureId: CG_PICTURE } as Command,
];

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
    { mapId: M.sento, name: "센토 마츠노유", tileset: "modern_city", room: "mc_sento_machi", seed: 1 },
    { mapId: M.office, name: "상점가 진흥회 사무소", tileset: "modern_city", room: "mc_realty", seed: 1 },
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
  // 역에서 걸어 들어오는 자리 — 차도(13~16줄)가 아니라 북쪽 보도(11~12줄) 서쪽 끝. 사람은 보도·가게 앞·문 앞에 선다(2026-10-25 사용자: 길 한가운데 선 NPC).
  const arrive = nearestFree(project, project.maps[M.hub]!, { x: 1, y: 12 });
  return { arrive, links };
}

// ── 장면 ──

/** 0) 저녁 통학 전철 — 같은 칸의 유나. */
function buildTrain(project: Project, arrive: Cell): Cell {
  const map = project.maps[M.train]!;
  const heroAt = nearestFree(project, map, { x: 7, y: 4 });
  const yunaAt = nearestFree(project, map, { x: 12, y: 4 }, [heroAt]);
  const yunaId = "ev_sm_train_yuna";
  // 전철 칸은 화면보다 훨씬 작다 — 배율 1 이면 칸이 갈색 빈 바탕 한가운데 작게 떠 있었다(VQA r1). 이 장면 동안만 당겨 찍고, 내리기 전에 프로젝트 기본 배율로 돌린다.
  const camera = (fields: Record<string, string>): Command => ({ kind: "m2Command", commandId: "m2-201-camera-control", fields } as unknown as Command);
  const scene: Command[] = [
    camera({ mode: "follow", zoom: "1.5", durationMs: "1", wait: "true" }),
    ...fadeIn(800),
    ...caption("가을의 끝, 저녁 통학 전철."),
    ...think(
      "여덟 살 때 떠났던 시타마치로 돌아온 게 올봄이었다.",
      "봄, 여름, 가을. 이 동네에서 맞는 세 번째 계절도 다 지나간다.",
      "…저 애, 오늘도 같은 칸이네.",
    ),
    faceHero(yunaId),
    ...say("yuna", "base", "……."),
    ...caption("유나는 낡은 필름 카메라를 두 손으로 감싸 쥐고 창밖을 보고 있다."), // 지문은 유나의 대사가 아니라 장면 자막이다(VQA r1)
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
    camera({ mode: "return", durationMs: "1", wait: "true" }),
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
      "셋 다 모이면 정문 옆 등롱지기 아저씨한테 가져다드리면 돼."),
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
    ...think("소원 등롱 세 개. 베이커리, 센토, 진흥회 사무소.", "…그 전에 집에 들러 가방부터 놓고 갈까. 우리 집은 아케이드 지나 북쪽 뒷길이다."),
  ];
  hub.events.push(event(seoyeonId, "서연", seoyeonAt, [
    page(`${seoyeonId}_intro`, [varIs(V_STAGE, 1)], intro, { who: "seoyeon", dir: "left", trigger: "auto" }),
    gone(`${seoyeonId}_off`, [swOn("sw_sm_seoyeon_hub_off")]),
  ], "seoyeon"));

  // 등롱지기 아저씨(진흥회 — 공용 흉상에 노인이 없어 삼사십 대 어른으로 쓴다) — 북쪽 아케이드 정문(지붕 덮인 길) 옆.
  // 가게 벽에 붙은 보도 줄(y 11)에 세운다 — 한 줄 아래(y 12)에 두면 말을 걸러 온 하진이 차도(y 13)에 섰다(VQA r1).
  const keeperAt = nearestFree(project, hub, { x: 12, y: 11 });
  const keeperId = "ev_sm_keeper";
  const remaining = (n: number): Command => ifCond(varIs(V_LANTERNS, n), say("keeper", "base", `소원 등롱이 ${n}개 모였네. ${3 - n}개 더 부탁해. 베이커리, 센토, 진흥회 사무소야.`));
  // 점등식에 모인 셋은 정문 기둥 동쪽 보도(y 12)에 아저씨 쪽을 보고 선다. 머리 위 칸이 비어 있는 칸만 쓴다 —
  // 고양이·신호등 기둥 바로 아래 칸에 세우면 32px 키 캐릭터 머리가 그 소품을 덮었다(VQA r1).
  const heroines = [
    { who: "seoyeon" as const, at: { x: 17, y: 12 } },
    { who: "yuna" as const, at: { x: 19, y: 12 } },
    { who: "jiho" as const, at: { x: 20, y: 12 } },
  ].map((h) => ({ ...h, at: nearestFree(project, hub, h.at, [keeperAt, { x: keeperAt.x, y: keeperAt.y + 1 }]) }));
  // 등롱 불빛 — 칩셋이 «초롱»이라고 이름 붙인 칸(아케이드 어귀 아치·지붕 트러스)마다 작고 진한 불, 그리고 가게 문 앞 보도에 처마 등롱 불.
  // 정문 한 곳에 큰 원(반경 5)을 두면 «차가운 스포트라이트»로 읽혔다(VQA r1, Argon·Sonnet 둘 다). 작은 불을 여러 개 켜서 «등롱이 켜졌다»로 읽히게 한다.
  const tileMeta = project.tilesets[hub.tilesetId]?.tileMeta ?? [];
  const lanternRow = new Map<string, Cell>();
  hub.upperTiles?.forEach((t, i) => {
    const label = (typeof t === "number" && t >= 0 ? tileMeta[t]?.label : "") ?? "";
    if (!label.includes("초롱")) return;
    const x = i % hub.width, y = Math.floor(i / hub.width);
    // 4칸 짜리 아치·트러스 한 줄에 등롱 하나(가운데 두 칸 사이) — 같은 줄의 왼쪽 끝(칸 (0,*))에서만 센다.
    if (!/칸 \(0,(0|1)\)/u.test(label)) return;
    if (/칸 \(0,0\)/u.test(label) && label.includes("어귀")) return; // 아치는 등롱이 달린 가운데 줄((0,1))만
    lanternRow.set(`${x},${y}`, { x: x + 1.5, y });
  });
  const doorCells: Cell[] = (hub.locations ?? []).filter((l) => (l.tags ?? []).includes("jp-building") && !(l.note ?? "").includes("닿지 않음")).map((l) => {
    const m = /문 앞 접근칸 \((\d+),(\d+)\)/u.exec(l.note ?? "");
    return m ? { x: Number(m[1]), y: Number(m[2]) - 0.6 } : null;
  }).filter((c): c is Cell => !!c);
  const lanterns = [...lanternRow.values()];
  const lightUp: Command[] = [
    { kind: "setLighting", ambient: 0.62, color: "#141433", transitionMs: 1800 } as Command,
    wait(1800),
    ...lanterns.flatMap((c, i): Command[] => [
      { kind: "addLight", source: { id: `sm_lantern_${i}`, at: c, radius: 2.4, intensity: 1, color: "#ff9a3c", flicker: true } satisfies LightSource } as Command,
      { kind: "addLight", source: { id: `sm_lantern_core_${i}`, at: c, radius: 1.1, intensity: 1, color: "#ffc76a" } satisfies LightSource } as Command,
      ...(i % 2 === 0 ? [playSe(SE_LANTERN), wait(260)] : [wait(120)]),
    ]),
    ...doorCells.map((c, i): Command => ({ kind: "addLight", source: { id: `sm_eave_${i}`, at: c, radius: 2.2, intensity: 0.9, color: "#ffa04a", flicker: true } satisfies LightSource } as Command)),
  ];
  const finale: Command[] = [
    ...say("keeper", "happy", "오, 세 개 다 모였네! 서연이 말대로 든든한데."),
    ...say("keeper", "base", "자, 정문 큰 등롱에 넣어 봐. 이 등롱은 해마다 동네 아이들 소원으로 불을 켜 왔어."),
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
    ...say("keeper", "happy", "등롱 길은 둘이 걸어야 제맛이지. 누구랑 걸을 거야?"),
    choices([
      { text: "서연과 걷는다", then: [setVar(V_DATE, "=", 1)] },
      { text: "지호와 걷는다", then: [setVar(V_DATE, "=", 2)] },
      { text: "유나와 걷는다", then: [setVar(V_DATE, "=", 3)] },
      { text: "다 같이 걷는다", then: [setVar(V_DATE, "=", 4)] },
    ]),
    ifCond(varIs(V_DATE, 4), [
      ...say("seoyeon", "happy", "그래, 오늘은 다 같이!"),
      ...say("jiho", "happy", "그럼 등롱빵 남은 거 다 같이 먹자!"),
      ...say("yuna", "happy", "…넷이서 한 장 찍어요. 마츠노유 계단에서."),
      ...fadeOut(1400),
      ...endingPicture(ART.friends),
      { kind: "triggerEnding", endingId: END_FRIENDS } as Command,
    ], [
      ...say("keeper", "happy", "히카리 맨션 옥상에 올라가 봐. 아케이드 등롱이 한눈에 보이는 자리야."),
      setVar(V_STAGE, "=", 3),
      ...fadeOut(800),
      { kind: "transfer", mapId: M.rooftop, x: 0, y: 0, direction: "up", fade: "black" } as Command, // 좌표는 buildRooftop 이 채운다
    ]),
  ];
  hub.events.push(event(keeperId, "등롱지기 아저씨", keeperAt, [
    page(`${keeperId}_p0`, [], [
      faceHero(keeperId),
      ...say("keeper", "base", "아케이드 정문 등롱은 내일 밤에 켜. 소원 등롱 세 개가 들어가야 불이 붙거든."),
    ], { who: "keeper" }),
    page(`${keeperId}_p2`, [varAtLeast(V_STAGE, 2)], [
      faceHero(keeperId),
      ...say("keeper", "base", "네가 서연이가 말한 그 친구구나."),
      ...[0, 1, 2].map(remaining),
      ifCond(varIs(V_LANTERNS, 3), finale),
    ], { who: "keeper" }),
  ]));
  for (const h of heroines) {
    hub.events.push(event(`ev_sm_gather_${h.who}`, CAST[h.who].name, h.at, [
      gone(`ev_sm_gather_${h.who}_off`, []),
      page(`ev_sm_gather_${h.who}_on`, [swOn("sw_sm_gather")], [...say(h.who, "happy", "등롱, 예쁘다.")], { who: h.who, dir: "left" }),
    ], h.who));
  }
  // 거리 행인 — 저녁 장을 보는 사람들(현대 칩, 사람을 새로 만들지 않는다).
  execTool(project, "add_street_walkers", {
    mapId: M.hub,
    walkers: [
      { name: "장 보는 아주머니", graphic: { selectionId: "charset:oprn-charset-modern3:2" }, stops: [{ x: 2, y: 17 }, { x: 12, y: 17 }, { x: 12, y: 18 }, { x: 2, y: 18 }], lines: ["내일 등롱 축제지? 우리 가게도 등롱 달았어."] },
      { name: "퇴근길 회사원", graphic: { selectionId: "charset:oprn-charset-modern3:0" }, stops: [{ x: 38, y: 18 }, { x: 20, y: 18 }], lines: ["역 앞 고로케집, 오늘도 줄이 길더라."] },
      { name: "하굣길 학생", graphic: { selectionId: "charset:oprn-charset-modern1:1" }, stops: [{ x: 15, y: 3 }, { x: 15, y: 12 }, { x: 30, y: 12 }], lines: ["회장님이 등롱 모으러 다니더라. 너도 도와?"] },
    ],
  });
}

/** 가구 칸(못 걷는 칸)과 그 곁의 설 칸을 확인한다 — 방 생성 결과가 바뀌면 바로 알린다. */
function furnitureCell(project: Project, map: GameMap, prop: Cell, stand: Cell): Cell {
  if (isPassable(project, map, prop.x, prop.y) || !isPassable(project, map, stand.x, stand.y)) {
    throw new Error(`[shitamachi-fourth-season] ${map.id} 가구 칸 (${prop.x},${prop.y}) / 설 칸 (${stand.x},${stand.y}) 이 맞지 않는다 — 방 생성 결과가 바뀌었다`);
  }
  return prop;
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
  // 회의 탁자 왼쪽 빈 바닥 — 탁자 뒤 의자 줄에 세우면 탁자 위에 선 것처럼 보였다(VQA after).
  const at = placeIn(project, M.office, { x: link.entry.x - 4, y: link.entry.y - 7 }, [link.entry, link.exit]);
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
  const after: Command[] = [faceHero(id), ...say("seoyeon", "base", "등롱 셋 다 모이면 등롱지기 아저씨한테 가져가. 정문 옆에 계셔.")];
  project.maps[M.office]!.events.push(event(id, "서연", at, [
    page(`${id}_p1`, [], first, { who: "seoyeon" }),
    page(`${id}_p2`, [swOn(SW_L_SEOYEON)], after, { who: "seoyeon" }),
  ], "seoyeon"));
}

function buildHouse(project: Project, link: { entry: Cell; exit: Cell }): void {
  const map = project.maps[M.house]!;
  // 쪽지는 식탁 위, 사진은 거실 장식장 위 — 가구 칸(못 걷는 칸)에 두고 곁의 복도에서 바라보고 조사한다.
  // 바닥 빈 칸에 투명 이벤트를 두면 플레이어가 어디를 조사할지 모르고, 그 칸을 밟고 지나가 버린다(2026-10-25 플레이).
  const noteAt = furnitureCell(project, map, { x: 15, y: 15 }, { x: 15, y: 14 });
  const photoAt = furnitureCell(project, map, { x: 8, y: 13 }, { x: 8, y: 14 });
  void link;
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
      ...cgIn(CG.photo),
      ...think("코하루 베이커리 앞. 등롱을 든 채 울고 있는 꼬마 지호와, 그 옆에서 어쩔 줄 모르는 나.", "…이사 가던 날이다. 내년엔 같이 등롱 보자고, 그렇게 말했었지."),
      ...cgOut(CG.photo),
      setSw(SW_PHOTO, true),
    ], { priority: "same" }),
  ]));
}

/** 우정 결말로 가는 맵 위 마지막 장면 — 옥상에서 거리로 내려가 넷이 모인다(글), 그다음 마츠노유 계단의 넷 그림. */
function friendsClose(): Command[] {
  return [
    ...caption("휴대폰에 단체 메시지가 뜬다. 「다들 마츠노유 앞 계단으로! 등롱빵 남았대!」"),
    ...think("…가자. 오늘 밤은 넷이서다."),
    ...fadeOut(1400),
    ...endingPicture(ART.friends),
    { kind: "triggerEnding", endingId: END_FRIENDS } as Command,
  ];
}

function buildRooftop(project: Project, link: { entry: Cell; exit: Cell }): Cell {
  const map = project.maps[M.rooftop]!;
  const arrive = link.entry;
  const spot = placeIn(project, M.rooftop, { x: arrive.x, y: arrive.y - 6 }, [link.entry, link.exit]);
  const scenes: Record<1 | 2 | 3, { who: "seoyeon" | "jiho" | "yuna"; variable: string; ending: string; open: Command[]; yes: Command[]; after: Command[]; no: Command[] }> = {
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
      after: [
        ...caption("서연이 주머니에서 접힌 진행표를 꺼낸다. 「담당: 김서연」 옆에, 빈칸이 하나."),
        ...say("seoyeon", "happy", "여기. 네 이름 써. …내일부터는 반씩이야."),
        ...think("아래 거리에서 축제 북소리가 올라온다. 등롱 강이 조금 더 밝아진 것 같았다."),
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
      after: [
        ...caption("지호가 앞치마 주머니에서 종이봉투를 꺼낸다. 아직 따뜻하다."),
        ...say("jiho", "happy", "등롱빵. 하나 남겨 뒀어. 십 년 전에 너 주려던 거랑 같은 모양으로."),
        ...think("반죽이 조금 찌그러져 있었다. 그때도 그랬다."),
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
      after: [
        playSe(SE_CHIME),
        ...caption("셔터 소리. 필름 카운터가 0 으로 넘어간다."),
        ...say("yuna", "base", "현상하면, 제일 먼저 보여 줄게요. 할머니 다음으로."),
        ...think("내일 아침 전철. 같은 칸. 이제는 말을 걸 수 있다."),
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
      ...fadeIn(900), // 점등식 끝의 화면 암전(fadeOut)을 여기서 걷는다 — 없으면 옥상 장면 내내 화면이 검다

      ...caption("히카리 맨션 옥상. 발밑으로 아케이드의 등롱 길이 강처럼 흐른다."),
      approach("@player", heroineId),
      turn(heroineId, "down"),
      ...s.open,
      choices([
        { text: "「좋아해. 이번 계절도, 다음 계절도 너랑 걷고 싶어.」", then: [
          ifCond(varAtLeast(s.variable, TRUE_AT), [
            ...s.yes,
            playSe(SE_HEART),
            ...cgIn(CG[s.who]),
            ...overCg(s.after),
            ...fadeOut(1400),
            { kind: "erasePicture", pictureId: CG_PICTURE } as Command,
            ...endingPicture(ART[s.who]),
            { kind: "triggerEnding", endingId: s.ending } as Command,
          ], [
            ...s.no,
            ...friendsClose(),
          ]),
        ] },
        { text: "「오늘은 그냥, 같이 등롱을 보자.」", then: [
          ...say(s.who, "happy", "…응. 그것도 좋다."),
          ...friendsClose(),
        ] },
      ]),
    ], { trigger: "auto" }));
  }
  map.events.push(event("ev_sm_roof_scene", "옥상 고백", { x: 1, y: 1 }, pages));
  // 밤 옥상 — 도시 불빛과 난간 등.
  // 남쪽 난간 너머로 아케이드 등롱 불빛이 올라온다 — 난간 줄을 따라 따뜻한 빛을 깔아 «아래가 거리»로 읽히게 한다.
  const fenceGlow: LightSource[] = [];
  for (let x = 3; x < map.width - 2; x += 4) {
    const y = map.height - 2;
    fenceGlow.push({ id: `roof_street_${x}`, at: { x, y }, radius: 2.4, intensity: 0.75, color: "#ff9f4a", flicker: true });
  }
  // 지붕 밖(실내 생성기의 «건물 밖» 칸)을 비워 맵 배경이 비치게 하고, 배경에는 상점가 맵을 줄여 깐다 — 난간 너머로 아래 동네가 내려다보인다
  // (VQA: 옥상이 하늘·도시 없이 벽에 갇힌 안뜰로 보였다). 빈 칸 위에는 등롱 불빛을 흩어 «밤의 거리»로 읽히게 한다.
  const VOID_TILE = (modernCityRoomSpec as { void: number }).void;
  const viewLights: LightSource[] = [];
  for (let i = 0; i < map.lowerTiles.length; i++) {
    if (map.lowerTiles[i] !== VOID_TILE) continue;
    map.lowerTiles[i] = -1;
    const x = i % map.width, y = Math.floor(i / map.width);
    if (y > 0 && y < map.height - 1 && x > 0 && x < map.width - 1 && (x * 7 + y * 13) % 11 === 0) {
      viewLights.push({ id: `roof_town_${x}_${y}`, at: { x, y }, radius: 1.6, intensity: 0.85, color: (x + y) % 2 ? "#ffb35a" : "#ff7a4a", flicker: true });
    }
  }
  // 데크 둘레의 천장 띠(실내 벽 윗면)와, 지붕 밖에 면한 북쪽 벽면도 비운다 — 데크가 벽에 둘러싸인 방이 아니라 난간 너머가 트인 옥상으로 읽히게.
  // 탑옥(기계실) 벽은 남긴다. 이름표로 가린다(천장 띠·벽면). 데크 윗줄 = 오른쪽 끝 열에서 바로 위가 빈 칸인 첫 천장 띠 줄.
  const tmeta = project.tilesets[map.tilesetId]?.tileMeta ?? [];
  const labelAt = (i: number): string => { const t = map.lowerTiles[i] ?? -1; return t >= 0 ? tmeta[t]?.label ?? "" : ""; };
  const isBand = (i: number): boolean => labelAt(i).includes("천장 띠");
  const isFace = (i: number): boolean => labelAt(i).includes("벽면");
  let deckTop = -1;
  for (let y = 1; y < map.height && deckTop < 0; y++) if (isBand(y * map.width + map.width - 1) && map.lowerTiles[(y - 1) * map.width + map.width - 1] === -1) deckTop = y;
  if (deckTop < 0) throw new Error("[shitamachi-fourth-season] 옥상 데크 윗줄을 찾지 못했다 — 방 생성 결과가 바뀌었다");
  const clearCell = (i: number): void => { map.lowerTiles[i] = -1; if (map.lowerOverlayTiles) map.lowerOverlayTiles[i] = -1; };
  // 벽을 걷어 낸 칸의 데크 첫 줄에는 난간을 잇는다 — 이미 있는 북쪽 철망 펜스(두 칸 높이)의 위·아래 조각을 그대로 옮겨 찍는다.
  const upperLabel = (i: number): string => { const t = map.upperTiles[i] ?? -1; return t >= 0 ? tmeta[t]?.label ?? "" : ""; };
  let fence: { top: number; base: number } | null = null;
  for (let i = map.width; i < map.lowerTiles.length && !fence; i++) {
    if (upperLabel(i - map.width).includes("철망 펜스") && upperLabel(i).includes("철망 펜스") && i - map.width * 2 >= 0 && !upperLabel(i - map.width * 2).includes("철망 펜스")) {
      fence = { top: map.upperTiles[i - map.width]!, base: map.upperTiles[i]! };
    }
  }
  for (let x = 0; x < map.width; x++) {
    if (map.lowerTiles[(deckTop - 1) * map.width + x] !== -1) continue;
    let y = deckTop;
    for (; y < map.height; y++) { const i = y * map.width + x; if (isBand(i) || isFace(i)) clearCell(i); else break; }
    const base = y * map.width + x, top = base - map.width;
    if (fence && y > deckTop && y < map.height - 1 && (map.upperTiles[base] ?? -1) < 0 && (map.upperTiles[top] ?? -1) < 0) {
      map.upperTiles[top] = fence.top; map.upperTiles[base] = fence.base;
    }
  }
  for (let y = deckTop + 1; y < map.height; y++) for (let x = 0; x < map.width; x++) { const i = y * map.width + x; if (isBand(i)) clearCell(i); }
  map.background = {
    imageId: "",
    fromMap: { mapId: M.hub, scale: 0.34, haze: 0.12, hazeColor: "#2a1d36", desaturate: 0, focusX: 14, focusY: 12 }, // 작게(멀리) — 0.5 는 «옆 마당»처럼 1:1 로 읽혔다(VQA r1)
    cameraFollow: 0.35,
    showInEmptyCells: true,
  };
  map.defaultLighting = {
    ambient: 0.45, color: "#121734",
    sources: [
      // 두 사람 자리에 큰 원 하나(반경 5)는 «차가운 스포트라이트»로 읽혔다(VQA r1) — 계단 탑옥 문등 하나와 난간 너머 거리 불빛만 둔다.
      { id: "roof_door_lamp", at: arrive, radius: 2.6, intensity: 0.75, color: "#ffd9a0", flicker: false },
      ...fenceGlow,
      ...viewLights,
    ],
  };
  map.bgm = { mode: "custom", resourceId: BGM_ROOF } as GameMap["bgm"];
  return arrive;
}

// ── 타이틀·오프닝·엔딩 ──
/**
 * 오프닝 — 이 이야기 전용으로 그린 다섯 장(전철의 유나 → 등롱을 다는 상점가 → 빵집의 지호 → 서류 더미 속 서연 → 불 꺼진 정문 등롱).
 * 2026-10-25 사용자: 게임 맵을 그대로 잘라 보이던 앞 오프닝은 「에디터 기본 오프닝 같다·헷갈린다」. 그림은 조수 도구로 깔고(place_opening_background
 * sampling:linear), 카메라는 천천히 밀고(animate_opening_camera), 자막은 한 컷에 한 문장(그 컷에 보이는 것만).
 */
function buildTitleAndOpening(project: Project): void {
  if (project.system.titleScreen) project.system.titleScreen.backgroundFit = "cover";
  project.system.opening = { enabled: true, skippable: true, scenes: [] };
  const STAGE = { width: 480, height: 270 };
  const shots: { id: string; art: string; ms: number; from: { x: number; y: number; zoom: number }; to: { x: number; y: number; zoom: number }; cues: { atMs: number; text: string }[] }[] = [
    { id: "sm_op_train", art: "oprn-shitamachi-op-train", ms: 7200, from: { x: 240, y: 128, zoom: 1 }, to: { x: 262, y: 126, zoom: 1.08 },
      cues: [{ atMs: 400, text: "십 년 만에 돌아온 동네, 도쿄 시타마치." }, { atMs: 3800, text: "같은 칸에는 늘 필름 카메라를 든 애가 있다. 유나." }] },
    { id: "sm_op_arcade", art: "oprn-shitamachi-op-arcade", ms: 6800, from: { x: 240, y: 140, zoom: 1.1 }, to: { x: 240, y: 128, zoom: 1.02 },
      cues: [{ atMs: 400, text: "내일 밤은 등롱 축제. 상점가가 등롱을 단다." }] },
    { id: "sm_op_bakery", art: "oprn-shitamachi-op-bakery", ms: 6800, from: { x: 232, y: 135, zoom: 1.02 }, to: { x: 214, y: 132, zoom: 1.1 },
      cues: [{ atMs: 400, text: "코하루 베이커리의 지호." }, { atMs: 3200, text: "십 년 전의 약속을, 지호는 아직 기억할까." }] },
    { id: "sm_op_office", art: "oprn-shitamachi-op-office", ms: 6800, from: { x: 240, y: 132, zoom: 1.04 }, to: { x: 232, y: 124, zoom: 1.12 },
      cues: [{ atMs: 400, text: "축제 준비를 혼자 떠안은 학생회장, 서연." }] },
    { id: "sm_op_gate", art: "oprn-shitamachi-op-gate", ms: 8200, from: { x: 240, y: 140, zoom: 1.08 }, to: { x: 240, y: 128, zoom: 1 },
      cues: [{ atMs: 400, text: "정문 큰 등롱에 소원 등롱 세 개가 모이면, 불이 켜진다." }, { atMs: 4600, text: "시타마치의 네 번째 계절." }] },
  ];
  for (const s of shots) {
    execTool(project, "create_opening_animatic_shot", { shotId: s.id, durationMs: s.ms, width: STAGE.width, height: STAGE.height, background: "#0b0a14", replace: true, clearLayers: true });
    execTool(project, "place_opening_background", { shotId: s.id, layerId: "art", resourceId: s.art, sampling: "linear" });
    execTool(project, "animate_opening_camera", { shotId: s.id, camera: { from: s.from, to: s.to } });
    execTool(project, "set_opening_transition", { shotId: s.id, transition: { kind: "fade", durationMs: 900 }, letterbox: 0.11 });
    execTool(project, "set_opening_caption", { shotId: s.id, layerId: "caption", letterbox: 0.11, color: "#fff4e6", fontSize: 13, fadeOutMs: 500, cues: s.cues.map((c) => ({ ...c, typewriterMs: 900 })) });
  }
  const opening = project.system.opening!;
  opening.musicResourceId = BGM_MEMORY;
  for (const scene of opening.scenes) if (scene.kind === "animatic") scene.narration = "";
}

/**
 * 엔딩 — 맵 위 마지막 장면(옥상·거리) → 그 결말 전용 그림 → 에필로그(그림 위 대사창: 그날 이후 + 네 사람 각자의 매듭) → 엔딩 카드.
 * 2026-10-25 사용자: 앞 엔딩은 대사 두 줄과 다른 게임 그림(서울 사옥·교실)뿐이라 「약하다」.
 */
function defineEndings(project: Project): void {
  const credits = [
    "『시타마치의 네 번째 계절』",
    "",
    "이야기 · 연출   OPRN Flagship Studio",
    "도트 · 인물   OPRN 시타마치 거리 · 현대 실내 · 공용 초상",
    "타이틀 · 오프닝 · 엔딩 그림   OPRN 생성 일러스트(감독 선택)",
    "음악 · 효과음   CC0 음원",
    "",
    "만든 도구   OPRN Studio",
    "",
    "등롱 길을 함께 걸어 주셔서 고맙습니다.",
  ].join("\n");
  const n = (text: string) => ({ kind: "say", text });
  const v = (speaker: string, text: string) => ({ kind: "say", speaker, text });
  execTool(project, "define_ending", {
    id: END_SEOYEON, name: "서연 · 학생회장이 아닌 날", priority: 10, conditions: [{ kind: "friendshipAtLeast", npcKey: "seoyeon", value: TRUE_AT * 100 }],
    presentation: { kicker: "두 사람의 이야기", musicResourceId: BGM_HAPPY, tone: "warm", portraits: "none", backgroundResourceId: ART.seoyeon, credits },
    epilogue: [
      epiloguePicture(ART.seoyeon),
      n("다음 날, 축제 본 행사의 밤. 정문 큰 등롱 아래로 사람들이 끝없이 지나간다."),
      v("서연", "진행표, 반은 네 이름으로 써 뒀어. 도망 못 가."),
      v("하진", "도망 안 가. 다음 계절에도 반씩 나누자. 서류도, 등롱도."),
      n("지호는 등롱빵 삼백 개를 다 팔았다. 내년엔 사백 개라고 벼른다."),
      n("유나의 마지막 필름에는 진행표를 들고 웃는 학생회장이 찍혀 있었다."),
      n("시타마치의 네 번째 계절. 서연은 처음으로, 혼자가 아니었다."),
    ],
  });
  execTool(project, "define_ending", {
    id: END_JIHO, name: "지호 · 십 년 늦은 약속", priority: 10, conditions: [{ kind: "friendshipAtLeast", npcKey: "jiho", value: TRUE_AT * 100 }],
    presentation: { kicker: "두 사람의 이야기", musicResourceId: BGM_HAPPY, tone: "warm", portraits: "none", backgroundResourceId: ART.jiho, credits },
    epilogue: [
      epiloguePicture(ART.jiho),
      n("축제 다음 날 아침, 코하루 베이커리."),
      v("지호", "자, 약속빵. 십 년 치 이자까지 쳐서 두 개."),
      v("하진", "내년 등롱도, 그다음 해도. 이번엔 약속 지킬게."),
      n("서연은 축제 보고서를 하룻밤에 끝냈다. 이번엔 진흥회 어른들과 나눠서."),
      n("유나는 첫 전철 창밖으로, 아직 걸려 있는 등롱을 찍었다."),
      n("진열대에 새 빵이 생겼다. 이름은 「약속빵」. 모양이 좀 이상한 건 반죽 담당 탓이다."),
    ],
  });
  execTool(project, "define_ending", {
    id: END_YUNA, name: "유나 · 마지막 한 장", priority: 10, conditions: [{ kind: "friendshipAtLeast", npcKey: "yuna", value: TRUE_AT * 100 }],
    presentation: { kicker: "두 사람의 이야기", musicResourceId: BGM_HAPPY, tone: "warm", portraits: "none", backgroundResourceId: ART.yuna, credits },
    epilogue: [
      epiloguePicture(ART.yuna),
      n("일주일 뒤, 마츠노유 번대 옆에 현상한 사진 한 장이 걸렸다."),
      v("유나", "할머니가, 잘 찍었대요. 등롱보다 사람이 더 밝게 나왔다고."),
      v("하진", "내일 아침 전철에서 봐. 같은 칸에서."),
      n("서연은 내년 축제 사진 담당으로 유나의 이름을 적었다."),
      n("지호는 사진 속 등롱빵이 제일 잘 나왔다고 우겼다."),
      n("같은 전철, 같은 칸. 이제 둘은 창밖 대신 서로를 본다."),
    ],
  });
  execTool(project, "define_ending", {
    id: END_FRIENDS, name: "청춘 · 넷이서 본 등롱", conditions: [],
    presentation: { kicker: "우리들의 이야기", musicResourceId: BGM_FRIENDS, tone: "warm", portraits: "none", backgroundResourceId: ART.friends, credits },
    epilogue: [
      epiloguePicture(ART.friends),
      n("마츠노유 앞 나무 계단. 남은 등롱빵 여섯 개를 넷이서 나눴다."),
      v("서연", "축제는 무사히 끝났어. 정리도 넷이서 하니 금방이었고."),
      v("지호", "내년엔 등롱빵 사백 개야. 다들 반죽 도와!"),
      v("유나", "…넷이서 찍은 사진, 생각보다 잘 나왔어요. 번대 옆에 걸어 둘게요."),
      v("하진", "시타마치에서 맞는 네 번째 계절은, 혼자가 아니다."),
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
  execTool(project, "set_title_screen", { title: "시타마치의 네 번째 계절", logoSubtitle: "등롱이 켜지는 밤", backgroundResourceId: "oprn-shitamachi-title", logoStyle: "gold", menuStyle: "plain", musicResourceId: BGM_MEMORY }); // glow·창 메뉴는 에디터 기본(차가운 파란 창)으로 읽혔다(VQA r1) — 등롱 빛 금빛 글자, 창 없는 글자 메뉴
  defineEndings(project);

  buildTitleAndOpening(project);

  // 맵 BGM·조명(조명이 없는 맵은 앞 맵의 조명을 이어 받는다 — 낮 맵은 모두 못 박는다).
  const mapBgm: Record<string, string> = { [M.train]: BGM_CALM, [M.hub]: BGM_DAY, [M.house]: BGM_CALM, [M.bakery]: BGM_DAY, [M.sento]: BGM_CALM, [M.office]: BGM_CALM };
  for (const [id, res] of Object.entries(mapBgm)) project.maps[id]!.bgm = { mode: "custom", resourceId: res } as GameMap["bgm"];
  for (const id of Object.values(M)) { const m = project.maps[id]!; if (!m.defaultLighting) m.defaultLighting = { ambient: 0, color: "#000000", sources: [] }; }
  // 저녁 전철은 노을빛.
  project.maps[M.train]!.defaultLighting = { ambient: 0.32, color: "#ff8a4a", sources: [] };

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
  // HUD — 연애 기본(호감 하트 판)이 아니라 이 이야기의 목표 하나: 모은 소원 등롱 n/3. 처음 하나를 받기 전에는 숨는다(nonzero).
  // 2026-10-25 사용자: 「기본 HUD 쓰지 말고 어울리는 걸 만들거나 꺼라」. 조수 도구 set_project_settings.fieldHud 로 깐다.
  execTool(project, "set_project_settings", { fieldHud: { widgets: [
    { id: "lanterns", kind: "gauge", source: "variable", variableId: V_LANTERNS, max: 3, shape: "number", label: "소원 등롱", anchor: "top-left", x: 6, y: 6, width: 96, height: 26, panel: "paper", color: "#e8823a", condition: "nonzero" },
  ] } });
  // 남은 편집기 기본값 — 시스템 타이틀 그림(눈 덮인 들판)·기본 필드 곡을 이 게임 것으로. 대사창·ESC 메뉴는 따뜻한 종이 노트 룩 한 벌(set_vn_look).
  execTool(project, "set_project_settings", { resources: { titleResourceId: "oprn-shitamachi-title", defaultBgmResourceId: BGM_DAY } });
  execTool(project, "set_vn_look", { setting: "cafe", uiTheme: "match" });

  // 새 프로젝트는 번들 칩셋 46개(참고문서 포함 약 70MB)를 모두 들고 태어난다. 이 데모가 쓰는 칩셋(맵 칩셋과 그 이식 원본)만 남긴다 —
  // 편집기에서 열면 ensureBundledTilesets 가 나머지를 다시 붙이므로 저자는 잃는 것이 없다(데모 project.json 61MB 실측).
  const keepTilesets = new Set(Object.values(project.maps).map((m) => m.tilesetId));
  for (const id of [...keepTilesets]) {
    for (const graft of project.tilesets[id]?.tileGrafts ?? []) keepTilesets.add(graft.sourceChipset);
  }
  for (const id of Object.keys(project.tilesets)) if (!keepTilesets.has(id)) delete project.tilesets[id];

  const serialized = serialize(project);
  const reloaded = deserialize(serialized);
  return {
    id: "shitamachi-fourth-season",
    manifest: { ...FLAGSHIP_BEAT_MANIFESTS["shitamachi-fourth-season"], mapCount: Object.keys(reloaded.maps).length, endingCount: reloaded.endings?.length ?? 0 },
    project: reloaded,
    serialized,
  };
}
