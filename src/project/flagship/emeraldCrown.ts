import { charsetFrameIndex, decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import { configureEmeraldMonsterOpening, type EmeraldOpeningPage } from "@/project/emeraldMonsterOpening";
import { createMonsterExpedition } from "@/project/examples/monsterExpedition";
import mapTemplates from "@/project/examples/monsterExpedition/mapTemplates.json";
import { composeTown, type TownSketch, type TownTemplate } from "@/project/examples/monsterExpedition/townLayouts";
import { deserialize, serialize } from "@/project/io";
import type { Command, EventPageMovement, GameEvent, GameMap, Project } from "@/project/types";
import { FLAGSHIP_BEAT_MANIFESTS } from "./beats";
import { DAWNING_SKYBIRDS_CHARSET_ID } from "./dawningSkybirdsAsset";
import { polishFirstTenMinutes } from "./emeraldCrownFirstTen";
import type { FlagshipDemoBuildResult } from "./types";

/**
 * 대표 데모 #2 『아스트라 호라이즌: 다우닝 시티와 여명의 날개』.
 *
 * 몬스터 원정 생성기(체육관 1관)의 실제 캠페인을 그대로 쓴다 — 내 방 2층 → 연구소 첫 동료·라이벌 → 1번 도로 풀숲·포획·트레이너
 * → 실바나 마을 → 체육관 장치 퍼즐 → 관장 → 별모래 신전 보스 → 챔피언 전당 → 엔딩. 지름길(광장에서 말 두 번으로 엔딩)은 두지 않는다.
 * 여기서 하는 일은 이름·이야기·대사를 이 세계에 맞게 다시 쓰고, 첫 마을을 30×24 다우닝 시티로 다시 짓고, 여명의 날개 새를 띄우는 것이다.
 */

const SPECIES_NAMES: Readonly<Record<string, string>> = {
  mx_species_spriglet: "토리프",
  mx_species_bramblet: "실바리온",
  mx_species_canopine: "벨데로드",
  mx_species_coalbit: "파이린",
  mx_species_kilnclaw: "볼케이건",
  mx_species_pyroscale: "마그렉스",
  mx_species_rivulet: "아쿠링",
  mx_species_tideling: "마린웨이",
  mx_species_abyssal: "네레이드",
};

const PLACE = {
  region: "아스트라 군도",
  home: "다우닝 시티",
  route1: "1번 도로 · 여명 해안길",
  town2: "실바나 마을",
  gym: "실바나 체육관",
  route2: "2번 도로 · 솔방울 언덕",
  temple: "별모래 신전",
  league: "챔피언 전당",
} as const;

/** 생성기 고유명 → 이 세계 고유명. 긴 것부터 바꾼다(「새벽섬 마을」이 「새벽섬」보다 먼저). */
const NAME_SWAPS: ReadonlyArray<readonly [string, string]> = [
  ["꼬마초", "토리프"],
  ["불씨점", "파이린"],
  ["물방울", "아쿠링"],
  ["1번길 · 별싹 들판", PLACE.route1],
  ["별빛 리그 · 챔피언", PLACE.league],
  ["별빛 리그", "아스트라 리그"],
  ["옛 별 관측탑", PLACE.temple],
  ["도감 정원", "솔방울 언덕"],
  ["별싹 마을", PLACE.home],
  ["새벽섬 마을", PLACE.home],
  ["별빛섬", PLACE.region],
  ["새벽섬", PLACE.region],
  ["새순 마을", PLACE.town2],
  ["새순 체육관", PLACE.gym],
  ["프렌들리숍", "도구점"],
  ["이상한 사탕", "성장 사탕"],
];

/** 받침 있는 말 뒤 조사 바로잡기 — 이름을 바꾼 뒤 「군도을」「언덕로」 같은 어긋남을 고친다. */
function hasFinal(word: string): boolean {
  const code = word.charCodeAt(word.length - 1);
  return code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
}
function finalIsRieul(word: string): boolean {
  const code = word.charCodeAt(word.length - 1);
  return code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 === 8;
}
function fixJosa(text: string, names: readonly string[]): string {
  let next = text;
  for (const name of names) {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const final = hasFinal(name);
    next = next
      .replace(new RegExp(`${esc}(을|를)(?![가-힣])`, "g"), `${name}${final ? "을" : "를"}`)
      .replace(new RegExp(`${esc}(은|는)(?![가-힣])`, "g"), `${name}${final ? "은" : "는"}`)
      .replace(new RegExp(`${esc}(이|가)(?=[\\s!?.,])`, "g"), `${name}${final ? "이" : "가"}`)
      .replace(new RegExp(`${esc}(와|과)(?=[\\s!?.,])`, "g"), `${name}${final ? "과" : "와"}`)
      .replace(new RegExp(`${esc}(으로|로)(?=[\\s!?.,])`, "g"), `${name}${final && !finalIsRieul(name) ? "으로" : "로"}`);
  }
  return next;
}

const JOSA_NAMES = [...new Set(NAME_SWAPS.map(([, to]) => to)), "토리프", "파이린", "아쿠링"];

function rewriteStrings(value: unknown, rewrite: (text: string) => string): void {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      if (typeof value[i] === "string") value[i] = rewrite(value[i] as string);
      else rewriteStrings(value[i], rewrite);
    }
    return;
  }
  if (!value || typeof value !== "object") return;
  const rec = value as Record<string, unknown>;
  for (const [key, child] of Object.entries(rec)) {
    if (typeof child === "string") rec[key] = rewrite(child);
    else rewriteStrings(child, rewrite);
  }
}

function swapNames(text: string): string {
  let next = text;
  for (const [from, to] of NAME_SWAPS) if (next.includes(from)) next = next.split(from).join(to);
  return next === text ? text : fixJosa(next, JOSA_NAMES);
}

