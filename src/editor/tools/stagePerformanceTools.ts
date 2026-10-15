/**
 * author_stage_performance — 무대 공연(오페라·콘서트·연극) 컷신 저작 (2026-10-15, FF6급 감사 #31).
 *
 * 배경: FF6 오페라 장면은 «가사 자막이 박자에 맞춰 흐르고, 합창이 겹치고, 배경이 막마다 바뀌고, 주인공에게 조명이 떨어지는»
 * 한 장면이다. script_cutscene 비트로는 가능하지만 박자표(시각)를 모델이 직접 계산하고 자막 그릇·조명 색조·배경 전환을
 * 일일이 조립해야 해서 한 번도 제대로 나오지 않았다. 이 도구는 막(act) 목록을 받아 시각표를 코드가 계산하고,
 * 기존 컷신 비트(say·background·tint·look·particles·music…)로 컴파일해 script_cutscene 의 검증·커밋 경로를 그대로 지난다.
 * 새 그림·새 소리는 만들지 않는다 — 배경은 이미 있는 먼 배경 리소스, 소리는 이미 있는 BGM/SE 리소스만 쓴다.
 *
 * 막 종류: backdrop(배경 전환) · curtain(막 닫기·열기) · spotlight(조명) · lyric(가사 자막) · chorus(합창) · cue(효과) · music · pause.
 */
import type { Project } from "@/project/types";
import type { CutsceneBeat } from "@/editor/cutscene";
import { EVENT_TOOLS } from "./eventTools";
import { requireMap } from "./mapHelpers";
import { ToolError, type JsonSchema, type ToolDefinition, type ToolExecResult } from "./types";

type Raw = Record<string, unknown>;

const SCRIPT_CUTSCENE = EVENT_TOOLS.find((tool) => tool.name === "script_cutscene");

const ACT_KINDS = ["backdrop", "curtain", "spotlight", "lyric", "chorus", "cue", "music", "pause"] as const;
type ActKind = (typeof ACT_KINDS)[number];

const ACT_KEYS: Readonly<Record<ActKind, readonly string[]>> = {
  backdrop: ["act", "imageId", "flowPercent", "durationMs", "tint"],
  curtain: ["act", "state", "durationMs"],
  spotlight: ["act", "performer", "on", "dim", "durationMs", "sparkle"],
  lyric: ["act", "lines", "text", "ms", "performer", "speaker"],
  chorus: ["act", "voices", "staggerMs", "holdMs"],
  cue: ["act", "effect", "performer", "x", "y", "durationMs"],
  music: ["act", "action", "resourceId", "durationMs", "loop"],
  pause: ["act", "ms"],
};

const CUE_PARTICLES = ["sparkle", "magic", "heal", "fire", "smoke", "dust", "explosion", "splash"] as const;
const CUE_SCREEN = ["flash", "shake"] as const;

/** 자막 한 줄이 화면에 남는 시간(ms) — 코너 대사의 수명 공식(src/player/dialogue.ts showAmbient)과 같다. */
export function cornerLifetimeMs(text: string): number {
  return Math.min(7000, Math.max(2200, 1600 + Array.from(text).length * 90));
}

const MAX_TOTAL_MS = 10 * 60 * 1000;
const MAX_ACTS = 120;
const MAX_CHORUS_VOICES = 3; // 코너 대사는 한 번에 3줄까지만 쌓인다.

function reject(message: string, code = "invalid-args"): never {
  throw new ToolError(message, { code });
}

function posInt(value: unknown, label: string, min: number, max: number, fallback?: number): number {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value)) reject(`${label} 는 숫자여야 한다.`);
  if (value < min || value > max) reject(`${label} 는 ${min}~${max} 사이여야 한다(받은 값 ${value}).`);
  return Math.round(value);
}

function str(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) reject(`${label} 가 비었다 — 문자열이 필요하다.`);
  return value.trim();
}

interface TimelineEntry { readonly act: number; readonly kind: ActKind; readonly startMs: number; readonly endMs: number; readonly note?: string }

