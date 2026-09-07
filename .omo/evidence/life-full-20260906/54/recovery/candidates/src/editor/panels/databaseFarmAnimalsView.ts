// 동물·축사 탭 — 레코드 레일 + 인스펙터 (2026-08 모던 개편).
//
// 예전 구조는 speciesPanel/buildingPanel/animalPanel 이 각 레코드를 통째로 인라인 폼
// 카드로 펼쳐 3 열 그리드에 쏟아붓는 형태였다. 감사에서 나온 결함:
//   - 레코드 목록이 없어 검색·정렬·선택이 불가능했고, 종이 하나 늘면 1 열만 길어졌다(축 A/B).
//   - 먹이/생산물이 아이콘 없는 맨 <select> 였고, 축사의 맵/좌표에는 미리보기가 없었다(축 F).
//   - 파생값을 `<input readonly>` 로 그려 편집 가능한 필드와 똑같이 보였다(P8).
//
// 그래서: 왼쪽은 종/축사/시작 개체를 오가는 레일(칩 + 검색), 오른쪽은 선택한 레코드
// 하나의 인스펙터. 파생값은 입력이 아니라 **muted 칩**으로 그린다.
//
// 계약(테스트가 의존):
//   db-farm-animals-workspace            — 탭 루트
//   db-farm-animals-seed-defaults        — 비어 있을 때의 단일 CTA
//   db-farm-species-<id> / db-farm-building-<id> / db-farm-animal-<instanceId>
//       → 각 레코드 편집기의 루트. **모든 레코드가 항상 DOM 에 있고** 선택되지 않은
//         것만 `hidden` 이다(용어 탭과 같은 전략). 이유:
//           - p1ReferenceIntegrity.test.ts:195 는 렌더 직후 `querySelector("button")`
//             으로 삭제 버튼을 눌러 참조 가드를 검증한다 → 편집기 안 **첫 번째 button 은
//             반드시 삭제 버튼**이어야 한다. 다른 버튼을 앞에 넣지 말 것.
//           - stardew-p1-editor.spec.ts:64 는 `locator("input").first()` 가 이름이라고
//             본다 → 이름 입력이 편집기 안 **첫 번째 input** 이어야 한다.

import { recordCoalescedSnapshot, recordProjectSnapshot } from "@/editor/mapEditHistory";
import {
  farmAnimalBuildingReferenceMessage,
  farmAnimalSpeciesReferenceMessage,
} from "@/editor/databaseReferences";
import { field, matchesNameOrId } from "@/editor/panels/databaseControls";
import { imageIconOf, recordIconElement } from "@/editor/panels/eventEditor/recordPicker";
import { createMapThumbnail } from "@/editor/panels/mapThumbnail";
import {
  detailHero,
  detailPane,
  emptyState,
  listPane,
  listRow,
  listSearch,
  listToolbar,
  noticeBar,
  sectionCard,
  statStrip,
  workspaceShell,
} from "@/editor/panels/databaseWorkspace";
import { store } from "@/project/store";
import type {
  FarmAnimalBuildingDefinition,
  FarmAnimalSpeciesRecord,
  FarmAnimalStartInstance,
  Project,
} from "@/project/types";
import { el } from "@/util/dom";
import { genId } from "@/util/id";
import { toast } from "@/util/toast";

type FarmKind = "species" | "building" | "animal";

const KIND_LABEL: Record<FarmKind, string> = { species: "동물 종", building: "축사", animal: "시작 개체" };
const KIND_EYEBROW: Record<FarmKind, string> = { species: "동물 종", building: "축사", animal: "개체" };
const KIND_ICON: Record<FarmKind, string> = { species: "🐓", building: "🏚", animal: "🐄" };
const DELETE_IDLE_LABEL = "삭제";
const DELETE_CONFIRM_LABEL = "정말 삭제?";
const DELETE_CONFIRM_WINDOW_MS = 3000;

let selectedKind: FarmKind = "species";
let selectedId = "";
let farmQuery = "";

export function renderFarmAnimalsTab(host: HTMLElement, rerender: () => void): void {
  const project = store.getCurrent();
  const species = project.database.farmAnimalSpecies ?? [];
  const buildings = project.system.farmAnimalBuildings ?? [];
  const animals = project.session.farmAnimals ?? [];

  if (species.length === 0 && buildings.length === 0 && animals.length === 0) {
    host.append(unconfiguredWorkspace(rerender));
    return;
  }
  host.append(configuredWorkspace(project, species, buildings, animals, rerender));
}

// ---------------------------------------------------------------------------
// 아직 아무것도 없을 때
//
// 가운데 420px 빈 상태 하나만 두면 인스펙터의 85% 가 흰 여백이 된다(게이트 detailDead).
// "만들면 무엇이 생기는가"를 실제 기본 구성으로 미리 보여준다.
// ---------------------------------------------------------------------------

function unconfiguredWorkspace(rerender: () => void): HTMLElement {
  const empty = emptyState({
    icon: "🐓",
    title: "아직 등록된 동물이 없습니다",
    body: "기본값을 만들면 닭·소 두 종과 축사 한 채, 그 안에 사는 시작 개체 둘이 서로 연결된 채로 채워집니다.",
    action: {
      label: "닭·소와 기본 축사 만들기",
      kind: "primary",
      testid: "db-farm-animals-seed-defaults",
      onClick: () => seedDefaults(rerender),
    },
    testid: "db-farm-animals-empty",
  });
  return workspaceShell({
    testid: "db-farm-animals-workspace",
    detail: detailPane({
      hero: detailHero({
        eyebrow: "동물·축사",
        title: "동물·축사",
        subtitle: "동물 종, 먹이와 생산물, 축사 수용량, 게임 시작 개체를 한 화면에서 연결합니다.",
        tags: ["동물 종 0", "축사 0", "시작 개체 0"],
        testid: "db-farm-animals-hero",
      }),
      body: el("div", {
        class: "db-ws-stack",
        children: [
          previewNotice(),
          empty,
          previewCard("동물 종 · 닭", "매일 달걀 1개", [
            ["먹이", "사료로 표시된 아이템 (없으면 첫 아이템)"],
            ["생산물", "달걀 ×1"],
            ["생산 주기", "1일마다"],
            ["쓰다듬기", "친밀도 +15"],
          ]),
          previewCard("동물 종 · 소", "이틀마다 우유 1개", [
            ["먹이", "닭과 같은 사료 아이템"],
            ["생산물", "우유 ×1"],
            ["생산 주기", "2일마다"],
            ["쓰다듬기", "친밀도 +18"],
          ]),
          previewCard("축사 · 햇살 축사", "시작 맵 위에 놓입니다", [
            ["위치", "시작 맵 (3, 3)"],
            ["수용량", "8마리"],
            ["허용 종", "닭 · 소"],
          ]),
          previewCard("시작 개체 · 보리, 두부", "새 게임을 시작하면 축사 안에 생깁니다", [
            ["보리", "닭 · 햇살 축사에 배정"],
            ["두부", "소 · 햇살 축사에 배정"],
            ["표시 이벤트", "비워 둠 (나중에 연결)"],
          ]),
          factsCard(),
        ],
      }),
      testid: "db-farm-animals-detail-pane",
    }),
  });
}

