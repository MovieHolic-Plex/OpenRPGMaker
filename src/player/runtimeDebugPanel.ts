// player/runtimeDebugPanel.ts
// 시연 실행 중 런타임을 조작하는 디버그 패널(Phase 4-1).
// window.__oprnDebug(playSceneTestHooks가 설치) 훅을 통해 스위치/변수/아이템/골드/회복/텔레포트를
// 조작하고 상태를 덤프한다. 상태 프리셋은 프로젝트(project.testPresets)에 저장한다.
// __oprnDebug는 플레이 시작 시 설치되므로, 조작은 클릭 시점에 지연 조회한다.
//
// 저작자용 계측기 요건(측정된 결함 D4/D5 대응):
//  - 이름 없는 레코드도 id 라벨로 반드시 노출한다(빈 프로젝트 셀렉트가 0개였다).
//  - 큰 목록은 필터 입력으로 좁힌다(아이템 179개를 스크롤로 고를 수 없었다).
//  - 접어도 보이는 한 줄 라이브 상태 + 펼치는 전체 JSON. 루프는 패널이 DOM에서 떨어지면 스스로 멈춘다.
//  - 하단 고정 바로 배치해 플레이 필드를 가리지 않고, 펼침 상태를 localStorage 에 기억한다.

import { store } from "@/project/store";
import { el } from "@/util/dom";
import { upsertPreset, type StatePreset } from "@/testing/debugSession";
import type { RuntimeDebugHook } from "@/player/playSceneTestHooks";
import { STORAGE_PREFIX } from "@/util/appStorage";

// 패널 확장 상태 저장 키. 접두사는 STORAGE_PREFIX(=`oprn:`)를 쓴다 —
// 구 접두사 `rpg-zzu:` 로 직접 쓰면 부팅 시 migrateLegacyStorageKeys 가 새 접두사로
// 옮겨버려서 다음 실행에서 값을 못 찾는다(실측 규칙: util/appStorage.ts).
export const RUNTIME_DEBUG_EXPANDED_KEY = `${STORAGE_PREFIX}testplay-debug-expanded`;

function readExpanded(): boolean {
  // 저작자가 한 번도 접지 않았다면 펼친 상태로 시작한다(닫힌 채로 시작하면 계측기가 안 보인다).
  try {
    return localStorage.getItem(RUNTIME_DEBUG_EXPANDED_KEY) !== "0";
  } catch {
    return true;
  }
}

function writeExpanded(expanded: boolean): void {
  try {
    localStorage.setItem(RUNTIME_DEBUG_EXPANDED_KEY, expanded ? "1" : "0");
  } catch {
    // 저장 불가 환경(프라이빗 모드/쿼터)에서 패널을 못 쓰게 만들 이유가 없다.
  }
}

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
  return (window as Window & { __oprnDebug?: RuntimeDebugHook }).__oprnDebug;
}

// 패널 스타일을 1회 주입한다(UI-0 팀의 공용 CSS 파일과 충돌하지 않도록 self-contained).
function ensureDebugPanelStyles(): void {
  if (typeof document === "undefined" || document.getElementById("runtime-debug-panel-style")) return;
  const style = document.createElement("style");
  style.id = "runtime-debug-panel-style";
  // 디자인 토큰(src/styles/tokens.css) 참조 — 하드코딩 색 없음. 토큰 미로드 환경 폴백값 포함.
  // 배치: 플레이 필드를 덮지 않도록 하단 고정 바다. 접으면 요약줄 한 줄, 펼치면 아래에서 위로
  // 최대 절반까지만 자란다(예전 right:150px/top:4px 절대배치는 게임 화면 위를 가렸다).
  style.textContent = `
.runtime-debug-panel{position:absolute;left:var(--space-2,8px);right:var(--space-2,8px);bottom:var(--space-1,4px);top:auto;z-index:60;max-height:50%;overflow:auto;
  background:var(--bg-overlay,#232838);color:var(--text-1,#e9ecf3);border:1px solid var(--border-strong,rgba(255,255,255,.17));
  border-radius:var(--radius-m,10px);padding:4px var(--space-2,8px) var(--space-2,8px);font-size:12px;box-shadow:var(--shadow-pop,0 4px 12px rgba(0,0,0,.28));
  font-family:var(--font-ui,system-ui,sans-serif)}
.runtime-debug-panel:not([open]){max-height:none;overflow:hidden;padding:2px 6px}
.runtime-debug-panel summary{cursor:pointer;font-weight:700;user-select:none;color:var(--text-1,#e9ecf3);display:flex;flex-wrap:wrap;gap:var(--space-2,8px);align-items:baseline}
.runtime-debug-live{font-weight:400;font-family:var(--font-mono,monospace);font-size:11px;color:var(--text-2,#9aa3b5)}
.runtime-debug-live[data-live='running']{color:var(--accent,#6c79f2)}
.runtime-debug-row{display:flex;flex-direction:column;gap:2px;margin-top:var(--space-1,4px)}
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
.runtime-debug-filter{max-width:none;flex:1 1 100%}
.runtime-debug-dump summary{font-weight:400;font-size:11px;color:var(--text-2,#9aa3b5)}
.runtime-debug-state{background:var(--bg-inset,#0c0e14);border:1px solid var(--border-subtle,rgba(255,255,255,.07));
  border-radius:var(--radius-s,6px);color:var(--text-2,#9aa3b5);margin-top:var(--space-2,8px);padding:var(--space-1,4px);max-height:160px;overflow:auto;white-space:pre-wrap;font-size:11px;font-family:var(--font-mono,monospace)}
`;
  document.head.append(style);
}

