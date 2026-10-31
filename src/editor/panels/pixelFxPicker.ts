// pixelfx 코드 효과 고르기 창(2026-10-31). 분류·낱말로 찾고, 칸마다 정지 견본, 고른 효과는 오른쪽에서 실제 재생한다.
// 색 바꾸기(견본 띠·한 색에서 띠 만들기)·뒤집기·씨앗을 정해 PixelFxSpec 으로 돌려준다. 효과 이름·설명은 원본(영어) 데이터라 번역하지 않는다.
// 부르는 곳: 전투 애니메이션 레코드 폼, 기술·아이템 애니메이션 칸, 이벤트 명령 「애니메이션 표시」, 이벤트 페이지 상시 효과.
import { openDialog } from "@/editor/panels/databaseEnemyRecordSupport";
import {
  PIXEL_FX_CATEGORIES,
  PIXEL_FX_CATEGORY_LABELS,
  PIXEL_FX_PALETTE_PRESETS,
  pixelFxEntry,
  pixelFxRampFromColor,
  searchPixelFx,
  type PixelFxCatalogEntry,
} from "@/pixelfx/catalog";
import { mountPixelFxDom, renderPixelFxStill, type PixelFxDomPlayback } from "@/pixelfx/domPlayer";
import { normalizePixelFxSpec } from "@/project/pixelFxSpec";
import type { EventPage, MapId, PixelFxSpec } from "@/project/types";
import { ensurePixelFxAnimationRecord } from "@/editor/databaseActions";
import { updateEventPage } from "@/editor/eventPages";
import { store } from "@/project/store";
import { el } from "@/util/dom";

export interface PixelFxPickerOptions {
  readonly title?: string;
  readonly initial?: PixelFxSpec;
  /** 반복 효과만 먼저 보인다(상시 효과 — 횃불·모닥불·날씨). 체크를 풀면 전부. */
  readonly preferLoop?: boolean;
  readonly opener?: HTMLElement | null;
  readonly onPick: (spec: PixelFxSpec) => void;
}

const CARD_BOX = 72;
const STAGE_BOX = 260;