/** 생성기 문장 중 이 세계에서 어색하거나 틀린 것 — 문장 그대로 찾아 바꾼다(맵 전체). */
const LINE_REWRITES: Readonly<Record<string, string>> = {
  "다우닝 시티에 온 걸 환영해요. 북동쪽 집이 천문박사의 연구소예요. 북쪽의 안내원이 다음 길을 알려 줍니다.":
    "다우닝 시티에 온 걸 환영해요. 광장 오른쪽 위 초록 지붕의 큰 건물이 오르비스 천문 연구소예요. 북쪽 길로 나가면 1번 도로예요.",
  "새벽이면 언덕의 등대와 몬스터들이 함께 눈을 뜬다.":
    "요즘 새벽마다 등대 불빛이 깜빡여. 그래서인지 여명의 날개 새들이 바다 위에서 자꾸 길을 잃는대.",
  "연구소 친구가 기다릴 거예요.\n북동쪽 파란 지붕을 찾아보세요.":
    "나루가 아침부터 연구소 앞을 서성이던데요.\n광장 오른쪽 위 초록 지붕의 큰 건물이에요.",
  "실바나 마을에 온 걸 환영해요. 북동쪽 건물에서 지역의 관장에게 도전할 수 있어요. 북쪽의 안내원이 다음 길을 알려 줍니다.":
    "실바나 마을에 온 걸 환영해요. 오른쪽 위 유리 지붕 건물이 실바나 체육관이에요. 관장 유림 님은 풀 타입 몬스터를 써요.",
  "숲을 돌보는 사람과 몬스터가 매년 새 나무를 심는다.":
    "이 마을 사람들은 해마다 몬스터들과 함께 새 나무를 심어요. 체육관 덩굴도 그렇게 자란 거래요.",
  "장치를 조작하면 관장에게 가는 길이 열립니다. 밸브, 문양, 수련판, 바위 앞에서 확인 버튼을 누르세요.":
    "관장님께 가는 길은 덩굴 문과 가시 덤불로 막혀 있어요. 입구의 새싹 돌 받침과 안쪽 덤불을 직접 살펴보세요.",
  "배지 케이스에 1/1번째 배지가 채워졌다.": "배지 케이스의 첫 칸이 반짝이기 시작했다.",
  "부활의 깃털도 건네받았다. 다음 길이 열렸다.":
    "부활의 깃털도 건네받았다. 이제 마을 북쪽 별모래 신전으로 가는 길이 열렸다!",
  "몬스터들은 오래전부터 아스트라 군도의 한 등불을 지켜 왔단다. 밤막회사가 빛을 가져가면서 섬의 균형이 무너지고 있어.":
    "어서 오렴. 아스트라 군도의 몬스터들은 오래전부터 등대 불빛을 따라 살아왔단다. 그런데 밤막회사가 별모래 신전의 별빛을 가져가면서 등대가 꺼져 가고 있어.",
  "메뉴의 「도감」에서 만난 동료를, 「배지」에서 현재 목표를 볼 수 있단다. 한 관장의 약속을 모아 보렴.":
    "메뉴의 「도감」에서 만난 몬스터를, 「배지」에서 다음 목표를 볼 수 있단다. 먼저 실바나 마을의 관장 유림을 찾아가 보렴.",
  "한 지역의 약속을 모아, 빛을 잃어 가는 별의 등대를 다시 밝혀 주었으면 한단다.":
    "실바나 체육관의 배지를 받으면 별모래 신전으로 가는 길이 열린단다. 등대의 빛을 되찾아 주렴.",
  "세상이 흔들려도 빛만 모으면 내가 질서를 만들 수 있어. 그 한 약속으로 나를 막아 보아라!":
    "별빛을 한곳에 모으면 누구도 길을 잃지 않는 질서가 생긴다. 배지 하나로 나를 막을 수 있을 것 같으냐!",
  "한 배지의 빛과 동료들의 울음이 하나로 모였다. 오래된 등대가 다시 아스트라 군도를 비추기 시작했다.":
    "배지의 빛과 동료들의 울음이 하나로 모였다. 꺼져 가던 등대가 다시 아스트라 군도를 비추기 시작했다.",
  "빛은 누군가의 소유가 아니었어. 이제… 나도 섬을 다시 배워야겠군.":
    "빛은 누군가 가둬 둘 수 있는 게 아니었군. 이제… 나도 이 군도를 처음부터 다시 걸어 봐야겠어.",
  "아스트라 리그의 문이 열렸다. 실바나 마을에서 마지막 도전을 시작하자.":
    "새벽 하늘로 여명의 날개 새떼가 다시 날아올랐다. 실바나 마을 북쪽 끝, 챔피언 전당의 문이 열렸다.",
  "1번 도로 · 여명 해안길. 야생 몬스터는 포획할 수 있지만 조련사의 몬스터는 포획할 수 없습니다. 길을 걷기 전에 체력과 기술 PP를 확인하세요.":
    "1번 도로 · 여명 해안길. 키 큰 풀숲에는 야생 몬스터가 숨어 있다. 다른 트레이너의 몬스터는 잡을 수 없다.",
  "솔방울 언덕에는 길에서 만나기 힘든 몬스터가 살아요. 도감에 빈칸이 있다면 천천히 탐색해 보세요.":
    "솔방울 언덕에는 1번 도로에서 보기 힘든 몬스터가 살아요. 체육관에 가기 전에 여기서 동료를 단련해도 좋아요.",
  "북쪽 길: 1번 도로 · 여명 해안길": "북쪽: 1번 도로 · 여명 해안길",
  "북쪽 길: 솔방울 언덕": "북쪽: 2번 도로 · 솔방울 언덕",
  "북쪽 길: 실바나 마을": "북쪽: 실바나 마을",
  "다우닝 시티 북동쪽 연구소에서 천문박사와 첫 동료를 만나라.": "다우닝 시티의 오르비스 천문 연구소에서 첫 동료를 만나라.",
  "실바나 마을의 별모래 신전에서 밤막회사를 막고 등대를 복구하라.": "별모래 신전에서 밤막회사를 막고 등대의 빛을 되찾아라.",
  "아스트라 리그의 사천왕과 챔피언 나루에게 도전하라.": "챔피언 전당에서 나루와 마지막 승부를 겨뤄라.",
  "포획구슬 세 개와 고급 회복약, 성장 사탕 하나를 찾았다!": "포획 구슬 세 개와 상급 회복약, 성장 사탕 하나를 찾았다!",
  "몬스터 센터에 어서 오세요! 동료들을 건강하게 해 드릴까요?": "회복 센터에 어서 오세요! 동료들을 건강하게 해 드릴까요?",
  "리그에서 다시 만나자. 서로 끝까지 동료들을 지키는 거야.": "챔피언 전당에서 다시 만나자. 그때는 내가 이길 거야!",
  "희귀 몬스터가 당신을 기다리고 있다.": "별빛 속으로 사라졌다. 언젠가 다시 나타날 것이다.",
  "빛을 잃은 별무늬가 새겨져 있다. 섬의 등불이 모두 돌아온 뒤 다시 와 보자.": "빛을 잃은 별무늬가 새겨져 있다. 챔피언이 된 뒤에 다시 와 보자.",
  "첫 동료와 만났다! 야생 전투에서는 「가방」의 포획구슬을 사용해 보렴.": "첫 동료와 만났구나! 야생 몬스터를 만나면 「가방」의 포획 구슬을 던져 보렴. 체력을 깎아 두면 잘 잡힌단다.",
  "포획구슬과 회복 도구를 챙겨 가세요. 약은 메뉴에서 몬스터를 골라 사용할 수 있어요.": "포획 구슬과 회복 도구를 챙겨 가세요. 약은 메뉴에서 몬스터를 골라 쓸 수 있어요.",
  "체력이 노란색이 되면 포획구슬이 잘 듣는대요.": "체력이 노란색이 되면 포획 구슬이 잘 듣는대요.",
};

