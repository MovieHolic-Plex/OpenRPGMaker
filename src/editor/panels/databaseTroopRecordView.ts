// 적 그룹(troops) 탭 상세 폼 — 2026-08 모던 개편.
//
// 이전 구조는 RM2003 창을 픽셀 단위로 흉내 낸 1048×554 고정 캔버스였다. 감사에서 잡힌
// 문제는 전부 그 고정 캔버스에서 나왔다:
//   - 멤버 목록/적 팔레트가 "배치" fieldset 위로 겹쳐 그려지고 Y 입력이 통째로 잘림
//     (.db-troop-member-list 가 170px×170px 3행 고정 격자인데 자식은 4개였다)
//   - 액션 버튼이 클래스 없는 raw <button> 이라 `.db-troops-classic-workbench button`
//     블랭킷 규칙 하나만 먹었고, 추가/삭제/지우기/정렬/예시 배치 다섯 개가 전부 같은
//     전폭 회색 상자로 세로로 쌓였다(위계 0, 삭제도 안 붉음)
//   - 난이도 추정 버튼이 519px 전폭 바(fullBleed)
//
// 이제 공용 워크스페이스 프리미티브(sectionCard/listToolbar/statStrip/emptyState)로
// 다시 짓는다. 레이아웃은 studio-theme.css 가 `.db-troops-classic-workbench` 에 박아 둔
// 영역 맵(top / preview·events / members·events / balance·events)을 그대로 채운다 —
// 자식이 다섯이고 이름도 다섯이라 암묵 트랙으로 밀려나는 사고가 재발하지 않는다.
//
// 테스트 계약(유지): db-troops-classic-workbench, .db-troop-top-controls >
// .db-troop-classic-panel(마지막이 설정), .db-troop-radio input[value=manual|automatic],
// .db-troop-member-rows .db-troop-member-row(+.empty), db-troop-member-row-N 의
// "X{x} Y{y}" 텍스트, db-troop-preview-stage, db-troop-member-sprite-N, 필드 testid 전부.