export function openPixelFxPicker(options: PixelFxPickerOptions): void {
  let spec: PixelFxSpec = normalizePixelFxSpec(options.initial) ?? { effectId: options.preferLoop ? "fire/torch" : "fire/fireball" };
  let category = pixelFxEntry(spec.effectId)?.category ?? "";
  // 처음 분류는 지금 효과의 분류다 — 사람이 분류를 직접 고르기 전에는 찾기 낱말이 전체 분류에서 찾는다.
  let categoryChosen = false;
  let query = "";
  let loopOnly = Boolean(options.preferLoop);
  let stage: PixelFxDomPlayback | undefined;
  let stillJob = 0;

  const search = el("input", {
    class: "pixel-fx-picker-search",
    attrs: { type: "search", placeholder: "효과 찾기 (예: 횃불, frost, heal)", "aria-label": "효과 찾기" },
    dataset: { testid: "pixel-fx-search" },
  }) as HTMLInputElement;
  const categorySelect = el("select", {
    class: "pixel-fx-picker-category",
    attrs: { "aria-label": "분류" },
    dataset: { testid: "pixel-fx-category" },
    children: [
      el("option", { text: "전체 분류", attrs: { value: "" } }),
      ...PIXEL_FX_CATEGORIES.map((entry) => el("option", { text: PIXEL_FX_CATEGORY_LABELS[entry.id] ?? entry.name, attrs: { value: entry.id } })),
    ],
  }) as HTMLSelectElement;
  categorySelect.value = category;
  const loopToggle = el("input", { attrs: { type: "checkbox" }, dataset: { testid: "pixel-fx-loop-only" } }) as HTMLInputElement;
  loopToggle.checked = loopOnly;
  const grid = el("div", { class: "pixel-fx-picker-grid", dataset: { testid: "pixel-fx-grid" }, attrs: { role: "listbox", "aria-label": "효과 목록" } });
  const count = el("span", { class: "pixel-fx-picker-count" });

  const stageHost = el("div", { class: "pixel-fx-picker-stage", dataset: { testid: "pixel-fx-stage" } });
  stageHost.style.cssText = `position:relative;width:${STAGE_BOX}px;height:${STAGE_BOX}px;overflow:hidden;background:#141821;border-radius:6px`;
  const title = el("strong", { class: "pixel-fx-picker-name", attrs: { "data-i18n-skip": "" } });
  const meta = el("p", { class: "pixel-fx-picker-meta" });
  const desc = el("p", { class: "pixel-fx-picker-desc", attrs: { "data-i18n-skip": "" } });
  const swatches = el("div", { class: "pixel-fx-picker-swatches", dataset: { testid: "pixel-fx-palettes" } });
  const colorInput = el("input", { attrs: { type: "color", value: "#4fa0ff", "aria-label": "한 색으로 칠하기", title: "한 색으로 칠하기" }, dataset: { testid: "pixel-fx-color" } }) as HTMLInputElement;
  const flip = el("input", { attrs: { type: "checkbox" }, dataset: { testid: "pixel-fx-flip" } }) as HTMLInputElement;
  const seed = el("input", { attrs: { type: "number", min: "0", max: "999999", step: "1", "aria-label": "씨앗" }, dataset: { testid: "pixel-fx-seed" } }) as HTMLInputElement;
  seed.style.width = "6em";

  const restartStage = (): void => {
    stage?.destroy();
    const entry = pixelFxEntry(spec.effectId);
    if (!entry) return;
    const [w = 96, h = 96] = entry.size;
    const fit = Math.max(0.25, Math.min(3, Math.floor(Math.min(STAGE_BOX / w, STAGE_BOX / h) * 4) / 4));
    stage = mountPixelFxDom(spec, { pixelScale: fit, repeat: true, centered: true });
    stage.element.style.left = "50%";
    stage.element.style.top = "50%";
    stageHost.replaceChildren(stage.element);
  };

  const renderSide = (): void => {
    const entry = pixelFxEntry(spec.effectId);
    title.textContent = entry ? `${entry.name}  ·  ${entry.id}` : spec.effectId;
    meta.textContent = entry
      ? `${PIXEL_FX_CATEGORY_LABELS[entry.category] ?? entry.category} · ${entry.loop ? "반복" : "한 번"} · ${entry.duration}초 · ${entry.size[0]}×${entry.size[1]}`
      : "";
    desc.textContent = entry?.desc ?? "";
    flip.checked = Boolean(spec.flip);
    seed.value = spec.seed !== undefined ? String(spec.seed) : "";
    for (const node of swatches.querySelectorAll<HTMLElement>("[data-palette]")) {
      const id = node.dataset.palette;
      const preset = PIXEL_FX_PALETTE_PRESETS.find((entry) => entry.id === id);
      const active = id === "default" ? !spec.palette : Boolean(preset && spec.palette?.join() === preset.palette.join());
      node.setAttribute("aria-pressed", String(active));
    }
    restartStage();
  };

  const swatch = (id: string, label: string, colors: readonly string[]): HTMLElement => {
    const button = el("button", {
      class: "btn small pixel-fx-swatch",
      attrs: { type: "button", title: label, "aria-pressed": "false" },
      dataset: { palette: id, testid: `pixel-fx-palette-${id}` },
      children: [
        el("span", { class: "pixel-fx-swatch-strip", children: colors.map((color) => { const chip = el("i"); chip.style.cssText = `display:inline-block;width:6px;height:12px;background:${color}`; return chip; }) }),
        el("span", { text: label }),
      ],
    });
    button.addEventListener("click", () => {
      spec = id === "default" ? withoutPalette(spec) : { ...spec, palette: [...colors] };
      renderSide();
    });
    return button;
  };
  const defaultColors = (): readonly string[] => pixelFxEntry(spec.effectId)?.palette ?? [];
  const rebuildSwatches = (): void => {
    swatches.replaceChildren(
      swatch("default", "원래 색", defaultColors()),
      ...PIXEL_FX_PALETTE_PRESETS.map((preset) => swatch(preset.id, preset.label, preset.palette)),
      el("label", { class: "pixel-fx-picker-color", children: [colorInput, el("span", { text: "한 색으로" })] }),
    );
  };
  colorInput.addEventListener("input", () => {
    const ramp = pixelFxRampFromColor(colorInput.value);
    if (ramp) { spec = { ...spec, palette: ramp }; renderSide(); }
  });
  flip.addEventListener("change", () => { spec = { ...spec, flip: flip.checked || undefined }; if (!flip.checked) delete spec.flip; renderSide(); });
  seed.addEventListener("change", () => {
    const value = Number.parseInt(seed.value, 10);
    spec = Number.isFinite(value) ? { ...spec, seed: Math.max(0, value) } : withoutSeed(spec);
    renderSide();
  });

  const choose = (entry: PixelFxCatalogEntry): void => {
    // 효과를 바꾸면 색·씨앗은 그 효과의 것으로 돌아간다(다른 효과의 띠 길이·뜻이 다르다). 뒤집기만 남긴다.
    spec = { effectId: entry.id, ...(spec.flip ? { flip: true } : {}) };
    for (const card of grid.querySelectorAll<HTMLElement>("[data-effect-id]")) card.setAttribute("aria-selected", String(card.dataset.effectId === entry.id));
    rebuildSwatches();
    renderSide();
  };

  const renderGrid = (): void => {
    const job = ++stillJob;
    const activeCategory = query.trim() && !categoryChosen ? "" : category;
    categorySelect.value = activeCategory;
    const entries = searchPixelFx(query, { ...(activeCategory ? { category: activeCategory } : {}), ...(loopOnly ? { loop: true } : {}), limit: 400 });
    count.textContent = `${entries.length}개`;
    grid.replaceChildren(...entries.map((entry) => {
      const canvas = el("canvas", { class: "pixel-fx-card-still" }) as HTMLCanvasElement;
      const [w = 96, h = 96] = entry.size;
      const fit = Math.min(1, CARD_BOX / w, CARD_BOX / h);
      canvas.style.cssText = `width:${Math.round(w * fit)}px;height:${Math.round(h * fit)}px;image-rendering:pixelated`;
      const card = el("button", {
        class: "pixel-fx-card",
        attrs: { type: "button", role: "option", "aria-selected": String(entry.id === spec.effectId), title: entry.desc },
        dataset: { effectId: entry.id, testid: `pixel-fx-card-${entry.id}` },
        children: [
          el("span", { class: "pixel-fx-card-thumb", children: [canvas] }),
          el("span", { class: "pixel-fx-card-name", text: entry.name, attrs: { "data-i18n-skip": "" } }),
          el("span", { class: "pixel-fx-card-kind", text: entry.loop ? "반복" : "한 번" }),
        ],
      });
      card.addEventListener("click", () => choose(entry));
      card.addEventListener("dblclick", () => { choose(entry); pickButton()?.click(); });
      return card;
    }));
    // 정지 견본은 한 장씩 틈틈이 그린다 — 시뮬레이션 효과는 장마다 수 ms 다. 검색이 바뀌면(job) 멈춘다.
    const cards = [...grid.querySelectorAll<HTMLElement>("[data-effect-id]")];
    let index = 0;
    const next = (): void => {
      if (job !== stillJob || index >= cards.length) return;
      const card = cards[index++]!;
      const canvas = card.querySelector("canvas")!;
      void renderPixelFxStill({ effectId: card.dataset.effectId! }, canvas).finally(() => setTimeout(next, 0));
    };
    next();
  };

  search.addEventListener("input", () => { query = search.value; renderGrid(); });
  categorySelect.addEventListener("change", () => { category = categorySelect.value; categoryChosen = true; renderGrid(); });
  loopToggle.addEventListener("change", () => { loopOnly = loopToggle.checked; renderGrid(); });

  const body = el("div", {
    class: "pixel-fx-picker",
    dataset: { testid: "pixel-fx-picker" },
    children: [
      el("div", {
        class: "pixel-fx-picker-filters",
        children: [search, categorySelect, el("label", { class: "pixel-fx-picker-loop", children: [loopToggle, el("span", { text: "반복 효과만" })] }), count],
      }),
      el("div", {
        class: "pixel-fx-picker-body",
        children: [
          grid,
          el("aside", {
            class: "pixel-fx-picker-side",
            children: [
              stageHost, title, meta, desc,
              el("div", { class: "pixel-fx-picker-row", children: [el("span", { text: "색" }), swatches] }),
              el("div", {
                class: "pixel-fx-picker-row",
                children: [
                  el("label", { children: [flip, el("span", { text: "좌우 뒤집기" })] }),
                  el("label", { children: [el("span", { text: "씨앗" }), seed] }),
                ],
              }),
              el("p", { class: "pixel-fx-picker-credit", text: "효과: pixelfx (MIT) · patch-gg/pixelfx" }),
            ],
          }),
        ],
      }),
    ],
  });
  applyPickerStyle(body, grid);
  rebuildSwatches();
  renderGrid();
  renderSide();

  let pickedButton: HTMLButtonElement | null = null;
  const pickButton = (): HTMLButtonElement | null => pickedButton;
  openDialog(
    "pixel-fx-picker-dialog",
    options.title ?? "픽셀 효과 고르기",
    [body],
    [
      { label: "취소", testid: "pixel-fx-cancel" },
      { label: "이 효과 쓰기", testid: "pixel-fx-pick", primary: true, action: () => options.onPick(spec) },
    ],
    options.opener ?? null,
    () => { stillJob += 1; stage?.destroy(); },
  );
  pickedButton = document.querySelector<HTMLButtonElement>("[data-testid='pixel-fx-pick']");
  search.focus();
}