function labeled(labelText: string, ...controls: readonly HTMLElement[]): HTMLElement {
  return el("label", { class: "runtime-debug-row", children: [el("span", { class: "runtime-debug-label", text: labelText }), ...controls] });
}

type OptionEntry = { readonly id: string; readonly name: string };

// 이름이 비어 있어도 절대 건너뛰지 않는다 — 빈 프로젝트의 스위치/변수 슬롯(sw_0001..)은 이름이 없고,
// 예전 구현은 그걸 전부 걸러내서 셀렉트가 0개(=죽은 ON/OFF 버튼)가 됐다.
function optionLabel(entry: OptionEntry): string {
  return entry.name ? `${entry.name} (${entry.id})` : entry.id;
}

function matchesFilter(entry: OptionEntry, query: string): boolean {
  if (!query) return true;
  const needle = query.toLowerCase();
  return entry.id.toLowerCase().includes(needle) || entry.name.toLowerCase().includes(needle);
}

function fillOptions(select: HTMLSelectElement, entries: readonly OptionEntry[], query: string): void {
  const previous = select.value;
  const visible = entries.filter((entry) => matchesFilter(entry, query));
  select.replaceChildren(...visible.map((entry) => el("option", { value: entry.id, text: optionLabel(entry) })));
  select.dataset.optionCount = `${visible.length}`;
  // 필터 후에도 남아 있는 선택은 유지하고, 사라졌으면 첫 항목으로 떨어뜨린다.
  select.value = visible.some((entry) => entry.id === previous) ? previous : (visible[0]?.id ?? "");
}

// 목록이 큰 셀렉트(스위치/변수/아이템/맵)는 위에 필터 입력을 얹는다 — 수백 개 옵션에서
// 스크롤로 고르는 건 실사용이 불가능하다.
function filterableSelect(entries: readonly OptionEntry[], testidBase: string, placeholder: string): { row: HTMLElement; select: HTMLSelectElement } {
  const select = el("select", { class: "runtime-debug-select", dataset: { testid: `${testidBase}-select` } }) as HTMLSelectElement;
  const filter = el("input", {
    class: "runtime-debug-input runtime-debug-filter",
    attrs: { type: "search", placeholder },
    dataset: { testid: `${testidBase}-filter` },
  }) as HTMLInputElement;
  filter.addEventListener("input", () => fillOptions(select, entries, filter.value.trim()));
  fillOptions(select, entries, "");
  return { row: el("div", { class: "runtime-debug-controls", children: [filter] }), select };
}

// ── 라이브 상태 표시 ────────────────────────────────────────────
// runtimeDom 이 심는 machine-only 덤프([data-testid='runtime-state-json'])는 2x2px/opacity .01 이라
// 사람이 못 읽는다. 입력 활성/이벤트 실행 여부는 __oprnDebug.readState() 에 없고 그 덤프에만 있으므로
// 두 소스를 합쳐 한 줄로 보여준다(호스트 파일은 이 작업 범위 밖이라 수정하지 않는다).
type LiveReadout = {
  readonly mapId: string;
  readonly x: number | undefined;
  readonly y: number | undefined;
  readonly inputEnabled: boolean | undefined;
  readonly running: boolean | undefined;
  readonly live: "idle" | "playing" | "running";
};