import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { switchDatabaseActiveTab } from "@/editor/panels/database";
import { setSelectedRecordId } from "@/editor/panels/databaseRecordViewSession";
import { emptyToUndefined, numberField, selectField, textField } from "@/editor/panels/databaseControls";
import { resourcePickerControl } from "@/editor/panels/databaseResourcePickerDialog";
import { requestDatabaseModalClose } from "@/editor/panels/databaseModal";
import { renderTroopBattleEventPanel } from "@/editor/panels/databaseTroopBattleEventPanel";
import {
  emptyState,
  listToolbar,
  sectionCard,
  statStrip,
  type ToolbarAction,
} from "@/editor/panels/databaseWorkspace";
import { openTroopBattleTestModal } from "@/editor/panels/testPlayModal";
import { store } from "@/project/store";
import type { EnemyRecord, TroopMemberRecord, TroopRecord } from "@/project/types";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";
import { classicEnemyFormation } from "@/battle/battleBattlers";
import { BATTLE_SKINS, resolveSkinId } from "@/battle/skins/registry";
import { BATTLER_PLACEMENTS, resolveSkinEnemyPositions } from "@/battle/battlerPlacements";
import type { BattleSkinId } from "@/battle/skins/types";
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
      class: "db-troops-classic-workbench db-troop-studio",
      dataset: { testid: "db-troops-classic-workbench" },
      children: [
        topControls(record, rerender),
        troopBattlePreview(record, selectedIndex, rerender),
        memberEditor(record, member, selectedIndex, selectedEnemy, rerender),
        balancePanel(record),
        // 지형 패널은 두 겹으로 죽어 있었다 — troops.part-2.css 가 display:none 으로 감추고,
        // 체크박스는 전부 `input.disabled = true` 였다. 만들어서 스타일까지 먹인 뒤 버리는
        // 셈이라 아예 렌더하지 않는다(되살리려면 git 이력에 그대로 있다). 전투 배경은
        // 지형 레코드에서 오므로 "지형 배경" 카드가 그 역할을 대신한다.
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

// ---------------------------------------------------------------------------
// 상단 스트립 — 이름 카드 + 설정 카드
//
// `.db-troop-top-controls > .db-troop-classic-panel` 의 **마지막**이 설정 패널이라는 건
// qa-troops.spec.ts:79 의 계약이다. 카드 두 장 순서를 바꾸지 말 것.
// ---------------------------------------------------------------------------

function topControls(record: TroopRecord, rerender: () => void): HTMLElement {
  return el("section", {
    class: "db-troop-top-controls",
    dataset: { testid: "db-troop-top-controls" },
    children: [identityPanel(record, rerender), configurationPanel(record, rerender)],
  });
}

function identityPanel(record: TroopRecord, rerender: () => void): HTMLElement {
  const nameField = textField("이름", "db-field-name", record.name, (name) => {
    updateDatabaseRecord("troops", record.id, { name });
    // troops는 databaseRecordViews.ts의 공용 nameField(onRename→updateRecordRowLabel)
    // 경로에서 제외되고(databaseAdvancedRecordViews.ts가 troops를 자체 폼으로 위임)
    // 이 필드가 자체 textField를 쓴다 — 타이핑 중에는 포커스 유지를 위해 전체
    // rerender를 부르지 않으므로, 다른 탭처럼 좌측 리스트 행만 직접 갱신한다
    // (qa-troops-report.md m5).
    updateTroopRowLabel(record.id, name);
  });

  const actions: ToolbarAction[] = [
    {
      label: "전투 테스트",
      kind: "primary",
      testid: "db-troop-battle-test",
      title: "이 적 그룹으로 즉시 전투를 돌려 봅니다",
      onClick: () => {
        // DOM을 직접 뜯어내지 않는다 — openDatabaseModal이 등록한 document keydown
        // 리스너 2개가 정리되지 않고 새는 문제(M11)가 있었다. 훅을 통해 정식 close()를
        // 태운다(읽기 행위라 dirty 확인/discard 없이 즉시 닫힘 — 자동 저장이라 안전).
        requestDatabaseModalClose("battleTest");
        void openTroopBattleTestModal(record.id);
      },
    },
    {
      label: "이름 생성",
      testid: "db-troop-generate-name",
      title: "배치한 적 이름을 이어 붙여 그룹 이름을 만듭니다",
      onClick: () => {
        // 사람이 쓴 이름을 즉시 덮어쓴다. updateDatabaseRecord 가 스냅샷을 남기므로 되돌릴
        // 수는 있지만, 그 사실을 알리지 않으면 저작물이 조용히 사라진 것처럼 보인다.
        const previous = record.name;
        const next = generatedTroopName(record);
        updateDatabaseRecord("troops", record.id, { name: next });
        toast(`이름을 "${next}"로 바꿨습니다 (이전 "${previous}") — Ctrl+Z로 되돌릴 수 있습니다.`, "ok");
        rerender();
      },
    },
    {
      // 라벨은 e2e 계약이다(oprn-database-battle-records.spec.ts 가 "배경 변경" 을 요구).
      // "차례로 넘긴다"는 사실은 title 과 아래 토스트가 말한다.
      label: "배경 변경",
      testid: "db-troop-change-background",
      title: "지형 레코드에 등록된 전투 배경을 차례로 넘깁니다",
      onClick: () => {
        updateDatabaseRecord("troops", record.id, { previewBackgroundResourceId: nextBattleBackground(record.previewBackgroundResourceId) });
        toast("전투 배경을 다음 것으로 넘겼습니다 — Ctrl+Z로 되돌릴 수 있습니다.", "ok");
        rerender();
      },
    },
  ];

  return studioCard({
    title: "이름",
    hint: "좌측 목록과 이벤트 명령에서 이 이름으로 표시됩니다.",
    children: [nameField, listToolbar(actions)],
    testid: "db-troop-identity-card",
    extraClass: "db-troop-card-identity",
  });
}

function configurationPanel(record: TroopRecord, rerender: () => void): HTMLElement {
  return studioCard({
    title: "설정",
    hint: "배치 방식과 전투 판정 규칙입니다.",
    children: [
      el("div", {
        class: "db-troop-config-grid",
        children: [
          el("div", {
            class: "db-troop-radio-group",
            attrs: { role: "radiogroup", "aria-label": "배치 방식" },
            children: [
              el("span", { class: "db-troop-field-label", text: "배치 방식" }),
              el("div", {
                class: "db-troop-radio-pills",
                children: [
                  radioField("수동", "manual", !record.autoAlign, () => {
                    updateDatabaseRecord("troops", record.id, { autoAlign: false });
                    rerender();
                  }),
                  radioField("자동", "automatic", record.autoAlign === true, () => {
                    updateDatabaseRecord("troops", record.id, { autoAlign: true, members: arrangeMembers(record.members ?? []) });
                    rerender();
                  }),
                ],
              }),
            ],
          }),
          activeSlotsField(record, rerender),
        ],
      }),
      el("div", {
        class: "db-troop-check-row",
        children: [trainerBattleField(record, rerender), uncapturableField(record, rerender)],
      }),
    ],
    testid: "db-troop-config-card",
    extraClass: "db-troop-card-config",
  });
}

// ---------------------------------------------------------------------------
// 밸런스 — 보상 롤업 + 난이도 추정
// ---------------------------------------------------------------------------

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
    if (rewards.dropItemId && rewards.dropRatePercent > 0) dropItemIds.add(rewards.dropItemId);
  }

  // 롤업은 타일 세 장으로 나눈다. 예전엔 "총 경험치 5 / 총 돈 4 / 드롭 후보 1종" 한 줄
  // 문자열이라 훑어볼 수 없었다. testid 는 회귀 추적용으로 그대로 유지한다.
  const rollup = statStrip(
    [
      { label: "총 경험치", value: String(exp), hint: "숨김 멤버 제외", testid: "db-troop-reward-exp" },
      { label: "총 돈", value: String(gold), hint: "숨김 멤버 제외", testid: "db-troop-reward-gold" },
      { label: "드롭 후보", value: `${dropItemIds.size}종`, testid: "db-troop-reward-drops" },
    ],
    { testid: "db-troop-reward-rollup" }
  );

  const result = el("div", {
    class: "db-ws-readout db-troop-sim-result",
    dataset: { testid: "db-troop-sim-result" },
    text: "난이도 미추정",
  });
  const heroLevel = troopSimLevels.get(record.id) ?? 5;
  const levelField = numberField("파티 레벨", "db-troop-sim-level", heroLevel, (value) => troopSimLevels.set(record.id, value), { min: 1, max: 99 });
  const hasMembers = (record.members ?? []).length > 0;
  const runRow = listToolbar([
    {
      label: "난이도 추정",
      kind: "primary",
      testid: "db-troop-sim-run",
      disabled: !hasMembers,
      title: hasMembers ? "10회 시뮬레이션으로 승률을 추정합니다" : "멤버를 추가하면 추정할 수 있습니다",
      // 20 샘플은 클릭→결과 561ms(실측)로 UI 를 눈에 띄게 멈춰 세웠다 — 10 샘플로 낮추고
      // "추정 중…" 이 실제로 그려지도록 한 프레임 양보한 뒤 계산한다(워커로 옮기지 않는다).
      onClick: () => {
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
            result.textContent = `10회 표본 · 승률 ${Math.round(outcome.winRate * 100)}% · 평균 ${outcome.avgTurns.toFixed(1)}턴 · 잔여 HP ${Math.round(outcome.avgHpRemaining)}`;
          } catch (error) {
            result.textContent = `추정 불가: ${error instanceof Error ? error.message : String(error)}`;
          }
        };
        if (typeof requestAnimationFrame === "function") requestAnimationFrame(run);
        else run();
      },
    },
  ]);

  return studioCard({
    title: "밸런스",
    hint: "보상 합계와 예상 난이도입니다.",
    children: [
      rollup,
      el("div", { class: "db-troop-sim-row", children: [levelField, runRow] }),
      result,
    ],
    testid: "db-troop-balance-card",
    extraClass: "db-troop-panel-balance",
  });
}

