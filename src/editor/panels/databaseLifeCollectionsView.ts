import { FARMING_LIFE_UI_ASSETS } from "@/assets/farmingLifeUi";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { store } from "@/project/store";
import { el } from "@/util/dom";
import { genId } from "@/util/id";
import { toast } from "@/util/toast";

export function renderLifeCollectionsTab(host: HTMLElement, rerender: () => void): void {
  const project = store.getCurrent();
  const fishCount = project.database.fishSpecies?.length ?? 0;
  const spotCount = project.system.fishing?.spots.length ?? 0;
  const forageCount = project.system.seasonalForage?.areas.length ?? 0;
  const museumCount = project.system.museum?.rewards.length ?? 0;
  const isEmpty = fishCount === 0 && spotCount === 0 && forageCount === 0 && museumCount === 0;
  host.append(el("section", {
    class: "db-life-authoring-workspace db-life-collections-workspace",
    dataset: { testid: "db-life-collections-workspace" },
    children: [
      el("header", {
        class: "db-spatial-hero db-life-collections-hero",
        dataset: { testid: "db-life-collections-hero" },
        children: [
        el("img", {
          attrs: { src: FARMING_LIFE_UI_ASSETS.foraging, alt: "계절 채집과 수집 도감", loading: "lazy" },
          dataset: { testid: "db-life-collections-hero-image" },
        }),
        el("div", { children: [
          el("span", { class: "db-life-panel-eyebrow", text: "발견과 기록" }),
          el("h2", { text: "낚시·채집·박물관" }),
          el("p", { text: "물고기 출현 조건, 계절 채집 구역, 수집 기록과 박물관 보상을 연결합니다." }),
        ] }),
        ],
      }),
      ...(isEmpty
        ? [el("div", {
            class: "empty-state empty-state--large empty-state--inset db-studio-empty",
            dataset: { testid: "db-life-collections-empty" },
            children: [
              el("span", { class: "empty-state__icon", text: "🎣", attrs: { "aria-hidden": "true" } }),
              el("h3", { class: "empty-state__title", text: "아직 등록된 컬렉션이 없습니다" }),
              el("p", { class: "empty-state__desc", text: "기본값을 만들면 물고기, 낚시터, 채집 구역, 박물관 보상이 연결된 상태로 채워집니다." }),
              el("button", {
                class: "empty-state__action empty-state__action--primary",
                text: "기본 생활 컬렉션 만들기",
                attrs: { type: "button" },
                dataset: { testid: "db-life-collections-seed-defaults" },
                on: { click: () => seedDefaults(rerender) },
              }),
            ],
          })]
        : [el("div", {
            class: "db-life-toolbar",
            dataset: { testid: "db-life-collections-toolbar" },
            children: [
              el("span", { text: `물고기 ${fishCount} · 낚시터 ${spotCount} · 채집 구역 ${forageCount} · 박물관 보상 ${museumCount}` }),
            ],
          })]),
      ...(isEmpty ? [] : [
        section("물고기", "낚시에 잡히는 물고기와 실제 지급 아이템입니다.", "fish", (project.database.fishSpecies ?? []).map((row) => recordCard("fish", row.id, row.name, `${row.itemId}`, rerender, row.id)), addButton("물고기 추가", "db-life-collections-add-fish", () => addFish(rerender))),
        section("낚시터", "맵·영역·계절·시간·날씨별 출현 표입니다.", "fishing", (project.system.fishing?.spots ?? []).map((row) => recordCard("fishing", row.id, row.name ?? row.id, `${row.mapId} · ${row.catches.length}종`, rerender)), addButton("낚시터 추가", "db-life-collections-add-spot", () => addSpot(rerender))),
        section("계절 채집", "날짜별로 다시 생성되고 계절 전환 때 정리되는 채집 구역입니다.", "forage", (project.system.seasonalForage?.areas ?? []).map((row) => recordCard("forage", row.id, row.name ?? row.id, `${row.mapId} · 하루 ${row.dailySpawnCount}개`, rerender)), addButton("채집 구역 추가", "db-life-collections-add-forage", () => addForage(rerender))),
        section("박물관·수집 도감", "발견·출하·낚시·기부 기록과 한 번만 받는 보상입니다.", "museum", (project.system.museum?.rewards ?? []).map((row) => recordCard("museum", row.id, row.name ?? row.id, row.minDonations ? `${row.minDonations}개 기부` : `${row.requiredItemIds?.length ?? 0}종 지정`, rerender)), addButton("박물관 보상 추가", "db-life-collections-add-museum", () => addMuseumReward(rerender))),
      ]),
    ],
  }));
}

