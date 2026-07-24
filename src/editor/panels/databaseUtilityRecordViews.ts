import { emptyToUndefined, numberField, selectField, selectLiteral, textControl } from "@/editor/panels/databaseControls";
import { ordinalLabel } from "@/editor/panels/databaseDisplay";
import { DEFAULT_BATTLE_FIELD_BACKGROUND_ID } from "@/project/databaseEnemyTroopRecordModel";
import { recordCoalescedSnapshot, recordProjectSnapshot } from "@/editor/mapEditHistory";
export { renderElementsTab } from "@/editor/panels/databaseElementsClassic";
import {
  countText,
  isBattleCommandKind,
  isTerrainDisplay,
  readonlyValue,
  rm2k3Fieldset,
  selectUtilityRecord,
  selectedTerrain,
  terrainVehicleText,
  utilityCheckboxRow,
  utilityNumberRow,
  utilitySelectRow,
  utilityTextRow,
} from "@/editor/panels/databaseUtilityRecordControls";
import { store } from "@/project/store";
import type {
  BattleFlow,
  BattlerAnimationPoseKind,
  BattlerAnimationRecord,
  ClassBattleCommandKind,
  DatabaseBattleCommandRecord,
  DatabaseTerrainRecord,
} from "@/project/types";
import { el } from "@/util/dom";

const BATTLE_FLOW_OPTIONS = ["gauge", "strict"] as const satisfies readonly BattleFlow[];

export function renderTerrainTab(host: HTMLElement): void {
  const terrains = store.getCurrent().database.terrains ?? [];
  const selected = selectedTerrain(terrains);
  const form = el("section", { class: "db-detail-form db-parity-form", dataset: { testid: "db-detail-form" } });
  form.append(
    rm2k3Fieldset("지형", [
      readonlyValue("편집 위치", "RM2003 데이터베이스 > 지형"),
      readonlyValue("레코드", countText(terrains.length)),
      readonlyValue("저장 위치", "database.terrains"),
    ]),
    rm2k3Fieldset("지형 레코드", terrains.length > 0 ? terrainEditorRows(terrains) : [readonlyValue("0001", "지형 레코드 없음")]),
    rm2k3Fieldset("전투와 이동", [
      readonlyValue("전투 배경", selected?.battleBackgroundResourceId ?? "(미설정)"),
      readonlyValue("발소리", selected?.footstepSoundResourceId ?? "(미설정)"),
      readonlyValue("탈것", terrainVehicleText(selected)),
      readonlyValue("캐릭터", selected?.characterDisplay ?? "normal"),
    ]),
  );
  host.append(el("h3", { text: "지형" }), form);
}

export function renderBattleScreenTab(host: HTMLElement): void {
  const project = store.getCurrent();
  const selectedTroop = project.database.troops.find((troop) => troop.id === project.system.initialTroopId) ?? project.database.troops[0];
  const form = el("section", { class: "db-detail-form db-parity-form", dataset: { testid: "db-detail-form" } });
  const rerender = (): void => {
    host.replaceChildren();
    renderBattleScreenTab(host);
  };
  form.append(
    rm2k3Fieldset("전투 화면", [
      readonlyValue("편집 위치", "RM2003 데이터베이스 > 전투 화면"),
      textControl("전투 시스템", project.system.battleSystemResourceId ?? "", (value) => {
        recordCoalescedSnapshot("db-utility:battle-screen:battle-system-resource");
        store.update((draft) => {
          draft.system.battleSystemResourceId = emptyToUndefined(value);
        }, { scope: "system" });
      }, "db-field-battle-system-resource"),
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
    ]),
    rm2k3Fieldset("선택 적 그룹 미리보기", [
      readonlyValue("이름", selectedTroop?.name ?? "(없음)"),
      readonlyValue("멤버", String(selectedTroop?.members?.length ?? selectedTroop?.enemyIds.length ?? 0)),
      readonlyValue("배경", selectedTroop?.previewBackgroundResourceId ?? DEFAULT_BATTLE_FIELD_BACKGROUND_ID),
    ]),
    rm2k3Fieldset("적 그룹 목록", project.database.troops.slice(0, 8).map((troop, index) => {
      const memberCount = troop.members?.length ?? troop.enemyIds.length;
      return readonlyValue(ordinalLabel(index), `${troop.name} / 적 ${memberCount}개`);
    })),
    rm2k3Fieldset("RM2003 배치 규칙", [
      readonlyValue("적", "x/y/숨김 멤버는 적 그룹에서 편집"),
      readonlyValue("배경", "적 그룹 배경 → 지형 전투 배경 → 기본 전장 (System2 게이지 시트 제외)"),
      readonlyValue("배치 편집", "적 그룹 멤버 위치는 적 그룹에서 편집"),
    ]),
  );
  host.append(el("h3", { text: "전투 화면" }), form);
}

