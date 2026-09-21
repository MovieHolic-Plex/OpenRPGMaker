import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { ACTOR_RATE_GRADES } from "@/project/actorModel";
import { store } from "@/project/store";
import type { ActorRateGrade, EnemyActionCondition, EnemyActionPattern, EnemyRecord } from "@/project/types";
import { el } from "@/util/dom";
import { applyMagentaChromaKey } from "./chromaKey";
import { isTopModal, registerModal, unregisterModal } from "@/editor/ui/modalStack";

export { openActionContextMenu, openActionDialog } from "@/editor/panels/databaseEnemyActionDialog";
export { openGraphicDialog } from "@/editor/panels/databaseEnemyGraphicDialog";

// Always run magenta chroma-key on enemy previews. DB art is authored with #FF00FF key
// (or postprocessed to pure magenta then alpha). Non-keyed assets without magenta are unchanged.
export function enemyGraphicVisual(record: EnemyRecord): HTMLElement {
  const url = resolveAssetResourceUrl(record.monsterResourceId, { project: store.getCurrent() });
  const image = url
    ? el("img", { attrs: { alt: `${record.name} 미리보기`, src: url } })
    : el("span", { class: "db-enemy-empty-graphic", text: "(없음)" });
  if (image instanceof HTMLImageElement) {
    image.style.filter = `hue-rotate(${record.graphicHue}deg)`;
    image.style.opacity = record.transparent ? "0.58" : "1";
    image.classList.toggle("flying", record.flying);
    image.addEventListener("error", () => {
      image.replaceWith(el("span", { class: "db-enemy-empty-graphic", text: "(그래픽 없음)" }));
    }, { once: true });
    applyMagentaChromaKey(image);
  }
  return el("div", { class: "db-enemy-graphic-stage", children: [image] });
}

const RATE_GRADE_LABEL: Record<ActorRateGrade, string> = {
  A: "약함",
  B: "조금 약함",
  C: "보통",
  D: "강함",
  E: "무효",
};

export function rateField(label: string, testid: string, value: ActorRateGrade | undefined, onChange: (value: ActorRateGrade | undefined) => void, labels?: Readonly<Record<ActorRateGrade, string>>): HTMLElement {
  const select = el("select", { dataset: { testid } });
  select.append(el("option", { text: "기본값 사용", attrs: { value: "" } }));
  for (const grade of ACTOR_RATE_GRADES) {
    select.append(el("option", { text: labels?.[grade] ?? RATE_GRADE_LABEL[grade], attrs: { value: grade } }));
  }
  select.value = value ?? "";
  select.addEventListener("change", () => {
    const next = ACTOR_RATE_GRADES.find((grade) => grade === select.value);
    if (next || select.value === "") onChange(next);
  });
  return el("label", { class: "db-enemy-rate-row", children: [el("span", { text: label }), select] });
}

export function checkboxField(label: string, testid: string, checked: boolean, onInput: (value: boolean) => void): HTMLElement {
  const input = el("input", { attrs: { type: "checkbox" }, dataset: { testid } }) as HTMLInputElement;
  input.checked = checked;
  input.addEventListener("change", () => onInput(input.checked));
  return el("label", { class: "actor-check", children: [input, el("span", { text: label })] });
}

export function panel(title: string, children: HTMLElement[], gridClass?: string): HTMLElement {
  return el("fieldset", { class: gridClass ? `db-advanced-panel ${gridClass}` : "db-advanced-panel", children: [el("legend", { text: title }), ...children] });
}

/**
 * 데이터베이스 안에서 뜨는 보조 대화상자(리소스 피커 · AI 생성 · 셀 일괄 편집…)의 공용 껍데기.
 *
 * 접근성 계약 세 가지를 여기서 한 번에 지킨다. 이걸 호출부마다 맡기면 실제로 갈린다 —
 * 실측(2026-09-01): AI 생성은 포커스가 안으로 들어갔지만 리소스 피커는 들어가지 않았고,
 * 둘 다 `role`/`aria-modal` 이 없어 스크린리더에 대화상자로 알려지지 않았다.
 *   1. `role="dialog"` + `aria-modal` + 제목 연결
 *   2. 열 때 포커스를 안으로, 닫을 때 부르기 전 요소로 되돌린다
 *   3. 최상위 창만 Tab 경계를 감싼다. 중첩 피커는 자기 포커스를 소유한다.
 *
 * 버튼 클래스는 `.btn small` 을 그대로 쓴다. `db-ws-btn` 토큰 블록은 전부
 * `.database-modal-body` 하위로 스코프돼 있고 이 대화상자는 `document.body` 에 붙기 때문에,
 * 갈아치우면 스타일이 통째로 사라진다(UA 기본 버튼이 된다). 전역 `.btn.small { flex: 1 }`
 * 인플레이션은 CSS 쪽에서 `.db-enemy-dialog footer` 로 한정해 되돌린다.
 */