function previewNotice(): HTMLElement {
  const notice = noticeBar({
    text: "아래 네 장은 저장된 값이 아니라 기본 구성 미리보기입니다. 만든 뒤에는 이름·먹이·수용량을 전부 고칠 수 있습니다.",
    testid: "db-farm-animals-preview-notice",
  });
  notice.classList.add("db-ws-span");
  return notice;
}

function previewCard(title: string, hint: string, rows: readonly (readonly [string, string])[]): HTMLElement {
  return sectionCard({
    title,
    hint,
    children: [
      el("dl", {
        class: "db-wa-preview",
        children: rows.flatMap(([label, value]) => [
          el("dt", { class: "db-wa-preview-label", text: label }),
          el("dd", { class: "db-wa-chip db-wa-chip-wide", text: value }),
        ]),
      }),
    ],
  });
}

/** 런타임(project/farmAnimals.ts)에서 실제로 확인한 규칙만 적는다. */
function factsCard(): HTMLElement {
  const rows: readonly (readonly [string, string])[] = [
    ["배정 조건", "축사가 그 종을 허용하고 수용량이 남아 있어야 배정됩니다."],
    ["먹이", "하루 한 번, 인벤토리에서 먹이 아이템 1개를 씁니다. 축사에 없는 개체는 먹일 수 없습니다."],
    ["생산", "같은 날 먹이와 쓰다듬기를 둘 다 해야 생산 주기가 하루 진행됩니다."],
    ["수확", "주기를 채우면 생산물이 쌓이고, 모아 둔 만큼 한 번에 가져갑니다."],
    ["친밀도", "쓰다듬을 때마다 종에 적힌 값만큼 오르고 상한에서 멈춥니다."],
  ];
  return sectionCard({
    title: "동물이 게임에서 동작하는 방식",
    hint: "레코드를 만들기 전에 알아두면 좋은 것들",
    children: [
      el("dl", {
        class: "db-wa-facts",
        children: rows.flatMap(([label, text]) => [
          el("dt", { class: "db-wa-fact-label", text: label }),
          el("dd", { class: "db-wa-fact-text", text }),
        ]),
      }),
    ],
    testid: "db-farm-animals-facts-card",
  });
}

// ---------------------------------------------------------------------------
// 레코드가 있을 때
// ---------------------------------------------------------------------------

