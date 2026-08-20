/**
 * AI가 지은 100×100 마을 위에 30분 퀘스트 3단·이동·엔딩을 절차적으로 부착 후 Supabase 저장.
 */
import fs from "node:fs";
import path from "node:path";
import { charsetFrameIndex } from "../src/assets/easyrpgRtp.ts";
import { DEFAULT_ITEM_ID } from "../src/project/defaults/constants.ts";
import { ensureSwitchVariableSlots } from "../src/project/defaults/defaultProject.ts";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync.ts";
import type { Command, EventPage, GameEvent, Project } from "../src/project/types.ts";

const PROJECT_ID = "rpg-zzu-dew-30min";
const VILLAGE = "map_village_30_100x100";
const FOREST = "map_b4967d0a-7784-4f0e-8021-8b9e7a2f402f";
const MINE = "map_mine_entrance";
const SHRINE = "map_bell_shrine";
const EMPTY = "map_dew_market_100";

const PEOPLE2 = "tex_easyrpg_charset_people2";
const PEOPLE3 = "tex_easyrpg_charset_people3";
const PEOPLE1 = "tex_easyrpg_charset_people1";
const MONSTER1 = "tex_easyrpg_charset_monster1";
const OBJECT1 = "tex_easyrpg_charset_object1";

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
  return env;
}

function graphic(spriteId: string, characterIndex: number, transparent = false): EventPage["graphic"] {
  if (transparent) return { transparent: true };
  return {
    sprite: { type: "bundled", id: spriteId },
    direction: "down",
    pattern: charsetFrameIndex({ characterIndex, direction: "down", pattern: 1 }),
  };
}

function page(
  id: string,
  name: string,
  conditions: EventPage["conditions"],
  commands: Command[],
  opts: Partial<EventPage> = {}
): EventPage {
  return {
    id,
    name,
    conditions,
    graphic: opts.graphic ?? graphic(PEOPLE2, 0),
    trigger: opts.trigger ?? { kind: "action" },
    priority: opts.priority ?? "same",
    movement: opts.movement ?? { type: "fixed", speed: 3, frequency: 3 },
    overlapForbidden: true,
    commands,
  };
}

function ev(id: string, x: number, y: number, pages: EventPage[], trigger: GameEvent["trigger"] = { kind: "action" }): GameEvent {
  return { id, x, y, trigger, commands: [], pages };
}

const srcPath = "output/evidence/dew-30min-plan/project-final.json";
const project = JSON.parse(fs.readFileSync(srcPath, "utf8")) as Project;

// ── 정리: 빈 시드 맵 제거, 시작 맵 교체 ──
delete project.maps[EMPTY];
project.startMapId = VILLAGE;
project.startPos = { x: 50, y: 52 };
project.mapTree = {
  mapId: VILLAGE,
  children: Object.keys(project.maps)
    .filter((id) => id !== VILLAGE)
    .map((mapId) => ({ mapId, children: [] })),
};
project.meta = { ...project.meta, title: "이슬 장터 — 30분", author: "RPG ZZU" };
project.system = {
  ...project.system,
  titleScreen: {
    ...(project.system.titleScreen as object),
    title: "이슬 장터",
    menuLabels: { newGame: "여정을 시작", continueGame: "이어 하기", quit: "그만두기" },
  } as Project["system"]["titleScreen"],
};

ensureSwitchVariableSlots(project);
const swNames: Record<string, string> = {
  sw_0001: "Q1 약초 의뢰 수락",
  sw_0002: "Q1 약초 완료",
  sw_0003: "Q2 광산 의뢰 수락",
  sw_0004: "Q2 열쇠 획득",
  sw_0005: "Q3 종탑 의뢰 수락",
  sw_0006: "Q3 종탑 클리어",
};
for (const s of project.switches) if (swNames[s.id]) s.name = swNames[s.id]!;
const herbVar = project.variables.find((v) => v.id === "var_0001");
if (herbVar) herbVar.name = "회수한 달빛 약초";

