// @vitest-environment happy-dom
// 런타임 디버그 패널(Test Play 계측기) 계약 테스트.
// 왜: 빈 프로젝트(sw_0001..sw_0100은 이름이 비어 있다)에서 스위치 셀렉트가 0개였고,
// 라이브 상태 표시가 없어 저자가 플레이 중 무엇이 켜졌는지 볼 수 없었다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";

const storeMocks = vi.hoisted(() => ({
  project: null as Project | null,
  update: vi.fn(),
}));

vi.mock("@/project/store", () => ({
  store: {
    getCurrent: (): Project => {
      if (!storeMocks.project) throw new Error("test project not set");
      return storeMocks.project;
    },
    update: storeMocks.update,
  },
}));

import { renderRuntimeDebugPanel, RUNTIME_DEBUG_EXPANDED_KEY } from "@/player/runtimeDebugPanel";
import type { RuntimeDebugHook } from "@/player/playSceneTestHooks";

type DebugWindow = Window & { __oprnDebug?: RuntimeDebugHook };

function testid(root: ParentNode, id: string): HTMLElement {
  const node = root.querySelector(`[data-testid='${id}']`);
  if (!(node instanceof HTMLElement)) throw new Error(`missing testid: ${id}`);
  return node;
}

function select(root: ParentNode, id: string): HTMLSelectElement {
  const node = testid(root, id);
  if (!(node instanceof HTMLSelectElement)) throw new Error(`not a select: ${id}`);
  return node;
}

function input(root: ParentNode, id: string): HTMLInputElement {
  const node = testid(root, id);
  if (!(node instanceof HTMLInputElement)) throw new Error(`not an input: ${id}`);
  return node;
}

function optionValues(node: HTMLSelectElement): string[] {
  return [...node.options].map((option) => option.value);
}

async function nextFrames(count: number): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }
}

function stateSnapshot(overrides: Partial<ReturnType<RuntimeDebugHook["readState"]>> = {}): ReturnType<RuntimeDebugHook["readState"]> {
  return {
    currentMapId: "map_0001",
    x: 4,
    y: 6,
    gold: 0,
    switches: {},
    variables: {},
    selfSwitches: {},
    timers: {},
    inventory: {},
    partyActorIds: [],
    gameTime: undefined,
    npcActivities: {},
    friendship: {},
    rng: { seed: 1, state: 1 },
    ...overrides,
  };
}

function installDebugHook(readState: () => ReturnType<RuntimeDebugHook["readState"]>): RuntimeDebugHook {
  const hook: RuntimeDebugHook = {
    setSwitch: vi.fn(),
    setVariable: vi.fn(),
    giveItem: vi.fn(),
    setGold: vi.fn(),
    heal: vi.fn(),
    teleport: vi.fn(),
    playerRoute: vi.fn(),
    applyPreset: vi.fn(),
    setSeed: vi.fn(),
    readState: vi.fn(readState),
  };
  (window as DebugWindow).__oprnDebug = hook;
  return hook;
}

// happy-dom 환경은 localStorage 전역을 깔아주지 않는다 — 레포의 다른 UI 테스트와 같은 방식으로 흉내낸다.
let fakeStorage = new Map<string, string>();

function installFakeLocalStorage(): void {
  fakeStorage = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: {
      getItem: (key: string) => fakeStorage.get(key) ?? null,
      setItem: (key: string, value: string) => void fakeStorage.set(key, String(value)),
      removeItem: (key: string) => void fakeStorage.delete(key),
      clear: () => fakeStorage.clear(),
    },
  });
}

beforeEach(() => {
  storeMocks.project = createBlankProject();
  storeMocks.update.mockReset();
  installFakeLocalStorage();
  document.body.innerHTML = "";
  document.head.innerHTML = "";
});

afterEach(() => {
  delete (window as DebugWindow).__oprnDebug;
  Reflect.deleteProperty(globalThis, "localStorage");
  document.body.innerHTML = "";
});