function configuredWorkspace(
  project: Project,
  species: readonly FarmAnimalSpeciesRecord[],
  buildings: readonly FarmAnimalBuildingDefinition[],
  animals: readonly FarmAnimalStartInstance[],
  rerender: () => void,
): HTMLElement {
  resolveSelection(species, buildings, animals);

  const query = farmQuery.trim();
  const nameTargets = new Map<string, HTMLElement[]>();
  const remember = (key: string, node: HTMLElement | null): void => {
    if (!node) return;
    const bucket = nameTargets.get(key) ?? [];
    bucket.push(node);
    nameTargets.set(key, bucket);
  };

  const rows: HTMLElement[] = [];
  if (selectedKind === "species") {
    for (const [index, record] of species.entries()) {
      if (query && !matchesNameOrId(record.name, record.id, query)) continue;
      const row = listRow({
        name: record.name,
        sub: `${record.productCount}개 / ${record.productEveryDays}일`,
        number: `#${index + 1}`,
        active: record.id === selectedId,
        title: record.id,
        dataset: { recordId: record.id, recordKind: "species" },
        onSelect: () => select("species", record.id, rerender),
      });
      remember(`species:${record.id}`, row.querySelector(".db-list-name"));
      rows.push(row);
    }
  } else if (selectedKind === "building") {
    for (const [index, record] of buildings.entries()) {
      if (query && !matchesNameOrId(record.name, record.id, query)) continue;
      const occupied = animals.filter((animal) => animal.buildingId === record.id).length;
      const row = listRow({
        name: record.name,
        sub: `${occupied}/${record.capacity}마리`,
        number: `#${index + 1}`,
        active: record.id === selectedId,
        title: record.id,
        dataset: { recordId: record.id, recordKind: "building" },
        onSelect: () => select("building", record.id, rerender),
      });
      remember(`building:${record.id}`, row.querySelector(".db-list-name"));
      rows.push(row);
    }
  } else {
    for (const [index, record] of animals.entries()) {
      if (query && !matchesNameOrId(record.name, record.instanceId, query)) continue;
      const row = listRow({
        name: record.name,
        sub: species.find((entry) => entry.id === record.speciesId)?.name ?? "종 없음",
        number: `#${index + 1}`,
        active: record.instanceId === selectedId,
        title: record.instanceId,
        dataset: { recordId: record.instanceId, recordKind: "animal" },
        onSelect: () => select("animal", record.instanceId, rerender),
      });
      remember(`animal:${record.instanceId}`, row.querySelector(".db-list-name"));
      rows.push(row);
    }
  }

  const list = listPane({
    title: KIND_LABEL[selectedKind],
    count: countOf(selectedKind, species, buildings, animals),
    search: listSearch({
      placeholder: `${KIND_LABEL[selectedKind]} 검색`,
      value: farmQuery,
      testid: "db-farm-animals-search",
      onInput: (value) => {
        farmQuery = value;
        rerender();
      },
    }),
    chips: kindChips(species.length, buildings.length, animals.length, rerender),
    rows,
    empty: query.length > 0
      ? emptyState({ icon: "⌕", title: "검색 결과가 없습니다", body: `"${query}" 와 일치하는 ${KIND_LABEL[selectedKind]}가 없습니다.`, compact: true })
      : emptyState({ icon: KIND_ICON[selectedKind], title: `${KIND_LABEL[selectedKind]}가 아직 없습니다`, compact: true }),
    toolbar: listToolbar([addAction(selectedKind, rerender)]),
    testid: "db-farm-animals-list-pane",
  });

  // 편집기는 **전부** 만들고 선택되지 않은 것만 감춘다(파일 상단 계약 주석 참고).
  const editors: HTMLElement[] = [
    ...species.map((record, index) => hideUnless(
      speciesEditor(project, record, index, buildings, animals, rerender),
      selectedKind === "species" && record.id === selectedId,
    )),
    ...buildings.map((record, index) => hideUnless(
      buildingEditor(project, record, index, species, animals, rerender),
      selectedKind === "building" && record.id === selectedId,
    )),
    ...animals.map((record, index) => hideUnless(
      animalEditor(project, record, index, species, buildings, animals, rerender),
      selectedKind === "animal" && record.instanceId === selectedId,
    )),
  ];

  const hero = selectedHero(species, buildings, animals, remember);
  const detail = detailPane({
    ...(hero ? { hero } : {}),
    body: editors.length > 0
      ? editors
      : [emptyState({ icon: KIND_ICON[selectedKind], title: "선택한 레코드가 없습니다", body: "왼쪽 목록에서 하나를 고르세요." })],
    testid: "db-farm-animals-detail-pane",
  });

  // 이름 입력은 타이핑마다 커밋하되 재렌더하지 않는다 — 목록 행과 히어로 제목만
  // 국소 갱신해 포커스/캐럿을 지킨다(용어 탭 미리보기와 같은 패턴).
  bindLiveNames(detail, nameTargets);

  const occupancy = occupancySummary(buildings, animals);
  return workspaceShell({
    header: statStrip([
      { label: "동물 종", value: String(species.length), hint: species.length === 0 ? "먼저 종을 만드세요" : "먹이·생산물 정의" },
      { label: "축사", value: String(buildings.length), hint: buildings.length === 0 ? "축사가 없으면 배정할 수 없습니다" : "맵 위 배치" },
      { label: "시작 개체", value: String(animals.length), hint: "새 게임 시작 시 생성" },
      {
        label: "수용 여유",
        value: `${occupancy.free}자리`,
        hint: `${occupancy.used} / ${occupancy.capacity}마리 배정`,
        tone: occupancy.free < 0 ? "bad" : occupancy.free === 0 ? "warn" : "good",
      },
    ], { testid: "db-farm-animals-stats" }),
    list,
    detail,
    testid: "db-farm-animals-workspace",
  });
}

function kindChips(speciesCount: number, buildingCount: number, animalCount: number, rerender: () => void): HTMLElement {
  const counts: Record<FarmKind, number> = { species: speciesCount, building: buildingCount, animal: animalCount };
  return el("div", {
    class: "db-wa-chips",
    attrs: { role: "tablist", "aria-label": "동물·축사 분류" },
    dataset: { testid: "db-farm-animals-kinds" },
    children: (["species", "building", "animal"] as const).map((kind) => el("button", {
      class: `db-wa-chip-tab${kind === selectedKind ? " active" : ""}`,
      attrs: { type: "button", role: "tab", "aria-selected": kind === selectedKind ? "true" : "false" },
      dataset: { testid: `db-farm-animals-kind-${kind}` },
      on: {
        click: () => {
          if (kind === selectedKind) return;
          selectedKind = kind;
          selectedId = "";
          rerender();
        },
      },
      children: [
        el("span", { class: "db-wa-chip-tab-label", text: KIND_LABEL[kind] }),
        el("span", { class: "db-wa-chip-tab-count", text: String(counts[kind]) }),
      ],
    })),
  });
}

function addAction(kind: FarmKind, rerender: () => void): {
  readonly label: string;
  readonly kind: "primary";
  readonly testid: string;
  readonly onClick: () => void;
} {
  if (kind === "building") {
    return { label: "+ 축사 추가", kind: "primary", testid: "db-farm-animals-add-building", onClick: () => addBuilding(rerender) };
  }
  if (kind === "animal") {
    return { label: "+ 시작 개체 추가", kind: "primary", testid: "db-farm-animals-add-instance", onClick: () => addAnimal(rerender) };
  }
  return { label: "+ 동물 종 추가", kind: "primary", testid: "db-farm-animals-add-species", onClick: () => addSpecies(rerender) };
}

function selectedHero(
  species: readonly FarmAnimalSpeciesRecord[],
  buildings: readonly FarmAnimalBuildingDefinition[],
  animals: readonly FarmAnimalStartInstance[],
  remember: (key: string, node: HTMLElement | null) => void,
): HTMLElement | null {
  const tags: string[] = [];
  let name = "";
  let subtitle = "";
  let key = "";

  if (selectedKind === "species") {
    const record = species.find((entry) => entry.id === selectedId);
    if (!record) return null;
    name = record.name;
    key = `species:${record.id}`;
    subtitle = "먹이를 주면 생산 주기마다 생산물을 남깁니다.";
    tags.push(`${record.productEveryDays}일마다 ${record.productCount}개`, `친밀도 +${record.petFriendship}`, record.id);
  } else if (selectedKind === "building") {
    const record = buildings.find((entry) => entry.id === selectedId);
    if (!record) return null;
    const occupied = animals.filter((animal) => animal.buildingId === record.id).length;
    name = record.name;
    key = `building:${record.id}`;
    subtitle = "맵 위의 한 칸에 놓이고, 허용한 종만 살 수 있습니다.";
    tags.push(`(${record.x}, ${record.y})`, `${occupied}/${record.capacity}마리`, record.id);
  } else {
    const record = animals.find((entry) => entry.instanceId === selectedId);
    if (!record) return null;
    name = record.name;
    key = `animal:${record.instanceId}`;
    subtitle = "새 게임을 시작할 때 이 개체가 생성됩니다.";
    tags.push(species.find((entry) => entry.id === record.speciesId)?.name ?? "종 없음", record.instanceId);
  }

  const hero = detailHero({
    eyebrow: KIND_EYEBROW[selectedKind],
    title: name,
    subtitle,
    tags,
    testid: "db-farm-animals-hero",
  });
  remember(key, hero.querySelector(".db-ws-hero-title"));
  return hero;
}

