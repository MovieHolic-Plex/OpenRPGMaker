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
export function completionHeadline(made: string | null, options: { readonly unverified: boolean }): string {
  const lines = [made ?? "변경 내용을 반영했어요.", COMPLETION_PLAY_HINT];
  if (options.unverified) lines.push("끝까지 확인하지는 못했어요. 마음에 들지 않으면 되돌릴 수 있어요.");
  return lines.join("\n");
}

/**
 * 「더 다듬을 곳 (N)」 접은 칸. 간단히 보기(기본)에서는 접혀 있고, 자세히 보기에서는 펼쳐 둔다.
 * 지적 문장은 검토 모델이 쓴 그대로 둔다 — 바꿔 쓰면 무엇이 지적됐는지가 흐려진다. 머리말만 부드럽게.
 */
export function createRefineFindings(findings: readonly string[]): HTMLElement {
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
export function refineFindingsText(findings: readonly string[]): string {
  return [`더 다듬을 곳 (${findings.length})`, ...findings.map(finding => `• ${finding}`), "마음에 들지 않으면 되돌릴 수 있어요."].join("\n");
}
