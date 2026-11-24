// 첫 게임 다양성 결정론 측정(모델 없음) — 첫 화면이 실제로 보내는 요청 10종 × 프로젝트 열쇠 100개가 어떤 분류·세계·지시문으로 가는지 센다.
// 왜(2026-11-24 qa1124-ai-gen 항목 2): «회상 형 게임» 이 열쇠와 상관없이 같은 «마을 + 길» 로 지어졌다. 고치기 전·후를 같은 요청·같은 열쇠로 재는 판이다.
//   bun scripts/qa/assistant-v2/firstGameVariety.mts <outDir>     JSON + 마크다운 표를 찍고 outDir 에 지시문 덤프·variety.json·variety.md 를 쓴다
// 열쇠·요청·프로젝트 씨앗은 고정이라 같은 코드는 같은 숫자를 낸다. 숫자는 buildV2SystemPrompt(v2)·buildPiAgentSystemPrompt(v1)·팀장 지시문이 실제로
// 조립한 글에서 읽는다(내부 함수를 따로 부르지 않는다). 변주 카드(«[이 게임의 변주]» 줄)가 없던 판에서는 그 열이 0 이다.
import fs from "node:fs";
import { createNewProjectSeed } from "../../../src/editor/genrePacks.ts";
import { createBlankProject } from "../../../src/project/defaults/blankProject.ts";
import { WELCOME_GENRE_PRESETS, buildWelcomeFreeTextPrompt, buildWelcomeGenrePresetPrompt } from "../../../src/editor/welcomeGenrePresets.ts";
import { NEW_PROJECT_CHOICES } from "../../../src/editor/newProjectChoices.ts";
import { worldForRequest, worldRequestWords } from "../../../src/ai/v2/request/world.ts";
import { buildV2SystemPrompt } from "../../../src/ai/v2/prompt/systemPrompt.ts";
import { classifyRequest } from "../../../src/ai/v2/request/intent.ts";
import { fitsAnyWorld } from "../../../src/ai/v2/request/genre.ts";
import { hasThemeWord } from "../../../src/ai/villageChipsetPool.ts";
import { buildPiAgentSystemPrompt } from "../../../src/ai/piAgent/systemPrompt.ts";
import { PI_TEAM_ROLES } from "../../../src/ai/piAgent/team.ts";

const out = process.argv[2] ?? "/tmp/first-game-variety";
fs.mkdirSync(out, { recursive: true });
const choice = (id: string) => NEW_PROJECT_CHOICES.find((c) => c.id === id)!;

