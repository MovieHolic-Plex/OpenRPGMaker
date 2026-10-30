/**
 * 『이상 없음』 — 밤 학교 추격 호러 데모(약 20~25분, 엔딩 둘). 설계서 docs/games/school/design.md.
 *
 * 11월 밤, 사쿠라자카 중학교. 일직을 하다 2-B 교실에서 잠든 하야세 린이 깨어 보니 오후 9시 40분이다. 현관은 쇠사슬로 잠겼고,
 * 복도에는 숙직 사에키 선생의 손전등이 오간다. 들키면 「찾았다.」 — 화면이 꺼진다.
 * 교무실 열쇠함 번호는 「그날」이다. 30년 전 11월 7일, 선생은 옥상을 확인하지 않고 「옥상 이상 없음」이라고 적었다.
 *
 * 흐름은 변수 하나(var_nr_stage)가 쥔다. 사에키는 층마다 다른 추격자 이벤트(같은 인물 프로필)이고, 단계 스위치가 페이지를 켠다.
 * 모든 장치는 조수 도구(make_chase_scene · set_field_detection · set_lighting_volume · compile_puzzle · define_ending ·
 * set_game_over · build_hand_interior_room · compose_jp_region · link_jp_city_interior …)로 짓는다. 새 그림은 없다.
 * 인물·학교·사건은 모두 지어낸 것이다.
 */
import { DEFAULT_ACTOR_ID } from "@/project/defaults/constants";
import { createBlankProject } from "@/project/defaults";
import { blankFillTileFor, createStarterMap } from "@/project/defaults/defaultMaps";
import { createJpCityTileset, JP_CITY_ID } from "@/project/defaults/jpCity";
import { isPassable } from "@/project/collision";
import { deserialize, serialize } from "@/project/io";
import type { Command, Dir, GameEvent, Project } from "@/project/types";
import { FLAGSHIP_BEAT_MANIFESTS } from "./beats";
import {
  bark, bgs, blackNow, caption, type Cell, event, execTool, face, fadeIn, fadeOut, flash, giveItem, gone, hasItem, hidePlayer, ifCond,
  type Look, mustReach, note, page, playSe, setSw, setVar, showPlayer, stopBgs, swOff, swOn, think, transfer, varAtLeast, varBelow,
  varIs, voice, wait, walk, walkTo,
} from "./nothingToReportKit";
import { applyNothingToReportLore } from "./nothingToReportLore";
import { buildNothingToReportOpening } from "./nothingToReportOpening";
import type { FlagshipDemoBuildResult } from "./types";
import school1f from "../../../tiledata/jp-city/interior/examples/school-1f.json";
import school2f from "../../../tiledata/jp-city/interior/examples/school-2f.json";
import school3f from "../../../tiledata/jp-city/interior/examples/school-3f.json";
import schoolRoof from "../../../tiledata/jp-city/interior/examples/school-roof.json";

// ── 맵 ──
export const NR_MAP = { f1: "map_nr_1f", f2: "map_nr_2f", f3: "map_nr_3f", roof: "map_nr_roof", yard: "map_nr_yard" } as const;

// ── 인물(걷기 칩 — 설계 §2) ──
const RIN: Look = { tex: "tex_oprn_charset_modern2", index: 0 };
const SAEKI: Look = { tex: "tex_oprn_charset_modern3", index: 6 };
const SAYO: Look = { tex: "tex_oprn_charset_modern1", index: 5, add: true };
const SAEKI_NAME = "사에키 선생";
const SAYO_NAME = "마키노 사요";

// ── 상태 ──
const V_STAGE = "var_nr_stage";
/** 흐름 단계. */
const S = { WAKE: 0, ROOM: 1, CORRIDOR: 2, FIRST_HIDE_DONE: 3, KEYS: 5 } as const;
const SW_FLASHLIGHT = "sw_nr_flashlight";
const SW_SAEKI_2F = "sw_nr_saeki_2f";
const SW_SAEKI_1F = "sw_nr_saeki_1f";
const SW_SAEKI_HUNT = "sw_nr_saeki_hunt";
const SW_SAYO = "sw_nr_sayo";
const SW_SAYO_DONE = "sw_nr_sayo_done";
const SW_PIANO = "sw_nr_piano";
const SW_KEYBOX = "sw_nr_keybox_open";
const SW_CHAIN = "sw_nr_chain_off";
const SW_ROOF_OPEN = "sw_nr_roof_open";
const SW_YARD_SAEKI = "sw_nr_yard_saeki";
const SW_STAIR_SCARE = "sw_nr_stair_scare";
const SW_SAW_BOOK = "sw_nr_saw_book";
const SW_SAW_PA = "sw_nr_saw_pa";
const SW_SAW_PHONE = "sw_nr_saw_phone";
const SW_SAW_KEYNOTE = "sw_nr_saw_keynote";
const SW_SAW_CARD = "sw_nr_saw_card";

// ── 아이템 ──
const IT_FLASH = "item_nr_flashlight";
const IT_PAGE1 = "item_nr_page1";
const IT_PAGE2 = "item_nr_page2";
const IT_PAGE3 = "item_nr_page3";
const IT_KEY_DOOR = "item_nr_key_entrance";
const IT_KEY_ROOF = "item_nr_key_roof";

// ── 엔딩 ──
const END_A = "end_nr_home";
const END_B = "end_nr_report";

// ── 소리(모두 번들 CC0/EasyRPG, 공포 합성은 조수 도구가 굽는다) ──
const SE = {
  chime: "easyrpg-sound-chime2",
  paper: "cc0-se-osx-paper-02",
  paper2: "cc0-se-osx-paper-04",
  drawer: "cc0-se-osx-wooden-01",
  click: "cc0-se-osx-switch-01",
  slide: "cc0-se-osx-door-02",
  doorOpen: "cc0-se-osx-door-open",
  doorClose: "cc0-se-osx-door-close-02",
  chain: "cc0-se-ors-chain-02",
  lock: "cc0-se-ors-lock-02",
  key: "cc0-se-osx-key-open-01",
  metal: "cc0-se-osx-metal-01",
  clock: "easyrpg-sound-clock",
  wind: "easyrpg-sound-wind8",
  dark: "easyrpg-sound-darkness4",
} as const;
const BGM_END_A = "cc0-bgm-rtp-rst-003";
const BGM_END_B = "cc0-bgm-rtp-mys-002";

// ── 빛 ──
const NIGHT = { ambient: 0.9, color: "#0a0f1e" } as const;
const FLASH_CONE = { id: "nr_flashlight", at: { kind: "player" }, radius: 6, intensity: 0.95, color: "#fff4d8", cone: { degrees: 60 }, when: { switchId: SW_FLASHLIGHT } };
const FLASH_FEET = { id: "nr_flashlight_feet", at: { kind: "player" }, radius: 1.3, intensity: 0.45, color: "#fff4d8", when: { switchId: SW_FLASHLIGHT } };
const EYES = { id: "nr_eyes", at: { kind: "player" }, radius: 1.6, intensity: 0.22, color: "#7f8fb8" };
const moon = (id: string, x: number, y: number, r = 2.6) => ({ id, at: { x, y }, radius: r, intensity: 0.32, color: "#6f86c8" });
const exitSign = (id: string, x: number, y: number) => ({ id, at: { x, y }, radius: 1.6, intensity: 0.55, color: "#3ee07a", flicker: 0.12 });

function addEvents(project: Project, mapId: string, ...events: GameEvent[]): void {
  project.maps[mapId]!.events.push(...events);
}

function exec(project: Project, name: string, args: Record<string, unknown>) {
  return execTool(project, name, args);
}

// ─────────────────────────────────────────────────────────────────────────
// 맵
// ─────────────────────────────────────────────────────────────────────────
type RoomJson = { name: string; plan: string[]; floor: string; wall: string; zones?: unknown[]; objects?: unknown[]; tables?: unknown[]; goods?: unknown[]; start: [number, number]; links: { x: number; y: number; toMapId: string; toX: number; toY: number; direction?: string }[]; exitWidth?: number };
const PLACE_TO_MAP: Record<string, string> = {
  "jp-city-school-1f": NR_MAP.f1, "jp-city-school-2f": NR_MAP.f2, "jp-city-school-3f": NR_MAP.f3, "jp-city-school-roof": NR_MAP.roof,
};

