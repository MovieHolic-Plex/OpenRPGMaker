// 전투 스튜디오 유틸리티 탭 — 지형 / 전투 명령. (전투 화면은 2026-10-02 databaseBattleScreenTab.ts 로 옮겨 다시 짰다.)
//
// 2026-08 DB 감사에서 이 셋이 받은 P0 는 전부 "보이는 것과 실제 범위가 다르다" 였다:
//   - 지형 C 축: 인스펙터가 인스펙터가 아니었다. 헤더는 `N개 · 선택한 지형` 이라 단일
//     레코드 범위를 암시하는데 `terrainEditorRows()` 는 선택과 무관하게 **모든** 지형을
//     스택에 쏟아부었고, 프리셋 카드를 눌러도 미리보기 무대만 바뀌었다.
//   - 전투 화면 B 축: 적 그룹 스트립이 선택 가능한 목록처럼 생겼지만 완전히 죽어 있었다
//     (click/tabindex/role/aria-pressed/hover 전무). 미리볼 그룹을 바꾸는 유일한 경로가
//     "초기 적 그룹" 셀렉트였고, 그건 동시에 system.initialTroopId 를 바꿔 버렸다.
//   - 전투 명령 B 축: CRUD 가 아예 없었다. 추가/복제/삭제/순서 변경 경로가 에디터
//     어디에도 없어(dbTools.ts 의 AI 툴만 쓴다) 전투 메뉴 순서를 사람이 못 바꿨다.
//   - P9: 아무 동작도 없는 <span> 알약 줄(옛 db-command-kind-legend).
//
// 그래서 셋 다 workspaceShell/listPane/detailPane 로 옮기고, "미리보기 선택" 과
// "게임 설정 변경" 을 분리하고, 전투 명령에 CRUD + 순서 이동을 붙였다.
//
// 테스트 계약: db-terrain-preset-gallery / db-terrain-preview-stage / db-terrain-inspector,
// db-battle-command-{preview,palette,
// inspector}, db-field-terrain-*-<i>(이름/피해/조우율은 전 레코드, 나머지는 선택 레코드),
// db-field-battle-command-*-<i>(전 레코드), db-picker-battle-*, db-open-classes-tab.
import {
  emptyToUndefined,
  numberField,
  selectLiteral,
  matchesNameOrId,
  textField,
  toggleSwitch,
} from "@/editor/panels/databaseControls";
import { attachCatalogPlacement, battleCommandPlacement } from "./databaseBattleCommandStudio";
import { battleStudioHeading } from "@/editor/panels/databaseBattleStudio";
import { resourcePickerControl } from "@/editor/panels/databaseResourcePickerDialog";
import { battleBackdropPreviewUrl, battleSceneryField, customPickerResourceId } from "@/editor/panels/battleSceneryPicker";
import { battleMethodOf } from "@/project/battleMethod";
import { recordCoalescedSnapshot, recordProjectSnapshot } from "@/editor/mapEditHistory";
export { renderElementsTab } from "@/editor/panels/databaseElementsClassic";
import {
  isBattleCommandKind,
  isTerrainDisplay,
  selectUtilityRecord,
  selectedTerrain,
  selectedUtilityRecordIndex,
  terrainVehicleText,
  utilitySelectRow,
  utilityTextRow,
} from "@/editor/panels/databaseUtilityRecordControls";
import {
  detailHero,
  detailPane,
  emptyState,
  listPane,
  listRow,
  listSearch,
  sectionCard,
  restoreFocusAfterRerender,
  statStrip,
  workspaceShell,
} from "@/editor/panels/databaseWorkspace";
import { switchDatabaseActiveTab } from "@/editor/panels/database";
import { store } from "@/project/store";
import type {
  ClassBattleCommandKind,
  DatabaseBattleCommandRecord,
  DatabaseTerrainRecord,
} from "@/project/types";
import { el } from "@/util/dom";

