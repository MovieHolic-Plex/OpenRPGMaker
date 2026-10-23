// src/harnesses/_core/workshop/engine.ts
/**
 * 공방 실행기. 파이썬 하네스(src/harnesses/interior-props/harness.py)와 같은 흐름을 브라우저에서 돈다:
 * 그리기 → (깨지면 고치기 ≤2) → (실행기가 주면 자기 점검 1번) → 독립 검수 → 하네스 판정(gate) → 불통과면 다시(시도 ≤3).
 * 사람만 고른다 — 엔진은 고르지 않는다. 판은 바뀔 때마다 통째로 저장해, 탭을 닫아도 resume() 로 잇는다.
 */
import type { ChatMessage } from "@/ai/llmClient";
import { applyRowFix, parseDrawAnswer, rowsNeedingFix } from "./grid";
import { parseRefViewCheck, REF_TRIES, REF_VIEW_PROMPT, refMinTop, refPrompt, refPromptNames } from "./referencePrompt";
import { kitConstant, objectGenKit } from "./genKits";
import type { WorkshopStore } from "./store";
import { perItem } from "./types";
import type {
  AnchorSample, BaseInfo, ChatFn, DrawContext, Grid, Palette, PaletteEntry, ReferenceColor, RejectedSample, RgbaImage, RoundReference, Verdict, WorkshopEnv, WorkshopItem, WorkshopRound, WorkshopRun,
  WorkshopRunner, WorkshopSurface,
} from "./types";

export const MAX_ATTEMPTS = 3;
export const MAX_FIXES = 2;
/** 폭이 틀린 줄이 이 수 이하면 그 줄만 다시 받는다 */
const ROW_FIX_LIMIT = 8;
export const DEFAULT_CONCURRENCY = 3;
/** 판을 열 때 보여 주는 「호출 약 N번」 계산용(그리기·검수 + 가끔 고치기·다시) */
export const CALLS_PER_CANDIDATE_ESTIMATE = 3;
const MAX_RATE_RETRIES = 5;
const RATE_WAIT_MS = 20_000;
const BLOCKED_AUTH = "AI 연결이 끊겼습니다. AI 설정에서 다시 연결하세요.";
/** 계정 사용 한도(429) — 기다려도 풀리지 않는 한도면 다시 시도하지 않고 바로 멈춘다(실측 2026-10-21: 「Individual quota reached … Resets in 101h」). */
const BLOCKED_QUOTA = "내 AI 계정의 사용 한도에 걸렸어요. 한도가 풀리거나 AI 설정에서 다른 계정·모델로 바꾼 뒤 「다시 그리기」를 누르세요.";
const PENDING = new Set(["queued", "drawing", "reviewing"]);

export type WorkshopEngineOptions = {
  runner: WorkshopRunner;
  env: WorkshopEnv;
  chat: ChatFn;
  store: WorkshopStore;
  projectKey: string;
  concurrency?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  newId?: () => string;
  onChange?: (round: WorkshopRound) => void;
  /** running·queued·blocked 같은 실행 상태가 바뀐 뒤(실행이 running 에서 빠진 직후 등)에 부른다. */
  onStatus?: () => void;
};

export interface WorkshopEngine {
  /** count = 이번 판 후보 수(1 ~ runner.candidates). 없으면 runner.candidates. */
  /** reference:false = 참고 그림 단계를 건너뛴다(참고 있음/없음 비교·사용자가 끈 경우). */
  startRound(item: WorkshopItem, options?: { note?: string; count?: number; reference?: boolean }): Promise<WorkshopRound>;
  redrawRun(roundId: string, letter: string, note: string): Promise<void>;
  cancelRound(roundId: string): Promise<void>;
  resume(): Promise<number>;
  setConcurrency(n: number): void;
  status(): { running: number; queued: number; concurrency: number; blocked: string | null };
  idle(): Promise<void>;
  dispose(): void;
}

class Cancelled extends Error {}

/** {"keep": true} — 미리보기를 보고 더 고칠 게 없다는 답(격자 없이). */
function isKeepAnswer(text: string): boolean {
  return /"keep"\s*:\s*true/u.test(text) && !/"rows"\s*:/u.test(text);
}

/** 참고 그림을 판 기록에 담을 크기(긴 변 px). 모양만 보면 되니 원본(1024)을 다 담지 않는다. */
const REF_STORE_PX = 512;
const REJECTED_REF_PX = 160;
/** 견본 기록 크기(긴 변) */
const ANCHOR_STORE_PX = 256;
/** 참고 그림 바탕색(object-gen reference.BACKGROUND) */
const REF_BACKGROUND = kitConstant<readonly [number, number, number]>(objectGenKit, "reference", "BACKGROUND");

