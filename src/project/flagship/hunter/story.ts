/**
 * 「사냥꾼 계약」 줄기 — 오프닝 애니메틱(게임 맵 그대로 5컷), 타이틀, P0 산길 야영, P1 세계 지도 첫 걸음,
 * 지역 사이 걷기, 결말(이 판본은 계약 A 까지 — 「제1장 끝」).
 *
 * 오프닝은 조수의 애니메틱 도구만 쓴다(create_opening_animatic_shot · place_opening_background(mapId) ·
 * place_opening_charset_actor · upsert_opening_layer · set_opening_caption · upsert_opening_audio_cue). 새 그림 없음.
 */
import { openingMapViewCrop } from "@/project/openingMapView";
import type { Command, Project } from "@/project/types";
import { ACTOR, ITEM } from "./db";
import { journal, SW, V } from "./contractA";
import { bgm, caption, event, execTool, fadeIn, gone, ifCond, note, page, playSe, say, setSw, setVar, think, varAtLeast, varIs, wait, type Cell } from "./kit";
import { BGM, M, type Stage } from "./maps";

const STAGE = { width: 480, height: 270 } as const;
const LB = 0.12;
const TILE = 16;
const INK = { narr: "#e9e2d0", doran: "#d9c7a0" } as const;
export const OPENING_SHOTS = { road: "hc_op_road", camp: "hc_op_camp", copies: "hc_op_copies", swamp: "hc_op_swamp", world: "hc_op_world" } as const;
const ACTOR2 = "easyrpg-charset-actor2";

const objective = (message: string): Command =>
  ({ kind: "m2Command", commandId: "m2-214-ui-command", fields: { surface: "objectiveChip", message, durationMs: 0 } } as Command);

type View = { crop: { x: number; y: number; width: number; height: number }; sc: number };
function newShot(project: Project, shotId: string, ms: number, transition: Record<string, unknown>): void {
  execTool(project, "create_opening_animatic_shot", { shotId, durationMs: ms, width: STAGE.width, height: STAGE.height, background: "#000000", replace: true, clearLayers: true });
  execTool(project, "set_opening_pixel_grid", { shotId, width: STAGE.width, height: STAGE.height });
  execTool(project, "set_opening_transition", { shotId, transition, letterbox: LB });
}
function mapBackground(project: Project, shotId: string, mapId: string, focus: Cell, zoom: number): View {
  execTool(project, "place_opening_background", { shotId, layerId: "bg", mapId, focus, zoom });
  const crop = openingMapViewCrop(project.maps[mapId]!, STAGE, focus, zoom);
  return { crop, sc: STAGE.width / crop.width };
}
function chipAt(view: View, c: Cell): Cell {
  return { x: Math.round(((c.x + 0.5) * TILE - 12 - view.crop.x) * view.sc), y: Math.round(((c.y + 1) * TILE - 32 - view.crop.y) * view.sc) };
}
function tint(project: Project, shotId: string, id: string, color: string, opacity: number, blend: "multiply" | "screen" | "source-over" = "multiply", keys?: { atMs: number; value: number; ease?: string }[]): void {
  execTool(project, "upsert_opening_layer", { shotId, layer: {
    id, kind: "shape", shape: "rect", role: "effect", space: "screen", color, blend, x: 0, y: 0, width: STAGE.width, height: STAGE.height, opacity,
    ...(keys ? { keys: { opacity: keys } } : {}),
  } });
}
function rain(project: Project, shotId: string, count = 70): void {
  execTool(project, "upsert_opening_layer", { shotId, layer: {
    id: "rain", kind: "particles", role: "effect", color: "#9fb3c8", blend: "source-over", opacity: 0.55, x: 0, y: 0, width: STAGE.width, height: STAGE.height,
    particles: { preset: "rain", count, seed: 3, speed: 60, size: 1 },
  } });
}
function captions(project: Project, shotId: string, cues: { atMs: number; text: string; color?: string }[]): void {
  execTool(project, "set_opening_caption", { shotId, layerId: "caption", letterbox: LB, color: INK.narr, fontSize: 12, fadeOutMs: 300,
    cues: cues.map((c) => ({ atMs: c.atMs, text: c.text, color: c.color ?? INK.narr, typewriterMs: Math.min(700, 28 * c.text.length) })) });
}
function sfx(project: Project, shotId: string, id: string, resourceId: string, atMs: number, durationMs: number, volume = 0.7): void {
  execTool(project, "upsert_opening_audio_cue", { shotId, cue: { id, resourceId, atMs, durationMs, volume } });
}
function actor(project: Project, shotId: string, layerId: string, index: number, at: Cell, dir: "down" | "up" | "left" | "right", scale: number): void {
  execTool(project, "place_opening_charset_actor", { shotId, layerId, charsetResourceId: ACTOR2, characterIndex: index, direction: dir, scale, x: at.x, y: at.y, stride: 8 * scale, characterRole: "hero" });
}