const BATTLE_COMMAND_KINDS: readonly ClassBattleCommandKind[] = [
  "attack", "skill", "skillSubset", "defend", "guard", "item", "capture", "escape", "switch", "event", "commonEvent",
];
/** 종류별 한 줄 설명 — 예전의 아무 동작 없는 알약 줄(P9)을 대체한다. */
const BATTLE_COMMAND_KIND_HELP: readonly { readonly label: string; readonly help: string }[] = [
  { label: "공격", help: "장비 무기로 단일 대상 통상 공격" },
  { label: "특수기능", help: "직업이 배운 스킬 전체를 목록으로" },
  { label: "특수계열", help: "이름이 일치하는 스킬 묶음만 목록으로" },
  { label: "방어", help: "이번 턴 받는 피해를 줄임" },
  { label: "방어(구형)", help: "방어와 같은 효과 — 새로 쓸 때는 방어를 고르세요" },
  { label: "아이템", help: "소지품에서 전투용 아이템 사용" },
  { label: "포획", help: "몬스터 수집이 켜진 게임에서 포획 아이템 선택" },
  { label: "도망", help: "전투 이탈 시도" },
  { label: "교체", help: "대기 중인 동료와 자리 교대" },
  { label: "교체(구형)", help: "교체와 같은 효과 — 새로 쓸 때는 교체를 고르세요" },
  { label: "공통 이벤트 실행", help: "고른 공통 이벤트를 전투 중에 실행 — 메시지·선택지·변수 조작을 그대로 쓴다" },
];

let terrainQuery = "";
let commandQuery = "";

// ---------------------------------------------------------------------------
// 지형
// ---------------------------------------------------------------------------

export function renderTerrainTab(host: HTMLElement): void {
  const terrains = store.getCurrent().database.terrains ?? [];
  const selected = selectedTerrain(terrains);
  const selectedIndex = Math.max(0, terrains.indexOf(selected as DatabaseTerrainRecord));
  const rerender = (): void => {
    host.replaceChildren();
    renderTerrainTab(host);
  };
  const form = el("section", {
    class: "db-detail-form db-parity-form db-battle-studio-surface db-terrain-studio db-ws-studio",
    dataset: { testid: "db-detail-form" },
  });
  form.append(
    battleStudioHeading(
      "terrain",
      "지형 효과",
      "그리는 타일이 아닙니다 — 발밑 칸을 밟았을 때 일어나는 일(피해·조우·전투 배경·발소리·탈것 통행)을 정합니다. 타일셋 탭에서 붙인 지형 태그 번호와 1:1로 짝을 이룹니다.",
    ),
    workspaceShell({
      list: terrainListPane(terrains, selectedIndex, rerender),
      detail: terrainDetailPane(terrains, selected, selectedIndex, rerender),
    }),
  );
  host.append(form);
}

function terrainListPane(
  terrains: readonly DatabaseTerrainRecord[],
  selectedIndex: number,
  rerender: () => void,
): HTMLElement {
  const rows: HTMLElement[] = [];
  for (const [index, terrain] of terrains.entries()) {
    if (terrainQuery && !matchesNameOrId(terrain.name, terrain.id, terrainQuery)) continue;
    rows.push(listRow({
      name: terrain.name,
      sub: `조우 ${terrain.encounterRatePercent}%`,
      number: index + 1,
      thumb: backdropThumb(terrain.battleBackgroundResourceId),
      active: index === selectedIndex,
      title: `${terrain.name} · ${terrain.id}`,
      testid: `db-terrain-preset-${index}`,
      onSelect: () => {
        selectUtilityRecord("terrain", index);
        rerender();
      },
    }));
  }
  // 제목/카드 제목에 "지형" 을 쓰지 않는다 — qa-terrain 이
  // getByRole("heading", { name: "지형 효과" }) 로 스튜디오 헤딩 하나만 집는다(부분 일치).
  return listPane({
    title: "프리셋",
    count: terrains.length,
    search: listSearch({
      placeholder: "프리셋 검색",
      value: terrainQuery,
      testid: "db-terrain-search",
      onInput: (value) => {
        terrainQuery = value;
        rerender();
      },
    }),
    rows,
    empty: emptyState({
      icon: terrainQuery ? "⌕" : "▦",
      title: terrainQuery ? "검색 결과가 없습니다" : "등록된 프리셋이 없습니다",
      body: terrainQuery
        ? `"${terrainQuery}" 와 일치하는 프리셋이 없습니다.`
        : "프리셋은 칩셋의 태그와 짝을 이룹니다. 타일셋 탭에서 태그를 먼저 붙이세요.",
      compact: true,
    }),
    testid: "db-terrain-preset-gallery",
  });
}

