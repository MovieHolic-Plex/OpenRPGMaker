// 요청 특징 확인표 + 1배 그림 확인 루프 — 짓기 턴에서 「요청한 낱말이 1배 그림으로 읽히나」를 항목마다 본다.
//
// 왜(2026-10-22 조수 시험 #3242): 코딩 에이전트는 같은 세 방을 이름 붙은 특징(둥근 관측 홀·지붕 틈·남쪽 사당·넓은 가운데 홀)마다
// 1배로 확인하며 28바퀴 다듬어 8.1~8.2 를 받았다. 조수는 끝에 한 번, 야외 맵용 빈 바닥·대칭 숫자만 받았고 5~6 에 머물렀다 —
// 남은 major 는 모두 「요청한 그 특징이 1배로 안 읽힌다」였다. 그래서:
//   1. 조수가 짓기 전에 요청 특징을 확인할 수 있는 항목으로 적는다(set_feature_checklist — 패널에 확인표로 보인다).
//   2. 짓고 나면 실행기가 1배 그림(맵 전체 + 좌표를 아는 항목은 그 자리 잘라 낸 그림)을 별도 판정 호출에 보이고 항목마다 읽히는지 묻는다.
//      조수 자신의 「잘 지었다」가 아니라 그림만 본 판정이다. 판정 호출이 그림을 받았는지는 판정자가 센 그림 수로 확인한다.
//   3. 실패 항목은 이유·고치는 법과 함께 조수에게 돌려 다시 짓게 한다(최대 3바퀴). 그 뒤에도 남으면 남은 항목을 그대로 보고하게 한다.
// 빈 바닥(실내)은 판정자 대신 bareFloor.ts 의 보정된 자로 잰 숫자를 항목 하나로 붙인다.

export const FEATURE_REVIEW_MAX_REBUILDS = 3;
/** 턴 시작부터 이 시간 안에 끝나지 않을 고치기 바퀴는 시작하지 않고 남은 항목을 보고한다(방 하나 10분 안팎 목표, 하네스 턴 상한 15분). */
export const FEATURE_REVIEW_SOFT_BUDGET_MS = 12 * 60_000;
const MAX_ITEMS = 8;
export const FEATURE_REVIEW_MAX_CROPS = 4;
const MEASURED_BY_RUNNER = /맨\s*바닥|빈\s*바닥|bare\s*floor|empty\s*floor/iu;

export interface FeatureArea { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
export interface FeatureItem {
  readonly id: string;
  readonly text: string;
  readonly mapId?: string;
  readonly area?: FeatureArea;
  /** judge = 그림 판정, measure = 실행기가 숫자로 잼(빈 바닥). */
  readonly kind: "judge" | "measure";
}
export type FeatureState = "pending" | "pass" | "fail" | "unjudged";
export interface FeatureVerdict { readonly id: string; readonly state: FeatureState; readonly why: string; readonly fix?: string }
export interface FeatureRound {
  readonly round: number;
  readonly verdicts: readonly FeatureVerdict[];
  /** 판정 호출이 받은 그림 수(판정자가 센 값) / 보낸 그림 수. */
  readonly imagesSeen?: number;
  readonly imagesSent: number;
  readonly judge: string;
  readonly ms: number;
}
export interface FeatureChecklistSnapshot {
  readonly items: readonly FeatureItem[];
  readonly rounds: readonly FeatureRound[];
  readonly source: "assistant" | "derived";
  readonly final?: boolean;
}

export const SET_FEATURE_CHECKLIST_DESCRIPTION =
  "짓기 요청(방·건물·실내·장소)을 받으면 첫 쓰기 전에 한 번 부른다. 사용자가 이름 붙인 특징을 1배 그림만 보고 예/아니오로 확인할 수 있는 항목 3~6개로 적는다 " +
  "(빈 바닥·통로·도달은 실행기가 따로 재므로 적지 않는다) " +
  "(예: 「둥근 관측 홀이 둥글게 읽힌다」「망원경 위 지붕 틈이 보인다」「남쪽 사당이 입구가 아니라 사당으로 읽힌다」「가운데 홀이 곁방보다 확실히 크다」). " +
  "물건 이름만 적지 말고 그것이 「어떻게 보여야 하는지」를 적는다. 짓고 나서 다시 불러 항목마다 mapId 와 그 특징이 있는 칸 범위(area)를 채우면 확인할 때 그 자리를 잘라 본다. " +
  "다시 부를 때 이미 적은 항목을 빼거나 낮출 수 없다(같은 id 는 덮어쓴다). 실행기가 짓기 뒤에 1배 그림으로 항목마다 확인하고, 안 읽히는 항목은 고칠 점과 함께 돌려준다.";

export const SET_FEATURE_CHECKLIST_PARAMETERS = {
  type: "object",
  properties: {
    items: {
      type: "array",
      description: "확인 항목 3~6개(최대 8).",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "짧은 영문 id(예: round-hall). 다시 부를 때 같은 id 로 좌표를 채운다." },
          text: { type: "string", description: "1배 그림으로 확인할 문장(한국어)." },
          mapId: { type: "string", description: "그 특징이 있는 맵 id(지은 뒤에 채운다)." },
          x: { type: "integer" }, y: { type: "integer" }, w: { type: "integer" }, h: { type: "integer" },
        },
        required: ["id", "text"],
      },
    },
  },
  required: ["items"],
} as const;