function parsedRuntimeSnapshot(): Record<string, unknown> | null {
  if (typeof document === "undefined") return null;
  const text = document.querySelector("[data-testid='runtime-state-json']")?.textContent;
  if (!text) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    // 덤프가 잘려 있거나 아직 비어 있는 프레임 — 다음 프레임에 다시 읽으면 된다.
    return null;
  }
}

function numberField(source: Record<string, unknown> | null, key: string): number | undefined {
  const value = source?.[key];
  return typeof value === "number" ? value : undefined;
}

function booleanField(source: Record<string, unknown> | null, key: string): boolean | undefined {
  const value = source?.[key];
  return typeof value === "boolean" ? value : undefined;
}

function stringField(source: Record<string, unknown> | null, key: string): string | undefined {
  const value = source?.[key];
  return typeof value === "string" ? value : undefined;
}

type DebugState = ReturnType<RuntimeDebugHook["readState"]>;

function collectLiveReadout(state: DebugState | undefined): LiveReadout {
  const snapshot = parsedRuntimeSnapshot();
  const player = snapshot?.["player"];
  const playerPos = typeof player === "object" && player !== null ? (player as Record<string, unknown>) : null;
  const running = booleanField(snapshot, "running");
  const mapId = state?.currentMapId ?? stringField(snapshot, "mapId") ?? "";
  const x = state ? state.x : numberField(playerPos, "x");
  const y = state ? state.y : numberField(playerPos, "y");
  const live = !state && !snapshot ? "idle" : running === true ? "running" : "playing";
  return { mapId, x, y, inputEnabled: booleanField(snapshot, "inputEnabled"), running, live };
}

function liveText(readout: LiveReadout): string {
  if (readout.live === "idle") return "플레이 대기 중";
  const position = readout.x === undefined || readout.y === undefined ? "?,?" : `${readout.x},${readout.y}`;
  const inputLabel = readout.inputEnabled === undefined ? "입력 ?" : readout.inputEnabled ? "입력 ON" : "입력 OFF";
  const eventLabel = readout.running === undefined ? "이벤트 ?" : readout.running ? "이벤트 실행" : "이벤트 대기";
  return `${readout.mapId || "map ?"} · ${position} · ${inputLabel} · ${eventLabel}`;
}

function applyLiveReadout(line: HTMLElement, stateDump: HTMLElement, dumpDetails: HTMLDetailsElement): void {
  // readState() 는 프레임당 한 번만 부른다(세션 전체를 복제하는 비용이 있다).
  const state = debug()?.readState();
  const readout = collectLiveReadout(state);
  line.textContent = liveText(readout);
  // dataset 은 Playwright 가 파싱하는 기계 판독 경로다(문구는 바뀔 수 있다).
  line.dataset.live = readout.live;
  line.dataset.mapId = readout.mapId;
  line.dataset.x = readout.x === undefined ? "" : `${readout.x}`;
  line.dataset.y = readout.y === undefined ? "" : `${readout.y}`;
  line.dataset.inputEnabled = readout.inputEnabled === undefined ? "unknown" : `${readout.inputEnabled}`;
  line.dataset.eventRunning = readout.running === undefined ? "unknown" : `${readout.running}`;
  // 전체 JSON 은 펼쳐져 있을 때만 갱신한다 — 접힌 덤프를 매 프레임 stringify 할 이유가 없다.
  if (!dumpDetails.open) return;
  stateDump.textContent = state ? JSON.stringify(state, null, 2) : "플레이가 시작되지 않았습니다.";
}