function section(title: string, description: string, id: string, rows: HTMLElement[], action: HTMLElement): HTMLElement {
  return el("section", { class: "db-life-card db-life-collections-section", dataset: { testid: `db-life-collections-${id}` }, children: [
    el("h3", { text: title }), el("p", { text: description }),
    ...(rows.length ? rows : [el("p", { class: "empty-state__desc", text: "아직 등록된 내용이 없습니다." })]), action,
  ] });
}
type LifeCollectionKind = "fish" | "fishing" | "forage" | "museum";
function recordCard(kind: LifeCollectionKind, id: string, title: string, detail: string, rerender: () => void, tooltipId?: string): HTMLElement {
  return el("article", { class: "db-life-record-card", children: [
    el("input", {
      class: "input",
      attrs: { type: "text", value: title, "aria-label": `${title} 이름`, ...(tooltipId ? { title: tooltipId } : {}) },
      dataset: { testid: `db-life-collections-name-${kind}-${id}` },
      on: { change: (event) => renameRecord(kind, id, (event.currentTarget as HTMLInputElement).value, rerender) },
    }),
    el("span", { class: "db-list-meta", text: detail, attrs: tooltipId ? { title: tooltipId } : {} }),
    el("button", {
      class: "btn small danger",
      text: "삭제",
      attrs: { type: "button" },
      dataset: { testid: `db-life-collections-delete-${kind}-${id}` },
      on: { click: () => deleteRecord(kind, id, rerender) },
    }),
  ] });
}
function addButton(label: string, testid: string, action: () => void): HTMLElement { return el("button", { class: "btn small", text: label, attrs: { type: "button" }, dataset: { testid }, on: { click: action } }); }

function seedDefaults(rerender: () => void): void {
  const project = store.getCurrent();
  const items = project.database.items;
  const map = project.maps[project.startMapId] ?? Object.values(project.maps)[0];
  if (!map || items.length === 0) { toast("먼저 아이템과 맵을 준비하세요.", "error"); return; }
  const fishItem = items[0]!.id;
  const forageItem = items[1]?.id ?? fishItem;
  const rewardItem = items[2]?.id ?? forageItem;
  recordProjectSnapshot("기본 낚시·채집·박물관 만들기");
  store.update((draft) => {
    const fishId = uniqueId("fish_river", new Set((draft.database.fishSpecies ?? []).map((row) => row.id)));
    const spotId = uniqueId("fishing_spot_river", new Set((draft.system.fishing?.spots ?? []).map((row) => row.id)));
    const areaId = uniqueId("forage_area_farm", new Set((draft.system.seasonalForage?.areas ?? []).map((row) => row.id)));
    draft.database.fishSpecies = [...(draft.database.fishSpecies ?? []), { id: fishId, name: "강 물고기", itemId: fishItem, skillXp: 8 }];
    draft.system.fishing = { enabled: true, energyCost: 2, spots: [...(draft.system.fishing?.spots ?? []), {
      id: spotId, name: "강 낚시터", mapId: map.id, area: safeRect(map.width, map.height), catches: [{ fishId, weight: 1, seasons: ["spring", "summer", "fall"], timePhases: ["morning", "day"], weatherKinds: ["none", "rain"] }],
    }] };
    draft.system.seasonalForage = { enabled: true, areas: [...(draft.system.seasonalForage?.areas ?? []), {
      id: areaId, name: "농장 채집 구역", mapId: map.id, area: safeRect(map.width, map.height), dailySpawnCount: 2, maxActive: 6, despawnAfterDays: 3,
      entries: [{ id: "forage_seasonal", weight: 1, seasonalDrops: { spring: forageItem, summer: forageItem, fall: forageItem, winter: forageItem } }],
    }] };
    draft.system.collections = { enabled: true, trackedItemIds: [...new Set([...(draft.system.collections?.trackedItemIds ?? []), fishItem, forageItem, rewardItem])] };
    draft.system.museum = { enabled: true, eligibleItemIds: [...new Set([...(draft.system.museum?.eligibleItemIds ?? []), fishItem])], rewards: [
      ...(draft.system.museum?.rewards ?? []),
      { id: uniqueId("museum_first_donation", new Set((draft.system.museum?.rewards ?? []).map((row) => row.id))), name: "첫 기부", minDonations: 1, reward: { itemRewards: [{ itemId: rewardItem, count: 1 }] } },
    ] };
  });
  toast("낚시·채집·수집 도감·박물관 기본값을 만들었습니다.", "ok");
  rerender();
}

