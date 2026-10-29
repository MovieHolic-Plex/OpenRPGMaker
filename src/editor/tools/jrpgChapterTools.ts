// author_jrpg_chapter — 크로노 트리거·FF6 한 장(章)을 한 번에 짓는다: 거점 맵 + 갈래 맵(실내·장면·던전) + NPC + 퀘스트 + 사건 컷신.
//
// 왜 (2026-10-18 사용자 「JRPG 타일 존나 다양하게 깔아봐. 던전을 비롯해서 크로노 트리거, ff6 에 나온 마을이나 던전, 지역, NPC, 퀘스트, 사건 등을 만들 수 있어야함」):
// 장면 구성기(create_map themeScene)·던전(author_dungeon)·손 도트 실내(build_hand_interior_room)·NPC·퀘스트·컷신·시간의 문은
// 각각 있었지만, 「천년제 광장 + 가르디아 성 + 텔레포드 사건 + 펜던트 퀘스트」 같은 한 장을 묶는 길이 없었다.
// 새 배치 규칙은 만들지 않는다 — 맵은 구성기가, 연결·착지는 create_transfer_pair/create_time_gate/author_dungeon.entrance 가,
// 이벤트 자리는 expand_jrpg_campaign_volume 과 같은 pickSpot(지워도 길이 끊기지 않는 칸)이 고른다.
import { normalizeAtmosphereEffects, type AtmosphereKind } from "@/project/atmosphere";
import { charsetFrameIndex, decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import { isPassable } from "@/project/collision";
import { M2_COMMAND_CATALOG } from "@/project/eventCommands/m2Catalog";
import { layerTileAt, setLayerTileAt } from "@/project/mapLayers";
import { questFlagIds } from "@/project/quest/questDef";
import { EMOTE_KINDS, type EmoteKind } from "@/project/emotes";
import type { Command, Dir, EventPage, EventPageGraphic, GameEvent, GameMap, Project } from "@/project/types";
import { charsetGraphic } from "./eventCompile";
import { heroCharacterResourceId } from "./cutsceneCharacterLock";
import { ensureNamedSwitch } from "./flagHelpers";
import {
  asCell, asRoom, chestLoot, edgeGate, field, houseDoors, list, mainComponent, nested, num, pickSpot, pickFittedTroops, placeRoamer, sanitizeId, text,
  type Cell, type Room,
} from "./jrpgVolumeTools";
import { requireMap } from "./mapHelpers";
import { buildVerifiedChangeTileCommands, type PuzzlePresetId } from "./puzzleAuthoringTools";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";
export type MapKind = { readonly scene: string } | { readonly interior: string } | { readonly dungeon: string };
export type SiteSpec = MapKind & {
  readonly key: string; readonly name: string; readonly from?: string;
  /** 앞 맵에서 이 갈래로 나가는 출입구를 둘 변(장면 갈래만). 없으면 앞 맵이 고른다. */
  readonly gateSide?: "north" | "south" | "east" | "west";
  /** 장면 갈래 맵에 들어오는 칸(가장자리). 없으면 맵이 고른다. */
  readonly entry?: { readonly x: number; readonly y: number };
  /** 장면 갈래가 버들항 필드일 때 author_wild_route 를 이 인자로 다시 깐다(end·clearings 로 막다른 숲속 공터). */
  readonly route?: Readonly<Record<string, unknown>>;
};
/** roam = 마을을 돌아다니는 주민(random 이동). 의뢰인·조력자·동료는 제자리에 둔다. */
export interface NpcSpec { readonly key: string; readonly name: string; readonly query: string; readonly lines: readonly string[]; readonly map?: string; readonly roam?: true }
export interface MoodSpec { readonly weather?: "rain" | "snow" | "fog" | "storm"; readonly ambient?: number; readonly color?: string }
/**
 * 맵에 세우는 장면 소품 — 공용 킷(kit:<칩셋>/<id>, 다른 칩셋 그림은 stamp_object 가 이식한다).
 * where: north·center·south = 걸음 덩이의 북쪽·가운데·남쪽, boss = 던전 보스방, rooms = 던전 방들을 돌아가며(장면 맵은 가운데),
 * gate = 이 맵에서 갈래로 가는 출입구 곁(잠긴 출입구가 있으면 그 곁).
 * light = 그 자리 광원 색(맵 분위기에 붙는다). mark = 이 소품 앞 칸에 이름을 붙여 이벤트 자리로 쓴다
 * (clue 퀘스트 조사·퍼즐 자리, 그 밖은 장치 이름 — devices[].mark).
 */
/** where: fair = 바깥 맵 풀밭에 걷어 낸 장터 마당 둘레, fair-north = 그 마당 북쪽 무대, fair-center = 마당 한가운데. */
export interface DressSpec {
  readonly object: string;
  readonly where: "north" | "center" | "south" | "boss" | "rooms" | "gate" | "fair" | "fair-north" | "fair-center";
  readonly count?: number; readonly light?: string; readonly mark?: string;
}
export type Beat = Record<string, unknown>;
/**
 * 연출 낱말 — 퍼즐·장치 명령에 끼우는 짧은 화면·소리 효과. 컷신 컴파일러는 라벨을 한 범위에 하나만 허용해
 * 선택지 갈래마다 다시 쓸 수 없으므로(label.duplicate) 같은 M2 명령을 직접 만든다.
 * flash:<색> · shake:<1|3|6|10> · particles:<preset> · tint:<#hex|clear> · se:<easyrpg 효과음> · emote:<감정> · wait:<ms>
 */
export type Fx = `${"flash" | "shake" | "particles" | "tint" | "se" | "emote" | "wait"}:${string}`;
export interface ItemSpec { readonly id: string; readonly name: string; readonly description: string }
/** 퍼즐 한 단계 — answer 번째 보기만 다음 단계로 간다. hit = 맞힌 뒤 연출·대사, miss = 이 단계만의 틀린 답 반응. */
export interface PuzzleStage {
  readonly prompt: string; readonly options: readonly string[]; readonly answer: number;
  readonly hit?: { readonly lines?: readonly string[]; readonly fx?: readonly Fx[] };
  readonly miss?: { readonly lines: readonly string[]; readonly fx?: readonly Fx[] };
}
/**
 * 단서 조사 자리의 진짜 기믹 — 퀘스트 조사 단계(create_quest inspect)의 진행 페이지를 이 퍼즐로 감싼다.
 * 모든 단계를 맞혀야 연출·보상 뒤에 원래 단서 대사와 단계 완료가 따른다. 단계가 없으면 조사만으로 보상을 준다.
 */
export interface PuzzleSpec {
  readonly intro: readonly string[];
  readonly stages: readonly PuzzleStage[];
  readonly wrong: readonly string[];
  readonly wrongFx?: readonly Fx[];
  readonly solvedFx: readonly Fx[];
  readonly reward?: { readonly item?: ItemSpec; readonly gold?: number; readonly line: string };
}
/**
 * 퀘스트와 따로 쓰는 장치 — 소품 앞(mark) 칸에서 조사하면 연출 + 대사 + (heal) 회복.
 * puzzle 이 있으면 그 선택지 퍼즐을 풀어야 연출·대사·보상이 따르고, 한 번 풀면 뒤로는 done 대사만 한다(보상 되풀이 없음).
 */
export interface StatefulGraphicSpec { readonly sheet: "object1" | "object2"; readonly index: number; readonly beforeDir?: Dir; readonly afterDir?: Dir }
export interface DeviceSpec {
  readonly map: string; readonly mark: string; readonly name: string; readonly fx: readonly Fx[]; readonly heal?: true; readonly lines: readonly string[];
  readonly puzzle?: PuzzleSpec; readonly done?: readonly string[];
  readonly graphic?: StatefulGraphicSpec; readonly changeTile?: true;
}
export interface ChapterPresetSpec {
  readonly map: string; readonly presetId: PuzzlePresetId; readonly title: string; readonly hintText?: string;
}
/** 갈래 맵으로 가는 출입구를 아이템으로 잠근다 — 아이템을 지니고 닿으면 연출과 함께 열리고, 그 뒤로는 보통 출입구다. */
export interface LockSpec { readonly site: string; readonly item: string; readonly locked: readonly string[]; readonly opened: readonly string[]; readonly fx: readonly Fx[] }
/** 수호자 전투 — 기존 보스 트룹 이름이 장과 안 맞아(「성 경비대장」이 붉은 드래곤 트룹과 싸웠다) 장마다 제 이름·외형의 적·트룹을 만든다. */
export interface FoeSpec {
  readonly map: string; readonly name: string; readonly query: string; readonly intro: readonly string[]; readonly victory: readonly string[];
  /** 몬스터 리소스 id(generated-enemy-*). */ readonly graphic: string;
  /** 트룹에 서는 마리 수(쌍둥이 골렘 = 2)와 한 마리 이름(없으면 name). */ readonly count?: number; readonly enemyName?: string;
}
export interface ChapterSpec {
  readonly title: string;
  readonly era: string;
  /** form = 버들항 마을 형태(plaza 광장 = 장터 축제 마을). scene 이 beodeul_town:<theme> 일 때만. */
  readonly hub: { readonly name: string; readonly scene: string; readonly form?: string; /** 강·해안 마을 숲 덩이 종류(author_beodeul_town forestType). */ readonly forestType?: string };
  readonly sites: readonly SiteSpec[];
  readonly moods?: Readonly<Record<string, MoodSpec>>;
  /** 맵 대기 입자(꽃잎·불씨·마력·먼지) — 날씨·조명과 겹쳐 깔린다. */
  readonly atmosphere?: Readonly<Record<string, readonly AtmosphereKind[]>>;
  readonly dress?: Readonly<Record<string, readonly DressSpec[]>>;
  readonly npcs: readonly NpcSpec[];
  /** 퀘스트를 보고하면 파티에 들어오는 NPC key — 그 NPC 의 그림으로 배우를 만들고, 합류 뒤 맵에서 사라진다. */
  readonly joins?: readonly string[];
  readonly puzzle?: PuzzleSpec;
  readonly clueGraphic?: StatefulGraphicSpec;
  readonly devices?: readonly DeviceSpec[];
  readonly puzzlePresets?: readonly ChapterPresetSpec[];
  readonly lock?: LockSpec;
  readonly quest: {
    readonly title: string;
    readonly summary: string;
    readonly giver: string;
    readonly ask: string;
    readonly helper: { readonly npc: string; readonly lines: readonly string[] };
    readonly clue: { readonly map: string; readonly label: string; readonly lines: readonly string[] };
    readonly foe: FoeSpec;
    /** 수호자를 쓰러뜨린 뒤 의뢰인에게 보고할 때의 대사(create_quest dialogue.completed). */
    readonly report: readonly string[];
    readonly gold: number;
  };
  readonly event: { readonly map: string; readonly title: string; readonly beats: readonly Beat[] };
  readonly gateName?: string;
}
const say = (speaker: string, line: string): Beat => ({ kind: "say", speaker, text: line });

/** 장(章) 사전 — 시대초월 정통 JRPG 8장(오리지널 고유명사 정본). 맵 key 는 "hub" 또는 sites[].key. */
export const JRPG_CHAPTERS = {
  ct_truce_fair: {
    title: "천년제의 벨하임 마을", era: "왕력 1000년 · 현재",
    hub: { name: "벨하임 마을 · 천년제 광장", scene: "beodeul_town:river", form: "plaza" },
    sites: [{ key: "castle", name: "벨하임 왕성 알현실", interior: "throne" }],
    moods: { hub: { ambient: 0.05, color: "#ffd9a0" } },
    atmosphere: { hub: ["petals"] },
    // 천년제 광장: 마을 풀밭을 걷어 낸 장터 마당 — 북쪽 무대에 토우의 텔레포드 두 기, 가운데에 종탑·분수, 둘레에 장터 노점·길드 깃발·쌍등 가로등.
    dress: {
      hub: [
        // 토우의 텔레포드 시연대 — 앞 칸에서 범종 신호를 울리고 출력을 맞추는 축제 놀이(devices). 광장이 좁아도 늘 서는 소품에 단다.
        { object: "kit:atlas_biome_interior/hand-interior:teleport pad", where: "fair-north", count: 2, light: "#80d0ff", mark: "telepod" },
        { object: "kit:sengoku_edo/se-bell-tower", where: "fair" },
        { object: "kit:beodeul_city/bd-prop-stall_veg", where: "fair" },
        { object: "kit:beodeul_city/bd-prop-stall_cheese_meat", where: "fair" },
        { object: "kit:pirate_isles/pi-stall-fruit", where: "fair" },
        { object: "kit:desert_east/de-stall-lantern", where: "fair", light: "#ffb060" },
        { object: "kit:beodeul_city/bd-prop-flower_cart", where: "fair" },
        { object: "kit:beodeul_city/bd-pick-walled-market-banner-red", where: "fair" },
        { object: "kit:beodeul_city/bd-pick-walled-market-banner-teal", where: "fair" },
        { object: "kit:beodeul_city/bd-prop-lamp_double", where: "fair", count: 2, light: "#ffd890" },
        { object: "kit:modern_campus/mc-fountain-anim", where: "fair-center" },
      ],
    },
    // 천년제 범종·텔레포드 놀이 — 신호 종을 힘껏 쳐야 토우가 텔레포드를 돌리고, 출력을 「중간」에 맞춰야 시연이 성공한다.
    devices: [{
      map: "hub", mark: "telepod", name: "천년제 텔레포드 시연대",
      graphic: { sheet: "object2", index: 0, beforeDir: "down", afterDir: "up" },
      changeTile: true,
      fx: ["se:bell", "flash:white", "particles:sparkle"],
      lines: ["데엥— 종소리에 맞춰 텔레포드 두 기가 푸르게 빛났다!", "구경꾼들이 환호하며 꽃잎을 뿌린다."],
      done: ["텔레포드가 은은하게 웅웅거린다.", "(천년제 기념 메달은 이미 받았다)"],
      puzzle: {
        intro: ["토우의 텔레포드 시연대다. 곁의 신호 종 앞에서 종지기가 「힘 자랑 한번 해 보게!」 하며 당목을 건넨다."],
        stages: [
          {
            prompt: "범종을 어떻게 칠까?", options: ["힘껏 친다", "살살 친다"], answer: 0,
            hit: { lines: ["데에엥!! 광장 끝까지 종소리가 울려 퍼졌다.", "토우: 「좋아, 그 소리면 충분해! 텔레포드 출력은 얼마로 할까?」"], fx: ["se:bell", "shake:2"] },
            miss: { lines: ["통… 종이 겨우 흔들렸다. 종지기가 웃는다."] },
          },
          {
            prompt: "텔레포드 출력은?", options: ["최대 출력", "중간 출력", "최소 출력"], answer: 1,
            hit: { lines: ["토우: 「안정적이야! 이 정도면 사람이 타도 괜찮겠어!」"], fx: ["se:chime2"] },
            miss: { lines: ["토우: 「으악, 출력이 안 맞아! 장치가 덜덜 떨려!」"], fx: ["shake:3", "flash:red"] },
          },
        ],
        wrong: ["종지기: 「다시 한번 처음부터 해 보게.」"],
        solvedFx: ["particles:magic"],
        reward: { item: { id: "item_ct_millennial_medal", name: "천년제 기념 메달", description: "천년제 범종 놀이에서 받은 은빛 메달. 광장의 상인들이 알아보고 웃어 준다." }, line: "「천년제 기념 메달」을 받았다!" },
      },
    }],
    puzzlePresets: [
      { map: "castle", presetId: "lever_secret_passage", title: "가르디아 성 지하 보물고 비밀 레버" },
    ],
    npcs: [
      { key: "marle", name: "세린", query: "공주", lines: ["천년제 구경 왔어? 나랑 같이 돌아보자!", "저 텔레포드, 토우가 만든 거래. 한번 타 볼래?"] },
      { key: "lucca", name: "토우", query: "마법사 소녀", lines: ["내 텔레포드 시연 보러 왔구나! 광장 북쪽 무대야.", "펜던트가 장치랑 공명하는 건 계산에 없었는데…"] },
      { key: "balloon", name: "풍선 장수", query: "행상인 · 갈색 둥근 모자", lines: ["천년제 기념 풍선이오! 하나에 10골드!"], roam: true },
      { key: "bell", name: "종탑지기", query: "노인 · 흰 머리(남)", lines: ["천 년 전 왕국이 세워진 날을 이 종이 알린다네."] },
      { key: "dog", name: "길 잃은 강아지", query: "주황 강아지", lines: ["멍! 멍멍… (집에 데려다 달라는 눈치다)"], roam: true },
      { key: "chancellor", name: "벨하임 대신", query: "귀족 남성", lines: ["왕녀님을 데려간 자가 누구냐!"], map: "castle" },
    ],
    joins: ["marle", "lucca"],
    quest: {
      title: "천년제의 왕녀", summary: "텔레포드 사고로 사라진 세린의 펜던트 단서를 벨하임 왕성에서 찾는다.",
      giver: "marle", ask: "내 펜던트… 텔레포드에 빨려 들어갈 때 빛났어. 성에 가면 뭔가 알 수 있을 거야.",
      helper: { npc: "lucca", lines: ["펜던트 파장이 시대의 문을 연 거야. 성의 기록실을 살펴봐!"] },
      clue: { map: "castle", label: "왕가의 초상화", lines: ["초상화 속 옛 왕비가 세린과 같은 별빛 펜던트를 걸고 있다."] },
      foe: { map: "castle", name: "벨하임 근위대장 오르벤", query: "붉은 갑옷 기사", graphic: "generated-enemy-knight-fallen", intro: ["왕녀님을 위협한 자냐! 거기 서라!"], victory: ["…오해였군. 시대의 문 너머를 부탁하네."] },
      report: ["펜던트는 왕가의 성물이었구나… 고마워, 함께 시대의 문을 넘자!"], gold: 300,
    },
    event: {
      map: "hub", title: "텔레포드 시연 — 세린의 실종",
      beats: [
        { kind: "letterbox", show: true },
        { kind: "moveActor", target: "lucca", moves: [{ kind: "move", dir: "down" }], wait: true },
        { kind: "camera", mode: "pan", x: 28, y: 18, durationMs: 400, wait: true },
        say("루카", "자, 천년제 특별 시연! 텔레포드 가동!"),
        { kind: "parallel", beats: [{ kind: "flash", color: "white", durationMs: 400 }, { kind: "shake", intensity: 3, durationMs: 600, axis: "both" }] },
        { kind: "moveActor", target: "marle", moves: [{ kind: "move", dir: "up" }], wait: true },
        say("마르", "어, 펜던트가… 빛나고 있어?!"), { kind: "particles", preset: "magic", target: "player", durationMs: 900, wait: true },
        { kind: "distort", effect: "rotate", amount: 0.6, durationMs: 600, wait: true }, { kind: "distort", effect: "clear", durationMs: 200 },
        { kind: "camera", mode: "return", durationMs: 350, wait: true },
        say("루카", "시간의 문이 열렸어…! 마르가 사라졌다고?!"),
      ],
    },
  },
  ct_middle_ages: {
    title: "왕력 600년 벨하임 · 대성당과 마왕성", era: "왕력 600년 · 중세",
    hub: { name: "중세 벨하임 · 안개 묘지 언덕", scene: "gothic:graveyard" },
    sites: [
      { key: "chapel", name: "대성당 예배당", scene: "gothic:chapel" },
      { key: "keep", name: "마왕성 지하 성채", dungeon: "castle" },
    ],
    moods: { hub: { weather: "fog", ambient: 0.35, color: "#1c2338" }, keep: { ambient: 0.5, color: "#2a1048" } },
    atmosphere: { keep: ["shades"] },
    // 마왕성 지하: 붉은 융단, 고딕 촛대·화로(보랏빛), 검은 기사 갑옷상, 카타콤 기둥·강철 처녀·새장, 보스방 돌 제단.
    dress: {
      // 예배당 북쪽 벽의 파이프 오르간 — 그 앞 칸이 비밀 스위치 조사(퍼즐) 자리다.
      chapel: [{ object: "kit:atlas_biome_interior/hand-interior:pipe organ", where: "north", mark: "clue", light: "#ffd890" }],
      keep: [
        { object: "kit:wizarding_world/wz-furn-rug", where: "boss" },
        { object: "kit:beodeul_city/bd-pick-castle-catacombs-altar-stone", where: "boss" },
        { object: "kit:gothic_manor/gm-armor", where: "boss", count: 2 },
        { object: "kit:pirate_isles/pi-candelabra", where: "boss", count: 2, light: "#b070ff" },
        { object: "kit:wizarding_world/wz-castle-rug-red", where: "rooms", count: 3 },
        { object: "kit:gothic_manor/gm-armor", where: "rooms", count: 3 },
        { object: "kit:beodeul_city/bd-pick-volcano-cave-brazier", where: "rooms", count: 4, light: "#c060ff" },
        { object: "kit:gothic_manor/gm-statue-gargoyle", where: "rooms", count: 2 },
        { object: "kit:beodeul_city/bd-pick-castle-catacombs-iron-maiden", where: "rooms", count: 2 },
        { object: "kit:beodeul_city/bd-pick-castle-catacombs-cage-hanging", where: "rooms", count: 2 },
      ],
    },
    npcs: [
      { key: "captain", name: "왕국 기사단장", query: "파란 갑옷 기사", lines: ["마왕 나크타르의 군세가 국경을 넘었다. 성검만 있었더라면…"] },
      { key: "frog", name: "개굴경 바르도", query: "양서 기사", lines: ["…부서진 성검 에테르리온. 날을 되살릴 자를 찾고 있다."] },
      { key: "nun", name: "수녀", query: "수녀", lines: ["대성당에서 기도하세요. 왕비님도 그곳에 계십니다."], map: "chapel" },
      { key: "squire", name: "견습 기사", query: "청년 병사", lines: ["단장님은 마왕성 지하에 성검 손잡이가 있다고 하셨어요!"], roam: true },
    ],
    joins: ["frog"],
    clueGraphic: { sheet: "object2", index: 1, beforeDir: "down", afterDir: "up" },
    puzzlePresets: [
      { map: "keep", presetId: "statue_pressure_plates", title: "마왕성 지하 석상 압력 발판" },
    ],
    puzzle: {
      intro: ["낡은 파이프 오르간이다. 건반 위에 먼지가 소복이 쌓여 있다."],
      stages: [
        {
          prompt: "1단계 — 오르간 건반의 어떤 화음을 누를까?", options: ["고대 성가의 첫 화음을 누른다", "건반을 무작위로 두드린다"], answer: 0,
          hit: { lines: ["장엄한 파이프 공명이 예배당 벽면의 잠금쇠를 울렸다!"], fx: ["se:chime2", "emote:music"] },
          miss: { lines: ["불협화음이 성당 가득 울려 퍼졌다… 아무 일도 일어나지 않았다."], fx: ["se:buzzer1"] },
        },
        {
          prompt: "2단계 — 공명하는 오르간 뒤편을 어떻게 할까?", options: ["그냥 물러선다", "뒤쪽 숨은 레버를 당긴다"], answer: 1,
          hit: { lines: ["철컥! 바닥 카펫이 걷히며 지하 성채로 이어지는 비밀 계단이 드러났다!"], fx: ["se:key"] },
          miss: { lines: ["공명이 멎으며 잠금쇠가 다시 닫혔다."] },
        },
      ],
      wrong: ["아무 일도 일어나지 않았다."],
      solvedFx: ["se:collapse1", "shake:6", "flash:white", "particles:dust"],
    },
    quest: {
      title: "성검 에테르리온 복원", summary: "대성당 숨은 계단의 단서로 마왕성 지하 수호자를 쓰러뜨리고 성검을 되살린다.",
      giver: "captain", ask: "대성당 오르간 뒤에 비밀 계단이 있다는 소문이다. 그 아래 기록을 찾아 오게.",
      helper: { npc: "frog", lines: ["손잡이는 마왕성 지하 깊은 곳… 내가 길을 알려 주지."] },
      clue: { map: "chapel", label: "오르간 뒤 숨겨진 스위치", lines: ["딸깍— 바닥이 갈라지며 아래로 내려가는 계단이 드러났다!"] },
      foe: { map: "keep", name: "마왕성 집행관 나크타르의 그림자", query: "마족 장군", graphic: "generated-enemy-demon-lord", intro: ["마왕 나크타르 님의 성채에 발을 들이다니!"], victory: ["크윽… 성검 에테르리온의 손잡이를 가져가라…"] },
      report: ["성검 에테르리온이 다시 빛나는군! 이것으로 마왕 나크타르와 맞설 수 있다."], gold: 600,
    },
    event: {
      map: "chapel", title: "스테인드글라스 아래의 정체",
      beats: [
        { kind: "letterbox", show: true },
        { kind: "moveActor", target: "nun", moves: [{ kind: "move", dir: "down" }], wait: true },
        say("수녀", "…왕비님이라면 이미 저 깊은 곳에 계시지요."),
        { kind: "tint", color: "#3a1030", durationMs: 600, wait: true }, { kind: "shake", intensity: 6, durationMs: 500, axis: "vertical" },
        say("수녀", "크하하! 마왕 나크타르 님의 명으로 너희를 처리한다!"), { kind: "particles", preset: "smoke", target: "player", durationMs: 700, wait: true },
        { kind: "tint", color: "none", durationMs: 400 },
      ],
    },
    gateName: "왕력 600년으로 가는 시대의 문",
  },
  ct_prehistory: {
    title: "태고의 화산석 부락 · 용암 폭포 협곡", era: "태고의 시대 · 화산 협곡",
    hub: { name: "화산석 부락", scene: "prehistoric:village" },
    sites: [
      { key: "canyon", name: "화산 협곡 · 용암 폭포", scene: "prehistoric:volcano" },
      { key: "lair", name: "고대 용의 소굴 용암 동굴", dungeon: "volcano", from: "canyon" },
    ],
    moods: { canyon: { ambient: 0.15, color: "#ff8040" }, lair: { ambient: 0.4, color: "#3a0a00" } },
    atmosphere: { canyon: ["embers"], lair: ["embers"] },
    // 협곡: 소굴로 가는 입구 곁 토템 화로 두 기 — 용암 부싯돌로 불을 붙여야 입구가 열린다(lock).
    dress: { canyon: [{ object: "kit:beodeul_city/bd-pick-volcano-cave-brazier", where: "gate", count: 2, light: "#ff7030" }] },
    npcs: [
      { key: "ayla", name: "타라", query: "원시 전사 소녀", lines: ["타라 강하다! 너 강하다? 같이 싸운다!"] },
      { key: "kino", name: "카루", query: "삐쭉머리 남자아이", lines: ["불꽃 돌… 협곡 너머 용암 동굴에서 빛났다!"] },
      { key: "elder", name: "족장 할멈", query: "노파", lines: ["밤이 되면 불 축제다. 불을 지킬 부싯돌이 필요해."] },
      { key: "child", name: "부락 아이", query: "여자아이", lines: ["화산 비늘족이 협곡 다리를 건너왔대!"], roam: true },
    ],
    joins: ["ayla"],
    clueGraphic: { sheet: "object1", index: 0, beforeDir: "down", afterDir: "up" },
    puzzlePresets: [
      { map: "lair", presetId: "brazier_ignition_order", title: "티라노 소굴 원시 토템 3화로 점화" },
    ],
    puzzle: {
      intro: ["폭포 옆 붉은 바위 틈에서 불을 품은 돌이 빛나고 있다."],
      stages: [],
      wrong: [],
      solvedFx: ["particles:fire", "se:fire5"],
      reward: { item: { id: "item_lava_flint", name: "용암 부싯돌", description: "용암에 달궈져 늘 뜨거운 부싯돌. 고대 용의 소굴 입구의 토템 화로에 불을 붙인다." }, line: "「용암 부싯돌」을 손에 넣었다!" },
    },
    lock: {
      site: "lair", item: "item_lava_flint",
      locked: ["거대한 바위가 동굴 입구를 막고 있다. 곁의 토템 화로는 차갑게 식어 있다…", "(불을 품은 돌이 있으면 화로에 불을 붙일 수 있을 것 같다)"],
      opened: ["용암 부싯돌을 화로에 내리치자 불길이 치솟았다!", "달아오른 바위가 녹아내리며 소굴 입구가 열렸다."],
      fx: ["se:fire7", "particles:fire", "flash:red", "shake:3"],
    },
    quest: {
      title: "부싯돌과 용암 열쇠", summary: "협곡의 부싯돌을 찾고 용암 동굴의 고대 용 아스칼을 물리친다.",
      giver: "elder", ask: "협곡 폭포 옆 바위에 불을 품은 부싯돌이 있다. 그걸 가져오면 동굴 문이 열려.",
      helper: { npc: "kino", lines: ["협곡 다리 건너 붉은 바위다! 뜨거우니 조심!"] },
      clue: { map: "canyon", label: "용암에 달궈진 부싯돌", lines: ["돌을 맞부딪치자 불꽃이 튀며 동굴 쪽 바위가 붉게 빛났다."] },
      foe: { map: "lair", name: "고대 용 아스칼", query: "드레이크", graphic: "generated-enemy-dragon-red", intro: ["크르르릉!! 화산의 심장을 깨운 자들이여, 불꽃으로 돌아가라!"], victory: ["고대 용 아스칼이 물러서며 용암 열쇠가 굴러 나왔다."] },
      report: ["불이 꺼지지 않는다! 오늘 밤 축제, 너희가 주인공이다!"], gold: 400,
    },
    event: {
      map: "hub", title: "화톳불 축제와 타라의 합류",
      beats: [
        { kind: "letterbox", show: true }, { kind: "tint", color: "#40180a", durationMs: 600 },
        { kind: "moveActor", target: "elder", moves: [{ kind: "move", dir: "down" }], wait: true },
        say("족장 할멈", "불을 둘러싸라! 오늘은 부락의 축제다!"),
        { kind: "particles", preset: "fire", target: "player", durationMs: 900, wait: true }, { kind: "emote", target: "player", emote: "music", durationMs: 800 },
        { kind: "moveActor", target: "ayla", moves: [{ kind: "move", dir: "down" }], wait: true },
        say("에이라", "너 강하다. 에이라 따라간다!"), { kind: "tint", color: "none", durationMs: 500 },
      ],
    },
    gateName: "태고의 화산으로 가는 시대의 문",
  },
  ct_zeal: {
    title: "천공 왕국 아스트라 · 해저신전", era: "고대 신기원 · 천공 왕국",
    hub: { name: "아스트라 왕궁 · 하늘 신전", scene: "sky_island:shrine" },
    sites: [
      { key: "dock", name: "검은 날개 선착장", scene: "sky_island:dock" },
      { key: "ocean", name: "해저신전", dungeon: "temple" },
    ],
    moods: { ocean: { ambient: 0.45, color: "#08203c" } },
    atmosphere: { hub: ["magic"], ocean: ["underwater"] },
    // 선착장 한가운데 마석 제단 — 그 앞 칸에서 펜던트로 봉인 문양을 차례로 지운다(퍼즐).
    dress: { dock: [{ object: "kit:sky_island/si-altar", where: "center", mark: "clue", light: "#60a0ff" }] },
    npcs: [
      { key: "prophet", name: "현자 베일", query: "파란 로브 마법사", lines: ["무너진 별의 힘에 손대면 왕국은 바다 밑으로 가라앉으리라."] },
      { key: "schala", name: "신관왕녀 엘리아", query: "신관 · 청록 로브", lines: ["어머니는 별의 성소에 홀리셨어요… 저를 도와주세요."] },
      { key: "janus", name: "시온", query: "남자아이", lines: ["…누나 말고는 아무도 믿지 마."], roam: true },
      { key: "captain", name: "검은 날개 갑판장", query: "뱃사람 · 흰 선원 모자", lines: ["구름 위를 가르는 하늘배, 이게 검은 날개호다."], map: "dock" },
    ],
    clueGraphic: { sheet: "object2", index: 3, beforeDir: "down", afterDir: "up" },
    puzzlePresets: [
      { map: "ocean", presetId: "boss_seal_monoliths", title: "해저신전 삼중 마석 봉인 비석" },
    ],
    // 마석 제단 — 펜던트를 대고 하늘·바다·대지 문양 가운데 예언자가 말한 순서(하늘 → 바다)대로 지운다.
    puzzle: {
      intro: ["푸른 마석 제단이다. 표면에 하늘·바다·대지의 문양 셋이 새겨져 있다.", "(현자 베일: 「제단은 검은 날개 그림자 아래에 있다」… 하늘이 먼저일까?)"],
      stages: [
        {
          prompt: "펜던트를 어느 문양에 먼저 댈까?", options: ["하늘의 문양", "바다의 문양", "대지의 문양"], answer: 0,
          hit: { lines: ["하늘의 문양이 푸르게 빛나며 사라졌다."], fx: ["se:chime2"] },
        },
        {
          prompt: "다음 문양은?", options: ["바다의 문양", "대지의 문양"], answer: 0,
          hit: { lines: ["바다의 문양이 물결처럼 흔들리며 녹아내렸다."], fx: ["se:chime2"] },
        },
      ],
      wrong: ["문양이 붉게 번쩍이며 펜던트를 튕겨 냈다. 처음부터 다시 해야 한다."],
      wrongFx: ["flash:red", "shake:3"],
      solvedFx: ["flash:white", "particles:sparkle"],
    },
    quest: {
      title: "마력 봉인 해제", summary: "선착장의 마석 제단을 깨우고 해저신전 성소를 지키는 골렘을 쓰러뜨린다.",
      giver: "schala", ask: "선착장 끝 마석 제단에 펜던트를 대면 해저신전 봉인이 풀려요.",
      helper: { npc: "prophet", lines: ["제단은 검은 날개 그림자 아래에 있다. 서둘러라, 시간이 없다."] },
      clue: { map: "dock", label: "마석 제단", lines: ["펜던트가 푸르게 공명하며 마석의 봉인 문양이 사라졌다."] },
      foe: { map: "ocean", name: "성소의 골렘 쌍둥이", enemyName: "성소 골렘", count: 2, query: "보라 갑옷 괴물", graphic: "generated-enemy-golem-crystal", intro: ["침입자를 감지. 배제한다."], victory: ["골렘이 무너지며 신전 깊은 곳 문이 열렸다."] },
      report: ["고마워요… 하지만 무너진 별의 심장이 깨어나기 시작했어요."], gold: 800,
    },
    event: {
      map: "ocean", title: "무너진 별의 각성",
      beats: [
        { kind: "letterbox", show: true }, { kind: "distort", effect: "wave", amount: 0.5, durationMs: 500 },
        { kind: "moveActor", target: "player", moves: [{ kind: "move", dir: "up" }], wait: true },
        say("예언자", "이미 늦었다… 라보스가 눈을 뜬다!"),
        { kind: "parallel", beats: [{ kind: "shake", intensity: 10, durationMs: 1200, axis: "vertical" }, { kind: "flash", color: "red", durationMs: 600 }] },
        { kind: "particles", preset: "explosion", target: "player", durationMs: 900, wait: true }, { kind: "distort", effect: "clear", durationMs: 200 },
      ],
    },
    gateName: "천공 왕국으로 가는 시대의 문",
  },
  ct_future: {
    title: "멸망한 미래 · 아리아 돔과 로봇 공장", era: "왕력 2300년 · 잿빛 미래",
    hub: { name: "아리아 돔 크레이터", scene: "sf_station:moonbase" },
    sites: [{ key: "factory", name: "지하 로봇 공장", scene: "sf_station:lab" }],
    moods: { hub: { ambient: 0.4, color: "#20202c" }, factory: { ambient: 0.3, color: "#101826" } },
    atmosphere: { hub: ["ash"], factory: ["sparks"] },
    // 돔: 에너트론 수면 회복 캡슐(장치) + 냉동 포드 묶음. 공장: 중앙 제어 콘솔(단서·퍼즐)과 보조 콘솔·배관.
    dress: {
      hub: [
        { object: "kit:sf_station/sf-cryo-pod", where: "center", mark: "pod", light: "#60c8ff" },
        { object: "kit:sf_station/sf-cryo-bank", where: "center" },
        { object: "kit:sf_station/sf-med-cabinet", where: "center" },
      ],
      factory: [
        { object: "kit:sf_station/sf-console-big", where: "north", mark: "clue", light: "#40e0ff" },
        { object: "kit:sf_station/sf-console-desk", where: "north", count: 2, light: "#40a0ff" },
        { object: "kit:sf_station/sf-pipe-cluster", where: "center", count: 2 },
      ],
    },
    devices: [{
      map: "hub", mark: "pod", name: "에너트론 회복 캡슐",
      graphic: { sheet: "object2", index: 5, beforeDir: "down", afterDir: "up" },
      heal: true, fx: ["flash:blue", "se:recovery7", "particles:heal"],
      lines: ["에너트론이 웅웅 울리며 푸른 빛이 몸을 감싼다…", "HP·MP가 전부 회복되었다! …하지만 배는 여전히 고프다."],
    }],
    npcs: [
      { key: "doan", name: "돔 장로 다온", query: "노인 · 흰 머리(남)", lines: ["씨앗 저장고도 바닥났소… 이 아리아 돔이 마지막 피난처요."] },
      { key: "survivor", name: "생존자", query: "청년 남성", lines: ["에너지 포드 하나만 있으면 오늘은 버틸 수 있어.", "캡슐에 들어가 봐. 배는 안 불러도 기운은 나."], roam: true },
      { key: "robo", name: "기계병 노바", query: "고철 로봇", lines: ["…시스템 정지 상태. 재기동 신호를 기다립니다."] },
      { key: "keeper", name: "공장 관리 로봇", query: "고철 로봇", lines: ["침입자 경고. 생산 라인에서 물러나십시오."], map: "factory" },
    ],
    joins: ["robo"],
    clueGraphic: { sheet: "object2", index: 1, beforeDir: "down", afterDir: "up" },
    puzzlePresets: [
      { map: "factory", presetId: "two_step_sequence", title: "로봇 공장 보안 격벽 2단계 콘솔" },
    ],
    puzzle: {
      intro: ["중앙 제어 콘솔이다. 화면에 「보안 잠금 — 관리자 코드 입력」이 깜박인다."],
      stages: [
        {
          prompt: "관리자 코드를 입력한다", options: ["K-11A", "N-08A", "X-99Z"], answer: 1,
          hit: { lines: ["「코드 확인. 보조 콘솔과 동시 기동이 필요합니다.」"], fx: ["se:key", "flash:blue"] },
          miss: { lines: ["「코드 불일치. 경보 단계 1.」 붉은 경고등이 번쩍인다."], fx: ["se:buzzer1", "flash:red"] },
        },
        {
          prompt: "두 콘솔의 기동 레버를…", options: ["왼쪽 콘솔만 당긴다", "두 레버를 동시에 당긴다", "오른쪽 콘솔만 당긴다"], answer: 1,
          miss: { lines: ["한쪽만 켜지자 회로가 과부하로 튀었다. 처음부터 다시 해야 한다."], fx: ["se:buzzer1", "shake:3"] },
        },
      ],
      wrong: ["콘솔이 반응하지 않는다."],
      solvedFx: ["se:magic1", "flash:blue", "particles:sparkle", "shake:1"],
      reward: { line: "「보안 잠금 해제. N-08A 재기동 신호 송출.」" },
    },
    quest: {
      title: "기계병 노바 재기동", summary: "공장 제어 콘솔에서 재기동 코드를 받아 노바를 깨우고 경비 로봇을 무력화한다.",
      giver: "doan", ask: "저 고철 기계병… 공장 제어 콘솔이라면 깨울 수 있을지도 모르오.",
      helper: { npc: "survivor", lines: ["공장은 북쪽 지하야. 컨베이어 소리가 아직 들려."] },
      clue: { map: "factory", label: "중앙 제어 콘솔", lines: ["화면에 「N-08A 재기동 시퀀스」가 떠오르고 에너지 포드가 충전되었다."] },
      foe: { map: "factory", name: "공장 수호기 가디언", query: "저주 갑옷", graphic: "generated-enemy-golem-iron", intro: ["N-08A 의 반역 확인. 처분합니다."], victory: ["가디언이 불꽃을 튀기며 멈췄다."] },
      report: ["노바가 눈을 떴다니… 이 미래에도 희망이 남아 있었군."], gold: 1000,
    },
    event: {
      map: "factory", title: "기계병 노바 재기동",
      beats: [
        { kind: "letterbox", show: true },
        { kind: "moveActor", target: "player", moves: [{ kind: "move", dir: "up" }], wait: true },
        say("로보", "…시스템 부팅. 기억 장치 손상 37%."),
        { kind: "particles", preset: "sparkle", target: "player", durationMs: 800, wait: true }, { kind: "flash", color: "blue", durationMs: 300 },
        say("기계병 노바", "당신이 저를 깨웠군요. 앞으로 함께하겠습니다."), { kind: "emote", target: "player", emote: "exclamation", durationMs: 700 },
      ],
    },
    gateName: "미래로 가는 시대의 문",
  },
  ff6_narshe: {
    title: "설원 광산 마을 벨른 · 마석 광산", era: "북방 설원 · 마석 광산",
    hub: { name: "설원 광산 마을 벨른", scene: "snow_north:village" },
    sites: [
      { key: "house", name: "장로 하르트의 집", interior: "narshe" },
      { key: "mine", name: "벨른 마석 광산", dungeon: "mine" },
    ],
    moods: { hub: { weather: "snow", ambient: 0.2, color: "#a8c0e0" }, mine: { ambient: 0.45, color: "#0c3446" } },
    atmosphere: { mine: ["spirits"] },
    // 마석 광산: 빛나는 얼음·마석 결정, 광차와 선로 끝 막이, 갱목 버팀목, 맨 안쪽 방에 얼음 속 성수의 수정 제단(단서 자리).
    dress: {
      mine: [
        { object: "kit:sky_island/si-altar", where: "boss", mark: "clue", light: "#80f0ff" },
        { object: "kit:snow_north/sn-ice-pillar", where: "boss", count: 2 },
        { object: "kit:snow_north/sn-ice-crystal", where: "boss", count: 2, light: "#60e0ff" },
        { object: "kit:snow_north/sn-ice-crystal", where: "rooms", count: 4, light: "#60e0ff" },
        { object: "kit:beodeul_city/bd-pick-mining-valley-cart", where: "rooms", count: 2 },
        { object: "kit:beodeul_city/bd-pick-mining-valley-cart-h", where: "rooms" },
        { object: "kit:beodeul_city/bd-pick-mining-valley-pile", where: "rooms", count: 2 },
        { object: "kit:atlas_biome_interior/hand-interior:timber prop", where: "rooms", count: 4 },
        { object: "kit:snow_north/sn-stalagmite-ice", where: "rooms", count: 3 },
        // 선로 끝 막이 곁의 선로 전환기 — 레버 조작 퍼즐 자리(devices).
        { object: "kit:beodeul_city/bd-pick-mining-valley-buffer", where: "rooms", mark: "switch_lever" },
      ],
    },
    // 선로 전환기 — 경비병 말대로 「왼쪽 갱도」로 선로를 돌리고 광차 브레이크를 풀어야 막힌 갱도의 광차가 밀려나며 보급 상자가 드러난다.
    devices: [{
      map: "mine", mark: "switch_lever", name: "광산 철로 선로 전환기",
      graphic: { sheet: "object2", index: 0, beforeDir: "down", afterDir: "up" },
      changeTile: true,
      fx: ["se:collapse1", "shake:4", "particles:dust"],
      lines: ["덜커덩— 광차가 왼쪽 갱도로 미끄러져 내려가며 막힌 선로를 밀어냈다!", "갱도 벽에 숨겨 둔 광부들의 보급 주머니가 굴러 나왔다."],
      done: ["선로는 왼쪽 갱도로 돌려져 있다. 광차는 이미 내려갔다."],
      puzzle: {
        intro: ["녹슨 선로 전환기다. 레버와 광차 브레이크 손잡이가 달려 있다.", "(경비병: 「뒷길은 철로를 따라가다 왼쪽 갱도야」)"],
        stages: [
          {
            prompt: "레버를 어느 쪽으로 당길까?", options: ["왼쪽 갱도로", "오른쪽 갱도로", "그대로 둔다"], answer: 0,
            hit: { lines: ["철컥! 선로가 왼쪽 갱도로 맞물렸다."], fx: ["se:key"] },
            miss: { lines: ["선로가 오른쪽으로 꺾였다… 그쪽 갱도는 무너져 있다."], fx: ["se:buzzer1"] },
          },
          {
            prompt: "광차 브레이크는?", options: ["브레이크를 푼다", "브레이크를 더 조인다"], answer: 0,
            hit: { lines: ["끼이익— 브레이크가 풀리며 광차가 움직이기 시작했다."] },
          },
        ],
        wrong: ["아무것도 움직이지 않는다. 레버를 처음부터 다시 맞춰 보자."],
        wrongFx: ["shake:2"],
        solvedFx: ["flash:white"],
        reward: { gold: 300, line: "보급 주머니에서 300G 를 얻었다!" },
      },
    }],
    npcs: [
      { key: "arvis", name: "장로 하르트", query: "터번 노인", lines: ["추격대 병사들이 광산 안 얼음 속 성수를 노리고 있네."] },
      { key: "guard", name: "광산 경비병", query: "청년 병사", lines: ["철갑 기병대가 오면 광산 철로 입구를 지킨다!"] },
      { key: "miner", name: "광부", query: "갈색 머리 중년 전사", lines: ["깊은 갱도에서 얼음이 노래를 불러… 소름이 끼쳐."], roam: true },
      { key: "terra", name: "리아", query: "요정 소녀", lines: ["…아무것도 기억나지 않아요. 왜 저 얼음이 부르는 걸까요."], map: "house" },
    ],
    joins: ["terra"],
    clueGraphic: { sheet: "object2", index: 6, beforeDir: "down", afterDir: "up" },
    puzzlePresets: [
      { map: "mine", presetId: "dynamite_rock_blast", title: "나르셰 마석 광산 낙석 다이너마이트 폭파" },
    ],
    quest: {
      title: "얼음 속 성수", summary: "광산 깊은 곳 얼어붙은 성수와 공명하고 갱도 수호수를 물리친다.",
      giver: "arvis", ask: "리아를 데리고 광산 뒷길로 빠져나가게. 얼음 속 성수가 그녀를 부르고 있어.",
      helper: { npc: "guard", lines: ["뒷길은 철로를 따라가다 왼쪽 갱도야. 몬스터가 들끓으니 조심해."] },
      clue: { map: "mine", label: "얼어붙은 성수", lines: ["얼음이 푸르게 빛나며 리아와 성수가 서로를 부른다!"] },
      foe: { map: "mine", name: "서리 껍질 수호수", query: "슬라임", graphic: "generated-enemy-crab-rock", intro: ["껍질에 서리 번개가 흐른다… 공격하면 반격한다!"], victory: ["수호수가 껍질 속으로 움츠러들며 쓰러졌다."] },
      report: ["성수와 공명했다고? 그 아이는… 별의 기억을 품은 아이였군."], gold: 500,
    },
    event: {
      map: "mine", title: "성수 공명",
      beats: [
        { kind: "letterbox", show: true },
        { kind: "moveActor", target: "player", moves: [{ kind: "move", dir: "up" }], wait: true },
        say("티나", "…이 소리는? 누군가 나를 부르고 있어."),
        { kind: "parallel", beats: [{ kind: "flash", color: "purple", durationMs: 800 }, { kind: "shake", intensity: 3, durationMs: 900, axis: "both" }] },
        { kind: "particles", preset: "magic", target: "player", durationMs: 1000, wait: true }, { kind: "look", target: "player", pose: "fallen" },
        say("장로 하르트", "리아! 정신 차리게!"), { kind: "look", target: "player", reset: true },
      ],
    },
  },
  ff6_figaro_opera: {
    title: "모래기계성 솔라리스 · 오페라 하우스", era: "사막 왕국 · 솔라리스",
    hub: { name: "모래기계성 솔라리스", scene: "desert_east:palace" },
    sites: [
      { key: "engine", name: "솔라리스 성 기관실", interior: "magitek" },
      { key: "opera", name: "오페라 하우스 무대", interior: "opera" },
    ],
    moods: { hub: { ambient: 0, color: "#fff0c0" }, opera: { ambient: 0.35, color: "#2a1830" } },
    atmosphere: { hub: ["sand"] },
    npcs: [
      { key: "edgar", name: "기계왕 레온", query: "왕", lines: ["솔라리스는 침묵하고 있지만… 별의 약속까지 잊은 적은 없다."] },
      { key: "chancellor", name: "솔라리스 대신", query: "귀족 남성", lines: ["폐하, 성을 모래 아래로 잠항시킬 준비가 끝났습니다."] },
      { key: "engineer", name: "기관장", query: "기어 정비사", lines: ["사막 아래로 성을 숨기는 거대한 기어! 이게 솔라리스의 자랑이지."], map: "engine" },
      { key: "impresario", name: "극장 지배인", query: "중절모 신사", lines: ["가희 아리아의 대역이라니! 노래만 외우면 무대에 설 수 있소!"], map: "opera" },
    ],
    joins: ["edgar"],
    clueGraphic: { sheet: "object2", index: 5, beforeDir: "down", afterDir: "up" },
    puzzlePresets: [
      { map: "engine", presetId: "sluice_lava_bridge", title: "피가로 기관실 모래 잠항 밸브" },
    ],
    // 무대 위 아리아 — 1·2·3절 가사를 맞게 이어 불러야 박수 속에 공연이 이어지고, 들보 위 울트로스의 추가 드러난다.
    puzzle: {
      intro: ["조명이 무대를 비춘다. 가희의 드레스를 입고 「별빛의 아리아」를 부를 차례다."],
      stages: [
        {
          prompt: "1절 — 첫 소절은?", options: ["검은 바람이여…", "오 나의 영웅이여…"], answer: 1,
          hit: { lines: ["♪ 오 나의 영웅이여, 멀리 떠나간 그대여…"], fx: ["tint:#3a2850", "emote:music"] },
          miss: { lines: ["객석이 웅성거린다. 「…그건 다른 노래 아니야?」"], fx: ["se:buzzer1", "emote:sweat"] },
        },
        {
          prompt: "2절 — 이어지는 가사는?", options: ["별이 지는 밤에도 기다리리…", "사막의 모래폭풍 속에…"], answer: 0,
          hit: { lines: ["♪ 별이 지는 밤에도 기다리리…"], fx: ["particles:sparkle", "emote:music"] },
          miss: { lines: ["지휘자가 지휘봉을 떨어뜨렸다. 처음부터 다시!"], fx: ["se:buzzer1", "emote:sweat"] },
        },
        {
          prompt: "3절 — 마지막 소절은?", options: ["성문을 걸어 잠가라!", "약속의 꽃다발을 그대에게!"], answer: 1,
          hit: { lines: ["♪ 약속의 꽃다발을 그대에게!"], fx: ["particles:sparkle", "emote:heart"] },
          miss: { lines: ["극장 지배인이 무대 옆에서 머리를 감싸 쥐었다."], fx: ["se:buzzer1", "emote:sweat"] },
        },
      ],
      wrong: ["노래가 끊겼다."],
      solvedFx: ["se:chime2", "flash:white", "particles:sparkle", "tint:clear"],
      reward: { gold: 500, line: "객석에서 우레 같은 박수가 터졌다! 꽃다발과 함께 출연료 500G 를 받았다." },
    },
    quest: {
      title: "별빛의 아리아", summary: "오페라 공연을 지키며 무대 위 샹들리에 아래에서 심해 괴수를 막는다.",
      giver: "edgar", ask: "오페라 하우스로 가서 지배인을 만나게. 가희로 분장해야 하늘해적의 비공정을 빌릴 수 있어.",
      helper: { npc: "impresario", lines: ["악보는 무대 뒤에 있소. 2막 아리아가 핵심이오!"] },
      clue: { map: "opera", label: "무대 위 샹들리에", lines: ["샹들리에가 흔들린다… 천장 들보 위에 누가 무거운 추를 올려놨다!"] },
      foe: { map: "opera", name: "심해 괴수 크라켄", query: "청룡", graphic: "generated-enemy-squid-deep", intro: ["크르르! 4톤 추로 공연장을 박살 내 주지!"], victory: ["심해 괴수가 먹물을 뿜으며 물러났다!"] },
      report: ["공연을 지켰군! 이제 비공정 알바트로스로 잔해의 탑에 맞선다."], gold: 1200,
    },
    event: {
      map: "opera", title: "아리아 컷신",
      beats: [
        { kind: "letterbox", show: true }, { kind: "tint", color: "#201030", durationMs: 600 },
        { kind: "moveActor", target: "impresario", moves: [{ kind: "move", dir: "down" }], wait: true },
        say("마리아", "오 나의 사랑, 나의 왕자… 별이 지는 밤에도 기다리리…"),
        { kind: "particles", preset: "sparkle", target: "player", durationMs: 900, wait: true }, { kind: "emote", target: "player", emote: "music", durationMs: 900 },
        say("극장 지배인", "브라보! 하지만 들보 위에 저 문어는 대체…?!"), { kind: "tint", color: "none", durationMs: 400 },
      ],
    },
  },
  ff6_zozo_kefka: {
    title: "증기 시계탑 도시 크로노스 · 잔해의 탑", era: "붕괴 후 · 시계탑과 잔해의 탑",
    hub: { name: "증기 시계탑 도시 크로노스", scene: "steampunk_city:street" },
    sites: [
      { key: "clock", name: "크로노스 시계탑 아파트", interior: "zozo" },
      { key: "tower", name: "나크타르의 잔해의 탑", dungeon: "volcano" },
    ],
    moods: { hub: { weather: "rain", ambient: 0.45, color: "#18202c" }, tower: { ambient: 0.45, color: "#3a0a24" } },
    atmosphere: { hub: ["leaks"], tower: ["embers"] },
    // 잔해의 탑: 용암 균열, 의식 마법진(봉인), 부서진 마도 갑옷·톱니·고철, 불 수정, 꼭대기 방에 흑요석 제단과 날개 석상.
    dress: {
      // 시계탑 아파트 북쪽 벽의 멈춘 벽시계 — 그 앞 칸에서 바늘을 맞춘다(퍼즐).
      clock: [{ object: "kit:atlas_biome_interior/hand-interior:wall clock", where: "north", mark: "clue" }],
      tower: [
        { object: "kit:beodeul_city/bd-pick-volcano-cave-altar", where: "boss", light: "#ffd040" },
        { object: "kit:sky_island/si-statue", where: "boss", count: 2 },
        { object: "kit:atlas_biome_interior/hand-interior:magic circle", where: "boss", light: "#ff60c0" },
        { object: "kit:beodeul_city/bd-pick-volcano-cave-lava-strip", where: "rooms", count: 3, light: "#ff6020" },
        { object: "kit:gothic_manor/gm-ov-ritual", where: "rooms", count: 2, light: "#ff40a0" },
        { object: "kit:atlas_biome_interior/hand-interior:magitek armor", where: "rooms", count: 2 },
        { object: "kit:wizarding_world/wz-clock-gear-m", where: "rooms" },
        { object: "kit:steampunk_city/sp-scrap-heap", where: "rooms", count: 3 },
        { object: "kit:beodeul_city/bd-pick-volcano-cave-fire-crystal", where: "rooms", count: 3, light: "#ff9030" },
      ],
    },
    npcs: [
      { key: "liar", name: "거짓말쟁이 사내", query: "단원 · 검은 코트(남)", lines: ["시계는 6시 정각이야. (이 거리 사람은 모두 거짓말을 한다)"] },
      { key: "dancer", name: "무희", query: "젊은 여성", lines: ["초침은 50초가 아니야… 아마도."] },
      { key: "sabin", name: "로코", query: "갈색 머리 중년 전사", lines: ["동료들은 어디 있지? 별이 무너진 뒤로 흩어졌어."] },
      { key: "celes", name: "이리스", query: "붉은 갑옷 여전사", lines: ["모두를 다시 모아야 해. 종말의 사도 나크타르를 쓰러뜨리려면."] },
      { key: "clockman", name: "시계지기", query: "노인 · 회색 머리 보라 숄(여)", lines: ["진짜 시각은 거짓말 사이에 숨어 있지."], map: "clock" },
    ],
    joins: ["sabin"],
    clueGraphic: { sheet: "object2", index: 1, beforeDir: "down", afterDir: "up" },
    puzzlePresets: [
      { map: "tower", presetId: "riddle_mimic_chests", title: "케프카의 탑 진실의 보물상자 수수께끼" },
    ],
    // 조조의 시계 — 거짓말쟁이 셋의 말을 뒤집어 시·분·초를 차례로 맞춘다(6시 10분 50초).
    puzzle: {
      intro: ["멈춘 벽시계다. 바늘 세 개를 손으로 돌릴 수 있다.", "(크로노스 거리 사람들은 모두 거짓말을 한다… 들은 말을 뒤집어 보자)"],
      stages: [
        { prompt: "시침을 맞춘다", options: ["2시", "6시", "9시"], answer: 1, hit: { lines: ["딸깍 — 시침이 6에 걸렸다."], fx: ["se:clock"] }, miss: { lines: ["끼익… 시침이 제자리로 튕겨 돌아갔다."], fx: ["se:buzzer1"] } },
        { prompt: "분침을 맞춘다", options: ["10분", "30분", "45분"], answer: 0, hit: { lines: ["딸깍 — 분침이 2를 가리킨다."], fx: ["se:clock"] }, miss: { lines: ["끼익… 분침이 제자리로 튕겨 돌아갔다."], fx: ["se:buzzer1"] } },
        { prompt: "초침을 맞춘다", options: ["20초", "50초", "0초"], answer: 1, hit: { lines: ["딸깍 — 세 바늘이 맞물렸다!"], fx: ["se:clock", "shake:1"] }, miss: { lines: ["끼익… 바늘이 전부 처음으로 돌아갔다."], fx: ["se:buzzer1", "emote:sweat"] } },
      ],
      wrong: ["시계는 다시 멈췄다."],
      solvedFx: ["se:bell", "flash:white", "particles:sparkle"],
      reward: { item: { id: "item_zozo_clock_key", name: "시계탑 열쇠", description: "크로노스 시계 뒤 벽에서 떨어진 태엽 열쇠. 비공정 격납고와 잔해의 탑 봉인 문을 연다." }, line: "「시계탑 열쇠」를 손에 넣었다!" },
    },
    quest: {
      title: "시계탑의 수수께끼와 재집결", summary: "크로노스 거짓말쟁이들의 말로 시계 비밀을 풀고 잔해의 탑의 나크타르에게 도전한다.",
      giver: "celes", ask: "로코가 크로노스 시계탑에 단서가 있대. 시계를 맞추면 숨은 방이 열린다나 봐.",
      helper: { npc: "liar", lines: ["시계는 6시 10분 50초… 아니, 내가 그렇게 말했다면 거짓말이지."] },
      clue: { map: "clock", label: "멈춘 벽시계", lines: ["바늘을 6시 10분 50초에 맞추자 벽 뒤에서 열쇠가 떨어졌다."] },
      foe: { map: "tower", name: "종말의 사도 나크타르", query: "마왕", graphic: "generated-enemy-demon-lord", intro: ["크하하! 무너진 별의 잔해 위에서 새로운 종말을 울려 주마!"], victory: ["나크타르: 이, 이럴 수가… 시대의 종소리가 나를…!"] },
      report: ["다들 돌아왔어. 이제 무너진 별을 다시 일으킬 차례야."], gold: 3000,
    },
    event: {
      map: "hub", title: "흩어진 동료 재집결",
      beats: [
        { kind: "letterbox", show: true }, { kind: "weather", weather: "rain", intensity: 0.8, durationMs: 400 },
        { kind: "moveActor", target: "celes", moves: [{ kind: "move", dir: "down" }], wait: true },
        say("셀리스", "…마슈? 정말 마슈야?"),
        { kind: "moveActor", target: "sabin", moves: [{ kind: "move", dir: "up" }], wait: true },
        say("마슈", "셀리스! 살아 있었구나!"),
        { kind: "emote", target: "player", emote: "exclamation", durationMs: 700 }, { kind: "particles", preset: "heal", target: "player", durationMs: 800, wait: true },
        say("이리스", "모두를 찾아서 나크타르의 잔해의 탑으로 가자."),
      ],
    },
  },
} as const satisfies Record<string, ChapterSpec>;

export type JrpgChapterId = keyof typeof JRPG_CHAPTERS;
export const JRPG_CHAPTER_IDS = Object.keys(JRPG_CHAPTERS) as JrpgChapterId[];

const key = (c: Cell): string => `${c.x},${c.y}`;
const BEAT_LABEL: Record<string, string> = {
  say: "대사", letterbox: "레터박스", flash: "섬광", shake: "흔들림", particles: "입자", distort: "왜곡", tint: "색조",
  emote: "감정 말풍선", look: "자세", weather: "날씨", parallel: "동시 연출", moveActor: "배우 이동", camera: "카메라 이동",
};

/** 걸음 덩이 가운데에 가장 가까운 칸 — NPC·사건 자리의 기준(마을 광장 근처). */
function centerOf(project: Project, map: GameMap): Cell {
  const main = mainComponent(project, map);
  let best: Cell | undefined, bestD = Infinity;
  for (const k of main) {
    const [x, y] = k.split(",").map(Number) as [number, number];
    const d = Math.abs(x - map.width / 2) + Math.abs(y - map.height / 2);
    if (d < bestD) { bestD = d; best = { x, y }; }
  }
  if (!best) throw new ToolError(`${map.name} 에 걸을 수 있는 칸이 없다`, { code: "no-walkable", mapId: map.id });
  return best;
}

/** 거점의 출입구 자리 — 집 문(실내용)이 있으면 문 앞, 아니면 가장자리, 둘 다 없으면(하늘섬) 가장 먼 빈 칸. */
function hubGate(project: Project, hub: GameMap, taken: Set<string>, preferDoor: boolean): { cell: Cell; doorAt?: Cell } | undefined {
  const main = mainComponent(project, hub);
  if (preferDoor) {
    const door = houseDoors(project, hub, main).find((d) => !taken.has(key(d.front)));
    if (door) return { cell: door.front, doorAt: door.door };
  }
  const edge = edgeGate(hub, main);
  if (edge && !taken.has(key(edge))) return { cell: edge };
  const far = pickSpot(project, hub, centerOf(project, hub), taken, 0.92, 3);
  return far ? { cell: far } : undefined;
}

/** 앞 맵의 한 변에서 걸음 덩이에 붙은 가장자리 칸 — 변 가운데에 가까운 칸. */
function sideGate(project: Project, map: GameMap, taken: Set<string>, side: "north" | "south" | "east" | "west"): { cell: Cell; doorAt?: Cell } | undefined {
  const main = mainComponent(project, map);
  const on = (x: number, y: number): boolean =>
    side === "north" ? y === 0 : side === "south" ? y === map.height - 1 : side === "west" ? x === 0 : x === map.width - 1;
  const cells = [...main]
    .map((k) => { const [x, y] = k.split(",").map(Number) as [number, number]; return { x, y }; })
    .filter((c) => on(c.x, c.y) && !taken.has(key(c)) && !(map.events ?? []).some((e) => e.x === c.x && e.y === c.y));
  const off = (c: Cell): number => (side === "north" || side === "south" ? Math.abs(c.x - map.width / 2) : Math.abs(c.y - map.height / 2));
  const best = cells.sort((a, b) => off(a) - off(b))[0];
  return best ? { cell: best } : undefined;
}

interface RoomRect { readonly id: string; readonly x: number; readonly y: number; readonly w: number; readonly h: number }
interface DressResult { readonly lights: Array<Record<string, unknown>>; readonly placed: string[]; readonly marks: Map<string, Cell> }

function kitSize(project: Project, objectId: string): { w: number; h: number } | undefined {
  const m = /^kit:([^/]+)\/(.+)$/u.exec(objectId);
  const kit = m ? project.tilesets[m[1]!]?.structureKits?.find((k) => k.id === m[2]) : undefined;
  return kit ? { w: kit.width, h: kit.height } : undefined;
}

/**
 * 장면 소품을 빈 바닥에 세운다. 소품 둘레 한 칸이 모두 걸을 수 있는 빈 칸이어야 한다 — 둘레가 이어진 고리라 소품이
 * 길을 끊지 못하고, 벽 몰딩·문·계단·다른 소품·이벤트에 붙지 않는다(2026-10-18 R1: 던전 계단·철문이 벽 몰딩에 겹쳤다).
 * 자리 = 기준점(북·가운데·남·보스방·방들)에서 가장 가까운 빈 사각형. 방 안 소품은 그 방 바닥 안에서만 찾는다.
 */
function dressMap(
  project: Project, map: GameMap, items: readonly DressSpec[], rooms: readonly RoomRect[], bossId: string | undefined, taken: Set<string>, warnings: string[],
  fairAt?: Cell, gateAt?: Cell,
): DressResult {
  const out: DressResult = { lights: [], placed: [], marks: new Map() };
  const blocked = new Set(taken);
  for (const e of map.events ?? []) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) blocked.add(`${e.x + dx},${e.y + dy}`);
  const mainSet = mainComponent(project, map);
  const main = [...mainSet].map((k) => k.split(",").map(Number) as [number, number]);
  if (!main.length) return out;
  // 바깥 맵(방 없음): 길·다리 위에 소품을 세우지 않는다(R2: 꽃수레가 다리를, 텔레포드가 북쪽 길을 막았다).
  // 길 = 집 문 앞에서 가장 흔한 바닥(풀) 아닌 칸을 따라 이어진 칸(길 타일은 변주·가장자리가 섞여 타일 하나로 못 잡는다),
  // 다리·계단 = 걸을 수 있는 칸의 1% 미만인 드문 바닥 타일.
  const offCells = new Set<string>();
  // 바깥 맵의 풀숲·바위·꽃 같은 낱개 장식(구조물 밖 상층 덩어리 4칸 이하)은 소품 자리를 위해 통째로 걷어 낼 수 있다 —
  // 마을 구성기가 빈 풀밭을 덤불로 채워 축제 노점이 설 데가 없었다(R2 트루스). 집·밭(구조물)은 건드리지 않는다.
  // 장터 마당(where fair)은 한 번 더 나아가 나무 덩어리(60칸 이하)까지 통째로 걷어 빈 마당을 낸다.
  const looseOf = new Map<number, number[]>();
  const groveOf = new Map<number, number[]>();
  if (!rooms.length) {
    const kits = new Map((project.tilesets[map.tilesetId]?.structureKits ?? []).map((kit) => [kit.id, kit]));
    const covered = new Set<number>();
    for (const p of map.structurePlacements ?? []) {
      const kit = kits.get(p.kitId);
      if (kit) for (let dy = 0; dy < kit.height; dy++) for (let dx = 0; dx < kit.width; dx++) covered.add((p.y + dy) * map.width + p.x + dx);
    }
    const decor = (i: number): boolean => !covered.has(i) && (layerTileAt(map, 3, i) >= 0 || layerTileAt(map, 4, i) >= 0);
    const done = new Set<number>();
    for (let i = 0; i < map.width * map.height; i++) {
      if (done.has(i) || !decor(i)) continue;
      const part = [i];
      done.add(i);
      for (let q = 0; q < part.length; q++) {
        const cx = part[q]! % map.width, cy = Math.floor(part[q]! / map.width);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx, ny = cy + dy, n = ny * map.width + nx;
          if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height || done.has(n) || !decor(n)) continue;
          done.add(n);
          part.push(n);
        }
      }
      if (part.some((n) => (map.relief?.levels[n] ?? 0) !== 0)) continue;
      if (part.length <= 60) for (const n of part) groveOf.set(n, part);
      if (part.length <= 4) for (const n of part) looseOf.set(n, part);
    }
  }
  const lowerAt = (x: number, y: number): number => map.lowerTiles[y * map.width + x] ?? -1;
  let ground = -1;
  if (!rooms.length) {
    const freq = new Map<number, number>();
    for (const [x, y] of main) freq.set(lowerAt(x, y), (freq.get(lowerAt(x, y)) ?? 0) + 1);
    ground = [...freq].sort((a, b) => b[1] - a[1])[0]![0];
    for (const [x, y] of main) if ((freq.get(lowerAt(x, y)) ?? 0) < main.length * 0.01) offCells.add(`${x},${y}`);
    // 문 앞에 NPC·출입구가 선 집도 길의 씨앗이다 — 이벤트를 비운 맵 사본으로 문을 찾는다.
    // 드문 칸(교차로 변주 등)도 길을 따라 지나가야 하므로 방문 표시는 offCells 와 따로 둔다.
    // 광장은 길과 이어져 있지만 노점 자리다 — 풀(바닥)과 한 칸 안에 닿은 칸만 길로 친다(1~2칸 폭 길은 다 닿는다).
    const nearGround = (c: Cell): boolean => {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const x = c.x + dx, y = c.y + dy;
        if (x >= 0 && y >= 0 && x < map.width && y < map.height && lowerAt(x, y) === ground) return true;
      }
      return false;
    };
    const queue = houseDoors(project, { ...map, events: [] }, mainSet).map((d) => d.front).filter((c) => lowerAt(c.x, c.y) !== ground);
    const seen = new Set(queue.map(key));
    while (queue.length) {
      const c = queue.pop()!;
      if (nearGround(c)) offCells.add(key(c));
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const n = { x: c.x + dx, y: c.y + dy }, k = key(n);
        if (seen.has(k) || n.x < 0 || n.y < 0 || n.x >= map.width || n.y >= map.height || lowerAt(n.x, n.y) === ground || !isPassable(project, map, n.x, n.y)) continue;
        seen.add(k);
        queue.push(n);
      }
    }
  }
  const minY = Math.min(...main.map(([, y]) => y)), maxY = Math.max(...main.map(([, y]) => y));
  const center = centerOf(project, map);
  const boss = rooms.find((r) => r.id === bossId);
  const others = rooms.filter((r) => r !== boss);
  // 장터 마당 — fair 소품 발자국(둘레 한 줄 공유) 넓이의 1.2배 사각형을 지도 가운데에 가장 가까운 자리에서 고르고,
  // 그 안·둘레에 닿은 장식 덩어리를 통째로 걷는다. 마당은 길·광장을 품어도 된다(소품은 길 칸을 밟지 않으니 장터 거리가 된다).
  // 물·단·구조물(집)·이벤트 칸은 마당이 되지 못한다.
  let fair: RoomRect | undefined;
  const fairItems = items.filter((item) => item.where.startsWith("fair"));
  if (!rooms.length && fairItems.length) {
    const area = fairItems.reduce((sum, item) => { const s = kitSize(project, item.object); return sum + (s ? (s.w + 1) * (s.h + 1) * (item.count ?? 1) : 0); }, 0) * 1.2;
    const tallest = Math.max(...fairItems.map((item) => kitSize(project, item.object)?.h ?? 1));
    const usable = (x: number, y: number): boolean => {
      const i = y * map.width + x;
      if (blocked.has(`${x},${y}`) || (map.relief?.levels[i] ?? 0) !== 0) return false;
      if (groveOf.has(i) && lowerAt(x, y) === ground) return true;
      return isPassable(project, map, x, y) && layerTileAt(map, 3, i) < 0;
    };
    // 마을 큰길 띠처럼 가로로 긴 마당도 받는다 — 높이 6칸부터 정사각에 가까울 때까지.
    // 다 들어갈 마당이 없으면 넓이를 10%씩 줄인다. 마을 광장(fairAt)이 있으면 그 14칸 안 마당만 — 맵 반대편 빈터에 장터를 따로 세우지 않는다.
    let best: RoomRect & { score: number } | undefined;
    const minH = Math.min(6, tallest + 2);
    for (let want = area; !best && want >= minH * minH; want *= 0.9) {
      for (let fh = minH; fh <= Math.ceil(Math.sqrt(want)); fh++) {
        const fw = Math.ceil(want / fh);
        for (let y = 1; y + fh < map.height - 1; y++) for (let x = 1; x + fw < map.width - 1; x++) {
          let ok = true, cleared = 0;
          for (let yy = y; yy < y + fh && ok; yy++) for (let xx = x; xx < x + fw; xx++) {
            if (!usable(xx, yy)) { ok = false; break; }
            if (groveOf.has(yy * map.width + xx)) cleared++;
          }
          if (!ok) continue;
          // 마을 구성기가 낸 광장이 있으면 그 곁에 장터를 붙인다(광장의 우물·노점과 한 덩어리로 읽힌다). 없으면 지도 가운데.
          const near = fairAt ?? center;
          const dist = Math.abs(x + fw / 2 - near.x) + Math.abs(y + fh / 2 - near.y);
          if (fairAt && dist > 14) continue;
          const score = dist + cleared * 0.25;
          if (!best || score < best.score) best = { id: "fair", x, y, w: fw, h: fh, score };
        }
      }
    }
    if (best) {
      fair = { id: "fair", x: best.x, y: best.y, w: best.w, h: best.h };
      const parts = new Set<number[]>();
      for (let yy = best.y - 1; yy <= best.y + best.h; yy++) for (let xx = best.x - 1; xx <= best.x + best.w; xx++) {
        const part = groveOf.get(yy * map.width + xx);
        if (part) parts.add(part);
      }
      for (const part of parts) for (const i of part) { setLayerTileAt(map, 3, i, -1); setLayerTileAt(map, 4, i, -1); looseOf.delete(i); groveOf.delete(i); }
    } else warnings.push(`${map.name}: 넓이 ${Math.round(area)}칸 장터 마당을 낼 자리가 없다 — 장터 소품은 가운데 빈 바닥에 선다`);
  }
  let cursor = 0;
  /** 장터 소품을 세우는 동안은 나무 덩어리(groveOf)까지 걷을 수 있다 — 마당 둘레 숲을 열어 장터를 잇는다. */
  let groveOk = false;
  const decorPart = (i: number): number[] | undefined => looseOf.get(i) ?? (groveOk ? groveOf.get(i) : undefined);
  /** 걷어 낼 수 있는 낱개 장식이 얹힌 풀 칸 — 걷어 내면 빈 바닥이 된다. */
  const clearable = (xx: number, yy: number): boolean => decorPart(yy * map.width + xx) !== undefined && lowerAt(xx, yy) === ground;
  const fits = (x: number, y: number, w: number, h: number, room: RoomRect | undefined): boolean => {
    if (room && (x < room.x || y < room.y || x + w > room.x + room.w || y + h > room.y + room.h)) return false;
    for (let yy = y - 1; yy <= y + h; yy++) for (let xx = x - 1; xx <= x + w; xx++) {
      if (xx < 0 || yy < 0 || xx >= map.width || yy >= map.height || blocked.has(`${xx},${yy}`) || offCells.has(`${xx},${yy}`) && xx >= x && xx < x + w && yy >= y && yy < y + h) return false;
      if (clearable(xx, yy)) continue;
      if (!isPassable(project, map, xx, yy)) return false;
      const inside = xx >= x && xx < x + w && yy >= y && yy < y + h;
      if (inside && (map.upperTiles[yy * map.width + xx] ?? -1) >= 0) return false;
    }
    return true;
  };
  /** 자리(발자국 + 둘레)에 닿은 낱개 장식 덩어리를 통째로 걷는다 — 되돌릴 수 있게 원래 타일을 돌려준다. */
  const clearDecor = (x: number, y: number, w: number, h: number): Array<[number, number, number]> => {
    const saved: Array<[number, number, number]> = [];
    const parts = new Set<number[]>();
    for (let yy = y - 1; yy <= y + h; yy++) for (let xx = x - 1; xx <= x + w; xx++) {
      const part = xx >= 0 && yy >= 0 && xx < map.width && yy < map.height ? decorPart(yy * map.width + xx) : undefined;
      if (part) parts.add(part);
    }
    for (const part of parts) for (const i of part) {
      saved.push([i, layerTileAt(map, 3, i), layerTileAt(map, 4, i)]);
      setLayerTileAt(map, 3, i, -1);
      setLayerTileAt(map, 4, i, -1);
    }
    return saved;
  };
  const place = (item: DressSpec, size: { w: number; h: number }, anchor: Cell, room: RoomRect | undefined, maxD = Infinity): boolean => {
    const spots: Array<{ x: number; y: number; d: number }> = [];
    const x0 = Math.max(1, room?.x ?? 1), y0 = Math.max(1, room?.y ?? 1);
    const x1 = Math.min(map.width - 1, room ? room.x + room.w : map.width - 1), y1 = Math.min(map.height - 1, room ? room.y + room.h : map.height - 1);
    for (let y = y0; y + size.h <= y1; y++) for (let x = x0; x + size.w <= x1; x++) {
      const d = Math.abs(x + size.w / 2 - anchor.x) + Math.abs(y + size.h / 2 - anchor.y);
      if (d <= maxD && fits(x, y, size.w, size.h, room)) spots.push({ x, y, d });
    }
    spots.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
    for (const s of spots.slice(0, 6)) {
      const saved = clearDecor(s.x, s.y, size.w, size.h);
      try { nested(project, "stamp_object", { objectId: item.object, mapId: map.id, x: s.x, y: s.y }); }
      catch {
        for (const [i, upper, overlay] of saved) { setLayerTileAt(map, 3, i, upper); setLayerTileAt(map, 4, i, overlay); }
        continue;
      }
      for (const [i] of saved) { looseOf.delete(i); groveOf.delete(i); }
      for (let yy = s.y; yy < s.y + size.h; yy++) for (let xx = s.x; xx < s.x + size.w; xx++) blocked.add(`${xx},${yy}`);
      const mid = { x: s.x + Math.floor(size.w / 2), y: s.y + Math.floor(size.h / 2) };
      if (item.light) out.lights.push({ id: `light_${map.id}_${out.lights.length + 1}`, at: mid, radius: 3, intensity: 0.9, color: item.light, flicker: true });
      if (item.mark && !out.marks.has(item.mark)) {
        // 소품 앞(남쪽) 가운데 칸 — 둘레 고리 안이라 늘 걸을 수 있는 빈 칸이다.
        const front = { x: mid.x, y: s.y + size.h };
        out.marks.set(item.mark, front);
        blocked.add(key(front));
      }
      out.placed.push(`${item.object.split("/").pop()} (${s.x},${s.y})`);
      return true;
    }
    return false;
  };
  for (const item of items) {
    const size = kitSize(project, item.object);
    if (!size) { warnings.push(`${map.name}: 소품 ${item.object} 를 찾지 못했다`); continue; }
    for (let n = 0; n < (item.count ?? 1); n++) {
      let ok = false;
      if (item.where === "boss" && boss) ok = place(item, size, { x: boss.x + Math.floor(boss.w / 2), y: boss.y + Math.floor(boss.h / 2) }, boss);
      else if (item.where === "rooms" && others.length) {
        for (let t = 0; t < others.length && !ok; t++) {
          const room = others[cursor++ % others.length]!;
          ok = place(item, size, { x: room.x + Math.floor(room.w / 2), y: room.y + Math.floor(room.h / 2) }, room);
        }
      } else if (item.where.startsWith("fair") && fair) {
        // 무대는 북쪽 가운데, 분수는 마당 한가운데, 노점·깃발·등은 네 귀퉁이를 돌며 둘레에 붙인다 — 가운데가 비어야 장터 마당으로 읽힌다.
        const corner = cursor++ % 4;
        const anchor = item.where === "fair-north" ? { x: fair.x + Math.floor(fair.w / 2), y: fair.y }
          : item.where === "fair-center" ? { x: fair.x + Math.floor(fair.w / 2), y: fair.y + Math.floor(fair.h / 2) }
          : { x: corner % 2 ? fair.x + fair.w : fair.x, y: corner < 2 ? fair.y + fair.h : fair.y };
        // 마당에 다 못 들어가면 마당 둘레 8칸 안 빈 바닥 — 그보다 멀면 세우지 않는다(맵 반대편 외딴 노점이 R2 에서 장터를 흩었다).
        groveOk = true;
        ok = place(item, size, anchor, fair) || place(item, size, anchor, undefined, 8 + Math.max(fair.w, fair.h) / 2);
        groveOk = false;
      } else if (item.where === "gate" && gateAt) {
        // 출입구 둘레 6칸 안 — 화로·토템이 입구 양옆을 지키게.
        ok = place(item, size, gateAt, undefined, 6);
      } else {
        const anchor = item.where === "north" || item.where === "fair-north" ? { x: center.x, y: minY + 2 } : item.where === "south" ? { x: center.x, y: maxY - 2 } : center;
        ok = place(item, size, anchor, undefined);
      }
      if (!ok) warnings.push(`${map.name}: 소품 ${item.object} 를 세울 빈 바닥이 없다`);
    }
  }
  return out;
}