// ---------------------------------------------------------------------------
// 편집기 — 동물 종
// ---------------------------------------------------------------------------

function speciesEditor(
  project: Project,
  record: FarmAnimalSpeciesRecord,
  index: number,
  buildings: readonly FarmAnimalBuildingDefinition[],
  animals: readonly FarmAnimalStartInstance[],
  rerender: () => void,
): HTMLElement {
  const hostBuildings = buildings.filter((entry) => entry.allowedSpeciesIds.includes(record.id));
  const livingAnimals = animals.filter((entry) => entry.speciesId === record.id);

  return recordShell(`db-farm-species-${record.id}`, [
    sectionCard({
      title: "기본",
      children: [
        liveNameField("종 이름", record.name, `species:${record.id}`, (value) => patchSpecies(index, { name: value })),
        idRow("종 ID", record.id),
      ],
    }),
    sectionCard({
      title: "먹이와 생산물",
      hint: "아이템 탭의 레코드를 그대로 씁니다.",
      children: [
        itemField(project, "먹이", record.feedItemId, (value) => patchSpeciesAndRerender(index, { feedItemId: value }, rerender)),
        itemField(project, "생산물", record.productItemId, (value) => patchSpeciesAndRerender(index, { productItemId: value }, rerender)),
        numberRow("한 번에 나오는 수량", record.productCount, 1, 9_999_999, (value) => patchSpecies(index, { productCount: value })),
        numberRow("생산 주기(일)", record.productEveryDays, 1, 3650, (value) => patchSpecies(index, { productEveryDays: value })),
      ],
    }),
    sectionCard({
      title: "돌봄",
      hint: "쓰다듬을 때 오르는 친밀도입니다.",
      children: [numberRow("쓰다듬기 친밀도", record.petFriendship, 0, 1000, (value) => patchSpecies(index, { petFriendship: value }))],
    }),
    sectionCard({
      title: "연결 상태",
      hint: "다른 탭이 만든 값이라 여기서는 읽기만 합니다.",
      children: [
        derivedRow("이 종을 받는 축사", hostBuildings.length === 0 ? "없음" : hostBuildings.map((entry) => entry.name).join(", ")),
        derivedRow("이 종의 시작 개체", livingAnimals.length === 0 ? "없음" : livingAnimals.map((entry) => entry.name).join(", ")),
      ],
    }),
    deleteCard(
      `${record.name} 삭제`,
      "축사나 시작 개체가 이 종을 쓰고 있으면 삭제되지 않습니다.",
      () => farmAnimalSpeciesReferenceMessage(record.id),
      () => {
        recordProjectSnapshot("동물 종 삭제");
        store.update((draft) => { draft.database.farmAnimalSpecies?.splice(index, 1); });
        selectedId = "";
        rerender();
      },
    ),
  ]);
}

// ---------------------------------------------------------------------------
// 편집기 — 축사
// ---------------------------------------------------------------------------

function buildingEditor(
  project: Project,
  record: FarmAnimalBuildingDefinition,
  index: number,
  species: readonly FarmAnimalSpeciesRecord[],
  animals: readonly FarmAnimalStartInstance[],
  rerender: () => void,
): HTMLElement {
  const occupants = animals.filter((entry) => entry.buildingId === record.id);
  const map = project.maps[record.mapId];

  return recordShell(`db-farm-building-${record.id}`, [
    sectionCard({
      title: "기본",
      children: [
        liveNameField("축사 이름", record.name, `building:${record.id}`, (value) => patchBuilding(index, { name: value })),
        idRow("축사 ID", record.id),
      ],
    }),
    sectionCard({
      title: "위치",
      hint: map ? `${map.name} · ${map.width}×${map.height}칸` : "맵을 고르세요",
      children: [
        pickerRow(
          "맵",
          record.mapId,
          Object.values(project.maps).map((entry) => ({ value: entry.id, label: entry.name })),
          (value) => patchBuildingAndRerender(index, { mapId: value }, rerender),
        ),
        numberRow("X", record.x, 0, 9999, (value) => patchBuildingAndRerender(index, { x: value }, rerender)),
        numberRow("Y", record.y, 0, 9999, (value) => patchBuildingAndRerender(index, { y: value }, rerender)),
        mapPreview(record, map ? { width: map.width, height: map.height } : null),
      ],
    }),
    sectionCard({
      title: "수용",
      children: [
        numberRow("수용량", record.capacity, 1, 500, (value) => patchBuilding(index, { capacity: value })),
        derivedRow("현재 배정", `${occupants.length} / ${record.capacity}마리`, occupants.length > record.capacity ? "bad" : undefined),
        speciesToggles(record, index, species, rerender),
      ],
    }),
    deleteCard(
      `${record.name} 삭제`,
      "이 축사에 배정된 개체가 있으면 삭제되지 않습니다.",
      () => farmAnimalBuildingReferenceMessage(record.id),
      () => {
        recordProjectSnapshot("동물 축사 삭제");
        store.update((draft) => { draft.system.farmAnimalBuildings?.splice(index, 1); });
        selectedId = "";
        rerender();
      },
    ),
  ]);
}

