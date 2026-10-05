import { activityPayload, activityText, type ActivityTrace } from "./activityTrace";

/** Project receipts individually: sanitizing a whole trace would truncate its entries array. */
export function projectActivityTrace(trace: ActivityTrace, actor?: string): ActivityTrace {
  const entries = trace.entries.filter(entry => !actor || entry.actor === actor).map(entry => ({
    ...entry, summary: activityText(entry.summary),
    ...(entry.input === undefined ? {} : { input: activityPayload(entry.input) }),
    ...(entry.output === undefined ? {} : { output: activityPayload(entry.output) }),
  }));
  const actors = Object.fromEntries(Object.entries(trace.actors).filter(([id]) => !actor || id === actor)
    .map(([id, label]) => [id, activityText(label)]));
  return { ...trace, title: activityText(trace.title), actors, entries, bytes: JSON.stringify(entries).length };
}

export function formatActivityTraceText(trace: ActivityTrace, actor?: string): string {
  const record = projectActivityTrace(trace, actor);
  const label = (id: string) => record.actors[id] ?? (id === "system" ? "실행" : id);
  const lines = ["OPRN Studio · AI 실행 로그", record.title, `실행: ${record.id}`,
    `프로젝트: ${record.projectId}`, `상태: ${record.phase}`, `범위: ${actor ? label(actor) : "전체 실행"}`,
    `시작: ${new Date(record.startedAt).toISOString()}`, `갱신: ${new Date(record.updatedAt).toISOString()}`,
    `기록: ${record.entries.length}건`, `원본 실행에서 보존 상한으로 생략된 기록: ${record.dropped}건`,
    "그림은 참조만 포함합니다.", ""];
  for (const entry of record.entries) {
    lines.push(`${new Date(entry.at).toISOString()} · ${label(entry.actor)} · ${entry.name} · ${entry.status}${entry.durationMs === undefined ? "" : ` · ${entry.durationMs}ms`}`,
      entry.summary);
    if (entry.input !== undefined) lines.push("입력:", JSON.stringify(entry.input, null, 2));
    if (entry.output !== undefined) lines.push("결과:", JSON.stringify(entry.output, null, 2));
    lines.push("");
  }
  return lines.join("\n");
}
