// 게임 청사진 — 조수가 게임 하나를 짓기 «전에» 쓰는 설계 한 장(2026-10-28 스위트·청사진 방식).
//
// 왜: 게임마다 플레이 판정에서 나온 결함을 사후 검사로 하나씩 막아 왔는데(LEDGER J45~J106), 설계 단계가 없어 같은 종류의
// 결함(엔딩까지 가는 길이 끊김·조건을 켜는 곳이 없음·목표를 모름)이 장르마다 되풀이됐다. 청사진은
//  - 짓기 전에 목표·핵심 경로(장소 → 할 일 → 조건 → 다음 장소)·엔딩·장면마다 의도한 느낌을 적고,
//  - 짓는 동안 모델 지시문 맨 위에 박혀 매 차례 대조되며,
//  - 출하 검사가 이 경로를 데이터로 걸어 본다(src/ai/v2/story/blueprint.ts).
// 판정자(새 플레이어)는 이 문서의 playerGoal 한 줄만 받는다.
// 프로젝트에 함께 저장된다(SQLite current_json·내보내기). 옛 프로젝트는 없음 = 옛 동작.
import { assert, requireArray, requireRecord, requireString } from "./io/guards";

/** 단계에서 플레이어가 하는 일의 종류 — 경로 빌더가 종류마다 다른 이벤트를 짓는다(src/ai/v2/story/blueprintPath.ts). 없으면 낱말로 추정(옛 청사진). */
export const STEP_KINDS = ["talk", "find", "battle", "puzzle", "choice"] as const;
export type GameBlueprintStepKind = (typeof STEP_KINDS)[number];

/**
 * 단계의 글 — build_blueprint_path 가 받은 대사·고를 것을 청사진에 남긴다. 경로를 다시 지어도(한 단계의 대사만 고쳐 불러도, 다음 턴에 불러도)
 * 다른 단계의 대사·고르기·승리 대사를 잃지 않는다(2026-11-10 검토: 한 단계만 준 다시 짓기가 나머지 단계의 고르기와 엔딩 갈래를 지웠다).
 */
export interface GameBlueprintStepText {
  lines?: string[];
  lockedLines?: string[];
  doneLines?: string[];
  /** battle: 이긴 뒤의 말. */
  winLines?: string[];
  wrongLines?: string[];
  /** 번호 자물쇠의 답. */
  code?: string;
  options?: string[];
  /** choice: 고를 것 — lines = 고른 뒤의 답, later = 엔딩 직전에 보이는 그 선택의 결과 한 줄. */
  choices?: { text: string; lines?: string[]; later?: string }[];
}

/**
 * 이 단계로 함수가 실제로 지어 둔 것(build_blueprint_path 가 적는다 — 모델은 쓰지 않는다).
 * 청사진을 다시 써도 같은 단계는 같은 이벤트·같은 스위치를 물려받는다: 이름만 바꾼 다시 쓰기가 사람을 한 명 더 세우지 않고,
 * 그 스위치로 잠가 둔 문·길이 아무도 켜지 않는 스위치를 기다리지 않는다.
 */
export interface GameBlueprintStepBuilt {
  mapId: string;
  eventId: string;
  /** 이 단계의 gives 를 켜는 스위치(gives 가 깃발일 때). */
  switchId?: string;
  /** 이 단계의 gives 로 주는 물건(gives 가 물건일 때). */
  itemId?: string;
}