function buildMaps(project: Project): void {
  project.tilesets[JP_CITY_ID] = createJpCityTileset();
  const floors: [string, RoomJson, string][] = [
    [NR_MAP.f1, school1f as unknown as RoomJson, "사쿠라자카 중 · 1층"],
    [NR_MAP.f2, school2f as unknown as RoomJson, "사쿠라자카 중 · 2층"],
    [NR_MAP.f3, school3f as unknown as RoomJson, "사쿠라자카 중 · 3층"],
    [NR_MAP.roof, schoolRoof as unknown as RoomJson, "사쿠라자카 중 · 옥상"],
  ];
  // 층이 여럿이면 ① links 없이 모두 짓고 ② 같은 mapId·replace:true 로 links 를 넣어 다시 짓는다(도구 안내 그대로).
  for (const withLinks of [false, true]) {
    for (const [mapId, f] of floors) {
      exec(project, "build_hand_interior_room", {
        tileset: "jp_city", mapId, name: f.name, replace: true,
        plan: f.plan, floor: f.floor, wall: f.wall, zones: f.zones ?? [], objects: f.objects ?? [], tables: f.tables ?? [], goods: f.goods ?? [],
        ...(f.exitWidth ? { exitWidth: f.exitWidth } : {}),
        start: [{ x: f.start[0], y: f.start[1] }],
        ...(withLinks ? { links: f.links.map((l) => ({ ...l, toMapId: PLACE_TO_MAP[l.toMapId] ?? l.toMapId })) } : {}),
      });
    }
  }
  for (const [mapId, , name] of floors) project.maps[mapId]!.name = name;

  // 운동장: 학교 운동장 지역(52×40) — 교사(1층 현관 문 (11,11)), 체육관, 교문(남쪽 담 x 41~44).
  const yard = createStarterMap();
  yard.id = NR_MAP.yard; yard.name = "운동장"; yard.tilesetId = JP_CITY_ID; yard.width = 52; yard.height = 40;
  yard.lowerTiles = new Array(52 * 40).fill(blankFillTileFor(JP_CITY_ID));
  yard.upperTiles = new Array(52 * 40).fill(-1);
  yard.events = [];
  project.maps[NR_MAP.yard] = yard;
  exec(project, "compose_jp_region", { mapId: NR_MAP.yard, region: "high_school_grounds", seed: 1, replace: true });
  project.maps[NR_MAP.yard]!.name = "사쿠라자카 중 · 운동장";
}

/** 1층 현관(昇降口) 아래 출입구 → 운동장 교사 문. 문 앞에서 문 쪽으로 밀어야 들어간다(#3973). */
function linkYard(project: Project): void {
  exec(project, "link_jp_city_interior", { mapId: NR_MAP.yard, door: { x: 11, y: 11 }, interiorMapId: NR_MAP.f1, replace: true });
}

// ─────────────────────────────────────────────────────────────────────────
// 빛
// ─────────────────────────────────────────────────────────────────────────
function lightMaps(project: Project): void {
  exec(project, "set_lighting_volume", { mapId: NR_MAP.f2, ...NIGHT, sources: [
    EYES, FLASH_CONE, FLASH_FEET,
    // 교실 창(북쪽 벽)으로 드는 달빛.
    moon("m_a1", 3, 3), moon("m_a2", 8, 3), moon("m_b1", 14, 3), moon("m_b2", 20, 3),
    // 복도 끝 초록 비상구 등(계단 쪽) — 계단참에 사람이 서면 그 빛이 가려진다.
    exitSign("exit_e", 23, 15), exitSign("exit_w", 1, 16),
  ] });
  exec(project, "set_lighting_volume", { mapId: NR_MAP.f1, ...NIGHT, sources: [
    EYES, FLASH_CONE, FLASH_FEET,
    moon("m_staff", 9, 3), moon("m_nurse", 17, 4, 2.2),
    // 현관 유리문 너머 가로등.
    { id: "street", at: { x: 13, y: 19 }, radius: 3.2, intensity: 0.4, color: "#ffc98a" },
    exitSign("exit_genkan", 12, 15), exitSign("exit_stair", 22, 12),
  ] });
  exec(project, "set_lighting_volume", { mapId: NR_MAP.f3, ...NIGHT, sources: [
    EYES, FLASH_CONE, FLASH_FEET,
    moon("m_music", 3, 4), moon("m_lib", 14, 4), moon("m_lab", 22, 4),
    exitSign("exit_stair3", 22, 13),
  ] });
  exec(project, "set_lighting_volume", { mapId: NR_MAP.roof, ambient: 0.62, color: "#141a33", sources: [
    EYES, FLASH_CONE, FLASH_FEET,
    { id: "moon_roof", at: { x: 7, y: 6 }, radius: 7, intensity: 0.35, color: "#8ea3e0" },
  ] });
  exec(project, "set_lighting_volume", { mapId: NR_MAP.yard, ambient: 0.82, color: "#0b1226", sources: [
    EYES, FLASH_CONE, FLASH_FEET,
    { id: "gate_lamp", at: { x: 42, y: 37 }, radius: 4, intensity: 0.55, color: "#ffc98a" },
    { id: "lamp_mid", at: { x: 30, y: 22 }, radius: 3, intensity: 0.28, color: "#ffd8a0" },
    exitSign("exit_door", 11, 10),
  ] });
}

// ─────────────────────────────────────────────────────────────────────────
// 아이템·DB
// ─────────────────────────────────────────────────────────────────────────
function defineItems(project: Project): void {
  const item = (id: string, name: string, description: string) => exec(project, "upsert_item", { item: { id, name, description, type: "special", price: 0, consumable: false } });
  item(IT_FLASH, "손전등", "교탁 서랍에 있던 작은 손전등. 앞쪽 부채꼴만 밝힌다. 빛은 멀리서도 보인다.");
  item(IT_PAGE1, "숙직 일지 낱장 · 11월 7일", "「11월 7일. 3층 이상 없음. 음악실 이상 없음. 옥상 이상 없음.」 글씨가 반듯하다. 옥상 칸만 펜 눌림이 얕다.");
  item(IT_PAGE2, "숙직 일지 낱장 · 11월 8일", "「11월 8일 아침. 옥상 철문, 바깥 빗장이 걸려 있었음. 누가 걸었는지 모름.」 아래 줄은 몇 번이고 지웠다.");
  item(IT_PAGE3, "숙직 일지 낱장 · 그 뒤", "「11월 7일. 이상 없음. 11월 7일. 이상 없음.」 같은 날짜가 종이 끝까지 이어진다. 해가 바뀌어도 날짜는 그대로다.");
  item(IT_KEY_DOOR, "현관 열쇠", "꼬리표에 「昇降口」. 현관 유리문 쇠사슬 자물쇠에 맞는다.");
  item(IT_KEY_ROOF, "옥상 열쇠", "꼬리표에 「屋上」. 녹이 슬어 있다. 오래 쓰지 않은 열쇠다.");

  const ensureVar = (id: string, name: string) => { if (!project.variables.some((v) => v.id === id)) project.variables.push({ id, name }); };
  const ensureSw = (id: string, name: string) => { if (!project.switches.some((s) => s.id === id)) project.switches.push({ id, name }); };
  ensureVar(V_STAGE, "이상 없음 진행 단계");
  for (const [id, name] of [
    [SW_FLASHLIGHT, "손전등 켜짐"], [SW_SAEKI_2F, "사에키: 2층 순찰"], [SW_SAEKI_1F, "사에키: 1층 순찰"], [SW_SAEKI_HUNT, "사에키: 열쇠함 소리 뒤 추적"],
    [SW_SAYO, "사요: 3층에 나타남"], [SW_SAYO_DONE, "사요: 3층을 떠남"], [SW_PIANO, "음악실 피아노 한 음"], [SW_KEYBOX, "열쇠함 열림"],
    [SW_CHAIN, "현관 쇠사슬 풀림"], [SW_ROOF_OPEN, "옥상 철문 열림"], [SW_YARD_SAEKI, "운동장: 사에키가 나옴"], [SW_STAIR_SCARE, "계단참 손전등"],
    [SW_SAW_BOOK, "일직 일지를 읽음"], [SW_SAW_PA, "방송 스피커를 봄"], [SW_SAW_PHONE, "휴대폰이 꺼져 있음"], [SW_SAW_KEYNOTE, "열쇠함 메모를 읽음"], [SW_SAW_CARD, "대출 카드를 읽음"],
  ] as const) ensureSw(id, name);
}

