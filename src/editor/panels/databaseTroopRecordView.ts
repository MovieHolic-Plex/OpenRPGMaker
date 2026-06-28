import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { emptyToUndefined, numberField, selectField, textField } from "@/editor/panels/databaseControls";
import { renderTroopBattleEventPanel } from "@/editor/panels/databaseTroopBattleEventPanel";
import { store } from "@/project/store";
import type { DatabaseTerrainRecord, EnemyRecord, TroopMemberRecord, TroopRecord } from "@/project/types";
import { el } from "@/util/dom";

const DEFAULT_MEMBER: TroopMemberRecord = { enemyId: "", x: 160, y: 120, hidden: false };

export function renderTroopRecordForm(form: HTMLElement, record: TroopRecord, rerender: () => void): void {
  const member = currentTroopMember(record.id, record.members?.[0] ?? DEFAULT_MEMBER);
  const project = store.getCurrent();
  const selectedEnemy = project.database.enemies.find((enemy) => enemy.id === member.enemyId) ?? project.database.enemies[0];
  form.append(
    el("div", {
      class: "db-troops-classic-workbench",
      dataset: { testid: "db-troops-classic-workbench" },
      children: [
        topControls(record, rerender),
        troopBattlePreview(record),
        memberEditor(record, member, selectedEnemy, rerender),
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
      actionButton("전투 테스트", "db-troop-battle-test", () => undefined),
      actionButton("배경 변경", "db-troop-change-background", () => {
        updateDatabaseRecord("troops", record.id, { previewBackgroundResourceId: nextBattleBackground(record.previewBackgroundResourceId) });
        rerender();
      }),
      configurationPanel(record, rerender),
    ],
  });
}

function memberEditor(record: TroopRecord, member: TroopMemberRecord, selectedEnemy: EnemyRecord | undefined, rerender: () => void): HTMLElement {
  return el("section", {
    class: "db-troop-member-editor",
    children: [
      el("div", {
        class: "db-troop-member-buttons",
        children: [
          actionButton("추가", "db-troop-member-add", () => {
            const nextEnemyId = selectedEnemy?.id ?? store.getCurrent().database.enemies[0]?.id ?? "";
            if (!nextEnemyId) return;
            updateDatabaseRecord("troops", record.id, { members: [...(record.members ?? []), positionedMember(nextEnemyId, record.members?.length ?? 0)] });
            rerender();
          }),
          actionButton("삭제", "db-troop-member-delete", () => {
            updateDatabaseRecord("troops", record.id, { members: (record.members ?? []).slice(1) });
            rerender();
          }),
          actionButton("지우기", "db-troop-member-clear", () => {
            updateDatabaseRecord("troops", record.id, { members: [] });
            rerender();
          }),
          actionButton("정렬", "db-troop-member-arrange", () => {
            updateDatabaseRecord("troops", record.id, { autoAlign: true, members: arrangeMembers(record.members ?? []) });
            rerender();
          }),
        ],
      }),
      el("div", {
        class: "db-troop-member-list",
        children: [
          selectField("적", "db-picker-troop-member-enemy", member.enemyId, store.getCurrent().database.enemies, (enemyId) => {
            updateDatabaseRecord("troops", record.id, { members: enemyId ? [{ ...currentTroopMember(record.id, member), enemyId }] : [] });
            rerender();
          }),
          memberPositionPanel(record, member),
          enemyList(selectedEnemy?.id ?? member.enemyId),
        ],
      }),
    ],
  });
}

function memberPositionPanel(record: TroopRecord, member: TroopMemberRecord): HTMLElement {
  const panel = classicPanel("배치", [
    numberField("X", "db-field-troop-member-x", member.x, (x) =>
      updateDatabaseRecord("troops", record.id, { members: [{ ...currentTroopMember(record.id, member), x }] })
    ),
    numberField("Y", "db-field-troop-member-y", member.y, (y) =>
      updateDatabaseRecord("troops", record.id, { members: [{ ...currentTroopMember(record.id, member), y }] })
    ),
    checkboxField("숨김", "db-field-troop-member-hidden", member.hidden ?? false, (hidden) =>
      updateDatabaseRecord("troops", record.id, { members: [{ ...currentTroopMember(record.id, member), hidden }] })
    ),
    textField("배경", "db-field-troop-backdrop", record.previewBackgroundResourceId ?? "", (previewBackgroundResourceId) =>
      updateDatabaseRecord("troops", record.id, { previewBackgroundResourceId: emptyToUndefined(previewBackgroundResourceId) })
    ),
  ]);
  panel.classList.add("db-troop-member-position-panel");
  return panel;
}

function troopBattlePreview(record: TroopRecord): HTMLElement {
  const project = store.getCurrent();
  const sprites = (record.members ?? []).map((member, index) => {
    const enemy = project.database.enemies.find((entry) => entry.id === member.enemyId);
    const sprite = enemySprite(enemy, member);
    sprite.dataset.memberIndex = String(index);
    return sprite;
  });
  const children = sprites.length > 0 ? sprites : [el("span", { class: "db-troop-empty-member", text: "(없음)" })];
  return el("section", {
    class: "db-troop-preview-panel",
    children: [
      el("div", { class: "db-troop-battle-preview-stage", dataset: { testid: "db-troop-preview-stage" }, children }),
      el("div", { class: "db-troop-preview-caption", text: previewCaption(record) }),
    ],
  });
}

function enemySprite(enemy: EnemyRecord | undefined, member: TroopMemberRecord): HTMLElement {
  const url = resolveAssetResourceUrl(enemy?.monsterResourceId, { project: store.getCurrent() });
  if (!url) return el("span", { class: "db-troop-empty-member", text: enemy?.name ?? "(없음)" });
  const canvas = el("canvas", {
    class: "db-troop-member-sprite",
    attrs: { "aria-label": `${enemy?.name ?? "적"} 배치 미리보기`, role: "img" },
  }) as HTMLCanvasElement;
  canvas.width = 96;
  canvas.height = 72;
  canvas.style.left = `${Math.max(10, Math.min(470, member.x))}px`;
  canvas.style.top = `${Math.max(24, Math.min(318, member.y))}px`;
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

function enemyList(selectedEnemyId: string): HTMLElement {
  return el("div", {
    class: "db-troop-enemy-list",
    children: store.getCurrent().database.enemies.map((enemy) =>
      el("button", {
        class: `db-troop-enemy-row${enemy.id === selectedEnemyId ? " active" : ""}`,
        attrs: { type: "button" },
        text: enemy.name,
        on: { click: () => undefined },
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

function currentTroopMember(troopId: string, fallback: TroopMemberRecord): TroopMemberRecord {
  return store.getCurrent().database.troops.find((entry) => entry.id === troopId)?.members?.[0] ?? fallback;
}

function positionedMember(enemyId: string, index: number): TroopMemberRecord {
  return { enemyId, x: 104 + index * 56, y: 112, hidden: false };
}

function arrangeMembers(members: readonly TroopMemberRecord[]): TroopMemberRecord[] {
  return members.map((member, index) => ({ ...member, x: 104 + index * 58, y: 112 + (index % 2) * 44 }));
}

function generatedTroopName(record: TroopRecord): string {
  const enemies = store.getCurrent().database.enemies;
  const names = (record.members ?? [])
    .map((member) => enemies.find((enemy) => enemy.id === member.enemyId)?.name)
    .filter((name): name is string => Boolean(name));
  return names.length > 0 ? `${names.join(" / ")} 부대` : "새 적 그룹";
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
    const data = imageData.data;
    for (let index = 0; index < data.length; index += 4) {
      const isMagenta = data[index] > 220 && data[index + 1] < 80 && data[index + 2] > 220;
      if (isMagenta) data[index + 3] = 0;
    }
    context.putImageData(imageData, 0, 0);
  });
  image.src = url;
}