export interface GameBlueprintStep {
  /** s1, s2 … 순서대로. */
  id: string;
  /** talk = 이름 있는 사람과 대화 · find = 물건·자리를 조사 · battle = 싸워 이긴다 · puzzle = 번호·암호를 맞힌다 · choice = 고르고 결과가 달라진다. */
  kind?: GameBlueprintStepKind;
  /** talk·choice·battle: 그 사람(상대)의 이름 — 말하는 사람 이름과 캐릭터 그림이 된다. */
  who?: string;
  /** 맵 이름(지을 이름 그대로). */
  place: string;
  /** 그 맵 위 이벤트 이름 — 플레이어가 말을 걸거나 조사하는 대상. */
  event: string;
  /** 플레이어가 하는 일(「서연에게 말을 건다」). */
  action: string;
  /** 이 단계가 열리는 조건(사람 말, 첫 단계는 생략). */
  needs?: string;
  /** 이 단계가 남기는 것 — 다음 단계를 여는 열쇠·스위치·호감, 마지막은 엔딩. */
  gives: string;
  /** 이 장면에서 의도한 느낌(설렘·긴장·안도…). */
  feeling: string;
  /** 이 단계 이벤트의 글(build_blueprint_path 가 채운다). */
  text?: GameBlueprintStepText;
  /** 이 단계로 지어 둔 이벤트·스위치(build_blueprint_path 가 채운다). */
  built?: GameBlueprintStepBuilt;
}

/** 이 게임의 장소 하나 — 세계(setting)의 장소 종류(kind)로 함수가 짓는다(src/ai/v2/place/world.ts). */
export interface GameBlueprintPlace {
  /** 맵 이름(steps[].place 가 이 이름을 가리킨다). */
  name: string;
  /** 세계의 장소 종류 id(village·lake·tomb…). */
  kind: string;
  /** 이 장소로 들어오는 앞 장소 이름. 없으면 목록의 바로 앞 장소. */
  from?: string;
}

export interface GameBlueprint {
  version: 1;
  title: string;
  genre: string;
  /** 이 게임의 세계(칩셋 한 벌) id — 게임마다 다른 세계를 고른다(src/ai/v2/place/world.ts). 옛 청사진은 없음 = 장소 이름으로 추정. */
  setting?: string;
  /** 이 게임의 장소 전부(시작 장소가 맨 앞). 옛 청사진은 없음 = steps 의 장소. */
  places?: GameBlueprintPlace[];
  /** 판정자가 받는 유일한 글 — 새 플레이어에게 «무엇을 하면 되는지» 한 줄. */
  playerGoal: string;
  /** 핵심 경로(시작 → 엔딩) 2~12단계. */
  steps: GameBlueprintStep[];
  ending: { name: string; how: string; feeling: string };
  /** 다시 쓴 청사진에서 빠진 단계가 지어 둔 것 — 다음 경로 짓기가 걷어 낸다(그 이벤트, 그 스위치를 기다리는 조건). */
  retired?: GameBlueprintStepBuilt[];
  /** 청사진을 쓴 요청 원문(앞부분). */
  request?: string;
  updatedAt?: string;
}

export const BLUEPRINT_LIMITS = { steps: 12, minSteps: 2, text: 160, goal: 140, request: 600, places: 12 } as const;

function bounded(label: string, value: unknown, max: number): string {
  const text = requireString(label, value).trim();
  assert(text.length > 0, `청사진 ${label} 이 비었다.`);
  assert(text.length <= max, `청사진 ${label} 이 너무 길다(${text.length}자 > ${max}자).`);
  return text;
}

// needs·gives 를 배열(또는 배열을 JSON 글로 감싼 것 — 「[\"첫 번째 단서\"]」·「[]」)로 보내는 모델이 있다(2026-10-28 mt3 argon escape:
// 잠긴 책장이 「[]이(가) 있어야 할 것 같다.」, 단서가 「『[\"첫 번째 단서\"]』을(를) 알아냈다.」로 화면에 그대로 나왔다).
// 사람 말 한 줄로 푼다: 항목은 「, 」로 잇고, 빈 배열은 없음(undefined).
export function blueprintListText(value: unknown): unknown {
  let v = value;
  if (typeof v === "string") {
    const t = v.trim();
    if (/^\[[\s\S]*\]$/u.test(t)) { try { v = JSON.parse(t); } catch { return value; } }
    else return value;
  }
  if (!Array.isArray(v)) return value;
  const parts = v.map((x) => (typeof x === "string" ? x.trim() : typeof x === "number" ? String(x) : "")).filter(Boolean);
  return parts.length ? parts.join(", ") : undefined;
}

