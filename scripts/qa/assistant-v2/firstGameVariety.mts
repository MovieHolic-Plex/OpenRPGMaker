// 첫 게임 다양성 결정론 측정(모델 없음) — 첫 화면이 실제로 보내는 요청 10종 × 프로젝트 열쇠 100개가 어떤 분류·세계·지시문으로 가는지 센다.
// 왜(2026-11-24 qa1124-ai-gen 항목 2): «회상 형 게임» 이 열쇠와 상관없이 같은 «마을 + 길» 로 지어졌다. 고치기 전·후를 같은 요청·같은 열쇠로 재는 판이다.
//   bun scripts/qa/assistant-v2/firstGameVariety.mts <outDir>     JSON + 마크다운 표를 찍고 outDir 에 지시문 덤프(요청마다 열쇠 0번)·variety.json 을 쓴다
// 열쇠·요청·프로젝트 씨앗은 고정이라 같은 코드는 같은 숫자를 낸다. 지시문은 buildV2SystemPrompt(v2) 가 실제로 조립한 글에서 읽는다(내부 함수를 따로 부르지 않는다).
import fs from "node:fs";
import { createNewProjectSeed } from "../../../src/editor/genrePacks.ts";
import { createBlankProject } from "../../../src/project/defaults/blankProject.ts";
import { buildWelcomeFreeTextPrompt } from "../../../src/editor/welcomeGenrePresets.ts";
import { NEW_PROJECT_CHOICES } from "../../../src/editor/newProjectChoices.ts";
import { worldForRequest, worldRequestWords } from "../../../src/ai/v2/request/world.ts";
import { buildV2SystemPrompt } from "../../../src/ai/v2/prompt/systemPrompt.ts";
import { classifyRequest } from "../../../src/ai/v2/request/intent.ts";
import { fitsAnyWorld } from "../../../src/ai/v2/request/genre.ts";
import { hasThemeWord } from "../../../src/ai/villageChipsetPool.ts";

const out = process.argv[2] ?? "/tmp/first-game-variety";
fs.mkdirSync(out, { recursive: true });
const choice = (id: string) => NEW_PROJECT_CHOICES.find((c) => c.id === id)!;

/** 계획 표의 열 요청(첫 화면 그대로). pack = 새 프로젝트 씨앗의 장르 팩, start = 포스터로 고른 시작 장르. */
type Case = { id: string; label: string; pack: string | null; intent: string; start?: string };
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

const KEYS = 100;
/** 프로젝트 열쇠 — 실행기가 넘기는 모양(["project", 이름] 을 글로). */
const keyOf = (i: number) => JSON.stringify(["project", `qa1124-${i}`]);
const count = (text: string, re: RegExp) => (text.match(re) ?? []).length;
const pct = (n: number, d: number) => `${Math.round((n / d) * 100)}%`;

function runCase(c: Case) {
  const start = c.start ? { label: choice(c.start).label, tone: choice(c.start).tone } : undefined;
  const task = buildWelcomeFreeTextPrompt(c.intent, start);
  const seed = c.pack ? createNewProjectSeed(c.pack as never) : createBlankProject();
  const worlds = new Map<string, number>();
  let sample = "";
  let cards = 0;
  for (let i = 0; i < KEYS; i++) {
    const key = keyOf(i);
    const w = worldForRequest(seed, key, task);
    worlds.set(w?.id ?? "(세계 없음)", (worlds.get(w?.id ?? "(세계 없음)") ?? 0) + 1);
    const prompt = buildV2SystemPrompt(seed, seed.startMapId, task, undefined, key).join("\n");
    if (/\[이 게임의 변주\]/u.test(prompt)) cards++;
    if (i === 0) sample = prompt;
  }
  const words = worldRequestWords(task);
  const intent = classifyRequest(task, seed);
  fs.writeFileSync(`${out}/${c.id}-system.txt`, sample);
  const startMap = seed.maps[seed.startMapId];
  return {
    case: `${c.id} ${c.label}`, wholeGame: intent.wholeGame, scope: intent.scope, words, fitsAnyWorld: fitsAnyWorld(words), themeWord: hasThemeWord(words),
    worlds: Object.fromEntries([...worlds].sort((a, b) => b[1] - a[1])), noWorld: worlds.get("(세계 없음)") ?? 0, cardKeys: cards,
    promptChars: sample.length,
    mentions: { village: count(sample, /\bvillage\b|마을/giu), forest: count(sample, /\bforest\b|숲/giu), road: count(sample, /\broad\b|길\b/giu), cave: count(sample, /\bcave\b|동굴/giu), interior: count(sample, /\binterior\b|실내/giu) },
    startMap: { tileset: startMap?.tilesetId, size: `${startMap?.width}x${startMap?.height}` },
  };
}

const rows = CASES.map((c) => { const row = runCase(c); console.error(`case ${c.id} done`); return row; });
fs.writeFileSync(`${out}/variety.json`, JSON.stringify(rows, null, 2));
console.log(JSON.stringify(rows, null, 1));
const table = [
  "| 요청 | 게임 하나로 분류 | 세계 없음 / 열쇠 100 | 세계 분포 | 변주 카드가 실린 열쇠 | 지시문 «마을/village» · «숲/forest» |",
  "|---|---|---|---|---|---|",
  ...rows.map((r) => `| ${r.case} | ${r.wholeGame ? "예" : "**아니오**"} | ${r.noWorld} | ${Object.entries(r.worlds).map(([k, v]) => `${k} ${v}`).join(" · ")} | ${r.cardKeys}/${KEYS} (${pct(r.cardKeys, KEYS)}) | ${r.mentions.village} · ${r.mentions.forest} |`),
  "",
  `포스터(시작 장르를 고른) 요청 wholeGame: ${rows.filter((r) => POSTER_IDS.includes(r.case.split(" ")[0]!) && r.wholeGame).length}/${POSTER_IDS.length}`,
].join("\n");
fs.writeFileSync(`${out}/variety.md`, table);
console.log(table);
