import fs from "node:fs";
import path from "node:path";
import { findCharsetAsset } from "@/assets/charsetCatalog";
import {
  CHARSET_FRAME_HEIGHT,
  CHARSET_FRAME_WIDTH,
  CHARSET_SHEET_COLUMNS,
  CHARSET_SHEET_ROWS,
  charsetFrameSource,
  decodeCharsetFrameIndex,
} from "@/assets/easyrpgRtp";
import { FLAG_AXES } from "./axes";
import type { FlagRunSuite, FlagTaskOutcome } from "./runner";
import type { AuthoredEventShape, AuthoredPageShape, FlagAxisId } from "./types";

const SPRITE_SCALE = 2;
const GRADE_COLOR: Record<string, string> = {
  A: "#38d39f",
  B: "#7ad151",
  C: "#e8c547",
  D: "#e8853f",
  F: "#e5484d",
};

function esc(value: unknown): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function scoreColor(score: number): string {
  if (score >= 0.85) return "#38d39f";
  if (score >= 0.6) return "#7ad151";
  if (score >= 0.4) return "#e8c547";
  if (score > 0) return "#e8853f";
  return "#e5484d";
}

function pct(score: number): string {
  return `${Math.round(score * 100)}%`;
}

const dataUrlCache = new Map<string, string | null>();

function charsetDataUrl(spriteId: string | undefined): { url: string; assetPath: string } | null {
  if (!spriteId) return null;
  const asset = findCharsetAsset(spriteId);
  if (!asset) return null;
  if (!dataUrlCache.has(asset.path)) {
    try {
      const bytes = fs.readFileSync(path.join("public", asset.path));
      dataUrlCache.set(asset.path, `data:image/png;base64,${bytes.toString("base64")}`);
    } catch {
      dataUrlCache.set(asset.path, null);
    }
  }
  const url = dataUrlCache.get(asset.path) ?? null;
  return url ? { url, assetPath: asset.path } : null;
}

function spriteTile(spriteId: string | undefined, frameIndex: number | undefined, label: string): string {
  const resolved = charsetDataUrl(spriteId);
  if (!resolved) {
    return `<span class="sprite sprite-empty" title="${esc(label)}">?</span>`;
  }
  const source = charsetFrameSource(decodeCharsetFrameIndex(frameIndex ?? 0));
  const style = [
    `width:${CHARSET_FRAME_WIDTH * SPRITE_SCALE}px`,
    `height:${CHARSET_FRAME_HEIGHT * SPRITE_SCALE}px`,
    `background-image:url('${resolved.url}')`,
    `background-size:${CHARSET_SHEET_COLUMNS * CHARSET_FRAME_WIDTH * SPRITE_SCALE}px ${CHARSET_SHEET_ROWS * CHARSET_FRAME_HEIGHT * SPRITE_SCALE}px`,
    `background-position:-${source.x * SPRITE_SCALE}px -${source.y * SPRITE_SCALE}px`,
  ].join(";");
  return `<span class="sprite" style="${style}" title="${esc(label)} · ${esc(spriteId)}"></span>`;
}

function meanByAxis(outcomes: readonly FlagTaskOutcome[]): Map<FlagAxisId, number> {
  const totals = new Map<FlagAxisId, number>();
  for (const axis of FLAG_AXES) {
    const scores = outcomes.map((outcome) => outcome.axes.find((entry) => entry.id === axis.id)?.score ?? 0);
    const mean = scores.length > 0 ? scores.reduce((sum, value) => sum + value, 0) / scores.length : 0;
    totals.set(axis.id, mean);
  }
  return totals;
}