export const FEATURE_CHECKLIST_SYSTEM_PROMPT =
  "[요청 특징 확인표] 방·건물·실내·장소를 짓는 요청이면 첫 쓰기 전에 set_feature_checklist 로 사용자가 이름 붙인 특징을 1배 그림으로 확인할 항목 3~6개로 적는다(물건 이름이 아니라 「어떻게 읽혀야 하는지」). " +
  "지은 뒤 같은 도구로 항목마다 mapId·칸 범위를 채운다. 실행기가 끝에 1배 그림으로 항목마다 확인하고, 안 읽히는 항목은 이유와 함께 돌려준다 — 그때 그 항목만 고쳐 다시 짓는다.";

const clampInt = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.round(v)) : undefined);
const slug = (text: string, i: number) => (text.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "").slice(0, 32) || `item-${i + 1}`);

/** 요청 특징 확인표 — 한 턴 동안 항목과 바퀴별 판정을 들고 있다. 항목 문장은 처음 적은 것이 이긴다(고치기 중에 조건을 낮추지 못하게). */
export class PiFeatureChecklist {
  private items: FeatureItem[] = [];
  private rounds: FeatureRound[] = [];
  private source: "assistant" | "derived" = "assistant";
  private final = false;

  get size(): number { return this.items.filter((i) => i.kind === "judge").length; }
  get judgeItems(): readonly FeatureItem[] { return this.items.filter((i) => i.kind === "judge"); }
  get allItems(): readonly FeatureItem[] { return this.items; }
  get roundCount(): number { return this.rounds.length; }

