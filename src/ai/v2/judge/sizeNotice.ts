// 크기 알림을 모델에게 한 번 — 세는 맵·퀘스트·진행 깊이가 모자란 것은 거절(할 일 항목)이 아니라 알림이다.
//
// 왜(2026-11-16 r6b 역 앞 상점가 · 오너 방향): «짧은 이야기 게임, 전투는 없어도 돼» 에 출하 관문이 맵 6장 · 퀘스트 3개를 요구했다. 수의 하한은 요청이 말한
// 크기를 따르고(judge/blueprintScale.ts), 그래도 모자라면 알리기만 한다. 거절로 남는 것은 게임이 깨지는 것(엔딩에 못 닿는다 · 문이 안 닿는다 · 시작할 수 없다)뿐이다.
// 알리는 때: 모델이 마지막 할 일을 닫았을 때(todo 결과) 또는 끝맺음 관문이 항목을 덧붙일 때 — 실행 하나(할 일 표 하나)에 한 번.
import type { Project } from "@/project/types";
import { tagged } from "./finding";
import { findingEn } from "./findingEn";
import { sizeNotices } from "./shipChecks";

const told = new WeakSet<object>();

/** once = 이 실행의 할 일 표(같은 표에는 한 번만 알린다). 알릴 것이 없거나 이미 알렸으면 빈 글. 모델이 읽는다(영어). */
export function sizeNoticeOnce(once: object, project: Project, task: string): string {
  if (told.has(once)) return "";
  let list: ReturnType<typeof sizeNotices>;
  try { list = sizeNotices(project, task); } catch { return ""; }
  if (!list.length) return "";
  told.add(once);
  return ` [Size notice — not a requirement, nothing is blocked. Do these only if the request asks for a game this big; otherwise finish.] ${list.map((b) => findingEn(tagged("ship", b.id, b.message, { evidence: b.evidence })) ?? b.message).join(" ")}`;
}
