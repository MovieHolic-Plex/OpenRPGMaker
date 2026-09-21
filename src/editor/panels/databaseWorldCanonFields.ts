import { recordCoalescedSnapshot, recordProjectSnapshot } from "@/editor/mapEditHistory";
import { field, segmentedControl, textControl } from "@/editor/panels/databaseControls";
import { renderMarkdown } from "@/util/markdown";
import { toast } from "@/util/toast";
import { store } from "@/project/store";
import {
  compactWorldCanon,
  resolveWorldCanon,
  WORLD_CANON_BOUNDS,
  WORLD_CANON_TONES,
  type ResolvedWorldCanon,
  type WorldCanonLawKind,
  type WorldCanonLawState,
  type WorldCanonTone,
} from "@/project/world/canon";
import { el } from "@/util/dom";

export const WORLD_CANON_TONE_LABELS: Record<WorldCanonTone, string> = {
  hopeful: "희망",
  grim: "우울",
  comic: "코믹",
  political: "정치",
  slice: "일상",
  gothic: "고딕",
  fairytale: "동화",
  mythic: "신화",
};

const LAW_LABELS: Record<WorldCanonLawKind, string> = {
  power: "힘",
  gods: "신",
  death: "죽음",
  money: "돈",
};

const LAW_HINTS: Record<WorldCanonLawKind, string> = {
  power: "마법·기·과학 — 누가, 무슨 대가",
  gods: "신·종교가 있는지",
  death: "죽음 다음에 무엇이 있는지",
  money: "무엇이 돈인지",
};

export function writeCanon(patch: Partial<ResolvedWorldCanon> | ((current: ResolvedWorldCanon) => Partial<ResolvedWorldCanon>), coalesceKey?: string): void {
  if (coalesceKey) recordCoalescedSnapshot(coalesceKey, "세계관 편집");
  store.update((draft) => {
    const current = resolveWorldCanon(draft.worldCanon);
    const changes = typeof patch === "function" ? patch(current) : patch;
    const next = compactWorldCanon({
      ...current,
      ...changes,
      laws: changes.laws ?? current.laws,
    });
    if (next === undefined) delete draft.worldCanon;
    else draft.worldCanon = next;
  }, { scope: "project", label: "세계관 편집" });
}

export function toneRow(selected: readonly WorldCanonTone[], rerender: () => void): HTMLElement {
  return field(
    "톤",
    el("div", {
      class: "db-world-canon-tones",
      attrs: { role: "group", "aria-label": "톤" },
      dataset: { testid: "db-world-canon-tones" },
      children: WORLD_CANON_TONES.map((tone) => {
        const on = selected.includes(tone);
        return el("button", {
          class: `db-world-canon-chip${on ? " is-on" : ""}`,
          attrs: { type: "button", "aria-pressed": on ? "true" : "false" },
          text: WORLD_CANON_TONE_LABELS[tone],
          dataset: { testid: `db-world-canon-tone-${tone}` },
          on: {
            click: () => {
              const next = on ? selected.filter((entry) => entry !== tone) : [...selected, tone];
              recordProjectSnapshot("세계관 톤");
              writeCanon({ tones: next });
              rerender();
            },
          },
        });
      }),
    }),
  );
}

