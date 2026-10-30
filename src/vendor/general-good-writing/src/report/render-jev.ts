import type { Strings } from "../core.ts";
import type { JevResult } from "../jev/gate.ts";
import { cpLen, cpSlice } from "../text/chars.ts";
import { asString, inlineJson } from "../text/json.ts";
import { formatFloat } from "../text/num.ts";

const FLOAT_DETAIL_KEYS: ReadonlySet<string> = new Set(["confidence", "share", "value", "mean_chars", "ratio"]);

function cut(text: string, max: number): string {
  return cpLen(text) <= max ? text : cpSlice(text, 0, max);
}

export function renderJev(jev: JevResult, strings: Strings): string[] {
  const s = strings.jev;
  const lines = [
    "",
    `${s.header} (${jev.profile}, ${jev.sentences} ${s.sentences}, ${jev.usage.requests} req, $${formatFloat(jev.usage.usd)})`,
  ];
  lines.push(`${s.gate}: ${jev.gate}${jev.gateReasons.length > 0 ? ` (${jev.gateReasons.join("; ")})` : ""}`);
  for (const f of jev.findings) {
    if (f.layer !== "L1") continue;
    const mark = f.advisory ? "!?" : f.route === "read" ? "??" : "!!";
    const text = cpLen(f.text) <= 110 ? f.text : `${cpSlice(f.text, 0, 107)}...`;
    const choice = asString(f.detail["choice"]);
    const extra = choice === undefined ? "" : ` ${choice}`;
    lines.push(`${mark} [${f.question}${extra} ${formatFloat(f.value)}] "${text}" @${f.where}`);
  }
  for (const f of jev.findings) {
    if (f.layer !== "L2") continue;
    const mark = f.advisory ? "!?" : "!!";
    const detail = Object.keys(f.detail).length > 0 ? inlineJson(f.detail, FLOAT_DETAIL_KEYS) : "";
    lines.push(cut(`${mark} [${f.question} ${formatFloat(f.value)}] ${cut(f.text, 80)} ${detail}`, 400));
  }
  if (jev.dismissed.length > 0) {
    lines.push(`${s.dismissed}: ${jev.dismissed.map((d) => `${d.pid}('${d.match}' ${d.reason} ${formatFloat(d.value)})`).join(", ")}`);
  }
  return lines;
}
