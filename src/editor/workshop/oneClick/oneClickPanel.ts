// src/editor/workshop/oneClick/oneClickPanel.ts
/**
 * 공방 「한 번에 만들기」(2026-10-23, 사용자 「공방이 졸라 불편하다. 딸깍 하고 나오는 수준이어야」).
 * 왼쪽 공방 창 하나에서: 물건·캐릭터·지형 중 고르고 → 한 줄(또는 예시) → 「만들기」. 나머지는 알아서 정한다.
 * - 물건: 크기·놓는 방식은 크기 사전(조수 도구와 같은 길), 넣을 칩셋 = 지금 맵 칩셋, 검수 통과 첫 후보를 알아서 골라 굽는다.
 * - 캐릭터·지형: 호스트가 고정판 char-gen·tile-gen 을 사용자 컴퓨터의 에이전트 CLI 로 돌린다(oneClick/hostGen.ts).
 *   캐릭터는 캐릭터 목록에 들어가고, 지형은 지금 맵 칩셋에 합쳐 붓에 든다.
 * - 도는 동안 진행 카드 하나(닫아도 작업 줄에서 계속), 다 되면 토스트 하나 「맵에 놓기」.
 * 고급(후보 수·크기·직접 고르기·종류)은 「자세히」 안에 둔다.
 */
import { openAiSettingsModal } from "@/editor/panels/aiSettingsModal";
import { editorState } from "@/editor/editorState";
import { store } from "@/project/store";
import { clearChildren, el } from "@/util/dom";
import { toast } from "@/util/toast";
import { workshopAiReady } from "../chat";
import { WORKSHOP_GENERATORS, type GeneratorId } from "../generators";
import { gridDataUrl } from "../pixels";
import { armWorkshopStamp } from "../workshopBake";
import { craftBar, generatorStage } from "../workshopArt";
import { jobStateLabel } from "../queue/jobModel";
import { WORKSHOP_JOB_INSTALLED_EVENT, workshopQueue, type JobView, type WorkshopJobInstalledDetail } from "../queue/workshopQueue";
import { inferObjectKind, inferTerrainMode, minutesText, objectTitleAndDescription, ONE_CLICK_KINDS, TERRAIN_MODE_LABELS, type OneClickKind, type TerrainModeId } from "./infer";
import { armCharacterPlacement, armTerrainBrush } from "./place";
import type { QuickTerrainDone } from "./quickTerrain";

const GENERATOR_OF: Readonly<Record<OneClickKind, GeneratorId>> = { object: "object-gen", character: "char-gen", terrain: "tile-gen" };
const KIND_KEY = "oprn:workshop-oneclick-kind";

type Advanced = { count: number; w: number | null; tall: number | null; manual: boolean; mode: TerrainModeId | "auto"; terrainMethod: "quick" | "draw" };

const state = {
  kind: ((): OneClickKind => {
    try { const v = localStorage.getItem(KIND_KEY); return v === "character" || v === "terrain" ? v : "object"; } catch { return "object"; }
  })(),
  text: { object: "", character: "", terrain: "" } as Record<OneClickKind, string>,
  advanced: { count: 1, w: null, tall: null, manual: false, mode: "auto", terrainMethod: "quick" } as Advanced,
  /** 지형 빠른 길의 마지막 결과(작업 줄을 거치지 않는다 — 몇 초면 끝난다) */
  quick: null as (QuickTerrainDone & { readonly at: number; readonly id: string }) | null,
  advancedOpen: false,
  /** 종류마다 마지막으로 시작한 작업 */
  lastJob: {} as Partial<Record<OneClickKind, string>>,
  dismissed: new Set<string>(),
  error: "",
  busy: false,
};

function kindOfJob(view: JobView): OneClickKind | null {
  if (view.job.source !== "oneclick") return null;
  return view.job.generator === "char-gen" ? "character" : view.job.generator === "tile-gen" ? "terrain" : "object";
}

// ── 결과 놓기 ─────────────────────────────────────────────

