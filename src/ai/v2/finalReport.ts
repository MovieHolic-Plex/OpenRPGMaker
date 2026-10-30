// 제공자 일반 오류 문장을 최종 답으로 두지 않기(2026-10-28 mt3 flash escape·mt2 argon escape): 검토 뒤 마지막 모델 호출이
// «I seem to be encountering an error. Can I try something else for you?» / «Sorry, something went wrong» / «I'm having a hard time…» 를
// 돌려주고, 그 글이 사용자에게 보이는 최종 답이 됐다(바로 앞에는 정직한 «최종 보고(앞 보고를 고침)»가 있었다).
// → 이런 글은 보고가 아니다: 대화창으로 보내지 않고, 앞의 정직한 보고를 마지막 답으로 둔다. 앞 보고가 없으면 함수가 조립한 보고를 쓴다.
import type { Project } from "@/project/types";
import { walkBlueprint } from "./blueprint";

const GENERIC = [
  /^\s*(i'?m )?sorry[,.!]? (but )?something went wrong/iu,
  /^\s*i seem to be (encountering|having) (an )?(error|trouble|issue)/iu,
  /^\s*i encountered an error/iu,
  /^\s*i'?m having (a hard time|trouble)/iu,
  /^\s*something went wrong/iu,
  /^\s*(an )?(unexpected |internal )?error (has )?occurred/iu,
  /^\s*i (can(no|')t|am unable to) (help|do|fulfil)/iu,
];

/** 한글이 없고 짧은 영어 사과·오류 문장(제공자 기본 응답). 한글 보고에 섞인 영어 낱말은 해당하지 않는다. */
export function isProviderErrorReply(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (/[가-힣]/u.test(t) || t.length > 300) return false;
  return GENERIC.some((re) => re.test(t)) || /\b(try (your request )?again|something else (for|instead))\b/iu.test(t);
}

/** 앞 보고가 없을 때 쓰는 결정적 보고 — 실제 프로젝트 상태만 적는다. */
export function assembledReport(project: Project, extra: readonly string[] = []): string {
  const maps = Object.values(project.maps);
  const bp = project.gameBlueprint;
  const lines = ["최종 보고(모델이 보고를 쓰지 못해 함수가 조립):",
    `- 맵 ${maps.length}개: ${maps.map((m) => `«${m.name ?? m.id}»${m.id === project.startMapId ? "(시작)" : ""}`).join(", ").slice(0, 300)}`];
  if (bp) {
    const blockers = walkBlueprint(project).blockers;
    lines.push(`- 청사진 「${bp.title ?? ""}」 ${bp.steps.length}단계 → 엔딩 「${bp.ending.name}」: ${blockers.length ? `아직 막힘 ${blockers.length}건 — ${blockers.map((b) => b.message).join(" / ").slice(0, 400)}` : "시작에서 엔딩까지 이어짐(기계 확인)"}`);
  }
  for (const e of extra) lines.push(`- ${e}`);
  return lines.join("\n");
}
