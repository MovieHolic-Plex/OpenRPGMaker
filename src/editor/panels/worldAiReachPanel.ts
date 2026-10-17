import {
  computeWorldAiReach,
  type WorldAiReach,
} from "@/ai/worldAiReach";
import { store } from "@/project/store";
import { normalizeProjectWorld } from "@/project/world/guards";
import { isWikiActivityRecord } from "@/project/world/activity";
import type { WorldEntity } from "@/project/world/types";
import { el } from "@/util/dom";
import { wirePopoverDismiss } from "./worldDocumentProperties";

const NAME_LIST_LIMIT = 10;

export type WorldAiReachPanelOptions = {
  readonly open: boolean;
  readonly onToggle: (open: boolean) => void;
  /** 질문 입력 상태를 리렌더 너머로 이어 주는 저장소(없으면 패널이 새로 그려질 때 비운다). */
  readonly probe?: { query: string };
  /** `chip` = 속성 칩 바 안의 한 칩(요약은 「AI 공개 39개 · 숨김 1개」 한 줄, 펼치면 팝오버). 기본은 제자리에서 펼치는 패널. */
  readonly variant?: "chip" | "panel";
};

const num = (value: number): string => value.toLocaleString("en-US");

/**
 * 「AI가 읽는 것」 한 줄 요약의 조각들. 조각마다 숫자만 자리표시자라 번역 템플릿 하나로 맞는다
 * (여러 수치를 한 문장으로 이어 붙이면 번역기가 조각을 엉뚱하게 잡는다 — openwiki/i18n.md).
 */
export function worldAiReachSummaryParts(reach: WorldAiReach): readonly string[] {
  return [
    reach.canon.authored ? `세계 개요 약 ${num(reach.canon.tokens)}토큰` : "세계 개요 미작성",
    `문서 공개 ${reach.documents.reads}개`,
    `숨김 ${reach.documents.hidden}개`,
    `미작성 ${reach.documents.blank}개`,
  ];
}

/** 칩 바용 짧은 요약: 문서 공개·숨김만, 미작성은 있을 때만. */
export function worldAiReachChipParts(reach: WorldAiReach): readonly string[] {
  return [
    `AI 공개 ${reach.documents.reads}개`,
    `숨김 ${reach.documents.hidden}개`,
    ...(reach.documents.blank > 0 ? [`미작성 ${reach.documents.blank}개`] : []),
  ];
}

/** 카드 이름은 사용자 데이터라 번역 대상이 아니다(data-i18n-skip) — 고정 문구와 다른 노드로 둔다. */
function nameList(entities: readonly WorldEntity[]): HTMLElement[] {
  const shown = entities.slice(0, NAME_LIST_LIMIT).map((entity) => entity.name.trim() || "(이름 없음)").join(", ");
  return [
    el("span", { class: "world-ai-reach-names", text: shown, attrs: { "data-i18n-skip": "" } }),
    ...(entities.length > NAME_LIST_LIMIT ? [el("span", { text: `외 ${entities.length - NAME_LIST_LIMIT}개` })] : []),
  ];
}

function row(label: string, parts: readonly string[], testid: string, note?: string): HTMLElement {
  return el("div", {
    class: "world-ai-reach-row",
    dataset: { testid },
    children: [
      el("dt", { text: label }),
      el("dd", { children: [...parts.map((part) => el("span", { text: part })), ...(note ? [el("small", { text: note })] : [])] }),
    ],
  });
}

/**
 * 설정집·세계 개요에 걸치는 「AI가 읽는 것」 패널. 수치는 전부 `computeWorldAiReach`(= 실제 프롬프트 조립
 * 함수를 그대로 부른다)에서 오고, 이 파일은 그린다. 화면용 근사식을 여기에 두지 마라.
 */
