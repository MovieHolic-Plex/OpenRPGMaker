// editor/panels/databaseDialogueView.ts
// 자료집 「이야기 › 대사」 탭 — 프로젝트의 모든 대사를 한곳에서 읽고, 바로 고치고, 조수의 윤문 제안을 줄마다 받는다.
// 보기가 둘이다: 「대본」(기본, 이야기 순서 시나리오 — databaseStoryScriptView.ts)과 「목록」(아래, 창 넘침 고치기용 표).
//
//   왼쪽  화자 목록(대사 수·말투 메모 유무). 고르면 그 화자만 보이고 말투 메모를 쓸 수 있다.
//   오른쪽 ① 조수 윤문 제안(바꾸기 전·후 글자 차이, 줄마다 받기/버리기, 모두 받기)
//         ② 검색·맵·종류·「창 넘침만」 거르개
//         ③ 맵 › 이벤트 › 쪽으로 묶은 표 — 화자 · 대사(눌러서 고치기) · 창 맞춤(실제 런타임 글꼴·폭) · 이동
//
// 쓰기는 전부 editor/dialogue/dialogueActions.ts(store.update + 되돌리기 스냅샷 + 감사 라벨)를 지난다.
// 색인·검사는 조수 도구(list_dialogue·rewrite_dialogue)와 같은 순수 모듈(editor/dialogue/*)이다.

import { store } from "@/project/store";
import { readDialogueDesk, speakerVoiceNote, type DialogueProposal } from "@/project/dialogueDesk";
import {
  collectDialogueLines,
  dialogueKindLabel,
  speakerSummary,
  type DialogueLine,
} from "@/editor/dialogue/dialogueIndex";
import { acceptDialogueProposals, rejectDialogueProposals, setSpeakerVoiceNote } from "@/editor/dialogue/dialogueActions";
import { detailHero, detailPane, emptyState, listPane, listRow, listSearch, workspaceShell } from "@/editor/panels/databaseWorkspace";
import { dialogueEditing, diffNode, fitBadge, inlineLineText, jumpToLine, lineFit, lineHasJumpTarget, readyDialogueMeasurer, warmDialogueMeasurer } from "@/editor/panels/dialogueViewShared";
import { dialogueModeToggle, renderStoryScriptView } from "@/editor/panels/databaseStoryScriptView";
import type { Project } from "@/project/types";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

type KindFilter = "all" | "line" | "choice" | "description" | "quest";

interface ViewState {
  mode: "script" | "list";
  query: string;
  speaker: string;
  mapId: string;
  kind: KindFilter;
  overflowOnly: boolean;
  limit: number;
}

const PAGE = 250;
const state: ViewState = { mode: "script", query: "", speaker: "", mapId: "", kind: "all", overflowOnly: false, limit: PAGE };

let latestRerender: (() => void) | null = null;
let subscribed = false;
let pendingRefresh: number | null = null;
/** 탭 바깥(조수 적용·되돌리기)에서 바뀐 것을 화면에 반영한다. 고치는 중이면 미룬다. */
function ensureStoreSubscription(): void {
  if (subscribed) return;
  subscribed = true;
  store.subscribe(() => {
    const root = document.querySelector<HTMLElement>("[data-testid='db-dialogue-view']");
    if (!root?.isConnected || !latestRerender) return;
    if (pendingRefresh !== null) window.clearTimeout(pendingRefresh);
    pendingRefresh = window.setTimeout(() => {
      pendingRefresh = null;
      if (dialogueEditing.id) return;
      const current = document.querySelector<HTMLElement>("[data-testid='db-dialogue-view']");
      if (current?.isConnected && current.dataset.project !== projectStamp(store.getCurrent())) latestRerender?.();
    }, 160);
  });
}

const stamps = new WeakMap<Project, string>();
let stampCounter = 0;
function projectStamp(project: Project): string {
  let stamp = stamps.get(project);
  if (!stamp) {
    stamp = String(++stampCounter);
    stamps.set(project, stamp);
  }
  return stamp;
}

function matchesKind(line: DialogueLine, kind: KindFilter): boolean {
  if (kind === "line") return line.kind === "text";
  if (kind === "choice") return line.kind === "choiceOption" || line.kind === "choicePrompt" || line.kind === "presentPrompt";
  if (kind === "description") return line.kind === "description";
  if (kind === "quest") return line.kind === "quest" || line.scope === "ending";
  return true;
}