export interface PerformanceCompile {
  readonly beats: CutsceneBeat[];
  readonly timeline: TimelineEntry[];
  readonly totalMs: number;
  readonly lyricLines: number;
  readonly warnings: string[];
}

/** 막 목록 → 컷신 비트 + 시각표. 순수 함수(프로젝트 접근 없음, 자원 존재 검사는 호출자가 한다). */
export function compilePerformance(rawActs: unknown, options: { readonly letterbox: boolean; readonly curtainRise: boolean; readonly leaveDark?: boolean }): PerformanceCompile {
  if (!Array.isArray(rawActs) || rawActs.length === 0) reject("acts 에 막을 1개 이상 준다(예: [{act:'backdrop',imageId:'…'},{act:'lyric',lines:[{text:'…'}]}]).");
  if (rawActs.length > MAX_ACTS) reject(`acts 는 최대 ${MAX_ACTS}개다(받은 ${rawActs.length}개) — 장면을 둘로 나눠 두 번 불러라.`);
  const beats: CutsceneBeat[] = [];
  const timeline: TimelineEntry[] = [];
  const warnings: string[] = [];
  let t = 0;
  let lyricLines = 0;
  let spot: string | undefined;
  let tinted = false; // 화면 색조가 남아 있나(막 닫기·분위기 색) — 컷신이 끝나도 색조는 남는다.

  if (options.letterbox) beats.push({ kind: "letterbox", show: true, size: 10, durationMs: 400 });
  if (options.curtainRise) {
    beats.push({ kind: "tint", color: "neutral", value: "0,0,0,1", durationMs: 0 });
    beats.push({ kind: "tint", color: "neutral", value: "", durationMs: 900, wait: true });
    t += 900;
  }

  const push = (index: number, kind: ActKind, durationMs: number, note?: string): void => {
    timeline.push({ act: index, kind, startMs: t, endMs: t + durationMs, ...(note ? { note } : {}) });
    t += durationMs;
  };

  rawActs.forEach((raw, index) => {
    const path = `acts[${index}]`;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) reject(`${path} 는 {act:…} 객체여야 한다.`);
    const act = raw as Raw;
    const kind = act.act;
    if (typeof kind !== "string" || !(ACT_KINDS as readonly string[]).includes(kind)) {
      reject(`${path}.act 는 ${ACT_KINDS.join(" | ")} 중 하나여야 한다(받은 값 ${JSON.stringify(kind)}).`);
    }
    const allowed = ACT_KEYS[kind as ActKind];
    const extra = Object.keys(act).filter((key) => !allowed.includes(key));
    if (extra.length) reject(`${path}(${kind}) 가 모르는 인자: ${extra.join(", ")} — 있는 것: ${allowed.join(", ")}.`);

    switch (kind as ActKind) {
      case "backdrop": {
        const ms = posInt(act.durationMs, `${path}.durationMs`, 0, 30000, 0);
        if (act.imageId === undefined && act.flowPercent === undefined && act.tint === undefined) {
          reject(`${path}(backdrop) 에 imageId(먼 배경 리소스) · flowPercent · tint 중 하나는 있어야 한다.`);
        }
        if (act.imageId !== undefined || act.flowPercent !== undefined) {
          beats.push({
            kind: "background",
            ...(act.imageId !== undefined ? { imageId: str(act.imageId, `${path}.imageId`) } : {}),
            ...(act.flowPercent !== undefined ? { flowPercent: posInt(act.flowPercent, `${path}.flowPercent`, 0, 400) } : {}),
            durationMs: ms, wait: ms > 0,
          });
        }
        if (act.tint !== undefined) tinted = true;
        if (act.tint !== undefined) beats.push({ kind: "tint", color: "neutral", value: str(act.tint, `${path}.tint`), durationMs: ms, wait: ms > 0 && act.imageId === undefined });
        push(index, "backdrop", ms, typeof act.imageId === "string" ? act.imageId : undefined);
        break;
      }
      case "curtain": {
        if (act.state !== "close" && act.state !== "open") reject(`${path}.state 는 close | open 이다.`);
        const ms = posInt(act.durationMs, `${path}.durationMs`, 100, 10000, 1200);
        tinted = act.state === "close";
        beats.push({ kind: "tint", color: "neutral", value: act.state === "close" ? "0,0,0,0.95" : "", durationMs: ms, wait: true });
        push(index, "curtain", ms, String(act.state));
        break;
      }
      case "spotlight": {
        const on = act.on !== false;
        const performer = typeof act.performer === "string" && act.performer.trim() ? act.performer.trim() : "player";
        const ms = posInt(act.durationMs, `${path}.durationMs`, 0, 10000, 500);
        if (on) {
          const dim = typeof act.dim === "number" ? Math.min(0.85, Math.max(0.1, act.dim)) : 0.55;
          tinted = true;
          beats.push({ kind: "tint", color: "neutral", value: `8,8,28,${dim}`, durationMs: ms, wait: false });
          beats.push({ kind: "look", target: performer, tint: "none", alpha: 1, afterimage: true });
          if (act.sparkle !== false) beats.push({ kind: "particles", preset: "sparkle", target: performer, durationMs: Math.max(900, ms) });
          spot = performer;
        } else {
          tinted = false;
          beats.push({ kind: "tint", color: "neutral", value: "", durationMs: ms, wait: false });
          beats.push({ kind: "look", target: spot ?? performer, reset: true });
          spot = undefined;
        }
        push(index, "spotlight", ms, `${performer} ${on ? "on" : "off"}`);
        break;
      }
      case "lyric": {
        const speakerName = typeof act.speaker === "string" && act.speaker.trim() ? act.speaker.trim() : undefined;
        const defaults = { ms: act.ms, performer: act.performer };
        const lines: { text: string; ms?: unknown; performer?: unknown }[] = Array.isArray(act.lines)
          ? (act.lines as unknown[]).map((entry, lineIndex) => {
              if (typeof entry === "string") return { text: entry };
              if (!entry || typeof entry !== "object") reject(`${path}.lines[${lineIndex}] 는 문자열 또는 {text,ms?,performer?} 여야 한다.`);
              const rec = entry as Raw;
              const bad = Object.keys(rec).filter((key) => !["text", "ms", "performer"].includes(key));
              if (bad.length) reject(`${path}.lines[${lineIndex}] 가 모르는 인자: ${bad.join(", ")} — 있는 것: text, ms, performer.`);
              return { text: str(rec.text, `${path}.lines[${lineIndex}].text`), ms: rec.ms, performer: rec.performer };
            })
          : typeof act.text === "string" ? [{ text: str(act.text, `${path}.text`) }] : [];
        if (lines.length === 0) reject(`${path}(lyric) 에 lines:[{text,ms?}] 또는 text 가 필요하다.`);
        lines.forEach((line, lineIndex) => {
          const life = cornerLifetimeMs(line.text);
          const ms = posInt(line.ms ?? defaults.ms, `${path}.lines[${lineIndex}].ms`, 300, 20000, life);
          const performer = typeof (line.performer ?? defaults.performer) === "string" ? String(line.performer ?? defaults.performer).trim() : "";
          if (ms > life + 400) warnings.push(`${path}.lines[${lineIndex}] 「${line.text.slice(0, 12)}…」 ${ms}ms — 자막은 최대 ${life}ms 뒤에 사라져 ${ms - life}ms 동안 빈 화면이 된다(줄을 나누거나 ms 를 줄여라).`);
          beats.push({ kind: "say", text: line.text, context: "narration", container: "corner", ...(speakerName ? { speaker: speakerName } : {}) });
          if (performer) beats.push({ kind: "emote", target: performer, emote: "music", durationMs: Math.min(ms, 2000) });
          beats.push({ kind: "wait", ms });
          push(index, "lyric", ms, line.text.slice(0, 24));
          lyricLines += 1;
        });
        break;
      }
      case "chorus": {
        if (!Array.isArray(act.voices) || act.voices.length < 2) reject(`${path}(chorus) voices 는 2~${MAX_CHORUS_VOICES}개 {speaker,text}여야 한다(합창 = 겹치는 목소리).`);
        if (act.voices.length > MAX_CHORUS_VOICES) reject(`${path}.voices 는 최대 ${MAX_CHORUS_VOICES}개다 — 화면 구석 자막은 한 번에 ${MAX_CHORUS_VOICES}줄까지만 쌓인다. 합창을 둘로 나눠 두 막으로.`);
        const stagger = posInt(act.staggerMs, `${path}.staggerMs`, 0, 3000, 450);
        const voices = (act.voices as unknown[]).map((entry, voiceIndex) => {
          if (!entry || typeof entry !== "object" || Array.isArray(entry)) reject(`${path}.voices[${voiceIndex}] 는 {speaker,text} 객체여야 한다.`);
          const rec = entry as Raw;
          const bad = Object.keys(rec).filter((key) => !["speaker", "text", "performer"].includes(key));
          if (bad.length) reject(`${path}.voices[${voiceIndex}] 가 모르는 인자: ${bad.join(", ")} — 있는 것: speaker, text, performer.`);
          return { speaker: str(rec.speaker, `${path}.voices[${voiceIndex}].speaker`), text: str(rec.text, `${path}.voices[${voiceIndex}].text`), performer: typeof rec.performer === "string" ? rec.performer.trim() : "" };
        });
        const longest = Math.max(...voices.map((voice) => cornerLifetimeMs(voice.text)));
        const hold = posInt(act.holdMs, `${path}.holdMs`, 0, 15000, Math.max(0, longest - stagger * (voices.length - 1)));
        voices.forEach((voice, voiceIndex) => {
          beats.push({ kind: "say", speaker: voice.speaker, text: voice.text, context: "speech", container: "corner" });
          if (voice.performer) beats.push({ kind: "emote", target: voice.performer, emote: "music", durationMs: 1500 });
          if (voiceIndex < voices.length - 1 && stagger > 0) beats.push({ kind: "wait", ms: stagger });
        });
        beats.push({ kind: "wait", ms: hold });
        const total = stagger * (voices.length - 1) + hold;
        push(index, "chorus", total, voices.map((voice) => voice.speaker).join("+"));
        lyricLines += voices.length;
        break;
      }
      case "cue": {
        const effect = str(act.effect, `${path}.effect`);
        const ms = posInt(act.durationMs, `${path}.durationMs`, 100, 8000, 800);
        if ((CUE_PARTICLES as readonly string[]).includes(effect)) {
          const performer = typeof act.performer === "string" && act.performer.trim() ? act.performer.trim() : undefined;
          const hasXY = Number.isInteger(act.x) && Number.isInteger(act.y);
          if (!performer && !hasXY) reject(`${path}(cue ${effect}) 는 performer(이벤트 id·player) 또는 x,y 칸이 필요하다.`);
          beats.push({ kind: "particles", preset: effect as (typeof CUE_PARTICLES)[number], ...(performer ? { target: performer } : { x: act.x as number, y: act.y as number }), durationMs: ms });
        } else if (effect === "flash") beats.push({ kind: "flash", color: "white", durationMs: Math.min(ms, 1500) });
        else if (effect === "shake") beats.push({ kind: "shake", intensity: 3, durationMs: Math.min(ms, 3000) });
        else reject(`${path}.effect 는 ${[...CUE_PARTICLES, ...CUE_SCREEN].join(" | ")} 중 하나다(받은 값 ${effect}).`);
        beats.push({ kind: "wait", ms });
        push(index, "cue", ms, effect);
        break;
      }
      case "music": {
        const action = act.action;
        if (action !== "bgm" && action !== "se" && action !== "fade" && action !== "stop") reject(`${path}.action 은 bgm | se | fade | stop 이다.`);
        if ((action === "bgm" || action === "se") && typeof act.resourceId !== "string") reject(`${path}(music ${action}) 에 resourceId(이미 있는 오디오 리소스)가 필요하다 — list_resources 로 찾아라. 새 곡은 이 도구가 만들지 않는다.`);
        beats.push({ kind: "music", action, ...(typeof act.resourceId === "string" ? { resourceId: act.resourceId } : {}), ...(act.loop !== undefined ? { loop: act.loop === true } : {}), ...(act.durationMs !== undefined ? { durationMs: posInt(act.durationMs, `${path}.durationMs`, 0, 30000) } : {}) });
        push(index, "music", 0, `${String(action)} ${typeof act.resourceId === "string" ? act.resourceId : ""}`.trim());
        break;
      }
      case "pause": {
        const ms = posInt(act.ms, `${path}.ms`, 100, 30000);
        beats.push({ kind: "wait", ms });
        push(index, "pause", ms);
        break;
      }
    }
    if (t > MAX_TOTAL_MS) reject(`공연이 ${Math.round(MAX_TOTAL_MS / 60000)}분을 넘는다(${path} 까지 ${Math.round(t / 1000)}초) — 장면을 나눠 두 번 불러라.`);
  });

  if (spot) {
    beats.push({ kind: "tint", color: "neutral", value: "", durationMs: 600, wait: false });
    beats.push({ kind: "look", target: spot, reset: true });
    warnings.push(`조명(spotlight ${spot})이 켜진 채 끝났다 — 컷신 끝에 자동으로 걷는다. 중간에 끄려면 {act:'spotlight',performer:'${spot}',on:false}.`);
  }
  // 화면 색조는 컷신이 끝나도 남는다 — 막을 닫은 채·색을 입힌 채 끝나면 조작만 돌아온 검은 화면이 된다(감사 #31 실측).
  // 다음 장면(맵 이동)으로 이어 붙일 때만 leaveDark:true 로 그대로 둔다.
  if (tinted && options.leaveDark !== true) {
    beats.push({ kind: "tint", color: "neutral", value: "", durationMs: 700, wait: true });
    t += 700;
    warnings.push("공연이 막을 닫거나 색을 입힌 채 끝나 화면을 되돌렸다(0.7초 페이드). 닫힌 채로 다음 장면으로 이어 가려면 leaveDark:true.");
  }
  return { beats, timeline, totalMs: t, lyricLines, warnings };
}

