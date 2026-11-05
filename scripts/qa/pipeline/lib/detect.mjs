// Deterministic checks over player traces. These need no model and decide most cases outright:
// errors, failed requests, missing resources, stuck/soft-locked runs, prolonged black screens, DOM-measured
// text clipping and off-screen UI. Only frames these checks cannot decide go to the vision observer.

const IGNORE_NET = /favicon|items\/shared|pixel-enemy/;
const IGNORE_CONSOLE = /AudioContext|play\(\) failed|autoplay|NotAllowedError|webgl|GL_|GPU stall/i;

function frameRef(job, row) {
  return { job: job.id, seq: row.seq, file: row.file, label: row.label };
}

/** @returns {{ findings: object[], frames: object[] }} findings with evidence + every frame row annotated for observation */
export function detectRun(runs) {
  const findings = [];
  const frames = [];
  const add = (f) => findings.push({ source: "deterministic", ...f });

  for (const { job, summary, rows } of runs) {
    const base = { game: job.slug, version: job.version, jobId: job.id, jobKind: job.kind, input: job.input, viewport: job.viewportName, target: job.target ?? null };
    if (summary?.fatal) add({ ...base, check: "session-fatal", severity: "function", claim: `세션이 오류로 끝났다: ${summary.fatal}`, evidence: rows.slice(-1).map((r) => frameRef(job, r)) });
    if ((summary?.blockedCount ?? 0) > 0) add({ ...base, check: "external-request", severity: "function", claim: `게임이 외부 주소를 요청했다(차단됨) ${summary.blocked.slice(0, 3).join(" ")}`, evidence: [] });
    let darkRun = [];
    for (const row of rows) {
      const ev = [frameRef(job, row)];
      for (const e of row.errors ?? []) {
        if (e.kind === "console" && IGNORE_CONSOLE.test(e.text)) continue;
        add({ ...base, check: e.kind === "pageerror" ? "page-error" : "console-error", severity: e.kind === "pageerror" ? "function" : "visual", claim: e.text, key: `${e.kind}|${e.text.replace(/\d+/g, "#").slice(0, 120)}`, evidence: ev, state: row.state, inputs: row.inputs });
      }
      for (const n of row.net ?? []) {
        if (IGNORE_NET.test(n.url)) continue;
        const asset = n.url.replace(/^https?:\/\/[^/]+\/[^/]+\/[^/]+/, "");
        add({ ...base, check: "asset-request", severity: "visual", claim: `${n.status ?? n.why} ${asset}`, key: `net|${asset}`, evidence: ev, state: row.state });
      }
      if (row.state?.missingResource) add({ ...base, check: "missing-resource", severity: "visual", claim: row.state.missingResource, key: `missing|${row.state.missingResource}`, evidence: ev, state: row.state });
      if ((row.state?.missingTextures ?? 0) > 0) add({ ...base, check: "missing-texture", severity: "visual", claim: `화면에 그림 없는(__MISSING) 객체 ${row.state.missingTextures}개`, key: `mtex|${row.state.mapId}`, evidence: ev, state: row.state });
      if (/stuck$/.test(row.label ?? "")) add({ ...base, check: "stuck", severity: "blocker", claim: `입력 6번에도 화면 상태가 바뀌지 않음 (screen=${row.state?.screen} map=${row.state?.mapId} dialogue=${(row.state?.dialogue ?? "").slice(0, 40)})`, key: `stuck|${row.state?.mapId}|${(row.state?.dialogue ?? "").slice(0, 30)}`, evidence: ev, state: row.state, inputs: row.inputs });
      if (row.darkMs >= 3500) darkRun.push(row); else darkRun = [];
      if (darkRun.length === 1) add({ ...base, check: "black-screen", severity: "blocker", claim: `화면이 ${row.darkMs / 1000}초 넘게 검은색 (전환 프레임이 아니라 지속)`, key: `black|${row.state?.screen}|${row.state?.mapId}`, evidence: ev, state: row.state, inputs: row.inputs });
      for (const o of row.dom?.overflow ?? []) {
        if (!o.text || o.text.length < 2) continue;
        const kind = o.offscreen ? "offscreen-ui" : "text-clipped";
        if (o.ellipsis && !o.offscreen) continue; // deliberate ellipsis truncation is a design choice, the reviewer sees it via observer if it matters
        add({ ...base, check: kind, severity: "visual", claim: `${o.el} 글자 "${o.text}" ${o.offscreen ? "화면 밖으로 나감" : "자기 상자에서 잘림"} rect=${o.rect.join(",")} (${job.viewportName})`, key: `${kind}|${o.el}|${o.text.slice(0, 24)}|${job.viewportName}`, evidence: ev, state: row.state, dom: o });
      }
      frames.push({ ...base, seq: row.seq, file: row.file, label: row.label, settled: row.settled, darkMs: row.darkMs, lum: row.lum, hash: row.hash, state: row.state, domText: row.dom?.text ?? "", inputs: row.inputs });
    }
    if (job.kind === "event" && summary?.result && summary.result.free && (summary.result.steps ?? 0) === 0 && (job.target?.kinds ?? []).some((k) => k === "text" || k === "choices" || k === "shop")) {
      add({ ...base, check: "event-no-response", severity: "function", claim: `이벤트 ${job.target.eventId} 를 실행했는데 대사·선택지·상점이 나오지 않았다 (페이지 ${job.target.page})`, key: `noresp|${job.target.eventId}`, evidence: rows.slice(0, 2).map((r) => frameRef(job, r)) });
    }
    if (job.script === "walk") {
      const walks = rows.filter((r) => /^walk-(up|right|down|left)$/.test(r.label ?? ""));
      if (walks.length === 4 && walks.every((r) => r.state?.screen === "field" && !r.state?.dialogue) && new Set(walks.map((r) => `${r.state?.x},${r.state?.y}`)).size === 1) {
        add({ ...base, check: "cannot-move", severity: "function", claim: `${job.target?.mapId} 입장 지점에서 네 방향 모두 한 칸도 못 움직임 (${walks[0].state?.x},${walks[0].state?.y})`, key: `nomove|${job.target?.mapId}`, evidence: walks.map((r) => frameRef(job, r)) });
      }
    }
  }
  return { findings, frames };
}