function m2(title: string, fields: Record<string, string | number | boolean>): Command {
  const entry = M2_COMMAND_CATALOG.find((candidate) => candidate.title === title);
  if (!entry) throw new ToolError(`M2 명령 ${title} 이 카탈로그에 없다`, { code: "m2-missing" });
  return { kind: "m2Command", commandId: entry.id, fields };
}

const say1 = (body: string): Command => ({ kind: "text", body });

/** 연출 낱말(Fx) → 이벤트 명령. 모르는 낱말은 조용히 버리지 않고 저작 오류로 던진다(장 사전은 코드에 있다). */
function fxCommands(fx: readonly Fx[] | undefined): Command[] {
  return (fx ?? []).flatMap((token): Command[] => {
    const at = token.indexOf(":");
    const kind = token.slice(0, at), value = token.slice(at + 1);
    switch (kind) {
      case "flash": return [m2("Flash Screen", { color: value || "white", durationMs: 300 })];
      case "shake": { const n = [1, 3, 6, 10].includes(Number(value)) ? Number(value) : 3; return [m2("Shake Screen", { value: n, intensity: String(n), durationMs: 500 })]; }
      case "particles": return [m2("Particle Effect", { preset: value, target: "player", durationMs: 800, wait: false })];
      case "tint": return [m2("Tint Screen", { color: "neutral", value: value === "clear" ? "" : value, durationMs: 400 })];
      case "se": return [{ kind: "playAudio", resourceId: `easyrpg-sound-${value}`, loop: false, channel: "se" }];
      case "emote": {
        if (!(EMOTE_KINDS as readonly string[]).includes(value)) throw new ToolError(`연출 낱말 ${token}: 감정은 ${EMOTE_KINDS.join("·")} 중 하나다`, { code: "fx-unknown" });
        return [{ kind: "showEmote", target: "player", emote: value as EmoteKind, durationMs: 700 }];
      }
      case "wait": return [{ kind: "wait", ms: Math.max(0, Number(value) || 0) }];
      default: throw new ToolError(`연출 낱말 ${token} 을 모른다`, { code: "fx-unknown" });
    }
  });
}