type Case = { id: string; label: string; pack: string | null; intent: string; start?: string };
/** 계획 표의 열 요청(첫 화면 그대로). pack = 새 프로젝트 씨앗의 장르 팩, start = 포스터로 고른 시작 장르. */
const CASES: Case[] = [
  { id: "A", label: "회상 형 게임 만들어 줘 (자유글)", pack: null, intent: "회상 형 게임 만들어 줘" },
  { id: "B", label: "포스터 «회상 스토리»", pack: "story-cutscene", intent: "회상 스토리", start: "story-cutscene" },
  { id: "C", label: "돌아가신 할머니의 기억을 따라가는 회상 게임 + 회상 스토리", pack: "story-cutscene", intent: "돌아가신 할머니의 기억을 따라가는 회상 게임", start: "story-cutscene" },
  { id: "D", label: "폐업 직전 태엽 장난감 가게… (회상 스토리)", pack: "story-cutscene", intent: "폐업 직전 태엽 장난감 가게, 밤마다 손님이 깨어난다 (회상 스토리)", start: "story-cutscene" },
  { id: "E", label: "포스터 «모험 JRPG»", pack: "adventure-jrpg", intent: "모험 JRPG", start: "adventure-jrpg" },
  { id: "F", label: "판타지 RPG 게임 하나 만들어 줘", pack: null, intent: "판타지 RPG 게임 하나 만들어 줘" },
  { id: "G", label: "재밌는 게임 만들어 줘", pack: null, intent: "재밌는 게임 만들어 줘" },
  { id: "H", label: "추리 게임 만들어 줘", pack: null, intent: "추리 게임 만들어 줘" },
  { id: "I", label: "감동적인 이야기 게임 만들어 줘", pack: null, intent: "감동적인 이야기 게임 만들어 줘" },
  { id: "J", label: "바닷가 등대지기의 마지막 여름을 회상하는 게임 + 회상 스토리", pack: "story-cutscene", intent: "바닷가 등대지기의 마지막 여름을 회상하는 게임", start: "story-cutscene" },
];
const POSTER_IDS = CASES.filter((c) => c.start).map((c) => c.id);
/** 계획 표 밖의 장르 표본 — 데크가 장르마다 도는지 본다(표에는 안 넣는다). */
const EXTRA: Case[] = [
  { id: "K", label: "공포 게임 하나 만들어 줘", pack: null, intent: "공포 게임 하나 만들어 줘" },
  { id: "L", label: "연애 시뮬레이션 게임 만들어 줘", pack: null, intent: "연애 시뮬레이션 게임 만들어 줘" },
  { id: "M", label: "학교 괴담 모험 게임 하나 만들어 줘", pack: null, intent: "학교 괴담 모험 게임 하나 만들어 줘" },
  { id: "O", label: "카페 경영 게임 만들어 줘 (데크 없음)", pack: null, intent: "카페 경영 게임 만들어 줘" },
];
/** 사용자가 장소를 말한 표본 — «마을» 이 그대로 첫 장소로 남아야 한다. */
const NAMED_VILLAGE: Case = { id: "N", label: "마을이 나오는 회상 게임 만들어 줘 (사용자가 «마을» 을 말함)", pack: null, intent: "마을이 나오는 회상 게임 만들어 줘" };
/** 오너의 물음: 똑같은 «회상 형 게임 만들어 줘» 10번 — 열쇠 0..9. */
const OWNER_TEN = CASES[0]!;

const KEYS = 100;
/** 프로젝트 열쇠 — 실행기가 넘기는 모양(["project", 이름] 을 글로). */
const keyOf = (i: number) => JSON.stringify(["project", `qa1124-${i}`]);
const count = (text: string, re: RegExp) => (text.match(re) ?? []).length;
const MARK = "[이 게임의 변주]";

interface Card { readonly places: { readonly ko: string; readonly path: string }[]; readonly event?: string; readonly mood?: string; readonly structure?: string; readonly line: string }
/** 지시문에서 변주 카드 줄을 읽는다(없으면 undefined). 영어(v2)·한국어(v1) 둘 다. */
function parseCard(prompt: string): Card | undefined {
  const line = prompt.split("\n").find((l) => l.includes(MARK));
  if (!line) return undefined;
  const places = [...line.matchAll(/[①②③]«([^»]+)»(?:\([^)]*\))? (\S+)/gu)].map((m) => ({ ko: m[1]!, path: m[2]! }));
  const field = (names: string) => new RegExp(`(?:${names}): (.+?)\\.(?= (?:Event|Mood|Structure|사건|분위기|구조|시스템)|$)`, "u").exec(line)?.[1];
  return { places, event: field("Event|사건"), mood: field("Mood|분위기"), structure: field("Structure|구조"), line: line.slice(line.indexOf(MARK)) };
}
/** 장소 이름 → 종류(데크의 kind). 카드 글만 있으면 이름이 종류다. 데크 모듈이 없던 판(PR1)에서는 이름 그대로. */
let kindOfKo: (ko: string) => string = (ko) => ko;
try {
  const { DECKS } = await import("../../../src/ai/variation/decks.ts");
  const map = new Map<string, string>();
  for (const d of DECKS) for (const p of d.places) map.set(p.ko, p.kind);
  kindOfKo = (ko) => map.get(ko) ?? ko;
} catch { /* 변주 모듈이 없는 판 */ }

