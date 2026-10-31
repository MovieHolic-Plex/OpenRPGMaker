// 자료집 「이야기 → 괴물 도감」 — 일반 RPG 괴물 도감(system.bestiary)의 항목·칸을 한 화면에서 고친다(2026-10-31).
//
// 항목 = 괴물 이름 + 묶이는 적 레코드 + 칸(외형·습성·약점·처치 기록). 칸마다 여는 방법(처음 만남·처음 처치·약점 발견·조건)을 고른다.
// 조건 칸은 이벤트 편집기와 같은 conditionForm 을 쓴다. 조수 도구 define_bestiary_entry / list_bestiary 와 같은 필드다.
// 규칙(정규화·잠김 판정)은 project/bestiary.ts.
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { selectField, textField, toggleSwitch, field } from "@/editor/panels/databaseControls";
import { sectionCard } from "@/editor/panels/databaseWorkspace";
import { conditionForm } from "@/editor/panels/eventEditor/conditionForm";
import {
  BESTIARY_SECTION_LIMIT,
  BESTIARY_UNLOCKS,
  BESTIARY_UNLOCK_LABELS,
  normalizeBestiary,
  type BestiaryConfig,
  type BestiaryEntry,
  type BestiarySection,
} from "@/project/bestiary";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { el } from "@/util/dom";

function writeBestiary(mutate: (config: BestiaryConfig) => BestiaryConfig): void {
  recordProjectSnapshot();
  store.update((draft) => {
    const current = normalizeBestiary(draft.system.bestiary) ?? { enabled: true, entries: [] };
    const next = normalizeBestiary(mutate(current));
    if (next && (next.enabled || next.entries.length)) draft.system.bestiary = next;
    else delete draft.system.bestiary;
  }, { scope: "system", label: "괴물 도감 편집" });
}

function patchEntry(entryId: string, patch: (entry: BestiaryEntry) => BestiaryEntry): void {
  writeBestiary((config) => ({ ...config, entries: config.entries.map((entry) => (entry.id === entryId ? patch(entry) : entry)) }));
}

function patchSection(entryId: string, sectionId: string, patch: Partial<BestiarySection>): void {
  patchEntry(entryId, (entry) => ({ ...entry, sections: entry.sections.map((section) => (section.id === sectionId ? { ...section, ...patch } : section)) }));
}

function nextId(prefix: string, taken: readonly string[]): string {
  let n = taken.length + 1;
  while (taken.includes(`${prefix}${n}`)) n += 1;
  return `${prefix}${n}`;
}

function sectionCardFor(entry: BestiaryEntry, section: BestiarySection, rerender: () => void): HTMLElement {
  const unlock = section.unlock ?? "seen";
  const text = el("textarea", {
    value: section.text,
    attrs: { rows: "3", maxlength: "400", placeholder: "열렸을 때 보이는 글" },
    dataset: { testid: `db-bestiary-section-text-${entry.id}-${section.id}` },
  }) as HTMLTextAreaElement;
  text.addEventListener("change", () => patchSection(entry.id, section.id, { text: text.value }));
  const remove = el("button", { class: "db-bestiary-remove", text: "칸 빼기", attrs: { type: "button" }, dataset: { testid: `db-bestiary-section-remove-${entry.id}-${section.id}` } });
  remove.addEventListener("click", () => {
    patchEntry(entry.id, (current) => ({ ...current, sections: current.sections.filter((row) => row.id !== section.id) }));
    rerender();
  });
  const children: HTMLElement[] = [
    textField("칸 제목", `db-bestiary-section-title-${entry.id}-${section.id}`, section.title, (value) => patchSection(entry.id, section.id, { title: value })),
    selectField("열리는 때", `db-bestiary-section-unlock-${entry.id}-${section.id}`, unlock,
      BESTIARY_UNLOCKS.map((id) => ({ id, name: BESTIARY_UNLOCK_LABELS[id] })), (value) => {
        const next = value as BestiarySection["unlock"];
        patchSection(entry.id, section.id, next === "condition"
          ? { unlock: next, unlockWhen: section.unlockWhen ?? { kind: "switch", switchId: "", value: true } }
          : { unlock: next, unlockWhen: undefined });
        rerender();
      }),
    field("글", text),
  ];
  if (unlock === "condition") {
    children.push(el("div", {
      class: "db-bestiary-condition",
      dataset: { testid: `db-bestiary-section-condition-${entry.id}-${section.id}` },
      children: [conditionForm(section.unlockWhen ?? { kind: "switch", switchId: "", value: true }, (condition) => patchSection(entry.id, section.id, { unlockWhen: condition }))],
    }));
  }
  if (unlock === "weakness") children.push(el("p", { class: "db-bestiary-note", text: "전투에서 이 괴물의 약점·저항을 처음 맞히면 열리고, 알아낸 약점이 글 아래에 자동으로 붙습니다." }));
  children.push(remove);
  return el("div", { class: "db-bestiary-section", dataset: { testid: `db-bestiary-section-${entry.id}-${section.id}` }, children });
}