/** 다 된 작업을 맵에 놓을 준비. 이유가 있으면 토스트로 알린다. */
export function placeOneClickResult(jobId: string): void {
  const view = workshopQueue().snapshot().jobs.find((candidate) => candidate.job.id === jobId);
  const installed = view?.job.installed;
  if (!view || !installed) { toast("아직 넣지 않은 결과예요.", "info"); return; }
  if (installed.kind === "object") {
    const grid = view.round?.runs.find((run) => run.letter === installed.letter)?.grid;
    if (!view.item || !grid) { toast("그림을 찾지 못했어요. 공방에서 다시 열어 주세요.", "error"); return; }
    const reason = armWorkshopStamp(view.item, grid);
    if (reason) { toast(reason, "info"); return; }
    toast(`「${view.job.title}」 붓을 들었어요. 맵에서 놓을 곳을 누르세요. Esc 로 내려놓아요.`, "info");
    return;
  }
  if (installed.characters?.length) {
    const reason = armCharacterPlacement(installed.characters[0]!);
    if (reason) { toast(reason, "info"); return; }
    toast(`「${view.job.title}」을(를) 세울 칸을 맵에서 누르세요. Esc 로 그만둬요.`, "info");
    return;
  }
  if (installed.terrain && installed.terrain.brushTile !== null) {
    const reason = armTerrainBrush({ tilesetId: installed.terrain.tilesetId, brushTile: installed.terrain.brushTile });
    if (reason) { toast(reason, "info"); return; }
    toast(`「${view.job.title}」 붓을 들었어요. 맵을 칠하면 가장자리가 저절로 이어져요.`, "info");
    return;
  }
  toast("이 게임에 넣었어요.", "ok");
}

function placeQuickTerrain(done: QuickTerrainDone): void {
  const reason = armTerrainBrush({ tilesetId: done.tilesetId, brushTile: done.brushTile });
  if (reason) { toast(reason, "info"); return; }
  toast(`「${done.title}」 붓을 들었어요. 맵을 칠하면 가장자리가 저절로 이어져요.`, "info");
}

let listening = false;
function listenForResults(): void {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener(WORKSHOP_JOB_INSTALLED_EVENT, (event) => {
    const { job } = (event as CustomEvent<WorkshopJobInstalledDetail>).detail;
    if (job.source !== "oneclick") return;
    toast(`「${job.title}」 완성!`, { kind: "ok", durationMs: 15000, action: { label: "맵에 놓기", testid: "workshop-oneclick-place-toast", onClick: () => placeOneClickResult(job.id) } });
  });
}

// ── 만들기 ─────────────────────────────────────────────────

async function make(text: string): Promise<string> {
  const kind = state.kind;
  const queue = workshopQueue();
  const project = store.getCurrent();
  const mapId = editorState.get().currentMapId;
  const map = mapId ? project.maps[mapId] : undefined;
  if (kind === "character") {
    const job = await queue.enqueueRemote({ kind: "char-gen", text, count: Math.min(4, state.advanced.count) });
    return job.id;
  }
  if (!map) throw new Error("열린 맵이 없어요. 넣을 맵을 먼저 열어 주세요.");
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset || tileset.tileSize !== 16) throw new Error("공방은 16px 칩셋 맵에만 그려 넣어요.");
  if (kind === "terrain" && state.advanced.terrainMethod === "quick") {
    const { makeQuickTerrain } = await import("./quickTerrain");
    const done = await makeQuickTerrain(text, tileset.id);
    const id = `quick:${done.groupId}:${Date.now().toString(36)}`;
    state.quick = { ...done, at: Date.now(), id };
    toast(`「${done.title}」 완성!`, { kind: "ok", durationMs: 15000, action: { label: "맵에 놓기", testid: "workshop-oneclick-place-toast", onClick: () => placeQuickTerrain(done) } });
    return id;
  }
  if (kind === "terrain") {
    const mode = state.advanced.mode === "auto" ? inferTerrainMode(text) : state.advanced.mode;
    const job = await queue.enqueueRemote({ kind: "tile-gen", text, mode, count: Math.min(2, state.advanced.count), targetTilesetId: tileset.id });
    return job.id;
  }
  const { buildObjectGenRequest } = await import("@/editor/tools/objectGenTool");
  const { title, description } = objectTitleAndDescription(text);
  const args: Record<string, unknown> = {
    mapId: map.id, title, description, objectKind: inferObjectKind(text), need: text,
    ...(state.advanced.w ? { tilesW: state.advanced.w } : {}), ...(state.advanced.tall ? { cellsTall: state.advanced.tall } : {}),
  };
  let request;
  try {
    request = buildObjectGenRequest(project, args, { skipExisting: true }).data;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "people-not-generated") throw new Error("사람·동물은 「캐릭터」에서 만들어요.");
    if (code === "terrain-not-object") throw new Error("바닥·땅·물은 「지형」에서 만들어요.");
    throw error;
  }
  const job = await queue.enqueueAssistantRequest(request, { source: "oneclick", count: Math.min(3, state.advanced.count), autoPick: !state.advanced.manual });
  return job.id;
}

