// benchmark/town/evidence.ts
// 증거 시트 — 모델이 실제로 깐 타일을 그림으로 굽는다.
//
// 왜 필요한가: 이 벤치마크의 숫자는 전부 0..1 이고, 감독이 검수해야 하는 것은
// "그래서 그림이 어떻게 나왔는가"다. 6번(지붕 대각)·8번(울타리 끝)·9번(마을)은
// 특히 숫자가 높아도 그림이 엉망일 수 있는 문항이라, 자동 점수만 보고 넘기면
// 채점기의 허점을 감독이 잡을 기회가 사라진다.
//
// 파일 IO 는 하지 않는다(src/ 는 브라우저 번들 대상이다) — PNG 바이트와 HTML
// 문자열만 돌려주고, 디스크에 쓰는 일은 CLI 가 한다.

import { renderTileGridPng } from "./inputImages";
import { EMPTY_CELL, TOWN_AXIS_ORDER, TOWN_AXIS_TITLE, type TownAnswer, type TownRunRecord } from "./types";
import { buildTownGroundTruth } from "./groundTruth";
import { TOWN_TASKS } from "./tasks";
import { flatten } from "./gridWalk";

export interface EvidenceShot {
  /** 파일명(확장자 포함). HTML 이 같은 이름으로 참조한다. */
  readonly name: string;
  readonly png: Uint8Array;
}

export interface TownEvidence {
  readonly shots: readonly EvidenceShot[];
  readonly html: string;
}

const GRID_LAYER: Readonly<Record<string, "lower" | "upper">> = Object.freeze({
  roadGrid: "lower",
  doorGrid: "lower",
  fenceGrid: "upper",
});