interface Prepared { readonly task: string; readonly seed: ReturnType<typeof createBlankProject> }
function prepare(c: Case): Prepared {
  const start = c.start ? { label: choice(c.start).label, tone: choice(c.start).tone } : undefined;
  return { task: buildWelcomeFreeTextPrompt(c.intent, start), seed: (c.pack ? createNewProjectSeed(c.pack as never) : createBlankProject()) as never };
}

function runCase(c: Case, dump = true) {
  const { task, seed } = prepare(c);
  const worlds = new Map<string, number>();
  const cards: (Card | undefined)[] = [];
  let sample = "";
  for (let i = 0; i < KEYS; i++) {
    const key = keyOf(i);
    const w = worldForRequest(seed, key, task);
    worlds.set(w?.id ?? "(세계 없음)", (worlds.get(w?.id ?? "(세계 없음)") ?? 0) + 1);
    const prompt = buildV2SystemPrompt(seed, seed.startMapId, task, undefined, key).join("\n");
    cards.push(parseCard(prompt));
    if (i === 0) sample = prompt;
  }
  const words = worldRequestWords(task);
  const intent = classifyRequest(task, seed);
  if (dump) fs.writeFileSync(`${out}/${c.id}-system.txt`, sample);
  const startMap = seed.maps[seed.startMapId];
  const withCard = cards.filter((x): x is Card => !!x);
  const firsts = withCard.map((x) => x.places[0]).filter((p): p is { ko: string; path: string } => !!p);
  const kindCount = new Map<string, number>();
  for (const p of firsts) kindCount.set(kindOfKo(p.ko), (kindCount.get(kindOfKo(p.ko)) ?? 0) + 1);
  const combos = new Set(withCard.filter((x) => x.places.length).map((x) => x.places.map((p) => p.ko).sort().join("|")));
  const noWorld = worlds.get("(세계 없음)") ?? 0;
  const noPlace = cards.filter((x) => !x || !x.places.length).length;
  return {
    case: `${c.id} ${c.label}`, wholeGame: intent.wholeGame, scope: intent.scope, words, fitsAnyWorld: fitsAnyWorld(words), themeWord: hasThemeWord(words),
    worlds: Object.fromEntries([...worlds].sort((a, b) => b[1] - a[1])), noWorld, cardKeys: withCard.length, placeLines: firsts.length,
    /** 세계도 없고 변주 장소도 없는 열쇠 — 모델이 «마을 + 숲길» 로 가는 열쇠. */
    noWorldNoPlace: cards.filter((x, i) => (!x || !x.places.length) && worldForRequest(seed, keyOf(i), task) === undefined).length, noPlace,
    firstKinds: kindCount.size, firstKindTop: [...kindCount].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, n]) => `${k} ${n}`), maxKindShare: firsts.length ? Math.max(...kindCount.values()) / firsts.length : 0,
    villageFirst: kindCount.get("village") ?? 0, distinctCombos: combos.size, distinctEvents: new Set(withCard.map((x) => x.event)).size, distinctMoods: new Set(withCard.map((x) => x.mood)).size,
    promptChars: sample.length, cardChars: parseCard(sample)?.line.length ?? 0,
    mentions: { village: count(sample, /\bvillage\b|마을/giu), forest: count(sample, /\bforest\b|숲/giu), road: count(sample, /\broad\b|길\b/giu), cave: count(sample, /\bcave\b|동굴/giu), interior: count(sample, /\binterior\b|실내/giu) },
    startMap: { tileset: startMap?.tilesetId, size: `${startMap?.width}x${startMap?.height}` },
  };
}

const rows = CASES.map((c) => { const row = runCase(c); console.error(`case ${c.id} done`); return row; });
const named = runCase(NAMED_VILLAGE, false);
const extra = EXTRA.map((c) => runCase(c, false));
console.error("named done");