// ─────────────────────────────────────────────────────────────────────────
// 2층 — B0 방송 · B1 일직 일지·손전등 · B2 첫 손전등·첫 숨기
// ─────────────────────────────────────────────────────────────────────────
const F2 = {
  wake: { x: 17, y: 7 },        // 2-B 책상 사이 통로(깨어나는 자리)
  bookDesk: { x: 18, y: 6 },    // 린의 앞자리 책상 위 일직 일지 — (17,6) 에서 조사
  deskB: { x: 16, y: 4 },       // 2-B 교탁(서랍 손전등)
  lockerA: { x: 10, y: 11 },
  lockerB: { x: 12, y: 11 },
  lockerHall: { x: 15, y: 15 },
  doorB: { x: 13, y: 15 },      // 2-B 서쪽 문 바로 아래(복도로 나가는 칸)
  pa: { x: 20, y: 2 },          // 2-B 칠판 옆 스피커(벽) — (20,3) 에서 조사
  stairLanding: { x: 22, y: 16 },
  patrolEast: { x: 22, y: 17 },
  patrolWest: { x: 2, y: 17 },
} as const;

function build2F(project: Project): void {
  const map = project.maps[NR_MAP.f2]!;
  mustReach(project, map, F2.wake, F2.doorB, "2-B 교실에서 복도로");
  mustReach(project, map, F2.doorB, F2.patrolWest, "2층 복도 서쪽 끝");

  // B0 — 깨어나기. 검은 화면, 방송 차임, 9시 40분.
  const wake: Command[] = [
    blackNow(), hidePlayer(), wait(900),
    playSe(SE.chime, 0.7), wait(2600),
    ...voice("교내 방송", "오후 9시 40분입니다. 남아 있는 학생은 교실로 돌아가세요."),
    wait(700),
    ...voice("교내 방송", "…돌아가세요."),
    wait(1200),
    showPlayer(), ...fadeIn(1800),
    ...caption("11월 · 사쿠라자카 중학교 2학년 B반"),
    ...think("책상에 엎드린 채 잠들었다. 창밖이 까맣다.", "일직 일지를 쓰다가… 몇 시지."),
    setVar(V_STAGE, "=", S.ROOM),
  ];
  addEvents(project, NR_MAP.f2, event("ev_nr_wake", "깨어남", { x: 1, y: 3 }, [page("p_wake", [varIs(V_STAGE, S.WAKE)], wake, { trigger: "auto" })]));

  // 휴대폰(주인공 자리 책상) — 꺼져 있다.
  addEvents(project, NR_MAP.f2, event("ev_nr_phone", "내 책상", { x: 18, y: 7 }, [
    page("p_phone", [], [
      ...think("책상 서랍 속 휴대폰. 화면을 눌러도 까맣다. 배터리가 다 됐다."),
      setSw(SW_SAW_PHONE, true),
    ]),
  ]));

  // 방송 스피커 — 방금 그 방송. 아무도 방송실에 없을 시간이다.
  addEvents(project, NR_MAP.f2, event("ev_nr_pa", "방송 스피커", F2.pa, [
    page("p_pa", [], [
      ...think("칠판 위 스피커. 방송은 끝났는데, 지직거리는 소리가 아주 작게 남아 있다.", "방송실은 1층 교무실 옆이다. 이 시간에 누가."),
      setSw(SW_SAW_PA, true),
    ]),
  ]));

  // B1 — 2-A 교탁의 일직 일지(내 이름). 2-B 교탁 서랍의 손전등.
  addEvents(project, NR_MAP.f2, event("ev_nr_duty_book", "일직 일지", F2.bookDesk, [
    page("p_book", [], [
      playSe(SE.paper, 0.6),
      ...note("일직 일지 · 2학년", "11월 6일 — 일직: 미야모토. 특이 사항 없음.", "11월 7일 — 일직: 하야세 린. (빈칸)"),
      ...think("오늘 칸이 비어 있다. 이걸 쓰다가 잠들었다."),
      ...note("일직 일지 · 맨 아래, 다른 글씨", "다음 일직: 하야세."),
      ...think("…내일 일직도 나라고? 이런 글씨, 처음 본다."),
      setSw(SW_SAW_BOOK, true),
    ]),
  ]));
  addEvents(project, NR_MAP.f2, event("ev_nr_flash_drawer", "교탁 서랍", F2.deskB, [
    page("p_drawer", [], [
      playSe(SE.drawer, 0.6), wait(300),
      ...think("교탁 서랍. 분필 상자 밑에 작은 손전등이 있다."),
      giveItem(IT_FLASH),
      playSe(SE.click, 0.8), setSw(SW_FLASHLIGHT, true), wait(400),
      ...think("켜진다. 빛이 닿는 데만 보인다.", "복도로 나가서, 1층 현관으로."),
      setVar(V_STAGE, "=", S.CORRIDOR),
    ]),
    page("p_drawer_done", [hasItem(IT_FLASH)], [...think("서랍은 비었다.")]),
  ]));

  // 문간 경고 — 손전등 없이 복도로 나가려 하면.
  for (const x of [13, 19]) addEvents(project, NR_MAP.f2, event(`ev_nr_dark_hall_${x}`, "어두운 복도", { x, y: 13 }, [
    page(`p_dark_${x}`, [varBelow(V_STAGE, S.CORRIDOR)], [
      ...think("복도가 너무 어둡다. 교탁 서랍에 손전등이 있었던 것 같다."),
      walk("@player", ["up"]),
    ], { trigger: "playerTouch" }),
    gone(`p_dark_${x}_off`, [varAtLeast(V_STAGE, S.CORRIDOR)]),
  ]));

  // B2 — 처음 복도로 나선 순간: 동쪽 계단참에 손전등이 선다. 사에키 1단계 순찰이 켜진다.
  const firstLight: Command[] = [
    wait(400),
    playSe(SE.slide, 0.25), wait(900),
    ...think("저 끝, 계단참에… 빛."),
    setSw(SW_SAEKI_2F, true),
    wait(1400),
    ...think("손전등이다. 누가 이쪽을 비추고 있다.", "교실로. 청소 도구함에 숨을 수 있다."),
    setVar(V_STAGE, "=", S.FIRST_HIDE_DONE),
  ];
  for (const x of [13, 19]) addEvents(project, NR_MAP.f2, event(`ev_nr_first_light_${x}`, "첫 손전등", { x, y: 15 }, [
    page(`p_first_${x}`, [varIs(V_STAGE, S.CORRIDOR)], firstLight, { trigger: "playerTouch" }),
    gone(`p_first_${x}_off`, [varAtLeast(V_STAGE, S.FIRST_HIDE_DONE)]),
  ]));

  // 사에키 1단계 — 2층 복도 동↔서 순찰. 부채꼴 100°, 6칸, 200ms/칸, 수색 6초.
  const chase = exec(project, "make_chase_scene", {
    mapId: NR_MAP.f2, id: "ev_nr_saeki_2f",
    chaser: { at: F2.patrolEast, graphic: { textureKey: SAEKI.tex, characterIndex: SAEKI.index }, speed: 3, sightRange: 6 },
    patrol: { waypoints: [F2.patrolEast, { x: 13, y: 17 }, F2.patrolWest, { x: 13, y: 16 }], pauseBeats: 3, lookAround: true },
    pursuit: { scope: "map", doorDelayMs: 0, searchMs: 6000, onLost: "return" },
    killOnTouch: true, characterId: "saeki", caughtText: "찾았다.", activateSwitch: SW_SAEKI_2F, emotes: "none",
    footsteps: {}, hidingSound: { heartbeat: true },
    hidingSpots: [{ ...F2.lockerA }, { ...F2.lockerB }, { ...F2.lockerHall }],
  });
  void chase;
  exec(project, "set_field_detection", {
    mapIds: [NR_MAP.f2], eventIds: ["ev_nr_saeki_2f"], brain: "smart", coneDegrees: 100, sightRange: 6, chaseStepMs: 200, searchMs: 6000, emotes: "none",
    visionLight: { color: "#fff3c4", intensity: 0.85 },
  });

  // 숨은 동안 문틈으로 들리는 혼잣말(설계 대사 4) — 숨어 있고 사에키 순찰 중일 때 한 번.
  addEvents(project, NR_MAP.f2, event("ev_nr_mutter_2f", "혼잣말", { x: 1, y: 17 }, [
    page("p_mutter", [{ kind: "hiding", value: true } as never, swOn(SW_SAEKI_2F)], [
      wait(2600),
      bark(SAEKI_NAME, "거기 있는 거 안다."),
      wait(3200),
      bark(SAEKI_NAME, "내가 문 열기 전에 나와라."),
      wait(4200),
      bark(SAEKI_NAME, "…이상 없음."),
      { kind: "setSelfSwitch", key: "A", value: true } as Command,
    ], { trigger: "parallel" }),
    gone("p_mutter_done", [{ kind: "selfSwitch", key: "A", value: true } as never]),
  ]));
}


