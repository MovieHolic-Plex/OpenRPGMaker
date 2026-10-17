// 바로 깔기 적대적 코퍼스 실행기 — 실제 계획기·검증기·러너(runStampPlaceWith)·도구를 헤드리스로 돌린다.
//
//   bun scripts/qa/stamp-place-corpus.mts --mode script            # 녹화한 모델 응답으로 재생(모델·키 없이, CI 없이도 돈다)
//   bun scripts/qa/stamp-place-corpus.mts --mode agy --record      # 실제 Argon(gemini-4-argon-medium)을 agy CLI 로 불러 응답을 녹화한다
//   bun scripts/qa/stamp-place-corpus.mts --mode script --themes jp,interior --ids pot,chair --render
//
// 모델: 8318 프록시 키(OPRN_LIVE_KEY)가 없으면 `agy -p --model gemini-4-argon-medium` 으로 같은 모델을 부른다(키를 만지지 않는다).
//       script 모드는 scripts/qa/stamp-place-corpus.script.json 의 녹화본을 쓴다(키 = 테마|문장 해시). 녹화에 없으면 「응답 없음」으로 센다.
// 도구·스토어·검증은 실제 코드다(applyToolSequenceToStore 와 같은 순서: runTool 을 이어 돌리고 실패는 건너뛴다).
// 결과 분류(탐지는 기계, 최종은 눈): ART 타일이 바뀜 / EVENT_ONLY 이벤트만 / NONE 아무것도 안 바뀜 / FALSE_OK 「성공」인데 그림이 없음.
// 결과는 output/stamp-corpus/<태그>/results.json + crops/*.png. 프로젝트 저장 콘텐츠는 건드리지 않는다(메모리 프로젝트).
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { createBlankProject, ensureBundledTilesets } from "../../src/project/defaults.ts";
import { runTool } from "../../src/editor/tools/toolRunner.ts";
import { runStampPlaceWith, isOpenObjectCell, type StampRunDeps } from "../../src/editor/stampPlaceRunner.ts";
import { isPassableLanding } from "../../src/project/collision.ts";
import { resolveMaterialByLabel } from "../../src/project/tileVocabulary.ts";
import type { GameMap, Project } from "../../src/project/types.ts";
import type { AiConfig, ChatResult } from "../../src/ai/llmClient.ts";
import { renderMapPng } from "../qa-game/render.mts";

const ARGV = process.argv.slice(2);
const arg = (name: string, fallback?: string): string | undefined => { const i = ARGV.indexOf(`--${name}`); return i >= 0 ? (ARGV[i + 1]?.startsWith("--") || ARGV[i + 1] === undefined ? "1" : ARGV[i + 1]) : fallback; };
const flag = (name: string): boolean => ARGV.includes(`--${name}`);

const MODE = (arg("mode", "script") ?? "script") as "script" | "agy";
const TAG = arg("tag", "run") ?? "run";
const OUT = path.resolve(arg("out", `output/stamp-corpus/${TAG}`) ?? "");
const SCRIPT_FILE = path.resolve("scripts/qa/stamp-place-corpus.script.json");
const CORPUS = JSON.parse(fs.readFileSync("scripts/qa/stamp-place-corpus.json", "utf8")) as CorpusEntry[];
const CONCURRENCY = Number(arg("jobs", "5"));
const RECORD = flag("record");
const RENDER = flag("render");

/** sel: 이 문장에 쓸 선택 크기 [w, h](기본 8×6 — 집은 8×6 에 들어가지 않는다). */
interface CorpusEntry { id: string; cat: string; text: string; expect: "art" | "event" | "refuse" | "any"; kw: string; count?: number; sel?: readonly [number, number] }

