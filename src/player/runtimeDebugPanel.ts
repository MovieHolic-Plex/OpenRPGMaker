// player/runtimeDebugPanel.ts
// 시연 실행 중 런타임을 조작하는 디버그 패널(Phase 4-1).
// window.__oprnDebug(playSceneTestHooks가 설치) 훅을 통해 스위치/변수/아이템/골드/회복/텔레포트를
// 조작하고 상태를 덤프한다. 상태 프리셋은 프로젝트(project.testPresets)에 저장한다.
// __oprnDebug는 플레이 시작 시 설치되므로, 조작은 클릭 시점에 지연 조회한다.
//
// 저작자용 계측기 요건(측정된 결함 D4/D5 대응):
//  - 이름 없는 레코드도 id 라벨로 반드시 노출한다(빈 프로젝트 셀렉트가 0개였다).
//  - 큰 목록은 필터 입력으로 좁힌다(아이템 179개를 스크롤로 고를 수 없었다).
//  - 기본은 접힌 🛠 아이콘 하나. 펼치면 한 줄 라이브 상태 + 전체 JSON. 루프는 패널이 DOM에서 떨어지면 스스로 멈춘다.
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
  // 기본은 접힌 상태다. 펼친 패널은 1214x640 테스트 플레이 창에서 335px 를 차지해 플레이 화면
  // 아래쪽 절반을 가렸다(실측). 요약 줄의 라이브 상태는 접어도 보이므로 계측 기능은 그대로다.
  try {
    return localStorage.getItem(RUNTIME_DEBUG_EXPANDED_KEY) === "1";
  } catch {
    return false;
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
  // 배치: 플레이 필드를 덮지 않도록 하단 고정 바다. 접으면 왼쪽 아래 🛠 아이콘 하나, 펼치면 아래에서 위로
  // 최대 절반까지만 자란다(예전 right:150px/top:4px 절대배치는 게임 화면 위를 가렸다).
  // 접힌 상태에서도 요약줄 띠(「🛠 런타임 디버그 · map_… · 입력 ON · 이벤트 대기」)를 깔았더니
  // 처음 쓰는 사람에게는 게임 화면 밑에 붙은 개발자 잡음이었다(2026-09-23 첫인상 점검) — 띠는 펼칠 때만.
  style.textContent = `
.runtime-debug-panel{position:absolute;left:var(--space-2,8px);right:var(--space-2,8px);bottom:var(--space-1,4px);top:auto;z-index:60;max-height:50%;overflow:auto;
  background:var(--bg-overlay,#232838);color:var(--text-1,#e9ecf3);border:1px solid var(--border-strong,rgba(255,255,255,.17));
  border-radius:var(--radius-m,10px);padding:4px var(--space-2,8px) var(--space-2,8px);font-size:12px;box-shadow:var(--shadow-pop,0 4px 12px rgba(0,0,0,.28));
  font-family:var(--font-ui,system-ui,sans-serif)}
.runtime-debug-panel:not([open]){max-height:none;overflow:hidden;padding:0;right:auto;border-radius:999px;opacity:.72}
.runtime-debug-panel:not([open]):hover,.runtime-debug-panel:not([open]):focus-within{opacity:1}
.runtime-debug-panel:not([open]) summary{padding:3px 7px;font-size:13px;line-height:1}
.runtime-debug-panel:not([open]) .runtime-debug-live{display:none}
.runtime-debug-panel:not([open]) .runtime-debug-title{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
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
/* ESC 상태 메뉴가 열려 있는 동안은 이 패널이 메뉴 푸터를 덮는다.
   실측(1280x900, 배율 3.417): 패널 849..871 vs 푸터 824..865 — 소지금·설명·시간이 있는
   아래 16px 가 가려졌다. 전투도 같다 — 실측(1360x768, rm2000): 패널 711..739 vs 무대 밑변 743,
   상태창의 대기 순서와 조작 안내가 통째로 가렸다. 무대 높이를 깎으면 0.5 단위 배율이 한 단계
   내려가므로(1.4375→1.0) 공간을 뚝 떼는 대신 게임 UI 에 자리를 비킨다.
   이 패널은 테스트 플레이 창 전용 보조물이므로 게임 UI 에 양보한다.
   주의: 이 패널은 windowNode(.test-play-window)에 스테이지와 **형제**로 붙는다
   (testPlayModal.ts: windowNode.append(titlebar, body, renderRuntimeDebugPanel())).
   그래서 .play-stage 하위 선택자로는 절대 안 잡힌다 — 공통 조상에서 :has() 로 내려와야 한다. */
.test-play-window:has([data-testid='main-menu']) .runtime-debug-panel,
.test-play-window:has([data-testid='battle-scene']) .runtime-debug-panel{display:none}
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
  const node = document.querySelector("[data-testid='runtime-state-json']");
  // 지연 미러는 textContent 를 읽을 때마다 세션 스냅샷 전체를 만든다. 이 루프는 매 프레임 돌므로
  // 미러가 싸게 내 주는 값(data-live-flags)이 있으면 그것만 쓴다.
  const flags = node instanceof HTMLElement ? node.dataset.liveFlags : undefined;
  if (flags) {
    const [mapId, x, y, inputEnabled, running] = flags.split("|");
    return { mapId, player: { x: Number(x), y: Number(y) }, inputEnabled: inputEnabled === "true", running: running === "true" };
  }
  const text = node?.textContent;
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

function applyLiveReadout(
  line: HTMLElement,
  stateDump: HTMLElement,
  dumpDetails: HTMLDetailsElement,
  switchValue: SwitchValueReadout,
): void {
  // readState() 는 프레임당 한 번만 부른다(세션 전체를 복제하는 비용이 있다).
  const state = debug()?.readState();
  switchValue.apply(state);
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

// ── 선택한 스위치의 현재 값 ────────────────────────────────────
// ON/OFF 를 눌러도 지금 값이 무엇인지 패널 어디에도 없었다 — 확인하려면 전체 JSON 을 열고
// 수백 개 사이에서 해당 id 를 눈으로 찾아야 했다. 셀렉트 옆에 현재 값을 바로 붙인다.
type SwitchValueReadout = {
  readonly node: HTMLElement;
  readonly apply: (state: DebugState | undefined) => void;
};

function createSwitchValueReadout(select: HTMLSelectElement): SwitchValueReadout {
  const node = el("span", { class: "runtime-debug-live", dataset: { testid: "runtime-debug-switch-value" } });
  const apply = (state: DebugState | undefined): void => {
    const id = select.value;
    const value = id ? state?.switches?.[id] : undefined;
    node.textContent = !id ? "—" : value === undefined ? "?" : value ? "ON" : "OFF";
    node.dataset.switchId = id;
    node.dataset.switchValue = value === undefined ? "unknown" : `${value}`;
  };
  // 셀렉트를 바꾸면 다음 라이브 틱을 기다리지 않고 그 자리에서 갱신한다.
  select.addEventListener("change", () => apply(debug()?.readState()));
  apply(debug()?.readState());
  return { node, apply };
}

// ON/OFF 는 누른 직후 값이 바뀌어야 한다 — 리드아웃이 다음 rAF 까지 이전 값을 보여주면
// 작업자는 버튼이 안 먹힌 것으로 읽는다(라이브 루프가 없는 접힌 상황도 있다).
function setSwitchAndRefresh(id: string, value: boolean, switchValue: SwitchValueReadout): void {
  const hook = debug();
  if (!hook) return;
  hook.setSwitch(id, value);
  switchValue.apply(hook.readState());
}

export function renderRuntimeDebugPanel(): HTMLElement {
  ensureDebugPanelStyles();
  const project = store.getCurrent();
  const stateDump = el("pre", { class: "runtime-debug-state", dataset: { testid: "runtime-debug-state" }, text: "상태를 읽으려면 '상태 읽기'를 누르세요." });

  // 스위치 토글.
  const { row: switchFilterRow, select: switchSelect } = filterableSelect(project.switches, "runtime-debug-switch", "스위치 검색(이름/ID)");
  const switchValue = createSwitchValueReadout(switchSelect);
  const switchRow = el("div", {
    class: "runtime-debug-controls",
    children: [
      switchSelect,
      el("button", { class: "runtime-debug-btn", text: "ON", attrs: { type: "button" }, dataset: { testid: "runtime-debug-switch-on" }, on: { click: () => setSwitchAndRefresh(switchSelect.value, true, switchValue) } }),
      el("button", { class: "runtime-debug-btn", text: "OFF", attrs: { type: "button" }, dataset: { testid: "runtime-debug-switch-off" }, on: { click: () => setSwitchAndRefresh(switchSelect.value, false, switchValue) } }),
      switchValue.node,
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

  // 한 줄 라이브 상태. summary 안에 두는 이유: 펼치면 제목 옆에 바로 보이고, 접혀도 DOM 에 남아
  // 라이브 루프가 dataset(기계 판독 경로)을 계속 갱신한다 — 화면에서만 숨긴다(CSS :not([open])).
  const liveLine = el("span", { class: "runtime-debug-live", dataset: { testid: "runtime-debug-live-state" } });

  const details = el("details", {
    class: "runtime-debug-panel",
    dataset: { testid: "runtime-debug-panel" },
    children: [
      el("summary", {
        attrs: { title: "런타임 디버그 (테스트 플레이 계측기)" },
        dataset: { testid: "runtime-debug-toggle" },
        children: [
          el("span", { text: "🛠", attrs: { "aria-hidden": "true" } }),
          // 접힌 아이콘 상태에서도 스크린리더가 이름을 읽도록 display:none 이 아니라 시각적으로만 숨긴다.
          el("span", { class: "runtime-debug-title", text: "런타임 디버그" }),
          liveLine,
        ],
      }),
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

  applyLiveReadout(liveLine, stateDump, dumpDetails, switchValue);
  startLiveLoop(details, () => applyLiveReadout(liveLine, stateDump, dumpDetails, switchValue));
  return details;
}