// ── 화면 ──────────────────────────────────────────────────

function chipButton(text: string, testid: string, onClick: () => void, pressed?: boolean): HTMLButtonElement {
  return el("button", {
    class: "workshop-oneclick-chip" + (pressed ? " is-on" : ""), text, attrs: { type: "button", ...(pressed === undefined ? {} : { "aria-pressed": String(pressed) }) },
    dataset: { testid }, on: { click: onClick },
  });
}

function select<T extends string | number>(label: string, value: T, options: readonly (readonly [T, string])[], onChange: (value: T) => void, testid: string): HTMLElement {
  const box = el("select", { attrs: { "aria-label": label }, dataset: { testid }, children: options.map(([v, text]) => el("option", { value: String(v), text })) }) as HTMLSelectElement;
  box.value = String(value);
  box.addEventListener("change", () => {
    const raw = box.value;
    const hit = options.find(([v]) => String(v) === raw);
    if (hit) onChange(hit[0]);
  });
  return el("label", { class: "workshop-oneclick-field", children: [el("span", { text: label }), box] });
}

function advancedBox(render: () => void): HTMLElement {
  const a = state.advanced;
  const fields: HTMLElement[] = [];
  if (state.kind === "object") {
    fields.push(select("후보", a.count, [[1, "1장(가장 빠름)"], [2, "2장"], [3, "3장"]], (v) => { a.count = v; }, "workshop-oneclick-count"));
    fields.push(select("가로", a.w ?? 0, [[0, "알아서"], [1, "1칸"], [2, "2칸"], [3, "3칸"], [4, "4칸"], [5, "5칸"], [6, "6칸"]], (v) => { a.w = v || null; }, "workshop-oneclick-w"));
    fields.push(select("키", a.tall ?? 0, [[0, "알아서"], [1, "1칸"], [2, "2칸"], [3, "3칸"], [4, "4칸"], [5, "5칸"], [6, "6칸"]], (v) => { a.tall = v || null; }, "workshop-oneclick-tall"));
    const manual = el("input", { attrs: { type: "checkbox" }, dataset: { testid: "workshop-oneclick-manual" } }) as HTMLInputElement;
    manual.checked = a.manual;
    manual.addEventListener("change", () => { a.manual = manual.checked; });
    fields.push(el("label", { class: "workshop-oneclick-check", children: [manual, el("span", { text: "후보를 내가 직접 고르기" })] }));
  } else if (state.kind === "character") {
    fields.push(select("몇 명", a.count, [[1, "1명(가장 빠름)"], [2, "2명"], [3, "3명"], [4, "4명"]], (v) => { a.count = v; }, "workshop-oneclick-count"));
  } else {
    fields.push(select("방법", a.terrainMethod, [["quick", "빠르게 — 지금 칩셋 물·길 모양에 새 재질(몇 초)"], ["draw", "새로 그리기 — 내 AI 가 처음부터(20분 넘게)"]], (v) => { a.terrainMethod = v; render(); }, "workshop-oneclick-method"));
    if (a.terrainMethod === "draw") {
      const modes = Object.entries(TERRAIN_MODE_LABELS) as [TerrainModeId, string][];
      fields.push(select("종류", a.mode, [["auto", "알아서(글에서)"], ...modes] as [TerrainModeId | "auto", string][], (v) => { a.mode = v; }, "workshop-oneclick-mode"));
      fields.push(select("후보", Math.min(2, a.count), [[1, "1벌(가장 빠름)"], [2, "2벌"]], (v) => { a.count = v; }, "workshop-oneclick-count"));
      fields.push(el("p", { class: "left-workshop-meta", text: "새로 그린 지형은 독립 검수를 통과한 것만 넣어요. 떨어지면 아무것도 넣지 않아요." }));
    }
  }
  const details = el("details", {
    class: "workshop-oneclick-more", dataset: { testid: "workshop-oneclick-more" },
    children: [el("summary", { text: "자세히" }), el("div", { class: "workshop-oneclick-fields", children: fields })],
  }) as HTMLDetailsElement;
  details.open = state.advancedOpen;
  details.addEventListener("toggle", () => { state.advancedOpen = details.open; });
  return details;
}

