// src/editor/workshop/workshopArt.ts
/**
 * 공방 화면의 그림 조각(2026-10-22 「공방 UI 를 더 화려하게」): 생성기 카드 무대 · 공방 표장 · 애니메이션 위상 · 「다 그림」 드러남.
 * 무대 그림은 저장소에 있는 우리 도트만 쓴다(정수 배율, 번지지 않게):
 * - 물건: object-gen 견본 기물 셋(object-gen-sample.png 에서 뒷판을 떼어 냄)을 손 도트 실내 v5 칩셋(atlas-interior)의 판자벽·마루 위에 세운 그림.
 * - 캐릭터: 버들항 마당 + char-gen 상반신(char-gen-sample.png 와 같은 판) 위를 char-gen 칩 셋이 제자리 걸음(1·0·1·2)으로 걷는다.
 * - 지형: 아직 독립 검수를 통과한 tile-gen 견본이 없다 — 16px 모눈 「빈 작업대」로 둔다(다른 화풍 흉내 그림을 싣지 않는다).
 * 움직임은 transform·opacity·background-position 만, prefers-reduced-motion 이면 CSS 가 멈춘다.
 * 다시 그려도(작업 줄은 자주 다시 그린다) 걸음·반짝임이 처음부터 튀지 않게 위상을 시계에 맞춘다(animationPhase).
 */
import { el } from "@/util/dom";
import type { WorkshopGenerator } from "./generators";

/** 시계에 맞춘 음수 animation-delay — 요소를 새로 만들어도 같은 주기의 같은 자리에서 이어진다. */
export function animationPhase(periodMs: number, now: number = performance.now()): string {
  return `${-Math.round(now % periodMs)}ms`;
}

const SVG_NS = "http://www.w3.org/2000/svg";
/** 공방 표장 — 모루를 치는 망치와 불똥(코드 도트 16×16). 장식이라 읽지 않는다. */
const EMBLEM_ROWS = [
  "................",
  "..hhhhhh....s...",
  "..HHHHHHh.......",
  "..hhhhhh..S.....",
  ".....w.....s....",
  ".....w..........",
  ".....w....S.....",
  ".....w..........",
  ".....w..........",
  "..aaaaaaaaaaa...",
  "AAAAAAAAAAAAAA..",
  "..aaaaaaaaaa....",
  ".....dddd.......",
  ".....dddd.......",
  "...dddddddd.....",
  "..dddddddddd....",
];
const EMBLEM_COLORS: Readonly<Record<string, string>> = {
  h: "#4b5266", H: "#9aa6bf", w: "#9a6433", a: "#5b6378", A: "#8b95ad", d: "#3a4050", s: "#ffd36e", S: "#f09a3a",
};

export function workshopEmblem(size = 32): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("shape-rendering", "crispEdges");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.classList.add("workshop-emblem");
  EMBLEM_ROWS.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) {
      const color = EMBLEM_COLORS[row[x]!];
      if (!color) continue;
      const rect = document.createElementNS(SVG_NS, "rect");
      rect.setAttribute("x", String(x));
      rect.setAttribute("y", String(y));
      rect.setAttribute("width", "1");
      rect.setAttribute("height", "1");
      rect.setAttribute("fill", color);
      if (row[x] === "s" || row[x] === "S") rect.setAttribute("class", "workshop-emblem-spark");
      svg.append(rect);
    }
  });
  return svg;
}

const WALK_PERIOD_MS = 760;
const TWINKLE_PERIOD_MS = 3600;
/** 걷는 칩마다 박자를 어긋내는 몫(주기의 몇 분의 몇) */
const WALK_OFFSETS = [0, 0.5, 0.25] as const;

/**
 * 생성기 무대 — 카드 머리·생성기 창 머리에 같은 그림을 쓴다. 견본이 없는 생성기는 모눈 빈 작업대.
 * size: card = 왼쪽 막대 카드(정수 배율 그대로), hero = 생성기 창 머리(같은 배율, 가운데).
 */