describe("runtime debug panel option labels", () => {
  it("labels empty-named switch slots by id instead of dropping them", () => {
    const project = storeMocks.project as Project;
    expect(project.switches.length).toBeGreaterThan(0);
    // #777 이 아이템 기동석 스위치를 이름과 함께 선언한다 — 이 테스트는 "이름 없는 슬롯을
    // 버리지 않고 id 로 라벨링하는가" 를 보므로 이름 있는 것을 제외하고 본다.
    const unnamed = project.switches.filter((entry) => entry.name === "");
    expect(unnamed.length).toBeGreaterThan(0);

    const panel = renderRuntimeDebugPanel();
    const switchSelect = select(panel, "runtime-debug-switch-select");

    expect(switchSelect.options.length).toBe(project.switches.length);
    expect(switchSelect.options[0]?.value).toBe("sw_0001");
    expect(switchSelect.options[0]?.textContent).toBe("sw_0001");
    expect(switchSelect.value).toBe("sw_0001");
  });

  it("keeps the '<name> (<id>)' form when a name exists", () => {
    const project = storeMocks.project as Project;
    const named = project.switches[6];
    if (!named) throw new Error("expected 7th switch slot");
    named.name = "보스 격파";

    const switchSelect = select(renderRuntimeDebugPanel(), "runtime-debug-switch-select");
    expect(switchSelect.options[6]?.textContent).toBe("보스 격파 (sw_0007)");
  });
});

describe("runtime debug panel filters", () => {
  it("narrows switch options by id, case-insensitively", () => {
    const project = storeMocks.project as Project;
    const panel = renderRuntimeDebugPanel();
    const switchSelect = select(panel, "runtime-debug-switch-select");
    const filter = input(panel, "runtime-debug-switch-filter");

    filter.value = "SW_00071";
    filter.dispatchEvent(new Event("input"));
    expect(optionValues(switchSelect)).toEqual([]);
    expect(switchSelect.dataset.optionCount).toBe("0");

    filter.value = "SW_0007";
    filter.dispatchEvent(new Event("input"));
    expect(optionValues(switchSelect)).toEqual(["sw_0007"]);
    expect(switchSelect.value).toBe("sw_0007");

    // 접당사 필터는 여러 개를 남긴다 — 기대값은 하드코드하지 않고 프로젝트에서 도출한다.
    const expectedTens = project.switches.map((entry) => entry.id).filter((id) => id.toLowerCase().includes("sw_001"));
    expect(expectedTens.length).toBeGreaterThan(1);
    filter.value = "sw_001";
    filter.dispatchEvent(new Event("input"));
    expect(optionValues(switchSelect)).toEqual(expectedTens);
    expect(switchSelect.dataset.optionCount).toBe(`${expectedTens.length}`);

    // 필터를 부우면 전짜리 목록이 돌아와야 한다.
    filter.value = "";
    filter.dispatchEvent(new Event("input"));
    expect(switchSelect.options.length).toBe(project.switches.length);
  });

  it("narrows switch options by name", () => {
    const project = storeMocks.project as Project;
    const named = project.switches[2];
    if (!named) throw new Error("expected 3rd switch slot");
    // "성문 개방" 은 #777 의 기동석 스위치(sw_catalog_gate_open) 이름과 겹친다 — 겹치지 않는
    // 이름으로 필터가 한 건만 남기는지 본다.
    named.name = "테스트 게이트";

    const panel = renderRuntimeDebugPanel();
    const switchSelect = select(panel, "runtime-debug-switch-select");
    const filter = input(panel, "runtime-debug-switch-filter");
    filter.value = "테스트";
    filter.dispatchEvent(new Event("input"));

    expect(optionValues(switchSelect)).toEqual(["sw_0003"]);
    expect(switchSelect.value).toBe("sw_0003");
  });

  it("filters the item list so a long database stays pickable", () => {
    const project = storeMocks.project as Project;
    const item = project.database.items[0];
    if (!item) throw new Error("blank project should ship at least one item");

    const panel = renderRuntimeDebugPanel();
    const itemSelect = select(panel, "runtime-debug-item-select");
    const filter = input(panel, "runtime-debug-item-filter");
    expect(itemSelect.options.length).toBe(project.database.items.length);

    filter.value = item.id;
    filter.dispatchEvent(new Event("input"));
    expect(optionValues(itemSelect)).toEqual([item.id]);
  });
});

