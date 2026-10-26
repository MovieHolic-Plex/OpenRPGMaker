// 조수 v2 의 평문 턴은 매번 새 실행이다 — 요청에는 이번 입력창 글만 실린다. 두 번째 턴이
// 「처음에 부탁한 대로 끝까지 만들어 줘」 하면 모델은 처음 부탁을 모른 채 시작 맵 이름(버들항)을 게임 주제로 삼아
// 밤의 학교 공포 게임 제목을 「버들항의 모험」으로 덮었다(J70, hf2-school-flash 2턴).
// 같은 대화의 앞선 사용자 요청을 의도 메모로 함께 싣는다. 사용자 글(command.task)은 그대로 두어 활동 기록·낱말 판정이 바뀌지 않는다.
import type { AuditEntry } from "@/ai/assistantSession";

const PER_REQUEST_MAX = 1500;
const TOTAL_MAX = 4000;
const KEEP = 4;

const clip = (text: string, max: number): string => (text.length > max ? `${text.slice(0, max)}…` : text);

/** 앞선 사용자 요청 메모. 앞 요청이 없으면 null. 같은 글이 이어 들어온 것(재시도)은 한 번만 싣는다. */
export function priorRequestsNote(entries: readonly AuditEntry[], current: string): string | null {
  const now = current.trim();
  const seen: string[] = [];
  for (const entry of entries) {
    if (entry.kind !== "user") continue;
    const text = entry.text.trim();
    if (!text || text === now || seen[seen.length - 1] === text) continue;
    seen.push(text);
  }
  if (!seen.length) return null;
  // 첫 요청은 게임 전체를 정한 글이라 늘 남기고, 나머지는 최근 것부터 채운다.
  const picked = seen.length <= KEEP ? seen : [seen[0]!, ...seen.slice(-(KEEP - 1))];
  const lines: string[] = [];
  let used = 0;
  for (const [i, text] of picked.entries()) {
    const line = `${i + 1}. ${clip(text, PER_REQUEST_MAX)}`;
    if (used + line.length > TOTAL_MAX && lines.length) break;
    lines.push(line); used += line.length;
  }
  return [
    "[같은 대화의 앞선 사용자 요청 — 오래된 것부터]",
    ...lines,
    // 이 안내 줄은 wantsWholeGame 낱말(게임…만들·엔딩까지 등)을 쓰지 않는다 — 작은 고치기 턴을 출하 검사 턴으로 바꾸지 않게.
    // 앞 요청 자체가 게임 요청이면 이어 짓기 턴도 게임 요청으로 보는 것이 맞다.
    "이번 글이 「처음에 부탁한 대로」「계속」처럼 앞 요청을 가리키면 위 요청이 이번 작업의 바탕이다. 제목·주제·결말을 시작 맵 이름이나 기본값에서 지어내지 말고 위 요청과 이미 지은 프로젝트를 따른다. 위 요청과 이번 글이 어긋나면 이번 글이 이긴다.",
  ].join("\n");
}
