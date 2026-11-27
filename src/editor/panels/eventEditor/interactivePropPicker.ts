// 이벤트 편집기 showAnimation 에서 100종 실원본 상호작용 오브젝트(fx:prop:<id>)를
// 시대별·검색어로 골라 바로 선택하고 멀티프레임 미리보기를 재생하는 피커 컴포넌트.
import { propFxId } from "@/project/containerFx";
import {
  INTERACTIVE_PROP_CATEGORIES,
  INTERACTIVE_PROP_CATEGORY_LABELS,
  INTERACTIVE_PROP_ERAS,
  INTERACTIVE_PROP_ERA_LABELS,
  INTERACTIVE_PROP_GENRES,
  INTERACTIVE_PROP_GENRE_LABELS,
  INTERACTIVE_PROPS,
  interactivePropStripUrl,
  searchInteractiveProps,
  type InteractivePropCategory,
  type InteractivePropEntry,
  type InteractivePropEra,
  type InteractivePropGenre,
} from "@/project/interactiveProps";
import { el } from "@/util/dom";

/** 가로 PNG 스트립의 특정 프레임을 깔끔한 pixel-art 크기로 잘라 보여주는 DOM 박스. */
export function createInteractivePropStripPreview(
  prop: InteractivePropEntry,
  options: { readonly scale?: number; readonly reverse?: boolean; readonly animate?: boolean } = {},
): HTMLElement {
  const maxBox = options.scale ? Math.max(prop.frameWidth, prop.frameHeight) * options.scale : 64;
  const scale = options.scale ?? Math.max(1, Math.min(3, Math.floor(maxBox / Math.max(prop.frameWidth, prop.frameHeight))));
  const w = prop.frameWidth * scale;
  const h = prop.frameHeight * scale;
  const box = el("div", {
    class: "iprop-strip-preview",
    attrs: { "aria-hidden": "true" },
  });
  box.style.width = `${w}px`;
  box.style.height = `${h}px`;
  box.style.backgroundImage = `url("${interactivePropStripUrl(prop)}")`;
  box.style.backgroundRepeat = "no-repeat";
  box.style.backgroundSize = `${prop.frameWidth * prop.frames * scale}px ${h}px`;
  box.style.imageRendering = "pixelated";
  box.style.margin = "0 auto";

  const reverse = options.reverse === true;
  const setFrame = (idx: number) => {
    box.style.backgroundPosition = `${-idx * w}px 0px`;
  };
  setFrame(reverse ? prop.frames - 1 : 0);

  if (options.animate !== false && typeof window !== "undefined") {
    let step = 0;
    const seq: number[] = [];
    if (reverse) {
      for (let i = prop.frames - 1; i >= 0; i--) seq.push(i);
      seq.push(0, 0, 0);
    } else if (prop.playback === "loopAfterOpen") {
      for (let i = 0; i < prop.frames; i++) seq.push(i);
      const lf = prop.loopFromFrame ?? Math.max(1, prop.frames - 2);
      for (let k = 0; k < 6; k++) seq.push(lf + (k % Math.max(1, prop.frames - lf)));
      seq.push(0, 0);
    } else {
      seq.push(0, 0);
      for (let i = 0; i < prop.frames; i++) seq.push(i);
      seq.push(prop.frames - 1, prop.frames - 1, prop.frames - 1);
    }
    const timer = window.setInterval(() => {
      if (!box.isConnected) {
        window.clearInterval(timer);
        return;
      }
      step = (step + 1) % seq.length;
      setFrame(seq[step]!);
    }, Math.max(110, prop.frameMs));
  }
  return box;
}

