// author_jrpg_chapter — 크로노 트리거·FF6 한 장(章)을 한 번에 짓는다: 거점 맵 + 갈래 맵(실내·장면·던전) + NPC + 퀘스트 + 사건 컷신.
//
// 왜 (2026-10-18 사용자 「JRPG 타일 존나 다양하게 깔아봐. 던전을 비롯해서 크로노 트리거, ff6 에 나온 마을이나 던전, 지역, NPC, 퀘스트, 사건 등을 만들 수 있어야함」):
// 장면 구성기(create_map themeScene)·던전(author_dungeon)·손 도트 실내(build_hand_interior_room)·NPC·퀘스트·컷신·시간의 문은
// 각각 있었지만, 「천년제 광장 + 가르디아 성 + 텔레포드 사건 + 펜던트 퀘스트」 같은 한 장을 묶는 길이 없었다.
// 새 배치 규칙은 만들지 않는다 — 맵은 구성기가, 연결·착지는 create_transfer_pair/create_time_gate/author_dungeon.entrance 가,
// 이벤트 자리는 expand_jrpg_campaign_volume 과 같은 pickSpot(지워도 길이 끊기지 않는 칸)이 고른다.
import { isPassable } from "@/project/collision";
import type { GameMap, Project } from "@/project/types";
import {
  asCell, asRoom, chestLoot, edgeGate, field, houseDoors, list, mainComponent, nested, num, pickSpot, pickTroops, placeRoamer, sanitizeId, text,
  type Cell, type Room,
} from "./jrpgVolumeTools";
import { requireMap } from "./mapHelpers";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

type MapKind = { readonly scene: string } | { readonly interior: string } | { readonly dungeon: string };
type SiteSpec = MapKind & { readonly key: string; readonly name: string; readonly from?: string };
interface NpcSpec { readonly key: string; readonly name: string; readonly query: string; readonly lines: readonly string[]; readonly map?: string }
interface MoodSpec { readonly weather?: "rain" | "snow" | "fog" | "storm"; readonly ambient?: number; readonly color?: string }
type Beat = Record<string, unknown>;
interface ChapterSpec {
  readonly title: string;
  readonly era: string;
  readonly hub: { readonly name: string; readonly scene: string };
  readonly sites: readonly SiteSpec[];
  readonly moods?: Readonly<Record<string, MoodSpec>>;
  readonly npcs: readonly NpcSpec[];
  readonly quest: {
    readonly title: string;
    readonly summary: string;
    readonly giver: string;
    readonly ask: string;
    readonly helper: { readonly npc: string; readonly lines: readonly string[] };
    readonly clue: { readonly map: string; readonly label: string; readonly lines: readonly string[] };
    readonly foe: { readonly map: string; readonly name: string; readonly query: string; readonly intro: readonly string[]; readonly victory: readonly string[] };
    /** 수호자를 쓰러뜨린 뒤 의뢰인에게 보고할 때의 대사(create_quest dialogue.completed). */
    readonly report: readonly string[];
    readonly gold: number;
  };
  readonly event: { readonly map: string; readonly title: string; readonly beats: readonly Beat[] };
  readonly gateName?: string;
}

const say = (speaker: string, line: string): Beat => ({ kind: "say", speaker, text: line });