/** 오프닝 다섯 컷 — 비 오는 산길, 빈 침낭, 사본 세 장, 갈대늪, 세 곳이 보이는 지도. 약 25초. */
export function buildOpening(project: Project, s: Stage): void {
  project.system.opening = { enabled: true, skippable: true, scenes: [] };
  // 1. 산길 — 세계 지도 북쪽 산줄기 위(회색봉 쪽)를 비 속에.
  {
    const id = OPENING_SHOTS.road, ms = 5200;
    newShot(project, id, ms, { kind: "fade", durationMs: 800 });
    mapBackground(project, id, M.world, { x: s.world.castleGate.x - 4, y: s.world.castleGate.y + 3 }, 3);
    tint(project, id, "dark", "#1d2a3a", 0.55);
    rain(project, id);
    execTool(project, "animate_opening_camera", { shotId: id, camera: { x: 240, y: 135, zoom: 1, keys: { zoom: [{ atMs: 0, value: 1 }, { atMs: ms, value: 1.1, ease: "ease-in-out" }] } } });
    captions(project, id, [{ atMs: 600, text: "비가 사흘째 그치지 않았다." }, { atMs: 2900, text: "회색봉 아래 산길. 도제가 마지막으로 묵은 자리." }]);
  }
  // 2. 야영 자리 — 늪 여관 침대 쪽 실내를 어둡게, 도르반 혼자(빈 침낭은 말로만).
  {
    const id = OPENING_SHOTS.camp, ms = 5600;
    newShot(project, id, ms, { kind: "cut", durationMs: 1 });
    const view = mapBackground(project, id, M.inn, { x: s.inn.bed.x + 2, y: s.inn.bed.y + 1 }, 3);
    tint(project, id, "night", "#14213a", 0.6);
    execTool(project, "upsert_opening_light_fx", { shotId: id, layerId: "ember", kind: "glow", x: 160, y: 120, width: 200, height: 200, color: "#ff9a4a", inner: 0.2, pulse: { hz: 1.1, amount: 0.25, pattern: "flicker", seed: 4 } });
    actor(project, id, "doran", 4, chipAt(view, { x: s.inn.bed.x + 2, y: s.inn.bed.y + 1 }), "left", 3);
    captions(project, id, [{ atMs: 400, text: "침낭은 말라 있었다. 석 달은 아무도 눕지 않았다." }, { atMs: 3000, text: "도르반 「리스크. 혼자 받지 말랬지.」", color: INK.doran }]);
  }
  // 3. 사본 세 장 — 같은 방, 더 가까이. 종이 소리.
  {
    const id = OPENING_SHOTS.copies, ms = 6000;
    newShot(project, id, ms, { kind: "fade", durationMs: 500 });
    mapBackground(project, id, M.inn, { x: s.inn.board.x + 1, y: s.inn.board.y }, 4);
    tint(project, id, "night", "#14213a", 0.5);
    sfx(project, id, "paper", "cc0-se-osx-paper-04", 300, 800);
    captions(project, id, [
      { atMs: 300, text: "침낭 밑에 계약서 사본 세 장. 도제의 글씨." },
      { atMs: 2300, text: "갈대늪. 버들항. 회색봉." },
      { atMs: 4000, text: "셋째 장의 의뢰인 이름은 지워져 있었다." },
    ]);
  }
  // 4. 갈대늪 — 안개 낀 수상 마을.
  {
    const id = OPENING_SHOTS.swamp, ms = 5000;
    newShot(project, id, ms, { kind: "fade", durationMs: 700 });
    mapBackground(project, id, M.swamp, { x: s.swamp.plaza.x - 4, y: s.swamp.plaza.y + 2 }, 2);
    tint(project, id, "fog", "#9aa8a0", 0.28, "screen");
    tint(project, id, "dim", "#2a3328", 0.35);
    execTool(project, "animate_opening_camera", { shotId: id, camera: { x: 240, y: 135, zoom: 1, keys: { x: [{ atMs: 0, value: 240 }, { atMs: ms, value: 222 }] } } });
    captions(project, id, [{ atMs: 400, text: "첫 장. 갈대늪. 「익사자 처리. 머리 하나에 은화 30.」" }, { atMs: 2700, text: "도르반은 남은 은화를 셌다. 열한 닢." }]);
  }
  // 5. 세 곳 — 세계 지도 전체.
  {
    const id = OPENING_SHOTS.world, ms = 4200;
    newShot(project, id, ms, { kind: "fade", durationMs: 700 });
    mapBackground(project, id, M.world, { x: 26, y: 19 }, 1);
    tint(project, id, "dim", "#202838", 0.3);
    captions(project, id, [{ atMs: 300, text: "사냥꾼 계약" }, { atMs: 1800, text: "도제가 남긴 계약서 세 장을 따라간다." }]);
  }
  // configure_opening_music 는 이 체크아웃에 받은 곡만 안다(굽기는 OPRN_ASSUME_ALL_BGM_INSTALLED) — 직접 단다.
  (project.system.opening as { musicResourceId?: string }).musicResourceId = BGM.world;
}