// ── 테마(칩셋) 맵 ────────────────────────────────────────────────────────────
interface ThemeSetup { readonly id: string; readonly label: string; readonly mapId: string; readonly build: (ctx: { project: Project }) => void; readonly yard?: boolean }
const THEMES: readonly ThemeSetup[] = [
  { id: "beodeul", label: "버들항(beodeul_city)", mapId: "t_beodeul", build: (ctx) => {
    must(runTool(ctx, "create_map", { name: "버들항 마을", id: "t_beodeul", width: 40, height: 30, tilesetId: "beodeul_city" }, { dryRun: false }));
    must(runTool(ctx, "author_beodeul_town", { mapId: "t_beodeul", theme: "river" }, { dryRun: false }), true);
  } },
  { id: "jp", label: "일본 주택가(jp_city)", mapId: "t_jp", build: (ctx) => {
    must(runTool(ctx, "create_map", { name: "일본 주택가", id: "t_jp", themeScene: "jp_city:residential" }, { dryRun: false }));
  } },
  { id: "jpyard", label: "일본 주택가 · 마당 선택(jp_city)", mapId: "t_jpyard", yard: true, build: (ctx) => {
    must(runTool(ctx, "create_map", { name: "일본 주택가", id: "t_jpyard", themeScene: "jp_city:residential" }, { dryRun: false }));
  } },
  { id: "interior", label: "손 도트 실내(atlas_biome_interior)", mapId: "t_interior", build: (ctx) => {
    must(runTool(ctx, "build_hand_interior_room", { name: "빵집 안", mapId: "t_interior", floor: "plank", wall: "plaster", layout: { program: "house-1f" } }, { dryRun: false }), true);
    if (!ctx.project.maps.t_interior) must(runTool(ctx, "build_hand_interior_room", { name: "빵집 안", mapId: "t_interior", floor: "plank", wall: "plaster", layout: { program: "bakery" } }, { dryRun: false }));
  } },
  { id: "sky", label: "천공섬 마을(sky_island)", mapId: "t_sky", build: (ctx) => {
    must(runTool(ctx, "create_map", { name: "천공섬 마을", id: "t_sky", themeScene: "sky_island:village" }, { dryRun: false }));
  } },
  { id: "monster", label: "몬스터 키트 야외(monster_overworld)", mapId: "t_monster", yard: true, build: (ctx) => {
    must(runTool(ctx, "create_map", { name: "몬스터 마을", id: "t_monster", width: 34, height: 26, tilesetId: "monster_overworld" }, { dryRun: false }));
  } },
  { id: "farm", label: "초원 마을(scarloxy_chipset_grassland)", mapId: "t_farm", yard: true, build: (ctx) => {
    must(runTool(ctx, "create_map", { name: "농장", id: "t_farm", width: 34, height: 26, tilesetId: "scarloxy_chipset_grassland" }, { dryRun: false }));
  } },
];

function must(result: { ok: boolean; summary?: string; issues?: { message: string }[] }, soft = false): void {
  if (result.ok) return;
  const message = `${result.summary ?? ""} ${(result.issues ?? []).map((issue) => issue.message).join(" | ")}`.slice(0, 300);
  if (soft) { console.warn("setup warn:", message); return; }
  throw new Error(`setup failed: ${message}`);
}

function baseProject(): Project {
  const project = createBlankProject();
  ensureBundledTilesets(project);
  return project;
}

/** 비어 있고 통행 가능한 W×H 사각형 중 맵 가운데에 가장 가까운 것. */
function pickSelection(project: Project, map: GameMap, w: number, h: number, yard = false): { x: number; y: number; width: number; height: number } {
  const occupied = new Set(map.events.map((event) => `${event.x},${event.y}`));
  // 실제 사용자가 고르는 자리 = 물건이 놓일 수 있는 마당·바닥. 길 한복판은 아니다.
  const ok = (x: number, y: number): boolean => !occupied.has(`${x},${y}`) && (yard ? isOpenObjectCell(project, map, x, y) : isPassableLanding(project, map, x, y));
  let best: { x: number; y: number; score: number } | null = null;
  const cx = map.width / 2, cy = map.height / 2;
  for (let y = 0; y + h <= map.height; y++) for (let x = 0; x + w <= map.width; x++) {
    let free = 0;
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) if (ok(x + dx, y + dy)) free++;
    if (!yard && free < w * h * 0.9) continue;
    const score = yard ? -free * 1000 + Math.hypot(x + w / 2 - cx, y + h / 2 - cy) : Math.hypot(x + w / 2 - cx, y + h / 2 - cy);
    if (!best || score < best.score) best = { x, y, score };
  }
  const fallback = { x: Math.max(0, Math.floor(cx - w / 2)), y: Math.max(0, Math.floor(cy - h / 2)) };
  const at = best ?? fallback;
  return { x: at.x, y: at.y, width: Math.min(w, map.width), height: Math.min(h, map.height) };
}