const STEP_TEXT_LISTS = ["lines", "lockedLines", "doneLines", "winLines", "wrongLines", "options"] as const;
/** 단계의 글을 저장 모양으로 — 빈 줄을 걷고 길이를 자른다. 남는 것이 없으면 undefined. 모양이 틀려도 던지지 않는다(글은 덧붙임이다). */
export function normalizeStepText(raw: unknown): GameBlueprintStepText | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  const list = (v: unknown, max: number): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()).map((x) => x.trim().slice(0, 400)).slice(0, max) : []);
  const out: GameBlueprintStepText = {};
  for (const key of STEP_TEXT_LISTS) { const got = list(r[key], 8); if (got.length) out[key] = got; }
  if ((typeof r.code === "string" || typeof r.code === "number") && String(r.code).trim()) out.code = String(r.code).trim().slice(0, 24);
  const choices = (Array.isArray(r.choices) ? r.choices : []).flatMap((c) => {
    if (!c || typeof c !== "object") return [];
    const o = c as Record<string, unknown>;
    const text = typeof o.text === "string" ? o.text.trim().slice(0, 80) : "";
    if (!text) return [];
    const lines = list(o.lines, 6);
    const later = typeof o.later === "string" ? o.later.trim().slice(0, 300) : "";
    return [{ text, ...(lines.length ? { lines } : {}), ...(later ? { later } : {}) }];
  }).slice(0, 4);
  if (choices.length) out.choices = choices;
  return Object.keys(out).length ? out : undefined;
}

/** 단계가 지어 둔 것 — 모양이 틀리면 없는 것으로 본다(덧붙임이다, 던지지 않는다). */
export function normalizeStepBuilt(raw: unknown): GameBlueprintStepBuilt | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  const id = (v: unknown): string => (typeof v === "string" && v.trim() && v.length <= 160 ? v.trim() : "");
  const mapId = id(r.mapId), eventId = id(r.eventId), switchId = id(r.switchId), itemId = id(r.itemId);
  return mapId && eventId ? { mapId, eventId, ...(switchId ? { switchId } : {}), ...(itemId ? { itemId } : {}) } : undefined;
}

/** 저장본·모델 입력 둘 다 이 한 곳으로 읽는다. 틀리면 무엇이 틀렸는지 한국어로 던진다. */
export function normalizeGameBlueprint(value: unknown): GameBlueprint {
  const data = requireRecord("gameBlueprint", value);
  assert(data.version === undefined || data.version === 1, "청사진 버전을 읽을 수 없다.");
  const rawSteps = requireArray("gameBlueprint.steps", data.steps);
  assert(rawSteps.length >= BLUEPRINT_LIMITS.minSteps && rawSteps.length <= BLUEPRINT_LIMITS.steps, `청사진 steps 는 ${BLUEPRINT_LIMITS.minSteps}~${BLUEPRINT_LIMITS.steps}단계여야 한다(지금 ${rawSteps.length}).`);
  const seen = new Set<string>();
  const steps = rawSteps.map((raw, i): GameBlueprintStep => {
    const s = requireRecord(`steps[${i}]`, raw);
    const id = s.id === undefined ? `s${i + 1}` : bounded(`steps[${i}].id`, s.id, 12);
    assert(!seen.has(id), `청사진 단계 id 「${id}」가 겹친다.`);
    seen.add(id);
    const needsRaw = blueprintListText(s.needs);
    const givesRaw = blueprintListText(s.gives) ?? s.gives;
    const kind = typeof s.kind === "string" ? STEP_KINDS.find((k) => k === String(s.kind).trim().toLowerCase()) : undefined;
    const who = typeof s.who === "string" ? s.who.trim().slice(0, 40) : "";
    return {
      id,
      ...(kind ? { kind } : {}),
      ...(who ? { who } : {}),
      place: bounded(`steps[${i}].place`, s.place, 60),
      event: bounded(`steps[${i}].event`, s.event, 60),
      action: bounded(`steps[${i}].action`, s.action, BLUEPRINT_LIMITS.text),
      ...(needsRaw === undefined || needsRaw === null || (typeof needsRaw === "string" && !needsRaw.trim()) ? {} : { needs: bounded(`steps[${i}].needs`, needsRaw, BLUEPRINT_LIMITS.text) }),
      gives: bounded(`steps[${i}].gives`, givesRaw, BLUEPRINT_LIMITS.text),
      feeling: bounded(`steps[${i}].feeling`, s.feeling, 60),
      ...(() => { const text = normalizeStepText(s.text); return text ? { text } : {}; })(),
      ...(() => { const built = normalizeStepBuilt(s.built); return built ? { built } : {}; })(),
    };
  });
  const ending = requireRecord("gameBlueprint.ending", data.ending);
  const places = normalizePlaces(data.places);
  return {
    version: 1,
    title: bounded("title", data.title, 60),
    genre: bounded("genre", data.genre, 40),
    ...(typeof data.setting === "string" && data.setting.trim() ? { setting: data.setting.trim().slice(0, 40) } : {}),
    ...(places.length ? { places } : {}),
    playerGoal: bounded("playerGoal", data.playerGoal, BLUEPRINT_LIMITS.goal),
    steps,
    ending: { name: bounded("ending.name", ending.name, 60), how: bounded("ending.how", ending.how, BLUEPRINT_LIMITS.text), feeling: bounded("ending.feeling", ending.feeling, 60) },
    ...(() => { const retired = (Array.isArray(data.retired) ? data.retired : []).flatMap((raw) => { const built = normalizeStepBuilt(raw); return built ? [built] : []; }).slice(0, 40); return retired.length ? { retired } : {}; })(),
    ...(typeof data.request === "string" && data.request.trim() ? { request: data.request.trim().slice(0, BLUEPRINT_LIMITS.request) } : {}),
    ...(typeof data.updatedAt === "string" ? { updatedAt: data.updatedAt } : {}),
  };
}

