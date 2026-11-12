// 명세 은행 — 재생(모델 없음): 명세 파일 하나를 빈 프로젝트에서 실제 조수 v2 실행기(runPiAgent + v2 갈고리)로 다시 돌린다.
//   bun scripts/qa/assistant-v2/specBank/replayGame.mts <명세.json> <결과 폴더> [--no-render]
// 모델 자리에는 대본이 앉는다(RunPiAgentOptions.streamFn) — 호출마다 명세의 다음 도구 호출을 내고, 그때 모델이 멈춘 자리에서 멈춘다.
// 그래서 도구 감싸개·할 일 고리·끝맺음 자동 짓기·끝맺음 관문·완료 판정이 제품 그대로 돈다. 모델이 있어야 하는 것(독립 검토자·화면 검수·비평가·그림 생성)은 돌지 않는다.
// 이 파일은 옛 커밋의 작업 폴더에서도 돌아야 한다 — 제품 코드는 실행기 입구 둘과 빈 프로젝트·맵 그림만 끌어오고, 새 구조(turn/turn.ts)는 있으면 쓴다.
// 결과: <결과 폴더>/project.json · replay.json(호출별 그때/지금, 턴별 판정, 신뢰 수치) · maps/*.png. 문서: openwiki/assistant-v2.md 「명세 은행」.
import fs from "node:fs";
import path from "node:path";
import { createAssistantMessageEventStream } from "@oh-my-pi/pi-ai";
import { PNG } from "pngjs";
import { compareReference, eventClass, eventIdsIn, eventTokens, itemKey, mapIdsIn, nameKey, NEEDS_OUTSIDE, realModelSign, referenceOf, replayEngine, sha, type Spec, type Trust } from "./spec.mts";

const ROOT = path.resolve(import.meta.dir, "../../../..");
const [specFile, outDir] = process.argv.slice(2);
if (!specFile || !outDir) { console.error("replayGame <명세.json> <결과 폴더> [--no-render]"); process.exit(2); }
const render = !process.argv.includes("--no-render");
// 살펴볼 때만: --keep-turns 턴마다 프로젝트를 남긴다 · --turns N 앞의 N턴만 돈다.
const keepTurns = process.argv.includes("--keep-turns");
const turnLimit = process.argv.includes("--turns") ? Number(process.argv[process.argv.indexOf("--turns") + 1]) : Infinity;
const spec = JSON.parse(fs.readFileSync(specFile, "utf8")) as Spec;
fs.mkdirSync(outDir, { recursive: true });

// 모델이 있어야 도는 판정자는 끈다(제품 스위치). 재생은 결정적 길만 잰다.
process.env.OPRN_V2_ADVISOR = "0";
process.env.OPRN_V2_VQA = "0";

// ── 같은 명세는 같은 결과가 나오게: 난수·uuid 를 고정하고, 네트워크는 막는다 ─────────────────────────────────
type AnyProject = { meta: { title?: string }; startMapId: string; maps: Record<string, { id: string; name?: string; events?: { id: string; name?: string; x: number; y: number }[] }>; assistantTodo?: { memory?: { places?: { places?: { spec?: { name?: string; salt?: number } }[] } } } };
let seed = 1;
const rng = (): number => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const reseed = (key: string): void => { seed = parseInt(sha(`${spec.id}|${key}`, 8), 16) | 0; };
const counters = { random: 0, saltDraws: 0, blockedFetch: 0, fetchUrls: new Set<string>() };

