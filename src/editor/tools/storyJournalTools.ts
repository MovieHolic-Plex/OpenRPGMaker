// 이야기 일지(2026-10-25) — ESC 메뉴 「일지」 항목 + 이벤트에서 한 줄씩 쌓는 «Journal Line» 명령을 한 번에 짓는다.
// 일지 제목·필체는 meta.oprnStoryJournal, 줄은 세이브(session.storyJournal)에 쌓인다. 지운 줄은 메뉴에서 흐리게 보이고,
// 「다시 읽어 주기」 로 되살리면 그 줄에 묶인 배우가 기술을 (되)배운다(learnActorId·learnSkillId).
import { FIELD_MENU_DEFAULT_LABELS } from "@/project/menuSystem";
import { validateFieldMenu } from "@/project/fieldMenu";
import { STORY_JOURNAL_DEFAULT_TITLE, validateStoryJournal, type AuthoredStoryJournal } from "@/project/storyJournal";
import type { Command, Project } from "@/project/types";
import { m2 } from "./puzzleKit";
import { insertAfterText } from "./revealTools";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

type LineArg = {
  mapId?: string; eventId?: string; pageId?: string; commonEventId?: string; afterText?: string;
  action?: string; lineId?: string; writer?: string; date?: string; text?: string;
  learnActorId?: string; learnSkillId?: string; say?: string; resultSwitchId?: string;
};

const s = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/** 저작된 ESC 메뉴가 있으면 「일지」 항목을 넣는다(저장 앞). 없으면 기본 메뉴가 일지 설정을 보고 스스로 보인다. */
function ensureMenuEntry(p: Project, label: string): string {
  const menu = p.meta.oprnFieldMenu;
  if (!menu) return "기본 ESC 메뉴의 「기록」 묶음에 일지가 보입니다";
  if (menu.entries.some((entry) => entry.command === "journal")) return "ESC 메뉴에 일지 항목이 이미 있습니다";
  if (menu.entries.length >= 12) return "저작된 ESC 메뉴가 이미 12칸이라 일지 항목을 넣지 못했습니다 — configure_field_menu 로 한 칸 비우고 add:[{command:\"journal\"}]";
  const entries = [...menu.entries];
  const at = entries.findIndex((entry) => entry.command === "save" || entry.command === "to-title");
  entries.splice(at < 0 ? entries.length : at, 0, { command: "journal", label });
  const next = { ...menu, entries };
  validateFieldMenu(next);
  p.meta.oprnFieldMenu = next;
  return "저작된 ESC 메뉴에 일지 항목을 넣었습니다";
}

