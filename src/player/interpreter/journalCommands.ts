// player/interpreter/journalCommands.ts
// «Journal Line»(일지에 한 줄 쓰기) 해석 — 즉시 끝나는 기록 명령(High Score 와 같은 꼴). 규칙·모양은 project/storyJournal.ts.
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";
import { learnSkill } from "@/project/session";
import { JOURNAL_LINE_LIMIT, type JournalLine } from "@/project/storyJournal";

export type JournalLineAction = "write" | "erase" | "reread";

const str = (fields: Readonly<Record<string, unknown>>, key: string): string => {
  const value = fields[key];
  return typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
};

/**
 * «Journal Line» 명령 하나를 세션에 적용한다.
 * - write: 같은 lineId 가 있으면 고쳐 쓰고(보통 상태로), 없으면 맨 뒤에 덧붙인다. lineId 를 비우면 순번 id 를 만든다.
 * - erase: 그 줄을 지운다(메뉴에서 흐리게 보인다). 없는 줄이면 아무 일도 없다.
 * - reread: 지워진 줄을 되살린다. 줄(또는 명령)에 learnActorId·learnSkillId 가 있으면 그 배우가 기술을 배운다.
 * 결과를 돌려준다(도구·테스트가 읽는다). resultSwitchId 가 있으면 실제로 상태가 바뀌었을 때 켠다.
 */
export function applyJournalLine(session: PlaySessionLike, fields: Readonly<Record<string, unknown>>): { changed: boolean; lineId: string } {
  const action: JournalLineAction = fields.action === "erase" || fields.action === "reread" ? fields.action : "write";
  const lines = [...(session.storyJournal ?? [])];
  let lineId = str(fields, "lineId");
  const index = lineId ? lines.findIndex((line) => line.id === lineId) : -1;
  const learnActorId = str(fields, "learnActorId");
  const learnSkillId = str(fields, "learnSkillId");
  let changed = false;
  if (action === "write") {
    const text = str(fields, "text");
    if (!text) return { changed: false, lineId };
    if (!lineId) {
      let n = lines.length + 1;
      while (lines.some((line) => line.id === `line-${n}`)) n += 1;
      lineId = `line-${n}`;
    }
    const prev = index >= 0 ? lines[index] : undefined;
    const next: JournalLine = {
      id: lineId,
      writer: str(fields, "writer") || prev?.writer || "",
      date: str(fields, "date") || prev?.date || "",
      text,
      state: "normal",
      ...((learnActorId || prev?.learnActorId) ? { learnActorId: learnActorId || prev?.learnActorId } : {}),
      ...((learnSkillId || prev?.learnSkillId) ? { learnSkillId: learnSkillId || prev?.learnSkillId } : {}),
    };
    if (index >= 0) lines[index] = next;
    else lines.push(next);
    changed = true;
  } else if (index >= 0) {
    const line = lines[index]!;
    if (action === "erase" && line.state !== "erased") {
      lines[index] = { ...line, state: "erased" };
      changed = true;
    } else if (action === "reread" && line.state === "erased") {
      lines[index] = { ...line, state: "reread" };
      changed = true;
      const actorId = learnActorId || line.learnActorId;
      const skillId = learnSkillId || line.learnSkillId;
      if (actorId && skillId) learnSkill(session, actorId, skillId);
    }
  }
  session.storyJournal = lines.slice(-JOURNAL_LINE_LIMIT);
  const resultSwitchId = str(fields, "resultSwitchId");
  if (resultSwitchId && changed) session.switches[resultSwitchId] = true;
  return { changed, lineId };
}