// ── 모델 ─────────────────────────────────────────────────────────────────────
const CACHE_DIR = path.resolve("output/stamp-corpus/agy-cache");
fs.mkdirSync(CACHE_DIR, { recursive: true });
const script: Record<string, string> = fs.existsSync(SCRIPT_FILE) ? JSON.parse(fs.readFileSync(SCRIPT_FILE, "utf8")) : {};
const recorded: Record<string, string> = { ...script };

function sha(text: string): string { return createHash("sha1").update(text).digest("hex").slice(0, 16); }

function runAgy(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("agy", ["-p", prompt, "--model", "gemini-4-argon-medium"], { cwd: "/tmp", stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (chunk) => { out += chunk; });
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("agy 시간 초과(150s)")); }, 150_000);
    child.on("close", () => { clearTimeout(timer); resolve(out.trim()); });
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
  });
}

let agyQueue: Promise<unknown> = Promise.resolve();
const gate = (() => { let active = 0; const waiters: (() => void)[] = []; return async <T,>(fn: () => Promise<T>): Promise<T> => { while (active >= CONCURRENCY) await new Promise<void>((r) => waiters.push(r)); active++; try { return await fn(); } finally { active--; waiters.shift()?.(); } }; })();
void agyQueue;

function makeChat(key: string) {
  return async (_config: AiConfig, req: { messages: readonly { role: string; content: unknown }[] }): Promise<ChatResult> => {
    const system = String(req.messages.find((m) => m.role === "system")?.content ?? "");
    const users = req.messages.filter((m) => m.role !== "system");
    // 수리 호출은 마지막에 assistant·user 가 더 붙는다 — 키에 호출 순서를 넣는다.
    const callKey = `${key}#${users.length}`;
    let content: string | undefined;
    if (MODE === "script") content = recorded[callKey];
    if (content === undefined && MODE === "agy") {
      const prompt = [
        `SYSTEM:\n${system}`,
        ...users.map((m) => `${m.role === "assistant" ? "ASSISTANT" : "USER"}:\n${String(m.content)}`),
        "Reply with ONLY the JSON object, no tools, no prose.",
      ].join("\n\n");
      const cacheFile = path.join(CACHE_DIR, `${sha(prompt)}.txt`);
      if (fs.existsSync(cacheFile)) content = fs.readFileSync(cacheFile, "utf8");
      else {
        content = await gate(() => runAgy(prompt));
        if (content) fs.writeFileSync(cacheFile, content);
      }
      if (RECORD && content) recorded[callKey] = content;
    }
    if (content === undefined || content === "") throw new Error(`모델 응답 없음(${MODE}, ${callKey})`);
    return { message: { role: "assistant", content }, finishReason: "stop" } as unknown as ChatResult;
  };
}

// ── 한 번의 시험 ─────────────────────────────────────────────────────────────
type Verdict = "ART" | "WRONG_THING" | "EVENT_ONLY" | "NONE" | "FALSE_OK" | "REFUSED_OK" | "ERROR";

interface EventInfo { readonly name: string; readonly id: string; readonly x: number; readonly y: number; readonly graphic: string; readonly visible: boolean; readonly passable: boolean }

interface RunRecord {
  readonly theme: string;
  readonly id: string;
  readonly cat: string;
  readonly text: string;
  readonly expect: string;
  readonly verdict: Verdict;
  readonly ok: boolean;
  readonly applied: number;
  readonly usedModel: boolean;
  readonly tilesChanged: number;
  readonly layersChanged: readonly string[];
  readonly events: readonly EventInfo[];
  readonly steps: readonly { tool: string; ok: boolean; label?: string; material?: unknown; resolved?: string; role?: string; detail: string }[];
  readonly lines: readonly string[];
  readonly relevant: boolean | null;
  readonly honest: boolean;
  readonly notes: readonly string[];
  readonly selection: { x: number; y: number; width: number; height: number };
  readonly crop?: string;
}

const TILE_LAYERS = ["lowerTiles", "upperTiles", "lowerOverlayTiles", "upperOverlayTiles"] as const;