/**
 * 퍼즐 → 조사 명령. 단계마다 선택지 하나 — 맞힌 보기만 다음 단계로 들어가고, 틀린 보기는 그 단계 반응 + 공통 틀림 대사로 끝난다
 * (다시 조사하면 처음부터). 마지막 단계를 지나면 풀림 연출·보상 뒤에 원래 단서 명령(대사 + 단계 완료)이 따른다.
 */
function puzzleCommands(puzzle: PuzzleSpec, rewardCommands: readonly Command[], solved: readonly Command[]): Command[] {
  const stage = (i: number): Command[] => {
    const s = puzzle.stages[i];
    if (!s) return [...fxCommands(puzzle.solvedFx), ...rewardCommands, ...solved];
    return [{
      kind: "choices", prompt: s.prompt,
      options: s.options.map((option, j) => ({
        text: option,
        branch: j === s.answer
          ? [...(s.hit?.lines ?? []).map(say1), ...fxCommands(s.hit?.fx), ...stage(i + 1)]
          : [...fxCommands(s.miss?.fx), ...(s.miss?.lines ?? []).map(say1), ...fxCommands(puzzle.wrongFx), ...puzzle.wrong.map(say1)],
      })),
    }];
  };
  return [...puzzle.intro.map(say1), ...stage(0)];
}