function withoutPalette(spec: PixelFxSpec): PixelFxSpec {
  const { palette: _palette, ...rest } = spec;
  return rest;
}

function withoutSeed(spec: PixelFxSpec): PixelFxSpec {
  const { seed: _seed, ...rest } = spec;
  return rest;
}

/** 대화상자 공용 껍데기(.db-enemy-dialog) 안의 배치. 전용 CSS 시트를 늘리지 않으려고 인라인으로 둔다. */
function applyPickerStyle(body: HTMLElement, grid: HTMLElement): void {
  body.style.cssText = "display:flex;flex-direction:column;gap:8px;width:min(920px,86vw)";
  const filters = body.querySelector<HTMLElement>(".pixel-fx-picker-filters")!;
  filters.style.cssText = "display:flex;gap:8px;align-items:center;flex-wrap:wrap";
  const inner = body.querySelector<HTMLElement>(".pixel-fx-picker-body")!;
  inner.style.cssText = "display:flex;gap:12px;align-items:flex-start";
  grid.style.cssText = "flex:1;display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:6px;max-height:min(520px,62vh);overflow:auto;padding:2px";
  const side = body.querySelector<HTMLElement>(".pixel-fx-picker-side")!;
  side.style.cssText = `width:${STAGE_BOX}px;display:flex;flex-direction:column;gap:6px`;
  const style = document.getElementById("pixel-fx-picker-style") ?? document.head.appendChild(Object.assign(document.createElement("style"), { id: "pixel-fx-picker-style" }));
  style.textContent = `
.pixel-fx-card{display:flex;flex-direction:column;align-items:center;gap:2px;padding:4px;border:1px solid rgba(255,255,255,.12);border-radius:6px;background:#141821;color:#dfe6f0;cursor:pointer;font:inherit}
.pixel-fx-card[aria-selected="true"]{outline:2px solid #6aa8ff;border-color:#6aa8ff}
.pixel-fx-card-thumb{display:flex;align-items:center;justify-content:center;width:${CARD_BOX}px;height:${CARD_BOX}px}
.pixel-fx-card-name{font-size:11px;line-height:1.2;text-align:center}
.pixel-fx-card-kind{font-size:10px;opacity:.6}
.pixel-fx-picker-swatches{display:flex;flex-wrap:wrap;gap:4px}
.pixel-fx-swatch{display:inline-flex;align-items:center;gap:4px;flex:0 0 auto}
.pixel-fx-swatch[aria-pressed="true"]{outline:2px solid #6aa8ff}
.pixel-fx-picker-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.pixel-fx-picker-meta,.pixel-fx-picker-desc,.pixel-fx-picker-credit{margin:0;font-size:12px;opacity:.85}
.pixel-fx-picker-credit{opacity:.55}`;
}

