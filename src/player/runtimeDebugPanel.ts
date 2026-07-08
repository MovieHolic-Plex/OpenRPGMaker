// player/runtimeDebugPanel.ts
// 테스트 플레이 중 런타임을 조작하는 디버그 패널(Phase 4-1).
// window.__rpgzzuDebug(playSceneTestHooks가 설치) 훅을 통해 스위치/변수/아이템/골드/회복/텔레포트를
// 조작하고 상태를 덤프한다. 상태 프리셋을 localStorage에 저장/적용한다.
// __rpgzzuDebug는 플레이 시작 시 설치되므로, 조작은 클릭 시점에 지연 조회한다.

import { store } from "@/project/store";
import { el } from "@/util/dom";
import { upsertPreset, type StatePreset } from "@/testing/debugSession";
import type { RuntimeDebugHook } from "@/player/playSceneTestHooks";

// 프리셋은 프로젝트(project.testPresets)에 저장된다.
function projectPresets(): StatePreset[] {
  return store.getCurrent().testPresets ?? [];
}
function saveProjectPreset(preset: StatePreset): void {
  store.update((draft) => {
    draft.testPresets = upsertPreset(draft.testPresets ?? [], preset);
  });
}

function debug(): RuntimeDebugHook | undefined {
  return (window as Window & { __rpgzzuDebug?: RuntimeDebugHook }).__rpgzzuDebug;
}

// 패널 스타일을 1회 주입한다(UI-0 팀의 공용 CSS 파일과 충돌하지 않도록 self-contained).
function ensureDebugPanelStyles(): void {
  if (typeof document === "undefined" || document.getElementById("runtime-debug-panel-style")) return;
  const style = document.createElement("style");
  style.id = "runtime-debug-panel-style";
  // 디자인 토큰(src/styles/tokens.css) 참조 — 하드코딩 색 없음. 토큰 미로드 환경 폴백값 포함.
  style.textContent = `
.runtime-debug-panel{position:absolute;right:8px;bottom:32px;z-index:60;max-width:340px;max-height:calc(70vh - 24px);overflow:auto;
  background:var(--bg-overlay,#232838);color:var(--text-1,#e9ecf3);border:1px solid var(--border-strong,rgba(255,255,255,.17));
  border-radius:var(--radius-m,10px);padding:var(--space-2,8px);font-size:12px;box-shadow:var(--shadow-pop,0 4px 12px rgba(0,0,0,.28));
  font-family:var(--font-ui,system-ui,sans-serif)}
.runtime-debug-panel summary{cursor:pointer;font-weight:700;user-select:none;color:var(--text-1,#e9ecf3)}
.runtime-debug-row{display:flex;flex-direction:column;gap:3px;margin-top:var(--space-2,8px)}
.runtime-debug-label{color:var(--text-2,#9aa3b5);font-size:11px}
.runtime-debug-controls{display:flex;flex-wrap:wrap;gap:var(--space-1,4px);align-items:center}
.runtime-debug-select,.runtime-debug-input{background:var(--bg-inset,#0c0e14);color:var(--text-1,#e9ecf3);
  border:1px solid var(--border-default,rgba(255,255,255,.11));border-radius:var(--radius-s,6px);padding:2px 5px;font:inherit;min-width:0;flex:1 1 60px}
.runtime-debug-input{max-width:70px}
.runtime-debug-select:focus-visible,.runtime-debug-input:focus-visible{outline:none;border-color:var(--accent,#6c79f2);box-shadow:var(--focus-ring,0 0 0 2px rgba(108,121,242,.55))}
.runtime-debug-btn{background:var(--control-bg,rgba(255,255,255,.045));color:var(--text-1,#e9ecf3);
  border:1px solid var(--border-default,rgba(255,255,255,.11));border-radius:var(--radius-s,6px);padding:3px 7px;cursor:pointer;font-size:11px;
  transition:background var(--transition-fast,120ms ease),border-color var(--transition-fast,120ms ease)}
.runtime-debug-btn:hover{background:var(--control-bg-hover,rgba(255,255,255,.08));border-color:var(--border-strong,rgba(255,255,255,.17))}
.runtime-debug-btn:focus-visible{outline:none;box-shadow:var(--focus-ring,0 0 0 2px rgba(108,121,242,.55))}
.runtime-debug-presets{display:flex;flex-wrap:wrap;gap:var(--space-1,4px);margin-top:var(--space-1,4px)}
.runtime-debug-state{background:var(--bg-inset,#0c0e14);border:1px solid var(--border-subtle,rgba(255,255,255,.07));
  border-radius:var(--radius-s,6px);color:var(--text-2,#9aa3b5);margin-top:var(--space-2,8px);padding:var(--space-1,4px);max-height:160px;overflow:auto;white-space:pre-wrap;font-size:11px;font-family:var(--font-mono,monospace)}
`;
  document.head.append(style);
}

