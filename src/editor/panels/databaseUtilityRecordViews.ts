import { emptyToUndefined, numberField, selectField, selectLiteral } from "@/editor/panels/databaseControls";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { battleStudioHeading } from "@/editor/panels/databaseBattleStudio";
import { resourcePickerControl } from "@/editor/panels/databaseResourcePickerDialog";
import { DEFAULT_BATTLE_FIELD_BACKGROUND_ID } from "@/project/databaseEnemyTroopRecordModel";
import { recordCoalescedSnapshot, recordProjectSnapshot } from "@/editor/mapEditHistory";
export { renderElementsTab } from "@/editor/panels/databaseElementsClassic";
import {
  countText,
  isBattleCommandKind,
  isTerrainDisplay,
  selectUtilityRecord,
  selectedTerrain,
  terrainVehicleText,
  utilityCheckboxRow,
  utilityNumberRow,
  utilitySelectRow,
  utilityTextRow,
} from "@/editor/panels/databaseUtilityRecordControls";
import { switchDatabaseActiveTab } from "@/editor/panels/database";
import { store } from "@/project/store";
import type {
  BattleFlow,
  ClassBattleCommandKind,
  DatabaseBattleCommandRecord,
  DatabaseTerrainRecord,
  TroopRecord,
} from "@/project/types";
import { el } from "@/util/dom";
import "@/styles/database/battle-studio.css";

const BATTLE_FLOW_OPTIONS = ["gauge", "strict"] as const satisfies readonly BattleFlow[];

export function renderTerrainTab(host: HTMLElement): void {
  const terrains = store.getCurrent().database.terrains ?? [];
  const selected = selectedTerrain(terrains);
  const selectedIndex = Math.max(0, terrains.indexOf(selected as DatabaseTerrainRecord));
  const rerender = (): void => {
    host.replaceChildren();
    renderTerrainTab(host);
  };
  const form = el("section", { class: "db-detail-form db-parity-form db-battle-studio-surface db-terrain-studio", dataset: { testid: "db-detail-form" } });
  form.append(
    battleStudioHeading("terrain", "지형", "필드의 이동 규칙과 전투 분위기를 하나의 프리셋으로 관리합니다."),
    el("div", {
      class: "db-terrain-studio-workspace",
      children: [
        terrainPresetGallery(terrains, selectedIndex, rerender),
        terrainPreviewStage(selected),
        el("aside", {
          class: "db-terrain-inspector",
          dataset: { testid: "db-terrain-inspector" },
          children: [
            studioSectionHeader("지형 속성", `${countText(terrains.length)} · ${selected?.name ?? "선택 없음"}`),
            el("div", {
              class: "db-terrain-record-stack",
              children: terrains.length > 0 ? terrainEditorRows(terrains, rerender) : [emptyStudioState("등록된 지형이 없습니다.")],
            }),
          ],
        }),
      ],
    }),
    el("section", {
      class: "db-studio-summary-strip",
      children: [
        summaryMetric("전투 배경", resourceDisplayName(selected?.battleBackgroundResourceId)),
        summaryMetric("발소리", resourceDisplayName(selected?.footstepSoundResourceId)),
        summaryMetric("탈것", terrainVehicleText(selected)),
        summaryMetric("캐릭터", selected?.characterDisplay === "transparent" ? "투명" : "일반"),
      ],
    })
  );
  host.append(form);
}

