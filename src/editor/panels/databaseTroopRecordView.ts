import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { emptyToUndefined, numberField, selectField, textField } from "@/editor/panels/databaseControls";
import { requestDatabaseModalClose } from "@/editor/panels/databaseModal";
import { renderTroopBattleEventPanel } from "@/editor/panels/databaseTroopBattleEventPanel";
import { openTroopBattleTestModal } from "@/editor/panels/testPlayModal";
import { store } from "@/project/store";
import type { DatabaseTerrainRecord, EnemyRecord, TroopMemberRecord, TroopRecord } from "@/project/types";
import { el } from "@/util/dom";
import { classicEnemyFormation } from "@/battle/battleBattlers";
import { normalizeEnemyRecord } from "@/project/databaseEnemyTroopRecordModel";
import { simulateBattle } from "@/battle/simulate";
import { applyMagentaChromaKeyToImageData } from "./chromaKey";

const DEFAULT_MEMBER: TroopMemberRecord = { enemyId: "", ...classicEnemyFormation(0), hidden: false };
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
        balancePanel(record),
        troopBattlePreview(record, selectedIndex, rerender),
        memberEditor(record, member, selectedIndex, selectedEnemy, rerender),
        terrainPanel(project.database.terrains ?? [], record.previewBackgroundResourceId),
        renderTroopBattleEventPanel(record, rerender),
      ],
    })
  );
}

// databaseRecordViews.ts의 updateRecordRowLabel과 동일한 동작 — 리스트 행 라벨/타이틀만
// 직접 갱신해 포커스·스크롤을 건드리지 않는다.
function updateTroopRowLabel(id: string, name: string): void {
  if (typeof document === "undefined") return;
  const row = document.querySelector(`[data-testid='db-record-row-${id}']`);
  if (!(row instanceof HTMLElement)) return;
  const nameNode = row.querySelector(".db-list-name");
  if (nameNode instanceof HTMLElement) nameNode.textContent = name || "(이름 없음)";
  row.setAttribute("title", `${name} (${id})`);
}