// ─────────────────────────────────────────────────────────────────────────
// 1층 — B3 잠긴 현관·열쇠함·낱장 1·2 · B5 열쇠함 1107 · B6a 하교
// ─────────────────────────────────────────────────────────────────────────
const F1 = {
  keyBox: { x: 8, y: 2 },        // 열쇠함(벽면 (8,1)) 아래 벽 칸 — (8,3) 에서 조사
  keyNote: { x: 5, y: 2 },       // 벽시계 아래 메모 — (5,3) 에서 조사
  staffDesk: { x: 10, y: 5 },    // 출석부가 놓인 교무실 책상(숙직 일지) — (11,5) 에서 조사
  staffHide: { x: 10, y: 6 },    // 숨기용 책상 칸 — (11,6) 에서
  nurseBed: { x: 13, y: 3 },     // 보건실 침대(낱장 2)
  nurseCurtain: { x: 14, y: 3 },
  nurseBed2: { x: 15, y: 3 },
  toilet: { x: 24, y: 6 },
  chain: { x: 12, y: 17 },       // 현관 유리문 앞
  chainR: { x: 13, y: 17 },
  stairArrive: { x: 23, y: 13 },
  loopNE: { x: 21, y: 12 },
  loopStaff: { x: 6, y: 12 },
  loopNurse: { x: 15, y: 12 },
} as const;

