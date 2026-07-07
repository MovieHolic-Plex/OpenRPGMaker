import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { emptyToUndefined, numberField, selectField, textField } from "@/editor/panels/databaseControls";
import { renderTroopBattleEventPanel } from "@/editor/panels/databaseTroopBattleEventPanel";
import { openTroopBattleTestModal } from "@/editor/panels/testPlayModal";
import { store } from "@/project/store";
import type { DatabaseTerrainRecord, EnemyRecord, TroopMemberRecord, TroopRecord } from "@/project/types";
import { el } from "@/util/dom";
import { applyMagentaChromaKeyToImageData } from "./chromaKey";

const DEFAULT_MEMBER: TroopMemberRecord = { enemyId: "", x: 160, y: 120, hidden: false };
const selectedMemberIndexes = new Map<string, number>();

export function renderTroopRecordForm(form: HTMLElement, record: TroopRecord, rerender: () => void): void {
  const selectedIndex = selectedMemberIndex(record);
  const member = record.members?.[selectedIndex] ?? record.members?.[0] ?? DEFAULT_MEMBER;
  const project = store.getCurrent();
  const selectedEnemy = project.database.enemies.find((enemy) => enemy.id === member.enemyId) ?? project.database.enemies[0];
  form.append(
    el("div", {
      class: "db-troops-classic-workbench",
      dataset: { testid: "db-troops-classic-workbench" },
      children: [
        topControls(record, rerender),
        troopBattlePreview(record, selectedIndex, rerender),
        memberEditor(record, member, selectedIndex, selectedEnemy, rerender),
        terrainPanel(project.database.terrains ?? [], record.previewBackgroundResourceId),
        renderTroopBattleEventPanel(record, rerender),
      ],
    })
  );
}

function topControls(record: TroopRecord, rerender: () => void): HTMLElement {
  return el("section", {
    class: "db-troop-top-controls",
    children: [
      classicPanel("이름", [textField("이름", "db-field-name", record.name, (name) => updateDatabaseRecord("troops", record.id, { name }))]),
      actionButton("이름 생성", "db-troop-generate-name", () => {
        updateDatabaseRecord("troops", record.id, { name: generatedTroopName(record) });
        rerender();
      }),
      actionButton("전투 테스트", "db-troop-battle-test", () => {
        document.querySelector("[data-testid='database-modal']")?.remove();
        void openTroopBattleTestModal(record.id);
      }),
      actionButton("배경 변경", "db-troop-change-background", () => {
        updateDatabaseRecord("troops", record.id, { previewBackgroundResourceId: nextBattleBackground(record.previewBackgroundResourceId) });
        rerender();
      }),
      configurationPanel(record, rerender),
    ],
  });
}

function memberEditor(
  record: TroopRecord,
  member: TroopMemberRecord,
  selectedIndex: number,
  selectedEnemy: EnemyRecord | undefined,
  rerender: () => void
): HTMLElement {
  return el("section", {
    class: "db-troop-member-editor",
    children: [
      el("div", {
        class: "db-troop-member-buttons",
        children: [
          actionButton("추가", "db-troop-member-add", () => {
            const nextEnemyId = selectedEnemy?.id ?? store.getCurrent().database.enemies[0]?.id ?? "";
            if (!nextEnemyId) return;
            const nextMembers = [...(record.members ?? []), positionedMember(nextEnemyId, record.members?.length ?? 0)];
            selectedMemberIndexes.set(record.id, nextMembers.length - 1);
            updateDatabaseRecord("troops", record.id, { members: nextMembers });
            rerender();
          }),
          actionButton("삭제", "db-troop-member-delete", () => {
            const nextMembers = (record.members ?? []).filter((_, index) => index !== selectedIndex);
            selectedMemberIndexes.set(record.id, Math.max(0, Math.min(selectedIndex, nextMembers.length - 1)));
            updateDatabaseRecord("troops", record.id, { members: nextMembers });
            rerender();
          }),
          actionButton("지우기", "db-troop-member-clear", () => {
            selectedMemberIndexes.set(record.id, 0);
            updateDatabaseRecord("troops", record.id, { members: [] });
            rerender();
          }),
          actionButton("정렬", "db-troop-member-arrange", () => {
            updateDatabaseRecord("troops", record.id, { autoAlign: true, members: arrangeMembers(record.members ?? []) });
            rerender();
          }),
          actionButton("RM2003", "db-troop-member-rm2003-preset", () => {
            const members = rm2003ExampleMembers();
            if (members.length === 0) return;
            selectedMemberIndexes.set(record.id, 0);
            updateDatabaseRecord("troops", record.id, { autoAlign: false, members });
            rerender();
          }),
        ],
      }),
      el("div", {
        class: "db-troop-member-list",
        children: [
          selectField("적", "db-picker-troop-member-enemy", member.enemyId, store.getCurrent().database.enemies, (enemyId) => {
            updateSelectedMember(record, selectedIndex, enemyId ? { ...member, enemyId } : undefined);
            rerender();
          }),
          memberRows(record, selectedIndex, rerender),
          memberPositionPanel(record, member, selectedIndex, rerender),
          enemyList(record, selectedIndex, selectedEnemy?.id ?? member.enemyId, rerender),
        ],
      }),
    ],
  });
}

