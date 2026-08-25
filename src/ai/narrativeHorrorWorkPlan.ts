// Genre → template successTools mapping for Moon / Witch / Ib one-shot routing.
// Keeps WorkPlan planners and welcome prompts from thrashing on upsert_event.

export type NarrativeHorrorGenre = "moon-cutscene" | "witch-horror" | "ib-gallery";

export const NARRATIVE_HORROR_TEMPLATE_TOOLS = [
  "script_cutscene_preset",
  "make_horror_loop",
  "make_gallery_room",
] as const;

export type NarrativeHorrorTemplateTool = (typeof NARRATIVE_HORROR_TEMPLATE_TOOLS)[number];

const MOON_KEYWORDS = [
  "투더문",
  "to the moon",
  "회상",
  "감동",
  "병실",
  "독백",
  "memory",
  "story-cutscene",
  "감동 스토리",
] as const;

const WITCH_KEYWORDS = [
  "마녀",
  "witch",
  "트랩",
  "함정",
  "즉사",
  "체크포인트",
  "추격",
  "쫓아",
  "저택 호러",
  "mansion",
  "horror-loop",
  "학교 호러",
  "아오오니",
  "school-horror",
] as const;

const IB_KEYWORDS = [
  "이브",
  "ib",
  "갤러리",
  "gallery",
  "조사",
  "핫스팟",
  "퍼즐",
  "미술관",
  "horror-gallery",
  "단서",
  "item-gate",
] as const;

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * 영문 키워드는 토큰 경계에서만 매칭한다.
 * includes("witch")는 "switch"도 잡고, includes("ib")는 "library"도 잡아서
 * 전혀 관계없는 자유 입력에 호러 템플릿을 강제하는 실제 오분류를 만들었다.
 */
function containsKeyword(text: string, keyword: string): boolean {
  const normalizedKeyword = keyword.toLowerCase();
  if (!/^[a-z0-9 -]+$/u.test(normalizedKeyword)) return text.includes(normalizedKeyword);
  const escaped = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, "u").test(text);
}

/** Detect primary narrative/horror genre from free text (first match by priority: ib > witch > moon for overlapping horror words). */
export function detectNarrativeHorrorGenre(text: string): NarrativeHorrorGenre | null {
  const n = normalize(text);
  if (!n) return null;
  // Gallery/investigation first — "조사" is Ib-specific in our product language.
  if (IB_KEYWORDS.some((k) => containsKeyword(n, k))) return "ib-gallery";
  if (WITCH_KEYWORDS.some((k) => containsKeyword(n, k))) return "witch-horror";
  if (MOON_KEYWORDS.some((k) => containsKeyword(n, k))) return "moon-cutscene";
  return null;
}

export function successToolsForNarrativeHorrorGenre(
  genre: NarrativeHorrorGenre,
): readonly NarrativeHorrorTemplateTool[] {
  switch (genre) {
    case "moon-cutscene":
      return ["script_cutscene_preset"];
    case "witch-horror":
      return ["make_horror_loop"];
    case "ib-gallery":
      return ["make_gallery_room"];
  }
}

/** Required write tools for a user message; empty if not a narrative/horror genre ask. */
export function requiredSuccessToolsForUserText(text: string): readonly string[] {
  const genre = detectNarrativeHorrorGenre(text);
  return genre ? [...successToolsForNarrativeHorrorGenre(genre)] : [];
}

export function plannerHintForNarrativeHorrorGenre(genre: NarrativeHorrorGenre): string {
  switch (genre) {
    case "moon-cutscene":
      return "투더문/회상 축: MUST use script_cutscene_preset (memory_opening|bedside_monologue|ending_fade). Do not thrash upsert_event for cutscenes.";
    case "witch-horror":
      return "마녀의집/트랩 호러 축: MUST use make_horror_loop (traps+checkpoint+optional chase). Prefer over raw place_trap alone.";
    case "ib-gallery":
      return "이브/갤러리 조사 축: MUST use make_gallery_room (hotspots+puzzle). Do not only describe — call the template tool.";
  }
}

/** Korean instruction line for welcome chip / work plan items. */
export function templateToolInstruction(genre: NarrativeHorrorGenre): string {
  switch (genre) {
    case "moon-cutscene":
      return "script_cutscene_preset으로 회상/엔딩 컷신을 배치한다 (preset=memory_opening 또는 ending_fade). upsert_event로 컷신을 수작업 조립하지 말 것.";
    case "witch-horror":
      return "make_horror_loop로 트랩+체크포인트(+추격) 루프를 한 번에 배치한다. place_trap만 흩뿌리지 말 것.";
    case "ib-gallery":
      return "make_gallery_room으로 조사 핫스팟+퍼즐 갤러리 방을 조립한다. 설명만 하고 끝내지 말 것.";
  }
}

export const NARRATIVE_HORROR_PLANNER_RULE = [
  "10. Narrative/horror genre routing (required successTools — do NOT use upsert_event thrash):",
  "   - 투더문/to the moon/회상/병실/감동 스토리 → successTools: [\"script_cutscene_preset\"]",
  "   - 트랩/즉사/추격/저택·학교 호러 → successTools: [\"make_horror_loop\"]",
  "   - 갤러리/조사/이브/미술관 퍼즐 → successTools: [\"make_gallery_room\"]",
  "   - 일반 컷신·선택지 컷신 → successTools: [\"script_cutscene\"]. 엔딩 조건/ending flag → [\"define_ending\"].",
  "   Use a genre template only for its explicit genre. Generic cutscene/ending words do not imply a To-the-Moon preset.",
].join("\n");