describe("runtime debug panel write controls", () => {
  it("calls setSwitch with the selected id", () => {
    const hook = installDebugHook(() => stateSnapshot());
    const panel = renderRuntimeDebugPanel();
    const switchSelect = select(panel, "runtime-debug-switch-select");
    switchSelect.value = "sw_0007";

    testid(panel, "runtime-debug-switch-on").click();
    expect(hook.setSwitch).toHaveBeenCalledWith("sw_0007", true);

    testid(panel, "runtime-debug-switch-off").click();
    expect(hook.setSwitch).toHaveBeenCalledWith("sw_0007", false);
  });

  it("still fills the JSON dump on 상태 읽기", () => {
    installDebugHook(() => stateSnapshot({ gold: 77 }));
    const panel = renderRuntimeDebugPanel();
    testid(panel, "runtime-debug-read").click();
    expect(testid(panel, "runtime-debug-state").textContent).toContain("\"gold\": 77");
  });
});

describe("runtime debug panel switch value readout", () => {
  // 예전에는 ON/OFF 를 눌러도 패널에 결과가 없어서 상태를 보려면 전체 JSON 을 열어
  // 수백 개 사이에서 해당 id 를 눈으로 찾아야 했다.
  function hookWithLiveSwitches(): { hook: RuntimeDebugHook; switches: Record<string, boolean> } {
    const switches: Record<string, boolean> = { sw_0001: false, sw_0007: true };
    const hook: RuntimeDebugHook = {
      setSwitch: vi.fn((id: string, value: boolean) => {
        switches[id] = value;
      }),
      setVariable: vi.fn(),
      giveItem: vi.fn(),
      setGold: vi.fn(),
      heal: vi.fn(),
      teleport: vi.fn(),
      playerRoute: vi.fn(),
      applyPreset: vi.fn(),
      setSeed: vi.fn(),
      readState: vi.fn(() => stateSnapshot({ switches: { ...switches } })),
    };
    (window as DebugWindow).__oprnDebug = hook;
    return { hook, switches };
  }

  it("shows the current value of the selected switch and follows the selection", () => {
    hookWithLiveSwitches();
    const panel = renderRuntimeDebugPanel();
    const value = testid(panel, "runtime-debug-switch-value");

    expect(value.dataset.switchId).toBe("sw_0001");
    expect(value.dataset.switchValue).toBe("false");
    expect(value.textContent).toBe("OFF");

    const switchSelect = select(panel, "runtime-debug-switch-select");
    switchSelect.value = "sw_0007";
    switchSelect.dispatchEvent(new Event("change"));
    expect(value.dataset.switchValue).toBe("true");
    expect(value.textContent).toBe("ON");
  });

  it("refreshes the moment ON/OFF is pressed, without waiting for a frame", () => {
    const { switches } = hookWithLiveSwitches();
    const panel = renderRuntimeDebugPanel();
    const value = testid(panel, "runtime-debug-switch-value");

    testid(panel, "runtime-debug-switch-on").click();
    expect(switches["sw_0001"]).toBe(true);
    expect(value.textContent).toBe("ON");

    testid(panel, "runtime-debug-switch-off").click();
    expect(switches["sw_0001"]).toBe(false);
    expect(value.textContent).toBe("OFF");
  });

  it("reads unknown before a run installs the debug hook", () => {
    const value = testid(renderRuntimeDebugPanel(), "runtime-debug-switch-value");
    expect(value.dataset.switchValue).toBe("unknown");
    expect(value.textContent).toBe("?");
  });
});