// ---------------------------------------------------------------------------
// 멤버 편집기
// ---------------------------------------------------------------------------

function memberEditor(
  record: TroopRecord,
  member: TroopMemberRecord,
  selectedIndex: number,
  selectedEnemy: EnemyRecord | undefined,
  rerender: () => void
): HTMLElement {
  const members = record.members ?? [];
  const enemies = store.getCurrent().database.enemies;
  const hasEnemies = enemies.length > 0;

  const actions: ToolbarAction[] = [
    {
      label: "＋ 추가",
      kind: "primary",
      testid: "db-troop-member-add",
      disabled: !hasEnemies,
      title: hasEnemies ? "선택한 적을 새 슬롯으로 배치합니다" : "먼저 몬스터 탭에서 적을 만드세요",
      onClick: () => {
        const nextEnemyId = selectedEnemy?.id ?? store.getCurrent().database.enemies[0]?.id ?? "";
        if (!nextEnemyId) return;
        const nextMembers = [...(record.members ?? []), positionedMember(nextEnemyId, record.members?.length ?? 0)];
        selectedMemberIndexes.set(record.id, nextMembers.length - 1);
        updateDatabaseRecord("troops", record.id, { members: nextMembers });
        rerender();
      },
    },
    {
      label: "정렬",
      testid: "db-troop-member-arrange",
      disabled: members.length === 0,
      title: "고전 진형 좌표로 다시 줄 세웁니다",
      onClick: () => {
        updateDatabaseRecord("troops", record.id, { autoAlign: true, members: arrangeMembers(record.members ?? []) });
        rerender();
      },
    },
    // 라벨은 사용자에게 보인다 — 타사 제품명을 쓰지 않는다(2026-08-21).
    // testid 는 e2e 계약이라 유지하고, 식별자 개명은 별도 라운드에서 다룬다.
    {
      label: "예시 배치",
      testid: "db-troop-member-rm2003-preset",
      disabled: !hasEnemies,
      title: "슬라임 2 + 벌 2 의 견본 진형으로 덮어씁니다",
      onClick: () => {
        const nextMembers = rm2003ExampleMembers();
        if (nextMembers.length === 0) return;
        selectedMemberIndexes.set(record.id, 0);
        updateDatabaseRecord("troops", record.id, { autoAlign: false, members: nextMembers });
        rerender();
      },
    },
    {
      label: "삭제",
      // 이 탭에는 "삭제" 가 3 개(적 그룹 · 적 슬롯 · 전투 이벤트 페이지)라 접근명으로는
      // 구분되지 않았다. 보이는 글자는 좁은 툴바에 맞춰 두고 접근명만 구체화한다.
      ariaLabel: "선택한 적 슬롯 삭제",
      kind: "danger",
      testid: "db-troop-member-delete",
      disabled: members.length === 0,
      title: "선택한 슬롯 하나만 지웁니다 (Ctrl+Z 로 복구)",
      onClick: () => {
        const nextMembers = (record.members ?? []).filter((_, index) => index !== selectedIndex);
        selectedMemberIndexes.set(record.id, Math.max(0, Math.min(selectedIndex, nextMembers.length - 1)));
        updateDatabaseRecord("troops", record.id, { members: nextMembers });
        rerender();
      },
    },
    {
      label: "전체 지우기",
      kind: "danger",
      testid: "db-troop-member-clear",
      disabled: members.length === 0,
      title: "이 그룹의 배치를 전부 비웁니다 (Ctrl+Z 로 복구)",
      onClick: () => {
        selectedMemberIndexes.set(record.id, 0);
        updateDatabaseRecord("troops", record.id, { members: [] });
        rerender();
      },
    },
  ];

  const roster = el("div", {
    class: "db-troop-roster",
    children: [
      el("span", { class: "db-troop-field-label", text: `배치한 적 ${members.length}` }),
      memberRows(record, selectedIndex, rerender),
      listToolbar(actions),
    ],
  });

  const inspector = el("div", {
    class: "db-troop-member-inspector",
    children: [
      el("span", { class: "db-troop-field-label", text: members.length > 0 ? `선택 슬롯 #${selectedIndex + 1}` : "선택 슬롯" }),
      ...(members.length > 0
        ? [
          selectField("적", "db-picker-troop-member-enemy", member.enemyId, enemies, (enemyId) => {
            updateSelectedMember(record, selectedIndex, enemyId ? { ...member, enemyId } : undefined);
            rerender();
          }),
          openEnemyButton(member.enemyId),
          el("div", {
            class: "db-troop-xy-row",
            children: [
              numberField("X", "db-field-troop-member-x", member.x, (x) => {
                updateSelectedMember(record, selectedIndex, { ...member, x });
                rerender();
              }),
              numberField("Y", "db-field-troop-member-y", member.y, (y) => {
                updateSelectedMember(record, selectedIndex, { ...member, y });
                rerender();
              }),
            ],
          }),
          checkboxField("숨김 (등장 연출 전까지 숨김)", "db-field-troop-member-hidden", member.hidden ?? false, (hidden) => {
            updateSelectedMember(record, selectedIndex, { ...member, hidden });
            rerender();
          }),
        ]
        : [
          el("p", {
            class: "db-troop-inspector-hint",
            text: "슬롯을 추가하면 여기서 적 종류와 X·Y 좌표를 조정할 수 있습니다.",
          }),
        ]),
    ],
  });

  return el("section", {
    class: "db-troop-member-editor",
    dataset: { testid: "db-troop-member-editor" },
    children: [
      studioCard({
        title: "적 배치",
        hint: "미리보기의 스프라이트를 눌러도 슬롯이 선택됩니다.",
        children: [el("div", { class: "db-troop-member-columns", children: [roster, inspector] })],
        testid: "db-troop-member-card",
        extraClass: "db-troop-card-members",
      }),
      studioCard({
        title: "적 팔레트",
        hint: "누르면 선택 슬롯의 적이 바뀝니다.",
        children: [enemyList(record, selectedIndex, selectedEnemy?.id ?? member.enemyId, rerender)],
        testid: "db-troop-enemy-palette-card",
        extraClass: "db-troop-card-palette",
      }),
      studioCard({
        title: "지형 배경",
        hint: "지형 레코드에 등록된 전투 배경 중에서 고릅니다.",
        children: [
          resourcePickerControl({
            label: "배경",
            resourceId: record.previewBackgroundResourceId,
            kind: "backdrop",
            testid: "db-field-troop-backdrop",
            queueKey: `troop-backdrop:${record.id}`,
            dialogTitle: "전투 배경",
            allowClear: true,
            onChange: (result) => {
              updateDatabaseRecord("troops", record.id, { previewBackgroundResourceId: emptyToUndefined(result.resourceId) });
            },
            rerender,
          }),
        ],
        testid: "db-troop-backdrop-card",
        extraClass: "db-troop-card-backdrop",
      }),
    ],
  });
}