function entryCard(project: Project, entry: BestiaryEntry, rerender: () => void): HTMLElement {
  const enemies = project.database.enemies;
  const enemyChips = el("div", {
    class: "db-bestiary-enemies",
    children: enemies.map((enemy) => {
      const input = el("input", { attrs: { type: "checkbox" }, dataset: { testid: `db-bestiary-enemy-${entry.id}-${enemy.id}` } }) as HTMLInputElement;
      input.checked = entry.enemyIds.includes(enemy.id);
      input.addEventListener("change", () => {
        patchEntry(entry.id, (current) => ({
          ...current,
          enemyIds: input.checked ? [...current.enemyIds, enemy.id] : current.enemyIds.filter((id) => id !== enemy.id),
        }));
      });
      return el("label", { class: "db-bestiary-enemy", children: [input, el("span", { text: enemy.name || enemy.id })] });
    }),
  });
  const addSection = el("button", { class: "db-bestiary-add-section", text: "칸 더하기", attrs: { type: "button" }, dataset: { testid: `db-bestiary-add-section-${entry.id}` } });
  addSection.disabled = entry.sections.length >= BESTIARY_SECTION_LIMIT;
  addSection.addEventListener("click", () => {
    patchEntry(entry.id, (current) => {
      const id = nextId("section_", current.sections.map((section) => section.id));
      return { ...current, sections: [...current.sections, { id, title: "새 칸", text: "" }] };
    });
    rerender();
  });
  const removeEntry = el("button", { class: "db-bestiary-remove", text: "항목 지우기", attrs: { type: "button" }, dataset: { testid: `db-bestiary-remove-${entry.id}` } });
  removeEntry.addEventListener("click", () => {
    writeBestiary((config) => ({ ...config, entries: config.entries.filter((row) => row.id !== entry.id) }));
    rerender();
  });
  return sectionCard({
    title: entry.name,
    hint: entry.id,
    testid: `db-bestiary-entry-${entry.id}`,
    children: [
      textField("괴물 이름", `db-bestiary-name-${entry.id}`, entry.name, (value) => patchEntry(entry.id, (current) => ({ ...current, name: value }))),
      field("묶이는 적", enemyChips),
      ...entry.sections.map((section) => sectionCardFor(entry, section, rerender)),
      el("div", { class: "db-bestiary-row-actions", children: [addSection, removeEntry] }),
    ],
  });
}

export function renderBestiaryTab(host: HTMLElement, rerender: () => void): void {
  const project = store.getCurrent();
  const config = normalizeBestiary(project.system.bestiary);
  const entries = config?.entries ?? [];
  const add = el("button", { class: "db-bestiary-add", text: "새 괴물", attrs: { type: "button" }, dataset: { testid: "db-bestiary-add" } });
  add.addEventListener("click", () => {
    writeBestiary((current) => {
      const id = nextId("bst_", current.entries.map((entry) => entry.id));
      const enemyId = project.database.enemies.find((enemy) => !current.entries.some((entry) => entry.enemyIds.includes(enemy.id)))?.id;
      return {
        ...current,
        enabled: true,
        entries: [...current.entries, { id, name: "새 괴물", enemyIds: enemyId ? [enemyId] : [], sections: [
          { id: "look", title: "외형", text: "" },
          { id: "weakness", title: "약점", text: "", unlock: "weakness" },
        ] }],
      };
    });
    rerender();
  });
  const header = el("div", {
    class: "db-bestiary-head",
    children: [
      el("p", {
        class: "db-bestiary-intro",
        text: "플레이어가 ESC 메뉴 「도감」에서 읽는 괴물 기록입니다. 칸마다 여는 방법을 고르세요 — 처음 만나면 · 처음 쓰러뜨리면 · 약점을 알아내면 · 조건(단서 스위치 등)이 참이면. "
          + "잠긴 칸은 「???」로 보이고, 새 칸이 열리면 화면 구석에 「도감에 적었다」 한 줄이 뜹니다.",
      }),
      add,
    ],
  });
  const settings = el("div", {
    class: "db-bestiary-settings",
    children: [
      toggleSwitch("도감 켜기", "db-bestiary-enabled", config?.enabled === true, (checked) => {
        writeBestiary((current) => ({ ...current, enabled: checked }));
        rerender();
      }),
      textField("메뉴 이름(12자)", "db-bestiary-title", config?.title ?? "", (value) => writeBestiary((current) => ({ ...current, title: value.trim().slice(0, 12) || undefined }))),
    ],
  });
  host.append(el("div", {
    class: "db-bestiary-view",
    dataset: { testid: "db-bestiary-view", count: String(entries.length) },
    children: [
      header,
      settings,
      ...(entries.length
        ? entries.map((entry) => entryCard(project, entry, rerender))
        : [el("p", { class: "db-ws-empty", text: "아직 괴물이 없습니다. 「새 괴물」로 첫 항목을 만드세요.", dataset: { testid: "db-bestiary-empty" } })]),
    ],
  }));
}

export function bestiaryEntryCount(project: Project): number {
  return project.system.bestiary?.entries.length ?? 0;
}
