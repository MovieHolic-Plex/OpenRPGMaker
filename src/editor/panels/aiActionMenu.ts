// editor/panels/aiActionMenu.ts
// 조수 2차 액션 메뉴의 **항목 목록 단일 구현**.
//
// 왜: 예전에는 헤더 ☰(`.ai-more-menu`)와 컴포저 ☰(`.ai-command-menu`)가 같은 항목들을 각각
// 따로 만들었고, 도크 라벨 갱신도 두 곳(`moreMenuDockItem`, `commandDockItem`)에서 따로 해서
// 한쪽에만 항목을 추가하면 조용히 갈라졌다. 그래서 항목 생성을 이 파일로 모았다.
//
// 2026-08-29 조수 띠로 넘어오면서 표면이 **하나**가 됐다(헤더 크롬 자체가 없어졌다). 그래서
// `variant: "header" | "composer"` 와 testid 두 벌도 함께 지운다 — 부를 사람이 없는 분기를
// 남겨 두면 위에 적은 "조용히 갈라짐"이 그대로 되살아난다.
//
// 도크 전환 항목(`ai-command-menu-dock`)도 사라졌다. 띠는 캔버스 우하단 한 자리에만 살아서
// 전환할 대상이 없다.
//
// testid: ai-command-menu-{undo,export,history,tools,interview,learn-structure,demo-teach}

import { el } from "@/util/dom";

export interface AiActionMenuActions {
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
  readonly testid: string;
  readonly title?: string;
  readonly run: () => void;
}

export function createAiActionMenuItems(options: {
  /** 항목을 누르면 먼저 메뉴를 닫는다 — 닫는 방법은 팝오버 셸이 소유한다. */
  readonly close: () => void;
  readonly actions: AiActionMenuActions;
}): AiActionMenuItems {
  const build = (spec: ItemSpec): HTMLButtonElement =>
    el("button", {
      class: "ai-command-menu-item",
      text: spec.label,
      attrs: {
        type: "button",
        role: "menuitem",
        ...(spec.title === undefined ? {} : { title: spec.title }),
      },
      dataset: { testid: spec.testid },
      on: {
        click: () => {
          options.close();
          spec.run();
        },
      },
    }) as HTMLButtonElement;

  const items = [
    build({
      label: "되돌리기",
      testid: "ai-command-menu-undo",
      title: "마지막 AI 적용 되돌리기",
      run: options.actions.undoLast,
    }),
    build({
      label: "내보내기",
      testid: "ai-command-menu-export",
      title: "대화 로그 내보내기",
      run: options.actions.exportAudit,
    }),
    build({
      label: "전체 기록",
      testid: "ai-command-menu-history",
      title: "지난 대화 전체를 기록 오버레이로 열기",
      run: options.actions.openHistory,
    }),
    build({
      label: "툴 브라우저",
      testid: "ai-command-menu-tools",
      title: "조수가 쓸 수 있는 툴 목록 보기",
      run: options.actions.openTools,
    }),
    // 가르치기 진입점 셋. 사라진 스킬 서랍에 업혀 있었던 기능이다 — 서랍만 없어지면 되지
    // 기능이 사라질 이유는 없으므로 ☰ 에 재배치한다.
    build({
      label: "🎓 맵 인터뷰",
      testid: "ai-command-menu-interview",
      title: "현재 맵의 타일 의미를 질문으로 배운다",
      run: options.actions.startInterview,
    }),
    build({
      label: "📐 선택 영역 학습",
      testid: "ai-command-menu-learn-structure",
      title: "선택한 구조물을 템플릿으로 배운다(선택 영역 필수)",
      run: options.actions.learnStructure,
    }),
    build({
      label: "✍️ 시연으로 가르치기",
      testid: "ai-command-menu-demo-teach",
      title: "샌드박스에 직접 타일을 깔아 교정한다(실제 맵은 바뀌지 않는다)",
      run: options.actions.startDemoTeach,
    }),
  ];

  return { items };
}
