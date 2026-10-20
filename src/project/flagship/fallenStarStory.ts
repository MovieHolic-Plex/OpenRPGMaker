/**
 * 『폴른 스타』 제1막 이야기 사양 — 장 구성기(buildJrpgChapter)에 그대로 넘긴다.
 *
 * 줄거리: 왕도 아스텔의 견습 별지기 카엘과 마도학자 엘레나가, 밤사이 동쪽 숲에 떨어진 「별」을 찾아간다.
 * 별은 배였고 안에는 사람을 닮은 기계 이리스가 잠들어 있었다. 이리스는 집에 신호를 보내야 하고,
 * 신호를 보낼 옛 렌즈는 천문대 지하에 봉인돼 있다. 하늘에서 온 것을 모두 거두려는 심문관 발렌이 그 앞을 막는다.
 *
 * 맵은 전부 버들항 손 도트 한 계열(마을·필드·던전)과 손 도트 실내 v5 다. 대사는 「이름: 말」 꼴로 쓰고
 * 짓고 난 뒤 화자 칸으로 옮긴다(applySpeakerPrefixes).
 */
import type { ChapterSpec } from "@/editor/tools/jrpgChapterTools";

export const FS_PREFIX = "fs";
export const FS_STAR_KEY_ITEM = "item_fs_star_key";

/** 이야기에 나오는 이름 — 한곳에서 바꾼다. */
export const FS_NAMES = {
  hero: "카엘",
  mage: "엘레나",
  android: "이리스",
  master: "하넬",
  ranger: "브람",
  inquisitor: "심문관 발렌",
  town: "왕도 아스텔",
} as const;