  /** set_feature_checklist 인자를 받아 반영한다. 반환: 모델에게 돌려줄 글. */
  set(args: unknown, mapExists: (mapId: string) => { width: number; height: number } | undefined, source: "assistant" | "derived" = "assistant"): string {
    const raw = (args && typeof args === "object" ? (args as { items?: unknown }).items : undefined);
    if (!Array.isArray(raw) || !raw.length) throw new Error("items 가 비었다 — 확인 항목 3~6개를 적는다.");
    const notes: string[] = [];
    if (!this.items.some((i) => i.kind === "judge")) this.source = source;
    raw.forEach((entry, index) => {
      const e = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
      const text = typeof e.text === "string" ? e.text.trim().slice(0, 140) : "";
      const id = typeof e.id === "string" && e.id.trim() ? e.id.trim().slice(0, 40) : slug(text, index);
      const existing = this.items.find((i) => i.id === id);
      if (!text && !existing) { notes.push(`${id}: 문장이 없어 뺐다`); return; }
      // 빈 바닥·통행은 실행기가 숫자로 잰다(bareFloor·도달 검사) — 그림 판정 항목으로 두면 판정자 눈과 자가 갈려 고치기 바퀴를 태운다
      // (2026-10-22 여관: 잰 빈 바닥은 통과인데 「맨바닥 ≤15%」 판정 항목이 세 바퀴 내내 실패해 방을 18×16 → 14×14 로 줄였다).
      if (!existing && MEASURED_BY_RUNNER.test(text)) { notes.push(`${id}: 빈 바닥은 실행기가 따로 잰다 — 항목에서 뺐다`); return; }
      const mapId = typeof e.mapId === "string" && e.mapId ? e.mapId : existing?.mapId;
      const size = mapId ? mapExists(mapId) : undefined;
      if (mapId && !size) notes.push(`${id}: 맵 ${mapId} 이 아직 없다 — 지은 뒤 다시 채운다`);
      const [x, y, w, h] = [clampInt(e.x), clampInt(e.y), clampInt(e.w), clampInt(e.h)];
      let area = existing?.area;
      if (x !== undefined && y !== undefined && w && h && size) {
        area = { x: Math.min(x, size.width - 1), y: Math.min(y, size.height - 1), w: Math.min(w, size.width - Math.min(x, size.width - 1)), h: Math.min(h, size.height - Math.min(y, size.height - 1)) };
      }
      // 문장은 처음 적은 것을 지킨다 — 고치기 중에 「둥글게 읽힌다」를 「둥근 깔개가 있다」로 낮추지 못하게.
      const item: FeatureItem = { id, text: existing?.text ?? text, kind: "judge", ...(mapId && size ? { mapId } : {}), ...(area && mapId && size ? { area } : {}) };
      if (existing) {
        if (text && text !== existing.text) notes.push(`${id}: 처음 적은 문장을 유지한다`);
        this.items[this.items.indexOf(existing)] = item;
      } else if (this.size < MAX_ITEMS) this.items.push(item);
      else notes.push(`${id}: 항목이 ${MAX_ITEMS}개를 넘어 뺐다`);
    });
    const list = this.judgeItems.map((i) => `- ${i.id}: ${i.text}${i.mapId ? ` @${i.mapId}${i.area ? ` (${i.area.x},${i.area.y}) ${i.area.w}×${i.area.h}` : ""}` : ""}`).join("\n");
    return `확인표 ${this.size}항목을 적었다. 짓기가 끝나면 실행기가 1배 그림으로 항목마다 확인한다.\n${list}${notes.length ? `\n참고: ${notes.join(" / ")}` : ""}`;
  }

  /** 실행기가 붙이는 그림 판정 항목(방 전체가 읽히는가) — 조수가 낮추거나 뺄 수 없다. */
  ensureRunnerItem(id: string, text: string, mapId?: string): void {
    if (this.items.some((i) => i.id === id)) return;
    this.items.push({ id, text, kind: "judge", ...(mapId ? { mapId } : {}) });
  }

  /** 실행기가 잰 항목(빈 바닥 등)을 붙이거나 갱신한다. */
  setMeasured(item: Omit<FeatureItem, "kind">): void {
    const next: FeatureItem = { ...item, kind: "measure" };
    const at = this.items.findIndex((i) => i.id === item.id);
    if (at >= 0) this.items[at] = next; else this.items.push(next);
  }

  record(round: Omit<FeatureRound, "round">): FeatureRound {
    const full = { ...round, round: this.rounds.length + 1 };
    this.rounds.push(full);
    return full;
  }
  finish(): void { this.final = true; }
  latest(): FeatureRound | undefined { return this.rounds[this.rounds.length - 1]; }
  snapshot(): FeatureChecklistSnapshot {
    return { items: this.items.map((i) => ({ ...i })), rounds: this.rounds.map((r) => ({ ...r, verdicts: r.verdicts.map((v) => ({ ...v })) })), source: this.source, ...(this.final ? { final: true } : {}) };
  }
}