export function interactivePropPickButton(options: {
  readonly testid: string;
  readonly currentAnimationId?: string;
  readonly onAnimationId: (animationId: string) => void;
}): HTMLElement {
  const host = el("div", { class: "iprop-picker-host" });
  let dialog: HTMLDialogElement | null = null;

  const openModal = () => {
    if (dialog) {
      dialog.remove();
      dialog = null;
    }
    let activeEra: InteractivePropEra | "all" = "all";
    let activeGenre: InteractivePropGenre | "all" = "all";
    let activeCategory: InteractivePropCategory | "all" = "all";
    let query = "";
    let mode: "open" | "close" = options.currentAnimationId?.endsWith(":close") ? "close" : "open";

    const dlg = el("dialog", {
      class: "iprop-picker-dialog",
      dataset: { testid: `${options.testid}-dialog` },
    }) as HTMLDialogElement;
    dlg.style.maxWidth = "760px";
    dlg.style.width = "92vw";
    dlg.style.maxHeight = "82vh";
    dlg.style.padding = "16px";
    dlg.style.borderRadius = "10px";
    dlg.style.border = "1px solid var(--border, #3c4252)";
    dlg.style.background = "var(--surface, #1d2029)";
    dlg.style.color = "var(--text, #eef2f8)";

    const search = el("input", {
      attrs: { type: "search", placeholder: "항아리, 옷장, 자판기, 화로, 에어록…", autocomplete: "off" },
      dataset: { testid: `${options.testid}-search` },
    }) as HTMLInputElement;
    search.style.flex = "1";
    search.style.padding = "6px 10px";
    search.style.borderRadius = "6px";
    search.style.border = "1px solid var(--border, #3c4252)";
    search.style.background = "var(--surface-2, #262a36)";
    search.style.color = "inherit";

    const genreSelect = el("select", {
      attrs: { "aria-label": "장르" },
      children: [
        el("option", { value: "all", text: "전체 장르" }),
        ...INTERACTIVE_PROP_GENRES.map((g) => el("option", { value: g, text: INTERACTIVE_PROP_GENRE_LABELS[g] })),
      ],
    }) as HTMLSelectElement;
    genreSelect.style.padding = "6px 8px";
    genreSelect.style.borderRadius = "6px";
    genreSelect.style.background = "var(--surface-2, #262a36)";
    genreSelect.style.color = "inherit";

    const catSelect = el("select", {
      attrs: { "aria-label": "카테고리" },
      children: [
        el("option", { value: "all", text: "전체 카테고리" }),
        ...INTERACTIVE_PROP_CATEGORIES.map((c) => el("option", { value: c, text: INTERACTIVE_PROP_CATEGORY_LABELS[c] })),
      ],
    }) as HTMLSelectElement;
    catSelect.style.padding = "6px 8px";
    catSelect.style.borderRadius = "6px";
    catSelect.style.background = "var(--surface-2, #262a36)";
    catSelect.style.color = "inherit";

    const modeSelect = el("select", {
      attrs: { "aria-label": "재생 방향" },
      children: [
        el("option", { value: "open", text: "열기 / 작동 / 파괴" }),
        el("option", { value: "close", text: "닫기 (역재생)" }),
      ],
    }) as HTMLSelectElement;
    modeSelect.value = mode;
    modeSelect.style.padding = "6px 8px";
    modeSelect.style.borderRadius = "6px";
    modeSelect.style.background = "var(--surface-2, #262a36)";
    modeSelect.style.color = "inherit";

    const tabs = el("div", { class: "iprop-picker-tabs" });
    tabs.style.display = "flex";
    tabs.style.flexWrap = "wrap";
    tabs.style.gap = "6px";
    tabs.style.margin = "10px 0";

    const grid = el("div", { class: "iprop-picker-grid" });
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "repeat(auto-fill, minmax(126px, 1fr))";
    grid.style.gap = "8px";
    grid.style.maxHeight = "52vh";
    grid.style.overflowY = "auto";
    grid.style.padding = "4px 2px";

    const countEl = el("span", { text: "" });
    countEl.style.fontSize = "12px";
    countEl.style.opacity = "0.75";

    const renderGrid = () => {
      const list = searchInteractiveProps({
        query,
        era: activeEra === "all" ? undefined : activeEra,
        genre: activeGenre === "all" ? undefined : activeGenre,
        category: activeCategory === "all" ? undefined : activeCategory,
      });
      countEl.textContent = `${list.length} / ${INTERACTIVE_PROPS.length}종`;
      grid.replaceChildren(
        ...list.map((prop) => {
          const fxId = propFxId(prop.id, mode);
          const selected = options.currentAnimationId === fxId;
          const card = el("button", {
            attrs: { type: "button", title: `${prop.name} (${prop.id})` },
            dataset: { testid: `${options.testid}-card-${prop.id}` },
            children: [
              createInteractivePropStripPreview(prop, { animate: false, reverse: mode === "close" }),
              el("span", { text: prop.name }),
              el("small", { text: `${INTERACTIVE_PROP_ERA_LABELS[prop.era]} · ${prop.playback}` }),
            ],
            on: {
              click: () => {
                options.onAnimationId(fxId);
                dlg.close();
                dlg.remove();
                dialog = null;
              },
            },
          });
          card.style.display = "flex";
          card.style.flexDirection = "column";
          card.style.alignItems = "center";
          card.style.gap = "4px";
          card.style.padding = "8px 6px";
          card.style.borderRadius = "8px";
          card.style.border = selected ? "2px solid var(--accent, #6ea8fe)" : "1px solid var(--border, #3c4252)";
          card.style.background = "var(--surface-2, #282c3a)";
          card.style.color = "inherit";
          card.style.cursor = "pointer";
          card.style.fontSize = "12px";
          return card;
        }),
      );
    };

    const renderTabs = () => {
      const entries: Array<readonly [InteractivePropEra | "all", string]> = [
        ["all", "전체"],
        ...INTERACTIVE_PROP_ERAS.map((e) => [e, INTERACTIVE_PROP_ERA_LABELS[e]] as const),
      ];
      tabs.replaceChildren(
        ...entries.map(([eraKey, label]) => {
          const btn = el("button", {
            class: "btn small",
            attrs: { type: "button", "aria-pressed": String(activeEra === eraKey) },
            text: label,
            on: {
              click: () => {
                activeEra = eraKey;
                renderTabs();
                renderGrid();
              },
            },
          });
          if (activeEra === eraKey) {
            btn.style.background = "var(--accent, #4e7cf5)";
            btn.style.color = "#fff";
          }
          return btn;
        }),
      );
    };

    search.addEventListener("input", () => {
      query = search.value;
      renderGrid();
    });
    genreSelect.addEventListener("change", () => {
      activeGenre = genreSelect.value as typeof activeGenre;
      renderGrid();
    });
    catSelect.addEventListener("change", () => {
      activeCategory = catSelect.value as typeof activeCategory;
      renderGrid();
    });
    modeSelect.addEventListener("change", () => {
      mode = modeSelect.value === "close" ? "close" : "open";
      renderGrid();
    });

    const header = el("div", {
      children: [
        el("strong", { text: `상호작용 오브젝트 연출 (${INTERACTIVE_PROPS.length}종 실원본)` }),
        countEl,
        el("button", {
          class: "btn small",
          attrs: { type: "button" },
          text: "닫기",
          on: { click: () => { dlg.close(); dlg.remove(); dialog = null; } },
        }),
      ],
    });
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.justifyContent = "space-between";
    header.style.gap = "8px";
    header.style.marginBottom = "10px";

    const bar = el("div", { children: [search, genreSelect, catSelect, modeSelect] });
    bar.style.display = "flex";
    bar.style.flexWrap = "wrap";
    bar.style.gap = "8px";

    dlg.append(header, bar, tabs, grid);
    document.body.append(dlg);
    dialog = dlg;
    renderTabs();
    renderGrid();
    if (typeof dlg.showModal === "function") dlg.showModal();
  };

  const trigger = el("button", {
    class: "btn small",
    attrs: { type: "button", title: "100종 상호작용 오브젝트(항아리 파괴·옷장·자판기·화로 등) 연출 고르기" },
    text: `오브젝트 연출 (${INTERACTIVE_PROPS.length}종)`,
    dataset: { testid: options.testid },
    on: { click: openModal },
  });
  host.append(trigger);
  return host;
}