/** 맵 썸네일 위에 좌표 마커를 얹은 위치 미리보기 — 예전엔 X/Y 숫자뿐이었다. */
function mapPreview(record: FarmAnimalBuildingDefinition, size: { readonly width: number; readonly height: number } | null): HTMLElement {
  const stage = el("div", { class: "db-wa-map-stage", dataset: { testid: `db-farm-building-map-${record.id}` } });
  // 마커 좌표는 인라인으로 계산해 넣으므로 position 도 같이 인라인으로 둔다 —
  // 스타일시트가 없어도 마커가 형제 위로 흘러나오지 않는다.
  stage.style.setProperty("position", "relative");
  if (size) {
    stage.append(createMapThumbnail(record.mapId));
    const marker = el("span", { class: "db-wa-map-marker", attrs: { "aria-hidden": "true" } });
    marker.style.setProperty("position", "absolute");
    marker.style.setProperty("left", `${((record.x + 0.5) / Math.max(1, size.width)) * 100}%`);
    marker.style.setProperty("top", `${((record.y + 0.5) / Math.max(1, size.height)) * 100}%`);
    stage.append(marker);
  }
  return el("div", {
    class: "db-wa-map",
    children: [
      stage,
      el("span", {
        class: "db-wa-map-caption",
        text: size ? `(${record.x}, ${record.y}) · 맵 ${size.width}×${size.height}칸` : "맵을 찾을 수 없습니다",
      }),
    ],
  });
}

/** 허용 종을 쉼표 문자열 대신 체크 목록으로 — ID 를 외워 타이핑할 이유가 없다. */
function speciesToggles(
  record: FarmAnimalBuildingDefinition,
  index: number,
  species: readonly FarmAnimalSpeciesRecord[],
  rerender: () => void,
): HTMLElement {
  if (species.length === 0) {
    return field("허용 종", el("span", { class: "db-wa-chip", text: "등록된 동물 종이 없습니다" }));
  }
  const box = el("div", { class: "db-wa-toggles", dataset: { testid: `db-farm-building-species-${record.id}` } });
  for (const entry of species) {
    const checkbox = el("input", {
      attrs: { type: "checkbox", ...(record.allowedSpeciesIds.includes(entry.id) ? { checked: "" } : {}) },
    }) as HTMLInputElement;
    checkbox.addEventListener("change", () => {
      const next = new Set(record.allowedSpeciesIds);
      if (checkbox.checked) next.add(entry.id);
      else next.delete(entry.id);
      patchBuildingAndRerender(index, { allowedSpeciesIds: [...next] }, rerender);
    });
    box.append(el("label", { class: "db-wa-toggle", children: [checkbox, el("span", { text: entry.name })] }));
  }
  return field("허용 종", box);
}

// ---------------------------------------------------------------------------
// 편집기 — 시작 개체
// ---------------------------------------------------------------------------

function animalEditor(
  project: Project,
  record: FarmAnimalStartInstance,
  index: number,
  species: readonly FarmAnimalSpeciesRecord[],
  buildings: readonly FarmAnimalBuildingDefinition[],
  animals: readonly FarmAnimalStartInstance[],
  rerender: () => void,
): HTMLElement {
  const kind = species.find((entry) => entry.id === record.speciesId);
  const homeOptions = animalHomeOptions(project, record, buildings, animals);
  const selectedHome = encodeAnimalHome(record);

  return recordShell(`db-farm-animal-${record.instanceId}`, [
    sectionCard({
      title: "기본",
      children: [
        liveNameField("개체 이름", record.name, `animal:${record.instanceId}`, (value) => patchAnimal(index, { name: value })),
        idRow("개체 ID", record.instanceId),
      ],
    }),
    sectionCard({
      title: "배정",
      hint: homeOptions.invalidCurrent ? "현재 집은 종·정원 조건과 맞지 않습니다." : undefined,
      children: [
        pickerRow(
          "동물 종",
          record.speciesId,
          species.map((entry) => ({ value: entry.id, label: entry.name })),
          (value) => patchAnimalAndRerender(index, exclusiveHomePatch(record, { speciesId: value }), rerender),
        ),
        homePickerRow(
          record.instanceId,
          selectedHome,
          homeOptions.options,
          (value) => patchAnimalAndRerender(index, decodeAnimalHomePatch(value), rerender),
        ),
        textRow("표시 이벤트 ID", record.eventId ?? "", (value) => patchAnimal(index, { eventId: value || undefined })),
      ],
    }),
    sectionCard({
      title: "종에서 물려받는 값",
      hint: "동물 종 탭에서만 바꿀 수 있습니다.",
      children: kind
        ? [
            derivedRow("생산물 주기", `${kind.productEveryDays}일마다 ${kind.productCount}개`),
            derivedRow("쓰다듬기 친밀도", `+${kind.petFriendship}`),
          ]
        : [derivedRow("동물 종", "연결된 종이 없습니다", "bad")],
    }),
    deleteCard(
      `${record.name} 삭제`,
      "시작 개체는 참조 제약이 없어 바로 지워집니다.",
      () => null,
      () => {
        recordProjectSnapshot("시작 동물 삭제");
        store.update((draft) => { draft.session.farmAnimals?.splice(index, 1); });
        selectedId = "";
        rerender();
      },
    ),
  ]);
}

// ---------------------------------------------------------------------------
// 공용 조각
// ---------------------------------------------------------------------------

function recordShell(testid: string, cards: readonly HTMLElement[]): HTMLElement {
  return el("div", {
    class: "db-wa-record db-ws-stack",
    dataset: { testid },
    children: cards,
  });
}

function hideUnless(node: HTMLElement, visible: boolean): HTMLElement {
  if (!visible) node.setAttribute("hidden", "");
  return node;
}

/**
 * 이름 입력. 커밋은 타이핑마다(코얼레스) 하되 재렌더는 하지 않고, 대신 목록 행과
 * 히어로 제목 텍스트만 갈아끼운다 — 재렌더하면 한 글자마다 포커스를 잃는다.
 */
function liveNameField(
  label: string,
  value: string,
  key: string,
  commit: (value: string) => void,
): HTMLElement {
  const input = el("input", {
    attrs: { type: "text" },
    value,
    dataset: { testid: `db-farm-name-${key.replace(":", "-")}`, liveNameKey: key },
  });
  input.addEventListener("input", () => commit(input.value));
  return field(label, input);
}