// 장소 소금: 빌더는 장소마다 `salt: Math.floor(Math.random() * 1_000_000)` 로 뽑는다. 그 줄에서 온 난수에는 그때의 소금을 돌려준다 —
// 이름은 지금 호출의 인자(make_place)나 방금 견준 장소 이름(빌더가 이름을 normalize 로 견준 직후에 뽑는다)에서 안다. 모르면 기록 차례의 다음 이름.
const saltLine = new Map<string, boolean>();
const sourceLines = new Map<string, string[]>();
const saltsLeft = Object.keys(spec.salts);
const saltLog: { name: string; salt: number; how: string }[] = [];
let callPlaceName: string | undefined;
const recentNames: string[] = [];
const realNormalize = String.prototype.normalize;
String.prototype.normalize = function patched(this: string, form?: string) { const s = realNormalize.call(this, form as never); if (s.length <= 80) { recentNames.push(s.replace(/\s+/gu, "")); if (recentNames.length > 24) recentNames.shift(); } return s; };
function isSaltSite(): boolean {
  const stack = String(new Error().stack ?? "").split("\n");
  for (const frame of stack) {
    const m = /\(?((?:\/|file:)[^():]+\.[cm]?tsx?):(\d+):(\d+)\)?/u.exec(frame);
    if (!m || m[1]!.includes("/specBank/")) continue;
    const key = `${m[1]}:${m[2]}:${m[3]}`;
    const known = saltLine.get(key);
    if (known !== undefined) return known;
    const file = m[1]!.replace(/^file:\/\//u, "");
    let lines = sourceLines.get(file);
    if (!lines) { try { lines = fs.readFileSync(file, "utf8").split("\n"); } catch { lines = []; } sourceLines.set(file, lines); }
    const line = lines[Number(m[2]) - 1] ?? "";
    // 그 줄에 소금 뽑기가 있고, 이 호출이 그 줄의 Math.random 가운데 소금 쪽(칸 번호가 가장 가까운 것)인가.
    const col = Number(m[3]) - 1;
    const sites = [...line.matchAll(/Math\.random\(\)/gu)].map((x) => x.index!);
    const saltAt = line.search(/salt:\s*Math\.floor\(Math\.random\(\)/u);
    let hit = false;
    if (saltAt >= 0 && sites.length) {
      const saltSite = sites.find((s) => s > saltAt)!;
      const nearest = sites.reduce((a, b) => (Math.abs(b - col) < Math.abs(a - col) ? b : a));
      hit = nearest === saltSite;
    }
    saltLine.set(key, hit);
    return hit;
  }
  return false;
}
const nameSalt = (name: string): number => parseInt(sha(`${spec.id}|salt|${nameKey(name)}`, 8), 16) % 1_000_000;
function drawSalt(): number {
  counters.saltDraws += 1;
  const pick = (name: string, how: string): number => {
    const at = saltsLeft.indexOf(name); if (at >= 0) saltsLeft.splice(at, 1);
    const salt = spec.salts[name] ?? nameSalt(name);
    saltLog.push({ name, salt, how: spec.salts[name] === undefined ? `${how}·이름에서 정함` : how });
    return (salt + 0.5) / 1_000_000;
  };
  if (callPlaceName) return pick(callPlaceName, "호출 인자");
  // 빌더는 소금을 뽑기 직전에 그 장소 이름을 맵 이름들과 견준다(normalize) — 가장 최근에 견준 장소 이름이 지금 짓는 장소다. 한 번 쓴 흔적은 지운다.
  const names = [...new Set([...Object.keys(spec.salts), ...blueprintPlaceNames()])];
  for (let i = recentNames.length - 1; i >= 0; i -= 1) {
    const name = names.find((n) => nameKey(n) === recentNames[i]);
    if (!name) continue;
    recentNames.length = 0;
    return pick(name, "방금 견준 이름");
  }
  if (saltsLeft.length) return pick(saltsLeft[0]!, "기록 차례");
  const value = Math.floor(rng() * 1_000_000);
  saltLog.push({ name: "?", salt: value, how: "이름 모름" });
  return (value + 0.5) / 1_000_000;
}
Math.random = () => { counters.random += 1; return isSaltSite() ? drawSalt() : rng(); };
globalThis.crypto.randomUUID = (() => {
  const hex = Array.from({ length: 32 }, () => Math.floor(rng() * 16).toString(16)).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
}) as typeof crypto.randomUUID;
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: unknown, init?: unknown) => {
  const url = String((input as { url?: string })?.url ?? input);
  if (/^(file:|data:)/u.test(url)) return realFetch(input as never, init as never);
  counters.blockedFetch += 1; counters.fetchUrls.add(url.replace(/\?.*$/u, "").slice(0, 80));
  throw new Error("명세 은행 재생: 모델·네트워크 없음");
}) as typeof fetch;

// ── 진짜 모델을 부르지 않는다: 대본을 받는 제공자로만 넘기고(spec.mts replayEngine), 그래도 진짜 사용량이 보이면 바로 멈춘다 ─────────────
const engine = replayEngine(spec.source);
if (engine.swapped) console.error(`[${spec.id}] 제공자 ${spec.source.provider} 는 대본을 받지 않는다 — ${engine.provider} 로 재생한다(모델 없음)`);
const stopReplay = new AbortController();
let realModel: string | undefined;
/** 진짜 모델의 흔적 — 실행을 끊고(CLI 자식까지) 끝에서 exit 3. 끊기지 않으면 10초 뒤 그냥 나간다. */
const tripRealModel = (why: string): void => {
  if (realModel) return;
  realModel = why;
  stopReplay.abort();
  setTimeout(() => { shout(); process.exit(3); }, 10_000).unref();
};
const shout = (): void => {
  const bar = "✗".repeat(60);
  process.stderr.write(`\n${bar}\n[spec-bank] 재생이 진짜 모델을 불렀다 — 멈춘다. ${spec.id}: ${realModel}\n  기록된 제공자 ${spec.source.provider || "(없음)"} → 넘긴 제공자 ${engine.provider}. 재생의 첫 [pi-usage] 줄은 input=0 cacheRead=0 이어야 한다.\n${bar}\n`);
  console.log(`${spec.id}: 재생 중단 — 진짜 모델 호출(${realModel})`);
};
const plainError = console.error.bind(console);
console.error = (...args: unknown[]): void => {
  plainError(...args);
  const why = typeof args[0] === "string" ? realModelSign({ usageLine: args[0] }) : undefined;
  if (why) tripRealModel(why);
};

