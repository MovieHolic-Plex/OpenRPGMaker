// editor/panels/dialogueViewShared.ts
// 자료집 「대사」 탭의 두 보기(대본 · 목록)가 같이 쓰는 조각: 대화창 실측기, 창 맞춤 배지, 이벤트로 이동, 글자 차이,
// 그리고 줄 하나를 그 자리에서 고치는 편집기. 쓰기는 dialogueActions(되돌리기 스냅샷 + 감사 라벨)를 지난다.

import { store } from "@/project/store";
import { dialogueKindLabel, dialogueLineUsesMessageWindow, type DialogueLine } from "@/editor/dialogue/dialogueIndex";
import { dialogueMeasureKey, estimateLineFit, registerMeasuredDialogueFit } from "@/editor/dialogue/dialogueEdits";
import { editDialogueLine } from "@/editor/dialogue/dialogueActions";
import { createDialogueWindowMeasurer, type DialogueWindowMeasurer } from "@/editor/dialogue/dialogueWindowMeasure";
import { diffText } from "@/editor/dialogue/textDiff";
import type { DialogueFit } from "@/editor/dialogue/dialogueText";
import { selectEditorMap } from "@/editor/mapSelection";
import { openEventEditorModal } from "@/editor/panels/eventEditor/modal";
import { setSelectedRecordId } from "@/editor/panels/databaseRecordViewSession";
import { selectCommonEventForView } from "@/editor/panels/databaseCommonEventViews";
import type { Project } from "@/project/types";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

/** 지금 고치는 중인 줄 id — 고치는 동안에는 바깥 변경으로 다시 그리지 않는다. */
export const dialogueEditing: { id: string | null } = { id: null };

let measurer: { readonly project: Project; readonly resolution: string; readonly promise: Promise<DialogueWindowMeasurer> } | null = null;
let readyMeasurer: DialogueWindowMeasurer | null = null;

export function readyDialogueMeasurer(): DialogueWindowMeasurer | null {
  return readyMeasurer;
}

export function dialogueMeasurerProject(): Project | null {
  return measurer?.project ?? null;
}

export function measurerFor(project: Project): Promise<DialogueWindowMeasurer> {
  const resolution = dialogueMeasureKey(project);
  if (measurer && measurer.resolution === resolution) return measurer.promise;
  readyMeasurer?.dispose();
  readyMeasurer = null;
  registerMeasuredDialogueFit(resolution, null);
  const promise = createDialogueWindowMeasurer(project).then((value) => {
    readyMeasurer = value;
    registerMeasuredDialogueFit(resolution, (line, text) => value.fit(line, text));
    return value;
  });
  measurer = { project, resolution, promise };
  return promise;
}

/** 실제 런타임 글꼴·폭 측정기가 아직이면 띄우고, 준비되는 순간 한 번 다시 그린다(그 전에는 추정치). */
export function warmDialogueMeasurer(project: Project, rerender: () => void, stillCurrent: () => boolean): void {
  if (readyMeasurer && measurer?.project === project) return;
  const wasReady = Boolean(readyMeasurer);
  void measurerFor(project).then(() => {
    if (!wasReady && stillCurrent() && !dialogueEditing.id) rerender();
  }).catch((error: unknown) => console.warn("[dialogue] 대화창 측정 실패 — 추정치를 씁니다:", error));
}

export function lineFit(project: Project, line: DialogueLine, text = line.text): DialogueFit | undefined {
  if (!dialogueLineUsesMessageWindow(line)) return undefined;
  return readyMeasurer ? readyMeasurer.fit(line, text) : estimateLineFit(project, line, text);
}

/** 조수 도구가 부를 때 — 편집기(브라우저)면 실측기를 띄워 둔다. 첫 호출은 추정, 준비된 뒤부터는 실측으로 판정한다. */
export function warmDialogueMeasurerForTools(project: Project): void {
  if (typeof document === "undefined") return;
  void measurerFor(project).catch(() => undefined);
}

export function fitBadge(fit: DialogueFit | undefined): HTMLElement {
  if (!fit) return el("span", { class: "db-dialogue-fit db-dialogue-fit-na", text: "—", attrs: { title: "대화창에 뜨지 않는 글(선택지·설명)" } });
  const label = fit.overflow ? `넘침 ${fit.lines}줄` : `${fit.lines}/${fit.maxLines}줄`;
  return el("span", {
    class: `db-dialogue-fit${fit.overflow ? " db-dialogue-fit-over" : ""}${fit.source === "estimate" ? " db-dialogue-fit-estimate" : ""}`,
    text: label,
    attrs: {
      title: fit.overflow
        ? `대화창 한 장(${fit.maxLines}줄, 글 폭 ${fit.bodyWidthPx}px)을 넘어 ${fit.pages}장으로 나뉩니다.`
        : `대화창 한 장 안에 들어갑니다(글 폭 ${fit.bodyWidthPx}px).`,
    },
    dataset: { testid: "db-dialogue-fit", overflow: fit.overflow ? "true" : "false" },
  });
}

export function speakerLabel(line: DialogueLine): string {
  return line.speaker || (line.kind === "text" ? "내레이션" : dialogueKindLabel(line.kind));
}