/** 장(章) 사전 — 크로노 트리거 다섯 시대 + FF6 세 고장. 맵 key 는 "hub" 또는 sites[].key. */
export const JRPG_CHAPTERS = {
  ct_truce_fair: {
    title: "천년제의 트루스 마을", era: "CT 1000 AD",
    hub: { name: "트루스 마을 · 천년제 광장", scene: "beodeul_town:river" },
    sites: [{ key: "castle", name: "가르디아 성 왕좌의 방", interior: "throne" }],
    moods: { hub: { ambient: 0.05, color: "#ffd9a0" } },
    npcs: [
      { key: "marle", name: "마르", query: "공주", lines: ["천년제 구경 왔어? 나랑 같이 돌아보자!", "저 텔레포드, 루카가 만든 거래. 한번 타 볼래?"] },
      { key: "lucca", name: "루카", query: "마법사 소녀", lines: ["내 텔레포드 시연 보러 왔구나! 광장 북쪽 무대야.", "펜던트가 장치랑 공명하는 건 계산에 없었는데…"] },
      { key: "balloon", name: "풍선 장수", query: "행상인 · 갈색 둥근 모자", lines: ["천년제 기념 풍선이오! 하나에 10골드!"] },
      { key: "bell", name: "종탑지기", query: "노인 · 흰 머리(남)", lines: ["천 년 전 왕국이 세워진 날을 이 종이 알린다네."] },
      { key: "cat", name: "길 잃은 고양이", query: "주황 고양이", lines: ["냐아… (집에 데려다 달라는 눈치다)"] },
      { key: "chancellor", name: "대신", query: "귀족 남성", lines: ["공주님을 데려간 자가 누구냐!"], map: "castle" },
    ],
    quest: {
      title: "천년제의 소녀", summary: "텔레포드 사고로 사라진 마르의 펜던트 단서를 가르디아 성에서 찾는다.",
      giver: "marle", ask: "내 펜던트… 텔레포드에 빨려 들어갈 때 빛났어. 성에 가면 뭔가 알 수 있을 거야.",
      helper: { npc: "lucca", lines: ["펜던트 파장이 시간의 문을 연 거야. 성의 기록실을 살펴봐!"] },
      clue: { map: "castle", label: "왕가의 초상화", lines: ["초상화 속 왕비가 마르와 같은 펜던트를 걸고 있다."] },
      foe: { map: "castle", name: "성 경비대장", query: "붉은 갑옷 기사", intro: ["공주님을 납치한 놈이냐! 거기 서라!"], victory: ["…오해였군. 지나가게."] },
      report: ["펜던트는 왕가의 보물이었구나… 고마워, 같이 가자!"], gold: 300,
    },
    event: {
      map: "hub", title: "텔레포드 시연 — 마르의 실종",
      beats: [
        { kind: "letterbox", show: true }, say("루카", "자, 천년제 특별 시연! 텔레포드 가동!"),
        { kind: "parallel", beats: [{ kind: "flash", color: "white", durationMs: 400 }, { kind: "shake", intensity: 3, durationMs: 600, axis: "both" }] },
        say("마르", "어, 펜던트가… 빛나고 있어?!"), { kind: "particles", preset: "magic", target: "player", durationMs: 900, wait: true },
        { kind: "distort", effect: "rotate", amount: 0.6, durationMs: 600, wait: true }, { kind: "distort", effect: "clear", durationMs: 200 },
        say("루카", "시간의 문이 열렸어…! 마르가 사라졌다고?!"),
      ],
    },
  },
  ct_middle_ages: {
    title: "600년 가르디아 · 대성당과 마왕성", era: "CT 600 AD",
    hub: { name: "중세 가르디아 · 묘지 언덕", scene: "gothic:graveyard" },
    sites: [
      { key: "chapel", name: "대성당 예배당", scene: "gothic:chapel" },
      { key: "keep", name: "마왕성 지하", dungeon: "castle" },
    ],
    moods: { hub: { weather: "fog", ambient: 0.35, color: "#1c2338" }, keep: { ambient: 0.55, color: "#1a0f24" } },
    npcs: [
      { key: "captain", name: "기사단장", query: "파란 갑옷 기사", lines: ["마왕군이 국경을 넘었다. 성검만 있었더라면…"] },
      { key: "frog", name: "개구리 기사", query: "양서 기사", lines: ["…부서진 성검 그랜드리온. 날을 되살릴 자를 찾고 있다."] },
      { key: "nun", name: "수녀", query: "수녀", lines: ["대성당에서 기도하세요. 왕비님도 그곳에 계십니다."], map: "chapel" },
      { key: "squire", name: "견습 기사", query: "청년 병사", lines: ["단장님은 마왕성 지하에 성검 손잡이가 있다고 하셨어요!"] },
    ],
    quest: {
      title: "성검 복원", summary: "대성당 숨은 계단의 단서로 마왕성 지하 수호자를 쓰러뜨리고 성검을 되살린다.",
      giver: "captain", ask: "대성당 오르간 뒤에 비밀 계단이 있다는 소문이다. 그 아래 기록을 찾아 오게.",
      helper: { npc: "frog", lines: ["손잡이는 마왕성 지하 깊은 곳… 내가 길을 알려 주지."] },
      clue: { map: "chapel", label: "오르간 뒤 숨겨진 스위치", lines: ["딸깍— 바닥이 갈라지며 아래로 내려가는 계단이 드러났다!"] },
      foe: { map: "keep", name: "마왕군 수호자 오자", query: "마족 장군", intro: ["마왕님의 성에 발을 들이다니!"], victory: ["크윽… 성검의 손잡이를 가져가라…"] },
      report: ["그랜드리온이 다시 빛나는군! 이것으로 마왕과 맞설 수 있다."], gold: 600,
    },
    event: {
      map: "chapel", title: "스테인드글라스 아래의 정체",
      beats: [
        { kind: "letterbox", show: true }, say("수녀", "…왕비님이라면 이미 저 깊은 곳에 계시지요."),
        { kind: "tint", color: "#3a1030", durationMs: 600, wait: true }, { kind: "shake", intensity: 6, durationMs: 500, axis: "vertical" },
        say("수녀", "키샤샤! 마왕님의 명으로 너희를 처리한다!"), { kind: "particles", preset: "smoke", target: "player", durationMs: 700, wait: true },
        { kind: "tint", color: "none", durationMs: 400 },
      ],
    },
    gateName: "600년으로 가는 시간의 문",
  },
  ct_prehistory: {
    title: "원시 이오카 부락 · 티라노 협곡", era: "CT 65,000,000 BC",
    hub: { name: "이오카 부락", scene: "prehistoric:village" },
    sites: [
      { key: "canyon", name: "공룡 협곡 · 용암 폭포", scene: "prehistoric:volcano" },
      { key: "lair", name: "티라노 소굴 용암 동굴", dungeon: "volcano", from: "canyon" },
    ],
    moods: { canyon: { ambient: 0.15, color: "#ff8040" }, lair: { ambient: 0.4, color: "#3a0a00" } },
    npcs: [
      { key: "ayla", name: "에이라", query: "원시 전사 소녀", lines: ["에이라 강하다! 너 강하다? 같이 싸운다!"] },
      { key: "kino", name: "키노", query: "삐쭉머리 남자아이", lines: ["불꽃 돌… 협곡 너머 용암 동굴에서 빛났다!"] },
      { key: "elder", name: "족장 할멈", query: "노파", lines: ["밤이 되면 불 축제다. 불을 지킬 부싯돌이 필요해."] },
      { key: "child", name: "부락 아이", query: "여자아이", lines: ["공룡인간들이 협곡 다리를 건너왔대!"] },
    ],
    quest: {
      title: "부싯돌과 용암 열쇠", summary: "협곡의 부싯돌을 찾고 용암 동굴의 공룡인간 우두머리를 물리친다.",
      giver: "elder", ask: "협곡 폭포 옆 바위에 불을 품은 부싯돌이 있다. 그걸 가져오면 동굴 문이 열려.",
      helper: { npc: "kino", lines: ["협곡 다리 건너 붉은 바위다! 뜨거우니 조심!"] },
      clue: { map: "canyon", label: "용암에 달궈진 부싯돌", lines: ["돌을 맞부딪치자 불꽃이 튀며 동굴 쪽 바위가 붉게 빛났다."] },
      foe: { map: "lair", name: "공룡인간 우두머리", query: "드레이크", intro: ["원숭이 놈들! 여기는 우리 땅이다!"], victory: ["크르르… 용암 열쇠를 떨어뜨렸다."] },
      report: ["불이 꺼지지 않는다! 오늘 밤 축제, 너희가 주인공이다!"], gold: 400,
    },
    event: {
      map: "hub", title: "화톳불 축제와 에이라의 합류",
      beats: [
        { kind: "letterbox", show: true }, { kind: "tint", color: "#40180a", durationMs: 600 }, say("족장 할멈", "불을 둘러싸라! 오늘은 부락의 축제다!"),
        { kind: "particles", preset: "fire", target: "player", durationMs: 900, wait: true }, { kind: "emote", target: "player", emote: "music", durationMs: 800 },
        say("에이라", "너 강하다. 에이라 따라간다!"), { kind: "tint", color: "none", durationMs: 500 },
      ],
    },
    gateName: "원시 시대로 가는 시간의 문",
  },
  ct_zeal: {
    title: "마법 왕국 제알 · 해저신전", era: "CT 12,000 BC",
    hub: { name: "제알 왕궁 · 하늘 신전", scene: "sky_island:shrine" },
    sites: [
      { key: "dock", name: "검은 새 선착장", scene: "sky_island:dock" },
      { key: "ocean", name: "해저신전", dungeon: "temple" },
    ],
    moods: { ocean: { ambient: 0.45, color: "#08203c" } },
    npcs: [
      { key: "prophet", name: "예언자", query: "파란 로브 마법사", lines: ["라보스의 힘에 손대면 왕국은 바다 밑으로 가라앉으리라."] },
      { key: "schala", name: "사라 공주", query: "신관 · 청록 로브", lines: ["어머니는 마신기에 홀리셨어요… 저를 도와주세요."] },
      { key: "janus", name: "쟈키", query: "남자아이", lines: ["…누나 말고는 아무도 믿지 마."] },
      { key: "captain", name: "검은 새 갑판장", query: "뱃사람 · 흰 선원 모자", lines: ["달팽이 같은 하늘배들이랑은 달라. 이게 검은 새다."], map: "dock" },
    ],
    quest: {
      title: "마력 봉인 해제", summary: "선착장의 마석 제단을 깨우고 해저신전 마신기를 지키는 골렘을 쓰러뜨린다.",
      giver: "schala", ask: "선착장 끝 마석 제단에 펜던트를 대면 해저신전 봉인이 풀려요.",
      helper: { npc: "prophet", lines: ["제단은 검은 새 그림자 아래에 있다. 서둘러라, 시간이 없다."] },
      clue: { map: "dock", label: "마석 제단", lines: ["펜던트가 푸르게 공명하며 마석의 봉인 문양이 사라졌다."] },
      foe: { map: "ocean", name: "마신기의 골렘 쌍둥이", query: "보라 갑옷 괴물", intro: ["침입자를 감지. 배제한다."], victory: ["골렘이 무너지며 신전 깊은 곳 문이 열렸다."] },
      report: ["고마워요… 하지만 라보스가 깨어나기 시작했어요."], gold: 800,
    },
    event: {
      map: "ocean", title: "라보스의 각성",
      beats: [
        { kind: "letterbox", show: true }, { kind: "distort", effect: "wave", amount: 0.5, durationMs: 500 },
        say("예언자", "이미 늦었다… 라보스가 눈을 뜬다!"),
        { kind: "parallel", beats: [{ kind: "shake", intensity: 10, durationMs: 1200, axis: "vertical" }, { kind: "flash", color: "red", durationMs: 600 }] },
        { kind: "particles", preset: "explosion", target: "player", durationMs: 900, wait: true }, { kind: "distort", effect: "clear", durationMs: 200 },
      ],
    },
    gateName: "고대로 가는 시간의 문",
  },
  ct_future: {
    title: "멸망한 미래 · 아리스 돔과 로봇 공장", era: "CT 2300 AD",
    hub: { name: "아리스 돔 크레이터", scene: "sf_station:moonbase" },
    sites: [{ key: "factory", name: "지하 로봇 공장", scene: "sf_station:lab" }],
    moods: { hub: { ambient: 0.4, color: "#20202c" }, factory: { ambient: 0.3, color: "#101826" } },
    npcs: [
      { key: "doan", name: "돔 장로 도안", query: "노인 · 흰 머리(남)", lines: ["씨앗 저장고도 바닥났소… 이 돔이 마지막 피난처요."] },
      { key: "survivor", name: "생존자", query: "청년 남성", lines: ["에너지 포드 하나만 있으면 오늘은 버틸 수 있어."] },
      { key: "robo", name: "로보", query: "고철 로봇", lines: ["…시스템 정지 상태. 재기동 신호를 기다립니다."] },
      { key: "keeper", name: "공장 관리 로봇", query: "고철 로봇", lines: ["침입자 경고. 생산 라인에서 물러나십시오."], map: "factory" },
    ],
    quest: {
      title: "로보 재기동", summary: "공장 제어 콘솔에서 재기동 코드를 받아 로보를 깨우고 경비 로봇을 무력화한다.",
      giver: "doan", ask: "저 고철 로봇… 공장 제어 콘솔이라면 깨울 수 있을지도 모르오.",
      helper: { npc: "survivor", lines: ["공장은 북쪽 지하야. 컨베이어 소리가 아직 들려."] },
      clue: { map: "factory", label: "중앙 제어 콘솔", lines: ["화면에 「R-66Y 재기동 시퀀스」가 떠오르고 에너지 포드가 충전되었다."] },
      foe: { map: "factory", name: "경비 로봇 R 시리즈", query: "저주 갑옷", intro: ["R-66Y 의 반역 확인. 처분합니다."], victory: ["경비 로봇이 불꽃을 튀기며 멈췄다."] },
      report: ["로보가 눈을 떴다니… 이 미래에도 희망이 남아 있었군."], gold: 1000,
    },
    event: {
      map: "factory", title: "로보 재기동",
      beats: [
        { kind: "letterbox", show: true }, say("로보", "…시스템 부팅. 기억 장치 손상 37%."),
        { kind: "particles", preset: "sparkle", target: "player", durationMs: 800, wait: true }, { kind: "flash", color: "blue", durationMs: 300 },
        say("로보", "당신이 저를 깨웠군요. 앞으로 함께하겠습니다."), { kind: "emote", target: "player", emote: "exclamation", durationMs: 700 },
      ],
    },
    gateName: "미래로 가는 시간의 문",
  },
  ff6_narshe: {
    title: "탄광 도시 나르셰 · 마석 광산", era: "FF6 붕괴 전",
    hub: { name: "탄광 도시 나르셰", scene: "snow_north:village" },
    sites: [
      { key: "house", name: "아르비스의 집", interior: "narshe" },
      { key: "mine", name: "나르셰 마석 광산", dungeon: "mine" },
    ],
    moods: { hub: { weather: "snow", ambient: 0.2, color: "#a8c0e0" }, mine: { ambient: 0.5, color: "#141c28" } },
    npcs: [
      { key: "arvis", name: "아르비스", query: "터번 노인", lines: ["제국 병사들이 광산 안 얼음 속 환수를 노리고 있네."] },
      { key: "guard", name: "광산 경비병", query: "청년 병사", lines: ["제국의 마도 아머가 오면 광산 철로 입구를 지킨다!"] },
      { key: "miner", name: "광부", query: "갈색 머리 중년 전사", lines: ["깊은 갱도에서 얼음이 노래를 불러… 소름이 끼쳐."] },
      { key: "terra", name: "티나", query: "요정 소녀", lines: ["…아무것도 기억나지 않아요. 왜 저 얼음이 부르는 걸까요."], map: "house" },
    ],
    quest: {
      title: "얼음 속 환수", summary: "광산 깊은 곳 얼어붙은 환수와 공명하고 제국의 거대 달팽이를 물리친다.",
      giver: "arvis", ask: "티나를 데리고 광산 뒷길로 빠져나가게. 얼음 속 환수가 그녀를 부르고 있어.",
      helper: { npc: "guard", lines: ["뒷길은 철로를 따라가다 왼쪽 갱도야. 몬스터가 들끓으니 조심해."] },
      clue: { map: "mine", label: "얼어붙은 환수", lines: ["얼음이 푸르게 빛나며 티나와 환수가 서로를 부른다!"] },
      foe: { map: "mine", name: "거대 달팽이 웰크", query: "슬라임", intro: ["껍질에 번개가 흐른다… 공격하면 반격한다!"], victory: ["달팽이가 껍질 속으로 움츠러들며 쓰러졌다."] },
      report: ["환수와 공명했다고? 그 아이는… 인간과 환수 사이에서 태어난 것인가."], gold: 500,
    },
    event: {
      map: "mine", title: "환수 공명",
      beats: [
        { kind: "letterbox", show: true }, say("티나", "…이 소리는? 누군가 나를 부르고 있어."),
        { kind: "parallel", beats: [{ kind: "flash", color: "purple", durationMs: 800 }, { kind: "shake", intensity: 3, durationMs: 900, axis: "both" }] },
        { kind: "particles", preset: "magic", target: "player", durationMs: 1000, wait: true }, { kind: "look", target: "player", pose: "fallen" },
        say("아르비스", "티나! 정신 차리게!"), { kind: "look", target: "player", reset: true },
      ],
    },
  },
  ff6_figaro_opera: {
    title: "사막의 기계성 피가로 · 오페라 하우스", era: "FF6 붕괴 전",
    hub: { name: "사막의 기계성 피가로", scene: "desert_east:palace" },
    sites: [
      { key: "engine", name: "피가로 성 기관실", interior: "magitek" },
      { key: "opera", name: "오페라 하우스 무대", interior: "opera" },
    ],
    moods: { hub: { ambient: 0, color: "#fff0c0" }, opera: { ambient: 0.35, color: "#2a1830" } },
    npcs: [
      { key: "edgar", name: "에드거 왕", query: "왕", lines: ["피가로는 제국과 동맹이지만… 마음까지 판 적은 없다."] },
      { key: "chancellor", name: "피가로 대신", query: "귀족 남성", lines: ["폐하, 성을 잠항시킬 준비가 끝났습니다."] },
      { key: "engineer", name: "기관장", query: "기어 정비사", lines: ["사막 아래로 성을 숨기는 거대한 기어! 이게 피가로의 자랑이지."], map: "engine" },
      { key: "impresario", name: "극장 지배인", query: "중절모 신사", lines: ["마리아 대역이라니! 아리아만 외우면 무대에 설 수 있소!"], map: "opera" },
    ],
    quest: {
      title: "아리아 디 마리아", summary: "오페라 공연을 지키며 무대 위 샹들리에 아래에서 울트로스를 막는다.",
      giver: "edgar", ask: "오페라 하우스로 가서 지배인을 만나게. 마리아로 분장해야 세처를 꾈 수 있어.",
      helper: { npc: "impresario", lines: ["악보는 무대 뒤에 있소. 2막 아리아가 핵심이오!"] },
      clue: { map: "opera", label: "무대 위 샹들리에", lines: ["샹들리에가 흔들린다… 천장 들보 위에 누가 무거운 추를 올려놨다!"] },
      foe: { map: "opera", name: "울트로스", query: "청룡", intro: ["무후후후! 4톤 추로 공연을 박살 내 주지!"], victory: ["울트로스: 오, 오늘은 이쯤 해 두지!"] },
      report: ["공연을 지켰군! 이제 비공정 블랙잭으로 제국에 맞선다."], gold: 1200,
    },
    event: {
      map: "opera", title: "아리아 컷신",
      beats: [
        { kind: "letterbox", show: true }, { kind: "tint", color: "#201030", durationMs: 600 },
        say("마리아", "오 나의 사랑, 나의 왕자… 별이 지는 밤에도 기다리리…"),
        { kind: "particles", preset: "sparkle", target: "player", durationMs: 900, wait: true }, { kind: "emote", target: "player", emote: "music", durationMs: 900 },
        say("지배인", "브라보! 하지만 들보 위에 저 문어는 대체…?!"), { kind: "tint", color: "none", durationMs: 400 },
      ],
    },
  },
  ff6_zozo_kefka: {
    title: "비 내리는 조조 · 잔해의 탑", era: "FF6 붕괴 후",
    hub: { name: "비 내리는 슬럼 조조", scene: "steampunk_city:street" },
    sites: [
      { key: "clock", name: "조조 시계탑 아파트", interior: "zozo" },
      { key: "tower", name: "케프카의 잔해의 탑", dungeon: "volcano" },
    ],
    moods: { hub: { weather: "rain", ambient: 0.45, color: "#18202c" }, tower: { ambient: 0.5, color: "#2c0814" } },
    npcs: [
      { key: "liar", name: "거짓말쟁이 사내", query: "단원 · 검은 코트(남)", lines: ["시계는 6시 정각이야. (이 마을 사람은 모두 거짓말을 한다)"] },
      { key: "dancer", name: "무희", query: "젊은 여성", lines: ["초침은 50초가 아니야… 아마도."] },
      { key: "sabin", name: "마슈", query: "갈색 머리 중년 전사", lines: ["형님들은 어디 있지? 세계가 무너진 뒤로 흩어졌어."] },
      { key: "celes", name: "셀리스", query: "붉은 갑옷 여전사", lines: ["모두를 다시 모아야 해. 케프카를 쓰러뜨리려면."] },
      { key: "clockman", name: "시계지기", query: "노인 · 회색 머리 보라 숄(여)", lines: ["진짜 시각은 거짓말 사이에 숨어 있지."], map: "clock" },
    ],
    quest: {
      title: "시계탑의 수수께끼와 재집결", summary: "조조 거짓말쟁이들의 말로 시계 비밀을 풀고 잔해의 탑의 케프카에게 도전한다.",
      giver: "celes", ask: "마슈가 조조 시계탑에 단서가 있대. 시계를 맞추면 숨은 방이 열린다나 봐.",
      helper: { npc: "liar", lines: ["시계는 6시 10분 50초… 아니, 내가 그렇게 말했다면 거짓말이지."] },
      clue: { map: "clock", label: "멈춘 벽시계", lines: ["바늘을 6시 10분 50초에 맞추자 벽 뒤에서 열쇠가 떨어졌다."] },
      foe: { map: "tower", name: "광대 케프카", query: "마왕", intro: ["히히히! 파괴야말로 아름다운 거야!"], victory: ["케프카: 이, 이럴 수가… 신이 된 내가…!"] },
      report: ["다들 돌아왔어. 이제 무너진 세계를 다시 일으킬 차례야."], gold: 3000,
    },
    event: {
      map: "hub", title: "흩어진 동료 재집결",
      beats: [
        { kind: "letterbox", show: true }, { kind: "weather", weather: "rain", intensity: 0.8, durationMs: 400 },
        say("셀리스", "…마슈? 정말 마슈야?"), say("마슈", "셀리스! 살아 있었구나!"),
        { kind: "emote", target: "player", emote: "exclamation", durationMs: 700 }, { kind: "particles", preset: "heal", target: "player", durationMs: 800, wait: true },
        say("셀리스", "모두를 찾아서 케프카의 탑으로 가자."),
      ],
    },
  },
} as const satisfies Record<string, ChapterSpec>;

