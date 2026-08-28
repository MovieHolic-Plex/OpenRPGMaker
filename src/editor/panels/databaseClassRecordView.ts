import { ACTOR_RATE_GRADES, stateRatePercentage } from "@/project/actorModel";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { editableClassCommands, finalizeClassBattleCommands, moveEditableClassCommand } from "@/editor/databaseClassCommandOrder";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { charsetFrameSource, EASYRPG_CHARSET_ASSETS } from "@/assets/easyrpgRtp";
import { storyFlagOptionLabel } from "@/project/storyFlags";
import { store } from "@/project/store";
import type { ActorRateGrade, ClassBattleCommand, ClassBattleCommandKind, ClassRecord } from "@/project/types";
import { el } from "@/util/dom";
import { switchDatabaseActiveTab } from "./database";
import { classCurveCards } from "./databaseClassCurveEditors";
import { renderExperienceCurvePanel } from "./databaseClassExperienceCurveEditor";
import { classBuildSummary, type ClassBuildRole } from "./databasePartyBuildSummary";
import { setSelectedRecordId } from "./databaseRecordViewSession";

const COMMAND_KINDS: readonly ClassBattleCommandKind[] = ["attack", "skill", "skillSubset", "defend", "guard", "item", "capture", "escape", "switch", "event"];
const COMMAND_KIND_LABELS: Record<ClassBattleCommandKind, string> = {
  attack: "공격",
  skill: "특수기능",
  skillSubset: "특수계열",
  defend: "방어",
  guard: "방어(구형)",
  item: "아이템",
  capture: "포획",
  escape: "도망",
  switch: "교체",
  event: "교체(구형)",
};
const ELEMENT_RATE_LABELS: readonly { readonly id: string; readonly name: string }[] = [
  { id: "sword", name: "검" },
  { id: "spear", name: "창" },
  { id: "hit", name: "타격" },
  { id: "bow", name: "활" },
  { id: "fire", name: "불" },
  { id: "ice", name: "얼음" },
  { id: "thunder", name: "번개" },
  { id: "water", name: "물" },
  { id: "earth", name: "대지" },
  { id: "wind", name: "바람" },
  { id: "holy", name: "성" },
];

const GRADE_KO: Record<ActorRateGrade, string> = {
  A: "약함",
  B: "약함",
  C: "보통",
  D: "강함",
  E: "무효",
};

const FALLBACK_CLASS_COMMANDS: ClassRecord["battleCommands"] = [
  { id: "cmd_attack", name: "공격", kind: "attack" },
  { id: "cmd_skill", name: "기술", kind: "skill" },
  { id: "cmd_item", name: "아이템", kind: "item" },
  { id: "cmd_defend", name: "방어", kind: "defend" },
  { id: "cmd_escape", name: "도주", kind: "escape" },
];

