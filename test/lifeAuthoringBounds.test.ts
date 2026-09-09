// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderCharactersTab } from "@/editor/panels/databaseCharacterView";
import { renderDailyWeatherTab } from "@/editor/panels/databaseDailyWeatherView";
import { renderLifeCraftingTab } from "@/editor/panels/databaseLifeCraftingView";
import { getMapEditHistoryState, resetMapEditHistory } from "@/editor/mapEditHistory";
import { _resetEditActivityForTest } from "@/editor/editActivityLog";
import { createBlankProject } from "@/project/defaults";
import { dailyWeatherForecast } from "@/project/dailyWeather";
import { deserialize, serialize } from "@/project/io";
import { store } from "@/project/store";
import { startSession } from "@/project/session";
import { playGiftSelection } from "@/player/playSceneGift";
import { runCommands, runEvent } from "@/player/playSceneInterpreter";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { renderCropTab } from "@/editor/panels/databaseCropView";

function fixture() {
  const project = createBlankProject();
  project.system.timeSystem = { enabled: true, daysPerSeason: 40 };
  project.characters = { resident: { displayName: "Profile name", birthday: { season: "spring", day: 40 } } };
  project.switches.push({ id: "reward", name: "Reward" });
  project.database.lifeSkills = [{ id: "skill", name: "Skill", skillType: "farming", maxLevel: 10, levelUpRewards: [{ level: 1, switchId: "reward" }] }];
  project.system.dailyWeather = { enabled: true, seasons: { spring: [{ kind: "rain", weight: 1 }] } };
  // Establish the existing load normalization before testing render/roundtrip purity.
  return deserialize(serialize(project));
}

function mount(render: (host: HTMLElement, rerender: () => void) => void) {
  const host = document.createElement("div");
  document.body.append(host);
  const rerender = () => { host.replaceChildren(); render(host, rerender); };
  rerender();
  return host;
}

function control<T extends HTMLElement = HTMLInputElement>(host: HTMLElement, id: string): T {
  const node = host.querySelector<T>(`[data-testid="${id}"]`);
  if (!node) throw new Error(`Missing control ${id}`);
  return node;
}

beforeEach(() => {
  store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false });
  store.replace(fixture());
  resetMapEditHistory();
  _resetEditActivityForTest();
});
afterEach(() => { _resetEditActivityForTest(); document.body.replaceChildren(); });

describe("authoring bounds", () => {
  it("accepts day40 in a 40-day calendar and bounds new input to that calendar", () => {
    const host = mount(renderCharactersTab);
    control(host, "db-character-row-resident").click();
    const day = control(host, "db-character-birthday-day");
    expect(day.max).toBe("40");
    day.value = "40";
    day.dispatchEvent(new Event("input"));
    expect(store.getCurrent().characters?.resident.birthday?.day).toBe(40);
    day.value = "41";
    day.dispatchEvent(new Event("change"));
    expect(day.value).toBe("40");
    expect(store.getCurrent().characters?.resident.birthday?.day).toBe(40);
  });

  it("diagnoses day29 in a 28-day calendar without silently changing it", () => {
    store.update((project) => { project.system.timeSystem = { enabled: true, daysPerSeason: 28 }; project.characters!.resident = { ...project.characters!.resident, birthday: { season: "spring", day: 29 } }; });
    const before = serialize(store.getCurrent());
    const host = mount(renderCharactersTab);
    control(host, "db-character-row-resident").click();
    const day = control(host, "db-character-birthday-day");
    expect(day.value).toBe("29");
    expect(day.max).toBe("28");
    expect(day.getAttribute("aria-invalid")).toBe("true");
    expect(control(host, "db-character-birthday-warning").hidden).toBe(false);
    expect(serialize(store.getCurrent())).toBe(before);
  });

  it("shows effective omitted weather values without authoring them", () => {
    const before = serialize(store.getCurrent());
    const host = mount(renderDailyWeatherTab);
    expect(control(host, "db-weather-forecast-days").value).toBe("1");
    expect(host.querySelector<HTMLInputElement>('input[type="range"]')?.value).toBe("0.5");
    expect(serialize(store.getCurrent())).toBe(before);
  });

  it("rejects both 129th-rule add controls without mutation or an undo entry", () => {
    store.update((project) => { project.system.dailyWeather!.seasons.spring = Array.from({ length: 128 }, () => ({ kind: "rain", weight: 1 })); });
    const before = serialize(store.getCurrent());
    const host = mount(renderDailyWeatherTab);
    let mutations = 0;
    const history = getMapEditHistoryState();
    const unsubscribe = store.subscribe(() => { mutations += 1; });
    control(host, "db-weather-add-spring").click();
    control(host, "db-weather-add-rule-spring").click();
    unsubscribe();
    expect(store.getCurrent().system.dailyWeather!.seasons.spring).toHaveLength(128);
    expect(mutations).toBe(0);
    expect(getMapEditHistoryState()).toEqual(history);
    expect(serialize(store.getCurrent())).toBe(before);
  });

  it("caps skill input at10, starts new rewards at2, and retains legacy level1", () => {
    const host = mount(renderLifeCraftingTab);
    control(host, "db-life-section-skills").click();
    const max = control(host, "db-life-skill-max-level");
    expect(max.max).toBe("10");
    max.value = "11";
    max.dispatchEvent(new Event("change"));
    expect(max.value).toBe("10");
    expect(store.getCurrent().database.lifeSkills![0].maxLevel).toBe(10);
    control(host, "db-life-skill-reward-add").click();
    expect(store.getCurrent().database.lifeSkills![0].levelUpRewards.map((r) => r.level)).toEqual([1, 2]);
    const level = control(host, "db-life-skill-reward-level-1");
    expect([level.min, level.max]).toEqual(["2", "10"]);
    level.value = "15";
    level.dispatchEvent(new Event("change"));
    expect(level.value).toBe("10");
    expect(store.getCurrent().database.lifeSkills![0].levelUpRewards.map((r) => r.level)).toEqual([1, 10]);
  });

  it("refuses a new level-up reward when maxLevel is1", () => {
    store.update((project) => { project.database.lifeSkills![0] = { ...project.database.lifeSkills![0], maxLevel: 1 }; });
    const before = serialize(store.getCurrent());
    const host = mount(renderLifeCraftingTab);
    control(host, "db-life-section-skills").click();
    control(host, "db-life-skill-reward-add").click();
    expect(serialize(store.getCurrent())).toBe(before);
  });

  it.each([{ graphicStages: undefined }, { graphicStages: [] }, { graphicStages: [{ frame: 0, label: "Editor-only" }] }])("does not author crop graphics during rendering ($graphicStages)", ({ graphicStages }) => {
    store.update((project) => { project.database.crops = [{ id: "unlinked", name: "Crop", seedItemId: project.database.items[0].id, harvestItemId: project.database.items[0].id, harvestCount: 1, seasons: ["spring"], stages: [{ days: 2 }], ...(graphicStages === undefined ? {} : { graphicStages }) }]; });
    const before = serialize(store.getCurrent());
    mount(renderCropTab);
    expect(serialize(store.getCurrent())).toBe(before);
    expect(deserialize(before).database.crops![0].graphicStages).toEqual(graphicStages);
  });
});

