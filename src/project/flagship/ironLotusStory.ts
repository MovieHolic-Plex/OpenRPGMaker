/**
 * 『강호의 철련』 제1막 이야기 사양 — 장 구성기(buildJrpgChapter)에 그대로 넘긴다.
 *
 * 줄거리: 중계 기체 설린이 청죽림에 떨어진다. 정파 청죽문의 장문 소청하는 그녀의 고치에 남은
 * 신호 조각을 운무산 사원의 천기단으로 보내라 하고, 사파 흑련사의 집사 야율검은 그 쇳덩이를 거두러 쫓아온다.
 * 제자 백리호가 길을 안내하다 동료가 된다. 설린은 내공을 「미확인 에너지」로 기록한다.
 *
 * 맵은 전국·에도 손 도트(sengoku_edo) 한 계열이다. 무림 칩셋 murim_wuxia 는 사람이 고르기 전이라 굽지 않는다.
 * 대사는 「이름: 말」 꼴로 쓰고, 짓고 난 뒤 화자 칸으로 옮긴다.
 */
import type { ChapterSpec } from "@/editor/tools/jrpgChapterTools";

export const IL_PREFIX = "il";
export const IL_SIGNAL_ITEM = "item_il_signal_shard";

export const IL_NAMES = {
  hero: "설린",
  disciple: "백리호",
  master: "소청하",
  hunter: "야율검",
  inn: "고모",
  shop: "살구",
  kid: "단이",
  guard: "문지기 철",
  elder: "이야기꾼",
  town: "유하진",
  grove: "청죽림",
  temple: "운무산 사원",
  sect: "청죽문",
  cult: "흑련사",
} as const;

