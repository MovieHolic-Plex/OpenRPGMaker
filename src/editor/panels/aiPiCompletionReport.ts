// editor/panels/aiPiCompletionReport.ts
// Pi 실행이 끝났을 때 조수 창에 남는 마무리 말 — 무엇을 만들었는지가 먼저, 남은 지적은 접어서.
//
// 2026-09-23 실측(첫 사용자 한 문장 → 16분 실행): 마지막 말풍선이 「반영했지만 확인할 것이 남았어요.」 로
// 시작해 「맵 좌측 전체가 검은 공백으로 방치되어 … 흉하게 고립되어 떠 있습니다」 같은 검토 문장을 줄줄이
// 늘어놨다. 맵 14개·이벤트 151개를 만든 실행이 실패처럼 읽혔다. 지적은 버리지 않는다 — 접은 칸
// 「더 다듬을 곳 (N)」 안으로 옮기고, 끝까지 확인하지 못한 사실도 그대로 말한다(거짓 성공 금지).

import type { Project } from "@/project/types";
import { summarizeChanges } from "@/editor/tools/changeset";
import { el } from "@/util/dom";
import { bindActivityLevel } from "./aiActivityPreference";

export const COMPLETION_PLAY_HINT = "▶ 테스트로 플레이해 보세요.";

/** 받침 있으면 「을」, 없으면 「를」. 한글이 아니면 「을(를)」 로 둔다. */
function objectParticle(word: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  if (code < 0 || code > 11_171) return "을(를)";
  return code % 28 === 0 ? "를" : "을";
}

/**
 * 새로 생긴 것만 사람 말로 센다 — 「맵 14개 · 이벤트 151개 · 캐릭터 11명을 만들었어요.」
 * 새로 생긴 것이 없으면 null(부르는 쪽이 일반 문장을 쓴다). 고친 것까지 세면 숫자가 부풀어 보인다.
 */
export function plainMadeSummary(before: Project, after: Project): string | null {
  const diff = summarizeChanges(before, after);
  // 일부 표면·픽스처는 database 가 없는 부분 프로젝트를 넘긴다 — 세지 못하면 0 으로 둔다.
  const beforeActors = new Set((before.database?.actors ?? []).map(actor => actor.id));
  const actorsAdded = (after.database?.actors ?? []).filter(actor => !beforeActors.has(actor.id)).length;
  const parts = [
    diff.mapsAdded > 0 ? `맵 ${diff.mapsAdded}개` : null,
    diff.eventsAdded > 0 ? `이벤트 ${diff.eventsAdded}개` : null,
    actorsAdded > 0 ? `캐릭터 ${actorsAdded}명` : null,
  ].filter((part): part is string => part !== null);
  if (!parts.length) return null;
  const last = parts[parts.length - 1]!;
  return `${parts.join(" · ")}${objectParticle(last)} 만들었어요.`;
}

/** 머리말 — 만든 것 + 플레이 안내. 확인을 못 끝냈으면 그 사실을 숨기지 않고 한 줄 덧붙인다. */
export function completionHeadline(made: string | null, options: { readonly unverified: boolean; readonly stoppedEarly?: string }): string {
  if (options.stoppedEarly) {
    return [
      `${made ?? "변경 내용을 반영했어요."} 다만 작업이 도중에 멈춰 요청을 끝까지 만들지 못했어요.`,
      `멈춘 이유: ${options.stoppedEarly}`,
      "「이어서 완성해 줘」 라고 보내면 남은 부분을 이어서 만들어요. 마음에 들지 않으면 되돌릴 수 있어요.",
    ].join("\n");
  }
  const lines = [made ?? "변경 내용을 반영했어요.", COMPLETION_PLAY_HINT];
  if (options.unverified) lines.push("끝까지 확인하지는 못했어요. 마음에 들지 않으면 되돌릴 수 있어요.");
  return lines.join("\n");
}

/**
 * 여러 맵에 되풀이되는 지적 유형. 2026-09-23 「등대지기의 겨울」 세 판의 검수 지적 45~50건 중 대부분이
 * 이 몇 부류였다(집 실내 12~15채가 같은 생성기에서 나와 같은 문장이 맵마다 반복).
 */