export function absenceEditor(absences: readonly string[], rerender: () => void): HTMLElement {
  const input = el("input", {
    class: "db-world-canon-absence-input",
    attrs: {
      type: "text",
      placeholder: "예: 현대식 총기, 엘프, 죽은 자의 부활",
      title: "부분일치입니다. 「총」은 「총각」에도 걸립니다 — 더 긴 낱말을 적으세요.",
      "aria-label": "없는 것 추가",
      maxlength: String(WORLD_CANON_BOUNDS.absence),
    },
    dataset: { testid: "db-world-canon-absence-input" },
  });
  const add = (): void => {
    const next = input.value.trim();
    if (!next) return;
    if (absences.includes(next)) {
      toast("이미 있는 항목입니다", "info");
      return;
    }
    if (next.length > WORLD_CANON_BOUNDS.absence) {
      toast(`없는 것은 ${WORLD_CANON_BOUNDS.absence}자까지 적을 수 있습니다`, "error");
      return;
    }
    if (absences.length >= WORLD_CANON_BOUNDS.absenceCount) {
      toast(`없는 것은 ${WORLD_CANON_BOUNDS.absenceCount}개까지 적을 수 있습니다`, "error");
      return;
    }
    recordProjectSnapshot("세계관 없는 것");
    writeCanon({ absences: [...absences, next] });
    rerender();
  };
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.isComposing) return;
    event.preventDefault();
    add();
  });
  return field(
    "없는 것",
    el("div", {
      class: "db-world-canon-absences",
      dataset: { testid: "db-world-canon-absences" },
      children: [
        el("div", {
          class: "db-world-canon-absence-chips",
          children: absences.map((item) =>
            el("button", {
              class: "db-world-canon-chip is-on",
              attrs: { type: "button", title: `${item} 지우기` },
              text: item,
              dataset: { testid: `db-world-canon-absence-${item}` },
              on: {
                click: () => {
                  recordProjectSnapshot("세계관 없는 것");
                  writeCanon({ absences: absences.filter((entry) => entry !== item) });
                  rerender();
                },
              },
            }),
          ),
        }),
        el("div", {
          class: "db-world-canon-absence-add",
          children: [
            input,
            el("button", {
              class: "btn small",
              attrs: { type: "button" },
              text: "추가",
              dataset: { testid: "db-world-canon-absence-add" },
              on: { click: add },
            }),
          ],
        }),
        el("p", {
          class: "db-ws-card-hint",
          text: "부분일치입니다. 「총」은 「총각」에도 걸립니다 — 더 긴 낱말을 적으세요.",
        }),
      ],
    }),
  );
}

export function lawRow(
  kind: WorldCanonLawKind,
  law: WorldCanonLawState,
  rerender: () => void,
): HTMLElement {
  return el("div", {
    class: "db-world-canon-law",
    dataset: { testid: `db-world-canon-law-${kind}` },
    children: [
      segmentedControl(
        LAW_LABELS[kind],
        `db-world-canon-law-${kind}-present`,
        law.present === undefined ? "unset" : law.present ? "yes" : "no",
        [
          { id: "unset", name: "미정" },
          { id: "no", name: "없음" },
          { id: "yes", name: "있음" },
        ],
        (value) => {
          recordProjectSnapshot("세계관 법칙");
          writeCanon((current) => ({ laws: { ...current.laws, [kind]: { ...current.laws[kind], present: value === "unset" ? undefined : value === "yes" } } }));
          rerender();
        },
      ),
      boundedCanonText(
        LAW_HINTS[kind],
        law.note,
        (note) => writeCanon((current) => ({ laws: { ...current.laws, [kind]: { ...current.laws[kind], note } } }), `db-world-canon-law-${kind}-note`),
        `db-world-canon-law-${kind}-note`,
        WORLD_CANON_BOUNDS.lawNote,
      ),
    ],
  });
}

// 미리보기가 펼쳐져 있는지를 탭 리렌더 너머로 유지한다 — 본문 타이핑이 남긴 보류 갱신이
// grace 창 뒤에 탭을 다시 그려 펼쳐진 미리보기를 닫아버리는 경쟁을 막는다.
let canonPreviewOpen = false;