// 라이브 루프. 패널이 document 에서 떨어지면(호스트가 Test Play 를 닫으면) 스스로 멈춘다 —
// 호스트는 정리 훅을 주지 않으므로 rAF 를 흘리지 않는 유일한 방법이 연결 상태 확인이다.
function startLiveLoop(panel: HTMLElement, refresh: () => void): void {
  if (typeof requestAnimationFrame !== "function") return;
  const tick = (): void => {
    if (!panel.isConnected) return;
    refresh();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export function renderRuntimeDebugPanel(): HTMLElement {
  ensureDebugPanelStyles();
  const project = store.getCurrent();
  const stateDump = el("pre", { class: "runtime-debug-state", dataset: { testid: "runtime-debug-state" }, text: "상태를 읽으려면 '상태 읽기'를 누르세요." });

  // 스위치 토글.
  const { row: switchFilterRow, select: switchSelect } = filterableSelect(project.switches, "runtime-debug-switch", "스위치 검색(이름/ID)");
  const switchRow = el("div", {
    class: "runtime-debug-controls",
    children: [
      switchSelect,
      el("button", { class: "runtime-debug-btn", text: "ON", attrs: { type: "button" }, dataset: { testid: "runtime-debug-switch-on" }, on: { click: () => debug()?.setSwitch(switchSelect.value, true) } }),
      el("button", { class: "runtime-debug-btn", text: "OFF", attrs: { type: "button" }, dataset: { testid: "runtime-debug-switch-off" }, on: { click: () => debug()?.setSwitch(switchSelect.value, false) } }),
    ],
  });

  // 변수 설정.
  const { row: varFilterRow, select: varSelect } = filterableSelect(project.variables, "runtime-debug-var", "변수 검색(이름/ID)");
  const varInput = el("input", { class: "runtime-debug-input", attrs: { type: "number", value: "0" } }) as HTMLInputElement;
  const varRow = el("div", {
    class: "runtime-debug-controls",
    children: [varSelect, varInput, el("button", { class: "runtime-debug-btn", text: "설정", attrs: { type: "button" }, dataset: { testid: "runtime-debug-var-set" }, on: { click: () => debug()?.setVariable(varSelect.value, Number(varInput.value) || 0) } })],
  });

  // 아이템 지급.
  const { row: itemFilterRow, select: itemSelect } = filterableSelect(project.database.items, "runtime-debug-item", "아이템 검색(이름/ID)");
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
  const { row: mapFilterRow, select: mapSelect } = filterableSelect(
    Object.values(project.maps).map((m) => ({ id: m.id, name: m.name })),
    "runtime-debug-map",
    "맵 검색(이름/ID)"
  );
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

  // 전체 JSON 덤프는 펼칠 수 있는 서브섹션으로 내린다 — 한 줄 요약은 항상 보이고, 자세한 건 원할 때만 본다.
  const dumpDetails = el("details", {
    class: "runtime-debug-dump",
    dataset: { testid: "runtime-debug-state-dump" },
    children: [el("summary", { text: "전체 상태 JSON" }), stateDump],
  }) as HTMLDetailsElement;

  const readButton = el("button", {
    class: "runtime-debug-btn",
    text: "상태 읽기",
    attrs: { type: "button" },
    dataset: { testid: "runtime-debug-read" },
    on: {
      click: () => {
        dumpDetails.open = true;
        const s = debug()?.readState();
        stateDump.textContent = s ? JSON.stringify(s, null, 2) : "플레이가 시작되지 않았습니다.";
      },
    },
  });

  // 접혀도 보이는 한 줄 라이브 상태(summary 안에 넣는 이유: details가 닫힐 때 노출되는 유일한 자식이다).
  const liveLine = el("span", { class: "runtime-debug-live", dataset: { testid: "runtime-debug-live" } });

  const details = el("details", {
    class: "runtime-debug-panel",
    dataset: { testid: "runtime-debug-panel" },
    children: [
      el("summary", { dataset: { testid: "runtime-debug-summary" }, children: ["🛠 런타임 디버그", liveLine] }),
      labeled("스위치", switchFilterRow, switchRow),
      labeled("변수", varFilterRow, varRow),
      labeled("아이템", itemFilterRow, itemRow),
      labeled("골드/회복", goldRow),
      labeled("텔레포트", mapFilterRow, teleRow),
      labeled("RNG 시드", seedRow),
      labeled("프리셋", el("div", { class: "runtime-debug-controls", children: [presetName, savePreset] })),
      presetList,
      readButton,
      dumpDetails,
    ],
  }) as HTMLDetailsElement;
  details.open = readExpanded();
  details.addEventListener("toggle", () => writeExpanded(details.open));

  applyLiveReadout(liveLine, stateDump, dumpDetails);
  startLiveLoop(details, () => applyLiveReadout(liveLine, stateDump, dumpDetails));
  return details;
}