/** 편집기가 DOM 에 붙은 뒤 이름 입력 -> 표시 노드 연결. */
function bindLiveNames(root: HTMLElement, targets: Map<string, HTMLElement[]>): void {
  for (const input of root.querySelectorAll<HTMLInputElement>("input")) {
    const key = input.dataset.liveNameKey;
    if (!key) continue;
    const nodes = targets.get(key);
    if (!nodes || nodes.length === 0) continue;
    input.addEventListener("input", () => {
      for (const node of nodes) node.textContent = input.value || "(이름 없음)";
    });
  }
}

function idRow(label: string, value: string): HTMLElement {
  return field(label, el("span", { class: "db-wa-chip db-wa-chip-mono", text: value }));
}

/** 파생값은 입력처럼 보이면 안 된다(P8) — 테두리 없는 muted 칩. */
function derivedRow(label: string, value: string, tone?: "bad"): HTMLElement {
  return field(label, el("span", { class: `db-wa-chip${tone ? ` db-wa-chip-${tone}` : ""}`, text: value }));
}

function textRow(label: string, value: string, commit: (value: string) => void): HTMLElement {
  const input = el("input", { attrs: { type: "text" }, value });
  input.addEventListener("input", () => commit(input.value.trim()));
  return field(label, input);
}

function numberRow(label: string, value: number, min: number, max: number, commit: (value: number) => void): HTMLElement {
  const input = el("input", { attrs: { type: "number", min: String(min), max: String(max) }, value: String(value) }) as HTMLInputElement;
  const push = (rewrite: boolean): void => {
    if (input.value === "" && !rewrite) return;
    const next = clampInt(input.value, min, max);
    if (rewrite) input.value = String(next);
    commit(next);
  };
  input.addEventListener("input", () => push(false));
  input.addEventListener("change", () => push(true));
  return field(label, input);
}

function pickerRow(
  label: string,
  value: string,
  options: readonly { readonly value: string; readonly label: string }[],
  onChange: (value: string) => void,
): HTMLElement {
  const select = el("select", {
    on: { change: (event) => onChange((event.currentTarget as HTMLSelectElement).value) },
    children: options.map((entry) => el("option", {
      text: entry.label,
      attrs: { value: entry.value, ...(entry.value === value ? { selected: "" } : {}) },
    })),
  });
  return field(label, select);
}

/** 아이템 선택 + 실제 아이콘 미리보기 — 예전엔 이름만 있는 맨 select 였다. */
function itemField(project: Project, label: string, value: string, onChange: (value: string) => void): HTMLElement {
  const item = project.database.items.find((entry) => entry.id === value);
  const icon = el("span", {
    class: "db-wa-item-icon",
    attrs: { "aria-hidden": "true" },
    children: [recordIconElement(imageIconOf(project, item?.iconResourceId ?? item?.imageResourceId), item?.name ?? label)],
  });
  const select = el("select", {
    class: "db-wa-item-select",
    on: { change: (event) => onChange((event.currentTarget as HTMLSelectElement).value) },
    children: project.database.items.map((entry) => el("option", {
      text: entry.name,
      attrs: { value: entry.id, ...(entry.id === value ? { selected: "" } : {}) },
    })),
  });
  return field(label, el("span", { class: "db-wa-item", children: [icon, select] }));
}

/**
 * 2 단계 삭제. 첫 클릭에서 **먼저 참조 가드를 확인**하고, 막히면 무장하지 않는다 —
 * p1ReferenceIntegrity.test.ts 는 클릭 한 번으로 가드가 걸리는 것을 확인한다.
 */
function deleteCard(
  ariaLabel: string,
  hint: string,
  guard: () => string | null,
  remove: () => void,
): HTMLElement {
  let armedUntil = 0;
  const button = el("button", {
    class: "db-ws-btn db-ws-btn-danger",
    text: DELETE_IDLE_LABEL,
    attrs: { type: "button", "aria-label": ariaLabel },
    on: {
      click: () => {
        const blocked = guard();
        if (blocked) {
          armedUntil = 0;
          button.textContent = DELETE_IDLE_LABEL;
          button.classList.remove("confirming");
          toast(blocked, "error");
          return;
        }
        const now = Date.now();
        if (now > armedUntil) {
          armedUntil = now + DELETE_CONFIRM_WINDOW_MS;
          button.textContent = DELETE_CONFIRM_LABEL;
          button.classList.add("confirming");
          return;
        }
        armedUntil = 0;
        remove();
        toast("삭제했습니다 — Ctrl+Z로 되돌릴 수 있습니다.", "ok");
      },
    },
  });
  return sectionCard({ title: "삭제", hint, children: [button] });
}

function select(kind: FarmKind, id: string, rerender: () => void): void {
  selectedKind = kind;
  selectedId = id;
  rerender();
}

function resolveSelection(
  species: readonly FarmAnimalSpeciesRecord[],
  buildings: readonly FarmAnimalBuildingDefinition[],
  animals: readonly FarmAnimalStartInstance[],
): void {
  const has = (kind: FarmKind, id: string): boolean => {
    if (kind === "species") return species.some((entry) => entry.id === id);
    if (kind === "building") return buildings.some((entry) => entry.id === id);
    return animals.some((entry) => entry.instanceId === id);
  };
  const firstOf = (kind: FarmKind): string => {
    if (kind === "species") return species[0]?.id ?? "";
    if (kind === "building") return buildings[0]?.id ?? "";
    return animals[0]?.instanceId ?? "";
  };
  const populated = (["species", "building", "animal"] as const).find((kind) => firstOf(kind).length > 0);
  if (firstOf(selectedKind).length === 0 && populated) selectedKind = populated;
  if (!has(selectedKind, selectedId)) selectedId = firstOf(selectedKind);
}

function countOf(
  kind: FarmKind,
  species: readonly FarmAnimalSpeciesRecord[],
  buildings: readonly FarmAnimalBuildingDefinition[],
  animals: readonly FarmAnimalStartInstance[],
): number {
  if (kind === "species") return species.length;
  if (kind === "building") return buildings.length;
  return animals.length;
}

function occupancySummary(
  buildings: readonly FarmAnimalBuildingDefinition[],
  animals: readonly FarmAnimalStartInstance[],
): { readonly capacity: number; readonly used: number; readonly free: number } {
  const capacity = buildings.reduce((sum, entry) => sum + entry.capacity, 0);
  const used = animals.filter((entry) => entry.buildingId && buildings.some((house) => house.id === entry.buildingId)).length;
  return { capacity, used, free: capacity - used };
}

