import { PI_APPLY_MODES, normalizePiApplyMode } from "@/ai/piAgent/applyMode";
import { loadAiConfig, saveAiConfig } from "@/ai/llmClient";
// editor/panels/aiComposer.ts
// 컴포저 셸 — 텍스트 영역 + 고정 액션 행 한 줄 + 팝오버 4종. 세로 버튼 열은 없다.
//
// 왜 이 구조인가 (실측 근거):
//  - 구 `.ai-command-input-stack` 은 슬래시 목록·컨텍스트 칩·감독 칩·대기 큐를 **흐름 안에서**
//    입력창 위에 쌓았다. 칩이 나타났다 사라질 때마다 바 높이가 바뀌고, ResizeObserver 가
//    `--ai-command-bar-clearance` 를 다시 재서 rising overlay 하단·맵 여백까지 같이 흔들렸다.
//    실측: 슬래시 목록을 열면 유리 93→377(+284), 사이드 156→401(+245).
//  - 그래서 규칙 하나: **바 높이 = f(textarea 줄 수)뿐.** 액션 메뉴·성향·맥락은 absolute 팝오버로
//    흐름에서 빼고, 컨텍스트·대기 큐·상태는 **항상 존재하는** 고정 높이 액션 행에 한 줄로 넣는다.
//    추천(`suggest`)만은 데크 안에서 입력창 위에 흐름으로 선다(2026-09-03) — 데크 전체의 위치를
//    패널이 ResizeObserver 로 재므로 바 높이 불변식은 데크 높이 불변식으로 승격됐다.
//  - 팝오버는 `.ai-command-bar` 의 직접 자식이고 닫히면 `hidden`(display:none) 이다.
//    투명한 전면 레이어는 두지 않는다 — 보이지 않는 레이어가 맵 클릭을 삼킨 P0 사고가 있었다
//    (2026-08-19, 회귀 스펙 `test/e2e/_ai-assistant-hostile-eval.spec.ts` H 히트테스트).
//
// 데크(2026-09-03, 제안서 D1): 새 대화·이전 대화·더보기·성향·맥락 게이지·접기 버튼은 **여기서 만들되
// 행에 넣지 않는다.** 패널이 데크 상태 레일(`aiDeckRail`)의 슬롯으로 옮긴다. 컴포저가 계속 만드는
// 이유는 클릭 배선(onNewChat·팝오버 열기)과 testid 계약이 여기 있기 때문이다 — 두 벌로 만들면
// 진입점이 갈라진다. 행에는 모드 세그먼트(지시/질문/계획)·되돌리기·컨텍스트 칩·대기 큐 | 상태·
// 모델 칩·보내기/멈추기 만 남는다. 글리프(+ 🕒 ☰ ⌾)는 SVG 아이콘으로 바꿨다.
//
// `⌾` 성향(2026-08-30 감독 지시): AI 가 대화에서 배운 취향 목록. 배웠다는 알림이 채팅 버블로
// 뜨므로 확인·삭제도 같은 표면에 있어야 한다. 팝오버 기계의 한 종류로 들어 배타적 열림·바깥 클릭·
// Escape 를 공짜로 얻는다.

import { AUTONOMY_LEVELS, resolveAutonomy, type AutonomyLevel } from "@/ai/autonomyLevels";
import { COMPOSER_MODES, COMPOSER_MODE_LABEL, type ComposerMode } from "@/ai/composerMode";
// 컴포저는 모드를 더 이상 그리지 않는다(자율성 다이얼이 유도한다). 재수출만 남긴다 —
// 세션 계약과 기존 소비자가 이 경로로 어휘를 읽고 있다.
import type { AiConfig } from "@/ai/llmClient";
import { el } from "@/util/dom";
import { createTeamMenu } from "./aiTeamMenu";
import { deckIcon } from "./aiDeckIcons";
import { anchoredPopupPosition } from "./popupPosition";

/** 서로 배타적인 컴포저 팝오버. 하나가 열리면 나머지는 닫힌다. */
export type ComposerPopover = "suggest" | "menu" | "preference" | "context" | "planning" | "team" | "settings";