export function renderBattleScreenTab(host: HTMLElement): void {
  const project = store.getCurrent();
  const selectedTroop = project.database.troops.find((troop) => troop.id === project.system.initialTroopId) ?? project.database.troops[0];
  const form = el("section", { class: "db-detail-form db-parity-form db-battle-studio-surface db-battle-screen-studio", dataset: { testid: "db-detail-form" } });
  const rerender = (): void => {
    host.replaceChildren();
    renderBattleScreenTab(host);
  };
  form.append(
    battleStudioHeading("battleScreen", "전투 화면", "대표 전장을 보면서 전투 흐름과 초기 구성을 맞춥니다."),
    el("div", {
      class: "db-battle-screen-workspace",
      children: [
        battleScreenPreviewStage(selectedTroop),
        el("aside", {
          class: "db-battle-screen-inspector",
          dataset: { testid: "db-battle-screen-inspector" },
          children: [
            studioSectionHeader("화면 속성", selectedTroop?.name ?? "적 그룹 없음"),
            resourcePickerControl({
              label: "전투 시스템",
              resourceId: project.system.battleSystemResourceId,
              kind: "system2",
              testid: "db-field-battle-system-resource",
              allowClear: true,
              dialogTitle: "전투 시스템 그래픽",
              onChange: (result) => {
                recordCoalescedSnapshot("db-utility:battle-screen:battle-system-resource");
                store.update((draft) => {
                  draft.system.battleSystemResourceId = emptyToUndefined(result.resourceId);
                }, { scope: "system" });
              },
              rerender,
            }),
            selectField("초기 적 그룹", "db-picker-battle-initial-troop", project.system.initialTroopId ?? "", project.database.troops, (value) => {
              recordProjectSnapshot();
              store.update((draft) => {
                draft.system.initialTroopId = emptyToUndefined(value);
              }, { scope: "system" });
              rerender();
            }),
            selectLiteral(
              "전투 흐름",
              "db-field-battle-screen-flow",
              project.system.battleFlow === "strict" ? "strict" : "gauge",
              BATTLE_FLOW_OPTIONS,
              (value) => {
                recordProjectSnapshot();
                store.update((draft) => {
                  draft.system.battleFlow = value;
                }, { scope: "system" });
              },
            ),
            numberField("기본 참전 수", "db-field-battle-screen-active-slots", project.system.activeSlots ?? 0, (value) => {
              recordCoalescedSnapshot("db-utility:battle-screen:active-slots");
              store.update((draft) => {
                draft.system.activeSlots = Number.isFinite(value) && value > 0 ? Math.trunc(value) : undefined;
              }, { scope: "system" });
            }),
          ],
        }),
      ],
    }),
    battleScreenTroopStrip(project.database.troops),
    el("section", {
      class: "db-studio-summary-strip",
      children: [
        summaryMetric("배치", "적 위치와 숨김은 적 그룹에서 편집"),
        summaryMetric("배경 우선순위", "적 그룹 → 지형 → 기본 전장"),
        summaryMetric("전투 흐름", project.system.battleFlow === "strict" ? "턴 전투" : "게이지 전투"),
      ],
    })
  );
  host.append(form);
}

export function renderBattleCommandsTab(host: HTMLElement): void {
  const project = store.getCurrent();
  const commands = project.database.battleCommands ?? [];
  const form = el("section", { class: "db-detail-form db-parity-form db-battle-studio-surface db-battle-command-studio", dataset: { testid: "db-detail-form" } });
  form.append(
    battleStudioHeading("battleCommands", "전투 명령", "플레이어가 전투 중 선택할 행동과 직업별 메뉴 연결을 설계합니다."),
    el("div", {
      class: "db-battle-command-workspace",
      children: [
        battleCommandPreview(commands),
        el("aside", {
          class: "db-battle-command-inspector",
          dataset: { testid: "db-battle-command-inspector" },
          children: [
            studioSectionHeader("직업 연결", `${countText(project.database.classes.length)} 직업`),
            el("p", { text: "각 직업의 전투 메뉴가 이 명령의 이름과 종류를 참조합니다." }),
            el("button", {
              class: "db-studio-secondary-action",
              text: "직업별 메뉴 순서 편집",
              attrs: { type: "button" },
              dataset: { testid: "db-open-classes-tab" },
              on: {
                click: (event) => {
                  const panelRoot = databasePanelRootFrom(event.currentTarget as HTMLElement | null);
                  if (panelRoot) switchDatabaseActiveTab("classes", panelRoot);
                },
              },
            }),
            el("div", {
              class: "db-command-kind-legend",
              children: ["공격", "특수기능", "특수계열", "방어", "아이템", "도망", "교체"].map((label) => el("span", { text: label })),
            }),
          ],
        }),
      ],
    }),
    el("section", {
      class: "db-battle-command-palette",
      dataset: { testid: "db-battle-command-palette" },
      children: [
        studioSectionHeader("명령 팔레트", countText(commands.length)),
        el("div", {
          class: "db-battle-command-card-grid",
          children: commands.length > 0 ? battleCommandEditorCards(commands) : [emptyStudioState("등록된 전투 명령이 없습니다.")],
        }),
      ],
    })
  );
  host.append(form);
}