/**
 * 투명 바탕을 회색 바탕에 합성한다(object-gen reference.flatten). 그림 경로 답의 절반쯤은 투명 바탕 RGBA 이고 투명 칸 밑에
 * 어두운 RGB 찌꺼기가 있다 — 알파를 버리고 읽는 쪽(검수·그리기 모델)에는 물체가 검은 바탕·후광 속에 보였다(2026-10-22 실측).
 */
export function flattenImage(image: RgbaImage, background: readonly [number, number, number] = REF_BACKGROUND): RgbaImage {
  const data = new Uint8ClampedArray(image.data.length);
  for (let i = 0; i < data.length; i += 4) {
    const a = image.data[i + 3]! / 255;
    for (let c = 0; c < 3; c++) data[i + c] = Math.round(image.data[i + c]! * a + background[c]! * (1 - a));
    data[i + 3] = 255;
  }
  return { width: image.width, height: image.height, data };
}

/** 상자 평균으로 줄인다(참고 그림 보관용 — 칩셋 화소로 쓰지 않는다). */
/**
 * 참고 그림(회색 바탕)의 물체 화소를 가장 가까운 팔레트 색으로 옮겨 몫을 센다. 그리는 쪽은 참고 그림을 「모양만」 보라고 듣기 때문에
 * 색을 제 마음대로 바래게 칠하곤 했다 — 실측(2026-10-22): 금빛 건초 참고 그림을 받고도 연한 베이지 덩어리로 그려 1배에서 건초로 안 읽혔다.
 */
export function referenceColors(image: RgbaImage, palette: Palette, background: readonly [number, number, number] = REF_BACKGROUND, limit = 8): ReferenceColor[] {
  const entries = palette.entries.filter((e) => e.rgba[3] > 0);
  if (!entries.length) return [];
  const counts = new Map<string, number>();
  let total = 0;
  const d = image.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3]! < 128) continue;
    const r = d[i]!, g = d[i + 1]!, b = d[i + 2]!;
    if (Math.abs(r - background[0]) + Math.abs(g - background[1]) + Math.abs(b - background[2]) <= 24) continue;
    let best = entries[0]!, bestD = Infinity;
    for (const e of entries) { const dd = (e.rgba[0] - r) ** 2 + (e.rgba[1] - g) ** 2 + (e.rgba[2] - b) ** 2; if (dd < bestD) { bestD = dd; best = e; } }
    counts.set(best.key, (counts.get(best.key) ?? 0) + 1);
    total += 1;
  }
  if (!total) return [];
  const hex = (e: PaletteEntry) => "#" + [e.rgba[0], e.rgba[1], e.rgba[2]].map((v) => v.toString(16).padStart(2, "0")).join("");
  return [...counts].map(([key, n]) => ({ key, hex: hex(palette.byKey.get(key)!), share: Math.round((n / total) * 100) }))
    .filter((c) => c.share >= 4).sort((a, b) => b.share - a.share).slice(0, limit);
}

function shrinkImage(image: RgbaImage, maxSide: number): RgbaImage {
  const factor = Math.max(image.width, image.height) / maxSide;
  if (factor <= 1) return image;
  const width = Math.max(1, Math.round(image.width / factor)), height = Math.max(1, Math.round(image.height / factor));
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const x0 = Math.floor(x * image.width / width), x1 = Math.max(x0 + 1, Math.floor((x + 1) * image.width / width));
    const y0 = Math.floor(y * image.height / height), y1 = Math.max(y0 + 1, Math.floor((y + 1) * image.height / height));
    const sum = [0, 0, 0, 0];
    for (let sy = y0; sy < y1; sy++) for (let sx = x0; sx < x1; sx++) for (let c = 0; c < 4; c++) sum[c] += image.data[(sy * image.width + sx) * 4 + c]!;
    const n = (x1 - x0) * (y1 - y0);
    for (let c = 0; c < 4; c++) data[(y * width + x) * 4 + c] = Math.round(sum[c]! / n);
  }
  return { width, height, data };
}

const statusOf = (error: unknown): number | undefined => {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === "number" ? status : undefined;
};
/** 다시 시도해도 소용없는 한도 소진 429 인가(공급자 문구로 가린다). 잠깐 몰린 429 는 아니다. */
const isQuotaExhausted = (error: unknown): boolean =>
  statusOf(error) === 429 && /quota|RESOURCE_EXHAUSTED|usage limit|upgrade your (plan|subscription)/i.test(error instanceof Error ? error.message : String(error));