/** 같은 문장이 맵마다 다른 뜻으로 쓰이는 곳 — 이벤트 하나 안에서만 바꾼다. */
const EVENT_LINE_REWRITES: ReadonlyArray<readonly [mapId: string, eventId: string, from: string, to: string]> = [
  ["mx_map_lab", "mx_map_lab_rival", "먼저 이곳의 장치와 이전 약속을 마쳐야 한다.", "어? 너 아직 동료가 없잖아. 박사님께 먼저 가 봐!"],
  ["mx_map_lab", "mx_map_lab_rival", "챔피언 전당에서 다시 만나자. 그때는 내가 이길 거야!", "역시 만만치 않네! 난 먼저 실바나 마을로 간다. 챔피언 전당에서 다시 만나자!"],
  ["mx_map_grove", "mx_map_grove_rival", "먼저 이곳의 장치와 이전 약속을 마쳐야 한다.", "유림 관장님 배지는 받았어? 배지를 받고 오면 그때 한판 붙자!"],
  ["mx_map_observatory", "mx_map_observatory_boss", "먼저 이곳의 장치와 이전 약속을 마쳐야 한다.", "배지 하나 없는 꼬마로군. 돌아가라."],
  ["mx_map_league_0", "mx_map_league_0_league_challenge", "먼저 이곳의 장치와 이전 약속을 마쳐야 한다.", "신전의 일을 끝내고 와. 여기서 기다릴게."],
  ["mx_map_grove_gym", "mx_map_grove_gym_leader", "먼저 이곳의 장치와 이전 약속을 마쳐야 한다.", "내게 오는 길은 덩굴과 덤불이 지키고 있어. 길을 직접 열고 와 줘."],
  ["mx_map_grove_gym", "mx_map_grove_gym_leader", "먼저 앞 지역 관장의 약속을 받아 와 주세요.", "동료도 없이 체육관에 왔구나. 먼저 천문 연구소에서 파트너를 만나고 와."],
];

/** 잠긴 길 문장 — 왜 막혔고 무엇을 하면 열리는지 말한다. */
const LOCKED_ROUTE_LINES: Readonly<Record<string, string>> = {
  mx_map_home_to_mx_map_meadow: "동료 없이 풀숲에 들어가면 위험하다. 먼저 오르비스 천문 연구소에 들르자.",
  mx_map_grove_to_mx_map_garden: "동료 없이 언덕을 넘기는 무리다. 먼저 천문 연구소에서 첫 동료를 만나자.",
  mx_map_grove_to_mx_map_observatory: "신전으로 가는 다리 앞을 체육관 수련생이 지키고 있다. 실바나 체육관의 배지가 있어야 지나갈 수 있다.",
  mx_map_grove_to_mx_map_league_0: "챔피언 전당의 문은 굳게 닫혀 있다. 별모래 신전의 일을 먼저 해결하자.",
};

const MAP_TITLES: Readonly<Record<string, string>> = {
  mx_map_home_house_2f: "다우닝 시티 · 내 방",
  mx_map_home_house: "다우닝 시티 · 우리 집",
  mx_map_home: PLACE.home,
  mx_map_home_center: "다우닝 시티 · 회복 센터",
  mx_map_home_center_2f: "다우닝 시티 · 회복 센터 2층",
  mx_map_home_mart: "다우닝 시티 · 도구점",
  mx_map_school: "다우닝 트레이너 학교",
  mx_map_lab: "오르비스 천문 연구소",
  mx_map_meadow: PLACE.route1,
  mx_map_grove: PLACE.town2,
  mx_map_grove_center: "실바나 마을 · 회복 센터",
  mx_map_grove_center_2f: "실바나 마을 · 회복 센터 2층",
  mx_map_grove_mart: "실바나 마을 · 도구점",
  mx_map_grove_house: "실바나 마을 · 주민의 집",
  mx_map_grove_house_2f: "실바나 마을 · 주민의 집 2층",
  mx_map_grove_gym: PLACE.gym,
  mx_map_garden: PLACE.route2,
  mx_map_observatory: PLACE.temple,
  mx_map_league_0: PLACE.league,
};

const OPENING_PAGES: EmeraldOpeningPage[] = [
  { id: "emerald_intro_welcome", shot: "dawn", text: "안녕! 만나서 반갑구나.\n나는 오르비스 천문 연구소의 천문박사란다." },
  { id: "emerald_intro_world", shot: "route", text: "아스트라 군도의 새벽 하늘에는 「여명의 날개」 새떼가\n등대 불빛을 따라 섬과 섬을 건넌단다." },
  { id: "emerald_intro_lab", shot: "lab", text: "그런데 요즘 등대가 자꾸 꺼져 가는구나.\n밤막회사가 별모래 신전의 별빛을 모으고 있다더군." },
  { id: "emerald_intro_companions", shot: "stage", text: "풀의 토리프, 불의 파이린, 물의 아쿠링.\n첫 동료는 네가 직접 고르렴." },
  { id: "emerald_intro_rival", shot: "gym", text: "실바나 체육관의 관장 유림, 그리고 네 소꿉친구 나루도\n너를 기다리고 있단다." },
  { id: "emerald_intro_departure", shot: "town", text: "다우닝 시티의 네 방에서 모험이 시작된다.\n준비가 되면 연구소로 오렴!" },
];

const DAWNING_CITY_SKETCH: TownSketch = {
  ground: ["grass0", "grass0", "grass1", "grass2", "grass3"],
  legend: {
    "#": { frame: true },
    "=": { group: "clearing" },
    "~": { group: "water" },
    f: { tile: ["flower_red", "flower_white", "flower_yellow", "flower_pink"] },
    F: { tile: ["flowerbed_red", "flowerbed_yellow", "flowerbed_pink", "flowerbed_white"] },
    S: { tile: ["sign"] },
    M: { tile: ["mailbox"] },
    T: { prop: "tree_a" },
    U: { prop: "tree_b" },
  },
  kits: [
    ["cabin_a", 8, 6],
    ["cabin_b", 16, 6],
    ["gable_a", 21, 4],
    ["mart", 2, 11],
    ["center", 8, 11],
    ["shop_a", 21, 13],
  ],
  rows: [
    "#############==###############",
    "#############==###############",
    "#############==###############",
    "##..T.....f..==..f..........##",
    "##...........==.............##",
    "##....f......==.............##",
    "##...........==.............##",
    "##...........==.............##",
    "##...........==.............##",
    "##.....M.....==.....S.......##",
    "##.....================.....##",
    "##...........===.....====...##",
    "##...........==.F~~~F.......##",
    "##...........==.f~~~f.......##",
    "##...........==.F~~~F.......##",
    "##.==....==..==.............##",
    "##.====================.....##",
    "##.====================.===.##",
    "##.T....U....==..T...f......##",
    "##...f.......==.............##",
    "##.....F.....==.............##",
    "##############################",
    "##############################",
    "##############################",
  ],
};

