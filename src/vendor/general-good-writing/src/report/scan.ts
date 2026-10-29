import {
  type Band,
  bandOf,
  dominantFamily,
  type Lang,
  type LangPack,
  type Metric,
  metricPoints,
  SEVERITIES,
  SEVERITY_WEIGHT,
  type Severity,
  sanitize,
  stripMarkup,
  tailText,
} from "../core.ts";
import { detectLang } from "../detect.ts";
import { type Hit, regexHits } from "../hits.ts";
import { type Client, JevBackendError } from "../jev/client.ts";
import { type JevResult, type RegexCandidate, run as runJev } from "../jev/gate.ts";
import { segment } from "../jev/l0.ts";
import { DEFAULT_PROFILE, disambiguationTerm, PROFILES, type Profile } from "../jev/questions.ts";
import { getPack } from "../packs.ts";
import { cpLen } from "../text/chars.ts";
import { roundHalfEven } from "../text/num.ts";

export type LangSource = "auto" | "flag";
export type OverallBand = Band | "degraded";

export type Report = {
  readonly chars: number;
  readonly lang: Lang;
  readonly langSource: LangSource;
  readonly score: number;
  readonly band: Band;
  readonly hits: readonly Hit[];
  /** Insertion-ordered by first hit, keyed by family id. */
  readonly familyCounts: ReadonlyMap<string, number>;
  readonly metrics: readonly Metric[];
  readonly pack: LangPack;
  readonly jev: JevResult | null;
  /** A family carrying most of the regex score with no metric flagged; the band is then capped at fix. */
  readonly dominant: string | null;
  /** Set when the Jev backend failed: only the local rules ran, so no overall verdict is claimed. */
  readonly degradedReason: string | null;
};

export type ScanOptions = {
  readonly lang?: Lang | null;
  readonly minSeverity?: Severity;
  readonly unitChars?: number;
  readonly jev?: Client | null;
  readonly profile?: Profile | null;
  readonly brief?: string | null;
  readonly claim?: string | null;
};

const BAND_RANK: Readonly<Record<Band, number>> = { pass: 0, fix: 1, rewrite: 2 };

export function overallBand(r: Report): OverallBand {
  if (r.degradedReason !== null) return "degraded";
  if (r.jev === null || r.jev.gate === "pass") return r.band;
  return BAND_RANK[r.band] >= BAND_RANK.fix ? r.band : "fix";
}

function allowedSeverities(min: Severity): ReadonlySet<Severity> {
  return new Set(SEVERITIES.slice(0, SEVERITIES.indexOf(min) + 1));
}

function candidates(hits: readonly Hit[]): RegexCandidate[] {
  const out: RegexCandidate[] = [];
  for (const h of hits) {
    const term = disambiguationTerm(h.family, h.match);
    if (term !== null) out.push([h.pid, h.family, h.sentence, h.match, term]);
  }
  return out;
}

async function judge(
  text: string,
  lang: Lang,
  hits: readonly Hit[],
  opts: ScanOptions,
): Promise<{ readonly jev: JevResult | null; readonly degraded: string | null }> {
  const client = opts.jev ?? null;
  if (client === null) return { jev: null, degraded: null };
  const profile = opts.profile ?? PROFILES[DEFAULT_PROFILE];
  try {
    const jev = await runJev(client, segment(text, lang), profile, {
      regexHits: candidates(hits),
      brief: opts.brief ?? null,
      claim: opts.claim ?? null,
    });
    return { jev, degraded: null };
  } catch (e) {
    if (e instanceof JevBackendError) return { jev: null, degraded: e.reason };
    throw e;
  }
}

/** Each family's share of the regex score: severity weights summed per family, divided by the text's length in units. */
export function familyWeights(hits: readonly Hit[], perUnit: number): Map<string, number> {
  const weights = new Map<string, number>();
  for (const h of hits) weights.set(h.family, (weights.get(h.family) ?? 0) + SEVERITY_WEIGHT[h.severity] / perUnit);
  return weights;
}

/** The length divisor of the regex score: the text in units, never below one. */
export function unitsOf(chars: number, unitChars: number): number {
  return Math.max(1.0, chars / unitChars);
}

/** `unitChars` overrides the pack's density unit (calibration only); `jev: null` skips the judgment layer. */
export async function scan(raw: string, opts: ScanOptions = {}): Promise<Report> {
  const text = sanitize(raw);
  const flagged = opts.lang ?? null;
  const lang: Lang = flagged ?? detectLang(text);
  const base = getPack(lang);
  const pack: LangPack = opts.unitChars === undefined ? base : { ...base, unitChars: opts.unitChars };
  const plain = stripMarkup(text);
  const profile = opts.profile ?? null;
  const all = regexHits(text, pack, allowedSeverities(opts.minSeverity ?? "low"), tailText(plain));
  const muted = profile === null ? all : all.filter((h) => !profile.mutePids.has(h.pid));
  const { jev, degraded } = await judge(text, lang, muted, opts);
  const dismissed = new Set((jev?.dismissed ?? []).map((d) => `${d.pid}\u0000${d.sentence}\u0000${d.match}`));
  const hits = muted.filter((h) => !dismissed.has(`${h.pid}\u0000${h.sentence}\u0000${h.match}`));
  const computed = pack.computeMetrics(text, profile?.name ?? null, hits);
  const metrics = profile === null ? computed : computed.filter((m) => !profile.muteMetrics.has(m.key));
  const familyWeight = familyWeights(hits, unitsOf(cpLen(plain), pack.unitChars));
  const points = metricPoints(metrics);
  let weightSum = 0;
  for (const w of familyWeight.values()) weightSum += w;
  const score = roundHalfEven(weightSum + points, 2);
  const dominant = dominantFamily(familyWeight, points);
  const rawBand = bandOf(score, pack.fixAt(profile?.name ?? null));
  const band: Band = rawBand === "rewrite" && dominant !== null ? "fix" : rawBand;
  const familyCounts = new Map<string, number>();
  for (const h of hits) familyCounts.set(h.family, (familyCounts.get(h.family) ?? 0) + 1);
  return {
    chars: cpLen(plain),
    lang,
    langSource: flagged === null ? "auto" : "flag",
    score,
    band,
    hits,
    familyCounts,
    metrics,
    pack,
    jev,
    dominant,
    degradedReason: degraded,
  };
}
