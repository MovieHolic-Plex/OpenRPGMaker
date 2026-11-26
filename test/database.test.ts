import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderDatabasePanel, setDatabaseActiveTab, refreshDatabasePanel, TAB_GROUPS } from "@/editor/panels/database";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { createBlankProject } from "@/project/defaults";
import { serialize, deserialize } from "@/project/io";
import { store } from "@/project/store";
import type { FarmAnimalStartInstance, FarmBuildingLevelDefinition, FarmBuildingTypeRecord } from "@/project/types";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";
import { isolateTimers } from "./mergedTeardown";

vi.mock("../electron/shared/lifeSim", () => ({ LIFE_SIM_ENABLED: true, LIFE_SIM_CLOSED_TITLE: "", LIFE_SIM_CLOSED_BODY: "", LIFE_SIM_CLOSED_NOTICE: "" }));

describe("animalHousingSummaryMetrics", () => {
  isolateTimers();
  let restoreDom: (() => void) | undefined;
  let previousWindow: typeof globalThis.window | undefined;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(new Date("2026-09-08T00:00:00Z"));
    restoreDom = installFakeDom();
    previousWindow = globalThis.window;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { localStorage: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined } },
    });
    store.replace(createBlankProject());
    resetMapEditHistory();
    setDatabaseActiveTab("actors");
  });
  afterEach(() => {
    resetMapEditHistory();
    vi.clearAllTimers();
    vi.useRealTimers();
    restoreDom?.();
    if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
    else Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
  });
  function renderAnimalsTab(): FakeElement {
    const host = document.createElement("div") as unknown as FakeElement;
    host.className = "database-modal-body";
    renderDatabasePanel(host as unknown as HTMLElement);
    const tab = findByTestId(host, "db-tab-farm-animals");
    if (!tab) throw new Error("missing farm animals tab");
    tab.click();
    return host;
  }
  function parseStats(host: FakeElement): {
    readonly homes: number;
    readonly free: number;
    readonly used: number;
    readonly capacity: number;
  } {
    const strip = findByTestId(host, "db-farm-animals-stats");
    if (!strip) throw new Error("missing db-farm-animals-stats");
    const tiles = strip.querySelectorAll(".db-ws-stat");
    const byLabel = new Map<string, { value: string; hint: string }>();
    for (const tile of tiles) {
      const label = tile.querySelector(".db-ws-stat-label")?.textContent?.trim() ?? "";
      const value = tile.querySelector(".db-ws-stat-value")?.textContent?.trim() ?? "";
      const hint = tile.querySelector(".db-ws-stat-hint")?.textContent?.trim() ?? "";
      byLabel.set(label, { value, hint });
    }
    const homes = byLabel.get("축사");
    const free = byLabel.get("수용 여유");
    if (!homes || !free) throw new Error(`stats missing homes/free: ${[...byLabel.keys()].join(",")}`);
    const freeMatch = /^(-?\d+)/.exec(free.value);
    const usedMatch = /^(-?\d+)\s*\/\s*(-?\d+)/.exec(free.hint);
    if (!freeMatch || !usedMatch) {
      throw new Error(`unparseable free stats value=${free.value} hint=${free.hint}`);
    }
    return {
      homes: Number(homes.value),
      free: Number(freeMatch[1]),
      used: Number(usedMatch[1]),
      capacity: Number(usedMatch[2]),
    };
  }
  function seedSpecies(): void {
    const project = store.getCurrent();
    const feedId = project.database.items[0]?.id;
    const productId = project.database.items[1]?.id ?? feedId;
    if (!feedId || !productId) throw new Error("blank project needs items");
    store.update((draft) => {
      draft.database.farmAnimalSpecies = [
        {
          id: "chicken",
          name: "닭",
          feedItemId: feedId,
          productItemId: productId,
          productCount: 1,
          productEveryDays: 1,
          petFriendship: 10,
        },
        {
          id: "cow",
          name: "소",
          feedItemId: feedId,
          productItemId: productId,
          productCount: 1,
          productEveryDays: 1,
          petFriendship: 8,
        },
      ];
    });
  }
  function level(partial: Partial<FarmBuildingLevelDefinition> & Pick<FarmBuildingLevelDefinition, "level" | "animalCapacity">): FarmBuildingLevelDefinition {
    return {
      footprint: { width: 2, height: 2 },
      capacity: 99,
      graphicResourceId: "gfx",
      ...partial,
    };
  }
  function seedHousingType(opts: {
    readonly id?: string;
    readonly name?: string;
    readonly levels: FarmBuildingLevelDefinition[];
    readonly allowedSpeciesIds?: string[];
    readonly animalHousing?: boolean;
  }): string {
    const id = opts.id ?? "coop_type";
    const record: FarmBuildingTypeRecord = {
      id,
      name: opts.name ?? "우리",
      levels: opts.levels,
      ...(opts.animalHousing === false
        ? {}
        : { animalHousing: { allowedSpeciesIds: opts.allowedSpeciesIds ?? ["chicken"] } }),
    };
    store.update((draft) => {
      draft.database.farmBuildingTypes = [...(draft.database.farmBuildingTypes ?? []), record];
    });
    return id;
  }
  function seedPlacement(opts: {
    readonly instanceId: string;
    readonly typeId: string;
    readonly level?: number;
    readonly x?: number;
    readonly y?: number;
  }): void {
    const project = store.getCurrent();
    store.update((draft) => {
      draft.session.farmBuildingPlacements = [
        ...(draft.session.farmBuildingPlacements ?? []),
        {
          instanceId: opts.instanceId,
          typeId: opts.typeId,
          level: opts.level ?? 1,
          mapId: project.startMapId,
          x: opts.x ?? 1,
          y: opts.y ?? 1,
          orientation: "down",
        },
      ];
    });
  }
  function seedLegacyBarn(opts?: { readonly id?: string; readonly capacity?: number; readonly species?: string[] }): void {
    store.update((draft) => {
      draft.system.farmAnimalBuildings = [
        ...(draft.system.farmAnimalBuildings ?? []),
        {
          id: opts?.id ?? "legacy_coop",
          name: "옛 축사",
          mapId: draft.startMapId,
          x: 2,
          y: 2,
          capacity: opts?.capacity ?? 3,
          allowedSpeciesIds: opts?.species ?? ["chicken"],
        },
      ];
    });
  }
  function seedAnimals(rows: FarmAnimalStartInstance[]): void {
    store.update((draft) => {
      draft.session.farmAnimals = rows;
    });
  }
  describe("animal housing summary metrics", () => {
    it("linked-only homes count placement capacity and occupancy", () => {
      seedSpecies();
      const typeId = seedHousingType({
        levels: [level({ level: 1, animalCapacity: 2 })],
      });
      seedPlacement({ instanceId: "placementA", typeId, x: 1, y: 1 });
      seedPlacement({ instanceId: "placementB", typeId, x: 4, y: 1 });
      seedAnimals([
        { instanceId: "a1", speciesId: "chicken", name: "A1", housingPlacementId: "placementA" },
        { instanceId: "a2", speciesId: "chicken", name: "A2", housingPlacementId: "placementA" },
      ]);

      const before = serialize(store.getCurrent());
      const stats = parseStats(renderAnimalsTab());
      const after = serialize(store.getCurrent());

      expect(after).toBe(before);
      expect(stats.homes).toBe(2);
      expect(stats.capacity).toBe(4);
      expect(stats.used).toBe(2);
      expect(stats.free).toBe(2);
    });

    it("legacy-only homes keep barn capacity and occupancy", () => {
      seedSpecies();
      seedLegacyBarn({ capacity: 3 });
      seedAnimals([
        { instanceId: "a1", speciesId: "chicken", name: "A1", buildingId: "legacy_coop" },
        { instanceId: "u1", speciesId: "chicken", name: "U1" },
      ]);

      const stats = parseStats(renderAnimalsTab());
      expect(stats.homes).toBe(1);
      expect(stats.capacity).toBe(3);
      expect(stats.used).toBe(1);
      expect(stats.free).toBe(2);
    });

    it("mixed legacy and linked homes sum without pooling capacity across placements", () => {
      seedSpecies();
      seedLegacyBarn({ id: "legacy_coop", capacity: 2 });
      const typeId = seedHousingType({
        levels: [
          level({ level: 1, animalCapacity: 1 }),
          level({ level: 2, animalCapacity: 5 }),
        ],
      });
      seedPlacement({ instanceId: "p_low", typeId, level: 1, x: 1, y: 1 });
      seedPlacement({ instanceId: "p_high", typeId, level: 2, x: 5, y: 1 });
      seedAnimals([
        { instanceId: "l1", speciesId: "chicken", name: "L1", buildingId: "legacy_coop" },
        { instanceId: "h1", speciesId: "chicken", name: "H1", housingPlacementId: "p_high" },
        { instanceId: "h2", speciesId: "chicken", name: "H2", housingPlacementId: "p_high" },
        { instanceId: "loose", speciesId: "chicken", name: "Loose" },
      ]);

      const stats = parseStats(renderAnimalsTab());
      // legacy 2 + level1 1 + level2 5 = 8; used = legacy1 + high2 = 3; free = 5
      expect(stats.homes).toBe(3);
      expect(stats.capacity).toBe(8);
      expect(stats.used).toBe(3);
      expect(stats.free).toBe(5);
    });

    it("ignores unassigned animals and invalid home refs for occupancy used count", () => {
      seedSpecies();
      const typeId = seedHousingType({
        levels: [level({ level: 1, animalCapacity: 2 })],
      });
      seedPlacement({ instanceId: "home", typeId });
      seedLegacyBarn({ id: "legacy_coop", capacity: 4 });
      seedAnimals([
        { instanceId: "ok_link", speciesId: "chicken", name: "OKL", housingPlacementId: "home" },
        { instanceId: "ok_legacy", speciesId: "chicken", name: "OKB", buildingId: "legacy_coop" },
        { instanceId: "unassigned", speciesId: "chicken", name: "U" },
        { instanceId: "bad_link", speciesId: "chicken", name: "BL", housingPlacementId: "missing-home" },
        { instanceId: "bad_legacy", speciesId: "chicken", name: "BB", buildingId: "missing-barn" },
        {
          instanceId: "dual",
          speciesId: "chicken",
          name: "D",
          buildingId: "legacy_coop",
          housingPlacementId: "home",
        },
      ]);

      const stats = parseStats(renderAnimalsTab());
      expect(stats.homes).toBe(2);
      expect(stats.capacity).toBe(6);
      expect(stats.used).toBe(2);
      expect(stats.free).toBe(4);
    });

    it("excludes non-housing placements from home and capacity totals", () => {
      seedSpecies();
      const housingId = seedHousingType({
        id: "house",
        levels: [level({ level: 1, animalCapacity: 3 })],
      });
      const shedId = seedHousingType({
        id: "shed",
        animalHousing: false,
        levels: [level({ level: 1, animalCapacity: 9 })],
      });
      seedPlacement({ instanceId: "house1", typeId: housingId });
      seedPlacement({ instanceId: "shed1", typeId: shedId, x: 6, y: 1 });
      seedAnimals([
        { instanceId: "a1", speciesId: "chicken", name: "A1", housingPlacementId: "house1" },
        { instanceId: "s1", speciesId: "chicken", name: "S1", housingPlacementId: "shed1" },
      ]);

      const stats = parseStats(renderAnimalsTab());
      expect(stats.homes).toBe(1);
      expect(stats.capacity).toBe(3);
      expect(stats.used).toBe(1);
      expect(stats.free).toBe(2);
    });

    it("shows zero totals when no relevant homes exist", () => {
      seedSpecies();
      seedAnimals([{ instanceId: "a1", speciesId: "chicken", name: "A1" }]);
      const stats = parseStats(renderAnimalsTab());
      expect(stats.homes).toBe(0);
      expect(stats.capacity).toBe(0);
      expect(stats.used).toBe(0);
      expect(stats.free).toBe(0);
    });
  });
});