/**
 * 카드에 보일 한도 소진 문구 — 공급자 원문(JSON 덩어리)을 그대로 보이지 않고, 원문에 「Resets in 61h28m」이 있으면 풀리는 때만 짧게 붙인다.
 * 원문은 개발자 도구 로그(동반 서비스 응답)에 남는다.
 */
export function quotaRunError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  const m = /Resets in (?:(\d+)h)?\s*(?:(\d+)m)?/i.exec(text);
  const hours = m?.[1] ? Number(m[1]) : 0;
  const minutes = m?.[2] ? Number(m[2]) : 0;
  if (hours > 0) return `계정 사용 한도 소진 · 약 ${hours + (minutes >= 30 ? 1 : 0)}시간 뒤 풀림`;
  if (minutes > 0) return `계정 사용 한도 소진 · 약 ${minutes}분 뒤 풀림`;
  return "계정 사용 한도 소진";
}
const isAbort = (error: unknown): boolean => error instanceof Cancelled || (error as { name?: string } | null)?.name === "AbortError";
/** 장(후보) 동시 상한. 작업 줄이 작업 10개 × 후보 몇 장을 함께 돌릴 수 있게 30 까지 받는다(화면의 「동시에」 고르기는 따로 좁힌다). */
export const MAX_ENGINE_CONCURRENCY = 30;
const clampConcurrency = (n: number): number => Math.max(1, Math.min(MAX_ENGINE_CONCURRENCY, Math.round(n)));
/** 막힌 장의 갈래 — 작업 줄이 이것으로 기다릴 시간을 정한다. */
export function runErrorKind(error: unknown): "quota" | "rate" | "auth" | null {
  const status = statusOf(error);
  if (status === 401 || status === 403) return "auth";
  if (status === 429) return isQuotaExhausted(error) ? "quota" : "rate";
  return null;
}

