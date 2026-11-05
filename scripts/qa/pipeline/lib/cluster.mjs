// Turn raw signals into review candidates: deterministic groups, static lint findings and clustered observer
// issues. One candidate = one claim with up to 4 evidence frames, the DOM text of its representative frame,
// and the next frame after it (so the reviewer can tell a transition from a persistent defect).

const AREA = (state) => (state?.screen === "field" ? `field:${state.mapId}` : state?.screen ?? "?");

function normWhere(where) {
  const w = String(where ?? "");
  if (/상단|위|top/i.test(w)) return "top";
  if (/하단|아래|bottom/i.test(w)) return "bottom";
  if (/좌|왼|left/i.test(w)) return "left";
  if (/우|오른|right/i.test(w)) return "right";
  if (/중앙|가운데|center/i.test(w)) return "center";
  return "any";
}

/** frameIndex: Map "<jobId>/<seq>" -> frame row (from detect), with nextOf for the following frame of the same job. */
export function indexFrames(frames) {
  const byKey = new Map();
  const byJob = new Map();
  for (const f of frames) {
    byKey.set(`${f.jobId}/${f.seq}`, f);
    byJob.set(f.jobId, [...(byJob.get(f.jobId) ?? []), f]);
  }
  for (const list of byJob.values()) list.sort((a, b) => a.seq - b.seq);
  const nextOf = (f) => { const list = byJob.get(f.jobId) ?? []; const i = list.findIndex((x) => x.seq === f.seq); return list.slice(i + 1).find((x) => x.file) ?? null; };
  return { byKey, nextOf };
}

function framesFor(rep, members, nextOf) {
  const out = [{ role: "representative", job: rep.jobId, file: rep.file }];
  const next = nextOf(rep);
  if (next) out.push({ role: "next frame after representative", job: next.jobId, file: next.file });
  for (const m of members) {
    if (out.length >= 4) break;
    if (m === rep || !m.file) continue;
    out.push({ role: `member (${m.jobId})`, job: m.jobId, file: m.file });
  }
  return out;
}

export function buildCandidates({ deterministic, staticFindings, observations, frames, game, version }) {
  const { byKey, nextOf } = indexFrames(frames);
  const candidates = [];
  let n = 0;
  const id = (prefix) => `${prefix}${String(++n).padStart(3, "0")}`;

  for (const d of deterministic) {
    const evFrames = (d.evidence ?? []).map((e) => byKey.get(`${e.job}/${e.seq}`)).filter(Boolean);
    const rep = evFrames[0];
    candidates.push({
      id: id("D"), game, version, source: "deterministic", check: d.check, title: d.check, claim: d.claim,
      where: `${d.jobKind} ${d.target?.mapId ?? ""} ${d.target?.eventId ?? d.target?.troopId ?? ""}`.trim(),
      observerSeverity: d.severity, count: d.count, sessions: d.sessions, jobs: d.jobs, target: d.target,
      state: rep ? `screen=${rep.state?.screen} map=${rep.state?.mapId} dialogue=${(rep.state?.dialogue ?? "").slice(0, 80)}` : null,
      inputs: rep?.inputs?.slice(-6).join(" > ") ?? null, domText: rep?.domText ?? "", signals: d.dom ? { dom: d.dom } : null,
      frames: rep ? framesFor(rep, evFrames, nextOf) : [],
    });
  }
  for (const s of staticFindings) {
    candidates.push({ id: id("S"), game, version, source: "static", check: s.check, title: s.check, claim: s.claim, where: s.where, observerSeverity: s.severity, count: 1, sessions: 0, target: s.target, frames: [] });
  }

  const groups = new Map();
  for (const o of observations) {
    if (!o.ok) continue;
    const f = byKey.get(o.key);
    if (!f) continue;
    for (const issue of o.issues) {
      if ((issue.confidence ?? 0) < 0.5) continue;
      const key = `${issue.check}|${AREA(f.state)}|${normWhere(issue.where)}`;
      const g = groups.get(key) ?? { key, check: issue.check, items: [] };
      g.items.push({ f, issue });
      groups.set(key, g);
    }
  }
  for (const g of groups.values()) {
    g.items.sort((a, b) => (b.issue.confidence ?? 0) - (a.issue.confidence ?? 0));
    const rep = g.items[0];
    const members = g.items.map((x) => x.f);
    candidates.push({
      id: id("V"), game, version, source: "observer", check: g.check, title: `${g.check} ${rep.issue.where ?? ""}`.trim(),
      claim: rep.issue.desc, where: `${rep.issue.where ?? ""} · ${AREA(rep.f.state)}`, quote: rep.issue.quote ?? "",
      observerReason: g.items.slice(1, 3).map((x) => x.issue.desc).join(" / ") || null,
      count: g.items.length, sessions: new Set(members.map((m) => m.jobId)).size, jobs: [...new Set(members.map((m) => m.jobId))].slice(0, 12),
      target: rep.f.target, state: `screen=${rep.f.state?.screen} map=${rep.f.state?.mapId} dialogue=${(rep.f.state?.dialogue ?? "").slice(0, 80)}`,
      inputs: (rep.f.inputs ?? []).slice(-6).join(" > "), domText: rep.f.domText ?? "",
      frames: framesFor(rep.f, members, nextOf),
    });
  }
  return candidates;
}