export function setupTitle(project: Project): void {
  execTool(project, "set_title_screen", {
    title: "사냥꾼 계약", logoSubtitle: "도제가 남긴 계약서 세 장", backgroundResourceId: `opening-still:${OPENING_SHOTS.swamp}@3800`,
    backgroundFit: "cover", backgroundRendering: "pixelated",
    logoStyle: "plain", logoShine: "none", menuStyle: "plain", menuFontPx: 13, musicResourceId: BGM.swamp,
    runners: [],
    layout: { titleX: 18, titleY: 30, menuX: 22, menuY: 180 },
    sequence: { fadeMs: 1200, push: 0.03, logoAtMs: 900, logoReveal: "fade", menuAtMs: 1800 },
    transition: { kind: "fade", durationMs: 700 },
    effects: [{ kind: "motes", region: [[0, 0.3], [1, 0.3], [1, 1], [0, 1]], count: 18, color: "#c9d2c4", speed: 0.3 }],
  });
}

/**
 * P0·P1 — 세계 지도에 서면 시작한다. 사본 세 장을 일지에 적고, 갈대늪 쪽 길을 가리킨다.
 * 버들항·회색봉은 이 판본에서 문이 닫혀 있다(설계 M4·M5) — 아이콘 앞에서 이유를 말한다.
 */