/** 확인표 한 줄 요약 — 상태줄·활동 기록용. */
export function featureChecklistSummary(snapshot: FeatureChecklistSnapshot): string {
  const last = snapshot.rounds[snapshot.rounds.length - 1];
  const state = (id: string) => last?.verdicts.find((v) => v.id === id)?.state ?? "pending";
  const mark: Record<FeatureState, string> = { pending: "□", pass: "✓", fail: "✗", unjudged: "?" };
  const head = last ? `확인 ${last.round}바퀴` : "확인표";
  return `${head}: ${snapshot.items.map((i) => `${mark[state(i.id)]} ${i.text}`).join(" · ")}`;
}

export interface FeatureJudgeImage { readonly label: string; readonly dataUrl: string }

/** 판정 호출의 지시문 — 그림만 보고, 1배에서 처음 보는 사람이 알아보는지로 가린다. */
export function featureJudgePrompt(task: string, items: readonly FeatureItem[], images: readonly FeatureJudgeImage[], derive: boolean): string {
  const legend = images.map((img, i) => `[그림 ${i + 1}] ${img.label}`).join("\n");
  const list = items.map((i) => `- ${i.id}: ${i.text}${i.mapId ? ` (맵 ${i.mapId}${i.area ? `, 칸 (${i.area.x},${i.area.y}) ${i.area.w}×${i.area.h}` : ""})` : ""}`).join("\n");
  return [
    "You are a strict, independent visual reviewer for a 16px top-down (3/4 view) RPG map editor. You did NOT build these maps and you owe the builder nothing.",
    "Judge only whether each feature visibly reads. Ignore claims about walkability, reachability or bare-floor percentages inside an item — the runner measures those separately.",
    "Judge ONLY from the attached images (the real map rendered at about 1x; some are crops of one feature at 2x). There are no labels in the game — a feature that only exists in a name, a plan or a description does not count.",
    "Be adversarial: builders over-claim, and a lenient pass here ships a room that a strict reviewer scores 5/10. When in doubt, fail.",
    "For each checklist item decide: would a first-time player looking at the 1x full-map image recognise it without being told? Pass only if it clearly reads. A tiny 1-tile stand-in for a big hero object, a shape that reads as a square when 'round' was asked, a 'shrine' that reads as an entrance or corridor, a 'large hall' no larger than side rooms, or a feature hidden in a dark corner: fail.",
    "For each failing item give why (what is actually visible, with tile coordinates if you can) and ONE concrete layout fix the builder can make. The builder cannot draw new art or cut holes into the void: fixes must change the room plan shape or size, positions, framing (walls, pillars, dais with front riser, rugs, paired statues/lights) or swap in a larger existing piece. Do not suggest changing the request.",
    derive ? "No checklist was written. FIRST derive 3-6 checklist items from the user's request (things the user explicitly named, phrased as how they must read at 1x, in Korean), then judge them." : "",
    "",
    `User request: ${task.slice(0, 1200)}`,
    "",
    "Images:",
    legend,
    "",
    derive ? "" : `Checklist:\n${list}`,
    "",
    "Answer every checklist id exactly as written (copy the id string).",
    `Reply with JSON only: {"imagesSeen": <how many images you actually received>, "images": ["<one short phrase describing each image>"], ${derive ? `"items": [{"id": "short-id", "text": "항목(한국어)", "mapId": "...", "pass": true|false, "why": "한국어", "fix": "한국어"}]` : `"items": [{"id": "<checklist id>", "pass": true|false, "why": "한국어 한 줄", "fix": "한국어 한 줄(실패만)"}]`}}`,
  ].filter((line) => line !== "").join("\n");
}

export interface ParsedFeatureJudge {
  readonly verdicts: FeatureVerdict[];
  readonly imagesSeen?: number;
  readonly derived?: { id: string; text: string; mapId?: string }[];
  readonly problem?: string;
}

