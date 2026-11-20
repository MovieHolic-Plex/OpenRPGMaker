import { t } from "@/i18n";
import { diffCommandLists } from "@/editor/panels/eventEditor/commandDiff";
import { buildChangeLedger, type ChangeLedgerEntry } from "@/project/changeLedger";
import { nestedCommandLists } from "@/project/authoredCommandIndex";
import type { Command, GameEvent, Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import { displayText } from "./target";

const changes = { added: "{0} 항목 추가", removed: "{0} 항목 삭제" };

function format(template: string, ...values: string[]): string {
  return t(template).replace(/\{(\d+)\}/gu, (_, index: string) => values[Number(index)] ?? "");
}
const other = "그 밖의 설정 1곳 바뀜";
// These ledger fields can contain opaque asset or record keys even without an underscore.
const referenceFields = new Set(["타일셋", "BGM", "배경음", "적 그룹", "캐릭터", "장소", "종", "시작 맵"]);
export function ledgerLines(entry: ChangeLedgerEntry): string[] {
  const kind = entry.area.split(" · ").at(-1) ?? "";
  const category = entry.event ? "이벤트" : kind;
  if (!/[가-힣]/u.test(category)) return [t(other)];
  const label = entry.area === "맵" ? entry.label.replace(/ \([^()]*\)$/u, "") : entry.label;
  const name = entry.unnamed ? t(category) : displayText(label, t(category));
  if (entry.change !== "changed") return [format(changes[entry.change], name)];
  const lines = (entry.detail ?? []).flatMap(detail => {
    const split = detail.indexOf(": ");
    const field = detail.slice(0, split);
    if (split < 0 || !/^(?:[가-힣\d ·]+|[XY]|BGM)$/u.test(field)) return [];
    if (referenceFields.has(field)) return [format("{0} {1} 바뀜", name, t(field))];
    const value = displayText(detail.slice(split + 2), "");
    if (!value || /[{}\[\]]/u.test(value) || value === "1개 항목 → 1개 항목") return [];
    return [`${name} ${t(field)} ${value}`];
  });
  if (lines.length) return lines;
  if (entry.area !== "기본 설계서" && entry.before !== undefined && entry.after !== undefined) {
    return [`${name} ${displayText(entry.before, t("없음"))} → ${displayText(entry.after, t("없음"))}`];
  }
  return [format("{0} 바뀜", name)];
}

function dialoguePages(event?: GameEvent) {
  return new Map(event?.pages?.length ? event.pages.map(page => [page.id, page.commands] as const) : [["", event?.commands ?? []] as const]);
}

type DialogueLine = Extract<Command, { kind: "text" }>;
function dialogueLines(commands: readonly Command[], out: DialogueLine[] = []): DialogueLine[] {
  for (const command of commands) {
    if (command.kind === "text") {
      for (const body of command.body.split(/\r?\n/u)) out.push({ kind: "text", body, speaker: command.speaker });
    }
    for (const branch of nestedCommandLists(command)) dialogueLines(branch, out);
  }
  return out;
}

function changedDialogue(a: readonly Command[], b: readonly Command[]) {
  const old = dialogueLines(a), next = dialogueLines(b);
  let start = 0, left = old.length, right = next.length;
  while (start < left && start < right && jsonEqual(old[start], next[start])) start++;
  while (left > start && right > start && jsonEqual(old[left - 1], next[right - 1])) { left--; right--; }
  // The command editor aligns with LCS. Bound its matrix for imported, book-length dialogue pages.
  if ((left - start) * (right - start) > 250_000) {
    return Array.from({ length: Math.max(left, right) - start }, (_, i) => ({
      before: start + i < left ? old[start + i] : undefined, after: start + i < right ? next[start + i] : undefined,
    })).filter(pair => !jsonEqual(pair.before, pair.after));
  }
  return diffCommandLists(old.slice(start, left), next.slice(start, right)).filter(row => row.status !== "keep");
}

function quote(text: string): string {
  const flat = displayText(text, "…");
  return `「${flat.length > 45 ? flat.slice(0, 44) + "…" : flat}」`;
}

export function plainSummary(before: Project, after: Project) {
  const { entries } = buildChangeLedger(before, after, { maxEntries: Infinity });
  const lines: string[] = [];
  const counts = new Map<string, number>();
  const dialogue = { add: 0, remove: 0, change: 0 };
  for (const entry of entries) {
    lines.push(...ledgerLines(entry));
    const area = entry.event ? "이벤트" : entry.area.split(" · ").at(-1)!;
    const category = /^[가-힣 ]+$/u.test(area) ? area : "그 밖의 설정";
    counts.set(category, (counts.get(category) ?? 0) + 1);
    if (!entry.event) continue;
    const { mapId, eventId } = entry.event;
    const pages = (project: Project) => dialoguePages(project.maps[mapId]?.events.find(e => e.id === eventId));
    const previous = pages(before);
    const next = pages(after);
    for (const id of new Set([...previous.keys(), ...next.keys()])) {
      const a = previous.get(id) ?? [];
      const b = next.get(id) ?? [];
      if (jsonEqual(a, b)) continue;
      for (const row of changedDialogue(a, b)) {
        const old = row.before?.kind === "text" ? row.before : undefined;
        const edited = row.after?.kind === "text" ? row.after : undefined;
        dialogue[old && edited ? "change" : old ? "remove" : "add"]++;
        const showSpeaker = old?.speaker !== edited?.speaker;
        const show = (line: DialogueLine) => quote(showSpeaker && line.speaker ? `${line.speaker} · ${line.body}` : line.body);
        if (old && edited) lines.push(format("대사 {0} → {1}", show(old), show(edited)));
        else if (edited) lines.push(format("대사 추가 {0}", show(edited)));
        else if (old) lines.push(format("대사 {0} → {1}", show(old), t("없음")));
      }
    }
  }
  if (!entries.length && !jsonEqual(before, after)) lines.push(t(other));
  const headline = [
    ...Object.entries(dialogue).flatMap(([key, n]) => n ? [t(key === "add" ? `대사 ${n}줄 추가` : key === "remove" ? `대사 ${n}줄 삭제` : `대사 ${n}줄 수정`)] : []),
    ...Array.from(counts, ([kind, n]) => kind === "이벤트" ? t(`이벤트 ${n}개`) : `${t(kind)} ${t(`${n}개`)}`),
  ].join(" · ");
  return { headline: lines.length === 1 ? lines[0] : headline || t("바뀐 내용이 없어요"), lines };
}