export function renderClassRecordForm(form: HTMLElement, record: ClassRecord): void {
  const buildSummaryHost = el("section", { class: "db-class-build-summary" });
  const curveGrid = el("div", { class: "db-class-curves-grid" });
  const expPanel = el("div", { class: "db-class-exp-content" });
  const refreshBuildSummary = (): void => renderClassBuildSummary(buildSummaryHost, record);
  const refreshCurves = (): void => {
    curveGrid.replaceChildren(...classCurveCards(record, refreshCurves));
    refreshBuildSummary();
  };
  const refreshExp = (): void =>
    renderExperienceCurvePanel(
      {
        testidPrefix: "db-class-exp",
        dialogLabel: "경험치 곡선 설정",
        readCurve: () => store.getCurrent().database.classes.find((entry) => entry.id === record.id)?.expCurve ?? record.expCurve,
        onCommit: (expCurve) => updateDatabaseRecord("classes", record.id, { expCurve }),
        refresh: refreshExp,
      },
      expPanel
    );
  refreshCurves();
  refreshExp();

  // 예전에는 곡선/명령/스킬/승급 을 `.db-class-section-panel` 래퍼로 감싸고 그 위에
  // 탭 스트립을 얹었는데, 대응 CSS 가 저장소 어디에도 없어(`grep -r db-class-section-panel
  // src/**/*.css` → 0 건) `.active` 토글이 아무 일도 안 했다. 네 섹션이 늘 동시에
  // 보였고, 탭 스트립은 세로 공간만 먹는 거짓 안내였다. 게다가 래퍼가 한 겹 끼면서
  // 03-class-panels.css 의 `> .db-class-panel-*` 자식 결합자가 전부 빗나가, 이름·
  // 애니메이션 등 named area 패널과 래퍼가 같은 칸에서 겹치고 잘렸다(감사 A 축 P0).
  //
  // 거짓 탭을 지우고 11 개 패널을 워크벤치의 **직계 자식**으로 되돌린다. 그러면 CSS
  // 자식 결합자가 다시 맞고, 순서도 databasePanelGridClasses.test.ts 가 고정한
  // 계약과 일치한다.
  form.append(buildSummaryHost, el("div", {
    class: "db-class-bm88-workbench",
    dataset: { testid: "db-classes-bm88-workbench" },
    children: [
      panel("이름", [nameInput(record)], "db-class-panel-name"),
      panel("애니메이션", [spritePreview(record), animationSelect(record)], "db-class-panel-animation"),
      panel("능력치 곡선", [curveGrid], "db-class-panel-curves"),
      panel("경험치 곡선", [expPanel], "db-class-panel-exp"),
      panel("전투 명령", battleCommandControls(record, refreshBuildSummary), "db-class-panel-commands"),
      panel("옵션", optionControls(record), "db-class-panel-options"),
      panel("스킬", [skillTable(record, refreshBuildSummary)], "db-class-panel-skills"),
      panel("승급", promotionControls(record, refreshBuildSummary), "db-class-panel-promotion"),
      panel("상태 유효도", rateRows(record, "state"), "db-class-panel-state"),
      panel("속성 유효도", rateRows(record, "element"), "db-class-panel-element"),
      panel("장비", [equipmentSelect(record, refreshBuildSummary)], "db-class-panel-equipment"),
    ],
  }));
}

const CLASS_ROLE_LABELS: Readonly<Record<ClassBuildRole, string>> = {
  balanced: "균형형",
  striker: "공격형",
  guardian: "수비형",
  caster: "마력형",
  agile: "기동형",
};

function renderClassBuildSummary(host: HTMLElement, record: ClassRecord): void {
  const project = store.getCurrent();
  const summary = classBuildSummary(project, record.id);
  if (!summary) {
    host.replaceChildren();
    return;
  }
  host.dataset.testid = "db-class-build-summary";
  host.dataset.role = summary.role;
  host.dataset.actorCount = String(summary.actorIds.length);
  host.dataset.skillCount = String(summary.skillCount);
  host.dataset.commandCount = String(summary.commandCount);
  host.dataset.equipmentCount = String(summary.equipmentCount);
  host.dataset.promotionCount = String(summary.promotionCount);
  host.replaceChildren(
    el("div", {
      class: "db-class-build-heading",
      children: [
        el("div", {
          children: [
            el("span", { class: "db-class-build-eyebrow", text: "CLASS BLUEPRINT" }),
            el("h3", { text: "역할·빌드 요약" }),
            el("p", { text: "Lv 20 성장 곡선과 연결된 주인공을 기준으로, 런타임에서 이 직업 빌드가 사용할 수 있는 장비까지 요약합니다." }),
          ],
        }),
        el("strong", { class: `db-class-role db-class-role-${summary.role}`, text: CLASS_ROLE_LABELS[summary.role] }),
      ],
    }),
    el("div", {
      class: "db-class-build-metrics",
      children: [
        classBuildMetric("습득 스킬", summary.skillCount),
        classBuildMetric("전투 명령", summary.commandCount),
        classBuildMetric("이 직업 빌드에서 사용 가능한 장비", summary.equipmentCount),
        classBuildMetric("승급 경로", summary.promotionCount),
      ],
    }),
    el("div", {
      class: "db-class-build-actors",
      children: [
        el("span", { text: "이 직업을 사용하는 주인공" }),
        summary.actorIds.length > 0
          ? el("div", {
              class: "db-class-build-actor-links",
              children: summary.actorIds.map((actorId) => {
                const actor = project.database.actors.find((entry) => entry.id === actorId);
                return el("button", {
                  class: "db-class-build-actor-link",
                  text: actor?.name ?? actorId,
                  attrs: { type: "button" },
                  dataset: { testid: `db-class-build-open-actor-${actorId}` },
                  on: {
                    click: (event) => {
                      setSelectedRecordId("actors", actorId);
                      const panelRoot = databasePanelRootFrom(event.currentTarget as HTMLElement | null);
                      if (panelRoot) switchDatabaseActiveTab("actors", panelRoot);
                    },
                  },
                });
              }),
            })
          : el("em", { text: "연결된 주인공 없음" }),
      ],
    }),
  );
}