function build1F(project: Project): void {
  const map = project.maps[NR_MAP.f1]!;
  mustReach(project, map, F1.stairArrive, F1.chain, "계단에서 현관");
  mustReach(project, map, F1.stairArrive, { x: 8, y: 3 }, "계단에서 열쇠함 앞");
  mustReach(project, map, F1.stairArrive, { x: 11, y: 5 }, "계단에서 교무실 책상 앞");

  // 1층에 처음 내려오면 사에키가 1층 순찰로 옮긴다(2층 순찰은 끈다). 3층에서 내려와도 같은 페이지.
  addEvents(project, NR_MAP.f1, event("ev_nr_1f_enter", "1층 들어섬", { x: 1, y: 13 }, [
    page("p_enter", [swOff(SW_SAEKI_1F), varAtLeast(V_STAGE, S.FIRST_HIDE_DONE)], [
      setSw(SW_SAEKI_2F, false), setSw(SW_SAEKI_1F, true),
      wait(500), ...think("1층. 발소리가 교무실 쪽에서 들린다."),
    ], { trigger: "auto" }),
    gone("p_enter_done", [swOn(SW_SAEKI_1F)]),
  ]));

  // 현관 유리문의 쇠사슬 — 현관 열쇠가 있으면 푼다(item-gate). 풀면 아래 출입구로 운동장에 나갈 수 있다.
  exec(project, "compile_puzzle", {
    mapId: NR_MAP.f1, kind: "item-gate", puzzleId: "nr_chain", at: F1.chain, name: "현관 유리문 쇠사슬",
    requiredItemId: IT_KEY_DOOR, consumeItem: false, blocking: true,
    lockedMessage: "유리문 손잡이 둘을 쇠사슬이 감고 있다. 자물쇠가 걸렸다. 밖의 가로등이 보인다.",
    unlockedMessage: "현관 열쇠를 자물쇠에 넣었다. 돌아간다.",
    // 쇠사슬이 풀릴 때 소리 — 스위치를 켜는 조사라 근처 추격자가 듣고 온다(조사 반경 8).
    onSolve: { setSwitch: SW_CHAIN, beats: [{ kind: "music", action: "se", resourceId: SE.chain }, { kind: "say", text: "쇠사슬이 바닥으로 흘러내린다. 소리가 복도 끝까지 울린다." }] },
  });
  // 쇠사슬 오른쪽 칸 — 같은 문짝(조사하면 같은 말).
  addEvents(project, NR_MAP.f1, event("ev_nr_chain_r", "현관 유리문", F1.chainR, [
    page("p_chain_r", [swOff(SW_CHAIN)], [...think("유리문 두 짝을 쇠사슬 하나가 묶었다. 왼쪽 손잡이에 자물쇠.")], { priority: "same" }),
    gone("p_chain_r_off", [swOn(SW_CHAIN)]),
  ]));

  // 열쇠함 메모(설계: 「번호는 그날이다. 잊으면 안 되는 날.」).
  addEvents(project, NR_MAP.f1, event("ev_nr_key_note", "열쇠함 메모", F1.keyNote, [
    page("p_note", [], [
      playSe(SE.paper2, 0.5),
      ...note("열쇠함 옆에 붙은 메모(숙직 교사용)", "번호는 그날이다.", "잊으면 안 되는 날."),
      setSw(SW_SAW_KEYNOTE, true),
    ]),
  ]));

  // B5 — 열쇠함 1107. 열리는 소리가 반경 8칸에 울리고(레버·스위치 소리), 사에키가 추적 단계로 바뀐다.
  exec(project, "compile_puzzle", {
    mapId: NR_MAP.f1, kind: "password", puzzleId: "nr_keybox", at: F1.keyBox, name: "열쇠함", answer: "1107",
    prompt: "네 자리 번호 자물쇠. 다이얼이 차갑다.",
    wrongMessage: "다이얼이 걸리지 않는다. 그날이 아니다.", wrongSound: SE.metal,
    onSolve: {
      setSwitch: SW_KEYBOX,
      giveItems: [IT_KEY_DOOR, IT_KEY_ROOF],
      beats: [
        { kind: "music", action: "se", resourceId: SE.lock },
        { kind: "say", text: "철컥. 열쇠함 문이 열렸다. 소리가 너무 크다." },
        { kind: "say", text: "열쇠 두 개. 꼬리표에 「昇降口」, 그리고 「屋上」." },
      ],
    },
  });
  const keyboxEv = project.maps[NR_MAP.f1]!.events.find((e) => e.id.includes("nr_keybox"))!;
  for (const pg of keyboxEv.pages ?? []) {
    pg.commands = pg.commands.map((c) => {
      if (c.kind !== "fork") return c;
      const fork = c as { then: Command[]; else?: Command[] };
      // 열린 뒤의 추격 단계 전환은 이야기 고유 흐름이라 푼 명령 뒤에 붙인다(퍼즐 도구 밖).
      return { ...c, then: [...fork.then, setSw(SW_SAEKI_1F, false), setSw(SW_SAEKI_HUNT, true),
        { kind: "checkpointSave", label: "keybox" } as Command, wait(600), ...think("발소리가 멈췄다.", "…이쪽으로 온다.")] } as Command;
    });
  }

  // B3 — 교무실 책상의 숙직 일지(낱장 1/3).
  addEvents(project, NR_MAP.f1, event("ev_nr_page1", "숙직 일지", F1.staffDesk, [
    page("p_page1", [{ kind: "item", itemId: IT_PAGE1, present: false } as never], [
      playSe(SE.paper, 0.6),
      ...note("숙직 일지(숙직실 비치) · 1995년", "11월 7일. 3층 이상 없음.", "음악실 이상 없음. 옥상 이상 없음."),
      ...think("30년 전 일지다. 낱장 한 장이 떨어져 나와 있다."),
      giveItem(IT_PAGE1),
      ...think("옥상 칸만 글씨가 흐리다. 급하게 쓴 것처럼."),
    ]),
    page("p_page1_done", [hasItem(IT_PAGE1)], [...think("책상 위에는 이제 출석부 몇 권뿐이다.")]),
  ]));
  // B3 — 보건실 침대 시트 밑(낱장 2/3).
  addEvents(project, NR_MAP.f1, event("ev_nr_page2", "보건실 침대", { x: 13, y: 4 }, [
    page("p_page2", [{ kind: "item", itemId: IT_PAGE2, present: false } as never], [
      playSe(SE.paper2, 0.5),
      ...think("침대 시트 밑에 종이가 끼어 있다."),
      ...note("숙직 일지 낱장", "11월 8일 아침. 옥상 철문, 바깥 빗장이 걸려 있었음.", "누가 걸었는지 모름."),
      giveItem(IT_PAGE2),
      ...think("아래 줄은 몇 번이고 지운 자국이다."),
    ]),
    page("p_page2_done", [hasItem(IT_PAGE2)], [...think("하얀 시트. 아무도 누운 적 없는 것처럼 반듯하다.")]),
  ]));

  // 사에키 2단계 — 1층 복도 → 교무실 문 → 보건실 문 고리. 185ms/칸, 수색 7초.
  exec(project, "make_chase_scene", {
    mapId: NR_MAP.f1, id: "ev_nr_saeki_1f",
    chaser: { at: { x: 2, y: 13 }, graphic: { textureKey: SAEKI.tex, characterIndex: SAEKI.index }, speed: 3, sightRange: 6 },
    patrol: { waypoints: [{ x: 2, y: 13 }, F1.loopStaff, { x: 6, y: 8 }, F1.loopStaff, F1.loopNurse, { x: 15, y: 8 }, F1.loopNurse, F1.loopNE, F1.loopNurse], pauseBeats: 3, lookAround: true },
    pursuit: { scope: "map", doorDelayMs: 0, searchMs: 7000, onLost: "return" },
    killOnTouch: true, characterId: "saeki", caughtText: "찾았다.", activateSwitch: SW_SAEKI_1F, emotes: "none", footsteps: {}, hidingSound: { heartbeat: true },
    hidingSpots: [{ ...F1.nurseCurtain }, { ...F1.nurseBed2 }, { ...F1.staffHide }, { ...F1.toilet }],
  });
  exec(project, "set_field_detection", {
    mapIds: [NR_MAP.f1], eventIds: ["ev_nr_saeki_1f"], brain: "smart", coneDegrees: 100, sightRange: 6, chaseStepMs: 185, searchMs: 7000, emotes: "none",
    visionLight: { color: "#fff3c4", intensity: 0.85 },
  });

  // 사에키 3단계 — 열쇠함 소리로 깨어난다. 층을 따라오고(connected) 오래 뒤진다. knight, 175ms/칸.
  exec(project, "make_chase_scene", {
    mapId: NR_MAP.f1, id: "ev_nr_saeki_hunt",
    chaser: { at: { x: 15, y: 8 }, graphic: { textureKey: SAEKI.tex, characterIndex: SAEKI.index }, speed: 3, sightRange: 6 },
    pursuit: { scope: "connected", doorDelayMs: 1500, searchMs: 9000, onLost: "return", tracking: "persistent" },
    killOnTouch: true, characterId: "saeki", caughtText: "찾았다.", activateSwitch: SW_SAEKI_HUNT, emotes: "none", footsteps: {}, hidingSound: { heartbeat: true }, hidingSpots: [],
  });
  exec(project, "set_field_detection", {
    mapIds: [NR_MAP.f1], eventIds: ["ev_nr_saeki_hunt"], brain: "knight", sightRange: 6, chaseStepMs: 175, searchMs: 9000, emotes: "none",
    visionLight: { color: "#fff3c4", intensity: 0.85 },
  });

  // 순찰 혼잣말(교무실 문 앞에서 들여다볼 때 들린다) — 사에키 1층 순찰 중, 주인공이 교무실 안에 있으면.
  addEvents(project, NR_MAP.f1, event("ev_nr_mutter_1f", "혼잣말", { x: 1, y: 12 }, [
    page("p_mutter1", [swOn(SW_SAEKI_1F)], [
      wait(14000),
      bark(SAEKI_NAME, "교무실, 이상 없음."),
      wait(16000),
      bark(SAEKI_NAME, "보건실… 이상 없음."),
      wait(18000),
    ], { trigger: "parallel" }),
  ]));
}

// ─────────────────────────────────────────────────────────────────────────
// 3층 — B4 대출 카드·피아노 한 음·사요·낱장 3
// ─────────────────────────────────────────────────────────────────────────
const F3 = {
  arrive: { x: 21, y: 13 },
  libCounter: { x: 11, y: 6 },   // 대출 카운터 — (11,7) 에서 조사
  piano: { x: 4, y: 4 },
  specimen: { x: 19, y: 3 },     // 표본장 — (19,4) 에서 조사
  sayoAt: { x: 3, y: 13 },       // 복도 서쪽 끝(음악실 문 아래)
  hideCounter: { x: 10, y: 6 },
  hideBench: { x: 20, y: 5 },
  hideBench2: { x: 23, y: 5 },
} as const;