// ---------------------------------------------------------------------------
// 미리보기 무대
// ---------------------------------------------------------------------------

function troopBattlePreview(record: TroopRecord, selectedIndex: number, rerender: () => void): HTMLElement {
  const project = store.getCurrent();
  const skinId = resolveSkinId(project.system.battleUiStyle);
  const layout = BATTLE_SKINS[skinId]?.layout;
  const members = record.members ?? [];
  const positions = resolveSkinEnemyPositions(
    skinId,
    members.map((member) => ({ x: member.x, y: member.y })),
    record.autoAlign,
  );
  const sprites = members.map((member, index) => {
    const enemy = project.database.enemies.find((entry) => entry.id === member.enemyId);
    const skinPos = positions[index] ?? { x: 160, y: 96 };
    const sprite = enemySprite(enemy, member, skinPos, record.id, index, index === selectedIndex, rerender);
    sprite.dataset.memberIndex = String(index);
    return sprite;
  });
  const children = sprites.length > 0 ? sprites : [el("span", { class: "db-troop-empty-member", text: "(없음)" })];
  const stage = el("div", {
    class: "db-troop-battle-preview-stage",
    dataset: { testid: "db-troop-preview-stage" },
    children: layout === "sideview" || layout === "active"
      ? [recenterGuideLine(), ...partyMarkers(skinId), ...children]
      : [...partyMarkers(skinId), ...children],
  });
  const backgroundUrl = resolveAssetResourceUrl(record.previewBackgroundResourceId, { project });
  if (backgroundUrl) {
    stage.style.backgroundImage = `linear-gradient(180deg, rgba(128, 184, 232, 0.18), rgba(85, 161, 61, 0.12)), url("${cssUrl(backgroundUrl)}")`;
  }

  const card = studioCard({
    title: "배치 미리보기",
    hint: previewHint(record, skinId),
    children: [
      stage,
      el("div", { class: "db-troop-preview-caption", dataset: { testid: "db-troop-preview-caption" }, text: previewCaption(record) }),
      el("div", {
        class: "db-troop-preview-legend",
        children:
          layout === "sideview" || layout === "active"
            ? [
              legendChip("db-troop-legend-party", "① ~ ④ 아군 진형 (읽기 전용)"),
              legendChip("db-troop-legend-recenter", "점선 = 재배치 경계 (x > 150)"),
            ]
            : [
              legendChip("db-troop-legend-party", "현재 전투 스킨 기준 배치 미리보기"),
              ...(manualDivergenceCount(record, skinId) > 0
                ? [legendChip("db-troop-legend-recenter", "표시 위치가 저작 좌표와 다릅니다")]
                : []),
            ],
      }),
    ],
    testid: "db-troop-preview-card",
    extraClass: "db-troop-preview-panel",
  });
  return card;
}

