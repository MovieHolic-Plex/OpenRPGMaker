// 타이틀 오프닝 효과 편집기 — 무대 위 끌기 손잡이, 효과 목록, 선택한 효과의 값 조절, 프리셋 칩.
// databaseSystemView 의 타이틀 작업대가 조립한다. 저장은 모두 host.update(= updateTitleScreen) 한 곳으로 간다.

import {
  MAX_TITLE_EFFECTS,
  TITLE_EFFECT_DEFAULT_COLORS,
  TITLE_EFFECT_GEOMETRY,
  TITLE_EFFECT_KINDS,
  TITLE_EFFECT_LABELS,
  TITLE_OPENING_PRESETS,
  defaultTitleEffect,
} from "@/project/titleEffects";
import type { TitleEffect, TitleEffectKind, TitleEffectPoint, TitleScreenSettings } from "@/project/types";
import { el } from "@/util/dom";

export type TitleOpeningHost = {
  /** 설정을 바꾼다. key 가 있으면 연속 입력(끌기·슬라이더)으로 보고 되돌리기 한 칸으로 합친다. */
  update(mutator: (settings: TitleScreenSettings) => void, key?: string): void;
  /** 무대의 효과 canvas 만 새 값으로 갱신한다(무대 재생성 없음). */
  liveEffects(): void;
  /** 편집 패널 전체를 다시 그린다(목록 추가·삭제처럼 구조가 바뀔 때). */
  rerender(): void;
  /** 지금 저장된 설정. */
  current(): TitleScreenSettings;
  /** 깊이 시차 효과의 깊이 지도를 키아트에서 AI 로 만든다. 없으면 버튼을 숨긴다. */
  generateDepth?(index: number, status: HTMLElement): Promise<void>;
};

// ─────────────────────────────────────────────────────────────────────────────
// 선택 상태 — 패널을 다시 그려도 유지된다(모듈 수준). 목록·무대 손잡이·값 조절이 같은 선택을 본다.
// ─────────────────────────────────────────────────────────────────────────────

let selectedEffectIndex = 0;
const selectionListeners = new Set<() => void>();

export function selectedTitleEffect(): number {
  return selectedEffectIndex;
}

export function selectTitleEffect(index: number): void {
  if (index === selectedEffectIndex) return;
  selectedEffectIndex = index;
  for (const listener of [...selectionListeners]) listener();
}

function onSelectionChange(node: Element, listener: () => void): void {
  // 노드가 문서에서 빠지면 다음 알림에서 스스로 떨어진다 — 패널 재생성마다 쌓이지 않게.
  const wrapped = (): void => {
    if (!node.isConnected) {
      selectionListeners.delete(wrapped);
      return;
    }
    listener();
  };
  selectionListeners.add(wrapped);
}

// ─────────────────────────────────────────────────────────────────────────────
// 그림 좌표 ↔ 무대 좌표. 효과 좌표는 그림 기준 0..1 이고, 무대는 배경 맞춤(cover/contain/stretch)으로 그림을 싣는다.
// 셰이더(titleEffects/shader.ts)의 맞춤 식과 같은 식의 역을 쓴다.
// ─────────────────────────────────────────────────────────────────────────────

const imageSizeCache = new Map<string, { w: number; h: number } | "loading">();

function imageSize(url: string, onLoad: () => void): { w: number; h: number } | null {
  const cached = imageSizeCache.get(url);
  if (cached && cached !== "loading") return cached;
  if (!cached) {
    imageSizeCache.set(url, "loading");
    const image = new Image();
    image.onload = () => {
      imageSizeCache.set(url, { w: image.naturalWidth || 1, h: image.naturalHeight || 1 });
      onLoad();
    };
    image.onerror = () => imageSizeCache.delete(url);
    image.src = url;
  }
  return null;
}

type FitScale = { x: number; y: number };

function fitScale(fit: string, canvasAR: number, imageAR: number): FitScale {
  if (fit === "cover") return canvasAR > imageAR ? { x: 1, y: imageAR / canvasAR } : { x: canvasAR / imageAR, y: 1 };
  if (fit === "contain") return canvasAR > imageAR ? { x: canvasAR / imageAR, y: 1 } : { x: 1, y: imageAR / canvasAR };
  return { x: 1, y: 1 };
}