function svgBarChart(outcomes: readonly FlagTaskOutcome[]): string {
  const rowHeight = 34;
  const labelWidth = 210;
  const barWidth = 620;
  const height = outcomes.length * rowHeight + 34;
  const bars = outcomes
    .map((outcome, index) => {
      const y = index * rowHeight + 24;
      const width = Math.max(2, (outcome.total / 100) * barWidth);
      const color = GRADE_COLOR[outcome.grade] ?? "#8b93a7";
      return [
        `<text x="${labelWidth - 10}" y="${y + 15}" class="bl" text-anchor="end">${esc(outcome.taskId)}</text>`,
        `<rect x="${labelWidth}" y="${y + 3}" width="${barWidth}" height="18" rx="4" fill="#1b2030"/>`,
        `<rect x="${labelWidth}" y="${y + 3}" width="${width}" height="18" rx="4" fill="${color}"/>`,
        `<text x="${labelWidth + width + 8}" y="${y + 16}" class="bv">${outcome.total} · ${esc(outcome.grade)}</text>`,
      ].join("");
    })
    .join("");
  const ticks = [0, 25, 50, 75, 100]
    .map((tick) => {
      const x = labelWidth + (tick / 100) * barWidth;
      return `<line x1="${x}" y1="18" x2="${x}" y2="${height - 6}" stroke="#2a3145"/><text x="${x}" y="12" class="tk" text-anchor="middle">${tick}</text>`;
    })
    .join("");
  return `<svg viewBox="0 0 ${labelWidth + barWidth + 80} ${height}" class="chart" role="img" aria-label="태스크별 총점">${ticks}${bars}</svg>`;
}

function svgHeatmap(outcomes: readonly FlagTaskOutcome[]): string {
  const cell = 82;
  const rowHeight = 40;
  const labelWidth = 200;
  const headerHeight = 48;
  const width = labelWidth + FLAG_AXES.length * cell + 16;
  const height = headerHeight + outcomes.length * rowHeight + 10;
  const header = FLAG_AXES.map((axis, index) => {
    const x = labelWidth + index * cell + cell / 2;
    const [first, ...restWords] = axis.label.split(" ");
    const rest = restWords.join(" ");
    const firstLine = `<text x="${x}" y="${rest ? headerHeight - 24 : headerHeight - 14}" class="hh">${esc(first)}</text>`;
    const secondLine = rest ? `<text x="${x}" y="${headerHeight - 11}" class="hh">${esc(rest)}</text>` : "";
    return firstLine + secondLine;
  }).join("");
  const rows = outcomes
    .map((outcome, rowIndex) => {
      const y = headerHeight + rowIndex * rowHeight;
      const label = `<text x="${labelWidth - 10}" y="${y + 24}" class="bl" text-anchor="end">${esc(outcome.taskId)}</text>`;
      const cells = FLAG_AXES.map((axis, columnIndex) => {
        const entry = outcome.axes.find((candidate) => candidate.id === axis.id);
        const score = entry?.score ?? 0;
        const x = labelWidth + columnIndex * cell;
        const ring = entry?.targeted
          ? `<rect x="${x + 2}" y="${y + 4}" width="${cell - 6}" height="${rowHeight - 10}" rx="5" fill="none" stroke="#cbd3e6" stroke-width="2"/>`
          : "";
        return [
          `<rect x="${x + 4}" y="${y + 6}" width="${cell - 10}" height="${rowHeight - 14}" rx="4" fill="${scoreColor(score)}" opacity="${0.25 + score * 0.75}"/>`,
          ring,
          `<text x="${x + cell / 2 - 2}" y="${y + rowHeight / 2 + 4}" class="cv" text-anchor="middle">${pct(score)}</text>`,
        ].join("");
      }).join("");
      return label + cells;
    })
    .join("");
  return `<svg viewBox="0 0 ${width} ${height}" class="chart" role="img" aria-label="태스크 x 축 히트맵">${header}${rows}</svg>`;
}