function previewHint(record: TroopRecord, skinId: string): string {
  if (record.autoAlign) return `현재 전투 스킨(${skinId})의 자동 진형으로 싸웁니다.`;
  return `수동 배치 · ${skinId} 스킨의 실제 표시 위치입니다.`;
}

function legendChip(className: string, text: string): HTMLElement {
  return el("span", { class: `db-troop-legend-chip ${className}`, text });
}

const RECENTER_THRESHOLD_X = 150;

/** 런타임 재배치 경계(x>150)를 저작자가 볼 수 있게 표시한다. */
function recenterGuideLine(): HTMLElement {
  const line = el("div", { class: "db-troop-preview-recenter-line", dataset: { testid: "db-troop-preview-recenter-line" } });
  line.style.left = `${(RECENTER_THRESHOLD_X / 320) * 100}%`;
  line.title = "이 선을 넘는 적은 전투에서 좌측 진형으로 재배치됩니다";
  return line;
}

/** 아군 진형 읽기 전용 마커. 적 스프라이트와 같은 0..160 표시 공간에 둔다. */
function partyMarkers(skinId: BattleSkinId): HTMLElement[] {
  return [0, 1, 2, 3].map((index) => {
    const seat = BATTLER_PLACEMENTS[skinId].party(index, 4);
    const marker = el("div", {
      class: "db-troop-preview-party-marker",
      dataset: { testid: `db-troop-preview-party-marker-${index + 1}` },
      text: String(index + 1),
    });
    marker.style.setProperty("--troop-marker-x", `${(Math.max(0, Math.min(320, seat.x)) / 320) * 100}%`);
    marker.style.setProperty("--troop-marker-y", `${(Math.max(0, Math.min(160, seat.y)) / 160) * 100}%`);
    marker.title = "아군 진형 위치(읽기 전용)";
    return marker;
  });
}