function terrainPresetGallery(terrains: readonly DatabaseTerrainRecord[], selectedIndex: number, rerender: () => void): HTMLElement {
  const project = store.getCurrent();
  return el("aside", {
    class: "db-terrain-preset-gallery",
    dataset: { testid: "db-terrain-preset-gallery" },
    children: [
      studioSectionHeader("지형 프리셋", countText(terrains.length)),
      ...terrains.map((terrain, index) => {
        const preview = el("span", { class: "db-terrain-preset-thumb" });
        const url = resolveAssetResourceUrl(terrain.battleBackgroundResourceId, { project });
        if (url) preview.style.backgroundImage = cssBackground(url);
        return el("button", {
          class: `db-terrain-preset-card${index === selectedIndex ? " active" : ""}`,
          attrs: { type: "button", "aria-pressed": String(index === selectedIndex) },
          dataset: { testid: `db-terrain-preset-${index}` },
          children: [
            preview,
            el("span", {
              class: "db-terrain-preset-copy",
              children: [
                el("strong", { text: terrain.name }),
                el("small", { text: `조우 ${terrain.encounterRatePercent}% · 피해 ${terrain.damage}` }),
              ],
            }),
          ],
          on: {
            click: () => {
              selectUtilityRecord("terrain", index);
              rerender();
            },
          },
        });
      }),
    ],
  });
}

function terrainPreviewStage(terrain: DatabaseTerrainRecord | undefined): HTMLElement {
  const stage = el("section", {
    class: "db-terrain-preview-stage db-studio-dark-stage",
    dataset: { testid: "db-terrain-preview-stage" },
    children: [
      el("div", { class: "db-studio-stage-grid", attrs: { "aria-hidden": "true" } }),
      el("div", {
        class: "db-terrain-stage-overlay",
        children: [
          el("span", { class: "db-studio-live-chip", text: "LIVE PREVIEW" }),
          el("strong", { text: terrain?.name ?? "지형 없음" }),
          el("small", { text: terrain ? `조우 ${terrain.encounterRatePercent}% · 지형 피해 ${terrain.damage}` : "프리셋을 선택하세요" }),
        ],
      }),
      el("div", {
        class: "db-terrain-stage-actors",
        attrs: { "aria-hidden": "true" },
        children: [el("span", { text: "◆" }), el("span", { text: "◆" }), el("span", { text: "▲" })],
      }),
    ],
  });
  const url = resolveAssetResourceUrl(terrain?.battleBackgroundResourceId, { project: store.getCurrent() });
  if (url) stage.style.backgroundImage = `linear-gradient(180deg, rgba(23, 27, 31, 0.05), rgba(23, 27, 31, 0.42)), ${cssBackground(url)}`;
  return stage;
}

function battleScreenPreviewStage(troop: TroopRecord | undefined): HTMLElement {
  const project = store.getCurrent();
  const backdropId = troop?.previewBackgroundResourceId ?? DEFAULT_BATTLE_FIELD_BACKGROUND_ID;
  const stage = el("section", {
    class: "db-battle-screen-preview-stage db-studio-dark-stage",
    dataset: { testid: "db-battle-screen-preview-stage" },
  });
  const url = resolveAssetResourceUrl(backdropId, { project });
  if (url) stage.style.backgroundImage = `linear-gradient(180deg, rgba(18, 22, 25, 0.08), rgba(18, 22, 25, 0.38)), ${cssBackground(url)}`;
  stage.append(
    el("div", { class: "db-studio-stage-grid", attrs: { "aria-hidden": "true" } }),
    el("div", {
      class: "db-battle-screen-stage-meta",
      children: [
        el("span", { class: "db-studio-live-chip", text: project.system.battleFlow === "strict" ? "TURN" : "GAUGE" }),
        el("strong", { text: troop?.name ?? "적 그룹 없음" }),
        el("small", { text: `${troop?.members?.length ?? troop?.enemyIds.length ?? 0} enemies · ${resourceDisplayName(backdropId)}` }),
      ],
    }),
    el("div", {
      class: "db-battle-screen-party-markers",
      attrs: { "aria-label": "아군 진형 미리보기" },
      children: [0, 1, 2, 3].map((index) => el("span", { text: String(index + 1) })),
    }),
    ...battleScreenEnemySprites(troop)
  );
  return stage;
}