export function buildWorldStory(project: Project, s: Stage): void {
  const world = project.maps[M.world]!;
  world.bgm = { mode: "custom", resourceId: BGM.world } as typeof world.bgm;
  const start = s.world.start;
  world.events.push(event("ev_hc_p0", "산길", start, [
    page("p0", [varIs(V.stage, 0)], [
      bgm(BGM.world, 900), ...fadeIn(800),
      ...think("세 장. 늪, 항구, 산성. 리스크는 산성으로 갔다."),
      ...think("빈손으로 산성에 오르면 산성이 나를 먹는다.\n먼저 늪이다. 거기 선금이 있다."),
      { kind: "changeItem", itemId: ITEM.copy1, op: "+=", amount: 1 } as Command, playSe("cc0-se-osx-paper-04"),
      journal("hc_p0_copies", "리스크의 사본 세 장. 갈대늪 익사자. 버들항 하수도. 회색봉 성주. 셋째 장 의뢰인은 지워졌다."),
      setVar(V.stage, "=", 1),
      objective("남서쪽 갈대늪으로 간다."),
    ], { trigger: "auto", priority: "below" }),
    gone("p0_done", [varAtLeast(V.stage, 1)]),
  ]));
  // 닫힌 두 곳 — 아이콘 성문 칸에 이유를 둔다(이 판본의 끝).
  for (const [id, at, lines] of [
    ["ev_hc_harbor_closed", s.world.harborGate, ["버들항. 성문에서 통행세를 받는다. 은화 열.", "주머니에 그만한 돈이 없다. 늪 일부터 끝낸다."]],
    ["ev_hc_castle_closed", s.world.castleGate, ["회색봉으로 오르는 길. 비에 무너진 돌이 길을 막았다.", "리스크가 넘은 길이다. 지금은 못 넘는다."]],
  ] as const) {
    world.events.push(event(id, "닫힌 길", at, [
      page(`${id}_p`, [], [
        ...caption(lines[0]),
        ifCond(varAtLeast(V.a, 5), [...caption("(이 판본은 갈대늪 계약까지입니다.)")], [...think(lines[1])]),
      ], { trigger: "playerTouch", priority: "below" }),
    ]));
  }
}

/** 갈대늪 끝 — 하그네에게 마무리를 들은 뒤 여관 문을 나서면 1장이 끝난다. */
export function buildChapterEnd(project: Project, s: Stage, endingId: string): void {
  const swamp = project.maps[M.swamp]!;
  const at = { x: s.swamp.innDoor.x, y: s.swamp.innDoor.y + 2 };
  swamp.events.push(event("ev_hc_ch1_end", "갈대늪을 떠나며", at, [
    gone("ch1_wait", []),
    page("ch1_end", [{ kind: "switch", switchId: "sw_hc_a_paid", value: true } as never], [
      wait(300),
      ifCond(varIs(V.aChoice, 1), [...say("villager", "smile", "사냥꾼 양반. 또 오시오. 다음엔 밥을 내겠소.")]),
      ifCond(varIs(V.aChoice, 2), [...caption("물가에 짐을 진 사람들이 줄을 섰다. 버들항 쪽이다.")]),
      ifCond(varIs(V.aChoice, 3), [...caption("세나네 집 앞 물가에 밥그릇이 또 놓였다.")]),
      ...think("사본 한 장이 끝났다. 리스크는 여기서 무엇을 봤을까."),
      ...note("갈대늪. 익사자 처리. 끝.", "둘째 장은 버들항. 하수도의 세 번째 입.", "셋째 장은 회색봉."),
      setSw("sw_hc_ch1_over"),
      { kind: "triggerEnding", endingId } as Command,
    ], { trigger: "auto", priority: "below" }),
    gone("ch1_done", [{ kind: "switch", switchId: "sw_hc_ch1_over", value: true } as never]),
  ]));
}

export function defineEndings(project: Project, endingId: string): void {
  const credits = [
    "「사냥꾼 계약」 제1장 · 갈대늪",
    "",
    "이야기 · 연출   OPRN Flagship Studio",
    "늪 마을 · 둥지   OPRN 버들항 타일",
    "여관   OPRN 손 도트 실내",
    "세계 지도   OPRN 월드맵 키트",
    "인물   EasyRPG RTP · 공용 흉상",
    "음악 · 효과음   CC0 음원 · EasyRPG RTP",
    "",
    "만든 도구   OPRN Studio",
  ].join("\n");
  execTool(project, "define_ending", {
    id: endingId, name: "첫 장", priority: 10, conditions: [],
    presentation: { kicker: "갈대늪", badge: "제1장 끝", finalTitle: "제1장 끝", musicResourceId: BGM.sorrow, tone: "dark", portraits: "none", credits },
    epilogue: [],
  });
}
void ACTOR; void SW;