/**
 * 「픽셀 효과…」 단추: 고른 효과를 트는 전투 애니메이션 레코드(anim_pfx_*)를 찾거나 만들고 그 id 를 넘긴다.
 * 기술·아이템·직업의 애니메이션 칸과 이벤트 명령 「애니메이션 표시」가 쓴다.
 */
export function pixelFxAnimationPickButton(options: {
  readonly testid: string;
  readonly currentAnimationId?: string;
  readonly recordName?: string;
  readonly onAnimationId: (animationId: string) => void;
}): HTMLElement {
  const button = el("button", {
    class: "btn small pixel-fx-pick-button",
    text: "픽셀 효과…",
    attrs: { type: "button", title: "코드로 그리는 픽셀 효과(232종)에서 고릅니다 — 색·뒤집기를 바꿀 수 있습니다." },
    dataset: { testid: options.testid },
  });
  button.addEventListener("click", () => {
    const current = store.getCurrent().database.battleAnimations.find((record) => record.id === options.currentAnimationId);
    openPixelFxPicker({
      opener: button,
      ...(current?.pixelFx ? { initial: current.pixelFx } : {}),
      onPick: (spec) => {
        const entry = pixelFxEntry(spec.effectId);
        const id = ensurePixelFxAnimationRecord(spec, { name: options.recordName ?? (entry ? `${entry.name} (pixelfx)` : undefined) });
        if (id) options.onAnimationId(id);
      },
    });
  });
  return button;
}