export function renderBattleCommandsTab(host: HTMLElement): void {
  const project = store.getCurrent();
  const commands = project.database.battleCommands ?? [];
  const form = el("section", { class: "db-detail-form db-parity-form", dataset: { testid: "db-detail-form" } });
  form.append(
    rm2k3Fieldset("전투 명령", [
      readonlyValue("편집 위치", "RM2003 데이터베이스 > 전투 명령"),
      readonlyValue("레코드", countText(commands.length)),
      readonlyValue("저장 위치", "database.battleCommands"),
    ]),
    rm2k3Fieldset("전체 명령 목록", commands.length > 0 ? battleCommandEditorRows(commands) : [readonlyValue("0001", "전투 명령 없음")]),
    rm2k3Fieldset("직업 연결", [
      readonlyValue("직업 수", countText(project.database.classes.length)),
      readonlyValue("직업별", "classes[].battleCommands가 이 명령 의미를 참조"),
      readonlyValue("명령 종류", "attack / skill / defend / item / escape / event"),
    ]),
  );
  host.append(el("h3", { text: "전투 명령" }), form);
}

export function renderBattlerAnimationsTab(host: HTMLElement): void {
  const battlerAnimations = store.getCurrent().database.battlerAnimations ?? [];
  const form = el("section", { class: "db-detail-form db-parity-form", dataset: { testid: "db-detail-form" } });
  form.append(
    rm2k3Fieldset("배틀러 애니메이션", [
      readonlyValue("편집 위치", "RM2003 데이터베이스 > 애니메이션 2"),
      readonlyValue("레코드", countText(battlerAnimations.length)),
      readonlyValue("분리 대상", "전투 효과 애니메이션"),
      runtimeUnlinkedNotice(),
    ]),
    rm2k3Fieldset(
      "포즈 세트",
      battlerAnimations.length > 0
        ? battlerAnimationEditorRows(battlerAnimations)
        : [readonlyValue("0001", "배틀러 포즈 세트 없음")],
    ),
    rm2k3Fieldset("RM2003 포즈 범위", [
      readonlyValue("대기", "서기/대기 포즈"),
      readonlyValue("행동", "공격/스킬/아이템 포즈"),
      readonlyValue("피해", "피격/전투불능/회피 포즈"),
    ]),
  );
  host.append(el("h3", { text: "배틀러 애니메이션" }), form);
}

function runtimeUnlinkedNotice(): HTMLElement {
  return el("div", {
    class: "db-readonly-row db-runtime-unlinked-notice",
    dataset: { testid: "db-battler-animations-runtime-note" },
    children: [
      el("span", { text: "런타임 연결" }),
      el("strong", { text: "미연결 — 전투는 생성 배틀 시트(3열 포즈)로 렌더한다. 이 탭의 데이터는 RM2003 호환 편집용이다." }),
    ],
  });
}

function battlerAnimationEditorRows(animations: readonly BattlerAnimationRecord[]): HTMLElement[] {
  return animations.slice(0, 10).flatMap((animation, index) => [
    utilityTextRow({
      label: ordinalLabel(index),
      onFocus: () => selectUtilityRecord("battlerAnimations", index),
      onInput: (value) => updateBattlerAnimation(index, { name: value }),
      testid: `db-field-battler-animation-name-${index}`,
      value: animation.name,
    }),
    utilityTextRow({
      label: "배틀러 그래픽",
      onFocus: () => selectUtilityRecord("battlerAnimations", index),
      onInput: (value) => updateBattlerAnimation(index, { resourceId: emptyToUndefined(value) }),
      testid: `db-field-battler-animation-resource-${index}`,
      value: animation.resourceId ?? "",
    }),
    utilityNumberRow({
      label: "대기 1프레임",
      onFocus: () => selectUtilityRecord("battlerAnimations", index),
      onInput: (value) => updateBattlerPoseDuration(index, "idle", value),
      testid: `db-field-battler-animation-idle-duration-${index}`,
      value: poseFirstDuration(animation, "idle"),
    }),
    utilityNumberRow({
      label: "공격 1프레임",
      onFocus: () => selectUtilityRecord("battlerAnimations", index),
      onInput: (value) => updateBattlerPoseDuration(index, "attack", value),
      testid: `db-field-battler-animation-attack-duration-${index}`,
      value: poseFirstDuration(animation, "attack"),
    }),
    readonlyValue("포즈", animation.poses.map((pose) => `${pose.pose}:${pose.frames.length}`).join(" / ")),
  ]);
}

