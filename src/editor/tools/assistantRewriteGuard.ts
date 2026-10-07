import { jsonEqual } from "@/util/structuralJson";
import type { Project } from "@/project/types";
import { ToolError } from "./types";

/**
 * 조수 실행이 기존 레코드를 「통째로 다시 보내는」 쓰기를 거부한다.
 *
 * 실측(2026-10-07 조수 기능 시험 12과제 × gpt-6.1-sol·gemini-3.8-flash): 실패 6판 중 4판이 같은 모양이었다.
 * 그림 하나·가격 하나를 바꾸면서 읽은 레코드 전체를 다시 보냈고, 그 사이에 요청 밖 칸이 바뀌었다
 * (다른 페이지 조건 present 뒤집기, 두 페이지 animationType 추가, 회복약에 없던 farmTool:"hoe"·captureProfile).
 * 실행기는 사용자 요청을 모르므로 어느 칸이 의도인지 판정할 수 없다 — 대신 의도가 드러나는 모양(바꿀 칸만)을 강제한다.
 * 편집기 UI·예제·콘텐츠 스크립트는 ctx.assistantRun 을 켜지 않으므로 이 검사를 받지 않는다.
 */
export function rejectWholeRecordRewrite(project: Project, name: string, args: Record<string, unknown>): void {
  if (name === "upsert_event") rejectWholePagesRewrite(project, args);
  else if (name.startsWith("upsert_")) rejectEchoedDatabaseRecord(project, name, args);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function rejectWholePagesRewrite(project: Project, args: Record<string, unknown>): void {
  if (args.replacePages === true) return;
  const event = isRecord(args.event) ? args.event : undefined;
  if (!event || typeof event.id !== "string" || !Array.isArray(event.pages)) return;
  const sent: unknown[] = event.pages;
  const map = typeof args.mapId === "string" ? project.maps[args.mapId] : undefined;
  const existing = map?.events.find(entry => entry.id === event.id);
  if (!existing || !(existing.pages?.length)) return;
  const changed = existing.pages
    .map((page, index) => ({ index, same: jsonEqual(sent[index], page) }))
    .filter(entry => !entry.same).map(entry => entry.index);
  throw new ToolError(
    `기존 이벤트 '${event.id}' 의 pages 배열 전체를 다시 보냈습니다(기존 ${existing.pages.length}페이지, 보낸 ${sent.length}페이지`
    + `${changed.length ? `, 기존과 다른 페이지 ${changed.join(", ")}` : ""}). 전체를 다시 쓰면 바꾸지 않을 페이지·칸까지 다시 쓰게 됩니다. `
    + `한 페이지의 칸만 바꾸려면 patch_event_page{mapId,eventId,pageIndex|pageId,set:{바꿀 페이지 필드만}}를 쓰세요. `
    + `페이지를 추가·삭제·순서 변경해야 할 때만 upsert_event 에 replacePages:true 를 함께 보내고, 유지할 페이지는 읽은 값 그대로 두세요.`,
    { code: "whole-record-rewrite" },
  );
}

/** 보낸 칸 대부분이 기존 값과 같으면 「읽은 레코드를 되돌려 보낸」 것으로 본다. 새로 만드는 레코드는 검사하지 않는다. */
const ECHO_MIN_FIELDS = 6;
const ECHO_SAME_RATIO = 0.6;

function rejectEchoedDatabaseRecord(project: Project, name: string, args: Record<string, unknown>): void {
  const entries = Object.entries(args).filter(([, value]) => isRecord(value) && typeof value.id === "string");
  if (entries.length !== 1) return;
  const [argName, patch] = entries[0]! as [string, Record<string, unknown>];
  const existing = findDatabaseRecord(project, patch.id as string);
  if (!existing) return;
  const keys = Object.keys(patch).filter(key => key !== "id");
  if (keys.length < ECHO_MIN_FIELDS) return;
  const differs = keys.filter(key => !jsonEqual(patch[key], existing[key]));
  if ((keys.length - differs.length) / keys.length < ECHO_SAME_RATIO) return;
  const added = differs.filter(key => existing[key] === undefined);
  throw new ToolError(
    `기존 레코드 '${patch.id}' 를 통째로 다시 보냈습니다(보낸 칸 ${keys.length}개 중 ${keys.length - differs.length}개가 기존과 같음). `
    + `${name} 은 기존 id 에 보낸 칸만 병합하므로, 바꿀 칸만 보내세요: {${argName}:{id:"${patch.id}", <바꿀 칸>}}. `
    + `기존과 다른 칸: ${differs.join(", ") || "없음"}${added.length ? ` — 이 중 ${added.join(", ")} 는 원래 없던 칸입니다` : ""}. 사용자가 요청한 칸만 남기세요.`,
    { code: "whole-record-rewrite" },
  );
}

function findDatabaseRecord(project: Project, id: string): Record<string, unknown> | undefined {
  const hits: Record<string, unknown>[] = [];
  for (const collection of Object.values(project.database ?? {})) {
    if (!Array.isArray(collection)) continue;
    for (const entry of collection) if (isRecord(entry) && entry.id === id) hits.push(entry);
  }
  return hits.length === 1 ? hits[0] : undefined;
}
