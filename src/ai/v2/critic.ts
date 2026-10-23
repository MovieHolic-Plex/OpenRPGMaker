// 조수 v2 독립 비평가 — 요청 원문과 1배 그림만 본다(짓기 이유·명세·앞선 점수는 모른다). major 를 칸 좌표와 함께 돌려준다.
// 실내는 v1 의 보정된 루브릭(featureReview.ts, 축 1·2·6)을 그대로 쓰고, 바깥·던전은 장르 관례만 바꾼 같은 루브릭이다.
import { featureCriticPrompt, parseFeatureCritic, type CriticVerdict } from "@/ai/piAgent/featureReview";
import type { PlaceType } from "./types";

const OUTDOOR_CONVENTIONS: Record<string, string> = {
  village: "Genre conventions (do NOT count as majors): an outdoor village map is meant to fill the whole frame with ground; trees, bushes and grass between houses are scenery, not void; roads may run off the map edges (that is how the player leaves); fenced fields and roofs are not walkable and that is fine.",
  street: "Genre conventions (do NOT count as majors): a modern street map fills the frame; pavement and asphalt are ground, not void; buildings are seen from the 3/4 front; roads running off the edges are exits.",
  dungeon: "Genre conventions (do NOT count as majors): a dungeon or cave floor is drawn inside dark rock; dark rock or black OUTSIDE the walls is solid ground, not void — count void only for bare, purposeless floor INSIDE the walkable area. Stairs and ladders are the exits between floors.",
};

/** 비평 지시문. 실내면 v1 루브릭 그대로, 아니면 장르 관례만 갈아 끼운다. */
export function criticPrompt(task: string, type: PlaceType | "content", mapName: string, cells: { width: number; height: number }, px: { width: number; height: number } | undefined, otherMaps: readonly string[]): string {
  const base = featureCriticPrompt(task, mapName, cells, px, otherMaps);
  if (type === "interior" || type === "house") return base;
  const key = type === "cave" ? "dungeon" : type === "street" ? "street" : type === "dungeon" ? "dungeon" : "village";
  return base.split("\n").map((line) => line.startsWith("Genre conventions") ? OUTDOOR_CONVENTIONS[key]! : line).join("\n");
}

export function pngSize(dataUrl: string): { width: number; height: number } | undefined {
  const comma = dataUrl.indexOf(",");
  const b64 = dataUrl.slice(comma + 1, comma + 1 + 44);
  const bytes = typeof Buffer !== "undefined" ? Buffer.from(b64, "base64") : Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return bytes.length >= 24 ? { width: view.getUint32(16), height: view.getUint32(20) } : undefined;
}

export interface CriticRun {
  readonly verdict: CriticVerdict;
  readonly ms: number;
}

/** 비평가 한 번: 대표 맵 그림 1장 + 같은 짓기의 다른 맵(문맥용). sideChat 은 조수와 같은 모델의 따로 부르는 호출. */
export async function critique(input: {
  readonly task: string;
  readonly type: PlaceType | "content";
  readonly map: { readonly id: string; readonly name: string; readonly width: number; readonly height: number };
  readonly image: string;
  readonly others: readonly { readonly name: string; readonly image: string }[];
  readonly sideChat: (messages: readonly unknown[], signal?: AbortSignal) => Promise<string>;
  readonly signal?: AbortSignal;
}): Promise<CriticRun> {
  const t0 = Date.now();
  const text = criticPrompt(input.task, input.type, input.map.name, input.map, pngSize(input.image), input.others.map((o) => o.name));
  const reply = await input.sideChat([{ role: "user", content: [
    { type: "text", text },
    { type: "image_url", image_url: { url: input.image } },
    ...input.others.map((o) => ({ type: "image_url", image_url: { url: o.image } })),
  ] }], input.signal);
  return { verdict: parseFeatureCritic(reply, input.map.id, 1 + input.others.length), ms: Date.now() - t0 };
}

/**
 * 컷신 연출 비평 — 끝 그림 한 장이 아니라 장면을 따라 그린 1배 틀 여러 장(시작·걷는 중·도착·끝)을 본다.
 * 2026-10-23 눈가림 비교: 주인공이 1~2걸음만 걷고 촌장이 맵 구석에서 오는 컷신을 끝 상태 한 장만 본 비평가가 문제 0 으로 넘겼다.
 * 루브릭 S1 요청이 이루어졌나 · S2 무대가 읽히나(걸음 길이·다가오는 자리·마주 섬·가구/지붕 속에 선 사람) · S3 다듬기.
 */