function terrainDetailPane(
  terrains: readonly DatabaseTerrainRecord[],
  selected: DatabaseTerrainRecord | undefined,
  selectedIndex: number,
  rerender: () => void,
): HTMLElement {
  if (!selected) {
    return detailPane({
      body: emptyState({
        icon: "▦",
        title: "선택한 프리셋이 없습니다",
        body: "프리셋이 하나도 없습니다. 타일셋 탭에서 태그를 붙이면 대응하는 프리셋이 필요해집니다.",
      }),
      testid: "db-terrain-inspector",
    });
  }
  return detailPane({
    hero: detailHero({
      eyebrow: "지형 효과",
      title: selected.name,
      subtitle: `태그 ${selectedIndex + 1} · ${selected.id}`,
      tags: [
        `조우율 ${selected.encounterRatePercent}%`,
        selected.damage > 0 ? `걸을 때 ${selected.damage} 피해` : "걸을 때 피해 없음",
        selected.characterDisplay === "transparent" ? "캐릭터 투명" : "캐릭터 일반",
      ],
      testid: "db-terrain-hero",
    }),
    body: [
      terrainPreviewStage(selected),
      statStrip([
        { label: "전투 배경", value: resourceDisplayName(selected.battleBackgroundResourceId), tone: selected.battleBackgroundResourceId ? "good" : "warn" },
        { label: "발소리", value: resourceDisplayName(selected.footstepSoundResourceId), tone: selected.footstepSoundResourceId ? "good" : "neutral" },
        { label: "탈것", value: terrainVehicleText(selected) },
      ], { testid: "db-terrain-summary" }),
      el("div", {
        class: "db-ws-stack",
        children: [
          terrainBasicsCard(selected, selectedIndex),
          terrainSceneCard(selected, selectedIndex, rerender),
          terrainVehicleCard(selected, selectedIndex),
          ...(terrains.length > 1 ? [terrainQuickEditCard(terrains, selectedIndex, rerender)] : []),
        ],
      }),
    ],
    testid: "db-terrain-inspector",
  });
}

function terrainBasicsCard(terrain: DatabaseTerrainRecord, index: number): HTMLElement {
  return sectionCard({
    title: "기본",
    hint: "이 태그 번호의 칸을 밟았을 때 일어나는 일",
    children: [
      textField("이름", `db-field-terrain-name-${index}`, terrain.name, (value) => {
        recordCoalescedSnapshot(`db-utility:terrain:${index}:name`);
        writeTerrain(index, (target) => { target.name = value; });
      }),
      numberField("걸을 때 피해", `db-field-terrain-damage-${index}`, terrain.damage, (value) => {
        recordCoalescedSnapshot(`db-utility:terrain:${index}:damage`);
        writeTerrain(index, (target) => { target.damage = Math.max(0, Math.trunc(value)); });
      }, { min: 0, max: 9999 }),
      numberField("조우율 %", `db-field-terrain-encounter-${index}`, terrain.encounterRatePercent, (value) => {
        recordCoalescedSnapshot(`db-utility:terrain:${index}:encounter`);
        writeTerrain(index, (target) => {
          target.encounterRatePercent = Math.max(0, Math.min(500, Math.trunc(value)));
        });
      }, { min: 0, max: 500 }),
    ],
    testid: "db-terrain-basics-card",
  });
}

function terrainSceneCard(terrain: DatabaseTerrainRecord, index: number, rerender: () => void): HTMLElement {
  const project = store.getCurrent();
  const side = battleMethodOf(project) === "side";
  const writeBackdrop = (resourceId: string | undefined): void => {
    selectUtilityRecord("terrain", index);
    recordCoalescedSnapshot(`db-utility:terrain:${index}:backdrop`);
    writeTerrain(index, (target) => {
      target.battleBackgroundResourceId = resourceId;
    });
  };
  const picker = resourcePickerControl({
    label: side ? "직접 그림" : "전투 배경",
    resourceId: side ? customPickerResourceId(project, terrain.battleBackgroundResourceId) : terrain.battleBackgroundResourceId,
    kind: "backdrop",
    testid: `db-field-terrain-backdrop-${index}`,
    allowClear: true,
    dialogTitle: "전투 배경",
    onChange: (result) => writeBackdrop(emptyToUndefined(result.resourceId)),
    rerender,
  });
  return sectionCard({
    title: "전투 · 표시",
    hint: side
      ? "적 그룹이 배경을 정하지 않으면 이 종류가 쓰입니다. 우선순위: 적 그룹 → 지형 → 기후 → 숲"
      : "적 그룹이 배경을 지정하지 않으면 이 배경이 쓰입니다. 우선순위: 적 그룹 → 지형 → 기본 전장",
    children: [
      // 도트 측면은 그림이 아니라 배경 종류를 고른다(battleSceneryPicker.ts, 2026-10-02).
      side
        ? battleSceneryField({
          project,
          resourceId: terrain.battleBackgroundResourceId,
          testid: `db-terrain-scenery-${index}`,
          autoHint: "맵 기후를 따릅니다(눈이면 설원). 없으면 숲.",
          onChange: (resourceId) => { writeBackdrop(resourceId); rerender(); },
          customPicker: picker,
        })
        : picker,
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
          writeTerrain(index, (target) => {
            target.footstepSoundResourceId = emptyToUndefined(result.resourceId);
          });
        },
        rerender,
      }),
      selectLiteral(
        "캐릭터 표시",
        `db-field-terrain-display-${index}`,
        terrain.characterDisplay,
        ["normal", "transparent"] as const,
        (value) => {
          recordProjectSnapshot();
          writeTerrain(index, (target) => {
            target.characterDisplay = isTerrainDisplay(value) ? value : "normal";
          });
        },
      ),
    ],
    testid: "db-terrain-scene-card",
  });
}