function build3F(project: Project): void {
  const map = project.maps[NR_MAP.f3]!;
  mustReach(project, map, F3.arrive, { x: 11, y: 7 }, "3층 계단에서 도서실 카운터");
  mustReach(project, map, F3.arrive, { x: 19, y: 4 }, "3층 계단에서 이과실 표본장");

  // 3층에 들어서면 사에키 순찰을 끈다(2층 순찰이 3층까지 따라오지 않는다 — 3층은 사요의 층).
  addEvents(project, NR_MAP.f3, event("ev_nr_3f_enter", "3층 들어섬", { x: 1, y: 13 }, [
    page("p_3f", [{ kind: "selfSwitch", key: "A", value: false } as never], [
      { kind: "setSelfSwitch", key: "A", value: true } as Command,
      wait(600), ...think("3층. 여기는 발소리가 없다.", "아무 소리도 없는 게, 더 이상하다."),
    ], { trigger: "auto" }),
    gone("p_3f_done", [{ kind: "selfSwitch", key: "A", value: true } as never]),
  ]));

  // 대출 카드 — 읽는 순간 음악실 피아노 한 음(깜짝 1), 세일러복 학생이 나타난다.
  addEvents(project, NR_MAP.f3, event("ev_nr_lib_card", "대출 카운터", F3.libCounter, [
    page("p_card", [swOff(SW_SAW_CARD)], [
      playSe(SE.paper2, 0.5),
      ...think("카운터 서랍에 대출 카드 묶음. 맨 위 한 장만 누렇다."),
      ...note("도서 대출 카드 · 『별의 지도』", "대출: 2학년 마키노 사요 · 11월 7일", "반납: (빈칸)"),
      setSw(SW_SAW_CARD, true),
      wait(1400),
      // 깜짝 1 — 피아노 한 음. 소리만, 번쩍임 없음.
      playSe(SE.dark, 1),
      wait(2000),
      ...think("…음악실."),
      setSw(SW_SAYO, true),
    ]),
    page("p_card_done", [swOn(SW_SAW_CARD)], [...think("『별의 지도』. 30년째 반납되지 않았다.")]),
  ]));

  // 사요 — 3층에서 한 번. 벽을 지나 천천히 다가온다(ghost, 260ms/칸, 사방 5칸). 숨으면 지나간다. 3층을 떠나면 끝.
  exec(project, "make_chase_scene", {
    mapId: NR_MAP.f3, id: "ev_nr_sayo",
    chaser: { at: F3.sayoAt, graphic: { textureKey: SAYO.tex, characterIndex: SAYO.index }, speed: 2, sightRange: 5 },
    pursuit: { scope: "map", doorDelayMs: 0, searchMs: 3000, onLost: "wait" },
    killOnTouch: true, characterId: "sayo", activateSwitch: SW_SAYO, emotes: "none", footsteps: { off: true }, hidingSound: { heartbeat: true },
    hidingSpots: [{ ...F3.hideCounter }, { ...F3.hideBench }, { ...F3.hideBench2 }],
    checkpointOnEntry: true,
  });
  exec(project, "set_field_detection", {
    mapIds: [NR_MAP.f3], eventIds: ["ev_nr_sayo"], brain: "ghost", allRound: true, sightRange: 5, chaseStepMs: 260, searchMs: 3000, emotes: "none",
  });
  {
    const ev = project.maps[NR_MAP.f3]!.events.find((e) => e.id === "ev_nr_sayo")!;
    for (const pg of ev.pages ?? []) {
      if (pg.graphic) pg.graphic = { ...pg.graphic, blendMode: "add" };
      // 사요는 잡지 않는다 — 닿으면 차가운 손, 화면이 하얘지고 계단 앞에서 깬다(사요는 원망하지 않는다). 그래도 피하는 게 맞다.
      pg.commands = [
        flash("#cfe0ff", 600), wait(300),
        ...voice(SAYO_NAME, "…거기, 아니야."),
        ...fadeOut(500), transfer(NR_MAP.f3, F3.arrive.x, F3.arrive.y, "left", "none"), setSw(SW_SAYO, false), ...fadeIn(800),
        ...think("손이 차갑다. 누가 잡았던 것처럼."),
      ];
      pg.conditions = [swOn(SW_SAYO), swOff(SW_SAYO_DONE)];
    }
  }
  // 사요 곁 빛 — 차가운 파랑(추가 섞기 칩과 함께).
  {
    const m = project.maps[NR_MAP.f3]!;
    const base = m.defaultLighting!;
    m.defaultLighting = { ...base, sources: [...base.sources, { id: "sayo_glow", at: { eventId: "ev_nr_sayo" }, radius: 2.2, intensity: 0.5, color: "#9fb8ff" }] as never };
  }

  // 이과실 표본장 — 낱장 3/3.
  addEvents(project, NR_MAP.f3, event("ev_nr_page3", "표본장", F3.specimen, [
    page("p_page3", [{ kind: "item", itemId: IT_PAGE3, present: false } as never], [
      playSe(SE.metal, 0.4),
      ...think("유리 표본장. 나비 표본 상자 밑에 종이가 접혀 있다."),
      ...note("숙직 일지 낱장", "11월 7일. 이상 없음. 11월 7일. 이상 없음.", "11월 7일. 이상 없음. 11월 7일. 이상 없음."),
      giveItem(IT_PAGE3),
      ...think("같은 날짜가 끝까지 이어진다. 해가 바뀌어도 날짜는 그대로다."),
    ]),
    page("p_page3_done", [hasItem(IT_PAGE3)], [...think("표본 상자들. 핀이 꽂힌 날개들이 손전등 빛에 하얗게 뜬다.")]),
  ]));

  // 피아노 — 깜짝 뒤 다시 보면.
  addEvents(project, NR_MAP.f3, event("ev_nr_piano", "피아노", F3.piano, [
    page("p_piano", [], [...think("뚜껑이 열려 있다. 건반 하나가 눌린 채 올라오지 않는다.", "도. 가장 낮은 도.")]),
  ]));

  // 3층을 떠나면 사요는 끝(따라오지 않는다) — 2층 도착 칸에서 끈다.
  addEvents(project, NR_MAP.f2, event("ev_nr_sayo_off", "사요 끝", { x: 1, y: 16 }, [
    page("p_sayo_off", [swOn(SW_SAYO), swOff(SW_SAYO_DONE)], [setSw(SW_SAYO, false), setSw(SW_SAYO_DONE, true)], { trigger: "auto" }),
    gone("p_sayo_off_done", [swOn(SW_SAYO_DONE)]),
  ]));
}

// ─────────────────────────────────────────────────────────────────────────
// 옥상 — B6b 이상 있음(진 엔딩) · 계단참 손전등(깜짝 2)
// ─────────────────────────────────────────────────────────────────────────
function buildRoof(project: Project): void {
  // 3층 → 옥상 계단은 철문이 잠겨 있다. 옥상 열쇠 + 낱장 세 장이 있어야 올라간다.
  const f3 = project.maps[NR_MAP.f3]!;
  const roofLinks = f3.events.filter((e) => JSON.stringify(e.pages ?? e.commands).includes(`"mapId":"${NR_MAP.roof}"`));
  for (const link of roofLinks) {
    const go = (link.pages ?? [])[0]!;
    const goCommands = go.commands;
    link.pages = [
      page(`${link.id}_locked`, [], [
        ...think("옥상으로 가는 철문. 잠겨 있다."),
      ], { trigger: "playerTouch", priority: "below" }),
      { ...go, id: `${link.id}_key`, conditions: [hasItem(IT_KEY_ROOF), swOff(SW_ROOF_OPEN)], commands: [
        ifCond({ kind: "item", itemId: IT_PAGE3, present: true } as never, [
          ifCond({ kind: "item", itemId: IT_PAGE2, present: true } as never, [
            ifCond({ kind: "item", itemId: IT_PAGE1, present: true } as never, [
              ...think("녹슨 열쇠가 돌아간다. 일지 낱장 세 장이 주머니에서 바스락거린다."),
              playSe(SE.key, 0.9), setSw(SW_ROOF_OPEN, true), setSw(SW_SAEKI_HUNT, false), ...goCommands,
            ], [...think("문 너머에서 아무 소리도 나지 않는다.", "아직, 다 읽지 않았다.")]),
          ], [...think("문 너머에서 아무 소리도 나지 않는다.", "아직, 다 읽지 않았다.")]),
        ], [...think("문 너머에서 아무 소리도 나지 않는다.", "아직, 다 읽지 않았다.")]),
      ] },
      { ...go, id: `${link.id}_open`, conditions: [swOn(SW_ROOF_OPEN)], commands: goCommands },
    ];
  }

  // 옥상 장면: 펜스 앞 사요. 린이 일지 마지막 줄에 적는다. 사에키가 올라와 읽는다. 동이 튼다.
  const roof = project.maps[NR_MAP.roof]!;
  const sayoAt = { x: 7, y: 7 };
  const saekiAt = { x: 6, y: 6 };
  const ending: Command[] = [
    wait(800),
    ...think("바람. 펜스 앞에 누가 서 있다."),
    walkTo("@player", { x: 5, y: 7 }), face("@player", "right"),
    wait(600),
    ...voice(SAYO_NAME, "…아침까지, 여기 있었어."),
    ...voice(SAYO_NAME, "문은 밖에서 잠겼고, 아무도 올라오지 않았어."),
    wait(500),
    ...think("주머니에서 일지를 꺼냈다. 마지막 줄이 비어 있다."),
    playSe(SE.paper, 0.6), wait(800),
    ...note("숙직 일지 · 오늘", "11월 7일. 옥상 이상 있음.", "— 하야세 린"),
    ...think("옥상 이상 있음. 나는 그렇게 적었다."),
    wait(1200),
    playSe(SE.doorOpen, 0.6),
    setSw("sw_nr_roof_saeki", true), wait(1600),
    walkTo("ev_nr_roof_saeki", saekiAt),
    face("ev_nr_roof_saeki", "right"),
    wait(900),
    ...think("선생님이 손전등을 내렸다. 내 손의 일지를 오래 읽는다."),
    ...voice(SAEKI_NAME, "…옥상."),
    wait(1500),
    ...voice(SAEKI_NAME, "이상, 있음."),
    wait(2000),
    { kind: "setLighting", ambient: 0.18, color: "#ffd9a8", transitionMs: 8000 } as Command,
    stopBgs(),
    wait(8200),
    { kind: "triggerEnding", endingId: END_B } as Command,
  ];
  addEvents(project, NR_MAP.roof, event("ev_nr_roof_scene", "옥상", { x: 1, y: 6 }, [
    page("p_roof", [swOn(SW_ROOF_OPEN)], ending, { trigger: "auto" }),
  ]));
  addEvents(project, NR_MAP.roof, event("ev_nr_roof_sayo", SAYO_NAME, sayoAt, [
    page("p_roof_sayo", [], [], { look: SAYO, dir: "down" }),
  ], "sayo"));
  addEvents(project, NR_MAP.roof, event("ev_nr_roof_saeki", SAEKI_NAME, { x: 6, y: 5 }, [
    gone("p_roof_saeki_off", []),
    page("p_roof_saeki", [swOn("sw_nr_roof_saeki")], [], { look: SAEKI, dir: "down" }),
  ], "saeki"));
  roof.safeZones = [{ x: 0, y: 0, w: roof.width, h: roof.height }];
  if (!project.switches.some((s) => s.id === "sw_nr_roof_saeki")) project.switches.push({ id: "sw_nr_roof_saeki", name: "옥상: 사에키 올라옴" });
  for (const ev of roof.events) for (const pg of ev.pages ?? []) if (pg.graphic && "sprite" in pg.graphic && pg.graphic.sprite && ev.id === "ev_nr_roof_sayo") pg.graphic = { ...pg.graphic, blendMode: "add" };

  // 깜짝 2 — 열쇠함을 연 뒤 2층 계단참에서 내려오는 손전등(한 번). 2층 도착 칸 위 계단에서 빛이 번쩍 다가왔다 사라진다.
  addEvents(project, NR_MAP.f2, event("ev_nr_stair_scare", "계단참", { x: 2, y: 16 }, [
    page("p_stair", [swOn(SW_KEYBOX), swOff(SW_STAIR_SCARE)], [
      setSw(SW_STAIR_SCARE, true),
      playSe(SE.slide, 0.4), wait(250),
      flash("#fff3c4", 260), playSe(SE.dark, 0.9), wait(700),
      ...think("위층 계단참에서 빛이 쏟아졌다가, 꺼졌다.", "…방금 그건 누구였지."),
    ], { trigger: "auto" }),
    gone("p_stair_done", [swOn(SW_STAIR_SCARE)]),
  ]));
}