const FIXED: EventPage["movement"] = { type: "fixed", speed: 3, frequency: 3 };

/** 합류 NPC → 배우. 맵에 선 그 NPC 의 걷기 그림(시트 + 칸)을 그대로 배우 그림으로 쓴다 — 합류 뒤 파티 행렬에 같은 얼굴이 선다. */
function joinActor(draft: Project, prefix: string, npc: NpcSpec, ref: { mapId: string; eventId: string }, warnings: string[]): string | undefined {
  const graphic = draft.maps[ref.mapId]?.events.find((e) => e.id === ref.eventId)?.pages?.[0]?.graphic;
  const lead = draft.database.actors[0];
  const classId = lead?.classId ?? draft.database.classes[0]?.id;
  if (!graphic?.sprite?.id || !classId) { warnings.push(`${npc.name}: 걷기 그림·직업이 없어 동료로 만들지 못했다`); return undefined; }
  const actorId = `actor_${prefix}_${npc.key}`;
  try {
    nested(draft, "upsert_actor", {
      actor: {
        id: actorId, name: npc.name, classId, initialLevel: lead?.initialLevel ?? 1,
        characterResourceId: heroCharacterResourceId(graphic.sprite.id), characterIndex: decodeCharsetFrameIndex(graphic.pattern ?? 0).characterIndex,
      },
    });
    return actorId;
  } catch (cause) {
    warnings.push(`${npc.name}: 동료 배우를 만들지 못했다 — ${cause instanceof Error ? cause.message : String(cause)}`);
    return undefined;
  }
}