export function parseFeatureJudge(text: string, items: readonly FeatureItem[], imagesSent: number, derive: boolean): ParsedFeatureJudge {
  const match = text.match(/\{[\s\S]*\}/u)?.[0];
  let parsed: { imagesSeen?: unknown; items?: unknown } | null = null;
  try { parsed = match ? JSON.parse(match) : null; } catch { parsed = null; }
  const unjudged = (problem: string): ParsedFeatureJudge => ({ verdicts: items.map((i) => ({ id: i.id, state: "unjudged", why: problem })), problem });
  if (!parsed || !Array.isArray(parsed.items)) return unjudged("판정 응답을 읽지 못했다");
  const imagesSeen = typeof parsed.imagesSeen === "number" ? parsed.imagesSeen : undefined;
  // 그림이 실제로 판정자에게 갔는지 — 판정자가 센 수가 보낸 수보다 적으면 판정을 쓰지 않는다(그림 없이 글만 보고 한 판정).
  if (imagesSeen === undefined || imagesSeen < imagesSent) return { ...unjudged(`판정자가 그림 ${imagesSeen ?? "?"}장만 받았다(보낸 그림 ${imagesSent}장) — 그림 없는 판정은 쓰지 않는다`), ...(imagesSeen !== undefined ? { imagesSeen } : {}) };
  const rows = parsed.items as Array<Record<string, unknown>>;
  if (derive) {
    const derived = rows.filter((r) => typeof r.text === "string" && r.text).slice(0, MAX_ITEMS)
      .map((r, i) => ({ id: typeof r.id === "string" && r.id ? r.id.slice(0, 40) : `item-${i + 1}`, text: String(r.text).slice(0, 140), ...(typeof r.mapId === "string" && r.mapId ? { mapId: r.mapId } : {}) }));
    const verdicts = derived.map((d) => {
      const r = rows.find((row) => row.id === d.id) ?? {};
      return verdictOf(d.id, r);
    });
    return { verdicts, imagesSeen, derived };
  }
  const verdicts = items.map((item) => {
    const r = rows.find((row) => row.id === item.id);
    return r ? verdictOf(item.id, r) : { id: item.id, state: "unjudged" as const, why: "판정자가 이 항목을 답하지 않았다" };
  });
  return { verdicts, imagesSeen };
}

function verdictOf(id: string, r: Record<string, unknown>): FeatureVerdict {
  const why = typeof r.why === "string" ? r.why.slice(0, 300) : "";
  const fix = typeof r.fix === "string" && r.fix.trim() ? r.fix.slice(0, 300) : undefined;
  if (r.pass === true) return { id, state: "pass", why };
  if (r.pass === false) return { id, state: "fail", why, ...(fix ? { fix } : {}) };
  return { id, state: "unjudged", why: why || "판정이 예/아니오가 아니다" };
}

/** 실패 항목을 고치게 하는 프롬프트. */
export function featureRepairPrompt(round: number, maxRebuilds: number, items: readonly FeatureItem[], verdicts: readonly FeatureVerdict[]): string {
  const failing = verdicts.filter((v) => v.state === "fail");
  const passing = verdicts.filter((v) => v.state === "pass").map((v) => items.find((i) => i.id === v.id)?.text ?? v.id);
  const lines = failing.map((v) => {
    const item = items.find((i) => i.id === v.id);
    return `- ✗ ${item?.text ?? v.id}${item?.mapId ? ` [${item.mapId}${item.area ? ` (${item.area.x},${item.area.y}) ${item.area.w}×${item.area.h}` : ""}]` : ""} — 보이는 것: ${v.why}${v.fix ? ` · 고칠 점: ${v.fix}` : ""}`;
  });
  return `[1배 특징 확인 ${round}바퀴] 지은 맵을 1배 그림으로 항목마다 확인했더니 다음 항목이 1배에서 읽히지 않는다(고치기 ${round}/${maxRebuilds}).\n`
    + lines.join("\n") + "\n"
    + (passing.length ? `이미 읽히는 항목(바꾸지 마라): ${passing.join(" · ")}\n` : "")
    + "고치는 법: 실패 항목만 고친다. 그 맵을 지은 짓기 도구를 같은 mapId 로 한 번 다시 부른다(손 도트 실내면 build_hand_interior_room replace:true) — 평면(plan) 모양·방 크기·위치를 바꾸거나 큰 조각·단·앞 턱을 쓴다. "
    + "작은 물건을 흩뿌려 메우거나 stamp_object 를 수십 번 낱개로 부르지 않는다(2026-10-22 도서관: 고치기 세 바퀴에 낱개 찍기 111번, 15분). "
    + "빈 바닥이면 그 빈 띠를 평면에서 '#' 로 들여 방을 좁히거나 그 자리에 쓰임 있는 가구 한 벌을 둔다. 그런 그림이 칩셋에 없으면 흉내 내지 말고 없다고 보고한다. "
    + "고친 뒤 show_map_region 으로 전체를 보고, 항목 자리가 바뀌었으면 set_feature_checklist 로 area 를 갱신한다. 실행기가 다시 1배로 확인한다.";
}