// ── 제품 입구 — 옛 커밋에서도 있는 것만 고정으로, 새 구조는 있으면 ─────────────────────────────────────────────
const { runPiAgent } = await import(path.join(ROOT, "scripts/lib/piAgentRuntime.ts")) as { runPiAgent: (request: unknown, options: unknown) => Promise<{ project: AnyProject }> };
const { runAssistantV2 } = await import(path.join(ROOT, "scripts/lib/assistantV2Runtime.ts")) as { runAssistantV2: (request: unknown, options: unknown) => Promise<{ project: AnyProject }> };
const { createBlankProject } = await import(path.join(ROOT, "src/project/defaults/blankProject.ts")).catch(() => import(path.join(ROOT, "src/project/defaults.ts"))) as { createBlankProject: () => AnyProject };
type TurnHooks = { tools: (env: LiveEnv) => unknown[]; afterMain?: (env: LiveEnv, round: number) => Promise<string | undefined> | string | undefined } & Record<string, unknown>;
type LiveEnv = { ctx: { project: AnyProject } };
const turnModule = await import(path.join(ROOT, "src/ai/v2/turn/turn.ts")).catch(() => undefined) as { createV2Turn?: (request: unknown, options: unknown, io: unknown) => { store: unknown; onEvent: (e: unknown) => void; hooks: TurnHooks; finishTurn: (done: unknown) => void } } | undefined;
const promptModule = turnModule ? await import(path.join(ROOT, "src/ai/v2/prompt/systemPrompt.ts")).catch(() => undefined) as { buildV2SystemPrompt?: (...args: unknown[]) => unknown } | undefined : undefined;
const renderModule = render ? await import(path.join(ROOT, "scripts/qa-game/render.mts")).catch(() => undefined) as { renderMapPng?: (project: unknown, map: unknown) => { png: Buffer } } | undefined : undefined;

// 그림 생성(generate_art)은 이미지 모델이 있어야 한다 — 재생은 작은 자리표시 그림을 돌려준다. 그림은 재지 않고, 그 그림을 가리키는 뒤 호출(엔딩 배경)이 그때처럼 이어지게만 한다.
const stubPicture = (): string => {
  const png = new PNG({ width: 64, height: 36 });
  for (let i = 0; i < png.data.length; i += 4) { png.data[i] = 40; png.data[i + 1] = 44; png.data[i + 2] = 60; png.data[i + 3] = 255; }
  return `data:image/png;base64,${PNG.sync.write(png).toString("base64")}`;
};
const GEN_ID = /gen-(?:title|ending)-[a-z0-9]+/gu;
/** 그때 만든 그림 id → 재생이 만든 그림 id(generate_art 결과 글에서 짝짓는다). */
const genIds = new Map<string, string>();

// ── 옛 명세를 지금 빌더로: 이름이 바뀐 도구 · 지금 규칙이 돌려보내는 청사진 ──────────────────────────────────────
// 도구 이름이 바뀐 것(인자는 같다)은 이 작업 폴더에 있는 쪽 이름으로 부른다. 어느 쪽이 있는지는 v2 도구 소스에서 읽는다.
const RENAMES: readonly [string, string][] = [["build_world", "build_places"]];
const v2Source = ((): string => {
  const dir = path.join(ROOT, "src/ai/v2");
  const files = fs.existsSync(dir) ? (fs.readdirSync(dir, { recursive: true }) as string[]).filter((f) => f.endsWith(".ts")) : [];
  return files.map((f) => { const text = fs.readFileSync(path.join(dir, f), "utf8"); return RENAMES.flat().some((n) => text.includes(`"${n}"`)) ? text : ""; }).join("\n");
})();
const hasTool = (name: string): boolean => new RegExp(`name:\\s*"${name}"`, "u").test(v2Source);
const renameTo = new Map<string, string>();
for (const [a, b] of RENAMES) { if (!hasTool(a) && hasTool(b)) renameTo.set(a, b); else if (!hasTool(b) && hasTool(a)) renameTo.set(b, a); }
/** 그때는 받았는데 지금 규칙이 «아직 저장 안 함»으로 돌려보내는 청사진은 같은 것을 다시 보낸다 — 제품이 두 번 돌려보낸 뒤에는 함수가 메워서 건다(blueprint.ts WORLD_BOUNCES). */
const BOUNCED = /not saved yet/iu;
const MAX_RESENDS = 3;