export function stagingCriticPrompt(task: string, mapName: string, frames: readonly { readonly label: string; readonly crop: { x: number; y: number; w: number; h: number }; readonly px?: { width: number; height: number } }[], notes: readonly string[]): string {
  const crop = frames[0]?.crop;
  const px = frames[0]?.px;
  const scale = crop && px ? ` Each image is ${px.width}×${px.height}px covering map cells x ${crop.x}..${crop.x + crop.w - 1}, y ${crop.y}..${crop.y + crop.h - 1} (about ${(px.width / crop.w).toFixed(1)}px per cell). Give coordinates as MAP cells (add the crop origin).` : " Give coordinates as map cells.";
  return [
    "You are a fresh, adversarial reviewer of a SHORT IN-GAME CUTSCENE on a 16px 3/4-view (top-down JRPG) map. You never saw its script or build notes.",
    `You get ${frames.length} still frames of the same map area, in time order, rendered at about 1x with every character at the cell the cutscene puts it at that moment: ${frames.map((f, i) => `image ${i + 1} = «${f.label}»`).join(", ")}.${scale}`,
    "The hero is the player character; other characters are NPCs. Cinematic letterbox bars, dialogue boxes and facial portraits are not drawn in these frames — judge only what the frames can show; the notes below say what the script does that the frames cannot show.",
    "Rubric. Severity: major = an ordinary player watching notices it immediately and it reads as cheap or buggy. minor = polish only.",
    "S1 Request fulfilled: every action the user asked for visibly happens (who walks where, who approaches whom, who stands where when talking).",
    "S2 Staging readable: a walk covers enough ground to read as walking (3+ cells) and goes where it was meant to (e.g. along the village road, not into a wall); an approaching NPC starts from a sensible on-screen spot a few cells away and ends beside the hero; the two talk side by side and face each other; nobody stands inside a wall, roof, furniture or water, and nobody overlaps.",
    "S3 Polish: framing and timing feel deliberate (start pose, where the scene ends, what stays after).",
    `Map: ${mapName}. What the user asked for: ${task.slice(0, 1000)}`,
    ...(notes.length ? [`Script notes (not visible in frames): ${notes.join(" / ").slice(0, 900)}`] : []),
    "List EVERY major with the cell where it shows and ONE concrete fix expressed as a change to the cutscene (walk to another place word, appear somewhere else, add/remove a beat). Do not suggest changing the request.",
    'Reply with JSON only: {"imagesSeen": <number of images you received>, "axes": {"request": n, "staging": n, "polish": n}, "score": n, "majors": [{"axis": "S1"|"S2"|"S3", "x": n, "y": n, "what": "한국어 한 줄 — 보이는 것", "fix": "한국어 한 줄"}], "minors": ["한국어 한 줄"]}',
  ].join("\n");
}

export function parseStagingCritic(text: string, mapId: string, imagesSent: number): CriticVerdict {
  const match = text.match(/\{[\s\S]*\}/u)?.[0];
  let parsed: Record<string, unknown> | null = null;
  try { parsed = match ? JSON.parse(match) as Record<string, unknown> : null; } catch { parsed = null; }
  if (!parsed) return { mapId, majors: [], problem: "연출 비평 응답을 읽지 못했다" };
  const imagesSeen = typeof parsed.imagesSeen === "number" ? parsed.imagesSeen : undefined;
  if (imagesSeen === undefined || imagesSeen < imagesSent) return { mapId, majors: [], ...(imagesSeen !== undefined ? { imagesSeen } : {}), problem: `연출 비평가가 그림 ${imagesSeen ?? "?"}장만 받았다(보낸 그림 ${imagesSent}장)` };
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
  const int = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.round(v)) : undefined);
  const axesRaw = (parsed.axes ?? {}) as Record<string, unknown>;
  // CriticVerdict 의 축 칸을 빌려 쓴다: composition=S1 요청, view=S2 무대, doors=S3 다듬기.
  const axes = { composition: num(axesRaw.request), view: num(axesRaw.staging), doors: num(axesRaw.polish) };
  const majors = (Array.isArray(parsed.majors) ? parsed.majors as Array<Record<string, unknown>> : []).filter((m) => typeof m.what === "string" && m.what).slice(0, 8).map((m) => {
    const tag = /^S[123]$/u.test(String(m.axis)) ? String(m.axis) : "S2";
    const x = int(m.x), y = int(m.y);
    return { axis: 1 as const, ...(x !== undefined ? { x } : {}), ...(y !== undefined ? { y } : {}), what: `[연출 ${tag}] ${String(m.what).slice(0, 220)}`, ...(typeof m.fix === "string" && m.fix ? { fix: m.fix.slice(0, 240) } : {}) };
  });
  const scored = [axes.composition, axes.view, axes.doors].filter((v): v is number => v !== undefined);
  const capped = scored.length ? Math.min(Math.min(...scored) + 1, scored.reduce((a, b) => a + b, 0) / scored.length) : undefined;
  const score = num(parsed.score) !== undefined ? Math.min(num(parsed.score)!, capped ?? 10) : capped;
  return { mapId, ...(score !== undefined ? { score: Math.round(score * 10) / 10 } : {}), axes, majors, imagesSeen };
}

/** 연출 비평 한 번: 장면 틀 여러 장(시간 순서). */
export async function critiqueStaging(input: {
  readonly task: string;
  readonly map: { readonly id: string; readonly name: string };
  readonly frames: readonly { readonly label: string; readonly image: string; readonly crop: { x: number; y: number; w: number; h: number } }[];
  readonly notes: readonly string[];
  readonly sideChat: (messages: readonly unknown[], signal?: AbortSignal) => Promise<string>;
  readonly signal?: AbortSignal;
}): Promise<CriticRun> {
  const t0 = Date.now();
  const px = input.frames[0] ? pngSize(input.frames[0].image) : undefined;
  const text = stagingCriticPrompt(input.task, input.map.name, input.frames.map((f) => ({ label: f.label, crop: f.crop, ...(px ? { px } : {}) })), input.notes);
  const reply = await input.sideChat([{ role: "user", content: [
    { type: "text", text },
    ...input.frames.map((f) => ({ type: "image_url", image_url: { url: f.image } })),
  ] }], input.signal);
  return { verdict: parseStagingCritic(reply, input.map.id, input.frames.length), ms: Date.now() - t0 };
}
