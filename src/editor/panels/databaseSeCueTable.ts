// 자료집 → 시스템 → 「효과음 자리」 표. 자리마다 효과음 하나를 고른다(project.system.seCues, `@/project/seCues`).
// 비운 자리는 내장 기본 소리 그대로다. 저장된 모르는 자리(새 스토어 팩 자리)도 맨 아래에 보여 비울 수 있게 한다.
import type { resourcePickerControl } from "@/editor/panels/databaseResourcePickerDialog";
import { SE_CUE_SPECS, isKnownSeCue, type SeCueGroup } from "@/project/seCues";
import type { Project } from "@/project/types";
import { el } from "@/util/dom";

const GROUP_LABEL: Readonly<Record<SeCueGroup, string>> = { ui: "메뉴·화면", battle: "전투", magic: "마법·상태", field: "필드·문" };

type UpdateSystem = (mutator: (draft: Project) => void, snapshotKey?: string) => void;
type Picker = typeof resourcePickerControl;

function setCue(draft: Project, cue: string, resourceId: string | undefined): void {
  const next = { ...(draft.system.seCues ?? {}) };
  const id = resourceId?.trim();
  if (id) next[cue] = id;
  else delete next[cue];
  if (Object.keys(next).length) draft.system.seCues = next;
  else delete draft.system.seCues;
}

export function seCueTableSection(project: Project, updateSystem: UpdateSystem, rerender: () => void, resourcePicker: Picker): HTMLElement {
  const table = project.system.seCues ?? {};
  const picker = (cue: string, label: string): HTMLElement => resourcePicker({
    label,
    resourceId: table[cue],
    kind: "sound",
    testid: `db-field-system-se-cue-${cue}`,
    allowClear: true,
    dialogTitle: `효과음 자리 — ${label}`,
    onChange: (result) => updateSystem((draft) => setCue(draft, cue, result.resourceId), `system:se-cue:${cue}`),
    rerender,
  });
  const groups = (Object.keys(GROUP_LABEL) as SeCueGroup[]).map((group) => el("fieldset", {
    class: "oprn-db-fieldset",
    dataset: { testid: `db-se-cue-group-${group}` },
    children: [
      el("legend", { text: `효과음 자리 · ${GROUP_LABEL[group]}` }),
      ...SE_CUE_SPECS.filter((spec) => spec.group === group).map((spec) => picker(spec.id, spec.label)),
    ],
  }));
  const unknown = Object.keys(table).filter((cue) => !isKnownSeCue(cue));
  if (unknown.length) {
    groups.push(el("fieldset", {
      class: "oprn-db-fieldset",
      dataset: { testid: "db-se-cue-group-other" },
      children: [el("legend", { text: "효과음 자리 · 그 밖의 자리" }), ...unknown.map((cue) => picker(cue, cue))],
    }));
  }
  return el("div", {
    dataset: { testid: "db-se-cue-table" },
    children: [
      el("p", { class: "db-system-font-help", text: "비운 자리는 기본 소리를 냅니다. 마법 자리가 비면 「주문 시전」, 아군 피해가 비면 「적 피해」, 보스 쓰러짐이 비면 「적 쓰러짐」 소리로 물러섭니다. 지형에 발소리를 따로 고른 칸은 그 소리가 먼저입니다." }),
      ...groups,
    ],
  });
}