// ── 재생 ─────────────────────────────────────────────────────────────────────────────────────────────────────
interface CallLog { turn: number; i: number; n: string; was: boolean; now?: boolean; s?: string; note?: string; as?: string; resent?: number }
const log: CallLog[] = [];
const turnsOut: { input: string; calls: number; played: number; forced: number; gateItems: string[]; verdictWas?: { complete: boolean; summary: string }; verdictNow?: { complete: boolean; summary: string }; statuses: Record<string, number>; missingArt?: string[]; notes: string[]; trust?: Trust; ms: number; error?: string }[] = [];
let live: LiveEnv | undefined;
let checkpointMaps: AnyProject["maps"] | undefined;
const liveProject = (fallback: AnyProject): AnyProject => live?.ctx.project ?? (checkpointMaps ? { ...fallback, maps: checkpointMaps } : fallback);
function blueprintPlaceNames(): string[] {
  const bp = (live?.ctx.project as { gameBlueprint?: { places?: { name: string }[]; steps?: { place: string }[] } } | undefined)?.gameBlueprint;
  return bp ? [...(bp.places ?? []).map((p) => p.name), ...(bp.steps ?? []).map((s) => s.place)] : [];
}

/** 재생한 호출이 모델에게 돌려준 글("턴-호출" → 글) — 도중에 생겼다 지워진 이벤트 id 를 같은 차례로 찾는다. */
const resultTexts = new Map<string, string>();

/** 그때의 id 를 지금 재생본의 id 로 바꾼다 — 맵은 이름으로, 이벤트는 같은 맵의 갈래+이름(같은 칸 먼저)으로. 못 찾은 id 는 그대로 두고 적는다. */
function translate(args: unknown, project: AnyProject): { args: unknown; unresolved: string[] } {
  let text = JSON.stringify(args ?? {});
  const unresolved: string[] = [];
  const mapOf = (old: string): string | undefined => {
    if (project.maps[old]) return old;
    const names = (spec.maps[old] ?? []).map(nameKey);
    for (const name of [...names].reverse()) { const hit = Object.values(project.maps).find((m) => nameKey(m.name) === name); if (hit) return hit.id; }
    return undefined;
  };
  for (const old of mapIdsIn(text)) { const now = mapOf(old); if (!now) unresolved.push(old); else if (now !== old) text = text.split(old).join(now); }
  for (const old of eventIdsIn(JSON.stringify(args ?? {}))) {
    const ref = spec.events[old];
    if (!ref) continue;
    if ("at" in ref) {
      const now = eventTokens(resultTexts.get(`${ref.at[0]}-${ref.at[1]}`) ?? "")[ref.at[2]];
      if (now) text = text.split(old).join(now); else unresolved.push(old);
      continue;
    }
    const mapId = mapOf(ref.map);
    const map = mapId ? project.maps[mapId] : undefined;
    const moved = mapId && mapId !== ref.map ? old.split(ref.map).join(mapId) : old;
    if (!map) { unresolved.push(old); continue; }
    if ((map.events ?? []).some((e) => e.id === moved)) continue;
    const cls = eventClass(old, ref.map);
    const pool = (map.events ?? []).filter((e) => eventClass(e.id, map.id) === cls && (e.name ?? "") === ref.name);
    const near = (list: typeof pool) => list.sort((a, b) => Math.abs(a.x - ref.x) + Math.abs(a.y - ref.y) - Math.abs(b.x - ref.x) - Math.abs(b.y - ref.y))[0];
    // 갈래가 달라도(단계 번호가 밀린 ev_chain_…_N) 그 맵에 같은 이름의 이벤트가 하나면 그것이다.
    const sameName = ref.name ? (map.events ?? []).filter((e) => (e.name ?? "") === ref.name) : [];
    const hit = near(pool) ?? (sameName.length === 1 ? sameName[0] : undefined);
    if (hit) text = text.split(moved).join(hit.id); else unresolved.push(old);
  }
  for (const [old, now] of genIds) text = text.split(old).join(now);
  let out = JSON.parse(text) as unknown;
  // 재생이 만들지 못한 생성 그림 id 는 그 칸을 뺀다(그림 없이 같은 것을 짓는다).
  const made = new Set(genIds.values());
  const lost = [...new Set(text.match(GEN_ID) ?? [])].filter((id) => !made.has(id));
  if (lost.length) {
    const strip = (node: unknown): unknown => Array.isArray(node) ? node.filter((v) => !lost.includes(v as string)).map(strip)
      : node && typeof node === "object" ? Object.fromEntries(Object.entries(node as Record<string, unknown>).filter(([, v]) => !lost.includes(v as string)).map(([k, v]) => [k, strip(v)])) : node;
    out = strip(out);
    unresolved.push(...lost.map((id) => `${id}(그림 칸을 뺌)`));
  }
  return { args: out, unresolved };
}

