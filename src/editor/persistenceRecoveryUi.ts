import { registerModal, unregisterModal } from "@/editor/ui/modalStack";
import { projectWithoutEventDrafts } from "@/project/eventDrafts";
import { createProjectPackage, projectPackageFileName } from "@/project/package";
import { SpatialPersistenceError, type PersistenceFault } from "@/project/spatial/persistenceTypes";
import { ProjectRoutingError, type ProjectRoutingFault } from "@/project/spatial/saveRouting";
import { store, type AutoSaveState, type ProjectPersistenceRecovery } from "@/project/store";
import { el } from "@/util/dom";
import { downloadBlob } from "@/util/downloadBlob";
import { toast } from "@/util/toast";

type RecoveryFault = SpatialPersistenceError | ProjectRoutingError;
type RecoveryCopy = { readonly title: string; readonly message: string; readonly code: string };

let active: {
  readonly overlay: HTMLElement;
  readonly projectId: string | null;
  readonly unsubscribe: () => void;
} | null = null;

export function closePersistenceRecovery(): void {
  if (!active) return;
  const session = active;
  active = null;
  session.unsubscribe();
  unregisterModal(session.overlay);
  session.overlay.remove();
}

export function persistenceSurfaceVisible(recovery: ProjectPersistenceRecovery): boolean {
  if (recovery.kind === "blocked") return true;
  return recovery.kind === "ready" && recovery.mirror?.status === "warning";
}

export function persistenceStatusLabel(autoSave: AutoSaveState, recovery: ProjectPersistenceRecovery): string | null {
  if (recovery.kind === "blocked") return blockedStatusLabel(recovery.error.code);
  if (autoSave.kind === "pending" || autoSave.kind === "saving" || autoSave.kind === "error") return null;
  if (recovery.kind === "ready" && recovery.mirror?.status === "warning") return "루트 저장됨 · 미리보기 경고";
  return null;
}

export function persistenceRecoveryCopy(error: RecoveryFault): RecoveryCopy {
  switch (error.code) {
    case "conflict":
      return {
        title: "저장 충돌",
        code: error.code,
        message: "다른 세션이 먼저 저장했습니다.\n로컬 변경은 그대로 둡니다.\n저장본을 다시 불러오거나 복사본을 내보내세요.\n새 토큰으로 덮어쓰지 않습니다.",
      };
    case "migration-required":
      return {
        title: "마이그레이션 필요",
        code: error.code,
        message: "공간 게시 RPC가 없습니다.\n마이그레이션을 적용하세요.\n일반 저장으로 우회하지 않습니다.",
      };
    case "activation-stale":
      return {
        title: "활성화 보류",
        code: error.code,
        message: "로컬 변경을 저장하거나 복사한 뒤, 저장본을 다시 불러오세요.\n자동으로 활성화하지 않습니다.",
      };
    case "activation-required":
    case "already-canonical":
    case "authority-required":
    case "canonical-replacement":
    case "http":
    case "invalid-project":
    case "invalid-response":
    case "sha-unavailable":
    case "target-changed":
    case "unsupported-legacy-version":
      return { title: "저장을 완료하지 못함", code: error.code, message: error.message };
  }
}


function blockedStatusLabel(code: PersistenceFault | ProjectRoutingFault): string {
  switch (code) {
    case "conflict": return "저장 충돌";
    case "migration-required": return "마이그레이션 필요";
    case "activation-stale": return "활성화 보류";
    case "activation-required":
    case "already-canonical":
    case "authority-required":
    case "canonical-replacement":
    case "http":
    case "invalid-project":
    case "invalid-response":
    case "sha-unavailable":
    case "target-changed":
    case "unsupported-legacy-version":
      return "저장 복구 필요";
  }
}

export function exportLocalProjectCopy(): { readonly projectId: string | null } {
  const project = projectWithoutEventDrafts(store.getCurrent());
  const projectId = currentProjectId();
  downloadBlob(createProjectPackage(project), projectPackageFileName(project));
  toast("현재 초고 복사본을 내보냈습니다", "ok");
  return { projectId };
}

export function openPersistenceRecovery(): boolean {
  const recovery = store.getPersistenceRecovery();
  if (recovery.kind !== "blocked") return false;
  if (typeof document === "undefined" || !document.body) return false;
  if (active) return true;
  const copy = persistenceRecoveryCopy(recovery.error);
  const projectId = currentProjectId();
  const opener = document.activeElement;
  const overlay = el("div", { class: "app-modal-overlay", dataset: { testid: "persistence-recovery-modal" } });
  const cancel = actionButton("취소", "persistence-recovery-cancel", false, () => closePersistenceRecovery());
  const exported = actionButton("복사본 내보내기", "persistence-recovery-export", false, () => {
    exportLocalProjectCopy();
  });
  const reload = actionButton("저장본 다시 불러오기", "persistence-recovery-reload", true, () => {
    void reloadExplicitly();
  });
  const actions = [cancel, exported, reload];
  const card = el("div", {
    class: "app-modal-card",
    attrs: { role: "alertdialog", "aria-modal": "true", "aria-labelledby": "persistence-recovery-title", "aria-describedby": "persistence-recovery-message" },
    children: [
      el("div", { class: "app-modal-title", text: copy.title, attrs: { id: "persistence-recovery-title" }, dataset: { testid: "persistence-recovery-title" } }),
      el("div", { class: "app-modal-message", text: copy.message, attrs: { id: "persistence-recovery-message" }, dataset: { testid: "persistence-recovery-message" } }),
      el("div", { class: "visually-hidden", text: copy.code, dataset: { testid: "persistence-recovery-code" } }),
      el("div", { class: "app-modal-actions", children: actions }),
    ],
  });
  overlay.append(card);
  card.addEventListener("click", (event) => event.stopPropagation());
  overlay.addEventListener("click", () => closePersistenceRecovery());
  document.body.append(overlay);
  registerModal(overlay, () => closePersistenceRecovery());
  const unsubscribe = store.subscribe((_project, change) => {
    if (change.projectSwitch === true || currentProjectId() !== projectId) closePersistenceRecovery();
  });
  active = { overlay, projectId, unsubscribe };
  cancel.focus();
  if (opener instanceof HTMLElement) overlay.dataset.opener = "1";
  return true;
}

async function reloadExplicitly(): Promise<void> {
  const expectedProjectId = active?.projectId ?? null;
  closePersistenceRecovery();
  const { reloadProjectFromDbNow } = await import("@/editor/saveActions");
  await reloadProjectFromDbNow({ force: true, expectedProjectId });
}

function currentProjectId(): string | null {
  const status = store.getDbPersistenceStatus();
  if (status.kind === "ready" || status.kind === "not-configured") return status.projectId;
  return null;
}

function actionButton(label: string, testid: string, danger: boolean, onClick: () => void): HTMLButtonElement {
  return el("button", {
    class: `app-modal-button${danger ? " is-danger is-confirm" : ""}`,
    text: label,
    attrs: { type: "button" },
    dataset: { testid },
    on: { click: onClick },
  });
}