function manualDivergenceCount(record: TroopRecord, skinId: BattleSkinId): number {
  if (record.autoAlign) return 0;
  const members = record.members ?? [];
  const positions = resolveSkinEnemyPositions(
    skinId,
    members.map((member) => ({ x: member.x, y: member.y })),
    false,
  );
  return members.filter((member, index) => {
    if (member.x == null || !Number.isFinite(member.x)) return false;
    const rendered = positions[index]?.x;
    if (rendered == null) return false;
    return Math.abs(rendered - member.x) >= 1;
  }).length;
}

function enemySprite(
  enemy: EnemyRecord | undefined,
  member: TroopMemberRecord,
  skinPos: { readonly x: number; readonly y: number },
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
  canvas.style.left = `${(Math.max(0, Math.min(320, skinPos.x)) / 320) * 100}%`;
  canvas.style.top = `${(Math.max(0, Math.min(160, skinPos.y)) / 160) * 100}%`;
  canvas.addEventListener("click", () => {
    selectedMemberIndexes.set(troopId, index);
    rerender();
  });
  renderChromaKeyImage(canvas, url);
  return canvas;
}

/**
 * 배치 슬롯 목록. 예전에는 적 이름만 텍스트로 찍고 좌표는 `title` 속성에만 넣어서,
 * 좌표를 보려면 마우스를 올려 기다려야 했다(그리고 qa-troops.spec 이 기대하는
 * "X200 Y80" 은 텍스트에 없었다). 이제 번호·이름·좌표를 한 줄에 같이 보여준다.
 */