// 편집기는 공용 자료(공용 캐릭터 칩·타일셋 — 이 기계의 shared-content.sqlite)를 올린 뒤에 빈 프로젝트를 만든다. 같은 차례로 한다 —
// 빠지면 빌더가 고른 공용 캐릭터 칩이 프로젝트에 없어 그 이벤트의 저장이 거절된다(jrpg-x1: 경로 짓기가 첫 이벤트에서 멈췄다).
const sharedNote = { installed: false, assets: 0 };
try {
  const worker = await import(path.join(ROOT, "scripts/lib/piWorkerSharedContent.ts")) as { preparePiWorkerSharedContent?: () => Promise<void> };
  if (worker.preparePiWorkerSharedContent) { await worker.preparePiWorkerSharedContent(); sharedNote.installed = true; }
} catch (e) { console.error(`[${spec.id}] 공용 자료를 못 올림: ${(e as Error).message.slice(0, 160)}`); }
let project = createBlankProject();
try {
  const shared = await import(path.join(ROOT, "src/project/sharedContent.ts")) as { ensureSharedContent?: (project: unknown) => boolean };
  shared.ensureSharedContent?.(project);
} catch { /* 옛 커밋에 없으면 그대로 */ }
sharedNote.assets = Object.keys((project as unknown as { assets?: { uploaded?: Record<string, unknown> } }).assets?.uploaded ?? {}).filter((id) => id.startsWith("shared_")).length;
project.meta.title = spec.title;
const started = Date.now();
for (const [t, turn] of spec.turns.entries()) {
  if (t >= turnLimit) break;
  const t0 = Date.now();
  const calls = turn.calls;
  const mainEnd = turn.polishFrom ?? calls.length;
  let cursor = 0, forced = 0, modelCalls = 0, sends = 0;
  const stopsTaken = new Set<number>();
  const statuses: Record<string, number> = {};
  const notes: string[] = [];
  /** 끝맺음 관문이 이 턴에 할 일로 덧붙인 문제(함수 검사가 짚은 것). */
  const gateItems: string[] = [];
  let verdictNow: { complete: boolean; summary: string } | undefined;
  let missingArt: string[] | undefined;
  const base = project;
  live = undefined; checkpointMaps = undefined;
  let todoItems: (() => { id: string; content: string }[]) | undefined;
  const message = (content: unknown[], stopReason: string) => ({ role: "assistant", api: "openai-completions", provider: "spec-bank", model: "scripted", usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0 }, timestamp: Date.now(), stopReason, content });
  const streamFn = (_model: unknown, context: { messages?: { role?: string; toolCallId?: string; content?: unknown }[] }) => {
    modelCalls += 1;
    // 방금 끝난 호출들이 모델에게 돌려준 글을 적어 둔다.
    const messages = context?.messages ?? [];
    for (let at = messages.length - 1; at >= 0; at -= 1) {
      const m = messages[at]!;
      const id = /^sb-(\d+)-(\d+)(?:-|$)/u.exec(String(m.toolCallId ?? ""));
      if (m.role !== "toolResult" || !id) continue;
      const key = `${id[1]}-${id[2]}`;
      if (resultTexts.has(key)) break;
      resultTexts.set(key, Array.isArray(m.content) ? m.content.map((part) => String((part as { text?: string }).text ?? "")).join("\n") : String(m.content ?? ""));
    }
    const stream = createAssistantMessageEventStream();
    // 방금 보낸 청사진을 지금 규칙이 돌려보냈으면(그때는 받았다) 같은 것을 다시 보낸다.
    const last = cursor > 0 ? log.find((l) => l.turn === t + 1 && l.i === cursor - 1) : undefined;
    if (last && last.n === "write_blueprint" && last.was && last.now === false && BOUNCED.test(last.s ?? "") && (last.resent ?? 0) < MAX_RESENDS) { last.resent = (last.resent ?? 0) + 1; last.now = undefined; cursor -= 1; }
    // 멈출 자리: 대본이 끝났거나, 그때 모델이 멈춘 자리(한 번만), 또는 윤문 차례 앞.
    const stopHere = cursor >= calls.length || ((calls[cursor - 1]?.stop === 1 || cursor === turn.polishFrom) && cursor > 0 && !stopsTaken.has(cursor));
    let msg;
    if (stopHere) { stopsTaken.add(cursor); callPlaceName = undefined; reseed(`t${t}|stop${cursor}`); msg = message([{ type: "text", text: "(명세 은행 재생 — 그때 모델이 멈춘 자리)" }], "stop"); }
    else {
      const call = calls[cursor]!;
      const translated = translate(call.a, liveProject(base));
      // 함수·판정자가 덧붙인 할 일 항목은 번호가 판마다 밀린다 — 그때 그 번호의 글과 같은 지금 항목의 번호로 부른다.
      const wasItem = call.n === "todo" ? turn.items?.[String((translated.args as { task?: string }).task ?? "")] : undefined;
      if (wasItem && todoItems) {
        const same = todoItems().find((item) => itemKey(item.content) === wasItem);
        if (same) (translated.args as { task?: string }).task = same.id; else translated.unresolved.push(`${(translated.args as { task?: string }).task}(지금 목록에 없는 항목)`);
      }
      // 이름이 바뀐 도구는 지금 이름으로(인자 속 이름 — load_tools 의 names — 도 같이).
      const name = renameTo.get(call.n) ?? call.n;
      if (renameTo.size) { let text = JSON.stringify(translated.args); for (const [from, to] of renameTo) text = text.split(`"${from}"`).join(`"${to}"`); translated.args = JSON.parse(text) as unknown; }
      const prior = log.find((l) => l.turn === t + 1 && l.i === cursor);
      const entry: CallLog = prior ?? { turn: t + 1, i: cursor, n: call.n, was: call.ok, ...(name !== call.n ? { as: name } : {}) };
      if (translated.unresolved.length) entry.note = `못 찾은 id ${translated.unresolved.join(",").slice(0, 160)}`;
      if (!prior) log.push(entry);
      const a = translated.args as { spec?: { name?: string }; name?: string };
      // 장소 하나를 짓거나 다시 짓는 호출은 그 장소 이름을 안다(소금 뽑기가 이 이름의 기록을 쓴다).
      const targetMap = (a as { patch?: { mapId?: string }; mapId?: string }).patch?.mapId ?? (a as { mapId?: string }).mapId;
      callPlaceName = call.n === "make_place" ? (a.spec?.name ?? a.name) : /^(edit_place|review_layout|dress_room)$/u.test(call.n) && targetMap ? liveProject(base).maps[targetMap]?.name : undefined;
      reseed(`t${t}|c${cursor}`);
      sends += 1;
      msg = message([{ type: "toolCall", id: `sb-${t}-${cursor}-${sends}`, name, arguments: translated.args }], "toolUse");
      cursor += 1;
    }
    queueMicrotask(() => { stream.push({ type: "start", partial: msg } as never); stream.push({ type: "done", reason: msg.stopReason, message: msg } as never); });
    return stream;
  };
  const onEvent = (event: { type: string; id?: string; name?: string; ok?: boolean; summary?: string; data?: unknown; message?: string }) => {
    if (event.type === "tool_end") {
      const m = /^sb-(\d+)-(\d+)(?:-|$)/u.exec(String(event.id ?? ""));
      const entry = m ? log.find((l) => l.turn === Number(m[1]) + 1 && l.i === Number(m[2])) : undefined;
      if (entry) {
        entry.now = event.ok !== false; entry.s = String(event.summary ?? "").replace(/\s+/gu, " ").slice(0, 200);
        if (entry.n === "generate_art" && entry.now) { const was = (calls[entry.i]!.s ?? "").match(GEN_ID)?.at(-1), now = String(event.summary ?? "").match(GEN_ID)?.at(-1); if (was && now) genIds.set(was, now); }
      }
    } else if (event.type === "execution_status") {
      const name = String(event.name ?? "");
      statuses[name] = (statuses[name] ?? 0) + 1;
      if (name === "v2.todo.final") { verdictNow = { complete: event.ok === true, summary: String(event.summary ?? "").slice(0, 200) }; }
      if (name === "v2.summary") missingArt = ((event.data as { missingArt?: string[] } | undefined)?.missingArt ?? []).map((s) => s.slice(0, 200));
      if (/^v2\.(loop\.stop|gate\.items|blueprint\.late|no_todo)$/u.test(name)) notes.push(`${name}: ${String(event.summary ?? "").slice(0, 220)}`);
      if (name === "v2.gate.items") for (const item of (event.data as { items?: { content?: string }[] } | undefined)?.items ?? []) gateItems.push(String(item.content ?? "").replace(/\s+/gu, " ").slice(0, 200));
    } else if (event.type === "error") notes.push(`error: ${String(event.message ?? "").slice(0, 200)}`);
  };
  const request = {
    provider: engine.provider, model: engine.model, mode: "single", task: turn.task,
    mapIds: [project.startMapId], scopeStrict: false, currentMapId: project.startMapId, project, ...(spec.projectKey ? { projectKey: spec.projectKey } : {}),
    assistantVersion: "v2", applyMode: "auto", maxTurns: calls.length + 400,
  };
  const options = {
    streamFn, model: { id: request.model, name: request.model, api: "openai-completions", provider: "spec-bank", input: ["text", "image"], reasoning: false, contextWindow: 400_000, maxTokens: 32_000, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } },
    onCheckpoint: async (checkpoint: { project: AnyProject }) => { if (checkpoint.project.maps) checkpointMaps = checkpoint.project.maps; },
    timeoutMs: 45 * 60_000,
    signal: stopReplay.signal,
  };
  let done: { project: AnyProject } | undefined;
  let error: string | undefined;
  try {
    if (turnModule?.createV2Turn) {
      // 새 구조: runAssistantV2 와 같은 조립이되, 그때 모델 쪽 판정자(검토자·화면 검수)가 다시 연 자리에서는 남은 대본을 잇게 한다.
      const v2turn = turnModule.createV2Turn(request, { onEvent }, { captureVqaShots: async () => ({ shots: [], failed: [] }) });
      todoItems = () => (v2turn.store as { items: { id: string; content: string }[] }).items;
      const hooks: TurnHooks = {
        ...v2turn.hooks,
        tools: (env) => { live = env; return v2turn.hooks.tools({ ...env, generateImage: async () => ({ dataUrl: stubPicture(), mimeType: "image/png", model: "spec-bank-stub", provider: "spec-bank" }) } as LiveEnv); },
        afterMain: async (env, round) => {
          const next = await v2turn.hooks.afterMain!(env, round);
          if (next !== undefined || cursor >= mainEnd) return next;
          forced += 1;
          return "[spec bank replay] The recorded turn went on here (a model-side judge reopened it). Continue with the recorded calls.";
        },
      };
      const systemPrompt = promptModule?.buildV2SystemPrompt ? promptModule.buildV2SystemPrompt(request.project, request.currentMapId, request.task, v2turn.store, request.projectKey) : ["spec bank replay"];
      done = await runPiAgent({ ...request, systemPrompt, initialToolNames: [], openingProduction: false }, { ...options, onEvent: v2turn.onEvent, toolNames: ["__assistant_v2__"], v2: hooks });
      v2turn.finishTurn(done);
    } else {
      done = await runAssistantV2(request, { ...options, onEvent });
    }
  } catch (e) { error = (e as Error).stack?.slice(0, 600) ?? String(e); }
  if (done) project = JSON.parse(JSON.stringify(done.project)) as AnyProject;
  if (keepTurns && done) fs.writeFileSync(path.join(outDir, `project-turn${t + 1}.json`), JSON.stringify(project));
  for (const entry of log.filter((l) => l.turn === t + 1 && l.now === undefined)) entry.note = `${entry.note ? `${entry.note} · ` : ""}끝 기록 없음`;
  const reference = spec.reference.afterTurn[String(t + 1)] ?? (t === spec.turns.length - 1 ? spec.reference.final : undefined);
  turnsOut.push({ input: turn.input.slice(0, 80), calls: calls.length, played: cursor, forced, ...(turn.verdict ? { verdictWas: turn.verdict } : {}), ...(verdictNow ? { verdictNow } : {}), statuses, ...(missingArt ? { missingArt } : {}), notes, gateItems, ...(reference && done ? { trust: compareReference(reference, referenceOf(project)) } : {}), ms: Date.now() - t0, ...(error ? { error } : {}) });
  console.error(`[${spec.id}] 턴 ${t + 1}/${spec.turns.length}: 호출 ${cursor}/${calls.length} · 모델 자리 ${modelCalls} · 이어 붙임 ${forced} · ${Math.round((Date.now() - t0) / 1000)}초${error ? ` · 예외 ${error.split("\n")[0]}` : ""}`);
  // 예외로 끝난 턴은 아래에서 «예외»로 적는다 — 사용량 줄이 찍혔으면 realModel 이 이미 서 있다.
  const sign = realModel ?? (error ? undefined : realModelSign({ turn: { calls: calls.length, played: cursor, scripted: modelCalls } }));
  if (sign) { realModel = sign; shout(); process.exit(3); }
  if (error) break;
}

