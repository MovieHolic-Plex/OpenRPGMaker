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
  hub: { name: "왕도 아스텔", scene: "beodeul_town:river", form: "plaza", forestType: "broadleaf" },
  sites: [
    { key: "observatory", name: "별빛 천문대", interior: "tower" },
    {
      key: "forest", name: "속삭이는 숲", scene: "beodeul_field", gateSide: "east", entry: { x: 15, y: 39 },
      // 남쪽 입구에서 북쪽 끝 공터(추락지)까지 이어지는 막다른 숲길. 풀숲에서는 숲짐승이 나온다.
      route: {
        exits: [{ x: 15, y: 39 }], end: { x: 15, y: 8 }, clearings: [{ x: 9, y: 2, w: 13, h: 8 }],
        grassPatches: 3, encounterRate: 12, forestType: "mixed",
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
  atmosphere: { hub: ["petals"], forest: ["fireflies", "leaves"], vault: ["dust"] },
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
    // 숲 북쪽 끝 공터에 누운 뚜껑 달린 별의 관(오프닝 crash 컷의 누운 관). 관 앞 칸이 단서 조사(퍼즐) 자리다. 그을린 흙 자국은 chronoBell.ts 가 둘레에 칠한다.
    // 세워 둔 SF 냉동 캡슐은 화면 달린 금속 단말기·자판기로 읽혔고 숲 화풍과 어긋났다(VQA r5) — 버들항 돌 관 키트로 바꾼다.
    forest: [
      { object: "kit:beodeul_city/bd-pick-aqueduct-sewer-coffin", where: "north", mark: "clue", light: "#8ff0ff" },
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
    { key: "valen", name: FS_NAMES.inquisitor, query: "젊은 남성 마법사", lines: ["심문관 발렌: 어린 별지기로군. 하늘에서 떨어진 것은 교단의 몫이다. 잊지 마라."] },
    { key: "knight", name: "심문회 기사", query: "붉은 갑옷 기사", lines: ["심문회 기사: 심문관님 말씀 못 들었나? 물러서라."] },
    { key: "baker", name: "빵집 아주머니", query: "여성 상인", roam: true, lines: ["빵집 아주머니: 어젯밤 하늘이 대낮처럼 밝았지 뭐니. 놀라서 반죽을 다 망쳤어."] },
    { key: "kid", name: "꼬마 토비", query: "아이", roam: true, lines: ["꼬마 토비: 형도 별똥별 봤어? 나 소원 빌었다! 뭘 빌었는지는 비밀이야."] },
    { key: "gate", name: "동문 문지기", query: "청년 병사", lines: ["동문 문지기: 문 밖이 바로 동쪽 숲이다. 심문관들은 남쪽 골짜기부터 뒤진다더군.", "동문 문지기: 숲길은 숲지기 브람 영감이 훤하다. 들어가면 찾아봐."] },
    { key: "elder", name: "광장의 할머니", query: "노인", lines: ["광장의 할머니: 별이 떨어지면 큰일 난다는 옛말이 있지. 이번엔 영 마음이 쓰이는구먼."] },
    { key: "hanel", name: "천문대장 하넬", query: "노학자", map: "observatory", lines: ["천문대장 하넬: 왔느냐. 기다리고 있었다."] },
    { key: "bram", name: "숲지기 브람", query: "녹색 망토 레인저", map: "forest", lines: ["숲지기 브람: 숲에서는 길을 벗어나지 마라. 늑대들이 예민해졌다."] },
  ],
  quest: {
    title: "떨어진 별",
    summary: "어젯밤 동쪽 숲에 떨어진 별을 심문관보다 먼저 찾는다.",
    giver: "hanel",
    ask: "천문대장 하넬: 어젯밤 그 별은 떨어지기 직전에 방향을 틀었다.\n엘레나: 방향을요? 별똥별은 그럴 수 없잖아요.\n천문대장 하넬: 그렇지. 무언가가 그것을 몰았다는 뜻이다.\n천문대장 하넬: 심문관보다 먼저 가 보거라. 숲길은 숲지기 브람이 안다.",
    helper: {
      npc: "bram",
      lines: [
        "숲지기 브람: 별 찾으러 왔나? 심문관 놈들은 엉뚱한 골짜기만 뒤지더군.",
        "숲지기 브람: 떨어진 곳은 이 길 북쪽 끝 공터다. 밤새 쇠 긁는 소리가 났지.",
        "숲지기 브람: …사람 목소리도 들렸다. 누굴 부르는 것 같더군.",
      ],
    },
    clue: {
      map: "forest",
      label: "떨어진 별",
      lines: ["치익— 뚜껑이 열리고, 하얀 김 속에서 한 소녀가 몸을 일으켰다."],
    },
    foe: {
      map: "vault",
      name: FS_NAMES.inquisitor,
      enemyName: FS_NAMES.inquisitor,
      query: "젊은 남성 마법사",
      graphic: "charset-battler-actor1-4",
      intro: [
        "심문관 발렌: 역시 이 문을 연 건 너희였군.",
        "심문관 발렌: 옛 별지기들이 하늘과 말을 나누던 방이다. 교단이 봉인한 죄의 방이지.",
        "심문관 발렌: 그 기계 인형을 넘겨라. 하늘의 것은 모두 교단이 거둔다.",
        "이리스: 저는 물건이 아니에요. 집에 돌아가고 싶을 뿐이에요.",
        "카엘: 들었지? 이리스는 우리 동료야. 아무한테도 못 넘겨.",
        "심문관 발렌: 그렇다면 여기서 부서져라. 깨어나라, 별지기의 수호상!",
      ],
      victory: [
        "심문관 발렌: 크윽… 이 일은 교단이 잊지 않는다.",
        "심문관 발렌: 하늘의 배가 다시 오면 이 땅이 어찌 될지… 너희는 아무것도 모른다.",
        "발렌은 연기 속으로 모습을 감췄다.",
        "이리스: 이 렌즈… 아직 살아 있어요. 신호를 보내 볼게요.",
        "방 한가운데의 렌즈가 빛을 모아 천장 너머로 쏘아 올렸다.",
        "이리스: …답이 왔어요! 북쪽이에요. 제 배의 나머지가 아직 살아 있어요.",
        "엘레나: 위로 올라가자. 하넬 선생님께 알려야 해.",
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
      "그을린 구덩이에 사람 키만 한 은빛 알이 박혀 있다. 아직 따뜻하다.",
      "엘레나: 별이… 아니야. 이건 누군가 만든 거야.",
      "표면의 무늬 세 개가 늘 같은 순서로 깜빡인다. 별 → 달 → 해, 별 → 달 → 해, 별 → 달 → …",
      "…그리고 거기서 멈췄다. 다음 차례가 비어 있다.",
    ],
    stages: [
      {
        prompt: "다음에 빛날 무늬를 누르자.",
        options: ["별", "해", "달"],
        answer: 1,
        hit: { lines: ["해 무늬가 노랗게 빛나고, 관 옆면에 손바닥 모양 자국이 떠올랐다.", "엘레나: 자국 둘레에 옛 별지기 글자가 있어. 선생님 책에서 봤어 — 『살아 있는 손만 연다』."], fx: ["se:chime2"] },
        miss: { lines: ["무늬가 붉게 깜빡이고 모두 꺼졌다."], fx: ["se:buzzer1"] },
      },
      {
        prompt: "손바닥 자국에 무엇을 댈까?",
        options: ["칼끝으로 누른다", "엘레나에게 마법을 부탁한다", "맨손을 얹는다"],
        answer: 2,
        hit: { lines: ["손바닥 아래가 따뜻해진다. 안에서 작은 목소리가 들렸다.", "알 속의 목소리: …거기 누구 있어요? 바깥은… 안전한가요?"], fx: ["se:chime2", "emote:exclamation"] },
        miss: { lines: ["자국은 아무 반응이 없다. 『살아 있는 손만』이라고 했었지."] },
      },
      {
        prompt: "떨리는 목소리다. 뭐라고 답할까?",
        options: ["누구냐! 정체를 밝혀라!", "괜찮아. 우리가 지켜 줄게.", "심문관이 오기 전에 빨리 나와!"],
        answer: 1,
        hit: { lines: ["알 속의 목소리: …믿을게요. 지금, 뚜껑을 열게요."] },
        miss: { lines: ["목소리가 뚝 끊겼다. 관이 다시 차갑게 식는다."] },
      },
    ],
    wrong: ["이 단계만 다시 해 보자."],
    wrongFx: ["shake:1"],
    solvedFx: ["shake:3", "flash:white", "particles:sparkle"],
    reward: {
      item: { id: FS_STAR_KEY_ITEM, name: "별빛 열쇠", description: "은빛 알 안쪽에 박혀 있던 별 모양 조각. 천문대 서고 바닥, 봉인석 사이 돌뚜껑의 별 모양 홈과 꼭 맞는다." },
      line: "「별빛 열쇠」를 얻었다.",
    },
  },
  devices: [
    {
      map: "observatory", mark: "scope", name: "망원경",
      fx: ["se:chime2", "particles:sparkle"],
      lines: ["망원경 너머, 동쪽 숲 위로 연기가 아직 가늘게 피어오른다."],
      done: ["렌즈가 깨끗하게 닦여 있다. 하넬 선생님이 밤새 들여다보신 모양이다."],
    },
  ],
  // 화로 순서 퍼즐은 20×15 빈 방이 필요해 chronoBell.ts 가 천문대와 지하 사이에 따로 짓는다.
  lock: {
    site: "vault",
    item: FS_STAR_KEY_ITEM,
    locked: ["봉인석 사이 바닥 돌뚜껑에 별 모양 홈이 파여 있다. 꿈쩍도 하지 않는다."],
    opened: ["별빛 열쇠를 홈에 대자, 딸깍— 돌뚜껑이 가라앉고 아래로 내려가는 돌계단이 드러났다."],
    fx: ["se:key", "shake:3"],
  },
  event: {
    map: "hub",
    title: "심문관의 포고",
    beats: [
      { kind: "letterbox", show: true },
      { kind: "say", speaker: "심문관 발렌", text: "왕도 아스텔의 백성은 들어라." },
      { kind: "say", speaker: "심문관 발렌", text: "어젯밤 동쪽 숲에 떨어진 것은 별이 아니다. 불경한 하늘의 물건이다." },
      { kind: "say", speaker: "심문관 발렌", text: "그것에 손대는 자는, 누구든 이단으로 다스린다." },
      { kind: "say", speaker: "심문관 발렌", text: "교단보다 먼저 그것을 본 자도, 마찬가지다." },
      { kind: "emote", target: "player", emote: "ellipsis", durationMs: 900, wait: true },
      { kind: "say", speaker: "엘레나", text: "…들었지, 카엘? 선생님이 천문대에서 기다리셔. 어서 가자." },
    ],
  },
};