describe("databaseNavMode", () => {
  isolateTimers();
  let restoreDom: (() => void) | null = null;
  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
    setDatabaseActiveTab("actors");
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = null;
  });
  function renderPanel(): FakeElement {
    const host = document.createElement("div") as unknown as FakeElement;
    renderDatabasePanel(host as unknown as HTMLElement);
    return host;
  }
  function directTabIds(node: FakeElement): string[] {
    return node.children
      .filter((child) => child.classList.contains("db-tab"))
      .map((child) => child.dataset.testid ?? "");
  }
  describe("database navigation", () => {
    it("groups the rail by category — no all-data disclosure", () => {
      const host = renderPanel();
      const nav = host.querySelector(".db-tabs");
      if (!nav) throw new Error("missing database navigation");

      // 예전 초보 레일은 자주 쓰는 6개만 깔고 남은 24개를 <details>「모든 자료」에 몰아넣었다.
      // 찾는 경로가 모드마다 갈리면 초보가 배운 자리가 표준에서 통하지 않는다 — 그룹으로 통일한다.
      expect(findByTestId(host, "db-nav-all")).toBeNull();
      // 라벨은 .db-tab-group-label 로 읽는다 — 헤더에는 접힘 부제와 배지도 들어가므로
      // textContent 를 그대로 쓰면 라벨 계약이 아니라 헤더 전체를 재게 된다.
      const groups = Array.from(nav.querySelectorAll(".db-tab-group-label")).map((group) => group.textContent);
      expect(groups).toContain("파티");
      expect(groups).toContain("전투");
      expect(groups).toContain("시스템");

      // 접힌 그룹 안에 있어도 모든 탭이 레일에 존재해야 한다(교차 탭 이동 계약).
      for (const testId of ["db-tab-overview", "db-tab-actors", "db-tab-items", "db-tab-switches"]) {
        expect(findByTestId(nav, testId)).not.toBeNull();
      }
      expect(findByTestId(nav, "db-tab-switches")?.closest("details")).toBeNull();
    });

    it("keeps 6 grouped navigation domains (story, party, battle, space, life, system)", () => {
      const host = renderPanel();
      const groups = host.querySelectorAll(".db-tab-group-label").map((group) => group.textContent);
      expect(groups).toEqual(["이야기", "파티", "전투", "공간", "생활", "시스템"]);
      expect(findByTestId(host, "db-nav-all")).toBeNull();
    });

    // 그룹은 늘 펼쳐진 구획이다(2026-09-24 개선안 C). 숨는 것은 레코드 0 인 목록 탭뿐이고,
    // 그 이름은 그룹 끝 「빈 탭 N개」 줄에 적힌다. 단위가 다른 것을 더한 그룹 합계 배지는 없앴다.
    it("그룹 머리는 라벨만 남고, 빈 목록 탭은 그룹 끝 한 줄로 접힌다", () => {
      const host = renderPanel();
      const world = findByTestId(host, "db-tab-group-world");
      const life = findByTestId(host, "db-tab-group-life");
      if (!world || !life) throw new Error("missing group header");

      expect(world.querySelector(".db-tab-group-label")?.textContent).toBe("공간");
      expect(world.dataset.tabCount).toBeUndefined();

      const railChildren = (host.querySelector(".db-tabs") as FakeElement).children;
      const start = railChildren.indexOf(life);
      const lifeRows: FakeElement[] = [];
      for (const child of railChildren.slice(start + 1)) {
        if (child.classList.contains("db-tab-group")) break;
        lifeRows.push(child);
      }
      const tabsInLife = lifeRows.filter((child) => child.classList.contains("db-tab"));
      const fold = lifeRows.find((child) => child.classList.contains("db-tab-fold"));
      if (!fold) throw new Error("missing life fold row");

      // 빈 프로젝트의 생활 탭은 모두 0건이다 — 전부 접히고 접기 줄이 그 수를 말한다.
      const folded = tabsInLife.filter((tab) => tab.hidden);
      expect(folded.length).toBe(tabsInLife.length);
      expect(fold.hidden).toBe(false);
      expect(fold.textContent).toContain(`빈 탭 ${folded.length}개`);
      expect(life.getAttribute("aria-expanded")).toBe("false");

      // 레코드가 있는 탭은 절대 접히지 않는다.
      for (const child of railChildren) {
        if (child.classList.contains("db-tab") && child.dataset.count) expect(child.hidden).toBe(false);
      }

      // 8684ab7daf: 접기 줄은 이름마다 단추다 — 줄 자체가 아니라 「+N」 단추(또는 탭 이름 단추)를 눌러야 그 그룹의 빈 탭이 펼쳐진다.
      // fakeDom 의 click() 은 버블링하지 않는다 — 접기 줄의 위임 핸들러에 닿도록 버블링 클릭을 보낸다.
      findByTestId(fold, "db-tab-fold-all-life")!.dispatchEvent(new Event("click", { bubbles: true }));
      expect(tabsInLife.every((tab) => !tab.hidden)).toBe(true);
      expect(fold.hidden).toBe(true);
      expect(life.getAttribute("aria-expanded")).toBe("true");
    });

    it("shows the full surface without an all-data disclosure", () => {
      const host = renderPanel();
      const nav = host.querySelector(".db-tabs");
      if (!nav) throw new Error("missing database navigation");

      expect(findByTestId(host, "db-nav-all")).toBeNull();
      expect(directTabIds(nav)).toContain("db-tab-spatial-tiles");
      expect(findByTestId(nav, "db-tab-spatial-tiles")?.closest("details")).toBeNull();
    });

    it("interview.genre 가 있는 프로젝트는 장르 프로필 탭을 「숨긴 탭 N개」로 접고 클릭·점프 시 펼친다", () => {
      store.update((project) => {
        project.gameDesignBrief = {
          version: 1,
          presetId: "story-cutscene",
          answers: {
            experience: { question: "q", label: "l", text: "a", source: "user" },
            activity: { question: "q", label: "l", text: "a", source: "user" },
            progression: { question: "q", label: "l", text: "a", source: "user" },
            detail: { question: "q", label: "l", text: "a", source: "user" },
            scope: { question: "q", label: "l", text: "a", source: "user" },
          },
          summary: "연애 기획",
          interview: {
            version: 1,
            genre: "romance",
            concept: "연애",
            protagonist: "주인공",
            notes: "",
            choiceIds: {},
          },
        };
      });
      const host = renderPanel();
      const battleFold = findByTestId(host, "db-tab-fold-battle")!;
      const partyFold = findByTestId(host, "db-tab-fold-party")!;
      expect(battleFold.hidden).toBe(false);
      expect(battleFold.textContent).toContain("숨긴 탭 9개");
      expect(findByTestId(host, "db-tab-enemies")?.hidden).toBe(true);
      expect(partyFold.hidden).toBe(false);
      expect(partyFold.textContent).toContain("숨긴 탭 2개");
      expect(findByTestId(host, "db-tab-classes")?.hidden).toBe(true);
      expect(findByTestId(host, "db-tab-skills")?.hidden).toBe(true);

      // 「모두 보기」 클릭 시 해당 그룹의 숨긴 탭이 모두 펼쳐진다.
      findByTestId(battleFold, "db-tab-fold-all-battle")!.dispatchEvent(new Event("click", { bubbles: true }));
      expect(battleFold.hidden).toBe(true);
      expect(findByTestId(host, "db-tab-enemies")?.hidden).toBe(false);
    });
  });
});