const POPOVER_KINDS = ["suggest", "menu", "preference", "context", "planning", "team", "settings"] as const;

export { COMPOSER_MODES, COMPOSER_MODE_LABEL, type ComposerMode };

export type ComposerReasoningEffort = NonNullable<AiConfig["reasoningEffort"]>;

/** 추론 강도 선택지 — 설정 모달(ai-config-reasoning)과 같은 값·라벨. */
export const COMPOSER_REASONING_OPTIONS: readonly {
  readonly id: ComposerReasoningEffort;
  readonly label: string;
}[] = [
  { id: "off", label: "끔" },
  { id: "low", label: "낮음" },
  { id: "medium", label: "보통" },
  { id: "high", label: "높음" },
];

export interface ComposerElements {
  /** 패널에 마운트되는 바 루트(기존 `.ai-command-bar` testid 유지). */
  readonly commandBar: HTMLElement;
  readonly composer: HTMLElement;
  readonly actions: HTMLElement;
  readonly commandMenu: HTMLElement;
  /** 레일용 버튼들 — 행에는 없다. 패널이 레일 슬롯에 넣는다. */
  readonly newChatButton: HTMLButtonElement;
  readonly conversationsButton: HTMLButtonElement | null;
  readonly menuToggle: HTMLButtonElement;
  /** 성향 팝오버 토글. `preferenceContent` 를 주지 않았으면 null. */
  readonly preferenceToggle: HTMLButtonElement | null;
  /** 성향 팝오버 껍데기 — 패널이 레일 아래로 옮겨 붙인다(토글이 레일에 있다). */
  readonly preferencePopover: HTMLElement;
  /** 보존 기획 재사용 토글. `planningContent` 를 주지 않았으면 null. */
  readonly planningToggle: HTMLButtonElement | null;
  /** 보존 기획 재사용 팝오버 껍데기 — 성향 팝오버와 같은 자리 규칙. */
  readonly planningPopover: HTMLElement;
  /** 자율성 셀렉트 — 지시줄의 유일한 컨트롤. `effortChips` 를 주지 않았으면 null. */
  readonly autonomySelect: HTMLSelectElement | null;
  /** Pi 팀 토글. `teamToggleOptions` 를 주지 않았으면 null. 읽기 전용·계획 턴에서는 숨는다. */
  readonly teamToggle: HTMLElement | null;
  /** 바로 깔기. 켜지면 전송이 모델 없이 place_props 로 간다. */
  readonly stampToggle: HTMLButtonElement;
  readonly setPiTeam: (team: boolean) => void;
  readonly syncApplyMode: () => void;
  readonly syncEffort: (autonomy: AutonomyLevel) => void;
  readonly setModelLabel: (label: string | null) => void;
  readonly openPopover: (kind: ComposerPopover | null) => void;
  readonly openKind: () => ComposerPopover | null;
  /** 바 + 열려 있는 팝오버를 합친 최상단 y — clearance 계산의 단일 소스. */
  readonly measuredTop: () => number;
  readonly dispose: () => void;
}