export type JrpgChapterId = keyof typeof JRPG_CHAPTERS;
export const JRPG_CHAPTER_IDS = Object.keys(JRPG_CHAPTERS) as JrpgChapterId[];

const key = (c: Cell): string => `${c.x},${c.y}`;
const BEAT_LABEL: Record<string, string> = {
  say: "대사", letterbox: "레터박스", flash: "섬광", shake: "흔들림", particles: "입자", distort: "왜곡", tint: "색조",
  emote: "감정 말풍선", look: "자세", weather: "날씨", parallel: "동시 연출",
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

const authorJrpgChapter: ToolDefinition = {
  name: "author_jrpg_chapter",
  description:
    "크로노 트리거·FF6 풍 한 장(章)을 한 번에 짓는다 — 「크로노 트리거 천년제 마을 만들어줘」「FF6 나르셰 광산」「오페라 하우스 사건」. "
    + "{chapter, prefix?, seed?, timeGateFrom?:mapId} chapter: " + JRPG_CHAPTER_IDS.join(" · ") + ". "
    + "거점(장면 구성기) + 갈래 맵(손 도트 실내·장면·author_dungeon 던전)을 집 문·가장자리·던전 입구로 잇고, 이름 있는 NPC(대사), "
    + "퀘스트(의뢰 → 조력자 대화 → 단서 조사 → 수호자 전투 → 보고, create_quest), 사건 컷신(script_cutscene, 들어오면 한 번), 맵 분위기(날씨·조명), 던전의 보이는 적·상자까지 깐다. "
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
    if (timeGateFrom) requireMap(draft, timeGateFrom);
    const troops = pickTroops(draft, undefined);
    const warnings: string[] = [];
    const ids = new Map<string, string>();
    const taken = new Map<string, Set<string>>();
    const takenOf = (mapId: string): Set<string> => { let s = taken.get(mapId); if (!s) taken.set(mapId, s = new Set()); return s; };
    const freshId = (base: string): string => { let id = base, n = 2; while (draft.maps[id]) id = `${base}_${n++}`; return id; };
    const origins = new Map<string, Cell>();
    const dungeonRooms = new Map<string, { rooms: Room[]; boss?: string; enemies: Cell[]; chests: Cell[] }>();
    const mapsOut: Array<{ key: string; mapId: string; name: string; kind: string; link?: string }> = [];

    // ① 거점
    const hubId = freshId(`${prefix}_hub`);
    nested(draft, "create_map", { id: hubId, name: spec.hub.name, themeScene: spec.hub.scene, seed });
    const hub = requireMap(draft, hubId);
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
      const gate = hubGate(draft, from, takenOf(fromId), "interior" in site);
      if (!gate) { warnings.push(`${site.name}: ${from.name} 에 출입구 자리가 없다`); continue; }
      takenOf(fromId).add(key(gate.cell));
      if ("dungeon" in site) {
        // 던전 어댑터는 버들항 칩셋에만 있다 — 거점이 고딕·선사 칩셋이어도 던전 층은 버들항으로 짓는다(장마다 칩셋이 바뀌는 JRPG 지역 구성).
        const made = nested(draft, "author_dungeon", { id: mapId, name: site.name, type: site.dungeon, size: "medium", genre: "rpg", adapter: "beodeul", seed, entrance: { fromMapId: fromId, x: gate.cell.x, y: gate.cell.y } });
        const rooms = list(made.data, "rooms").map(asRoom).filter((r): r is Room => !!r);
        const planned = (k: string): Cell[] => list(field(made.data, "population"), k).map(asCell).filter((c): c is Cell => !!c);
        dungeonRooms.set(site.key, { rooms, boss: text(field(made.data, "anchors"), "boss"), enemies: planned("enemies"), chests: planned("chests") });
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
        const there = hubGate(draft, map, takenOf(mapId), false);
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

    // ③ 분위기
    const moods: string[] = [];
    for (const [k, mood] of Object.entries(spec.moods ?? {})) {
      const map = mapOf(k);
      if (!map) continue;
      nested(draft, "set_scene_mood", {
        mapId: map.id, applyMode: "map",
        ...(mood.weather ? { weather: { kind: mood.weather, intensity: 0.6 } } : {}),
        ...(mood.ambient !== undefined ? { lighting: { ambient: mood.ambient, ...(mood.color ? { color: mood.color } : {}) } } : {}),
      });
      moods.push(`${map.name}: ${[mood.weather, mood.ambient !== undefined ? `조명 ${mood.ambient}` : ""].filter(Boolean).join(" · ")}`);
    }

    // ④ 던전 — 계획된 자리의 보이는 적·상자(보스방 수호자는 퀘스트 전투가 선다)
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

    // ⑤ NPC
    const npcIds = new Map<string, { mapId: string; eventId: string }>();
    const npcsOut: Array<{ name: string; mapId: string; x: number; y: number; lines: readonly string[] }> = [];
    spec.npcs.forEach((npc, i) => {
      const k = npc.map ?? "hub";
      const at = spot(k, 0.12 + 0.13 * (i % 5), 3);
      const map = mapOf(k);
      if (!at || !map) { warnings.push(`${npc.name}: 설 자리를 찾지 못했다`); return; }
      const eventId = `ev_${prefix}_${npc.key}`;
      nested(draft, "place_npc", { mapId: map.id, x: at.x, y: at.y, id: eventId, name: npc.name, graphic: { query: npc.query }, movement: "fixed", pages: [{ name: `${npc.name} · 기본`, lines: npc.lines }] });
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
    const clueAt = spot(q.clue.map, 0.75, 3);
    const bossRoom = dungeonRooms.get(q.foe.map);
    const bossCell = bossRoom
      ? bossRoom.rooms.find((r) => r.id === bossRoom.boss)?.spots.find((c) => !takenOf(foeMap!.id).has(key(c)) && isPassable(draft, foeMap!, c.x, c.y))
      : spot(q.foe.map, 0.95, 3);
    if (bossCell && foeMap) takenOf(foeMap.id).add(key(bossCell));
    const questKey = `${prefix}_main`;
    const stepsOut: string[] = [];
    if (giver && helper && clueMap && foeMap && clueAt && bossCell && troops.boss) {
      nested(draft, "create_quest", {
        def: {
          key: questKey, title: q.title, summary: q.summary, order: "sequence",
          blueprint: ["talk", "inspect", "kill"],
          giver, dialogue: { accepted: q.ask, completed: q.report.join("\n") },
          steps: [
            { kind: "talk", target: helper, lines: q.helper.lines },
            { kind: "inspect", at: { mapId: clueMap.id, x: clueAt.x, y: clueAt.y }, label: q.clue.label, lines: q.clue.lines },
            { kind: "kill", troopId: troops.boss, at: { mapId: foeMap.id, x: bossCell.x, y: bossCell.y, graphicQuery: q.foe.query, intro: q.foe.intro, victory: q.foe.victory } },
          ],
          rewards: { gold: q.gold },
        },
      });
      const nameOf = (ref: { eventId: string }): string => spec.npcs.find((n) => `ev_${prefix}_${n.key}` === ref.eventId)?.name ?? ref.eventId;
      stepsOut.push(
        `의뢰: ${nameOf(giver)} — 「${q.ask}」`,
        `① 대화: ${nameOf(helper)} — 「${q.helper.lines[0]}」`,
        `② 조사: ${clueMap.name} (${clueAt.x},${clueAt.y}) 「${q.clue.label}」`,
        `③ 전투: ${foeMap.name} (${bossCell.x},${bossCell.y}) ${q.foe.name} [${troops.boss}]`,
        `④ 보고: ${nameOf(giver)} — 「${q.report[0]}」 보상 ${q.gold}G`,
      );
    } else warnings.push(`퀘스트 「${q.title}」: 의뢰인·조력자·단서·수호자 자리 중 빠진 것이 있어 만들지 않았다`);

    // ⑦ 사건 컷신 — 그 맵에 들어오면 한 번
    const eventMap = mapOf(spec.event.map);
    const eventAt = spot(spec.event.map, 0.3, 2);
    let eventOut: { mapId: string; title: string; x: number; y: number; beats: string[] } | undefined;
    if (eventMap && eventAt) {
      const eventId = `ev_${prefix}_event`;
      nested(draft, "script_cutscene", { mapId: eventMap.id, eventId, x: eventAt.x, y: eventAt.y, trigger: "auto", once: true, skippable: true, beats: spec.event.beats });
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
        nested(draft, "create_time_gate", { a: { mapId: src.id, x: a.x, y: a.y }, b: { mapId: hubId, x: b.x, y: b.y }, name: spec.gateName ?? "시간의 문", effect: "swirl" });
        gateOut = `${src.name} (${a.x},${a.y}) ⇄ ${hub.name} (${b.x},${b.y})`;
      } else warnings.push("시간의 문 자리를 찾지 못했다");
    }

    return {
      summary: `${spec.era} 「${spec.title}」 — 맵 ${mapsOut.length}장(${mapsOut.map((m) => m.name).join(" · ")}), NPC ${npcsOut.length}, 퀘스트 「${q.title}」 ${stepsOut.length ? "의뢰·대화·조사·전투·보고" : "없음"}, 사건 「${spec.event.title}」${gateOut ? `, 시간의 문 ${gateOut}` : ""}`,
      data: { chapter: chapterId, title: spec.title, era: spec.era, hubMapId: hubId, maps: mapsOut, npcs: npcsOut, quest: { key: questKey, title: q.title, summary: q.summary, steps: stepsOut }, event: eventOut, timeGate: gateOut, moods },
      ...(warnings.length ? { warnings } : {}),
    };
  },
};

export const JRPG_CHAPTER_TOOLS: readonly ToolDefinition[] = [authorJrpgChapter];