export const FALLEN_STAR_ACT1: ChapterSpec = {
  title: "떨어진 별",
  era: "제1막",
  hub: { name: "왕도 아스텔", scene: "beodeul_town:river", form: "plaza" },
  sites: [
    { key: "observatory", name: "별빛 천문대", interior: "tower" },
    {
      key: "forest", name: "속삭이는 숲", scene: "beodeul_field", gateSide: "east", entry: { x: 15, y: 39 },
      // 남쪽 입구에서 북쪽 끝 공터(추락지)까지 이어지는 막다른 숲길. 풀숲에서는 숲짐승이 나온다.
      route: {
        exits: [{ x: 15, y: 39 }], end: { x: 15, y: 8 }, clearings: [{ x: 9, y: 2, w: 13, h: 8 }],
        grassPatches: 3, encounterRate: 12,
        encounters: [{ troopId: "troop_fs_wolves", weight: 3 }, { troopId: "troop_fs_spiders", weight: 3 }, { troopId: "troop_fs_wisps", weight: 2 }],
      },
    },
    { key: "vault", name: "천문대 지하 · 옛 별지기의 방", dungeon: "temple", from: "observatory" },
  ],
  moods: {
    hub: { ambient: 0.06, color: "#ffe2b0" },
    forest: { ambient: 0.22, color: "#2c4a38" },
    vault: { ambient: 0.55, color: "#141c40" },
  },
  atmosphere: { hub: ["petals"], forest: ["fireflies", "leaves"], vault: ["runes"] },
  dress: {
    hub: [
      { object: "kit:beodeul_city/bd-prop-stall_veg", where: "fair" },
      { object: "kit:beodeul_city/bd-prop-stall_cheese_meat", where: "fair" },
      { object: "kit:beodeul_city/bd-prop-flower_cart", where: "fair" },
      { object: "kit:beodeul_city/bd-pick-walled-market-banner-red", where: "fair" },
      { object: "kit:beodeul_city/bd-pick-wizard-tower-moon-obelisk", where: "fair-center", light: "#a0c8ff" },
    ],
    observatory: [
      { object: "kit:atlas_biome_interior/hand-interior:telescope", where: "north", mark: "scope", light: "#c8dcff" },
      { object: "kit:atlas_biome_interior/hand-interior:star chart", where: "north" },
      { object: "kit:atlas_biome_interior/hand-interior:orrery", where: "center", light: "#ffd890" },
    ],
    // 숲 북쪽 끝 공터의 금속 「알」. 알 앞 칸이 단서 조사(퍼즐) 자리다. 그을린 흙 자국은 chronoBell.ts 가 둘레에 칠한다.
    forest: [
      { object: "kit:sf_station/sf-cryo-pod", where: "north", mark: "clue", light: "#8ff0ff" },
    ],
    vault: [
      { object: "kit:beodeul_city/bd-pick-headland-lighthouse-lamp-lens", where: "boss", light: "#a8e0ff" },
      { object: "kit:beodeul_city/bd-pick-wizard-tower-moon-obelisk", where: "boss", count: 2, light: "#8090ff" },
      { object: "kit:beodeul_city/bd-pick-volcano-cave-brazier", where: "rooms", count: 4, light: "#6a8cff" },
      { object: "kit:beodeul_city/bd-pick-wizard-tower-starmap", where: "rooms", count: 2 },
      { object: "kit:beodeul_city/bd-pick-wizard-tower-orrery", where: "rooms" },
    ],
  },
  npcs: [
    { key: "valen", name: FS_NAMES.inquisitor, query: "젊은 남성 마법사", lines: ["심문관 발렌: 숲에 볼일이 있나? 하늘에서 떨어진 것은 교단의 것이다. 괜한 생각은 하지 마라."] },
    { key: "knight", name: "심문회 기사", query: "붉은 갑옷 기사", lines: ["심문회 기사: 발렌 님 말씀이 들리지 않았나? 물러서라."] },
    { key: "baker", name: "빵집 아주머니", query: "여성 상인", roam: true, lines: ["빵집 아주머니: 어젯밤 하늘이 대낮처럼 밝았지 뭐니. 놀라서 반죽을 다 망쳤어."] },
    { key: "kid", name: "꼬마 토비", query: "아이", roam: true, lines: ["꼬마 토비: 형도 별똥별 봤어? 나 소원 빌었다! 뭘 빌었는지는 비밀이야."] },
    { key: "gate", name: "동문 문지기", query: "청년 병사", lines: ["동문 문지기: 동쪽으로 나가면 숲이야. 심문관 나리들이 남쪽 골짜기부터 뒤진다더군.", "동문 문지기: 숲 사정은 숲지기 브람 영감이 제일 잘 알아."] },
    { key: "elder", name: "광장의 할머니", query: "노인", lines: ["광장의 할머니: 별이 떨어지면 나라에 큰일이 난다고들 하지. 옛날 얘기지만… 이번엔 왠지 마음이 쓰이는구먼."] },
    { key: "hanel", name: "천문대장 하넬", query: "노학자", map: "observatory", lines: ["천문대장 하넬: 어서 오너라."] },
    { key: "bram", name: "숲지기 브람", query: "녹색 망토 레인저", map: "forest", lines: ["숲지기 브람: 숲에서는 길을 벗어나지 마라. 늑대들이 예민해졌다."] },
  ],
  quest: {
    title: "떨어진 별",
    summary: "어젯밤 동쪽 숲에 떨어진 별을 심문관보다 먼저 찾는다.",
    giver: "hanel",
    ask: "천문대장 하넬: 카엘, 엘레나. 어젯밤 그 별은 떨어지기 직전에 방향을 틀었다. 별똥별은 그러지 않는 법이다.\n천문대장 하넬: 심문관들이 손대기 전에 너희가 먼저 가 보거라. 숲길은 숲지기 브람이 안다.",
    helper: {
      npc: "bram",
      lines: [
        "숲지기 브람: 별을 찾는다고? 심문관들은 엉뚱한 골짜기를 뒤지고 있다.",
        "숲지기 브람: 떨어진 곳은 이 길 북쪽 끝 공터다. 밤새 쇠 긁는 소리가 났지.",
        "숲지기 브람: …사람 목소리 같은 것도 들렸다. 조심해라.",
      ],
    },
    clue: {
      map: "forest",
      label: "떨어진 별",
      lines: ["치익— 뚜껑이 열리고, 안에서 한 소녀가 천천히 몸을 일으켰다."],
    },
    foe: {
      map: "vault",
      name: FS_NAMES.inquisitor,
      enemyName: FS_NAMES.inquisitor,
      query: "젊은 남성 마법사",
      graphic: "generated-enemy-mage-rogue",
      intro: [
        "심문관 발렌: 역시 이 문을 연 건 너희였군.",
        "심문관 발렌: 여긴 옛 별지기들이 하늘과 말을 주고받던 방이다. 교단이 그 죄를 덮으려고 봉인했지.",
        "심문관 발렌: 그 기계 인형을 넘겨라. 하늘에서 온 것은 전부 교단이 거둔다.",
        "이리스: 저는 물건이 아니에요. 집에 돌아가고 싶을 뿐이에요.",
        "심문관 발렌: 그렇다면 여기서 부서져라. 깨어나라, 별지기의 수호상!",
      ],
      victory: [
        "심문관 발렌: 크윽… 이 일은 교단이 잊지 않는다.",
        "발렌은 연기 속으로 모습을 감췄다.",
        "이리스: 이 렌즈… 아직 살아 있어요. 신호를 보내 볼게요.",
        "방 한가운데의 렌즈가 빛을 모아 천장 너머로 쏘아 올렸다.",
        "이리스: …답이 왔어요! 아주 약하지만 북쪽이에요. 부서진 배의 남은 몸체가 북쪽 어딘가에서 아직 대답하고 있어요.",
        "엘레나: 하넬 선생님께 알리자.",
      ],
    },
    report: [
      "천문대장 하넬: 북쪽이라… 옛 별지기들이 마지막으로 세운 하늘탑이 그쪽에 있다.",
      "천문대장 하넬: 발렌은 반드시 다시 온다. 그 전에 떠나거라.",
      "천문대장 하넬: 카엘, 엘레나. 이리스를 집에 데려다주거라.",
    ],
    gold: 300,
  },
  // 떨어진 별 = 금속 알. 세 단계 모두 생각해야 풀린다(정답 위치가 다르다).
  puzzle: {
    intro: [
      "그을린 구덩이 한가운데에 사람 키만 한 금속 알이 박혀 있다. 아직 따뜻하다.",
      "표면의 무늬 세 개가 차례로 깜빡인다. 별, 달, 해… 다시 별, 달…",
    ],
    stages: [
      {
        prompt: "다음에 빛날 무늬를 누른다.",
        options: ["별", "해", "달"],
        answer: 1,
        hit: { lines: ["해 무늬가 노랗게 빛나고, 알 옆면에 손바닥 모양 자국이 떠올랐다.", "엘레나: 자국 아래 글자가 있어. 천문대 석판의 옛 별지기 글자랑 같아… 『살아 있는 손만 연다』."], fx: ["se:chime2"] },
        miss: { lines: ["무늬가 붉게 깜빡이고 모두 꺼졌다."], fx: ["se:buzzer1"] },
      },
      {
        prompt: "손바닥 자국에 무엇을 댈까?",
        options: ["칼끝으로 누른다", "엘레나에게 마법을 부탁한다", "맨손을 얹는다"],
        answer: 2,
        hit: { lines: ["손바닥이 따뜻해지더니, 안에서 작은 목소리가 들렸다.", "목소리: …거기 누구 있어요? 바깥은… 안전한가요?"], fx: ["se:chime2", "emote:exclamation"] },
        miss: { lines: ["자국은 아무 반응이 없다. 『살아 있는 손만』이라고 했었지."] },
      },
      {
        prompt: "안에서 겁먹은 목소리가 묻는다. 뭐라고 답할까?",
        options: ["누구냐! 정체를 밝혀라!", "괜찮아. 우리가 지켜 줄게.", "심문관이 오기 전에 빨리 나와!"],
        answer: 1,
        hit: { lines: ["목소리: …믿을게요."] },
        miss: { lines: ["목소리가 뚝 끊겼다. 알이 다시 차갑게 식는다."] },
      },
    ],
    wrong: ["처음부터 다시 해 보자."],
    wrongFx: ["shake:1"],
    solvedFx: ["shake:3", "flash:white", "particles:sparkle"],
    reward: {
      item: { id: FS_STAR_KEY_ITEM, name: "별빛 열쇠", description: "금속 알 안쪽에 박혀 있던 별 모양 조각. 천문대 지하 철문의 무늬와 똑같다." },
      line: "「별빛 열쇠」를 얻었다.",
    },
  },
  devices: [
    {
      map: "observatory", mark: "scope", name: "망원경",
      fx: ["se:chime2", "particles:sparkle"],
      lines: ["망원경 너머로 동쪽 숲 위에 아직 연기가 가늘게 피어오른다."],
      done: ["렌즈가 깨끗하게 닦여 있다. 하넬 선생님이 밤새 들여다보신 모양이다."],
    },
  ],
  // 화로 순서 퍼즐은 20×15 빈 방이 필요해 chronoBell.ts 가 천문대와 지하 사이에 따로 짓는다.
  lock: {
    site: "vault",
    item: FS_STAR_KEY_ITEM,
    locked: ["바닥의 둥근 철문에 별 모양 홈이 파여 있다. 꿈쩍도 하지 않는다."],
    opened: ["별빛 열쇠를 홈에 대자, 철문이 천천히 가라앉았다."],
    fx: ["se:key", "shake:3"],
  },
  event: {
    map: "hub",
    title: "심문관의 포고",
    beats: [
      { kind: "letterbox", show: true },
      { kind: "say", speaker: "심문관 발렌", text: "왕도 아스텔의 백성은 들어라." },
      { kind: "say", speaker: "심문관 발렌", text: "어젯밤 동쪽 숲에 떨어진 것은 별이 아니다. 하늘이 보낸 불경한 물건이다." },
      { kind: "say", speaker: "심문관 발렌", text: "그것에 손대는 자는 이단으로 다스린다." },
      { kind: "emote", target: "player", emote: "ellipsis", durationMs: 900, wait: true },
      { kind: "say", speaker: "엘레나", text: "…카엘, 들었지? 하넬 선생님이 천문대로 오라셨어. 저 사람들보다 먼저 움직여야 해." },
    ],
  },
};
