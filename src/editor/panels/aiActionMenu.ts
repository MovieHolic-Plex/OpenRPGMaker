// editor/panels/aiActionMenu.ts
// AI 패널 2차 액션 메뉴의 **항목 목록 단일 구현**.
//
// 왜: 헤더 ☰(`.ai-more-menu` 안 접힌 `작업`)와 컴포저 ☰(`.ai-command-menu`)가 같은 항목을
// 각각 따로 만들고 있었다. 컨테이너/위치/열림 상태는 서로 달라야 하므로 항목만 공유한다.
//
// 2026-09-01: 메뉴를 **다른 크롬에 없는 항목만** 남긴다.
//   뺀 것 — 새 대화(＋), 이전 대화(🕒), 되돌리기(컴포저 ↶), 스튜디오(톱바),
//   맵 인터뷰·선택 영역 학습·시연(삭제된 스킬 서러 잔재).
//   설정은 톱바 「AI 설정」과 같으므로 ☰ 에 두지 않는다. 패널 단독 테스트는
//   톱바가 없어서 설정 모달을 열려면 오류 버블의 [설정 열기]를 쓴다.
//
// testid 는 두 표면이 서로 다르다(기존 테스트 계약 유지):
//   헤더   ai-more-export / ai-more-history / ai-more-tools
//   컴포저 ai-command-menu-export / (전체 기록은 testid 없음) / ai-command-menu-tools

import { el } from "@/util/dom";
import { deckIcon, type DeckIconName } from "./aiDeckIcons";

export type AiActionMenuVariant = "header" | "composer";

export interface AiActionMenuActions {
  readonly openAuthoring?: (tab: "quests" | "library" | "dialogue" | "inspector") => void;
  readonly exportAudit: () => void;
  /** 사용 로그(src/ai/activityLog.ts)를 .txt 로 바로 내려받는다. */
  readonly downloadUsageLog: () => void;
  readonly openHistory: () => void;
  readonly openTools: () => void;
  readonly openInstructions: () => void;
  readonly compactContext: () => void;
  readonly openSettings: () => void;
  readonly refreshWiki?: () => void;
  readonly showAcceptanceChecklist?: () => void;
}

export interface AiActionMenuItems {
  /** 메뉴 컨테이너에 그대로 넣을 항목들(선언 순서 = 표시 순서). */
  readonly items: readonly HTMLButtonElement[];
  readonly setHistoryOpen: (open: boolean) => void;
  readonly setAcceptanceState: (hasSnapshot: boolean, hidden: boolean) => void;
}

/** 항목 오른쪽 메타(맥락 사용률·지침 줄 수·도구 수·현재 모델). 값이 null 이면 비운다. */
export type AiActionMenuMeta = Partial<Record<"compact" | "instructions" | "tools" | "settings", () => string | null>>;

interface ItemSpec {
  readonly key: keyof AiActionMenuMeta | "export" | "usage-log" | "history" | "wiki" | "acceptance";
  readonly label: string;
  readonly icon: DeckIconName;
  readonly testid: string | null;
  readonly title?: string;
  readonly ariaLabel?: string;
  readonly run: () => void;
}