function forEachCommandList(map: GameMap, visit: (commands: Command[]) => void): void {
  for (const ev of map.events) {
    visit(ev.commands);
    for (const page of ev.pages ?? []) visit(page.commands);
  }
}

function retargetReturnPortal(map: GameMap | undefined, toMapId: string, x: number, y: number): void {
  if (!map) return;
  forEachCommandList(map, (commands) => {
    for (const cmd of commands) {
      if (cmd.kind === "transfer" && cmd.mapId === toMapId) {
        cmd.x = x;
        cmd.y = y;
      }
    }
  });
}

/** 하늘을 나는 장식 새 — 위층(above)이라 길을 막지 않고, 두 칸을 오가며 난다. */
function createSkybirdEvent(id: string, name: string, x: number, y: number, characterIndex: number, direction: "up" | "right" | "down" | "left"): GameEvent {
  const opposite = { up: "down", down: "up", left: "right", right: "left" } as const;
  const movement: EventPageMovement = {
    type: "custom",
    speed: 3,
    frequency: 5,
    route: { repeat: true, skippable: true, moves: [{ kind: "move", dir: direction }, { kind: "move", dir: opposite[direction] }] },
  };
  return {
    id,
    name,
    x,
    y,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      {
        id: `${id}_p1`,
        name: "여명의 날개",
        conditions: [],
        graphic: {
          sprite: { type: "bundled", id: DAWNING_SKYBIRDS_CHARSET_ID },
          direction,
          pattern: charsetFrameIndex({ characterIndex, direction, pattern: 1 }),
          transparent: false,
        },
        movement,
        priority: "above",
        overlapForbidden: false,
        trigger: { kind: "action" },
        commands: [],
      },
    ],
  };
}

function textCommand(body: string, speaker?: string): Command {
  return speaker ? { kind: "text", speaker, body } : { kind: "text", body };
}

function findEvent(project: Project, mapId: string, eventId: string): GameEvent | undefined {
  return project.maps[mapId]?.events.find((e) => e.id === eventId);
}

function rewriteEventLine(event: GameEvent | undefined, from: string, to: string): void {
  if (!event) return;
  rewriteStrings(event, (text) => (text === from ? to : text));
}

/** 「X로 가는 길은 아직 열리지 않았다…」 를 이유와 할 일을 말하는 문장으로. */
function rewriteLockedRoutes(project: Project): void {
  for (const map of Object.values(project.maps)) {
    for (const ev of map.events) {
      const line = LOCKED_ROUTE_LINES[ev.id];
      if (line) rewriteStrings(ev, (text) => (/가는 길은 아직 열리지 않았다/.test(text) ? line : text));
    }
  }
}

/** 시작을 내 방 2층으로 옮긴다 — 생성기가 광장에 둔 첫 안내 이벤트를 방으로 가져오고 글을 이 세계에 맞춘다. */
function startInBedroom(project: Project, introEvent: GameEvent | undefined): void {
  const bedroom = project.maps["mx_map_home_house_2f"];
  if (!bedroom) return;
  const start = { x: 5, y: 5 };
  project.startMapId = bedroom.id;
  project.startPos = start;
  const intro: GameEvent = introEvent ?? {
    id: "mx_map_home_opening",
    name: "여행의 시작",
    x: start.x,
    y: start.y,
    trigger: { kind: "auto" },
    commands: [],
    pages: [],
  };
  intro.x = start.x;
  intro.y = start.y;
  intro.id = "mx_map_home_house_2f_opening";
  const commands: Command[] = [
    textCommand("오늘은 천문박사님께 첫 동료를 받기로 한 날이다. 창밖에서 여명의 날개 새들이 길을 잃은 듯 빙빙 돌고 있다."),
    textCommand("방향키로 걷고, Z/Enter로 말을 걸고, X/Esc로 메뉴를 연다. 계단은 방 오른쪽 위에 있다."),
    { kind: "setSwitch", switchId: "mx_intro", value: true },
  ];
  for (const page of intro.pages ?? []) page.commands = commands;
  bedroom.events.push(intro);
}

/** 엄마 — 첫 동료를 받기 전에는 연구소로 가라고 한다(회복은 그대로). */
function retellMom(project: Project): void {
  const mom = findEvent(project, "mx_map_home_house", "mx_map_home_house_resident");
  const page = mom?.pages?.[0];
  if (!page) return;
  page.commands = [
    {
      kind: "fork",
      condition: { kind: "switch", switchId: "mx_starter", value: true },
      then: [textCommand("모험에서 가장 중요한 건 무사히 돌아오는 일이야. 힘들면 언제든 쉬어 가렴.", "엄마")],
      else: [textCommand("박사님이 아침부터 기다리셔. 연구소는 광장 오른쪽 위 초록 지붕의 큰 건물이야. 나루는 벌써 나갔단다!", "엄마")],
    },
    ...page.commands.filter((c) => c.kind !== "text"),
  ];
}

/** 체육관 관장 앞 수련생 셋은 대사가 같은 틀이라 이름과 말을 다르게 준다. */
function retellGymTrainers(project: Project): void {
  const lines: Record<string, [string, string]> = {
    mx_map_grove_gym_grunt_0: ["덩굴지기 하람", "덩굴 문을 연 건 너구나? 그럼 이번엔 내 동료를 넘어 봐!"],
    mx_map_grove_gym_grunt_1: ["정원사 소이", "가시 덤불을 정리한 솜씨는 봤어. 승부 솜씨도 보여 줄래?"],
    mx_map_grove_gym_grunt_2: ["수련생 도윤", "관장님 앞까지 그냥 보낼 순 없지. 풀 타입의 끈기를 맛봐!"],
  };
  for (const [eventId, [speaker, line]] of Object.entries(lines)) {
    const ev = findEvent(project, "mx_map_grove_gym", eventId);
    if (!ev) continue;
    rewriteStrings(ev, (text) => (/^(관장님께 가려면|여기 장치를 푼 실력|관장님의 제자로서)/.test(text) ? line : text));
    forEachCommandList({ events: [ev] } as unknown as GameMap, (commands) => {
      for (const c of commands) if (c.kind === "text" && c.body === line) c.speaker = speaker;
    });
  }
}