const ACT_SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["act"],
  description:
    "막 하나. act 로 종류를 고른다 — backdrop{imageId?,flowPercent?,tint?,durationMs?}(먼 배경 전환·분위기 색), curtain{state:'close'|'open',durationMs?}(막 닫기·열기), "
    + "spotlight{performer?,on?,dim?,durationMs?,sparkle?}(무대 어둡게+주인공 조명), lyric{lines:[{text,ms?,performer?}]|text,ms?,speaker?}(가사 자막 — 한 줄씩 박자에 맞춰), "
    + "chorus{voices:[{speaker,text}],staggerMs?,holdMs?}(2~3명이 엇갈려 겹쳐 부름), cue{effect:'sparkle|magic|heal|fire|smoke|dust|explosion|splash|flash|shake',performer?|x,y,durationMs?}, "
    + "music{action,resourceId?,durationMs?,loop?}(이미 있는 BGM/SE), pause{ms}.",
  properties: {
    act: { type: "string", enum: [...ACT_KINDS] },
    imageId: { type: "string", description: "backdrop: 먼 배경 리소스 id(list_resources). 비우면 그림은 그대로 두고 흐름·색만 바꾼다." },
    flowPercent: { type: "integer", minimum: 0, maximum: 400 },
    tint: { type: "string", description: "backdrop: 화면 색조 'R,G,B,알파' 또는 #rrggbb — 막마다 분위기 색(붉은 노을 '120,40,20,0.35')." },
    state: { type: "string", enum: ["close", "open"] },
    performer: { type: "string", description: "이벤트 id 또는 'player'. 조명·효과가 맞출 인물." },
    on: { type: "boolean", description: "spotlight: false 면 조명을 끈다. 기본 true." },
    dim: { type: "number", minimum: 0.1, maximum: 0.85, description: "spotlight: 주변을 얼마나 어둡게(기본 0.55)." },
    sparkle: { type: "boolean" },
    durationMs: { type: "integer", minimum: 0, maximum: 30000 },
    lines: { type: "array", minItems: 1, items: { type: "object", additionalProperties: false, required: ["text"], properties: { text: { type: "string" }, ms: { type: "integer", minimum: 300, maximum: 20000 }, performer: { type: "string" } } } },
    text: { type: "string" },
    ms: { type: "integer", minimum: 100, maximum: 30000, description: "lyric: 줄당 머무는 시간(생략 = 글자 수로 계산한 자막 수명). pause: 쉬는 시간." },
    speaker: { type: "string", description: "lyric: 자막에 이름표를 붙일 때(보통 비운다)." },
    voices: { type: "array", minItems: 2, maxItems: MAX_CHORUS_VOICES, items: { type: "object", additionalProperties: false, required: ["speaker", "text"], properties: { speaker: { type: "string" }, text: { type: "string" }, performer: { type: "string" } } } },
    staggerMs: { type: "integer", minimum: 0, maximum: 3000 },
    holdMs: { type: "integer", minimum: 0, maximum: 15000 },
    effect: { type: "string", enum: [...CUE_PARTICLES, ...CUE_SCREEN] },
    x: { type: "integer" }, y: { type: "integer" },
    action: { type: "string", enum: ["bgm", "se", "fade", "stop"] },
    resourceId: { type: "string" },
    loop: { type: "boolean" },
  },
};