/** 이벤트 페이지 「상시 효과」: 지금 효과 이름 + 고르기·층·떼기. 페이지가 켜진 동안 이벤트 자리에서 계속 돈다. */
export function renderPagePixelFxControl(mapId: MapId, eventId: string, page: EventPage): HTMLElement {
  const current = page.pixelFx;
  const entry = pixelFxEntry(current?.effectId);
  const label = el("span", {
    class: "pixel-fx-page-current",
    text: current ? (entry ? `${entry.name} · ${entry.id}` : current.effectId) : "없음",
    attrs: { "data-i18n-skip": "" },
    dataset: { testid: "event-page-pixel-fx-current" },
  });
  const pick = el("button", {
    class: "btn small",
    text: current ? "바꾸기…" : "효과 고르기…",
    attrs: { type: "button" },
    dataset: { testid: "event-page-pixel-fx-pick" },
  });
  pick.addEventListener("click", () => openPixelFxPicker({
    opener: pick,
    preferLoop: true,
    title: "상시 효과 고르기",
    ...(current ? { initial: current } : {}),
    onPick: (spec) => updateEventPage(mapId, eventId, page.id, { pixelFx: { ...spec, ...(current?.layer ? { layer: current.layer } : {}) } }, "상시 효과 바꾸기"),
  }));
  const layer = el("select", {
    attrs: { "aria-label": "효과 층" },
    dataset: { testid: "event-page-pixel-fx-layer" },
    children: [
      el("option", { text: "캐릭터와 앞뒤 정렬", attrs: { value: "auto" } }),
      el("option", { text: "캐릭터 뒤(바닥)", attrs: { value: "back" } }),
      el("option", { text: "모두 위(날씨·안개)", attrs: { value: "front" } }),
      el("option", { text: "화면 전체(날씨·반딧불)", attrs: { value: "screen" } }),
    ],
  }) as HTMLSelectElement;
  layer.value = current?.layer ?? "auto";
  layer.disabled = !current;
  layer.addEventListener("change", () => {
    if (!current) return;
    const { layer: _old, ...rest } = current;
    updateEventPage(mapId, eventId, page.id, { pixelFx: layer.value === "auto" ? rest : { ...rest, layer: layer.value as "back" | "front" | "screen" } }, "상시 효과 층");
  });
  const clear = el("button", { class: "btn small", text: "떼기", attrs: { type: "button" }, dataset: { testid: "event-page-pixel-fx-clear" } });
  clear.hidden = !current;
  clear.addEventListener("click", () => updateEventPage(mapId, eventId, page.id, { pixelFx: undefined }, "상시 효과 떼기"));
  return el("div", {
    class: "event-page-pixel-fx",
    dataset: { testid: "event-page-pixel-fx" },
    children: [label, pick, layer, clear],
  });
}