function battleScreenEnemySprites(troop: TroopRecord | undefined): HTMLElement[] {
  const project = store.getCurrent();
  const members = troop?.members ?? troop?.enemyIds.map((enemyId, index) => ({ enemyId, x: 80 + index * 42, y: 88 + index * 28 })) ?? [];
  return members.slice(0, 6).map((member, index) => {
    const enemy = project.database.enemies.find((candidate) => candidate.id === member.enemyId);
    const url = resolveAssetResourceUrl(enemy?.monsterResourceId, { project });
    const sprite = url
      ? el("img", { class: "db-battle-screen-enemy-sprite", attrs: { alt: enemy?.name ?? "몬스터", src: url } })
      : el("span", { class: "db-battle-screen-enemy-fallback", text: enemy?.name.slice(0, 1) ?? "?" });
    sprite.style.left = `${18 + index * 9}%`;
    sprite.style.top = `${35 + (index % 2) * 22}%`;
    return sprite;
  });
}

function battleScreenTroopStrip(troops: readonly TroopRecord[]): HTMLElement {
  return el("section", {
    class: "db-battle-screen-troop-strip",
    dataset: { testid: "db-battle-screen-troop-strip" },
    children: [
      studioSectionHeader("적 그룹", `${Math.min(troops.length, 8)} / ${troops.length}`),
      el("div", {
        class: "db-battle-screen-troop-cards",
        children: troops.slice(0, 8).map((troop) => {
          const memberCount = troop.members?.length ?? troop.enemyIds.length;
          return el("div", {
            class: "db-battle-screen-troop-card",
            children: [el("strong", { text: troop.name }), el("small", { text: `몬스터 ${memberCount} · ${resourceDisplayName(troop.previewBackgroundResourceId)}` })],
          });
        }),
      }),
    ],
  });
}

function battleCommandPreview(commands: readonly DatabaseBattleCommandRecord[]): HTMLElement {
  return el("section", {
    class: "db-battle-command-preview db-studio-dark-stage",
    dataset: { testid: "db-battle-command-preview" },
    children: [
      el("div", { class: "db-studio-stage-grid", attrs: { "aria-hidden": "true" } }),
      el("div", {
        class: "db-command-preview-copy",
        children: [el("span", { class: "db-studio-live-chip", text: "BATTLE MENU" }), el("strong", { text: "행동 선택" })],
      }),
      el("div", {
        class: "db-command-preview-menu",
        children: commands.slice(0, 6).map((command, index) => el("button", {
          class: index === 0 ? "active" : "",
          attrs: { type: "button", tabindex: "-1" },
          text: command.name,
        })),
      }),
    ],
  });
}

function studioSectionHeader(title: string, meta: string): HTMLElement {
  return el("header", {
    class: "db-studio-section-header",
    children: [el("strong", { text: title }), el("span", { text: meta })],
  });
}

function summaryMetric(label: string, value: string): HTMLElement {
  return el("div", { class: "db-studio-summary-metric", children: [el("small", { text: label }), el("strong", { text: value })] });
}

function emptyStudioState(message: string): HTMLElement {
  return el("div", { class: "db-studio-empty", text: message });
}

function cssBackground(url: string): string {
  return `url(${JSON.stringify(url)})`;
}

function terrainEditorRows(terrains: readonly DatabaseTerrainRecord[], rerender: () => void): HTMLElement[] {
  // 레코드마다 래퍼 div로 감싸 grid-column:1/-1 을 부여한다 — 그렇지 않으면 필드(9개, 홀수)가
  // 부모 2열 그리드에 flat하게 흘러 들어가 레코드 경계 없이 다음 레코드 필드와 뒤섞였다(P9).
  return terrains.map((terrain, index) => el("div", {
    class: "db-terrain-record",
    dataset: { testid: `db-terrain-record-${index}` },
    children: terrainRecordFields(terrain, index, rerender),
  }));
}