// ---------------------------------------------------------------------------
// 저장 (데이터 형태·변경 경로는 개편 전과 동일)
// ---------------------------------------------------------------------------

function seedDefaults(rerender: () => void): void {
  const project = store.getCurrent();
  const feedId = project.database.items.find((item) => item.careProfile?.kind === "feed")?.id ?? project.database.items[0]?.id;
  const productIds = project.database.items.filter((item) => item.id !== feedId).map((item) => item.id);
  const eggId = project.database.items.find((item) => /egg|달걀/i.test(`${item.id} ${item.name}`))?.id ?? productIds[0] ?? feedId;
  const milkId = project.database.items.find((item) => /milk|우유/i.test(`${item.id} ${item.name}`))?.id ?? productIds[1] ?? eggId;
  if (!feedId || !eggId || !milkId) {
    toast("동물 기본값을 만들 아이템이 없습니다. 먼저 아이템을 추가하세요.", "error");
    return;
  }
  const map = project.maps[project.startMapId] ?? Object.values(project.maps)[0];
  if (!map) {
    toast("축사를 배치할 맵이 없습니다.", "error");
    return;
  }
  recordProjectSnapshot("기본 농장 동물 만들기");
  store.update((draft) => {
    const coopId = uniqueId("building_coop", new Set((draft.system.farmAnimalBuildings ?? []).map((entry) => entry.id)));
    const chickenId = uniqueId("animal_chicken", new Set((draft.database.farmAnimalSpecies ?? []).map((entry) => entry.id)));
    const cowId = uniqueId("animal_cow", new Set([chickenId, ...(draft.database.farmAnimalSpecies ?? []).map((entry) => entry.id)]));
    draft.database.farmAnimalSpecies = [
      ...(draft.database.farmAnimalSpecies ?? []),
      { id: chickenId, name: "닭", feedItemId: feedId, productItemId: eggId, productCount: 1, productEveryDays: 1, petFriendship: 15 },
      { id: cowId, name: "소", feedItemId: feedId, productItemId: milkId, productCount: 1, productEveryDays: 2, petFriendship: 18 },
    ];
    draft.system.farmAnimalBuildings = [
      ...(draft.system.farmAnimalBuildings ?? []),
      { id: coopId, name: "햇살 축사", mapId: map.id, x: Math.min(3, Math.max(0, map.width - 1)), y: Math.min(3, Math.max(0, map.height - 1)), capacity: 8, allowedSpeciesIds: [chickenId, cowId] },
    ];
    draft.session.farmAnimals = [
      ...(draft.session.farmAnimals ?? []),
      { instanceId: uniqueId("farm_animal_bori", new Set((draft.session.farmAnimals ?? []).map((entry) => entry.instanceId))), speciesId: chickenId, name: "보리", buildingId: coopId },
      { instanceId: uniqueId("farm_animal_dubu", new Set(["farm_animal_bori", ...(draft.session.farmAnimals ?? []).map((entry) => entry.instanceId)])), speciesId: cowId, name: "두부", buildingId: coopId },
    ];
  });
  toast("닭·소와 기본 축사를 만들었습니다.", "ok");
  rerender();
}

function addSpecies(rerender: () => void): void {
  const project = store.getCurrent();
  const itemId = project.database.items[0]?.id;
  if (!itemId) {
    toast("먼저 아이템을 추가하세요. 먹이와 생산물이 필요합니다.", "info");
    return;
  }
  recordProjectSnapshot("동물 종 추가");
  const id = genId("animal_species");
  store.update((draft) => {
    draft.database.farmAnimalSpecies ??= [];
    draft.database.farmAnimalSpecies.push({ id, name: "새 동물", feedItemId: itemId, productItemId: itemId, productCount: 1, productEveryDays: 1, petFriendship: 10 });
  });
  selectedKind = "species";
  selectedId = id;
  rerender();
}

function addBuilding(rerender: () => void): void {
  const project = store.getCurrent();
  const map = project.maps[project.startMapId] ?? Object.values(project.maps)[0];
  if (!map) {
    toast("축사를 배치할 맵이 없습니다.", "error");
    return;
  }
  recordProjectSnapshot("축사 추가");
  const id = genId("animal_building");
  store.update((draft) => {
    draft.system.farmAnimalBuildings ??= [];
    draft.system.farmAnimalBuildings.push({ id, name: "새 축사", mapId: map.id, x: 0, y: 0, capacity: 4, allowedSpeciesIds: (draft.database.farmAnimalSpecies ?? []).map((entry) => entry.id) });
  });
  selectedKind = "building";
  selectedId = id;
  rerender();
}

function addAnimal(rerender: () => void): void {
  const project = store.getCurrent();
  const species = project.database.farmAnimalSpecies?.[0];
  if (!species) { toast("먼저 동물 종을 추가하세요.", "info"); return; }
  recordProjectSnapshot("시작 동물 추가");
  const id = genId("farm_animal");
  store.update((draft) => {
    draft.session.farmAnimals ??= [];
    draft.session.farmAnimals.push({ instanceId: id, speciesId: species.id, name: "새 동물", buildingId: draft.system.farmAnimalBuildings?.[0]?.id });
  });
  selectedKind = "animal";
  selectedId = id;
  rerender();
}

function patchSpecies(index: number, patch: Partial<FarmAnimalSpeciesRecord>): void {
  recordCoalescedSnapshot(`db-farm-species:${index}`);
  store.update((project) => { const row = project.database.farmAnimalSpecies?.[index]; if (row) project.database.farmAnimalSpecies![index] = { ...row, ...patch }; });
}

function patchSpeciesAndRerender(index: number, patch: Partial<FarmAnimalSpeciesRecord>, rerender: () => void): void {
  patchSpecies(index, patch);
  rerender();
}

function patchBuilding(index: number, patch: Partial<FarmAnimalBuildingDefinition>): void {
  recordCoalescedSnapshot(`db-farm-building:${index}`);
  store.update((project) => { const row = project.system.farmAnimalBuildings?.[index]; if (row) project.system.farmAnimalBuildings![index] = { ...row, ...patch }; });
}