/** 다우닝 시티를 30×24 로 다시 짓고 문·NPC 를 새 자리로 옮긴다. */
function rebuildDawningCity(project: Project): GameMap {
  const homeMap = project.maps["mx_map_home"]!;
  const overworldTemplate = (mapTemplates as unknown as Record<string, TownTemplate>)["overworld/map"]!;
  composeTown(project, homeMap, overworldTemplate, DAWNING_CITY_SKETCH);
  const portalCoords: Readonly<Record<string, { readonly x: number; readonly y: number; readonly returnMapId?: string; readonly returnX?: number; readonly returnY?: number }>> = {
    mx_map_home_to_mx_map_home_house: { x: 9, y: 9, returnMapId: "mx_map_home_house", returnX: 9, returnY: 10 },
    // 연구소는 광장 오른쪽 위 가장 큰 초록 지붕 건물(gable_a), 트레이너 학교는 그 왼쪽 회색 지붕 통나무집 — 박사의 연구소가 민가와 똑같은 집이었다(2026-10-20 첫 10분 검수).
    mx_map_home_to_mx_map_lab: { x: 24, y: 10, returnMapId: "mx_map_lab", returnX: 24, returnY: 11 },
    mx_map_home_to_mx_map_school: { x: 18, y: 9, returnMapId: "mx_map_school", returnX: 18, returnY: 10 },
    mx_map_home_to_mx_map_home_mart: { x: 3, y: 14, returnMapId: "mx_map_home_mart", returnX: 3, returnY: 15 },
    mx_map_home_to_mx_map_home_center: { x: 9, y: 14, returnMapId: "mx_map_home_center", returnX: 9, returnY: 15 },
    mx_map_home_to_mx_map_meadow: { x: 14, y: 2, returnMapId: "mx_map_meadow", returnX: 14, returnY: 3 },
    mx_map_home_sign_mx_map_meadow: { x: 15, y: 5 },
    mx_map_home_guide: { x: 12, y: 11 },
    mx_map_home_local: { x: 6, y: 10 },
    mx_map_home_visit: { x: 14, y: 17 },
    mx_map_home_ambient_resident_1: { x: 7, y: 16 },
    mx_map_home_ambient_resident_2: { x: 20, y: 11 },
  };
  for (const ev of homeMap.events) {
    const next = portalCoords[ev.id];
    if (!next) continue;
    ev.x = next.x;
    ev.y = next.y;
    if (next.returnMapId && next.returnX !== undefined && next.returnY !== undefined) {
      retargetReturnPortal(project.maps[next.returnMapId], homeMap.id, next.returnX, next.returnY);
    }
  }
  // 리그에서 집으로 돌아오는 길도 새 광장으로.
  retargetReturnPortal(project.maps["mx_map_league_0"], homeMap.id, 14, 11);
  // 카페 앞 바리스타 — 문은 열리지 않으니 문 옆에 서서 이 마을 이야기를 한다.
  homeMap.events.push({
    id: "ev_dawning_cafe_barista",
    name: "전망 카페 바리스타",
    x: 24,
    y: 17,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      {
        id: "ev_dawning_cafe_barista_p1",
        name: "바리스타",
        conditions: [],
        graphic: {
          sprite: { type: "bundled", id: "tex_oprn_charset_scarloxy_people1" },
          direction: "down",
          pattern: charsetFrameIndex({ characterIndex: 6, direction: "down", pattern: 1 }),
          transparent: false,
        },
        movement: { type: "fixed", speed: 3, frequency: 3 },
        priority: "same",
        overlapForbidden: true,
        trigger: { kind: "action" },
        commands: [
          textCommand("오늘은 준비 중이에요. 등대가 다시 밝아지면 새벽 바다를 보며 문을 열 거예요.", "전망 카페 바리스타"),
          textCommand("여명의 날개 새들은 등대 불빛을 보고 섬을 건너요. 불빛이 흐려지니 다들 이 광장 위만 맴돌고 있죠.", "전망 카페 바리스타"),
        ],
      },
    ],
  });
  homeMap.events.push(
    createSkybirdEvent("ev_dawning_skybird_gull", "광장 연못 여명갈매기", 18, 13, 0, "left"),
    createSkybirdEvent("ev_dawning_skybird_swallow", "광장 창공제비", 11, 7, 1, "right"),
    createSkybirdEvent("ev_dawning_skybird_flock", "여명의 날개 새떼", 20, 5, 3, "left"),
  );
  return homeMap;
}

function rescaleEnemy(enemy: Project["database"]["enemies"][number], level: number): void {
  if (!enemy.level || level === enemy.level) return;
  const ratio = level / enemy.level;
  enemy.level = level;
  const stats = { ...enemy.stats };
  for (const key of Object.keys(stats) as (keyof typeof stats)[]) stats[key] = Math.max(1, Math.round(stats[key] * ratio));
  enemy.stats = stats;
}

/**
 * 생성기 기본값 위에서 난도·속도를 맞춘다 — 트레이너와 거의 다 싸우는 보통 플레이어가 15~20분에 엔딩.
 * - 연구소 라이벌의 포포비는 첫 턴부터 풀 스타터에 두 배인 벌레 기술을 써서 2턴에 졌다(2026-10-20 실측) → 몸통 기술만.
 * - 실바나 체육관은 수련생 셋·관장 모두 플레이어 스타터 토리프였다 → 같은 풀 계열 다른 종(베르카부·브램보어·헤라크론).
 * - 신전 보스 4마리·챔피언 6마리는 배지 하나짜리 데모에 길다 → 3마리·4마리.
 */