function renderProposals(project: Project, lines: readonly DialogueLine[], rerender: () => void): HTMLElement | null {
  const proposals = readDialogueDesk(project).proposals;
  if (proposals.length === 0) return null;
  const byId = new Map(lines.map((line) => [line.id, line]));
  const visible = proposals.filter((proposal) => {
    const line = byId.get(proposal.lineId);
    return !state.speaker || line?.speaker === state.speaker;
  });
  if (visible.length === 0) return null;
  const freshIds = visible.filter((proposal) => byId.get(proposal.lineId)?.hash === proposal.baseHash).map((proposal) => proposal.id);
  const instructions = [...new Set(visible.map((proposal) => proposal.instruction).filter((value): value is string => Boolean(value)))];
  const acceptAll = (): void => {
    const outcome = acceptDialogueProposals(freshIds);
    toast(outcome.failed.length
      ? `${outcome.accepted.length}줄 받음 · ${outcome.failed.length}줄은 원문이 바뀌어 남겨 둠`
      : `윤문 제안 ${outcome.accepted.length}줄을 받았습니다.`, outcome.failed.length ? "info" : "ok");
    rerender();
  };
  const rejectAll = (): void => {
    const count = rejectDialogueProposals(visible.map((proposal) => proposal.id));
    toast(`윤문 제안 ${count}줄을 버렸습니다.`, "info");
    rerender();
  };
  const rows = visible.map((proposal) => renderProposalRow(proposal, byId.get(proposal.lineId), project, rerender));
  return el("section", {
    class: "db-dialogue-proposals",
    dataset: { testid: "db-dialogue-proposals" },
    children: [
      el("header", {
        class: "db-dialogue-proposals-head",
        children: [
          el("div", {
            class: "db-dialogue-proposals-title",
            children: [
              el("strong", { text: `조수 윤문 제안 ${visible.length}줄` }),
              el("span", { class: "db-dialogue-muted", text: "받기 전에는 게임 대사가 바뀌지 않습니다." }),
              ...instructions.slice(0, 2).map((text) => el("span", { class: "db-dialogue-instruction", text: `요청: ${text}`, attrs: { translate: "no" }, dataset: { i18nSkip: "" } })),
            ],
          }),
          el("div", {
            class: "db-dialogue-proposals-actions",
            children: [
              el("button", { class: "db-ws-btn db-ws-btn-ghost", text: "모두 버리기", attrs: { type: "button" }, dataset: { testid: "db-dialogue-reject-all" }, on: { click: rejectAll } }),
              el("button", {
                class: "db-ws-btn db-ws-btn-primary",
                text: `모두 받기 (${freshIds.length})`,
                attrs: { type: "button", ...(freshIds.length === 0 ? { disabled: "true" } : {}) },
                dataset: { testid: "db-dialogue-accept-all" },
                on: { click: acceptAll },
              }),
            ],
          }),
        ],
      }),
      el("div", { class: "db-dialogue-proposal-list", children: rows }),
    ],
  });
}

function renderProposalRow(proposal: DialogueProposal, line: DialogueLine | undefined, project: Project, rerender: () => void): HTMLElement {
  const stale = !line || line.hash !== proposal.baseHash;
  const { before, after } = diffNode(proposal.before, proposal.after);
  const fitBefore = line ? lineFit(project, line, proposal.before) : undefined;
  const fitAfter = line ? lineFit(project, line, proposal.after) : undefined;
  const accept = (): void => {
    const outcome = acceptDialogueProposals([proposal.id]);
    if (outcome.accepted.length === 0) toast(outcome.failed[0]?.verdict.message ?? "받지 못했습니다.", "error");
    rerender();
  };
  const reject = (): void => {
    rejectDialogueProposals([proposal.id]);
    rerender();
  };
  return el("article", {
    class: `db-dialogue-proposal${stale ? " is-stale" : ""}`,
    dataset: { testid: "db-dialogue-proposal", lineId: proposal.lineId },
    children: [
      el("div", {
        class: "db-dialogue-proposal-meta",
        children: [
          el("span", { class: "db-dialogue-speaker", text: line?.speaker || (line ? (line.kind === "text" ? "내레이션" : dialogueKindLabel(line.kind)) : "사라진 줄"), attrs: { translate: "no" }, dataset: { i18nSkip: "" } }),
          el("span", { class: "db-dialogue-where", text: line?.groupLabel ?? proposal.lineId, attrs: { translate: "no" }, dataset: { i18nSkip: "" } }),
          ...(stale ? [el("span", { class: "db-dialogue-stale", text: "원문이 바뀜 — 받을 수 없음" })] : []),
        ],
      }),
      el("div", {
        class: "db-dialogue-proposal-body",
        children: [
          el("div", { class: "db-dialogue-proposal-side", children: [el("span", { class: "db-dialogue-side-label", text: "전" }), before, fitBadge(fitBefore)] }),
          el("div", { class: "db-dialogue-proposal-side", children: [el("span", { class: "db-dialogue-side-label", text: "후" }), after, fitBadge(fitAfter)] }),
        ],
      }),
      ...(proposal.reason ? [el("p", { class: "db-dialogue-reason", text: proposal.reason, attrs: { translate: "no" }, dataset: { i18nSkip: "" } })] : []),
      el("div", {
        class: "db-dialogue-proposal-actions",
        children: [
          el("button", { class: "db-ws-btn db-ws-btn-ghost", text: "버리기", attrs: { type: "button" }, dataset: { testid: "db-dialogue-reject" }, on: { click: reject } }),
          el("button", {
            class: "db-ws-btn db-ws-btn-primary",
            text: "받기",
            attrs: { type: "button", ...(stale ? { disabled: "true" } : {}) },
            dataset: { testid: "db-dialogue-accept" },
            on: { click: accept },
          }),
        ],
      }),
    ],
  });
}