function terrainVehicleCard(terrain: DatabaseTerrainRecord, index: number): HTMLElement {
  return sectionCard({
    title: "탈것 통행",
    hint: "끄면 그 탈것은 이 지형 태그의 칸에 들어갈 수 없습니다",
    children: [
      toggleSwitch("보트", `db-field-terrain-boat-${index}`, terrain.vehiclePassage.boat, (checked) => {
        recordProjectSnapshot();
        writeTerrain(index, (target) => { target.vehiclePassage.boat = checked; });
      }),
      toggleSwitch("선박", `db-field-terrain-ship-${index}`, terrain.vehiclePassage.ship, (checked) => {
        recordProjectSnapshot();
        writeTerrain(index, (target) => { target.vehiclePassage.ship = checked; });
      }),
      toggleSwitch("비공정 착륙", `db-field-terrain-airship-${index}`, terrain.vehiclePassage.airshipLand, (checked) => {
        recordProjectSnapshot();
        writeTerrain(index, (target) => { target.vehiclePassage.airshipLand = checked; });
      }),
      toggleSwitch("사다리·밧줄(옆보기 맵에서 오르기)", `db-field-terrain-climbable-${index}`, terrain.climbable === true, (checked) => {
        recordProjectSnapshot();
        writeTerrain(index, (target) => { if (checked) target.climbable = true; else delete target.climbable; });
      }),
    ],
    testid: "db-terrain-vehicle-card",
  });
}

/**
 * 선택하지 않은 지형의 이름/피해/조우율만 한 표에서 빠르게 손보는 자리. 인스펙터가
 * 선택 레코드만 다룬다는 사실을 지키면서도, 세 값 비교를 위해 탭을 왕복하지 않게 한다.
 */
function terrainQuickEditCard(
  terrains: readonly DatabaseTerrainRecord[],
  selectedIndex: number,
  rerender: () => void,
): HTMLElement {
  const rows = terrains
    .map((terrain, index) => ({ terrain, index }))
    .filter((entry) => entry.index !== selectedIndex)
    .map(({ terrain, index }) => el("div", {
      class: "db-terrain-quick-row",
      dataset: { testid: `db-terrain-quick-${index}` },
      children: [
        textField("이름", `db-field-terrain-name-${index}`, terrain.name, (value) => {
          recordCoalescedSnapshot(`db-utility:terrain:${index}:name`);
          writeTerrain(index, (target) => { target.name = value; });
        }),
        numberField("피해", `db-field-terrain-damage-${index}`, terrain.damage, (value) => {
          recordCoalescedSnapshot(`db-utility:terrain:${index}:damage`);
          writeTerrain(index, (target) => { target.damage = Math.max(0, Math.trunc(value)); });
        }, { min: 0, max: 9999 }),
        numberField("조우율", `db-field-terrain-encounter-${index}`, terrain.encounterRatePercent, (value) => {
          recordCoalescedSnapshot(`db-utility:terrain:${index}:encounter`);
          writeTerrain(index, (target) => {
            target.encounterRatePercent = Math.max(0, Math.min(500, Math.trunc(value)));
          });
        }, { min: 0, max: 500 }),
        el("button", {
          class: "db-ws-btn db-ws-btn-ghost",
          text: "인스펙터로",
          attrs: { type: "button", title: `${terrain.name} 을(를) 인스펙터에서 편집` },
          dataset: { testid: `db-terrain-focus-${index}` },
          on: {
            click: () => {
              selectUtilityRecord("terrain", index);
              rerender();
            },
          },
        }),
      ],
    }));
  return sectionCard({
    title: "다른 프리셋 빠른 편집",
    hint: "배경·발소리·탈것은 인스펙터에서 편집합니다",
    children: rows,
    testid: "db-terrain-quick-edit",
  });
}

function writeTerrain(index: number, mutate: (target: DatabaseTerrainRecord) => void): void {
  store.update((project) => {
    const target = project.database.terrains?.[index];
    if (target) mutate(target);
  });
}

