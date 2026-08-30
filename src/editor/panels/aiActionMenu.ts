// editor/panels/aiActionMenu.ts
// AI 패널 2차 액션 메뉴의 **항목 목록 단일 구현**.
//
// 왜: 헤더 ☰(`.ai-more-menu` 안 접힌 `작업`)와 컴포저 ☰(`.ai-command-menu`)가 같은 5개 항목
// (되돌리기 · 내보내기 · 도크 전환 · 전체 기록 · 툴 브라우저)을 각각 따로 만들고 있었다.
// 두 벌이라 도크 라벨 갱신도 두 곳(`moreMenuDockItem`, `commandDockItem`)에서 따로 했고,
// 한쪽에만 항목을 추가하면 조용히 갈라졌다. 컨테이너/위치/열림 상태는 서로 달라야 하므로
// (헤더는 자체 pointerdown 핸들러, 컴포저는 팝오버 셸이 소유) **항목만** 공유한다.
//
// testid 는 두 표면이 서로 다르다(기존 테스트 계약 유지):
//   헤더   ai-more-undo / ai-more-export / ai-more-dock / ai-more-history / ai-more-tools
//   컴포저 ai-command-menu-undo / ai-command-menu-export / ai-command-menu-dock /
//          (전체 기록은 원래 testid 없음) / ai-command-menu-tools

import { el } from "@/util/dom";

export type AiActionMenuVariant = "header" | "composer";

export interface AiActionMenuActions {
  readonly startNewChat: () => void;
  readonly openSettings: () => void;
  readonly undoLast: () => void;
  readonly exportAudit: () => void;
  readonly toggleDock: () => void;
  readonly openHistory: () => void;
  readonly openTools: () => void;
  readonly startInterview: () => void;
  readonly learnStructure: () => void;
  readonly startDemoTeach: () => void;
}

export interface AiActionMenuItems {
  /** 메뉴 컨테이너에 그대로 넣을 항목들(선언 순서 = 표시 순서). */
  readonly items: readonly HTMLButtonElement[];
  /** 도크 전환 항목 — 라벨이 현재 도크에 따라 바뀌므로 호출자가 들고 있어야 한다. */
  readonly dockItem: HTMLButtonElement;
}

interface ItemSpec {
  readonly label: string;
  readonly testid: string | null;
  readonly title?: string;
  /** 아이콘이 붙는 항목은 라벨만으로 부족하다 — 스크린리더용 이름을 따로 준다. */
  readonly ariaLabel?: string;
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
  // 라벨/툴팁은 applyDockModeChrome 이 현재 도크에 맞춰 덮어쓴다(초기값은 자리표시).
  const dockItem = build({
    label: "플로팅 바로 전환",
    testid: header ? "ai-more-dock" : "ai-command-menu-dock",
    run: options.actions.toggleDock,
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

  // 설정 — 2026-08-28 헤더 제거 뒤 패널에는 AI 설정(인증·모델·글자 크기)으로 가는 진입점이
  // 하나도 없었다(에디터 톱바 ⚙ 만 유일). 오류 버블의 [설정 열기]는 401 이 터진 뒤에만 보이므로
  // 평상시 경로가 아니다. testid 는 기존 계약 ai-settings-toggle 을 그대로 다시 쓴다.
  const settings = build({
    label: "⚙ 설정",
    testid: header ? "ai-more-settings" : "ai-settings-toggle",
    title: "AI 설정 — 연결·모델·글자 크기",
    ariaLabel: "AI 설정 열기",
    run: options.actions.openSettings,
  });

  // 가르치기 진입점 셋. 사라진 스킬 서러에 업혀 있었던 기능이다 — 서러만 없어지면 되지
  // 기능이 사라질 이유는 없으므로 동일한 legacy testid 로 ☰ 에 재배치한다.
  const interview = build({
    label: "🎓 맵 인터뷰",
    testid: header ? "ai-interview" : "ai-command-menu-interview",
    title: "현재 맵의 타일 의미를 질문으로 배운다",
    run: options.actions.startInterview,
  });
  const learnStructure = build({
    label: "📐 선택 영역 학습",
    testid: header ? "ai-learn-structure" : "ai-command-menu-learn-structure",
    title: "선택한 구조물을 템플릿으로 배운다(선택 영역 필수)",
    run: options.actions.learnStructure,
  });
  const demoTeach = build({
    label: "✍️ 시연으로 가르치기",
    testid: header ? "ai-demo-teach" : "ai-command-menu-demo-teach",
    title: "샌드박스에 직접 타일을 깔아 교정한다(실제 맵은 바뀌지 않는다)",
    run: options.actions.startDemoTeach,
  });

  return {
    items: [newChat, undo, exportItem, dockItem, history, tools, settings, interview, learnStructure, demoTeach],
    dockItem,
  };
}