function slug(text: string): string {
  return text.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

function emptyLayer(size: number): number[] {
  return new Array<number>(size).fill(EMPTY_CELL);
}

/**
 * 답변을 두 레이어로 펼친다. 문·울타리 과제는 "바꾼 칸만" 답하므로 바탕(이미 지어진
 * 집)을 아래에 깔아야 감독이 완성된 모습을 본다 — 채점기도 같은 합성으로 본다.
 */
function layersOf(
  answer: TownAnswer,
  shape: { readonly width: number; readonly height: number },
  key: string,
  base: { readonly lower: readonly number[]; readonly upper: readonly number[] },
): { lower: number[]; upper: number[] } | null {
  const merge = (bottom: readonly number[], top: readonly number[]): number[] =>
    bottom.map((tile, index) => {
      const above = top[index] ?? EMPTY_CELL;
      return above === EMPTY_CELL ? tile : above;
    });

  if ("lower" in answer) {
    const lower = flatten(answer.lower);
    const upper = flatten(answer.upper);
    if (lower.width !== shape.width || lower.height !== shape.height) return null;
    return { lower: merge(base.lower, lower.cells), upper: merge(base.upper, upper.cells) };
  }
  if ("grid" in answer) {
    const view = flatten(answer.grid);
    if (view.width !== shape.width || view.height !== shape.height) return null;
    const layer = GRID_LAYER[key] ?? "lower";
    return layer === "lower"
      ? { lower: merge(base.lower, view.cells), upper: [...base.upper] }
      : { lower: [...base.lower], upper: merge(base.upper, view.cells) };
  }
  return null;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function axisTable(records: readonly TownRunRecord[]): string {
  const head = ["모델", "종합", ...TOWN_AXIS_ORDER.map((axis, index) => `${index + 1}. ${TOWN_AXIS_TITLE[axis]}`)]
    .map((label) => `<th>${escapeHtml(label)}</th>`)
    .join("");
  const rows = [...records]
    .sort((a, b) => b.overall - a.overall)
    .map((record) => {
      const cells = TOWN_AXIS_ORDER.map((axis) => {
        const value = record.axisScores[axis];
        const text = value === null ? "—" : value.toFixed(3);
        const weak = value !== null && value < 0.7 ? ' class="weak"' : "";
        return `<td${weak}>${text}</td>`;
      }).join("");
      return `<tr><th>${escapeHtml(record.model)}</th><td><b>${record.overall.toFixed(3)}</b></td>${cells}</tr>`;
    })
    .join("");
  return `<table class="axes"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
}

/**
 * 정본 1장 + 모델마다 태스크별 첫 채점 성공 시도 1장을 굽는다. 반복 3회를 전부
 * 구우면 사람이 못 본다 — 흔들림은 2번 축 숫자로 읽고, 그림은 대표 1장만 본다.
 */
export async function buildTownEvidence(records: readonly TownRunRecord[]): Promise<TownEvidence> {
  const groundTruth = buildTownGroundTruth();
  const shots: EvidenceShot[] = [];
  const sections: string[] = [];

  // 오토타일 정본은 배치 참조가 아니라 셀 목록이므로 여기서 그리드로 펼친다.
  const autotileLower = emptyLayer(groundTruth.autotile.width * groundTruth.autotile.height);
  for (const cell of groundTruth.autotile.cells) {
    autotileLower[cell.y * groundTruth.autotile.width + cell.x] = cell.tile;
  }

  for (const task of TOWN_TASKS) {
    if (task.kind === "tileSet") continue; // 프로브는 그림으로 볼 것이 없다
    const shape = task.placement
      ? groundTruth.placements[task.placement]
      : { width: groundTruth.autotile.width, height: groundTruth.autotile.height };
    const base = task.placement
      ? { lower: groundTruth.placements[task.placement].baseLower, upper: groundTruth.placements[task.placement].baseUpper }
      : { lower: emptyLayer(shape.width * shape.height), upper: emptyLayer(shape.width * shape.height) };
    const reference = task.placement
      ? {
          lower: groundTruth.placements[task.placement].lower,
          upper: groundTruth.placements[task.placement].upper,
        }
      : { lower: autotileLower, upper: emptyLayer(shape.width * shape.height) };

    const referenceName = `reference-${slug(task.id)}.png`;
    shots.push({
      name: referenceName,
      png: await renderTileGridPng({
        width: shape.width,
        height: shape.height,
        lower: reference.lower.map((tile, index) => (tile === EMPTY_CELL ? base.lower[index] ?? EMPTY_CELL : tile)),
        upper: reference.upper.map((tile, index) => (tile === EMPTY_CELL ? base.upper[index] ?? EMPTY_CELL : tile)),
      }),
    });

    const cards: string[] = [
      `<figure><img src="${referenceName}" alt=""><figcaption>정본 (엔진 산출)</figcaption></figure>`,
    ];

    for (const record of records) {
      const archived = record.tasks.find((entry) => entry.taskId === task.id);
      const attempt = archived?.attempts.find((entry) => entry.parsed !== null);
      if (!attempt?.parsed) {
        const reason = archived?.attempts[0]?.error?.kind ?? "미실행";
        cards.push(
          `<figure class="missing"><div class="none">그림 없음</div>` +
            `<figcaption>${escapeHtml(record.model)} — ${escapeHtml(reason)}</figcaption></figure>`,
        );
        continue;
      }
      const layers = layersOf(attempt.parsed, shape, task.placement ?? "", base);
      const name = `${slug(record.model)}-${slug(task.id)}.png`;
      if (!layers) {
        cards.push(
          `<figure class="missing"><div class="none">형상 불일치</div>` +
            `<figcaption>${escapeHtml(record.model)}</figcaption></figure>`,
        );
        continue;
      }
      shots.push({ name, png: await renderTileGridPng({ width: shape.width, height: shape.height, ...layers }) });
      const score = attempt.scored?.mean;
      cards.push(
        `<figure><img src="${name}" alt=""><figcaption>${escapeHtml(record.model)}` +
          `${score === undefined ? "" : ` — ${score.toFixed(3)}`}</figcaption></figure>`,
      );
    }

    sections.push(
      `<section><h2>${escapeHtml(task.titleKo)} <small>${escapeHtml(task.id)}</small></h2>` +
        `<div class="row">${cards.join("")}</div></section>`,
    );
  }

  const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<title>combined_town 타일 배치 벤치마크 — 증거 시트</title>
<style>
 :root { color-scheme: dark; }
 body { background:#15171c; color:#e6e6e6; font:14px/1.6 system-ui,sans-serif; margin:0; padding:24px 28px; }
 h1 { font-size:20px; margin:0 0 4px; }
 p.lede { color:#9aa0aa; margin:0 0 20px; }
 table.axes { border-collapse:collapse; margin:0 0 28px; font-variant-numeric:tabular-nums; }
 table.axes th, table.axes td { border:1px solid #2c3038; padding:5px 9px; text-align:right; }
 table.axes thead th { background:#1d2027; font-weight:600; text-align:center; font-size:12px; }
 table.axes tbody th { text-align:left; font-weight:600; }
 td.weak { color:#ff8f7a; }
 section { margin:0 0 30px; }
 h2 { font-size:15px; margin:0 0 8px; border-bottom:1px solid #2c3038; padding-bottom:5px; }
 h2 small { color:#6d737f; font-weight:400; margin-left:6px; }
 .row { display:flex; flex-wrap:wrap; gap:14px; align-items:flex-start; }
 figure { margin:0; }
 figure img { display:block; image-rendering:pixelated; border:1px solid #2c3038; }
 figcaption { color:#9aa0aa; font-size:12px; margin-top:4px; }
 figure.missing .none { width:180px; height:120px; border:1px dashed #3a3f4b; color:#6d737f;
   display:flex; align-items:center; justify-content:center; font-size:12px; }
</style></head>
<body>
<h1>combined_town 타일 배치 벤치마크 — 증거 시트</h1>
<p class="lede">자동 점수가 높은데 그림이 엉망인 경우를 잡기 위한 시트다. 0.7 미만은 붉게 표시했다.
모델 그림은 태스크별 첫 채점 성공 시도 한 장이며, 문·울타리 과제는 이미 지어진 집 위에 합성해 보여 준다.</p>
${axisTable(records)}
${sections.join("\n")}
</body></html>
`;
  return { shots, html };
}