function renderVoiceCard(speaker: string, count: number, rerender: () => void): HTMLElement {
  const project = store.getCurrent();
  const note = speakerVoiceNote(project, speaker) ?? "";
  const area = el("textarea", {
    class: "db-dialogue-voice-input",
    value: note,
    attrs: { rows: "3", maxlength: "800", placeholder: "예: 냉정한 심문관. 짧은 평서문, 존댓말 없음, 감탄사 금지.", "aria-label": `${speaker} 말투 메모`, translate: "no" },
    dataset: { testid: "db-dialogue-voice-input", i18nSkip: "" },
  });
  const save = (): void => {
    const result = setSpeakerVoiceNote(speaker, area.value);
    if (result !== "unchanged") toast(result === "cleared" ? `${speaker} 말투 메모를 지웠습니다.` : `${speaker} 말투 메모를 저장했습니다.`, "ok");
    rerender();
  };
  return el("section", {
    class: "db-dialogue-voice",
    dataset: { testid: "db-dialogue-voice" },
    children: [
      el("div", {
        class: "db-dialogue-voice-head",
        children: [
          el("strong", { text: `${speaker}의 말투 메모`, attrs: { translate: "no" } }),
          el("span", { class: "db-dialogue-muted", text: `대사 ${count}줄 · 조수가 이 인물의 대사를 다듬을 때 문체 지침으로 읽습니다.` }),
        ],
      }),
      area,
      el("div", {
        class: "db-dialogue-voice-actions",
        children: [el("button", { class: "db-ws-btn db-ws-btn-primary", text: "메모 저장", attrs: { type: "button" }, dataset: { testid: "db-dialogue-voice-save" }, on: { click: save } })],
      }),
    ],
  });
}

function renderLineRow(line: DialogueLine, project: Project, panelRoot: HTMLElement, rerender: () => void, pending: ReadonlySet<string>): HTMLElement {
  const fit = lineFit(project, line);
  const textCell = inlineLineText(line, project, rerender);
  const row = el("div", {
    class: `db-dialogue-row${fit?.overflow ? " is-overflow" : ""}${pending.has(line.id) ? " has-proposal" : ""}`,
    attrs: { role: "row" },
    dataset: { testid: "db-dialogue-row", lineId: line.id },
  });
  row.append(
    el("span", {
      class: "db-dialogue-speaker",
      text: line.speaker || (line.kind === "text" ? "내레이션" : dialogueKindLabel(line.kind)),
      attrs: { translate: "no", title: line.speaker ? `${dialogueKindLabel(line.kind)} · ${line.speaker}` : dialogueKindLabel(line.kind) },
      dataset: { i18nSkip: "", kind: line.kind },
    }),
    textCell,
    fitBadge(fit),
    lineHasJumpTarget(line)
      ? el("button", {
        class: "db-dialogue-jump",
        text: "이동",
        attrs: { type: "button", title: "이 대사가 있는 이벤트(또는 레코드)를 엽니다" },
        dataset: { testid: "db-dialogue-jump" },
        on: { click: () => jumpToLine(line, panelRoot) },
      })
      : el("span", { class: "db-dialogue-jump-none", attrs: { "aria-hidden": "true" } }),
  );
  return row;
}