const TOOL_KEYS = ["mapId", "eventId", "x", "y", "trigger", "once", "skippable", "requiresSwitches", "letterbox", "curtainRise", "leaveDark", "acts"] as const;

const authorStagePerformance: ToolDefinition = {
  name: "author_stage_performance",
  description:
    "오페라·콘서트·연극 같은 무대 공연 한 장면을 막(act) 목록으로 저작한다 — 가사 자막이 박자에 맞춰 흐르고, 합창이 겹치고, 막마다 배경·색이 바뀌고, 주인공에게 조명이 떨어진다. "
    + "시각표(자막 길이·합창 엇갈림·막 전환)는 코드가 계산하고 script_cutscene 의 검증·커밋 경로를 그대로 지난다. 새 그림·새 소리는 만들지 않는다 — 배경·BGM 은 이미 있는 리소스(list_resources)만 쓴다. "
    + "{mapId, eventId?, x?, y?, trigger?:'action'|'auto', once?, acts:[{act:'backdrop',imageId},{act:'spotlight',performer:'player'},{act:'lyric',lines:[{text:'…',ms:3000}]},{act:'chorus',voices:[{speaker:'합창A',text:'…'},{speaker:'합창B',text:'…'}]},{act:'curtain',state:'close'}]}. "
    + "플레이어 조작을 잠그고 시청만 하며 Esc 두 번으로 건너뛸 수 있다. 결과 data.timeline 에 막별 시작·끝 시각이 나온다 — preview_cutscene 으로 확인하라. "
    + "대사 위주 장면·카메라 이동·NPC 걷기는 script_cutscene / script_cutscene_staged 를 쓴다.",
  mode: "write",
  parameters: {
    type: "object",
    additionalProperties: false,
    required: ["mapId", "acts"],
    properties: {
      mapId: { type: "string" },
      eventId: { type: "string", description: "기존 이벤트 id. 없으면 새 투명 이벤트." },
      x: { type: "integer" }, y: { type: "integer" },
      trigger: { type: "string", enum: ["action", "auto"], description: "기본 action(조사하면 공연 시작)." },
      once: { type: "boolean", description: "true 면 한 번만 재생." },
      skippable: { type: "boolean", description: "기본 true." },
      requiresSwitches: { type: "array", items: { type: "string" } },
      letterbox: { type: "boolean", description: "영화식 검은 띠를 깐다. 기본 true." },
      curtainRise: { type: "boolean", description: "검은 화면에서 막이 오르며 시작. 기본 true." },
      leaveDark: { type: "boolean", description: "막을 닫거나 색을 입힌 채 끝낸다(뒤이어 맵 이동으로 장면을 잇는 경우). 기본 false — 끝에서 화면을 되돌린다." },
      acts: { type: "array", minItems: 1, maxItems: MAX_ACTS, items: ACT_SCHEMA },
    },
  },
  invalidArgsExample: {
    mapId: "map_opera_hall",
    trigger: "action",
    acts: [
      { act: "backdrop", imageId: "bg_opera_stage", tint: "40,20,10,0.25" },
      { act: "spotlight", performer: "player", durationMs: 600 },
      { act: "lyric", lines: [{ text: "오, 나의 운명이여", ms: 3200 }, { text: "별빛 아래 맹세하리", ms: 3200 }] },
      { act: "chorus", voices: [{ speaker: "합창", text: "맹세하리" }, { speaker: "합창", text: "영원히" }] },
      { act: "spotlight", performer: "player", on: false },
      { act: "curtain", state: "close", durationMs: 1500 },
    ],
  },
  run(draft: Project, args): ToolExecResult {
    const extra = Object.keys(args).filter((key) => !(TOOL_KEYS as readonly string[]).includes(key));
    if (extra.length) reject(`author_stage_performance 가 모르는 인자: ${extra.join(", ")} — 있는 것: ${TOOL_KEYS.join(", ")}.`);
    if (!SCRIPT_CUTSCENE) reject("script_cutscene 도구를 찾을 수 없다.", "missing-inner-tool");
    const map = requireMap(draft, args.mapId as string);
    const compiled = compilePerformance(args.acts, { letterbox: args.letterbox !== false, curtainRise: args.curtainRise !== false, leaveDark: args.leaveDark === true });
    // 배경 리소스·오디오 리소스 존재 확인 — 없는 id 는 컷신 검증이 거부하지만, 여기서 우회 안내를 붙인다.
    const warnings = [...compiled.warnings];
    const cutsceneArgs: Raw = {
      mapId: map.id,
      beats: compiled.beats,
      skippable: args.skippable !== false,
      trigger: args.trigger === "auto" ? "auto" : "action",
      ...(args.once === true ? { once: true } : {}),
      ...(typeof args.eventId === "string" && args.eventId.trim() ? { eventId: args.eventId.trim() } : {}),
      ...(Number.isInteger(args.x) ? { x: args.x } : {}),
      ...(Number.isInteger(args.y) ? { y: args.y } : {}),
      ...(Array.isArray(args.requiresSwitches) ? { requiresSwitches: args.requiresSwitches } : {}),
    };
    let cut: ToolExecResult;
    try {
      cut = SCRIPT_CUTSCENE.run(draft, cutsceneArgs);
    } catch (error) {
      if (error instanceof ToolError) {
        throw new ToolError(`${error.message} — 막 목록은 맞는데 리소스·이벤트 id 가 틀린 경우가 많다: 배경 imageId·music resourceId 는 list_resources 로, performer 는 get_map_events 의 이벤트 id 로 다시 확인하라.`, { code: "stage-performance-invalid" });
      }
      throw error;
    }
    return {
      summary: `${map.name}에 무대 공연 컷신 배치 — 막 ${compiled.timeline.length}개, 가사·합창 ${compiled.lyricLines}줄, 약 ${(compiled.totalMs / 1000).toFixed(1)}초. preview_cutscene 으로 확인하세요.`,
      data: { ...(cut.data as Raw), timeline: compiled.timeline, totalMs: compiled.totalMs, lyricLines: compiled.lyricLines },
      ...([...warnings, ...(cut.warnings ?? [])].length ? { warnings: [...warnings, ...(cut.warnings ?? [])] } : {}),
    };
  },
};

export const STAGE_PERFORMANCE_TOOLS: readonly ToolDefinition[] = [authorStagePerformance];