export function bodyField(body: string, onBodyInput?: () => void): HTMLElement {
  const wrap = el("div", { class: "db-world-canon-body-wrap" });
  const area = el("textarea", {
    class: "db-world-canon-body",
    attrs: {
      rows: "14",
      maxlength: String(WORLD_CANON_BOUNDS.body),
      title: `본문은 ${WORLD_CANON_BOUNDS.body.toLocaleString()}자까지 적을 수 있습니다`,
      placeholder: "이 세계의 이야기를 자유롭게 적으세요. 역사, 땅, 문화, 숨겨 둔 것.",
      "aria-label": "이 세계 본문",
    },
    value: body,
    dataset: { testid: "db-world-canon-body" },
  });
  area.addEventListener("input", () => {
    writeCanon({ body: area.value }, "db-world-canon-body");
    onBodyInput?.();
  });
  const preview = el("button", {
    class: "btn small db-world-canon-preview-toggle",
    attrs: { type: "button", "aria-expanded": "false" },
    text: "미리보기",
    dataset: { testid: "db-world-canon-preview-toggle" },
  });
  const pane = el("section", {
    class: "world-markdown db-world-canon-preview",
    ...(!canonPreviewOpen ? { attrs: { hidden: "" } } : {}),
    dataset: { testid: "db-world-canon-preview" },
  });
  const showPreview = (): void => {
    while (pane.firstChild) pane.firstChild.remove();
    // 스토어에 남은 본문이 아니라 지금 눈앞의 textarea 값을 렌더한다 — 미리보기를 여는
    // 클릭 자체가 grace 창(400ms) 안의 갱신을 보류시켜 탭이 다시 그려지기 전이기 때문이다.
    pane.append(renderMarkdown(area.value.trim() ? area.value : "*아직 본문이 없습니다.*"));
    pane.removeAttribute("hidden");
    area.setAttribute("hidden", "");
    preview.textContent = "편집으로";
    preview.setAttribute("aria-expanded", "true");
    canonPreviewOpen = true;
  };
  const hidePreview = (): void => {
    pane.setAttribute("hidden", "");
    area.removeAttribute("hidden");
    preview.textContent = "미리보기";
    preview.setAttribute("aria-expanded", "false");
    canonPreviewOpen = false;
  };
  preview.addEventListener("click", () => {
    if (pane.getAttribute("hidden") === null) {
      hidePreview();
      return;
    }
    showPreview();
    // 본문 카드 아래에 열리는 미리보기는 상세 창 스크롤 밖에 있을 수 있다 — 펼치면 그리로 데려간다.
    if (typeof pane.scrollIntoView === "function") pane.scrollIntoView({ block: "nearest" });
  });
  if (canonPreviewOpen) showPreview();
  wrap.append(preview, area, pane);
  return wrap;
}

export function boundedCanonText(label: string, value: string, onInput: (value: string) => void, testid: string, max: number): HTMLElement {
  const control = textControl(label, value, onInput, testid);
  const input = control.querySelector("input");
  input?.setAttribute("maxlength", String(max));
  input?.setAttribute("title", `${label}: ${max}자까지`);
  return control;
}

// ---------------------------------------------------------------------------
// 법칙 질문 카드 (2026-09-22 스프레드 뷰)
//
// tri-state 세그먼트(미정/없음/있음)는 데이터 모델이 UI 로 샌 형태다. 카드는
// "질문 + 지금 답"을 보여 주고, 클릭하면 팝오버에서 대화형 선택지를 고른다.
// present 의 세 값(undefined/false/true)의 의미와 store 계약은 lawRow() 와 같다 —
// 라벨과 배치만 다르다. testid(db-world-canon-law-*, -note)는 lawRow 과 동일하게 유지해
// 기존 계약(worldAuthoringRegression 등)을 그대로 통과한다.
// ---------------------------------------------------------------------------

const LAW_CARD_ICONS: Record<WorldCanonLawKind, string> = {
  power: "✦",
  gods: "☾",
  death: "❋",
  money: "◎",
};

function lawStateLabel(law: WorldCanonLawState): string {
  if (law.present === undefined) return "미정 — 조수가 상상합니다";
  if (law.present) return law.note.trim() ? "있음 — 규칙을 조수에 전달" : "있음";
  return "없음 — 조수도 없다고 답함";
}

export function lawCard(
  kind: WorldCanonLawKind,
  law: WorldCanonLawState,
  rerender: () => void,
): HTMLElement {
  const card = el("button", {
    class: "db-world-canon-law-card" + (law.present === undefined ? " is-unset" : ""),
    attrs: { type: "button", "aria-haspopup": "dialog" },
    dataset: { testid: "db-world-canon-law-" + kind },
  });
  card.append(
    el("span", {
      class: "db-world-canon-law-q",
      children: [
        el("span", { class: "db-world-canon-law-icon", attrs: { "aria-hidden": "true" }, text: LAW_CARD_ICONS[kind] }),
        el("span", { text: LAW_LABELS[kind] }),
        el("span", { class: "db-world-canon-law-arrow", attrs: { "aria-hidden": "true" }, text: "편집 ›" }),
      ],
    }),
    el("span", {
      class: "db-world-canon-law-state" + (law.present === undefined ? " is-unset" : law.present ? " is-yes" : " is-no"),
      text: lawStateLabel(law),
    }),
    ...(law.note.trim() ? [el("span", { class: "db-world-canon-law-note", text: law.note })] : []),
  );
  card.addEventListener("click", () => {
    openLawDialog(kind, law, rerender);
  });
  return card;
}