export function createAiActionMenuItems(options: {
  readonly variant: AiActionMenuVariant;
  readonly close: () => void;
  readonly actions: AiActionMenuActions;
  readonly meta?: AiActionMenuMeta;
}): AiActionMenuItems {
  const header = options.variant === "header";
  const itemClass = header ? "ai-more-menu-item" : "ai-command-menu-item";
  // 데크(2026-09-03): 아이콘 + 라벨 + 오른쪽 메타. 텍스트만 있던 6줄 목록이 640px 팝오버의 절반을 비웠다.
  const build = (spec: ItemSpec): HTMLButtonElement => {
    const metaText = spec.key === "export" || spec.key === "usage-log" || spec.key === "history" || spec.key === "wiki" || spec.key === "acceptance" ? null : options.meta?.[spec.key]?.() ?? null;
    return el("button", {
      class: itemClass,
      attrs: {
        type: "button",
        role: "menuitem",
        ...(spec.title === undefined ? {} : { title: spec.title }),
        ...(spec.ariaLabel === undefined ? {} : { "aria-label": spec.ariaLabel }),
      },
      ...(spec.testid === null ? {} : { dataset: { testid: spec.testid } }),
      children: [
        deckIcon(spec.icon),
        el("span", { class: "ai-command-menu-label", text: spec.label }),
        ...(metaText ? [el("span", { class: "ai-command-menu-meta", text: metaText })] : []),
      ],
      on: {
        click: () => {
          options.close();
          spec.run();
        },
      },
    }) as HTMLButtonElement;
  };

  const compact = build({
    key: "compact",
    icon: "compress",
    label: "맥락 압축",
    testid: header ? "ai-more-compact" : "ai-command-menu-compact",
    title: "이전 맥락을 요약 1건으로 접어 자리를 비운다",
    run: options.actions.compactContext,
  });
  const instructions = build({
    key: "instructions",
    icon: "book",
    label: "감독 지침",
    testid: header ? "ai-more-instructions" : "ai-command-menu-instructions",
    title: "이 프로젝트의 조수에게 항상 주는 고정 규칙을 적는다",
    run: options.actions.openInstructions,
  });
  const exportItem = build({
    key: "export",
    icon: "export",
    label: "로컬 진단 보고서",
    testid: header ? "ai-more-export" : "ai-command-menu-export",
    title: "동의 후 로컬 진단 수집 및 보고서 미리보기",
    run: options.actions.exportAudit,
  });
  // 「로컬 진단 보고서」와 다른 것이다: 저쪽은 동의를 받고 지금 환경을 수집하는 버그 신고서,
  // 이쪽은 이미 쌓여 있는 조수 사용 기록을 그 자리에서 .txt 로 떨어뜨리는 것이다.
  const usageLog = build({
    key: "usage-log",
    icon: "list",
    label: "사용 로그 내려받기",
    testid: header ? "ai-more-usage-log" : "ai-command-menu-usage-log",
    title: "조수가 한 일(지시·도구·결과) 전체를 txt 파일로 저장",
    run: options.actions.downloadUsageLog,
  });
  const history = build({
    key: "history",
    icon: "scroll",
    label: "전체 기록",
    testid: header ? "ai-more-history" : null,
    run: options.actions.openHistory,
  });
  const setHistoryOpen = (open: boolean): void => {
    const label = history.querySelector(".ai-command-menu-label");
    if (label) label.textContent = open ? "전체 기록 닫기" : "전체 기록";
    history.setAttribute("aria-expanded", String(open));
  };
  setHistoryOpen(false);
  const tools = build({
    key: "tools",
    icon: "wrench",
    label: "도구 목록",
    testid: header ? "ai-more-tools" : "ai-command-menu-tools",
    run: options.actions.openTools,
  });
  const settings = build({
    key: "settings",
    icon: "gear",
    label: "설정",
    testid: header ? "ai-more-settings" : "ai-command-menu-settings",
    title: "AI 설정 — 연결·모델·글자 크기",
    ariaLabel: "AI 설정 열기",
    run: options.actions.openSettings,
  });

  const acceptance = options.actions.showAcceptanceChecklist ? build({
    key: "acceptance", icon: "check", label: "완료 기준 다시 보기",
    testid: header ? "ai-more-acceptance-show" : "ai-command-menu-acceptance-show",
    run: options.actions.showAcceptanceChecklist,
  }) : null;
  const setAcceptanceState = (hasSnapshot: boolean, hidden: boolean): void => {
    if (!acceptance) return;
    acceptance.hidden = !hasSnapshot;
    acceptance.disabled = !hasSnapshot || !hidden;
  };
  setAcceptanceState(false, false);

  return {
    setHistoryOpen,
    setAcceptanceState,
    items: [
      compact, instructions,
      ...(options.actions.openAuthoring ? ([['quests', '퀘스트 프리셋'], ['library', '프롬프트 라이브러리'], ['dialogue', '대사 목록·문체 검토'], ['inspector', '프롬프트 검사기']] as const).map(([tab, label]) => build({
        key: 'tools', icon: 'book', label, testid: `feature16-open-${tab}-${options.variant}`,
        run: () => options.actions.openAuthoring?.(tab),
      })) : []),
      ...(options.actions.refreshWiki ? [build({
        key: "wiki", icon: "book", label: "이전 대화로 설정집 정리",
        testid: header ? "ai-more-wiki" : "ai-command-menu-wiki",
        run: options.actions.refreshWiki,
      })] : []),
      exportItem, usageLog, history, tools, settings, ...(acceptance ? [acceptance] : []),
    ],
  };
}