function elapsedOf(view: JobView): number {
  const remote = view.job.remote?.status?.elapsedMs;
  if (remote !== undefined && remote > 0) return remote;
  const start = view.job.startedAt ?? view.job.createdAt;
  const end = view.job.finishedAt ?? Date.now();
  return Math.max(0, end - start);
}

/** 결과 미리 보기(작게): 물건 = 고른 격자, 캐릭터 = 앞모습 칩. */
function resultThumb(view: JobView): HTMLElement | null {
  const installed = view.job.installed;
  if (!installed) return null;
  if (installed.kind === "object") {
    const grid = view.round?.runs.find((run) => run.letter === installed.letter)?.grid;
    const palette = view.session && view.item ? view.session.runner.palette(view.item) : null;
    if (!grid || !palette) return null;
    return el("img", { class: "workshop-oneclick-thumb", attrs: { src: gridDataUrl(grid, palette, 3), alt: view.job.title } });
  }
  const chip = installed.characters?.[0];
  const asset = chip ? store.getCurrent().assets.uploaded[chip.textureKey] : undefined;
  const url = asset && "dataUrl" in asset ? (asset as { dataUrl?: string }).dataUrl : undefined;
  if (!chip || !url) return null;
  const col = (chip.characterIndex % 4) * 72 + 24, row = Math.floor(chip.characterIndex / 4) * 128 + 64;
  return el("span", {
    class: "workshop-oneclick-thumb is-chip", attrs: { role: "img", "aria-label": view.job.title, style: `background-image:url(${url});background-position:${-col * 3}px ${-row * 3}px;background-size:${288 * 3}px ${256 * 3}px` },
  });
}

function progressCard(view: JobView, render: () => void): HTMLElement {
  const { job, state: jobState } = view;
  const queue = workshopQueue();
  const working = jobState === "queued" || jobState === "reference" || jobState === "drawing" || jobState === "review" || jobState === "installing";
  const children: HTMLElement[] = [];
  const close = el("button", {
    class: "workshop-oneclick-close", text: "×", attrs: { type: "button", "aria-label": "닫기 (작업은 계속돼요)", title: "닫아도 계속 그려요" },
    dataset: { testid: "workshop-oneclick-close" }, on: { click: () => { state.dismissed.add(job.id); render(); } },
  });
  const time = minutesText(elapsedOf(view));
  const label = jobState === "installed" ? "완성" : jobStateLabel(job, jobState);
  children.push(el("div", {
    class: "workshop-oneclick-card-head",
    children: [el("strong", { text: job.title }), el("span", { class: "left-workshop-meta", text: `${label} · ${time}` }), close],
  }));
  if (working) {
    const remote = job.remote?.status;
    const stage = remote?.stage === "packing" ? "묶는 중" : remote?.reviewing ? "검수 중" : null;
    children.push(craftBar({ value: view.progress > 0 ? view.progress : null, hot: jobState !== "queued", label: `${job.title} 만드는 중` }));
    children.push(el("p", {
      class: "left-workshop-meta",
      text: `${stage ? `${stage} · ` : ""}${job.generator === "tile-gen" ? "지형은 그리기·검수를 거쳐 오래 걸려요(20분 넘게)." : view.etaMs ? `약 ${Math.max(1, Math.round(view.etaMs / 60000))}분 남음.` : ""} 닫아도 계속 그려요.`,
    }));
    children.push(el("button", {
      class: "left-workshop-link", text: "그만두기", attrs: { type: "button" }, dataset: { testid: "workshop-oneclick-cancel" },
      on: { click: () => { void queue.cancel(job.id).then(render); } },
    }));
  } else if (jobState === "installed") {
    const thumb = resultThumb(view);
    const what = job.installed?.kind === "object" ? "칩셋에 넣었어요." : job.installed?.kind === "pack" && job.installed.characters?.length ? "캐릭터 목록에 넣었어요." : job.installed?.kind === "pack" && job.installed.terrain ? "지금 맵 칩셋에 넣었어요." : "이 게임에 넣었어요.";
    children.push(el("div", { class: "workshop-oneclick-done", children: [...(thumb ? [thumb] : []), el("p", { class: "left-workshop-meta", text: `${what} 「맵에 놓기」를 누르고 맵을 클릭하세요.` })] }));
    children.push(el("button", { class: "left-workshop-primary", text: "맵에 놓기", attrs: { type: "button" }, dataset: { testid: "workshop-oneclick-place" }, on: { click: () => placeOneClickResult(job.id) } }));
  } else if (jobState === "ready" && job.autoPick !== false) {
    // 알아서 고르는 중(검수 통과 후보 고르기·굽기) — 사람에게 묻지 않는다.
    children.push(craftBar({ value: null, hot: true, label: `${job.title} 고르는 중` }));
    children.push(el("p", { class: "left-workshop-meta", text: "검수를 통과한 그림을 골라 넣는 중이에요." }));
  } else if (jobState === "ready") {
    // 「자세히 → 후보를 내가 직접 고르기」를 켠 작업만 여기에 온다.
    children.push(el("p", { class: "left-workshop-note", text: "후보가 나왔어요. 마음에 드는 하나를 골라 주세요." }));
    children.push(el("button", {
      class: "left-workshop-primary", text: "후보 보고 고르기", attrs: { type: "button" }, dataset: { testid: "workshop-oneclick-pick" },
      on: { click: () => { if (job.harnessId) void import("../workshopWorkspace").then(({ openWorkshop }) => openWorkshop(job.harnessId!)); } },
    }));
  } else if (jobState === "failed" || jobState === "paused") {
    const runError = view.round?.runs.map((run) => run.error).find((error): error is string => Boolean(error));
    const reason = (job.error ?? job.pause?.reason ?? (runError ? `못 그렸어요 — ${runError}` : "못 그렸어요.")).slice(0, 160);
    children.push(el("p", { class: "left-workshop-note is-error", dataset: { testid: "workshop-oneclick-error" }, text: reason }));
    children.push(el("button", {
      class: "left-workshop-primary", text: "다시 만들기", attrs: { type: "button" }, dataset: { testid: "workshop-oneclick-retry" },
      on: { click: () => { void (jobState === "paused" ? queue.resume(job.id) : queue.retry(job.id)); } },
    }));
  }
  return el("div", { class: `workshop-oneclick-card is-${jobState}`, dataset: { testid: "workshop-oneclick-card", state: jobState, job: job.id }, children });
}