/** Collapse repeats of the same deterministic finding into one candidate with a count. */
export function groupDeterministic(findings) {
  const groups = new Map();
  for (const f of findings) {
    const key = `${f.game}|${f.check}|${f.key ?? f.claim.slice(0, 80)}`;
    const g = groups.get(key);
    if (g) { g.count += 1; g.jobs.add(f.jobId); if (g.evidence.length < 4) g.evidence.push(...(f.evidence ?? []).slice(0, 1)); }
    else groups.set(key, { ...f, count: 1, jobs: new Set([f.jobId]), evidence: [...(f.evidence ?? [])].slice(0, 3) });
  }
  return [...groups.values()].map((g) => ({ ...g, sessions: g.jobs.size, jobs: [...g.jobs].slice(0, 12) }));
}

/** Frames worth showing the vision observer: settled, not dark, one per perceptual-hash bucket per screen. */
export function selectForObserver(frames, { maxPerScreen = 400, hamming = 6 } = {}) {
  const kept = [];
  const seen = [];
  const dist = (a, b) => { let x = BigInt("0x" + a) ^ BigInt("0x" + b); let n = 0; while (x) { n += Number(x & 1n); x >>= 1n; } return n; };
  const perScreen = {};
  for (const f of frames) {
    if (!f.file || !f.hash) continue;
    if (!f.settled || (f.lum ?? 0) < 10) continue;
    if (f.state?.screen === "loading" || f.state?.screen === "unreadable") continue;
    const sk = f.state?.screen ?? "?";
    if ((perScreen[sk] ?? 0) >= maxPerScreen) continue;
    if (seen.some((s) => s.screen === sk && s.viewport === f.viewport && dist(s.hash, f.hash) <= hamming)) continue;
    seen.push({ screen: sk, viewport: f.viewport, hash: f.hash });
    perScreen[sk] = (perScreen[sk] ?? 0) + 1;
    kept.push(f);
  }
  return kept;
}
