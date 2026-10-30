// 제공자 일반 오류 문장을 최종 답으로 두지 않기(2026-10-28 mt3 flash escape·mt2 argon escape): 검토 뒤 마지막 모델 호출이
// «I seem to be encountering an error. Can I try something else for you?» / «Sorry, something went wrong» / «I'm having a hard time…» 를
// 돌려주고, 그 글이 사용자에게 보이는 최종 답이 됐다(바로 앞에는 정직한 «최종 보고(앞 보고를 고침)»가 있었다).
// → 이런 글은 보고가 아니다: 대화창으로 보내지 않고, 앞의 정직한 보고를 마지막 답으로 둔다. 앞 보고가 없으면 함수가 조립한 보고를 쓴다.
import type { Project } from "@/project/types";
import { walkBlueprint } from "./blueprint";
import type { TodoStore } from "./loop/todoStore";
import { checkLabel } from "./loop/todoStore";
import type { TodoItem } from "./todo/types";

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

// ── 할 일 고리의 최종 보고(2026-10-30 omo 고리) ──────────────────────────────────────────────
// 「완료」는 열린 항목 0 · 막힘 0 · 기계 확인이 달린 항목 전부 ✓ 일 때만. 아니면 항목별 ✓/✗/막힘 표를 기계 결과로 만들고,
// 조수 보고가 «만들었다»고 쓴 항목이 ✗ 면 그 줄을 기계 결과로 고친다(claim receipt). 조수 보고는 참고로 뒤에 둔다.

const SUCCESS_WORD = /만들|지었|짓고|지어|추가|넣었|넣어|세웠|두었|놓았|완료|마쳤|됐|되었|했습니다|했다|이었|연결|붙였|걸었|열린다|열리|싸운|싸우|말을 ?(겁|건|걸)|나온다|나옵니다|등장|바뀐다|바뀝니다|받는다|받습니다/u;
const FAIL_WORD = /못\s|못했|안\s?됐|실패|하지 않|않았|없었|거부|거절|막혔|미완|남은/u;

function subjects(item: TodoItem): string[] {
  const c = item.check;
  const fromCheck = !c ? [] : c.kind === "place" || c.kind === "person" || c.kind === "item" ? [c.name]
    : c.kind === "talk" ? [c.who] : c.kind === "battle" ? [c.who ?? ""]
    : c.kind === "link" ? [c.to] : c.kind === "present_evidence" ? [c.item] : c.kind === "reachable" ? [c.target] : c.kind === "ending" ? ["엔딩"] : [];
  return fromCheck.map((s) => s.trim()).filter((s) => s.length >= 2);
}

/** 조수 보고에서 이 항목을 «했다»고 쓴 문장. 없으면 undefined. */
export function claimedSentence(draft: string, item: TodoItem): string | undefined {
  const names = subjects(item);
  if (!names.length) return undefined;
  for (const sentence of draft.split(/(?<=[.!?。])\s+|\n+/u)) {
    if (!names.some((n) => sentence.includes(n))) continue;
    if (SUCCESS_WORD.test(sentence) && !FAIL_WORD.test(sentence)) return sentence.trim().slice(0, 200);
  }
  return undefined;
}

export interface TodoReportInput {
  readonly store: TodoStore;
  readonly draft: string;
  readonly leftovers?: readonly string[];
  readonly missing?: readonly string[];
  readonly autoNotes?: readonly string[];
  readonly loopStop?: string;
  readonly vqa?: string;
}

const cell = (text: string) => text.replace(/\|/gu, "/").replace(/\n+/gu, " ").slice(0, 160);

export function todoReport(input: TodoReportInput): { text: string; complete: boolean; receipts: string[] } {
  const { store, draft } = input;
  const rows: string[] = [];
  const receipts: string[] = [];
  let failing = 0;
  for (const item of store.items) {
    const m = store.meta.get(item.id);
    const checked = item.check && item.check.kind !== "none";
    let mark: string, why: string;
    if (item.status === "completed") {
      if (checked && m?.lastCheck && !m.lastCheck.pass) { mark = "✗"; why = m.lastCheck.detail; failing += 1; }
      else { mark = "✓"; why = checked ? (m?.lastCheck?.detail ?? checkLabel(item.check)) : m?.closedBy === "auto" ? "함수 검사에서 사라짐" : "조수 표시(기계 확인 없음)"; }
    } else if (item.status === "blocked") { mark = "막힘"; why = item.blockedReason ?? ""; }
    else if (item.status === "dropped") { mark = "뺌"; why = item.blockedReason ?? ""; }
    else { mark = "✗"; why = m?.lastCheck && !m.lastCheck.pass ? m.lastCheck.detail : m?.lastFail ?? "끝내지 않음"; failing += 1; }
    rows.push(`| ${item.id} ${cell(item.content)}${item.source === "model" ? "" : ` (${item.source === "gate" ? "함수 검사" : item.source === "critic" ? "비평" : "화면 검수"})`} | ${mark} | ${cell(why)} |`);
    if (mark !== "✓" && mark !== "뺌") {
      const claim = claimedSentence(draft, item);
      if (claim) receipts.push(`- 보고에 «${claim}» 라고 썼지만 기계 결과는 ${mark}: ${cell(why)}`);
    }
  }
  const c = store.counts();
  const complete = store.items.length > 0 && c.open === 0 && c.blocked === 0 && failing === 0 && !(input.leftovers?.length);
  const table = rows.length ? ["| 할 일 | 결과 | 근거(기계) |", "|---|---|---|", ...rows] : [];
  const tail = [
    ...(input.leftovers?.length ? ["남은 문제(함수 검사 기록 — 고치기 상한):", ...input.leftovers.map((l) => `- ${l.slice(0, 220)}`)] : []),
    ...(input.missing?.length ? [`그림·부품이 없어 못 한 것: ${input.missing.join(" / ").slice(0, 400)}`] : []),
    ...(input.vqa ? [input.vqa] : []),
    ...(input.autoNotes?.length ? ["자동으로 지음(함수):", ...input.autoNotes.map((n) => `- ${n.slice(0, 300)}`)] : []),
  ];
  if (complete) {
    return { complete, receipts, text: [draft.trim(), "", `[할 일 ${c.done}/${c.total} ✓ — 기계 확인]`, ...table, ...(tail.length ? ["", ...tail] : [])].join("\n") };
  }
  const head = `최종 보고(기계 확인 — 아직 완료 아님: 열림 ${c.open} · 막힘 ${c.blocked} · ✗ ${failing - c.open}${input.loopStop ? ` · 고리 멈춤: ${input.loopStop}` : ""}):`;
  return { complete, receipts, text: [head, ...table,
    ...(receipts.length ? ["", "보고와 다른 것(기계 결과로 고침):", ...receipts] : []),
    ...(tail.length ? ["", ...tail] : []),
    ...(draft.trim() ? ["", "조수 보고(참고 — 위 표가 우선):", draft.trim().replace(/^최종 보고\(앞 보고를 고침\):\s*/u, "")] : []),
  ].join("\n") };
}