const village = project.maps[VILLAGE]!;
const forest = project.maps[FOREST]!;
const mine = project.maps[MINE]!;
const shrine = project.maps[SHRINE]!;

// 기존 AI 문 이벤트는 유지. 퀘스트 NPC/이동/전투만 추가.
const keep = village.events.filter((e) => (e.pages?.[0]?.name ?? "").includes("집 문"));
village.events = [
  ...keep,
  ev("ev_mir_elder", 50, 48, [
    page("p1", "미르", [], [
      { kind: "text", speaker: "미르", body: "이슬 장터의 종이 약해져 새벽 안개가 걷히지 않네." },
      { kind: "text", speaker: "미르", body: "달빛 숲에서 약초 세 포기를 모아 주게. 북쪽 표지판을 보게." },
      {
        kind: "choices",
        prompt: "약초 의뢰를 받을까요?",
        options: [
          {
            text: "받는다",
            branch: [
              { kind: "setSwitch", switchId: "sw_0001", value: true },
              { kind: "setVariable", variableId: "var_0001", op: "=", value: 0 },
              { kind: "text", speaker: "미르", body: "고맙네. 숲은 마을 북쪽이야." },
            ],
          },
          { text: "나중에", branch: [{ kind: "text", speaker: "미르", body: "준비가 되면 다시 오게." }] },
        ],
        cancelBehavior: "choice2",
      },
    ], { graphic: graphic(PEOPLE2, 0) }),
    page(
      "p2",
      "미르 (진행)",
      [
        { kind: "switch", switchId: "sw_0001", value: true },
        { kind: "switch", switchId: "sw_0002", value: false },
      ],
      [{ kind: "text", speaker: "미르", body: "약초는 아직인가? 세 포기가 필요하네. 지금은 변수에 쌓이고 있어." }],
      { graphic: graphic(PEOPLE2, 0) }
    ),
    page(
      "p3",
      "미르 (Q1완료·Q2)",
      [{ kind: "variable", variableId: "var_0001", op: ">=", value: 3 }],
      [
        { kind: "text", speaker: "미르", body: "약초를 모두 모았군! 종에 바칠 수 있겠어." },
        { kind: "changeGold", op: "+=", amount: 100 },
        { kind: "changeItem", itemId: DEFAULT_ITEM_ID, op: "+=", amount: 1 },
        { kind: "setSwitch", switchId: "sw_0002", value: true },
        {
          kind: "choices",
          prompt: "폐광 열쇠 조사도 맡겠나?",
          options: [
            {
              text: "맡는다",
              branch: [
                { kind: "setSwitch", switchId: "sw_0003", value: true },
                { kind: "text", speaker: "미르", body: "서쪽 폐광에 열쇠 슬라임이 있다네." },
              ],
            },
            { text: "잠시 후", branch: [{ kind: "text", speaker: "미르", body: "쉬고 오게. 치유사 노아를 찾아보게." }] },
          ],
          cancelBehavior: "choice2",
        },
      ],
      { graphic: graphic(PEOPLE2, 0) }
    ),
    page(
      "p4",
      "미르 (Q2진행)",
      [
        { kind: "switch", switchId: "sw_0003", value: true },
        { kind: "switch", switchId: "sw_0004", value: false },
      ],
      [{ kind: "text", speaker: "미르", body: "서쪽 폐광에서 열쇠를 찾아 주게." }],
      { graphic: graphic(PEOPLE2, 0) }
    ),
    page(
      "p5",
      "미르 (Q3)",
      [{ kind: "switch", switchId: "sw_0004", value: true }],
      [
        { kind: "text", speaker: "미르", body: "열쇠로 동쪽 종탑 사당을 열 수 있네." },
        {
          kind: "choices",
          prompt: "종탑 결전을 시작할까?",
          options: [
            {
              text: "간다",
              branch: [
                { kind: "setSwitch", switchId: "sw_0005", value: true },
                { kind: "text", speaker: "미르", body: "동쪽 사당으로 가게. 조심하게." },
              ],
            },
            { text: "준비 중", branch: [{ kind: "text", speaker: "미르", body: "상점과 치유를 이용하게." }] },
          ],
          cancelBehavior: "choice2",
        },
      ],
      { graphic: graphic(PEOPLE2, 0) }
    ),
    page(
      "p6",
      "미르 (엔딩후)",
      [{ kind: "switch", switchId: "sw_0006", value: true }],
      [{ kind: "text", speaker: "미르", body: "종이 다시 울리네… 장터에 아침이 돌아왔어. 고맙네." }],
      { graphic: graphic(PEOPLE2, 0) }
    ),
  ]),
  ev("ev_noah", 47, 52, [
    page("n1", "노아", [], [
      { kind: "text", speaker: "노아", body: "다치면 언제든 오게. 장터 약초로 몸을 돌봐 줄게." },
      { kind: "recoverAll" },
      { kind: "text", speaker: "노아", body: "기운이 돌았길." },
    ], { graphic: graphic(PEOPLE2, 4) }),
  ]),
  ev("ev_merchant", 53, 52, [
    page("s1", "만물상", [], [
      { kind: "text", speaker: "만물상", body: "이슬 장터 특산품일세. 둘러보게." },
      {
        kind: "shop",
        itemIds: [DEFAULT_ITEM_ID, "item_ether", "item_antidote"],
        allowSell: true,
        quantityMode: "single",
        shopType: "normal",
        messageType: "welcome",
        branchOnTransaction: false,
        transactionBranch: [],
      },
    ], { graphic: graphic(PEOPLE3, 2) }),
  ]),
  ev("ev_kid", 55, 55, [
    page("k1", "루", [], [
      { kind: "text", speaker: "루", body: "북쪽 숲에 반짝 꽃이 세 포기 있대! 미르 장로님이 찾으셔." },
    ], { graphic: graphic(PEOPLE1, 2), movement: { type: "random", speed: 2, frequency: 3 } }),
  ]),
  ev("ev_sign", 50, 51, [
    page("sg", "표지판", [], [
      { kind: "text", body: "【이슬 장터 이정표】 북: 달빛 숲 / 서: 폐광 / 동: 종탑 사당" },
    ], { graphic: graphic(OBJECT1, 0) }),
  ]),
  // transfers
  ev("ev_to_forest", 50, 3, [
    page("tf", "달빛 숲으로", [], [{ kind: "transfer", mapId: FOREST, x: 20, y: 36, direction: "up", fade: "black" }], {
      graphic: { transparent: true },
      trigger: { kind: "playerTouch" },
      priority: "below",
    }),
  ], { kind: "playerTouch" }),
  // (6,50): 서쪽 강(물 오토타일 120, x=0..5)이 전부 통행 불가라 (4,50)은 영구 미발동이었다.
  // 최근접 통행 타일이자 ev_mine_return 예전 착지점인 (6,50)이 마을 쪽 폐광 어귀다.
  ev("ev_to_mine", 6, 50, [
    page("tm", "폐광으로", [], [{ kind: "transfer", mapId: MINE, x: 32, y: 18, direction: "left", fade: "black" }], {
      graphic: { transparent: true },
      trigger: { kind: "playerTouch" },
      priority: "below",
    }),
  ], { kind: "playerTouch" }),
  ev("ev_to_shrine", 96, 50, [
    page(
      "ts",
      "종탑으로",
      [],
      [
        {
          kind: "fork",
          condition: { kind: "switch", switchId: "sw_0004", value: true },
          then: [{ kind: "transfer", mapId: SHRINE, x: 3, y: 12, direction: "right", fade: "black" }],
          else: [{ kind: "text", body: "사당 문이 잠겨 있다. 폐광의 열쇠가 필요할 것 같다." }],
        },
      ],
      { graphic: { transparent: true }, trigger: { kind: "playerTouch" }, priority: "below" }
    ),
  ], { kind: "playerTouch" }),
];