describe("databaseTabRenderReentry", () => {
  isolateTimers();
  /**
   * Task65 DOM channel B (save/refresh reentry).
   * Seam: refreshDatabasePanel → renderActiveTab → body.replaceChildren with focused
   * dirty farmSpatial nameInput → sync change → rerender → nested replaceChildren.
   * Native-r3 a6 pageError:
   * "Failed to execute 'replaceChildren' on 'Element': The node to be removed is no longer a child of this node. Perhaps it was moved in a 'blur' event handler?"
   * Pure UI fixture — not remote proof.
   *
   * RED provenance (guard stripped on agent/life-dom-reentry-20260908, 2026-09-08):
   * NotFoundError: Failed to execute 'replaceChildren'... blur event handler
   */

  let restoreDom: (() => void) | undefined;
  let previousWindow: typeof globalThis.window | undefined;
  beforeEach(() => {
    restoreDom = installFakeDom();
    previousWindow = globalThis.window;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage: {
          getItem: () => null,
          setItem: () => undefined,
          removeItem: () => undefined,
        },
      },
    });
    store.replace(createBlankProject());
    setDatabaseActiveTab("actors");
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = undefined;
    if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
    else Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
  });
  function renderPanel(): FakeElement {
    const host = document.createElement("div") as unknown as FakeElement;
    host.className = "database-modal-body";
    renderDatabasePanel(host as unknown as HTMLElement);
    return host;
  }
  function requireTestId(host: FakeElement, testid: string): FakeElement {
    const control = findByTestId(host, testid);
    if (!control) throw new Error(`missing control ${testid}`);
    return control;
  }
  function click(host: FakeElement, testid: string): void {
    requireTestId(host, testid).click();
  }
  function openSpatialWithBuilding(host: FakeElement): string {
    click(host, "db-tab-farm-spatial");
    const addEmpty = findByTestId(host, "db-spatial-empty-add-building-type");
    if (addEmpty) addEmpty.click();
    else click(host, "db-spatial-add-building-type");
    const buildingId = store.getCurrent().database.farmBuildingTypes?.[0]?.id;
    if (!buildingId) throw new Error("building type not created");
    return buildingId;
  }
  /** FakeDom blur skips change; Chrome fires change then clears focus. */
  function armChromeBlur(focused: FakeElement): void {
    focused.blur = () => {
      focused.dispatchEvent(new Event("change"));
      const doc = globalThis.document as unknown as { activeElement?: FakeElement | null };
      if (doc.activeElement === focused) doc.activeElement = null;
    };
  }
  function armNestedReplaceChildrenGuard(body: FakeElement, focused: FakeElement): {
    readonly maxDepth: () => number;
    readonly nestedAttempts: () => number;
  } {
    let depth = 0;
    let maxDepth = 0;
    let nestedAttempts = 0;
    const original = body.replaceChildren.bind(body);
    body.replaceChildren = (...children: FakeElement[]) => {
      depth += 1;
      maxDepth = Math.max(maxDepth, depth);
      if (depth > 1) {
        nestedAttempts += 1;
        depth -= 1;
        throw new DOMException(
          "Failed to execute 'replaceChildren' on 'Element': The node to be removed is no longer a child of this node. Perhaps it was moved in a 'blur' event handler?",
          "NotFoundError",
        );
      }
      try {
        const doc = globalThis.document as unknown as { activeElement?: FakeElement | null };
        if (doc.activeElement === focused) focused.dispatchEvent(new Event("change"));
        return original(...children);
      } finally {
        depth -= 1;
      }
    };
    return { maxDepth: () => maxDepth, nestedAttempts: () => nestedAttempts };
  }
  describe("database tab render reentry (Task65 DOM channel B)", () => {
    it("Given focused dirty farmSpatial name When refreshDatabasePanel Then no nested replaceChildren and model/UI keep the change commit", () => {
      const host = renderPanel();
      const buildingId = openSpatialWithBuilding(host);
      const nameInput = requireTestId(host, `db-spatial-building-name-${buildingId}`);
      nameInput.focus();
      // Change-only commit (nameInput commits on change; no prior input event).
      nameInput.value = "Dirty Coop Name";
      armChromeBlur(nameInput);

      const bodyEl = host.querySelector(".db-body");
      expect(bodyEl).toBeTruthy();
      const probe = armNestedReplaceChildrenGuard(bodyEl!, nameInput);

      expect(() => refreshDatabasePanel(host as unknown as HTMLElement)).not.toThrow();
      expect(probe.nestedAttempts()).toBe(0);
      expect(probe.maxDepth()).toBeGreaterThanOrEqual(1);

      expect(store.getCurrent().database.farmBuildingTypes?.[0]?.name).toBe("Dirty Coop Name");
      expect(findByTestId(host, `db-spatial-building-name-${buildingId}`)?.value).toBe("Dirty Coop Name");
    });

    it("Given a second dirty edit after the first save-refresh Then later mutation is not dropped", () => {
      const host = renderPanel();
      const buildingId = openSpatialWithBuilding(host);

      const editAndRefresh = (label: string): void => {
        const nameInput = requireTestId(host, `db-spatial-building-name-${buildingId}`);
        nameInput.focus();
        nameInput.value = label;
        armChromeBlur(nameInput);
        const bodyEl = host.querySelector(".db-body");
        expect(bodyEl).toBeTruthy();
        const probe = armNestedReplaceChildrenGuard(bodyEl!, nameInput);
        expect(() => refreshDatabasePanel(host as unknown as HTMLElement)).not.toThrow();
        expect(probe.nestedAttempts()).toBe(0);
        expect(store.getCurrent().database.farmBuildingTypes?.[0]?.name).toBe(label);
        expect(findByTestId(host, `db-spatial-building-name-${buildingId}`)?.value).toBe(label);
      };

      editAndRefresh("First Dirty");
      editAndRefresh("Second Dirty");
    });
  });
});