export function createWorkshopEngine(options: WorkshopEngineOptions): WorkshopEngine {
  const { runner, env, chat, store, projectKey } = options;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const now = options.now ?? (() => Date.now());
  const newId = options.newId ?? (() => `w${now().toString(36)}${Math.random().toString(36).slice(2, 7)}`);
  let concurrency = clampConcurrency(options.concurrency ?? DEFAULT_CONCURRENCY);
  let blocked: string | null = null;
  let disposed = false;
  const rounds = new Map<string, WorkshopRound>();
  const queue: { roundId: string; letter: string }[] = [];
  const running = new Map<string, AbortController>();
  const writes = new Map<string, Promise<void>>();
  let idleWaiters: (() => void)[] = [];

  const runKey = (roundId: string, letter: string) => `${roundId}\n${letter}`;
  const runOf = (round: WorkshopRound, letter: string): WorkshopRun => {
    const run = round.runs.find((r) => r.letter === letter);
    if (!run) throw new Error(`판 ${round.id} 에 장 ${letter} 가 없다`);
    return run;
  };

  function save(round: WorkshopRound): Promise<void> {
    const snapshot = structuredClone(round);
    const next = (writes.get(round.id) ?? Promise.resolve()).then(() => store.putRound(snapshot)).catch((error) => {
      console.warn("[workshop] 판 저장 실패:", error);
    });
    writes.set(round.id, next);
    options.onChange?.(snapshot);
    return next;
  }

  function settleIdle(): void {
    if (running.size > 0 || (queue.length > 0 && !blocked)) return;
    void Promise.all(writes.values()).then(() => {
      const waiters = idleWaiters;
      idleWaiters = [];
      for (const resolve of waiters) resolve();
    });
  }

  function pump(): void {
    while (!disposed && !blocked && running.size < concurrency && queue.length > 0) {
      const next = queue.shift()!;
      const round = rounds.get(next.roundId);
      if (!round) continue;
      const controller = new AbortController();
      running.set(runKey(next.roundId, next.letter), controller);
      void runOne(round, runOf(round, next.letter), controller.signal).finally(() => {
        running.delete(runKey(next.roundId, next.letter));
        pump();
        settleIdle();
        options.onStatus?.();
      });
    }
    settleIdle();
  }

  async function call(surface: WorkshopSurface, messages: ChatMessage[], run: WorkshopRun, round: WorkshopRound, signal: AbortSignal): Promise<string> {
    for (let retry = 0; ; retry++) {
      if (signal.aborted) throw new Cancelled();
      try {
        run.calls += 1;
        void save(round);
        return await chat(surface, { messages, response_format: { type: "json_object" }, temperature: surface === "workshop-draw" ? 0.6 : 0.1, signal, disableTransientRetry: true }, { roundId: round.id, letter: run.letter });
      } catch (error) {
        if (isAbort(error)) throw new Cancelled();
        if (statusOf(error) === 429 && retry < MAX_RATE_RETRIES && !isQuotaExhausted(error)) {
          concurrency = Math.max(1, concurrency - 1);
          await sleep(RATE_WAIT_MS * (retry + 1));
          continue;
        }
        throw error;
      }
    }
  }

  /**
   * 참고 그림 단계(object-gen ref, referencePrompt.ts) — 판마다 한 번. 사용자 그림 계정으로 만들고 시점 검사(판정자 새 호출)를 넘은 첫 장을 쓴다.
   * 그림 계정이 없거나 다 떨어지면 참고 없이 그린다(카드에 「참고 그림 없이 그림」). 결과는 판 기록(round.reference)에만 남는다.
   */
  const references = new Map<string, Promise<string[]>>();
  const acceptedOf = (reference: RoundReference): string[] =>
    reference.status === "ok" && reference.dataUrl ? [reference.dataUrl, ...(reference.more ?? []).map((m) => m.dataUrl)] : [];
  function referenceFor(round: WorkshopRound, item: WorkshopItem, run: WorkshopRun, signal: AbortSignal): Promise<string[]> {
    if (round.reference) return Promise.resolve(acceptedOf(round.reference));
    let pending = references.get(round.id);
    if (!pending) {
      pending = makeReference(round, item, run, signal).catch((error) => {
        if (isAbort(error) || signal.aborted) { references.delete(round.id); throw error; }
        round.reference = { status: "failed", tries: round.reference?.tries ?? 0, note: `참고 그림 없이 그림 — 참고 그림을 만들지 못했다: ${error instanceof Error ? error.message.slice(0, 120) : String(error)}` };
        void save(round);
        return [];
      });
      references.set(round.id, pending);
    }
    return pending;
  }

  async function makeReference(round: WorkshopRound, item: WorkshopItem, run: WorkshopRun, signal: AbortSignal): Promise<string[]> {
    const describe = runner.referenceDescribe?.(item) ?? null;
    if (!describe || !env.referenceImage) {
      round.reference = { status: "none", tries: 0, note: describe ? "참고 그림 없이 그림 — 그림을 만들 수 있는 계정이 연결되지 않았다" : item.noReference ? "참고 그림 없이 그림 — 가는 기둥(가로등·깃대·팻말)은 윗면이 없어 참고 그림이 시점 검사를 못 넘는다(크기 사전 reference:false)" : "참고 그림 없이 그림 — 이 종류는 참고 단계가 없다" };
      void save(round);
      return [];
    }
    // 견본(시점·화풍, 물체 비율 캔버스)을 붙일 때만 「붙인 그림」을 말하는 STYLE_NOTE 를 붙인다 — 예전에는 그림 없이 그 문장만 갔다.
    const anchor = runner.referenceAnchor ? await runner.referenceAnchor(item, env).catch(() => null) : null;
    const styleNote = anchor && runner.referenceStyleNote !== undefined ? perItem(runner.referenceStyleNote, item) : undefined;
    const prompt = refPrompt(describe, item.gateKind, styleNote, item.refTop, item.title);
    const anchorNote = anchor ? env.encodePng(shrinkImage(await env.loadImage(anchor), ANCHOR_STORE_PX)) : undefined;
    const names = refPromptNames(prompt);
    if (names.length) {
      round.reference = { status: "failed", prompt, tries: 0, note: `참고 그림 없이 그림 — 지시문에 쓰면 안 되는 이름(${names.join(", ")})이 들어 있다` };
      void save(round);
      return [];
    }
    const minTop = refMinTop(item.gateKind);
    // 원본 reference.generate: 장마다 시점 검사를 넘을 때까지 tries 번(object-gen 흐름 n 2 · tries 4, 기본 실행기 1장 · 3번).
    const count = runner.referenceCount === undefined ? 0 : perItem(runner.referenceCount, item);
    const need = Math.max(1, count);
    const triesEach = count > 0 ? 4 : REF_TRIES;
    const rejected: { dataUrl: string; view: string; topShare: number; why: string }[] = [];
    const accepted: { dataUrl: string; view: NonNullable<RoundReference["view"]> }[] = [];
    let last: RoundReference["view"];
    let source = "";
    let tries = 0;
    let colors: ReferenceColor[] = [];
    const finish = (): string[] => {
      const [first, ...more] = accepted;
      round.reference = first
        ? { status: "ok", dataUrl: first.dataUrl, prompt, view: first.view, tries, ...(more.length ? { more } : {}), ...(rejected.length ? { rejected } : {}), ...(anchorNote ? { anchor: anchorNote } : {}), ...(colors.length ? { colors } : {}), source,
          note: `참고 그림 ${accepted.length}장(시점 검사 통과, 윗면 ${accepted.map((a) => `${a.view.topShare}%`).join("·")}) — 참고용, 설치 안 됨` }
        : { status: "failed", prompt, view: last, tries, rejected, ...(anchorNote ? { anchor: anchorNote } : {}), source, note: `참고 그림 없이 그림 — 참고 그림 ${tries}장이 모두 시점 검사에서 떨어졌다(${last?.view ?? "?"}, 윗면 ${last?.topShare ?? 0}%)` };
      void save(round);
      return accepted.map((a) => a.dataUrl);
    };
    for (let n = 0; n < need; n++) {
      for (let attempt = 1; attempt <= triesEach; attempt++) {
        if (signal.aborted) throw new Cancelled();
        const made = await env.referenceImage(prompt, signal, anchor ? { image: anchor } : undefined);
        if (!made) {
          if (accepted.length) return finish();
          round.reference = { status: "none", prompt, tries, note: "참고 그림 없이 그림 — 그림을 만들 수 있는 계정이 연결되지 않았다" };
          void save(round);
          return [];
        }
        tries += 1;
        source = made.source;
        const small = shrinkImage(flattenImage(await env.loadImage(made.dataUrl)), REF_STORE_PX);
        const dataUrl = env.encodePng(small);
        const viewText = await call("workshop-review", [
          { role: "system", content: REF_VIEW_PROMPT },
          { role: "user", content: [{ type: "text", text: "The picture to check:" }, { type: "image_url", image_url: { url: dataUrl, detail: "high" } }] },
        ], run, round, signal);
        last = parseRefViewCheck(viewText, minTop);
        if (last.ok) {
          if (!accepted.length) colors = referenceColors(small, runner.palette(item));
          accepted.push({ dataUrl, view: last });
          break;
        }
        rejected.push({ dataUrl: env.encodePng(shrinkImage(small, REJECTED_REF_PX)), view: last.view, topShare: last.topShare, why: last.why });
      }
    }
    return finish();
  }

  /** 그리기 대화 하나: 답 → 해석·깨짐 검사 → (고치기) → (자기 점검). 끝까지 깨지면 오류 글을 돌려준다. */
  async function drawOnce(ctx: DrawContext, run: WorkshopRun, round: WorkshopRound, signal: AbortSignal): Promise<{ grid: Grid; note: string; topRows: number | null } | { error: string }> {
    const messages = await runner.drawMessages(ctx, env);
    let lastError = "";
    let text = await call("workshop-draw", messages, run, round, signal);
    for (let fix = 0; fix <= MAX_FIXES; fix++) {
      if (fix > 0) {
        // 폭이 틀린 줄이 몇 개뿐이면 그 줄만 다시 받는다(짧은 답이라 빠르다). 아니면 전체 격자를 다시 받는다.
        const rows = rowsNeedingFix(text, ctx.item.width, ctx.item.height);
        if (rows && rows.bad.length > 0 && rows.bad.length <= ROW_FIX_LIMIT) {
          messages.push(
            { role: "assistant", content: text },
            { role: "user", content: `줄 ${rows.bad.map((i) => `${i}(${[...rows.rows[i]!].length}글자)`).join(", ")} 의 길이가 캔버스 폭 ${ctx.item.width} 와 다르다. `
              + `나머지 줄은 그대로 두고, 고친 줄만 정확히 ${ctx.item.width}글자로 {"rows":{"${rows.bad[0]}":"…"}} 형식 JSON 하나로 내라.` },
          );
          const fixText = await call("workshop-draw", messages, run, round, signal);
          messages.push({ role: "assistant", content: fixText });
          text = applyRowFix(text, fixText) ?? text;
        } else {
          messages.push(
            { role: "assistant", content: text },
            { role: "user", content: `답을 쓸 수 없다: ${lastError}\n같은 JSON 형식으로 전체 격자를 다시 내라. 캔버스는 ${ctx.item.width}×${ctx.item.height}px 이다.` },
          );
          text = await call("workshop-draw", messages, run, round, signal);
        }
      }
      const parsed = parseDrawAnswer(text, ctx.palette);
      const problems = parsed.ok ? runner.hardCheck(ctx.item, parsed.grid) : [parsed.error];
      if (parsed.ok && problems.length === 0) {
        if (runner.lookMessage && perItem(runner.looks ?? 0, ctx.item) > 0) return await lookLoop(ctx, messages, text, parsed, run, round, signal);
        if (!runner.selfCheckMessage) return { grid: parsed.grid, note: parsed.note, topRows: parsed.topRows };
        messages.push({ role: "assistant", content: text }, runner.selfCheckMessage(ctx, parsed.grid, env));
        const checkedText = await call("workshop-draw", messages, run, round, signal);
        const checked = parseDrawAnswer(checkedText, ctx.palette);
        if (checked.ok && runner.hardCheck(ctx.item, checked.grid).length === 0) {
          return { grid: checked.grid, note: checked.note || parsed.note, topRows: checked.topRows ?? parsed.topRows };
        }
        return { grid: parsed.grid, note: parsed.note, topRows: parsed.topRows };
      }
      lastError = problems.join(" / ");
    }
    return { error: lastError };
  }

  /** object-gen drawer 의 preview 고리: 그린 것을 보여 주고 고친 격자 또는 {"keep":true} 를 받는다. 깨진 답은 버리고 앞 격자를 쓴다. */
  async function lookLoop(ctx: DrawContext, messages: ChatMessage[], text: string, first: { grid: Grid; note: string; topRows: number | null }, run: WorkshopRun, round: WorkshopRound, signal: AbortSignal): Promise<{ grid: Grid; note: string; topRows: number | null }> {
    let best = { grid: first.grid, note: first.note, topRows: first.topRows };
    let lastText = text;
    const max = perItem(runner.looks ?? 0, ctx.item);
    for (let look = 1; look <= max; look++) {
      messages.push({ role: "assistant", content: lastText }, await runner.lookMessage!(ctx, best.grid, env, look, max));
      lastText = await call("workshop-draw", messages, run, round, signal);
      if (isKeepAnswer(lastText)) {
        const note = /"note"\s*:\s*"([^"]*)"/u.exec(lastText)?.[1];
        if (note) best = { ...best, note };
        break;
      }
      const next = parseDrawAnswer(lastText, ctx.palette);
      if (!next.ok || runner.hardCheck(ctx.item, next.grid).length > 0) break;
      best = { grid: next.grid, note: next.note || best.note, topRows: next.topRows ?? best.topRows };
    }
    return best;
  }

  async function contextFor(round: WorkshopRound, run: WorkshopRun, item: WorkshopItem, attempt: number, previousGrid: Grid | null, lastVerdict: Verdict | null, reference: readonly string[] = []): Promise<DrawContext> {
    const feedback = await store.listFeedback(projectKey, item.key);
    const rejected: RejectedSample[] = [];
    for (const entry of feedback.filter((f) => f.verdict === "reject" && f.letter).slice(-4)) {
      const grid = (rounds.get(entry.roundId) ?? (await store.getRound(entry.roundId)))?.runs.find((r) => r.letter === entry.letter)?.grid;
      if (grid) rejected.push({ grid, reasons: entry.reasons, note: entry.note });
    }
    const picked: AnchorSample[] = [];
    for (const pick of await store.listPicks(projectKey)) {
      if (pick.itemKey === item.key) continue;
      const grid = (rounds.get(pick.roundId) ?? (await store.getRound(pick.roundId)))?.runs.find((r) => r.letter === pick.letter)?.grid;
      if (grid) picked.push({ itemKey: pick.itemKey, title: pick.itemKey, grid, picked: true });
    }
    return {
      item,
      palette: runner.palette(item),
      direction: { letter: run.letter, text: run.direction },
      roundNote: round.note,
      redrawNote: run.redrawNote,
      attempt,
      maxAttempts: perItem(runner.maxAttempts ?? MAX_ATTEMPTS, item),
      previousGrid,
      lastVerdict,
      current: runner.currentGrid(item),
      anchors: runner.anchors(item, picked),
      rejected,
      notes: feedback.map((f) => f.note).filter(Boolean).slice(-5),
      reference: reference[0] ?? null,
      references: reference,
      ...(reference.length && round.reference?.colors?.length ? { referenceColors: round.reference.colors } : {}),
    };
  }

  async function runOne(round: WorkshopRound, run: WorkshopRun, signal: AbortSignal): Promise<void> {
    try {
      await runner.prepare(env);
      const defs = await store.listItemDefs(projectKey);
      const item = runner.items(defs).find((candidate) => candidate.key === round.itemKey);
      if (!item) throw new Error(`기물 ${round.itemKey} 를 찾지 못했다`);
      run.status = "drawing";
      run.startedAt = now();
      run.error = null;
      run.errorKind = null;
      void save(round);
      let previousGrid = run.grid;
      // 다시 그리기(redrawRun)는 지난 격자를 출발점으로 넘긴다. 지난 판정은 불통과일 때만 「떨어진 이유」로 넘긴다.
      let lastVerdict: Verdict | null = run.verdict?.verdict === "FAIL" ? run.verdict : null;
      const reference = await referenceFor(round, item, run, signal);
      // 칩셋 출발 그림(object-gen base-from-chipset): 처음 그리는 장이면 그 그림을 출발 격자로 준다. 다시 그리기는 지난 격자에서 출발한다.
      let base: BaseInfo | null = null;
      if (!previousGrid && runner.base) {
        const found = await runner.base(item, env).catch((error) => { console.warn("[workshop] 출발 그림을 못 읽음:", error); return null; });
        if (found) {
          previousGrid = found.grid;
          base = { id: found.id, label: found.label, sources: found.sources };
          run.base = base;
        }
      } else if (run.base) base = run.base;
      const maxAttempts = perItem(runner.maxAttempts ?? MAX_ATTEMPTS, item);
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        run.attempt = attempt;
        run.status = "drawing";
        void save(round);
        const ctx = { ...(await contextFor(round, run, item, attempt, previousGrid, lastVerdict, reference)), ...(base ? { base } : {}) };
        const drawn = await drawOnce(ctx, run, round, signal);
        if ("error" in drawn) {
          run.attempts.push({ attempt, hard: [drawn.error], verdict: null, grid: null });
          if (attempt === maxAttempts) {
            run.status = "failed";
            run.error = `그림을 못 냈다: ${drawn.error}`;
            return;
          }
          continue;
        }
        run.grid = drawn.grid;
        run.note = drawn.note;
        run.topRows = drawn.topRows;
        run.status = "reviewing";
        void save(round);
        const reviewCtx = {
          item, palette: ctx.palette, direction: ctx.direction, attempt, maxAttempts,
          candidate: drawn.grid, current: ctx.current, anchors: ctx.anchors, previousVerdict: lastVerdict,
        };
        let parsed: Verdict | null = runner.review
          ? await runner.review(reviewCtx, env, (reviewMessages) => call("workshop-review", reviewMessages, run, round, signal))
          : null;
        if (!parsed) {
          const reviewText = await call("workshop-review", await runner.reviewMessages(reviewCtx, env), run, round, signal);
          try {
            parsed = runner.parseVerdict(reviewText);
          } catch {
            parsed = { verdict: "FAIL", codes: ["READ"], top: "", topRows: null, reasons: "검수 답을 읽지 못했다", fix: "", worse: false };
          }
        }
        const verdict = runner.gate(item, parsed);
        run.verdict = verdict;
        run.attempts.push({ attempt, hard: [], verdict, grid: drawn.grid });
        if (verdict.verdict === "PASS") break;
        previousGrid = drawn.grid;
        lastVerdict = verdict;
      }
      // 3/4 관문 조언 배지(2026-10-21): 다 그린 후보를 object-gate 규칙으로 한 번 잰다. 굽기를 막지 않는다 — 실패해도 장은 끝난다.
      if (run.grid && runner.adviseMessages && runner.parseAdvice) {
        try {
          const adviceText = await call("workshop-review", await runner.adviseMessages(item, run.grid, runner.palette(item), env), run, round, signal);
          run.gate = runner.parseAdvice(item, adviceText);
        } catch (error) {
          if (isAbort(error) || signal.aborted) throw error;
          run.gate = { state: "refer", kind: "", reasons: [`관문 조언을 못 받음: ${error instanceof Error ? error.message.slice(0, 80) : String(error)}`], topRows: null, readsAs: "" };
        }
      }
      run.status = "done";
    } catch (error) {
      if (isAbort(error) || signal.aborted) {
        // dispose(프로젝트 전환)로 끊긴 장은 취소가 아니다 — 다시 열면 resume 이 잇는다.
        run.status = disposed ? "queued" : "cancelled";
        return;
      }
      const status = statusOf(error);
      if (status === 401 || status === 403) blocked = BLOCKED_AUTH;
      else if (status === 429) blocked = BLOCKED_QUOTA;
      run.status = "failed";
      run.errorKind = runErrorKind(error);
      run.error = isQuotaExhausted(error) ? quotaRunError(error)
        : status === 401 || status === 403 ? "로그인 만료 · AI 설정에서 다시 로그인"
          : error instanceof Error ? error.message : String(error);
    } finally {
      run.finishedAt = now();
      await save(round);
    }
  }

  function enqueue(round: WorkshopRound, letter: string): void {
    rounds.set(round.id, round);
    if (!queue.some((q) => q.roundId === round.id && q.letter === letter)) queue.push({ roundId: round.id, letter });
  }

  const freshRun = (letter: string, direction: string): WorkshopRun => ({
    letter, direction, status: "queued", attempt: 0, attempts: [], grid: null, note: "", topRows: null, verdict: null,
    error: null, errorKind: null, calls: 0, redrawNote: "", startedAt: null, finishedAt: null,
  });

  return {
    async startRound(item, startOptions = {}) {
      blocked = null;
      const round: WorkshopRound = {
        id: newId(), projectKey, harnessId: runner.harnessId, itemKey: item.key, note: startOptions.note ?? "", created: now(),
        runs: runner.directions(item).slice(0, Math.max(1, Math.min(runner.candidates, Math.round(startOptions.count ?? runner.candidates)))).map((d) => freshRun(d.letter, d.text)),
        ...(startOptions.reference === false ? { reference: { status: "none" as const, tries: 0, note: "참고 그림 없이 그림 — 이 판은 참고 단계를 껐다" } } : {}),
      };
      await save(round);
      for (const run of round.runs) enqueue(round, run.letter);
      pump();
      return structuredClone(round);
    },
    async redrawRun(roundId, letter, note) {
      const round = rounds.get(roundId) ?? (await store.getRound(roundId));
      if (!round) throw new Error(`판 ${roundId} 가 없다`);
      // 같은 글자가 진행 중이거나 줄 서 있으면 겹쳐 돌리지 않는다(두 번째 실행이 첫 실행의 취소 줄을 지운다).
      if (running.has(runKey(roundId, letter)) || queue.some((q) => q.roundId === roundId && q.letter === letter)) return;
      const old = runOf(round, letter);
      const run = { ...freshRun(letter, old.direction), grid: old.grid, verdict: old.verdict, redrawNote: note };
      round.runs = round.runs.map((r) => (r.letter === letter ? run : r));
      blocked = null;
      await save(round);
      enqueue(round, letter);
      pump();
    },
    async cancelRound(roundId) {
      const round = rounds.get(roundId) ?? (await store.getRound(roundId));
      if (!round) return;
      for (let i = queue.length - 1; i >= 0; i--) if (queue[i].roundId === roundId) queue.splice(i, 1);
      for (const run of round.runs) {
        const controller = running.get(runKey(roundId, run.letter));
        if (controller) controller.abort();
        else if (run.status === "queued") run.status = "cancelled";
      }
      await save(round);
      settleIdle();
      options.onStatus?.();
    },
    async resume() {
      let count = 0;
      for (const round of await store.listRounds(projectKey)) {
        if (round.harnessId !== runner.harnessId) continue;
        const target = rounds.get(round.id) ?? round;
        let requeued = 0;
        for (const run of target.runs) {
          if (!PENDING.has(run.status) || running.has(runKey(target.id, run.letter))) continue;
          // 지난 시도 기록은 비운다(격자·판정은 남겨 previousGrid·lastVerdict 로 이어진다).
          run.status = "queued";
          run.attempts = [];
          run.attempt = 0;
          run.error = null;
          run.errorKind = null;
          enqueue(target, run.letter);
          requeued += 1;
        }
        count += requeued;
        if (requeued > 0) await save(target);
      }
      pump();
      return count;
    },
    setConcurrency(n) {
      concurrency = clampConcurrency(n);
      pump();
      options.onStatus?.();
    },
    status: () => ({ running: running.size, queued: queue.length, concurrency, blocked }),
    idle: () => new Promise<void>((resolve) => {
      idleWaiters.push(resolve);
      settleIdle();
    }),
    dispose() {
      disposed = true;
      for (const controller of running.values()) controller.abort();
      queue.length = 0;
    },
  };
}