function describeGraphic(page: { graphic?: Record<string, unknown> } | undefined): { text: string; visible: boolean } {
  const graphic = page?.graphic ?? {};
  const sprite = graphic.sprite as { textureKey?: string; characterIndex?: number; kind?: string } | undefined;
  const appearance = graphic.appearanceId;
  const transparent = graphic.transparent === true;
  if (!sprite && !appearance) return { text: "(없음)", visible: false };
  const text = sprite ? `sprite ${sprite.textureKey ?? sprite.kind ?? "?"}${sprite.characterIndex !== undefined ? `#${sprite.characterIndex}` : ""}` : `appearance ${String(appearance)}`;
  return { text: transparent ? `${text} (투명)` : text, visible: !transparent };
}

function diffMap(before: GameMap, after: GameMap): { tilesChanged: number; layers: string[] } {
  const layers: string[] = [];
  let tilesChanged = 0;
  for (const key of TILE_LAYERS) {
    const a = (before as unknown as Record<string, number[] | undefined>)[key];
    const b = (after as unknown as Record<string, number[] | undefined>)[key];
    if (!a && !b) continue;
    let n = 0;
    const size = after.width * after.height;
    for (let i = 0; i < size; i++) if ((a?.[i] ?? -1) !== (b?.[i] ?? -1)) n++;
    if (n > 0) { layers.push(`${key}:${n}`); tilesChanged += n; }
  }
  return { tilesChanged, layers };
}

function cropPng(png: Buffer, size: number, sel: { x: number; y: number; width: number; height: number }, scale: number, pad = 3): PNG {
  const source = PNG.sync.read(png);
  const px = size * scale;
  const x0 = Math.max(0, (sel.x - pad) * px), y0 = Math.max(0, (sel.y - pad) * px);
  const x1 = Math.min(source.width, (sel.x + sel.width + pad) * px), y1 = Math.min(source.height, (sel.y + sel.height + pad) * px);
  const out = new PNG({ width: x1 - x0, height: y1 - y0 });
  PNG.bitblt(source, out, x0, y0, x1 - x0, y1 - y0, 0, 0);
  return out;
}