function classBuildMetric(label: string, value: number): HTMLElement {
  return el("div", {
    class: "db-class-build-metric",
    children: [el("strong", { text: String(value) }), el("span", { text: label })],
  });
}

function databasePanelRootFrom(node: HTMLElement | null): HTMLElement | null {
  if (!node) return null;
  const modalBody = node.closest(".database-modal-body");
  if (modalBody instanceof HTMLElement) return modalBody;
  let current: HTMLElement | null = node;
  while (current) {
    if (current.querySelector(".db-body") && !current.classList.contains("db-body")) return current;
    current = current.parentElement;
  }
  return null;
}

function nameInput(record: ClassRecord): HTMLElement {
  const input = el("input", {
    value: record.name,
    dataset: { testid: "db-field-name" },
    attrs: { maxlength: "12", type: "text" },
  }) as HTMLInputElement;
  input.addEventListener("input", () => updateDatabaseRecord("classes", record.id, { name: input.value }));
  return el("label", { class: "db-field db-class-name-field", children: [el("span", { text: "직업명" }), input] });
}

function spritePreview(record: ClassRecord): HTMLElement {
  const asset = EASYRPG_CHARSET_ASSETS[0];
  const url = resolveAssetResourceUrl(asset.id, { project: store.getCurrent() });
  const source = charsetFrameSource({ characterIndex: 0, direction: "down", pattern: 1 });
  const style = url
    ? [
      `--class-sprite-url:url("${url}")`,
      `--class-sprite-x:-${source.x * 2}px`,
      `--class-sprite-y:-${source.y * 2}px`,
    ].join(";")
    : "";
  return el("div", {
    class: "db-class-sprite-preview",
    attrs: { role: "img", "aria-label": `${record.name} 캐릭터 미리보기`, style },
    children: [el("span")],
  });
}

function animationSelect(record: ClassRecord): HTMLElement {
  return selectFromRecords("전투 애니메이션", "db-picker-class-animation", record.animationId ?? "", store.getCurrent().database.battleAnimations, (animationId) =>
    updateDatabaseRecord("classes", record.id, { animationId: animationId || undefined })
  );
}