function memberRows(record: TroopRecord, selectedIndex: number, rerender: () => void): HTMLElement {
  const project = store.getCurrent();
  const members = record.members ?? [];
  const children =
    members.length > 0
      ? members.map((member, index) => {
          const enemy = project.database.enemies.find((entry) => entry.id === member.enemyId);
          const enemyName = enemy?.name ?? member.enemyId;
          const coords = `X${member.x} Y${member.y}`;
          return el("button", {
            class: `db-troop-member-row${index === selectedIndex ? " active" : ""}${member.hidden ? " is-hidden-member" : ""}`,
            attrs: { type: "button", title: `${index + 1} · ${enemyName} · ${coords}`, "aria-pressed": index === selectedIndex ? "true" : "false" },
            dataset: { testid: `db-troop-member-row-${index + 1}` },
            children: [
              el("span", { class: "db-troop-member-index", text: String(index + 1) }),
              el("span", { class: "db-troop-member-name", text: enemyName || "(적 없음)" }),
              ...(member.hidden ? [el("span", { class: "db-troop-member-flag", text: "숨김" })] : []),
              el("span", { class: "db-troop-member-coords", text: coords }),
            ],
            on: {
              click: () => {
                selectedMemberIndexes.set(record.id, index);
                rerender();
              },
            },
          });
        })
      : [
        // `.db-troop-member-row.empty` 는 qa-troops.spec.ts:193 계약이라 클래스를 유지한다.
        el("div", {
          class: "db-troop-member-row empty",
          children: [
            emptyState({
              icon: "◇",
              title: "배치한 적이 없음",
              body: "‘＋ 추가’ 를 누르면 선택한 적이 진형에 놓입니다.",
              compact: true,
              testid: "db-troop-member-empty",
            }),
          ],
        }),
      ];
  return el("div", { class: "db-troop-member-rows", dataset: { testid: "db-troop-member-rows" }, children });
}