function renameRecord(kind: LifeCollectionKind, id: string, name: string, rerender: () => void): void {
  const nextName = name.trim();
  if (!nextName) return;
  recordProjectSnapshot("생활 콜렉션 이름 변경");
  store.update((draft) => {
    if (kind === "fish") draft.database.fishSpecies = (draft.database.fishSpecies ?? []).map((row) => row.id === id ? { ...row, name: nextName } : row);
    if (kind === "fishing" && draft.system.fishing) draft.system.fishing = { ...draft.system.fishing, spots: draft.system.fishing.spots.map((row) => row.id === id ? { ...row, name: nextName } : row) };
    if (kind === "forage" && draft.system.seasonalForage) draft.system.seasonalForage = { ...draft.system.seasonalForage, areas: draft.system.seasonalForage.areas.map((row) => row.id === id ? { ...row, name: nextName } : row) };
    if (kind === "museum" && draft.system.museum) draft.system.museum = { ...draft.system.museum, rewards: draft.system.museum.rewards.map((row) => row.id === id ? { ...row, name: nextName } : row) };
  });
  rerender();
}

function deleteRecord(kind: LifeCollectionKind, id: string, rerender: () => void): void {
  recordProjectSnapshot("생활 콜렉션 항목 삭제");
  store.update((draft) => {
    if (kind === "fish") {
      draft.database.fishSpecies = (draft.database.fishSpecies ?? []).filter((row) => row.id !== id);
      if (draft.system.fishing) {
        draft.system.fishing = {
          ...draft.system.fishing,
          spots: draft.system.fishing.spots
            .map((spot) => ({ ...spot, catches: spot.catches.filter((row) => row.fishId !== id) }))
            .filter((spot) => spot.catches.length > 0),
        };
      }
    }
    if (kind === "fishing" && draft.system.fishing) draft.system.fishing = { ...draft.system.fishing, spots: draft.system.fishing.spots.filter((row) => row.id !== id) };
    if (kind === "forage" && draft.system.seasonalForage) draft.system.seasonalForage = { ...draft.system.seasonalForage, areas: draft.system.seasonalForage.areas.filter((row) => row.id !== id) };
    if (kind === "museum" && draft.system.museum) draft.system.museum = { ...draft.system.museum, rewards: draft.system.museum.rewards.filter((row) => row.id !== id) };
  });
  rerender();
}

function addFish(rerender: () => void): void { const itemId = store.getCurrent().database.items[0]?.id; if (!itemId) return; recordProjectSnapshot("물고기 추가"); store.update((draft) => { draft.database.fishSpecies ??= []; draft.database.fishSpecies.push({ id: genId("fish"), name: "새 물고기", itemId, skillXp: 1 }); }); rerender(); }
function addSpot(rerender: () => void): void { const project = store.getCurrent(); const fish = project.database.fishSpecies?.[0]; const map = project.maps[project.startMapId]; if (!fish || !map) return; recordProjectSnapshot("낚시터 추가"); store.update((draft) => { const fishing = draft.system.fishing ?? { enabled: true, spots: [] }; draft.system.fishing = { ...fishing, spots: [...fishing.spots, { id: genId("fishing_spot"), mapId: map.id, area: safeRect(map.width, map.height), catches: [{ fishId: fish.id, weight: 1 }] }] }; }); rerender(); }
function addForage(rerender: () => void): void { const project = store.getCurrent(); const item = project.database.items[0]; const map = project.maps[project.startMapId]; if (!item || !map) return; recordProjectSnapshot("채집 구역 추가"); store.update((draft) => { const seasonalForage = draft.system.seasonalForage ?? { enabled: true, areas: [] }; draft.system.seasonalForage = { ...seasonalForage, areas: [...seasonalForage.areas, { id: genId("forage_area"), mapId: map.id, area: safeRect(map.width, map.height), dailySpawnCount: 1, maxActive: 3, despawnAfterDays: 2, entries: [{ id: genId("forage"), itemId: item.id, weight: 1 }] }] }; }); rerender(); }
function addMuseumReward(rerender: () => void): void { const item = store.getCurrent().database.items[0]; if (!item) return; recordProjectSnapshot("박물관 보상 추가"); store.update((draft) => { const museum = draft.system.museum ?? { enabled: true, eligibleItemIds: [item.id], rewards: [] }; draft.system.museum = { ...museum, rewards: [...museum.rewards, { id: genId("museum_reward"), minDonations: 1, reward: { itemRewards: [{ itemId: item.id, count: 1 }] } }] }; }); rerender(); }
function safeRect(width: number, height: number) { return { x: 0, y: 0, w: Math.max(1, Math.min(4, width)), h: Math.max(1, Math.min(4, height)) }; }
function uniqueId(base: string, used: ReadonlySet<string>): string { let id = base; let suffix = 2; while (used.has(id)) id = `${base}_${suffix++}`; return id; }