function battleCommandControls(record: ClassRecord, onSummaryChanged: () => void): HTMLElement[] {
  const list = el("div", { class: "db-class-command-list", dataset: { testid: "db-class-command-list" } });
  const preview = el("div", { class: "db-class-command-preview", dataset: { testid: "db-class-command-preview" } });
  const addBtn = el("button", {
    class: "db-class-command-add",
    text: "+ 명령 추가",
    attrs: { type: "button", title: "전투 명령 추가 (최대 6개)" },
    dataset: { testid: "db-class-command-add" },
    on: {
      click: () => {
        const current = editableClassCommands(sourceCommands(record));
        if (current.length >= 6) return;
        const next = [...current, { id: newCommandId(), name: "신규 명령", kind: "attack" as const }];
        commitCommands(record, next);
        refresh();
      },
    },
  });

  const refresh = (): void => {
    const withChange = liveCommandsWithChange(record);
    const editable = withChange.filter((command) => command.id !== "cmd_change");
    list.replaceChildren(
      commandHeader(),
      ...editable.map((command, index) => commandRow(record, command, index, refresh, onSummaryChanged)),
      lockedFooter(withChange),
    );
    addBtn.disabled = editable.length >= 6;
    preview.replaceChildren(
      el("span", { class: "db-class-command-preview-label", text: "전투 메뉴 미리보기" }),
      ...withChange.map((command) =>
        el("span", { class: "db-class-command-preview-item", text: command.name || "(이름 없음)" }),
      ),
    );
    onSummaryChanged();
  };

  refresh();
  return [list, preview, addBtn];
}

function commandHeader(): HTMLElement {
  return el("div", {
    class: "db-class-command-header",
    children: [
      el("span", { text: "순서" }),
      el("span", { text: "명령 이름" }),
      el("span", { text: "종류" }),
      el("span", { text: "스킬 그룹" }),
      el("span", { text: "스킬" }),
      el("span", { text: "삭제" }),
    ],
  });
}

function commandRow(
  record: ClassRecord,
  command: ClassBattleCommand,
  index: number,
  onChanged: () => void,
  onSummaryChanged: () => void,
): HTMLElement {
  const name = el("input", {
    value: command.name,
    dataset: index === 0 ? { testid: "db-field-class-command-name" } : undefined,
    attrs: { type: "text", "aria-label": "명령 이름" },
  }) as HTMLInputElement;
  const kind = kindSelect(command.kind, index === 0 ? "db-field-class-command-kind" : undefined);
  const subset = el("input", {
    value: command.skillSubsetName ?? "",
    dataset: index === 0 ? { testid: "db-field-class-command-subset" } : undefined,
    attrs: { type: "text", placeholder: "스킬 그룹", "aria-label": "스킬 그룹" },
  }) as HTMLInputElement;
  const skill = recordSelect(command.skillId ?? "", store.getCurrent().database.skills, index === 0 ? "db-picker-class-command-skill" : undefined);
  applyCommandFieldState(readCommandKind(kind.value), subset, skill);

  const apply = (): void => {
    const next = editableClassCommands(sourceCommands(record)).map((entry, entryIndex) =>
      entryIndex === index
        ? {
          ...command,
          name: name.value,
          kind: readCommandKind(kind.value),
          skillSubsetName: subset.value || undefined,
          skillId: skill.value || undefined,
        }
        : entry,
    );
    commitCommands(record, next);
    onSummaryChanged();
  };
  name.addEventListener("input", apply);
  subset.addEventListener("input", apply);
  skill.addEventListener("change", apply);
  kind.addEventListener("change", () => {
    apply();
    onChanged();
  });

  const up = el("button", {
    class: "db-class-command-move",
    text: "↑",
    attrs: { type: "button", title: "위로", "aria-label": `${index + 1}번 명령 위로` },
    dataset: { testid: `db-class-command-up-${index}` },
    on: { click: () => { commitCommands(record, moveEditableClassCommand(sourceCommands(record), index, -1)); onChanged(); } },
  });
  const down = el("button", {
    class: "db-class-command-move",
    text: "↓",
    attrs: { type: "button", title: "아래로", "aria-label": `${index + 1}번 명령 아래로` },
    dataset: { testid: `db-class-command-down-${index}` },
    on: { click: () => { commitCommands(record, moveEditableClassCommand(sourceCommands(record), index, 1)); onChanged(); } },
  });
  const remove = el("button", {
    class: "db-class-command-remove",
    text: "✕",
    attrs: { type: "button", title: "명령 삭제", "aria-label": `${command.name || `${index + 1}번`} 명령 삭제` },
    dataset: { testid: `db-class-command-remove-${index}` },
    on: {
      click: () => {
        const current = editableClassCommands(sourceCommands(record));
        commitCommands(record, current.filter((_, entryIndex) => entryIndex !== index));
        onChanged();
      },
    },
  });

  return el("div", {
    class: "db-class-command-row",
    children: [up, down, name, kind, subset, skill, remove],
  });
}

