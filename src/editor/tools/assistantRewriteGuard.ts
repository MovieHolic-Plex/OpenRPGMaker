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
export function guardWholeRecordRewrite(
  project: Project,
  name: string,
  args: Record<string, unknown>,
): { readonly args: Record<string, unknown>; readonly warnings: readonly string[] } {
  if (name === "upsert_event") return reduceWholePagesRewrite(project, args);
  if (name.startsWith("upsert_")) return reduceEchoedDatabaseRecord(project, name, args);
  return { args, warnings: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * 기존 이벤트의 pages 를 통째로 다시 보낸 upsert_event.
 * 페이지 수가 같으면 페이지마다 바뀐 commands 만 적용하고 나머지 페이지 칸(그림·조건·트리거)은 기존 값을 둔다 —
 * 2026-11-01 cheap r11 flash 가 단서 대사 하나를 바꾸려고 MV 모양 페이지(trigger:0, graphic.tileId:0, conditions:{})를
 * 세 번 보냈고 세 번 다 거부돼 단서가 끝내 안 들어갔다. 대사(commands)가 그 호출의 뜻이고, 나머지 칸은 읽은 값을 MV 습관으로 다시 적은 것이다.
 * 페이지 수가 다르거나 바뀐 commands 가 없으면 전처럼 거부한다(영어).
 */
function reduceWholePagesRewrite(project: Project, args: Record<string, unknown>): { readonly args: Record<string, unknown>; readonly warnings: readonly string[] } {
  const event = isRecord(args.event) ? args.event : undefined;
  if (args.replacePages === true || event?.replacePages === true) return { args, warnings: [] };
  if (!event || typeof event.id !== "string" || !Array.isArray(event.pages)) return { args, warnings: [] };
  const sent: unknown[] = event.pages;
  const map = typeof args.mapId === "string" ? project.maps[args.mapId] : undefined;
  const existing = map?.events.find(entry => entry.id === event.id);
  if (!existing || !(existing.pages?.length)) return { args, warnings: [] };
  const changed = existing.pages
    .map((page, index) => ({ index, same: jsonEqual(sent[index], page) }))
    .filter(entry => !entry.same).map(entry => entry.index);
  if (sent.length === existing.pages.length) {
    const cmdChanged: number[] = [];
    const pages = existing.pages.map((page, index) => {
      const got = sent[index];
      const cmds = isRecord(got) && Array.isArray(got.commands) ? got.commands : undefined;
      if (!cmds || jsonEqual(cmds, page.commands)) return page;
      cmdChanged.push(index);
      return { ...page, commands: cmds as typeof page.commands };
    });
    if (cmdChanged.length) {
      return {
        args: { ...args, event: { ...event, pages, replacePages: true } },
        warnings: [`upsert_event resent all pages of existing event '${event.id}' — applied only the changed commands of page ${cmdChanged.join(", ")} and kept every other page field as it was. To change other page fields use patch_event_page{mapId, eventId, pageIndex, set:{only the fields to change}}.`],
      };
    }
  }
  throw new ToolError(
    `upsert_event resent the whole pages array of existing event '${event.id}' (it has ${existing.pages.length} page(s), you sent ${sent.length}`
    + `${changed.length ? `; differing pages: ${changed.join(", ")}` : ""}) — that would rewrite pages and fields you did not mean to change. `
    + `To change one page use patch_event_page{mapId, eventId, pageIndex|pageId, set:{only the page fields to change}}. `
    + `Send upsert_event with replacePages:true only to add, remove or reorder pages, keeping the pages you keep exactly as read.`,
    { code: "whole-record-rewrite" },
  );
}

/** 보낸 칸 대부분이 기존 값과 같으면 「읽은 레코드를 되돌려 보낸」 것으로 본다. 새로 만드는 레코드는 검사하지 않는다. */
const ECHO_MIN_FIELDS = 6;
const ECHO_SAME_RATIO = 0.6;

function jsonKind(value: unknown): string {
  return value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
}

/**
 * 되돌려 보낸 DB 레코드를 「실제로 바뀐 칸」만 남긴 patch 로 줄인다.
 *
 * 처음에는 거부했다. 실측(2026-10-07 2회차, gpt-6.1-sol item-price): 거부 문구를 받고도 같은 전체 레코드를
 * 다섯 번 그대로 다시 보내다 가격을 못 바꾸고 끝났다. 그래서 거부 대신 의도가 드러나는 칸만 적용한다.
 * - 기존과 같은 칸: 버린다(병합 결과가 같다).
 * - 기존 레코드에 없던 칸: 버린다. 1회차의 farmTool:"hoe"·captureProfile 이 이 모양이었다(스키마 빈칸 채우기).
 * - 기존 값과 JSON 형이 다른 칸: 버린다. 저장값 "noLimit" 을 정수 스키마에 맞춰 5 로 바꾼 것이 이 모양이었다.
 * - 기존에 있던 칸의 같은 형 다른 값: 적용한다(가격 60 → 30).
 * 남는 칸이 없으면 성공처럼 보이지 않게 거부한다.
 */
function reduceEchoedDatabaseRecord(
  project: Project,
  name: string,
  args: Record<string, unknown>,
): { readonly args: Record<string, unknown>; readonly warnings: readonly string[] } {
  const unchanged = { args, warnings: [] as string[] };
  const entries = Object.entries(args).filter(([, value]) => isRecord(value) && typeof value.id === "string");
  if (entries.length !== 1) return unchanged;
  const [argName, patch] = entries[0]! as [string, Record<string, unknown>];
  const existing = findDatabaseRecord(project, patch.id as string);
  if (!existing) return unchanged;
  const keys = Object.keys(patch).filter(key => key !== "id");
  if (keys.length < ECHO_MIN_FIELDS) return unchanged;
  const differs = keys.filter(key => !jsonEqual(patch[key], existing[key]));
  if ((keys.length - differs.length) / keys.length < ECHO_SAME_RATIO) return unchanged;
  const added = differs.filter(key => existing[key] === undefined);
  const retyped = differs.filter(key => existing[key] !== undefined && jsonKind(existing[key]) !== jsonKind(patch[key]));
  const applied = differs.filter(key => !added.includes(key) && !retyped.includes(key));
  const dropped = [
    ...(added.length ? [`원래 없던 칸 ${added.join(", ")}`] : []),
    ...(retyped.length ? [`저장값과 형이 다른 칸 ${retyped.join(", ")}`] : []),
  ].join(", ");
  if (applied.length === 0) {
    throw new ToolError(
      `기존 레코드 '${patch.id}' 를 통째로 다시 보냈는데 기존 칸 중 바뀐 값이 없습니다${dropped ? `(무시한 것: ${dropped})` : ""}. `
      + `원래 없던 칸을 정말 추가하려면 {${argName}:{id:"${patch.id}", <그 칸>}} 처럼 그 칸만 따로 보내세요.`,
      { code: "whole-record-rewrite" },
    );
  }
  const reduced: Record<string, unknown> = { id: patch.id };
  for (const key of applied) reduced[key] = patch[key];
  return {
    args: { ...args, [argName]: reduced },
    warnings: [
      `${name}: 기존 레코드 '${patch.id}' 를 통째로 다시 보내서 바뀐 칸 ${applied.join(", ")} 만 적용했습니다`
      + `${dropped ? `. 무시한 것: ${dropped} — 사용자가 요청한 변경이면 그 칸만 따로 다시 보내세요` : ""}. 다음부터는 {id, 바꿀 칸}만 보내세요.`,
    ],
  };
}

function findDatabaseRecord(project: Project, id: string): Record<string, unknown> | undefined {
  const hits: Record<string, unknown>[] = [];
  for (const collection of Object.values(project.database ?? {})) {
    if (!Array.isArray(collection)) continue;
    for (const entry of collection) if (isRecord(entry) && entry.id === id) hits.push(entry);
  }
  return hits.length === 1 ? hits[0] : undefined;
}