function tunePacing(project: Project): void {
  const enemies = project.database.enemies;
  const byId = (id: string) => enemies.find((e) => e.id === id);
  const reskin: Record<string, { species: string; level?: number }> = {
    // 다 싸운 플레이어가 Lv6 일 때 수련생 Lv6~7 에게 6턴 만에, 관장 Lv8·10 에게 2턴 만에 졌다(2026-10-20 실플레이) → 수련생 5·5·6, 관장 7·8. 다시 재니 Lv7 스타터가 수련생 Lv6 개미(벌레)·관장 7·8 에게 6턴 만에 두 번 졌다 → 수련생 5·5·5, 관장 6·7.
    mx_enemy_mx_map_grove_gym_grunt_0_0: { species: "mx_enemy_podback", level: 5 },
    mx_enemy_mx_map_grove_gym_grunt_1_0: { species: "mx_enemy_brambleboar", level: 5 },
    mx_enemy_mx_map_grove_gym_grunt_2_0: { species: "mx_enemy_orchardant", level: 5 },
    mx_enemy_mx_map_grove_gym_leader_0: { species: "mx_enemy_podback", level: 6 },
    mx_enemy_mx_map_grove_gym_leader_1: { species: "mx_enemy_brambleboar", level: 7 },
  };
  for (const [enemyId, { species, level }] of Object.entries(reskin)) {
    const enemy = byId(enemyId), template = byId(species);
    if (!enemy || !template) continue;
    // 모습·종·상성만 갈아입히고 기술·능력치는 이 레벨에 맞는 원래 것을 쓴다(템플릿은 Lv22 라 기술이 너무 세다).
    enemy.name = template.name;
    enemy.speciesId = template.speciesId;
    enemy.monsterResourceId = template.monsterResourceId;
    enemy.graphicHue = template.graphicHue;
    enemy.elementRates = structuredClone(template.elementRates);
    enemy.stateRates = structuredClone(template.stateRates);
    if (level !== undefined) rescaleEnemy(enemy, level);
  }
  const rival = byId("mx_enemy_mx_map_lab_rival_0");
  if (rival) {
    // 풀 스타터는 벌레에게 기술이 반감이라 같은 Lv5 로는 7턴 싸우다 졌다(2026-10-20 실측) → Lv4·몸통 기술만.
    const bug = new Set(project.database.skills.filter((s) => /더듬이/.test(s.name)).map((s) => s.id));
    rival.actions = rival.actions.filter((a) => !a.skillId || !bug.has(a.skillId));
    rescaleEnemy(rival, 4);
    // 1번 도로 트레이너의 포포비도 같은 벌레 기술로 Lv5 스타터를 3턴에 쓰러뜨렸다(2026-10-20 실플레이) — 첫 도로에서는 몸통 기술만.
    const routeBug = byId("mx_enemy_mx_map_meadow_trainer_1_0");
    if (routeBug) routeBug.actions = routeBug.actions.filter((a) => !a.skillId || !bug.has(a.skillId));
    // 관장의 베르카부가 원래 기술 그대로 더듬이쏘기(벌레)를 써서 풀 스타터를 매번 2~3방에 눕혔다(2026-10-20 실입력 여정, Lv7 로 세 번 패배).
    // 풀 체육관이니 그 자리를 새싹치기(풀)로 바꾼다 — 스타터와 서로 반감이라 어깨툭 싸움이 되고, 잡은 동료가 힘을 쓸 자리가 생긴다.
    const sprout = project.database.skills.find((s) => s.name === "새싹치기")?.id;
    const leaderBug = byId("mx_enemy_mx_map_grove_gym_leader_0");
    if (leaderBug && sprout) leaderBug.actions = leaderBug.actions.map((a) => (a.skillId && bug.has(a.skillId) ? { ...a, skillId: sprout } : a));
    // 신전 보스 선봉도 같은 베르카부라 Lv8 로 내려도 Lv10 풀 스타터가 두 번 졌다(2026-10-20 실입력 여정).
    // 리그 선봉 베르카부도 같다 — 디버그로 Lv20 까지 올린 파티도 한 번 졌다(journey12). 둘 다 같은 자리 바꿈.
    for (const id of ["mx_enemy_mx_map_observatory_boss_0", "mx_enemy_mx_map_league_0_league_challenge_0"]) {
      const lead = byId(id);
      if (lead && sprout) lead.actions = lead.actions.map((a) => (a.skillId && bug.has(a.skillId) ? { ...a, skillId: sprout } : a));
    }
  }
  // 배지 하나짜리 데모라 초반 경험치를 두 배로 — 라이벌·도로 트레이너·수련생을 다 이기면 관장 앞에서 Lv8 안팎이 되게 한다.
  // (rescaleEnemy 가 레벨을 바꾸기 전 보상이 그대로라 레벨을 내린 수련생도 보상은 원래 레벨 몫이다.)
  for (const enemy of enemies) {
    if (enemy.level && enemy.level <= 10 && /^mx_enemy_mx_map_(meadow|lab|grove_gym)_/.test(enemy.id)) {
      enemy.rewards = { ...enemy.rewards, exp: enemy.rewards.exp * 2 };
    }
  }
  // 신전 보스는 배지 하나 직후라 Lv8 셋(Lv9 셋에는 관장을 막 이긴 Lv9+Lv5 파티가 두 번 졌다, 2026-10-20), 챔피언 나루는 Lv10 넷(마지막 승부라 높게).
  for (const enemy of enemies) if (/^mx_enemy_mx_map_observatory_boss_\d+$/.test(enemy.id)) rescaleEnemy(enemy, 8);
  // 무영의 몬스터가 챔피언 나루와 같은 종(베르카부·피오르·볼트온)이었고, 2단 진화 베르카부를 앞세워 Lv10 풀 스타터가 두 번 졌다(2026-10-21 정직 여정).
  // 「밤막회사」답게 그림자·독·꿈 계열 기본 종 셋으로 바꾼다 — 불은 셋 모두 보통, 풀은 꿈방울로 독을, 물은 물 기술로 셋 모두를 보통 이상으로 친다.
  const templeTeam: readonly [string, number][] = [["mx_enemy_threadimp", 7], ["mx_enemy_miretail", 7], ["mx_enemy_dozemite", 8]];
  templeTeam.forEach(([templateId, level], i) => {
    const enemy = byId(`mx_enemy_mx_map_observatory_boss_${i}`), template = byId(templateId);
    if (!enemy || !template) return;
    const rewards = enemy.rewards;
    Object.assign(enemy, structuredClone({ ...template, id: enemy.id, rewards }));
    rescaleEnemy(enemy, level);
  });
  const trim: Record<string, number> = { mx_troop_mx_map_observatory_boss: 3, mx_troop_mx_map_league_0_league_challenge: 4 };
  for (const troop of project.database.troops) {
    const keep = trim[troop.id];
    if (keep !== undefined && troop.members && troop.members.length > keep) troop.members = troop.members.slice(0, keep);
  }
}

/**
 * 사람 칩 다시 입히기 — 생성기는 Scarloxy 원본 두 장의 10명을 돌려 써서 라이벌 나루 = 회복 센터 직원 = 1번 도로 조련사,
 * 엄마 = 도로 연구원 트레이너, 챔피언 나루 = 체육관 관장 유림이 같은 그림이었다(2026-10-20 실플레이 검수). 이미 설치된
 * ScarloxyPeople 변형 칩(시트, 칸)에서 역할에 맞는 사람을 골라 한 사람 한 그림으로 맞춘다. 새로 그린 그림은 없다.
 */
