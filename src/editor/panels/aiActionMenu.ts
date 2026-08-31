// editor/panels/aiActionMenu.ts
// AI 패널 2차 액션 메뉴의 **항목 목록 단일 구현**.
//
// 왜: 헤더 ☰(`.ai-more-menu` 안 접힌 `작업`)와 컴포저 ☰(`.ai-command-menu`)가 같은 항목
// (되돌리기 · 내보내기 · 전체 기록 · 툴 브라우저)을 각각 따로 만들고 있었다. 두 벌이라
// 한쪽에만 항목을 추가하면 조용히 갈라졌다. 컨테이너/위치/열림 상태는 서로 달라야 하므로
// (헤더는 자체 pointerdown 핸들러, 컴포저는 팝오버 셸이 소유) **항목만** 공유한다.
//
// 2026-08-31: 「도크 전환」 항목을 걷었다. 도크 축(glass/side/float)이 삭제돼 갈 곳이
// 하나뿐인데, 항목은 남아 라벨만 「입력줄」로 고정된 채 눌러도 토스트만 떴다 — 메뉴가
// 있지도 않은 선택지를 광고하는 상태였다. 그래서 5개 → 4개.
//
// testid 는 두 표면이 서로 다르다(기존 테스트 계약 유지):
//   헤더   ai-more-undo / ai-more-export / ai-more-history / ai-more-tools
//   컴포저 ai-command-menu-undo / ai-command-menu-export /
//          (전체 기록은 원래 testid 없음) / ai-command-menu-tools

import { el } from "@/util/dom";

export type AiActionMenuVariant = "header" | "composer";

export interface AiActionMenuActions {
  readonly startNewChat: () => void;
  readonly undoLast: () => void;
  readonly exportAudit: () => void;
  readonly openHistory: () => void;
  readonly openTools: () => void;
  readonly startInterview: () => void;
  readonly learnStructure: () => void;
  readonly startDemoTeach: () => void;
}

export interface AiActionMenuItems {
  /** 메뉴 컨테이너에 그대로 넣을 항목들(선언 순서 = 표시 순서). */
  readonly items: readonly HTMLButtonElement[];
}

interface ItemSpec {
  readonly label: string;
  readonly testid: string | null;
  readonly title?: string;
  readonly run: () => void;
}

export function createAiActionMenuItems(options: {
  readonly variant: AiActionMenuVariant;
  /** 항목을 누르면 먼저 메뉴를 닫는다 — 표면마다 닫는 방법이 다르다. */
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
      },
      ...(spec.testid === null ? {} : { dataset: { testid: spec.testid } }),
      on: {
        click: () => {
          options.close();
          spec.run();
        },
      },
    }) as HTMLButtonElement;

  const newChat = build({
    label: "새 대화",
    testid: header ? "ai-more-new-chat" : "ai-command-menu-new-chat",
    title: "지금 대화를 기록에 저장하고 빈 대화를 시작한다",
    run: options.actions.startNewChat,
  });
  const undo = build({
    label: "되돌리기",
    testid: header ? "ai-more-undo" : "ai-command-menu-undo",
    title: "마지막 AI 적용 되돌리기",
    run: options.actions.undoLast,
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

  // 가르치기 진입점 셋. 사라진 스킬 서러에 업혀 있었던 기능이다 — 서러만 없어지면 되지
  // 기능이 사라질 이유는 없으므로 동일한 legacy testid 로 ☰ 에 재배치한다.
  const interview = build({
    label: "🎓 맵 인터뷰",
    testid: header ? "ai-interview" : "ai-command-menu-interview",
    title: "현재 맵의 타일 의믜를 질문으로 배운다",
    run: options.actions.startInterview,
  });
  const learnStructure = build({
    label: "📐 선택 여역 학습",
    testid: header ? "ai-learn-structure" : "ai-command-menu-learn-structure",
    title: "선택한 구조밌을 템플릿으로 배운다(선택 여역 필수)",
    run: options.actions.learnStructure,
  });
  const demoTeach = build({
    label: "✍️ 시연으로 가르치기",
    testid: header ? "ai-demo-teach" : "ai-command-menu-demo-teach",
    title: "샌드박스에 직접 타일을 깔아 교정한다(실제 맵은 바뀌지 않는다)",
    run: options.actions.startDemoTeach,
  });

  return { items: [newChat, undo, exportItem, history, tools, interview, learnStructure, demoTeach] };
}