function topControls(record: TroopRecord, rerender: () => void): HTMLElement {
  return el("section", {
    class: "db-troop-top-controls",
    children: [
      classicPanel("이름", [textField("이름", "db-field-name", record.name, (name) => {
        updateDatabaseRecord("troops", record.id, { name });
        // troops는 databaseRecordViews.ts의 공용 nameField(onRename→updateRecordRowLabel)
        // 경로에서 제외되고(databaseAdvancedRecordViews.ts가 troops를 자체 폼으로 위임)
        // 이 필드가 자체 textField를 쓴다 — 타이핑 중에는 포커스 유지를 위해 전체
        // rerender를 부르지 않으므로, 다른 탭처럼 좌측 리스트 행만 직접 갱신한다
        // (qa-troops-report.md m5).
        updateTroopRowLabel(record.id, name);
      })]),
      actionButton("이름 생성", "db-troop-generate-name", () => {
        updateDatabaseRecord("troops", record.id, { name: generatedTroopName(record) });
        rerender();
      }),
      actionButton("전투 테스트", "db-troop-battle-test", () => {
        // DOM을 직접 뜯어내지 않는다 — openDatabaseModal이 등록한 document keydown
        // 리스너 2개가 정리되지 않고 새는 문제(M11)가 있었다. 훅을 통해 정식 close()를
        // 태운다(읽기 행위라 dirty 확인/discard 없이 즉시 닫힘 — 자동 저장이라 안전).
        requestDatabaseModalClose("battleTest");
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

const troopSimLevels = new Map<string, number>();

/** 보상 롤업 + 난이도 추정. 숨김 멤버는 보상에서 제외된다(battleRewards.ts). */
function balancePanel(record: TroopRecord): HTMLElement {
  const project = store.getCurrent();
  const members = (record.members ?? []).filter((member) => member.hidden !== true);
  let exp = 0;
  let gold = 0;
  const dropItemIds = new Set<string>();
  for (const member of members) {
    const enemy = project.database.enemies.find((entry) => entry.id === member.enemyId);
    if (!enemy) continue;
    const rewards = normalizeEnemyRecord(enemy).rewards;
    exp += rewards.exp;
    gold += rewards.gold;
    if (rewards.dropItemId) dropItemIds.add(rewards.dropItemId);
  }
  const rollup = el("div", {
    class: "db-troop-reward-rollup",
    dataset: { testid: "db-troop-reward-rollup" },
    text: `총 경험치 ${exp} / 총 돈 ${gold} / 드롭 후보 ${dropItemIds.size}종`,
  });
  const result = el("div", { class: "db-troop-sim-result", dataset: { testid: "db-troop-sim-result" }, text: "난이도 미추정" });
  const heroLevel = troopSimLevels.get(record.id) ?? 5;
  const levelField = numberField("파티 레벨", "db-troop-sim-level", heroLevel, (value) => troopSimLevels.set(record.id, value), { min: 1, max: 99 });
  const runButton = el("button", {
    class: "btn small",
    attrs: { type: "button" },
    text: "난이도 추정",
    dataset: { testid: "db-troop-sim-run" },
    on: {
      // 20 샘플은 클릭→결과 561ms(실측)로 UI 를 눈에 띄게 멈춰 세웠다 — 10 샘플로 낮추고
      // "추정 중…" 이 실제로 그려지도록 한 프레임 양보한 뒤 계산한다(워커로 옮기지 않는다).
      click: () => {
        result.textContent = "추정 중…";
        const run = (): void => {
          try {
            const outcome = simulateBattle({
              project: store.getCurrent(),
              troopId: record.id,
              heroLevel: troopSimLevels.get(record.id) ?? 5,
              n: 10,
              seed: 12345,
            });
            result.textContent = `승률 ${Math.round(outcome.winRate * 100)}% · 평균 ${outcome.avgTurns.toFixed(1)}턴 · 잔여 HP ${Math.round(outcome.avgHpRemaining)}`;
          } catch (error) {
            result.textContent = `추정 불가: ${error instanceof Error ? error.message : String(error)}`;
          }
        };
        if (typeof requestAnimationFrame === "function") requestAnimationFrame(run);
        else run();
      },
    },
  }) as HTMLButtonElement;
  if ((record.members ?? []).length === 0) {
    runButton.disabled = true;
    runButton.title = "멤버를 추가하면 추정할 수 있습니다";
  }
  return classicPanel("밸런스", [rollup, levelField, runButton, result]);
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
          // 라벨은 사용자에게 보인다 — 타사 제품명을 쓰지 않는다(2026-08-21).
          // testid 는 e2e 계약이라 유지하고, 식별자 개명은 별도 라운드에서 다룬다.
          actionButton("예시 배치", "db-troop-member-rm2003-preset", () => {
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
  const stage = el("div", {
    class: "db-troop-battle-preview-stage",
    dataset: { testid: "db-troop-preview-stage" },
    children: [recenterGuideLine(), ...partyMarkers(), ...children],
  });
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

const RECENTER_THRESHOLD_X = 150;

/** 런타임 재배치 경계(x>150)를 저작자가 볼 수 있게 표시한다. */
function recenterGuideLine(): HTMLElement {
  const line = el("div", { class: "db-troop-preview-recenter-line", dataset: { testid: "db-troop-preview-recenter-line" } });
  line.style.left = `${(RECENTER_THRESHOLD_X / 320) * 100}%`;
  line.title = "이 선을 넘는 적은 전투에서 좌측 진형으로 재배치됩니다";
  return line;
}

/** 아군 진형(battleX 252, battleY 96+36i) 읽기 전용 마커. 권위: battleBattlers.ts */
function partyMarkers(): HTMLElement[] {
  return [0, 1, 2, 3].map((index) => {
    const marker = el("div", {
      class: "db-troop-preview-party-marker",
      dataset: { testid: `db-troop-preview-party-marker-${index + 1}` },
      text: String(index + 1),
    });
    marker.style.left = `${(252 / 320) * 100}%`;
    marker.style.top = `${((96 + index * 36) / 240) * 100}%`;
    marker.title = "아군 진형 위치(읽기 전용)";
    return marker;
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
  canvas.style.left = `${(Math.max(0, Math.min(320, member.x ?? 0)) / 320) * 100}%`;
  canvas.style.top = `${(Math.max(0, Math.min(240, member.y ?? 0)) / 240) * 100}%`;
  if (member.x != null && member.x > RECENTER_THRESHOLD_X) {
    canvas.classList.add("is-recentered");
    canvas.title = "x>150 은 전투에서 좌측 진형으로 재배치됩니다";
  }
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
            text: `${index + 1}. ${enemyName} · enemy-${index + 1} · X${member.x} Y${member.y}`,
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
    activeSlotsField(record, rerender),
    uncapturableField(record, rerender),
  ]);
}

function activeSlotsField(record: TroopRecord, rerender: () => void): HTMLElement {
  const field = numberField("아군 참전 인원", "db-field-troop-active-slots", record.activeSlots ?? 0, (activeSlots) => {
    updateDatabaseRecord("troops", record.id, { activeSlots: optionalPositiveInteger(activeSlots) });
    rerender();
  });
  field.title = "이 적 그룹과 싸울 때 동시에 참전할 아군 수입니다(적 수가 아닙니다).";
  return field;
}

function uncapturableField(record: TroopRecord, rerender: () => void): HTMLElement {
  const field = checkboxField("포획 불가", "db-field-troop-uncapturable", record.uncapturable === true, (uncapturable) => {
    updateDatabaseRecord("troops", record.id, { uncapturable });
    rerender();
  });
  field.title = "이 그룹의 적은 포획 대상에서 제외됩니다.";
  return field;
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

function optionalPositiveInteger(value: number): number | undefined {
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return Math.trunc(value);
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
  return { enemyId, ...classicEnemyFormation(index), hidden: false };
}

function arrangeMembers(members: readonly TroopMemberRecord[]): TroopMemberRecord[] {
  return members.map((member, index) => ({ ...member, ...classicEnemyFormation(index) }));
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
  const members = [sylph, sylph, slime, slime];
  return members.map((enemyId, index) => ({ enemyId, ...classicEnemyFormation(index), hidden: false }));
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
