// 자료집 개요의 「퀘스트 제안」 — 이벤트로만 지은 부탁·심부름 흐름을 찾아 한 번에 초안 퀘스트로 등록한다.
// 탐지는 src/project/quest/questCandidates.ts(순수), 등록은 store.update 한 번이다. 이벤트는 바꾸지 않는다.
// 저자가 쓴 글(대사·이벤트 이름)은 data-i18n-skip 요소에 담는다(openwiki/i18n.md).
import { pendingQuestCandidates, registerQuestCandidate, type QuestCandidate } from "@/project/quest/questCandidates";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { el } from "@/util/dom";

function authored(tag: "span" | "strong" | "p", text: string, className?: string): HTMLElement {
  return el(tag, { ...(className ? { class: className } : {}), attrs: { "data-i18n-skip": "" }, text });
}

function placeLabel(project: Project, ref: QuestCandidate["giver"]): string {
  return `${project.maps[ref.mapId]?.name || ref.mapId} · ${ref.name || ref.eventId}`;
}

function candidateRow(project: Project, candidate: QuestCandidate, onRegistered: () => void): HTMLElement {
  const register = el("button", {
    class: "db-overview-quest-suggest-register",
    text: "퀘스트로 등록",
    attrs: { type: "button", ...(candidate.registrable ? {} : { disabled: "", title: "아이템으로만 끝나는 흐름이라 진행 값(스위치·변수)이 없습니다." }) },
    dataset: { testid: "db-overview-quest-suggest-register", candidateId: candidate.id },
    on: {
      click: () => {
        store.update((draft) => { registerQuestCandidate(draft, candidate); }, { scope: "project", label: "퀘스트 제안 등록", reason: candidate.title });
        onRegistered();
      },
    },
  });
  return el("li", {
    class: "db-overview-quest-suggest-item",
    dataset: { testid: "db-overview-quest-suggest-item", candidateId: candidate.id },
    children: [
      el("div", {
        class: "db-overview-quest-suggest-head",
        children: [
          authored("strong", candidate.title),
          el("span", { class: "db-overview-story-meta", text: `신뢰도 ${Math.round(candidate.confidence * 100)}%` }),
          register,
        ],
      }),
      authored("p", `“${candidate.request}”`, "db-overview-quest-suggest-request"),
      el("div", {
        class: "db-overview-story-row",
        children: [
          el("span", { class: "db-overview-story-row-label", text: "부탁" }),
          authored("span", placeLabel(project, candidate.giver), "db-overview-story-site"),
        ],
      }),
      el("div", {
        class: "db-overview-story-row",
        children: [
          el("span", { class: "db-overview-story-row-label", text: "수행" }),
          el("span", { class: "db-overview-story-switches", children: candidate.steps.map((step) => authored("span", placeLabel(project, step), "db-overview-story-site")) }),
        ],
      }),
      el("div", {
        class: "db-overview-story-row",
        children: [
          el("span", { class: "db-overview-story-row-label", text: "보고" }),
          authored("span", placeLabel(project, candidate.turnIn), "db-overview-story-site"),
        ],
      }),
    ],
  });
}

export function renderQuestSuggestions(project: Project): HTMLElement | null {
  const candidates = pendingQuestCandidates(project);
  if (candidates.length === 0) return null;
  const section = el("section", {
    class: "db-overview-story-structure db-overview-quest-suggest",
    attrs: { "aria-labelledby": "db-overview-quest-suggest-title" },
    dataset: { testid: "db-overview-quest-suggest" },
  });
  const status = el("p", { class: "db-overview-story-hint", attrs: { role: "status" }, dataset: { testid: "db-overview-quest-suggest-status" } });
  const list = el("ol", { class: "db-overview-quest-suggest-list" });
  const fill = () => {
    const current = store.getCurrent();
    const pending = pendingQuestCandidates(current);
    list.replaceChildren(...pending.map((candidate) => candidateRow(current, candidate, () => {
      status.textContent = `등록했습니다: ${candidate.title} — 플레이 중 퀘스트 로그에 나타납니다.`;
      fill();
    })));
    heading.textContent = pending.length > 0 ? `${pending.length}개 흐름이 퀘스트처럼 보입니다 — 등록할까요?` : "제안한 흐름을 모두 등록했습니다.";
  };
  const heading = el("p", { dataset: { testid: "db-overview-quest-suggest-count" } });
  section.append(
    el("header", {
      children: [
        el("h3", { attrs: { id: "db-overview-quest-suggest-title" }, text: "퀘스트 제안" }),
        heading,
        el("p", { class: "db-overview-story-hint", text: "부탁 대사 → 다른 곳에서 진행 값을 켬 → 부탁한 인물이 그 값을 보고 반응하는 이벤트 흐름입니다. 등록해도 이벤트는 바뀌지 않습니다." }),
      ],
    }),
    list,
    status,
  );
  fill();
  return section;
}