function memberPositionPanel(record: TroopRecord, member: TroopMemberRecord, selectedIndex: number, rerender: () => void): HTMLElement {
  const panel = classicPanel("배치", [
    numberField("X", "db-field-troop-member-x", member.x, (x) => {
      updateSelectedMember(record, selectedIndex, { ...member, x });
      rerender();
    }),
    numberField("Y", "db-field-troop-member-y", member.y, (y) => {
      updateSelectedMember(record, selectedIndex, { ...member, y });
      rerender();
    }),
    checkboxField("숨김", "db-field-troop-member-hidden", member.hidden ?? false, (hidden) => {
      updateSelectedMember(record, selectedIndex, { ...member, hidden });
      rerender();
    }),
    textField("배경", "db-field-troop-backdrop", record.previewBackgroundResourceId ?? "", (previewBackgroundResourceId) => {
      updateDatabaseRecord("troops", record.id, { previewBackgroundResourceId: emptyToUndefined(previewBackgroundResourceId) });
      rerender();
    }),
  ]);
  panel.classList.add("db-troop-member-position-panel");
  return panel;
}

function troopBattlePreview(record: TroopRecord, selectedIndex: number, rerender: () => void): HTMLElement {
  const project = store.getCurrent();
  const sprites = (record.members ?? []).map((member, index) => {
    const enemy = project.database.enemies.find((entry) => entry.id === member.enemyId);
    const sprite = enemySprite(enemy, member, record.id, index, index === selectedIndex, rerender);
    sprite.dataset.memberIndex = String(index);
    return sprite;
  });
  const children = sprites.length > 0 ? sprites : [el("span", { class: "db-troop-empty-member", text: "(없음)" })];
  const stage = el("div", { class: "db-troop-battle-preview-stage", dataset: { testid: "db-troop-preview-stage" }, children });
  const backgroundUrl = resolveAssetResourceUrl(record.previewBackgroundResourceId, { project });
  if (backgroundUrl) {
    stage.style.backgroundImage = `linear-gradient(180deg, rgba(128, 184, 232, 0.18), rgba(85, 161, 61, 0.12)), url("${cssUrl(backgroundUrl)}")`;
  }
  return el("section", {
    class: "db-troop-preview-panel",
    children: [
      stage,
      el("div", { class: "db-troop-preview-caption", text: previewCaption(record) }),
    ],
  });
}

function enemySprite(
  enemy: EnemyRecord | undefined,
  member: TroopMemberRecord,
  troopId: string,
  index: number,
  selected: boolean,
  rerender: () => void
): HTMLElement {
  const url = resolveAssetResourceUrl(enemy?.monsterResourceId, { project: store.getCurrent() });
  if (!url) return el("span", { class: "db-troop-empty-member", text: enemy?.name ?? "(없음)" });
  const canvas = el("canvas", {
    class: `db-troop-member-sprite${selected ? " active" : ""}${member.hidden ? " hidden-member" : ""}`,
    attrs: { "aria-label": `${enemy?.name ?? "적"} 배치 미리보기`, role: "button" },
    dataset: { testid: `db-troop-member-sprite-${index + 1}`, enemyId: member.enemyId },
  }) as HTMLCanvasElement;
  canvas.width = 96;
  canvas.height = 72;
  canvas.style.left = `${(Math.max(0, Math.min(320, member.x)) / 320) * 100}%`;
  canvas.style.top = `${(Math.max(0, Math.min(160, member.y)) / 160) * 100}%`;
  canvas.addEventListener("click", () => {
    selectedMemberIndexes.set(troopId, index);
    rerender();
  });
  renderChromaKeyImage(canvas, url);
  return canvas;
}