// Real public gift/interpreter authorities; only the dialogue/render endpoints are recording
// substitutes. Native player.html coverage lives in the task14 evidence harness.
describe("public automatic speaker consumers", () => {
  function sceneFixture() {
    const project = store.getCurrent();
    project.maps[project.startMapId].events = ["first", "second"].map((id) => ({ id, x: 1, y: 1, characterId: "resident", talkFriendship: true, trigger: { kind: "action" }, commands: [] }));
    const messages: Array<{ speaker?: string; body: string }> = [];
    const dialogue = { showText: async (message: { speaker?: string; body: string }) => { messages.push(message); }, showChoices: async () => 0, showNumberInput: async () => 0, close() {}, hide() {} };
    const scene = { session: startSession(project, 1), map: project.maps[project.startMapId], tileY: 0, running: false, inputEnabled: true, eventPositions: {}, eventSprites: new Map(), game: { registry: { get: (key: string) => key === "dialogue" ? dialogue : undefined } }, setInputEnabled() {}, refreshRuntimeSurfaces() {}, syncRuntimeState() {}, showRuntimeOverlay() {}, clearRuntimeOverlay() {} } as unknown as PlaySceneContext;
    scene.session.inventory = {};
    return { scene, messages, project };
  }

  it("uses linked profile names for no-items and daily-limit gift feedback", async () => {
    const { scene, messages } = sceneFixture();
    await playGiftSelection(scene, scene.map.events[0]);
    expect(messages[0].speaker).toBe("Profile name");
    scene.session.dailyGifts = { resident: "1:spring:1" };
    await playGiftSelection(scene, scene.map.events[1]);
    expect(messages[1].speaker).toBe("Profile name");
  });

  it("shares talk identity across events and preserves explicit command speaker overrides", async () => {
    const { scene, messages } = sceneFixture();
    await runEvent(scene, "first");
    expect(messages[0].speaker).toBe("Profile name");
    const friendship = structuredClone(scene.session.friendship);
    await runEvent(scene, "second");
    expect(scene.session.friendship).toEqual(friendship);
    expect(messages).toHaveLength(1);
    await runCommands(scene, [{ kind: "text", speaker: "Explicit speaker", body: "Explicit" }, { kind: "text", body: "Automatic" }, { kind: "text", speaker: "", body: "Narration" }], "second");
    expect(messages.slice(1).map((m) => m.speaker)).toEqual(["Explicit speaker", "Profile name", ""]);
  });
});

describe("legacy characterization", () => {
  it("uses effective forecast 1 and rain intensity 0.5 without backfilling", () => {
    const project = store.getCurrent();
    const before = serialize(project);
    const forecast = dailyWeatherForecast(project, startSession(project, 1));
    expect(forecast).toHaveLength(1);
    expect(forecast[0].intensity).toBe(0.5);
    expect(serialize(project)).toBe(before);
  });

  it("retains explicit forecast 3 and intensity 0.65 through render and roundtrip", () => {
    store.update((project) => { project.system.dailyWeather = { enabled: true, forecastDays: 3, seasons: { spring: [{ kind: "rain", weight: 1, intensity: 0.65 }] } }; });
    const before = serialize(store.getCurrent());
    const host = mount(renderDailyWeatherTab);
    expect(control(host, "db-weather-forecast-days").value).toBe("3");
    expect(host.querySelector<HTMLInputElement>('input[type="range"]')?.value).toBe("0.65");
    expect(serialize(store.getCurrent())).toBe(before);
    expect(serialize(deserialize(before))).toBe(before);
  });

  it("preserves the legacy level1 reward and authored birthday on render/serialize", () => {
    const before = serialize(store.getCurrent());
    const character = mount(renderCharactersTab);
    control(character, "db-character-row-resident").click();
    expect(control(character, "db-character-birthday-day").value).toBe("40");
    const skills = mount(renderLifeCraftingTab);
    control(skills, "db-life-section-skills").click();
    expect(control(skills, "db-life-skill-reward-level-0").value).toBe("1");
    expect(serialize(store.getCurrent())).toBe(before);
    expect(serialize(deserialize(before))).toBe(before);
  });
});
