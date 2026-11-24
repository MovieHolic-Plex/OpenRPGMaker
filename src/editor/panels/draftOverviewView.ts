// editor/panels/draftOverviewView.ts
// 「초안 한 장 보기」 — 첫 MVP 실행이 끝나면 한 번 저절로 뜨고, 완료 카드의 링크·⌘K 로 다시 연다.
// 단추는 적게(오너 원칙): 카드마다 조용한 「말로 고치기」 하나, 방향 칩 한 줄, 닫기. 고치기는 조수 입력창으로 넘긴다.
import { registerModal, unregisterModal } from "@/editor/ui/modalStack";
import { store } from "@/project/store";
import { el } from "@/util/dom";
import { DRAFT_DIRECTIONS, draftFixPrefix, readDraftOverview, type DraftOverview, type DraftPersonCard } from "./draftOverviewData";
import { renderFacesetCrop } from "./eventEditor/facesetPreview";
import { createMapThumbnail } from "./mapThumbnail";

export interface DraftOverviewDeps {
  /** 입력창에 글을 넣고 초점만 준다 — 보내지 않는다. */
  readonly prefill: (text: string) => void;
  /** 평소 보내기 경로로 바로 보낸다. */
  readonly send: (text: string) => void;
}

const TESTID = "draft-overview";

export function openDraftOverview(deps: DraftOverviewDeps): HTMLElement {
  document.querySelector(`[data-testid='${TESTID}']`)?.remove();
  const draft = readDraftOverview(store.getCurrent());
  const closeButton = el("button", {
    class: "draft-overview-close", text: "×",
    attrs: { type: "button", title: "닫기", "aria-label": "닫기" }, dataset: { testid: "draft-overview-close" },
  });
  const backdrop = el("div", { class: "draft-overview-backdrop", attrs: { role: "presentation" }, dataset: { testid: TESTID } });
  const close = (): void => {
    unregisterModal(backdrop);
    backdrop.remove();
  };
  const fix = (label: string): HTMLElement => el("button", {
    class: "draft-overview-fix", text: "말로 고치기", attrs: { type: "button" }, dataset: { testid: "draft-overview-fix", label },
    on: { click: () => { close(); deps.prefill(draftFixPrefix(label)); } },
  });
  // 인물 칸은 카드마다 고치기가 있어 칸 머리에는 두지 않는다(fixLabel null).
  const section = (title: string, fixLabel: string | null, body: HTMLElement, extra = ""): HTMLElement => el("section", {
    class: `draft-overview-section${extra ? ` ${extra}` : ""}`,
    children: [el("header", { class: "draft-overview-section-head", children: [el("h3", { text: title }), ...(fixLabel ? [fix(fixLabel)] : [])] }), body],
  });

  const sections: HTMLElement[] = [];
  if (draft.world) sections.push(worldSection(draft, section));
  if (draft.people.length) sections.push(section("인물", null, el("div", { class: "draft-overview-people", children: draft.people.map((person) => personCard(person, fix)) }), "is-people"));
  if (draft.maps.length) sections.push(section(`맵 ${draft.maps.length}장`, "맵 흐름", mapFlow(draft)));
  sections.push(section("데이터", "데이터", counts(draft)));

  const chips = el("div", {
    class: "draft-overview-directions", attrs: { role: "group", "aria-label": "방향" }, dataset: { testid: "draft-overview-directions" },
    children: DRAFT_DIRECTIONS.map((group) => el("div", { class: "draft-overview-direction", children: [
      el("span", { class: "draft-overview-direction-label", text: group.group }),
      ...group.chips.map((chip) => el("button", {
        class: "draft-overview-chip", text: chip.label, attrs: { type: "button", title: chip.request }, dataset: { testid: `draft-overview-chip-${chip.id}` },
        on: { click: () => { close(); deps.send(chip.request); } },
      })),
    ] })),
  });

  backdrop.append(el("section", {
    class: "draft-overview-window", attrs: { role: "dialog", "aria-modal": "true", "aria-label": "초안 한 장" },
    children: [
      el("header", { class: "draft-overview-head", children: [el("h2", { text: "초안 한 장" }), closeButton] }),
      el("div", { class: "draft-overview-body", children: sections }),
      el("footer", { class: "draft-overview-foot", children: [chips] }),
    ],
  }));
  closeButton.addEventListener("click", close);
  backdrop.addEventListener("mousedown", (event) => { if (event.target === backdrop) close(); });
  registerModal(backdrop, close);
  document.body.append(backdrop);
  closeButton.focus();
  return backdrop;
}