/** 바퀴를 다 쓰고도 남은 항목 — 더 고치지 말고 그대로 보고하게 한다. */
export function featureShortfallPrompt(items: readonly FeatureItem[], verdicts: readonly FeatureVerdict[], reason: string): string {
  const left = verdicts.filter((v) => v.state !== "pass").map((v) => {
    const item = items.find((i) => i.id === v.id);
    return `- ${v.state === "fail" ? "✗" : "?"} ${item?.text ?? v.id}: ${v.why}`;
  });
  return `[1배 특징 확인 — 마지막] ${reason} 다음 항목이 1배 그림에서 아직 읽히지 않는다:\n${left.join("\n")}\n`
    + "더 고치지 마라. 사용자에게 줄 최종 보고에 확인표를 그대로 옮겨 읽히는 항목과 안 읽히는 항목을 나눠 적는다. 「모두 완성」「요청대로 지었다」라고 쓰지 마라.";
}

// ── 독립 비평가(vqa-rubric 축 1·2·6) ─────────────────────────────────────────────
// 왜(2026-10-22): 확인표 판정자는 조수가 적은 항목만 본다 — 조수가 안 적은 결함(쓰임 없는 구역, 시점 섞임, 문 자리)은 못 잡는다.
// 코딩 에이전트도 초반엔 스스로 판정해서 약했고, 검수 점수가 오른 건 앞 판·추론을 안 본 별도 검수자가 큰 결함을 좌표로 짚은 뒤였다.
// 그래서 끝 검토에 별도 호출 하나를 둔다: 요청 원문과 1배 그림만 받고(짓기 추론·확인표·앞 점수 없음), 루브릭 축 1·2·6 점수와
// 좌표 붙은 major 목록을 낸다. 조수는 그 목록으로 고친다.

export interface CriticMajor { readonly axis: 1 | 2 | 6; readonly x?: number; readonly y?: number; readonly w?: number; readonly h?: number; readonly what: string; readonly fix?: string }
export interface CriticVerdict {
  readonly mapId: string;
  readonly score?: number;
  readonly axes?: { readonly composition?: number; readonly view?: number; readonly doors?: number };
  readonly majors: readonly CriticMajor[];
  readonly imagesSeen?: number;
  readonly problem?: string;
}
/** 비평가 점수는 참고로만 적는다 — 통과는 「major 0」 하나다.
 * 보정(2026-10-22, 같은 렌더러의 1배 그림 한 장씩): 폴른 r28 세 방(앞 Opus 검수 8.1~8.2)과 조수 #3242 3차(5~6)를
 * 이 지시문으로 매겼더니 Sonnet 6·6·7.6 대 6·7.6·7, Opus 6·6.7·7 대 5.7·7·7.3 — 그림 한 장 절대 점수는 두 판을 가르지 못했다.
 * 반면 major 목록(좌표·고칠 점)은 r28 성문 방 단 앞 검은 띠처럼 실제 결함을 짚었다. 그래서 점수 문턱 대신 major 0 을 통과로 본다. */