function poseFirstDuration(animation: BattlerAnimationRecord, pose: BattlerAnimationPoseKind): number {
  return animation.poses.find((entry) => entry.pose === pose)?.frames[0]?.durationMs ?? 180;
}

function updateBattlerAnimation(index: number, patch: Partial<Pick<BattlerAnimationRecord, "name" | "resourceId">>): void {
  recordCoalescedSnapshot(`db-utility:battler-animation:${index}:${Object.keys(patch).sort().join(",")}`);
  store.update((project) => {
    const target = project.database.battlerAnimations?.[index];
    if (!target) return;
    if (patch.name !== undefined) target.name = patch.name;
    if ("resourceId" in patch) target.resourceId = patch.resourceId;
  }, { scope: "database", collection: "battlerAnimations" });
}

function updateBattlerPoseDuration(index: number, poseKind: BattlerAnimationPoseKind, value: number): void {
  recordCoalescedSnapshot(`db-utility:battler-animation-pose:${index}:${poseKind}`);
  store.update((project) => {
    const target = project.database.battlerAnimations?.[index];
    if (!target) return;
    let pose = target.poses.find((entry) => entry.pose === poseKind);
    if (!pose) {
      pose = { pose: poseKind, frames: [{ pattern: 0, durationMs: 180 }] };
      target.poses = [...target.poses, pose];
    }
    if (pose.frames.length === 0) pose.frames = [{ pattern: 0, durationMs: 180 }];
    const firstFrame = pose.frames[0];
    if (!firstFrame) return;
    firstFrame.durationMs = Math.max(1, Math.trunc(value));
  }, { scope: "database", collection: "battlerAnimations" });
}

function terrainEditorRows(terrains: readonly DatabaseTerrainRecord[]): HTMLElement[] {
  // 레코드마다 래퍼 div로 감싸 grid-column:1/-1 을 부여한다 — 그렇지 않으면 필드(9개, 홀수)가
  // 부모 2열 그리드에 flat하게 흘러 들어가 레코드 경계 없이 다음 레코드 필드와 뒤섞였다(P9).
  return terrains.map((terrain, index) => el("div", {
    class: "db-terrain-record",
    dataset: { testid: `db-terrain-record-${index}` },
    children: terrainRecordFields(terrain, index),
  }));
}

function terrainRecordFields(terrain: DatabaseTerrainRecord, index: number): HTMLElement[] {
  return [
    utilityTextRow({ label: ordinalLabel(index), value: terrain.name, testid: `db-field-terrain-name-${index}`, onFocus: () => selectUtilityRecord("terrain", index), onInput: (value) => {
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
    utilityTextRow({ label: "전투 배경", value: terrain.battleBackgroundResourceId ?? "", testid: `db-field-terrain-backdrop-${index}`, onFocus: () => selectUtilityRecord("terrain", index), onInput: (value) => {
      recordCoalescedSnapshot(`db-utility:terrain:${index}:backdrop`);
      store.update((project) => {
        const target = project.database.terrains?.[index];
        if (target) target.battleBackgroundResourceId = emptyToUndefined(value);
      });
    } }),
    utilityTextRow({ label: "발소리", value: terrain.footstepSoundResourceId ?? "", testid: `db-field-terrain-footstep-${index}`, onFocus: () => selectUtilityRecord("terrain", index), onInput: (value) => {
      recordCoalescedSnapshot(`db-utility:terrain:${index}:footstep`);
      store.update((project) => {
        const target = project.database.terrains?.[index];
        if (target) target.footstepSoundResourceId = emptyToUndefined(value);
      });
    } }),
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

function battleCommandEditorRows(commands: readonly DatabaseBattleCommandRecord[]): HTMLElement[] {
  const kinds: readonly ClassBattleCommandKind[] = ["attack", "skill", "skillSubset", "defend", "guard", "item", "escape", "switch", "event"];
  return commands.flatMap((command, index) => [
    utilityTextRow({ label: ordinalLabel(index), value: command.name, testid: `db-field-battle-command-name-${index}`, onFocus: () => selectUtilityRecord("battleCommands", index), onInput: (value) => {
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
    utilityTextRow({ label: "스킬", value: command.skillId ?? "", testid: `db-field-battle-command-skill-${index}`, onFocus: () => selectUtilityRecord("battleCommands", index), onInput: (value) => {
      recordCoalescedSnapshot(`db-utility:battle-command:${index}:skill`);
      store.update((project) => {
        const target = project.database.battleCommands?.[index];
        if (target) target.skillId = emptyToUndefined(value);
      });
    } }),
  ]);
}