function terrainPreviewStage(terrain: DatabaseTerrainRecord): HTMLElement {
  const stage = el("section", {
    class: "db-terrain-preview-stage db-studio-dark-stage",
    dataset: { testid: "db-terrain-preview-stage" },
    children: [
      el("div", { class: "db-studio-stage-grid", attrs: { "aria-hidden": "true" } }),
      el("div", {
        class: "db-terrain-stage-overlay",
        children: [
          el("span", { class: "db-studio-live-chip", text: "실시간 미리보기" }),
          el("strong", { text: terrain.name }),
          el("small", { text: `조우 ${terrain.encounterRatePercent}% · 지형 피해 ${terrain.damage}` }),
        ],
      }),
      el("div", {
        class: "db-terrain-stage-actors",
        attrs: { "aria-hidden": "true" },
        children: [el("span", { text: "◆" }), el("span", { text: "◆" }), el("span", { text: "▲" })],
      }),
    ],
  });
  const url = battleBackdropPreviewUrl(store.getCurrent(), terrain.battleBackgroundResourceId, { showAuto: true });
  if (url) stage.style.backgroundImage = `linear-gradient(180deg, rgba(23, 27, 31, 0.05), rgba(23, 27, 31, 0.42)), ${cssBackground(url)}`;
  return stage;
}

// ---------------------------------------------------------------------------
// 전투 명령
// ---------------------------------------------------------------------------

export function renderBattleCommandsTab(host: HTMLElement): void {
  const project = store.getCurrent();
  const commands = project.database.battleCommands ?? [];
  const rerender = (): void => {
    host.replaceChildren();
    renderBattleCommandsTab(host);
  };
  const form = el("section", {
    class: "db-detail-form db-parity-form db-battle-studio-surface db-battle-command-studio db-ws-studio",
    dataset: { testid: "db-detail-form" },
  });
  form.append(
    battleStudioHeading("battleCommands", "전투 명령", "플레이어가 전투 중 선택할 행동과 직업별 메뉴 연결을 설계합니다."),
    workspaceShell({
      detail: detailPane({
        hero: detailHero({
          eyebrow: "전투 명령",
          title: "전투 명령",
          subtitle: "카탈로그에서 골라 직업의 실제 메뉴에 배치합니다.",
          tags: [`${commands.length}개`, `직업 ${project.database.classes.length}개가 참조`],
          actions: [{
            label: "+ 명령 추가",
            kind: "primary",
            testid: "db-battle-command-add",
            onClick: () => addBattleCommand(rerender),
          }],
          testid: "db-battle-command-hero",
        }),
        body: [
          battleCommandPlacement(battleCommandListCard(commands, rerender), rerender),
          sectionCard({ title: "카탈로그 편집", hint: "전역 원본만 편집합니다. 이미 배치한 직업의 덮어쓰기는 유지됩니다.", children: [el("div", { class: "db-cmd-card-grid", children: commands.map((command, index) => battleCommandCard(command, index, commands.length, rerender)) })] }),
          el("div", {
            class: "db-ws-stack",
            children: [
              battleCommandClassCard(project.database.classes.length),
              battleCommandKindGuideCard(),
            ],
          }),
        ],
        testid: "db-battle-command-detail",
      }),
    }),
  );
  host.append(form);
}

function battleCommandClassCard(classCount: number): HTMLElement {
  return sectionCard({
    title: "직업 연결",
    hint: `${classCount}개 직업`,
    children: [
      el("p", { class: "db-ws-usage", text: "배치할 때 카탈로그 값을 복사합니다. 기존 직업의 이름·종류·스킬 덮어쓰기는 전역 편집으로 바뀌지 않습니다." }),
      el("button", {
        class: "db-ws-btn db-ws-btn-ghost",
        text: "직업별 메뉴 순서 편집",
        attrs: { type: "button" },
        dataset: { testid: "db-open-classes-tab" },
        on: { click: (event) => jumpToTab("classes", event) },
      }),
    ],
    testid: "db-battle-command-inspector",
  });
}

function battleCommandKindGuideCard(): HTMLElement {
  return sectionCard({
    title: "종류 안내",
    hint: "명령의 '종류' 가 전투 중 실제 동작을 정합니다",
    children: [
      el("div", {
        class: "db-cmd-kind-guide",
        children: BATTLE_COMMAND_KIND_HELP.map((entry) => el("div", {
          class: "db-cmd-kind-guide-row",
          children: [el("strong", { text: entry.label }), el("span", { text: entry.help })],
        })),
      }),
    ],
    testid: "db-battle-command-kind-guide",
  });
}