export function featureCriticPrompt(task: string, mapName: string, cells: { width: number; height: number }, imagePx: { width: number; height: number } | undefined): string {
  const scale = imagePx ? ` The image is ${imagePx.width}×${imagePx.height}px, so one cell is about ${(imagePx.width / cells.width).toFixed(1)}px; give coordinates in CELLS (x from the left, y from the top, 0-based).` : " Give coordinates in CELLS (x from the left, y from the top, 0-based).";
  return [
    "You are a fresh, adversarial visual QA reviewer for a 16px 3/4-view (top-down JRPG) game map. You have never seen this map, its build notes or any earlier score. Score it once, strictly.",
    "Rubric (fixed). Severity: major = an ordinary player notices it immediately and it reads as cheap or buggy (half the room is empty floor or black void, a zone with no readable purpose, wrong-view or clashing art, a door/stair that reads wrong, a requested hero feature that does not read). minor = polish gap only seen when looking for it.",
    "Anchors per axis: 10 commercial release · 8 commercial indie, only a few minors · 6 works but amateur, 1-2 majors · 4 several majors · 2 broken. Any major on an axis caps that axis at 6. Overall = min(lowest axis + 1, mean) — it is NOT the mean.",
    "Axis 1 Map composition: every space has a readable purpose; empty floor or black void ≤ 15% of the screen; props make sense together and for the requested place.",
    "Axis 2 View and palette consistency: all art shares the same 3/4 view and palette feel.",
    "Axis 6 Doors and stairs: the exit door reads as a door in a wall; stairs face the way they lead.",
    "Genre conventions (do NOT count these as majors): an interior is drawn as a room shape inside a black map; black OUTSIDE the room's outer wall outline is the off-screen exterior, not void — count void only for black or bare holes INSIDE the room's outline, or when the room fills only a small part of the frame. The standard interior exit is an opening or mat in the south wall at the bottom edge that leads off the map; that reads as a door. A room may be non-rectangular.",
    `Map: ${mapName}, ${cells.width}×${cells.height} cells, rendered at about 1x.${scale}`,
    `What the user asked for: ${task.slice(0, 1200)}`,
    "List EVERY major with the cell rectangle it covers and ONE concrete layout fix. The builder cannot draw new art or cut holes into the void: fixes must change the room plan (shape, size, narrowing an empty strip with wall), positions, framing (walls, pillars, dais with a front riser, rugs, paired statues or lights) or swap in a larger existing piece. Do not suggest changing the request.",
    'Reply with JSON only: {"imagesSeen": <number of images you received>, "axes": {"composition": n, "view": n, "doors": n}, "score": n, "majors": [{"axis": 1|2|6, "x": n, "y": n, "w": n, "h": n, "what": "한국어 한 줄 — 보이는 것", "fix": "한국어 한 줄"}], "minors": ["한국어 한 줄"]}',
  ].join("\n");
}

export function parseFeatureCritic(text: string, mapId: string, imagesSent: number): CriticVerdict {
  const match = text.match(/\{[\s\S]*\}/u)?.[0];
  let parsed: Record<string, unknown> | null = null;
  try { parsed = match ? JSON.parse(match) as Record<string, unknown> : null; } catch { parsed = null; }
  if (!parsed) return { mapId, majors: [], problem: "비평 응답을 읽지 못했다" };
  const imagesSeen = typeof parsed.imagesSeen === "number" ? parsed.imagesSeen : undefined;
  if (imagesSeen === undefined || imagesSeen < imagesSent) return { mapId, majors: [], ...(imagesSeen !== undefined ? { imagesSeen } : {}), problem: `비평가가 그림 ${imagesSeen ?? "?"}장만 받았다(보낸 그림 ${imagesSent}장)` };
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
  const axesRaw = (parsed.axes ?? {}) as Record<string, unknown>;
  const axes = { composition: num(axesRaw.composition), view: num(axesRaw.view), doors: num(axesRaw.doors) };
  const majors = (Array.isArray(parsed.majors) ? parsed.majors as Array<Record<string, unknown>> : []).filter((m) => typeof m.what === "string" && m.what).slice(0, 8).map((m): CriticMajor => {
    const axis = m.axis === 2 ? 2 : m.axis === 6 ? 6 : 1;
    const x = clampInt(m.x), y = clampInt(m.y), w = clampInt(m.w), h = clampInt(m.h);
    return { axis, ...(x !== undefined ? { x } : {}), ...(y !== undefined ? { y } : {}), ...(w !== undefined ? { w } : {}), ...(h !== undefined ? { h } : {}), what: String(m.what).slice(0, 240), ...(typeof m.fix === "string" && m.fix ? { fix: m.fix.slice(0, 240) } : {}) };
  });
  const scored = [axes.composition, axes.view, axes.doors].filter((v): v is number => v !== undefined);
  const capped = scored.length ? Math.min(Math.min(...scored) + 1, scored.reduce((a, b) => a + b, 0) / scored.length) : undefined;
  const score = num(parsed.score) !== undefined ? Math.min(num(parsed.score)!, capped ?? 10) : capped;
  return { mapId, ...(score !== undefined ? { score: Math.round(score * 10) / 10 } : {}), axes, majors, imagesSeen };
}