function imageToStage(point: TitleEffectPoint, s: FitScale): TitleEffectPoint {
  return [(point[0] - 0.5) / s.x + 0.5, (point[1] - 0.5) / s.y + 0.5];
}

function stageToImage(point: TitleEffectPoint, s: FitScale): TitleEffectPoint {
  return [(point[0] - 0.5) * s.x + 0.5, (point[1] - 0.5) * s.y + 0.5];
}

function clampPoint(point: TitleEffectPoint, min: number, max: number): TitleEffectPoint {
  const round = (value: number): number => Math.round(Math.max(min, Math.min(max, value)) * 1000) / 1000;
  return [round(point[0]), round(point[1])];
}

// ─────────────────────────────────────────────────────────────────────────────
// 무대 손잡이 — 선택한 효과의 기하(광원·방향·선·영역·중심)를 끌어 옮긴다.
// ─────────────────────────────────────────────────────────────────────────────

const SVG_NS = "http://www.w3.org/2000/svg";

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string>): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}

type HandleRole = "source" | "toward" | "line0" | "line1" | `region${number}` | "body";

export function mountTitleEffectOverlay(stage: HTMLElement, host: TitleOpeningHost, imageUrl: string | undefined): void {
  const overlay = svg("svg", {
    class: "db-title-effect-overlay",
    viewBox: "0 0 100 100",
    preserveAspectRatio: "none",
    "data-testid": "db-title-effect-overlay",
  });
  stage.append(overlay);

  const scale = (): FitScale => {
    const settings = host.current();
    const fit = settings.backgroundFit ?? "stretch";
    if (fit === "stretch" || !imageUrl) return { x: 1, y: 1 };
    const size = imageSize(imageUrl, draw);
    const rect = stage.getBoundingClientRect();
    if (!size || rect.width <= 0 || rect.height <= 0) return { x: 1, y: 1 };
    return fitScale(fit, rect.width / rect.height, size.w / size.h);
  };

  function draw(): void {
    if (!overlay.isConnected && overlay.parentNode) return;
    overlay.replaceChildren();
    const effects = host.current().effects ?? [];
    const index = selectedEffectIndex;
    const effect = effects[index];
    if (!effect || effect.enabled === false) {
      overlay.dataset.effectIndex = "";
      return;
    }
    overlay.dataset.effectIndex = String(index);
    const s = scale();
    const toSvg = (point: TitleEffectPoint): [number, number] => {
      const staged = imageToStage(point, s);
      return [staged[0] * 100, staged[1] * 100];
    };
    const geometry = TITLE_EFFECT_GEOMETRY[effect.kind];
    const color = effect.color ?? TITLE_EFFECT_DEFAULT_COLORS[effect.kind] ?? "#ffe7a8";
    if (geometry === "ray" && effect.source && effect.toward) {
      const [ax, ay] = toSvg(effect.source);
      const [bx, by] = toSvg(effect.toward);
      overlay.append(svg("line", { class: "db-title-effect-guide", x1: `${ax}`, y1: `${ay}`, x2: `${bx}`, y2: `${by}` }));
      handle("source", effect.source, "광원", color);
      handle("toward", effect.toward, "방향", color);
    } else if (geometry === "line" && effect.line) {
      const [ax, ay] = toSvg(effect.line[0]);
      const [bx, by] = toSvg(effect.line[1]);
      overlay.append(svg("line", { class: "db-title-effect-guide", x1: `${ax}`, y1: `${ay}`, x2: `${bx}`, y2: `${by}` }));
      handle("line0", effect.line[0], "시작", color);
      handle("line1", effect.line[1], "끝", color);
    } else if (geometry === "region" && effect.region?.length) {
      const points = effect.region.map((point) => toSvg(point).join(",")).join(" ");
      const body = svg("polygon", { class: "db-title-effect-region", points, "data-handle": "body" });
      overlay.append(body);
      bindDrag(body, "body");
      effect.region.forEach((point, i) => handle(`region${i}`, point, `꼭짓점 ${i + 1}`, color));
    } else if (geometry === "point" && effect.source) {
      handle("source", effect.source, "중심", color);
    }

    function handle(role: HandleRole, point: TitleEffectPoint, label: string, fill: string): void {
      // 광원이 화면 밖(예: 위쪽 -0.05)에 있어도 잡을 수 있게 손잡이만 가장자리에 붙여 그린다.
      const [rawX, rawY] = toSvg(point);
      const x = Math.max(2.5, Math.min(97.5, rawX));
      const y = Math.max(3.4, Math.min(96.6, rawY));
      const outside = x !== rawX || y !== rawY;
      // viewBox 가 늘어나므로 원 대신 화면 크기가 일정한 HTML 손잡이를 쓴다.
      const group = svg("g", { class: `db-title-effect-handle${outside ? " outside" : ""}`, "data-handle": role });
      const hit = svg("rect", { x: `${x - 2.4}`, y: `${y - 3.2}`, width: "4.8", height: "6.4", class: "db-title-effect-hit" });
      const dot = svg("rect", { x: `${x - 1.3}`, y: `${y - 1.73}`, width: "2.6", height: "3.46", class: "db-title-effect-dot", fill });
      const title = svg("title", {});
      title.textContent = `${TITLE_EFFECT_LABELS[effect!.kind]} · ${label}${outside ? " (화면 밖)" : ""}`;
      group.append(title, hit, dot);
      overlay.append(group);
      bindDrag(group, role);
    }
  }

  function bindDrag(target: SVGElement, role: HandleRole): void {
    target.addEventListener("pointerdown", (down) => {
      if (down.button !== 0) return;
      down.preventDefault();
      down.stopPropagation();
      const index = selectedEffectIndex;
      const rect = stage.getBoundingClientRect();
      const s = scale();
      const toImage = (event: PointerEvent): TitleEffectPoint =>
        stageToImage([(event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height], s);
      const startPoint = toImage(down);
      const startRegion = host.current().effects?.[index]?.region?.map((p) => [p[0], p[1]] as TitleEffectPoint);
      overlay.classList.add("dragging");
      const key = `system:title-screen:effect-${index}-geom`;
      const move = (event: PointerEvent): void => {
        const point = toImage(event);
        host.update((settings) => {
          const effect = settings.effects?.[index];
          if (!effect) return;
          if (role === "source") effect.source = clampPoint(point, -0.5, 1.5);
          else if (role === "toward") effect.toward = clampPoint(point, -0.2, 1.2);
          else if (role === "line0" || role === "line1") {
            const line = effect.line ?? [[0.4, 0.4], [0.6, 0.6]];
            line[role === "line0" ? 0 : 1] = clampPoint(point, -0.2, 1.2);
            effect.line = line;
          } else if (role === "body" && startRegion) {
            const dx = point[0] - startPoint[0];
            const dy = point[1] - startPoint[1];
            effect.region = startRegion.map((p) => clampPoint([p[0] + dx, p[1] + dy], -0.2, 1.2));
          } else if (role.startsWith("region") && effect.region) {
            const vertex = Number(role.slice("region".length));
            if (effect.region[vertex]) effect.region[vertex] = clampPoint(point, -0.2, 1.2);
          }
        }, key);
        host.liveEffects();
        draw();
      };
      // 끄는 동안 draw() 가 손잡이를 새로 만들므로 이동·놓기는 창에서 듣는다.
      const up = (): void => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
        overlay.classList.remove("dragging");
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    });
  }

  onSelectionChange(overlay, draw);
  // 무대 크기가 정해진 뒤(레이아웃 후) 그림 비율이 반영되게 한 번 더 그린다.
  draw();
  requestAnimationFrame(draw);
}

// ─────────────────────────────────────────────────────────────────────────────
// 효과 목록 + 선택한 효과의 값 조절
// ─────────────────────────────────────────────────────────────────────────────

function kindHint(kind: TitleEffectKind): string {
  if (kind === "parallax") {
    return "깊이 지도에 따라 가까운 것은 크게, 먼 것은 작게 움직여 그림이 입체로 흘러갑니다. 지도가 없으면 아래쪽을 가깝게 봅니다.";
  }
  switch (TITLE_EFFECT_GEOMETRY[kind]) {
    case "ray":
      return "무대에서 광원과 방향 손잡이를 끌어 옮깁니다.";
    case "line":
      return "무대에서 선의 두 끝을 끌어 칼날·창끝에 맞춥니다.";
    case "region":
      return "무대에서 꼭짓점을 끌거나 영역 안쪽을 끌어 통째로 옮깁니다.";
    case "point":
      return "무대에서 중심 손잡이를 끌어 옮깁니다.";
    default:
      return "그림 전체가 아주 천천히 숨 쉬듯 움직입니다. 옮길 손잡이가 없습니다.";
  }
}

function liveSlider(
  label: string,
  testid: string,
  value: number,
  range: { min: number; max: number; step: number },
  format: (value: number) => string,
  onInput: (value: number) => void,
): HTMLElement {
  const input = el("input", {
    attrs: { type: "range", min: String(range.min), max: String(range.max), step: String(range.step) },
    dataset: { testid },
  }) as HTMLInputElement;
  input.value = String(value);
  const valueLabel = el("span", { class: "db-title-density-value", text: format(value) });
  // 끄는 동안 바로 반영한다. 되돌리기는 호출자가 key 로 한 칸에 합친다.
  input.addEventListener("input", () => {
    const next = Number(input.value);
    valueLabel.textContent = format(next);
    onInput(next);
  });
  return el("label", { class: "db-field db-title-fx-slider", children: [el("span", { text: label }), input, valueLabel] });
}

const percent = (value: number): string => `${Math.round(value * 100)}%`;

function effectInspector(effect: TitleEffect, index: number, host: TitleOpeningHost): HTMLElement {
  const geometry = TITLE_EFFECT_GEOMETRY[effect.kind];
  const key = (name: string): string => `system:title-screen:effect-${index}-${name}`;
  const set = (name: string, apply: (target: TitleEffect) => void): void => {
    host.update((settings) => {
      const target = settings.effects?.[index];
      if (target) apply(target);
    }, key(name));
    host.liveEffects();
  };
  const children: HTMLElement[] = [
    el("p", { class: "db-title-fx-inspector-hint", text: kindHint(effect.kind) }),
    liveSlider("세기", `db-title-opening-effect-${index}-intensity`, effect.intensity ?? 1, { min: 0, max: 2, step: 0.05 }, percent, (value) =>
      set("intensity", (target) => {
        target.intensity = value;
      })),
    liveSlider("속도", `db-title-opening-effect-${index}-speed`, effect.speed ?? 1, { min: 0, max: 4, step: 0.05 }, percent, (value) =>
      set("speed", (target) => {
        target.speed = value;
      })),
  ];
  if (geometry === "ray" || geometry === "point") {
    children.push(liveSlider("퍼짐", `db-title-opening-effect-${index}-spread`, effect.spread ?? 0.25, { min: 0.02, max: 1, step: 0.01 }, percent, (value) =>
      set("spread", (target) => {
        target.spread = value;
      })));
  }
  if (effect.kind === "motes") {
    children.push(liveSlider("먼지 수", `db-title-opening-effect-${index}-count`, effect.count ?? 40, { min: 0, max: 96, step: 1 }, (v) => `${v}개`, (value) =>
      set("count", (target) => {
        target.count = Math.round(value);
      })));
  }
  if (effect.kind === "glint") {
    children.push(liveSlider("반짝 간격", `db-title-opening-effect-${index}-period`, effect.periodSec ?? 6, { min: 1, max: 60, step: 0.5 }, (v) => `${v}초`, (value) =>
      set("period", (target) => {
        target.periodSec = value;
      })));
  }
  if (effect.kind === "parallax") children.push(depthMapControls(effect, index, host));
  // 카메라 호흡·깊이 시차는 그림 자체를 움직일 뿐 색을 쓰지 않는다.
  const defaultColor = geometry === "none" ? undefined : TITLE_EFFECT_DEFAULT_COLORS[effect.kind];
  if (defaultColor) {
    const colorInput = el("input", {
      attrs: { type: "color" },
      value: effect.color ?? defaultColor,
      dataset: { testid: `db-title-opening-effect-${index}-color` },
    }) as HTMLInputElement;
    colorInput.addEventListener("input", () => set("color", (target) => {
      target.color = colorInput.value;
    }));
    const reset = el("button", {
      class: "btn small ghost",
      text: "기본색",
      attrs: { type: "button" },
      on: {
        click: () => {
          colorInput.value = defaultColor;
          host.update((settings) => {
            const target = settings.effects?.[index];
            if (target) delete target.color;
          });
          host.liveEffects();
        },
      },
    });
    // label 로 감싸면 「기본색」 단추를 눌러도 색 선택기가 열린다 — div 로 둔다.
    children.push(el("div", { class: "db-title-fx-color", children: [el("span", { text: "색" }), colorInput, reset] }));
  }
  return el("div", {
    class: "db-title-fx-inspector",
    dataset: { testid: "db-title-opening-inspector", effectKind: effect.kind },
    children,
  });
}

/** 깊이 시차의 깊이 지도: 상태 + AI 로 만들기 + 기본 기울기로 되돌리기. */
function depthMapControls(effect: TitleEffect, index: number, host: TitleOpeningHost): HTMLElement {
  const hasDepth = Boolean(effect.depthResourceId);
  const status = el("p", {
    class: "db-title-fx-depth-status",
    dataset: { testid: `db-title-opening-effect-${index}-depth-status` },
    text: hasDepth ? "깊이 지도를 씁니다." : "깊이 지도 없음 — 아래쪽을 가깝게 보는 기본 기울기로 움직입니다.",
  });
  const buttons: HTMLElement[] = [];
  if (host.generateDepth) {
    const generate = el("button", {
      class: "btn small",
      text: hasDepth ? "깊이 지도 다시 만들기" : "키아트로 깊이 지도 만들기",
      attrs: { type: "button" },
      dataset: { testid: `db-title-opening-effect-${index}-depth-generate` },
    }) as HTMLButtonElement;
    generate.addEventListener("click", () => {
      generate.disabled = true;
      void host.generateDepth?.(index, status).finally(() => {
        generate.disabled = false;
      });
    });
    buttons.push(generate);
  }
  if (hasDepth) {
    buttons.push(el("button", {
      class: "btn small ghost",
      text: "기본 기울기로",
      attrs: { type: "button" },
      dataset: { testid: `db-title-opening-effect-${index}-depth-clear` },
      on: {
        click: () => {
          host.update((settings) => {
            const target = settings.effects?.[index];
            if (target) delete target.depthResourceId;
          });
          host.rerender();
        },
      },
    }));
  }
  return el("div", { class: "db-title-fx-depth", children: [el("span", { text: "깊이 지도" }), status, el("div", { class: "db-title-fx-depth-actions", children: buttons })] });
}

/** 켜진 효과 목록 + 선택한 효과의 값 조절 + 효과 추가. */
export function titleOpeningEffectsEditor(titleScreen: TitleScreenSettings, host: TitleOpeningHost): HTMLElement {
  const effects = titleScreen.effects ?? [];
  if (selectedEffectIndex >= effects.length) selectedEffectIndex = Math.max(0, effects.length - 1);

  const rows = effects.map((effect, index) => {
    const toggle = el("input", {
      attrs: { type: "checkbox", "aria-label": `${TITLE_EFFECT_LABELS[effect.kind]} 켜기` },
      dataset: { testid: `db-title-opening-effect-${index}-enabled` },
    }) as HTMLInputElement;
    toggle.checked = effect.enabled !== false;
    toggle.addEventListener("click", (event) => event.stopPropagation());
    toggle.addEventListener("change", () => {
      host.update((settings) => {
        const target = settings.effects?.[index];
        if (!target) return;
        if (toggle.checked) delete target.enabled;
        else target.enabled = false;
      });
      host.rerender();
    });
    const swatch = el("span", { class: "db-title-fx-swatch" });
    const color = effect.color ?? TITLE_EFFECT_DEFAULT_COLORS[effect.kind];
    if (color) swatch.style.background = color;
    else swatch.classList.add("none");
    const remove = el("button", {
      class: "btn small ghost db-title-fx-remove",
      text: "삭제",
      attrs: { type: "button", "aria-label": `${TITLE_EFFECT_LABELS[effect.kind]} 삭제` },
      dataset: { testid: `db-title-opening-effect-${index}-remove` },
      on: {
        click: (event) => {
          event.stopPropagation();
          host.update((settings) => {
            const next = (settings.effects ?? []).filter((_, i) => i !== index);
            if (next.length) settings.effects = next;
            else delete settings.effects;
          });
          if (selectedEffectIndex >= index && selectedEffectIndex > 0) selectedEffectIndex -= 1;
          host.rerender();
        },
      },
    });
    const row = el("div", {
      class: "db-title-opening-effect-row",
      attrs: { role: "button", tabindex: "0", "aria-pressed": String(index === selectedEffectIndex) },
      dataset: { testid: `db-title-opening-effect-${index}`, effectKind: effect.kind },
      children: [toggle, swatch, el("span", { class: "db-title-fx-name", text: TITLE_EFFECT_LABELS[effect.kind] }), remove],
    });
    if (effect.enabled === false) row.classList.add("off");
    if (index === selectedEffectIndex) row.classList.add("selected");
    const choose = (): void => {
      if (selectedEffectIndex === index) return;
      selectTitleEffect(index);
      host.rerender();
    };
    row.addEventListener("click", choose);
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        choose();
      }
    });
    return row;
  });

  const kindSelect = el("select", {
    dataset: { testid: "db-title-opening-add-kind" },
    attrs: { "aria-label": "추가할 효과" },
    children: TITLE_EFFECT_KINDS.map((kind) => el("option", { text: TITLE_EFFECT_LABELS[kind], attrs: { value: kind } })),
  }) as HTMLSelectElement;
  const full = effects.length >= MAX_TITLE_EFFECTS;
  const add = el("button", {
    class: "btn small",
    text: "효과 추가",
    attrs: { type: "button", ...(full ? { disabled: "true", title: `효과는 ${MAX_TITLE_EFFECTS}개까지 둘 수 있습니다.` } : {}) },
    dataset: { testid: "db-title-opening-add" },
    on: {
      click: () => {
        const kind = kindSelect.value as TitleEffectKind;
        let added = -1;
        host.update((settings) => {
          const next = [...(settings.effects ?? [])];
          if (next.length >= MAX_TITLE_EFFECTS) return;
          next.push(defaultTitleEffect(kind));
          settings.effects = next;
          added = next.length - 1;
        });
        if (added >= 0) selectedEffectIndex = added;
        host.rerender();
      },
    },
  });
  const clear = effects.length
    ? el("button", {
        class: "btn small ghost",
        text: "모두 지우기",
        attrs: { type: "button" },
        dataset: { testid: "db-title-opening-effects-clear" },
        on: {
          click: () => {
            host.update((settings) => {
              delete settings.effects;
            });
            selectedEffectIndex = 0;
            host.rerender();
          },
        },
      })
    : null;

  const selected = effects[selectedEffectIndex];
  return el("div", {
    class: "db-title-opening-effects",
    dataset: { testid: "db-title-opening-effects" },
    children: [
      el("div", {
        class: "db-title-fx-list",
        children: rows.length ? rows : [el("p", { class: "db-system-help", text: "효과가 없습니다. 아래에서 추가하거나 위의 프리셋을 적용하세요." })],
      }),
      selected ? effectInspector(selected, selectedEffectIndex, host) : el("span"),
      el("div", { class: "db-title-fx-add", children: [kindSelect, add, ...(clear ? [clear] : [])] }),
    ],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 프리셋 칩 — 드롭다운 대신 분위기 색 점이 달린 칩. 「자유」는 프리셋 없이 장면 설명만으로 만든다.
// ─────────────────────────────────────────────────────────────────────────────

export const TITLE_OPENING_FREE_PRESET = "free";

export function titleOpeningPresetChips(selected: string, onSelect: (presetId: string) => void): HTMLElement {
  const chips = [
    ...TITLE_OPENING_PRESETS.map((preset) => ({ id: preset.id, label: preset.label, accent: preset.accent as string | undefined })),
    { id: TITLE_OPENING_FREE_PRESET, label: "자유", accent: undefined },
  ];
  const group = el("div", {
    class: "db-title-preset-chips",
    attrs: { role: "radiogroup", "aria-label": "오프닝 분위기" },
    dataset: { testid: "db-title-opening-preset-chips" },
  });
  const buttons = chips.map((chip) => {
    const dot = el("span", { class: "db-title-preset-dot" });
    if (chip.accent) dot.style.background = chip.accent;
    else dot.classList.add("free");
    const button = el("button", {
      class: "db-title-preset-chip",
      attrs: { type: "button", role: "radio", "aria-checked": String(chip.id === selected) },
      dataset: { testid: `db-title-opening-preset-chip-${chip.id}`, presetId: chip.id },
      children: [dot, el("span", { text: chip.label })],
    });
    button.addEventListener("click", () => {
      for (const other of buttons) other.setAttribute("aria-checked", String(other === button));
      onSelect(chip.id);
    });
    return button;
  });
  group.append(...buttons);
  return group;
}