// 숲 지형 간단 보강 + 약초/전투
if (forest.lowerTiles) {
  const w = forest.width;
  for (let y = 0; y < forest.height; y += 1) {
    for (let x = 18; x <= 22; x += 1) forest.lowerTiles[y * w + x] = 360; // path-ish
  }
}
forest.events = [
  ev("ev_forest_return", 20, 38, [
    page("fr", "마을로", [], [{ kind: "transfer", mapId: VILLAGE, x: 50, y: 5, direction: "down", fade: "black" }], {
      graphic: { transparent: true },
      trigger: { kind: "playerTouch" },
      priority: "below",
    }),
  ], { kind: "playerTouch" }),
  ...([ [10, 10], [25, 12], [15, 25] ] as const).map(([x, y], i) =>
    ev(`ev_herb_${i + 1}`, x, y, [
      page(
        `h${i}a`,
        "달빛 약초",
        [{ kind: "switch", switchId: "sw_0001", value: true }],
        [
          { kind: "text", body: "은은히 빛나는 약초를 뽑았다." },
          { kind: "setVariable", variableId: "var_0001", op: "+=", value: 1 },
          { kind: "setSelfSwitch", key: "A", value: true },
          { kind: "text", body: "달빛 약초를 손에 넣었다." },
        ],
        { graphic: graphic(OBJECT1, 3) }
      ),
      page(
        `h${i}b`,
        "빈 자리",
        [{ kind: "selfSwitch", key: "A", value: true }],
        [{ kind: "text", body: "이미 뽑은 자리이다." }],
        { graphic: { transparent: true } }
      ),
    ])
  ),
  ev("ev_forest_slime", 20, 18, [
    page(
      "fs1",
      "숲 슬라임",
      [{ kind: "switch", switchId: "sw_0001", value: true }],
      [
        { kind: "text", body: "슬라임이 덤벼든다!" },
        { kind: "battleProcessing", troopId: "troop_slime", canEscape: true, canLose: false },
      ],
      { graphic: graphic(MONSTER1, 0) }
    ),
  ]),
];