function battleCommandListCard(commands: readonly DatabaseBattleCommandRecord[], rerender: () => void): HTMLElement {
  const query = commandQuery;
  const visible = commands
    .map((command, index) => ({ command, index }))
    .filter(({ command }) => !query || matchesNameOrId(command.name, command.id, query));
  const card = sectionCard({
    title: "명령 카탈로그",
    hint: `${commands.length}개 · 끌어서 배치 · 카탈로그 순서는 직업 메뉴와 별개`,
    children: [
      commandSearchBox(rerender),
      visible.length > 0
        ? el("div", {
          class: "db-cmd-card-grid",
          children: visible.map(({ command, index }) => battleCommandPaletteCard(command, index, rerender)),
        })
        : emptyState({
          icon: commands.length === 0 ? "⚔" : "⌕",
          title: commands.length === 0 ? "전투 명령이 없습니다" : "검색 결과가 없습니다",
          body: commands.length === 0
            ? "카탈로그가 비어도 기존 직업 메뉴는 유지됩니다. 명령 추가로 새 명령을 만드세요."
            : `"${query}" 와 일치하는 명령이 없습니다.`,
          action: commands.length === 0
            ? { label: "+ 명령 추가", kind: "primary", testid: "db-battle-command-add-empty", onClick: () => addBattleCommand(rerender) }
            : undefined,
          testid: "db-battle-command-empty",
        }),
    ],
    testid: "db-battle-command-palette",
  });
  // 명령 카드는 폭이 있어야 이름/종류/스킬 세 줄이 안 눌린다 — 스택 한 줄을 통째로 쓴다.
  card.classList.add("db-ws-span");
  return card;
}

function commandSearchBox(rerender: () => void): HTMLElement {
  return listSearch({
    placeholder: "명령 검색",
    value: commandQuery,
    testid: "db-battle-command-search",
    onInput: (value) => {
      commandQuery = value;
      rerender();
      restoreFocusAfterRerender("db-battle-command-search");
    },
  });
}

function battleCommandPaletteCard(command: DatabaseBattleCommandRecord, index: number, rerender: () => void): HTMLElement {
  const card = el("article", {
    class: "db-battle-command-card",
    dataset: { testid: `db-battle-command-card-${index}` },
    children: [
      el("header", { children: [el("span", { class: "db-command-drag-label", text: "끌기" }), el("strong", { text: command.name || "이름 없는 명령" })] }),
      commandActionButton("원본 편집", `db-command-edit-${command.id}`, "카탈로그 원본 편집", false, () => {
        const field = document.querySelector<HTMLElement>(`[data-testid="db-field-battle-command-name-${index}"]`);
        field?.scrollIntoView({ block: "center" });
        field?.focus();
      }),
    ],
  });
  attachCatalogPlacement(card, command, rerender);
  return card;
}

function battleCommandCard(
  command: DatabaseBattleCommandRecord,
  index: number,
  total: number,
  rerender: () => void,
): HTMLElement {
  const selected = selectedUtilityRecordIndex("battleCommands") === index;
  const card = el("article", {
    class: `db-battle-command-card${selected ? " is-selected" : ""}`,
    dataset: { testid: `db-battle-command-editor-${index}` },
    children: [
      el("header", {
        children: [
          el("span", { class: "db-command-card-index", text: "끌기", attrs: { "aria-hidden": "true" } }),
          el("strong", { text: command.name || "이름 없는 명령" }),
          el("div", {
            class: "db-cmd-card-actions",
            children: [
              commandActionButton("↑", `db-battle-command-up-${index}`, "한 칸 위로", index === 0, () => moveBattleCommand(index, -1, rerender)),
              commandActionButton("↓", `db-battle-command-down-${index}`, "한 칸 아래로", index === total - 1, () => moveBattleCommand(index, 1, rerender)),
              commandActionButton("복제", `db-battle-command-duplicate-${index}`, "이 명령을 복제", false, () => duplicateBattleCommand(index, rerender)),
              commandDeleteButton(index, rerender),
            ],
          }),
        ],
      }),
      utilityTextRow({
        label: "이름",
        value: command.name,
        testid: `db-field-battle-command-name-${index}`,
        onFocus: () => selectUtilityRecord("battleCommands", index),
        onInput: (value) => {
          recordCoalescedSnapshot(`db-utility:battle-command:${index}:name`);
          writeBattleCommand(index, (target) => { target.name = value; });
        },
      }),
      utilitySelectRow({
        label: "종류",
        value: command.kind,
        options: BATTLE_COMMAND_KINDS,
        testid: `db-field-battle-command-kind-${index}`,
        onFocus: () => selectUtilityRecord("battleCommands", index),
        onInput: (value) => {
          recordProjectSnapshot();
          writeBattleCommand(index, (target) => {
            target.kind = isBattleCommandKind(value) || value === "capture" ? value : "attack";
          });
        },
      }),
      utilityTextRow({
        label: "스킬 묶음",
        value: command.skillSubsetName ?? "",
        testid: `db-field-battle-command-subset-${index}`,
        onFocus: () => selectUtilityRecord("battleCommands", index),
        onInput: (value) => {
          recordCoalescedSnapshot(`db-utility:battle-command:${index}:subset`);
          writeBattleCommand(index, (target) => { target.skillSubsetName = emptyToUndefined(value); });
        },
      }),
      battleCommandSkillRow(command, index),
      ...(command.kind === "commonEvent" ? [battleCommandCommonEventRow(command, index)] : []),
    ],
  });
  return card;
}