export function jumpToLine(line: DialogueLine, panelRoot: HTMLElement): void {
  const project = store.getCurrent();
  if (line.scope === "map" && line.mapId && line.eventId) {
    const event = project.maps[line.mapId]?.events.find((candidate) => candidate.id === line.eventId);
    if (!event) { toast("이벤트를 찾을 수 없습니다.", "error"); return; }
    if (!selectEditorMap(line.mapId, { clearEventSelection: false })) { toast("맵을 열 수 없습니다.", "error"); return; }
    openEventEditorModal(line.mapId, line.eventId, line.pageId ? { pageId: line.pageId } : undefined);
    return;
  }
  void import("@/editor/panels/database").then(({ switchDatabaseActiveTab }) => {
    if (line.scope === "common" && line.commonEventId) {
      selectCommonEventForView(line.commonEventId);
      switchDatabaseActiveTab("commonEvents", panelRoot);
    } else if (line.scope === "troop" && line.troopId) {
      setSelectedRecordId("troops", line.troopId, { reveal: true });
      switchDatabaseActiveTab("troops", panelRoot);
    } else if (line.scope === "database" && line.collection && line.recordId) {
      setSelectedRecordId(line.collection, line.recordId, { reveal: true });
      switchDatabaseActiveTab(line.collection === "skills" ? "skills" : "items", panelRoot);
    }
  });
}

export function diffNode(before: string, after: string): { readonly before: HTMLElement; readonly after: HTMLElement } {
  const parts = diffText(before, after);
  const left = el("div", { class: "db-dialogue-diff db-dialogue-diff-before", attrs: { translate: "no" }, dataset: { testid: "db-dialogue-diff-before", i18nSkip: "" } });
  const right = el("div", { class: "db-dialogue-diff db-dialogue-diff-after", attrs: { translate: "no" }, dataset: { testid: "db-dialogue-diff-after", i18nSkip: "" } });
  for (const part of parts) {
    if (part.kind !== "ins") left.append(part.kind === "del" ? el("del", { text: part.text }) : document.createTextNode(part.text));
    if (part.kind !== "del") right.append(part.kind === "ins" ? el("ins", { text: part.text }) : document.createTextNode(part.text));
  }
  return { before: left, after: right };
}

/**
 * 줄 하나의 글 칸 — 평소엔 누르면 고치는 버튼, 누르면 그 자리에서 textarea(실시간 창 맞춤 · Ctrl+Enter 저장 · Esc 취소).
 * `onFit` 은 평소 상태의 배지를 바깥(목록의 맞춤 칸)에 둘 때 쓴다.
 */
export function inlineLineText(line: DialogueLine, project: Project, rerender: () => void, options: { readonly className?: string; readonly testid?: string } = {}): HTMLElement {
  const cell = el("div", { class: options.className ?? "db-dialogue-text-cell" });
  const showText = (): void => {
    const button = el("button", {
      class: "db-dialogue-text",
      attrs: { type: "button", title: line.drafted ? "이벤트 편집기에서 열려 있어 여기서 고칠 수 없습니다" : "눌러서 고치기", translate: "no", ...(line.drafted ? { disabled: "true" } : {}) },
      dataset: { testid: options.testid ?? "db-dialogue-text", i18nSkip: "" },
      on: { click: () => startEdit() },
    });
    button.textContent = line.text || "(빈 글)";
    cell.replaceChildren(button);
  };
  const startEdit = (): void => {
    dialogueEditing.id = line.id;
    const area = el("textarea", {
      class: "db-dialogue-edit",
      value: line.text,
      attrs: { rows: String(Math.min(6, Math.max(2, line.text.split("\n").length + 1))), translate: "no", "aria-label": "대사 고치기" },
      dataset: { testid: "db-dialogue-edit", i18nSkip: "" },
    });
    const live = el("span", { class: "db-dialogue-live" });
    const refreshLive = (): void => { live.replaceChildren(fitBadge(lineFit(project, line, area.value))); };
    // 자료집 창의 Escape(닫기)는 document 캡처 단계에서 먼저 돈다 — 고치는 중의 Escape 는 그보다 앞(window 캡처)에서 「취소」로 가로챈다.
    const escapeGuard = (event: KeyboardEvent): void => {
      if (event.key !== "Escape" || event.target !== area) return;
      event.preventDefault();
      event.stopPropagation();
      cancel();
    };
    window.addEventListener("keydown", escapeGuard, true);
    const finish = (): void => { window.removeEventListener("keydown", escapeGuard, true); dialogueEditing.id = null; };
    const cancel = (): void => { finish(); showText(); };
    const commit = (): void => {
      const value = area.value;
      finish();
      if (value === line.text) { showText(); return; }
      const verdict = editDialogueLine(line.id, line.hash, value);
      if (!verdict.ok) {
        toast(verdict.message ?? "고치지 못했습니다.", "error");
        showText();
        return;
      }
      rerender();
    };
    area.addEventListener("input", refreshLive);
    area.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); commit(); }
    });
    refreshLive();
    cell.replaceChildren(el("div", {
      class: "db-dialogue-editor",
      children: [
        area,
        el("div", {
          class: "db-dialogue-editor-actions",
          children: [
            live,
            el("span", { class: "db-dialogue-muted", text: "Ctrl+Enter 저장 · Esc 취소" }),
            el("button", { class: "db-ws-btn db-ws-btn-ghost", text: "취소", attrs: { type: "button" }, on: { click: cancel } }),
            el("button", { class: "db-ws-btn db-ws-btn-primary", text: "저장", attrs: { type: "button" }, dataset: { testid: "db-dialogue-edit-save" }, on: { click: commit } }),
          ],
        }),
      ],
    }));
    area.focus();
    area.setSelectionRange(area.value.length, area.value.length);
  };
  showText();
  return cell;
}