const configureStoryJournal: ToolDefinition = {
  name: "configure_story_journal",
  mode: "write",
  domains: ["event", "system"],
  description:
    "이야기 일지를 짓는다: ESC 메뉴에 「일지」 항목(제목·필체 목록)을 켜고, lines 로 이벤트마다 «Journal Line»(일지에 한 줄 쓰기) 명령을 넣는다. " +
    "줄마다 필체(writer: writers 의 id)·날짜 칸(date)·내용(text). action:\"erase\" 는 그 줄을 지우고(메뉴에서 흐리게), action:\"reread\" 는 지워진 줄을 다시 읽어 되살린다 — " +
    "그 줄(또는 이 항목)에 learnActorId·learnSkillId 가 있으면 다시 읽을 때 그 배우가 기술을 되찾는다. say 를 주면 명령 바로 앞에 대사 한 줄(예: 카엘이 읽어 주는 말)을 넣는다. " +
    "줄은 세이브에 들어간다. 이미 이벤트 본문을 쓰고 있으면 m2 «Journal Line»(action write|erase|reread, lineId, writer, date, text, learnActorId, learnSkillId, resultSwitchId) 을 직접 넣어도 된다. " +
    "일지를 퀘스트·변수·그림으로 흉내내지 말고 이 도구를 쓴다. remove:true 는 일지 설정을 지운다(이미 넣은 명령은 그대로).",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "메뉴 항목·화면 제목(1~12자). 기본 「일지」" },
      writers: {
        type: "array",
        description: "필체 목록(최대 16). 예: [{id:\"iris\",name:\"이리스\"},{id:\"kael\",name:\"카엘\"}]",
        items: {
          type: "object",
          properties: { id: { type: "string" }, name: { type: "string" } },
          required: ["id", "name"],
          additionalProperties: false,
        },
      },
      lines: {
        type: "array",
        description: "이벤트에 넣을 일지 명령들. 맵 이벤트(mapId+eventId) 또는 공통 이벤트(commonEventId).",
        items: {
          type: "object",
          properties: {
            mapId: { type: "string" },
            eventId: { type: "string" },
            pageId: { type: "string", description: "넣을 페이지. 생략 = 마지막 페이지(afterText 가 있으면 그 대사가 든 페이지)" },
            commonEventId: { type: "string" },
            afterText: { type: "string", description: "이 글자가 든 대사 바로 뒤에 넣는다. 생략 = 페이지 끝" },
            action: { type: "string", enum: ["write", "erase", "reread"], description: "기본 write" },
            lineId: { type: "string", description: "줄 id. erase·reread 는 필수, write 는 나중에 지우거나 다시 읽을 줄이면 꼭 준다" },
            writer: { type: "string", description: "필체 id(writers) — write 에서" },
            date: { type: "string", description: "날짜 칸(예: 「서리달 4일」) — write 에서" },
            text: { type: "string", description: "줄 내용 — write 에서 필수" },
            learnActorId: { type: "string", description: "다시 읽을 때 기술을 배울 배우" },
            learnSkillId: { type: "string", description: "다시 읽을 때 배울 기술" },
            say: { type: "string", description: "명령 앞에 넣을 대사 한 줄" },
            resultSwitchId: { type: "string", description: "실제로 줄이 바뀌면 켤 스위치" },
          },
          additionalProperties: false,
        },
      },
      remove: { type: "boolean", description: "일지 설정을 지운다" },
    },
    additionalProperties: false,
  },
  invalidArgsExample: {
    title: "이리스의 일지",
    writers: [{ id: "iris", name: "이리스" }, { id: "kael", name: "카엘" }],
    lines: [
      { mapId: "map_crash_site", eventId: "ev_wake", action: "write", lineId: "day1", writer: "iris", date: "1일째", text: "별이 떨어진 밤, 그를 만났다." },
      { mapId: "map_tower_3f", eventId: "ev_erase", action: "erase", lineId: "day1" },
      { mapId: "map_tower_top", eventId: "ev_read", action: "reread", lineId: "day1", learnActorId: "actor_iris", learnSkillId: "skill_starsong", say: "카엘: 「별이 떨어진 밤, 그를 만났다.」 …기억나?" },
    ],
  },
  run(draft, args): ToolExecResult {
    if (args.remove === true) {
      delete draft.meta.oprnStoryJournal;
      return { summary: "이야기 일지 설정을 지웠습니다(이벤트에 넣은 명령은 그대로입니다).", data: { removed: true } };
    }
    const prev = draft.meta.oprnStoryJournal;
    const title = s(args.title) || prev?.title || STORY_JOURNAL_DEFAULT_TITLE;
    const writersArg = Array.isArray(args.writers) ? (args.writers as { id?: unknown; name?: unknown }[]) : undefined;
    const writers = writersArg
      ? writersArg.map((row) => ({ id: s(row?.id), name: s(row?.name) }))
      : [...(prev?.writers ?? [])];
    const journal: AuthoredStoryJournal = { version: 1, title, writers };
    try {
      validateStoryJournal(journal);
    } catch (error) {
      throw new ToolError(`${String(error)} — 제목은 1~12자, 필체는 최대 16개이고 id·name 이 모두 있어야 하며 id 는 겹치면 안 됩니다.`, { code: "invalid-args" });
    }
    draft.meta.oprnStoryJournal = journal;
    const menuNotice = ensureMenuEntry(draft, title);

    const warnings: string[] = [];
    const placed: { lineId: string; action: string; where: string }[] = [];
    const lines = Array.isArray(args.lines) ? (args.lines as LineArg[]) : [];
    const writtenText = new Map<string, string>();
    for (const [index, line] of lines.entries()) {
      const action = line.action === "erase" || line.action === "reread" ? line.action : "write";
      const lineId = s(line.lineId);
      const text = s(line.text);
      if (action !== "write" && !lineId) throw new ToolError(`lines[${index}]: ${action} 에는 lineId 가 필요합니다.`, { code: "invalid-args" });
      if (action === "write" && !text) throw new ToolError(`lines[${index}]: write 에는 text 가 필요합니다.`, { code: "invalid-args" });
      const writer = s(line.writer);
      if (writer && !writers.some((row) => row.id === writer)) warnings.push(`lines[${index}]: 필체 ${writer} 가 writers 에 없어 글자 그대로 보입니다`);
      const actorId = s(line.learnActorId), skillId = s(line.learnSkillId);
      if ((actorId && !skillId) || (!actorId && skillId)) throw new ToolError(`lines[${index}]: learnActorId 와 learnSkillId 는 같이 줘야 합니다.`, { code: "invalid-args" });
      if (actorId && !draft.database.actors.some((actor) => actor.id === actorId)) throw new ToolError(`lines[${index}]: 배우 ${actorId} 가 없습니다.`, { code: "invalid-args" });
      if (skillId && !draft.database.skills.some((skill) => skill.id === skillId)) throw new ToolError(`lines[${index}]: 기술 ${skillId} 가 없습니다.`, { code: "invalid-args" });
      if (action === "write" && lineId) writtenText.set(lineId, text);
      if (action !== "write" && !writtenText.has(lineId) && !lines.some((other) => s(other.lineId) === lineId && (other.action ?? "write") === "write")) {
        warnings.push(`lines[${index}]: 이 호출에서 쓴 적 없는 줄 ${lineId} — 다른 곳에서 먼저 쓰여야 합니다`);
      }
      const fields: Record<string, string> = { action, lineId };
      if (action === "write") Object.assign(fields, { writer, date: s(line.date), text });
      if (actorId) Object.assign(fields, { learnActorId: actorId, learnSkillId: skillId });
      if (s(line.resultSwitchId)) fields.resultSwitchId = s(line.resultSwitchId);
      const inserted: Command[] = [
        ...(s(line.say) ? [{ kind: "text", body: s(line.say) } as Command] : []),
        m2("Journal Line", fields),
      ];
      const anchor = s(line.afterText);
      let where: string;
      if (s(line.commonEventId)) {
        const common = draft.commonEvents.find((entry) => entry.id === s(line.commonEventId));
        if (!common) throw new ToolError(`lines[${index}]: 공통 이벤트 ${s(line.commonEventId)} 가 없습니다.`, { code: "invalid-args" });
        if (!(anchor && insertAfterText(common.commands, anchor, inserted))) {
          if (anchor) warnings.push(`lines[${index}]: 「${anchor}」 대사를 못 찾아 끝에 넣었습니다`);
          common.commands.push(...inserted);
        }
        where = `공통 ${common.id}`;
      } else {
        const map = draft.maps[s(line.mapId)];
        if (!map) throw new ToolError(`lines[${index}]: 맵 ${s(line.mapId) || "(없음)"} 이 없습니다. mapId+eventId 또는 commonEventId 가 필요합니다.`, { code: "invalid-args" });
        const event = map.events.find((entry) => entry.id === s(line.eventId));
        if (!event) throw new ToolError(`lines[${index}]: ${map.id} 에 이벤트 ${s(line.eventId) || "(없음)"} 가 없습니다.`, { code: "invalid-args" });
        const pages = event.pages ?? [];
        if (pages.length === 0) throw new ToolError(`lines[${index}]: 이벤트 ${event.id} 에 페이지가 없습니다.`, { code: "invalid-args" });
        const pageId = s(line.pageId);
        const candidates = pageId ? pages.filter((page) => page.id === pageId) : anchor ? pages : [pages[pages.length - 1]!];
        if (candidates.length === 0) throw new ToolError(`lines[${index}]: 페이지 ${pageId} 가 없습니다.`, { code: "invalid-args" });
        let placedPage = anchor ? candidates.find((page) => insertAfterText(page.commands as Command[], anchor, inserted)) : undefined;
        if (!placedPage) {
          if (anchor) warnings.push(`lines[${index}]: 「${anchor}」 대사를 못 찾아 페이지 끝에 넣었습니다`);
          placedPage = candidates[candidates.length - 1]!;
          (placedPage.commands as Command[]).push(...inserted);
        }
        where = `${map.id}/${event.id}/${placedPage.id}`;
      }
      placed.push({ lineId: lineId || "(자동)", action, where });
    }
    const counts = { write: 0, erase: 0, reread: 0 } as Record<string, number>;
    for (const row of placed) counts[row.action] = (counts[row.action] ?? 0) + 1;
    return {
      summary:
        `이야기 일지 「${title}」(필체 ${writers.map((row) => row.name).join("·") || "없음"}) — ${menuNotice}. ` +
        (placed.length ? `일지 명령 ${placed.length}개(쓰기 ${counts.write}·지우기 ${counts.erase}·다시 읽기 ${counts.reread})를 넣었습니다.` : "넣은 명령은 없습니다.") +
        (warnings.length ? ` 주의: ${warnings.join("; ")}.` : ""),
      data: { title, writers, menuLabel: FIELD_MENU_DEFAULT_LABELS.journal, placed, warnings },
    };
  },
};

export const STORY_JOURNAL_TOOLS: readonly ToolDefinition[] = [configureStoryJournal];