function svgRadar(outcomes: readonly FlagTaskOutcome[]): string {
  const size = 380;
  const center = size / 2;
  const radius = 132;
  const means = meanByAxis(outcomes);
  const point = (index: number, value: number): { x: number; y: number } => {
    const angle = (index / FLAG_AXES.length) * Math.PI * 2 - Math.PI / 2;
    return { x: center + Math.cos(angle) * radius * value, y: center + Math.sin(angle) * radius * value };
  };
  const rings = [0.25, 0.5, 0.75, 1]
    .map((ring) => {
      const points = FLAG_AXES.map((_, index) => {
        const p = point(index, ring);
        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      }).join(" ");
      return `<polygon points="${points}" fill="none" stroke="#2a3145"/>`;
    })
    .join("");
  const spokes = FLAG_AXES.map((axis, index) => {
    const outer = point(index, 1);
    const label = point(index, 1.2);
    const anchor = label.x > center + 6 ? "start" : label.x < center - 6 ? "end" : "middle";
    return [
      `<line x1="${center}" y1="${center}" x2="${outer.x.toFixed(1)}" y2="${outer.y.toFixed(1)}" stroke="#2a3145"/>`,
      `<text x="${label.x.toFixed(1)}" y="${label.y.toFixed(1)}" class="rl" text-anchor="${anchor}">${esc(axis.label)}</text>`,
    ].join("");
  }).join("");
  const shape = FLAG_AXES.map((axis, index) => {
    const p = point(index, means.get(axis.id) ?? 0);
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(" ");
  const dots = FLAG_AXES.map((axis, index) => {
    const value = means.get(axis.id) ?? 0;
    const p = point(index, value);
    return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="${scoreColor(value)}"/>`;
  }).join("");
  return `<svg viewBox="-40 -20 ${size + 80} ${size + 40}" class="radar" role="img" aria-label="축별 평균 레이더">${rings}${spokes}<polygon points="${shape}" fill="#4c7dff" fill-opacity="0.28" stroke="#7aa2ff" stroke-width="2"/>${dots}</svg>`;
}

function pageNode(page: AuthoredPageShape, index: number, x: number, y: number, width: number): string {
  const gate = page.conditions.length > 0 ? page.conditions.join(" · ") : "조건 없음 (기본 페이지)";
  const gateColor = page.conditions.length > 0 ? "#7aa2ff" : "#8b93a7";
  const writes = page.flagWrites.length > 0 ? page.flagWrites : ["(플래그 변경 없음)"];
  const bodyHeight = 34 + writes.length * 15;
  const lines = writes
    .map((write, writeIndex) => `<text x="${x + 12}" y="${y + 46 + writeIndex * 15}" class="nw">${esc(write)}</text>`)
    .join("");
  return [
    `<text x="${x + width / 2}" y="${y - 8}" class="ng" text-anchor="middle" fill="${gateColor}">${esc(gate)}</text>`,
    `<rect x="${x}" y="${y}" width="${width}" height="${bodyHeight}" rx="7" fill="#161b28" stroke="${gateColor}" stroke-width="1.5"/>`,
    `<text x="${x + 12}" y="${y + 20}" class="nt">${index + 1}. ${esc(page.name)}</text>`,
    `<text x="${x + 12}" y="${y + 34}" class="nk">${esc(page.commandKinds.slice(0, 6).join(", ") || "명령 없음")}</text>`,
    lines,
  ].join("");
}

function stateMachineSvg(event: AuthoredEventShape): string {
  const nodeWidth = 300;
  const gap = 30;
  let cursor = 26;
  const nodes: string[] = [];
  const arrows: string[] = [];
  for (const [index, page] of event.pages.entries()) {
    const writes = Math.max(1, page.flagWrites.length);
    const bodyHeight = 34 + writes * 15;
    if (index > 0) {
      arrows.push(
        `<line x1="${nodeWidth / 2 + 20}" y1="${cursor - gap + 4}" x2="${nodeWidth / 2 + 20}" y2="${cursor - 16}" stroke="#3a425c" stroke-width="1.5" marker-end="url(#ar)"/>`
      );
    }
    nodes.push(pageNode(page, index, 20, cursor, nodeWidth));
    cursor += bodyHeight + gap;
  }
  const height = Math.max(80, cursor);
  return `<svg viewBox="0 0 ${nodeWidth + 60} ${height}" class="fsm" role="img" aria-label="${esc(event.eventId)} 페이지 상태 기계"><defs><marker id="ar" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#3a425c"/></marker></defs>${arrows.join("")}${nodes.join("")}</svg>`;
}

function eventBlock(event: AuthoredEventShape): string {
  const gated = event.pages.filter((page) => page.conditions.length > 0).length;
  return `<div class="event">
  <div class="event-head">${spriteTile(event.spriteId, event.frameIndex, event.eventId)}
    <div><strong>${esc(event.eventId)}</strong>
      <div class="muted">${esc(event.mapId)} · (${event.x}, ${event.y}) · 페이지 ${event.pages.length}개 · 조건 있는 페이지 ${gated}개</div>
    </div>
  </div>
  ${stateMachineSvg(event)}
</div>`;
}

function axisRows(outcome: FlagTaskOutcome): string {
  return outcome.axes
    .map((axis) => {
      const evidence =
        axis.evidence.length > 0
          ? `<ul class="ev">${axis.evidence.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`
          : "";
      return `<div class="axis${axis.targeted ? " targeted" : ""}">
  <div class="axis-top"><span class="axis-name">${esc(axis.label)}${axis.targeted ? '<span class="tag">겨냥</span>' : ""}</span><span class="axis-score" style="color:${scoreColor(axis.score)}">${pct(axis.score)}</span></div>
  <div class="meter"><i style="width:${Math.max(1, axis.score * 100)}%;background:${scoreColor(axis.score)}"></i></div>
  <div class="axis-detail">${esc(axis.detail)}</div>
  ${evidence}
</div>`;
    })
    .join("");
}

function toolTrace(outcome: FlagTaskOutcome): string {
  if (outcome.toolCalls.length === 0) {
    return `<p class="muted">툴 호출 0건 — 모델이 도구를 쓰지 않고 대화로만 응답했다.</p>`;
  }
  const failed = outcome.toolCalls.filter((call) => !call.ok).length;
  const items = outcome.toolCalls
    .map(
      (call) =>
        `<li class="${call.ok ? "ok" : "bad"}"><code>${esc(call.name)}</code><span>${esc(call.summary.slice(0, 160))}</span></li>`
    )
    .join("");
  return `<p class="muted">툴 호출 ${outcome.toolCalls.length}건 · 실패 ${failed}건</p><ol class="tools">${items}</ol>`;
}

function metricsGrid(outcome: FlagTaskOutcome): string {
  const m = outcome.metrics;
  const cells: readonly [string, string][] = [
    ["사용한 스위치", m.usedSwitchIds.length > 0 ? m.usedSwitchIds.join(", ") : "없음"],
    ["사용한 변수", m.usedVariableIds.length > 0 ? m.usedVariableIds.join(", ") : "없음"],
    ["이름 붙은 스위치/변수", `${m.namedUsedSwitches} / ${m.namedUsedVariables}`],
    ["storyFlags 등록", String(m.registeredUsedFlags)],
    ["self-switch 쓰기 / 읽기", `${m.selfSwitchWrites} / ${m.selfSwitchReads}`],
    ["변수 산술 / 비교", `${m.variableArithmeticWrites} / ${m.variableComparisonReads}`],
    ["이벤트 / 멀티페이지", `${m.totalEvents} / ${m.multiPageEvents}`],
    ["페이지 / 플래그 게이팅", `${m.totalPages} / ${m.flagGatedPages}`],
    ["fork 플래그 조건", String(m.forkFlagConditions)],
    ["미선언 참조", m.danglingSwitchRefs.concat(m.danglingVariableRefs).join(", ") || "없음"],
    ["고아 플래그", m.orphanFlagIds.join(", ") || "없음"],
    ["lint error / 플래그 경고", `${m.lintErrors} / ${m.flagLintWarnings}`],
  ];
  return `<div class="metrics">${cells
    .map(([key, value]) => `<div><dt>${esc(key)}</dt><dd>${esc(value)}</dd></div>`)
    .join("")}</div>`;
}

function taskCard(outcome: FlagTaskOutcome): string {
  const color = GRADE_COLOR[outcome.grade] ?? "#8b93a7";
  const events =
    outcome.events.length > 0
      ? `<div class="events">${outcome.events.map(eventBlock).join("")}</div>`
      : `<p class="muted">저작된 이벤트가 없다 — 상태 기계를 그릴 대상이 없다.</p>`;
  const problem = outcome.error ? `<p class="warn">중단: ${esc(outcome.error)}</p>` : "";
  return `<section class="card">
  <header>
    <div class="grade" style="border-color:${color};color:${color}">${esc(outcome.grade)}</div>
    <div class="card-title">
      <h3>${esc(outcome.title)}</h3>
      <p class="muted">${esc(outcome.summary)}</p>
      <p class="stats">총점 <b>${outcome.total}</b> · 겨냥 축 평균 <b>${outcome.targetedTotal}</b> · 라운드 ${outcome.rounds} · 툴 ${outcome.toolCalls.length}건 · ${Math.round(outcome.durationMs / 1000)}초 · ${outcome.tokens.toLocaleString("en-US")} 토큰 · 종료 ${esc(outcome.stoppedReason)}</p>
    </div>
  </header>
  ${problem}
  <details><summary>AI 가 받은 지시문 (원문)</summary><blockquote>${esc(outcome.prompt)}</blockquote></details>
  <h4>AI 가 실제로 만든 이벤트 상태 기계</h4>
  ${events}
  <h4>축별 채점</h4>
  <div class="axes">${axisRows(outcome)}</div>
  <h4>계측값</h4>
  ${metricsGrid(outcome)}
  <h4>툴 호출 추적</h4>
  ${toolTrace(outcome)}
</section>`;
}

function overallGrade(total: number): string {
  if (total >= 85) return "A";
  if (total >= 70) return "B";
  if (total >= 55) return "C";
  if (total >= 35) return "D";
  return "F";
}

export function renderFlagLiteracyReport(suite: FlagRunSuite): string {
  const outcomes = suite.outcomes.filter((outcome): outcome is FlagTaskOutcome => Boolean(outcome));
  const average =
    outcomes.length > 0 ? Math.round((outcomes.reduce((sum, outcome) => sum + outcome.total, 0) / outcomes.length) * 10) / 10 : 0;
  const grade = overallGrade(average);
  const means = meanByAxis(outcomes);
  const weakest = [...means.entries()].sort((a, b) => a[1] - b[1]).slice(0, 3);
  const axisLabel = new Map(FLAG_AXES.map((axis) => [axis.id, axis.label]));
  const totalTokens = outcomes.reduce((sum, outcome) => sum + outcome.tokens, 0);
  const totalTools = outcomes.reduce((sum, outcome) => sum + outcome.toolCalls.length, 0);
  const failedTools = outcomes.reduce((sum, outcome) => sum + outcome.toolCalls.filter((call) => !call.ok).length, 0);

  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>에디터 AI 스위치/변수 활용 능력 보고서 — ${esc(suite.model)}</title>
<style>
:root{color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:#0d1017;color:#dfe4ee;font:14px/1.6 "Pretendard","Noto Sans KR",system-ui,sans-serif}
.wrap{max-width:1280px;margin:0 auto;padding:32px 24px 80px}
h1{font-size:26px;margin:0 0 6px}
h2{font-size:19px;margin:44px 0 12px;padding-bottom:8px;border-bottom:1px solid #232a3c}
h3{font-size:17px;margin:0 0 4px}
h4{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#8b93a7;margin:24px 0 10px}
p{margin:0 0 8px}
.muted{color:#8b93a7;font-size:13px}
.lede{max-width:70ch;color:#b7bfd0}
.hero{display:flex;gap:24px;align-items:center;flex-wrap:wrap;background:#131824;border:1px solid #232a3c;border-radius:12px;padding:20px 24px;margin-top:18px}
.big{font-size:52px;font-weight:700;line-height:1}
.kv{display:flex;gap:26px;flex-wrap:wrap}
.kv div{min-width:110px}
.kv dt{color:#8b93a7;font-size:12px}
.kv dd{margin:2px 0 0;font-size:16px;font-weight:600}
table{border-collapse:collapse;width:100%;font-size:13px}
th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #232a3c;vertical-align:top}
th{color:#8b93a7;font-weight:600}
.chart{width:100%;height:auto;background:#131824;border:1px solid #232a3c;border-radius:10px;padding:10px}
.radar{width:420px;max-width:100%;height:auto;background:#131824;border:1px solid #232a3c;border-radius:10px}
.split{display:flex;gap:20px;flex-wrap:wrap;align-items:flex-start}
.split>*{flex:1 1 380px;min-width:0}
text{font-family:inherit}
.bl{fill:#b7bfd0;font-size:12px}
.bv{fill:#dfe4ee;font-size:12px;font-weight:600}
.tk{fill:#6b7488;font-size:10px}
.hh{fill:#b7bfd0;font-size:11px;text-anchor:middle}
.cv{fill:#0d1017;font-size:10px;font-weight:700}
.rl{fill:#b7bfd0;font-size:11px}
.card{background:#131824;border:1px solid #232a3c;border-radius:12px;padding:20px 22px;margin:18px 0}
.card header{display:flex;gap:16px;align-items:flex-start}
.grade{flex:0 0 56px;height:56px;border:2px solid;border-radius:10px;display:grid;place-items:center;font-size:26px;font-weight:700}
.card-title{min-width:0}
.stats{font-size:12px;color:#96a0b5;margin-top:6px}
.warn{background:#3a1d20;border:1px solid #7a2c31;color:#ffb4b7;padding:8px 12px;border-radius:7px;font-size:13px}
details{margin:12px 0}
summary{cursor:pointer;color:#8b93a7;font-size:13px}
blockquote{margin:8px 0 0;padding:10px 14px;background:#0f131d;border-left:3px solid #4c7dff;border-radius:0 7px 7px 0;white-space:pre-wrap;font-size:13px;color:#c8d0e0}
.events{display:flex;gap:16px;flex-wrap:wrap}
.event{background:#0f131d;border:1px solid #232a3c;border-radius:10px;padding:12px}
.event-head{display:flex;gap:10px;align-items:center;margin-bottom:6px}
.sprite{display:inline-block;image-rendering:pixelated;background-repeat:no-repeat;background-clip:padding-box;border-radius:4px;flex:none}
.sprite-empty{width:48px;height:64px;background:#1b2030;color:#5a6479;display:grid;place-items:center;font-size:18px}
.fsm{width:340px;max-width:100%;height:auto}
.nt{fill:#dfe4ee;font-size:12px;font-weight:600}
.nk{fill:#7f889c;font-size:10px}
.nw{fill:#9fd3b4;font-size:10px;font-family:ui-monospace,monospace}
.ng{font-size:10.5px;font-weight:600}
.axes{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}
.axis{background:#0f131d;border:1px solid #232a3c;border-radius:8px;padding:10px 12px}
.axis.targeted{border-color:#3d5480}
.axis-top{display:flex;justify-content:space-between;gap:8px;align-items:baseline}
.axis-name{font-size:13px;font-weight:600}
.axis-score{font-size:15px;font-weight:700}
.tag{margin-left:6px;font-size:10px;font-weight:600;color:#9db8ff;border:1px solid #3d5480;border-radius:4px;padding:1px 4px;vertical-align:1px}
.meter{height:5px;background:#1b2030;border-radius:3px;margin:7px 0;overflow:hidden}
.meter i{display:block;height:100%}
.axis-detail{font-size:12px;color:#a8b1c4}
.ev{margin:6px 0 0;padding-left:16px;font-size:11.5px;color:#e8a87f}
.metrics{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px}
.metrics div{background:#0f131d;border:1px solid #232a3c;border-radius:7px;padding:8px 10px}
.metrics dt{color:#8b93a7;font-size:11px}
.metrics dd{margin:2px 0 0;font-size:12.5px;font-family:ui-monospace,monospace;word-break:break-all}
.tools{margin:6px 0 0;padding-left:22px;font-size:12px;max-height:260px;overflow:auto}
.tools li{margin:2px 0}
.tools li.bad code{color:#ff9ea1}
.tools li.ok code{color:#8fd6b0}
.tools code{font-family:ui-monospace,monospace}
.tools span{color:#8b93a7;margin-left:8px}
footer{margin-top:56px;padding-top:18px;border-top:1px solid #232a3c;color:#8b93a7;font-size:12.5px}
code.cmd{background:#0f131d;border:1px solid #232a3c;border-radius:5px;padding:2px 6px;font-family:ui-monospace,monospace}
</style></head><body><div class="wrap">

<h1>에디터 AI 는 스위치와 변수를 제대로 쓰는가?</h1>
<p class="lede">사용자가 편집기 AI 에게 <b>복잡한 NPC·몬스터</b>를 만들라고 시켰을 때, AI 가 스위치·변수·셀프스위치로 상태를 올바르게 설계하는지 9개 축으로 채점한다.
태스크 지시문은 <b>스위치를 쓰라고 말하지 않는다</b> — 원하는 게임플레이만 서술하고, 그 게임플레이가 상태 없이는 구현 불가능하게 만들었다. 따라서 점수는 AI 가 스스로 상태 설계에 도달하는 능력을 뜻한다.</p>

<div class="hero">
  <div><div class="big" style="color:${GRADE_COLOR[grade] ?? "#8b93a7"}">${esc(grade)}</div><div class="muted">종합 등급</div></div>
  <dl class="kv">
    <div><dt>평균 총점</dt><dd>${average} / 100</dd></div>
    <div><dt>모델</dt><dd>${esc(suite.model)}</dd></div>
    <div><dt>태스크</dt><dd>${outcomes.length}개</dd></div>
    <div><dt>라운드 상한</dt><dd>${suite.maxRounds}</dd></div>
    <div><dt>툴 예산</dt><dd>${suite.maxToolCalls}/턴</dd></div>
    <div><dt>태스크 제한시간</dt><dd>${Math.round(suite.taskTimeoutMs / 1000)}초</dd></div>
    <div><dt>툴 호출</dt><dd>${totalTools}건 (실패 ${failedTools})</dd></div>
    <div><dt>총 토큰</dt><dd>${totalTokens.toLocaleString("en-US")}</dd></div>
    <div><dt>실행</dt><dd>${esc(suite.startedAt)}</dd></div>
  </dl>
</div>

<h2>가장 약한 축</h2>
<p class="lede">${weakest
    .map((entry) => `<b>${esc(axisLabel.get(entry[0]) ?? entry[0])}</b> ${pct(entry[1])}`)
    .join(" · ")}</p>

<h2>채점 축 9개</h2>
<table><thead><tr><th>축</th><th>묻는 것</th><th>가중치</th><th>평균</th></tr></thead><tbody>
${FLAG_AXES.map(
    (axis) =>
      `<tr><td><b>${esc(axis.label)}</b></td><td>${esc(axis.question)}</td><td>${Math.round(axis.weight * 100)}%</td><td style="color:${scoreColor(means.get(axis.id) ?? 0)};font-weight:600">${pct(means.get(axis.id) ?? 0)}</td></tr>`
  ).join("")}
</tbody></table>

<h2>태스크별 총점</h2>
${svgBarChart(outcomes)}

<h2>태스크 × 축 히트맵</h2>
<p class="muted">흰 테두리 = 그 태스크가 겨냥한 축(설계상 반드시 요구되는 능력).</p>
${svgHeatmap(outcomes)}

<h2>축별 평균 프로필</h2>
<div class="split">
  ${svgRadar(outcomes)}
  <div>
    <table><thead><tr><th>축</th><th>평균</th></tr></thead><tbody>
    ${FLAG_AXES.map(
      (axis) =>
        `<tr><td>${esc(axis.label)}</td><td><div class="meter" style="width:160px"><i style="width:${Math.max(1, (means.get(axis.id) ?? 0) * 100)}%;background:${scoreColor(means.get(axis.id) ?? 0)}"></i></div></td></tr>`
    ).join("")}
    </tbody></table>
  </div>
</div>

<h2>태스크별 상세</h2>
${outcomes.map(taskCard).join("")}

<footer>
재현: <code class="cmd">npx tsx scripts/flag-literacy-bench.mts run --model ${esc(suite.model)} --tasks ${outcomes.length} --rounds ${suite.maxRounds}</code><br>
채점기 <code class="cmd">src/benchmark/flags/</code> · 태스크 정의 <code class="cmd">src/benchmark/flags/tasks.ts</code> · 계약 테스트 <code class="cmd">test/flagLiteracy.test.ts</code><br>
스프라이트는 저장소의 charset PNG 를 base64 로 인라인해 잘라 쓴다 — 이 문서는 외부 요청을 하지 않는다. API 키는 보고서·결과 JSON 에 저장되지 않는다.
</footer>
</div></body></html>`;
}