export function renderWorldAiReachPanel(options: WorldAiReachPanelOptions): HTMLDetailsElement {
  const probeState = options.probe ?? { query: "" };
  const project = store.getCurrent();
  const reach = computeWorldAiReach(project, { probeQuery: probeState.query });
  const world = normalizeProjectWorld(project);
  const documents = world.entities.filter((entity) => !isWikiActivityRecord(entity));
  const hidden = documents.filter((entity) => reach.documents.stateById.get(entity.id) === "hidden");
  const blank = documents.filter((entity) => reach.documents.stateById.get(entity.id) === "blank");

  const probeResult = el("p", { class: "world-muted", dataset: { testid: "world-ai-reach-probe-result" } });
  const paintProbe = (): void => {
    const live = computeWorldAiReach(store.getCurrent(), { probeQuery: probeState.query });
    const probe = live.channels.chat.probe;
    if (!probe) {
      probeResult.replaceChildren(document.createTextNode("질문을 적으면 채팅 조수가 그 질문에 받게 될 문서를 보여 줍니다."));
    } else if (probe.selected.length === 0) {
      probeResult.replaceChildren(document.createTextNode("이 질문에는 채팅 조수에게 가는 설정집 문서가 없습니다."));
    } else {
      probeResult.replaceChildren(
        el("span", { text: `이 질문에는 문서 ${probe.selected.length}개(약 ${num(probe.tokens)}토큰)가 갑니다:` }),
        document.createTextNode(" "),
        ...nameList(probe.selected),
      );
    }
  };
  const probeInput = el("input", {
    class: "world-edit-input world-ai-reach-probe",
    attrs: { type: "text", placeholder: "채팅 조수에게 보낼 질문 예: 항구 마을을 만들어 줘", "aria-label": "AI가 받을 문서 확인용 질문" },
    value: probeState.query,
    dataset: { testid: "world-ai-reach-probe" },
  }) as HTMLInputElement;
  probeInput.addEventListener("input", () => {
    probeState.query = probeInput.value;
    paintProbe();
  });
  paintProbe();

  const chat = reach.channels.chat;
  const npc = reach.channels.npcDigest;
  const extractor = reach.channels.extractor;
  const canonParts = reach.canon.authored
    ? ["매 턴 고정", `약 ${num(reach.canon.tokens)}토큰 (${num(reach.canon.chars)}자)`]
    : ["아직 쓰지 않아 보내는 내용이 없습니다"];

  const body = el("div", {
    class: "world-ai-reach-body",
    children: [
      el("dl", {
        class: "world-ai-reach-rows",
        children: [
          row("세계 개요", canonParts, "world-ai-reach-canon",
            reach.canon.secretIsInstruction ? "세계 개요의 「비밀」은 숨김이 아니라 지시입니다 — AI는 읽되 플레이어 대사에 직접 쓰지 않게 합니다." : undefined),
          row("채팅 조수", [`질문과 낱말이 겹치는 문서를 최대 ${chat.maxDocuments}개·${num(chat.maxChars)}자까지 (이름·요약·본문 앞부분·연결·출처)`], "world-ai-reach-chat"),
          row("NPC 대사 작성기", npc.lines === 0 ? ["보내는 문서가 없습니다"] : [
            `이름과 요약 ${npc.lines}줄 · 약 ${num(npc.tokens)}토큰`,
            ...(npc.omitted > 0 ? [`예산 초과로 ${npc.omitted}개 생략`] : []),
          ], "world-ai-reach-npc"),
          row("대화로 설정 기록", [`새 설정을 기록할 때 기존 문서 ${extractor.documents}개(최대 ${extractor.cap}개)를 참고합니다`], "world-ai-reach-extractor"),
        ],
      }),
      el("label", { class: "world-edit-field", children: [el("span", { text: "질문 시험" }), probeInput] }),
      probeResult,
      ...(hidden.length > 0 ? [el("p", {
        class: "world-ai-reach-list hidden",
        dataset: { testid: "world-ai-reach-hidden" },
        children: [el("span", { text: `AI에 숨긴 문서 ${hidden.length}개 — 어떤 경로로도 보내지 않습니다:` }), " ", ...nameList(hidden)],
      })] : []),
      ...(blank.length > 0 ? [el("p", {
        class: "world-ai-reach-list blank",
        dataset: { testid: "world-ai-reach-blank" },
        children: [el("span", { text: `미작성 문서 ${blank.length}개 — 요약과 본문이 비어 보낼 내용이 없습니다:` }), " ", ...nameList(blank)],
      })] : []),
    ],
  });

  const chipVariant = options.variant === "chip";
  const summaryParts = chipVariant ? worldAiReachChipParts(reach) : worldAiReachSummaryParts(reach);
  const details = el("details", {
    class: chipVariant ? "world-ai-reach world-chip-pop align-end" : "world-ai-reach",
    attrs: { ...(options.open ? { open: "" } : {}) },
    dataset: { testid: "world-ai-reach" },
    children: [
      el("summary", {
        ...(chipVariant ? { class: "world-chip world-chip-trigger", attrs: { title: "AI가 읽는 것" } } : {}),
        children: [
          ...(chipVariant ? [] : [el("strong", { text: "AI가 읽는 것" })]),
          el("span", {
            class: "world-ai-reach-summary",
            dataset: { testid: "world-ai-reach-summary" },
            children: summaryParts.map((part) => el("span", { class: "world-ai-reach-chip", text: part })),
          }),
        ],
      }),
      chipVariant
        ? el("div", {
          class: "world-chip-pop-body",
          attrs: { role: "group", "aria-label": "AI가 읽는 것" },
          children: [el("strong", { class: "world-ai-reach-title", text: "AI가 읽는 것" }), body],
        })
        : body,
    ],
  });
  // 처음부터 open 속성을 달고 만들면 브라우저가 토글 이벤트를 한 번 쏜다 — 사용자의 조작이 아니므로 기록하지 않는다.
  let lastOpen = options.open;
  const onToggle = (): void => {
    if (details.open === lastOpen) return;
    lastOpen = details.open;
    options.onToggle(details.open);
  };
  if (chipVariant) {
    const trigger = details.querySelector("summary");
    if (trigger) wirePopoverDismiss(details, trigger as HTMLElement, onToggle);
    else details.addEventListener("toggle", onToggle);
  } else {
    details.addEventListener("toggle", onToggle);
  }
  return details;
}
