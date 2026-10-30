import { FAMILY, type Family, type Lang, metricFlagged, metricScored, type Strings } from "../core.ts";
import { jevResultJson } from "../jev/gate.ts";
import { getPack } from "../packs.ts";
import { cpLen, cpSlice } from "../text/chars.ts";
import type { JsonObject } from "../text/json.ts";
import { formatFloat, formatNumber } from "../text/num.ts";
import { renderJev } from "./render-jev.ts";
import { overallBand, type Report } from "./scan.ts";

const DEGRADED = "degraded";
const FAMILY_IDS: ReadonlySet<string> = new Set(Object.values(FAMILY));

function isFamily(id: string): id is Family {
  return FAMILY_IDS.has(id);
}

export function labelOf(strings: Strings, id: string): string {
  return isFamily(id) ? strings.familyLabels[id] : id;
}

export function snippet(text: string, max = 110): string {
  return cpLen(text) <= max ? text : `${cpSlice(text, 0, max - 3)}...`;
}

function verdict(r: Report): string {
  return r.degradedReason !== null ? DEGRADED : r.pack.strings.verdicts[r.band];
}

export function renderJson(r: Report): string {
  const familyCounts: Record<string, number> = {};
  const familyLabels: Record<string, string> = {};
  for (const [fam, n] of r.familyCounts) {
    familyCounts[fam] = n;
    familyLabels[fam] = labelOf(r.pack.strings, fam);
  }
  const payload: JsonObject = {
    chars: r.chars,
    lang: r.lang,
    lang_source: r.langSource,
    score: r.score,
    band: r.band,
    verdict: verdict(r),
    hits: r.hits.map((h) => ({ ...h })),
    family_counts: familyCounts,
    family_labels: familyLabels,
    metrics: r.metrics.map((m) => ({
      key: m.key,
      value: m.value,
      threshold: m.threshold,
      higher_is_bad: m.higherIsBad,
      note: m.note,
      advisory: m.advisory,
      evidence: m.evidence,
      flagged: metricFlagged(m),
    })),
    jev: r.jev === null ? null : jevResultJson(r.jev),
    overall_band: overallBand(r),
    dominant_family: r.dominant,
    degraded: r.degradedReason !== null,
    degraded_reason: r.degradedReason,
  };
  return JSON.stringify(payload, null, 1);
}

function header(r: Report, strings: Strings): string[] {
  const head = r.degradedReason !== null ? `${DEGRADED} (${strings.jev.degraded})` : strings.verdicts[r.band];
  const lines = [`chars=${r.chars} score=${formatFloat(r.score)} → ${head}`];
  if (r.dominant !== null) lines.push(`${strings.jev.dominant}: ${labelOf(strings, r.dominant)}`);
  return lines;
}

function hitLines(r: Report, strings: Strings): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const h of r.hits) {
    const key = `${h.sentence}\u0000${h.pid}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(`- [${h.severity} ${labelOf(strings, h.family)}] "${snippet(h.sentence)}" ← '${h.match}' → ${h.hint}`);
  }
  return out;
}

function familyLines(r: Report, strings: Strings): string[] {
  return [...r.familyCounts].sort((a, b) => b[1] - a[1]).map(([fam, n]) => `- ${labelOf(strings, fam)}: ${n}`);
}

function metricLines(r: Report, strings: Strings): string[] {
  return r.metrics.map((m) => {
    const mark = metricScored(m) ? "!!" : metricFlagged(m) ? "!?" : "  ";
    const approx = m.evidence === "estimated" ? "~" : "";
    return `${mark} ${m.key}=${formatNumber(m.value, m.valueKind)} (${strings.thresholdWord} ${m.higherIsBad ? ">" : "<"}${approx}${formatNumber(m.threshold, m.thresholdKind)}) ${m.note}`;
  });
}

export function renderText(r: Report, ui: Lang | null = null): string {
  const strings = ui === null ? r.pack.strings : getPack(ui).strings;
  const lines = [
    ...header(r, strings),
    "",
    strings.headerHits,
    ...hitLines(r, strings),
    "",
    strings.headerFamilies,
    ...familyLines(r, strings),
    "",
    strings.headerMetrics,
    ...metricLines(r, strings),
  ];
  if (r.jev !== null) lines.push(...renderJev(r.jev, strings));
  if (r.degradedReason !== null) lines.push("", `${strings.jev.overall}: ${DEGRADED} (${strings.jev.degraded}; Jev ${r.degradedReason})`);
  else if (r.jev !== null) lines.push("", `${strings.jev.overall}: ${overallBand(r)}`);
  return lines.join("\n");
}