// ─────────────────────────────────────────────────────────────────────────
// 운동장 — B6a 하교(엔딩 A)
// ─────────────────────────────────────────────────────────────────────────
function buildYard(project: Project): void {
  const yard = project.maps[NR_MAP.yard]!;
  // 교문 개구부(담 x 41~44, y 35~36) — 넘으면 엔딩 A.
  // 남쪽 담(y 35)을 빠져나가는 칸 — 담 틈·교문 개구부·맵 가장자리. 그 칸 바로 아래(y 36)를 밟으면 끝.
  const gate: Cell[] = [];
  for (let x = 0; x < yard.width; x++) if (isPassable(project, yard, x, 35) && isPassable(project, yard, x, 36)) gate.push({ x, y: 36 });
  if (!gate.length) throw new Error("[nothing-to-report] 운동장 교문 칸을 못 찾았다");
  const endA: Command[] = [
    hidePlayer(), stopBgs(), playSe(SE.metal, 0.7), wait(600),
    ...fadeOut(1200),
    { kind: "triggerEnding", endingId: END_A } as Command,
  ];
  for (const [i, c] of gate.slice(0, 16).entries()) {
    addEvents(project, NR_MAP.yard, event(`ev_nr_gate_${i}`, "교문", c, [page(`p_gate_${i}`, [], endA, { trigger: "playerTouch" })]));
  }
  // 교사 문에서 나오면 사에키가 뒤따라 나온다(마지막 단계, 120°·8칸·170ms/칸).
  addEvents(project, NR_MAP.yard, event("ev_nr_yard_enter", "운동장", { x: 1, y: 12 }, [
    page("p_yard", [swOff(SW_YARD_SAEKI)], [
      wait(700),
      ...think("밖이다. 운동장이 까맣다. 교문까지 멀다."),
      wait(500), playSe(SE.doorOpen, 0.6), wait(800),
      setSw(SW_SAEKI_HUNT, false), setSw(SW_YARD_SAEKI, true),
      ...think("뒤에서, 현관문이 열렸다."),
    ], { trigger: "auto" }),
    gone("p_yard_done", [swOn(SW_YARD_SAEKI)]),
  ]));
  exec(project, "make_chase_scene", {
    mapId: NR_MAP.yard, id: "ev_nr_saeki_yard",
    chaser: { at: { x: 6, y: 12 }, graphic: { textureKey: SAEKI.tex, characterIndex: SAEKI.index }, speed: 3, sightRange: 8 },
    pursuit: { scope: "map", doorDelayMs: 0, searchMs: 4000, onLost: "return" },
    killOnTouch: true, characterId: "saeki", caughtText: "찾았다.", activateSwitch: SW_YARD_SAEKI, emotes: "none", footsteps: {}, hidingSound: { heartbeat: true }, hidingSpots: [],
  });
  exec(project, "set_field_detection", {
    mapIds: [NR_MAP.yard], eventIds: ["ev_nr_saeki_yard"], brain: "smart", coneDegrees: 120, sightRange: 8, chaseStepMs: 170, searchMs: 4000, emotes: "none",
    visionLight: { color: "#fff3c4", intensity: 0.85 },
  });
}

// ─────────────────────────────────────────────────────────────────────────
// 엔딩·게임 오버·타이틀·시스템
// ─────────────────────────────────────────────────────────────────────────
const CREDITS = [
  "이상 없음",
  "",
  "OPRN 대표 데모",
  "맵 · 인물 · 소리 — OPRN 번들 에셋(jp_city 손 도트, modern 걷기 칩, CC0 효과음)",
  "인물·학교·사건은 모두 지어낸 것입니다.",
].join("\n");

function defineEndings(project: Project): void {
  exec(project, "define_ending", {
    id: END_A, name: "하교", conditions: [], priority: 0,
    presentation: { musicResourceId: BGM_END_A, tone: "dark", kicker: "엔딩 A", badge: "NORMAL ENDING", credits: CREDITS, portraits: "none" },
    epilogue: [
      { kind: "say", text: "교문을 넘었다. 뒤를 돌아보지 않았다." },
      { kind: "say", text: "다음 날 아침, 교실 일직 칸에는 내일 당번 이름이 적혀 있었다." },
      { kind: "say", text: "「11월 7일 — 일직: 하야세 린.」" },
      { kind: "say", text: "날짜가, 바뀌지 않았다." },
    ],
  });
  exec(project, "define_ending", {
    id: END_B, name: "이상 있음", conditions: [], priority: 1,
    presentation: { musicResourceId: BGM_END_B, tone: "warm", kicker: "엔딩 B · 진 엔딩", badge: "TRUE ENDING", credits: CREDITS, portraits: "none" },
    epilogue: [
      { kind: "say", text: "동이 텄다. 옥상 펜스에 아침 해가 걸렸다." },
      { kind: "say", text: "세일러복 학생은 해를 한 번 보고, 없어졌다." },
      { kind: "say", text: "사에키 선생은 그날 아침 일지를 덮고, 더 이상 걷지 않았다." },
      { kind: "say", text: "다음 날 일직 일지에는 날짜가 하나 늘어 있었다. 「11월 8일.」" },
    ],
  });
  exec(project, "set_game_over", {
    presentation: "horror", title: "이상 없음", message: "손전등 빛이 얼굴에 닿았다.", retryLabel: "체크포인트에서 다시 시작", titleLabel: "타이틀로",
  });
}

