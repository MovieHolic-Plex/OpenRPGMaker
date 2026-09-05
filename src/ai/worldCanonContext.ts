import {
  resolveWorldCanon,
  WORLD_CANON_LAW_KINDS,
  worldCanonHasContent,
  type WorldCanon,
  type WorldCanonLawKind,
  type WorldCanonTone,
} from "@/project/world/canon";

export const WORLD_CANON_PROMPT_HEADING = "## 이 세계(세계관 고정)";

const BODY_EXCERPT_CHARS = 600;

const TONE_WORDS: Record<WorldCanonTone, string> = {
  hopeful: "희망",
  grim: "우울",
  comic: "코믹",
  political: "정치",
  slice: "일상",
  gothic: "고딕",
  fairytale: "동화",
  mythic: "신화",
};

const LAW_WORDS: Record<WorldCanonLawKind, string> = {
  power: "힘(마법·기·과학)",
  gods: "신",
  death: "죽음",
  money: "돈",
};

export function worldCanonPromptSection(value: WorldCanon | undefined): string | null {
  if (!worldCanonHasContent(value)) return null;
  const canon = resolveWorldCanon(value);
  const lines: string[] = [
    WORLD_CANON_PROMPT_HEADING,
    "사용자가 자료집 「이 세계」에 적어 둔 세계다. 맵·NPC·대사·아이템·이름을 지을 때 이 절에 맞춘다.",
  ];
  if (canon.status === "canon") lines.push("- 상태: 확정 — 이 절을 세계의 정본으로 우선한다.");
  if (canon.status === "secret") lines.push("- 상태: 비밀 — 이 절의 내용은 조수가 알되 플레이어용 문장에 직접 노출하지 않는다.");
  if (canon.name) lines.push(`- 세계 이름: ${canon.name}`);
  if (canon.premise) lines.push(`- 전제: ${canon.premise}`);
  if (canon.tones.length > 0) lines.push(`- 톤: ${canon.tones.map((tone) => TONE_WORDS[tone]).join(", ")}`);
  if (canon.era) lines.push(`- 시대: ${canon.era}`);
  if (canon.techCeiling) lines.push(`- 기술 천장: ${canon.techCeiling}`);
  if (canon.absences.length > 0) {
    lines.push(`- **이 세계에 없는 것(절대 넣지 않는다)**: ${canon.absences.join(", ")}`);
  }
  for (const kind of WORLD_CANON_LAW_KINDS) {
    const law = canon.laws[kind];
    if (law.present === undefined && !law.note) continue;
    lines.push(`- ${LAW_WORDS[kind]}: ${law.present === undefined ? "미정" : law.present ? "있음" : "없음"}${law.note ? ` — ${law.note}` : ""}`);
  }
  if (canon.body) lines.push("", excerpt(canon.body));
  return lines.join("\n");
}

/** 캐논 금지어(absences)가 텍스트에 그대로 들어 있으면 그 금지어들을 돌려준다. 빈 캐논이면 항상 빈 배열. */
export function findWorldCanonAbsenceHits(text: string, value: WorldCanon | undefined): readonly string[] {
  if (!text || !worldCanonHasContent(value)) return [];
  const absences = resolveWorldCanon(value).absences;
  return absences.filter((absence) => absence.length > 0 && text.includes(absence));
}
function excerpt(body: string): string {
  const flat = body.trim();
  if (flat.length <= BODY_EXCERPT_CHARS) return flat;
  return `${flat.slice(0, BODY_EXCERPT_CHARS).trimEnd()}\n…(이 세계 본문 ${flat.length - BODY_EXCERPT_CHARS}자 더 있음 — 자료집 「이 세계」에서 전문을 볼 수 있다)`;
}