function terrainRecordFields(terrain: DatabaseTerrainRecord, index: number, rerender: () => void): HTMLElement[] {
  return [
    utilityTextRow({ label: "이름", value: terrain.name, testid: `db-field-terrain-name-${index}`, onFocus: () => selectUtilityRecord("terrain", index), onInput: (value) => {
      recordCoalescedSnapshot(`db-utility:terrain:${index}:name`);
      store.update((project) => {
        const target = project.database.terrains?.[index];
        if (target) target.name = value;
      });
    } }),
    utilityNumberRow({ label: "대미지", value: terrain.damage, testid: `db-field-terrain-damage-${index}`, onFocus: () => selectUtilityRecord("terrain", index), onInput: (value) => {
      recordCoalescedSnapshot(`db-utility:terrain:${index}:damage`);
      store.update((project) => {
        const target = project.database.terrains?.[index];
        if (target) target.damage = Math.max(0, Math.trunc(value));
      });
    } }),
    utilityNumberRow({ label: "조우율", value: terrain.encounterRatePercent, testid: `db-field-terrain-encounter-${index}`, onFocus: () => selectUtilityRecord("terrain", index), onInput: (value) => {
      recordCoalescedSnapshot(`db-utility:terrain:${index}:encounter`);
      store.update((project) => {
        const target = project.database.terrains?.[index];
        if (target) target.encounterRatePercent = Math.max(0, Math.min(500, Math.trunc(value)));
      });
    } }),
    resourcePickerControl({
      label: "전투 배경",
      resourceId: terrain.battleBackgroundResourceId,
      kind: "backdrop",
      testid: `db-field-terrain-backdrop-${index}`,
      allowClear: true,
      dialogTitle: "전투 배경",
      onChange: (result) => {
        selectUtilityRecord("terrain", index);
        recordCoalescedSnapshot(`db-utility:terrain:${index}:backdrop`);
        store.update((project) => {
          const target = project.database.terrains?.[index];
          if (target) target.battleBackgroundResourceId = emptyToUndefined(result.resourceId);
        });
      },
      rerender,
    }),
    resourcePickerControl({
      label: "발소리",
      resourceId: terrain.footstepSoundResourceId,
      kind: "sound",
      testid: `db-field-terrain-footstep-${index}`,
      allowClear: true,
      dialogTitle: "발소리",
      onChange: (result) => {
        selectUtilityRecord("terrain", index);
        recordCoalescedSnapshot(`db-utility:terrain:${index}:footstep`);
        store.update((project) => {
          const target = project.database.terrains?.[index];
          if (target) target.footstepSoundResourceId = emptyToUndefined(result.resourceId);
        });
      },
      rerender,
    }),
    utilitySelectRow({ label: "표시", value: terrain.characterDisplay, options: ["normal", "transparent"], testid: `db-field-terrain-display-${index}`, onFocus: () => selectUtilityRecord("terrain", index), onInput: (value) => {
      recordProjectSnapshot();
      store.update((project) => {
        const target = project.database.terrains?.[index];
        if (target) target.characterDisplay = isTerrainDisplay(value) ? value : "normal";
      });
    } }),
    utilityCheckboxRow({ label: "보트", value: terrain.vehiclePassage.boat, testid: `db-field-terrain-boat-${index}`, onFocus: () => selectUtilityRecord("terrain", index), onInput: (checked) => {
      recordProjectSnapshot();
      store.update((project) => {
        const target = project.database.terrains?.[index];
        if (target) target.vehiclePassage.boat = checked;
      });
    } }),
    utilityCheckboxRow({ label: "선박", value: terrain.vehiclePassage.ship, testid: `db-field-terrain-ship-${index}`, onFocus: () => selectUtilityRecord("terrain", index), onInput: (checked) => {
      recordProjectSnapshot();
      store.update((project) => {
        const target = project.database.terrains?.[index];
        if (target) target.vehiclePassage.ship = checked;
      });
    } }),
    utilityCheckboxRow({ label: "비공정", value: terrain.vehiclePassage.airshipLand, testid: `db-field-terrain-airship-${index}`, onFocus: () => selectUtilityRecord("terrain", index), onInput: (checked) => {
      recordProjectSnapshot();
      store.update((project) => {
        const target = project.database.terrains?.[index];
        if (target) target.vehiclePassage.airshipLand = checked;
      });
    } }),
  ];
}

