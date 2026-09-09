import { openPersistenceRecovery, persistenceStatusLabel, persistenceSurfaceVisible } from "@/editor/persistenceRecoveryUi";
import type { DbPersistenceStatus } from "@/project/persistenceStatus";
import { store } from "@/project/store";
import { el } from "@/util/dom";

type StatusRefresh = () => void;
type OpenSettings = () => void;

export function renderOnlineSaveStatus(
  status: DbPersistenceStatus,
  onRefresh: StatusRefresh,
  openSettings: OpenSettings,
): HTMLElement {
  const autoSave = store.getAutoSaveState();
  const recovery = store.getPersistenceRecovery();
  const recoveryLabel = persistenceStatusLabel(autoSave, recovery);
  const quietReady = status.kind === "ready" && autoSave.kind === "idle" && !persistenceSurfaceVisible(recovery);
  const warning = recovery.kind === "ready" && recovery.mirror?.status === "warning";
  const children: HTMLElement[] = [
    el("span", { class: "db-connection-label", text: onlineSaveStatusText(status) }),
  ];
  if (recovery.kind === "blocked") {
    children.push(
      el("span", {
        class: "db-autosave-state",
        text: recoveryLabel ?? autoSaveStatusText(autoSave),
        dataset: { testid: "db-autosave-state", recoveryCode: recovery.error.code, autosaveKind: autoSave.kind },
      }),
    );
  } else if (!quietReady) {
    children.push(
      el("span", {
        class: "db-autosave-state",
        text: autoSaveStatusText(autoSave),
        dataset: { testid: "db-autosave-state", autosaveKind: autoSave.kind },
      }),
    );
  }
  if (warning) {
    children.push(
      el("span", {
        class: "db-autosave-state persistence-mirror-warning",
        text: "루트 저장됨 · 미리보기 경고",
        dataset: { testid: "persistence-mirror-warning", mirrorStatus: "warning" },
      }),
    );
  }
  const button = el("button", {
    class: `editor-statusbar-cell db-connection-status db-connection-chip-button ${status.kind} autosave-${autoSave.kind}`,
    // 칩 내부 배치는 원래 폐지된 하단 상태바 컨텍스트에 의지했다: `.db-connection-status { gap: 7px }`
    // 는 있는데 display:flex 는 좁은 폭 미디어 쿼리(07-context-menu-responsive.css:177) 안에만
    // 있어서, 톱바에 마운트하면 button 기본값 inline-block 으로 떨어져 라벨과 상태가 붙어
    // "온라인 저장저장 실패" 로 읽힌다. 호스트가 어디든 같게 보이도록 배치를 칩이 직접 들고 있는다.
    attrs: {
      title: onlineSaveButtonTitle(status, autoSave, recoveryLabel),
      type: "button",
      style: "display:inline-flex;align-items:center;gap:7px",
    },
    children,
    dataset: { testid: "db-connection-status" },
    on: { click: openSettings },
  });
  if (recovery.kind === "blocked") {
    const recover = el("button", {
      class: "db-autosave-retry-button",
      text: "복구",
      attrs: { type: "button", title: "다시 불러오거나 복사본을 내보냅니다. 새 토큰으로 덮어쓰지 않습니다." },
      dataset: { testid: "persistence-recovery-open" },
      on: {
        click: () => {
          openPersistenceRecovery();
          onRefresh();
        },
      },
    });
    return el("span", {
      class: "db-connection-status-group",
      attrs: { role: "group", "aria-label": "온라인 저장 복구" },
      children: [button, recover],
    });
  }
  if (autoSave.kind === "error") {
    const retry = el("button", {
      class: "db-autosave-retry-button",
      text: "다시 저장",
      attrs: { type: "button", title: "온라인 저장을 다시 시도합니다." },
      dataset: { testid: "db-autosave-retry" },
      on: {
        click: () => {
          void store.flush()
            .catch((error: unknown) => {
              if (error instanceof Error) console.error("[store] manual auto-save retry failed:", error);
              else console.error("[store] manual auto-save retry failed");
            })
            .finally(onRefresh);
        },
      },
    });
    return el("span", {
      class: "db-connection-status-group",
      attrs: { role: "group", "aria-label": "온라인 저장 작업" },
      children: [button, retry],
    });
  }
  return button;
}

function onlineSaveStatusText(status: DbPersistenceStatus): string {
  switch (status.kind) {
    case "ready":
      return "온라인 저장";
    case "not-configured":
      return "온라인 저장: 준비 안 됨";
    case "disabled":
      return "온라인 저장: 오프라인";
  }
}

function onlineSaveButtonTitle(
  status: DbPersistenceStatus,
  autoSave: ReturnType<typeof store.getAutoSaveState>,
  recoveryLabel: string | null,
): string {
  const recovery = recoveryLabel ? `${recoveryLabel}.` : autoSaveStatusTitle(autoSave);
  return `${onlineSaveStatusTitle(status)} ${recovery} 클릭하면 저장된 작업을 확인합니다.`;
}

function onlineSaveStatusTitle(status: DbPersistenceStatus): string {
  switch (status.kind) {
    case "ready":
      return "온라인 저장이 준비되어 있습니다.";
    case "not-configured":
      return "온라인 저장을 준비하지 못했습니다. 잠시 후 다시 시도하세요.";
    case "disabled":
      return status.reason === "dev-showcase"
        ? "현재 예제 모드에서는 온라인 저장을 사용하지 않습니다."
        : "복구 모드에서는 온라인 저장을 잠시 사용하지 않습니다.";
  }
}

function autoSaveStatusText(state: ReturnType<typeof store.getAutoSaveState>): string {
  switch (state.kind) {
    case "idle":
      return "저장할 변경 없음";
    case "pending":
      return "저장 대기";
    case "saving":
      return "저장 중";
    case "saved":
      return `${formatAutoSaveTime(state.at)} 저장됨`;
    case "error":
      // 진짜 저장 실패와 "이 자리는 원래 저장하지 않는다" 는 다른 사건이다.
      // 후자를 "실패" 로 적으면 다시 시도하면 될 줄 알게 된다 — 이 위치에서는 몇 번을 눌러도 저장되지 않는다.
      if (state.code === "session-not-persisted") return "이 세션은 저장 안 됨";
      return state.retryCount ? `저장 실패 · 다시 시도 ${state.retryCount}회` : "저장 실패";
  }
}

function autoSaveStatusTitle(state: ReturnType<typeof store.getAutoSaveState>): string {
  switch (state.kind) {
    case "idle":
      return "모든 변경이 저장되어 있습니다.";
    case "pending":
      return "변경 내용을 곧 자동으로 저장합니다.";
    case "saving":
      return "변경 내용을 저장하고 있습니다.";
    case "saved":
      return `${formatAutoSaveTime(state.at)}에 저장했습니다.`;
    case "error":
      if (state.code === "session-not-persisted") {
        return "이 주소는 예제·새 프로젝트 세션이라 변경을 살려 두지 않습니다. 보존하려면 프로젝트를 내보내거나 정상 주소로 여세요.";
      }
      return "변경 내용을 저장하지 못했습니다. 다시 저장하거나 잠시 후 다시 시도하세요.";
  }
}

function formatAutoSaveTime(at: number): string {
  const date = new Date(at);
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}