// 광산
mine.events = [
  ...(mine.events ?? []).filter((e) => (e.pages?.[0]?.commands?.[0] as { kind?: string } | undefined)?.kind === "changeGold" || e.id.includes("chest")),
  // 착지 (8,50): 입구 이벤트가 (6,50)으로 오면서 같은 칸에 내리면 즉시 재전이(transfer-retrigger)
  // 되므로 숲(3→5)·사당(96→94)과 같은 2칸 간격을 둔다. (8,50)은 길 타일(453)이다.
  ev("ev_mine_return", 34, 18, [
    page("mr", "마을로", [], [{ kind: "transfer", mapId: VILLAGE, x: 8, y: 50, direction: "right", fade: "black" }], {
      graphic: { transparent: true },
      trigger: { kind: "playerTouch" },
      priority: "below",
    }),
  ], { kind: "playerTouch" }),
  ev("ev_key_slime", 18, 18, [
    page(
      "ks1",
      "열쇠 슬라임",
      [{ kind: "switch", switchId: "sw_0003", value: true }],
      [
        { kind: "text", body: "녹슨 열쇠를 삼킨 슬라임이 나타난다!" },
        { kind: "battleProcessing", troopId: "troop_slime_pair", canEscape: true, canLose: false },
        { kind: "setSwitch", switchId: "sw_0004", value: true },
        { kind: "changeItem", itemId: DEFAULT_ITEM_ID, op: "+=", amount: 1 },
        { kind: "text", body: "녹슨 사당 열쇠를 손에 넣었다!" },
      ],
      { graphic: graphic(MONSTER1, 1) }
    ),
    page("ks2", "빈 자리", [{ kind: "switch", switchId: "sw_0004", value: true }], [
      { kind: "text", body: "슬라임은 사라졌다." },
    ], { graphic: { transparent: true } }),
  ]),
  ev("ev_mine_chest", 10, 10, [
    page("mc", "보물상자", [], [
      { kind: "text", body: "낡은 상자를 열었다." },
      { kind: "changeGold", op: "+=", amount: 50 },
    ], { graphic: graphic(OBJECT1, 1) }),
  ]),
];