function quickCard(done: QuickTerrainDone & { readonly id: string }, render: () => void): HTMLElement {
  const close = el("button", {
    class: "workshop-oneclick-close", text: "×", attrs: { type: "button", "aria-label": "닫기" },
    dataset: { testid: "workshop-oneclick-close" }, on: { click: () => { state.dismissed.add(done.id); render(); } },
  });
  return el("div", {
    class: "workshop-oneclick-card is-installed", dataset: { testid: "workshop-oneclick-card", state: "installed", job: done.id },
    children: [
      el("div", { class: "workshop-oneclick-card-head", children: [el("strong", { text: done.title }), el("span", { class: "left-workshop-meta", text: `완성 · ${(done.ms / 1000).toFixed(1)}초` }), close] }),
      el("div", {
        class: "workshop-oneclick-done",
        children: [
          el("img", { class: "workshop-oneclick-thumb", attrs: { src: done.thumbUrl, alt: done.title } }),
          el("p", { class: "left-workshop-meta", text: `지금 맵 칩셋에 넣었어요(「${done.sourceName}」 모양 · ${done.material}). 「맵에 놓기」를 누르고 맵을 칠하세요.` }),
        ],
      }),
      el("button", { class: "left-workshop-primary", text: "맵에 놓기", attrs: { type: "button" }, dataset: { testid: "workshop-oneclick-place" }, on: { click: () => placeQuickTerrain(done) } }),
    ],
  });
}