function labeled(labelText: string, control: HTMLElement): HTMLElement {
  return el("label", { class: "runtime-debug-row", children: [el("span", { class: "runtime-debug-label", text: labelText }), control] });
}

function optionsFrom(entries: readonly { id: string; name: string }[]): HTMLSelectElement {
  const select = el("select", { class: "runtime-debug-select" }) as HTMLSelectElement;
  for (const entry of entries) {
    if (!entry.name) continue;
    select.append(el("option", { value: entry.id, text: `${entry.name} (${entry.id})` }));
  }
  return select;
}

export function renderRuntimeDebugPanel(): HTMLElement {
  ensureDebugPanelStyles();
  const project = store.getCurrent();
  const stateDump = el("pre", { class: "runtime-debug-state", dataset: { testid: "runtime-debug-state" }, text: "상태를 읽으려면 '상태 읽기'를 누르세요." });

  // 스위치 토글.
  const switchSelect = optionsFrom(project.switches);
  const switchRow = el("div", {
    class: "runtime-debug-controls",
    children: [
      switchSelect,
      el("button", { class: "runtime-debug-btn", text: "ON", attrs: { type: "button" }, dataset: { testid: "runtime-debug-switch-on" }, on: { click: () => debug()?.setSwitch(switchSelect.value, true) } }),
      el("button", { class: "runtime-debug-btn", text: "OFF", attrs: { type: "button" }, dataset: { testid: "runtime-debug-switch-off" }, on: { click: () => debug()?.setSwitch(switchSelect.value, false) } }),
    ],
  });

  // 변수 설정.
  const varSelect = optionsFrom(project.variables);
  const varInput = el("input", { class: "runtime-debug-input", attrs: { type: "number", value: "0" } }) as HTMLInputElement;
  const varRow = el("div", {
    class: "runtime-debug-controls",
    children: [varSelect, varInput, el("button", { class: "runtime-debug-btn", text: "설정", attrs: { type: "button" }, dataset: { testid: "runtime-debug-var-set" }, on: { click: () => debug()?.setVariable(varSelect.value, Number(varInput.value) || 0) } })],
  });

  // 아이템 지급.
  const itemSelect = optionsFrom(project.database.items);
  const itemInput = el("input", { class: "runtime-debug-input", attrs: { type: "number", value: "1" } }) as HTMLInputElement;
  const itemRow = el("div", {
    class: "runtime-debug-controls",
    children: [itemSelect, itemInput, el("button", { class: "runtime-debug-btn", text: "지급", attrs: { type: "button" }, dataset: { testid: "runtime-debug-item-give" }, on: { click: () => debug()?.giveItem(itemSelect.value, Number(itemInput.value) || 1) } })],
  });

  // 골드 + 회복.
  const goldInput = el("input", { class: "runtime-debug-input", attrs: { type: "number", value: "0" } }) as HTMLInputElement;
  const goldRow = el("div", {
    class: "runtime-debug-controls",
    children: [
      goldInput,
      el("button", { class: "runtime-debug-btn", text: "골드 설정", attrs: { type: "button" }, dataset: { testid: "runtime-debug-gold-set" }, on: { click: () => debug()?.setGold(Number(goldInput.value) || 0) } }),
      el("button", { class: "runtime-debug-btn", text: "전체 회복", attrs: { type: "button" }, dataset: { testid: "runtime-debug-heal" }, on: { click: () => debug()?.heal() } }),
    ],
  });

  // 텔레포트.
  const mapSelect = optionsFrom(Object.values(project.maps).map((m) => ({ id: m.id, name: m.name })));
  const txInput = el("input", { class: "runtime-debug-input", attrs: { type: "number", value: "1", title: "x" } }) as HTMLInputElement;
  const tyInput = el("input", { class: "runtime-debug-input", attrs: { type: "number", value: "1", title: "y" } }) as HTMLInputElement;
  const teleRow = el("div", {
    class: "runtime-debug-controls",
    children: [mapSelect, txInput, tyInput, el("button", { class: "runtime-debug-btn", text: "이동", attrs: { type: "button" }, dataset: { testid: "runtime-debug-teleport" }, on: { click: () => debug()?.teleport(mapSelect.value, Number(txInput.value) || 0, Number(tyInput.value) || 0) } })],
  });

  const seedInput = el("input", { class: "runtime-debug-input", attrs: { type: "number", value: "1", title: "seed" } }) as HTMLInputElement;
  const seedRow = el("div", {
    class: "runtime-debug-controls",
    children: [
      seedInput,
      el("button", {
        class: "runtime-debug-btn",
        text: "시드 설정",
        attrs: { type: "button" },
        dataset: { testid: "runtime-debug-seed-set" },
        // TODO(Phase 6A): 플레이 씬의 안전한 새 게임 재시작 API가 생기면 현재 세션 reseed 대신 seed restart로 확장한다.
        on: { click: () => debug()?.setSeed(Number(seedInput.value) || 1) },
      }),
    ],
  });

  // 프리셋 목록.
  const presetList = el("div", { class: "runtime-debug-presets", dataset: { testid: "runtime-debug-presets" } });
  const renderPresets = (): void => {
    presetList.replaceChildren(
      ...projectPresets().map((preset) =>
        el("button", { class: "runtime-debug-btn", text: `▶ ${preset.name}`, attrs: { type: "button" }, on: { click: () => debug()?.applyPreset(preset) } })
      )
    );
  };
  renderPresets();

  const presetName = el("input", { class: "runtime-debug-input", attrs: { placeholder: "프리셋 이름" } }) as HTMLInputElement;
  const savePreset = el("button", {
    class: "runtime-debug-btn",
    text: "현재 상태 저장",
    attrs: { type: "button" },
    dataset: { testid: "runtime-debug-preset-save" },
    on: {
      click: () => {
        const state = debug()?.readState();
        if (!state) return;
        const preset: StatePreset = {
          id: `preset_${presetName.value.trim() || "state"}_${projectPresets().length}`,
          name: presetName.value.trim() || "이름 없는 프리셋",
          switches: state.switches,
          variables: state.variables,
          inventory: state.inventory,
          gold: state.gold,
          startMapId: state.currentMapId,
          startPos: { x: state.x, y: state.y },
        };
        saveProjectPreset(preset);
        renderPresets();
      },
    },
  });

  const readButton = el("button", {
    class: "runtime-debug-btn",
    text: "상태 읽기",
    attrs: { type: "button" },
    dataset: { testid: "runtime-debug-read" },
    on: { click: () => { const s = debug()?.readState(); stateDump.textContent = s ? JSON.stringify(s, null, 2) : "플레이가 시작되지 않았습니다."; } },
  });

  const details = el("details", {
    class: "runtime-debug-panel",
    dataset: { testid: "runtime-debug-panel" },
    children: [
      el("summary", { text: "🛠 런타임 디버그" }),
      labeled("스위치", switchRow),
      labeled("변수", varRow),
      labeled("아이템", itemRow),
      labeled("골드/회복", goldRow),
      labeled("텔레포트", teleRow),
      labeled("RNG 시드", seedRow),
      labeled("프리셋", el("div", { class: "runtime-debug-controls", children: [presetName, savePreset] })),
      presetList,
      readButton,
      stateDump,
    ],
  });
  return details;
}