/**
 * 장소 목록 — 이름이 비었거나 겹치는 항목, 종류가 빈 항목은 뺀다(스키마 칸을 빈 값으로 채워 보내는 모델이 있다). from 은 앞에 나온 장소 이름일 때만 남긴다.
 */
function normalizePlaces(value: unknown): GameBlueprintPlace[] {
  if (!Array.isArray(value)) return [];
  const out: GameBlueprintPlace[] = [];
  for (const raw of value.slice(0, BLUEPRINT_LIMITS.places)) {
    if (!raw || typeof raw !== "object") continue;
    const p = raw as Record<string, unknown>;
    const name = typeof p.name === "string" ? p.name.trim().slice(0, 60) : "";
    const kind = typeof p.kind === "string" ? p.kind.trim().slice(0, 40) : "";
    if (!name || !kind || out.some((o) => o.name === name)) continue;
    const from = typeof p.from === "string" ? p.from.trim() : "";
    out.push({ name, kind, ...(from && from !== name && out.some((o) => o.name === from) ? { from } : {}) });
  }
  return out;
}

/** 지시문 맨 위에 박는 청사진 글(매 차례 같은 모양). */
export function gameBlueprintText(blueprint: GameBlueprint): string {
  return [
    `[이 게임의 청사진 — 짓는 모든 단계는 이 문서의 항목 하나를 구현한다. 바꾸려면 write_blueprint 로 다시 쓴다]`,
    `제목: ${blueprint.title} · 장르: ${blueprint.genre}`,
    `플레이어 목표(새 플레이어가 받는 유일한 안내): ${blueprint.playerGoal}`,
    ...(blueprint.places?.length ? [`장소(세계 ${blueprint.setting ?? "-"}): ${blueprint.places.map((p) => `「${p.name}」=${p.kind}${p.from ? `←「${p.from}」` : ""}`).join(" · ")}`] : []),
    "핵심 경로:",
    ...blueprint.steps.map((s) => `- ${s.id}${s.kind ? `[${s.kind}${s.who ? ` ${s.who}` : ""}]` : ""} 「${s.place}」 이벤트 「${s.event}」: ${s.action}${s.needs ? ` (조건: ${s.needs})` : ""} → ${s.gives} · 느낌: ${s.feeling}`),
    `엔딩 「${blueprint.ending.name}」: ${blueprint.ending.how} · 느낌: ${blueprint.ending.feeling}`,
  ].join("\n");
}