function battleCommandEditorCards(commands: readonly DatabaseBattleCommandRecord[]): HTMLElement[] {
  const kinds: readonly ClassBattleCommandKind[] = ["attack", "skill", "skillSubset", "defend", "guard", "item", "escape", "switch", "event"];
  return commands.map((command, index) => el("article", {
    class: "db-battle-command-card",
    dataset: { testid: `db-battle-command-card-${index}` },
    children: [
      el("header", {
        children: [
          el("span", { class: "db-command-card-index", text: String(index + 1).padStart(2, "0") }),
          el("strong", { text: command.name || "이름 없는 명령" }),
          el("span", { class: "db-command-card-kind", text: command.kind }),
        ],
      }),
      utilityTextRow({ label: "이름", value: command.name, testid: `db-field-battle-command-name-${index}`, onFocus: () => selectUtilityRecord("battleCommands", index), onInput: (value) => {
      recordCoalescedSnapshot(`db-utility:battle-command:${index}:name`);
      store.update((project) => {
        const target = project.database.battleCommands?.[index];
        if (target) target.name = value;
      });
      } }),
      utilitySelectRow({ label: "종류", value: command.kind, options: kinds, testid: `db-field-battle-command-kind-${index}`, onFocus: () => selectUtilityRecord("battleCommands", index), onInput: (value) => {
      recordProjectSnapshot();
      store.update((project) => {
        const target = project.database.battleCommands?.[index];
        if (target) target.kind = isBattleCommandKind(value) ? value : "attack";
      });
      } }),
      utilityTextRow({ label: "스킬 묶음", value: command.skillSubsetName ?? "", testid: `db-field-battle-command-subset-${index}`, onFocus: () => selectUtilityRecord("battleCommands", index), onInput: (value) => {
      recordCoalescedSnapshot(`db-utility:battle-command:${index}:subset`);
      store.update((project) => {
        const target = project.database.battleCommands?.[index];
        if (target) target.skillSubsetName = emptyToUndefined(value);
      });
      } }),
      battleCommandSkillRow(command, index),
    ],
  }));
}

function battleCommandSkillRow(command: DatabaseBattleCommandRecord, index: number): HTMLElement {
  const skills = store.getCurrent().database.skills;
  const current = command.skillId ?? "";
  const options = [
    { id: "", name: "(없음)" },
    ...skills.map((skill) => ({ id: skill.id, name: skill.name })),
  ];
  if (current && !skills.some((skill) => skill.id === current)) {
    options.push({ id: current, name: current });
  }
  const select = el("select", {
    class: "db-battle-command-skill-select",
    dataset: { testid: `db-picker-battle-command-skill-${index}` },
    children: options.map((option) => el("option", { attrs: { value: option.id }, text: option.name })),
  }) as HTMLSelectElement;
  select.value = current;
  const writeSkill = (value: string): void => {
    recordCoalescedSnapshot(`db-utility:battle-command:${index}:skill`);
    store.update((project) => {
      const target = project.database.battleCommands?.[index];
      if (target) target.skillId = emptyToUndefined(value);
    });
  };
  select.addEventListener("focus", () => selectUtilityRecord("battleCommands", index));
  select.addEventListener("change", () => writeSkill(select.value));
  const hidden = el("input", {
    class: "db-authoring-id",
    attrs: { type: "text", "aria-hidden": "true", tabindex: "-1" },
    dataset: { testid: `db-field-battle-command-skill-${index}` },
    value: current,
  }) as HTMLInputElement;
  hidden.addEventListener("focus", () => selectUtilityRecord("battleCommands", index));
  hidden.addEventListener("input", () => writeSkill(hidden.value));
  return el("label", {
    class: "db-readonly-row",
    children: [el("span", { text: "스킬" }), select, hidden],
  });
}

function resourceDisplayName(resourceId: string | undefined): string {
  if (!resourceId) return "(미설정)";
  const pretty = resourceId.split(/[-_/]/).filter(Boolean).at(-1);
  return pretty ?? resourceId;
}

// G006: 모달 내 점프는 switchDatabaseActiveTab. fakeDom 에서는 closest가 HTMLElement가
// 아니라서 .db-body 부모를 걸어 올라간다(개요/적 탭과 동일).
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