/**
 * 합류한 NPC 는 퀘스트가 끝나면 맵에서 사라진다 — 마지막 페이지(완료 스위치 조건)가 투명·통과 페이지라 위의 모든 페이지를 덮는다.
 * 같은 완료 스위치만 조건으로 둔 기존 페이지(의뢰 완료 대사)는 그 페이지에 영원히 가려지므로 뺀다.
 */
function vanishAfter(event: GameEvent, switchId: string): void {
  const base = event.pages?.[0];
  if (!base) return;
  const doneOnly = (p: EventPage): boolean => p.conditions.length > 0 && p.conditions.every((c) => c.kind === "switch" && c.switchId === switchId && c.value === true);
  event.pages = [...event.pages!.filter((p) => !doneOnly(p)), {
    ...structuredClone(base), id: `${event.id}_joined`, name: "합류 뒤", conditions: [{ kind: "switch", switchId, value: true }],
    graphic: { transparent: true }, trigger: { kind: "action" }, priority: "below", movement: FIXED, commands: [],
  }];
}

/**
 * 갈래 출입구를 아이템으로 잠근다 — 첫 페이지: 아이템이 있으면 연출·열림 스위치 뒤 원래 이동, 없으면 막힘 대사.
 * 열림 스위치 페이지가 뒤에 붙어 한 번 연 뒤로는 보통 출입구다.
 */