/** 같은 요청 10번(열쇠 0..9)의 쌍별 중복률 — 두 열쇠의 값이 같은 쌍의 비율(45쌍). */
function ownerTen() {
  const { task, seed } = prepare(OWNER_TEN);
  const v2: (Card | undefined)[] = [], v1: (Card | undefined)[] = [], orch: (Card | undefined)[] = [];
  const texts: Record<"v2" | "v1" | "orchestrator", string[]> = { v2: [], v1: [], orchestrator: [] };
  const dumpDir = `${out}/recall-ten`;
  fs.mkdirSync(dumpDir, { recursive: true });
  for (let i = 0; i < 10; i++) {
    const key = keyOf(i);
    const p2 = buildV2SystemPrompt(seed, seed.startMapId, task, undefined, key).join("\n");
    const p1 = buildPiAgentSystemPrompt(seed, [seed.startMapId], true, { request: task, variation: { projectKey: key, request: task } }).join("\n");
    const po = PI_TEAM_ROLES.orchestrator.systemPrompt(seed, [seed.startMapId], task, undefined, seed.startMapId, key).join("\n");
    fs.writeFileSync(`${dumpDir}/v2-key${i}.txt`, p2); fs.writeFileSync(`${dumpDir}/v1-key${i}.txt`, p1); fs.writeFileSync(`${dumpDir}/orchestrator-key${i}.txt`, po);
    texts.v2.push(p2); texts.v1.push(p1); texts.orchestrator.push(po);
    v2.push(parseCard(p2)); v1.push(parseCard(p1)); orch.push(parseCard(po));
  }
  /** 지시문 전문이 같은 쌍의 % — 변주가 없던 판은 열쇠가 달라도 지시문이 같다. */
  const promptSame = Object.fromEntries((["v2", "v1", "orchestrator"] as const).map((k) => {
    let same = 0, pairs = 0;
    for (let a = 0; a < 10; a++) for (let b = a + 1; b < 10; b++) { pairs++; if (texts[k][a] === texts[k][b]) same++; }
    return [k, Math.round((same / pairs) * 1000) / 10];
  })) as Record<"v2" | "v1" | "orchestrator", number>;
  const rate = (cards: (Card | undefined)[], pick: (c: Card | undefined) => string) => {
    let same = 0, pairs = 0;
    for (let a = 0; a < cards.length; a++) for (let b = a + 1; b < cards.length; b++) { pairs++; if (pick(cards[a]) === pick(cards[b])) same++; }
    return Math.round((same / pairs) * 1000) / 10;
  };
  const metrics = (cards: (Card | undefined)[]) => ({
    cards: cards.filter(Boolean).length,
    firstPlaceSame: rate(cards, (c) => c?.places[0]?.ko ?? "-"), placeSetSame: rate(cards, (c) => c?.places.map((p) => p.ko).sort().join("|") ?? "-"),
    eventSame: rate(cards, (c) => c?.event ?? "-"), moodSame: rate(cards, (c) => c?.mood ?? "-"), structureSame: rate(cards, (c) => c?.structure ?? "-"),
    firstPlaces: cards.map((c) => c?.places[0]?.ko ?? "-"),
  });
  return { v2: metrics(v2), v1: metrics(v1), orchestrator: metrics(orch), promptSame: promptSame };
}
const ten = ownerTen();