type SectionFn = (title: string, fixLabel: string | null, body: HTMLElement, extra?: string) => HTMLElement;

function worldSection(draft: DraftOverview, section: SectionFn): HTMLElement {
  const world = draft.world!;
  return section("세계", `세계 ${world.name}`, el("div", { class: "draft-overview-world", children: [
    el("p", { class: "draft-overview-world-name", text: world.name }),
    ...(world.premise ? [el("p", { class: "draft-overview-world-premise", text: world.premise })] : []),
    ...(world.tones.length ? [el("p", { class: "draft-overview-tags", children: world.tones.map((tone) => el("span", { class: "draft-overview-tag", text: tone })) })] : []),
    ...world.lines.map((line) => el("p", { class: "draft-overview-world-line", text: line })),
  ] }), "is-world");
}

function personCard(person: DraftPersonCard, fix: (label: string) => HTMLElement): HTMLElement {
  const face = person.faceResourceId
    ? renderFacesetCrop({ resourceId: person.faceResourceId, displaySize: 48 })
    : el("span", { class: "draft-overview-face-empty", attrs: { "aria-hidden": "true" }, text: person.name.slice(0, 1) });
  return el("article", {
    class: `draft-overview-person is-${person.kind}`, dataset: { testid: "draft-overview-person", kind: person.kind },
    children: [
      el("div", { class: "draft-overview-face", children: [face] }),
      el("div", { class: "draft-overview-person-main", children: [
        el("p", { class: "draft-overview-person-role", text: person.roleLabel }),
        el("p", { class: "draft-overview-person-name", text: person.name }),
        ...(person.sub ? [el("p", { class: "draft-overview-person-sub", text: person.sub })] : []),
        ...(person.bio ? [el("p", { class: "draft-overview-person-bio", text: person.bio })] : []),
      ] }),
      fix(`${person.roleLabel} ${person.name}`),
    ],
  });
}

function mapFlow(draft: DraftOverview): HTMLElement {
  const nodes: HTMLElement[] = [];
  draft.maps.forEach((map, index) => {
    if (index > 0) nodes.push(el("span", { class: "draft-overview-arrow", attrs: { "aria-hidden": "true" }, text: "→" }));
    nodes.push(el("div", {
      class: `draft-overview-map${map.isStart ? " is-start" : ""}`, dataset: { testid: "draft-overview-map", mapId: map.mapId },
      attrs: { title: map.exits.length ? `→ ${map.exits.join(", ")}` : "" },
      children: [
        createMapThumbnail(map.mapId, { width: 132, height: 88, className: "draft-overview-map-thumb", testId: `draft-overview-map-thumb-${map.mapId}` }),
        el("span", { class: "draft-overview-map-name", text: map.name }),
        el("span", { class: "draft-overview-map-role", text: map.isStart ? `시작 · ${map.roleLabel}` : map.roleLabel }),
      ],
    }));
  });
  return el("div", { class: "draft-overview-flow", children: nodes });
}

function counts(draft: DraftOverview): HTMLElement {
  return el("dl", { class: "draft-overview-counts", dataset: { testid: "draft-overview-counts" }, children: draft.counts.map((entry) => el("div", {
    class: `draft-overview-count${entry.count ? "" : " is-zero"}`, dataset: { collection: entry.id },
    children: [el("dt", { text: entry.label }), el("dd", { text: entry.count.toLocaleString("ko-KR") })],
  })) });
}