function lockGate(draft: Project, map: GameMap, siteMapId: string, lock: LockSpec, switchId: string): boolean {
  const event = map.events.find((e) => (e.pages ?? []).some((p) => p.commands.some((c) => c.kind === "transfer" && c.mapId === siteMapId)));
  const page = event?.pages?.[0];
  if (!event || !page) return false;
  ensureNamedSwitch(draft, switchId, `${lock.site} 출입구 열림`);
  const travel = page.commands;
  event.pages!.push({ ...structuredClone(page), id: `${page.id}_open`, name: "열린 출입구", conditions: [...page.conditions, { kind: "switch", switchId, value: true }], commands: structuredClone(travel) });
  page.commands = [{
    kind: "fork", condition: { kind: "item", itemId: lock.item, present: true },
    then: [...lock.opened.map(say1), ...fxCommands(lock.fx), { kind: "setSwitch", switchId, value: true }, ...travel],
    else: lock.locked.map(say1),
  }];
  return true;
}

/**
 * 장치 — 소품 앞 칸의 투명 조사 이벤트: 연출 → 대사 → (heal) 파티 전원 회복.
 * 퍼즐 장치는 풀어야 그 차례가 오고(보상 포함), 풀면 풀림 스위치가 서서 뒤로는 done 대사 페이지가 대신 선다.
 */
function statefulObjGraphic(spec: StatefulGraphicSpec, state: "before" | "after"): EventPageGraphic {
  const direction: Dir = state === "before" ? (spec.beforeDir ?? "down") : (spec.afterDir ?? "up");
  const base = charsetGraphic(`tex_easyrpg_charset_${spec.sheet}`, spec.index);
  return {
    ...base,
    direction,
    pattern: charsetFrameIndex({ characterIndex: spec.index, direction, pattern: 1 }),
  };
}

function placeDevice(draft: Project, map: GameMap, at: Cell, id: string, device: DeviceSpec, reward: readonly Command[]): void {
  const beforeGraphic: EventPageGraphic = device.graphic ? statefulObjGraphic(device.graphic, "before") : { transparent: true };
  const afterGraphic: EventPageGraphic = device.graphic ? statefulObjGraphic(device.graphic, "after") : beforeGraphic;
  const priority: EventPage["priority"] = device.graphic ? "same" : "below";
  const page = (pageId: string, conditions: EventPage["conditions"], graphic: EventPageGraphic, commands: Command[]): Record<string, unknown> => ({
    id: pageId, name: device.name, conditions, graphic, trigger: { kind: "action" }, priority, overlapForbidden: priority === "same", animationType: "fixedGraphic", movement: FIXED, commands,
  });
  const tileChangeCmds = device.changeTile ? buildVerifiedChangeTileCommands(draft, map, [at]) : [];
  const effect: Command[] = [...tileChangeCmds, ...fxCommands(device.fx), ...device.lines.map(say1), ...(device.heal ? [{ kind: "recoverAll" } as const] : [])];
  const solved = `sw_${id.replace(/^ev_/, "")}_solved`;
  if (device.puzzle) ensureNamedSwitch(draft, solved, `${device.name} 풀림`);
  const pages = device.puzzle
    ? [
      page(`${id}_p1`, [], beforeGraphic, puzzleCommands(device.puzzle, [], [...effect, ...reward, { kind: "setSwitch", switchId: solved, value: true }])),
      page(`${id}_solved`, [{ kind: "switch", switchId: solved, value: true }], afterGraphic, (device.done ?? device.lines).map(say1)),
    ]
    : [page(`${id}_p1`, [], beforeGraphic, effect)];
  nested(draft, "upsert_event", { mapId: map.id, event: { id, name: device.name, x: at.x, y: at.y, trigger: { kind: "action" }, commands: [], pages } });
}

function placeSaveCrystal(draft: Project, map: GameMap, at: Cell, id: string): void {
  const crystalGraphic = statefulObjGraphic({ sheet: "object2", index: 6, beforeDir: "down" }, "before");
  const commands: Command[] = [
    ...fxCommands(["se:recovery7", "flash:blue", "particles:heal"]),
    say1("푸른 기억의 결정이 은은하게 공명하며 파티 전원의 체력과 마력을 완전히 회복시켰다!"),
    { kind: "recoverAll" },
  ];
  nested(draft, "upsert_event", {
    mapId: map.id,
    event: {
      id,
      name: "기억의 세이브 결정",
      x: at.x,
      y: at.y,
      trigger: { kind: "action" },
      commands: [],
      pages: [{
        id: `${id}_p1`,
        name: "기억의 세이브 결정",
        conditions: [],
        graphic: crystalGraphic,
        trigger: { kind: "action" },
        priority: "same",
        overlapForbidden: true,
        animationType: "fixedDirectionStep",
        movement: FIXED,
        commands,
      }],
    },
  });
}

/** 퍼즐 보상 -> 명령(아이템은 데이터베이스에 먼저 넣는다) + 표시 이름. */
function puzzleReward(draft: Project, puzzle: PuzzleSpec): { commands: Command[]; label: string } {
  const prize = puzzle.reward;
  const commands: Command[] = [];
  if (prize?.item) {
    nested(draft, "upsert_item", { item: { ...prize.item, price: 0, consumable: false, occasion: "never" } });
    commands.push({ kind: "changeItem", itemId: prize.item.id, op: "+=", amount: 1 });
  }
  if (prize?.gold) commands.push({ kind: "changeGold", op: "+=", amount: prize.gold });
  if (prize) commands.push(say1(prize.line));
  return { commands, label: [prize?.item?.name, prize?.gold ? `${prize.gold}G` : ""].filter(Boolean).join(" + ") };
}