async function runCase(theme: ThemeSetup, entry: CorpusEntry, base: Project, sel: { x: number; y: number; width: number; height: number }): Promise<RunRecord> {
  const project = structuredClone(base);
  const before = structuredClone(project.maps[theme.mapId]!);
  const stepLog: { tool: string; ok: boolean; label?: string; material?: unknown; resolved?: string; role?: string; detail: string }[] = [];
  const ctx = { project };
  const key = `${theme.id}|${entry.id}`;
  const deps: StampRunDeps = {
    getProject: () => ctx.project,
    apply: (calls) => calls.map((call) => {
      let resolved: string | undefined;
      let role: string | undefined;
      if ((call.name === "place_props" || call.name === "fill_region") && typeof call.args.material === "string") {
        const tileset = ctx.project.tilesets[ctx.project.maps[theme.mapId]!.tilesetId];
        const hit = tileset ? resolveMaterialByLabel(tileset, call.args.material, { preferGroup: true, preferRoles: ["prop", "terrain"] }) : null;
        if (hit && hit.status !== "missing") {
          resolved = hit.matchedLabel;
          role = hit.kind === "group" ? hit.group.role : "tile";
        }
      }
      const result = runTool(ctx, call.name, call.args, { dryRun: false });
      stepLog.push({
        tool: call.name, ok: result.ok, material: call.args.material ?? call.args.name ?? call.args.objectId, ...(resolved ? { resolved } : {}), ...(role ? { role } : {}),
        detail: (result.summary || result.issues?.map((issue) => issue.message).join(" ") || "").slice(0, 220),
      });
      return result;
    }),
    chat: makeChat(key) as never,
    getConfig: () => ({ authMode: "apiKey", baseUrl: "x", model: "m", liteModel: "lite", apiKey: "k", maxTokens: 4096, maxToolCalls: 4 }) as AiConfig,
    isModelReady: () => true,
    timeoutMs: 170_000,
  };
  const notes: string[] = [];
  let result;
  try {
    result = await runStampPlaceWith({ text: entry.text, mapId: theme.mapId, selection: { mapId: theme.mapId, ...sel } }, deps);
  } catch (error) {
    return {
      theme: theme.id, id: entry.id, cat: entry.cat, text: entry.text, expect: entry.expect, verdict: "ERROR", ok: false, applied: 0, usedModel: false,
      tilesChanged: 0, layersChanged: [], events: [], steps: stepLog, lines: [String(error)], relevant: null, honest: false, notes: [String(error)], selection: sel,
    };
  }
  const after = ctx.project.maps[theme.mapId]!;
  const diff = diffMap(before, after);
  const beforeIds = new Set(before.events.map((event) => event.id));
  const events: EventInfo[] = after.events.filter((event) => !beforeIds.has(event.id)).map((event) => {
    const graphic = describeGraphic(event.pages?.[0] as never);
    return { name: event.name ?? event.id, id: event.id, x: event.x, y: event.y, graphic: graphic.text, visible: graphic.visible, passable: isPassableLanding(ctx.project, after, event.x, event.y) };
  });
  const movedEvents = before.events.filter((event) => !after.events.some((other) => other.id === event.id)).length;
  const objectRequested = entry.expect === "art" || entry.expect === "refuse";
  // 「그림」 = 타일이 바뀌었거나, 보이는 그림이 붙은 새 이벤트(NPC·상인 제외 — 사람 그림은 물건 그림이 아니다).
  const personLike = (info: EventInfo): boolean => /charset|actor|face|villager|people/i.test(info.graphic);
  const nonPersonVisibleEvents = events.filter((info) => info.visible && !personLike(info));
  let verdict: Verdict;
  if ((result.refused ?? 0) > 0 && result.applied === 0 && diff.tilesChanged === 0 && events.length === 0) verdict = entry.expect === "refuse" ? "REFUSED_OK" : "REFUSED_OK";
  else if (!result.usedModel && result.applied === 0 && diff.tilesChanged === 0 && events.length === 0) verdict = entry.expect === "refuse" ? "REFUSED_OK" : "NONE";
  else if (diff.tilesChanged > 0) verdict = "ART";
  else if (events.length > 0 && nonPersonVisibleEvents.length === 0) verdict = result.ok && objectRequested && entry.expect !== "refuse" ? "FALSE_OK" : "EVENT_ONLY";
  else if (events.length > 0) verdict = "ART";
  else if (movedEvents > 0) verdict = "ART";
  else verdict = result.ok && entry.expect !== "refuse" ? "FALSE_OK" : entry.expect === "refuse" && !result.ok ? "REFUSED_OK" : "NONE";
  // 「그림」이 바뀌었어도 요청한 물건과 무관한 재료(바닥·물·길 면)를 흩뿌렸으면 엉뚱한 물건이다.
  if (verdict === "ART" && entry.kw && entry.expect === "art" && diff.tilesChanged > 0 && nonPersonVisibleEvents.length === 0) {
    const re = new RegExp(entry.kw, "iu");
    const placed = stepLog.filter((step) => step.ok && (step.tool === "place_props" || step.tool === "fill_region"));
    if (placed.length > 0 && placed.every((step) => !re.test(step.resolved ?? String(step.material ?? "")))) verdict = "WRONG_THING";
  }
  if (entry.expect === "refuse" && (verdict === "ART" || verdict === "EVENT_ONLY" || verdict === "FALSE_OK")) notes.push("칩셋에 없는 물건인데 뭔가 깔렸다(엉뚱한 대체)");
  // 정직성: 결과가 「성공」인데 그림이 없다면 거짓. 줄에 「깔았/배치/완료」가 있는데 변화 0 도 거짓.
  const claimsDone = result.ok || result.lines.some((line) => /놓음|배치 ·|완료|깔았|세웠|심었|산포|생성/u.test(line) && !/않|실패|못|없|거절|버린/u.test(line));
  const nothingVisible = diff.tilesChanged === 0 && nonPersonVisibleEvents.length === 0;
  const honest = !(claimsDone && nothingVisible && objectRequested && entry.expect !== "refuse") && !(entry.expect === "refuse" && claimsDone && (diff.tilesChanged > 0 || events.length > 0));
  let relevant: boolean | null = null;
  if (entry.kw) {
    const re = new RegExp(entry.kw, "iu");
    const haystack = [...stepLog.map((step) => `${step.tool} ${String(step.material ?? "")}`), ...events.map((info) => info.name), ...result.lines].join(" ");
    relevant = re.test(haystack);
  }
  if (events.some((info) => !info.passable) && events.length > 0) notes.push("이벤트가 통행 불가 칸 위");
  let crop: string | undefined;
  if (RENDER) {
    try {
      const tileset = project.tilesets[after.tilesetId];
      const size = tileset?.tileSize ?? 16;
      const scale = size >= 32 ? 2 : 4;
      const dir = path.join(OUT, "crops");
      fs.mkdirSync(dir, { recursive: true });
      const left = cropPng(renderMapPng(base, base.maps[theme.mapId]!, scale).png, size, sel, scale);
      const right = cropPng(renderMapPng(ctx.project, after, scale).png, size, sel, scale);
      const sheet = new PNG({ width: left.width + right.width + 6, height: Math.max(left.height, right.height) });
      sheet.data.fill(24);
      PNG.bitblt(left, sheet, 0, 0, left.width, left.height, 0, 0);
      PNG.bitblt(right, sheet, 0, 0, right.width, right.height, left.width + 6, 0);
      crop = `${theme.id}-${entry.id}.png`;
      fs.writeFileSync(path.join(dir, crop), PNG.sync.write(sheet));
    } catch (error) { notes.push(`렌더 실패: ${String(error).slice(0, 80)}`); }
  }
  return {
    theme: theme.id, id: entry.id, cat: entry.cat, text: entry.text, expect: entry.expect, verdict, ok: result.ok, applied: result.applied, usedModel: result.usedModel,
    tilesChanged: diff.tilesChanged, layersChanged: diff.layers, events, steps: stepLog, lines: result.lines, relevant, honest, notes, selection: sel, ...(crop ? { crop } : {}),
  };
}