function lockedFooter(commands: readonly ClassBattleCommand[]): HTMLElement {
  const change = commands.find((command) => command.id === "cmd_change") ?? { id: "cmd_change", name: "교체", kind: "switch" };
  return el("div", {
    class: "db-class-command-row db-class-command-row-locked",
    dataset: { testid: "db-class-command-row-locked" },
    children: [
      el("span", { class: "db-class-command-lock", text: "🔒", attrs: { "aria-label": "고정 명령" } }),
      el("span", { class: "db-class-command-locked-name", text: change.name }),
      el("span", { class: "db-class-command-locked-tag", text: "고정(교체)" }),
    ],
  });
}

function liveCommands(record: ClassRecord): ClassRecord["battleCommands"] {
  return currentClass(record).battleCommands;
}

function sourceCommands(record: ClassRecord): ClassRecord["battleCommands"] {
  const live = liveCommands(record);
  return live.length > 0 ? live : FALLBACK_CLASS_COMMANDS;
}

function liveCommandsWithChange(record: ClassRecord): ClassBattleCommand[] {
  const editable = editableClassCommands(sourceCommands(record));
  return [...editable, { id: "cmd_change", name: "교체", kind: "switch" as const }];
}

function commitCommands(record: ClassRecord, editable: readonly ClassBattleCommand[]): void {
  updateDatabaseRecord("classes", record.id, { battleCommands: finalizeClassBattleCommands(editable) });
}

function commandFieldVisibility(kind: ClassBattleCommandKind): { readonly subset: boolean; readonly skill: boolean } {
  if (kind === "skill") return { subset: true, skill: true };
  if (kind === "skillSubset") return { subset: true, skill: false };
  return { subset: false, skill: false };
}

function applyCommandFieldState(kind: ClassBattleCommandKind, subset: HTMLInputElement, skill: HTMLSelectElement): void {
  const visibility = commandFieldVisibility(kind);
  subset.disabled = !visibility.subset;
  skill.disabled = !visibility.skill;
  subset.classList.toggle("is-inert", !visibility.subset);
  skill.classList.toggle("is-inert", !visibility.skill);
}

function newCommandId(): string {
  return `cmd_new_${Math.random().toString(36).slice(2, 8)}`;
}

function optionControls(record: ClassRecord): HTMLElement[] {
  return [
    checkboxField(record, "dualWield", "양손 무기", "db-field-class-option-dualWield"),
    checkboxField(record, "fixedEquipment", "장비 고정", "db-field-class-option-fixedEquipment"),
    checkboxField(record, "autoBattle", "자동 전투", "db-field-class-option-autoBattle"),
    checkboxField(record, "mightyGuard", "강력 방어", "db-field-class-option-mightyGuard"),
  ];
}

