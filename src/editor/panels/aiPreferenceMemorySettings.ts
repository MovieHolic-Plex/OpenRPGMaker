// editor/panels/aiPreferenceMemorySettings.ts
// "AI 가 기억한 내 성향" 목록. **채팅 컴포저의 작은 버튼(⌾)** 이 여는 팝오버의 내용이다.
//
// 왜 UI 가 필요한가: 성향은 사람이 명시적으로 입력하지 않은 것을 관측으로 굳히는 기능이다.
// 목록을 볼 수도 지울 수도 없으면 사용자는 AI 가 왜 그렇게 행동하는지 알 수 없고 되돌릴 수도 없다.
// 고정(pinned)은 증류가 그 항목을 지우거나 상한에 밀려 축출하지 못하게 한다.
//
// 왜 AI 설정 모달이 아닌가 (2026-08-30 감독 지시): 성향은 **대화에서 배운다.** 배웠다는 알림도
// 채팅 버블로 뜬다. 확인·삭제가 설정 모달에 있으면 배운 자리와 고치는 자리가 갈라진다 —
// 알림을 보고 목록을 열려면 창을 닫고 톱바로 올라가야 한다. 알림이 뜬 그 패널 안에 둔다.
// 설정 모달에는 붙이지 않는다.
//
// 이 모듈은 여전히 `store` 를 모른다. 조회 키는 호출부가 넘긴다 — 여기서 프로젝트 층을 읽으면
// 목록만 렌더하는 단위 테스트가 모듈 로딩만으로 15초 예산을 넘겼던 전례가 있다.
//
// <details> 를 쓰지 않는다 — Chromium 의 ::details-content 가 내부 스크롤러를 무력화한 전례가 있어
// 목록이 길어질 때 스크롤이 죽는다. 평범한 section + h3 로 둔다.

import {
  clearPreferenceFacts,
  deletePreferenceFact,
  listPreferenceFacts,
  setPreferenceFactPinned,
  upsertPreferenceFact,
  type PreferenceFact,
} from "@/ai/preferenceMemory";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

const STRENGTH_LABEL: Record<PreferenceFact["strength"], string> = {
  strong: "강함",
  medium: "보통",
  weak: "약함",
};

const SOURCE_LABEL: Record<PreferenceFact["source"], string> = {
  observed: "관측",
  stated: "선언",
  manual: "직접 입력",
};

export type PreferenceMemorySettings = {
  readonly element: HTMLElement;
  readonly refresh: () => void;
};