function enemyList(record: TroopRecord, selectedIndex: number, selectedEnemyId: string, rerender: () => void): HTMLElement {
  const enemies = store.getCurrent().database.enemies;
  if (enemies.length === 0) {
    return emptyState({
      icon: "☠",
      title: "등록된 적이 없습니다",
      body: "몬스터 탭에서 적을 먼저 만들면 여기에 나타납니다.",
      compact: true,
      testid: "db-troop-enemy-empty",
    });
  }
  return el("div", {
    class: "db-troop-enemy-list",
    dataset: { testid: "db-troop-enemy-list" },
    children: enemies.map((enemy) =>
      el("button", {
        class: `db-troop-enemy-row${enemy.id === selectedEnemyId ? " active" : ""}`,
        attrs: { type: "button", title: `${enemy.name} (${enemy.id})`, "aria-pressed": enemy.id === selectedEnemyId ? "true" : "false" },
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

// ---------------------------------------------------------------------------
// 설정 필드
// ---------------------------------------------------------------------------

function activeSlotsField(record: TroopRecord, rerender: () => void): HTMLElement {
  const field = numberField("아군 인원 (0=기본)", "db-field-troop-active-slots", record.activeSlots ?? 0, (activeSlots) => {
    updateDatabaseRecord("troops", record.id, { activeSlots: optionalPositiveInteger(activeSlots) });
    rerender();
  });
  const system = store.getCurrent().system;
  field.title = `동시 참전할 아군 수입니다. 0이면 시스템 설정 사용: ${system.activeSlots ?? (system.battleModel === "gen1" ? 1 : "파티 전원")}.`;
  field.append(el("small", { class: "db-ws-usage", text: record.activeSlots ? `${record.activeSlots}명 지정` : `기본: ${system.activeSlots ?? (system.battleModel === "gen1" ? 1 : "파티 전원")}` }));
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

function trainerBattleField(record: TroopRecord, rerender: () => void): HTMLElement {
  const field = checkboxField("트레이너 전투", "db-field-troop-trainer-battle", record.trainerBattle === true, (trainerBattle) => {
    updateDatabaseRecord("troops", record.id, { trainerBattle });
    rerender();
  });
  field.title = "야생 조우가 아닌 트레이너 전투로 판정합니다.";
  return field;
}

/**
 * `.db-troop-radio input[value=...]` 는 qa-troops.spec.ts 의 계약이라 네이티브 radio
 * 마크업을 유지한다 — 세그먼티드 알약 모양은 CSS 로만 입힌다.
 */
function radioField(label: string, value: string, checked: boolean, onChange: () => void): HTMLElement {
  const input = el("input", { attrs: { type: "radio", name: "db-troop-configuration", value } }) as HTMLInputElement;
  input.checked = checked;
  input.addEventListener("change", () => {
    if (input.checked) onChange();
  });
  return el("label", { class: `db-troop-radio${checked ? " active" : ""}`, children: [input, el("span", { text: label })] });
}

function checkboxField(label: string, testid: string, checked: boolean, onInput: (value: boolean) => void): HTMLElement {
  const input = el("input", { attrs: { type: "checkbox" }, dataset: { testid } }) as HTMLInputElement;
  input.checked = checked;
  input.addEventListener("change", () => onInput(input.checked));
  return el("label", { class: `actor-check db-troop-check${checked ? " active" : ""}`, children: [input, el("span", { text: label })] });
}

function optionalPositiveInteger(value: number): number | undefined {
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return Math.trunc(value);
}

/**
 * 공용 `sectionCard()` 에 이 탭의 레이아웃 훅(그리드 영역/레거시 클래스)을 얹는다.
 * `db-troop-classic-panel` 은 qa-troops.spec.ts:79 가 설정 패널을 찾는 선택자라 유지.
 */
function studioCard(options: {
  readonly title: string;
  readonly hint?: string;
  readonly children: readonly HTMLElement[];
  readonly testid: string;
  readonly extraClass: string;
}): HTMLElement {
  const card = sectionCard({
    title: options.title,
    hint: options.hint,
    children: options.children,
    testid: options.testid,
  });
  card.classList.add("db-troop-classic-panel", "db-troop-card", options.extraClass);
  return card;
}

function selectedMemberIndex(record: TroopRecord): number {
  const members = record.members ?? [];
  if (members.length === 0) return 0;
  const selected = selectedMemberIndexes.get(record.id) ?? 0;
  return Math.max(0, Math.min(selected, members.length - 1));
}

/**
 * 선택 슬롯의 적을 몬스터 탭에서 바로 연다. 거울 패턴: databaseEnemyRecordView 의
 * "종족 열기" 버튼과 동일하게 setSelectedRecordId + switchDatabaseActiveTab.
 */
function openEnemyButton(enemyId: string): HTMLElement {
  const enemy = store.getCurrent().database.enemies.find((entry) => entry.id === enemyId);
  return el("div", {
    class: "db-troop-enemy-nav-actions",
    dataset: { testid: "db-troop-enemy-nav-actions" },
    children: [
      el("button", {
        class: "db-ws-btn db-ws-btn-ghost",
        text: enemy ? `“${enemy.name}” 수정하기` : "몬스터 탭 열기",
        attrs: { type: "button", title: "몬스터 탭에서 이 적을 바로 수정합니다" },
        dataset: { testid: "db-troop-open-enemy" },
        on: {
          click: (event) => {
            if (!enemyId) return;
            const panelRoot = databasePanelRootFrom(event.currentTarget as HTMLElement | null);
            setSelectedRecordId("enemies", enemyId);
            if (!panelRoot) {
              toast("몬스터 탭에서 적을 선택했습니다", "ok");
              return;
            }
            switchDatabaseActiveTab("enemies", panelRoot);
          },
        },
      }),
    ],
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
  const terrainName = store.getCurrent().database.terrains?.find((terrain) => terrain.battleBackgroundResourceId === record.previewBackgroundResourceId)?.name;
  return `${record.name} / ${enemyNames.join(", ") || "(없음)"} / ${terrainName ?? "배경 없음"}`;
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