// 사당 보스
shrine.events = [
  ev("ev_shrine_return", 2, 12, [
    page("sr", "마을로", [], [{ kind: "transfer", mapId: VILLAGE, x: 94, y: 50, direction: "left", fade: "black" }], {
      graphic: { transparent: true },
      trigger: { kind: "playerTouch" },
      priority: "below",
    }),
  ], { kind: "playerTouch" }),
  ev("ev_boss", 12, 10, [
    page(
      "b1",
      "종탑의 수호자",
      [
        { kind: "switch", switchId: "sw_0005", value: true },
        { kind: "switch", switchId: "sw_0006", value: false },
      ],
      [
        { kind: "text", body: "종을 지키는 수호자가 깨어난다!" },
        { kind: "battleProcessing", troopId: "troop_golem_guard", canEscape: false, canLose: false },
        { kind: "setSwitch", switchId: "sw_0006", value: true },
        { kind: "changeGold", op: "+=", amount: 200 },
        { kind: "changeItem", itemId: DEFAULT_ITEM_ID, op: "+=", amount: 2 },
        {
          kind: "ending",
          title: "이슬 장터",
          message: "종이 다시 울리고, 장터에 아침 안개 사이로 햇살이 스며들었다. — 약 30분의 여정 끝.",
        },
      ],
      { graphic: graphic(MONSTER1, 2) }
    ),
    page("b2", "잔향", [{ kind: "switch", switchId: "sw_0006", value: true }], [
      { kind: "text", body: "종소리가 멀리 메아리친다." },
    ], { graphic: { transparent: true } }),
  ]),
];

// 숲 바닥이 전부 잔디인지 보강
{
  const n = forest.width * forest.height;
  if (!forest.lowerTiles || forest.lowerTiles.length !== n) {
    forest.lowerTiles = new Array(n).fill(240);
    forest.upperTiles = new Array(n).fill(-1);
  }
}
{
  const n = mine.width * mine.height;
  if (!mine.lowerTiles || mine.lowerTiles.length !== n) {
    mine.lowerTiles = new Array(n).fill(360);
    mine.upperTiles = new Array(n).fill(-1);
  }
}
{
  const n = shrine.width * shrine.height;
  if (!shrine.lowerTiles || shrine.lowerTiles.length !== n) {
    shrine.lowerTiles = new Array(n).fill(342);
    shrine.upperTiles = new Array(n).fill(-1);
  }
}

const env = loadEnv();
const config = {
  url: env.VITE_SUPABASE_URL!.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY!,
  projectId: PROJECT_ID,
};

console.log("complete-dew-30min →", PROJECT_ID);
console.log(
  "maps",
  Object.values(project.maps).map((m) => `${m.name} ${m.width}x${m.height} e${m.events?.length ?? 0}`)
);
const saved = await saveProjectToSupabase(project, config);
console.log("saved", saved);
const verify = await loadProjectFromSupabase(config);
const vMain = verify?.maps[VILLAGE];
console.log("verify", {
  title: verify?.meta?.title,
  start: verify?.startMapId,
  main: vMain ? `${vMain.width}x${vMain.height} e${vMain.events?.length}` : null,
  mapCount: verify ? Object.keys(verify.maps).length : 0,
});

const outDir = "output/evidence/dew-30min-plan";
fs.writeFileSync(path.join(outDir, "project-complete.json"), `${JSON.stringify(project, null, 2)}\n`);
fs.writeFileSync("src/project/defaults/fixtures/dew-village-demo.json", `${JSON.stringify(project, null, 2)}\n`);
fs.writeFileSync("test/fixtures/projects/dew-village-demo.json", `${JSON.stringify(project, null, 2)}\n`);

if (!vMain || vMain.width !== 100 || (vMain.events?.length ?? 0) < 10) {
  console.error("verify failed");
  process.exit(1);
}
console.log("OK 30min content attached + saved");