function battleCommandCommonEventRow(command: DatabaseBattleCommandRecord, index: number): HTMLElement {
  const events = store.getCurrent().commonEvents;
  const current = command.commonEventId ?? "";
  const options = [
    { id: "", name: "(없음)" },
    ...events.map((event) => ({ id: event.id, name: event.name || event.id })),
  ];
  if (current && !events.some((event) => event.id === current)) {
    options.push({ id: current, name: `${current} (없음)` });
  }
  const select = el("select", {
    class: "db-battle-command-skill-select",
    dataset: { testid: `db-picker-battle-command-common-event-${index}` },
    attrs: { "aria-label": "실행할 공통 이벤트" },
    children: options.map((option) => el("option", { attrs: { value: option.id }, text: option.name })),
  }) as HTMLSelectElement;
  select.value = current;
  select.addEventListener("focus", () => selectUtilityRecord("battleCommands", index));
  select.addEventListener("change", () => {
    recordProjectSnapshot();
    writeBattleCommand(index, (target) => { target.commonEventId = emptyToUndefined(select.value); });
  });
  return el("label", {
    class: "db-readonly-row",
    children: [el("span", { text: "공통 이벤트" }), select],
  });
}

function commandActionButton(
  label: string,
  testid: string,
  title: string,
  disabled: boolean,
  onClick: () => void,
): HTMLElement {
  return el("button", {
    class: "db-ws-btn db-ws-btn-ghost",
    text: label,
    attrs: { type: "button", title, ...(disabled ? { disabled: "true" } : {}) },
    dataset: { testid },
    on: { click: onClick },
  });
}

/** 2 단계 확인 삭제 — 첫 클릭은 라벨만 바꾸고, 3 초 안에 다시 눌러야 지운다. */
function commandDeleteButton(index: number, rerender: () => void): HTMLElement {
  const button = el("button", {
    class: "db-ws-btn db-ws-btn-danger",
    text: "삭제",
    attrs: { type: "button", title: "이 전투 명령을 삭제" },
    dataset: { testid: `db-battle-command-delete-${index}` },
  });
  let armed = false;
  let timer: number | undefined;
  button.addEventListener("click", () => {
    if (!armed) {
      armed = true;
      button.textContent = "정말 삭제?";
      button.classList.add("confirming");
      timer = window.setTimeout(() => {
        armed = false;
        button.textContent = "삭제";
        button.classList.remove("confirming");
      }, 3000);
      return;
    }
    if (timer !== undefined) window.clearTimeout(timer);
    deleteBattleCommand(index, rerender);
  });
  return button;
}

function writeBattleCommand(index: number, mutate: (target: DatabaseBattleCommandRecord) => void): void {
  store.update((project) => {
    const target = project.database.battleCommands?.[index];
    if (target) mutate(target);
  }, { scope: "database", collection: "battleCommands", label: "전투 명령 카탈로그 편집" });
}

function addBattleCommand(rerender: () => void): void {
  recordProjectSnapshot();
  let nextIndex = 0;
  store.update((project) => {
    const list = (project.database.battleCommands ??= []);
    list.push({ id: uniqueBattleCommandId(list, project.database.classes.flatMap((klass) => klass.battleCommands)), name: "새 명령", kind: "attack" });
    nextIndex = list.length - 1;
  }, { scope: "database", collection: "battleCommands", label: "전투 명령 카탈로그 변경" });
  commandQuery = "";
  selectUtilityRecord("battleCommands", nextIndex);
  rerender();
  restoreFocusAfterRerender(`db-field-battle-command-name-${nextIndex}`);
}