/** 장의 수호자 적·트룹 — 기존 보스 트룹의 능력치를 본떠 이름·외형만 장에 맞춘다. 만들지 못하면 기존 보스 트룹으로 싸운다. */
function chapterBossTroop(draft: Project, prefix: string, foe: FoeSpec, fallback: string | undefined, warnings: string[]): string | undefined {
  const base = draft.database.troops.find((t) => t.id === fallback);
  const template = draft.database.enemies.find((e) => e.id === base?.enemyIds[0]);
  const enemyId = `enemy_${prefix}_boss`, troopId = `troop_${prefix}_boss`;
  try {
    nested(draft, "upsert_enemy", {
      role: "boss",
      enemy: {
        id: enemyId, name: foe.enemyName ?? foe.name, monsterResourceId: foe.graphic,
        ...(template ? { stats: structuredClone(template.stats), rewards: structuredClone(template.rewards), actions: structuredClone(template.actions ?? []) } : {}),
      },
    });
    nested(draft, "upsert_troop", { troop: { id: troopId, name: foe.name, enemyIds: Array.from({ length: foe.count ?? 1 }, () => enemyId) } });
    return troopId;
  } catch (cause) {
    warnings.push(`수호자 ${foe.name}: 적·트룹을 만들지 못해 ${fallback ?? "없음"} 으로 싸운다 — ${cause instanceof Error ? cause.message : String(cause)}`);
    return fallback;
  }
}

const authorJrpgChapter: ToolDefinition = {
  name: "author_jrpg_chapter",
  description:
    "크로노 트리거·FF6 풍 한 장(章)을 한 번에 짓는다 — 「크로노 트리거 천년제 마을 만들어줘」「FF6 나르셰 광산」「오페라 하우스 사건」. "
    + "{chapter, prefix?, seed?, timeGateFrom?:mapId} chapter: " + JRPG_CHAPTER_IDS.join(" · ") + ". "
    + "거점(장면 구성기) + 갈래 맵(손 도트 실내·장면·author_dungeon 던전)을 집 문·가장자리·던전 입구로 잇고, 이름 있는 NPC(대사), "
    + "퀘스트(의뢰 → 조력자 대화 → 단서 조사 → 수호자 전투 → 보고, create_quest), 사건 컷신(script_cutscene, 들어오면 한 번), 맵 분위기(날씨·조명·입자), 던전의 보이는 적·상자까지 깐다. "
    + "장마다 기믹도 붙는다 — 동료 합류(보고하면 파티에 들어오고 맵에서 사라짐), 단서 앞 선택지 퍼즐(틀리면 처음부터, 풀면 연출·보상 아이템), 소품 장치(회복 캡슐·범종 놀이·선로 전환기 — 선택지를 풀면 한 번만 보상), 아이템으로 여는 잠긴 출입구. "
    + "timeGateFrom 을 주면 그 맵과 이 장 거점을 시간의 문(create_time_gate)으로 잇는다 — CT 시대들을 천년제 광장에 모으는 식.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      chapter: { type: "string", enum: JRPG_CHAPTER_IDS, description: "장 id" },
      prefix: { type: "string", description: "새 맵 id 접두(기본 chapter)" },
      seed: { type: "integer", description: "구성기 씨앗(기본 7)" },
      timeGateFrom: { type: "string", description: "시간의 문으로 이을 기존 맵 id(선택)" },
    },
    required: ["chapter"],
    additionalProperties: false,
  },
  invalidArgsExample: { chapter: "ct_truce_fair", seed: 7 },
  run(draft, args): ToolExecResult {
    const chapterId = String(args.chapter ?? "") as JrpgChapterId;
    const spec: ChapterSpec | undefined = JRPG_CHAPTERS[chapterId];
    if (!spec) throw new ToolError(`chapter 는 ${JRPG_CHAPTER_IDS.join(" | ")} 중 하나다(받은 값: ${String(args.chapter)})`, { code: "invalid-args" });
    const prefix = sanitizeId(text(args, "prefix")?.trim() || chapterId);
    const seed = Number.isInteger(args.seed) ? Number(args.seed) : 7;
    const timeGateFrom = text(args, "timeGateFrom")?.trim();
    return buildJrpgChapter(draft, spec, { chapterId, prefix, seed, ...(timeGateFrom ? { timeGateFrom } : {}) });
  },
};

/**
 * 장 사양 하나를 짓는다 — author_jrpg_chapter 도구와 대표 데모(폴른 스타)가 같이 쓴다.
 * 대표 데모는 자기 이야기의 사양을 직접 넘긴다(장 사전의 크로노·FF6풍 장을 지어 글자만 바꾸지 않는다).
 */