export function generatorStage(generator: WorkshopGenerator, size: "card" | "hero" = "card"): HTMLElement {
  const sample = generator.sample;
  if (!sample) {
    return el("div", {
      class: `workshop-stage is-blank is-${size}`, dataset: { generator: generator.id },
      children: [el("span", { class: "workshop-stage-blank-text", text: "견본은 첫 결과가 나오면 올라와요" })],
    });
  }
  const scale = sample.scale ?? 2;
  const width = sample.width * scale, height = sample.height * scale;
  const walkers = sample.walkers;
  return el("div", {
    class: `workshop-stage is-${size}`, dataset: { generator: generator.id },
    children: [
      el("div", {
        class: "workshop-stage-scene", attrs: { style: `width:${width}px;height:${height}px` },
        children: [
          el("img", { attrs: { src: sample.src, alt: sample.alt, width: String(width), height: String(height), decoding: "async" } }),
          ...(walkers ? walkers.at.map(([x, y], index) => el("span", {
            class: "workshop-stage-walker", attrs: {
              "aria-hidden": "true",
              style: `left:${x * scale}px;top:${y * scale}px;width:${walkers.frame[0] * scale}px;height:${walkers.frame[1] * scale}px;`
                + `background-image:url(${walkers.src});background-size:${walkers.frame[0] * walkers.frames * scale}px auto;`
                + `--walk-row:${-index * walkers.frame[1] * scale}px;--walk-end:${-walkers.frame[0] * walkers.frames * scale}px;`
                // 셋이 같은 박자로 행진하지 않게 한 칸씩 어긋낸다
                + `animation-delay:${animationPhase(WALK_PERIOD_MS, performance.now() + WALK_OFFSETS[index % WALK_OFFSETS.length]! * WALK_PERIOD_MS)}`,
            },
          })) : []),
          ...(sample.twinkles ?? []).map(([x, y], index) => el("span", {
            class: "workshop-stage-twinkle", attrs: {
              "aria-hidden": "true",
              style: `left:${x * scale}px;top:${y * scale}px;animation-delay:${animationPhase(TWINKLE_PERIOD_MS, performance.now() + index * 1300)}`,
            },
          })),
        ],
      }),
      ...(sample.caption ? [el("span", { class: "left-workshop-art-caption", text: sample.caption })] : []),
    ],
  });
}

/**
 * 「다 그림」 드러남 — 처음 본 때 아직 그리던 것(그리는 중·줄 서는 중)이 고를 차례가 된 그 순간에만 한 번.
 * 열 때 이미 다 된 것은 드러내지 않는다. 화면을 다시 그려도 드러남이 처음부터 다시 돌지 않게 지난 시간만큼 음수 지연을 준다.
 */
const REVEAL_MS = 1400;
const pendingSeen = new Set<string>();
const readyAt = new Map<string, number>();

/** 드러남 중이면 animation-delay 값(음수 ms), 아니면 null. */
export function revealPhase(key: string, ready: boolean, now: number = performance.now()): string | null {
  if (!ready) {
    pendingSeen.add(key);
    readyAt.delete(key);
    return null;
  }
  let at = readyAt.get(key);
  if (at === undefined) {
    at = pendingSeen.has(key) ? now : -Infinity;
    readyAt.set(key, at);
    pendingSeen.delete(key);
  }
  const elapsed = now - at;
  return elapsed < REVEAL_MS ? `${-Math.round(elapsed)}ms` : null;
}

/** 드러남 표시를 붙인다(요소 class + 지연). */
export function markReveal(node: HTMLElement, phase: string | null): HTMLElement {
  if (phase === null) return node;
  node.classList.add("is-revealing");
  node.style.setProperty("--reveal-delay", phase);
  return node;
}

const GLINT_PERIOD_MS = 2600;
const SWEEP_PERIOD_MS = 4400;

/**
 * 대장간 진행 막대 — 도트 칸으로 끊긴 불씨 막대. value(0~1)가 없으면 끝을 모르는 진행(불씨 덩이가 오간다).
 * hot = 지금 그리는 중(빛이 지나간다). role=progressbar 와 이름은 부르는 쪽이 준 label.
 */
export function craftBar(options: { readonly value: number | null; readonly hot: boolean; readonly label: string; readonly max?: number; readonly now?: number }): HTMLElement {
  const { value, hot, label } = options;
  const max = options.max ?? 100;
  const percent = value === null ? null : Math.max(4, Math.min(100, Math.round(value * 100)));
  const now = options.now ?? performance.now();
  return el("div", {
    class: "craft-bar" + (hot ? " is-hot" : "") + (value === null ? " is-idle" : ""),
    attrs: {
      role: "progressbar", "aria-label": label, "aria-valuemin": "0", "aria-valuemax": String(max),
      ...(value === null ? {} : { "aria-valuenow": String(Math.round(value * max)) }),
      style: `--craft-phase:${animationPhase(value === null ? SWEEP_PERIOD_MS : GLINT_PERIOD_MS, now)}`,
    },
    children: [el("span", { class: "craft-bar-fill", attrs: percent === null ? {} : { style: `width:${percent}%` } })],
  });
}
