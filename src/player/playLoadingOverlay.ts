import { el } from "@/util/dom";

export type PlayLoadStage =
  | "saving"
  | "preparing"
  | "engine"
  | "assets"
  | "map"
  | "ready"
  | "error";

export type PlayRecoveryInput = {
  readonly title: string;
  readonly reason: string;
  readonly repairs?: readonly string[];
  readonly diagnostics?: string;
  readonly onRetry?: () => void;
  readonly onSafeMode?: () => void;
};

export type PlayLoadingOverlay = {
  readonly root: HTMLElement;
  setStage(stage: PlayLoadStage, detail?: string): void;
  setProgress(ratio: number | null): void;
  showRecovery(input: PlayRecoveryInput): void;
  remove(): void;
};

const STAGE_LABELS: Record<PlayLoadStage, string> = {
  saving: "프로젝트 저장 중…",
  preparing: "시연 실행 준비 중…",
  engine: "플레이 엔진 불러오는 중…",
  assets: "맵·에셋 불러오는 중…",
  map: "맵 구성하는 중…",
  ready: "준비 완료",
  error: "준비에 실패했습니다",
};

const STAGE_HINTS: Partial<Record<PlayLoadStage, string>> = {
  saving: "편집 내용을 서버에 반영한 뒤 플레이를 시작합니다.",
  preparing: "플레이 창과 런타임을 준비하고 있습니다.",
  engine: "처음 실행 시 엔진 로드에 잠시 걸릴 수 있습니다.",
  assets: "사용 중인 타일셋·캐릭터 그래픽을 읽고 있습니다.",
  map: "맵 타일과 이벤트를 배치하고 있습니다.",
  error: "창을 닫고 다시 시도해 주세요.",
};