function skillTable(record: ClassRecord, onSummaryChanged: () => void): HTMLElement {
  const root = el("div", { class: "db-class-skill-table" });
  const refresh = (): void => {
    const live = currentClass(record);
    const catalog = store.getCurrent().database.skills;
    const rows = live.learnedSkills.map((entry, index) => {
      const saveSkill = (levelInput: HTMLInputElement, skillInput: HTMLSelectElement): void => {
        const nextSkill = { level: numericValue(levelInput, 1), skillId: skillInput.value };
        updateDatabaseRecord("classes", record.id, { learnedSkills: replaceSkill(currentClass(record), index, nextSkill) });
        onSummaryChanged();
      };
      const level = el("input", {
        value: entry.level,
        dataset: index === 0 ? { testid: "db-field-class-skill-level" } : { testid: `db-field-class-skill-level-${index}` },
        attrs: { min: "1", max: "99", type: "number", "aria-label": "습득 레벨" },
        on: {
          input: () => saveSkill(level, skill),
          change: () => saveSkill(level, skill),
        },
      }) as HTMLInputElement;
      const skill = recordSelect(entry.skillId, catalog, index === 0 ? "db-picker-class-skill" : `db-picker-class-skill-${index}`);
      skill.addEventListener("input", () => saveSkill(level, skill));
      skill.addEventListener("change", () => saveSkill(level, skill));
      return el("div", {
        class: "db-class-skill-table-row",
        children: [
          level,
          skill,
          el("button", {
            class: "db-class-skill-remove",
            text: "삭제",
            attrs: { type: "button" },
            dataset: { testid: `db-remove-class-skill-${index}` },
            on: {
              click: () => {
                updateDatabaseRecord("classes", record.id, {
                  learnedSkills: currentClass(record).learnedSkills.filter((_, entryIndex) => entryIndex !== index),
                });
                refresh();
              },
            },
          }),
        ],
      });
    });
    root.replaceChildren(
      el("div", { class: "db-class-skill-table-head", children: [el("span", { text: "레벨" }), el("span", { text: "스킬" }), el("span")] }),
      ...rows,
      el("button", {
        class: "db-class-skill-add",
        text: "스킬 추가",
        attrs: { type: "button" },
        dataset: { testid: "db-add-class-skill" },
        on: {
          click: () => {
            const skillId = catalog[0]?.id;
            if (!skillId) return;
            updateDatabaseRecord("classes", record.id, {
              learnedSkills: [...currentClass(record).learnedSkills, { level: 1, skillId }],
            });
            refresh();
          },
        },
      }),
    );
    onSummaryChanged();
  };
  refresh();
  return root;
}

function equipmentSelect(record: ClassRecord, onSummaryChanged: () => void): HTMLElement {
  const rows = store.getCurrent().database.equipment.map((equipment) => {
    const input = el("input", {
      attrs: { type: "checkbox" },
      dataset: { testid: `db-field-class-equipment-${equipment.id}` },
    }) as HTMLInputElement;
    input.checked = record.equipmentPermissions.equipmentIds.includes(equipment.id);
    input.addEventListener("change", () => {
      const permissions = currentClass(record).equipmentPermissions;
      const has = permissions.equipmentIds.includes(equipment.id);
      const equipmentIds = input.checked
        ? (has ? [...permissions.equipmentIds] : [...permissions.equipmentIds, equipment.id])
        : permissions.equipmentIds.filter((id) => id !== equipment.id);
      updateDatabaseRecord("classes", record.id, { equipmentPermissions: { ...permissions, equipmentIds } });
      onSummaryChanged();
    });
    return el("label", { class: "actor-check", children: [input, el("span", { text: equipment.name })] });
  });
  return el("div", {
    class: "db-class-equipment-checklist",
    dataset: { testid: "db-class-equipment-checklist" },
    children: rows,
  });
}

