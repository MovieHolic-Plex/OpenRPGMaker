// src/harnesses/_core/workshop/referencePrompt.ts
/**
 * 공방 「참고 그림」 단계 — object-gen(MovieHolic-Plex/object-gen, objectgen/reference.py)의 ref 단계를 옮겼다(2026-10-21).
 * 지시문(VIEW·NEGATIVE·TOP_WORDS)·이름 거부(IP_TERMS)·시점 검사(VIEW_PROMPT·view_ok·top_range)는 원본 문장 그대로다 — 고치려면 원본부터.
 *
 * 참고 그림은 화소가 되지 않는다:
 * - 판(round)의 임시 기록에만 둔다. 그리는 모델만 「모양·비율」 참고로 본다.
 * - 검수(독립·블라인드)·3/4 관문 조언·굽기·스토어는 참고 그림을 보지 않는다. 칩셋에 들어가는 것은 모델이 찍은 격자뿐이다.
 * - 줄여 따라 그리기·화소 옮기기를 지시문에서 금한다(object-gen REFCOPY 와 같은 뜻).
 */

export const REF_VIEW = "Classic 16-bit top-down RPG tile view (the 3/4 top-down view of old console RPG maps): the camera is high above "
  + "the object at about 60 degrees, looking down toward the north, seen from the south. The TOP surface ({top}) is "
  + "clearly visible as a large flat plane that takes up most of the object's height in the picture; the front face is "
  + "short and sits directly below it. Left and right edges stay vertical and parallel; no side face is visible. "
  + "Clean simple game-asset illustration, simple shapes, soft light from the upper left, plain flat light-grey "
  + "background, no floor, no room, no text, no people, the whole object in frame and centered. Object: {d}";
export const REF_NEGATIVE = "straight-on front elevation, eye-level camera, camera at or below the top surface, isometric view, diagonal "
  + "view, rotated object, visible side face, perspective lines vanishing to the side, worm's-eye view, close-up "
  + "crop, product photo angle";
const TOP_WORDS: Readonly<Record<string, string>> = {
  seat: "the seat cushions and arm tops", bed: "the mattress and blanket", table: "the table top", default: "the top of the object",
};
/** 참고 그림 지시문에 쓰면 안 되는 이름(대소문자 무시, 낱말 단위). 원본 목록 그대로 — 더하기만 한다. */
export const REF_IP_TERMS = [
  "pokemon", "pokémon", "nintendo", "zelda", "final fantasy", "square enix", "dragon quest", "ghibli", "disney",
  "pixar", "marvel", "harry potter", "hogwarts", "rpg maker", "enterbrain", "kadokawa", "stardew", "undertale",
  "minecraft", "in the style of", "style of",
] as const;

export const REF_VIEW_PROMPT = `You check ONE reference picture for a pixel-art game. It must show the object in the 3/4 top-down RPG
view: camera high above at about 60 degrees looking down from the south, the TOP surface visible as a large plane, a short
front face below it, no side faces, vertical left/right edges. Reject anything else, be strict:
- "front": straight-on front elevation or eye level - the top is a thin sliver or invisible
- "isometric": diagonal/rotated object, two faces visible, edges not vertical
- "side": a side face visible, or perspective vanishing to one side
- "low": camera at or below the top surface
- "other": not one object, cropped, a room, text
Answer with ONE line of JSON only: {"view": "top34|front|isometric|side|low|other", "topShare": <percent of the object's
picture height that is top surface>, "why": "<one short sentence>"}`;

/** 참고 그림을 몇 번까지 다시 만들어 시점 검사에 거나(원본 tries 기본 3). */
export const REF_TRIES = 3;

export type RefViewCheck = { readonly view: string; readonly topShare: number; readonly why: string; readonly ok: boolean; readonly minTop: number };

/** 원본 check_prompt: 게임·회사·작가 이름이 들어가면 거부한다. 걸린 낱말 목록(없으면 빈 배열). */
export function refPromptNames(text: string): string[] {
  const low = text.toLowerCase();
  return REF_IP_TERMS.filter((term) => new RegExp(`(?<![a-z])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z])`, "u").test(low));
}

/** 원본 top_range(high view): 윗면 비율 하한 35%, 벽 앞 키 큰 가구·벽 걸이는 15%. */
export function refMinTop(gateKind: string | undefined): number {
  return gateKind === "tall_furniture" || gateKind === "wall_mounted" ? 15 : 35;
}

/** 원본 prompt_for(high view). describe = 물건 설명(이름·생김새·배경·크기 비율). */
export function refPrompt(describe: string, gateKind?: string, styleNote?: string): string {
  const top = TOP_WORDS[gateKind === "seat" ? "seat" : "default"]!;
  // styleNote = 원본 STYLE_NOTE(견본 묶음을 쓰는 흐름에서 원본 prompt_for 가 덧붙인다).
  return `${REF_VIEW.replace("{top}", top).replace("{d}", describe.trim())} Must NOT be: ${REF_NEGATIVE}.${styleNote ? ` ${styleNote}` : ""}`;
}

/** 원본 view_ok(high view) — 판정자 답 JSON 을 읽어 통과 여부까지. 못 읽으면 통과가 아니다. */
export function parseRefViewCheck(text: string, minTop: number): RefViewCheck {
  const found = text.match(/\{[^{}]*\}/gu);
  if (!found?.length) return { view: "unchecked", topShare: 0, why: "시점 검사 답에 JSON 이 없다", ok: false, minTop };
  try {
    const raw = JSON.parse(found.at(-1)!) as { view?: unknown; topShare?: unknown; why?: unknown };
    const view = String(raw.view ?? "");
    const topShare = Number(raw.topShare ?? 0) || 0;
    return { view, topShare, why: String(raw.why ?? "").slice(0, 200), ok: view === "top34" && topShare >= minTop, minTop };
  } catch {
    return { view: "unchecked", topShare: 0, why: "시점 검사 답을 읽지 못했다", ok: false, minTop };
  }
}

/** 그리는 모델에게 붙이는 안내(원본 prompts.py References 절을 한국어로). */
export const REF_DRAW_NOTE = "「참고 그림」은 이 물건이 이 시점에서 어떻게 생겼는지 보여 주는 생성 그림이다. 모양만 참고한다 — 어떤 부분이 있고, 어디에, 비율이 어떤지, "
  + "무엇이 이 물건을 알아보게 하는지. 줄이거나 따라 그리거나 색을 뽑지 마라. 모든 화소는 팔레트 키로 네가 직접 찍는다. "
  + "윗면 행 수·크기는 아래 「크기」「윗면」 절이 정한다(참고 그림의 비율보다 우선).";

/** 공방 기물 → 참고 그림 지시문의 Object: 설명. 바닥 무늬·벽 걸이는 참고 단계가 없다(시점 지시문이 서 있는 물건용). */
export function workshopRefDescribe(item: { readonly kind: string; readonly title: string; readonly description: string; readonly setting?: string; readonly width: number; readonly height: number; readonly padTop: number }): string | null {
  if (item.kind === "flat" || item.kind === "hang") return null;
  const w = item.width, h = item.height - item.padTop;
  return `${item.title} — ${item.description}${item.setting ? ` Setting: ${item.setting}.` : ""} One single object; in the game it is drawn about ${w} by ${h} pixels (width by height), so keep that proportion.`;
}