/** 공방 창 본문(왼쪽 막대). 부르는 쪽이 root 를 비우고 붙인다. */
export function renderOneClick(root: HTMLElement, rerender: () => void): void {
  listenForResults();
  const kind = state.kind;
  const def = ONE_CLICK_KINDS.find((k) => k.id === kind)!;
  const generator = WORKSHOP_GENERATORS.find((g) => g.id === GENERATOR_OF[kind])!;
  const aiReady = workshopAiReady();
  const tabs = el("div", {
    class: "workshop-oneclick-tabs", attrs: { role: "tablist", "aria-label": "만들 것" },
    children: ONE_CLICK_KINDS.map((k) => el("button", {
      class: "workshop-oneclick-tab" + (k.id === kind ? " is-on" : ""), text: k.label,
      attrs: { type: "button", role: "tab", "aria-selected": String(k.id === kind) }, dataset: { testid: `workshop-oneclick-tab-${k.id}` },
      on: {
        click: () => {
          state.kind = k.id;
          state.error = "";
          try { localStorage.setItem(KIND_KEY, k.id); } catch { /* restricted */ }
          rerender();
        },
      },
    })),
  });
  const input = el("input", {
    class: "workshop-oneclick-input", attrs: { type: "text", placeholder: def.placeholder, "aria-label": `만들 ${def.label}`, maxlength: "120", enterkeyhint: "go" },
    dataset: { testid: "workshop-oneclick-input" },
  }) as HTMLInputElement;
  input.value = state.text[kind];
  const go = el("button", { class: "left-workshop-primary", text: "만들기", attrs: { type: "button" }, dataset: { testid: "workshop-oneclick-make" } }) as HTMLButtonElement;
  const needsAi = kind === "object" && !aiReady;
  if (needsAi) go.textContent = "내 AI 연결하고 만들기";
  const submit = (): void => {
    if (needsAi) { openAiSettingsModal(); return; }
    const text = input.value.trim() || def.examples[0]!;
    state.text[kind] = text;
    if (state.busy) return;
    state.busy = true;
    state.error = "";
    go.disabled = true;
    void make(text).then((jobId) => {
      state.lastJob[kind] = jobId;
      state.dismissed.delete(jobId);
      state.text[kind] = "";
    }, (error: unknown) => {
      state.error = error instanceof Error ? error.message : String(error);
    }).finally(() => { state.busy = false; rerender(); });
  };
  input.addEventListener("input", () => { state.text[kind] = input.value; });
  input.addEventListener("keydown", (event) => { if (event.key === "Enter" && !event.isComposing) { event.preventDefault(); submit(); } });
  go.addEventListener("click", submit);
  const examples = el("div", {
    class: "workshop-oneclick-examples", attrs: { "aria-label": "예시" },
    children: def.examples.map((example, index) => chipButton(example, `workshop-oneclick-example-${index}`, () => { input.value = example; state.text[kind] = example; input.focus(); })),
  });
  // 이 종류의 최근 작업 하나(닫지 않았으면)
  const views = workshopQueue().snapshot().jobs.filter((view) => kindOfJob(view) === kind && !state.dismissed.has(view.job.id) && view.state !== "cancelled");
  const current = views.find((view) => view.job.id === state.lastJob[kind]) ?? views.at(-1);
  const quick = kind === "terrain" && state.quick && !state.dismissed.has(state.quick.id) && (!current || state.lastJob.terrain === state.quick.id) ? state.quick : null;
  const card = quick ? quickCard(quick, rerender) : current ? progressCard(current, rerender) : null;
  root.append(
    el("div", {
      class: "left-workshop-card workshop-oneclick", dataset: { testid: "workshop-oneclick", kind },
      children: [
        tabs,
        generatorStage(generator, "card"),
        el("div", {
          class: "left-workshop-card-body",
          children: [
            el("p", { class: "left-workshop-description", text: generator.makes }),
            input,
            examples,
            go,
            ...(state.error ? [el("p", { class: "left-workshop-note is-error", attrs: { role: "alert" }, dataset: { testid: "workshop-oneclick-make-error" }, text: state.error })] : []),
            ...(needsAi ? [el("p", { class: "left-workshop-note", text: "물건은 내 AI 계정으로 그려요. 연결하면 바로 만들 수 있어요." })] : []),
            advancedBox(rerender),
          ],
        }),
      ],
    }),
    ...(card ? [card] : []),
  );
}

/** 왼쪽 창이 다시 그릴지 가늠할 서명 — 이 창이 보이는 작업들의 상태·진행만. */
export function oneClickSignature(): string {
  return JSON.stringify(workshopQueue().snapshot().jobs.filter((view) => view.job.source === "oneclick").map((view) => [view.job.id, view.state, Math.round(view.progress * 20), view.job.remote?.status?.stage ?? "", Math.floor(elapsedOf(view) / 30000)]));
}

export function clearOneClick(root: HTMLElement): void {
  clearChildren(root);
}
