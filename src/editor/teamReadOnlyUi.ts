import { canWriteTeamProject } from '@/project/teamAccess';

let observer: MutationObserver | undefined;
/** Keep browsing/navigation available while clearly disabling authored DB fields. */
export function syncTeamReadOnlyUi(): void {
  const readonly = !canWriteTeamProject();
  document.body.classList.toggle('team-readonly', readonly);
  if (!readonly) {
    observer?.disconnect(); observer = undefined;
    for (const field of document.querySelectorAll<HTMLInputElement>('[data-team-disabled]')) {
      field.disabled = false; delete field.dataset.teamDisabled;
    }
    document.querySelectorAll('[data-team-readonly-label]').forEach(label => label.remove());
    return;
  }
  const disable = () => {
    for (const heading of document.querySelectorAll('.database-modal-heading')) {
      if (!heading.querySelector('[data-team-readonly-label]')) {
        const badge = document.createElement('span');
        badge.dataset.teamReadonlyLabel = 'true'; badge.textContent = '보기 전용';
        Object.assign(badge.style, { fontSize: '11px', padding: '3px 8px', borderRadius: '6px', background: '#eee8dd', color: '#726551' });
        heading.append(badge);
      }
    }
    for (const field of document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement>(
      '.db-body input:not([type="search"]), .db-body textarea, .db-body select, [data-testid="db-add-record"], [data-testid="db-duplicate-record"], [data-testid="db-delete-selected"], [data-testid="db-ai-generate-open"], [data-testid="db-install-generated-effects"], [data-testid="database-footer-apply"], [data-testid="database-footer-ok"]')) {
      if (!field.disabled && !field.matches('[placeholder*="검색"], [placeholder*="찾기"], [role="searchbox"]')) {
        field.dataset.teamDisabled = 'true'; field.disabled = true;
      }
    }
  };
  disable();
  if (!observer) {
    observer = new MutationObserver(disable);
    observer.observe(document.body, { childList: true, subtree: true });
  }
}