function patchBuildingAndRerender(index: number, patch: Partial<FarmAnimalBuildingDefinition>, rerender: () => void): void {
  patchBuilding(index, patch);
  rerender();
}

function patchAnimal(index: number, patch: Partial<FarmAnimalStartInstance>): void {
  recordCoalescedSnapshot(`db-farm-animal:${index}`);
  store.update((project) => {
    const row = project.session.farmAnimals?.[index];
    if (!row) return;
    project.session.farmAnimals![index] = applyAnimalPatch(row, patch);
  });
}

function patchAnimalAndRerender(index: number, patch: Partial<FarmAnimalStartInstance>, rerender: () => void): void {
  patchAnimal(index, patch);
  rerender();
}

function applyAnimalPatch(row: FarmAnimalStartInstance, patch: Partial<FarmAnimalStartInstance>): FarmAnimalStartInstance {
  const clearingHome = ("buildingId" in patch || "housingPlacementId" in patch)
    && patch.buildingId === undefined
    && patch.housingPlacementId === undefined;
  if (clearingHome) {
    const { buildingId: _b, housingPlacementId: _h, ...base } = { ...row, ...patch };
    return base;
  }
  if (patch.housingPlacementId !== undefined) {
    const { buildingId: _legacy, ...base } = { ...row, ...patch };
    return { ...base, housingPlacementId: patch.housingPlacementId };
  }
  if (patch.buildingId !== undefined) {
    const { housingPlacementId: _placement, ...base } = { ...row, ...patch };
    return { ...base, buildingId: patch.buildingId };
  }
  if ("housingPlacementId" in patch && patch.housingPlacementId === undefined) {
    const { housingPlacementId: _h, ...base } = { ...row, ...patch };
    return base;
  }
  if ("buildingId" in patch && patch.buildingId === undefined) {
    const { buildingId: _b, ...base } = { ...row, ...patch };
    return base;
  }
  return { ...row, ...patch };
}

function exclusiveHomePatch(
  _row: FarmAnimalStartInstance,
  patch: Partial<FarmAnimalStartInstance>,
): Partial<FarmAnimalStartInstance> {
  return patch;
}

function encodeAnimalHome(record: Pick<FarmAnimalStartInstance, "buildingId" | "housingPlacementId">): string {
  if (record.housingPlacementId !== undefined) return `placement:${record.housingPlacementId}`;
  if (record.buildingId !== undefined) return `legacy:${record.buildingId}`;
  return "";
}

function decodeAnimalHomePatch(value: string): Partial<FarmAnimalStartInstance> {
  if (!value) return { buildingId: undefined, housingPlacementId: undefined };
  if (value.startsWith("placement:")) {
    return { housingPlacementId: value.slice("placement:".length), buildingId: undefined };
  }
  if (value.startsWith("legacy:")) {
    return { buildingId: value.slice("legacy:".length), housingPlacementId: undefined };
  }
  return { buildingId: undefined, housingPlacementId: undefined };
}

function homePickerRow(
  instanceId: string,
  value: string,
  options: readonly { readonly value: string; readonly label: string }[],
  onChange: (value: string) => void,
): HTMLElement {
  const select = el("select", {
    dataset: { testid: `db-farm-animal-home-${instanceId}` },
    on: { change: (event) => onChange((event.currentTarget as HTMLSelectElement).value) },
    children: options.map((entry) => el("option", {
      text: entry.label,
      attrs: { value: entry.value, ...(entry.value === value ? { selected: "" } : {}) },
    })),
  });
  return field("집", select);
}

function animalHomeOptions(
  project: Project,
  record: FarmAnimalStartInstance,
  buildings: readonly FarmAnimalBuildingDefinition[],
  animals: readonly FarmAnimalStartInstance[],
): { readonly options: { value: string; label: string }[]; readonly invalidCurrent: boolean } {
  const options: { value: string; label: string }[] = [{ value: "", label: "배정 안 함" }];
  const current = encodeAnimalHome(record);
  let invalidCurrent = false;

  for (const building of buildings) {
    const value = `legacy:${building.id}`;
    const occupants = animals.filter((animal) => animal.instanceId !== record.instanceId && animal.buildingId === building.id).length;
    const allowed = building.allowedSpeciesIds.includes(record.speciesId);
    const full = occupants >= building.capacity;
    const isCurrent = current === value;
    if ((!allowed || full) && !isCurrent) continue;
    if (isCurrent && (!allowed || full)) invalidCurrent = !allowed;
    options.push({
      value,
      label: full && isCurrent
        ? `축사 · ${building.name} (현재 · 정원 참)`
        : `축사 · ${building.name}`,
    });
  }

  for (const placement of project.session.farmBuildingPlacements ?? []) {
    const type = project.database.farmBuildingTypes?.find((entry) => entry.id === placement.typeId);
    const level = type?.levels.find((entry) => entry.level === placement.level);
    if (!type?.animalHousing || level?.animalCapacity === undefined) continue;
    const value = `placement:${placement.instanceId}`;
    const allowed = type.animalHousing.allowedSpeciesIds.includes(record.speciesId);
    const occupants = animals.filter((animal) => animal.instanceId !== record.instanceId && animal.housingPlacementId === placement.instanceId).length;
    const full = occupants >= level.animalCapacity;
    const isCurrent = current === value;
    if ((!allowed || full) && !isCurrent) continue;
    if (isCurrent && !allowed) invalidCurrent = true;
    const typeName = type.name;
    options.push({
      value,
      label: full && isCurrent
        ? `배치 · ${typeName} · ${placement.instanceId} (현재 · 정원 참)`
        : `배치 · ${typeName} · ${placement.instanceId}`,
    });
  }

  if (current && !options.some((entry) => entry.value === current)) {
    invalidCurrent = true;
    options.push({ value: current, label: `${current} (유효하지 않음)` });
  }
  return { options, invalidCurrent };
}

function clampInt(value: string, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.trunc(parsed))) : min;
}

function uniqueId(base: string, used: ReadonlySet<string>): string { let id = base; let suffix = 2; while (used.has(id)) id = `${base}_${suffix++}`; return id; }
