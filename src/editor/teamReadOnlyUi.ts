import { canWriteTeamProject } from '@/project/teamAccess';
import { sourceAttributeOf } from "@/i18n/domTranslator";

const HEADING_SELECTOR = '.database-modal-heading';
const FIELD_SELECTOR = '.db-body input:not([type="search"]), .db-body textarea, .db-body select, [data-testid="db-add-record"], [data-testid="db-duplicate-record"], [data-testid="db-delete-selected"], [data-testid="db-ai-generate-open"], [data-testid="db-install-generated-effects"], [data-testid="database-footer-apply"], [data-testid="database-footer-ok"], '
  // 목록 밖 삭제 단추(스위치·작물·종족·주민·농장·생활 수집…)와 자료집 AI 바. 이 경로들은 store.update 가
  // 조용히 거부된 뒤에도 「삭제했습니다」·「적용됐어요」를 띄웠다.
  + '.db-body button[data-testid*="delete"], .db-body button[data-testid*="remove"], .database-ai-input, .database-ai-run';
const ANY_TARGET_SELECTOR = `${HEADING_SELECTOR}, ${FIELD_SELECTOR}`;

let observer: MutationObserver | undefined;

function isSearchField(field: Element): boolean {
  if (field.getAttribute("role") === "searchbox") return true;
  const placeholder = sourceAttributeOf(field, "placeholder") ?? "";
  return placeholder.includes("검색") || placeholder.includes("찾기");
}
let scheduled = false;

function disable(): void {
  // 관찰 대상이 body 전체라 맵 칠하기·토스트 같은 무관한 변이마다 불린다. 자료집 표면이 없으면 한 번의 조회로 끝낸다.
  if (!document.querySelector(ANY_TARGET_SELECTOR)) return;
  for (const heading of document.querySelectorAll(HEADING_SELECTOR)) {
    if (!heading.querySelector('[data-team-readonly-label]')) {
      const badge = document.createElement('span');
      badge.dataset.teamReadonlyLabel = 'true'; badge.textContent = '보기 전용';
      Object.assign(badge.style, { fontSize: '11px', padding: '3px 8px', borderRadius: '6px', background: '#eee8dd', color: '#726551' });
      heading.append(badge);
    }
  }
  for (const field of document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement>(FIELD_SELECTOR)) {
    if (!field.disabled && !isSearchField(field)) {
      field.dataset.teamDisabled = 'true'; field.disabled = true;
    }
  }
}

function scheduleDisable(): void {
  if (scheduled) return;
  scheduled = true;
  const run = (): void => {
    scheduled = false;
    if (observer) disable();
  };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
  else queueMicrotask(run);
}

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
  disable();
  if (!observer) {
    observer = new MutationObserver(scheduleDisable);
    observer.observe(document.body, { childList: true, subtree: true });
  }
}