describe("p1LifeEditorAuthoring", () => {
  isolateTimers();
  let restoreDom: (() => void) | undefined;
  let previousWindow: typeof globalThis.window | undefined;
  beforeEach(() => {
    restoreDom = installFakeDom();
    previousWindow = globalThis.window;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage: {
          getItem: () => null,
          setItem: () => undefined,
          removeItem: () => undefined,
        },
      },
    });
    store.replace(createBlankProject());
    setDatabaseActiveTab("actors");
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = undefined;
    if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
    else Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
  });
  function renderPanel(): FakeElement {
    const host = document.createElement("div") as unknown as FakeElement;
    host.className = "database-modal-body";
    renderDatabasePanel(host as unknown as HTMLElement);
    return host;
  }
  describe("P1 life editor authoring", () => {
    it("exposes honest season/weather and animal/building tabs inside the life group", () => {
      const life = TAB_GROUPS.find((group) => group.label === "생활");
      expect(life?.tabs).toEqual(["crops", "lifeCrafting", "dailyWeather", "farmAnimals", "farmSpatial", "lifeCollections"]);

      const host = renderPanel();
      expect(findByTestId(host, "db-tab-daily-weather")?.textContent).toBe("계절·날씨");
      expect(findByTestId(host, "db-tab-farm-animals")?.textContent).toBe("동물·축사");
    });

    it("seeds a usable four-season weather table instead of leaving an empty shell", () => {
      const host = renderPanel();
      findByTestId(host, "db-tab-daily-weather")?.click();
      findByTestId(host, "db-weather-seed-defaults")?.click();

      const weather = store.getCurrent().system.dailyWeather;
      expect(weather?.enabled).toBe(true);
      expect(weather?.forecastDays).toBe(3);
      expect(Object.keys(weather?.seasons ?? {})).toEqual(["spring", "summer", "fall", "winter"]);
      expect(weather?.seasons.spring?.map((rule) => rule.kind)).toEqual(["none", "rain", "storm"]);
      expect(findByTestId(host, "db-weather-workspace")).toBeTruthy();
    });

    it("creates connected species, building, and starting-animal records from the empty state", () => {
      const host = renderPanel();
      findByTestId(host, "db-tab-farm-animals")?.click();
      findByTestId(host, "db-farm-animals-seed-defaults")?.click();

      const project = store.getCurrent();
      expect(project.database.farmAnimalSpecies).toHaveLength(2);
      expect(project.system.farmAnimalBuildings).toHaveLength(1);
      expect(project.session.farmAnimals).toHaveLength(2);
      expect(project.session.farmAnimals?.every((animal) => animal.buildingId === project.system.farmAnimalBuildings?.[0]?.id)).toBe(true);
      expect(findByTestId(host, "db-farm-animals-workspace")).toBeTruthy();

      const reloaded = deserialize(serialize(project));
      expect(reloaded.database.farmAnimalSpecies).toEqual(project.database.farmAnimalSpecies);
      expect(reloaded.system.farmAnimalBuildings).toEqual(project.system.farmAnimalBuildings);
      expect(reloaded.session.farmAnimals).toEqual(project.session.farmAnimals);
    });
  });
});