/** `panelRoot` 는 자료집 모달 몸체(탭 전환에 쓴다). */
export function renderDialogueTab(host: HTMLElement, panelRoot: HTMLElement, rerender: () => void): void {
  ensureStoreSubscription();
  latestRerender = rerender;
  dialogueEditing.id = null;
  const project = store.getCurrent();
  const toggle = dialogueModeToggle(state.mode, (mode) => { state.mode = mode; rerender(); });
  if (state.mode === "script") {
    renderStoryScriptView(host, panelRoot, rerender, { toggle, stamp: projectStamp(project), isCurrent: () => latestRerender === rerender });
    return;
  }
  const lines = collectDialogueLines(project);
  const desk = readDialogueDesk(project);
  const pending = new Set(desk.proposals.map((proposal) => proposal.lineId));
  const speakers = speakerSummary(lines);
  if (state.speaker && !speakers.some((entry) => entry.speaker === state.speaker)) state.speaker = "";
  if (state.mapId && !project.maps[state.mapId]) state.mapId = "";

  warmDialogueMeasurer(project, rerender, () => latestRerender === rerender);

  const query = state.query.trim().toLocaleLowerCase();
  let filtered = lines.filter((line) =>
    matchesKind(line, state.kind)
    && (!state.speaker || line.speaker === state.speaker)
    && (!state.mapId || line.mapId === state.mapId)
    && (!query || `${line.text}\n${line.speaker}\n${line.groupLabel}`.toLocaleLowerCase().includes(query)));
  const overflowCount = lines.reduce((sum, line) => sum + (lineFit(project, line)?.overflow ? 1 : 0), 0);
  if (state.overflowOnly) filtered = filtered.filter((line) => lineFit(project, line)?.overflow === true);

  // ── 왼쪽: 화자 목록 ──
  const speakerRows = [
    listRow({
      name: "모든 화자",
      sub: `${lines.length}줄`,
      active: !state.speaker,
      testid: "db-dialogue-speaker-all",
      onSelect: () => { state.speaker = ""; state.limit = PAGE; rerender(); },
    }),
    ...speakers.map(({ speaker, count }) => listRow({
      name: speaker,
      sub: `${count}줄${speakerVoiceNote(project, speaker) ? " · 메모" : ""}`,
      active: state.speaker === speaker,
      title: speakerVoiceNote(project, speaker) ?? speaker,
      dataset: { speaker },
      testid: "db-dialogue-speaker-row",
      onSelect: () => { state.speaker = speaker; state.limit = PAGE; rerender(); },
    })),
  ];
  const list = listPane({
    title: "화자",
    count: speakers.length,
    rows: speakerRows,
    testid: "db-dialogue-speakers",
  });

  // ── 오른쪽: 제안 · 거르개 · 표 ──
  const mapOptions = Object.values(project.maps)
    .filter((map) => lines.some((line) => line.mapId === map.id))
    .map((map) => el("option", { value: map.id, text: map.name, attrs: { translate: "no" } }));
  const mapSelect = el("select", {
    class: "db-dialogue-select",
    attrs: { "aria-label": "맵으로 거르기" },
    dataset: { testid: "db-dialogue-map-filter" },
    children: [el("option", { value: "", text: "모든 맵·장면" }), ...mapOptions],
  });
  mapSelect.value = state.mapId;
  mapSelect.addEventListener("change", () => { state.mapId = mapSelect.value; state.limit = PAGE; rerender(); });
  const kindSelect = el("select", {
    class: "db-dialogue-select",
    attrs: { "aria-label": "종류로 거르기" },
    dataset: { testid: "db-dialogue-kind-filter" },
    children: [
      el("option", { value: "all", text: "모든 글" }),
      el("option", { value: "line", text: "대사" }),
      el("option", { value: "choice", text: "선택지·질문" }),
      el("option", { value: "description", text: "아이템·스킬 설명" }),
      el("option", { value: "quest", text: "퀘스트·엔딩" }),
    ],
  });
  kindSelect.value = state.kind;
  kindSelect.addEventListener("change", () => { state.kind = kindSelect.value as KindFilter; state.limit = PAGE; rerender(); });
  const overflowToggle = el("input", { attrs: { type: "checkbox" }, dataset: { testid: "db-dialogue-overflow-only" } });
  overflowToggle.checked = state.overflowOnly;
  overflowToggle.addEventListener("change", () => { state.overflowOnly = overflowToggle.checked; state.limit = PAGE; rerender(); });
  const search = listSearch({
    placeholder: "대사·화자·장소 검색",
    value: state.query,
    testid: "db-dialogue-search",
    delayMs: 200,
    onInput: (value) => { state.query = value; state.limit = PAGE; rerender(); },
  });
  const metricsNote = el("span", {
    class: "db-dialogue-metrics",
    text: readyDialogueMeasurer() ? `창 기준: ${readyDialogueMeasurer()!.describe()}` : "창 기준: 측정 중(추정치 표시)",
    dataset: { testid: "db-dialogue-metrics" },
  });
  const filterBar = el("div", {
    class: "db-dialogue-filters",
    children: [
      search,
      mapSelect,
      kindSelect,
      el("label", { class: "db-dialogue-check", children: [overflowToggle, el("span", { text: `창 넘침만 (${overflowCount})` })] }),
      el("span", { class: "db-dialogue-count", text: `${filtered.length}줄`, dataset: { testid: "db-dialogue-count" } }),
    ],
  });

  const shown = filtered.slice(0, state.limit);
  const groups: HTMLElement[] = [];
  let currentGroup: HTMLElement | null = null;
  let currentKey = "";
  for (const line of shown) {
    if (line.groupKey !== currentKey) {
      currentKey = line.groupKey;
      currentGroup = el("div", { class: "db-dialogue-group", attrs: { role: "rowgroup" }, dataset: { testid: "db-dialogue-group" } });
      currentGroup.append(el("div", {
        class: "db-dialogue-group-head",
        children: [
          el("span", { class: "db-dialogue-group-label", text: line.groupLabel, attrs: { translate: "no" }, dataset: { i18nSkip: "" } }),
          ...(line.drafted ? [el("span", { class: "db-dialogue-stale", text: "이벤트 편집기에서 열림" })] : []),
        ],
      }));
      groups.push(currentGroup);
    }
    currentGroup!.append(renderLineRow(line, project, panelRoot, rerender, pending));
  }
  const table = el("div", {
    class: "db-dialogue-table",
    attrs: { role: "table", "aria-label": "대사 목록" },
    dataset: { testid: "db-dialogue-table" },
    children: groups.length > 0
      ? groups
      : [emptyState({ icon: "…", title: lines.length === 0 ? "아직 대사가 없습니다" : "조건에 맞는 대사가 없습니다", body: lines.length === 0 ? "이벤트에 「문장 표시」 명령을 넣으면 여기에 모입니다." : "거르개를 풀어 보세요.", compact: true, testid: "db-dialogue-empty" })],
  });
  const more = filtered.length > shown.length
    ? el("button", {
      class: "db-ws-btn db-ws-btn-ghost db-dialogue-more",
      text: `더 보기 (${filtered.length - shown.length}줄 남음)`,
      attrs: { type: "button" },
      dataset: { testid: "db-dialogue-more" },
      on: { click: () => { state.limit += PAGE; rerender(); } },
    })
    : null;

  const speakerCount = state.speaker ? speakers.find((entry) => entry.speaker === state.speaker)?.count ?? 0 : 0;
  const proposals = renderProposals(project, lines, rerender);
  const detail = detailPane({
    hero: detailHero({
      eyebrow: "이야기",
      title: state.speaker ? `${state.speaker}의 대사` : "대사",
      subtitle: `${lines.length}줄 · 화자 ${speakers.length}명 · 창 넘침 ${overflowCount}줄${desk.proposals.length ? ` · 윤문 제안 ${desk.proposals.length}줄` : ""}`,
      testid: "db-dialogue-hero",
    }),
    body: [
      toggle,
      ...(state.speaker ? [renderVoiceCard(state.speaker, speakerCount, rerender)] : []),
      ...(proposals ? [proposals] : []),
      filterBar,
      metricsNote,
      table,
      ...(more ? [more] : []),
    ],
    testid: "db-dialogue-detail",
  });
  const shell = workspaceShell({ list, detail, legacyClass: "db-dialogue-workspace", testid: "db-dialogue-view" });
  shell.dataset.project = projectStamp(project);
  host.append(shell);
}

const countCache = new WeakMap<Project, number>();
/** 레일 배지 — 대사 명령·선택지 수(설명 글 제외). 레일은 자주 다시 그려지므로 프로젝트 판본마다 한 번만 센다. */
export function dialogueTabCount(project: Project): number {
  let count = countCache.get(project);
  if (count === undefined) {
    count = collectDialogueLines(project, { includeDescriptions: false }).length;
    countCache.set(project, count);
  }
  return count;
}