// ── 결과 ─────────────────────────────────────────────────────────────────────────────────────────────────────
fs.writeFileSync(path.join(outDir, "project.json"), JSON.stringify(project));
const pictures: string[] = [];
if (renderModule?.renderMapPng) {
  fs.mkdirSync(path.join(outDir, "maps"), { recursive: true });
  for (const [i, map] of Object.values(project.maps).entries()) {
    const file = `${String(i + 1).padStart(2, "0")}-${(map.name ?? map.id).replace(/[^\p{L}\p{N}]+/gu, "_")}.png`;
    try { fs.writeFileSync(path.join(outDir, "maps", file), renderModule.renderMapPng(project, map).png); pictures.push(file); } catch (e) { console.error(`[${spec.id}] 그림 실패 ${map.name}: ${(e as Error).message.slice(0, 120)}`); }
  }
}
const played = log.filter((l) => l.now !== undefined);
const writes = (l: CallLog) => !spec.turns[l.turn - 1]!.calls[l.i]!.read && l.n !== "todo";
const savedSalts = Object.fromEntries((project.assistantTodo?.memory?.places?.places ?? []).filter((p) => p.spec?.name).map((p) => [p.spec!.name!, p.spec!.salt]));
const result = {
  id: spec.id, kind: spec.kind, request: spec.request, source: spec.source, engine, replayedAt: process.env.SPEC_BANK_HEAD ?? "", layout: turnModule?.createV2Turn ? "turn" : "runAssistantV2", ms: Date.now() - started,
  calls: {
    total: spec.turns.reduce((n, t) => n + t.calls.length, 0), played: played.length,
    notPlayed: spec.turns.reduce((n, t) => n + t.calls.length, 0) - played.length,
    sameOutcome: played.filter((l) => l.now === l.was).length,
    writes: played.filter(writes).length, writesSame: played.filter((l) => writes(l) && l.now === l.was).length,
    okToFail: played.filter((l) => l.was && !l.now).map((l) => `${l.turn}.${l.i} ${l.n}: ${l.s ?? ""}`.slice(0, 260)),
    failToOk: played.filter((l) => !l.was && l.now).map((l) => `${l.turn}.${l.i} ${l.n}`),
    unresolvedIds: log.filter((l) => l.note?.startsWith("못 찾은 id")).map((l) => `${l.turn}.${l.i} ${l.n}: ${l.note}`),
    renamed: played.filter((l) => l.as).map((l) => `${l.turn}.${l.i} ${l.n}→${l.as}`),
    resent: played.filter((l) => l.resent).map((l) => `${l.turn}.${l.i} ${l.n} ×${l.resent}${l.now ? "" : " (끝내 거절)"}`),
    needsOutside: played.filter((l) => NEEDS_OUTSIDE.test(l.n)).map((l) => `${l.turn}.${l.i} ${l.n}${l.now === l.was ? "" : l.now ? " (지금 성공)" : " (지금 실패)"}`),
  },
  salts: { recorded: Object.keys(spec.salts).length, drawn: saltLog, kept: Object.entries(spec.salts).filter(([name, salt]) => savedSalts[name] === salt).length },
  sharedContent: sharedNote,
  counters: { random: counters.random, saltDraws: counters.saltDraws, blockedFetch: counters.blockedFetch, fetchUrls: [...counters.fetchUrls] },
  turns: turnsOut,
  trust: turnsOut.at(-1)?.trust,
  pictures,
  log,
};
fs.writeFileSync(path.join(outDir, "replay.json"), JSON.stringify(result, null, 1));
const tr = result.trust;
console.log(`${spec.id}: 호출 ${result.calls.played}/${result.calls.total} 재생 · 그때와 같은 결과 ${result.calls.sameOutcome}/${result.calls.played}(쓰기 ${result.calls.writesSame}/${result.calls.writes}) · 소금 ${result.salts.kept}/${result.salts.recorded}${tr ? ` · 맵 타일 같음 ${tr.maps.sameTiles}/${tr.maps.saved} · 이벤트 ${tr.events.matched}/${tr.events.saved}(같은 칸 ${tr.events.samePlace} · 내용까지 같음 ${tr.events.sameContent})` : ""} · 판정 ${turnsOut.map((x) => (x.verdictNow ? (x.verdictNow.complete ? "완료" : "미완") : "-")).join("/")} · ${Math.round(result.ms / 1000)}초`);
process.exit(0);