const PEOPLE_CAST: Record<string, readonly [sheet: number, index: number]> = {
  mx_map_home_center_nurse: [1, 2], mx_map_grove_center_nurse: [1, 2], // 센터 직원 — 간호사
  mx_map_home_house_resident: [6, 3], // 엄마 — 머릿수건 앞치마
  mx_map_home_mart_shop: [5, 0], mx_map_grove_mart_shop: [5, 1], // 도구점 점원
  mx_map_home_guide: [12, 5], mx_map_grove_guide: [2, 1], // 여행 안내원 · 숲 마을 숲지기
  mx_map_home_local: [6, 2], mx_map_home_ambient_resident_1: [6, 0], mx_map_home_ambient_resident_2: [6, 4],
  mx_map_grove_local: [11, 4], mx_map_grove_house_resident: [6, 1], mx_map_grove_house_2f_kid: [6, 6],
  mx_map_home_center_2f_traveler: [9, 3], mx_map_grove_center_2f_traveler: [2, 2],
  mx_map_home_sign_meadow: [13, 3], mx_map_meadow_sign_grove: [12, 3], mx_map_meadow_trail_sign: [12, 0], mx_map_grove_sign_garden: [13, 4],
  // 길 트레이너·수련생은 전투 초상(boy·scientist·hiker·girl)과 같은 사람으로 읽히게 고른다.
  mx_map_meadow_trainer_0: [10, 0], mx_map_meadow_trainer_1: [9, 2], mx_map_meadow_trainer_2: [1, 7], // 산책 소년 · 연구원 · 조련사(등산 차림)
  mx_map_garden_researcher: [9, 1],
  mx_map_grove_gym_grunt_0: [12, 6], mx_map_grove_gym_grunt_1: [2, 4], mx_map_grove_gym_grunt_2: [4, 0], // 덩굴지기 하람 · 정원사 소이 · 수련생 도윤
  mx_map_grove_gym_gym_guide: [13, 2],
  mx_map_league_0_return_home: [8, 4], // 리그 안내원 — 제복
};

function recastPeople(project: Project): void {
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      const cast = PEOPLE_CAST[event.id];
      if (!cast) continue;
      const [sheet, characterIndex] = cast;
      for (const page of event.pages ?? []) {
        if (!page.graphic) continue;
        const direction = page.graphic.direction ?? "down";
        page.graphic = { ...page.graphic, sprite: { type: "bundled", id: `tex_oprn_charset_scarloxy_people${sheet}` }, pattern: charsetFrameIndex({ characterIndex, direction, pattern: 1 }) };
      }
    }
  }
  // 나루는 전투 초상(hero_f_front: 짙은 남보라 긴 머리)과 같은 원래 칩(People1 3번, 보라 긴 머리)을 그대로 쓴다 — 같은 칩을 쓰던 센터 직원 쪽을 바꿨다.
  // 전투 초상: 관장 유림(초록 머리·초록 후드)은 소녀 초상이었다 → 초록 옷 bug_catcher, 밤막회사 무영(불꽃 머리·검은 마스크)은 과학자 → punk.
  const portrait: Record<string, "bug_catcher" | "punk"> = { mx_troop_mx_map_grove_gym_leader: "bug_catcher", mx_troop_mx_map_observatory_boss: "punk" };
  for (const troop of project.database.troops) {
    const front = portrait[troop.id];
    if (front && troop.trainerSprite) troop.trainerSprite = { ...troop.trainerSprite, front };
  }
  // 챔피언 나루는 관장 유림과 같은 초록 칩이었다 — 연구소 나루의 칩을 그대로 입힌다.
  const naru = project.maps.mx_map_lab?.events.find((e) => e.id === "mx_map_lab_rival")?.pages?.[0]?.graphic;
  const champion = project.maps.mx_map_league_0?.events.find((e) => e.id === "mx_map_league_0_league_challenge");
  if (naru && champion) for (const page of champion.pages ?? []) if (page.graphic) page.graphic = { ...page.graphic, sprite: naru.sprite, pattern: charsetFrameIndex({ characterIndex: decodeCharsetFrameIndex(naru.pattern ?? 0).characterIndex, direction: page.graphic.direction ?? "down", pattern: 1 }) };
  // 리그 안내원이 결투장 한복판(4,9)에 서 있었다 — 계단 올라온 옆자리로.
  const leagueGuide = project.maps.mx_map_league_0?.events.find((e) => e.id === "mx_map_league_0_return_home");
  if (leagueGuide) { leagueGuide.x = 5; leagueGuide.y = 10; }
}

/**
 * 1번 도로 꽃밭 세 곳은 나무 밑동 위에 숲 수관 가운데 조각(위층 616·617)을 덮고, 꽃밭에 몬스터 볼처럼 생긴 장식(640)을 얹었다.
 * 밑동 없는 네모 수관이 떠 보이고(2026-10-20 검수), 볼은 주울 수도 없는 장식이었다 → 위층 세 칸씩 비운다(아래층 나무·꽃은 그대로).
 */
function tidyMeadowDecor(project: Project): void {
  const meadow = project.maps.mx_map_meadow;
  if (!meadow) return;
  for (let i = 0; i < meadow.upperTiles.length; i++) {
    const tile = meadow.upperTiles[i];
    if (tile === 616 || tile === 617 || tile === 640) meadow.upperTiles[i] = -1;
  }
}

/** 명령 나무의 모든 하위 목록(분기·선택지·전투 결과)을 돈다. */
function forEachNestedCommandList(commands: Command[], visit: (list: Command[]) => void): void {
  visit(commands);
  for (const command of commands) {
    const node = command as unknown as Record<string, unknown>;
    for (const key of ["then", "else", "branch", "victoryBranch", "defeatBranch", "escapeBranch", "cancelBranch"]) {
      const child = node[key];
      if (Array.isArray(child)) forEachNestedCommandList(child as Command[], visit);
    }
    if (Array.isArray(node.options)) for (const option of node.options as { branch?: Command[] }[]) if (option.branch) forEachNestedCommandList(option.branch, visit);
  }
}

/**
 * 트레이너에게 지면 생성기 기본은 곧바로 게임 오버였다 — 1번 도로 트레이너 한 번 지면 타이틀로 돌아갔다(2026-10-20 실플레이).
 * 포켓몬류 관례대로 「눈앞이 캄캄해졌다 → 가까운 회복 센터에서 깨어난다」로 바꾼다. 트레이너는 이긴 표시가 없으니 다시 도전할 수 있다.
 * 연구소 첫 라이벌전은 져도 이야기가 이어진다(라이벌이 이기고 먼저 떠난다).
 */