const RECURRING_FINDING_CLASSES: readonly { readonly label: string; readonly pattern: RegExp }[] = [
  { label: "방·가구가 복사한 듯 똑같음", pattern: /(완전히|똑같이|동일하게)[^.]{0,20}(복사|배치)|복사되어|복사한 듯/u },
  { label: "맵 안의 검은 빈칸", pattern: /검은[색 ]*(공백|빈|보이드)|암흑 공백|보이드|공백 타일/u },
  { label: "벽 없이 떠 있는 지붕", pattern: /지붕[^.]{0,40}(떠|공중)/u },
  { label: "계단·사다리 위치가 어색함", pattern: /(계단|사다리)[^.]{0,40}(벽|떠|맞닿|중첩|단독)/u },
  { label: "물가에 해안선·전이가 없음", pattern: /(해안선|수변|물가|수역)[^.]{0,60}(없|단절|끊)/u },
  { label: "바닥에 어울리지 않는 회색 타일", pattern: /회색[^.]{0,20}(타일|사각)/u },
];

function splitMapFinding(finding: string): { readonly map: string | null; readonly text: string } {
  const index = finding.indexOf(": ");
  return index > 0 && index < 60 ? { map: finding.slice(0, index), text: finding.slice(index + 2) } : { map: null, text: finding };
}

/**
 * 같은 지적을 한 줄로 모은다 — 똑같은 문장은 한 번만, 둘 이상 맵에 나온 같은 유형은
 * 「유형 — 맵 목록: 첫 예시」 한 줄로. 원문은 버리지 않는다(예시로 첫 문장을 그대로 싣는다).
 */
export function compactRefineFindings(findings: readonly string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const finding of findings) {
    const key = finding.replace(/\s+/gu, " ").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(key);
  }
  const groups = RECURRING_FINDING_CLASSES.map(() => ({ maps: [] as string[], items: [] as string[] }));
  const classOf = unique.map((finding) => {
    const { map, text } = splitMapFinding(finding);
    const index = RECURRING_FINDING_CLASSES.findIndex(entry => entry.pattern.test(text));
    if (index >= 0 && map) {
      const group = groups[index]!;
      if (!group.maps.includes(map)) group.maps.push(map);
      group.items.push(finding);
      return index;
    }
    return -1;
  });
  const grouped = new Set(groups.flatMap((group, index) => group.maps.length >= 2 ? [index] : []));
  const lines = [...grouped]
    .sort((a, b) => groups[b]!.maps.length - groups[a]!.maps.length)
    .map((index) => {
      const group = groups[index]!;
      const example = splitMapFinding(group.items[0]!).text;
      return `${RECURRING_FINDING_CLASSES[index]!.label} — ${group.maps.length}곳(${group.maps.join(", ")}). 예: ${example}`;
    });
  unique.forEach((finding, index) => { if (!grouped.has(classOf[index]!)) lines.push(finding); });
  return lines;
}

/**
 * 「더 다듬을 곳 (N)」 접은 칸. 간단히 보기(기본)에서는 접혀 있고, 자세히 보기에서는 펼쳐 둔다.
 * 지적 문장은 검토 모델이 쓴 그대로 둔다 — 바꿔 쓰면 무엇이 지적됐는지가 흐려진다. 머리말만 부드럽게.
 */
export function createRefineFindings(rawFindings: readonly string[]): HTMLElement {
  const findings = compactRefineFindings(rawFindings);
  const list = el("ul", { class: "ai-refine-findings", children: findings.map(text => el("li", { text })) });
  const details = el("details", {
    class: "ai-refine-details",
    dataset: { testid: "ai-refine-details" },
    children: [
      el("summary", { text: `더 다듬을 곳 (${findings.length})`, dataset: { testid: "ai-refine-summary" } }),
      el("p", { class: "ai-refine-intro", text: "검토하면서 눈에 띈 점이에요. 고치고 싶은 것만 골라 다시 부탁해 보세요." }),
      list,
      el("p", { class: "ai-refine-undo", text: "마음에 들지 않으면 되돌릴 수 있어요." }),
    ],
  }) as HTMLDetailsElement;
  bindActivityLevel(details, level => { details.open = level === "detail" || level === "trace"; });
  return details;
}

/** 텍스트만 받는 표면(패널 밖 하네스)을 위한 같은 내용의 글 — 지적은 어느 표면에서도 사라지지 않는다. */
export function refineFindingsText(rawFindings: readonly string[]): string {
  const findings = compactRefineFindings(rawFindings);
  return [`더 다듬을 곳 (${findings.length})`, ...findings.map(finding => `• ${finding}`), "마음에 들지 않으면 되돌릴 수 있어요."].join("\n");
}
