import { recordCoalescedSnapshot, recordProjectSnapshot } from "@/editor/mapEditHistory";
import { field, segmentedControl, textControl } from "@/editor/panels/databaseControls";
import { store } from "@/project/store";
import {
  compactWorldCanon,
  resolveWorldCanon,
  WORLD_CANON_TONES,
  type ResolvedWorldCanon,
  type ResolvedWorldCanonLaws,
  type WorldCanonLawKind,
  type WorldCanonLawState,
  type WorldCanonTone,
} from "@/project/world/canon";
import { el } from "@/util/dom";

const TONE_LABELS: Record<WorldCanonTone, string> = {
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

export function writeCanon(patch: Partial<ResolvedWorldCanon>, coalesceKey?: string): void {
  if (coalesceKey) recordCoalescedSnapshot(coalesceKey, "세계관 편집");
  store.update((draft) => {
    const current = resolveWorldCanon(draft.worldCanon);
    const next = compactWorldCanon({
      ...current,
      ...patch,
      laws: patch.laws ?? current.laws,
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
          text: TONE_LABELS[tone],
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
    attrs: { type: "text", placeholder: "예: 총, 엘프, 부활", "aria-label": "없는 것 추가" },
    dataset: { testid: "db-world-canon-absence-input" },
  });
  const add = (): void => {
    const next = input.value.trim();
    if (!next || absences.includes(next)) return;
    recordProjectSnapshot("세계관 없는 것");
    writeCanon({ absences: [...absences, next] });
    rerender();
  };
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
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
      ],
    }),
  );
}

export function lawRow(
  kind: WorldCanonLawKind,
  law: WorldCanonLawState,
  laws: ResolvedWorldCanonLaws,
  rerender: () => void,
): HTMLElement {
  return el("div", {
    class: "db-world-canon-law",
    dataset: { testid: `db-world-canon-law-${kind}` },
    children: [
      segmentedControl(
        LAW_LABELS[kind],
        `db-world-canon-law-${kind}-present`,
        law.present ? "yes" : "no",
        [
          { id: "no", name: "없음" },
          { id: "yes", name: "있음" },
        ],
        (value) => {
          recordProjectSnapshot("세계관 법칙");
          writeCanon({ laws: { ...laws, [kind]: { ...law, present: value === "yes" } } });
          rerender();
        },
      ),
      textControl(
        LAW_HINTS[kind],
        law.note,
        (note) => writeCanon({ laws: { ...laws, [kind]: { ...law, note } } }, `db-world-canon-law-${kind}-note`),
        `db-world-canon-law-${kind}-note`,
      ),
    ],
  });
}

export function bodyField(body: string): HTMLElement {
  const area = el("textarea", {
    class: "db-world-canon-body",
    attrs: {
      rows: "14",
      placeholder: "설정집을 자유롭게 적으세요. 역사, 땅, 문화, 숨겨 둔 것.",
      "aria-label": "설정집 본문",
    },
    value: body,
    dataset: { testid: "db-world-canon-body" },
  });
  area.addEventListener("input", () => writeCanon({ body: area.value }, "db-world-canon-body"));
  return area;
}