function softenTrainerDefeats(project: Project): void {
  const centerFor = (mapId: string) => (/^mx_map_(meadow|lab|home)/.test(mapId) ? "mx_map_home_center" : "mx_map_grove_center");
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      for (const page of event.pages ?? []) {
        forEachNestedCommandList(page.commands, (list) => {
          for (const command of list) {
            if (command.kind !== "battleProcessing") continue;
            const battle = command as Extract<Command, { kind: "battleProcessing" }>;
            const defeat = battle.defeatBranch ?? [];
            const over = defeat.findIndex((c) => c.kind === "gameOver");
            if (over < 0) continue;
            const firstRival = (battle.victoryBranch ?? []).some((c) => c.kind === "setSwitch" && c.switchId === "mx_rival_lab");
            if (firstRival) {
              battle.defeatBranch = [
                ...defeat.slice(0, over).filter((c) => c.kind !== "text"),
                { kind: "text", body: "내가 이겼다! 그래도 너, 처음치고는 꽤 하는데?", speaker: "나루" },
                { kind: "recoverAll" },
                ...(battle.victoryBranch ?? []).filter((c) => c.kind !== "m2Command" && c.kind !== "text"),
                { kind: "text", body: "난 먼저 실바나 마을로 간다. 챔피언 전당에서 다시 만나자!", speaker: "나루" },
              ];
              continue;
            }
            const center = project.maps[centerFor(map.id)];
            if (!center) continue;
            battle.defeatBranch = [
              ...defeat.slice(0, over),
              { kind: "text", body: "…정신을 차려 보니 회복 센터였다. 동료들도 기운을 되찾았다." },
              { kind: "recoverAll" },
              { kind: "transfer", mapId: center.id, x: 7, y: 7, direction: "up", fade: "black" },
            ];
          }
        });
      }
    }
  }
  // 라이벌 재대결 선택지가 첫 만남 대사(「우리도 같은 날 출발하는구나!」)를 그대로 다시 말했다.
  const rival = project.maps.mx_map_lab?.events.find((e) => e.id === "mx_map_lab_rival");
  for (const page of rival?.pages ?? []) {
    forEachNestedCommandList(page.commands, (list) => {
      if (!list.some((c) => c.kind === "battleProcessing")) return;
      const battle = list.find((c) => c.kind === "battleProcessing") as Extract<Command, { kind: "battleProcessing" }>;
      if ((battle.victoryBranch ?? []).some((c) => c.kind === "setSwitch")) return;
      for (const c of list) if (c.kind === "text" && /같은 날 출발/.test(c.body)) c.body = "좋아, 한 번 더 붙어 보자!";
    });
  }
}

export function createEmeraldCrownFlagshipDemo(): FlagshipDemoBuildResult {
  const { project } = createMonsterExpedition({ firstGymType: "grass", gymCount: 1 });

  const title = "아스트라 호라이즌: 다우닝 시티와 여명의 날개";
  project.meta.title = title;
  project.meta.author = "OPRN Flagship Studio";

  for (const sp of project.database.monsterSpecies ?? []) {
    const renamed = SPECIES_NAMES[sp.id];
    if (renamed) sp.name = renamed;
  }
  for (const enemy of project.database.enemies) {
    const renamed = SPECIES_NAMES[enemy.id];
    if (renamed) enemy.name = renamed;
  }
  const candy = project.database.items.find((item) => item.id === "mx_candy");
  if (candy) candy.name = "성장 사탕";

  // 생성기가 광장에 둔 첫 안내 이벤트는 내 방으로 옮긴다(아래 startInBedroom).
  const homeBefore = project.maps["mx_map_home"]!;
  const introEvent = homeBefore.events.find((e) => e.id === "mx_map_home_opening");
  homeBefore.events = homeBefore.events.filter((e) => e.id !== "mx_map_home_opening");

  // 이름 → 문장 → 이벤트 단위 문장 순서로 다시 쓴다.
  const rewrite = (text: string): string => LINE_REWRITES[swapNames(text)] ?? swapNames(text);
  rewriteStrings(project.maps, rewrite);
  rewriteStrings(project.system.monsterCampaign, rewrite);
  if (project.system.gameOver) rewriteStrings(project.system.gameOver, rewrite);
  for (const [mapId, eventId, from, to] of EVENT_LINE_REWRITES) rewriteEventLine(findEvent(project, mapId, eventId), from, to);
  rewriteLockedRoutes(project);
  retellMom(project);
  retellGymTrainers(project);

  for (const [mapId, name] of Object.entries(MAP_TITLES)) {
    const m = project.maps[mapId];
    if (m) m.name = name;
  }

  rebuildDawningCity(project);
  startInBedroom(project, introEvent);
  tunePacing(project);
  softenTrainerDefeats(project);
  recastPeople(project);
  tidyMeadowDecor(project);
  polishFirstTenMinutes(project);

  // 1번 도로와 신전에도 여명의 날개 — 길 위를 날 뿐 막지 않는다.
  project.maps["mx_map_meadow"]?.events.push(
    createSkybirdEvent("ev_meadow_skybird_finch", "1번 도로 별빛방울새", 14, 9, 2, "left"),
    createSkybirdEvent("ev_meadow_skybird_kingfisher", "1번 도로 황혼물총새", 6, 18, 6, "right"),
  );
  project.maps["mx_map_observatory"]?.events.push(createSkybirdEvent("ev_temple_skybird_astra", "신전 위 아스트라별새", 5, 6, 7, "right"));

  project.endings = [
    {
      id: "mx_ending_starlight",
      name: "아스트라 호라이즌 · 여명의 날개",
      conditions: [{ kind: "switch", switchId: "mx_ending", value: true }],
      priority: 100,
      presentation: {
        tone: "warm",
        credits: "아스트라 호라이즌: 다우닝 시티와 여명의 날개\n등대가 다시 밝아지고, 여명의 날개 새떼가 군도를 건넌다.\n기획·도트·연출: OPRN Flagship Studio",
      },
    },
  ];

  // 오프닝·타이틀은 이름을 다 바꾼 뒤에 만든다(타이틀이 meta.title 을 읽는다).
  configureEmeraldMonsterOpening(project, { pages: OPENING_PAGES });
  if (project.system.titleScreen) {
    project.system.titleScreen.title = "아스트라 호라이즌";
    project.system.titleScreen.logoSubtitle = "다우닝 시티와 여명의 날개";
  }

  const serialized = serialize(project);
  const reloaded = deserialize(serialized);
  const manifest = {
    ...FLAGSHIP_BEAT_MANIFESTS["emerald-crown"],
    mapCount: Object.keys(reloaded.maps).length,
    endingCount: reloaded.endings?.length ?? 0,
  };
  return { id: "emerald-crown", manifest, project: reloaded, serialized };
}