export function openDialog(testid: string, title: string, content: HTMLElement[], actions: readonly { readonly label: string; readonly testid: string; readonly action?: () => void }[], opener: HTMLElement | null = document.activeElement instanceof HTMLElement ? document.activeElement : null, onClose?: () => void): () => void {
  const overlay = el("div", { class: "db-enemy-dialog-backdrop", dataset: { testid } });
  const restoreFocus = dialogReturnFocus(opener);
  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    const ownsFocus = document.body.contains(overlay)
      && (overlay.contains(document.activeElement) || document.activeElement === document.body);
    unregisterModal(overlay);
    overlay.remove();
    onClose?.();
    if (ownsFocus) restoreFocus();
  };
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  registerModal(overlay, close);
  const titleId = `${testid}-title`;
  const dialog = el("div", {
    class: "db-enemy-dialog",
    attrs: { role: "dialog", "aria-modal": "true", "aria-labelledby": titleId, tabindex: "-1" },
    children: [
      el("header", { text: title, attrs: { id: titleId } }),
      el("main", { children: content }),
      el("footer", {
        children: actions.map((entry) =>
          el("button", {
            class: "btn small",
            text: entry.label,
            attrs: { type: "button" },
            dataset: { testid: entry.testid },
            on: {
              click: () => {
                if (closed) return;
                entry.action?.();
                close();
              },
            },
          })
        ),
      }),
    ],
  });
  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "Tab" || event.defaultPrevented || !isTopModal(overlay)) return;
    const controls = dialogTabStops(dialog);
    const first = controls[0] ?? dialog;
    const last = controls[controls.length - 1] ?? dialog;
    if (document.activeElement === dialog || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  });
  overlay.append(dialog);
  document.body.append(overlay);
  // 첫 조작 가능한 요소로 포커스를 옮긴다. 없으면 대화상자 자신(tabindex=-1)이 받는다.
  (dialogTabStops(dialog)[0] ?? dialog).focus();
  return close;
}

function dialogTabStops(dialog: HTMLElement): HTMLElement[] {
  return Array.from(dialog.querySelectorAll<HTMLElement>('input, select, textarea, button, a[href], [tabindex], summary')).filter((control) => {
    if (control.tabIndex < 0 || control.getAttribute("tabindex") === "-1" || control.getAttribute("type") === "hidden"
      || ("disabled" in control && control.disabled === true)) return false;
    for (let node: HTMLElement | null = control; node && node !== dialog; node = node.parentElement) {
      if (node.hidden || node.inert || (node.tagName === "FIELDSET" && node.getAttribute("disabled") !== null)) return false;
      // The headless editor DOM has no computed-style API.
      if (typeof getComputedStyle === "function") {
        const style = getComputedStyle(node);
        if (style.display === "none" || style.visibility === "hidden") return false;
      }
    }
    return true;
  });
}

function dialogReturnFocus(opener: HTMLElement | null): () => void {
  const enemyId = opener?.closest<HTMLElement>('[data-testid="db-enemies-bm101-workbench"]')?.dataset.enemyId;
  const testid = opener?.dataset.testid;
  const actionRow = opener?.dataset.actionIndex !== undefined;
  const resolve = (): HTMLElement | null => {
    if (opener && document.body.contains(opener)) return opener;
    if (!enemyId || !testid) return null;
    const workbench = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="db-enemies-bm101-workbench"]'))
      .find((node) => node.dataset.enemyId === enemyId);
    return Array.from(workbench?.querySelectorAll<HTMLElement>('[data-testid]') ?? []).find((node) => node.dataset.testid === testid)
      ?? (actionRow ? workbench?.querySelector<HTMLElement>('[data-testid="db-enemy-action-add"]') ?? null : null);
  };
  return () => {
    let last = resolve();
    if (!last || last.getAttribute("disabled") !== null) return;
    last.focus();
    if (!enemyId || document.activeElement !== last || typeof MutationObserver !== "function") return;
    // Direct and store-driven renders can both replace the opener. Repair only
    // that detachment, until the next user navigation gives up focus ownership.
    const stop = (): void => {
      observer.disconnect();
      document.removeEventListener("keydown", stop, true);
      document.removeEventListener("pointerdown", stop, true);
      document.removeEventListener("focusin", onFocus, true);
    };
    const onFocus = (event: FocusEvent): void => {
      if (event.target !== last) stop();
    };
    const observer = new MutationObserver(() => {
      if (last && document.body.contains(last)) return;
      if (document.activeElement !== document.body) { stop(); return; }
      last = resolve();
      if (!last || last.getAttribute("disabled") !== null) { stop(); return; }
      last.focus();
      if (document.activeElement !== last) stop();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("keydown", stop, true);
    document.addEventListener("pointerdown", stop, true);
    document.addEventListener("focusin", onFocus, true);
  };
}

export function currentEnemy(record: EnemyRecord): EnemyRecord {
  return store.getCurrent().database.enemies.find((entry) => entry.id === record.id) ?? record;
}

export function defaultAction(): EnemyActionPattern {
  return {
    skillId: store.getCurrent().database.skills[0]?.id ?? "skill_attack",
    priority: 50,
    condition: { kind: "always" },
    switchOnAfterAction: { enabled: false },
    switchOffAfterAction: { enabled: false },
  };
}

export function replaceAction(actions: readonly EnemyActionPattern[], index: number, action: EnemyActionPattern): EnemyActionPattern[] {
  const next = actions.length > 0 ? [...actions] : [defaultAction()];
  next[index] = action;
  return next;
}

export function skillName(skillId: string): string {
  return store.getCurrent().database.skills.find((skill) => skill.id === skillId)?.name ?? "일반 공격";
}

export function conditionLabel(condition: EnemyActionCondition): string {
  if (condition.kind === "switch") return `${condition.switchId} ${condition.value ? "ON" : "OFF"}`;
  if (condition.kind === "hp" || condition.kind === "mp") return `${condition.kind.toUpperCase()} ${condition.minPercent}~${condition.maxPercent}%`;
  if (condition.kind === "status") return `${condition.stateId} ${condition.present ? "있음" : "없음"}`;
  if (condition.kind === "allies") return `생존 동료 ${condition.min}~${condition.max}`;
  if (condition.kind === "turn") return `${condition.start}+${condition.interval}턴`;
  return "항상";
}