function terrainPanel(terrains: readonly DatabaseTerrainRecord[], previewBackgroundResourceId: string | undefined): HTMLElement {
  return classicPanel("지형", [
    el("div", {
      class: "db-troop-terrain-list",
      children: terrains.map((terrain) => terrainCheckbox(terrain, previewBackgroundResourceId)),
    }),
  ]);
}

function terrainCheckbox(terrain: DatabaseTerrainRecord, previewBackgroundResourceId: string | undefined): HTMLElement {
  const input = el("input", { attrs: { type: "checkbox" } }) as HTMLInputElement;
  input.checked = !previewBackgroundResourceId || terrain.battleBackgroundResourceId === previewBackgroundResourceId;
  input.disabled = true;
  return el("label", { class: "db-troop-terrain-row", children: [input, el("span", { text: terrain.name })] });
}

function memberRows(record: TroopRecord, selectedIndex: number, rerender: () => void): HTMLElement {
  const project = store.getCurrent();
  const members = record.members ?? [];
  const children =
    members.length > 0
      ? members.map((member, index) => {
          const enemyName = project.database.enemies.find((enemy) => enemy.id === member.enemyId)?.name ?? member.enemyId;
          return el("button", {
            class: `db-troop-member-row${index === selectedIndex ? " active" : ""}`,
            attrs: { type: "button" },
            dataset: { testid: `db-troop-member-row-${index + 1}` },
            text: `${index + 1}. ${enemyName}  X${member.x} Y${member.y}`,
            on: {
              click: () => {
                selectedMemberIndexes.set(record.id, index);
                rerender();
              },
            },
          });
        })
      : [el("span", { class: "db-troop-member-row empty", text: "배치한 적이 없음" })];
  return el("div", { class: "db-troop-member-rows", dataset: { testid: "db-troop-member-rows" }, children });
}

function enemyList(record: TroopRecord, selectedIndex: number, selectedEnemyId: string, rerender: () => void): HTMLElement {
  return el("div", {
    class: "db-troop-enemy-list",
    children: store.getCurrent().database.enemies.map((enemy) =>
      el("button", {
        class: `db-troop-enemy-row${enemy.id === selectedEnemyId ? " active" : ""}`,
        attrs: { type: "button" },
        text: enemy.name,
        on: {
          click: () => {
            const member = record.members?.[selectedIndex] ?? positionedMember(enemy.id, selectedIndex);
            updateSelectedMember(record, selectedIndex, { ...member, enemyId: enemy.id });
            rerender();
          },
        },
      })
    ),
  });
}

function configurationPanel(record: TroopRecord, rerender: () => void): HTMLElement {
  return classicPanel("설정", [
    radioField("수동", "manual", !record.autoAlign, () => {
      updateDatabaseRecord("troops", record.id, { autoAlign: false });
      rerender();
    }),
    radioField("자동", "automatic", record.autoAlign, () => {
      updateDatabaseRecord("troops", record.id, { autoAlign: true, members: arrangeMembers(record.members ?? []) });
      rerender();
    }),
  ]);
}

function radioField(label: string, value: string, checked: boolean, onChange: () => void): HTMLElement {
  const input = el("input", { attrs: { type: "radio", name: "db-troop-configuration", value } }) as HTMLInputElement;
  input.checked = checked;
  input.addEventListener("change", () => {
    if (input.checked) onChange();
  });
  return el("label", { class: "db-troop-radio", children: [input, el("span", { text: label })] });
}

function checkboxField(label: string, testid: string, checked: boolean, onInput: (value: boolean) => void): HTMLElement {
  const input = el("input", { attrs: { type: "checkbox" }, dataset: { testid } }) as HTMLInputElement;
  input.checked = checked;
  input.addEventListener("change", () => onInput(input.checked));
  return el("label", { class: "actor-check", children: [input, el("span", { text: label })] });
}

function actionButton(label: string, testid: string, onClick: () => void): HTMLButtonElement {
  const node = el("button", { text: label, attrs: { type: "button" }, dataset: { testid } }) as HTMLButtonElement;
  node.addEventListener("click", onClick);
  return node;
}

function classicPanel(title: string, children: HTMLElement[]): HTMLElement {
  return el("fieldset", { class: "db-advanced-panel db-troop-classic-panel", children: [el("legend", { text: title }), ...children] });
}