export function mountPlayLoadingOverlay(
  host: HTMLElement,
  initialStage: PlayLoadStage = "preparing"
): PlayLoadingOverlay {
  host.querySelector("[data-testid='play-loading-overlay']")?.remove();

  const message = el("div", {
    class: "play-loading-message",
    text: STAGE_LABELS[initialStage],
    dataset: { testid: "play-loading-message" },
  });
  const hint = el("div", {
    class: "play-loading-hint",
    text: STAGE_HINTS[initialStage] ?? "",
    dataset: { testid: "play-loading-hint" },
  });
  const barFill = el("div", {
    class: "play-loading-bar-fill",
    dataset: { testid: "play-loading-bar-fill" },
  });
  const bar = el("div", {
    class: "play-loading-bar is-indeterminate",
    dataset: { testid: "play-loading-bar" },
    children: [barFill],
  });
  const stageMeta = el("div", {
    class: "play-loading-stage",
    text: stageCode(initialStage),
    dataset: { testid: "play-loading-stage", stage: initialStage },
  });
  const spinner = el("div", {
    class: "play-loading-spinner",
    attrs: { "aria-hidden": "true" },
  });
  const card = el("div", {
    class: "play-loading-card",
    children: [spinner, message, hint, bar, stageMeta],
  });
  const root = el("div", {
    class: "play-loading-overlay",
    attrs: {
      role: "status",
      "aria-live": "polite",
      "aria-busy": "true",
      "aria-label": STAGE_LABELS[initialStage],
    },
    dataset: { testid: "play-loading-overlay", stage: initialStage },
    children: [card],
  });
  host.append(root);

  let currentStage: PlayLoadStage = initialStage;

  const setStage = (stage: PlayLoadStage, detail?: string): void => {
    card.querySelector("[data-testid='play-recovery-panel']")?.remove();
    card.classList.remove("is-recovery");
    currentStage = stage;
    root.dataset.stage = stage;
    stageMeta.dataset.stage = stage;
    stageMeta.textContent = stageCode(stage);
    message.textContent = detail?.trim() || STAGE_LABELS[stage];
    hint.textContent = STAGE_HINTS[stage] ?? "";
    root.setAttribute("aria-label", message.textContent);
    root.setAttribute("aria-busy", stage === "ready" || stage === "error" ? "false" : "true");
    root.classList.toggle("is-error", stage === "error");
    if (stage === "ready") {
      setProgress(1);
    }
  };

  const setProgress = (ratio: number | null): void => {
    if (ratio === null || !Number.isFinite(ratio)) {
      bar.classList.add("is-indeterminate");
      barFill.style.width = "";
      bar.dataset.progress = "";
      return;
    }
    const clamped = Math.max(0, Math.min(1, ratio));
    bar.classList.remove("is-indeterminate");
    barFill.style.width = `${Math.round(clamped * 100)}%`;
    bar.dataset.progress = String(Math.round(clamped * 100));
    // Keep a soft floor so early stages still look alive.
    if (clamped < 0.05 && currentStage !== "ready") {
      barFill.style.width = "5%";
    }
  };

  const showRecovery = (input: PlayRecoveryInput): void => {
    card.querySelector("[data-testid='play-recovery-panel']")?.remove();

    const actions = el("div", { class: "play-recovery-actions" });
    if (input.onRetry) {
      actions.append(el("button", {
        class: "play-recovery-button is-primary",
        text: "다시 시도",
        attrs: { type: "button" },
        dataset: { testid: "play-recovery-retry" },
        on: { click: input.onRetry },
      }));
    }
    if (input.onSafeMode) {
      actions.append(el("button", {
        class: "play-recovery-button",
        text: "안전 모드로 시작",
        attrs: { type: "button" },
        dataset: { testid: "play-recovery-safe-mode" },
        on: { click: input.onSafeMode },
      }));
    }
    actions.append(el("button", {
      class: "play-recovery-button",
      text: "진단 내용 복사",
      attrs: { type: "button" },
      dataset: { testid: "play-recovery-copy" },
      on: { click: () => copyDiagnostics(input.diagnostics ?? input.reason) },
    }));

    const panel = el("section", {
      class: "play-recovery-panel",
      attrs: { role: "alert" },
      dataset: { testid: "play-recovery-panel" },
      children: [
        el("h2", { class: "play-recovery-title", text: input.title }),
        el("pre", {
          class: "play-recovery-reason",
          text: input.reason,
          dataset: { testid: "play-recovery-reason" },
        }),
      ],
    });
    if (input.repairs?.length) {
      panel.append(el("div", {
        class: "play-recovery-repairs",
        dataset: { testid: "play-recovery-repairs" },
        children: [
          el("h3", { class: "play-recovery-repairs-title", text: "자동으로 복구한 항목" }),
          el("ul", {
            children: input.repairs.map((repair) => el("li", { text: repair })),
          }),
        ],
      }));
    }
    panel.append(actions);
    card.append(panel);
    card.classList.add("is-recovery");
    currentStage = "error";
    root.dataset.stage = "error";
    root.classList.add("is-error");
    root.setAttribute("aria-busy", "false");
    root.setAttribute("aria-label", input.title);
  };

  const remove = (): void => {
    root.remove();
  };

  setProgress(null);

  return { root, setStage, setProgress, showRecovery, remove };
}

function copyDiagnostics(text: string): void {
  // 클립보드 권한·API가 없어도 복구 버튼 자체는 항상 안전하게 동작해야 한다.
  try {
    const request = navigator.clipboard?.writeText(text);
    void request?.catch(() => undefined);
  } catch {
    // 일부 브라우저는 클립보드 속성 접근이나 호출 단계에서 동기 오류를 던진다.
  }
}

function stageCode(stage: PlayLoadStage): string {
  switch (stage) {
    case "saving":
      return "1 / 저장";
    case "preparing":
      return "2 / 준비";
    case "engine":
      return "3 / 엔진";
    case "assets":
      return "4 / 에셋";
    case "map":
      return "5 / 맵";
    case "ready":
      return "완료";
    case "error":
      return "오류";
  }
}