export function renderPreferenceMemorySettings(options: {
  /**
   * 프로젝트 한정 성향 조회 키(conversationScopeKey). 없으면 전역 성향만 보여 준다.
   *
   * 함수로도 줄 수 있다 — 채팅 패널의 스코프는 '새 대화'·프로젝트 전환에서 바뀌는 `let` 이라,
   * 값으로 한 번 굳히면 프로젝트를 바꾼 뒤 팝오버가 **이전 프로젝트의** 성향을 계속 보여 준다.
   * 함수로 받으면 refresh 시점의 스코프를 읽는다.
   */
  readonly projectScopeKey?: string | (() => string | undefined);
} = {}): PreferenceMemorySettings {
  const readScopeKey = (): string | undefined =>
    typeof options.projectScopeKey === "function" ? options.projectScopeKey() : options.projectScopeKey;

  const list = el("div", {
    class: "ai-preference-list",
    dataset: { testid: "ai-preference-list" },
  });

  const addInput = el("input", {
    class: "ai-config-input ai-preference-add-input",
    attrs: {
      type: "text",
      placeholder: "예: 마을은 집 4채 이하로 작게 만들어 줘",
      maxlength: "160",
      "aria-label": "성향 직접 추가",
    },
    dataset: { testid: "ai-preference-add-input" },
  }) as HTMLInputElement;

  const refresh = (): void => {
    const { global, project } = listPreferenceFacts(readScopeKey());
    list.replaceChildren();
    if (global.length === 0 && project.length === 0) {
      list.append(
        el("p", {
          class: "ai-preference-empty",
          // 아직 아무것도 없을 때 "왜 비어 있는가"를 말해 준다. 빈 목록만 보여 주면
          // 기능이 고장난 것처럼 읽힌다.
          text: "아직 기억된 성향이 없습니다. 작업을 되돌리거나 \"항상 ~로 해줘\"처럼 말하면 AI 가 취향을 익힙니다.",
          dataset: { testid: "ai-preference-empty" },
        }),
      );
      return;
    }
    if (global.length > 0) {
      list.append(el("h4", { class: "ai-preference-group", text: "전역(모든 프로젝트)" }));
      for (const fact of global) list.append(renderRow(fact, refresh));
    }
    if (project.length > 0) {
      list.append(el("h4", { class: "ai-preference-group", text: "이 프로젝트 한정" }));
      for (const fact of project) list.append(renderRow(fact, refresh));
    }
  };

  const submitAdd = (): void => {
    const text = addInput.value.trim();
    if (!text) return;
    // 직접 추가는 항상 전역·강함·고정이다. 사용자가 손으로 쓴 것이 관측보다 강해야 하고,
    // 다음 증류가 그것을 지우면 입력 칸이 아무 의미가 없다.
    const added = upsertPreferenceFact({
      text,
      scope: "global",
      strength: "strong",
      source: "manual",
      pinned: true,
    });
    addInput.value = "";
    refresh();
    toast(added ? "성향을 추가했습니다." : "이미 같은 성향이 있습니다.", added ? "ok" : "info");
  };

  const addButton = el("button", {
    class: "ai-assistant-action",
    text: "추가",
    attrs: { type: "button" },
    dataset: { testid: "ai-preference-add" },
    on: { click: submitAdd },
  });

  addInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    submitAdd();
  });

  const clearButton = el("button", {
    class: "ai-assistant-action is-danger",
    text: "전체 비우기",
    attrs: { type: "button" },
    dataset: { testid: "ai-preference-clear" },
    on: {
      click: () => {
        clearPreferenceFacts();
        refresh();
        toast("기억된 성향을 모두 지웠습니다.", "ok");
      },
    },
  });

  const element = el("section", {
    class: "ai-preference-settings",
    dataset: { testid: "ai-preference-settings" },
    children: [
      el("h3", { class: "ai-preference-title", text: "AI 가 기억한 내 성향" }),
      el("p", {
        class: "ai-preference-hint",
        text: "되돌리기·정정·직접 선언에서 익힌 취향입니다. 매 요청의 기본값으로만 쓰이고, 그때그때의 지시가 항상 우선합니다.",
      }),
      list,
      el("div", {
        class: "ai-preference-add-row",
        children: [addInput, addButton],
      }),
      el("div", { class: "ai-preference-actions", children: [clearButton] }),
    ],
  });

  refresh();
  return { element, refresh };
}

function renderRow(fact: PreferenceFact, refresh: () => void): HTMLElement {
  const pinButton = el("button", {
    class: `ai-preference-pin${fact.pinned ? " is-pinned" : ""}`,
    text: fact.pinned ? "고정됨" : "고정",
    attrs: {
      type: "button",
      title: fact.pinned
        ? "고정 해제 — AI 가 이 성향을 갱신·삭제할 수 있게 됩니다."
        : "고정 — AI 가 이 성향을 지우거나 밀어내지 못하게 합니다.",
      "aria-pressed": fact.pinned ? "true" : "false",
    },
    dataset: { testid: "ai-preference-pin" },
    on: {
      click: () => {
        setPreferenceFactPinned(fact.id, !fact.pinned);
        refresh();
      },
    },
  });

  const deleteButton = el("button", {
    class: "ai-preference-delete",
    text: "삭제",
    attrs: { type: "button", "aria-label": `성향 삭제: ${fact.text}` },
    dataset: { testid: "ai-preference-delete" },
    on: {
      click: () => {
        deletePreferenceFact(fact.id);
        refresh();
      },
    },
  });

  return el("div", {
    class: "ai-preference-row",
    dataset: { testid: "ai-preference-row", prefId: fact.id },
    children: [
      el("span", { class: `ai-preference-strength is-${fact.strength}`, text: STRENGTH_LABEL[fact.strength] }),
      el("span", { class: "ai-preference-text", text: fact.text }),
      el("span", {
        class: "ai-preference-meta",
        text: `${SOURCE_LABEL[fact.source]} · 근거 ${fact.evidence}`,
      }),
      pinButton,
      deleteButton,
    ],
  });
}