export const IRON_LOTUS_ACT1: ChapterSpec = {
  title: "강호의 철련",
  era: "제1막",
  hub: { name: "유하진", scene: "sengoku_edo:inn_street" },
  sites: [
    { key: "grove", name: "청죽림", scene: "sengoku_edo:samurai", gateSide: "east" },
    { key: "temple", name: "운무산 사원", scene: "sengoku_edo:temple", from: "grove", gateSide: "north" },
  ],
  moods: {
    hub: { ambient: 0.08, color: "#ffe2b8" },
    grove: { ambient: 0.28, color: "#1c3a28" },
    temple: { ambient: 0.55, color: "#141828" },
  },
  atmosphere: { hub: ["leaves"], grove: ["leaves", "fireflies"], temple: ["dust"] },
  dress: {
    hub: [
      { object: "kit:sengoku_edo/se-street-lantern", where: "center", count: 2, light: "#ffc878" },
      { object: "kit:sengoku_edo/se-lantern-stone", where: "north", light: "#ffd8a0" },
    ],
    grove: [
      { object: "kit:sengoku_edo/se-bamboo", where: "north", count: 3 },
      { object: "kit:sengoku_edo/se-lantern-stone", where: "center", mark: "clue", light: "#9ef0ff" },
      { object: "kit:sengoku_edo/se-well", where: "south" },
    ],
    temple: [
      { object: "kit:sengoku_edo/se-torii", where: "south" },
      { object: "kit:sengoku_edo/se-incense", where: "north", mark: "incense", light: "#ffb060" },
      { object: "kit:sengoku_edo/se-lantern-stone", where: "center", count: 2, light: "#ffd090" },
    ],
  },
  npcs: [
    {
      key: "cheongha", name: "장문 소청하", query: "전통 의상 여성",
      lines: ["장문 소청하: 철로 된 아이인가.\n숨은 쉬고 있구나. 그것부터 보자."],
    },
    {
      key: "gomo", name: "여관 주인 고모", query: "여관 주인",
      lines: ["여관 주인 고모: 죽림 쪽에서 쇠 긁는 소리가 밤새 났네.\n방은 비었으니 몸부터 녹이게."],
    },
    {
      key: "salgu", name: "약재상 살구", query: "머리 장식 이국 여성", roam: true,
      lines: ["약재상 살구: 보약, 기력 차, 해독 환.\n기계라도 속은 사람처럼 닳는 법이거든."],
    },
    {
      key: "dani", name: "꼬마 단이", query: "삐쭉머리 남자아이", roam: true,
      lines: ["꼬마 단이: 누나는 사람이야, 칼이야?\n만져도 안 잘려?"],
    },
    {
      key: "cheol", name: "문지기 철", query: "청년 병사",
      lines: ["문지기 철: 동문을 나서면 청죽림이다.\n흑련사 정찰이 대숲을 뒤지고 있어. 혼자 가지 마."],
    },
    {
      key: "elder", name: "이야기꾼", query: "노학자", roam: true,
      lines: ["이야기꾼: 하늘에서 철련이 떨어지면 강호가 뒤집힌다는 옛말이 있지.\n이번엔 꽃 대신 사람이 떨어졌구먼."],
    },
    {
      key: "baek", name: "백리호", query: "동양풍 떠돌이 검객", map: "grove",
      lines: ["백리호: 장문인께서 보낸 사람이다.\n고치는 이 길 안쪽, 돌등 옆이다."],
    },
  ],
  quest: {
    title: "미확인 에너지",
    summary: "청죽림의 고치에서 신호 조각을 꺼내고, 운무산 사원의 천기단으로 집을 부른다.",
    giver: "cheongha",
    ask: "장문 소청하: 네 고치가 죽림에 박혀 있다.\n그 안의 조각을 사원 천기단에 얹으면, 하늘이 답을 한다.\n설린: 기록합니다. 목표는 귀환 신호.\n방해 요소는 흑련사, 분류는 추적자.\n장문 소청하: 분류는 나중에 하거라.\n제자 백리호가 동문 밖에서 기다린다.",
    helper: {
      npc: "baek",
      lines: [
        "백리호: 네가 그 철련이구나.\n…사람 말투가 아니네.",
        "백리호: 대숲에 도는 건 독기가 아니다. 내공이다.\n검 끝에 실리는 기운.",
        "설린: 기록 갱신.\n현지 이름: 내공. 임시 분류: 미확인 에너지.",
        "백리호: 미확인이라니! 삼백 년 된 이름인데!\n…하아. 고치는 돌등 옆이다. 내가 같이 가지.",
      ],
    },
    clue: {
      map: "grove",
      label: "추락한 고치",
      lines: [
        "설린: 고치 잠금 해제. 신호 조각, 회수.\n아직 따뜻합니다.",
        "백리호: 그 조각이 네 집과 이 산을 잇는 실이구나.\n사원으로 가자. 흑련사보다 먼저.",
      ],
    },
    foe: {
      map: "temple",
      name: "집사 야율검",
      enemyName: "야율검",
      query: "닌자",
      graphic: "generated-enemy-bandit-mask",
      intro: [
        "야율검: 여기까지 기어왔군, 쇳덩이.",
        "야율검: 하늘에서 떨어진 것은 흑련사 몫이다.\n네 속을 열어 그 힘을 우리 것으로 하겠다.",
        "설린: 거절합니다.\n저는 표본이 아닙니다.",
        "백리호: 들었지? 우리 동료야.\n천기단 앞은 못 지나간다.",
        "야율검: 그럼 같이 녹여 주지.\n일어나라, 철로 만든 인형.",
      ],
      victory: [
        "야율검: 크윽… 이 패배는 교주께서 잊지 않으신다.",
        "야율검: 네 집의 문은 우리가 먼저 연다.\n다음엔 그 문 앞에서 보자.",
        "야율검은 향로 연기 속으로 사라졌다.",
        "설린: 천기단이 조각을 받았습니다.\n신호를 보냅니다.",
        "단 위로 가는 빛이 지붕을 뚫고 밤하늘에 한 줄을 그었다.",
        "설린: …답이 왔습니다. 북쪽.\n제 배의 나머지가 아직 응답합니다.",
        "백리호: 북쪽이라면 흑련사 본산 너머다.\n일단 진으로 돌아가 장문인께 알리자.",
      ],
    },
    report: [
      "장문 소청하: 북쪽이라면, 흑련사 본산이 길을 막고 있다.",
      "장문 소청하: 야율검은 반드시 다시 온다.\n그 전에 몸을 추슬러라.",
      "장문 소청하: 설린. 백리호.\n네 집을 부르는 그 빛을, 다음 고개에서 잇거라.",
    ],
    gold: 240,
  },
  puzzle: {
    intro: [
      "돌등 옆에 사람 키만 한 은빛 고치가 박혀 있다.\n아직 따뜻하고, 이음새 셋이 깜빡인다.",
      "설린: 제 고치입니다.\n잠금이 현지 말을 샘플링했습니다. 질문을 읽겠습니다.",
      "백리호: 고치가 말을 한다고?\n…대답은 내가 도울게. 너는 기록만 하지 마.",
    ],
    stages: [
      {
        prompt: "고치가 묻는다. 이 숲에 도는 기운의 현지 이름은?",
        options: ["독기", "전기", "내공"],
        answer: 2,
        hit: {
          lines: [
            "설린: 기록 갱신. 미확인 에너지의 현지 이름, 내공.",
            "백리호: 이제야 제대로 부르네.",
          ],
          fx: ["se:chime2"],
        },
        miss: { lines: ["이음새가 붉게 깜빡이며 꺼진다.", "백리호: 독기도 전기도 아니야. 다시."], fx: ["se:buzzer1"] },
      },
      {
        prompt: "다음 잠금. 무엇을 대 볼까?",
        options: ["검집으로 찍는다", "백리호의 내공을 빌린다", "맨손으로 문양을 누른다"],
        answer: 2,
        hit: {
          lines: [
            "손바닥 밑이 따뜻해진다.\n고치가 작은 소리로 묻는다. 「귀환 의지를 확인합니다.」",
            "설린: …확인하고 있습니다.\n돌아가고 싶습니다.",
          ],
          fx: ["se:chime2", "emote:exclamation"],
        },
        miss: { lines: ["잠금은 꿈쩍도 하지 않는다.", "고치의 글자: 살아 있는 손만 연다."] },
      },
      {
        prompt: "마지막 문양. 검, 기, 다음에 올 것은?",
        options: ["검", "심", "기"],
        answer: 1,
        hit: { lines: ["설린: 검, 기, 심.\n몸, 에너지, 마음. 순서가 맞습니다."] },
        miss: { lines: ["문양이 어긋나며 차가워진다.", "백리호: 검은 몸, 기는 기운. 남은 건 마음이야."] },
      },
    ],
    wrong: ["설린: 재계산합니다.", "백리호: 서두르지 마. 처음부터."],
    wrongFx: ["shake:1"],
    solvedFx: ["shake:3", "flash:white", "particles:sparkle"],
    reward: {
      item: {
        id: IL_SIGNAL_ITEM,
        name: "신호 조각",
        description: "설린의 고치에 남아 있던 귀환 신호의 조각.\n운무산 사원 천기단의 홈에 꼭 맞는다.",
      },
      line: "「신호 조각」을 꺼냈다.",
    },
  },
  devices: [
    {
      map: "temple", mark: "incense", name: "천기단 향로", heal: true,
      fx: ["se:chime2", "particles:sparkle"],
      lines: ["향을 집자 연기가 폐를 대신하는 자리를 데운다.\n설린: 회복률 100%. 향의 성분, 분석 보류."],
      done: ["향로는 이미 한 번 피웠다. 재만 따뜻하다."],
    },
  ],
  lock: {
    site: "temple",
    item: IL_SIGNAL_ITEM,
    locked: [
      "사원으로 드는 문설주에 별 모양 홈이 파여 있다.\n빈손으로는 꿈쩍도 하지 않는다.",
      "설린: 이 홈은 신호 조각을 기다립니다.\n고치로 돌아가야 합니다.",
    ],
    opened: [
      "신호 조각을 홈에 댄다. 딸깍.",
      "문설주가 빛을 삼키고, 사원 마당이 열린다.",
      "백리호: 들어가지. 야율검의 발자국이 먼저다.",
    ],
    fx: ["se:key", "shake:3"],
  },
  event: {
    map: "hub",
    title: "흑련사의 포고",
    beats: [
      { kind: "letterbox", show: true },
      { kind: "say", speaker: "야율검", text: "유하진의 사람들은 들으라." },
      { kind: "say", speaker: "야율검", text: "어젯밤 청죽림에 떨어진 것은 별이 아니다.\n하늘이 흘린 쇳덩이다." },
      { kind: "say", speaker: "야율검", text: "그것에 손대는 자는 흑련사의 적이다.\n조각은 우리가 거둔다." },
      { kind: "emote", target: "player", emote: "ellipsis", durationMs: 900, wait: true },
      { kind: "say", speaker: "설린", text: "분류: 추적자. 위험: 높음.\n…그런데 저는 물건이 아닙니다." },
      { kind: "say", speaker: "장문 소청하", text: "그 말은 여기서 하자.\n여관 마루, 내가 기다린다." },
    ],
  },
};