function openLawDialog(
  kind: WorldCanonLawKind,
  law: WorldCanonLawState,
  rerender: () => void,
): void {
  const backdrop = el("div", { class: "db-world-canon-law-dialog-backdrop", dataset: { testid: "db-world-canon-law-dialog" } });
  const dialog = el("div", {
    class: "db-world-canon-law-dialog",
    attrs: { role: "dialog", "aria-modal": "true", "aria-label": LAW_LABELS[kind] + " 법칙" },
  });
  const state: { present: boolean | undefined } = { present: law.present };

  const optionButton = (value: "unset" | "no" | "yes", title: string, desc: string): HTMLElement => {
    const selected = (value === "unset" && state.present === undefined)
      || (value === "no" && state.present === false)
      || (value === "yes" && state.present === true);
    const button = el("button", {
      class: "db-world-canon-law-option" + (selected ? " is-selected" : ""),
      attrs: { type: "button" },
      dataset: { testid: "db-world-canon-law-" + kind + "-option-" + value },
      children: [
        el("span", { class: "db-world-canon-law-option-title", text: title }),
        el("span", { class: "db-world-canon-law-option-desc", text: desc }),
      ],
    });
    button.addEventListener("click", () => {
      state.present = value === "unset" ? undefined : value === "yes";
      dialog.querySelectorAll(".db-world-canon-law-option").forEach((node) => node.classList.remove("is-selected"));
      button.classList.add("is-selected");
    });
    return button;
  };

  const note = el("textarea", {
    class: "db-world-canon-law-note-input",
    attrs: {
      rows: "2",
      maxlength: String(WORLD_CANON_BOUNDS.lawNote),
      placeholder: "비고 — 예: 신은 죽었고, 그 시신이 섬이다",
      "aria-label": LAW_LABELS[kind] + " 비고",
    },
    value: law.note,
    dataset: { testid: "db-world-canon-law-" + kind + "-note" },
  });

  const close = (): void => { backdrop.remove(); };
  const save = el("button", {
    class: "btn small db-world-canon-law-save",
    attrs: { type: "button" },
    text: "카드에 반영",
    dataset: { testid: "db-world-canon-law-" + kind + "-save" },
  });
  save.addEventListener("click", () => {
    recordProjectSnapshot("세계관 법칙");
    writeCanon((current) => ({ laws: { ...current.laws, [kind]: { present: state.present, note: note.value.trim() } } }));
    close();
    rerender();
  });
  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    close();
  });
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) close();
  });

  dialog.append(
    el("h5", { class: "db-world-canon-law-dialog-title", text: LAW_LABELS[kind] + " — " + LAW_HINTS[kind] }),
    el("div", {
      class: "db-world-canon-law-options",
      children: [
        optionButton("unset", "아직 모르겠어요", "비워 둡니다. 조수가 이 주제를 자유롭게 상상할 수 있습니다."),
        optionButton("no", "이 세계에는 없어요", "조수에게 명시적으로 전달됩니다 — 이 주제로 답하지 않습니다."),
        optionButton("yes", "있어요 — 규칙을 정할게요", "아래 비고에 규칙을 적으면 조수가 그 규칙을 따릅니다."),
      ],
    }),
    note,
    el("p", {
      class: "db-world-canon-law-tip",
      children: [
        el("strong", { text: "미정 주의: " }),
        document.createTextNode("정하지 않은 질문은 조수가 가장 먼저 상상해 대본에 스며듭니다. 의도한 게 아니면 「없음」이라도 골라 두세요."),
      ],
    }),
    save,
  );
  backdrop.append(dialog);
  // 대화상자는 DB 모달 안에 붙인다 — document.body 에 붙이면 --db-studio-* 토큰 스코프
  // 밖으로 나가 배경·글자색이 무효값으로 떨어지고, 대비가 무너진 회색 덩어리로 보였다(2026-09-22 실측).
  const modalRoot = document.querySelector(".database-modal-backdrop") ?? document.body;
  modalRoot.append(backdrop);
  save.focus();
}

