// 종류 안의 되풀이 — 결함 종류(예: «보이는 것과 통행이 다름») 하나에 든 major 이상 결함의 근거 줄을, 빌더·도구를 고칠 사람이 보는 눈으로
// «같은 원인»끼리 묶는다(예: 그려진 문이 막혔고 이벤트가 없다 34건 · 못이 걸어진다 12건). 순위표의 한 줄이 «무엇을 고치면 되는가»로 내려가게 하는 것이다.
// 묶는 것은 검수자 모델(글만, 종류마다 한 번)이지만 세는 것은 코드다: 모든 줄이 정확히 한 묶음에 들어야 답이고, 건수·맵 수는 그 배정에서 센다.
// 이 묶음은 따로 보정하지 않았다 — 고칠 거리의 실마리이지 판정이 아니다.
import { askJudge, extractJson, type JudgeUsage } from '../visualJudge';
import type { MapReview, Reviewer } from './verdict';

export const PATTERNS_VERSION = 'map-vqa-patterns-v1';
const SYSTEM = [
  'You are a map-builder engineer reading defect notes about 16px top-down JRPG maps that an AI assistant laid with builder tools. All notes belong to ONE defect class. Each input line is "<id>\\t<map>\\t<note>" (notes are Korean).',
  'Group the notes by ROOT CAUSE — the same thing the builder did wrong, so that one fix in the builder or tool would remove the whole group. Examples of good groups: "a drawn house door is blocked and has no event", "pond or lava cells are walkable", "the exit to the world map sits on a bare edge cell one row off the paved road", "the road runs to the south edge where there is no exit".',
  'Do not group by map or by wording. Use at most 7 groups; put notes that fit nowhere in a last group named "기타".',
  'Reply with ONE JSON object and nothing else: {"groups":[{"pattern":"한국어 한 줄: 무엇이 어떻게 잘못 깔렸는지","fix_hint":"한국어 한 줄: 빌더·도구가 무엇을 해야 없어지는지","ids":[1,2]}]}',
  'EVERY input id must appear in exactly one group. Write "pattern" and "fix_hint" in Korean.',
].join('\n');

export type DefectPattern = { pattern: string; fixHint: string; count: number; blocker: number; major: number; maps: number; examples: string[] };
type Line = { id: number; label: string; severity: string; evidence: string };

/** 답 읽기: 모든 id 가 정확히 한 묶음에 들어야 한다. 아니면 null(그 호출을 다시 한다). */
export function parsePatterns(reply: string, lines: Line[]): DefectPattern[] | null {
  const data = extractJson(reply) as any;
  if (!data || !Array.isArray(data.groups)) return null;
  const byId = new Map(lines.map(line => [line.id, line])), seen = new Set<number>(), out: DefectPattern[] = [];
  for (const group of data.groups) {
    if (!group || typeof group.pattern !== 'string' || !/[가-힣]/u.test(group.pattern) || !Array.isArray(group.ids)) return null;
    const members: Line[] = [];
    for (const id of group.ids) { const line = byId.get(Number(id)); if (!line || seen.has(line.id)) return null; seen.add(line.id); members.push(line); }
    if (!members.length) continue;
    const maps = [...new Set(members.map(member => member.label))];
    out.push({ pattern: group.pattern.replace(/\s+/gu, ' ').trim().slice(0, 160), fixHint: String(group.fix_hint ?? '').replace(/\s+/gu, ' ').trim().slice(0, 200), count: members.length,
      blocker: members.filter(member => member.severity === 'blocker').length, major: members.filter(member => member.severity === 'major').length, maps: maps.length, examples: maps.slice(0, 3) });
  }
  if (seen.size !== lines.length) return null;
  return out.sort((a, b) => b.blocker - a.blocker || b.count - a.count);
}

/** major 이상이 minCount 건 넘는 종류마다 되풀이를 묶는다. 실패한 종류는 빠진다(순위표는 그대로다). */
export async function classPatterns(reviews: MapReview[], reviewer: Reviewer, cacheDir: string, usage: JudgeUsage, minCount = 8): Promise<Record<string, DefectPattern[]>> {
  const out: Record<string, DefectPattern[]> = {};
  for (const [id, label] of Object.entries(reviewer.classes)) {
    if (id === 'other') continue; // «그 밖»은 원래 한 원인이 아니다
    const lines: Line[] = [];
    for (const review of reviews) for (const defect of review.defects) if (defect.class === id && defect.severity !== 'polish') lines.push({ id: lines.length + 1, label: review.label, severity: defect.severity, evidence: defect.evidence });
    if (lines.length < minCount) continue;
    const answer = await askJudge({ cacheDir, promptVersion: PATTERNS_VERSION, system: SYSTEM, usage, images: [],
      text: `DEFECT CLASS: ${id} — ${label}\n\n${lines.map(line => `${line.id}\t${line.label}\t${line.evidence.replace(/\s+/gu, ' ')}`).join('\n')}`,
      parse: reply => parsePatterns(reply, lines) });
    if ('answer' in answer) out[id] = answer.answer;
  }
  return out;
}