function promotionControls(record: ClassRecord, onSummaryChanged: () => void): HTMLElement[] {
  const promotions = record.promotions?.length ? record.promotions : [{ toClassId: "", requires: {} }];
  const rows = promotions.map((promotion, index) => {
    const project = store.getCurrent();
    const toClass = recordSelect(promotion.toClassId, project.database.classes, index === 0 ? "db-picker-class-promotion-to" : undefined);
    const level = numberInput(promotion.requires.level, "레벨", index === 0 ? "db-field-class-promotion-level" : undefined);
    const switchId = recordSelect(promotion.requires.switchId ?? "", storyFlagRecords("switch"), index === 0 ? "db-picker-class-promotion-switch" : undefined);
    const itemId = recordSelect(promotion.requires.itemId ?? "", project.database.items, index === 0 ? "db-picker-class-promotion-item" : undefined);
    const variableId = recordSelect(promotion.requires.variableId ?? "", storyFlagRecords("variable"), index === 0 ? "db-picker-class-promotion-variable" : undefined);
    const atLeast = numberInput(promotion.requires.atLeast, "이상", index === 0 ? "db-field-class-promotion-at-least" : undefined);
    const remove = el("button", { class: "db-class-set-button", text: "삭제", attrs: { type: "button" } });
    const apply = (): void => {
      savePromotion(record, index, {
        toClassId: toClass.value,
        requires: {
          level: optionalNumber(level),
          switchId: switchId.value || undefined,
          itemId: itemId.value || undefined,
          variableId: variableId.value || undefined,
          atLeast: optionalNumber(atLeast),
        },
      });
      onSummaryChanged();
    };
    for (const input of [toClass, level, switchId, itemId, variableId, atLeast]) {
      input.addEventListener("change", apply);
      input.addEventListener("input", apply);
    }
    remove.addEventListener("click", () => {
      const next = [...(currentClass(record).promotions ?? [])];
      next.splice(index, 1);
      updateDatabaseRecord("classes", record.id, { promotions: next });
      onSummaryChanged();
    });
    return el("div", {
      class: "db-class-command-row",
      children: [toClass, level, switchId, itemId, variableId, atLeast, remove],
    });
  });
  const add = el("button", {
    class: "db-class-set-button",
    text: "승급 추가",
    attrs: { type: "button" },
    dataset: { testid: "db-class-promotion-add" },
    on: {
      click: () => {
        updateDatabaseRecord("classes", record.id, {
          promotions: [...(currentClass(record).promotions ?? []), { toClassId: firstPromotionTarget(record), requires: {} }],
        });
        onSummaryChanged();
      },
    },
  });
  return [add, el("div", { class: "db-class-command-rows", children: rows })];
}

function savePromotion(record: ClassRecord, index: number, promotion: NonNullable<ClassRecord["promotions"]>[number]): void {
  const source = currentClass(record).promotions ?? [];
  const next = [...source];
  if (!promotion.toClassId) next.splice(index, 1);
  else next[index] = promotion;
  updateDatabaseRecord("classes", record.id, { promotions: next });
}

function currentClass(record: ClassRecord): ClassRecord {
  return store.getCurrent().database.classes.find((entry) => entry.id === record.id) ?? record;
}

function firstPromotionTarget(record: ClassRecord): string {
  return store.getCurrent().database.classes.find((entry) => entry.id !== record.id)?.id ?? "";
}

function numberInput(value: number | undefined, title: string, testid?: string): HTMLInputElement {
  return el("input", {
    value: value ?? "",
    dataset: testid ? { testid } : undefined,
    attrs: { type: "number", min: "0", title, placeholder: title },
  }) as HTMLInputElement;
}

function optionalNumber(input: HTMLInputElement): number | undefined {
  return input.value.trim().length > 0 && Number.isFinite(input.valueAsNumber) ? Math.trunc(input.valueAsNumber) : undefined;
}

function rateRows(record: ClassRecord, kind: "state" | "element"): HTMLElement[] {
  const source = kind === "state" ? [{ id: "state_death", name: "전투불능" }, ...store.getCurrent().database.states] : ELEMENT_RATE_LABELS;
  return source.map((entry) => {
    const rates = kind === "state" ? record.stateRates : record.elementRates;
    const value = rates[entry.id] ?? "C";
    const testid = kind === "state" ? `db-picker-class-state-rate-${entry.id}` : `db-picker-class-element-rate-${entry.id}`;
    const select = gradeSelect(value, testid);
    select.addEventListener("change", () => updateRate(record, kind, entry.id, select.value));
    const ko = GRADE_KO[value as ActorRateGrade] ?? value;
    const label = kind === "state" ? `${entry.name} · ${ko} ${stateRatePercentage(value as ActorRateGrade)}%` : `${entry.name} · ${ko}`;
    return el("label", { class: "db-class-rate-row", children: [select, el("span", { text: label })] });
  });
}