/** v1 diff 0 — 몬스터 수집·장르 프리셋 첫 요청은 카드가 없어 변주 옵션을 줘도 지시문이 글자까지 같다. */
function v1Unchanged() {
  const results: Record<string, boolean | number> = {};
  const check = (name: string, pack: string | null, task: string) => {
    const seed = (pack ? createNewProjectSeed(pack as never) : createBlankProject()) as ReturnType<typeof createBlankProject>;
    let same = 0;
    for (let i = 0; i < 10; i++) {
      const a = buildPiAgentSystemPrompt(seed, [seed.startMapId], true, { request: task }).join("\n");
      const b = buildPiAgentSystemPrompt(seed, [seed.startMapId], true, { request: task, variation: { projectKey: keyOf(i), request: task } }).join("\n");
      if (a === b) same++;
    }
    results[name] = same;
  };
  check("몬스터 수집 요청 (10열쇠 중 같은 것)", "monster-collect", buildWelcomeFreeTextPrompt("몬스터를 잡아 모으는 게임 만들어 줘", { label: choice("monster-collect").label, tone: choice("monster-collect").tone }));
  check("모험 JRPG 장르 프리셋 첫 요청 (10열쇠 중 같은 것)", "adventure-jrpg", buildWelcomeGenrePresetPrompt(WELCOME_GENRE_PRESETS.find((preset) => preset.id === "adventure-jrpg")!));
  check("작은 일 «촌장 대사 바꿔 줘» (10열쇠 중 같은 것)", null, "촌장 대사를 좀 더 무뚝뚝하게 바꿔 줘");
  return results;
}
let unchanged: Record<string, boolean | number> = {};
try { unchanged = v1Unchanged(); } catch (error) { console.error("v1 diff-0 확인 실패", error); }

const result = { rows, named, extra, ownerTen: ten, v1Unchanged: unchanged };
fs.writeFileSync(`${out}/variety.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 1));
const table = [
  "| 요청 | 게임 하나로 분류 | 세계 없음 / 열쇠 100 | 세계 분포 | 변주 카드가 실린 열쇠 | 세계도 장소도 없는 열쇠 | 지시문 «마을/village» · «숲/forest» |",
  "|---|---|---|---|---|---|---|",
  ...rows.map((r) => `| ${r.case} | ${r.wholeGame ? "예" : "**아니오**"} | ${r.noWorld} | ${Object.entries(r.worlds).map(([k, v]) => `${k} ${v}`).join(" · ")} | ${r.cardKeys}/${KEYS} | ${r.noWorldNoPlace}/${KEYS} | ${r.mentions.village} · ${r.mentions.forest} |`),
  "",
  `포스터(시작 장르를 고른) 요청 wholeGame: ${rows.filter((r) => POSTER_IDS.includes(r.case.split(" ")[0]!) && r.wholeGame).length}/${POSTER_IDS.length}`,
  "",
  "### 변주 지표 (열쇠 0..99, v2 지시문의 카드 줄에서 읽음)",
  "| 요청 | 카드 열쇠 | 첫 장소 종류 수 | 한 종류 최대 몫 | «마을» 이 첫 장소 | 장소 셋 조합 수 | 사건 가짓수 | 분위기 가짓수 | 첫 장소 상위 |",
  "|---|---|---|---|---|---|---|---|---|",
  ...[...rows, named, ...extra].map((r) => `| ${r.case} | ${r.cardKeys} | ${r.firstKinds} | ${Math.round(r.maxKindShare * 100)}% | ${r.villageFirst} | ${r.distinctCombos} | ${r.distinctEvents} | ${r.distinctMoods} | ${r.firstKindTop.join(", ")} |`),
  "",
  "### «회상 형 게임 만들어 줘» 10번(열쇠 0..9)의 쌍별 중복률(45쌍, 값이 같은 쌍의 %)",
  "| 지시문 | 카드 | 지시문 전문 | 첫 장소 | 장소 셋 | 사건 | 분위기 | 구조 |",
  "|---|---|---|---|---|---|---|---|",
  ...(["v2", "v1", "orchestrator"] as const).map((k) => `| ${k} | ${ten[k].cards}/10 | ${ten.promptSame[k]}% | ${ten[k].firstPlaceSame}% | ${ten[k].placeSetSame}% | ${ten[k].eventSame}% | ${ten[k].moodSame}% | ${ten[k].structureSame}% |`),
  "",
  `첫 장소(v2, 열쇠 0..9): ${ten.v2.firstPlaces.join(" · ")}`,
  "",
  "### v1 지시문 diff 0 (변주 옵션을 줘도 글자까지 같다)",
  ...Object.entries(unchanged).map(([k, v]) => `- ${k}: ${v}/10`),
].join("\n");
fs.writeFileSync(`${out}/variety.md`, table);
console.log(table);