export interface ComposerOptions {
  readonly input: HTMLTextAreaElement;
  readonly collapseButton: HTMLButtonElement;
  readonly sendButton: HTMLButtonElement;
  readonly abortButton: HTMLButtonElement;
  /** 방금 적용한 AI 변경 되돌리기 — 되돌릴 게 있을 때만 보인다(패널이 hidden 을 관리). */
  readonly undoAppliedButton: HTMLButtonElement;
  readonly contextChips: HTMLElement;
  readonly composerChips: HTMLElement;
  /** 「다음에 뭘 하지」 블록. 추천 팝오버 안, 감독 프롬프트 칩 바로 아래에 붙는다. */
  readonly nextSteps: HTMLElement;
  readonly queueIndicator: HTMLElement;
  readonly statusGroup: HTMLElement;
  /** 맥락 게이지 버튼 + 그 팝오버(aiContextMeter). 둘 다 있어야 종류가 생긴다. */
  readonly contextMeterButton?: HTMLButtonElement;
  readonly contextMeterPopover?: HTMLElement;
  readonly onNewChat: () => void;
  /** 이전 대화 목록 열기. 주지 않으면 버튼을 만들지 않는다(preferenceContent 와 같은 주입 규칙). */
  readonly onOpenConversations?: () => void;
  readonly onPopoverChange?: (kind: ComposerPopover | null) => void;
  /**
   * "AI 가 기억한 내 성향" 팝오버의 내용. **주입으로 받는다** — 컴포저가
   * `aiPreferenceMemorySettings` 를 직접 import 하면 성향 저장소(localStorage 접근)가
   * 컴포저 단위 테스트의 모듈 그래프에 들어온다. 안 주면 버튼도 팝오버도 만들지 않는다.
   */
  readonly preferenceContent?: HTMLElement;
  /** 성향 팝오버가 열릴 때. 목록을 다시 읽는 자리다(대화 중 증류로 내용이 바뀐다). */
  readonly onPreferenceOpen?: () => void;
  /**
   * 「보존 기획 재사용」 팝오버의 내용. 성향 팝오버와 같은 주입 관례다 — 안 주면 버튼도
   * 팝오버도 만들지 않는다(컴포저 단위 테스트가 프로젝트 스토어를 끌어오지 않게 한다).
   */
  readonly planningContent?: HTMLElement;
  /** 재사용 팝오버가 열릴 때 — 항목 목록을 프로젝트에서 다시 읽는 자리. */
  readonly onPlanningOpen?: () => void;
  /**
   * 바깥 클릭 판정. 기본은 `commandBar.contains`. 데크에서는 레일의 토글이 바 밖에 있으므로
   * 패널이 `deck.contains` 를 넘긴다 — 안 그러면 ⋯ 를 다시 누를 때 pointerdown 이 먼저 닫고
   * click 이 다시 열어 메뉴가 닫히지 않는다.
   */
  readonly isInside?: (target: Node) => boolean;
  /**
   * 자율성 셀렉트(지시줄 바로 선택). 주지 않으면 만들지 않는다.
   * 값의 저장·세션 반영은 호출자(패널)가 맡는다 — 컴포저는 선택지만 그린다.
   *
   * 예전의 `modeChips`(지시/질문/계획)는 없다: 「질문」은 레벨 readOnly, 「계획」은 planOnly 로
   * 흡수됐다. 추론 강도도 레벨 프리셋이 정하므로 지시줄에 수동 override 를 두지 않는다.
   */
  readonly effortChips?: {
    readonly initialAutonomy: AutonomyLevel;
    readonly onAutonomyChange: (level: AutonomyLevel) => void;
  };
  /** 모델 칩 초기 라벨. null/미지정이면 숨긴 채 만든다(표준 이상 모드에서 패널이 채운다). */
  readonly modelLabel?: string | null;
  /** Pi 팀 토글 — 팀은 경로가 아니라 Pi 루프의 실행 모드다(executionRoute.ts 머리말). 저장은 호출자가 맡는다. */
  readonly teamToggleOptions?: {
    readonly onOpenSettings?: () => void;
    readonly initialTeam: boolean;
    readonly onTeamChange: (team: boolean) => void;
  };
}

function iconButton(options: {
  readonly class: string;
  readonly icon: Parameters<typeof deckIcon>[0];
  readonly label: string;
  readonly title: string;
  readonly testid: string;
  readonly attrs?: Record<string, string>;
  readonly onClick: () => void;
}): HTMLButtonElement {
  return el("button", {
    class: `ai-composer-menu-btn ${options.class}`,
    attrs: { type: "button", title: options.title, "aria-label": options.label, ...(options.attrs ?? {}) },
    dataset: { testid: options.testid },
    children: [deckIcon(options.icon)],
    on: { click: options.onClick },
  }) as HTMLButtonElement;
}