// ── 실행 ─────────────────────────────────────────────────────────────────────
const themeIds = (arg("themes", "beodeul,jp,interior,sky") ?? "").split(",").filter(Boolean);
const ids = arg("ids") ? new Set((arg("ids") ?? "").split(",")) : null;
const entries = CORPUS.filter((entry) => !ids || ids.has(entry.id));
fs.mkdirSync(OUT, { recursive: true });

const tasks: (() => Promise<RunRecord>)[] = [];
const setupInfo: Record<string, unknown> = {};
for (const themeId of themeIds) {
  const theme = THEMES.find((t) => t.id === themeId);
  if (!theme) { console.error("모르는 테마", themeId); continue; }
  const setupCtx = { project: baseProject() };
  theme.build(setupCtx);
  const base = setupCtx.project;
  const map = base.maps[theme.mapId];
  if (!map) { console.error(`테마 ${themeId} 맵을 만들지 못했습니다`); continue; }
  const sels = new Map<string, { x: number; y: number; width: number; height: number }>();
  const selFor = (entry: CorpusEntry) => {
    const [w, h] = entry.sel ?? [8, 6];
    const key = `${w}x${h}`;
    if (!sels.has(key)) sels.set(key, pickSelection(base, map, w, h, theme.yard === true));
    return sels.get(key)!;
  };
  const sel = selFor({ id: "", cat: "", text: "", expect: "any", kw: "" });
  setupInfo[themeId] = { label: theme.label, tileset: map.tilesetId, map: `${map.width}x${map.height}`, selection: sel, events: map.events.length };
  console.log(`[setup] ${theme.label} ${map.width}x${map.height} sel=${JSON.stringify(sel)} events=${map.events.length}`);
  for (const entry of entries) tasks.push(() => runCase(theme, entry, base, selFor(entry)));
}

const results: RunRecord[] = [];
let cursor = 0;
async function worker(): Promise<void> {
  while (cursor < tasks.length) {
    const index = cursor++;
    const record = await tasks[index]!();
    results[index] = record;
    console.log(`[${index + 1}/${tasks.length}] ${record.theme}/${record.id} ${record.verdict} tiles=${record.tilesChanged} ev=${record.events.length}${record.honest ? "" : " DISHONEST"}`);
  }
}
await Promise.all(Array.from({ length: MODE === "agy" ? CONCURRENCY : 4 }, worker));

const tally: Record<string, number> = {};
for (const record of results) tally[record.verdict] = (tally[record.verdict] ?? 0) + 1;
const dishonest = results.filter((record) => !record.honest).length;
const irrelevant = results.filter((record) => record.relevant === false && record.expect === "art").length;
const summary = { tag: TAG, mode: MODE, total: results.length, tally, dishonest, irrelevantArt: irrelevant, setup: setupInfo };
fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ summary, results }, null, 1));
if (RECORD) fs.writeFileSync(SCRIPT_FILE, JSON.stringify(recorded, null, 0));
console.log(JSON.stringify(summary));