function updateRate(record: ClassRecord, kind: "state" | "element", id: string, value: string): void {
  const grade = ACTOR_RATE_GRADES.find((entry) => entry === value);
  if (!grade) return;
  const current = store.getCurrent().database.classes.find((entry) => entry.id === record.id) ?? record;
  if (kind === "state") updateDatabaseRecord("classes", record.id, { stateRates: { ...current.stateRates, [id]: grade } });
  else updateDatabaseRecord("classes", record.id, { elementRates: { ...current.elementRates, [id]: grade } });
}

function checkboxField(record: ClassRecord, key: keyof ClassRecord["options"], label: string, testid: string): HTMLElement {
  const input = el("input", { attrs: { type: "checkbox" }, dataset: { testid } }) as HTMLInputElement;
  input.checked = record.options[key];
  input.addEventListener("change", () => {
    const current = store.getCurrent().database.classes.find((entry) => entry.id === record.id) ?? record;
    updateDatabaseRecord("classes", record.id, { options: { ...current.options, [key]: input.checked } });
  });
  return el("label", { class: "actor-check", children: [input, el("span", { text: label })] });
}

function panel(title: string, children: HTMLElement[], gridClass?: string): HTMLElement {
  return el("fieldset", { class: gridClass ? `db-advanced-panel ${gridClass}` : "db-advanced-panel", children: [el("legend", { text: title }), ...children] });
}

function selectFromRecords(label: string, testid: string, value: string, records: readonly { readonly id: string; readonly name: string }[], onChange: (value: string) => void): HTMLElement {
  const select = recordSelect(value, records, testid);
  select.addEventListener("change", () => onChange(select.value));
  return el("label", { class: "db-field", children: [el("span", { text: label }), select] });
}

function recordSelect(value: string, records: readonly { readonly id: string; readonly name: string }[], testid?: string): HTMLSelectElement {
  const select = el("select", { dataset: testid ? { testid } : undefined }) as HTMLSelectElement;
  select.append(el("option", { text: "(없음)", attrs: { value: "" } }));
  records.forEach((record) => select.append(el("option", { text: record.name, attrs: { value: record.id } })));
  select.value = value;
  return select;
}

function storyFlagRecords(kind: "switch" | "variable"): readonly { readonly id: string; readonly name: string }[] {
  const project = store.getCurrent();
  const records = kind === "switch" ? project.switches : project.variables;
  return records.map((record, index) => ({ id: record.id, name: storyFlagOptionLabel(project, kind, record, index) }));
}

function kindSelect(value: ClassBattleCommandKind, testid?: string): HTMLSelectElement {
  const select = el("select", { dataset: testid ? { testid } : undefined }) as HTMLSelectElement;
  COMMAND_KINDS.forEach((kind) => select.append(el("option", { text: COMMAND_KIND_LABELS[kind], attrs: { value: kind } })));
  select.value = value;
  return select;
}

function gradeSelect(value: ActorRateGrade, testid: string): HTMLSelectElement {
  const select = el("select", { dataset: { testid } }) as HTMLSelectElement;
  ACTOR_RATE_GRADES.forEach((grade) => {
    const ko = GRADE_KO[grade];
    const label = `${ko} · ${stateRatePercentage(grade)}% (${grade})`;
    select.append(el("option", { text: label, attrs: { value: grade } }));
  });
  select.value = value;
  return select;
}

function replaceSkill(record: ClassRecord, index: number, skill: ClassRecord["learnedSkills"][number]): ClassRecord["learnedSkills"] {
  const skills = record.learnedSkills.length > 0 ? record.learnedSkills : [{ level: 1, skillId: "" }];
  return skills.map((entry, entryIndex) => (entryIndex === index ? skill : entry));
}

function readCommandKind(value: string): ClassBattleCommandKind {
  return COMMAND_KINDS.find((kind) => kind === value) ?? "attack";
}

function numericValue(input: HTMLInputElement, fallback: number): number {
  if (Number.isFinite(input.valueAsNumber)) return Math.trunc(input.valueAsNumber);
  const parsed = Number.parseInt(input.value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}