function selectedMemberIndex(record: TroopRecord): number {
  const members = record.members ?? [];
  if (members.length === 0) return 0;
  const selected = selectedMemberIndexes.get(record.id) ?? 0;
  return Math.max(0, Math.min(selected, members.length - 1));
}

function updateSelectedMember(record: TroopRecord, selectedIndex: number, nextMember: TroopMemberRecord | undefined): void {
  const current = store.getCurrent().database.troops.find((entry) => entry.id === record.id) ?? record;
  const members = [...(current.members ?? [])];
  if (!nextMember) {
    members.splice(selectedIndex, 1);
    selectedMemberIndexes.set(record.id, Math.max(0, Math.min(selectedIndex, members.length - 1)));
    updateDatabaseRecord("troops", record.id, { members });
    return;
  }
  members[selectedIndex] = nextMember;
  selectedMemberIndexes.set(record.id, selectedIndex);
  updateDatabaseRecord("troops", record.id, { members });
}

function cssUrl(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"");
}

function positionedMember(enemyId: string, index: number): TroopMemberRecord {
  return { enemyId, x: 92 + index * 44, y: 104 + (index % 2) * 28, hidden: false };
}

function arrangeMembers(members: readonly TroopMemberRecord[]): TroopMemberRecord[] {
  return members.map((member, index) => ({ ...member, x: 92 + index * 48, y: 92 + (index % 2) * 42 }));
}

function rm2003ExampleMembers(): TroopMemberRecord[] {
  const enemies = store.getCurrent().database.enemies;
  const slime =
    enemies.find((enemy) => enemy.monsterResourceId?.includes("slime"))?.id ??
    enemies.find((enemy) => enemy.id.includes("slime"))?.id ??
    enemies[0]?.id;
  const sylph =
    enemies.find((enemy) => enemy.monsterResourceId?.includes("sylph") || enemy.monsterResourceId?.includes("hornet"))?.id ??
    enemies.find((enemy) => enemy.id.includes("sylph") || enemy.id.includes("hornet"))?.id ??
    enemies[0]?.id;
  if (!slime || !sylph) return [];
  return [
    { enemyId: sylph, x: 58, y: 58, hidden: false },
    { enemyId: sylph, x: 50, y: 114, hidden: false },
    { enemyId: slime, x: 130, y: 98, hidden: false },
    { enemyId: slime, x: 112, y: 136, hidden: false },
  ];
}

function generatedTroopName(record: TroopRecord): string {
  const enemies = store.getCurrent().database.enemies;
  const names = (record.members ?? [])
    .map((member) => enemies.find((enemy) => enemy.id === member.enemyId)?.name)
    .filter((name): name is string => Boolean(name));
  return names.length > 0 ? `${names.join(" / ")} 부대` : "적 그룹";
}

function nextBattleBackground(current: string | undefined): string | undefined {
  const backgrounds = store.getCurrent().database.terrains?.map((terrain) => terrain.battleBackgroundResourceId).filter((id): id is string => Boolean(id)) ?? [];
  if (backgrounds.length === 0) return current;
  const index = backgrounds.findIndex((id) => id === current);
  return backgrounds[(index + 1) % backgrounds.length] ?? backgrounds[0];
}

function previewCaption(record: TroopRecord): string {
  const enemies = store.getCurrent().database.enemies;
  const enemyNames = (record.members ?? [])
    .map((member) => enemies.find((enemy) => enemy.id === member.enemyId)?.name)
    .filter((name): name is string => Boolean(name));
  return `${record.name} / ${enemyNames.join(", ") || "(없음)"} / ${record.previewBackgroundResourceId ?? "(배경 없음)"}`;
}

function renderChromaKeyImage(canvas: HTMLCanvasElement, url: string): void {
  const context = canvas.getContext("2d");
  if (!context) return;
  const image = new Image();
  image.addEventListener("load", () => {
    context.clearRect(0, 0, canvas.width, canvas.height);
    const scale = Math.min(canvas.width / image.width, canvas.height / image.height, 1);
    const width = Math.max(1, Math.floor(image.width * scale));
    const height = Math.max(1, Math.floor(image.height * scale));
    const x = Math.floor((canvas.width - width) / 2);
    const y = Math.floor((canvas.height - height) / 2);
    context.drawImage(image, x, y, width, height);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    applyMagentaChromaKeyToImageData(imageData, { minBlue: 220 });
    context.putImageData(imageData, 0, 0);
  });
  image.src = url;
}