/** 비평 결과를 확인표 한 줄(critic:<mapId>)로 — 점수가 통과선 미만이거나 major 가 있으면 실패. */
export function criticToVerdict(itemId: string, critic: CriticVerdict): FeatureVerdict {
  if (critic.problem || critic.score === undefined) return { id: itemId, state: "unjudged", why: critic.problem ?? "점수가 없다" };
  const where = (m: CriticMajor) => (m.x !== undefined && m.y !== undefined ? ` (${m.x},${m.y})${m.w && m.h ? ` ${m.w}×${m.h}` : ""}` : "");
  const majors = critic.majors.map((m) => `축${m.axis}${where(m)} ${m.what}`).join(" / ");
  const fixes = critic.majors.filter((m) => m.fix).map((m) => `${where(m).trim() || `축${m.axis}`}: ${m.fix}`).join(" / ");
  const pass = critic.majors.length === 0;
  return pass
    ? { id: itemId, state: "pass", why: `독립 비평 major 0 (참고 점수 ${critic.score})` }
    : { id: itemId, state: "fail", why: `독립 비평(참고 점수 ${critic.score}) — major ${critic.majors.length}: ${majors || "(목록 없음, 점수 미달)"}`.slice(0, 600), ...(fixes ? { fix: fixes.slice(0, 600) } : {}) };
}

// ── 다듬기 모드 ─────────────────────────────────────────────────────────────────
/** 다듬기 실행 설정 — 패널의 「다듬기」 단추가 싣는다(PiAgentRequest.polish). */
export interface FeaturePolishOptions {
  /** 고치기 바퀴 상한(1~20). */
  readonly maxRounds: number;
  /** 작업 시간 한도(ms) — 이 안에 끝나지 않을 바퀴는 시작하지 않는다. */
  readonly budgetMs: number;
  /** 처음 사용자가 요청한 문장 — 판정자·비평가가 이 요청에 비춰 본다. */
  readonly request: string;
}
export const FEATURE_POLISH_DEFAULT: Omit<FeaturePolishOptions, "request"> = { maxRounds: 8, budgetMs: 30 * 60_000 };

export function featurePolishSystemPrompt(polish: FeaturePolishOptions): string {
  return `[다듬기 모드] 이번 실행은 이미 지은 맵을 다듬는 실행이다(최대 ${polish.maxRounds}바퀴 · ${Math.round(polish.budgetMs / 60_000)}분). `
    + "처음 차례에는 아무것도 짓거나 고치지 마라: show_map_region 으로 맵을 보고, 아직 확인표가 없으면 set_feature_checklist 로 처음 요청의 특징을 적은 뒤 짧게 끝낸다. "
    + "그다음 실행기가 1배 확인과 독립 비평을 돌려 고칠 목록을 주면 그 목록만 고친다. 맵을 새로 만들거나 다른 맵을 건드리지 않는다.\n"
    + `처음 요청: ${polish.request.slice(0, 1200)}`;
}