export function createComposerElements(options: ComposerOptions): ComposerElements {
  let openState: ComposerPopover | null = null;

  const menuToggle = iconButton({
    class: "ai-command-menu-toggle",
    icon: "more",
    label: "더보기 메뉴",
    title: "더보기",
    testid: "ai-command-menu-toggle",
    attrs: { "aria-expanded": "false", "aria-haspopup": "menu" },
    onClick: () => openPopover(openState === "menu" ? null : "menu"),
  });

  const newChatButton = iconButton({
    class: "ai-new-chat",
    icon: "plus",
    label: "새 대화 시작",
    title: "새 대화",
    testid: "ai-new-chat",
    onClick: options.onNewChat,
  });

  const onOpenConversations = options.onOpenConversations;
  const conversationsButton = onOpenConversations
    ? iconButton({
      class: "ai-open-conversations",
      icon: "clock",
      label: "이전 대화 열기",
      title: "이전 대화 — 지금 대화는 기록에 저장되고, 골라 이어서 엽니다",
      testid: "ai-open-conversations",
      attrs: { "aria-haspopup": "dialog" },
      onClick: onOpenConversations,
    })
    : null;
  if (conversationsButton) {
    const glyph = conversationsButton.querySelector("svg");
    if (glyph) glyph.setAttribute("data-testid", "ai-map-history-open");
    conversationsButton.append(el("span", {
      attrs: { hidden: "" },
      text: "맵별 이전 대화",
    }));
  }

  const commandMenu = el("div", {
    class: "ai-composer-popover ai-command-menu",
    attrs: { role: "menu" },
    dataset: { testid: "ai-command-menu" },
  });
  commandMenu.hidden = true;

  const preferenceToggle = options.preferenceContent
    ? iconButton({
      class: "ai-preference-toggle",
      icon: "memory",
      label: "AI 가 기억한 내 성향",
      title: "AI 가 기억한 내 성향 — 확인·고정·삭제",
      testid: "ai-preference-toggle",
      attrs: { "aria-expanded": "false", "aria-haspopup": "dialog" },
      onClick: () => openPopover(openState === "preference" ? null : "preference"),
    })
    : null;

  const preferencePopover = el("div", {
    class: "ai-composer-popover ai-preference-popover",
    attrs: { role: "dialog", "aria-label": "AI 가 기억한 내 성향" },
    dataset: { testid: "ai-preference-popover" },
    ...(options.preferenceContent ? { children: [options.preferenceContent] } : {}),
  });
  preferencePopover.hidden = true;

  // 보존 기획 재사용 — 이 턴에 어떤 기획 항목을 참고할지(없음/전체/선택) 고르는 자리.
  // 기본은 「없음」이고, 고르지 않으면 아무 문장도 실리지 않는다.
  const planningToggle = options.planningContent
    ? iconButton({
      class: "ai-planning-toggle",
      icon: "list",
      label: "보존 기획 재사용",
      title: "보존 기획 재사용 — 없음 · 전체 · 선택",
      testid: "ai-planning-toggle",
      attrs: { "aria-expanded": "false", "aria-haspopup": "dialog" },
      onClick: () => openPopover(openState === "planning" ? null : "planning"),
    })
    : null;

  const planningPopover = el("div", {
    class: "ai-composer-popover ai-planning-popover",
    attrs: { role: "dialog", "aria-label": "보존 기획 재사용" },
    dataset: { testid: "ai-planning-popover" },
    ...(options.planningContent ? { children: [options.planningContent] } : {}),
  });
  planningPopover.hidden = true;

  // 추천 — 입력창 포커스 + 빈 값일 때 자동으로 뜬다(전용 토글 없음). 데크 안에서 입력창 위에
  // 흐름으로 선다. `nextSteps`(맵 진단 힌트 + 실행 문장 행)는 감독 프롬프트 칩 다음에 온다.
  const suggestPopover = el("div", {
    class: "ai-composer-popover ai-composer-suggest",
    attrs: { role: "group", "aria-label": "추천 지시" },
    dataset: { testid: "ai-suggest-popover" },
    children: [options.composerChips, options.nextSteps],
  });
  suggestPopover.hidden = true;

  // ── 자율성 셀렉트 ──
  // 지시줄의 **유일한** 컨트롤이다. 예전에 나란히 있던 모드 3칩(지시/질문/계획)과 추론 강도
  // 셀렉트는 이 다이얼로 흡수됐다 — 세 컨트롤이 같은 노브를 만지고 있었다(autonomyLevels 주석).
  // 값의 저장·세션 반영은 호출자가 맡고, 여기서는 값 어휘(AUTONOMY_LEVELS)만 공유한다.
  let autonomyLevel: AutonomyLevel = options.effortChips?.initialAutonomy ?? "balanced";
  const autonomySelect = options.effortChips
    ? el("select", {
      class: "ai-composer-effort-select",
      attrs: { title: "자율성 — AI가 스스로 판단하고 실행하는 정도", "aria-label": "자율성" },
      dataset: { testid: "ai-composer-autonomy" },
      children: AUTONOMY_LEVELS.map((level) =>
        el("option", { attrs: { value: level.id }, text: level.label }),
      ),
    }) as HTMLSelectElement
    : null;
  const paintEffort = (): void => {
    if (autonomySelect) autonomySelect.value = autonomyLevel;
  };
  // 팀 토글은 자율성 블록 뒤에 만들어진다 — 노출 판정(다이얼이 쓰기를 허용하는가)을 미리 훅으로 세운다.
  let paintTeam = (): void => {};
  const syncEffort = (autonomy: AutonomyLevel): void => {
    autonomyLevel = autonomy;
    paintEffort();
    paintTeam();
  };
  if (autonomySelect) {
    const onChange = options.effortChips?.onAutonomyChange;
    autonomySelect.addEventListener("change", () => {
      const next = autonomySelect.value as AutonomyLevel;
      if (!AUTONOMY_LEVELS.some((level) => level.id === next)) {
        paintEffort();
        return;
      }
      autonomyLevel = next;
      onChange?.(next);
    });
  }
  paintEffort();

  // ── Pi 팀 토글 ── 팀은 경로가 아니다: 루프는 Pi 하나이고 이 비트가 «몇 명이 도는가» 를 정한다
  // (`AiConfig.piTeam`). 읽기 전용·계획 턴에서는 팀이 무의미하다(쓰기 툴이 없다) — 눌러도 아무 일이
  // 없는 컨트롤을 남기지 않으려고 숨긴다.
  let piTeam = options.teamToggleOptions?.initialTeam ?? false;
  const teamToggle = options.teamToggleOptions ? el("button", {
    class: "ai-composer-team-toggle", attrs: { type: "button", "aria-haspopup": "dialog", "aria-expanded": "false", "aria-label": "팀 작업 설정" },
    dataset: { testid: "ai-composer-team" },
    on: { click: () => { openPopover(openState === "team" ? null : "team"); if (openState === "team") teamMenu?.root.querySelector<HTMLElement>("button")?.focus(); } },
  }) : null;
  const teamMenu = options.teamToggleOptions ? createTeamMenu({
    initialTeam: piTeam,
    onTeamChange: next => { piTeam = next; paintTeam(); options.teamToggleOptions?.onTeamChange(next); },
    onLabelChange: label => { if (teamToggle) teamToggle.textContent = label; },
    onOpenSettings: () => { openPopover(null); options.teamToggleOptions?.onOpenSettings?.(); },
  }) : null;
  paintTeam = (): void => {
    const plan = resolveAutonomy(autonomyLevel);
    if (teamToggle) {
      teamToggle.hidden = plan.readOnly || plan.planOnly;
      teamToggle.dataset.team = String(piTeam);
      if (teamToggle.hidden && openState === "team") openPopover(null);
    }
  };
  const setPiTeam = (next: boolean): void => { piTeam = next; teamMenu?.setTeam(next); paintTeam(); };
  paintTeam();

  const applyModeSelect = el("select", {
    class: "ai-composer-effort-select ai-composer-apply-mode",
    attrs: { "aria-label": "AI 적용 모드" }, dataset: { testid: "ai-composer-apply-mode" },
    children: PI_APPLY_MODES.map(mode => el("option", { attrs: { value: mode.id, title: mode.description }, text: mode.label })),
  }) as HTMLSelectElement;
  let paintSettingsSummary = (): void => {};
  const syncApplyMode = () => {
    const mode = normalizePiApplyMode(loadAiConfig().piApply);
    applyModeSelect.value = mode;
    paintSettingsSummary();
    applyModeSelect.title = `${PI_APPLY_MODES.find(item => item.id === mode)!.description} 변경한 모드는 다음 요청부터 사용합니다.`;
  };
  syncApplyMode();
  applyModeSelect.addEventListener("focus", syncApplyMode);
  applyModeSelect.addEventListener("change", () => {
    saveAiConfig({ ...loadAiConfig(), piApply: normalizePiApplyMode(applyModeSelect.value) });
    syncApplyMode();
  });

  const settingsToggle = el("button", {
    class: "ai-composer-team-toggle",
    text: "작업 설정",
    attrs: { type: "button", "aria-label": "작업 설정", "aria-haspopup": "dialog", "aria-expanded": "false" },
    dataset: { testid: "ai-composer-settings" },
    on: { click: () => {
      openPopover(openState === "settings" ? null : "settings");
      if (openState === "settings") settingsPopover.querySelector<HTMLElement>("select, button")?.focus();
    } },
  });
  paintSettingsSummary = (): void => {
    const mode = normalizePiApplyMode(applyModeSelect.value);
    const labels = { default: "기본", yolo: "YOLO", auto: "자동", review: "검토 후 적용", step: "단계별 적용" };
    settingsToggle.textContent = `작업 설정 · ${labels[mode]}`;
  };
  paintSettingsSummary();
  const settingRow = (title: string, hint: string, control: HTMLElement): HTMLElement => el("label", {
    class: "ai-chat-setting-row",
    children: [el("span", { text: title }), control, el("small", { text: hint })],
  });
  const settingsPopover = el("div", {
    class: "ai-composer-popover ai-chat-settings",
    attrs: { role: "dialog", "aria-label": "작업 설정" },
    dataset: { testid: "ai-composer-settings-popover" },
    children: [
      el("strong", { text: "작업 설정" }),
      el("small", { text: "다음에 보내는 요청부터 사용합니다." }),
      ...(autonomySelect ? [settingRow("AI가 할 일", "질문만 할지, 직접 작업을 맡길지 선택하세요.", autonomySelect)] : []),
      settingRow("변경 적용 방식", "결과를 바로 반영하거나 확인 후 적용합니다.", applyModeSelect),
      ...(teamToggle ? [settingRow("작업 인원", "혼자 또는 팀으로 · 작업량과 검토도 설정합니다.", teamToggle)] : []),
    ],
  });
  settingsPopover.hidden = true;

  // ── 모델 칩 ──
  const modelChip = el("span", { class: "ai-composer-model", dataset: { testid: "ai-composer-model" } });
  const setModelLabel = (label: string | null): void => {
    modelChip.textContent = label ?? "";
    modelChip.hidden = label === null || label === "";
  };
  setModelLabel(options.modelLabel ?? null);

  // 액션 행: 항상 존재하는 고정 높이 한 줄. 좌측은 nowrap + 가로 스크롤이라 내용이 길어져도
  // 줄이 늘지 않는다(줄바꿈이 곧 바 높이 변화였다).
  const stampToggle = el("button", {
    class: "ai-composer-stamp-toggle",
    text: "바로 깔기",
    attrs: {
      type: "button",
      "aria-pressed": "false",
      "aria-label": "바로 깔기",
      title: "켜면 선택 영역에 바로 깐다. 의도 분류·계획·실행 턴을 거치지 않는다.",
    },
    dataset: { testid: "ai-stamp-place" },
    on: { click: () => {
      const next = stampToggle.getAttribute("aria-pressed") !== "true";
      stampToggle.setAttribute("aria-pressed", String(next));
    } },
  }) as HTMLButtonElement;

  const actions = el("div", {
    class: "ai-composer-actions",
    dataset: { testid: "ai-composer-actions" },
    children: [
      el("div", {
        class: "ai-composer-actions-lead",
        children: [
          stampToggle,
          settingsToggle,
          options.undoAppliedButton,
          options.contextChips,
          options.queueIndicator,
        ],
      }),
      el("div", {
        class: "ai-composer-actions-trail",
        children: [options.statusGroup, options.sendButton, options.abortButton],
      }),
    ],
  });

  // 키 힌트는 행에 두지 않는다(실측 160×15 상시 점유). 입력창 title 로 옮겼다.
  options.input.setAttribute("title", "Enter 보내기 · Shift+Enter 줄바꿈");

  const composer = el("div", {
    class: "ai-composer",
    dataset: { testid: "ai-composer" },
    children: [options.input, actions],
  });

  const commandBar = el("div", {
    class: "ai-command-bar",
    dataset: { testid: "ai-command-bar" },
    // 팝오버는 셸의 형제로 두고(추천은 흐름, 나머지는 absolute) — 흐름 밖.
    children: [
      suggestPopover,
      settingsPopover,
      commandMenu,
      preferencePopover,
      planningPopover,
      ...(teamMenu ? [teamMenu.root] : []),
      ...(options.contextMeterPopover ? [options.contextMeterPopover] : []),
      composer,
    ],
  });

  const onInputFocus = (): void => actions.classList.add("is-input-focused");
  const onInputBlur = (): void => actions.classList.remove("is-input-focused");
  options.input.addEventListener("focus", onInputFocus);
  options.input.addEventListener("blur", onInputBlur);

  // 성향·맥락 팝오버는 호출자가 안 주면 없는 종류다 — 없는 종류를 열어도 조용히 무시된다.
  const popoverOf = (kind: ComposerPopover): HTMLElement | null => {
    if (kind === "settings") return settingsPopover;
    if (kind === "team") return teamMenu?.root ?? null;
    if (kind === "suggest") return suggestPopover;
    if (kind === "menu") return commandMenu;
    if (kind === "preference") return options.preferenceContent ? preferencePopover : null;
    if (kind === "planning") return options.planningContent ? planningPopover : null;
    return options.contextMeterPopover ?? null;
  };
  const toggleOf = (kind: ComposerPopover): HTMLElement | null => {
    if (kind === "settings") return settingsToggle;
    if (kind === "team") return teamToggle;
    if (kind === "menu") return menuToggle;
    if (kind === "preference") return preferenceToggle;
    if (kind === "planning") return planningToggle;
    if (kind === "context") return options.contextMeterButton ?? null;
    return null;
  };

  const positionPopover = (): void => {
    if (openState === null || openState === "suggest" || typeof window === "undefined") return;
    const popover = popoverOf(openState);
    const toggle = toggleOf(openState);
    const parent = popover?.parentElement;
    if (!popover || !toggle || !parent) return;
    popover.style.maxWidth = `${Math.max(0, window.innerWidth - 16)}px`;
    popover.style.maxHeight = `${Math.min(420, window.innerHeight - 16)}px`;
    const rect = popover.getBoundingClientRect();
    // Overflow controls become hidden when their destination popover opens.
    const toggleRect = toggle.getBoundingClientRect();
    const anchor = openState === "team" ? composer : toggleRect.width || toggleRect.height ? toggle : menuToggle;
    const position = anchoredPopupPosition(anchor.getBoundingClientRect(), rect, {
      width: window.innerWidth, height: window.innerHeight,
    }, 6);
    // The deck's glass establishes a containing block, so keep the popover absolute
    // and translate viewport coordinates into its rail instead of using fixed.
    const origin = parent.getBoundingClientRect();
    popover.style.left = `${position.left - origin.left}px`;
    popover.style.top = `${position.top - origin.top}px`;
    popover.style.right = "auto";
    popover.style.bottom = "auto";
    popover.style.overflowY = "auto";
  };
  const popoverResize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(positionPopover);

  const openPopover = (kind: ComposerPopover | null): void => {
    if (openState === kind) return;
    // 없는 종류를 열라는 요청은 조용히 닫기로 바꾼다.
    const resolved = kind !== null && popoverOf(kind) === null ? null : kind;
    if (openState === resolved) return;
    openState = resolved;
    for (const candidate of POPOVER_KINDS) {
      const open = candidate === resolved;
      const popover = popoverOf(candidate);
      if (popover) popover.hidden = !open;
      toggleOf(candidate)?.setAttribute("aria-expanded", String(open));
      toggleOf(candidate)?.classList.toggle("is-active", open);
    }
    commandBar.classList.toggle("has-popover", resolved !== null);
    // 목록 갱신은 **열기 직후** 한 번만 — 매 턴 갱신하면 닫힌 팝오버를 위해 localStorage 를 계속 읽는다.
    if (resolved === "preference") options.onPreferenceOpen?.();
    if (resolved === "planning") options.onPlanningOpen?.();
    popoverResize?.disconnect();
    positionPopover();
    if (resolved !== null && resolved !== "suggest") {
      const popover = popoverOf(resolved);
      if (popover) {
        popoverResize?.observe(popover);
        const deck = popover.parentElement?.parentElement;
        if (deck) popoverResize?.observe(deck);
      }
    }
    options.onPopoverChange?.(resolved);
  };

  // 바깥 클릭·Escape 로 닫힌다 — 이전엔 토글 재클릭만이 유일한 닫기 경로여서
  // 절대배치 메뉴가 좌측 맵트리를 덮은 채 클릭을 가로챘다.
  const isInside = options.isInside ?? ((target: Node): boolean => commandBar.contains(target));
  const onDocumentPointerDown = (event: PointerEvent): void => {
    if (openState === null) return;
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (isInside(target)) return;
    openPopover(null);
  };
  const onDocumentKeyDown = (event: KeyboardEvent): void => {
    if (openState === null || event.key !== "Escape") return;
    const previous = openState;
    openPopover(null);
    if (previous === "team" || previous === "settings") settingsToggle.focus();
  };
  if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
    document.addEventListener("pointerdown", onDocumentPointerDown);
    document.addEventListener("keydown", onDocumentKeyDown);
    document.addEventListener("scroll", positionPopover, true);
  }
  if (typeof window !== "undefined") window.addEventListener("resize", positionPopover);

  const measuredTop = (): number => {
    const barTop = commandBar.getBoundingClientRect().top;
    if (openState === null) return barTop;
    const popover = popoverOf(openState);
    if (!popover) return barTop;
    const popoverRect = popover.getBoundingClientRect();
    return popoverRect.height > 0 ? Math.min(barTop, popoverRect.top) : barTop;
  };

  return {
    commandBar,
    composer,
    actions,
    commandMenu,
    newChatButton,
    conversationsButton,
    menuToggle,
    preferenceToggle,
    preferencePopover,
    planningToggle,
    planningPopover,
    autonomySelect,
    teamToggle,
    stampToggle,
    setPiTeam,
    syncEffort,
    syncApplyMode,
    setModelLabel,
    openPopover,
    openKind: () => openState,
    measuredTop,
    dispose: () => {
      teamMenu?.dispose();
      popoverResize?.disconnect();
      if (typeof window !== "undefined") window.removeEventListener("resize", positionPopover);
      options.input.removeEventListener("focus", onInputFocus);
      options.input.removeEventListener("blur", onInputBlur);
      if (typeof document === "undefined" || typeof document.removeEventListener !== "function") return;
      document.removeEventListener("pointerdown", onDocumentPointerDown);
      document.removeEventListener("keydown", onDocumentKeyDown);
      document.removeEventListener("scroll", positionPopover, true);
    },
  };
}