export function buildJrpgChapter(
  draft: Project,
  spec: ChapterSpec,
  opts: {
    readonly chapterId: string; readonly prefix: string; readonly seed: number; readonly timeGateFrom?: string;
    /** 잡몹·보스 트룹 지정(없으면 데이터베이스에서 고른다) — pickTroops 의 given 과 같은 모양. */
    readonly troops?: { readonly field?: readonly string[]; readonly boss?: string };
  },
): ToolExecResult {
    const { chapterId, prefix, seed, timeGateFrom } = opts;
    if (timeGateFrom) requireMap(draft, timeGateFrom);
    const troops = pickFittedTroops(draft, opts.troops);
    const warnings: string[] = [];
    const ids = new Map<string, string>();
    const taken = new Map<string, Set<string>>();
    const takenOf = (mapId: string): Set<string> => { let s = taken.get(mapId); if (!s) taken.set(mapId, s = new Set()); return s; };
    const freshId = (base: string): string => { let id = base, n = 2; while (draft.maps[id]) id = `${base}_${n++}`; return id; };
    const origins = new Map<string, Cell>();
    /** 갈래 key → 앞 맵 key + 그 앞 맵의 출입구 칸(잠금·gate 소품 자리). */
    const gateCells = new Map<string, { from: string; cell: Cell }>();
    const plazas = new Map<string, Cell>();
    const dungeonRooms = new Map<string, { rooms: Room[]; rects: RoomRect[]; boss?: string; enemies: Cell[]; chests: Cell[] }>();
    const mapsOut: Array<{ key: string; mapId: string; name: string; kind: string; link?: string }> = [];

    // ① 거점
    const hubId = freshId(`${prefix}_hub`);
    const townTheme = /^beodeul_town:(.+)$/u.exec(spec.hub.scene)?.[1];
    if (spec.hub.form && townTheme) {
      // create_map themeScene 은 마을 형태를 넘기지 않는다 — 장터 광장 마을은 구성기를 직접 부른다.
      const built = nested(draft, "author_beodeul_town", { id: hubId, name: spec.hub.name, theme: townTheme, form: spec.hub.form, seed, ...(spec.hub.forestType ? { forestType: spec.hub.forestType } : {}) });
      const plaza = (built.data as { plaza?: Cell } | undefined)?.plaza;
      if (plaza) plazas.set("hub", { x: plaza.x, y: plaza.y });
    } else nested(draft, "create_map", { id: hubId, name: spec.hub.name, themeScene: spec.hub.scene, seed });
    const hub = requireMap(draft, hubId);
    if (townTheme) hub.mapRole ??= "town";
    ids.set("hub", hubId);
    origins.set("hub", centerOf(draft, hub));
    mapsOut.push({ key: "hub", mapId: hubId, name: spec.hub.name, kind: spec.hub.scene });

    // ② 갈래 맵 — 앞 맵(기본 거점)에서 잇는다
    let chestSalt = seed;
    for (const site of spec.sites) {
      const fromKey = site.from ?? "hub";
      const fromId = ids.get(fromKey);
      if (!fromId) throw new ToolError(`${site.key}: 앞 맵 ${fromKey} 이 먼저 지어지지 않았다`, { code: "chapter-order" });
      const from = requireMap(draft, fromId);
      const mapId = freshId(`${prefix}_${site.key}`);
      const gate = (site.gateSide ? sideGate(draft, from, takenOf(fromId), site.gateSide) : undefined) ?? hubGate(draft, from, takenOf(fromId), "interior" in site);
      if (!gate) { warnings.push(`${site.name}: ${from.name} 에 출입구 자리가 없다`); continue; }
      takenOf(fromId).add(key(gate.cell));
      gateCells.set(site.key, { from: fromKey, cell: gate.cell });
      if ("dungeon" in site) {
        // 던전 어댑터는 버들항 칩셋에만 있다 — 거점이 고딕·선사 칩셋이어도 던전 층은 버들항으로 짓는다(장마다 칩셋이 바뀌는 JRPG 지역 구성).
        const made = nested(draft, "author_dungeon", { id: mapId, name: site.name, type: site.dungeon, size: "medium", genre: "rpg", adapter: "beodeul", seed, populate: false, entrance: { fromMapId: fromId, x: gate.cell.x, y: gate.cell.y } });
        const rooms = list(made.data, "rooms").map(asRoom).filter((r): r is Room => !!r);
        const planned = (k: string): Cell[] => list(field(made.data, "population"), k).map(asCell).filter((c): c is Cell => !!c);
        const rects = list(made.data, "rooms").flatMap((r): RoomRect[] => {
          const id = text(r, "id"), x = num(r, "x"), y = num(r, "y"), w = num(r, "w"), h = num(r, "h");
          return id && x !== undefined && y !== undefined && w !== undefined && h !== undefined ? [{ id, x, y, w, h }] : [];
        });
        dungeonRooms.set(site.key, { rooms, rects, boss: text(field(made.data, "anchors"), "boss"), enemies: planned("enemies"), chests: planned("chests") });
        const front = asCell(field(field(made.data, "stairsUp"), "front"));
        origins.set(site.key, front ?? centerOf(draft, requireMap(draft, mapId)));
        mapsOut.push({ key: site.key, mapId, name: site.name, kind: `dungeon:${site.dungeon}`, link: `${from.name} (${gate.cell.x},${gate.cell.y}) ↔ 던전 입구` });
      } else if ("interior" in site) {
        const built = nested(draft, "build_hand_interior_room", { mapId, name: site.name, layout: { program: site.interior, seed } });
        const exitRaw = list(built.data, "exits")[0];
        const exit = asCell(exitRaw);
        if (!exit) { warnings.push(`${site.name}: 출입구가 없는 실내라 잇지 못했다`); continue; }
        const exitCell = { x: exit.x + Math.floor(((num(exitRaw, "width") ?? 1) - 1) / 2), y: exit.y };
        nested(draft, "create_transfer_pair", { a: { mapId: fromId, x: gate.cell.x, y: gate.cell.y, ...(gate.doorAt ? { doorAt: gate.doorAt } : {}) }, b: { mapId, x: exitCell.x, y: exitCell.y } });
        origins.set(site.key, { x: exitCell.x, y: exitCell.y - 1 });
        mapsOut.push({ key: site.key, mapId, name: site.name, kind: `interior:${site.interior}`, link: `${from.name} ${gate.doorAt ? "집 문" : "출입구"} (${gate.cell.x},${gate.cell.y}) ↔ 실내 출입구 (${exitCell.x},${exitCell.y})` });
      } else {
        nested(draft, "create_map", { id: mapId, name: site.name, themeScene: site.scene, seed: seed + 1 });
        const map = requireMap(draft, mapId);
        if (site.route) nested(draft, "author_wild_route", { mapId, replace: true, seed: seed + 1, ...site.route });
        const there = site.entry ? { cell: { x: site.entry.x, y: site.entry.y } } : hubGate(draft, map, takenOf(mapId), false);
        if (!there) { warnings.push(`${site.name}: 출입구 자리가 없다`); continue; }
        takenOf(mapId).add(key(there.cell));
        nested(draft, "create_transfer_pair", { a: { mapId: fromId, x: gate.cell.x, y: gate.cell.y }, b: { mapId, x: there.cell.x, y: there.cell.y } });
        origins.set(site.key, there.cell);
        mapsOut.push({ key: site.key, mapId, name: site.name, kind: site.scene, link: `${from.name} (${gate.cell.x},${gate.cell.y}) ↔ (${there.cell.x},${there.cell.y})` });
      }
      ids.set(site.key, mapId);
    }

    const mapOf = (k: string): GameMap | undefined => { const id = ids.get(k); return id ? draft.maps[id] : undefined; };
    const spot = (k: string, rank: number, minDist = 3): Cell | undefined => {
      const map = mapOf(k);
      const origin = origins.get(k);
      if (!map || !origin) return undefined;
      const at = pickSpot(draft, map, origin, takenOf(map.id), rank, minDist);
      if (at) takenOf(map.id).add(key(at));
      return at;
    };

    // ③ 던전 — 계획된 자리의 보이는 적·상자(보스방 수호자는 퀘스트 전투가 선다)
    for (const [k, d] of dungeonRooms) {
      const map = mapOf(k)!;
      const free = (c: Cell): boolean => isPassable(draft, map, c.x, c.y) && !(map.events ?? []).some((e) => Math.abs(e.x - c.x) + Math.abs(e.y - c.y) <= 1);
      d.enemies.slice(0, 3).forEach((c, i) => {
        if (!free(c) || !troops.field.length) return;
        placeRoamer(draft, { mapId: map.id, x: c.x, y: c.y, troopId: troops.field[i % troops.field.length], behavior: "patrol", id: `ev_${map.id}_foe${i + 1}` }, i % 2 === 1);
        takenOf(map.id).add(key(c));
      });
      d.chests.slice(0, 2).forEach((c, i) => {
        if (!free(c)) return;
        nested(draft, "place_chest", { mapId: map.id, x: c.x, y: c.y, id: `ev_${map.id}_chest${i + 1}`, name: "던전 상자", contents: chestLoot(draft, chestSalt++) });
        takenOf(map.id).add(key(c));
      });
    }

    // ④ 장면 소품 — 축제 노점·종탑·텔레포드, 던전마다 다른 융단·촛대·결정·광차·용암 균열(적·상자·문이 선 뒤라 그 둘레를 비운다)
    const lights = new Map<string, Array<Record<string, unknown>>>();
    const marks = new Map<string, Map<string, Cell>>();
    const dressed: string[] = [];
    for (const [k, items] of Object.entries(spec.dress ?? {})) {
      const map = mapOf(k);
      if (!map) continue;
      const d = dungeonRooms.get(k);
      // gate 소품은 잠긴 갈래 출입구 곁, 잠금이 없으면 이 맵에서 나가는 첫 갈래 출입구 곁.
      const lockedGate = spec.lock ? gateCells.get(spec.lock.site) : undefined;
      const gateAt = lockedGate?.from === k ? lockedGate.cell : [...gateCells.values()].find((g) => g.from === k)?.cell;
      const result = dressMap(draft, map, items, d?.rects ?? [], d?.boss, takenOf(map.id), warnings, plazas.get(k), gateAt);
      if (result.lights.length) lights.set(k, result.lights);
      for (const cell of result.marks.values()) takenOf(map.id).add(key(cell));
      if (result.marks.size) marks.set(k, result.marks);
      dressed.push(`${map.name}: ${result.placed.length}점 — ${result.placed.join(" · ")}`);
    }

    // ④-2 분위기 — 소품 광원(화로·결정·텔레포드)을 맵 조명에 붙인다
    const moods: string[] = [];
    for (const [k, mood] of Object.entries(spec.moods ?? {})) {
      const map = mapOf(k);
      if (!map) continue;
      const sources = lights.get(k) ?? [];
      nested(draft, "set_scene_mood", {
        mapId: map.id, applyMode: "map",
        ...(mood.weather ? { weather: { kind: mood.weather, intensity: 0.6 } } : {}),
        ...(mood.ambient !== undefined ? { lighting: { ambient: mood.ambient, ...(mood.color ? { color: mood.color } : {}), ...(sources.length ? { sources } : {}) } } : {}),
      });
      moods.push(`${map.name}: ${[mood.weather, mood.ambient !== undefined ? `조명 ${mood.ambient}` : "", sources.length ? `광원 ${sources.length}` : ""].filter(Boolean).join(" · ")}`);
    }
    // 대기 입자 — 날씨·조명 위에 겹치는 맵 장식층(꽃잎·불씨·마력·재).
    for (const [k, kinds] of Object.entries(spec.atmosphere ?? {})) {
      const map = mapOf(k);
      if (!map) continue;
      map.atmosphereEffects = normalizeAtmosphereEffects(kinds.map((kind) => ({ kind })));
      moods.push(`${map.name}: 입자 ${kinds.join("·")}`);
    }

    // ⑤ NPC
    const npcIds = new Map<string, { mapId: string; eventId: string }>();
    const npcsOut: Array<{ name: string; mapId: string; x: number; y: number; lines: readonly string[] }> = [];
    spec.npcs.forEach((npc, i) => {
      const k = npc.map ?? "hub";
      const at = spot(k, 0.12 + 0.13 * (i % 5), 3);
      const map = mapOf(k);
      if (!at || !map) { warnings.push(`${npc.name}: 설 자리를 찾지 못했다`); return; }
      const eventId = `ev_${prefix}_${npc.key}`;
      nested(draft, "place_npc", { mapId: map.id, x: at.x, y: at.y, id: eventId, name: npc.name, graphic: { query: npc.query }, movement: npc.roam ? "random" : "fixed", pages: [{ name: `${npc.name} · 기본`, lines: npc.lines }] });
      const placed = map.events.find((e) => e.id === eventId);
      npcIds.set(npc.key, { mapId: map.id, eventId });
      npcsOut.push({ name: npc.name, mapId: map.id, x: placed?.x ?? at.x, y: placed?.y ?? at.y, lines: npc.lines });
    });

    // ⑥ 퀘스트 — 의뢰 → 조력자 → 단서 조사 → 수호자 → 보고
    const q = spec.quest;
    const giver = npcIds.get(q.giver);
    const helper = npcIds.get(q.helper.npc);
    const clueMap = mapOf(q.clue.map);
    const foeMap = mapOf(q.foe.map);
    const clueAt = marks.get(q.clue.map)?.get("clue") ?? spot(q.clue.map, 0.75, 3);
    const bossRoom = dungeonRooms.get(q.foe.map);
    const bossCell = bossRoom
      ? bossRoom.rooms.find((r) => r.id === bossRoom.boss)?.spots.find((c) => !takenOf(foeMap!.id).has(key(c)) && isPassable(draft, foeMap!, c.x, c.y))
      : spot(q.foe.map, 0.95, 3);
    if (bossCell && foeMap) takenOf(foeMap.id).add(key(bossCell));
    const questKey = `${prefix}_main`;
    const stepsOut: string[] = [];
    const bossTroop = chapterBossTroop(draft, prefix, q.foe, troops.boss, warnings);
    const gimmicks: string[] = [];
    const ready = giver && helper && clueMap && foeMap && clueAt && bossCell && bossTroop;
    // 합류 동료 — 보고하는 순간 파티에 들어온다(create_quest effects.actors → changeParty).
    const joined = ready ? (spec.joins ?? []).flatMap((k) => {
      const npc = spec.npcs.find((n) => n.key === k), ref = npcIds.get(k);
      const actorId = npc && ref ? joinActor(draft, prefix, npc, ref, warnings) : undefined;
      return actorId && npc && ref ? [{ npc, ref, actorId }] : [];
    }) : [];
    if (giver && helper && clueMap && foeMap && clueAt && bossCell && bossTroop) {
      nested(draft, "create_quest", {
        def: {
          key: questKey, title: q.title, summary: q.summary, order: "sequence",
          blueprint: ["talk", "inspect", "kill"],
          giver, dialogue: { accepted: q.ask, completed: q.report.join("\n") },
          steps: [
            { kind: "talk", target: helper, lines: q.helper.lines },
            { kind: "inspect", at: { mapId: clueMap.id, x: clueAt.x, y: clueAt.y }, label: q.clue.label, lines: q.clue.lines },
            { kind: "kill", troopId: bossTroop, at: { mapId: foeMap.id, x: bossCell.x, y: bossCell.y, graphicQuery: q.foe.query, intro: q.foe.intro, victory: q.foe.victory } },
          ],
          rewards: { gold: q.gold },
          ...(joined.length ? { effects: { actors: joined.map((j) => j.actorId) } } : {}),
        },
      });
      const nameOf = (ref: { eventId: string }): string => spec.npcs.find((n) => `ev_${prefix}_${n.key}` === ref.eventId)?.name ?? ref.eventId;
      stepsOut.push(
        `의뢰: ${nameOf(giver)} — 「${q.ask}」`,
        `① 대화: ${nameOf(helper)} — 「${q.helper.lines[0]}」`,
        `② 조사: ${clueMap.name} (${clueAt.x},${clueAt.y}) 「${q.clue.label}」`,
        `③ 전투: ${foeMap.name} (${bossCell.x},${bossCell.y}) ${q.foe.name} [${bossTroop} · ${q.foe.graphic.replace("generated-enemy-", "")}${(q.foe.count ?? 1) > 1 ? ` ×${q.foe.count}` : ""}]`,
        `④ 보고: ${nameOf(giver)} — 「${q.report[0]}」 보상 ${q.gold}G`,
      );
      const done = questFlagIds(questKey, 3).done;
      for (const j of joined) {
        const event = draft.maps[j.ref.mapId]?.events.find((e) => e.id === j.ref.eventId);
        if (event) vanishAfter(event, done);
        gimmicks.push(`합류: ${j.npc.name} — 보고하면 파티에 들어오고 맵에서 사라진다 [${j.actorId}]`);
      }
      // 퍼즐 — 조사 단계의 진행 페이지를 선택지 퍼즐 + 2상태 기물 그래픽 + 실제 changeTile 타일 개방으로 감싼다.
      const inspectEvent = clueMap.events.find((e) => e.id === `ev_${questKey}_inspect1`);
      const inspect = inspectEvent?.pages?.find((p) => p.id.endsWith("_active"));
      const inspectDone = inspectEvent?.pages?.find((p) => p.id.endsWith("_done"));
      if (spec.clueGraphic && inspect) {
        inspect.graphic = statefulObjGraphic(spec.clueGraphic, "before");
        inspect.priority = "same";
        inspect.overlapForbidden = true;
        if (inspectDone) {
          inspectDone.graphic = statefulObjGraphic(spec.clueGraphic, "after");
          inspectDone.priority = "same";
          inspectDone.overlapForbidden = true;
        }
      }
      if (spec.puzzle && inspect) {
        const prize = puzzleReward(draft, spec.puzzle);
        const clueChangeTiles = buildVerifiedChangeTileCommands(draft, clueMap, [clueAt]);
        inspect.commands = puzzleCommands(spec.puzzle, [...clueChangeTiles, ...prize.commands], inspect.commands);
        gimmicks.push(`퍼즐: ${clueMap.name} 「${q.clue.label}」 — ${spec.puzzle.stages.length ? `${spec.puzzle.stages.length}단계 선택지` : "조사"} + 2상태 기물 + changeTile ${clueChangeTiles.length}칸${prize.label ? ` · 보상 ${prize.label}` : ""}`);
      } else if (spec.puzzle) warnings.push(`퍼즐: ${clueMap.name} 의 조사 이벤트를 찾지 못해 퍼즐을 붙이지 못했다`);
    } else warnings.push(`퀘스트 「${q.title}」: 의뢰인·조력자·단서·수호자 자리 중 빠진 것이 있어 만들지 않았다`);

    // ⑥-2 장치 — 소품 앞 칸의 조사 이벤트(회복 캡슐 등)
    for (const device of spec.devices ?? []) {
      const map = mapOf(device.map);
      const at = marks.get(device.map)?.get(device.mark);
      if (!map || !at) { warnings.push(`장치 ${device.name}: 소품(${device.mark})이 서지 않아 놓지 못했다`); continue; }
      const id = `ev_${prefix}_${sanitizeId(device.mark)}`;
      const prize = device.puzzle ? puzzleReward(draft, device.puzzle) : undefined;
      placeDevice(draft, map, at, id, device, prize?.commands ?? []);
      const label = device.puzzle ? ` — ${device.puzzle.stages.length}단계 선택지${prize?.label ? ` · 보상 ${prize.label}` : ""}` : "";
      gimmicks.push(`장치: ${map.name} (${at.x},${at.y}) ${device.name}${device.heal ? " — 전원 회복" : ""}${label}`);
    }
    // ⑥-2b 던전 보스방 앞 기억의 세이브 결정 배치
    for (const [k] of dungeonRooms) {
      const dMap = mapOf(k);
      const saveAt = spot(k, 0.82, 2);
      if (dMap && saveAt) {
        const saveId = `ev_${prefix}_${k}_save_crystal`;
        placeSaveCrystal(draft, dMap, saveAt, saveId);
        gimmicks.push(`세이브 결정: ${dMap.name} (${saveAt.x},${saveAt.y}) 기억의 세이브 결정 — 전원 회복 & 결전 준비`);
      }
    }

    // ⑥-2c 장별 전용 퍼즐 프리셋(author_map_puzzle) 시공
    for (const presetSpec of spec.puzzlePresets ?? []) {
      const pMap = mapOf(presetSpec.map);
      if (!pMap) continue;
      try {
        const res = nested(draft, "author_map_puzzle", {
          mapId: pMap.id,
          presetId: presetSpec.presetId,
          puzzleId: `${prefix}_${presetSpec.map}_${presetSpec.presetId}`,
          title: presetSpec.title,
          ...(presetSpec.hintText ? { hintText: presetSpec.hintText } : {}),
        });
        const pEvents = list(res.data, "events").map(asCell).filter((c): c is Cell => !!c);
        const pChangeTileCount = num(res.data, "changeTileCount") ?? 0;
        for (const ev of pEvents) takenOf(pMap.id).add(`${ev.x},${ev.y}`);
        gimmicks.push(`프리셋 퍼즐: ${pMap.name} 「${presetSpec.title}」 [${presetSpec.presetId}] — 2상태 기물 ${pEvents.length}개 · changeTile ${pChangeTileCount}칸`);
      } catch (cause) {
        warnings.push(`프리셋 퍼즐 ${presetSpec.title}: ${cause instanceof Error ? cause.message : String(cause)}`);
      }
    }

    // ⑥-3 잠긴 출입구 — 아이템을 지니고 닿아야 갈래 맵으로 간다
    if (spec.lock) {
      const g = gateCells.get(spec.lock.site), siteMapId = ids.get(spec.lock.site);
      const fromMap = g ? mapOf(g.from) : undefined;
      if (fromMap && siteMapId && lockGate(draft, fromMap, siteMapId, spec.lock, `sw_${prefix}_${sanitizeId(spec.lock.site)}_open`)) {
        const itemName = draft.database.items.find((it) => it.id === spec.lock!.item)?.name ?? spec.lock.item;
        gimmicks.push(`잠금: ${fromMap.name} (${g!.cell.x},${g!.cell.y}) → ${mapOf(spec.lock.site)?.name} — 「${itemName}」 이 있어야 열린다`);
      } else warnings.push(`잠금: ${spec.lock.site} 출입구 이벤트를 찾지 못했다`);
    }

    // ⑦ 사건 컷신 — 그 맵에 들어오면 한 번
    const eventMap = mapOf(spec.event.map);
    const eventAt = spot(spec.event.map, 0.3, 2);
    let eventOut: { mapId: string; title: string; x: number; y: number; beats: string[] } | undefined;
    if (eventMap && eventAt) {
      const eventId = `ev_${prefix}_event`;
      const resolveTarget = (t: unknown): unknown => {
        if (typeof t !== "string") return t;
        const byKey = npcIds.get(t);
        if (byKey?.mapId === eventMap.id) return byKey.eventId;
        const byName = spec.npcs.find((n) => n.name === t);
        const ref = byName ? npcIds.get(byName.key) : undefined;
        return ref?.mapId === eventMap.id ? ref.eventId : t;
      };
      const resolvedBeats = spec.event.beats.map((b) =>
        typeof b.target === "string" ? { ...b, target: resolveTarget(b.target) } : b,
      );
      nested(draft, "script_cutscene", { mapId: eventMap.id, eventId, x: eventAt.x, y: eventAt.y, trigger: "auto", once: true, skippable: true, beats: resolvedBeats });
      eventOut = {
        mapId: eventMap.id, title: spec.event.title, x: eventAt.x, y: eventAt.y,
        beats: spec.event.beats.map((b) => b.kind === "say" ? `${String(b.speaker)}: ${String(b.text)}` : BEAT_LABEL[String(b.kind)] ?? String(b.kind)),
      };
    } else warnings.push(`사건 「${spec.event.title}」 자리를 찾지 못했다`);

    // ⑧ 시간의 문
    let gateOut: string | undefined;
    if (timeGateFrom) {
      const src = requireMap(draft, timeGateFrom);
      const a = pickSpot(draft, src, centerOf(draft, src), takenOf(src.id), 0.45, 3);
      const b = spot("hub", 0.5, 3);
      if (a && b) {
        takenOf(src.id).add(key(a));
        nested(draft, "create_time_gate", { a: { mapId: src.id, x: a.x, y: a.y }, b: { mapId: hubId, x: b.x, y: b.y }, name: spec.gateName ?? "시간의 문", effect: "swirl", graphic: { textureKey: "tex_easyrpg_charset_object2", characterIndex: 6 } });
        gateOut = `${src.name} (${a.x},${a.y}) ⇄ ${hub.name} (${b.x},${b.y})`;
      } else warnings.push("시간의 문 자리를 찾지 못했다");
    }

    // ⑨ 로케이션 표시명 중복 해소 (map-location-duplicate-name 린트 경고 0 보장)
    for (const m of mapsOut) {
      const map = draft.maps[m.mapId];
      if (!map?.locations?.length) continue;
      const counts = new Map<string, number>();
      for (const loc of map.locations) {
        const keyName = loc.name.trim();
        const seenCount = (counts.get(keyName) ?? 0) + 1;
        counts.set(keyName, seenCount);
        if (seenCount > 1) loc.name = `${keyName} ${seenCount}`;
      }
    }

    return {
      summary: `${spec.era} 「${spec.title}」 — 맵 ${mapsOut.length}장(${mapsOut.map((m) => m.name).join(" · ")}), NPC ${npcsOut.length}, 퀘스트 「${q.title}」 ${stepsOut.length ? "의뢰·대화·조사·전투·보고" : "없음"}, 사건 「${spec.event.title}」${gimmicks.length ? `, 기믹 ${gimmicks.length}(${gimmicks.map((g) => g.split(":")[0]).join("·")})` : ""}${gateOut ? `, 시간의 문 ${gateOut}` : ""}`,
      data: { chapter: chapterId, title: spec.title, era: spec.era, hubMapId: hubId, maps: mapsOut, npcs: npcsOut, quest: { key: questKey, title: q.title, summary: q.summary, steps: stepsOut, bossTroopId: bossTroop }, event: eventOut, timeGate: gateOut, moods, dressed, gimmicks },
      ...(warnings.length ? { warnings } : {}),
    };
}

export const JRPG_CHAPTER_TOOLS: readonly ToolDefinition[] = [authorJrpgChapter];