function duplicateBattleCommand(index: number, rerender: () => void): void {
  recordProjectSnapshot();
  let nextIndex = index;
  store.update((project) => {
    const list = project.database.battleCommands;
    const source = list?.[index];
    if (!list || !source) return;
    list.splice(index + 1, 0, { ...source, id: uniqueBattleCommandId(list, project.database.classes.flatMap((klass) => klass.battleCommands)), name: `${source.name} 복사` });
    nextIndex = index + 1;
  }, { scope: "database", collection: "battleCommands", label: "전투 명령 카탈로그 변경" });
  selectUtilityRecord("battleCommands", nextIndex);
  rerender();
  restoreFocusAfterRerender(`db-field-battle-command-name-${nextIndex}`);
}

function deleteBattleCommand(index: number, rerender: () => void): void {
  recordProjectSnapshot();
  store.update((project) => {
    project.database.battleCommands?.splice(index, 1);
  }, { scope: "database", collection: "battleCommands", label: "전투 명령 카탈로그 변경" });
  const remaining = store.getCurrent().database.battleCommands?.length ?? 0;
  const nextIndex = Math.max(0, Math.min(index, remaining - 1));
  selectUtilityRecord("battleCommands", nextIndex);
  rerender();
  restoreFocusAfterRerender(remaining ? `db-field-battle-command-name-${nextIndex}` : "db-battle-command-add");
}

function moveBattleCommand(index: number, delta: number, rerender: () => void): void {
  const list = store.getCurrent().database.battleCommands ?? [];
  const target = index + delta;
  if (target < 0 || target >= list.length) return;
  recordProjectSnapshot();
  store.update((project) => {
    const commands = project.database.battleCommands;
    if (!commands) return;
    const [moved] = commands.splice(index, 1);
    if (moved) commands.splice(target, 0, moved);
  }, { scope: "database", collection: "battleCommands", label: "전투 명령 카탈로그 변경" });
  selectUtilityRecord("battleCommands", target);
  rerender();
  restoreFocusAfterRerender(`db-field-battle-command-name-${target}`);
}

function uniqueBattleCommandId(list: readonly DatabaseBattleCommandRecord[], classCommands: readonly DatabaseBattleCommandRecord[]): string {
  // Deleted catalog entries can still supply the identity of placed class commands.
  const used = new Set([...list, ...classCommands].map((record) => record.id));
  let ordinal = list.length + 1;
  let candidate = `cmd_${String(ordinal).padStart(3, "0")}`;
  while (used.has(candidate)) {
    ordinal += 1;
    candidate = `cmd_${String(ordinal).padStart(3, "0")}`;
  }
  return candidate;
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
    writeBattleCommand(index, (target) => { target.skillId = emptyToUndefined(value); });
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

// ---------------------------------------------------------------------------
// 공용
// ---------------------------------------------------------------------------

function backdropThumb(resourceId: string | undefined): HTMLElement {
  // listRow 가 .db-list-thumb 를 붙인다(24px 고정, studio-theme.css).
  const thumb = el("span", { attrs: { "aria-hidden": "true" } });
  const url = battleBackdropPreviewUrl(store.getCurrent(), resourceId);
  if (url) {
    thumb.style.backgroundImage = cssBackground(url);
    thumb.style.backgroundSize = "cover";
  }
  return thumb;
}

function cssBackground(url: string): string {
  return `url(${JSON.stringify(url)})`;
}

function resourceDisplayName(resourceId: string | undefined): string {
  if (!resourceId) return "(미설정)";
  const pretty = resourceId.split(/[-_/]/).filter(Boolean).at(-1);
  return pretty ?? resourceId;
}

/**
 * G006: 모달 내 탭 점프는 switchDatabaseActiveTab 를 거친다. 클릭 이벤트가 있으면
 * 거기서 루트를 걸어 올라가고(fakeDom 처럼 문서에 붙어 있지 않은 호스트도 동작),
 * 없으면 문서에서 모달 본문을 찾는다(툴바 액션은 이벤트를 받지 않는다).
 */
function jumpToTab(tab: "classes", event?: Event): void {
  const fromEvent = event ? databasePanelRootFrom(event.currentTarget as HTMLElement | null) : null;
  const panelRoot = fromEvent ?? (document.querySelector(".database-modal-body") as HTMLElement | null);
  if (panelRoot) switchDatabaseActiveTab(tab, panelRoot);
}

// fakeDom 에서는 closest 결과가 HTMLElement 가 아니라서 .db-body 부모를 걸어 올라간다
// (개요/적 탭과 동일).
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