function systemSetup(project: Project): void {
  project.meta.title = "이상 없음";
  project.meta.author = "OPRN Flagship Studio";
  project.system.playResolution = { width: 480, height: 270 };
  delete project.system.cameraZoom;
  project.system.dialogueStyle = "glass";
  exec(project, "set_project_genre", { genre: "horror-chase" });
  exec(project, "set_field_hud", { off: true });
  exec(project, "configure_field_menu", { preset: "custom", entries: [
    { command: "items", label: "소지품" }, { command: "backlog", label: "대화 기록" }, { command: "endings", label: "엔딩" },
    { command: "save", label: "저장" }, { command: "load", label: "불러오기" }, { command: "options", label: "설정" }, { command: "to-title", label: "타이틀로" },
  ] });
  const hero = project.database.actors.find((x) => x.id === DEFAULT_ACTOR_ID) ?? project.database.actors[0];
  if (hero) {
    hero.name = "하야세 린";
    hero.nickname = "사쿠라자카 중학교 2학년";
    hero.characterResourceId = "oprn-charset-modern2";
    hero.characterIndex = RIN.index;
    delete hero.faceResourceId;
  }
  exec(project, "upsert_character_profile", { characterId: "saeki", profile: { displayName: SAEKI_NAME, note: "숙직 교사. 밤마다 손전등을 들고 학교를 돈다. 수첩에 같은 말을 적는다." } });
  exec(project, "upsert_character_profile", { characterId: "sayo", profile: { displayName: SAYO_NAME, note: "30년 전 2학년. 세일러복. 대출 카드의 반납 칸이 비어 있다." } });
  exec(project, "upsert_character_profile", { characterId: "rin", profile: { displayName: "하야세 린", note: "2학년 B반. 11월 7일 일직." } });
  // 공포 장면에 음악은 없다 — 맵 BGM 끔. 환경음(낮은 웅웅거림)만.
  for (const id of Object.values(NR_MAP)) {
    const m = project.maps[id];
    if (m) m.bgm = { mode: "none" } as never;
  }
}

/** 맵마다 들어설 때 낮은 환경음을 깐다(bgs). 옥상은 바람. */
function ambience(project: Project): void {
  const drone = exec(project, "generate_original_se", {
    name: "밤 학교 — 낮은 웅웅거림",
    brief: "아무도 없는 밤 학교 복도의 형광등 안정기와 건물이 내는 아주 낮은 웅웅거림. 반복 재생용. 거의 들리지 않을 만큼.",
    patch: { duration: 4, layers: [
      { wave: "sine", at: 0, duration: 4, frequency: 55, endFrequency: 55, attack: 1.2, release: 1.2, gain: 0.25, pan: 0 },
      { wave: "sine", at: 0, duration: 4, frequency: 110, endFrequency: 109, attack: 1.5, release: 1.5, gain: 0.08, pan: -0.2 },
      { wave: "noise", at: 0, duration: 4, frequency: 300, endFrequency: 260, attack: 1.8, release: 1.8, gain: 0.04, pan: 0.2 },
    ] },
  }).data as { resourceId: string };
  for (const id of [NR_MAP.f1, NR_MAP.f2, NR_MAP.f3]) {
    addEvents(project, id, event(`ev_nr_amb_${id}`, "환경음", { x: 0, y: 0 }, [
      page(`p_amb_${id}`, [{ kind: "selfSwitch", key: "A", value: false } as never], [bgs(drone.resourceId, 0.3), { kind: "setSelfSwitch", key: "A", value: true } as Command], { trigger: "parallel" }),
    ]));
  }
  addEvents(project, NR_MAP.roof, event("ev_nr_amb_roof", "바람", { x: 0, y: 0 }, [
    page("p_amb_roof", [{ kind: "selfSwitch", key: "A", value: false } as never], [bgs(SE.wind, 0.4), { kind: "setSelfSwitch", key: "A", value: true } as Command], { trigger: "parallel" }),
  ]));
  addEvents(project, NR_MAP.yard, event("ev_nr_amb_yard", "바람", { x: 0, y: 0 }, [
    page("p_amb_yard", [{ kind: "selfSwitch", key: "A", value: false } as never], [bgs(SE.wind, 0.3), { kind: "setSelfSwitch", key: "A", value: true } as Command], { trigger: "parallel" }),
  ]));
}

/** 장면 장치 하나: 2-A 칠판의 글씨를 지운다(changeTile) — 주인공이 낱장 셋을 다 모은 뒤 2층에 돌아오면 칠판 한 칸이 지워져 있다. */
function blackboardChange(project: Project): void {
  const f2 = project.maps[NR_MAP.f2]!;
  // 2-B 칠판 가운데 칸(윗줄) — 위층(upper) 그림을 지우면 벽 바탕만 남는다.
  let x = -1, y = -1;
  for (const yy of [1, 2]) for (const xx of [16, 17, 15, 18]) if (x < 0 && (f2.upperTiles[yy * f2.width + xx] ?? -1) >= 0) { x = xx; y = yy; }
  if (x < 0) throw new Error("[nothing-to-report] 2-B 칠판 칸을 못 찾았다");
  addEvents(project, NR_MAP.f2, event("ev_nr_board", "칠판", { x: 16, y: 2 }, [
    page("p_board", [hasItem(IT_PAGE3), { kind: "selfSwitch", key: "A", value: false } as never], [
      { kind: "changeTile", mapId: NR_MAP.f2, layer: "upper", x, y, tile: -1 } as Command,
      { kind: "setSelfSwitch", key: "A", value: true } as Command,
    ], { trigger: "auto" }),
    page("p_board_read", [{ kind: "selfSwitch", key: "A", value: true } as never], [...think("칠판 한가운데가 손바닥만큼 지워져 있다. 방금 전까지는 날짜가 적혀 있었다.")]),
  ]));
}

export function createNothingToReportFlagshipDemo(): FlagshipDemoBuildResult {
  const project = createBlankProject();
  const initialMapIds = Object.keys(project.maps);
  buildMaps(project);
  for (const id of initialMapIds) if (!Object.values(NR_MAP).includes(id as never)) delete project.maps[id];
  systemSetup(project);
  defineItems(project);
  lightMaps(project);
  linkYard(project);
  build2F(project);
  build1F(project);
  build3F(project);
  buildRoof(project);
  buildYard(project);
  blackboardChange(project);
  ambience(project);
  defineEndings(project);
  buildNothingToReportOpening(project);
  applyNothingToReportLore(project);

  project.startMapId = NR_MAP.f2;
  project.startPos = F2.wake;
  project.mapTree = { mapId: NR_MAP.yard, children: [NR_MAP.f1, NR_MAP.f2, NR_MAP.f3, NR_MAP.roof].map((mapId) => ({ mapId, children: [] })) };
  // 쓰지 않는 타일셋은 뺀다(번들 칩셋은 ensureBundledTilesets 가 다시 붙인다).
  for (const id of Object.keys(project.tilesets)) if (id !== JP_CITY_ID && !Object.values(project.maps).some((m) => m.tilesetId === id)) delete project.tilesets[id];

  const serialized = serialize(project);
  const reloaded = deserialize(serialized);
  return {
    id: "nothing-to-report",
    manifest: { ...FLAGSHIP_BEAT_MANIFESTS["nothing-to-report"], mapCount: Object.keys(reloaded.maps).length, endingCount: reloaded.endings?.length ?? 0 },
    project: reloaded,
    serialized,
  };
}

export type { Dir };