describe("runtime debug panel live readout", () => {
  it("reflects the hook state while attached and stops refreshing once detached", async () => {
    let snapshot = stateSnapshot({ currentMapId: "map_0002", x: 3, y: 9 });
    const hook = installDebugHook(() => snapshot);
    const panel = renderRuntimeDebugPanel();
    document.body.append(panel);

    await nextFrames(3);
    const live = testid(panel, "runtime-debug-live-state");
    expect(live.dataset.mapId).toBe("map_0002");
    expect(live.dataset.x).toBe("3");
    expect(live.dataset.y).toBe("9");
    // 계약: 맵 id 와 x,y 는 기계 판독 dataset 말고 사람이 읽는 본벼에도 있어야 한다.
    expect(live.textContent).toContain("map_0002");
    expect(live.textContent).toContain("3,9");

    snapshot = stateSnapshot({ currentMapId: "map_0003", x: 11, y: 12 });
    await nextFrames(3);
    expect(live.dataset.mapId).toBe("map_0003");
    expect(live.dataset.x).toBe("11");

    // 호스트가 Test Play를 닫으면 패널을 DOM에서 떼낸다 — 루프는 스스로 멈춰야 한다.
    panel.remove();
    await nextFrames(3);
    const callsAfterDetach = (hook.readState as ReturnType<typeof vi.fn>).mock.calls.length;
    snapshot = stateSnapshot({ currentMapId: "map_0004", x: 20, y: 21 });
    await nextFrames(5);

    expect((hook.readState as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callsAfterDetach);
    expect(live.dataset.mapId).toBe("map_0003");
  });

  it("reads input/event flags from the runtime state dump and survives a missing hook", async () => {
    const dump = document.createElement("pre");
    dump.dataset.testid = "runtime-state-json";
    dump.textContent = JSON.stringify({ mapId: "map_0009", inputEnabled: false, running: true, player: { x: 2, y: 5 } });
    document.body.append(dump);

    const panel = renderRuntimeDebugPanel();
    document.body.append(panel);
    await nextFrames(3);

    const live = testid(panel, "runtime-debug-live-state");
    expect(live.dataset.mapId).toBe("map_0009");
    expect(live.dataset.x).toBe("2");
    expect(live.dataset.inputEnabled).toBe("false");
    expect(live.dataset.eventRunning).toBe("true");
    panel.remove();
  });

  it("marks itself idle when no play session is installed", async () => {
    const panel = renderRuntimeDebugPanel();
    document.body.append(panel);
    await nextFrames(2);
    expect(testid(panel, "runtime-debug-live-state").dataset.live).toBe("idle");
    panel.remove();
  });
});

describe("runtime debug panel placement and persistence", () => {
  it("starts collapsed so the play field stays visible, and remembers an expand", () => {
    const panel = renderRuntimeDebugPanel();
    expect(panel).toBeInstanceOf(HTMLDetailsElement);
    const details = panel as HTMLDetailsElement;
    // 펼침이 기본이면 패널이 토글 없이 플레이 화면 아랫절반을 가린다(실제 관적: 1214x640 창에서 335px).
    // 준 상태는 여전히 사약이 보이므로 접어도 계읍기 역할은 살아 있다.
    expect(details.open).toBe(false);

    details.open = true;
    details.dispatchEvent(new Event("toggle"));
    expect(localStorage.getItem(RUNTIME_DEBUG_EXPANDED_KEY)).toBe("1");

    details.open = false;
    details.dispatchEvent(new Event("toggle"));
    expect(localStorage.getItem(RUNTIME_DEBUG_EXPANDED_KEY)).toBe("0");
  });

  it("restores the expanded state on the next launch", () => {
    localStorage.setItem(RUNTIME_DEBUG_EXPANDED_KEY, "1");
    expect((renderRuntimeDebugPanel() as HTMLDetailsElement).open).toBe(true);
  });

  it("anchors the panel to the bottom so the play field stays visible", () => {
    renderRuntimeDebugPanel();
    const style = document.getElementById("runtime-debug-panel-style");
    expect(style?.textContent).toContain("bottom:");
    expect(style?.textContent).not.toContain("top:4px");
  });

  it("exposes the expand/collapse control as the panel summary", () => {
    const panel = renderRuntimeDebugPanel();
    const toggle = testid(panel, "runtime-debug-toggle");
    expect(toggle.tagName).toBe("SUMMARY");
    // 라이브 상태 한 줄은 toggle(summary) 안에 있어 접혀도 DOM 에 남는다(dataset 기계 판독 경로 유지).
    expect(toggle.querySelector("[data-testid='runtime-debug-live-state']")).not.toBeNull();
  });

  it("collapses to a single 🛠 icon instead of a debug band for first-time users", () => {
    const panel = renderRuntimeDebugPanel();
    const toggle = testid(panel, "runtime-debug-toggle");
    expect(toggle.textContent).toContain("🛠");
    // 이름은 스크린리더용으로 남긴다(시각적으로만 숨김).
    expect(toggle.querySelector(".runtime-debug-title")?.textContent).toBe("런타임 디버그");
    const css = document.getElementById("runtime-debug-panel-style")?.textContent ?? "";
    // 접힌 상태에선 띠(좌우로 늘어난 바)가 아니라 왼쪽 아래 아이콘이고, 라이브 줄은 화면에서 빠진다.
    expect(css).toMatch(/\.runtime-debug-panel:not\(\[open\]\)\{[^}]*right:auto/);
    expect(css).toContain(".runtime-debug-panel:not([open]) .runtime-debug-live{display:none}");
  });
});