describe("p2EditorAuthoring", () => {
  isolateTimers();
  let restoreDom: (() => void) | undefined;
  let previousWindow: typeof globalThis.window | undefined;
  beforeEach(() => {
    restoreDom = installFakeDom();
    previousWindow = globalThis.window;
    Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: { getItem: () => null, setItem: () => undefined } } });
    store.replace(createBlankProject());
    setDatabaseActiveTab("actors");
  });
  afterEach(() => {
    restoreDom?.();
    if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
    else Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
  });
  function renderPanel(): FakeElement {
    const host = document.createElement("div") as unknown as FakeElement;
    host.className = "database-modal-body";
    renderDatabasePanel(host as unknown as HTMLElement);
    return host;
  }
  describe("P2 database authoring", () => {
    it("places a dedicated fishing, forage, and museum tab in the life group", () => {
      // Break caught: P2 definitions exist only as raw JSON with no discoverable editor route.
      const life = TAB_GROUPS.find((group) => group.label === "생활");
      expect(life?.tabs).toContain("lifeCollections");
      const host = renderPanel();
      const tab = findByTestId(host, "db-tab-life-collections");
      expect(tab?.textContent).toBe("낚시·채집·박물관");
      tab?.click();
      expect(findByTestId(host, "db-life-collections-hero-image")?.getAttribute("src")).toMatch(/foraging-card\.png$/);
    });

    it("seeds connected definitions and exposes all four authoring sections", () => {
      // Break caught: the custom tab creates empty shells or disconnected ids that fail reload.
      const host = renderPanel();
      findByTestId(host, "db-tab-life-collections")?.click();
      expect(findByTestId(host, "db-life-collections-workspace")).toBeTruthy();
      expect(findByTestId(host, "db-life-collections-empty")).toBeTruthy();
      for (const section of ["fish", "fishing", "forage", "museum"]) {
        expect(findByTestId(host, `db-life-collections-${section}`)).toBeFalsy();
      }
      findByTestId(host, "db-life-collections-seed-defaults")?.click();
      for (const section of ["fish", "fishing", "forage", "museum"]) {
        expect(findByTestId(host, `db-life-collections-${section}`)).toBeTruthy();
      }

      const project = store.getCurrent();
      expect(project.database.fishSpecies).toHaveLength(1);
      expect(project.system.fishing?.spots).toHaveLength(1);
      expect(project.system.seasonalForage?.areas).toHaveLength(1);
      expect(project.system.collections?.enabled).toBe(true);
      expect(project.system.museum?.rewards).toHaveLength(1);
      expect(() => deserialize(serialize(project))).not.toThrow();

      const fishName = findByTestId(host, "db-life-collections-name-fish-fish_river");
      if (!fishName) throw new Error("missing structured fish editor");
      fishName.value = "은빛 강 물고기";
      fishName.dispatchEvent(new Event("change"));
      expect(store.getCurrent().database.fishSpecies?.[0]?.name).toBe("은빛 강 물고기");

      findByTestId(host, "db-life-collections-delete-fishing-fishing_spot_river")?.click();
      expect(store.getCurrent().system.fishing?.spots).toEqual([]);
      expect(store.getCurrent().system.seasonalForage?.areas).toHaveLength(1);
      expect(store.getCurrent().system.museum?.rewards).toHaveLength(1);
    });
  });
});
