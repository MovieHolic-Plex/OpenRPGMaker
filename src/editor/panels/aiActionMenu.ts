// editor/panels/aiActionMenu.ts
// AI 패널 2차 액션 메뉴의 **항목 목록 단일 구현**.
//
// 왜: 헤더 ☰(`.ai-more-menu`)와 컴포저 ☰(`.ai-command-menu`)가 같은 5개 항목
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
  readonly undoLast: () => void;
  readonly exportAudit: () => void;
  readonly toggleDock: () => void;
  readonly openHistory: () => void;
  readonly openTools: () => void;
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

  return { items: [undo, exportItem, dockItem, history, tools], dockItem };
}
