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

export type AiActionMenuVariant = "header" | "composer";

export interface AiActionMenuActions {
  readonly exportAudit: () => void;
  readonly openHistory: () => void;
  readonly openTools: () => void;
  readonly openInstructions: () => void;
  readonly compactContext: () => void;
  readonly openSettings: () => void;
}

export interface AiActionMenuItems {
  /** 메뉴 컨테이너에 그대로 넣을 항목들(선언 순서 = 표시 순서). */
  readonly items: readonly HTMLButtonElement[];
}

interface ItemSpec {
  readonly label: string;
  readonly testid: string | null;
  readonly title?: string;
  readonly ariaLabel?: string;
  readonly run: () => void;
}

export function createAiActionMenuItems(options: {
  readonly variant: AiActionMenuVariant;
  readonly close: () => void;
  readonly actions: AiActionMenuActions;
}): AiActionMenuItems {
  const header = options.variant === "header";
  const itemClass = header ? "ai-more-menu-item" : "ai-command-menu-item";
  const build = (spec: ItemSpec): HTMLButtonElement =>
    el("button", {
      class: itemClass,
      text: spec.label,
      attrs: {
        type: "button",
        role: "menuitem",
        ...(spec.title === undefined ? {} : { title: spec.title }),
        ...(spec.ariaLabel === undefined ? {} : { "aria-label": spec.ariaLabel }),
      },
      ...(spec.testid === null ? {} : { dataset: { testid: spec.testid } }),
      on: {
        click: () => {
          options.close();
          spec.run();
        },
      },
    }) as HTMLButtonElement;

  const compact = build({
    label: "맥락 압축",
    testid: header ? "ai-more-compact" : "ai-command-menu-compact",
    title: "이전 맥락을 요약 1건으로 접어 자리를 비운다",
    run: options.actions.compactContext,
  });
  const instructions = build({
    label: "감독 지침",
    testid: header ? "ai-more-instructions" : "ai-command-menu-instructions",
    title: "이 프로젝트의 조수에게 항상 주는 고정 규칙을 적는다",
    run: options.actions.openInstructions,
  });
  const exportItem = build({
    label: "내보내기",
    testid: header ? "ai-more-export" : "ai-command-menu-export",
    title: "대화 로그 내보내기",
    run: options.actions.exportAudit,
  });
  const history = build({
    label: "전체 기록",
    testid: header ? "ai-more-history" : null,
    run: options.actions.openHistory,
  });
  const tools = build({
    label: "툴 브라우저",
    testid: header ? "ai-more-tools" : "ai-command-menu-tools",
    run: options.actions.openTools,
  });
  const settings = build({
    label: "⚙ 설정",
    testid: header ? "ai-more-settings" : "ai-command-menu-settings",
    title: "AI 설정 — 연결·모델·글자 크기",
    ariaLabel: "AI 설정 열기",
    run: options.actions.openSettings,
  });

  return {
    items: [compact, instructions, exportItem, history, tools, settings],
  };
}
