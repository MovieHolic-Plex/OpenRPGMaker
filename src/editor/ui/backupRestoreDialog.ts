import type { ProjectBackupEntry } from "@/project/persistence/backupTypes";
import { el } from "@/util/dom";
import { isTopModal, registerModal, unregisterModal } from "./modalStack";

/** Selection stays local. The caller validates and restores the selected snapshot. */
export function showBackupRestoreDialog(backups: readonly ProjectBackupEntry[], options: { readonly opener?: HTMLElement | null } = {}): Promise<string | null> {
  return new Promise((resolve) => {
    const opener = options.opener ?? document.activeElement;
    const overlay = el("div", { class: "app-modal-overlay", dataset: { testid: "backup-restore-dialog" } });
    const done = (id: string | null): void => {
      unregisterModal(overlay);
      overlay.remove();
      resolve(id);
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus();
    };
    const select = el("select", {
      class: "app-modal-input",
      attrs: { "aria-label": "복구할 백업", size: "1" },
      dataset: { testid: "backup-restore-select" },
      children: backups.map((backup) => el("option", {
        attrs: { value: backup.id },
        text: `${new Date(backup.createdAt).toLocaleString("ko-KR")} · ${backup.title} · 저장 ${backup.revision} · 소재 ${backup.assetCount}개`,
      })),
    });
    const cancel = el("button", {
      class: "app-modal-button", text: "취소", attrs: { type: "button" },
      dataset: { testid: "backup-restore-cancel" }, on: { click: () => done(null) },
    });
    const confirm = el("button", {
      class: "app-modal-button is-confirm", text: "사본 복구하고 열기", attrs: { type: "button" },
      dataset: { testid: "backup-restore-confirm" }, on: { click: () => done(select.value || null) },
    });
    confirm.disabled = backups.length === 0;
    const card = el("div", {
      class: "app-modal-card",
      attrs: { role: "dialog", "aria-modal": "true", "aria-label": "백업에서 복구" },
      children: [
        el("div", { class: "app-modal-title", text: "백업에서 복구" }),
        el("div", { class: "app-modal-message", text: "선택한 백업을 검사해 새 프로젝트 폴더로 복구합니다. 현재 프로젝트와 백업은 보존됩니다. 저장되지 않은 변경이 있으면 사본을 열기 전에 저장합니다." }),
        select,
        el("div", { class: "app-modal-actions", children: [cancel, confirm] }),
      ],
    });
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Tab" || !isTopModal(overlay)) return;
      if (event.shiftKey && document.activeElement === select) { event.preventDefault(); confirm.focus(); }
      else if (!event.shiftKey && document.activeElement === confirm) { event.preventDefault(); select.focus(); }
    });
    overlay.addEventListener("click", (event) => { if (event.target === overlay) done(null); });
    overlay.append(card);
    document.body.append(overlay);
    registerModal(overlay, () => done(null));
    select.focus();
  });
}
